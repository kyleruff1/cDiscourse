/**
 * CORPUS-30-LIVE-PATH-WIRING — Fix 3, Test 7.
 *
 * Asserts the runner emits a `provider_call_summary` JSONL event with
 * `xaiCalls`, `anthropicCalls`, `supabaseWrites` integer fields BEFORE
 * the final `run_summary` event. Both events come from the same main()
 * call; the ordering matters because the reporter consumes the summary
 * preferentially over per-event aggregation.
 *
 * Uses the dry-mode banked path so no live providers are touched.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawnSync } from 'child_process';

const repoRoot = process.cwd();

describe('CORPUS-30 provider_call_summary emission', () => {
  it('runner source code emits provider_call_summary BEFORE run_summary in main()', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'scripts/bot-fixtures/runXaiAdversarialBotCorpus.js'), 'utf8');
    // Look for the FINAL jsonl.write('run_summary' call (top-level main
    // closure) and the matching provider_call_summary write that
    // precedes it. The runner has multiple internal references to the
    // string in comments + helpers; we anchor on the actual write call
    // chain at the end of main().
    const runSummaryMatches = [...src.matchAll(/jsonl\.write\(['"]run_summary['"]/g)];
    const providerSummaryMatches = [...src.matchAll(/jsonl\.write\(['"]provider_call_summary['"]/g)];
    expect(runSummaryMatches.length).toBeGreaterThan(0);
    expect(providerSummaryMatches.length).toBeGreaterThan(0);
    // Find the LAST run_summary write (main's final emission). The
    // provider_call_summary write must precede it within ~600 chars.
    const lastRunSummary = runSummaryMatches[runSummaryMatches.length - 1].index || 0;
    // The provider_call_summary write paired with main()'s final
    // run_summary lives within ~800 chars before it.
    const before = src.slice(Math.max(0, lastRunSummary - 1200), lastRunSummary);
    expect(before).toMatch(/jsonl\.write\(['"]provider_call_summary['"]/);
  });

  it('the provider_call_summary write includes xaiCalls + anthropicCalls + supabaseWrites integer fields', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'scripts/bot-fixtures/runXaiAdversarialBotCorpus.js'), 'utf8');
    // Extract a window of source around the provider_call_summary write
    // and assert it references each counter.
    const match = src.match(/jsonl\.write\(['"]provider_call_summary['"][\s\S]{0,400}?\}\);/);
    expect(match).toBeTruthy();
    if (!match) return;
    expect(match[0]).toContain('xaiCalls');
    expect(match[0]).toContain('anthropicCalls');
    expect(match[0]).toContain('supabaseWrites');
  });

  it('liveCallCounters object is initialised with all three integer fields = 0 before the loop', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'scripts/bot-fixtures/runXaiAdversarialBotCorpus.js'), 'utf8');
    expect(src).toMatch(/const liveCallCounters\s*=\s*\{\s*xaiCalls:\s*0,\s*anthropicCalls:\s*0,\s*supabaseWrites:\s*0\s*\}/);
  });

  it('dry-mode subprocess emits provider_call_summary BEFORE run_summary (live JSONL file integration)', () => {
    // Run the runner in dry mode against the banked-pool path. We use
    // a tiny synthetic banked-pool JSONL written to a temp dir; the
    // runner produces its own JSONL we read back via --annotation-jsonl.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'corpus30-summary-'));
    const poolPath = path.join(tmp, 'pool.jsonl');

    // Synthesize a minimal pool with one eligible seed.
    function mkOption(bankName: string, idx: number) {
      return {
        optionId: `${bankName.slice(0, 3)}-${idx}`, bankName,
        skeleton: {
          targetExcerpt: `target ${idx}`,
          spineHint: 'mechanism-led', axisHint: 'evidence',
          summary: `primary source mechanism token ${idx} demand quote`,
          evidenceDebt: ['p'], antiAmplificationNote: 'a',
        },
      };
    }
    const seed = {
      event: 'seed', seedId: 'seed-int', sourceHash: 'src-int',
      claimSummary: 'A claim',
      issueFrame: 'civic_policy', bankShortfall: false,
      banks: {
        opening_claim_options: [0, 1, 2, 3].map((i) => mkOption('opening_claim_options', i)),
        objection_options: [0, 1, 2, 3].map((i) => mkOption('objection_options', i)),
        evidence_pressure_options: [0, 1, 2, 3].map((i) => mkOption('evidence_pressure_options', i)),
        alternative_explanation_options: [0, 1, 2].map((i) => mkOption('alternative_explanation_options', i)),
        concession_or_narrowing_options: [0, 1, 2].map((i) => mkOption('concession_or_narrowing_options', i)),
        resolution_pressure_options: [0, 1, 2].map((i) => mkOption('resolution_pressure_options', i)),
      },
    };
    fs.writeFileSync(poolPath, JSON.stringify(seed) + '\n' + JSON.stringify({ event: 'pool_summary', total: 1 }) + '\n');

    // Run the runner from the repo root so it can find
    // .claude/skills/bot-{provocateur,revocateur}/SKILL.md. Redirect
    // the JSONL via --annotation-jsonl. The Markdown report goes to
    // docs/testing-runs/ with the --report-name suffix; we delete it
    // after the test so the working tree stays clean.
    const jsonlPath = path.join(tmp, 'test.jsonl');
    const reportName = 'test-corpus30-summary-integration';
    const ranAt = new Date().toISOString();
    const result = spawnSync(process.execPath, [
      path.join(repoRoot, 'scripts/bot-fixtures/runXaiAdversarialBotCorpus.js'),
      '--dry', '--scenarios', '1', '--max-depth', '4',
      '--banked-pool', poolPath,
      '--report-name', reportName,
      '--annotation-jsonl', jsonlPath,
    ], { cwd: repoRoot, env: { ...process.env }, timeout: 60_000 });

    if (result.status !== 0) {
      throw new Error(`runner failed (status ${result.status}): ${result.stderr ? result.stderr.toString() : ''}`);
    }

    // Clean up the markdown report the runner wrote (test should not
    // leave artifacts in docs/testing-runs/).
    const date = new Date().toISOString().slice(0, 10);
    const mdPath = path.join(repoRoot, 'docs', 'testing-runs', `${date}-${reportName}-dry.md`);
    if (fs.existsSync(mdPath)) {
      try { fs.unlinkSync(mdPath); } catch { /* ignore */ }
    }

    expect(fs.existsSync(jsonlPath)).toBe(true);
    const lines = fs.readFileSync(jsonlPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const stages = lines.map((e: Record<string, unknown>) => e.stage);
    const summaryIdx = stages.indexOf('provider_call_summary');
    const runIdx = stages.indexOf('run_summary');
    expect(summaryIdx).toBeGreaterThanOrEqual(0);
    expect(runIdx).toBeGreaterThan(summaryIdx);
    const summaryEv = lines[summaryIdx] as Record<string, unknown>;
    expect(typeof summaryEv.xaiCalls).toBe('number');
    expect(typeof summaryEv.anthropicCalls).toBe('number');
    expect(typeof summaryEv.supabaseWrites).toBe('number');
    expect(summaryEv.runId).toBeTruthy();

    // The committed run_summary also carries the providerCallSummary
    // object for older consumers.
    const runEv = lines[runIdx] as Record<string, unknown>;
    expect(runEv.providerCallSummary).toBeTruthy();
    expect((runEv.providerCallSummary as Record<string, unknown>).xaiCalls).toBe(summaryEv.xaiCalls);

    void ranAt; // appease unused-var lint
    fs.rmSync(tmp, { recursive: true, force: true });
  }, 90_000);
});
