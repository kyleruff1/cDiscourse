/**
 * GAME-005 — Public-room participant seats + chime-in governance.
 *
 * Pure TypeScript. No React, no Supabase, no network, no AI. JSON-serializable
 * inputs and outputs so the same model could run in an Edge Function later if a
 * follow-up persistence card needs it server-side.
 *
 * This model EXTENDS the GAME-004 1v1 room contract (`roomContractModel.ts`):
 * seats 1 and 2 are GAME-004's Initiator + Primary Opponent; seats 3..5 are
 * GAME-005's chime-in seats. It CONSUMES BR-004's branch grammar
 * (`CollapsedBranchSummary`, `BranchDirection`) — it does not re-derive branch
 * direction or rebuild a collapse mechanism.
 *
 * Doctrine anchor — read this before changing anything in this file:
 *
 *   - A seat describes a structural game ROLE, never the person. Labels are
 *     role-relative ("You" / "Chime-in 1"), never a person's name.
 *   - A governance reaction describes participation STRUCTURE, never
 *     correctness. `useful` / `off_track` / `needs_source` / `move_to_tangent`
 *     are not votes and carry no verdict.
 *   - Losing a seat (observer-fallback) is a STRUCTURAL TRANSITION, never a
 *     penalty or a verdict. A moved-to-observer user keeps every byte of their
 *     content on the record and retains full observer rights.
 *   - Heat, popularity, reply count, view count, and standing are NEVER inputs
 *     to seat assignment or governance. Seat order is the chronological order
 *     of the first qualifying move only. This file imports nothing from any
 *     score / standing / heat / anti-amplification module.
 *   - The seat map is DERIVED, not persisted. It recomputes on every room load
 *     from `debate_participants` + `arguments` + the GAME-004 RoomContract +
 *     (optionally) the in-session governance reactions. There is NO write path
 *     and NO new DB column — `chime_in` is a derived role only and is never
 *     written to `debate_participants.side`.
 */

import type {
  RoomContract,
  RoomArgumentInput,
  RoomParticipantInput,
  QualifyingResponseSignals,
} from './roomContractModel';
import { isQualifyingResponse } from './roomContractModel';
import type { CollapsedBranchSummary } from '../arguments/branchGrammarModel';
import { CHIME_IN_GOVERNANCE_COPY } from '../arguments/gameCopy';

// ── SeatRole — the seat vocabulary (extends GAME-004) ───────────

/**
 * GAME-005 — the role a public-room seat plays. The two primary literals
 * are IDENTICAL to GAME-004's `PrimarySeat` so a `PublicSeat` for seat 1
 * or 2 is consistent with the existing RoomContract. `chime_in` is a
 * DERIVED role only — it is NEVER written to `debate_participants.side`
 * (that column's CHECK constraint stays affirmative/negative/observer/
 * moderator). A user's `chime_in` standing is read-time state.
 */
export type SeatRole = 'initiator' | 'primary_opponent' | 'chime_in';

/**
 * Active-seat cap for a public room. Seat 1 OP, seat 2 Primary Opponent,
 * seats 3-5 chime-ins. Beyond the cap -> observer. Single named constant so
 * a tuning card is one edit.
 *
 * ARG-ROOM-001 reconcile (roadmap 2026-06-13 §4.1 divergence ledger):
 * reconciled 6 -> 5 so the public active-participant cap is ONE source of
 * truth, shared with `argumentRoomCreationMatrix.PUBLIC_ACTIVE_PARTICIPANT_CAP`
 * (a parity test pins both to 5). Public chime-in capacity is now 5 - 2 = 3.
 */
export const PUBLIC_ROOM_SEAT_CAP = 5;

/**
 * The number of seats reserved for the two primary parties. Seats 3..N are
 * chime-in seats. Derived: chime-in capacity = CAP - PRIMARY_SEAT_COUNT.
 */
export const PRIMARY_SEAT_COUNT = 2;

/**
 * GAME-005 — the rule window inside which BOTH primary `off_track` reactions
 * must fall to move a chime-in to observer. 24h proposed. Single named
 * constant — OD-1 confirms.
 */
export const CHIME_IN_GOVERNANCE_WINDOW_MS = 24 * 60 * 60 * 1000;

// ── ChimeInStanding + PublicSeat ────────────────────────────────

/** A chime-in's structural standing in the room. Never a verdict. */
export type ChimeInStanding = 'active' | 'observer_only';

/**
 * GAME-005 — one occupied active seat in a public room. Pure derived data,
 * never persisted. `seatIndex` is 1-based: 1 = OP, 2 = Primary Opponent,
 * 3..PUBLIC_ROOM_SEAT_CAP = chime-in seats in deterministic claim order.
 */
export interface PublicSeat {
  /** 1-based seat index, 1..PUBLIC_ROOM_SEAT_CAP. */
  seatIndex: number;
  /**
   * The user holding the seat. Never rendered as raw text — labels are
   * role-relative ("You" / "Chime-in 1" / etc.), never the person name.
   */
  userId: string;
  /** The seat's structural role. */
  role: SeatRole;
  /**
   * Chime-in standing. For role 'initiator' / 'primary_opponent' this is
   * always 'active'. For role 'chime_in' it is the output of
   * `evaluateChimeInStanding` — 'active' or 'observer_only'. A seat that
   * is 'observer_only' is NOT in `activeSeats` (it has been moved to
   * observer); it appears only in `movedToObserver`.
   */
  standing: ChimeInStanding;
  /**
   * The BR-004 branchId of this seat holder's on-record chime-in branch,
   * if one exists. null for a primary seat or a chime-in that has not yet
   * opened a vertical branch. Carried so the room shell can join
   * "this seat -> this BR-004 branch" with no new identifier.
   */
  branchId: string | null;
}

// ── MovedToObserverRecord + PublicRoomSeatMap ───────────────────

export type ObserverFallbackReason = 'overflow' | 'governance';

/** GAME-005 — a user who is observer-only, plus the structural reason. */
export interface MovedToObserverRecord {
  userId: string;
  /**
   * 'overflow'  — arrived after the 5-seat cap was full; never held a seat.
   * 'governance'— held a chime-in seat; both primaries marked the chime-in
   *               'off the current thread' within the window.
   */
  reason: ObserverFallbackReason;
  /**
   * The branchId of this user's on-record chime-in branch, if any. The
   * branch STAYS in the record; it may collapse into "Side branches".
   * null for an 'overflow' user who never posted.
   */
  branchId: string | null;
}

/**
 * GAME-005 — the derived public-room seat layout. Recomputed on every room
 * load from `debate_participants` + `arguments` + the GAME-004 RoomContract
 * + (optionally) the in-session governance reactions. Never persisted.
 */
export interface PublicRoomSeatMap {
  roomId: string;
  /**
   * The active seats, ordered by seatIndex ascending (1..N). Length is
   * 0..PUBLIC_ROOM_SEAT_CAP. Always includes the OP when a room exists.
   */
  activeSeats: ReadonlyArray<PublicSeat>;
  /**
   * Users who reached the room as active participants but are now
   * observer-only — either because the cap was full when they arrived
   * (overflow) or because both primary parties moved them to observer
   * (governance fallback). Each carries WHY, for non-punitive copy.
   */
  movedToObserver: ReadonlyArray<MovedToObserverRecord>;
  /** True when every active seat is filled (length === PUBLIC_ROOM_SEAT_CAP). */
  isCapReached: boolean;
  /** Count of free chime-in seats (0 when full or when primaries unseated). */
  openChimeInSeatCount: number;
}

// ── GovernanceReaction ──────────────────────────────────────────

/**
 * GAME-005 — the governance-reaction vocabulary. A STRUCTURAL signal about
 * participation, never a correctness verdict. No like/dislike vocabulary
 * (doctrine). OD-2 confirms the user-facing labels via CHIME_IN_GOVERNANCE_COPY.
 *   'useful'        — this chime-in helps the room; structural "keep".
 *   'off_track'     — this chime-in does not fit the current thread;
 *                     the ONLY kind that counts toward observer-fallback.
 *   'needs_source'  — asks the chime-in for a primary source; advisory.
 *   'move_to_tangent' — suggests routing the chime-in to a tangent branch;
 *                     advisory, hands off to BR-003/BR-004 routing.
 */
export type GovernanceReactionKind =
  | 'useful'
  | 'off_track'
  | 'needs_source'
  | 'move_to_tangent';

/** Frozen list — tests iterate this; copy coverage iterates this. */
export const ALL_GOVERNANCE_REACTION_KINDS: ReadonlyArray<GovernanceReactionKind> =
  Object.freeze(['useful', 'off_track', 'needs_source', 'move_to_tangent']);

/**
 * GAME-005 — a single governance reaction applied by ONE primary party to
 * ONE chime-in's branch (or a specific message in it). A participation-
 * structure signal, NEVER a correctness vote. v1: ephemeral, in-session,
 * caller-supplied. A future migration card persists these.
 */
export interface GovernanceReaction {
  /** Which primary seat applied it. Only these two may govern. */
  byPrimarySeat: 'initiator' | 'primary_opponent';
  /**
   * The userId of the primary party (for the both-parties check + the
   * reversibility check — a party may only retract its OWN reaction).
   */
  byUserId: string;
  /**
   * The chime-in branch this reaction targets (BR-004 branchId) OR a
   * specific message id within it. Branch-level is the v1 default.
   */
  targetBranchOrMessageId: string;
  /**
   * The chime-in user the target branch belongs to. Used by
   * `evaluateChimeInStanding` to group reactions per chime-in.
   */
  targetChimeInUserId: string;
  /** The reaction kind — a structural signal, see GovernanceReactionKind. */
  kind: GovernanceReactionKind;
  /** ISO timestamp the reaction was applied. Drives the rule window. */
  at: string;
  /**
   * True when the reaction has been retracted (reversibility). A retracted
   * reaction is KEPT in the list (audit) but does not count toward the
   * both-parties threshold. Never hard-deleted.
   */
  retracted: boolean;
}

// ── Governance actor matrix ─────────────────────────────────────

export type GovernanceDenyReason =
  | 'not_a_primary_party' //  observers + chime-ins may never govern
  | 'self_target' //          a primary cannot govern their own content
  | 'primary_seat_open' //    governance pauses when a primary seat is empty
  | 'target_not_chime_in'; // a reaction may only target a chime-in branch

export interface GovernanceActorResult {
  allowed: boolean;
  /** null when allowed; the first failing reason otherwise. */
  reason: GovernanceDenyReason | null;
}

// ── View-models (for the UI) ────────────────────────────────────

/** One row in the read-time public-room metrics strip. Pure data, no JSX. */
export interface PublicRoomMetricsViewModel {
  /** "4 of 5 seats active" — plain language, never a leaderboard. */
  seatCountLabel: string;
  /** "2 people chiming in" — count only, never ranked. */
  chimeInCountLabel: string;
  /**
   * Per-branch state chips (count, recency) — sourced from BR-004's
   * CollapsedBranchSummary, NOT re-derived. Non-correctness only.
   */
  branchStateLabels: ReadonlyArray<string>;
  /** True when at least one moved-to-observer branch exists. */
  hasSideBranches: boolean;
  /** Plain-language heading for the side-branches area. */
  sideBranchesHeading: string;
  /** Verbose screen-reader summary of the whole strip. */
  accessibilityLabel: string;
}

/**
 * The governance control's view-model for ONE chime-in branch, shown
 * ONLY to the OP + Primary Opponent.
 */
export interface GovernanceControlViewModel {
  targetChimeInUserId: string;
  targetBranchId: string;
  /**
   * One entry per GovernanceReactionKind — label + whether THIS viewer
   * has already applied it (so the control shows applied/not-applied,
   * toggle = retract).
   */
  reactions: ReadonlyArray<{
    kind: GovernanceReactionKind;
    label: string; //            from CHIME_IN_GOVERNANCE_COPY
    appliedByViewer: boolean; //  viewer may retract their own
    accessibilityLabel: string;
  }>;
  /**
   * Calm, non-punitive status line when the chime-in is observer-only,
   * e.g. "This chime-in moved to observer. Their side branch is kept."
   * null when the chime-in is still active.
   */
  observerFallbackNotice: string | null;
}

// ── Internal helpers ────────────────────────────────────────────

/**
 * Chronologically sorted copy of arguments. Sorts by `createdAt` ascending,
 * tie-broken by `id` ascending — identical determinism to GAME-004. Does
 * NOT mutate the input array.
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
 * One chime-in user, with the id of their first qualifying move (used as
 * the deterministic claim handle) and the BR-004 branchId of that move.
 */
interface ChimeInClaim {
  userId: string;
  firstQualifyingArgumentId: string;
  branchId: string | null;
}

/**
 * Collect the distinct chime-in users in deterministic claim order — the
 * chronological order of each chime-in's FIRST qualifying move. A chime-in
 * is any user who authored a qualifying argument that is NOT the OP and NOT
 * the Primary Opponent. `isQualifyingResponse` (GAME-004) is reused verbatim
 * so a one-word "lol", a flagged move, a deletion-requested move, or a bot
 * move never claims a seat.
 *
 * `chimeInBranchIdByUserId` is the OPTIONAL caller-supplied join from a
 * chime-in user to the BR-004 `branchId` of their on-record vertical
 * branch — the room shell already holds the BR-004 grammar map keyed by
 * `branchId`. GAME-005 does not re-derive branch direction; it consumes
 * the join. When the map is absent the branchId is simply `null`.
 */
function collectChimeInClaims(
  contract: RoomContract,
  argumentsList: ReadonlyArray<RoomArgumentInput>,
  signals: QualifyingResponseSignals | undefined,
  chimeInBranchIdByUserId: ReadonlyMap<string, string> | undefined,
): ChimeInClaim[] {
  const claims: ChimeInClaim[] = [];
  const seen = new Set<string>();
  for (const argument of sortedChronologically(argumentsList)) {
    if (
      !isQualifyingResponse(argument, {
        initiatorUserId: contract.initiatorUserId,
        signals,
      })
    ) {
      continue;
    }
    const authorId = argument.authorId;
    // authorId is non-null past the predicate; guard defensively.
    if (authorId === null) continue;
    // The two primary parties are not chime-ins.
    if (authorId === contract.initiatorUserId) continue;
    if (authorId === contract.primaryOpponentUserId) continue;
    if (seen.has(authorId)) continue;
    seen.add(authorId);
    claims.push({
      userId: authorId,
      firstQualifyingArgumentId: argument.id,
      branchId: chimeInBranchIdByUserId?.get(authorId) ?? null,
    });
  }
  return claims;
}

// ── evaluateChimeInStanding ─────────────────────────────────────

export interface EvaluateChimeInStandingOptions {
  /**
   * The rule window in ms. Defaults to CHIME_IN_GOVERNANCE_WINDOW_MS. Both
   * qualifying `off_track` reactions must fall inside one window.
   */
  windowMs?: number;
  /** Current time, ms epoch. The model never reads the clock itself. */
  nowMs: number;
  /**
   * The two primary party userIds — used to validate that the two
   * `off_track` reactions came from the TWO DISTINCT primaries (not the
   * same party twice, not a non-primary). When the Primary Opponent seat
   * is open this is a 1-element array and `evaluateChimeInStanding` can
   * never return 'observer_only' (governance pauses).
   */
  primaryUserIds: ReadonlyArray<string>;
}

/**
 * Deterministic governance evaluator for ONE chime-in. Returns
 * 'observer_only' if and only if ALL of the following hold:
 *  - There are at least two NON-retracted `off_track` reactions targeting
 *    this chime-in.
 *  - They were applied by TWO DISTINCT users, BOTH in `primaryUserIds`
 *    (the both-parties requirement — anti-abuse core).
 *  - Two of those reactions fall within ONE `windowMs` span of each other
 *    (`|t1 - t2| <= windowMs`). Stale single reactions never accumulate
 *    into a demotion across unbounded time.
 * Otherwise returns 'active'. `useful` / `needs_source` / `move_to_tangent`
 * reactions NEVER affect the result. A retracted reaction NEVER counts.
 */
export function evaluateChimeInStanding(
  reactions: ReadonlyArray<GovernanceReaction>,
  options: EvaluateChimeInStandingOptions,
): ChimeInStanding {
  const windowMs =
    options.windowMs === undefined ? CHIME_IN_GOVERNANCE_WINDOW_MS : options.windowMs;
  const primarySet = new Set(options.primaryUserIds);

  // The both-parties requirement is structurally unsatisfiable with fewer
  // than two distinct primaries — governance pauses.
  if (primarySet.size < 2) return 'active';

  // Keep only non-retracted `off_track` reactions applied by a primary
  // party, with a parsable timestamp. Group the latest timestamp per
  // distinct primary so re-applies by the same party never double-count.
  const latestByPrimary = new Map<string, number>();
  for (const reaction of reactions) {
    if (reaction.kind !== 'off_track') continue;
    if (reaction.retracted) continue;
    if (!primarySet.has(reaction.byUserId)) continue;
    const ms = Date.parse(reaction.at);
    if (Number.isNaN(ms)) continue;
    const prior = latestByPrimary.get(reaction.byUserId);
    if (prior === undefined || ms > prior) {
      latestByPrimary.set(reaction.byUserId, ms);
    }
  }

  // Need two DISTINCT primaries.
  if (latestByPrimary.size < 2) return 'active';

  // The two reactions must fall within one window span of each other.
  const timestamps = Array.from(latestByPrimary.values()).sort((a, b) => a - b);
  for (let i = 1; i < timestamps.length; i += 1) {
    if (timestamps[i] - timestamps[i - 1] <= windowMs) {
      return 'observer_only';
    }
  }
  return 'active';
}

// ── buildPublicRoomSeatMap ──────────────────────────────────────

export interface BuildPublicRoomSeatMapInput {
  /** The GAME-004 room contract — already built by useRoomContract. */
  roomContract: RoomContract;
  /**
   * All posted `arguments` rows for the room (RoomArgumentInput[] —
   * GAME-004's narrowed shape, reused verbatim).
   */
  arguments: ReadonlyArray<RoomArgumentInput>;
  /**
   * All `debate_participants` rows (RoomParticipantInput[] — GAME-004's
   * narrowed shape). Reserved for future observer-recognition; the v1 seat
   * derivation works from `arguments` + the contract alone.
   */
  participants: ReadonlyArray<RoomParticipantInput>;
  /**
   * Optional GAME-004 QualifyingResponseSignals — reused so a flagged or
   * deletion-requested move never claims a chime-in seat.
   */
  signals?: QualifyingResponseSignals;
  /**
   * The in-session governance reactions (v1: ephemeral, caller-supplied;
   * a future card supplies persisted rows here). Empty array = no
   * governance applied yet. Optional.
   */
  governanceReactions?: ReadonlyArray<GovernanceReaction>;
  /**
   * OPTIONAL caller-supplied join from a chime-in user to the BR-004
   * `branchId` of their on-record vertical branch. The room shell already
   * holds the BR-004 grammar map keyed by `branchId` — GAME-005 consumes
   * the join rather than re-deriving branch direction. Absent => branchId
   * is `null` on every seat / record (no crash, no failure state).
   */
  chimeInBranchIdByUserId?: ReadonlyMap<string, string>;
  /**
   * Current time, ms epoch — for the rule-window evaluation. The caller
   * passes Date.now(); the model never reads the clock itself.
   */
  nowMs: number;
}

/**
 * Build the derived public-room seat layout. Pure. Deterministic — calling
 * it twice on the same input yields a deeply-equal frozen result. Steps:
 *  1. Seat 1 = roomContract.initiatorUserId (role 'initiator').
 *  2. Seat 2 = roomContract.primaryOpponentUserId (role 'primary_opponent')
 *     when non-null; otherwise seat 2 is open.
 *  3. Collect distinct chime-in users (qualifying author, not OP, not
 *     Primary Opponent, not a bot) in first-qualifying-move chronological
 *     order. Reuses GAME-004 isQualifyingResponse.
 *  4. Assign seats 3..PUBLIC_ROOM_SEAT_CAP to chime-ins in that order.
 *  5. For each seated chime-in, compute standing via evaluateChimeInStanding.
 *     standing 'observer_only' -> the user moves to movedToObserver
 *     (reason 'governance') and the seat is NOT re-filled in this render.
 *  6. Chime-ins past the cap -> movedToObserver (reason 'overflow').
 */
export function buildPublicRoomSeatMap(
  input: BuildPublicRoomSeatMapInput,
): PublicRoomSeatMap {
  const { roomContract } = input;
  const governanceReactions = input.governanceReactions ?? [];

  const primaryUserIds: string[] = [roomContract.initiatorUserId];
  if (roomContract.primaryOpponentUserId !== null) {
    primaryUserIds.push(roomContract.primaryOpponentUserId);
  }

  const activeSeats: PublicSeat[] = [];
  const movedToObserver: MovedToObserverRecord[] = [];

  // Seat 1 — the Initiator. Always present when a room exists.
  activeSeats.push(
    Object.freeze({
      seatIndex: 1,
      userId: roomContract.initiatorUserId,
      role: 'initiator',
      standing: 'active',
      branchId: null,
    }),
  );

  // Seat 2 — the Primary Opponent, when the seat is claimed.
  if (roomContract.primaryOpponentUserId !== null) {
    activeSeats.push(
      Object.freeze({
        seatIndex: 2,
        userId: roomContract.primaryOpponentUserId,
        role: 'primary_opponent',
        standing: 'active',
        branchId: null,
      }),
    );
  }

  // Seats 3..CAP — chime-ins in deterministic claim order.
  const claims = collectChimeInClaims(
    roomContract,
    input.arguments,
    input.signals,
    input.chimeInBranchIdByUserId,
  );
  const chimeInCapacity = PUBLIC_ROOM_SEAT_CAP - PRIMARY_SEAT_COUNT;

  // The chime-in seat index always starts at PRIMARY_SEAT_COUNT + 1 so a
  // chime-in's index is stable whether or not seat 2 is filled.
  let nextSeatIndex = PRIMARY_SEAT_COUNT + 1;
  let chimeInsSeatedCount = 0;

  for (const claim of claims) {
    // Past the chime-in capacity -> overflow observer. No failure state.
    if (chimeInsSeatedCount >= chimeInCapacity) {
      movedToObserver.push(
        Object.freeze({
          userId: claim.userId,
          reason: 'overflow',
          branchId: claim.branchId,
        }),
      );
      continue;
    }

    // Governance — recompute the chime-in's standing every render.
    const reactionsForUser = governanceReactions.filter(
      (r) => r.targetChimeInUserId === claim.userId,
    );
    const standing = evaluateChimeInStanding(reactionsForUser, {
      nowMs: input.nowMs,
      primaryUserIds,
    });

    if (standing === 'observer_only') {
      // Moved to observer by governance. The branch stays in the record;
      // the seat is freed (not re-filled within this render — a re-fill is
      // a fresh derivation on the next load).
      movedToObserver.push(
        Object.freeze({
          userId: claim.userId,
          reason: 'governance',
          branchId: claim.branchId,
        }),
      );
      // The seat the chime-in would have held is consumed from capacity so
      // the index of every other chime-in stays stable for this render.
      nextSeatIndex += 1;
      chimeInsSeatedCount += 1;
      continue;
    }

    activeSeats.push(
      Object.freeze({
        seatIndex: nextSeatIndex,
        userId: claim.userId,
        role: 'chime_in',
        standing: 'active',
        branchId: claim.branchId,
      }),
    );
    nextSeatIndex += 1;
    chimeInsSeatedCount += 1;
  }

  const isCapReached = activeSeats.length === PUBLIC_ROOM_SEAT_CAP;
  const openChimeInSeatCount = Math.max(
    0,
    chimeInCapacity - chimeInsSeatedCount,
  );

  return Object.freeze({
    roomId: roomContract.roomId,
    activeSeats: Object.freeze(activeSeats),
    movedToObserver: Object.freeze(movedToObserver),
    isCapReached,
    openChimeInSeatCount,
  });
}

// ── canApplyGovernanceReaction ──────────────────────────────────

/**
 * Pure predicate. May `actorUserId` apply a governance reaction to
 * `targetChimeInUserId`'s branch in this room? Allowed ONLY when:
 *  - actorUserId is the Initiator or the Primary Opponent, AND
 *  - both primary seats are currently filled (governance pauses if one is
 *    open), AND
 *  - the target is a chime-in (not the other primary, not an observer,
 *    not the actor themselves).
 * Chime-ins cannot govern each other; observers cannot govern.
 *
 * Checks run in a fixed order so the reported reason is stable.
 */
export function canApplyGovernanceReaction(
  actorUserId: string,
  options: {
    roomContract: RoomContract;
    targetChimeInUserId: string;
    seatMap: PublicRoomSeatMap;
  },
): GovernanceActorResult {
  const { roomContract, targetChimeInUserId } = options;

  const isPrimaryActor =
    actorUserId === roomContract.initiatorUserId ||
    (roomContract.primaryOpponentUserId !== null &&
      actorUserId === roomContract.primaryOpponentUserId);

  // 1. Only the two primary parties may govern.
  if (!isPrimaryActor) {
    return { allowed: false, reason: 'not_a_primary_party' };
  }

  // 2. Governance pauses when a primary seat is open — "both parties" is
  //    unsatisfiable with only one primary.
  if (roomContract.primaryOpponentUserId === null) {
    return { allowed: false, reason: 'primary_seat_open' };
  }

  // 3. A primary cannot govern their own content.
  if (actorUserId === targetChimeInUserId) {
    return { allowed: false, reason: 'self_target' };
  }

  // 4. The target must be a chime-in — not the mainline, not the other
  //    primary. A target that is a primary party is not a chime-in.
  const targetIsPrimary =
    targetChimeInUserId === roomContract.initiatorUserId ||
    targetChimeInUserId === roomContract.primaryOpponentUserId;
  if (targetIsPrimary) {
    return { allowed: false, reason: 'target_not_chime_in' };
  }
  const targetSeat = options.seatMap.activeSeats.find(
    (seat) => seat.userId === targetChimeInUserId,
  );
  const targetIsObserverFallback = options.seatMap.movedToObserver.some(
    (record) => record.userId === targetChimeInUserId,
  );
  // The target must currently hold a chime-in seat. A user who is neither a
  // seated chime-in nor an already-moved-to-observer chime-in is not a
  // governable chime-in.
  if (
    (targetSeat === undefined || targetSeat.role !== 'chime_in') &&
    !targetIsObserverFallback
  ) {
    return { allowed: false, reason: 'target_not_chime_in' };
  }

  return { allowed: true, reason: null };
}

// ── View-model builders ─────────────────────────────────────────

/** "2 people chiming in" — count only, never ranked. */
function chimeInCountLabel(count: number): string {
  if (count <= 0) return CHIME_IN_GOVERNANCE_COPY.chime_in_count_none;
  if (count === 1) return CHIME_IN_GOVERNANCE_COPY.chime_in_count_one;
  return CHIME_IN_GOVERNANCE_COPY.chime_in_count_many.replace(
    '{count}',
    String(count),
  );
}

/**
 * Build the read-time public-room metrics strip view-model. Pure. The
 * branch-state labels are sourced from BR-004's `CollapsedBranchSummary` —
 * GAME-005 does NOT re-derive branch state. None of the fields is a truth
 * or quality signal: seat count is a capacity readout, chime-in count is a
 * count, branch state comes straight from the BR-004 summary line.
 */
export function buildPublicRoomMetricsViewModel(
  seatMap: PublicRoomSeatMap,
  branchSummaries: ReadonlyArray<CollapsedBranchSummary>,
): PublicRoomMetricsViewModel {
  const activeCount = seatMap.activeSeats.length;
  const chimeInCount = seatMap.activeSeats.filter(
    (seat) => seat.role === 'chime_in',
  ).length;

  const seatCountLabel = CHIME_IN_GOVERNANCE_COPY.seat_count
    .replace('{active}', String(activeCount))
    .replace('{cap}', String(PUBLIC_ROOM_SEAT_CAP));

  const branchStateLabels = branchSummaries.map((summary) => summary.summaryLine);

  const hasSideBranches = seatMap.movedToObserver.some(
    (record) => record.branchId !== null,
  );

  const accessibilityLabel = [
    seatCountLabel + '.',
    chimeInCountLabel(chimeInCount) + '.',
    branchStateLabels.length > 0
      ? `${branchStateLabels.length} branch ${
          branchStateLabels.length === 1 ? 'state' : 'states'
        } shown.`
      : 'No branch states yet.',
    hasSideBranches
      ? `${CHIME_IN_GOVERNANCE_COPY.side_branches_heading} present.`
      : '',
  ]
    .filter((part) => part.length > 0)
    .join(' ');

  return {
    seatCountLabel,
    chimeInCountLabel: chimeInCountLabel(chimeInCount),
    branchStateLabels,
    hasSideBranches,
    sideBranchesHeading: CHIME_IN_GOVERNANCE_COPY.side_branches_heading,
    accessibilityLabel,
  };
}

/** The plain-language label for a governance-reaction kind. */
export function governanceReactionLabel(kind: GovernanceReactionKind): string {
  switch (kind) {
    case 'useful':
      return CHIME_IN_GOVERNANCE_COPY.reaction_useful;
    case 'off_track':
      return CHIME_IN_GOVERNANCE_COPY.reaction_off_track;
    case 'needs_source':
      return CHIME_IN_GOVERNANCE_COPY.reaction_needs_source;
    case 'move_to_tangent':
    default:
      return CHIME_IN_GOVERNANCE_COPY.reaction_move_to_tangent;
  }
}

/** The plain-language one-line explainer for a governance-reaction kind. */
function governanceReactionExplain(kind: GovernanceReactionKind): string {
  switch (kind) {
    case 'useful':
      return CHIME_IN_GOVERNANCE_COPY.explain_useful;
    case 'off_track':
      return CHIME_IN_GOVERNANCE_COPY.explain_off_track;
    case 'needs_source':
      return CHIME_IN_GOVERNANCE_COPY.explain_needs_source;
    case 'move_to_tangent':
    default:
      return CHIME_IN_GOVERNANCE_COPY.explain_move_to_tangent;
  }
}

/**
 * Build the governance-control view-model for ONE chime-in branch. Pure.
 * `appliedByViewer` reflects only the viewer's OWN non-retracted reactions
 * for this branch (reversibility — a viewer may retract their own). The
 * `observerFallbackNotice` is non-null only when the chime-in is currently
 * observer-only by governance.
 */
export function buildGovernanceControlViewModel(args: {
  seatMap: PublicRoomSeatMap;
  targetChimeInUserId: string;
  targetBranchId: string;
  viewerUserId: string;
  governanceReactions: ReadonlyArray<GovernanceReaction>;
}): GovernanceControlViewModel {
  const reactionsForBranch = args.governanceReactions.filter(
    (r) => r.targetChimeInUserId === args.targetChimeInUserId,
  );

  const reactions = ALL_GOVERNANCE_REACTION_KINDS.map((kind) => {
    const appliedByViewer = reactionsForBranch.some(
      (r) => r.kind === kind && r.byUserId === args.viewerUserId && !r.retracted,
    );
    const label = governanceReactionLabel(kind);
    return {
      kind,
      label,
      appliedByViewer,
      accessibilityLabel: `${label}. ${governanceReactionExplain(kind)}${
        appliedByViewer ? ' Applied by you — select again to undo.' : ''
      }`,
    };
  });

  const isObserverFallback = args.seatMap.movedToObserver.some(
    (record) =>
      record.userId === args.targetChimeInUserId && record.reason === 'governance',
  );
  const observerFallbackNotice = isObserverFallback
    ? `${CHIME_IN_GOVERNANCE_COPY.moved_to_observer_title}. ${CHIME_IN_GOVERNANCE_COPY.moved_to_observer_body}`
    : null;

  return {
    targetChimeInUserId: args.targetChimeInUserId,
    targetBranchId: args.targetBranchId,
    reactions,
    observerFallbackNotice,
  };
}

// ── Ban-list support ────────────────────────────────────────────

/**
 * Forbidden tokens scanned by `__tests__/chimeInGovernanceDoctrine.test.ts`.
 * NOT a content filter. Mirrors `_forbiddenBranchGrammarTokens` so GAME-005
 * copy is held to the same bar: verdict tokens, amplification tokens,
 * person-attribution / punitive tokens. A governance reaction describes
 * participation STRUCTURE; a moved-to-observer transition is structural —
 * every produced string describes the thread / the room, never the person,
 * never a verdict, never "booted / kicked / banned".
 */
export function _forbiddenChimeInGovernanceTokens(): string[] {
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
    // Amplification tokens
    'popular',
    'trending',
    'viral',
    'upvote',
    'downvote',
    // Punitive / removal tokens — a governance fallback is never a punishment
    'booted',
    'kicked',
    'banned',
    'removed',
    'rejected',
    'silenced',
    // Person-attribution tokens
    'troll',
    'bot',
    // Like / vote vocabulary — governance is not a popularity contest
    'like',
    'dislike',
    'vote',
  ];
}
