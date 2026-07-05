/**
 * RESEED-001 — renderSonnet fallback + prefix-only histogram.
 *   - a stubbed client returning a JSON-wrapped body -> deterministic fallback
 *     with source 'deterministic_fallback' and an issues entry.
 *   - the fallback-reason histogram buckets on issue PREFIX only, never echoes
 *     an option/spine id or a banned label value.
 */
const {
  renderSonnet,
  fallbackReasonPrefix,
  fallbackReasonHistogram,
  validateSonnetBody,
} = require('../scripts/reseeder/reseedMoveRenderer');
const { seededRng } = require('../scripts/bot-fixtures/stressScenarioTemplates');

const SEED_RECORD = {
  bankName: 'school-uniforms::debate.org::0007',
  topic: 'school uniforms',
  stance: 'PRO',
  premise: 'School uniforms reduce peer pressure over clothing and let students focus on learning.',
  conclusion: 'school uniforms',
  license: 'CC-BY-4.0',
  sourceId: 'S1',
  fetchedAt: '2026-07-05T00:00:00Z',
  ingestMode: 'args_me_live',
};

function move(overrides: Record<string, unknown> = {}) {
  return {
    argumentType: 'claim',
    parentType: 'thesis',
    parentBody: 'On the question of school uniforms, uniforms reduce peer pressure over clothing.',
    targetExcerpt: 'school uniforms',
    spineId: 'objection',
    resolution: 'Resolved: school uniforms.',
    ...overrides,
  };
}

describe('renderSonnet fallback', () => {
  it('falls back to a deterministic body when the client returns a JSON-wrapped body', async () => {
    const client = { generate: jest.fn(async () => ({ text: '{"body":"this is JSON wrapped and should be rejected"}' })) };
    const res = await renderSonnet({ client, move: move(), seedRecord: SEED_RECORD, rng: seededRng('s1'), maxRetries: 1 });
    expect(res.source).toBe('deterministic_fallback');
    expect(res.issues.length).toBeGreaterThan(0);
    expect(res.issues).toContain('sonnet_wrapper');
    // The fallback body is a real deterministic-template body.
    expect(res.body.length).toBeGreaterThan(20);
    // One retry means the client is called twice before falling back.
    expect(client.generate).toHaveBeenCalledTimes(2);
  });

  it('returns a sonnet body when the client returns a valid, engine-passing body', async () => {
    const good =
      'A specific claim: regarding "school uniforms", they lower the yearly clothing cost that families carry each year.';
    const client = { generate: jest.fn(async () => ({ text: good })) };
    const res = await renderSonnet({ client, move: move(), seedRecord: SEED_RECORD, rng: seededRng('s2'), maxRetries: 1 });
    expect(res.source).toBe('sonnet');
    expect(res.body).toBe(good);
    expect(client.generate).toHaveBeenCalledTimes(1);
  });

  it('falls back on a client error (records sonnet_error)', async () => {
    const client = { generate: jest.fn(async () => { throw new Error('anthropic_http_500'); }) };
    const res = await renderSonnet({ client, move: move(), seedRecord: SEED_RECORD, rng: seededRng('s3'), maxRetries: 1 });
    expect(res.source).toBe('deterministic_fallback');
    expect(res.issues).toContain('sonnet_error');
  });

  it('fallbackReasonPrefix buckets on prefix only (no id/value leak)', () => {
    expect(fallbackReasonPrefix('sonnet_wrapper')).toBe('sonnet_wrapper');
    expect(fallbackReasonPrefix('sonnet_engine_reject')).toBe('sonnet_engine_reject');
    expect(fallbackReasonPrefix('sonnet_missing_open')).toBe('sonnet_missing_open');
    expect(fallbackReasonPrefix('sonnet_error')).toBe('sonnet_error');
    expect(fallbackReasonPrefix('something_else')).toBe('sonnet_other');
  });

  it('fallbackReasonHistogram buckets across events and never echoes a spine/option id or banned label', () => {
    const events = [
      { issues: ['sonnet_wrapper', 'sonnet_engine_reject'] },
      { issues: ['sonnet_wrapper'] },
      { issues: [] },
    ];
    const hist = fallbackReasonHistogram(events);
    expect(hist.sonnet_wrapper).toBe(2);
    expect(hist.sonnet_engine_reject).toBe(1);
    const keys = Object.keys(hist).join(' ');
    // No spine id, option index, or banned verdict token leaks into a bucket key.
    for (const banned of ['objection', 'evidence-pressure', 'winner', 'loser', 'liar', 'true', 'false', 'troll']) {
      expect(keys.includes(banned)).toBe(false);
    }
  });

  it('validateSonnetBody rejects an empty body', () => {
    const check = validateSonnetBody('', move());
    expect(check.ok).toBe(false);
    expect(check.issues).toContain('sonnet_empty');
  });
});
