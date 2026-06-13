/**
 * DEMO-001 — Recruitable Debate Demo Corridor screen.
 *
 * The route container. Owns the corridor reducer, derives the fixture +
 * focus node for the active beat, and mounts the REAL shipped components —
 * `ArgumentGameSurface` (fed from the bundled fixture, never the network)
 * and, when a move is picked, the real `OneBox` via `DemoComposerPanel`. No
 * Supabase, no network, no provider, no AI in the corridor path; the surface
 * performs zero I/O itself (every datum is a prop), and the composer is
 * intercepted at the existing pre-network `onBeforeSubmit` seam.
 *
 * The deterministic Constitution engine remains the SOLE submission gate
 * (cdiscourse-doctrine §1/§5): the corridor never reaches the submit path,
 * so it cannot block, reject, route, or delay any post — there is no post.
 */
import React, { useEffect, useReducer, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArgumentGameSurface } from '../arguments/ArgumentGameSurface';
import type { GalleryEntryHint } from '../debates/conversationGalleryModel';
import { SURFACE_TOKENS, SPACING, RADIUS, TOUCH_TARGET, BRAND } from '../../lib/designTokens';
import {
  advanceCorridor,
  initialCorridorState,
  resolveCorridorView,
  isComposerOpen,
  mapControlToDemoMove,
  CORRIDOR_STEPS,
  CORRIDOR_COPY,
  DEFAULT_DEMO_MOVE,
  type CorridorPrimaryAction,
  type CorridorSecondaryAction,
} from './corridorModel';
import { DEMO_FIXTURE_ROOM, DEMO_VIEWER_ID } from './demoFixtureRoom';
import { DemoCorridorGuidancePanel } from './DemoCorridorGuidancePanel';
import { DemoMoveMenu } from './DemoMoveMenu';
import { DemoComposerPanel } from './DemoComposerPanel';

export interface DemoCorridorScreenProps {
  /** App.tsx → setDemoCorridorOpen(false). */
  onExit: () => void;
}

/** Build the entry hint that pins the surface's active node to `focusId`. */
function pinHint(focusId: string): GalleryEntryHint {
  return {
    activate: 'latest',
    code: 'watch_first',
    // Empty verbPhrase → the surface's micro-moment banner stays hidden; the
    // corridor guidance panel is the single teaching surface.
    verbPhrase: '',
    helperLine: '',
    presetKey: null,
    dockAction: null,
    entryHintForArgumentId: focusId,
  };
}

export function DemoCorridorScreen({ onExit }: DemoCorridorScreenProps) {
  const [state, dispatch] = useReducer(advanceCorridor, undefined, initialCorridorState);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Reduce-motion: read the OS value once + subscribe. The corridor chrome is
  // static regardless; this value is forwarded to the real surface.
  useEffect(() => {
    let mounted = true;
    // Defensive: `isReduceMotionEnabled` may be absent on some platforms /
    // test environments. Guard before `.then` so the corridor never crashes
    // on a missing accessibility API.
    const pending = AccessibilityInfo.isReduceMotionEnabled?.();
    if (pending && typeof pending.then === 'function') {
      void pending.then((v) => {
        if (mounted) setReduceMotion(v);
      });
    }
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub?.remove();
    };
  }, []);

  const step = CORRIDOR_STEPS[state.stepIndex];
  const view = resolveCorridorView(state);
  const composerOpen = isComposerOpen(state);

  // Step-change announcement (sparingly — one per advance).
  useEffect(() => {
    const line = step.teachingLines[0];
    if (line) AccessibilityInfo.announceForAccessibility(line);
  }, [state.stepIndex, step.teachingLines]);

  const handlePrimary = (action: CorridorPrimaryAction) => {
    if (action.kind === 'advance') dispatch({ type: 'ADVANCE' });
    else if (action.kind === 'exit') onExit();
    else if (action.kind === 'replay') dispatch({ type: 'REPLAY' });
    // 'choose_move' is the menu prompt — the move buttons drive the pick.
  };

  const handleSecondary = (action: CorridorSecondaryAction) => {
    if (action.kind === 'back') dispatch({ type: 'BACK' });
    else if (action.kind === 'exit') onExit();
    else if (action.kind === 'replay') dispatch({ type: 'REPLAY' });
  };

  const fixture = DEMO_FIXTURE_ROOM[view.fixtureStateId];

  return (
    <View style={styles.root} testID="demo-corridor-screen">
      {/* Header — persistent Close (exit) affordance (hardware-back parity). */}
      <View style={styles.header}>
        <Text style={styles.headerTitle} accessibilityRole="header">
          {CORRIDOR_COPY.entryLabel}
        </Text>
        <Pressable
          style={styles.closeButton}
          onPress={onExit}
          accessibilityRole="button"
          accessibilityLabel={CORRIDOR_COPY.closeDemo}
          hitSlop={TOUCH_TARGET.hitSlopAll}
          testID="demo-corridor-close"
        >
          <Text style={styles.closeLabel}>✕</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {view.isClosing ? (
          // Recruit-friendly closing screen.
          <DemoCorridorGuidancePanel
            step={step}
            headline={CORRIDOR_COPY.closingHeadline}
            onPrimary={handlePrimary}
            onSecondary={handleSecondary}
          />
        ) : (
          <>
            {/* Stand-in framing on the very first beat (open-question
                resolution: the viewer is a stand-in participant). */}
            {step.kind === 'claim' ? (
              <Text style={styles.framing} testID="demo-corridor-framing">
                {CORRIDOR_COPY.standInFraming}
              </Text>
            ) : null}

            <DemoCorridorGuidancePanel
              step={step}
              onPrimary={handlePrimary}
              onSecondary={handleSecondary}
            />

            {/* The four-move teaching menu (choose_move beat, before a pick). */}
            {step.kind === 'choose_move' && step.moveMenu && !composerOpen ? (
              <DemoMoveMenu
                items={step.moveMenu}
                onPick={(move) => dispatch({ type: 'MOVE_PICKED', move })}
              />
            ) : null}

            {/* The demo composer (real OneBox), pre-network. */}
            {composerOpen && state.chosenMove ? (
              <DemoComposerPanel
                move={state.chosenMove}
                onConfirm={() => dispatch({ type: 'MOVE_CONFIRMED' })}
                onCancel={() => dispatch({ type: 'BACK' })}
                reduceMotionOverride={reduceMotion}
              />
            ) : null}

            {/* The REAL room surface, fed entirely from the bundled fixture.
                Re-keyed per (fixture state, focus node) so the active node
                re-derives cleanly on each beat. */}
            <View style={styles.surfaceWrap} testID="demo-corridor-surface">
              <ArgumentGameSurface
                key={`${view.fixtureStateId}:${view.focusMessageId}`}
                debate={fixture.debate}
                messages={[...fixture.messages]}
                currentUserId={DEMO_VIEWER_ID}
                initialMode="stack"
                flagsByArgumentId={fixture.flagsByArgumentId}
                tagsByArgumentId={fixture.tagsByArgumentId}
                pointTagsByArgumentId={fixture.pointTagsByArgumentId}
                persistedObservationsByArgumentId={fixture.persistedObservationsByArgumentId}
                latestMessageId={fixture.latestMessageId}
                viewerRole="participant"
                participantSide="affirmative"
                reduceMotionOverride={reduceMotion}
                entryHint={view.focusMessageId ? pinHint(view.focusMessageId) : undefined}
                onAction={(control, _messageId, preset) => {
                  // Surface-internal actions (referee card / rail / bubble)
                  // route through the same demo dispatch as the move menu.
                  // No-op off the choose_move beat (reducer-guarded).
                  const move =
                    mapControlToDemoMove(control, preset?.argumentType ?? null) ?? DEFAULT_DEMO_MOVE;
                  dispatch({ type: 'MOVE_PICKED', move });
                }}
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BRAND.surface.app.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.l,
    paddingVertical: SPACING.m,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE_TOKENS.border,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: SURFACE_TOKENS.textPrimary },
  closeButton: {
    minWidth: TOUCH_TARGET.minSizePx,
    minHeight: TOUCH_TARGET.minSizePx,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeLabel: { fontSize: 18, fontWeight: '700', color: SURFACE_TOKENS.textSecondary },
  scrollContent: { padding: SPACING.l, gap: SPACING.m },
  framing: {
    fontSize: 13,
    fontStyle: 'italic',
    color: SURFACE_TOKENS.textSecondary,
  },
  surfaceWrap: {
    minHeight: 280,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
  },
});
