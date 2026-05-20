/**
 * RULE-005 — ChannelChipRow.
 *
 * A horizontally-scrolling, single-select radio group of channel chips
 * rendered by `ArgumentComposerDock` directly below the handle strip. The
 * suggested chip carries a text "Suggested" affordance (not color-only),
 * a one-line rationale renders under the row, and — when the user's pick
 * differs from the suggestion — a non-punitive re-route advisory with a
 * "Switch channel" action appears. Nothing here ever blocks a post.
 *
 * Doctrine / accessibility (RULE-005 design §4 / §5.5 / §12):
 *  - Every chip is a `Pressable` with `accessibilityRole="radio"`,
 *    `accessibilityState={{ selected }}`, an `accessibilityLabel`, and a
 *    ≥ 44×44 hit target (via `hitSlop`).
 *  - The "Suggested" affordance is text + shape, never color alone. The
 *    suggested chip's `accessibilityLabel` includes ", suggested".
 *  - The re-route advisory is advisory: tapping "Switch channel" sets the
 *    channel; ignoring it does nothing — the post is never blocked.
 *  - `reduceMotionOverride` is threaded by the dock; the chip row has no
 *    non-essential animation, so reduce-motion is a documented no-op here
 *    (the affordance is static text/shape — there is nothing to snap).
 *
 * The load-bearing decisions (chip label, accessibility label, advisory
 * visibility, hit slop) are extracted into pure helpers below so they are
 * unit-testable without an RN renderer (the repo's ReceiptChip pattern).
 */
import React, { type ReactElement } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  getChannelLabel,
  type ChannelSuggestion,
  type MoveChannel,
} from './channelModel';

export interface ChannelChipRowProps {
  /** The pickable channels. Pass `ACTIVE_MOVE_CHANNELS`. */
  channels: ReadonlyArray<MoveChannel>;
  /** The channel the user has selected, if any. */
  selectedChannel: MoveChannel | null;
  /** The deterministic suggestion from `suggestChannelFromDraft`. */
  suggestion: ChannelSuggestion;
  /** Called when the user taps a chip. */
  onSelectChannel: (channel: MoveChannel) => void;
  /**
   * Threaded by the dock. The chip row has no non-essential animation, so
   * this is currently a documented no-op — kept on the prop contract for
   * forward-compatibility and parity with the dock's other children.
   */
  reduceMotionOverride?: boolean;
}

/** Hit-slop the chips use so the effective tap target reaches ≥ 44×44. */
export const CHANNEL_CHIP_HIT_SLOP = Object.freeze({
  top: 12,
  bottom: 12,
  left: 8,
  right: 8,
});

/** The static text affordance shown on the suggested chip. */
export const SUGGESTED_AFFORDANCE_TEXT = 'Suggested';

/** The re-route action label. */
export const SWITCH_CHANNEL_ACTION_LABEL = 'Switch channel';

// ── Pure helpers (also consumed by tests) ─────────────────────

/** True when `channel` is the suggested channel. Pure. */
export function isSuggestedChannel(
  channel: MoveChannel,
  suggestion: ChannelSuggestion,
): boolean {
  return suggestion.suggested === channel;
}

/**
 * Build the accessibility label for one chip. Includes the plain label,
 * the selected state, and ", suggested" when the chip is the suggestion.
 * Pure — no React.
 */
export function buildChannelChipAccessibilityLabel(
  channel: MoveChannel,
  selected: boolean,
  suggestion: ChannelSuggestion,
): string {
  const parts = [getChannelLabel(channel), 'channel'];
  if (selected) parts.push('selected');
  if (isSuggestedChannel(channel, suggestion)) parts.push('suggested');
  return parts.join(', ');
}

/**
 * Whether the re-route advisory should render. True only when the user
 * has picked a channel that differs from the suggestion. Pure.
 */
export function shouldShowRerouteAdvisory(suggestion: ChannelSuggestion): boolean {
  return suggestion.isMismatch === true;
}

/**
 * The advisory text shown when the user's pick differs from the
 * suggestion. Non-punitive: it describes the move shape via the
 * suggestion's own rationale, never the person. Pure.
 */
export function buildRerouteAdvisoryText(suggestion: ChannelSuggestion): string {
  return `${suggestion.rationale} Switch to ${getChannelLabel(suggestion.suggested)}?`;
}

// ── Component ──────────────────────────────────────────────────

export function ChannelChipRow({
  channels,
  selectedChannel,
  suggestion,
  onSelectChannel,
  // reduce-motion is a documented no-op for this static row; see header.
  reduceMotionOverride: _reduceMotionOverride,
}: ChannelChipRowProps): ReactElement {
  const showAdvisory = shouldShowRerouteAdvisory(suggestion);

  return (
    <View style={styles.wrapper} testID="channel-chip-row">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        accessibilityRole="radiogroup"
      >
        {channels.map((channel) => {
          const selected = selectedChannel === channel;
          const suggested = isSuggestedChannel(channel, suggestion);
          return (
            <Pressable
              key={channel}
              onPress={() => onSelectChannel(channel)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={buildChannelChipAccessibilityLabel(
                channel,
                selected,
                suggestion,
              )}
              hitSlop={CHANNEL_CHIP_HIT_SLOP}
              style={[
                styles.chip,
                selected ? styles.chipSelected : null,
                suggested ? styles.chipSuggested : null,
              ]}
              testID={`channel-chip-${channel}`}
            >
              <Text
                style={[styles.chipLabel, selected ? styles.chipLabelSelected : null]}
                numberOfLines={1}
              >
                {getChannelLabel(channel)}
              </Text>
              {suggested ? (
                /* Text + shape affordance — never color alone. */
                <View style={styles.suggestedTag} testID={`channel-chip-${channel}-suggested`}>
                  <Text style={styles.suggestedTagText}>{SUGGESTED_AFFORDANCE_TEXT}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* One-line rationale — satisfies "user can always understand WHY". */}
      <Text style={styles.rationale} testID="channel-chip-row-rationale">
        {suggestion.rationale}
      </Text>

      {/* Non-punitive re-route advisory. Tapping it switches the channel;
          ignoring it does nothing — the post is never blocked. */}
      {showAdvisory ? (
        <View style={styles.advisoryRow} testID="channel-chip-row-advisory">
          <Text style={styles.advisoryText}>{buildRerouteAdvisoryText(suggestion)}</Text>
          <Pressable
            onPress={() => onSelectChannel(suggestion.suggested)}
            accessibilityRole="button"
            accessibilityLabel={`${SWITCH_CHANNEL_ACTION_LABEL} to ${getChannelLabel(
              suggestion.suggested,
            )}`}
            hitSlop={CHANNEL_CHIP_HIT_SLOP}
            style={styles.switchButton}
            testID="channel-chip-row-switch"
          >
            <Text style={styles.switchButtonText}>{SWITCH_CHANNEL_ACTION_LABEL}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingTop: 8,
    paddingBottom: 10,
  },
  scrollContent: {
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  chipSelected: {
    borderColor: '#1f2937',
    borderWidth: 2,
    backgroundColor: '#e2e8f0',
  },
  chipSuggested: {
    // Shape cue (heavier border) reinforces the text "Suggested" tag so
    // the affordance never depends on color alone.
    borderColor: '#4338ca',
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  chipLabelSelected: {
    color: '#0f172a',
    fontWeight: '700',
  },
  suggestedTag: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4338ca',
  },
  suggestedTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4338ca',
  },
  rationale: {
    marginTop: 8,
    paddingHorizontal: 14,
    fontSize: 12,
    color: '#475569',
  },
  advisoryRow: {
    marginTop: 8,
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    backgroundColor: '#eef2ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  advisoryText: {
    flex: 1,
    fontSize: 12,
    color: '#3730a3',
    marginRight: 8,
  },
  switchButton: {
    minHeight: 32,
    paddingHorizontal: 10,
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#4338ca',
  },
  switchButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
});
