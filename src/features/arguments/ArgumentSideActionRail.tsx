/**
 * Stage 6.4 — ArgumentSideActionRail
 *
 * Collapsed-by-default rail. In Observer mode it stays small until the
 * user expands or taps a bubble. The rail is the SINGLE entry point for
 * Join-Aff / Join-Neg and the per-bubble tactical actions.
 *
 * No body editing affordance is ever exposed. Own-bubble action set is
 * intentionally minimal (Qualifiers + Request deletion).
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ArgumentBubbleControl } from './argumentGameSurfaceModel';
import { OBSERVER_COPY } from './gameCopy';
import type { ParticipantSide } from '../debates/types';

export type RailViewerRole = 'observer' | 'participant';
export type RailBubbleActor = 'self' | 'other' | 'bot' | 'admin' | 'unknown';

export type RailActionCode =
  // Observer set
  | 'watch'
  | 'join_aff'
  | 'join_neg'
  | 'ask_source'
  | 'open_timeline'
  | 'share'
  // Participant set (other bubble)
  | 'reply'
  | 'disagree'
  | 'ask_quote'
  | 'split_branch'
  | 'flag'
  | 'qualifiers'
  // Self bubble
  | 'request_deletion';

interface RailAction {
  code: RailActionCode;
  label: string;
  helper: string;
  tone?: 'primary' | 'warning' | 'critical' | 'neutral';
}

const OBSERVER_ACTIONS: RailAction[] = [
  { code: 'watch', label: 'Watch', helper: OBSERVER_COPY.watchHelp, tone: 'neutral' },
  { code: 'join_aff', label: OBSERVER_COPY.joinAffShort, helper: OBSERVER_COPY.joinHelp + ' Argue For.', tone: 'primary' },
  { code: 'join_neg', label: OBSERVER_COPY.joinNegShort, helper: OBSERVER_COPY.joinHelp + ' Argue Against.', tone: 'primary' },
  { code: 'ask_source', label: 'Ask source', helper: OBSERVER_COPY.askSourceHelp, tone: 'primary' },
  { code: 'open_timeline', label: 'Open timeline', helper: OBSERVER_COPY.openTimelineHelp, tone: 'neutral' },
  { code: 'share', label: 'Share', helper: OBSERVER_COPY.shareHelp, tone: 'neutral' },
];

const PARTICIPANT_OTHER_ACTIONS: RailAction[] = [
  { code: 'reply', label: 'Reply', helper: OBSERVER_COPY.replyHelp, tone: 'primary' },
  { code: 'disagree', label: 'Disagree', helper: OBSERVER_COPY.disagreeHelp, tone: 'warning' },
  { code: 'ask_source', label: 'Ask source', helper: OBSERVER_COPY.askSourceHelp, tone: 'primary' },
  { code: 'ask_quote', label: 'Ask quote', helper: OBSERVER_COPY.askQuoteHelp, tone: 'primary' },
  { code: 'split_branch', label: 'Split branch', helper: OBSERVER_COPY.splitBranchHelp, tone: 'neutral' },
  { code: 'flag', label: 'Flag', helper: OBSERVER_COPY.flagHelp, tone: 'critical' },
  { code: 'qualifiers', label: 'Qualifiers', helper: OBSERVER_COPY.qualifiersHelp, tone: 'neutral' },
];

const SELF_ACTIONS: RailAction[] = [
  { code: 'qualifiers', label: 'Qualifiers', helper: OBSERVER_COPY.qualifiersHelp, tone: 'neutral' },
  { code: 'request_deletion', label: 'Request deletion', helper: OBSERVER_COPY.requestDeletionHelp, tone: 'critical' },
];

export function getRailActions(viewerRole: RailViewerRole, bubbleActor: RailBubbleActor): RailAction[] {
  if (viewerRole === 'observer') return OBSERVER_ACTIONS;
  if (bubbleActor === 'self') return SELF_ACTIONS;
  return PARTICIPANT_OTHER_ACTIONS;
}

/**
 * Map a rail action code to the existing `ArgumentBubbleControl` enum
 * the game surface dispatches. Some codes are rail-only (no equivalent
 * in the bubble enum) — those return `null` and the parent handler will
 * route them locally (join, share, open_timeline).
 */
export function railActionToBubbleControl(code: RailActionCode): ArgumentBubbleControl | null {
  switch (code) {
    case 'reply': return 'reply';
    case 'disagree': return 'disagree';
    case 'ask_source': return 'ask_for_source';
    case 'ask_quote': return 'ask_for_quote';
    case 'split_branch': return 'branch';
    case 'flag': return 'flag';
    case 'qualifiers': return 'view_qualifiers';
    case 'request_deletion': return 'request_deletion';
    default: return null;
  }
}

interface Props {
  viewerRole: RailViewerRole;
  bubbleActor: RailBubbleActor;
  /** Side the user is currently on, if participant. Used to hide redundant Join chips. */
  participantSide?: ParticipantSide | null;
  /** Initial collapsed state — defaults to collapsed for observer, expanded for participant. */
  defaultCollapsed?: boolean;
  /** Active message id for accessibility prefixes. */
  activeMessageId?: string | null;
  /** Called when the user picks an action. The caller routes to join / composer / share / etc. */
  onAction: (code: RailActionCode, ctx: { activeMessageId: string | null; bubbleActor: RailBubbleActor; viewerRole: RailViewerRole }) => void;
}

export function ArgumentSideActionRail({
  viewerRole,
  bubbleActor,
  participantSide,
  defaultCollapsed,
  activeMessageId,
  onAction,
}: Props) {
  const initialCollapsed = defaultCollapsed ?? (viewerRole === 'observer');
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const actions = getRailActions(viewerRole, bubbleActor).filter((a) => {
    // If the participant is already on this side, hide the redundant join chip.
    if (a.code === 'join_aff' && participantSide === 'affirmative') return false;
    if (a.code === 'join_neg' && participantSide === 'negative') return false;
    return true;
  });

  if (collapsed) {
    return (
      <View style={styles.collapsedWrap} testID="argument-side-action-rail">
        <Pressable
          style={styles.collapsedChip}
          onPress={() => setCollapsed(false)}
          accessibilityRole="button"
          accessibilityLabel={viewerRole === 'observer' ? 'Expand observer actions' : 'Expand actions'}
          accessibilityState={{ expanded: false }}
          testID="rail-toggle-expand"
        >
          <Text style={styles.collapsedChipText}>Actions ›</Text>
        </Pressable>
        {viewerRole === 'observer' ? (
          <Text style={styles.collapsedHint} testID="rail-observer-hint">{OBSERVER_COPY.watchHelp}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.expandedRoot} testID="argument-side-action-rail">
      <View style={styles.expandedHeader}>
        <Text style={styles.expandedTitle}>
          {viewerRole === 'observer' ? 'Observer actions' : bubbleActor === 'self' ? 'On your message' : 'On this message'}
        </Text>
        <Pressable
          onPress={() => setCollapsed(true)}
          accessibilityRole="button"
          accessibilityLabel="Collapse actions"
          accessibilityState={{ expanded: true }}
          testID="rail-toggle-collapse"
          hitSlop={8}
        >
          <Text style={styles.expandedCollapse}>collapse ›</Text>
        </Pressable>
      </View>
      <View style={styles.actionList}>
        {actions.map((a) => (
          <Pressable
            key={`rail-${a.code}`}
            style={[
              styles.actionButton,
              a.tone === 'primary' && styles.actionButtonPrimary,
              a.tone === 'warning' && styles.actionButtonWarning,
              a.tone === 'critical' && styles.actionButtonCritical,
            ]}
            onPress={() => onAction(a.code, { activeMessageId: activeMessageId ?? null, bubbleActor, viewerRole })}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            accessibilityHint={a.helper}
            testID={`rail-action-${a.code}`}
          >
            <Text style={styles.actionLabel}>{a.label}</Text>
            <Text style={styles.actionHelper} numberOfLines={2}>{a.helper}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  collapsedWrap: { backgroundColor: '#0b1220', borderTopWidth: 1, borderTopColor: '#1f2937', paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  collapsedChip: { backgroundColor: '#312e81', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  collapsedChipText: { color: '#fff', fontWeight: '800' as const, fontSize: 12 },
  collapsedHint: { color: '#94a3b8', fontSize: 11, flex: 1 },

  expandedRoot: { backgroundColor: '#0b1220', borderTopWidth: 1, borderTopColor: '#1f2937', padding: 10 },
  expandedHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  expandedTitle: { color: '#a5b4fc', fontWeight: '800' as const, fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: 0.4 },
  expandedCollapse: { color: '#64748b', fontSize: 11 },
  actionList: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  actionButton: { backgroundColor: '#1f2937', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, minWidth: 120, flexGrow: 1, flexBasis: '30%', maxWidth: '49%' },
  actionButtonPrimary: { backgroundColor: '#312e81' },
  actionButtonWarning: { backgroundColor: '#9a3412' },
  actionButtonCritical: { backgroundColor: '#7f1d1d' },
  actionLabel: { color: '#f8fafc', fontWeight: '800' as const, fontSize: 12 },
  actionHelper: { color: '#cbd5e1', fontSize: 10, marginTop: 2 },
});
