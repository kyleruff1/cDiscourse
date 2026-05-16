import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';
import type { AuthUser, AuthError, AuthResult } from './types';

// ── Validation ────────────────────────────────────────────────

/**
 * Returns a user-facing error string or null if the input is valid.
 * Pure function — no network calls, safe to test without Supabase.
 */
export function validateAuthInput(email: string, password: string): string | null {
  if (!email.includes('@') || email.length < 5) return 'Enter a valid email address.';
  if (password.length < 6) return 'Password must be at least 6 characters.';
  return null;
}

// ── Error mapping ─────────────────────────────────────────────

function mapAuthError(message: string): AuthError {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login') || lower.includes('invalid credentials')) {
    return 'invalid_credentials';
  }
  if (lower.includes('email not confirmed')) return 'email_not_confirmed';
  if (lower.includes('already registered') || lower.includes('user already registered')) {
    return 'email_already_used';
  }
  if (lower.includes('password should be at least') || lower.includes('weak password')) {
    return 'weak_password';
  }
  if (lower.includes('fetch') || lower.includes('network') || lower.includes('failed to fetch')) {
    return 'network_error';
  }
  return 'unknown';
}

// ── Auth API ──────────────────────────────────────────────────

export async function signUpWithEmailPassword(
  email: string,
  password: string,
  displayName?: string,
): Promise<AuthResult<AuthUser>> {
  if (!SUPABASE_CONFIGURED) {
    return {
      ok: false,
      error: 'config_missing',
      message: 'Supabase is not configured. Copy .env.example to .env and fill in your project URL and anon key.',
    };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName ?? '' } },
  });

  if (error) {
    return { ok: false, error: mapAuthError(error.message), message: error.message };
  }

  if (!data.user) {
    return { ok: false, error: 'unknown', message: 'No user returned from sign up.' };
  }

  return {
    ok: true,
    data: { id: data.user.id, email: data.user.email ?? null },
  };
}

export async function signInWithEmailPassword(
  email: string,
  password: string,
): Promise<AuthResult<AuthUser>> {
  if (!SUPABASE_CONFIGURED) {
    return {
      ok: false,
      error: 'config_missing',
      message: 'Supabase is not configured. Copy .env.example to .env and fill in your project URL and anon key.',
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { ok: false, error: mapAuthError(error.message), message: error.message };
  }

  if (!data.user) {
    return { ok: false, error: 'unknown', message: 'No user returned from sign in.' };
  }

  return {
    ok: true,
    data: { id: data.user.id, email: data.user.email ?? null },
  };
}

export async function signOut(): Promise<AuthResult> {
  if (!SUPABASE_CONFIGURED) {
    return { ok: true }; // nothing to sign out of
  }

  const { error } = await supabase.auth.signOut();

  if (error) {
    return { ok: false, error: mapAuthError(error.message), message: error.message };
  }

  return { ok: true };
}

export async function getCurrentSession(): Promise<Session | null> {
  if (!SUPABASE_CONFIGURED) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Subscribe to auth state changes. Returns an unsubscribe function. */
export function subscribeToAuthChanges(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): () => void {
  if (!SUPABASE_CONFIGURED) return () => undefined;
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
  return () => { subscription.unsubscribe(); };
}
