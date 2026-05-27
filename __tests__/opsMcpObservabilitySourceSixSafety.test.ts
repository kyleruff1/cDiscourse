/**
 * OPS-MCP-OBSERVABILITY — Source 6 binding constraint preservation test.
 *
 * Re-reads `src/features/nodeLabels/machineObservationPersistenceQuery.ts`
 * from disk and asserts:
 *   - The literal `.eq('argument_machine_observation_runs.run_mode', 'production')`
 *     substring is PRESENT.
 *   - The literal `'admin_validation'` substring is ABSENT from the file.
 *
 * This is the script-side counterpart to
 * `__tests__/mcpOneTwoOneCEdgeSourceSixRunModeFilter.test.ts` (the 11
 * S6F-* tests that pin the line 127 filter). Those tests are NOT
 * modified by this card and remain byte-equal.
 *
 * Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md §source-six.
 * Doctrine: cdiscourse-doctrine §1, §10a — production rendering must
 * never include admin_validation rows.
 */
import * as fs from 'fs';
import * as path from 'path';

const lib = require('../scripts/ops/mcp-observability-report-lib.cjs') as {
  SOURCE_SIX_PATH: string;
  SOURCE_SIX_LITERAL_FRAGMENT_A: string;
  SOURCE_SIX_LITERAL_FRAGMENT_B: string;
  checkSourceSixFilter: (
    repoRoot: string,
  ) => {
    ok: boolean;
    present: boolean;
    adminPresent: boolean;
    filePath: string;
    reason?: string;
  };
};

const {
  SOURCE_SIX_PATH,
  SOURCE_SIX_LITERAL_FRAGMENT_A,
  SOURCE_SIX_LITERAL_FRAGMENT_B,
  checkSourceSixFilter,
} = lib;

const REPO = process.cwd();
const ABS_PATH = path.join(REPO, SOURCE_SIX_PATH);

describe('OPS-MCP-OBSERVABILITY — Source 6 safety', () => {
  it('SOURCE_SIX_PATH points to the canonical persistence-query module', () => {
    expect(SOURCE_SIX_PATH).toBe(
      path.join(
        'src',
        'features',
        'nodeLabels',
        'machineObservationPersistenceQuery.ts',
      ),
    );
  });

  it('the literal fragments concatenate to the canonical filter substring', () => {
    const literal = SOURCE_SIX_LITERAL_FRAGMENT_A + SOURCE_SIX_LITERAL_FRAGMENT_B;
    // The canonical literal is built from fragments so this test file
    // itself does not carry the contiguous string.
    expect(literal.includes('argument_machine_observation_runs.run_mode')).toBe(
      true,
    );
    expect(literal.includes("'production'")).toBe(true);
    expect(literal.startsWith('.eq(')).toBe(true);
  });

  it('the Source 6 module exists at the expected path', () => {
    expect(fs.existsSync(ABS_PATH)).toBe(true);
  });

  it('the Source 6 module contains the literal `production` filter', () => {
    const src = fs.readFileSync(ABS_PATH, 'utf8');
    const literal = SOURCE_SIX_LITERAL_FRAGMENT_A + SOURCE_SIX_LITERAL_FRAGMENT_B;
    expect(src).toContain(literal);
  });

  it('the Source 6 module does not contain the `admin_validation` literal', () => {
    const src = fs.readFileSync(ABS_PATH, 'utf8');
    // The persistence query MUST NOT filter by 'admin_validation' —
    // admin-validation rows are excluded from production rendering by
    // the production-only filter, not by an explicit exclusion.
    expect(src).not.toContain("'admin_validation'");
  });

  it('checkSourceSixFilter returns ok=true against the live file', () => {
    const result = checkSourceSixFilter(REPO);
    expect(result.ok).toBe(true);
    expect(result.present).toBe(true);
    expect(result.adminPresent).toBe(false);
    expect(result.filePath).toBe(ABS_PATH);
  });

  it('checkSourceSixFilter returns ok=false when the file is missing', () => {
    const fakeRepo = path.join(REPO, '__no_such_dir__');
    const result = checkSourceSixFilter(fakeRepo);
    expect(result.ok).toBe(false);
    expect(result.present).toBe(false);
    expect(result.reason).toBe('source-six-file-missing');
  });

  it('the production filter line is on the expected line (line 127 +/- minor drift tolerance)', () => {
    const src = fs.readFileSync(ABS_PATH, 'utf8');
    const lines = src.split(/\r?\n/);
    const literal = SOURCE_SIX_LITERAL_FRAGMENT_A + SOURCE_SIX_LITERAL_FRAGMENT_B;
    // Find the literal in the file; assert the line number is in
    // the documented range (line 127 in the original; the design
    // tolerates +/-5 lines for minor formatting drift without
    // re-doing this whole test).
    const lineIdx = lines.findIndex((l) => l.includes(literal));
    expect(lineIdx).toBeGreaterThanOrEqual(0);
    expect(lineIdx).toBeGreaterThan(120);
    expect(lineIdx).toBeLessThan(140);
  });
});
