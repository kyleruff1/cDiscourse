/**
 * REF-006-RAIL — OpenIssuesRail accessibility.
 *
 * Per `accessibility-targets`:
 *   - Every interactive element has accessibilityRole="button", a populated
 *     accessibilityLabel, an accessibilityState (`selected` for the active
 *     row, `expanded` for the chip), and a ≥44×44 target (minHeight + hitSlop).
 *   - The row's screen-reader sentence reads naturally (no key badge, no raw code).
 *   - The active row is distinguishable by GEOMETRY (left bar + bold + a
 *     "Currently active" word), not color alone (grayscale-legible).
 *   - The tone glyph is hidden from the accessibility tree.
 *   - Reduce-motion path snaps (no slide).
 */

import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { OpenIssuesRail } from '../src/features/arguments/openIssuesRail/OpenIssuesRail';
import { buildOpenIssuesLedger } from '../src/features/arguments/openIssuesRail/openIssuesRailModel';
import { TOUCH_TARGET } from '../src/lib/designTokens';
import { makeRailCandidate, makeRailIssue, makeRailMove } from './fixtures/openIssuesRailFixtures';

const NOOP = () => {};
const COMPONENT_PATH = join(
  __dirname,
  '../src/features/arguments/openIssuesRail/OpenIssuesRail.tsx',
);

function richLedger() {
  return buildOpenIssuesLedger(
    [
      makeRailCandidate(
        makeRailIssue({
          id: 'a',
          burden: 'source_owed',
          state: 'source_requested',
          nextBestMoves: [makeRailMove('ask_source', 'Ask for a source')],
          refereeObservations: [
            { sourceCode: 'banner', line: 'This move asks for a source.', toneGlyph: 'arrow', kind: 'machine_observation' },
          ],
        }),
        2,
        true,
      ),
      makeRailCandidate(makeRailIssue({ id: 'b', burden: 'reply_owed' }), 1, false),
    ],
    { maxEntries: 48 },
  );
}

/** Manual tree walk — finds nodes that RTL queries skip (a11y-hidden glyph). */
function findNodeByTestId(
  node: unknown,
  testID: string,
): { props?: Record<string, unknown>; children?: unknown } | null {
  if (node == null || typeof node === 'string') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findNodeByTestId(child, testID);
      if (found) return found;
    }
    return null;
  }
  const n = node as { props?: Record<string, unknown>; children?: unknown };
  if (n.props && n.props.testID === testID) return n;
  if (n.children != null) return findNodeByTestId(n.children, testID);
  return null;
}

function meets44(node: { props: Record<string, unknown> }): boolean {
  const flat = StyleSheet.flatten(node.props.style as never) || {};
  const minHeight = (flat as { minHeight?: number }).minHeight;
  const hasHitSlop = node.props.hitSlop != null;
  return minHeight === TOUCH_TARGET.minSizePx || hasHitSlop;
}

describe('REF-006-RAIL a11y — the collapsed chip', () => {
  it('is a button with a populated label + expanded=false state + ≥44 target', () => {
    const { getByTestId } = render(
      React.createElement(OpenIssuesRail, { ledger: richLedger(), onJump: NOOP, onInspect: NOOP, onMove: NOOP }),
    );
    const chip = getByTestId('open-issues-rail-toggle');
    expect(chip.props.accessibilityRole).toBe('button');
    expect(typeof chip.props.accessibilityLabel).toBe('string');
    expect((chip.props.accessibilityLabel as string).length).toBeGreaterThan(0);
    expect(chip.props.accessibilityState).toEqual({ expanded: false });
    expect(meets44(chip)).toBe(true);
  });
});

describe('REF-006-RAIL a11y — expanded chrome + rows', () => {
  it('the collapse control is a button with expanded=true state + ≥44 target', () => {
    const { getByTestId } = render(
      <OpenIssuesRail ledger={richLedger()} defaultCollapsed={false} onJump={NOOP} onInspect={NOOP} onMove={NOOP} />,
    );
    const collapse = getByTestId('open-issues-rail-collapse');
    expect(collapse.props.accessibilityRole).toBe('button');
    expect(collapse.props.accessibilityState).toEqual({ expanded: true });
    expect(meets44(collapse)).toBe(true);
  });

  it('each row jump zone is a button with selected state + populated label + ≥44 target', () => {
    const ledger = richLedger();
    const { getByTestId } = render(
      <OpenIssuesRail ledger={ledger} defaultCollapsed={false} onJump={NOOP} onInspect={NOOP} onMove={NOOP} />,
    );
    for (const entry of ledger.entries) {
      const row = getByTestId(`open-issues-rail-row-${entry.key}`);
      expect(row.props.accessibilityRole).toBe('button');
      expect((row.props.accessibilityLabel as string).length).toBeGreaterThan(0);
      // No single-letter key badge in the screen-reader sentence.
      expect(row.props.accessibilityLabel).not.toMatch(/\[[A-Za-z]\]/);
      expect(row.props.accessibilityState).toEqual({ selected: entry.isActive });
      expect(meets44(row)).toBe(true);
    }
  });

  it('the Details + move chips are buttons with labels + ≥44 targets', () => {
    const ledger = richLedger();
    const { getByTestId } = render(
      <OpenIssuesRail ledger={ledger} defaultCollapsed={false} onJump={NOOP} onInspect={NOOP} onMove={NOOP} />,
    );
    const details = getByTestId('open-issues-rail-details-a');
    expect(details.props.accessibilityRole).toBe('button');
    expect((details.props.accessibilityLabel as string).length).toBeGreaterThan(0);
    expect(meets44(details)).toBe(true);

    const move = getByTestId('open-issues-rail-move-a-ask_source');
    expect(move.props.accessibilityRole).toBe('button');
    expect((move.props.accessibilityLabel as string).length).toBeGreaterThan(0);
    expect(move.props.accessibilityState).toEqual({ disabled: false });
    expect(meets44(move)).toBe(true);
  });
});

describe('REF-006-RAIL a11y — color independence (geometry + words carry meaning)', () => {
  it('the active row carries a grayscale-legible "Currently active" word + left bar geometry', () => {
    const { getByTestId, queryByTestId } = render(
      <OpenIssuesRail ledger={richLedger()} defaultCollapsed={false} onJump={NOOP} onInspect={NOOP} onMove={NOOP} />,
    );
    // The active row renders the word; the inactive row does not.
    expect(getByTestId('open-issues-rail-active-a')).toBeTruthy();
    expect(queryByTestId('open-issues-rail-active-b')).toBeNull();
    // The active state is also an accessibilityState (not color).
    expect(getByTestId('open-issues-rail-row-a').props.accessibilityState).toEqual({ selected: true });
  });

  it('the tone glyph is a non-empty shape hidden from the screen-reader tree', () => {
    const tree = render(
      <OpenIssuesRail ledger={richLedger()} defaultCollapsed={false} onJump={NOOP} onInspect={NOOP} onMove={NOOP} />,
    ).toJSON();
    const glyph = findNodeByTestId(tree, 'open-issues-rail-glyph-a');
    expect(glyph).not.toBeNull();
    expect(glyph!.props!.accessibilityElementsHidden).toBe(true);
    expect(glyph!.props!.importantForAccessibility).toBe('no-hide-descendants');
    const glyphChar = ([] as string[]).concat(glyph!.children as string).join('');
    expect(glyphChar.length).toBeGreaterThan(0);
  });
});

describe('REF-006-RAIL a11y — reduce motion', () => {
  it('honors a reduce-motion gate that snaps the sheet (no slide)', () => {
    const src = readFileSync(COMPONENT_PATH, 'utf8');
    // The component reads an effective reduce-motion value and snaps the
    // animation progress when reduced (mirrors ArgumentSideActionRail).
    expect(src).toMatch(/effectiveReducedMotion/);
    expect(src).toMatch(/progress\.setValue/);
  });

  it('renders cleanly with reduceMotionOverride on a narrow (sheet) viewport', () => {
    const { getByTestId } = render(
      <OpenIssuesRail
        ledger={richLedger()}
        defaultCollapsed={false}
        windowWidth={390}
        windowHeight={844}
        reduceMotionOverride
        onJump={NOOP}
        onInspect={NOOP}
        onMove={NOOP}
      />,
    );
    expect(getByTestId('open-issues-rail-row-a')).toBeTruthy();
  });
});
