/**
 * SC-002 — Timeline node popover UI.
 *
 * Compact in-place overlay rendered when the user double-taps an
 * active timeline node (or taps the info icon). Shows preview, kind,
 * standing band, tone/temperature, action chips matching the side
 * rail, an "Open details" link, and a Close button.
 *
 * EV-002 extension: when `model.evidenceContract` is present, renders a
 * `ReceiptChip` inside the bandRow plus an inline collapsible
 * `SourceChainPopover` section. The "ask" CTA inside that section
 * dispatches `ask_for_source` / `ask_for_quote` through the same
 * `onAction` callback used by the action chips, so no new control type
 * is introduced.
 *
 * Pure presentation. State is owned by `ArgumentTimelineMap.tsx`;
 * action dispatch goes through the same `onAction` callback the
 * sidecar uses.
 */
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ArgumentBubbleControl } from './argumentGameSurfaceModel';
import type { TimelineNodePopoverModel } from './timelineNodePopoverModel';
import { ReceiptChip } from '../evidence/ReceiptChip';
import { SourceChainPopover } from '../evidence/SourceChainPopover';
import { buildSourceChainPopoverModel } from '../evidence/sourceChainPopoverModel';
import type { EvidenceArtifact } from '../evidence/evidenceModel';

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
  /**
   * EV-002 — Optional artifact list for the active message. Read-only
   * inspection states render the first 3 artifacts' label / host / quote.
   * Omit (or pass `[]`) to render the `no_source` form.
   */
  artifacts?: ReadonlyArray<EvidenceArtifact>;
  /**
   * EV-002 — True when the viewer cannot post (observer mode). The "ask"
   * CTA renders disabled with helper "Join a side to ask".
   */
  isReadModeViewer?: boolean;
}

export function TimelineNodePopover({ model, onAction, onOpenDetails, onClose, artifacts, isReadModeViewer }: Props) {
  const buttons = model.actions.map((c) => ACTION_BUTTON_BY_CONTROL[c]).filter(Boolean);

  // EV-002 — reduce-motion preference (one read per mount).
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    try {
      const maybe = AccessibilityInfo.isReduceMotionEnabled?.();
      if (maybe && typeof (maybe as Promise<boolean>).then === 'function') {
        (maybe as Promise<boolean>).then((v) => { if (mounted) setReduceMotion(!!v); }).catch(() => undefined);
      }
    } catch {
      /* swallow */
    }
    return () => { mounted = false; };
  }, []);

  // EV-002 — source-chain popover section state. Parent (this component)
  // owns expanded/collapsed.
  const [sourceChainExpanded, setSourceChainExpanded] = useState(false);

  const evidenceContract = model.evidenceContract;
  const sourceChainModel = evidenceContract
    ? buildSourceChainPopoverModel(evidenceContract)
    : null;

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
          {evidenceContract ? (
            <ReceiptChip
              contract={evidenceContract.receiptChip}
              onPress={() => setSourceChainExpanded((v) => !v)}
              testIDSuffix={model.messageId}
            />
          ) : null}
        </View>

        {sourceChainModel && evidenceContract ? (
          <SourceChainPopover
            model={sourceChainModel}
            artifacts={artifacts ?? []}
            messageId={model.messageId}
            isExpanded={sourceChainExpanded}
            onToggleExpanded={() => setSourceChainExpanded((v) => !v)}
            onAskAction={(control, mid) => onAction?.(control, mid)}
            isReadModeViewer={isReadModeViewer === true}
            isOwnMessage={model.isOwn === true}
            reduceMotion={reduceMotion}
          />
        ) : null}
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
  bodyScroll: { maxHeight: 220, marginTop: 6 },
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
