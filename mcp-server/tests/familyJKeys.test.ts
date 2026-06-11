/**
 * MCP-SERVER-011-FAMILY-J — Family J keys constant test.
 *
 * Critical invariants:
 *   - FAMILY_J_RAW_KEYS contains exactly 5 entries (semantic_referee SOURCE-UNIFORM set)
 *   - Verbatim binding match with design §1 + MCP-J-001 §2 5-key inventory
 *   - NO FAMILY_J_EXCLUDED_DETERMINISTIC_RAW_KEYS export exists (source-uniform;
 *     the inverse of the mixed-source D/G/I families which each carry one)
 *   - FAMILY_J_PROMPT_ENTRIES has 5 entries with one entry per rawKey
 *   - Every prompt entry has all required verbose-definition fields incl.
 *     source + disposition
 *   - The source is uniformly 'semantic_referee'; the disposition split is
 *     exactly 3 composer_only + 2 inspect_only
 *   - FAMILY_J_CLASSIFIER_SET_VERSION === 'family-j-v1'
 *   - Per-key falsePositiveGuards for the 4 verdict-adjacent keys contain the
 *     verbatim DOCTRINE lines; shifts_to_person_or_intent carries the MAXIMAL
 *     guard (axis-partner)
 *   - uses_popularity_as_evidence carries the §3 anti-amplification guard
 *   - Declaration order preserved
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  FAMILY_J_RAW_KEYS,
  FAMILY_J_PROMPT_ENTRIES,
  FAMILY_J_CLASSIFIER_SET_VERSION,
} from '../lib/familyJKeys.ts';
import * as familyJKeysModule from '../lib/familyJKeys.ts';

/**
 * Binding list per MCP-SERVER-011-FAMILY-J design §1.
 * 5 semantic_referee rawKeys, declaration order matching upstream familyJ.ts.
 */
const BINDING_FAMILY_J_KEYS: readonly string[] = [
  'shifts_to_person_or_intent',
  'contains_unplayable_insult_only',
  'needs_pre_send_pause',
  'uses_popularity_as_evidence',
  'uses_satire_as_evidence',
];

Deno.test('FAMILY_J_RAW_KEYS contains exactly 5 entries (semantic_referee SOURCE-UNIFORM set)', () => {
  assertEquals(FAMILY_J_RAW_KEYS.length, 5);
});

Deno.test('FAMILY_J_RAW_KEYS contains all 5 binding rawKeys', () => {
  for (const key of BINDING_FAMILY_J_KEYS) {
    if (!FAMILY_J_RAW_KEYS.includes(key)) {
      throw new Error(`FAMILY_J_RAW_KEYS missing binding rawKey: ${key}`);
    }
  }
});

Deno.test('FAMILY_J_RAW_KEYS contains NO extra rawKeys beyond the binding list', () => {
  for (const key of FAMILY_J_RAW_KEYS) {
    if (!BINDING_FAMILY_J_KEYS.includes(key)) {
      throw new Error(`FAMILY_J_RAW_KEYS contains non-binding rawKey: ${key}`);
    }
  }
});

Deno.test('FAMILY_J_RAW_KEYS has no duplicate entries', () => {
  const seen = new Set<string>();
  for (const key of FAMILY_J_RAW_KEYS) {
    if (seen.has(key)) {
      throw new Error(`FAMILY_J_RAW_KEYS has duplicate rawKey: ${key}`);
    }
    seen.add(key);
  }
});

Deno.test('FAMILY_J_RAW_KEYS preserves declaration order (matches BINDING_FAMILY_J_KEYS index-by-index)', () => {
  for (let i = 0; i < BINDING_FAMILY_J_KEYS.length; i++) {
    assertEquals(
      FAMILY_J_RAW_KEYS[i],
      BINDING_FAMILY_J_KEYS[i],
      `FAMILY_J_RAW_KEYS[${i}] should be '${BINDING_FAMILY_J_KEYS[i]}' but got '${FAMILY_J_RAW_KEYS[i]}'`,
    );
  }
});

Deno.test('FAMILY_J has NO excluded-deterministic export (source-uniform; inverse of D/G/I)', () => {
  // J is source-uniform semantic_referee. Unlike the mixed-source families
  // D/G/I, it carries NO FAMILY_J_EXCLUDED_DETERMINISTIC_RAW_KEYS constant
  // (mirrors the uniform-source E/F/H precedent). Assert the export is absent.
  assertEquals('FAMILY_J_EXCLUDED_DETERMINISTIC_RAW_KEYS' in familyJKeysModule, false);
});

Deno.test('FAMILY_J_PROMPT_ENTRIES has 5 entries matching FAMILY_J_RAW_KEYS', () => {
  assertEquals(FAMILY_J_PROMPT_ENTRIES.length, 5);
  const promptKeys = FAMILY_J_PROMPT_ENTRIES.map((e) => e.rawKey);
  for (const key of FAMILY_J_RAW_KEYS) {
    if (!promptKeys.includes(key)) {
      throw new Error(`FAMILY_J_PROMPT_ENTRIES missing entry for rawKey: ${key}`);
    }
  }
});

Deno.test('FAMILY_J_PROMPT_ENTRIES declaration order matches FAMILY_J_RAW_KEYS', () => {
  for (let i = 0; i < FAMILY_J_RAW_KEYS.length; i++) {
    assertEquals(
      FAMILY_J_PROMPT_ENTRIES[i].rawKey,
      FAMILY_J_RAW_KEYS[i],
      `FAMILY_J_PROMPT_ENTRIES[${i}] rawKey mismatch`,
    );
  }
});

Deno.test('every FAMILY_J_PROMPT_ENTRIES entry has all required verbose-definition fields incl. source + disposition', () => {
  for (const entry of FAMILY_J_PROMPT_ENTRIES) {
    if (typeof entry.rawKey !== 'string' || entry.rawKey.length === 0) {
      throw new Error(`Entry missing rawKey: ${JSON.stringify(entry)}`);
    }
    if (typeof entry.label !== 'string' || entry.label.length === 0) {
      throw new Error(`Entry ${entry.rawKey} missing label`);
    }
    if (entry.source !== 'semantic_referee') {
      throw new Error(`Entry ${entry.rawKey} source must be 'semantic_referee'`);
    }
    if (entry.disposition !== 'composer_only' && entry.disposition !== 'inspect_only') {
      throw new Error(`Entry ${entry.rawKey} disposition must be composer_only or inspect_only`);
    }
    if (typeof entry.booleanQuestion !== 'string' || entry.booleanQuestion.length === 0) {
      throw new Error(`Entry ${entry.rawKey} missing booleanQuestion`);
    }
    if (typeof entry.positiveDefinition !== 'string' || entry.positiveDefinition.length === 0) {
      throw new Error(`Entry ${entry.rawKey} missing positiveDefinition`);
    }
    if (typeof entry.negativeDefinition !== 'string' || entry.negativeDefinition.length === 0) {
      throw new Error(`Entry ${entry.rawKey} missing negativeDefinition`);
    }
    if (typeof entry.positiveExample !== 'string' || entry.positiveExample.length === 0) {
      throw new Error(`Entry ${entry.rawKey} missing positiveExample`);
    }
    if (typeof entry.negativeExample !== 'string' || entry.negativeExample.length === 0) {
      throw new Error(`Entry ${entry.rawKey} missing negativeExample`);
    }
    if (typeof entry.falsePositiveGuards !== 'string' || entry.falsePositiveGuards.length === 0) {
      throw new Error(`Entry ${entry.rawKey} missing falsePositiveGuards`);
    }
  }
});

Deno.test('FAMILY_J_PROMPT_ENTRIES source is uniformly semantic_referee', () => {
  for (const entry of FAMILY_J_PROMPT_ENTRIES) {
    assertEquals(entry.source, 'semantic_referee', `${entry.rawKey} source drift`);
  }
});

Deno.test('FAMILY_J_PROMPT_ENTRIES disposition split is exactly 3 composer_only + 2 inspect_only', () => {
  const composerOnly = FAMILY_J_PROMPT_ENTRIES.filter((e) => e.disposition === 'composer_only');
  const inspectOnly = FAMILY_J_PROMPT_ENTRIES.filter((e) => e.disposition === 'inspect_only');
  assertEquals(composerOnly.length, 3, 'expected 3 composer_only keys');
  assertEquals(inspectOnly.length, 2, 'expected 2 inspect_only keys');
  // The 3 composer-only keys are the person/intent + insult + pause keys.
  assertEquals(
    composerOnly.map((e) => e.rawKey).sort(),
    ['contains_unplayable_insult_only', 'needs_pre_send_pause', 'shifts_to_person_or_intent'],
  );
  // The 2 inspect-only keys are the popularity + satire keys.
  assertEquals(
    inspectOnly.map((e) => e.rawKey).sort(),
    ['uses_popularity_as_evidence', 'uses_satire_as_evidence'],
  );
});

Deno.test('FAMILY_J_CLASSIFIER_SET_VERSION is exactly "family-j-v1"', () => {
  assertEquals(FAMILY_J_CLASSIFIER_SET_VERSION, 'family-j-v1');
});

Deno.test('shifts_to_person_or_intent falsePositiveGuards surface the verbatim MAXIMAL (axis-partner) doctrine guard', () => {
  // Design §5.2 BINDING: the axis-partner key carries the maximal guard,
  // including the existential constraint that the evidence_span MUST NOT echo
  // a slur the move itself contains.
  const entry = FAMILY_J_PROMPT_ENTRIES.find((e) => e.rawKey === 'shifts_to_person_or_intent');
  if (!entry) throw new Error('shifts_to_person_or_intent prompt entry missing');
  const expectedFragments = [
    'DOCTRINE (MAXIMAL — axis-partner)',
    'It is NEVER an "ad hominem" verdict, NEVER a "personal attack" label',
    'MUST NOT echo any slur the move itself contains',
    'The output MUST NOT contain: troll, toxic, hostile, abusive, ad hominem, personal attack, bad actor',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `shifts_to_person_or_intent falsePositiveGuards missing verbatim fragment: "${fragment}". Got: ${entry.falsePositiveGuards}`,
      );
    }
  }
});

Deno.test('contains_unplayable_insult_only falsePositiveGuards surface the verbatim verdict-adjacent doctrine guard', () => {
  const entry = FAMILY_J_PROMPT_ENTRIES.find((e) => e.rawKey === 'contains_unplayable_insult_only');
  if (!entry) throw new Error('contains_unplayable_insult_only prompt entry missing');
  const expectedFragments = [
    'records the structural ABSENCE OF A PLAYABLE CLAIM',
    'NEVER calls the author a "troll"',
    'The output MUST NOT contain: troll, toxic, abusive, name calling',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `contains_unplayable_insult_only falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('needs_pre_send_pause falsePositiveGuards surface the verbatim verdict-adjacent doctrine guard', () => {
  const entry = FAMILY_J_PROMPT_ENTRIES.find((e) => e.rawKey === 'needs_pre_send_pause');
  if (!entry) throw new Error('needs_pre_send_pause prompt entry missing');
  const expectedFragments = [
    'records reactive/escalatory STRUCTURAL MARKERS',
    'never a diagnosis of the writer',
    'The output MUST NOT contain: unhinged, hostile, aggressive, losing it',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `needs_pre_send_pause falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('uses_satire_as_evidence falsePositiveGuards surface the verbatim verdict-adjacent doctrine guard', () => {
  const entry = FAMILY_J_PROMPT_ENTRIES.find((e) => e.rawKey === 'uses_satire_as_evidence');
  if (!entry) throw new Error('uses_satire_as_evidence prompt entry missing');
  const expectedFragments = [
    'records that the text cites a satire/parody source as if it documented a real event',
    'only the evidentiary misuse is the structural fact',
    'The output MUST NOT contain: fake news, gullible',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `uses_satire_as_evidence falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('uses_popularity_as_evidence falsePositiveGuards encode the §3 anti-amplification doctrine', () => {
  const entry = FAMILY_J_PROMPT_ENTRIES.find((e) => e.rawKey === 'uses_popularity_as_evidence');
  if (!entry) throw new Error('uses_popularity_as_evidence prompt entry missing');
  const expectedFragments = [
    'DOCTRINE (§3 anti-amplification)',
    'It NEVER credits the engagement',
    'engagement credit and factual-standing eligibility are SEPARATE scores',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `uses_popularity_as_evidence falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('the 4 verdict-adjacent keys each carry the "MUST NOT contain" enumeration verbatim', () => {
  const verdictAdjacentKeys = [
    'shifts_to_person_or_intent',
    'contains_unplayable_insult_only',
    'needs_pre_send_pause',
    'uses_satire_as_evidence',
  ];
  for (const rawKey of verdictAdjacentKeys) {
    const entry = FAMILY_J_PROMPT_ENTRIES.find((e) => e.rawKey === rawKey);
    if (!entry) throw new Error(`${rawKey} prompt entry missing`);
    if (!entry.falsePositiveGuards.includes('MUST NOT contain')) {
      throw new Error(
        `${rawKey} falsePositiveGuards missing "MUST NOT contain" enumeration (verdict-adjacent binding)`,
      );
    }
  }
});
