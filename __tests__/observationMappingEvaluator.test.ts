/**
 * MCP-OBSERVATION-MAPPING-EXPANSION-001 (Slice A) — evaluator unit tests.
 *
 * Covers every rule kind, absence semantics, composite-supersedes-singles
 * (OQ-c), determinism, non-mutation, empty/unknown input, and the surface
 * filter. Pure-model tests: import the model directly, no React/Supabase.
 */

import { evaluateObservationMapping } from '../src/features/nodeLabels/observationMapping/observationMappingEvaluator';
import type {
  ObservationMappingResult,
  ObservationMappingRule,
} from '../src/features/nodeLabels/observationMapping/observationMappingTypes';

const SAFETY = 'Display-only machine observation. Do not block, reject, suppress, route, or delay a post from this rule.';

function rule(partial: Partial<ObservationMappingRule>): ObservationMappingRule {
  return {
    mappingId: 'TEST-0001',
    familyKey: 'parent_relation',
    ruleKind: 'single_true',
    requiredTrueFlags: ['challenges_parent'],
    requiredFalseFlags: [],
    observationCode: 'test.code.unmapped_xyz',
    labelShort: 'Test short',
    labelNeutral: 'Test neutral label',
    diagnosticSentence: 'This reply does a test thing.',
    displayPriority: 100,
    confidencePip: 'medium',
    cardSurfaceVisibility: 'card_default_visible',
    timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    safetyNote: SAFETY,
    ...partial,
  };
}

describe('evaluateObservationMapping — rule kinds', () => {
  it('single_true fires when the rawKey is positive', () => {
    const out = evaluateObservationMapping(
      ['challenges_parent'],
      [rule({})],
      { surface: 'card' },
    );
    expect(out).toHaveLength(1);
    expect(out[0].mappingId).toBe('TEST-0001');
    expect(out[0].ruleKind).toBe('single_true');
  });

  it('single_true does NOT fire when the rawKey is absent', () => {
    const out = evaluateObservationMapping(['other_flag'], [rule({})], {
      surface: 'card',
    });
    expect(out).toHaveLength(0);
  });

  it('single_false fires ONLY when the flag is absent (absence semantics)', () => {
    const r = rule({
      mappingId: 'NEG-0001',
      ruleKind: 'single_false',
      requiredTrueFlags: [],
      requiredFalseFlags: ['provides_evidence'],
      observationCode: 'test.neg.unmapped_xyz',
    });
    // Absent → fires (needs at least one positive in the set so the evaluator
    // runs — use an unrelated positive).
    const fires = evaluateObservationMapping(['some_other_positive'], [r], {
      surface: 'card',
    });
    expect(fires).toHaveLength(1);
    // Present → does not fire.
    const noFire = evaluateObservationMapping(['provides_evidence'], [r], {
      surface: 'card',
    });
    expect(noFire).toHaveLength(0);
  });

  it('pair_true_true fires only when BOTH rawKeys are positive', () => {
    const r = rule({
      mappingId: 'PTT-0001',
      ruleKind: 'pair_true_true',
      requiredTrueFlags: ['challenges_parent', 'quote_anchors_parent'],
    });
    expect(
      evaluateObservationMapping(
        ['challenges_parent', 'quote_anchors_parent'],
        [r],
        { surface: 'card' },
      ),
    ).toHaveLength(1);
    expect(
      evaluateObservationMapping(['challenges_parent'], [r], { surface: 'card' }),
    ).toHaveLength(0);
  });

  it('pair_true_false (asymmetric) fires when first present AND second absent', () => {
    const r = rule({
      mappingId: 'PTF-0001',
      ruleKind: 'pair_true_false',
      requiredTrueFlags: ['challenges_parent'],
      requiredFalseFlags: ['quote_anchors_parent'],
    });
    expect(
      evaluateObservationMapping(['challenges_parent'], [r], { surface: 'card' }),
    ).toHaveLength(1);
    // second present → no fire
    expect(
      evaluateObservationMapping(
        ['challenges_parent', 'quote_anchors_parent'],
        [r],
        { surface: 'card' },
      ),
    ).toHaveLength(0);
  });

  it('pair_false_true (asymmetric) fires when first absent AND second present', () => {
    const r = rule({
      mappingId: 'PFT-0001',
      ruleKind: 'pair_false_true',
      requiredTrueFlags: ['asks_for_evidence'],
      requiredFalseFlags: ['has_evidence'],
    });
    expect(
      evaluateObservationMapping(['asks_for_evidence'], [r], { surface: 'card' }),
    ).toHaveLength(1);
    expect(
      evaluateObservationMapping(['asks_for_evidence', 'has_evidence'], [r], {
        surface: 'card',
      }),
    ).toHaveLength(0);
  });

  it('curated_triple fires only when all three rawKeys are positive', () => {
    const r = rule({
      mappingId: 'TRI-0001',
      ruleKind: 'curated_triple',
      requiredTrueFlags: ['a_flag', 'b_flag', 'c_flag'],
    });
    expect(
      evaluateObservationMapping(['a_flag', 'b_flag', 'c_flag'], [r], {
        surface: 'card',
      }),
    ).toHaveLength(1);
    expect(
      evaluateObservationMapping(['a_flag', 'b_flag'], [r], { surface: 'card' }),
    ).toHaveLength(0);
  });

  it('cross_family fires across two families on the right rawKey set', () => {
    const r = rule({
      mappingId: 'XF-0001',
      familyKey: 'disagreement_axis+evidence_source_chain',
      ruleKind: 'cross_family',
      requiredTrueFlags: ['disputes_evidence_applicability', 'provides_evidence'],
    });
    expect(
      evaluateObservationMapping(
        ['disputes_evidence_applicability', 'provides_evidence'],
        [r],
        { surface: 'card' },
      ),
    ).toHaveLength(1);
  });
});

describe('evaluateObservationMapping — composite-supersedes-singles (OQ-c)', () => {
  it('a curated_triple suppresses the singles whose rawKeys it fully consumes', () => {
    const single = rule({
      mappingId: 'S-challenges',
      ruleKind: 'single_true',
      requiredTrueFlags: ['challenges_parent'],
      displayPriority: 100,
    });
    const triple = rule({
      mappingId: 'T-anchored',
      ruleKind: 'curated_triple',
      requiredTrueFlags: ['challenges_parent', 'quote_anchors_parent', 'corrects_parent_detail'],
      displayPriority: 70,
    });
    const out = evaluateObservationMapping(
      ['challenges_parent', 'quote_anchors_parent', 'corrects_parent_detail'],
      [single, triple],
      { surface: 'card' },
    );
    const ids = out.map((m) => m.mappingId);
    expect(ids).toContain('T-anchored');
    expect(ids).not.toContain('S-challenges'); // consumed by the triple
  });

  it('a pair suppresses the single whose rawKey it consumes', () => {
    const single = rule({
      mappingId: 'S-challenges',
      ruleKind: 'single_true',
      requiredTrueFlags: ['challenges_parent'],
    });
    const pair = rule({
      mappingId: 'P-anchored',
      ruleKind: 'pair_true_true',
      requiredTrueFlags: ['challenges_parent', 'quote_anchors_parent'],
      displayPriority: 78,
    });
    const out = evaluateObservationMapping(
      ['challenges_parent', 'quote_anchors_parent'],
      [single, pair],
      { surface: 'card' },
    );
    const ids = out.map((m) => m.mappingId);
    expect(ids).toContain('P-anchored');
    expect(ids).not.toContain('S-challenges');
  });

  it('an uncovered single still renders alongside a composite', () => {
    const consumedSingle = rule({
      mappingId: 'S-consumed',
      ruleKind: 'single_true',
      requiredTrueFlags: ['challenges_parent'],
    });
    const uncoveredSingle = rule({
      mappingId: 'S-uncovered',
      ruleKind: 'single_true',
      requiredTrueFlags: ['refines_parent'],
      displayPriority: 120,
    });
    const pair = rule({
      mappingId: 'P-anchored',
      ruleKind: 'pair_true_true',
      requiredTrueFlags: ['challenges_parent', 'quote_anchors_parent'],
      displayPriority: 78,
    });
    const out = evaluateObservationMapping(
      ['challenges_parent', 'quote_anchors_parent', 'refines_parent'],
      [consumedSingle, uncoveredSingle, pair],
      { surface: 'card' },
    );
    const ids = out.map((m) => m.mappingId);
    expect(ids).toContain('P-anchored');
    expect(ids).toContain('S-uncovered'); // refines_parent not consumed
    expect(ids).not.toContain('S-consumed');
  });

  it('a single_false (negative) is never suppressed by a composite', () => {
    const neg = rule({
      mappingId: 'NEG-keep',
      ruleKind: 'single_false',
      requiredTrueFlags: [],
      requiredFalseFlags: ['has_evidence'],
      displayPriority: 110,
    });
    const pair = rule({
      mappingId: 'P-anchored',
      ruleKind: 'pair_true_true',
      requiredTrueFlags: ['challenges_parent', 'quote_anchors_parent'],
      displayPriority: 78,
    });
    const out = evaluateObservationMapping(
      ['challenges_parent', 'quote_anchors_parent'],
      [neg, pair],
      { surface: 'card' },
    );
    const ids = out.map((m) => m.mappingId);
    expect(ids).toContain('NEG-keep');
    expect(ids).toContain('P-anchored');
  });
});

describe('evaluateObservationMapping — ordering / determinism / purity', () => {
  it('orders by displayPriority asc then mappingId', () => {
    const a = rule({ mappingId: 'B-second', requiredTrueFlags: ['f1'], displayPriority: 50 });
    const b = rule({ mappingId: 'A-third', requiredTrueFlags: ['f2'], displayPriority: 90 });
    const c = rule({ mappingId: 'C-first', requiredTrueFlags: ['f3'], displayPriority: 10 });
    const out = evaluateObservationMapping(['f1', 'f2', 'f3'], [a, b, c], {
      surface: 'card',
    });
    expect(out.map((m) => m.mappingId)).toEqual(['C-first', 'B-second', 'A-third']);
  });

  it('is deterministic — same input → JSON-equal output', () => {
    const rules = [
      rule({ mappingId: 'X', requiredTrueFlags: ['f1'], displayPriority: 30 }),
      rule({ mappingId: 'Y', requiredTrueFlags: ['f2'], displayPriority: 20 }),
    ];
    const first = evaluateObservationMapping(['f1', 'f2'], rules, { surface: 'card' });
    const second = evaluateObservationMapping(['f1', 'f2'], rules, { surface: 'card' });
    expect(JSON.stringify(first)).toEqual(JSON.stringify(second));
  });

  it('does not mutate the input set or rules array', () => {
    const inputSet = new Set(['challenges_parent']);
    const snapshotSet = [...inputSet];
    const rules = [rule({})];
    const snapshotRules = JSON.parse(JSON.stringify(rules));
    evaluateObservationMapping(inputSet, rules, { surface: 'card' });
    expect([...inputSet]).toEqual(snapshotSet);
    expect(JSON.parse(JSON.stringify(rules))).toEqual(snapshotRules);
  });

  it('returns a result whose every value is JSON-serializable (no functions)', () => {
    const out = evaluateObservationMapping(['challenges_parent'], [rule({})], {
      surface: 'card',
    });
    const round = JSON.parse(JSON.stringify(out)) as ObservationMappingResult[];
    expect(round).toEqual(out);
  });
});

describe('evaluateObservationMapping — edge cases / inputs', () => {
  it('empty positive set → []', () => {
    expect(evaluateObservationMapping([], [rule({})], { surface: 'card' })).toEqual([]);
    expect(
      evaluateObservationMapping(new Set<string>(), [rule({})], { surface: 'card' }),
    ).toEqual([]);
  });

  it('null/undefined positive keys → []', () => {
    expect(evaluateObservationMapping(null, [rule({})], { surface: 'card' })).toEqual([]);
    expect(
      evaluateObservationMapping(undefined, [rule({})], { surface: 'card' }),
    ).toEqual([]);
  });

  it('empty/null rules → []', () => {
    expect(evaluateObservationMapping(['challenges_parent'], [], { surface: 'card' })).toEqual([]);
    expect(
      evaluateObservationMapping(['challenges_parent'], null, { surface: 'card' }),
    ).toEqual([]);
  });

  it('unknown rawKeys are ignored (do not fire unrelated rules)', () => {
    const out = evaluateObservationMapping(
      ['totally_unknown_rawkey'],
      [rule({})],
      { surface: 'card' },
    );
    expect(out).toEqual([]);
  });

  it('accepts both Set and array inputs identically', () => {
    const arr = evaluateObservationMapping(['challenges_parent'], [rule({})], {
      surface: 'card',
    });
    const set = evaluateObservationMapping(new Set(['challenges_parent']), [rule({})], {
      surface: 'card',
    });
    expect(JSON.stringify(arr)).toEqual(JSON.stringify(set));
  });

  it('ignores empty-string entries in array input', () => {
    const out = evaluateObservationMapping(
      ['', 'challenges_parent', ''],
      [rule({})],
      { surface: 'card' },
    );
    expect(out).toHaveLength(1);
  });
});

describe('evaluateObservationMapping — surface filter', () => {
  it('card surface drops timeline_hidden / card_hidden rules', () => {
    const cardOnly = rule({
      mappingId: 'CARD-ONLY',
      requiredTrueFlags: ['f1'],
      cardSurfaceVisibility: 'card_default_visible',
      timelineSurfaceVisibility: 'timeline_hidden',
    });
    const timelineOnly = rule({
      mappingId: 'TL-ONLY',
      requiredTrueFlags: ['f2'],
      cardSurfaceVisibility: 'card_hidden',
      timelineSurfaceVisibility: 'timeline_tap_to_reveal',
    });
    const card = evaluateObservationMapping(['f1', 'f2'], [cardOnly, timelineOnly], {
      surface: 'card',
    });
    expect(card.map((m) => m.mappingId)).toEqual(['CARD-ONLY']);
    const tl = evaluateObservationMapping(['f1', 'f2'], [cardOnly, timelineOnly], {
      surface: 'timeline',
    });
    expect(tl.map((m) => m.mappingId)).toEqual(['TL-ONLY']);
  });

  it('an invalid surface → []', () => {
    const out = evaluateObservationMapping(
      ['challenges_parent'],
      [rule({})],
      // @ts-expect-error — invalid surface guarded at runtime
      { surface: 'inspect' },
    );
    expect(out).toEqual([]);
  });
});

describe('evaluateObservationMapping — confidence pips, not numbers', () => {
  it('every result carries a pip level, never a numeric confidence', () => {
    const out = evaluateObservationMapping(['challenges_parent'], [rule({})], {
      surface: 'card',
    });
    expect(out[0].confidencePip).toBe('medium');
    expect(['low', 'medium', 'high']).toContain(out[0].confidencePip);
    // No numeric confidence field exists on the result.
    const rec = out[0] as unknown as Record<string, unknown>;
    expect(rec.confidenceWeight).toBeUndefined();
    expect(rec.confidence).toBeUndefined();
  });
});
