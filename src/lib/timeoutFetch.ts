// AUTH-FETCH-TIMEOUT-001 — client-side fetch timeout guard for the Supabase client.
//
// supabase-js's GoTrue / PostgREST / Storage calls go through a fetch that has NO
// timeout and NO AbortSignal of its own (auth-js `lib/fetch.js`). A stalled
// request therefore never rejects, so any awaiting caller hangs indefinitely —
// the root cause of the AUTH-CALLBACK-TIMEOUT-001 `/auth/callback` hang. This
// wraps the platform fetch so every call WITHOUT a caller-supplied signal aborts
// after `timeoutMs`; the aborted request rejects, letting supabase-js's own
// retry / error path fire instead of hanging.
//
// Pure + injectable: the base fetch is passed in (production passes the global
// `fetch`; tests pass a mock). No `window` / `process` / singleton imports.

/** Default per-request ceiling. Generous vs a healthy round-trip, bounded vs a stall. */
export const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

/**
 * Wrap `baseFetch` so a request without its own `AbortSignal` is aborted after
 * `timeoutMs`. A caller-supplied `signal` is respected verbatim (we never
 * override an explicit one). The timer is always cleared once the request
 * settles, so a fast response leaves no dangling handle.
 */
export function makeTimeoutFetch(
  baseFetch: typeof fetch,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
): typeof fetch {
  const wrapped = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // Respect a caller's explicit signal — do not attach our own timeout.
    if (init && init.signal) return baseFetch(input, init);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return baseFetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  };
  return wrapped as typeof fetch;
}
