/**
 * BRAND-001 Stage 2 — header tagline.
 *
 * Renders the BRAND fixture string ("Just get to the bottom of it") in
 * a serif italic so it reads as supporting voice next to the cream
 * wordmark. Lives in its own file so the AppHeader source-scan test
 * stays focused on `AppHeader.tsx` and this component can be tested in
 * isolation.
 *
 * Doctrine + invariants:
 * - Pure presentational. No router, no navigation, no Supabase.
 * - System serif italic only — no new font dep. The design's
 *   preferred default is to skip `@expo-google-fonts/cormorant-garamond`
 *   (avoids a font-load flash and keeps the bundle small). If a
 *   future audit shows the system stack is illegible on Android, the
 *   design's optional clause is invoked separately by the operator.
 * - Tagline copy is the BRAND.taglineText literal — never freshly
 *   authored. The Stage 2 test ban-lists the string against verdict
 *   vocabulary.
 * - All visible characters wrapped in `<Text>` (RN crash guard).
 * - Exposes `accessibilityRole="text"` so screen readers never treat
 *   the tagline as a button. The pressable grouping is owned by the
 *   parent `AppHeader` home pressable.
 */
import React from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import type { TextStyle } from 'react-native';
import { BRAND } from '../lib/designTokens';

/** Re-export of the BRAND tagline literal for ergonomic consumers. */
export const APP_HEADER_TAGLINE_TEXT: string = BRAND.taglineText;

export interface AppHeaderTaglineProps {
  /**
   * `inline` — tagline sits to the right of the logo on a shared
   * baseline at the wide breakpoint (font size 18).
   * `stacked` — tagline sits beneath the logo at the narrow
   * breakpoint (font size 14).
   */
  variant: 'inline' | 'stacked';
  /**
   * Optional style override. Caller-facing style is restricted to
   * typography adjustments (font size, padding); the BRAND fixture
   * text and color come from the module, never the caller.
   */
  style?: TextStyle;
}

// System serif italic stack. Picked deterministically per platform so
// the font-load flash (FOUT) is avoided entirely. The design's
// preferred default is to ship NO new font dep.
const SERIF_FONT_FAMILY = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia, "Times New Roman", serif',
});

export function AppHeaderTagline({ variant, style }: AppHeaderTaglineProps): React.ReactElement {
  const variantStyle = variant === 'inline' ? styles.inline : styles.stacked;
  return (
    <Text
      accessibilityRole="text"
      testID="app-header-tagline"
      // Tagline is decorative — never treat as a button. The parent
      // `<Pressable>` in AppHeader supplies the accessible group label.
      style={[styles.base, variantStyle, style]}
      numberOfLines={1}
      allowFontScaling
    >
      {APP_HEADER_TAGLINE_TEXT}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    color: BRAND.text.taglineFg,
    fontFamily: SERIF_FONT_FAMILY,
    fontStyle: 'italic',
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  inline: {
    fontSize: 18,
    lineHeight: 24,
    paddingLeft: 12,
  },
  stacked: {
    fontSize: 14,
    lineHeight: 18,
    paddingTop: 2,
  },
});
