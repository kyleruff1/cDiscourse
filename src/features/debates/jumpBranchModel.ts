/**
 * GAME-006 — Jump Branch: once-per-room cross-branch participation.
 *
 * Pure TypeScript. No React, no Supabase, no network, no AI. JSON-serializable
 * inputs and outputs so the same model could run in an Edge Function later if a
 * follow-up persistence card needs it server-side.
 *
 * This model EXTENDS the GAME-005 public-room seat layer (`publicSeatModel.ts`)
 * and CONSUMES the GAME-004 room contract (`roomContractModel.ts`) and the
 * BR-004 branch grammar (`branchGrammarModel.ts`). It re-derives nothing those
 * cards own — it projects their structural facts into the Jump-Branch surface.
 *
 * Doctrine anchor — read this before changing anything in this file:
 *
 *   - A Jump describes structural MOVEMENT, never a verdict, never a quality
 *     or truth signal, never anything about the person. The old-branch marker
 *     and the arrival marker describe WHERE a participant is engaging, not
 *     WHO is right. A jump is never a desertion — the old branch is kept on
 *     the record in full.
 *   - The Jump action is deliberate and CONFIRM-REQUIRED — never accidental,
 *     never a side effect of scrolling or tapping. The `JumpControlViewModel`
 *     carries the confirm-step copy so a component cannot ship the action
 *     without the two-step gate.
 *   - Eligibility (`canJump`) is DETERMINISTIC — rate (the once-per-room cap),
 *     destination-branch state, and seat state are the only inputs. Heat,
 *     popularity, reply count, view count, and standing are NEVER read. This
 *     file imports nothing from any score / standing / heat / anti-amplification
 *     module.
 *   - A jump is DERIVED, not persisted. `JumpBranchRecord` and the once-per-room
 *     counter `jumpsUsed` are recomputed on every room load from existing
 *     `arguments` rows — a jump IS a move whose branch placement differs from
 *     the participant's home branch. There is NO jump_branch_records table and
 *     NO migration. A jump commits through the EXISTING `submit-argument` path.
 *   - No silent no-op: every disabled Jump control carries a visible
 *     plain-language reason mapped from the failing `JumpDenyReason`.
 */

import type {
  RoomContract,
  RoomArgumentInput,
  QualifyingResponseSignals,
} from './roomContractModel';
import { isQualifyingResponse } from './roomContractModel';
import type { SeatRole, PublicRoomSeatMap } from './publicSeatModel';
import type {
  BranchDirection,
  BranchGrammarNode,
} from '../arguments/branchGrammarModel';
import { JUMP_BRANCH_COPY } from '../arguments/gameCopy';
import { formatRelativeShort } from '../../lib/formatDateTime';

// ── MAX_JUMPS_PER_ROOM — the once-per-room jump cap ──────────────

/**
 * GAME-006 — the once-per-room jump cap. The card's default rule is "one jump
 * per public-room participant per room". A single named constant so OD-1 (does
 * a jump ever reset / can a room allow more) is a one-edit tuning. Proposed: 1.
 */
export const MAX_JUMPS_PER_ROOM = 1;

// ── JumpBranchRecord — the card's named shape (derived, never persisted) ──

/**
 * GAME-006 — one Jump Branch event. The card names the four core fields
 * verbatim. GAME-006 keeps that shape and DERIVES every field at read-time
 * from an existing `arguments` row — a jump IS a move whose branch placement
 * differs from the participant's home branch. Never persisted as its own row;
 * recomputed on every room load.
 */
export interface JumpBranchRecord {
  /** The chime-in participant who jumped. `arguments.author_id`. */
  participantUserId: string;
  /**
   * The BR-004 branchId the participant was engaged on BEFORE the jump —
   * the branch the participant's previous qualifying move sat on.
   */
  fromBranchId: string;
  /**
   * The BR-004 branchId the participant jumped INTO — the branch of the move
   * that constitutes the jump. May be the mainline branch.
   */
  toBranchId: string;
  /** ISO timestamp of the jump — the `createdAt` of the jumping move. */
  at: string;
  /**
   * GAME-006 INTERNAL (not in the card's four-field shape, but required for
   * the derivation to be auditable + idempotent): the `arguments.id` of the
   * move that constitutes this jump. Lets the UI anchor the arrival marker to
   * a concrete message and lets a test pin exactly which move was read as the
   * jump. Never rendered as raw text.
   */
  viaArgumentId: string;
}

// ── JumpEligibility — the `canJump` result (the card's named shape) ──

/**
 * GAME-006 — why a Jump is not currently allowed. Drives the disabled-state
 * reason copy — the card's explicit "no silent no-op" requirement.
 */
export type JumpDenyReason =
  | 'not_a_chime_in' //         OP / Primary Opponent / observer — only
  //                            public-room chime-ins may Jump Branch
  | 'no_active_seat' //         the participant was moved to observer
  //                            (GAME-005) — no active seat, cannot jump
  | 'jump_already_used' //      the once-per-room jump is spent
  | 'destination_is_home' //    the destination is the participant's own
  //                            home branch — that is not a jump
  | 'destination_closed' //     the destination branch is collapsed /
  //                            observer-only / not open to engagement
  | 'destination_unknown' //    the destination branchId is not in the room
  | 'destination_needs_approval'; // OD-2 future: destination requires
//                                  arrival approval (v1: never returned)

/** Frozen list of every deny reason. Tests iterate this; copy coverage too. */
export const ALL_JUMP_DENY_REASONS: ReadonlyArray<JumpDenyReason> = Object.freeze([
  'not_a_chime_in',
  'no_active_seat',
  'jump_already_used',
  'destination_is_home',
  'destination_closed',
  'destination_unknown',
  'destination_needs_approval',
]);

/**
 * GAME-006 — the result of `canJump`. The card names the shape
 * `{ ok: boolean, reason }`. `reason` is null when ok === true; the first
 * failing `JumpDenyReason` otherwise. v1 maps it through `JUMP_BRANCH_COPY`.
 */
export interface JumpEligibility {
  ok: boolean;
  /** null when ok === true; the first failing reason otherwise. */
  reason: JumpDenyReason | null;
}

// ── BranchEngagementState — the destination-branch-state input ──

/**
 * GAME-006 — the engagement state of one branch, as far as a Jump cares. A
 * small derived projection — NOT a new persisted concept. Built by
 * `buildBranchEngagementMap` from the BR-004 grammar map + the GAME-005 seat
 * map. Carries only STRUCTURAL facts — never heat, never reply count as a
 * quality signal.
 */
export interface BranchEngagementState {
  branchId: string;
  /** The BR-004 direction — mainline / chime_in_vertical / tangent /
   *  evidence_passthrough. Consumed from `BranchGrammarNode.direction`. */
  direction: BranchDirection;
  /**
   * True when the branch is open to a new engaging move. A branch is CLOSED
   * to a jump when its owning chime-in has been moved to observer by GAME-005
   * governance (the branch collapsed into "Side branches"), OR when it is an
   * `evidence_passthrough` branch (evidence threads are not a chime-in
   * engagement target — BR-004 owns their semantics). The mainline and any
   * active chime_in_vertical / tangent_diagonal branch are open.
   */
  openToEngagement: boolean;
  /** True when this is the mainline branch (BR-004 'mainline'). A jump INTO
   *  the mainline is allowed; the participant still cannot become a primary
   *  seat (GAME-004 governs seats). */
  isMainline: boolean;
}

// ── JumpControlViewModel — the read-time UI contract for the action ──

/**
 * GAME-006 — the view-model the confirm-required Jump control renders. Pure
 * data, no JSX. Built by `buildJumpControlViewModel`.
 */
export interface JumpControlViewModel {
  /** The participant the control is for (the viewer, when they are a
   *  chime-in). Never rendered as raw text. */
  participantUserId: string;
  /** The destination branch the control would jump into. */
  destinationBranchId: string;
  /** The plain-language action label — e.g. "Jump to this branch". */
  actionLabel: string;
  /** Whether the action is enabled. False => the control renders disabled
   *  with `disabledReasonLabel` visible (no silent no-op). */
  enabled: boolean;
  /** Plain-language reason the action is disabled, or null when enabled.
   *  Mapped from the `JumpDenyReason` via `JUMP_BRANCH_COPY`. */
  disabledReasonLabel: string | null;
  /**
   * The confirm-step copy — shown when the user taps the (enabled) action,
   * BEFORE the jump commits. The jump is deliberate: it only proceeds on an
   * explicit confirm.
   */
  confirmPrompt: string;
  /** The confirm-button label, e.g. "Yes, jump". */
  confirmLabel: string;
  /** The cancel-button label, e.g. "Stay here". */
  cancelLabel: string;
  /** Full screen-reader label for the action control. */
  accessibilityLabel: string;
  /** Screen-reader hint describing the confirm step. */
  accessibilityHint: string;
}

// ── JumpMarkerViewModel — the old-branch + arrival markers ──

/** GAME-006 — which structural marker this view-model describes. */
export type JumpMarkerKind = 'departed_from' | 'arrived_at';

/**
 * GAME-006 — one structural Jump marker. `departed_from` renders on the
 * participant's OLD branch ("moved to another branch"); `arrived_at` renders
 * on the DESTINATION branch ("a participant joined this branch"). Pure data;
 * describes structural MOVEMENT, never the person, never a verdict. Built by
 * `buildJumpMarkers`.
 */
export interface JumpMarkerViewModel {
  kind: JumpMarkerKind;
  /** The branch this marker renders on. */
  branchId: string;
  /** The participant who jumped. Never rendered as raw text — the label is
   *  role-relative ("A chime-in" / "You"), never a person name. */
  participantUserId: string;
  /**
   * For `arrived_at`: the `viaArgumentId` of the jumping move, so the marker
   * can anchor to that timeline node. For `departed_from`: the same id, so
   * the old-branch marker can link "moved to →".
   */
  anchorArgumentId: string;
  /** Plain-language relative time, e.g. "moved 2h ago" / "joined 2h ago".
   *  From `formatRelativeShort` — never a raw timestamp. */
  whenLabel: string;
  /** The plain-language one-line marker text. From `JUMP_BRANCH_COPY`. */
  markerLabel: string;
  /** Full screen-reader label. Plain English, structural, no verdict. */
  accessibilityLabel: string;
}

// ── Internal helpers ────────────────────────────────────────────

/**
 * Chronologically sorted copy of arguments. Sorts by `createdAt` ascending,
 * tie-broken by `id` ascending — identical determinism to GAME-004 / GAME-005.
 * Does NOT mutate the input array.
 */
function sortedChronologically(
  argumentsList: ReadonlyArray<RoomArgumentInput>,
): RoomArgumentInput[] {
  return argumentsList.slice().sort((a, b) => {
    if (a.createdAt < b.createdAt) return -1;
    if (a.createdAt > b.createdAt) return 1;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
}

/**
 * The chronologically-ordered qualifying moves of one participant, each
 * paired with the BR-004 branchId it sits on. A move whose branch placement
 * is unknown (absent from `branchIdByArgumentId`) is skipped — GAME-006 only
 * reasons about moves whose branch it can name. Reuses GAME-004
 * `isQualifyingResponse` verbatim so a one-word non-move, a flagged move, a
 * deletion-requested move, or a bot move never counts as "engaging a branch".
 */
function participantQualifyingMovesOnBranches(
  participantUserId: string,
  args: {
    roomContract: RoomContract;
    arguments: ReadonlyArray<RoomArgumentInput>;
    branchIdByArgumentId: ReadonlyMap<string, string>;
    signals?: QualifyingResponseSignals;
  },
): Array<{ argument: RoomArgumentInput; branchId: string }> {
  const result: Array<{ argument: RoomArgumentInput; branchId: string }> = [];
  for (const argument of sortedChronologically(args.arguments)) {
    if (argument.authorId !== participantUserId) continue;
    if (
      !isQualifyingResponse(argument, {
        initiatorUserId: args.roomContract.initiatorUserId,
        signals: args.signals,
      })
    ) {
      continue;
    }
    const branchId = args.branchIdByArgumentId.get(argument.id);
    if (branchId === undefined) continue;
    result.push({ argument, branchId });
  }
  return result;
}

// ── deriveParticipantHomeBranch ─────────────────────────────────

/**
 * GAME-006 — the BR-004 branchId of a chime-in participant's HOME branch: the
 * branch their FIRST qualifying move opened. Pure. Returns null when the
 * participant has no qualifying move on record (they have not yet become a
 * chime-in). Reuses GAME-004 `isQualifyingResponse` so a one-word non-move
 * never counts as "engaged on a branch".
 *
 * "Home branch" = the branchId of the participant's earliest qualifying move,
 * chosen by createdAt asc, tie-broken by id asc (identical determinism to
 * GAME-004 / GAME-005).
 */
export function deriveParticipantHomeBranch(
  participantUserId: string,
  args: {
    roomContract: RoomContract;
    arguments: ReadonlyArray<RoomArgumentInput>;
    branchIdByArgumentId: ReadonlyMap<string, string>;
    signals?: QualifyingResponseSignals;
  },
): string | null {
  const moves = participantQualifyingMovesOnBranches(participantUserId, args);
  if (moves.length === 0) return null;
  return moves[0].branchId;
}

// ── listJumpsForParticipant ─────────────────────────────────────

/**
 * GAME-006 — the derived list of Jump Branch records for ONE participant in
 * this room, in chronological order. Pure. Deterministic.
 *
 * A jump is detected structurally: walk the participant's qualifying moves in
 * chronological order; their FIRST qualifying move opens / sits on their home
 * branch (no jump). Every later qualifying move whose branchId differs from
 * the branch the participant was last engaging on is a JUMP — its
 * `fromBranchId` is the previously-engaged branch, its `toBranchId` is the new
 * branch, its `at` is the move's createdAt, its `viaArgumentId` is the move's
 * id.
 *
 * v1: because the once-per-room rule caps a participant at one jump, a
 * well-behaved participant produces 0 or 1 records. The function returns ALL
 * detected jumps (it does not truncate) so a test can prove the cap is
 * enforced by `canJump`, not by hiding data — and so a future multi-jump
 * revision (OD-1) needs no model change.
 */
export function listJumpsForParticipant(
  participantUserId: string,
  args: {
    roomContract: RoomContract;
    arguments: ReadonlyArray<RoomArgumentInput>;
    branchIdByArgumentId: ReadonlyMap<string, string>;
    signals?: QualifyingResponseSignals;
  },
): ReadonlyArray<JumpBranchRecord> {
  const moves = participantQualifyingMovesOnBranches(participantUserId, args);
  const records: JumpBranchRecord[] = [];
  if (moves.length < 2) return Object.freeze(records);

  let lastBranchId = moves[0].branchId;
  for (let i = 1; i < moves.length; i += 1) {
    const move = moves[i];
    if (move.branchId === lastBranchId) continue;
    records.push(
      Object.freeze({
        participantUserId,
        fromBranchId: lastBranchId,
        toBranchId: move.branchId,
        at: move.argument.createdAt,
        viaArgumentId: move.argument.id,
      }),
    );
    lastBranchId = move.branchId;
  }
  return Object.freeze(records);
}

// ── jumpsUsed ───────────────────────────────────────────────────

/**
 * GAME-006 — the once-per-room jump counter. The card names this exactly.
 * Returns the number of jumps the participant has already used in this room.
 * v1 default cap is `MAX_JUMPS_PER_ROOM` (= 1); `jumpsUsed` simply returns
 * `listJumpsForParticipant(...).length`. Pure, deterministic, derived — no
 * counter table, no race.
 *
 * `roomId` is part of the card's named signature; the function asserts
 * `roomId === roomContract.roomId` defensively and otherwise returns 0.
 */
export function jumpsUsed(
  roomId: string,
  userId: string,
  args: {
    roomContract: RoomContract;
    arguments: ReadonlyArray<RoomArgumentInput>;
    branchIdByArgumentId: ReadonlyMap<string, string>;
    signals?: QualifyingResponseSignals;
  },
): number {
  // Defensive: the caller's roomId must match the contract's room.
  if (roomId !== args.roomContract.roomId) return 0;
  return listJumpsForParticipant(userId, args).length;
}

// ── canJump ─────────────────────────────────────────────────────

/**
 * GAME-006 — the deterministic Jump eligibility predicate. The card names this
 * exactly: `canJump(participant, room, destination): { ok, reason }`.
 *
 * Pure. Deterministic. Reads ONLY structural inputs — the participant's seat
 * role, the participant's used-jump count, and the destination branch's
 * engagement state. It NEVER reads heat, popularity, reply count, view count,
 * or any strength / standing band.
 *
 * Returns `{ ok: false, reason }` (first failing reason) when ANY of the
 * following hold, checked in this fixed order so the reported reason is stable:
 *  1. The participant is NOT a chime-in -> 'not_a_chime_in'.
 *  2. The participant has no active seat (moved-to-observer) -> 'no_active_seat'.
 *  3. The participant has already used their jump -> 'jump_already_used'.
 *  4. The destination branchId is not a known branch -> 'destination_unknown'.
 *  5. The destination IS the participant's home branch -> 'destination_is_home'.
 *  6. The destination branch is not open to engagement -> 'destination_closed'.
 *  7. (OD-2, v1 inert) destination requires arrival approval ->
 *     'destination_needs_approval'. v1 never returns this.
 * Otherwise `{ ok: true, reason: null }`.
 *
 * No `nowMs` parameter — the card's "rate" input is the once-per-room COUNT,
 * not a time-window. The `at` timestamp on a `JumpBranchRecord` is purely
 * descriptive; it is never an eligibility input.
 */
export function canJump(
  participant: {
    /** The chime-in participant's userId. */
    userId: string;
    /** The participant's seat role in the GAME-005 seat map — or 'observer'
     *  when they hold no active seat. */
    seatRole: SeatRole | 'observer';
    /** The number of jumps the participant has already used this room. */
    usedJumps: number;
    /** The participant's home branchId, or null when they have not engaged
     *  on a branch yet. */
    homeBranchId: string | null;
  },
  room: {
    /** The GAME-005 seat map — used to confirm the participant holds an
     *  active chime-in seat (and is not in `movedToObserver`). */
    seatMap: PublicRoomSeatMap;
  },
  destination: BranchEngagementState,
): JumpEligibility {
  // 1. Only public-room chime-ins may Jump Branch. The OP + Primary Opponent
  //    are fixed to the mainline (card actor rule); an observer who never
  //    claimed a seat is not a chime-in either.
  if (participant.seatRole !== 'chime_in') {
    return { ok: false, reason: 'not_a_chime_in' };
  }

  // 2. The participant must hold an active chime-in seat. A chime-in who was
  //    governance-moved to observer (GAME-005) appears in `movedToObserver`
  //    and holds no active seat.
  const holdsActiveSeat = room.seatMap.activeSeats.some(
    (seat) => seat.userId === participant.userId && seat.role === 'chime_in',
  );
  const movedToObserver = room.seatMap.movedToObserver.some(
    (record) => record.userId === participant.userId,
  );
  if (!holdsActiveSeat || movedToObserver) {
    return { ok: false, reason: 'no_active_seat' };
  }

  // 3. The once-per-room jump cap.
  if (participant.usedJumps >= MAX_JUMPS_PER_ROOM) {
    return { ok: false, reason: 'jump_already_used' };
  }

  // 4. The destination must be a known branch. An empty branchId is a stale
  //    UI handle for "no branch".
  if (destination.branchId.length === 0) {
    return { ok: false, reason: 'destination_unknown' };
  }

  // 5. You cannot "jump" to where you already are.
  if (
    participant.homeBranchId !== null &&
    destination.branchId === participant.homeBranchId
  ) {
    return { ok: false, reason: 'destination_is_home' };
  }

  // 6. The destination branch must be open to a new engaging move.
  if (!destination.openToEngagement) {
    return { ok: false, reason: 'destination_closed' };
  }

  // 7. OD-2 — destination arrival approval. v1 never reaches this branch (no
  //    approval gate); the value exists so a future card can flip it on with
  //    no signature change.

  return { ok: true, reason: null };
}

// ── buildBranchEngagementMap ────────────────────────────────────

/**
 * GAME-006 — build the per-branch engagement-state map. Pure. Consumes the
 * BR-004 grammar map (for `direction`) + the GAME-005 seat map (to know which
 * chime-in branches collapsed into observer-fallback). GAME-006 re-derives NO
 * branch state — it projects existing structural facts.
 *
 * A branch is `openToEngagement: false` when:
 *  - it is an `evidence_passthrough` branch (BR-004 owns evidence-thread
 *    semantics — a jump must not hijack one), OR
 *  - it is the branchId of a chime-in who was moved to observer (the branch
 *    collapsed into "Side branches").
 * The mainline and any active chime_in_vertical / tangent_diagonal branch are
 * open.
 */
export function buildBranchEngagementMap(args: {
  /** The BR-004 branch-grammar map (`buildBranchGrammarMap` output). */
  branchGrammarMap: ReadonlyMap<string, BranchGrammarNode>;
  /** The GAME-005 seat map — `movedToObserver` records carry the branchId
   *  of a collapsed chime-in branch. */
  seatMap: PublicRoomSeatMap;
}): ReadonlyMap<string, BranchEngagementState> {
  // Branch ids whose owning chime-in was moved to observer — those branches
  // collapsed into "Side branches" and are not open to a new engaging move.
  const collapsedBranchIds = new Set<string>();
  for (const record of args.seatMap.movedToObserver) {
    if (record.branchId !== null) collapsedBranchIds.add(record.branchId);
  }

  const result = new Map<string, BranchEngagementState>();
  for (const [branchId, node] of args.branchGrammarMap) {
    const isMainline = node.direction === 'mainline';
    const isEvidence = node.direction === 'evidence_passthrough';
    const isCollapsed = collapsedBranchIds.has(branchId);
    const openToEngagement = !isEvidence && !isCollapsed;
    result.set(
      branchId,
      Object.freeze({
        branchId,
        direction: node.direction,
        openToEngagement,
        isMainline,
      }),
    );
  }
  return result;
}

// ── buildJumpControlViewModel ───────────────────────────────────

/**
 * GAME-006 — the plain-language disabled-state reason for a `JumpDenyReason`.
 * Every reason maps to a non-punitive sentence — no silent no-op.
 */
export function jumpDenyReasonLabel(reason: JumpDenyReason): string {
  switch (reason) {
    case 'not_a_chime_in':
      return JUMP_BRANCH_COPY.disabled_not_a_chime_in;
    case 'no_active_seat':
      return JUMP_BRANCH_COPY.disabled_no_active_seat;
    case 'jump_already_used':
      return JUMP_BRANCH_COPY.disabled_jump_already_used;
    case 'destination_is_home':
      return JUMP_BRANCH_COPY.disabled_destination_is_home;
    case 'destination_closed':
      return JUMP_BRANCH_COPY.disabled_destination_closed;
    case 'destination_unknown':
      return JUMP_BRANCH_COPY.disabled_destination_unknown;
    case 'destination_needs_approval':
    default:
      return JUMP_BRANCH_COPY.disabled_destination_needs_approval;
  }
}

/**
 * GAME-006 — build the confirm-required Jump control's view-model for one
 * destination branch, for one viewer. Pure. The `enabled` flag and
 * `disabledReasonLabel` come straight from `canJump` — the control can never
 * be a silent no-op. Every disabled state has a visible reason.
 */
export function buildJumpControlViewModel(args: {
  eligibility: JumpEligibility;
  participantUserId: string;
  destinationBranchId: string;
}): JumpControlViewModel {
  const enabled = args.eligibility.ok;
  const disabledReasonLabel =
    enabled || args.eligibility.reason === null
      ? null
      : jumpDenyReasonLabel(args.eligibility.reason);

  const accessibilityLabel = enabled
    ? `${JUMP_BRANCH_COPY.action_label}. ${JUMP_BRANCH_COPY.action_explainer}`
    : `${JUMP_BRANCH_COPY.action_label}. ${disabledReasonLabel ?? ''}`.trim();

  const accessibilityHint = enabled
    ? JUMP_BRANCH_COPY.confirm_prompt
    : JUMP_BRANCH_COPY.disabled_hint;

  return {
    participantUserId: args.participantUserId,
    destinationBranchId: args.destinationBranchId,
    actionLabel: JUMP_BRANCH_COPY.action_label,
    enabled,
    disabledReasonLabel,
    confirmPrompt: JUMP_BRANCH_COPY.confirm_prompt,
    confirmLabel: JUMP_BRANCH_COPY.confirm_label,
    cancelLabel: JUMP_BRANCH_COPY.cancel_label,
    accessibilityLabel,
    accessibilityHint,
  };
}

// ── buildJumpMarkers ────────────────────────────────────────────

/** Plain-language "moved {rel}" / "joined {rel}" fragment. Never a raw
 *  timestamp; "recently" when the time is absent / unparseable. */
function whenLabelFor(kind: JumpMarkerKind, at: string, nowMs?: number): string {
  const rel = formatRelativeShort(at, nowMs);
  if (rel === '') return JUMP_BRANCH_COPY.when_unknown;
  const template =
    kind === 'departed_from' ? JUMP_BRANCH_COPY.when_moved : JUMP_BRANCH_COPY.when_joined;
  return template.replace('{rel}', rel);
}

/**
 * GAME-006 — build the structural Jump markers for the whole room. Pure. For
 * each derived `JumpBranchRecord` it emits TWO markers: a `departed_from`
 * marker on `fromBranchId` and an `arrived_at` marker on `toBranchId`. The
 * room shell renders each marker on its branch.
 *
 * Markers describe structural MOVEMENT — never the person, never a verdict.
 * The old branch is NEVER deleted; the marker is additive.
 */
export function buildJumpMarkers(roomArgs: {
  roomContract: RoomContract;
  arguments: ReadonlyArray<RoomArgumentInput>;
  branchIdByArgumentId: ReadonlyMap<string, string>;
  seatMap: PublicRoomSeatMap;
  signals?: QualifyingResponseSignals;
  /** Current time, ms epoch — only for the marker's relative-time copy.
   *  Optional; absent => "recently". */
  nowMs?: number;
}): ReadonlyArray<JumpMarkerViewModel> {
  // Distinct participant ids — every chime-in plus the two primaries. Markers
  // are derived per participant; a primary never jumps so produces none.
  const participantIds = new Set<string>();
  for (const argument of roomArgs.arguments) {
    if (argument.authorId !== null) participantIds.add(argument.authorId);
  }

  const markers: JumpMarkerViewModel[] = [];
  // Iterate in deterministic order so the output is stable across renders.
  for (const participantUserId of Array.from(participantIds).sort()) {
    const records = listJumpsForParticipant(participantUserId, {
      roomContract: roomArgs.roomContract,
      arguments: roomArgs.arguments,
      branchIdByArgumentId: roomArgs.branchIdByArgumentId,
      signals: roomArgs.signals,
    });
    for (const record of records) {
      markers.push(
        Object.freeze({
          kind: 'departed_from',
          branchId: record.fromBranchId,
          participantUserId,
          anchorArgumentId: record.viaArgumentId,
          whenLabel: whenLabelFor('departed_from', record.at, roomArgs.nowMs),
          markerLabel: JUMP_BRANCH_COPY.marker_departed_title,
          accessibilityLabel: `${JUMP_BRANCH_COPY.marker_departed_title}. ${
            JUMP_BRANCH_COPY.marker_departed_body
          } ${whenLabelFor('departed_from', record.at, roomArgs.nowMs)}.`,
        }),
      );
      markers.push(
        Object.freeze({
          kind: 'arrived_at',
          branchId: record.toBranchId,
          participantUserId,
          anchorArgumentId: record.viaArgumentId,
          whenLabel: whenLabelFor('arrived_at', record.at, roomArgs.nowMs),
          markerLabel: JUMP_BRANCH_COPY.marker_arrived_title,
          accessibilityLabel: `${JUMP_BRANCH_COPY.marker_arrived_title}. ${
            JUMP_BRANCH_COPY.marker_arrived_body
          } ${whenLabelFor('arrived_at', record.at, roomArgs.nowMs)}.`,
        }),
      );
    }
  }
  return Object.freeze(markers);
}

// ── Ban-list support ────────────────────────────────────────────

/**
 * Forbidden tokens scanned by `__tests__/jumpBranchDoctrine.test.ts`. NOT a
 * content filter. Mirrors `_forbiddenChimeInGovernanceTokens` (GAME-005) so
 * GAME-006 copy is held to the same bar — verdict tokens, amplification
 * tokens, person-attribution tokens, AND punitive movement tokens
 * ("abandoned / quit / left / booted") because a jump is not a desertion.
 */
export function _forbiddenJumpBranchTokens(): string[] {
  return [
    // Verdict tokens
    'winner',
    'loser',
    'correct',
    'incorrect',
    'true',
    'false',
    'right',
    'wrong',
    'won',
    'lost',
    'defeated',
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
    // Punitive / removal tokens — a jump is never a punishment or a desertion
    'booted',
    'kicked',
    'banned',
    'abandoned',
    'quit',
    'deserted',
    'gave up',
    // Person-attribution tokens
    'troll',
    'bot',
    // Like / vote vocabulary — a jump is not a popularity contest
    'like',
    'dislike',
    'vote',
  ];
}
