/**
 * UX-ROOM-1V1-CHIMEIN-001A — 1:1-first room display-state model + copy.
 *
 * Layer A is UI/copy + a pure display-state projection. This suite pins:
 *  - each `RoomOneToOneDisplayState` derives correctly from already-derived inputs;
 *  - the `'unknown'` fallback on insufficient data;
 *  - the open PUBLIC respondent seat is NEVER classified / labelled "chime-in"
 *    and reads in principal language ("Respondent seat open");
 *  - a private room shows NO public chime CTA (`chimeInAllowed('private') === false`
 *    + a structural source-scan that no active chime control is wired);
 *  - private-room copy is OD-1-SAFE — it never claims "no observers" /
 *    "invited parties only" / "only the person you invite";
 *  - an established public 1:1 distinguishes principal voices from observers,
 *    and reader/observer copy stays separate from active-seat copy;
 *  - the DORMANT point-scoped chime-in copy constants exist but no active control
 *    is rendered from them in this card;
 *  - visibility is threaded into the header seat strip (the
 *    useRoomContract → buildRoomContract pipeline reads the passed roomType, and
 *    App.tsx passes `currentDebate.visibility`);
 *  - a ban-list scan over every new/changed copy string (this card's avoid-list
 *    + the universal verdict/amplification/person tokens).
 */
import fs from 'fs';
import path from 'path';
import {
  deriveRoomOneToOneDisplayState,
  buildRoomOneToOneViewModel,
  buildOneToOneSeatLineViewModel,
  chimeInAllowed,
  ALL_ROOM_ONE_TO_ONE_DISPLAY_STATES,
  ROOM_ONE_TO_ONE_COPY,
  POINT_SCOPED_CHIME_IN_COPY,
  _forbiddenOneToOneTokens,
  type RoomOneToOneDisplayInput,
  type RoomOneToOneDisplayState,
} from '../src/features/debates/oneToOneRoomModel';
import {
  buildRoomContract,
  buildRoomContractViewModel,
  ROOM_CONTRACT_COPY,
  type BuildRoomContractInput,
  type RoomArgumentInput,
} from '../src/features/debates/roomContractModel';
import {
  ROOM_ACCESS_COPY,
  ROOM_VISIBILITY_COPY,
  SEAT_CLAIM_COPY,
} from '../src/features/arguments/gameCopy';

const REPO = process.cwd();
const MODEL_SRC = fs.readFileSync(
  path.join(REPO, 'src/features/debates/oneToOneRoomModel.ts'),
  'utf8',
);

// ── Helpers ─────────────────────────────────────────────────────

function input(over: Partial<RoomOneToOneDisplayInput> = {}): RoomOneToOneDisplayInput {
  return {
    visibility: 'public',
    opponentSeatIsOpen: true,
    ...over,
  };
}

// ── deriveRoomOneToOneDisplayState — every state ────────────────

describe('deriveRoomOneToOneDisplayState — derives each state from existing inputs', () => {
  it("private visibility → 'private_invited_access' (regardless of seat/viewer)", () => {
    expect(deriveRoomOneToOneDisplayState(input({ visibility: 'private', opponentSeatIsOpen: null })))
      .toBe('private_invited_access');
    expect(
      deriveRoomOneToOneDisplayState(
        input({ visibility: 'private', opponentSeatIsOpen: false, viewerIsObserver: true }),
      ),
    ).toBe('private_invited_access');
  });

  it("public + open second seat → 'public_respondent_seat_open'", () => {
    expect(deriveRoomOneToOneDisplayState(input({ visibility: 'public', opponentSeatIsOpen: true })))
      .toBe('public_respondent_seat_open');
  });

  it("public + both seats held + no chime data → 'public_principal_voices_established'", () => {
    expect(
      deriveRoomOneToOneDisplayState(
        input({ visibility: 'public', opponentSeatIsOpen: false }),
      ),
    ).toBe('public_principal_voices_established');
  });

  it("public established + free chime seats → 'public_chime_in_available_dormant'", () => {
    expect(
      deriveRoomOneToOneDisplayState(
        input({ visibility: 'public', opponentSeatIsOpen: false, openChimeInSeatCount: 3 }),
      ),
    ).toBe('public_chime_in_available_dormant');
  });

  it("public established + zero chime seats → 'public_chime_in_full_dormant'", () => {
    expect(
      deriveRoomOneToOneDisplayState(
        input({ visibility: 'public', opponentSeatIsOpen: false, openChimeInSeatCount: 0 }),
      ),
    ).toBe('public_chime_in_full_dormant');
  });

  it("public established + pure observer → 'observer_reading'", () => {
    expect(
      deriveRoomOneToOneDisplayState(
        input({
          visibility: 'public',
          opponentSeatIsOpen: false,
          viewerIsObserver: true,
          viewerIsActiveParticipant: false,
          // even with chime data present, a pure observer reads the watching state
          openChimeInSeatCount: 2,
        }),
      ),
    ).toBe('observer_reading');
  });

  it('a principal viewer in an established room is NOT classified as observer_reading', () => {
    expect(
      deriveRoomOneToOneDisplayState(
        input({
          visibility: 'public',
          opponentSeatIsOpen: false,
          viewerIsObserver: true, // contradictory flags — principal wins
          viewerIsActiveParticipant: true,
          openChimeInSeatCount: 2,
        }),
      ),
    ).toBe('public_chime_in_available_dormant');
  });
});

// ── 'unknown' fallback on insufficient data ─────────────────────

describe("deriveRoomOneToOneDisplayState — 'unknown' fallback", () => {
  it.each([null, undefined, 'open' as unknown, '' as unknown])(
    'invalid visibility (%p) → unknown',
    (vis) => {
      expect(
        deriveRoomOneToOneDisplayState(
          input({ visibility: vis as RoomOneToOneDisplayInput['visibility'] }),
        ),
      ).toBe('unknown');
    },
  );

  it('public room with unknown seat state → unknown', () => {
    expect(
      deriveRoomOneToOneDisplayState(input({ visibility: 'public', opponentSeatIsOpen: null })),
    ).toBe('unknown');
    expect(
      deriveRoomOneToOneDisplayState(input({ visibility: 'public', opponentSeatIsOpen: undefined })),
    ).toBe('unknown');
  });

  it('a NaN chime count never invents a chime state (degrades to established)', () => {
    expect(
      deriveRoomOneToOneDisplayState(
        input({ visibility: 'public', opponentSeatIsOpen: false, openChimeInSeatCount: Number.NaN }),
      ),
    ).toBe('public_principal_voices_established');
  });

  it('every returned value is a member of the declared union', () => {
    const seen: RoomOneToOneDisplayState[] = [
      deriveRoomOneToOneDisplayState(input({ visibility: 'private', opponentSeatIsOpen: null })),
      deriveRoomOneToOneDisplayState(input({ opponentSeatIsOpen: true })),
      deriveRoomOneToOneDisplayState(input({ opponentSeatIsOpen: false })),
      deriveRoomOneToOneDisplayState(input({ opponentSeatIsOpen: false, openChimeInSeatCount: 1 })),
      deriveRoomOneToOneDisplayState(input({ opponentSeatIsOpen: false, openChimeInSeatCount: 0 })),
      deriveRoomOneToOneDisplayState(
        input({ opponentSeatIsOpen: false, viewerIsObserver: true }),
      ),
      deriveRoomOneToOneDisplayState(input({ visibility: null })),
    ];
    for (const s of seen) {
      expect(ALL_ROOM_ONE_TO_ONE_DISPLAY_STATES).toContain(s);
    }
  });
});

// ── Respondent seat is NEVER a chime-in ─────────────────────────

describe('the public respondent seat is principal, never chime-in', () => {
  it('the open public seat classifies as respondent_seat_open, not a chime state', () => {
    const state = deriveRoomOneToOneDisplayState(
      input({ visibility: 'public', opponentSeatIsOpen: true, openChimeInSeatCount: 3 }),
    );
    expect(state).toBe('public_respondent_seat_open');
    expect(state).not.toContain('chime');
  });

  it('the respondent-seat subcopy uses principal language ("Respondent seat")', () => {
    const vm = buildRoomOneToOneViewModel(input({ opponentSeatIsOpen: true }));
    expect(vm.subcopy).toBe(ROOM_ONE_TO_ONE_COPY.subcopy_respondent_seat_open);
    expect(vm.subcopy.toLowerCase()).toContain('respondent seat');
    expect(vm.subcopy.toLowerCase()).not.toContain('chime');
  });

  it('the shared room-contract open-seat label is principal, not chime-in', () => {
    expect(ROOM_CONTRACT_COPY.seatOpen).toBe('Respondent seat open');
    expect(ROOM_CONTRACT_COPY.seatOpen.toLowerCase()).not.toContain('chime');
    expect(ROOM_ACCESS_COPY.public_open_line.toLowerCase()).toContain('respondent seat');
    expect(ROOM_ACCESS_COPY.public_open_line.toLowerCase()).not.toContain('chime');
  });
});

// ── chimeInAllowed guard + private no-chime (structural) ─────────

describe('chimeInAllowed — public-only guard', () => {
  it('private rooms are never chime-eligible', () => {
    expect(chimeInAllowed('private')).toBe(false);
  });
  it('public rooms are chime-eligible (guard true; controls still GATE-C)', () => {
    expect(chimeInAllowed('public')).toBe(true);
  });
  it('null / undefined / unknown visibility is not chime-eligible', () => {
    expect(chimeInAllowed(null)).toBe(false);
    expect(chimeInAllowed(undefined)).toBe(false);
    expect(chimeInAllowed('observer' as never)).toBe(false);
  });

  it('the view-model never exposes a chime affordance for a private room', () => {
    const vm = buildRoomOneToOneViewModel(input({ visibility: 'private', opponentSeatIsOpen: null }));
    expect(vm.state).toBe('private_invited_access');
    expect(vm.chimeAffordanceVisible).toBe(false);
  });

  it('the view-model never exposes a chime affordance in ANY state in this card', () => {
    const inputs: RoomOneToOneDisplayInput[] = [
      input({ visibility: 'private', opponentSeatIsOpen: null }),
      input({ opponentSeatIsOpen: true }),
      input({ opponentSeatIsOpen: false }),
      input({ opponentSeatIsOpen: false, openChimeInSeatCount: 3 }),
      input({ opponentSeatIsOpen: false, openChimeInSeatCount: 0 }),
      input({ opponentSeatIsOpen: false, viewerIsObserver: true }),
      input({ visibility: null }),
    ];
    for (const i of inputs) {
      expect(buildRoomOneToOneViewModel(i).chimeAffordanceVisible).toBe(false);
    }
  });
});

// ── OD-1-safe private copy (no "no observers" claim) ────────────

describe('private-room copy is OD-1-safe', () => {
  const FORBIDDEN_OD1_PHRASES = [
    'no observers',
    'no observer',
    'invited parties only',
    'only the person you invite',
    'only people you invite',
    'invitees only',
  ];

  it('the private subcopy says "Invited access." and nothing about observers', () => {
    expect(ROOM_ONE_TO_ONE_COPY.subcopy_private_invited_access).toBe('Invited access.');
    const lower = ROOM_ONE_TO_ONE_COPY.subcopy_private_invited_access.toLowerCase();
    for (const phrase of FORBIDDEN_OD1_PHRASES) {
      expect(lower).not.toContain(phrase);
    }
  });

  it('the private create-form helper uses "invited access" / "No public chime-ins" (OD-1-safe)', () => {
    const helper = ROOM_VISIBILITY_COPY.option_private_helper.toLowerCase();
    expect(helper).toContain('1:1');
    expect(helper).toContain('invited access');
    expect(helper).toContain('no public chime-ins');
    for (const phrase of FORBIDDEN_OD1_PHRASES) {
      expect(helper).not.toContain(phrase);
    }
  });

  it('the private build view-model never implies a private room has no observers', () => {
    const vm = buildRoomOneToOneViewModel(input({ visibility: 'private', opponentSeatIsOpen: null }));
    const lower = `${vm.label} ${vm.subcopy}`.toLowerCase();
    for (const phrase of FORBIDDEN_OD1_PHRASES) {
      expect(lower).not.toContain(phrase);
    }
  });
});

// ── Established 1:1 distinguishes principals from observers ──────

describe('established public 1:1 — principal voices vs observers', () => {
  it('the established label/subcopy names "2 principal voices"', () => {
    const vm = buildRoomOneToOneViewModel(input({ opponentSeatIsOpen: false }));
    expect(vm.label).toBe('Public 1:1');
    expect(vm.subcopy).toBe('2 principal voices.');
  });

  it('the seat-line view-model lists principals SEPARATELY from observers', () => {
    const line = buildOneToOneSeatLineViewModel();
    expect(line.principalVoicesLabel).toBe('2 principal voices');
    expect(line.observersLabel).toBe('Observers watching');
    // The two are distinct strings (not collapsed into one).
    expect(line.principalVoicesLabel).not.toBe(line.observersLabel);
  });

  it('reader/observer copy stays separate from active-seat copy', () => {
    const line = buildOneToOneSeatLineViewModel();
    // The reader note is the existing SEAT_CLAIM_COPY one (one source of truth)
    // and is NOT the active-seat / principal copy.
    expect(line.readersNote).toBe(SEAT_CLAIM_COPY.readersNote);
    expect(line.readersNote).toBe('Readers do not use active seats');
    expect(line.readersNote).not.toBe(line.principalVoicesLabel);
    // The observer-reading subcopy is distinct from the principal subcopy.
    const observerVm = buildRoomOneToOneViewModel(
      input({ opponentSeatIsOpen: false, viewerIsObserver: true, viewerIsActiveParticipant: false }),
    );
    expect(observerVm.state).toBe('observer_reading');
    expect(observerVm.subcopy).toBe(ROOM_ONE_TO_ONE_COPY.observer_reading_line);
    expect(observerVm.subcopy).not.toBe('2 principal voices.');
  });
});

// ── Dormant chime-in copy exists; no active control wired ───────

describe('point-scoped chime-in copy is DORMANT in this card', () => {
  it('the frozen copy constants exist and are non-empty', () => {
    expect(POINT_SCOPED_CHIME_IN_COPY.heading).toBe('Point-scoped chime-ins');
    expect(POINT_SCOPED_CHIME_IN_COPY.attach_action).toBe('Attach to this point');
    expect(POINT_SCOPED_CHIME_IN_COPY.does_not_open_seat).toBe('Does not open a principal seat');
    expect(POINT_SCOPED_CHIME_IN_COPY.seats_full_observing_open).toBe(
      'Chime-in seats full · observing open',
    );
    for (const v of Object.values(POINT_SCOPED_CHIME_IN_COPY)) {
      expect(typeof v).toBe('string');
      expect(v.length).toBeGreaterThan(0);
    }
  });

  it('the pure model wires NO active control from the dormant copy (no JSX / Pressable / submit)', () => {
    // The model is pure data — it must not import React or render a control,
    // and must not contain a submission / contribution path for chime-ins.
    expect(MODEL_SRC).not.toContain("from 'react'");
    expect(MODEL_SRC).not.toContain('<Pressable');
    expect(MODEL_SRC).not.toContain('functions.invoke');
    expect(MODEL_SRC).not.toContain('submit-argument');
    expect(MODEL_SRC).not.toContain('.insert(');
  });

  it('no live UI surface renders the dormant point-scoped chime-in copy', () => {
    // POINT_SCOPED_CHIME_IN_COPY is referenced by constants/tests only in this
    // card — no component imports it (it has no active control yet). Scan the
    // two live room surfaces the design names.
    const APP_SRC = fs.readFileSync(path.join(REPO, 'App.tsx'), 'utf8');
    expect(APP_SRC).not.toContain('POINT_SCOPED_CHIME_IN_COPY');
    const GAME_SURFACE = fs.readFileSync(
      path.join(REPO, 'src/features/arguments/ArgumentGameSurface.tsx'),
      'utf8',
    );
    expect(GAME_SURFACE).not.toContain('POINT_SCOPED_CHIME_IN_COPY');
  });
});

// ── visibility threading into the header seat strip ─────────────

describe('visibility is threaded into the header seat strip', () => {
  const INITIATOR = 'u-init';
  const OPPONENT = 'u-opp';
  const ROOT: RoomArgumentInput = {
    id: 'root',
    parentId: null,
    authorId: INITIATOR,
    argumentType: 'thesis',
    body: 'Opening claim long enough to count as a real opening move.',
    status: 'posted',
    createdAt: '2026-05-20T00:30:00.000Z',
  };
  function base(over: Partial<BuildRoomContractInput> = {}): BuildRoomContractInput {
    return {
      roomId: 'r1',
      initiatorUserId: INITIATOR,
      openedAt: '2026-05-20T00:00:00.000Z',
      participants: [],
      arguments: [ROOT],
      ...over,
    };
  }

  it("a private room threaded through the contract reads 'Private 1:1'", () => {
    // This is the pipeline useRoomContract drives (roomType → buildRoomContract
    // → buildRoomContractViewModel). With the visibility threaded, a private
    // room no longer falls back to the public label.
    const privateVm = buildRoomContractViewModel(
      buildRoomContract(base({ roomType: 'private', invitedOpponentUserId: OPPONENT })),
      INITIATOR,
      [ROOT],
    );
    expect(privateVm.roomTypeLabel).toBe('Private 1:1');
  });

  it("a public room reads 'Public 1:1' with the respondent seat open", () => {
    const publicVm = buildRoomContractViewModel(
      buildRoomContract(base({ roomType: 'public' })),
      INITIATOR,
      [ROOT],
    );
    expect(publicVm.roomTypeLabel).toBe('Public 1:1');
    expect(publicVm.opponentSeat.label).toBe('Respondent seat open');
  });

  it('App.tsx passes the persisted visibility into useRoomContract (wiring fixed)', () => {
    const APP_SRC = fs.readFileSync(path.join(REPO, 'App.tsx'), 'utf8');
    // The useRoomContract call now supplies the roomType option from the loaded
    // debate's visibility (previously omitted → defaulted to 'public').
    expect(APP_SRC).toContain('options: { roomType: currentDebate?.visibility }');
  });
});

// ── Ban-list scan over every new/changed copy string ────────────

describe('UX-ROOM-1V1-CHIMEIN-001A — copy ban-list', () => {
  const BANNED = _forbiddenOneToOneTokens();

  // Every copy string this card authored or changed.
  const NEW_OR_CHANGED_COPY: string[] = [
    ...Object.values(ROOM_ONE_TO_ONE_COPY),
    ...Object.values(POINT_SCOPED_CHIME_IN_COPY),
    ROOM_CONTRACT_COPY.privateRoom,
    ROOM_CONTRACT_COPY.publicRoom,
    ROOM_CONTRACT_COPY.seatOpen,
    ROOM_CONTRACT_COPY.turnOpenSeat,
    ROOM_ACCESS_COPY.public_open_line,
    ROOM_ACCESS_COPY.private_member_line,
    ROOM_VISIBILITY_COPY.option_public_helper,
    ROOM_VISIBILITY_COPY.option_private_helper,
  ];

  it('contains no verdict / amplification / person / social-feed token', () => {
    // Word-boundary matching (mirrors roomVisibilityModel.banlist.test.ts): a
    // legitimate word that merely CONTAINS a short token is not a violation
    // (e.g. "both" contains "bot"; "observe" contains no banned token). Each
    // banned token is matched as a whole word / phrase, case-insensitive.
    for (const value of NEW_OR_CHANGED_COPY) {
      for (const token of BANNED) {
        const pattern = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        expect(pattern.test(value)).toBe(false);
      }
    }
  });

  it('contains none of this card’s specific avoid-list phrases', () => {
    const AVOID = [
      'comment',
      'pile on',
      'audience',
      'forum',
      'join the debate',
      'open mic',
      'third side',
      'winner',
      'loser',
      'score',
      'verdict',
      'fallacy',
      'dishonest',
      'bad faith',
      'manipulative',
      'ai decides',
      'ai judge',
    ];
    for (const value of NEW_OR_CHANGED_COPY) {
      const lower = value.toLowerCase();
      for (const phrase of AVOID) {
        expect(lower).not.toContain(phrase);
      }
    }
  });

  it('leaks no snake_case internal code', () => {
    for (const value of NEW_OR_CHANGED_COPY) {
      // strip any {placeholder} first (none expected, defensive).
      const stripped = value.replace(/\{[a-z]+\}/g, '');
      expect(stripped).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });

  it('every new/changed copy string is non-empty', () => {
    for (const value of NEW_OR_CHANGED_COPY) {
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
