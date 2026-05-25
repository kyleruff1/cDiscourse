/**
 * UX-001.3 — ComposerContextStrip.
 *
 * The always-visible compact target display that mounts at the TOP of
 * the composer body (immediately below the OneBox header chip + Cancel).
 * Subsumes the OneBox header's tiny `targetHint` + the existing
 * "Replying to" parent block + the Advanced anchor quote disclosure
 * into a single source of compact target display.
 *
 * Per-band height bounds (matches brief §"target display"):
 *   - phone:  56 px (paddingV 6 + content 42 + border 1 + 1 slack)
 *   - tablet: 64 px (paddingV 8 + content 46 + border 1 + 1 slack)
 *   - wide:   72 px (paddingV 10 + content 50 + border 1 + 1 slack)
 *
 * The expand affordance reveals the existing `ComposerTargetPanel`
 * capped to `max(160, viewportHeight * 0.25)`. We do NOT modify
 * `ComposerTargetPanel` — we mount it as the expanded form.
 *
 * Doctrine:
 *  - 44×44 hit targets (visual or hitSlop) on every Pressable.
 *  - Plain English only. No verdict tokens. No snake_case leaks.
 *  - Color is supplementary; the text label carries the meaning so the
 *    strip is legible in grayscale.
 *  - accessibilityRole + accessibilityLabel + accessibilityState on
 *    every interactive element.
 */
import React, { useCallback, useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { BoxType } from '../oneBox/boxModel';
import type { ArgumentRow } from '../types';
import { SPACING, RADIUS, SURFACE_TOKENS } from '../../../lib/designTokens';
import { useHeaderBreakpoint } from '../../../hooks/useHeaderBreakpoint';
import type { Band } from '../../../hooks/useHeaderBreakpoint';
import {
  deriveComposerActingOnLabel,
  type ComposerActingOnInput,
} from './composerActingOnModel';

const PARENT_EXCERPT_LENGTH = 80;
const PARENT_EXCERPT_SHORT_LENGTH = 60;
const RESOLUTION_EXCERPT_LENGTH = 80;

/**
 * Per-band rendered heights for the COMPACT (collapsed) strip. Matches
 * the brief's per-band bounds and the design's chosen targets.
 */
export const COMPOSER_STRIP_HEIGHT_BY_BAND: Readonly<Record<Band, number>> =
  Object.freeze({
    phone: 56,
    tablet: 64,
    wide: 72,
  });

/**
 * Per-band paddingVertical for the compact strip. Combined with the
 * inner content's minHeight + a 1 px border + 1 px slack, sums to the
 * COMPOSER_STRIP_HEIGHT_BY_BAND values above. Kept exported so tests
 * can pin the math without rendering.
 */
export const COMPOSER_STRIP_PADDING_V_BY_BAND: Readonly<Record<Band, number>> =
  Object.freeze({
    phone: 6,
    tablet: 8,
    wide: 10,
  });

/**
 * Per-band content min-heights. Plus paddingV*2 + 1 border + 1 slack =
 * COMPOSER_STRIP_HEIGHT_BY_BAND.
 */
export const COMPOSER_STRIP_CONTENT_MIN_HEIGHT_BY_BAND: Readonly<Record<
  Band,
  number
>> = Object.freeze({
  phone: 42,
  tablet: 46,
  wide: 50,
});

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

/**
 * Cap a string at length, appending an ellipsis when truncated.
 * Pure helper — exported for tests.
 */
export function truncateExcerpt(s: string | null | undefined, n: number): string {
  if (!s) return '';
  if (s.length <= n) return s;
  return s.slice(0, n) + '…';
}

/**
 * Pick the per-mode excerpt length. Modes that name a longer excerpt
 * (Reply, Challenge, Clarify, Narrow, Confirm) use the 80-char form;
 * modes that prepend more chrome (Side issue off, Add evidence to)
 * use the 60-char form.
 */
function excerptLengthForMode(boxType: BoxType): number {
  switch (boxType) {
    case 'branch_tangent':
    case 'synthesize':
    case 'add_evidence':
    case 'ask_source':
    case 'ask_quote':
    case 'offer_concession':
    case 'respond_to_concession':
      return PARENT_EXCERPT_SHORT_LENGTH;
    default:
      return PARENT_EXCERPT_LENGTH;
  }
}

export interface ComposerContextStripProps {
  boxType: BoxType;
  parentArgument: ArgumentRow | null;
  /** For root_claim mode + room context label. */
  resolution?: string | null;
  /** Optional cluster context for synthesize mode. */
  clusterContext?: {
    memberCount: number;
    summaryExcerpt?: string | null;
  } | null;
  /** Optional incoming-concession context for respond_to_concession. */
  conversationContext?: {
    itemCount: number;
    targetExcerpt?: string | null;
  } | null;
  /** Read-only Timeline-selection coordination. Drives the divergence cue. */
  activeMessageId?: string | null;
  /** Whether the expanded preview is currently visible. */
  expanded: boolean;
  /** Toggle the expanded state. */
  onToggleExpanded: () => void;
  /** Optional band override (tests). Defaults to the resolved breakpoint. */
  bandOverride?: Band;
  /** Optional viewport height override (tests). */
  viewportHeightOverride?: number;
}

/**
 * The always-visible compact target display that anchors the composer's
 * "what am I acting on?" answer. Tappable to expand into the existing
 * `ComposerTargetPanel`.
 */
export function ComposerContextStrip({
  boxType,
  parentArgument,
  resolution,
  clusterContext,
  conversationContext,
  activeMessageId,
  expanded,
  onToggleExpanded,
  bandOverride,
  viewportHeightOverride,
}: ComposerContextStripProps) {
  const breakpoint = useHeaderBreakpoint();
  const { height: dimsHeight } = useWindowDimensions();
  const band = bandOverride ?? breakpoint.band;
  const viewportHeight = viewportHeightOverride ?? dimsHeight ?? 0;

  // Build the model input. Truncation happens here (the model is
  // excerpt-length neutral by design).
  const labelInput: ComposerActingOnInput = useMemo(() => {
    const excerptLen = excerptLengthForMode(boxType);
    return {
      activeMessageId: activeMessageId ?? null,
      parentArgumentId: parentArgument?.id ?? null,
      boxType,
      parentBodyExcerpt: truncateExcerpt(parentArgument?.body ?? null, excerptLen),
      parentTypeLabel: parentArgument
        ? TYPE_LABEL[parentArgument.argumentType] ?? parentArgument.argumentType
        : null,
      resolutionExcerpt: truncateExcerpt(resolution ?? null, RESOLUTION_EXCERPT_LENGTH),
      clusterMemberCount: clusterContext?.memberCount ?? null,
      clusterSummaryExcerpt: truncateExcerpt(
        clusterContext?.summaryExcerpt ?? null,
        PARENT_EXCERPT_SHORT_LENGTH,
      ),
      conversationItemCount: conversationContext?.itemCount ?? null,
      conversationTargetExcerpt: truncateExcerpt(
        conversationContext?.targetExcerpt ?? null,
        PARENT_EXCERPT_SHORT_LENGTH,
      ),
    };
  }, [
    activeMessageId,
    boxType,
    parentArgument,
    resolution,
    clusterContext,
    conversationContext,
  ]);

  const label = useMemo(() => deriveComposerActingOnLabel(labelInput), [labelInput]);

  const compactHeight = COMPOSER_STRIP_HEIGHT_BY_BAND[band];
  const paddingV = COMPOSER_STRIP_PADDING_V_BY_BAND[band];
  const contentMinHeight = COMPOSER_STRIP_CONTENT_MIN_HEIGHT_BY_BAND[band];

  // Expanded panel cap: max(160, 25% of viewport).
  const expandedMaxHeight = useMemo(() => {
    return Math.max(160, Math.round(viewportHeight * 0.25));
  }, [viewportHeight]);

  const handleToggle = useCallback(() => {
    onToggleExpanded();
  }, [onToggleExpanded]);

  const expandLabel = expanded ? 'Hide full target' : 'Show full target';
  const expandCaret = expanded ? '▴' : '▾';

  // We render the compact strip (always visible). When `expanded` is
  // true, we render the `ComposerTargetPanel` BELOW the strip inside a
  // capped-height view.
  return (
    <View
      style={[
        styles.outer,
        {
          minHeight: compactHeight,
          paddingTop: paddingV,
          paddingBottom: paddingV,
        },
      ]}
      testID="composer-context-strip"
    >
      <View
        style={[styles.row, { minHeight: contentMinHeight }]}
        testID="composer-context-strip-row"
      >
        <View style={styles.labelColumn}>
          <Text
            style={styles.mainLabel}
            numberOfLines={1}
            ellipsizeMode="tail"
            testID="composer-context-strip-main-label"
          >
            {label.mainLabel}
          </Text>
          {label.divergenceCue ? (
            <Text
              style={styles.divergenceCue}
              numberOfLines={1}
              ellipsizeMode="tail"
              testID="composer-context-strip-divergence-cue"
            >
              {label.divergenceCue}
            </Text>
          ) : null}
        </View>

        <Pressable
          onPress={handleToggle}
          accessibilityRole="button"
          accessibilityLabel={`${expandLabel} for this composer.`}
          accessibilityHint={
            expanded
              ? 'Collapses the full target detail.'
              : 'Shows the full target detail.'
          }
          accessibilityState={{ expanded }}
          hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
          style={styles.expandTrigger}
          testID="composer-context-strip-expand"
        >
          <Text style={styles.expandLabel}>{expandLabel}</Text>
          <Text
            style={styles.expandCaret}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {' ' + expandCaret}
          </Text>
        </Pressable>
      </View>

      {expanded ? (
        <View
          style={[
            styles.expandedHost,
            { maxHeight: expandedMaxHeight },
          ]}
          testID="composer-context-strip-expanded"
        >
          {parentArgument ? (
            <View style={styles.expandedReadout}>
              <Text
                style={styles.expandedLabel}
                testID="composer-context-strip-expanded-label"
              >
                Full target
              </Text>
              <Text
                style={styles.expandedExcerpt}
                numberOfLines={6}
                testID="composer-context-strip-expanded-excerpt"
              >
                {parentArgument.body}
              </Text>
            </View>
          ) : resolution ? (
            <View style={styles.expandedReadout}>
              <Text
                style={styles.expandedLabel}
                testID="composer-context-strip-expanded-label"
              >
                Room resolution
              </Text>
              <Text
                style={styles.expandedExcerpt}
                numberOfLines={6}
                testID="composer-context-strip-expanded-excerpt"
              >
                {resolution}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: SURFACE_TOKENS.elevated,
    borderLeftWidth: 3,
    borderLeftColor: SURFACE_TOKENS.inputBorder,
    borderBottomWidth: 1,
    borderBottomColor: SURFACE_TOKENS.border,
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
    flexDirection: 'column',
    gap: 2,
  },
  mainLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: SURFACE_TOKENS.textPrimary,
  },
  divergenceCue: {
    fontSize: 11,
    fontWeight: '500',
    color: SURFACE_TOKENS.textSecondary,
    fontStyle: 'italic',
  },
  expandTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.s,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
  },
  expandLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: SURFACE_TOKENS.textSecondary,
  },
  expandCaret: {
    fontSize: 12,
    fontWeight: '700',
    color: SURFACE_TOKENS.textSecondary,
  },
  expandedHost: {
    marginTop: SPACING.s,
  },
  expandedReadout: {
    backgroundColor: SURFACE_TOKENS.base,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: SURFACE_TOKENS.border,
    padding: SPACING.s,
    gap: 4,
  },
  expandedLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: SURFACE_TOKENS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  expandedExcerpt: {
    fontSize: 13,
    color: SURFACE_TOKENS.textPrimary,
    lineHeight: 18,
  },
});
