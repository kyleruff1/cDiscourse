import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import type { Debate, ParticipantSide } from './types';

interface Props {
  debate: Debate;
  onJoin: (side: ParticipantSide) => Promise<void>;
  onCancel: () => void;
}

const SIDES: Array<{ value: ParticipantSide; label: string; description: string }> = [
  { value: 'affirmative', label: 'Affirmative', description: 'Argue in favour of the resolution.' },
  { value: 'negative', label: 'Negative', description: 'Argue against the resolution.' },
  { value: 'observer', label: 'Observer', description: 'Read without submitting arguments.' },
];

export function JoinDebatePanel({ debate, onJoin, onCancel }: Props) {
  const [selectedSide, setSelectedSide] = useState<ParticipantSide | null>(null);
  const [joining, setJoining] = useState(false);

  const handleJoin = async () => {
    if (!selectedSide) return;
    setJoining(true);
    await onJoin(selectedSide);
    setJoining(false);
  };

  return (
    <Screen title="Join Debate">
      <View style={styles.container}>
        <Text style={styles.debateTitle}>{debate.title}</Text>
        <Text style={styles.resolution}>{debate.resolution}</Text>

        <Text style={styles.sideLabel}>Choose your side</Text>
        {SIDES.map((s) => (
          <Pressable
            key={s.value}
            style={[styles.sideOption, selectedSide === s.value && styles.sideOptionSelected]}
            onPress={() => setSelectedSide(s.value)}
            accessibilityRole="radio"
            accessibilityLabel={s.label}
            accessibilityState={{ checked: selectedSide === s.value }}
          >
            <Text style={[styles.sideName, selectedSide === s.value && styles.sideNameSelected]}>
              {s.label}
            </Text>
            <Text style={styles.sideDesc}>{s.description}</Text>
          </Pressable>
        ))}

        <View style={styles.actions}>
          <Button
            label="Join"
            onPress={handleJoin}
            loading={joining}
            disabled={!selectedSide}
          />
          <Button label="Cancel" variant="secondary" onPress={onCancel} disabled={joining} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  debateTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  resolution: { fontSize: 14, color: '#6b7280', marginBottom: 8 },
  sideLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginTop: 4 },
  sideOption: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  sideOptionSelected: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  sideName: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 2 },
  sideNameSelected: { color: '#4f46e5' },
  sideDesc: { fontSize: 13, color: '#9ca3af' },
  actions: { marginTop: 8, gap: 4 },
});
