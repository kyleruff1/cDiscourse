import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

interface Props {
  draftBody: string;
  onResume: () => void;
  onDiscard: () => void;
}

const PREVIEW_LENGTH = 80;

export function ComposerDraftRecoveryNotice({ draftBody, onResume, onDiscard }: Props) {
  const trimmed = draftBody.trim();
  const preview = trimmed.slice(0, PREVIEW_LENGTH);
  const isLong = trimmed.length > PREVIEW_LENGTH;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unsaved draft recovered</Text>
      {preview ? (
        <Text style={styles.preview} numberOfLines={2}>
          &ldquo;{preview}{isLong ? '…' : ''}&rdquo;
        </Text>
      ) : null}
      <View style={styles.actions}>
        <Pressable
          style={[styles.button, styles.resumeButton]}
          onPress={onResume}
          accessibilityRole="button"
          accessibilityLabel="Resume draft"
        >
          <Text style={styles.resumeLabel}>Resume</Text>
        </Pressable>
        <Pressable
          style={[styles.button, styles.discardButton]}
          onPress={onDiscard}
          accessibilityRole="button"
          accessibilityLabel="Discard draft"
        >
          <Text style={styles.discardLabel}>Discard</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 12,
  },
  title: { fontSize: 13, fontWeight: '700', color: '#92400e', marginBottom: 4 },
  preview: { fontSize: 13, color: '#78350f', fontStyle: 'italic', marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 10 },
  button: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 7,
    alignItems: 'center',
  },
  resumeButton: { backgroundColor: '#6366f1' },
  discardButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db' },
  resumeLabel: { color: '#fff', fontSize: 13, fontWeight: '600' },
  discardLabel: { color: '#374151', fontSize: 13, fontWeight: '500' },
});
