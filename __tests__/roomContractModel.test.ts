/**
 * GAME-004 — pure room contract model tests.
 *
 * Covers the full `resolvePrimaryOpponent` edge table, the full
 * `isQualifyingResponse` / `explainQualifyingResponse` predicate table,
 * `buildRoomContract`, `buildRoomContractViewModel`,
 * `isPrimaryOpponentSeatStale`, determinism, no-mutation, and the
 * anti-griefing API-surface assertion (no reject/override function exists).
 *
 * Pure TS — no React, no Supabase, no fetch.
 */
import {
  buildRoomContract,
  buildRoomContractViewModel,
  explainQualifyingResponse,
  isPrimaryOpponentSeatStale,
  isQualifyingResponse,
  resolvePrimaryOpponent,
  MIN_QUALIFYING_BODY_CHARS,
  PRIMARY_OPPONENT_INACTIVITY_MS,
  ROOM_TYPE_DEFAULT,
  type BuildRoomContractInput,
  type RoomArgumentInput,
} from '../src/features/debates/roomContractModel';
import * as roomContractModel from '../src/features/debates/roomContractModel';

const INITIATOR = 'user-initiator';
const OPPONENT = 'user-opponent';
const OTHER = 'user-other';
const ROOM = 'room-1';
const OPENED_AT = '2026-05-20T00:00:00.000Z';

/** A body comfortably above MIN_QUALIFYING_BODY_CHARS. */
const LONG_BODY =
  'I disagree with the root claim because the cited mechanism does not hold under the stated conditions.';

function arg(over: Partial<RoomArgumentInput>): RoomArgumentInput {
  return {
    id: 'a1',
    parentId: 'root',
    authorId: OPPONENT,
    argumentType: 'rebuttal',
    body: LONG_BODY,
    status: 'posted',
    createdAt: '2026-05-20T01:00:00.000Z',
    ...over,
  };
}

function rootArg(over: Partial<RoomArgumentInput> = {}): RoomArgumentInput {
  return {
    id: 'root',
    parentId: null,
    authorId: INITIATOR,
    argumentType: 'thesis',
    body: 'The opening claim of the room which is plenty long enough.',
    status: 'posted',
    createdAt: '2026-05-20T00:30:00.000Z',
    ...over,
  };
}

function input(over: Partial<BuildRoomContractInput> = {}): BuildRoomContractInput {
  return {
    roomId: ROOM,
    initiatorUserId: INITIATOR,
    openedAt: OPENED_AT,
    participants: [],
    arguments: [],
    ...over,
  };
}

// ── resolvePrimaryOpponent edge table ──────────────────────────

describe('resolvePrimaryOpponent — edge table', () => {
  it('first qualifying response → that author is the opponent', () => {
    const result = resolvePrimaryOpponent(
      input({ arguments: [rootArg(), arg({ id: 'a1', authorId: OPPONENT })] }),
    );
    expect(result).toBe(OPPONENT);
  });

  it('spam-first (too short) → seat stays open, second qualifying move wins', () => {
    const result = resolvePrimaryOpponent(
      input({
        arguments: [
          rootArg(),
          arg({ id: 'a1', authorId: OTHER, body: 'no', createdAt: '2026-05-20T01:00:00.000Z' }),
          arg({ id: 'a2', authorId: OPPONENT, createdAt: '2026-05-20T02:00:00.000Z' }),
        ],
      }),
    );
    expect(result).toBe(OPPONENT);
  });

  it('flag-first (carries a review flag) → rejected, seat goes to next clean move', () => {
    const result = resolvePrimaryOpponent(
      input({
        arguments: [
          rootArg(),
          arg({ id: 'a1', authorId: OTHER, createdAt: '2026-05-20T01:00:00.000Z' }),
          arg({ id: 'a2', authorId: OPPONENT, createdAt: '2026-05-20T02:00:00.000Z' }),
        ],
        signals: { flagCodesByArgumentId: { a1: ['spam'] } },
      }),
    );
    expect(result).toBe(OPPONENT);
  });

  it('deletion-requested-first → rejected, seat goes to next clean move', () => {
    const result = resolvePrimaryOpponent(
      input({
        arguments: [
          rootArg(),
          arg({ id: 'a1', authorId: OTHER, createdAt: '2026-05-20T01:00:00.000Z' }),
          arg({ id: 'a2', authorId: OPPONENT, createdAt: '2026-05-20T02:00:00.000Z' }),
        ],
        signals: { deletionRequestedByArgumentId: { a1: true } },
      }),
    );
    expect(result).toBe(OPPONENT);
  });

  it('off-topic one-liner first → rejected via too_short, seat stays open', () => {
    const result = resolvePrimaryOpponent(
      input({
        arguments: [rootArg(), arg({ id: 'a1', authorId: OTHER, body: 'lol off topic' })],
      }),
    );
    expect(result).toBeNull();
  });

  it("OP's own first reply → rejected (authored_by_initiator)", () => {
    const result = resolvePrimaryOpponent(
      input({ arguments: [rootArg(), arg({ id: 'a1', authorId: INITIATOR })] }),
    );
    expect(result).toBeNull();
  });

  it('bot first reply → rejected (bot_move)', () => {
    const result = resolvePrimaryOpponent(
      input({ arguments: [rootArg(), arg({ id: 'a1', authorId: OPPONENT, isBot: true })] }),
    );
    expect(result).toBeNull();
  });

  it('invited-private → invited user wins even when someone else posts first', () => {
    const result = resolvePrimaryOpponent(
      input({
        roomType: 'private',
        invitedOpponentUserId: OPPONENT,
        arguments: [rootArg(), arg({ id: 'a1', authorId: OTHER })],
      }),
    );
    expect(result).toBe(OPPONENT);
  });

  it('private-without-invite → falls through to first-qualifying-response', () => {
    const result = resolvePrimaryOpponent(
      input({
        roomType: 'private',
        invitedOpponentUserId: null,
        arguments: [rootArg(), arg({ id: 'a1', authorId: OTHER })],
      }),
    );
    expect(result).toBe(OTHER);
  });

  it('invitedOpponentUserId === initiatorUserId → ignored, public rule applies', () => {
    const result = resolvePrimaryOpponent(
      input({
        roomType: 'private',
        invitedOpponentUserId: INITIATOR,
        arguments: [rootArg(), arg({ id: 'a1', authorId: OPPONENT })],
      }),
    );
    expect(result).toBe(OPPONENT);
  });

  it('empty arguments → null', () => {
    expect(resolvePrimaryOpponent(input({ arguments: [] }))).toBeNull();
  });

  it('root-only room → null', () => {
    expect(resolvePrimaryOpponent(input({ arguments: [rootArg()] }))).toBeNull();
  });

  it('two qualifying moves same createdAt → deterministic id tie-break', () => {
    const sameTime = '2026-05-20T01:00:00.000Z';
    const result = resolvePrimaryOpponent(
      input({
        arguments: [
          rootArg(),
          arg({ id: 'b-second', authorId: OTHER, createdAt: sameTime }),
          arg({ id: 'a-first', authorId: OPPONENT, createdAt: sameTime }),
        ],
      }),
    );
    // 'a-first' sorts before 'b-second' by id → its author wins.
    expect(result).toBe(OPPONENT);
  });
});

// ── isQualifyingResponse / explainQualifyingResponse predicate table ──

describe('explainQualifyingResponse — predicate table', () => {
  const opts = { initiatorUserId: INITIATOR };

  it('not_posted — status draft', () => {
    expect(explainQualifyingResponse(arg({ status: 'draft' }), opts)).toEqual({
      qualifies: false,
      reason: 'not_posted',
    });
  });

  it('is_root — parentId null', () => {
    expect(
      explainQualifyingResponse(arg({ parentId: null, authorId: OPPONENT }), opts),
    ).toEqual({ qualifies: false, reason: 'is_root' });
  });

  it('authored_by_initiator — author is the OP', () => {
    expect(explainQualifyingResponse(arg({ authorId: INITIATOR }), opts)).toEqual({
      qualifies: false,
      reason: 'authored_by_initiator',
    });
  });

  it('authored_by_initiator — author is null', () => {
    expect(explainQualifyingResponse(arg({ authorId: null }), opts)).toEqual({
      qualifies: false,
      reason: 'authored_by_initiator',
    });
  });

  it('bot_move — isBot true', () => {
    expect(explainQualifyingResponse(arg({ isBot: true }), opts)).toEqual({
      qualifies: false,
      reason: 'bot_move',
    });
  });

  it('deletion_requested — open deletion request', () => {
    expect(
      explainQualifyingResponse(arg({ id: 'a1' }), {
        ...opts,
        signals: { deletionRequestedByArgumentId: { a1: true } },
      }),
    ).toEqual({ qualifies: false, reason: 'deletion_requested' });
  });

  it('flagged_for_review — carries a seat-blocking flag', () => {
    expect(
      explainQualifyingResponse(arg({ id: 'a1' }), {
        ...opts,
        signals: { flagCodesByArgumentId: { a1: ['civility'] } },
      }),
    ).toEqual({ qualifies: false, reason: 'flagged_for_review' });
  });

  it('not_a_mainline_move — evidence-typed move rejected', () => {
    expect(
      explainQualifyingResponse(arg({ argumentType: 'evidence' }), opts),
    ).toEqual({ qualifies: false, reason: 'not_a_mainline_move' });
  });

  it('not_a_mainline_move — clarification_request rejected', () => {
    expect(
      explainQualifyingResponse(arg({ argumentType: 'clarification_request' }), opts),
    ).toEqual({ qualifies: false, reason: 'not_a_mainline_move' });
  });

  it('too_short — 39-char body rejected at the boundary', () => {
    const body39 = 'x'.repeat(MIN_QUALIFYING_BODY_CHARS - 1);
    expect(body39.length).toBe(39);
    expect(explainQualifyingResponse(arg({ body: body39 }), opts)).toEqual({
      qualifies: false,
      reason: 'too_short',
    });
  });

  it('too_short — 40-char body accepted at the boundary', () => {
    const body40 = 'x'.repeat(MIN_QUALIFYING_BODY_CHARS);
    expect(body40.length).toBe(40);
    expect(explainQualifyingResponse(arg({ body: body40 }), opts)).toEqual({
      qualifies: true,
      reason: null,
    });
  });

  it('happy path — a full rebuttal qualifies', () => {
    expect(explainQualifyingResponse(arg({}), opts)).toEqual({
      qualifies: true,
      reason: null,
    });
    expect(isQualifyingResponse(arg({}), opts)).toBe(true);
  });
});

// ── buildRoomContract ──────────────────────────────────────────

describe('buildRoomContract', () => {
  it('assembles all contract fields', () => {
    const contract = buildRoomContract(
      input({ arguments: [rootArg(), arg({ id: 'a1', authorId: OPPONENT })] }),
    );
    expect(contract).toEqual({
      roomId: ROOM,
      roomType: 'public',
      initiatorUserId: INITIATOR,
      primaryOpponentUserId: OPPONENT,
      openedAt: OPENED_AT,
      openingArgumentId: 'root',
    });
  });

  it("roomType defaults to 'public' when omitted", () => {
    const contract = buildRoomContract(input());
    expect(contract.roomType).toBe('public');
    expect(contract.roomType).toBe(ROOM_TYPE_DEFAULT);
  });

  it('multiple-root defensive pick = earliest by createdAt', () => {
    const contract = buildRoomContract(
      input({
        arguments: [
          rootArg({ id: 'root-late', createdAt: '2026-05-20T05:00:00.000Z' }),
          rootArg({ id: 'root-early', createdAt: '2026-05-20T00:30:00.000Z' }),
        ],
      }),
    );
    expect(contract.openingArgumentId).toBe('root-early');
  });

  it('empty room → null opening + null opponent', () => {
    const contract = buildRoomContract(input({ arguments: [] }));
    expect(contract.openingArgumentId).toBeNull();
    expect(contract.primaryOpponentUserId).toBeNull();
  });
});

// ── buildRoomContractViewModel ─────────────────────────────────

describe('buildRoomContractViewModel', () => {
  const claimed = buildRoomContract(
    input({ arguments: [rootArg(), arg({ id: 'a1', authorId: OPPONENT })] }),
  );
  const openSeat = buildRoomContract(input({ arguments: [rootArg()] }));

  it("viewer is the Initiator → 'You' on the initiator seat", () => {
    const vm = buildRoomContractViewModel(claimed, INITIATOR);
    expect(vm.initiatorSeat.label).toBe('You');
    expect(vm.initiatorSeat.isViewer).toBe(true);
    // OD-5 (UX-ROUTE-SEAT-INVITE-COPY-001) — second-principal seat label.
    expect(vm.opponentSeat.label).toBe('Other voice');
  });

  it("viewer is the Primary Opponent → 'You' on the opponent seat", () => {
    const vm = buildRoomContractViewModel(claimed, OPPONENT);
    expect(vm.opponentSeat.label).toBe('You');
    expect(vm.opponentSeat.isViewer).toBe(true);
    expect(vm.initiatorSeat.label).toBe('Initiator');
  });

  it("observer viewer → role labels only, no 'You'", () => {
    const vm = buildRoomContractViewModel(claimed, OTHER);
    expect(vm.initiatorSeat.label).toBe('Initiator');
    expect(vm.opponentSeat.label).toBe('Other voice');
  });

  it("null viewer → role labels only, no 'You'", () => {
    const vm = buildRoomContractViewModel(claimed, null);
    expect(vm.initiatorSeat.label).toBe('Initiator');
    expect(vm.opponentSeat.label).toBe('Other voice');
  });

  it('open opponent seat → respondent-seat label + isOpen flag', () => {
    // UX-ROOM-1V1-CHIMEIN-001A — the open second-principal seat reads in
    // respondent/principal language, never "chime-in".
    const vm = buildRoomContractViewModel(openSeat, INITIATOR);
    expect(vm.opponentSeat.label).toBe('Respondent seat open');
    expect(vm.opponentSeat.isOpen).toBe(true);
    expect(vm.turnLabel).toBe('Respondent seat open');
  });

  it('private room → Private 1:1 label', () => {
    // UX-ROOM-1V1-CHIMEIN-001A — 1:1-first room-type relabel.
    const privateContract = buildRoomContract(
      input({ roomType: 'private', invitedOpponentUserId: OPPONENT, arguments: [rootArg()] }),
    );
    const vm = buildRoomContractViewModel(privateContract, INITIATOR);
    expect(vm.roomTypeLabel).toBe('Private 1:1');
  });

  it('public room → Public 1:1 label', () => {
    // UX-ROOM-1V1-CHIMEIN-001A — 1:1-first room-type relabel.
    expect(buildRoomContractViewModel(claimed, INITIATOR).roomTypeLabel).toBe('Public 1:1');
  });

  it('no opening argument → turnLabel null', () => {
    const empty = buildRoomContract(input({ arguments: [] }));
    expect(buildRoomContractViewModel(empty, INITIATOR).turnLabel).toBeNull();
  });

  it("opponent spoke last → it is the Initiator's move; viewer-relative", () => {
    // root by Initiator, then opponent's qualifying reply — latest mainline
    // author is the opponent → it is the Initiator's move next.
    const args = [rootArg(), arg({ id: 'a1', authorId: OPPONENT })];
    expect(buildRoomContractViewModel(claimed, INITIATOR, args).turnLabel).toBe('Your move');
    expect(buildRoomContractViewModel(claimed, OPPONENT, args).turnLabel).toBe(
      "Initiator's move",
    );
    expect(buildRoomContractViewModel(claimed, OTHER, args).turnLabel).toBe(
      "Initiator's move",
    );
  });

  it("Initiator spoke last → it is the opponent's move; viewer-relative", () => {
    const args = [
      rootArg(),
      arg({ id: 'a1', authorId: OPPONENT, createdAt: '2026-05-20T01:00:00.000Z' }),
      arg({
        id: 'a2',
        authorId: INITIATOR,
        parentId: 'a1',
        createdAt: '2026-05-20T02:00:00.000Z',
      }),
    ];
    expect(buildRoomContractViewModel(claimed, OPPONENT, args).turnLabel).toBe('Your move');
    expect(buildRoomContractViewModel(claimed, INITIATOR, args).turnLabel).toBe(
      "Other voice's move",
    );
    expect(buildRoomContractViewModel(claimed, OTHER, args).turnLabel).toBe(
      "Other voice's move",
    );
  });
});

// ── isPrimaryOpponentSeatStale ─────────────────────────────────

describe('isPrimaryOpponentSeatStale', () => {
  const lastMoveAt = '2026-05-20T01:00:00.000Z';
  const lastMoveMs = Date.parse(lastMoveAt);
  const contract = buildRoomContract(
    input({ arguments: [rootArg(), arg({ id: 'a1', authorId: OPPONENT, createdAt: lastMoveAt })] }),
  );
  const args = [rootArg(), arg({ id: 'a1', authorId: OPPONENT, createdAt: lastMoveAt })];

  it('false before the inactivity window elapses', () => {
    expect(
      isPrimaryOpponentSeatStale(contract, args, lastMoveMs + PRIMARY_OPPONENT_INACTIVITY_MS - 1),
    ).toBe(false);
  });

  it('true once the inactivity window has elapsed', () => {
    expect(
      isPrimaryOpponentSeatStale(contract, args, lastMoveMs + PRIMARY_OPPONENT_INACTIVITY_MS),
    ).toBe(true);
  });

  it('false again when the opponent posts a fresh qualifying move', () => {
    const freshAt = '2026-05-25T00:00:00.000Z';
    const freshArgs = [
      ...args,
      arg({ id: 'a2', authorId: OPPONENT, parentId: 'a1', createdAt: freshAt }),
    ];
    expect(
      isPrimaryOpponentSeatStale(
        contract,
        freshArgs,
        Date.parse(freshAt) + PRIMARY_OPPONENT_INACTIVITY_MS - 1,
      ),
    ).toBe(false);
  });

  it('false when the seat is still open', () => {
    const openContract = buildRoomContract(input({ arguments: [rootArg()] }));
    expect(isPrimaryOpponentSeatStale(openContract, [rootArg()], Date.now())).toBe(false);
  });
});

// ── determinism + no-mutation ──────────────────────────────────

describe('determinism + no-mutation', () => {
  it('buildRoomContract twice on the same input is deeply equal', () => {
    const inp = input({ arguments: [rootArg(), arg({ id: 'a1', authorId: OPPONENT })] });
    expect(buildRoomContract(inp)).toEqual(buildRoomContract(inp));
  });

  it('does not mutate the input arguments / participants arrays', () => {
    const frozenArgs = Object.freeze([
      rootArg(),
      Object.freeze(arg({ id: 'a1', authorId: OPPONENT })),
    ]);
    const frozenParticipants = Object.freeze([
      Object.freeze({ userId: OPPONENT, side: 'negative', joinedAt: OPENED_AT }),
    ]);
    expect(() =>
      buildRoomContract({
        roomId: ROOM,
        initiatorUserId: INITIATOR,
        openedAt: OPENED_AT,
        participants: frozenParticipants,
        arguments: frozenArgs,
      }),
    ).not.toThrow();
  });
});

// ── API surface — anti-griefing default encoded by omission ────

describe('API surface — no reject / override function exists', () => {
  it('exports no rejectOpponent / setOpponent / replaceOpponent / overrideSeat', () => {
    const mod = roomContractModel as Record<string, unknown>;
    expect(typeof mod.rejectOpponent).toBe('undefined');
    expect(typeof mod.setOpponent).toBe('undefined');
    expect(typeof mod.replaceOpponent).toBe('undefined');
    expect(typeof mod.overrideSeat).toBe('undefined');
    expect(typeof mod.removeOpponent).toBe('undefined');
  });
});
