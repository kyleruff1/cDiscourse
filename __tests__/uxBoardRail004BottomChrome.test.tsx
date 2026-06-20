/**
 * UX-BOARD-RAIL-004 (SN-1) — BoardBottomChrome grouping wrapper.
 *
 * SN-1 groups the three loose bottom-chrome surfaces (Open Issues rail · seat-
 * availability strip · side action rail) into ONE calm, bordered board-bottom
 * region so they read as deliberate room chrome rather than three stray floating
 * decorations beneath the columns.
 *
 * This suite verifies the wrapper is a PURE presentational grouping:
 *   - `board-bottom-chrome` renders and CONTAINS the three real child testIDs
 *     (`open-issues-rail`, `seat-availability-strip`, `argument-side-action-rail`),
 *   - all three surfaces stay reachable (present) at phone / tablet / wide,
 *   - the wrapper's top boundary is a real `borderTopWidth` (geometry, not
 *     color-only — accessibility-targets §2),
 *   - the wrapper renders NO text / no hooks / no derivation of its own,
 *   - the surface source wires the bottom chrome THROUGH `<BoardBottomChrome>`
 *     (source-scan, mirroring uxBoardRail002Topology), with the single mediator-
 *     board derivation untouched and every child subtree preserved in order.
 *
 * Technique: the real three child components render in jsdom with their proven
 * fixtures, so the assertions use the REAL testIDs the components expose; the
 * surface-level wiring invariants are verified by SOURCE-SCAN (the established
 * pattern for the heavily source-scanned ArgumentGameSurface file).
 */
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { render } from '@testing-library/react-native';

import { BoardBottomChrome } from '../src/features/arguments/BoardBottomChrome';
import { OpenIssuesRail } from '../src/features/arguments/openIssuesRail/OpenIssuesRail';
import { SeatAvailabilityStrip } from '../src/features/arguments/SeatAvailabilityStrip';
import { ArgumentSideActionRail } from '../src/features/arguments/ArgumentSideActionRail';
import { buildOpenIssuesLedger } from '../src/features/arguments/openIssuesRail/openIssuesRailModel';
import {
  buildSeatAvailabilityViewModel,
  deriveSeatAvailability,
} from '../src/features/debates/seatClaimModel';
import { BORDER_WIDTH, SURFACE_TOKENS } from '../src/lib/designTokens';
import { makeRailCandidate, makeRailIssue } from './fixtures/openIssuesRailFixtures';

const ROOT = process.cwd();
const SURFACE_SRC = fs.readFileSync(
  path.resolve(ROOT, 'src/features/arguments/ArgumentGameSurface.tsx'),
  'utf8',
);
const WRAPPER_SRC = fs.readFileSync(
  path.resolve(ROOT, 'src/features/arguments/BoardBottomChrome.tsx'),
  'utf8',
);

const NOOP = () => {};

// ── fixtures ──────────────────────────────────────────────────────

function openIssuesLedger() {
  return buildOpenIssuesLedger(
    [makeRailCandidate(makeRailIssue({ id: 'a', burden: 'reply_owed' }), 1)],
    { maxEntries: 48 },
  );
}

function seatViewModel() {
  const availability = deriveSeatAvailability({
    visibility: 'public',
    activeParticipantCount: 2,
    knownReservedInviteCount: 0,
    viewerSide: null,
  });
  return buildSeatAvailabilityViewModel(availability, null);
}

/**
 * Render the wrapper with the three REAL bottom-chrome surfaces inside, mirroring
 * the exact composition `ArgumentGameSurface` passes into the `bottomChrome` slot
 * (Open Issues → seat strip → side action), at the given viewport width.
 */
function renderBottomChrome(width: number) {
  return render(
    <BoardBottomChrome>
      <OpenIssuesRail
        ledger={openIssuesLedger()}
        windowWidth={width}
        windowHeight={844}
        reduceMotionOverride
        onJump={NOOP}
        onInspect={NOOP}
        onMove={NOOP}
      />
      <SeatAvailabilityStrip viewModel={seatViewModel()} />
      <ArgumentSideActionRail
        viewerRole="observer"
        bubbleActor="other"
        onAction={NOOP}
        windowWidth={width}
        windowHeight={844}
        reduceMotionOverride
      />
    </BoardBottomChrome>,
  );
}

/** Recursively collect every rendered string from a renderer JSON tree. */
function collectText(node: unknown): string[] {
  if (node == null) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (typeof node === 'object') {
    const children = (node as { children?: unknown }).children;
    return collectText(children);
  }
  return [];
}

/** True when a testID is found within a rendered element subtree. */
function within(element: { props?: unknown }, testID: string): boolean {
  const found: string[] = [];
  collectTestIds(element, found);
  return found.includes(testID);
}

function collectTestIds(node: unknown, out: string[]): void {
  if (node == null || typeof node !== 'object') return;
  const props = (node as { props?: Record<string, unknown> }).props;
  if (props && typeof props.testID === 'string') out.push(props.testID);
  const children = (node as { props?: { children?: unknown } }).props?.children;
  if (Array.isArray(children)) {
    for (const child of children) collectTestIds(child, out);
  } else if (children) {
    collectTestIds(children, out);
  }
  const instChildren = (node as { children?: unknown }).children;
  if (Array.isArray(instChildren)) {
    for (const child of instChildren) collectTestIds(child, out);
  }
}

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, s) => ({ ...acc, ...flattenStyle(s) }),
      {},
    );
  }
  if (style && typeof style === 'object') return style as Record<string, unknown>;
  return {};
}

// ── viewport matrix (phone / tablet / wide) ───────────────────────

interface Cell {
  label: string;
  width: number;
}

const CELLS: ReadonlyArray<Cell> = Object.freeze([
  { label: '390 phone', width: 390 },
  { label: '1024 tablet', width: 1024 },
  { label: '1920 wide', width: 1920 },
]);

// ── 1. The wrapper contains the three real child surfaces ─────────

describe('UX-BOARD-RAIL-004 — board-bottom-chrome groups the three bottom surfaces', () => {
  it('renders board-bottom-chrome containing all three child testIDs', () => {
    const { getByTestId } = renderBottomChrome(1024);
    const wrapper = getByTestId('board-bottom-chrome');
    expect(wrapper).toBeTruthy();
    expect(within(wrapper, 'open-issues-rail')).toBe(true);
    expect(within(wrapper, 'seat-availability-strip')).toBe(true);
    expect(within(wrapper, 'argument-side-action-rail')).toBe(true);
  });
});

// ── 2. All three surfaces stay reachable at phone / tablet / wide ──

describe('UX-BOARD-RAIL-004 — all three surfaces reachable at every band', () => {
  for (const cell of CELLS) {
    it(`${cell.label}: open-issues-rail · seat-availability-strip · argument-side-action-rail all present`, () => {
      const { getByTestId } = renderBottomChrome(cell.width);
      expect(getByTestId('board-bottom-chrome')).toBeTruthy();
      expect(getByTestId('open-issues-rail')).toBeTruthy();
      expect(getByTestId('seat-availability-strip')).toBeTruthy();
      expect(getByTestId('argument-side-action-rail')).toBeTruthy();
    });
  }
});

// ── 3. The top boundary is real geometry, not color-only ──────────

describe('UX-BOARD-RAIL-004 — top boundary is geometry (not color-only)', () => {
  it('the wrapper container carries a real borderTopWidth > 0', () => {
    const { getByTestId } = renderBottomChrome(1024);
    const style = flattenStyle(getByTestId('board-bottom-chrome').props.style);
    expect(style.borderTopWidth).toBe(BORDER_WIDTH.sm);
    expect(BORDER_WIDTH.sm).toBeGreaterThan(0);
    // The border color exists too, but the WIDTH is the load-bearing signal —
    // the boundary is legible in grayscale because it is a geometry edge.
    expect(style.borderTopColor).toBe(SURFACE_TOKENS.border);
  });

  it('the wrapper source uses a borderTopWidth token (geometry, never a raw literal)', () => {
    expect(WRAPPER_SRC).toMatch(/borderTopWidth:\s*BORDER_WIDTH\.sm/);
  });
});

// ── 4. The wrapper renders no text / no hooks / no derivation ──────

describe('UX-BOARD-RAIL-004 — BoardBottomChrome is a pure presentational wrapper', () => {
  it('renders no <Text> of its own (only the child surfaces author text)', () => {
    // Render the wrapper with NON-text marker children: the wrapper must add no
    // string of its own, so the collected text comes only from children.
    const { toJSON } = render(
      <BoardBottomChrome>
        <></>
      </BoardBottomChrome>,
    );
    const texts = collectText(toJSON());
    expect(texts).toEqual([]);
  });

  it('the wrapper source authors no <Text>, no hooks, and no derivation', () => {
    expect(WRAPPER_SRC).not.toMatch(/<Text/);
    expect(WRAPPER_SRC).not.toMatch(/useState|useEffect|useMemo|useCallback|useRef/);
    expect(WRAPPER_SRC).not.toMatch(/deriveRoomMediatorBoardState|deriveMediatorBoardState/);
    // No Animated layout transition — grouping is an instant React render.
    expect(WRAPPER_SRC).not.toMatch(/Animated\.[A-Za-z]/);
  });
});

// ── 5. The surface wires the bottom chrome through BoardBottomChrome ─

describe('UX-BOARD-RAIL-004 — ArgumentGameSurface routes bottom chrome through the wrapper', () => {
  it('imports and mounts BoardBottomChrome in the surface', () => {
    expect(SURFACE_SRC).toMatch(/import \{ BoardBottomChrome \} from '\.\/BoardBottomChrome'/);
    expect(SURFACE_SRC).toContain('<BoardBottomChrome>');
    expect(SURFACE_SRC).toContain('</BoardBottomChrome>');
  });

  it('keeps the single mediator-board derivation untouched (===1)', () => {
    const calls = (SURFACE_SRC.match(/deriveRoomMediatorBoardState\(/g) ?? []).length;
    expect(calls).toBe(1);
  });

  it('keeps all three child subtrees mounted in the source order Open Issues → seat → Side Action', () => {
    const openIdx = SURFACE_SRC.indexOf('<OpenIssuesRail');
    const seatIdx = SURFACE_SRC.indexOf('<SeatAvailabilityStrip');
    const sideIdx = SURFACE_SRC.indexOf('<ArgumentSideActionRail');
    expect(openIdx).toBeGreaterThan(-1);
    expect(seatIdx).toBeGreaterThan(-1);
    expect(sideIdx).toBeGreaterThan(-1);
    expect(openIdx).toBeLessThan(seatIdx);
    expect(seatIdx).toBeLessThan(sideIdx);
    // The public-rooms-only guard on the seat strip is preserved.
    expect(SURFACE_SRC).toMatch(/seatAvailabilityViewModel \? \(\s*<SeatAvailabilityStrip/);
  });
});
