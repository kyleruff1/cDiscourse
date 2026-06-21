/**
 * AUTH-GOOGLE-SSO-003 (#746) — the default-OFF gate for the "Continue with
 * Google" affordance.
 *
 * Pure decision module. NO React, NO provider sign-in call, NO secret. The flag
 * it reads (`EXPO_PUBLIC_GOOGLE_AUTH_ENABLED`) is a PUBLIC runtime flag — the
 * `EXPO_PUBLIC_` prefix is the public contract — never a secret. The OAuth
 * client secret lives only in Supabase (set in #745) and never reaches the
 * client.
 *
 * Default OFF: merging #746 does NOT change the live Sign In surface. The
 * operator flips the flag in the Netlify environment when ready to go live
 * post-#745 (the hosted Google provider is already enabled). Until then the Sign
 * In surface stays email-only.
 *
 * Resolution order mirrors src/lib/supabase.ts: the runtime-env shim
 * (window.__CDISCOURSE_RUNTIME_ENV__, surfaced via readRuntimeEnv()) first, then
 * process.env (native + local dev).
 */
import { SUPABASE_CONFIGURED, readRuntimeEnv } from '../../lib/supabase';

/** Public runtime flag name. Default OFF: unset / any non-'true' value hides Google. */
export const GOOGLE_AUTH_ENABLED_FLAG = 'EXPO_PUBLIC_GOOGLE_AUTH_ENABLED' as const;

/**
 * True ONLY when Supabase is configured AND the operator has explicitly set the
 * public runtime flag to the exact string 'true'. Default OFF so merging #746
 * does not change the live Sign In surface; the operator flips the flag in
 * Netlify env when ready to go live post-#745.
 *
 * NOTE: the runtime-env shim type in supabase.ts declares only the three
 * EXPO_PUBLIC_* slots it projects, so readRuntimeEnv() does not surface this
 * flag in production. The gate reads it defensively via a Record cast (so a test
 * that stubs readRuntimeEnv to return the flag still works) AND consults
 * process.env directly (the production path on native + local dev). The exact
 * `=== 'true'` string check keeps the default OFF for unset / 'false' / '1' /
 * 'TRUE' / '' and every other value.
 */
export function resolveGoogleAuthEnabled(): boolean {
  if (!SUPABASE_CONFIGURED) return false;
  const fromRuntime = (readRuntimeEnv() as Record<string, unknown>)[GOOGLE_AUTH_ENABLED_FLAG];
  const fromEnv = process.env[GOOGLE_AUTH_ENABLED_FLAG];
  const value = typeof fromRuntime === 'string' ? fromRuntime : fromEnv;
  return value === 'true';
}
