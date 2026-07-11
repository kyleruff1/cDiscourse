/**
 * P8-CHIMEIN-ARC Round 1 (#680) -- 1:1-first room LIFECYCLE transition machine.
 *
 * Pure TypeScript. NO React, NO Supabase, NO network, NO AI imports; no
 * mutation, no clock, no randomness. JSON-serializable in and out; frozen
 * outputs; deterministic -- mirrors `src/domain/constitution/engine.ts`
 * discipline and the sibling `oneToOneRoomModel.ts` pure-model discipline.
 *
 * WHAT THIS IS (the #680 residue)
 *   The shipped `oneToOneRoomModel.ts` (UX-ROOM-1V1-CHIMEIN-001A, #737/#738) is a
 *   SNAPSHOT classifier: given a snapshot of already-derived inputs it answers
 *   "what display state is the room in?". It models NO events, NO R->R edges, NO
 *   principal-voice count, and asserts NEITHER the chime-never-increments-
 *   principal-count NOR the chime-never-touches-argument-structure invariant that
 *   #680 acceptance requires. This file is the additive TRANSITION layer over
 *   that snapshot layer: an event-driven `applyRoomLifecycleEvent(state, event)`
 *   that walks the R1-R7 reference states and PROJECTS BACK to the shipped
 *   `RoomOneToOneDisplayState` union (reuse, never re-derive). It imports the
 *   display union + `chimeInAllowed` + the shipped classifier from
 *   `oneToOneRoomModel.ts`; it does not touch, rewrite, or duplicate them.
 *
 * WHAT THIS IS NOT
 *   - It adds NO write path, NO persisted field, NO capacity enforcement beyond
 *     the in-memory counter. The chime-in CONTRIBUTION path (persisted marker +
 *     Edge + flag) is Round 2 (#761), operator-gated; NONE of it is built here.
 *   - It is ROOM-scoped, not VIEWER-scoped: it never produces `observer_reading`
 *     (that is a viewer-perspective classification the snapshot model returns
 *     when viewer flags are present). The lifecycle produces only the room-level
 *     projections.
 *   - The machine carries NO argument-structural field of any kind. That absence
 *     is the structural proof of the "chime never sets an argument row structural
 *     state" invariant -- the machine cannot mutate a field it does not model.
 *
 * DOCTRINE (cdiscourse-doctrine sections 1 / 2 / 3 / 10a)
 *   - Every phase and every projected display state describes a STRUCTURAL
 *     room/seat/participation fact, never a verdict, never heat, never
 *     popularity. Seat order and seat count carry no popularity input.
 *   - A chime-in is a bounded contribution ROLE, never a third principal voice
 *     and never an argument row structural state (CIVILDISCOURSE-V4 L849/L855).
 *     `applyRoomLifecycleEvent` never writes `principalVoiceCount` on a chime
 *     event; the state object declares no argument-structural field to write.
 *   - Private rooms have no chime-ins: `chimeInAllowed` is public-only, so a
 *     private lifecycle has capacity 0 and every chime event is a no-op.
 *   - The GAME-005 chime capacity (3) is IMPORTED from `publicSeatModel`
 *     (PUBLIC_ROOM_SEAT_CAP - PRIMARY_SEAT_COUNT), never re-literal'd -- one
 *     source of truth (orchestrator ruling: cap is ROOM-level).
 *
 * ROUND-1 / ROUND-2 SPLIT
 *   Everything in this file is pure model + tests + docs and mutates no backend,
 *   so it is Round 1 (closes #680). Anything that persists a marker, deploys an
 *   Edge, or flips UI from dormant to active is Round 2 (#761) and lives on a
 *   held branch. See docs/designs/P8-CHIMEIN-ARC.md sections 2 and 11.
 */

import type { RoomOneToOneDisplayState } from './oneToOneRoomModel';
import {
  chimeInAllowed,
  deriveRoomOneToOneDisplayState,
  _forbiddenOneToOneTokens,
} from './oneToOneRoomModel';
import { PUBLIC_ROOM_SEAT_CAP, PRIMARY_SEAT_COUNT } from './publicSeatModel';

// ── Room-level chime capacity (GAME-005 one source of truth) ────

/**
 * Room-level chime-in capacity = PUBLIC_ROOM_SEAT_CAP (5) - PRIMARY_SEAT_COUNT
 * (2) = 3. Imported and derived, never re-literal'd -- a tuning change is one
 * edit in `publicSeatModel`. Orchestrator ruling: the cap is ROOM-level; the
 * per-point scoping dimension (`target_argument_id`) is a Round-2 data-model
 * concern and is not modelled here.
 */
export const CHIME_IN_CAP_PUBLIC = PUBLIC_ROOM_SEAT_CAP - PRIMARY_SEAT_COUNT;

// ── The lifecycle phase vocabulary (R1-R7 reference states) ─────

/**
 * The R1-R7 reference lifecycle phases (from the #680 body / CivilDiscourse v4).
 *
 *  - `r1_created`             R1: created + visibility chosen. Atomic -- the
 *                             `create` event carries visibility, so the machine
 *                             resolves R1 directly into the first stable phase
 *                             (r2 public / r6 private). Retained in the
 *                             vocabulary and kept projection-total; never a
 *                             settled phase from any event.
 *  - `r2_respondent_seat_open` R2: public, the second PRINCIPAL (respondent) seat
 *                             is open. NOT a chime seat.
 *  - `r3_two_principals`      R3: public, both principal seats held; the chime
 *                             affordance opens (3 seats free).
 *  - `r4_chime_in_attached`   R4: public, one or more chime-ins attached;
 *                             principals stay primary.
 *  - `r5_chime_seats_full`    R5: public, chime seats full -> observe-only, the
 *                             ledger stays readable.
 *  - `r6_private_invited`     R6: private -- invited access, the no-chime guard.
 *  - `unknown`                inputs insufficient / not created yet.
 */
export type RoomLifecyclePhase =
  | 'r1_created'
  | 'r2_respondent_seat_open'
  | 'r3_two_principals'
  | 'r4_chime_in_attached'
  | 'r5_chime_seats_full'
  | 'r6_private_invited'
  | 'unknown';

/** Frozen list -- tests iterate this; projection parity iterates this. */
export const ALL_ROOM_LIFECYCLE_PHASES: ReadonlyArray<RoomLifecyclePhase> = Object.freeze([
  'r1_created',
  'r2_respondent_seat_open',
  'r3_two_principals',
  'r4_chime_in_attached',
  'r5_chime_seats_full',
  'r6_private_invited',
  'unknown',
]);

// ── The event set ───────────────────────────────────────────────

/**
 * The lifecycle events. `create` carries the chosen visibility (R1 is atomic).
 * The chime events are bounded + capacity-aware; a chime event is ALWAYS a
 * no-op in a private lifecycle (the public-only guard).
 */
export type RoomLifecycleEvent =
  | { kind: 'create'; visibility: 'public' | 'private' }
  | { kind: 'respondent_seat_taken' }
  | { kind: 'chime_in_attached' }
  | { kind: 'chime_in_retracted' };

/** Frozen list of the event kinds -- tests iterate this. */
export const ALL_ROOM_LIFECYCLE_EVENT_KINDS: ReadonlyArray<RoomLifecycleEvent['kind']> =
  Object.freeze(['create', 'respondent_seat_taken', 'chime_in_attached', 'chime_in_retracted']);

// ── The lifecycle state ─────────────────────────────────────────

/**
 * The lifecycle state. Flat + JSON-serializable + frozen. NOTE the fields it
 * does NOT have: there is NO argument-structural field, NO score/standing field,
 * NO principal-seat identity. A chime event can only ever move
 * `phase`/`chimeInSeatsFilled`/`observeOnly`/`chimeComposerAvailable`/
 * `displayState`; it can never move `principalVoiceCount`, `visibility`, or
 * `chimeInCap`, and there is no argument-structural field for it to reach.
 */
export interface RoomLifecycleState {
  /** The R1-R7 phase. */
  phase: RoomLifecyclePhase;
  /** 'public' | 'private' once created; null before creation / on bad input. */
  visibility: 'public' | 'private' | null;
  /**
   * The number of PRINCIPAL voices held. 0 before creation, 1 after create
   * (the initiator), 2 once the respondent seat is taken. NEVER exceeds 2 and a
   * chime event NEVER changes it (enforced invariant B).
   */
  principalVoiceCount: 0 | 1 | 2;
  /** Active chime-ins attached. 0..chimeInCap. */
  chimeInSeatsFilled: number;
  /** Chime capacity: CHIME_IN_CAP_PUBLIC (3) for public, 0 for private. */
  chimeInCap: number;
  /**
   * True in r5 (chime seats full) and r6 (private) -- the "observe-only, ledger
   * readable" fact. A would-be chimer who finds the seats full observes; a
   * non-principal in a private room observes.
   */
  observeOnly: boolean;
  /**
   * Whether the point-scoped chime composer MAY appear. Reuses `chimeInAllowed`
   * + two-principals + open capacity. ALWAYS backed by a real free seat; the
   * actual control stays DORMANT until Round 2 activates it.
   */
  chimeComposerAvailable: boolean;
  /**
   * Projection to the shipped snapshot union -- reuse, never re-derive. Always
   * equals `projectToDisplayState(state)`.
   */
  displayState: RoomOneToOneDisplayState;
}

/** The minimal core the transition table sets; derived fields are computed. */
interface RoomLifecycleCore {
  phase: RoomLifecyclePhase;
  visibility: 'public' | 'private' | null;
  principalVoiceCount: 0 | 1 | 2;
  chimeInSeatsFilled: number;
  chimeInCap: number;
}

// ── Derivation (one place computes the derived fields) ──────────

/**
 * Project a core onto the shipped display union by REUSING the snapshot
 * classifier `deriveRoomOneToOneDisplayState`. The lifecycle machine is
 * room-scoped, so it passes no viewer flags -- `observer_reading` is a
 * viewer-perspective state the snapshot model returns elsewhere.
 */
function deriveDisplayFromCore(core: RoomLifecycleCore): RoomOneToOneDisplayState {
  if (core.visibility !== 'public' && core.visibility !== 'private') {
    return 'unknown';
  }
  // The second principal (respondent) seat is open until two principals hold.
  const opponentSeatIsOpen = core.principalVoiceCount < 2;
  const openChimeInSeatCount =
    core.visibility === 'public' ? core.chimeInCap - core.chimeInSeatsFilled : null;
  return deriveRoomOneToOneDisplayState({
    visibility: core.visibility,
    opponentSeatIsOpen,
    openChimeInSeatCount,
  });
}

/** Build a fully-derived, frozen state from a core. */
function buildState(core: RoomLifecycleCore): RoomLifecycleState {
  const observeOnly = core.phase === 'r5_chime_seats_full' || core.phase === 'r6_private_invited';
  const chimeComposerAvailable =
    chimeInAllowed(core.visibility) &&
    core.principalVoiceCount === 2 &&
    core.chimeInCap - core.chimeInSeatsFilled > 0;
  return Object.freeze({
    phase: core.phase,
    visibility: core.visibility,
    principalVoiceCount: core.principalVoiceCount,
    chimeInSeatsFilled: core.chimeInSeatsFilled,
    chimeInCap: core.chimeInCap,
    observeOnly,
    chimeComposerAvailable,
    displayState: deriveDisplayFromCore(core),
  });
}

/** Narrow an unknown value to a usable lifecycle state (defensive). */
function isRoomLifecycleState(value: unknown): value is RoomLifecycleState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<RoomLifecycleState>;
  return (
    typeof v.phase === 'string' &&
    (ALL_ROOM_LIFECYCLE_PHASES as ReadonlyArray<string>).includes(v.phase) &&
    (v.visibility === 'public' || v.visibility === 'private' || v.visibility === null) &&
    typeof v.principalVoiceCount === 'number' &&
    typeof v.chimeInSeatsFilled === 'number' &&
    typeof v.chimeInCap === 'number'
  );
}

/** Re-derive a fresh frozen state from an existing one (a structural no-op). */
function refreeze(state: RoomLifecycleState): RoomLifecycleState {
  return buildState({
    phase: state.phase,
    visibility: state.visibility,
    principalVoiceCount: state.principalVoiceCount,
    chimeInSeatsFilled: state.chimeInSeatsFilled,
    chimeInCap: state.chimeInCap,
  });
}

// ── Public API ──────────────────────────────────────────────────

/**
 * The initial lifecycle state: phase `unknown`, all counts 0, no visibility.
 * `create` is the only event that moves it off `unknown`.
 */
export function initialRoomLifecycleState(): RoomLifecycleState {
  return buildState({
    phase: 'unknown',
    visibility: null,
    principalVoiceCount: 0,
    chimeInSeatsFilled: 0,
    chimeInCap: 0,
  });
}

/**
 * Apply one event to a lifecycle state and return the next frozen state. Pure,
 * deterministic, side-effect free. A malformed state resets to the initial
 * state; a malformed / unrecognized event is a no-op (idempotent).
 *
 * Transition table (fixed decision order):
 *  - create{public}          from unknown -> r2, principalVoiceCount 1, cap 3.
 *  - create{private}         from unknown -> r6, cap 0, observe-only (guard 1).
 *  - create{...} elsewhere   no-op (a room is created once).
 *  - respondent_seat_taken   on r2 -> r3, principalVoiceCount 2; else no-op.
 *  - chime_in_attached       public + two principals: free seat -> r4 (+1);
 *                            at cap -> r5 observe-only, counter UNCHANGED
 *                            (guard 2). Private / not established -> no-op.
 *  - chime_in_retracted      public + two principals + a filled seat: free one;
 *                            r5 -> r4, last one -> r3. Else no-op.
 */
export function applyRoomLifecycleEvent(
  state: RoomLifecycleState,
  event: RoomLifecycleEvent,
): RoomLifecycleState {
  const current: RoomLifecycleState = isRoomLifecycleState(state)
    ? state
    : initialRoomLifecycleState();

  if (!event || typeof event !== 'object') {
    return refreeze(current);
  }

  switch (event.kind) {
    case 'create': {
      // R1 is atomic (visibility carried) and a room is created once.
      if (current.phase !== 'unknown') return refreeze(current);
      if (event.visibility === 'public') {
        return buildState({
          phase: 'r2_respondent_seat_open',
          visibility: 'public',
          principalVoiceCount: 1,
          chimeInSeatsFilled: 0,
          chimeInCap: CHIME_IN_CAP_PUBLIC,
        });
      }
      if (event.visibility === 'private') {
        // Guard 1 -- private-no-chime: capacity 0, observe-only, chime events
        // are no-ops from here.
        return buildState({
          phase: 'r6_private_invited',
          visibility: 'private',
          principalVoiceCount: 1,
          chimeInSeatsFilled: 0,
          chimeInCap: 0,
        });
      }
      return refreeze(current); // unrecognized visibility -> stay unknown
    }

    case 'respondent_seat_taken': {
      // Opens the second PRINCIPAL seat. Only meaningful from r2; idempotent
      // everywhere else. This is the ONLY event that moves principalVoiceCount.
      if (current.phase !== 'r2_respondent_seat_open') return refreeze(current);
      return buildState({
        phase: 'r3_two_principals',
        visibility: current.visibility,
        principalVoiceCount: 2,
        chimeInSeatsFilled: current.chimeInSeatsFilled,
        chimeInCap: current.chimeInCap,
      });
    }

    case 'chime_in_attached': {
      // Guard 1 -- private (or not-yet-public) lifecycle: no-op.
      if (!chimeInAllowed(current.visibility)) return refreeze(current);
      // Chime only makes sense once the two principals are established.
      if (current.principalVoiceCount !== 2) return refreeze(current);
      if (current.chimeInSeatsFilled < current.chimeInCap) {
        // A free chime seat -- attach one, stay r4. principalVoiceCount is NOT
        // touched (invariant B).
        return buildState({
          phase: 'r4_chime_in_attached',
          visibility: current.visibility,
          principalVoiceCount: current.principalVoiceCount,
          chimeInSeatsFilled: current.chimeInSeatsFilled + 1,
          chimeInCap: current.chimeInCap,
        });
      }
      // Guard 2 -- seats-full-observe-only: at cap, an attach does NOT add a
      // seat; the would-be chimer observes. Counter + principalVoiceCount
      // UNCHANGED; the ledger phase (r5) stays readable.
      return buildState({
        phase: 'r5_chime_seats_full',
        visibility: current.visibility,
        principalVoiceCount: current.principalVoiceCount,
        chimeInSeatsFilled: current.chimeInSeatsFilled,
        chimeInCap: current.chimeInCap,
      });
    }

    case 'chime_in_retracted': {
      if (!chimeInAllowed(current.visibility)) return refreeze(current);
      if (current.principalVoiceCount !== 2) return refreeze(current);
      if (current.chimeInSeatsFilled <= 0) return refreeze(current); // nothing to free
      const nextFilled = Math.max(0, current.chimeInSeatsFilled - 1);
      const nextPhase: RoomLifecyclePhase =
        nextFilled <= 0 ? 'r3_two_principals' : 'r4_chime_in_attached';
      return buildState({
        phase: nextPhase,
        visibility: current.visibility,
        principalVoiceCount: current.principalVoiceCount,
        chimeInSeatsFilled: nextFilled,
        chimeInCap: current.chimeInCap,
      });
    }

    default:
      // Unrecognized event kind -- no-op (idempotent).
      return refreeze(current);
  }
}

/**
 * Project a lifecycle state onto the shipped `RoomOneToOneDisplayState` union by
 * reusing the snapshot classifier. Always equals `state.displayState`.
 */
export function projectToDisplayState(state: RoomLifecycleState): RoomOneToOneDisplayState {
  if (!isRoomLifecycleState(state)) return 'unknown';
  return deriveDisplayFromCore(state);
}

// ── Ban-list support ────────────────────────────────────────────

/**
 * Forbidden tokens scanned by `__tests__/oneToOneRoomLifecycle.test.ts`. Reuses
 * the shipped display-model avoid-list `_forbiddenOneToOneTokens` (one source of
 * truth) -- this machine authors NO new user-facing copy, so the scan covers the
 * phase / event vocabulary and any string the projection reuses. Every string
 * this layer can surface describes a STRUCTURAL room/seat/participation state,
 * never a verdict, never a person, never heat / popularity, never a comment /
 * forum / social-feed framing.
 */
export function _forbiddenRoomLifecycleTokens(): string[] {
  return _forbiddenOneToOneTokens();
}
