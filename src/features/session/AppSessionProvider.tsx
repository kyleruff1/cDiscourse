import React, { createContext, useReducer, useEffect, useRef } from 'react';
import { sessionReducer, INITIAL_SESSION_STATE } from './sessionState';
import type { SessionState, SessionAction } from './sessionState';
import {
  loadSessionSnapshot,
  saveSessionSnapshot,
  clearSessionSnapshot,
} from './sessionStorage';
import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';

// ── Context ───────────────────────────────────────────────────

interface AppSessionContextValue {
  state: SessionState;
  dispatch: React.Dispatch<SessionAction>;
}

export const AppSessionContext = createContext<AppSessionContextValue>({
  state: INITIAL_SESSION_STATE,
  dispatch: () => undefined,
});

// ── Provider ──────────────────────────────────────────────────

interface Props {
  children: React.ReactNode;
}

export function AppSessionProvider({ children }: Props) {
  const [state, dispatch] = useReducer(sessionReducer, INITIAL_SESSION_STATE);
  const lastUserId = useRef<string | null>(null);

  // Boot + auth state listener.
  // INITIAL_SESSION fires once on mount with the stored auth session (or null).
  // Subsequent SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED events are handled here.
  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      dispatch({ type: 'SIGNED_OUT' });
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        void (async () => {
          if (event === 'INITIAL_SESSION') {
            if (!session?.user) {
              dispatch({ type: 'SIGNED_OUT' });
              return;
            }
            const userId = session.user.id;
            lastUserId.current = userId;
            const snapshot = await loadSessionSnapshot(userId);
            if (snapshot?.userId === userId) {
              dispatch({ type: 'SNAPSHOT_RESTORED', snapshot });
            } else {
              dispatch({ type: 'SIGNED_IN', userId });
            }
            return;
          }

          if (event === 'SIGNED_IN' && session?.user) {
            const userId = session.user.id;
            // TOKEN_REFRESHED also fires SIGNED_IN; skip if same user.
            if (userId === lastUserId.current) return;
            const snapshot = await loadSessionSnapshot(userId);
            lastUserId.current = userId;
            if (snapshot?.userId === userId) {
              dispatch({ type: 'SNAPSHOT_RESTORED', snapshot });
            } else {
              dispatch({ type: 'SIGNED_IN', userId });
            }
            return;
          }

          if (event === 'SIGNED_OUT') {
            if (lastUserId.current) {
              await clearSessionSnapshot(lastUserId.current);
            }
            lastUserId.current = null;
            dispatch({ type: 'SIGNED_OUT' });
          }
        })();
      },
    );

    return () => { subscription.unsubscribe(); };
  }, []); // intentional: runs once, dispatch and refs are stable

  // Persist snapshot after every state change that carries user data.
  useEffect(() => {
    const { status, snapshot } = state;
    if (status === 'unconfigured' || status === 'signed_out') return;
    if (!snapshot.userId) return;
    void saveSessionSnapshot(snapshot.userId, snapshot);
  }, [state]);

  return (
    <AppSessionContext.Provider value={{ state, dispatch }}>
      {children}
    </AppSessionContext.Provider>
  );
}
