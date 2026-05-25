/**
 * BRAND-001 / UX-001.1 — Global CivilDiscourse app header.
 *
 * Stage 1 (PR #55 / commit abba2e8): persistent top-of-page chrome
 * with the cream-on-black logo on the left and an optional right
 * slot. Tapping the logo dispatches a state-only deselect.
 *
 * Stage 2 (PR #55 / commit aa50630): the logo grew to 110px at wide
 * viewports (>= 720dp) inside a 152px header, with the tagline
 * "Just get to the bottom of it" rendered next to / under the logo
 * via `AppHeaderTagline`. Narrow viewports kept the Stage 1 64px
 * header. A 1px cream-hairline divider replaced the Stage 1 solid
 * `appElevated` border.
 *
 * UX-001.1 (this card): logo + header heights are now band-aware
 * (phone 44/64, tablet 80/96, wide 96/120) per the new
 * 3-band breakpoint. The wide header is tightened from 152 -> 120 to
 * satisfy the epic's "header height does not bury the active board"
 * non-negotiable; tablet gains an intermediate 96px header. The
 * wordmark fallback now reads its `fontSize` / `lineHeight` /
 * `fontWeight` / `letterSpacing` from `BRAND.typography.wordmarkFallback`
 * per band (replacing the prior inline `fontSize: 18` / `fontSize: 28`
 * literals). The home pressable gains a per-band `minWidth`
 * (120 / 200 / 240) so the brand+nav group is visibly larger on
 * tablet+wide.
 *
 * Stays state-only — no router, no navigation. Preserves the TL-003
 * no-route invariant.
 *
 * The logo is a regular `Image` source — no `react-native-svg`. If the
 * PNG asset is missing for any reason, the header falls back to a
 * text-only `CivilDiscourse` cream wordmark so the rest of the app
 * still renders. The fallback honors the breakpoint band via the
 * `BRAND.typography.wordmarkFallback[band]` size.
 */
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { TextStyle } from 'react-native';
import { BRAND } from '../lib/designTokens';
import type { Band } from '../hooks/useHeaderBreakpoint';
import { useHeaderBreakpoint } from '../hooks/useHeaderBreakpoint';
import { AppHeaderTagline, APP_HEADER_TAGLINE_TEXT } from './AppHeaderTagline';

interface Props {
  /** Called when the user taps the logo / brand area. */
  onHomePress?: () => void;
  /** Optional content rendered at the right edge of the header. */
  rightSlot?: React.ReactNode;
  /**
   * Inject the resolved asset module for testing. The default uses the
   * canonical PNG at `assets/branding/civic-discourse-logo.png`.
   */
  logoSource?: React.ComponentProps<typeof Image>['source'];
}

// Hoist the default require so the bundler resolves the asset once.
const DEFAULT_LOGO = require('../../assets/branding/civic-discourse-logo.png');

// BRAND-001 — composed accessibility label for screen readers. The
// home pressable groups the logo + tagline into a single utterance so
// VoiceOver / TalkBack reads "CivilDiscourse, Just get to the bottom
// of it, button" exactly once.
const HOME_ACCESSIBILITY_LABEL = `CivilDiscourse, ${APP_HEADER_TAGLINE_TEXT}`;

/**
 * UX-001.1 — Per-band `minWidth` for the home pressable. Makes the
 * brand+nav group visibly larger on tablet+wide. All three values
 * meet the 44dp horizontal hit-target bar with the 8dp left+right
 * hitSlop (120+16, 200+16, 240+16 all >= 44).
 */
function getHomePressableMinWidth(band: Band): number {
  switch (band) {
    case 'phone':
      return 120;
    case 'tablet':
      return 200;
    case 'wide':
      return 240;
  }
}

export function AppHeader({ onHomePress, rightSlot, logoSource }: Props) {
  const source = logoSource ?? DEFAULT_LOGO;
  const { band, logoHeightPx, headerHeightPx } = useHeaderBreakpoint();
  // UX-001.1 — `inline` on tablet + wide; `stacked` on phone. Functionally
  // equivalent to the prior `isWide ? 'inline' : 'stacked'` because the
  // new `isWide` semantic is also `band !== 'phone'`, but reading
  // `band` directly makes the intent explicit.
  const taglineVariant = band === 'phone' ? 'stacked' : 'inline';
  // The home pressable wraps both the logo + tagline so the accessible
  // group reads as a single button. Inner alignment changes by
  // breakpoint — row for tablet+wide, column for phone.
  const homeInnerStyle = band === 'phone' ? styles.homeInnerStacked : styles.homeInnerInline;
  const homePressableStyle = [styles.homePressable, { minWidth: getHomePressableMinWidth(band) }];
  const wordmarkFallbackStyle: TextStyle = BRAND.typography.wordmarkFallback[band];

  return (
    <View
      style={[styles.root, { height: headerHeightPx }]}
      accessibilityRole="header"
      accessibilityLabel="CivilDiscourse"
      testID="app-header"
    >
      <Pressable
        onPress={onHomePress}
        accessibilityRole="button"
        accessibilityLabel={HOME_ACCESSIBILITY_LABEL}
        accessibilityHint="Returns to the conversation gallery"
        testID="app-header-home"
        // BRAND-001 Stage 2 / UX-001.1: hitSlop preserves a >= 44 x 44
        // effective touch target across all bands. Phone: 44+8+8=60 vertical,
        // 120+8+8=136 horizontal. Tablet: 80+8+8=96 vertical,
        // 200+8+8=216 horizontal. Wide: 96+8+8=112 vertical,
        // 240+8+8=256 horizontal.
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={homePressableStyle}
      >
        <View style={homeInnerStyle}>
          {source ? (
            <Image
              source={source}
              style={{ height: logoHeightPx }}
              resizeMode="contain"
              accessibilityLabel="CivilDiscourse"
              accessible
              testID="app-header-logo-image"
            />
          ) : (
            <Text
              style={[styles.wordmarkFallback, wordmarkFallbackStyle]}
              testID="app-header-logo-fallback"
            >
              CivilDiscourse
            </Text>
          )}
          <AppHeaderTagline variant={taglineVariant} />
        </View>
      </Pressable>
      <View style={styles.rightSlot} testID="app-header-right-slot">
        {rightSlot ?? null}
      </View>
      <View
        style={styles.divider}
        testID="app-header-divider"
        // Decorative; do not announce as a separate element.
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </View>
  );
}

export const APP_HEADER_HEIGHT = BRAND.headerHeightPx;

const styles = StyleSheet.create({
  root: {
    backgroundColor: BRAND.surface.app.bg,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // The hairline divider lives inside the root as an absolutely
    // positioned 1px line so resizing between breakpoints does not
    // shift the layout. No shadow — keeps the header flat and avoids
    // FCP regression on web.
    position: 'relative',
  },
  homePressable: {
    // UX-001.1 — `minWidth` now flows in inline per band via
    // getHomePressableMinWidth(band); the StyleSheet entry keeps the
    // shared center-axis justification.
    justifyContent: 'center',
  },
  homeInnerInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  homeInnerStacked: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  // UX-001.1 — color only; per-band fontSize / lineHeight / fontWeight /
  // letterSpacing now come from BRAND.typography.wordmarkFallback[band].
  wordmarkFallback: {
    color: BRAND.text.primary,
  },
  rightSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  divider: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    backgroundColor: BRAND.accent.creamHairline,
  },
});
