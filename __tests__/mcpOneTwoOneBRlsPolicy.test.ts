/**
 * MCP-021B — Test §8.2: RLS policy shape.
 *
 * Pure-text scan of the migration's RLS policy text PLUS source-code
 * scans that prove no client code touches service-role for the new
 * tables.
 */

import { readFileSync, readdirSync } from 'fs';
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

describe('MCP-021B — runs SELECT policy', () => {
  it('RLS-1 — CREATE POLICY amor_runs_select_via_argument present', () => {
    expect(migrationText).toMatch(
      /CREATE POLICY amor_runs_select_via_argument\s+ON public\.argument_machine_observation_runs\s+FOR SELECT/,
    );
  });

  it('RLS-2 — runs SELECT policy text contains EXISTS subquery into public.arguments', () => {
    // Anchor specifically inside the runs SELECT policy block to avoid
    // false-positives from the results SELECT policy below it.
    const policyStart = migrationText.indexOf('CREATE POLICY amor_runs_select_via_argument');
    const policyEnd = migrationText.indexOf('CREATE POLICY amor_results_select_via_run');
    expect(policyStart).toBeGreaterThanOrEqual(0);
    expect(policyEnd).toBeGreaterThan(policyStart);
    const policyBody = migrationText.slice(policyStart, policyEnd);
    expect(policyBody).toMatch(/EXISTS \(\s*SELECT 1\s+FROM public\.arguments a\s+WHERE a\.id = argument_machine_observation_runs\.argument_id/);
  });

  it('RLS-3 — runs SELECT subquery uses fully-qualified table.column (OPS-001 Class 1)', () => {
    const policyStart = migrationText.indexOf('CREATE POLICY amor_runs_select_via_argument');
    const policyEnd = migrationText.indexOf('CREATE POLICY amor_results_select_via_run');
    const policyBody = migrationText.slice(policyStart, policyEnd);
    // The qualifier MUST be `argument_machine_observation_runs.argument_id`,
    // NOT bare `argument_id`.
    expect(policyBody).toContain('argument_machine_observation_runs.argument_id');
  });

  it('RLS-4 — runs SELECT policy text does NOT contain a direct JOIN into public.debates', () => {
    const policyStart = migrationText.indexOf('CREATE POLICY amor_runs_select_via_argument');
    const policyEnd = migrationText.indexOf('CREATE POLICY amor_results_select_via_run');
    const policyBody = migrationText.slice(policyStart, policyEnd);
    // The DELEGATION pattern delegates the debates visibility check to
    // the arguments SELECT policy. The runs policy must NOT directly
    // JOIN into debates.
    expect(policyBody).not.toMatch(/JOIN public\.debates/);
  });

  it('RLS-5 — runs SELECT policy text does NOT contain a direct JOIN into public.debate_participants', () => {
    const policyStart = migrationText.indexOf('CREATE POLICY amor_runs_select_via_argument');
    const policyEnd = migrationText.indexOf('CREATE POLICY amor_results_select_via_run');
    const policyBody = migrationText.slice(policyStart, policyEnd);
    expect(policyBody).not.toMatch(/public\.debate_participants/);
  });
});

describe('MCP-021B — results SELECT policy', () => {
  it('RLS-6 — CREATE POLICY amor_results_select_via_run present', () => {
    expect(migrationText).toMatch(
      /CREATE POLICY amor_results_select_via_run\s+ON public\.argument_machine_observation_results\s+FOR SELECT/,
    );
  });

  it('RLS-7 — results SELECT policy text contains EXISTS subquery into runs', () => {
    const policyStart = migrationText.indexOf('CREATE POLICY amor_results_select_via_run');
    expect(policyStart).toBeGreaterThan(0);
    const policyBody = migrationText.slice(policyStart);
    expect(policyBody).toMatch(/EXISTS \(\s*SELECT 1\s+FROM public\.argument_machine_observation_runs r\s+WHERE r\.id = argument_machine_observation_results\.run_id/);
  });

  it('RLS-8 — results SELECT subquery uses fully-qualified table.column (OPS-001 Class 1)', () => {
    const policyStart = migrationText.indexOf('CREATE POLICY amor_results_select_via_run');
    const policyBody = migrationText.slice(policyStart);
    expect(policyBody).toContain('argument_machine_observation_results.run_id');
  });
});

describe('MCP-021B — no client write policies', () => {
  it('RLS-9 — no CREATE POLICY for INSERT/UPDATE/DELETE on either table', () => {
    const writeMatches = migrationText.match(/CREATE POLICY[\s\S]+?FOR (INSERT|UPDATE|DELETE)/g);
    expect(writeMatches).toBeNull();
  });

  it('RLS-10 — runs policy applies TO authenticated (not TO PUBLIC, not anon)', () => {
    const policyStart = migrationText.indexOf('CREATE POLICY amor_runs_select_via_argument');
    const policyEnd = migrationText.indexOf('CREATE POLICY amor_results_select_via_run');
    const policyBody = migrationText.slice(policyStart, policyEnd);
    expect(policyBody).toContain('TO authenticated');
  });

  it('RLS-11 — results policy applies TO authenticated', () => {
    const policyStart = migrationText.indexOf('CREATE POLICY amor_results_select_via_run');
    const policyBody = migrationText.slice(policyStart);
    expect(policyBody).toContain('TO authenticated');
  });
});

describe('MCP-021B — client source has no service-role for these tables', () => {
  function readNewFile(relPath: string): string {
    return readFileSync(join(__dirname, '..', 'src', 'features', 'nodeLabels', relPath), 'utf8');
  }

  it('RLS-12 — MCP-021B new files do not reference SERVICE_ROLE or service_role', () => {
    const files = [
      'machineObservationPersistenceTypes.ts',
      'machineObservationPersistenceAdapter.ts',
      'machineObservationPersistenceQuery.ts',
    ];
    for (const f of files) {
      const src = readNewFile(f);
      expect(src).not.toMatch(/SERVICE_ROLE/);
      expect(src).not.toMatch(/service_role/);
    }
  });

  it('RLS-13 — MCP-021B new files do not import a service-role client', () => {
    const files = [
      'machineObservationPersistenceTypes.ts',
      'machineObservationPersistenceAdapter.ts',
      'machineObservationPersistenceQuery.ts',
    ];
    for (const f of files) {
      const src = readNewFile(f);
      // Permitted import: the shared authed `supabase` client from src/lib/supabase.
      // Forbidden: anything that would create a service-role client at the
      // module level.
      expect(src).not.toMatch(/createClient\(/); // would create a fresh client
      expect(src).not.toMatch(/SUPABASE_SERVICE_ROLE/);
    }
  });

  it('RLS-14 — machineObservationPersistenceQuery.ts exports only read helpers', () => {
    const src = readNewFile('machineObservationPersistenceQuery.ts');
    // Allowed exports: fetchPersistedObservationsForArguments + the
    // FetchPersistedObservationsResult type. No write-shaped names.
    expect(src).not.toMatch(/export.+(apply|submit|insert|update|delete|create|write)[A-Z]/);
    // The fetch function is present.
    expect(src).toMatch(/export async function fetchPersistedObservationsForArguments/);
  });

  it('RLS-15 — no MCP-021B file under nodeLabels/ writes to argument_machine_observation_(runs|results)', () => {
    const dir = join(__dirname, '..', 'src', 'features', 'nodeLabels');
    const files = readdirSync(dir);
    const mcp021bFiles = files.filter(
      (f) => f.startsWith('machineObservationPersistence') && f.endsWith('.ts'),
    );
    expect(mcp021bFiles.length).toBeGreaterThan(0);
    for (const f of mcp021bFiles) {
      const src = readFileSync(join(dir, f), 'utf8');
      // SELECT-only patterns are allowed; any .insert() / .update() /
      // .delete() / .upsert() call is forbidden.
      expect(src).not.toMatch(/\.insert\(/);
      expect(src).not.toMatch(/\.update\(/);
      expect(src).not.toMatch(/\.delete\(/);
      expect(src).not.toMatch(/\.upsert\(/);
    }
  });
});
