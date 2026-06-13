// AUTH-CALLBACK-CONSUMER-001 — turn a parsed callback into an app session.
//
// The ONLY side effect is the **injected** auth-client call. This module does
// not import the `supabase` singleton, does not touch `window` / `process`,
// and performs no `fetch` of its own — the production caller
// (AuthCallbackScreen) passes `supabase.auth`, and tests pass a mock. That
// keeps the consumer deterministic and unit-testable, and guarantees the only
// network it can ever cause is a Supabase auth call.
//
// Doctrine:
//  - No token value is logged. The function returns only outcome classes.
//  - `needs_password` is returned for exactly ONE flow — `type=invite` — the
//    passwordless flow Supabase creates via `inviteUserByEmail`. `signup`
//    (already has a password), `magiclink`, `email_change`, and a missing
//    `type` all return `success`. (`recovery` is future-scoped via
//    `/auth/reset`.) This is a rule, not a bug — see isInvite below.

import type { AuthCallbackFlowType, AuthCallbackParsed } from '../../lib/auth/parseAuthCallbackUrl';

/** Plain, non-secret reason classes → drive which plain copy the screen shows. */
export type AuthCallbackErrorReason =
  | 'expired' // otp_expired / link reused → "may have expired"
  | 'link_invalid' // unsupported / malformed / empty-with-no-session
  | 'network' // fetch failure during the injected client call
  | 'config_missing' // SUPABASE_CONFIGURED === false (produced by the screen)
  | 'unknown';

/** The four outcomes of consuming a callback. */
export type AuthCallbackOutcome =
  | { status: 'success' } // session established; no password step needed
  | { status: 'needs_password' } // session established; invited user must set one
  | { status: 'already_session' } // a live session already existed (idempotent re-entry)
  | { status: 'error'; reason: AuthCallbackErrorReason };

/**
 * Minimal structural client. `supabase.auth` is assignable to this — only the
 * three methods the consumer uses are declared, so tests can inject a mock
 * without reconstructing the whole GoTrue surface.
 */
export interface AuthCallbackClient {
  getSession(): Promise<{ data: { session: unknown | null }; error: { message: string } | null }>;
  setSession(tokens: {
    access_token: string;
    refresh_token: string;
  }): Promise<{ data: { session: unknown | null }; error: { message: string } | null }>;
  exchangeCodeForSession(
    authCode: string,
  ): Promise<{ data: { session: unknown | null }; error: { message: string } | null }>;
}

/** Only `invite` is passwordless → only `invite` forces a set-password step. */
function isInvite(type: AuthCallbackFlowType | null): boolean {
  return type === 'invite';
}

/**
 * Map a Supabase auth error message to a non-secret reason class. The message
 * itself is never surfaced verbatim — only the class drives plain copy.
 */
function mapConsumeError(message: string | null | undefined): AuthCallbackErrorReason {
  const lower = (message ?? '').toLowerCase();
  if (lower.includes('fetch') || lower.includes('network')) return 'network';
  if (
    lower.includes('expired') ||
    lower.includes('invalid') ||
    lower.includes('already') ||
    lower.includes('used')
  ) {
    return 'expired';
  }
  return 'unknown';
}

/**
 * Consume a parsed callback. Deterministic; the only network is the injected
 * client call. Never throws — a rejected client promise is caught and mapped
 * to a `network` error.
 */
export async function consumeAuthCallback(input: {
  client: AuthCallbackClient;
  parsed: AuthCallbackParsed;
}): Promise<AuthCallbackOutcome> {
  const { client, parsed } = input;

  // 1. error — no client call; recoverable → expired copy, else link_invalid.
  if (parsed.kind === 'error') {
    return { status: 'error', reason: parsed.recoverable ? 'expired' : 'link_invalid' };
  }

  // 3. unsupported — diagnostics still record `parsed.reason`; the user sees a
  //    plain link-state message. No client call.
  if (parsed.kind === 'unsupported') {
    return { status: 'error', reason: 'link_invalid' };
  }

  // 2. empty — probe for a pre-existing live session (idempotent re-entry,
  //    e.g. a refresh after a successful consume cleared the URL).
  if (parsed.kind === 'empty') {
    try {
      const { data, error } = await client.getSession();
      if (error) return { status: 'error', reason: mapConsumeError(error.message) };
      return data?.session
        ? { status: 'already_session' }
        : { status: 'error', reason: 'link_invalid' };
    } catch {
      return { status: 'error', reason: 'network' };
    }
  }

  // 4. tokens — implicit-flow fragment. Establish the session via setSession.
  if (parsed.kind === 'tokens') {
    try {
      const { error } = await client.setSession({
        access_token: parsed.accessToken,
        refresh_token: parsed.refreshToken,
      });
      if (error) return { status: 'error', reason: mapConsumeError(error.message) };
      return isInvite(parsed.type) ? { status: 'needs_password' } : { status: 'success' };
    } catch {
      return { status: 'error', reason: 'network' };
    }
  }

  // 5. code — defensive PKCE branch. Same success/error handling as tokens.
  try {
    const { error } = await client.exchangeCodeForSession(parsed.code);
    if (error) return { status: 'error', reason: mapConsumeError(error.message) };
    return isInvite(parsed.type) ? { status: 'needs_password' } : { status: 'success' };
  } catch {
    return { status: 'error', reason: 'network' };
  }
}
