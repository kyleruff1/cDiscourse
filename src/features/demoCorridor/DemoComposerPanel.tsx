/**
 * DEMO-001 — Demo Corridor composer sheet.
 *
 * A thin demo sheet that mounts the REAL `OneBox` (the actual shipped
 * one-box composer) "up to but not through the network". The corridor never
 * edits a production submit-chain file: it supplies a DIFFERENT VALUE for the
 * EXISTING optional `onBeforeSubmit` prop (`OneBox.tsx` → `ArgumentComposer
 * .handlePostIntent`). `makeDemoBeforeSubmit` returns `false`, so the
 * production post handler short-circuits BEFORE the composer's own submit →
 * the network submit call is never reached. No network, no write, no fake
 * success toast over a real submit (there is no real submit).
 *
 * The preset comes from the SHIPPED `quickActionToPreset` machinery — the
 * exact composer entry point a real room uses for these moves. No provider,
 * no Supabase, no AI in this file.
 */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { OneBox } from '../arguments/oneBox/OneBox';
import { quickActionToPreset } from '../arguments/quickActionPresets';
import { useConstitution } from '../arguments/useConstitution';
import { SURFACE_TOKENS, SPACING, RADIUS, TOUCH_TARGET } from '../../lib/designTokens';
import {
  CORRIDOR_COPY,
  DEMO_MOVE_TO_QUICK_ACTION,
  makeDemoBeforeSubmit,
  type DemoMoveCode,
} from './corridorModel';
import { DEMO_DEBATE, DEMO_PARENT_ARGUMENT } from './demoFixtureRoom';

export interface DemoComposerPanelProps {
  move: DemoMoveCode;
  /** Fired when the viewer presses the real Post button (pre-network seam). */
  onConfirm: () => void;
  /** Fired when the viewer cancels the composer (back to the move menu). */
  onCancel: () => void;
  reduceMotionOverride?: boolean;
}

export function DemoComposerPanel({
  move,
  onConfirm,
  onCancel,
  reduceMotionOverride,
}: DemoComposerPanelProps) {
  const constitution = useConstitution();

  const initialPatch = useMemo(
    () => quickActionToPreset(DEMO_MOVE_TO_QUICK_ACTION[move], DEMO_PARENT_ARGUMENT.argumentType),
    [move],
  );

  const onBeforeSubmit = useMemo(() => makeDemoBeforeSubmit(onConfirm), [onConfirm]);

  return (
    <View style={styles.sheet} testID="demo-composer-panel">
      <Text style={styles.intro} testID="demo-composer-intro">
        {CORRIDOR_COPY.composerIntro}
      </Text>

      <View style={styles.boxWrap}>
        <OneBox
          debate={DEMO_DEBATE}
          selectedParentId={DEMO_PARENT_ARGUMENT.id}
          parentArgument={DEMO_PARENT_ARGUMENT}
          onClearParent={onCancel}
          onSubmitSuccess={onConfirm}
          onClose={onCancel}
          initialPatch={initialPatch}
          viewerRole="participant_other"
          rules={constitution.activeRules}
          reduceMotionOverride={reduceMotionOverride}
          onBeforeSubmit={onBeforeSubmit}
        />
      </View>

      <Pressable
        style={styles.cancelButton}
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Cancel this move and go back to the move menu"
        hitSlop={TOUCH_TARGET.hitSlopAll}
        testID="demo-composer-cancel"
      >
        <Text style={styles.cancelLabel}>{CORRIDOR_COPY.back}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: SURFACE_TOKENS.raised,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.m,
    gap: SPACING.s,
  },
  intro: {
    fontSize: 14,
    fontWeight: '600',
    color: SURFACE_TOKENS.textSecondary,
  },
  boxWrap: { minHeight: 120 },
  cancelButton: { minHeight: TOUCH_TARGET.minSizePx, justifyContent: 'center', alignSelf: 'flex-start' },
  cancelLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: SURFACE_TOKENS.textSecondary,
    textDecorationLine: 'underline',
  },
});
