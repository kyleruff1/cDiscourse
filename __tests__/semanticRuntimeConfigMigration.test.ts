/**
 * ADMIN-AI-001 — migration + RLS + SECURITY DEFINER contract.
 *
 * A local `npx supabase db reset` is the operator-side proof that the
 * migration applies cleanly (it needs Docker). CI-time coverage is the
 * schema / RLS / function SHAPE asserted here against the documented design
 * contract — the same convention `argumentDeletionRequest.test.ts` uses for
 * the Stage 6.1.8 migration.
 */
import * as fs from 'fs';
import * as path from 'path';

const MIGRATION = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260522000011_admin_ai_001_semantic_referee_runtime_config.sql',
  ),
  'utf8',
);

// ── 1. semantic_referee_runtime_config — the singleton ───────────

describe('migration — semantic_referee_runtime_config table', () => {
  it('creates the table', () => {
    expect(MIGRATION).toMatch(/CREATE TABLE public\.semantic_referee_runtime_config/);
  });

  it('enforces the singleton with id boolean PK CHECK (id = true)', () => {
    expect(MIGRATION).toMatch(/id\s+boolean\s+PRIMARY KEY DEFAULT true CHECK \(id = true\)/);
  });

  it('CHECK-constrains provider_mode to the four registry slots', () => {
    expect(MIGRATION).toMatch(
      /provider_mode\s+text\s+NOT NULL DEFAULT 'anthropic'\s*\n\s*CHECK \(provider_mode IN \('anthropic', 'mock', 'fixture', 'mcp'\)\)/,
    );
  });

  it('has an enabled boolean runtime off-switch (NOT NULL, default true)', () => {
    expect(MIGRATION).toMatch(/enabled\s+boolean\s+NOT NULL DEFAULT true/);
  });

  it('references profiles for updated_by with ON DELETE SET NULL', () => {
    expect(MIGRATION).toMatch(/updated_by\s+uuid\s+NULL REFERENCES public\.profiles\(id\) ON DELETE SET NULL/);
  });

  it('seeds exactly one row { provider_mode: anthropic, enabled: true }', () => {
    expect(MIGRATION).toMatch(
      /INSERT INTO public\.semantic_referee_runtime_config \(id, provider_mode, enabled\)\s*\n\s*VALUES \(true, 'anthropic', true\)/,
    );
  });
});

describe('migration — semantic_referee_runtime_config RLS', () => {
  it('enables row level security', () => {
    expect(MIGRATION).toMatch(/ALTER TABLE public\.semantic_referee_runtime_config ENABLE ROW LEVEL SECURITY/);
  });

  it('admins can SELECT (is_admin)', () => {
    expect(MIGRATION).toMatch(
      /CREATE POLICY "semantic_referee_runtime_config: admins can select"[\s\S]*?FOR SELECT[\s\S]*?USING \(public\.is_admin\(auth\.uid\(\)\)\)/,
    );
  });

  it('admins can UPDATE (is_admin USING + WITH CHECK)', () => {
    expect(MIGRATION).toMatch(
      /CREATE POLICY "semantic_referee_runtime_config: admins can update"[\s\S]*?FOR UPDATE[\s\S]*?USING \(public\.is_admin\(auth\.uid\(\)\)\)\s*\n\s*WITH CHECK \(public\.is_admin\(auth\.uid\(\)\)\)/,
    );
  });

  it('has NO INSERT policy and NO DELETE policy (seed-only, permanent row)', () => {
    expect(MIGRATION).not.toMatch(/POLICY "semantic_referee_runtime_config: [^"]*insert"/i);
    expect(MIGRATION).not.toMatch(/POLICY "semantic_referee_runtime_config: [^"]*delete"/i);
  });
});

// ── 2. semantic_referee_config_audit — append-only ───────────────

describe('migration — semantic_referee_config_audit table', () => {
  it('creates the audit table with previous_mode / new_mode columns', () => {
    expect(MIGRATION).toMatch(/CREATE TABLE public\.semantic_referee_config_audit/);
    expect(MIGRATION).toMatch(/previous_mode\s+text\s+NULL/);
    expect(MIGRATION).toMatch(/new_mode\s+text\s+NOT NULL/);
    expect(MIGRATION).toMatch(/previous_enabled\s+boolean\s+NULL/);
    expect(MIGRATION).toMatch(/new_enabled\s+boolean\s+NOT NULL/);
  });

  it('indexes the audit table by created_at DESC', () => {
    expect(MIGRATION).toMatch(
      /CREATE INDEX semantic_referee_config_audit_created_idx[\s\S]*?\(created_at DESC\)/,
    );
  });

  it('enables RLS on the audit table', () => {
    expect(MIGRATION).toMatch(/ALTER TABLE public\.semantic_referee_config_audit ENABLE ROW LEVEL SECURITY/);
  });

  it('admins can SELECT and INSERT audit rows', () => {
    expect(MIGRATION).toMatch(/CREATE POLICY "semantic_referee_config_audit: admins can select"/);
    expect(MIGRATION).toMatch(/CREATE POLICY "semantic_referee_config_audit: admins can insert"/);
  });

  it('has NO UPDATE policy and NO DELETE policy — history is immutable', () => {
    expect(MIGRATION).not.toMatch(/POLICY "semantic_referee_config_audit: [^"]*update"/i);
    expect(MIGRATION).not.toMatch(/POLICY "semantic_referee_config_audit: [^"]*delete"/i);
  });
});

// ── 3. get_semantic_referee_runtime_config() — SECURITY DEFINER ──

describe('migration — get_semantic_referee_runtime_config() function', () => {
  it('is SECURITY DEFINER with a LOCKED search_path (no escalation)', () => {
    expect(MIGRATION).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_semantic_referee_runtime_config\(\)[\s\S]*?SECURITY DEFINER\s*\n\s*SET search_path = public/,
    );
  });

  it('RETURNS only the three SAFE fields — never updated_by, never audit', () => {
    expect(MIGRATION).toMatch(
      /RETURNS TABLE \(provider_mode text, enabled boolean, updated_at timestamptz\)/,
    );
    // The function body selects exactly those three columns.
    expect(MIGRATION).toMatch(/SELECT provider_mode, enabled, updated_at\s*\n\s*FROM public\.semantic_referee_runtime_config/);
    // No SELECT * (which would leak updated_by).
    const fnBlock = MIGRATION.slice(
      MIGRATION.indexOf('CREATE OR REPLACE FUNCTION public.get_semantic_referee_runtime_config'),
    );
    expect(fnBlock).not.toMatch(/SELECT \*/);
  });

  it('REVOKEs from PUBLIC then GRANTs EXECUTE to authenticated + service_role', () => {
    expect(MIGRATION).toMatch(
      /REVOKE ALL ON FUNCTION public\.get_semantic_referee_runtime_config\(\) FROM PUBLIC/,
    );
    expect(MIGRATION).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_semantic_referee_runtime_config\(\) TO authenticated, service_role/,
    );
  });
});

// ── 4. Migration discipline ──────────────────────────────────────

describe('migration — discipline', () => {
  it('is the next sequential migration after 20260521000010', () => {
    const files = fs
      .readdirSync(path.join(process.cwd(), 'supabase/migrations'))
      .filter((f) => f.endsWith('.sql'))
      .sort();
    const idx = files.indexOf(
      '20260522000011_admin_ai_001_semantic_referee_runtime_config.sql',
    );
    expect(idx).toBeGreaterThan(-1);
    expect(files[idx - 1]).toBe('20260521000010_qol042_argument_room_links.sql');
  });

  it('never disables RLS on any table', () => {
    expect(MIGRATION).not.toMatch(/DISABLE ROW LEVEL SECURITY/i);
  });

  it('reuses the existing is_admin() helper rather than redefining it', () => {
    expect(MIGRATION).not.toMatch(/CREATE (OR REPLACE )?FUNCTION public\.is_admin/);
    expect(MIGRATION).toMatch(/public\.is_admin\(auth\.uid\(\)\)/);
  });
});
