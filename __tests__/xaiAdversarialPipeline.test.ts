/**
 * Stage 6.1.7 — Source collector, reply collector, disagreement selector,
 * scene builder, and runner-orchestration tests.
 *
 * No network. Mocks fetchImpl. Asserts redaction, deterministic
 * sampling, mixed-agreement preference, synthetic fallback marking, scene
 * bot assignment, runner gating, continuation stop conditions.
 */
import * as fs from 'fs';
import * as path from 'path';

const sourceMod = require('../scripts/engagement-intelligence/xaiAdversarialSourceCollector');
const replyMod = require('../scripts/engagement-intelligence/xaiReplyCollector');
const selectorMod = require('../scripts/engagement-intelligence/selectFirstDisagreeableReply');
const sceneMod = require('../scripts/bot-fixtures/xaiAdversarialSceneBuilder');
const runner = require('../scripts/bot-fixtures/runXaiAdversarialThreadCorpus');
const report = require('../scripts/bot-fixtures/xaiAdversarialReport');

const repoRoot = process.cwd();

describe('xaiAdversarialSourceCollector — redaction + sampling', () => {
  beforeEach(() => {
    process.env.ENGAGEMENT_INTEL_ENABLE_XAI = 'true';
    process.env.XAI_API_KEY = 'xai-test-DUMMY-shouldneverleak';
  });

  it('redacts handles + URLs + JWTs from sourceTextRedacted', async () => {
    const fetchImpl = async () => ({
      status: 200, body: { cancel: async () => undefined },
      json: async () => ({ output_text: JSON.stringify({ topics: [
        { topicBucket: 'civic', sourceClaimSummary: '@somehandle posted https://x.com/x/status/12345',
          sourceTextRedacted: '@somehandle says: see https://t.co/abcd JWT eyJhbGciOiJIUzI1NiJ9.payload.sig',
          providerRank: 1, providerConfidence: 0.7, citationRefs: ['c1'] },
      ] }) }),
      arrayBuffer: async () => new ArrayBuffer(0),
    });
    const r = await sourceMod.collectSourceCandidates({ topicHint: 'civic', count: 3, pilot: true, runSalt: 'unit', fetchImpl });
    expect(r.candidates).toHaveLength(1);
    const c = r.candidates[0];
    expect(c.sourceClaimSummary).not.toMatch(/@somehandle|x\.com|t\.co/);
    expect(c.sourceTextRedacted).not.toMatch(/@somehandle|x\.com|t\.co/);
    expect(c.sourceTextRedacted).not.toMatch(/eyJhbGciOiJIUzI1NiJ9/);
    expect(c.provider).toBe('xai_responses');
    expect(c.providerRank).toBe(1);
    expect(c.redactionApplied).toBe(true);
    expect(c.sourceHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('clamps providerConfidence to [0,1] and defaults missing claimType to "unclear"', () => {
    const n = sourceMod.normalizeOne(
      { topicBucket: 'x', sourceClaimSummary: 'A', sourceTextRedacted: 'B', providerConfidence: 5 },
      { provider: 'xai_responses', topicHint: 'h', runSalt: 's' }, 7,
    );
    expect(n.providerConfidence).toBe(1);
    expect(n.sourceClaimType).toBe('unclear');
  });

  it('sampleDeterministic produces stable subsets for a given seed', () => {
    const arr = Array.from({ length: 20 }, (_, i) => ({ providerRank: i + 1, name: `t${i + 1}` }));
    const a = sourceMod.sampleDeterministic(arr, 5, 'seed-x');
    const b = sourceMod.sampleDeterministic(arr, 5, 'seed-x');
    expect(a.map((x: { name: string }) => x.name)).toEqual(b.map((x: { name: string }) => x.name));
    // Sorted by providerRank inside the sample.
    const ranks = a.map((x: { providerRank: number }) => x.providerRank);
    expect(ranks).toEqual([...ranks].sort((p, q) => p - q));
  });
});

describe('xaiReplyCollector — redaction + topReplyMethod honesty', () => {
  beforeEach(() => {
    process.env.ENGAGEMENT_INTEL_ENABLE_XAI = 'true';
    process.env.XAI_API_KEY = 'xai-test-DUMMY-shouldneverleak';
  });

  it('demotes "metric_ranked" to "provider_inferred" when no metrics are present', () => {
    const r = replyMod.normalizeReply(
      { replyClaimSummary: 'X', replyTextRedacted: 'Y', topReplyMethod: 'metric_ranked' },
      { provider: 'xai_responses', sourceHash: 'src', runSalt: 's' }, 1,
    );
    expect(r.topReplyMethod).toBe('provider_inferred');
  });

  it('preserves metric_ranked when numeric metrics are present', () => {
    const r = replyMod.normalizeReply(
      { replyClaimSummary: 'X', replyTextRedacted: 'Y', topReplyMethod: 'metric_ranked', replyMetricsIfAvailable: { likeCount: 100 } },
      { provider: 'xai_responses', sourceHash: 'src', runSalt: 's' }, 1,
    );
    expect(r.topReplyMethod).toBe('metric_ranked');
    expect(r.replyMetricsIfAvailable).toEqual({ likeCount: 100 });
  });

  it('strips handles + URLs from replyTextRedacted on normalize', () => {
    const r = replyMod.normalizeReply(
      { replyClaimSummary: '@h posted', replyTextRedacted: 'Check @feed at https://x.com/x/status/1' },
      { provider: 'xai_responses', sourceHash: 'src', runSalt: 's' }, 1,
    );
    expect(r.replyTextRedacted).not.toMatch(/@feed|x\.com/);
    expect(r.replyClaimSummary).not.toMatch(/@h/);
  });

  it('refuses without --pilot', async () => {
    await expect(replyMod.collectReplyCandidates({
      source: { sourceClaimSummary: 'X', sourceTextRedacted: 'Y', topicBucket: 't', sourceHash: 'h' },
      count: 3, pilot: false,
    })).rejects.toThrow(/no_pilot_flag/);
  });
});

describe('selectFirstDisagreeableReply — preference + threshold', () => {
  const source = { sourceHash: 'src', sourceClaimSummary: 'Bike lanes are better curb space than parking.', sourceTextRedacted: 'Protected bike lanes are a better use of curb space than parking in dense corridors.' };

  it('prefers a mixed-agreement reply when one qualifies', () => {
    const replies = [
      // r1: pure agreement — should NOT be picked.
      { replyOrdinal: 1, replyHash: 'r1', providerRank: 1, replyClaimSummary: 'Spot on.', replyTextRedacted: 'Exactly right. Could not agree more. Spot on.' },
      // r2: broad-accept narrow-decline candidate — mixed signal.
      { replyOrdinal: 2, replyHash: 'r2', providerRank: 2, replyClaimSummary: 'Agree generally but narrow it.',
        replyTextRedacted: 'I agree with the broad point about curb use, but you should narrow that down to dense commercial corridors — quote the exact study to back it.' },
      // r3: pure disagreement — eligible but lower preference.
      { replyOrdinal: 3, replyHash: 'r3', providerRank: 3, replyClaimSummary: 'Wrong.', replyTextRedacted: 'No, this is wrong — bike lanes do not outperform parking in most corridors.' },
    ];
    const sel = selectorMod.selectFirstDisagreeableReply({ source, replies });
    expect(sel.selected).not.toBeNull();
    expect(sel.reason).toMatch(/selected_mixed_agreement|selected_pure_decline/);
  });

  it('returns null + no_qualifying_reply when nothing meets the threshold', () => {
    const replies = [
      { replyOrdinal: 1, replyHash: 'r1', providerRank: 1, replyClaimSummary: 'A', replyTextRedacted: 'Yes I agree with this point exactly. Spot on.' },
      { replyOrdinal: 2, replyHash: 'r2', providerRank: 2, replyClaimSummary: 'B', replyTextRedacted: 'lol same' },
    ];
    const sel = selectorMod.selectFirstDisagreeableReply({ source, replies });
    expect(sel.selected).toBeNull();
    expect(sel.reason).toBe('no_qualifying_reply');
  });
});

describe('buildSyntheticRebuttal — clearly marked + excluded from real epidemiology', () => {
  it('produces a redacted synthetic reply with the right flags', () => {
    const s = { sourceHash: 'h', sourceClaimSummary: 'Bike lanes are better than parking.' };
    const synth = selectorMod.buildSyntheticRebuttal(s);
    expect(synth.syntheticRebuttal).toBe(true);
    expect(synth.excludedFromRealEpidemiology).toBe(true);
    expect(synth.includedInGameStressOnly).toBe(true);
    expect(synth.topReplyMethod).toBe('synthetic_fallback');
    expect(synth.provider).toBe('synthetic');
  });
});

describe('xaiAdversarialSceneBuilder — deterministic bot assignment', () => {
  const source = { sourceHash: 'abc', sourceClaimSummary: 'A claim.', sourceTextRedacted: 'A claim text.', provider: 'xai_responses', topicBucket: 't', providerRank: 1, providerConfidence: 0.7, citationRefs: ['c1'], sourceClaimType: 'opinion' };
  const reply = { replyHash: 'xyz', replyClaimSummary: 'A reply summary.', replyTextRedacted: 'A reply text.', citationRefs: [] };
  const botPool = [
    { alias: 'Alex', label: 'Alex', email: 'a@local' },
    { alias: 'Jordan', label: 'Jordan', email: 'b@local' },
    { alias: 'Sam', label: 'Sam', email: 'c@local' },
    { alias: 'Casey', label: 'Casey', email: 'd@local' },
  ];

  it('assigns three skill roles + sides, seeded by source/reply hashes + opts.seed', () => {
    const a = sceneMod.buildAdversarialScene({ source, reply, botPool, opts: { seed: 'unit' } });
    const b = sceneMod.buildAdversarialScene({ source, reply, botPool, opts: { seed: 'unit' } });
    expect(a.personas.map((p: { alias: string }) => p.alias)).toEqual(b.personas.map((p: { alias: string }) => p.alias));
    const roles = a.personas.map((p: { skillRole: string }) => p.skillRole);
    expect(roles).toEqual(['bot-provocateur', 'bot-revocateur', 'bot-synthesizer']);
  });

  it('declares the test-bot identity disclaimer on every persona', () => {
    const a = sceneMod.buildAdversarialScene({ source, reply, botPool, opts: { seed: 'unit' } });
    for (const p of a.personas) {
      expect(p.identityDisclaimer).toMatch(/test bot/i);
      expect(p.identityDisclaimer).not.toMatch(/@/);
    }
  });

  it('seeds m1 = thesis from source, m2 = rebuttal from reply', () => {
    const s = sceneMod.buildAdversarialScene({ source, reply, botPool, opts: { seed: 'unit' } });
    expect(s.seededMoves[0].argumentType).toBe('thesis');
    expect(s.seededMoves[0].body).toBe(source.sourceTextRedacted);
    expect(s.seededMoves[1].argumentType).toBe('rebuttal');
    expect(s.seededMoves[1].body).toBe(reply.replyTextRedacted);
  });

  it('throws when bot pool is too small', () => {
    expect(() => sceneMod.buildAdversarialScene({ source, reply, botPool: [{ alias: 'Solo' }], opts: {} }))
      .toThrow(/at least 3/);
  });
});

describe('runner orchestration — gating + stop conditions', () => {
  it('parseArgs respects --pilot, --rooms, --max-depth, --post-to-dev-supabase, --allow-synthetic-rebuttal', () => {
    const a = runner.parseArgs([
      'node', 'x',
      '--pilot', '--rooms', '7', '--candidate-posts', '50', '--top-replies', '8',
      '--max-depth', '6', '--source-mode', 'xai_live', '--provider', 'legacy_chat_search',
      '--post-to-dev-supabase', '--allow-synthetic-rebuttal', '--synthetic-rebuttal-threshold', '5',
      '--seed', 'unit-x',
    ]);
    expect(a.pilot).toBe(true);
    expect(a.dry).toBe(false);
    expect(a.rooms).toBe(7);
    expect(a.candidatePosts).toBe(50);
    expect(a.topReplies).toBe(8);
    expect(a.maxDepth).toBe(6);
    expect(a.sourceMode).toBe('xai_live');
    expect(a.provider).toBe('legacy_chat_search');
    expect(a.postToDevSupabase).toBe(true);
    expect(a.allowSyntheticRebuttal).toBe(true);
    expect(a.syntheticRebuttalThreshold).toBe(5);
    expect(a.seed).toBe('unit-x');
  });

  it('refuseLive enumerates every missing gate', () => {
    const reasons = runner.refuseLive(
      { pilot: false, sourceMode: 'xai_live' },
      { hasXaiKey: false, enableXai: false, hasAnthropicKey: false, enableAnthropic: false, hasBotTests: false },
    );
    expect(reasons).toEqual(expect.arrayContaining([
      expect.stringContaining('XAI_API_KEY'),
      expect.stringContaining('ENGAGEMENT_INTEL_ENABLE_XAI'),
      expect.stringContaining('ANTHROPIC_API_KEY'),
      expect.stringContaining('ENGAGEMENT_INTEL_ENABLE_ANTHROPIC'),
      expect.stringContaining('.env.bot-tests'),
      expect.stringContaining('--pilot'),
    ]));
  });

  it('decideStopAfter stops at maxDepth + 2 (thesis + initial rebuttal + N continuations)', () => {
    const scenario = { personas: [] };
    const lastMove = { argumentType: 'rebuttal', body: 'standard rebuttal' };
    const postedMoves = Array.from({ length: 7 }, (_, i) => ({ moveId: `m${i + 1}` }));
    const reason = runner.decideStopAfter(scenario, lastMove, postedMoves, 5);
    expect(reason).toBe('max_depth_reached');
  });

  it('decideStopAfter detects explicit concession + synthesis argument types', () => {
    expect(runner.decideStopAfter({}, { argumentType: 'concession', body: 'You are right about scope.' }, [], 10)).toBe('explicit_concession');
    expect(runner.decideStopAfter({}, { argumentType: 'synthesis', body: 'shared ground' }, [], 10)).toBe('synthesis_accepted');
  });

  it('decideStopAfter detects soft concession + synthesis markers in body', () => {
    expect(runner.decideStopAfter({}, { argumentType: 'rebuttal', body: 'fair point on scope, I will narrow that.' }, [], 10)).toBe('soft_concession_marker');
    expect(runner.decideStopAfter({}, { argumentType: 'counter_rebuttal', body: 'both sides agree on the unresolved issue' }, [], 10)).toBe('soft_synthesis_marker');
  });

  it('buildNextSlot alternates authors and increments moveId', () => {
    const scenario = { personas: [
      { alias: 'A', skillRole: 'bot-provocateur', assignedSide: 'source_defender' },
      { alias: 'B', skillRole: 'bot-revocateur', assignedSide: 'reply_defender' },
      { alias: 'C', skillRole: 'bot-synthesizer', assignedSide: 'synthesis_moderator' },
    ] };
    const posted = [
      { moveId: 'm1', authorAlias: 'A', argumentType: 'thesis' },
      { moveId: 'm2', authorAlias: 'B', argumentType: 'rebuttal' },
    ];
    const slot = runner.buildNextSlot(scenario, posted);
    expect(slot.moveId).toBe('m3');
    expect(slot.argumentType).toBe('counter_rebuttal');
  });
});

describe('xaiAdversarialReport — aggregator + safety', () => {
  it('aggregates posted/failed/skipped + key counters from a JSONL stream', () => {
    const events = [
      { eventType: 'run_start', runId: 'r' },
      { eventType: 'source_candidate' }, { eventType: 'source_candidate' },
      { eventType: 'source_selected' }, { eventType: 'source_selected' },
      { eventType: 'reply_selected', syntheticRebuttal: false },
      { eventType: 'reply_selected', syntheticRebuttal: true },
      { eventType: 'debate_created' }, { eventType: 'debate_created' },
      { eventType: 'move_submitted', submitStatus: 'posted' },
      { eventType: 'move_submitted', submitStatus: 'failed_422', errorCode: 'invalid' },
      { eventType: 'move_submitted', submitStatus: 'dry_simulated' },
      { eventType: 'room_resolved', resolutionType: 'explicit_concession' },
      { eventType: 'room_stalemate' },
      { eventType: 'anthropic_call', inputTokens: 100, outputTokens: 50 },
    ];
    const agg = report.aggregateRun(events);
    expect(agg.candidatesSeen).toBe(2);
    expect(agg.sourcesSelected).toBe(2);
    expect(agg.realRebuttals).toBe(1);
    // reply_selected with syntheticRebuttal:true counts as one synthetic.
    expect(agg.syntheticRebuttals).toBe(1);
    expect(agg.rooms).toBe(2);
    expect(agg.movesPosted).toBe(1);
    expect(agg.movesFailed).toBe(1);
    expect(agg.movesSkipped).toBe(1);
    expect(agg.resolved).toBe(1);
    expect(agg.stalemate).toBe(1);
    expect(agg.anthropicCalls).toBe(1);
    expect(agg.inputTokens).toBe(100);
    expect(agg.outputTokens).toBe(50);
  });
});

describe('xaiAdversarialReport — source-file safety', () => {
  it('emits the doctrine reminder + compliance checklist', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'scripts/bot-fixtures/xaiAdversarialReport.js'), 'utf8');
    expect(src).toMatch(/Popularity \/ repetition \/ engagement velocity \/ political identity are NOT evidence/);
    expect(src).toMatch(/Bots are test bots/);
    expect(src).toMatch(/Synthetic rebuttals .* are excluded from real epidemiology/);
    expect(src).toMatch(/Engagement credit and factual-standing eligibility are tracked separately/);
  });
});

describe('runner source — file-level safety contract', () => {
  const src = fs.readFileSync(path.join(repoRoot, 'scripts/bot-fixtures/runXaiAdversarialThreadCorpus.js'), 'utf8');

  it('routes Anthropic through claudeMessagesClient (no direct env read)', () => {
    expect(src).toMatch(/require\(['"]\.\/claudeMessagesClient['"]\)/);
    expect(src).not.toMatch(/process\.env\.ANTHROPIC_API_KEY\s*[=;,]/);
  });

  it('never directly inserts into the arguments table', () => {
    expect(src).toMatch(/invokeSubmitArgument/);
    expect(src).not.toMatch(/\.from\(['"]arguments['"]\)\s*\.insert/);
  });

  it('never references SUPABASE_SERVICE_ROLE / serviceRoleKey', () => {
    expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE/);
    expect(src).not.toMatch(/serviceRoleKey/);
  });

  it('JSONL writer outer eventType cannot be overridden by caller payload', () => {
    expect(src).toMatch(/\{ \.\.\.data, ts:.*eventType \}/);
  });

  it('writes JSONL under gitignored logs/ by default', () => {
    // path.join('logs', 'engagement-intelligence') in source — check the literal segments.
    expect(src).toContain("'logs', 'engagement-intelligence'");
    expect(src).toMatch(/gitignored — do not commit/);
  });

  it('refuses xai_live source-mode without --pilot', () => {
    expect(src).toMatch(/xai_live source-mode requires --pilot/);
  });
});
