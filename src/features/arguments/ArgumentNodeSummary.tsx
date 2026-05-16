import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ArgumentRow } from './types';

interface Props {
  argument: ArgumentRow;
  isFocused?: boolean;
}

const TYPE_ABBREV: Record<string, string> = {
  thesis: 'THS',
  claim: 'CLM',
  rebuttal: 'RBT',
  counter_rebuttal: 'CRB',
  evidence: 'EVI',
  clarification_request: 'CLR',
  concession: 'CON',
  synthesis: 'SYN',
};

const SIDE_COLOR: Record<string, string> = {
  affirmative: '#4f46e5',
  negative: '#dc2626',
  neutral: '#6b7280',
};

export function ArgumentNodeSummary({ argument, isFocused = false }: Props) {
  const abbrev = TYPE_ABBREV[argument.argumentType] ?? '???';
  const sideColor = SIDE_COLOR[argument.side] ?? '#6b7280';

  return (
    <View style={[styles.container, isFocused && styles.containerFocused]}>
      <View style={[styles.typeBadge, { borderColor: sideColor }]}>
        <Text style={[styles.typeText, { color: sideColor }]}>{abbrev}</Text>
      </View>
      <Text style={styles.body} numberOfLines={1}>
        {argument.body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f9fafb',
  },
  containerFocused: { backgroundColor: '#eef2ff' },
  typeBadge: {
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  typeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  body: { flex: 1, fontSize: 12, color: '#374151' },
});
