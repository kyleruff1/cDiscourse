/**
 * ARG-ROOM-002 (#613) — migration shape text-scan.
 *
 * Source-file inspection of
 * `20260613000001_arg_room_002_room_capacity_and_creation.sql`. The migration
 * is deploy-bearing (GATE-C); end-to-end behaviour (helpers compute, the
 * trigger rejects an over-cap join, the RPC creates atomically, RLS refuses a
 * direct private insert) is verified by the operator post-merge via
 * `npx supabase db reset --linked=false` (Docker) or the heightened textual
 * review per OPS-001. These tests pin the structural invariants the design +
 * design-review name so the migration cannot silently drift.
 *
 * Companion: __tests__/argRoom002RlsPolicy.test.ts (policy + grant surface).
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

describe('ARG-ROOM-002 migration — derived cap helper', () => {
  it('declares room_active_seat_cap(uuid) as SECURITY DEFINER STABLE', () => {
    expect(sqlOnly).toMatch(
      /CREATE OR REPLACE FUNCTION public\.room_active_seat_cap\(p_debate_id uuid\)[\s\S]*?STABLE[\s\S]*?SECURITY DEFINER/i,
    );
  });

  it('derives the cap (private 2 / public 5) — no new debates column', () => {
    expect(sqlOnly).toMatch(/CASE WHEN d\.visibility = 'private' THEN 2 ELSE 5 END/i);
    // No ALTER TABLE adding a capacity column (capacity is derived, not persisted).
    expect(sqlOnly).not.toMatch(/ALTER TABLE public\.debates[\s\S]*ADD COLUMN[\s\S]*capacit/i);
  });

  it('sets search_path = public to prevent search-path injection', () => {
    const fn = sqlOnly.match(
      /CREATE OR REPLACE FUNCTION public\.room_active_seat_cap\(p_debate_id uuid\)[\s\S]*?\$\$/,
    );
    expect(fn).toBeTruthy();
    expect(fn?.[0]).toMatch(/SET search_path = public/);
  });
});

describe('ARG-ROOM-002 migration — count helpers', () => {
  it('count_active_participants excludes observers (side <> observer)', () => {
    expect(sqlOnly).toMatch(
      /CREATE OR REPLACE FUNCTION public\.count_active_participants\(p_debate_id uuid\)[\s\S]*?SECURITY DEFINER/i,
    );
    expect(sqlOnly).toMatch(/dp\.side <> 'observer'/);
  });

  it('user_email_lower reads auth.users with search_path = public, auth', () => {
    const fn = sqlOnly.match(
      /CREATE OR REPLACE FUNCTION public\.user_email_lower\(p_user_id uuid\)[\s\S]*?\$\$;/,
    );
    expect(fn).toBeTruthy();
    expect(fn?.[0]).toMatch(/SECURITY DEFINER/);
    expect(fn?.[0]).toMatch(/SET search_path = public, auth/);
    expect(fn?.[0]).toMatch(/FROM auth\.users u/);
  });

  it('count_reserved_invites reserves live pending invites, minus self + already-seated', () => {
    const fn = sqlOnly.match(
      /CREATE OR REPLACE FUNCTION public\.count_reserved_invites\(\s*p_debate_id uuid,\s*p_exclude_email text\s*\)[\s\S]*?\$\$;/,
    );
    expect(fn).toBeTruthy();
    const body = fn?.[0] ?? '';
    expect(body).toMatch(/i\.status = 'pending'/);
    expect(body).toMatch(/i\.expires_at > now\(\)/);
    // Exclude the joining user's own pending invite.
    expect(body).toMatch(/p_exclude_email IS NULL OR i\.invitee_email_lower <> p_exclude_email/);
    // Addressee-already-seated exclusion (no double-count).
    expect(body).toMatch(/NOT EXISTS/);
    expect(body).toMatch(/dp\.side <> 'observer'/);
    expect(body).toMatch(/lower\(u\.email\) = i\.invitee_email_lower/);
  });
});

describe('ARG-ROOM-002 migration — capacity trigger', () => {
  const triggerFn = sqlOnly.match(
    /CREATE OR REPLACE FUNCTION public\.enforce_room_capacity\(\)[\s\S]*?\$\$;/,
  )?.[0] ?? '';

  it('declares enforce_room_capacity() as a SECURITY DEFINER plpgsql trigger', () => {
    expect(triggerFn).toMatch(/RETURNS trigger/i);
    expect(triggerFn).toMatch(/LANGUAGE plpgsql/i);
    expect(triggerFn).toMatch(/SECURITY DEFINER/);
    expect(triggerFn).toMatch(/SET search_path = public, auth/);
  });

  it('passes observers through (never capped)', () => {
    expect(triggerFn).toMatch(/IF NEW\.side = 'observer' THEN\s*RETURN NEW;/i);
  });

  it('passes an already-seated user through via the recursion-safe helper', () => {
    expect(triggerFn).toMatch(/is_debate_participant\(NEW\.debate_id, NEW\.user_id\)/);
  });

  it('has the NULL-cap defensive branch (no such room -> let the FK raise)', () => {
    expect(triggerFn).toMatch(/IF v_cap IS NULL THEN\s*RETURN NEW;/i);
  });

  it('rejects when active + reserved + 1 exceeds the cap, raising room_capacity_reached', () => {
    expect(triggerFn).toMatch(/v_active \+ v_reserved \+ 1 > v_cap/);
    expect(triggerFn).toMatch(/RAISE EXCEPTION 'room_capacity_reached'/);
    expect(triggerFn).toMatch(/ERRCODE = 'check_violation'/);
  });

  it('attaches the trigger BEFORE INSERT on debate_participants (drop-then-create)', () => {
    expect(sqlOnly).toMatch(
      /DROP TRIGGER IF EXISTS debate_participants_enforce_capacity ON public\.debate_participants/i,
    );
    expect(sqlOnly).toMatch(
      /CREATE TRIGGER debate_participants_enforce_capacity\s*BEFORE INSERT ON public\.debate_participants/i,
    );
  });
});

describe('ARG-ROOM-002 migration — one-invite-per-room index', () => {
  it('creates a UNIQUE partial index on (debate_id) WHERE status = pending', () => {
    expect(sqlOnly).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS argument_room_invites_one_live_per_room\s*ON public\.argument_room_invites \(debate_id\)\s*WHERE status = 'pending'/i,
    );
  });

  it('does NOT drop the shipped per-address index (additive, both coexist)', () => {
    expect(sqlOnly).not.toMatch(/DROP INDEX[\s\S]*argument_room_invites_one_live\b/i);
  });
});

describe('ARG-ROOM-002 migration — atomic create RPC', () => {
  const rpc = sqlOnly.match(
    /CREATE OR REPLACE FUNCTION public\.create_argument_room\([\s\S]*?\$\$;/,
  )?.[0] ?? '';

  it('declares create_argument_room as SECURITY DEFINER returning (debate_id, invite_id)', () => {
    expect(rpc).toMatch(/RETURNS TABLE \(debate_id uuid, invite_id uuid\)/i);
    expect(rpc).toMatch(/SECURITY DEFINER/);
    expect(rpc).toMatch(/SET search_path = public/);
  });

  it('re-asserts private => invite inside the RPC (DB backstop for all callers)', () => {
    expect(rpc).toMatch(/p_visibility = 'private'/);
    expect(rpc).toMatch(/p_invitee_email_lower IS NULL OR p_token_hash IS NULL/);
    expect(rpc).toMatch(/RAISE EXCEPTION 'private_requires_invite'/);
  });

  it('rejects an invalid visibility', () => {
    expect(rpc).toMatch(/p_visibility NOT IN \('public', 'private'\)/);
    expect(rpc).toMatch(/RAISE EXCEPTION 'invalid_visibility'/);
  });

  it('inserts the debate, then the creator participant, then the optional invite', () => {
    const debateIdx = rpc.indexOf('INSERT INTO public.debates');
    const partIdx = rpc.indexOf('INSERT INTO public.debate_participants');
    const inviteIdx = rpc.indexOf('INSERT INTO public.argument_room_invites');
    expect(debateIdx).toBeGreaterThanOrEqual(0);
    expect(partIdx).toBeGreaterThan(debateIdx); // creator join sees 0 reserved
    expect(inviteIdx).toBeGreaterThan(partIdx); // invite reserves seat 2 after
  });

  it('inserts the creator as moderator and only stores the token hash', () => {
    expect(rpc).toMatch(/VALUES \(v_debate_id, p_created_by, 'moderator'\)/);
    expect(rpc).toMatch(/token_hash/);
    // The raw token never reaches Postgres — only p_token_hash is referenced.
    expect(rpc).not.toMatch(/raw_token|rawToken/);
  });
});

describe('ARG-ROOM-002 migration — OPS-001 four-class compliance', () => {
  it('Class 1 (ambiguous column): policy/trigger subquery columns are fully qualified', () => {
    expect(sqlOnly).toMatch(/i\.debate_id = p_debate_id/);
    expect(sqlOnly).toMatch(/dp\.debate_id = i\.debate_id/);
    expect(sqlOnly).toMatch(/d\.id = p_debate_id/);
  });

  it('Class 2 (type mismatch): the RPC reuses uuid / text / timestamptz param types', () => {
    expect(sqlOnly).toMatch(/p_created_by uuid/);
    expect(sqlOnly).toMatch(/p_token_hash text/);
    expect(sqlOnly).toMatch(/p_expires_at timestamptz/);
  });

  it('Class 3 (statement order): helpers precede the trigger fn precedes the trigger', () => {
    const capHelper = sqlOnly.indexOf('FUNCTION public.room_active_seat_cap');
    const reservedHelper = sqlOnly.indexOf('FUNCTION public.count_reserved_invites');
    const triggerFn = sqlOnly.indexOf('FUNCTION public.enforce_room_capacity');
    const trigger = sqlOnly.indexOf('CREATE TRIGGER debate_participants_enforce_capacity');
    expect(capHelper).toBeGreaterThanOrEqual(0);
    expect(reservedHelper).toBeGreaterThan(capHelper);
    expect(triggerFn).toBeGreaterThan(reservedHelper);
    expect(trigger).toBeGreaterThan(triggerFn);
  });

  it('Class 4 (deps): the auth.users dependency is documented in the header', () => {
    expect(migSrc).toMatch(/auth\.users/);
    expect(migSrc).toMatch(/function\/extension deps|four-class/i);
  });
});

describe('ARG-ROOM-002 migration — RLS never disabled', () => {
  it('does NOT disable row level security anywhere', () => {
    expect(sqlOnly).not.toMatch(/DISABLE ROW LEVEL SECURITY/i);
  });
});

describe('ARG-ROOM-002 migration — append-only discipline', () => {
  it('the migration file exists at its slot', () => {
    expect(fs.existsSync(migPath)).toBe(true);
  });

  it('the 14-digit timestamp does not collide with any other migration', () => {
    const migDir = path.join(process.cwd(), 'supabase/migrations');
    const files = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql'));
    const ours = path.basename(migPath);
    const oursStamp = ours.match(/^(\d{14})/)?.[1] ?? '';
    expect(oursStamp).toMatch(/^\d{14}$/);
    for (const f of files) {
      if (f === ours) continue;
      const other = f.match(/^(\d+)/)?.[1] ?? '';
      expect(Number(other)).not.toBe(Number(oursStamp));
    }
  });

  it('does NOT edit the applied QOL-038 / QOL-039 / recursion migrations (new objects only)', () => {
    // This migration references the shipped helpers/tables by name but never
    // re-declares the QOL-039 visibility column or the QOL-038 invite table.
    expect(sqlOnly).not.toMatch(/ALTER TABLE public\.debates[\s\S]*ADD COLUMN[\s\S]*visibility/i);
    expect(sqlOnly).not.toMatch(/CREATE TABLE[\s\S]*argument_room_invites\b/i);
  });
});
