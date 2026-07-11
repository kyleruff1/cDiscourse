/**
 * QUOTE-FORGE-002 (#842) — the rendered-node callback echo strip (presentational).
 *
 * The posted-move twin of #831 draft echo — same woven-callback vocabulary
 * (glyph + header + origin phrasing) so a draft echo and its posted node read
 * as one family. Rendered on the Stack card, the Ringside card, and node
 * popovers (the tiny Timeline node shows only a corner badge; the full strip
 * lives here).
 *
 * Doctrine: a LINK identity, never a verdict / standing / heat signal. Identity
 * is the glyph + text + left-border quote strip (color-independent). The
 * authorized excerpt renders only when present; title-only / unavailable render
 * the origin line alone (R3 render-time suppression, documented in the model as
 * NOT an RLS boundary). Reduce-motion N/A (static chrome).
 *
 * RN primitives only. No new dependency. Comments apostrophe-free.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CALLBACK_ECHO_COPY } from './callbackEchoCopy';
import type { CallbackEchoViewModel } from './callbackEchoModel';
import { RADIUS, SPACING, SURFACE_TOKENS, TOUCH_TARGET } from '../../../lib/designTokens';

export interface CallbackEchoStripProps {
  echo: CallbackEchoViewModel;
  /** Open the prior room. Reuses the QOL-042 nav channel (targetDebateId). */
  onOpenOrigin?: (targetDebateId: string) => void;
  /** Reserved for future variants; the strip is the only shape today. */
  variant?: 'strip';
}

export function CallbackEchoStrip({ echo, onOpenOrigin }: CallbackEchoStripProps) {
  const canOpen = echo.canOpenOrigin && echo.targetDebateId != null && !!onOpenOrigin;
  const originPrefix = echo.isLocked ? '🔒 ' : '';

  return (
    <View style={styles.container} testID="callback-echo-strip">
      <View style={styles.headerRow}>
        <Text style={styles.glyph} accessibilityElementsHidden>
          {echo.glyph}
        </Text>
        <Text style={styles.header}>{echo.identityLabel}</Text>
      </View>

      {echo.echoedExcerpt.length > 0 ? (
        <View style={styles.quoteStrip}>
          <Text style={styles.quoteText} numberOfLines={4} testID="callback-echo-strip-quote">
            {echo.echoedExcerpt}
          </Text>
        </View>
      ) : null}

      {echo.originLine.length > 0 ? (
        canOpen ? (
          <Pressable
            onPress={() => onOpenOrigin?.(echo.targetDebateId as string)}
            accessibilityRole="button"
            accessibilityLabel={echo.accessibilityLabel}
            accessibilityHint={CALLBACK_ECHO_COPY.openOriginA11yHint}
            hitSlop={TOUCH_TARGET.hitSlopAll}
            style={styles.originButton}
            testID="callback-echo-strip-origin"
          >
            <Text style={styles.originLink} numberOfLines={1}>
              {originPrefix}
              {echo.originLine}
            </Text>
          </Pressable>
        ) : (
          <Text
            style={styles.origin}
            numberOfLines={1}
            accessibilityLabel={echo.accessibilityLabel}
            accessibilityHint={echo.isLocked ? CALLBACK_ECHO_COPY.lockedA11yHint : undefined}
            testID="callback-echo-strip-origin"
          >
            {originPrefix}
            {echo.originLine}
          </Text>
        )
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
    color: SURFACE_TOKENS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
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
  originButton: {
    minHeight: TOUCH_TARGET.minSizePx,
    justifyContent: 'center',
  },
  originLink: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  origin: {
    color: SURFACE_TOKENS.textSecondary,
    fontSize: 12,
  },
});
