import { useState, useCallback } from 'react';
import { signInWithEmailPassword, signUpWithEmailPassword, signOut } from './authApi';
import type { AuthResult, AuthUser } from './types';

interface AuthSessionHookState {
  loading: boolean;
  error: string | null;
}

export function useAuthSession() {
  const [hookState, setHookState] = useState<AuthSessionHookState>({
    loading: false,
    error: null,
  });

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult<AuthUser>> => {
      setHookState({ loading: true, error: null });
      const result = await signInWithEmailPassword(email, password);
      setHookState({
        loading: false,
        error: result.ok ? null : (result.message ?? 'Sign in failed.'),
      });
      return result;
    },
    [],
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      displayName?: string,
    ): Promise<AuthResult<AuthUser>> => {
      setHookState({ loading: true, error: null });
      const result = await signUpWithEmailPassword(email, password, displayName);
      setHookState({
        loading: false,
        error: result.ok ? null : (result.message ?? 'Sign up failed.'),
      });
      return result;
    },
    [],
  );

  const doSignOut = useCallback(async (): Promise<AuthResult> => {
    setHookState({ loading: true, error: null });
    const result = await signOut();
    setHookState({
      loading: false,
      error: result.ok ? null : (result.message ?? 'Sign out failed.'),
    });
    return result;
  }, []);

  const clearError = useCallback(() => {
    setHookState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    loading: hookState.loading,
    error: hookState.error,
    signIn,
    signUp,
    signOut: doSignOut,
    clearError,
  };
}
