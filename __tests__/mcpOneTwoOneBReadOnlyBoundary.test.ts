/**
 * MCP-021B — Test §8.7: read-only boundary preservation.
 *
 * Pure-text scans + git-diff scans that prove MCP-021B's read-only file
 * list is preserved byte-equal (or for the explicitly-edited files,
 * minimally additive).
 */

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..');

function gitDiffFromMain(relPath: string): string {
  try {
    return execSync(`git diff main..HEAD -- "${relPath}"`, {
      cwd: ROOT,
      encoding: 'utf8',
    });
  } catch {
    return '';
  }
}

function countDiffLines(relPath: string): number {
  const diff = gitDiffFromMain(relPath);
  if (!diff) return 0;
  // Count + and - line markers (excluding the +++ / --- header lines).
  let count = 0;
  for (const line of diff.split('\n')) {
    if ((line.startsWith('+') && !line.startsWith('+++')) ||
        (line.startsWith('-') && !line.startsWith('---'))) {
      count++;
    }
  }
  return count;
}

describe('MCP-021B — byte-equal preservation on UX-001.5A model files', () => {
  it('RO-1 — nodeLabelPresentationModel.ts unchanged', () => {
    expect(gitDiffFromMain('src/features/nodeLabels/nodeLabelPresentationModel.ts')).toBe('');
  });

  it('RO-2 — nodeLabelPriorityModel.ts unchanged', () => {
    expect(gitDiffFromMain('src/features/nodeLabels/nodeLabelPriorityModel.ts')).toBe('');
  });

  it('RO-3 — nodeLabelDescriptorAdapter.ts unchanged', () => {
    expect(gitDiffFromMain('src/features/nodeLabels/nodeLabelDescriptorAdapter.ts')).toBe('');
  });
});

describe('MCP-021B — bounded edit on UX-001.5A consumer components', () => {
  // NodeLabelStrip and NodeLabelInspectGroups gain exactly one new
  // optional prop + one additional argument to adaptAllSourcesForNode.
  // The edit is documented in the design §6.2 as "minimally additive".
  // The bound is the count of touched lines (+/- markers in diff).
  it('RO-4 — NodeLabelStrip.tsx diff bounded to additive prop + argument pass-through', () => {
    const lines = countDiffLines('src/features/nodeLabels/NodeLabelStrip.tsx');
    // Realistic bound: prop on interface (3 lines), arg on compute helper
    // signature (4 lines), call wrapper (3 lines), useMemo dep (1 line),
    // header / jsdoc note (~6 lines). Cap at 50 to allow for jsdoc style.
    expect(lines).toBeLessThanOrEqual(50);
  });

  it('RO-5 — NodeLabelInspectGroups.tsx diff bounded to additive prop + argument pass-through', () => {
    const lines = countDiffLines('src/features/nodeLabels/NodeLabelInspectGroups.tsx');
    expect(lines).toBeLessThanOrEqual(50);
  });
});

describe('MCP-021B — MCP-021A registry files byte-equal', () => {
  it('RO-6 — machineObservationDefinitions.ts unchanged', () => {
    expect(gitDiffFromMain('src/features/nodeLabels/machineObservationDefinitions.ts')).toBe('');
  });

  it('RO-7 — machineObservationDefinitions/familyA.ts unchanged', () => {
    expect(gitDiffFromMain('src/features/nodeLabels/machineObservationDefinitions/familyA.ts')).toBe('');
  });

  // RO-8 — byte-equal boundary relaxed 2026-06-07 (MCP-BUILD2a).
  // RO-8 originally asserted familyB.ts was byte-equal to main (`git diff
  // main..HEAD` empty), proving the long-merged MCP-021B card touched no
  // Family-B definitions. As a PERMANENT test that premise is structurally
  // incompatible with the ratified MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001
  // Build-2 roadmap, which sequences family-by-family VOCABULARY EXPANSION of
  // familyB.ts (MCP-BUILD2a adds 3 disagreement_axis booleans). Mirrors the
  // RO-36/37 relaxation: the MCP-021B boundary is historical; relaxed here to
  // an ADDITIVE-ONLY well-formedness check so vocabulary-expansion cards can
  // grow familyB.ts without a spurious read-only-boundary failure. The file
  // must still export FAMILY_B_DEFINITIONS and retain the MCP-021A baseline
  // rawKeys (additive, never a removal/rename).
  it('RO-8 — familyB.ts is well-formed + additive (MCP-021A baseline preserved)', () => {
    const content = readFileSync(
      join(ROOT, 'src/features/nodeLabels/machineObservationDefinitions/familyB.ts'),
      'utf8',
    );
    expect(content).toContain('export const FAMILY_B_DEFINITIONS');
    // MCP-021A baseline rawKeys must all still be present (no removal/rename).
    for (const baselineRawKey of [
      'disputes_evidence_applicability',
      'disagreement_present',
      'disputes_relevance',
    ]) {
      expect(content).toContain(`rawKey: '${baselineRawKey}'`);
    }
  });

  it('RO-9 — machineObservationDefinitions/familyC.ts unchanged', () => {
    expect(gitDiffFromMain('src/features/nodeLabels/machineObservationDefinitions/familyC.ts')).toBe('');
  });

  it('RO-10 — machineObservationDefinitions/familyD.ts unchanged', () => {
    expect(gitDiffFromMain('src/features/nodeLabels/machineObservationDefinitions/familyD.ts')).toBe('');
  });

  it('RO-11 — machineObservationDefinitions/familyE.ts unchanged', () => {
    expect(gitDiffFromMain('src/features/nodeLabels/machineObservationDefinitions/familyE.ts')).toBe('');
  });

  it('RO-12 — machineObservationDefinitions/familyF.ts unchanged', () => {
    expect(gitDiffFromMain('src/features/nodeLabels/machineObservationDefinitions/familyF.ts')).toBe('');
  });

  it('RO-13 — machineObservationDefinitions/familyG.ts unchanged', () => {
    expect(gitDiffFromMain('src/features/nodeLabels/machineObservationDefinitions/familyG.ts')).toBe('');
  });

  it('RO-14 — machineObservationDefinitions/familyH.ts unchanged', () => {
    expect(gitDiffFromMain('src/features/nodeLabels/machineObservationDefinitions/familyH.ts')).toBe('');
  });

  it('RO-15 — machineObservationDefinitions/familyI.ts unchanged', () => {
    expect(gitDiffFromMain('src/features/nodeLabels/machineObservationDefinitions/familyI.ts')).toBe('');
  });

  it('RO-16 — machineObservationDefinitions/familyJ.ts unchanged', () => {
    expect(gitDiffFromMain('src/features/nodeLabels/machineObservationDefinitions/familyJ.ts')).toBe('');
  });
});

describe('MCP-021B — MCP-021A schema + taxonomy unchanged', () => {
  it('RO-17 — mcpBooleanObservationSchema.ts unchanged', () => {
    expect(gitDiffFromMain('src/features/nodeLabels/mcpBooleanObservationSchema.ts')).toBe('');
  });

  it('RO-18 — userAllegationRegistry.ts unchanged', () => {
    expect(gitDiffFromMain('src/features/nodeLabels/userAllegationRegistry.ts')).toBe('');
  });

  it('RO-19 — machineObservationRegistry.ts unchanged', () => {
    expect(gitDiffFromMain('src/features/nodeLabels/machineObservationRegistry.ts')).toBe('');
  });

  it('RO-20 — threadTopologyAutoMetadata.ts unchanged', () => {
    expect(gitDiffFromMain('src/features/nodeLabels/threadTopologyAutoMetadata.ts')).toBe('');
  });

  it('RO-21 — nodeLabelTypes.ts unchanged', () => {
    expect(gitDiffFromMain('src/features/nodeLabels/nodeLabelTypes.ts')).toBe('');
  });
});

describe('MCP-021B — UX-001.6 cross-device QA tests unchanged (byte-equal)', () => {
  it('RO-22 — uxOneOneSixViewportMatrix.test.ts unchanged', () => {
    expect(gitDiffFromMain('__tests__/uxOneOneSixViewportMatrix.test.ts')).toBe('');
  });

  it('RO-23 — uxOneOneSixTouchTargets.test.ts unchanged', () => {
    expect(gitDiffFromMain('__tests__/uxOneOneSixTouchTargets.test.ts')).toBe('');
  });

  it('RO-24 — uxOneOneSixColorIndependence.test.tsx unchanged', () => {
    expect(gitDiffFromMain('__tests__/uxOneOneSixColorIndependence.test.tsx')).toBe('');
  });

  it('RO-25 — uxOneOneSixReadOnlyBoundary.test.ts unchanged', () => {
    expect(gitDiffFromMain('__tests__/uxOneOneSixReadOnlyBoundary.test.ts')).toBe('');
  });

  it('RO-26 — uxOneOneSixDoctrine.test.ts unchanged', () => {
    expect(gitDiffFromMain('__tests__/uxOneOneSixDoctrine.test.ts')).toBe('');
  });
});

describe('MCP-021B — MCP-021A test files unchanged (byte-equal)', () => {
  it('RO-27 — mcpOneTwoOneASourceSixInvariance.test.ts unchanged', () => {
    expect(gitDiffFromMain('__tests__/mcpOneTwoOneASourceSixInvariance.test.ts')).toBe('');
  });

  // RO-28 — byte-equal boundary relaxed 2026-06-07 (MCP-BUILD2a).
  // RO-28 originally asserted the MCP-021A registry-size test was byte-equal
  // to main. MCP-BUILD2a legitimately updates that test's per-family counts
  // (disagreement_axis 14 → 17; total 172 → 175) to reflect the +3
  // vocabulary expansion. Mirrors the RO-36/37 + RO-8 relaxation: the
  // MCP-021B byte-equal premise is historical and incompatible with the
  // ratified Build-2 roadmap. Relaxed to a well-formedness check (the test
  // file still exists and asserts the registry size).
  it('RO-28 — mcpOneTwoOneARegistrySize.test.ts is well-formed', () => {
    const content = readFileSync(
      join(ROOT, '__tests__/mcpOneTwoOneARegistrySize.test.ts'),
      'utf8',
    );
    expect(content).toContain('ALL_MACHINE_OBSERVATION_DEFINITION_KEYS');
    expect(content).toContain('per-family count forecast');
  });

  it('RO-29 — mcpOneTwoOneALabelDoctrine.test.ts unchanged', () => {
    expect(gitDiffFromMain('__tests__/mcpOneTwoOneALabelDoctrine.test.ts')).toBe('');
  });

  it('RO-30 — mcpOneTwoOneADisplayCapPreservation.test.ts unchanged', () => {
    expect(gitDiffFromMain('__tests__/mcpOneTwoOneADisplayCapPreservation.test.ts')).toBe('');
  });

  it('RO-31 — mcpOneTwoOneADefinitionCompleteness.test.ts unchanged', () => {
    expect(gitDiffFromMain('__tests__/mcpOneTwoOneADefinitionCompleteness.test.ts')).toBe('');
  });

  it('RO-32 — mcpOneTwoOneAFamilyContracts.test.ts unchanged', () => {
    expect(gitDiffFromMain('__tests__/mcpOneTwoOneAFamilyContracts.test.ts')).toBe('');
  });

  it('RO-33 — mcpOneTwoOneANoDuplicateAliases.test.ts unchanged', () => {
    expect(gitDiffFromMain('__tests__/mcpOneTwoOneANoDuplicateAliases.test.ts')).toBe('');
  });

  it('RO-34 — mcpOneTwoOneASurfacePolicy.test.ts unchanged', () => {
    expect(gitDiffFromMain('__tests__/mcpOneTwoOneASurfacePolicy.test.ts')).toBe('');
  });

  it('RO-35 — mcpOneTwoOneAThreadTopologyStubs.test.ts unchanged', () => {
    expect(gitDiffFromMain('__tests__/mcpOneTwoOneAThreadTopologyStubs.test.ts')).toBe('');
  });
});

describe('MCP-021B — package files (byte-equal boundary relaxed 2026-06-02)', () => {
  // RO-36/RO-37 originally asserted package.json / package-lock.json were
  // byte-equal to main (`git diff main..HEAD` empty), proving the long-merged
  // MCP-021B card touched no package files. As a PERMANENT test that assertion
  // instead FALSE-FAILED on every legitimate dependency PR — it compares the
  // branch's committed diff against main, so ANY committed package.json change
  // trips it (e.g. the OPS-DEPS-* dependency-hygiene cards: OPS-DEPS-002's
  // jest-native removal and OPS-DEPS-004's xcode>uuid@11 override). The MCP-021B
  // boundary it guarded is historical; relaxed here to a well-formedness sanity
  // check so dependency cards can change package files without a spurious
  // read-only-boundary failure.
  it('RO-36 — package.json is well-formed (dep PRs may legitimately change it)', () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('cdiscourse');
  });

  it('RO-37 — package-lock.json is well-formed (dep PRs may legitimately change it)', () => {
    const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8'));
    expect(typeof lock.lockfileVersion).toBe('number');
  });
});

describe('MCP-021B — composer / referee / metadata read-only boundaries', () => {
  it('RO-38 — useSemanticReferee.ts unchanged (MCP-021C territory)', () => {
    expect(gitDiffFromMain('src/features/arguments/useSemanticReferee.ts')).toBe('');
  });

  it('RO-39 — designTokens.ts unchanged (no new token)', () => {
    expect(gitDiffFromMain('src/lib/designTokens.ts')).toBe('');
  });

  it('RO-40 — RefereeBannerView.tsx unchanged', () => {
    expect(gitDiffFromMain('src/features/refereeBanners/RefereeBannerView.tsx')).toBe('');
  });
});

describe('MCP-021B — sanity: read-only boundary structure', () => {
  it('RO-41 — git is available and main branch exists', () => {
    // Will not be empty if main has different commits; will be empty if
    // nothing changed. Either way, the test should not throw.
    const cmd = execSync('git rev-parse main', { cwd: ROOT, encoding: 'utf8' });
    expect(cmd.trim().length).toBeGreaterThan(0);
  });

  it('RO-42 — feature branch contains the MCP-021B migration file', () => {
    const path = join(ROOT, 'supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql');
    const content = readFileSync(path, 'utf8');
    expect(content.length).toBeGreaterThan(0);
  });
});
