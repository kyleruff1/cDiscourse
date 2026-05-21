import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import type { ArgumentRow, ArgumentType } from './types';
import { SURFACE_TOKENS, CONTROL, STATUS } from '../../lib/designTokens';

const TYPE_LABEL: Record<string, string> = {
  thesis: 'Thesis',
  claim: 'Claim',
  rebuttal: 'Rebuttal',
  counter_rebuttal: 'Counter-Rebuttal',
  evidence: 'Evidence',
  clarification_request: 'Clarification',
  concession: 'Concession',
  synthesis: 'Synthesis',
};

const SIDE_LABEL: Record<string, string> = {
  affirmative: 'Aff',
  negative: 'Neg',
  neutral: 'Ntl',
};

const PARENT_PREVIEW_LENGTH = 160;

function getTypeGuidance(selectedType: ArgumentType | null): string | null {
  switch (selectedType) {
    case 'concession':
      return 'What exact point in the parent argument are you conceding?';
    case 'clarification_request':
      return 'Ask for a definition, source, scope clarification, or missing premise. Avoid disguised rebuttals.';
    case 'rebuttal':
      return 'Declare what kind of disagreement you are making using the Disagreement axis selector below.';
    case 'counter_rebuttal':
      return 'Defend against the rebuttal above. Declare your disagreement axis below.';
    default:
      return null;
  }
}

interface Props {
  parentArgument: ArgumentRow | null;
  selectedArgumentType: ArgumentType | null;
  targetExcerpt: string;
  onChangeTargetExcerpt: (text: string) => void;
  onClear?: () => void;
}

export function ComposerTargetPanel({
  parentArgument,
  selectedArgumentType,
  targetExcerpt,
  onChangeTargetExcerpt,
  onClear,
}: Props) {
  const guidance = getTypeGuidance(selectedArgumentType);

  if (!parentArgument) {
    return (
      <View style={styles.rootContainer}>
        <Text style={styles.rootTitle}>Root-level argument</Text>
        <Text style={styles.rootBody}>
          Only <Text style={styles.emphasis}>thesis</Text> or{' '}
          <Text style={styles.emphasis}>claim</Text> arguments may be posted at root level. Select
          one of those types below.
        </Text>
      </View>
    );
  }

  const typeLabel = TYPE_LABEL[parentArgument.argumentType] ?? parentArgument.argumentType;
  const sideLabel = SIDE_LABEL[parentArgument.side] ?? parentArgument.side;
  const preview = parentArgument.body.slice(0, PARENT_PREVIEW_LENGTH);
  const isLong = parentArgument.body.length > PARENT_PREVIEW_LENGTH;

  return (
    <View style={styles.replyContainer}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Replying to</Text>
        {onClear && (
          <Pressable onPress={onClear} accessibilityRole="button" accessibilityLabel="Clear reply target">
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {typeLabel} · {sideLabel}
        </Text>
      </View>

      <Text style={styles.parentPreview} numberOfLines={3}>
        {preview}
        {isLong ? '…' : ''}
      </Text>

      <View style={styles.excerptSection}>
        <Text style={styles.excerptLabel}>Target excerpt</Text>
        <Text style={styles.excerptHint}>
          Paste the exact phrase from the parent you are responding to. Keeps the reply anchored.
        </Text>
        <TextInput
          value={targetExcerpt}
          onChangeText={onChangeTargetExcerpt}
          placeholder="Optional — paste a quote from the parent argument…"
          placeholderTextColor={SURFACE_TOKENS.placeholder}
          multiline
          style={styles.excerptInput}
          accessibilityLabel="Target excerpt"
          autoCapitalize="none"
        />
      </View>

      {guidance && (
        <View style={styles.guidanceRow}>
          <Text style={styles.guidanceText}>{guidance}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    backgroundColor: STATUS.success.bg,
    borderWidth: 1,
    borderColor: STATUS.success.fg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  rootTitle: { fontSize: 12, fontWeight: '700', color: STATUS.success.fg, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
  rootBody: { fontSize: 13, color: STATUS.success.fg, lineHeight: 18 },
  emphasis: { fontWeight: '700' },
  replyContainer: {
    backgroundColor: STATUS.info.bg,
    borderWidth: 1,
    borderColor: STATUS.info.fg,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerLabel: { fontSize: 11, fontWeight: '700', color: STATUS.info.fg, textTransform: 'uppercase', letterSpacing: 0.4 },
  clearText: { fontSize: 12, color: CONTROL.primary.bg, fontWeight: '600' },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: SURFACE_TOKENS.overlay,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 6,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: STATUS.info.fg },
  parentPreview: { fontSize: 13, color: SURFACE_TOKENS.textPrimary, lineHeight: 18, marginBottom: 12 },
  excerptSection: { marginBottom: 8 },
  excerptLabel: { fontSize: 12, fontWeight: '700', color: SURFACE_TOKENS.textPrimary, marginBottom: 2 },
  excerptHint: { fontSize: 11, color: SURFACE_TOKENS.textSecondary, marginBottom: 6 },
  excerptInput: {
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: SURFACE_TOKENS.textPrimary,
    backgroundColor: SURFACE_TOKENS.inputBg,
    minHeight: 56,
    textAlignVertical: 'top',
  },
  guidanceRow: {
    backgroundColor: STATUS.warning.bg,
    borderRadius: 6,
    padding: 8,
    marginTop: 4,
    borderLeftWidth: 3,
    borderLeftColor: STATUS.warning.fg,
  },
  guidanceText: { fontSize: 12, color: STATUS.warning.fg, lineHeight: 17 },
});
