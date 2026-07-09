/**
 * ROOM-004 (#886) — MapNodeActionPopover.
 *
 * The band-free, actor-aware node action popover for the Map lens. It MIRRORS
 * the Ringside card action row exactly (the 44px rule: small nodes open a
 * popover before actions): participant viewers get the SAME allowedControls
 * (own node = qualifiers plus request deletion only), dispatched through the
 * SAME handleBubbleAction; observers get the getRailActions observer set,
 * dispatched through handleRailAction. Plus an Answer this deep-link.
 * Presentational only: it imports NO derivation. Every value arrives as a prop.
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
import type { ArgumentBubbleControl } from '../argumentGameSurfaceModel';
import type { RailActionCode } from '../railActionCategories';
import type { MapNodeActionSurface } from './mapNodeActionSurfaceModel';

// Plain-language control labels. Values mirror the shipped ArgumentBubbleActions
// map (no new action copy invented). Ban-list clean.
const CONTROL_LABEL: Record<ArgumentBubbleControl, string> = {
  reply: 'Reply',
  disagree: 'Disagree',
  flag: 'Request review',
  ask_for_source: 'Ask for source',
  ask_for_quote: 'Ask for quote',
  branch: 'Branch',
  view_qualifiers: 'View qualifiers',
  request_deletion: 'Request deletion',
};

export interface MapNodeActionPopoverProps {
  surface: MapNodeActionSurface;
  /** Participant control dispatch — handleBubbleAction (mirrors the Ringside card). */
  onControl: (control: ArgumentBubbleControl) => void;
  /** Observer action dispatch — handleRailAction. */
  onAction: (code: RailActionCode) => void;
  onAnswerThis: () => void;
  onOpenDetails?: () => void;
  onClose: () => void;
  reduceMotion?: boolean;
}

export function MapNodeActionPopover(props: MapNodeActionPopoverProps) {
  const { surface } = props;
  const idSuffix = surface.messageId ?? 'none';
  const row = surface.actionRow;

  return (
    <View
      accessibilityRole="none"
      accessibilityLabel={surface.accessibilityLabel}
      testID={`map-node-action-popover-${idSuffix}`}
      style={styles.dock}
    >
      {/* Actor action row — MIRRORS the Ringside card. Participant controls
          dispatch through onControl (handleBubbleAction); observer actions
          dispatch through onAction (handleRailAction). One primary chip, the
          rest quiet ghost chips. */}
      <View style={styles.actionRow}>
        {row.kind === 'participant'
          ? row.controls.map((control, i) => (
              <Pressable
                key={control}
                onPress={() => props.onControl(control)}
                accessibilityRole="button"
                accessibilityLabel={CONTROL_LABEL[control]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                testID={`map-popover-control-${control}-${idSuffix}`}
                style={[styles.chip, i === 0 ? styles.chipPrimary : styles.chipGhost]}
              >
                <Text style={i === 0 ? styles.chipTextPrimary : styles.chipTextGhost}>
                  {CONTROL_LABEL[control]}
                </Text>
              </Pressable>
            ))
          : row.actions.map((action, i) => (
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
