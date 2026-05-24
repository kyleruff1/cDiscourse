/**
 * Stage 5.3 — debate selection, participant side merge, and join error tests.
 * All pure reducer / pure function tests — no live Supabase required.
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('../src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
  },
  SUPABASE_CONFIGURED: true,
}));

import { sessionReducer, INITIAL_SESSION_STATE } from '../src/features/session/sessionState';
import type { SessionState } from '../src/features/session/sessionState';
import type { AppSessionSnapshot, ComposerDraftSession } from '../src/features/session/types';
import type { DebateViewport } from '../src/features/session/types';
import { isAlreadyJoinedError } from '../src/features/debates/debatesApi';

// ── Fixtures ──────────────────────────────────────────────────

const USER_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const DEBATE_ID = 'debdbdbd-0000-0000-0000-000000000001';
const DEBATE_ID_2 = 'debdbdbd-0000-0000-0000-000000000002';
const DRAFT_ID = 'draftfft-0000-0000-0000-000000000001';
const ARG_ID = 'argargarg-000-0000-0000-000000000001';

function snap(overrides?: Partial<AppSessionSnapshot>): AppSessionSnapshot {
  return {
    userId: USER_A,
    selectedDebateId: null,
    participantSide: null,
    viewport: null,
    activeDraft: null,
    pendingSubmission: null,
    lastSyncAt: null,
    // QOL-038 — snapshot now carries a pendingInviteIntent slice (null
    // by default). Existing debates tests don't exercise invites.
    pendingInviteIntent: null,
    ...overrides,
  };
}

function draftSession(overrides?: Partial<ComposerDraftSession>): ComposerDraftSession {
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

function viewport(overrides?: Partial<DebateViewport>): DebateViewport {
  return {
    debateId: DEBATE_ID,
    focusedArgumentId: ARG_ID,
    selectedParentId: null,
    rootCursor: null,
    expandedArgumentIds: [ARG_ID],
    collapsedArgumentIds: [],
    lastLoadedAt: new Date().toISOString(),
    lastSeenArgumentId: null,
    ...overrides,
  };
}

// ── 1. Debate selection reducer ────────────────────────────────

describe('session reducer — debate selection', () => {
  test('DEBATE_SELECTED sets debateId and participantSide', () => {
    const signedIn: SessionState = {
      status: 'signed_in_no_debate',
      snapshot: snap(),
    };
    const next = sessionReducer(signedIn, {
      type: 'DEBATE_SELECTED',
      debateId: DEBATE_ID,
      participantSide: 'affirmative',
    });
    expect(next.status).toBe('debate_selected');
    expect(next.snapshot.selectedDebateId).toBe(DEBATE_ID);
    expect(next.snapshot.participantSide).toBe('affirmative');
  });

  test('DEBATE_SELECTED with moderator side', () => {
    const signedIn: SessionState = {
      status: 'signed_in_no_debate',
      snapshot: snap(),
    };
    const next = sessionReducer(signedIn, {
      type: 'DEBATE_SELECTED',
      debateId: DEBATE_ID,
      participantSide: 'moderator',
    });
    expect(next.snapshot.participantSide).toBe('moderator');
    expect(next.status).toBe('debate_selected');
  });

  test('DEBATE_SELECTED clears activeDraft and viewport from prior debate', () => {
    const composing: SessionState = {
      status: 'composing',
      snapshot: snap({
        selectedDebateId: DEBATE_ID,
        activeDraft: draftSession({ dirty: true }),
        viewport: viewport(),
      }),
    };
    const next = sessionReducer(composing, {
      type: 'DEBATE_SELECTED',
      debateId: DEBATE_ID_2,
      participantSide: 'negative',
    });
    expect(next.snapshot.activeDraft).toBeNull();
    expect(next.snapshot.viewport).toBeNull();
    expect(next.snapshot.selectedDebateId).toBe(DEBATE_ID_2);
  });
});

// ── 2. Participant side merge (VIEWPORT_UPDATED) ────────────────

describe('session reducer — viewport update preserves active draft', () => {
  test('VIEWPORT_UPDATED does not touch activeDraft', () => {
    const composing: SessionState = {
      status: 'composing',
      snapshot: snap({
        selectedDebateId: DEBATE_ID,
        activeDraft: draftSession({ dirty: true, body: 'important draft' }),
      }),
    };
    const next = sessionReducer(composing, {
      type: 'VIEWPORT_UPDATED',
      viewport: viewport({ focusedArgumentId: 'new-arg' }),
    });
    expect(next.snapshot.activeDraft?.dirty).toBe(true);
    expect(next.snapshot.activeDraft?.body).toBe('important draft');
    expect(next.snapshot.viewport?.focusedArgumentId).toBe('new-arg');
  });

  test('VIEWPORT_UPDATED from debate_user_state does not overwrite dirty draft', () => {
    const dirtyDraft = draftSession({ dirty: true, body: 'unsaved work' });
    const existing: SessionState = {
      status: 'composing',
      snapshot: snap({ selectedDebateId: DEBATE_ID, activeDraft: dirtyDraft }),
    };
    const serverViewport = viewport({ focusedArgumentId: ARG_ID, expandedArgumentIds: [ARG_ID] });
    const next = sessionReducer(existing, { type: 'VIEWPORT_UPDATED', viewport: serverViewport });
    expect(next.snapshot.activeDraft?.body).toBe('unsaved work');
    expect(next.snapshot.activeDraft?.dirty).toBe(true);
  });
});

// ── 3. Deselect debate (SIGNED_IN reuse) ──────────────────────

describe('session reducer — deselect debate', () => {
  test('dispatching SIGNED_IN with same user clears selected debate', () => {
    const selected: SessionState = {
      status: 'debate_selected',
      snapshot: snap({ selectedDebateId: DEBATE_ID, participantSide: 'affirmative' }),
    };
    const next = sessionReducer(selected, { type: 'SIGNED_IN', userId: USER_A });
    expect(next.status).toBe('signed_in_no_debate');
    expect(next.snapshot.selectedDebateId).toBeNull();
    expect(next.snapshot.participantSide).toBeNull();
    expect(next.snapshot.userId).toBe(USER_A);
  });
});

// ── 4. Duplicate join error normalization ─────────────────────

describe('isAlreadyJoinedError', () => {
  test('returns true for Postgres unique-violation code 23505', () => {
    expect(isAlreadyJoinedError({ code: '23505' })).toBe(true);
  });

  test('returns false for other error codes', () => {
    expect(isAlreadyJoinedError({ code: '42501' })).toBe(false);
    expect(isAlreadyJoinedError({ code: '23503' })).toBe(false);
  });

  test('returns false for null', () => {
    expect(isAlreadyJoinedError(null)).toBe(false);
  });

  test('returns false for error without code', () => {
    expect(isAlreadyJoinedError({})).toBe(false);
  });
});

// ── 5. Full debate flow sequence ──────────────────────────────

describe('full debate flow sequence', () => {
  test('signed_in → select debate → update viewport → deselect', () => {
    let s = sessionReducer(INITIAL_SESSION_STATE, { type: 'SIGNED_IN', userId: USER_A });
    expect(s.status).toBe('signed_in_no_debate');

    s = sessionReducer(s, {
      type: 'DEBATE_SELECTED',
      debateId: DEBATE_ID,
      participantSide: 'affirmative',
    });
    expect(s.status).toBe('debate_selected');

    s = sessionReducer(s, { type: 'VIEWPORT_UPDATED', viewport: viewport() });
    expect(s.snapshot.viewport?.focusedArgumentId).toBe(ARG_ID);
    expect(s.status).toBe('debate_selected');

    s = sessionReducer(s, { type: 'SIGNED_IN', userId: USER_A });
    expect(s.status).toBe('signed_in_no_debate');
    expect(s.snapshot.selectedDebateId).toBeNull();
    expect(s.snapshot.viewport).toBeNull();
  });
});
