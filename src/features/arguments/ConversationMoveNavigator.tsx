/**
 * Conversation Move Navigator
 * Presents plain-language move options and maps the selection to a draft patch.
 * Pure UI — no AI, no network calls. Stage 6.0.1
 */
import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import {
  getRootMoveOptions,
  getReplyMoveOptions,
  getChallengeAxisOptions,
  getMoveWarnings,
  mapMoveToDraftPatch,
  type ConversationMoveKind,
  type ChallengeAxis,
  type MoveDraftPatch,
  type ConversationMoveSelection,
} from './conversationMoves';
import type { ArgumentType, DisagreementAxis, ConstitutionRule } from '../../domain/constitution/types';

interface Props {
  parentArgument: { argumentType: ArgumentType } | null;
  rules: ConstitutionRule[];
  onApplyPatch: (patch: MoveDraftPatch) => void;
}

export function ConversationMoveNavigator({ parentArgument, rules, onApplyPatch }: Props) {
  const [selectedMoveKind, setSelectedMoveKind] = useState<ConversationMoveKind | null>(null);
  const [selectedAxis, setSelectedAxis] = useState<ChallengeAxis | null>(null);

  const moveOptions = parentArgument
    ? getReplyMoveOptions(parentArgument.argumentType, rules)
    : getRootMoveOptions();

  const challengeAxisOptions = getChallengeAxisOptions();

  const selectedOption = moveOptions.find((o) => o.id === selectedMoveKind) ?? null;

  const warnings = getMoveWarnings(
    { moveKind: selectedMoveKind ?? 'start_thesis', challengeAxis: selectedAxis, targetExcerpt: null },
    parentArgument,
  );

  const handleMoveSelect = useCallback(
    (kind: ConversationMoveKind) => {
      const next = selectedMoveKind === kind ? null : kind;
      setSelectedMoveKind(next);
      setSelectedAxis(null);

      if (next) {
        const selection: ConversationMoveSelection = {
          moveKind: next,
          challengeAxis: null,
          targetExcerpt: null,
        };
        onApplyPatch(mapMoveToDraftPatch(selection, parentArgument, rules));
      }
    },
    [selectedMoveKind, parentArgument, rules, onApplyPatch],
  );

  const handleAxisSelect = useCallback(
    (axis: ChallengeAxis) => {
      const next = selectedAxis === axis ? null : axis;
      setSelectedAxis(next);

      const selection: ConversationMoveSelection = {
        moveKind: 'challenge_parent',
        challengeAxis: next,
        targetExcerpt: null,
      };
      onApplyPatch(mapMoveToDraftPatch(selection, parentArgument, rules));
    },
    [selectedAxis, parentArgument, rules, onApplyPatch],
  );

  const sectionLabel = parentArgument ? 'How do you want to respond?' : 'Start a new argument';

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{sectionLabel}</Text>

      <View style={styles.moveRow}>
        {moveOptions.map((opt) => {
          const isSelected = selectedMoveKind === opt.id;
          return (
            <Pressable
              key={opt.id}
              style={[styles.moveChip, isSelected && styles.moveChipSelected]}
              onPress={() => handleMoveSelect(opt.id)}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={[styles.moveChipText, isSelected && styles.moveChipTextSelected]}>
                {opt.shortLabel}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedOption && (
        <Text style={styles.description}>{selectedOption.description}</Text>
      )}

      {selectedMoveKind === 'challenge_parent' && (
        <View style={styles.axisSection}>
          <Text style={styles.axisLabel}>Name the disagreement</Text>
          <View style={styles.axisRow}>
            {challengeAxisOptions.map((opt) => {
              const isSelected = selectedAxis === opt.axis;
              return (
                <Pressable
                  key={opt.axis}
                  style={[styles.axisChip, isSelected && styles.axisChipSelected]}
                  onPress={() => handleAxisSelect(opt.axis)}
                  accessibilityRole="radio"
                  accessibilityLabel={opt.label}
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text style={[styles.axisChipText, isSelected && styles.axisChipTextSelected]}>
                    {opt.shortLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {selectedAxis && (
            <Text style={styles.axisDescription}>
              {challengeAxisOptions.find((o) => o.axis === selectedAxis)?.description}
            </Text>
          )}
        </View>
      )}

      {warnings.map((w, i) => (
        <Text key={i} style={styles.warning}>
          {w}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  moveRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moveChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  moveChipSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  moveChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  moveChipTextSelected: {
    color: '#fff',
  },
  description: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    lineHeight: 18,
  },
  axisSection: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#faf5ff',
    borderWidth: 1,
    borderColor: '#e9d5ff',
  },
  axisLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4c1d95',
    marginBottom: 8,
  },
  axisRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  axisChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#c4b5fd',
    backgroundColor: '#fff',
  },
  axisChipSelected: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  axisChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4c1d95',
  },
  axisChipTextSelected: {
    color: '#fff',
  },
  axisDescription: {
    fontSize: 11,
    color: '#6d28d9',
    marginTop: 6,
    lineHeight: 16,
  },
  warning: {
    fontSize: 11,
    color: '#b45309',
    marginTop: 6,
    lineHeight: 16,
  },
});
