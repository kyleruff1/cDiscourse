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
  /** Fingerprint of the draft at queue time — used to detect draft changes after a failed submission. */
  submissionFingerprint?: string;
}

/**
 * QOL-038 — the pending-invite-intent slice. Persisted alongside the rest
 * of the snapshot so a user mid-signup who closes the app and returns
 * still resolves to the invited room on the first signed_in state. See
 * `src/features/invites/pendingInviteIntent.ts` for the freshness window
 * and the parser; this is the shape only.
 */
export interface PendingInviteIntentSlice {
  /** The raw invite token. Never logged outside the persisted snapshot. */
  token: string;
  /** ISO-8601 capture time. Drives the 24h freshness drop on read. */
  capturedAt: string;
}

export interface AppSessionSnapshot {
  userId: string | null;
  selectedDebateId: string | null;
  participantSide: string | null;
  viewport: DebateViewport | null;
  activeDraft: ComposerDraftSession | null;
  pendingSubmission: PendingSubmission | null;
  lastSyncAt: string | null;
  /**
   * QOL-038 — the destination invite, captured from the deep link at
   * cold start. Preserved across the SIGNED_OUT → SIGNED_IN transition so
   * the accept-on-first-signed-in trigger can fire when the new account
   * exists. `null` when no invite is in flight.
   */
  pendingInviteIntent: PendingInviteIntentSlice | null;
}
