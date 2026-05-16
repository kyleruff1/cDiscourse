import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';
import type {
  ArgumentRow,
  ArgumentTag,
  ArgumentFlag,
  TopicSatisfactionCheck,
  ArgumentRelations,
  DisagreementAxis,
} from './types';

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

// ── Row mappers ───────────────────────────────────────────────

interface RawArgument {
  id: string; debate_id: string; parent_id: string | null; author_id: string;
  argument_type: string; side: string; body: string; depth: number; status: string;
  target_excerpt: string | null; disagreement_axis: string | null;
  rail_payload: Record<string, unknown>; client_validation: Record<string, unknown>;
  server_validation: Record<string, unknown>; client_submission_id: string | null;
  created_at: string; updated_at: string;
}

interface RawTag { argument_id: string; tag_code: string; created_at: string; }
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
  };
}

function mapTag(r: RawTag): ArgumentTag {
  return { argumentId: r.argument_id, tagCode: r.tag_code, createdAt: r.created_at };
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

const ARG_SELECT =
  'id,debate_id,parent_id,author_id,argument_type,side,body,depth,status,' +
  'target_excerpt,disagreement_axis,rail_payload,client_validation,server_validation,' +
  'client_submission_id,created_at,updated_at';

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
    .order('created_at', { ascending: true })
    .limit(limit);

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
  if (!SUPABASE_CONFIGURED) return { ok: true, data: { tags: [], flags: [], checks: [] } };
  if (argumentIds.length === 0) return { ok: true, data: { tags: [], flags: [], checks: [] } };

  const [tagsRes, flagsRes, checksRes] = await Promise.all([
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
  ]);

  return {
    ok: true,
    data: {
      tags: ((tagsRes.data ?? []) as RawTag[]).map(mapTag),
      flags: ((flagsRes.data ?? []) as RawFlag[]).map(mapFlag),
      checks: ((checksRes.data ?? []) as RawCheck[]).map(mapCheck),
    },
  };
}
