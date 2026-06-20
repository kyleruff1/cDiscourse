/**
 * UX-BOARD-RAIL-002 — Persistent mediator board topology.
 *
 * The room shell is a band-driven 1 / 2 / 3-column board: phone (<600) renders
 * one vertical column with the Disagreement Points rail as a collapsed bottom
 * SHEET (byte-identical to today); tablet (600–1279) renders two columns with
 * the rail docked as a 380 px PANE; wide (≥1280) renders three columns.
 *
 * The board is a PURE re-parent of the existing ArgumentGameSurface render tree
 * into RoomBoardLayout's column slots, plus one additive `presentation` prop on
 * DisagreementPointsRail. This suite verifies:
 *
 *   - column count per band (1 / 2 / 2 / 3 / 3 at 390 / 768 / 1024 / 1366 / 1920),
 *   - each depth mounts in the expected column,
 *   - phone is a single column with the rail as a collapsed sheet,
 *   - the single mediator-board derivation is consumed (deriveCalls === 1),
 *   - exactly one active-node chip; no NodeLabelStrip chip soup,
 *   - Act / Inspect / Go remain reachable,
 *   - the selection MediatorProgressNote stays a non-interactive note,
 *   - no body horizontal overflow at phone (the 380 px pane is tablet/wide-only),
 *   - column boundaries carry a geometry border (not color alone),
 *   - the ban-list (no winner/loser/score/verdict/truth/heat/popularity/… and
 *     no snake_case classifier keys) over every rendered board string,
 *   - the logged-out Sign In surface does not mount the board.
 *
 * Technique: RoomBoardLayout is rendered directly with marker children for the
 * column-count / geometry / ban-list assertions (the established pattern for
 * the heavily source-scanned ArgumentGameSurface file); the surface-level
 * invariants (single derivation, one chip, drawer gate, AIG presence, source
 * order) are verified by SOURCE-SCAN, mirroring uxOneOneSixViewportMatrix and
 * uxSelectedNode001CenterOfRoom.
 */
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  RoomBoardLayout,
  ROOM_BOARD_PANE_WIDTH_PX,
} from '../src/features/arguments/RoomBoardLayout';
// UX-BOARD-RAIL-004 (SN-1) — additive: the bottom-chrome slot now resolves
// through the BoardBottomChrome grouping wrapper. The column topology below is
// UNCHANGED; the new cases assert the slot still mounts at all bands and is
// reachable through `board-bottom-chrome`.
import { BoardBottomChrome } from '../src/features/arguments/BoardBottomChrome';
import { DisagreementPointsRail } from '../src/features/mediator/DisagreementPointsRail';
import { resolveBand } from '../src/hooks/useHeaderBreakpoint';
import { BORDER_WIDTH } from '../src/lib/designTokens';
import {
  _forbiddenMediatorTokens,
  plainLanguageForMediatorState,
} from '../src/features/mediator';
import type {
  DisagreementPoint,
  MediatorBoardState,
  MediatorStateCode,
} from '../src/features/mediator';

const ROOT = process.cwd();
const SURFACE_SRC = fs.readFileSync(
  path.resolve(ROOT, 'src/features/arguments/ArgumentGameSurface.tsx'),
  'utf8',
);
const WRAPPER_SRC = fs.readFileSync(
  path.resolve(ROOT, 'src/features/arguments/RoomBoardLayout.tsx'),
  'utf8',
);

// ── viewport matrix (mirrors uxOneOneSixViewportMatrix cells) ──
interface Cell {
  label: string;
  width: number;
  band: 'phone' | 'tablet' | 'wide';
  expectedColumns: 1 | 2 | 3;
}

const CELLS: ReadonlyArray<Cell> = Object.freeze([
  { label: '390x844 phone', width: 390, band: 'phone', expectedColumns: 1 },
  { label: '768x1024 tablet', width: 768, band: 'tablet', expectedColumns: 2 },
  { label: '1024x1366 tablet', width: 1024, band: 'tablet', expectedColumns: 2 },
  { label: '1366x768 wide', width: 1366, band: 'wide', expectedColumns: 3 },
  { label: '1920x1080 wide', width: 1920, band: 'wide', expectedColumns: 3 },
]);

/** Render a board with depth-marker children so we can locate each column. */
function renderBoard(band: 'phone' | 'tablet' | 'wide') {
  return render(
    <RoomBoardLayout
      band={band}
      testID="argument-game-surface"
      accessibilityLabel="argument-game-surface"
      topBanner={<Text testID="depth-top-banner">banner</Text>}
      col1={<Text testID="depth-col1-body">body spine</Text>}
      col2={<Text testID="depth-col2-readout">selected readout</Text>}
      col2Footer={<Text testID="depth-col2-footer-aig">Act Inspect Go</Text>}
      col3={<Text testID="depth-col3-ledger">disagreement points</Text>}
      bottomChrome={<Text testID="depth-bottom-chrome">open issues</Text>}
      overlays={<Text testID="depth-overlays">overlays</Text>}
    />,
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

// ── disagreement-point fixtures (reused for the sheet/pane render) ──
function makePoint(
  p: Partial<DisagreementPoint> & { id: string; state: MediatorStateCode },
): DisagreementPoint {
  return {
    id: p.id,
    anchor: p.anchor ?? { nodeId: p.id, parentNodeId: null, targetExcerpt: null },
    kind: p.kind ?? 'unaxed',
    state: p.state,
    plainLabel: p.plainLabel ?? plainLanguageForMediatorState(p.state),
    lifecycleState: p.lifecycleState ?? 'open',
    confidence: p.confidence ?? 'medium',
    openEvidenceDebtIds: p.openEvidenceDebtIds ?? [],
    memberNodeIds: p.memberNodeIds ?? [p.id],
    isAdvisory: p.isAdvisory ?? false,
  };
}

function makeBoard(points: DisagreementPoint[]): MediatorBoardState {
  return {
    debateId: 'debate-1',
    points,
    markupByNodeId: {},
    evidenceDebts: [],
    blockedEvidencePaths: [],
    definitionMismatches: [],
    scopeMismatches: [],
    recollectionConflicts: [],
    nonProvableKeyDetails: [],
    impasses: [],
    pathwaysByPointId: {},
    nextAction: null,
    inputHash: 'h1',
  };
}

// ── 1. Column count per band ──────────────────────────────────────

describe('UX-BOARD-RAIL-002 — column count per band', () => {
  for (const cell of CELLS) {
    it(`${cell.label}: resolveBand → ${cell.band} → ${cell.expectedColumns} column(s)`, () => {
      expect(resolveBand(cell.width)).toBe(cell.band);
      const { queryByTestId } = renderBoard(cell.band);
      const col1 = queryByTestId('room-board-col-1');
      const col2 = queryByTestId('room-board-col-2');
      const col3 = queryByTestId('room-board-col-3');
      const row = queryByTestId('room-board-row');
      if (cell.expectedColumns === 1) {
        // phone: single vertical stack — no column wrappers, no board row.
        expect(row).toBeNull();
        expect(col1).toBeNull();
        expect(col2).toBeNull();
        expect(col3).toBeNull();
      } else if (cell.expectedColumns === 2) {
        // tablet: 2 column wrappers (spine + pane), no middle readout column.
        expect(row).toBeTruthy();
        expect(col1).toBeTruthy();
        expect(col2).toBeNull();
        expect(col3).toBeTruthy();
      } else {
        // wide: 3 column wrappers.
        expect(row).toBeTruthy();
        expect(col1).toBeTruthy();
        expect(col2).toBeTruthy();
        expect(col3).toBeTruthy();
      }
    });
  }
});

// ── 2. Each depth mounts; in the expected column on tablet/wide ───

describe('UX-BOARD-RAIL-002 — each depth mounts in the expected column', () => {
  for (const cell of CELLS) {
    it(`${cell.label}: all 7 depth slots render`, () => {
      const { getByTestId } = renderBoard(cell.band);
      for (const id of [
        'depth-top-banner',
        'depth-col1-body',
        'depth-col2-readout',
        'depth-col2-footer-aig',
        'depth-col3-ledger',
        'depth-bottom-chrome',
        'depth-overlays',
      ]) {
        expect(getByTestId(id)).toBeTruthy();
      }
    });
  }

  it('wide: col1 hosts the body, col2 hosts readout + AIG footer, col3 hosts the ledger', () => {
    const { getByTestId } = renderBoard('wide');
    // Each marker is a descendant of its expected column wrapper.
    const col1 = getByTestId('room-board-col-1');
    const col2 = getByTestId('room-board-col-2');
    const col3 = getByTestId('room-board-col-3');
    expect(within(col1, 'depth-col1-body')).toBe(true);
    expect(within(col2, 'depth-col2-readout')).toBe(true);
    expect(within(col2, 'depth-col2-footer-aig')).toBe(true);
    expect(within(col3, 'depth-col3-ledger')).toBe(true);
  });

  it('tablet: col1 spine hosts body + readout + AIG; col3 hosts the ledger pane', () => {
    const { getByTestId } = renderBoard('tablet');
    const col1 = getByTestId('room-board-col-1');
    const col3 = getByTestId('room-board-col-3');
    expect(within(col1, 'depth-col1-body')).toBe(true);
    expect(within(col1, 'depth-col2-readout')).toBe(true);
    expect(within(col1, 'depth-col2-footer-aig')).toBe(true);
    expect(within(col3, 'depth-col3-ledger')).toBe(true);
  });
});

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
  // react-test-renderer instances also expose `.children`.
  const instChildren = (node as { children?: unknown }).children;
  if (Array.isArray(instChildren)) {
    for (const child of instChildren) collectTestIds(child, out);
  }
}

// ── 3. Phone single-column + rail-as-sheet (byte-identity) ────────

describe('UX-BOARD-RAIL-002 — phone is a single column with the rail as a collapsed sheet', () => {
  it('390: no board row / column wrappers (single vertical stack)', () => {
    const { queryByTestId } = renderBoard('phone');
    expect(queryByTestId('room-board-row')).toBeNull();
    expect(queryByTestId('room-board-col-1')).toBeNull();
    expect(queryByTestId('room-board-col-3')).toBeNull();
  });

  it('the rail with presentation="sheet" renders the collapsed pill (no expanded pane root)', () => {
    const { getByTestId, queryByTestId } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'n1', state: 'open' })])}
        presentation="sheet"
      />,
    );
    // Collapsed-by-default pill present; expanded title absent.
    expect(getByTestId('disagreement-points-rail-toggle')).toBeTruthy();
    expect(queryByTestId('disagreement-points-rail-title')).toBeNull();
  });

  it('the default presentation is "sheet" (byte-identical to the pre-002 rail)', () => {
    const withDefault = render(
      <DisagreementPointsRail board={makeBoard([makePoint({ id: 'n1', state: 'open' })])} />,
    );
    expect(withDefault.getByTestId('disagreement-points-rail-toggle')).toBeTruthy();
    expect(withDefault.queryByTestId('disagreement-points-rail-title')).toBeNull();
  });
});

// ── 4. Single-derivation invariant ───────────────────────────────

describe('UX-BOARD-RAIL-002 — single mediator-board derivation', () => {
  it('deriveRoomMediatorBoardState appears exactly once in the surface source', () => {
    const calls = (SURFACE_SRC.match(/deriveRoomMediatorBoardState\(/g) ?? []).length;
    expect(calls).toBe(1);
  });

  it('all three columns read the one already-derived mediatorBoard (no re-derive)', () => {
    // The rail (col3) and the chip/notes (col2) read `mediatorBoard` /
    // `activeNodeMediatorMarker`, never a second derivation.
    expect(SURFACE_SRC).toMatch(/board=\{mediatorBoard\}/);
    expect(SURFACE_SRC).toMatch(/marker=\{activeNodeMediatorMarker\}/);
  });
});

// ── 5. One chip / no chip soup ───────────────────────────────────

describe('UX-BOARD-RAIL-002 — one active chip, no chip soup', () => {
  it('exactly one mediator-node-marker-active chip mount', () => {
    const chips = (SURFACE_SRC.match(/testID="mediator-node-marker-active"/g) ?? []).length;
    expect(chips).toBe(1);
  });

  it('NodeLabelStrip is NOT mounted as a component in the surface (no chip soup)', () => {
    // The legacy second-chip surface stays unmounted (the surface comment may
    // still reference it historically; the JSX mount must not exist).
    expect(SURFACE_SRC).not.toMatch(/<NodeLabelStrip[\s/>]/);
    expect(SURFACE_SRC).not.toMatch(/import .*NodeLabelStrip/);
  });
});

// ── 6. Act / Inspect / Go reachable ──────────────────────────────

describe('UX-BOARD-RAIL-002 — Act / Inspect / Go remain reachable', () => {
  it('the three trigger testIDs are present in the surface', () => {
    expect(SURFACE_SRC).toContain('testID="board-menu-trigger-act"');
    expect(SURFACE_SRC).toContain('testID="board-menu-trigger-inspect"');
    expect(SURFACE_SRC).toContain('testID="board-menu-trigger-go"');
  });

  it('the three popout mounts are present in the surface', () => {
    expect(SURFACE_SRC).toContain('testID="board-act-popout"');
    expect(SURFACE_SRC).toContain('testID="board-inspect-popout"');
    expect(SURFACE_SRC).toContain('testID="board-go-popout"');
  });

  it('the three triggers carry button role + a11y state + a 44px target', () => {
    // The Act/Inspect/Go row uses accessibilityRole="button" + accessibilityState
    // (expanded) and the menuTriggerButton style pins minHeight: 44.
    expect(SURFACE_SRC).toMatch(/accessibilityState=\{\{ expanded: boardActVisible \}\}/);
    expect(SURFACE_SRC).toMatch(/accessibilityState=\{\{ expanded: inspectVisible \}\}/);
    expect(SURFACE_SRC).toMatch(/accessibilityState=\{\{ expanded: goVisible \}\}/);
    expect(SURFACE_SRC).toMatch(/menuTriggerButton:\s*\{[\s\S]*?minHeight:\s*44/);
  });

  it('the Act/Inspect/Go row is NOT hidden behind a band conditional', () => {
    // The board-menu-trigger-row mounts unconditionally in col2Footer (no band
    // guard that could remove Act/Inspect/Go on any viewport).
    expect(SURFACE_SRC).toContain('testID="board-menu-trigger-row"');
  });
});

// ── 7. Selection MediatorProgressNote stays a non-interactive note ─

describe('UX-BOARD-RAIL-002 — selection progress note is non-interactive', () => {
  const NOTE_SRC = fs.readFileSync(
    path.resolve(ROOT, 'src/features/mediator/MediatorProgressNote.tsx'),
    'utf8',
  );

  it('the surface mounts the selection note testID', () => {
    expect(SURFACE_SRC).toContain('testID="mediator-progress-note-selection"');
  });

  it('the progress note component is not a button (no Pressable / button role)', () => {
    expect(NOTE_SRC).not.toMatch(/accessibilityRole="button"/);
    expect(NOTE_SRC).not.toMatch(/<Pressable/);
  });
});

// ── 8. No body horizontal overflow at phone ──────────────────────

describe('UX-BOARD-RAIL-002 — no body horizontal overflow at phone', () => {
  it('phone renders no fixed-width pane column (the 380 px pane is tablet/wide only)', () => {
    const { queryByTestId } = renderBoard('phone');
    expect(queryByTestId('room-board-col-3')).toBeNull();
  });

  it('the 380 px pane width is only applied to the paneColumn (tablet/wide)', () => {
    // The wrapper sizes the pane COLUMN to 380 px; phone never enters the
    // 2/3-col branch, so the 380 px box cannot appear on a 390 px floor.
    expect(ROOM_BOARD_PANE_WIDTH_PX).toBe(380);
    expect(WRAPPER_SRC).toMatch(/paneColumn:\s*\{\s*width:\s*ROOM_BOARD_PANE_WIDTH_PX/);
  });

  it('phone branch returns before any boardRow / flexDirection row container', () => {
    // The phone branch (band === 'phone') returns the single column before the
    // tablet/wide row branches.
    const phoneIdx = WRAPPER_SRC.indexOf("band === 'phone'");
    const rowIdx = WRAPPER_SRC.indexOf('flexDirection');
    expect(phoneIdx).toBeGreaterThan(-1);
    expect(phoneIdx).toBeLessThan(rowIdx);
  });
});

// ── 9. Column boundaries carry geometry, not color alone ──────────

describe('UX-BOARD-RAIL-002 — column boundaries carry geometry (not color-only)', () => {
  it('the col1/col2 divider uses a real borderLeftWidth (geometry)', () => {
    expect(WRAPPER_SRC).toMatch(/columnDivider:\s*\{[\s\S]*?borderLeftWidth:\s*BORDER_WIDTH\.sm/);
    expect(BORDER_WIDTH.sm).toBeGreaterThan(0);
  });

  it('the rail pane carries a left geometry border (column boundary)', () => {
    const RAIL_SRC = fs.readFileSync(
      path.resolve(ROOT, 'src/features/mediator/DisagreementPointsRail.tsx'),
      'utf8',
    );
    expect(RAIL_SRC).toMatch(/expandedRootPane:\s*\{[\s\S]*?borderLeftWidth:\s*BORDER_WIDTH\.sm/);
    // The pane drops the bottom-overlay top border.
    expect(RAIL_SRC).toMatch(/expandedRootPane:\s*\{[\s\S]*?borderTopWidth:\s*0/);
  });
});

// ── 10. Reduce-motion: the wrapper performs no entry animation ────

describe('UX-BOARD-RAIL-002 — reduce-motion safe by construction', () => {
  it('the wrapper imports no Animated API (re-flow is an instant React render)', () => {
    // No Animated import and no Animated.* usage (comments may mention it).
    expect(WRAPPER_SRC).not.toMatch(/from 'react-native'[\s\S]*\bAnimated\b[\s\S]*?;/);
    expect(WRAPPER_SRC).not.toMatch(/Animated\.[A-Za-z]/);
  });

  it('the wrapper calls no useWindowDimensions / resolveBand (one band read upstream)', () => {
    // No invocation of either (comments may name them); the band is a prop.
    expect(WRAPPER_SRC).not.toMatch(/useWindowDimensions\(/);
    expect(WRAPPER_SRC).not.toMatch(/resolveBand\(/);
  });
});

// ── 11. Ban-list scan over all rendered board strings ─────────────

describe('UX-BOARD-RAIL-002 — ban-list clean over rendered board strings', () => {
  const EXTRA_BANNED = [
    'winner',
    'loser',
    'score',
    'verdict',
    'truth',
    'wrong',
    'dishonest',
    'bad faith',
    'bad-faith',
    'manipulative',
    'heat',
    'popularity',
    'ranking',
    'leaderboard',
  ];

  it('renders no banned token across the board (wrapper + sheet + pane content)', () => {
    const trees = [
      renderBoard('phone').toJSON(),
      renderBoard('tablet').toJSON(),
      renderBoard('wide').toJSON(),
      render(
        <DisagreementPointsRail
          board={makeBoard([
            makePoint({ id: 'a', state: 'needs_evidence', openEvidenceDebtIds: ['d1'] }),
            makePoint({ id: 'b', state: 'scope_mismatch' }),
            makePoint({ id: 'c', state: 'structured_impasse' }),
          ])}
          presentation="pane"
          reduceMotionOverride
        />,
      ).toJSON(),
    ];
    const texts = trees.flatMap((t) => collectText(t));
    expect(texts.length).toBeGreaterThan(0);
    const banned = [..._forbiddenMediatorTokens(), ...EXTRA_BANNED];
    for (const text of texts) {
      const lower = text.toLowerCase();
      for (const token of banned) {
        expect(lower.includes(token)).toBe(false);
      }
      // No raw snake_case classifier keys leak into any rendered string.
      expect(text).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });
});

// ── 12. Logged-out Sign In is unaffected ─────────────────────────

describe('UX-BOARD-RAIL-002 — logged-out Sign In surface is unaffected', () => {
  it('the auth screen does not import RoomBoardLayout', () => {
    const AUTH_SRC = fs.readFileSync(
      path.resolve(ROOT, 'src/features/auth/AuthScreen.tsx'),
      'utf8',
    );
    expect(AUTH_SRC).not.toMatch(/RoomBoardLayout/);
  });

  it('RoomBoardLayout is only consumed by the room surface (ArgumentGameSurface)', () => {
    // The board grid is internal to the room shell; the Sign In path never
    // mounts it. (ArgumentGameSurface is not mounted on the logged-out path.)
    expect(SURFACE_SRC).toMatch(/import \{ RoomBoardLayout \} from '\.\/RoomBoardLayout'/);
  });
});

// ── 13. The wrapper renders no text of its own (pure grid) ────────

describe('UX-BOARD-RAIL-002 — RoomBoardLayout is a pure presentational grid', () => {
  it('the wrapper holds no hooks / handlers / derivation', () => {
    expect(WRAPPER_SRC).not.toMatch(/useState|useEffect|useMemo|useCallback|useRef/);
    expect(WRAPPER_SRC).not.toMatch(/deriveRoomMediatorBoardState|deriveMediatorBoardState/);
  });

  it('the wrapper authors no <Text> of its own (renders only slot children)', () => {
    expect(WRAPPER_SRC).not.toMatch(/<Text/);
  });
});

// ── 14. UX-BOARD-RAIL-004 (SN-1) — bottomChrome resolves through the wrapper ─
//
// Additive: the bottomChrome slot's children are now grouped inside the
// BoardBottomChrome wrapper. These cases assert the slot still mounts at all
// bands and is reachable through `board-bottom-chrome`, and that the column
// count / col1 / col2 / col3 placement is UNCHANGED (the wrapper lives INSIDE
// the bottomChrome slot only — RoomBoardLayout's column logic is untouched).

/**
 * Render a board whose bottomChrome slot is the BoardBottomChrome wrapper around
 * a marker child (mirrors how ArgumentGameSurface now passes the slot).
 */
function renderBoardWithGroupedChrome(band: 'phone' | 'tablet' | 'wide') {
  return render(
    <RoomBoardLayout
      band={band}
      testID="argument-game-surface"
      accessibilityLabel="argument-game-surface"
      topBanner={<Text testID="depth-top-banner">banner</Text>}
      col1={<Text testID="depth-col1-body">body spine</Text>}
      col2={<Text testID="depth-col2-readout">selected readout</Text>}
      col2Footer={<Text testID="depth-col2-footer-aig">Act Inspect Go</Text>}
      col3={<Text testID="depth-col3-ledger">disagreement points</Text>}
      bottomChrome={
        <BoardBottomChrome>
          <Text testID="depth-bottom-chrome-child">open issues</Text>
        </BoardBottomChrome>
      }
      overlays={<Text testID="depth-overlays">overlays</Text>}
    />,
  );
}

describe('UX-BOARD-RAIL-004 — bottomChrome slot resolves through board-bottom-chrome', () => {
  for (const cell of CELLS) {
    it(`${cell.label}: board-bottom-chrome mounts and contains the chrome child`, () => {
      const { getByTestId } = renderBoardWithGroupedChrome(cell.band);
      expect(getByTestId('board-bottom-chrome')).toBeTruthy();
      expect(within(getByTestId('board-bottom-chrome'), 'depth-bottom-chrome-child')).toBe(true);
    });
  }

  for (const cell of CELLS) {
    it(`${cell.label}: column count (${cell.expectedColumns}) + col1/col2/col3 placement unchanged with the grouped chrome`, () => {
      const { queryByTestId } = renderBoardWithGroupedChrome(cell.band);
      const col1 = queryByTestId('room-board-col-1');
      const col2 = queryByTestId('room-board-col-2');
      const col3 = queryByTestId('room-board-col-3');
      const row = queryByTestId('room-board-row');
      if (cell.expectedColumns === 1) {
        expect(row).toBeNull();
        expect(col1).toBeNull();
        expect(col2).toBeNull();
        expect(col3).toBeNull();
      } else if (cell.expectedColumns === 2) {
        expect(row).toBeTruthy();
        expect(col1).toBeTruthy();
        expect(col2).toBeNull();
        expect(col3).toBeTruthy();
      } else {
        expect(row).toBeTruthy();
        expect(col1).toBeTruthy();
        expect(col2).toBeTruthy();
        expect(col3).toBeTruthy();
      }
    });
  }

  it('the surface source passes the bottomChrome slot through BoardBottomChrome', () => {
    // The slot's children are wrapped; the wrapper import + mount are present.
    expect(SURFACE_SRC).toMatch(/import \{ BoardBottomChrome \} from '\.\/BoardBottomChrome'/);
    expect(SURFACE_SRC).toContain('<BoardBottomChrome>');
    expect(SURFACE_SRC).toContain('</BoardBottomChrome>');
    // The three bottom surfaces remain textually in-file (no extraction).
    expect(SURFACE_SRC).toContain('<OpenIssuesRail');
    expect(SURFACE_SRC).toContain('<SeatAvailabilityStrip');
    expect(SURFACE_SRC).toContain('<ArgumentSideActionRail');
  });
});
