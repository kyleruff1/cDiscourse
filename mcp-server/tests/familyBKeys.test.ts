/**
 * MCP-SERVER-003-FAMILY-B + MCP-BUILD2a — Family B keys constant test.
 *
 * Critical invariants:
 *   - FAMILY_B_RAW_KEYS contains exactly 17 entries (14 + 3 MCP-BUILD2a)
 *   - Verbatim binding match with intent brief §3 + Build-2 addendum §5
 *   - FAMILY_B_PROMPT_ENTRIES has 17 entries with one entry per rawKey
 *   - Every prompt entry has all required verbose-definition fields
 *   - FAMILY_B_CLASSIFIER_SET_VERSION === 'family-b-v1'
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  FAMILY_B_RAW_KEYS,
  FAMILY_B_PROMPT_ENTRIES,
  FAMILY_B_CLASSIFIER_SET_VERSION,
} from '../lib/familyBKeys.ts';

/**
 * Binding list: 14 MCP-SERVER-003-FAMILY-B intent brief §3 + 3 MCP-BUILD2a
 * Build-2 addendum §5, in declaration order matching the upstream source
 * `familyB.ts`. The SET of 17 IS load-bearing for the wire contract.
 */
const BINDING_FAMILY_B_KEYS: readonly string[] = [
  'disputes_evidence_applicability',
  'disagreement_present',
  'disputes_definition',
  'disputes_scope',
  'disputes_fact',
  'disputes_causal_link',
  'disputes_value_weighting',
  'disputes_decision_criterion',
  'disputes_generalization',
  'disputes_analogy',
  'disputes_interpretation',
  'disputes_priority_order',
  'disputes_remedy_or_solution',
  'disputes_relevance',
  // MCP-BUILD2a (Build-2 addendum §5) — disagreement-quality booleans.
  'isolates_main_disagreement',
  'distinguishes_fact_value_disagreement',
  'preserves_face_while_disagreeing',
];

Deno.test('FAMILY_B_RAW_KEYS contains exactly 17 entries', () => {
  assertEquals(FAMILY_B_RAW_KEYS.length, 17);
});

Deno.test('FAMILY_B_RAW_KEYS contains all 17 binding rawKeys', () => {
  for (const key of BINDING_FAMILY_B_KEYS) {
    if (!FAMILY_B_RAW_KEYS.includes(key)) {
      throw new Error(`FAMILY_B_RAW_KEYS missing binding rawKey: ${key}`);
    }
  }
});

Deno.test('FAMILY_B_RAW_KEYS contains NO extra rawKeys beyond the binding list', () => {
  for (const key of FAMILY_B_RAW_KEYS) {
    if (!BINDING_FAMILY_B_KEYS.includes(key)) {
      throw new Error(`FAMILY_B_RAW_KEYS contains non-binding rawKey: ${key}`);
    }
  }
});

Deno.test('FAMILY_B_RAW_KEYS has no duplicate entries', () => {
  const seen = new Set<string>();
  for (const key of FAMILY_B_RAW_KEYS) {
    if (seen.has(key)) {
      throw new Error(`FAMILY_B_RAW_KEYS has duplicate rawKey: ${key}`);
    }
    seen.add(key);
  }
});

Deno.test('FAMILY_B_PROMPT_ENTRIES has 17 entries matching FAMILY_B_RAW_KEYS', () => {
  assertEquals(FAMILY_B_PROMPT_ENTRIES.length, 17);
  const promptKeys = FAMILY_B_PROMPT_ENTRIES.map((e) => e.rawKey);
  for (const key of FAMILY_B_RAW_KEYS) {
    if (!promptKeys.includes(key)) {
      throw new Error(`FAMILY_B_PROMPT_ENTRIES missing entry for rawKey: ${key}`);
    }
  }
});

Deno.test('every FAMILY_B_PROMPT_ENTRIES entry has all required verbose-definition fields', () => {
  for (const entry of FAMILY_B_PROMPT_ENTRIES) {
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

Deno.test('FAMILY_B_CLASSIFIER_SET_VERSION is exactly "family-b-v1"', () => {
  assertEquals(FAMILY_B_CLASSIFIER_SET_VERSION, 'family-b-v1');
});
