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
import { SURFACE_TOKENS, CHIP_TINT } from '../../../lib/designTokens';
import type { ArgumentBubbleControl } from '../argumentGameSurfaceModel';
import type { RailActionCode } from '../railActionCategories';
import type { PrioritizedPointFeedbackFlags } from '../../feedbackFlags';
import { PointFeedbackFlagsRow } from '../../feedbackFlags';
import type { RingsideCardViewModel } from './ringsideFeedModel';
// QUOTE-FORGE-002 (#842) — the woven-callback echo strip. Rendered only when the
// card carries a callbackEcho (quote_forge on + a callback move); absent => the
// card render is byte-identical.
import { CallbackEchoStrip } from '../crossRoom/CallbackEchoStrip';
// MARK-002 (#894) — the ONE TimestampMarker component (source_span + reply chips)
// + the pure model helpers. All additive + flag-gated at the source (markersForCard
// is absent when the flag is off), so the flag-off card render is byte-identical.
import { TimestampMarker } from '../markers/TimestampMarker';
import {
  buildSourceSpanSegments,
  buildTimestampMarker,
  type MarkerRow,
} from '../markers/timestampMarkerModel';
import { MARKER_COPY } from '../markers/markerCopy';
// FEEDBACK-001 (#898) — the ghost feedback bar. All props additive + flag-gated at
// the source (moveMarksEnabled is absent when the flag is off), so the flag-off
// card render is byte-identical.
import { BooleanFeedbackBar } from '../../feedback/BooleanFeedbackBar';
import type { MoveMarkCode, ViewerMoveMarkState } from '../../feedback/moveMarksModel';

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
const GHOST_BORDER = SURFACE_TOKENS.inputBorder;
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
  /**
   * MARK-002 (#894) — markers relevant to this card: those quoting this card
   * (target -> source-span highlight) and those this card carries as a reply
   * (reply -> reference chip). Absent when timestamp_rebuttals is off => the card
   * renders byte-identically to the pre-MARK-002 surface.
   */
  markersForCard?: ReadonlyArray<MarkerRow>;
  /**
   * MARK-002 — predicate: is a markers target argument loaded / visible? Drives
   * the orphaned tombstone on a reply chip whose quoted move was removed. Absent
   * => treat targets as present (live).
   */
  isMarkerTargetLoaded?: (targetArgumentId: string) => boolean;
  /** MARK-002 — open the phrase picker for this (non-own) move. */
  onRespondToThis?: (messageId: string) => void;
  /** MARK-002 — deep-link a reply chip to its quoted source span. */
  onOpenMarkerSource?: (targetArgumentId: string, markerId: string) => void;
  /**
   * FEEDBACK-001 (#898) — the ghost feedback bar mounts on the ACTIVE non-own
   * participant card only. Absent when move_marks is off => byte-identical.
   */
  moveMarksEnabled?: boolean;
  viewerMoveMarksFor?: (argumentId: string) => ViewerMoveMarkState;
  moveMarkErrorFor?: (argumentId: string) => string | undefined;
  showMoveMarkReceiptsFor?: (argumentId: string) => boolean;
  onMarkMove?: (argumentId: string, code: MoveMarkCode) => void;
  onUnmarkMove?: (argumentId: string, code: MoveMarkCode) => void;
  /**
   * UX-FLAGS-004 (#836) — feedback-flag intent handler for the ACTIVE non-own
   * participant card only (parity with the ghost bar gate). Absent => the flag
   * pills render inert (byte-identical).
   */
  onFlagIntent?: (flagKey: string) => void;
  /**
   * QUOTE-FORGE-002 (#842) — open a referenced prior room from the callback
   * echo. Reuses the shipped room-level nav channel (targetDebateId). Absent =>
   * an authorized echo origin renders as plain text (no tap).
   */
  onOpenPriorRoom?: (targetDebateId: string) => void;
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

  // MARK-002 — split this cards markers into the two placements. A marker quoting
  // this card highlights the span in the body; a marker whose reply is this card
  // renders a reference chip that deep-links to its source.
  const markers = props.markersForCard ?? [];
  const targetMarkers = markers.filter((m) => m.target_argument_id === card.messageId);
  const replyMarkers = markers.filter((m) => m.reply_argument_id === card.messageId);
  // Highlight the first quoted span whose offsets still index the body (v1 = one
  // highlight; multi-span is a follow-up). Drift => plain body via the null path.
  const highlightRow =
    targetMarkers.find(
      (m) => buildSourceSpanSegments(card.body, { spanStart: m.span_start, spanEnd: m.span_end }) !== null,
    ) ?? null;
  const showRespondToThis = !card.isOwn && typeof props.onRespondToThis === 'function';

  return (
    // A11Y-693 — accessible=false keeps the nested controls (quote chip, action
    // chips, feedback bar) individually focusable under iOS VoiceOver; the root
    // still activates on press. Without it VoiceOver collapses the whole card
    // into one element and the inner controls become unreachable.
    <Pressable
      onPress={() => props.onActivate(card.messageId)}
      accessible={false}
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
              accessibilityState={{ disabled: !card.parentMessageId }}
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

          {/* Body — 15px floor. MARK-002: when a marker quotes this card, the
              body renders with the quoted span highlighted (source_span
              placement); otherwise the plain body. */}
          {highlightRow ? (
            <TimestampMarker
              placement="source_span"
              marker={buildTimestampMarker(highlightRow, { targetExists: true })}
              body={card.body}
              reduceMotion={props.reduceMotion}
            />
          ) : (
            <Text style={styles.body} testID={`ringside-body-${card.messageId}`}>
              {card.body}
            </Text>
          )}

          {/* MARK-002 — reply reference chips: this card quotes an earlier move.
              Tap deep-links to the source span with full body context (Q5). */}
          {replyMarkers.length > 0 ? (
            <View style={styles.markerReplyRow} testID={`ringside-marker-replies-${card.messageId}`}>
              {replyMarkers.map((m) => (
                <TimestampMarker
                  key={m.id}
                  placement="reply_reference"
                  marker={buildTimestampMarker(m, {
                    targetExists: props.isMarkerTargetLoaded
                      ? props.isMarkerTargetLoaded(m.target_argument_id)
                      : true,
                  })}
                  onOpenSource={props.onOpenMarkerSource}
                  reduceMotion={props.reduceMotion}
                />
              ))}
            </View>
          ) : null}

          {/* MARK-002 — the flag-gated Respond to this affordance on a non-own
              card (you cannot rebut yourself). Opens the phrase picker. */}
          {showRespondToThis ? (
            <Pressable
              onPress={() => props.onRespondToThis?.(card.messageId)}
              accessibilityRole="button"
              accessibilityLabel={MARKER_COPY.respondToThisA11yLabel}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              testID={`ringside-respond-to-this-${card.messageId}`}
              style={styles.respondToThis}
            >
              <Text style={styles.respondToThisText}>{MARKER_COPY.respondToThis}</Text>
            </Pressable>
          ) : null}

          {/* QUOTE-FORGE-002 — the woven-callback echo. Present only on a
              callback move (quote_forge on); the title-only / unavailable arms
              never emit the excerpt (R3 render suppression). */}
          {card.callbackEcho ? (
            <CallbackEchoStrip echo={card.callbackEcho} onOpenOrigin={props.onOpenPriorRoom} />
          ) : null}

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
              // UX-FLAGS-004 (#836) — actionable only on another author active
              // move for a participant (SAME gate as the ghost bar below). Absent
              // => inert pills (byte-identical). card.isActive is already true here.
              onFlagIntent={
                props.onFlagIntent && !card.isOwn && card.actionRow.kind === 'participant'
                  ? props.onFlagIntent
                  : undefined
              }
            />
          ) : null}
          {card.isActive ? <CardActionRow {...props} /> : null}
          {/* FEEDBACK-001 (#898) — the ghost feedback bar under the ACTIVE
              opponent move only. Gated: flag on + not your own move + you are a
              participant (never an observer). Flag off / observer / own move =>
              nothing renders (byte-identical). */}
          {card.isActive
          && props.moveMarksEnabled
          && !card.isOwn
          && card.actionRow.kind === 'participant'
          && props.viewerMoveMarksFor
          && props.onMarkMove
          && props.onUnmarkMove ? (
            <BooleanFeedbackBar
              argumentId={card.messageId}
              viewerState={props.viewerMoveMarksFor(card.messageId)}
              showReceiptsRequested={props.showMoveMarkReceiptsFor?.(card.messageId) ?? false}
              errorMessage={props.moveMarkErrorFor?.(card.messageId)}
              onMark={props.onMarkMove}
              onUnmark={props.onUnmarkMove}
              reduceMotion={props.reduceMotion}
              testID={`ringside-feedback-bar-${card.messageId}`}
            />
          ) : null}
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
    backgroundColor: SURFACE_TOKENS.elevated,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    marginVertical: 4,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  cardActive: {
    borderColor: '#6366f1',
    backgroundColor: SURFACE_TOKENS.overlay,
  },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  spine: { width: 5 },
  content: { flex: 1, paddingVertical: 10, paddingHorizontal: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  kindLabel: { fontSize: 12, fontWeight: '800', textTransform: 'lowercase' },
  headerMeta: { color: '#cbd5e1', fontSize: 12, fontWeight: '700' },
  headerTime: { color: SURFACE_TOKENS.textMuted, fontSize: 11, marginLeft: 'auto' },
  quoteChip: {
    marginTop: 8,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#475569',
    backgroundColor: CHIP_TINT.quote,
    minHeight: 32,
    justifyContent: 'center',
  },
  quoteChipText: { color: SURFACE_TOKENS.textSecondary, fontSize: 12, fontStyle: 'italic' },
  body: { color: SURFACE_TOKENS.textPrimary, fontSize: 15, lineHeight: 21, marginTop: 8 },
  // MARK-002 — reply reference chips + the Respond to this affordance.
  markerReplyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'center' },
  respondToThis: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    backgroundColor: CHIP_TINT.quote,
    minHeight: 32,
    minWidth: 44,
    justifyContent: 'center',
  },
  respondToThisText: { color: '#a5b4fc', fontSize: 12, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' },
  proofChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: CHIP_TINT.proof,
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
    backgroundColor: SURFACE_TOKENS.elevated,
    minHeight: 28,
    justifyContent: 'center',
  },
  owedChipText: { color: '#5eead4', fontSize: 11, fontWeight: '700' },
  branchPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.inputBorder,
    backgroundColor: CHIP_TINT.quote,
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
