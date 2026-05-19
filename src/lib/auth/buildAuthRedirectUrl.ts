// QOL-023 — Pure-TS helper that computes the URL Supabase auth emails redirect
// to (signup confirmation, magic link, password reset, invite, email change).
//
// This module is 100% pure: no `window`, no `process`, no `__DEV__`, no imports
// from React / Supabase / any network library. The impure boundary that reads
// the runtime origin lives in resolveRuntimeOrigin.ts. Keeping the two apart
// means this helper is trivially unit-testable without environment mocking.
//
// Doctrine:
//   - The redirect origin is a PUBLIC URL, never a secret. No env-file read.
//   - Fail-closed: a non-https origin in a non-dev build throws rather than
//     silently shipping a broken or unsafe link. Callers catch and degrade —
//     a redirect-config defect must never block a user from signing up.
//   - The thrown error carries only a reason enum, never the offending origin
//     string, so a malformed origin cannot leak into a log line.

/** The five Supabase auth-email flows that carry a redirect. */
export type AuthRedirectKind =
  | 'confirm_signup'
  | 'magic_link'
  | 'password_reset'
  | 'invite'
  | 'email_change';

export interface BuildAuthRedirectUrlInput {
  /** Which auth flow the email belongs to. Drives the default route. */
  kind: AuthRedirectKind;
  /**
   * The deployed/host origin, e.g. 'https://dev.cdiscourse.com'.
   * `null` when no origin was injected (local dev) — fallback logic applies.
   * Never an env-file read; always sourced via resolveRuntimeOrigin().
   */
  runtimeOrigin: string | null;
  /**
   * True when the build is a local development build (`__DEV__ === true`).
   * Controls the localhost fallback and relaxes the https-only rule.
   */
  isDev: boolean;
  /**
   * Optional explicit route path (must begin with '/'). When omitted,
   * defaults per `kind` (see route-defaulting rules below).
   */
  route?: string;
}

/** Per-kind default route used when `input.route` is omitted or empty. */
export const DEFAULT_AUTH_ROUTES: Record<AuthRedirectKind, string> = {
  confirm_signup: '/auth/callback',
  magic_link: '/auth/callback',
  invite: '/auth/callback',
  email_change: '/auth/callback',
  password_reset: '/auth/reset',
};

/**
 * The ONLY value that may ever produce a localhost URL, and only when
 * `isDev === true` and no runtime origin was resolved.
 */
export const DEV_FALLBACK_ORIGIN = 'http://localhost:8081';

/**
 * Hosted fallback used when no runtime origin was resolved in a non-dev build.
 * The canonical dev-deploy origin (HOST-001). Never localhost.
 */
export const HOSTED_FALLBACK_ORIGIN = 'https://dev.cdiscourse.com';

type InvalidOriginReason = 'forbidden_scheme' | 'insecure_scheme' | 'no_host';

/**
 * Thrown when the resolved origin cannot safely back an auth redirect URL.
 * The message carries only the `reason` enum — never the raw origin value —
 * so a malformed origin cannot be echoed into a log line or crash report.
 */
export class InvalidAuthRedirectOrigin extends Error {
  readonly code = 'invalid_auth_redirect_origin';
  /** The reason class — never the raw origin value, to avoid leaking it. */
  readonly reason: InvalidOriginReason;

  constructor(reason: InvalidOriginReason) {
    super(`Auth redirect origin rejected: ${reason}`);
    this.name = 'InvalidAuthRedirectOrigin';
    this.reason = reason;
  }
}

// Dangerous schemes rejected in ALL builds, dev and non-dev alike. Dev does not
// relax this ban. Compared case-insensitively after trimming.
const FORBIDDEN_SCHEME_PREFIXES = ['file:', 'javascript:', 'data:', 'vbscript:', 'blob:'];

/**
 * Resolve which origin to use, applying the fallback rules. Does not validate.
 */
function resolveOrigin(runtimeOrigin: string | null, isDev: boolean): string {
  const trimmed = (runtimeOrigin ?? '').trim();
  if (trimmed.length > 0) return trimmed;
  // Rule 2: a non-dev build with a missing origin lands on the hosted
  // fallback — NEVER on localhost.
  if (!isDev) return HOSTED_FALLBACK_ORIGIN;
  // Rule 3: only a true dev build with no origin may produce localhost.
  return DEV_FALLBACK_ORIGIN;
}

/**
 * Validate and normalize a resolved origin. Returns the normalized
 * `scheme://host(:port)` form with no trailing slash and no path.
 * Throws InvalidAuthRedirectOrigin on a dangerous, insecure, or hostless origin.
 */
function validateAndNormalizeOrigin(origin: string, isDev: boolean): string {
  const lower = origin.toLowerCase();

  // 1. Dangerous schemes — rejected in every build.
  for (const prefix of FORBIDDEN_SCHEME_PREFIXES) {
    if (lower.startsWith(prefix)) {
      throw new InvalidAuthRedirectOrigin('forbidden_scheme');
    }
  }

  // 2. http:// is only permitted in a dev build (this is how localhost works).
  //    A non-dev build with an http:// origin fails closed.
  if (!lower.startsWith('https://') && !isDev) {
    throw new InvalidAuthRedirectOrigin('insecure_scheme');
  }

  // 3. Parse with the WHATWG URL parser. It lowercases scheme + host for us
  //    and rejects an origin with no parseable host.
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    throw new InvalidAuthRedirectOrigin('no_host');
  }
  if (!parsed.host) {
    throw new InvalidAuthRedirectOrigin('no_host');
  }

  // `protocol` includes the trailing ':'; `host` carries the port if present.
  // The path is intentionally discarded — runtimeOrigin is an origin, not a
  // base URL. The WHATWG URL parser lowercases scheme + host on most engines,
  // but the React Native runtime's URL implementation does NOT lowercase the
  // host. Lowercase both explicitly so output is identical across web, native,
  // and Node — only the scheme and host are lowercased, never a route/path.
  return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}`;
}

/**
 * Normalize a route to begin with exactly one `/`. An empty/whitespace route
 * is treated as omitted by the caller before this runs.
 */
function normalizeRoute(route: string): string {
  const trimmed = route.trim();
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/**
 * Compute the auth redirect URL for a Supabase auth email.
 *
 * Pure and deterministic — same input always produces the same output, no
 * I/O, no clock, no randomness. Throws InvalidAuthRedirectOrigin when the
 * resolved origin is dangerous, insecure (in a non-dev build), or hostless.
 */
export function buildAuthRedirectUrl(input: BuildAuthRedirectUrlInput): string {
  const resolved = resolveOrigin(input.runtimeOrigin, input.isDev);
  const normalizedOrigin = validateAndNormalizeOrigin(resolved, input.isDev);

  const explicitRoute = (input.route ?? '').trim();
  const route =
    explicitRoute.length > 0
      ? normalizeRoute(explicitRoute)
      : DEFAULT_AUTH_ROUTES[input.kind];

  // normalizedOrigin contributes no trailing slash; route starts with exactly
  // one `/`, so there is never a `//` between origin and route.
  return `${normalizedOrigin}${route}`;
}
