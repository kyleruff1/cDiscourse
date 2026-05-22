/**
 * MCP-019 — RefereeBannerView: the deferred MCP-014 render component.
 *
 * A thin, non-blocking `<View>`/`<Text>` strip that renders ONE
 * `BannerSelectionResult.banner`. MCP-014 §"Out of scope" explicitly deferred
 * this component; MCP-019 is its home.
 *
 * It renders only fields the banner already carries — `headline`,
 * `helperLine`, `accessibilityLabel`, `toneGlyph`. It authors ZERO new
 * user-facing strings, so it cannot introduce a banned token; a ban-list test
 * still scans its inputs as a backstop.
 *
 * RN primitives only — `View` / `Text` / `AccessibilityInfo`. No new
 * dependency. Renders NOTHING (`null`) when `banner` is null.
 *
 * Doctrine (MCP-019 §2, §8; accessibility-targets):
 *   - The banner is a strip, NOT a modal — it never blocks the composer.
 *   - Color is never the only signal: the `toneGlyph` is a shape glyph and the
 *     tone is in the `accessibilityLabel` words.
 *   - Reduce-motion: the strip appears statically — no slide / fade.
 */

import React, { useEffect } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import type { ViewStyle, TextStyle } from 'react-native';
import type { BannerSelectionResult, RefereeBannerTone, RefereeBannerToneGlyph } from './types';

/**
 * Non-color tone glyph — a SHAPE, never color-only. `star` celebrates, `arrow`
 * nudges, `branch` routes. Pure helper so a test can assert every glyph is a
 * non-empty geometric mark without rendering.
 */
export const BANNER_TONE_GLYPH_CHAR: Readonly<Record<RefereeBannerToneGlyph, string>> =
  Object.freeze({
    star: '★',
    arrow: '→',
    branch: '⑂',
  });

/**
 * Tone → accent color. Color is SUPPLEMENTARY — the glyph + the
 * accessibilityLabel words carry the meaning; this only tints the strip edge.
 */
const BANNER_TONE_ACCENT: Readonly<Record<RefereeBannerTone, string>> = Object.freeze({
  celebratory: '#34d399',
  nudge: '#fbbf24',
  routing_hint: '#a5b4fc',
});

/**
 * Pure style builder for the strip container. Exposed so a test can assert the
 * accent border (a non-color-only signal: a visible left border exists for
 * every tone) without mounting the component.
 */
export function buildRefereeBannerContainerStyle(tone: RefereeBannerTone): ViewStyle {
  return {
    ...styles.container,
    borderLeftColor: BANNER_TONE_ACCENT[tone],
  };
}

/** Pure style builder for the glyph badge. */
export function buildRefereeBannerGlyphStyle(tone: RefereeBannerTone): TextStyle {
  return {
    ...styles.glyph,
    color: BANNER_TONE_ACCENT[tone],
  };
}

interface Props {
  /** The MCP-014 selection result. `banner === null` → renders nothing. */
  result: BannerSelectionResult | null | undefined;
  /**
   * PR-001 — effective reduce-motion preference. When true the strip appears
   * statically (the component never animates regardless — this prop is
   * accepted for parity with the surface and for an explicit no-motion test).
   */
  reduceMotionOverride?: boolean;
}

/**
 * Render the referee banner strip, or nothing when no banner was selected.
 *
 * On appearance the component announces `banner.accessibilityLabel` once via
 * `AccessibilityInfo.announceForAccessibility` so a screen-reader user is told
 * the suggestion without it stealing focus.
 */
export function RefereeBannerView({ result, reduceMotionOverride }: Props) {
  const banner = result?.banner ?? null;
  const announce = banner?.accessibilityLabel ?? '';

  useEffect(() => {
    // Announce once per distinct banner. A null banner announces nothing.
    if (announce.length > 0) {
      AccessibilityInfo.announceForAccessibility(announce);
    }
  }, [announce]);

  // The reduce-motion prop is accepted for parity; the strip never animates,
  // so honoring it is a no-op. Referenced so lint does not flag it unused and
  // a test can assert the contract.
  void reduceMotionOverride;

  if (!banner) {
    return null;
  }

  return (
    <View
      style={buildRefereeBannerContainerStyle(banner.tone)}
      accessibilityRole="text"
      accessibilityLabel={banner.accessibilityLabel}
      testID="referee-banner-view"
    >
      <Text style={buildRefereeBannerGlyphStyle(banner.tone)} accessibilityElementsHidden>
        {BANNER_TONE_GLYPH_CHAR[banner.toneGlyph]}
      </Text>
      <View style={styles.textColumn}>
        <Text style={styles.headline} numberOfLines={2} testID="referee-banner-headline">
          {banner.headline}
        </Text>
        {banner.helperLine ? (
          <Text style={styles.helperLine} numberOfLines={2} testID="referee-banner-helper">
            {banner.helperLine}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 8,
    marginTop: 6,
    borderRadius: 8,
    borderLeftWidth: 3,
    backgroundColor: '#0b1220',
  },
  glyph: { fontSize: 14, fontWeight: '700' as const, lineHeight: 18 },
  textColumn: { flex: 1 },
  headline: { color: '#e2e8f0', fontSize: 12, fontWeight: '700' as const },
  helperLine: { color: '#94a3b8', fontSize: 11, fontWeight: '400' as const, marginTop: 2 },
});
