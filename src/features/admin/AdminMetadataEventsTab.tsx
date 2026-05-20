/**
 * META-1C — Admin metadata-event audit log tab.
 *
 * Lists manual-tag *events* (each tag applied, each tag removed) for a
 * selected debate, chronologically, with filter chips for tag code, actor
 * role, and event kind (applied vs removed). Mirrors `AdminArgumentsTab`'s
 * visual grammar: a toolbar, a horizontally scrollable column table,
 * plain-language status copy, and a fact-only footnote.
 *
 * Doctrine: the surface states neutral facts only. It renders no verdict
 * about any person, no count-weighting, no popularity ranking. The
 * actor-role column shows the actor's CURRENT role, honestly labeled — the
 * legend states it is not necessarily their role when the tag was applied.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import {
  loadMetadataAuditEvents,
  loadAuditDebateOptions,
  type AuditDebateOption,
  type MetadataAuditEvent,
} from './adminMetadataEventsApi';
import {
  ALL_AUDIT_ROLE_FILTERS,
  AUDIT_ROLE_FILTER_LABELS,
  filterMetadataAuditEvents,
  formatActorRole,
  type AuditEventKindFilter,
  type AuditRoleFilter,
} from './adminMetadataEventsView';
import { ALL_MANUAL_TAG_CODES, getManualTagPlainLabel } from '../metadata/moveMetadataLedger';
import { formatDateTime, formatRelativeShort } from '../../lib/formatDateTime';

type LoadState = 'idle' | 'loading' | 'error';

// ── Column widths. The table is wrapped in a horizontal ScrollView so the
//    columns never collapse on narrow viewports.
const COL = {
  event: 92,
  created: 170,
  debate: 220,
  move: 280,
  tag: 150,
  actor: 180,
};
const TABLE_WIDTH = COL.event + COL.created + COL.debate + COL.move + COL.tag + COL.actor;

function shortenId(id: string | null | undefined, prefix = 6): string {
  if (!id) return '—';
  return id.length <= prefix ? id : `${id.slice(0, prefix)}…`;
}

function sortArrow(dir: 'desc' | 'asc'): string {
  return dir === 'desc' ? ' ↓' : ' ↑';
}

export function AdminMetadataEventsTab() {
  const [debateOptions, setDebateOptions] = useState<AuditDebateOption[]>([]);
  const [selectedDebateId, setSelectedDebateId] = useState<string | null>(null);
  const [events, setEvents] = useState<MetadataAuditEvent[]>([]);
  const [state, setState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  const [tagCodeFilter, setTagCodeFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<AuditRoleFilter>('all');
  const [kindFilter, setKindFilter] = useState<AuditEventKindFilter>('all');

  // Load the debate selector options once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const opts = await loadAuditDebateOptions();
        if (!cancelled) setDebateOptions(opts);
      } catch {
        // The selector failing is non-fatal — the table's own error state
        // covers the load. Leave the selector empty.
        if (!cancelled) setDebateOptions([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const fetchEvents = useCallback(async () => {
    if (selectedDebateId == null) {
      setEvents([]);
      setState('idle');
      return;
    }
    setState('loading');
    setError(null);
    try {
      const fresh = await loadMetadataAuditEvents({
        debateId: selectedDebateId,
        sortDirection,
      });
      setEvents(fresh);
      setState('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('error');
    }
  }, [selectedDebateId, sortDirection]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const toggleSort = useCallback(() => {
    setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'));
  }, []);

  const filtered = useMemo(
    () => filterMetadataAuditEvents(events, {
      search,
      tagCode: tagCodeFilter,
      role: roleFilter,
      kind: kindFilter,
    }),
    [events, search, tagCodeFilter, roleFilter, kindFilter],
  );

  const sortStatus = `Created${sortArrow(sortDirection)} (${sortDirection === 'desc' ? 'Newest first' : 'Oldest first'})`;
  const directionHint = sortDirection === 'desc' ? 'sorted descending' : 'sorted ascending';

  return (
    <View style={styles.container}>
      {/* Toolbar — debate selector + search + refresh. */}
      <View
        style={styles.debateSelector}
        accessibilityLabel="admin-metadata-events-debate-selector"
        testID="admin-metadata-events-debate-selector"
      >
        <Text style={styles.selectorLabel}>Debate:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {debateOptions.length === 0 && (
            <Text style={styles.selectorEmpty}>No debates have tag activity yet.</Text>
          )}
          {debateOptions.map((d) => {
            const active = d.debateId === selectedDebateId;
            const label = d.title ?? `Room ${shortenId(d.debateId)}`;
            return (
              <Pressable
                key={d.debateId}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedDebateId(d.debateId)}
                accessibilityRole="button"
                accessibilityLabel={`Select debate ${label}`}
                accessibilityState={{ selected: active }}
                hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.toolbar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Filter by move, actor, debate, or tag…"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          accessibilityLabel="admin-metadata-events-search"
        />
        <Pressable
          style={styles.refreshBtn}
          onPress={fetchEvents}
          accessibilityRole="button"
          accessibilityLabel="admin-metadata-events-refresh"
          accessibilityState={{ disabled: selectedDebateId == null }}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
        >
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </Pressable>
      </View>

      {/* Filter chip rows — tag code / actor role / event kind. */}
      <ScrollView
        horizontal
        style={styles.filterRow}
        showsHorizontalScrollIndicator={false}
        accessibilityLabel="admin-metadata-events-filter-tag"
        testID="admin-metadata-events-filter-tag"
      >
        <FilterChip
          label="All tags"
          selected={tagCodeFilter === 'all'}
          onPress={() => setTagCodeFilter('all')}
          group="tag"
        />
        {ALL_MANUAL_TAG_CODES.map((code) => (
          <FilterChip
            key={code}
            label={getManualTagPlainLabel(code)}
            selected={tagCodeFilter === code}
            onPress={() => setTagCodeFilter(code)}
            group="tag"
          />
        ))}
      </ScrollView>

      <ScrollView
        horizontal
        style={styles.filterRow}
        showsHorizontalScrollIndicator={false}
        accessibilityLabel="admin-metadata-events-filter-role"
        testID="admin-metadata-events-filter-role"
      >
        {ALL_AUDIT_ROLE_FILTERS.map((rf) => (
          <FilterChip
            key={rf}
            label={AUDIT_ROLE_FILTER_LABELS[rf]}
            selected={roleFilter === rf}
            onPress={() => setRoleFilter(rf)}
            group="role"
          />
        ))}
      </ScrollView>

      <ScrollView
        horizontal
        style={styles.filterRow}
        showsHorizontalScrollIndicator={false}
        accessibilityLabel="admin-metadata-events-filter-kind"
        testID="admin-metadata-events-filter-kind"
      >
        {(['all', 'applied', 'removed'] as AuditEventKindFilter[]).map((kf) => (
          <FilterChip
            key={kf}
            label={kf === 'all' ? 'All events' : kf === 'applied' ? 'Applied' : 'Removed'}
            selected={kindFilter === kf}
            onPress={() => setKindFilter(kf)}
            group="kind"
          />
        ))}
      </ScrollView>

      <Text style={styles.sortStatus} accessibilityLabel="admin-metadata-events-sort-status">
        Sorted by: {sortStatus}
      </Text>
      <Text style={styles.legend} accessibilityLabel="admin-metadata-events-role-legend">
        Role and side shown are the actor&apos;s current values, not necessarily their role when the tag was applied.
      </Text>

      {selectedDebateId == null && (
        <Text style={styles.status} accessibilityLabel="admin-metadata-events-no-debate">
          Pick a debate above to load its tag history.
        </Text>
      )}
      {selectedDebateId != null && state === 'loading' && (
        <Text style={styles.status} accessibilityLabel="admin-metadata-events-loading">
          Loading tag history…
        </Text>
      )}
      {selectedDebateId != null && state === 'error' && (
        <Text style={styles.error} accessibilityLabel="admin-metadata-events-error">
          Could not load tag history. Check admin access and try again. (detail: {error ?? 'unknown error'})
        </Text>
      )}
      {selectedDebateId != null && state === 'idle' && events.length === 0 && (
        <Text style={styles.status} accessibilityLabel="admin-metadata-events-empty">
          No tag activity in this debate yet. When a participant applies or removes a tag here it will appear, newest first.
        </Text>
      )}
      {selectedDebateId != null && state === 'idle' && events.length > 0 && filtered.length === 0 && (
        <Text style={styles.status} accessibilityLabel="admin-metadata-events-empty-filtered">
          No tag events match these filters. Try clearing the search or chips.
        </Text>
      )}

      {/* Horizontally scrollable table. */}
      <ScrollView
        horizontal
        style={styles.tableWrap}
        contentContainerStyle={{ minWidth: TABLE_WIDTH }}
        accessibilityLabel="admin-metadata-events-table-scroller"
      >
        <View
          style={styles.table}
          accessibilityLabel="admin-metadata-events-table"
          testID="admin-metadata-events-table"
        >
          <View style={styles.headerRow} accessibilityLabel="admin-metadata-events-header-row">
            <PlainHeader label="Event" width={COL.event} />
            <Pressable
              style={[styles.headerCell, { width: COL.created }, styles.headerCellActive]}
              onPress={toggleSort}
              accessibilityRole="button"
              accessibilityLabel="Sort by Created"
              accessibilityState={{ selected: true }}
              accessibilityHint={directionHint}
              testID="admin-metadata-events-header-created"
            >
              <Text style={[styles.headerCellText, styles.headerCellTextActive]}>
                Created{sortArrow(sortDirection)}
              </Text>
              <Text style={styles.headerCellSubtext}>
                {sortDirection === 'desc' ? '↓ newest first' : '↑ oldest first'}
              </Text>
            </Pressable>
            <PlainHeader label="Debate" width={COL.debate} />
            <PlainHeader label="Move" width={COL.move} />
            <PlainHeader label="Tag" width={COL.tag} />
            <PlainHeader label="Actor — current role" width={COL.actor} />
          </View>

          <ScrollView style={styles.bodyScroller} accessibilityLabel="admin-metadata-events-list">
            {filtered.map((e) => (
              <View
                key={e.eventId}
                style={styles.row}
                accessibilityLabel={`admin-metadata-event-${e.eventId}`}
              >
                <View style={[styles.cell, { width: COL.event }]}>
                  <EventBadge kind={e.kind} />
                </View>
                <View
                  style={[styles.cell, { width: COL.created }]}
                  testID="admin-metadata-events-cell-created"
                  accessibilityLabel={`admin-metadata-events-cell-created-${e.eventId}`}
                >
                  <Text style={styles.timeAbsolute}>{formatDateTime(e.occurredAt)}</Text>
                  <Text style={styles.timeRelative}>{formatRelativeShort(e.occurredAt)}</Text>
                </View>
                <View style={[styles.cell, { width: COL.debate }]}>
                  <Text style={styles.metaTitle} numberOfLines={2}>
                    {e.debateTitle ?? `Room ${shortenId(e.debateId)}`}
                  </Text>
                </View>
                <View style={[styles.cell, { width: COL.move }]}>
                  {e.argumentSide && (
                    <View style={[styles.badge, styles.sideBadge]}>
                      <Text style={styles.sideBadgeText}>{e.argumentSide}</Text>
                    </View>
                  )}
                  <Text style={styles.body} numberOfLines={3}>
                    {e.argumentExcerpt ?? '—'}
                  </Text>
                  {e.argumentDeleted && (
                    <Text style={styles.deletedHint}>deleted move</Text>
                  )}
                </View>
                <View style={[styles.cell, { width: COL.tag }]}>
                  <View style={[styles.badge, styles.tagBadge]}>
                    <Text style={styles.tagBadgeText}>{e.tagPlainLabel}</Text>
                  </View>
                </View>
                <View style={[styles.cell, { width: COL.actor }]}>
                  <Text style={styles.actorName} numberOfLines={1}>
                    {e.actorDisplayName ?? shortenId(e.actorId)}
                  </Text>
                  <Text style={styles.actorRole} numberOfLines={1}>
                    {formatActorRole(e.actorRole)}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      <Text style={styles.footnote}>
        Showing {filtered.length} of {events.length}. This is an audit view of tag activity;
        the app records who applied or removed a tag and when — it makes no judgment about any person.
      </Text>
    </View>
  );
}

function FilterChip({
  label, selected, onPress, group,
}: { label: string; selected: boolean; onPress: () => void; group: string }) {
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Filter ${group}: ${label}`}
      accessibilityState={{ selected }}
      hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The Applied / Removed badge. Distinguishes by TEXT + SHAPE (solid vs
 * dashed border), not color alone — grayscale-legible per accessibility
 * doctrine.
 */
function EventBadge({ kind }: { kind: 'applied' | 'removed' }) {
  const isApplied = kind === 'applied';
  return (
    <View
      style={[
        styles.eventBadge,
        isApplied ? styles.eventBadgeApplied : styles.eventBadgeRemoved,
      ]}
    >
      <Text
        style={[
          styles.eventBadgeText,
          isApplied ? styles.eventBadgeTextApplied : styles.eventBadgeTextRemoved,
        ]}
      >
        {isApplied ? 'Applied' : 'Removed'}
      </Text>
    </View>
  );
}

function PlainHeader({ label, width }: { label: string; width: number }) {
  return (
    <View style={[styles.headerCell, { width }]}>
      <Text style={styles.headerCellText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  debateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  selectorLabel: { fontSize: 11, fontWeight: '700', color: '#374151', marginRight: 6 },
  selectorEmpty: { fontSize: 11, color: '#9ca3af', fontStyle: 'italic', paddingVertical: 6 },
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
  refreshBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#1d4ed8',
  },
  refreshBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  filterRow: {
    backgroundColor: '#fff',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    flexGrow: 0,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    marginRight: 4,
    maxWidth: 200,
  },
  chipActive: { backgroundColor: '#1f2937' },
  chipText: { fontSize: 11, color: '#374151', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  sortStatus: {
    fontSize: 11,
    color: '#374151',
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#f9fafb',
    fontWeight: '600',
  },
  legend: {
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
  metaTitle: { fontSize: 12, fontWeight: '700', color: '#111827' },
  body: { fontSize: 11, color: '#374151' },
  deletedHint: { fontSize: 9, color: '#9ca3af', fontStyle: 'italic', marginTop: 2 },
  timeAbsolute: { fontSize: 11, color: '#111827', fontVariant: ['tabular-nums'] as ['tabular-nums'] },
  timeRelative: { fontSize: 10, color: '#6b7280' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 2 },
  sideBadge: { backgroundColor: '#fef3c7' },
  sideBadgeText: { fontSize: 10, fontWeight: '600', color: '#92400e' },
  tagBadge: { backgroundColor: '#ecfdf5' },
  tagBadgeText: { fontSize: 10, fontWeight: '600', color: '#065f46' },
  // Applied = solid border; Removed = dashed border. Shape + text carry the
  // meaning so the badge is legible in grayscale.
  eventBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1.5,
    alignSelf: 'flex-start',
  },
  eventBadgeApplied: {
    backgroundColor: '#e0f2fe',
    borderColor: '#075985',
    borderStyle: 'solid',
  },
  eventBadgeRemoved: {
    backgroundColor: '#f1f5f9',
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  eventBadgeText: { fontSize: 10, fontWeight: '700' },
  eventBadgeTextApplied: { color: '#075985' },
  eventBadgeTextRemoved: { color: '#334155' },
  actorName: { fontSize: 11, fontWeight: '600', color: '#111827' },
  actorRole: { fontSize: 10, color: '#6b7280' },
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
