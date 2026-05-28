/**
 * MCP-SERVER-007-FAMILY-F — Family F keys constant test.
 *
 * Critical invariants:
 *   - FAMILY_F_RAW_KEYS contains exactly 14 entries (uniform ai_classifier)
 *   - Verbatim binding match with intent brief §2 + design §1 14-key inventory
 *   - FAMILY_F_PROMPT_ENTRIES has 14 entries with one entry per rawKey
 *   - Every prompt entry has all required verbose-definition fields
 *   - FAMILY_F_CLASSIFIER_SET_VERSION === 'family-f-v1'
 *   - Per-key falsePositiveGuards for the 6 doctrine-risk keys
 *     (consequence_probability_unclear / analogy_mapping_missing /
 *      alternative_explanation_available / causal_mechanism_missing /
 *      authority_basis_missing / missing_warrant) contain verbatim guards
 *     forbidding fallacy/weak/invalid/proves-wrong/invalidates/refutes framing
 *   - Declaration order preserved
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  FAMILY_F_RAW_KEYS,
  FAMILY_F_PROMPT_ENTRIES,
  FAMILY_F_CLASSIFIER_SET_VERSION,
} from '../lib/familyFKeys.ts';

/**
 * Binding list per MCP-SERVER-007-FAMILY-F intent brief §2 + design §1.
 * 14 ai_classifier rawKeys, declaration order matching upstream familyF.ts.
 */
const BINDING_FAMILY_F_KEYS: readonly string[] = [
  'missing_warrant',
  'unstated_assumption',
  'authority_basis_missing',
  'causal_mechanism_missing',
  'analogy_mapping_missing',
  'example_representativeness_unclear',
  'consequence_probability_unclear',
  'definition_boundary_unclear',
  'criterion_weighting_unclear',
  'alternative_explanation_available',
  'counterexample_available',
  'scope_limit_unstated',
  'qualification_missing',
  'comparison_baseline_missing',
];

Deno.test('FAMILY_F_RAW_KEYS contains exactly 14 entries (uniform ai_classifier)', () => {
  assertEquals(FAMILY_F_RAW_KEYS.length, 14);
});

Deno.test('FAMILY_F_RAW_KEYS contains all 14 binding rawKeys', () => {
  for (const key of BINDING_FAMILY_F_KEYS) {
    if (!FAMILY_F_RAW_KEYS.includes(key)) {
      throw new Error(`FAMILY_F_RAW_KEYS missing binding rawKey: ${key}`);
    }
  }
});

Deno.test('FAMILY_F_RAW_KEYS contains NO extra rawKeys beyond the binding list', () => {
  for (const key of FAMILY_F_RAW_KEYS) {
    if (!BINDING_FAMILY_F_KEYS.includes(key)) {
      throw new Error(`FAMILY_F_RAW_KEYS contains non-binding rawKey: ${key}`);
    }
  }
});

Deno.test('FAMILY_F_RAW_KEYS has no duplicate entries', () => {
  const seen = new Set<string>();
  for (const key of FAMILY_F_RAW_KEYS) {
    if (seen.has(key)) {
      throw new Error(`FAMILY_F_RAW_KEYS has duplicate rawKey: ${key}`);
    }
    seen.add(key);
  }
});

Deno.test('FAMILY_F_RAW_KEYS preserves declaration order (matches BINDING_FAMILY_F_KEYS index-by-index)', () => {
  for (let i = 0; i < BINDING_FAMILY_F_KEYS.length; i++) {
    assertEquals(
      FAMILY_F_RAW_KEYS[i],
      BINDING_FAMILY_F_KEYS[i],
      `FAMILY_F_RAW_KEYS[${i}] should be '${BINDING_FAMILY_F_KEYS[i]}' but got '${FAMILY_F_RAW_KEYS[i]}'`,
    );
  }
});

Deno.test('FAMILY_F_PROMPT_ENTRIES has 14 entries matching FAMILY_F_RAW_KEYS', () => {
  assertEquals(FAMILY_F_PROMPT_ENTRIES.length, 14);
  const promptKeys = FAMILY_F_PROMPT_ENTRIES.map((e) => e.rawKey);
  for (const key of FAMILY_F_RAW_KEYS) {
    if (!promptKeys.includes(key)) {
      throw new Error(`FAMILY_F_PROMPT_ENTRIES missing entry for rawKey: ${key}`);
    }
  }
});

Deno.test('every FAMILY_F_PROMPT_ENTRIES entry has all required verbose-definition fields', () => {
  for (const entry of FAMILY_F_PROMPT_ENTRIES) {
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

Deno.test('FAMILY_F_CLASSIFIER_SET_VERSION is exactly "family-f-v1"', () => {
  assertEquals(FAMILY_F_CLASSIFIER_SET_VERSION, 'family-f-v1');
});

Deno.test('consequence_probability_unclear falsePositiveGuards surface E↔F doctrine binding verbatim (HIGHEST RISK)', () => {
  // Design §3 BINDING: the per-key guard MUST contain the verbatim doctrine
  // anchor forbidding fallacy framing. This is the existential constraint
  // of Family F (HALT triggers #17, #18, #22).
  const entry = FAMILY_F_PROMPT_ENTRIES.find((e) => e.rawKey === 'consequence_probability_unclear');
  if (!entry) throw new Error('consequence_probability_unclear prompt entry missing');
  const expectedFragments = [
    'this is a CRITICAL QUESTION about probability anchoring, never a verdict',
    "Family E's slippery_slope_reasoning_present",
    'evidenceSpan MUST be a verbatim quote',
    "MUST NOT contain words like 'fallacy'",
    "the model's own output must NOT echo or assert the fallacy framing",
    'The evidenceSpan must anchor the probability gap, not the fallacy framing',
    'The CQ opens an inquiry; never closes one with a verdict',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `consequence_probability_unclear falsePositiveGuards missing verbatim doctrine fragment: "${fragment}". Got: ${entry.falsePositiveGuards}`,
      );
    }
  }
});

Deno.test('analogy_mapping_missing falsePositiveGuards surface F↔E partnership verbatim (MEDIUM RISK)', () => {
  // Design §3: analogy_mapping_missing pairs with Family E's
  // analogy_reasoning_present (E doctrine-risk #2). The guard MUST forbid
  // labeling analogy reasoning fallacious.
  const entry = FAMILY_F_PROMPT_ENTRIES.find((e) => e.rawKey === 'analogy_mapping_missing');
  if (!entry) throw new Error('analogy_mapping_missing prompt entry missing');
  const expectedFragments = [
    'this is a CRITICAL QUESTION about analogy mapping, never a verdict',
    "partners with Family E's analogy_reasoning_present",
    "MUST NOT contain words like 'fallacy'",
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `analogy_mapping_missing falsePositiveGuards missing verbatim doctrine fragment: "${fragment}". Got: ${entry.falsePositiveGuards}`,
      );
    }
  }
});

Deno.test('alternative_explanation_available falsePositiveGuards surface F↔E partnership verbatim (MEDIUM RISK)', () => {
  // Design §3: alternative_explanation_available pairs with Family E's
  // abductive_explanation_present (E doctrine-risk #3). The guard MUST
  // forbid labeling abductive reasoning fallacious.
  const entry = FAMILY_F_PROMPT_ENTRIES.find(
    (e) => e.rawKey === 'alternative_explanation_available',
  );
  if (!entry) throw new Error('alternative_explanation_available prompt entry missing');
  const expectedFragments = [
    'this is a CRITICAL QUESTION on abductive reasoning',
    'Peirce: inference to best explanation',
    'never a verdict that abductive reasoning is fallacious',
    "partners with Family E's abductive_explanation_present",
    "MUST NOT contain words like 'fallacy'",
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `alternative_explanation_available falsePositiveGuards missing verbatim doctrine fragment: "${fragment}". Got: ${entry.falsePositiveGuards}`,
      );
    }
  }
});

Deno.test('causal_mechanism_missing falsePositiveGuards surface F↔E partnership verbatim (MEDIUM RISK)', () => {
  // Design §3: causal_mechanism_missing pairs with Family E's
  // causal_reasoning_present.
  const entry = FAMILY_F_PROMPT_ENTRIES.find((e) => e.rawKey === 'causal_mechanism_missing');
  if (!entry) throw new Error('causal_mechanism_missing prompt entry missing');
  const expectedFragments = [
    'this is a CRITICAL QUESTION on causal scheme mechanism',
    'never a verdict that the causal claim is fallacious or false',
    "partners with Family E's causal_reasoning_present",
    "MUST NOT contain words like 'fallacy'",
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `causal_mechanism_missing falsePositiveGuards missing verbatim doctrine fragment: "${fragment}". Got: ${entry.falsePositiveGuards}`,
      );
    }
  }
});

Deno.test('authority_basis_missing falsePositiveGuards surface F↔E partnership verbatim (MEDIUM RISK)', () => {
  // Design §3: authority_basis_missing pairs with Family E's
  // authority_reasoning_present (Walton expert-authority scheme).
  const entry = FAMILY_F_PROMPT_ENTRIES.find((e) => e.rawKey === 'authority_basis_missing');
  if (!entry) throw new Error('authority_basis_missing prompt entry missing');
  const expectedFragments = [
    "this is a CRITICAL QUESTION on Walton's expert-authority scheme",
    'never a verdict that the authority appeal is fallacious',
    "MUST NOT contain words like 'fallacy'",
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `authority_basis_missing falsePositiveGuards missing verbatim doctrine fragment: "${fragment}". Got: ${entry.falsePositiveGuards}`,
      );
    }
  }
});

Deno.test('missing_warrant falsePositiveGuards surface Toulmin warrant doctrine verbatim (MEDIUM RISK)', () => {
  // Design §3: missing_warrant is graded MEDIUM risk because Toulmin's
  // warrant absence is sometimes literature-framed as "argument failure".
  const entry = FAMILY_F_PROMPT_ENTRIES.find((e) => e.rawKey === 'missing_warrant');
  if (!entry) throw new Error('missing_warrant prompt entry missing');
  const expectedFragments = [
    "this is a CRITICAL QUESTION on Toulmin's warrant structure",
    'never a verdict that the argument is unwarranted, invalid, or wrong',
    "'what would warrant this claim?'",
    "MUST NOT contain words like 'fallacy'",
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `missing_warrant falsePositiveGuards missing verbatim doctrine fragment: "${fragment}". Got: ${entry.falsePositiveGuards}`,
      );
    }
  }
});
