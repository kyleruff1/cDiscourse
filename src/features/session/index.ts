export type {
  AppSessionStatus,
  DebateViewport,
  ComposerDraftSession,
  PendingSubmission,
  AppSessionSnapshot,
  // QOL-038 — exported so feature code outside session/ can type the slice.
  PendingInviteIntentSlice,
} from './types';

export { INITIAL_SESSION_STATE, sessionReducer } from './sessionState';
export type { SessionState, SessionAction } from './sessionState';

export { sessionSnapshotKey, anonymousSessionKey, draftKey, draftIndexKey } from './sessionKeys';

export {
  loadSessionSnapshot,
  saveSessionSnapshot,
  clearSessionSnapshot,
  loadDraft,
  saveDraft,
  deleteDraft,
  listDraftKeysForDebate,
} from './sessionStorage';
