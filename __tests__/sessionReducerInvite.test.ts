/**
 * QOL-038 — session-reducer tests for the pendingInviteIntent slice.
 *
 * Covers:
 *  - SET_/CLEAR_PENDING_INVITE_INTENT semantics.
 *  - The headline preservation property: SIGNED_OUT → SIGNED_IN keeps
 *    the intent (so the accept-on-first-signed-in trigger can fire after
 *    a fresh sign-up).
 *  - The SIGNED_OUT path keeps the intent (the §6.5 "Sign in as someone
 *    else" mismatch flow).
 *  - The 24h freshness drop on snapshot reload (via
 *    sessionStorage.loadSessionSnapshot).
 *  - Backward compatibility: an older snapshot with no pendingInviteIntent
 *    field is loaded as having `null`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import {
  INITIAL_SESSION_STATE,
  sessionReducer,
} from '../src/features/session/sessionState';
import type { SessionState } from '../src/features/session/sessionState';
import type {
  AppSessionSnapshot,
  PendingInviteIntentSlice,
} from '../src/features/session/types';
import {
  loadSessionSnapshot,
  saveSessionSnapshot,
} from '../src/features/session/sessionStorage';

const USER_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const DEBATE_ID = 'debdbdbd-0000-0000-0000-000000000001';
const TOKEN = 'aB12345678901234567890123456789012345678901';
// A stable fixed timestamp for the deterministic-equality assertions; an
// undated `new Date().toISOString()` inside a helper would change per
// call and `toEqual` against an inlined `intent()` would race the system
// clock at sub-ms granularity.
const FIXED_CAPTURED_AT = '2026-05-24T12:00:00.000Z';

function intent(
  overrides: Partial<PendingInviteIntentSlice> = {},
): PendingInviteIntentSlice {
  return {
    token: TOKEN,
    capturedAt: FIXED_CAPTURED_AT,
    ...overrides,
  };
}

function snap(overrides: Partial<AppSessionSnapshot> = {}): AppSessionSnapshot {
  return {
    userId: USER_A,
    selectedDebateId: null,
    participantSide: null,
    viewport: null,
    activeDraft: null,
    pendingSubmission: null,
    lastSyncAt: null,
    pendingInviteIntent: null,
    ...overrides,
  };
}

// ── Reducer SET_/CLEAR_ semantics ─────────────────────────────

describe('sessionReducer — SET / CLEAR pending invite intent', () => {
  test('SET_PENDING_INVITE_INTENT stores the intent without touching other fields', () => {
    const base: SessionState = {
      status: 'signed_in_no_debate',
      snapshot: snap({ selectedDebateId: DEBATE_ID }),
    };
    const next = sessionReducer(base, { type: 'SET_PENDING_INVITE_INTENT', intent: intent() });
    expect(next.snapshot.pendingInviteIntent).toEqual(intent());
    expect(next.snapshot.selectedDebateId).toBe(DEBATE_ID);
    expect(next.status).toBe('signed_in_no_debate');
  });

  test('CLEAR_PENDING_INVITE_INTENT removes the intent', () => {
    const base: SessionState = {
      status: 'signed_in_no_debate',
      snapshot: snap({ pendingInviteIntent: intent() }),
    };
    const next = sessionReducer(base, { type: 'CLEAR_PENDING_INVITE_INTENT' });
    expect(next.snapshot.pendingInviteIntent).toBeNull();
  });

  test('CLEAR_PENDING_INVITE_INTENT on an absent intent is a no-op', () => {
    const base: SessionState = {
      status: 'signed_in_no_debate',
      snapshot: snap(),
    };
    const next = sessionReducer(base, { type: 'CLEAR_PENDING_INVITE_INTENT' });
    expect(next.snapshot.pendingInviteIntent).toBeNull();
  });
});

// ── Headline preservation — SIGNED_OUT → SIGNED_IN ────────────

describe('sessionReducer — invite intent survives sign-up handshake', () => {
  test('SIGNED_IN preserves the pendingInviteIntent for the accept trigger', () => {
    const signedOut: SessionState = {
      status: 'signed_out',
      snapshot: snap({ userId: null, pendingInviteIntent: intent() }),
    };
    const next = sessionReducer(signedOut, { type: 'SIGNED_IN', userId: USER_A });
    expect(next.snapshot.userId).toBe(USER_A);
    expect(next.snapshot.pendingInviteIntent).toEqual(intent());
  });

  test('SIGNED_OUT preserves the pendingInviteIntent (the §6.5 mismatch path)', () => {
    const composing: SessionState = {
      status: 'composing',
      snapshot: snap({ selectedDebateId: DEBATE_ID, pendingInviteIntent: intent() }),
    };
    const next = sessionReducer(composing, { type: 'SIGNED_OUT' });
    expect(next.snapshot.userId).toBeNull();
    expect(next.snapshot.pendingInviteIntent).toEqual(intent());
  });

  test('full handshake: SIGNED_OUT → SET_INTENT → SIGNED_IN keeps the intent', () => {
    let s = sessionReducer(INITIAL_SESSION_STATE, { type: 'SIGNED_OUT' });
    s = sessionReducer(s, { type: 'SET_PENDING_INVITE_INTENT', intent: intent() });
    expect(s.snapshot.pendingInviteIntent).toEqual(intent());
    s = sessionReducer(s, { type: 'SIGNED_IN', userId: USER_A });
    expect(s.snapshot.userId).toBe(USER_A);
    expect(s.snapshot.pendingInviteIntent).toEqual(intent());
  });

  test('back-to-back SIGNED_IN for a different user keeps the intent (cross-account flow)', () => {
    const signedIn: SessionState = {
      status: 'signed_in_no_debate',
      snapshot: snap({ userId: USER_A, pendingInviteIntent: intent() }),
    };
    const next = sessionReducer(signedIn, { type: 'SIGNED_IN', userId: USER_B });
    expect(next.snapshot.userId).toBe(USER_B);
    expect(next.snapshot.pendingInviteIntent).toEqual(intent());
  });
});

// ── Initial state has the field ───────────────────────────────

describe('INITIAL_SESSION_STATE', () => {
  test('starts with pendingInviteIntent null', () => {
    expect(INITIAL_SESSION_STATE.snapshot.pendingInviteIntent).toBeNull();
  });
});

// ── sessionStorage round-trip + freshness drop ────────────────

describe('sessionStorage — pendingInviteIntent persistence + freshness drop', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('a fresh intent round-trips through saveSessionSnapshot / loadSessionSnapshot', async () => {
    // The freshness window in pendingInviteIntent.ts is 24h vs `now`;
    // any timestamp within the last second qualifies. We assert by
    // matching the persisted token + the capturedAt string, not by
    // referential equality.
    const nowIso = new Date().toISOString();
    const fresh = { token: TOKEN, capturedAt: nowIso };
    await saveSessionSnapshot(USER_A, snap({ pendingInviteIntent: fresh }));
    const loaded = await loadSessionSnapshot(USER_A);
    expect(loaded).not.toBeNull();
    expect(loaded!.pendingInviteIntent).toEqual(fresh);
  });

  test('a stale (> 24h) intent is dropped on read', async () => {
    // 25h before "now" — well outside the freshness window.
    const captured = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const stale = { token: TOKEN, capturedAt: captured };
    await saveSessionSnapshot(USER_A, snap({ pendingInviteIntent: stale }));
    const loaded = await loadSessionSnapshot(USER_A);
    expect(loaded).not.toBeNull();
    expect(loaded!.pendingInviteIntent).toBeNull();
  });

  test('an older snapshot with NO pendingInviteIntent field is loaded as having null', async () => {
    // Manually persist a legacy-shape snapshot without the field — verifies
    // the backward-compat normaliser in loadSessionSnapshot.
    const legacy = {
      userId: USER_A,
      selectedDebateId: null,
      participantSide: null,
      viewport: null,
      activeDraft: null,
      pendingSubmission: null,
      lastSyncAt: null,
    };
    await AsyncStorage.setItem(`cdiscourse:session:${USER_A}`, JSON.stringify(legacy));
    const loaded = await loadSessionSnapshot(USER_A);
    expect(loaded).not.toBeNull();
    expect(loaded!.pendingInviteIntent).toBeNull();
  });
});
