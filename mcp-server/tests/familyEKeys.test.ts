/**
 * MCP-SERVER-006-FAMILY-E + MCP-BUILD2e — Family E keys constant test.
 *
 * Critical invariants:
 *   - FAMILY_E_RAW_KEYS contains exactly 19 entries (16 + 3 MCP-BUILD2e;
 *     uniform ai_classifier)
 *   - Verbatim binding match with intent brief §1 + design §1 16-key inventory
 *     + Build-2 manifest §4 (3 argument-structure booleans)
 *   - FAMILY_E_PROMPT_ENTRIES has 19 entries with one entry per rawKey
 *   - Every prompt entry has all required verbose-definition fields
 *   - FAMILY_E_CLASSIFIER_SET_VERSION === 'family-e-v1' (no version bump)
 *   - Per-key falsePositiveGuards for the 3 doctrine-risk keys
 *     (slippery_slope / abductive_explanation / analogy_reasoning)
 *     contain verbatim guards forbidding fallacy/weak/invalid framing
 *   - Declaration order preserved
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  FAMILY_E_RAW_KEYS,
  FAMILY_E_PROMPT_ENTRIES,
  FAMILY_E_CLASSIFIER_SET_VERSION,
} from '../lib/familyEKeys.ts';

/**
 * Binding list: 16 MCP-SERVER-006-FAMILY-E intent brief §1 + design §1 + 3
 * MCP-BUILD2e Build-2 manifest §4. 19 ai_classifier rawKeys, declaration order
 * matching upstream familyE.ts.
 */
const BINDING_FAMILY_E_KEYS: readonly string[] = [
  'causal_reasoning_present',
  'analogy_reasoning_present',
  'example_reasoning_present',
  'authority_reasoning_present',
  'consequence_reasoning_present',
  'principle_reasoning_present',
  'definition_reasoning_present',
  'classification_reasoning_present',
  'precedent_reasoning_present',
  'means_end_reasoning_present',
  'tradeoff_reasoning_present',
  'abductive_explanation_present',
  'exception_reasoning_present',
  'slippery_slope_reasoning_present',
  'cost_benefit_reasoning_present',
  'risk_reasoning_present',
  // MCP-BUILD2e (Build-2 manifest §4) — argument-scheme structure booleans.
  'linked_premise_structure',
  'convergent_premise_structure',
  'enthymeme_gap_detected',
];

Deno.test('FAMILY_E_RAW_KEYS contains exactly 19 entries (uniform ai_classifier)', () => {
  assertEquals(FAMILY_E_RAW_KEYS.length, 19);
});

Deno.test('FAMILY_E_RAW_KEYS contains all 19 binding rawKeys', () => {
  for (const key of BINDING_FAMILY_E_KEYS) {
    if (!FAMILY_E_RAW_KEYS.includes(key)) {
      throw new Error(`FAMILY_E_RAW_KEYS missing binding rawKey: ${key}`);
    }
  }
});

Deno.test('FAMILY_E_RAW_KEYS contains NO extra rawKeys beyond the binding list', () => {
  for (const key of FAMILY_E_RAW_KEYS) {
    if (!BINDING_FAMILY_E_KEYS.includes(key)) {
      throw new Error(`FAMILY_E_RAW_KEYS contains non-binding rawKey: ${key}`);
    }
  }
});

Deno.test('FAMILY_E_RAW_KEYS has no duplicate entries', () => {
  const seen = new Set<string>();
  for (const key of FAMILY_E_RAW_KEYS) {
    if (seen.has(key)) {
      throw new Error(`FAMILY_E_RAW_KEYS has duplicate rawKey: ${key}`);
    }
    seen.add(key);
  }
});

Deno.test('FAMILY_E_RAW_KEYS preserves declaration order (matches BINDING_FAMILY_E_KEYS index-by-index)', () => {
  for (let i = 0; i < BINDING_FAMILY_E_KEYS.length; i++) {
    assertEquals(
      FAMILY_E_RAW_KEYS[i],
      BINDING_FAMILY_E_KEYS[i],
      `FAMILY_E_RAW_KEYS[${i}] should be '${BINDING_FAMILY_E_KEYS[i]}' but got '${FAMILY_E_RAW_KEYS[i]}'`,
    );
  }
});

Deno.test('FAMILY_E_PROMPT_ENTRIES has 19 entries matching FAMILY_E_RAW_KEYS', () => {
  assertEquals(FAMILY_E_PROMPT_ENTRIES.length, 19);
  const promptKeys = FAMILY_E_PROMPT_ENTRIES.map((e) => e.rawKey);
  for (const key of FAMILY_E_RAW_KEYS) {
    if (!promptKeys.includes(key)) {
      throw new Error(`FAMILY_E_PROMPT_ENTRIES missing entry for rawKey: ${key}`);
    }
  }
});

Deno.test('every FAMILY_E_PROMPT_ENTRIES entry has all required verbose-definition fields', () => {
  for (const entry of FAMILY_E_PROMPT_ENTRIES) {
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

Deno.test('FAMILY_E_CLASSIFIER_SET_VERSION is exactly "family-e-v1"', () => {
  assertEquals(FAMILY_E_CLASSIFIER_SET_VERSION, 'family-e-v1');
});

Deno.test('slippery_slope_reasoning_present falsePositiveGuards surfaces "is a SCHEME, never a fallacy" verbatim', () => {
  // Design §3 BINDING: the per-key guard MUST contain the verbatim doctrine
  // anchor forbidding fallacy framing. This is the existential constraint
  // of Card 3 (HALT trigger #18).
  const entry = FAMILY_E_PROMPT_ENTRIES.find((e) => e.rawKey === 'slippery_slope_reasoning_present');
  if (!entry) throw new Error('slippery_slope_reasoning_present prompt entry missing');
  const expectedFragments = [
    'slippery-slope is a SCHEME, never a fallacy',
    'consequence_probability_unclear, Family F',
    'evidenceSpan MUST be a verbatim quote',
    "MUST NOT contain words like 'fallacy'",
    "the model's own output must NOT echo or assert the fallacy framing",
    'anchor the chain pattern, not the fallacy framing',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `slippery_slope_reasoning_present falsePositiveGuards missing verbatim doctrine fragment: "${fragment}". Got: ${entry.falsePositiveGuards}`,
      );
    }
  }
});

Deno.test('abductive_explanation_present falsePositiveGuards surfaces "is a SCHEME, not a fallacy" verbatim', () => {
  // Design §3: abductive carries doctrine risk because Peirce's inference-
  // to-best-explanation is sometimes framed as fallacious. The guard MUST
  // explicitly forbid the fallacy framing.
  const entry = FAMILY_E_PROMPT_ENTRIES.find((e) => e.rawKey === 'abductive_explanation_present');
  if (!entry) throw new Error('abductive_explanation_present prompt entry missing');
  const expectedFragments = [
    'abductive explanation (Peirce: inference to best explanation) is a SCHEME, not a fallacy',
    'normal pattern in scientific argument',
    "MUST NOT contain words like 'fallacy', 'invalid', 'flawed', 'weak', 'wrong'",
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `abductive_explanation_present falsePositiveGuards missing verbatim doctrine fragment: "${fragment}". Got: ${entry.falsePositiveGuards}`,
      );
    }
  }
});

Deno.test('analogy_reasoning_present falsePositiveGuards surfaces "analogy is a SCHEME" verbatim', () => {
  // Design §3: analogy carries doctrine risk because Walton's analogy
  // scheme is sometimes framed as fallacious. The guard MUST explicitly
  // forbid the fallacy framing.
  const entry = FAMILY_E_PROMPT_ENTRIES.find((e) => e.rawKey === 'analogy_reasoning_present');
  if (!entry) throw new Error('analogy_reasoning_present prompt entry missing');
  const expectedFragments = [
    'analogy is a SCHEME (Walton). It is not a fallacy',
    'analogy_mapping_missing, Family F',
    "MUST NOT contain words like 'fallacy', 'fallacious', 'weak', 'invalid', 'flawed', 'bad reasoning', 'wrong'",
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `analogy_reasoning_present falsePositiveGuards missing verbatim doctrine fragment: "${fragment}". Got: ${entry.falsePositiveGuards}`,
      );
    }
  }
});

// ── MCP-BUILD2e — the 3 new argument-structure booleans ──────────────────

Deno.test('MCP-BUILD2e: the 3 new rawKeys are present in declaration order at the end', () => {
  assertEquals(FAMILY_E_RAW_KEYS[16], 'linked_premise_structure');
  assertEquals(FAMILY_E_RAW_KEYS[17], 'convergent_premise_structure');
  assertEquals(FAMILY_E_RAW_KEYS[18], 'enthymeme_gap_detected');
});

Deno.test('MCP-BUILD2e: each of the 3 new keys has a prompt entry asking its boolean question', () => {
  for (const rawKey of ['linked_premise_structure', 'convergent_premise_structure', 'enthymeme_gap_detected']) {
    const entry = FAMILY_E_PROMPT_ENTRIES.find((e) => e.rawKey === rawKey);
    if (!entry) throw new Error(`MCP-BUILD2e prompt entry missing for ${rawKey}`);
    if (entry.booleanQuestion.length < 20) {
      throw new Error(`MCP-BUILD2e prompt entry for ${rawKey} has too-short booleanQuestion`);
    }
  }
});

Deno.test('MCP-BUILD2e: enthymeme_gap_detected guard fences gap-is-not-a-verdict (no weakness verdict)', () => {
  // E3 is verdict-adjacent. The per-key guard MUST frame a gap as a structural
  // observation / invitation, never a verdict that the argument is weak/wrong.
  const entry = FAMILY_E_PROMPT_ENTRIES.find((e) => e.rawKey === 'enthymeme_gap_detected');
  if (!entry) throw new Error('enthymeme_gap_detected prompt entry missing');
  const guards = entry.falsePositiveGuards;
  const expectedFragments = [
    'gap-is-not-a-verdict',
    'never a verdict that the argument is weak',
    'an invitation to state the premise, not a defeat',
    'describes THIS REPLY, never the author',
  ];
  for (const fragment of expectedFragments) {
    if (!guards.includes(fragment)) {
      throw new Error(
        `enthymeme_gap_detected falsePositiveGuards missing verbatim fence fragment: "${fragment}". Got: ${guards}`,
      );
    }
  }
});

Deno.test('MCP-BUILD2e: the 3 new user-facing prompt labels never surface the raw theory terms', () => {
  // GATE-A §8.2 rule 4: theory terms linked / convergent / enthymeme stay
  // INTERNAL. The prompt-entry LABEL is a user-facing-adjacent string; it must
  // be plain-language and must NOT contain the raw theory term. (The
  // booleanQuestion / definitions are classifier-facing and MAY name the term.)
  const labelByKey: Record<string, string> = {};
  for (const e of FAMILY_E_PROMPT_ENTRIES) labelByKey[e.rawKey] = e.label;
  for (const term of ['linked', 'convergent', 'enthymeme']) {
    for (const rawKey of ['linked_premise_structure', 'convergent_premise_structure', 'enthymeme_gap_detected']) {
      const re = new RegExp(`\\b${term}\\b`, 'i');
      if (re.test(labelByKey[rawKey])) {
        throw new Error(
          `MCP-BUILD2e: label for ${rawKey} surfaces the raw theory term "${term}": "${labelByKey[rawKey]}"`,
        );
      }
    }
  }
});
