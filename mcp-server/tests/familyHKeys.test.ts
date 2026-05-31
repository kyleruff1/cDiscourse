/**
 * MCP-SERVER-009-FAMILY-H — Family H keys constant test.
 *
 * Critical invariants:
 *   - FAMILY_H_RAW_KEYS contains exactly 12 entries (uniform ai_classifier)
 *   - Verbatim binding match with design §A.1.1 12-key inventory
 *   - No FAMILY_H_EXCLUDED_DETERMINISTIC_RAW_KEYS constant (uniform source)
 *   - FAMILY_H_PROMPT_ENTRIES has 12 entries with one entry per rawKey
 *   - Every prompt entry has all required verbose-definition fields
 *   - FAMILY_H_CLASSIFIER_SET_VERSION === 'family-h-v1'
 *   - Per-key falsePositiveGuards for the 4 HIGHEST-risk keys contain the
 *     verbatim §A.3.2 clarity↔verdict doctrine guards (the axis-partner
 *     claim_specificity_low carries the strongest guard; conclusion_missing
 *     + reason_missing + unclear_reference_present each carry their own
 *     proportional verbatim guards)
 *   - Declaration order preserved
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  FAMILY_H_RAW_KEYS,
  FAMILY_H_PROMPT_ENTRIES,
  FAMILY_H_CLASSIFIER_SET_VERSION,
} from '../lib/familyHKeys.ts';

/**
 * Binding list per MCP-SERVER-009-FAMILY-H design §A.1.1.
 * 12 ai_classifier rawKeys, declaration order matching upstream familyH.ts.
 */
const BINDING_FAMILY_H_KEYS: readonly string[] = [
  'provides_temporal_constraint',
  'claim_present',
  'reason_present',
  'conclusion_missing',
  'reason_missing',
  'multiple_claims_present',
  'claim_specificity_high',
  'claim_specificity_low',
  'quantifier_present',
  'modal_language_present',
  'hedging_present',
  'unclear_reference_present',
];

Deno.test('FAMILY_H_RAW_KEYS contains exactly 12 entries (uniform ai_classifier)', () => {
  assertEquals(FAMILY_H_RAW_KEYS.length, 12);
});

Deno.test('FAMILY_H_RAW_KEYS contains all 12 binding rawKeys', () => {
  for (const key of BINDING_FAMILY_H_KEYS) {
    if (!FAMILY_H_RAW_KEYS.includes(key)) {
      throw new Error(`FAMILY_H_RAW_KEYS missing binding rawKey: ${key}`);
    }
  }
});

Deno.test('FAMILY_H_RAW_KEYS contains NO extra rawKeys beyond the binding list', () => {
  for (const key of FAMILY_H_RAW_KEYS) {
    if (!BINDING_FAMILY_H_KEYS.includes(key)) {
      throw new Error(`FAMILY_H_RAW_KEYS contains non-binding rawKey: ${key}`);
    }
  }
});

Deno.test('FAMILY_H_RAW_KEYS has no duplicate entries', () => {
  const seen = new Set<string>();
  for (const key of FAMILY_H_RAW_KEYS) {
    if (seen.has(key)) {
      throw new Error(`FAMILY_H_RAW_KEYS has duplicate rawKey: ${key}`);
    }
    seen.add(key);
  }
});

Deno.test('FAMILY_H_RAW_KEYS preserves declaration order (matches BINDING_FAMILY_H_KEYS index-by-index)', () => {
  for (let i = 0; i < BINDING_FAMILY_H_KEYS.length; i++) {
    assertEquals(
      FAMILY_H_RAW_KEYS[i],
      BINDING_FAMILY_H_KEYS[i],
      `FAMILY_H_RAW_KEYS[${i}] should be '${BINDING_FAMILY_H_KEYS[i]}' but got '${FAMILY_H_RAW_KEYS[i]}'`,
    );
  }
});

Deno.test('FAMILY_H_PROMPT_ENTRIES has 12 entries matching FAMILY_H_RAW_KEYS', () => {
  assertEquals(FAMILY_H_PROMPT_ENTRIES.length, 12);
  const promptKeys = FAMILY_H_PROMPT_ENTRIES.map((e) => e.rawKey);
  for (const key of FAMILY_H_RAW_KEYS) {
    if (!promptKeys.includes(key)) {
      throw new Error(`FAMILY_H_PROMPT_ENTRIES missing entry for rawKey: ${key}`);
    }
  }
});

Deno.test('FAMILY_H_PROMPT_ENTRIES declaration order matches FAMILY_H_RAW_KEYS', () => {
  for (let i = 0; i < FAMILY_H_RAW_KEYS.length; i++) {
    assertEquals(
      FAMILY_H_PROMPT_ENTRIES[i].rawKey,
      FAMILY_H_RAW_KEYS[i],
      `FAMILY_H_PROMPT_ENTRIES[${i}] rawKey mismatch`,
    );
  }
});

Deno.test('every FAMILY_H_PROMPT_ENTRIES entry has all required verbose-definition fields', () => {
  for (const entry of FAMILY_H_PROMPT_ENTRIES) {
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

Deno.test('FAMILY_H_CLASSIFIER_SET_VERSION is exactly "family-h-v1"', () => {
  assertEquals(FAMILY_H_CLASSIFIER_SET_VERSION, 'family-h-v1');
});

Deno.test('claim_specificity_low falsePositiveGuards surface the strongest axis-partner doctrine guard verbatim (HIGHEST RISK)', () => {
  // Design §A.3.2 BINDING: the per-key guard MUST contain the verbatim
  // doctrine anchor forbidding verdict framing. This is the existential
  // constraint of Family H (the broad claim is the single key most likely
  // to be mis-framed as "weak/vague/lazy/sloppy").
  const entry = FAMILY_H_PROMPT_ENTRIES.find((e) => e.rawKey === 'claim_specificity_low');
  if (!entry) throw new Error('claim_specificity_low prompt entry missing');
  const expectedFragments = [
    'a broad claim is a structural SHAPE',
    'NEVER framed as "weak", "vague", "lazy", "sloppy", "careless", "unclear", "unsound", or any quality verdict',
    'The evidence_span MUST anchor the verbatim broad-scoped wording',
    'its output MUST NOT echo "weak"/"vague"/"sloppy"/"lazy"',
    'The output MUST NOT contain: weak, sloppy, lazy, careless, confused, unsound, unsupported, incoherent, illogical, "bad reasoning", "bad argument", "argument is weak", "claim is weak", "claim fails"',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `claim_specificity_low falsePositiveGuards missing verbatim doctrine fragment: "${fragment}". Got: ${entry.falsePositiveGuards}`,
      );
    }
  }
});

Deno.test('conclusion_missing falsePositiveGuards forbid incompleteness-verdict framing verbatim (HIGHEST RISK)', () => {
  const entry = FAMILY_H_PROMPT_ENTRIES.find((e) => e.rawKey === 'conclusion_missing');
  if (!entry) throw new Error('conclusion_missing prompt entry missing');
  const expectedFragments = [
    'absence of a stated conclusion is a structural FORMULATION CHOICE',
    'It is NEVER framed as "argument is incomplete", "failed to conclude", "broken argument", "missing the point", or any incompleteness verdict',
    'The evidence_span MUST anchor the verbatim reasoning that builds toward the unstated conclusion',
    'The output MUST NOT contain: incomplete, unfinished, "argument is incomplete", "failed to", "broken"',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `conclusion_missing falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('reason_missing falsePositiveGuards forbid unsupported-verdict framing verbatim (HIGHEST RISK)', () => {
  const entry = FAMILY_H_PROMPT_ENTRIES.find((e) => e.rawKey === 'reason_missing');
  if (!entry) throw new Error('reason_missing prompt entry missing');
  const expectedFragments = [
    'absence of an attached reason is a structural FORMULATION CHOICE',
    'It is NEVER framed as "argument is unsupported", "claim is unsupported", "unjustified", "ungrounded", or any quality verdict',
    'The evidence_span MUST anchor the verbatim bare claim',
    'The output MUST NOT contain: unsupported, ungrounded, unjustified, "argument is unsupported", "claim is unsupported"',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `reason_missing falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('unclear_reference_present falsePositiveGuards forbid speaker-clarity verdict framing verbatim (HIGHEST RISK)', () => {
  const entry = FAMILY_H_PROMPT_ENTRIES.find((e) => e.rawKey === 'unclear_reference_present');
  if (!entry) throw new Error('unclear_reference_present prompt entry missing');
  const expectedFragments = [
    'presence of an ambiguous referring expression is a structural feature VISIBLE TO THE CLASSIFIER',
    'It is NEVER framed as the speaker being "unclear", "sloppy", "careless", "confused", or "imprecise"',
    'The evidence_span MUST anchor the verbatim ambiguous pronoun',
    'The output MUST NOT contain: unclear (as speaker label), sloppy, careless, confused, "the speaker was unclear", "the author was unclear", "imprecise writing"',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `unclear_reference_present falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('hedging_present falsePositiveGuards forbid uncertainty-verdict framing verbatim (MEDIUM RISK)', () => {
  const entry = FAMILY_H_PROMPT_ENTRIES.find((e) => e.rawKey === 'hedging_present');
  if (!entry) throw new Error('hedging_present prompt entry missing');
  const expectedFragments = [
    'presence of hedging language is a structural FORMULATION CHOICE',
    'It is NEVER framed as the speaker being "uncertain", "wishy-washy", "non-committal"',
    'Appropriately hedged claims carry LESS evidence debt than the same claim asserted with certainty',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `hedging_present falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('claim_present falsePositiveGuards forbid quality-verdict framing (MEDIUM RISK)', () => {
  const entry = FAMILY_H_PROMPT_ENTRIES.find((e) => e.rawKey === 'claim_present');
  if (!entry) throw new Error('claim_present prompt entry missing');
  const expectedFragments = [
    'presence of a claim is a structural FORMULATION CHOICE',
    'It is NEVER framed as the move being "strong" / "weak" / "well-formed" / "incomplete"',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `claim_present falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('reason_present falsePositiveGuards forbid quality-verdict framing (MEDIUM RISK)', () => {
  const entry = FAMILY_H_PROMPT_ENTRIES.find((e) => e.rawKey === 'reason_present');
  if (!entry) throw new Error('reason_present prompt entry missing');
  const expectedFragments = [
    'presence of an attached reason is a structural FORMULATION CHOICE',
    'It is NEVER framed as the reason being "good" / "sound" / "valid" / "strong"',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `reason_present falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('multiple_claims_present falsePositiveGuards forbid quality-verdict framing (MEDIUM RISK)', () => {
  const entry = FAMILY_H_PROMPT_ENTRIES.find((e) => e.rawKey === 'multiple_claims_present');
  if (!entry) throw new Error('multiple_claims_present prompt entry missing');
  const expectedFragments = [
    'multi-claim is a structural FORMULATION CHOICE',
    'It is NEVER framed as the move being "scattered", "disorganized", "confused"',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `multiple_claims_present falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});
