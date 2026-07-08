/**
 * ROOM-003 (#829) — fast-path submit hook for ArgumentEntryComposer.
 *
 * Duplicates the session-dispatch sequence of ArgumentComposer.handleSubmit
 * (lines 249-291) WITHOUT editing that pinned file. The duplication is the
 * session dispatch only; the network PAYLOAD is produced by the SAME shipped
 * pure buildSubmitArgumentPayload, so the wire shape cannot drift from the
 * dock composer (the byte-shape contract test is the guard). Reuses every
 * shipped pure helper (createSubmissionFingerprint, getOrCreateClientSubmissionId,
 * buildSubmitArgumentPayload, extractServerValidationError) and the same
 * dispatch order (QUEUED then STARTED then submit then SUCCEEDED/FAILED).
 *
 * Comments apostrophe-free (doctrine-scanner quote-parity gotcha).
 */
import { useState, useCallback } from 'react';
import { useAppSession } from '../../session/useAppSession';
import { deleteDraft } from '../../session/sessionStorage';
import { submitArgumentDraft } from '../../../lib/edgeFunctions';
import {
  buildSubmitArgumentPayload,
  createSubmissionFingerprint,
  getOrCreateClientSubmissionId,
  extractServerValidationError,
} from '../composerSubmit';
import type { ComposerDraft } from '../composerState';
import type { PendingSubmission } from '../../session/types';

export interface UseEntryComposerSubmitResult {
  /** Builds the payload via buildSubmitArgumentPayload and posts it. */
  submit: (draft: ComposerDraft) => Promise<void>;
  isSubmitting: boolean;
  serverErrors: string[] | null;
}

export function useEntryComposerSubmit(onSubmitSuccess: () => void): UseEntryComposerSubmitResult {
  const { state, dispatch } = useAppSession();
  const userId = state.snapshot.userId;
  const pendingSubmission = state.snapshot.pendingSubmission;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState<string[] | null>(null);

  const submit = useCallback(
    async (draft: ComposerDraft) => {
      if (!draft || !draft.argumentType || !draft.side) return;
      if (isSubmitting) return;

      const fingerprint = createSubmissionFingerprint(draft);
      const clientSubmissionId = getOrCreateClientSubmissionId(pendingSubmission, fingerprint);

      const submission: PendingSubmission = {
        clientSubmissionId,
        draftId: draft.draftId,
        debateId: draft.debateId,
        createdAt: new Date().toISOString(),
        status: 'queued',
        lastError: null,
        submissionFingerprint: fingerprint,
      };

      dispatch({ type: 'SUBMISSION_QUEUED', submission });
      dispatch({ type: 'SUBMISSION_STARTED', clientSubmissionId });
      setIsSubmitting(true);
      setServerErrors(null);

      const payload = buildSubmitArgumentPayload(draft, clientSubmissionId);
      const result = await submitArgumentDraft(payload);

      if (result.ok) {
        dispatch({ type: 'SUBMISSION_SUCCEEDED', clientSubmissionId });
        dispatch({ type: 'DRAFT_CLEARED' });
        if (userId) {
          void deleteDraft(userId, draft.draftId, draft.debateId);
        }
        onSubmitSuccess();
      } else {
        const errorMsg = extractServerValidationError(result.error);
        dispatch({ type: 'SUBMISSION_FAILED', clientSubmissionId, error: errorMsg });
        setIsSubmitting(false);
        if (result.error.blockingErrors && result.error.blockingErrors.length > 0) {
          setServerErrors(result.error.blockingErrors.map((e) => e.message));
        } else {
          setServerErrors([errorMsg]);
        }
      }
    },
    [dispatch, isSubmitting, onSubmitSuccess, pendingSubmission, userId],
  );

  return { submit, isSubmitting, serverErrors };
}
