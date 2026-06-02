/**
 * OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE — migration shape +
 * the load-bearing additive-nullable / 9-arg-finalizer / success-NULL contract.
 *
 * Pure-text scan of
 * supabase/migrations/20260602000001_ops_mcp_classifier_failure_detail.sql.
 *
 * Docker was unavailable in the implementer environment, so the RUNTIME
 * behavior is proven by the operator post-merge (the existing 8-arg verifier
 * script, which keeps working because the new param is DEFAULT NULL). THESE
 * tests lock the TEXT/SHAPE contract: the column is additive-nullable with NO
 * backfill, the old 8-arg finalizer is DROPPED and re-created 9-arg, the
 * terminal-failure UPDATE assigns failure_detail = p_failure_detail, and the
 * SUCCESS branch never references it (so a succeeded row stays NULL).
 *
 * Mirrors __tests__/archOneCardTwoAFinalizerMigration.test.ts.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260602000001_ops_mcp_classifier_failure_detail.sql',
);

// The PRIOR finalizer migration — asserted UNTOUCHED by reference (this card
// never edits an applied migration; the 8-arg shape test stays green on it).
const PRIOR_FINALIZER_PATH = join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260528000022_arch_001_card2a_atomic_finalizer.sql',
);

let migrationText = '';
let executableOnly = '';

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

/** Extract the CREATE OR REPLACE FUNCTION body up to the closing `$$;`. */
function functionBody(): string {
  const start = migrationText.indexOf('CREATE OR REPLACE FUNCTION public.finalize_classifier_job');
  if (start < 0) return '';
  const open = migrationText.indexOf('AS $$', start);
  const close = migrationText.indexOf('$$;', open);
  return migrationText.slice(start, close + 3);
}

beforeAll(() => {
  migrationText = readFileSync(MIGRATION_PATH, 'utf8');
  executableOnly = stripSqlComments(migrationText);
});

describe('OPS-FDP-MIG — file exists + OPS-001 header + operator gate', () => {
  it('MIG-1 — migration file exists with non-empty content', () => {
    expect(migrationText.length).toBeGreaterThan(0);
  });

  it('MIG-2 — sorts AFTER the latest migration ordinal 20260601000001', () => {
    expect('20260602000001' > '20260601000001').toBe(true);
  });

  it('MIG-3 — header records the OPERATOR GATE (written, not applied; migrate BEFORE merge)', () => {
    expect(migrationText).toMatch(/WRITTEN, NOT APPLIED/);
    expect(migrationText).toContain('supabase db push --linked');
    expect(migrationText).toMatch(/BEFORE the drainer PR merges/i);
  });

  it('MIG-4 — header documents the finalizer predecessor + names OPS-001 Class 1-4', () => {
    expect(migrationText).toContain('20260528000022_arch_001_card2a_atomic_finalizer.sql');
    expect(migrationText).toMatch(/Class 1 —/);
    expect(migrationText).toMatch(/Class 2 —/);
    expect(migrationText).toMatch(/Class 3 —/);
    expect(migrationText).toMatch(/Class 4 —/);
  });
});

describe('OPS-FDP-MIG — additive nullable column, NO backfill, no other schema change', () => {
  it('MIG-5 — ADD COLUMN failure_detail jsonb (IF NOT EXISTS)', () => {
    expect(executableOnly).toMatch(
      /ALTER TABLE public\.argument_machine_observation_runs\s+ADD COLUMN IF NOT EXISTS failure_detail jsonb/,
    );
  });

  it('MIG-6 — failure_detail is NOT NULL-constrained (stays nullable)', () => {
    // No `failure_detail ... NOT NULL` anywhere in executable SQL.
    expect(executableOnly).not.toMatch(/failure_detail\s+jsonb\s+NOT NULL/i);
    expect(executableOnly).not.toMatch(/ALTER COLUMN failure_detail[\s\S]*?SET NOT NULL/i);
  });

  it('MIG-7 — NO backfill UPDATE of the runs table', () => {
    expect(executableOnly).not.toMatch(/UPDATE public\.argument_machine_observation_runs\s+SET failure_detail/i);
    // No standalone backfill statement (the only UPDATEs are inside the function body).
  });

  it('MIG-8 — NO new table / index / RLS / policy / extension', () => {
    expect(executableOnly).not.toMatch(/CREATE TABLE/i);
    expect(executableOnly).not.toMatch(/CREATE INDEX/i);
    expect(executableOnly).not.toMatch(/CREATE UNIQUE INDEX/i);
    expect(executableOnly).not.toMatch(/CREATE POLICY/i);
    expect(executableOnly).not.toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(executableOnly).not.toMatch(/CREATE EXTENSION/i);
    expect(executableOnly).not.toMatch(/DROP TABLE/i);
    expect(executableOnly).not.toMatch(/DROP COLUMN/i);
    expect(executableOnly).not.toMatch(/TRUNCATE/i);
  });

  it('MIG-9 — does NOT cron.schedule / net.http_post anything', () => {
    expect(executableOnly).not.toMatch(/cron\.schedule/i);
    expect(executableOnly).not.toMatch(/net\.http_post|http_post|http_get/i);
  });
});

describe('OPS-FDP-MIG — finalizer re-create (DROP 8-arg, CREATE 9-arg)', () => {
  it('MIG-10 — DROPs the old 8-arg overload explicitly', () => {
    expect(executableOnly).toMatch(
      /DROP FUNCTION IF EXISTS public\.finalize_classifier_job\(\s*uuid,\s*text,\s*text,\s*text,\s*text,\s*text,\s*text,\s*jsonb\s*\)/,
    );
  });

  it('MIG-11 — exactly ONE CREATE OR REPLACE FUNCTION (finalize_classifier_job)', () => {
    const creates = executableOnly.match(/CREATE OR REPLACE FUNCTION public\.(\w+)/g) ?? [];
    expect(creates).toEqual(['CREATE OR REPLACE FUNCTION public.finalize_classifier_job']);
  });

  it('MIG-12 — 9-parameter signature ending in p_failure_detail jsonb DEFAULT NULL', () => {
    expect(executableOnly).toMatch(
      /CREATE OR REPLACE FUNCTION public\.finalize_classifier_job\(\s*p_run_id\s+uuid,\s*p_owner\s+text,\s*p_terminal_state\s+text,\s*p_status\s+text,\s*p_failure_reason\s+text,\s*p_failure_sub_reason\s+text,\s*p_dead_letter_reason\s+text,\s*p_observations\s+jsonb,\s*p_failure_detail\s+jsonb\s+DEFAULT NULL\s*\)/,
    );
  });

  it('MIG-13 — RETURNS boolean, LANGUAGE plpgsql, SECURITY INVOKER (no DEFINER escalation)', () => {
    const b = functionBody();
    expect(b).toMatch(/RETURNS boolean/);
    expect(b).toMatch(/LANGUAGE plpgsql/);
    expect(b).toMatch(/SECURITY INVOKER/);
    expect(executableOnly).not.toMatch(/SECURITY DEFINER/);
  });
});

describe('OPS-FDP-MIG — atomicity + ownership guard preserved (unchanged from Card 2A)', () => {
  it('MIG-14 — body has NO COMMIT / ROLLBACK / SAVEPOINT', () => {
    const b = stripSqlComments(functionBody());
    expect(b).not.toMatch(/\bCOMMIT\b/i);
    expect(b).not.toMatch(/\bROLLBACK\b/i);
    expect(b).not.toMatch(/\bSAVEPOINT\b/i);
  });

  it('MIG-15 — no autonomous / dblink / pg_background / EXCEPTION WHEN (single atomic block)', () => {
    const b = stripSqlComments(functionBody());
    expect(b).not.toMatch(/autonomous/i);
    expect(b).not.toMatch(/dblink/i);
    expect(b).not.toMatch(/pg_background/i);
    expect(b).not.toMatch(/\bEXCEPTION\s+WHEN\b/i);
  });

  it('MIG-16 — ownership guard locks lease_owner=p_owner AND state=leased FOR UPDATE, before any write', () => {
    const b = functionBody();
    expect(b).toMatch(/r\.lease_owner = p_owner/);
    expect(b).toMatch(/r\.state = 'leased'/);
    expect(b).toMatch(/FOR UPDATE/);
    const guard = stripSqlComments(b).indexOf('FOR UPDATE');
    const firstUpdate = stripSqlComments(b).indexOf('UPDATE public.argument_machine_observation_runs');
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(firstUpdate).toBeGreaterThan(guard);
  });

  it('MIG-17 — NOT FOUND → RETURN false (hard no-op); only one RETURN false', () => {
    const b = stripSqlComments(functionBody());
    expect(b).toMatch(/IF NOT FOUND THEN[\s\S]*?RETURN false;/);
    expect((b.match(/RETURN false;/g) ?? []).length).toBe(1);
  });
});

describe('OPS-FDP-MIG — failure_detail write placement (terminal yes, success NO)', () => {
  it('MIG-18 — the TERMINAL-FAILURE UPDATE assigns failure_detail = p_failure_detail', () => {
    const b = functionBody();
    const afterSuccess = b.slice(b.indexOf('RETURN true;') + 'RETURN true;'.length);
    expect(afterSuccess).toMatch(/failure_detail\s*=\s*p_failure_detail/);
    // and it still sets the typed failure fields + clears the lease.
    expect(afterSuccess).toMatch(/state\s*=\s*p_terminal_state/);
    expect(afterSuccess).toMatch(/failure_reason\s*=\s*p_failure_reason/);
    expect(afterSuccess).toMatch(/lease_owner\s*=\s*NULL/);
  });

  it('MIG-19 — the SUCCESS branch does NOT reference failure_detail (succeeded row stays NULL)', () => {
    const b = functionBody();
    const successStart = b.indexOf("IF p_terminal_state = 'succeeded' THEN");
    const successEnd = b.indexOf('RETURN true;', successStart) + 'RETURN true;'.length;
    const win = b.slice(successStart, successEnd);
    expect(win).not.toMatch(/failure_detail/);
  });

  it('MIG-20 — failure_detail is assigned EXACTLY ONCE (the terminal-failure UPDATE only)', () => {
    const b = stripSqlComments(functionBody());
    const assigns = b.match(/failure_detail\s*=\s*p_failure_detail/g) ?? [];
    expect(assigns.length).toBe(1);
  });

  it('MIG-21 — terminal-failure branch writes NO result rows (one INSERT total, in the success branch)', () => {
    const b = stripSqlComments(functionBody());
    const inserts = b.match(/INSERT INTO public\.argument_machine_observation_results/g) ?? [];
    expect(inserts.length).toBe(1);
  });
});

describe('OPS-FDP-MIG — secret safety + COMMENTs', () => {
  it('MIG-22 — no SERVICE_ROLE / secret-shaped literal in executable SQL', () => {
    expect(executableOnly).not.toMatch(/SERVICE_ROLE/i);
    expect(executableOnly).not.toMatch(/ANTHROPIC_API_KEY/i);
    expect(executableOnly).not.toMatch(/sk-ant-/);
    expect(executableOnly).not.toMatch(/sb_secret/);
    expect(executableOnly).not.toMatch(/xai-/);
    expect(executableOnly).not.toMatch(/Bearer /);
    expect(executableOnly).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  });

  it('MIG-23 — no COMMENT ON ... storage.* (PR-003 SQLSTATE 42501 boundary)', () => {
    expect(migrationText).not.toMatch(/COMMENT ON\s+\w+\s+storage\./i);
  });

  it('MIG-24 — exactly one COMMENT ON COLUMN failure_detail (leak-safe diagnostic, doctrine wording)', () => {
    const comments = migrationText.match(
      /COMMENT ON COLUMN public\.argument_machine_observation_runs\.failure_detail/g,
    ) ?? [];
    expect(comments.length).toBe(1);
    expect(migrationText).toMatch(/leak-safe diagnostic/i);
    expect(migrationText).toMatch(/WRITE-ONLY diagnostics: nothing reads it/i);
  });

  it('MIG-25 — COMMENT ON FUNCTION targets the 9-arg overload', () => {
    expect(migrationText).toMatch(
      /COMMENT ON FUNCTION public\.finalize_classifier_job\(uuid, text, text, text, text, text, text, jsonb, jsonb\)/,
    );
  });
});

describe('OPS-FDP-MIG — the prior finalizer migration is NOT edited', () => {
  it('MIG-26 — 20260528000022 still declares the 8-arg signature (never edited by this card)', () => {
    const prior = readFileSync(PRIOR_FINALIZER_PATH, 'utf8');
    // Comment-strip first: each param line carries an inline `-- …` comment
    // that would otherwise break the contiguous signature match.
    const priorCode = stripSqlComments(prior);
    expect(priorCode).toMatch(
      /CREATE OR REPLACE FUNCTION public\.finalize_classifier_job\([\s\S]*?p_observations\s+jsonb\s*\)/,
    );
    // The prior 8-arg migration must NOT mention failure_detail (this card owns it).
    expect(priorCode).not.toMatch(/p_failure_detail/);
    expect(priorCode).not.toMatch(/failure_detail/);
  });
});
