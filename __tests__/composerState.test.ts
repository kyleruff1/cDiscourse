/**
 * Stage 5.5.1 — composer state, helpers, and draft recovery unit tests.
 * Pure functions only. No network, no Supabase, no React.
 */

import {
  createDraftId,
  createClientSubmissionId,
  createEmptyDraft,
  updateDraftField,
  isDraftSubmittableShape,
  shouldReusePendingSubmission,
  shouldCreateNewClientSubmissionId,
  getDraftStorageKey,
  normalizeAttachedEvidence,
  shouldRestoreDraft,
  canClearParentWithoutConfirm,
} from '../src/features/arguments/composerHelpers';
import { draftToSession, sessionToDraft } from '../src/features/arguments/composerState';
import { sessionReducer, INITIAL_SESSION_STATE } from '../src/features/session/sessionState';
import type { ComposerDraft } from '../src/features/arguments/composerState';
import type { ComposerDraftSession, PendingSubmission } from '../src/features/session/types';

// ── Fixtures ──────────────────────────────────────────────────

const USER_ID = 'u-00000000-0000-0000-0000-000000000001';
const DEBATE_A = 'd-00000000-0000-0000-0000-000000000001';
const DEBATE_B = 'd-00000000-0000-0000-0000-000000000002';
const DRAFT_ID = 'dr-00000000-0000-0000-0000-000000000001';
const CLIENT_SUBMISSION_ID = 'cs-00000000-0000-0000-0000-000000000001';
const PARENT_ID = 'p-00000000-0000-0000-0000-000000000001';

function makeDraft(overrides?: Partial<ComposerDraft>): ComposerDraft {
  return {
    draftId: DRAFT_ID,
    debateId: DEBATE_A,
    parentId: null,
    argumentType: 'claim',
    side: 'affirmative',
    body: 'Initial body',
    selectedTagCodes: [],
    targetExcerpt: null,
    disagreementAxis: null,
    attachedEvidence: [],
    updatedAt: '2026-05-16T00:00:00.000Z',
    dirty: false,
    ...overrides,
  };
}

function makePending(overrides?: Partial<PendingSubmission>): PendingSubmission {
  return {
    clientSubmissionId: CLIENT_SUBMISSION_ID,
    draftId: DRAFT_ID,
    debateId: DEBATE_A,
    createdAt: '2026-05-16T00:00:00.000Z',
    status: 'failed',
    lastError: 'network timeout',
    ...overrides,
  };
}

function makeSessionDraft(overrides?: Partial<ComposerDraftSession>): ComposerDraftSession {
  return {
    draftId: DRAFT_ID,
    debateId: DEBATE_A,
    parentId: null,
    argumentType: 'claim',
    side: 'affirmative',
    body: 'Initial body',
    selectedTagCodes: [],
    targetExcerpt: null,
    disagreementAxis: null,
    attachedEvidence: [],
    updatedAt: '2026-05-16T00:00:00.000Z',
    dirty: false,
    ...overrides,
  };
}

// ── 1. Identity helpers ───────────────────────────────────────

describe('composerHelpers — createDraftId / createClientSubmissionId', () => {
  test('createDraftId returns a non-empty string', () => {
    const id = createDraftId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  test('createDraftId produces different values on successive calls', () => {
    const a = createDraftId();
    const b = createDraftId();
    expect(a).not.toBe(b);
  });

  test('createClientSubmissionId returns a non-empty string', () => {
    const id = createClientSubmissionId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  test('createClientSubmissionId and createDraftId are independent', () => {
    const draftId = createDraftId();
    const clientId = createClientSubmissionId();
    expect(draftId).not.toBe(clientId);
  });
});

// ── 2. createEmptyDraft ───────────────────────────────────────

describe('composerHelpers — createEmptyDraft', () => {
  test('creates a root draft when no parentId provided', () => {
    const draft = createEmptyDraft({ debateId: DEBATE_A });
    expect(draft.debateId).toBe(DEBATE_A);
    expect(draft.parentId).toBeNull();
    expect(draft.argumentType).toBeNull();
    expect(draft.side).toBeNull();
    expect(draft.body).toBe('');
    expect(draft.dirty).toBe(false);
  });

  test('creates a reply draft when parentId is provided', () => {
    const draft = createEmptyDraft({ debateId: DEBATE_A, parentId: PARENT_ID });
    expect(draft.parentId).toBe(PARENT_ID);
    expect(draft.debateId).toBe(DEBATE_A);
  });

  test('assigns a unique draftId each call', () => {
    const a = createEmptyDraft({ debateId: DEBATE_A });
    const b = createEmptyDraft({ debateId: DEBATE_A });
    expect(a.draftId).not.toBe(b.draftId);
  });

  test('new drafts for different debates have the correct debateId', () => {
    const a = createEmptyDraft({ debateId: DEBATE_A });
    const b = createEmptyDraft({ debateId: DEBATE_B });
    expect(a.debateId).toBe(DEBATE_A);
    expect(b.debateId).toBe(DEBATE_B);
  });
});

// ── 3. updateDraftField ───────────────────────────────────────

describe('composerHelpers — updateDraftField', () => {
  test('patch is merged into the draft', () => {
    const draft = makeDraft({ body: 'old' });
    const updated = updateDraftField(draft, { body: 'new' });
    expect(updated.body).toBe('new');
  });

  test('update marks the draft as dirty', () => {
    const draft = makeDraft({ dirty: false });
    const updated = updateDraftField(draft, { body: 'changed' });
    expect(updated.dirty).toBe(true);
  });

  test('draftId and debateId are preserved unchanged', () => {
    const draft = makeDraft();
    const updated = updateDraftField(draft, { body: 'x' });
    expect(updated.draftId).toBe(draft.draftId);
    expect(updated.debateId).toBe(draft.debateId);
  });

  test('updatedAt advances after an update', () => {
    const before = new Date().toISOString();
    const draft = makeDraft({ updatedAt: before });
    const updated = updateDraftField(draft, { body: 'changed' });
    expect(updated.updatedAt >= before).toBe(true);
  });

  test('patching parentId to null clears it', () => {
    const draft = makeDraft({ parentId: PARENT_ID });
    const updated = updateDraftField(draft, { parentId: null });
    expect(updated.parentId).toBeNull();
    expect(updated.dirty).toBe(true);
  });
});

// ── 4. isDraftSubmittableShape ────────────────────────────────

describe('composerHelpers — isDraftSubmittableShape', () => {
  test('returns false when argumentType is null', () => {
    expect(isDraftSubmittableShape(makeDraft({ argumentType: null }))).toBe(false);
  });

  test('returns false when side is null', () => {
    expect(isDraftSubmittableShape(makeDraft({ side: null }))).toBe(false);
  });

  test('returns false when body is blank', () => {
    expect(isDraftSubmittableShape(makeDraft({ body: '   ' }))).toBe(false);
  });

  test('returns true when all required fields are present', () => {
    expect(isDraftSubmittableShape(makeDraft({ argumentType: 'claim', side: 'affirmative', body: 'A claim.' }))).toBe(true);
  });
});

// ── 5. shouldReusePendingSubmission ──────────────────────────

describe('composerHelpers — shouldReusePendingSubmission', () => {
  test('returns false when no pending submission exists', () => {
    expect(shouldReusePendingSubmission(null, makeDraft())).toBe(false);
  });

  test('returns false when submission has not failed', () => {
    const pending = makePending({ status: 'submitted' });
    expect(shouldReusePendingSubmission(pending, makeDraft())).toBe(false);
  });

  test('returns false when draftId does not match', () => {
    const pending = makePending({ draftId: 'other-draft' });
    expect(shouldReusePendingSubmission(pending, makeDraft())).toBe(false);
  });

  test('returns true for a failed submission with matching draftId', () => {
    const pending = makePending({ status: 'failed', draftId: DRAFT_ID });
    expect(shouldReusePendingSubmission(pending, makeDraft())).toBe(true);
  });
});

// ── 6. shouldCreateNewClientSubmissionId ─────────────────────

describe('composerHelpers — shouldCreateNewClientSubmissionId', () => {
  test('returns false when nothing has changed', () => {
    const draft = makeDraft();
    expect(shouldCreateNewClientSubmissionId(draft, draft)).toBe(false);
  });

  test('returns true when body changes', () => {
    const prev = makeDraft({ body: 'old' });
    const next = makeDraft({ body: 'new' });
    expect(shouldCreateNewClientSubmissionId(prev, next)).toBe(true);
  });

  test('returns true when argumentType changes', () => {
    const prev = makeDraft({ argumentType: 'claim' });
    const next = makeDraft({ argumentType: 'rebuttal' });
    expect(shouldCreateNewClientSubmissionId(prev, next)).toBe(true);
  });

  test('returns true when side changes', () => {
    const prev = makeDraft({ side: 'affirmative' });
    const next = makeDraft({ side: 'negative' });
    expect(shouldCreateNewClientSubmissionId(prev, next)).toBe(true);
  });

  test('returns true when parentId changes', () => {
    const prev = makeDraft({ parentId: null });
    const next = makeDraft({ parentId: PARENT_ID });
    expect(shouldCreateNewClientSubmissionId(prev, next)).toBe(true);
  });

  test('returns false when only selectedTagCodes change (non-content change)', () => {
    const prev = makeDraft({ selectedTagCodes: [] });
    const next = makeDraft({ selectedTagCodes: ['claim'] });
    expect(shouldCreateNewClientSubmissionId(prev, next)).toBe(false);
  });
});

// ── 7. getDraftStorageKey ─────────────────────────────────────

describe('composerHelpers — getDraftStorageKey', () => {
  test('key includes userId', () => {
    const key = getDraftStorageKey(USER_ID, DRAFT_ID);
    expect(key).toContain(USER_ID);
  });

  test('key includes draftId', () => {
    const key = getDraftStorageKey(USER_ID, DRAFT_ID);
    expect(key).toContain(DRAFT_ID);
  });

  test('different userIds produce different keys', () => {
    const keyA = getDraftStorageKey('user-A', DRAFT_ID);
    const keyB = getDraftStorageKey('user-B', DRAFT_ID);
    expect(keyA).not.toBe(keyB);
  });

  test('different draftIds produce different keys', () => {
    const keyA = getDraftStorageKey(USER_ID, 'draft-A');
    const keyB = getDraftStorageKey(USER_ID, 'draft-B');
    expect(keyA).not.toBe(keyB);
  });
});

// ── 8. normalizeAttachedEvidence ─────────────────────────────

describe('composerHelpers — normalizeAttachedEvidence', () => {
  test('filters out empty entries', () => {
    const result = normalizeAttachedEvidence([
      { url: '', label: '', sourceText: '' },
      { url: '   ', label: '   ', sourceText: '' },
    ]);
    expect(result).toHaveLength(0);
  });

  test('keeps entries with a non-empty url', () => {
    const result = normalizeAttachedEvidence([{ url: 'https://example.com' }]);
    expect(result).toHaveLength(1);
  });

  test('keeps entries with a non-empty label', () => {
    const result = normalizeAttachedEvidence([{ label: 'Study A' }]);
    expect(result).toHaveLength(1);
  });

  test('keeps entries with a non-empty sourceText', () => {
    const result = normalizeAttachedEvidence([{ sourceText: 'Quoted passage.' }]);
    expect(result).toHaveLength(1);
  });

  test('strips empties while keeping valid entries', () => {
    const result = normalizeAttachedEvidence([
      { url: '' },
      { url: 'https://valid.com', label: 'Source' },
      { url: '', label: '', sourceText: '' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://valid.com');
  });
});

// ── 9. shouldRestoreDraft ─────────────────────────────────────

describe('composerHelpers — shouldRestoreDraft', () => {
  test('returns false when existing draft is null', () => {
    expect(shouldRestoreDraft(null, DEBATE_A)).toBe(false);
  });

  test('returns true when debateId matches', () => {
    const session = makeSessionDraft({ debateId: DEBATE_A });
    expect(shouldRestoreDraft(session, DEBATE_A)).toBe(true);
  });

  test('returns false when debateId does not match', () => {
    const session = makeSessionDraft({ debateId: DEBATE_A });
    expect(shouldRestoreDraft(session, DEBATE_B)).toBe(false);
  });
});

// ── 10. canClearParentWithoutConfirm ─────────────────────────

describe('composerHelpers — canClearParentWithoutConfirm', () => {
  test('returns true for a non-dirty draft', () => {
    expect(canClearParentWithoutConfirm(makeDraft({ dirty: false }))).toBe(true);
  });

  test('returns false for a dirty draft', () => {
    expect(canClearParentWithoutConfirm(makeDraft({ dirty: true }))).toBe(false);
  });
});

// ── 11. draftToSession / sessionToDraft round-trip ───────────

describe('composerState — draftToSession / sessionToDraft', () => {
  test('round-trip preserves all fields', () => {
    const original: ComposerDraft = {
      draftId: DRAFT_ID,
      debateId: DEBATE_A,
      parentId: PARENT_ID,
      argumentType: 'rebuttal',
      side: 'negative',
      body: 'My rebuttal',
      selectedTagCodes: ['fact_disagreement'],
      targetExcerpt: 'Quoted text',
      disagreementAxis: 'fact',
      attachedEvidence: [{ url: 'https://example.com', label: 'Source', sourceText: 'Passage' }],
      updatedAt: '2026-05-16T12:00:00.000Z',
      dirty: true,
    };
    const restored = sessionToDraft(draftToSession(original));
    expect(restored.draftId).toBe(original.draftId);
    expect(restored.debateId).toBe(original.debateId);
    expect(restored.parentId).toBe(original.parentId);
    expect(restored.argumentType).toBe(original.argumentType);
    expect(restored.side).toBe(original.side);
    expect(restored.body).toBe(original.body);
    expect(restored.selectedTagCodes).toEqual(original.selectedTagCodes);
    expect(restored.targetExcerpt).toBe(original.targetExcerpt);
    expect(restored.disagreementAxis).toBe(original.disagreementAxis);
    expect(restored.dirty).toBe(original.dirty);
    expect(restored.attachedEvidence[0].url).toBe('https://example.com');
    expect(restored.attachedEvidence[0].label).toBe('Source');
    expect(restored.attachedEvidence[0].sourceText).toBe('Passage');
  });

  test('draftToSession converts evidence sourceText to source_text', () => {
    const draft = makeDraft({ attachedEvidence: [{ sourceText: 'Passage' }] });
    const session = draftToSession(draft);
    expect(session.attachedEvidence[0].source_text).toBe('Passage');
    expect((session.attachedEvidence[0] as { sourceText?: string }).sourceText).toBeUndefined();
  });

  test('sessionToDraft converts source_text back to sourceText', () => {
    const session = makeSessionDraft({ attachedEvidence: [{ source_text: 'Passage' }] });
    const draft = sessionToDraft(session);
    expect(draft.attachedEvidence[0].sourceText).toBe('Passage');
  });

  test('sessionToDraft handles missing attachedEvidence gracefully', () => {
    const session = makeSessionDraft({ attachedEvidence: undefined as unknown as [] });
    const draft = sessionToDraft(session);
    expect(draft.attachedEvidence).toEqual([]);
  });
});

// ── 12. Session reducer: discard clears activeDraft ──────────

describe('sessionReducer — DRAFT_CLEARED removes activeDraft', () => {
  test('DRAFT_CLEARED sets activeDraft to null', () => {
    const draft = makeSessionDraft({ dirty: true });
    const state = sessionReducer(
      { ...INITIAL_SESSION_STATE, status: 'composing', snapshot: { ...INITIAL_SESSION_STATE.snapshot, userId: USER_ID, selectedDebateId: DEBATE_A, activeDraft: draft } },
      { type: 'DRAFT_CLEARED' },
    );
    expect(state.snapshot.activeDraft).toBeNull();
  });

  test('DRAFT_CLEARED transitions status away from composing', () => {
    const draft = makeSessionDraft();
    const state = sessionReducer(
      { ...INITIAL_SESSION_STATE, status: 'composing', snapshot: { ...INITIAL_SESSION_STATE.snapshot, userId: USER_ID, selectedDebateId: DEBATE_A, activeDraft: draft } },
      { type: 'DRAFT_CLEARED' },
    );
    expect(state.status).toBe('debate_selected');
  });
});

// ── 13. Draft does not leak across debates ────────────────────

describe('composerHelpers — draft isolation across debates', () => {
  test('shouldRestoreDraft returns false when debateId does not match (switching debates)', () => {
    // Simulates: user was composing for debate A, then switches to debate B.
    // The hook must not restore debate A's draft for debate B.
    const draftForDebateA = makeSessionDraft({ debateId: DEBATE_A, dirty: true });
    expect(shouldRestoreDraft(draftForDebateA, DEBATE_B)).toBe(false);
  });

  test('createEmptyDraft for debate B has correct debateId', () => {
    const draft = createEmptyDraft({ debateId: DEBATE_B });
    expect(draft.debateId).toBe(DEBATE_B);
    expect(draft.dirty).toBe(false);
  });
});
