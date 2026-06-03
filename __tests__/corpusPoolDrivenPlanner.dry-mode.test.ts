/**
 * CORPUS-30-POOL-DRIVEN-PLANNER §10: dry-mode emits attribution + zero Supabase writes.
 *
 * Exercises the runner's dry path via the banked-pool branch and asserts the
 * key attribution fields appear in every move_validated event.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const REPO_ROOT = path.resolve(__dirname, '..');
const RUNNER = path.join(REPO_ROOT, 'scripts', 'bot-fixtures', 'runXaiAdversarialBotCorpus.js');
const BANK_BUILDER = path.join(REPO_ROOT, 'scripts', 'bot-fixtures', 'xaiAdversarialOptionBankBuilder.js');
const HARVEST_FIXTURE = path.join(REPO_ROOT, 'fixtures', 'bot-fixtures', 'option-bank-builder-canonical.json');

type AnyObj = Record<string, unknown>;

describe('CORPUS-30 runner — dry mode + banked-pool integration', () => {
  let tmpDir: string;
  let bankedPath: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'corpus30-dry-'));
    // 1) Convert the canonical fixture into a banked pool. The canonical
    //    file has 2 seeds, so target-count is 2 too.
    const harvestPath = path.join(tmpDir, 'harvest.jsonl');
    const fixture = JSON.parse(fs.readFileSync(HARVEST_FIXTURE, 'utf8'));
    const lines: string[] = fixture.events.map((e: AnyObj) => JSON.stringify(e));
    fs.writeFileSync(harvestPath, lines.join('\n') + '\n');
    bankedPath = path.join(tmpDir, 'pool.jsonl');
    const r = spawnSync('node', [BANK_BUILDER, '--in', harvestPath, '--out', bankedPath, '--target-count', '2'], { encoding: 'utf8' });
    // Builder exits 0 when target met; 4 when shortfall — we accept both since
    // we want the output file.
    expect([0, 4]).toContain(r.status);
    expect(fs.existsSync(bankedPath)).toBe(true);
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('runner refuses live without env gates (refuseLive contract)', () => {
    const runner = require('../scripts/bot-fixtures/runXaiAdversarialBotCorpus');
    const refusals = runner.refuseLive({ pilot: false }, { hasXaiKey: false, enableXai: false, hasAnthropicKey: false, enableAnthropic: false, hasBotTests: false });
    expect(refusals.length).toBeGreaterThan(0);
  });

  it('readBankedPoolFile accepts the banker output + rejects raw harvester JSONL', () => {
    const runner = require('../scripts/bot-fixtures/runXaiAdversarialBotCorpus');
    const seeds = runner.readBankedPoolFile(bankedPath);
    expect(seeds.length).toBeGreaterThan(0);
    for (const s of seeds) expect(s.event).toBe('seed');

    // Raw harvester JSONL (scenario_build events) must be rejected with a clear message.
    const harvestPath = path.join(tmpDir, 'raw-harvest.jsonl');
    fs.writeFileSync(harvestPath, JSON.stringify({ stage: 'scenario_build', sourceHash: 'h', sourcePost: { redactedText: 'a' } }) + '\n');
    expect(() => runner.readBankedPoolFile(harvestPath)).toThrow(/harvester scenario_build events/);
  });

  it('dry runner with --banked-pool emits move_validated with attribution', () => {
    const r = spawnSync('node', [RUNNER, '--dry', '--banked-pool', bankedPath, '--scenarios', '2', '--max-depth', '6', '--run-kind', 'corpus-dev-synthetic'], { encoding: 'utf8', timeout: 60000 });
    expect(r.status).toBe(0);
    // Find the produced JSONL.
    const logDir = path.join(REPO_ROOT, 'logs', 'engagement-intelligence');
    if (!fs.existsSync(logDir)) throw new Error('logs/engagement-intelligence/ not created');
    const files = fs.readdirSync(logDir).filter((f) => f.endsWith('-xai-adversarial-semantic-corpus.jsonl'));
    files.sort();
    const latest = files[files.length - 1];
    const jsonlPath = path.join(logDir, latest);
    const events: AnyObj[] = fs.readFileSync(jsonlPath, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) as AnyObj; } catch { return null; } }).filter((x): x is AnyObj => Boolean(x));
    const moveValidated = events.filter((e) => e.stage === 'move_validated');
    expect(moveValidated.length).toBeGreaterThan(0);
    for (const ev of moveValidated) {
      // Every move_validated event carries the attribution fields the design names.
      expect(typeof ev.runTag).toBe('string');
      expect(['provocateur', 'revocateur']).toContain(ev.role);
      expect(typeof ev.threadIndex).toBe('number');
      expect(typeof ev.moveIndex).toBe('number');
      expect(typeof ev.bankName).toBe('string');
      expect(typeof ev.optionIndex).toBe('number');
      expect(typeof ev.optionId).toBe('string');
      expect(typeof ev.spineId).toBe('string');
    }
    // Zero Supabase writes — every submit_result is 'skipped'.
    const submitResults = events.filter((e) => e.stage === 'submit_result');
    expect(submitResults.length).toBeGreaterThan(0);
    for (const sr of submitResults) expect(sr.status).toBe('skipped');
  });

  it('seed_assignment event appears and seedIds are unique', () => {
    const logDir = path.join(REPO_ROOT, 'logs', 'engagement-intelligence');
    const files = fs.readdirSync(logDir).filter((f) => f.endsWith('-xai-adversarial-semantic-corpus.jsonl')).sort();
    const latest = files[files.length - 1];
    const events: AnyObj[] = fs.readFileSync(path.join(logDir, latest), 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l) as AnyObj; } catch { return null; } }).filter((x): x is AnyObj => Boolean(x));
    const sa = events.find((e) => e.stage === 'seed_assignment');
    expect(sa).toBeTruthy();
    const ids = sa!.assignedSeedIds as string[];
    expect(Array.isArray(ids)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
