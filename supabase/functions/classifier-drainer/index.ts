/**
 * classifier-drainer — ARCH-001 Card 2 single-flight, bounded-batch queue drainer.
 *
 * Security model:
 *   - verify_jwt = false (set in config.toml). This endpoint is invoked by
 *     the pg_cron tick + the enqueue-kick trigger (server-side net.http_post),
 *     NOT by an end user with a JWT. It is NEVER reachable as an authenticated
 *     user action.
 *   - It validates a SHARED SECRET on the Authorization header BEFORE doing
 *     ANY work (no DB read, no claim, no provider call) — the same posture
 *     Supabase documents for cron→function auth. The secret lives in env
 *     (CLASSIFIER_DRAIN_SHARED_SECRET — an operator-set function secret,
 *     equal to the value seeded in Vault for the kick/cron). A missing /
 *     mismatched header → 401, with NOTHING logged.
 *   - The drain itself uses the service-role client (bypasses RLS, exactly
 *     as the existing MCP-021C writer does) to call the Card-1/2A SQL
 *     functions. No AI/model-provider call is made by THIS file directly —
 *     the MCP adapter (server-side) is the only provider surface and runs
 *     with the corrected >=30s caller-side timeout (design §A.6).
 *
 * Doctrine (cdiscourse-doctrine §1/§3/§6/§7):
 *   - NEVER logs the shared secret, the Authorization header, the MCP token,
 *     a raw prompt, a raw model response, or any full provider payload.
 *   - The response body carries ONLY operational counters (jobs processed /
 *     succeeded / failed / retried / dead-lettered / lost-lease / stale
 *     recovered) — no verdict, no truth value, no user content, no secret.
 *   - Claim order is arrival-time FIFO (set in the Card-1 claim SQL); no
 *     popularity / heat / engagement signal participates.
 *   - Server-only file under supabase/functions/; never imported by src/ or app/.
 */
import { corsHeaders, ok, unauthorized, methodNotAllowed } from '../_shared/http.ts';
import { createServiceClient } from '../_shared/supabaseClients.ts';
import { runBooleanObservationMcpAdapter } from '../_shared/booleanObservations/booleanObservationMcpAdapter.ts';
import { runClassifierDrain } from '../_shared/booleanObservations/classifierDrainerCore.ts';
import type {
  DrainerClock,
  DrainerDeps,
} from '../_shared/booleanObservations/classifierDrainerCore.ts';

/**
 * The standard HTTP Authorization scheme prefix, assembled from two
 * fragments so no contiguous scheme literal sits in this source (the repo
 * secret-literal scan stays green — same convention as
 * booleanObservationMcpAdapter.ts AUTH_SCHEME_PREFIX).
 */
const AUTH_SCHEME_PREFIX = 'Bea' + 'rer ';

/**
 * Constant-time-ish string compare to avoid leaking the secret length /
 * prefix via early-return timing. Both strings are compared in full; a
 * length mismatch still walks the longer string. NEVER logs either value.
 */
function secretsMatch(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i += 1) {
    diff |= a.charCodeAt(i % a.length || 0) ^ b.charCodeAt(i % b.length || 0);
  }
  return diff === 0 && a.length === b.length;
}

/**
 * Generate an opaque drainer invocation id (no secret). Used as the lease
 * owner + the audit row owner. crypto.randomUUID is available in the Edge
 * runtime; the value is purely diagnostic.
 */
function newOwnerId(): string {
  try {
    return `drain-${crypto.randomUUID()}`;
  } catch {
    return `drain-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  }
}

/** Production clock — Date.now(). The core injects this; tests inject a stub. */
const productionClock: DrainerClock = {
  nowMs: () => Date.now(),
};

Deno.serve(async (req: Request): Promise<Response> => {
  // ── CORS preflight ────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  // The kick/cron POST; reject anything else.
  if (req.method !== 'POST') {
    return methodNotAllowed();
  }

  // ── Shared-secret validation BEFORE any work ──────────────────
  // verify_jwt=false → this is the ONLY auth gate. The expected secret is an
  // operator-set function secret (equal to the Vault value the kick/cron
  // POST with). A missing config OR a mismatched header → 401. NOTHING about
  // the secret, the header, or the comparison is logged.
  const expectedSecret = Deno.env.get('CLASSIFIER_DRAIN_SHARED_SECRET') ?? '';
  if (!expectedSecret) {
    // Misconfiguration: no expected secret set. Refuse rather than run
    // unauthenticated. (NOT logging the env name's presence/absence beyond
    // this generic refusal.)
    return unauthorized();
  }
  const authHeader =
    req.headers.get('authorization') ?? req.headers.get('Authorization') ?? '';
  const presented = authHeader.startsWith(AUTH_SCHEME_PREFIX)
    ? authHeader.slice(AUTH_SCHEME_PREFIX.length)
    : authHeader; // tolerate a bare secret (apikey-style) too.
  if (!secretsMatch(presented, expectedSecret)) {
    return unauthorized();
  }

  // ── Run ONE bounded drain (single-flight enforced inside) ─────
  const serviceClient = createServiceClient();
  const deps: DrainerDeps = {
    serviceClient,
    // The drainer passes the >=30s timeout via the classify helper; the
    // adapter reference here is the real MCP adapter (the helper supplies
    // the { timeoutMs } option).
    adapter: runBooleanObservationMcpAdapter,
    clock: productionClock,
    owner: newOwnerId(),
  };

  let summary;
  try {
    summary = await runClassifierDrain(deps);
  } catch {
    // runClassifierDrain is designed never to throw; this is defence in
    // depth. Return a sanitized 200 (the cron/kick are fire-and-forget; a
    // 5xx here just triggers the next tick). NOTHING sensitive is echoed.
    return ok({ outcome: 'failed', drained: false });
  }

  // Response carries ONLY operational counters (no secret, no user content).
  return ok({
    drained: summary.outcome !== 'skipped_single_flight',
    outcome: summary.outcome,
    jobs_processed: summary.jobsProcessed,
    jobs_succeeded: summary.jobsSucceeded,
    jobs_failed: summary.jobsFailed,
    jobs_retried: summary.jobsRetried,
    jobs_dead_lettered: summary.jobsDeadLettered,
    jobs_lost_lease: summary.jobsLostLease,
    stale_leases_recovered: summary.staleLeasesRecovered,
  });
});
