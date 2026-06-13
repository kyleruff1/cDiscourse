// AUTH-CALLBACK-CONSUMER-001 — pure parser for the Supabase auth callback URL.
//
// This module is 100% pure: no `window`, no `process`, no React, no Supabase,
// no network. It mirrors the purity discipline of `buildAuthRedirectUrl.ts`
// and `inviteDeepLink.ts`, so it is trivially unit-testable in Node and runs
// identically on web / native / Edge.
//
// A Supabase invite/confirmation email redirects to `<origin>/auth/callback`
// carrying the session material. Because this project runs the GoTrue
// *implicit* flow (the default; `src/lib/supabase.ts` does not set
// `flowType`), the live shape is a URL **fragment** token
// (`#access_token=…&refresh_token=…&type=invite`). The PKCE query-code shape
// (`?code=…`) is supported defensively but is not what the seed invite lands
// as. Errors (expired/denied links) arrive in the fragment under implicit
// flow and in the query under PKCE; we read both.
//
// Doctrine:
//  - `parseAuthCallbackUrl` NEVER throws. A malformed URL → `unsupported`.
//  - No token value is ever logged. `redactAuthCallbackUrl` /
//    `describeAuthCallbackForDiagnostics` exist precisely so a diagnostic
//    line can describe a callback without echoing a secret.

/**
 * Flow types Supabase may stamp on a callback (the subset we read). Unknown
 * values are tolerated as plain strings without widening the union away.
 */
export type AuthCallbackFlowType =
  | 'invite'
  | 'signup'
  | 'magiclink'
  | 'recovery'
  | 'email_change'
  | (string & {});

/** Discriminated union — the exact five callback variants. */
export type AuthCallbackParsed =
  | { kind: 'code'; code: string; type: AuthCallbackFlowType | null }
  | {
      kind: 'tokens';
      accessToken: string;
      refreshToken: string;
      type: AuthCallbackFlowType | null;
      expiresIn: number | null;
    }
  | {
      kind: 'error';
      // Sanitised, non-secret strings copied from the URL's error params.
      error: string; // e.g. 'access_denied'
      errorCode: string | null; // e.g. 'otp_expired'
      description: string | null; // human text Supabase supplied (non-secret)
      recoverable: boolean; // true for expiry/denied → "may have expired" copy
    }
  | { kind: 'empty' } // /auth/callback with no recognizable params
  | { kind: 'unsupported'; reason: string }; // present but not a shape we consume

/** Param keys whose VALUES are secret and must be redacted in any diagnostic. */
const SENSITIVE_PARAM_KEYS = [
  'access_token',
  'refresh_token',
  'provider_token',
  'provider_refresh_token',
  'id_token',
  'token_hash',
  'code',
] as const;

/**
 * `error_code` values that mean the link expired / was already used — these
 * map to recoverable "may have expired" copy rather than a generic failure.
 */
const RECOVERABLE_ERROR_CODES = new Set(['otp_expired']);
/** `error` names that mean the same (implicit-flow denial of an expired link). */
const RECOVERABLE_ERROR_NAMES = new Set(['access_denied']);

/** True for the bare callback route (tolerates exactly one trailing slash). */
export function isAuthCallbackPath(pathname: string): boolean {
  if (typeof pathname !== 'string') return false;
  const p = pathname.trim();
  return p === '/auth/callback' || p === '/auth/callback/';
}

/** First argument that is a non-empty string, else null. */
function firstNonEmpty(...vals: (string | null | undefined)[]): string | null {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim().length > 0) return v;
  }
  return null;
}

function isNonEmpty(v: string | null | undefined): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function normalizeType(raw: string | null | undefined): AuthCallbackFlowType | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? (t as AuthCallbackFlowType) : null;
}

function isRecoverableError(error: string | null, errorCode: string | null): boolean {
  if (errorCode && RECOVERABLE_ERROR_CODES.has(errorCode.toLowerCase())) return true;
  if (error && RECOVERABLE_ERROR_NAMES.has(error.toLowerCase())) return true;
  return false;
}

/** Strip a single leading '#' from a fragment so URLSearchParams can read it. */
function fragmentParams(hash: string): URLSearchParams {
  return new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
}

/**
 * Parse a full callback URL into a discriminated union. NEVER throws.
 *
 * Reads BOTH the query string and the fragment. Precedence is
 * error > tokens > code > token_hash(unsupported) > empty, so a stale link
 * that carries both an error and leftover tokens is reported as an error, and
 * an implicit-flow callback that somehow carries both a fragment token and a
 * query code resolves to the fragment token (the implicit reality).
 */
export function parseAuthCallbackUrl(url: string): AuthCallbackParsed {
  if (typeof url !== 'string' || url.trim().length === 0) {
    return { kind: 'empty' };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Malformed / non-URL string. The parser must never throw.
    return { kind: 'unsupported', reason: 'unparseable' };
  }

  const query = parsed.searchParams;
  const fragment = fragmentParams(parsed.hash);

  // 1. error (highest precedence) — may arrive in the query (PKCE) or the
  //    fragment (implicit). Either `error` or `error_description` is enough.
  const error = firstNonEmpty(query.get('error'), fragment.get('error'));
  const description = firstNonEmpty(
    query.get('error_description'),
    fragment.get('error_description'),
  );
  if (error || description) {
    const errorCode = firstNonEmpty(query.get('error_code'), fragment.get('error_code'));
    const errorName = error ?? 'error';
    return {
      kind: 'error',
      error: errorName,
      errorCode: errorCode ?? null,
      description: description ?? null,
      recoverable: isRecoverableError(errorName, errorCode),
    };
  }

  // 2. tokens (fragment) — the PRIMARY shape under implicit flow.
  const accessToken = fragment.get('access_token');
  const refreshToken = fragment.get('refresh_token');
  if (isNonEmpty(accessToken) && isNonEmpty(refreshToken)) {
    const expiresInRaw = fragment.get('expires_in');
    const expiresInNum =
      typeof expiresInRaw === 'string' && expiresInRaw.trim().length > 0
        ? Number(expiresInRaw)
        : Number.NaN;
    return {
      kind: 'tokens',
      accessToken,
      refreshToken,
      type: normalizeType(fragment.get('type')),
      expiresIn: Number.isFinite(expiresInNum) ? expiresInNum : null,
    };
  }

  // 3. code (query) — defensive PKCE branch (not configured today).
  const code = query.get('code');
  if (isNonEmpty(code)) {
    return { kind: 'code', code, type: normalizeType(query.get('type')) };
  }

  // 4. unsupported — a recognizable-but-unconsumable shape. `token_hash`
  //    (the verifyOtp shape) is the one we name so diagnostics can record it.
  const tokenHash = firstNonEmpty(query.get('token_hash'), fragment.get('token_hash'));
  if (isNonEmpty(tokenHash)) {
    return { kind: 'unsupported', reason: 'token_hash' };
  }

  // 5. empty — bare /auth/callback with no query and no fragment.
  return { kind: 'empty' };
}

/**
 * Return a log-safe rendering of a URL: the VALUES of every secret param
 * (access/refresh/provider/id token, token_hash, code) are replaced with
 * '***'. Used ONLY in diagnostics. Never emits a real token. NEVER throws.
 *
 * The match is anchored to a `?`, `#`, or `&` delimiter immediately before the
 * key so `code=` does NOT clobber the non-secret `error_code=` value, and so
 * the redaction works on the query, the fragment, and even a malformed string
 * that the WHATWG parser would reject.
 */
export function redactAuthCallbackUrl(url: string): string {
  if (typeof url !== 'string') return '';
  let out = url;
  for (const key of SENSITIVE_PARAM_KEYS) {
    const re = new RegExp(`([?#&]${key}=)[^&#\\s]*`, 'gi');
    out = out.replace(re, '$1***');
  }
  return out;
}

/**
 * Non-secret summary for a diagnostics line / the testing-run doc. Carries no
 * token value — only the variant kind, the flow type, presence booleans, the
 * (non-secret) error code, and the unsupported reason.
 */
export function describeAuthCallbackForDiagnostics(parsed: AuthCallbackParsed): {
  kind: AuthCallbackParsed['kind'];
  type: string | null;
  hasCode: boolean;
  hasTokens: boolean;
  errorCode: string | null;
  reason: string | null;
} {
  return {
    kind: parsed.kind,
    type: parsed.kind === 'tokens' || parsed.kind === 'code' ? parsed.type : null,
    hasCode: parsed.kind === 'code',
    hasTokens: parsed.kind === 'tokens',
    errorCode: parsed.kind === 'error' ? parsed.errorCode : null,
    reason: parsed.kind === 'unsupported' ? parsed.reason : null,
  };
}
