/**
 * RESEED-001 — renderNoProvider: no provider call + determinism.
 */
const fs = require('node:fs');
const path = require('node:path');
const { renderNoProvider } = require('../scripts/reseeder/reseedMoveRenderer');
const { seededRng } = require('../scripts/bot-fixtures/stressScenarioTemplates');

const SEED_RECORD = {
  bankName: 'school-uniforms::debate.org::0007',
  topic: 'school uniforms',
  stance: 'PRO',
  premise: 'School uniforms reduce peer pressure over clothing and let students focus on learning rather than appearance for every student.',
  conclusion: 'school uniforms',
  sourceUrl: null,
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

describe('renderNoProvider', () => {
  it('is deterministic: same (move, seedRecord, rng-seed) -> same body', () => {
    const a = renderNoProvider(move(), SEED_RECORD, seededRng('k1'));
    const b = renderNoProvider(move(), SEED_RECORD, seededRng('k1'));
    expect(a.body).toBe(b.body);
    expect(a.optionIndex).toBe(b.optionIndex);
    expect(a.source).toBe('deterministic_template');
  });

  it('produces a non-empty body that clears the length floor', () => {
    const r = renderNoProvider(move(), SEED_RECORD, seededRng('k2'));
    expect(r.body.length).toBeGreaterThan(20);
  });

  it('embeds a concession marker for concession/synthesis moves', () => {
    const r = renderNoProvider(move({ argumentType: 'concession', parentType: 'rebuttal' }), SEED_RECORD, seededRng('k3'));
    const lower = r.body.toLowerCase();
    const hasMarker = ['i grant', 'i concede', 'i acknowledge', 'fair point', 'that point is valid'].some((m) =>
      lower.includes(m),
    );
    expect(hasMarker).toBe(true);
  });

  it('echoes the verbatim targetExcerpt for a reply move', () => {
    const r = renderNoProvider(move({ targetExcerpt: 'school uniforms' }), SEED_RECORD, seededRng('k4'));
    expect(r.body).toContain('school uniforms');
  });

  it('takes NO client param and its source contains no anthropic / claudeMessagesClient reference (source-scan)', () => {
    // Behavioral: the function signature is (move, seedRecord, rng) — 3 params.
    expect(renderNoProvider.length).toBe(3);
    // Source-scan (Node fs, not shell rg): renderNoProvider's body must not
    // reference the Anthropic client. We scan the whole module and assert the
    // no-provider function does not import/mention it inline. The sonnet path
    // lives in the same file but renderNoProvider must be provider-free.
    const src = fs.readFileSync(
      path.resolve(__dirname, '..', 'scripts', 'reseeder', 'reseedMoveRenderer.js'),
      'utf8',
    );
    const fnStart = src.indexOf('function renderNoProvider');
    const fnEnd = src.indexOf('\n}', fnStart);
    const fnBody = src.slice(fnStart, fnEnd);
    expect(fnBody.toLowerCase().includes('anthropic')).toBe(false);
    expect(fnBody.includes('claudeMessagesClient')).toBe(false);
    expect(fnBody.includes('client.generate')).toBe(false);
    // The module must NOT statically require claudeMessagesClient at all
    // (the orchestrator lazily requires it only on the sonnet path).
    expect(src.includes("require('../bot-fixtures/claudeMessagesClient')")).toBe(false);
    expect(src.includes('require("../bot-fixtures/claudeMessagesClient")')).toBe(false);
  });
});
