/**
 * OPS-MCP-OBSERVABILITY — Doctrine ban-list test.
 *
 * Asserts no banned verdict / person-language tokens appear in the
 * stitched markdown report or in any section title, question, or
 * emptyMessage. The scan is case-insensitive.
 *
 * Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md §safety + §22 HALT.
 * Doctrine: cdiscourse-doctrine §1 + §10a — no verdicts in observability output.
 */
const lib = require('../scripts/ops/mcp-observability-report-lib.cjs') as {
  BANNED_TOKENS: ReadonlyArray<string>;
  BANNED_VERDICT_TOKENS: ReadonlyArray<string>;
  SECTIONS: ReadonlyArray<{
    title: string;
    question: string;
    emptyMessage: string;
  }>;
  scanMarkdownForBannedTokens: (md: string) => Array<{ token: string; index: number }>;
  stitchMarkdownReport: (args: Record<string, unknown>) => string;
};
const {
  BANNED_TOKENS,
  BANNED_VERDICT_TOKENS,
  SECTIONS,
  scanMarkdownForBannedTokens,
  stitchMarkdownReport,
} = lib;
import {
  FIXTURE_EDGE_REGISTRY,
  FIXTURE_GENERATED_AT,
  FIXTURE_EMPTY_SECTIONS_DATA,
  FIXTURE_SECTIONS_DATA,
  FIXTURE_SOURCE_SIX_CHECK,
} from './fixtures/opsMcpObservabilityFixture';

describe('OPS-MCP-OBSERVABILITY — doctrine ban-list', () => {
  it('BANNED_TOKENS list is frozen and non-empty', () => {
    expect(Array.isArray(BANNED_TOKENS)).toBe(true);
    expect(BANNED_TOKENS.length).toBeGreaterThan(0);
    expect(Object.isFrozen(BANNED_TOKENS)).toBe(true);
  });

  it('BANNED_VERDICT_TOKENS list is frozen and non-empty', () => {
    expect(Array.isArray(BANNED_VERDICT_TOKENS)).toBe(true);
    expect(BANNED_VERDICT_TOKENS.length).toBeGreaterThan(0);
    expect(Object.isFrozen(BANNED_VERDICT_TOKENS)).toBe(true);
  });

  it('scanner returns empty array for clean text', () => {
    const hits = scanMarkdownForBannedTokens(
      'This is a plain telemetry summary with counts and ratios.',
    );
    expect(hits).toEqual([]);
  });

  it.each(BANNED_TOKENS as readonly string[])(
    'scanner flags %s as a hit when present',
    (token) => {
      const text = `Some narrative ${token} text.`;
      const hits = scanMarkdownForBannedTokens(text);
      expect(hits.some((h) => h.token === token)).toBe(true);
    },
  );

  it.each(BANNED_VERDICT_TOKENS as readonly string[])(
    'scanner flags verdict token %s as a hit when present',
    (token) => {
      const text = `The narrative says ${token} about it.`;
      const hits = scanMarkdownForBannedTokens(text);
      expect(hits.some((h) => h.token === token)).toBe(true);
    },
  );

  it('scanner is case-insensitive', () => {
    const hits = scanMarkdownForBannedTokens(
      'WINNER said this was the LOSER end of the debate.',
    );
    const tokens = hits.map((h) => h.token);
    expect(tokens).toEqual(expect.arrayContaining(['winner', 'loser']));
  });

  it('stitched markdown (populated fixture) contains no banned tokens', () => {
    const md = stitchMarkdownReport({
      sectionsData: FIXTURE_SECTIONS_DATA,
      sourceSixCheck: FIXTURE_SOURCE_SIX_CHECK,
      edgeRegistry: FIXTURE_EDGE_REGISTRY,
      generatedAt: FIXTURE_GENERATED_AT,
      defaultTimeWindowDays: 7,
      includeEvidencePreview: false,
    });
    // The list passed to scanner is what triggers the script exit. We
    // assert no hits to confirm the fixture data + section labels are
    // doctrine-safe. Note: the Appendix B note ENUMERATES the banned
    // tokens by name — that single occurrence is permitted because it
    // is a meta-description. We therefore scan the body WITHOUT
    // Appendix B for hits.
    const beforeAppendixB = md.split('## Appendix B')[0];
    const hits = scanMarkdownForBannedTokens(beforeAppendixB);
    expect(hits).toEqual([]);
  });

  it('stitched markdown (empty fixture) contains no banned tokens', () => {
    const md = stitchMarkdownReport({
      sectionsData: FIXTURE_EMPTY_SECTIONS_DATA,
      sourceSixCheck: FIXTURE_SOURCE_SIX_CHECK,
      edgeRegistry: FIXTURE_EDGE_REGISTRY,
      generatedAt: FIXTURE_GENERATED_AT,
      defaultTimeWindowDays: 7,
      includeEvidencePreview: false,
    });
    const beforeAppendixB = md.split('## Appendix B')[0];
    const hits = scanMarkdownForBannedTokens(beforeAppendixB);
    expect(hits).toEqual([]);
  });

  it('no section title contains any banned token', () => {
    const lowerTitles = SECTIONS.map((s) => s.title.toLowerCase());
    for (const t of lowerTitles) {
      for (const token of BANNED_TOKENS) {
        expect(t).not.toContain(token);
      }
      for (const token of BANNED_VERDICT_TOKENS) {
        expect(t).not.toContain(token);
      }
    }
  });

  it('no section emptyMessage contains any banned token', () => {
    const lowerEmptyMsgs = SECTIONS.map((s) => s.emptyMessage.toLowerCase());
    for (const m of lowerEmptyMsgs) {
      for (const token of BANNED_TOKENS) {
        expect(m).not.toContain(token);
      }
      for (const token of BANNED_VERDICT_TOKENS) {
        expect(m).not.toContain(token);
      }
    }
  });

  it('no section question contains any banned verdict token', () => {
    // The Q13 question text contains "over-firing or under-firing" —
    // those phrases are NOT banned tokens (BANNED_VERDICT_TOKENS list
    // is just `correct`/`incorrect`; BANNED_TOKENS is the verdict /
    // person-language list). This assertion preserves the principle.
    const lowerQuestions = SECTIONS.map((s) => s.question.toLowerCase());
    for (const q of lowerQuestions) {
      for (const token of BANNED_TOKENS) {
        expect(q).not.toContain(token);
      }
      for (const token of BANNED_VERDICT_TOKENS) {
        expect(q).not.toContain(token);
      }
    }
  });
});
