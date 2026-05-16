import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { FlagSummary } from './FlagSummary';
import { TopicSatisfactionBadge } from './TopicSatisfactionBadge';
import type { ArgumentRow, ArgumentTag, ArgumentFlag, TopicSatisfactionCheck } from './types';

interface Props {
  argument: ArgumentRow;
  tags: ArgumentTag[];
  flags: ArgumentFlag[];
  checks: TopicSatisfactionCheck[];
  knownChildCount: number | null;
  isExpanded: boolean;
  isFocused: boolean;
  depth: number;
  onExpand: () => void;
  onCollapse: () => void;
  onFocus: () => void;
  onReply: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  thesis: 'Thesis',
  claim: 'Claim',
  rebuttal: 'Rebuttal',
  counter_rebuttal: 'Counter-Rebuttal',
  evidence: 'Evidence',
  clarification_request: 'Clarification',
  concession: 'Concession',
  synthesis: 'Synthesis',
};

const SIDE_COLORS: Record<string, { dot: string; label: string }> = {
  affirmative: { dot: '#4f46e5', label: 'Aff' },
  negative: { dot: '#dc2626', label: 'Neg' },
  neutral: { dot: '#6b7280', label: 'Ntl' },
};

const MAX_BODY_CHARS = 280;

export function ArgumentNode({
  argument,
  tags,
  flags,
  checks,
  knownChildCount,
  isExpanded,
  isFocused,
  depth,
  onExpand,
  onCollapse,
  onFocus,
  onReply,
}: Props) {
  const sideStyle = SIDE_COLORS[argument.side] ?? SIDE_COLORS.neutral;
  const typeLabel = TYPE_LABEL[argument.argumentType] ?? argument.argumentType;
  const body =
    argument.body.length > MAX_BODY_CHARS
      ? `${argument.body.slice(0, MAX_BODY_CHARS)}…`
      : argument.body;
  const hasChildren = knownChildCount === null || knownChildCount > 0;
  const indent = Math.min(depth, 6) * 16;

  return (
    <View style={[styles.container, isFocused && styles.containerFocused, { marginLeft: indent }]}>
      <View style={styles.header}>
        <View style={styles.meta}>
          <View style={[styles.sideDot, { backgroundColor: sideStyle.dot }]} />
          <Text style={styles.typeLabel}>{typeLabel}</Text>
          <Text style={styles.sideLabel}>{sideStyle.label}</Text>
        </View>
        <View style={styles.badges}>
          <FlagSummary flags={flags} />
          <TopicSatisfactionBadge checks={checks} />
        </View>
      </View>

      <Pressable
        onPress={onFocus}
        accessibilityRole="button"
        accessibilityLabel={`Focus argument: ${argument.body.slice(0, 60)}`}
      >
        <Text style={styles.body}>{body}</Text>
      </Pressable>

      {tags.length > 0 ? (
        <View style={styles.tags}>
          {tags.map((t) => (
            <View key={t.tagCode} style={styles.tag}>
              <Text style={styles.tagText}>{t.tagCode}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.footer}>
        {hasChildren ? (
          <Pressable
            style={styles.footerButton}
            onPress={isExpanded ? onCollapse : onExpand}
            accessibilityRole="button"
            accessibilityLabel={isExpanded ? 'Collapse replies' : 'Expand replies'}
          >
            <Text style={styles.footerButtonText}>
              {isExpanded ? '▲ Collapse' : knownChildCount === null ? '▼ Replies' : `▼ ${knownChildCount} repl${knownChildCount === 1 ? 'y' : 'ies'}`}
            </Text>
          </Pressable>
        ) : (
          <View style={styles.footerButton}>
            <Text style={styles.noRepliesText}>No replies</Text>
          </View>
        )}
        <Pressable
          style={styles.footerButton}
          onPress={onReply}
          accessibilityRole="button"
          accessibilityLabel="Reply"
        >
          <Text style={styles.replyText}>Reply</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    marginBottom: 8,
  },
  containerFocused: { borderColor: '#6366f1', backgroundColor: '#fafafe' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sideDot: { width: 8, height: 8, borderRadius: 4 },
  typeLabel: { fontSize: 11, fontWeight: '700', color: '#374151' },
  sideLabel: { fontSize: 11, color: '#9ca3af' },
  badges: { flexDirection: 'row', gap: 4 },
  body: { fontSize: 14, color: '#111827', lineHeight: 20, marginBottom: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 8 },
  tag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, backgroundColor: '#f3f4f6' },
  tagText: { fontSize: 10, color: '#6b7280', fontWeight: '600' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#f3f4f6', paddingTop: 8 },
  footerButton: { paddingHorizontal: 4 },
  footerButtonText: { fontSize: 12, color: '#6366f1', fontWeight: '600' },
  replyText: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  noRepliesText: { fontSize: 12, color: '#d1d5db' },
});
