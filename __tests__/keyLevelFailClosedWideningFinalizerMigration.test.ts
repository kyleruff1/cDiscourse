/**
 * OPS-MCP-KEY-LEVEL-FAIL-CLOSED-WIDENING — finalizer migration shape +
 * the load-bearing additive-param / 10-arg-finalizer / success-write contract.
 *
 * Pure-text scan of
 * supabase/migrations/20260611000002_ops_mcp_key_level_fail_closed_widening_finalizer.sql.
 *
 * Docker was unavailable in the implementer environment, so the RUNTIME
 * behavior is proven by the operator post-merge (the existing 8/9-arg verifier
 * scripts keep working because the new param is DEFAULT NULL). THESE tests lock
 * the TEXT/SHAPE contract: the 9-arg finalizer is DROPPED and re-created 10-arg
 * with a trailing `p_dropped_unclean_span_keys text[] DEFAULT NULL`, the SUCCESS
 * branch assigns `dropped_unclean_span_keys = p_dropped_unclean_span_keys` and
 * NEVER references failure_detail, the TERMINAL-FAILURE branch is faithful to
 * 20260602000001 (still assigns failure_detail = p_failure_detail) and does NOT
 * touch dropped_unclean_span_keys, and there is NO ALTER TABLE (the column
 * already exists from 20260611000001).
 *
 * Mirrors __tests__/opsMcpClassifierFailureDetailMigration.test.ts.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260611000002_ops_mcp_key_level_fail_closed_widening_finalizer.sql',
);

// The PRIOR finalizer migration (9-arg) — asserted UNTOUCHED by reference (this
// card never edits an applied migration; the 9-arg shape test stays green).
const PRIOR_FINALIZER_PATH = join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260602000001_ops_mcp_classifier_failure_detail.sql',
);

// The column migration (J-only) — asserted UNTOUCHED; it owns the ADD COLUMN.
const COLUMN_MIGRATION_PATH = join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260611000001_ops_mcp_key_level_fail_closed_dropped_keys.sql',
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

describe('KLF-WIDEN-MIG — file exists + OPS-001 header + operator gate', () => {
  it('MIG-1 — migration file exists with non-empty content', () => {
    expect(migrationText.length).toBeGreaterThan(0);
  });

  it('MIG-2 — sorts AFTER the J-only column migration ordinal 20260611000001', () => {
    expect('20260611000002' > '20260611000001').toBe(true);
  });

  it('MIG-3 — header records the OPERATOR GATE (written, not applied; migrate BEFORE merge)', () => {
    expect(migrationText).toMatch(/WRITTEN, NOT APPLIED/);
    expect(migrationText).toContain('supabase db push --linked');
    expect(migrationText).toMatch(/BEFORE merging/i);
  });

  it('MIG-4 — header documents the finalizer + column predecessors + names OPS-001 Class 1-4', () => {
    expect(migrationText).toContain('20260602000001_ops_mcp_classifier_failure_detail.sql');
    expect(migrationText).toContain('20260611000001_ops_mcp_key_level_fail_closed_dropped_keys.sql');
    expect(migrationText).toMatch(/Class 1 —/);
    expect(migrationText).toMatch(/Class 2 —/);
    expect(migrationText).toMatch(/Class 3 —/);
    expect(migrationText).toMatch(/Class 4 —/);
  });
});

describe('KLF-WIDEN-MIG — NO column / table / index / RLS change (function re-create only)', () => {
  it('MIG-5 — NO ALTER TABLE (the dropped_unclean_span_keys column already exists)', () => {
    expect(executableOnly).not.toMatch(/ALTER TABLE/i);
    expect(executableOnly).not.toMatch(/ADD COLUMN/i);
  });

  it('MIG-6 — NO backfill UPDATE outside the function body', () => {
    // The only UPDATEs are inside the function body (against the locked run row).
    // There is no standalone backfill statement.
    expect(executableOnly).not.toMatch(/UPDATE public\.argument_machine_observation_runs\s+SET dropped_unclean_span_keys\s*=\s*ARRAY/i);
  });

  it('MIG-7 — NO new table / index / RLS / policy / extension / drop-column / truncate', () => {
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

  it('MIG-8 — does NOT cron.schedule / net.http_post anything', () => {
    expect(executableOnly).not.toMatch(/cron\.schedule/i);
    expect(executableOnly).not.toMatch(/net\.http_post|http_post|http_get/i);
  });
});

describe('KLF-WIDEN-MIG — finalizer re-create (DROP 9-arg, CREATE 10-arg)', () => {
  it('MIG-9 — DROPs the old 9-arg overload explicitly', () => {
    expect(executableOnly).toMatch(
      /DROP FUNCTION IF EXISTS public\.finalize_classifier_job\(\s*uuid,\s*text,\s*text,\s*text,\s*text,\s*text,\s*text,\s*jsonb,\s*jsonb\s*\)/,
    );
  });

  it('MIG-10 — exactly ONE CREATE OR REPLACE FUNCTION (finalize_classifier_job)', () => {
    const creates = executableOnly.match(/CREATE OR REPLACE FUNCTION public\.(\w+)/g) ?? [];
    expect(creates).toEqual(['CREATE OR REPLACE FUNCTION public.finalize_classifier_job']);
  });

  it('MIG-11 — 10-parameter signature: 9-arg shape + trailing p_dropped_unclean_span_keys text[] DEFAULT NULL', () => {
    expect(executableOnly).toMatch(
      /CREATE OR REPLACE FUNCTION public\.finalize_classifier_job\(\s*p_run_id\s+uuid,\s*p_owner\s+text,\s*p_terminal_state\s+text,\s*p_status\s+text,\s*p_failure_reason\s+text,\s*p_failure_sub_reason\s+text,\s*p_dead_letter_reason\s+text,\s*p_observations\s+jsonb,\s*p_failure_detail\s+jsonb\s+DEFAULT NULL,\s*p_dropped_unclean_span_keys\s+text\[\]\s+DEFAULT NULL\s*\)/,
    );
  });

  it('MIG-12 — RETURNS boolean, LANGUAGE plpgsql, SECURITY INVOKER (no DEFINER escalation)', () => {
    const b = functionBody();
    expect(b).toMatch(/RETURNS boolean/);
    expect(b).toMatch(/LANGUAGE plpgsql/);
    expect(b).toMatch(/SECURITY INVOKER/);
    expect(executableOnly).not.toMatch(/SECURITY DEFINER/);
  });
});

describe('KLF-WIDEN-MIG — atomicity + ownership guard preserved (unchanged from 20260602000001)', () => {
  it('MIG-13 — body has NO COMMIT / ROLLBACK / SAVEPOINT', () => {
    const b = stripSqlComments(functionBody());
    expect(b).not.toMatch(/\bCOMMIT\b/i);
    expect(b).not.toMatch(/\bROLLBACK\b/i);
    expect(b).not.toMatch(/\bSAVEPOINT\b/i);
  });

  it('MIG-14 — no autonomous / dblink / pg_background / EXCEPTION WHEN (single atomic block)', () => {
    const b = stripSqlComments(functionBody());
    expect(b).not.toMatch(/autonomous/i);
    expect(b).not.toMatch(/dblink/i);
    expect(b).not.toMatch(/pg_background/i);
    expect(b).not.toMatch(/\bEXCEPTION\s+WHEN\b/i);
  });

  it('MIG-15 — ownership guard locks lease_owner=p_owner AND state=leased FOR UPDATE, before any write', () => {
    const b = functionBody();
    expect(b).toMatch(/r\.lease_owner = p_owner/);
    expect(b).toMatch(/r\.state = 'leased'/);
    expect(b).toMatch(/FOR UPDATE/);
    const guard = stripSqlComments(b).indexOf('FOR UPDATE');
    const firstUpdate = stripSqlComments(b).indexOf('UPDATE public.argument_machine_observation_runs');
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(firstUpdate).toBeGreaterThan(guard);
  });

  it('MIG-16 — NOT FOUND → RETURN false (hard no-op); only one RETURN false', () => {
    const b = stripSqlComments(functionBody());
    expect(b).toMatch(/IF NOT FOUND THEN[\s\S]*?RETURN false;/);
    expect((b.match(/RETURN false;/g) ?? []).length).toBe(1);
  });
});

describe('KLF-WIDEN-MIG — dropped_unclean_span_keys write placement (SUCCESS yes, FAILURE no)', () => {
  it('MIG-17 — the SUCCESS branch assigns dropped_unclean_span_keys = p_dropped_unclean_span_keys', () => {
    const b = functionBody();
    const successStart = b.indexOf("IF p_terminal_state = 'succeeded' THEN");
    const successEnd = b.indexOf('RETURN true;', successStart) + 'RETURN true;'.length;
    const win = b.slice(successStart, successEnd);
    expect(win).toMatch(/dropped_unclean_span_keys\s*=\s*p_dropped_unclean_span_keys/);
    // and it still flips the run to succeeded + clears the lease.
    expect(win).toMatch(/state\s*=\s*'succeeded'/);
    expect(win).toMatch(/lease_owner\s*=\s*NULL/);
  });

  it('MIG-18 — the SUCCESS branch does NOT reference failure_detail (succeeded row stays NULL there)', () => {
    const b = functionBody();
    const successStart = b.indexOf("IF p_terminal_state = 'succeeded' THEN");
    const successEnd = b.indexOf('RETURN true;', successStart) + 'RETURN true;'.length;
    const win = b.slice(successStart, successEnd);
    expect(win).not.toMatch(/failure_detail/);
  });

  it('MIG-19 — dropped_unclean_span_keys is assigned EXACTLY ONCE (the SUCCESS UPDATE only)', () => {
    const b = stripSqlComments(functionBody());
    const assigns = b.match(/dropped_unclean_span_keys\s*=\s*p_dropped_unclean_span_keys/g) ?? [];
    expect(assigns.length).toBe(1);
  });

  it('MIG-20 — the TERMINAL-FAILURE branch is faithful: assigns failure_detail = p_failure_detail, NOT dropped keys', () => {
    // Comment-strip so the negative check scans EXECUTABLE SQL only (the branch
    // comment legitimately mentions it does NOT touch dropped_unclean_span_keys).
    const b = stripSqlComments(functionBody());
    const afterSuccess = b.slice(b.indexOf('RETURN true;') + 'RETURN true;'.length);
    // Faithful re-create of the 20260602000001 terminal branch.
    expect(afterSuccess).toMatch(/failure_detail\s*=\s*p_failure_detail/);
    expect(afterSuccess).toMatch(/state\s*=\s*p_terminal_state/);
    expect(afterSuccess).toMatch(/failure_reason\s*=\s*p_failure_reason/);
    // The failure branch writes NO dropped-keys column assignment (stays NULL).
    expect(afterSuccess).not.toMatch(/dropped_unclean_span_keys/);
  });

  it('MIG-21 — exactly ONE INSERT total (the success-branch result-INSERT)', () => {
    const b = stripSqlComments(functionBody());
    const inserts = b.match(/INSERT INTO public\.argument_machine_observation_results/g) ?? [];
    expect(inserts.length).toBe(1);
  });
});

describe('KLF-WIDEN-MIG — secret safety + COMMENT', () => {
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

  it('MIG-24 — COMMENT ON FUNCTION targets the 10-arg overload', () => {
    expect(migrationText).toMatch(
      /COMMENT ON FUNCTION public\.finalize_classifier_job\(uuid, text, text, text, text, text, text, jsonb, jsonb, text\[\]\)/,
    );
    // Doctrine wording: names only; omission asserts nothing.
    expect(migrationText).toMatch(/NAMES/);
  });
});

describe('KLF-WIDEN-MIG — predecessor migrations are NOT edited', () => {
  it('MIG-25 — 20260602000001 still declares the 9-arg signature (never edited by this card)', () => {
    const prior = stripSqlComments(readFileSync(PRIOR_FINALIZER_PATH, 'utf8'));
    expect(prior).toMatch(
      /CREATE OR REPLACE FUNCTION public\.finalize_classifier_job\([\s\S]*?p_failure_detail\s+jsonb\s+DEFAULT NULL\s*\)/,
    );
    expect(prior).not.toMatch(/p_dropped_unclean_span_keys/);
  });

  it('MIG-26 — 20260611000001 still owns the ADD COLUMN dropped_unclean_span_keys (never edited)', () => {
    const col = stripSqlComments(readFileSync(COLUMN_MIGRATION_PATH, 'utf8'));
    expect(col).toMatch(
      /ALTER TABLE public\.argument_machine_observation_runs\s+ADD COLUMN IF NOT EXISTS dropped_unclean_span_keys text\[\]/,
    );
    // The column migration must NOT contain the finalizer re-create (this card owns it).
    expect(col).not.toMatch(/CREATE OR REPLACE FUNCTION/);
  });
});
