import {
  createSubmissionFingerprint,
  shouldReuseClientSubmissionIdForRetry,
  getOrCreateClientSubmissionId,
  buildSubmitArgumentPayload,
  extractServerValidationError,
  isIdempotentSuccess,
} from '../src/features/arguments/composerSubmit';
import type { ComposerDraft } from '../src/features/arguments/composerState';
import type { PendingSubmission } from '../src/features/session/types';
import type {
  SubmitArgumentError,
  SubmitArgumentSuccess,
} from '../src/lib/edgeFunctions';

// ── Fixtures ──────────────────────────────────────────────────

function makeDraft(overrides: Partial<ComposerDraft> = {}): ComposerDraft {
  return {
    draftId: 'draft-1',
    debateId: 'debate-1',
    parentId: null,
    argumentType: 'thesis',
    side: 'affirmative',
    body: 'Cats are superior pets.',
    selectedTagCodes: ['claim', 'fact_based'],
    targetExcerpt: null,
    disagreementAxis: null,
    attachedEvidence: [],
    updatedAt: '2026-01-01T00:00:00Z',
    dirty: false,
    ...overrides,
  };
}

function makePending(overrides: Partial<PendingSubmission> = {}): PendingSubmission {
  return {
    clientSubmissionId: 'uuid-pending',
    draftId: 'draft-1',
    debateId: 'debate-1',
    createdAt: '2026-01-01T00:00:00Z',
    status: 'failed',
    lastError: 'too_short',
    submissionFingerprint: undefined,
    ...overrides,
  };
}

// ── createSubmissionFingerprint ───────────────────────────────

describe('createSubmissionFingerprint', () => {
  it('produces a stable string for the same draft', () => {
    const draft = makeDraft();
    expect(createSubmissionFingerprint(draft)).toBe(createSubmissionFingerprint(draft));
  });

  it('sorts selectedTagCodes so tag order does not affect the fingerprint', () => {
    const a = makeDraft({ selectedTagCodes: ['claim', 'fact_based'] });
    const b = makeDraft({ selectedTagCodes: ['fact_based', 'claim'] });
    expect(createSubmissionFingerprint(a)).toBe(createSubmissionFingerprint(b));
  });

  it('produces different fingerprints when body changes', () => {
    const a = makeDraft({ body: 'Original body.' });
    const b = makeDraft({ body: 'Changed body.' });
    expect(createSubmissionFingerprint(a)).not.toBe(createSubmissionFingerprint(b));
  });

  it('produces different fingerprints when argumentType changes', () => {
    const a = makeDraft({ argumentType: 'thesis' });
    const b = makeDraft({ argumentType: 'claim' });
    expect(createSubmissionFingerprint(a)).not.toBe(createSubmissionFingerprint(b));
  });

  it('produces different fingerprints when side changes', () => {
    const a = makeDraft({ side: 'affirmative' });
    const b = makeDraft({ side: 'negative' });
    expect(createSubmissionFingerprint(a)).not.toBe(createSubmissionFingerprint(b));
  });

  it('produces different fingerprints when parentId changes', () => {
    const a = makeDraft({ parentId: null });
    const b = makeDraft({ parentId: 'arg-parent' });
    expect(createSubmissionFingerprint(a)).not.toBe(createSubmissionFingerprint(b));
  });

  it('produces different fingerprints when targetExcerpt changes', () => {
    const a = makeDraft({ targetExcerpt: null });
    const b = makeDraft({ targetExcerpt: 'Some excerpt' });
    expect(createSubmissionFingerprint(a)).not.toBe(createSubmissionFingerprint(b));
  });

  it('produces different fingerprints when disagreementAxis changes', () => {
    const a = makeDraft({ disagreementAxis: null });
    const b = makeDraft({ disagreementAxis: 'fact' });
    expect(createSubmissionFingerprint(a)).not.toBe(createSubmissionFingerprint(b));
  });

  it('includes attachedEvidence in the fingerprint', () => {
    const a = makeDraft({ attachedEvidence: [] });
    const b = makeDraft({
      attachedEvidence: [{ url: 'https://example.com', label: 'Study', sourceText: 'Text' }],
    });
    expect(createSubmissionFingerprint(a)).not.toBe(createSubmissionFingerprint(b));
  });

  it('does not include draftId, updatedAt, or dirty in the fingerprint', () => {
    const base = makeDraft();
    const fp = createSubmissionFingerprint(base);
    expect(fp).not.toContain('draftId');
    expect(fp).not.toContain('updatedAt');
    expect(fp).not.toContain('dirty');
  });
});

// ── shouldReuseClientSubmissionIdForRetry ─────────────────────

describe('shouldReuseClientSubmissionIdForRetry', () => {
  it('returns false when pending is null', () => {
    const fp = createSubmissionFingerprint(makeDraft());
    expect(shouldReuseClientSubmissionIdForRetry(null, fp)).toBe(false);
  });

  it('returns false when status is not failed', () => {
    const draft = makeDraft();
    const fp = createSubmissionFingerprint(draft);
    for (const status of ['queued', 'submitting', 'submitted'] as const) {
      const pending = makePending({ status, submissionFingerprint: fp });
      expect(shouldReuseClientSubmissionIdForRetry(pending, fp)).toBe(false);
    }
  });

  it('returns false when fingerprint does not match', () => {
    const draft = makeDraft();
    const fp = createSubmissionFingerprint(draft);
    const changedFp = createSubmissionFingerprint(makeDraft({ body: 'Totally different.' }));
    const pending = makePending({ status: 'failed', submissionFingerprint: fp });
    expect(shouldReuseClientSubmissionIdForRetry(pending, changedFp)).toBe(false);
  });

  it('returns false when pending has no fingerprint stored', () => {
    const draft = makeDraft();
    const fp = createSubmissionFingerprint(draft);
    const pending = makePending({ status: 'failed', submissionFingerprint: undefined });
    expect(shouldReuseClientSubmissionIdForRetry(pending, fp)).toBe(false);
  });

  it('returns true when status is failed and fingerprint matches', () => {
    const draft = makeDraft();
    const fp = createSubmissionFingerprint(draft);
    const pending = makePending({ status: 'failed', submissionFingerprint: fp });
    expect(shouldReuseClientSubmissionIdForRetry(pending, fp)).toBe(true);
  });
});

// ── getOrCreateClientSubmissionId ─────────────────────────────

describe('getOrCreateClientSubmissionId', () => {
  it('returns the existing ID when retry conditions are met', () => {
    const draft = makeDraft();
    const fp = createSubmissionFingerprint(draft);
    const pending = makePending({ clientSubmissionId: 'uuid-existing', status: 'failed', submissionFingerprint: fp });
    expect(getOrCreateClientSubmissionId(pending, fp)).toBe('uuid-existing');
  });

  it('generates a new UUID when pending is null', () => {
    const fp = createSubmissionFingerprint(makeDraft());
    const id = getOrCreateClientSubmissionId(null, fp);
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('generates a new UUID when fingerprint does not match', () => {
    const draft = makeDraft();
    const fp = createSubmissionFingerprint(draft);
    const changedFp = createSubmissionFingerprint(makeDraft({ body: 'New body content.' }));
    const pending = makePending({ status: 'failed', submissionFingerprint: fp });
    const id = getOrCreateClientSubmissionId(pending, changedFp);
    expect(id).not.toBe('uuid-pending');
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('generates a different UUID on each call when creating fresh', () => {
    const fp = createSubmissionFingerprint(makeDraft());
    const id1 = getOrCreateClientSubmissionId(null, fp);
    const id2 = getOrCreateClientSubmissionId(null, fp);
    expect(id1).not.toBe(id2);
  });
});

// ── buildSubmitArgumentPayload ────────────────────────────────

describe('buildSubmitArgumentPayload', () => {
  const CLIENT_ID = 'client-uuid-123';

  it('maps required fields correctly', () => {
    const draft = makeDraft();
    const payload = buildSubmitArgumentPayload(draft, CLIENT_ID);
    expect(payload.debate_id).toBe('debate-1');
    expect(payload.parent_id).toBeNull();
    expect(payload.argument_type).toBe('thesis');
    expect(payload.side).toBe('affirmative');
    expect(payload.body).toBe('Cats are superior pets.');
    expect(payload.selected_tag_codes).toEqual(['claim', 'fact_based']);
    expect(payload.client_submission_id).toBe(CLIENT_ID);
  });

  it('passes parent_id as a string when set', () => {
    const draft = makeDraft({ parentId: 'arg-parent' });
    const payload = buildSubmitArgumentPayload(draft, CLIENT_ID);
    expect(payload.parent_id).toBe('arg-parent');
  });

  it('omits attached_evidence when array is empty', () => {
    const draft = makeDraft({ attachedEvidence: [] });
    const payload = buildSubmitArgumentPayload(draft, CLIENT_ID);
    expect(payload.attached_evidence).toBeUndefined();
  });

  it('maps attached_evidence snake_case fields', () => {
    const draft = makeDraft({
      attachedEvidence: [{ url: 'https://example.com', label: 'Study', sourceText: 'Cats win.' }],
    });
    const payload = buildSubmitArgumentPayload(draft, CLIENT_ID);
    expect(payload.attached_evidence).toEqual([
      { url: 'https://example.com', label: 'Study', source_text: 'Cats win.' },
    ]);
  });

  it('omits target when both targetExcerpt and disagreementAxis are null', () => {
    const draft = makeDraft({ targetExcerpt: null, disagreementAxis: null });
    const payload = buildSubmitArgumentPayload(draft, CLIENT_ID);
    expect(payload.target).toBeUndefined();
  });

  it('includes target.target_excerpt when set', () => {
    const draft = makeDraft({ targetExcerpt: 'Dogs need constant attention.' });
    const payload = buildSubmitArgumentPayload(draft, CLIENT_ID);
    expect(payload.target?.target_excerpt).toBe('Dogs need constant attention.');
  });

  it('includes target.disagreement_axis when set', () => {
    const draft = makeDraft({ argumentType: 'rebuttal', disagreementAxis: 'fact' });
    const payload = buildSubmitArgumentPayload(draft, CLIENT_ID);
    expect(payload.target?.disagreement_axis).toBe('fact');
  });

  it('does not include author_id, depth, status, or server_validation', () => {
    const draft = makeDraft();
    const payload = buildSubmitArgumentPayload(draft, CLIENT_ID) as unknown as Record<string, unknown>;
    expect(payload['author_id']).toBeUndefined();
    expect(payload['depth']).toBeUndefined();
    expect(payload['status']).toBeUndefined();
    expect(payload['server_validation']).toBeUndefined();
  });
});

// ── #831 cross-room callback payload emission ─────────────────

describe('buildSubmitArgumentPayload — cross-room callback (#831)', () => {
  const CLIENT_ID = 'client-uuid-123';

  it('a callback-less draft emits NO client_validation key (ROOM-003 census guard)', () => {
    const draft = makeDraft();
    const payload = buildSubmitArgumentPayload(draft, CLIENT_ID) as unknown as Record<string, unknown>;
    expect(payload).not.toHaveProperty('client_validation');
  });

  it('a draft with pendingCallback emits client_validation.crossRoomCallback with exactly the ref shape', () => {
    const draft = makeDraft({
      pendingCallback: {
        targetDebateId: 'debate-prior-1',
        targetTitleSnapshot: 'Bike-lane baseline',
        excerpt: 'Protected lanes reduce collisions on arterials.',
        capturedFromArgumentId: 'arg-9',
      },
    });
    const payload = buildSubmitArgumentPayload(draft, CLIENT_ID);
    expect(payload.client_validation).toBeDefined();
    const cv = payload.client_validation as Record<string, unknown>;
    expect(Object.keys(cv)).toEqual(['crossRoomCallback']);
    expect(cv.crossRoomCallback).toEqual({
      targetDebateId: 'debate-prior-1',
      excerpt: 'Protected lanes reduce collisions on arterials.',
      targetTitleSnapshot: 'Bike-lane baseline',
      capturedFromArgumentId: 'arg-9',
      v: 1,
    });
  });

  it('adds no OTHER top-level payload key beyond client_validation for a callback draft', () => {
    const plain = buildSubmitArgumentPayload(makeDraft(), CLIENT_ID);
    const withCallback = buildSubmitArgumentPayload(
      makeDraft({
        pendingCallback: {
          targetDebateId: 'd',
          targetTitleSnapshot: 't',
          excerpt: 'e',
          capturedFromArgumentId: null,
        },
      }),
      CLIENT_ID,
    );
    const extraKeys = Object.keys(withCallback).filter((k) => !(k in plain));
    expect(extraKeys).toEqual(['client_validation']);
  });

  it('createSubmissionFingerprint is byte-identical for a callback-less draft (absent vs explicit undefined)', () => {
    const absent = createSubmissionFingerprint(makeDraft());
    const explicitUndefined = createSubmissionFingerprint(makeDraft({ pendingCallback: undefined }));
    expect(absent).toBe(explicitUndefined);
  });

  it('createSubmissionFingerprint differs once a callback is attached / changed', () => {
    const none = createSubmissionFingerprint(makeDraft());
    const withCb = createSubmissionFingerprint(
      makeDraft({
        pendingCallback: {
          targetDebateId: 'd',
          targetTitleSnapshot: 't',
          excerpt: 'e',
          capturedFromArgumentId: null,
        },
      }),
    );
    const withCb2 = createSubmissionFingerprint(
      makeDraft({
        pendingCallback: {
          targetDebateId: 'd2',
          targetTitleSnapshot: 't',
          excerpt: 'e',
          capturedFromArgumentId: null,
        },
      }),
    );
    expect(withCb).not.toBe(none);
    expect(withCb).not.toBe(withCb2);
  });
});

// ── extractServerValidationError ──────────────────────────────

describe('extractServerValidationError', () => {
  it('joins blockingErrors messages when present', () => {
    const error: SubmitArgumentError = {
      error: 'validation_failed',
      blockingErrors: [
        { ruleCode: 'C-RAIL-001', flagCode: 'too_short', severity: 'blocking', message: 'Body too short.', payload: {} },
        { ruleCode: 'C-RAIL-003', flagCode: 'off_topic', severity: 'blocking', message: 'Off-topic.', payload: {} },
      ],
    };
    expect(extractServerValidationError(error)).toBe('Body too short. Off-topic.');
  });

  it('uses reason when blockingErrors is absent', () => {
    const error: SubmitArgumentError = { error: 'validation_failed', reason: 'Debate is closed.' };
    expect(extractServerValidationError(error)).toBe('Debate is closed.');
  });

  it('falls back to error string when both blockingErrors and reason are absent', () => {
    const error: SubmitArgumentError = { error: 'network_error' };
    expect(extractServerValidationError(error)).toBe('network_error');
  });

  it('prefers blockingErrors over reason', () => {
    const error: SubmitArgumentError = {
      error: 'validation_failed',
      reason: 'Should not use this.',
      blockingErrors: [
        { ruleCode: 'C-RAIL-001', flagCode: 'too_short', severity: 'blocking', message: 'Body too short.', payload: {} },
      ],
    };
    expect(extractServerValidationError(error)).toBe('Body too short.');
  });
});

// ── isIdempotentSuccess ───────────────────────────────────────

describe('isIdempotentSuccess', () => {
  function makeSuccess(idempotent: boolean | undefined): SubmitArgumentSuccess {
    return {
      argument: {},
      tags: [],
      topic_satisfaction_check: {},
      flags: [],
      validation: {
        allowPost: true,
        blockingErrors: [],
        warnings: [],
        normalizedTags: [],
        serverValidationPayload: idempotent !== undefined ? { idempotent } : {},
      },
    };
  }

  it('returns true when serverValidationPayload.idempotent is true', () => {
    expect(isIdempotentSuccess(makeSuccess(true))).toBe(true);
  });

  it('returns false when serverValidationPayload.idempotent is false', () => {
    expect(isIdempotentSuccess(makeSuccess(false))).toBe(false);
  });

  it('returns false when serverValidationPayload.idempotent is absent', () => {
    expect(isIdempotentSuccess(makeSuccess(undefined))).toBe(false);
  });

  it('returns false when serverValidationPayload is absent', () => {
    const data: SubmitArgumentSuccess = {
      argument: {},
      tags: [],
      topic_satisfaction_check: {},
      flags: [],
      validation: {
        allowPost: true,
        blockingErrors: [],
        warnings: [],
        normalizedTags: [],
      },
    };
    expect(isIdempotentSuccess(data)).toBe(false);
  });
});
