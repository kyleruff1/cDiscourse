/**
 * QOL-039 — Room visibility model.
 *
 * Pure TypeScript. NO React, NO Supabase, NO network, NO AI imports.
 * Unit-testable in isolation.
 *
 * Defines the eligibility check, consequences builder, and event shape that
 * the visibility-transition flow uses. The `record-visibility-transition`
 * Edge Function consumes the same types (via the client wrapper that calls
 * it); the QOL-040 `room-notifications` Edge Function consumes the flat
 * `priorReadAccessIds` array carried by `RoomVisibilityChangeEvent`.
 *
 * Doctrine encoded:
 *   - Visibility is an access property of the room, NEVER a verdict.
 *   - Making a room private is a structural transition, never a punishment.
 *   - `public → private` is the only legal transition; `private → public`
 *     is forbidden by the DB trigger AND by this model (there is no
 *     `canTransitionToPublic`).
 *   - Heat / popularity / standing are never inputs.
 *   - Every user-facing string lives in ROOM_VISIBILITY_COPY (gameCopy.ts),
 *     never inlined here.
 */
import type { MovedToObserverRecord, PublicRoomSeatMap } from './publicSeatModel';
import { ROOM_VISIBILITY_COPY } from '../arguments/gameCopy';

// ── Types ─────────────────────────────────────────────────────

export type RoomVisibility = 'public' | 'private';

export const ALL_ROOM_VISIBILITIES: ReadonlyArray<RoomVisibility> = Object.freeze([
  'public',
  'private',
]);

/**
 * Stable internal reason code for `canTransitionToPrivate`. Each value maps
 * to a plain-language string via `gameCopy.toPlainLanguage` — raw codes
 * NEVER reach a user-facing surface.
 */
export type TransitionReason =
  | 'eligible'
  | 'already_private'
  | 'not_room_creator'
  | 'room_archived';

export const ALL_TRANSITION_REASONS: ReadonlyArray<TransitionReason> = Object.freeze([
  'eligible',
  'already_private',
  'not_room_creator',
  'room_archived',
]);

/**
 * Input to `canTransitionToPrivate`. The model is pure: every signal needed
 * to decide eligibility is passed in.
 *
 * The `callerIsModeratorOrAdmin` field is RESERVED per OD-1 — it stays in
 * the type so the model surface is stable when QOL-040.2 (mod-initiated
 * transitions) lands, but the v1 gate ignores it. See `canTransitionToPrivate`
 * implementation for the explanation.
 */
export interface VisibilityTransitionContext {
  roomId: string;
  currentVisibility: RoomVisibility;
  roomStatus: 'draft' | 'open' | 'locked' | 'archived';
  callerUserId: string;
  createdByUserId: string;
  /**
   * RESERVED per OD-1. Not consumed by `canTransitionToPrivate` in v1.
   * The DB+RLS layer keeps the existing creator-OR-mod permission as
   * defense-in-depth; this UI/model layer enforces creator-only because
   * QOL-040's shipped `room-notifications` `handleRoomMadePrivate` only
   * accepts the creator as the authorized actor. Widening the UI gate
   * without widening the notification path would produce a partial-success
   * state where the room becomes private but retained participants get no
   * notification.
   *
   * QOL-040.2 (if filed) would extend room-notifications to accept mod
   * actors and re-introduce this field at the UI gate.
   */
  callerIsModeratorOrAdmin: boolean;
}

/** The result shape — `allowed` is a boolean, `reason` is the stable code. */
export interface TransitionEligibility {
  allowed: boolean;
  reason: TransitionReason;
}

/**
 * The structured list of consequences shown in the confirmation modal. The
 * UI renders each `effect` as a bullet, fetching its plain-language string
 * from `ROOM_VISIBILITY_COPY` — never via prose concatenation inline.
 */
export type TransitionEffect =
  | 'leaves_public_list'
  | 'non_participants_lose_read'
  | 'participants_keep_access'
  | 'content_unchanged'
  | 'chime_in_branches_retained'
  | 'one_way';

export const ALL_TRANSITION_EFFECTS: ReadonlyArray<TransitionEffect> = Object.freeze([
  'leaves_public_list',
  'non_participants_lose_read',
  'participants_keep_access',
  'content_unchanged',
  'chime_in_branches_retained',
  'one_way',
]);

export interface TransitionConsequences {
  /**
   * Stable codes; each maps to a neutral ROOM_VISIBILITY_COPY bullet.
   * Always returns the same six codes when the transition is eligible,
   * never varies its meaning per room — only `retainedChimeInBranchCount`
   * varies the wording of the chime-in bullet.
   */
  effects: ReadonlyArray<TransitionEffect>;
  /**
   * Count of chime-in branches that are currently observer_only (muted)
   * per GAME-005. Drives the `chime_in_branches_retained` bullet wording.
   * 0 omits that nuance but the `content_unchanged` bullet still shows.
   */
  retainedChimeInBranchCount: number;
}

/**
 * The structured event the `record-visibility-transition` Edge Function
 * emits and the QOL-040 `room-notifications` Edge Function consumes.
 *
 * v1 invariant: `from === 'public' && to === 'private'`. The shape is
 * locked to the flat arrays that match the shipped QOL-040 contract — the
 * Edge Function strips current primaries defensively on the receiving side
 * and recomputes retained-primary identity from `debate_participants`.
 *
 * Carries ONLY ids — NEVER an argument body, NEVER evidence detail. The
 * Edge Function NEVER puts argument body text into the notification
 * payload. See §5.5 of the design (redaction contract).
 *
 * Excludes pending QOL-038 invitees from `priorReadAccessIds` — they could
 * not read the debate before the transition; their invite remains valid
 * post-transition (per E1.8).
 */
export interface RoomVisibilityChangeEvent {
  roomId: string;
  from: 'public';
  to: 'private';
  /** The creator (per OD-1) who performed the transition. */
  actorUserId: string;
  /** ISO timestamp the server recorded the successful UPDATE. */
  occurredAt: string;
  /**
   * Every user who had read access BEFORE the transition. Includes
   * current primaries (the Edge Function strips them defensively).
   * Derived by `record-visibility-transition` from `debate_participants`
   * + GAME-005's seat map at the moment of the UPDATE.
   */
  priorReadAccessIds: ReadonlyArray<string>;
  /**
   * For follow-up `chime_in_rejected` notifications. Populated from
   * GAME-005's `MovedToObserverRecord` set. Each entry triggers a
   * SEPARATE `room-notifications` call with `type='chime_in_rejected'` —
   * they are NOT part of the `room_made_private` payload.
   */
  rejectedChimeInUserIds: ReadonlyArray<string>;
  /**
   * The same chime-in moves identified by their argument IDs. Used for
   * the audit row's `rejected_chime_in_ids` column AND for the
   * `chime_in_rejected` notification's `argumentId` deep-link target.
   * Length matches `rejectedChimeInUserIds` (one entry per rejected chime-in).
   */
  rejectedChimeInArgumentIds: ReadonlyArray<string>;
}

// ── canTransitionToPrivate ────────────────────────────────────

/**
 * Decide whether the caller may transition this room from public to private.
 *
 * OD-1 gate: creator-only at the UI/model layer. The
 * `callerIsModeratorOrAdmin` field on `VisibilityTransitionContext` is
 * RESERVED but ignored in v1 because:
 *
 *   1. QOL-040's shipped `room-notifications` `handleRoomMadePrivate`
 *      only accepts the creator as the authorized actor. A mod-initiated
 *      transition would succeed at the DB+RLS layer but fail at the
 *      notification dispatch layer, producing a partial-success state
 *      where the room becomes private but retained participants get no
 *      notification.
 *   2. Visibility is a creator decision — the creator framed the original
 *      argument and chose public-vs-private at room creation; transitioning
 *      to private is a refinement of that original choice rather than a
 *      moderation action.
 *   3. Mods retain advisory influence (they can communicate with the
 *      creator); the creator then performs the transition.
 *
 * Follow-up: if mod-initiated transitions are later needed, file QOL-040.2
 * to extend `room-notifications` AND widen this gate.
 *
 * One-way: there is intentionally NO `canTransitionToPublic` — re-exposing
 * a private room is forbidden by the DB trigger AND by the model surface.
 */
export function canTransitionToPrivate(
  ctx: VisibilityTransitionContext,
): TransitionEligibility {
  // Already-private — action hidden (no silent no-op; the action is simply
  // absent from the UI).
  if (ctx.currentVisibility === 'private') {
    return { allowed: false, reason: 'already_private' };
  }
  // OD-1: creator-only gate. The `callerIsModeratorOrAdmin` field stays
  // RESERVED in the context type (so the model surface is stable when
  // QOL-040.2 lands), but the v1 gate ignores it. Mods receive the
  // `not_room_creator` reason just like any other non-creator.
  if (ctx.callerUserId !== ctx.createdByUserId) {
    return { allowed: false, reason: 'not_room_creator' };
  }
  // v1: status never blocks the transition. `room_archived` is reserved in
  // the union as a future blocker if OQ-3 is later answered in the negative.
  return { allowed: true, reason: 'eligible' };
}

// ── buildTransitionConsequences ───────────────────────────────

/**
 * Build the structured consequence list shown in the confirmation modal.
 * Always returns the six fixed effect codes when the transition is eligible.
 * `retainedChimeInBranchCount` is derived from the GAME-005 seat map's
 * `movedToObserver` set (the chime-in branches that are observer-only and
 * stay in the record).
 */
export function buildTransitionConsequences(
  ctx: VisibilityTransitionContext,
  seatMap: PublicRoomSeatMap | null,
): TransitionConsequences {
  const retainedChimeInBranchCount = countChimeInBranchesFromSeatMap(seatMap);
  // Discard the unused argument to keep the model surface stable.
  void ctx;
  return {
    effects: Object.freeze([
      'leaves_public_list',
      'non_participants_lose_read',
      'participants_keep_access',
      'content_unchanged',
      'chime_in_branches_retained',
      'one_way',
    ]),
    retainedChimeInBranchCount,
  };
}

/**
 * Count the chime-in branches that are observer-only via GAME-005's
 * governance set — the branches that STAY in the record and become visible
 * only to participants after the transition. Returns 0 for a null seat map
 * (the room is not a public-seat room, e.g. private from creation).
 */
export function countChimeInBranchesFromSeatMap(
  seatMap: PublicRoomSeatMap | null,
): number {
  if (!seatMap) return 0;
  const branchIds = new Set<string>();
  for (const r of seatMap.movedToObserver) {
    if (r.branchId) branchIds.add(r.branchId);
  }
  return branchIds.size;
}

// ── summarizeRejectedChimeInBranches ──────────────────────────

export interface RejectedChimeInBranchSummary {
  /**
   * Unique rejected chime-in user IDs. Drives the recipient set for the
   * QOL-040 `chime_in_rejected` notifications.
   */
  userIds: ReadonlyArray<string>;
  /** Whether ANY chime-in branch was rejected (false if seat map is empty). */
  hasAny: boolean;
  /**
   * Per-user records (read-only copy of the seat map's `movedToObserver`
   * filtered to governance-rejected branches). The Edge Function uses these
   * to look up the matching argument IDs.
   */
  records: ReadonlyArray<MovedToObserverRecord>;
}

/**
 * Summarize the structurally rejected chime-in branches at transition time.
 * "Rejected" means `reason === 'governance'` — overflow observers are NOT
 * rejected (they never held a seat).
 */
export function summarizeRejectedChimeInBranches(
  seatMap: PublicRoomSeatMap | null,
): RejectedChimeInBranchSummary {
  if (!seatMap) {
    return { userIds: Object.freeze([]), hasAny: false, records: Object.freeze([]) };
  }
  const governance = seatMap.movedToObserver.filter((r) => r.reason === 'governance');
  const seenUsers = new Set<string>();
  const userIds: string[] = [];
  for (const r of governance) {
    if (r.userId && !seenUsers.has(r.userId)) {
      seenUsers.add(r.userId);
      userIds.push(r.userId);
    }
  }
  return {
    userIds: Object.freeze(userIds),
    hasAny: governance.length > 0,
    records: Object.freeze(governance.slice()),
  };
}

// ── Re-export the copy block so callers stay model-scoped ────

export { ROOM_VISIBILITY_COPY };
