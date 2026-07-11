/**
 * P8-CHIMEIN-ARC Round 1 (#680) — 1:1-first room LIFECYCLE transition machine.
 *
 * The shipped `oneToOneRoomModel.test.ts` pins the SNAPSHOT layer. This suite
 * pins the additive TRANSITION layer (`oneToOneRoomLifecycle.ts`):
 *  - every R1-R7 transition edge from the design edge list;
 *  - the two guards (private-no-chime, seats-full-observe-only) as transition
 *    guards;
 *  - Invariant A: the first open PUBLIC seat resolves to a respondent-principal,
 *    NEVER a chime-in;
 *  - Invariant B: a chime event NEVER increments the principal-voice count;
 *  - Invariant C: a chime event NEVER sets an argument-structural state (the
 *    state carries no such field; a source scan is a firing negative control);
 *  - projection parity with the shipped `RoomOneToOneDisplayState` union;
 *  - purity / frozen / determinism (source scan + behaviour);
 *  - a ban-list scan over the phase + event vocabulary and the reused copy.
 *
 * Design: docs/designs/P8-CHIMEIN-ARC.md sections 2, 5.1, 6.1. Round 1 builds no
 * part of Round 2 (#761) — no migration, no Edge, no flag, no UI activation.
 */
import fs from 'fs';
import path from 'path';
import {
  initialRoomLifecycleState,
  applyRoomLifecycleEvent,
  projectToDisplayState,
  CHIME_IN_CAP_PUBLIC,
  ALL_ROOM_LIFECYCLE_PHASES,
  ALL_ROOM_LIFECYCLE_EVENT_KINDS,
  _forbiddenRoomLifecycleTokens,
  type RoomLifecycleState,
  type RoomLifecyclePhase,
} from '../src/features/debates/oneToOneRoomLifecycle';
import {
  ALL_ROOM_ONE_TO_ONE_DISPLAY_STATES,
  chimeInAllowed,
  _forbiddenOneToOneTokens,
  ROOM_ONE_TO_ONE_COPY,
  POINT_SCOPED_CHIME_IN_COPY,
} from '../src/features/debates/oneToOneRoomModel';
import {
  PUBLIC_ROOM_SEAT_CAP,
  PRIMARY_SEAT_COUNT,
} from '../src/features/debates/publicSeatModel';

const REPO = process.cwd();
const MODEL_SRC = fs.readFileSync(
  path.join(REPO, 'src/features/debates/oneToOneRoomLifecycle.ts'),
  'utf8',
);

// ── State builders (always via the machine, never hand-rolled) ──

function created(visibility: 'public' | 'private'): RoomLifecycleState {
  return applyRoomLifecycleEvent(initialRoomLifecycleState(), { kind: 'create', visibility });
}
/** create{public} -> r2 -> respondent_seat_taken -> r3 (two principals). */
function establishedPublic(): RoomLifecycleState {
  return applyRoomLifecycleEvent(created('public'), { kind: 'respondent_seat_taken' });
}
function attach(state: RoomLifecycleState, times = 1): RoomLifecycleState {
  let s = state;
  for (let i = 0; i < times; i += 1) {
    s = applyRoomLifecycleEvent(s, { kind: 'chime_in_attached' });
  }
  return s;
}
function retract(state: RoomLifecycleState, times = 1): RoomLifecycleState {
  let s = state;
  for (let i = 0; i < times; i += 1) {
    s = applyRoomLifecycleEvent(s, { kind: 'chime_in_retracted' });
  }
  return s;
}

/** The reachable canonical states, for parity + property iteration. */
function reachableStates(): RoomLifecycleState[] {
  const r3 = establishedPublic();
  return [
    initialRoomLifecycleState(), // unknown
    created('public'), // r2
    created('private'), // r6
    r3, // r3
    attach(r3, 1), // r4 filled 1
    attach(r3, 2), // r4 filled 2
    attach(r3, 3), // r4 filled 3 (at cap, still r4)
    attach(r3, 4), // r5 (overflow -> observe-only)
    attach(r3, 5), // r5 (idempotent full)
    retract(attach(r3, 4), 1), // r5 -> r4 filled 2
    retract(attach(r3, 1), 1), // r4 -> r3 filled 0
  ];
}

function changedKeys(a: RoomLifecycleState, b: RoomLifecycleState): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const ra = a as unknown as Record<string, unknown>;
  const rb = b as unknown as Record<string, unknown>;
  const out: string[] = [];
  for (const k of keys) {
    if (ra[k] !== rb[k]) out.push(k);
  }
  return out;
}

// ── CHIME_IN_CAP_PUBLIC — GAME-005 one source of truth ──────────

describe('CHIME_IN_CAP_PUBLIC — room-level cap imported from GAME-005', () => {
  it('equals PUBLIC_ROOM_SEAT_CAP - PRIMARY_SEAT_COUNT (derived, not literal)', () => {
    expect(CHIME_IN_CAP_PUBLIC).toBe(PUBLIC_ROOM_SEAT_CAP - PRIMARY_SEAT_COUNT);
  });
  it('is 3 (the v4 chime capacity)', () => {
    expect(CHIME_IN_CAP_PUBLIC).toBe(3);
  });
});

// ── initialRoomLifecycleState ───────────────────────────────────

describe('initialRoomLifecycleState', () => {
  it('starts at phase unknown with zeroed counts and no visibility', () => {
    const s = initialRoomLifecycleState();
    expect(s.phase).toBe('unknown');
    expect(s.visibility).toBeNull();
    expect(s.principalVoiceCount).toBe(0);
    expect(s.chimeInSeatsFilled).toBe(0);
    expect(s.chimeInCap).toBe(0);
    expect(s.observeOnly).toBe(false);
    expect(s.chimeComposerAvailable).toBe(false);
  });
  it('projects to the unknown display state', () => {
    expect(initialRoomLifecycleState().displayState).toBe('unknown');
    expect(projectToDisplayState(initialRoomLifecycleState())).toBe('unknown');
  });
  it('returns a frozen object', () => {
    expect(Object.isFrozen(initialRoomLifecycleState())).toBe(true);
  });
});

// ── Exported vocabulary constants ───────────────────────────────

describe('exported vocabulary constants', () => {
  it('ALL_ROOM_LIFECYCLE_PHASES is the frozen 7-phase R1-R7 vocabulary', () => {
    expect(Object.isFrozen(ALL_ROOM_LIFECYCLE_PHASES)).toBe(true);
    expect(ALL_ROOM_LIFECYCLE_PHASES).toEqual([
      'r1_created',
      'r2_respondent_seat_open',
      'r3_two_principals',
      'r4_chime_in_attached',
      'r5_chime_seats_full',
      'r6_private_invited',
      'unknown',
    ]);
  });
  it('ALL_ROOM_LIFECYCLE_EVENT_KINDS is the frozen 4-event vocabulary', () => {
    expect(Object.isFrozen(ALL_ROOM_LIFECYCLE_EVENT_KINDS)).toBe(true);
    expect(ALL_ROOM_LIFECYCLE_EVENT_KINDS).toEqual([
      'create',
      'respondent_seat_taken',
      'chime_in_attached',
      'chime_in_retracted',
    ]);
  });
  it('every settled phase from an event is a member of the phase vocabulary', () => {
    for (const s of reachableStates()) {
      expect(ALL_ROOM_LIFECYCLE_PHASES).toContain(s.phase);
    }
  });
});

// ── Per-transition edges ────────────────────────────────────────

describe('transition: create{public} -> r2_respondent_seat_open', () => {
  it('opens the respondent (second principal) seat with cap 3', () => {
    const s = created('public');
    expect(s.phase).toBe('r2_respondent_seat_open');
    expect(s.visibility).toBe('public');
    expect(s.principalVoiceCount).toBe(1);
    expect(s.chimeInCap).toBe(CHIME_IN_CAP_PUBLIC);
    expect(s.chimeInSeatsFilled).toBe(0);
    expect(s.observeOnly).toBe(false);
    // Needs two principals before the chime composer may appear.
    expect(s.chimeComposerAvailable).toBe(false);
    expect(s.displayState).toBe('public_respondent_seat_open');
  });
});

describe('transition: create{private} -> r6_private_invited', () => {
  it('is invited-access, cap 0, observe-only, no chime composer (guard 1)', () => {
    const s = created('private');
    expect(s.phase).toBe('r6_private_invited');
    expect(s.visibility).toBe('private');
    expect(s.chimeInCap).toBe(0);
    expect(s.observeOnly).toBe(true);
    expect(s.chimeComposerAvailable).toBe(false);
    expect(s.displayState).toBe('private_invited_access');
  });
});

describe('transition: create on an already-created room is a no-op', () => {
  it('a second create does not re-open or reset the room', () => {
    const r2 = created('public');
    const again = applyRoomLifecycleEvent(r2, { kind: 'create', visibility: 'private' });
    expect(again).toEqual(r2);
  });
  it('an unrecognized visibility stays unknown', () => {
    const s = applyRoomLifecycleEvent(initialRoomLifecycleState(), {
      kind: 'create',
      visibility: 'open' as never,
    });
    expect(s.phase).toBe('unknown');
    expect(s.displayState).toBe('unknown');
  });
});

describe('transition: respondent_seat_taken on r2 -> r3_two_principals', () => {
  it('seats the second principal and opens the chime composer', () => {
    const s = establishedPublic();
    expect(s.phase).toBe('r3_two_principals');
    expect(s.principalVoiceCount).toBe(2);
    expect(s.chimeInSeatsFilled).toBe(0);
    expect(s.chimeComposerAvailable).toBe(true);
    expect(s.displayState).toBe('public_chime_in_available_dormant');
  });
  it('respondent_seat_taken on any other phase is a no-op (idempotent)', () => {
    const r3 = establishedPublic();
    expect(applyRoomLifecycleEvent(r3, { kind: 'respondent_seat_taken' })).toEqual(r3);
    const r6 = created('private');
    expect(applyRoomLifecycleEvent(r6, { kind: 'respondent_seat_taken' })).toEqual(r6);
  });
});

describe('transition: r3 chime_in_attached -> r4_chime_in_attached', () => {
  it('attaches one chime-in and stays available', () => {
    const s = attach(establishedPublic(), 1);
    expect(s.phase).toBe('r4_chime_in_attached');
    expect(s.chimeInSeatsFilled).toBe(1);
    expect(s.principalVoiceCount).toBe(2);
    expect(s.chimeComposerAvailable).toBe(true);
    expect(s.displayState).toBe('public_chime_in_available_dormant');
  });
});

describe('transition: r4 repeated attach up to the cap stays r4', () => {
  it('filling seats 1..cap keeps the phase r4 and increments the counter', () => {
    const r3 = establishedPublic();
    for (let n = 1; n <= CHIME_IN_CAP_PUBLIC; n += 1) {
      const s = attach(r3, n);
      expect(s.phase).toBe('r4_chime_in_attached');
      expect(s.chimeInSeatsFilled).toBe(n);
    }
  });
  it('at exactly the cap the room has zero open chime seats (full_dormant)', () => {
    const s = attach(establishedPublic(), CHIME_IN_CAP_PUBLIC);
    expect(s.chimeInSeatsFilled).toBe(CHIME_IN_CAP_PUBLIC);
    expect(s.displayState).toBe('public_chime_in_full_dormant');
    expect(s.chimeComposerAvailable).toBe(false);
  });
});

describe('transition: cap+1 attach -> r5_chime_seats_full (observe-only, guard 2)', () => {
  it('the overflow attach moves to observe-only WITHOUT adding a seat', () => {
    const s = attach(establishedPublic(), CHIME_IN_CAP_PUBLIC + 1);
    expect(s.phase).toBe('r5_chime_seats_full');
    expect(s.observeOnly).toBe(true);
    // Counter unchanged at the cap; principals untouched.
    expect(s.chimeInSeatsFilled).toBe(CHIME_IN_CAP_PUBLIC);
    expect(s.principalVoiceCount).toBe(2);
    expect(s.chimeComposerAvailable).toBe(false);
    expect(s.displayState).toBe('public_chime_in_full_dormant');
  });
  it('further attaches at r5 stay r5 (idempotent full)', () => {
    const r5 = attach(establishedPublic(), CHIME_IN_CAP_PUBLIC + 1);
    const again = attach(r5, 3);
    expect(again.phase).toBe('r5_chime_seats_full');
    expect(again.chimeInSeatsFilled).toBe(CHIME_IN_CAP_PUBLIC);
  });
});

describe('transition: chime_in_retracted frees a seat', () => {
  it('r5 retract -> r4 when a seat frees', () => {
    const r5 = attach(establishedPublic(), CHIME_IN_CAP_PUBLIC + 1);
    const s = retract(r5, 1);
    expect(s.phase).toBe('r4_chime_in_attached');
    expect(s.chimeInSeatsFilled).toBe(CHIME_IN_CAP_PUBLIC - 1);
    expect(s.observeOnly).toBe(false);
    expect(s.chimeComposerAvailable).toBe(true);
  });
  it('retracting the last chime-in -> r3 (two principals, no chime-ins)', () => {
    const s = retract(attach(establishedPublic(), 1), 1);
    expect(s.phase).toBe('r3_two_principals');
    expect(s.chimeInSeatsFilled).toBe(0);
  });
  it('retract on r3 (nothing to free) is a no-op', () => {
    const r3 = establishedPublic();
    expect(applyRoomLifecycleEvent(r3, { kind: 'chime_in_retracted' })).toEqual(r3);
  });
});

describe('transition: idempotent / no-op edges', () => {
  it('chime_in_attached on r2 (one principal) is a no-op', () => {
    const r2 = created('public');
    expect(applyRoomLifecycleEvent(r2, { kind: 'chime_in_attached' })).toEqual(r2);
  });
  it('chime_in_retracted on r2 is a no-op', () => {
    const r2 = created('public');
    expect(applyRoomLifecycleEvent(r2, { kind: 'chime_in_retracted' })).toEqual(r2);
  });
});

// ── Guard 1 — private-no-chime ──────────────────────────────────

describe('Guard 1 — private-no-chime', () => {
  it('reuses the shipped chimeInAllowed public-only predicate', () => {
    expect(chimeInAllowed('private')).toBe(false);
    expect(chimeInAllowed('public')).toBe(true);
  });
  it('a private room has capacity 0 and no chime composer', () => {
    const r6 = created('private');
    expect(r6.chimeInCap).toBe(0);
    expect(r6.chimeComposerAvailable).toBe(false);
  });
  it('every chime event on a private lifecycle is a no-op', () => {
    const r6 = created('private');
    expect(applyRoomLifecycleEvent(r6, { kind: 'chime_in_attached' })).toEqual(r6);
    expect(applyRoomLifecycleEvent(r6, { kind: 'chime_in_retracted' })).toEqual(r6);
    // Even a long run of chime events cannot fill a private room.
    expect(attach(r6, 10).chimeInSeatsFilled).toBe(0);
    expect(attach(r6, 10).phase).toBe('r6_private_invited');
  });
});

// ── Guard 2 — seats-full-observe-only ───────────────────────────

describe('Guard 2 — seats-full-observe-only', () => {
  it('an attach at the cap flips observe-only without incrementing the counter', () => {
    const atCap = attach(establishedPublic(), CHIME_IN_CAP_PUBLIC);
    expect(atCap.observeOnly).toBe(false);
    const overflow = applyRoomLifecycleEvent(atCap, { kind: 'chime_in_attached' });
    expect(overflow.observeOnly).toBe(true);
    expect(overflow.chimeInSeatsFilled).toBe(atCap.chimeInSeatsFilled);
  });
  it('the ledger phase stays readable at r5 (not a terminal wipe)', () => {
    const r5 = attach(establishedPublic(), CHIME_IN_CAP_PUBLIC + 1);
    expect(r5.phase).toBe('r5_chime_seats_full');
    expect(r5.chimeInCap).toBe(CHIME_IN_CAP_PUBLIC);
    expect(r5.principalVoiceCount).toBe(2);
  });
});

// ── Invariant A — first-open-public-seat = respondent-principal ─

describe('Invariant A — the first open public seat is a respondent-principal, never a chime', () => {
  it('create{public} projects to the respondent seat, not a chime state', () => {
    const state = projectToDisplayState(created('public'));
    expect(state).toBe('public_respondent_seat_open');
    expect(state).not.toContain('chime');
  });
  it('the open second seat is a principal seat (one principal, seat still open)', () => {
    const r2 = created('public');
    expect(r2.principalVoiceCount).toBe(1);
    // A chime cannot fill the respondent seat: attach at r2 is a no-op.
    expect(applyRoomLifecycleEvent(r2, { kind: 'chime_in_attached' })).toEqual(r2);
  });
  it('only respondent_seat_taken (never a chime) establishes the second principal', () => {
    const r3 = establishedPublic();
    expect(r3.principalVoiceCount).toBe(2);
    expect(r3.displayState).not.toBe('public_respondent_seat_open');
  });
});

// ── Invariant B — chime-never-increments-principal-count ────────

describe('Invariant B — a chime event never increments the principal-voice count', () => {
  it('principalVoiceCount is invariant across any attach/retract sequence', () => {
    const r3 = establishedPublic();
    const seq: RoomLifecycleState[] = [
      r3,
      attach(r3, 1),
      attach(r3, 2),
      attach(r3, 3),
      attach(r3, 4),
      attach(r3, 6),
      retract(attach(r3, 4), 2),
      retract(attach(r3, 2), 5),
    ];
    for (const s of seq) {
      expect(s.principalVoiceCount).toBe(2);
    }
  });
  it('only respondent_seat_taken moves the count 1 -> 2, and it never exceeds 2', () => {
    const r2 = created('public');
    expect(r2.principalVoiceCount).toBe(1);
    const r3 = applyRoomLifecycleEvent(r2, { kind: 'respondent_seat_taken' });
    expect(r3.principalVoiceCount).toBe(2);
    // A further seat-taken cannot push it past 2 (no-op off r2).
    const again = applyRoomLifecycleEvent(r3, { kind: 'respondent_seat_taken' });
    expect(again.principalVoiceCount).toBe(2);
  });
  it('chime events in a private room never move the private principal count', () => {
    const r6 = created('private');
    expect(attach(r6, 5).principalVoiceCount).toBe(r6.principalVoiceCount);
  });
});

// ── Invariant C — chime-never-sets-argument-structural-state ────

describe('Invariant C — a chime event never sets an argument-structural state', () => {
  const EXPECTED_KEYS = [
    'chimeComposerAvailable',
    'chimeInCap',
    'chimeInSeatsFilled',
    'displayState',
    'observeOnly',
    'phase',
    'principalVoiceCount',
    'visibility',
  ];

  it('the lifecycle state declares no argument-structural / scoring field', () => {
    for (const s of reachableStates()) {
      expect(Object.keys(s).sort()).toEqual(EXPECTED_KEYS);
      for (const key of Object.keys(s)) {
        // No key names an argument row structural field, a score, or a standing.
        expect(key.toLowerCase()).not.toMatch(/node|status|argument|score|standing|verdict/);
      }
    }
  });

  it('the transition source contains no argument/node mutation or write-path token', () => {
    for (const token of [
      'argument_type',
      'argumentType',
      'node',
      'status',
      '.insert(',
      'functions.invoke',
      'submit-argument',
      'primaryOpponent',
      'debate_participants',
    ]) {
      expect(MODEL_SRC).not.toContain(token);
    }
  });

  it('a chime event changes only the participation/projection fields', () => {
    const ALLOWED = new Set([
      'phase',
      'chimeInSeatsFilled',
      'observeOnly',
      'chimeComposerAvailable',
      'displayState',
    ]);
    for (const before of reachableStates()) {
      for (const kind of ['chime_in_attached', 'chime_in_retracted'] as const) {
        const after = applyRoomLifecycleEvent(before, { kind });
        // The structural / principal fields NEVER change on a chime event.
        expect(after.principalVoiceCount).toBe(before.principalVoiceCount);
        expect(after.visibility).toBe(before.visibility);
        expect(after.chimeInCap).toBe(before.chimeInCap);
        for (const key of changedKeys(before, after)) {
          expect(ALLOWED.has(key)).toBe(true);
        }
      }
    }
  });
});

// ── Projection parity with the shipped snapshot union ───────────

describe('projection parity — reuse of the shipped RoomOneToOneDisplayState union', () => {
  it('every reachable displayState is a member of the shipped union', () => {
    for (const s of reachableStates()) {
      expect(ALL_ROOM_ONE_TO_ONE_DISPLAY_STATES).toContain(s.displayState);
    }
  });
  it('projectToDisplayState(state) always equals state.displayState', () => {
    for (const s of reachableStates()) {
      expect(projectToDisplayState(s)).toBe(s.displayState);
    }
  });
  it('the lifecycle never produces the viewer-scoped observer_reading state', () => {
    for (const s of reachableStates()) {
      expect(s.displayState).not.toBe('observer_reading');
    }
  });
});

// ── Explicit per-phase projection + a lifecycle round-trip ──────

describe('per-phase projection to the shipped display union', () => {
  it('each phase projects to its documented display state', () => {
    expect(projectToDisplayState(initialRoomLifecycleState())).toBe('unknown');
    expect(projectToDisplayState(created('public'))).toBe('public_respondent_seat_open');
    expect(projectToDisplayState(created('private'))).toBe('private_invited_access');
    expect(projectToDisplayState(establishedPublic())).toBe('public_chime_in_available_dormant');
    expect(projectToDisplayState(attach(establishedPublic(), 1))).toBe(
      'public_chime_in_available_dormant',
    );
    expect(projectToDisplayState(attach(establishedPublic(), CHIME_IN_CAP_PUBLIC))).toBe(
      'public_chime_in_full_dormant',
    );
    expect(projectToDisplayState(attach(establishedPublic(), CHIME_IN_CAP_PUBLIC + 1))).toBe(
      'public_chime_in_full_dormant',
    );
  });
});

describe('a full lifecycle round-trip walks the R-edges and returns cleanly', () => {
  it('r2 -> r3 -> r4 (fill) -> r5 (overflow) -> r4 -> r3 (drain)', () => {
    const walk: RoomLifecyclePhase[] = [];
    let s = created('public');
    walk.push(s.phase); // r2
    s = applyRoomLifecycleEvent(s, { kind: 'respondent_seat_taken' });
    walk.push(s.phase); // r3
    for (let i = 0; i < CHIME_IN_CAP_PUBLIC; i += 1) {
      s = applyRoomLifecycleEvent(s, { kind: 'chime_in_attached' });
    }
    walk.push(s.phase); // r4 (at cap)
    s = applyRoomLifecycleEvent(s, { kind: 'chime_in_attached' });
    walk.push(s.phase); // r5
    for (let i = 0; i < CHIME_IN_CAP_PUBLIC; i += 1) {
      s = applyRoomLifecycleEvent(s, { kind: 'chime_in_retracted' });
    }
    walk.push(s.phase); // r3 (drained)
    expect(walk).toEqual([
      'r2_respondent_seat_open',
      'r3_two_principals',
      'r4_chime_in_attached',
      'r5_chime_seats_full',
      'r3_two_principals',
    ]);
    // Back at r3 with an empty chime ledger and two principals intact.
    expect(s.chimeInSeatsFilled).toBe(0);
    expect(s.principalVoiceCount).toBe(2);
  });
});

// ── Purity / frozen / determinism ───────────────────────────────

describe('purity, frozen output, determinism', () => {
  it('the source imports no React and no Supabase', () => {
    expect(MODEL_SRC).not.toContain("from 'react'");
    expect(MODEL_SRC).not.toContain("from '@supabase");
    expect(MODEL_SRC).not.toContain('supabase');
  });
  it('the source uses no clock and no randomness', () => {
    expect(MODEL_SRC).not.toContain('Date.now');
    expect(MODEL_SRC).not.toContain('new Date');
    expect(MODEL_SRC).not.toContain('Math.random');
  });
  it('every produced state is frozen', () => {
    for (const s of reachableStates()) {
      expect(Object.isFrozen(s)).toBe(true);
    }
  });
  it('applying the same event to the same state is deterministic', () => {
    const r3 = establishedPublic();
    const a = applyRoomLifecycleEvent(r3, { kind: 'chime_in_attached' });
    const b = applyRoomLifecycleEvent(r3, { kind: 'chime_in_attached' });
    expect(a).toEqual(b);
  });
  it('a malformed state resets to initial before applying the event', () => {
    const s = applyRoomLifecycleEvent(null as unknown as RoomLifecycleState, {
      kind: 'create',
      visibility: 'public',
    });
    expect(s.phase).toBe('r2_respondent_seat_open');
  });
  it('a malformed / unrecognized event is a no-op', () => {
    const r3 = establishedPublic();
    expect(
      applyRoomLifecycleEvent(r3, { kind: 'nonsense' } as unknown as { kind: 'create'; visibility: 'public' }),
    ).toEqual(r3);
    expect(applyRoomLifecycleEvent(r3, null as unknown as { kind: 'create'; visibility: 'public' })).toEqual(r3);
  });
  it('projectToDisplayState returns unknown for a nonsense state', () => {
    expect(projectToDisplayState(null as unknown as RoomLifecycleState)).toBe('unknown');
    expect(projectToDisplayState({} as unknown as RoomLifecycleState)).toBe('unknown');
  });
});

// ── Ban-list scan ───────────────────────────────────────────────

describe('ban-list — vocabulary + reused copy carry no forbidden token', () => {
  it('_forbiddenRoomLifecycleTokens reuses the shipped display-model avoid-list', () => {
    expect(_forbiddenRoomLifecycleTokens()).toEqual(_forbiddenOneToOneTokens());
  });

  it('no phase or event identifier segment is a banned token', () => {
    const banned = new Set(_forbiddenRoomLifecycleTokens().map((t) => t.toLowerCase()));
    const identifiers: string[] = [
      ...(ALL_ROOM_LIFECYCLE_PHASES as ReadonlyArray<RoomLifecyclePhase>),
      ...ALL_ROOM_LIFECYCLE_EVENT_KINDS,
    ];
    for (const id of identifiers) {
      for (const segment of id.toLowerCase().split(/[_-]/)) {
        expect(banned.has(segment)).toBe(false);
      }
    }
  });

  it('the reused display copy contains no banned whole word', () => {
    const banned = _forbiddenRoomLifecycleTokens();
    const strings: string[] = [
      ...Object.values(ROOM_ONE_TO_ONE_COPY),
      ...Object.values(POINT_SCOPED_CHIME_IN_COPY),
    ];
    for (const value of strings) {
      for (const token of banned) {
        const pattern = new RegExp(
          `\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
          'i',
        );
        expect(pattern.test(value)).toBe(false);
      }
    }
  });
});
