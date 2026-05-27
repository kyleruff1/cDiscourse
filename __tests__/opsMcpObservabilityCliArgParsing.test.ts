/**
 * OPS-MCP-OBSERVABILITY — CLI argument parsing test.
 *
 * Tests the pure `parseCliArgs` function covering every flag and
 * exit-code path:
 *   - Defaults
 *   - --out-dir
 *   - --time-window-days (positive int, range guard)
 *   - --include-argument-detail
 *   - --include-evidence-preview
 *   - --json-only
 *   - --no-write
 *   - --help
 *   - Unknown flag (error)
 *   - Missing required value (error)
 *
 * Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md §CLI surface.
 * Doctrine: argv parsing is pure; no side-effects.
 */
const lib = require('../scripts/ops/mcp-observability-report-lib.cjs') as {
  parseCliArgs: (argv: unknown) => {
    ok: boolean;
    options?: {
      outDir: string | null;
      timeWindowDays: number;
      includeArgumentDetail: boolean;
      includeEvidencePreview: boolean;
      jsonOnly: boolean;
      noWrite: boolean;
      help: boolean;
    };
    error?: string;
  };
  helpText: () => string;
  DEFAULTS: {
    outDir: string | null;
    timeWindowDays: number;
    includeArgumentDetail: boolean;
    includeEvidencePreview: boolean;
    jsonOnly: boolean;
    noWrite: boolean;
    help: boolean;
  };
};

const { parseCliArgs, helpText, DEFAULTS } = lib;

describe('OPS-MCP-OBSERVABILITY — CLI argument parsing', () => {
  it('returns defaults when argv is empty', () => {
    const result = parseCliArgs([]);
    expect(result.ok).toBe(true);
    expect(result.options).toEqual(DEFAULTS);
  });

  it('rejects non-array argv', () => {
    const result = parseCliArgs(null);
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('parses --help', () => {
    const result = parseCliArgs(['--help']);
    expect(result.ok).toBe(true);
    expect(result.options?.help).toBe(true);
  });

  it('parses -h as --help shorthand', () => {
    const result = parseCliArgs(['-h']);
    expect(result.ok).toBe(true);
    expect(result.options?.help).toBe(true);
  });

  it('parses --out-dir <path>', () => {
    const result = parseCliArgs(['--out-dir', '/tmp/report-out']);
    expect(result.ok).toBe(true);
    expect(result.options?.outDir).toBe('/tmp/report-out');
  });

  it('rejects --out-dir with no value', () => {
    const result = parseCliArgs(['--out-dir']);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('--out-dir');
  });

  it('rejects --out-dir followed by another flag (empty-string-like check)', () => {
    // We require a non-empty value. The parser pops argv[i+1] when
    // it sees --out-dir; a missing value (end of argv) is the only
    // way to trigger the rejection.
    const result = parseCliArgs(['--out-dir', '']);
    expect(result.ok).toBe(false);
  });

  it('parses --time-window-days <int>', () => {
    const result = parseCliArgs(['--time-window-days', '14']);
    expect(result.ok).toBe(true);
    expect(result.options?.timeWindowDays).toBe(14);
  });

  it('rejects --time-window-days with zero', () => {
    const result = parseCliArgs(['--time-window-days', '0']);
    expect(result.ok).toBe(false);
  });

  it('rejects --time-window-days with negative value', () => {
    const result = parseCliArgs(['--time-window-days', '-5']);
    expect(result.ok).toBe(false);
  });

  it('rejects --time-window-days > 365', () => {
    const result = parseCliArgs(['--time-window-days', '366']);
    expect(result.ok).toBe(false);
  });

  it('rejects --time-window-days with non-numeric value', () => {
    const result = parseCliArgs(['--time-window-days', 'abc']);
    expect(result.ok).toBe(false);
  });

  it('parses --include-argument-detail', () => {
    const result = parseCliArgs(['--include-argument-detail']);
    expect(result.ok).toBe(true);
    expect(result.options?.includeArgumentDetail).toBe(true);
  });

  it('parses --include-evidence-preview', () => {
    const result = parseCliArgs(['--include-evidence-preview']);
    expect(result.ok).toBe(true);
    expect(result.options?.includeEvidencePreview).toBe(true);
  });

  it('parses --json-only', () => {
    const result = parseCliArgs(['--json-only']);
    expect(result.ok).toBe(true);
    expect(result.options?.jsonOnly).toBe(true);
  });

  it('parses --no-write', () => {
    const result = parseCliArgs(['--no-write']);
    expect(result.ok).toBe(true);
    expect(result.options?.noWrite).toBe(true);
  });

  it('parses multiple flags together', () => {
    const result = parseCliArgs([
      '--out-dir',
      '/tmp/out',
      '--time-window-days',
      '30',
      '--include-evidence-preview',
      '--no-write',
    ]);
    expect(result.ok).toBe(true);
    expect(result.options?.outDir).toBe('/tmp/out');
    expect(result.options?.timeWindowDays).toBe(30);
    expect(result.options?.includeEvidencePreview).toBe(true);
    expect(result.options?.noWrite).toBe(true);
  });

  it('rejects unknown flag', () => {
    const result = parseCliArgs(['--unknown-flag']);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('--unknown-flag');
  });

  it('helpText() returns a non-empty string with usage', () => {
    const text = helpText();
    expect(typeof text).toBe('string');
    expect(text).toContain('USAGE');
    expect(text).toContain('--out-dir');
    expect(text).toContain('--time-window-days');
    expect(text).toContain('EXIT CODES');
  });

  it('DEFAULTS object is frozen', () => {
    expect(Object.isFrozen(DEFAULTS)).toBe(true);
  });

  it('DEFAULTS has the expected shape', () => {
    expect(DEFAULTS).toEqual({
      outDir: null,
      timeWindowDays: 7,
      includeArgumentDetail: false,
      includeEvidencePreview: false,
      jsonOnly: false,
      noWrite: false,
      help: false,
    });
  });
});
