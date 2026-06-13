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
import type { JoinAttemptResult } from './useDebates';
import { formatDateTime, formatRelativeShort } from '../../lib/formatDateTime';
import { tableFillContentContainerStyle, flexTableColumnStyle } from '../../lib/responsiveTable';
// ARG-ROOM-006 (items a/e/f) — public/private access badge + plain-language
// access line on each list row (parity with the gallery). No counts are loaded
// here, so the deriver degrades public rooms to `public_open` (no enumeration).
import { deriveRoomAccessView } from './roomAccessModel';
import { ROOM_VISIBILITY_COPY } from '../arguments/gameCopy';

type DebateSortField = 'updated_at' | 'created_at';
type DebateSortDirection = 'desc' | 'asc';

interface Props {
  debates: Debate[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onCreate: (input: CreateDebateInput) => Promise<Debate | null>;
  onJoin: (debateId: string, side: ParticipantSide) => Promise<JoinAttemptResult>;
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

// Column widths — table stays scannable, never collapses into card metadata.
const COL = {
  status: 88,
  side: 70,
  debate: 320,
  created: 170,
  updated: 170,
  action: 110,
};
const TABLE_WIDTH = COL.status + COL.side + COL.debate + COL.created + COL.updated + COL.action;

function safeTimestamp(value: string | null | undefined, fallback?: string | null): number {
  // Real Date comparison — never string comparison.
  const candidate = value && value.length > 0 ? value : (fallback ?? '');
  if (!candidate) return 0;
  const t = new Date(candidate).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function sortArrow(active: boolean, dir: DebateSortDirection): string {
  if (!active) return '';
  return dir === 'desc' ? ' ↓' : ' ↑';
}

interface SortableHeaderProps {
  label: string;
  field: DebateSortField;
  sortField: DebateSortField;
  sortDirection: DebateSortDirection;
  onPress: (field: DebateSortField) => void;
  width: number;
  testID: string;
}

function SortableHeader({ label, field, sortField, sortDirection, onPress, width, testID }: SortableHeaderProps) {
  const active = sortField === field;
  const directionLabel = active ? (sortDirection === 'desc' ? 'sorted descending' : 'sorted ascending') : 'not sorted';
  return (
    <Pressable
      style={[styles.headerCell, { width }, active && styles.headerCellActive]}
      onPress={() => onPress(field)}
      accessibilityRole="button"
      accessibilityLabel={`Sort by ${label}`}
      accessibilityState={{ selected: active }}
      accessibilityHint={directionLabel}
      testID={testID}
    >
      <Text style={[styles.headerCellText, active && styles.headerCellTextActive]}>
        {label}{sortArrow(active, sortDirection)}
      </Text>
      <Text style={styles.headerCellSubtext}>
        {active ? (sortDirection === 'desc' ? '↓ newest first' : '↑ oldest first') : 'tap to sort'}
      </Text>
    </Pressable>
  );
}

interface PlainHeaderProps { label: string; width: number; flexFill?: boolean }
function PlainHeader({ label, width, flexFill }: PlainHeaderProps) {
  // OPS-ADMIN-ARGS-WEB-WIDTH-001 — when `flexFill` is set this header cell uses
  // the flexible-column style (grow to absorb wide-viewport slack, never shrink
  // below `width`). The matching body cell uses the SAME fragment so header and
  // body column widths stay identical.
  return (
    <View style={[styles.headerCell, flexFill ? flexTableColumnStyle(width) : { width }]}>
      <Text style={styles.headerCellText}>{label}</Text>
    </View>
  );
}

interface DebateRowProps {
  debate: Debate;
  onPress: (debate: Debate) => void;
}

function DebateRow({ debate, onPress }: DebateRowProps) {
  const dotColor = STATUS_DOT[debate.status] ?? '#9ca3af';
  const sideText = debate.myParticipantSide ? SIDE_LABEL[debate.myParticipantSide] : '—';
  const hasUpdated = Boolean(debate.updatedAt);
  const updatedDisplay = hasUpdated ? debate.updatedAt : debate.createdAt;
  const accessView = deriveRoomAccessView({
    visibility: debate.visibility === 'private' ? 'private' : 'public',
    openStatus: debate.status,
    isMember: debate.myParticipantSide != null,
    activeCount: null,
    reservedCount: null,
  });
  const isPrivate = debate.visibility === 'private';
  const visibilityA11y = isPrivate
    ? ROOM_VISIBILITY_COPY.badge_private_a11y
    : ROOM_VISIBILITY_COPY.option_public_helper;

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={() => onPress(debate)}
      accessibilityRole="button"
      accessibilityLabel={`${accessView.badgeLabel} · Open argument: ${debate.title}`}
    >
      <View style={[styles.cell, { width: COL.status }]}>
        <View style={styles.cardStatus}>
          <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
          <Text style={styles.statusText}>{STATUS_LABEL[debate.status] ?? debate.status}</Text>
        </View>
      </View>
      <View style={[styles.cell, { width: COL.side }]}>
        <Text style={styles.sideText}>{sideText}</Text>
      </View>
      <View style={[styles.cell, styles.cellDebate, flexTableColumnStyle(COL.debate)]}>
        <View style={styles.titleRow}>
          {/* ARG-ROOM-006 (item f) — access badge; text carries the meaning. */}
          <View
            style={[styles.visibilityPill, isPrivate && styles.visibilityPillPrivate]}
            accessibilityLabel={visibilityA11y}
            testID={`debates-cell-visibility-${debate.id}`}
          >
            <Text style={styles.visibilityPillText}>{accessView.badgeLabel}</Text>
          </View>
          <Text style={styles.title} numberOfLines={1}>{debate.title}</Text>
        </View>
        <Text style={styles.resolution} numberOfLines={2}>{debate.resolution}</Text>
        {/* ARG-ROOM-006 (items e/f) — plain-language access/seat line. */}
        <Text
          style={styles.accessLine}
          numberOfLines={1}
          testID={`debates-cell-access-${debate.id}`}
        >
          {accessView.accessLine}
        </Text>
      </View>
      <View
        style={[styles.cell, { width: COL.created }]}
        accessibilityLabel={`debates-cell-created-${debate.id}`}
        testID="debates-cell-created"
      >
        <Text style={styles.timeAbsolute}>{formatDateTime(debate.createdAt)}</Text>
        <Text style={styles.timeRelative}>{formatRelativeShort(debate.createdAt)}</Text>
      </View>
      <View
        style={[styles.cell, { width: COL.updated }]}
        accessibilityLabel={`debates-cell-updated-${debate.id}`}
        testID="debates-cell-updated"
      >
        <Text style={styles.timeAbsolute}>{formatDateTime(updatedDisplay)}</Text>
        <Text style={styles.timeRelative}>{formatRelativeShort(updatedDisplay)}</Text>
        {!hasUpdated && (
          <Text style={styles.fallbackHint}>same as created</Text>
        )}
      </View>
      <View style={[styles.cell, { width: COL.action }]}>
        <Text style={styles.actionText}>
          {debate.myParticipantSide ? 'Open →' : 'Observe →'}
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
      // Real Date timestamps with null-safe fallback. Never string compare.
      if (sortField === 'created_at') return safeTimestamp(d.createdAt);
      return safeTimestamp(d.updatedAt, d.createdAt);
    };
    arr.sort((a, b) => (sortDirection === 'asc' ? pick(a) - pick(b) : pick(b) - pick(a)));
    return arr;
  }, [debates, sortField, sortDirection]);

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
    // ARG-ROOM-005 — a full room degrades to observe in the room shell; the
    // list panel opens the room only when a seat was actually taken.
    const { side: actualSide } = await onJoin(joiningDebate.id, side);
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
    return <LoadingNotice message="Loading arguments…" />;
  }

  const sortHuman = sortField === 'updated_at'
    ? (sortDirection === 'desc' ? 'Newest activity' : 'Oldest activity')
    : (sortDirection === 'desc' ? 'Newest created' : 'Oldest created');
  const sortColumn = sortField === 'updated_at' ? 'Last Updated' : 'Created';
  const sortArrowVisible = sortDirection === 'desc' ? '↓' : '↑';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Arguments</Text>
        <Pressable
          style={styles.newButton}
          onPress={() => setShowCreate(true)}
          accessibilityRole="button"
          accessibilityLabel="Create new argument"
        >
          <Text style={styles.newButtonText}>+ New</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>Could not load arguments. Pull to refresh. (detail: {error})</Text>
        </View>
      ) : null}

      <Text style={styles.sortStatus} accessibilityLabel="debates-sort-status">
        Sorted by: {sortColumn} {sortArrowVisible} ({sortHuman})
      </Text>
      <Text style={styles.sortHelper}>
        Use Last Updated to find active conversations. Use Created to find newest rooms.
      </Text>

      {/* OPS-ADMIN-ARGS-WEB-WIDTH-001 — content container grows to fill a wide
          web viewport (flexGrow: 1) instead of pinning to TABLE_WIDTH and
          leaving a dead gap on the right; the flexible Debate column absorbs the
          slack. minWidth retains horizontal scroll on narrow viewports. */}
      <ScrollView
        horizontal
        style={styles.tableWrap}
        contentContainerStyle={tableFillContentContainerStyle(TABLE_WIDTH)}
        accessibilityLabel="debates-table-scroller"
      >
        <View style={styles.table} accessibilityLabel="debates-table" testID="debates-table">
          <View style={styles.headerRow} accessibilityLabel="debates-header-row">
            <PlainHeader label="Status" width={COL.status} />
            <PlainHeader label="My Side" width={COL.side} />
            <PlainHeader label="Debate" width={COL.debate} flexFill />
            <SortableHeader
              label="Created"
              field="created_at"
              sortField={sortField}
              sortDirection={sortDirection}
              onPress={toggleSort}
              width={COL.created}
              testID="debates-header-created"
            />
            <SortableHeader
              label="Last Updated"
              field="updated_at"
              sortField={sortField}
              sortDirection={sortDirection}
              onPress={toggleSort}
              width={COL.updated}
              testID="debates-header-updated"
            />
            <PlainHeader label="Action" width={COL.action} />
          </View>
          <ScrollView
            style={styles.bodyScroller}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
            accessibilityLabel="debates-list"
          >
            {sortedDebates.length === 0 ? (
              <View style={{ minWidth: TABLE_WIDTH }}>
                <EmptyState
                  title="No arguments yet"
                  body={'Tap "+ New" to start the first argument.'}
                  actionLabel="Create Argument"
                  onAction={() => setShowCreate(true)}
                />
              </View>
            ) : (
              sortedDebates.map((debate) => (
                <DebateRow key={debate.id} debate={debate} onPress={handleDebatePress} />
              ))
            )}
          </ScrollView>
        </View>
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
  sortStatus: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#f9fafb',
  },
  sortHelper: {
    fontSize: 11,
    color: '#4b5563',
    paddingHorizontal: 12,
    paddingBottom: 6,
    backgroundColor: '#f9fafb',
  },
  tableWrap: { flex: 1 },
  table: { flex: 1, minWidth: TABLE_WIDTH },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 2,
    borderBottomColor: '#d1d5db',
  },
  headerCell: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  headerCellActive: { backgroundColor: '#e0e7ff' },
  headerCellText: { fontSize: 11, fontWeight: '700', color: '#1f2937', textTransform: 'uppercase' },
  headerCellTextActive: { color: '#4338ca' },
  headerCellSubtext: { fontSize: 9, color: '#6b7280', marginTop: 2 },
  bodyScroller: { flex: 1 },
  row: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  rowPressed: { opacity: 0.75 },
  cell: {
    paddingHorizontal: 6,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: '#f3f4f6',
    gap: 2,
  },
  cellDebate: { paddingRight: 8 },
  cardStatus: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, color: '#6b7280', fontWeight: '500' },
  sideText: { fontSize: 12, fontWeight: '700', color: '#4f46e5' },
  title: { fontSize: 13, fontWeight: '700', color: '#111827', flexShrink: 1 },
  resolution: { fontSize: 12, color: '#6b7280', lineHeight: 16 },
  // ARG-ROOM-006 — access badge + line (light-theme parity with the gallery).
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  visibilityPill: { backgroundColor: '#ccfbf1', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 },
  visibilityPillPrivate: { backgroundColor: '#ede9fe' },
  visibilityPillText: { fontSize: 9, fontWeight: '800', color: '#111827', textTransform: 'uppercase', letterSpacing: 0.3 },
  accessLine: { fontSize: 11, color: '#6b7280', marginTop: 3 },
  timeAbsolute: { fontSize: 11, color: '#111827', fontVariant: ['tabular-nums'] as ['tabular-nums'] },
  timeRelative: { fontSize: 10, color: '#6b7280' },
  fallbackHint: { fontSize: 9, color: '#9ca3af', fontStyle: 'italic', marginTop: 2 },
  actionText: { fontSize: 12, fontWeight: '600', color: '#4338ca' },
});
