/**
 * MCP-MOD-004 — `seedPrompt.ts` no per-id hardcoded id-strings (source scan).
 *
 * The reviewer's primary regression check. After the source-of-truth
 * extraction, the per-id question text is derived from
 * `SEMANTIC_CLASSIFIER_CATALOG` rather than hand-written in `seedPrompt.ts`.
 * This test reads `seedPrompt.ts` AS SOURCE TEXT (with line and block comments
 * stripped) and asserts that NO literal `SemanticClassifierId` id-string
 * appears in the executable source.
 *
 * A failure means either:
 *
 *   1. A new per-id hardcoded mapping was reintroduced into `seedPrompt.ts`
 *      (undoing the refactor) — fix by moving the mapping into the catalog.
 *   2. A comment in `seedPrompt.ts` mentions an id — fix by removing the id
 *      from the comment.
 *
 * Caveat — documented carve-out: the worked example in `buildClassifierPrompt`
 * references the catalog's FIRST entry by NAME (so the rendered prompt's
 * illustrative JSON parses). The id-literal is sourced from
 * `SEMANTIC_CLASSIFIER_CATALOG[0].id`, NOT hardcoded — so no per-id literal
 * appears in the source. The reference `SEMANTIC_CLASSIFIER_CATALOG[0]` itself
 * is not a per-id id-string.
 */
import * as fs from 'fs';
import * as path from 'path';
import { ALL_SEMANTIC_CLASSIFIER_IDS } from '../src/features/semanticReferee';

const SEED_PROMPT_PATH = path.join(
  process.cwd(),
  'supabase/functions/_shared/semanticReferee/seedPrompt.ts',
);

const SEED_PROMPT_SRC = fs.readFileSync(SEED_PROMPT_PATH, 'utf8');

/**
 * Strip block comments (`/* ... *\/`) and line comments (`// ...`) from a
 * source file. Strings inside comments must not contribute to the scan — only
 * executable source code is checked.
 */
function stripComments(src: string): string {
  // Strip block comments first (greedy on `*\/` to handle nested-content cases).
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, '');
  // Then strip single-line comments. Use a multiline match to anchor `//` to
  // a position where it is not inside a string literal — a coarse heuristic
  // sufficient for this file: line comments here always start the
  // non-whitespace content of a line.
  const noLine = noBlock
    .split('\n')
    .map((line) => {
      // Remove `// ...` to end of line, but only when the `//` is preceded
      // exclusively by whitespace OR by a closing brace / paren / quote / comma
      // — never when inside a string literal. A robust check: walk the line
      // char-by-char and track whether we are inside a string.
      let inString: '"' | "'" | '`' | null = null;
      let escape = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (escape) {
          escape = false;
          continue;
        }
        if (ch === '\\') {
          escape = true;
          continue;
        }
        if (inString) {
          if (ch === inString) inString = null;
          continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') {
          inString = ch;
          continue;
        }
        if (ch === '/' && line[i + 1] === '/') {
          return line.slice(0, i);
        }
      }
      return line;
    })
    .join('\n');
  return noLine;
}

const STRIPPED_SRC = stripComments(SEED_PROMPT_SRC);

describe('MCP-MOD-004 — seedPrompt.ts source scan: no per-id hardcoded id-strings', () => {
  it('the source file exists', () => {
    expect(fs.existsSync(SEED_PROMPT_PATH)).toBe(true);
  });

  it('the source file imports SEMANTIC_CLASSIFIER_CATALOG from the Deno catalog mirror', () => {
    expect(STRIPPED_SRC).toMatch(
      /from\s+'\.\/semanticClassifierCatalog\.ts'/,
    );
  });

  it('the source file derives CLASSIFIER_QUESTION_TEXT from the catalog (no hand-written 23-entry record literal)', () => {
    // The derived form uses Object.fromEntries over SEMANTIC_CLASSIFIER_CATALOG.
    expect(STRIPPED_SRC).toMatch(/Object\.fromEntries/);
    expect(STRIPPED_SRC).toMatch(
      /SEMANTIC_CLASSIFIER_CATALOG\.map\s*\(/,
    );
  });

  for (const id of ALL_SEMANTIC_CLASSIFIER_IDS) {
    it(`does NOT contain the literal id-string '${id}' anywhere in the executable source`, () => {
      // Build a regex that matches the id wrapped in single OR double quotes.
      // `\b` is not used because snake_case ids include underscores which break
      // word boundaries in the desired way — the quote characters bound the id
      // explicitly.
      const pattern = new RegExp(`['"]${id}['"]`);
      const matched = pattern.test(STRIPPED_SRC);
      expect(matched).toBe(false);
    });
  }
});
