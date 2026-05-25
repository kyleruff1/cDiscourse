/**
 * UX-001.5 — `AnnotationBadge` — small dot/pill state badge.
 *
 * A compact non-text indicator attached to a parent object. Designed to
 * sit as an overlay (caller supplies absolute positioning) without
 * displacing layout — preserves the UX-001.2 `BAND_RAIL_OFFSET` math.
 *
 * Critical mount constraint (UX-001.2 regression preservation):
 *   The badge primitive itself NEVER sets `top` / `right` / `bottom` /
 *   `left` / `margin*` styles. The caller (e.g. `ArgumentTimelineMap`)
 *   passes the overlay style via the `style` prop, following the
 *   existing `receiptMark` precedent at `ArgumentTimelineMap.tsx:1264-1278`.
 *
 * Doctrine + accessibility:
 *   - `ariaLabel` is REQUIRED — the badge has no visible text, so the
 *     screen-reader label IS the meaning.
 *   - Color is supplementary; the optional inner glyph (rendered when
 *     diameter ≥ 10) is a non-color carrier of meaning.
 *   - All colors token-derived; no hex literals in this file.
 */
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { SURFACE_TOKENS } from '../../lib/designTokens';
import type {
  AnnotationChipDescriptor,
  AnnotationChipIconHint,
} from './annotationChipDescriptor';
import {
  ANNOTATION_BADGE_DIAMETER_BY_BAND,
  resolveBandValue,
  resolveChipColors,
  type AnnotationBand,
} from './annotationKindTokens';

/** Inner glyph for an iconHint. Returns empty when no inner mark fits. */
function innerGlyphFor(iconHint: AnnotationChipIconHint | undefined): string {
  switch (iconHint) {
    case 'info':
      return 'ⓘ';
    case 'warn':
      return '!';
    case 'check':
      return '✓';
    case 'time':
      return '⏱';
    case 'evidence':
      return '◆';
    case 'flag':
      return '⚑';
    case 'cluster':
      return '+';
    default:
      return '';
  }
}

export interface AnnotationBadgeProps {
  /**
   * Required screen-reader label. The badge has no visible text, so
   * meaning must travel through the a11y label.
   */
  ariaLabel: string;
  /**
   * Optional iconHint — drives the inner glyph (rendered when diameter
   * is ≥ 10) and the border tint via `resolveChipColors`.
   */
  iconHint?: AnnotationChipIconHint;
  /** Optional kind for token color mapping. Defaults to `'state'`. */
  kind?: AnnotationChipDescriptor['kind'];
  /**
   * Optional explicit diameter (logical px). Defaults to the band's
   * value from `ANNOTATION_BADGE_DIAMETER_BY_BAND`.
   */
  diameterPx?: number;
  /** Band default; resolves to tablet when absent. */
  band?: AnnotationBand;
  /**
   * Caller-supplied overlay style. The primitive itself NEVER sets
   * `top` / `right` / `bottom` / `left` / `margin*` — those live on
   * `style`. Following the `receiptMark` precedent.
   */
  style?: StyleProp<ViewStyle>;
  /** testID passthrough. */
  testID?: string;
}

/**
 * The badge dot/pill. Renders a circular `<View>` (with optional inner
 * `<Text>` glyph) sized per band. The container is non-interactive.
 */
export function AnnotationBadge({
  ariaLabel,
  iconHint,
  kind,
  diameterPx,
  band,
  style,
  testID,
}: AnnotationBadgeProps) {
  const colors = useMemo(() => resolveChipColors(kind ?? 'state', iconHint), [kind, iconHint]);
  const diameter =
    typeof diameterPx === 'number' && diameterPx > 0
      ? diameterPx
      : resolveBandValue(ANNOTATION_BADGE_DIAMETER_BY_BAND, band);

  const showInnerGlyph = diameter >= 10;
  const glyph = innerGlyphFor(iconHint);

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={ariaLabel}
      style={[
        styles.badge,
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          backgroundColor: colors.bg,
          borderColor: colors.borderColor,
        },
        style,
      ]}
      testID={testID}
    >
      {showInnerGlyph && glyph.length > 0 ? (
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={[
            styles.innerGlyph,
            { color: colors.fg, fontSize: Math.max(8, diameter - 4) },
          ]}
        >
          {glyph}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    // Border carries a non-color contrast signal (a 1px ring against the
    // background) regardless of the kind-tinted fill.
    borderWidth: 1,
    // Anchor color = a dark token contrast against the background. Lifts
    // the badge off any underlying timeline node.
    shadowColor: SURFACE_TOKENS.base,
  },
  innerGlyph: {
    fontWeight: '700',
    textAlign: 'center',
  },
});
