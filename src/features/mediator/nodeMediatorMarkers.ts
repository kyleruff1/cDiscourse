/**
 * UX-MEDIATOR-002 — Node-level mediator marker selection (pure TypeScript).
 *
 * Selects the SINGLE primary mediator marker to show on/near a timeline node,
 * from the already-derived `MediatorBoardState.markupByNodeId` (UX-MEDIATOR-001).
 * It authors NO derivation — it only SELECTS + prioritises + suppresses the
 * non-actionable states ('open', 'resolved_or_settled', 'accounts_differ'),
 * so the timeline never becomes a dense diagnostic console.
 *
 * Pure TS. No React, no Supabase, no fetch, no MCP, no clock, no randomness,
 * no input mutation. Deterministic. JSON-serializable output.
 */
import type { MediatorBoardState, MediatorStateCode } from './mediatorBoardTypes';
import { v4DisplayStateFor } from './deriveMediatorBoardState';
import { plainLanguageForMediatorState } from './mediatorPlainLanguage';

export interface NodeMediatorMarker {
  nodeId: string;
  code: MediatorStateCode;
  /** Plain-language label (from MEDIATOR_STATE_COPY). Never a raw code. */
  label: string;
  /** True for `structured_impasse` — the renderer may give it a calm distinct treatment. */
  isImpasse: boolean;
}

/**
 * Worst-priority-first. Only these states render a node marker; everything
 * else ('open', 'resolved_or_settled', 'accounts_differ') is suppressed so an
 * ordinary open node carries no badge.
 */
export const NODE_MARKER_PRIORITY: ReadonlyArray<MediatorStateCode> = Object.freeze([
  'structured_impasse',
  'evidence_blocked',
  'needs_evidence',
  'definition_not_shared',
  'scope_mismatch',
  'off_point',
  'key_detail_unavailable',
  'missing_mechanism',
  'value_tradeoff',
  'narrowed',
]);

/** code -> rank (higher = more important). Codes not present are never shown. */
const PRIORITY_RANK: Readonly<Record<string, number>> = Object.freeze(
  NODE_MARKER_PRIORITY.reduce<Record<string, number>>((acc, code, i) => {
    acc[code] = NODE_MARKER_PRIORITY.length - i;
    return acc;
  }, {}),
);

/** True when a state code is worth showing as a node marker. */
export function isShowableNodeMarker(code: MediatorStateCode): boolean {
  return Object.prototype.hasOwnProperty.call(PRIORITY_RANK, code);
}

/**
 * The single highest-priority marker for one node, or null when the node has
 * no actionable mediator state. Considers the node's point-level
 * `primaryState` AND its node-specific `deviation` (off-point / scope) and
 * keeps the worst (highest-priority) one.
 *
 * UX-MEDIATOR-002 (O-1): selection + priority operate on the INTERNAL 13-code
 * vocabulary (so `off_point` / `key_detail_unavailable` / `value_tradeoff` keep
 * their precedence), then the chosen code is projected onto the v4 nine-state
 * DISPLAY vocabulary via UX-MEDIATOR-001's `v4DisplayStateFor` for the chip
 * `code` + `label`. The point's internal `point.state` is unchanged for
 * Inspect / traceability. A code whose display projection collapses onto a
 * non-actionable state (`value_tradeoff` → `open`) is suppressed — the node
 * carries no chip — preserving the "ordinary open node has zero chip" rule.
 */
export function getNodeMediatorMarker(
  board: MediatorBoardState | null | undefined,
  nodeId: string | null | undefined,
): NodeMediatorMarker | null {
  if (!board || !nodeId) return null;
  const markup = board.markupByNodeId?.[nodeId];
  if (!markup) return null;

  const candidates: MediatorStateCode[] = [];
  if (isShowableNodeMarker(markup.primaryState)) candidates.push(markup.primaryState);
  if (markup.deviation) candidates.push(markup.deviation.kind); // 'off_point' | 'scope_mismatch'
  if (candidates.length === 0) return null;

  let best = candidates[0];
  for (const c of candidates) {
    if ((PRIORITY_RANK[c] ?? 0) > (PRIORITY_RANK[best] ?? 0)) best = c;
  }

  // Project the selected internal code onto the v4 display vocabulary.
  const displayCode = v4DisplayStateFor(best);
  // The four superset codes collapse for DISPLAY; `value_tradeoff` → `open`
  // (and the terminal `resolved_or_settled`) are non-actionable and carry no
  // chip. `isShowableNodeMarker` is the single source of truth for "shows".
  if (!isShowableNodeMarker(displayCode)) return null;

  return {
    nodeId,
    code: displayCode,
    label: plainLanguageForMediatorState(displayCode),
    isImpasse: displayCode === 'structured_impasse',
  };
}

/**
 * Node-indexed markers for every node that has an actionable state. Suppresses
 * non-actionable nodes entirely (they are absent from the map). Deterministic;
 * JSON-serializable. Available for a future per-node badge surface — the v1
 * timeline display uses `getNodeMediatorMarker` for the active node only to
 * keep noise low.
 */
export function deriveNodeMediatorMarkers(
  board: MediatorBoardState | null | undefined,
): Record<string, NodeMediatorMarker> {
  const out: Record<string, NodeMediatorMarker> = {};
  if (!board || !board.markupByNodeId) return out;
  for (const nodeId of Object.keys(board.markupByNodeId)) {
    const marker = getNodeMediatorMarker(board, nodeId);
    if (marker) out[nodeId] = marker;
  }
  return out;
}
