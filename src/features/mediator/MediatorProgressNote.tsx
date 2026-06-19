/**
 * UX-FEEDBACK-001 — MediatorProgressNote (read-only presentational note).
 *
 * A tiny, pure, READ-ONLY presentational component that renders ONE
 * `MediatorProgressNote` (from `feedbackForMediatorProgress`) as a quiet,
 * restrained current-state acknowledgement. It is NOT a reward, NOT a rating,
 * NOT a chip, NOT interactive.
 *
 * Doctrine (cdiscourse-doctrine §1/§2/§3/§9/§10a):
 *   - It is informational `<Text>`, never a `Pressable`: there is NO tap-to-rate
 *     affordance, NO "Save feedback" button, NO like / vote / score control, NO
 *     onPress rating handler. It exposes nothing for a user to submit.
 *   - It imports NOTHING from the engine / pointStanding / argumentScoreModel and
 *     feeds no standing / ranking. Gate-independence is structural.
 *   - The reward is clarity: a calm one-line note when the board is in a
 *     more-resolved shape, silence otherwise. No applause, no celebration.
 *
 * RN primitives only (`View` / `Text`). Reuses existing tokens (no new hex):
 *   - 'dignified' → restrained gold (`BRAND.accent.gold`) — a settled shape.
 *   - 'progress'  → indigo (`SURFACE_TOKENS.focusRing` = `GLOW.activePath`).
 *   - 'neutral'   → no accent.
 * COLOR IS NEVER THE ONLY SIGNAL: a thin left rule (geometry) + the line text
 * carry the tone in grayscale (a grayscale snapshot stays legible). There is NO
 * confetti, NO badge, NO trophy, NO Image asset, NO animation primitive — the
 * note is static text + geometry (reduce-motion no-op).
 *
 * Renders `null` for a `null` note (the restraint default — silence when there
 * is nothing to acknowledge).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  BORDER_WIDTH,
  BRAND,
  RADIUS,
  SPACING,
  SURFACE_TOKENS,
  TYPOGRAPHY,
} from '../../lib/designTokens';
import type { MediatorProgressNote as MediatorProgressNoteData } from './feedbackForMediatorProgress';

export interface MediatorProgressNoteProps {
  /** From `feedbackForMediatorProgress(...)`; `null` → renders null. */
  note: MediatorProgressNoteData | null;
  testID?: string;
}

/**
 * Renders one restrained current-state note. Informational, non-interactive.
 * `null` note → `null` render.
 */
export function MediatorProgressNote({
  note,
  testID,
}: MediatorProgressNoteProps): React.ReactElement | null {
  if (!note) return null;

  const baseTestID = testID ?? `mediator-progress-note-${note.id}`;
  const ruleStyle =
    note.tone === 'dignified'
      ? styles.ruleDignified
      : note.tone === 'progress'
        ? styles.ruleProgress
        : styles.ruleNeutral;

  return (
    <View style={[styles.note, ruleStyle]} testID={baseTestID}>
      <Text
        style={styles.line}
        accessibilityRole="text"
        testID={`${baseTestID}-line`}
      >
        {note.line}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // A single inline line; wraps, never overflows at 390px. Geometry (a left
  // rule) carries the tone so color is never the only signal.
  note: {
    marginTop: SPACING.xs,
    paddingLeft: SPACING.s,
    paddingVertical: SPACING.xs,
    borderLeftWidth: BORDER_WIDTH.lg,
    borderTopLeftRadius: RADIUS.sm,
    borderBottomLeftRadius: RADIUS.sm,
  },
  // 'dignified' — restrained gold left rule (a settled / completed shape).
  ruleDignified: {
    borderLeftColor: BRAND.accent.gold,
  },
  // 'progress' — indigo left rule (reuses the focus-ring indigo = GLOW.activePath).
  ruleProgress: {
    borderLeftColor: SURFACE_TOKENS.focusRing,
  },
  // 'neutral' — the standard surface border (no accent).
  ruleNeutral: {
    borderLeftColor: SURFACE_TOKENS.border,
  },
  line: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.inspectDetail.fontSize,
    lineHeight: TYPOGRAPHY.inspectDetail.lineHeight,
    fontWeight: '600',
  },
});
