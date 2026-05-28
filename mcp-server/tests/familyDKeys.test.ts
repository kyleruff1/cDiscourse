/**
 * MCP-SERVER-005-FAMILY-D — Family D keys constant test.
 *
 * Critical invariants:
 *   - FAMILY_D_RAW_KEYS contains exactly 19 entries (Subset path)
 *   - Verbatim binding match with Stage 2B operator-approved Subset
 *     (19 ai_classifier rawKeys, declaration order from upstream familyD.ts)
 *   - FAMILY_D_PROMPT_ENTRIES has 19 entries with one entry per rawKey
 *   - Every prompt entry has all required verbose-definition fields
 *   - FAMILY_D_CLASSIFIER_SET_VERSION === 'family-d-v1'
 *   - FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS encodes the 6 unique
 *     excluded deterministic rawKey strings (5 auto_metadata + 1
 *     unique-to-lifecycle 'sourced'; the 2 source-shared strings
 *     'source_requested' / 'quote_requested' are listed once)
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  FAMILY_D_RAW_KEYS,
  FAMILY_D_PROMPT_ENTRIES,
  FAMILY_D_CLASSIFIER_SET_VERSION,
  FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS,
} from '../lib/familyDKeys.ts';

/**
 * Binding list per MCP-SERVER-005-FAMILY-D Stage 2B operator decision
 * (Subset path), in declaration order matching the upstream source
 * `familyD.ts` ai_classifier-source entries (#9-#27 in the file's order).
 * The SET of 19 IS load-bearing for the wire contract.
 */
const BINDING_FAMILY_D_KEYS: readonly string[] = [
  'asks_for_evidence',
  'provides_evidence',
  'evidence_supports_claim',
  'creates_source_chain_gap',
  'opens_evidence_debt_marker',
  'closes_evidence_debt_marker',
  'supplies_corroborating_document',
  'source_provided',
  'quote_provided',
  'concrete_example_requested',
  'concrete_example_provided',
  'evidence_claim_present',
  'evidence_gap_present',
  'source_chain_repair',
  'anecdote_used',
  'statistic_used',
  'external_authority_used',
  'evidence_quality_questioned',
  'burden_request_present',
];

Deno.test('FAMILY_D_RAW_KEYS contains exactly 19 entries (Subset path)', () => {
  assertEquals(FAMILY_D_RAW_KEYS.length, 19);
});

Deno.test('FAMILY_D_RAW_KEYS contains all 19 binding rawKeys', () => {
  for (const key of BINDING_FAMILY_D_KEYS) {
    if (!FAMILY_D_RAW_KEYS.includes(key)) {
      throw new Error(`FAMILY_D_RAW_KEYS missing binding rawKey: ${key}`);
    }
  }
});

Deno.test('FAMILY_D_RAW_KEYS contains NO extra rawKeys beyond the Subset binding list', () => {
  for (const key of FAMILY_D_RAW_KEYS) {
    if (!BINDING_FAMILY_D_KEYS.includes(key)) {
      throw new Error(`FAMILY_D_RAW_KEYS contains non-binding rawKey: ${key}`);
    }
  }
});

Deno.test('FAMILY_D_RAW_KEYS has no duplicate entries', () => {
  const seen = new Set<string>();
  for (const key of FAMILY_D_RAW_KEYS) {
    if (seen.has(key)) {
      throw new Error(`FAMILY_D_RAW_KEYS has duplicate rawKey: ${key}`);
    }
    seen.add(key);
  }
});

Deno.test('FAMILY_D_PROMPT_ENTRIES has 19 entries matching FAMILY_D_RAW_KEYS', () => {
  assertEquals(FAMILY_D_PROMPT_ENTRIES.length, 19);
  const promptKeys = FAMILY_D_PROMPT_ENTRIES.map((e) => e.rawKey);
  for (const key of FAMILY_D_RAW_KEYS) {
    if (!promptKeys.includes(key)) {
      throw new Error(`FAMILY_D_PROMPT_ENTRIES missing entry for rawKey: ${key}`);
    }
  }
});

Deno.test('every FAMILY_D_PROMPT_ENTRIES entry has all required verbose-definition fields', () => {
  for (const entry of FAMILY_D_PROMPT_ENTRIES) {
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

Deno.test('FAMILY_D_CLASSIFIER_SET_VERSION is exactly "family-d-v1"', () => {
  assertEquals(FAMILY_D_CLASSIFIER_SET_VERSION, 'family-d-v1');
});

Deno.test('FAMILY_D_RAW_KEYS preserves declaration order (matches BINDING_FAMILY_D_KEYS index-by-index)', () => {
  // Per design §1.1 + Stage 2B record, declaration order is binding.
  // The server-side Subset mirror must list the 19 ai_classifier keys in
  // the same order as upstream familyD.ts entries #9-#27.
  for (let i = 0; i < BINDING_FAMILY_D_KEYS.length; i++) {
    assertEquals(
      FAMILY_D_RAW_KEYS[i],
      BINDING_FAMILY_D_KEYS[i],
      `FAMILY_D_RAW_KEYS[${i}] should be '${BINDING_FAMILY_D_KEYS[i]}' but got '${FAMILY_D_RAW_KEYS[i]}'`,
    );
  }
});

Deno.test('FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS lists the deterministic rawKeys excluded from the Subset', () => {
  // 5 unique auto_metadata strings + 1 unique-to-lifecycle 'sourced' = 6.
  // The 2 source-shared strings (source_requested, quote_requested) are
  // listed once because Subset path excludes BOTH source-type entries.
  const expected = [
    'has_evidence',
    'source_requested',
    'quote_requested',
    'source_attached',
    'quote_attached',
    'sourced',
  ];
  assertEquals(FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS.length, expected.length);
  for (const k of expected) {
    if (!FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS.includes(k)) {
      throw new Error(`FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS missing: ${k}`);
    }
  }
});

Deno.test('FAMILY_D_RAW_KEYS does NOT include any of the 8 excluded deterministic rawKeys', () => {
  // Stage 2B operator binding: the 5 auto_metadata + 3 lifecycle rawKeys
  // are intentionally absent from the Subset. Any inclusion would be a
  // HALT (#15 trigger surface).
  for (const excluded of FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS) {
    if (FAMILY_D_RAW_KEYS.includes(excluded)) {
      throw new Error(
        `FAMILY_D_RAW_KEYS contains an EXCLUDED deterministic rawKey: ${excluded}. Subset path violated.`,
      );
    }
  }
});
