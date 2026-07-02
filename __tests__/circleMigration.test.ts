/**
 * PRIVATE-GROUPS-002 (#859) — migration shape text-scan.
 *
 * Source-file inspection of
 * `20260702000001_private_groups_002_circles.sql`. The migration is
 * deploy-bearing (GATE-C); end-to-end behaviour (helpers compute, the RPC
 * creates atomically, RLS refuses a non-member read) is verified by the
 * operator post-merge via `npx supabase db reset --linked=false` (Docker) or
 * the heightened textual review per OPS-001. These tests pin the structural
 * invariants the design names so the migration cannot silently drift.
 *
 * Companion: __tests__/circleRlsScan.test.ts (policy + grant surface) and
 * __tests__/circleVisibilityCompositionRlsScan.test.ts (the composition
 * anchor).
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

describe('PRIVATE-GROUPS-002 migration — file presence + append-only', () => {
  it('exists at the locked path', () => {
    expect(fs.existsSync(migPath)).toBe(true);
    expect(migSrc.length).toBeGreaterThan(0);
  });

  it('is the highest sequential migration (no later 14-digit timestamp)', () => {
    const migDir = path.join(process.cwd(), 'supabase/migrations');
    const files = fs.readdirSync(migDir).filter((f) => f.endsWith('.sql'));
    const oursStamp = Number(path.basename(migPath).match(/^(\d{14})/)?.[1] ?? '0');
    expect(oursStamp).toBeGreaterThan(0);
    for (const f of files) {
      if (f === path.basename(migPath)) continue;
      const other = Number(f.match(/^(\d{14})/)?.[1] ?? '0');
      expect(other).toBeLessThan(oursStamp);
    }
  });

  it('documents the pgcrypto dependency in the header (OPS-001 §4)', () => {
    expect(migSrc).toMatch(/pgcrypto/i);
    expect(migSrc).toMatch(/gen_random_uuid\(\)/);
  });
});

describe('PRIVATE-GROUPS-002 migration — three new tables + RLS enabled', () => {
  it('creates public.circles + enables RLS', () => {
    expect(sqlOnly).toMatch(/create table if not exists public\.circles/i);
    expect(sqlOnly).toMatch(/alter table public\.circles enable row level security/i);
  });

  it('creates public.circle_members + enables RLS', () => {
    expect(sqlOnly).toMatch(/create table if not exists public\.circle_members/i);
    expect(sqlOnly).toMatch(/alter table public\.circle_members enable row level security/i);
  });

  it('creates public.circle_invites + enables RLS', () => {
    expect(sqlOnly).toMatch(/create table if not exists public\.circle_invites/i);
    expect(sqlOnly).toMatch(/alter table public\.circle_invites enable row level security/i);
  });

  it('never disables row level security anywhere', () => {
    expect(sqlOnly).not.toMatch(/disable row level security/i);
  });
});

describe('PRIVATE-GROUPS-002 migration — circles columns + constraints', () => {
  it('owner_id references auth.users on delete cascade', () => {
    expect(sqlOnly).toMatch(
      /owner_id\s+uuid\s+not null references auth\.users\(id\) on delete cascade/i,
    );
  });

  it('name has a 1..80 char_length(trim()) check', () => {
    expect(sqlOnly).toMatch(/char_length\(trim\(name\)\) between 1 and 80/i);
  });

  it('carries soft-delete + timestamps', () => {
    expect(sqlOnly).toMatch(/is_deleted\s+boolean\s+not null default false/i);
    expect(sqlOnly).toMatch(/deleted_at\s+timestamptz/i);
    expect(sqlOnly).toMatch(/created_at\s+timestamptz\s+not null default now\(\)/i);
    expect(sqlOnly).toMatch(/updated_at\s+timestamptz\s+not null default now\(\)/i);
  });
});

describe('PRIVATE-GROUPS-002 migration — circle_members role + indexes', () => {
  it('role defaults member with the two-value check', () => {
    expect(sqlOnly).toMatch(/role\s+text\s+not null default 'member' check \(role in \('owner','member'\)\)/i);
  });

  it('has the unique (circle_id, user_id) membership constraint', () => {
    expect(sqlOnly).toMatch(/unique \(circle_id, user_id\)/i);
  });

  it('has the circle_members_one_owner partial unique index', () => {
    expect(sqlOnly).toMatch(
      /create unique index if not exists circle_members_one_owner\s*on public\.circle_members \(circle_id\)\s*where role = 'owner' and is_removed = false/i,
    );
  });

  it('has the user + circle partial indexes (where is_removed = false)', () => {
    expect(sqlOnly).toMatch(/create index if not exists circle_members_user\s*on public\.circle_members \(user_id\) where is_removed = false/i);
    expect(sqlOnly).toMatch(/create index if not exists circle_members_circle\s*on public\.circle_members \(circle_id\) where is_removed = false/i);
  });
});

describe('PRIVATE-GROUPS-002 migration — circle_invites (clone of argument_room_invites)', () => {
  it('is keyed to circle_id on delete cascade with token_hash only (no raw token)', () => {
    expect(sqlOnly).toMatch(/circle_id\s+uuid\s+not null references public\.circles\(id\) on delete cascade/i);
    expect(sqlOnly).toMatch(/token_hash\s+text\s+not null/i);
    expect(sqlOnly).not.toMatch(/raw_token|rawToken/);
  });

  it('has the two-FK-target pattern (invitee_profile_id -> profiles, invited_by -> auth.users)', () => {
    expect(sqlOnly).toMatch(/invitee_profile_id\s+uuid\s+references public\.profiles\(id\) on delete set null/i);
    expect(sqlOnly).toMatch(/invited_by\s+uuid\s+not null references auth\.users\(id\) on delete cascade/i);
  });

  it('has the status check + mandatory 14-day expires_at default', () => {
    expect(sqlOnly).toMatch(/status\s+text\s+not null default 'pending'\s*check \(status in \('pending','accepted','revoked','expired'\)\)/i);
    expect(sqlOnly).toMatch(/expires_at\s+timestamptz\s+not null default \(now\(\) \+ interval '14 days'\)/i);
  });

  it('has the per-address one-live partial index and NO per-circle single-invite cap', () => {
    expect(sqlOnly).toMatch(
      /create unique index if not exists circle_invites_one_live\s*on public\.circle_invites \(circle_id, invitee_email_lower\) where status = 'pending'/i,
    );
    // The one-invite-per-ROOM cap idiom from ARG-ROOM-002 must NOT be present.
    expect(sqlOnly).not.toMatch(/create unique index[^;]*circle_invites[^;]*\(circle_id\)\s*where status = 'pending'/i);
  });

  it('has the token_hash + circle indexes', () => {
    expect(sqlOnly).toMatch(/create index if not exists circle_invites_token_hash\s*on public\.circle_invites \(token_hash\)/i);
    expect(sqlOnly).toMatch(/create index if not exists circle_invites_circle\s*on public\.circle_invites \(circle_id\)/i);
  });
});

describe('PRIVATE-GROUPS-002 migration — debates.circle_id additive + CHECK', () => {
  it('adds a nullable circle_id FK on delete set null (additive)', () => {
    expect(sqlOnly).toMatch(
      /alter table public\.debates\s*add column if not exists circle_id uuid null references public\.circles\(id\) on delete set null/i,
    );
  });

  it('adds the partial index on circle_id', () => {
    expect(sqlOnly).toMatch(/create index if not exists debates_circle_id\s*on public\.debates \(circle_id\) where circle_id is not null/i);
  });

  it('adds the debates_circle_requires_private CHECK (circle_id null or private)', () => {
    expect(sqlOnly).toMatch(
      /add constraint debates_circle_requires_private\s*check \(circle_id is null or visibility = 'private'\)/i,
    );
  });
});

describe('PRIVATE-GROUPS-002 migration — helper signatures (SECURITY DEFINER STABLE search_path)', () => {
  const helpers = [
    { name: 'is_circle_deleted', sig: /create or replace function public\.is_circle_deleted\(p_circle_id uuid\)/i },
    { name: 'is_circle_member', sig: /create or replace function public\.is_circle_member\(\s*p_circle_id uuid,\s*p_user_id uuid default auth\.uid\(\)\s*\)/i },
    { name: 'is_circle_owner', sig: /create or replace function public\.is_circle_owner\(\s*p_circle_id uuid,\s*p_user_id uuid default auth\.uid\(\)\s*\)/i },
    { name: 'is_argument_visible_in_circle', sig: /create or replace function public\.is_argument_visible_in_circle\(arg_id uuid, viewer_id uuid\)/i },
  ];

  it.each(helpers)('declares $name with the exact signature', ({ sig }) => {
    expect(sqlOnly).toMatch(sig);
  });

  it.each(helpers)('$name is LANGUAGE sql STABLE SECURITY DEFINER search_path=public', ({ name }) => {
    const fn = sqlOnly.match(
      new RegExp(`create or replace function public\\.${name}[\\s\\S]*?\\$\\$;`, 'i'),
    )?.[0] ?? '';
    expect(fn).toMatch(/language\s+sql/i);
    expect(fn).toMatch(/\bstable\b/i);
    expect(fn).toMatch(/security definer/i);
    expect(fn).toMatch(/set search_path = public\b/i);
  });
});

describe('PRIVATE-GROUPS-002 migration — create_circle RPC', () => {
  const rpc = sqlOnly.match(
    /create or replace function public\.create_circle\([\s\S]*?\$\$;/i,
  )?.[0] ?? '';

  it('declares create_circle(p_owner_id uuid, p_name text, p_description text) returns uuid', () => {
    expect(rpc).toMatch(/create or replace function public\.create_circle\(\s*p_owner_id uuid,\s*p_name text,\s*p_description text\s*\)\s*returns uuid/i);
  });

  it('is a plpgsql SECURITY DEFINER function with a fixed search_path', () => {
    expect(rpc).toMatch(/language plpgsql/i);
    expect(rpc).toMatch(/security definer/i);
    expect(rpc).toMatch(/set search_path = public/i);
  });

  it('inserts the circles row THEN the owner circle_members row atomically', () => {
    const circleIdx = rpc.indexOf('insert into public.circles');
    const memberIdx = rpc.indexOf('insert into public.circle_members');
    expect(circleIdx).toBeGreaterThanOrEqual(0);
    expect(memberIdx).toBeGreaterThan(circleIdx);
    expect(rpc).toMatch(/values \(v_circle_id, p_owner_id, 'owner'\)/i);
  });

  it('is granted to service_role ONLY (never authenticated / public)', () => {
    expect(sqlOnly).toMatch(/revoke all on function public\.create_circle\(uuid, text, text\) from public/i);
    expect(sqlOnly).toMatch(/grant execute on function public\.create_circle\(uuid, text, text\) to service_role/i);
    expect(sqlOnly).not.toMatch(/grant execute on function public\.create_circle\([^)]*\) to authenticated/i);
  });
});

describe('PRIVATE-GROUPS-002 migration — statement order (Class 3: helpers before policies)', () => {
  it('is_circle_deleted precedes is_circle_member (which calls it)', () => {
    const deleted = sqlOnly.indexOf('function public.is_circle_deleted');
    const member = sqlOnly.indexOf('function public.is_circle_member');
    expect(deleted).toBeGreaterThanOrEqual(0);
    expect(member).toBeGreaterThan(deleted);
  });

  it('every helper is created before the first SELECT policy', () => {
    const lastHelper = sqlOnly.indexOf('function public.create_circle');
    const firstPolicy = sqlOnly.indexOf('create policy');
    expect(lastHelper).toBeGreaterThanOrEqual(0);
    expect(firstPolicy).toBeGreaterThan(lastHelper);
  });
});

describe('PRIVATE-GROUPS-002 migration — NO-BACKFILL (purely additive)', () => {
  it('contains NO INSERT INTO circles / circle_members / circle_invites outside the create_circle RPC body', () => {
    // The create_circle RPC legitimately inserts into circles + circle_members
    // (that is the atomic creation path, not a backfill). Strip the RPC body,
    // then assert no other INSERT INTO a circle* table exists.
    const withoutRpc = sqlOnly.replace(
      /create or replace function public\.create_circle\([\s\S]*?\$\$;/i,
      '',
    );
    expect(withoutRpc).not.toMatch(/insert into public\.circles\b/i);
    expect(withoutRpc).not.toMatch(/insert into public\.circle_members\b/i);
    expect(withoutRpc).not.toMatch(/insert into public\.circle_invites\b/i);
  });

  it('contains NO UPDATE public.debates SET circle_id (no room adoption in the migration)', () => {
    expect(sqlOnly).not.toMatch(/update public\.debates\s+set[\s\S]*circle_id/i);
  });
});
