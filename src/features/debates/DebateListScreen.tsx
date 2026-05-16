import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { EmptyState } from '../../components/EmptyState';
import { LoadingNotice } from '../../components/LoadingNotice';
import { CreateDebateForm } from './CreateDebateForm';
import { JoinDebatePanel } from './JoinDebatePanel';
import type { Debate, CreateDebateInput, ParticipantSide } from './types';

interface Props {
  debates: Debate[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onCreate: (input: CreateDebateInput) => Promise<Debate | null>;
  onJoin: (debateId: string, side: ParticipantSide) => Promise<ParticipantSide | null>;
  onSelect: (debate: Debate, side: ParticipantSide) => void;
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  draft: 'Draft',
  locked: 'Locked',
  archived: 'Archived',
};

const STATUS_DOT: Record<string, string> = {
  open: '#22c55e',
  draft: '#f59e0b',
  locked: '#ef4444',
  archived: '#9ca3af',
};

const SIDE_LABEL: Record<string, string> = {
  affirmative: 'Aff',
  negative: 'Neg',
  observer: 'Obs',
  moderator: 'Mod',
};

interface DebateCardProps {
  debate: Debate;
  onPress: (debate: Debate) => void;
}

function DebateCard({ debate, onPress }: DebateCardProps) {
  const dotColor = STATUS_DOT[debate.status] ?? '#9ca3af';
  const sideText = debate.myParticipantSide ? SIDE_LABEL[debate.myParticipantSide] : null;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => onPress(debate)}
      accessibilityRole="button"
      accessibilityLabel={`Open debate: ${debate.title}`}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardStatus}>
          <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
          <Text style={styles.statusText}>{STATUS_LABEL[debate.status] ?? debate.status}</Text>
        </View>
        {sideText ? (
          <View style={styles.sidePill}>
            <Text style={styles.sidePillText}>{sideText}</Text>
          </View>
        ) : (
          <Text style={styles.joinHint}>Tap to join</Text>
        )}
      </View>
      <Text style={styles.cardTitle} numberOfLines={2}>{debate.title}</Text>
      <Text style={styles.cardResolution} numberOfLines={2}>{debate.resolution}</Text>
    </Pressable>
  );
}

export function DebateListScreen({
  debates,
  loading,
  error,
  onRefresh,
  onCreate,
  onJoin,
  onSelect,
}: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [joiningDebate, setJoiningDebate] = useState<Debate | null>(null);

  const handleDebatePress = (debate: Debate) => {
    if (debate.myParticipantSide) {
      onSelect(debate, debate.myParticipantSide);
    } else {
      setJoiningDebate(debate);
    }
  };

  const handleCreate = async (input: CreateDebateInput) => {
    const debate = await onCreate(input);
    setShowCreate(false);
    if (debate) {
      onSelect(debate, 'moderator');
    }
  };

  const handleJoin = async (side: ParticipantSide) => {
    if (!joiningDebate) return;
    const actualSide = await onJoin(joiningDebate.id, side);
    if (actualSide) {
      onSelect({ ...joiningDebate, myParticipantSide: actualSide }, actualSide);
    }
    setJoiningDebate(null);
  };

  if (showCreate) {
    return <CreateDebateForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} />;
  }

  if (joiningDebate) {
    return (
      <JoinDebatePanel
        debate={joiningDebate}
        onJoin={handleJoin}
        onCancel={() => setJoiningDebate(null)}
      />
    );
  }

  const isInitialLoad = loading && debates.length === 0;

  if (isInitialLoad) {
    return <LoadingNotice message="Loading debates…" />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Debates</Text>
        <Pressable
          style={styles.newButton}
          onPress={() => setShowCreate(true)}
          accessibilityRole="button"
          accessibilityLabel="Create new debate"
        >
          <Text style={styles.newButtonText}>+ New</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
      >
        {debates.length === 0 ? (
          <EmptyState
            title="No debates yet"
            body={'Tap "+ New" to start the first debate.'}
            actionLabel="Create Debate"
            onAction={() => setShowCreate(true)}
          />
        ) : (
          debates.map((debate) => (
            <DebateCard key={debate.id} debate={debate} onPress={handleDebatePress} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  newButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#6366f1',
  },
  newButtonText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  errorBanner: { backgroundColor: '#fef2f2', padding: 12, borderBottomWidth: 1, borderBottomColor: '#fecaca' },
  errorText: { fontSize: 13, color: '#b91c1c', textAlign: 'center' },
  list: { flex: 1 },
  listContent: { padding: 12, gap: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardPressed: { opacity: 0.75 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardStatus: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  sidePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#eef2ff',
  },
  sidePillText: { fontSize: 11, fontWeight: '700', color: '#4f46e5' },
  joinHint: { fontSize: 11, color: '#9ca3af' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
  cardResolution: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
});
