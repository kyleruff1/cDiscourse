/**
 * RESEED-001 — reseedNormalizer tests.
 * Verifies the normalizer against the CONFIRMED live args.me JSON shape.
 */
const normalizer = require('../scripts/reseeder/reseedNormalizer');

const CTX = { fetchedAt: '2026-07-05T00:00:00Z', ingestMode: 'args_me_live' };

// A well-formed args.me argument in the confirmed real shape (fields under
// `context`; premises[].stance present).
function wellFormed(overrides: Record<string, unknown> = {}) {
  return {
    id: 'Scf842d4b-A5a3cc727',
    conclusion: 'school uniforms',
    premises: [
      {
        text: 'School uniforms reduce peer pressure over clothing and let students focus on learning.',
        stance: 'PRO',
        annotations: [],
      },
    ],
    context: {
      topic: 'school uniforms',
      sourceDomain: 'debate.org',
      sourceId: 'Scf842d4b',
      sourceTitle: 'Debate: School Uniforms | Debate.org',
      sourceUrl: 'https://www.debate.org/debates/School-Uniforms/1/',
    },
    stance: 'PRO',
    ...overrides,
  };
}

describe('normalizeArgsMeArgument', () => {
  it('maps a well-formed argument to a full ReseedSourceRecord', () => {
    const rec = normalizer.normalizeArgsMeArgument(wellFormed(), CTX);
    expect(rec).not.toBeNull();
    expect(rec.topic).toBe('school uniforms');
    expect(rec.stance).toBe('PRO');
    expect(rec.premise.length).toBeGreaterThan(0);
    expect(rec.conclusion).toBe('school uniforms');
    // Attribution fields (gitignored-only) are captured on the record.
    expect(rec.sourceUrl).toBe('https://www.debate.org/debates/School-Uniforms/1/');
    expect(rec.sourceId).toBe('Scf842d4b');
    expect(rec.license).toBe('CC-BY-4.0');
    expect(rec.ingestMode).toBe('args_me_live');
    expect(rec.bankName).toContain('school-uniforms');
  });

  it('maps stance PRO / CON / UNKNOWN', () => {
    expect(normalizer.mapStance('PRO')).toBe('PRO');
    expect(normalizer.mapStance('con')).toBe('CON');
    expect(normalizer.mapStance('anything')).toBe('UNKNOWN');
    expect(normalizer.mapStance(undefined)).toBe('UNKNOWN');
  });

  it('prefers premise stance, falls back to argument stance', () => {
    const noPremStance = wellFormed({
      premises: [{ text: 'A body without a premise stance field here.', annotations: [] }],
      stance: 'CON',
    });
    const rec = normalizer.normalizeArgsMeArgument(noPremStance, CTX);
    expect(rec.stance).toBe('CON');
  });

  it('returns null for an empty / whitespace-only premise', () => {
    const empty = wellFormed({ premises: [{ text: '   ', stance: 'PRO' }] });
    expect(normalizer.normalizeArgsMeArgument(empty, CTX)).toBeNull();
    const noPrem = wellFormed({ premises: [] });
    expect(normalizer.normalizeArgsMeArgument(noPrem, CTX)).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(normalizer.normalizeArgsMeArgument(null, CTX)).toBeNull();
    expect(normalizer.normalizeArgsMeArgument('nope' as unknown as Record<string, unknown>, CTX)).toBeNull();
  });

  it('tolerates the legacy shape (top-level sourceUrl, no context)', () => {
    const legacy = {
      id: 'S9',
      conclusion: 'nuclear energy',
      premises: [{ text: 'Nuclear energy waste storage spans thousands of years.' }],
      sourceUrl: 'https://www.debate.org/debates/Nuclear/4/',
      sourceDomain: 'debate.org',
      sourceId: 'S9',
    };
    const rec = normalizer.normalizeArgsMeArgument(legacy, { fetchedAt: CTX.fetchedAt, ingestMode: 'offline_dump' });
    expect(rec).not.toBeNull();
    expect(rec.topic).toBe('nuclear energy');
    expect(rec.sourceUrl).toBe('https://www.debate.org/debates/Nuclear/4/');
    expect(rec.ingestMode).toBe('offline_dump');
  });
});

describe('normalizeArgsMeBatch', () => {
  it('drops nulls and preserves order', () => {
    const raws = [
      wellFormed({ id: 'A', context: { topic: 'topic a', sourceDomain: 'debate.org', sourceId: 'A' } }),
      wellFormed({ id: 'B', premises: [{ text: '  ', stance: 'PRO' }] }), // dropped
      wellFormed({ id: 'C', context: { topic: 'topic c', sourceDomain: 'debate.org', sourceId: 'C' } }),
    ];
    const out = normalizer.normalizeArgsMeBatch(raws, CTX);
    expect(out).toHaveLength(2);
    expect(out[0].topic).toBe('topic a');
    expect(out[1].topic).toBe('topic c');
  });

  it('de-duplicates by bankName (first wins)', () => {
    const dup = wellFormed();
    const out = normalizer.normalizeArgsMeBatch([dup, dup], CTX);
    expect(out).toHaveLength(1);
  });

  it('returns [] for a non-array', () => {
    expect(normalizer.normalizeArgsMeBatch(null as unknown as unknown[], CTX)).toEqual([]);
  });
});
