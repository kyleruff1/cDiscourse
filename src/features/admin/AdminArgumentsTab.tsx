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

function shortenId(id: string | null | undefined, prefix = 6): string {
  if (!id) return '—';
  return id.length <= prefix ? id : `${id.slice(0, prefix)}…`;
}

function shortenBody(body: string, max = 220): string {
  const s = String(body || '').replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

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

function sortArrow(active: boolean, dir: AdminArgumentsSortDirection): string {
  if (!active) return '';
  return dir === 'desc' ? ' ↓' : ' ↑';
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

      <View style={styles.sortHeader} accessibilityLabel="admin-arguments-sort-header">
        <Text style={styles.sortHeaderLabel}>Sort by:</Text>
        <Pressable
          onPress={() => toggleSort('updated_at')}
          style={[styles.sortCol, sortField === 'updated_at' && styles.sortColActive]}
          accessibilityLabel="admin-arguments-sort-updated"
        >
          <Text style={[styles.sortColLabel, sortField === 'updated_at' && styles.sortColLabelActive]}>
            Last Updated{sortArrow(sortField === 'updated_at', sortDirection)}
          </Text>
          <Text style={styles.sortColHint}>
            {sortField === 'updated_at'
              ? SORT_HUMAN_LABEL[sortStatusKey]
              : 'Tap for newest activity'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => toggleSort('created_at')}
          style={[styles.sortCol, sortField === 'created_at' && styles.sortColActive]}
          accessibilityLabel="admin-arguments-sort-created"
        >
          <Text style={[styles.sortColLabel, sortField === 'created_at' && styles.sortColLabelActive]}>
            Created{sortArrow(sortField === 'created_at', sortDirection)}
          </Text>
          <Text style={styles.sortColHint}>
            {sortField === 'created_at'
              ? SORT_HUMAN_LABEL[sortStatusKey]
              : 'Tap for newest created'}
          </Text>
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

      <ScrollView style={styles.list} accessibilityLabel="admin-arguments-list">
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
            <View key={r.id} style={styles.row} accessibilityLabel={`admin-argument-${r.id}`}>
              <View style={styles.rowHeader}>
                <View style={styles.timeBlock}>
                  <Text style={styles.timeLabel}>Created</Text>
                  <Text style={styles.timeText}>
                    {formatDateTime(r.createdAt)} · {formatRelativeShort(r.createdAt)}
                  </Text>
                </View>
                <View style={styles.timeBlock}>
                  <Text style={styles.timeLabel}>
                    Last Updated{hasUpdated ? '' : ': same as created'}
                  </Text>
                  <Text style={styles.timeText}>
                    {formatDateTime(updatedDisplay)} · {formatRelativeShort(updatedDisplay)}
                  </Text>
                </View>
              </View>
              <View style={styles.rowMeta}>
                <Text style={styles.metaTitle}>
                  {r.debateTitle ?? `Room ${shortenId(r.debateId)}`}
                </Text>
                <Text style={styles.metaAuthor}>
                  {r.authorDisplayName ?? shortenId(r.authorId)}
                </Text>
              </View>
              <View style={styles.badgeRow}>
                <Badge label={r.argumentType} variant="type" />
                <Badge label={r.side} variant="side" />
                <Badge label={formatCategoryLabel(category)} variant="category" />
                {qualifier && (
                  <Badge label={formatQualifierLabel(qualifier)} variant="qualifier" />
                )}
                {r.disagreementAxis && (
                  <Badge label={`axis: ${r.disagreementAxis}`} variant="axis" />
                )}
                {r.hasEvidence && <Badge label="evidence" variant="evidence" />}
                {flagCount > 0 && <Badge label={`flags: ${flagCount}`} variant="flag" />}
                {typeof r.topicSatisfactionScore === 'number' && (
                  <Badge label={`topic ${(r.topicSatisfactionScore * 100).toFixed(0)}%`} variant="topic" />
                )}
                <Badge label={`status: ${r.status}`} variant="status" />
              </View>
              <Text style={styles.body}>{shortenBody(r.body)}</Text>
              {qualifier && (
                <Text style={styles.nudge}>Nudge: {getQualifierUiNudge(qualifier)}</Text>
              )}
            </View>
          );
        })}
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
    evidence: { bg: '#e0e7ff', fg: '#3730a3' },
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
  sortHeader: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    gap: 6,
  },
  sortHeaderLabel: {
    alignSelf: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginRight: 4,
  },
  sortCol: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sortColActive: { backgroundColor: '#e0e7ff', borderColor: '#6366f1' },
  sortColLabel: { fontSize: 12, fontWeight: '700', color: '#374151' },
  sortColLabelActive: { color: '#4338ca' },
  sortColHint: { fontSize: 10, color: '#6b7280', marginTop: 2 },
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
  list: { flex: 1, paddingHorizontal: 8, paddingTop: 6 },
  row: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  rowHeader: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 4 },
  timeBlock: { minWidth: 160 },
  timeLabel: { fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', fontWeight: '700' },
  timeText: { fontSize: 11, color: '#1f2937', marginTop: 1 },
  rowMeta: { marginBottom: 4 },
  metaTitle: { fontSize: 13, fontWeight: '700', color: '#111827' },
  metaAuthor: { fontSize: 11, color: '#6b7280' },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginVertical: 6 },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '600' },
  body: { fontSize: 13, color: '#1f2937', marginTop: 2 },
  nudge: { fontSize: 11, color: '#4b5563', fontStyle: 'italic', marginTop: 6 },
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
