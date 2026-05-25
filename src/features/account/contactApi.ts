/**
 * PR-004 — Contact info client wrapper.
 *
 * Pure validation helpers (testable without Supabase) plus a thin
 * wrapper over `supabase.auth.updateUser({ email })` — the first use
 * of that SDK method in the codebase. The wrapper carries the user's
 * own JWT via the auth SDK; no service-role key is involved.
 *
 * Doctrine:
 *   - Internal codes (`invalid_email`, `same_as_current`, etc.) never
 *     appear in user-facing strings; the consumer maps them via
 *     `messageForContactError`.
 *   - No service-role import. No AI provider import. No console.log.
 *   - Never writes to `public.profiles.email` (no such column exists;
 *     `auth.users.email` is the source of truth). The
 *     `accountApi.buildProfileUpdatePayload` allowlist remains
 *     `display_name` only, defending against any future bypass.
 */
import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';

// ── Types ─────────────────────────────────────────────────────

export type ContactEmailChangeError =
  | 'config_missing'
  | 'no_session'
  | 'invalid_email'
  | 'same_as_current'
  | 'email_already_used'
  | 'rate_limited'
  | 'network_error'
  | 'unknown';

export interface PendingEmailChange {
  /** The email the user submitted (NEW address — not yet verified). */
  newEmail: string;
  /** Local-only timestamp. Display "Verification pending — {newEmail}". */
  submittedAt: string;
}

export type ContactApiResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: ContactEmailChangeError; message: string };

// ── Pure helpers (testable without Supabase) ──────────────────

/**
 * Returns ok or `invalid_email`. Pure. Not a full RFC parser — a
 * defensive minimum-viable shape check. Supabase's auth backend
 * re-validates on the server (the trust boundary).
 */
export function validateEmail(
  input: unknown,
): { ok: true } | { ok: false; error: 'invalid_email' } {
  const e = (typeof input === 'string' ? input : '').trim();
  if (e.length < 5) return { ok: false, error: 'invalid_email' };
  if (e.length > 254) return { ok: false, error: 'invalid_email' }; // RFC 5321 hard limit
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return { ok: false, error: 'invalid_email' };
  return { ok: true };
}

/**
 * Plain-language message for an error code. Internal codes NEVER leak
 * into the returned strings (the doctrine ban-list scan in
 * __tests__/contactDoctrine.test.ts asserts this).
 */
export function messageForContactError(code: ContactEmailChangeError): string {
  switch (code) {
    case 'invalid_email':
      return 'Enter a valid email address.';
    case 'same_as_current':
      return "That's already your email address.";
    case 'email_already_used':
      return 'Another account is already using that email.';
    case 'rate_limited':
      return 'Too many email change attempts. Try again in a few minutes.';
    case 'network_error':
      return 'Network error. Check your connection.';
    case 'no_session':
      return 'Please sign in again.';
    case 'config_missing':
      return 'Supabase is not configured.';
    case 'unknown':
    default:
      return 'Something went wrong. Try again.';
  }
}

// ── Internal helpers ──────────────────────────────────────────

/** Map a Supabase auth error message to a ContactEmailChangeError. */
function mapAuthErrorMessage(message: string): ContactEmailChangeError {
  const lower = message.toLowerCase();
  if (lower.includes('already registered') || lower.includes('already in use')) {
    return 'email_already_used';
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'rate_limited';
  }
  if (lower.includes('fetch') || lower.includes('network') || lower.includes('failed to fetch')) {
    return 'network_error';
  }
  return 'unknown';
}

// ── Public API ────────────────────────────────────────────────

/**
 * Calls `supabase.auth.updateUser({ email })`. The session keeps the
 * OLD email until the user clicks the verification link in the NEW
 * inbox AND the auth session refreshes (via onAuthStateChange).
 *
 * Behaviour:
 * - Short-circuits with `same_as_current` (case-insensitive compare)
 *   if the new email equals the current session's email; no Supabase
 *   call is made.
 * - Returns `no_session` if the user has no active Supabase session.
 * - Returns `invalid_email` if the client-side shape check fails.
 * - Maps Supabase auth-SDK error messages to plain-language codes via
 *   `mapAuthErrorMessage`.
 */
export async function requestEmailChange(
  newEmail: string,
): Promise<ContactApiResult<PendingEmailChange>> {
  if (!SUPABASE_CONFIGURED) {
    return {
      ok: false,
      error: 'config_missing',
      message: messageForContactError('config_missing'),
    };
  }

  const validation = validateEmail(newEmail);
  if (!validation.ok) {
    return {
      ok: false,
      error: 'invalid_email',
      message: messageForContactError('invalid_email'),
    };
  }

  // Resolve current session + current email. No raw email is logged.
  const sessionResult = await supabase.auth.getSession();
  if (!sessionResult.data?.session) {
    return {
      ok: false,
      error: 'no_session',
      message: messageForContactError('no_session'),
    };
  }

  const userResult = await supabase.auth.getUser();
  const currentEmail = userResult.data?.user?.email ?? null;
  const trimmedNew = newEmail.trim();
  if (currentEmail && currentEmail.toLowerCase() === trimmedNew.toLowerCase()) {
    return {
      ok: false,
      error: 'same_as_current',
      message: messageForContactError('same_as_current'),
    };
  }

  // Call Supabase auth — the SDK handles the verification email send.
  let updateResult: Awaited<ReturnType<typeof supabase.auth.updateUser>>;
  try {
    updateResult = await supabase.auth.updateUser({ email: trimmedNew });
  } catch {
    return {
      ok: false,
      error: 'network_error',
      message: messageForContactError('network_error'),
    };
  }

  if (updateResult.error) {
    const code = mapAuthErrorMessage(updateResult.error.message ?? '');
    return { ok: false, error: code, message: messageForContactError(code) };
  }

  return {
    ok: true,
    data: {
      newEmail: trimmedNew,
      submittedAt: new Date().toISOString(),
    },
  };
}
