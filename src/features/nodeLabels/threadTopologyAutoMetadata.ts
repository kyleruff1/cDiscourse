/**
 * MCP-021A — Thread topology auto-metadata derivers (no-op stubs).
 *
 * Per design Decision 7 (binding): 4 Family I rawKeys are classified
 * `source: 'auto_metadata'` because they are deterministically derivable
 * from argument-tree structure alone:
 *   - splits_thread
 *   - merges_thread
 *   - references_sibling_node
 *   - references_ancestor_node
 *
 * MCP-021A SCOPE BOUNDARY: this file ships NO-OP STUBS only. The actual
 * deterministic derivers are MCP-021C territory. The stubs preserve
 * byte-equal runtime behavior with the registry's existing semantics
 * (`disposition: 'future_source'` → adapters return []).
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §10a — thread-topology observations are
 *     structural facts about argument-tree shape; never verdicts.
 *   - design §3.9 — "the registry slot is added with source:
 *     'auto_metadata', but no AutoMetadataCode union entry yet";
 *     consistent with existing pattern where the registry can describe
 *     a slot whose deriver lives elsewhere.
 *   - design §11 — MCP-021A allowed new file; no-op until MCP-021C.
 *
 * Pure TS. No React, no Supabase, no network. JSON-serializable inputs
 * and outputs. The stubs return [] / null deterministically per design.
 */

import type { NodeLabelMark } from './nodeLabelTypes';

// ── Input shapes (forward-compatible with MCP-021C) ──────────────

/**
 * MCP-021A — Input shape for thread-topology derivers. Forward-compatible:
 * MCP-021C will pass argument-tree slices here for real deterministic
 * derivation. MCP-021A stubs ignore the input and return [].
 */
export interface ThreadTopologyAutoMetadataInput {
  /** The move being classified. */
  nodeId: string;

  /** The move's parent (null for root). */
  parentNodeId: string | null;

  /** All sibling IDs (same parent). MCP-021A stub ignores. */
  siblingNodeIds?: ReadonlyArray<string>;

  /** All ancestor IDs (root → ... → parent). MCP-021A stub ignores. */
  ancestorNodeIds?: ReadonlyArray<string>;

  /** Cross-branch references this move contains. MCP-021A stub ignores. */
  crossReferences?: ReadonlyArray<{ targetNodeId: string }>;
}

// ── Deriver stubs (no-op in MCP-021A) ────────────────────────────

/**
 * MCP-021A — splits_thread deriver stub.
 *
 * Returns [] unconditionally per Decision 7 scope rule. MCP-021C will
 * derive: returns a `splits_thread` NodeLabelMark when the parent has
 * ≥2 children (this move is one of them).
 *
 * Test contract (MCP-021A): the stub returns [] for every input.
 */
export function deriveSplitsThread(
  _input: ThreadTopologyAutoMetadataInput,
): NodeLabelMark[] {
  return [];
}

/**
 * MCP-021A — merges_thread deriver stub.
 *
 * Returns [] unconditionally per Decision 7 scope rule. MCP-021C will
 * derive: returns a `merges_thread` NodeLabelMark when the move
 * references an ancestor from a different branch (cross-branch merge).
 */
export function deriveMergesThread(
  _input: ThreadTopologyAutoMetadataInput,
): NodeLabelMark[] {
  return [];
}

/**
 * MCP-021A — references_sibling_node deriver stub.
 *
 * Returns [] unconditionally per Decision 7 scope rule. MCP-021C will
 * derive: returns a `references_sibling_node` NodeLabelMark when the
 * move contains a cross-reference to any sibling (same parent).
 */
export function deriveReferencesSiblingNode(
  _input: ThreadTopologyAutoMetadataInput,
): NodeLabelMark[] {
  return [];
}

/**
 * MCP-021A — references_ancestor_node deriver stub.
 *
 * Returns [] unconditionally per Decision 7 scope rule. MCP-021C will
 * derive: returns a `references_ancestor_node` NodeLabelMark when the
 * move contains a cross-reference to any ancestor beyond its immediate
 * parent (grandparent or higher).
 */
export function deriveReferencesAncestorNode(
  _input: ThreadTopologyAutoMetadataInput,
): NodeLabelMark[] {
  return [];
}

/**
 * MCP-021A — Convenience aggregator. Returns [] unconditionally.
 *
 * MCP-021C will run all 4 derivers in sequence and concatenate the
 * non-empty marks. The aggregator's MCP-021A behavior is `return []`
 * to preserve byte-equal post-merge runtime behavior with the no-op
 * stubs above.
 */
export function deriveAllThreadTopologyAutoMetadata(
  input: ThreadTopologyAutoMetadataInput,
): NodeLabelMark[] {
  // Stub composition: call each stub for forward-compat coverage,
  // then return concatenation. Each stub returns [] in MCP-021A, so
  // the concatenation is also [].
  return [
    ...deriveSplitsThread(input),
    ...deriveMergesThread(input),
    ...deriveReferencesSiblingNode(input),
    ...deriveReferencesAncestorNode(input),
  ];
}
