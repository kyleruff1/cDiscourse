/**
 * BR-001 — BranchCollapseStub tests.
 *
 * Pure-helper tests following the EV-002 ReceiptChip pattern — every
 * visual decision is extracted into a pure helper that tests exercise
 * directly. This avoids pulling in the RN renderer (which the repo's
 * test discipline does not use).
 *
 * Asserts:
 *   - Effective tap target ≥ 44 (`hitSlop` + visible pill side).
 *   - Container border inherits `stub.borderColor` exactly.
 *   - Container background reuses VG-001's `BRAND.surface.appElevated`.
 *   - `containsActive` toggles a thicker border (no new color token).
 *   - Position anchors the pill on the branch root's `(x, y)`.
 *   - Ban-list (verdict / amplification / snake_case) on every label
 *     and accessibility-label combination the stub can render.
 *   - No new color token introduced — borderColor is always the node's
 *     `kindColor` passed in via the view-model.
 */
import {
  BRANCH_COLLAPSE_STUB_HIT_SLOP,
  BRANCH_COLLAPSE_STUB_HIT_SLOP_PX,
  BRANCH_COLLAPSE_STUB_VISIBLE_SIZE_PX,
  buildBranchCollapseStubContainerStyle,
  buildBranchCollapseStubPositionStyle,
  getEffectiveTapTargetPx,
} from '../src/features/arguments/BranchCollapseStub';
import {
  buildCollapsedRailInputs,
  EMPTY_COLLAPSE_STATE,
  toggleBranchCollapse,
  type RailStubViewModel,
} from '../src/features/arguments/branchTopologyModel';
import type {
  ArgumentTimelineMapNode,
  TimelineKindColorFamily,
  TimelineStandingBand,
  TimelineTemperatureBand,
  TimelineToneBand,
} from '../src/features/arguments/argumentGameSurfaceModel';
import type { RailSegmentInput } from '../src/features/arguments/railSegmentModel';
import { BRAND } from '../src/lib/designTokens';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';

// ── Ban-list ─────────────────────────────────────────────────────

const VERDICT_TOKENS: ReadonlyArray<string> = [
  'winner',
  'loser',
  'correct',
  'incorrect',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'troll',
  'astroturfer',
  'verdict',
  'proof',
  'proven',
  'disproven',
  'validated',
  'winning',
];

const AMPLIFICATION_TOKENS: ReadonlyArray<string> = [
  'likes',
  'retweets',
  'shares',
  'followers',
  'verified',
  'engagement',
  'amplification',
  'trending',
  'virality',
  'popular',
  'viral',
];

function assertNoBanned(s: string, tokens: ReadonlyArray<string>) {
  const lower = s.toLowerCase();
  for (const t of tokens) {
    expect(lower.includes(t.toLowerCase())).toBe(false);
  }
}

// ── Fixture builders ─────────────────────────────────────────────

function fakeNode(over: Partial<ArgumentTimelineMapNode> = {}): ArgumentTimelineMapNode {
  return {
    messageId: over.messageId ?? 'm1',
    parentId: over.parentId ?? null,
    ordinal: over.ordinal ?? 1,
    createdAt: over.createdAt ?? '2026-05-18T10:00:00.000Z',
    createdAtLabel: over.createdAtLabel ?? '2026-05-18 10:00',
    relativeLabel: over.relativeLabel ?? 'now',
    actorLabel: over.actorLabel ?? 'You',
    kindLabel: over.kindLabel ?? 'Claim',
    sideLabel: over.sideLabel ?? 'For',
    bodyPreview: over.bodyPreview ?? 'body',
    badges: over.badges ?? [],
    droppedTags: over.droppedTags ?? [],
    depth: over.depth ?? 0,
    lane: over.lane ?? 0,
    siblingIndex: over.siblingIndex ?? 0,
    replyCount: over.replyCount ?? 0,
    descendantCount: over.descendantCount ?? 0,
    branchId: over.branchId ?? 'branch-1',
    branchRootMessageId: over.branchRootMessageId ?? over.messageId ?? 'm1',
    junctionGroupId: over.junctionGroupId ?? null,
    isJunction: over.isJunction ?? false,
    junctionChildCount: over.junctionChildCount ?? 0,
    isActive: over.isActive ?? false,
    isLatest: over.isLatest ?? false,
    isDetached: over.isDetached ?? false,
    isActivePath: over.isActivePath ?? false,
    isRoot: over.isRoot ?? false,
    isFirstRebuttal: over.isFirstRebuttal ?? false,
    standingBand: (over.standingBand ?? 'neutral') as TimelineStandingBand,
    toneBand: (over.toneBand ?? 'calm') as TimelineToneBand,
    temperatureBand: (over.temperatureBand ?? 'cool') as TimelineTemperatureBand,
    kindColor: over.kindColor ?? '#22c55e',
    kindColorFamily: (over.kindColorFamily ?? 'claim') as TimelineKindColorFamily,
    x: over.x ?? 100,
    y: over.y ?? 120,
    accessibilityLabel: over.accessibilityLabel ?? 'm1',
  };
}

function fakeSegment(over: Partial<RailSegmentInput> = {}): RailSegmentInput {
  return {
    segmentId: over.segmentId ?? 'seg-1',
    fromMessageId: over.fromMessageId ?? 'm1',
    toMessageId: over.toMessageId ?? 'm2',
    x1: over.x1 ?? 0,
    y1: over.y1 ?? 100,
    x2: over.x2 ?? 100,
    y2: over.y2 ?? 100,
    gradientStops: over.gradientStops ?? ['#22c55e', '#f59e0b'],
    toneBand: 'calm',
    temperatureBand: 'cool',
    sourceChainStatus: 'no_source',
    branchKind: over.branchKind ?? 'kink_start',
    isActivePath: over.isActivePath ?? false,
    isFirstClash: over.isFirstClash ?? false,
  };
}

function fakeStub(over: Partial<RailStubViewModel> = {}): RailStubViewModel {
  return {
    stubId: over.stubId ?? 'stub-br',
    branchRootMessageId: over.branchRootMessageId ?? 'br',
    anchorX: over.anchorX ?? 250,
    anchorY: over.anchorY ?? 120,
    hiddenMessageCount: over.hiddenMessageCount ?? 3,
    label: over.label ?? '+3',
    accessibilityLabel: over.accessibilityLabel ?? '3 hidden replies on the side branch. Tap to expand.',
    containsActive: over.containsActive ?? false,
    borderColor: over.borderColor ?? '#06b6d4',
  };
}

// ── 1. Tap target ────────────────────────────────────────────────

describe('BR-001 — BranchCollapseStub accessibility / tap target', () => {
  it('hit-slop expands tap target to ≥ 44 px each side', () => {
    expect(BRANCH_COLLAPSE_STUB_HIT_SLOP_PX).toBeGreaterThanOrEqual(10);
    const tapTarget = getEffectiveTapTargetPx();
    expect(tapTarget).toBeGreaterThanOrEqual(44);
  });

  it('exports a symmetric hit-slop object', () => {
    expect(BRANCH_COLLAPSE_STUB_HIT_SLOP).toEqual({
      top: BRANCH_COLLAPSE_STUB_HIT_SLOP_PX,
      bottom: BRANCH_COLLAPSE_STUB_HIT_SLOP_PX,
      left: BRANCH_COLLAPSE_STUB_HIT_SLOP_PX,
      right: BRANCH_COLLAPSE_STUB_HIT_SLOP_PX,
    });
  });
});

// ── 2. Container style ───────────────────────────────────────────

describe('BR-001 — buildBranchCollapseStubContainerStyle', () => {
  it('background reuses VG-001 BRAND.surface.appElevated (no new color token)', () => {
    const style = buildBranchCollapseStubContainerStyle(fakeStub());
    expect(style.backgroundColor).toBe(BRAND.surface.appElevated.bg);
  });

  it('border inherits the stub.borderColor (i.e. node.kindColor) verbatim', () => {
    const style = buildBranchCollapseStubContainerStyle(fakeStub({ borderColor: '#ef4444' }));
    expect(style.borderColor).toBe('#ef4444');
  });

  it('containsActive flips the border width from 2 to 3 (no new color token)', () => {
    const idle = buildBranchCollapseStubContainerStyle(fakeStub({ containsActive: false }));
    const active = buildBranchCollapseStubContainerStyle(fakeStub({ containsActive: true }));
    expect(idle.borderWidth).toBe(2);
    expect(active.borderWidth).toBe(3);
    // The color is identical — only the width changes.
    expect(idle.borderColor).toBe(active.borderColor);
  });

  it('width / height are the locked visible size (24×24)', () => {
    const style = buildBranchCollapseStubContainerStyle(fakeStub());
    expect(style.width).toBe(BRANCH_COLLAPSE_STUB_VISIBLE_SIZE_PX);
    expect(style.height).toBe(BRANCH_COLLAPSE_STUB_VISIBLE_SIZE_PX);
  });
});

// ── 3. Position ──────────────────────────────────────────────────

describe('BR-001 — buildBranchCollapseStubPositionStyle', () => {
  it('positions the stub centered on the branch root (x, y)', () => {
    const stub = fakeStub({ anchorX: 250, anchorY: 120 });
    const pos = buildBranchCollapseStubPositionStyle(stub);
    expect(pos.position).toBe('absolute');
    expect(pos.left).toBe(250 - BRANCH_COLLAPSE_STUB_VISIBLE_SIZE_PX / 2);
    expect(pos.top).toBe(120 - BRANCH_COLLAPSE_STUB_VISIBLE_SIZE_PX / 2);
  });

  it('different anchors → different positions (the helper is pure)', () => {
    const a = buildBranchCollapseStubPositionStyle(fakeStub({ anchorX: 100, anchorY: 100 }));
    const b = buildBranchCollapseStubPositionStyle(fakeStub({ anchorX: 500, anchorY: 200 }));
    expect(a).not.toEqual(b);
  });
});

// ── 4. Ban-list — verdict / amplification / snake_case ───────────

describe('BR-001 — BranchCollapseStub ban-list', () => {
  function generatedStubs(): RailStubViewModel[] {
    // Drive the stub builder over a sweep of inputs to ensure no
    // banned token slips into label / accessibilityLabel as the count
    // and active flags vary.
    const outAll: RailStubViewModel[] = [];
    for (const count of [1, 2, 3, 7, 12, 99]) {
      for (const active of [false, true]) {
        const m0 = fakeNode({ messageId: 'm0', parentId: null, branchRootMessageId: 'm0' });
        const br = fakeNode({ messageId: 'br', parentId: 'm0', branchRootMessageId: 'br', x: 200 });
        const children: ArgumentTimelineMapNode[] = Array.from({ length: count }, (_, i) =>
          fakeNode({
            messageId: `c${i}`,
            parentId: i === 0 ? 'br' : `c${i - 1}`,
            branchRootMessageId: 'br',
          }),
        );
        const nodesById = new Map<string, ArgumentTimelineMapNode>();
        for (const n of [m0, br, ...children]) nodesById.set(n.messageId, n);
        const state = toggleBranchCollapse(EMPTY_COLLAPSE_STATE, 'br');
        const r = buildCollapsedRailInputs({
          segments: [
            fakeSegment({ segmentId: 's-m0-br', fromMessageId: 'm0', toMessageId: 'br' }),
            ...children.map((n, i) => fakeSegment({
              segmentId: `s-${i}`,
              fromMessageId: i === 0 ? 'br' : `c${i - 1}`,
              toMessageId: n.messageId,
            })),
          ],
          nodeById: nodesById,
          collapseState: state,
          activeMessageId: active ? `c${count - 1}` : null,
        });
        outAll.push(...r.stubs);
      }
    }
    return outAll;
  }

  it('produced stubs have non-empty label + accessibilityLabel', () => {
    for (const stub of generatedStubs()) {
      expect(stub.label.length).toBeGreaterThan(0);
      expect(stub.accessibilityLabel.length).toBeGreaterThan(0);
    }
  });

  it('label and accessibilityLabel contain zero verdict tokens', () => {
    for (const stub of generatedStubs()) {
      assertNoBanned(stub.label, VERDICT_TOKENS);
      assertNoBanned(stub.accessibilityLabel, VERDICT_TOKENS);
    }
  });

  it('label and accessibilityLabel contain zero amplification tokens', () => {
    for (const stub of generatedStubs()) {
      assertNoBanned(stub.label, AMPLIFICATION_TOKENS);
      assertNoBanned(stub.accessibilityLabel, AMPLIFICATION_TOKENS);
    }
  });

  it('label and accessibilityLabel never look like internal snake_case codes', () => {
    for (const stub of generatedStubs()) {
      expect(looksLikeInternalCode(stub.label)).toBe(false);
      expect(looksLikeInternalCode(stub.accessibilityLabel)).toBe(false);
    }
  });

  it('singular vs plural English ("reply" / "replies") is handled', () => {
    const one = generatedStubs().find((s) => s.hiddenMessageCount === 1);
    expect(one).toBeDefined();
    if (one) {
      expect(one.accessibilityLabel).toContain('1 hidden reply');
      expect(one.accessibilityLabel).not.toContain('1 hidden replies');
    }
    const many = generatedStubs().find((s) => s.hiddenMessageCount === 7);
    expect(many).toBeDefined();
    if (many) {
      expect(many.accessibilityLabel).toContain('7 hidden replies');
    }
  });

  it('active-inside flag surfaces in plain English (not via color alone)', () => {
    // Color-independence: when containsActive is true, the
    // accessibility label MUST carry a parallel text signal so the
    // state is reachable to screen readers.
    const stub = fakeStub({ containsActive: true });
    const liveStub = (generatedStubs().find((s) => s.containsActive) ?? stub);
    // The stub builder emits "Includes the active message." when
    // containsActive is true. The exact phrasing is in the model.
    expect(liveStub.accessibilityLabel.toLowerCase()).toContain('active message');
  });

  it('accessibilityLabel always ends with "Tap to expand."', () => {
    for (const stub of generatedStubs()) {
      expect(stub.accessibilityLabel.endsWith('Tap to expand.')).toBe(true);
    }
  });
});

// ── 5. No new color / stroke token ───────────────────────────────

describe('BR-001 — BranchCollapseStub token usage', () => {
  it('borderColor is always the input stub.borderColor — no new color introduced', () => {
    const colors = ['#22c55e', '#f97316', '#ef4444', '#a855f7', '#06b6d4', '#f59e0b', '#6366f1'];
    for (const c of colors) {
      const style = buildBranchCollapseStubContainerStyle(fakeStub({ borderColor: c }));
      expect(style.borderColor).toBe(c);
    }
  });

  it('backgroundColor is always VG-001 BRAND.surface.appElevated.bg', () => {
    const colors = ['#22c55e', '#f97316', '#ef4444', '#a855f7'];
    for (const c of colors) {
      const style = buildBranchCollapseStubContainerStyle(fakeStub({ borderColor: c }));
      expect(style.backgroundColor).toBe(BRAND.surface.appElevated.bg);
    }
  });
});
