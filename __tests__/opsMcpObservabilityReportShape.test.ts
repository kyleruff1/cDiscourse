/**
 * OPS-MCP-OBSERVABILITY — Report shape tests.
 *
 * Verifies that the stitched markdown + JSON artifact contains every
 * required section, in the expected order, with the correct anchor
 * ids. The fixture drives the stitcher without any live DB call.
 *
 * Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md §5 + §6.
 * Doctrine: aggregates only; no body content; no banned tokens.
 */
const lib = require('../scripts/ops/mcp-observability-report-lib.cjs') as {
  SECTIONS: ReadonlyArray<{
    id: string;
    title: string;
    question: string;
    sqlFile: string;
    columns: readonly string[];
    emptyMessage: string;
  }>;
  stitchMarkdownReport: (args: Record<string, unknown>) => string;
  buildJsonArtifact: (args: Record<string, unknown>) => {
    schemaVersion: string;
    generatedAt: string;
    source: string;
    defaultTimeWindowDays: number;
    sourceSixSafety: {
      literalProductionStringPresent: boolean;
      literalAdminValidationStringAbsent: boolean;
      filePathChecked: string;
    };
    sections: Array<{
      id: string;
      title: string;
      sqlFile: string;
      columns: string[];
      rows: ReadonlyArray<Record<string, unknown>>;
    }>;
  };
};
const { SECTIONS, stitchMarkdownReport, buildJsonArtifact } = lib;
import {
  FIXTURE_EDGE_REGISTRY,
  FIXTURE_GENERATED_AT,
  FIXTURE_SECTIONS_DATA,
  FIXTURE_SOURCE_SIX_CHECK,
} from './fixtures/opsMcpObservabilityFixture';

describe('OPS-MCP-OBSERVABILITY — report shape', () => {
  const baseStitchArgs = {
    sectionsData: FIXTURE_SECTIONS_DATA,
    sourceSixCheck: FIXTURE_SOURCE_SIX_CHECK,
    edgeRegistry: FIXTURE_EDGE_REGISTRY,
    generatedAt: FIXTURE_GENERATED_AT,
    defaultTimeWindowDays: 7,
    includeEvidencePreview: false,
  };

  it('exposes exactly 14 sections (Q1, Q2a, Q2b, Q3-Q13)', () => {
    expect(SECTIONS).toHaveLength(14);
  });

  it('section ids are stable anchors q01...q13 plus q02b', () => {
    const ids = SECTIONS.map((s) => s.id);
    expect(ids).toEqual([
      'q01-runs-by-run-mode',
      'q02-runs-by-family',
      'q02b-runs-by-requested-family',
      'q03-runs-by-family-and-status',
      'q04-failure-reasons-by-family',
      'q05-positive-results-by-family',
      'q06-top-positive-raw-keys-by-family',
      'q07-positive-density-7d',
      'q08-source-six-safety',
      'q09-duplicate-runs',
      'q10-family-a-auto-trigger-recent',
      'q11-family-bc-admin-validation-check',
      'q12-unsupported-family-attempts',
      'q13-over-under-firing-summary',
    ]);
  });

  it('each section has a non-empty title, question, sqlFile, and columns', () => {
    for (const s of SECTIONS) {
      expect(typeof s.title).toBe('string');
      expect(s.title.length).toBeGreaterThan(0);
      expect(typeof s.question).toBe('string');
      expect(s.question.length).toBeGreaterThan(0);
      expect(typeof s.sqlFile).toBe('string');
      expect(s.sqlFile.endsWith('.sql')).toBe(true);
      expect(Array.isArray(s.columns)).toBe(true);
      expect(s.columns.length).toBeGreaterThan(0);
      expect(typeof s.emptyMessage).toBe('string');
      expect(s.emptyMessage.length).toBeGreaterThan(0);
    }
  });

  it('renders a top-level title and metadata header', () => {
    const md = stitchMarkdownReport(baseStitchArgs);
    expect(md.startsWith('# OPS-MCP-OBSERVABILITY')).toBe(true);
    expect(md).toContain(`**Generated:** ${FIXTURE_GENERATED_AT}`);
    expect(md).toContain('**Schema version:** ops-mcp-observability.report.v1');
  });

  it('includes a Table of contents block with all 14 section links', () => {
    const md = stitchMarkdownReport(baseStitchArgs);
    expect(md).toContain('## Table of contents');
    for (const s of SECTIONS) {
      expect(md).toContain(`(#${s.id})`);
    }
  });

  it('emits anchor span for every section', () => {
    const md = stitchMarkdownReport(baseStitchArgs);
    for (const s of SECTIONS) {
      expect(md).toContain(`<a id="${s.id}"></a>`);
    }
  });

  it('renders each section heading using the section title', () => {
    const md = stitchMarkdownReport(baseStitchArgs);
    for (const s of SECTIONS) {
      expect(md).toContain(`## ${s.title}`);
    }
  });

  it('renders a Source 6 safety summary section', () => {
    const md = stitchMarkdownReport(baseStitchArgs);
    expect(md).toContain('## Source 6 safety summary');
    expect(md).toContain('Source 6 production filter present: YES');
    expect(md).toContain(
      'admin_validation substring absent from Source 6 module: YES',
    );
  });

  it('renders Appendix A — Family registry snapshot when registry is parsed', () => {
    const md = stitchMarkdownReport(baseStitchArgs);
    expect(md).toContain('## Appendix A — Family registry snapshot');
    expect(md).toContain('parent_relation');
  });

  it('renders Appendix B — Doctrine scan note', () => {
    const md = stitchMarkdownReport(baseStitchArgs);
    expect(md).toContain('## Appendix B — Doctrine scan');
    expect(md).toContain('Source 6 filter literal present: YES');
    expect(md).toContain('Evidence span preview included: NO');
  });

  it('renders evidence-preview YES note when includeEvidencePreview is on', () => {
    const md = stitchMarkdownReport({
      ...baseStitchArgs,
      includeEvidencePreview: true,
    });
    expect(md).toContain('Evidence span preview included: YES');
  });

  it('JSON artifact has the expected top-level schema fields', () => {
    const json = buildJsonArtifact(baseStitchArgs);
    expect(json.schemaVersion).toBe('ops-mcp-observability.report.v1');
    expect(json.generatedAt).toBe(FIXTURE_GENERATED_AT);
    expect(json.source).toBe('linked-supabase');
    expect(json.defaultTimeWindowDays).toBe(7);
    expect(json.sourceSixSafety.literalProductionStringPresent).toBe(true);
    expect(json.sourceSixSafety.literalAdminValidationStringAbsent).toBe(true);
    expect(Array.isArray(json.sections)).toBe(true);
    expect(json.sections).toHaveLength(14);
  });

  it('JSON artifact preserves section column order and ids', () => {
    const json = buildJsonArtifact(baseStitchArgs);
    SECTIONS.forEach((s, idx) => {
      const sec = json.sections[idx];
      expect(sec.id).toBe(s.id);
      expect(sec.columns).toEqual(s.columns);
      expect(sec.sqlFile).toBe(`scripts/ops/sql/${s.sqlFile}`);
    });
  });
});
