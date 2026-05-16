import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ArgumentFlag } from './types';

interface Props {
  flags: ArgumentFlag[];
}

export function FlagSummary({ flags }: Props) {
  const open = flags.filter((f) => f.status === 'open' || f.status === 'needs_review');
  if (open.length === 0) return null;

  const hasBlocking = open.some((f) => f.source === 'server_rules');

  return (
    <View style={[styles.badge, hasBlocking ? styles.blocking : styles.warning]}>
      <Text style={[styles.text, hasBlocking ? styles.blockingText : styles.warningText]}>
        {open.length} flag{open.length > 1 ? 's' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  warning: { backgroundColor: '#fef3c7' },
  blocking: { backgroundColor: '#fee2e2' },
  text: { fontSize: 10, fontWeight: '700' },
  warningText: { color: '#92400e' },
  blockingText: { color: '#991b1b' },
});
