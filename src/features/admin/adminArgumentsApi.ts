/**
 * Stage 6.1.5.1 — Admin Arguments tab loader.
 *
 * Reads recent `public.arguments` rows joined with `public.debates` (title)
 * and `public.profiles` (display name). Admin RLS already permits the SELECT
 * via `is_moderator_or_admin()`; no Edge Function or service-role path is
 * needed.
 *
 * Pure data layer — no UI imports.
 */
import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';
import type { AdminArgumentRow } from './types';

export type AdminArgumentsSortField = 'updated_at' | 'created_at';
export type AdminArgumentsSortDirection = 'desc' | 'asc';

export interface LoadAdminArgumentsOptions {
  /** Cap rows returned. Defaults to 50. */
  limit?: number;
  /** Optional debate_id filter — when set, returns only that room's arguments. */
  debateId?: string | null;
  /** Optional author_id filter. */
  authorId?: string | null;
  /** When true, includes soft-deleted rows. Off by default. */
  includeDeleted?: boolean;
  /**
   * ADMIN-ARGS-INACTIVE-001 — when true, includes inactive rows
   * (`inactive_at IS NOT NULL`). Default `false`. The admin Show-inactives
   * toggle drives this; admin posture is already gated by RLS
   * (`is_moderator_or_admin()`).
   */
  includeInactives?: boolean;
  /** Sort column. Defaults to `updated_at`. */
  sortField?: AdminArgumentsSortField;
  /** Sort direction. Defaults to `desc` (newest first). */
  sortDirection?: AdminArgumentsSortDirection;
}

interface RawArgumentRow {
  id: string;
  debate_id: string;
  author_id: string | null;
  argument_type: string;
  side: string;
  body: string;
  status: string;
  created_at: string;
  updated_at: string;
  disagreement_axis: string | null;
  // QOL-026: tags are not a scalar column on `public.arguments`. They live
  // in the `public.argument_tags` join table; PostgREST resolves them as a
  // nested embed keyed by the selected columns.
  argument_tags: { tag_code: string }[] | null;
  target_excerpt: string | null;
  server_validation: Record<string, unknown> | null;
  // ADMIN-CONV-INACTIVE-001 — the embed now also selects the parent debate's
  // DEBATE-level `inactive_at` (the #514 conversation-inactivation column). It
  // is distinct from the per-argument `inactive_at` above. We select ONLY
  // `inactive_at` from `debates` — never `debates.inactive_reason` /
  // `debates.inactive_by` (doctrine §10a: the badge shows WHAT, never WHY).
  debates:
    | { title: string | null; inactive_at: string | null }
    | { title: string | null; inactive_at: string | null }[]
    | null;
  profiles: { display_name: string | null } | { display_name: string | null }[] | null;
  // ADMIN-ARGS-INACTIVE-001 — lifecycle visibility columns. All nullable.
  // `inactive_reason` is admin-only; the row carries it but the UI MUST
  // gate rendering on admin row detail (doctrine §10a sensitive composer-only).
  inactive_at: string | null;
  inactive_by: string | null;
  inactive_reason: string | null;
}

function asTitle(j: RawArgumentRow['debates']): string | null {
  if (!j) return null;
  if (Array.isArray(j)) return j[0]?.title ?? null;
  return j.title ?? null;
}

/**
 * ADMIN-CONV-INACTIVE-001 — projects the DEBATE-level `inactive_at` out of the
 * `debates` embed. NULL ⇒ the conversation is active; NOT NULL ⇒ the whole
 * conversation has been inactivated by an admin (#514). Reads ONLY `inactive_at`
 * — never `inactive_reason` / `inactive_by` (doctrine §10a).
 */
function asDebateInactiveAt(j: RawArgumentRow['debates']): string | null {
  if (!j) return null;
  if (Array.isArray(j)) return j[0]?.inactive_at ?? null;
  return j.inactive_at ?? null;
}

function asDisplayName(j: RawArgumentRow['profiles']): string | null {
  if (!j) return null;
  if (Array.isArray(j)) return j[0]?.display_name ?? null;
  return j.display_name ?? null;
}

/**
 * QOL-026: Flattens the embedded `argument_tags` relation into a plain
 * tag-code array. Returns `null` when no tag rows came back so the public
 * `AdminArgumentRow.selectedTagCodes: string[] | null` contract is unchanged
 * (null = "no tag data"). Non-string `tag_code` values are filtered out
 * defensively rather than crashing the whole page.
 */
export function asTagCodes(j: RawArgumentRow['argument_tags']): string[] | null {
  if (!j || !Array.isArray(j) || j.length === 0) return null;
  return j
    .map((t) => (t && typeof t.tag_code === 'string' ? t.tag_code : null))
    .filter((c): c is string => c !== null);
}

function extractTopicScore(serverValidation: Record<string, unknown> | null): number | null {
  if (!serverValidation || typeof serverValidation !== 'object') return null;
  const tsp = (serverValidation as { topicSatisfactionPayload?: { score?: unknown } }).topicSatisfactionPayload;
  if (tsp && typeof tsp.score === 'number') return tsp.score;
  const direct = (serverValidation as { topicSatisfactionScore?: unknown }).topicSatisfactionScore;
  if (typeof direct === 'number') return direct;
  return null;
}

export async function loadAdminArguments(options: LoadAdminArgumentsOptions = {}): Promise<AdminArgumentRow[]> {
  if (!SUPABASE_CONFIGURED) return [];
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 500);
  const sortField: AdminArgumentsSortField = options.sortField === 'created_at' ? 'created_at' : 'updated_at';
  const sortDirection: AdminArgumentsSortDirection = options.sortDirection === 'asc' ? 'asc' : 'desc';
  let q = supabase
    .from('arguments')
    .select(
      [
        'id', 'debate_id', 'author_id', 'argument_type', 'side', 'body', 'status',
        'created_at', 'updated_at', 'disagreement_axis', 'argument_tags(tag_code)',
        'target_excerpt', 'server_validation',
        'inactive_at', 'inactive_by', 'inactive_reason',
        // OPS-ADMIN-ARGS-PROFILES-EMBED-001 — `arguments` has TWO FKs to
        // `profiles` (`author_id` → `arguments_author_id_fkey` from the initial
        // schema, and `inactive_by` → `arguments_inactive_by_fkey` added by
        // #480). A bare `profiles(...)` embed is now ambiguous and PostgREST
        // refuses it. Pin the author FK so the relationship resolves; the
        // returned JSON key stays `profiles`, so `asDisplayName(r.profiles)`
        // below is unchanged. We intentionally do NOT embed the inactivator's
        // profile (doctrine §10a — never surface who inactivated a row).
        //
        // ADMIN-CONV-INACTIVE-001 — the `debates` embed now also selects the
        // DEBATE-level `inactive_at` (the #514 conversation-inactivation state)
        // so the room-group header can derive `isDebateInactive`. `arguments`
        // has exactly ONE FK to `debates` (`debate_id` → `arguments_debate_id_fkey`),
        // so the bare `debates(...)` embed is unambiguous. We select ONLY
        // `inactive_at` — NEVER `debates.inactive_reason` / `debates.inactive_by`
        // (doctrine §10a: the badge shows WHAT is inactive, never WHY).
        'debates(title, inactive_at)', 'profiles!arguments_author_id_fkey(display_name)',
      ].join(','),
    )
    .order(sortField, { ascending: sortDirection === 'asc' })
    .limit(limit);
  if (options.debateId) q = q.eq('debate_id', options.debateId);
  if (options.authorId) q = q.eq('author_id', options.authorId);
  // Soft-delete sentinel lives on `arguments.status` (value 'deleted').
  // There is no `is_deleted` column on the table — schema has only the
  // status enum (draft/posted/deleted/...), per Stage 6.1.8.
  if (!options.includeDeleted) q = q.neq('status', 'deleted');
  // ADMIN-ARGS-INACTIVE-001 — Show-inactives toggle. Default OFF: SQL-layer
  // exclusion of `inactive_at IS NOT NULL` rows. Admin RLS already permits
  // SELECTing inactive rows; this predicate is the loader-side filter that
  // backs the Show-inactives toggle.
  if (!options.includeInactives) q = q.is('inactive_at', null);

  const { data, error } = await q;
  if (error) throw new Error(`loadAdminArguments failed: ${error.message}`);
  const rows = (data ?? []) as unknown as RawArgumentRow[];
  return rows.map((r) => ({
    id: r.id,
    debateId: r.debate_id,
    debateTitle: asTitle(r.debates),
    // ADMIN-CONV-INACTIVE-001 — DEBATE-level (conversation) inactive state,
    // distinct from the per-argument `inactiveAt` below. NULL = active.
    debateInactiveAt: asDebateInactiveAt(r.debates),
    authorId: r.author_id,
    authorDisplayName: asDisplayName(r.profiles),
    argumentType: r.argument_type,
    side: r.side,
    body: r.body,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    disagreementAxis: r.disagreement_axis,
    selectedTagCodes: asTagCodes(r.argument_tags),
    targetExcerpt: r.target_excerpt,
    hasFlags: false, // populated by a follow-up query below if needed
    topicSatisfactionScore: extractTopicScore(r.server_validation),
    inactiveAt: r.inactive_at,
    inactiveBy: r.inactive_by,
    inactiveReason: r.inactive_reason,
  }));
}

export async function countArgumentFlags(argumentIds: string[]): Promise<Record<string, number>> {
  if (!SUPABASE_CONFIGURED || argumentIds.length === 0) return {};
  const { data, error } = await supabase
    .from('argument_flags')
    .select('argument_id')
    .in('argument_id', argumentIds);
  if (error) return {};
  const out: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ argument_id: string }>) {
    out[row.argument_id] = (out[row.argument_id] || 0) + 1;
  }
  return out;
}
