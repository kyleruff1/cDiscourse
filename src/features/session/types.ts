export type AppSessionStatus =
  | 'unconfigured'
  | 'signed_out'
  | 'signed_in_no_debate'
  | 'debate_selected'
  | 'composing'
  | 'submitting'
  | 'blocked'
  | 'recoverable_error';

export interface DebateViewport {
  debateId: string;
  focusedArgumentId: string | null;
  selectedParentId: string | null;
  /** Cursor for paginated/windowed tree loading (argument id or ISO timestamp). */
  rootCursor: string | null;
  expandedArgumentIds: string[];
  collapsedArgumentIds: string[];
  lastLoadedAt: string | null;
  lastSeenArgumentId: string | null;
}

export interface ComposerDraftSession {
  /** Client-generated uuid. Stable across saves and retries. */
  draftId: string;
  debateId: string;
  parentId: string | null;
  argumentType: string | null;
  side: string | null;
  body: string;
  selectedTagCodes: string[];
  targetExcerpt: string | null;
  disagreementAxis: string | null;
  attachedEvidence: Array<{ url?: string; label?: string; source_text?: string }>;
  updatedAt: string;
  dirty: boolean;
}

export interface PendingSubmission {
  /** UUID sent to the server as client_submission_id for idempotent submit. */
  clientSubmissionId: string;
  draftId: string;
  debateId: string;
  createdAt: string;
  status: 'queued' | 'submitting' | 'submitted' | 'failed';
  lastError: string | null;
}

export interface AppSessionSnapshot {
  userId: string | null;
  selectedDebateId: string | null;
  participantSide: string | null;
  viewport: DebateViewport | null;
  activeDraft: ComposerDraftSession | null;
  pendingSubmission: PendingSubmission | null;
  lastSyncAt: string | null;
}
