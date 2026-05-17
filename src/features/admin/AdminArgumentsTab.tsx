import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { loadAdminArguments, countArgumentFlags } from './adminArgumentsApi';
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

export function AdminArgumentsTab() {
  const [rows, setRows] = useState<AdminArgumentRow[]>([]);
  const [flagsByArgId, setFlagsByArgId] = useState<Record<string, number>>({});
  const [state, setState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);

  const fetchRows = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const fresh = await loadAdminArguments({ limit });
      setRows(fresh);
      const counts = await countArgumentFlags(fresh.map((r) => r.id));
      setFlagsByArgId(counts);
      setState('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('error');
    }
  }, [limit]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

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

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Filter arguments by body, room, author, type, or axis…"
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

      {state === 'loading' && <Text style={styles.status}>Loading…</Text>}
      {state === 'error' && <Text style={styles.error}>Error: {error}</Text>}
      {state === 'idle' && filtered.length === 0 && (
        <Text style={styles.status}>No arguments to display.</Text>
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
          return (
            <View key={r.id} style={styles.row} accessibilityLabel={`admin-argument-${r.id}`}>
              <View style={styles.rowHeader}>
                <Text style={styles.timeText}>
                  Created {formatDateTime(r.createdAt)}
                </Text>
                <Text style={styles.timeText}>
                  Updated {formatDateTime(r.updatedAt)} ({formatRelativeShort(r.updatedAt)})
                </Text>
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
  status: { padding: 12, color: '#6b7280', fontSize: 13 },
  error: { padding: 12, color: '#b91c1c', fontSize: 13 },
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
  timeText: { fontSize: 11, color: '#6b7280' },
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
