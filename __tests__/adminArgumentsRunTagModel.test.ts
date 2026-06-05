/**
 * ADMIN-ARGUMENTS-003 — pure-model tests for the Admin Arguments runTag filter
 * (`src/features/admin/adminArgumentsRunTagModel.ts`).
 *
 * Covers:
 *  - classifyRunFamily across the canonical corpus-suffix shapes the runners
 *    actually emit ([xai-adv …], [ai-corpus … #s7], [stress …], [scenario-…],
 *    [seed-…], [ai-seed-…]) plus the human / untagged / null / empty cases.
 *  - the body-mention guard (a "stress" word inside the claim body never
 *    mis-buckets a human room).
 *  - runFamilyMatchesFilter (all-sentinel + exact-match semantics).
 *  - coerceRunTagFilterValue defensive narrowing.
 *  - doctrine: every label + hint is plain language with zero verdict tokens.
 */
import {
  classifyRunFamily,
  runFamilyMatchesFilter,
  coerceRunTagFilterValue,
  RUN_TAG_FILTER_VALUES,
  RUN_FAMILIES,
  RUN_TAG_FILTER_LABELS,
  RUN_TAG_FILTER_HINTS,
  type RunFamily,
  type RunTagFilterValue,
} from '../src/features/admin/adminArgumentsRunTagModel';

describe('classifyRunFamily — canonical corpus suffixes', () => {
  it('classifies the xAI adversarial suffix', () => {
    expect(classifyRunFamily({ debateTitle: 'Bike lanes are better [xai-adv 9018694f]' }))
      .toBe('xai_adv');
    expect(classifyRunFamily({ debateTitle: 'Foo [xai-adv 12ab t03]' })).toBe('xai_adv');
  });

  it('classifies the AI corpus suffix', () => {
    expect(classifyRunFamily({ debateTitle: 'Pitch clock changed pacing [ai-corpus fa17 #s7]' }))
      .toBe('ai_corpus');
  });

  it('classifies the stress batch suffix (space and dash forms)', () => {
    expect(classifyRunFamily({ debateTitle: 'Sports debate [stress 2026-05-17 #scenario-7]' }))
      .toBe('stress');
    expect(classifyRunFamily({ debateTitle: 'Sports debate [stress-2026-05-17]' }))
      .toBe('stress');
    expect(classifyRunFamily({ debateTitle: 'Sports debate [stress]' })).toBe('stress');
  });

  it('classifies the scenario suffix', () => {
    expect(classifyRunFamily({ debateTitle: 'Foo [scenario-12 t03]' })).toBe('scenario');
    expect(classifyRunFamily({ debateTitle: 'Foo #scenario-7' })).toBe('scenario');
  });

  it('classifies the seed and ai-seed suffixes', () => {
    expect(classifyRunFamily({ debateTitle: 'Bar [seed-pitch-clock]' })).toBe('seed');
    expect(classifyRunFamily({ debateTitle: 'Bar [ai-seed-housing]' })).toBe('seed');
  });

  it('is case-insensitive', () => {
    expect(classifyRunFamily({ debateTitle: 'Foo [XAI-ADV 99]' })).toBe('xai_adv');
    expect(classifyRunFamily({ debateTitle: 'Foo [AI-Corpus 99]' })).toBe('ai_corpus');
  });
});

describe('classifyRunFamily — none / guard cases', () => {
  it('returns none for a normal human room title', () => {
    expect(classifyRunFamily({ debateTitle: 'Should cities ban cars downtown?' })).toBe('none');
  });

  it('returns none for null / undefined / empty / whitespace', () => {
    expect(classifyRunFamily({ debateTitle: null })).toBe('none');
    expect(classifyRunFamily({ debateTitle: undefined })).toBe('none');
    expect(classifyRunFamily({ debateTitle: '' })).toBe('none');
    expect(classifyRunFamily({ debateTitle: '   ' })).toBe('none');
  });

  it('does NOT mis-bucket a body that merely mentions a family word', () => {
    // "stress" appears as ordinary prose, not as a bracketed suffix token.
    expect(classifyRunFamily({ debateTitle: 'Does work stress harm health?' })).toBe('none');
    expect(classifyRunFamily({ debateTitle: 'A seed of doubt about housing policy' })).toBe('none');
    expect(classifyRunFamily({ debateTitle: 'The scenario where everyone wins' })).toBe('none');
  });

  it('prefers the dash-compound family over the single-word one', () => {
    // ai-corpus must win even though "corpus" alone is not a family.
    expect(classifyRunFamily({ debateTitle: 'X [ai-corpus 1]' })).toBe('ai_corpus');
    // xai-adv must win regardless of any later token.
    expect(classifyRunFamily({ debateTitle: 'X [xai-adv stress 1]' })).toBe('xai_adv');
  });
});

describe('runFamilyMatchesFilter', () => {
  it('the all sentinel matches every family', () => {
    for (const fam of RUN_FAMILIES) {
      expect(runFamilyMatchesFilter(fam, 'all')).toBe(true);
    }
  });

  it('a specific family filter matches only that family', () => {
    expect(runFamilyMatchesFilter('xai_adv', 'xai_adv')).toBe(true);
    expect(runFamilyMatchesFilter('stress', 'xai_adv')).toBe(false);
    expect(runFamilyMatchesFilter('none', 'none')).toBe(true);
    expect(runFamilyMatchesFilter('ai_corpus', 'none')).toBe(false);
  });
});

describe('coerceRunTagFilterValue', () => {
  it('passes through every valid filter value', () => {
    for (const v of RUN_TAG_FILTER_VALUES) {
      expect(coerceRunTagFilterValue(v)).toBe(v);
    }
  });

  it('falls back to all for unknown / wrong-typed values', () => {
    expect(coerceRunTagFilterValue('not-a-family')).toBe('all');
    expect(coerceRunTagFilterValue(42)).toBe('all');
    expect(coerceRunTagFilterValue(null)).toBe('all');
    expect(coerceRunTagFilterValue(undefined)).toBe('all');
    expect(coerceRunTagFilterValue({})).toBe('all');
  });
});

describe('label / hint coverage + doctrine (plain language, no verdicts)', () => {
  const VERDICT_TOKENS = [
    'winner', 'loser', 'liar', 'true', 'false', 'correct', 'wrong',
    'dishonest', 'bad faith', 'manipulative', 'extremist', 'propagandist',
    'stupid', 'idiot', 'truth',
  ];

  it('every filter value has a non-empty label and hint', () => {
    for (const v of RUN_TAG_FILTER_VALUES) {
      const value = v as RunTagFilterValue;
      expect(RUN_TAG_FILTER_LABELS[value].length).toBeGreaterThan(0);
      expect(RUN_TAG_FILTER_HINTS[value].length).toBeGreaterThan(0);
    }
  });

  it('no label or hint leaks an internal snake_case code', () => {
    for (const v of RUN_TAG_FILTER_VALUES) {
      const value = v as RunTagFilterValue;
      expect(RUN_TAG_FILTER_LABELS[value]).not.toMatch(/[a-z]+_[a-z]+/);
      expect(RUN_TAG_FILTER_HINTS[value]).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });

  it('no label or hint contains a verdict token', () => {
    for (const v of RUN_TAG_FILTER_VALUES) {
      const value = v as RunTagFilterValue;
      const text = `${RUN_TAG_FILTER_LABELS[value]} ${RUN_TAG_FILTER_HINTS[value]}`.toLowerCase();
      for (const banned of VERDICT_TOKENS) {
        expect(text).not.toContain(banned);
      }
    }
  });

  it('RUN_FAMILIES is the RUN_TAG_FILTER_VALUES set minus the all sentinel', () => {
    const familiesFromValues = RUN_TAG_FILTER_VALUES.filter((v) => v !== 'all');
    expect([...RUN_FAMILIES]).toEqual([...familiesFromValues] as RunFamily[]);
  });
});
