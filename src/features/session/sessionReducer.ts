// Re-exports the session reducer and initial state from sessionState.ts.
// Import from this file when you want "the reducer" without the storage helpers.
export { sessionReducer, INITIAL_SESSION_STATE } from './sessionState';
export type { SessionState, SessionAction } from './sessionState';
