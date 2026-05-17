/**
 * Stage 6.1.8 — ArgumentDraftQualifierCards
 *
 * Pop-out advisory cards rendered around the draft surface while a user is
 * composing a reply. Each card hints at category / disagreement axis /
 * suggested move type / evidence nudge / anti-amplification warning /
 * point-standing implication. ALWAYS advisory — never blocking.
 *
 * Reuses the existing deterministic qualifier deriver so no AI call is
 * made by this component.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  deriveMessageCategory,
  derivePrimaryQualifier,
  formatCategoryLabel,
  formatQualifierLabel,
  getQualifierUiNudge,
} from './messageQualifiers';

interface Props {
  draft: {
    argumentType?: string | null;
    side?: string | null;
    disagreementAxis?: string | null;
    selectedTagCodes?: string[] | null;
    targetExcerpt?: string | null;
    body?: string | null;
  };
  /** Optional amplification warning (e.g., from the deterministic annotator). */
  amplificationWarning?: string | null;
  /** Optional point-standing implication hint. */
  pointStandingHint?: string | null;
}

// Forbidden user-label tokens — defensive scrub before display.
const FORBIDDEN = ['winner', 'loser', 'truth', 'liar', 'dishonest', 'bad faith', 'manipulative', 'extremist', 'propagandist'];

function scrub(s: string | null | undefined): string | null {
  if (!s) return null;
  let out = String(s);
  for (const t of FORBIDDEN) {
    const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    out = out.replace(re, '[redacted-term]');
  }
  return out;
}

export function ArgumentDraftQualifierCards({ draft, amplificationWarning, pointStandingHint }: Props) {
  const category = deriveMessageCategory(draft);
  const qualifier = derivePrimaryQualifier(draft);
  const categoryLabel = formatCategoryLabel(category);
  const qualifierLabel = qualifier ? formatQualifierLabel(qualifier) : null;
  const nudge = qualifier ? getQualifierUiNudge(qualifier) : null;
  const amp = scrub(amplificationWarning);
  const pst = scrub(pointStandingHint);

  return (
    <View style={styles.container} accessibilityLabel="argument-draft-qualifier-cards" testID="argument-draft-qualifier-cards">
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Category</Text>
        <Text style={styles.cardValue}>{categoryLabel}</Text>
      </View>
      {qualifierLabel && (
        <View style={[styles.card, styles.cardQualifier]}>
          <Text style={styles.cardLabel}>Qualifier</Text>
          <Text style={styles.cardValue}>{qualifierLabel}</Text>
        </View>
      )}
      {draft.disagreementAxis && (
        <View style={[styles.card, styles.cardAxis]}>
          <Text style={styles.cardLabel}>Disagreement axis</Text>
          <Text style={styles.cardValue}>{draft.disagreementAxis}</Text>
        </View>
      )}
      {nudge && (
        <View style={[styles.card, styles.cardNudge]}>
          <Text style={styles.cardLabel}>Suggested move</Text>
          <Text style={styles.cardValue}>{nudge}</Text>
        </View>
      )}
      {amp && (
        <View style={[styles.card, styles.cardWarning]}>
          <Text style={styles.cardLabel}>Amplification warning</Text>
          <Text style={styles.cardValue}>{amp}</Text>
        </View>
      )}
      {pst && (
        <View style={[styles.card, styles.cardPointStanding]}>
          <Text style={styles.cardLabel}>Point-standing</Text>
          <Text style={styles.cardValue}>{pst}</Text>
        </View>
      )}
      <Text style={styles.advisory}>Advisory only — these cards describe the message, not the person.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 8, paddingVertical: 6 },
  card: { backgroundColor: '#1e293b', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, minWidth: 110, borderWidth: 1, borderColor: '#334155' },
  cardQualifier: { borderColor: '#a855f7' },
  cardAxis: { borderColor: '#ef4444' },
  cardNudge: { borderColor: '#10b981' },
  cardWarning: { borderColor: '#f59e0b', backgroundColor: '#451a03' },
  cardPointStanding: { borderColor: '#0ea5e9', backgroundColor: '#082f49' },
  cardLabel: { color: '#94a3b8', fontSize: 9, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.5 },
  cardValue: { color: '#f8fafc', fontSize: 12, fontWeight: '700', marginTop: 2 },
  advisory: { color: '#64748b', fontSize: 10, fontStyle: 'italic', width: '100%', marginTop: 4 },
});
