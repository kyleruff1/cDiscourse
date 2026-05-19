/**
 * LIFE-001 — Cluster + axis helpers.
 *
 * Pure TS. No React, no Supabase, no network.
 *
 * Doctrine: these helpers read existing surface-model fields. They NEVER
 * re-derive `MessageCategory`, never re-classify a challenge axis from
 * scratch, never read `standingBand` / `toneBand` / `temperatureBand` /
 * `topicScore` / any AI annotation.
 */

import type { ArgumentTimelineMapNode } from '../arguments/argumentGameSurfaceModel';
import type { PointLifecycleAxis } from './pointLifecycleModel';

/**
 * Returns true when the node carries a qualifier code in `droppedTags`.
 * Reads only `node.droppedTags[].code` (already populated upstream by
 * `mapDroppedTags`). Never calls `deriveMessageCategory` or any qualifier
 * deriver — strictly read-only.
 */
export function nodeHasQualifierCode(node: ArgumentTimelineMapNode, code: string): boolean {
  const target = String(code || '').toLowerCase();
  for (const tag of node.droppedTags || []) {
    if (String(tag.code || '').toLowerCase() === target) return true;
  }
  return false;
}

/** Group the timeline map's nodes by `branchRootMessageId`. */
export function groupNodesByCluster(
  nodes: ReadonlyArray<ArgumentTimelineMapNode>,
): ReadonlyMap<string, ReadonlyArray<ArgumentTimelineMapNode>> {
  const out = new Map<string, ArgumentTimelineMapNode[]>();
  for (const n of nodes) {
    const cid = n.branchRootMessageId || n.messageId;
    if (!out.has(cid)) out.set(cid, []);
    out.get(cid)!.push(n);
  }
  // Freeze inner arrays to communicate intent (immutable per cluster).
  const frozen = new Map<string, ReadonlyArray<ArgumentTimelineMapNode>>();
  for (const [k, v] of out.entries()) {
    frozen.set(k, Object.freeze(v.slice()));
  }
  return frozen;
}

/**
 * Walk parent chain to find a same-axis ancestor in the same cluster.
 * Returns the first matching ancestor node, or null when no ancestor in
 * the cluster shares the axis.
 */
export function findSameAxisAncestor(
  node: ArgumentTimelineMapNode,
  axis: PointLifecycleAxis,
  clusterMembers: ReadonlyArray<ArgumentTimelineMapNode>,
  nodeById: ReadonlyMap<string, ArgumentTimelineMapNode>,
): ArgumentTimelineMapNode | null {
  const clusterIds = new Set<string>();
  for (const m of clusterMembers) clusterIds.add(m.messageId);
  let cursor: ArgumentTimelineMapNode | null = node;
  let depth = 0;
  const MAX_DEPTH = 200; // defensive cycle bound
  while (cursor && depth < MAX_DEPTH) {
    if (!cursor.parentId) return null;
    const parent: ArgumentTimelineMapNode | null = nodeById.get(cursor.parentId) || null;
    if (!parent) return null;
    if (!clusterIds.has(parent.messageId)) return null;
    const parentAxis = deriveAxis(parent);
    if (parentAxis === axis) return parent;
    cursor = parent;
    depth += 1;
  }
  return null;
}

/**
 * Compute room-wide side turn sequence. Used by advisory rules.
 *
 * The output maps each side to the chronological list of message ids that
 * side has posted across the WHOLE room (not per cluster). Advisories
 * compare turn ordinals against this list.
 */
export function buildSideTurnSequence(
  nodes: ReadonlyArray<ArgumentTimelineMapNode>,
): ReadonlyMap<'affirmative' | 'negative', ReadonlyArray<string>> {
  const sorted = nodes.slice().sort((a, b) => a.ordinal - b.ordinal);
  const aff: string[] = [];
  const neg: string[] = [];
  for (const n of sorted) {
    if (n.sideLabel === 'Aff') aff.push(n.messageId);
    else if (n.sideLabel === 'Neg') neg.push(n.messageId);
  }
  const out = new Map<'affirmative' | 'negative', ReadonlyArray<string>>();
  out.set('affirmative', Object.freeze(aff));
  out.set('negative', Object.freeze(neg));
  return out;
}

/**
 * Compute per-message axis from existing fields. Order of precedence:
 *   1. Axis qualifier codes on `droppedTags[].code`.
 *   2. Argument-type fallback (`evidence` → `evidence`).
 *   3. Default: `unaxed`.
 *
 * NEVER calls `messageQualifiers.deriveMessageCategory`. Reads only the
 * already-populated surface-model fields.
 */
export function deriveAxis(node: ArgumentTimelineMapNode): PointLifecycleAxis | null {
  // Qualifier codes win (matches design §"Axis resolution").
  const axisMap: Record<string, PointLifecycleAxis> = {
    fact_challenge: 'fact',
    fact_disagreement: 'fact',
    scope_challenge: 'scope',
    scope_disagreement: 'scope',
    definition_challenge: 'definition',
    definition_disagreement: 'definition',
    causal_challenge: 'causal',
    causal_disagreement: 'causal',
    value_challenge: 'value',
    value_disagreement: 'value',
    evidence_challenge: 'evidence',
    logic_challenge: 'logic',
    ask_receipts: 'source',
    source_request: 'source',
    quote_exact_bit: 'quote',
    quote_request: 'quote',
  };
  for (const tag of node.droppedTags || []) {
    const norm = String(tag.code || '').toLowerCase();
    if (axisMap[norm]) return axisMap[norm];
  }

  // Argument-type fallback.
  const t = String(node.kindLabel || '').toLowerCase();
  if (t === 'evidence') return 'evidence';
  if (t === 'clarification' || t === 'clarification_request') return null;

  return 'unaxed';
}
