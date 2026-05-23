import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';
import type { Debate, CreateDebateInput, ParticipantSide, JoinResult, DebateApiResult } from './types';

// ── Row types ─────────────────────────────────────────────────

interface DebateRow {
  id: string;
  created_by: string;
  title: string;
  resolution: string;
  description: string;
  status: string;
  constitution_id: string;
  created_at: string;
  updated_at: string;
}

interface ParticipantRow {
  debate_id: string;
  side: string;
}

// ── Helpers ───────────────────────────────────────────────────

function mapDebateRow(row: DebateRow, myParticipantSide: ParticipantSide | null): Debate {
  return {
    id: row.id,
    createdBy: row.created_by,
    title: row.title,
    resolution: row.resolution,
    description: row.description ?? '',
    status: row.status as Debate['status'],
    constitutionId: row.constitution_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    myParticipantSide,
  };
}

/** Returns true when the Supabase error is a unique-key violation (duplicate join). */
export function isAlreadyJoinedError(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

// ── API ───────────────────────────────────────────────────────

export async function listDebates(userId: string): Promise<DebateApiResult<Debate[]>> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'Supabase is not configured.' };

  const [debatesRes, partRes] = await Promise.all([
    supabase
      .from('debates')
      .select('id, created_by, title, resolution, description, status, constitution_id, created_at, updated_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('debate_participants')
      .select('debate_id, side')
      .eq('user_id', userId),
  ]);

  if (debatesRes.error) return { ok: false, error: debatesRes.error.message };

  const sideMap = new Map<string, ParticipantSide>();
  for (const p of (partRes.data ?? []) as ParticipantRow[]) {
    sideMap.set(p.debate_id, p.side as ParticipantSide);
  }

  const debates = ((debatesRes.data ?? []) as DebateRow[]).map((row) =>
    mapDebateRow(row, sideMap.get(row.id) ?? null),
  );

  return { ok: true, data: debates };
}

export async function createDebate(
  input: CreateDebateInput,
  userId: string,
): Promise<DebateApiResult<Debate>> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'Supabase is not configured.' };

  const { data: constitutionRow, error: constError } = await supabase
    .from('constitution_versions')
    .select('id')
    .eq('active', true)
    .single();

  if (constError || !constitutionRow) {
    return { ok: false, error: 'No active constitution found. Ask an admin to publish one.' };
  }

  const { data: debate, error: debateError } = await supabase
    .from('debates')
    .insert({
      created_by: userId,
      title: input.title.trim(),
      resolution: input.resolution.trim(),
      description: input.description.trim(),
      status: 'open',
      constitution_id: (constitutionRow as { id: string }).id,
    })
    .select('id, created_by, title, resolution, description, status, constitution_id, created_at, updated_at')
    .single();

  if (debateError || !debate) {
    return { ok: false, error: debateError?.message ?? 'Failed to create argument.' };
  }

  // Auto-join the creator as moderator (non-fatal if it fails).
  await supabase
    .from('debate_participants')
    .insert({ debate_id: (debate as DebateRow).id, user_id: userId, side: 'moderator' });

  return { ok: true, data: mapDebateRow(debate as DebateRow, 'moderator') };
}

export async function joinDebate(
  debateId: string,
  side: ParticipantSide,
  userId: string,
): Promise<DebateApiResult<JoinResult>> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'Supabase is not configured.' };

  const { error } = await supabase
    .from('debate_participants')
    .insert({ debate_id: debateId, user_id: userId, side });

  if (error) {
    if (isAlreadyJoinedError(error)) {
      const { data: existing } = await supabase
        .from('debate_participants')
        .select('side')
        .eq('debate_id', debateId)
        .eq('user_id', userId)
        .single();
      const existingSide = ((existing as { side?: string } | null)?.side ?? side) as ParticipantSide;
      return { ok: true, data: { side: existingSide, alreadyJoined: true } };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true, data: { side, alreadyJoined: false } };
}
