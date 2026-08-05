/**
 * UX-FLAGS-005 (issue 837) — Read-only fetcher for classifier lifecycle
 * roll-ups from `public.argument_machine_observation_runs`.
 *
 * Mirrors the META-1A / MCP-021B precedent (`fetchPointTagsForArguments`,
 * `fetchPersistedObservationsForArguments`): a typed Supabase SELECT
 * through the shared authed client. No service-role, no mutation helper,
 * no realtime channel (deferred to a v2 card).
 *
 * All comments in this file are apostrophe-free so the uxOneOneTwoDoctrine
 * naive quote-parity scanner does not mis-parse the file.
 *
 * RLS gates visibility. The callers auth.uid() must satisfy the
 * `amor_runs_select_via_argument` policy (migration
 * 20260526000018_mcp_021b_machine_observation_results.sql lines 162-175),
 * which inherits from `arguments` via the QOL-039 SECURITY DEFINER helpers.
 * Non-participants of a private room receive zero rows. Unauthenticated
 * callers receive zero rows.
 *
 * Errors are returned as `{ ok: false, error }`; the calling hook degrades
 * to an empty map (which folds to `'ready'` at the discriminant layer). We
 * NEVER surface a fetch error as a lifecycle state (cdiscourse-doctrine
 * section 4 + section 9).
 *
 * Doctrine anchors:
 *   - Read-only SELECT: the documented exception to the "Edge Function is
 *     the only write path" rule (same posture as
 *     `fetchPointTagsForArguments`, `fetchPersistedObservationsForArguments`).
 *   - No service-role; uses the shared authed `supabase` client.
 *   - No mutation helper; no INSERT / UPDATE / DELETE / UPSERT export.
 *   - No ORDER BY on engagement / popularity / heat -- rows come back in
 *     RLS-permitted natural order; the fold is order-independent
 *     (cdiscourse-doctrine section 3).
 *   - No `run_mode` filter -- pending / dead-lettered rows in
 *     `admin_validation` mode are still lifecycle activity for the owning
 *     argument; the source-6 filter is a result-rendering concern that
 *     lives in `fetchPersistedObservationsForArguments`.
 *   - Only `argument_id` and `state` are selected. No `provider_key`,
 *     `model_name`, `input_hash`, `failure_reason`, `failure_sub_reason`,
 *     `dead_letter_reason`, `lease_owner`, or `last_attempt_at` is
 *     touched (cdiscourse-doctrine section 6 + section 9).
 */

import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';
import type { MachineObservationRunLifecycleState } from '../nodeLabels/machineObservationPersistenceTypes';
import type { ArgumentClassifierLifecycleRollup } from './pointFeedbackFlagsLifecycleModel';
import { foldRunRowsIntoRollup } from './pointFeedbackFlagsLifecycleModel';

export type FetchClassifierLifecycleResult =
  | { ok: true; data: ArgumentClassifierLifecycleRollup[] }
  | { ok: false; error: string };

interface RawRunLifecycleRow {
  argument_id: string;
  state: string;
}

/**
 * MINIMAL projection: only the two columns the fold consumes. Nothing
 * else. See file header doctrine list for why every other column stays
 * server-side.
 */
const SELECT_COLUMNS = 'argument_id,state';

/**
 * Hard cap on argument ids per query, mirroring the gallery / persisted-
 * observation loaders PostgREST `in()` budget.
 */
const ID_BATCH_CAP = 1000;

/**
 * Fetch a per-argument classifier lifecycle roll-up for the given ids in
 * one batched query. Read-only.
 *
 *   - `!SUPABASE_CONFIGURED`         -> `{ ok: true, data: [] }` (offline-safe)
 *   - empty / non-array argumentIds  -> `{ ok: true, data: [] }`
 *   - hard cap at ID_BATCH_CAP ids   -> excess ids are silently dropped
 *     (same posture as `fetchPersistedObservationsForArguments`)
 *   - error path                     -> `{ ok: false, error: string }`
 *   - Empty `data` from Supabase     -> `{ ok: true, data: [] }`
 *
 * Never throws. Never mutates. Never writes.
 */
export async function fetchClassifierLifecycleForArguments(
  argumentIds: ReadonlyArray<string>,
): Promise<FetchClassifierLifecycleResult> {
  if (!SUPABASE_CONFIGURED) return { ok: true, data: [] };
  if (!Array.isArray(argumentIds) || argumentIds.length === 0) {
    return { ok: true, data: [] };
  }
  const ids = argumentIds.slice(0, ID_BATCH_CAP);
  const { data, error } = await supabase
    .from('argument_machine_observation_runs')
    .select(SELECT_COLUMNS)
    .in('argument_id', ids);
  if (error) return { ok: false, error: error.message };

  // Group raw rows by argument id, then fold into the roll-up shape. The
  // fold is order-independent (booleans OR) so any Supabase ordering is
  // fine here.
  const rowsByArgumentId = new Map<
    string,
    Array<{ state: MachineObservationRunLifecycleState | string }>
  >();
  for (const raw of (data ?? []) as unknown as RawRunLifecycleRow[]) {
    if (typeof raw?.argument_id !== 'string' || typeof raw?.state !== 'string') continue;
    let list = rowsByArgumentId.get(raw.argument_id);
    if (!list) {
      list = [];
      rowsByArgumentId.set(raw.argument_id, list);
    }
    list.push({ state: raw.state });
  }

  const rollups: ArgumentClassifierLifecycleRollup[] = [];
  for (const argId of rowsByArgumentId.keys()) {
    const runs = rowsByArgumentId.get(argId) ?? [];
    rollups.push(foldRunRowsIntoRollup(argId, runs));
  }
  return { ok: true, data: rollups };
}
