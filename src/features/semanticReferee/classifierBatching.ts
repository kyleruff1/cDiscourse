/**
 * MCP-012 — Semantic call router: classifier batching.
 *
 * `planClassifierBatches(requested)` turns a requested classifier-id set into a
 * list of provider-call batches, each ≤ `BATCH_CAP` (5) and order-normalized.
 * It returns a PLAN — it never calls a provider. Whether each batch is then a
 * cache hit or a real call is decided downstream (cache → budget → MCP-016
 * boundary).
 *
 * Cache-correctness guarantee: ids within every batch are lexically sorted, so
 * the same classifier set always plans identically — the same `hashClassifierSet`
 * result and the same cache key (MCP-012 design §"API contracts" #2).
 *
 * Pure TypeScript — no network, no Supabase, no React, no `Deno`, no env,
 * no `async`.
 */

import type { SemanticClassifierId } from './semanticRefereeTypes';

/**
 * Hard cap — MCP-001 §9/§12 five-classifier packet prompt limit. No emitted
 * batch ever exceeds this; the property is guaranteed by construction (every
 * batch group has ≤ 5 ids and a batch is a subset of one group).
 */
export const BATCH_CAP = 5 as const;

/**
 * The MCP-004 §"batching" groups — each ≤ 5; together partition the catalog.
 *
 * MCP-CAT-001 added groups F, G, H to carry the 12 new catalog v1 ids
 * (evidence applicability, qualified concessions, sub-axis, settlement). Each
 * new group respects `BATCH_CAP` (≤ 5 ids). The partition property
 * (`semanticBatching.test.ts`) is preserved: the union of all groups equals
 * `ALL_SEMANTIC_CLASSIFIER_IDS` exactly, no overlap, no omission. The catalog
 * design §14 reviewer-question #6 anticipated this — "with 12 new ids,
 * batching for post-submit moments may need to grow to 3 batches" — three new
 * groups land the 12 new ids without changing `BATCH_CAP`.
 */
export type SemanticBatchGroupId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

export interface SemanticBatchGroup {
  id: SemanticBatchGroupId;
  /** Plain-language group label — internal docs only, never user-reachable. */
  label: string;
  /** Length 1..5, ≤ BATCH_CAP. */
  classifierIds: readonly SemanticClassifierId[];
}

/** One planned provider call — an order-normalized classifier-id list ≤ BATCH_CAP. */
export type ClassifierBatch = readonly SemanticClassifierId[];

/**
 * The A-H batch groups (MCP-004 §"batching", extended by MCP-CAT-001). The
 * union of all `classifierIds` lists equals `ALL_SEMANTIC_CLASSIFIER_IDS`
 * exactly — 35 ids (catalog v1), no overlap, no omission.
 * `semanticBatching.test.ts` asserts the partition property against MCP-011's
 * catalog so the two cannot drift.
 */
export const SEMANTIC_BATCH_GROUPS: readonly SemanticBatchGroup[] = Object.freeze([
  Object.freeze({
    id: 'A',
    label: 'Parent continuity',
    classifierIds: Object.freeze([
      'responds_to_parent',
      'quote_anchors_parent',
      'answers_clarification',
      'introduces_new_issue',
    ] as const),
  }),
  Object.freeze({
    id: 'B',
    label: 'Branch routing and mode fit',
    classifierIds: Object.freeze([
      'suggests_side_branch',
      'suggests_diagonal_tangent',
      'fits_selected_debate_mode',
      'contains_unplayable_insult_only',
      'contains_playable_hot_take',
    ] as const),
  }),
  Object.freeze({
    id: 'C',
    label: 'Evidence pressure',
    classifierIds: Object.freeze([
      'asks_for_evidence',
      'provides_evidence',
      'evidence_supports_claim',
      'creates_source_chain_gap',
      'uses_popularity_as_evidence',
    ] as const),
  }),
  Object.freeze({
    id: 'D',
    label: 'Evidence provenance',
    classifierIds: Object.freeze([
      'cites_retraction',
      'uses_satire_as_evidence',
      'is_satire_or_parody',
      'narrows_claim',
      'concedes_narrow_point',
    ] as const),
  }),
  Object.freeze({
    id: 'E',
    label: 'Constructive movement and friction',
    classifierIds: Object.freeze([
      'requests_clarification',
      'ready_for_synthesis',
      'needs_pre_send_pause',
      'shifts_to_person_or_intent',
    ] as const),
  }),
  // ── MCP-CAT-001 (catalog v1) — three new groups for the 12 new ids ──
  Object.freeze({
    id: 'F',
    label: 'Evidence applicability and debt markers',
    classifierIds: Object.freeze([
      'disputes_evidence_applicability',
      'opens_evidence_debt_marker',
      'closes_evidence_debt_marker',
      'supplies_corroborating_document',
    ] as const),
  }),
  Object.freeze({
    id: 'G',
    label: 'Qualified concessions and structural anchors',
    classifierIds: Object.freeze([
      'accepts_partial_with_caveat',
      'provides_alternate_interpretation',
      'references_prior_agreement',
      'provides_temporal_constraint',
    ] as const),
  }),
  Object.freeze({
    id: 'H',
    label: 'Sub-axis introduction and settlement',
    classifierIds: Object.freeze([
      'introduces_sub_axis',
      'concedes_with_new_dispute',
      'proposes_settlement_terms',
      'accepts_settlement_terms',
    ] as const),
  }),
]);

/**
 * Per-trigger expectation (MCP-004 §"batching"): a single trigger's curated
 * classifier set is expected to span at most TWO groups — ≤ 2 batches,
 * ≤ 10 classifiers. `planClassifierBatches` itself does NOT enforce a 2-batch
 * ceiling (a 23-id request legitimately plans 5 batches); the *caller*
 * (MCP-002 / MCP-003) picks a per-moment set within the cap. This constant
 * documents that expectation for downstream callers and tests.
 */
export const EXPECTED_MAX_BATCHES_PER_TRIGGER = 2 as const;

/** Lexical string comparator — stable, no locale dependence. */
function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Plan provider-call batches for a requested classifier-id set.
 *
 * Algorithm:
 *   1. Normalize: dedupe (Set) then sort lexically. Empty → return [].
 *   2. For each group A..E in fixed order, emit the intersection (in sorted
 *      order) as one `ClassifierBatch` when non-empty.
 *   3. An id that belongs to no group (not in catalog v0) is silently dropped —
 *      the upstream caller validates ids; the batcher is defensive.
 *   4. Return the list of emitted batches.
 *
 * Properties (asserted by `semanticBatching.test.ts`):
 *   - No emitted batch exceeds `BATCH_CAP` — each group has ≤ 5 ids and a
 *     batch is a subset of one group.
 *   - Ids within each batch are lexically sorted (cache-correctness).
 *   - One group touched → one batch; three groups → three batches.
 *   - A reordered request plans identically.
 *   - It NEVER calls a provider — it returns a plan only.
 */
export function planClassifierBatches(
  requested: readonly SemanticClassifierId[],
): ClassifierBatch[] {
  // 1. Normalize the request: dedupe + lexical sort.
  const normalized = Array.from(new Set(requested.map((id) => String(id)))).sort(
    compareIds,
  );
  if (normalized.length === 0) {
    return [];
  }
  const normalizedSet = new Set<string>(normalized);

  // 2. For each group in fixed A..E order, emit the (sorted) intersection.
  const batches: ClassifierBatch[] = [];
  for (const group of SEMANTIC_BATCH_GROUPS) {
    // Group ids are already declared in a fixed order; sort the intersection
    // lexically so the emitted batch is order-normalized regardless of the
    // group's declaration order.
    const intersection = group.classifierIds
      .filter((id) => normalizedSet.has(id))
      .slice()
      .sort(compareIds);
    if (intersection.length > 0) {
      // 3. Unknown / non-catalog ids belong to no group, so they are never
      //    members of an intersection — silently dropped here.
      batches.push(Object.freeze(intersection));
    }
  }

  // 4. Return the plan.
  return batches;
}
