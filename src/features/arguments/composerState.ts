import type { ArgumentType, ArgumentSide, DisagreementAxis } from './types';
import type { ComposerDraftSession } from '../session/types';

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
    updatedAt: session.updatedAt,
    dirty: session.dirty,
  };
}
