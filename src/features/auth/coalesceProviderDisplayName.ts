/**
 * AUTH-GOOGLE-SSO-004 (#747) — provider-metadata display-name coalescer.
 *
 * Shared executable spec mirrored by migration
 * `20260620000001_auth_google_oauth_display_name_coalesce.sql`'s
 * `handle_new_user()`; reusable by #748's optional client `profiles` self-heal
 * under the `id = auth.uid()` RLS policy. The trigger and any client self-heal
 * must compute the SAME display name from the same metadata, so they can never
 * diverge — that is the reason this twin exists.
 *
 * Pure: no React, no Supabase, no fetch, no side effects. Not wired into runtime
 * in this card (the server-side trigger is the only write path here).
 *
 * Priority (mirrors the SQL COALESCE; each candidate trimmed, inner whitespace
 * collapsed to a single space, empty treated as absent):
 *   1. display_name  (email/password path; first to preserve existing behavior)
 *   2. full_name     (Google OIDC standard claim)
 *   3. name          (Google OIDC standard claim)
 *   4. given_name + family_name (either or both present)
 *   5. email local-part (before '@')
 *   6. GENERIC_DISPLAY_NAME_FALLBACK ('Member') — only when email is absent.
 */

/** The auth-metadata keys this coalescer reads. Mirrors what handle_new_user()
 *  reads from raw_user_meta_data. Provider-independent: email/password sets
 *  `display_name`; Google sets `full_name`/`name`/`given_name`/`family_name`. */
export interface ProviderDisplayMetadata {
  display_name?: string | null;
  full_name?: string | null;
  name?: string | null;
  given_name?: string | null;
  family_name?: string | null;
}

/** The doctrine-safe generic last resort — only reached when email is absent.
 *  Plain neutral noun; no judgement word, no truth/verdict implication. */
export const GENERIC_DISPLAY_NAME_FALLBACK = 'Member';

/** Hard cap mirrors the app-side display-name edit cap (ContactInfoSection
 *  DISPLAY_NAME_MAX = 60) AND the migration's `left(…, 60)`. Applied AFTER
 *  coalescing + normalization. Keep all three equal. */
export const DISPLAY_NAME_DB_CAP = 60;

/**
 * Normalize a single candidate exactly like the SQL
 * `nullif(btrim(regexp_replace(<x>, '\s+', ' ', 'g')), '')`:
 * collapse every run of whitespace to a single space, trim the ends, then
 * treat the empty string (and non-strings) as absent (null).
 *
 * Note on `left()` vs `.slice()` for the cap: Postgres `left(text, n)` counts
 * characters; JS `.slice(0, n)` counts UTF-16 code units. They agree for the
 * BMP; astral-plane characters (emoji etc.) could differ by a code unit at the
 * exact boundary — an acceptable extreme edge for a display-name cap, not worth
 * surrogate-pair handling.
 */
function normalizeCandidate(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const collapsed = value.replace(/\s+/g, ' ').trim();
  return collapsed.length > 0 ? collapsed : null;
}

/**
 * Coalesce a non-empty display name from provider metadata + email.
 * Never throws; never returns an empty string (the generic fallback guarantees
 * a non-empty result). Result is capped to DISPLAY_NAME_DB_CAP characters.
 */
export function coalesceProviderDisplayName(
  metadata: ProviderDisplayMetadata | null | undefined,
  email: string | null | undefined,
): string {
  const m = metadata ?? {};

  // 4. given_name + family_name → concat_ws(' ', …): drop the absent part so a
  //    given-only or family-only name carries no stray leading/trailing space.
  const given = normalizeCandidate(m.given_name);
  const family = normalizeCandidate(m.family_name);
  const givenFamily = [given, family].filter((p): p is string => p !== null).join(' ');

  // 5. email local-part — split before '@', then normalize.
  const emailLocal =
    typeof email === 'string' ? normalizeCandidate(email.split('@')[0]) : null;

  const resolved =
    normalizeCandidate(m.display_name) ??
    normalizeCandidate(m.full_name) ??
    normalizeCandidate(m.name) ??
    normalizeCandidate(givenFamily) ??
    emailLocal ??
    GENERIC_DISPLAY_NAME_FALLBACK;

  return resolved.slice(0, DISPLAY_NAME_DB_CAP);
}
