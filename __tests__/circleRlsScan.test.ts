/**
 * PRIVATE-GROUPS-002 (#859) — RLS policy + GRANT-surface text-scan.
 *
 * Pins the two load-bearing safety properties the design names, at the layer
 * Jest can verify (the runtime refusal is verified by the operator via
 * `npx supabase db reset --linked=false`):
 *
 *   - ZERO authenticated write policy on any of the 3 new tables (all writes
 *     flow through the service-role manage-circle / manage-circle-invite
 *     Edge Functions).
 *   - Each SELECT policy calls the expected membership helper / arm, and the
 *     helper GRANT surface follows the oracle-avoidance discipline
 *     (is_circle_deleted definer-only; is_circle_member / is_circle_owner /
 *     is_argument_visible_in_circle granted to authenticated; create_circle
 *     service_role only).
 *
 * Companion: __tests__/circleMigration.test.ts (table/helper/RPC shape).
 */
import * as fs from 'fs';
import * as path from 'path';

const migPath = path.join(
  process.cwd(),
  'supabase/migrations/20260702000001_private_groups_002_circles.sql',
);
const migSrc = fs.readFileSync(migPath, 'utf8');

/** SQL only — comment-only lines stripped so prose never false-fires a scan. */
const sqlOnly = migSrc
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');

const TABLES = ['circles', 'circle_members', 'circle_invites'] as const;

describe('PRIVATE-GROUPS-002 — RLS enabled on every new table', () => {
  it.each(TABLES)('public.%s has RLS enabled', (table) => {
    expect(sqlOnly).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
  });
});

describe('PRIVATE-GROUPS-002 — ZERO authenticated write policy on any new table', () => {
  it.each(TABLES)('public.%s has NO INSERT policy', (table) => {
    expect(sqlOnly).not.toMatch(new RegExp(`create policy[^;]*\\bon public\\.${table}\\b[^;]*for insert`, 'i'));
    expect(sqlOnly).not.toMatch(new RegExp(`create policy[^;]*for insert[^;]*\\bon public\\.${table}\\b`, 'i'));
  });

  it.each(TABLES)('public.%s has NO UPDATE policy', (table) => {
    expect(sqlOnly).not.toMatch(new RegExp(`create policy[^;]*\\bon public\\.${table}\\b[^;]*for update`, 'i'));
    expect(sqlOnly).not.toMatch(new RegExp(`create policy[^;]*for update[^;]*\\bon public\\.${table}\\b`, 'i'));
  });

  it.each(TABLES)('public.%s has NO DELETE policy', (table) => {
    expect(sqlOnly).not.toMatch(new RegExp(`create policy[^;]*\\bon public\\.${table}\\b[^;]*for delete`, 'i'));
    expect(sqlOnly).not.toMatch(new RegExp(`create policy[^;]*for delete[^;]*\\bon public\\.${table}\\b`, 'i'));
  });

  it('every CREATE POLICY on a circle table is FOR SELECT only', () => {
    const policyBlocks = sqlOnly.match(/create policy[\s\S]*?;/gi) || [];
    const circlePolicies = policyBlocks.filter((p) => /on public\.circle/i.test(p));
    expect(circlePolicies.length).toBeGreaterThan(0);
    for (const p of circlePolicies) {
      expect(p).toMatch(/for select/i);
      expect(p).not.toMatch(/for (insert|update|delete)/i);
    }
  });
});

describe('PRIVATE-GROUPS-002 — circles SELECT policy', () => {
  const policy = sqlOnly.match(
    /create policy circles_select_member_owner_admin[\s\S]*?using \(([\s\S]*?)\);/i,
  )?.[1] ?? '';

  it('is a SELECT to authenticated', () => {
    expect(sqlOnly).toMatch(/create policy circles_select_member_owner_admin\s*on public\.circles\s*for select\s*to authenticated/i);
  });

  it('calls is_circle_member, is_circle_owner, and is_moderator_or_admin', () => {
    expect(policy).toMatch(/public\.is_circle_member\(circles\.id, auth\.uid\(\)\)/i);
    expect(policy).toMatch(/public\.is_circle_owner\(circles\.id, auth\.uid\(\)\)/i);
    expect(policy).toMatch(/public\.is_moderator_or_admin\(\)/i);
  });
});

describe('PRIVATE-GROUPS-002 — circle_members SELECT policy', () => {
  const policy = sqlOnly.match(
    /create policy circle_members_select_member_admin[\s\S]*?using \(([\s\S]*?)\);/i,
  )?.[1] ?? '';

  it('calls is_circle_member (fully-qualified circle_id) + is_moderator_or_admin', () => {
    expect(policy).toMatch(/public\.is_circle_member\(circle_members\.circle_id, auth\.uid\(\)\)/i);
    expect(policy).toMatch(/public\.is_moderator_or_admin\(\)/i);
  });
});

describe('PRIVATE-GROUPS-002 — circle_invites SELECT arms (four separate policies)', () => {
  it('has the inviter-own arm (invited_by = auth.uid())', () => {
    expect(sqlOnly).toMatch(/create policy circle_invites_select_inviter_own[\s\S]*?using \(circle_invites\.invited_by = auth\.uid\(\)\)/i);
  });

  it('has the circle-owner arm (is_circle_owner)', () => {
    expect(sqlOnly).toMatch(/create policy circle_invites_select_circle_owner[\s\S]*?using \(public\.is_circle_owner\(circle_invites\.circle_id, auth\.uid\(\)\)\)/i);
  });

  it('has the invitee-own arm (invitee_email_lower = lower(auth.jwt() ->> email))', () => {
    expect(sqlOnly).toMatch(/create policy circle_invites_select_invitee_own[\s\S]*?using \(circle_invites\.invitee_email_lower = lower\(auth\.jwt\(\) ->> 'email'\)\)/i);
  });

  it('has the mod/admin arm', () => {
    expect(sqlOnly).toMatch(/create policy circle_invites_select_mod_or_admin[\s\S]*?using \(public\.is_moderator_or_admin\(\)\)/i);
  });
});

describe('PRIVATE-GROUPS-002 — helper GRANT surface (oracle-avoidance discipline)', () => {
  it('is_circle_deleted is REVOKEd from PUBLIC and NOT granted to authenticated (definer-only)', () => {
    expect(sqlOnly).toMatch(/revoke all on function public\.is_circle_deleted\(uuid\) from public/i);
    expect(sqlOnly).not.toMatch(/grant execute on function public\.is_circle_deleted\(uuid\) to authenticated/i);
  });

  it('is_circle_member is REVOKEd from PUBLIC and granted to authenticated', () => {
    expect(sqlOnly).toMatch(/revoke all on function public\.is_circle_member\(uuid, uuid\) from public/i);
    expect(sqlOnly).toMatch(/grant execute on function public\.is_circle_member\(uuid, uuid\) to authenticated/i);
  });

  it('is_circle_owner is REVOKEd from PUBLIC and granted to authenticated', () => {
    expect(sqlOnly).toMatch(/revoke all on function public\.is_circle_owner\(uuid, uuid\) from public/i);
    expect(sqlOnly).toMatch(/grant execute on function public\.is_circle_owner\(uuid, uuid\) to authenticated/i);
  });

  it('is_argument_visible_in_circle is REVOKEd from PUBLIC and granted to authenticated', () => {
    expect(sqlOnly).toMatch(/revoke all on function public\.is_argument_visible_in_circle\(uuid, uuid\) from public/i);
    expect(sqlOnly).toMatch(/grant execute on function public\.is_argument_visible_in_circle\(uuid, uuid\) to authenticated/i);
  });

  it('create_circle is granted to service_role ONLY (never authenticated)', () => {
    expect(sqlOnly).toMatch(/grant execute on function public\.create_circle\(uuid, text, text\) to service_role/i);
    expect(sqlOnly).not.toMatch(/grant execute on function public\.create_circle\([^)]*\) to authenticated/i);
  });
});

describe('PRIVATE-GROUPS-002 — recursion landmine (cross-table reads go through helpers)', () => {
  it('no CREATE POLICY on a circle table contains a raw cross-table SELECT subquery', () => {
    const policyBlocks = sqlOnly.match(/create policy[\s\S]*?;/gi) || [];
    const circlePolicies = policyBlocks.filter((p) => /on public\.circle/i.test(p));
    for (const p of circlePolicies) {
      // The USING body may only call helpers / read the target table's own
      // columns; a raw `SELECT ... FROM` inside a policy is the recursion
      // hazard the design forbids.
      const usingBody = p.match(/using \(([\s\S]*?)\)\s*;/i)?.[1] ?? '';
      expect(usingBody).not.toMatch(/\bselect\b/i);
    }
  });
});
