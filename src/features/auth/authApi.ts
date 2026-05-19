import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';
import { buildAuthRedirectUrl } from '../../lib/auth/buildAuthRedirectUrl';
import type { AuthRedirectKind } from '../../lib/auth/buildAuthRedirectUrl';
import { resolveRuntimeOrigin, getIsDev } from '../../lib/auth/resolveRuntimeOrigin';
import type { AuthUser, AuthError, AuthResult } from './types';

/**
 * Plain-language copy shown when the auth redirect URL could not be safely
 * constructed (`redirect_invalid`). Verdict-free, no internal code, no
 * snake_case — never surface `invalid_auth_redirect_origin` to a user.
 */
export const REDIRECT_INVALID_MESSAGE =
  "We couldn't open that link. Try again or contact an admin.";

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
  if (lower.includes('invalid_auth_redirect_origin') || lower.includes('redirect origin rejected')) {
    return 'redirect_invalid';
  }
  return 'unknown';
}

/**
 * Build an auth redirect URL, degrading to `null` on any failure.
 *
 * QOL-023 doctrine: a bad runtime origin must NEVER block a user from signing
 * up or resetting a password. When buildAuthRedirectUrl throws
 * InvalidAuthRedirectOrigin, this returns `null` and the caller omits
 * `emailRedirectTo` / `redirectTo` — Supabase then falls back to the dashboard
 * Site URL. A redirect-config defect is advisory, not a hard gate.
 */
function safeBuildRedirect(kind: AuthRedirectKind): string | null {
  try {
    return buildAuthRedirectUrl({
      kind,
      runtimeOrigin: resolveRuntimeOrigin(),
      isDev: getIsDev(),
    });
  } catch {
    return null;
  }
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

  // QOL-023: point the confirmation email at the deployed origin, not the
  // dashboard Site URL (localhost). A bad origin degrades to `undefined` so
  // Supabase falls back to the Site URL — it never blocks signup.
  const redirectTo = safeBuildRedirect('confirm_signup');
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName ?? '' },
      emailRedirectTo: redirectTo ?? undefined,
    },
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

/**
 * Send a password-reset email. QOL-023 — new minimal wrapper around
 * `supabase.auth.resetPasswordForEmail`. The reset link points at the deployed
 * origin's `/auth/reset` route via buildAuthRedirectUrl; a bad origin degrades
 * to the dashboard Site URL rather than blocking the reset.
 */
export async function sendPasswordResetEmail(email: string): Promise<AuthResult> {
  if (!SUPABASE_CONFIGURED) {
    return {
      ok: false,
      error: 'config_missing',
      message: 'Supabase is not configured. Copy .env.example to .env and fill in your project URL and anon key.',
    };
  }

  const redirectTo = safeBuildRedirect('password_reset');
  const { error } = await supabase.auth.resetPasswordForEmail(
    email,
    redirectTo ? { redirectTo } : undefined,
  );

  if (error) {
    return { ok: false, error: mapAuthError(error.message), message: error.message };
  }

  return { ok: true };
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
