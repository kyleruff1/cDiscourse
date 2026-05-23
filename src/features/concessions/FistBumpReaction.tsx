/**
 * QOL-041 — FistBumpReaction.
 *
 * The acknowledgment affordance shown on a node (QOL-041 design §7.3).
 * A small Pressable with a fist-bump glyph + "Acknowledge"; tapping
 * toggles the viewer's reaction via the SHIPPED `react-to-move` Edge
 * Function. It is a QOL-030/031 **direct entry** — tapping does NOT
 * open the box.
 *
 * Doctrine (QOL-041 §11):
 *
 *   1. **No score, no standing change.** The component RENDERS the
 *      summary `{ fistBumpCount, viewerHasReacted }` produced by
 *      `summarizeReactions`. There is no path from this component to
 *      a `PointStandingDelta` (no point-standing import).
 *   2. **Single-value reaction.** v1 vocabulary is `fist_bump` only;
 *      the component cannot render any other reaction kind.
 *   3. **Plain language only.** Labels are "Acknowledge" /
 *      "fist-bumped" — never "agree", "like", "upvote", "approve".
 *   4. **Optional tiny count** ("·3") rendered from the summary's
 *      `fistBumpCount`. Never stored on a server; never feeds standing.
 *      (QOL-041 §15 Q5 default — count is shown.)
 *   5. **Screen reader.** Announced as a toggle: "Acknowledge this
 *      point. Button. Not fist-bumped." → "…Fist-bumped." Never a
 *      vote-tally.
 *   6. **44px target.**
 *
 * Pure presentation + an onToggle callback. No Supabase, no fetch — the
 * parent wires the `reactToMove` call.
 */
import React, { useCallback, type ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MoveReactionSummary } from './moveReactionModel';
import { SURFACE_TOKENS, RADIUS, SPACING } from '../../lib/designTokens';

// ── Plain-language copy ───────────────────────────────────────

/**
 * The user-facing copy this component authors. Scanned by
 * `__tests__/qol041-doctrine.test.ts` for the verdict + amplification
 * ban-list (no "like", no "agree", no "approve").
 */
export const FIST_BUMP_COPY = Object.freeze({
  /** Default label — viewer has NOT reacted. */
  label: 'Acknowledge',
  /** Label after the viewer toggles on. */
  labelReacted: 'Acknowledge',
  /** Indicator suffix when the viewer has reacted. */
  reactedIndicator: ' ✓', // a check mark — color-independent signal
  /** Screen-reader prefix when not reacted. */
  a11yPrefixNotReacted: 'Acknowledge this point.',
  /** Screen-reader prefix when reacted. */
  a11yPrefixReacted: 'You acknowledged this point.',
  /** Screen-reader suffix: tap-to-toggle. */
  a11ySuffixNotReacted: 'Button. Tap to fist-bump.',
  /** Screen-reader suffix when toggled on. */
  a11ySuffixReacted: 'Button. Tap to remove your fist-bump.',
  /** Pluralized count copy for screen readers (n includes the viewer). */
  countA11y: (n: number): string =>
    n === 1 ? '1 fist-bump' : `${n} fist-bumps`,
  /** Hidden-from-SR own-move state. */
  ownMoveDisabledHint: 'You cannot fist-bump your own point.',
});

// ── Props ─────────────────────────────────────────────────────

export interface FistBumpReactionProps {
  /** The render-only summary from `summarizeReactions(rows, viewerId)`. */
  summary: MoveReactionSummary;
  /** Called when the viewer taps. Parent invokes `reactToMove` with the
   *  appropriate action ('add' or 'remove'). The parent is the side
   *  that knows the room id + move id; this component is pure UI. */
  onToggle: () => void;
  /** True when the viewer authored the move (own-bubble guard — the
   *  affordance is HIDDEN, not just disabled, on one's own move per
   *  the design §8 "Own bubble" doctrine). */
  isOwnMove?: boolean;
  /** True while the parent's `reactToMove` call is in flight. */
  isSubmitting?: boolean;
  /** When false, the count "·N" is suppressed (design §15 Q5
   *  alternative). Defaults to true. */
  showCount?: boolean;
  /** Test id for the root pressable. */
  testID?: string;
}

const HIT_SLOP = Object.freeze({ top: 10, bottom: 10, left: 10, right: 10 });

// ── Component ─────────────────────────────────────────────────

/**
 * Renders the affordance. Hidden entirely on the viewer's own move (per
 * design §8); never a disabled-with-reason on one's own bubble — the
 * affordance must not exist there at all.
 */
export function FistBumpReaction({
  summary,
  onToggle,
  isOwnMove = false,
  isSubmitting = false,
  showCount = true,
  testID = 'fist-bump-reaction',
}: FistBumpReactionProps): ReactElement | null {
  // Hooks must run in the same order on every render — the early-
  // return for `isOwnMove` happens AFTER hook declarations to keep the
  // hook order stable across renders.
  const handlePress = useCallback(() => {
    if (isSubmitting) return;
    onToggle();
  }, [isSubmitting, onToggle]);

  // Own-move: render NOTHING (consistent with QOL-030 own-bubble
  // doctrine — no reaction / score affordances on one's own bubble).
  if (isOwnMove) {
    return null;
  }

  const { fistBumpCount, viewerHasReacted } = summary;

  // Compose the screen-reader label so a tap-target announcement
  // includes both the current state and the action.
  const a11yLabel = [
    viewerHasReacted
      ? FIST_BUMP_COPY.a11yPrefixReacted
      : FIST_BUMP_COPY.a11yPrefixNotReacted,
    showCount && fistBumpCount > 0
      ? FIST_BUMP_COPY.countA11y(fistBumpCount)
      : '',
    viewerHasReacted
      ? FIST_BUMP_COPY.a11ySuffixReacted
      : FIST_BUMP_COPY.a11ySuffixNotReacted,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Pressable
      onPress={handlePress}
      disabled={isSubmitting}
      accessibilityRole="button"
      accessibilityState={{ selected: viewerHasReacted, disabled: isSubmitting }}
      accessibilityLabel={a11yLabel}
      hitSlop={HIT_SLOP}
      style={[
        styles.button,
        viewerHasReacted && styles.buttonReacted,
        isSubmitting && styles.buttonSubmitting,
      ]}
      testID={testID}
    >
      <Text
        style={styles.glyph}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        {'\u{1F44A} '}
      </Text>
      <Text style={[styles.label, viewerHasReacted && styles.labelReacted]}>
        {viewerHasReacted ? FIST_BUMP_COPY.labelReacted : FIST_BUMP_COPY.label}
      </Text>
      {viewerHasReacted && (
        <Text
          style={styles.checkMark}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {FIST_BUMP_COPY.reactedIndicator}
        </Text>
      )}
      {showCount && fistBumpCount > 0 && (
        <View
          style={styles.countWrapper}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          <Text style={styles.countDot}>{' · '}</Text>
          <Text style={styles.count}>{fistBumpCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    backgroundColor: SURFACE_TOKENS.elevated,
  },
  buttonReacted: {
    borderColor: SURFACE_TOKENS.textSecondary,
    backgroundColor: SURFACE_TOKENS.raised,
  },
  buttonSubmitting: {
    opacity: 0.6,
  },
  glyph: {
    fontSize: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: SURFACE_TOKENS.textPrimary,
  },
  labelReacted: {
    color: SURFACE_TOKENS.textPrimary,
  },
  checkMark: {
    fontSize: 13,
    fontWeight: '700',
    color: SURFACE_TOKENS.textPrimary,
  },
  countWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countDot: {
    fontSize: 12,
    color: SURFACE_TOKENS.textMuted,
  },
  count: {
    fontSize: 12,
    fontWeight: '600',
    color: SURFACE_TOKENS.textSecondary,
  },
});
