/**
 * START-002 (#839) — shared circles-read client module.
 *
 * The SINGLE client wrapper that lists the circles the CALLER is a live member
 * of, projected for the START-001 person picker (a circle audience) AND the
 * HOME-003 circle-home filter lane. START-002 OWNS this contract; HOME-003
 * consumes it unchanged (no forked "list my circles" reader).
 *
 * SECURITY / DOCTRINE (cdiscourse-doctrine §1-§3, §6-§7; supabase-edge-contract)
 *   - Anon-key + caller-JWT PostgREST only. NO service role, NO Edge Function,
 *     NO migration, NO write. This file constructs no service-role client and
 *     references no service-role secret.
 *   - RLS is authoritative — there is NO global circle search / directory. The
 *     `circles` SELECT policy `circles_select_member_owner_admin`
 *     (`20260702000001_private_groups_002_circles.sql:436`,
 *     `using is_circle_member(circles.id, auth.uid()) or is_circle_owner(...)
 *     or is_moderator_or_admin()`) makes a plain SELECT return EXACTLY the
 *     caller's circles. `circle_members` SELECT
 *     (`circle_members_select_member_admin`, :455) lets a member read its
 *     co-members, so the live count + the caller's own role are derivable
 *     without a privileged read and without an enumeration oracle.
 *   - IDENTITY-FREE contract (privacy): a `MyCircleSummary` carries name +
 *     live count + the caller's OWN role only. Member user-ids are read here
 *     ONLY to compute the count + resolve the caller's role, then discarded —
 *     no member id / e-mail / display name ever appears in the returned shape.
 *     A circle NAME is user content (like a room title); the rendered-UI
 *     ban-list test scans it, never this reader.
 *   - `memberCount` is a STRUCTURAL fact (how many people are in the group),
 *     never a ranking, never an input from heat / popularity (§1-§3).
 *
 * Pure derivations (band / count roll-ups) stay in `circleModel.ts`; this file
 * is network glue only.
 */
import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';
import type { CircleRole } from './circleModel';

/**
 * A circle the CALLER is a live member of, projected for the picker + home
 * lane. Member IDENTITIES are never included (START-001 privacy precedent):
 * name + count + the caller's own role only.
 */
export interface MyCircleSummary {
  id: string;
  name: string;
  /** Live members (is_removed = false) — a STRUCTURAL fact, never a ranking. */
  memberCount: number;
  /** The caller's role in THIS circle. */
  role: CircleRole;
}

export interface CirclesApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

/** How many raw circle rows to read (RLS already scopes to the caller). */
const MY_CIRCLES_READ_LIMIT = 100;

/** Raw `circles` row shape (RLS-scoped to the caller's circles). */
interface CircleRow {
  id: string;
  name: string;
  created_at: string;
}

/** Raw `circle_members` row shape. `user_id` is read for count + own-role only. */
interface CircleMemberRow {
  circle_id: string;
  user_id: string;
  role: string;
}

/**
 * List the circles the caller is a live member of, newest-created-first. Pure
 * anon-key + caller JWT client — NO service role, NO oracle. Returns a stable
 * result envelope; any failure (unconfigured, signed out, RLS empty, transport
 * error) resolves to `{ ok: false }` or `{ ok: true, data: [] }` so no surface
 * is ever blocked.
 */
export async function listMyCircles(): Promise<CirclesApiResult<MyCircleSummary[]>> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'Supabase is not configured.' };

  // Resolve the caller from the JWT (for own-role). No service role.
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  const callerId = userRes?.user?.id ?? null;
  if (userErr || !callerId) return { ok: false, error: 'Not signed in.' };

  // 1) The caller's live circles — RLS returns EXACTLY the caller's circles.
  const { data: circleData, error: circlesErr } = await supabase
    .from('circles')
    .select('id, name, created_at')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(MY_CIRCLES_READ_LIMIT);
  if (circlesErr) return { ok: false, error: circlesErr.message };

  const circles = (circleData ?? []) as unknown as CircleRow[];
  if (circles.length === 0) return { ok: true, data: [] };

  const ids = circles.map((c) => c.id);

  // 2) Live members for those circles — a member may read co-members. The
  //    user_id column is read ONLY to compute the count + the caller's role;
  //    it is NEVER placed in the returned MyCircleSummary (identity-free).
  const { data: memberData, error: membersErr } = await supabase
    .from('circle_members')
    .select('circle_id, user_id, role')
    .eq('is_removed', false)
    .in('circle_id', ids);
  if (membersErr) return { ok: false, error: membersErr.message };

  const members = (memberData ?? []) as unknown as CircleMemberRow[];

  const countByCircle = new Map<string, number>();
  const roleByCircle = new Map<string, CircleRole>();
  for (const m of members) {
    if (!m || typeof m.circle_id !== 'string') continue;
    countByCircle.set(m.circle_id, (countByCircle.get(m.circle_id) ?? 0) + 1);
    if (m.user_id === callerId) {
      roleByCircle.set(m.circle_id, m.role === 'owner' ? 'owner' : 'member');
    }
  }

  const data: MyCircleSummary[] = circles.map((c) => ({
    id: c.id,
    name: c.name,
    memberCount: countByCircle.get(c.id) ?? 0,
    role: roleByCircle.get(c.id) ?? 'member',
  }));

  return { ok: true, data };
}
