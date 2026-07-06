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

  // RO-7 — byte-equal boundary relaxed 2026-06-07 (MCP-BUILD2b).
  // RO-7 originally asserted familyA.ts was byte-equal to main (`git diff
  // main..HEAD` empty), proving the long-merged MCP-021B card touched no
  // Family-A definitions. As a PERMANENT test that premise is structurally
  // incompatible with the ratified MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001
  // Build-2 roadmap, which sequences family-by-family VOCABULARY EXPANSION of
  // familyA.ts (MCP-BUILD2b adds 3 parent_relation booleans). Mirrors the
  // RO-8 relaxation: the MCP-021B boundary is historical; relaxed here to an
  // ADDITIVE-ONLY well-formedness check so vocabulary-expansion cards can grow
  // familyA.ts without a spurious read-only-boundary failure. The file must
  // still export FAMILY_A_DEFINITIONS and retain the MCP-021A baseline rawKeys
  // (additive, never a removal/rename).
  it('RO-7 — familyA.ts is well-formed + additive (MCP-021A baseline preserved)', () => {
    const content = readFileSync(
      join(ROOT, 'src/features/nodeLabels/machineObservationDefinitions/familyA.ts'),
      'utf8',
    );
    expect(content).toContain('export const FAMILY_A_DEFINITIONS');
    // MCP-021A baseline rawKeys must all still be present (no removal/rename).
    for (const baselineRawKey of [
      'supports_parent',
      'challenges_parent',
      'quote_anchors_parent',
    ]) {
      expect(content).toContain(`rawKey: '${baselineRawKey}'`);
    }
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

  // RO-9 — byte-equal boundary relaxed 2026-06-07 (MCP-BUILD2c, carried into the
  // MCP-BUILD2e stacked branch). RO-9 originally asserted familyC.ts was
  // byte-equal to main; the ratified Build-2 roadmap sequences family-by-family
  // VOCABULARY EXPANSION of familyC.ts (MCP-BUILD2c adds 3 misunderstanding_repair
  // booleans). Mirrors the RO-7/RO-8/RO-11 relaxation: relaxed to an ADDITIVE-ONLY
  // well-formedness check so vocabulary-expansion cards can grow familyC.ts without
  // a spurious read-only-boundary failure. The file must still export
  // FAMILY_C_DEFINITIONS and retain the MCP-021A baseline rawKeys (additive).
  it('RO-9 — familyC.ts is well-formed + additive (MCP-021A baseline preserved)', () => {
    const content = readFileSync(
      join(ROOT, 'src/features/nodeLabels/machineObservationDefinitions/familyC.ts'),
      'utf8',
    );
    expect(content).toContain('export const FAMILY_C_DEFINITIONS');
    // MCP-021A baseline rawKeys must all still be present (no removal/rename).
    for (const baselineRawKey of [
      'clarified',
      'requests_clarification',
      'question_answer_mismatch',
    ]) {
      expect(content).toContain(`rawKey: '${baselineRawKey}'`);
    }
  });

  // RO-10 — byte-equal boundary relaxed 2026-06-07 (MCP-BUILD2d). RO-10
  // originally asserted familyD.ts was byte-equal to main (`git diff
  // main..HEAD` empty). As a PERMANENT test that premise is structurally
  // incompatible with the ratified MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001
  // Build-2 roadmap, which sequences family-by-family VOCABULARY EXPANSION of
  // familyD.ts (MCP-BUILD2d adds 3 evidence_source_chain booleans, taking the
  // mcp-server Subset 19 → 22 — the first family to exceed the 20-key cap, so
  // it is served in 2 batches). Mirrors the RO-7/RO-8/RO-9/RO-11/RO-12
  // relaxation: the MCP-021B boundary is historical; relaxed here to an
  // ADDITIVE-ONLY well-formedness check so vocabulary-expansion cards can grow
  // familyD.ts without a spurious read-only-boundary failure. The file must
  // still export FAMILY_D_DEFINITIONS and retain the MCP-021A baseline rawKeys
  // (additive, never a removal/rename).
  it('RO-10 — familyD.ts is well-formed + additive (MCP-021A baseline preserved)', () => {
    const content = readFileSync(
      join(ROOT, 'src/features/nodeLabels/machineObservationDefinitions/familyD.ts'),
      'utf8',
    );
    expect(content).toContain('export const FAMILY_D_DEFINITIONS');
    // MCP-021A baseline rawKeys must all still be present (no removal/rename).
    for (const baselineRawKey of [
      'has_evidence',
      'asks_for_evidence',
      'burden_request_present',
    ]) {
      expect(content).toContain(`rawKey: '${baselineRawKey}'`);
    }
  });

  // RO-11 — byte-equal boundary relaxed 2026-06-07 (MCP-BUILD2e).
  // RO-11 originally asserted familyE.ts was byte-equal to main (`git diff
  // main..HEAD` empty), proving the long-merged MCP-021B card touched no
  // Family-E definitions. As a PERMANENT test that premise is structurally
  // incompatible with the ratified MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001
  // Build-2 roadmap, which sequences family-by-family VOCABULARY EXPANSION of
  // familyE.ts (MCP-BUILD2e adds 3 argument_scheme booleans). Mirrors the
  // RO-7/RO-8 relaxation: the MCP-021B boundary is historical; relaxed here to
  // an ADDITIVE-ONLY well-formedness check so vocabulary-expansion cards can
  // grow familyE.ts without a spurious read-only-boundary failure. The file
  // must still export FAMILY_E_DEFINITIONS and retain the MCP-021A baseline
  // rawKeys (additive, never a removal/rename).
  it('RO-11 — familyE.ts is well-formed + additive (MCP-021A baseline preserved)', () => {
    const content = readFileSync(
      join(ROOT, 'src/features/nodeLabels/machineObservationDefinitions/familyE.ts'),
      'utf8',
    );
    expect(content).toContain('export const FAMILY_E_DEFINITIONS');
    // MCP-021A baseline rawKeys must all still be present (no removal/rename).
    for (const baselineRawKey of [
      'causal_reasoning_present',
      'slippery_slope_reasoning_present',
      'risk_reasoning_present',
    ]) {
      expect(content).toContain(`rawKey: '${baselineRawKey}'`);
    }
  });

  // RO-12 — byte-equal boundary relaxed 2026-06-07 (MCP-BUILD2f).
  // RO-12 originally asserted familyF.ts was byte-equal to main (`git diff
  // main..HEAD` empty), proving the long-merged MCP-021B card touched no
  // Family-F definitions. As a PERMANENT test that premise is structurally
  // incompatible with the ratified MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001
  // Build-2 roadmap, which sequences family-by-family VOCABULARY EXPANSION of
  // familyF.ts (MCP-BUILD2f adds 3 critical_question booleans). Mirrors the
  // RO-7/RO-8/RO-9/RO-11 relaxation: the MCP-021B boundary is historical;
  // relaxed here to an ADDITIVE-ONLY well-formedness check so vocabulary-
  // expansion cards can grow familyF.ts without a spurious read-only-boundary
  // failure. The file must still export FAMILY_F_DEFINITIONS and retain the
  // MCP-021A baseline rawKeys (additive, never a removal/rename).
  it('RO-12 — familyF.ts is well-formed + additive (MCP-021A baseline preserved)', () => {
    const content = readFileSync(
      join(ROOT, 'src/features/nodeLabels/machineObservationDefinitions/familyF.ts'),
      'utf8',
    );
    expect(content).toContain('export const FAMILY_F_DEFINITIONS');
    // MCP-021A baseline rawKeys must all still be present (no removal/rename).
    for (const baselineRawKey of [
      'missing_warrant',
      'consequence_probability_unclear',
      'comparison_baseline_missing',
    ]) {
      expect(content).toContain(`rawKey: '${baselineRawKey}'`);
    }
  });

  // RO-13 — byte-equal boundary relaxed 2026-06-07 (MCP-BUILD2g).
  // RO-13 originally asserted familyG.ts was byte-equal to main (`git diff
  // main..HEAD` empty), proving the long-merged MCP-021B card touched no
  // Family-G definitions. As a PERMANENT test that premise is structurally
  // incompatible with the ratified MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001
  // Build-2 roadmap, which sequences family-by-family VOCABULARY EXPANSION of
  // familyG.ts (MCP-BUILD2g adds 3 resolution_progress booleans, taking the
  // mcp-server Subset 18 → 21; G is a batched family — 21 > the 20-key cap, so
  // it is served in 2 batches (16 + 5)). Mirrors the
  // RO-7/RO-8/RO-9/RO-10/RO-11/RO-12 relaxation: the MCP-021B boundary is
  // historical; relaxed here to an ADDITIVE-ONLY well-formedness check so
  // vocabulary-expansion cards can grow familyG.ts without a spurious
  // read-only-boundary failure. The file must still export FAMILY_G_DEFINITIONS
  // and retain the MCP-021A baseline rawKeys (additive, never a removal/rename).
  it('RO-13 — familyG.ts is well-formed + additive (MCP-021A baseline preserved)', () => {
    const content = readFileSync(
      join(ROOT, 'src/features/nodeLabels/machineObservationDefinitions/familyG.ts'),
      'utf8',
    );
    expect(content).toContain('export const FAMILY_G_DEFINITIONS');
    // MCP-021A baseline rawKeys must all still be present (no removal/rename).
    for (const baselineRawKey of [
      'narrows_claim',
      'concedes_narrow_point',
      'ready_for_synthesis',
    ]) {
      expect(content).toContain(`rawKey: '${baselineRawKey}'`);
    }
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
  // RO-17 — byte-equal boundary relaxed 2026-06-11 (OPS-MCP-KEY-LEVEL-FAIL-CLOSED).
  // RO-17 originally asserted mcpBooleanObservationSchema.ts was byte-equal to
  // main, proving the long-merged MCP-021B card touched no schema surface. The
  // ratified OPS-MCP-KEY-LEVEL-FAIL-CLOSED design (docs/designs/) adds the
  // OPTIONAL, ADDITIVE `keysDroppedForUncleanSpan` wire field (key names only,
  // never span content) to this file per its 10-file mirror enumeration.
  // Mirrors the RO-7..RO-13 relaxation pattern: the MCP-021B boundary is
  // historical; relaxed to an ADDITIVE-ONLY well-formedness check so the
  // designed schema-mirror change lands without a spurious read-only-boundary
  // failure. The file must still export the schema-version const, the parser,
  // the sanitizer, and the response interface (additive, never removal/rename).
  it('RO-17 — mcpBooleanObservationSchema.ts is well-formed + additive (MCP-021A baseline preserved)', () => {
    const content = readFileSync(
      join(ROOT, 'src/features/nodeLabels/mcpBooleanObservationSchema.ts'),
      'utf8',
    );
    expect(content).toContain('MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION');
    expect(content).toContain('export function parseMcpBooleanObservationResponse');
    expect(content).toContain('export function sanitizeMcpBooleanObservationResponse');
    expect(content).toContain('export interface McpBooleanObservationResponse');
    expect(content).toContain('checkedRawKeys');
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
  // RO-22 — byte-equal boundary relaxed 2026-07-05 (ASP-EXTRACT-001 Slice 2).
  // RO-22 originally asserted uxOneOneSixViewportMatrix.test.ts was byte-equal
  // to main. ASP-EXTRACT-001 Slice 2 split the ArgumentGameSurface monolith
  // into room/, so the matrix legitimately (a) repoints its Surface-6 source
  // scan to room/ArgumentRoom.tsx and (b) adds room/ArgumentRoom to the
  // Surface-17 composer-only allow-list (the observationChips banner mount
  // moved there). Mirrors the RO-25 / RO-28 relaxation: the byte-equal premise
  // is historical and incompatible with the required repoint. Relaxed to a
  // well-formedness check that the matrix still exists, still pins the
  // composer-only observationChips rule, and now tracks the room/ mount site.
  it('RO-22 — uxOneOneSixViewportMatrix.test.ts is well-formed', () => {
    const content = readFileSync(
      join(ROOT, '__tests__/uxOneOneSixViewportMatrix.test.ts'),
      'utf8',
    );
    expect(content).toContain('observationChips prop is composer-only');
    expect(content).toContain('src/features/arguments/room/ArgumentRoom');
  });

  it('RO-23 — uxOneOneSixTouchTargets.test.ts unchanged', () => {
    expect(gitDiffFromMain('__tests__/uxOneOneSixTouchTargets.test.ts')).toBe('');
  });

  it('RO-24 — uxOneOneSixColorIndependence.test.tsx unchanged', () => {
    expect(gitDiffFromMain('__tests__/uxOneOneSixColorIndependence.test.tsx')).toBe('');
  });

  // RO-25 — byte-equal boundary relaxed 2026-07-05 (ASP-EXTRACT-001 Slice 1).
  // RO-25 originally asserted uxOneOneSixReadOnlyBoundary.test.ts was byte-equal
  // to main. ASP-EXTRACT-001 legitimately adds READ_ONLY_FILES entries for the
  // new room/ seams (MapView + roomActionCodes) so those extracted files gain
  // their own read-only API pin. Mirrors the RO-28 relaxation: the byte-equal
  // premise is historical and incompatible with an additive read-only-list
  // edit. Relaxed to a well-formedness check that the boundary list still
  // exists, still pins the ArgumentGameSurface entry, and now also pins the
  // room/MapView seam.
  it('RO-25 — uxOneOneSixReadOnlyBoundary.test.ts is well-formed', () => {
    const content = readFileSync(
      join(ROOT, '__tests__/uxOneOneSixReadOnlyBoundary.test.ts'),
      'utf8',
    );
    expect(content).toContain('READ_ONLY_FILES');
    expect(content).toContain('src/features/arguments/ArgumentGameSurface.tsx');
    expect(content).toContain('src/features/arguments/room/MapView.tsx');
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
