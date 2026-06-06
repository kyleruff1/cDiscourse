/**
 * CARD-VIEW-DATA-001 — CardStepReferenceHeader.
 *
 * Renders the active card's step-reference line. Affordance contract
 * (card §1 / accessibility-targets): the line is DISPLAY-ONLY text EXCEPT
 * the single parent ordinal token ("#3"), which is a genuine `Pressable`
 * (role button, ≥44×44 via hitSlop) that re-activates the ancestor
 * message. The root line ("Opening claim (#1)") is fully display-only —
 * no tappable token, no box.
 *
 * The line wraps in a row so the leading prose, the Pressable token, and
 * the trailing prose flow naturally. The token is the ONLY interactive
 * affordance in the entire card-detail panel.
 *
 * Reduce-motion safe: no animation. Pure presentational; no state, no
 * network, no AI.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SPACING, SURFACE_TOKENS, TOUCH_TARGET, TYPOGRAPHY } from '../../../lib/designTokens';
import type { CardStepReferenceLine } from './cardStepReferenceModel';

export interface CardStepReferenceHeaderProps {
  line: CardStepReferenceLine;
  /** Re-activates the ancestor message. Only called for a resolvable parent. */
  onActivateAncestor?: (messageId: string) => void;
  testID?: string;
}

/**
 * The step-reference header. Renders nothing when the line has no text
 * (degenerate input — unknown active id).
 */
export function CardStepReferenceHeader({
  line,
  onActivateAncestor,
  testID,
}: CardStepReferenceHeaderProps): React.ReactElement | null {
  if (!line || line.text.length === 0) return null;

  const hasTappableParent =
    line.parentOrdinalToken != null && line.parentMessageId != null;

  // Display-only path — root line / unresolvable parent. No tappable token.
  if (!hasTappableParent || !line.parentOrdinalToken) {
    return (
      <View
        style={styles.row}
        testID={testID ?? 'card-step-reference-header'}
        accessibilityLabel={line.accessibilityLabel}
      >
        <Text style={styles.text} testID="card-step-reference-text">
          {line.text}
        </Text>
      </View>
    );
  }

  // Split the line on the parent token so the token can render as a genuine
  // Pressable button while the surrounding text stays display-only.
  const token = line.parentOrdinalToken;
  const idx = line.text.lastIndexOf(token);
  const leading = idx >= 0 ? line.text.slice(0, idx) : line.text;
  const trailing = idx >= 0 ? line.text.slice(idx + token.length) : '';

  return (
    <View
      style={styles.row}
      testID={testID ?? 'card-step-reference-header'}
      accessibilityLabel={line.accessibilityLabel}
    >
      {leading.length > 0 ? <Text style={styles.text}>{leading}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Go to message ${token.replace('#', '')}`}
        onPress={() => {
          if (line.parentMessageId) onActivateAncestor?.(line.parentMessageId);
        }}
        hitSlop={TOUCH_TARGET.hitSlopAll}
        style={styles.parentTokenPressable}
        testID="card-step-reference-parent-token"
      >
        <Text style={styles.parentTokenText}>{token}</Text>
      </Pressable>
      {trailing.length > 0 ? <Text style={styles.text}>{trailing}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  text: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: TYPOGRAPHY.selectedContext.fontSize,
    lineHeight: TYPOGRAPHY.selectedContext.lineHeight,
    fontWeight: TYPOGRAPHY.selectedContext.fontWeight,
  },
  parentTokenPressable: {
    justifyContent: 'center',
  },
  parentTokenText: {
    color: SURFACE_TOKENS.focusRing,
    fontSize: TYPOGRAPHY.selectedContext.fontSize,
    lineHeight: TYPOGRAPHY.selectedContext.lineHeight,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
