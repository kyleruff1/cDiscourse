/**
 * MCP-019 — SemanticOverrideChoiceSheet tests.
 *
 * Pure-helper + source-scan, per the repo's UI test discipline. The sheet's
 * load-bearing decisions — the lane-label / confirm-label resolution from
 * gameCopy, the ≥ 44×44 hit targets, the radio / checkbox / button roles, the
 * render-nothing-when-not-offered rule, the not-a-Modal constraint, and the
 * doctrine ban-list — are exercised via the component's pure helpers plus a
 * source-scan of the component contract.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  OVERRIDE_SHEET_HIT_SLOP,
  resolveConfirmLabel,
  resolveLaneLabel,
} from '../src/features/arguments/SemanticOverrideChoiceSheet';
import { ALL_SEMANTIC_OVERRIDE_LANES } from '../src/features/semanticOverride/types';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'src/features/arguments/SemanticOverrideChoiceSheet.tsx'),
  'utf8',
);

describe('SemanticOverrideChoiceSheet — lane labels from gameCopy', () => {
  it('every lane resolves to a plain-language string', () => {
    for (const lane of ALL_SEMANTIC_OVERRIDE_LANES) {
      const label = resolveLaneLabel(lane);
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('no lane label looks like an internal code', () => {
    for (const lane of ALL_SEMANTIC_OVERRIDE_LANES) {
      expect(looksLikeInternalCode(resolveLaneLabel(lane))).toBe(false);
    }
  });

  it('the three lane labels are distinct', () => {
    const labels = ALL_SEMANTIC_OVERRIDE_LANES.map(resolveLaneLabel);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('SemanticOverrideChoiceSheet — confirm-button label', () => {
  it('reads "Keep referee suggestion" when the lane is unchanged + no parent assertion', () => {
    const label = resolveConfirmLabel({
      suggestedLane: 'mainline',
      chosenLane: 'mainline',
      assertsAnswersParent: false,
    });
    expect(label).toBe('Keep referee suggestion');
  });

  it('reads "Set the lane" when the chosen lane differs from the suggestion', () => {
    const label = resolveConfirmLabel({
      suggestedLane: 'mainline',
      chosenLane: 'branch',
      assertsAnswersParent: false,
    });
    expect(label).toBe('Set the lane');
  });

  it('reads "Set the lane" when the user asserts "answers the parent"', () => {
    const label = resolveConfirmLabel({
      suggestedLane: 'mainline',
      chosenLane: 'mainline',
      assertsAnswersParent: true,
    });
    expect(label).toBe('Set the lane');
  });

  it('neither confirm label looks like an internal code', () => {
    for (const changed of [true, false]) {
      const label = resolveConfirmLabel({
        suggestedLane: 'mainline',
        chosenLane: changed ? 'tangent' : 'mainline',
        assertsAnswersParent: false,
      });
      expect(looksLikeInternalCode(label)).toBe(false);
    }
  });
});

describe('SemanticOverrideChoiceSheet — accessibility', () => {
  it('the hit slop expands a smaller chip to >= 44 vertically', () => {
    // The lane chips have minHeight 44; the toggle row has minHeight 44.
    // The hit slop adds margin on all sides for the smaller chips.
    expect(OVERRIDE_SHEET_HIT_SLOP.top + OVERRIDE_SHEET_HIT_SLOP.bottom).toBeGreaterThanOrEqual(20);
    expect(OVERRIDE_SHEET_HIT_SLOP.left).toBeGreaterThanOrEqual(10);
    expect(OVERRIDE_SHEET_HIT_SLOP.right).toBeGreaterThanOrEqual(10);
  });

  it('lane options declare accessibilityRole="radio" with accessibilityState', () => {
    expect(SRC).toMatch(/accessibilityRole="radio"/);
    expect(SRC).toMatch(/accessibilityState=\{\{ selected \}\}/);
  });

  it('the answers-parent toggle declares accessibilityRole="checkbox"', () => {
    expect(SRC).toMatch(/accessibilityRole="checkbox"/);
    expect(SRC).toMatch(/accessibilityState=\{\{ checked: assertsAnswersParent \}\}/);
  });

  it('the confirm control declares accessibilityRole="button"', () => {
    expect(SRC).toMatch(/accessibilityRole="button"/);
  });

  it('the lane chips minHeight reaches the 44px target', () => {
    expect(SRC).toMatch(/minHeight: 44/);
  });

  it('announces the confirm label once on confirm', () => {
    expect(SRC).toMatch(/announceForAccessibility/);
  });

  it('accepts and references the reduceMotionOverride prop', () => {
    expect(SRC).toMatch(/reduceMotionOverride/);
  });
});

describe('SemanticOverrideChoiceSheet — non-color selection signal', () => {
  it('the selected lane carries a check glyph (a non-color marker)', () => {
    expect(SRC).toMatch(/selected \? '✓'/);
  });

  it('the answers-parent toggle carries a check-box glyph', () => {
    expect(SRC).toMatch(/assertsAnswersParent \? '☑'/);
  });
});

describe('SemanticOverrideChoiceSheet — render-nothing + non-modal', () => {
  it('returns null when the prompt does not offer the surface', () => {
    expect(SRC).toMatch(/if \(!shouldOffer/);
    expect(SRC).toMatch(/return null/);
  });

  it('reads prompt?.shouldOffer defensively', () => {
    expect(SRC).toMatch(/prompt\?\.shouldOffer/);
  });

  it('is NOT a Modal — the sheet is inline (TL-003 / SC-003 doctrine)', () => {
    // The doctrine concern is no Modal ELEMENT and no Modal import — a doc
    // comment that says "non-modal" is accurate documentation.
    expect(SRC).not.toMatch(/<Modal\b/);
    expect(SRC).not.toMatch(/import \{[^}]*\bModal\b[^}]*\} from ['"]react-native['"]/);
  });

  it('shows the answers-parent toggle only when offersAnswersParentToggle', () => {
    expect(SRC).toMatch(/offersAnswersParentToggle \?/);
  });
});

describe('SemanticOverrideChoiceSheet — confirm wiring', () => {
  it('calls onConfirm with the chosen lane + parent assertion', () => {
    expect(SRC).toMatch(/onConfirm\(\{ chosenLane, assertsAnswersParent \}\)/);
  });

  it('pre-selects the prompt suggestedLane', () => {
    expect(SRC).toMatch(/useState<SemanticOverrideLane>\(suggestedLane\)/);
  });
});

describe('SemanticOverrideChoiceSheet — RN primitives + doctrine', () => {
  it('imports only RN primitives from react-native', () => {
    const rnImport = SRC.match(/import \{([^}]*)\} from 'react-native'/);
    expect(rnImport).not.toBeNull();
    const named = (rnImport![1] || '').split(',').map((s) => s.trim()).filter(Boolean);
    for (const name of named) {
      expect(['AccessibilityInfo', 'Pressable', 'StyleSheet', 'Text', 'View']).toContain(name);
    }
  });

  it('every visible string comes from gameCopy — the sheet authors no copy', () => {
    // All user-facing copy resolves through `toPlainLanguage` (gameCopy,
    // already ban-list-tested in MCP-015). The component hard-codes no
    // display string: no <Text> opens with a literal letter — its children
    // are {headline} / {confirmLabel} / {resolveLaneLabel(...)} / glyphs.
    expect(SRC).toMatch(/toPlainLanguage/);
    expect(SRC).not.toMatch(/<Text\b[^>]*>[ \t]*[A-Za-z]/);
  });

  it('the lane / confirm / answers-parent copy resolves through gameCopy codes', () => {
    // Every visible copy string is a PLAIN_LANGUAGE_COPY code passed to
    // toPlainLanguage — never an inline authored sentence. The gameCopy
    // ban-list test (MCP-015) already proves those codes are verdict-free.
    expect(SRC).toMatch(/semantic_override_lane_/);
    expect(SRC).toMatch(/semantic_override_confirm_/);
    expect(SRC).toMatch(/semantic_override_answers_parent/);
  });

  it('writes no flag and calls no scoring path', () => {
    expect(SRC).not.toMatch(/\.from\(['"]flags['"]\)/);
    expect(SRC).not.toMatch(/scoreModel|argumentScore|pointStanding/i);
  });
});
