import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';
import type { ParticipantSide } from './types';

export interface DebateUserState {
  debateId: string;
  userId: string;
  participantSide: ParticipantSide | null;
  focusedArgumentId: string | null;
  selectedParentId: string | null;
  expandedArgumentIds: string[];
  collapsedArgumentIds: string[];
  lastSeenArgumentId: string | null;
  lastReadAt: string | null;
  updatedAt: string;
}

interface DebateUserStateRow {
  debate_id: string;
  user_id: string;
  participant_side: string | null;
  focused_argument_id: string | null;
  selected_parent_id: string | null;
  expanded_argument_ids: string[];
  collapsed_argument_ids: string[];
  last_seen_argument_id: string | null;
  last_read_at: string | null;
  updated_at: string;
}

function mapRow(row: DebateUserStateRow): DebateUserState {
  return {
    debateId: row.debate_id,
    userId: row.user_id,
    participantSide: row.participant_side as ParticipantSide | null,
    focusedArgumentId: row.focused_argument_id,
    selectedParentId: row.selected_parent_id,
    expandedArgumentIds: row.expanded_argument_ids ?? [],
    collapsedArgumentIds: row.collapsed_argument_ids ?? [],
    lastSeenArgumentId: row.last_seen_argument_id,
    lastReadAt: row.last_read_at,
    updatedAt: row.updated_at,
  };
}

export async function loadDebateUserState(
  debateId: string,
  userId: string,
): Promise<DebateUserState | null> {
  if (!SUPABASE_CONFIGURED) return null;
  try {
    const { data, error } = await supabase
      .from('debate_user_state')
      .select('*')
      .eq('debate_id', debateId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return mapRow(data as DebateUserStateRow);
  } catch {
    return null;
  }
}

export async function upsertDebateUserState(
  patch: Pick<DebateUserState, 'debateId' | 'userId'> &
    Partial<Omit<DebateUserState, 'debateId' | 'userId' | 'updatedAt'>>,
): Promise<void> {
  if (!SUPABASE_CONFIGURED) return;
  try {
    await supabase.from('debate_user_state').upsert(
      {
        debate_id: patch.debateId,
        user_id: patch.userId,
        participant_side: patch.participantSide ?? null,
        focused_argument_id: patch.focusedArgumentId ?? null,
        selected_parent_id: patch.selectedParentId ?? null,
        expanded_argument_ids: patch.expandedArgumentIds ?? [],
        collapsed_argument_ids: patch.collapsedArgumentIds ?? [],
        last_seen_argument_id: patch.lastSeenArgumentId ?? null,
      },
      { onConflict: 'debate_id,user_id' },
    );
  } catch {
    // graceful degradation — non-fatal
  }
}
