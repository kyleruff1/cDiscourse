/**
 * GAME-005 — Chime-in governance control.
 *
 * Read-time, presentation-only RN component — the small constrained
 * governance control shown ONLY to the OP + Primary Opponent on a chime-in
 * branch. It is a thin layer over a pure `GovernanceControlViewModel` — no
 * state, no network, no write path. Apply / retract is a callback into the
 * caller's in-session `useChimeInGovernance` hook.
 *
 * Doctrine:
 *  - The four reactions describe participation STRUCTURE, never correctness.
 *    No like/dislike vocabulary; labels come from CHIME_IN_GOVERNANCE_COPY.
 *  - Applied state is shape + text ("Applied" tag + filled border), NOT
 *    color alone — color-independence (accessibility-targets).
 *  - The observer-fallback notice is calm and non-punitive: a moved-to-
 *    observer chime-in keeps full read access and their branch stays on
 *    the record.
 *  - Each reaction Pressable carries role + label + state + a >=44px hit
 *    target (hitSlop fills the gap when the visual is smaller).
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type {
  GovernanceControlViewModel,
  GovernanceReactionKind,
} from './publicSeatModel';

interface ChimeInGovernanceControlProps {
  viewModel: GovernanceControlViewModel;
  /**
   * Toggle a reaction. The caller's hook applies it when not yet applied by
   * this viewer, or retracts the viewer's own reaction when already applied.
   */
  onToggleReaction: (kind: GovernanceReactionKind) => void;
}

/** A 44px hit target on a smaller pill — fills the gap with hitSlop. */
const REACTION_HIT_SLOP = { top: 11, bottom: 11, left: 8, right: 8 } as const;

export function ChimeInGovernanceControl({
  viewModel,
  onToggleReaction,
}: ChimeInGovernanceControlProps) {
  return (
    <View style={styles.control} testID="chime-in-governance-control">
      <Text style={styles.heading}>Keep this chime-in on track</Text>

      <View style={styles.reactionRow}>
        {viewModel.reactions.map((reaction) => (
          <Pressable
            key={reaction.kind}
            onPress={() => onToggleReaction(reaction.kind)}
            accessibilityRole="button"
            accessibilityLabel={reaction.accessibilityLabel}
            accessibilityState={{ selected: reaction.appliedByViewer }}
            hitSlop={REACTION_HIT_SLOP}
            style={[
              styles.reactionPill,
              reaction.appliedByViewer && styles.reactionPillApplied,
            ]}
            testID={`chime-in-governance-reaction-${reaction.kind}`}
          >
            <Text
              style={[
                styles.reactionText,
                reaction.appliedByViewer && styles.reactionTextApplied,
              ]}
            >
              {reaction.label}
            </Text>
            {/* Applied state — a shape/text marker, not color alone. */}
            {reaction.appliedByViewer ? (
              <Text style={styles.appliedTag} accessibilityElementsHidden>
                {'✓ Applied'}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>

      {/* Observer-fallback notice — calm, non-punitive. */}
      {viewModel.observerFallbackNotice !== null ? (
        <View
          style={styles.fallbackNotice}
          accessibilityLabel={viewModel.observerFallbackNotice}
          testID="chime-in-governance-fallback-notice"
        >
          <Text style={styles.fallbackText}>
            {viewModel.observerFallbackNotice}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  control: {
    marginTop: 8,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fafafa',
    gap: 6,
  },
  heading: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  reactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  reactionPillApplied: {
    borderColor: '#2563eb',
    borderWidth: 2,
    backgroundColor: '#eff6ff',
  },
  reactionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  reactionTextApplied: {
    color: '#1d4ed8',
    fontWeight: '700',
  },
  appliedTag: {
    fontSize: 9,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  fallbackNotice: {
    marginTop: 2,
    padding: 8,
    borderRadius: 4,
    backgroundColor: '#f3f4f6',
  },
  fallbackText: {
    fontSize: 11,
    color: '#4b5563',
    lineHeight: 16,
  },
});
