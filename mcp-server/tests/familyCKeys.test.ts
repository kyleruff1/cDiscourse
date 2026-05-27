/**
 * MCP-SERVER-004-FAMILY-C — Family C keys constant test.
 *
 * Critical invariants:
 *   - FAMILY_C_RAW_KEYS contains exactly 17 entries
 *   - Verbatim binding match with intent brief §3 (17 keys, declaration order)
 *   - FAMILY_C_PROMPT_ENTRIES has 17 entries with one entry per rawKey
 *   - Every prompt entry has all required verbose-definition fields
 *   - FAMILY_C_CLASSIFIER_SET_VERSION === 'family-c-v1'
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  FAMILY_C_RAW_KEYS,
  FAMILY_C_PROMPT_ENTRIES,
  FAMILY_C_CLASSIFIER_SET_VERSION,
} from '../lib/familyCKeys.ts';

/**
 * Binding list per MCP-SERVER-004-FAMILY-C intent brief §3, in declaration
 * order matching the upstream source `familyC.ts`. The SET of 17 IS
 * load-bearing for the wire contract.
 */
const BINDING_FAMILY_C_KEYS: readonly string[] = [
  'clarified',
  'requests_clarification',
  'answers_clarification',
  'provides_alternate_interpretation',
  'offers_candidate_understanding',
  'confirms_understanding',
  'rejects_candidate_understanding',
  'requests_restatement',
  'self_initiates_self_repair',
  'other_initiates_repair',
  'acknowledges_misread',
  'flags_ambiguous_reference',
  'flags_term_ambiguity',
  'proposes_shared_definition',
  'confirms_shared_definition',
  'scope_mismatch_identified',
  'question_answer_mismatch',
];

Deno.test('FAMILY_C_RAW_KEYS contains exactly 17 entries', () => {
  assertEquals(FAMILY_C_RAW_KEYS.length, 17);
});

Deno.test('FAMILY_C_RAW_KEYS contains all 17 binding rawKeys', () => {
  for (const key of BINDING_FAMILY_C_KEYS) {
    if (!FAMILY_C_RAW_KEYS.includes(key)) {
      throw new Error(`FAMILY_C_RAW_KEYS missing binding rawKey: ${key}`);
    }
  }
});

Deno.test('FAMILY_C_RAW_KEYS contains NO extra rawKeys beyond the binding list', () => {
  for (const key of FAMILY_C_RAW_KEYS) {
    if (!BINDING_FAMILY_C_KEYS.includes(key)) {
      throw new Error(`FAMILY_C_RAW_KEYS contains non-binding rawKey: ${key}`);
    }
  }
});

Deno.test('FAMILY_C_RAW_KEYS has no duplicate entries', () => {
  const seen = new Set<string>();
  for (const key of FAMILY_C_RAW_KEYS) {
    if (seen.has(key)) {
      throw new Error(`FAMILY_C_RAW_KEYS has duplicate rawKey: ${key}`);
    }
    seen.add(key);
  }
});

Deno.test('FAMILY_C_PROMPT_ENTRIES has 17 entries matching FAMILY_C_RAW_KEYS', () => {
  assertEquals(FAMILY_C_PROMPT_ENTRIES.length, 17);
  const promptKeys = FAMILY_C_PROMPT_ENTRIES.map((e) => e.rawKey);
  for (const key of FAMILY_C_RAW_KEYS) {
    if (!promptKeys.includes(key)) {
      throw new Error(`FAMILY_C_PROMPT_ENTRIES missing entry for rawKey: ${key}`);
    }
  }
});

Deno.test('every FAMILY_C_PROMPT_ENTRIES entry has all required verbose-definition fields', () => {
  for (const entry of FAMILY_C_PROMPT_ENTRIES) {
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

Deno.test('FAMILY_C_CLASSIFIER_SET_VERSION is exactly "family-c-v1"', () => {
  assertEquals(FAMILY_C_CLASSIFIER_SET_VERSION, 'family-c-v1');
});

Deno.test('FAMILY_C_RAW_KEYS preserves declaration order (matches BINDING_FAMILY_C_KEYS index-by-index)', () => {
  // Per intent brief §3, declaration order is binding. The server-side
  // mirror must list the 17 keys in the same order as familyC.ts.
  for (let i = 0; i < BINDING_FAMILY_C_KEYS.length; i++) {
    assertEquals(
      FAMILY_C_RAW_KEYS[i],
      BINDING_FAMILY_C_KEYS[i],
      `FAMILY_C_RAW_KEYS[${i}] should be '${BINDING_FAMILY_C_KEYS[i]}' but got '${FAMILY_C_RAW_KEYS[i]}'`,
    );
  }
});
