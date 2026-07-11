/**
 * A11Y-693 (folded amendment UX-BOARD-A11Y-AXIS-001) — mediator board-axis
 * color-independence guard.
 *
 * Locks the already-green mediator board reality against regression:
 *   - every live V4 display state (11) renders a paired text label + a non-empty
 *     accessibilityLabel on both MediatorNodeMarker and DisagreementPointsRail
 *     (no state signaled by color alone).
 *   - the disagreement axis (DisagreementPointKind, 9) is never surfaced as a
 *     colored dot or a per-kind element (point.kind is a data field, not a mark).
 *   - no red/green verdict pairing in the rendered palette (source + render).
 *   - a firing negative control proves the guard bites.
 *   - every rendered mediator string is ban-list clean.
 *
 * Asserts over the REAL vocabularies (ALL_V4_MEDIATOR_STATE_CODES +
 * DisagreementPointKind), not the v4 design-package subset. Comments are
 * apostrophe-free for the naive quote-parity doctrine scanner.
 */
import React from 'react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { DisagreementPointsRail } from '../src/features/mediator/DisagreementPointsRail';
import { MediatorNodeMarker } from '../src/features/mediator/MediatorNodeMarker';
import {
  ALL_V4_MEDIATOR_STATE_CODES,
  plainLanguageForMediatorState,
  _forbiddenMediatorTokens,
} from '../src/features/mediator';
import type {
  DisagreementPoint,
  DisagreementPointKind,
  MediatorBoardState,
  MediatorStateCode,
} from '../src/features/mediator';
import type { NodeMediatorMarker } from '../src/features/mediator/nodeMediatorMarkers';

const MARKER_SRC = readFileSync(
  join(process.cwd(), 'src/features/mediator/MediatorNodeMarker.tsx'),
  'utf8',
);
const RAIL_SRC = readFileSync(
  join(process.cwd(), 'src/features/mediator/DisagreementPointsRail.tsx'),
  'utf8',
);

// The REAL axis vocabulary (mediatorBoardTypes.ts). No exported ALL_ const, so
// it is enumerated here and its length is asserted so a future member surfaces.
const ALL_DISAGREEMENT_POINT_KINDS: ReadonlyArray<DisagreementPointKind> = Object.freeze([
  'fact',
  'definition',
  'scope',
  'causal',
  'value',
  'evidence',
  'logic',
  'recollection',
  'unaxed',
]);

// ── fixtures ──────────────────────────────────────────────────

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

// Every live V4 display state as its own live point (identity-mapped states).
function makeAllStateBoard(): MediatorBoardState {
  return makeBoard(
    ALL_V4_MEDIATOR_STATE_CODES.map((code) =>
      makePoint({ id: `p-${code}`, state: code as MediatorStateCode }),
    ),
  );
}

// ── tree helpers ──────────────────────────────────────────────

function collectText(node: unknown): string[] {
  if (node == null) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (typeof node === 'object') return collectText((node as { children?: unknown }).children);
  return [];
}

function collectProps(node: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(node)) return node.flatMap(collectProps);
  if (node && typeof node === 'object') {
    const props = (node as { props?: Record<string, unknown> }).props ?? {};
    const children = (node as { children?: unknown }).children;
    return [props, ...collectProps(children)];
  }
  return [];
}

function collectTestIds(node: unknown): string[] {
  return collectProps(node)
    .map((p) => p.testID)
    .filter((id): id is string => typeof id === 'string')
    .sort();
}

const COLOR_KEYS = [
  'color',
  'backgroundColor',
  'borderColor',
  'borderLeftColor',
  'borderRightColor',
  'borderTopColor',
  'borderBottomColor',
];

function collectColors(node: unknown): string[] {
  const out: string[] = [];
  for (const props of collectProps(node)) {
    const flat = StyleSheet.flatten(props.style as never) as Record<string, unknown> | undefined;
    if (!flat) continue;
    for (const key of COLOR_KEYS) {
      const v = flat[key];
      if (typeof v === 'string') out.push(v);
    }
  }
  return out;
}

// ── red/green verdict-color classifier ────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (h.length !== 6 && h.length !== 8) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b };
}

// A saturated red (danger) or green (success) verdict color. Tuned so the
// mediator neutrals (slate) and the indigo focusRing (#a5b4fc) do NOT trip, but
// STATUS.danger (#7f1d1d) and STATUS.success (#14532d) DO.
function isRedOrGreenVerdictColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const { r, g, b } = rgb;
  const isRed = r - Math.max(g, b) >= 40 && r >= 90;
  const isGreen = g - Math.max(r, b) >= 30 && g >= 70;
  return isRed || isGreen;
}

// ── the firing negative control ───────────────────────────────

function assertStateChipLabeled(node: { props: Record<string, unknown> }): void {
  const label = node.props.accessibilityLabel;
  if (typeof label !== 'string' || label.trim().length === 0) {
    throw new Error('mediator state chip is missing an accessibilityLabel');
  }
}

// ── vocabularies are the real ones ────────────────────────────

describe('A11Y-693 mediator axis guard — vocabularies', () => {
  it('covers all 11 live v4 display states', () => {
    expect(ALL_V4_MEDIATOR_STATE_CODES.length).toBe(11);
  });

  it('covers all 9 disagreement axes', () => {
    expect(ALL_DISAGREEMENT_POINT_KINDS.length).toBe(9);
  });
});

// ── DisagreementPointsRail: every live state is labeled ───────

describe('A11Y-693 mediator axis guard — rail labels every live state (no color-only state)', () => {
  it('renders a labeled badge + a labeled row for every live V4 display state', () => {
    const { getByTestId, queryByTestId, getAllByText, unmount } = render(
      <DisagreementPointsRail board={makeAllStateBoard()} defaultCollapsed={false} reduceMotionOverride />,
    );
    // Reveal the rows past the initial cap so every state is mounted.
    const overflow = queryByTestId('disagreement-points-rail-overflow');
    if (overflow) fireEvent.press(overflow);
    for (const code of ALL_V4_MEDIATOR_STATE_CODES) {
      const label = plainLanguageForMediatorState(code);
      // A grayscale-legible visible text badge.
      expect(getAllByText(label).length).toBeGreaterThanOrEqual(1);
      // A non-empty accessibilityLabel that names the state (no color-only state).
      const row = getByTestId(`disagreement-points-rail-row-p-${code}`);
      assertStateChipLabeled(row);
      expect(row.props.accessibilityLabel).toContain(label);
    }
    unmount();
  });

  it('surfaces every state in the distribution with a non-empty accessibilityLabel (not color-only)', () => {
    const { getByTestId } = render(
      <DisagreementPointsRail board={makeAllStateBoard()} defaultCollapsed={false} reduceMotionOverride />,
    );
    for (const code of ALL_V4_MEDIATOR_STATE_CODES) {
      const seg = getByTestId(`disagreement-points-rail-distribution-segment-${code}`);
      assertStateChipLabeled(seg);
    }
  });

  it('renders no row for a terminal resolved_or_settled point (correct suppression)', () => {
    const { queryByTestId } = render(
      <DisagreementPointsRail
        board={makeBoard([makePoint({ id: 'p-resolved', state: 'resolved_or_settled' })])}
        defaultCollapsed={false}
        reduceMotionOverride
      />,
    );
    expect(queryByTestId('disagreement-points-rail-row-p-resolved')).toBeNull();
  });
});

// ── MediatorNodeMarker: every display state is text ───────────

describe('A11Y-693 mediator axis guard — node marker labels every display state', () => {
  it('renders every display state as role=text with a paired text label + a non-empty accessibilityLabel', () => {
    for (const code of ALL_V4_MEDIATOR_STATE_CODES) {
      const marker: NodeMediatorMarker = {
        nodeId: `n-${code}`,
        code: code as MediatorStateCode,
        label: plainLanguageForMediatorState(code),
        isImpasse: code === 'structured_impasse',
      };
      const { getByText, unmount } = render(<MediatorNodeMarker marker={marker} />);
      const text = getByText(marker.label);
      expect(text.props.accessibilityRole).toBe('text');
      assertStateChipLabeled(text as unknown as { props: Record<string, unknown> });
      expect(text.props.accessibilityLabel).toContain(marker.label);
      unmount();
    }
  });
});

// ── the axis (point.kind) is never a colored dot ──────────────

describe('A11Y-693 mediator axis guard — the disagreement axis is text-only, never a colored dot', () => {
  it('point.kind adds no rendered element and no color across all 9 axes', () => {
    const baseline = collectTestIds(
      render(
        <DisagreementPointsRail
          board={makeBoard([makePoint({ id: 'p1', state: 'open', kind: 'unaxed' })])}
          defaultCollapsed={false}
          reduceMotionOverride
        />,
      ).toJSON(),
    );
    for (const kind of ALL_DISAGREEMENT_POINT_KINDS) {
      const tree = render(
        <DisagreementPointsRail
          board={makeBoard([makePoint({ id: 'p1', state: 'open', kind })])}
          defaultCollapsed={false}
          reduceMotionOverride
        />,
      ).toJSON();
      // The axis adds no element: the testID set is identical to the baseline.
      expect(collectTestIds(tree)).toEqual(baseline);
      // The axis is never surfaced as a raw code in any rendered text.
      expect(collectText(tree).some((t) => t === kind)).toBe(false);
    }
  });

  it('neither mediator surface binds a color to point.kind (no per-axis color map)', () => {
    for (const src of [MARKER_SRC, RAIL_SRC]) {
      expect(src).not.toMatch(/TIMELINE_KIND_COLORS/);
      expect(src).not.toMatch(/kindColor|axisColor|colorForKind|KIND_COLOR/i);
      expect(src).not.toMatch(/\[\s*point\.kind\s*\]/);
    }
  });
});

// ── no red/green verdict pairing ──────────────────────────────

describe('A11Y-693 mediator axis guard — no red/green verdict pairing', () => {
  it('neither mediator source references STATUS.danger / STATUS.success', () => {
    for (const src of [MARKER_SRC, RAIL_SRC]) {
      expect(src).not.toMatch(/STATUS\.danger/);
      expect(src).not.toMatch(/STATUS\.success/);
    }
  });

  it('neither mediator source carries a saturated red/green hex literal', () => {
    for (const src of [MARKER_SRC, RAIL_SRC]) {
      const hexes = src.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
      for (const hex of hexes) {
        expect(isRedOrGreenVerdictColor(hex)).toBe(false);
      }
    }
  });

  it('the rendered mediator palette carries no saturated red/green (defense-in-depth)', () => {
    const tree = render(
      <DisagreementPointsRail board={makeAllStateBoard()} defaultCollapsed={false} reduceMotionOverride />,
    ).toJSON();
    for (const c of collectColors(tree)) {
      if (c.startsWith('#')) {
        expect(isRedOrGreenVerdictColor(c)).toBe(false);
      }
    }
  });
});

// ── the guard bites (firing negative control) ─────────────────

describe('A11Y-693 mediator axis guard — the guard bites (firing negative control)', () => {
  it('assertStateChipLabeled throws on a colored-but-unlabeled chip', () => {
    const broken = { props: { style: { backgroundColor: '#a5b4fc' } } };
    expect(() => assertStateChipLabeled(broken)).toThrow();
  });

  it('assertStateChipLabeled throws on a blank-label chip', () => {
    const blank = { props: { accessibilityLabel: '   ', style: {} } };
    expect(() => assertStateChipLabeled(blank)).toThrow();
  });

  it('assertStateChipLabeled passes on a properly labeled chip', () => {
    const good = { props: { accessibilityLabel: 'Needs evidence', style: {} } };
    expect(() => assertStateChipLabeled(good)).not.toThrow();
  });

  it('the red/green classifier flags STATUS danger + success but not the neutral palette', () => {
    expect(isRedOrGreenVerdictColor('#7f1d1d')).toBe(true); // STATUS.danger bg
    expect(isRedOrGreenVerdictColor('#14532d')).toBe(true); // STATUS.success bg
    expect(isRedOrGreenVerdictColor('#a5b4fc')).toBe(false); // focusRing indigo
    expect(isRedOrGreenVerdictColor('#1f2937')).toBe(false); // slate neutral
  });
});

// ── doctrine ban-list ─────────────────────────────────────────

describe('A11Y-693 mediator axis guard — rendered strings are ban-list clean', () => {
  it('every rendered mediator string is free of verdict / amplification tokens', () => {
    const { queryByTestId, toJSON } = render(
      <DisagreementPointsRail board={makeAllStateBoard()} defaultCollapsed={false} reduceMotionOverride />,
    );
    const overflow = queryByTestId('disagreement-points-rail-overflow');
    if (overflow) fireEvent.press(overflow);
    const texts = collectText(toJSON());
    expect(texts.length).toBeGreaterThan(0);
    const banned = _forbiddenMediatorTokens();
    for (const text of texts) {
      const lower = text.toLowerCase();
      for (const token of banned) {
        expect(lower.includes(token)).toBe(false);
      }
    }
  });
});
