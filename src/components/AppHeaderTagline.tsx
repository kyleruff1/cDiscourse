/**
 * BRAND-001 Stage 2 / UX-001.1 — header tagline.
 *
 * Renders the BRAND fixture string ("Just get to the bottom of it") in
 * a serif italic so it reads as supporting voice next to the cream
 * wordmark. Lives in its own file so the AppHeader source-scan test
 * stays focused on `AppHeader.tsx` and this component can be tested in
 * isolation.
 *
 * UX-001.1 update: per-variant typography (fontSize / lineHeight /
 * letterSpacing / fontWeight) now reads from
 * `BRAND.typography.tagline.inline` / `.stacked` instead of inline
 * literals. Behaviour is preserved verbatim — the BRAND token values
 * mirror the prior inline literals exactly. Visual padding remains
 * declared inline (paddingLeft / paddingTop) because it is a layout
 * concern, not a typography concern.
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
    // UX-001.1 — fontWeight + letterSpacing flow in from
    // BRAND.typography.tagline.<variant> via the variant style entries
    // below. The base style declares only the color + family + italic
    // (the cross-variant invariants).
  },
  // UX-001.1 — per-variant typography reads from BRAND.typography.tagline
  // so the contract is owned by designTokens, not inlined here. Padding
  // (left/top) is a layout concern and stays inline.
  inline: {
    fontSize: BRAND.typography.tagline.inline.fontSize,
    lineHeight: BRAND.typography.tagline.inline.lineHeight,
    letterSpacing: BRAND.typography.tagline.inline.letterSpacing,
    fontWeight: BRAND.typography.tagline.inline.fontWeight,
    paddingLeft: 12,
  },
  stacked: {
    fontSize: BRAND.typography.tagline.stacked.fontSize,
    lineHeight: BRAND.typography.tagline.stacked.lineHeight,
    letterSpacing: BRAND.typography.tagline.stacked.letterSpacing,
    fontWeight: BRAND.typography.tagline.stacked.fontWeight,
    paddingTop: 2,
  },
});
