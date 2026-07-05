/**
 * RESEED-001 — reporter attribution-presence + engine-rejection + ban-list.
 */
const { buildReseedMarkdown, reseedDiversityChecks } = require('../scripts/reseeder/reseedReport');

function attributedEvent(overrides: Record<string, unknown> = {}) {
  return {
    stage: 'move_body_sample',
    seedId: 'school-uniforms::debate.org::0007',
    threadIndex: 0,
    spineId: 'objection',
    voiceId: 'direct',
    bankName: 'school-uniforms::debate.org::0007',
    optionIndex: 0,
    moveId: 'm0',
    bodySample: 'On the question of school uniforms, uniforms reduce peer pressure over clothing.',
    ...overrides,
  };
}

const BANNED = ['winner', 'loser', 'liar', 'true', 'false', 'correct', 'dishonest', 'bad faith', 'troll', 'propagandist'];

describe('reseedDiversityChecks — attribution absence', () => {
  it('returns n/a with reason attribution_absent on an empty stream (never green-by-absence)', () => {
    const checks = reseedDiversityChecks([]);
    for (const key of ['duplicateSeed', 'voiceDistribution', 'spineSaturation', 'nearVerbatimCluster', 'sameyMove']) {
      expect(checks[key].severityBand).toBe('n/a');
      expect(checks[key].reason).toBe('attribution_absent');
    }
  });

  it('returns n/a when events lack the full attribution field set', () => {
    const partial = [{ stage: 'move_body_sample', bodySample: 'x', seedId: 'a' }]; // missing voiceId/spineId/etc.
    const checks = reseedDiversityChecks(partial);
    expect(checks.voiceDistribution.severityBand).toBe('n/a');
    expect(checks.voiceDistribution.reason).toBe('attribution_absent');
  });

  it('computes real bands (green reachable) when attribution is present', () => {
    const events = [
      attributedEvent({ voiceId: 'direct', spineId: 'objection', seedId: 'a::debate.org::1', bankName: 'a::debate.org::1' }),
      attributedEvent({ voiceId: 'measured', spineId: 'evidence-pressure', seedId: 'b::debate.org::2', bankName: 'b::debate.org::2', threadIndex: 1 }),
    ];
    const checks = reseedDiversityChecks(events);
    expect(checks.voiceDistribution.severityBand).toBe('green');
    expect(checks.duplicateSeed.severityBand).toBe('green');
  });
});

describe('engineRejection count', () => {
  it('reports 0 for a clean run', () => {
    const events = [attributedEvent({ engineValid: true, postStatus: 'posted' })];
    const checks = reseedDiversityChecks(events);
    expect(checks.engineRejection.count).toBe(0);
    expect(checks.engineRejection.severityBand).toBe('green');
  });

  it('reports N for a run with N rejections', () => {
    const events = [
      attributedEvent({ engineValid: true, postStatus: 'posted' }),
      attributedEvent({ moveId: 'm1', postStatus: 'failed_422' }),
      attributedEvent({ moveId: 'm2', engineValid: false }),
    ];
    const checks = reseedDiversityChecks(events);
    expect(checks.engineRejection.count).toBe(2);
    expect(checks.engineRejection.severityBand).toBe('yellow');
  });
});

describe('buildReseedMarkdown', () => {
  it('renders an engine-rejection section and cannot render green from an empty stream', () => {
    const md = buildReseedMarkdown({ runId: 'r', dateIso: '2026-07-05T00:00:00Z', mode: 'dry', pack: 'baseline', events: [], args: { pack: 'baseline', count: 5, seed: 's', provider: 'none', dry: true } });
    expect(md).toContain('Engine-rejection count');
    expect(md).toContain('Attribution absent');
    // Every diversity band is n/a.
    expect(md).toContain('n/a (attribution_absent)');
  });

  it('renders the engine-rejection number for a run with rejections', () => {
    const events = [
      attributedEvent({ engineValid: true, postStatus: 'posted' }),
      attributedEvent({ moveId: 'm1', postStatus: 'failed_500' }),
    ];
    const md = buildReseedMarkdown({ runId: 'r', dateIso: '2026-07-05T00:00:00Z', mode: 'live', pack: 'baseline', events, args: { pack: 'baseline', count: 5, seed: 's', provider: 'none', dry: false } });
    expect(md).toMatch(/Engine rejections[^\n]*\*\*1\*\*/);
  });

  it('rendered Markdown contains no banned verdict / truth token', () => {
    const events = [attributedEvent({ postStatus: 'posted', engineValid: true })];
    const md = buildReseedMarkdown({ runId: 'r', dateIso: '2026-07-05T00:00:00Z', mode: 'live', pack: 'baseline', events, args: { pack: 'baseline', count: 5, seed: 's', provider: 'none', dry: false } });
    const lower = md.toLowerCase();
    for (const b of BANNED) {
      // 'true'/'false' can appear as substrings in benign words (e.g. no such
      // word here) — assert the token never appears as a standalone word.
      // None of the banned tokens contain regex metacharacters, so a plain
      // word-boundary match is safe.
      const re = new RegExp(`\\b${b}\\b`);
      expect({ token: b, found: re.test(lower) }).toEqual({ token: b, found: false });
    }
  });
});
