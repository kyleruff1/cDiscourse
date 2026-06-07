import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';
import type {
  Debate,
  CreateDebateInput,
  ParticipantSide,
  JoinResult,
  DebateApiResult,
  RoomVisibility,
} from './types';

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
  /** QOL-039 — column added by migration `20260524000015`. */
  visibility: string;
  /**
   * ADMIN-CONV-INACTIVE-VISIBILITY-001 — column added by migration
   * `20260606000001` (#514). `null` = active; non-null = inactive. The WHAT
   * only — `inactive_reason` is NEVER selected, mapped, or surfaced (§10a).
   */
  inactive_at: string | null;
}

interface ParticipantRow {
  debate_id: string;
  side: string;
}

// ── Helpers ───────────────────────────────────────────────────

/**
 * Coerce the DB column to the typed union, defaulting to `'public'` so a
 * pre-migration row (extremely unlikely; the migration backfills) or a
 * future-unknown value never undefined-poisons downstream consumers.
 */
function coerceVisibility(value: unknown): RoomVisibility {
  return value === 'private' ? 'private' : 'public';
}

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
    visibility: coerceVisibility(row.visibility),
    // ADMIN-CONV-INACTIVE-VISIBILITY-001 — thread the debate-level inactive
    // timestamp (#514). Default to null (active) when absent. `inactive_reason`
    // is never read here (§10a).
    inactiveAt: row.inactive_at ?? null,
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
      .select('id, created_by, title, resolution, description, status, constitution_id, created_at, updated_at, visibility, inactive_at')
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

  // QOL-039 — RLS at `debates: select public-open, own, or participant`
  // already withholds private rooms the caller cannot see. No belt-and-
  // suspenders WHERE clause here; the RLS boundary is authoritative.
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

  // QOL-039 — visibility defaults to 'public' (today's behavior). Private-
  // from-creation rooms set this explicitly on the input.
  const visibility: RoomVisibility = input.visibility === 'private' ? 'private' : 'public';

  const { data: debate, error: debateError } = await supabase
    .from('debates')
    .insert({
      created_by: userId,
      title: input.title.trim(),
      resolution: input.resolution.trim(),
      description: input.description.trim(),
      status: 'open',
      constitution_id: (constitutionRow as { id: string }).id,
      visibility,
    })
    .select('id, created_by, title, resolution, description, status, constitution_id, created_at, updated_at, visibility, inactive_at')
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

// ── QOL-039 — Room visibility transition ──────────────────────

/**
 * Result shape returned by the `record-visibility-transition` Edge Function
 * per E1.3 of the design. The Edge Function does the UPDATE, the audit row
 * INSERT, and the QOL-040 cross-function notification dispatches; the
 * client receives the per-channel statuses for any UI hook that needs them.
 */
export interface RoomVisibilityTransitionResult {
  transitionId: string;
  retainedParticipantCount: number;
  droppedParticipantCount: number;
  rejectedChimeInCount: number;
  notificationsDispatched: {
    roomMadePrivate: 'sent' | 'queued' | 'not_configured' | 'skipped';
    chimeInRejected: ReadonlyArray<{
      argumentId: string;
      status: 'sent' | 'queued' | 'not_configured' | 'skipped';
    }>;
  };
  /**
   * True when the visibility UPDATE landed but the audit-row INSERT
   * failed. The transition is still complete; the operator reconciles via
   * the Edge Function's structured log.
   */
  auditWritten: boolean;
}

/**
 * Client wrapper for the visibility transition. Per OD-3, this calls the
 * `record-visibility-transition` Edge Function rather than issuing a
 * direct `UPDATE`. The Edge Function:
 *
 *   1. Verifies the caller is the room creator (OD-1 enforcement).
 *   2. Re-derives current visibility — refuses on already-private (409).
 *   3. Performs the visibility UPDATE.
 *   4. Inserts the audit row with the counts + chime-in argument IDs (OD-2).
 *   5. Dispatches the QOL-040 `room_made_private` notification.
 *   6. Dispatches the QOL-040 `chime_in_rejected` notifications per chime-in.
 *
 * Notification dispatch failures never roll back the transition (mirrors
 * the `submit-argument` notification side-effect pattern).
 */
export async function transitionRoomToPrivate(
  debateId: string,
): Promise<DebateApiResult<RoomVisibilityTransitionResult>> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'Supabase is not configured.' };

  const { data, error } = await supabase.functions.invoke<RoomVisibilityTransitionResult>(
    'record-visibility-transition',
    {
      body: {
        debateId,
        triggerKind: 'manual_creator_action',
      },
    },
  );

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? 'Could not save the change. Try again in a moment.',
    };
  }

  return { ok: true, data };
}
