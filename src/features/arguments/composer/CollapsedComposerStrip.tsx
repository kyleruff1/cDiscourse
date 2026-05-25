/**
 * UX-001.3 — CollapsedComposerStrip.
 *
 * The persistent 56/64/72 px strip below the score tracker that
 * preserves the composer's "Compose ▴" affordance when the composer
 * is in its DISMISSED-but-anchored state. Tap → expands the composer
 * dock.
 *
 * The strip's job is the brief's central rule: "The composer must
 * always show its target." When the user is NOT actively composing
 * (the dock is closed), this strip still shows what the next move
 * would act on, so context is never lost on the room surface.
 *
 * Per-band heights match the dock's expanded `ComposerContextStrip`
 * (so the visual rhythm carries across collapse/expand transitions):
 *   - phone:  56 px
 *   - tablet: 64 px
 *   - wide:   72 px
 *
 * Doctrine:
 *  - 44×44 hit target on the outer Pressable (minHeight >= 44 always).
 *  - Plain English copy only. No verdict tokens.
 *  - accessibilityRole="button" + accessibilityState={ expanded: false }.
 *  - Color independence — the "Compose" word carries the meaning.
 */
import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { BoxType } from '../oneBox/boxModel';
import type { ArgumentRow } from '../types';
import { SPACING, SURFACE_TOKENS } from '../../../lib/designTokens';
import { useHeaderBreakpoint } from '../../../hooks/useHeaderBreakpoint';
import type { Band } from '../../../hooks/useHeaderBreakpoint';
import {
  deriveComposerActingOnLabel,
  type ComposerActingOnInput,
} from './composerActingOnModel';
import {
  COMPOSER_STRIP_HEIGHT_BY_BAND,
  COMPOSER_STRIP_PADDING_V_BY_BAND,
  COMPOSER_STRIP_CONTENT_MIN_HEIGHT_BY_BAND,
  truncateExcerpt,
} from './ComposerContextStrip';

const PARENT_EXCERPT_LENGTH = 80;
const RESOLUTION_EXCERPT_LENGTH = 80;

const TYPE_LABEL: Readonly<Record<string, string>> = Object.freeze({
  thesis: 'Thesis',
  claim: 'Claim',
  rebuttal: 'Rebuttal',
  counter_rebuttal: 'Counter-Rebuttal',
  evidence: 'Evidence',
  clarification_request: 'Clarification',
  concession: 'Concession',
  synthesis: 'Synthesis',
});

export interface CollapsedComposerStripProps {
  /**
   * The box type the strip should preview. When the composer has never
   * been opened in this room session, defaults to `'respond'` (when a
   * Timeline node is active) or `'root_claim'` (when none).
   */
  boxType: BoxType;
  /** The currently-active parent argument; null for a root-claim context. */
  parentArgument: ArgumentRow | null;
  /** The room's resolution — used for root_claim mode's strip label. */
  resolution?: string | null;
  /** Tap → opens the composer dock to its expanded state. */
  onExpand: () => void;
  /** Optional band override (tests). Defaults to the resolved breakpoint. */
  bandOverride?: Band;
  /** Optional viewer-side test id suffix to disambiguate multiple instances. */
  testIDPrefix?: string;
}

/**
 * The persistent below-Timeline strip. Tapping it opens the composer
 * dock to its expanded state.
 */
export function CollapsedComposerStrip({
  boxType,
  parentArgument,
  resolution,
  onExpand,
  bandOverride,
  testIDPrefix,
}: CollapsedComposerStripProps) {
  const breakpoint = useHeaderBreakpoint();
  const band = bandOverride ?? breakpoint.band;

  // Reuse the acting-on derivation so the strip's copy stays in lockstep
  // with the dock's expanded ComposerContextStrip.
  const labelInput: ComposerActingOnInput = useMemo(
    () => ({
      activeMessageId: parentArgument?.id ?? null,
      parentArgumentId: parentArgument?.id ?? null,
      boxType,
      parentBodyExcerpt: truncateExcerpt(parentArgument?.body ?? null, PARENT_EXCERPT_LENGTH),
      parentTypeLabel: parentArgument
        ? TYPE_LABEL[parentArgument.argumentType] ?? parentArgument.argumentType
        : null,
      resolutionExcerpt: truncateExcerpt(resolution ?? null, RESOLUTION_EXCERPT_LENGTH),
    }),
    [boxType, parentArgument, resolution],
  );

  const label = useMemo(() => deriveComposerActingOnLabel(labelInput), [labelInput]);

  const compactHeight = COMPOSER_STRIP_HEIGHT_BY_BAND[band];
  const paddingV = COMPOSER_STRIP_PADDING_V_BY_BAND[band];
  const contentMinHeight = COMPOSER_STRIP_CONTENT_MIN_HEIGHT_BY_BAND[band];

  // Effective hit target: outer Pressable + paddingV makes the touchable
  // surface at least `compactHeight` (56 / 64 / 72) — well above 44.
  const a11yLabel = `Compose. ${label.mainLabel}`;

  const testID = testIDPrefix
    ? `${testIDPrefix}-collapsed-composer-strip`
    : 'collapsed-composer-strip';

  return (
    <Pressable
      onPress={onExpand}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint="Opens the composer."
      accessibilityState={{ expanded: false }}
      style={[
        styles.outer,
        {
          minHeight: compactHeight,
          paddingTop: paddingV,
          paddingBottom: paddingV,
        },
      ]}
      testID={testID}
    >
      <View
        style={[styles.row, { minHeight: contentMinHeight }]}
        testID={`${testID}-row`}
      >
        <View style={styles.labelColumn}>
          <Text
            style={styles.mainLabel}
            numberOfLines={1}
            ellipsizeMode="tail"
            testID={`${testID}-main-label`}
          >
            {label.mainLabel}
          </Text>
        </View>

        <View style={styles.cta}>
          <Text style={styles.ctaLabel}>Compose</Text>
          <Text
            style={styles.ctaCaret}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {' ▴'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: SURFACE_TOKENS.elevated,
    borderTopWidth: 1,
    borderTopColor: SURFACE_TOKENS.border,
    paddingHorizontal: SPACING.l,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.s,
  },
  labelColumn: {
    flex: 1,
  },
  mainLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: SURFACE_TOKENS.textPrimary,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.s,
  },
  ctaLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: SURFACE_TOKENS.textPrimary,
  },
  ctaCaret: {
    fontSize: 13,
    fontWeight: '700',
    color: SURFACE_TOKENS.textPrimary,
  },
});
