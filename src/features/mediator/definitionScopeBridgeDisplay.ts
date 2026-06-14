/**
 * UX-MEDIATOR-004 — Definition / scope bridge display selection (pure TypeScript).
 *
 * Turns the already-derived `MediatorBoardState` definition/scope fields
 * (`definitionMismatches`, `scopeMismatches`, and the point's own
 * `definition_not_shared` / `scope_mismatch` state) into compact, per-point
 * display DATA for the Disagreement Points rail. It authors NO derivation — it
 * only SELECTS / filters / prioritises what the board already carries. The rail
 * component applies the user-facing copy; this module returns booleans + a
 * deterministic primary/secondary choice, no copy strings.
 *
 * Doctrine: a definition/scope bridge is STRUCTURAL guidance ("the two sides
 * are using a term differently — pin it down"), never a verdict, never an
 * accusation, never a posting gate. This module performs no inference over raw
 * prose; it reads only the board's persisted-observation-driven markers.
 *
 * Pure TS. No React, no Supabase, no fetch, no MCP, no clock, no randomness,
 * no input mutation. Deterministic. JSON-serializable output.
 */
import type {
  DefinitionMismatch,
  DisagreementPoint,
  MediatorBoardState,
  ScopeMismatch,
} from './mediatorBoardTypes';

/** Which clarification a bridge prompt is about. */
export type BridgeKind = 'definition' | 'scope';

export interface PointBridgeDisplay {
  pointId: string;
  /** A definition marker (state or mismatch row) is present for the point. */
  hasDefinition: boolean;
  /** A scope marker (state or mismatch row) is present for the point. */
  hasScope: boolean;
  /** The single bridge prompt to lead with (board priority respected). */
  primary: BridgeKind;
  /** The other kind, summarised, ONLY when both are present; else null. */
  secondary: BridgeKind | null;
}

/** Definition-mismatch rows attached to a point (read straight from the board). */
export function getDefinitionMismatchesForPoint(
  board: MediatorBoardState | null | undefined,
  pointId: string,
): ReadonlyArray<DefinitionMismatch> {
  if (!board || !board.definitionMismatches) return [];
  return board.definitionMismatches.filter((d) => d.pointId === pointId);
}

/** Scope-mismatch rows attached to a point (read straight from the board). */
export function getScopeMismatchesForPoint(
  board: MediatorBoardState | null | undefined,
  pointId: string,
): ReadonlyArray<ScopeMismatch> {
  if (!board || !board.scopeMismatches) return [];
  return board.scopeMismatches.filter((s) => s.pointId === pointId);
}

function findPoint(
  board: MediatorBoardState | null | undefined,
  pointId: string,
): DisagreementPoint | undefined {
  if (!board || !board.points) return undefined;
  return board.points.find((p) => p.id === pointId);
}

/**
 * The compact definition/scope bridge for one point, or null when the point
 * has neither a definition nor a scope marker.
 *
 * Presence is driven by the point's own STATE (`definition_not_shared` /
 * `scope_mismatch`) OR a matching mismatch row — the production deriver keeps
 * those aligned, so a real point is at most one of the two; the dual-signal
 * read is defensive only.
 *
 * Primary choice respects the board's existing priority: when the point's own
 * state is `scope_mismatch` the scope prompt leads; when it is
 * `definition_not_shared` the definition prompt leads; only when neither state
 * applies (a synthetic both-via-arrays board) does it fall back to the
 * doctrine default of preferring the definition prompt. Deterministic.
 */
export function getDefinitionScopeBridgeForPoint(
  board: MediatorBoardState | null | undefined,
  pointId: string,
): PointBridgeDisplay | null {
  if (!board) return null;
  const point = findPoint(board, pointId);

  const hasDefinition =
    point?.state === 'definition_not_shared' ||
    getDefinitionMismatchesForPoint(board, pointId).length > 0;
  const hasScope =
    point?.state === 'scope_mismatch' || getScopeMismatchesForPoint(board, pointId).length > 0;

  if (!hasDefinition && !hasScope) return null;

  let primary: BridgeKind;
  if (point?.state === 'scope_mismatch' && hasScope) {
    primary = 'scope'; // board priority already says scope
  } else if (point?.state === 'definition_not_shared' && hasDefinition) {
    primary = 'definition'; // board priority already says definition
  } else {
    primary = hasDefinition ? 'definition' : 'scope'; // default: prefer definition
  }

  const secondary: BridgeKind | null =
    hasDefinition && hasScope ? (primary === 'definition' ? 'scope' : 'definition') : null;

  return { pointId, hasDefinition, hasScope, primary, secondary };
}

/**
 * Per-point bridge display for every point that has a definition/scope marker.
 * Points with neither are absent from the map. Deterministic; JSON-serializable.
 */
export function deriveDefinitionScopeBridgeDisplay(
  board: MediatorBoardState | null | undefined,
): Record<string, PointBridgeDisplay> {
  const out: Record<string, PointBridgeDisplay> = {};
  if (!board || !board.points) return out;
  for (const point of board.points) {
    const display = getDefinitionScopeBridgeForPoint(board, point.id);
    if (display) out[point.id] = display;
  }
  return out;
}
