/**
 * UX-MEDIATOR-003 — Evidence-debt display selection (pure TypeScript).
 *
 * Turns the already-derived `MediatorBoardState` evidence fields
 * (`evidenceDebts`, `blockedEvidencePaths`) into compact, per-point display
 * DATA for the Disagreement Points rail. It authors NO derivation — it only
 * SELECTS / filters / summarises what the board already carries. The rail
 * component applies the user-facing copy (this module returns no copy strings
 * beyond the plain kind words from EV-003's `evidenceDebtKindWord`).
 *
 * Pure TS. No React, no Supabase, no fetch, no MCP, no clock, no randomness,
 * no input mutation. Deterministic. JSON-serializable output. Never demands
 * proof — an evidence debt is a STRUCTURAL obligation, never a verdict.
 */
import { evidenceDebtKindWord } from '../evidence/evidenceDebtModel';
import type { BlockedEvidencePath, MediatorBoardState } from './mediatorBoardTypes';

export interface PointEvidenceDisplay {
  pointId: string;
  /** Count of OPEN evidence debts attached to the point. */
  openCount: number;
  /** Plain kind words ('source', 'quote', 'receipt', 'context', 'primary record'), deduped + sorted. */
  kindWords: ReadonlyArray<string>;
  /** `kindWords` joined for a one-line render. */
  kindsLine: string;
  /** True when any open debt is declined/record-limited or a blocked path exists. */
  isBlocked: boolean;
}

/** Blocked evidence paths attached to a point (read straight from the board). */
export function getBlockedEvidencePathsForPoint(
  board: MediatorBoardState | null | undefined,
  pointId: string,
): ReadonlyArray<BlockedEvidencePath> {
  if (!board || !board.blockedEvidencePaths) return [];
  return board.blockedEvidencePaths.filter((b) => b.pointId === pointId);
}

/**
 * The compact evidence display for one point, or null when the point has no
 * OPEN evidence debt. Pure + deterministic (stable kind-word ordering).
 */
export function getEvidenceDebtForPoint(
  board: MediatorBoardState | null | undefined,
  pointId: string,
): PointEvidenceDisplay | null {
  if (!board || !board.evidenceDebts) return null;
  const open = board.evidenceDebts.filter((v) => v.pointId === pointId && v.isOpen);
  if (open.length === 0) return null;

  const kindWords = Array.from(new Set(open.map((v) => evidenceDebtKindWord(v.kind))))
    .filter((w) => typeof w === 'string' && w.length > 0)
    .sort();
  const isBlocked =
    open.some((v) => v.isBlocked) || getBlockedEvidencePathsForPoint(board, pointId).length > 0;

  return {
    pointId,
    openCount: open.length,
    kindWords,
    kindsLine: kindWords.join(', '),
    isBlocked,
  };
}

/**
 * Per-point evidence display for every point that has OPEN evidence debt.
 * Points with no open debt are absent from the map. Deterministic;
 * JSON-serializable.
 */
export function deriveEvidenceDebtDisplay(
  board: MediatorBoardState | null | undefined,
): Record<string, PointEvidenceDisplay> {
  const out: Record<string, PointEvidenceDisplay> = {};
  if (!board || !board.evidenceDebts) return out;
  const pointIds = new Set<string>();
  for (const v of board.evidenceDebts) {
    if (v.isOpen) pointIds.add(v.pointId);
  }
  for (const pointId of pointIds) {
    const display = getEvidenceDebtForPoint(board, pointId);
    if (display) out[pointId] = display;
  }
  return out;
}
