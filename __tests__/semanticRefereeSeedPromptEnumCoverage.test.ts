/**
 * SMOKE-FIX-002 — semantic-referee seed-prompt enum coverage + worked example.
 *
 * Source-scan test for `supabase/functions/_shared/semanticReferee/seedPrompt.ts`.
 * It pairs with the existing `semanticAnthropicSeedPromptBanList.test.ts` (which
 * checks the per-classifier question dictionary) by additionally asserting that
 * the user-message INSTRUCTION enumerates every `SemanticRouteSuggestion` and
 * every `SemanticFrictionSuggestion` enum value verbatim, that the worked-example
 * block is present and shape-complete, that the prompt version is bumped to v1,
 * and that the worked example carries no banned token / phrase / shape.
 *
 * Cause named: the 2026-05-23 smoke-test re-run (runId 5f67680a, semantic-referee
 * deployment v39) produced three diagnostic `validation_failed` lines with
 * `layer: "schema"` and `path: ["routeSuggestion"]` — Haiku 4.5 omitted or
 * out-of-enum'd the field. SMOKE-FIX-002 tightens the prompt; this test pins
 * the tightening so a future drift can't undo it silently.
 *
 * The test reads `seedPrompt.ts` as TEXT (not a runtime import) so a future move
 * of the enum literals into a generated form would be caught immediately.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  ALL_ROUTE_SUGGESTIONS,
  ALL_FRICTION_SUGGESTIONS,
} from '../src/features/semanticReferee/semanticRefereeTypes';

const REPO_ROOT = process.cwd();
const SEED_PROMPT_PATH = path.join(
  REPO_ROOT,
  'supabase/functions/_shared/semanticReferee/seedPrompt.ts',
);

/**
 * Ban-list mirror of `__tests__/semanticAnthropicSeedPromptBanList.test.ts`.
 * Tokens that must never appear in the worked example (or anywhere outside the
 * documented "Do not include …" prohibition sentence).
 */
const BANNED_TOKENS: readonly string[] = [
  'winner',
  'loser',
  'won',
  'lost',
  'right',
  'wrong',
  'true',
  'false',
  'correct',
  'incorrect',
  'verdict',
  'proven',
  'disproven',
  'defeated',
  'popular',
  'unpopular',
  'liar',
  'lying',
  'dishonest',
];

/** Multi-word banned phrases — scanned after whitespace collapse. */
const BANNED_PHRASES: readonly string[] = ['bad faith'];

/**
 * Secret / handle / URL shapes — assembled at runtime so this test file itself
 * is grep-clean (no embedded secret-like literals).
 */
const SHAPE_PATTERNS: readonly RegExp[] = [
  /@[A-Za-z0-9_]{1,15}\b/,
  /\bhttps?:\/\/\S+/i,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  new RegExp('sk-' + 'ant-' + '[A-Za-z0-9_-]{4,}', 'i'),
  /\bBearer\s+[A-Za-z0-9._-]{8,}/,
];

describe('SMOKE-FIX-002 — seed-prompt enum coverage', () => {
  const src = fs.readFileSync(SEED_PROMPT_PATH, 'utf8');

  it('SEED_PROMPT_VERSION is bumped to v1', () => {
    expect(src).toContain(
      "export const SEED_PROMPT_VERSION = 'mcp-semantic-referee-prompt-v1';",
    );
    expect(src).not.toContain(
      "export const SEED_PROMPT_VERSION = 'mcp-semantic-referee-prompt-v0';",
    );
  });

  it('every SemanticRouteSuggestion enum value appears as a JSON literal in the prompt source', () => {
    for (const value of ALL_ROUTE_SUGGESTIONS) {
      // Must appear at least once as a double-quoted JSON literal in the prompt body.
      expect(src).toContain(`"${value}"`);
    }
  });

  it('every SemanticFrictionSuggestion enum value appears as a JSON literal in the prompt source', () => {
    for (const value of ALL_FRICTION_SUGGESTIONS) {
      expect(src).toContain(`"${value}"`);
    }
  });

  it('the worked-example block is present and shape-complete', () => {
    // The block opens with the framing sentence so the test pins both the
    // disclaimer AND the JSON shape.
    expect(src).toMatch(/Worked example of the packet shape/);
    // All six scoreHints field names appear inside the block. (We assert
    // their presence as JSON keys, not their values — a different `1` vs `2`
    // swap should not break this test.)
    expect(src).toContain('"continuityCredit"');
    expect(src).toContain('"evidencePressure"');
    expect(src).toContain('"branchHygiene"');
    expect(src).toContain('"synthesisReadiness"');
    expect(src).toContain('"sourceChainDebt"');
    expect(src).toContain('"unresolvedRedirectRisk"');
    // The example uses an integer `1` literal for `value`, NOT the JSON
    // boolean `true` — disambiguates from SMOKE-FIX-001 §11 candidate B2b.
    expect(src).toMatch(/"value":\s*1\b/);
    // The example's reasonCode starts with a real REASON_CODE_FAMILIES prefix
    // (parent_continuity) — pinned so a future drift of the example into a
    // family-free token would be caught.
    expect(src).toContain('parent_continuity_engaged');
  });

  it('the prompt source carries no banned token / phrase / shape outside the documented prohibitions', () => {
    // The existing prohibition sentence in `instruction` ("Do not include any
    // blocking, verdict, truth, or winner field.") legitimately names verdict /
    // truth / winner — those are the EXPLICIT prohibitions and are the same
    // documented exception the system prompt already uses (see SMOKE-FIX-002
    // §5.4 note). Per the design's stated intent — "the banned tokens never
    // appear OUTSIDE a 'Do not' / 'MUST NOT' / 'must not' sentence" — we strip
    // every line that carries a prohibition marker before the per-segment scan.
    //
    // Additionally, the file's own JSDoc doctrine block comment (lines 10-14)
    // wraps a doctrine prohibition sentence across multiple lines using the
    // "NO question asks the model whether anything is true, correct, right,
    // wrong, factual, proven, popular, or who is winning." form — banned
    // tokens appear on the wrapped continuation lines, not on the line with
    // the prohibition marker itself. JSDoc block comments are developer
    // documentation, never seen by the model, and are not the prompt content
    // this scan exists to guard. We therefore strip JSDoc block comments
    // wholesale (`/** ... */`) before the per-segment scan. The scan still
    // catches banned tokens in the executable string literals — the
    // `instruction`, `workedExample`, `buildInputBlock`, `CLASSIFIER_QUESTION_TEXT`,
    // and any prompt text the model is exposed to.
    const PROHIBITION_MARKER = /(do not|must not)/i;
    const withoutJsDocBlocks = src.replace(/\/\*\*[\s\S]*?\*\//g, '');
    const stripped = withoutJsDocBlocks
      .split('\n')
      .filter((line) => !PROHIBITION_MARKER.test(line))
      .join('\n');
    const lower = stripped.toLowerCase();
    for (const token of BANNED_TOKENS) {
      // Word-boundary match against the lower-cased stripped source.
      expect(lower).not.toMatch(new RegExp('\\b' + token + '\\b'));
    }
    for (const phrase of BANNED_PHRASES) {
      expect(lower).not.toContain(phrase);
    }
    for (const pattern of SHAPE_PATTERNS) {
      expect(pattern.test(src)).toBe(false);
    }
  });
});
