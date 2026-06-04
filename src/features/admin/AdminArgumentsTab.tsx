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
import {
  markArgumentInactive,
  markArgumentActive,
  bulkMarkArgumentInactive,
  bulkMarkArgumentActive,
} from './adminArgumentsInactiveApi';
import type { AdminArgumentRow } from './types';
import { formatDateTime, formatRelativeShort } from '../../lib/formatDateTime';
import {
  deriveMessageCategory,
  derivePrimaryQualifier,
  formatCategoryLabel,
  formatQualifierLabel,
  getQualifierUiNudge,
} from '../arguments/messageQualifiers';
import { ADMIN_BULK_INACTIVE_ID_CAP } from '../../lib/edgeFunctions';
import { SURFACE_TOKENS, CONTROL, STATUS, ARGUMENT } from '../../lib/designTokens';

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
//    ADMIN-ARGS-INACTIVE-001 — adds `select` (checkbox) and `inactive` cols.
const COL = {
  select: 48,
  status: 80,
  side: 64,
  type: 130,
  debate: 320,
  cat: 170,
  created: 170,
  updated: 170,
  inactive: 150,
  action: 160,
};
const TABLE_WIDTH =
  COL.select + COL.status + COL.side + COL.type + COL.debate + COL.cat +
  COL.created + COL.updated + COL.inactive + COL.action;

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

export interface AdminArgumentsTabProps {
  /**
   * Optional callback fired when an admin clicks a row's "Open timeline"
   * affordance. The host (App.tsx) is responsible for switching the active
   * outer tab to Arguments, setting the room view mode to 'timeline', and
   * pre-activating the argument via the entry-hint mechanism. When the
   * callback is omitted the rows render without a click affordance (back
   * compat for any test harness that mounts the tab in isolation).
   */
  onOpenArgumentTimeline?: (debateId: string, argumentId: string) => void;
}

export function AdminArgumentsTab({ onOpenArgumentTimeline }: AdminArgumentsTabProps = {}) {
  const [rows, setRows] = useState<AdminArgumentRow[]>([]);
  const [flagsByArgId, setFlagsByArgId] = useState<Record<string, number>>({});
  const [state, setState] = useState<LoadState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [sortField, setSortField] = useState<AdminArgumentsSortField>('updated_at');
  const [sortDirection, setSortDirection] = useState<AdminArgumentsSortDirection>('desc');
  // ADMIN-ARGS-INACTIVE-001 — Show-inactives toggle + selection state.
  // includeInactives drives the loader's SQL filter; selected drives bulk.
  const [includeInactives, setIncludeInactives] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  // Bulk dialog state. `null` when closed; { kind, ids } when open.
  const [bulkDialog, setBulkDialog] = useState<
    | { kind: 'inactive' | 'active'; ids: string[]; reason: string }
    | null
  >(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const fetchRows = useCallback(async () => {
    setState('loading');
    setError(null);
    try {
      const fresh = await loadAdminArguments({
        limit,
        sortField,
        sortDirection,
        includeInactives,
      });
      setRows(fresh);
      const counts = await countArgumentFlags(fresh.map((r) => r.id));
      setFlagsByArgId(counts);
      // Selection state should be pruned to rows still present after a reload.
      setSelectedIds((prev) => {
        const visible = new Set(fresh.map((r) => r.id));
        const next = new Set<string>();
        for (const id of prev) if (visible.has(id)) next.add(id);
        return next;
      });
      setState('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState('error');
    }
  }, [limit, sortField, sortDirection, includeInactives]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const openBulkDialog = useCallback((kind: 'inactive' | 'active') => {
    const ids = Array.from(selectedIds).slice(0, ADMIN_BULK_INACTIVE_ID_CAP);
    setBulkDialog({ kind, ids, reason: '' });
  }, [selectedIds]);

  const submitBulkDialog = useCallback(async () => {
    if (!bulkDialog) return;
    setBulkBusy(true);
    try {
      const reason = bulkDialog.reason.trim() ? bulkDialog.reason.trim() : undefined;
      if (bulkDialog.kind === 'inactive') {
        await bulkMarkArgumentInactive(bulkDialog.ids, reason);
      } else {
        await bulkMarkArgumentActive(bulkDialog.ids, reason);
      }
      setBulkDialog(null);
      setSelectedIds(new Set());
      await fetchRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBulkBusy(false);
    }
  }, [bulkDialog, fetchRows]);

  const handleRowMarkInactive = useCallback(async (argumentId: string) => {
    try {
      await markArgumentInactive(argumentId);
      await fetchRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [fetchRows]);

  const handleRowMarkActive = useCallback(async (argumentId: string) => {
    try {
      await markArgumentActive(argumentId);
      await fetchRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [fetchRows]);

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
          placeholderTextColor={SURFACE_TOKENS.placeholder}
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

      {/* ADMIN-ARGS-INACTIVE-001 — Show-inactives toggle + bulk toolbar. */}
      <View style={styles.subToolbar} accessibilityLabel="admin-arguments-sub-toolbar">
        <Pressable
          style={[styles.toggle, includeInactives && styles.toggleOn]}
          onPress={() => setIncludeInactives((v) => !v)}
          accessibilityRole="switch"
          accessibilityLabel="admin-arguments-show-inactives-toggle"
          accessibilityState={{ checked: includeInactives }}
          testID="admin-arguments-show-inactives-toggle"
        >
          <Text style={[styles.toggleText, includeInactives && styles.toggleTextOn]}>
            {includeInactives ? 'Hiding inactives off' : 'Hiding inactives on'} ({includeInactives ? 'showing all' : 'active only'})
          </Text>
        </Pressable>
        {selectedIds.size > 0 && (
          <View style={styles.bulkToolbar} testID="admin-arguments-bulk-toolbar">
            <Text style={styles.bulkSelectedText}>
              Selected: {selectedIds.size} of {rows.length}
            </Text>
            <Pressable
              style={styles.bulkBtn}
              onPress={() => openBulkDialog('inactive')}
              accessibilityRole="button"
              accessibilityLabel="admin-arguments-bulk-action-mark-inactive"
              testID="admin-arguments-bulk-action-mark-inactive"
            >
              <Text style={styles.bulkBtnText}>Mark inactive</Text>
            </Pressable>
            <Pressable
              style={styles.bulkBtn}
              onPress={() => openBulkDialog('active')}
              accessibilityRole="button"
              accessibilityLabel="admin-arguments-bulk-action-mark-active"
              testID="admin-arguments-bulk-action-mark-active"
            >
              <Text style={styles.bulkBtnText}>Mark active</Text>
            </Pressable>
          </View>
        )}
      </View>

      {bulkDialog && (
        <View
          style={styles.bulkDialog}
          accessibilityLabel="admin-arguments-bulk-confirm-dialog"
          testID="admin-arguments-bulk-confirm-dialog"
        >
          <Text style={styles.bulkDialogTitle}>
            {bulkDialog.kind === 'inactive'
              ? `Mark ${bulkDialog.ids.length} argument(s) inactive?`
              : `Mark ${bulkDialog.ids.length} argument(s) active?`}
          </Text>
          <Text style={styles.bulkDialogBody}>
            {bulkDialog.kind === 'inactive'
              ? 'These rows will be hidden from default views. Reversible.'
              : 'These rows will return to default views.'}
          </Text>
          <TextInput
            style={styles.bulkReasonInput}
            placeholder="Admin note (optional, admin-only)"
            placeholderTextColor={SURFACE_TOKENS.placeholder}
            value={bulkDialog.reason}
            onChangeText={(t) => setBulkDialog((d) => (d ? { ...d, reason: t } : d))}
            maxLength={500}
            multiline
            accessibilityLabel="admin-arguments-bulk-reason-input"
            testID="admin-arguments-bulk-reason-input"
          />
          <View style={styles.bulkDialogActions}>
            <Pressable
              style={[styles.bulkBtn, bulkBusy && styles.bulkBtnDisabled]}
              onPress={submitBulkDialog}
              disabled={bulkBusy}
              accessibilityRole="button"
              accessibilityLabel="admin-arguments-bulk-confirm"
              testID="admin-arguments-bulk-confirm"
            >
              <Text style={styles.bulkBtnText}>{bulkBusy ? 'Working…' : 'Confirm'}</Text>
            </Pressable>
            <Pressable
              style={styles.bulkBtnCancel}
              onPress={() => setBulkDialog(null)}
              accessibilityRole="button"
              accessibilityLabel="admin-arguments-bulk-cancel"
              testID="admin-arguments-bulk-cancel"
            >
              <Text style={styles.bulkBtnCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}

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
            <PlainHeader label="" width={COL.select} />
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
            <View
              style={[styles.headerCell, { width: COL.inactive }]}
              accessibilityLabel="admin-arguments-header-inactive"
              testID="admin-arguments-header-inactive"
            >
              <Text style={styles.headerCellText}>Inactive</Text>
            </View>
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
              const isSelected = selectedIds.has(r.id);
              const isInactive = r.inactiveAt !== null;
              return (
                <View
                  key={r.id}
                  style={styles.row}
                  accessibilityLabel={`admin-argument-${r.id}`}
                >
                  <View style={[styles.cell, { width: COL.select }]}>
                    <Pressable
                      style={[styles.checkbox, isSelected && styles.checkboxChecked]}
                      onPress={() => toggleSelect(r.id)}
                      accessibilityRole="checkbox"
                      accessibilityLabel={`Select argument ${r.id}`}
                      accessibilityState={{ checked: isSelected }}
                      testID={`admin-arguments-checkbox-${r.id}`}
                    >
                      <Text style={styles.checkboxMark}>{isSelected ? '✓' : ''}</Text>
                    </Pressable>
                  </View>
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
                    <Text
                      style={styles.roomIdMono}
                      numberOfLines={1}
                      selectable
                      accessibilityLabel={`room-id-${r.debateId}`}
                      testID={`admin-arguments-room-id-${r.id}`}
                    >
                      room: {r.debateId}
                    </Text>
                    <Text
                      style={styles.argIdMono}
                      numberOfLines={1}
                      selectable
                      accessibilityLabel={`argument-id-${r.id}`}
                      testID={`admin-arguments-argument-id-${r.id}`}
                    >
                      arg: {r.id}
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
                  {/* ADMIN-ARGS-INACTIVE-001 — Inactive column. Renders the
                       boolean chip + relative timestamp when set. The
                       inactive_reason field is NEVER rendered here (§10a). */}
                  <View
                    style={[styles.cell, { width: COL.inactive }]}
                    accessibilityLabel={`admin-arguments-cell-inactive-${r.id}`}
                    testID="admin-arguments-cell-inactive"
                  >
                    {isInactive ? (
                      <>
                        <Badge label="Inactive" variant="flag" />
                        <Text style={styles.timeRelative}>
                          {formatRelativeShort(r.inactiveAt!)}
                        </Text>
                      </>
                    ) : (
                      <Badge label="Active" variant="status" />
                    )}
                  </View>
                  <View style={[styles.cell, { width: COL.action }]}>
                    {onOpenArgumentTimeline ? (
                      <Pressable
                        style={styles.openTimelineBtn}
                        onPress={() => onOpenArgumentTimeline(r.debateId, r.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Open timeline for argument ${r.id} in room ${r.debateId}`}
                        testID={`admin-arguments-open-timeline-${r.id}`}
                      >
                        <Text style={styles.openTimelineBtnText}>Open timeline</Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.actionId}>{shortenId(r.id, 8)}</Text>
                    )}
                    {/* ADMIN-ARGS-INACTIVE-001 — per-row Mark inactive/active. */}
                    {isInactive ? (
                      <Pressable
                        style={styles.rowInactiveBtn}
                        onPress={() => handleRowMarkActive(r.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Mark argument ${r.id} active`}
                        testID={`admin-arguments-row-mark-active-${r.id}`}
                      >
                        <Text style={styles.rowInactiveBtnText}>Mark active</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={styles.rowInactiveBtn}
                        onPress={() => handleRowMarkInactive(r.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Mark argument ${r.id} inactive`}
                        testID={`admin-arguments-row-mark-inactive-${r.id}`}
                      >
                        <Text style={styles.rowInactiveBtnText}>Mark inactive</Text>
                      </Pressable>
                    )}
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

// BRAND-002 — dark-surface badge palette. Eight distinct hues reused from
// the STATUS / ARGUMENT token families (each already AA-checked). Badge
// meaning is also carried by the label text, so this is colour-blind safe.
const BADGE: Record<string, { bg: string; fg: string }> = {
  type: { bg: ARGUMENT.claim.bg, fg: ARGUMENT.claim.fg },
  side: { bg: STATUS.warning.bg, fg: STATUS.warning.fg },
  category: { bg: STATUS.success.bg, fg: STATUS.success.fg },
  qualifier: { bg: ARGUMENT.concede.bg, fg: ARGUMENT.concede.fg },
  axis: { bg: STATUS.danger.bg, fg: STATUS.danger.fg },
  flag: { bg: ARGUMENT.challenge.bg, fg: ARGUMENT.challenge.fg },
  topic: { bg: STATUS.info.bg, fg: STATUS.info.fg },
  status: { bg: STATUS.neutral.bg, fg: STATUS.neutral.fg },
};

function Badge({ label, variant }: { label: string; variant: string }) {
  const c = BADGE[variant] || BADGE.status;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SURFACE_TOKENS.base },
  toolbar: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: SURFACE_TOKENS.raised,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: SURFACE_TOKENS.border,
  },
  searchInput: {
    flex: 1,
    backgroundColor: SURFACE_TOKENS.inputBg,
    color: SURFACE_TOKENS.textPrimary,
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
    backgroundColor: SURFACE_TOKENS.raised,
    marginRight: 4,
  },
  chipActive: { backgroundColor: STATUS.neutral.bg },
  chipText: { fontSize: 11, color: SURFACE_TOKENS.textSecondary, fontWeight: '600' },
  chipTextActive: { color: SURFACE_TOKENS.textPrimary },
  refreshBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: CONTROL.primary.bg,
  },
  refreshBtnText: { color: CONTROL.primary.fg, fontSize: 11, fontWeight: '700' },
  sortStatus: {
    fontSize: 11,
    color: SURFACE_TOKENS.textSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: SURFACE_TOKENS.base,
    fontWeight: '600',
  },
  sortHelper: {
    fontSize: 11,
    color: SURFACE_TOKENS.textSecondary,
    paddingHorizontal: 10,
    paddingBottom: 2,
    backgroundColor: SURFACE_TOKENS.base,
  },
  sortHelperBold: { fontWeight: '700', color: SURFACE_TOKENS.textPrimary },
  sortLegend: {
    fontSize: 10,
    color: SURFACE_TOKENS.textMuted,
    paddingHorizontal: 10,
    paddingBottom: 6,
    backgroundColor: SURFACE_TOKENS.base,
    fontStyle: 'italic',
  },
  status: { padding: 12, color: SURFACE_TOKENS.textSecondary, fontSize: 13 },
  error: { padding: 12, color: STATUS.danger.fg, fontSize: 13, backgroundColor: STATUS.danger.bg },
  tableWrap: { flex: 1 },
  table: { flex: 1, minWidth: TABLE_WIDTH },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: SURFACE_TOKENS.raised,
    borderBottomWidth: 2,
    borderBottomColor: SURFACE_TOKENS.border,
  },
  headerCell: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: SURFACE_TOKENS.divider,
  },
  headerCellActive: { backgroundColor: STATUS.info.bg },
  headerCellText: { fontSize: 11, fontWeight: '700', color: SURFACE_TOKENS.textPrimary, textTransform: 'uppercase' },
  headerCellTextActive: { color: STATUS.info.fg },
  headerCellSubtext: { fontSize: 9, color: SURFACE_TOKENS.textSecondary, marginTop: 2 },
  bodyScroller: { flex: 1 },
  row: {
    flexDirection: 'row',
    backgroundColor: SURFACE_TOKENS.elevated,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE_TOKENS.divider,
  },
  cell: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRightWidth: 1,
    borderRightColor: SURFACE_TOKENS.divider,
    gap: 2,
  },
  cellDebate: { paddingRight: 8 },
  metaTitle: { fontSize: 12, fontWeight: '700', color: SURFACE_TOKENS.textPrimary },
  metaAuthor: { fontSize: 10, color: SURFACE_TOKENS.textSecondary },
  body: { fontSize: 11, color: SURFACE_TOKENS.textSecondary },
  subtle: { fontSize: 10, color: SURFACE_TOKENS.textSecondary, marginTop: 2 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginBottom: 2 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  timeAbsolute: { fontSize: 11, color: SURFACE_TOKENS.textPrimary, fontVariant: ['tabular-nums'] as ['tabular-nums'] },
  timeRelative: { fontSize: 10, color: SURFACE_TOKENS.textSecondary },
  fallbackHint: { fontSize: 9, color: SURFACE_TOKENS.textMuted, fontStyle: 'italic', marginTop: 2 },
  actionId: { fontSize: 10, color: SURFACE_TOKENS.textSecondary, fontFamily: 'monospace' as 'monospace' },
  roomIdMono: {
    fontSize: 10,
    color: SURFACE_TOKENS.textSecondary,
    fontFamily: 'monospace' as 'monospace',
    marginTop: 2,
  },
  argIdMono: {
    fontSize: 10,
    color: SURFACE_TOKENS.textMuted,
    fontFamily: 'monospace' as 'monospace',
    marginTop: 1,
  },
  openTimelineBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: CONTROL.primary.bg,
    alignSelf: 'flex-start',
  },
  openTimelineBtnText: {
    color: CONTROL.primary.fg,
    fontSize: 11,
    fontWeight: '700',
  },
  nudge: { fontSize: 10, color: SURFACE_TOKENS.textSecondary, fontStyle: 'italic', marginTop: 4 },
  // ADMIN-ARGS-INACTIVE-001 — sub-toolbar / bulk / checkbox / dialog styles.
  subToolbar: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: SURFACE_TOKENS.raised,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE_TOKENS.divider,
    alignItems: 'center',
    gap: 8,
  },
  toggle: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: SURFACE_TOKENS.raised,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.divider,
  },
  toggleOn: {
    backgroundColor: STATUS.info.bg,
    borderColor: STATUS.info.fg,
  },
  toggleText: { fontSize: 11, color: SURFACE_TOKENS.textSecondary, fontWeight: '600' },
  toggleTextOn: { color: STATUS.info.fg },
  bulkToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  bulkSelectedText: { fontSize: 11, color: SURFACE_TOKENS.textPrimary, fontWeight: '600' },
  bulkBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: CONTROL.primary.bg,
  },
  bulkBtnText: { color: CONTROL.primary.fg, fontSize: 11, fontWeight: '700' },
  bulkBtnDisabled: { opacity: 0.5 },
  bulkBtnCancel: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: SURFACE_TOKENS.raised,
  },
  bulkBtnCancelText: { color: SURFACE_TOKENS.textSecondary, fontSize: 11, fontWeight: '600' },
  bulkDialog: {
    padding: 12,
    backgroundColor: SURFACE_TOKENS.elevated,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE_TOKENS.border,
    gap: 6,
  },
  bulkDialogTitle: { fontSize: 13, fontWeight: '700', color: SURFACE_TOKENS.textPrimary },
  bulkDialogBody: { fontSize: 11, color: SURFACE_TOKENS.textSecondary },
  bulkReasonInput: {
    minHeight: 40,
    backgroundColor: SURFACE_TOKENS.inputBg,
    color: SURFACE_TOKENS.textPrimary,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    fontSize: 12,
  },
  bulkDialogActions: { flexDirection: 'row', gap: 8 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE_TOKENS.inputBg,
  },
  checkboxChecked: {
    backgroundColor: STATUS.info.bg,
    borderColor: STATUS.info.fg,
  },
  checkboxMark: { color: STATUS.info.fg, fontSize: 14, fontWeight: '700' },
  rowInactiveBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: SURFACE_TOKENS.raised,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  rowInactiveBtnText: { color: SURFACE_TOKENS.textSecondary, fontSize: 10, fontWeight: '600' },
  footnote: {
    padding: 8,
    fontSize: 10,
    color: SURFACE_TOKENS.textMuted,
    textAlign: 'center',
    backgroundColor: SURFACE_TOKENS.raised,
    borderTopWidth: 1,
    borderTopColor: SURFACE_TOKENS.border,
  },
});
