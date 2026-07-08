/**
 * ROOM-001 (#876) — ArgumentStateRail (presentational).
 *
 * The ambient room-state strip that mounts once atop the argument room in both
 * lenses (Exchange and Map). It renders a pure model built upstream by
 * deriveArgumentStateRail; it performs no fetch, makes no derivation, and writes
 * nothing. Chip taps invoke supplied in-app callbacks (never a URL / route).
 *
 * Doctrine (cdiscourse-doctrine): the strip shows counts of open points and
 * receipts owed on the ARGUMENT and a neutral turn / visibility / seat cue. No
 * score, band, winner, loser, heat, or popularity value appears. The turn cue is
 * informational, never a lock.
 *
 * Accessibility (accessibility-targets):
 *   - Every interactive chip is a Pressable with accessibilityRole="button", a
 *     verbose accessibilityLabel, and accessibilityState; 44px target via
 *     minHeight + hitSlop.
 *   - Informational chips (the turn cue; the visibility / seat chip when no
 *     details callback is supplied) are non-pressable Views with a text label.
 *   - Colour is never the only signal — a per-kind glyph plus the chip text
 *     carry meaning in grayscale.
 *   - The chip row lives in its OWN horizontal ScrollView so the strip scrolls
 *     while the page body never overflows horizontally.
 *   - reduceMotion suppresses the non-essential press-opacity feedback.
 *
 * No new dependency — RN primitives only. Comments here are apostrophe-free.
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BRAND, TOUCH_TARGET } from '../../../lib/designTokens';
import {
  formatStateRailOverflowLabel,
  formatStateRailOverflowAccessibilityLabel,
  type ArgumentStateRailModel,
  type StateRailChip,
  type StateRailChipKind,
  type StateRailDeepLink,
} from './argumentStateRailModel';

interface Props {
  model: ArgumentStateRailModel;
  /** open_points chip → in-app setMode('timeline'). */
  onOpenMap?: () => void;
  /** receipts_owed chip → reveal the debt / points surface. */
  onOpenDebts?: () => void;
  /** visibility / seat chip → the room-details panel. */
  onOpenRoomDetails?: () => void;
  reduceMotion?: boolean;
  testID?: string;
}

/** Per-kind glyph. Supplementary to the text label (color is never the only signal). */
const CHIP_GLYPH: Record<StateRailChipKind, string> = {
  turn: '➤',
  open_points: '◆',
  receipts_owed: '❖',
  visibility: '◈',
  seat: '☐',
  saved_recordings: '',
};

/** The private visibility chip swaps the glyph to the lock. */
const PRIVATE_VISIBILITY_GLYPH = '🔒';

function resolveHandler(
  deepLink: StateRailDeepLink,
  handlers: { onOpenMap?: () => void; onOpenDebts?: () => void; onOpenRoomDetails?: () => void },
): (() => void) | undefined {
  if (deepLink === 'map') return handlers.onOpenMap;
  if (deepLink === 'debts') return handlers.onOpenDebts;
  if (deepLink === 'details') return handlers.onOpenRoomDetails;
  return undefined;
}

function ChipView({
  chip,
  testID,
  onPress,
  reduceMotion,
}: {
  chip: StateRailChip;
  testID: string;
  onPress?: () => void;
  reduceMotion?: boolean;
}) {
  const isPrivate = chip.id === 'visibility' && chip.tone === 'private_gold';
  const glyph = isPrivate ? PRIVATE_VISIBILITY_GLYPH : CHIP_GLYPH[chip.id];
  const toneChipStyle =
    chip.tone === 'private_gold'
      ? styles.chipPrivate
      : chip.tone === 'attention'
        ? styles.chipAttention
        : styles.chipNeutral;
  const toneTextStyle =
    chip.tone === 'private_gold'
      ? styles.chipTextPrivate
      : chip.tone === 'attention'
        ? styles.chipTextAttention
        : styles.chipTextNeutral;

  // Interactive only when a deep-link handler is actually supplied. Otherwise
  // the chip is informational (a non-pressable View with a text label).
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={chip.accessibilityLabel}
        accessibilityState={{ disabled: false }}
        hitSlop={TOUCH_TARGET.hitSlopCompact}
        testID={testID}
        style={({ pressed }) => [
          styles.chip,
          toneChipStyle,
          pressed && !reduceMotion && styles.chipPressed,
        ]}
      >
        <Text style={styles.glyph} accessibilityElementsHidden importantForAccessibility="no">
          {glyph.length > 0 ? `${glyph} ` : ''}
        </Text>
        <Text style={[styles.chipText, toneTextStyle]} numberOfLines={1}>
          {chip.label}
        </Text>
      </Pressable>
    );
  }

  return (
    <View
      style={[styles.chip, toneChipStyle]}
      accessibilityLabel={chip.accessibilityLabel}
      testID={testID}
    >
      <Text style={styles.glyph} accessibilityElementsHidden importantForAccessibility="no">
        {glyph.length > 0 ? `${glyph} ` : ''}
      </Text>
      <Text style={[styles.chipText, toneTextStyle]} numberOfLines={1}>
        {chip.label}
      </Text>
    </View>
  );
}

/**
 * The ambient state rail. Renders nothing when the model has no chips (a
 * defensive calm default; the model always emits at least the turn chip).
 */
export function ArgumentStateRail({
  model,
  onOpenMap,
  onOpenDebts,
  onOpenRoomDetails,
  reduceMotion,
  testID = 'argument-state-rail',
}: Props) {
  if (!model || model.chips.length === 0) return null;
  const handlers = { onOpenMap, onOpenDebts, onOpenRoomDetails };

  return (
    <View style={styles.root} accessibilityLabel={model.accessibilityLabel} testID={testID}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        testID={`${testID}-scroll`}
      >
        {model.chips.map((chip) => {
          const handler = resolveHandler(chip.deepLink, handlers);
          return (
            <ChipView
              key={chip.id}
              chip={chip}
              testID={`${testID}-chip-${chip.id}`}
              onPress={handler}
              reduceMotion={reduceMotion}
            />
          );
        })}
      </ScrollView>
      {model.overflowCount > 0 ? (
        <View
          style={styles.overflowBadge}
          accessibilityLabel={formatStateRailOverflowAccessibilityLabel(model.overflowCount)}
          testID={`${testID}-overflow`}
        >
          <Text style={styles.overflowText}>{formatStateRailOverflowLabel(model.overflowCount)}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b1220',
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  scroll: {
    flexShrink: 1,
    flexGrow: 1,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_TARGET.minSizePx,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipNeutral: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
  },
  chipAttention: {
    backgroundColor: '#1e293b',
    borderColor: '#4f6ba8',
  },
  chipPrivate: {
    backgroundColor: BRAND.accent.goldSoft,
    borderColor: BRAND.accent.goldBorder,
  },
  chipPressed: {
    opacity: 0.7,
  },
  glyph: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '800',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextNeutral: { color: '#e2e8f0' },
  chipTextAttention: { color: '#dbe6ff' },
  chipTextPrivate: { color: BRAND.accent.gold },
  overflowBadge: {
    minHeight: TOUCH_TARGET.minSizePx,
    justifyContent: 'center',
    paddingHorizontal: 10,
    marginLeft: 6,
  },
  overflowText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '800',
  },
});
