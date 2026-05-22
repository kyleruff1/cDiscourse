/**
 * MCP-019 — SemanticOverrideChoiceSheet: the deferred MCP-015 choice surface.
 *
 * The inline (non-modal) sheet MCP-015 §8 fully specified and deferred. It
 * lets a participant reverse an uncertain semantic routing suggestion without
 * leaving the room. MCP-019 is its home.
 *
 * RN primitives only — `View` / `Text` / `Pressable` / `AccessibilityInfo`.
 * No new dependency. Renders NOTHING when the prompt does not offer the
 * surface (`shouldOffer === false` — e.g. an observer, or a confident packet).
 *
 * Doctrine (MCP-019 §2, §5, §8; cdiscourse-doctrine §1; accessibility-targets):
 *   - The override choice is NEVER a penalty — confirming writes only an
 *     in-memory `SemanticOverrideRecord` (built by the caller). This component
 *     calls no scoring path and authors no "you were warned" copy.
 *   - It is an INLINE sheet, never a `Modal` — no route transition.
 *   - Every string comes from `gameCopy.PLAIN_LANGUAGE_COPY`; this component
 *     authors zero user-facing copy.
 *   - Color is never the only signal: the selected lane carries a check glyph
 *     + a heavier border + bold text.
 *   - Every interactive element is ≥ 44×44 (`hitSlop` where the chip is
 *     smaller). Lanes are `radio`; the answers-parent toggle is `checkbox`;
 *     confirm is `button`.
 *   - Reduce-motion: the sheet snaps in — no slide / fade.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { toPlainLanguage } from './gameCopy';
import type { SemanticOverrideLane, SemanticOverridePrompt } from '../semanticOverride/types';
import { ALL_SEMANTIC_OVERRIDE_LANES } from '../semanticOverride/types';

/** A confirmed choice — handed back to the caller, which builds the record. */
export interface SemanticOverrideChoice {
  chosenLane: SemanticOverrideLane;
  assertsAnswersParent: boolean;
}

/** Uniform ≥ 44×44 hit target for the smaller chips. */
export const OVERRIDE_SHEET_HIT_SLOP = Object.freeze({
  top: 10,
  bottom: 10,
  left: 10,
  right: 10,
});

/** Per-lane plain-language copy code (a key of `PLAIN_LANGUAGE_COPY`). */
const LANE_COPY_CODE: Readonly<Record<SemanticOverrideLane, string>> = Object.freeze({
  mainline: 'semantic_override_lane_mainline',
  branch: 'semantic_override_lane_branch',
  tangent: 'semantic_override_lane_tangent',
});

/**
 * Pure label resolver for one lane. Returns the plain-language string from
 * `gameCopy`; falls back to the bare lane word only if the code is somehow
 * unmapped (it is mapped — this is a defensive guard, never reached).
 */
export function resolveLaneLabel(lane: SemanticOverrideLane): string {
  return toPlainLanguage(LANE_COPY_CODE[lane]) ?? lane;
}

/**
 * Pure resolver for the confirm-button label. The label is
 * `semantic_override_confirm_changed` ("Set the lane") when the user picked a
 * lane different from the referee's suggestion OR asserted "answers the
 * parent"; otherwise `semantic_override_confirm_keep` ("Keep referee
 * suggestion"). It is a copy choice only — confirming either way is allowed
 * and is never a penalty.
 */
export function resolveConfirmLabel(args: {
  suggestedLane: SemanticOverrideLane;
  chosenLane: SemanticOverrideLane;
  assertsAnswersParent: boolean;
}): string {
  const changed = args.chosenLane !== args.suggestedLane || args.assertsAnswersParent;
  const code = changed
    ? 'semantic_override_confirm_changed'
    : 'semantic_override_confirm_keep';
  return toPlainLanguage(code) ?? code;
}

interface Props {
  /** The MCP-015 trigger-model output. `shouldOffer === false` → renders nothing. */
  prompt: SemanticOverridePrompt | null | undefined;
  /** Called with the confirmed choice when the user taps confirm. */
  onConfirm: (choice: SemanticOverrideChoice) => void;
  /**
   * PR-001 — effective reduce-motion preference. When true the sheet snaps in
   * (the component never animates regardless — accepted for parity + an
   * explicit no-motion test).
   */
  reduceMotionOverride?: boolean;
}

/**
 * Render the inline override choice sheet, or nothing when the prompt does not
 * offer it. The `prompt.suggestedLane` is pre-selected; the answers-parent
 * checkbox is shown only when `prompt.offersAnswersParentToggle`.
 */
export function SemanticOverrideChoiceSheet({ prompt, onConfirm, reduceMotionOverride }: Props) {
  const shouldOffer = prompt?.shouldOffer === true;
  const suggestedLane: SemanticOverrideLane = prompt?.suggestedLane ?? 'mainline';
  const offersAnswersParentToggle = prompt?.offersAnswersParentToggle === true;
  const promptCopyCode = prompt?.promptCopyCode ?? '';

  const [chosenLane, setChosenLane] = useState<SemanticOverrideLane>(suggestedLane);
  const [assertsAnswersParent, setAssertsAnswersParent] = useState(false);

  // Re-seed the pre-selected lane if the prompt's suggestion changes (a new
  // move became the override subject).
  useEffect(() => {
    setChosenLane(suggestedLane);
    setAssertsAnswersParent(false);
  }, [suggestedLane, promptCopyCode]);

  const headline = useMemo(() => toPlainLanguage(promptCopyCode) ?? '', [promptCopyCode]);
  const confirmLabel = resolveConfirmLabel({
    suggestedLane,
    chosenLane,
    assertsAnswersParent,
  });
  const answersParentLabel = toPlainLanguage('semantic_override_answers_parent') ?? '';

  // The reduce-motion prop is accepted for parity; the sheet never animates.
  void reduceMotionOverride;

  if (!shouldOffer || !prompt) {
    return null;
  }

  const handleConfirm = () => {
    AccessibilityInfo.announceForAccessibility(confirmLabel);
    onConfirm({ chosenLane, assertsAnswersParent });
  };

  return (
    <View
      style={styles.sheet}
      accessibilityRole="radiogroup"
      accessibilityLabel={headline}
      testID="semantic-override-choice-sheet"
    >
      {headline.length > 0 ? <Text style={styles.headline}>{headline}</Text> : null}

      <View style={styles.laneRow}>
        {ALL_SEMANTIC_OVERRIDE_LANES.map((lane) => {
          const selected = lane === chosenLane;
          return (
            <Pressable
              key={lane}
              onPress={() => setChosenLane(lane)}
              hitSlop={OVERRIDE_SHEET_HIT_SLOP}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={resolveLaneLabel(lane)}
              style={[styles.laneChip, selected && styles.laneChipSelected]}
              testID={`semantic-override-lane-${lane}`}
            >
              {/* Non-color signal: a check glyph marks the selected lane. */}
              <Text style={styles.laneGlyph}>{selected ? '✓' : '○'}</Text>
              <Text style={[styles.laneText, selected && styles.laneTextSelected]}>
                {resolveLaneLabel(lane)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {offersAnswersParentToggle ? (
        <Pressable
          onPress={() => setAssertsAnswersParent((v) => !v)}
          hitSlop={OVERRIDE_SHEET_HIT_SLOP}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: assertsAnswersParent }}
          accessibilityLabel={answersParentLabel}
          style={styles.answersParentRow}
          testID="semantic-override-answers-parent"
        >
          <Text style={styles.answersParentGlyph}>{assertsAnswersParent ? '☑' : '☐'}</Text>
          <Text style={styles.answersParentText}>{answersParentLabel}</Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={handleConfirm}
        accessibilityRole="button"
        accessibilityLabel={confirmLabel}
        style={styles.confirmButton}
        testID="semantic-override-confirm"
      >
        <Text style={styles.confirmText}>{confirmLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    marginHorizontal: 8,
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#312e81',
    backgroundColor: '#0b1220',
  },
  headline: { color: '#a5b4fc', fontSize: 12, fontWeight: '700' as const, marginBottom: 8 },
  laneRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  laneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#111827',
  },
  laneChipSelected: { borderColor: '#a5b4fc', borderWidth: 2, backgroundColor: '#1e1b4b' },
  laneGlyph: { color: '#cbd5e1', fontSize: 13, fontWeight: '700' as const },
  laneText: { color: '#cbd5e1', fontSize: 11, fontWeight: '400' as const },
  laneTextSelected: { color: '#e2e8f0', fontWeight: '700' as const },
  answersParentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    minHeight: 44,
  },
  answersParentGlyph: { color: '#cbd5e1', fontSize: 14, fontWeight: '700' as const },
  answersParentText: { color: '#cbd5e1', fontSize: 11, flex: 1 },
  confirmButton: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: '#312e81',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { color: '#e2e8f0', fontSize: 12, fontWeight: '700' as const },
});
