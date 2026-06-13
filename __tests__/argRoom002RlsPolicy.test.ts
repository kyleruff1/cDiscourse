/**
 * ARG-ROOM-002 (#613) — RLS policy + GRANT-surface text-scan.
 *
 * These pin the two design-review findings the implementer MUST resolve, at
 * the layer Jest can verify (the runtime refusal is verified by the operator
 * via `npx supabase db reset --linked=false`):
 *
 *   - [blocking] #1 "Close the direct-insert door": the migration DROPs the
 *     shipped "debates: authenticated can create" INSERT policy and adds NO
 *     replacement INSERT policy for authenticated, so the service_role
 *     create_argument_room RPC is the ONLY room creator. A direct PostgREST
 *     `debates` insert (esp. private + no invite) is therefore refused.
 *   - [should] #2 "Helper-grant oracle": count_active_participants,
 *     count_reserved_invites, and user_email_lower are REVOKEd from PUBLIC and
 *     NOT granted to authenticated (no invite-email-confirmation oracle).
 *
 * Companion: __tests__/argRoom002Migration.test.ts (function/trigger/RPC shape).
 */
import * as fs from 'fs';
import * as path from 'path';

const migPath = path.join(
  process.cwd(),
  'supabase/migrations/20260613000001_arg_room_002_room_capacity_and_creation.sql',
);
const migSrc = fs.readFileSync(migPath, 'utf8');

/** SQL only — comment-only lines stripped so prose never false-fires a scan. */
const sqlOnly = migSrc
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');

describe('ARG-ROOM-002 — tightened debate_participants INSERT policy (private join blocked)', () => {
  it('drops and recreates the join policy', () => {
    expect(sqlOnly).toMatch(
      /DROP POLICY IF EXISTS "debate_participants: users join as themselves" ON public\.debate_participants/i,
    );
    expect(sqlOnly).toMatch(
      /CREATE POLICY "debate_participants: users join as themselves"\s*ON public\.debate_participants\s*FOR INSERT/i,
    );
  });

  it('client self-join requires user_id = auth.uid(), joinable, AND a PUBLIC room', () => {
    const policy = sqlOnly.match(
      /CREATE POLICY "debate_participants: users join as themselves"[\s\S]*?WITH CHECK \(([\s\S]*?)\);/i,
    );
    expect(policy).toBeTruthy();
    const check = policy?.[1] ?? '';
    expect(check).toMatch(/user_id = auth\.uid\(\)/);
    expect(check).toMatch(/public\.is_debate_joinable\(debate_id\)/);
    // The new arm — a client may NOT self-join a private room.
    expect(check).toMatch(/public\.is_debate_private\(debate_id\) = false/);
  });
});

describe('ARG-ROOM-002 — direct-insert door closed (design-review [blocking] #1)', () => {
  it('DROPs the shipped "debates: authenticated can create" INSERT policy', () => {
    expect(sqlOnly).toMatch(
      /DROP POLICY IF EXISTS "debates: authenticated can create" ON public\.debates/i,
    );
  });

  it('adds NO replacement INSERT policy on debates (the RPC is the only creator)', () => {
    // No CREATE POLICY ... ON public.debates ... FOR INSERT within a single
    // statement (`[^;]` cannot cross the trailing `;`) — authenticated loses
    // the ability to insert a debates row directly, so private+no-invite
    // cannot be created by bypassing the RPC. The `\b` after `debates` excludes
    // the `public.debate_participants` policy.
    expect(sqlOnly).not.toMatch(/CREATE POLICY[^;]*\bON public\.debates\b[^;]*FOR INSERT/i);
    // Belt-and-braces for the reverse intra-statement ordering.
    expect(sqlOnly).not.toMatch(/CREATE POLICY[^;]*FOR INSERT[^;]*\bON public\.debates\b/i);
  });
});

describe('ARG-ROOM-002 — GRANT surface (design-review [should] #2: no oracle)', () => {
  const helpers = [
    'room_active_seat_cap(uuid)',
    'count_active_participants(uuid)',
    'count_reserved_invites(uuid, text)',
    'user_email_lower(uuid)',
  ];

  it('REVOKEs every capacity helper from PUBLIC', () => {
    for (const sig of helpers) {
      const esc = sig.replace(/[()]/g, '\\$&');
      expect(sqlOnly).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${esc} FROM PUBLIC`));
    }
  });

  it('does NOT grant any capacity helper to authenticated (no invite-email oracle)', () => {
    for (const sig of helpers) {
      const esc = sig.replace(/[()]/g, '\\$&');
      expect(sqlOnly).not.toMatch(
        new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${esc} TO authenticated`),
      );
    }
  });

  it('grants create_argument_room to service_role ONLY (never authenticated / public)', () => {
    expect(sqlOnly).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.create_argument_room\([\s\S]*?\) TO service_role/,
    );
    expect(sqlOnly).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.create_argument_room\([\s\S]*?\) TO authenticated/,
    );
    expect(sqlOnly).toMatch(
      /REVOKE ALL ON FUNCTION public\.create_argument_room\([\s\S]*?\) FROM PUBLIC/,
    );
  });
});

describe('ARG-ROOM-002 — recursion landmine (cross-table reads go through helpers)', () => {
  it('the tightened INSERT policy uses SECURITY DEFINER helpers, not a raw subquery', () => {
    const policy = sqlOnly.match(
      /CREATE POLICY "debate_participants: users join as themselves"[\s\S]*?WITH CHECK \(([\s\S]*?)\);/i,
    );
    const check = policy?.[1] ?? '';
    // No raw cross-table SELECT inside the policy WITH CHECK.
    expect(check).not.toMatch(/SELECT/i);
    expect(check).toMatch(/public\.is_debate_/);
  });
});
