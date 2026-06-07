/**
 * MCP-SERVER-008-FAMILY-G — Family G keys constant test.
 *
 * Critical invariants:
 *   - FAMILY_G_RAW_KEYS contains exactly 21 entries (ai_classifier subset;
 *     18 baseline + 3 MCP-BUILD2g)
 *   - Verbatim binding match with design §A.1.1 18-key inventory + the 3
 *     MCP-BUILD2g booleans (Build-2 manifest §6)
 *   - The 12 deterministic keys (auto_metadata + lifecycle) are EXCLUDED by name
 *   - FAMILY_G_PROMPT_ENTRIES has 21 entries with one entry per rawKey
 *   - Every prompt entry has all required verbose-definition fields
 *   - FAMILY_G_CLASSIFIER_SET_VERSION === 'family-g-v1'
 *   - Per-key falsePositiveGuards for the verdict-adjacent keys contain the
 *     verbatim §A.3.2 resolution↔verdict doctrine guards (the axis-partner
 *     concedes_broader_point carries the strongest guard)
 *   - Declaration order preserved
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  FAMILY_G_RAW_KEYS,
  FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS,
  FAMILY_G_PROMPT_ENTRIES,
  FAMILY_G_CLASSIFIER_SET_VERSION,
} from '../lib/familyGKeys.ts';

/**
 * Binding list per MCP-SERVER-008-FAMILY-G design §A.1.1 + MCP-BUILD2g
 * (Build-2 manifest §6, +3 resolution-progress bookkeeping booleans).
 * 21 ai_classifier rawKeys, declaration order matching upstream familyG.ts.
 */
const BINDING_FAMILY_G_KEYS: readonly string[] = [
  'narrows_claim',
  'concedes_narrow_point',
  'ready_for_synthesis',
  'suggests_side_branch',
  'suggests_diagonal_tangent',
  'accepts_partial_with_caveat',
  'concedes_with_new_dispute',
  'proposes_settlement_terms',
  'accepts_settlement_terms',
  'concedes_broader_point',
  'common_ground_identified',
  'unresolved_point_isolated',
  'synthesis_proposed',
  'move_on_requested',
  'issue_closed_by_participant',
  'decision_criterion_proposed',
  'action_item_proposed',
  'followup_question_proposed',
  // MCP-BUILD2g (Build-2 manifest §6) — Subset 18 → 21.
  'records_remaining_disagreement',
  'defines_next_evidence_needed',
  'separates_normative_from_empirical',
];

/**
 * The 12 deterministic rawKeys (5 auto_metadata + 7 lifecycle) that the
 * MCP classifier EXCLUDES per Stage 2B operator binding. They must never
 * appear in FAMILY_G_RAW_KEYS (mirror Family D subset guard).
 */
const BINDING_FAMILY_G_EXCLUDED: readonly string[] = [
  'branch_suggested',
  'branch_created',
  'point_stalled',
  'point_exhausted',
  'synthesis_candidate',
  'narrowed',
  'conceded',
  'confirmed',
  'synthesis_ready',
  'exhausted',
  'branch_recommended',
  'archived_or_resolved',
];

Deno.test('FAMILY_G_RAW_KEYS contains exactly 21 entries (ai_classifier subset; 18 baseline + 3 MCP-BUILD2g)', () => {
  assertEquals(FAMILY_G_RAW_KEYS.length, 21);
});

Deno.test('FAMILY_G_RAW_KEYS contains all 21 binding rawKeys', () => {
  for (const key of BINDING_FAMILY_G_KEYS) {
    if (!FAMILY_G_RAW_KEYS.includes(key)) {
      throw new Error(`FAMILY_G_RAW_KEYS missing binding rawKey: ${key}`);
    }
  }
});

Deno.test('FAMILY_G_RAW_KEYS contains NO extra rawKeys beyond the binding list', () => {
  for (const key of FAMILY_G_RAW_KEYS) {
    if (!BINDING_FAMILY_G_KEYS.includes(key)) {
      throw new Error(`FAMILY_G_RAW_KEYS contains non-binding rawKey: ${key}`);
    }
  }
});

Deno.test('FAMILY_G_RAW_KEYS has no duplicate entries', () => {
  const seen = new Set<string>();
  for (const key of FAMILY_G_RAW_KEYS) {
    if (seen.has(key)) {
      throw new Error(`FAMILY_G_RAW_KEYS has duplicate rawKey: ${key}`);
    }
    seen.add(key);
  }
});

Deno.test('FAMILY_G_RAW_KEYS preserves declaration order (matches BINDING_FAMILY_G_KEYS index-by-index)', () => {
  for (let i = 0; i < BINDING_FAMILY_G_KEYS.length; i++) {
    assertEquals(
      FAMILY_G_RAW_KEYS[i],
      BINDING_FAMILY_G_KEYS[i],
      `FAMILY_G_RAW_KEYS[${i}] should be '${BINDING_FAMILY_G_KEYS[i]}' but got '${FAMILY_G_RAW_KEYS[i]}'`,
    );
  }
});

Deno.test('FAMILY_G_RAW_KEYS EXCLUDES all 12 deterministic auto_metadata + lifecycle keys by name', () => {
  // Stage 2B subset boundary: the 12 deterministic keys (5 auto_metadata +
  // 7 lifecycle) MUST NOT appear in the ai_classifier subset.
  for (const excluded of BINDING_FAMILY_G_EXCLUDED) {
    if (FAMILY_G_RAW_KEYS.includes(excluded)) {
      throw new Error(
        `FAMILY_G_RAW_KEYS contains excluded deterministic rawKey '${excluded}'. Stage 2B subset boundary violated.`,
      );
    }
  }
});

Deno.test('FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS contains exactly the 12 deterministic keys', () => {
  assertEquals(FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS.length, 12);
  for (const excluded of BINDING_FAMILY_G_EXCLUDED) {
    if (!FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS.includes(excluded)) {
      throw new Error(
        `FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS missing deterministic key: ${excluded}`,
      );
    }
  }
});

Deno.test('FAMILY_G_RAW_KEYS and FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS are disjoint', () => {
  for (const key of FAMILY_G_RAW_KEYS) {
    if (FAMILY_G_EXCLUDED_DETERMINISTIC_RAW_KEYS.includes(key)) {
      throw new Error(`rawKey '${key}' appears in both the subset and the excluded list`);
    }
  }
});

Deno.test('FAMILY_G_PROMPT_ENTRIES has 21 entries matching FAMILY_G_RAW_KEYS', () => {
  assertEquals(FAMILY_G_PROMPT_ENTRIES.length, 21);
  const promptKeys = FAMILY_G_PROMPT_ENTRIES.map((e) => e.rawKey);
  for (const key of FAMILY_G_RAW_KEYS) {
    if (!promptKeys.includes(key)) {
      throw new Error(`FAMILY_G_PROMPT_ENTRIES missing entry for rawKey: ${key}`);
    }
  }
});

Deno.test('FAMILY_G_PROMPT_ENTRIES declaration order matches FAMILY_G_RAW_KEYS', () => {
  for (let i = 0; i < FAMILY_G_RAW_KEYS.length; i++) {
    assertEquals(
      FAMILY_G_PROMPT_ENTRIES[i].rawKey,
      FAMILY_G_RAW_KEYS[i],
      `FAMILY_G_PROMPT_ENTRIES[${i}] rawKey mismatch`,
    );
  }
});

Deno.test('every FAMILY_G_PROMPT_ENTRIES entry has all required verbose-definition fields', () => {
  for (const entry of FAMILY_G_PROMPT_ENTRIES) {
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

Deno.test('FAMILY_G_CLASSIFIER_SET_VERSION is exactly "family-g-v1"', () => {
  assertEquals(FAMILY_G_CLASSIFIER_SET_VERSION, 'family-g-v1');
});

Deno.test('concedes_broader_point falsePositiveGuards surface the strongest axis-partner doctrine guard verbatim (HIGHEST RISK)', () => {
  // Design §A.3.2 BINDING: the per-key guard MUST contain the verbatim
  // doctrine anchor forbidding verdict framing. This is the existential
  // constraint of Family G (the broad relinquishment is the single key most
  // likely to be mis-framed as "this side lost").
  const entry = FAMILY_G_PROMPT_ENTRIES.find((e) => e.rawKey === 'concedes_broader_point');
  if (!entry) throw new Error('concedes_broader_point prompt entry missing');
  const expectedFragments = [
    'a broad concession is RELINQUISHMENT of the broader frame',
    'a SCORING REPAIR that resets standing for future rebuilding',
    'NEVER framed as "this side lost"',
    'The evidence_span MUST anchor the verbatim relinquishment',
    'NOT a judgment about who won',
    'its output MUST NOT echo "win" / "lost" / "beat"',
    'The output MUST NOT contain: won, lost, winner, loser, defeated, prevailed, capitulated, ahead, behind, "settled in favor"',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `concedes_broader_point falsePositiveGuards missing verbatim doctrine fragment: "${fragment}". Got: ${entry.falsePositiveGuards}`,
      );
    }
  }
});

Deno.test('concedes_narrow_point falsePositiveGuards forbid concession-as-defeat framing verbatim (MEDIUM RISK)', () => {
  const entry = FAMILY_G_PROMPT_ENTRIES.find((e) => e.rawKey === 'concedes_narrow_point');
  if (!entry) throw new Error('concedes_narrow_point prompt entry missing');
  const expectedFragments = [
    'a narrow concession is a SCORING REPAIR, never a defeat',
    'It NEVER frames the conceding participant as "wrong", "the loser", "defeated"',
    'The output MUST NOT contain the words won, lost, winner, loser, defeated, prevailed, capitulated, ahead, behind, "settled in favor"',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `concedes_narrow_point falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('synthesis_proposed falsePositiveGuards forbid synthesis-as-verdict framing verbatim (MEDIUM RISK)', () => {
  const entry = FAMILY_G_PROMPT_ENTRIES.find((e) => e.rawKey === 'synthesis_proposed');
  if (!entry) throw new Error('synthesis_proposed prompt entry missing');
  const expectedFragments = [
    'synthesis is a GAMEPLAY move, not a verdict about who won',
    "BOTH sides' elements are being combined; BOTH sides retain their standing",
    'It NEVER implies one side\'s position prevailed',
    'The output MUST NOT contain won, lost, winner, loser, defeated, prevailed, capitulated, ahead, behind, "settled in favor"',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `synthesis_proposed falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('proposes_settlement_terms falsePositiveGuards forbid settlement-as-adjudication framing verbatim (MEDIUM RISK)', () => {
  const entry = FAMILY_G_PROMPT_ENTRIES.find((e) => e.rawKey === 'proposes_settlement_terms');
  if (!entry) throw new Error('proposes_settlement_terms prompt entry missing');
  const expectedFragments = [
    'settlement / closure is PROCEDURAL, not adjudication',
    'It NEVER implies the point was "decided", "settled in X\'s favor"',
    'The output MUST NOT contain won, lost, winner, loser, defeated, prevailed, capitulated, ahead, behind, "settled in favor"',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `proposes_settlement_terms falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('accepts_settlement_terms falsePositiveGuards forbid acceptance-as-capitulation framing verbatim (MEDIUM RISK)', () => {
  const entry = FAMILY_G_PROMPT_ENTRIES.find((e) => e.rawKey === 'accepts_settlement_terms');
  if (!entry) throw new Error('accepts_settlement_terms prompt entry missing');
  const expectedFragments = [
    'acceptance of terms is PROCEDURAL closure, NEVER capitulation or "settled in X\'s favor"',
    'it NEVER means the accepting participant lost, was defeated, capitulated',
    'The output MUST NOT contain won, lost, winner, loser, defeated, prevailed, capitulated, ahead, behind, "settled in favor"',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `accepts_settlement_terms falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('issue_closed_by_participant falsePositiveGuards forbid closure-as-resolution-in-favor framing verbatim (MEDIUM RISK)', () => {
  const entry = FAMILY_G_PROMPT_ENTRIES.find((e) => e.rawKey === 'issue_closed_by_participant');
  if (!entry) throw new Error('issue_closed_by_participant prompt entry missing');
  const expectedFragments = [
    'participant-intrinsic closure is PROCEDURAL, not adjudication',
    'NEVER means the point was decided, settled in X\'s favor',
    'The output MUST NOT contain won, lost, winner, loser, defeated, prevailed, capitulated, ahead, behind, "settled in favor"',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `issue_closed_by_participant falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('concedes_with_new_dispute falsePositiveGuards forbid concession-as-defeat framing verbatim (MEDIUM RISK)', () => {
  const entry = FAMILY_G_PROMPT_ENTRIES.find((e) => e.rawKey === 'concedes_with_new_dispute');
  if (!entry) throw new Error('concedes_with_new_dispute prompt entry missing');
  const expectedFragments = [
    'the concession side is a SCORING REPAIR, never a defeat',
    'The output MUST NOT contain won, lost, winner, loser, defeated, prevailed, capitulated, ahead, behind, "settled in favor"',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `concedes_with_new_dispute falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});

Deno.test('move_on_requested falsePositiveGuards forbid forfeit framing verbatim (LOW-MEDIUM RISK)', () => {
  const entry = FAMILY_G_PROMPT_ENTRIES.find((e) => e.rawKey === 'move_on_requested');
  if (!entry) throw new Error('move_on_requested prompt entry missing');
  const expectedFragments = [
    'it is NEVER a forfeit, a loss, or a verdict that one side won',
    'The output MUST NOT contain won, lost, winner, loser, defeated, prevailed, capitulated, ahead, behind, "settled in favor"',
  ];
  for (const fragment of expectedFragments) {
    if (!entry.falsePositiveGuards.includes(fragment)) {
      throw new Error(
        `move_on_requested falsePositiveGuards missing verbatim fragment: "${fragment}"`,
      );
    }
  }
});
