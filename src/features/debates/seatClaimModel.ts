/**
 * ARG-ROOM-005 — public participant seat-claim model (pure-TS).
 *
 * Pure TypeScript. No React, no Supabase, no network, no async, no clock, no
 * randomness; JSON-serializable in and out; frozen outputs; deterministic —
 * mirrors `src/domain/constitution/engine.ts` discipline. Never import
 * Supabase, React, or any network library into this file.
 *
 * This card SURFACES and GRACEFULLY HANDLES the already-deployed ARG-ROOM-002
 * capacity enforcement; it never re-enforces it. The binding invariant
 *
 *   publicActiveParticipants + reservedInviteSeats <= cap   (5 public / 2 private)
 *
 * is enforced server-side by the `enforce_room_capacity()` BEFORE INSERT trigger
 * (migration `20260613000001`, join check `active + reserved + 1 <= cap`). This
 * model is the client-side preview + the join-outcome classifier:
 *
 *   - `isActiveParticipantSide`   — the pure twin of the SQL `side <> 'observer'`.
 *   - `deriveSeatAvailability`    — open-slot count + isFull + viewer state.
 *   - `classifyJoinOutcome`       — maps a Supabase write error to a seat outcome
 *                                   WITHOUT surfacing any count (no enumeration).
 *   - `buildSeatAvailabilityViewModel` — verdict-free, count-only display copy.
 *   - `resolveJoinSideEffect`     — what the room shell does after a claim attempt.
 *
 * Doctrine anchors (read before changing anything):
 *  - Seat availability is STRUCTURAL access/activity arithmetic on counts + the
 *    cap. It imports nothing from any score / heat / anti-amplification module —
 *    popularity and heat NEVER gate a seat (§2-§3).
 *  - "Full" is a seat fact and "observe" is a first-class state, never a verdict,
 *    never a demotion, never a loss (§1). Every produced string is ban-list
 *    scanned (`_forbiddenSeatClaimTokens`).
 *  - The single source of truth for the cap is `roomActiveSeatCap` (which derives
 *    from `PUBLIC_ROOM_SEAT_CAP` / `PRIMARY_SEAT_COUNT`). This file authors NO
 *    second cap literal.
 *  - No enumeration: a public viewer cannot see reserved invites (they are
 *    RLS-hidden), so they always pass `knownReservedInviteCount = 0` and
 *    `reservedCountIsAuthoritative = false`. A room with a hidden reserved invite
 *    and a room with one genuinely-open seat therefore render IDENTICAL output.
 *    `classifyJoinOutcome` discards the 002 trigger's `DETAIL` (cap=/active=/
 *    reserved=) so the refusal copy is identical regardless of WHY the room is
 *    full — never a soft enumeration signal.
 */

import type { ParticipantSide } from './types';
import type {
  ArgumentRoomVisibility,
  ArgumentRoomCapacity,
} from './argumentRoomCreationMatrix';
import {
  roomActiveSeatCap,
  canJoinActive,
  openActiveSlots,
} from './roomCapacityModel';
import { SEAT_CLAIM_COPY } from '../arguments/gameCopy';

// ── Active-participant predicate ────────────────────────────────

/**
 * Pure twin of the SQL `side <> 'observer'` (migration `20260613000001`
 * `count_active_participants` :124-127 and the trigger observer pass-through
 * :224). `affirmative` / `negative` / `moderator` are active participants and
 * count against the cap; `observer` and "no row at all" (null / undefined) are
 * NOT active and never count. The creator auto-joins as `moderator`, which is
 * why a fresh public room reads as creator(1 active) + open slots.
 */
export function isActiveParticipantSide(
  side: ParticipantSide | null | undefined,
): boolean {
  return side === 'affirmative' || side === 'negative' || side === 'moderator';
}

// ── Seat availability ───────────────────────────────────────────

export interface SeatAvailabilityInput {
  /** Room visibility — drives the cap via `roomActiveSeatCap`. */
  visibility: ArgumentRoomVisibility;
  /**
   * Active participant count, derived from the already-loaded
   * `debate_participants` rows (`side !== 'observer'`). Clamped >= 0.
   */
  activeParticipantCount: number;
  /**
   * Reserved (live pending) invite seats KNOWN to this viewer. RLS-bounded: a
   * creator / inviter / admin may pass the real count; a public viewer cannot
   * read invite rows and always passes 0 (no enumeration). Defaults 0.
   */
  knownReservedInviteCount: number;
  /** The viewer's own side; null = not a participant (a pure reader). */
  viewerSide: ParticipantSide | null;
  /**
   * OPTIONAL. Whether `knownReservedInviteCount` is the FULL reserved count
   * (a creator / inviter / admin surface) rather than an RLS-bounded preview.
   * Defaults `false` — the public, no-differential-preview posture: openSlots
   * is then a PREVIEW only and the 002 trigger stays authoritative. Drives no
   * copy by itself.
   */
  reservedCountIsAuthoritative?: boolean;
}

export interface SeatAvailability {
  /** The derived active-participant cap (`roomActiveSeatCap(visibility)`). */
  cap: ArgumentRoomCapacity;
  /** Clamped active participant count (>= 0). */
  activeParticipantCount: number;
  /** The KNOWN reserved-invite count (advisory / preview for a public viewer). */
  reservedInviteCount: number;
  /** Open active slots right now (`openActiveSlots(active, reserved, cap)`). */
  openSlots: number;
  /** True when one more active participant cannot take a seat. */
  isFull: boolean;
  /** Whether the viewer already holds an active seat. */
  viewerIsActiveParticipant: boolean;
  /** Whether the viewer can claim an active seat right now. */
  canClaimActiveSeat: boolean;
  /** Whether observe is the only remaining option (full + viewer not active). */
  observeIsOnlyOption: boolean;
  /**
   * Whether `reservedInviteCount` is the authoritative full count. `false` for a
   * public viewer (reserved is RLS-hidden) → openSlots is a preview only; the
   * 002 trigger is authoritative. Drives no copy by itself.
   */
  reservedCountIsAuthoritative: boolean;
}

/**
 * Derive the live-room seat view-model from counts + the cap. Pure +
 * deterministic; the output is frozen. The reserved count and the
 * authoritative flag default to the public, no-differential-preview posture, so
 * a room with a hidden reserved invite and a room with one genuinely-open seat
 * produce IDENTICAL output (the reserved seat is invisible at the preview
 * layer). Negative / non-finite counts clamp to 0 (defensive; SQL counts >= 0).
 */
export function deriveSeatAvailability(
  input: SeatAvailabilityInput,
): SeatAvailability {
  const cap = roomActiveSeatCap(input.visibility);
  const activeParticipantCount =
    Number.isFinite(input.activeParticipantCount)
      ? Math.max(0, input.activeParticipantCount)
      : 0;
  const reservedInviteCount =
    Number.isFinite(input.knownReservedInviteCount)
      ? Math.max(0, input.knownReservedInviteCount)
      : 0;

  const openSlots = openActiveSlots(activeParticipantCount, reservedInviteCount, cap);
  const isFull = !canJoinActive(activeParticipantCount, reservedInviteCount, cap);
  const viewerIsActiveParticipant = isActiveParticipantSide(input.viewerSide);
  const canClaimActiveSeat = !isFull && !viewerIsActiveParticipant;
  const observeIsOnlyOption = isFull && !viewerIsActiveParticipant;

  return Object.freeze({
    cap,
    activeParticipantCount,
    reservedInviteCount,
    openSlots,
    isFull,
    viewerIsActiveParticipant,
    canClaimActiveSeat,
    observeIsOnlyOption,
    reservedCountIsAuthoritative: input.reservedCountIsAuthoritative === true,
  });
}

// ── Join-outcome classifier ─────────────────────────────────────

export type JoinOutcomeKind =
  | 'claimed'
  | 'already_active'
  | 'already_observer'
  | 'room_full'
  | 'unavailable'
  | 'error';

/** The three success outcomes a completed `joinDebate` can report. */
export type JoinSuccessOutcome = 'claimed' | 'already_active' | 'already_observer';

/**
 * Classify a Supabase write error into a seat outcome WITHOUT surfacing any
 * count. Detection order:
 *
 *   - no error object → `error` (malformed / empty; never silently `claimed`).
 *   - SQLSTATE `23505` (unique-violation) → already seated; `already_active`
 *     vs `already_observer` is decided by the existing row's side.
 *   - message includes `room_capacity_reached` → `room_full`. The MESSAGE TOKEN
 *     is AUTHORITATIVE (review [should] #1): a bare `23514` (generic
 *     `check_violation`) WITHOUT the token is some OTHER check and must NOT be
 *     misclassified as full.
 *   - any other coded error (incl. a tokenless `23514`) → `unavailable`.
 *   - a code-less error object → `error`.
 *
 * The 002 trigger's `DETAIL` (`cap=/active=/reserved=`) is intentionally NEVER
 * read here — the refusal copy is identical whether the room is full by active
 * seats or by a hidden reserved invite (no soft enumeration).
 */
export function classifyJoinOutcome(
  error: { code?: string | null; message?: string | null } | null | undefined,
  existingSide?: ParticipantSide | null,
): JoinOutcomeKind {
  if (!error) return 'error';

  const code = typeof error.code === 'string' ? error.code : '';
  const message = typeof error.message === 'string' ? error.message : '';

  // Unique-violation → already seated. Distinguish active vs observer by side.
  if (code === '23505') {
    return isActiveParticipantSide(existingSide) ? 'already_active' : 'already_observer';
  }

  // Capacity refusal — the raised token is authoritative, not the generic code.
  if (message.includes('room_capacity_reached')) {
    return 'room_full';
  }

  // A coded error that is NOT our capacity token (incl. a tokenless 23514) is
  // not actionable as a seat outcome → unavailable (never silently `claimed`).
  if (code.length > 0) {
    return 'unavailable';
  }

  // Error object present but code-less and tokenless → generic error.
  return 'error';
}

// ── Display view-model (verdict-free, counts only) ──────────────

export interface SeatAvailabilityViewModel {
  /** "3 open seats" / "1 open seat" / "No open seats". Count only. */
  openSeatsLabel: string;
  isFull: boolean;
  /** The full-room observe nudge when full + viewer not active, else null. */
  fullRoomObserveNudge: string | null;
  /** "You're in this argument." / "You're watching." */
  viewerStateLabel: string;
  /** Verbose, single-shot screen-reader summary of the strip. */
  accessibilityLabel: string;
}

/** "N open seats" — singular / plural / zero. Count only, never a ranking. */
function openSeatsLabel(openSlots: number): string {
  const safe = Number.isFinite(openSlots) ? Math.max(0, Math.trunc(openSlots)) : 0;
  if (safe <= 0) return SEAT_CLAIM_COPY.openSeatsZero;
  if (safe === 1) return SEAT_CLAIM_COPY.openSeatsOne;
  return SEAT_CLAIM_COPY.openSeatsMany.replace('{count}', String(safe));
}

/**
 * Build the read-only seat-availability display view-model. Verdict-free;
 * counts only, never identities. `viewerSide` distinguishes the viewer-state
 * line: an active participant (affirmative / negative / moderator) reads "You're
 * in this argument."; an observer or a pure reader (null) reads "You're
 * watching." The full-room nudge appears only when observe is the only option.
 */
export function buildSeatAvailabilityViewModel(
  a: SeatAvailability,
  viewerSide: ParticipantSide | null,
): SeatAvailabilityViewModel {
  const seatsLabel = openSeatsLabel(a.openSlots);
  const fullRoomObserveNudge = a.observeIsOnlyOption
    ? SEAT_CLAIM_COPY.fullRoomObserve
    : null;
  const viewerStateLabel = isActiveParticipantSide(viewerSide)
    ? SEAT_CLAIM_COPY.youAreActive
    : SEAT_CLAIM_COPY.youAreWatching;

  // Lead with the observe nudge when full; with the open-slot count otherwise.
  const head = fullRoomObserveNudge ?? `${seatsLabel}.`;
  const accessibilityLabel = [head, viewerStateLabel]
    .filter((part) => part.length > 0)
    .join(' ');

  return {
    openSeatsLabel: seatsLabel,
    isFull: a.isFull,
    fullRoomObserveNudge,
    viewerStateLabel,
    accessibilityLabel,
  };
}

// ── Claim side-effect (what the room shell does next) ───────────

export type JoinSideEffect =
  | { kind: 'select_side'; side: ParticipantSide }
  | { kind: 'full_room_observe' }
  | { kind: 'none' };

/**
 * Decide what the room shell does after a claim attempt. Pure so the App
 * handler stays a thin dispatcher:
 *
 *   - `room_full` → `full_room_observe`: keep the user in read/observe mode and
 *     surface the observe affordance (never a dead-end, never a generic error).
 *   - any truthy side (`claimed` / `already_active` / `already_observer`) →
 *     `select_side`: open the room on that side (preserves today's select flow).
 *   - otherwise (`unavailable` / `error` with no side) → `none`.
 */
export function resolveJoinSideEffect(result: {
  side: ParticipantSide | null;
  outcome: JoinOutcomeKind;
}): JoinSideEffect {
  if (result.outcome === 'room_full') return { kind: 'full_room_observe' };
  if (result.side !== null) return { kind: 'select_side', side: result.side };
  return { kind: 'none' };
}

// ── Ban-list support ────────────────────────────────────────────

/**
 * Forbidden tokens scanned by `__tests__/seatClaimModel.doctrine.test.ts`. NOT
 * a content filter. Mirrors the sibling pure-model ban lists
 * (`_forbiddenChimeInGovernanceTokens`, `_forbiddenArgumentRoomCreationTokens`):
 * every string this model can emit describes the ROOM's seat structure, never a
 * verdict, never a person, never heat / popularity. "full" / "observe" are seat
 * facts, never judgments.
 */
export function _forbiddenSeatClaimTokens(): string[] {
  return [
    // Verdict tokens
    'winner',
    'loser',
    'correct',
    'incorrect',
    'truth',
    'true',
    'false',
    'right',
    'wrong',
    'won',
    'lost',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'stupid',
    'idiot',
    // Amplification tokens
    'popular',
    'trending',
    'viral',
    'upvote',
    'downvote',
    'vote',
    // Punitive / removal tokens — a full room is never a punishment
    'booted',
    'kicked',
    'banned',
    'removed',
    'rejected',
    'blocked',
    'silenced',
    // Person-attribution tokens
    'troll',
    'bot',
    'challenger',
    'opponent',
  ];
}
