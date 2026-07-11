import type { ComposerDraft, EvidenceAttachmentLocal } from './composerState';
import type { ComposerDraftSession, PendingSubmission } from '../session/types';
import { draftKey } from '../session/sessionKeys';
import type { ArgumentType } from './types';
import type { ConstitutionRule, ConstitutionTagDef } from '../../domain/constitution/types';
import { getAllowedReplies } from '../../domain/constitution';

// ── Identity ──────────────────────────────────────────────────

export function createDraftId(): string {
  return crypto.randomUUID();
}

export function createClientSubmissionId(): string {
  return crypto.randomUUID();
}

// ── Draft lifecycle ────────────────────────────────────────────

export interface CreateEmptyDraftInput {
  debateId: string;
  parentId?: string | null;
}

export function createEmptyDraft(input: CreateEmptyDraftInput): ComposerDraft {
  return {
    draftId: createDraftId(),
    debateId: input.debateId,
    parentId: input.parentId ?? null,
    argumentType: null,
    side: null,
    body: '',
    selectedTagCodes: [],
    targetExcerpt: null,
    disagreementAxis: null,
    attachedEvidence: [],
    pendingCallback: null,
    updatedAt: new Date().toISOString(),
    dirty: false,
  };
}

export function updateDraftField(
  draft: ComposerDraft,
  patch: Partial<Omit<ComposerDraft, 'draftId' | 'debateId' | 'dirty' | 'updatedAt'>>,
): ComposerDraft {
  return {
    ...draft,
    ...patch,
    updatedAt: new Date().toISOString(),
    dirty: true,
  };
}

// ── Validation shape ───────────────────────────────────────────

/** Returns true if the draft has the minimum fields needed to attempt submission. */
export function isDraftSubmittableShape(draft: ComposerDraft): boolean {
  return (
    draft.argumentType !== null &&
    draft.side !== null &&
    draft.body.trim().length > 0
  );
}

// ── Submission id management ───────────────────────────────────

/**
 * Returns true when a failed pending submission should be reused on retry
 * rather than generating a new clientSubmissionId.
 * Only true when: the submission failed, the draftId is unchanged, and the
 * body/type/side/parentId have not changed since the failed attempt.
 */
export function shouldReusePendingSubmission(
  existing: PendingSubmission | null,
  draft: ComposerDraft,
): boolean {
  if (!existing) return false;
  if (existing.status !== 'failed') return false;
  if (existing.draftId !== draft.draftId) return false;
  return true;
}

/**
 * Returns true when the draft content has changed enough that a new
 * clientSubmissionId must be generated before attempting submission.
 * A reused ID on changed content would return a stale idempotent result.
 */
export function shouldCreateNewClientSubmissionId(
  previousDraft: ComposerDraft,
  nextDraft: ComposerDraft,
): boolean {
  return (
    previousDraft.body !== nextDraft.body ||
    previousDraft.argumentType !== nextDraft.argumentType ||
    previousDraft.side !== nextDraft.side ||
    previousDraft.parentId !== nextDraft.parentId
  );
}

// ── Storage key ────────────────────────────────────────────────

/**
 * Returns the AsyncStorage key for a specific draft.
 * Scoped to userId so drafts cannot leak across accounts.
 * debateId is tracked via the draft-index key (see sessionKeys.ts).
 */
export function getDraftStorageKey(userId: string, draftId: string): string {
  return draftKey(userId, draftId);
}

// ── Evidence normalization ─────────────────────────────────────

/** Strips evidence entries that contain no useful content. */
export function normalizeAttachedEvidence(
  raw: Array<{ url?: string; label?: string; sourceText?: string }>,
): EvidenceAttachmentLocal[] {
  return raw.filter(
    (e) =>
      (e.url ?? '').trim() !== '' ||
      (e.label ?? '').trim() !== '' ||
      (e.sourceText ?? '').trim() !== '',
  );
}

// ── Draft restoration ──────────────────────────────────────────

/**
 * Returns true if the existing session draft should be restored for this debate,
 * rather than creating a fresh one. A debateId mismatch means the draft
 * belongs to a different debate and must not be restored.
 */
export function shouldRestoreDraft(
  existing: ComposerDraftSession | null,
  debateId: string,
): boolean {
  if (!existing) return false;
  return existing.debateId === debateId;
}

/**
 * Returns true if changing the reply target (clearing parentId) is safe
 * without requiring the user to explicitly discard their draft.
 * A dirty draft has user-authored content that would be silently lost.
 */
export function canClearParentWithoutConfirm(draft: ComposerDraft): boolean {
  return !draft.dirty;
}

// ── Type and tag filtering ─────────────────────────────────────

/**
 * Returns the argument types a user may select for a new argument, given
 * the parent's type (or null for root-level posts).
 */
export function getAllowedArgumentTypesForParent(
  parentType: ArgumentType | null,
  rules: ConstitutionRule[],
): ArgumentType[] {
  if (parentType === null) {
    const rootRule = rules.find((r) => r.code === 'root_type_allowed' && r.enabled);
    const allowed =
      (rootRule?.params['allowedRootTypes'] as string[] | undefined) ?? ['thesis', 'claim'];
    return allowed as ArgumentType[];
  }
  return getAllowedReplies(parentType, rules);
}

/**
 * Returns the tag definitions that are valid for the given argument type.
 * Tags with an empty allowedArgumentTypes array are valid for all types.
 */
export function getTagDefsForArgumentType(
  argumentType: ArgumentType,
  tagDefs: ConstitutionTagDef[],
): ConstitutionTagDef[] {
  return tagDefs.filter(
    (td) =>
      td.enabled &&
      (td.allowedArgumentTypes.length === 0 || td.allowedArgumentTypes.includes(argumentType)),
  );
}
