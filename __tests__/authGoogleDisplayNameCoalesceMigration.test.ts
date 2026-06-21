/**
 * AUTH-GOOGLE-SSO-004 (#747) — migration shape text-scan.
 *
 * Source-file inspection of
 * `20260620000001_auth_google_oauth_display_name_coalesce.sql`. The migration
 * CREATE OR REPLACEs `public.handle_new_user()` to coalesce a display name
 * across the known auth-metadata shapes (display_name / full_name / name /
 * given_name+family_name / email local-part / 'Member'). It is deploy-bearing
 * (GATE-C, merge = apply); end-to-end behaviour (the trigger fires on an
 * auth.users insert and the coalesced name lands in profiles) is verified by
 * the operator post-merge via `npx supabase db reset --linked=false` (Docker)
 * or the heightened textual review per OPS-001. These tests pin the structural
 * invariants the design names so the migration cannot silently drift.
 *
 * Companion: __tests__/coalesceProviderDisplayName.test.ts (the pure-TS twin
 * that mirrors this SQL's coalesce logic).
 */
import * as fs from 'fs';
import * as path from 'path';

const migPath = path.join(
  process.cwd(),
  'supabase/migrations/20260620000001_auth_google_oauth_display_name_coalesce.sql',
);
const migSrc = fs.readFileSync(migPath, 'utf8');

/** SQL only — comment-only lines stripped so prose never false-fires a scan. */
const sqlOnly = migSrc
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');

describe('AUTH-GOOGLE-SSO-004 migration — function shape', () => {
  it('CREATE OR REPLACEs public.handle_new_user() (in-place body swap)', () => {
    expect(sqlOnly).toMatch(/CREATE OR REPLACE FUNCTION public\.handle_new_user\(\)/);
  });

  it('preserves the trigger contract: RETURNS trigger + LANGUAGE plpgsql', () => {
    expect(sqlOnly).toMatch(/RETURNS trigger/);
    expect(sqlOnly).toMatch(/LANGUAGE plpgsql/);
  });

  it('preserves SECURITY DEFINER and the pinned search_path = public', () => {
    expect(sqlOnly).toMatch(/SECURITY DEFINER/);
    expect(sqlOnly).toMatch(/SET search_path = public/);
    // Must NOT widen to public, auth — NEW.email is the trigger row's own column.
    expect(sqlOnly).not.toMatch(/SET search_path = public, auth/);
  });

  it('inserts into public.profiles (id, display_name, role) with the user role', () => {
    expect(sqlOnly).toMatch(/INSERT INTO public\.profiles \(id, display_name, role\)/);
    expect(sqlOnly).toMatch(/VALUES \(NEW\.id, v_display_name, 'user'\)/);
  });

  it('returns NEW (after-insert trigger contract)', () => {
    expect(sqlOnly).toMatch(/RETURN NEW;/);
  });
});

describe('AUTH-GOOGLE-SSO-004 migration — coalesce coverage', () => {
  const coalesce =
    sqlOnly.match(/COALESCE\(([\s\S]*?)\);/)?.[1] ?? '';

  it('wraps the candidates in a single COALESCE(...)', () => {
    expect(coalesce.length).toBeGreaterThan(0);
  });

  it('reads every metadata key the design names', () => {
    expect(coalesce).toContain("'display_name'");
    expect(coalesce).toContain("'full_name'");
    expect(coalesce).toContain("'name'");
    expect(coalesce).toContain("'given_name'");
    expect(coalesce).toContain("'family_name'");
  });

  it('falls back to the email local-part via split_part(NEW.email, ...)', () => {
    expect(coalesce).toMatch(/split_part\(NEW\.email, '@', 1\)/);
  });

  it('ends with the generic literal fallback', () => {
    expect(coalesce).toMatch(/'Member'/);
  });

  it('keeps display_name FIRST, then full_name, name, given_name, split_part', () => {
    const iDisplay = coalesce.indexOf("'display_name'");
    const iFull = coalesce.indexOf("'full_name'");
    const iName = coalesce.indexOf("'name'");
    const iGiven = coalesce.indexOf("'given_name'");
    const iSplit = coalesce.indexOf('split_part(NEW.email');
    expect(iDisplay).toBeGreaterThanOrEqual(0);
    expect(iFull).toBeGreaterThan(iDisplay);
    expect(iName).toBeGreaterThan(iFull);
    expect(iGiven).toBeGreaterThan(iName);
    expect(iSplit).toBeGreaterThan(iGiven);
  });

  it('combines given_name + family_name with concat_ws(\' \', …)', () => {
    expect(coalesce).toMatch(/concat_ws\(' ',/);
  });
});

describe('AUTH-GOOGLE-SSO-004 migration — normalization + cap', () => {
  it('normalizes candidates (regexp_replace whitespace + nullif(btrim(...)))', () => {
    expect(sqlOnly).toMatch(/regexp_replace\(/);
    expect(sqlOnly).toMatch(/nullif\(btrim\(/);
  });

  it('caps the result with left(…, 60) matching DISPLAY_NAME_MAX', () => {
    expect(sqlOnly).toMatch(/left\(v_display_name, 60\)/);
  });
});

describe('AUTH-GOOGLE-SSO-004 migration — idempotency + no-clobber', () => {
  it('preserves ON CONFLICT (id) DO NOTHING (never DO UPDATE)', () => {
    expect(sqlOnly).toMatch(/ON CONFLICT \(id\) DO NOTHING/);
    expect(sqlOnly).not.toMatch(/ON CONFLICT[\s\S]*DO UPDATE/i);
  });
});

describe('AUTH-GOOGLE-SSO-004 migration — no schema/trigger drift', () => {
  it('does NOT ALTER TABLE public.profiles (no column/constraint change)', () => {
    expect(sqlOnly).not.toMatch(/ALTER TABLE public\.profiles/i);
  });

  it('does NOT DROP or re-CREATE the trigger (CREATE OR REPLACE keeps it bound)', () => {
    expect(sqlOnly).not.toMatch(/DROP TRIGGER/i);
    expect(sqlOnly).not.toMatch(/CREATE TRIGGER/i);
  });
});

describe('AUTH-GOOGLE-SSO-004 migration — doctrine negatives', () => {
  it('never disables RLS or drops a policy', () => {
    expect(sqlOnly).not.toMatch(/DISABLE ROW LEVEL SECURITY/i);
    expect(sqlOnly).not.toMatch(/DROP POLICY/i);
  });

  it('adds no service_role grant or service-role reference', () => {
    expect(sqlOnly).not.toMatch(/service_role/i);
    expect(sqlOnly).not.toMatch(/SERVICE_ROLE/);
    expect(sqlOnly).not.toMatch(/GRANT/i);
  });

  it('contains no secret-shaped or provider-secret literal', () => {
    expect(sqlOnly).not.toMatch(/sk-/);
    expect(sqlOnly).not.toMatch(/sb_secret_/);
    expect(sqlOnly).not.toMatch(/Bearer/i);
    expect(sqlOnly).not.toMatch(/GOOGLE_OAUTH/i);
    expect(sqlOnly).not.toMatch(/CLIENT_SECRET/i);
    expect(sqlOnly).not.toMatch(/ANTHROPIC_API_KEY/i);
  });
});

describe('AUTH-GOOGLE-SSO-004 migration — emitted literal is ban-list-clean', () => {
  // The ONLY user-facing literal this card emits is the generic fallback.
  const BANNED = [
    'winner',
    'loser',
    'liar',
    'true',
    'false',
    'correct',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'stupid',
    'idiot',
  ];

  it("the 'Member' fallback contains no doctrine ban-list token", () => {
    const literal = (sqlOnly.match(/'(Member)'/)?.[1] ?? '').toLowerCase();
    expect(literal).toBe('member');
    for (const b of BANNED) {
      expect(literal).not.toContain(b);
    }
  });
});

describe('AUTH-GOOGLE-SSO-004 migration — append-only discipline', () => {
  it('the migration file exists at its slot', () => {
    expect(fs.existsSync(migPath)).toBe(true);
  });

  it('documents the auth.users / NEW.email dependency in the header', () => {
    expect(migSrc).toMatch(/auth\.users/);
    expect(migSrc).toMatch(/NEW\.email/);
  });

  it('documents the GATE-C merge = apply reminder in the header', () => {
    expect(migSrc).toMatch(/GATE-C/);
    expect(migSrc).toMatch(/merge = apply/i);
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

  it('does NOT edit the applied initial_schema migration (new file only)', () => {
    // This migration re-declares the function body via CREATE OR REPLACE but
    // never re-creates the profiles table or the on_auth_user_created trigger.
    expect(sqlOnly).not.toMatch(/CREATE TABLE[\s\S]*public\.profiles/i);
    expect(sqlOnly).not.toMatch(/on_auth_user_created/);
  });
});
