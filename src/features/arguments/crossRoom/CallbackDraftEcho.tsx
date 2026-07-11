/**
 * UX-COMPOSER-005 (#831) — the inline draft echo (presentational).
 *
 * Rendered in the entry composer above the input when the active draft carries
 * a pending cross-room callback. It is the pre-send twin of #842's posted-node
 * echo, so it shares the woven-callback vocabulary (the shared glyph + header +
 * origin phrasing from callbackComposerCopy / callbackCaptureModel) — a draft
 * echo and its posted node read as one family.
 *
 * Doctrine: the echo is a LINK identity, never a verdict / standing / heat
 * signal (cdiscourse-doctrine 1-3). Identity is carried by the glyph + text +
 * the left-border quote strip (color-independent, legible in grayscale). No
 * animation (reduce-motion N/A). The Remove control is a 44x44 Pressable.
 *
 * RN primitives only. No new dependency. Comments apostrophe-free.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { deriveCallbackEchoPreview } from './callbackCaptureModel';
import { CALLBACK_COMPOSER_COPY } from './callbackComposerCopy';
import type { CrossRoomCallback } from './crossRoomCallbackRef';
import { RADIUS, SPACING, SURFACE_TOKENS, TOUCH_TARGET } from '../../../lib/designTokens';

export interface CallbackDraftEchoProps {
  /** The pending callback attached to the active draft. */
  callback: CrossRoomCallback;
  /** Remove the attached callback before send. */
  onRemove?: () => void;
}

export function CallbackDraftEcho({ callback, onRemove }: CallbackDraftEchoProps) {
  const preview = deriveCallbackEchoPreview(callback);
  return (
    <View style={styles.container} testID="callback-draft-echo">
      <View style={styles.headerRow}>
        <Text style={styles.glyph} accessibilityElementsHidden>
          {preview.glyph}
        </Text>
        <Text style={styles.header}>{preview.header}</Text>
        {onRemove ? (
          <Pressable
            onPress={onRemove}
            accessibilityRole="button"
            accessibilityLabel={preview.removeA11yLabel}
            hitSlop={TOUCH_TARGET.hitSlopAll}
            style={styles.remove}
            testID="callback-draft-echo-remove"
          >
            <Text style={styles.removeLabel}>{CALLBACK_COMPOSER_COPY.echoRemoveLabel}</Text>
          </Pressable>
        ) : null}
      </View>
      {preview.quotedLine.length > 0 ? (
        <View style={styles.quoteStrip}>
          <Text style={styles.quoteText} numberOfLines={3} testID="callback-draft-echo-quote">
            {preview.quotedLine}
          </Text>
        </View>
      ) : null}
      {preview.originLine.length > 0 ? (
        <Text style={styles.origin} numberOfLines={1} testID="callback-draft-echo-origin">
          {preview.originLine}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    borderLeftWidth: 3,
    borderRadius: RADIUS.md,
    backgroundColor: SURFACE_TOKENS.inputBg,
    paddingHorizontal: SPACING.m,
    paddingVertical: SPACING.s,
    gap: SPACING.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  glyph: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  header: {
    flex: 1,
    color: SURFACE_TOKENS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  remove: {
    minHeight: TOUCH_TARGET.minSizePx,
    minWidth: TOUCH_TARGET.minSizePx,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  removeLabel: {
    color: SURFACE_TOKENS.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  quoteStrip: {
    borderLeftWidth: 2,
    borderLeftColor: SURFACE_TOKENS.border,
    paddingLeft: SPACING.s,
  },
  quoteText: {
    color: SURFACE_TOKENS.textPrimary,
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  origin: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: 12,
  },
});
