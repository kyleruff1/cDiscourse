/**
 * AUTH-GOOGLE-SSO-003 (#746) — the Supabase Google OAuth initiation wrapper.
 *
 * This is the ONLY file in `src/` permitted to contain the provider sign-in call
 * `signInWithOAuth` (a source-scan guard in
 * `__tests__/authScreenProviderRegion.test.tsx` enforces the single-file
 * allow-list). The post-auth landing is the EXISTING /auth/callback consumer
 * (no parallel callback). The redirect target is the resolved CURRENT origin —
 * never a hard-coded host — so it works on localhost, Netlify dev, preview
 * deploys, and prod without code change.
 *
 * Doctrine: NO client secret, NO service-role. Uses the public anon `supabase`
 * client only. The provider response / tokens are NEVER logged. A bad runtime
 * origin degrades the same way email flows do (omit redirectTo → Supabase falls
 * back to the dashboard Site URL) instead of blocking sign-in. Never throws.
 */
import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';
import { buildAuthRedirectUrl } from '../../lib/auth/buildAuthRedirectUrl';
import { resolveRuntimeOrigin, getIsDev } from '../../lib/auth/resolveRuntimeOrigin';
import { mapAuthError } from './authApi';
import type { AuthResult } from './types';

/**
 * Initiate the Supabase Google provider redirect. Returns the existing
 * `AuthResult` shape: `{ ok: true }` on a successful initiation (the redirect
 * itself navigates the browser away — there is no user payload to return), and
 * `{ ok: false, error, message }` on a Supabase error. Never throws.
 */
export async function signInWithGoogle(): Promise<AuthResult> {
  if (!SUPABASE_CONFIGURED) {
    return {
      ok: false,
      error: 'config_missing',
      message:
        'Supabase is not configured. Copy .env.example to .env and fill in your project URL and anon key.',
    };
  }

  // redirectTo from the PURE helper. Explicit route '/auth/callback' with an
  // existing kind (per the merged architecture design §1) — AuthRedirectKind
  // names only the five email flows, so we pass an explicit route rather than
  // adding a new kind. A throwing origin (InvalidAuthRedirectOrigin) degrades to
  // undefined so a redirect-config defect never hard-blocks sign-in.
  let redirectTo: string | undefined;
  try {
    redirectTo = buildAuthRedirectUrl({
      kind: 'magic_link', // carrier only; the explicit route below drives the output
      route: '/auth/callback',
      runtimeOrigin: resolveRuntimeOrigin(),
      isDev: getIsDev(),
    });
  } catch {
    redirectTo = undefined;
  }

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: redirectTo ? { redirectTo } : undefined,
    });
    if (error) {
      return { ok: false, error: mapAuthError(error.message), message: error.message };
    }
    return { ok: true };
  } catch (e) {
    // A navigation / transport failure starting the redirect → plain network
    // class. The raw error is NOT logged (no token / provider detail leak).
    const message = e instanceof Error ? e.message : 'Sign-in could not be started.';
    return { ok: false, error: mapAuthError(message), message };
  }
}
