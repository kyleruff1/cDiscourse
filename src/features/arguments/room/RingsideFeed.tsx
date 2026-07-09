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
}

export function RingsideFeed(props: RingsideFeedProps) {
  const { feed } = props;
  return (
    <View style={styles.feed} testID="ringside-feed">
      {feed.cards.map((card) => (
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
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  feed: { flexDirection: 'column', paddingVertical: 4 },
});
