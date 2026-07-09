/**
 * ROOM-002 (#885) — RingsideCard.
 *
 * One move card in the transform-free Ringside feed. Presentational only:
 * every value arrives as a prop from RingsideFeed / the orchestrator. The
 * card carries a kind-color spine paired with a text kind label (color is
 * never the only signal), a plain author / side header, the body, a
 * quote / context chip, lightweight proof + owed-receipt indicators, an
 * inline branch pill, and — on the ACTIVE card only — the calm friendly-flag
 * row plus ONE actor-aware action row.
 *
 * Doctrine (cdiscourse-doctrine, timeline-grammar, accessibility-targets):
 *   - Conversation-first: NO standing / heat / classifier data on the card
 *     face. Those reads live behind the shared Inspect popout + the Map
 *     sidecar (ROOM-004). The proof / owed indicators are plain activity
 *     signals, never verdicts.
 *   - No transforms: the feed is a plain vertical list, so reduce-motion is
 *     satisfied by construction. The reduceMotion prop is threaded for
 *     symmetry only; there is no motion to gate.
 *   - Every action target is at least 44 by 44. Color is paired with text on
 *     the spine and every chip. No verdict tokens. No AI. No Supabase.
 *
 * All comments in this file are apostrophe-free so the uxOneOneTwoDoctrine
 * naive quote-parity scanner does not mis-parse the file.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ArgumentBubbleControl } from '../argumentGameSurfaceModel';
import type { RailActionCode } from '../railActionCategories';
import type { PrioritizedPointFeedbackFlags } from '../../feedbackFlags';
import { PointFeedbackFlagsRow } from '../../feedbackFlags';
import type { RingsideCardViewModel } from './ringsideFeedModel';

// Plain-language control labels. Values mirror the shipped ArgumentBubbleActions
// map (no new action copy is invented). Ban-list clean.
const CONTROL_LABEL: Record<ArgumentBubbleControl, string> = {
  reply: 'Reply',
  disagree: 'Disagree',
  flag: 'Request review',
  ask_for_source: 'Ask for source',
  ask_for_quote: 'Ask for quote',
  branch: 'Branch',
  view_qualifiers: 'View qualifiers',
  request_deletion: 'Request deletion',
};

const PRIMARY_BG = '#4338ca';
const GHOST_BG = '#1e293b';
const GHOST_BORDER = '#334155';
const DISABLED_BG = '#334155';

export interface RingsideCardProps {
  card: RingsideCardViewModel;
  /** Total card count, for the accessibility position label. */
  total: number;
  onActivate: (messageId: string) => void;
  onActivateAncestor: (messageId: string) => void;
  onCardAction: (control: ArgumentBubbleControl, messageId: string) => void;
  onRailAction: (code: RailActionCode, ctx: { activeMessageId: string | null }) => void;
  onOpenMap: () => void;
  /** Active-card friendly flags. Only supplied for the active card. */
  pointFeedbackFlags?: PrioritizedPointFeedbackFlags | null;
  reduceMotion?: boolean;
}

function buildCardAccessibilityLabel(card: RingsideCardViewModel, total: number): string {
  const parts = [
    `${card.kindLabel} by ${card.actorLabel} on side ${card.sideLabel}`,
    `position ${card.ordinal} of ${total}`,
  ];
  if (card.isActive) parts.push('active');
  if (card.branchPill) parts.push(card.branchPill.label);
  return parts.join(', ');
}

export function RingsideCard(props: RingsideCardProps) {
  const { card, total } = props;
  const testIdBase = card.isActive
    ? `ringside-card-active-${card.messageId}`
    : `ringside-card-${card.messageId}`;

  return (
    <Pressable
      onPress={() => props.onActivate(card.messageId)}
      accessibilityRole="button"
      accessibilityState={{ selected: card.isActive }}
      accessibilityLabel={buildCardAccessibilityLabel(card, total)}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      testID={testIdBase}
      style={[styles.card, card.isActive && styles.cardActive]}
    >
      <View style={styles.row}>
        {/* Kind spine — color is paired with the text kind label below. */}
        <View style={[styles.spine, { backgroundColor: card.spineColor }]} />
        <View style={styles.content}>
          {/* Header — display-only text, no clickable box. */}
          <View style={styles.headerRow}>
            <Text style={[styles.kindLabel, { color: card.spineColor }]} testID={`ringside-kind-${card.messageId}`}>
              {card.kindLabel}
            </Text>
            <Text style={styles.headerMeta}>
              {card.actorLabel}
              {' · '}
              {card.sideLabel}
            </Text>
            <Text style={styles.headerTime}>{card.relativeLabel}</Text>
          </View>

          {/* Quote / context chip — tap activates the ancestor this answers. */}
          {card.quoteChip ? (
            <Pressable
              onPress={() =>
                card.parentMessageId ? props.onActivateAncestor(card.parentMessageId) : undefined
              }
              disabled={!card.parentMessageId}
              accessibilityRole="button"
              accessibilityLabel="Go to the point this move answers"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              testID={`ringside-quote-chip-${card.messageId}`}
              style={styles.quoteChip}
            >
              <Text style={styles.quoteChipText} numberOfLines={1}>
                {card.quoteChip}
              </Text>
            </Pressable>
          ) : null}

          {/* Body — 15px floor. */}
          <Text style={styles.body} testID={`ringside-body-${card.messageId}`}>
            {card.body}
          </Text>

          {/* Proof / owed / branch indicator row. */}
          {card.proofChipCount > 0 || card.owedReceiptChip || card.branchPill ? (
            <View style={styles.chipRow}>
              {card.proofChipCount > 0 ? (
                <View style={styles.proofChip} testID={`ringside-proof-chip-${card.messageId}`}>
                  <Text style={styles.proofChipText}>
                    {card.proofChipCount === 1 ? 'Receipt' : `Receipts ${card.proofChipCount}`}
                  </Text>
                </View>
              ) : null}
              {card.owedReceiptChip ? (
                <View style={styles.owedChip} testID={`ringside-owed-chip-${card.messageId}`}>
                  <Text style={styles.owedChipText}>Source owed</Text>
                </View>
              ) : null}
              {card.branchPill ? (
                <Pressable
                  onPress={props.onOpenMap}
                  accessibilityRole="button"
                  accessibilityLabel={`${card.branchPill.label}. Open the map to follow the thread.`}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  testID={`ringside-branch-pill-${card.messageId}`}
                  style={styles.branchPill}
                >
                  <Text style={styles.branchPillText}>{`${card.branchPill.label} →`}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* Active card only: calm friendly-flag row + one actor-aware action row. */}
          {card.isActive && props.pointFeedbackFlags ? (
            <PointFeedbackFlagsRow
              flags={props.pointFeedbackFlags.visible}
              suppressedCount={props.pointFeedbackFlags.suppressedCount}
            />
          ) : null}
          {card.isActive ? <CardActionRow {...props} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * The single actor-aware action row on the active card. Participant viewers
 * see the view-model allowedControls; observers see the injected rail set.
 * One primary action per element: the first code is primary, the rest are
 * quiet ghost chips.
 *
 * Observer seat-fullness (disabled Join chips when the room is full) is owned
 * by the still-mounted ArgumentSideActionRail, not re-implemented here.
 */
function CardActionRow(props: RingsideCardProps) {
  const { card } = props;
  const row = card.actionRow;

  if (row.kind === 'observer') {
    return (
      <View style={styles.actionRow} testID={`ringside-action-row-${card.messageId}`}>
        {row.actions.map((action, i) => (
          <Pressable
            key={action.code}
            onPress={() => props.onRailAction(action.code, { activeMessageId: card.messageId })}
            accessibilityRole="button"
            accessibilityLabel={`${action.label} on message ${card.ordinal}`}
            accessibilityHint={action.helper}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            testID={`ringside-action-${action.code}-${card.messageId}`}
            style={[styles.actionChip, i === 0 ? styles.actionChipPrimary : styles.actionChipGhost]}
          >
            <Text style={i === 0 ? styles.actionChipTextPrimary : styles.actionChipTextGhost}>
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.actionRow} testID={`ringside-action-row-${card.messageId}`}>
      {row.controls.map((control, i) => {
        const disabled = control === 'request_deletion' && card.deletionRequested;
        const label = disabled ? 'Deletion requested' : CONTROL_LABEL[control];
        return (
          <Pressable
            key={control}
            onPress={() => (disabled ? undefined : props.onCardAction(control, card.messageId))}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`${CONTROL_LABEL[control]} on message ${card.ordinal}`}
            accessibilityState={{ disabled }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            testID={`ringside-action-${control}-${card.messageId}`}
            style={[
              styles.actionChip,
              disabled
                ? styles.actionChipDisabled
                : i === 0
                  ? styles.actionChipPrimary
                  : styles.actionChipGhost,
            ]}
          >
            <Text
              style={
                disabled
                  ? styles.actionChipTextGhost
                  : i === 0
                    ? styles.actionChipTextPrimary
                    : styles.actionChipTextGhost
              }
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#1e293b',
    marginVertical: 4,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  cardActive: {
    borderColor: '#6366f1',
    backgroundColor: '#0f172a',
  },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  spine: { width: 5 },
  content: { flex: 1, paddingVertical: 10, paddingHorizontal: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  kindLabel: { fontSize: 12, fontWeight: '800', textTransform: 'lowercase' },
  headerMeta: { color: '#cbd5e1', fontSize: 12, fontWeight: '700' },
  headerTime: { color: '#64748b', fontSize: 11, marginLeft: 'auto' },
  quoteChip: {
    marginTop: 8,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#475569',
    backgroundColor: '#111827',
    minHeight: 32,
    justifyContent: 'center',
  },
  quoteChipText: { color: '#94a3b8', fontSize: 12, fontStyle: 'italic' },
  body: { color: '#e2e8f0', fontSize: 15, lineHeight: 21, marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' },
  proofChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#0c4a6e',
    minHeight: 28,
    justifyContent: 'center',
  },
  proofChipText: { color: '#bae6fd', fontSize: 11, fontWeight: '700' },
  owedChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#0d9488',
    backgroundColor: '#0b1220',
    minHeight: 28,
    justifyContent: 'center',
  },
  owedChipText: { color: '#5eead4', fontSize: 11, fontWeight: '700' },
  branchPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#111827',
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
  },
  branchPillText: { color: '#a5b4fc', fontSize: 12, fontWeight: '700' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, alignItems: 'center' },
  actionChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionChipPrimary: { backgroundColor: PRIMARY_BG },
  actionChipGhost: { backgroundColor: GHOST_BG, borderWidth: 1, borderColor: GHOST_BORDER },
  actionChipDisabled: { backgroundColor: DISABLED_BG, opacity: 0.65 },
  actionChipTextPrimary: { color: '#f8fafc', fontSize: 13, fontWeight: '800' },
  actionChipTextGhost: { color: '#cbd5e1', fontSize: 13, fontWeight: '700' },
});
