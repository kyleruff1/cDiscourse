/**
 * FEEDBACK-001 (#898) — BooleanFeedbackBar.
 *
 * The two quiet ghost buttons under the ACTIVE opponent move (RingsideCard) and
 * inside the Map node popover: "Answered my point" / "Didn't answer it", plus an
 * optional contextual "Receipts?". One tap marks, a second tap retracts;
 * reversible, never required, never a modal. Pure presentation over a
 * ViewerMoveMarkState plus onMark / onUnmark handlers from useMoveMarks — the SAME
 * component + handlers in both lenses give capability parity by construction.
 *
 * Doctrine (cdiscourse-doctrine section 9 un-game-like, accessibility-targets):
 *   - A mark describes the MOVE, never the mover; nothing here can block posting.
 *   - Neutral STATUS tones only — NO red / green verdict colors. A marked
 *     "Didn't answer it" is not red; a marked "Answered my point" is not green.
 *   - Color is never the only signal: marked vs unmarked is carried by a check
 *     affix + a filled-vs-outline surface + a weight change (grayscale-legible).
 *   - Every button is at least 44 by 44 (a 32px visual plus hitSlop) and carries
 *     accessibilityRole / accessibilityLabel / accessibilityState (the marked flag
 *     rides accessibilityState.selected, not color).
 *   - Never rendered on own moves or for observers (the parent gates it); a
 *     belt-and-braces disabled prop renders the buttons inert if a stale observer
 *     ever reaches it.
 *   - Below the narrow breakpoint the pair collapses to a single overflow control.
 *
 * All comments are apostrophe-free for the uxOneOneTwoDoctrine scanner.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { MoveMarkCode, ViewerMoveMarkState } from './moveMarksModel';
import {
  MOVE_MARK_A11Y_LABEL,
  MOVE_MARK_LABEL,
  MOVE_MARK_PAIR_CODES,
  MOVE_MARK_RECEIPTS_CODE,
  MOVE_MARKS_BAR_COPY,
  type MoveMarkUiCode,
} from './moveMarksCopy';

/** Below this width the pair collapses behind a single overflow control. */
export const BOOLEAN_FEEDBACK_BAR_TINY_WIDTH = 340;

// Neutral slate tones (mirrors the RingsideCard ghost palette). NO red / green.
const GHOST_BG = '#1e293b';
const GHOST_BORDER = '#334155';
const MARKED_BG = '#334155';
const MARKED_BORDER = '#64748b';
const DISABLED_BG = '#1e293b';

export interface BooleanFeedbackBarProps {
  argumentId: string;
  /** This viewer's active marks on THIS move. */
  viewerState: ViewerMoveMarkState;
  /** When true, the optional contextual "Receipts?" button also renders. */
  showReceiptsRequested?: boolean;
  /** Belt-and-braces inert render (a stale observer). The parent normally gates. */
  disabled?: boolean;
  onMark: (argumentId: string, code: MoveMarkCode) => void;
  onUnmark: (argumentId: string, code: MoveMarkCode) => void;
  /** Quiet inline plain-language note after a failed / rejected tap. Never a code. */
  errorMessage?: string;
  /** Threaded for symmetry; the bar is transform-free so there is no motion to gate. */
  reduceMotion?: boolean;
  /** Test / responsive override; falls back to useWindowDimensions. */
  windowWidth?: number;
  testID?: string;
}

interface MarkButtonProps {
  code: MoveMarkUiCode;
  marked: boolean;
  disabled: boolean;
  onPress: () => void;
  testID: string;
}

function MarkButton({ code, marked, disabled, onPress, testID }: MarkButtonProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={MOVE_MARK_A11Y_LABEL[code]}
      accessibilityState={{ selected: marked, disabled }}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      testID={testID}
      style={[
        styles.button,
        marked ? styles.buttonMarked : styles.buttonUnmarked,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[styles.buttonText, marked ? styles.buttonTextMarked : styles.buttonTextUnmarked]}
      >
        {/* The check affix + the filled surface + the weight change carry the
            marked state; color is never the only signal. */}
        {marked ? `✓ ${MOVE_MARK_LABEL[code]}` : MOVE_MARK_LABEL[code]}
      </Text>
    </Pressable>
  );
}

export function BooleanFeedbackBar(props: BooleanFeedbackBarProps) {
  const {
    argumentId,
    viewerState,
    showReceiptsRequested,
    disabled = false,
    onMark,
    onUnmark,
    errorMessage,
    windowWidth,
    testID,
  } = props;

  const dims = useWindowDimensions();
  const effectiveWidth = typeof windowWidth === 'number' ? windowWidth : dims.width;
  const collapsed = effectiveWidth < BOOLEAN_FEEDBACK_BAR_TINY_WIDTH;
  const [overflowOpen, setOverflowOpen] = useState(false);

  const base = testID ?? `boolean-feedback-bar-${argumentId}`;

  const uiCodes: MoveMarkUiCode[] = [...MOVE_MARK_PAIR_CODES];
  if (showReceiptsRequested) uiCodes.push(MOVE_MARK_RECEIPTS_CODE);

  const toggle = (code: MoveMarkCode) => {
    if (disabled) return;
    if (viewerState[code]) onUnmark(argumentId, code);
    else onMark(argumentId, code);
  };

  // Tiny-width collapsed + not yet expanded: a single overflow control.
  if (collapsed && !overflowOpen) {
    return (
      <View style={styles.bar} accessibilityLabel={MOVE_MARKS_BAR_COPY.groupA11yLabel} testID={base}>
        <Pressable
          onPress={disabled ? undefined : () => setOverflowOpen(true)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={MOVE_MARKS_BAR_COPY.overflowA11yLabel}
          accessibilityState={{ disabled }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          testID={`${base}-overflow`}
          style={[styles.button, styles.buttonUnmarked, disabled && styles.buttonDisabled]}
        >
          <Text style={[styles.buttonText, styles.buttonTextUnmarked]}>
            {MOVE_MARKS_BAR_COPY.overflowGlyph}
          </Text>
        </Pressable>
        {errorMessage ? (
          <Text style={styles.errorNote} accessibilityLiveRegion="polite" testID={`${base}-error`}>
            {errorMessage}
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.bar} accessibilityLabel={MOVE_MARKS_BAR_COPY.groupA11yLabel} testID={base}>
      <View style={styles.row}>
        {uiCodes.map((code) => (
          <MarkButton
            key={code}
            code={code}
            marked={viewerState[code] === true}
            disabled={disabled}
            onPress={() => toggle(code)}
            testID={`${base}-${code}`}
          />
        ))}
      </View>
      {errorMessage ? (
        <Text style={styles.errorNote} accessibilityLiveRegion="polite" testID={`${base}-error`}>
          {errorMessage}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { marginTop: 10, alignSelf: 'stretch' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    minHeight: 32,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonUnmarked: { backgroundColor: GHOST_BG, borderWidth: 1, borderColor: GHOST_BORDER },
  buttonMarked: { backgroundColor: MARKED_BG, borderWidth: 2, borderColor: MARKED_BORDER },
  buttonDisabled: { backgroundColor: DISABLED_BG, opacity: 0.5 },
  buttonText: { fontSize: 12 },
  buttonTextUnmarked: { color: '#cbd5e1', fontWeight: '600' },
  buttonTextMarked: { color: '#f8fafc', fontWeight: '800' },
  errorNote: { color: '#94a3b8', fontSize: 11, marginTop: 6, fontStyle: 'italic' },
});
