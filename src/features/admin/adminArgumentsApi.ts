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

export interface LoadAdminArgumentsOptions {
  /** Cap rows returned. Defaults to 50. */
  limit?: number;
  /** Optional debate_id filter — when set, returns only that room's arguments. */
  debateId?: string | null;
  /** Optional author_id filter. */
  authorId?: string | null;
  /** When true, includes soft-deleted rows. Off by default. */
  includeDeleted?: boolean;
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
  selected_tag_codes: string[] | null;
  target_excerpt: string | null;
  attached_evidence: unknown[] | null;
  server_validation: Record<string, unknown> | null;
  is_deleted?: boolean;
  debates: { title: string | null } | { title: string | null }[] | null;
  profiles: { display_name: string | null } | { display_name: string | null }[] | null;
}

function asTitle(j: RawArgumentRow['debates']): string | null {
  if (!j) return null;
  if (Array.isArray(j)) return j[0]?.title ?? null;
  return j.title ?? null;
}

function asDisplayName(j: RawArgumentRow['profiles']): string | null {
  if (!j) return null;
  if (Array.isArray(j)) return j[0]?.display_name ?? null;
  return j.display_name ?? null;
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
  let q = supabase
    .from('arguments')
    .select(
      [
        'id', 'debate_id', 'author_id', 'argument_type', 'side', 'body', 'status',
        'created_at', 'updated_at', 'disagreement_axis', 'selected_tag_codes',
        'target_excerpt', 'attached_evidence', 'server_validation', 'is_deleted',
        'debates(title)', 'profiles(display_name)',
      ].join(','),
    )
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (options.debateId) q = q.eq('debate_id', options.debateId);
  if (options.authorId) q = q.eq('author_id', options.authorId);
  if (!options.includeDeleted) q = q.eq('is_deleted', false);

  const { data, error } = await q;
  if (error) throw new Error(`loadAdminArguments failed: ${error.message}`);
  const rows = (data ?? []) as unknown as RawArgumentRow[];
  return rows.map((r) => ({
    id: r.id,
    debateId: r.debate_id,
    debateTitle: asTitle(r.debates),
    authorId: r.author_id,
    authorDisplayName: asDisplayName(r.profiles),
    argumentType: r.argument_type,
    side: r.side,
    body: r.body,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    disagreementAxis: r.disagreement_axis,
    selectedTagCodes: r.selected_tag_codes,
    targetExcerpt: r.target_excerpt,
    hasEvidence: Array.isArray(r.attached_evidence) && r.attached_evidence.length > 0,
    hasFlags: false, // populated by a follow-up query below if needed
    topicSatisfactionScore: extractTopicScore(r.server_validation),
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
