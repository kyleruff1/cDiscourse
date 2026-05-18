/**
 * RULE-001 — Tests for the rule-to-UI affordance map.
 *
 * Pure-model coverage:
 *   - All 8 issue-mentioned codes resolve to the exact tool labels.
 *   - Unknown codes are suppressed (return null).
 *   - Returned `toolLabel`, `tooltipHint`, `composerLead` are plain English
 *     (no snake_case tokens, no internal codes, no verdict tokens).
 *   - `suggestedMove` values are within the published enum.
 *   - The map's key set matches `ALL_RULE_CODES`.
 *   - Normalisation handles whitespace, hyphens, and case variants.
 */

import {
  mapRuleToUiAffordance,
  mapRuleToUiAffordanceOrSuppress,
  RULE_TO_UI_AFFORDANCE,
  ALL_RULE_CODES,
  ALL_RULE_SUGGESTED_MOVES,
  type RuleCode,
  type RuleSuggestedMove,
} from '../src/features/rulesUx/ruleToUiMap';
import {
  toPlainLanguage,
  looksLikeInternalCode,
} from '../src/features/arguments/gameCopy';

const ISSUE_MAPPING: Array<[RuleCode, string]> = [
  ['source_chain', 'Ask for the source'],
  ['evidence_debt', 'Needs receipts'],
  ['scope', 'Narrow the claim'],
  ['definition', 'Define the term'],
  ['logic', 'Challenge the inference'],
  ['causal', 'Challenge the mechanism'],
  ['anti_amplification', 'Popularity is not proof'],
  ['synthesis_ready', 'Offer synthesis'],
];

const BANNED_VERDICT_TOKENS = /\b(winner|loser|liar|dishonest|bad faith|manipulative|extremist|propagandist|stupid|idiot|astroturfer|troll)\b/i;

describe('mapRuleToUiAffordance — issue-mentioned codes', () => {
  test.each(ISSUE_MAPPING)('%s → %s', (code, expectedLabel) => {
    const a = mapRuleToUiAffordance(code);
    expect(a).not.toBeNull();
    expect(a!.toolLabel).toBe(expectedLabel);
    expect(a!.code).toBe(code);
  });
});

describe('mapRuleToUiAffordance — unknown handling', () => {
  test('unknown code returns null', () => {
    expect(mapRuleToUiAffordance('not_a_real_axis')).toBeNull();
    expect(mapRuleToUiAffordance('completely-made-up')).toBeNull();
    expect(mapRuleToUiAffordance('')).toBeNull();
    expect(mapRuleToUiAffordance(null)).toBeNull();
    expect(mapRuleToUiAffordance(undefined)).toBeNull();
  });

  test('suppressing variant mirrors the base call', () => {
    for (const [code] of ISSUE_MAPPING) {
      expect(mapRuleToUiAffordanceOrSuppress(code)).toEqual(mapRuleToUiAffordance(code));
    }
    expect(mapRuleToUiAffordanceOrSuppress('unknown_axis_xyz')).toBeNull();
  });

  test('normalises whitespace, hyphens, case', () => {
    expect(mapRuleToUiAffordance('SOURCE_CHAIN')!.code).toBe('source_chain');
    expect(mapRuleToUiAffordance('source-chain')!.code).toBe('source_chain');
    expect(mapRuleToUiAffordance('  source_chain  ')!.code).toBe('source_chain');
    expect(mapRuleToUiAffordance('Source Chain')!.code).toBe('source_chain');
  });
});

describe('mapRuleToUiAffordance — output safety', () => {
  test('every label / hint / composer lead is plain English (no internal codes)', () => {
    for (const code of ALL_RULE_CODES) {
      const a = RULE_TO_UI_AFFORDANCE[code];
      const fields = [a.toolLabel, a.tooltipHint, a.composerLead];
      for (const field of fields) {
        expect(typeof field).toBe('string');
        expect(field.length).toBeGreaterThan(0);
        // Field should NOT look like a snake_case identifier.
        expect(looksLikeInternalCode(field)).toBe(false);
        // Field should NOT contain the underscore-bearing axis name verbatim.
        for (const otherCode of ALL_RULE_CODES) {
          expect(field).not.toContain(otherCode);
        }
      }
    }
  });

  test('no verdict / truth tokens in any visible field', () => {
    for (const code of ALL_RULE_CODES) {
      const a = RULE_TO_UI_AFFORDANCE[code];
      expect(a.toolLabel).not.toMatch(BANNED_VERDICT_TOKENS);
      expect(a.tooltipHint).not.toMatch(BANNED_VERDICT_TOKENS);
      expect(a.composerLead).not.toMatch(BANNED_VERDICT_TOKENS);
    }
  });

  test('suggestedMove values stay in the published enum', () => {
    const allowed = new Set<RuleSuggestedMove>(ALL_RULE_SUGGESTED_MOVES);
    for (const code of ALL_RULE_CODES) {
      const a = RULE_TO_UI_AFFORDANCE[code];
      expect(allowed.has(a.suggestedMove)).toBe(true);
    }
  });

  test('map key set equals ALL_RULE_CODES (declaration order)', () => {
    expect(Object.keys(RULE_TO_UI_AFFORDANCE)).toEqual([...ALL_RULE_CODES]);
  });

  test('all 8 issue-mentioned codes are present in ALL_RULE_CODES', () => {
    for (const [code] of ISSUE_MAPPING) {
      expect(ALL_RULE_CODES).toContain(code);
    }
  });
});

describe('mapRuleToUiAffordance — coexistence with toPlainLanguage', () => {
  test('every RuleCode also has a plain-language label', () => {
    for (const code of ALL_RULE_CODES) {
      const label = toPlainLanguage(code);
      expect(label).not.toBeNull();
      expect(typeof label).toBe('string');
      expect((label as string).length).toBeGreaterThan(0);
      expect(looksLikeInternalCode(label as string)).toBe(false);
    }
  });

  test('label and toolLabel are distinct concepts (different strings)', () => {
    // The label describes what the axis IS; the tool describes what to DO.
    // They are allowed to coincide for some codes (e.g., anti_amplification
    // shares "Popularity is not proof"), but for the majority of codes the
    // strings differ. Sanity-check at least 3 codes differ.
    let differ = 0;
    for (const code of ALL_RULE_CODES) {
      const label = toPlainLanguage(code);
      const tool = mapRuleToUiAffordance(code)!.toolLabel;
      if (label !== tool) differ++;
    }
    expect(differ).toBeGreaterThanOrEqual(3);
  });
});
