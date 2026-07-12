/**
 * UX-PR-G (#920) — fixtureTagRegistry pure-model tests.
 *
 * The ONE canonical fixture-tag registry: predicate (looksLikeBotSeedTag),
 * display-strip (stripFixtureTag), viewer gate (shouldHideFixtureForViewer),
 * and the debate id-set collector (collectFixtureDebateIds). Covers the four
 * tag families (xai-adv / ai-corpus / stress / reseed), the bracket
 * false-positive negatives, and the null / empty / bare-tag edges.
 */
import {
  FIXTURE_SUFFIX_TAG_PATTERNS,
  looksLikeBotSeedTag,
  stripFixtureTag,
  shouldHideFixtureForViewer,
  collectFixtureDebateIds,
} from '../src/features/debates/fixtureTagRegistry';

describe('FIXTURE_SUFFIX_TAG_PATTERNS', () => {
  it('is a frozen non-empty pattern family', () => {
    expect(Object.isFrozen(FIXTURE_SUFFIX_TAG_PATTERNS)).toBe(true);
    expect(FIXTURE_SUFFIX_TAG_PATTERNS.length).toBeGreaterThan(0);
    for (const re of FIXTURE_SUFFIX_TAG_PATTERNS) {
      expect(re).toBeInstanceOf(RegExp);
    }
  });
});

describe('looksLikeBotSeedTag', () => {
  it('recognises the xai-adv / ai-corpus / stress families', () => {
    expect(looksLikeBotSeedTag('Bike lanes are better [xai-adv 9018694f c45188c5]')).toBe(true);
    expect(looksLikeBotSeedTag('Pitch clock changed pacing [ai-corpus fa172432 ai-seed]')).toBe(true);
    expect(looksLikeBotSeedTag('Sports debate [stress-2026-05-17 #scenario-7]')).toBe(true);
  });

  it('recognises the reseed family (the drift the consolidation fixes)', () => {
    expect(looksLikeBotSeedTag('Remote work productivity [reseed-baseline-20260708-1a2b3c4d]')).toBe(true);
    expect(looksLikeBotSeedTag('Nuclear power tradeoffs [reseed-sonnet-20260708-deadbeef]')).toBe(true);
    expect(looksLikeBotSeedTag('Housing supply [reseed-some-scenario-20260708-00ab12cd]')).toBe(true);
  });

  it('does NOT flag a legit title that merely contains a bracket', () => {
    expect(looksLikeBotSeedTag('[2024] budget debate')).toBe(false);
    expect(looksLikeBotSeedTag('Re: [urgent] housing')).toBe(false);
    expect(looksLikeBotSeedTag('Should cities expand bike lanes?')).toBe(false);
    // Mentions reseed in prose but carries no trailing fixture tag.
    expect(looksLikeBotSeedTag('A talk about how to reseed your lawn in spring')).toBe(false);
  });

  it('returns false for null / undefined / empty / whitespace', () => {
    expect(looksLikeBotSeedTag(null)).toBe(false);
    expect(looksLikeBotSeedTag(undefined)).toBe(false);
    expect(looksLikeBotSeedTag('')).toBe(false);
    expect(looksLikeBotSeedTag('   ')).toBe(false);
  });
});

describe('stripFixtureTag', () => {
  it('strips a trailing fixture tag for display', () => {
    expect(stripFixtureTag('Chime cohort smoke [stress chime-mrgpodh6]')).toBe('Chime cohort smoke');
    expect(stripFixtureTag('Bike lanes are better [xai-adv 9018694f c45188c5]')).toBe('Bike lanes are better');
    expect(stripFixtureTag('Remote work productivity [reseed-baseline-20260708-1a2b3c4d]')).toBe('Remote work productivity');
  });

  it('returns the whitespace-normalised original when no tag matches', () => {
    expect(stripFixtureTag('Should cities expand bike lanes?')).toBe('Should cities expand bike lanes?');
    expect(stripFixtureTag('  spaced   title  ')).toBe('spaced title');
    expect(stripFixtureTag('[2024] budget debate')).toBe('[2024] budget debate');
  });

  it('can return empty string only for a bare-tag title (callers fall back)', () => {
    expect(stripFixtureTag('[stress chime-mrgpodh6]')).toBe('');
  });

  it('handles null / undefined without throwing', () => {
    expect(stripFixtureTag(null)).toBe('');
    expect(stripFixtureTag(undefined)).toBe('');
  });
});

describe('shouldHideFixtureForViewer', () => {
  it('hides a fixture room for a NON-admin only', () => {
    const title = 'Bike lanes [xai-adv 9018694f]';
    expect(shouldHideFixtureForViewer({ title, isAdminViewer: false })).toBe(true);
    expect(shouldHideFixtureForViewer({ title, isAdminViewer: true })).toBe(false);
  });

  it('never hides a legit title regardless of viewer', () => {
    const title = 'Should cities expand bike lanes?';
    expect(shouldHideFixtureForViewer({ title, isAdminViewer: false })).toBe(false);
    expect(shouldHideFixtureForViewer({ title, isAdminViewer: true })).toBe(false);
  });
});

describe('collectFixtureDebateIds', () => {
  it('collects only the fixture-tagged debate ids from the RAW titles', () => {
    const debates = [
      { id: 'd1', title: 'Bike lanes [xai-adv 9018694f]' },
      { id: 'd2', title: 'Should cities expand bike lanes?' },
      { id: 'd3', title: 'Housing [reseed-baseline-20260708-1a2b3c4d]' },
      { id: 'd4', title: '[2024] budget debate' },
    ];
    const ids = collectFixtureDebateIds(debates);
    expect(ids.has('d1')).toBe(true);
    expect(ids.has('d3')).toBe(true);
    expect(ids.has('d2')).toBe(false);
    expect(ids.has('d4')).toBe(false);
    expect(ids.size).toBe(2);
  });

  it('returns an empty set for an empty / non-array input', () => {
    expect(collectFixtureDebateIds([]).size).toBe(0);
    // Defensive: a non-array input never throws.
    expect(collectFixtureDebateIds(null as unknown as []).size).toBe(0);
  });
});
