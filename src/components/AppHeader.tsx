/**
 * BRAND-001 — Global CivilDiscourse app header.
 *
 * Stage 1 (PR #55 / commit abba2e8): persistent top-of-page chrome
 * with the cream-on-black logo on the left and an optional right
 * slot. Tapping the logo dispatches a state-only deselect.
 *
 * Stage 2 (this card): the logo grows to a 110px height at wide
 * viewports (≥ 720dp) inside a 152px header, with the tagline
 * "Just get to the bottom of it" rendered next to / under the logo
 * via `AppHeaderTagline`. Narrow viewports keep the Stage 1 64px
 * header. A 1px cream-hairline divider replaces the Stage 1 solid
 * `appElevated` border so the header looks consciously designed
 * instead of "a logo nailed to the top".
 *
 * Stays state-only — no router, no navigation. Preserves the TL-003
 * no-route invariant.
 *
 * The logo is a regular `Image` source — no `react-native-svg`. If the
 * PNG asset is missing for any reason, the header falls back to a
 * text-only `CivilDiscourse` cream wordmark so the rest of the app
 * still renders. The fallback honors the wide breakpoint via a larger
 * font size.
 */
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BRAND } from '../lib/designTokens';
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

export function AppHeader({ onHomePress, rightSlot, logoSource }: Props) {
  const source = logoSource ?? DEFAULT_LOGO;
  const { isWide, logoHeightPx, headerHeightPx } = useHeaderBreakpoint();
  const taglineVariant = isWide ? 'inline' : 'stacked';
  // The home pressable wraps both the logo + tagline so the accessible
  // group reads as a single button. Inner alignment changes by
  // breakpoint — row for wide, column for stacked.
  const homeInnerStyle = isWide ? styles.homeInnerInline : styles.homeInnerStacked;

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
        // BRAND-001 Stage 2: hitSlop preserves a ≥ 44×44 effective
        // touch target even at the narrow 44px logo height (44 + 8 + 8
        // = 60 vertical, 120 + 8 + 8 = 136 horizontal min-width).
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.homePressable}
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
              style={[
                styles.wordmarkFallback,
                isWide ? styles.wordmarkFallbackWide : styles.wordmarkFallbackNarrow,
              ]}
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
    minWidth: 120,
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
  wordmarkFallback: {
    color: BRAND.text.primary,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  wordmarkFallbackNarrow: {
    fontSize: 18,
  },
  wordmarkFallbackWide: {
    fontSize: 28,
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
