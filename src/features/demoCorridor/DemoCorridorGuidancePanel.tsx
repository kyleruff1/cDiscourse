/**
 * DEMO-001 — Demo Corridor guidance chrome.
 *
 * Presentational only. No Supabase, no network, no provider, no AI. Renders
 * the active step's teaching lines, the SINGLE primary action (filled,
 * prominent, leading glyph so color is never the only signal), and a
 * subordinate secondary row (text-link weight). Reduce-motion safe: the
 * panel is fully static (no `Animated`).
 *
 * Accessibility: every interactive element is a 44×44 `Pressable` with
 * `accessibilityRole="button"`, a descriptive `accessibilityLabel`, and
 * `hitSlop`. The corridor is completable via these buttons alone.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SURFACE_TOKENS, CONTROL, SPACING, RADIUS, TOUCH_TARGET } from '../../lib/designTokens';
import type { CorridorStep, CorridorPrimaryAction, CorridorSecondaryAction } from './corridorModel';

export interface DemoCorridorGuidancePanelProps {
  step: CorridorStep;
  /** Optional headline rendered above the teaching lines (closing beat). */
  headline?: string | null;
  onPrimary: (action: CorridorPrimaryAction) => void;
  onSecondary: (action: CorridorSecondaryAction) => void;
}

export function DemoCorridorGuidancePanel({
  step,
  headline,
  onPrimary,
  onSecondary,
}: DemoCorridorGuidancePanelProps) {
  const primary = step.primaryAction;
  // The choose_move step's primary action is the move-menu PROMPT (the four
  // move buttons live in DemoMoveMenu) — it is rendered as a non-pressable
  // heading so the step keeps exactly one pressable primary affordance.
  const primaryIsPressable = primary.kind !== 'choose_move';

  return (
    <View style={styles.panel} testID="demo-corridor-guidance">
      {headline ? (
        <Text style={styles.headline} accessibilityRole="header" testID="demo-corridor-headline">
          {headline}
        </Text>
      ) : null}

      <View style={styles.teachingBlock}>
        {step.teachingLines.map((line, i) => (
          <Text key={i} style={styles.teachingLine} testID={`demo-corridor-teaching-${i}`}>
            {line}
          </Text>
        ))}
      </View>

      {primaryIsPressable ? (
        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
          onPress={() => onPrimary(primary)}
          accessibilityRole="button"
          accessibilityLabel={primary.accessibilityLabel}
          hitSlop={TOUCH_TARGET.hitSlopAll}
          testID="demo-corridor-primary"
        >
          {/* Leading glyph — meaning is carried by position + weight + glyph,
              never color alone (accessibility-targets §"Color never the only
              signal"). */}
          <Text style={styles.primaryGlyph} accessibilityElementsHidden importantForAccessibility="no">
            {'▶ '}
          </Text>
          <Text style={styles.primaryLabel}>{primary.label}</Text>
        </Pressable>
      ) : (
        <Text style={styles.movePrompt} accessibilityRole="header" testID="demo-corridor-primary">
          {primary.label}
        </Text>
      )}

      {step.secondaryActions.length > 0 ? (
        <View style={styles.secondaryRow} testID="demo-corridor-secondary-row">
          {step.secondaryActions.map((action) => (
            <Pressable
              key={action.kind}
              style={styles.secondaryButton}
              onPress={() => onSecondary(action)}
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel}
              hitSlop={TOUCH_TARGET.hitSlopAll}
              testID={`demo-corridor-secondary-${action.kind}`}
            >
              <Text style={styles.secondaryLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: SURFACE_TOKENS.raised,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.l,
    gap: SPACING.m,
  },
  headline: {
    fontSize: 20,
    fontWeight: '800',
    color: SURFACE_TOKENS.textPrimary,
  },
  teachingBlock: { gap: SPACING.xs },
  teachingLine: {
    fontSize: 16,
    lineHeight: 22,
    color: SURFACE_TOKENS.textPrimary,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TOUCH_TARGET.minSizePx,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    backgroundColor: CONTROL.primary.bg,
    borderRadius: RADIUS.md,
  },
  primaryButtonPressed: { opacity: 0.85 },
  primaryGlyph: { fontSize: 14, fontWeight: '800', color: CONTROL.primary.fg },
  primaryLabel: { fontSize: 16, fontWeight: '700', color: CONTROL.primary.fg },
  movePrompt: {
    fontSize: 15,
    fontWeight: '700',
    color: SURFACE_TOKENS.textSecondary,
  },
  secondaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.l },
  secondaryButton: {
    minHeight: TOUCH_TARGET.minSizePx,
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: SURFACE_TOKENS.textSecondary,
    textDecorationLine: 'underline',
  },
});
