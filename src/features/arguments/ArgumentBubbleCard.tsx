/**
 * Stage 6.1.8 — ArgumentBubbleCard
 *
 * One card in the Stack or one expanded marker in the Timeline. Always
 * displays:
 *   - kind label + side label
 *   - body (already redacted upstream)
 *   - absolute + relative timestamp as two stacked Texts (never prose-joined)
 *   - parent hint when available
 *   - qualifier badges
 *   - point-standing/resting-status hint
 *
 * Never exposes message-body editing. Own bubbles never show edit affordances.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ArgumentBubbleViewModel } from './argumentGameSurfaceModel';

interface Props {
  viewModel: ArgumentBubbleViewModel;
  onActivate?: (messageId: string) => void;
  onToggleMode?: () => void;
  compact?: boolean;
}

export function ArgumentBubbleCard({ viewModel: vm, onActivate, onToggleMode, compact }: Props) {
  const isOwn = vm.actor === 'self';

  return (
    <Pressable
      style={[styles.card, vm.isActive && styles.cardActive, isOwn && styles.cardOwn]}
      onPress={() => onActivate?.(vm.messageId)}
      onLongPress={() => onToggleMode?.()}
      accessibilityRole="button"
      accessibilityState={{ selected: vm.isActive }}
      accessibilityLabel={`Message ${vm.ordinal}: ${vm.kindLabel}${vm.isLatest ? ' (latest)' : ''}`}
      testID={`argument-bubble-${vm.messageId}`}
    >
      <View style={styles.headerRow}>
        <View style={[styles.kindPill, isOwn && styles.kindPillOwn]}>
          <Text style={[styles.kindPillText, isOwn && styles.kindPillTextOwn]}>{vm.kindLabel}</Text>
        </View>
        <View style={styles.sidePill}>
          <Text style={styles.sidePillText}>{vm.sideLabel}</Text>
        </View>
        {vm.isLatest && (
          <View style={styles.latestPill} accessibilityLabel="latest-message-badge">
            <Text style={styles.latestPillText}>Latest</Text>
          </View>
        )}
      </View>

      {vm.parentHint && (
        <Text style={styles.parentHint} numberOfLines={1} testID={`bubble-parent-hint-${vm.messageId}`}>
          {vm.parentHint}
        </Text>
      )}

      <Text style={[styles.body, compact && styles.bodyCompact]} numberOfLines={compact ? 3 : undefined} testID={`bubble-body-${vm.messageId}`}>
        {vm.body}
      </Text>

      {(vm.qualifierBadges.length > 0 || vm.pointStandingHint) && (
        <View style={styles.badgeRow}>
          {vm.qualifierBadges.map((b, i) => (
            <View key={`${b}-${i}`} style={styles.badge}>
              <Text style={styles.badgeText}>{b}</Text>
            </View>
          ))}
          {vm.pointStandingHint && (
            <View style={[styles.badge, styles.badgePointStanding]}>
              <Text style={styles.badgeText}>{vm.pointStandingHint}</Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.timeBlock} accessibilityLabel={`bubble-time-${vm.messageId}`}>
        <Text style={styles.timeAbsolute}>{vm.createdAtLabel}</Text>
        <Text style={styles.timeRelative}>{vm.relativeLabel}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minWidth: 240,
    maxWidth: 460,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  cardActive: { borderColor: '#818cf8', backgroundColor: '#111c39' },
  cardOwn: { borderColor: '#22d3ee' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  kindPill: { backgroundColor: '#1e293b', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  kindPillOwn: { backgroundColor: '#155e75' },
  kindPillText: { color: '#cbd5e1', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  kindPillTextOwn: { color: '#ecfeff' },
  sidePill: { backgroundColor: '#312e81', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  sidePillText: { color: '#e0e7ff', fontSize: 10, fontWeight: '700' },
  latestPill: { marginLeft: 'auto', backgroundColor: '#0e7490', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  latestPillText: { color: '#ecfeff', fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  parentHint: { color: '#94a3b8', fontSize: 11, fontStyle: 'italic', marginBottom: 4 },
  body: { color: '#f8fafc', fontSize: 15, lineHeight: 22 },
  bodyCompact: { fontSize: 13, lineHeight: 18 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  badge: { backgroundColor: '#1f2937', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgePointStanding: { backgroundColor: '#3b0764' },
  badgeText: { color: '#cbd5e1', fontSize: 10, fontWeight: '600' },
  timeBlock: { marginTop: 10 },
  timeAbsolute: { color: '#e2e8f0', fontSize: 11, fontVariant: ['tabular-nums'] as ['tabular-nums'] },
  timeRelative: { color: '#94a3b8', fontSize: 10 },
});
