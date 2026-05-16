import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { TopicSatisfactionCheck } from './types';

interface Props {
  checks: TopicSatisfactionCheck[];
}

const STATUS_STYLES: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  satisfied: { bg: '#d1fae5', text: '#065f46', label: 'On-topic' },
  weak: { bg: '#fef3c7', text: '#92400e', label: 'Weak relevance' },
  failed: { bg: '#fee2e2', text: '#991b1b', label: 'Off-topic' },
  not_applicable: { bg: '#f3f4f6', text: '#6b7280', label: 'N/A' },
};

export function TopicSatisfactionBadge({ checks }: Props) {
  if (checks.length === 0) return null;

  // Show the worst status among all checks.
  const priority = ['failed', 'weak', 'satisfied', 'not_applicable'];
  const worst = checks.reduce<string>((acc, c) => {
    return priority.indexOf(c.status) < priority.indexOf(acc) ? c.status : acc;
  }, checks[0].status);

  const s = STATUS_STYLES[worst] ?? STATUS_STYLES.not_applicable;

  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.text, { color: s.text }]}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start' },
  text: { fontSize: 10, fontWeight: '700' },
});
