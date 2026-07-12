/**
 * ARG-ROOM-005 (#616) — seatClaimModel pure-TS tests.
 *
 * The seven seat-accounting invariants (pure-model legs) + the full classifier,
 * view-model, side-effect, and the no-differential-preview privacy lock. Each
 * invariant is labelled by provability; the integration-mocked + live legs live
 * in `seatClaimWiring.test.ts` / the 002 deploy smoke.
 *
 * Cap is NEVER re-authored here — it derives from `roomActiveSeatCap` (the twin
 * of the SQL `room_active_seat_cap`), which derives from `PUBLIC_ROOM_SEAT_CAP`
 * / `PRIMARY_SEAT_COUNT`. A parity assertion pins it to 5.
 */
import {
  isActiveParticipantSide,
  deriveSeatAvailability,
  classifyJoinOutcome,
  buildSeatAvailabilityViewModel,
  resolveJoinSideEffect,
  resolveJoinPanelFeedback,
  type SeatAvailability,
} from '../src/features/debates/seatClaimModel';
import {
  roomActiveSeatCap,
  canJoinActive,
  openActiveSlots,
  openSlotsAfterCreate,
} from '../src/features/debates/roomCapacityModel';
import { PUBLIC_ROOM_SEAT_CAP } from '../src/features/debates/publicSeatModel';
import { SEAT_CLAIM_COPY } from '../src/features/arguments/gameCopy';
import type { ParticipantSide } from '../src/features/debates/types';

// ── The seven required proofs (pure-model legs) ─────────────────

describe('ARG-ROOM-005 invariant 1 — public + no invite ⇒ creator + 4 open [pure-model]', () => {
  it('a fresh public room (creator = 1 active, 0 reserved) has 4 open seats', () => {
    const a = deriveSeatAvailability({
      visibility: 'public',
      activeParticipantCount: 1, // creator auto-joined as moderator
      knownReservedInviteCount: 0,
      viewerSide: null,
    });
    expect(a.openSlots).toBe(4);
    expect(a.isFull).toBe(false);
    expect(a.cap).toBe(5);
    // Cross-pin the create-time twin so the live-room view never drifts.
    expect(openSlotsAfterCreate('public', 0)).toBe(4);
  });
});

describe('ARG-ROOM-005 invariant 2 — public + 1 invite ⇒ creator + 1 reserved + 3 open [pure-model]', () => {
  it('the authoritative (creator) view: 1 active + 1 reserved leaves 3 open', () => {
    const a = deriveSeatAvailability({
      visibility: 'public',
      activeParticipantCount: 1,
      knownReservedInviteCount: 1,
      viewerSide: 'moderator',
      reservedCountIsAuthoritative: true,
    });
    expect(a.openSlots).toBe(3);
    expect(a.reservedInviteCount).toBe(1);
    expect(a.isFull).toBe(false);
    // Cross-pin the create-time twin.
    expect(openSlotsAfterCreate('public', 1)).toBe(3);
  });
});

describe('ARG-ROOM-005 invariant 3 — invitee can accept even when full-to-reserved [pure-model + twin]', () => {
  it('the room reads full when the reserved invite is counted, yet the invitee twin still passes', () => {
    // Creator + 3 public claims = 4 active; + 1 reserved invite = 5 (full).
    const authoritative = deriveSeatAvailability({
      visibility: 'public',
      activeParticipantCount: 4,
      knownReservedInviteCount: 1,
      viewerSide: 'moderator',
      reservedCountIsAuthoritative: true,
    });
    expect(authoritative.isFull).toBe(true);
    expect(authoritative.openSlots).toBe(0);

    // The invitee's accept twin: their OWN invite is excluded from the reserved
    // count (migration count_reserved_invites :183) ⇒ reserved 0 ⇒ a seat is
    // available. 4 + 0 + 1 = 5 <= 5.
    expect(canJoinActive(4, 0, 5)).toBe(true);
  });
});

describe('ARG-ROOM-005 invariant 4 — the 6th active is refused (room_capacity_reached) [pure-model]', () => {
  it('5 active ⇒ full; the refusal token classifies to room_full', () => {
    expect(canJoinActive(5, 0, 5)).toBe(false); // 5 + 0 + 1 = 6 > 5
    const a = deriveSeatAvailability({
      visibility: 'public',
      activeParticipantCount: 5,
      knownReservedInviteCount: 0,
      viewerSide: null,
    });
    expect(a.isFull).toBe(true);
    expect(a.openSlots).toBe(0);
    // The 002 trigger raises 'room_capacity_reached' with ERRCODE check_violation.
    expect(
      classifyJoinOutcome({ code: '23514', message: 'room_capacity_reached' }),
    ).toBe('room_full');
  });
});

describe('ARG-ROOM-005 invariant 5 — observer may join a FULL public room [pure-model]', () => {
  it('a full room offers observe as the only option for a non-participant', () => {
    const a = deriveSeatAvailability({
      visibility: 'public',
      activeParticipantCount: 5,
      knownReservedInviteCount: 0,
      viewerSide: null,
    });
    expect(a.isFull).toBe(true);
    expect(a.observeIsOnlyOption).toBe(true);
    expect(a.canClaimActiveSeat).toBe(false);
    // An observer is never an active claim, so observe is never capacity-gated.
    const vm = buildSeatAvailabilityViewModel(a, null);
    expect(vm.fullRoomObserveNudge).toBe(SEAT_CLAIM_COPY.fullRoomObserve);
  });
});

describe('ARG-ROOM-005 invariant 6 — observer is never an active participant [pure-model]', () => {
  it('mirrors the SQL side <> observer definition', () => {
    expect(isActiveParticipantSide('affirmative')).toBe(true);
    expect(isActiveParticipantSide('negative')).toBe(true);
    expect(isActiveParticipantSide('moderator')).toBe(true);
    expect(isActiveParticipantSide('observer')).toBe(false);
    expect(isActiveParticipantSide(null)).toBe(false);
    expect(isActiveParticipantSide(undefined)).toBe(false);
  });

  it('an observer viewer never counts toward the cap or claims a seat', () => {
    // active count reflects ONLY side !== observer; an observer viewing a
    // partly-full room is not active and may still observe.
    const a = deriveSeatAvailability({
      visibility: 'public',
      activeParticipantCount: 3,
      knownReservedInviteCount: 0,
      viewerSide: 'observer',
    });
    expect(a.viewerIsActiveParticipant).toBe(false);
    expect(a.canClaimActiveSeat).toBe(true); // not full → can still claim
  });
});

// ── No-differential-preview privacy lock (review [should] #2) ────

describe('ARG-ROOM-005 — no differential signal at the preview layer [pure-model]', () => {
  it('a hidden-reserved room and a genuinely-open room render IDENTICAL output to a public viewer', () => {
    // Room A actually has: creator + 1 hidden reserved invite + 3 truly-open.
    // Room B actually has: creator + 0 reserved + 4 truly-open.
    // A PUBLIC viewer cannot read invite rows (RLS), so for BOTH they observe
    // only active = 1 and pass knownReservedInviteCount = 0. The outputs must be
    // byte-identical — the reserved seat is invisible at the preview layer.
    const publicViewOfRoomWithHiddenReserved = deriveSeatAvailability({
      visibility: 'public',
      activeParticipantCount: 1,
      knownReservedInviteCount: 0, // reserved invite is RLS-hidden
      viewerSide: null,
    });
    const publicViewOfGenuinelyOpenRoom = deriveSeatAvailability({
      visibility: 'public',
      activeParticipantCount: 1,
      knownReservedInviteCount: 0,
      viewerSide: null,
    });
    expect(publicViewOfRoomWithHiddenReserved).toEqual(publicViewOfGenuinelyOpenRoom);
    expect(buildSeatAvailabilityViewModel(publicViewOfRoomWithHiddenReserved, null)).toEqual(
      buildSeatAvailabilityViewModel(publicViewOfGenuinelyOpenRoom, null),
    );
    // The acknowledged, correct privacy cost: the preview reads 4 open even
    // though only 3 are truly free. The 002 trigger remains authoritative.
    expect(publicViewOfRoomWithHiddenReserved.openSlots).toBe(4);
    expect(publicViewOfRoomWithHiddenReserved.reservedCountIsAuthoritative).toBe(false);
  });

  it('the full-room refusal copy is identical whether full by active seats or a hidden reserved invite', () => {
    // No DETAIL is ever read, so the same token classifies identically.
    expect(classifyJoinOutcome({ code: '23514', message: 'room_capacity_reached' })).toBe(
      'room_full',
    );
    // With or without a cap=/active=/reserved= DETAIL appended, the result is the
    // same — the classifier discards everything but the token.
    expect(
      classifyJoinOutcome({
        code: '23514',
        message: 'room_capacity_reached',
      }),
    ).toBe(
      classifyJoinOutcome({
        code: '23514',
        message: 'room_capacity_reached cap=5 active=4 reserved=1',
      }),
    );
  });
});

// ── openActiveSlots (additive twin) ─────────────────────────────

describe('openActiveSlots', () => {
  it('returns max(0, cap - active - reserved)', () => {
    expect(openActiveSlots(1, 0, 5)).toBe(4);
    expect(openActiveSlots(1, 1, 5)).toBe(3);
    expect(openActiveSlots(5, 0, 5)).toBe(0);
    expect(openActiveSlots(4, 1, 5)).toBe(0);
  });

  it('clamps negative / non-finite inputs to 0', () => {
    expect(openActiveSlots(-3, -2, 5)).toBe(5);
    expect(openActiveSlots(Number.NaN, 0, 5)).toBe(5);
    expect(openActiveSlots(1, 0, Number.POSITIVE_INFINITY)).toBe(0);
    expect(openActiveSlots(99, 0, 5)).toBe(0);
  });

  it('is consistent with canJoinActive: openActiveSlots >= 1 ⟺ canJoinActive === true', () => {
    for (let active = 0; active <= 6; active += 1) {
      for (let reserved = 0; reserved <= 3; reserved += 1) {
        const open = openActiveSlots(active, reserved, 5);
        expect(open >= 1).toBe(canJoinActive(active, reserved, 5));
      }
    }
  });
});

// ── classifyJoinOutcome ─────────────────────────────────────────

describe('classifyJoinOutcome', () => {
  it('detects capacity refusal by the message token (authoritative)', () => {
    expect(classifyJoinOutcome({ code: '23514', message: 'room_capacity_reached' })).toBe(
      'room_full',
    );
    expect(
      classifyJoinOutcome({ code: 'check_violation', message: 'room_capacity_reached' }),
    ).toBe('room_full');
  });

  it('does NOT classify a bare 23514 without the token as room_full (review [should] #1)', () => {
    expect(classifyJoinOutcome({ code: '23514', message: 'some other check' })).toBe(
      'unavailable',
    );
    expect(classifyJoinOutcome({ code: '23514', message: '' })).toBe('unavailable');
  });

  it('maps 23505 to already_active / already_observer by the existing side', () => {
    expect(classifyJoinOutcome({ code: '23505' }, 'affirmative')).toBe('already_active');
    expect(classifyJoinOutcome({ code: '23505' }, 'moderator')).toBe('already_active');
    expect(classifyJoinOutcome({ code: '23505' }, 'observer')).toBe('already_observer');
    expect(classifyJoinOutcome({ code: '23505' }, null)).toBe('already_observer');
  });

  it('maps a null / undefined error to error (never silently claimed)', () => {
    expect(classifyJoinOutcome(null)).toBe('error');
    expect(classifyJoinOutcome(undefined)).toBe('error');
  });

  it('maps an unknown coded error to unavailable and a code-less error to error', () => {
    expect(classifyJoinOutcome({ code: '42501', message: 'permission denied' })).toBe(
      'unavailable',
    );
    expect(classifyJoinOutcome({ message: 'network blip' })).toBe('error');
    expect(classifyJoinOutcome({})).toBe('error');
  });
});

// ── buildSeatAvailabilityViewModel ──────────────────────────────

describe('buildSeatAvailabilityViewModel', () => {
  function avail(over: Partial<Parameters<typeof deriveSeatAvailability>[0]> = {}) {
    return deriveSeatAvailability({
      visibility: 'public',
      activeParticipantCount: 1,
      knownReservedInviteCount: 0,
      viewerSide: null,
      ...over,
    });
  }

  it('uses plural / singular / zero open-seat labels', () => {
    expect(buildSeatAvailabilityViewModel(avail({ activeParticipantCount: 1 }), null).openSeatsLabel).toBe(
      '4 open seats',
    );
    expect(buildSeatAvailabilityViewModel(avail({ activeParticipantCount: 4 }), null).openSeatsLabel).toBe(
      '1 open seat',
    );
    expect(buildSeatAvailabilityViewModel(avail({ activeParticipantCount: 5 }), null).openSeatsLabel).toBe(
      'No open seats',
    );
  });

  it('surfaces the observe nudge only when full + viewer not active', () => {
    expect(buildSeatAvailabilityViewModel(avail({ activeParticipantCount: 5 }), null).fullRoomObserveNudge).toBe(
      SEAT_CLAIM_COPY.fullRoomObserve,
    );
    // Not full → no nudge.
    expect(buildSeatAvailabilityViewModel(avail({ activeParticipantCount: 2 }), null).fullRoomObserveNudge).toBeNull();
    // Full but the viewer is active (e.g. creator) → no nudge.
    expect(
      buildSeatAvailabilityViewModel(
        avail({ activeParticipantCount: 5, viewerSide: 'moderator' }),
        'moderator',
      ).fullRoomObserveNudge,
    ).toBeNull();
  });

  it('renders the viewer-state line by participation', () => {
    expect(buildSeatAvailabilityViewModel(avail({ viewerSide: 'affirmative' }), 'affirmative').viewerStateLabel).toBe(
      SEAT_CLAIM_COPY.youAreActive,
    );
    expect(buildSeatAvailabilityViewModel(avail({ viewerSide: 'observer' }), 'observer').viewerStateLabel).toBe(
      SEAT_CLAIM_COPY.youAreWatching,
    );
    expect(buildSeatAvailabilityViewModel(avail({ viewerSide: null }), null).viewerStateLabel).toBe(
      SEAT_CLAIM_COPY.youAreWatching,
    );
  });

  it('builds a non-empty single-shot accessibility label', () => {
    const vm = buildSeatAvailabilityViewModel(avail({ activeParticipantCount: 5 }), null);
    expect(vm.accessibilityLabel).toContain(SEAT_CLAIM_COPY.fullRoomObserve);
    expect(vm.accessibilityLabel).toContain(SEAT_CLAIM_COPY.youAreWatching);
    expect(vm.accessibilityLabel.length).toBeGreaterThan(0);
  });
});

// ── deriveSeatAvailability — edge cases ─────────────────────────

describe('deriveSeatAvailability — edge cases', () => {
  it('private room: cap 2, the one seat is the reserved invite ⇒ 0 open', () => {
    const a = deriveSeatAvailability({
      visibility: 'private',
      activeParticipantCount: 1,
      knownReservedInviteCount: 1,
      viewerSide: 'moderator',
      reservedCountIsAuthoritative: true,
    });
    expect(a.cap).toBe(2);
    expect(a.openSlots).toBe(0);
    expect(a.isFull).toBe(true);
  });

  it('an already-active viewer cannot claim and is not nudged to observe', () => {
    const a = deriveSeatAvailability({
      visibility: 'public',
      activeParticipantCount: 3,
      knownReservedInviteCount: 0,
      viewerSide: 'affirmative',
    });
    expect(a.viewerIsActiveParticipant).toBe(true);
    expect(a.canClaimActiveSeat).toBe(false);
    expect(a.observeIsOnlyOption).toBe(false);
  });

  it('clamps negative / non-finite counts to 0', () => {
    const a = deriveSeatAvailability({
      visibility: 'public',
      activeParticipantCount: -5,
      knownReservedInviteCount: Number.NaN,
      viewerSide: null,
    });
    expect(a.activeParticipantCount).toBe(0);
    expect(a.reservedInviteCount).toBe(0);
    expect(a.openSlots).toBe(5);
  });

  it('returns a frozen, deterministic result', () => {
    const input = {
      visibility: 'public' as const,
      activeParticipantCount: 2,
      knownReservedInviteCount: 1,
      viewerSide: null,
    };
    const a = deriveSeatAvailability(input);
    const b = deriveSeatAvailability(input);
    expect(Object.isFrozen(a)).toBe(true);
    expect(a).toEqual(b);
    // A frozen field is immutable regardless of strict-mode (silent no-op vs
    // throw): the value never changes after an attempted write.
    const before = a.openSlots;
    try {
      (a as unknown as { openSlots: number }).openSlots = 99;
    } catch {
      // strict-mode environments throw; non-strict silently ignores.
    }
    expect(a.openSlots).toBe(before);
  });
});

// ── resolveJoinSideEffect (App handler decision) ────────────────

describe('resolveJoinSideEffect', () => {
  const sides: Array<{ outcome: 'claimed' | 'already_active' | 'already_observer'; side: ParticipantSide }> = [
    { outcome: 'claimed', side: 'affirmative' },
    { outcome: 'already_active', side: 'negative' },
    { outcome: 'already_observer', side: 'observer' },
  ];

  it('routes room_full to the graceful observe affordance', () => {
    expect(resolveJoinSideEffect({ side: null, outcome: 'room_full' })).toEqual({
      kind: 'full_room_observe',
    });
  });

  it('selects the side for any successful outcome that carries a side', () => {
    for (const s of sides) {
      expect(resolveJoinSideEffect({ side: s.side, outcome: s.outcome })).toEqual({
        kind: 'select_side',
        side: s.side,
      });
    }
  });

  it('UX-PR-B (#918) — surfaces an HONEST error note for unavailable / error with no side', () => {
    // Previously these were a silent { kind: 'none' } no-op; now they carry the
    // plain-language join-failed message so the room shell can announce it.
    expect(resolveJoinSideEffect({ side: null, outcome: 'unavailable' })).toEqual({
      kind: 'error',
      message: SEAT_CLAIM_COPY.joinFailed,
    });
    expect(resolveJoinSideEffect({ side: null, outcome: 'error' })).toEqual({
      kind: 'error',
      message: SEAT_CLAIM_COPY.joinFailed,
    });
  });
});

// ── resolveJoinPanelFeedback (JoinDebatePanel inline feedback) ───

describe('resolveJoinPanelFeedback (UX-PR-B #918)', () => {
  it('reports joined (no note) when a seat was taken', () => {
    expect(resolveJoinPanelFeedback({ side: 'affirmative', outcome: 'claimed' })).toEqual({
      joined: true,
      message: null,
    });
    expect(resolveJoinPanelFeedback({ side: 'observer', outcome: 'already_observer' })).toEqual({
      joined: true,
      message: null,
    });
  });

  it('reports the full-room observe copy when the room is full', () => {
    expect(resolveJoinPanelFeedback({ side: null, outcome: 'room_full' })).toEqual({
      joined: false,
      message: SEAT_CLAIM_COPY.fullRoomObserve,
    });
  });

  it('reports the join-failed copy for unavailable / error with no side', () => {
    expect(resolveJoinPanelFeedback({ side: null, outcome: 'unavailable' })).toEqual({
      joined: false,
      message: SEAT_CLAIM_COPY.joinFailed,
    });
    expect(resolveJoinPanelFeedback({ side: null, outcome: 'error' })).toEqual({
      joined: false,
      message: SEAT_CLAIM_COPY.joinFailed,
    });
  });
});

// ── Single source of truth for the cap ──────────────────────────

describe('ARG-ROOM-005 — seat math reads the single cap source (no second literal)', () => {
  it('the derived cap is PUBLIC_ROOM_SEAT_CAP === 5', () => {
    const a: SeatAvailability = deriveSeatAvailability({
      visibility: 'public',
      activeParticipantCount: 0,
      knownReservedInviteCount: 0,
      viewerSide: null,
    });
    expect(a.cap).toBe(PUBLIC_ROOM_SEAT_CAP);
    expect(PUBLIC_ROOM_SEAT_CAP).toBe(5);
    expect(roomActiveSeatCap('public')).toBe(PUBLIC_ROOM_SEAT_CAP);
  });
});
