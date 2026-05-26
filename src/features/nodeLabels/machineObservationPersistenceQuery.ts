/**
 * MCP-021B — Read-only fetcher for persisted Machine Observation result rows.
 *
 * Mirrors the META-1A precedent (`fetchPointTagsForArguments` in
 * `src/features/arguments/argumentsApi.ts:281-295`): a typed Supabase
 * SELECT with the shared authed client, no service-role, no mutation
 * helper, no realtime channel (deferred to a future card).
 *
 * RLS gates visibility — the caller's `auth.uid()` must satisfy the
 * `amor_results_select_via_run` policy (which inherits from runs →
 * arguments). Non-participants of a private room receive zero rows.
 * Unauthenticated callers receive zero rows.
 *
 * Errors are returned as `{ ok: false, error }`; callers degrade
 * gracefully (the adapter returns `[]` downstream).
 *
 * MCP-021C-EDGE bounded edit: the SELECT now INNER JOINs the runs table
 * and filters `runs.run_mode = 'production'`. This is the design's §8
 * "Source 6 filter requirement" implemented at the query layer
 * (Decision 9 "preferred"). Admin-validation rows are persisted for
 * operator audit but never reach Source 6 rendering. The MCP-021A
 * Source 6 byte-equal-on-empty-input invariance is preserved (this
 * function returns rows BEFORE they reach the adapter; the adapter's
 * contract on empty input is unchanged).
 *
 * Doctrine:
 *   - Read-only SELECT — the documented exception to the "Edge Function
 *     is the only write path" rule (same as `fetchPointTagsForArguments`).
 *   - No service-role; uses the shared authed `supabase` client.
 *   - No mutation helper, no INSERT / UPDATE / DELETE wrapper.
 *   - No ORDER BY engagement / popularity / heat — rows are returned in
 *     RLS-permitted natural order; downstream presentation applies its
 *     own ordering rules (cdiscourse-doctrine §3).
 *   - run_mode discriminates PURPOSE, never participant or content
 *     judgment (cdiscourse-doctrine §1, §10a).
 */

import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';
import type {
  MachineObservationConfidence,
  MachineObservationResultRow,
} from './machineObservationPersistenceTypes';

export type FetchPersistedObservationsResult =
  | { ok: true; data: MachineObservationResultRow[] }
  | { ok: false; error: string };

interface RawPersistedRow {
  id: string;
  run_id: string;
  debate_id: string;
  argument_id: string;
  schema_version: string;
  raw_key: string;
  family: string;
  confidence: string;
  evidence_span: string | null;
  created_at: string;
  /**
   * MCP-021C-EDGE: PostgREST's `!inner` join hangs the joined runs row(s) on
   * the result. We don't surface this to callers — `mapRawRow` drops it —
   * but the field has to exist on the raw shape so the filter `.eq` works.
   */
  argument_machine_observation_runs?: unknown;
}

/**
 * MCP-021C-EDGE bounded edit: `!inner` forces PostgREST to perform an
 * INNER JOIN on the runs table so we can filter `runs.run_mode = 'production'`.
 * Only the joined column we filter on is requested (`run_mode`) — that
 * minimises the response payload while keeping the filter possible.
 */
const SELECT_COLUMNS =
  'id,run_id,debate_id,argument_id,schema_version,raw_key,family,confidence,evidence_span,created_at,argument_machine_observation_runs!inner(run_mode)';

function mapRawRow(raw: RawPersistedRow): MachineObservationResultRow {
  return {
    id: raw.id,
    runId: raw.run_id,
    debateId: raw.debate_id,
    argumentId: raw.argument_id,
    schemaVersion: raw.schema_version,
    rawKey: raw.raw_key,
    family: raw.family,
    // Adapter re-validates confidence via isMachineObservationConfidence;
    // narrowing here is convenience only.
    confidence: raw.confidence as MachineObservationConfidence,
    evidenceSpan: raw.evidence_span,
    createdAt: raw.created_at,
    // The joined `argument_machine_observation_runs.run_mode` is used at
    // the query layer for filtering only — it is NOT echoed onto the
    // result row shape (the result row interface remains as MCP-021B
    // defined it). This keeps downstream consumers byte-equal.
  };
}

/**
 * Fetch persisted Machine Observation result rows for the given argument
 * ids in one batched query.
 *
 *   - Read-only SELECT; documented exception to the "Edge Function is the
 *     only write path" rule (same pattern as `fetchPointTagsForArguments`).
 *   - Uses the shared authed `supabase` client (no service-role).
 *   - RLS gates visibility via the `amor_results_select_via_run` policy.
 *   - Empty `argumentIds` short-circuits with `{ ok: true, data: [] }`.
 *   - Hard cap of 1000 ids matches the gallery loader's PostgREST `in()` budget.
 *   - `SUPABASE_CONFIGURED` false → `{ ok: true, data: [] }` (offline-safe).
 *
 * NO write helpers exported from this file. NO service-role import.
 */
export async function fetchPersistedObservationsForArguments(
  argumentIds: ReadonlyArray<string>,
): Promise<FetchPersistedObservationsResult> {
  if (!SUPABASE_CONFIGURED) return { ok: true, data: [] };
  if (!Array.isArray(argumentIds) || argumentIds.length === 0) {
    return { ok: true, data: [] };
  }
  // Hard cap matches the gallery loader's PostgREST `in()` budget.
  const ids = argumentIds.slice(0, 1000);
  const { data, error } = await supabase
    .from('argument_machine_observation_results')
    .select(SELECT_COLUMNS)
    .in('argument_id', ids)
    // MCP-021C-EDGE — filter to production-only runs at the query layer.
    // Admin-validation rows are still persisted in the database (for
    // operator audit) but never reach Source 6 rendering.
    .eq('argument_machine_observation_runs.run_mode', 'production');
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    data: ((data ?? []) as unknown as RawPersistedRow[]).map(mapRawRow),
  };
}
