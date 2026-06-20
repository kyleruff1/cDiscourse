/**
 * UX-ROUTE-SEAT-INVITE-COPY-001 — OD-5 guard.
 *
 * The operator decided the second-principal role word: "Other voice".
 * This is a COPY-ONLY relabel of the visible "Opponent" label on an
 * ESTABLISHED 1:1 (the "You vs …" comparison). It changes NO room / seat /
 * invite / chime-in / observer semantics, and it does NOT broad-rename the
 * internal `primaryOpponentUserId` / `resolvePrimaryOpponent` model.
 *
 * This suite pins:
 *  1. The four visible relabel surfaces now emit "Other voice" for the
 *     second principal.
 *  2. "Other voice" is reserved for the second principal — never observer /
 *     reader / chime-in / dormant-chime-in copy.
 *  3. The open public seat still reads "Respondent seat open" (unchanged).
 *  4. Observer / reader copy stays distinct and unchanged.
 *  5. The internal model names survive byte-identical (the rename was
 *     copy-only) — a guard that the relabel did not leak into persisted /
 *     resolution concepts.
 *
 * Pure model only — no React, no Supabase, no network.
 */
import * as roomContractModule from '../src/features/debates/roomContractModel';
import {
  ROOM_CONTRACT_COPY,
  buildRoomContract,
  buildRoomContractViewModel,
  type BuildRoomContractInput,
  type RoomArgumentInput,
} from '../src/features/debates/roomContractModel';
import {
  buildArgumentTimelineMap,
  type ArgumentMessageInput,
} from '../src/features/arguments/argumentGameSurfaceModel';
import { computeStatementStanding } from '../src/features/arguments/argumentScoreModel';
import {
  buildConversationGalleryCards,
  type GalleryArgumentInput,
} from '../src/features/debates/conversationGalleryModel';
import type { Debate } from '../src/features/debates/types';

const NEW_LABEL = 'Other voice';
const OLD_LABEL = 'Opponent';

// ──────────────────────────────────────────────────────────────
// 1. Frozen copy — ROOM_CONTRACT_COPY.seatOpponent
// ──────────────────────────────────────────────────────────────

describe('OD-5 — ROOM_CONTRACT_COPY.seatOpponent', () => {
  it('is the new role word "Other voice"', () => {
    expect(ROOM_CONTRACT_COPY.seatOpponent).toBe(NEW_LABEL);
  });

  it('is no longer the bare "Opponent" label', () => {
    expect(ROOM_CONTRACT_COPY.seatOpponent).not.toBe(OLD_LABEL);
  });

  it('leaves the open second-principal seat copy unchanged (not chime-in)', () => {
    // Doctrine guard — the open seat reads in respondent/principal language.
    expect(ROOM_CONTRACT_COPY.seatOpen).toBe('Respondent seat open');
    expect(ROOM_CONTRACT_COPY.turnOpenSeat).toBe('Respondent seat open');
    expect(ROOM_CONTRACT_COPY.seatOpen.toLowerCase()).not.toContain('chime');
  });

  it('relabels the second-principal turn line to "Other voice\'s move"', () => {
    expect(ROOM_CONTRACT_COPY.turnOpponent).toBe("Other voice's move");
    expect(ROOM_CONTRACT_COPY.turnYours).toBe('Your move'); // unchanged
    expect(ROOM_CONTRACT_COPY.turnInitiator).toBe("Initiator's move"); // first principal, unchanged
  });

  it('no rendered ROOM_CONTRACT_COPY value contains the bare word "Opponent"', () => {
    // Completeness guard: the relabel is total across the copy block VALUES.
    // (The seatOpponent / turnOpponent KEYS intentionally retain the internal name.)
    for (const value of Object.values(ROOM_CONTRACT_COPY)) {
      expect(value).not.toMatch(/Opponent/);
    }
  });
});

// ──────────────────────────────────────────────────────────────
// 2. Seat-pill (RoomContractSeatStrip source of truth) — the
//    second-principal seat label on an established 1:1.
// ──────────────────────────────────────────────────────────────

const INITIATOR = 'user-initiator';
const OPPONENT = 'user-opponent';
const OTHER = 'user-observer';

/** A body comfortably above MIN_QUALIFYING_BODY_CHARS. */
const LONG_BODY =
  'I disagree with the root claim because the cited mechanism does not hold under the stated conditions.';

function roomRoot(partial: Partial<RoomArgumentInput> = {}): RoomArgumentInput {
  return {
    id: 'root',
    parentId: null,
    authorId: INITIATOR,
    argumentType: 'thesis',
    body: 'The opening claim of the room which is plenty long enough.',
    status: 'posted',
    createdAt: '2026-05-20T00:30:00.000Z',
    ...partial,
  };
}

function roomReply(partial: Partial<RoomArgumentInput> & { id: string }): RoomArgumentInput {
  return {
    id: partial.id,
    parentId: partial.parentId ?? 'root',
    authorId: partial.authorId ?? OPPONENT,
    argumentType: partial.argumentType ?? 'rebuttal',
    body: partial.body ?? LONG_BODY,
    status: partial.status ?? 'posted',
    createdAt: partial.createdAt ?? '2026-05-20T01:00:00.000Z',
  };
}

function roomInput(partial: Partial<BuildRoomContractInput> = {}): BuildRoomContractInput {
  return {
    roomId: partial.roomId ?? 'room-1',
    initiatorUserId: partial.initiatorUserId ?? INITIATOR,
    openedAt: partial.openedAt ?? '2026-05-20T00:00:00.000Z',
    participants: partial.participants ?? [],
    roomType: partial.roomType ?? 'public',
    arguments:
      partial.arguments ?? [roomRoot(), roomReply({ id: 'a1', authorId: OPPONENT })],
    ...(partial.invitedOpponentUserId !== undefined
      ? { invitedOpponentUserId: partial.invitedOpponentUserId }
      : {}),
  };
}

describe('OD-5 — second-principal seat pill on an established 1:1', () => {
  const claimed = buildRoomContract(roomInput());

  it('shows "Other voice" to the initiator viewer', () => {
    const vm = buildRoomContractViewModel(claimed, INITIATOR);
    expect(vm.opponentSeat.label).toBe(NEW_LABEL);
  });

  it('shows "Other voice" to a null / observer viewer (role label, not "You")', () => {
    expect(buildRoomContractViewModel(claimed, null).opponentSeat.label).toBe(NEW_LABEL);
    expect(buildRoomContractViewModel(claimed, OTHER).opponentSeat.label).toBe(NEW_LABEL);
  });

  it('still shows "You" when the viewer IS the second principal (unchanged)', () => {
    expect(buildRoomContractViewModel(claimed, OPPONENT).opponentSeat.label).toBe('You');
  });

  it('"Other voice" never renders on the OPEN second-principal seat', () => {
    const openSeat = buildRoomContract(roomInput({ arguments: [roomRoot()] }));
    const vm = buildRoomContractViewModel(openSeat, INITIATOR);
    expect(vm.opponentSeat.isOpen).toBe(true);
    expect(vm.opponentSeat.label).toBe('Respondent seat open');
    expect(vm.opponentSeat.label).not.toBe(NEW_LABEL);
  });
});

// ──────────────────────────────────────────────────────────────
// 3. Argument timeline / score actor labels — the 'other' actor.
// ──────────────────────────────────────────────────────────────

function msg(partial: Partial<ArgumentMessageInput> & { id: string }): ArgumentMessageInput {
  return {
    id: partial.id,
    debateId: partial.debateId ?? 'd-1',
    parentId: partial.parentId ?? null,
    authorId: partial.authorId ?? 'author-other',
    argumentType: partial.argumentType ?? 'thesis',
    side: partial.side ?? 'affirmative',
    body: partial.body ?? 'A reasonably long argument body for the surface.',
    status: partial.status ?? 'posted',
    createdAt: partial.createdAt ?? '2026-05-20T00:00:00.000Z',
    isBot: partial.isBot ?? false,
  };
}

describe('OD-5 — argumentGameSurfaceModel actor label (other)', () => {
  it("renders 'Other voice' for the 'other' actor node", () => {
    // currentUserId is null → a known author is classified 'other'.
    const model = buildArgumentTimelineMap({
      messages: [msg({ id: 'm1', authorId: 'author-other' })],
      currentUserId: null,
    });
    const node = model.nodes.find((n) => n.messageId === 'm1');
    expect(node).toBeDefined();
    expect(node?.actorLabel).toBe(NEW_LABEL);
  });

  it("renders 'You' for the current user (unchanged)", () => {
    const model = buildArgumentTimelineMap({
      messages: [msg({ id: 'm1', authorId: 'me' })],
      currentUserId: 'me',
    });
    expect(model.nodes.find((n) => n.messageId === 'm1')?.actorLabel).toBe('You');
  });
});

describe('OD-5 — argumentScoreModel actor label (other)', () => {
  it("renders 'Other voice' for the 'other' actor standing", () => {
    const standing = computeStatementStanding({
      message: msg({ id: 'm1', authorId: 'author-other' }),
      currentUserId: null,
    });
    expect(standing.actorLabel).toBe(NEW_LABEL);
  });

  it("renders 'You' for the current user (unchanged)", () => {
    const standing = computeStatementStanding({
      message: msg({ id: 'm1', authorId: 'me' }),
      currentUserId: 'me',
    });
    expect(standing.actorLabel).toBe('You');
  });
});

// ──────────────────────────────────────────────────────────────
// 4. Conversation gallery latest-post author.
// ──────────────────────────────────────────────────────────────

function isoAt(ms: number): string { return new Date(ms).toISOString(); }

function galleryDebate(id: string): Debate {
  const base = 1715000000000;
  return {
    id,
    createdBy: 'user-creator',
    title: 'A gallery room',
    resolution: 'A gallery resolution.',
    description: '',
    status: 'open',
    constitutionId: 'c1',
    createdAt: isoAt(base),
    updatedAt: isoAt(base),
    myParticipantSide: null,
    visibility: 'public',
    inactiveAt: null,
  };
}

function galleryArg(
  partial: Partial<GalleryArgumentInput> & { id: string; debateId: string },
): GalleryArgumentInput {
  return {
    id: partial.id,
    debateId: partial.debateId,
    parentId: partial.parentId ?? null,
    authorId: partial.authorId ?? 'author-a',
    argumentType: partial.argumentType ?? 'thesis',
    side: partial.side ?? 'affirmative',
    body: partial.body ?? 'A reasonably substantial gallery body.',
    status: partial.status ?? 'posted',
    createdAt: partial.createdAt ?? isoAt(1715000000000),
    updatedAt: partial.updatedAt ?? null,
  };
}

describe('OD-5 — conversationGalleryModel latestPostAuthor', () => {
  it("labels a non-self latest author 'Other voice'", () => {
    const cards = buildConversationGalleryCards({
      debates: [galleryDebate('d1')],
      argumentsByDebateId: {
        d1: [
          galleryArg({ id: 'd1-root', debateId: 'd1', authorId: 'someone-else',
            createdAt: isoAt(1715000000000) }),
          galleryArg({ id: 'd1-latest', debateId: 'd1', authorId: 'someone-else',
            parentId: 'd1-root', createdAt: isoAt(1715000100000) }),
        ],
      },
      currentUserId: 'me',
    });
    expect(cards.length).toBeGreaterThan(0);
    expect(cards[0].latestPostAuthor).toBe(NEW_LABEL);
  });

  it("labels a self latest author 'You' (unchanged)", () => {
    const cards = buildConversationGalleryCards({
      debates: [galleryDebate('d2')],
      argumentsByDebateId: {
        d2: [
          galleryArg({ id: 'd2-root', debateId: 'd2', authorId: 'me',
            createdAt: isoAt(1715000000000) }),
        ],
      },
      currentUserId: 'me',
    });
    expect(cards[0].latestPostAuthor).toBe('You');
  });
});

// ──────────────────────────────────────────────────────────────
// 5. "Other voice" is reserved for the second principal — never
//    observer / reader / chime-in / dormant-chime-in copy.
// ──────────────────────────────────────────────────────────────

describe('OD-5 — "Other voice" never refers to observers / readers / chime-in', () => {
  it('observer / reader / chime-in copy in ROOM_CONTRACT_COPY is not "Other voice"', () => {
    for (const [key, value] of Object.entries(ROOM_CONTRACT_COPY)) {
      if (key === 'seatOpponent') continue; // the one intended carrier
      expect(value).not.toBe(NEW_LABEL);
    }
  });

  it('the new label carries no verdict / truth token', () => {
    const banned = [
      'winner', 'loser', 'truth', 'true', 'false', 'liar', 'wrong',
      'dishonest', 'bad faith', 'manipulative', 'enemy', 'adversary',
      'challenger',
    ];
    const lower = NEW_LABEL.toLowerCase();
    for (const b of banned) {
      expect(lower).not.toContain(b);
    }
  });
});

// ──────────────────────────────────────────────────────────────
// 6. Internal model names survive byte-identical (copy-only rename).
// ──────────────────────────────────────────────────────────────

describe('OD-5 — internal Primary Opponent model names unchanged', () => {
  it('resolvePrimaryOpponent is still exported', () => {
    expect(typeof roomContractModule.resolvePrimaryOpponent).toBe('function');
  });

  it('isPrimaryOpponentSeatStale is still exported', () => {
    expect(typeof roomContractModule.isPrimaryOpponentSeatStale).toBe('function');
  });

  it('the built contract still exposes primaryOpponentUserId', () => {
    const contract = buildRoomContract(roomInput());
    expect(contract).toHaveProperty('primaryOpponentUserId');
    expect(contract.primaryOpponentUserId).toBe(OPPONENT);
  });

  it('an open second-principal seat resolves primaryOpponentUserId to null', () => {
    const contract = buildRoomContract(roomInput({ arguments: [roomRoot()] }));
    expect(contract.primaryOpponentUserId).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────
// 7. OD-5B — screen-reader (accessibilityLabel) strings match the
//    visible OD-5 vocabulary: open principal seat = "Respondent seat",
//    established second principal = "Other voice"; never "Opponent",
//    never "chime-in" on the open seat.
// ──────────────────────────────────────────────────────────────

describe('OD-5B — strip accessibilityLabel uses OD-5 vocabulary', () => {
  it('an ESTABLISHED 1:1 announces "Other voice seat", never "Opponent"', () => {
    const claimed = buildRoomContract(roomInput());
    for (const viewer of [INITIATOR, OTHER, null]) {
      const a11y = buildRoomContractViewModel(claimed, viewer).accessibilityLabel;
      expect(a11y).toContain('Other voice seat');
      expect(a11y).not.toMatch(/Opponent/);
    }
    // viewer IS the second principal → still "Other voice seat" (held by you)
    expect(buildRoomContractViewModel(claimed, OPPONENT).accessibilityLabel).toContain(
      'Other voice seat',
    );
  });

  it('an OPEN principal seat announces "Respondent seat is open", never "Opponent"/"chime"', () => {
    const open = buildRoomContract(roomInput({ arguments: [roomRoot()] }));
    const a11y = buildRoomContractViewModel(open, INITIATOR).accessibilityLabel;
    expect(a11y).toContain('Respondent seat is open');
    expect(a11y).not.toMatch(/Opponent/);
    expect(a11y.toLowerCase()).not.toContain('chime');
  });

  it('keeps "Initiator" wording (first principal) in the a11y label', () => {
    const claimed = buildRoomContract(roomInput());
    expect(buildRoomContractViewModel(claimed, OTHER).accessibilityLabel).toContain('Initiator');
  });
});
