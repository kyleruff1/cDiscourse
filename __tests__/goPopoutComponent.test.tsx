/**
 * QOL-033 — GoPopout component contract.
 *
 * Design §7 test plan, the component-wiring slice. Follows the repo's
 * UI-test discipline (`oneBoxPopoutChassis.test.tsx`): the load-bearing
 * render decisions are exercised through the pure model (`goPopoutModel`),
 * and the component WIRING — chassis use, the embedded read-only mini-map,
 * the four control groups, the no-write doctrine, reduce-motion threading —
 * is asserted by a static source-scan. `.tsx` extension matches the sibling
 * chassis test files.
 *
 * A static source-scan (not a renderer) is used because `GoPopout.tsx`
 * value-imports `TimelineMiniMap` + the chassis; the same pattern
 * `oneBoxPopoutChassis.test.tsx` uses for the three `.tsx` chassis files.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  buildGoPopout,
  flattenGoPopout,
  GO_GROUP_ORDER,
  type BuildGoPopoutInput,
} from '../src/features/arguments/oneBox/goPopoutModel';
import type {
  MiniMapBranchCluster,
  TimelineMiniMapModel,
} from '../src/features/arguments/timelineMiniMapModel';

const ONEBOX_DIR = path.join(process.cwd(), 'src', 'features', 'arguments', 'oneBox');
const GO_POPOUT_SRC = fs.readFileSync(path.join(ONEBOX_DIR, 'GoPopout.tsx'), 'utf8');

/**
 * Strips block + line comments so an import-purity scan inspects real CODE
 * only — a doctrine comment that names a forbidden primitive must not
 * register as a usage. Same helper shape as `oneBoxCopyBanList.test.ts`.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const GO_POPOUT_CODE = stripComments(GO_POPOUT_SRC);

// ── Fixtures (mirror goPopoutModel.test.ts) ────────────────────

function mainlineCluster(): MiniMapBranchCluster {
  return {
    branchId: 'branch-root-m1',
    branchRootMessageId: 'm1',
    lane: 0,
    moveCount: 12,
    xStartFraction: 0,
    xEndFraction: 1,
    isCollapsed: false,
    hiddenMoveCount: 0,
    laneLabel: 'on the main line',
    containsActivePath: true,
    isMainline: true,
  };
}

function miniMap(over: Partial<TimelineMiniMapModel> = {}): TimelineMiniMapModel {
  return {
    isAvailable: 'isAvailable' in over ? (over.isAvailable as boolean) : true,
    moveCount: over.moveCount ?? 16,
    markers: over.markers ?? [],
    branchClusters: over.branchClusters ?? [mainlineCluster()],
    hotZone: 'hotZone' in over ? (over.hotZone ?? null) : null,
    activePathMessageIds: over.activePathMessageIds ?? ['m1'],
    rootMessageId: 'rootMessageId' in over ? (over.rootMessageId ?? null) : 'm1',
    latestMessageId: 'latestMessageId' in over ? (over.latestMessageId ?? null) : 'm16',
    minLane: over.minLane ?? 0,
    maxLane: over.maxLane ?? 0,
    collapsedBranchCount: over.collapsedBranchCount ?? 0,
    summaryLine: over.summaryLine ?? '16 moves',
  };
}

function goInput(over: Partial<BuildGoPopoutInput> = {}): BuildGoPopoutInput {
  return {
    miniMap: over.miniMap ?? miniMap(),
    view: over.view ?? 'timeline',
    density: over.density ?? 'normal',
    lens: over.lens ?? 'none',
  };
}

// ── 1. Chassis use ─────────────────────────────────────────────

describe('QOL-033 GoPopout — chassis use', () => {
  it('stands on the QOL-030 Popout chassis (does not re-implement it)', () => {
    expect(GO_POPOUT_CODE).toMatch(/import\s*\{\s*Popout\s*\}\s*from\s*'\.\/Popout'/);
  });

  it('renders rows through the chassis PopoutGroup', () => {
    expect(GO_POPOUT_CODE).toMatch(/from\s*'\.\/PopoutGroup'/);
    expect(GO_POPOUT_CODE).toMatch(/<PopoutGroup/);
  });

  it('titles the popout "Go"', () => {
    expect(GO_POPOUT_CODE).toMatch(/title="Go"/);
  });

  it('does not redefine the chassis primitives (no local Popout/PopoutEntry decl)', () => {
    // QOL-033 must not fork the chassis — only consume it.
    expect(GO_POPOUT_CODE).not.toMatch(/function\s+Popout\s*\(/);
    expect(GO_POPOUT_CODE).not.toMatch(/function\s+PopoutEntry\s*\(/);
    expect(GO_POPOUT_CODE).not.toMatch(/function\s+PopoutGroup\s*\(/);
  });
});

// ── 2. The four control groups come from the pure model ────────

describe('QOL-033 GoPopout — control groups', () => {
  it('builds its groups from buildGoPopout (the pure model)', () => {
    expect(GO_POPOUT_CODE).toMatch(/buildGoPopout\(/);
  });

  it('the pure model yields the four design §3.2 groups in order', () => {
    const groups = buildGoPopout(goInput());
    expect(groups.map((g) => g.id)).toEqual([...GO_GROUP_ORDER]);
    expect([...GO_GROUP_ORDER]).toEqual(['jump', 'view', 'density', 'lens']);
  });

  it('every group renders at least one row', () => {
    for (const g of buildGoPopout(goInput())) {
      expect(g.entries.length).toBeGreaterThan(0);
    }
  });
});

// ── 3. The embedded IX-002 mini-map — read-only ────────────────

describe('QOL-033 GoPopout — embedded mini-map', () => {
  it('embeds the IX-002 TimelineMiniMap component', () => {
    expect(GO_POPOUT_CODE).toMatch(/from\s*'\.\.\/TimelineMiniMap'/);
    expect(GO_POPOUT_CODE).toMatch(/<TimelineMiniMap/);
  });

  it('passes the already-built model straight through (consumed read-only)', () => {
    // The component receives `miniMap` as a prop and forwards it — it never
    // calls buildTimelineMiniMapModel itself (no re-derivation).
    expect(GO_POPOUT_CODE).not.toMatch(/buildTimelineMiniMapModel/);
    expect(GO_POPOUT_CODE).toMatch(/model=\{miniMap\}/);
  });

  it('gates the strip on showsEmbeddedMiniMap (IX-002 node threshold)', () => {
    expect(GO_POPOUT_CODE).toMatch(/showsEmbeddedMiniMap\(/);
  });

  it('shows a short-argument note when the strip is omitted (design §6)', () => {
    expect(GO_POPOUT_CODE).toMatch(/go-popout-mini-map-note/);
  });
});

// ── 4. No-write doctrine (design §8) ───────────────────────────

describe('QOL-033 GoPopout — no-write doctrine', () => {
  it('imports no Supabase client', () => {
    expect(/from ['"][^'"]*supabase/.test(GO_POPOUT_CODE)).toBe(false);
  });

  it('performs no network call', () => {
    expect(/\bfetch\(/.test(GO_POPOUT_CODE)).toBe(false);
    expect(/\bXMLHttpRequest\b/.test(GO_POPOUT_CODE)).toBe(false);
  });

  it('imports no AI provider', () => {
    expect(/anthropic|openai|x\.ai/i.test(GO_POPOUT_CODE)).toBe(false);
  });

  it('does not write to public.arguments or bypass submit-argument', () => {
    expect(/submit-argument/.test(GO_POPOUT_CODE)).toBe(false);
    expect(/\.insert\(|\.update\(|\.delete\(/.test(GO_POPOUT_CODE)).toBe(false);
  });

  it('does not import a router (Go pans the board — no route transition)', () => {
    expect(/from ['"][^'"]*(react-navigation|expo-router)/.test(GO_POPOUT_CODE)).toBe(false);
  });
});

// ── 5. Accessibility / reduce-motion threading ─────────────────

describe('QOL-033 GoPopout — accessibility', () => {
  it('threads reduce-motion into the chassis + the mini-map', () => {
    expect(GO_POPOUT_CODE).toMatch(/reduceMotionOverride=\{reduceMotionOverride\}/);
    expect(GO_POPOUT_CODE).toMatch(/reduceMotion=\{reduceMotionOverride\}/);
  });

  it('all visible text is wrapped in <Text> (no raw strings in <View>)', () => {
    // The only literal copy the component authors is the lens helper + the
    // short-argument note — both must be inside <Text>.
    expect(GO_POPOUT_CODE).toMatch(/<Text[^>]*go-popout-lens-helper/);
    expect(GO_POPOUT_CODE).toMatch(/<Text[^>]*go-popout-mini-map-note/);
  });
});

// ── 6. Lens entries dim, never hide (design §3.3 / §8) ─────────

describe('QOL-033 GoPopout — lens doctrine in copy', () => {
  it('the lens helper states a lens dims (never hides) moves', () => {
    // The component's lens-helper copy must carry the doctrine out loud.
    expect(GO_POPOUT_CODE).toMatch(/dims/);
    expect(GO_POPOUT_CODE).toMatch(/never hides them|stay fully navigable/);
  });

  it('the lens entries select a GoLens — they never delete a node', () => {
    // The handler only calls onSelectLens; no node-list mutation exists.
    expect(GO_POPOUT_CODE).toMatch(/onSelectLens\(/);
  });
});

// ── 7. Jump entries pan the board — one-shot navigation ────────

describe('QOL-033 GoPopout — jump behaviour', () => {
  it('a jump fires onJump and dismisses the popout (except Branch list)', () => {
    expect(GO_POPOUT_CODE).toMatch(/onJump\(target\)/);
    // Branch list stays open for a sub-picker; other jumps close.
    expect(GO_POPOUT_CODE).toMatch(/target !== 'branch_list'/);
  });

  it('every flattened entry carries a stable key + a chassis kind', () => {
    // The model→chassis mapping must produce a complete PopoutGroupEntry.
    for (const entry of flattenGoPopout(buildGoPopout(goInput()))) {
      expect(entry.id.length).toBeGreaterThan(0);
      expect(['jump', 'view_toggle', 'density', 'lens']).toContain(entry.kind);
    }
  });
});
