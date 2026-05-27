/**
 * OPS-MCP-OBSERVABILITY — Evidence preview safety test.
 *
 * The `--include-evidence-preview` flag is opt-in; when enabled, every
 * emitted excerpt MUST be truncated to <=120 chars AND doctrine-scanned
 * BEFORE write. This ordering matters: a 240-char evidence span
 * containing a banned token at character 200 must NOT slip through.
 *
 * Tests:
 *   - safeTruncateEvidence truncates strings > 120 chars to exactly 120.
 *   - safeTruncateEvidence leaves shorter strings untouched.
 *   - safeTruncateEvidence catches banned tokens that survive after
 *     truncation.
 *   - safeTruncateEvidence permits clean truncated strings.
 *   - Off-by-one tests: a banned token at chars 115-120 IS caught;
 *     a banned token only present BEYOND char 120 is NOT in the
 *     truncated output and therefore not flagged.
 *
 * Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md §evidence-preview.
 * Doctrine: evidence-doctrine — content of an evidence span is
 * doctrinally suppressed by default.
 */
const lib = require('../scripts/ops/mcp-observability-report-lib.cjs') as {
  EVIDENCE_PREVIEW_MAX_CHARS: number;
  safeTruncateEvidence: (
    raw: unknown,
  ) => { ok: boolean; truncated: string; reason?: string };
};

const { EVIDENCE_PREVIEW_MAX_CHARS, safeTruncateEvidence } = lib;

describe('OPS-MCP-OBSERVABILITY — evidence preview safety', () => {
  it('EVIDENCE_PREVIEW_MAX_CHARS is 120', () => {
    expect(EVIDENCE_PREVIEW_MAX_CHARS).toBe(120);
  });

  it('truncates strings longer than 120 chars to exactly 120 chars', () => {
    const long = 'a'.repeat(240);
    const result = safeTruncateEvidence(long);
    expect(result.ok).toBe(true);
    expect(result.truncated.length).toBe(120);
  });

  it('leaves strings shorter than 120 chars untouched', () => {
    const short = 'short evidence text';
    const result = safeTruncateEvidence(short);
    expect(result.ok).toBe(true);
    expect(result.truncated).toBe(short);
  });

  it('returns ok=true for an empty string', () => {
    const result = safeTruncateEvidence('');
    expect(result.ok).toBe(true);
    expect(result.truncated).toBe('');
  });

  it('returns ok=true for non-string inputs (coerced to empty)', () => {
    const result = safeTruncateEvidence(null);
    expect(result.ok).toBe(true);
    expect(result.truncated).toBe('');
  });

  it('flags a banned token inside the truncated window', () => {
    // Put the banned token early so it survives truncation.
    const dirty = 'The witness called him a liar in the testimony excerpt.';
    const result = safeTruncateEvidence(dirty);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('banned_token_in_truncated_excerpt');
  });

  it('permits clean truncated output', () => {
    const clean = 'This is a neutral evidence span describing aggregate counts.';
    const result = safeTruncateEvidence(clean);
    expect(result.ok).toBe(true);
  });

  it('OFF-BY-ONE: banned token at chars 115-120 is caught', () => {
    // Construct a 120-char string with the banned token at positions
    // 115-119 (last 5 chars before truncation boundary).
    const padding = 'x'.repeat(115);
    const banned = 'liar';
    const longer = padding + banned + 'EXTRA_TAIL_AFTER_TRUNCATION';
    // The truncated value is the first 120 chars: padding + 'liar' +
    // 'x' = 115 + 4 + 1 = 120 chars. The banned token IS in the
    // truncated window.
    const result = safeTruncateEvidence(longer);
    expect(result.ok).toBe(false);
  });

  it('OFF-BY-ONE: banned token only beyond char 120 is NOT in truncated output', () => {
    // The first 120 chars are clean; the banned token appears at
    // positions 121-124. After truncation to 120 chars, the token is
    // dropped — the scan passes.
    const padding = 'x'.repeat(120);
    const longer = padding + 'liar later';
    const result = safeTruncateEvidence(longer);
    expect(result.ok).toBe(true);
    expect(result.truncated.length).toBe(120);
    expect(result.truncated).not.toContain('liar');
  });

  it('exactly-120-char input is not truncated further', () => {
    const exact = 'a'.repeat(120);
    const result = safeTruncateEvidence(exact);
    expect(result.ok).toBe(true);
    expect(result.truncated.length).toBe(120);
    expect(result.truncated).toBe(exact);
  });

  it('truncate-then-scan order: a banned token that would be removed by truncation cannot leak', () => {
    // This is the defining safety property. If the scan ran BEFORE
    // truncation, the banned token at char 200 would trigger. After
    // truncation to 120 chars, it does not appear in the output. The
    // current implementation runs truncation first and then scans —
    // so this passes.
    const padding = 'x'.repeat(200);
    const beyondWindow = padding + 'winner of the debate';
    const result = safeTruncateEvidence(beyondWindow);
    expect(result.ok).toBe(true);
    expect(result.truncated).not.toContain('winner');
  });
});
