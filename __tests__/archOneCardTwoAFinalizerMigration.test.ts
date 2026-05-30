/**
 * ARCH-001 Card 2A — finalize_classifier_job migration shape + the
 * load-bearing atomicity / ownership-guard / ON CONFLICT contract.
 *
 * Pure-text scan of
 * supabase/migrations/20260528000022_arch_001_card2a_atomic_finalizer.sql.
 *
 * Docker was unavailable in the implementer environment, so the RUNTIME
 * behavior of the function (the live success / duplicate-safe / wrong-owner
 * / stale-owner / terminal-failure cases) is proven by the operator
 * post-merge script
 * scripts/arch-001-card2a-sql/verify-finalize-classifier-job.sql against the
 * applied DB. THESE tests lock the function's TEXT/SHAPE contract — and
 * especially (a) it is genuinely ATOMIC (one transaction, no COMMIT /
 * autonomous txn in the body), (b) the ownership guard runs FIRST before any
 * write, and (c) the duplicate-safe ON CONFLICT (run_id, raw_key) DO NOTHING
 * uses COLUMN INFERENCE not ON CONSTRAINT — so design §A.3's atomicity
 * correction cannot regress silently.
 *
 * Source of truth:
 *   docs/designs/ARCH-001-CARD2A-ATOMIC-FINALIZER-intent.md (function spec +
 *   semantics + 6 cases) + docs/designs/
 *   ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md §A.3.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260528000022_arch_001_card2a_atomic_finalizer.sql',
);

// The Card-1 substrate migration — used to assert this card does NOT touch
// the result-row column mapping that persistResults / this finalizer share.
const PERSISTENCE_WRITER_PATH = join(
  __dirname,
  '..',
  'supabase',
  'functions',
  '_shared',
  'booleanObservations',
  'persistenceWriter.ts',
);

let migrationText = '';

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

let executableOnly = '';

/** Extract the body of the CREATE OR REPLACE FUNCTION up to the closing `$$;`. */
function functionBody(name: string): string {
  const start = migrationText.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  if (start < 0) return '';
  const open = migrationText.indexOf('AS $$', start);
  const close = migrationText.indexOf('$$;', open);
  return migrationText.slice(start, close + 3);
}

beforeAll(() => {
  migrationText = readFileSync(MIGRATION_PATH, 'utf8');
  executableOnly = stripSqlComments(migrationText);
});

describe('ARCH-001 Card 2A — file exists + OPS-001 header + operator gate', () => {
  it('FIN-1 — migration file exists with non-empty content', () => {
    expect(migrationText.length).toBeGreaterThan(0);
  });

  it('FIN-2 — sorts AFTER the Card-1 substrate ordinal 20260528000021', () => {
    const thisOrdinal = '20260528000022';
    expect(thisOrdinal > '20260528000021').toBe(true);
  });

  it('FIN-3 — header records the OPERATOR GATE (written, not applied)', () => {
    expect(migrationText).toMatch(/WRITTEN, NOT APPLIED/);
    expect(migrationText).toContain('supabase db push --linked');
  });

  it('FIN-4 — header documents both relevant predecessor migrations', () => {
    expect(migrationText).toContain('20260526000018_mcp_021b_machine_observation_results.sql');
    expect(migrationText).toContain('20260528000021_arch_001_classifier_queue_substrate.sql');
  });

  it('FIN-5 — header names each of OPS-001 Class 1, 2, 3, 4', () => {
    expect(migrationText).toMatch(/Class 1 —/);
    expect(migrationText).toMatch(/Class 2 —/);
    expect(migrationText).toMatch(/Class 3 —/);
    expect(migrationText).toMatch(/Class 4 —/);
  });
});

describe('ARCH-001 Card 2A — scope: exactly ONE function, no schema change', () => {
  it('FIN-6 — defines exactly ONE CREATE OR REPLACE FUNCTION (finalize_classifier_job)', () => {
    const creates = executableOnly.match(/CREATE OR REPLACE FUNCTION public\.(\w+)/g) ?? [];
    expect(creates).toEqual(['CREATE OR REPLACE FUNCTION public.finalize_classifier_job']);
  });

  it('FIN-7 — NO new table / column / index / RLS / policy (migration-only-a-function)', () => {
    expect(executableOnly).not.toMatch(/CREATE TABLE/i);
    expect(executableOnly).not.toMatch(/ADD COLUMN/i);
    expect(executableOnly).not.toMatch(/ALTER COLUMN/i);
    expect(executableOnly).not.toMatch(/CREATE INDEX/i);
    expect(executableOnly).not.toMatch(/CREATE UNIQUE INDEX/i);
    expect(executableOnly).not.toMatch(/CREATE POLICY/i);
    expect(executableOnly).not.toMatch(/ENABLE ROW LEVEL SECURITY/i);
    expect(executableOnly).not.toMatch(/CREATE EXTENSION/i);
  });

  it('FIN-8 — does NOT cron.schedule / net.http_post anything', () => {
    expect(executableOnly).not.toMatch(/cron\.schedule/i);
    expect(executableOnly).not.toMatch(/net\.http_post|http_post|http_get/i);
  });

  it('FIN-9 — ZERO DROP TABLE / DROP COLUMN / TRUNCATE / DROP CONSTRAINT', () => {
    expect(executableOnly).not.toMatch(/DROP TABLE/i);
    expect(executableOnly).not.toMatch(/DROP COLUMN/i);
    expect(executableOnly).not.toMatch(/TRUNCATE/i);
    expect(executableOnly).not.toMatch(/DROP CONSTRAINT/i);
  });
});

describe('ARCH-001 Card 2A — signature + SECURITY INVOKER + LANGUAGE plpgsql', () => {
  it('FIN-10 — signature carries all 8 parameters with the right types', () => {
    // Scan comment-stripped text: each parameter line carries an inline
    // `-- …` comment that would otherwise break the contiguous match.
    expect(executableOnly).toMatch(
      /CREATE OR REPLACE FUNCTION public\.finalize_classifier_job\(\s*p_run_id\s+uuid,\s*p_owner\s+text,\s*p_terminal_state\s+text,\s*p_status\s+text,\s*p_failure_reason\s+text,\s*p_failure_sub_reason\s+text,\s*p_dead_letter_reason\s+text,\s*p_observations\s+jsonb\s*\)/,
    );
  });

  it('FIN-11 — RETURNS boolean (true=finalized, false=stale/wrong-owner no-op)', () => {
    const b = functionBody('finalize_classifier_job');
    expect(b).toMatch(/RETURNS boolean/);
  });

  it('FIN-12 — LANGUAGE plpgsql SECURITY INVOKER (matches Card-1 queue functions)', () => {
    const b = functionBody('finalize_classifier_job');
    expect(b).toMatch(/LANGUAGE plpgsql/);
    expect(b).toMatch(/SECURITY INVOKER/);
    // No SECURITY DEFINER escalation surface anywhere in executable SQL.
    expect(executableOnly).not.toMatch(/SECURITY DEFINER/);
  });
});

describe('ARCH-001 Card 2A — ATOMICITY (one transaction; no COMMIT/autonomous)', () => {
  it('FIN-13 — function body contains NO COMMIT / ROLLBACK / SAVEPOINT', () => {
    const b = stripSqlComments(functionBody('finalize_classifier_job'));
    expect(b).not.toMatch(/\bCOMMIT\b/i);
    expect(b).not.toMatch(/\bROLLBACK\b/i);
    expect(b).not.toMatch(/\bSAVEPOINT\b/i);
  });

  it('FIN-14 — no autonomous-transaction / dblink / pg_background self-call (would break atomicity)', () => {
    const b = stripSqlComments(functionBody('finalize_classifier_job'));
    expect(b).not.toMatch(/autonomous/i);
    expect(b).not.toMatch(/dblink/i);
    expect(b).not.toMatch(/pg_background/i);
  });

  it('FIN-15 — no nested BEGIN/EXCEPTION block that would split the txn (single plpgsql block body)', () => {
    // The body has exactly one top-level BEGIN … END $$. A nested
    // BEGIN…EXCEPTION sub-block would create a subtransaction (savepoint
    // semantics) which is NOT how this finalizer is specified — the whole
    // body must be one atomic unit. Assert there is no EXCEPTION handler.
    const b = stripSqlComments(functionBody('finalize_classifier_job'));
    expect(b).not.toMatch(/\bEXCEPTION\s+WHEN\b/i);
  });
});

describe('ARCH-001 Card 2A — ownership guard runs FIRST, before any write', () => {
  const body = (): string => functionBody('finalize_classifier_job');

  it('FIN-16 — locks the run row with lease_owner=p_owner AND state=leased FOR UPDATE', () => {
    const b = body();
    expect(b).toMatch(/FROM public\.argument_machine_observation_runs r/);
    expect(b).toMatch(/r\.id = p_run_id/);
    expect(b).toMatch(/r\.lease_owner = p_owner/);
    expect(b).toMatch(/r\.state = 'leased'/);
    expect(b).toMatch(/FOR UPDATE/);
  });

  it('FIN-17 — NOT FOUND → RETURN false (hard no-op: no results, no update)', () => {
    const b = body();
    expect(b).toMatch(/IF NOT FOUND THEN[\s\S]*?RETURN false;/);
  });

  it('FIN-18 — the ownership SELECT appears BEFORE the result INSERT and BEFORE both UPDATEs', () => {
    const b = stripSqlComments(body());
    const guardSelect = b.indexOf('FOR UPDATE');
    const firstInsert = b.indexOf('INSERT INTO public.argument_machine_observation_results');
    const firstUpdate = b.indexOf('UPDATE public.argument_machine_observation_runs');
    expect(guardSelect).toBeGreaterThanOrEqual(0);
    expect(firstInsert).toBeGreaterThan(guardSelect);
    expect(firstUpdate).toBeGreaterThan(guardSelect);
  });

  it('FIN-19 — debate_id / argument_id / schema_version are read FROM the locked run row (not passed by the drainer)', () => {
    const b = body();
    // The guard SELECT reads exactly these three identity columns into locals.
    expect(b).toMatch(
      /SELECT r\.debate_id, r\.argument_id, r\.schema_version\s+INTO v_debate_id, v_argument_id, v_schema_version/,
    );
  });
});

describe('ARCH-001 Card 2A — terminal-state validation', () => {
  const body = (): string => functionBody('finalize_classifier_job');

  it('FIN-20 — raises on an invalid p_terminal_state (only the 3 terminal states allowed)', () => {
    const b = body();
    expect(b).toMatch(
      /p_terminal_state NOT IN \('succeeded', 'failed_terminal', 'dead_letter'\)/,
    );
    expect(b).toMatch(/RAISE EXCEPTION/);
  });

  it('FIN-21 — retry_scheduled is NOT a handled finalize state (it is the drainer\'s job)', () => {
    const b = body();
    // retry_scheduled must NOT be written by this function in any branch.
    expect(b).not.toMatch(/'retry_scheduled'/);
  });
});

describe('ARCH-001 Card 2A — SUCCESS branch (result INSERT + terminal UPDATE)', () => {
  const body = (): string => functionBody('finalize_classifier_job');

  it('FIN-22 — success branch keyed on p_terminal_state = succeeded', () => {
    expect(body()).toMatch(/IF p_terminal_state = 'succeeded' THEN/);
  });

  it('FIN-23 — INSERTs into argument_machine_observation_results with the persistResults column set', () => {
    const b = body();
    expect(b).toMatch(/INSERT INTO public\.argument_machine_observation_results/);
    // The exact column list, in the exact order persistResults uses.
    expect(b).toMatch(
      /\(run_id, debate_id, argument_id, schema_version, raw_key, family,\s*confidence, evidence_span\)/,
    );
  });

  it('FIN-24 — sources rows from jsonb_to_recordset(p_observations) with COALESCE to empty array', () => {
    const b = body();
    expect(b).toMatch(/jsonb_to_recordset\(COALESCE\(p_observations, '\[\]'::jsonb\)\)/);
    // The recordset column types: raw_key/family/confidence/evidence_span all text.
    expect(b).toMatch(
      /AS obs\(raw_key text, family text, confidence text, evidence_span text\)/,
    );
  });

  it('FIN-25 — debate_id/argument_id/schema_version in the SELECT come from the run-row locals, raw_key/family/confidence/evidence_span from the obs rowset', () => {
    const b = body();
    expect(b).toMatch(/p_run_id,\s*v_debate_id,\s*v_argument_id,\s*v_schema_version,\s*obs\.raw_key,\s*obs\.family,\s*obs\.confidence,\s*obs\.evidence_span/);
  });

  it('FIN-26 — uses ON CONFLICT (run_id, raw_key) DO NOTHING via COLUMN INFERENCE, NOT ON CONSTRAINT', () => {
    const b = body();
    expect(b).toMatch(/ON CONFLICT \(run_id, raw_key\) DO NOTHING/);
    // ON CONSTRAINT is explicitly NOT used in EXECUTABLE SQL (the intent
    // brief requires column inference against the named non-partial
    // constraint). The body comment legitimately MENTIONS "not
    // ON CONFLICT ON CONSTRAINT", so scan the comment-stripped body.
    expect(stripSqlComments(b)).not.toMatch(/ON CONFLICT ON CONSTRAINT/);
  });

  it('FIN-27 — success UPDATE sets state=succeeded, status=p_status, completed_at=now(), clears lease', () => {
    const b = body();
    // Window from the success-branch INSERT to its UPDATE … RETURN true.
    const successStart = b.indexOf("IF p_terminal_state = 'succeeded' THEN");
    const successEnd = b.indexOf('RETURN true;', successStart) + 'RETURN true;'.length;
    const win = b.slice(successStart, successEnd);
    expect(win).toMatch(/SET state\s*=\s*'succeeded'/);
    expect(win).toMatch(/status\s*=\s*p_status/);
    expect(win).toMatch(/completed_at\s*=\s*now\(\)/);
    expect(win).toMatch(/lease_owner\s*=\s*NULL/);
    expect(win).toMatch(/lease_expires_at\s*=\s*NULL/);
    expect(win).toMatch(/WHERE id = p_run_id/);
  });

  it('FIN-28 — success branch does NOT write failure_reason / failure_sub_reason / dead_letter_reason', () => {
    const b = body();
    const successStart = b.indexOf("IF p_terminal_state = 'succeeded' THEN");
    const successEnd = b.indexOf('RETURN true;', successStart) + 'RETURN true;'.length;
    const win = b.slice(successStart, successEnd);
    expect(win).not.toMatch(/failure_reason/);
    expect(win).not.toMatch(/failure_sub_reason/);
    expect(win).not.toMatch(/dead_letter_reason/);
  });
});

describe('ARCH-001 Card 2A — TERMINAL FAILURE branch (no results; failure fields)', () => {
  const body = (): string => functionBody('finalize_classifier_job');

  it('FIN-29 — terminal-failure UPDATE sets state=p_terminal_state, status=p_status, completed_at, clears lease', () => {
    const b = body();
    // The terminal-failure UPDATE is the SECOND UPDATE (after the success
    // branch already returned). Take the slice after the success RETURN true.
    const afterSuccess = b.slice(b.indexOf('RETURN true;') + 'RETURN true;'.length);
    expect(afterSuccess).toMatch(/SET state\s*=\s*p_terminal_state/);
    expect(afterSuccess).toMatch(/status\s*=\s*p_status/);
    expect(afterSuccess).toMatch(/completed_at\s*=\s*now\(\)/);
    expect(afterSuccess).toMatch(/failure_reason\s*=\s*p_failure_reason/);
    expect(afterSuccess).toMatch(/failure_sub_reason\s*=\s*p_failure_sub_reason/);
    expect(afterSuccess).toMatch(/lease_owner\s*=\s*NULL/);
    expect(afterSuccess).toMatch(/lease_expires_at\s*=\s*NULL/);
  });

  it('FIN-30 — dead_letter_reason is set ONLY when p_terminal_state = dead_letter (CASE-gated)', () => {
    const b = body();
    const afterSuccess = b.slice(b.indexOf('RETURN true;') + 'RETURN true;'.length);
    expect(afterSuccess).toMatch(
      /dead_letter_reason\s*=\s*CASE\s*WHEN p_terminal_state = 'dead_letter'\s*THEN p_dead_letter_reason\s*ELSE dead_letter_reason\s*END/,
    );
  });

  it('FIN-31 — terminal-failure branch writes NO result rows (only one INSERT in the whole body, in the success branch)', () => {
    const b = stripSqlComments(body());
    const inserts = b.match(/INSERT INTO public\.argument_machine_observation_results/g) ?? [];
    expect(inserts.length).toBe(1);
  });

  it('FIN-32 — both terminal branches end in RETURN true (the function only returns false on the ownership no-op)', () => {
    const b = stripSqlComments(body());
    const returnsTrue = b.match(/RETURN true;/g) ?? [];
    const returnsFalse = b.match(/RETURN false;/g) ?? [];
    expect(returnsTrue.length).toBe(2); // success + terminal failure
    expect(returnsFalse.length).toBe(1); // ownership no-op only
  });
});

describe('ARCH-001 Card 2A — result mapping mirrors persistResults exactly', () => {
  it('FIN-33 — the finalizer result-column list is byte-identical to persistResults insertPayload keys', () => {
    const writer = readFileSync(PERSISTENCE_WRITER_PATH, 'utf8');
    // persistResults maps each row to these snake_case keys, in this order.
    const writerKeys = [
      'run_id',
      'debate_id',
      'argument_id',
      'schema_version',
      'raw_key',
      'family',
      'confidence',
      'evidence_span',
    ];
    // Assert persistResults still uses exactly these keys (guards against the
    // writer drifting out from under the finalizer's mirror).
    for (const k of writerKeys) {
      expect(writer).toMatch(new RegExp(`${k}:\\s`));
    }
    // Assert the finalizer INSERT column list is the same set in the same order.
    const b = functionBody('finalize_classifier_job');
    const colMatch = b.match(
      /INSERT INTO public\.argument_machine_observation_results\s*\(([^)]*)\)/,
    );
    expect(colMatch).not.toBeNull();
    const cols = colMatch![1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    expect(cols).toEqual(writerKeys);
  });

  it('FIN-34 — evidence_span is preserved as-is (nullable), same null-handling as persistResults', () => {
    // persistResults passes r.evidenceSpan straight through (no COALESCE to
    // ''); the finalizer must likewise pass obs.evidence_span straight through
    // with no defaulting, so a NULL evidence_span stays NULL.
    const b = functionBody('finalize_classifier_job');
    expect(b).toMatch(/obs\.evidence_span/);
    expect(b).not.toMatch(/COALESCE\(obs\.evidence_span/);
  });
});

describe('ARCH-001 Card 2A — secret safety (cdiscourse-doctrine §6)', () => {
  it('FIN-35 — no SERVICE_ROLE / secret-shaped literal in executable SQL', () => {
    expect(executableOnly).not.toMatch(/SERVICE_ROLE/i);
    expect(executableOnly).not.toMatch(/ANTHROPIC_API_KEY/i);
    expect(executableOnly).not.toMatch(/sk-ant-/);
    expect(executableOnly).not.toMatch(/sb_secret/);
    expect(executableOnly).not.toMatch(/xai-/);
    expect(executableOnly).not.toMatch(/Bearer /);
    expect(executableOnly).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  });

  it('FIN-36 — no COMMENT ON ... storage.* (PR-003 SQLSTATE 42501 boundary)', () => {
    expect(migrationText).not.toMatch(/COMMENT ON\s+\w+\s+storage\./i);
  });

  it('FIN-37 — ships exactly one COMMENT ON FUNCTION documenting the finalizer', () => {
    expect(migrationText).toMatch(
      /COMMENT ON FUNCTION public\.finalize_classifier_job\(uuid, text, text, text, text, text, text, jsonb\)/,
    );
    expect(migrationText).toMatch(/ATOMIC finalize of one claimed classifier job/);
  });
});

describe('ARCH-001 Card 2A — out-of-scope guards (no Card-2 / persistence leakage)', () => {
  it('FIN-38 — does NOT reference the lock/audit tables (finalize touches only runs + results)', () => {
    expect(executableOnly).not.toMatch(/classifier_drain_lock/);
    expect(executableOnly).not.toMatch(/classifier_drain_audit/);
  });

  it('FIN-39 — references ONLY the two MCP-021B tables it finalizes', () => {
    const tables = new Set(
      (executableOnly.match(/public\.(argument_machine_observation_\w+)/g) ?? []).map((s) =>
        s.replace('public.', ''),
      ),
    );
    expect([...tables].sort()).toEqual([
      'argument_machine_observation_results',
      'argument_machine_observation_runs',
    ]);
  });

  it('FIN-40 — no feature-flag / routing DDL leaked in', () => {
    expect(executableOnly).not.toMatch(/feature_flag|ENABLE_CLASSIFIER_QUEUE|autoTrigger/i);
  });
});
