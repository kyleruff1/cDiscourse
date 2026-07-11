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
  /**
   * @deprecated UX-MEDIATOR-005 — superseded by `moveForward` as the v4 shared
   * row lead-in. Kept exported (not deleted) to avoid breaking any consumer
   * importing it; the rail now renders `moveForward`.
   */
  whatHelps: 'What would help next?',
  /**
   * UX-MEDIATOR-005 — the v4 row "next step" lead-in (one shared lead-in for the
   * sheet + side variants). Ban-list clean; advisory, never a posting gate.
   */
  moveForward: 'Move forward:',
  /**
   * UX-MEDIATOR-005 — the "· N total" header count framing suffix. Ban-list
   * clean — a count word, never a verdict / score.
   */
  totalSuffix: 'total',
  /**
   * UX-MEDIATOR-005 — contribution marker (rendered ONLY when a point anchor is a
   * chime-in). As of CHIMEIN-P8 Round 2 (#761) the chime-in DATA ships: ArgumentRoom
   * feeds `DisagreementPointsRail.contributionKindByNodeId` from the loaded
   * chime_in_contributions rows when the chime_in flag is on (byte-identical, no
   * marker, when off / no data). A contribution label, NEVER a state, verdict, or
   * third principal voice.
   */
  chimeInMarker: '↳ chime-in',
  /** Marks the point anchored to the currently-active timeline node. */
  activeSuffix: 'Currently active',
  /** Overflow reveal word. */
  overflowWord: 'more',
  /** UX-MEDIATOR-003 — evidence-debt section lead-in. */
  evidenceHelp: 'Evidence that would help',
  /**
   * UX-MEDIATOR-003 (O-1) — blocked / unavailable evidence path. Kept in
   * lockstep with `MEDIATOR_STATE_COPY.evidence_blocked` ("Evidence blocked")
   * so the rail blocked line and the node chip use the SAME display label.
   * Describes an unavailable PATH, never anyone's conduct.
   */
  blockedEvidencePath: 'Evidence blocked',
  /** UX-MEDIATOR-004 — definition/scope bridge lead-in. */
  clarifyPoint: 'Clarify the point',
  // UX-MEDIATOR-004 — bridge prompts are ADVISORY guidance, never a posting
  // gate. The phrasing deliberately avoids "before continuing" / "first" so it
  // never reads as a precondition to posting (doctrine §1 — the board never
  // blocks). It mirrors the collaborative tone of MEDIATOR_STATE_HELPER.
  /** UX-MEDIATOR-004 — definition bridge prompt (advisory, never a gate). */
  definitionBridge: 'The key term is not yet shared. Define the key term together.',
  /** UX-MEDIATOR-004 — scope bridge prompt (advisory, never a gate). */
  scopeBridge: 'This appears to answer a different scope. Narrow the claim, branch the provable part, or respond to the exact point.',
  /** UX-MEDIATOR-004 — secondary bridge note lead-in (shown only when both apply). */
  alsoPrefix: 'Also',
  /** UX-MEDIATOR-004 — short labels for the secondary bridge note. */
  definitionShort: 'Definition not shared',
  scopeShort: 'Scope mismatch',
  /**
   * UX-IMPASSE-001 (#689) — dignified impasse row copy. Today the rail row for a
   * structured-impasse point shows an EMPTY "Move forward:" because the only
   * pathway step (`await_record`) is unavailable, so `nextStepLabelFor` returns
   * `''`. Instead of an empty line, an impasse row shows a calm, complete
   * statement: the disagreement is preserved + the reopen invitation. This is
   * COPY on the existing row body — no new row, no relocation, no topology change.
   * Kept in lockstep with `IMPASSE_SUBTYPE_COPY.structured_impasse` (one source of
   * the dignified wording). Person-neutral, ban-list clean, advisory — never a gate.
   */
  impassePreserved: 'The disagreement is preserved.',
  impasseReopen: 'Reopen with a source, shared definition, or narrower claim.',
  /**
   * UX-BOARD-RAIL-003 — distribution-segment navigation copy. The distribution
   * strip is a LOCAL navigation control: pressing a segment jumps the rail's own
   * list to the first point in that state. These atoms are ban-list clean — a
   * jump verb + a "showing" anchor + a reset, never a score / rank / winner.
   *
   * `showAllPoints` clears the selection (no segment focused → every point reads
   * as "in view"). `showingPrefix` builds the "Showing: <state>" anchor line.
   * `inViewMarker` is the non-color-only "this row is in the selected group"
   * text marker (geometry + text, never color alone — doctrine §1 / a11y).
   */
  showAllPoints: 'Show all points',
  showingPrefix: 'Showing',
  inViewMarker: 'In view',
});

/** Rows shown before the in-panel "+N more" reveal. */
export const DISAGREEMENT_POINTS_RAIL_INITIAL_ROWS = 6;

/** Plural-safe "N evidence request(s)" line. Ban-list clean. */
export function evidenceRequestCountLabel(count: number): string {
  if (count <= 0) return '';
  return count === 1 ? '1 evidence request' : `${count} evidence requests`;
}
