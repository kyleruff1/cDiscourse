/**
 * MCP-SERVER-002 + MCP-BUILD2b — Family A keys constant test.
 *
 * Critical invariants:
 *   - FAMILY_A_RAW_KEYS contains exactly 19 entries (16 + 3 MCP-BUILD2b)
 *   - Verbatim binding match with intent brief Decision 1 + Build-2 manifest §1
 *   - FAMILY_A_PROMPT_ENTRIES has 19 entries with one entry per rawKey
 *   - Every prompt entry has all required verbose-definition fields
 *   - FAMILY_A_CLASSIFIER_SET_VERSION === 'family-a-v1'
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  FAMILY_A_RAW_KEYS,
  FAMILY_A_PROMPT_ENTRIES,
  FAMILY_A_CLASSIFIER_SET_VERSION,
} from '../lib/familyAKeys.ts';

/**
 * Binding list: 16 MCP-SERVER-002 intent brief Decision 1 + 3 MCP-BUILD2b
 * Build-2 manifest §1. Order is NOT load-bearing for the wire contract, but
 * the SET of 19 IS load-bearing.
 */
const BINDING_FAMILY_A_KEYS: readonly string[] = [
  'supports_parent',
  'challenges_parent',
  'refines_parent',
  'extends_parent',
  'distinguishes_parent',
  'reframes_parent',
  'questions_parent',
  'summarizes_parent',
  'acknowledges_parent',
  'corrects_parent_detail',
  'contrasts_with_parent',
  'answers_parent_question',
  'has_rebuttal',
  'has_counter_rebuttal',
  'rebutted',
  'quote_anchors_parent',
  // MCP-BUILD2b (Build-2 manifest §1) — parent-relation quality booleans.
  'acknowledges_parent_strength',
  'compares_parent_to_sibling_branch',
  'identifies_parent_scope_limit',
];

Deno.test('FAMILY_A_RAW_KEYS contains exactly 19 entries', () => {
  assertEquals(FAMILY_A_RAW_KEYS.length, 19);
});

Deno.test('FAMILY_A_RAW_KEYS contains all 19 binding rawKeys', () => {
  for (const key of BINDING_FAMILY_A_KEYS) {
    if (!FAMILY_A_RAW_KEYS.includes(key)) {
      throw new Error(`FAMILY_A_RAW_KEYS missing binding rawKey: ${key}`);
    }
  }
});

Deno.test('FAMILY_A_RAW_KEYS contains NO extra rawKeys beyond the binding list', () => {
  for (const key of FAMILY_A_RAW_KEYS) {
    if (!BINDING_FAMILY_A_KEYS.includes(key)) {
      throw new Error(`FAMILY_A_RAW_KEYS contains non-binding rawKey: ${key}`);
    }
  }
});

Deno.test('FAMILY_A_RAW_KEYS has no duplicate entries', () => {
  const seen = new Set<string>();
  for (const key of FAMILY_A_RAW_KEYS) {
    if (seen.has(key)) {
      throw new Error(`FAMILY_A_RAW_KEYS has duplicate rawKey: ${key}`);
    }
    seen.add(key);
  }
});

Deno.test('FAMILY_A_PROMPT_ENTRIES has 19 entries matching FAMILY_A_RAW_KEYS', () => {
  assertEquals(FAMILY_A_PROMPT_ENTRIES.length, 19);
  const promptKeys = FAMILY_A_PROMPT_ENTRIES.map((e) => e.rawKey);
  for (const key of FAMILY_A_RAW_KEYS) {
    if (!promptKeys.includes(key)) {
      throw new Error(`FAMILY_A_PROMPT_ENTRIES missing entry for rawKey: ${key}`);
    }
  }
});

Deno.test('every FAMILY_A_PROMPT_ENTRIES entry has all required verbose-definition fields', () => {
  for (const entry of FAMILY_A_PROMPT_ENTRIES) {
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

Deno.test('FAMILY_A_CLASSIFIER_SET_VERSION is exactly "family-a-v1"', () => {
  assertEquals(FAMILY_A_CLASSIFIER_SET_VERSION, 'family-a-v1');
});
