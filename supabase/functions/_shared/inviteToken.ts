/**
 * QOL-038 — invite-token helpers (Edge Function only).
 *
 * The raw invite token is a 32-byte random value, base64url-encoded
 * (~43 chars, no padding). It is generated server-side via the Deno Web
 * Crypto API and never appears in any storage location other than the
 * invite email body (when QOL-040 turns delivery on) and the
 * `lookup_by_token` request body.
 *
 * The DB stores only `token_hash = sha-256-hex(raw)`. The hash is the key
 * the function uses to look up an invite given the raw token from the
 * URL — it ensures a database leak does not give an attacker a usable
 * token.
 *
 * Module is Deno-only. The shape contract (length / charset) lives in
 * `src/features/invites/inviteDeepLink.ts` (`isValidInviteTokenShape`)
 * so the client parser and the server validator agree.
 */

const TOKEN_BYTES = 32;

/** base64url charset, no padding. */
function bytesToBase64Url(bytes: Uint8Array): string {
  // btoa works on a binary string. We avoid Buffer because Deno's
  // runtime here doesn't expose Node's Buffer by default.
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Hex of a Uint8Array. Lower-case, no separators. */
function bytesToHex(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0');
  }
  return out;
}

/**
 * Generate a fresh raw invite token. 32 random bytes → base64url. Pure
 * with respect to its caller (no logging), but reads from crypto so
 * non-deterministic — this is intentional.
 */
export function generateInviteToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

/**
 * Hash a raw invite token for DB storage / lookup. sha-256 hex, 64
 * characters. Deterministic — the same raw token always hashes to the
 * same value.
 */
export async function hashInviteToken(rawToken: string): Promise<string> {
  if (typeof rawToken !== 'string' || rawToken.length === 0) {
    throw new Error('hashInviteToken: empty token');
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(rawToken);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}
