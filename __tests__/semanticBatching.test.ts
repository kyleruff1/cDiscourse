/**
 * MCP-012 — Semantic call router: classifier-batching tests.
 *
 * Asserts the BATCH_CAP, the partition property against MCP-011's catalog,
 * order-normalization, one-batch-per-group, reorder stability, empty / unknown
 * / full-catalog handling.
 */

import {
  BATCH_CAP,
  SEMANTIC_BATCH_GROUPS,
  planClassifierBatches,
  EXPECTED_MAX_BATCHES_PER_TRIGGER,
} from '../src/features/semanticReferee/classifierBatching';
import type { ClassifierBatch } from '../src/features/semanticReferee/classifierBatching';
import {
  ALL_SEMANTIC_CLASSIFIER_IDS,
} from '../src/features/semanticReferee/semanticRefereeTypes';
import type { SemanticClassifierId } from '../src/features/semanticReferee/semanticRefereeTypes';

describe('MCP-012 BATCH_CAP', () => {
  it('is exactly 5', () => {
    expect(BATCH_CAP).toBe(5);
  });
});

describe('MCP-012 SEMANTIC_BATCH_GROUPS — partition property', () => {
  it('has exactly eight groups A-H (catalog v1, post-MCP-CAT-001)', () => {
    expect(SEMANTIC_BATCH_GROUPS).toHaveLength(8);
    expect(SEMANTIC_BATCH_GROUPS.map((g) => g.id)).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
      'G',
      'H',
    ]);
  });

  it('each group has 4 or 5 classifier ids, never more than BATCH_CAP', () => {
    for (const group of SEMANTIC_BATCH_GROUPS) {
      expect(group.classifierIds.length).toBeGreaterThanOrEqual(4);
      expect(group.classifierIds.length).toBeLessThanOrEqual(BATCH_CAP);
    }
  });

  it('the union of all groups equals ALL_SEMANTIC_CLASSIFIER_IDS exactly', () => {
    const union = SEMANTIC_BATCH_GROUPS.flatMap((g) => g.classifierIds);
    const unionSet = new Set(union);
    const catalogSet = new Set(ALL_SEMANTIC_CLASSIFIER_IDS);
    // No omission.
    for (const id of catalogSet) {
      expect(unionSet.has(id)).toBe(true);
    }
    // No extra.
    for (const id of unionSet) {
      expect(catalogSet.has(id)).toBe(true);
    }
    // Same size — proves a clean partition.
    expect(unionSet.size).toBe(catalogSet.size);
    expect(catalogSet.size).toBe(35);
  });

  it('the groups are disjoint — no classifier id appears twice', () => {
    const union = SEMANTIC_BATCH_GROUPS.flatMap((g) => g.classifierIds);
    expect(union.length).toBe(new Set(union).size);
    expect(union.length).toBe(35);
  });
});

describe('MCP-012 planClassifierBatches — batch cap', () => {
  it('never emits a batch larger than BATCH_CAP for the full catalog', () => {
    const batches = planClassifierBatches(ALL_SEMANTIC_CLASSIFIER_IDS);
    for (const batch of batches) {
      expect(batch.length).toBeLessThanOrEqual(BATCH_CAP);
    }
  });

  it('never emits a batch larger than BATCH_CAP for random subsets', () => {
    // Deterministic pseudo-random subsets via a simple LCG.
    let seed = 12345;
    const next = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let run = 0; run < 50; run += 1) {
      const subset = ALL_SEMANTIC_CLASSIFIER_IDS.filter(() => next() < 0.5);
      const batches = planClassifierBatches(subset);
      for (const batch of batches) {
        expect(batch.length).toBeLessThanOrEqual(BATCH_CAP);
      }
    }
  });
});

describe('MCP-012 planClassifierBatches — order normalization', () => {
  it('emits classifier ids in lexical order within every batch', () => {
    const batches = planClassifierBatches(ALL_SEMANTIC_CLASSIFIER_IDS);
    for (const batch of batches) {
      const sorted = batch.slice().sort();
      expect(batch).toEqual(sorted);
    }
  });

  it('plans identically for a reordered request', () => {
    const a: SemanticClassifierId[] = ['responds_to_parent', 'quote_anchors_parent'];
    const b: SemanticClassifierId[] = ['quote_anchors_parent', 'responds_to_parent'];
    expect(planClassifierBatches(a)).toEqual(planClassifierBatches(b));
    expect(planClassifierBatches(a)).toEqual([
      ['quote_anchors_parent', 'responds_to_parent'],
    ]);
  });

  it('plans identically for the full catalog in reverse order', () => {
    const forward = planClassifierBatches(ALL_SEMANTIC_CLASSIFIER_IDS);
    const reversed = planClassifierBatches(
      ALL_SEMANTIC_CLASSIFIER_IDS.slice().reverse(),
    );
    expect(reversed).toEqual(forward);
  });
});

describe('MCP-012 planClassifierBatches — one batch per group touched', () => {
  it('a request touching only group A plans exactly one batch', () => {
    const groupA = SEMANTIC_BATCH_GROUPS[0].classifierIds;
    const batches = planClassifierBatches(groupA);
    expect(batches).toHaveLength(1);
    expect(batches[0].length).toBe(groupA.length);
  });

  it('a request touching three groups plans exactly three batches', () => {
    const request: SemanticClassifierId[] = [
      'responds_to_parent', //      group A
      'asks_for_evidence', //       group C
      'requests_clarification', //  group E
    ];
    const batches = planClassifierBatches(request);
    expect(batches).toHaveLength(3);
    for (const batch of batches) {
      expect(batch.length).toBe(1);
    }
  });

  it('the full catalog plans exactly eight batches A-H (catalog v1, post-MCP-CAT-001)', () => {
    const batches = planClassifierBatches(ALL_SEMANTIC_CLASSIFIER_IDS);
    expect(batches).toHaveLength(8);
  });

  it('emits batches in fixed A-H group order', () => {
    // Request one id from group E then one from group A — output order
    // follows A-H group order, not request order.
    const request: SemanticClassifierId[] = ['ready_for_synthesis', 'responds_to_parent'];
    const batches = planClassifierBatches(request);
    expect(batches).toHaveLength(2);
    expect(batches[0]).toEqual(['responds_to_parent']); //  group A first
    expect(batches[1]).toEqual(['ready_for_synthesis']); //  group E second
  });
});

describe('MCP-012 planClassifierBatches — edge cases', () => {
  it('returns [] for an empty request', () => {
    expect(planClassifierBatches([])).toEqual([]);
  });

  it('dedupes a duplicate id into a single-id batch', () => {
    const request = [
      'responds_to_parent',
      'responds_to_parent',
    ] as unknown as SemanticClassifierId[];
    const batches = planClassifierBatches(request);
    expect(batches).toEqual([['responds_to_parent']]);
  });

  it('silently drops an unknown / non-catalog id', () => {
    const request = [
      'responds_to_parent',
      'not_a_real_classifier',
    ] as unknown as SemanticClassifierId[];
    const batches = planClassifierBatches(request);
    expect(batches).toEqual([['responds_to_parent']]);
  });

  it('returns [] when every requested id is unknown', () => {
    const request = [
      'totally_made_up',
      'also_not_real',
    ] as unknown as SemanticClassifierId[];
    expect(planClassifierBatches(request)).toEqual([]);
  });
});

describe('MCP-012 planClassifierBatches — per-trigger expectation', () => {
  it('a curated two-group per-moment set plans at most EXPECTED_MAX_BATCHES_PER_TRIGGER batches', () => {
    expect(EXPECTED_MAX_BATCHES_PER_TRIGGER).toBe(2);
    // A realistic post_submit set spanning group A (parent continuity) and
    // group C (evidence pressure) — two groups → two batches.
    const curated: SemanticClassifierId[] = [
      'responds_to_parent',
      'introduces_new_issue',
      'asks_for_evidence',
      'provides_evidence',
    ];
    const batches: ClassifierBatch[] = planClassifierBatches(curated);
    expect(batches.length).toBeLessThanOrEqual(EXPECTED_MAX_BATCHES_PER_TRIGGER);
  });
});
