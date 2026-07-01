/**
 * VISUAL-SIMPLIFY-002 — analysis surfaces on-demand.
 *
 * The default room view leads with the conversation (spine + bubbles +
 * composer + ≤3 friendly flags). The three dense analysis surfaces — the
 * Disagreement Points board, the Open Issues rail's expansion, and the Mediator
 * readout (ArgumentScoreTracker) — are each reachable on demand (a calm,
 * verdict-free trigger) and DISMISSED BY DEFAULT on every band. There is no
 * permanent 380 px analysis pane in the default room view.
 *
 * The machinery (DisagreementPointsRail / OpenIssuesRail / ArgumentScoreTracker
 * components, the single mediator-board derivation, the single-owner
 * bottom-chrome exclusion) is KEPT — only visibility is re-scoped.
 *
 * Technique (mirrors uxBoardRail002Topology + the heavily source-scanned
 * ArgumentGameSurface pattern):
 *   - RoomBoardLayout is rendered directly for the col3-truthy paneColumn guard.
 *   - The real ArgumentGameSurface (via DemoCorridorScreen) proves the default
 *     view mounts NO analysis surface.
 *   - The DisagreementPointsRail is rendered directly to prove it still mounts
 *     when summoned (component unchanged).
 *   - Surface-level invariants (the selector, mount gating, single-owner
 *     exclusion, single derivation, a11y, ban-list of trigger copy) are verified
 *     by SOURCE-SCAN — the established pattern for this file.
 */
import * as fs from 'fs';
import * as path from 'path';
import React from 'react';
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { RoomBoardLayout } from '../src/features/arguments/RoomBoardLayout';
import { DisagreementPointsRail } from '../src/features/mediator/DisagreementPointsRail';
import {
  _forbiddenMediatorTokens,
  plainLanguageForMediatorState,
} from '../src/features/mediator';
import type {
  DisagreementPoint,
  MediatorBoardState,
  MediatorStateCode,
} from '../src/features/mediator';
import { AppSessionProvider } from '../src/features/session/AppSessionProvider';
import { DemoCorridorScreen } from '../src/features/demoCorridor/DemoCorridorScreen';

const ROOT = process.cwd();
const SURFACE_SRC = fs.readFileSync(
  path.resolve(ROOT, 'src/features/arguments/ArgumentGameSurface.tsx'),
  'utf8',
);
const WRAPPER_SRC = fs.readFileSync(
  path.resolve(ROOT, 'src/features/arguments/RoomBoardLayout.tsx'),
  'utf8',
);

// ── fixtures (reused from the topology suite) ──
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

function mountDemo() {
  return render(
    <AppSessionProvider>
      <DemoCorridorScreen onExit={() => {}} />
    </AppSessionProvider>,
  );
}

// ── 1. RoomBoardLayout renders room-board-col-3 ONLY when col3 is truthy ──

describe('VISUAL-SIMPLIFY-002 — col3 paneColumn is on-demand (truthy col3 only)', () => {
  for (const band of ['tablet', 'wide'] as const) {
    it(`${band}: col3 truthy → the 380px paneColumn mounts (unchanged when summoned)`, () => {
      const { queryByTestId } = render(
        <RoomBoardLayout
          band={band}
          col1={<Text testID="c1">c1</Text>}
          col2={<Text testID="c2">c2</Text>}
          col2Footer={<Text testID="c2f">c2f</Text>}
          col3={<Text testID="c3">summoned pane</Text>}
        />,
      );
      expect(queryByTestId('room-board-col-3')).toBeTruthy();
      expect(queryByTestId('c3')).toBeTruthy();
      // col1/col2 placement is unchanged either way.
      expect(queryByTestId('room-board-col-1')).toBeTruthy();
    });

    it(`${band}: col3 null → NO paneColumn reserves space (default room view)`, () => {
      const { queryByTestId } = render(
        <RoomBoardLayout
          band={band}
          col1={<Text testID="c1">c1</Text>}
          col2={<Text testID="c2">c2</Text>}
          col2Footer={<Text testID="c2f">c2f</Text>}
          col3={null}
        />,
      );
      expect(queryByTestId('room-board-col-3')).toBeNull();
      // The spine column is unaffected — the conversation still renders.
      expect(queryByTestId('room-board-col-1')).toBeTruthy();
      expect(queryByTestId('c1')).toBeTruthy();
    });
  }

  it('phone: col3 null → nothing mounted in the vertical stack (no board row)', () => {
    const { queryByTestId } = render(
      <RoomBoardLayout
        band="phone"
        col1={<Text testID="c1">c1</Text>}
        col2={<Text testID="c2">c2</Text>}
        col2Footer={<Text testID="c2f">c2f</Text>}
        col3={null}
      />,
    );
    expect(queryByTestId('room-board-row')).toBeNull();
    expect(queryByTestId('room-board-col-3')).toBeNull();
    // The conversation-side slots still render on phone.
    expect(queryByTestId('c1')).toBeTruthy();
  });

  it('the wrapper guards BOTH the tablet and wide paneColumn with a col3 truthy check', () => {
    const guards = (WRAPPER_SRC.match(/\{col3 \? \(/g) ?? []).length;
    expect(guards).toBe(2);
  });
});

// ── 2. Default room view (real surface) mounts NO analysis surface ──

describe('VISUAL-SIMPLIFY-002 — default room view is conversation-only', () => {
  it('the real ArgumentGameSurface mounts NO Disagreement pane by default', () => {
    const r = mountDemo();
    expect(r.queryByTestId('disagreement-points-rail')).toBeNull();
    // No permanent 380 px docked analysis column.
    expect(r.queryByTestId('room-board-col-3')).toBeNull();
  });

  it('the real ArgumentGameSurface mounts NO Mediator readout (ArgumentScoreTracker) by default', () => {
    const r = mountDemo();
    expect(r.queryByTestId('argument-score-tracker')).toBeNull();
  });

  it('the conversation-side chrome (Open Issues collapsed chip) is still present as default bottom chrome', () => {
    const r = mountDemo();
    // OpenIssuesRail keeps its collapsed-chip affordance (machinery kept); its
    // EXPANSION routes through the selector, but the chip itself is not gated.
    expect(r.queryByTestId('open-issues-rail')).toBeTruthy();
  });
});

// ── 3. The summoned Disagreement rail still mounts (component unchanged) ──

describe('VISUAL-SIMPLIFY-002 — summoned surfaces still render (machinery kept)', () => {
  it('DisagreementPointsRail with presentation="pane" mounts its title when summoned', () => {
    const { getByTestId } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'n1', state: 'open' })])}
        presentation="pane"
        reduceMotionOverride
      />,
    );
    // Pane is expanded-by-default (the shipped behavior) — the title proves the
    // component was NOT altered to collapse the pane.
    expect(getByTestId('disagreement-points-rail-title')).toBeTruthy();
    // The collapse control (reused as the dismiss affordance) is present.
    expect(getByTestId('disagreement-points-rail-collapse')).toBeTruthy();
  });
});

// ── 4. Selector state shape: single key, default null, mutual exclusion ──

describe('VISUAL-SIMPLIFY-002 — a single selector gates every analysis surface', () => {
  it('declares the AnalysisSurfaceKey union (disagreement | open_issues | readout | null)', () => {
    expect(SURFACE_SRC).toMatch(
      /type AnalysisSurfaceKey = 'disagreement' \| 'open_issues' \| 'readout' \| null;/,
    );
  });

  it('the selector defaults to null (nothing mounted on every band)', () => {
    expect(SURFACE_SRC).toMatch(
      /useState<AnalysisSurfaceKey>\(null\)/,
    );
  });

  it('the disagreement pane mount is gated on the selector', () => {
    expect(SURFACE_SRC).toMatch(/activeAnalysisSurface === 'disagreement' \? \(/);
  });

  it('the Mediator readout (ArgumentScoreTracker) mount is gated on the selector', () => {
    // The verbatim mount-site substring is preserved (uxOneOneTwoChromeLayerRemovals),
    // wrapped by the readout selector branch.
    expect(SURFACE_SRC).toContain('<ArgumentScoreTracker trends={participantTrends} />');
    expect(SURFACE_SRC).toMatch(
      /activeAnalysisSurface === 'readout' \? \(\s*<ArgumentScoreTracker trends=\{participantTrends\} \/>/,
    );
  });

  it('the compact TimelineSelectedReadoutPanel mount is NOT gated (stays default line-of-sight)', () => {
    // The compact selected-message readout is conversation line-of-sight — it is
    // present and NOT wrapped by an activeAnalysisSurface gate.
    const compactIdx = SURFACE_SRC.indexOf('<TimelineSelectedReadoutPanel');
    expect(compactIdx).toBeGreaterThan(-1);
    const window = SURFACE_SRC.slice(compactIdx - 200, compactIdx);
    expect(window).not.toMatch(/activeAnalysisSurface ===[^?]*\? \(\s*<TimelineSelectedReadoutPanel/);
  });
});

// ── 5. Single-owner exclusion: opening the side rail closes analysis ──

describe('VISUAL-SIMPLIFY-002 — single-owner exclusion is extended, not duplicated', () => {
  it('expanding the side action rail clears any open analysis surface', () => {
    // handleRailExpandedChange sets the selector to null on expand.
    const handlerIdx = SURFACE_SRC.indexOf('const handleRailExpandedChange');
    const slice = SURFACE_SRC.slice(handlerIdx, handlerIdx + 800);
    expect(slice).toMatch(/setActiveAnalysisSurface\(null\)/);
  });

  it('summoning the Disagreement pane or Mediator readout force-collapses the Open Issues rail', () => {
    const handlerIdx = SURFACE_SRC.indexOf('const handleOpenAnalysisSurface');
    const slice = SURFACE_SRC.slice(handlerIdx, handlerIdx + 900);
    expect(slice).toMatch(/setOpenIssuesRailExpanded\(false\)/);
  });

  it('the existing bottom-rail exclusion booleans are RETAINED (not replaced)', () => {
    expect(SURFACE_SRC).toMatch(/disagreementPointsRailExpanded/);
    expect(SURFACE_SRC).toMatch(/openIssuesRailExpanded/);
    expect(SURFACE_SRC).toMatch(/sideRailExpanded/);
  });
});

// ── 6. Single mediator-board derivation preserved (no re-derive in a drawer) ──

describe('VISUAL-SIMPLIFY-002 — single mediator-board derivation preserved', () => {
  it('deriveRoomMediatorBoardState appears exactly once in the surface source', () => {
    const calls = (SURFACE_SRC.match(/deriveRoomMediatorBoardState\(/g) ?? []).length;
    expect(calls).toBe(1);
  });

  it('the summoned pane still reads the one already-derived mediatorBoard', () => {
    expect(SURFACE_SRC).toMatch(/board=\{mediatorBoard\}/);
    // No second derivation was moved into a drawer/handler.
    expect(SURFACE_SRC).not.toMatch(/deriveMediatorBoardState\(/);
  });
});

// ── 7. a11y on every new trigger ──

describe('VISUAL-SIMPLIFY-002 — a11y on every on-demand trigger', () => {
  const TRIGGERS = [
    { testID: 'board-menu-trigger-disagreement', key: 'disagreement' },
    { testID: 'board-menu-trigger-openissues', key: 'open_issues' },
    { testID: 'board-menu-trigger-readout', key: 'readout' },
  ];

  it('the three calm triggers are present in the analysis trigger row', () => {
    expect(SURFACE_SRC).toContain('testID="board-analysis-trigger-row"');
    for (const t of TRIGGERS) {
      expect(SURFACE_SRC).toContain(`testID="${t.testID}"`);
    }
  });

  it('every trigger carries button role + descriptive label + accessibilityState.expanded', () => {
    // Count of button-role triggers in the analysis row region.
    const rowIdx = SURFACE_SRC.indexOf('testID="board-analysis-trigger-row"');
    const rowSlice = SURFACE_SRC.slice(rowIdx, rowIdx + 2200);
    for (const t of TRIGGERS) {
      expect(rowSlice).toMatch(
        new RegExp(`accessibilityState=\\{\\{ expanded: activeAnalysisSurface === '${t.key}' \\}\\}`),
      );
    }
    const roleCount = (rowSlice.match(/accessibilityRole="button"/g) ?? []).length;
    expect(roleCount).toBe(3);
    // Descriptive labels (not just the visible text).
    expect(rowSlice).toContain('accessibilityLabel="Open disagreement points"');
    expect(rowSlice).toContain('accessibilityLabel="Open the open issues list"');
    expect(rowSlice).toContain('accessibilityLabel="Open mediator readout"');
  });

  it('every trigger reuses the ≥44px target (menuTriggerButton minHeight 44 + hitSlop)', () => {
    const rowIdx = SURFACE_SRC.indexOf('testID="board-analysis-trigger-row"');
    const rowSlice = SURFACE_SRC.slice(rowIdx, rowIdx + 2200);
    const styleCount = (rowSlice.match(/style=\{styles\.menuTriggerButton\}/g) ?? []).length;
    expect(styleCount).toBe(3);
    const hitSlopCount = (rowSlice.match(/hitSlop=\{\{ top: 8, bottom: 8, left: 8, right: 8 \}\}/g) ?? [])
      .length;
    expect(hitSlopCount).toBe(3);
    // menuTriggerButton pins minHeight 44 (reused token, not a new one).
    expect(SURFACE_SRC).toMatch(/menuTriggerButton:\s*\{[\s\S]*?minHeight:\s*44/);
  });
});

// ── 8. Reduce-motion: no new animation ──

describe('VISUAL-SIMPLIFY-002 — reduce-motion safe (snap mount/unmount)', () => {
  it('the analysis trigger row style adds no Animated import to RoomBoardLayout', () => {
    expect(WRAPPER_SRC).not.toMatch(/Animated\.[A-Za-z]/);
    expect(WRAPPER_SRC).not.toMatch(/from 'react-native'[\s\S]*\bAnimated\b[\s\S]*?;/);
  });

  it('the summoned pane suppresses its entry animation under reduce-motion', () => {
    const RAIL_SRC = fs.readFileSync(
      path.resolve(ROOT, 'src/features/mediator/DisagreementPointsRail.tsx'),
      'utf8',
    );
    // The rail already snaps (no entry animation) for pane / reduced-motion.
    expect(RAIL_SRC).toMatch(/presentation === 'pane'/);
  });
});

// ── 9. Ban-list / doctrine over the trigger copy + summoned surfaces ──

describe('VISUAL-SIMPLIFY-002 — ban-list clean over triggers + summoned surfaces', () => {
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

  it('the on-demand trigger labels are verdict-free plain language (reused rail titles)', () => {
    const rowIdx = SURFACE_SRC.indexOf('testID="board-analysis-trigger-row"');
    const rowSlice = SURFACE_SRC.slice(rowIdx, rowIdx + 2200).toLowerCase();
    for (const token of EXTRA_BANNED) {
      expect(rowSlice.includes(token)).toBe(false);
    }
  });

  it('the summoned Disagreement pane renders no banned token', () => {
    const tree = render(
      <DisagreementPointsRail
        board={makeBoard([
          makePoint({ id: 'a', state: 'needs_evidence', openEvidenceDebtIds: ['d1'] }),
          makePoint({ id: 'b', state: 'scope_mismatch' }),
          makePoint({ id: 'c', state: 'structured_impasse' }),
        ])}
        presentation="pane"
        reduceMotionOverride
      />,
    ).toJSON();
    const texts = collectText(tree);
    expect(texts.length).toBeGreaterThan(0);
    const banned = [..._forbiddenMediatorTokens(), ...EXTRA_BANNED];
    for (const text of texts) {
      const lower = text.toLowerCase();
      for (const token of banned) {
        expect(lower.includes(token)).toBe(false);
      }
      expect(text).not.toMatch(/[a-z]+_[a-z]+/);
    }
  });

  it('the default room view introduces no NEW banned token (only pre-existing doctrine-compliant strings)', () => {
    // VISUAL-SIMPLIFY-002 changes VISIBILITY, not copy. The only ban-list
    // substrings in the default demo render are pre-existing, doctrine-compliant
    // strings owned by other cards:
    //   - "…advisory, not a verdict." (uses "verdict" to DENY a verdict — §1)
    //   - "Heat: —" ("heat" = ACTIVITY, never truth/consensus — §2)
    // This card adds NONE. We assert the offending substrings are only ever
    // these two doctrine-safe phrasings (any new leak fails here).
    const texts = collectText(mountDemo().toJSON());
    expect(texts.length).toBeGreaterThan(0);
    const ALLOWED_CONTEXTS = [/advisory, not a verdict/i, /^heat:/i];
    for (const text of texts) {
      const lower = text.toLowerCase();
      for (const token of EXTRA_BANNED) {
        if (lower.includes(token)) {
          expect(ALLOWED_CONTEXTS.some((re) => re.test(text.trim()))).toBe(true);
        }
      }
    }
  });
});
