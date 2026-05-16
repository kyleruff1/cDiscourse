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

  return (
    <View style={styles.container}>
      <View style={styles.disclaimerRow}>
        <Text style={styles.disclaimer}>
          Client validation is a preview. Server validation is authoritative.
        </Text>
        <Text style={[styles.sourceChip, source === 'supabase' ? styles.sourceSupabase : styles.sourceFallback]}>
          {source === 'supabase' ? 'Live rules' : 'Local v1'}
        </Text>
      </View>

      {blockingErrors.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitleError}>Blocking issues</Text>
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
          <Text style={styles.sectionTitleWarn}>Warnings</Text>
          {warnings.map((w, i) => (
            <View key={i} style={styles.warningRow}>
              <Text style={styles.bulletWarn}>!</Text>
              <Text style={styles.warningText}>{w.message}</Text>
            </View>
          ))}
        </View>
      )}

      {tsc && (
        <View style={styles.topicSection}>
          <Text style={styles.topicHeader}>Topic coverage</Text>

          <View style={styles.topicScoreRow}>
            <Text style={styles.topicLabel}>Combined score</Text>
            <Text style={[
              styles.topicValue,
              tsc.status === 'failed' && styles.topicFailed,
              tsc.status === 'weak' && styles.topicWeak,
              tsc.status === 'satisfied' && styles.topicOk,
            ]}>
              {pct(tsc.score)} <Text style={styles.topicStatus}>({tsc.status})</Text>
            </Text>
          </View>

          {tsc.resolutionScore !== undefined && (
            <View style={styles.topicScoreRow}>
              <Text style={styles.topicSubLabel}>vs. resolution</Text>
              <Text style={styles.topicSubValue}>{pct(tsc.resolutionScore)}</Text>
            </View>
          )}
          {tsc.parentScore !== undefined && tsc.parentScore !== null && (
            <View style={styles.topicScoreRow}>
              <Text style={styles.topicSubLabel}>vs. parent</Text>
              <Text style={styles.topicSubValue}>{pct(tsc.parentScore)}</Text>
            </View>
          )}

          {tsc.matchedTerms.length > 0 && (
            <View style={styles.termRow}>
              <Text style={styles.termLabelOk}>Matched:</Text>
              <Text style={styles.termListOk}>{tsc.matchedTerms.join(', ')}</Text>
            </View>
          )}
          {tsc.missingTerms.length > 0 && (
            <View style={styles.termRow}>
              <Text style={styles.termLabelMiss}>Missing:</Text>
              <Text style={styles.termListMiss}>{tsc.missingTerms.join(', ')}</Text>
            </View>
          )}
        </View>
      )}

      {allowPost && blockingErrors.length === 0 && warnings.length === 0 && (
        <View style={styles.okRow}>
          <Text style={styles.okText}>No issues found</Text>
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
});
