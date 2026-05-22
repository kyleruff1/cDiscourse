/**
 * MCP-017 — semantic-referee seed-prompt ban-list + id-coverage mirror.
 *
 * The structural mirror test for `seedPrompt.ts` (design §"Open item 2"). It
 * does NOT assert byte-identity against MCP-002's seed bank — the id
 * vocabularies differ (90 verbose seed ids vs 23 catalog ids, OQ-2). Instead it
 * asserts the three safety-relevant invariants:
 *
 *   1. `CLASSIFIER_QUESTION_TEXT` has an entry for every one of the 23
 *      `ALL_SEMANTIC_CLASSIFIER_IDS` and NO extra keys (id-coverage parity — a
 *      future catalog change without a `seedPrompt.ts` change fails CI).
 *   2. Every structural question is free of the doctrine ban-list vocabulary —
 *      verdict / person / popularity / handle / URL / secret shapes — so a
 *      question can never ask the model for a truth verdict. The system prompt
 *      is checked too: it may NAME a verdict concept ONLY inside a "do NOT ..."
 *      prohibition (the same documented arrangement as the sibling
 *      `languageProcessing/anthropicProvider.ts` and `semanticRefereeValidator.ts`).
 *   3. `buildClassifierPrompt` emits the question for exactly the
 *      `requestedClassifiers` and no others.
 *
 * Token matching is by lowercase word / snake_case SEGMENT (not substring) — so
 * a legitimate word like "correction" never trips the "correct" token.
 */
import {
  CLASSIFIER_QUESTION_TEXT,
  SEMANTIC_REFEREE_SYSTEM_PROMPT,
  buildClassifierPrompt,
  SEED_PROMPT_CLASSIFIER_IDS,
  DENO_ALL_SEMANTIC_CLASSIFIER_IDS,
} from './_helpers/semanticRefereeDeno';
import { ALL_SEMANTIC_CLASSIFIER_IDS } from '../src/features/semanticReferee';
import type { ClassifyMoveRequest } from '../src/lib/edgeFunctions';

/** Verdict / outcome / popularity tokens — banned in any question string. */
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

/** Secret / PII shapes — a question must carry none. */
const SHAPE_PATTERNS: readonly RegExp[] = [
  /@[A-Za-z0-9_]{1,15}\b/,
  /\bhttps?:\/\/\S+/i,
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  new RegExp('sk-' + 'ant-' + '[A-Za-z0-9_-]{4,}', 'i'),
  /\bBearer\s+[A-Za-z0-9._-]{8,}/,
];

/** Split a string into lowercase word / snake_case segments. */
function tokenSegments(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((seg) => seg.length > 0);
}

/** Assert one string carries no banned token / phrase / shape. */
function expectClean(value: string, context: string): void {
  const segments = new Set(tokenSegments(value));
  for (const token of BANNED_TOKENS) {
    if (segments.has(token)) {
      throw new Error(`banned token "${token}" found in ${context}: "${value}"`);
    }
  }
  const collapsed = value.toLowerCase().replace(/\s+/g, ' ');
  for (const phrase of BANNED_PHRASES) {
    if (collapsed.includes(phrase)) {
      throw new Error(`banned phrase "${phrase}" found in ${context}: "${value}"`);
    }
  }
  for (const pattern of SHAPE_PATTERNS) {
    if (pattern.test(value)) {
      throw new Error(`banned shape ${pattern} found in ${context}`);
    }
  }
}

function makeRequest(overrides: Partial<ClassifyMoveRequest> = {}): ClassifyMoveRequest {
  return {
    roomId: 'room-1',
    moveBodyRedacted: 'A move body.',
    roomContext: {},
    requestedClassifiers: ['responds_to_parent'],
    contentHash: 'hash-1',
    ...overrides,
  };
}

// ── Invariant 1 — id-coverage parity ──────────────────────────────

describe('seed prompt — id-coverage parity with the catalog', () => {
  it('CLASSIFIER_QUESTION_TEXT has an entry for every catalog-v0 classifier id', () => {
    for (const id of ALL_SEMANTIC_CLASSIFIER_IDS) {
      expect(typeof CLASSIFIER_QUESTION_TEXT[id]).toBe('string');
      expect(CLASSIFIER_QUESTION_TEXT[id].length).toBeGreaterThan(0);
    }
  });

  it('CLASSIFIER_QUESTION_TEXT has NO extra keys beyond the 23 catalog ids', () => {
    const catalog = new Set<string>(ALL_SEMANTIC_CLASSIFIER_IDS as readonly string[]);
    for (const key of Object.keys(CLASSIFIER_QUESTION_TEXT)) {
      expect(catalog.has(key)).toBe(true);
    }
    expect(Object.keys(CLASSIFIER_QUESTION_TEXT)).toHaveLength(ALL_SEMANTIC_CLASSIFIER_IDS.length);
  });

  it('there are exactly 23 catalog ids (the frozen catalog-v0 set)', () => {
    expect(ALL_SEMANTIC_CLASSIFIER_IDS).toHaveLength(23);
  });

  it('the Deno catalog id list matches the Node catalog id list', () => {
    expect([...DENO_ALL_SEMANTIC_CLASSIFIER_IDS].sort()).toEqual(
      [...ALL_SEMANTIC_CLASSIFIER_IDS].sort(),
    );
  });

  it('SEED_PROMPT_CLASSIFIER_IDS re-exports the catalog id list', () => {
    expect([...SEED_PROMPT_CLASSIFIER_IDS].sort()).toEqual(
      [...ALL_SEMANTIC_CLASSIFIER_IDS].sort(),
    );
  });
});

// ── Invariant 2 — ban-list cleanliness ────────────────────────────

describe('seed prompt — no verdict / person / popularity vocabulary', () => {
  it('every structural question is free of the doctrine ban-list vocabulary', () => {
    for (const id of ALL_SEMANTIC_CLASSIFIER_IDS) {
      expectClean(CLASSIFIER_QUESTION_TEXT[id], `question for "${id}"`);
    }
  });

  it('the system prompt names verdict concepts ONLY inside a "do NOT" prohibition', () => {
    // The system prompt MUST forbid verdict / truth language explicitly — it
    // names those concepts, but only to prohibit them. Verify the prohibitions
    // are present (so the model is told not to do it).
    const lower = SEMANTIC_REFEREE_SYSTEM_PROMPT.toLowerCase();
    expect(lower).toContain('do not decide who is right');
    expect(lower).toContain('do not assign a truth value');
    expect(lower).toContain('do not treat popularity');
    // It must NOT contain an affirmative instruction to judge truth.
    expect(lower).not.toMatch(/decide whether .* is true/);
    expect(lower).not.toMatch(/pick the winner/);
  });

  it('a full assembled prompt for every classifier carries no secret / handle / URL shape', () => {
    const prompt = buildClassifierPrompt(
      makeRequest({
        requestedClassifiers: ['responds_to_parent', 'narrows_claim', 'asks_for_evidence'],
        moveBodyRedacted: 'A clean move body.',
        parentBodyRedacted: 'A clean parent body.',
      }),
    );
    for (const pattern of SHAPE_PATTERNS) {
      expect(pattern.test(prompt)).toBe(false);
    }
  });
});

// ── Invariant 3 — buildClassifierPrompt emits only requested ids ──

describe('seed prompt — buildClassifierPrompt emits exactly the requested classifiers', () => {
  it('emits a question line for each requested id and no non-requested catalog id', () => {
    const requested: ClassifyMoveRequest['requestedClassifiers'] = [
      'responds_to_parent',
      'narrows_claim',
    ];
    const prompt = buildClassifierPrompt(makeRequest({ requestedClassifiers: requested }));
    for (const id of requested) {
      expect(prompt).toContain(`- ${id}:`);
    }
    // Catalog ids that were NOT requested must not appear as a question line.
    const notRequested = ALL_SEMANTIC_CLASSIFIER_IDS.filter(
      (id) => !requested.includes(id),
    );
    for (const id of notRequested) {
      expect(prompt).not.toContain(`- ${id}:`);
    }
  });
});
