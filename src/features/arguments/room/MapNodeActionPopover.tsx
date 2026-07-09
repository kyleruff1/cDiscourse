/**
 * ROOM-004 (#886) — MapNodeActionPopover.
 *
 * The band-free, actor-aware node action popover for the Map lens. It surfaces
 * the SAME action set ROOM-002 gives an Exchange element (the 44px rule: small
 * nodes open a popover before actions), plus an Answer this deep-link and, for
 * own moves, an Open Act affordance. Presentational only: it imports NO
 * derivation. Every value arrives as a prop from the orchestrator via MapView.
 *
 * Doctrine (cdiscourse-doctrine, timeline-grammar, accessibility-targets):
 *   - Band-free: NO standing / tone / heat chips (VISUAL-SIMPLIFY-003 stays).
 *   - Every action target is at least 44 by 44 (visual chip plus hitSlop).
 *   - Color is never the only signal: every chip carries a text label.
 *   - Reduce-motion safe by construction: the popover is a plain docked card,
 *     it snaps in / out, no animation to gate.
 *   - No verdict tokens. No AI. No Supabase. All comments apostrophe-free.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RailActionCode } from '../railActionCategories';
import type { MapNodeActionSurface } from './mapNodeActionSurfaceModel';

export interface MapNodeActionPopoverProps {
  surface: MapNodeActionSurface;
  onAction: (code: RailActionCode) => void;
  onAnswerThis: () => void;
  onOpenDetails?: () => void;
  onOpenAct?: () => void;
  onClose: () => void;
  reduceMotion?: boolean;
}

export function MapNodeActionPopover(props: MapNodeActionPopoverProps) {
  const { surface } = props;
  const idSuffix = surface.messageId ?? 'none';

  return (
    <View
      accessibilityRole="none"
      accessibilityLabel={surface.accessibilityLabel}
      testID={`map-node-action-popover-${idSuffix}`}
      style={styles.dock}
    >
      {/* Actor action row — the SAME ordered codes the Exchange row surfaces. */}
      {surface.isOwnMove ? (
        <Pressable
          onPress={props.onOpenAct}
          accessibilityRole="button"
          accessibilityLabel="Open Act menu"
          accessibilityHint={surface.openActHint}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          testID={`map-popover-open-act-${idSuffix}`}
          style={[styles.chip, styles.chipGhost]}
        >
          <Text style={styles.chipTextGhost}>{surface.openActLabel}</Text>
        </Pressable>
      ) : (
        <View style={styles.actionRow}>
          {surface.actionRow.map((action, i) => (
            <Pressable
              key={action.code}
              onPress={() => props.onAction(action.code)}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              accessibilityHint={action.helper}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID={`map-popover-action-${action.code}-${idSuffix}`}
              style={[styles.chip, i === 0 ? styles.chipPrimary : styles.chipGhost]}
            >
              <Text style={i === 0 ? styles.chipTextPrimary : styles.chipTextGhost}>
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* J9 — Answer this jumps to the Exchange lens with the composer scoped. */}
      <Pressable
        onPress={props.onAnswerThis}
        accessibilityRole="button"
        accessibilityLabel="Answer this"
        accessibilityHint={surface.answerThisHint}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        testID={`map-popover-answer-this-${idSuffix}`}
        style={[styles.chip, styles.chipPrimary, styles.answerThis]}
      >
        <Text style={styles.chipTextPrimary}>{surface.answerThisLabel}</Text>
      </Pressable>

      {/* Optional Open details link (mirrors the SC-004 open_cards_detail code). */}
      {props.onOpenDetails ? (
        <Pressable
          onPress={props.onOpenDetails}
          accessibilityRole="button"
          accessibilityLabel="Open details"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          testID={`map-popover-open-details-${idSuffix}`}
          style={[styles.chip, styles.chipGhost]}
        >
          <Text style={styles.chipTextGhost}>Open details ↗</Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={props.onClose}
        accessibilityRole="button"
        accessibilityLabel={surface.closeLabel}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        testID={`map-popover-close-${idSuffix}`}
        style={[styles.chip, styles.chipGhost]}
      >
        <Text style={styles.chipTextGhost}>{surface.closeLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    minWidth: 260,
    maxWidth: 380,
    alignSelf: 'flex-start',
    marginHorizontal: 8,
    marginTop: 6,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#0b1220',
    gap: 8,
  },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipPrimary: { backgroundColor: '#4338ca' },
  chipGhost: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  answerThis: { alignSelf: 'flex-start' },
  chipTextPrimary: { color: '#f8fafc', fontSize: 13, fontWeight: '800' },
  chipTextGhost: { color: '#cbd5e1', fontSize: 13, fontWeight: '700' },
});
