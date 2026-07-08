/**
 * START-001 (#827) — Recent-opponent invite read (RLS-scoped, anon-keyed).
 *
 * The single new PostgREST read the person-first picker introduces. It lists
 * the viewer OWN sent invites from `public.argument_room_invites`, newest
 * first, so the picker can offer "people you have started arguments with" as
 * quick recents.
 *
 * SECURITY / DOCTRINE
 *   - RLS basis: policy `ari_select_inviter_own`
 *     (`supabase/migrations/20260524000013_qol_038_argument_room_invites.sql:112`,
 *     `for select to authenticated using (argument_room_invites.invited_by =
 *     auth.uid())`). The explicit `.eq('invited_by', userId)` merely mirrors the
 *     policy; the policy is authoritative. The read is structurally incapable of
 *     returning any other user rows — no enumeration, no `profiles` search.
 *   - Anon-keyed PostgREST only. NO service-role, NO Edge Function, NO migration,
 *     NO write. Recents are an accelerator, never a gate: any failure (offline,
 *     unconfigured, RLS empty) resolves to `[]` so the sheet still renders with
 *     e-mail entry + open floor.
 *   - This file is intentionally thin (network glue only); the dedupe / sort /
 *     mask logic lives in the pure `personArgumentPickerModel.ts`.
 */

import { supabase, SUPABASE_CONFIGURED } from '../../../lib/supabase';
import type { RecentInviteRow } from './personArgumentPickerModel';

/** How many raw invite rows to read before the pure model dedupes + caps. */
export const RECENT_OPPONENT_INVITE_READ_LIMIT = 50;

/**
 * List the viewer OWN sent-invite rows (RLS `ari_select_inviter_own`). Returns
 * `[]` on any failure — recents never block the sheet.
 */
export async function listRecentOpponentInvites(
  userId: string | null | undefined,
): Promise<RecentInviteRow[]> {
  if (!SUPABASE_CONFIGURED) return [];
  if (typeof userId !== 'string' || userId.length === 0) return [];

  const { data, error } = await supabase
    .from('argument_room_invites')
    .select('invitee_email_lower, debate_id, created_at, status')
    .eq('invited_by', userId) // redundant with RLS; explicit for clarity
    .order('created_at', { ascending: false })
    .limit(RECENT_OPPONENT_INVITE_READ_LIMIT);

  if (error) return [];
  return (data ?? []) as unknown as RecentInviteRow[];
}
