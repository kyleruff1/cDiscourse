/**
 * CORPUS-30-LIVE-PATH-WIRING — Fix 2, Test 4.
 *
 * Asserts the §9 reporter checks emit `severityBand: 'n/a'` with
 * `reason: 'attribution_absent'` — NOT a false green — when the
 * underlying attribution fields are missing on the JSONL events.
 *
 * Operator-ratified default (CORPUS-30 design §9 #2):
 *   - n/a is the explicit "cannot decide from the data" signal.
 *   - The 30 runbook gates PASS on `severityBand === 'green'` only;
 *     yellow / red / n/a all fail the gate.
 *
 * Covers all five §9 checks: repeated-option, spine-saturation,
 * voice-distribution, samey-move, and duplicate-seed (always
 * computable).
 */

const runner = require('../scripts/bot-fixtures/runXaiAdversarialBotCorpus');
const reportLib = require('../scripts/bot-fixtures/xaiAdversarialReport');
const corpusReportLib = require('../scripts/engagement-intelligence/xaiAdversarialCorpusReport');

type Event = Record<string, unknown>;

describe('CORPUS-30 reporter — attribution-absent n/a (NOT false green)', () => {
  it('runner.checkRepeatedOption: n/a when no move_validated events exist', () => {
    const events: Event[] = [{ stage: 'seed_assignment', assignedSeedIds: ['a', 'b'] }];
    const result = runner.checkRepeatedOption(events);
    expect(result.severityBand).toBe('n/a');
    expect(result.reason).toBe('attribution_absent');
  });

  it('runner.checkRepeatedOption: n/a when ≥1 move_validated lacks bankName+optionIndex', () => {
    const events: Event[] = [
      { stage: 'move_validated', threadIndex: 0, moveIndex: 3, bankName: 'evidence_pressure_options', optionIndex: 0, optionId: 'o-1', spineId: 'mechanism-led', voiceId: 'empiricist' },
      { stage: 'move_validated', threadIndex: 0, moveIndex: 4 /* MISSING bankName/optionIndex */ },
    ];
    const result = runner.checkRepeatedOption(events);
    expect(result.severityBand).toBe('n/a');
    expect(result.reason).toBe('attribution_absent');
  });

  it('runner.checkSpineSaturation: n/a when ≥1 move_validated lacks spineId', () => {
    const events: Event[] = [
      { stage: 'move_validated', threadIndex: 0, moveIndex: 3, bankName: 'evidence_pressure_options', optionIndex: 0, optionId: 'o-1', spineId: 'mechanism-led', voiceId: 'empiricist' },
      { stage: 'move_validated', threadIndex: 0, moveIndex: 4, bankName: 'objection_options', optionIndex: 0, optionId: 'o-2', voiceId: 'empiricist' /* missing spineId */ },
    ];
    const result = runner.checkSpineSaturation(events);
    expect(result.severityBand).toBe('n/a');
    expect(result.reason).toBe('attribution_absent');
  });

  it('runner.checkVoiceDistribution: n/a when no bot_assignment events exist', () => {
    const events: Event[] = [
      { stage: 'move_validated', threadIndex: 0, moveIndex: 3, bankName: 'x', optionIndex: 0, optionId: 'o-1', spineId: 'mechanism-led', voiceId: 'empiricist' },
    ];
    const result = runner.checkVoiceDistribution(events);
    expect(result.severityBand).toBe('n/a');
    expect(result.reason).toBe('attribution_absent');
  });

  it('runner.checkVoiceDistribution: n/a when bot_assignment lacks voiceId on any entry', () => {
    const events: Event[] = [
      { stage: 'bot_assignment', scenarioId: 's1', assignments: [{ alias: 'b1', voiceId: 'empiricist' }, { alias: 'b2' /* missing voiceId */ }] },
    ];
    const result = runner.checkVoiceDistribution(events);
    expect(result.severityBand).toBe('n/a');
    expect(result.reason).toBe('attribution_absent');
  });

  it('runner.checkSameyMove: n/a when no move_body_sample AND no bot_move_render present', () => {
    const events: Event[] = [{ stage: 'seed_assignment', assignedSeedIds: ['a'] }];
    const result = runner.checkSameyMove(events);
    expect(result.severityBand).toBe('n/a');
    expect(result.reason).toBe('attribution_absent');
  });

  it('runner.checkDuplicateSeed: green even with no move_validated (computable from seed_assignment alone)', () => {
    const events: Event[] = [{ stage: 'seed_assignment', assignedSeedIds: ['a', 'b', 'c'] }];
    const result = runner.checkDuplicateSeed(events);
    // This check is ALWAYS computable — it operates on the seed_assignment
    // event which is always emitted on banked-pool runs. n/a does NOT
    // apply here.
    expect(result.severityBand).toBe('green');
  });

  it('runDiversityChecks aggregate honors n/a across all five checks', () => {
    // An event stream with only seed_assignment — duplicate-seed is
    // green, every other check is n/a.
    const events: Event[] = [{ stage: 'seed_assignment', assignedSeedIds: ['a', 'b', 'c'] }];
    const checks = runner.runDiversityChecks(events);
    expect(checks.duplicateSeed.severityBand).toBe('green');
    expect(checks.repeatedOption.severityBand).toBe('n/a');
    expect(checks.spineSaturation.severityBand).toBe('n/a');
    expect(checks.voiceDistribution.severityBand).toBe('n/a');
    expect(checks.sameyMove.severityBand).toBe('n/a');
  });

  it('reportLib.aggregateDiversityChecks honors n/a as a band on a JSONL that lacks attribution', () => {
    const events: Event[] = [{ stage: 'seed_assignment', assignedSeedIds: ['a', 'b'] }];
    const d = reportLib.aggregateDiversityChecks(events);
    expect(d.repeatedOption.severityBand).toBe('n/a');
    expect(d.repeatedOption.reason).toBe('attribution_absent');
    expect(d.spineSaturation.severityBand).toBe('n/a');
    expect(d.spineSaturation.reason).toBe('attribution_absent');
    expect(d.voiceDistribution.severityBand).toBe('n/a');
    expect(d.sameyMove.severityBand).toBe('n/a');
  });

  it('corpusReportLib.corpus30DiversityChecks honors n/a on repeatedOption when bankName absent', () => {
    const events: Event[] = [{ stage: 'seed_assignment', assignedSeedIds: ['x'] }];
    const d = corpusReportLib.corpus30DiversityChecks(events);
    expect(d.repeatedOption.severityBand).toBe('n/a');
    expect(d.repeatedOption.reason).toBe('attribution_absent');
  });

  it('reportLib renders the §9 section with "n/a" + reason text (no falsified green)', () => {
    const events: Event[] = [{ stage: 'seed_assignment', assignedSeedIds: ['a'] }];
    const md: string = reportLib.renderDiversityChecksSection(events);
    expect(md).toContain('Repeated-option:');
    expect(md).toContain('severityBand=`n/a`');
    expect(md).toContain('attribution_absent');
    // It MUST not falsify a green for the n/a check.
    const lines = md.split('\n');
    const repeatedLine = lines.find((l) => l.startsWith('- Repeated-option:'));
    expect(repeatedLine).toBeTruthy();
    expect(repeatedLine).not.toContain('`green`');
  });

  it('full attribution present → green when no anomalies (regression guard)', () => {
    const events: Event[] = [
      { stage: 'seed_assignment', assignedSeedIds: ['a', 'b', 'c'] },
      { stage: 'bot_assignment', scenarioId: 's1', assignments: [{ alias: 'b1', voiceId: 'empiricist' }, { alias: 'b2', voiceId: 'mechanism_hunter' }, { alias: 'b3', voiceId: 'scope_narrower' }] },
    ];
    const spines = ['quote-led', 'counterexample-led', 'definition-led', 'mechanism-led', 'scope-led', 'concession-then-pivot', 'question-led', 'analogy-led', 'second-order-effect-led'];
    for (let i = 0; i < 9; i++) {
      events.push({
        stage: 'move_validated', threadIndex: i, moveIndex: 3,
        bankName: 'evidence_pressure_options', optionIndex: i,
        optionId: `opt-${i}`, spineId: spines[i], voiceId: 'empiricist',
      });
      events.push({
        stage: 'move_body_sample', threadIndex: i, moveIndex: 3,
        moveId: `m3-${i}`, tokenSetHash: `hash-${i}`, tokenCount: 8,
      });
    }
    const d = reportLib.aggregateDiversityChecks(events);
    expect(d.duplicateSeed.severityBand).toBe('green');
    expect(d.repeatedOption.severityBand).toBe('green');
    expect(d.spineSaturation.severityBand).toBe('green');
    expect(d.sameyMove.severityBand).toBe('green');
  });
});
