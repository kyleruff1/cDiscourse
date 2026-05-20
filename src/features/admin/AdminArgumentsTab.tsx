import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import {
  loadAdminArguments,
  countArgumentFlags,
  type AdminArgumentsSortField,
  type AdminArgumentsSortDirection,
} from './adminArgumentsApi';
import type { AdminArgumentRow } from './types';
import { formatDateTime, formatRelativeShort } from '../../lib/formatDateTime';
import {
  deriveMessageCategory,
  derivePrimaryQualifier,
  formatCategoryLabel,
  formatQualifierLabel,
  getQualifierUiNudge,
} from '../arguments/messageQualifiers';

type LoadState = 'idle' | 'loading' | 'error';

const SORT_HUMAN_LABEL: Record<`${AdminArgumentsSortField}:${AdminArgumentsSortDirection}`, string> = {
  'updated_at:desc': 'Newest activity',
  'updated_at:asc': 'Oldest activity',
  'created_at:desc': 'Newest created',
  'created_at:asc': 'Oldest created',
};

const SORT_COLUMN_LABEL: Record<AdminArgumentsSortField, string> = {
  updated_at: 'Last Updated',
  created_at: 'Created',
};

// ── Column widths. The table is wrapped in a horizontal ScrollView so the
//    columns never collapse into "card metadata" on narrow viewports.
const COL = {
  status: 80,
  side: 64,
  type: 130,
  debate: 280,
  cat: 170,
  created: 170,
  updated: 170,
  action: 80,
};
const TABLE_WIDTH =
  COL.status + COL.side + COL.type + COL.debate + COL.cat + COL.created + COL.updated + COL.action;

function shortenId(id: string | null | undefined, prefix = 6): string {
  if (!id) return '—';
  return id.length <= prefix ? id : `${id.slice(0, prefix)}…`;
}

function shortenBody(body: string, max = 160): string {
  const s = String(body || '').replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

function sortArrow(active: boolean, dir: AdminArgumentsSortDirection): string {
  if (!active) return '';
  return dir === 'desc' ? ' ↓' : ' ↑';
}

interface SortableHeaderProps {
  label: string;
  field: AdminArgumentsSortField;
  sortField: AdminArgumentsSortField;
  sortDirection: AdminArgumentsSortDirection;
  onPress: (field: AdminArgumentsSortField) => void;
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
      // testID is used by integration tests; pass through to the underlying
      // node for both React Native + React Native Web renderers.
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

interface PlainHeaderProps { label: string; width: number; flex?: number }
function PlainHeader({ label, width }: PlainHeaderProps) {
  return (
    <View style={[styles.headerCell, { width }]}>
      <Text style={styles.headerCellText}>{label}</Text>
    </View>
  );
}

export function AdminArgumentsTab() {
  const [rows, setRows] = useState<AdminArgumentRow[]>([]);
  const [flagsByArgId, setFlagsByArgId] = useState<Record<string, number>>({});
  const [state, setState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [sortField, setSortField] = useState<AdminArgumentsSortField>('updated_at');
  const [sortDirection, setSortDirection] = useState<AdminArgumentsSortDirection>('desc');

  const fetchRows = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const fresh = await loadAdminArguments({ limit, sortField, sortDirection });
      setRows(fresh);
      const counts = await countArgumentFlags(fresh.map((r) => r.id));
      setFlagsByArgId(counts);
      setState('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('error');
    }
  }, [limit, sortField, sortDirection]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const toggleSort = useCallback((field: AdminArgumentsSortField) => {
    if (field === sortField) {
      setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }, [sortField]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const needle = search.trim().toLowerCase();
    return rows.filter((r) =>
      r.body.toLowerCase().includes(needle)
      || (r.debateTitle ?? '').toLowerCase().includes(needle)
      || (r.authorDisplayName ?? '').toLowerCase().includes(needle)
      || r.argumentType.toLowerCase().includes(needle)
      || (r.disagreementAxis ?? '').toLowerCase().includes(needle),
    );
  }, [rows, search]);

  const sortStatusKey = `${sortField}:${sortDirection}` as keyof typeof SORT_HUMAN_LABEL;
  const sortStatusHuman = SORT_HUMAN_LABEL[sortStatusKey];
  const sortStatusColumn = `${SORT_COLUMN_LABEL[sortField]}${sortArrow(true, sortDirection)}`;

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Filter by body, room, author, type, or axis…"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          accessibilityLabel="admin-arguments-search"
        />
        <Pressable
          style={[styles.chip, limit === 50 && styles.chipActive]}
          onPress={() => setLimit(50)}
          accessibilityLabel="admin-arguments-limit-50"
        >
          <Text style={[styles.chipText, limit === 50 && styles.chipTextActive]}>50</Text>
        </Pressable>
        <Pressable
          style={[styles.chip, limit === 100 && styles.chipActive]}
          onPress={() => setLimit(100)}
          accessibilityLabel="admin-arguments-limit-100"
        >
          <Text style={[styles.chipText, limit === 100 && styles.chipTextActive]}>100</Text>
        </Pressable>
        <Pressable
          style={[styles.chip, limit === 200 && styles.chipActive]}
          onPress={() => setLimit(200)}
          accessibilityLabel="admin-arguments-limit-200"
        >
          <Text style={[styles.chipText, limit === 200 && styles.chipTextActive]}>200</Text>
        </Pressable>
        <Pressable style={styles.refreshBtn} onPress={fetchRows} accessibilityLabel="admin-arguments-refresh">
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </Pressable>
      </View>

      <Text style={styles.sortStatus} accessibilityLabel="admin-arguments-sort-status">
        Sorted by: {sortStatusColumn} ({sortStatusHuman})
      </Text>
      <Text style={styles.sortHelper} accessibilityLabel="admin-arguments-sort-helper">
        Use <Text style={styles.sortHelperBold}>Last Updated</Text> to find active conversations.
        Use <Text style={styles.sortHelperBold}>Created</Text> to find newest rooms.
      </Text>
      <Text style={styles.sortLegend} accessibilityLabel="admin-arguments-sort-legend">
        Activity = most recent argument update · Created = original post/room creation time
      </Text>

      {state === 'loading' && (
        <Text style={styles.status} accessibilityLabel="admin-arguments-loading">
          Loading latest argument activity… (sort: {sortStatusColumn})
        </Text>
      )}
      {state === 'error' && (
        <Text style={styles.error} accessibilityLabel="admin-arguments-error">
          Could not load argument activity. Check admin access and try again. (detail: {error ?? 'unknown error'})
        </Text>
      )}
      {state === 'idle' && rows.length === 0 && (
        <Text style={styles.status} accessibilityLabel="admin-arguments-empty">
          No arguments yet. Once any user submits an argument it will appear here, newest activity first.
        </Text>
      )}
      {state === 'idle' && rows.length > 0 && filtered.length === 0 && (
        <Text style={styles.status} accessibilityLabel="admin-arguments-empty-filtered">
          No arguments match this search. Try clearing filters or increasing the limit.
        </Text>
      )}

      {/* Horizontally scrollable table. Columns never collapse into card
          metadata on narrow viewports — they stay as scannable columns. */}
      <ScrollView
        horizontal
        style={styles.tableWrap}
        contentContainerStyle={{ minWidth: TABLE_WIDTH }}
        accessibilityLabel="admin-arguments-table-scroller"
      >
        <View style={styles.table} accessibilityLabel="admin-arguments-table" testID="admin-arguments-table">
          <View style={styles.headerRow} accessibilityLabel="admin-arguments-header-row">
            <PlainHeader label="Status" width={COL.status} />
            <PlainHeader label="Side" width={COL.side} />
            <PlainHeader label="Type" width={COL.type} />
            <PlainHeader label="Debate / Argument" width={COL.debate} />
            <PlainHeader label="Category / Qualifier" width={COL.cat} />
            <SortableHeader
              label="Created"
              field="created_at"
              sortField={sortField}
              sortDirection={sortDirection}
              onPress={toggleSort}
              width={COL.created}
              testID="admin-arguments-header-created"
            />
            <SortableHeader
              label="Last Updated"
              field="updated_at"
              sortField={sortField}
              sortDirection={sortDirection}
              onPress={toggleSort}
              width={COL.updated}
              testID="admin-arguments-header-updated"
            />
            <PlainHeader label="Action" width={COL.action} />
          </View>

          <ScrollView style={styles.bodyScroller} accessibilityLabel="admin-arguments-list">
            {filtered.map((r) => {
              const category = deriveMessageCategory({
                argumentType: r.argumentType,
                side: r.side,
                disagreementAxis: r.disagreementAxis,
                selectedTagCodes: r.selectedTagCodes,
                targetExcerpt: r.targetExcerpt,
                body: r.body,
              });
              const qualifier = derivePrimaryQualifier({
                argumentType: r.argumentType,
                disagreementAxis: r.disagreementAxis,
                selectedTagCodes: r.selectedTagCodes,
                targetExcerpt: r.targetExcerpt,
                body: r.body,
              });
              const flagCount = flagsByArgId[r.id] || 0;
              const hasUpdated = Boolean(r.updatedAt);
              const updatedDisplay = hasUpdated ? r.updatedAt : r.createdAt;
              return (
                <View
                  key={r.id}
                  style={styles.row}
                  accessibilityLabel={`admin-argument-${r.id}`}
                >
                  <View style={[styles.cell, { width: COL.status }]}>
                    <Badge label={r.status} variant="status" />
                  </View>
                  <View style={[styles.cell, { width: COL.side }]}>
                    <Badge label={r.side} variant="side" />
                  </View>
                  <View style={[styles.cell, { width: COL.type }]}>
                    <Badge label={r.argumentType} variant="type" />
                    {r.disagreementAxis && (
                      <Text style={styles.subtle}>axis: {r.disagreementAxis}</Text>
                    )}
                  </View>
                  <View style={[styles.cell, styles.cellDebate, { width: COL.debate }]}>
                    <Text style={styles.metaTitle} numberOfLines={1}>
                      {r.debateTitle ?? `Room ${shortenId(r.debateId)}`}
                    </Text>
                    <Text style={styles.metaAuthor} numberOfLines={1}>
                      {r.authorDisplayName ?? shortenId(r.authorId)}
                    </Text>
                    <Text style={styles.body} numberOfLines={3}>
                      {shortenBody(r.body)}
                    </Text>
                    {qualifier && (
                      <Text style={styles.nudge} numberOfLines={2}>
                        Nudge: {getQualifierUiNudge(qualifier)}
                      </Text>
                    )}
                  </View>
                  <View style={[styles.cell, { width: COL.cat }]}>
                    <Badge label={formatCategoryLabel(category)} variant="category" />
                    {qualifier && (
                      <Badge label={formatQualifierLabel(qualifier)} variant="qualifier" />
                    )}
                    {flagCount > 0 && <Badge label={`flags: ${flagCount}`} variant="flag" />}
                    {typeof r.topicSatisfactionScore === 'number' && (
                      <Badge label={`topic ${(r.topicSatisfactionScore * 100).toFixed(0)}%`} variant="topic" />
                    )}
                  </View>
                  <View
                    style={[styles.cell, { width: COL.created }]}
                    accessibilityLabel={`admin-arguments-cell-created-${r.id}`}
                    testID="admin-arguments-cell-created"
                  >
                    <Text style={styles.timeAbsolute}>{formatDateTime(r.createdAt)}</Text>
                    <Text style={styles.timeRelative}>{formatRelativeShort(r.createdAt)}</Text>
                  </View>
                  <View
                    style={[styles.cell, { width: COL.updated }]}
                    accessibilityLabel={`admin-arguments-cell-updated-${r.id}`}
                    testID="admin-arguments-cell-updated"
                  >
                    <Text style={styles.timeAbsolute}>{formatDateTime(updatedDisplay)}</Text>
                    <Text style={styles.timeRelative}>{formatRelativeShort(updatedDisplay)}</Text>
                    {!hasUpdated && (
                      <Text style={styles.fallbackHint}>same as created</Text>
                    )}
                  </View>
                  <View style={[styles.cell, { width: COL.action }]}>
                    <Text style={styles.actionId}>{shortenId(r.id, 8)}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </ScrollView>

      <Text style={styles.footnote}>
        Showing {filtered.length} of {rows.length}. Outputs are advisory; the app does not declare any verdict on speakers.
      </Text>
    </View>
  );
}

function Badge({ label, variant }: { label: string; variant: string }) {
  const palette: Record<string, { bg: string; fg: string }> = {
    type: { bg: '#eef2ff', fg: '#3730a3' },
    side: { bg: '#fef3c7', fg: '#92400e' },
    category: { bg: '#ecfdf5', fg: '#065f46' },
    qualifier: { bg: '#fce7f3', fg: '#9d174d' },
    axis: { bg: '#fef2f2', fg: '#991b1b' },
    flag: { bg: '#ffe4e6', fg: '#9f1239' },
    topic: { bg: '#e0f2fe', fg: '#075985' },
    status: { bg: '#f1f5f9', fg: '#334155' },
  };
  const c = palette[variant] || palette.status;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  toolbar: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    fontSize: 13,
    marginRight: 6,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    marginRight: 4,
  },
  chipActive: { backgroundColor: '#1f2937' },
  chipText: { fontSize: 11, color: '#374151', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  refreshBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#1d4ed8',
  },
  refreshBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  sortStatus: {
    fontSize: 11,
    color: '#374151',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#f9fafb',
    fontWeight: '600',
  },
  sortHelper: {
    fontSize: 11,
    color: '#4b5563',
    paddingHorizontal: 10,
    paddingBottom: 2,
    backgroundColor: '#f9fafb',
  },
  sortHelperBold: { fontWeight: '700', color: '#1f2937' },
  sortLegend: {
    fontSize: 10,
    color: '#9ca3af',
    paddingHorizontal: 10,
    paddingBottom: 6,
    backgroundColor: '#f9fafb',
    fontStyle: 'italic',
  },
  status: { padding: 12, color: '#6b7280', fontSize: 13 },
  error: { padding: 12, color: '#b91c1c', fontSize: 13, backgroundColor: '#fef2f2' },
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
  cell: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRightWidth: 1,
    borderRightColor: '#f3f4f6',
    gap: 2,
  },
  cellDebate: { paddingRight: 8 },
  metaTitle: { fontSize: 12, fontWeight: '700', color: '#111827' },
  metaAuthor: { fontSize: 10, color: '#6b7280' },
  body: { fontSize: 11, color: '#374151' },
  subtle: { fontSize: 10, color: '#6b7280', marginTop: 2 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 2 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  timeAbsolute: { fontSize: 11, color: '#111827', fontVariant: ['tabular-nums'] as ['tabular-nums'] },
  timeRelative: { fontSize: 10, color: '#6b7280' },
  fallbackHint: { fontSize: 9, color: '#9ca3af', fontStyle: 'italic', marginTop: 2 },
  actionId: { fontSize: 10, color: '#6b7280', fontFamily: 'monospace' as 'monospace' },
  nudge: { fontSize: 10, color: '#4b5563', fontStyle: 'italic', marginTop: 4 },
  footnote: {
    padding: 8,
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
});
