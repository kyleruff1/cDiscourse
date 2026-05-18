/**
 * Stage 6.2 — ArgumentReplySidecar (Milestone 5).
 *
 * Read-only docked panel for the active message. Surfaces tactical
 * quick actions but does NOT expose body editing. Used by Timeline
 * mode (and re-used by Stack mode as a compact docked panel).
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type {
  ArgumentBubbleControl,
  ArgumentBubbleViewModel,
  ArgumentTimelineMapNode,
} from './argumentGameSurfaceModel';
import { formatStandingBandShort } from './standingBandCopy';

interface Props {
  activeMessage: ArgumentTimelineMapNode | null;
  activeViewModel: ArgumentBubbleViewModel | null;
  parentNode: ArgumentTimelineMapNode | null;
  totalCount: number;
  activePathIds: string[];
  onAction?: (control: ArgumentBubbleControl, messageId: string) => void;
}

interface ActionButton {
  control: ArgumentBubbleControl;
  label: string;
  color: string;
}

const OTHER_ACTIONS: ActionButton[] = [
  { control: 'reply', label: 'Reply', color: '#6366f1' },
  { control: 'disagree', label: 'Challenge', color: '#f97316' },
  { control: 'ask_for_source', label: 'Source?', color: '#0ea5e9' },
  { control: 'ask_for_quote', label: 'Quote?', color: '#0d9488' },
  { control: 'ask_for_source', label: 'Clarify', color: '#f59e0b' }, // clarify uses ask-for-source semantics
  { control: 'reply', label: 'Evidence', color: '#06b6d4' },
  { control: 'reply', label: 'Concede', color: '#a855f7' },
  { control: 'branch', label: 'Branch', color: '#a855f7' },
  { control: 'flag', label: 'Flag', color: '#ef4444' },
  { control: 'view_qualifiers', label: 'Qualifiers', color: '#64748b' },
];

const SELF_ACTIONS: ActionButton[] = [
  { control: 'view_qualifiers', label: 'View qualifiers', color: '#64748b' },
  { control: 'request_deletion', label: 'Request deletion', color: '#475569' },
];

export function ArgumentReplySidecar({
  activeMessage,
  activeViewModel,
  parentNode,
  totalCount,
  activePathIds,
  onAction,
}: Props) {
  if (!activeMessage || !activeViewModel) {
    return (
      <View style={styles.empty} testID="argument-reply-sidecar">
        <Text style={styles.emptyText}>Pick a message on the timeline to see details.</Text>
      </View>
    );
  }

  const isOwn = activeViewModel.actor === 'self';
  const actionSet: ActionButton[] = isOwn ? SELF_ACTIONS : OTHER_ACTIONS;

  const dispatch = (control: ArgumentBubbleControl) => {
    if (!onAction) return;
    onAction(control, activeMessage.messageId);
  };

  const pathLabel = activePathIds.length > 0
    ? activePathIds.map((id, i) => i === activePathIds.length - 1 ? `#${i + 1}` : i === 0 ? 'Root' : `#${i + 1}`).join(' → ')
    : 'standalone';

  return (
    <View style={styles.root} testID="argument-reply-sidecar">
      <View style={styles.headerRow}>
        <Text style={styles.index} testID="sidecar-message-index">
          Message {activeMessage.ordinal} of {totalCount}
        </Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.kind}>{activeMessage.kindLabel}</Text>
        {activeMessage.sideLabel !== '—' ? (
          <>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.side}>{activeMessage.sideLabel}</Text>
          </>
        ) : null}
        <Text style={styles.dot}>·</Text>
        <Text style={styles.actor}>{activeViewModel.actor === 'self' ? 'You' : activeViewModel.actor === 'bot' ? 'Bot' : activeViewModel.actor === 'admin' ? 'Admin' : 'Opponent'}</Text>
      </View>
      <Text style={styles.timestamp}>
        {activeMessage.createdAtLabel} · {activeMessage.relativeLabel}
      </Text>

      <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyContent}>
        <Text style={styles.body}>{activeViewModel.body}</Text>

        {parentNode ? (
          <View style={styles.parentBlock} testID="sidecar-parent-preview">
            <Text style={styles.parentLabel}>Replied to · #{parentNode.ordinal} ({parentNode.kindLabel})</Text>
            <Text style={styles.parentPreview} numberOfLines={3}>{parentNode.bodyPreview}</Text>
          </View>
        ) : null}

        <View style={styles.factRow}>
          <Text style={styles.factLabel}>Replies</Text>
          <Text style={styles.factValue}>{activeMessage.replyCount}</Text>
        </View>
        <View style={styles.factRow} testID="sidecar-active-path">
          <Text style={styles.factLabel}>Path</Text>
          <Text style={styles.factValue} numberOfLines={1}>{pathLabel}</Text>
        </View>

        {activeMessage.droppedTags.length > 0 ? (
          <View style={styles.tagsRow}>
            {activeMessage.droppedTags.slice(0, 6).map((t) => (
              <View key={`sidecar-tag-${activeMessage.messageId}-${t.code}`} style={[styles.tag, { backgroundColor: t.color }]}>
                <Text style={styles.tagText}>{t.label}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.bandRow}>
          <View style={styles.bandChip} testID={`sidecar-standing-band`}>
            <Text style={styles.bandLabel}>Standing</Text>
            <Text style={styles.bandValue}>{formatStandingBandShort(activeMessage.standingBand)}</Text>
          </View>
          <View style={styles.bandChip} testID="sidecar-tone-band">
            <Text style={styles.bandLabel}>Tone</Text>
            <Text style={styles.bandValue}>{activeMessage.toneBand}</Text>
          </View>
          <View style={styles.bandChip} testID="sidecar-temperature-band">
            <Text style={styles.bandLabel}>Heat</Text>
            <Text style={styles.bandValue}>{activeMessage.temperatureBand}</Text>
          </View>
        </View>

        {activeMessage.isJunction ? (
          <View style={styles.hint}>
            <Text style={styles.hintText}>{activeMessage.junctionChildCount} reply routes from here</Text>
          </View>
        ) : null}
        {activeMessage.isDetached ? (
          <View style={styles.hint}>
            <Text style={[styles.hintText, { color: '#f59e0b' }]}>This message is detached — its parent is unavailable.</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.actionsRow}>
        {actionSet.map((a, idx) => (
          <Pressable
            key={`sidecar-action-${a.control}-${idx}`}
            style={[styles.actionChip, { backgroundColor: a.color }]}
            onPress={() => dispatch(a.control)}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            testID={`sidecar-action-${a.label.toLowerCase().replace('?', '').replace(/\s+/g, '-')}-${activeMessage.messageId}`}
          >
            <Text style={styles.actionChipText} numberOfLines={1}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  root: { backgroundColor: '#0b1220', borderTopWidth: 1, borderTopColor: '#1f2937', padding: 10, maxHeight: 360 },
  empty: { padding: 16, backgroundColor: '#0b1220', borderTopWidth: 1, borderTopColor: '#1f2937' },
  emptyText: { color: '#64748b', fontSize: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  index: { color: '#a5b4fc', fontWeight: '800', fontSize: 12 },
  kind: { color: '#f8fafc', fontWeight: '700', fontSize: 12, textTransform: 'capitalize' as const },
  side: { color: '#94a3b8', fontSize: 12 },
  actor: { color: '#cbd5e1', fontSize: 12 },
  dot: { color: '#475569', fontSize: 12 },
  timestamp: { color: '#64748b', fontSize: 11, marginTop: 2 },
  bodyScroll: { marginTop: 6, maxHeight: 200 },
  bodyContent: { paddingBottom: 8 },
  body: { color: '#e5e7eb', fontSize: 14, lineHeight: 20 },
  parentBlock: { marginTop: 8, padding: 8, backgroundColor: '#0f172a', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#475569' },
  parentLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' as const },
  parentPreview: { color: '#cbd5e1', fontSize: 12, marginTop: 2 },
  factRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  factLabel: { color: '#64748b', fontSize: 11, fontWeight: '700' },
  factValue: { color: '#e2e8f0', fontSize: 11 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  tag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  tagText: { color: '#0b1220', fontWeight: '800', fontSize: 9 },
  bandRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  bandChip: { flex: 1, backgroundColor: '#1f2937', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 8 },
  bandLabel: { color: '#64748b', fontSize: 9, textTransform: 'uppercase' as const, fontWeight: '700' },
  bandValue: { color: '#f8fafc', fontSize: 11, marginTop: 1, textTransform: 'capitalize' as const },
  hint: { marginTop: 8 },
  hintText: { color: '#a855f7', fontSize: 11, fontStyle: 'italic' as const },
  actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  actionChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, minHeight: 28 },
  actionChipText: { color: '#0b1220', fontWeight: '800', fontSize: 11 },
});
