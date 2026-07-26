/**
 * UX-P2-12 (issue 941) — reduce-motion threading render parity.
 *
 * The source-scan matrix (uxP212ReduceMotionThreading.test.ts) proves the
 * five sites adopt the shared hook. This companion proves the swap keeps the
 * components renderable under BOTH hook-arg values, exercising the two paths
 * that actually changed:
 *
 *   - TimelineMiniMap — the one real gap. Its expand/collapse guard changed
 *     from `reduceMotion === true` to `useReduceMotion(reduceMotion)`. Pressing
 *     the header must toggle the body open whether reduce-motion is on (snap:
 *     heightAnim.setValue), off (tween: Animated.timing), or unset (the new OS
 *     fallback path, default false under jest). All three toggle the same
 *     expanded state, so the body renders either way.
 *   - ArgumentSideActionRail — pure dedupe. The expanded observer rows must
 *     render on a narrow sheet under reduceMotionOverride true AND false, so
 *     the dedupe cannot regress the render under either override value.
 *
 * Comments are apostrophe-free for the naive doctrine quote-parity scanner.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { TimelineMiniMap } from '../src/features/arguments/TimelineMiniMap';
import { ArgumentSideActionRail } from '../src/features/arguments/ArgumentSideActionRail';
import type {
  MiniMapBranchCluster,
  MiniMapViewportWindow,
  TimelineMiniMapModel,
} from '../src/features/arguments/timelineMiniMapModel';

const NOOP = () => {};

function mainlineCluster(): MiniMapBranchCluster {
  return {
    branchId: 'branch-root-m1',
    branchRootMessageId: 'm1',
    lane: 0,
    moveCount: 12,
    xStartFraction: 0,
    xEndFraction: 1,
    isCollapsed: false,
    hiddenMoveCount: 0,
    laneLabel: 'on the main line',
    containsActivePath: true,
    isMainline: true,
  };
}

function miniMapModel(): TimelineMiniMapModel {
  return {
    isAvailable: true,
    moveCount: 16,
    markers: [],
    branchClusters: [mainlineCluster()],
    hotZone: null,
    activePathMessageIds: ['m1'],
    rootMessageId: 'm1',
    latestMessageId: 'm16',
    minLane: 0,
    maxLane: 0,
    collapsedBranchCount: 0,
    summaryLine: '16 moves',
  };
}

const VIEWPORT_WINDOW: MiniMapViewportWindow = {
  xStartFraction: 0,
  xEndFraction: 1,
  coversAll: true,
};

describe('UX-P2-12 render parity — TimelineMiniMap toggles under every reduce-motion path', () => {
  const cases: Array<boolean | undefined> = [true, false, undefined];
  for (const reduceMotion of cases) {
    it(`opens the body when the header is pressed (reduceMotion=${String(reduceMotion)})`, () => {
      const { getByTestId, queryByTestId } = render(
        <TimelineMiniMap
          model={miniMapModel()}
          viewportWindow={VIEWPORT_WINDOW}
          onJump={NOOP}
          reduceMotion={reduceMotion}
          initiallyExpanded={false}
        />,
      );
      // Collapsed by default — the body is not mounted yet.
      expect(queryByTestId('timeline-mini-map-body')).toBeNull();
      // Pressing the header runs handleToggleExpand, which branches on the new
      // effectiveReducedMotion value. Either branch flips expanded to true.
      fireEvent.press(getByTestId('timeline-mini-map-header'));
      expect(getByTestId('timeline-mini-map-body')).toBeTruthy();
    });
  }
});

describe('UX-P2-12 render parity — ArgumentSideActionRail renders under both hook-arg values', () => {
  for (const reduceMotionOverride of [true, false]) {
    it(`renders the expanded observer rows on a 390 sheet (reduceMotionOverride=${String(reduceMotionOverride)})`, () => {
      const { getByTestId } = render(
        <ArgumentSideActionRail
          viewerRole="observer"
          bubbleActor="other"
          defaultCollapsed={false}
          onAction={NOOP}
          windowWidth={390}
          windowHeight={844}
          reduceMotionOverride={reduceMotionOverride}
        />,
      );
      // The observer expanded set always includes Watch — its presence proves
      // the dedupe did not regress the render under either override value.
      expect(getByTestId('rail-action-watch')).toBeTruthy();
    });
  }
});
