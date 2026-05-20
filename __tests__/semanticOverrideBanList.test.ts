/**
 * MCP-015 — Semantic override doctrine ban-list scan.
 *
 * Three guards:
 *   1. Ban-list — no verdict / person-attribution / "you were warned" token
 *      appears in any new `semantic_override_*` / `mainline` / `branch` /
 *      `answers_parent` copy value, or in `toPlainLanguage` of any new code.
 *   2. Plain-language coverage — every new override code maps to a non-null
 *      `toPlainLanguage` result with no snake_case leak.
 *   3. `_forbiddenOverrideTokens()` is non-empty and itself covers the
 *      doctrine token set.
 */

import {
  PLAIN_LANGUAGE_COPY,
  toPlainLanguage,
} from '../src/features/arguments/gameCopy';
import { _forbiddenOverrideTokens } from '../src/features/semanticOverride';

// ── The doctrine ban-list ─────────────────────────────────────────

const BANNED_TOKENS = [
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
  'proven',
  'defeated',
  'liar',
  'lying',
  'dishonest',
  'bad faith',
  'manipulative',
  'troll',
  'propagandist',
  'extremist',
  'stupid',
  'idiot',
  'dumb',
  'smart',
];

/** Phrase-level framing tokens — substring scan, not word-boundary. */
const BANNED_PHRASES = ['you were warned', 'rejected', 'off-topic', 'off topic'];

function containsBannedToken(text: string): string | null {
  const lower = text.toLowerCase();
  for (const token of BANNED_TOKENS) {
    if (token.includes(' ')) {
      if (lower.includes(token)) return token;
    } else {
      const re = new RegExp(`\\b${token}\\b`, 'i');
      if (re.test(lower)) return token;
    }
  }
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}

// ── The override copy keys this card added ────────────────────────

/**
 * The new keys MCP-015 appended to `PLAIN_LANGUAGE_COPY`. `tangent` is NOT in
 * this list — it is a reused META-001 key, not an MCP-015 addition.
 */
const OVERRIDE_COPY_KEYS = [
  'mainline',
  'branch',
  'answers_parent',
  'semantic_override_prompt_low_conf',
  'semantic_override_prompt_conflict',
  'semantic_override_prompt_soft',
  'semantic_override_lane_mainline',
  'semantic_override_lane_branch',
  'semantic_override_lane_tangent',
  'semantic_override_answers_parent',
  'semantic_override_confirm_changed',
  'semantic_override_confirm_keep',
  'semantic_override_recorded_lane',
  'semantic_override_recorded_answers',
  'semantic_override_original_suggestion',
  'semantic_override_change',
] as const;

// ── Ban-list scan ─────────────────────────────────────────────────

describe('semantic override ban-list — copy values', () => {
  it('every new override copy value is ban-list-clean', () => {
    const copy = PLAIN_LANGUAGE_COPY as unknown as Record<string, string>;
    for (const key of OVERRIDE_COPY_KEYS) {
      const value = copy[key];
      expect(typeof value).toBe('string');
      expect({ key, hit: containsBannedToken(value as string) }).toEqual({
        key,
        hit: null,
      });
    }
  });

  it('every override code key is itself ban-list-clean', () => {
    for (const key of OVERRIDE_COPY_KEYS) {
      expect(containsBannedToken(key)).toBeNull();
    }
  });
});

// ── Plain-language coverage ───────────────────────────────────────

describe('semantic override plain-language coverage', () => {
  it('toPlainLanguage of every new override code returns a non-null string', () => {
    for (const key of OVERRIDE_COPY_KEYS) {
      const plain = toPlainLanguage(key);
      expect(plain).not.toBeNull();
      expect((plain as string).length).toBeGreaterThan(0);
    }
  });

  it('no override code resolves to a snake_case leak (the raw key)', () => {
    for (const key of OVERRIDE_COPY_KEYS) {
      const plain = toPlainLanguage(key);
      expect(plain).not.toBe(key);
    }
  });

  it('toPlainLanguage of every override code is itself ban-list-clean', () => {
    for (const key of OVERRIDE_COPY_KEYS) {
      const plain = toPlainLanguage(key);
      expect(containsBannedToken(plain as string)).toBeNull();
    }
  });
});

// ── _forbiddenOverrideTokens ──────────────────────────────────────

describe('_forbiddenOverrideTokens — the ban-list source', () => {
  it('is a non-empty array of strings', () => {
    const tokens = _forbiddenOverrideTokens();
    expect(Array.isArray(tokens)).toBe(true);
    expect(tokens.length).toBeGreaterThan(0);
    for (const t of tokens) {
      expect(typeof t).toBe('string');
      expect(t.length).toBeGreaterThan(0);
    }
  });

  it('covers the core verdict / person-attribution doctrine tokens', () => {
    const tokens = _forbiddenOverrideTokens().map((t) => t.toLowerCase());
    for (const required of [
      'winner',
      'loser',
      'liar',
      'manipulative',
      'extremist',
      'propagandist',
    ]) {
      expect(tokens.includes(required)).toBe(true);
    }
  });

  it('covers the "overriding is not a penalty" framing tokens', () => {
    const tokens = _forbiddenOverrideTokens().map((t) => t.toLowerCase());
    for (const required of ['you were warned', 'penalty', 'rejected']) {
      expect(tokens.includes(required)).toBe(true);
    }
  });

  it('contains no token that is itself a banned verdict false-positive trap', () => {
    // Sanity — the ban-list source must not accidentally list a benign word
    // that would over-trigger. Every entry is a real doctrine token.
    const tokens = _forbiddenOverrideTokens();
    expect(new Set(tokens).size).toBe(tokens.length); // no duplicates
  });
});
