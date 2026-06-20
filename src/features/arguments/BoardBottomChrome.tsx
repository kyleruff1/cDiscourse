/**
 * UX-BOARD-RAIL-004 (SN-1) — BoardBottomChrome.
 *
 * A PURE presentational wrapper for the argument-room board's bottom chrome. It
 * groups the three loose bottom surfaces — Open Issues rail, the read-only seat-
 * availability strip, and the side action rail — into ONE calm, bordered board-
 * bottom region so they read as deliberate room chrome rather than three stray
 * floating decorations beneath the columns.
 *
 * It receives those already-built render-tree subtrees as `children` and renders
 * them inside a single container with one top GEOMETRY boundary (a real
 * `borderTopWidth` token — NOT color alone, per accessibility-targets §2) plus a
 * consistent gutter consistent with the surrounding board.
 *
 * Doctrine + invariants (cdiscourse-doctrine §1–§3; mirrors RoomBoardLayout):
 *  - ZERO hooks, ZERO handlers, ZERO state, ZERO derivation, ZERO network. All
 *    logic stays above the `return` in the caller (`ArgumentGameSurface`). This
 *    component only places its children inside one bordered container.
 *  - RN `View` only — no new dependency, no CSS, no text element. It renders NO
 *    text of its own, so it introduces NO copy and therefore no scoreboard /
 *    verdict / truth / heat / popularity surface.
 *  - The top boundary is a real `borderTopWidth` (geometry), reusing the same
 *    `BORDER_WIDTH.sm` + `SURFACE_TOKENS.border` pair that RoomBoardLayout's
 *    `columnDivider` uses — geometry, never color-only.
 *  - Reduce-motion safe by construction: it adds no `Animated` layout transition;
 *    grouping is an instant React render.
 *  - Behavior-neutral: every child surface keeps its own behavior, collapse
 *    default, mutual-exclusion, reachability, copy, props, and testIDs. The
 *    wrapper changes only how the three surfaces are visually grouped.
 */
import React from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { BORDER_WIDTH, SPACING, SURFACE_TOKENS } from '../../lib/designTokens';

export interface BoardBottomChromeProps {
  /**
   * The three already-built bottom surfaces (Open Issues rail · seat strip ·
   * side action rail), in source order. Passed straight through — the wrapper
   * neither inspects nor reorders them.
   */
  children?: ReactNode;
  /** Forwarded to the container so surface-presence tests can locate it. */
  testID?: string;
}

export function BoardBottomChrome({
  children,
  testID = 'board-bottom-chrome',
}: BoardBottomChromeProps): React.ReactElement {
  return (
    <View style={styles.container} testID={testID}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // One calm board-bottom region: a single top GEOMETRY boundary (a real
  // border width, never color alone) + a consistent gutter consistent with the
  // surrounding board. Reuses the same border token pair as
  // RoomBoardLayout.columnDivider so the board chrome reads as one system.
  container: {
    borderTopWidth: BORDER_WIDTH.sm,
    borderTopColor: SURFACE_TOKENS.border,
    paddingHorizontal: SPACING.m,
    paddingTop: SPACING.s,
    gap: SPACING.s,
  },
});
