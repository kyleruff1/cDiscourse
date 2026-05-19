import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { EvaluationResult, EvaluationFlagDetail } from '../../domain/constitution/types';
import {
  mapValidationActionOrSuppress,
  shouldRenderValidationActionChip,
  type ValidationActionUx,
} from '../rulesUx/validationActionMap';

interface Props {
  result: EvaluationResult;
  source: 'supabase' | 'local_fallback';
  /**
   * RULE-002 — Optional press handler for the suggested-move chip. When
   * absent, the chip still renders (as informational) but is not
   * Pressable; this preserves the panel's pure-display contract for
   * tests / Storybook surfaces while letting the composer wire a
   * one-click affordance when it owns the press path.
   */
  onSuggestedMove?: (action: ValidationActionUx) => void;
}

/**
 * RULE-002 — Chip subcomponent. Renders next to (NOT in place of) the
 * engine warning text. The warning text owns the message; the chip
 * owns the affordance.
 *
 * Accessibility (accessibility-targets):
 *   - `accessibilityRole="button"` when pressable, otherwise `"text"`.
 *   - `accessibilityLabel` combines chipLabel + helperLine into a
 *     single screen-reader utterance.
 *   - `hitSlop` lifts the visible chip (~24px tall) to a ≥ 44×44
 *     effective tap target.
 */
function ValidationActionChip({
  action,
  onPress,
}: {
  action: ValidationActionUx;
  onPress?: (action: ValidationActionUx) => void;
}) {
  const isPressable = typeof onPress === 'function';
  const a11yLabel = `${action.chipLabel}. ${action.helperLine}`;
  return (
    <Pressable
      onPress={isPressable ? () => onPress!(action) : undefined}
      accessibilityRole={isPressable ? 'button' : 'text'}
      accessibilityLabel={a11yLabel}
      accessibilityHint={isPressable ? 'Opens this move shape in the composer.' : undefined}
      accessibilityState={{ disabled: !isPressable }}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={styles.actionChip}
      testID={`validation-action-chip-${action.code}`}
    >
      <Text style={styles.actionChipText}>{action.chipLabel}</Text>
    </Pressable>
  );
}

/**
 * Derive the chip for a given engine warning. Returns null when the
 * action either doesn't exist (unknown code) or has all-null routing
 * fields (suppressed by design — e.g. invalid_transition needs the
 * user to re-author, no chip is offered).
 */
function chipFor(detail: EvaluationFlagDetail): ValidationActionUx | null {
  const action = mapValidationActionOrSuppress(detail.flagCode);
  if (!action) return null;
  if (!shouldRenderValidationActionChip(action)) return null;
  return action;
}

function pct(score: number) {
  return `${(score * 100).toFixed(0)}%`;
}

export function ComposerValidationPanel({ result, source, onSuggestedMove }: Props) {
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
          {blockingErrors.map((e, i) => {
            const chip = chipFor(e);
            return (
              <View key={i} style={styles.errorRow}>
                <Text style={styles.bullet}>✕</Text>
                <View style={styles.errorBody}>
                  <Text style={styles.errorText}>{e.message}</Text>
                  {chip ? <ValidationActionChip action={chip} onPress={onSuggestedMove} /> : null}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {warnings.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitleWarn}>Advisory</Text>
          {warnings.slice(0, 3).map((w, i) => {
            const chip = chipFor(w);
            return (
              <View key={i} style={styles.warningRow}>
                <Text style={styles.bulletWarn}>·</Text>
                <View style={styles.warningBody}>
                  <Text style={styles.warningText}>{w.message}</Text>
                  {chip ? <ValidationActionChip action={chip} onPress={onSuggestedMove} /> : null}
                </View>
              </View>
            );
          })}
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
  errorBody: { flex: 1, gap: 4 },
  warningBody: { flex: 1, gap: 4 },
  errorText: { fontSize: 12, color: '#b91c1c', lineHeight: 16 },
  warningText: { fontSize: 12, color: '#92400e', lineHeight: 16 },
  // RULE-002 — suggested-move chip. Neutral surface; the chipLabel
  // carries the meaning (color is not the only signal).
  actionChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  actionChipText: { fontSize: 11, fontWeight: '700', color: '#374151' },
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
