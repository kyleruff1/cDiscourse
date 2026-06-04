import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';
import type {
  ArgumentRow,
  ArgumentTag,
  ArgumentFlag,
  TopicSatisfactionCheck,
  ArgumentRelations,
  DisagreementAxis,
  PersistedPointTag,
} from './types';
import type { ManualTagCode } from '../metadata/moveMetadataLedger';
import type {
  MachineObservationConfidence,
  MachineObservationResultRow,
} from '../nodeLabels/machineObservationPersistenceTypes';

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

// ── Row mappers ───────────────────────────────────────────────

interface RawArgument {
  id: string; debate_id: string; parent_id: string | null; author_id: string;
  argument_type: string; side: string; body: string; depth: number; status: string;
  target_excerpt: string | null; disagreement_axis: string | null;
  rail_payload: Record<string, unknown>; client_validation: Record<string, unknown>;
  server_validation: Record<string, unknown>; client_submission_id: string | null;
  created_at: string; updated_at: string;
  // ADMIN-ARGS-INACTIVE-001 — nullable lifecycle column. Non-admin viewers
  // should never see a non-null value here (RLS + loader predicate); the
  // belt-and-braces pure-TS filters compare against null defensively.
  inactive_at: string | null;
}

interface RawTag { argument_id: string; tag_code: string; created_at: string; }
interface RawPointTag {
  id: string; debate_id: string; argument_id: string; tag_code: string;
  tagged_by: string; created_at: string; removed_at: string | null;
}
interface RawFlag {
  id: string; debate_id: string; argument_id: string; flag_code: string;
  rule_code: string | null; source: string; confidence: number | null;
  status: string; created_at: string;
}
interface RawCheck {
  id: string; debate_id: string; argument_id: string; method: string;
  score: number; threshold: number; status: string;
  matched_terms: string[]; missing_terms: string[]; created_at: string;
}

// MCP-021B — raw Supabase row shape for argument_machine_observation_results.
interface RawPersistedObservationRow {
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
}

function mapArgument(r: RawArgument): ArgumentRow {
  return {
    id: r.id, debateId: r.debate_id, parentId: r.parent_id, authorId: r.author_id,
    argumentType: r.argument_type as ArgumentRow['argumentType'],
    side: r.side as ArgumentRow['side'],
    body: r.body, depth: r.depth,
    status: r.status as ArgumentRow['status'],
    targetExcerpt: r.target_excerpt,
    disagreementAxis: r.disagreement_axis as DisagreementAxis | null,
    railPayload: r.rail_payload ?? {},
    clientValidation: r.client_validation ?? {},
    serverValidation: r.server_validation ?? {},
    clientSubmissionId: r.client_submission_id,
    createdAt: r.created_at, updatedAt: r.updated_at,
    inactiveAt: r.inactive_at ?? null,
  };
}

function mapTag(r: RawTag): ArgumentTag {
  return { argumentId: r.argument_id, tagCode: r.tag_code, createdAt: r.created_at };
}

function mapPointTag(r: RawPointTag): PersistedPointTag {
  return {
    id: r.id,
    debateId: r.debate_id,
    argumentId: r.argument_id,
    tagCode: r.tag_code as ManualTagCode,
    taggedBy: r.tagged_by,
    createdAt: r.created_at,
    removedAt: r.removed_at,
  };
}

function mapFlag(r: RawFlag): ArgumentFlag {
  return {
    id: r.id, debateId: r.debate_id, argumentId: r.argument_id,
    flagCode: r.flag_code, ruleCode: r.rule_code,
    source: r.source as ArgumentFlag['source'],
    confidence: r.confidence,
    status: r.status as ArgumentFlag['status'],
    createdAt: r.created_at,
  };
}

function mapCheck(r: RawCheck): TopicSatisfactionCheck {
  return {
    id: r.id, debateId: r.debate_id, argumentId: r.argument_id,
    method: r.method as TopicSatisfactionCheck['method'],
    score: r.score, threshold: r.threshold,
    status: r.status as TopicSatisfactionCheck['status'],
    matchedTerms: r.matched_terms ?? [], missingTerms: r.missing_terms ?? [],
    createdAt: r.created_at,
  };
}

// MCP-021B — snake_case → camelCase mapper for persisted observation rows.
// The adapter re-validates confidence via isMachineObservationConfidence;
// the cast here is convenience only.
function mapPersistedObservationRow(r: RawPersistedObservationRow): MachineObservationResultRow {
  return {
    id: r.id,
    runId: r.run_id,
    debateId: r.debate_id,
    argumentId: r.argument_id,
    schemaVersion: r.schema_version,
    rawKey: r.raw_key,
    family: r.family,
    confidence: r.confidence as MachineObservationConfidence,
    evidenceSpan: r.evidence_span,
    createdAt: r.created_at,
  };
}

const ARG_SELECT =
  'id,debate_id,parent_id,author_id,argument_type,side,body,depth,status,' +
  'target_excerpt,disagreement_axis,rail_payload,client_validation,server_validation,' +
  'client_submission_id,created_at,updated_at,inactive_at';

// ── API ───────────────────────────────────────────────────────

export async function listRootArguments(
  debateId: string,
  limit: number,
  cursor?: string,
): Promise<ApiResult<ArgumentRow[]>> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'Supabase is not configured.' };

  let q = supabase
    .from('arguments')
    .select(ARG_SELECT)
    .eq('debate_id', debateId)
    .is('parent_id', null)
    .eq('status', 'posted')
    // ADMIN-ARGS-INACTIVE-001 — belt-and-braces filter. RLS already excludes
    // inactive rows for non-admin viewers; this predicate is an explicit
    // SQL-layer anchor so the loader matches the policy and the partial
    // index `arguments_inactive_at_null_idx` is used.
    .is('inactive_at', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (cursor) q = q.gt('created_at', cursor);

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: ((data ?? []) as unknown as RawArgument[]).map(mapArgument) };
}

/**
 * Stage 6.3 — Batched gallery loader.
 *
 * Loads posted arguments for a SET of debate ids in one `.in()` call. The
 * Conversation Gallery uses this to derive first-post / latest-move
 * excerpts and move counts for all visible cards without N+1 queries.
 *
 * - No service-role.
 * - RLS still gates row visibility.
 * - `limit` is the total cap across all returned rows; callers should
 *   request a budget proportional to debate count × max moves per debate.
 */
export async function listArgumentsForDebateIds(
  debateIds: string[],
  limit: number = 1500,
): Promise<ApiResult<ArgumentRow[]>> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'Supabase is not configured.' };
  if (debateIds.length === 0) return { ok: true, data: [] };
  // Hard cap input size to keep the request reasonable. PostgREST's `in()`
  // tolerates up to ~1000 ids but we stop earlier to keep the URL small.
  const ids = debateIds.slice(0, 200);

  const { data, error } = await supabase
    .from('arguments')
    .select(ARG_SELECT)
    .in('debate_id', ids)
    .eq('status', 'posted')
    // ADMIN-ARGS-INACTIVE-001 — belt-and-braces filter. RLS already excludes
    // inactive rows for non-admin viewers; this predicate is an explicit
    // SQL-layer anchor so the loader matches the policy and the partial
    // index `arguments_inactive_at_null_idx` is used.
    .is('inactive_at', null)
    .order('debate_id', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(Math.max(1, Math.min(limit, 5000)));

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: ((data ?? []) as unknown as RawArgument[]).map(mapArgument) };
}

/**
 * Stage 6.2 — Full-room loader for the game surface (Stack + Timeline).
 *
 * Loads ALL posted arguments visible to RLS in a debate, ordered by
 * `created_at` ascending. Does not depend on expanded/collapsed tree
 * state. Hard-caps at `limit` (default 1000) and returns the next cursor
 * for callers that need to page beyond the cap.
 *
 * - No service-role.
 * - No view bypass; RLS still gates visibility.
 */
export async function listArgumentsForDebate(
  debateId: string,
  limit: number = 1000,
  cursor?: string,
): Promise<ApiResult<ArgumentRow[]>> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'Supabase is not configured.' };

  let q = supabase
    .from('arguments')
    .select(ARG_SELECT)
    .eq('debate_id', debateId)
    .eq('status', 'posted')
    // ADMIN-ARGS-INACTIVE-001 — belt-and-braces filter. RLS already excludes
    // inactive rows for non-admin viewers; this predicate is an explicit
    // SQL-layer anchor so the loader matches the policy and the partial
    // index `arguments_inactive_at_null_idx` is used.
    .is('inactive_at', null)
    .order('created_at', { ascending: true })
    .limit(Math.max(1, Math.min(limit, 5000)));

  if (cursor) q = q.gt('created_at', cursor);

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: ((data ?? []) as unknown as RawArgument[]).map(mapArgument) };
}

export async function listChildArguments(
  debateId: string,
  parentId: string,
  limit: number,
  cursor?: string,
): Promise<ApiResult<ArgumentRow[]>> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'Supabase is not configured.' };

  let q = supabase
    .from('arguments')
    .select(ARG_SELECT)
    .eq('debate_id', debateId)
    .eq('parent_id', parentId)
    .eq('status', 'posted')
    // ADMIN-ARGS-INACTIVE-001 — belt-and-braces filter. RLS already excludes
    // inactive rows for non-admin viewers; this predicate is an explicit
    // SQL-layer anchor so the loader matches the policy and the partial
    // index `arguments_inactive_at_null_idx` is used.
    .is('inactive_at', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (cursor) q = q.gt('created_at', cursor);

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: ((data ?? []) as unknown as RawArgument[]).map(mapArgument) };
}

export async function fetchArgumentRelations(
  argumentIds: string[],
): Promise<ApiResult<ArgumentRelations>> {
  if (!SUPABASE_CONFIGURED) {
    return { ok: true, data: { tags: [], flags: [], checks: [], pointTags: [], persistedObservations: [] } };
  }
  if (argumentIds.length === 0) {
    return { ok: true, data: { tags: [], flags: [], checks: [], pointTags: [], persistedObservations: [] } };
  }

  const [tagsRes, flagsRes, checksRes, pointTagsRes, persistedObsRes] = await Promise.all([
    supabase
      .from('argument_tags')
      .select('argument_id,tag_code,created_at')
      .in('argument_id', argumentIds),
    supabase
      .from('argument_flags')
      .select('id,debate_id,argument_id,flag_code,rule_code,source,confidence,status,created_at')
      .in('argument_id', argumentIds)
      .not('status', 'eq', 'dismissed'),
    supabase
      .from('topic_satisfaction_checks')
      .select('id,debate_id,argument_id,method,score,threshold,status,matched_terms,missing_terms,created_at')
      .in('argument_id', argumentIds),
    // META-1A — persisted manual tags. Active rows only (`removed_at is
    // null`). This is a read-only SELECT — the documented exception to the
    // "Edge Function is the only write path" rule.
    supabase
      .from('point_tags')
      .select('id,debate_id,argument_id,tag_code,tagged_by,created_at,removed_at')
      .in('argument_id', argumentIds)
      .is('removed_at', null),
    // MCP-021B — persisted Machine Observation result rows. Read-only SELECT;
    // RLS gates visibility via amor_results_select_via_run (inherits from runs
    // → arguments via QOL-039 SECURITY DEFINER helpers). Empty when MCP-021C
    // has not yet written for the room, or when the caller is unauthorized.
    supabase
      .from('argument_machine_observation_results')
      .select(
        'id,run_id,debate_id,argument_id,schema_version,raw_key,family,confidence,evidence_span,created_at',
      )
      .in('argument_id', argumentIds),
  ]);

  return {
    ok: true,
    data: {
      tags: ((tagsRes.data ?? []) as RawTag[]).map(mapTag),
      flags: ((flagsRes.data ?? []) as RawFlag[]).map(mapFlag),
      checks: ((checksRes.data ?? []) as RawCheck[]).map(mapCheck),
      pointTags: ((pointTagsRes.data ?? []) as RawPointTag[]).map(mapPointTag),
      persistedObservations: ((persistedObsRes.data ?? []) as RawPersistedObservationRow[]).map(
        mapPersistedObservationRow,
      ),
    },
  };
}

/**
 * META-1B — Scoped reconcile fetcher for the realtime channel.
 *
 * Returns the active set of `point_tags` rows for the supplied argument ids
 * in one batched query. Used by `usePointTagsRealtime` on `SUBSCRIBED` and
 * on every reconnect to converge state with the server after a missed
 * events window.
 *
 * - Read-only SELECT — the documented exception to the
 *   "Edge Function is the only write path" rule (same as
 *   `fetchArgumentRelations`).
 * - No service-role; uses the shared authed `supabase` client. RLS gates
 *   visibility (private rooms inherit the QOL-039 access check via
 *   `pt_select_read_access`'s EXISTS on `public.arguments`).
 * - Empty `argumentIds` short-circuits with `ok: true, data: []` so the
 *   reconcile path is safe on rooms with zero messages.
 * - Errors return `ok: false` so the hook can fall back to the loader's
 *   full `refresh()` as a safety net.
 *
 * Pure transport (no scoring, no AI, no derivation).
 */
export async function fetchPointTagsForArguments(
  argumentIds: ReadonlyArray<string>,
): Promise<ApiResult<PersistedPointTag[]>> {
  if (!SUPABASE_CONFIGURED) return { ok: true, data: [] };
  if (argumentIds.length === 0) return { ok: true, data: [] };
  // Hard cap matches the gallery loader's PostgREST `in()` budget.
  const ids = argumentIds.slice(0, 1000);
  const { data, error } = await supabase
    .from('point_tags')
    .select('id,debate_id,argument_id,tag_code,tagged_by,created_at,removed_at')
    .in('argument_id', ids)
    .is('removed_at', null);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: ((data ?? []) as RawPointTag[]).map(mapPointTag) };
}
