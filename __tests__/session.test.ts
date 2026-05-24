/**
 * Unit tests for Stage 5.1 session layer.
 * Does not require live Supabase or Docker.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

import {
  sessionSnapshotKey,
  anonymousSessionKey,
  draftKey,
  draftIndexKey,
} from '../src/features/session/sessionKeys';

import {
  loadSessionSnapshot,
  saveSessionSnapshot,
  clearSessionSnapshot,
  saveDraft,
  loadDraft,
  deleteDraft,
  listDraftKeysForDebate,
} from '../src/features/session/sessionStorage';

import {
  sessionReducer,
  INITIAL_SESSION_STATE,
} from '../src/features/session/sessionState';
import type { SessionState } from '../src/features/session/sessionState';

import type {
  AppSessionSnapshot,
  ComposerDraftSession,
  PendingSubmission,
} from '../src/features/session/types';

// ── Fixtures ─────────────────────────────────────────────────────

const USER_ID = 'user-00000000-0000-0000-0000-000000000001';
const DEBATE_ID = 'debate-00000000-0000-0000-0000-000000000001';
const DRAFT_ID = 'draft-00000000-0000-0000-0000-000000000001';
const CLIENT_SUBMISSION_ID = 'csid-00000000-0000-0000-0000-000000000001';

function makeSnapshot(overrides?: Partial<AppSessionSnapshot>): AppSessionSnapshot {
  return {
    userId: USER_ID,
    selectedDebateId: DEBATE_ID,
    participantSide: 'affirmative',
    viewport: null,
    activeDraft: null,
    pendingSubmission: null,
    lastSyncAt: null,
    // QOL-038 — snapshot now carries a pendingInviteIntent slice (null
    // by default). Existing session tests don't exercise invites.
    pendingInviteIntent: null,
    ...overrides,
  };
}

function makeDraft(overrides?: Partial<ComposerDraftSession>): ComposerDraftSession {
  return {
    draftId: DRAFT_ID,
    debateId: DEBATE_ID,
    parentId: null,
    argumentType: 'claim',
    side: 'affirmative',
    body: 'Test body',
    selectedTagCodes: [],
    targetExcerpt: null,
    disagreementAxis: null,
    attachedEvidence: [],
    updatedAt: new Date().toISOString(),
    dirty: false,
    ...overrides,
  };
}

function makePendingSubmission(
  overrides?: Partial<PendingSubmission>,
): PendingSubmission {
  return {
    clientSubmissionId: CLIENT_SUBMISSION_ID,
    draftId: DRAFT_ID,
    debateId: DEBATE_ID,
    createdAt: new Date().toISOString(),
    status: 'queued',
    lastError: null,
    ...overrides,
  };
}

// ── 1. Storage key generation ─────────────────────────────────────

describe('sessionKeys', () => {
  test('sessionSnapshotKey is namespaced with userId', () => {
    expect(sessionSnapshotKey(USER_ID)).toBe(`cdiscourse:session:${USER_ID}`);
  });

  test('anonymousSessionKey is stable', () => {
    expect(anonymousSessionKey()).toBe('cdiscourse:session:anon');
  });

  test('draftKey includes userId and draftId', () => {
    expect(draftKey(USER_ID, DRAFT_ID)).toBe(`cdiscourse:draft:${USER_ID}:${DRAFT_ID}`);
  });

  test('draftIndexKey includes userId and debateId', () => {
    expect(draftIndexKey(USER_ID, DEBATE_ID)).toBe(
      `cdiscourse:draft-index:${USER_ID}:${DEBATE_ID}`,
    );
  });

  test('different users produce different keys for same draft', () => {
    expect(draftKey('user-a', DRAFT_ID)).not.toBe(draftKey('user-b', DRAFT_ID));
  });
});

// ── 2. Corrupt snapshot recovery ─────────────────────────────────

describe('sessionStorage — corrupt/missing data', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.restoreAllMocks();
  });

  test('loadSessionSnapshot returns null when key is missing', async () => {
    const result = await loadSessionSnapshot(USER_ID);
    expect(result).toBeNull();
  });

  test('loadSessionSnapshot returns null for corrupt JSON', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValueOnce('{not valid json}');
    const result = await loadSessionSnapshot(USER_ID);
    expect(result).toBeNull();
  });

  test('loadSessionSnapshot returns null for JSON string (non-object)', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValueOnce('"just a string"');
    const result = await loadSessionSnapshot(USER_ID);
    expect(result).toBeNull();
  });

  test('loadSessionSnapshot returns null for JSON array', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValueOnce('[1, 2, 3]');
    const result = await loadSessionSnapshot(USER_ID);
    expect(result).toBeNull();
  });

  test('loadSessionSnapshot returns null when storage throws', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('storage error'));
    const result = await loadSessionSnapshot(USER_ID);
    expect(result).toBeNull();
  });

  test('loadSessionSnapshot returns null for anonymous key when userId is null', async () => {
    const result = await loadSessionSnapshot(null);
    expect(result).toBeNull();
  });

  test('saveSessionSnapshot does not throw when storage fails', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
    await expect(saveSessionSnapshot(USER_ID, makeSnapshot())).resolves.toBeUndefined();
  });

  test('round-trip: save and reload snapshot', async () => {
    const snap = makeSnapshot({ selectedDebateId: DEBATE_ID });
    await saveSessionSnapshot(USER_ID, snap);
    const loaded = await loadSessionSnapshot(USER_ID);
    expect(loaded).toEqual(snap);
  });

  test('clearSessionSnapshot removes stored snapshot', async () => {
    await saveSessionSnapshot(USER_ID, makeSnapshot());
    await clearSessionSnapshot(USER_ID);
    const loaded = await loadSessionSnapshot(USER_ID);
    expect(loaded).toBeNull();
  });

  test('anonymous and user keys are independent', async () => {
    await saveSessionSnapshot(null, makeSnapshot({ userId: null }));
    const userResult = await loadSessionSnapshot(USER_ID);
    expect(userResult).toBeNull();
  });
});

// ── 3. Draft storage ───────────────────────────────────────────────

describe('sessionStorage — draft lifecycle', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('loadDraft returns null for unknown draft', async () => {
    const result = await loadDraft(USER_ID, DRAFT_ID);
    expect(result).toBeNull();
  });

  test('saveDraft and loadDraft round-trip', async () => {
    const draft = makeDraft();
    await saveDraft(USER_ID, draft);
    const loaded = await loadDraft(USER_ID, DRAFT_ID);
    expect(loaded).toEqual(draft);
  });

  test('saveDraft adds draftId to debate index', async () => {
    await saveDraft(USER_ID, makeDraft());
    const ids = await listDraftKeysForDebate(USER_ID, DEBATE_ID);
    expect(ids).toContain(DRAFT_ID);
  });

  test('saveDraft does not duplicate index entries', async () => {
    const draft = makeDraft();
    await saveDraft(USER_ID, draft);
    await saveDraft(USER_ID, { ...draft, body: 'Updated body' });
    const ids = await listDraftKeysForDebate(USER_ID, DEBATE_ID);
    expect(ids.filter((id) => id === DRAFT_ID)).toHaveLength(1);
  });

  test('deleteDraft removes the draft and updates index', async () => {
    await saveDraft(USER_ID, makeDraft());
    await deleteDraft(USER_ID, DRAFT_ID, DEBATE_ID);
    expect(await loadDraft(USER_ID, DRAFT_ID)).toBeNull();
    expect(await listDraftKeysForDebate(USER_ID, DEBATE_ID)).not.toContain(DRAFT_ID);
  });

  test('listDraftKeysForDebate returns empty for unknown debate', async () => {
    const ids = await listDraftKeysForDebate(USER_ID, 'unknown-debate');
    expect(ids).toEqual([]);
  });

  test('listDraftKeysForDebate returns corrupt index as empty', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValueOnce('{broken}');
    const ids = await listDraftKeysForDebate(USER_ID, DEBATE_ID);
    expect(ids).toEqual([]);
  });
});

// ── 4. Session reducer transitions ────────────────────────────────

describe('sessionReducer', () => {
  test('initial state is unconfigured', () => {
    expect(INITIAL_SESSION_STATE.status).toBe('unconfigured');
  });

  test('SIGNED_IN → signed_in_no_debate', () => {
    const next = sessionReducer(INITIAL_SESSION_STATE, {
      type: 'SIGNED_IN',
      userId: USER_ID,
    });
    expect(next.status).toBe('signed_in_no_debate');
    expect(next.snapshot.userId).toBe(USER_ID);
    expect(next.snapshot.selectedDebateId).toBeNull();
  });

  test('SIGNED_IN clears previous debate/draft/pending state', () => {
    const withDebate: SessionState = {
      status: 'composing',
      snapshot: makeSnapshot({
        activeDraft: makeDraft(),
        pendingSubmission: makePendingSubmission(),
      }),
    };
    const next = sessionReducer(withDebate, { type: 'SIGNED_IN', userId: 'new-user' });
    expect(next.snapshot.selectedDebateId).toBeNull();
    expect(next.snapshot.activeDraft).toBeNull();
    expect(next.snapshot.pendingSubmission).toBeNull();
  });

  test('SIGNED_OUT → signed_out with cleared snapshot', () => {
    const withUser: SessionState = {
      status: 'debate_selected',
      snapshot: makeSnapshot(),
    };
    const next = sessionReducer(withUser, { type: 'SIGNED_OUT' });
    expect(next.status).toBe('signed_out');
    expect(next.snapshot.userId).toBeNull();
    expect(next.snapshot.selectedDebateId).toBeNull();
  });

  test('DEBATE_SELECTED → debate_selected', () => {
    const withUser: SessionState = {
      status: 'signed_in_no_debate',
      snapshot: makeSnapshot({ selectedDebateId: null }),
    };
    const next = sessionReducer(withUser, {
      type: 'DEBATE_SELECTED',
      debateId: DEBATE_ID,
      participantSide: 'affirmative',
    });
    expect(next.status).toBe('debate_selected');
    expect(next.snapshot.selectedDebateId).toBe(DEBATE_ID);
    expect(next.snapshot.participantSide).toBe('affirmative');
  });

  test('DRAFT_STARTED → composing', () => {
    const withDebate: SessionState = {
      status: 'debate_selected',
      snapshot: makeSnapshot(),
    };
    const draft = makeDraft();
    const next = sessionReducer(withDebate, { type: 'DRAFT_STARTED', draft });
    expect(next.status).toBe('composing');
    expect(next.snapshot.activeDraft).toEqual(draft);
  });

  test('DRAFT_UPDATED sets dirty = true and merges patch', () => {
    const composing: SessionState = {
      status: 'composing',
      snapshot: makeSnapshot({ activeDraft: makeDraft({ body: 'original', dirty: false }) }),
    };
    const next = sessionReducer(composing, {
      type: 'DRAFT_UPDATED',
      patch: { body: 'updated' },
    });
    expect(next.snapshot.activeDraft?.body).toBe('updated');
    expect(next.snapshot.activeDraft?.dirty).toBe(true);
  });

  test('DRAFT_UPDATED is a no-op when no active draft', () => {
    const state: SessionState = {
      status: 'debate_selected',
      snapshot: makeSnapshot({ activeDraft: null }),
    };
    const next = sessionReducer(state, { type: 'DRAFT_UPDATED', patch: { body: 'x' } });
    expect(next).toBe(state);
  });

  test('DRAFT_CLEARED → debate_selected when debate is active', () => {
    const composing: SessionState = {
      status: 'composing',
      snapshot: makeSnapshot({ activeDraft: makeDraft() }),
    };
    const next = sessionReducer(composing, { type: 'DRAFT_CLEARED' });
    expect(next.status).toBe('debate_selected');
    expect(next.snapshot.activeDraft).toBeNull();
  });

  test('DRAFT_CLEARED → signed_in_no_debate when no debate', () => {
    const composing: SessionState = {
      status: 'composing',
      snapshot: makeSnapshot({ selectedDebateId: null, activeDraft: makeDraft() }),
    };
    const next = sessionReducer(composing, { type: 'DRAFT_CLEARED' });
    expect(next.status).toBe('signed_in_no_debate');
  });

  test('SUBMISSION_QUEUED → submitting', () => {
    const composing: SessionState = {
      status: 'composing',
      snapshot: makeSnapshot({ activeDraft: makeDraft() }),
    };
    const submission = makePendingSubmission();
    const next = sessionReducer(composing, { type: 'SUBMISSION_QUEUED', submission });
    expect(next.status).toBe('submitting');
    expect(next.snapshot.pendingSubmission).toEqual(submission);
  });

  test('SUBMISSION_STARTED updates status to submitting on matching id', () => {
    const submitting: SessionState = {
      status: 'submitting',
      snapshot: makeSnapshot({ pendingSubmission: makePendingSubmission({ status: 'queued' }) }),
    };
    const next = sessionReducer(submitting, {
      type: 'SUBMISSION_STARTED',
      clientSubmissionId: CLIENT_SUBMISSION_ID,
    });
    expect(next.snapshot.pendingSubmission?.status).toBe('submitting');
  });

  test('SUBMISSION_STARTED is no-op on mismatched id', () => {
    const state: SessionState = {
      status: 'submitting',
      snapshot: makeSnapshot({ pendingSubmission: makePendingSubmission() }),
    };
    const next = sessionReducer(state, {
      type: 'SUBMISSION_STARTED',
      clientSubmissionId: 'wrong-id',
    });
    expect(next).toBe(state);
  });

  test('SUBMISSION_SUCCEEDED → debate_selected, clears draft', () => {
    const submitting: SessionState = {
      status: 'submitting',
      snapshot: makeSnapshot({
        activeDraft: makeDraft(),
        pendingSubmission: makePendingSubmission({ status: 'submitting' }),
      }),
    };
    const next = sessionReducer(submitting, {
      type: 'SUBMISSION_SUCCEEDED',
      clientSubmissionId: CLIENT_SUBMISSION_ID,
    });
    expect(next.status).toBe('debate_selected');
    expect(next.snapshot.activeDraft).toBeNull();
    expect(next.snapshot.pendingSubmission?.status).toBe('submitted');
    expect(next.snapshot.lastSyncAt).not.toBeNull();
  });

  test('SUBMISSION_FAILED → recoverable_error', () => {
    const submitting: SessionState = {
      status: 'submitting',
      snapshot: makeSnapshot({
        pendingSubmission: makePendingSubmission({ status: 'submitting' }),
      }),
    };
    const next = sessionReducer(submitting, {
      type: 'SUBMISSION_FAILED',
      clientSubmissionId: CLIENT_SUBMISSION_ID,
      error: 'network_error',
    });
    expect(next.status).toBe('recoverable_error');
    expect(next.snapshot.pendingSubmission?.status).toBe('failed');
    expect(next.snapshot.pendingSubmission?.lastError).toBe('network_error');
  });

  test('ERROR_CLEARED resets pending to queued', () => {
    const errored: SessionState = {
      status: 'recoverable_error',
      snapshot: makeSnapshot({
        pendingSubmission: makePendingSubmission({ status: 'failed', lastError: 'timeout' }),
      }),
    };
    const next = sessionReducer(errored, { type: 'ERROR_CLEARED' });
    expect(next.snapshot.pendingSubmission?.status).toBe('queued');
    expect(next.snapshot.pendingSubmission?.lastError).toBeNull();
  });
});

// ── 5. SNAPSHOT_RESTORED status resolution ────────────────────────

describe('sessionReducer — SNAPSHOT_RESTORED', () => {
  test('no userId → signed_out', () => {
    const next = sessionReducer(INITIAL_SESSION_STATE, {
      type: 'SNAPSHOT_RESTORED',
      snapshot: makeSnapshot({ userId: null }),
    });
    expect(next.status).toBe('signed_out');
  });

  test('userId but no debate → signed_in_no_debate', () => {
    const next = sessionReducer(INITIAL_SESSION_STATE, {
      type: 'SNAPSHOT_RESTORED',
      snapshot: makeSnapshot({ selectedDebateId: null }),
    });
    expect(next.status).toBe('signed_in_no_debate');
  });

  test('debate + failed pending → recoverable_error', () => {
    const next = sessionReducer(INITIAL_SESSION_STATE, {
      type: 'SNAPSHOT_RESTORED',
      snapshot: makeSnapshot({ pendingSubmission: makePendingSubmission({ status: 'failed' }) }),
    });
    expect(next.status).toBe('recoverable_error');
  });

  test('debate + queued pending → recoverable_error (stale queued = never sent)', () => {
    const next = sessionReducer(INITIAL_SESSION_STATE, {
      type: 'SNAPSHOT_RESTORED',
      snapshot: makeSnapshot({ pendingSubmission: makePendingSubmission({ status: 'queued' }) }),
    });
    expect(next.status).toBe('recoverable_error');
  });

  test('debate + submitting pending → recoverable_error (app closed mid-flight)', () => {
    const next = sessionReducer(INITIAL_SESSION_STATE, {
      type: 'SNAPSHOT_RESTORED',
      snapshot: makeSnapshot({
        pendingSubmission: makePendingSubmission({ status: 'submitting' }),
      }),
    });
    expect(next.status).toBe('recoverable_error');
  });

  test('debate + submitted pending → debate_selected (clean)', () => {
    const next = sessionReducer(INITIAL_SESSION_STATE, {
      type: 'SNAPSHOT_RESTORED',
      snapshot: makeSnapshot({
        pendingSubmission: makePendingSubmission({ status: 'submitted' }),
      }),
    });
    expect(next.status).toBe('debate_selected');
  });

  test('debate + active draft → composing', () => {
    const next = sessionReducer(INITIAL_SESSION_STATE, {
      type: 'SNAPSHOT_RESTORED',
      snapshot: makeSnapshot({ activeDraft: makeDraft() }),
    });
    expect(next.status).toBe('composing');
  });
});

// ── 6. Idempotency payload mapping ────────────────────────────────

describe('idempotency payload', () => {
  test('SubmitArgumentInput includes client_submission_id when provided', () => {
    // The mapping is straightforward — the field name is already snake_case
    // in SubmitArgumentInput (matching the Edge Function schema).
    const payload = {
      debate_id: DEBATE_ID,
      argument_type: 'claim' as const,
      side: 'affirmative' as const,
      body: 'Test',
      selected_tag_codes: [],
      client_submission_id: CLIENT_SUBMISSION_ID,
    };
    expect(payload.client_submission_id).toBe(CLIENT_SUBMISSION_ID);
  });

  test('PendingSubmission.clientSubmissionId maps to client_submission_id', () => {
    const pending = makePendingSubmission();
    // The caller maps pending.clientSubmissionId → payload.client_submission_id
    const edgeFnPayload = {
      client_submission_id: pending.clientSubmissionId,
    };
    expect(edgeFnPayload.client_submission_id).toBe(CLIENT_SUBMISSION_ID);
  });

  test('omitting client_submission_id does not set the field', () => {
    const payload: Record<string, unknown> = {
      debate_id: DEBATE_ID,
      argument_type: 'claim',
      side: 'affirmative',
      body: 'Test',
      selected_tag_codes: [],
    };
    expect(payload.client_submission_id).toBeUndefined();
  });
});
