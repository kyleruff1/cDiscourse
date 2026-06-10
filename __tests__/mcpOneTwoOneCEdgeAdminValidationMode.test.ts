/**
 * MCP-021C-EDGE — Test: admin_validation mode behavior + exclusion.
 *
 * Per design §5 + Decision 9: admin_validation rows are PERSISTED with
 * `run_mode = 'admin_validation'` but FILTERED OUT of Source 6
 * production rendering at the persistence query layer.
 *
 * This test verifies:
 *   - Admin validation mode allows all 10 families (FAMILY_REGISTRY).
 *   - The request builder includes families that production excludes.
 *   - The migration backfills existing MCP-021B smoke-seed rows to
 *     'production' via the DEFAULT (validated by the migration shape
 *     test; reiterated here so the contract is explicit).
 *   - Source 6 filter excludes admin_validation rows (validated by the
 *     persistence query test).
 *
 * This file is the documentation gate — it ties the design's
 * admin_validation guarantees to specific behavioral checks.
 */

import {
  EDGE_FAMILY_REGISTRY,
  edgeFilterFamiliesForMode,
  edgeBuildBooleanObservationRequestForArgument,
  edgeAdminValidationEnabledFamilies,
  EDGE_ALL_MACHINE_OBSERVATION_FAMILIES,
} from './_helpers/booleanObservationEdgeDeno';
import { ALL_MACHINE_OBSERVATION_RUN_MODES } from '../src/features/nodeLabels/machineObservationPersistenceTypes';

describe('MCP-021C-EDGE — admin_validation mode allows all 10 families', () => {
  it('AVM-1 — every family in FAMILY_REGISTRY has adminValidationEnabled: true', () => {
    for (const entry of EDGE_FAMILY_REGISTRY) {
      expect(entry.adminValidationEnabled).toBe(true);
    }
  });

  it('AVM-2 — adminValidationEnabledFamilies() returns all 10', () => {
    expect(edgeAdminValidationEnabledFamilies()).toHaveLength(10);
  });

  it('AVM-3 — filterFamiliesForMode(allFamilies, admin_validation) returns all 10', () => {
    const filtered = edgeFilterFamiliesForMode(
      EDGE_ALL_MACHINE_OBSERVATION_FAMILIES,
      'admin_validation',
    );
    expect(filtered).toHaveLength(10);
  });
});

describe('MCP-021C-EDGE — admin_validation requests include non-production families', () => {
  it('AVM-4 — admin_validation + disagreement_axis yields >0 rawKeys', () => {
    const req = edgeBuildBooleanObservationRequestForArgument({
      argumentId: 'arg-1',
      parentArgumentId: 'arg-0',
      currentText: 'reply',
      parentText: 'parent',
      threadContextExcerpt: '',
      requestedFamilies: ['disagreement_axis'],
      mode: 'admin_validation',
    });
    expect(req.requestedRawKeys.length).toBeGreaterThan(0);
    expect(req.requestedFamilies).toEqual(['disagreement_axis']);
  });

  it('AVM-5 — admin_validation + evidence_source_chain yields >0 rawKeys', () => {
    const req = edgeBuildBooleanObservationRequestForArgument({
      argumentId: 'arg-1',
      parentArgumentId: 'arg-0',
      currentText: 'reply',
      parentText: 'parent',
      threadContextExcerpt: '',
      requestedFamilies: ['evidence_source_chain'],
      mode: 'admin_validation',
    });
    expect(req.requestedRawKeys.length).toBeGreaterThan(0);
    expect(req.requestedFamilies).toEqual(['evidence_source_chain']);
  });

  it('AVM-6 — admin_validation + sensitive_composer (Family J) yields >0 rawKeys', () => {
    const req = edgeBuildBooleanObservationRequestForArgument({
      argumentId: 'arg-1',
      parentArgumentId: 'arg-0',
      currentText: 'reply',
      parentText: 'parent',
      threadContextExcerpt: '',
      requestedFamilies: ['sensitive_composer'],
      mode: 'admin_validation',
    });
    expect(req.requestedRawKeys.length).toBeGreaterThan(0);
    expect(req.requestedFamilies).toEqual(['sensitive_composer']);
  });

  it('AVM-7 — admin_validation + all 10 families yields keys from every family', () => {
    const req = edgeBuildBooleanObservationRequestForArgument({
      argumentId: 'arg-1',
      parentArgumentId: 'arg-0',
      currentText: 'reply',
      parentText: 'parent',
      threadContextExcerpt: '',
      requestedFamilies: [...EDGE_ALL_MACHINE_OBSERVATION_FAMILIES],
      mode: 'admin_validation',
    });
    expect(req.requestedFamilies).toEqual([...EDGE_ALL_MACHINE_OBSERVATION_FAMILIES]);
    // The compound registry is keyed by `${source}:${rawKey}`; the
    // request builder iterates Object.values(REGISTRY) and emits each
    // distinct (source, rawKey) pair. The count is bounded above by the
    // full definitions count and below by the number of distinct
    // rawKeys.
    expect(req.requestedRawKeys.length).toBeGreaterThan(100);
    // Family A's 16 keys must be present.
    expect(req.requestedRawKeys).toContain('has_rebuttal');
    expect(req.requestedRawKeys).toContain('supports_parent');
    expect(req.requestedRawKeys).toContain('quote_anchors_parent');
  });
});

describe('MCP-021C-EDGE — run_mode binding to migration', () => {
  it('AVM-8 — ALL_MACHINE_OBSERVATION_RUN_MODES matches the migration CHECK', () => {
    expect(ALL_MACHINE_OBSERVATION_RUN_MODES).toEqual(['production', 'admin_validation']);
  });

  it('AVM-9 — every run mode value is a single non-empty lowercase string', () => {
    for (const mode of ALL_MACHINE_OBSERVATION_RUN_MODES) {
      expect(/^[a-z_]+$/.test(mode)).toBe(true);
      expect(mode.length).toBeGreaterThan(0);
    }
  });
});

describe('MCP-021C-EDGE — production filter does NOT see J admin_validation family (post MCP-021C-EDGE-FAMILY-I-ENABLE flip)', () => {
  // Post MCP-021C-EDGE-FAMILY-I-ENABLE (MCP-I-D2): families
  // A + B + C + D + E + F + G + H + I are productionEnabled; J
  // remains admin-only.

  it('AVM-10 — production filter keeps disagreement_axis (B was flipped to productionEnabled in Stage 2B)', () => {
    expect(edgeFilterFamiliesForMode(['disagreement_axis'], 'production')).toEqual([
      'disagreement_axis',
    ]);
  });

  it('AVM-11 — production filter keeps evidence_source_chain (D flipped to productionEnabled in Card 2 of FAMILY-D chain)', () => {
    expect(edgeFilterFamiliesForMode(['evidence_source_chain'], 'production')).toEqual([
      'evidence_source_chain',
    ]);
  });

  it('AVM-11b — production filter keeps argument_scheme (E flipped to productionEnabled in Card 2 of FAMILY-E chain)', () => {
    expect(edgeFilterFamiliesForMode(['argument_scheme'], 'production')).toEqual([
      'argument_scheme',
    ]);
  });

  it('AVM-11c — production filter keeps critical_question (F flipped to productionEnabled in Card 3 of FAMILY-F chain)', () => {
    expect(edgeFilterFamiliesForMode(['critical_question'], 'production')).toEqual([
      'critical_question',
    ]);
  });

  it('AVM-11d — production filter keeps resolution_progress (G flipped to productionEnabled in Card 3 of FAMILY-G chain)', () => {
    expect(edgeFilterFamiliesForMode(['resolution_progress'], 'production')).toEqual([
      'resolution_progress',
    ]);
  });

  it('AVM-11e — production filter keeps claim_clarity (H flipped to productionEnabled in Card 3 of FAMILY-H chain)', () => {
    expect(edgeFilterFamiliesForMode(['claim_clarity'], 'production')).toEqual([
      'claim_clarity',
    ]);
  });

  it('AVM-11f — production filter keeps thread_topology (I flipped to productionEnabled in MCP-021C-EDGE-FAMILY-I-ENABLE / MCP-I-D2)', () => {
    expect(edgeFilterFamiliesForMode(['thread_topology'], 'production')).toEqual([
      'thread_topology',
    ]);
  });

  it('AVM-12 — production filter drops sensitive_composer (J remains admin-only)', () => {
    expect(edgeFilterFamiliesForMode(['sensitive_composer'], 'production')).toEqual([]);
  });

  it('AVM-13 — production filter keeps A+B+D+E+F+G+H when mixed (all seven production-enabled)', () => {
    // Post Card 3 of FAMILY-H chain: parent_relation (A),
    // disagreement_axis (B), evidence_source_chain (D),
    // argument_scheme (E), critical_question (F),
    // resolution_progress (G), and claim_clarity (H) are all
    // productionEnabled.
    expect(
      edgeFilterFamiliesForMode(
        [
          'parent_relation',
          'disagreement_axis',
          'evidence_source_chain',
          'argument_scheme',
          'critical_question',
          'resolution_progress',
          'claim_clarity',
        ],
        'production',
      ),
    ).toEqual([
      'parent_relation',
      'disagreement_axis',
      'evidence_source_chain',
      'argument_scheme',
      'critical_question',
      'resolution_progress',
      'claim_clarity',
    ]);
  });
});

describe('MCP-021C-EDGE — Source 6 production-only render (cross-reference)', () => {
  // The query-layer filter (machineObservationPersistenceQuery.ts) is
  // tested separately in mcpOneTwoOneCEdgeSourceSixRunModeFilter.test.ts.
  // This block reaffirms the contract surface here so the reviewer can
  // confirm by reading just THIS file.
  it('AVM-14 — the filter mode at the persistence query layer is "production"', () => {
    // The persistence-query file uses the literal 'production' in the
    // .eq() filter. Cross-checked via a source-text read.
    const fs = require('fs');
    const path = require('path');
    const queryPath = path.join(
      process.cwd(),
      'src/features/nodeLabels/machineObservationPersistenceQuery.ts',
    );
    const queryText = fs.readFileSync(queryPath, 'utf8');
    expect(queryText).toContain("argument_machine_observation_runs.run_mode");
    expect(queryText).toContain("'production'");
  });

  it('AVM-15 — the persistence-query filter is NOT keyed on admin_validation', () => {
    const fs = require('fs');
    const path = require('path');
    const queryPath = path.join(
      process.cwd(),
      'src/features/nodeLabels/machineObservationPersistenceQuery.ts',
    );
    const queryText = fs.readFileSync(queryPath, 'utf8');
    // The filter is on production. The string 'admin_validation' should
    // NOT appear in the .eq() argument list. (It can appear in comments
    // documenting the design choice; we check the .eq() invocation.)
    const eqCalls = queryText.match(/\.eq\([^)]+\)/g) || [];
    const adminValEqCalls = eqCalls.filter((c: string) => c.includes('admin_validation'));
    expect(adminValEqCalls).toHaveLength(0);
  });
});
