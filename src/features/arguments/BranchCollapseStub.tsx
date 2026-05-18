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

export interface BranchCollapseStubProps {
  stub: RailStubViewModel;
  /** Tapping the stub fires this with the branch's root message id.
   *  The room shell consumes that and calls
   *  `toggleBranchCollapse(state, branchRootMessageId)`. */
  onPress: (branchRootMessageId: string) => void;
  /** Optional test-id suffix to disambiguate when multiple stubs render. */
  testIDSuffix?: string;
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

// ── Component ────────────────────────────────────────────────────

export function BranchCollapseStub({
  stub,
  onPress,
  testIDSuffix,
}: BranchCollapseStubProps): ReactElement {
  const containerStyle = buildBranchCollapseStubContainerStyle(stub);
  const positionStyle = buildBranchCollapseStubPositionStyle(stub);
  const testID = `branch-collapse-stub${testIDSuffix ? `-${testIDSuffix}` : ''}`;

  return (
    <View style={positionStyle} testID={`${testID}-anchor`}>
      <Pressable
        onPress={() => onPress(stub.branchRootMessageId)}
        accessibilityRole="button"
        accessibilityLabel={stub.accessibilityLabel}
        accessibilityState={{ expanded: false }}
        hitSlop={BRANCH_COLLAPSE_STUB_HIT_SLOP}
        style={containerStyle}
        testID={testID}
      >
        <Text style={styles.label} numberOfLines={1}>
          {stub.label}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: BRAND.text.primary,
    fontSize: 11,
    fontWeight: '800',
  },
});
