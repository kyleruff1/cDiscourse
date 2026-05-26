/**
 * MCP-021C-EDGE — Test: migration shape + OPS-001 four-class header walk.
 *
 * Pure-text scan of
 * supabase/migrations/20260526000019_mcp_021c_edge_run_mode.sql.
 *
 * The mechanical safety checks live here so that any deviation from the
 * design (§7) fails CI before it ships. The migration is additive (ALTER
 * TABLE … ADD COLUMN + INDEX + COMMENT only — no destructive DDL).
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260526000019_mcp_021c_edge_run_mode.sql',
);

let migrationText = '';

beforeAll(() => {
  migrationText = readFileSync(MIGRATION_PATH, 'utf8');
});

describe('MCP-021C-EDGE — migration file exists and has OPS-001 header walk', () => {
  it('MIG-1 — migration file exists with non-empty content', () => {
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

  it('MIG-4 — header documents the MCP-021B predecessor migration', () => {
    expect(migrationText).toContain('20260526000018_mcp_021b_machine_observation_results.sql');
  });
});

describe('MCP-021C-EDGE — run_mode column DDL', () => {
  it('MIG-5 — ALTER TABLE argument_machine_observation_runs ADD COLUMN run_mode present', () => {
    expect(migrationText).toMatch(
      /ALTER TABLE public\.argument_machine_observation_runs[\s\S]*?ADD COLUMN IF NOT EXISTS run_mode/,
    );
  });

  it('MIG-6 — run_mode column is text NOT NULL with DEFAULT production', () => {
    expect(migrationText).toMatch(
      /run_mode\s+text\s+NOT NULL\s+DEFAULT\s+'production'/,
    );
  });

  it('MIG-7 — run_mode has CHECK constraint with production/admin_validation', () => {
    expect(migrationText).toMatch(
      /CHECK\s*\(\s*run_mode\s+IN\s*\(\s*'production',\s*'admin_validation'\s*\)\s*\)/,
    );
  });
});

describe('MCP-021C-EDGE — index for run_mode', () => {
  it('MIG-8 — CREATE INDEX argument_machine_observation_runs_run_mode_idx present', () => {
    expect(migrationText).toMatch(
      /CREATE INDEX IF NOT EXISTS argument_machine_observation_runs_run_mode_idx/,
    );
  });

  it('MIG-9 — index targets argument_machine_observation_runs (run_mode)', () => {
    expect(migrationText).toMatch(
      /ON public\.argument_machine_observation_runs\s*\(\s*run_mode\s*\)/,
    );
  });
});

describe('MCP-021C-EDGE — column comment', () => {
  it('MIG-10 — COMMENT ON COLUMN argument_machine_observation_runs.run_mode present', () => {
    expect(migrationText).toMatch(
      /COMMENT ON COLUMN public\.argument_machine_observation_runs\.run_mode/,
    );
  });

  it('MIG-11 — column comment explains production/admin_validation purpose', () => {
    expect(migrationText).toContain('production');
    expect(migrationText).toContain('admin_validation');
  });

  it('MIG-12 — column comment references Source 6 / persistence query layer filter', () => {
    expect(migrationText).toMatch(/fetchPersistedObservationsForArguments|persistence query/);
  });
});

describe('MCP-021C-EDGE — migration is additive (no destructive DDL)', () => {
  it('MIG-13 — ZERO DROP COLUMN statements', () => {
    expect(migrationText).not.toMatch(/DROP COLUMN/i);
  });

  it('MIG-14 — ZERO DROP TABLE statements', () => {
    expect(migrationText).not.toMatch(/DROP TABLE/i);
  });

  it('MIG-15 — ZERO DELETE FROM statements', () => {
    expect(migrationText).not.toMatch(/DELETE FROM/i);
  });

  it('MIG-16 — ZERO TRUNCATE statements', () => {
    expect(migrationText).not.toMatch(/TRUNCATE/i);
  });

  it('MIG-17 — ZERO new RLS policy statements', () => {
    expect(migrationText).not.toMatch(/CREATE POLICY/i);
  });

  it('MIG-18 — ZERO COMMENT ON … storage.* statements (PR-003 boundary)', () => {
    expect(migrationText).not.toMatch(/COMMENT ON\s+\w+\s+storage\./i);
  });
});

describe('MCP-021C-EDGE — statement ordering', () => {
  it('MIG-19 — ALTER TABLE appears BEFORE CREATE INDEX (the index references the new column)', () => {
    const alterIdx = migrationText.search(
      /ALTER TABLE public\.argument_machine_observation_runs[\s\S]*?ADD COLUMN/,
    );
    const indexIdx = migrationText.indexOf('CREATE INDEX IF NOT EXISTS argument_machine_observation_runs_run_mode_idx');
    expect(alterIdx).toBeGreaterThanOrEqual(0);
    expect(indexIdx).toBeGreaterThan(alterIdx);
  });

  it('MIG-20 — COMMENT ON COLUMN appears AFTER CREATE INDEX', () => {
    const indexIdx = migrationText.indexOf('CREATE INDEX IF NOT EXISTS argument_machine_observation_runs_run_mode_idx');
    const commentIdx = migrationText.indexOf('COMMENT ON COLUMN public.argument_machine_observation_runs.run_mode');
    expect(indexIdx).toBeGreaterThanOrEqual(0);
    expect(commentIdx).toBeGreaterThan(indexIdx);
  });
});
