/**
 * OPS-MCP-OBSERVABILITY — Empty-DB safety test.
 *
 * Drives the stitcher with `rows: []` for every section and asserts:
 *   - The markdown report contains all 14 section headings.
 *   - Each section emits its `emptyMessage` line.
 *   - No `NaN`, `undefined`, or unhandled-promise output appears.
 *   - The JSON artifact has `sections[i].rows: []` for each section.
 *
 * Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md §test-plan T10.
 * Doctrine: report must surface absence of data explicitly; never
 * fail silently.
 */
import {
  FIXTURE_EDGE_REGISTRY,
  FIXTURE_EMPTY_SECTIONS_DATA,
  FIXTURE_GENERATED_AT,
  FIXTURE_SOURCE_SIX_CHECK,
} from './fixtures/opsMcpObservabilityFixture';

const lib = require('../scripts/ops/mcp-observability-report-lib.cjs') as {
  SECTIONS: ReadonlyArray<{
    id: string;
    title: string;
    emptyMessage: string;
  }>;
  stitchMarkdownReport: (args: Record<string, unknown>) => string;
  buildJsonArtifact: (args: Record<string, unknown>) => {
    sections: Array<{ id: string; rows: ReadonlyArray<Record<string, unknown>> }>;
  };
};
const { SECTIONS, stitchMarkdownReport, buildJsonArtifact } = lib;

describe('OPS-MCP-OBSERVABILITY — empty-DB safety', () => {
  const baseArgs = {
    sectionsData: FIXTURE_EMPTY_SECTIONS_DATA,
    sourceSixCheck: FIXTURE_SOURCE_SIX_CHECK,
    edgeRegistry: FIXTURE_EDGE_REGISTRY,
    generatedAt: FIXTURE_GENERATED_AT,
    defaultTimeWindowDays: 7,
    includeEvidencePreview: false,
  };

  it('produces a non-empty markdown string with empty fixture', () => {
    const md = stitchMarkdownReport(baseArgs);
    expect(typeof md).toBe('string');
    expect(md.length).toBeGreaterThan(100);
  });

  it('markdown contains all 14 section titles even when every section is empty', () => {
    const md = stitchMarkdownReport(baseArgs);
    for (const s of SECTIONS) {
      expect(md).toContain(`## ${s.title}`);
    }
  });

  it('markdown contains every section emptyMessage', () => {
    const md = stitchMarkdownReport(baseArgs);
    for (const s of SECTIONS) {
      expect(md).toContain(s.emptyMessage);
    }
  });

  it('markdown contains no literal "NaN"', () => {
    const md = stitchMarkdownReport(baseArgs);
    expect(md).not.toMatch(/\bNaN\b/);
  });

  it('markdown contains no literal "undefined"', () => {
    const md = stitchMarkdownReport(baseArgs);
    expect(md).not.toContain('undefined');
  });

  it('markdown does not surface raw null table cells (escaped to em-dash)', () => {
    const md = stitchMarkdownReport(baseArgs);
    // The empty fixture means no table rows are rendered, so this is
    // trivially true. Still — confirm no table cell with `| null |`
    // exists (the escapeMd helper replaces nulls with em-dashes).
    expect(md).not.toMatch(/\|\s*null\s*\|/);
    // The word "null" MAY legitimately appear in narrative (e.g.,
    // "non-null failure_reason" in an emptyMessage); we only ban it
    // from cells.
  });

  it('JSON artifact has empty arrays (not null) for every section rows field', () => {
    const json = buildJsonArtifact(baseArgs);
    for (const s of json.sections) {
      expect(Array.isArray(s.rows)).toBe(true);
      expect(s.rows.length).toBe(0);
    }
  });

  it('JSON artifact still has 14 sections even when all are empty', () => {
    const json = buildJsonArtifact(baseArgs);
    expect(json.sections.length).toBe(14);
  });
});
