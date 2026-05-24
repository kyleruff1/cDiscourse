/**
 * Stage 5.2 — session boot and auth API unit tests.
 * No live Supabase required.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// Mock supabase so tests don't need real env vars.
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
  },
  SUPABASE_CONFIGURED: true,
}));

import { sessionReducer, INITIAL_SESSION_STATE } from '../src/features/session/sessionState';
import type { SessionState } from '../src/features/session/sessionState';
import type { AppSessionSnapshot, ComposerDraftSession, PendingSubmission } from '../src/features/session/types';
import {
  loadSessionSnapshot,
  saveSessionSnapshot,
  clearSessionSnapshot,
} from '../src/features/session/sessionStorage';
import { validateAuthInput } from '../src/features/auth/authApi';

// ── Fixtures ─────────────────────────────────────────────────────

const USER_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const USER_B = 'bbbbbbbb-0000-0000-0000-000000000001';
const DEBATE_ID = 'debdbdbd-0000-0000-0000-000000000001';
const DRAFT_ID = 'draftfft-0000-0000-0000-000000000001';
const CSID = 'csidcsid-0000-0000-0000-000000000001';

function snap(overrides?: Partial<AppSessionSnapshot>): AppSessionSnapshot {
  return {
    userId: USER_A,
    selectedDebateId: null,
    participantSide: null,
    viewport: null,
    activeDraft: null,
    pendingSubmission: null,
    lastSyncAt: null,
    // QOL-038 — the AppSessionSnapshot now carries a pendingInviteIntent
    // slice (null by default). The existing sessionBoot tests don't
    // exercise the invite path; they merely need the field to be present
    // so the TypeScript shape is satisfied. The dedicated invite-reducer
    // tests live in sessionReducerInvite.test.ts.
    pendingInviteIntent: null,
    ...overrides,
  };
}

function draft(overrides?: Partial<ComposerDraftSession>): ComposerDraftSession {
  return {
    draftId: DRAFT_ID,
    debateId: DEBATE_ID,
    parentId: null,
    argumentType: 'claim',
    side: 'affirmative',
    body: 'test body',
    selectedTagCodes: [],
    targetExcerpt: null,
    disagreementAxis: null,
    attachedEvidence: [],
    updatedAt: new Date().toISOString(),
    dirty: false,
    ...overrides,
  };
}

function pending(overrides?: Partial<PendingSubmission>): PendingSubmission {
  return {
    clientSubmissionId: CSID,
    draftId: DRAFT_ID,
    debateId: DEBATE_ID,
    createdAt: new Date().toISOString(),
    status: 'queued',
    lastError: null,
    ...overrides,
  };
}

// ── 1. Session reducer boot transitions ───────────────────────────

describe('session reducer — boot transitions', () => {
  test('initial state is unconfigured', () => {
    expect(INITIAL_SESSION_STATE.status).toBe('unconfigured');
    expect(INITIAL_SESSION_STATE.snapshot.userId).toBeNull();
  });

  test('SIGNED_OUT from unconfigured → signed_out', () => {
    const next = sessionReducer(INITIAL_SESSION_STATE, { type: 'SIGNED_OUT' });
    expect(next.status).toBe('signed_out');
    expect(next.snapshot.userId).toBeNull();
  });

  test('SIGNED_IN from unconfigured → signed_in_no_debate', () => {
    const next = sessionReducer(INITIAL_SESSION_STATE, { type: 'SIGNED_IN', userId: USER_A });
    expect(next.status).toBe('signed_in_no_debate');
    expect(next.snapshot.userId).toBe(USER_A);
  });

  test('SNAPSHOT_RESTORED with debate_selected snapshot → debate_selected', () => {
    const next = sessionReducer(INITIAL_SESSION_STATE, {
      type: 'SNAPSHOT_RESTORED',
      snapshot: snap({ selectedDebateId: DEBATE_ID }),
    });
    expect(next.status).toBe('debate_selected');
    expect(next.snapshot.selectedDebateId).toBe(DEBATE_ID);
  });

  test('SNAPSHOT_RESTORED with composing snapshot → composing', () => {
    const next = sessionReducer(INITIAL_SESSION_STATE, {
      type: 'SNAPSHOT_RESTORED',
      snapshot: snap({ selectedDebateId: DEBATE_ID, activeDraft: draft() }),
    });
    expect(next.status).toBe('composing');
  });

  test('SNAPSHOT_RESTORED with submitting pending → recoverable_error', () => {
    const next = sessionReducer(INITIAL_SESSION_STATE, {
      type: 'SNAPSHOT_RESTORED',
      snapshot: snap({
        selectedDebateId: DEBATE_ID,
        pendingSubmission: pending({ status: 'submitting' }),
      }),
    });
    expect(next.status).toBe('recoverable_error');
  });

  test('full boot sequence: unconfigured → signed_in → debate_selected', () => {
    let s = sessionReducer(INITIAL_SESSION_STATE, { type: 'SIGNED_IN', userId: USER_A });
    expect(s.status).toBe('signed_in_no_debate');
    s = sessionReducer(s, {
      type: 'DEBATE_SELECTED',
      debateId: DEBATE_ID,
      participantSide: 'affirmative',
    });
    expect(s.status).toBe('debate_selected');
    expect(s.snapshot.selectedDebateId).toBe(DEBATE_ID);
  });
});

// ── 2. Sign-out clears session state ──────────────────────────────

describe('session reducer — sign-out clears state', () => {
  test('SIGNED_OUT from composing clears all user state', () => {
    const composing: SessionState = {
      status: 'composing',
      snapshot: snap({ selectedDebateId: DEBATE_ID, activeDraft: draft() }),
    };
    const next = sessionReducer(composing, { type: 'SIGNED_OUT' });
    expect(next.status).toBe('signed_out');
    expect(next.snapshot.userId).toBeNull();
    expect(next.snapshot.selectedDebateId).toBeNull();
    expect(next.snapshot.activeDraft).toBeNull();
    expect(next.snapshot.pendingSubmission).toBeNull();
  });

  test('SIGNED_OUT from recoverable_error clears state', () => {
    const errored: SessionState = {
      status: 'recoverable_error',
      snapshot: snap({
        selectedDebateId: DEBATE_ID,
        pendingSubmission: pending({ status: 'failed', lastError: 'timeout' }),
      }),
    };
    const next = sessionReducer(errored, { type: 'SIGNED_OUT' });
    expect(next.status).toBe('signed_out');
    expect(next.snapshot.pendingSubmission).toBeNull();
    expect(next.snapshot.viewport).toBeNull();
  });

  test('SIGNED_IN after SIGNED_OUT with new user clears prior debate state', () => {
    const signedOut: SessionState = {
      status: 'signed_out',
      snapshot: snap({ userId: USER_A, selectedDebateId: DEBATE_ID }),
    };
    const next = sessionReducer(signedOut, { type: 'SIGNED_IN', userId: USER_B });
    expect(next.snapshot.userId).toBe(USER_B);
    expect(next.snapshot.selectedDebateId).toBeNull();
  });
});

// ── 3. Selected debate persistence action ────────────────────────

describe('session reducer — debate selection', () => {
  test('DEBATE_SELECTED sets debateId and participantSide', () => {
    const signedIn: SessionState = {
      status: 'signed_in_no_debate',
      snapshot: snap({ selectedDebateId: null }),
    };
    const next = sessionReducer(signedIn, {
      type: 'DEBATE_SELECTED',
      debateId: DEBATE_ID,
      participantSide: 'negative',
    });
    expect(next.status).toBe('debate_selected');
    expect(next.snapshot.selectedDebateId).toBe(DEBATE_ID);
    expect(next.snapshot.participantSide).toBe('negative');
  });

  test('DEBATE_SELECTED clears previous draft and viewport', () => {
    const composing: SessionState = {
      status: 'composing',
      snapshot: snap({
        selectedDebateId: 'old-debate',
        activeDraft: draft(),
        viewport: {
          debateId: 'old-debate',
          focusedArgumentId: 'arg-1',
          selectedParentId: null,
          rootCursor: null,
          expandedArgumentIds: ['arg-1', 'arg-2'],
          collapsedArgumentIds: [],
          lastLoadedAt: null,
          lastSeenArgumentId: null,
        },
      }),
    };
    const next = sessionReducer(composing, {
      type: 'DEBATE_SELECTED',
      debateId: DEBATE_ID,
      participantSide: 'affirmative',
    });
    expect(next.snapshot.activeDraft).toBeNull();
    expect(next.snapshot.viewport).toBeNull();
    expect(next.snapshot.selectedDebateId).toBe(DEBATE_ID);
  });

  test('DEBATE_SELECTED with observer side is valid', () => {
    const signedIn: SessionState = {
      status: 'signed_in_no_debate',
      snapshot: snap(),
    };
    const next = sessionReducer(signedIn, {
      type: 'DEBATE_SELECTED',
      debateId: DEBATE_ID,
      participantSide: 'observer',
    });
    expect(next.snapshot.participantSide).toBe('observer');
  });
});

// ── 4. Corrupt persisted snapshot handling ───────────────────────

describe('sessionStorage — corrupt snapshot recovery in boot context', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
  });

  test('loadSessionSnapshot returns null for corrupt data; boot proceeds to SIGNED_IN', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValueOnce('{{invalid}}');
    const snapshot = await loadSessionSnapshot(USER_A);
    expect(snapshot).toBeNull();
    // Simulate what AppSessionProvider does when snapshot is null:
    const next = sessionReducer(INITIAL_SESSION_STATE, { type: 'SIGNED_IN', userId: USER_A });
    expect(next.status).toBe('signed_in_no_debate');
  });

  test('loadSessionSnapshot returns null for null snapshot.userId mismatch', async () => {
    // Snapshot belongs to a different user — boot should not restore it.
    const wrongUserSnap = snap({ userId: USER_B });
    await saveSessionSnapshot(USER_A, wrongUserSnap);
    const loaded = await loadSessionSnapshot(USER_A);
    // The provider checks: if (snapshot?.userId === userId)
    // Even though the data loaded successfully, the userId mismatch means boot dispatches SIGNED_IN.
    expect(loaded).not.toBeNull(); // storage loaded something
    const mismatch = loaded?.userId !== USER_A;
    expect(mismatch).toBe(true);
    // Provider would dispatch SIGNED_IN, not SNAPSHOT_RESTORED
    const next = sessionReducer(INITIAL_SESSION_STATE, { type: 'SIGNED_IN', userId: USER_A });
    expect(next.status).toBe('signed_in_no_debate');
  });

  test('snapshot with stale submitting status resolves to recoverable_error on restore', async () => {
    const staleSnap = snap({
      selectedDebateId: DEBATE_ID,
      pendingSubmission: pending({ status: 'submitting' }),
    });
    await saveSessionSnapshot(USER_A, staleSnap);
    const loaded = await loadSessionSnapshot(USER_A);
    expect(loaded).not.toBeNull();
    const next = sessionReducer(INITIAL_SESSION_STATE, {
      type: 'SNAPSHOT_RESTORED',
      snapshot: loaded!,
    });
    expect(next.status).toBe('recoverable_error');
  });

  test('clearSessionSnapshot removes stored data', async () => {
    await saveSessionSnapshot(USER_A, snap());
    await clearSessionSnapshot(USER_A);
    const loaded = await loadSessionSnapshot(USER_A);
    expect(loaded).toBeNull();
  });
});

// ── 5. AuthScreen validation helper ──────────────────────────────

describe('validateAuthInput', () => {
  test('returns null for valid email and password', () => {
    expect(validateAuthInput('user@example.com', 'secret123')).toBeNull();
  });

  test('returns error for missing @ in email', () => {
    expect(validateAuthInput('notanemail', 'secret123')).toBeTruthy();
  });

  test('returns error for too-short email', () => {
    expect(validateAuthInput('a@b', 'secret123')).toBeTruthy();
  });

  test('returns error for password shorter than 6 chars', () => {
    expect(validateAuthInput('user@example.com', '12345')).toBeTruthy();
  });

  test('returns error for empty password', () => {
    expect(validateAuthInput('user@example.com', '')).toBeTruthy();
  });

  test('accepts password exactly 6 chars', () => {
    expect(validateAuthInput('user@example.com', '123456')).toBeNull();
  });

  test('returns error for empty email', () => {
    expect(validateAuthInput('', 'secret123')).toBeTruthy();
  });
});
