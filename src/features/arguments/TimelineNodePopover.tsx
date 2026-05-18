/**
 * SC-002 — Timeline node popover UI.
 *
 * Compact in-place overlay rendered when the user double-taps an
 * active timeline node (or taps the info icon). Shows preview, kind,
 * standing band, tone/temperature, action chips matching the side
 * rail, an "Open details" link, and a Close button.
 *
 * Pure presentation. State is owned by `ArgumentTimelineMap.tsx`;
 * action dispatch goes through the same `onAction` callback the
 * sidecar uses.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ArgumentBubbleControl } from './argumentGameSurfaceModel';
import type { TimelineNodePopoverModel } from './timelineNodePopoverModel';

interface ActionButton {
  control: ArgumentBubbleControl;
  label: string;
  color: string;
}

const ACTION_BUTTON_BY_CONTROL: Record<ArgumentBubbleControl, ActionButton> = {
  reply: { control: 'reply', label: 'Reply', color: '#6366f1' },
  disagree: { control: 'disagree', label: 'Challenge', color: '#f97316' },
  ask_for_source: { control: 'ask_for_source', label: 'Source?', color: '#0ea5e9' },
  ask_for_quote: { control: 'ask_for_quote', label: 'Quote?', color: '#0d9488' },
  branch: { control: 'branch', label: 'Split branch', color: '#a855f7' },
  flag: { control: 'flag', label: 'Flag', color: '#ef4444' },
  view_qualifiers: { control: 'view_qualifiers', label: 'Qualifiers', color: '#64748b' },
  request_deletion: { control: 'request_deletion', label: 'Request deletion', color: '#475569' },
};

interface Props {
  model: TimelineNodePopoverModel;
  /** Dispatch a control action — same signature as the sidecar. */
  onAction?: (control: ArgumentBubbleControl, messageId: string) => void;
  /** Open the deeper card-details view (switches mode to Cards). */
  onOpenDetails?: (messageId: string) => void;
  /** Close the popover. */
  onClose: () => void;
}

export function TimelineNodePopover({ model, onAction, onOpenDetails, onClose }: Props) {
  const buttons = model.actions.map((c) => ACTION_BUTTON_BY_CONTROL[c]).filter(Boolean);

  return (
    <View
      style={styles.root}
      accessibilityRole="none"
      accessibilityLabel={model.accessibilityLabel}
      testID={`timeline-node-popover-${model.messageId}`}
    >
      <View style={styles.headerRow}>
        <Text style={styles.headerText} numberOfLines={1}>{model.headerLine}</Text>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close popover"
          testID={`timeline-node-popover-close-${model.messageId}`}
          style={styles.closeBtn}
        >
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
        <Text style={styles.bodyPreview}>{model.bodyPreview}</Text>

        <View style={styles.bandRow}>
          <View style={styles.bandChip} testID={`popover-standing-${model.messageId}`}>
            <Text style={styles.bandLabel}>Standing</Text>
            <Text style={styles.bandValue} numberOfLines={1}>{model.standingLabel}</Text>
          </View>
          <View style={styles.bandChip} testID={`popover-tone-${model.messageId}`}>
            <Text style={styles.bandLabel}>Tone</Text>
            <Text style={styles.bandValue} numberOfLines={1}>{model.toneBand}</Text>
          </View>
          <View style={styles.bandChip} testID={`popover-temperature-${model.messageId}`}>
            <Text style={styles.bandLabel}>Heat</Text>
            <Text style={styles.bandValue} numberOfLines={1}>{model.temperatureBand}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.actionsRow}>
        {buttons.map((b, idx) => (
          <Pressable
            key={`popover-action-${b.control}-${idx}`}
            style={[styles.actionChip, { backgroundColor: b.color }]}
            onPress={() => onAction?.(b.control, model.messageId)}
            accessibilityRole="button"
            accessibilityLabel={b.label}
            testID={`popover-action-${b.control}-${model.messageId}`}
          >
            <Text style={styles.actionChipText} numberOfLines={1}>{b.label}</Text>
          </Pressable>
        ))}
        {onOpenDetails ? (
          <Pressable
            style={[styles.actionChip, styles.openDetailsChip]}
            onPress={() => onOpenDetails(model.messageId)}
            accessibilityRole="button"
            accessibilityLabel="Open card details"
            testID={`popover-open-details-${model.messageId}`}
          >
            <Text style={styles.actionChipText} numberOfLines={1}>Open details ↗</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 10,
    padding: 10,
    minWidth: 260,
    maxWidth: 380,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  headerText: { flex: 1, color: '#e2e8f0', fontWeight: '700', fontSize: 12 },
  closeBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  closeText: { color: '#94a3b8', fontSize: 16, fontWeight: '800' },
  bodyScroll: { maxHeight: 140, marginTop: 6 },
  bodyContent: { gap: 6 },
  bodyPreview: { color: '#cbd5e1', fontSize: 13, lineHeight: 18 },
  bandRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 4 },
  bandChip: { backgroundColor: '#1e293b', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 1, minWidth: 84 },
  bandLabel: { color: '#94a3b8', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  bandValue: { color: '#e2e8f0', fontSize: 12, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  actionChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  openDetailsChip: { backgroundColor: '#312e81' },
  actionChipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
