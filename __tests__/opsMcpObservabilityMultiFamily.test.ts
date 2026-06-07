/**
 * OPS-MCP-OBSERVABILITY — Multi-family aggregation test.
 *
 * Drives the stitcher with a fixture that covers all 3 families
 * (parent_relation, disagreement_axis, misunderstanding_repair) and
 * asserts:
 *   - Each family appears in the populated sections.
 *   - Q2 (positive-firing) and Q2b (all attempts) reconcile (Q2
 *     count <= Q2b count per family).
 *   - The registry snapshot in Appendix A names all 3 families.
 *   - The reported raw_keys reflect the registered taxonomy.
 *
 * Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md §test-plan T11.
 * Doctrine: aggregations group by family; no verdict applied to any family.
 */
import {
  FIXTURE_EDGE_REGISTRY,
  FIXTURE_GENERATED_AT,
  FIXTURE_SECTIONS_DATA,
  FIXTURE_SOURCE_SIX_CHECK,
} from './fixtures/opsMcpObservabilityFixture';

const lib = require('../scripts/ops/mcp-observability-report-lib.cjs') as {
  stitchMarkdownReport: (args: Record<string, unknown>) => string;
  buildJsonArtifact: (args: Record<string, unknown>) => {
    sections: Array<{
      id: string;
      rows: ReadonlyArray<Record<string, unknown>>;
    }>;
    familyRegistrySnapshot: {
      productionEnabled: string[];
      adminValidationEnabled: string[];
    } | null;
  };
};
const { stitchMarkdownReport, buildJsonArtifact } = lib;

describe('OPS-MCP-OBSERVABILITY — multi-family aggregation', () => {
  const baseArgs = {
    sectionsData: FIXTURE_SECTIONS_DATA,
    sourceSixCheck: FIXTURE_SOURCE_SIX_CHECK,
    edgeRegistry: FIXTURE_EDGE_REGISTRY,
    generatedAt: FIXTURE_GENERATED_AT,
    defaultTimeWindowDays: 7,
    includeEvidencePreview: false,
  };

  it('markdown report mentions all 3 production-supported family ids', () => {
    const md = stitchMarkdownReport(baseArgs);
    expect(md).toContain('parent_relation');
    expect(md).toContain('disagreement_axis');
    expect(md).toContain('misunderstanding_repair');
  });

  it('Q5 positive-results section includes all 3 families', () => {
    const json = buildJsonArtifact(baseArgs);
    const q5 = json.sections.find((s) => s.id === 'q05-positive-results-by-family');
    expect(q5).toBeDefined();
    const families = (q5?.rows ?? []).map((r) => r.family);
    expect(families).toEqual(
      expect.arrayContaining([
        'parent_relation',
        'disagreement_axis',
        'misunderstanding_repair',
      ]),
    );
  });

  it('Q2 positive-firing count is <= Q2b total-attempts count per family', () => {
    const json = buildJsonArtifact(baseArgs);
    const q2 = json.sections.find((s) => s.id === 'q02-runs-by-family');
    const q2b = json.sections.find(
      (s) => s.id === 'q02b-runs-by-requested-family',
    );
    expect(q2).toBeDefined();
    expect(q2b).toBeDefined();
    // Index Q2b by (family, run_mode) -> total_runs
    const q2bIndex: Record<string, number> = {};
    for (const row of q2b!.rows) {
      const key = `${row.requested_family}|${row.run_mode}`;
      q2bIndex[key] = Number(row.total_runs);
    }
    for (const row of q2!.rows) {
      const key = `${row.family}|${row.run_mode}`;
      const positiveFiring = Number(row.runs_with_positives);
      const totalAttempts = q2bIndex[key];
      expect(totalAttempts).toBeGreaterThanOrEqual(positiveFiring);
    }
  });

  it('Q11 (per-family per-mode coverage) surfaces all four families with status breakdown', () => {
    const json = buildJsonArtifact(baseArgs);
    const q11 = json.sections.find(
      (s) => s.id === 'q11-per-family-per-mode-coverage',
    );
    expect(q11).toBeDefined();
    expect(q11!.rows.length).toBeGreaterThan(0);
    // Reframed Q11 surfaces all 4 supported families (A+B+C+D), and the
    // 6-column shape carries the status breakdown.
    const families = new Set(q11!.rows.map((r) => String(r.requested_family)));
    expect(families.has('parent_relation')).toBe(true);
    expect(families.has('disagreement_axis')).toBe(true);
    expect(families.has('misunderstanding_repair')).toBe(true);
    expect(families.has('evidence_source_chain')).toBe(true);
    for (const row of q11!.rows) {
      // The 4 status columns reconcile with run_count.
      const runCount = Number(row.run_count);
      const success = Number(row.success_count);
      const failed = Number(row.failed_count);
      const fallback = Number(row.fallback_count);
      expect(success + failed + fallback).toBe(runCount);
    }
  });

  it('Q11 reframed: B+C admin_validation rows are still present (preservation property)', () => {
    const json = buildJsonArtifact(baseArgs);
    const q11 = json.sections.find(
      (s) => s.id === 'q11-per-family-per-mode-coverage',
    );
    expect(q11).toBeDefined();
    // Filter to the original Q11 shape (B+C admin_validation) and verify
    // success_count is present and non-zero for these rows.
    const preservation = q11!.rows.filter(
      (r) =>
        (r.requested_family === 'disagreement_axis' ||
          r.requested_family === 'misunderstanding_repair') &&
        r.run_mode === 'admin_validation',
    );
    expect(preservation.length).toBeGreaterThan(0);
    for (const row of preservation) {
      expect(Number(row.success_count)).toBeGreaterThan(0);
    }
  });

  it('Q11 reframed: Family D admin_validation row is visible (4-family extension)', () => {
    const json = buildJsonArtifact(baseArgs);
    const q11 = json.sections.find(
      (s) => s.id === 'q11-per-family-per-mode-coverage',
    );
    expect(q11).toBeDefined();
    const familyDRow = q11!.rows.find(
      (r) =>
        r.requested_family === 'evidence_source_chain' &&
        r.run_mode === 'admin_validation',
    );
    expect(familyDRow).toBeDefined();
  });

  it('Q14 (signal density) surfaces all four supported families with hardcoded key counts', () => {
    const json = buildJsonArtifact(baseArgs);
    const q14 = json.sections.find(
      (s) => s.id === 'q14-per-family-per-mode-signal-density',
    );
    expect(q14).toBeDefined();
    const keyCountByFamily: Record<string, number> = {};
    for (const row of q14!.rows) {
      keyCountByFamily[String(row.family)] = Number(row.family_key_count);
    }
    expect(keyCountByFamily.parent_relation).toBe(19); // MCP-BUILD2b: 16 → 19
    expect(keyCountByFamily.disagreement_axis).toBe(17); // MCP-BUILD2a: 14 → 17
    expect(keyCountByFamily.misunderstanding_repair).toBe(20); // MCP-BUILD2c: 17 → 20
    expect(keyCountByFamily.evidence_source_chain).toBe(19);
  });

  it('Q15 (Family D subset coverage) — observed raw_keys are all in the ai_classifier_subset bucket', () => {
    const json = buildJsonArtifact(baseArgs);
    const q15 = json.sections.find(
      (s) => s.id === 'q15-family-d-subset-coverage',
    );
    expect(q15).toBeDefined();
    expect(q15!.rows.length).toBeGreaterThan(0);
    for (const row of q15!.rows) {
      // Live observed Family D keys must all classify into the subset.
      // Any leak (deterministic_excluded_leak) is a defect surface, not
      // an expected fixture state.
      expect(row.subset_membership).toBe('ai_classifier_subset');
    }
  });

  it('Q12 (unsupported families) — positives_observed is 0 for every unsupported family', () => {
    const json = buildJsonArtifact(baseArgs);
    const q12 = json.sections.find(
      (s) => s.id === 'q12-unsupported-family-attempts',
    );
    expect(q12).toBeDefined();
    expect(q12!.rows.length).toBeGreaterThan(0);
    for (const row of q12!.rows) {
      expect(Number(row.positives_observed)).toBe(0);
    }
  });

  it('familyRegistrySnapshot lists parent_relation only in productionEnabled', () => {
    const json = buildJsonArtifact(baseArgs);
    expect(json.familyRegistrySnapshot).toBeTruthy();
    expect(json.familyRegistrySnapshot?.productionEnabled).toEqual(['parent_relation']);
    expect(json.familyRegistrySnapshot?.adminValidationEnabled).toEqual(
      expect.arrayContaining([
        'parent_relation',
        'disagreement_axis',
        'misunderstanding_repair',
      ]),
    );
  });

  it('Q6 raw_keys for Family A are valid registered keys', () => {
    const json = buildJsonArtifact(baseArgs);
    const q6 = json.sections.find(
      (s) => s.id === 'q06-top-positive-raw-keys-by-family',
    );
    expect(q6).toBeDefined();
    // A subset of the 16 Family A keys (parent_relation) — must come
    // from this set. The fixture uses two: supports_parent, challenges_parent,
    // has_rebuttal. Verify by intersection.
    const familyAFixtureKeys = (q6?.rows ?? [])
      .filter((r) => r.family === 'parent_relation')
      .map((r) => String(r.raw_key));
    const VALID_FAMILY_A = new Set([
      'supports_parent',
      'challenges_parent',
      'refines_parent',
      'extends_parent',
      'distinguishes_parent',
      'reframes_parent',
      'questions_parent',
      'summarizes_parent',
      'acknowledges_parent',
      'corrects_parent_detail',
      'contrasts_with_parent',
      'answers_parent_question',
      'has_rebuttal',
      'has_counter_rebuttal',
      'rebutted',
      'quote_anchors_parent',
    ]);
    for (const key of familyAFixtureKeys) {
      expect(VALID_FAMILY_A.has(key)).toBe(true);
    }
  });

  it('Q13 over/under-firing summary has rows for each of the 3 families', () => {
    const json = buildJsonArtifact(baseArgs);
    const q13 = json.sections.find(
      (s) => s.id === 'q13-over-under-firing-summary',
    );
    expect(q13).toBeDefined();
    const familiesInQ13 = new Set(
      (q13?.rows ?? []).map((r) => String(r.family)),
    );
    expect(familiesInQ13.has('parent_relation')).toBe(true);
    expect(familiesInQ13.has('disagreement_axis')).toBe(true);
    expect(familiesInQ13.has('misunderstanding_repair')).toBe(true);
  });
});
