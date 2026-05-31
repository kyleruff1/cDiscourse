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
 * on ONLY for the smoke (design §A.11 step 5); Card 3 owns any production
 * rollout. Exported so a test can assert the submit-path reads THIS name.
 */
export const CLASSIFIER_QUEUE_ROUTING_ENABLED_ENV = 'CLASSIFIER_QUEUE_ROUTING_ENABLED';

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
 * DEFAULT DISABLED. Returns `false` for EVERY argument unless BOTH:
 *   - `enabled` is true (the operator-set master flag — default false), AND
 *   - the argument's debate is smoke-tagged (title starts with
 *     CLASSIFIER_QUEUE_SMOKE_TAG).
 *
 * No network, no env read (the caller passes `enabled`), no score/heat/
 * popularity input. Deterministic and unit-testable.
 *
 * @param argument the just-inserted argument row.
 * @param debate   the debate the argument belongs to (carries the title).
 * @param enabled  the operator master enable flag (default-off; the Edge
 *                 function reads CLASSIFIER_QUEUE_ROUTING_ENABLED_ENV).
 */
export function shouldRouteToQueue(
  argument: RoutingArgument | null | undefined,
  debate: RoutingDebate | null | undefined,
  enabled: boolean,
): boolean {
  // Master flag off → DEFAULT DISABLED for everything (the ship state).
  if (enabled !== true) return false;
  if (!argument || !debate) return false;
  // Defensive: the argument must belong to the debate we were handed.
  if (argument.debate_id !== debate.id) return false;
  // Smoke-tag check: ONLY synthetic queue-smoke rooms route.
  const title = typeof debate.title === 'string' ? debate.title : '';
  return title.startsWith(CLASSIFIER_QUEUE_SMOKE_TAG);
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
 * by calling the Card-1 `enqueue_classifier_job` SQL function. Each call is
 * idempotent (INSERT … ON CONFLICT DO NOTHING via index #5), so a duplicate
 * enqueue for an active cell is a no-op. H/I/J are NEVER enqueued (only
 * productionEnabledFamilies() — the registry A–G).
 *
 * run_mode is always 'production' for the queue (the auto path never runs
 * admin_validation). schema_version is the single source-of-truth constant.
 *
 * NEVER throws — a per-family RPC error is swallowed (the periodic tick /
 * the next enqueue heal it; and submit must stay nonblocking). Returns a
 * diagnostic summary. The submit-argument call site does NOT await-block its
 * 201 on this (the enqueue is fast, but the response posture matches the
 * existing fire-and-forget dispatch).
 */
export async function enqueueClassifierJobs(
  argumentId: string,
  debateId: string,
  serviceClient: ReturnType<typeof createServiceClient>,
): Promise<EnqueueClassifierJobsResult> {
  const families = productionEnabledFamilies();
  const attemptedFamilies: string[] = [];
  let ok = true;

  for (const family of families) {
    attemptedFamilies.push(family);
    try {
      const { error } = await serviceClient.rpc('enqueue_classifier_job', {
        p_argument_id: argumentId,
        p_debate_id: debateId,
        p_family: family,
        p_run_mode: 'production',
        p_schema_version: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
      });
      if (error) ok = false;
    } catch {
      ok = false;
    }
  }

  return { attemptedFamilies, ok };
}
