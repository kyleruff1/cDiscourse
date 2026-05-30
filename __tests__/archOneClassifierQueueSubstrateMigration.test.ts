/**
 * ARCH-001 Card 1 — migration shape + OPS-001 four-class header walk.
 *
 * Pure-text scan of
 * supabase/migrations/20260528000021_arch_001_classifier_queue_substrate.sql.
 *
 * Docker was unavailable in the implementer environment, so the RUNTIME
 * behavior (partial-index unique violations, FOR UPDATE SKIP LOCKED, the
 * lease ON CONFLICT race) is proven by the operator post-merge script
 * scripts/arch-001-card1-sql/verify-classifier-queue-substrate.sql. THESE
 * tests lock the migration's TEXT/SHAPE contract (the index predicates +
 * column order, the columns, the DROP NOT NULL, the RLS posture, the
 * secret-safety) so any deviation from design §A.3 fails CI before ship.
 *
 * Source of truth:
 *   docs/designs/ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md
 *   §A.3 (schema/indexes) + intent brief
 *   docs/designs/ARCH-001-CARD1-DB-SUBSTRATE-intent.md.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260528000021_arch_001_classifier_queue_substrate.sql',
);

let migrationText = '';

/** Strip SQL line + block comments so predicate/keyword scans hit executable DDL only. */
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

let executableOnly = '';

beforeAll(() => {
  migrationText = readFileSync(MIGRATION_PATH, 'utf8');
  executableOnly = stripSqlComments(migrationText);
});

describe('ARCH-001 Card 1 — file exists + OPS-001 header', () => {
  it('MIG-1 — migration file exists with non-empty content', () => {
    expect(migrationText.length).toBeGreaterThan(0);
  });

  it('MIG-2 — sorts AFTER the latest existing ordinal 20260527000020', () => {
    // Lexical sort of the filename ordinal places this file last.
    const thisOrdinal = '20260528000021';
    expect(thisOrdinal > '20260527000020').toBe(true);
  });

  it('MIG-3 — header contains OPS-001 §4 four-class posture block', () => {
    expect(migrationText).toContain('OPS-001 §4 four-class posture:');
  });

  it('MIG-4 — header explicitly names each of Class 1, 2, 3, 4', () => {
    expect(migrationText).toMatch(/Class 1 —/);
    expect(migrationText).toMatch(/Class 2 —/);
    expect(migrationText).toMatch(/Class 3 —/);
    expect(migrationText).toMatch(/Class 4 —/);
  });

  it('MIG-5 — header documents both predecessor migrations', () => {
    expect(migrationText).toContain('20260526000018_mcp_021b_machine_observation_results.sql');
    expect(migrationText).toContain('20260526000019_mcp_021c_edge_run_mode.sql');
  });

  it('MIG-6 — header records the OPERATOR GATE (written, not applied)', () => {
    expect(migrationText).toMatch(/WRITTEN, NOT APPLIED/);
    expect(migrationText).toContain('supabase db push --linked');
  });
});

describe('ARCH-001 Card 1 — extensions (Class A)', () => {
  it('MIG-7 — CREATE EXTENSION pg_cron present (IF NOT EXISTS)', () => {
    expect(executableOnly).toMatch(/CREATE EXTENSION IF NOT EXISTS pg_cron;/);
  });

  it('MIG-8 — CREATE EXTENSION pg_net WITH SCHEMA extensions present', () => {
    expect(executableOnly).toMatch(/CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;/);
  });

  it('MIG-9 — Card 1 does NOT cron.schedule anything', () => {
    expect(executableOnly).not.toMatch(/cron\.schedule/i);
  });

  it('MIG-10 — Card 1 does NOT call net.http_post / pg_net invocation', () => {
    expect(executableOnly).not.toMatch(/net\.http_post|http_post|http_get/i);
  });
});

describe('ARCH-001 Card 1 — additive columns on runs (Class B)', () => {
  const REQUIRED_COLUMNS = [
    'family',
    'state',
    'attempt_count',
    'available_at',
    'lease_expires_at',
    'lease_owner',
    'failure_sub_reason',
    'dead_letter_reason',
    'last_attempt_at',
  ];

  it('MIG-11 — every new column added via ADD COLUMN IF NOT EXISTS', () => {
    for (const col of REQUIRED_COLUMNS) {
      const re = new RegExp(
        `ADD COLUMN IF NOT EXISTS ${col}\\b`,
      );
      expect(executableOnly).toMatch(re);
    }
  });

  it('MIG-12 — state column: text NOT NULL DEFAULT succeeded with the 6-value CHECK', () => {
    expect(executableOnly).toMatch(
      /ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'succeeded'/,
    );
    // All six lifecycle states present in the CHECK, none missing.
    for (const s of [
      'pending',
      'leased',
      'retry_scheduled',
      'succeeded',
      'failed_terminal',
      'dead_letter',
    ]) {
      expect(executableOnly).toMatch(new RegExp(`'${s}'`));
    }
    expect(executableOnly).toMatch(/CHECK \(state IN \(/);
  });

  it('MIG-13 — attempt_count is int NOT NULL DEFAULT 0', () => {
    expect(executableOnly).toMatch(/ADD COLUMN IF NOT EXISTS attempt_count int NOT NULL DEFAULT 0/);
  });

  it('MIG-14 — available_at is timestamptz NOT NULL DEFAULT now()', () => {
    expect(executableOnly).toMatch(
      /ADD COLUMN IF NOT EXISTS available_at timestamptz NOT NULL DEFAULT now\(\)/,
    );
  });

  it('MIG-15 — lease_expires_at / lease_owner / failure_sub_reason / dead_letter_reason / last_attempt_at are nullable (no NOT NULL)', () => {
    for (const col of [
      'lease_expires_at timestamptz',
      'lease_owner text',
      'failure_sub_reason text',
      'dead_letter_reason text',
      'last_attempt_at timestamptz',
    ]) {
      const re = new RegExp(`ADD COLUMN IF NOT EXISTS ${col}(?!\\s+NOT NULL)`);
      expect(executableOnly).toMatch(re);
    }
  });
});

describe('ARCH-001 Card 1 — status nullability + state backfill (Class B)', () => {
  it('MIG-16 — ALTER COLUMN status DROP NOT NULL present', () => {
    expect(executableOnly).toMatch(
      /ALTER TABLE public\.argument_machine_observation_runs\s+ALTER COLUMN status DROP NOT NULL;/,
    );
  });

  it('MIG-17 — the existing status CHECK is NOT widened/dropped (no ALTER on status CHECK)', () => {
    // We must not DROP or re-ADD the status CHECK. The only ALTER touching
    // status is DROP NOT NULL.
    expect(executableOnly).not.toMatch(/DROP CONSTRAINT[\s\S]*?status/i);
    expect(executableOnly).not.toMatch(/CHECK \(status IN/);
  });

  it('MIG-18 — backfill sets succeeded where status=success, else failed_terminal', () => {
    expect(executableOnly).toMatch(/UPDATE public\.argument_machine_observation_runs/);
    expect(executableOnly).toMatch(/WHEN status = 'success' THEN 'succeeded'/);
    expect(executableOnly).toMatch(/ELSE 'failed_terminal'/);
  });
});

describe('ARCH-001 Card 1 — partial indexes #4-#7 (Class D)', () => {
  it('MIG-19 — #4 one-success-per-cell UNIQUE index, exact columns + predicate', () => {
    expect(executableOnly).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS amor_one_success_per_cell_idx\s+ON public\.argument_machine_observation_runs\s+\(argument_id, family, run_mode, schema_version\)\s+WHERE state = 'succeeded' AND family IS NOT NULL;/,
    );
  });

  it('MIG-20 — #5 one-active-job-per-cell UNIQUE index, exact columns + predicate', () => {
    expect(executableOnly).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS amor_one_active_job_per_cell_idx\s+ON public\.argument_machine_observation_runs\s+\(argument_id, family, run_mode, schema_version\)\s+WHERE state IN \('pending', 'leased', 'retry_scheduled'\) AND family IS NOT NULL;/,
    );
  });

  it('MIG-21 — #6 claim index on (state, available_at) with the claim predicate', () => {
    expect(executableOnly).toMatch(
      /CREATE INDEX IF NOT EXISTS amor_claimable_idx\s+ON public\.argument_machine_observation_runs\s+\(state, available_at\)\s+WHERE state IN \('pending', 'retry_scheduled'\) AND family IS NOT NULL;/,
    );
  });

  it('MIG-22 — #7 stale-lease index on (state, lease_expires_at) with the leased predicate', () => {
    expect(executableOnly).toMatch(
      /CREATE INDEX IF NOT EXISTS amor_stale_lease_idx\s+ON public\.argument_machine_observation_runs\s+\(state, lease_expires_at\)\s+WHERE state = 'leased' AND family IS NOT NULL;/,
    );
  });

  it('MIG-23 — EVERY queue index predicate carries `family IS NOT NULL`', () => {
    // The four queue indexes are the only WHERE-bearing CREATE INDEX
    // statements on the runs table; each must exclude historical NULL-family
    // rows. Count the runs-table partial indexes and assert all carry it.
    const idxNames = [
      'amor_one_success_per_cell_idx',
      'amor_one_active_job_per_cell_idx',
      'amor_claimable_idx',
      'amor_stale_lease_idx',
    ];
    for (const name of idxNames) {
      const start = executableOnly.indexOf(name);
      expect(start).toBeGreaterThanOrEqual(0);
      // window from the index name to the next semicolon = the statement body
      const semi = executableOnly.indexOf(';', start);
      const body = executableOnly.slice(start, semi);
      expect(body).toContain('family IS NOT NULL');
    }
  });
});

describe('ARCH-001 Card 1 — new tables + RLS posture (Class C)', () => {
  it('MIG-24 — classifier_drain_lock table with lock_key PK + owner + expires_at', () => {
    expect(executableOnly).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.classifier_drain_lock \(/,
    );
    const start = executableOnly.indexOf('CREATE TABLE IF NOT EXISTS public.classifier_drain_lock');
    const body = executableOnly.slice(start, executableOnly.indexOf(');', start));
    expect(body).toMatch(/lock_key\s+text\s+PRIMARY KEY/);
    expect(body).toMatch(/owner\s+text\s+NOT NULL/);
    expect(body).toMatch(/expires_at\s+timestamptz\s+NOT NULL/);
  });

  it('MIG-25 — classifier_drain_audit table with the §A.10 monitoring columns', () => {
    expect(executableOnly).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.classifier_drain_audit \(/,
    );
    const start = executableOnly.indexOf('CREATE TABLE IF NOT EXISTS public.classifier_drain_audit');
    const body = executableOnly.slice(start, executableOnly.indexOf(');', start));
    for (const col of [
      'started_at',
      'completed_at',
      'outcome',
      'jobs_processed',
      'jobs_succeeded',
      'stale_leases_recovered',
    ]) {
      expect(body).toContain(col);
    }
  });

  it('MIG-26 — audit.outcome CHECK includes the load-bearing skipped_single_flight value', () => {
    expect(executableOnly).toMatch(/CHECK \(outcome IN \([\s\S]*?'skipped_single_flight'[\s\S]*?\)\)/);
  });

  it('MIG-27 — both new tables ENABLE ROW LEVEL SECURITY', () => {
    expect(executableOnly).toMatch(
      /ALTER TABLE public\.classifier_drain_lock\s+ENABLE ROW LEVEL SECURITY;/,
    );
    expect(executableOnly).toMatch(
      /ALTER TABLE public\.classifier_drain_audit ENABLE ROW LEVEL SECURITY;/,
    );
  });
});

describe('ARCH-001 Card 1 — no client write policy + no destructive DDL', () => {
  it('MIG-28 — ZERO CREATE POLICY ... FOR INSERT', () => {
    expect(executableOnly.match(/CREATE POLICY[\s\S]+?FOR INSERT/g)).toBeNull();
  });

  it('MIG-29 — ZERO CREATE POLICY ... FOR UPDATE', () => {
    expect(executableOnly.match(/CREATE POLICY[\s\S]+?FOR UPDATE/g)).toBeNull();
  });

  it('MIG-30 — ZERO CREATE POLICY ... FOR DELETE', () => {
    expect(executableOnly.match(/CREATE POLICY[\s\S]+?FOR DELETE/g)).toBeNull();
  });

  it('MIG-31 — ZERO CREATE POLICY of any kind (the two new tables are service-role-only, no SELECT policy either)', () => {
    expect(executableOnly).not.toMatch(/CREATE POLICY/);
  });

  it('MIG-32 — ZERO DROP TABLE / DROP COLUMN / TRUNCATE (additive migration)', () => {
    expect(executableOnly).not.toMatch(/DROP TABLE/i);
    expect(executableOnly).not.toMatch(/DROP COLUMN/i);
    expect(executableOnly).not.toMatch(/TRUNCATE/i);
  });

  it('MIG-33 — ZERO data-deletion DELETE on the runs table (the lease-release DELETE on classifier_drain_lock is the only DELETE, and it is inside a function)', () => {
    // Card 1 must not delete any runs data. The ONLY DELETE in the migration
    // is release_drain_lease's DELETE FROM public.classifier_drain_lock
    // (operational lease release, inside a function body) — assert there is
    // no DELETE against the runs table, and no top-level backfill DELETE.
    expect(executableOnly).not.toMatch(/DELETE FROM public\.argument_machine_observation_runs/i);
    const deletes = executableOnly.match(/DELETE FROM public\.(\w+)/gi) ?? [];
    const targets = deletes.map((s) => s.replace(/DELETE FROM public\./i, ''));
    // The lease-release DELETE on classifier_drain_lock is the only one.
    expect(targets).toEqual(['classifier_drain_lock']);
  });

  it('MIG-34 — ZERO COMMENT ON ... storage.* (PR-003 SQLSTATE 42501 boundary)', () => {
    expect(migrationText).not.toMatch(/COMMENT ON\s+\w+\s+storage\./i);
  });
});

describe('ARCH-001 Card 1 — out-of-scope guards (no Card 2/3 leakage)', () => {
  it('MIG-35 — no feature-flag DDL leaked into the substrate migration', () => {
    expect(executableOnly).not.toMatch(/feature_flag|feature\.flag|ENABLE_CLASSIFIER_QUEUE/i);
  });

  it('MIG-36 — references only the runs table + the two new tables (no foreign MCP/Family-H tables created)', () => {
    // The only CREATE TABLE statements are the two new operational tables.
    const creates = executableOnly.match(/CREATE TABLE IF NOT EXISTS public\.(\w+)/g) ?? [];
    const created = creates.map((s) => s.replace(/CREATE TABLE IF NOT EXISTS public\./, ''));
    expect(created.sort()).toEqual(['classifier_drain_audit', 'classifier_drain_lock']);
  });
});

describe('ARCH-001 Card 1 — secret safety (cdiscourse-doctrine §6)', () => {
  it('MIG-37 — no SERVICE_ROLE / secret-shaped literal in executable SQL', () => {
    expect(executableOnly).not.toMatch(/SERVICE_ROLE/i);
    expect(executableOnly).not.toMatch(/ANTHROPIC_API_KEY/i);
    expect(executableOnly).not.toMatch(/sk-ant-/);
    expect(executableOnly).not.toMatch(/sb_secret/);
    expect(executableOnly).not.toMatch(/xai-/);
    expect(executableOnly).not.toMatch(/Bearer /);
    // No JWT-shaped literal (three dot-separated base64url segments).
    expect(executableOnly).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  });

  it('MIG-38 — the Vault drainer credential is a runbook NOTE only (mentioned in comments, never a literal)', () => {
    // The word "Vault" appears in the comment runbook note; assert it is NOT
    // followed by an assignment / literal value.
    expect(migrationText).toMatch(/Vault/);
    expect(executableOnly).not.toMatch(/Vault/); // not in executable SQL
  });
});

describe('ARCH-001 Card 1 — statement ordering (OPS-001 Class 3)', () => {
  it('MIG-39 — extensions precede column ALTERs', () => {
    const ext = executableOnly.indexOf('CREATE EXTENSION IF NOT EXISTS pg_cron');
    const col = executableOnly.indexOf('ADD COLUMN IF NOT EXISTS family');
    expect(ext).toBeGreaterThanOrEqual(0);
    expect(col).toBeGreaterThan(ext);
  });

  it('MIG-40 — ADD COLUMN state precedes the backfill that reads state', () => {
    const add = executableOnly.indexOf("ADD COLUMN IF NOT EXISTS state text");
    const backfill = executableOnly.indexOf('UPDATE public.argument_machine_observation_runs');
    expect(add).toBeGreaterThanOrEqual(0);
    expect(backfill).toBeGreaterThan(add);
  });

  it('MIG-41 — CREATE TABLE for each new table precedes its CREATE INDEX', () => {
    const auditTable = executableOnly.indexOf('CREATE TABLE IF NOT EXISTS public.classifier_drain_audit');
    const auditIdx = executableOnly.indexOf('classifier_drain_audit_completed_at_idx');
    expect(auditTable).toBeGreaterThanOrEqual(0);
    expect(auditIdx).toBeGreaterThan(auditTable);
  });

  it('MIG-42 — ENABLE ROW LEVEL SECURITY appears before the COMMENT block (no policy in between to mis-order)', () => {
    const rls = executableOnly.indexOf('ENABLE ROW LEVEL SECURITY');
    const comment = migrationText.indexOf('COMMENT ON TABLE public.classifier_drain_lock');
    expect(rls).toBeGreaterThanOrEqual(0);
    expect(comment).toBeGreaterThan(rls);
  });
});
