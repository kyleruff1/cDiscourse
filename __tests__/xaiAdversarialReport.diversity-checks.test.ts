/**
 * CORPUS-30-POOL-DRIVEN-PLANNER §10: reporter diversity-check categories.
 *
 * Builds synthetic JSONL events that mimic the runner's attribution stream
 * and asserts the reporter classifies severityBand correctly per §9.
 */
const runner = require('../scripts/bot-fixtures/runXaiAdversarialBotCorpus');
const reportLib = require('../scripts/bot-fixtures/xaiAdversarialReport');
const corpusReportLib = require('../scripts/engagement-intelligence/xaiAdversarialCorpusReport');

type Event = Record<string, unknown>;

function mkMove(opts: { threadIndex: number; moveIndex: number; bankName: string; optionIndex: number; optionId: string; spineId: string; voiceId?: string; body?: string }): Event {
  return {
    stage: 'move_validated',
    threadIndex: opts.threadIndex,
    moveIndex: opts.moveIndex,
    bankName: opts.bankName,
    optionIndex: opts.optionIndex,
    optionId: opts.optionId,
    spineId: opts.spineId,
    voiceId: opts.voiceId || null,
  };
}

function mkRender(opts: { threadIndex: number; moveId: string; body: string }): Event {
  return {
    stage: 'bot_move_render',
    threadIndex: opts.threadIndex,
    move: { moveId: opts.moveId, body: opts.body },
  };
}

describe('CORPUS-30 reporter diversity checks', () => {
  it('detects a duplicate seedId in the seed_assignment event (red)', () => {
    const events: Event[] = [
      { stage: 'seed_assignment', assignedSeedIds: ['a', 'b', 'a', 'c'] },
    ];
    const checks = runner.runDiversityChecks(events);
    expect(checks.duplicateSeed.severityBand).toBe('red');
    expect(checks.duplicateSeed.duplicates).toEqual(['a']);
  });

  it('detects a cross-thread optionId collision in ≥3 threads (red)', () => {
    const events: Event[] = [];
    for (const t of [0, 1, 2]) {
      events.push(mkMove({ threadIndex: t, moveIndex: 3, bankName: 'evidence_pressure_options', optionIndex: 0, optionId: 'shared-opt', spineId: 'mechanism-led' }));
    }
    const checks = runner.runDiversityChecks(events);
    expect(checks.repeatedOption.severityBand).toBe('red');
    expect(checks.repeatedOption.crossThreadCollisions.length).toBe(1);
  });

  it('detects repeated optionIndex within a single thread (yellow)', () => {
    const events: Event[] = [
      mkMove({ threadIndex: 0, moveIndex: 3, bankName: 'evidence_pressure_options', optionIndex: 0, optionId: 'opt-A', spineId: 'mechanism-led' }),
      mkMove({ threadIndex: 0, moveIndex: 5, bankName: 'evidence_pressure_options', optionIndex: 0, optionId: 'opt-A', spineId: 'scope-led' }),
    ];
    const checks = runner.runDiversityChecks(events);
    expect(['yellow', 'red']).toContain(checks.repeatedOption.severityBand);
    expect(checks.repeatedOption.repeatedWithin.length).toBeGreaterThan(0);
  });

  it('detects spine saturation when >35% of moves share a single spineId (red)', () => {
    const events: Event[] = [];
    // 10 moves total, 5 quote-led (50%) — over the 35% threshold.
    for (let i = 0; i < 5; i++) {
      events.push(mkMove({ threadIndex: i, moveIndex: 3, bankName: 'evidence_pressure_options', optionIndex: i, optionId: `o-${i}`, spineId: 'quote-led' }));
    }
    for (let i = 0; i < 5; i++) {
      events.push(mkMove({ threadIndex: i, moveIndex: 4, bankName: 'objection_options', optionIndex: i, optionId: `q-${i}`, spineId: ['mechanism-led', 'scope-led', 'analogy-led', 'definition-led', 'counterexample-led'][i] }));
    }
    const checks = runner.runDiversityChecks(events);
    expect(checks.spineSaturation.severityBand).toBe('red');
    expect(checks.spineSaturation.saturatedSpine?.spineId).toBe('quote-led');
  });

  it('detects samey-move pair when intra-thread Jaccard ≥0.60 (red) — >=50 samples', () => {
    // CORPUS-30-QUALITY-001 (b): 60 identical bodies → Jaccard 1.0; the
    // metric needs >= 50 non-empty samples before it reads any band.
    const events: Event[] = [];
    for (let i = 0; i < 60; i++) {
      events.push(mkRender({ threadIndex: 0, moveId: `m${i}`, body: 'primary source mechanism mode shift parallel arterial demand' }));
    }
    const checks = runner.runDiversityChecks(events);
    expect(checks.sameyMove.severityBand).toBe('red');
    expect(checks.sameyMove.highPairs.length).toBeGreaterThan(0);
    expect(checks.sameyMove.overallMean).toBeGreaterThan(0);
  });

  it('returns green when no anomalies present (>=50 disjoint samples)', () => {
    // Spread spineIds across 9 distinct values so no spine exceeds 35%.
    const spinesPool = ['quote-led', 'counterexample-led', 'definition-led', 'mechanism-led', 'scope-led', 'concession-then-pivot', 'question-led', 'analogy-led', 'second-order-effect-led'];
    const events: Event[] = [
      { stage: 'seed_assignment', assignedSeedIds: ['a', 'b', 'c'] },
    ];
    for (let i = 0; i < 9; i++) {
      events.push(mkMove({ threadIndex: i, moveIndex: 3, bankName: 'evidence_pressure_options', optionIndex: i, optionId: `opt-${i}`, spineId: spinesPool[i] }));
    }
    // 60 lexically-disjoint bodies → samey reads green with enough data.
    // Each body uses a unique vocabulary so no pair shares tokens.
    for (let i = 0; i < 60; i++) {
      events.push(mkRender({ threadIndex: i % 9, moveId: `m${i}`, body: `wordaaa${i} wordbbb${i} wordccc${i} wordddd${i} wordeee${i}` }));
    }
    const checks = runner.runDiversityChecks(events);
    expect(checks.duplicateSeed.severityBand).toBe('green');
    expect(checks.repeatedOption.severityBand).toBe('green');
    expect(checks.spineSaturation.severityBand).toBe('green');
    expect(checks.sameyMove.severityBand).toBe('green');
  });

  it('voice-distribution check flags out-of-band voice counts', () => {
    const events: Event[] = [
      { stage: 'bot_assignment', scenarioId: 's1', assignments: [{ alias: 'b1', voiceId: 'empiricist' }, { alias: 'b2', voiceId: 'empiricist' }] },
    ];
    const checks = runner.runDiversityChecks(events);
    expect(checks.voiceDistribution.collisions.length).toBe(1);
    expect(checks.voiceDistribution.severityBand).toBe('yellow');
  });

  it('reportLib.aggregateDiversityChecks matches the runner aggregator behaviour', () => {
    const events: Event[] = [
      { stage: 'seed_assignment', assignedSeedIds: ['a', 'b', 'a'] },
    ];
    const d = reportLib.aggregateDiversityChecks(events);
    expect(d.duplicateSeed.severityBand).toBe('red');
  });

  it('corpusReportLib.corpus30DiversityChecks matches', () => {
    // CORPUS-30-LIVE-PATH-WIRING Fix 2: when move_validated events are
    // absent, repeated-option emits n/a + attribution_absent (NOT a false
    // green). Duplicate-seed still computes on seed_assignment events.
    const events: Event[] = [
      { stage: 'seed_assignment', assignedSeedIds: ['a', 'b', 'c'] },
    ];
    const d = corpusReportLib.corpus30DiversityChecks(events);
    expect(d.duplicateSeed.severityBand).toBe('green');
    expect(d.repeatedOption.severityBand).toBe('n/a');
    expect(d.repeatedOption.reason).toBe('attribution_absent');
  });
});
