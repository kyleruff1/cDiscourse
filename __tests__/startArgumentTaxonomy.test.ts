/**
 * NAV-START-ARGUMENT-001 Slice A — Start Argument taxonomy contract tests.
 *
 * Pure-model tests. Assert:
 *   - the verified scheme set (5 schemes + unspecified),
 *   - the cause set (informant / information / uncertainty + unspecified),
 *   - the HiTODS list does NOT claim complete 18-strategy coverage,
 *   - all labels + descriptions are neutral / non-verdict (ban-list),
 *   - no suppression / moderation copy,
 *   - the route-alias resolver maps canonical + both legacy aliases to the
 *     same Start Argument target.
 */
import {
  ARGUMENT_SCHEME_OPTIONS,
  DISAGREEMENT_CAUSE_OPTIONS,
  DISAGREEMENT_STRATEGY_OPTIONS,
  DISAGREEMENT_CLUSTER_LABELS,
  DISAGREEMENT_STRATEGY_LIST_IS_COMPLETE,
  HITODS_TOTAL_STRATEGY_COUNT,
  VERIFIED_DISAGREEMENT_STRATEGY_IDS,
  ALL_START_ARGUMENT_SURFACES,
  isStartArgumentDraftSubmittable,
  groupDisagreementStrategiesByCluster,
  type DisagreementStrategyId,
} from '../src/features/arguments/startArgument/startArgumentTaxonomy';
import {
  START_ARGUMENT_CANONICAL_ROUTE,
  START_ARGUMENT_ALIAS_ROUTES,
  START_ARGUMENT_ALL_ROUTES,
  START_ARGUMENT_ROUTE_TARGET,
  isStartArgumentRoute,
  resolveStartArgumentRoute,
  normalizeStartArgumentPath,
} from '../src/features/arguments/startArgument/startArgumentRoutes';

// Verdict / suppression / moderation vocabulary that may NEVER appear in
// any user-facing taxonomy label or description (cdiscourse-doctrine §1).
const BANNED = [
  'truth',
  'winner',
  'loser',
  'correct',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'true',
  'false',
  // suppression / moderation copy must not leak into self-declared framing.
  'suppress',
  'moderate',
  'ban',
  'block',
  'hide',
  'delete',
  'censor',
  'flag',
];

function allTaxonomyStrings(): string[] {
  const out: string[] = [];
  for (const o of ARGUMENT_SCHEME_OPTIONS) out.push(o.label, o.description);
  for (const o of DISAGREEMENT_CAUSE_OPTIONS) out.push(o.label, o.description);
  for (const o of DISAGREEMENT_STRATEGY_OPTIONS) out.push(o.label, o.description);
  for (const v of Object.values(DISAGREEMENT_CLUSTER_LABELS)) out.push(v);
  return out;
}

describe('ARGUMENT_SCHEME_OPTIONS', () => {
  it('contains exactly the 5 verified schemes plus unspecified', () => {
    const ids = ARGUMENT_SCHEME_OPTIONS.map((o) => o.id);
    expect(ids).toEqual([
      'argument_from_example',
      'argument_from_cause_to_effect',
      'practical_reasoning',
      'argument_from_consequences',
      'argument_from_verbal_classification',
      'unspecified',
    ]);
  });

  it('the five non-unspecified options are the verified schemes', () => {
    const verified = ARGUMENT_SCHEME_OPTIONS.filter((o) => o.id !== 'unspecified');
    expect(verified).toHaveLength(5);
  });

  it('every option has a non-empty label and description', () => {
    for (const o of ARGUMENT_SCHEME_OPTIONS) {
      expect(o.label.length).toBeGreaterThan(0);
      expect(o.description.length).toBeGreaterThan(0);
    }
  });
});

describe('DISAGREEMENT_CAUSE_OPTIONS', () => {
  it('contains informant / information / uncertainty plus unspecified', () => {
    const ids = DISAGREEMENT_CAUSE_OPTIONS.map((o) => o.id);
    expect(ids).toEqual([
      'informant_related',
      'information_related',
      'uncertainty_related',
      'unspecified',
    ]);
  });

  it('every option has a non-empty label and description', () => {
    for (const o of DISAGREEMENT_CAUSE_OPTIONS) {
      expect(o.label.length).toBeGreaterThan(0);
      expect(o.description.length).toBeGreaterThan(0);
    }
  });
});

describe('DISAGREEMENT_STRATEGY_OPTIONS — verified HiTODS subset (no over-claim)', () => {
  it('is explicitly NOT the complete 18-strategy HiTODS list', () => {
    expect(DISAGREEMENT_STRATEGY_LIST_IS_COMPLETE).toBe(false);
  });

  it('ships fewer verified strategies than the full HiTODS count', () => {
    expect(VERIFIED_DISAGREEMENT_STRATEGY_IDS.length).toBeLessThan(HITODS_TOTAL_STRATEGY_COUNT);
  });

  it('the verified-id set matches the verified names exactly', () => {
    const expected: DisagreementStrategyId[] = [
      'complex_counter_argument',
      'dismantle',
      'related_joking',
      'reasoned_direct_denial',
      'proposing_alternative',
      'deafening_silence',
      'agree_to_disagree',
      'breakdown_of_dialogicity',
      'unreasoned_direct_denial',
      'ordering',
      'irrelevancy_claim',
      'ironic_echoing',
      'blatant_or_aggressive_denial',
    ];
    expect([...VERIFIED_DISAGREEMENT_STRATEGY_IDS].sort()).toEqual([...expected].sort());
  });

  it('the option list is the verified ids plus the unspecified escape hatch', () => {
    const optionIds = DISAGREEMENT_STRATEGY_OPTIONS.map((o) => o.id);
    expect(optionIds).toContain('unspecified');
    const nonUnspecified = optionIds.filter((id) => id !== 'unspecified');
    expect([...nonUnspecified].sort()).toEqual([...VERIFIED_DISAGREEMENT_STRATEGY_IDS].sort());
  });

  it('every verified strategy belongs to a known cluster', () => {
    const clusters = Object.keys(DISAGREEMENT_CLUSTER_LABELS);
    for (const o of DISAGREEMENT_STRATEGY_OPTIONS) {
      expect(clusters).toContain(o.cluster);
    }
  });

  it('grouping preserves every option under its cluster', () => {
    const groups = groupDisagreementStrategiesByCluster();
    const grouped = groups.flatMap((g) => g.options.map((o) => o.id));
    expect([...grouped].sort()).toEqual(
      [...DISAGREEMENT_STRATEGY_OPTIONS.map((o) => o.id)].sort(),
    );
    // Each group's options all carry that group's cluster.
    for (const g of groups) {
      for (const o of g.options) expect(o.cluster).toBe(g.cluster);
    }
  });
});

describe('doctrine ban-list — neutral, non-verdict copy', () => {
  it('no taxonomy label or description contains a verdict / suppression token', () => {
    for (const s of allTaxonomyStrings()) {
      const lower = s.toLowerCase();
      for (const banned of BANNED) {
        expect(lower).not.toContain(banned);
      }
    }
  });
});

describe('surfaces + draft submittability', () => {
  it('exposes exactly timeline + card surfaces', () => {
    expect([...ALL_START_ARGUMENT_SURFACES]).toEqual(['timeline', 'card']);
  });

  it('a draft is submittable only when the declaration has non-whitespace content', () => {
    expect(isStartArgumentDraftSubmittable({ declaration: '' })).toBe(false);
    expect(isStartArgumentDraftSubmittable({ declaration: '   \n\t ' })).toBe(false);
    expect(isStartArgumentDraftSubmittable({ declaration: 'Cars should yield to bikes.' })).toBe(true);
  });
});

describe('Start Argument route aliases', () => {
  it('canonical route is /start-argument', () => {
    expect(START_ARGUMENT_CANONICAL_ROUTE).toBe('/start-argument');
  });

  it('legacy New Argument paths are the aliases', () => {
    expect([...START_ARGUMENT_ALIAS_ROUTES].sort()).toEqual(['/arguments/new', '/new-argument']);
  });

  it('all routes = canonical + aliases', () => {
    expect([...START_ARGUMENT_ALL_ROUTES].sort()).toEqual(
      ['/arguments/new', '/new-argument', '/start-argument'].sort(),
    );
  });

  it('canonical and BOTH aliases resolve to the same Start Argument target', () => {
    expect(resolveStartArgumentRoute('/start-argument')).toBe(START_ARGUMENT_ROUTE_TARGET);
    expect(resolveStartArgumentRoute('/new-argument')).toBe(START_ARGUMENT_ROUTE_TARGET);
    expect(resolveStartArgumentRoute('/arguments/new')).toBe(START_ARGUMENT_ROUTE_TARGET);
  });

  it('normalizes trailing slash, case, query, and hash', () => {
    expect(normalizeStartArgumentPath('/New-Argument/')).toBe('/new-argument');
    expect(normalizeStartArgumentPath('/start-argument?from=gallery')).toBe('/start-argument');
    expect(normalizeStartArgumentPath('/arguments/new#top')).toBe('/arguments/new');
    expect(isStartArgumentRoute('/New-Argument/')).toBe(true);
  });

  it('an unrelated path does not resolve to Start Argument', () => {
    expect(resolveStartArgumentRoute('/account')).toBeNull();
    expect(isStartArgumentRoute('/arguments')).toBe(false);
    expect(resolveStartArgumentRoute(undefined)).toBeNull();
    expect(resolveStartArgumentRoute(42 as unknown)).toBeNull();
  });
});
