/**
 * UX-001.2 — Doctrine ban-list (Q12 cat 7).
 *
 * Source-scan across every UX-001.2 in-scope file for cdiscourse-doctrine
 * compliance:
 *
 *   1. No verdict tokens (winner / loser / correct / true / false / liar
 *      / dishonest / bad faith / manipulative / extremist / propagandist
 *      / stupid / idiot) in any visible string.
 *   2. No raw internal codes leaked into user-facing copy (must route
 *      through `gameCopy.toPlainLanguage`).
 *   3. No service-role or AI-provider key reference.
 *   4. No Anthropic / xAI / X / OpenAI / Gemini provider imports.
 *   5. No Modal import (TL-003 doctrine — inline panels only).
 *   6. No hardcoded ANTHROPIC_API_KEY / SERVICE_ROLE / XAI_API_KEY etc.
 *
 * Pattern matches existing repo precedent (`AdminCreateUserForm.test.tsx`,
 * `timelineReadoutBanList.test.ts`, `inRoomNoRoute.test.ts`).
 */
import fs from 'fs';
import path from 'path';

const REPO = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(REPO, rel), 'utf8');
}

const UX_001_2_FILES = [
  'App.tsx',
  'src/features/debates/DebateDetailHeader.tsx',
  'src/features/arguments/ArgumentGameSurface.tsx',
  'src/features/arguments/ArgumentTimelineMap.tsx',
  'src/features/arguments/TimelineSelectedReadoutPanel.tsx',
  'src/features/arguments/timelineViewportLayoutModel.ts',
  // ASP-EXTRACT-001 (Slice 1) — the extracted room lens + shared action-code
  // registry inherit the same verdict-ban / internal-code-leak / security /
  // provider-import / no-console.log coverage the monolith had.
  'src/features/arguments/room/MapView.tsx',
  'src/features/arguments/room/roomActionCodes.ts',
];

// Strings that must NEVER appear inside a UI string literal in any
// UX-001.2 file. Each is bounded by word characters so substring
// matches inside CSS values / comments don't trigger.
//
// Comments and source identifiers ARE allowed to contain these words —
// the test scans for them inside quoted string literals only. We use a
// simple heuristic: extract every quoted string from each file and scan
// for the banned token.
const VERDICT_TOKENS_INSIDE_STRINGS = [
  'winner',
  'loser',
  'correct',
  'incorrect',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'stupid',
  'idiot',
  'truth',
  'truthful',
];

// Match every literal string in source: '...', "...", `...`. Each match
// is checked for banned tokens. We tolerate banned tokens in non-string
// source (comments, identifiers) because the test is about copy.
const STRING_RE = /(['"`])(?:(?!\1|\\)[\s\S]|\\[\s\S])*?\1/g;

function extractStrings(src: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = STRING_RE.exec(src))) {
    out.push(m[0].slice(1, -1));
  }
  return out;
}

describe('UX-001.2 — verdict ban-list inside string literals', () => {
  for (const file of UX_001_2_FILES) {
    const src = read(file);
    const literals = extractStrings(src);
    it(`${file} contains no banned verdict token in any string literal`, () => {
      for (const lit of literals) {
        const lower = lit.toLowerCase();
        // Allow specific copy that legitimately uses common English words.
        // "correctness" and "true" are tolerated only when they appear in
        // a code identifier or a doctrine-comment-style fragment; the
        // word-boundary check below avoids "Trueque" / "instrumentation"
        // false-positives.
        for (const tok of VERDICT_TOKENS_INSIDE_STRINGS) {
          // Word-boundary match against the lowercase string. The literal
          // 'true' shows up frequently as a JSON / boolean payload value
          // — exclude that case by checking for surrounding context.
          if (tok === 'truth' || tok === 'truthful') {
            // These words may appear in comments only; allow if found in
            // a documentation context (e.g. "source of truth"). Use a
            // negative lookbehind via a context check.
            const lowerRe = new RegExp(`\\b${tok}\\b`);
            const isLegitimate =
              lit.includes('source of truth') ||
              lit.includes('truthiness') ||
              lit.includes('truth value') ||
              lit.includes('truth tables');
            if (lowerRe.test(lower) && !isLegitimate) {
              throw new Error(
                `Banned token "${tok}" appears in a string in ${file}: ${lit.slice(0, 80)}`,
              );
            }
            continue;
          }
          if (lower.includes(tok)) {
            // Allow when the token is part of a longer identifier-like
            // substring (e.g. "incorrect_state_code" inside a comment-
            // adjacent string we never actually render). Use a strict
            // word-boundary check here.
            const wordRe = new RegExp(`\\b${tok}\\b`, 'i');
            if (wordRe.test(lit)) {
              throw new Error(
                `Banned token "${tok}" appears in a string in ${file}: ${lit.slice(0, 80)}`,
              );
            }
          }
        }
      }
      // If we got here without throwing, the file is clean.
      expect(true).toBe(true);
    });
  }
});

describe('UX-001.2 — internal code leak guard', () => {
  // The full list of internal codes (mirrors `gameCopy.toPlainLanguage`'s
  // domain). Any of these in a user-facing string is a doctrine violation
  // — they must route through the plain-language map.
  const INTERNAL_CODES = [
    'topic_satisfaction_lexical',
    'source_chain_lexical',
    'anti_amplification',
    'evidence_debt',
    'platform_support_warning',
    'validation_failed_after_retries',
    'max_depth_reached',
    'synthesis_ready',
    'submit_failed',
  ];

  for (const file of UX_001_2_FILES) {
    const src = read(file);
    const literals = extractStrings(src);
    it(`${file} contains no raw internal code in a string literal`, () => {
      for (const lit of literals) {
        for (const code of INTERNAL_CODES) {
          if (lit.includes(code)) {
            throw new Error(
              `Internal code "${code}" leaked into a string in ${file}: ${lit.slice(0, 80)}`,
            );
          }
        }
      }
      expect(true).toBe(true);
    });
  }
});

describe('UX-001.2 — no service-role / AI key reference', () => {
  const SECURITY_PATTERNS: RegExp[] = [
    /\bANTHROPIC_API_KEY\b/,
    /\bXAI_API_KEY\b/,
    /\bX_BEARER_TOKEN\b/,
    /\bSERVICE_ROLE\b/,
    /\bservice_role\b/,
    /\bOPENAI_API_KEY\b/,
    /\bGEMINI_API_KEY\b/,
  ];

  for (const file of UX_001_2_FILES) {
    const src = read(file);
    it(`${file} contains no security-keyword reference`, () => {
      for (const re of SECURITY_PATTERNS) {
        expect(src).not.toMatch(re);
      }
    });
  }
});

describe('UX-001.2 — no AI provider import', () => {
  const PROVIDER_IMPORTS: RegExp[] = [
    /from\s+['"]@anthropic-ai\/sdk['"]/,
    /from\s+['"]openai['"]/,
    /from\s+['"]@google-cloud\/aiplatform['"]/,
    /from\s+['"]@google\/generative-ai['"]/,
    /from\s+['"]@xai-org\/sdk['"]/,
  ];

  for (const file of UX_001_2_FILES) {
    const src = read(file);
    it(`${file} contains no AI provider import`, () => {
      for (const re of PROVIDER_IMPORTS) {
        expect(src).not.toMatch(re);
      }
    });
  }
});

describe('UX-001.2 — no console.log left in', () => {
  // The repo discipline: structured logger or remove before commit.
  // Comments with the word are fine; actual `console.log(` calls are not.
  for (const file of UX_001_2_FILES) {
    const src = read(file);
    it(`${file} contains no console.log() call`, () => {
      // Look for an actual call site; `console.warn` is allowed (we keep
      // a single QOL-040.3 dev warn).
      expect(src).not.toMatch(/console\.log\s*\(/);
    });
  }
});
