/**
 * UX-ROOM-1V1-CHIMEIN-001A — 1:1-first room display-state model (Layer A).
 *
 * Pure TypeScript. NO React, NO Supabase, NO network, NO AI imports; no
 * mutation, no clock, no randomness. JSON-serializable in and out; frozen
 * outputs; deterministic — mirrors `src/domain/constitution/engine.ts`
 * discipline. The only import is the frozen `gameCopy` string block (pure
 * strings — the same pattern `roomVisibilityModel.ts` / `seatClaimModel.ts`
 * already use).
 *
 * WHAT THIS IS
 *   A READ-ONLY projection over data the room ALREADY derives elsewhere:
 *     - room `visibility` ('public' | 'private')               — persisted column
 *     - the open/established state of the second principal seat — GAME-004
 *       `RoomContract` / `RoomContractViewModel.opponentSeat.isOpen`
 *     - active-participant / observer flags for the viewer      — ARG-ROOM-005
 *       `isActiveParticipantSide`
 *     - `openChimeInSeatCount`                                  — GAME-005
 *       `PublicRoomSeatMap.openChimeInSeatCount` (ONLY consumed for the two
 *       *_dormant chime classifications)
 *
 * WHAT THIS IS NOT
 *   - It NEVER infers a contribution path that does not exist. The two chime
 *     states it returns (`public_chime_in_available_dormant` /
 *     `public_chime_in_full_dormant`) are DORMANT informational classifications
 *     only — this card renders NO active control from them. The chime-in
 *     CONTRIBUTION path is GATE-C (design §6) and is not built here.
 *   - It adds NO write path, NO new persisted field, NO capacity enforcement.
 *   - When inputs are insufficient it returns `'unknown'` and the caller renders
 *     the current UI unchanged (graceful degradation, no crash).
 *
 * DOCTRINE (cdiscourse-doctrine §1 / §9)
 *   - Every state describes a STRUCTURAL room/seat fact, never a verdict, never
 *     heat / popularity. "Respondent seat open" / "2 principal voices" /
 *     "Observers watching" are seat facts.
 *   - OD-1-SAFE: a private room is `private_invited_access` with subcopy
 *     "Invited access." — this model NEVER claims a private room has "no
 *     observers" / "invited parties only". Whether private rooms have observers
 *     is the unresolved operator decision OD-1; shipped code allows private
 *     observers, so nothing here may imply otherwise.
 *   - The first open PUBLIC respondent seat is NEVER classified as a chime-in —
 *     it is the second principal seat.
 *   - A private room is NEVER chime-eligible (`chimeInAllowed` is public-only).
 */

import type { RoomType } from './roomContractModel';
import { ROOM_ONE_TO_ONE_COPY, SEAT_CLAIM_COPY } from '../arguments/gameCopy';

// ── The display-state union ─────────────────────────────────────

/**
 * The 1:1-first room display state. A read-only classification — never a
 * verdict, never a write trigger.
 *
 *  - `private_invited_access`                — visibility 'private' (OD-1-safe).
 *  - `public_respondent_seat_open`          — public, second principal seat open.
 *  - `public_principal_voices_established`  — public, both principal seats held.
 *  - `public_chime_in_available_dormant`    — public, established, chime-in seats
 *                                             free (DORMANT — no active control).
 *  - `public_chime_in_full_dormant`         — public, established, chime-in seats
 *                                             all taken (DORMANT — no active
 *                                             control).
 *  - `observer_reading`                     — public, established, viewer is a
 *                                             pure observer/reader (not a
 *                                             principal). The "you are watching"
 *                                             perspective; takes precedence over
 *                                             the dormant chime classification
 *                                             for a pure observer.
 *  - `unknown`                              — inputs insufficient → caller keeps
 *                                             the current UI.
 */
export type RoomOneToOneDisplayState =
  | 'private_invited_access'
  | 'public_respondent_seat_open'
  | 'public_principal_voices_established'
  | 'public_chime_in_available_dormant'
  | 'public_chime_in_full_dormant'
  | 'observer_reading'
  | 'unknown';

/** Frozen list — tests iterate this; copy coverage iterates this. */
export const ALL_ROOM_ONE_TO_ONE_DISPLAY_STATES: ReadonlyArray<RoomOneToOneDisplayState> =
  Object.freeze([
    'private_invited_access',
    'public_respondent_seat_open',
    'public_principal_voices_established',
    'public_chime_in_available_dormant',
    'public_chime_in_full_dormant',
    'observer_reading',
    'unknown',
  ]);

// ── Input shape (already-derived data only) ─────────────────────

/**
 * The already-derived inputs the display-state projection consumes. Every field
 * is something the room load already computes — this model derives nothing new
 * from the database.
 */
export interface RoomOneToOneDisplayInput {
  /**
   * Room visibility. `'public' | 'private'`. `null` / any other value =
   * insufficient data → `'unknown'`. (Sourced from the persisted
   * `debates.visibility`.)
   */
  visibility: RoomType | null | undefined;
  /**
   * Whether the second PRINCIPAL (respondent) seat is open — i.e.
   * `RoomContract.primaryOpponentUserId === null`, surfaced as
   * `RoomContractViewModel.opponentSeat.isOpen`. `null` / `undefined` for a
   * public room = insufficient data → `'unknown'`. Ignored for a private room.
   */
  opponentSeatIsOpen: boolean | null | undefined;
  /**
   * Whether the viewer currently holds an active (principal) seat —
   * `isActiveParticipantSide(viewerSide)`. Optional; defaults `false`.
   */
  viewerIsActiveParticipant?: boolean | null;
  /**
   * Whether the viewer is a pure observer / reader (not an active participant).
   * Optional; defaults `false`. When `true` (and the viewer is not a principal)
   * an established public room classifies as `observer_reading`.
   */
  viewerIsObserver?: boolean | null;
  /**
   * The count of free chime-in seats — GAME-005
   * `PublicRoomSeatMap.openChimeInSeatCount`. ONLY consulted to split an
   * established public room into the two DORMANT chime classifications. `null` /
   * `undefined` = chime data not available → the room stays
   * `public_principal_voices_established` (no chime classification).
   */
  openChimeInSeatCount?: number | null;
}

// ── chimeInAllowed guard (design §5.3) ──────────────────────────

/**
 * The private-room no-public-chime guard. Public rooms may (in a future GATE-C
 * layer) host point-scoped chime-ins; private rooms NEVER do. Pure boolean over
 * already-known visibility — it is the GUARD, not a contribution path. A private
 * room renders NO chime affordance (absence, not a disabled control).
 */
export function chimeInAllowed(roomType: RoomType | null | undefined): boolean {
  return roomType === 'public';
}

// ── deriveRoomOneToOneDisplayState ──────────────────────────────

/**
 * Project the already-derived inputs into a single `RoomOneToOneDisplayState`.
 * Pure + deterministic. Decision order is fixed (first match wins) so the
 * result is stable:
 *
 *   1. visibility not 'public'/'private'        → 'unknown'
 *   2. visibility === 'private'                  → 'private_invited_access'
 *   3. public, opponentSeatIsOpen not boolean    → 'unknown' (seat state unknown)
 *   4. public, opponentSeatIsOpen === true       → 'public_respondent_seat_open'
 *   5. public, established (false):
 *        a. pure observer (observer && !principal)→ 'observer_reading'
 *        b. openChimeInSeatCount not a number     → 'public_principal_voices_established'
 *        c. openChimeInSeatCount > 0              → 'public_chime_in_available_dormant'
 *        d. openChimeInSeatCount === 0 (or < 0)   → 'public_chime_in_full_dormant'
 *
 * It NEVER returns a chime state for a private room and NEVER returns a chime
 * state from absent chime data — both are doctrine-load-bearing.
 */
export function deriveRoomOneToOneDisplayState(
  input: RoomOneToOneDisplayInput,
): RoomOneToOneDisplayState {
  const visibility = input.visibility;

  // 1. Insufficient / invalid visibility — caller keeps the current UI.
  if (visibility !== 'public' && visibility !== 'private') {
    return 'unknown';
  }

  // 2. Private room — OD-1-safe invited-access classification. No chime states.
  if (visibility === 'private') {
    return 'private_invited_access';
  }

  // Public room from here on.
  // 3. Seat state must be known to classify a public room.
  if (typeof input.opponentSeatIsOpen !== 'boolean') {
    return 'unknown';
  }

  // 4. The open second-principal (respondent) seat. NOT a chime-in.
  if (input.opponentSeatIsOpen === true) {
    return 'public_respondent_seat_open';
  }

  // 5. Established public 1:1 (both principal seats held).
  const viewerIsPrincipal = input.viewerIsActiveParticipant === true;
  const viewerIsObserver = input.viewerIsObserver === true;

  // 5a. A pure observer reads the "you are watching" perspective.
  if (viewerIsObserver && !viewerIsPrincipal) {
    return 'observer_reading';
  }

  // 5b. No chime data available → established (never invent a chime state).
  if (typeof input.openChimeInSeatCount !== 'number' || Number.isNaN(input.openChimeInSeatCount)) {
    return 'public_principal_voices_established';
  }

  // 5c / 5d. DORMANT chime classification from the GAME-005 seat-map count.
  if (input.openChimeInSeatCount > 0) {
    return 'public_chime_in_available_dormant';
  }
  return 'public_chime_in_full_dormant';
}

// ── Display view-model (labels + subcopy, no JSX) ───────────────

/**
 * The render-ready label + subcopy for a display state. Pure strings sourced
 * from `ROOM_ONE_TO_ONE_COPY`. `chimeAffordanceVisible` is the structural guard
 * the UI consumes to decide whether a chime affordance may appear AT ALL — it
 * is ALWAYS `false` in this card (chime controls are DORMANT / GATE-C) and is
 * ALWAYS `false` for a private room (the no-public-chime guard).
 */
export interface RoomOneToOneViewModel {
  state: RoomOneToOneDisplayState;
  /** 'Public 1:1' | 'Private 1:1' | '' (empty when state is 'unknown'). */
  label: string;
  /** The one-line under-label, or '' when the state has none / is unknown. */
  subcopy: string;
  /**
   * Whether a chime affordance may render. ALWAYS false in this card (controls
   * are dormant); ALWAYS false for a private room (guard). Present so the
   * GATE-C card flips ONE boolean rather than re-deriving the guard.
   */
  chimeAffordanceVisible: boolean;
}

/**
 * Build the render-ready view-model for a display state. Pure + frozen. The
 * `*_dormant` chime states carry the established label + subcopy (the chime
 * classification is informational; this card draws no chime control), so the
 * header reads "Public 1:1 · 2 principal voices" in every established state.
 */
export function buildRoomOneToOneViewModel(
  input: RoomOneToOneDisplayInput,
): RoomOneToOneViewModel {
  const state = deriveRoomOneToOneDisplayState(input);

  let label = '';
  let subcopy = '';

  switch (state) {
    case 'private_invited_access':
      label = ROOM_ONE_TO_ONE_COPY.label_private;
      subcopy = ROOM_ONE_TO_ONE_COPY.subcopy_private_invited_access;
      break;
    case 'public_respondent_seat_open':
      label = ROOM_ONE_TO_ONE_COPY.label_public;
      subcopy = ROOM_ONE_TO_ONE_COPY.subcopy_respondent_seat_open;
      break;
    case 'public_principal_voices_established':
    case 'public_chime_in_available_dormant':
    case 'public_chime_in_full_dormant':
      label = ROOM_ONE_TO_ONE_COPY.label_public;
      subcopy = ROOM_ONE_TO_ONE_COPY.subcopy_principal_voices_established;
      break;
    case 'observer_reading':
      label = ROOM_ONE_TO_ONE_COPY.label_public;
      subcopy = ROOM_ONE_TO_ONE_COPY.observer_reading_line;
      break;
    case 'unknown':
    default:
      label = '';
      subcopy = '';
      break;
  }

  return Object.freeze({
    state,
    label,
    subcopy,
    // Dormant in this card AND guarded for private rooms.
    chimeAffordanceVisible: false,
  });
}

// ── Observer / principal seat-line separation (design §5.4) ─────

/**
 * The seat-line projection that surfaces the two principal voices SEPARATELY
 * from observers (design §5.4 / State 3). Pure strings. `readersNote` reuses the
 * existing `SEAT_CLAIM_COPY.readersNote` so the "readers do not use active
 * seats" line stays one source of truth.
 */
export interface OneToOneSeatLineViewModel {
  /** '2 principal voices'. */
  principalVoicesLabel: string;
  /** 'Observers watching'. */
  observersLabel: string;
  /** 'Readers do not use active seats' (reused from SEAT_CLAIM_COPY). */
  readersNote: string;
}

/**
 * Build the observer/principal seat-line view-model. Copy/view-model only — it
 * computes no counts and renders no control; it exists so the established-state
 * UI can list "2 principal voices" distinctly from "Observers watching" with the
 * reader note kept separate from any active-seat copy.
 */
export function buildOneToOneSeatLineViewModel(): OneToOneSeatLineViewModel {
  return Object.freeze({
    principalVoicesLabel: ROOM_ONE_TO_ONE_COPY.principal_voices_heading,
    observersLabel: ROOM_ONE_TO_ONE_COPY.observers_watching,
    readersNote: SEAT_CLAIM_COPY.readersNote,
  });
}

// ── Re-export the copy blocks so callers stay model-scoped ───────

export { ROOM_ONE_TO_ONE_COPY, POINT_SCOPED_CHIME_IN_COPY } from '../arguments/gameCopy';

// ── Ban-list support ────────────────────────────────────────────

/**
 * Forbidden tokens scanned by `__tests__/oneToOneRoomModel.test.ts`. NOT a
 * content filter. Mirrors the sibling pure-model ban lists
 * (`_forbiddenRoomAccessTokens`, `_forbiddenSeatClaimTokens`) PLUS this card's
 * own avoid-list (comment / pile on / audience / forum / open mic / third side /
 * join the debate). Every string this model + its copy can emit describes a
 * STRUCTURAL room/seat state, never a verdict, never a person, never heat /
 * popularity, never a comment-thread / forum framing.
 *
 * NOTE: 'opponent' / 'challenger' are intentionally NOT in this list — the
 * `seatOpponent` relabel is the deferred OD-5 decision and "opponent" is not on
 * this card's ban-list. This model authors no "Opponent" string regardless.
 */
export function _forbiddenOneToOneTokens(): string[] {
  return [
    // Verdict tokens (cdiscourse-doctrine §1).
    'winner',
    'loser',
    'correct',
    'incorrect',
    'truth',
    'true',
    'false',
    'wrong',
    'won',
    'lost',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'fallacy',
    'verdict',
    'score',
    // AI-authority tokens.
    'ai decides',
    'ai judge',
    // Amplification tokens (§2 / §3).
    'popular',
    'trending',
    'viral',
    'upvote',
    'downvote',
    // This card's social-feed / comment-thread avoid-list.
    'comment',
    'pile on',
    'audience',
    'forum',
    'join the debate',
    'open mic',
    'third side',
    // Person-attribution / punitive tokens.
    'troll',
    'bot',
    'booted',
    'kicked',
    'banned',
    'silenced',
  ];
}
