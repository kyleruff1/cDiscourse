/**
 * BR-001 — BranchCollapseStub.
 *
 * Small Pressable pill rendered adjacent to the gradient wave rail. Tap
 * re-expands the collapsed branch. The stub is NOT a rail segment — it
 * is a separate `<Pressable>` anchored to the branch root node's
 * coordinates, so the rail's `pointerEvents: 'none'` invariant from
 * VG-002 is preserved.
 *
 * Visual: 24×24 pill with a `+N` count badge.
 *   - Background reuses VG-001's `BRAND.surface.appElevated`.
 *   - Border reuses the branch root's `node.kindColor` so the stub
 *     visually inherits the branch family color. NO new color token.
 *   - When `containsActive` flips true (the active message lives inside
 *     this collapsed subtree — rare, normally auto-expand handles this),
 *     the border thickens slightly to surface the state. Plain text
 *     still carries the same info via `accessibilityLabel`.
 *
 * Accessibility:
 *   - `accessibilityRole='button'`, `accessibilityState={{ expanded:
 *     false }}`.
 *   - `accessibilityLabel` is the plain-English sentence from the
 *     `RailStubViewModel` ("3 hidden replies on the side branch. Tap to
 *     expand."). Never contains verdict / amplification / snake_case
 *     tokens — assertion is in `__tests__/BranchCollapseStub.test.tsx`.
 *   - `hitSlop` ≥ 14px on each side so the effective tap target is at
 *     least 44×44 per `accessibility-targets`.
 *
 * Reduce-motion: the expand action is a static swap in v1 — no
 * animation is invoked here. A future card may add a brief fade gated
 * on `prefersReducedMotion`; this component must NOT introduce one.
 */
import React, { type ReactElement } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BRAND } from '../../lib/designTokens';
import type { RailStubViewModel } from './branchTopologyModel';
import type { CollapsedBranchSummary } from './branchGrammarModel';

export interface BranchCollapseStubProps {
  stub: RailStubViewModel;
  /** Tapping the stub fires this with the branch's root message id.
   *  The room shell consumes that and calls
   *  `toggleBranchCollapse(state, branchRootMessageId)`. */
  onPress: (branchRootMessageId: string) => void;
  /** Optional test-id suffix to disambiguate when multiple stubs render. */
  testIDSuffix?: string;
  /**
   * BR-004 — the four-field collapsed-branch summary (count · recency ·
   * unresolved · primary-party-engaged). Optional and ADDITIVE: when
   * supplied, the stub renders the summary's verbose accessibility label
   * and exposes a `summary-line` test text; when `null`/omitted, the
   * stub falls back to BR-001's existing `+N` label exactly as it
   * shipped. BR-004 never makes this prop required.
   */
  summary?: CollapsedBranchSummary | null;
}

// ── Pure helpers (consumed directly by tests) ─────────────────────

/** The pill is 24×24 visible. `hitSlop` of 14 each side expands the
 *  touchable region to 52×52 — well over the 44×44 a11y target. */
export const BRANCH_COLLAPSE_STUB_VISIBLE_SIZE_PX = 24;
export const BRANCH_COLLAPSE_STUB_HIT_SLOP_PX = 14;
export const BRANCH_COLLAPSE_STUB_HIT_SLOP = Object.freeze({
  top: BRANCH_COLLAPSE_STUB_HIT_SLOP_PX,
  bottom: BRANCH_COLLAPSE_STUB_HIT_SLOP_PX,
  left: BRANCH_COLLAPSE_STUB_HIT_SLOP_PX,
  right: BRANCH_COLLAPSE_STUB_HIT_SLOP_PX,
});

/** Returns the effective tap target side length in px. Asserted in
 *  tests to be ≥ 44. */
export function getEffectiveTapTargetPx(): number {
  return BRANCH_COLLAPSE_STUB_VISIBLE_SIZE_PX + 2 * BRANCH_COLLAPSE_STUB_HIT_SLOP_PX;
}

/**
 * Build the visual container style for one stub. Pure — tests assert
 * the values without rendering React.
 *
 * The active-inside flag thickens the border subtly (2 → 3 px). The
 * stub border color always inherits from the branch's `node.kindColor`
 * — no new color token is introduced. Background is locked to VG-001's
 * `BRAND.surface.appElevated`.
 */
export function buildBranchCollapseStubContainerStyle(stub: RailStubViewModel): {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  width: number;
  height: number;
  alignItems: 'center';
  justifyContent: 'center';
} {
  return {
    backgroundColor: BRAND.surface.appElevated.bg,
    borderColor: stub.borderColor,
    borderWidth: stub.containsActive ? 3 : 2,
    borderRadius: BRANCH_COLLAPSE_STUB_VISIBLE_SIZE_PX / 2,
    width: BRANCH_COLLAPSE_STUB_VISIBLE_SIZE_PX,
    height: BRANCH_COLLAPSE_STUB_VISIBLE_SIZE_PX,
    alignItems: 'center',
    justifyContent: 'center',
  };
}

/** Build the absolute-position style for a stub anchored to the rail.
 *  The stub centers on the branch root node's `(x, y)` minus half its
 *  own size so it visually sits on top of the rail. */
export function buildBranchCollapseStubPositionStyle(stub: RailStubViewModel): {
  position: 'absolute';
  left: number;
  top: number;
} {
  const half = BRANCH_COLLAPSE_STUB_VISIBLE_SIZE_PX / 2;
  return {
    position: 'absolute',
    left: stub.anchorX - half,
    top: stub.anchorY - half,
  };
}

/**
 * VG-004 — generic side-branch glyph.
 *
 * `RailStubViewModel` carries no `branchKind` field today (it is a
 * BR-001 surface and VG-004 deliberately does not modify
 * `branchTopologyModel.ts`). Until a kind-specific glyph is wanted, the
 * stub renders one generic "side branch" character. The glyph is
 * decorative: the `accessibilityLabel` carries the real meaning, so the
 * glyph `<Text>` is hidden from screen readers (no double-announce).
 *
 * `⤳` is a plain Unicode character — no icon library (per
 * `expo-rn-patterns`). It is not a verdict / amplification / snake_case
 * token, which the ban-list test enforces.
 */
export const BRANCH_COLLAPSE_STUB_GLYPH = '⤳';

/**
 * VG-004 — Pure. Splits the stub display into a branch-kind glyph and
 * the count text. `countText` is taken verbatim from `stub.label` (the
 * existing `+N` string built by `branchTopologyModel.formatStubLabel`),
 * so the count rendering is unchanged — only the layout splits into two
 * `<Text>` spans.
 */
export function buildBranchCollapseStubLabelParts(stub: RailStubViewModel): {
  glyph: string;
  countText: string;
} {
  return {
    glyph: BRANCH_COLLAPSE_STUB_GLYPH,
    countText: stub.label,
  };
}

// ── Component ────────────────────────────────────────────────────

export function BranchCollapseStub({
  stub,
  onPress,
  testIDSuffix,
  summary,
}: BranchCollapseStubProps): ReactElement {
  const containerStyle = buildBranchCollapseStubContainerStyle(stub);
  const positionStyle = buildBranchCollapseStubPositionStyle(stub);
  const testID = `branch-collapse-stub${testIDSuffix ? `-${testIDSuffix}` : ''}`;
  // VG-004 — split the display into a branch-kind glyph + the count.
  const { glyph, countText } = buildBranchCollapseStubLabelParts(stub);
  // BR-004 — when a four-field summary is supplied, its verbose
  // accessibilityLabel replaces BR-001's shorter sentence (it describes
  // the direction + count + recency + unresolved + principal
  // engagement). When absent, the stub keeps BR-001's existing label.
  const accessibilityLabel =
    summary != null ? summary.accessibilityLabel : stub.accessibilityLabel;

  return (
    <View style={positionStyle} testID={`${testID}-anchor`}>
      <Pressable
        onPress={() => onPress(stub.branchRootMessageId)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: false }}
        hitSlop={BRANCH_COLLAPSE_STUB_HIT_SLOP}
        style={containerStyle}
        testID={testID}
      >
        {/* VG-004 — decorative branch-kind glyph. Hidden from screen
            readers so the full accessibilityLabel is not double-spoken. */}
        <Text
          style={styles.glyph}
          numberOfLines={1}
          accessibilityElementsHidden
          importantForAccessibility="no"
          testID={`${testID}-glyph`}
        >
          {glyph}
        </Text>
        <Text style={styles.label} numberOfLines={1} testID={`${testID}-count`}>
          {countText}
        </Text>
      </Pressable>
      {/* BR-004 — the four-field collapsed-branch summary line. Hidden
          from screen readers (the Pressable's accessibilityLabel already
          carries the verbose version) but exposed for tests + any future
          density mode that surfaces it as visible caption text. Rendered
          only when a summary is supplied — additive, never required. */}
      {summary != null ? (
        <Text
          style={styles.summaryLine}
          numberOfLines={1}
          accessibilityElementsHidden
          importantForAccessibility="no"
          testID={`${testID}-summary-line`}
        >
          {summary.summaryLine}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  glyph: {
    color: BRAND.text.muted,
    fontSize: 8,
    fontWeight: '700',
    lineHeight: 9,
  },
  label: {
    color: BRAND.text.primary,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 12,
  },
  // BR-004 — collapsed-branch summary caption. Kept off-screen-narrow
  // (the rail pill is 24px) but laid out so a future density mode can
  // promote it to a visible caption without a component change.
  summaryLine: {
    color: BRAND.text.muted,
    fontSize: 9,
    lineHeight: 11,
    marginTop: 2,
    width: 0,
    height: 0,
    overflow: 'hidden',
  },
});
