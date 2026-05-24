/**
 * QOL-038 — pure deep-link parser/serialiser for `/invite/<token>`.
 *
 * Two forms are supported:
 *
 *   - Web:    `https://<origin>/invite/<token>`
 *   - Native: `cdiscourse://invite/<token>`
 *
 * The module is 100% pure: no `window`, no `expo-linking`, no
 * `process.env`. The impure boundary that reads the initial URL lives in
 * the App.tsx cold-start branch + the native deep-link listener. This file
 * is imported by both the production client and the Node tests.
 *
 * Doctrine:
 *  - `parseInviteDeepLink` NEVER throws. Anything not matching the
 *    `/invite/<token>` shape returns `null` so the app cold-starts
 *    normally and the user is never trapped by a malformed URL.
 *  - The token shape is base64url, length-bounded. A wildly long string
 *    or a string with a forbidden character returns `null`; never the
 *    extracted-but-invalid token (so a typo cannot be carried into the
 *    `lookup_by_token` Edge Function call).
 *  - The serialiser refuses to emit a link for an invalid token shape —
 *    fail-closed; an invalid token at build time is a programming bug
 *    and a thrown error is louder than silently emitting a bad link.
 */

/** Path prefix used by both the web and native deep-link forms. */
export const INVITE_ROUTE_PREFIX = '/invite/';

/** Native scheme used by the Expo deep-link form. */
export const NATIVE_INVITE_SCHEME_PREFIX = 'cdiscourse://invite/';

/**
 * The hard min/max length of a base64url token. We mint 32 random bytes
 * server-side which encodes to 42–43 base64url characters (no padding).
 * Allow 32–64 to give a little slack for future token width changes
 * without churning tests, but reject anything implausibly long or short.
 */
export const INVITE_TOKEN_MIN_LENGTH = 32;
export const INVITE_TOKEN_MAX_LENGTH = 64;

/** Characters allowed in a base64url token (no padding). */
const INVITE_TOKEN_REGEX = /^[A-Za-z0-9_-]+$/;

/** Parse result. `null` means "this is not an invite deep link." */
export interface ParsedInviteDeepLink {
  token: string;
}

/**
 * True when the string passes the shape check for an invite token. Used by
 * both the parser and the Edge Function's `lookup_by_token` handler — the
 * shape check is the first gate.
 */
export function isValidInviteTokenShape(token: unknown): token is string {
  if (typeof token !== 'string') return false;
  if (token.length < INVITE_TOKEN_MIN_LENGTH) return false;
  if (token.length > INVITE_TOKEN_MAX_LENGTH) return false;
  return INVITE_TOKEN_REGEX.test(token);
}

/**
 * Parse an invite deep-link URL. Accepts:
 *
 *   - `https://example.com/invite/<token>`
 *   - `http://example.com/invite/<token>`
 *   - `cdiscourse://invite/<token>`
 *
 * Returns `{ token }` when the URL matches one of the forms and the token
 * shape is valid. Returns `null` for any other URL (including malformed
 * input). NEVER throws.
 */
export function parseInviteDeepLink(url: unknown): ParsedInviteDeepLink | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (trimmed.length === 0) return null;

  // 1) Native scheme — fixed prefix; everything after is the token.
  if (trimmed.toLowerCase().startsWith(NATIVE_INVITE_SCHEME_PREFIX)) {
    const tail = trimmed.slice(NATIVE_INVITE_SCHEME_PREFIX.length);
    const token = stripTrailingDecorations(tail);
    return isValidInviteTokenShape(token) ? { token } : null;
  }

  // 2) HTTP/HTTPS — parse via WHATWG URL parser. Anything that doesn't
  //    parse, or doesn't have the /invite/<token> path, returns null.
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  const proto = parsed.protocol.toLowerCase();
  if (proto !== 'https:' && proto !== 'http:') return null;
  // The path must START with /invite/<token>. Trailing slashes / query
  // strings / fragments are tolerated (stripped via stripTrailingDecorations).
  if (!parsed.pathname.startsWith(INVITE_ROUTE_PREFIX)) return null;
  const tail = parsed.pathname.slice(INVITE_ROUTE_PREFIX.length);
  // A bare /invite/ with no token is not a redeemable link.
  const token = stripTrailingDecorations(tail);
  return isValidInviteTokenShape(token) ? { token } : null;
}

/**
 * Strip a trailing slash + any leftover ?query / #hash decorations from a
 * captured path tail. Called only on the segment after `/invite/`.
 */
function stripTrailingDecorations(tail: string): string {
  let s = tail;
  const qIdx = s.indexOf('?');
  if (qIdx >= 0) s = s.slice(0, qIdx);
  const hIdx = s.indexOf('#');
  if (hIdx >= 0) s = s.slice(0, hIdx);
  if (s.endsWith('/')) s = s.slice(0, -1);
  return s;
}

/**
 * Build the WEB invite deep-link URL for an inviter to share. The origin
 * must be a non-trailing-slash absolute origin (e.g. produced by
 * `buildAuthRedirectUrl`'s `validateAndNormalizeOrigin`). The token must
 * pass `isValidInviteTokenShape` — bad shape throws (programmer error).
 */
export function buildInviteLink(origin: string, token: string): string {
  if (typeof origin !== 'string' || origin.length === 0) {
    throw new Error('buildInviteLink: origin is required');
  }
  if (!isValidInviteTokenShape(token)) {
    throw new Error('buildInviteLink: invalid token shape');
  }
  const trimmedOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;
  return `${trimmedOrigin}${INVITE_ROUTE_PREFIX}${token}`;
}

/**
 * Build the NATIVE invite deep-link URL. Same contract as
 * `buildInviteLink` but uses the `cdiscourse://` scheme. Useful in tests
 * and for the future native-share affordance.
 */
export function buildNativeInviteLink(token: string): string {
  if (!isValidInviteTokenShape(token)) {
    throw new Error('buildNativeInviteLink: invalid token shape');
  }
  return `${NATIVE_INVITE_SCHEME_PREFIX}${token}`;
}
