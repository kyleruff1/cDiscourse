/**
 * DEV-SEED-001 (#772) — seed auth.users before profiles (TEXT SCAN).
 *
 * Pure-text scan of supabase/seed.sql. The RUNTIME behavior (the FK satisfied,
 * the on_auth_user_created trigger firing, the upsert preserving the moderator
 * role) is exercised against real Postgres by `supabase db reset` locally and by
 * the Supabase PREVIEW when this PR opens — there is no Docker in CI/this
 * session. These tests lock the seed SHAPE so the FK-ordering fix + the
 * trigger/role interaction handling cannot regress silently. Mirrors the
 * migration text-scan tests (e.g. archOneCardTwoEnqueueKickMigration.test.ts).
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const SEED_PATH = join(__dirname, '..', 'supabase', 'seed.sql');

const ALICE = '00000000-0000-0000-0000-000000000001';
const BOB = '00000000-0000-0000-0000-000000000002';
const MOD = '00000000-0000-0000-0000-000000000003';
const DEV_UUIDS = [ALICE, BOB, MOD];

let seedText = '';

/** Strip SQL line + block comments so keyword scans hit executable DDL only. */
function stripSqlComments(src: string): string {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '-' && next === '-') {
      while (i < n && src[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

let code = ''; // comment-stripped executable SQL

beforeAll(() => {
  seedText = readFileSync(SEED_PATH, 'utf8');
  code = stripSqlComments(seedText);
});

describe('DEV-SEED-001 — auth.users seeded before profiles (FK fix)', () => {
  it('SEED-1 — inserts into auth.users', () => {
    expect(code).toMatch(/INSERT\s+INTO\s+auth\.users/i);
  });

  it('SEED-2 — inserts into public.profiles', () => {
    expect(code).toMatch(/INSERT\s+INTO\s+public\.profiles/i);
  });

  it('SEED-3 — the auth.users insert comes BEFORE the public.profiles insert', () => {
    const authIdx = code.search(/INSERT\s+INTO\s+auth\.users/i);
    const profilesIdx = code.search(/INSERT\s+INTO\s+public\.profiles/i);
    expect(authIdx).toBeGreaterThanOrEqual(0);
    expect(profilesIdx).toBeGreaterThanOrEqual(0);
    // FK profiles.id -> auth.users(id): the parent rows must exist first.
    expect(authIdx).toBeLessThan(profilesIdx);
  });

  it('SEED-4 — all three dev UUIDs appear in BOTH the auth.users and profiles inserts', () => {
    const authBlock = code.slice(
      code.search(/INSERT\s+INTO\s+auth\.users/i),
      code.search(/INSERT\s+INTO\s+public\.profiles/i),
    );
    const profilesBlock = code.slice(code.search(/INSERT\s+INTO\s+public\.profiles/i));
    for (const uuid of DEV_UUIDS) {
      expect(authBlock).toContain(uuid);
      expect(profilesBlock).toContain(uuid);
    }
  });
});

describe('DEV-SEED-001 — idempotency + trigger/role interaction', () => {
  it('SEED-5 — the auth.users insert is idempotent (ON CONFLICT (id) DO NOTHING)', () => {
    const authBlock = code.slice(
      code.search(/INSERT\s+INTO\s+auth\.users/i),
      code.search(/INSERT\s+INTO\s+public\.profiles/i),
    );
    expect(authBlock).toMatch(/ON\s+CONFLICT\s*\(\s*id\s*\)\s+DO\s+NOTHING/i);
  });

  it('SEED-6 — profiles is an UPSERT (ON CONFLICT (id) DO UPDATE), not DO NOTHING', () => {
    // The on_auth_user_created trigger already creates the profile rows as
    // role 'user'; a plain DO NOTHING would leave Mod as 'user'. The upsert
    // makes the explicit dev display_name + role win.
    const profilesBlock = code.slice(code.search(/INSERT\s+INTO\s+public\.profiles/i));
    expect(profilesBlock).toMatch(/ON\s+CONFLICT\s*\(\s*id\s*\)\s+DO\s+UPDATE/i);
    expect(profilesBlock).toMatch(/SET[\s\S]*\brole\s*=\s*EXCLUDED\.role/i);
    expect(profilesBlock).toMatch(/SET[\s\S]*display_name\s*=\s*EXCLUDED\.display_name/i);
  });

  it('SEED-7 — Mod (Dev) resolves to role moderator', () => {
    // The mod UUID is seeded with role 'moderator' and the upsert SET role =
    // EXCLUDED.role carries that through over the trigger default.
    const profilesBlock = code.slice(code.search(/INSERT\s+INTO\s+public\.profiles/i));
    // The mod row's VALUES tuple pairs the mod UUID with 'moderator'.
    expect(profilesBlock).toMatch(
      new RegExp(`${MOD}'[^)]*'moderator'`, 'i'),
    );
    // And the upsert propagates the supplied role (defense against a future
    // edit that drops the role from the SET clause).
    expect(profilesBlock).toMatch(/role\s*=\s*EXCLUDED\.role/i);
  });
});

describe('DEV-SEED-001 — doctrine + safety', () => {
  it('SEED-8 — retains the "DO NOT apply to staging or production" header', () => {
    // Comment scan: assert against the RAW file (the guard lives in comments).
    expect(seedText).toMatch(/DO NOT apply to staging or production/i);
  });

  it('SEED-9 — no service_role usage and no provider secret literal', () => {
    expect(code).not.toMatch(/service_role/i);
    expect(seedText).not.toMatch(/SERVICE_ROLE_KEY/i);
    // No provider/API secret literal shapes.
    expect(seedText).not.toMatch(/sk-ant-/i);
    expect(seedText).not.toMatch(/xai-/i);
    expect(seedText).not.toMatch(/sb_secret_/i);
    expect(seedText).not.toMatch(/Bearer\s+[A-Za-z0-9._-]{20,}/);
  });

  it('SEED-10 — the only password literal is the documented non-secret dev placeholder', () => {
    // We deliberately use a throwaway, documented dev password via crypt(); there
    // must be no real/secret bcrypt or password hash literal checked in.
    expect(code).toMatch(/crypt\(\s*'devpassword'\s*,\s*gen_salt\(\s*'bf'\s*\)\s*\)/i);
    // Guard against a static bcrypt hash sneaking in instead of the dev crypt().
    expect(seedText).not.toMatch(/\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}/);
  });

  it('SEED-11 — does not touch auth.users for anything but the three dev rows', () => {
    // Only one auth.users INSERT, no UPDATE/DELETE/TRUNCATE against auth.users.
    const authInserts = code.match(/INSERT\s+INTO\s+auth\.users/gi) ?? [];
    expect(authInserts.length).toBe(1);
    expect(code).not.toMatch(/UPDATE\s+auth\.users/i);
    expect(code).not.toMatch(/DELETE\s+FROM\s+auth\.users/i);
    expect(code).not.toMatch(/TRUNCATE\s+auth\.users/i);
  });
});
