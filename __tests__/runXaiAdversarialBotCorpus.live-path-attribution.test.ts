/**
 * CORPUS-30-LIVE-PATH-WIRING — Fix 1, Test 1.
 *
 * Asserts that the live-mode banked move loop emits `move_validated`
 * events with the FULL 11-field attribution per design §4 Fix 1:
 *   runId · runTag · seedId · threadIndex · role · moveIndex · bankName ·
 *   optionIndex · optionId · voiceId · spineId · attribution
 *
 * Uses stubbed Anthropic / Supabase clients (NO live provider call).
 *
 * Pre-CORPUS-30 evidence: the runId `0d507a4c` JSONL exposed 0 occurrences
 * of bankName / optionIndex / spineId on live-path move_validated. This
 * test asserts the bug is closed.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const runner = require('../scripts/bot-fixtures/runXaiAdversarialBotCorpus');
const sceneBuilder = require('../scripts/bot-fixtures/xaiAdversarialSceneBuilder');
const planner = require('../scripts/bot-fixtures/corpusPoolDrivenPlanner');

type Event = Record<string, unknown>;

// ── Test helpers ──────────────────────────────────────────────

function makeStubbedSeed(): Record<string, unknown> {
  // Mirrors the option-bank-builder output shape (banks per role-bank
  // floor). 4 opening, 4 objection, 4 evidence_pressure, 3 alt_explain,
  // 3 concession, 3 resolution.
  function mkOption(bankName: string, idx: number) {
    return {
      optionId: `opt-${bankName.slice(0, 3)}-${idx}`,
      bankName,
      skeleton: {
        targetExcerpt: `target excerpt mode shift parallel arterial ${idx}`,
        spineHint: ['quote-led', 'mechanism-led', 'scope-led', 'definition-led'][idx % 4],
        axisHint: 'evidence',
        summary: `demand primary source mechanism mode shift parallel arterial token ${idx}`,
        evidenceDebt: ['primary source for the mode-shift number'],
        antiAmplificationNote: 'viral civic infographics are not primary records',
      },
      provenance: { sourceHash: 'src-1', replyHash: `rep-${idx}` },
    };
  }
  return {
    event: 'seed',
    seedId: 'seed-001',
    sourceHash: 'src-001',
    claimSummary: 'Cities that add a continuous bike lane reduce car traffic on the parallel arterial.',
    issueFrame: 'civic_policy',
    bankShortfall: false,
    banks: {
      opening_claim_options: [0, 1, 2, 3].map((i) => mkOption('opening_claim_options', i)),
      objection_options: [0, 1, 2, 3].map((i) => mkOption('objection_options', i)),
      evidence_pressure_options: [0, 1, 2, 3].map((i) => mkOption('evidence_pressure_options', i)),
      alternative_explanation_options: [0, 1, 2].map((i) => mkOption('alternative_explanation_options', i)),
      concession_or_narrowing_options: [0, 1, 2].map((i) => mkOption('concession_or_narrowing_options', i)),
      resolution_pressure_options: [0, 1, 2].map((i) => mkOption('resolution_pressure_options', i)),
    },
    bankCounts: {
      opening_claim_options: 4, objection_options: 4, evidence_pressure_options: 4,
      alternative_explanation_options: 3, concession_or_narrowing_options: 3, resolution_pressure_options: 3,
    },
  };
}

function makeStubbedScene(seed: Record<string, unknown>, runId: string, runTag: string, threadIndex: number) {
  const used = new Map<string, Set<number>>();
  const banks = seed.banks as Record<string, Array<Record<string, unknown>>>;
  const m1Selection = planner.selectOption({
    runId, threadIndex, role: 'provocateur', moveIndex: 1,
    bankName: 'opening_claim_options', bank: banks.opening_claim_options,
    usedOptionsForThread: used,
  });
  const m2Selection = planner.selectOption({
    runId, threadIndex, role: 'revocateur', moveIndex: 2,
    bankName: 'objection_options', bank: banks.objection_options,
    usedOptionsForThread: used,
  });
  const voiceIdByAlias: Record<string, string> = {
    'bot-a': planner.assignVoiceId(runId, 'user-a'),
    'bot-b': planner.assignVoiceId(runId, 'user-b'),
    'bot-c': planner.assignVoiceId(runId, 'user-c'),
  };
  const scene = sceneBuilder.buildBankedAdversarialScene({
    seed,
    m1Selection,
    m2Selection,
    botPool: [
      { alias: 'bot-a', label: 'Alex', email: 'a@a' },
      { alias: 'bot-b', label: 'Jordan', email: 'b@b' },
      { alias: 'bot-c', label: 'Sam', email: 'c@c' },
    ],
    opts: { seed: 'test-seed', runId, runTag, threadIndex, voiceIdByAlias },
  });
  scene.personas = scene.personas.map((p: Record<string, unknown>) => ({
    ...p,
    skillHash: p.skillRole === 'bot-provocateur' ? 'prov-hash-16chars'
              : p.skillRole === 'bot-revocateur' ? 'revo-hash-16chars'
              : 'synth-hash-16chars',
  }));
  return { scene, used };
}

function makeStubbedLiveCtx() {
  const inserts: Array<Record<string, unknown>> = [];
  const submitted: Array<Record<string, unknown>> = [];

  // Stubbed admin/bot client: from(...).insert(...).select(...).single()
  // returns a fake debate id; functions.invoke('submit-argument', ...)
  // returns ok=true with a synthetic argument id.
  function makeBotClient(label: string) {
    let argCounter = 0;
    return {
      from(table: string) {
        return {
          insert(row: Record<string, unknown>) {
            inserts.push({ table, label, row });
            return {
              select() {
                return {
                  single: async () => ({ data: { id: `dbg-${table}-${inserts.length}` }, error: null }),
                };
              },
              error: null,
            };
          },
          select() {
            return {
              eq() {
                return {
                  single: async () => ({ data: { id: 'constitution-id-1' }, error: null }),
                };
              },
            };
          },
        };
      },
      functions: {
        invoke: async (_name: string, opts: Record<string, unknown>) => {
          argCounter += 1;
          submitted.push({ label, body: opts.body });
          return { data: { argument: { id: `arg-${label}-${argCounter}` } }, error: null };
        },
      },
    };
  }

  const adminClient = makeBotClient('admin');
  return {
    cfg: {},
    adminClient,
    botByAlias: {
      'bot-a': { userId: 'user-a', email: 'a@a', client: makeBotClient('bot-a'), label: 'Alex' },
      'bot-b': { userId: 'user-b', email: 'b@b', client: makeBotClient('bot-b'), label: 'Jordan' },
      'bot-c': { userId: 'user-c', email: 'c@c', client: makeBotClient('bot-c'), label: 'Sam' },
    },
    // Mock Anthropic client: returns a body that satisfies option +
    // spine alignment (echoes summary tokens + matches spine opening).
    anthropic: {
      generate: async (opts: Record<string, unknown>) => {
        // The user payload includes a SELECTED_OPTION block; we echo
        // its summary + targetExcerpt so option-alignment passes, and
        // we lead with a quote to satisfy any quote-led spine.
        const userPayload = String(opts.userPayload || '');
        const summaryMatch = userPayload.match(/summary:\s+([^\n]+)/i);
        const targetMatch = userPayload.match(/targetExcerpt:\s+"?([^"\n]+)"?/i);
        const summary = summaryMatch ? summaryMatch[1].trim() : 'primary source mechanism mode shift';
        const target = targetMatch ? targetMatch[1].trim() : '';
        const body = `"${target.slice(0, 40)}" — counterexample worth pressing on; ${summary}; demand primary source.`;
        return { text: JSON.stringify({ body, disagreementAxis: 'evidence', mechanism: 'mode-shift' }) };
      },
      snapshotUsage: () => ({ inputTokens: 100, outputTokens: 50 }),
    },
    _inserts: inserts,
    _submitted: submitted,
  };
}

// ── JSONL capture ─────────────────────────────────────────────

function makeJsonlCapture() {
  const events: Event[] = [];
  return {
    write(stage: string, extras: Record<string, unknown> = {}) {
      events.push({ stage, ...extras });
    },
    events,
  };
}

// ── Tests ────────────────────────────────────────────────────

describe('CORPUS-30 live-path attribution emission', () => {
  it('emits all 11 attribution fields on every move_validated event (M1..M6)', async () => {
    const runId = '2026-06-03T17-00-00-000Z-cafebabe';
    const runTag = planner.buildRunTag(runId, 'corpus-prod-synthetic');
    const seed = makeStubbedSeed();
    const { scene, used } = makeStubbedScene(seed, runId, runTag, 0);
    const jsonl = makeJsonlCapture();
    const liveCtx = makeStubbedLiveCtx();
    const liveCallCounters = { xaiCalls: 0, anthropicCalls: 0, supabaseWrites: 0 };
    const source = { sourceHash: seed.sourceHash, sourceClaimSummary: seed.claimSummary, sourceTextRedacted: seed.claimSummary };

    const result = await runner.postLiveBankedScenario({
      args: { dry: false, maxDepth: 6 },
      jsonl, scenario: {
        scene, source, dissent: { replyHash: 'rep-1', replyTextRedacted: 'dissent' }, dissentSource: 'banked_pool',
        seed, threadIndex: 0, usedOptionsForThread: used, runTag,
      },
      bundle: { provocateurText: 'prov body', revocateurText: 'rev body', provocateurHash: 'prov-hash-16chars', revocateurHash: 'revo-hash-16chars' },
      liveCtx, runId, runTag, liveCallCounters,
    });

    expect(result.error).toBeFalsy();
    expect(result.posted).toBeGreaterThanOrEqual(6);
    const moveValidatedEvents = jsonl.events.filter((e) => e.stage === 'move_validated');
    expect(moveValidatedEvents.length).toBe(6);
    for (const ev of moveValidatedEvents) {
      // All 11 attribution-related fields per design.
      expect(ev.runTag).toBe(runTag);
      expect(ev.seedId).toBe('seed-001');
      expect(typeof ev.threadIndex).toBe('number');
      expect(['provocateur', 'revocateur']).toContain(ev.role);
      expect(typeof ev.moveIndex).toBe('number');
      expect(typeof ev.bankName).toBe('string');
      expect((ev.bankName as string).length).toBeGreaterThan(0);
      expect(typeof ev.optionIndex).toBe('number');
      expect(typeof ev.optionId).toBe('string');
      expect((ev.optionId as string).length).toBeGreaterThan(0);
      expect(typeof ev.voiceId).toBe('string');
      expect((ev.voiceId as string).length).toBeGreaterThan(0);
      expect(typeof ev.spineId).toBe('string');
      expect((ev.spineId as string).length).toBeGreaterThan(0);
      // The attribution object also carries the same fields nested.
      expect(ev.attribution).toBeTruthy();
      const attr = ev.attribution as Record<string, unknown>;
      expect(attr.runTag).toBe(runTag);
    }
  });

  it('emits non-zero bankName/optionIndex/spineId counts (the bug being fixed)', async () => {
    const runId = '2026-06-03T17-01-00-000Z-deadbeef';
    const runTag = planner.buildRunTag(runId, 'corpus-prod-synthetic');
    const seed = makeStubbedSeed();
    const { scene, used } = makeStubbedScene(seed, runId, runTag, 1);
    const jsonl = makeJsonlCapture();
    const liveCtx = makeStubbedLiveCtx();
    const liveCallCounters = { xaiCalls: 0, anthropicCalls: 0, supabaseWrites: 0 };

    await runner.postLiveBankedScenario({
      args: { dry: false, maxDepth: 4 },
      jsonl, scenario: {
        scene, source: { sourceHash: seed.sourceHash, sourceClaimSummary: seed.claimSummary, sourceTextRedacted: seed.claimSummary },
        dissent: { replyHash: 'r', replyTextRedacted: 'd' }, dissentSource: 'banked_pool',
        seed, threadIndex: 1, usedOptionsForThread: used, runTag,
      },
      bundle: { provocateurText: 'p', revocateurText: 'r', provocateurHash: 'p-hash', revocateurHash: 'r-hash' },
      liveCtx, runId, runTag, liveCallCounters,
    });

    // The bug: pre-fix, these counts were 0 on the live path.
    const jsonText = JSON.stringify(jsonl.events);
    const bankNameCount = (jsonText.match(/"bankName"/g) || []).length;
    const optionIndexCount = (jsonText.match(/"optionIndex"/g) || []).length;
    const spineIdCount = (jsonText.match(/"spineId"/g) || []).length;
    // Each move_validated has 1 bankName, 1 optionIndex, 1 spineId (PLUS
    // a nested attribution object that may carry duplicates).
    expect(bankNameCount).toBeGreaterThanOrEqual(4);
    expect(optionIndexCount).toBeGreaterThanOrEqual(4);
    expect(spineIdCount).toBeGreaterThanOrEqual(4);
  });

  it('writes to a real JSONL (using fs StageJsonlStream) and the file contains attribution', async () => {
    // Verify integration with the on-disk StageJsonlStream produces JSONL
    // events the reporter can re-read. Use a temp dir to avoid clobbering
    // logs/engagement-intelligence/.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'corpus30-livepath-'));
    const jsonlPath = path.join(tmp, 'test.jsonl');
    // The StageJsonlStream class is internal; mirror the same interface
    // via the same write contract.
    const stream = fs.createWriteStream(jsonlPath);
    const runId = '2026-06-03T17-02-00-000Z-feedface';
    const runTag = planner.buildRunTag(runId, 'corpus-dev-synthetic');
    const skillGate = { provocateurHash: 'p'.repeat(16), revocateurHash: 'r'.repeat(16), validated: true };
    const jsonlStream = {
      events: new Map<string, number>(),
      write(stage: string, extras: Record<string, unknown> = {}) {
        const ev = { runId, ts: new Date().toISOString(), stage, sourceMode: 'xai_live', skillGate, ...extras };
        stream.write(JSON.stringify(ev) + '\n');
        this.events.set(stage, (this.events.get(stage) || 0) + 1);
      },
    };
    const seed = makeStubbedSeed();
    const { scene, used } = makeStubbedScene(seed, runId, runTag, 2);
    const liveCtx = makeStubbedLiveCtx();
    const liveCallCounters = { xaiCalls: 0, anthropicCalls: 0, supabaseWrites: 0 };

    await runner.postLiveBankedScenario({
      args: { dry: false, maxDepth: 4 },
      jsonl: jsonlStream, scenario: {
        scene, source: { sourceHash: seed.sourceHash, sourceClaimSummary: seed.claimSummary, sourceTextRedacted: seed.claimSummary },
        dissent: { replyHash: 'r', replyTextRedacted: 'd' }, dissentSource: 'banked_pool',
        seed, threadIndex: 2, usedOptionsForThread: used, runTag,
      },
      bundle: { provocateurText: 'p', revocateurText: 'r', provocateurHash: 'p-hash', revocateurHash: 'r-hash' },
      liveCtx, runId, runTag, liveCallCounters,
    });
    await new Promise<void>((resolve) => stream.end(resolve));

    const raw = fs.readFileSync(jsonlPath, 'utf8');
    const lines = raw.split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const moveValidated = lines.filter((e: Record<string, unknown>) => e.stage === 'move_validated');
    expect(moveValidated.length).toBe(4);
    for (const ev of moveValidated) {
      expect(ev.runTag).toBe(runTag);
      expect(ev.seedId).toBe('seed-001');
      expect(ev.bankName).toBeTruthy();
      expect(ev.spineId).toBeTruthy();
      expect(ev.voiceId).toBeTruthy();
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
