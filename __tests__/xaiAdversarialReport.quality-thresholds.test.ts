/**
 * CORPUS-30-QUALITY-001 (c) — reporter quality thresholds with
 * attribution-presence gates.
 *
 * Three banded metrics (deterministicFallbackPct, topOpeningPhrasePct,
 * sameyMoveMean), each green/yellow/red and an explicit `n/a` that NEVER
 * folds into green on absent / insufficient data (§4-T HARD GUARD).
 * Twin-lockstep across the runner + reporter twins.
 */

const runner = require('../scripts/bot-fixtures/runXaiAdversarialBotCorpus');
const reportLib = require('../scripts/bot-fixtures/xaiAdversarialReport');

type Event = Record<string, unknown>;

function mkValidated(source: string, issues: string[] = [], seed = false): Event {
  return { stage: 'move_validated', threadIndex: 0, moveIndex: 3, moveId: 'm', source, issues, seed };
}

function buildSamples(
  n: number,
  hashesFor: (i: number) => string[],
  openingFor: (i: number) => string = (i) => `op${i}`,
): Event[] {
  const evs: Event[] = [];
  for (let i = 0; i < n; i++) {
    const hashes = hashesFor(i);
    evs.push({
      stage: 'move_body_sample', threadIndex: i % 5, moveIndex: 3 + i, moveId: `m${i}`,
      tokenSetHash: `h${i}`, tokenCount: hashes.length, tokenHashes: hashes, openingTokenHash: openingFor(i),
    });
  }
  return evs;
}

describe('CORPUS-30-QUALITY-001 — quality thresholds: deterministicFallbackPct', () => {
  it('green at <=20% fallback share', () => {
    const events: Event[] = [];
    for (let i = 0; i < 90; i++) events.push(mkValidated('anthropic'));
    for (let i = 0; i < 10; i++) events.push(mkValidated('deterministic_fallback', ['too_short']));
    const qt = runner.qualityThresholds(events);
    expect(qt.deterministicFallbackPct.severityBand).toBe('green');
    expect(qt.deterministicFallbackPct.value).toBe(10);
  });

  it('yellow in the 20–40% band', () => {
    const events: Event[] = [];
    for (let i = 0; i < 70; i++) events.push(mkValidated('anthropic'));
    for (let i = 0; i < 30; i++) events.push(mkValidated('deterministic_fallback', ['too_short']));
    const qt = runner.qualityThresholds(events);
    expect(qt.deterministicFallbackPct.severityBand).toBe('yellow');
  });

  it('red above 40%', () => {
    const events: Event[] = [];
    for (let i = 0; i < 10; i++) events.push(mkValidated('anthropic'));
    for (let i = 0; i < 90; i++) events.push(mkValidated('deterministic_fallback', ['too_short']));
    const qt = runner.qualityThresholds(events);
    expect(qt.deterministicFallbackPct.severityBand).toBe('red');
  });

  it('n/a (NOT green) when no non-seed move_validated events exist', () => {
    const events: Event[] = [mkValidated('banked_option_live', [], true)];
    const qt = runner.qualityThresholds(events);
    expect(qt.deterministicFallbackPct.severityBand).toBe('n/a');
    expect(qt.deterministicFallbackPct.attributionPresent).toBe(false);
    expect(qt.deterministicFallbackPct.severityBand).not.toBe('green');
  });
});

describe('CORPUS-30-QUALITY-001 — quality thresholds: topOpeningPhrasePct', () => {
  it('green at <8% top opening share', () => {
    // 50 samples, 20 distinct openings evenly → top share 5%.
    const events = buildSamples(50, (i) => [`a${i}`, `b${i}`, `c${i}`, `d${i}`], (i) => `op${i % 20}`);
    const qt = runner.qualityThresholds(events);
    expect(qt.topOpeningPhrasePct.severityBand).toBe('green');
  });

  it('yellow in the 8–15% band', () => {
    // 50 samples, 10 distinct openings → top share 10%.
    const events = buildSamples(50, (i) => [`a${i}`, `b${i}`, `c${i}`, `d${i}`], (i) => `op${i % 10}`);
    const qt = runner.qualityThresholds(events);
    expect(qt.topOpeningPhrasePct.severityBand).toBe('yellow');
    expect(qt.topOpeningPhrasePct.value).toBe(10);
  });

  it('red above 15%', () => {
    // All 50 share one opening → top share 100%.
    const events = buildSamples(50, (i) => [`a${i}`, `b${i}`, `c${i}`, `d${i}`], () => 'same-op');
    const qt = runner.qualityThresholds(events);
    expect(qt.topOpeningPhrasePct.severityBand).toBe('red');
  });

  it('n/a (NOT green) when no opening-phrase signal present', () => {
    const events: Event[] = [mkValidated('anthropic')];
    const qt = runner.qualityThresholds(events);
    expect(qt.topOpeningPhrasePct.severityBand).toBe('n/a');
    expect(qt.topOpeningPhrasePct.attributionPresent).toBe(false);
    expect(qt.topOpeningPhrasePct.severityBand).not.toBe('green');
  });

  it('opening-phrase signal is body-free (positional HASH only, never readable text)', () => {
    const events = buildSamples(50, (i) => [`a${i}`], () => 'same-op');
    const share = runner.openingPhraseTopShare(events);
    expect(share.present).toBe(true);
    // The bucket key is the openingTokenHash we fed; no body text is read.
    expect(JSON.stringify(share)).not.toContain('body');
  });
});

describe('CORPUS-30-QUALITY-001 — quality thresholds: sameyMoveMean', () => {
  it('below threshold AND >=50 samples → green', () => {
    const events = buildSamples(60, (i) => [`a${i}`, `b${i}`, `c${i}`, `d${i}`]);
    const qt = runner.qualityThresholds(events);
    expect(qt.sameyMoveMean.severityBand).toBe('green');
    expect(qt.sameyMoveMean.sampleCount).toBe(60);
  });

  it('clone pairs present → red', () => {
    const events = buildSamples(60, () => ['x1', 'x2', 'x3', 'x4']);
    const qt = runner.qualityThresholds(events);
    expect(qt.sameyMoveMean.severityBand).toBe('red');
  });

  it('n/a (insufficient_samples, NOT green) below 50 samples', () => {
    const events = buildSamples(40, (i) => [`a${i}`, `b${i}`]);
    const qt = runner.qualityThresholds(events);
    expect(qt.sameyMoveMean.severityBand).toBe('n/a');
    expect(qt.sameyMoveMean.reason).toBe('insufficient_samples');
    expect(qt.sameyMoveMean.severityBand).not.toBe('green');
  });
});

describe('CORPUS-30-QUALITY-001 — quality thresholds: twin-lockstep + determinism', () => {
  const fixtures: Record<string, Event[]> = {
    cleanGreen: (() => {
      const e: Event[] = [];
      for (let i = 0; i < 90; i++) e.push(mkValidated('anthropic'));
      for (let i = 0; i < 10; i++) e.push(mkValidated('deterministic_fallback', ['too_short']));
      return e.concat(buildSamples(60, (i) => [`a${i}`, `b${i}`, `c${i}`, `d${i}`], (i) => `op${i % 20}`));
    })(),
    thinNa: [mkValidated('banked_option_live', [], true)],
  };

  for (const [name, events] of Object.entries(fixtures)) {
    it(`runner and reporter produce identical qualityThresholds shapes (${name})`, () => {
      expect(reportLib.qualityThresholds(events)).toEqual(runner.qualityThresholds(events));
    });
  }

  it('is deterministic — same events → same thresholds', () => {
    expect(runner.qualityThresholds(fixtures.cleanGreen)).toEqual(runner.qualityThresholds(fixtures.cleanGreen));
  });

  it('renders n/a literally with a reason, never folded into green', () => {
    const rows: string[] = runner.renderQualityThresholdRows(runner.qualityThresholds(fixtures.thinNa));
    const joined = rows.join('\n');
    expect(joined).toContain('severityBand=`n/a`');
    expect(joined).toContain('attribution_absent');
    // No row falsely claims green for the n/a metrics.
    const fallbackRow = rows.find((r) => r.startsWith('- Deterministic fallback %'));
    expect(fallbackRow).toBeTruthy();
    expect(fallbackRow).not.toContain('`green`');
  });

  it('the full report Markdown contains both new subsections (twin)', () => {
    const md: string = reportLib.buildAdversarialReportMarkdown({
      runId: 'test-run', dateIso: '2026-06-04T00:00:00.000Z', mode: 'dry',
      providerLabel: 'xai_responses',
      args: { rooms: 1, candidatePosts: 1, topReplies: 1, maxDepth: 3, sourceMode: 'synthetic', allowSyntheticRebuttal: true, syntheticRebuttalThreshold: 0.35, seed: 1, envBooleans: {} },
      events: fixtures.cleanGreen, sceneSummaries: [], samples: {},
    });
    expect(md).toContain('Fallback reason histogram');
    expect(md).toContain('Quality thresholds');
  });
});
