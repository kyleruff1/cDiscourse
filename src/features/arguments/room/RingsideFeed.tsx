/**
 * ROOM-002 (#885) — RingsideFeed.
 *
 * The transform-free linear back-and-forth of move cards that re-weights the
 * Exchange lens away from the z-stacked bubble deck. It owns NO state and NO
 * derivation: every value is a prop from the orchestrator (ArgumentRoom). It
 * maps the projected feed cards to RingsideCard and hands the active card its
 * calm friendly-flag row.
 *
 * Doctrine: no transforms (reduce-motion satisfied by construction); the
 * active card carries the ONE actor-aware action row; the card face stays
 * conversation-first (standing / heat / classifier detail live behind the
 * shared Inspect popout + the Map sidecar). All comments apostrophe-free for
 * the uxOneOneTwoDoctrine scanner.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ArgumentBubbleControl } from '../argumentGameSurfaceModel';
import type { RailActionCode, RailViewerRole } from '../railActionCategories';
import type { PrioritizedPointFeedbackFlags } from '../../feedbackFlags';
import type { RingsideFeedViewModel } from './ringsideFeedModel';
import { RingsideCard } from './RingsideCard';
// MARK-002 (#894) — per-card marker maps threaded from the orchestrator (all
// additive optional; absent when timestamp_rebuttals is off => byte-identical).
import type { MarkerRow } from '../markers/timestampMarkerModel';
// FEEDBACK-001 (#898) — ghost feedback bar props, forwarded straight to the
// active card (all additive optional; absent when move_marks is off).
import type { MoveMarkCode, ViewerMoveMarkState } from '../../feedback/moveMarksModel';

export interface RingsideFeedProps {
  feed: RingsideFeedViewModel;
  viewerRole: RailViewerRole;
  onActivate: (messageId: string) => void;
  onActivateAncestor: (messageId: string) => void;
  onCardAction: (control: ArgumentBubbleControl, messageId: string) => void;
  onRailAction: (code: RailActionCode, ctx: { activeMessageId: string | null }) => void;
  /** Branch-pill deep-link to the Map lens. */
  onOpenMap: () => void;
  /** Active-card calm friendly-flag row. */
  pointFeedbackFlags: PrioritizedPointFeedbackFlags | null;
  reduceMotion?: boolean;
  /** MARK-002 — markers grouped by the quoted (target) argument id. */
  markersByTargetId?: Record<string, ReadonlyArray<MarkerRow>>;
  /** MARK-002 — markers grouped by the reply that consumed them. */
  markersByReplyId?: Record<string, ReadonlyArray<MarkerRow>>;
  /** MARK-002 — is a markers target loaded (drives the orphaned tombstone)? */
  isMarkerTargetLoaded?: (targetArgumentId: string) => boolean;
  /** MARK-002 — open the phrase picker for a non-own card. */
  onRespondToThis?: (messageId: string) => void;
  /** MARK-002 — deep-link a reply chip to its quoted source span. */
  onOpenMarkerSource?: (targetArgumentId: string, markerId: string) => void;
  /** FEEDBACK-001 — ghost feedback bar props (forwarded to the active card). */
  moveMarksEnabled?: boolean;
  viewerMoveMarksFor?: (argumentId: string) => ViewerMoveMarkState;
  moveMarkErrorFor?: (argumentId: string) => string | undefined;
  showMoveMarkReceiptsFor?: (argumentId: string) => boolean;
  onMarkMove?: (argumentId: string, code: MoveMarkCode) => void;
  onUnmarkMove?: (argumentId: string, code: MoveMarkCode) => void;
}

export function RingsideFeed(props: RingsideFeedProps) {
  const { feed } = props;
  return (
    <View style={styles.feed} testID="ringside-feed">
      {feed.cards.map((card) => {
        // MARK-002 — the union of markers quoting this card (source-span) and
        // markers this card carries as a reply (reference chips). Empty when the
        // feature is off (both maps absent), so the card is byte-identical.
        const forTarget = props.markersByTargetId?.[card.messageId] ?? [];
        const forReply = props.markersByReplyId?.[card.messageId] ?? [];
        const markersForCard =
          forTarget.length === 0 && forReply.length === 0 ? undefined : [...forTarget, ...forReply];
        return (
          <RingsideCard
            key={card.messageId}
            card={card}
            total={feed.cards.length}
            onActivate={props.onActivate}
            onActivateAncestor={props.onActivateAncestor}
            onCardAction={props.onCardAction}
            onRailAction={props.onRailAction}
            onOpenMap={props.onOpenMap}
            pointFeedbackFlags={card.isActive ? props.pointFeedbackFlags : null}
            reduceMotion={props.reduceMotion}
            markersForCard={markersForCard}
            isMarkerTargetLoaded={props.isMarkerTargetLoaded}
            onRespondToThis={props.onRespondToThis}
            onOpenMarkerSource={props.onOpenMarkerSource}
            moveMarksEnabled={props.moveMarksEnabled}
            viewerMoveMarksFor={props.viewerMoveMarksFor}
            moveMarkErrorFor={props.moveMarkErrorFor}
            showMoveMarkReceiptsFor={props.showMoveMarkReceiptsFor}
            onMarkMove={props.onMarkMove}
            onUnmarkMove={props.onUnmarkMove}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  feed: { flexDirection: 'column', paddingVertical: 4 },
});
