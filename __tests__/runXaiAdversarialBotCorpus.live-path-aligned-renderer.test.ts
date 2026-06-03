/**
 * CORPUS-30-LIVE-PATH-WIRING — Fix 1, Test 3.
 *
 * Asserts live-mode calls `renderAlignedAdversarialMove` with the
 * binding props (selectedOption, voiceId, spineId, attribution) — NOT
 * the legacy free-form `renderAdversarialMove` path. Verifies the call
 * signature by intercepting the renderer's `client.generate` and
 * checking the user payload contains the SELECTED_OPTION binding block.
 *
 * Also confirms existing fallback behavior is preserved: when the
 * Anthropic client errors, the renderer falls back to the deterministic
 * skeleton fill (not to a hard failure).
 */

const runner = require('../scripts/bot-fixtures/runXaiAdversarialBotCorpus');
const sceneBuilder = require('../scripts/bot-fixtures/xaiAdversarialSceneBuilder');
const planner = require('../scripts/bot-fixtures/corpusPoolDrivenPlanner');

type Event = Record<string, unknown>;

function makeSeed(): Record<string, unknown> {
  function mkOption(bankName: string, idx: number) {
    return {
      optionId: `opt-${bankName.slice(0, 3)}-${idx}`,
      bankName,
      skeleton: {
        targetExcerpt: `target excerpt token ${idx}`,
        spineHint: 'mechanism-led',
        axisHint: 'evidence',
        summary: `demand primary source mechanism mode shift parallel arterial token ${idx}`,
        evidenceDebt: ['primary source for the mode-shift number'],
        antiAmplificationNote: 'viral civic infographics are not primary records',
      },
    };
  }
  return {
    seedId: 'seed-renderer',
    sourceHash: 'src-renderer',
    claimSummary: 'A claim text',
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

function makeScene(runId: string, runTag: string, threadIndex: number) {
  const seed = makeSeed();
  const used = new Map<string, Set<number>>();
  const banks = seed.banks as Record<string, Array<Record<string, unknown>>>;
  const m1 = planner.selectOption({ runId, threadIndex, role: 'provocateur', moveIndex: 1, bankName: 'opening_claim_options', bank: banks.opening_claim_options, usedOptionsForThread: used });
  const m2 = planner.selectOption({ runId, threadIndex, role: 'revocateur', moveIndex: 2, bankName: 'objection_options', bank: banks.objection_options, usedOptionsForThread: used });
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
    opts: { seed: 'x', runId, runTag, threadIndex, voiceIdByAlias },
  });
  scene.personas = scene.personas.map((p: Record<string, unknown>) => ({ ...p, skillHash: 'p'.repeat(16) }));
  return { scene, used, seed };
}

function spineOpeningForId(spineId: string, target: string): string {
  // Mirrors renderer.SPINE_OPENING_PATTERNS — produce a body opening
  // that matches the assigned spine's regex.
  switch (spineId) {
    case 'quote-led': return `"${target.slice(0, 60)}".`;
    case 'counterexample-led': return 'Counterexample worth pressing on:';
    case 'definition-led': return 'Define the key term first:';
    case 'mechanism-led': return 'Press on the mechanism:';
    case 'scope-led': return 'Narrow the scope:';
    case 'concession-then-pivot': return 'Fair point on the narrow case — pivoting now:';
    case 'question-led': return 'What exactly is the receipt here?';
    case 'analogy-led': return 'Like the comparable case:';
    case 'second-order-effect-led': return 'The second-order effect to settle:';
    default: return 'Press on the mechanism:';
  }
}

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
        select() { return { eq() { return { single: async () => ({ data: { id: 'c-1' }, error: null }) }; } }; },
      };
    },
    functions: { invoke: async () => ({ data: { argument: { id: 'arg-1' } }, error: null }) },
  };
}

describe('CORPUS-30 live-path aligned renderer', () => {
  it('passes a SELECTED_OPTION binding block + voiceId + spineId to the Anthropic client', async () => {
    const runId = '2026-06-03T17-05-00-000Z-bbbb0001';
    const runTag = planner.buildRunTag(runId, 'corpus-dev-synthetic');
    const { scene, used, seed } = makeScene(runId, runTag, 0);

    // Spy on client.generate to capture every payload + echo back a body
    // that aligns to the SELECTED_OPTION's summary + target excerpt AND
    // matches the spineId pattern Anthropic was told to foreground. The
    // spineId is determined by assignSpineId per move (not by the option's
    // spineHint), so we have to read it from the binding block.
    const capturedPayloads: string[] = [];
    const anthropic = {
      generate: async (opts: Record<string, unknown>) => {
        const userPayload = String(opts.userPayload || '');
        capturedPayloads.push(userPayload);
        // Match against the SELECTED_OPTION block specifically — there's
        // a "Source claim summary:" line earlier that we must not grab.
        const summaryMatch = userPayload.match(/SELECTED_OPTION[\s\S]+?summary:\s+([^\n]+)/);
        const targetMatch = userPayload.match(/SELECTED_OPTION[\s\S]+?targetExcerpt:\s+"([^"]+)"/);
        const spineMatch = userPayload.match(/Spine to foreground:\s+([\w-]+)/);
        const summary = summaryMatch ? summaryMatch[1].trim() : 'primary source mechanism';
        const target = targetMatch ? targetMatch[1].trim() : '';
        const spineId = spineMatch ? spineMatch[1].trim() : 'mechanism-led';
        const opening = spineOpeningForId(spineId, target);
        // Include the target excerpt verbatim so missing_target_excerpt
        // doesn't fire. For quote-led openings the target is already in
        // the opening; for others we append.
        const includesTarget = opening.toLowerCase().includes(target.toLowerCase());
        const targetTail = (target && !includesTarget) ? ` "${target}".` : '';
        const body = `${opening} ${summary}.${targetTail} Demand the receipt.`;
        return {
          text: JSON.stringify({ body, disagreementAxis: 'evidence', mechanism: 'm' }),
        };
      },
      snapshotUsage: () => ({ inputTokens: 0, outputTokens: 0 }),
    };
    const liveCtx = {
      adminClient: makeBotClient(),
      botByAlias: {
        'bot-a': { userId: 'user-a', client: makeBotClient(), label: 'A' },
        'bot-b': { userId: 'user-b', client: makeBotClient(), label: 'B' },
        'bot-c': { userId: 'user-c', client: makeBotClient(), label: 'C' },
      },
      anthropic,
    };
    const jsonl: { events: Event[]; write: (s: string, e?: Record<string, unknown>) => void } = {
      events: [],
      write(stage, extras = {}) { this.events.push({ stage, ...extras }); },
    };
    const liveCallCounters = { xaiCalls: 0, anthropicCalls: 0, supabaseWrites: 0 };

    await runner.postLiveBankedScenario({
      args: { dry: false, maxDepth: 4 },
      jsonl, scenario: { scene, source: { sourceHash: seed.sourceHash, sourceClaimSummary: seed.claimSummary, sourceTextRedacted: seed.claimSummary }, dissent: { replyHash: 'r', replyTextRedacted: 'd' }, dissentSource: 'banked_pool', seed, threadIndex: 0, usedOptionsForThread: used, runTag },
      bundle: { provocateurText: 'p', revocateurText: 'r', provocateurHash: 'p-hash', revocateurHash: 'r-hash' },
      liveCtx, runId, runTag, liveCallCounters,
    });

    // M3 + M4 each call the renderer; M1+M2 are seeded.
    expect(capturedPayloads.length).toBeGreaterThanOrEqual(2);
    // Every captured payload must include the SELECTED_OPTION binding
    // block — that's how renderAlignedAdversarialMove signals the
    // option-bound rendering shape to Anthropic.
    for (const p of capturedPayloads) {
      expect(p).toContain('SELECTED_OPTION');
      expect(p).toMatch(/Assigned voice:\s+\w+/);
      expect(p).toMatch(/Spine to foreground:\s+[\w-]+/);
    }
    // M3 attributed source MUST be 'anthropic' (not deterministic_fallback).
    const m3Validated = jsonl.events.find((e) => e.stage === 'move_validated' && e.moveIndex === 3) as Record<string, unknown>;
    expect(m3Validated).toBeTruthy();
    expect(m3Validated.source).toBe('anthropic');
  });

  it('preserves fallback behavior — when Anthropic throws, falls back to deterministic_fallback', async () => {
    const runId = '2026-06-03T17-06-00-000Z-bbbb0002';
    const runTag = planner.buildRunTag(runId, 'corpus-dev-synthetic');
    const { scene, used, seed } = makeScene(runId, runTag, 0);
    const anthropic = {
      generate: async () => { throw new Error('synthetic network failure'); },
      snapshotUsage: () => ({ inputTokens: 0, outputTokens: 0 }),
    };
    const liveCtx = {
      adminClient: makeBotClient(),
      botByAlias: {
        'bot-a': { userId: 'user-a', client: makeBotClient(), label: 'A' },
        'bot-b': { userId: 'user-b', client: makeBotClient(), label: 'B' },
        'bot-c': { userId: 'user-c', client: makeBotClient(), label: 'C' },
      },
      anthropic,
    };
    const jsonl: { events: Event[]; write: (s: string, e?: Record<string, unknown>) => void } = {
      events: [],
      write(stage, extras = {}) { this.events.push({ stage, ...extras }); },
    };
    const liveCallCounters = { xaiCalls: 0, anthropicCalls: 0, supabaseWrites: 0 };
    await runner.postLiveBankedScenario({
      args: { dry: false, maxDepth: 4 },
      jsonl, scenario: { scene, source: { sourceHash: seed.sourceHash, sourceClaimSummary: seed.claimSummary, sourceTextRedacted: seed.claimSummary }, dissent: { replyHash: 'r', replyTextRedacted: 'd' }, dissentSource: 'banked_pool', seed, threadIndex: 0, usedOptionsForThread: used, runTag },
      bundle: { provocateurText: 'p', revocateurText: 'r', provocateurHash: 'p-hash', revocateurHash: 'r-hash' },
      liveCtx, runId, runTag, liveCallCounters,
    });
    const m3Validated = jsonl.events.find((e) => e.stage === 'move_validated' && e.moveIndex === 3) as Record<string, unknown>;
    expect(m3Validated).toBeTruthy();
    expect(m3Validated.source).toBe('deterministic_fallback');
    // Attribution is still complete on the fallback path.
    expect(m3Validated.bankName).toBeTruthy();
    expect(m3Validated.spineId).toBeTruthy();
    expect(m3Validated.voiceId).toBeTruthy();
    expect(m3Validated.optionId).toBeTruthy();
  });

  it('preserves Anthropic-call counter (only counts source==="anthropic")', async () => {
    const runId = '2026-06-03T17-07-00-000Z-bbbb0003';
    const runTag = planner.buildRunTag(runId, 'corpus-dev-synthetic');
    const { scene, used, seed } = makeScene(runId, runTag, 0);
    const anthropic = {
      generate: async (opts: Record<string, unknown>) => {
        const userPayload = String(opts.userPayload || '');
        // Match against the SELECTED_OPTION block specifically — there's
        // a "Source claim summary:" line earlier that we must not grab.
        const summaryMatch = userPayload.match(/SELECTED_OPTION[\s\S]+?summary:\s+([^\n]+)/);
        const targetMatch = userPayload.match(/SELECTED_OPTION[\s\S]+?targetExcerpt:\s+"([^"]+)"/);
        const spineMatch = userPayload.match(/Spine to foreground:\s+([\w-]+)/);
        const summary = summaryMatch ? summaryMatch[1].trim() : 'primary source mechanism';
        const target = targetMatch ? targetMatch[1].trim() : '';
        const spineId = spineMatch ? spineMatch[1].trim() : 'mechanism-led';
        const opening = spineOpeningForId(spineId, target);
        const includesTarget = opening.toLowerCase().includes(target.toLowerCase());
        const targetTail = (target && !includesTarget) ? ` "${target}".` : '';
        return {
          text: JSON.stringify({
            body: `${opening} ${summary}.${targetTail} Demand the receipt.`,
            disagreementAxis: 'evidence',
            mechanism: 'm',
          }),
        };
      },
      snapshotUsage: () => ({ inputTokens: 0, outputTokens: 0 }),
    };
    const liveCtx = {
      adminClient: makeBotClient(),
      botByAlias: {
        'bot-a': { userId: 'user-a', client: makeBotClient(), label: 'A' },
        'bot-b': { userId: 'user-b', client: makeBotClient(), label: 'B' },
        'bot-c': { userId: 'user-c', client: makeBotClient(), label: 'C' },
      },
      anthropic,
    };
    const jsonl: { events: Event[]; write: (s: string, e?: Record<string, unknown>) => void } = {
      events: [],
      write(stage, extras = {}) { this.events.push({ stage, ...extras }); },
    };
    const liveCallCounters = { xaiCalls: 0, anthropicCalls: 0, supabaseWrites: 0 };
    await runner.postLiveBankedScenario({
      args: { dry: false, maxDepth: 4 },
      jsonl, scenario: { scene, source: { sourceHash: seed.sourceHash, sourceClaimSummary: seed.claimSummary, sourceTextRedacted: seed.claimSummary }, dissent: { replyHash: 'r', replyTextRedacted: 'd' }, dissentSource: 'banked_pool', seed, threadIndex: 0, usedOptionsForThread: used, runTag },
      bundle: { provocateurText: 'p', revocateurText: 'r', provocateurHash: 'p-hash', revocateurHash: 'r-hash' },
      liveCtx, runId, runTag, liveCallCounters,
    });
    // M3 + M4 → 2 Anthropic calls.
    expect(liveCallCounters.anthropicCalls).toBeGreaterThanOrEqual(2);
    // Supabase writes ≥ M1+M2+M3+M4 = 4 + debate + 3 participants = 8.
    expect(liveCallCounters.supabaseWrites).toBeGreaterThanOrEqual(4);
  });
});
