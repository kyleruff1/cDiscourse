/**
 * ROOM-001 (#876) — ArgumentStateRail pure model.
 *
 * Builds the ambient room-state strip that sits atop the argument room in both
 * lenses: a turn cue, an open-points count, a receipts-owed count, a visibility
 * badge, a seat segment, and an overflow "+N" affordance. This module is a PURE
 * READ-ONLY PROJECTION over PRIMITIVES already computed by the room shell. It
 * imports nothing from the persistence, mediator, or evidence layers: it takes
 * numbers (openPointCount, receiptsOwedCount) and small structural facts
 * (turnLabel, visibility, seat state) as inputs, so the single-derivation house
 * rule cannot be violated from here and the read-only source scan is trivially
 * clean (no client, no query, no deriver, no mutation).
 *
 * Doctrine (cdiscourse-doctrine): the rail counts points and receipts owed on
 * the ARGUMENT, never per-person standing; it shows no score, band, winner,
 * loser, heat, or popularity value; the turn cue is informational, never an
 * enforced lock and never a verdict (the deterministic engine is the sole gate
 * on posting). Copy routes through STATE_RAIL_COPY / ROOM_ONE_TO_ONE_COPY, both
 * plain-language and ban-list scanned. This file has no React and no
 * data-client import (read-only source scan enforces it).
 */
import { STATE_RAIL_COPY, ROOM_ONE_TO_ONE_COPY } from '../gameCopy';

/**
 * The value RoomContractViewModel.turnLabel carries when it is the viewer turn.
 * Mirrors ROOM_CONTRACT_COPY.turnYours; kept as a local literal so this pure
 * model imports no room-contract module (the turnLabel arrives pre-derived).
 */
const YOUR_MOVE_TURN_LABEL = 'Your move';

/** The four ambient turn states. Neutral, informational — never an enforced lock. */
export type StateRailTurnState = 'your_turn' | 'waiting' | 'resting' | 'observer';

/** Which existing in-app surface a chip tap reveals. NEVER a URL / route (in-app state only). */
export type StateRailDeepLink = 'map' | 'debts' | 'details' | null;

export type StateRailChipKind =
  | 'turn' // turn cue (always first)
  | 'open_points' // live disagreement-point count
  | 'receipts_owed' // open evidence-debt count
  | 'visibility' // Public 1:1 / Private 1:1 (gold when private)
  | 'seat' // respondent seat open (no-new-query subset of #681)
  | 'chime_seats' // CHIMEIN-P8 Round 2 (#761) — open chime-in seat count (flag-gated feed)
  | 'saved_recordings'; // RESERVED (P5-6) — renders nothing until VOICE-ADR-002 ships

export interface StateRailChip {
  id: StateRailChipKind;
  /** Plain-language, ban-list-clean, short (kept near ~22 chars). */
  label: string;
  /** Full screen-reader sentence. */
  accessibilityLabel: string;
  /** Logical tone. NEVER the only signal — the view pairs each tone with a glyph. */
  tone: 'neutral' | 'attention' | 'private_gold';
  /** Which existing surface a tap reveals; null = informational (not pressable). */
  deepLink: StateRailDeepLink;
  /** True when the chip carries meaning worth showing. Every chip in `chips` is visible. */
  isVisible: boolean;
}

export interface ArgumentStateRailModel {
  turnState: StateRailTurnState;
  /** All VISIBLE chips in canonical order (turn - open_points - receipts_owed - visibility - seat). */
  chips: ReadonlyArray<StateRailChip>;
  /** First N (=3) shown inline; the rest scroll. */
  visibleChips: ReadonlyArray<StateRailChip>;
  /** chips.length - visibleChips.length (drives the "+N" affordance). */
  overflowCount: number;
  /** Root a11y summary for the strip container. */
  accessibilityLabel: string;
}

export interface ArgumentStateRailInput {
  /** ArgumentRoom.resolvedViewerRole. */
  viewerRole: 'observer' | 'participant';
  /** 'affirmative' | 'negative' | 'observer' | 'moderator' | null. */
  participantSide: string | null;
  /** RoomContractViewModel.turnLabel (already derived by the room shell). */
  turnLabel: string | null;
  /** currentDebate.visibility (already loaded by the room shell). */
  visibility: 'public' | 'private';
  /** RoomContractViewModel.opponentSeat.isOpen. */
  opponentSeatIsOpen: boolean;
  /** Precomputed in ArgumentRoom from the already-derived mediator board. */
  openPointCount: number;
  /** Precomputed in ArgumentRoom from the already-derived evidence debts. */
  receiptsOwedCount: number;
  /** RESERVED — omit / 0 renders nothing (P5-6, gated on VOICE-ADR-002). */
  savedRecordingCount?: number | null;
  /** RESERVED — no in-room source yet (scope-reality audit); renders nothing. */
  openChimeInSeatCount?: number | null;
  /** RESERVED — no in-room source yet (scope-reality audit); renders nothing. */
  watchingCount?: number | null;
}

/** Max chips rendered inline before the "+N" overflow + horizontal scroll. */
export const STATE_RAIL_INLINE_CHIP_LIMIT = 3;

/** Coerce a possibly-undefined count input to a non-negative integer. */
function safeCount(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

/** Pure turn-state derivation (decision 4). */
function deriveTurnState(input: ArgumentStateRailInput): StateRailTurnState {
  const { viewerRole, participantSide, turnLabel } = input;
  const isObserver =
    viewerRole === 'observer' ||
    participantSide == null ||
    participantSide === 'observer' ||
    participantSide === 'moderator';
  if (isObserver) return 'observer';
  if (turnLabel === YOUR_MOVE_TURN_LABEL) return 'your_turn';
  // Participant, not the viewer turn. Nothing open => resting (calm), else waiting.
  if (safeCount(input.openPointCount) === 0) return 'resting';
  return 'waiting';
}

/** Turn chip label + a11y sentence for a resolved turn state. */
function turnChipCopy(turnState: StateRailTurnState): { label: string; a11y: string } {
  switch (turnState) {
    case 'your_turn':
      return { label: STATE_RAIL_COPY.turn_your_move, a11y: STATE_RAIL_COPY.turn_your_move_a11y };
    case 'waiting':
      return { label: STATE_RAIL_COPY.turn_waiting, a11y: STATE_RAIL_COPY.turn_waiting_a11y };
    case 'resting':
      return { label: STATE_RAIL_COPY.turn_resting, a11y: STATE_RAIL_COPY.turn_resting_a11y };
    case 'observer':
    default:
      return { label: STATE_RAIL_COPY.turn_observer, a11y: STATE_RAIL_COPY.turn_observer_a11y };
  }
}

/**
 * Pure. Builds the read-only state rail model from precomputed primitives.
 * Deterministic, JSON-serializable in and out.
 */
export function deriveArgumentStateRail(input: ArgumentStateRailInput): ArgumentStateRailModel {
  const turnState = deriveTurnState(input);
  const openPoints = safeCount(input.openPointCount);
  const receiptsOwed = safeCount(input.receiptsOwedCount);
  const savedRecordings = safeCount(input.savedRecordingCount);
  const isPrivate = input.visibility === 'private';

  const candidates: StateRailChip[] = [];

  // 1. Turn cue — always first, always visible. Never pressable (informational).
  {
    const copy = turnChipCopy(turnState);
    candidates.push({
      id: 'turn',
      label: copy.label,
      accessibilityLabel: copy.a11y,
      tone: turnState === 'your_turn' ? 'attention' : 'neutral',
      deepLink: null,
      isVisible: true,
    });
  }

  // 2. Open disagreement points — visible only when at least one is live.
  {
    const word = openPoints === 1 ? STATE_RAIL_COPY.open_point_word_one : STATE_RAIL_COPY.open_point_word_many;
    candidates.push({
      id: 'open_points',
      label: `${openPoints} ${word}`,
      accessibilityLabel: `${openPoints} ${word} ${STATE_RAIL_COPY.open_points_a11y_suffix}`,
      tone: 'neutral',
      deepLink: 'map',
      isVisible: openPoints > 0,
    });
  }

  // 3. Receipts owed (open evidence debts) — visible only when at least one is owed.
  {
    const word = receiptsOwed === 1 ? STATE_RAIL_COPY.receipt_word_one : STATE_RAIL_COPY.receipt_word_many;
    candidates.push({
      id: 'receipts_owed',
      label: `${receiptsOwed} ${word}`,
      accessibilityLabel: `${receiptsOwed} ${word} ${STATE_RAIL_COPY.receipts_owed_a11y_suffix}`,
      tone: 'attention',
      deepLink: 'debts',
      isVisible: receiptsOwed > 0,
    });
  }

  // 4. Visibility badge — always visible. Gold tone when private.
  {
    const label = isPrivate ? ROOM_ONE_TO_ONE_COPY.label_private : ROOM_ONE_TO_ONE_COPY.label_public;
    const a11yBase = isPrivate
      ? STATE_RAIL_COPY.visibility_private_a11y
      : STATE_RAIL_COPY.visibility_public_a11y;
    candidates.push({
      id: 'visibility',
      label,
      accessibilityLabel: `${a11yBase} ${STATE_RAIL_COPY.visibility_details_hint}`,
      tone: isPrivate ? 'private_gold' : 'neutral',
      deepLink: 'details',
      isVisible: true,
    });
  }

  // 5. Seat segment — visible only when the respondent seat is open (the
  // actionable, incomplete state). Two established principal voices is the calm
  // default and is suppressed so the rail can degrade to [turn, visibility].
  candidates.push({
    id: 'seat',
    label: STATE_RAIL_COPY.seat_open_label,
    accessibilityLabel: `${STATE_RAIL_COPY.seat_open_a11y} ${STATE_RAIL_COPY.visibility_details_hint}`,
    tone: 'attention',
    deepLink: 'details',
    isVisible: input.opponentSeatIsOpen === true,
  });

  // 6. Chime-in seats (CHIMEIN-P8 Round 2, #761) — an informational count of open
  // bounded contribution seats. Visible only when the room shell supplies a
  // positive openChimeInSeatCount (the chime_in flag ON + a public established
  // room with capacity, fed from chimeInContributionModel). Absent / 0 => hidden
  // => byte-identical to the pre-Round-2 rail. A chime seat is never a principal
  // seat, never a verdict; deepLink null keeps it a pure count readout.
  {
    const openChime = safeCount(input.openChimeInSeatCount);
    const chimeWord =
      openChime === 1 ? STATE_RAIL_COPY.chime_seat_word_one : STATE_RAIL_COPY.chime_seat_word_many;
    candidates.push({
      id: 'chime_seats',
      label: `${openChime} ${chimeWord}`,
      accessibilityLabel: `${openChime} ${chimeWord} ${STATE_RAIL_COPY.chime_seats_a11y_suffix}`,
      tone: 'neutral',
      deepLink: null,
      isVisible: openChime > 0,
    });
  }

  // 7. Saved recordings — RESERVED. Renders nothing until the P5-6 voice cards
  // ship (VOICE-ADR-002). watchingCount stays a reserved input with no in-room
  // source yet (scope-reality audit) and renders nothing.
  const savedRecordingLabel = ''; // RESERVED — no copy until VOICE-ADR-002 ships.
  candidates.push({
    id: 'saved_recordings',
    label: savedRecordingLabel,
    accessibilityLabel: savedRecordingLabel,
    tone: 'neutral',
    deepLink: null,
    // Gate on a NON-EMPTY label so a future VOICE wiring card cannot render a
    // blank chip by supplying a count without copy.
    isVisible: savedRecordings > 0 && savedRecordingLabel.length > 0,
  });

  const chips = candidates.filter((c) => c.isVisible);
  const visibleChips = chips.slice(0, STATE_RAIL_INLINE_CHIP_LIMIT);
  const overflowCount = Math.max(0, chips.length - visibleChips.length);

  return {
    turnState,
    chips,
    visibleChips,
    overflowCount,
    accessibilityLabel: STATE_RAIL_COPY.rail_root_a11y,
  };
}

/** Format the overflow "+N" label from the model overflowCount (view helper). */
export function formatStateRailOverflowLabel(overflowCount: number): string {
  return STATE_RAIL_COPY.overflow_more.replace('{n}', String(Math.max(0, Math.floor(overflowCount))));
}

/** Full a11y sentence for the overflow affordance. */
export function formatStateRailOverflowAccessibilityLabel(overflowCount: number): string {
  return STATE_RAIL_COPY.overflow_more_a11y.replace('{n}', String(Math.max(0, Math.floor(overflowCount))));
}
