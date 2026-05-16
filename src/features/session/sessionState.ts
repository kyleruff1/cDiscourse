import type {
  AppSessionStatus,
  AppSessionSnapshot,
  DebateViewport,
  ComposerDraftSession,
  PendingSubmission,
} from './types';

export interface SessionState {
  status: AppSessionStatus;
  snapshot: AppSessionSnapshot;
}

export const INITIAL_SESSION_STATE: SessionState = {
  status: 'unconfigured',
  snapshot: {
    userId: null,
    selectedDebateId: null,
    participantSide: null,
    viewport: null,
    activeDraft: null,
    pendingSubmission: null,
    lastSyncAt: null,
  },
};

export type SessionAction =
  | { type: 'SIGNED_IN'; userId: string }
  | { type: 'SIGNED_OUT' }
  | { type: 'DEBATE_SELECTED'; debateId: string; participantSide: string | null }
  | { type: 'VIEWPORT_UPDATED'; viewport: DebateViewport }
  | { type: 'DRAFT_STARTED'; draft: ComposerDraftSession }
  | { type: 'DRAFT_UPDATED'; patch: Partial<ComposerDraftSession> }
  | { type: 'DRAFT_CLEARED' }
  | { type: 'SUBMISSION_QUEUED'; submission: PendingSubmission }
  | { type: 'SUBMISSION_STARTED'; clientSubmissionId: string }
  | { type: 'SUBMISSION_SUCCEEDED'; clientSubmissionId: string }
  | { type: 'SUBMISSION_FAILED'; clientSubmissionId: string; error: string }
  | { type: 'SNAPSHOT_RESTORED'; snapshot: AppSessionSnapshot }
  | { type: 'ERROR_CLEARED' };

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'SIGNED_IN':
      return {
        status: 'signed_in_no_debate',
        snapshot: {
          ...state.snapshot,
          userId: action.userId,
          selectedDebateId: null,
          viewport: null,
          activeDraft: null,
          pendingSubmission: null,
        },
      };

    case 'SIGNED_OUT':
      return {
        status: 'signed_out',
        snapshot: {
          userId: null,
          selectedDebateId: null,
          participantSide: null,
          viewport: null,
          activeDraft: null,
          pendingSubmission: null,
          lastSyncAt: null,
        },
      };

    case 'DEBATE_SELECTED':
      return {
        status: 'debate_selected',
        snapshot: {
          ...state.snapshot,
          selectedDebateId: action.debateId,
          participantSide: action.participantSide,
          viewport: null,
          activeDraft: null,
        },
      };

    case 'VIEWPORT_UPDATED':
      return {
        ...state,
        snapshot: { ...state.snapshot, viewport: action.viewport },
      };

    case 'DRAFT_STARTED':
      return {
        status: 'composing',
        snapshot: { ...state.snapshot, activeDraft: action.draft },
      };

    case 'DRAFT_UPDATED': {
      if (!state.snapshot.activeDraft) return state;
      return {
        ...state,
        snapshot: {
          ...state.snapshot,
          activeDraft: {
            ...state.snapshot.activeDraft,
            ...action.patch,
            dirty: true,
          },
        },
      };
    }

    case 'DRAFT_CLEARED':
      return {
        status: state.snapshot.selectedDebateId ? 'debate_selected' : 'signed_in_no_debate',
        snapshot: { ...state.snapshot, activeDraft: null },
      };

    case 'SUBMISSION_QUEUED':
      return {
        status: 'submitting',
        snapshot: { ...state.snapshot, pendingSubmission: action.submission },
      };

    case 'SUBMISSION_STARTED': {
      const p = state.snapshot.pendingSubmission;
      if (!p || p.clientSubmissionId !== action.clientSubmissionId) return state;
      return {
        status: 'submitting',
        snapshot: { ...state.snapshot, pendingSubmission: { ...p, status: 'submitting' } },
      };
    }

    case 'SUBMISSION_SUCCEEDED': {
      const p = state.snapshot.pendingSubmission;
      return {
        status: state.snapshot.selectedDebateId ? 'debate_selected' : 'signed_in_no_debate',
        snapshot: {
          ...state.snapshot,
          activeDraft: null,
          pendingSubmission: p ? { ...p, status: 'submitted' } : null,
          lastSyncAt: new Date().toISOString(),
        },
      };
    }

    case 'SUBMISSION_FAILED': {
      const p = state.snapshot.pendingSubmission;
      return {
        status: 'recoverable_error',
        snapshot: {
          ...state.snapshot,
          pendingSubmission: p
            ? { ...p, status: 'failed', lastError: action.error }
            : null,
        },
      };
    }

    case 'SNAPSHOT_RESTORED':
      return {
        status: resolveStatusFromSnapshot(action.snapshot),
        snapshot: action.snapshot,
      };

    case 'ERROR_CLEARED':
      return {
        status: state.snapshot.selectedDebateId ? 'debate_selected' : 'signed_in_no_debate',
        snapshot: {
          ...state.snapshot,
          pendingSubmission: state.snapshot.pendingSubmission
            ? { ...state.snapshot.pendingSubmission, status: 'queued', lastError: null }
            : null,
        },
      };

    default:
      return state;
  }
}

function resolveStatusFromSnapshot(snapshot: AppSessionSnapshot): AppSessionStatus {
  if (!snapshot.userId) return 'signed_out';
  if (!snapshot.selectedDebateId) return 'signed_in_no_debate';
  // A pending submission that did not cleanly reach 'submitted' is recoverable.
  if (
    snapshot.pendingSubmission?.status === 'failed' ||
    snapshot.pendingSubmission?.status === 'queued' ||
    snapshot.pendingSubmission?.status === 'submitting'
  ) {
    return 'recoverable_error';
  }
  if (snapshot.activeDraft) return 'composing';
  return 'debate_selected';
}
