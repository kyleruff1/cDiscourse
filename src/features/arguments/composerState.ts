import type { ArgumentType, ArgumentSide, DisagreementAxis } from './types';
import type { ComposerDraftSession } from '../session/types';
import type { CrossRoomCallback } from './crossRoom/crossRoomCallbackRef';

export interface EvidenceAttachmentLocal {
  url?: string;
  label?: string;
  sourceText?: string;
}

/** Strictly-typed draft used internally by the composer feature. */
export interface ComposerDraft {
  draftId: string;
  debateId: string;
  parentId: string | null;
  argumentType: ArgumentType | null;
  side: ArgumentSide | null;
  body: string;
  selectedTagCodes: string[];
  targetExcerpt: string | null;
  disagreementAxis: DisagreementAxis | null;
  attachedEvidence: EvidenceAttachmentLocal[];
  /**
   * UX-COMPOSER-005 (#831) — the pending cross-room callback woven into this
   * draft. OPTIONAL so existing fixtures / drafts that omit it still type-check
   * and round-trip byte-identically (an absent / null value emits no session
   * key and no submit payload key). null / absent = no callback.
   */
  pendingCallback?: CrossRoomCallback | null;
  updatedAt: string;
  dirty: boolean;
}

/** Maps a ComposerDraft to the session-serialized shape. */
export function draftToSession(draft: ComposerDraft): ComposerDraftSession {
  return {
    draftId: draft.draftId,
    debateId: draft.debateId,
    parentId: draft.parentId,
    argumentType: draft.argumentType,
    side: draft.side,
    body: draft.body,
    selectedTagCodes: draft.selectedTagCodes,
    targetExcerpt: draft.targetExcerpt,
    disagreementAxis: draft.disagreementAxis,
    attachedEvidence: draft.attachedEvidence.map((e) => ({
      url: e.url,
      label: e.label,
      source_text: e.sourceText,
    })),
    // Conditional spread so a callback-less draft serializes byte-identically
    // to the pre-#831 session shape (no pendingCallback key emitted).
    ...(draft.pendingCallback ? { pendingCallback: draft.pendingCallback } : {}),
    updatedAt: draft.updatedAt,
    dirty: draft.dirty,
  };
}

/** Restores a ComposerDraft from the session-serialized shape. */
export function sessionToDraft(session: ComposerDraftSession): ComposerDraft {
  return {
    draftId: session.draftId,
    debateId: session.debateId,
    parentId: session.parentId,
    argumentType: session.argumentType as ArgumentType | null,
    side: session.side as ArgumentSide | null,
    body: session.body,
    selectedTagCodes: session.selectedTagCodes ?? [],
    targetExcerpt: session.targetExcerpt,
    disagreementAxis: session.disagreementAxis as DisagreementAxis | null,
    attachedEvidence: (session.attachedEvidence ?? []).map((e) => ({
      url: e.url,
      label: e.label,
      sourceText: e.source_text,
    })),
    pendingCallback: session.pendingCallback ?? null,
    updatedAt: session.updatedAt,
    dirty: session.dirty,
  };
}
