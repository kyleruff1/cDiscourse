/**
 * DEMO-001 — Demo Corridor four-move teaching menu (the choose_move beat).
 *
 * Presentational only. No Supabase, no network, no provider, no AI. Renders
 * the bounded set of four plain moves (REF-ADR-001 — no internal type
 * codes). Each option is an independently focusable 44×44 `Pressable` with
 * `accessibilityRole="button"`; pressing it picks the move (the host
 * dispatches MOVE_PICKED). A bounded choice menu, not a radio group — the
 * choice opens the real composer, it does not toggle a value.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SURFACE_TOKENS, SPACING, RADIUS, TOUCH_TARGET } from '../../lib/designTokens';
import type { CorridorMoveMenuItem, DemoMoveCode } from './corridorModel';

export interface DemoMoveMenuProps {
  items: ReadonlyArray<CorridorMoveMenuItem>;
  onPick: (move: DemoMoveCode) => void;
}

export function DemoMoveMenu({ items, onPick }: DemoMoveMenuProps) {
  return (
    <View style={styles.menu} testID="demo-corridor-move-menu">
      {items.map((item) => (
        <Pressable
          key={item.code}
          style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
          onPress={() => onPick(item.code)}
          accessibilityRole="button"
          accessibilityLabel={item.accessibilityLabel}
          hitSlop={TOUCH_TARGET.hitSlopAll}
          testID={`demo-corridor-move-${item.code}`}
        >
          {/* A neutral leading glyph keeps the option legible in grayscale. */}
          <Text style={styles.optionGlyph} accessibilityElementsHidden importantForAccessibility="no">
            {'＋ '}
          </Text>
          <Text style={styles.optionLabel}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  menu: { gap: SPACING.s },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_TARGET.minSizePx,
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    backgroundColor: SURFACE_TOKENS.elevated,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    borderRadius: RADIUS.md,
  },
  optionPressed: { opacity: 0.8 },
  optionGlyph: { fontSize: 15, fontWeight: '700', color: SURFACE_TOKENS.textSecondary },
  optionLabel: { fontSize: 15, fontWeight: '600', color: SURFACE_TOKENS.textPrimary },
});
