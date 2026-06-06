// OPS-ADMIN-ARGS-WEB-WIDTH-001 — shared layout helpers for the admin / debate
// data tables. These are pure, JSON-serializable style fragments (no React, no
// platform branching) so the exact same fill behavior runs on web and native
// and is unit-testable in isolation.
//
// The bug they fix: a horizontal ScrollView whose contentContainerStyle only
// sets `minWidth: TABLE_WIDTH` pins the table to TABLE_WIDTH and leaves the rest
// of a wide viewport empty (a large dead gap on the right of a wide web window).
// The content container respects minWidth but does NOT stretch when the viewport
// is wider than minWidth.
//
// The fix is two cooperating fragments:
//   1. tableFillContentContainerStyle(width) — adds `flexGrow: 1` alongside the
//      existing `minWidth`, so the content container GROWS to fill the viewport
//      when it is wider than the table AND still SCROLLS when it is narrower
//      (minWidth keeps the columns from collapsing).
//   2. flexTableColumnStyle(width) — the one flexible content column grows to
//      absorb the extra width (`flexGrow: 1`) but never shrinks below its base
//      width (`flexShrink: 0`, `flexBasis: width`, `minWidth: width`), so on a
//      narrow viewport the column keeps its width and the row scrolls instead of
//      wrapping. The same fragment is applied to BOTH the header cell and the
//      body cell of that column, so the header and body column widths stay
//      identical and nothing misaligns when the column flexes.

/** Style applied to a fixed-width table column (header + body cell). */
export interface FixedColumnStyle {
  width: number;
}

/** Style applied to the single flexible content column (header + body cell). */
export interface FlexColumnStyle {
  flexGrow: number;
  flexShrink: number;
  flexBasis: number;
  minWidth: number;
}

/** Style applied to the horizontal ScrollView's contentContainerStyle. */
export interface TableFillContentContainerStyle {
  minWidth: number;
  flexGrow: number;
}

/**
 * Content-container style for the table's horizontal ScrollView.
 *
 * - On a WIDE viewport (≥ tableWidth) `flexGrow: 1` lets the content container
 *   stretch to fill the available width — no empty trailing gap.
 * - On a NARROW viewport (< tableWidth) `minWidth` keeps the content at least
 *   tableWidth so the ScrollView scrolls horizontally instead of collapsing.
 */
export function tableFillContentContainerStyle(tableWidth: number): TableFillContentContainerStyle {
  return { minWidth: tableWidth, flexGrow: 1 };
}

/**
 * Style for the single flexible content column (the column that should absorb
 * the slack on a wide viewport — e.g. the "Debate / Argument" column).
 *
 * `flexGrow: 1` lets it take the extra width; `flexShrink: 0` + `flexBasis` +
 * `minWidth` keep it from collapsing below its base width on a narrow viewport
 * (so the row scrolls rather than the column wrapping). Apply the SAME fragment
 * to the header cell and the body cell so their widths stay in lockstep.
 */
export function flexTableColumnStyle(width: number): FlexColumnStyle {
  return { flexGrow: 1, flexShrink: 0, flexBasis: width, minWidth: width };
}
