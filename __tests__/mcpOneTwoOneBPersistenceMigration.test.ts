/**
 * MCP-021B — Test §8.1: migration shape + OPS-001 header walk.
 *
 * Pure-text scan of
 * supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql.
 *
 * The reviewer's mechanical checks live here so that any deviation from
 * the migration design (§3) fails CI before it ships.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260526000018_mcp_021b_machine_observation_results.sql',
);

let migrationText = '';

beforeAll(() => {
  migrationText = readFileSync(MIGRATION_PATH, 'utf8');
});

describe('MCP-021B — migration file exists and has OPS-001 header walk', () => {
  it('MIG-1 — migration file exists', () => {
    expect(migrationText.length).toBeGreaterThan(0);
  });

  it('MIG-2 — header contains OPS-001 §4 four-class posture block', () => {
    expect(migrationText).toContain('OPS-001 §4 four-class posture:');
  });

  it('MIG-3 — header explicitly names each of Class 1, 2, 3, 4', () => {
    expect(migrationText).toMatch(/Class 1 —/);
    expect(migrationText).toMatch(/Class 2 —/);
    expect(migrationText).toMatch(/Class 3 —/);
    expect(migrationText).toMatch(/Class 4 —/);
  });
});

describe('MCP-021B — runs table shape', () => {
  it('MIG-4 — CREATE TABLE public.argument_machine_observation_runs present', () => {
    expect(migrationText).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.argument_machine_observation_runs/,
    );
  });

  it('MIG-5 — runs table has every required column', () => {
    const requiredColumns = [
      'id',
      'debate_id',
      'argument_id',
      'schema_version',
      'requested_families',
      'provider_key',
      'model_name',
      'input_hash',
      'status',
      'failure_reason',
      'started_at',
      'completed_at',
      'created_at',
    ];
    for (const col of requiredColumns) {
      expect(migrationText).toContain(col);
    }
  });

  it('MIG-6 — runs.status has CHECK constraint with success/failed/fallback', () => {
    expect(migrationText).toMatch(/status\s+text\s+NOT NULL\s+CHECK \(status IN \('success', 'failed', 'fallback'\)\)/);
  });

  it('MIG-7 — runs.debate_id has FK to public.debates(id) ON DELETE CASCADE', () => {
    expect(migrationText).toMatch(/debate_id\s+uuid\s+NOT NULL\s+REFERENCES public\.debates\(id\)\s+ON DELETE CASCADE/);
  });

  it('MIG-8 — runs.argument_id has FK to public.arguments(id) ON DELETE CASCADE', () => {
    expect(migrationText).toMatch(/argument_id\s+uuid\s+NOT NULL\s+REFERENCES public\.arguments\(id\)\s+ON DELETE CASCADE/);
  });
});

describe('MCP-021B — results table shape', () => {
  it('MIG-9 — CREATE TABLE public.argument_machine_observation_results present', () => {
    expect(migrationText).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.argument_machine_observation_results/,
    );
  });

  it('MIG-10 — results table has every required column', () => {
    const requiredColumns = [
      'id',
      'run_id',
      'debate_id',
      'argument_id',
      'schema_version',
      'raw_key',
      'family',
      'confidence',
      'evidence_span',
      'created_at',
    ];
    for (const col of requiredColumns) {
      expect(migrationText).toContain(col);
    }
  });

  it('MIG-11 — results.confidence has CHECK constraint with low/medium/high', () => {
    expect(migrationText).toMatch(/CHECK \(confidence IN \('low', 'medium', 'high'\)\)/);
  });

  it('MIG-12 — results.run_id has FK to runs(id) ON DELETE CASCADE', () => {
    expect(migrationText).toMatch(
      /run_id\s+uuid\s+NOT NULL\s+REFERENCES public\.argument_machine_observation_runs\(id\)\s+ON DELETE CASCADE/,
    );
  });

  it('MIG-13 — results has FK to debates and arguments ON DELETE CASCADE', () => {
    // The results table references both debates and arguments; both must
    // cascade. The runs table also has both cascades; the regex below
    // captures the results-table FK count by file content; both are present.
    const debateRefMatches = migrationText.match(/REFERENCES public\.debates\(id\)\s+ON DELETE CASCADE/g);
    expect(debateRefMatches).not.toBeNull();
    expect(debateRefMatches!.length).toBeGreaterThanOrEqual(2);
    const argRefMatches = migrationText.match(/REFERENCES public\.arguments\(id\)\s+ON DELETE CASCADE/g);
    expect(argRefMatches).not.toBeNull();
    expect(argRefMatches!.length).toBeGreaterThanOrEqual(2);
  });

  it('MIG-14 — results has UNIQUE (run_id, raw_key) constraint', () => {
    expect(migrationText).toMatch(/CONSTRAINT amor_unique_run_rawkey UNIQUE \(run_id, raw_key\)/);
  });
});

describe('MCP-021B — indexes', () => {
  it('MIG-15 — three CREATE INDEX statements present', () => {
    expect(migrationText).toContain('amor_runs_argument_version_completed_idx');
    expect(migrationText).toContain('amor_results_argument_version_rawkey_idx');
    expect(migrationText).toContain('amor_results_run_idx');
  });
});

describe('MCP-021B — RLS enabled and policy posture', () => {
  it('MIG-16 — ALTER TABLE … ENABLE ROW LEVEL SECURITY for both tables', () => {
    expect(migrationText).toMatch(
      /ALTER TABLE public\.argument_machine_observation_runs ENABLE ROW LEVEL SECURITY/,
    );
    expect(migrationText).toMatch(
      /ALTER TABLE public\.argument_machine_observation_results ENABLE ROW LEVEL SECURITY/,
    );
  });

  it('MIG-17 — ZERO CREATE POLICY ... FOR INSERT statements', () => {
    const matches = migrationText.match(/CREATE POLICY[\s\S]+?FOR INSERT/g);
    expect(matches).toBeNull();
  });

  it('MIG-18 — ZERO CREATE POLICY ... FOR UPDATE statements', () => {
    const matches = migrationText.match(/CREATE POLICY[\s\S]+?FOR UPDATE/g);
    expect(matches).toBeNull();
  });

  it('MIG-19 — ZERO CREATE POLICY ... FOR DELETE statements', () => {
    const matches = migrationText.match(/CREATE POLICY[\s\S]+?FOR DELETE/g);
    expect(matches).toBeNull();
  });

  it('MIG-20 — ZERO COMMENT ON ... storage.* statements (PR-003 boundary)', () => {
    expect(migrationText).not.toMatch(/COMMENT ON\s+\w+\s+storage\./i);
  });
});

describe('MCP-021B — statement ordering', () => {
  it('MIG-21 — CREATE INDEX statements appear AFTER their CREATE TABLE', () => {
    const runsCreateIdx = migrationText.indexOf('CREATE TABLE IF NOT EXISTS public.argument_machine_observation_runs');
    const resultsCreateIdx = migrationText.indexOf('CREATE TABLE IF NOT EXISTS public.argument_machine_observation_results');
    // The OPS-001 header comment mentions `CREATE INDEX` in narrative form;
    // anchor on the actual statement using the IF NOT EXISTS pattern that
    // only appears in the executable DDL, not in the comment.
    const firstIdxIdx = migrationText.indexOf('CREATE INDEX IF NOT EXISTS');
    expect(runsCreateIdx).toBeGreaterThanOrEqual(0);
    expect(resultsCreateIdx).toBeGreaterThanOrEqual(0);
    expect(firstIdxIdx).toBeGreaterThan(resultsCreateIdx);
    // runs CREATE TABLE precedes results CREATE TABLE (FK ordering).
    expect(runsCreateIdx).toBeLessThan(resultsCreateIdx);
  });

  it('MIG-22 — ENABLE ROW LEVEL SECURITY appears BEFORE every CREATE POLICY on the same table', () => {
    const runsRlsIdx = migrationText.indexOf(
      'ALTER TABLE public.argument_machine_observation_runs ENABLE ROW LEVEL SECURITY',
    );
    const resultsRlsIdx = migrationText.indexOf(
      'ALTER TABLE public.argument_machine_observation_results ENABLE ROW LEVEL SECURITY',
    );
    const runsPolicyIdx = migrationText.indexOf('CREATE POLICY amor_runs_select_via_argument');
    const resultsPolicyIdx = migrationText.indexOf('CREATE POLICY amor_results_select_via_run');
    expect(runsRlsIdx).toBeGreaterThanOrEqual(0);
    expect(resultsRlsIdx).toBeGreaterThanOrEqual(0);
    expect(runsPolicyIdx).toBeGreaterThan(runsRlsIdx);
    expect(resultsPolicyIdx).toBeGreaterThan(resultsRlsIdx);
  });
});
