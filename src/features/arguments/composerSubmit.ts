/**
 * Pure helpers for the argument submission lifecycle.
 *
 * No React, no network calls — all logic is pure so it can be unit-tested
 * without mocking Supabase or a session context.
 */
import type { ComposerDraft } from './composerState';
import type {
  SubmitArgumentInput,
  SubmitArgumentError,
  SubmitArgumentSuccess,
} from '../../lib/edgeFunctions';
import type { PendingSubmission } from '../session/types';

// ── Fingerprinting ─────────────────────────────────────────────

/**
 * Returns a deterministic string representing the submission-relevant fields
 * of the draft. Used to detect draft changes after a failed submission.
 * Tags are sorted so order changes don't produce a different fingerprint.
 */
export function createSubmissionFingerprint(draft: ComposerDraft): string {
  return JSON.stringify({
    debateId: draft.debateId,
    parentId: draft.parentId,
    argumentType: draft.argumentType,
    side: draft.side,
    body: draft.body,
    selectedTagCodes: [...draft.selectedTagCodes].sort(),
    targetExcerpt: draft.targetExcerpt,
    disagreementAxis: draft.disagreementAxis,
    attachedEvidence: draft.attachedEvidence,
  });
}

// ── Idempotency helpers ────────────────────────────────────────

/**
 * Returns true when the failed pending submission was for the same payload
 * as the current draft — safe to retry with the same clientSubmissionId.
 */
export function shouldReuseClientSubmissionIdForRetry(
  pending: PendingSubmission | null,
  fingerprint: string,
): boolean {
  if (!pending || pending.status !== 'failed') return false;
  return pending.submissionFingerprint === fingerprint;
}

/**
 * Returns the clientSubmissionId to use for this submission attempt.
 * Reuses the existing ID on retry (same payload, failed previously);
 * otherwise generates a fresh UUID.
 */
export function getOrCreateClientSubmissionId(
  pending: PendingSubmission | null,
  fingerprint: string,
): string {
  if (shouldReuseClientSubmissionIdForRetry(pending, fingerprint)) {
    return pending!.clientSubmissionId;
  }
  return crypto.randomUUID();
}

// ── Payload mapping ────────────────────────────────────────────

/**
 * Maps a validated ComposerDraft to the Edge Function payload.
 * MUST NOT include author_id, depth, status, or server_validation —
 * these are assigned authoritatively by the server.
 */
export function buildSubmitArgumentPayload(
  draft: ComposerDraft,
  clientSubmissionId: string,
): SubmitArgumentInput {
  const payload: SubmitArgumentInput = {
    debate_id: draft.debateId,
    parent_id: draft.parentId,
    argument_type: draft.argumentType!,
    side: draft.side!,
    body: draft.body,
    selected_tag_codes: draft.selectedTagCodes,
    client_submission_id: clientSubmissionId,
  };

  if (draft.attachedEvidence.length > 0) {
    payload.attached_evidence = draft.attachedEvidence.map((e) => ({
      url: e.url,
      label: e.label,
      source_text: e.sourceText,
    }));
  }

  const hasTarget = draft.targetExcerpt != null || draft.disagreementAxis != null;
  if (hasTarget) {
    payload.target = {
      target_excerpt: draft.targetExcerpt ?? undefined,
      disagreement_axis: draft.disagreementAxis ?? undefined,
    };
  }

  return payload;
}

// ── Response helpers ───────────────────────────────────────────

/** Extracts a human-readable error message from a failed submit response. */
export function extractServerValidationError(error: SubmitArgumentError): string {
  if (error.blockingErrors && error.blockingErrors.length > 0) {
    return error.blockingErrors.map((e) => e.message).join(' ');
  }
  if (error.reason) return error.reason;
  return error.error;
}

/** Returns true when the server processed this as an idempotent duplicate. */
export function isIdempotentSuccess(data: SubmitArgumentSuccess): boolean {
  const svp = data.validation?.serverValidationPayload;
  return svp?.['idempotent'] === true;
}
