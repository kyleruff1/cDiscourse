/**
 * UX-BOARD-RAIL-002 — RoomBoardLayout.
 *
 * A PURE presentational grid wrapper for the argument-room board. It receives
 * the already-built render-tree subtrees as named slot props and arranges them
 * into a band-driven 1 / 2 / 3-column board:
 *
 *   - phone  (< 600 dp)   → 1 column  (today's vertical stack order)
 *   - tablet (600–1279)   → 2 columns (left spine + 380 px right pane)
 *   - wide   (≥ 1280)     → 3 columns (col1 spine · col2 readout · 380 px pane)
 *
 * Doctrine + invariants:
 *  - ZERO hooks, ZERO handlers, ZERO derivation. All logic stays above the
 *    `return` in the caller (`ArgumentGameSurface`). This component only places
 *    children into flex columns.
 *  - RN `View` + flexbox only — no new dependency, no CSS grid.
 *  - The `band` is passed IN from the caller's already-resident `headerBand`
 *    (`useHeaderBreakpoint`). This component never reads `useWindowDimensions`
 *    or `resolveBand` itself — there is exactly one band read per surface.
 *  - Column boundaries carry a 1 px GEOMETRY border (accessibility-targets §2 —
 *    never color alone). col3's left border comes from the rail's
 *    `expandedRootPane`; col2's left border is owned here.
 *  - Reduce-motion safe by construction: the re-flow across a band boundary is
 *    an instant React re-render — there is no `Animated` layout transition.
 *  - The board is a read-only projection of the once-derived mediator board;
 *    this wrapper introduces no score, no verdict, no truth/heat/popularity
 *    copy (cdiscourse-doctrine §1–§3). It renders no text of its own.
 */
import React from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Band } from '../../hooks/useHeaderBreakpoint';
import { BORDER_WIDTH, SURFACE_TOKENS } from '../../lib/designTokens';

export interface RoomBoardLayoutProps {
  /** Column-count authority. phone => 1 col, tablet => 2 col, wide => 3 col. */
  band: Band;
  /** Banner that sits above the board body on all bands (microMoment). */
  topBanner?: ReactNode;
  /** col 1 — the argument path (timeline OR bubble stack body). */
  col1: ReactNode;
  /** col 2 — selected-node readout + selection note + score tracker + chip row + composer strip. */
  col2: ReactNode;
  /** col 2 footer — Act/Inspect/Go trigger row + popouts + inspect drawer. */
  col2Footer: ReactNode;
  /** col 3 — the Disagreement Points ledger (pane on tablet/wide; sheet content on phone). */
  col3: ReactNode;
  /** Bottom chrome — Open Issues + seat strip + side action rail (unchanged placement). */
  bottomChrome?: ReactNode;
  /** Composer-side overlays + referee banner that trail the board (RefereeBannerView, sheets). */
  overlays?: ReactNode;
  /** Forwarded to the outer container so surface-presence tests keep matching. */
  testID?: string;
  accessibilityLabel?: string;
}

/**
 * Fixed right-pane width (matches the shipped `'side'` chassis width — zero new
 * sizing math). Lives only on tablet/wide, where the smallest band edge (600 px)
 * comfortably fits 380 + a usable spine column.
 */
export const ROOM_BOARD_PANE_WIDTH_PX = 380;

export function RoomBoardLayout({
  band,
  topBanner,
  col1,
  col2,
  col2Footer,
  col3,
  bottomChrome,
  overlays,
  testID,
  accessibilityLabel,
}: RoomBoardLayoutProps): React.ReactElement {
  // ── phone (1 col) — today's single vertical stack ──
  // Byte-identical to the pre-002 render: every slot stacks top-to-bottom in
  // O-1 order. col3's rail stays a collapsed-pill bottom sheet
  // (`presentation='sheet'`), so this is the shipped phone experience.
  if (band === 'phone') {
    return (
      <View
        style={styles.outer}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        {topBanner}
        {col1}
        {col2}
        {col2Footer}
        {col3}
        {bottomChrome}
        {overlays}
      </View>
    );
  }

  // ── tablet (2 col) — left spine (col1 + col2 + col2Footer) · right pane (col3) ──
  if (band === 'tablet') {
    return (
      <View
        style={styles.outer}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
      >
        {topBanner}
        <View style={styles.boardRow} testID="room-board-row">
          <View style={styles.spineColumnWide} testID="room-board-col-1">
            {col1}
            {col2}
            {col2Footer}
          </View>
          <View style={styles.paneColumn} testID="room-board-col-3">
            {col3}
          </View>
        </View>
        {bottomChrome}
        {overlays}
      </View>
    );
  }

  // ── wide (3 col) — col1 spine · col2 readout+footer · col3 pane ──
  return (
    <View
      style={styles.outer}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {topBanner}
      <View style={styles.boardRow} testID="room-board-row">
        <View style={styles.spineColumn} testID="room-board-col-1">
          {col1}
        </View>
        <View style={[styles.readoutColumn, styles.columnDivider]} testID="room-board-col-2">
          {col2}
          {col2Footer}
        </View>
        <View style={styles.paneColumn} testID="room-board-col-3">
          {col3}
        </View>
      </View>
      {bottomChrome}
      {overlays}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: '#020617' },
  // The row that hosts the columns on tablet/wide. `alignItems: 'stretch'`
  // lets each column own its own height so the 380 px pane never collapses.
  boardRow: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  // UX-BOARD-READABILITY-001 (2026-06-19): interior gutter (paddingHorizontal 12)
  // on the tablet/wide columns so the board no longer butts against the viewport
  // edge / divider with zero breathing room. The phone branch returns before the
  // boardRow and is untouched. Additive padding only — the 1px columnDivider and
  // paneColumn width 380 (uxBoardRail002Topology) are unchanged.
  // wide: col1 spine.
  spineColumn: { flex: 1.2, minWidth: 0, paddingHorizontal: 12 },
  // tablet: col1 spine carries col1 + col2 + footer together (no col2 split).
  spineColumnWide: { flex: 1, minWidth: 0, paddingHorizontal: 12 },
  // wide: col2 readout + footer.
  readoutColumn: { flex: 1, minWidth: 0, paddingHorizontal: 12 },
  // Fixed-width right pane (col3). Width owned by the COLUMN, not the rail.
  paneColumn: { width: ROOM_BOARD_PANE_WIDTH_PX, maxWidth: '100%' },
  // Geometry boundary between col1 and col2 (never color-only — a real border
  // width). col3's left boundary is owned by the rail's `expandedRootPane`.
  columnDivider: {
    borderLeftWidth: BORDER_WIDTH.sm,
    borderLeftColor: SURFACE_TOKENS.border,
  },
});
