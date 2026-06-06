/**
 * OPS-ADMIN-ARGS-WEB-WIDTH-001 — wide-viewport fill behavior for the admin /
 * debate data tables.
 *
 * The bug: a horizontal ScrollView whose contentContainerStyle only sets
 * `minWidth: TABLE_WIDTH` pins the table to TABLE_WIDTH and leaves a dead gap on
 * the right of a wide web window. The fix is `flexGrow: 1` on the content
 * container (so it stretches to fill when the viewport is wider) combined with a
 * flexible content column (`flexGrow: 1` / `flexShrink: 0` / `flexBasis` /
 * `minWidth`) that absorbs the slack while still scrolling when the viewport is
 * narrower.
 *
 * Two layers of coverage:
 *   1. Pure unit tests of the helper fragments (no React, no renderer).
 *   2. Source-string assertions that BOTH AdminArgumentsTab and DebateListScreen
 *      wire the helper into the content container AND the Debate column header +
 *      body cell (so header/body column widths stay aligned).
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  tableFillContentContainerStyle,
  flexTableColumnStyle,
} from '../src/lib/responsiveTable';

describe('responsiveTable — tableFillContentContainerStyle', () => {
  it('retains minWidth so a NARROW viewport still scrolls horizontally', () => {
    const style = tableFillContentContainerStyle(1362);
    expect(style.minWidth).toBe(1362);
  });

  it('adds flexGrow so a WIDE viewport fills the available width (no dead gap)', () => {
    const style = tableFillContentContainerStyle(1362);
    expect(style.flexGrow).toBe(1);
  });

  it('threads the exact table width through (no hard-coded constant)', () => {
    expect(tableFillContentContainerStyle(999).minWidth).toBe(999);
    expect(tableFillContentContainerStyle(2048).minWidth).toBe(2048);
  });
});

describe('responsiveTable — flexTableColumnStyle (slack-absorbing content column)', () => {
  it('grows to absorb wide-viewport slack', () => {
    const style = flexTableColumnStyle(320);
    expect(style.flexGrow).toBe(1);
  });

  it('never shrinks below its base width on a narrow viewport (columns do not collapse)', () => {
    const style = flexTableColumnStyle(320);
    expect(style.flexShrink).toBe(0);
    expect(style.flexBasis).toBe(320);
    expect(style.minWidth).toBe(320);
  });

  it('uses the SAME base width for flexBasis and minWidth so header/body align', () => {
    const style = flexTableColumnStyle(320);
    expect(style.flexBasis).toBe(style.minWidth);
  });
});

describe('AdminArgumentsTab — wires the wide-fill fix without losing narrow scroll', () => {
  const repoRoot = process.cwd();
  const src = fs.readFileSync(
    path.join(repoRoot, 'src/features/admin/AdminArgumentsTab.tsx'),
    'utf8',
  );

  it('imports the shared responsive-table helpers', () => {
    expect(src).toMatch(/import\s*\{[^}]*tableFillContentContainerStyle[^}]*\}\s*from\s*'\.\.\/\.\.\/lib\/responsiveTable'/);
    expect(src).toContain('flexTableColumnStyle');
  });

  it('feeds the outer horizontal ScrollView content container through the fill helper', () => {
    expect(src).toContain('contentContainerStyle={tableFillContentContainerStyle(TABLE_WIDTH)}');
  });

  it('no longer pins the content container to a bare minWidth-only style', () => {
    expect(src).not.toContain('contentContainerStyle={{ minWidth: TABLE_WIDTH }}');
  });

  it('flexes the Debate / Argument column in BOTH the header and the body cell', () => {
    // Header flag.
    expect(src).toContain('<PlainHeader label="Debate / Argument" width={COL.debate} flexFill />');
    // Body cell uses the same flex fragment driven by COL.debate.
    expect(src).toContain('flexTableColumnStyle(COL.debate)');
  });

  it('retains TABLE_WIDTH (the minWidth source) so narrow viewports still scroll', () => {
    expect(src).toContain('const TABLE_WIDTH');
  });
});

describe('DebateListScreen — wires the same wide-fill fix', () => {
  const repoRoot = process.cwd();
  const src = fs.readFileSync(
    path.join(repoRoot, 'src/features/debates/DebateListScreen.tsx'),
    'utf8',
  );

  it('imports the shared responsive-table helpers', () => {
    expect(src).toMatch(/import\s*\{[^}]*tableFillContentContainerStyle[^}]*\}\s*from\s*'\.\.\/\.\.\/lib\/responsiveTable'/);
    expect(src).toContain('flexTableColumnStyle');
  });

  it('feeds the outer horizontal ScrollView content container through the fill helper', () => {
    expect(src).toContain('contentContainerStyle={tableFillContentContainerStyle(TABLE_WIDTH)}');
  });

  it('no longer pins the content container to a bare minWidth-only style', () => {
    expect(src).not.toContain('contentContainerStyle={{ minWidth: TABLE_WIDTH }}');
  });

  it('flexes the Debate column in BOTH the header and the body cell', () => {
    expect(src).toContain('<PlainHeader label="Debate" width={COL.debate} flexFill />');
    expect(src).toContain('flexTableColumnStyle(COL.debate)');
  });
});
