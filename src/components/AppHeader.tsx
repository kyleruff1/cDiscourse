/**
 * BRAND-001 — Global CivilDiscourse app header.
 *
 * Persistent top-of-page chrome with the canonical cream-on-black logo
 * on the left, an optional right-side slot for the user/observer
 * indicator the parent already owns. The logo tap returns the user to
 * the gallery / home (passed in as `onHomePress`).
 *
 * Stays state-only — no router, no navigation. Preserves the TL-003
 * no-route invariant.
 *
 * The logo is a regular `Image` source — no `react-native-svg`. If the
 * PNG asset is missing for any reason, the header falls back to a
 * text-only `CivilDiscourse` cream wordmark so the rest of the app
 * still renders.
 */
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BRAND } from '../lib/designTokens';

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

export function AppHeader({ onHomePress, rightSlot, logoSource }: Props) {
  const source = logoSource ?? DEFAULT_LOGO;

  return (
    <View
      style={styles.root}
      accessibilityRole="header"
      accessibilityLabel="CivilDiscourse"
      testID="app-header"
    >
      <Pressable
        onPress={onHomePress}
        accessibilityRole="button"
        accessibilityLabel="CivilDiscourse — back to gallery"
        accessibilityHint="Returns to the conversation gallery"
        testID="app-header-home"
        style={styles.homePressable}
      >
        {source ? (
          <Image
            source={source}
            style={styles.logoImage}
            resizeMode="contain"
            accessibilityLabel="CivilDiscourse"
            accessible
            testID="app-header-logo-image"
          />
        ) : (
          <Text style={styles.wordmarkFallback} testID="app-header-logo-fallback">
            CivilDiscourse
          </Text>
        )}
      </Pressable>
      <View style={styles.rightSlot} testID="app-header-right-slot">
        {rightSlot ?? null}
      </View>
    </View>
  );
}

export const APP_HEADER_HEIGHT = BRAND.headerHeightPx;

const styles = StyleSheet.create({
  root: {
    height: BRAND.headerHeightPx,
    backgroundColor: BRAND.surface.app.bg,
    borderBottomWidth: 1,
    borderBottomColor: BRAND.surface.appElevated.bg,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  homePressable: {
    height: BRAND.logoHeightPx + 8,
    minWidth: 120,
    justifyContent: 'center',
  },
  logoImage: {
    width: 168,
    height: BRAND.logoHeightPx,
  },
  wordmarkFallback: {
    color: BRAND.text.primary,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  rightSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
