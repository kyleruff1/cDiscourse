/**
 * MCP-SERVER-010-FAMILY-I — Family I keys constant test.
 *
 * Critical invariants:
 *   - FAMILY_I_RAW_KEYS contains exactly 6 entries (ai_classifier Subset)
 *   - Verbatim binding match with design §A.1.1 6-key inventory
 *   - FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS contains exactly 15 entries
 *     (the 8 auto_metadata + 7 lifecycle excluded keys; mixed-source)
 *   - FAMILY_I_PROMPT_ENTRIES has 6 entries with one entry per rawKey
 *   - Every prompt entry has all required verbose-definition fields
 *   - FAMILY_I_CLASSIFIER_SET_VERSION === 'family-i-v1'
 *   - Per-key falsePositiveGuards for the 2 misreadable keys
 *     (introduces_new_issue + returns_to_prior_issue) contain the verbatim
 *     §A.3.2 topology↔verdict doctrine guards
 *   - Declaration order preserved
 *   - included ∩ excluded = ∅ (disjoint, mixed-source boundary)
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  FAMILY_I_RAW_KEYS,
  FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS,
  FAMILY_I_PROMPT_ENTRIES,
  FAMILY_I_CLASSIFIER_SET_VERSION,
} from '../lib/familyIKeys.ts';

/**
 * Binding list per MCP-SERVER-010-FAMILY-I design §A.1.1.
 * 6 ai_classifier rawKeys, declaration order matching upstream familyI.ts.
 */
const BINDING_FAMILY_I_KEYS: readonly string[] = [
  'introduces_new_issue',
  'references_prior_agreement',
  'introduces_sub_axis',
  'returns_to_prior_issue',
  'references_external_context',
  'compares_options',
];

/**
 * Binding excluded list per design §A.1.1 (8 auto_metadata + 7 lifecycle).
 */
const BINDING_FAMILY_I_EXCLUDED: readonly string[] = [
  'has_reply',
  'participant_skipped_node',
  'no_response_after_n_turns',
  'repeated_axis_pressure',
  'splits_thread',
  'merges_thread',
  'references_sibling_node',
  'references_ancestor_node',
  'open',
  'answered',
  'moved_on_by_affirmative',
  'moved_on_by_negative',
  'ignored_by_affirmative',
  'ignored_by_negative',
  'ignored_by_both',
];

Deno.test('FAMILY_I_RAW_KEYS contains exactly 6 entries (ai_classifier Subset)', () => {
  assertEquals(FAMILY_I_RAW_KEYS.length, 6);
});

Deno.test('FAMILY_I_RAW_KEYS contains all 6 binding rawKeys', () => {
  for (const key of BINDING_FAMILY_I_KEYS) {
    if (!FAMILY_I_RAW_KEYS.includes(key)) {
      throw new Error(`FAMILY_I_RAW_KEYS missing binding rawKey: ${key}`);
    }
  }
});

Deno.test('FAMILY_I_RAW_KEYS contains NO extra rawKeys beyond the binding list', () => {
  for (const key of FAMILY_I_RAW_KEYS) {
    if (!BINDING_FAMILY_I_KEYS.includes(key)) {
      throw new Error(`FAMILY_I_RAW_KEYS contains non-binding rawKey: ${key}`);
    }
  }
});

Deno.test('FAMILY_I_RAW_KEYS has no duplicate entries', () => {
  const seen = new Set<string>();
  for (const key of FAMILY_I_RAW_KEYS) {
    if (seen.has(key)) {
      throw new Error(`FAMILY_I_RAW_KEYS has duplicate rawKey: ${key}`);
    }
    seen.add(key);
  }
});

Deno.test('FAMILY_I_RAW_KEYS preserves declaration order (matches BINDING_FAMILY_I_KEYS index-by-index)', () => {
  for (let i = 0; i < BINDING_FAMILY_I_KEYS.length; i++) {
    assertEquals(
      FAMILY_I_RAW_KEYS[i],
      BINDING_FAMILY_I_KEYS[i],
      `FAMILY_I_RAW_KEYS[${i}] should be '${BINDING_FAMILY_I_KEYS[i]}' but got '${FAMILY_I_RAW_KEYS[i]}'`,
    );
  }
});

Deno.test('FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS contains exactly 15 entries (8 auto_metadata + 7 lifecycle)', () => {
  assertEquals(FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS.length, 15);
  for (const key of BINDING_FAMILY_I_EXCLUDED) {
    if (!FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS.includes(key)) {
      throw new Error(`FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS missing excluded rawKey: ${key}`);
    }
  }
});

Deno.test('FAMILY_I included ∩ excluded = ∅ (disjoint mixed-source boundary)', () => {
  const intersection = FAMILY_I_RAW_KEYS.filter((k) =>
    FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS.includes(k),
  );
  if (intersection.length > 0) {
    throw new Error(
      `FAMILY_I included ∩ excluded non-empty: ${intersection.join(', ')}. The mixed-source boundary is violated.`,
    );
  }
});

Deno.test('FAMILY_I included ∪ excluded = 21 unique keys (the full upstream Family I taxonomy)', () => {
  const union = new Set<string>([
    ...FAMILY_I_RAW_KEYS,
    ...FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS,
  ]);
  assertEquals(union.size, 21);
});

Deno.test('FAMILY_I_PROMPT_ENTRIES has 6 entries matching FAMILY_I_RAW_KEYS', () => {
  assertEquals(FAMILY_I_PROMPT_ENTRIES.length, 6);
  const promptKeys = FAMILY_I_PROMPT_ENTRIES.map((e) => e.rawKey);
  for (const key of FAMILY_I_RAW_KEYS) {
    if (!promptKeys.includes(key)) {
      throw new Error(`FAMILY_I_PROMPT_ENTRIES missing entry for rawKey: ${key}`);
    }
  }
});

Deno.test('FAMILY_I_PROMPT_ENTRIES declaration order matches FAMILY_I_RAW_KEYS', () => {
  for (let i = 0; i < FAMILY_I_RAW_KEYS.length; i++) {
    assertEquals(
      FAMILY_I_PROMPT_ENTRIES[i].rawKey,
      FAMILY_I_RAW_KEYS[i],
      `FAMILY_I_PROMPT_ENTRIES[${i}] rawKey mismatch`,
    );
  }
});

Deno.test('every FAMILY_I_PROMPT_ENTRIES entry has all required verbose-definition fields', () => {
  for (const entry of FAMILY_I_PROMPT_ENTRIES) {
    if (typeof entry.rawKey !== 'string' || entry.rawKey.length === 0) {
      throw new Error(`Entry missing rawKey: ${JSON.stringify(entry)}`);
    }
    if (typeof entry.label !== 'string' || entry.label.length === 0) {
      throw new Error(`Entry ${entry.rawKey} missing label`);
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

Deno.test('FAMILY_I_CLASSIFIER_SET_VERSION is exactly "family-i-v1"', () => {
  assertEquals(FAMILY_I_CLASSIFIER_SET_VERSION, 'family-i-v1');
});

Deno.test('introduces_new_issue falsePositiveGuards surface the verbatim misreadable-key doctrine guard', () => {
  // Design §A.3.2 BINDING: the per-key guard MUST contain the verbatim
  // doctrine anchor forbidding off-topic / derailing verdict framing. This is
  // the one introduces_new_issue key a careless reader could mis-frame as
  // "off-topic".
  const entry = FAMILY_I_PROMPT_ENTRIES.find((e) => e.rawKey === 'introduces_new_issue');
  if (!entry) throw new Error('introduces_new_issue prompt entry missing');
  const expectedFragments = [
    'introducing a new issue is a structural BRANCHING event',
    'It is NEVER framed as "off-topic", "derailing", "evasive", or "changing the subject to dodge"',
    'The evidence_span MUST anchor the verbatim new-topic wording',
    'The output MUST NOT contain: off-topic, derailing, evasive, dodging',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `introduces_new_issue falsePositiveGuards missing verbatim doctrine fragment: "${fragment}". Got: ${entry.falsePositiveGuards}`,
      );
    }
  }
});

Deno.test('returns_to_prior_issue falsePositiveGuards surface the verbatim misreadable-key doctrine guard', () => {
  const entry = FAMILY_I_PROMPT_ENTRIES.find((e) => e.rawKey === 'returns_to_prior_issue');
  if (!entry) throw new Error('returns_to_prior_issue prompt entry missing');
  const expectedFragments = [
    'returning to a prior issue is a structural RE-ENGAGEMENT',
    'It is NEVER framed as "rehashing", "repetitive", "going in circles", or "beating a dead horse"',
    're-engagement is often productive when it brings new evidence',
    'The output MUST NOT contain: rehashing, repetitive, "going in circles"',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `returns_to_prior_issue falsePositiveGuards missing verbatim doctrine fragment: "${fragment}". Got: ${entry.falsePositiveGuards}`,
      );
    }
  }
});

Deno.test('references_external_context falsePositiveGuards encode the popularity-is-not-evidence doctrine (§3)', () => {
  const entry = FAMILY_I_PROMPT_ENTRIES.find((e) => e.rawKey === 'references_external_context');
  if (!entry) throw new Error('references_external_context prompt entry missing');
  const expectedFragments = [
    'It NEVER treats the external reference as automatically granting the claim factual standing',
    'popularity / virality / engagement of an external source is NOT evidence',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `references_external_context falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('compares_options falsePositiveGuards forbid picking-a-winner verdict framing', () => {
  const entry = FAMILY_I_PROMPT_ENTRIES.find((e) => e.rawKey === 'compares_options');
  if (!entry) throw new Error('compares_options prompt entry missing');
  const expectedFragments = [
    'comparing options is a structural recovery-positive move',
    'It NEVER asserts which option is "correct", "better", or "wins" as a verdict',
    'The output MUST NOT contain: "the right option", "the correct choice", winner',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `compares_options falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});
