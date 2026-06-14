/**
 * UX-MEDIATOR-005 — Disagreement Points rail chrome copy.
 *
 * Frozen, ban-list-clean UI chrome for the rail. State labels themselves come
 * from `mediatorPlainLanguage.ts` (MEDIATOR_STATE_COPY); this file holds only
 * the rail's own chrome (title, empty/unavailable states, action words). No
 * verdict / person / amplification tokens; no internal codes.
 */
export const DISAGREEMENT_POINTS_RAIL_COPY = Object.freeze({
  /** Collapsed pill + expanded header title. */
  title: 'Disagreement points',
  collapseLabel: 'Collapse',
  /** Shown when there are no live (unresolved) points. */
  emptyPrimary: 'No active disagreement points are currently marked.',
  emptyHelper: 'Points appear here as they open, need evidence, or reach a structured impasse.',
  /** Shown when the board could not be derived for this view. */
  unavailablePrimary: 'Disagreement points are not available for this view yet.',
  /** Per-point navigation (read-only; a jump, never a mutation). */
  viewInTimeline: 'View in timeline',
  /** One-line "next step" lead-in. */
  whatHelps: 'What would help next?',
  /** Marks the point anchored to the currently-active timeline node. */
  activeSuffix: 'Currently active',
  /** Overflow reveal word. */
  overflowWord: 'more',
});

/** Rows shown before the in-panel "+N more" reveal. */
export const DISAGREEMENT_POINTS_RAIL_INITIAL_ROWS = 6;

/** Plural-safe "N evidence request(s)" line. Ban-list clean. */
export function evidenceRequestCountLabel(count: number): string {
  if (count <= 0) return '';
  return count === 1 ? '1 evidence request' : `${count} evidence requests`;
}
