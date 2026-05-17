import React, { useMemo, useState } from 'react';
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
import { formatDateTime, formatRelativeShort } from '../../lib/formatDateTime';

type DebateSortField = 'updated_at' | 'created_at';
type DebateSortDirection = 'desc' | 'asc';

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
  const hasUpdated = Boolean(debate.updatedAt);
  const updatedDisplay = hasUpdated ? debate.updatedAt : debate.createdAt;

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
      <View style={styles.cardTimes} accessibilityLabel={`debate-times-${debate.id}`}>
        <Text style={styles.cardTimeText}>
          <Text style={styles.cardTimeLabel}>Created </Text>
          {formatDateTime(debate.createdAt)} · {formatRelativeShort(debate.createdAt)}
        </Text>
        <Text style={styles.cardTimeText}>
          <Text style={styles.cardTimeLabel}>
            Last Updated{hasUpdated ? ' ' : ': same as created · '}
          </Text>
          {formatDateTime(updatedDisplay)} · {formatRelativeShort(updatedDisplay)}
        </Text>
      </View>
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
  const [sortField, setSortField] = useState<DebateSortField>('updated_at');
  const [sortDirection, setSortDirection] = useState<DebateSortDirection>('desc');

  const toggleSort = (field: DebateSortField) => {
    if (field === sortField) {
      setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedDebates = useMemo(() => {
    const arr = [...debates];
    const pick = (d: Debate) => {
      const v = sortField === 'created_at' ? d.createdAt : (d.updatedAt || d.createdAt);
      const t = new Date(v).getTime();
      return Number.isNaN(t) ? 0 : t;
    };
    arr.sort((a, b) => (sortDirection === 'asc' ? pick(a) - pick(b) : pick(b) - pick(a)));
    return arr;
  }, [debates, sortField, sortDirection]);

  const sortHuman = sortField === 'updated_at'
    ? (sortDirection === 'desc' ? 'Newest activity' : 'Oldest activity')
    : (sortDirection === 'desc' ? 'Newest created' : 'Oldest created');
  const sortColumn = sortField === 'updated_at' ? 'Last Updated' : 'Created';
  const sortArrow = sortDirection === 'desc' ? '↓' : '↑';

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
          <Text style={styles.errorText}>Could not load debates. Pull to refresh. (detail: {error})</Text>
        </View>
      ) : null}

      <View style={styles.sortBar} accessibilityLabel="debates-sort-bar">
        <Text style={styles.sortBarLabel}>Sort by:</Text>
        <Pressable
          onPress={() => toggleSort('updated_at')}
          style={[styles.sortChip, sortField === 'updated_at' && styles.sortChipActive]}
          accessibilityLabel="debates-sort-updated"
        >
          <Text style={[styles.sortChipText, sortField === 'updated_at' && styles.sortChipTextActive]}>
            Last Updated{sortField === 'updated_at' ? ` ${sortArrow}` : ''}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => toggleSort('created_at')}
          style={[styles.sortChip, sortField === 'created_at' && styles.sortChipActive]}
          accessibilityLabel="debates-sort-created"
        >
          <Text style={[styles.sortChipText, sortField === 'created_at' && styles.sortChipTextActive]}>
            Created{sortField === 'created_at' ? ` ${sortArrow}` : ''}
          </Text>
        </Pressable>
      </View>
      <Text style={styles.sortStatus} accessibilityLabel="debates-sort-status">
        Sorted by: {sortColumn} {sortArrow} ({sortHuman})
      </Text>
      <Text style={styles.sortHelper}>
        Use Last Updated to find active conversations. Use Created to find newest rooms.
      </Text>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
      >
        {sortedDebates.length === 0 ? (
          <EmptyState
            title="No debates yet"
            body={'Tap "+ New" to start the first debate.'}
            actionLabel="Create Debate"
            onAction={() => setShowCreate(true)}
          />
        ) : (
          sortedDebates.map((debate) => (
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
  cardTimes: { marginTop: 8, gap: 2 },
  cardTimeText: { fontSize: 11, color: '#6b7280' },
  cardTimeLabel: { color: '#9ca3af', fontWeight: '700', textTransform: 'uppercase', fontSize: 10 },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 6,
  },
  sortBarLabel: { fontSize: 11, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase' },
  sortChip: {
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sortChipActive: { backgroundColor: '#e0e7ff', borderColor: '#6366f1' },
  sortChipText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  sortChipTextActive: { color: '#4338ca' },
  sortStatus: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 2,
    backgroundColor: '#f9fafb',
  },
  sortHelper: {
    fontSize: 11,
    color: '#4b5563',
    paddingHorizontal: 12,
    paddingBottom: 6,
    backgroundColor: '#f9fafb',
  },
});
