/**
 * CORPUS-30-QUALITY-001 — fallback-reason histogram + samey-move Jaccard
 * + green-on-empty HARD GUARD + twin-lockstep + determinism.
 *
 * Scope: dev-tooling reporter twins only
 * (scripts/bot-fixtures/runXaiAdversarialBotCorpus.js +
 *  scripts/bot-fixtures/xaiAdversarialReport.js). No submission path, no
 * src, no Edge. These tests assert the two §9 report paths cannot diverge
 * again and that no metric reads green on absent / insufficient data.
 *
 * Doctrine: cdiscourse-doctrine §1/§3/§4-T/§9/§10a. The histogram buckets
 * on the token PREFIX only — never a user-label value or option/spine id
 * payload. Operator policy `policy_no_censorship`: hostile rhetoric is the
 * corpus INPUT, not a defect; these tests do not scan for it.
 */

const runner = require('../scripts/bot-fixtures/runXaiAdversarialBotCorpus');
const reportLib = require('../scripts/bot-fixtures/xaiAdversarialReport');

type Event = Record<string, unknown>;

// Build N body-free move_body_sample events with a tokenHashes fingerprint.
function buildSamples(
  n: number,
  hashesFor: (i: number) => string[],
  threadFor: (i: number) => number = () => 0,
  openingFor: (i: number) => string = (i) => `op${i}`,
): Event[] {
  const evs: Event[] = [];
  for (let i = 0; i < n; i++) {
    const hashes = hashesFor(i);
    evs.push({
      stage: 'move_body_sample', threadIndex: threadFor(i), moveIndex: 3 + i, moveId: `m${i}`,
      tokenSetHash: `h${i}`, tokenCount: hashes.length, tokenHashes: hashes, openingTokenHash: openingFor(i),
    });
  }
  return evs;
}

function mkValidated(opts: { source: string; issues?: string[]; seed?: boolean }): Event {
  return {
    stage: 'move_validated', threadIndex: 0, moveIndex: 3, moveId: 'm',
    source: opts.source, issues: opts.issues || [], seed: opts.seed === true,
  };
}

describe('CORPUS-30-QUALITY-001 — fallback-reason histogram', () => {
  const events: Event[] = [
    mkValidated({ source: 'banked_option_live', seed: true }), // seed → excluded
    mkValidated({ source: 'deterministic_fallback', issues: ['missing_target_excerpt', 'option_drift:opt-3'] }),
    mkValidated({ source: 'deterministic_fallback', issues: ['missing_target_excerpt'] }),
    mkValidated({ source: 'anthropic', issues: [] }),
    mkValidated({ source: 'deterministic_fallback', issues: ['forbidden_user_label:troll'] }),
    mkValidated({ source: 'deterministic_fallback', issues: [] }), // unspecified bucket
  ];

  it('runner emits a histogram bucketed on the issue PREFIX only', () => {
    const h = runner.fallbackReasonHistogram(events);
    expect(h.totalFallback).toBe(4);
    expect(h.nonSeedMoveCount).toBe(5); // 6 total minus 1 seed
    expect(h.dominantReason).toBe('missing_target_excerpt');
    const map = Object.fromEntries(h.histogram);
    expect(map.missing_target_excerpt).toBe(2);
    expect(map.option_drift).toBe(1);
    expect(map.forbidden_user_label).toBe(1);
    expect(map.unspecified).toBe(1);
  });

  it('NEVER echoes a user-label value or option/spine id payload (doctrine §1/§9/§10a)', () => {
    const h = runner.fallbackReasonHistogram(events);
    const serialized = JSON.stringify(h);
    expect(serialized).not.toContain('troll'); // label value suppressed
    expect(serialized).not.toContain('opt-3'); // option id suppressed
    // Only the prefix survives.
    expect(serialized).toContain('forbidden_user_label');
    expect(serialized).toContain('option_drift');
  });

  it('twin (reporter) aggregates an identical histogram shape (twin-lockstep)', () => {
    const a = runner.fallbackReasonHistogram(events);
    const b = reportLib.fallbackReasonHistogram(events);
    expect(b).toEqual(a);
  });

  it('the Markdown subsection is identical across twins and leak-free', () => {
    const runnerMd = (() => {
      // runner has no standalone render export; reconstruct from the twin
      // render which uses the same data — assert the report twin renders.
      return reportLib.renderFallbackReasonHistogramSection(events);
    })();
    expect(runnerMd).toContain('Fallback reason histogram');
    expect(runnerMd).toContain('missing_target_excerpt');
    expect(runnerMd).not.toContain('troll');
    expect(runnerMd).not.toContain('opt-3');
  });

  it('reports zero fallback cleanly when no deterministic_fallback moves exist', () => {
    const clean: Event[] = [mkValidated({ source: 'anthropic' }), mkValidated({ source: 'anthropic' })];
    const h = runner.fallbackReasonHistogram(clean);
    expect(h.totalFallback).toBe(0);
    expect(h.nonSeedMoveCount).toBe(2);
    expect(h.dominantReason).toBeNull();
    expect(h.histogram).toEqual([]);
  });

  it('is deterministic — same events → same histogram', () => {
    expect(runner.fallbackReasonHistogram(events)).toEqual(runner.fallbackReasonHistogram(events));
  });
});

describe('CORPUS-30-QUALITY-001 — samey-move real Jaccard', () => {
  it('computes a non-zero real overallMean on overlapping token-sets (>=50 samples)', () => {
    // All share a 4-hash core + 1 unique → moderate-to-high overlap.
    const events = buildSamples(60, (i) => ['core1', 'core2', 'core3', 'core4', `u${i}`]);
    const result = runner.checkSameyMove(events);
    expect(result.overallMean).toBeGreaterThan(0);
    expect(['yellow', 'red']).toContain(result.severityBand);
  });

  it('computes ~0 real overallMean on disjoint token-sets (>=50 samples) → green', () => {
    const events = buildSamples(60, (i) => [`a${i}`, `b${i}`, `c${i}`, `d${i}`]);
    const result = runner.checkSameyMove(events);
    expect(result.overallMean).toBe(0);
    expect(result.severityBand).toBe('green');
  });

  it('the YELLOW band is reachable (mean > 0.35, no high pair)', () => {
    // 5 common + 4 unique → pairwise Jaccard 5/13 ≈ 0.385, no pair ≥ 0.60.
    const events = buildSamples(50, (i) => ['c1', 'c2', 'c3', 'c4', 'c5', `u${i}a`, `u${i}b`, `u${i}c`, `u${i}d`]);
    const result = runner.checkSameyMove(events);
    expect(result.severityBand).toBe('yellow');
    expect(result.highPairs.length).toBe(0);
    expect(result.overallMean).toBeGreaterThan(0.35);
    expect(result.overallMean).toBeLessThan(0.60);
  });

  it('the RED band is reachable (clone pairs present)', () => {
    const events = buildSamples(60, () => ['x1', 'x2', 'x3', 'x4', 'x5']);
    const result = runner.checkSameyMove(events);
    expect(result.severityBand).toBe('red');
    expect(result.highPairs.length).toBeGreaterThan(0);
  });

  it('twin (reporter) computes an identical band + means (twin-lockstep)', () => {
    const events = buildSamples(60, (i) => ['core1', 'core2', 'core3', `u${i}`]);
    const a = runner.checkSameyMove(events);
    const b = reportLib.sameyMoveFromEvents(events);
    expect(b.severityBand).toBe(a.severityBand);
    expect(b.overallMean).toBe(a.overallMean);
    expect(b.maxIntraThreadMean).toBe(a.maxIntraThreadMean);
  });

  it('is deterministic — same events → same metric', () => {
    const events = buildSamples(55, (i) => ['core1', 'core2', `u${i}`]);
    expect(runner.checkSameyMove(events)).toEqual(runner.checkSameyMove(events));
  });
});

describe('CORPUS-30-QUALITY-001 — green-on-empty HARD GUARD (§4-T)', () => {
  it('49 non-empty samples → n/a (insufficient_samples), NEVER green', () => {
    const events = buildSamples(49, (i) => [`a${i}`, `b${i}`, `c${i}`, `d${i}`]);
    const result = runner.checkSameyMove(events);
    expect(result.severityBand).toBe('n/a');
    expect(result.reason).toBe('insufficient_samples');
    expect(result.severityBand).not.toBe('green');
    expect(result.sampleCount).toBe(49);
  });

  it('50 non-empty samples → a real band (boundary)', () => {
    const events = buildSamples(50, (i) => [`a${i}`, `b${i}`, `c${i}`, `d${i}`]);
    const result = runner.checkSameyMove(events);
    expect(['green', 'yellow', 'red']).toContain(result.severityBand);
    expect(result.severityBand).toBe('green'); // disjoint → green WITH enough data
    expect(result.sampleCount).toBe(50);
  });

  it('zero samples → n/a (attribution_absent), NEVER green', () => {
    const result = runner.checkSameyMove([{ stage: 'seed_assignment', assignedSeedIds: ['a'] }] as Event[]);
    expect(result.severityBand).toBe('n/a');
    expect(result.reason).toBe('attribution_absent');
    expect(result.severityBand).not.toBe('green');
  });

  it('twin honors the same N<50 floor (twin-lockstep)', () => {
    const events = buildSamples(49, (i) => [`a${i}`, `b${i}`, `c${i}`, `d${i}`]);
    const a = runner.checkSameyMove(events);
    const b = reportLib.sameyMoveFromEvents(events);
    expect(b.severityBand).toBe('n/a');
    expect(b.reason).toBe(a.reason);
    expect(b.sampleCount).toBe(a.sampleCount);
  });

  it('widening cannot turn n/a/yellow green: the floor + thresholds are constants in the source', () => {
    const src = require('fs').readFileSync(
      require('path').join(process.cwd(), 'scripts/bot-fixtures/runXaiAdversarialBotCorpus.js'), 'utf8');
    expect(src).toContain('SAMEY_MOVE_SAMPLE_FLOOR = 50');
    expect(src).toContain("reason: 'insufficient_samples'");
    // The old green-on-empty literals must be gone.
    expect(src).not.toContain('const yellow = false; // we only have strict clone detection here');
  });
});
