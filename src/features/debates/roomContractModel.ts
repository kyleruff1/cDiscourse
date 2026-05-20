/**
 * GAME-004 — 1v1 PvP room contract + Primary Opponent model.
 *
 * Pure TypeScript. No React, no Supabase, no network, no AI. JSON-serializable
 * inputs and outputs so the same model could run in an Edge Function later if a
 * PvP card ever needs it server-side.
 *
 * Doctrine (see docs/designs/GAME-004.md § Doctrine self-check):
 *  - Seat labels describe a ROLE in the game, never the person. "Primary
 *    Opponent" / "Initiator" / "Open seat", never "the challenger who is wrong".
 *  - Heat and standing are NOT seat properties. A seat is "who holds this
 *    role" — it carries no score, no band, no debt. This file imports nothing
 *    from any score / standing / heat module.
 *  - The contract is DERIVED, not persisted. It recomputes on every room load
 *    from `debates` + `debate_participants` + `arguments`, so it can never
 *    drift out of sync with a stale column.
 *  - There is NO write path. No re-open mutation, no "set opponent", no
 *    "reject opponent". The Initiator cannot reject a qualifying first
 *    responder — that is encoded by the deliberate absence of any such
 *    function (anti-griefing default).
 */

// ── Core contract types (verbatim from the issue) ──────────────

/** Whether the room was opened as an invite-only 1v1 or an open public room. */
export type RoomType = 'private' | 'public';

/** The two primary seats in a 1v1 PvP room. */
export type PrimarySeat = 'initiator' | 'primary_opponent';

/**
 * The derived 1v1 room contract. Recomputed on every room load — never
 * persisted. `primaryOpponentUserId` is null when the opponent seat is still
 * open (public room, no qualifying response yet).
 */
export interface RoomContract {
  roomId: string;
  roomType: RoomType;
  /** The room creator. `debates.created_by`. */
  initiatorUserId: string;
  /** The user holding the Primary Opponent seat, or null when the seat is open. */
  primaryOpponentUserId: string | null;
  /** `debates.created_at`. */
  openedAt: string;
  /** The id of the root argument (parentId === null), or null if none yet. */
  openingArgumentId: string | null;
}

// ── Named constants ────────────────────────────────────────────

/** Default room type when the caller cannot supply one. Public = seat stays open. */
export const ROOM_TYPE_DEFAULT: RoomType = 'public';

/**
 * Inactivity window after which the Primary Opponent seat MAY be re-opened.
 * 72 hours. Advisory only — `isPrimaryOpponentSeatStale` reports it; nothing
 * in GAME-004 mutates the contract. An explicit OP re-open action is a
 * follow-up card.
 */
export const PRIMARY_OPPONENT_INACTIVITY_MS = 72 * 60 * 60 * 1000;

/**
 * Anti-sniping body-length gate. A real argumentative move is at least a short
 * sentence; a one-word "no" or "lol" does not claim the seat. A single named
 * constant so a future card can tune it with one edit.
 */
export const MIN_QUALIFYING_BODY_CHARS = 40;

/**
 * Argument types that count as a real mainline argumentative move — the kind
 * that can claim the Primary Opponent seat. `evidence` and
 * `clarification_request` are legitimate support / inquiry moves but are NOT
 * seat-claiming on their own (anti-sniping: a bare source attach or a one-line
 * clarification is not the real argumentative move).
 */
export const MAINLINE_RESPONSE_TYPES: ReadonlySet<string> = new Set([
  'claim',
  'rebuttal',
  'counter_rebuttal',
  'concession',
  'synthesis',
]);

/**
 * Open moderation flag codes that block a move from claiming the seat. A move
 * carrying any of these is rejected (`flagged_for_review`).
 */
export const SEAT_BLOCKING_FLAG_CODES: ReadonlySet<string> = new Set([
  'civility',
  'spam',
  'off_topic_blocking',
  'off_topic',
  'harassment',
  'abuse',
]);

/**
 * Frozen plain-language copy. Re-exported so tests assert on these exact
 * strings rather than re-authoring copy. No verdict words anywhere.
 */
export const ROOM_CONTRACT_COPY = Object.freeze({
  privateRoom: 'Private room',
  publicRoom: 'Public room',
  seatYou: 'You',
  seatInitiator: 'Initiator',
  seatOpponent: 'Opponent',
  seatOpen: 'Open seat — first reply takes it',
  turnYours: 'Your move',
  turnOpponent: "Opponent's move",
  turnInitiator: "Initiator's move",
  turnOpenSeat: 'Open seat — first reply takes it',
  vsSeparator: 'vs',
} as const);

// ── Input types (narrowed copies of app rows) ──────────────────

/** A `debate_participants` row, narrowed to what the contract needs. */
export interface RoomParticipantInput {
  userId: string;
  /** 'affirmative' | 'negative' | 'observer' | 'moderator'. */
  side: string;
  /** `debate_participants.joined_at` ISO string. */
  joinedAt: string;
}

/** An `arguments` row, narrowed to what the contract + predicate need. */
export interface RoomArgumentInput {
  id: string;
  parentId: string | null;
  authorId: string | null;
  /**
   * 'thesis' | 'claim' | 'rebuttal' | 'counter_rebuttal' | 'evidence' |
   * 'clarification_request' | 'concession' | 'synthesis'.
   */
  argumentType: string | null;
  body: string;
  /** 'draft' | 'posted' | 'hidden' | 'deleted'. */
  status: string | null;
  createdAt: string;
  /** Optional — true when the row is a bot fixture move. */
  isBot?: boolean | null;
}

/**
 * Co-located per-argument signals the room already loads (Stage 6.4 / EV /
 * META). All optional. Used to reject a sniped first response.
 */
export interface QualifyingResponseSignals {
  /**
   * Per-argument open (non-dismissed) flag codes — from `argument_flags`.
   * Already loaded by `useArgumentRoomMessages` as `flagsByArgumentId`.
   */
  flagCodesByArgumentId?: Record<string, ReadonlyArray<string>>;
  /**
   * Per-argument "has an open deletion request" boolean — the room's existing
   * `deletionRequestedMap`. A move with an open deletion request does NOT
   * claim the seat.
   */
  deletionRequestedByArgumentId?: Record<string, boolean>;
}

export interface BuildRoomContractInput {
  /** `debates.id`. */
  roomId: string;
  /** `debates.created_by` — the Initiator. Required. */
  initiatorUserId: string;
  /** `debates.created_at`. */
  openedAt: string;
  /**
   * Room type. v1 has no persisted source for this, so the caller supplies
   * it. When omitted it defaults to ROOM_TYPE_DEFAULT ('public') — the
   * doctrine-safe default because a public room leaves the opponent seat OPEN
   * and claimable, whereas a wrong 'private' guess would freeze the seat.
   */
  roomType?: RoomType;
  /**
   * Private-room invited opponent. v1 has no persisted invite, so this is also
   * caller-supplied and optional. Only consulted when roomType === 'private'.
   * When a private room has an invitedOpponentUserId, that user is the Primary
   * Opponent regardless of post order.
   */
  invitedOpponentUserId?: string | null;
  /** All `debate_participants` rows for the room (already RLS-loaded). */
  participants: ReadonlyArray<RoomParticipantInput>;
  /**
   * All posted `arguments` rows for the room, any order. The model sorts them
   * chronologically internally.
   */
  arguments: ReadonlyArray<RoomArgumentInput>;
  /**
   * Optional per-argument signals used by `isQualifyingResponse` to reject a
   * sniped seat claim. All optional — an empty map means "no extra signal".
   */
  signals?: QualifyingResponseSignals;
}

// ── Qualifying-response predicate ──────────────────────────────

export type DisqualifyReason =
  | 'not_a_mainline_move' //   evidence-only / clarification-request-only, or a non-argumentative type
  | 'too_short' //            body below MIN_QUALIFYING_BODY_CHARS after trim
  | 'is_root' //              the root/opening argument itself is never a "response"
  | 'authored_by_initiator' // the OP's own move never claims the opponent seat
  | 'not_posted' //           status !== 'posted' (draft / hidden / deleted)
  | 'flagged_for_review' //   has an open review/blocking flag
  | 'deletion_requested' //   has an open deletion request
  | 'bot_move'; //            isBot === true — bots never claim a human PvP seat

export interface QualifyingResponseResult {
  qualifies: boolean;
  /** null when qualifies === true; the first failing reason otherwise. */
  reason: DisqualifyReason | null;
}

export interface IsQualifyingResponseOptions {
  /** The room Initiator — used for the `authored_by_initiator` rejection. */
  initiatorUserId: string;
  /** Optional co-located signals (flags, deletion requests). */
  signals?: QualifyingResponseSignals;
}

/**
 * Deterministic predicate. Returns the first failing `DisqualifyReason`, or
 * `{ qualifies: true, reason: null }`. Checks run in a fixed order so the
 * reported reason is stable.
 */
export function explainQualifyingResponse(
  argument: RoomArgumentInput,
  options: IsQualifyingResponseOptions,
): QualifyingResponseResult {
  // 1. Must be a posted row.
  if (argument.status !== 'posted') {
    return { qualifies: false, reason: 'not_posted' };
  }
  // 2. The opening (root) argument is never a "response".
  if (argument.parentId === null) {
    return { qualifies: false, reason: 'is_root' };
  }
  // 3. The Initiator's own move never claims the opponent seat. A null author
  //    also cannot claim the seat (no identity to assign).
  if (argument.authorId === null || argument.authorId === options.initiatorUserId) {
    return { qualifies: false, reason: 'authored_by_initiator' };
  }
  // 4. Bots never claim a human PvP seat (GAME-008 owns bot rooms).
  if (argument.isBot === true) {
    return { qualifies: false, reason: 'bot_move' };
  }
  // 5. An open deletion request disqualifies the move.
  if (options.signals?.deletionRequestedByArgumentId?.[argument.id] === true) {
    return { qualifies: false, reason: 'deletion_requested' };
  }
  // 6. An open review/blocking moderation flag disqualifies the move.
  const flagCodes = options.signals?.flagCodesByArgumentId?.[argument.id];
  if (flagCodes && flagCodes.some((code) => SEAT_BLOCKING_FLAG_CODES.has(code))) {
    return { qualifies: false, reason: 'flagged_for_review' };
  }
  // 7. Must be a real mainline argumentative move (not evidence-only / a bare
  //    clarification request). This is the anti-sniping core.
  if (argument.argumentType === null || !MAINLINE_RESPONSE_TYPES.has(argument.argumentType)) {
    return { qualifies: false, reason: 'not_a_mainline_move' };
  }
  // 8. Anti-sniping body-length gate.
  if (argument.body.trim().length < MIN_QUALIFYING_BODY_CHARS) {
    return { qualifies: false, reason: 'too_short' };
  }
  return { qualifies: true, reason: null };
}

/**
 * Boolean form of {@link explainQualifyingResponse}. A qualifying response is
 * a real mainline argumentative move — not spam, not a bare flag-carrying
 * move, not an off-topic one-liner, not immediately deletion-requested, not a
 * bot move, not the Initiator's own move.
 */
export function isQualifyingResponse(
  argument: RoomArgumentInput,
  options: IsQualifyingResponseOptions,
): boolean {
  return explainQualifyingResponse(argument, options).qualifies;
}

// ── Internal helpers ───────────────────────────────────────────

/**
 * Chronologically sorted copy of the posted arguments. Sorts by `createdAt`
 * ascending, tie-broken by `id` ascending so the result is fully
 * deterministic even when two rows share a millisecond. Does NOT mutate the
 * input array.
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

/** The earliest posted root argument id, or null when there is none. */
function resolveOpeningArgumentId(
  argumentsList: ReadonlyArray<RoomArgumentInput>,
): string | null {
  const roots = sortedChronologically(
    argumentsList.filter((a) => a.parentId === null && a.status === 'posted'),
  );
  return roots.length > 0 ? roots[0].id : null;
}

// ── Primary Opponent resolution ────────────────────────────────

/**
 * Deterministic, pure. The single source of truth for who holds the Primary
 * Opponent seat. Returns the userId, or null when the seat is still open.
 *
 * Private rooms: when an `invitedOpponentUserId` is recorded (and is not the
 * Initiator), that user is the Primary Opponent regardless of post order. A
 * private room with no recorded invite falls through to the public rule.
 *
 * Public rule (and private-without-invite fallback): the FIRST qualifying
 * response — chronologically — is the Primary Opponent. If nothing qualifies
 * the seat is open (null).
 */
export function resolvePrimaryOpponent(input: BuildRoomContractInput): string | null {
  const roomType = input.roomType ?? ROOM_TYPE_DEFAULT;

  if (roomType === 'private') {
    const invited = input.invitedOpponentUserId;
    if (
      typeof invited === 'string' &&
      invited.length > 0 &&
      invited !== input.initiatorUserId
    ) {
      return invited; // invite overrides post order
    }
    // private room with no valid recorded invite → fall through to public rule
  }

  const chronological = sortedChronologically(input.arguments);
  for (const argument of chronological) {
    if (
      isQualifyingResponse(argument, {
        initiatorUserId: input.initiatorUserId,
        signals: input.signals,
      })
    ) {
      return argument.authorId; // authorId is non-null past the predicate
    }
  }
  return null;
}

/**
 * Builds the derived 1v1 room contract. Deterministic — calling it twice on
 * the same input yields a deeply-equal result. The returned object is frozen.
 */
export function buildRoomContract(input: BuildRoomContractInput): RoomContract {
  const roomType = input.roomType ?? ROOM_TYPE_DEFAULT;
  return Object.freeze({
    roomId: input.roomId,
    roomType,
    initiatorUserId: input.initiatorUserId,
    primaryOpponentUserId: resolvePrimaryOpponent(input),
    openedAt: input.openedAt,
    openingArgumentId: resolveOpeningArgumentId(input.arguments),
  });
}

/**
 * Advisory detector. True when the Primary Opponent seat MAY be re-opened: the
 * seat is claimed, and the Primary Opponent has not posted a qualifying
 * mainline move within PRIMARY_OPPONENT_INACTIVITY_MS. Never mutates the
 * contract — re-opening is an explicit OP action in a follow-up card.
 */
export function isPrimaryOpponentSeatStale(
  contract: RoomContract,
  argumentsList: ReadonlyArray<RoomArgumentInput>,
  nowMs: number,
): boolean {
  if (contract.primaryOpponentUserId === null) {
    return false; // seat is open — nothing to re-open
  }
  // Find the opponent's most recent qualifying mainline move.
  let latestMs: number | null = null;
  for (const argument of argumentsList) {
    if (argument.authorId !== contract.primaryOpponentUserId) continue;
    if (
      !isQualifyingResponse(argument, { initiatorUserId: contract.initiatorUserId })
    ) {
      continue;
    }
    const ms = Date.parse(argument.createdAt);
    if (Number.isNaN(ms)) continue;
    if (latestMs === null || ms > latestMs) latestMs = ms;
  }
  if (latestMs === null) {
    // The opponent holds the seat but has no qualifying move on record (e.g.
    // private-invite seat with no posts yet). Measure from the room open.
    const openedMs = Date.parse(contract.openedAt);
    if (Number.isNaN(openedMs)) return false;
    return nowMs - openedMs >= PRIMARY_OPPONENT_INACTIVITY_MS;
  }
  return nowMs - latestMs >= PRIMARY_OPPONENT_INACTIVITY_MS;
}

// ── Seat view-model (for the UI) ───────────────────────────────

/** One of the two seats, projected for rendering. Pure data — no JSX. */
export interface SeatViewModel {
  seat: PrimarySeat;
  /**
   * Plain-language label describing the seat's relationship to the VIEWER.
   * 'You' | 'Initiator' | 'Opponent' | 'Open seat — first reply takes it'.
   * Never the person's name, never a verdict word.
   */
  label: string;
  /** True when this seat is held by the current viewer. */
  isViewer: boolean;
  /** True when this seat is currently unclaimed (opponent seat, open public room). */
  isOpen: boolean;
  /** The userId in the seat, or null when isOpen. NOT rendered as text. */
  userId: string | null;
}

/** The full read-time projection the header strip renders. */
export interface RoomContractViewModel {
  roomId: string;
  /** 'Private room' | 'Public room'. */
  roomTypeLabel: string;
  initiatorSeat: SeatViewModel;
  opponentSeat: SeatViewModel;
  /**
   * Whose move it is, in plain language, or null when it cannot be determined
   * (no opening argument yet, or opponent seat still open).
   */
  turnLabel: string | null;
  /** The id of the opening (root) argument, or null. Used to scroll/anchor. */
  openingArgumentId: string | null;
  /** Full a11y label for the strip root (see Accessibility section). */
  accessibilityLabel: string;
}

/**
 * The most recent posted mainline argument authored by either primary seat
 * holder. Chime-in / observer moves are ignored — they do not change whose
 * turn it is on the 1v1 mainline. Returns null when there is no such move.
 */
function latestMainlineAuthor(
  contract: RoomContract,
  argumentsList: ReadonlyArray<RoomArgumentInput>,
): string | null {
  const seatHolders = new Set<string>([contract.initiatorUserId]);
  if (contract.primaryOpponentUserId !== null) {
    seatHolders.add(contract.primaryOpponentUserId);
  }
  const chronological = sortedChronologically(
    argumentsList.filter(
      (a) =>
        a.status === 'posted' &&
        a.authorId !== null &&
        seatHolders.has(a.authorId),
    ),
  );
  if (chronological.length === 0) return null;
  return chronological[chronological.length - 1].authorId;
}

/**
 * Pure projection of a {@link RoomContract} into the header view-model.
 * `viewerUserId` may be null (observer not signed in / not a participant).
 */
export function buildRoomContractViewModel(
  contract: RoomContract,
  viewerUserId: string | null,
  argumentsList: ReadonlyArray<RoomArgumentInput> = [],
): RoomContractViewModel {
  const roomTypeLabel =
    contract.roomType === 'private'
      ? ROOM_CONTRACT_COPY.privateRoom
      : ROOM_CONTRACT_COPY.publicRoom;

  const viewerIsInitiator =
    viewerUserId !== null && viewerUserId === contract.initiatorUserId;
  const viewerIsOpponent =
    viewerUserId !== null &&
    contract.primaryOpponentUserId !== null &&
    viewerUserId === contract.primaryOpponentUserId;

  const initiatorSeat: SeatViewModel = {
    seat: 'initiator',
    label: viewerIsInitiator
      ? ROOM_CONTRACT_COPY.seatYou
      : ROOM_CONTRACT_COPY.seatInitiator,
    isViewer: viewerIsInitiator,
    isOpen: false,
    userId: contract.initiatorUserId,
  };

  const opponentOpen = contract.primaryOpponentUserId === null;
  const opponentSeat: SeatViewModel = {
    seat: 'primary_opponent',
    label: opponentOpen
      ? ROOM_CONTRACT_COPY.seatOpen
      : viewerIsOpponent
        ? ROOM_CONTRACT_COPY.seatYou
        : ROOM_CONTRACT_COPY.seatOpponent,
    isViewer: viewerIsOpponent,
    isOpen: opponentOpen,
    userId: contract.primaryOpponentUserId,
  };

  // Turn model — minimal and deterministic. Turn pacing is GAME-002's job.
  let turnLabel: string | null;
  if (contract.openingArgumentId === null) {
    turnLabel = null; // room has not opened
  } else if (opponentOpen) {
    turnLabel = ROOM_CONTRACT_COPY.turnOpenSeat;
  } else {
    const lastAuthor = latestMainlineAuthor(contract, argumentsList);
    // Whose move = whoever did NOT author the latest mainline move.
    let nextSeatUserId: string;
    if (lastAuthor === null || lastAuthor === contract.initiatorUserId) {
      // Initiator opened / spoke last → opponent's move.
      nextSeatUserId = contract.primaryOpponentUserId as string;
    } else {
      // Opponent spoke last → Initiator's move.
      nextSeatUserId = contract.initiatorUserId;
    }
    if (viewerUserId !== null && viewerUserId === nextSeatUserId) {
      turnLabel = ROOM_CONTRACT_COPY.turnYours;
    } else if (nextSeatUserId === contract.initiatorUserId) {
      turnLabel = ROOM_CONTRACT_COPY.turnInitiator;
    } else {
      turnLabel = ROOM_CONTRACT_COPY.turnOpponent;
    }
  }

  const accessibilityLabel = buildStripAccessibilityLabel(
    roomTypeLabel,
    initiatorSeat,
    opponentSeat,
    turnLabel,
  );

  return {
    roomId: contract.roomId,
    roomTypeLabel,
    initiatorSeat,
    opponentSeat,
    turnLabel,
    openingArgumentId: contract.openingArgumentId,
    accessibilityLabel,
  };
}

/**
 * Composes the screen-reader label for the strip root. Summarises room type +
 * both seats + whose turn. Plain language only — no verdict words, no
 * snake_case.
 */
function buildStripAccessibilityLabel(
  roomTypeLabel: string,
  initiatorSeat: SeatViewModel,
  opponentSeat: SeatViewModel,
  turnLabel: string | null,
): string {
  const parts: string[] = [`${roomTypeLabel}.`];

  if (initiatorSeat.isViewer) {
    parts.push('You are the Initiator.');
  } else {
    parts.push('The Initiator holds the first seat.');
  }

  if (opponentSeat.isOpen) {
    parts.push('Opponent seat is open — the first qualifying reply takes it.');
  } else if (opponentSeat.isViewer) {
    parts.push('You hold the Primary Opponent seat.');
  } else {
    parts.push('The Primary Opponent seat is held.');
  }

  if (turnLabel !== null) {
    parts.push(`${turnLabel}.`);
  }

  return parts.join(' ');
}
