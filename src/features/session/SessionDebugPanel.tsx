import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppSession } from './useAppSession';

/** Dev-only panel. Render only when __DEV__ is true. Never shows tokens or secrets. */
export function SessionDebugPanel() {
  const { state } = useAppSession();
  const { status, snapshot } = state;

  return (
    <View style={styles.panel}>
      <Text style={styles.header}>Session Debug</Text>
      <Row label="status" value={status} />
      <Row label="userId" value={snapshot.userId ? `…${snapshot.userId.slice(-8)}` : '—'} />
      <Row label="debateId" value={snapshot.selectedDebateId ? `…${snapshot.selectedDebateId.slice(-8)}` : '—'} />
      <Row
        label="focusedArg"
        value={snapshot.viewport?.focusedArgumentId ? `…${snapshot.viewport.focusedArgumentId.slice(-8)}` : '—'}
      />
      <Row
        label="draftDirty"
        value={
          snapshot.activeDraft
            ? snapshot.activeDraft.dirty
              ? 'yes'
              : 'no'
            : '—'
        }
      />
      <Row
        label="pending"
        value={snapshot.pendingSubmission ? snapshot.pendingSubmission.status : '—'}
      />
      <Row
        label="lastSyncAt"
        value={snapshot.lastSyncAt ? new Date(snapshot.lastSyncAt).toLocaleTimeString() : '—'}
      />
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#1e1b4b',
    margin: 8,
    padding: 12,
    borderRadius: 8,
  },
  header: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a5b4fc',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  label: { fontSize: 12, color: '#818cf8', fontFamily: 'monospace' },
  value: { fontSize: 12, color: '#e0e7ff', fontFamily: 'monospace' },
});
