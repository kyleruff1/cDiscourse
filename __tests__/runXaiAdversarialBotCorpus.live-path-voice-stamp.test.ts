/**
 * CORPUS-30-LIVE-PATH-WIRING — Fix 1, Test 2.
 *
 * Asserts the live-mode `bot_assignment` event carries a resolved
 * `voiceId` per bot — NOT just inside `scenario_build.botAssignment
 * .voiceIdByAlias`. Pre-fix evidence (runId 0d507a4c): voiceId count
 * was 3 (all inside scenario_build); 0 on bot_assignment + 0 on
 * move_validated. This test asserts the bug is closed.
 */

const runner = require('../scripts/bot-fixtures/runXaiAdversarialBotCorpus');
const sceneBuilder = require('../scripts/bot-fixtures/xaiAdversarialSceneBuilder');
const planner = require('../scripts/bot-fixtures/corpusPoolDrivenPlanner');
const { VOICES } = require('../scripts/bot-fixtures/corpusPoolDrivenPlannerConstants');

type Event = Record<string, unknown>;

function makeStubbedSeed(): Record<string, unknown> {
  function mkOption(bankName: string, idx: number) {
    return {
      optionId: `opt-${bankName.slice(0, 3)}-${idx}`,
      bankName,
      skeleton: {
        targetExcerpt: `te ${idx}`,
        spineHint: 'mechanism-led',
        axisHint: 'evidence',
        summary: `demand primary source mechanism token ${idx}`,
        evidenceDebt: ['primary source'],
        antiAmplificationNote: 'popularity not evidence',
      },
    };
  }
  return {
    seedId: 'seed-voice',
    sourceHash: 'src-voice',
    claimSummary: 'A claim',
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
  };
}

function makeLiveCtx() {
  function makeBotClient() {
    return {
      from() {
        return {
          insert() {
            return {
              select() { return { single: async () => ({ data: { id: 'd-1' }, error: null }) }; },
              error: null,
            };
          },
          select() {
            return { eq() { return { single: async () => ({ data: { id: 'c-1' }, error: null }) }; } };
          },
        };
      },
      functions: { invoke: async () => ({ data: { argument: { id: 'arg-1' } }, error: null }) },
    };
  }
  return {
    adminClient: makeBotClient(),
    botByAlias: {
      'bot-a': { userId: 'user-a', client: makeBotClient(), label: 'A' },
      'bot-b': { userId: 'user-b', client: makeBotClient(), label: 'B' },
      'bot-c': { userId: 'user-c', client: makeBotClient(), label: 'C' },
    },
    anthropic: {
      generate: async () => ({ text: JSON.stringify({ body: '"target" — counterexample press primary source mechanism token; receipt.', disagreementAxis: 'evidence', mechanism: 'm' }) }),
      snapshotUsage: () => ({ inputTokens: 0, outputTokens: 0 }),
    },
  };
}

function makeJsonlCapture() {
  const events: Event[] = [];
  return {
    write(stage: string, extras: Record<string, unknown> = {}) { events.push({ stage, ...extras }); },
    events,
  };
}

describe('CORPUS-30 live-path voice-stamp', () => {
  it('emits bot_assignment with resolved voiceId per bot (not only inside voiceIdByAlias)', async () => {
    const runId = '2026-06-03T17-03-00-000Z-aaaaaaa1';
    const runTag = planner.buildRunTag(runId, 'corpus-dev-synthetic');
    const seed = makeStubbedSeed();
    const used = new Map<string, Set<number>>();
    const banks = seed.banks as Record<string, Array<Record<string, unknown>>>;
    const m1 = planner.selectOption({ runId, threadIndex: 0, role: 'provocateur', moveIndex: 1, bankName: 'opening_claim_options', bank: banks.opening_claim_options, usedOptionsForThread: used });
    const m2 = planner.selectOption({ runId, threadIndex: 0, role: 'revocateur', moveIndex: 2, bankName: 'objection_options', bank: banks.objection_options, usedOptionsForThread: used });
    const voiceIdByAlias: Record<string, string> = {
      'bot-a': planner.assignVoiceId(runId, 'user-a'),
      'bot-b': planner.assignVoiceId(runId, 'user-b'),
      'bot-c': planner.assignVoiceId(runId, 'user-c'),
    };
    const scene = sceneBuilder.buildBankedAdversarialScene({
      seed, m1Selection: m1, m2Selection: m2,
      botPool: [
        { alias: 'bot-a', label: 'A', email: '' },
        { alias: 'bot-b', label: 'B', email: '' },
        { alias: 'bot-c', label: 'C', email: '' },
      ],
      opts: { seed: 'x', runId, runTag, threadIndex: 0, voiceIdByAlias },
    });
    scene.personas = scene.personas.map((p: Record<string, unknown>) => ({ ...p, skillHash: 'p'.repeat(16) }));

    const jsonl = makeJsonlCapture();
    const liveCtx = makeLiveCtx();
    const liveCallCounters = { xaiCalls: 0, anthropicCalls: 0, supabaseWrites: 0 };
    await runner.postLiveBankedScenario({
      args: { dry: false, maxDepth: 4 },
      jsonl, scenario: { scene, source: { sourceHash: seed.sourceHash, sourceClaimSummary: seed.claimSummary, sourceTextRedacted: seed.claimSummary }, dissent: { replyHash: 'r', replyTextRedacted: 'd' }, dissentSource: 'banked_pool', seed, threadIndex: 0, usedOptionsForThread: used, runTag },
      bundle: { provocateurText: 'p', revocateurText: 'r', provocateurHash: 'p-hash', revocateurHash: 'r-hash' },
      liveCtx, runId, runTag, liveCallCounters,
    });

    const botAssignments = jsonl.events.filter((e) => e.stage === 'bot_assignment');
    expect(botAssignments.length).toBe(1);
    const ba = botAssignments[0] as Record<string, unknown>;
    expect(Array.isArray(ba.assignments)).toBe(true);
    const assignments = ba.assignments as Array<Record<string, unknown>>;
    expect(assignments.length).toBe(3);
    for (const a of assignments) {
      expect(typeof a.voiceId).toBe('string');
      expect((a.voiceId as string).length).toBeGreaterThan(0);
      expect(VOICES).toContain(a.voiceId);
    }
    // voiceIdByAlias map is also present for backward compatibility.
    expect(ba.voiceIdByAlias).toBeTruthy();
  });

  it('every move_validated event carries the resolved per-bot voiceId from VOICES', async () => {
    const runId = '2026-06-03T17-04-00-000Z-aaaaaaa2';
    const runTag = planner.buildRunTag(runId, 'corpus-dev-synthetic');
    const seed = makeStubbedSeed();
    const used = new Map<string, Set<number>>();
    const banks = seed.banks as Record<string, Array<Record<string, unknown>>>;
    const m1 = planner.selectOption({ runId, threadIndex: 0, role: 'provocateur', moveIndex: 1, bankName: 'opening_claim_options', bank: banks.opening_claim_options, usedOptionsForThread: used });
    const m2 = planner.selectOption({ runId, threadIndex: 0, role: 'revocateur', moveIndex: 2, bankName: 'objection_options', bank: banks.objection_options, usedOptionsForThread: used });
    const voiceIdByAlias: Record<string, string> = {
      'bot-a': planner.assignVoiceId(runId, 'user-a'),
      'bot-b': planner.assignVoiceId(runId, 'user-b'),
      'bot-c': planner.assignVoiceId(runId, 'user-c'),
    };
    const scene = sceneBuilder.buildBankedAdversarialScene({
      seed, m1Selection: m1, m2Selection: m2,
      botPool: [
        { alias: 'bot-a', label: 'A', email: '' },
        { alias: 'bot-b', label: 'B', email: '' },
        { alias: 'bot-c', label: 'C', email: '' },
      ],
      opts: { seed: 'x', runId, runTag, threadIndex: 0, voiceIdByAlias },
    });
    scene.personas = scene.personas.map((p: Record<string, unknown>) => ({ ...p, skillHash: 'p'.repeat(16) }));

    const jsonl = makeJsonlCapture();
    const liveCtx = makeLiveCtx();
    const liveCallCounters = { xaiCalls: 0, anthropicCalls: 0, supabaseWrites: 0 };
    await runner.postLiveBankedScenario({
      args: { dry: false, maxDepth: 4 },
      jsonl, scenario: { scene, source: { sourceHash: seed.sourceHash, sourceClaimSummary: seed.claimSummary, sourceTextRedacted: seed.claimSummary }, dissent: { replyHash: 'r', replyTextRedacted: 'd' }, dissentSource: 'banked_pool', seed, threadIndex: 0, usedOptionsForThread: used, runTag },
      bundle: { provocateurText: 'p', revocateurText: 'r', provocateurHash: 'p-hash', revocateurHash: 'r-hash' },
      liveCtx, runId, runTag, liveCallCounters,
    });

    const mvs = jsonl.events.filter((e) => e.stage === 'move_validated');
    expect(mvs.length).toBeGreaterThan(0);
    for (const ev of mvs) {
      expect(VOICES).toContain(ev.voiceId);
    }
  });
});
