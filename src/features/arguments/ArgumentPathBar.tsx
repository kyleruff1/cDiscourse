import React from 'react';
import { View, ScrollView, Pressable, Text, StyleSheet } from 'react-native';
import { ArgumentNodeSummary } from './ArgumentNodeSummary';
import type { ArgumentCache } from './types';

interface Props {
  pathIds: string[];
  cache: ArgumentCache;
  focusedArgumentId: string | null;
  onTap: (argumentId: string) => void;
  onClear: () => void;
}

export function ArgumentPathBar({ pathIds, cache, focusedArgumentId, onTap, onClear }: Props) {
  if (pathIds.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {pathIds.map((id, index) => {
          const arg = cache.argumentsById[id];
          if (!arg) return null;
          return (
            <View key={id} style={styles.crumb}>
              {index > 0 ? <Text style={styles.separator}>›</Text> : null}
              <Pressable
                onPress={() => onTap(id)}
                accessibilityRole="button"
                accessibilityLabel={`Navigate to: ${arg.body.slice(0, 40)}`}
              >
                <ArgumentNodeSummary argument={arg} isFocused={id === focusedArgumentId} />
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
      <Pressable
        style={styles.clearButton}
        onPress={onClear}
        accessibilityRole="button"
        accessibilityLabel="Clear focus"
      >
        <Text style={styles.clearText}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 6,
  },
  scroll: { paddingHorizontal: 12, gap: 4 },
  crumb: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  separator: { fontSize: 14, color: '#9ca3af' },
  clearButton: { paddingHorizontal: 14, paddingVertical: 8 },
  clearText: { fontSize: 14, color: '#9ca3af', fontWeight: '600' },
});
