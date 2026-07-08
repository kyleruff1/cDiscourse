/**
 * HOME-001 (#874) — ArgumentCard.tsx
 *
 * One opponent-forward dispute row on the ArgumentHome ("Your table") surface:
 * identity avatar + starter/opponent name FIRST, then the awaited-move excerpt,
 * a compact ConversationMiniTimeline, and exactly one verb (the entry-hint
 * verb phrase). The whole card is a single Pressable.
 *
 * Doctrine (cdiscourse-doctrine §1/§10a + accessibility-targets):
 *   - The opponent name/avatar is an ADDRESS, never a label or verdict.
 *   - No standing / band / winner / score is rendered (the reserved card
 *     placeholder fields stay unread).
 *   - The VERB text (not color) is the color-independent action signal; the
 *     your-turn gold ring is always paired with the verb + a neutral state word.
 *   - >= 44x44 hit target, role=button, a verbose one-shot accessibilityLabel,
 *     reduce-motion safe (a STATIC ring, never a pulse).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  deriveGalleryEntryHint,
  type ConversationGalleryCard,
  type GalleryEntryHint,
} from '../debates/conversationGalleryModel';
import { ConversationMiniTimeline } from '../debates/ConversationMiniTimeline';
import { InitialsAvatar } from '../account/InitialsAvatar';
import { HOME_COPY } from '../arguments/gameCopy';
import { SURFACE_TOKENS, BRAND, TOUCH_TARGET } from '../../lib/designTokens';

export type ArgumentCardState = 'your_turn' | 'waiting' | 'resting' | 'observer';

export interface ArgumentCardProps {
  card: ConversationGalleryCard;
  entryHint: GalleryEntryHint;
  viewerId: string | null;
  state: ArgumentCardState;
  onPress: () => void;
}

/** Convenience: derive the entry hint if a caller does not pass one. */
export function entryHintForCard(card: ConversationGalleryCard): GalleryEntryHint {
  return deriveGalleryEntryHint(card);
}

export function ArgumentCard({
  card,
  entryHint,
  state,
  onPress,
}: ArgumentCardProps): React.ReactElement {
  const stateWord = HOME_COPY.cardState[state];
  const verb = entryHint.verbPhrase;
  const excerpt = card.latestPostExcerpt || card.firstPostExcerpt || '';
  const isYourTurn = state === 'your_turn';

  // One-shot verbose label: verb, who, what is awaited, and the state word.
  const accessibilityLabel =
    `${verb}: ${card.starterDisplayName}` +
    (excerpt ? ` — ${excerpt}` : '') +
    `, ${stateWord}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{}}
      hitSlop={TOUCH_TARGET.hitSlopCompact}
      style={({ pressed }) => [
        styles.card,
        isYourTurn && styles.cardYourTurn,
        pressed && styles.cardPressed,
      ]}
      testID={`argument-card-${card.debateId}`}
    >
      <View style={styles.headerRow}>
        <InitialsAvatar displayName={card.starterDisplayName} seed={card.debateId} size={40} />
        <View style={styles.nameWrap}>
          <Text style={styles.name} numberOfLines={1}>
            {card.starterDisplayName}
          </Text>
          <Text style={[styles.stateWord, state === 'resting' && styles.stateWordMuted]}>
            {stateWord}
          </Text>
        </View>
        {/* The verb is the color-independent action signal. */}
        <View style={[styles.verbPill, isYourTurn && styles.verbPillYourTurn]}>
          <Text
            style={[styles.verbText, isYourTurn && styles.verbTextYourTurn]}
            testID={`argument-card-verb-${card.debateId}`}
          >
            {verb}
          </Text>
        </View>
      </View>

      {excerpt ? (
        <Text style={styles.excerpt} numberOfLines={2}>
          {excerpt}
        </Text>
      ) : null}

      {card.timelinePreviewSegments.length > 0 ? (
        <ConversationMiniTimeline
          segments={card.timelinePreviewSegments}
          unresolved={Boolean(card.unresolvedReason)}
          resolved={Boolean(
            card.stopReason && /synthesis|concession|resolved/i.test(card.stopReason),
          )}
          accessibilityPrefix={card.starterDisplayName}
          height={24}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: TOUCH_TARGET.minSizePx,
    backgroundColor: SURFACE_TOKENS.elevated,
    borderColor: SURFACE_TOKENS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 8,
  },
  // Static gold ring — reduce-motion safe (a border, never a pulse). The ring
  // is never the ONLY signal: the verb + the "Your turn" state word carry it.
  cardYourTurn: {
    borderColor: BRAND.accent.goldBorder,
    borderWidth: 2,
    backgroundColor: BRAND.accent.goldSoft,
  },
  cardPressed: {
    opacity: 0.85,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nameWrap: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  stateWord: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  stateWordMuted: {
    color: SURFACE_TOKENS.textMuted,
  },
  verbPill: {
    backgroundColor: SURFACE_TOKENS.raised,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  verbPillYourTurn: {
    backgroundColor: 'transparent',
    borderColor: BRAND.accent.goldBorder,
    borderWidth: 1,
  },
  verbText: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  verbTextYourTurn: {
    color: BRAND.accent.gold,
  },
  excerpt: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
