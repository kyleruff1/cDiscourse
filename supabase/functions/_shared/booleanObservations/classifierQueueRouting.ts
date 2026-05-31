/**
 * ARCH-001 Card 2 — Submit-path queue routing (the smoke-only, default-
 * DISABLED enqueue flag) + the enqueue call.
 *
 * Two pieces (parent design §A.11):
 *   1. `shouldRouteToQueue(argument, debate, enabled)` — a PURE predicate
 *      (no network) evaluated at the submit-argument I14 dispatch point. It
 *      decides whether the just-inserted argument routes to the classifier
 *      QUEUE (enqueue + drainer) instead of the current DIRECT dispatch.
 *      It is DEFAULT DISABLED: it returns `false` for EVERY argument unless
 *      BOTH (a) the master enable flag is on AND (b) the argument's debate
 *      is smoke-tagged. So ordinary production submits ALWAYS keep the
 *      current direct dispatch — the non-smoke path is byte-unchanged.
 *   2. `enqueueClassifierJobs(...)` — when routed, calls the Card-1
 *      `enqueue_classifier_job(p_argument_id, p_debate_id, p_family,
 *      p_run_mode, p_schema_version)` SQL function for each PRODUCTION
 *      family A–G (the registry's productionEnabledFamilies()). Each call
 *      is an idempotent INSERT … ON CONFLICT DO NOTHING (Card-1 index #5),
 *      so a re-enqueue for an active cell is a no-op. H/I/J are NEVER
 *      enqueued (they are not productionEnabled).
 *
 * The branch at the dispatch point is MUTUALLY EXCLUSIVE (design §A.11
 * double-dispatch proof): `if (shouldRouteToQueue) { enqueueClassifierJobs }
 * else { dispatchAutoTriggerForArgument under waitUntil }`. An argument
 * takes exactly one path. Even under a code error, the Card-1 DB partial
 * unique indexes #4 (one success per cell) + #5 (one active job per cell)
 * make a duplicate-success or duplicate-active-job DB-impossible.
 *
 * Doctrine (cdiscourse-doctrine §1/§3/§6/§7):
 *   - The routing decision reads ONLY a structural smoke tag on the debate
 *     title + an operator enable flag — NO score, heat, popularity, or
 *     engagement signal. It never blocks posting (the argument is already
 *     inserted before this runs; submit returns 201 regardless).
 *   - Enqueue is a fast local INSERT, no provider call — submit stays
 *     NONBLOCKING (the queue makes this MORE true: even the background
 *     direct-dispatch promise is replaced by a row INSERT).
 *   - Server-only; never imported by src/ or app/. No secret is read here.
 */

import type { createServiceClient } from '../supabaseClients.ts';
import { productionEnabledFamilies } from './familyRegistry.ts';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from './mcpBooleanObservationSchema.ts';

/**
 * The synthetic smoke prefix prior smokes use on the debate title. A debate
 * whose title starts with this marker is a synthetic queue-smoke room — the
 * ONLY rooms that may route to the queue (and ONLY when the master enable
 * flag is on). This dedicated, unambiguous prefix cannot collide with an
 * ordinary production room or another smoke ([smoke-test] / [stress] / etc.).
 */
export const CLASSIFIER_QUEUE_SMOKE_TAG = '[arch-001-queue-smoke]';

/**
 * The env flag name the submit-argument Edge Function reads to populate the
 * `enabled` argument of `shouldRouteToQueue`. DEFAULT DISABLED: routing is
 * off unless this env is exactly the string 'true'. The operator flips it
 * on ONLY for the smoke (design §A.11 step 5); Card 3 wires the staged
 * percentage rollout below. Exported so a test can assert the submit-path
 * reads THIS name.
 */
export const CLASSIFIER_QUEUE_ROUTING_ENABLED_ENV = 'CLASSIFIER_QUEUE_ROUTING_ENABLED';

/**
 * The env name for the Card-3 staged-rollout knob. DEFAULT 0 (no
 * percentage routing — only the smoke-tag override routes). When set to a
 * value in (0, 100] the operator is choosing a deterministic-hash subset
 * of NON-smoke-tagged arguments to route to the queue. Smoke-tag override
 * remains active at percentage=0. The MASTER enable flag
 * (CLASSIFIER_QUEUE_ROUTING_ENABLED_ENV) gates BOTH paths — percentage>0
 * with master flag off is INERT.
 */
export const CLASSIFIER_QUEUE_ROUTING_PERCENTAGE_ENV = 'CLASSIFIER_QUEUE_ROUTING_PERCENTAGE';

/**
 * Parse the staged-rollout percentage from a raw env-var string. Total,
 * never throws.
 *
 * Rules:
 *   - missing / empty / non-numeric / NaN          → 0
 *   - negative                                     → 0  (fail-closed)
 *   - > 100                                        → 100 (clamp-up)
 *   - 0..100 inclusive                             → Math.floor(n)
 *
 * The fail-closed-on-negative choice mirrors the master flag's strict
 * `=== 'true'` posture (DEFAULT DISABLED throughout the predicate). The
 * clamp-up-on-overshoot choice is deliberately permissive on the safe
 * direction (no extra routing beyond 100% can happen).
 */
export function parseRoutingPercentage(raw: string | null | undefined): number {
  if (typeof raw !== 'string') return 0;
  const trimmed = raw.trim();
  if (trimmed === '') return 0;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return Math.floor(n);
}

/**
 * Deterministic, locale-independent 32-bit hash of an argument id (or any
 * UTF-16 string). djb2-style: stable across Deno (Edge), Node (jest), and
 * browsers — uses only `charCodeAt`, bitwise ops, and arithmetic. Returns
 * an unsigned 32-bit integer so `hash % 100` is always in [0, 99].
 *
 * Exposed for test assertions on determinism + distribution. The hash has
 * NO security claim (it is not a hash for secrets or auth) — it is a
 * stable bucketing primitive for staged rollout only.
 */
export function stableHashArgumentId(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i += 1) {
    // (h * 33) ^ charCode, kept as unsigned 32-bit.
    h = ((h << 5) + h) ^ id.charCodeAt(i);
    h = h >>> 0;
  }
  return h >>> 0;
}

/** The minimal argument shape the predicate needs (the inserted row). */
export interface RoutingArgument {
  id: string;
  debate_id: string;
}

/** The minimal debate shape the predicate needs (carries the smoke tag). */
export interface RoutingDebate {
  id: string;
  title: string | null;
}

/**
 * PURE predicate: should this argument route to the classifier queue?
 *
 * DEFAULT DISABLED. Returns `false` for EVERY argument unless the master
 * `enabled` flag is true AND either:
 *   (a) the argument's debate is smoke-tagged (title starts with
 *       CLASSIFIER_QUEUE_SMOKE_TAG), OR
 *   (b) Card-3 staged-rollout: `stableHashArgumentId(argument.id) % 100 <
 *       percentage` (default percentage=0 means no percentage routing).
 *
 * Smoke-tag override (a) is independent of percentage — it routes even at
 * percentage=0 (the smoke path the Card-2/3 verification uses). The
 * master flag (enabled) is required for BOTH paths — a percentage>0 with
 * the master flag off is INERT.
 *
 * No network, no env read (the caller passes `enabled` + `percentage`),
 * no score/heat/popularity input. Deterministic and unit-testable.
 *
 * @param argument   the just-inserted argument row.
 * @param debate     the debate the argument belongs to (carries the title).
 * @param enabled    the operator master enable flag (default-off; the Edge
 *                   function reads CLASSIFIER_QUEUE_ROUTING_ENABLED_ENV).
 * @param percentage Card-3 staged rollout knob in [0, 100]. Default 0 =
 *                   smoke-tag-only. The Edge function reads
 *                   CLASSIFIER_QUEUE_ROUTING_PERCENTAGE_ENV through
 *                   `parseRoutingPercentage` which fail-closes any
 *                   invalid/negative input to 0 and clamps overshoot to 100.
 */
export function shouldRouteToQueue(
  argument: RoutingArgument | null | undefined,
  debate: RoutingDebate | null | undefined,
  enabled: boolean,
  percentage: number = 0,
): boolean {
  // Master flag off → DEFAULT DISABLED for everything (the ship state).
  if (enabled !== true) return false;
  if (!argument || !debate) return false;
  // Defensive: the argument must belong to the debate we were handed.
  if (argument.debate_id !== debate.id) return false;
  // Smoke-tag override: ONLY synthetic queue-smoke rooms route here
  // (independent of percentage; this is the Card-2/3 verification path).
  const title = typeof debate.title === 'string' ? debate.title : '';
  if (title.startsWith(CLASSIFIER_QUEUE_SMOKE_TAG)) return true;
  // Staged rollout: percentage routing on NON-smoke-tagged debates only.
  // Re-clamp defensively in case a caller bypassed parseRoutingPercentage.
  const pct = Number.isFinite(percentage) ? Math.floor(percentage) : 0;
  if (pct <= 0) return false;
  if (pct >= 100) return true;
  // Stable hash of argument id; modulo 100 buckets uniformly.
  // Strict-less-than so percentage=N admits buckets [0..N-1] — exactly N
  // out of 100 in expectation.
  return (stableHashArgumentId(argument.id) % 100) < pct;
}

/** Outcome of an enqueue attempt (diagnostic; never throws). */
export interface EnqueueClassifierJobsResult {
  /** Families for which an enqueue_classifier_job call was issued (A–G). */
  attemptedFamilies: string[];
  /** True when every enqueue call returned without an RPC error. */
  ok: boolean;
}

/**
 * Enqueue one classifier job per PRODUCTION family (A–G) for the argument,
 * via a SINGLE multi-row INSERT against `argument_machine_observation_runs`.
 * Card 3: the Card-2 implementation issued 7 sequential
 * `enqueue_classifier_job(...)` RPC calls, which fired the
 * STATEMENT-level kick trigger 7 times per submit (Card-2 burst saw
 * ~106 `skipped_single_flight` audit rows across 15 submits). The
 * multi-row form below issues ONE statement → ONE kick per submit.
 * Kick coalescing is the design intent of the FOR EACH STATEMENT
 * trigger (`arch_001_kick_classifier_drainer_trg`); no migration needed.
 *
 * Run-row defaults match the Card-1 `enqueue_classifier_job` SQL function
 * body byte-for-byte for the columns we set (state='pending';
 * requested_families=[family]; run_mode='production'; schema_version);
 * `available_at`, `started_at`, `created_at`, and `id` rely on column
 * DEFAULTs (NOT NULL DEFAULT now() / gen_random_uuid()) so the row shape
 * is identical to the prior path. H/I/J are NEVER enqueued (only
 * productionEnabledFamilies() — the registry A–G).
 *
 * No ON CONFLICT: a fresh argument id is unique per submit (submit-argument
 * inserts the arguments row first, so duplicate enqueues here only happen
 * on the rare submit-side retry of an already-routed arg; in that case the
 * INSERT errors out atomically and we return ok=false — the prior in-flight
 * row continues processing, cron-tick drainage continues to heal). The
 * supabase-js `.from().insert()` chain cannot express the partial unique
 * index's predicate in its ON CONFLICT clause and a bare ON CONFLICT (cols)
 * does NOT match a partial unique index — so the multi-row path
 * deliberately skips the RPC's idempotency form. The DB partial unique
 * indexes #4 (one success) + #5 (one active job) per cell are the
 * structural backstops.
 *
 * NEVER throws — any error is swallowed and reported via ok=false. Submit
 * must stay nonblocking.
 */
export async function enqueueClassifierJobs(
  argumentId: string,
  debateId: string,
  serviceClient: ReturnType<typeof createServiceClient>,
): Promise<EnqueueClassifierJobsResult> {
  const families = productionEnabledFamilies();
  const rows = families.map((family) => ({
    argument_id: argumentId,
    debate_id: debateId,
    family,
    run_mode: 'production',
    schema_version: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    requested_families: [family],
    state: 'pending',
  }));

  let ok = true;
  try {
    const { error } = await serviceClient
      .from('argument_machine_observation_runs')
      .insert(rows);
    if (error) ok = false;
  } catch {
    ok = false;
  }

  return { attemptedFamilies: families.slice(), ok };
}
