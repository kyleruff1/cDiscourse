import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { EvaluationResult } from '../../domain/constitution/types';

interface Props {
  result: EvaluationResult;
  source: 'supabase' | 'local_fallback';
}

function pct(score: number) {
  return `${(score * 100).toFixed(0)}%`;
}

export function ComposerValidationPanel({ result, source }: Props) {
  const { allowPost, blockingErrors, warnings, topicSatisfactionCheck } = result;
  const tsc = topicSatisfactionCheck;

  // Stage 6.2 UX rescue: short compact statuses + advisory framing. Matched
  // / missing term lists are hidden behind a dev-only disclosure.
  let status: 'ready' | 'advisory' | 'structural' = 'ready';
  if (blockingErrors.length > 0) status = 'structural';
  else if (warnings.length > 0) status = 'advisory';

  return (
    <View style={styles.container} testID="composer-validation-panel">
      <View style={styles.disclaimerRow}>
        <View style={[styles.statusChip,
          status === 'ready' && styles.statusReady,
          status === 'advisory' && styles.statusAdvisory,
          status === 'structural' && styles.statusStructural,
        ]}>
          <Text style={styles.statusChipText}>
            {status === 'ready' ? 'Ready' : status === 'advisory' ? 'Advisory' : 'Structural issue'}
          </Text>
        </View>
        <Text style={styles.disclaimer}>
          Advisory checks. You can post unless there is a structural issue.
        </Text>
        {__DEV__ ? (
          <Text style={[styles.sourceChip, source === 'supabase' ? styles.sourceSupabase : styles.sourceFallback]}>
            {source === 'supabase' ? 'Live rules' : 'Local v1'}
          </Text>
        ) : null}
      </View>

      {blockingErrors.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitleError}>Structural issue — please resolve</Text>
          {blockingErrors.map((e, i) => (
            <View key={i} style={styles.errorRow}>
              <Text style={styles.bullet}>✕</Text>
              <Text style={styles.errorText}>{e.message}</Text>
            </View>
          ))}
        </View>
      )}

      {warnings.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitleWarn}>Advisory</Text>
          {warnings.slice(0, 3).map((w, i) => (
            <View key={i} style={styles.warningRow}>
              <Text style={styles.bulletWarn}>·</Text>
              <Text style={styles.warningText}>{w.message}</Text>
            </View>
          ))}
        </View>
      )}

      {__DEV__ && tsc ? (
        <View style={styles.topicSection}>
          <Text style={styles.topicHeader}>Topic coverage (dev)</Text>
          <View style={styles.topicScoreRow}>
            <Text style={styles.topicLabel}>Score</Text>
            <Text style={styles.topicValue}>{pct(tsc.score)} ({tsc.status})</Text>
          </View>
          {tsc.matchedTerms.length > 0 && (
            <View style={styles.termRow}>
              <Text style={styles.termLabelOk}>Matched:</Text>
              <Text style={styles.termListOk}>{tsc.matchedTerms.slice(0, 8).join(', ')}</Text>
            </View>
          )}
          {tsc.missingTerms.length > 0 && (
            <View style={styles.termRow}>
              <Text style={styles.termLabelMiss}>Missing:</Text>
              <Text style={styles.termListMiss}>{tsc.missingTerms.slice(0, 8).join(', ')}</Text>
            </View>
          )}
        </View>
      ) : null}

      {allowPost && blockingErrors.length === 0 && warnings.length === 0 && (
        <View style={styles.okRow}>
          <Text style={styles.okText}>Ready to post.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  disclaimerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 8 },
  disclaimer: { flex: 1, fontSize: 11, color: '#6b7280', fontStyle: 'italic' },
  sourceChip: { fontSize: 10, fontWeight: '700', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  sourceSupabase: { backgroundColor: '#dcfce7', color: '#166534' },
  sourceFallback: { backgroundColor: '#fef9c3', color: '#854d0e' },
  section: { marginBottom: 8 },
  sectionTitleError: { fontSize: 12, fontWeight: '700', color: '#b91c1c', marginBottom: 4 },
  sectionTitleWarn: { fontSize: 12, fontWeight: '700', color: '#b45309', marginBottom: 4 },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4 },
  warningRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4 },
  bullet: { fontSize: 12, fontWeight: '700', color: '#b91c1c', width: 14 },
  bulletWarn: { fontSize: 12, fontWeight: '700', color: '#b45309', width: 14 },
  errorText: { flex: 1, fontSize: 12, color: '#b91c1c', lineHeight: 16 },
  warningText: { flex: 1, fontSize: 12, color: '#92400e', lineHeight: 16 },
  topicSection: { paddingTop: 6, borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 4 },
  topicHeader: { fontSize: 11, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  topicScoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  topicLabel: { fontSize: 12, color: '#374151', fontWeight: '600' },
  topicSubLabel: { fontSize: 11, color: '#9ca3af', paddingLeft: 8 },
  topicValue: { fontSize: 12, fontWeight: '700' },
  topicSubValue: { fontSize: 11, color: '#6b7280' },
  topicStatus: { fontWeight: '400', fontSize: 11 },
  topicFailed: { color: '#b91c1c' },
  topicWeak: { color: '#b45309' },
  topicOk: { color: '#15803d' },
  termRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  termLabelOk: { fontSize: 11, fontWeight: '700', color: '#15803d' },
  termListOk: { fontSize: 11, color: '#166534', flex: 1 },
  termLabelMiss: { fontSize: 11, fontWeight: '700', color: '#b91c1c' },
  termListMiss: { fontSize: 11, color: '#991b1b', flex: 1 },
  okRow: { paddingTop: 4 },
  okText: { fontSize: 12, color: '#15803d', fontWeight: '600' },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusChipText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' as const },
  statusReady: { backgroundColor: '#dcfce7' },
  statusAdvisory: { backgroundColor: '#fef9c3' },
  statusStructural: { backgroundColor: '#fee2e2' },
});
