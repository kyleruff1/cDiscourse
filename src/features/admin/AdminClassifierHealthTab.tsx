/**
 * OPS-MCP-OBSERVABILITY-002 — Admin Classifier Health tab.
 *
 * A READ-ONLY operational diagnostic panel over the classifier run table. It
 * renders COUNTS ONLY (status / state / family / failure_reason / run_mode),
 * a provider-error cluster row, an H/I/J leakage tripwire row, and a
 * metadata-only CSV export.
 *
 * Acceptance-gate invariant (binding): this panel is a diagnostic READ surface.
 * It has NO re-trigger / arm / disarm / routing / family-flip control — the
 * only Pressables are the filter form, Refresh, and CSV download. It cannot
 * block, reject, route, or delay any user post.
 *
 * Doctrine:
 *   - cdiscourse-doctrine §1/§10a — counts are structural; no verdict on a
 *     person or claim.
 *   - §9 — reason codes render through the panel plain-language map; unknown
 *     codes are suppressed. NULL columns render as "—", never "null".
 *   - §4-C — the H/I/J frozen-set badge is informational; nothing here flips it.
 *   - Pure RN primitives — no new dependency.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import {
  loadClassifierHealth,
  exportClassifierHealthCsv,
  classifierHealthErrorMessage,
  type ClassifierHealthFilterInput,
} from './adminClassifierHealthApi';
import { classifierHealthPlainLanguage } from '../adminClassifierHealth/classifierHealthPlainLanguage';
import type {
  ClassifierHealthVerdict,
  ClassifierHealthCountBucket,
} from '../adminClassifierHealth/types';
import { SURFACE_TOKENS, CONTROL, STATUS } from '../../lib/designTokens';

type LoadState = 'loading' | 'ready' | 'error';

/** Render a NULL/empty raw key as a placeholder — never "null"/"undefined". */
function displayKey(rawKey: string | null): string {
  if (rawKey == null || rawKey.length === 0) return '—';
  return rawKey;
}

/** The operator-facing label for a bucket: plain language if known, else the raw code. */
function bucketLabel(bucket: ClassifierHealthCountBucket): string {
  if (bucket.rawKey == null) return '—';
  const plain = bucket.plainLanguage ?? classifierHealthPlainLanguage(bucket.rawKey);
  return plain ?? bucket.rawKey;
}

export function AdminClassifierHealthTab() {
  const [verdict, setVerdict] = useState<ClassifierHealthVerdict | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);

  // Filter form state (read-only inputs — none of these is an action).
  const [statusFilter, setStatusFilter] = useState('');
  const [runModeFilter, setRunModeFilter] = useState('');
  const [familyFilter, setFamilyFilter] = useState('');
  const [failureReasonFilter, setFailureReasonFilter] = useState('');
  const [runTagFilter, setRunTagFilter] = useState('');

  const buildFilter = useCallback((): ClassifierHealthFilterInput => {
    return {
      status: statusFilter,
      run_mode: runModeFilter,
      family: familyFilter,
      failure_reason: failureReasonFilter,
      run_tag: runTagFilter,
    };
  }, [statusFilter, runModeFilter, familyFilter, failureReasonFilter, runTagFilter]);

  const fetchHealth = useCallback(async () => {
    setState('loading');
    setError(null);
    setExportNote(null);
    const r = await loadClassifierHealth(buildFilter());
    if (r.ok) {
      setVerdict(r.data);
      setState('ready');
    } else {
      setError(classifierHealthErrorMessage(r.error, r.status));
      setState('error');
    }
  }, [buildFilter]);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  const onExportCsv = useCallback(async () => {
    setExporting(true);
    setExportNote(null);
    const r = await exportClassifierHealthCsv(buildFilter());
    if (r.ok) {
      // The CSV is a metadata-only string. On web a download is wired by the
      // host; here we surface the row count so the admin knows the export ran.
      const rowCount = r.csv.split('\n').length - 1;
      setExportNote(`Exported ${rowCount} metadata rows.`);
    } else {
      setError(classifierHealthErrorMessage(r.error, r.status));
    }
    setExporting(false);
  }, [buildFilter]);

  // ── Loading / error ─────────────────────────────────────────
  if (state === 'loading') {
    return (
      <View style={styles.centered} accessibilityLabel="admin-classifier-health-loading">
        <ActivityIndicator color={SURFACE_TOKENS.textSecondary} />
        <Text style={styles.status}>Loading classifier health…</Text>
      </View>
    );
  }
  if (state === 'error' || !verdict) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error} accessibilityLabel="admin-classifier-health-error">
          Could not load classifier health. Check admin access and try again.
          {error ? ` (detail: ${error})` : ''}
        </Text>
        <Pressable
          style={styles.refreshBtn}
          onPress={fetchHealth}
          accessibilityRole="button"
          accessibilityLabel="admin-classifier-health-retry"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.refreshBtnText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const tripwire = verdict.frozenFamilyTripwire;
  const tripwireFiring = tripwire.count > 0;

  // ── Ready ───────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      accessibilityLabel="admin-classifier-health-tab"
      testID="admin-classifier-health-tab"
    >
      {/* Filter form — read-only inputs; NONE is an action. */}
      <View style={styles.card} testID="admin-classifier-health-filters">
        <Text style={styles.cardTitle}>Filters</Text>
        <Text style={styles.cardHelp}>
          Filters narrow the counts only. This panel makes no change — it does
          not re-run, route, or block anything. Leave a field blank to include all.
        </Text>
        <FilterField label="Status" value={statusFilter} onChange={setStatusFilter} testID="filter-status" placeholder="success / failed / fallback" />
        <FilterField label="Run mode" value={runModeFilter} onChange={setRunModeFilter} testID="filter-run-mode" placeholder="production / admin_validation" />
        <FilterField label="Family" value={familyFilter} onChange={setFamilyFilter} testID="filter-family" placeholder="parent_relation …" />
        <FilterField label="Failure reason" value={failureReasonFilter} onChange={setFailureReasonFilter} testID="filter-failure-reason" placeholder="mcp_api_error …" />
        <FilterField label="Run tag" value={runTagFilter} onChange={setRunTagFilter} testID="filter-run-tag" placeholder="xai-adv …" />
        <View style={styles.filterActions}>
          <Pressable
            style={styles.refreshBtn}
            onPress={fetchHealth}
            accessibilityRole="button"
            accessibilityLabel="admin-classifier-health-apply"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.refreshBtnText}>Apply filters</Text>
          </Pressable>
          <Pressable
            style={styles.exportBtn}
            onPress={onExportCsv}
            disabled={exporting}
            accessibilityRole="button"
            accessibilityLabel="admin-classifier-health-export-csv"
            accessibilityState={{ disabled: exporting }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.exportBtnText}>{exporting ? 'Exporting…' : 'Download CSV'}</Text>
          </Pressable>
        </View>
        {exportNote && (
          <Text style={styles.successNote} accessibilityLabel="admin-classifier-health-export-note">
            {exportNote}
          </Text>
        )}
      </View>

      {/* Summary — total + status. */}
      <View style={styles.card} testID="admin-classifier-health-summary">
        <Text style={styles.cardTitle}>Summary</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Total runs in scope</Text>
          <Text style={styles.statusValue} accessibilityLabel="admin-classifier-health-total">
            {verdict.totalRows}
          </Text>
        </View>
        <CountList title="By status" buckets={verdict.byStatus} testID="group-status" />
        <CountList title="By run mode" buckets={verdict.byRunMode} testID="group-run-mode" />
      </View>

      {/* Provider-error cluster row. */}
      <View style={styles.card} testID="admin-classifier-health-provider-cluster">
        <Text style={styles.cardTitle}>Provider-error cluster</Text>
        <Text style={styles.cardHelp}>
          Ambiguous provider buckets grouped together so the dominant transport
          failure is visible at a glance.
        </Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Total in cluster</Text>
          <Text style={styles.statusValue} accessibilityLabel="admin-classifier-health-provider-cluster-total">
            {verdict.providerErrorCluster.count}
          </Text>
        </View>
        <CountList title="By reason" buckets={verdict.providerErrorCluster.byReason} testID="group-provider-cluster" emptyHint="No provider-error rows in scope." />
      </View>

      {/* H/I/J leakage tripwire row — informational; never a control. */}
      <View
        style={[styles.card, tripwireFiring && styles.cardAlert]}
        testID="admin-classifier-health-tripwire"
      >
        <View style={styles.tripwireHeader}>
          <Text style={styles.cardTitle}>H/I/J leakage tripwire</Text>
          <View style={styles.frozenBadge} accessibilityLabel="admin-classifier-health-frozen-badge">
            <Text style={styles.frozenBadgeText}>Frozen set</Text>
          </View>
        </View>
        <Text style={styles.cardHelp}>
          This count should always be 0. It watches for a held-out family
          (claim clarity / thread topology / sensitive composer) appearing on a
          production success row. It is an alert, never a control.
        </Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Leakage count</Text>
          <Text
            style={[styles.statusValue, tripwireFiring ? styles.alertValue : styles.okValue]}
            accessibilityLabel="admin-classifier-health-tripwire-count"
          >
            {tripwire.count}
          </Text>
        </View>
        {tripwire.byFamily.map((fam) => (
          <View key={fam.family} style={styles.statusRow}>
            <Text style={styles.statusLabel}>{fam.family}</Text>
            <Text style={styles.statusValue}>{fam.count}</Text>
          </View>
        ))}
        {tripwireFiring && (
          <Text style={styles.alertNote} accessibilityLabel="admin-classifier-health-tripwire-alert">
            Tripwire is firing. Surface this to the operator — a held-out family
            reached a production success row.
          </Text>
        )}
      </View>

      {/* Failure detail — family / reason / sub-reason / dead-letter / detail. */}
      <View style={styles.card} testID="admin-classifier-health-failure-detail">
        <Text style={styles.cardTitle}>Failure breakdown</Text>
        <CountList title="By family" buckets={verdict.byFamily} testID="group-family" />
        <CountList title="By failure reason" buckets={verdict.byFailureReason} testID="group-failure-reason" />
        <CountList title="By sub-reason" buckets={verdict.byFailureSubReason} testID="group-failure-sub-reason" emptyHint="No sub-reasons recorded (common until the fill card lands)." />
        <CountList title="By dead-letter reason" buckets={verdict.byDeadLetterReason} testID="group-dead-letter" emptyHint="No dead-letter rows in scope." />
        <CountList title="By failure detail reason" buckets={verdict.byFailureDetailReason} testID="group-failure-detail-reason" emptyHint="failure_detail is mostly empty until the direct-dispatch fill lands." />
      </View>

      {/* Unclean-span key drops — advisory; counts only. */}
      <View style={styles.card} testID="admin-classifier-health-unclean-span-drops">
        <Text style={styles.cardTitle}>Unclean-span key drops</Text>
        <Text style={styles.cardHelp}>
          Counts a key the server set aside on a successful run because its
          evidence span tripped the doctrine scan. The sibling keys still
          posted. A sustained rate on one key is a prompt-iteration signal —
          advisory only, never a control, and it never blocks a post.
        </Text>
        <CountList
          title="By dropped key"
          buckets={verdict.byUncleanSpanKeyDrop}
          testID="group-unclean-span-key-drop"
          emptyHint="No keys set aside in scope."
        />
      </View>

      <Text style={styles.footnote}>
        Read-only diagnostic. Counts describe transport and lifecycle health
        only — never who is right, never a score, never a block. The classifier
        path never gates a user post; the deterministic rules engine is the
        sole acceptance gate.
      </Text>
    </ScrollView>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function FilterField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testID: string;
  placeholder?: string;
}) {
  return (
    <View style={styles.filterRow}>
      <Text style={styles.filterLabel}>{props.label}</Text>
      <TextInput
        style={styles.filterInput}
        value={props.value}
        onChangeText={props.onChange}
        placeholder={props.placeholder}
        placeholderTextColor={SURFACE_TOKENS.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={`admin-classifier-health-${props.testID}`}
        testID={`admin-classifier-health-${props.testID}`}
      />
    </View>
  );
}

function CountList(props: {
  title: string;
  buckets: ClassifierHealthCountBucket[];
  testID: string;
  emptyHint?: string;
}) {
  return (
    <View style={styles.countGroup} testID={`admin-classifier-health-${props.testID}`}>
      <Text style={styles.countGroupTitle}>{props.title}</Text>
      {props.buckets.length === 0 ? (
        <Text style={styles.cardHelp}>{props.emptyHint ?? 'No rows in scope.'}</Text>
      ) : (
        props.buckets.map((bucket, i) => (
          <View key={`${bucket.rawKey ?? 'na'}-${i}`} style={styles.statusRow}>
            <View style={styles.countLabelCol}>
              <Text style={styles.statusLabel}>{bucketLabel(bucket)}</Text>
              {bucket.plainLanguage != null && bucket.rawKey != null && (
                <Text style={styles.rawCode}>{displayKey(bucket.rawKey)}</Text>
              )}
            </View>
            <Text style={styles.statusValue}>{bucket.count}</Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SURFACE_TOKENS.base },
  content: { padding: 12, gap: 12 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
    backgroundColor: SURFACE_TOKENS.base,
  },
  status: { color: SURFACE_TOKENS.textSecondary, fontSize: 13 },
  error: {
    color: STATUS.danger.fg,
    backgroundColor: STATUS.danger.bg,
    fontSize: 13,
    padding: 10,
    borderRadius: 6,
  },
  card: {
    backgroundColor: SURFACE_TOKENS.elevated,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    padding: 12,
    gap: 6,
  },
  cardAlert: { borderColor: STATUS.danger.fg, borderWidth: 2 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: SURFACE_TOKENS.textPrimary },
  cardHelp: { fontSize: 11, color: SURFACE_TOKENS.textSecondary, marginBottom: 4 },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 3,
  },
  statusLabel: { fontSize: 12, color: SURFACE_TOKENS.textSecondary, flexShrink: 1 },
  statusValue: {
    fontSize: 12,
    fontWeight: '600',
    color: SURFACE_TOKENS.textPrimary,
    textAlign: 'right',
    marginLeft: 8,
  },
  okValue: { color: STATUS.success.fg },
  alertValue: { color: STATUS.danger.fg },
  alertNote: {
    fontSize: 11,
    color: STATUS.danger.fg,
    backgroundColor: STATUS.danger.bg,
    padding: 8,
    borderRadius: 6,
    marginTop: 6,
  },
  countGroup: { marginTop: 6, gap: 2 },
  countGroupTitle: { fontSize: 12, fontWeight: '600', color: SURFACE_TOKENS.textPrimary, marginTop: 4 },
  countLabelCol: { flex: 1, gap: 1 },
  rawCode: { fontSize: 9, color: SURFACE_TOKENS.textMuted },
  filterRow: { gap: 4, marginTop: 4 },
  filterLabel: { fontSize: 11, color: SURFACE_TOKENS.textSecondary },
  filterInput: {
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: SURFACE_TOKENS.textPrimary,
    backgroundColor: SURFACE_TOKENS.base,
    minHeight: 44,
  },
  filterActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  refreshBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: CONTROL.primary.bg,
    minHeight: 44,
    justifyContent: 'center',
  },
  refreshBtnText: { color: CONTROL.primary.fg, fontSize: 12, fontWeight: '700' },
  exportBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: CONTROL.primary.bg,
    backgroundColor: SURFACE_TOKENS.elevated,
    minHeight: 44,
    justifyContent: 'center',
  },
  exportBtnText: { color: CONTROL.primary.bg, fontSize: 12, fontWeight: '700' },
  tripwireHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  frozenBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    backgroundColor: SURFACE_TOKENS.raised,
  },
  frozenBadgeText: { fontSize: 9, fontWeight: '700', color: SURFACE_TOKENS.textSecondary },
  successNote: {
    fontSize: 12,
    color: STATUS.success.fg,
    backgroundColor: STATUS.success.bg,
    padding: 10,
    borderRadius: 6,
    marginTop: 6,
  },
  footnote: {
    fontSize: 10,
    color: SURFACE_TOKENS.textMuted,
    textAlign: 'center',
    paddingVertical: 8,
  },
});
