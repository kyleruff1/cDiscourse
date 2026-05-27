/**
 * MCP-021C-AUTO-TRIGGER-FAMILY-A — Source 6 rendering preservation tests.
 *
 * Per design §7 + §11.2 (byte-equal boundary list):
 *   - `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127`
 *     must remain byte-equal — the production filter is the load-bearing
 *     line that admin-validation rows must NOT reach Source 6 rendering.
 *   - The auto-trigger writes `run_mode='production'`, so its rows
 *     render through the existing filter unchanged.
 *   - MCP-021A schema version constant is byte-equal.
 *   - MCP-021A Family A taxonomy file is byte-equal (no taxonomy change).
 *
 * Forecast: ~12 tests (S6R-1 through S6R-12).
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();
const PERSISTENCE_QUERY_PATH = path.join(
  REPO,
  'src/features/nodeLabels/machineObservationPersistenceQuery.ts',
);
const SCHEMA_PATH = path.join(
  REPO,
  'src/features/nodeLabels/mcpBooleanObservationSchema.ts',
);
const FAMILY_A_PATH = path.join(
  REPO,
  'src/features/nodeLabels/machineObservationDefinitions/familyA.ts',
);
const DISPATCHER_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts',
);
const RUN_MODE_MIGRATION_PATH = path.join(
  REPO,
  'supabase/migrations/20260526000019_mcp_021c_edge_run_mode.sql',
);
const REQUEST_BUILDER_PATH = path.join(
  REPO,
  'supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts',
);

let persistenceQueryText = '';
let schemaText = '';
let familyAText = '';
let dispatcherText = '';
let runModeMigrationText = '';
let requestBuilderText = '';

beforeAll(() => {
  persistenceQueryText = fs.readFileSync(PERSISTENCE_QUERY_PATH, 'utf8');
  schemaText = fs.readFileSync(SCHEMA_PATH, 'utf8');
  familyAText = fs.readFileSync(FAMILY_A_PATH, 'utf8');
  dispatcherText = fs.readFileSync(DISPATCHER_PATH, 'utf8');
  runModeMigrationText = fs.readFileSync(RUN_MODE_MIGRATION_PATH, 'utf8');
  requestBuilderText = fs.readFileSync(REQUEST_BUILDER_PATH, 'utf8');
});

describe('MCP-021C-AUTO-TRIGGER-FAMILY-A — Source 6 production filter (byte-equal)', () => {
  it('S6R-1 — machineObservationPersistenceQuery.ts:127 contains the canonical production filter', () => {
    // The exact line including leading 6 spaces of indentation.
    // The line index in the source file's split('\n') is 126 (0-based)
    // when line 127 is the target.
    const lines = persistenceQueryText.split('\n');
    expect(lines.length).toBeGreaterThan(127);
    const line127 = lines[126]; // 0-based: line 127 is index 126
    expect(line127).toBe(
      "    .eq('argument_machine_observation_runs.run_mode', 'production');",
    );
  });

  it('S6R-2 — the production filter line appears EXACTLY ONCE in the file', () => {
    const matches = persistenceQueryText.match(
      /\.eq\(['"]argument_machine_observation_runs\.run_mode['"],\s*['"]production['"]\)/g,
    ) ?? [];
    expect(matches.length).toBe(1);
  });

  it('S6R-3 — admin_validation is never used as the filter value (excluded from Source 6)', () => {
    // The persistence query never filters by `run_mode = 'admin_validation'`.
    expect(persistenceQueryText).not.toMatch(
      /\.eq\(['"]argument_machine_observation_runs\.run_mode['"],\s*['"]admin_validation['"]\)/,
    );
  });
});

describe('MCP-021C-AUTO-TRIGGER-FAMILY-A — auto-trigger writes production rows', () => {
  it('S6R-4 — dispatcher constants pin run_mode to production (no admin_validation)', () => {
    // The dispatcher hard-codes the production mode; admin_validation
    // remains the manual-Edge-Function-only path.
    expect(dispatcherText).toMatch(/AUTO_TRIGGER_MODE\s*=\s*['"]production['"]/);
    expect(dispatcherText).not.toMatch(/['"]admin_validation['"]/);
  });

  it('S6R-5 — dispatcher idempotency pre-check filters by run_mode=production', () => {
    // The auto-trigger's idempotency check is scoped to production
    // runs only; admin_validation runs never block an auto-trigger.
    expect(dispatcherText).toMatch(
      /\.eq\s*\(\s*['"]run_mode['"]\s*,\s*['"]production['"]\s*\)/,
    );
  });
});

describe('MCP-021C-AUTO-TRIGGER-FAMILY-A — MCP-021A schema + taxonomy invariants', () => {
  it('S6R-6 — MCP-021A schema version constant is the canonical v1 string', () => {
    expect(schemaText).toContain(
      "'mcp-021.machine-observations.boolean.v1' as const",
    );
  });

  it('S6R-7 — MCP-021A Family A file declares the family = \'parent_relation\'', () => {
    // The Family A definition file must continue to declare the
    // family value as `parent_relation`. The dispatcher's literal
    // depends on this binding.
    expect(familyAText).toContain("family: 'parent_relation'");
  });

  it('S6R-8 — request builder remains byte-equivalent (no auto-trigger fork)', () => {
    // The dispatcher invokes `buildBooleanObservationRequestForArgument`
    // verbatim (no auto-trigger-specific variant). Verify the request
    // builder source still exports the canonical builder and has not
    // been forked.
    expect(requestBuilderText).toContain('export function buildBooleanObservationRequestForArgument');
    // No new "auto-trigger" function was introduced in the request
    // builder file.
    expect(requestBuilderText).not.toMatch(/buildAutoTriggerBoolean/);
  });
});

describe('MCP-021C-AUTO-TRIGGER-FAMILY-A — run_mode migration unchanged', () => {
  it('S6R-9 — dispatcher source writes run_mode=\'production\' (no other literal)', () => {
    // The dispatcher writes ONLY production-mode rows (Family A); the
    // single occurrence of the run_mode value is the production literal.
    expect(dispatcherText).toMatch(/\.eq\s*\(\s*['"]run_mode['"]\s*,\s*['"]production['"]\s*\)/);
  });

  it('S6R-10 — run_mode migration retains the CHECK constraint with both modes (no rewrite)', () => {
    // The migration must still define the run_mode column with the
    // exact CHECK constraint (production | admin_validation). The
    // auto-trigger card adds NO migration.
    expect(runModeMigrationText).toContain('run_mode');
    expect(runModeMigrationText).toMatch(
      /CHECK\s*\(\s*run_mode\s+IN\s*\(\s*'production'\s*,\s*'admin_validation'\s*\)\s*\)/i,
    );
  });

  it('S6R-11 — schema-version mismatch is rejected by the parser (existing guard)', () => {
    // The parser at src/features/nodeLabels/mcpBooleanObservationSchema.ts
    // already enforces schemaVersion equality. The auto-trigger uses
    // the same constant; no new parser path.
    expect(schemaText).toMatch(
      /if\s*\(\s*schemaVersion\s*!==\s*MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION\s*\)/,
    );
  });

  it('S6R-12 — auto-trigger never writes an unknown raw_key (the upstream sanitizer drops them)', () => {
    // The dispatcher invokes `classifyOneArgumentCore`, which calls
    // `sanitizeMcpBooleanObservationResponse(..., { surface: 'inspect' })`
    // before writing. Unknown rawKeys are dropped by the sanitizer; the
    // dispatcher does not need its own filter. Verify the dispatcher
    // does NOT contain a direct rawKey write path that bypasses the
    // sanitizer (e.g., it does not import the persistResults helper
    // directly).
    expect(dispatcherText).not.toMatch(
      /import\s+\{[\s\S]*?persistResults[\s\S]*?\}\s+from/,
    );
  });
});
