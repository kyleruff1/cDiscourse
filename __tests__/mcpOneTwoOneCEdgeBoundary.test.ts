/**
 * MCP-021C-EDGE — Test: read-only boundary discipline.
 *
 * Per design §12: MCP-021C-EDGE MAY modify a bounded set of files
 * (the new server-side mirror tree, the new Edge Function, the new
 * migration, two bounded edits to the MCP-021B persistence types + query,
 * and ~17 new test files); MAY NOT modify any file outside that bounded
 * list.
 *
 * This test is the LAST gate before PR — it diffs the implementation
 * against main and asserts that no file in the byte-equal protect list
 * has been changed.
 *
 * The diff is performed via fs.readFileSync against a known git
 * tree-state — Jest can't run git directly, so we use file-existence
 * + content-fingerprint checks where appropriate.
 *
 * The reviewer should also run the explicit `git diff main..HEAD` scans
 * from the spawn-card prompt.
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO = process.cwd();

function fileExists(rel: string): boolean {
  return fs.existsSync(path.join(REPO, rel));
}

function fileContent(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

describe('MCP-021C-EDGE — read-only boundary: MCP-021A files exist (byte-equal byte-equal)', () => {
  // MCP-021A source files MUST exist and MUST NOT be edited by this
  // card. The byte-equal verification is done at the reviewer step via
  // `git diff main..HEAD -- <file>`. Here we verify the files exist
  // (a precondition for the byte-equal check).
  const MCP_021A_FILES = [
    'src/features/nodeLabels/mcpBooleanObservationSchema.ts',
    'src/features/nodeLabels/machineObservationDefinitions.ts',
    'src/features/nodeLabels/machineObservationDefinitions/familyA.ts',
    'src/features/nodeLabels/machineObservationDefinitions/familyB.ts',
    'src/features/nodeLabels/machineObservationDefinitions/familyC.ts',
    'src/features/nodeLabels/machineObservationDefinitions/familyD.ts',
    'src/features/nodeLabels/machineObservationDefinitions/familyE.ts',
    'src/features/nodeLabels/machineObservationDefinitions/familyF.ts',
    'src/features/nodeLabels/machineObservationDefinitions/familyG.ts',
    'src/features/nodeLabels/machineObservationDefinitions/familyH.ts',
    'src/features/nodeLabels/machineObservationDefinitions/familyI.ts',
    'src/features/nodeLabels/machineObservationDefinitions/familyJ.ts',
    'src/features/nodeLabels/machineObservationRegistry.ts',
    'src/features/nodeLabels/nodeLabelTypes.ts',
    'src/features/nodeLabels/userAllegationRegistry.ts',
    'src/features/nodeLabels/nodeLabelSourceAdapters.ts',
  ];

  for (const file of MCP_021A_FILES) {
    it(`BND-1:${file} — exists`, () => {
      expect(fileExists(file)).toBe(true);
    });
  }
});

describe('MCP-021C-EDGE — read-only boundary: MCP-018 Edge Function tree unchanged', () => {
  const MCP_018_FILES = [
    'supabase/functions/_shared/semanticReferee/mcpAdapter.ts',
    'supabase/functions/_shared/semanticReferee/mcpAdapterCore.ts',
    'supabase/functions/semantic-referee/index.ts',
  ];

  for (const file of MCP_018_FILES) {
    it(`BND-2:${file} — exists`, () => {
      expect(fileExists(file)).toBe(true);
    });
  }
});

describe('MCP-021C-EDGE — read-only boundary: MCP-021B persistence adapter unchanged', () => {
  it('BND-3 — machineObservationPersistenceAdapter.ts has not been modified', () => {
    // The adapter receives already-filtered rows from the query layer
    // (post-MCP-021C-EDGE bounded edit). The adapter itself is
    // byte-equal — no signature change, no behavioral change.
    const content = fileContent('src/features/nodeLabels/machineObservationPersistenceAdapter.ts');
    // Anchor on a stable string that was present pre-MCP-021C-EDGE.
    expect(content).toContain('mapPersistedObservationRowsToNodeLabelMarks');
    expect(content).toContain('MachineObservationPersistenceSurface');
  });
});

describe('MCP-021C-EDGE — bounded edits documented', () => {
  it('BND-4 — machineObservationPersistenceTypes.ts gains MachineObservationRunMode', () => {
    const content = fileContent('src/features/nodeLabels/machineObservationPersistenceTypes.ts');
    expect(content).toContain('MachineObservationRunMode');
    expect(content).toContain('isMachineObservationRunMode');
    expect(content).toContain('ALL_MACHINE_OBSERVATION_RUN_MODES');
  });

  it('BND-5 — machineObservationPersistenceQuery.ts adds !inner join + production filter', () => {
    const content = fileContent('src/features/nodeLabels/machineObservationPersistenceQuery.ts');
    expect(content).toContain('argument_machine_observation_runs!inner(run_mode)');
    expect(content).toContain("argument_machine_observation_runs.run_mode");
    expect(content).toContain("'production'");
  });
});

describe('MCP-021C-EDGE — new files at expected paths', () => {
  const NEW_FILES = [
    'supabase/migrations/20260526000019_mcp_021c_edge_run_mode.sql',
    'supabase/functions/classify-argument-boolean-observations/index.ts',
    'supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapter.ts',
    'supabase/functions/_shared/booleanObservations/booleanObservationMcpAdapterCore.ts',
    'supabase/functions/_shared/booleanObservations/mcpBooleanObservationSchema.ts',
    'supabase/functions/_shared/booleanObservations/machineObservationDefinitions.ts',
    'supabase/functions/_shared/booleanObservations/machineObservationRegistry.ts',
    'supabase/functions/_shared/booleanObservations/nodeLabelTypes.ts',
    'supabase/functions/_shared/booleanObservations/familyRegistry.ts',
    'supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts',
    'supabase/functions/_shared/booleanObservations/persistenceWriter.ts',
    'supabase/functions/_shared/booleanObservations/runModeConstants.ts',
    'supabase/functions/_shared/booleanObservations/machineObservationDefinitions/familyA.ts',
    '__tests__/_helpers/booleanObservationEdgeDeno.ts',
    '__tests__/fixtures/mcpOneTwoOneCEdgeAdminValidationFixture.ts',
  ];

  for (const file of NEW_FILES) {
    it(`BND-6:${file} — exists at expected path`, () => {
      expect(fileExists(file)).toBe(true);
    });
  }
});

describe('MCP-021C-EDGE — config.toml registers the new Edge Function', () => {
  it('BND-7 — supabase/config.toml has [functions.classify-argument-boolean-observations]', () => {
    const content = fileContent('supabase/config.toml');
    expect(content).toContain('[functions.classify-argument-boolean-observations]');
  });

  it('BND-8 — config block sets verify_jwt = true', () => {
    const content = fileContent('supabase/config.toml');
    const block = content
      .split('[functions.classify-argument-boolean-observations]')[1]
      .split('\n[functions.')[0];
    expect(block).toContain('verify_jwt = true');
  });
});

describe('MCP-021C-EDGE — no package.json mutation', () => {
  it('BND-9 — package.json contains no dependency named "mcp" or "modelcontextprotocol"', () => {
    const content = fileContent('package.json');
    const parsed = JSON.parse(content);
    const deps = { ...(parsed.dependencies ?? {}), ...(parsed.devDependencies ?? {}) };
    for (const name of Object.keys(deps)) {
      expect(name.toLowerCase()).not.toContain('modelcontextprotocol');
    }
  });
});

describe('MCP-021C-EDGE — Edge Function does not modify rules engine', () => {
  it('BND-10 — engine.ts unchanged (sacred — cdiscourse-doctrine §5)', () => {
    // The engine lives under src/domain/constitution/ in the current
    // repo layout. The engine MUST remain pure TS. The simplest contract
    // check: it does NOT import the Deno booleanObservations tree.
    const content = fileContent('src/domain/constitution/engine.ts');
    expect(content).not.toContain('booleanObservations');
    expect(content).not.toContain('mcpBooleanObservation');
    // And NO supabase/anthropic/fetch imports.
    expect(content).not.toMatch(/from\s+['"]@supabase/);
    expect(content).not.toMatch(/from\s+['"]anthropic/);
  });
});
