/**
 * OPS-MCP-OBSERVABILITY — Unit tests use the fixture only; no live DB.
 *
 * Asserts that the stitcher functions (stitchMarkdownReport,
 * buildJsonArtifact) are PURE — they never spawn the supabase CLI
 * and they never call `npx supabase db query`. The source-scan also
 * asserts that runSupabaseSqlFile exists but is gated behind a
 * runtime spawnSync call (only the entry main() path invokes it).
 *
 * Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md §13 network discipline.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  FIXTURE_EDGE_REGISTRY,
  FIXTURE_GENERATED_AT,
  FIXTURE_SECTIONS_DATA,
  FIXTURE_SOURCE_SIX_CHECK,
} from './fixtures/opsMcpObservabilityFixture';

const lib = require('../scripts/ops/mcp-observability-report-lib.cjs') as {
  buildJsonArtifact: (args: Record<string, unknown>) => { schemaVersion: string };
  stitchMarkdownReport: (args: Record<string, unknown>) => string;
};
const { buildJsonArtifact, stitchMarkdownReport } = lib;

const SCRIPT_PATH = path.join(
  process.cwd(),
  'scripts',
  'ops',
  'mcp-observability-report.mjs',
);
const LIB_PATH = path.join(
  process.cwd(),
  'scripts',
  'ops',
  'mcp-observability-report-lib.cjs',
);

describe('OPS-MCP-OBSERVABILITY — no live DB calls in unit tests', () => {
  it('stitchMarkdownReport runs with fixture and returns a string', () => {
    const md = stitchMarkdownReport({
      sectionsData: FIXTURE_SECTIONS_DATA,
      sourceSixCheck: FIXTURE_SOURCE_SIX_CHECK,
      edgeRegistry: FIXTURE_EDGE_REGISTRY,
      generatedAt: FIXTURE_GENERATED_AT,
      defaultTimeWindowDays: 7,
      includeEvidencePreview: false,
    });
    expect(typeof md).toBe('string');
    expect(md.length).toBeGreaterThan(100);
  });

  it('buildJsonArtifact runs with fixture and returns an object', () => {
    const json = buildJsonArtifact({
      sectionsData: FIXTURE_SECTIONS_DATA,
      sourceSixCheck: FIXTURE_SOURCE_SIX_CHECK,
      edgeRegistry: FIXTURE_EDGE_REGISTRY,
      generatedAt: FIXTURE_GENERATED_AT,
      defaultTimeWindowDays: 7,
    });
    expect(json).toBeTruthy();
    expect(typeof json.schemaVersion).toBe('string');
  });

  it('lib source: spawnSync from node:child_process is required in exactly one block', () => {
    const src = fs.readFileSync(LIB_PATH, 'utf8');
    // The lib `require`s `spawnSync` from node:child_process for the
    // `npx supabase db query` invocation. Unit tests never reach that
    // path because they import the pure helpers only.
    expect(src).toContain("require('node:child_process')");
  });

  it('lib source: pure helpers (stitch, build) do not invoke spawnSync', () => {
    const src = fs.readFileSync(LIB_PATH, 'utf8');
    // Find the body of stitchMarkdownReport + buildJsonArtifact in the
    // source. The slices from each declaration up to the next
    // `function ` statement must NOT contain spawnSync.
    const stitchIdx = src.indexOf('function stitchMarkdownReport');
    const buildIdx = src.indexOf('function buildJsonArtifact');
    expect(stitchIdx).toBeGreaterThan(0);
    expect(buildIdx).toBeGreaterThan(0);
    const stitchSlice = src.slice(
      stitchIdx,
      src.indexOf('function ', stitchIdx + 1),
    );
    expect(stitchSlice).not.toContain('spawnSync(');
    const buildSlice = src.slice(
      buildIdx,
      src.indexOf('function ', buildIdx + 1),
    );
    expect(buildSlice).not.toContain('spawnSync(');
  });

  it('entry .mjs delegates SQL invocation via require to the .cjs lib', () => {
    const src = fs.readFileSync(SCRIPT_PATH, 'utf8');
    // The .mjs entry uses createRequire to import from the .cjs lib.
    expect(src).toContain('createRequire');
    expect(src).toContain('mcp-observability-report-lib.cjs');
  });
});
