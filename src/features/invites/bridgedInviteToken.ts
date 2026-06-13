/**
 * ARG-ROOM-004 (#615) — the `/auth/callback?invite=<token>` → seat bridge.
 *
 * A brand-new invitee receives a Supabase Auth "Invite user" email whose CTA
 * returns to `<origin>/auth/callback?invite=<token>` (the redirect minted by
 * the create-time orchestration). After the invitee sets a password on
 * `AuthCallbackScreen`, the shipped #607/#608 chain auto-accepts the reserved
 * seat — but only if the room token was captured into the
 * `pendingInviteIntent` slice at cold start. The shipped `parseInviteDeepLink`
 * only matches the `/invite/<token>` PATH (it strips the query), so it cannot
 * see the `?invite=` bridge token. This module supplies the thin extractor.
 *
 * Doctrine (mirrors `inviteDeepLink.ts` + `parseAuthCallbackUrl.ts`):
 *  - 100% pure: no `window`, no `expo-linking`, no `process.env`, no network.
 *  - `extractBridgedInviteToken` NEVER throws. Any non-callback URL, missing
 *    param, or malformed/short/long token returns `null` — never the
 *    extracted-but-invalid token (so a typo cannot be carried into the
 *    `lookup_by_token` / `accept` Edge calls).
 *  - It reads ONLY the query string (`searchParams.get('invite')`). It never
 *    touches the URL fragment, so the implicit-flow `#access_token=…` auth
 *    secrets are never read or echoed here (no secret leak).
 *  - It does NOT import or touch `parseAuthCallbackUrl`: the auth-secret parser
 *    stays pure and auth-only (un-widened, per the design + review).
 */

import { isValidInviteTokenShape, parseInviteDeepLink } from './inviteDeepLink';

/**
 * The exact auth-callback paths the bridge token may ride on. Kept as a local
 * literal (NOT imported from `parseAuthCallbackUrl`) so this extractor does not
 * couple the invite capability to the auth-secret parser. Mirrors
 * `isAuthCallbackPath`'s truth table for the two accepted forms.
 */
const AUTH_CALLBACK_PATHS = Object.freeze(['/auth/callback', '/auth/callback/']);

/**
 * Read a `?invite=<token>` bridge token off an `/auth/callback` URL.
 *
 * Returns the raw token ONLY when:
 *   - `url` is a parseable http(s) URL,
 *   - its path is exactly `/auth/callback` (or `/auth/callback/`),
 *   - it carries a `?invite=` query param,
 *   - and that param passes `isValidInviteTokenShape`.
 *
 * Returns `null` for everything else. NEVER throws. Reads ONLY the query — the
 * fragment (auth secrets) is never inspected.
 */
export function extractBridgedInviteToken(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (trimmed.length === 0) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const proto = parsed.protocol.toLowerCase();
  if (proto !== 'https:' && proto !== 'http:') return null;

  // Path-gate: a stray `?invite=` on any other route must NOT seed an intent.
  if (!AUTH_CALLBACK_PATHS.includes(parsed.pathname)) return null;

  // Query-only read. `searchParams` excludes the URL fragment by construction,
  // so an implicit-flow `#access_token=…&type=invite` is never touched here.
  const candidate = parsed.searchParams.get('invite');
  return isValidInviteTokenShape(candidate) ? candidate : null;
}

/**
 * The single cold-start resolver App.tsx uses: an invite token may arrive as
 * EITHER the `/invite/<token>` deep-link path (shipped QOL-038) OR the new
 * `/auth/callback?invite=<token>` bridge query (ARG-ROOM-004). Prefer the
 * shipped path form; fall back to the bridge. Returns `null` when neither
 * matches. NEVER throws.
 *
 * Keeping this combined resolver pure lets the App.tsx cold-start effect stay a
 * thin impure boundary (read `window.location.href`, dispatch) while the
 * decision is unit-tested here.
 */
export function resolveColdStartInviteToken(url: unknown): string | null {
  const fromPath = parseInviteDeepLink(typeof url === 'string' ? url : '');
  if (fromPath) return fromPath.token;
  return extractBridgedInviteToken(url);
}
