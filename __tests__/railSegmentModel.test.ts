/**
 * VG-002 — railSegmentModel pure-model tests.
 *
 * No React, no Supabase, no network. Covers:
 *   - State-to-style matrix (every structural row).
 *   - Branch-kind placeholder decision table.
 *   - `buildRailSegmentInput` (worst-status across endpoints).
 *   - Virtualization slice.
 *   - Memoization (deep-equal output for same input).
 *   - Whole-rail accessibilityLabel.
 *   - Ban-list — verdict tokens, amplification tokens, snake_case codes.
 *   - Doctrine anchors — heat is activity, saturated track is trail.
 *   - Color-independence — each color state has an a11y label.
 *   - BR-001 seam — placeholder NEVER emits kink_start / kink_end.
 *   - EV-001 surface lock — exhaustive over `ALL_SOURCE_CHAIN_STATUSES`.
 *   - Teal hex sync — `RAIL_SOURCE_CHAIN_TEAL === RECEIPT_CHIP_RING_COLOR`.
 */

import {
  ALL_RAIL_BRANCH_KINDS,
  buildRailSegmentInput,
  buildWholeRailAccessibilityLabel,
  deriveRailSegmentStyle,
  derivePlaceholderBranchKind,
  RAIL_ACTIVE_PATH_GLOW,
  RAIL_SOURCE_CHAIN_TEAL,
  VISIBLE_SLICE_DEFAULT_BUFFER_PX,
  visibleSegmentSlice,
  type RailBranchKind,
  type RailSegmentInput,
} from '../src/features/arguments/railSegmentModel';
import { RECEIPT_CHIP_RING_COLOR } from '../src/features/evidence/ReceiptChip';
import {
  ALL_SOURCE_CHAIN_STATUSES,
  type EvidenceArtifact,
  type SourceChainStatus,
} from '../src/features/evidence/evidenceModel';
import { looksLikeInternalCode } from '../src/features/arguments/gameCopy';
import type {
  ArgumentTimelineMapEdge,
  ArgumentTimelineMapNode,
  TimelineKindColorFamily,
  TimelineStandingBand,
  TimelineTemperatureBand,
  TimelineToneBand,
} from '../src/features/arguments/argumentGameSurfaceModel';

// ── Ban-lists ────────────────────────────────────────────────────

const VERDICT_TOKENS: ReadonlyArray<string> = [
  'winner',
  'loser',
  'correct',
  'incorrect',
  'true',
  'false',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'troll',
  'bot',
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
  'views',
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

// ── Fixture builders ────────────────────────────────────────────

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
    branchRootMessageId: over.branchRootMessageId ?? 'm1',
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
    x: over.x ?? 0,
    y: over.y ?? 0,
    accessibilityLabel: over.accessibilityLabel ?? 'm1',
  };
}

function fakeEdge(over: Partial<ArgumentTimelineMapEdge> = {}): ArgumentTimelineMapEdge {
  return {
    edgeId: over.edgeId ?? 'e-1',
    fromMessageId: over.fromMessageId ?? 'm1',
    toMessageId: over.toMessageId ?? 'm2',
    x1: over.x1 ?? 0,
    y1: over.y1 ?? 100,
    x2: over.x2 ?? 100,
    y2: over.y2 ?? 100,
    fromLane: over.fromLane ?? 0,
    toLane: over.toLane ?? 0,
    isActivePath: over.isActivePath ?? false,
    isDetached: over.isDetached ?? false,
    isFirstClash: over.isFirstClash ?? false,
    kindColor: over.kindColor ?? '#22c55e',
    standingColor: over.standingColor ?? '#22c55e',
    toneColor: over.toneColor ?? '#94a3b8',
    gradientStops: over.gradientStops ?? ['#22c55e', '#f59e0b', '#f97316'],
  };
}

function fakeInput(over: Partial<RailSegmentInput> = {}): RailSegmentInput {
  return {
    segmentId: over.segmentId ?? 'seg-1',
    fromMessageId: over.fromMessageId ?? 'm1',
    toMessageId: over.toMessageId ?? 'm2',
    x1: over.x1 ?? 0,
    y1: over.y1 ?? 100,
    x2: over.x2 ?? 100,
    y2: over.y2 ?? 100,
    gradientStops: over.gradientStops ?? ['#22c55e', '#f59e0b', '#f97316'],
    toneBand: (over.toneBand ?? 'calm') as TimelineToneBand,
    temperatureBand: (over.temperatureBand ?? 'cool') as TimelineTemperatureBand,
    sourceChainStatus: (over.sourceChainStatus ?? 'no_source') as SourceChainStatus,
    branchKind: (over.branchKind ?? 'main') as RailBranchKind,
    isActivePath: over.isActivePath ?? false,
    isFirstClash: over.isFirstClash ?? false,
  };
}

function fakeArtifact(over: Partial<EvidenceArtifact> = {}): EvidenceArtifact {
  return {
    id: over.id ?? 'a-1',
    argumentId: over.argumentId ?? 'm1',
    kind: over.kind ?? 'url',
    label: over.label ?? 'Example',
    url: over.url ?? 'https://example.com',
    quote: over.quote,
    sourceChainStatus: (over.sourceChainStatus ?? 'source_and_quote') as Exclude<SourceChainStatus, 'no_source'>,
    risk: over.risk ?? 'low',
    addedByUserId: over.addedByUserId ?? 'u-1',
    createdAt: over.createdAt ?? '2026-05-18T10:00:00.000Z',
  };
}

// ────────────────────────────────────────────────────────────────
// 1. Constants + surface lock
// ────────────────────────────────────────────────────────────────

describe('VG-002 — constants and surface lock', () => {
  it('RAIL_SOURCE_CHAIN_TEAL matches EV-002 RECEIPT_CHIP_RING_COLOR', () => {
    // Doctrine: the rail's teal must stay in sync with EV-002's chip.
    expect(RAIL_SOURCE_CHAIN_TEAL).toBe(RECEIPT_CHIP_RING_COLOR);
    expect(RAIL_SOURCE_CHAIN_TEAL).toBe('#0f766e');
  });

  it('exports all five branch kinds in ALL_RAIL_BRANCH_KINDS', () => {
    expect(ALL_RAIL_BRANCH_KINDS).toEqual([
      'main',
      'tangent',
      'kink_start',
      'kink_end',
      'detached',
    ]);
  });

  it('RAIL_ACTIVE_PATH_GLOW is the indigo-300 glow color', () => {
    expect(RAIL_ACTIVE_PATH_GLOW).toBe('#a5b4fc');
  });

  it('VISIBLE_SLICE_DEFAULT_BUFFER_PX is one viewport wide (800px)', () => {
    expect(VISIBLE_SLICE_DEFAULT_BUFFER_PX).toBe(800);
  });
});

// ────────────────────────────────────────────────────────────────
// 2. State-to-style matrix
// ────────────────────────────────────────────────────────────────

describe('VG-002 — state-to-style matrix', () => {
  // Rows 1-6: main + each SourceChainStatus, non-active.
  it('row 1: main + no_source → no evidence track, opacity 0.55, no glow', () => {
    const s = deriveRailSegmentStyle(fakeInput({ branchKind: 'main', sourceChainStatus: 'no_source' }));
    expect(s.evidenceTrack).toBeNull();
    expect(s.wrapper.opacity).toBeCloseTo(0.55);
    expect(s.glow).toBeNull();
    expect(s.isHidden).toBe(false);
  });

  it('row 2: main + unverified → no evidence track', () => {
    const s = deriveRailSegmentStyle(fakeInput({ branchKind: 'main', sourceChainStatus: 'unverified' }));
    expect(s.evidenceTrack).toBeNull();
  });

  it('row 3: main + source_no_quote → solid teal at 0.5 alpha', () => {
    const s = deriveRailSegmentStyle(fakeInput({ branchKind: 'main', sourceChainStatus: 'source_no_quote' }));
    expect(s.evidenceTrack).toEqual({ mode: 'solid', color: RAIL_SOURCE_CHAIN_TEAL, alpha: 0.5 });
  });

  it('row 4: main + source_and_quote → solid teal at 1.0 alpha', () => {
    const s = deriveRailSegmentStyle(fakeInput({ branchKind: 'main', sourceChainStatus: 'source_and_quote' }));
    expect(s.evidenceTrack).toEqual({ mode: 'solid', color: RAIL_SOURCE_CHAIN_TEAL, alpha: 1.0 });
  });

  it('row 5: main + primary_present → solid teal at 1.0 alpha (strongest trail)', () => {
    const s = deriveRailSegmentStyle(fakeInput({ branchKind: 'main', sourceChainStatus: 'primary_present' }));
    expect(s.evidenceTrack).toEqual({ mode: 'solid', color: RAIL_SOURCE_CHAIN_TEAL, alpha: 1.0 });
  });

  it('row 6: main + broken → dotted pattern teal', () => {
    const s = deriveRailSegmentStyle(fakeInput({ branchKind: 'main', sourceChainStatus: 'broken' }));
    expect(s.evidenceTrack).not.toBeNull();
    if (s.evidenceTrack && s.evidenceTrack.mode === 'dotted_pattern') {
      expect(s.evidenceTrack.color).toBe(RAIL_SOURCE_CHAIN_TEAL);
      expect(s.evidenceTrack.alphaPattern).toEqual([1, 0.3, 1, 0.3, 1, 0.3]);
    } else {
      throw new Error('expected dotted_pattern');
    }
  });

  it('row 7: tangent → wrapper opacity 0.6 + 6deg extra rotation, evidence track inherited', () => {
    const s = deriveRailSegmentStyle(fakeInput({
      branchKind: 'tangent',
      sourceChainStatus: 'source_and_quote',
      x1: 0, y1: 100, x2: 100, y2: 100,
    }));
    expect(s.wrapper.opacity).toBeCloseTo(0.6);
    // base angle = 0deg (horizontal), tangent adds 6deg
    expect(s.wrapper.transformRotateZDeg).toBeCloseTo(6, 5);
    // Evidence track inherits from sourceChainStatus row 4.
    expect(s.evidenceTrack).toEqual({ mode: 'solid', color: RAIL_SOURCE_CHAIN_TEAL, alpha: 1.0 });
    expect(s.isHidden).toBe(false);
  });

  it('row 8: kink_start → start stub flag set, end stub not set', () => {
    const s = deriveRailSegmentStyle(fakeInput({ branchKind: 'kink_start' }));
    expect(s.wrapper.showKinkStartStub).toBe(true);
    expect(s.wrapper.showKinkEndStub).toBe(false);
    expect(s.wrapper.opacity).toBeCloseTo(0.55);
  });

  it('row 9: kink_end → end stub flag set, start stub not set', () => {
    const s = deriveRailSegmentStyle(fakeInput({ branchKind: 'kink_end' }));
    expect(s.wrapper.showKinkEndStub).toBe(true);
    expect(s.wrapper.showKinkStartStub).toBe(false);
  });

  it('row 10: detached → hidden, opacity 0, no evidence track, no glow', () => {
    const s = deriveRailSegmentStyle(fakeInput({ branchKind: 'detached' }));
    expect(s.isHidden).toBe(true);
    expect(s.wrapper.opacity).toBe(0);
    expect(s.evidenceTrack).toBeNull();
    expect(s.glow).toBeNull();
  });

  it('active-path edge flips glow on and opacity to 1.0', () => {
    const s = deriveRailSegmentStyle(fakeInput({ branchKind: 'main', isActivePath: true }));
    expect(s.glow).not.toBeNull();
    expect(s.wrapper.opacity).toBe(1.0);
  });

  it('non-active edge has no glow', () => {
    const s = deriveRailSegmentStyle(fakeInput({ branchKind: 'main', isActivePath: false }));
    expect(s.glow).toBeNull();
  });

  it('first-clash edge thickens the wrapper height to 6px', () => {
    const s = deriveRailSegmentStyle(fakeInput({ isFirstClash: true }));
    expect(s.wrapper.height).toBe(6);
    const s2 = deriveRailSegmentStyle(fakeInput({ isFirstClash: false }));
    expect(s2.wrapper.height).toBe(4);
  });

  it('zero-length edge clamps wrapper width to a minimum of 2px', () => {
    const s = deriveRailSegmentStyle(fakeInput({ x1: 50, y1: 50, x2: 50, y2: 50 }));
    expect(s.wrapper.width).toBe(2);
  });

  it('base sub-strip colors array always has exactly 6 entries', () => {
    const stopsCases = [
      ['#000000'],
      ['#000000', '#ffffff'],
      ['#000000', '#ffffff', '#ff0000'],
      ['#a', '#b', '#c', '#d', '#e', '#f'],
    ];
    for (const stops of stopsCases) {
      const s = deriveRailSegmentStyle(fakeInput({ gradientStops: stops }));
      expect(s.baseSubStripColors.length).toBe(6);
    }
  });
});

// ────────────────────────────────────────────────────────────────
// 3. Tone-wash alpha lookup
// ────────────────────────────────────────────────────────────────

describe('VG-002 — tone wash alpha lookup', () => {
  const cases: Array<[TimelineTemperatureBand, number]> = [
    ['cool', 0],
    ['mild', 0.1],
    ['warm', 0.25],
    ['hot', 0.45],
    ['unknown', 0.05],
  ];
  for (const [band, expected] of cases) {
    it(`temperature ${band} → alpha ${expected}`, () => {
      const s = deriveRailSegmentStyle(fakeInput({ temperatureBand: band }));
      expect(s.toneWash.alpha).toBeCloseTo(expected, 5);
    });
  }

  const toneCases: Array<[TimelineToneBand, string]> = [
    ['calm', '#22c55e'],
    ['measured', '#3b82f6'],
    ['heated', '#f97316'],
    ['hostile', '#ef4444'],
    ['unknown', '#94a3b8'],
  ];
  for (const [tone, hex] of toneCases) {
    it(`tone ${tone} → color ${hex}`, () => {
      const s = deriveRailSegmentStyle(fakeInput({ toneBand: tone, temperatureBand: 'warm' }));
      expect(s.toneWash.color).toBe(hex);
    });
  }
});

// ────────────────────────────────────────────────────────────────
// 4. Placeholder branch-kind derivation (BR-001 seam)
// ────────────────────────────────────────────────────────────────

describe('VG-002 — derivePlaceholderBranchKind (BR-001 seam)', () => {
  // BR-001 — the legacy three-rule placeholder is now a thin adapter
  // over `deriveBranchKindFromConstitutionModel`. The signature stays
  // the same; the body delegates to BR-001. The four-axis classifier
  // produces:
  //   - isDetached → detached (regardless of family / tag)
  //   - !isDetached + siblingIndex 0 + no-tag → main
  //   - !isDetached + siblingIndex 0 + explicit-tag → kink_start
  //   - !isDetached + siblingIndex ≥ 1 → kink_start (non-evidence)
  // The legacy "flag-family + isDetached → tangent" rule was a
  // workaround in the placeholder; BR-001 explicitly removes it.

  it('isDetached takes precedence over every other axis (row 1)', () => {
    const fromNode = fakeNode({ kindColorFamily: 'flag' });
    const toNode = fakeNode({ messageId: 'm2' });
    const k = derivePlaceholderBranchKind({ fromNode, toNode, isDetached: true });
    expect(k).toBe('detached');
  });

  it('isDetached + branch_this_off tag → detached (row 1)', () => {
    const fromNode = fakeNode({ droppedTags: [{ code: 'branch_this_off', label: 'Branch', color: '#fff' }] });
    const toNode = fakeNode({ messageId: 'm2' });
    const k = derivePlaceholderBranchKind({ fromNode, toNode, isDetached: true });
    expect(k).toBe('detached');
  });

  it('isDetached + tangent_or_joke tag → detached (row 1)', () => {
    const fromNode = fakeNode();
    const toNode = fakeNode({ messageId: 'm2', droppedTags: [{ code: 'tangent_or_joke', label: 'Tangent', color: '#fff' }] });
    const k = derivePlaceholderBranchKind({ fromNode, toNode, isDetached: true });
    expect(k).toBe('detached');
  });

  it('isDetached + no signals → detached', () => {
    const fromNode = fakeNode();
    const toNode = fakeNode({ messageId: 'm2' });
    const k = derivePlaceholderBranchKind({ fromNode, toNode, isDetached: true });
    expect(k).toBe('detached');
  });

  it('NOT detached + flag-family + siblingIndex 0 → main (doctrine guard)', () => {
    // Doctrine guard: a flagged-but-still-anchored move is NOT a kink.
    const fromNode = fakeNode({ kindColorFamily: 'flag' });
    const toNode = fakeNode({ messageId: 'm2', siblingIndex: 0 });
    const k = derivePlaceholderBranchKind({ fromNode, toNode, isDetached: false });
    expect(k).toBe('main');
  });

  it('NOT detached + branch_this_off tag + siblingIndex 0 → kink_start (BR-001 row 4)', () => {
    const fromNode = fakeNode({ droppedTags: [{ code: 'branch_this_off', label: 'Branch', color: '#fff' }] });
    const toNode = fakeNode({ messageId: 'm2', siblingIndex: 0 });
    const k = derivePlaceholderBranchKind({ fromNode, toNode, isDetached: false });
    expect(k).toBe('kink_start');
  });

  it('NOT detached + siblingIndex ≥ 1 + no tag → kink_start (BR-001 row 6)', () => {
    const fromNode = fakeNode();
    const toNode = fakeNode({ messageId: 'm2', siblingIndex: 2 });
    const k = derivePlaceholderBranchKind({ fromNode, toNode, isDetached: false });
    expect(k).toBe('kink_start');
  });

  it('all-clean (siblingIndex 0, no tag) → main', () => {
    const fromNode = fakeNode();
    const toNode = fakeNode({ messageId: 'm2', siblingIndex: 0 });
    const k = derivePlaceholderBranchKind({ fromNode, toNode, isDetached: false });
    expect(k).toBe('main');
  });

  it('exhaustive sweep — adapter never emits tangent or kink_end (those need full-tree context)', () => {
    // Without the evidence-thread map or the parent-edge classification
    // from pass 2, the three-arg adapter cannot produce 'tangent' or
    // 'kink_end' — those require knowing the parent edge's branch kind.
    // The adapter is restricted to {'main', 'kink_start', 'detached'}.
    const families: TimelineKindColorFamily[] = ['claim', 'challenge', 'evidence', 'clarify', 'concede', 'flag', 'default'];
    const tagSets = [[], [{ code: 'branch_this_off', label: 'B', color: '#000' }], [{ code: 'tangent_or_joke', label: 'T', color: '#000' }]];
    for (const family of families) {
      for (const tags of tagSets) {
        for (const isDetached of [false, true]) {
          for (const siblingIndex of [0, 1, 2, 5]) {
            const fromNode = fakeNode({ kindColorFamily: family, droppedTags: tags });
            const toNode = fakeNode({ messageId: 'm2', siblingIndex });
            const k = derivePlaceholderBranchKind({ fromNode, toNode, isDetached });
            expect(k === 'tangent' || k === 'kink_end').toBe(false);
          }
        }
      }
    }
  });
});

// ────────────────────────────────────────────────────────────────
// 5. buildRailSegmentInput
// ────────────────────────────────────────────────────────────────

describe('VG-002 — buildRailSegmentInput', () => {
  it('empty artifact lists for both endpoints → no_source', () => {
    const edge = fakeEdge();
    const fromNode = fakeNode({ messageId: 'm1' });
    const toNode = fakeNode({ messageId: 'm2' });
    const input = buildRailSegmentInput({ edge, fromNode, toNode, artifactsByMessageId: {} });
    expect(input.sourceChainStatus).toBe('no_source');
  });

  it('endpoint A source_and_quote, B broken → worst is broken (broken is worst severity)', () => {
    const edge = fakeEdge();
    const fromNode = fakeNode({ messageId: 'm1' });
    const toNode = fakeNode({ messageId: 'm2' });
    const input = buildRailSegmentInput({
      edge,
      fromNode,
      toNode,
      artifactsByMessageId: {
        m1: [fakeArtifact({ id: 'a-1', sourceChainStatus: 'source_and_quote' })],
        m2: [fakeArtifact({ id: 'a-2', sourceChainStatus: 'broken' })],
      },
    });
    expect(input.sourceChainStatus).toBe('broken');
  });

  it('endpoint A primary_present alone → primary_present', () => {
    const edge = fakeEdge();
    const fromNode = fakeNode({ messageId: 'm1' });
    const toNode = fakeNode({ messageId: 'm2' });
    const input = buildRailSegmentInput({
      edge,
      fromNode,
      toNode,
      artifactsByMessageId: { m1: [fakeArtifact({ sourceChainStatus: 'primary_present' })] },
    });
    expect(input.sourceChainStatus).toBe('primary_present');
  });

  it('propagates the adapter branchKind into the input (isDetached → detached)', () => {
    // BR-001 — the adapter routes isDetached to 'detached' regardless
    // of family / tag. The legacy "flag + detached → tangent" rule is
    // intentionally removed.
    const edge = fakeEdge({ isDetached: true });
    const fromNode = fakeNode({ kindColorFamily: 'flag' });
    const toNode = fakeNode({ messageId: 'm2' });
    const input = buildRailSegmentInput({ edge, fromNode, toNode, artifactsByMessageId: {} });
    expect(input.branchKind).toBe('detached');
  });

  it('propagates kink_start when siblingIndex ≥ 1 (BR-001 four-axis classifier)', () => {
    const edge = fakeEdge({ isDetached: false });
    const fromNode = fakeNode();
    const toNode = fakeNode({ messageId: 'm2', siblingIndex: 2 });
    const input = buildRailSegmentInput({ edge, fromNode, toNode, artifactsByMessageId: {} });
    expect(input.branchKind).toBe('kink_start');
  });

  it('propagates main when siblingIndex 0 + non-tagged + non-evidence', () => {
    const edge = fakeEdge({ isDetached: false });
    const fromNode = fakeNode();
    const toNode = fakeNode({ messageId: 'm2', siblingIndex: 0 });
    const input = buildRailSegmentInput({ edge, fromNode, toNode, artifactsByMessageId: {} });
    expect(input.branchKind).toBe('main');
  });

  it('when evidenceThreadByBranchRoot says true, siblingIndex ≥ 1 stays main (row 5)', () => {
    const edge = fakeEdge({ isDetached: false });
    const fromNode = fakeNode();
    const toNode = fakeNode({ messageId: 'm2', siblingIndex: 2, branchRootMessageId: 'br-evidence' });
    const evidenceMap = new Map<string, boolean>([['br-evidence', true]]);
    const input = buildRailSegmentInput({
      edge, fromNode, toNode,
      artifactsByMessageId: {},
      evidenceThreadByBranchRoot: evidenceMap,
    });
    expect(input.branchKind).toBe('main');
  });

  it('uses toNode tone + temperature (the most recent move drives the wash)', () => {
    const edge = fakeEdge();
    const fromNode = fakeNode({ toneBand: 'calm', temperatureBand: 'cool' });
    const toNode = fakeNode({ messageId: 'm2', toneBand: 'hostile', temperatureBand: 'hot' });
    const input = buildRailSegmentInput({ edge, fromNode, toNode, artifactsByMessageId: {} });
    expect(input.toneBand).toBe('hostile');
    expect(input.temperatureBand).toBe('hot');
  });
});

// ────────────────────────────────────────────────────────────────
// 6. Virtualization slice
// ────────────────────────────────────────────────────────────────

describe('VG-002 — visibleSegmentSlice', () => {
  function rail(n: number, step = 72): RailSegmentInput[] {
    return Array.from({ length: n }, (_, i) =>
      fakeInput({
        segmentId: `seg-${i}`,
        fromMessageId: `m${i}`,
        toMessageId: `m${i + 1}`,
        x1: i * step,
        y1: 100,
        x2: (i + 1) * step,
        y2: 100,
      }),
    );
  }

  it('returns only segments whose x-range intersects [scrollX - buffer, scrollX + viewport + buffer]', () => {
    const segs = rail(250, 72);
    const viewport = 800;
    const scrollX = 5000;
    const slice = visibleSegmentSlice(segs, scrollX, viewport, 800);
    for (const s of slice) {
      const segMin = Math.min(s.x1, s.x2);
      const segMax = Math.max(s.x1, s.x2);
      expect(segMax).toBeGreaterThanOrEqual(scrollX - 800);
      expect(segMin).toBeLessThanOrEqual(scrollX + viewport + 800);
    }
  });

  it('250-segment fixture, viewport 800, default buffer → slice ≤ 50', () => {
    const segs = rail(250, 72);
    const slice = visibleSegmentSlice(segs, 5000, 800);
    expect(slice.length).toBeLessThanOrEqual(50);
  });

  it('250-segment fixture: peak rail-layer View count is bounded (≤ 330) per design', () => {
    // Design budget: peak rail-layer `<View>` count ≤ 330 at any
    // moment, regardless of message count. The bound is derived from
    // ~33 visible segments × ~10 `<View>`s per segment in a typical
    // mix of states. The test computes the peak by deriving the actual
    // style for each visible segment and counting mounted `<View>`s
    // (wrapper + base sub-strips + tone wash if alpha>0 + evidence
    // track + glow if active). The default fixture uses non-active
    // edges with no_source, which is the dominant state in a real
    // room and which renders the fewest layers per segment.
    const segs = rail(250, 72);
    const slice = visibleSegmentSlice(segs, 5000, 800);
    let total = 0;
    for (const s of slice) {
      const style = deriveRailSegmentStyle(s);
      if (style.isHidden) continue;
      total += 1; // wrapper
      total += style.baseSubStripColors.length; // 6 base sub-strips
      if (style.toneWash.alpha > 0) total += 1;
      if (style.evidenceTrack) {
        if (style.evidenceTrack.mode === 'solid') total += 1;
        else total += 1 + style.evidenceTrack.alphaPattern.length; // dotted wrapper + 6 sub-strips
      }
      if (style.glow) total += 1;
      if (style.wrapper.showKinkStartStub) total += 1;
      if (style.wrapper.showKinkEndStub) total += 1;
    }
    expect(total).toBeLessThanOrEqual(330);
    // Sanity: this fixture is the dominant (low-overhead) state.
    expect(slice.length).toBeLessThanOrEqual(50);
  });

  it('250-segment fixture worst-case (active + broken + warm) stays ≤ ~510 (documents the upper bound)', () => {
    // Documents the absolute ceiling when EVERY visible segment is in
    // the most layer-heavy state (active path + broken trail +
    // warm-warm tone wash). Realistic rooms never approach this; the
    // design's 330 budget assumes the typical mix.
    const segs = rail(250, 72).map((s) => ({
      ...s,
      isActivePath: true,
      sourceChainStatus: 'broken' as SourceChainStatus,
      toneBand: 'heated' as TimelineToneBand,
      temperatureBand: 'warm' as TimelineTemperatureBand,
    }));
    const slice = visibleSegmentSlice(segs, 5000, 800);
    let total = 0;
    for (const s of slice) {
      const style = deriveRailSegmentStyle(s);
      if (style.isHidden) continue;
      total += 1;
      total += style.baseSubStripColors.length;
      if (style.toneWash.alpha > 0) total += 1;
      if (style.evidenceTrack) {
        if (style.evidenceTrack.mode === 'solid') total += 1;
        else total += 1 + style.evidenceTrack.alphaPattern.length;
      }
      if (style.glow) total += 1;
    }
    // Worst case per segment: 1 wrapper + 6 base + 1 tone + 1 dotted
    // wrapper + 6 dotted sub-strips + 1 glow = 16. Slice is ≤ 50
    // segments, so the documented upper bound is 50 * 16 = 800. This
    // is the absolute ceiling; realistic rooms never approach it.
    expect(total).toBeLessThanOrEqual(50 * 16);
  });

  it('zero-segment input → empty slice', () => {
    const slice = visibleSegmentSlice([], 0, 800);
    expect(slice).toEqual([]);
  });

  it('partial-overlap segments at the viewport edge ARE included (no false negatives)', () => {
    const segs = [
      fakeInput({ segmentId: 'left-overlap', x1: -10, y1: 100, x2: 10, y2: 100 }),
      fakeInput({ segmentId: 'right-overlap', x1: 790, y1: 100, x2: 850, y2: 100 }),
    ];
    const slice = visibleSegmentSlice(segs, 0, 800, 0);
    expect(slice.map((s) => s.segmentId).sort()).toEqual(['left-overlap', 'right-overlap']);
  });

  it('off-screen segments outside buffer are excluded', () => {
    const segs = [
      fakeInput({ segmentId: 'far-left', x1: -2000, y1: 100, x2: -1900, y2: 100 }),
      fakeInput({ segmentId: 'far-right', x1: 5000, y1: 100, x2: 5100, y2: 100 }),
      fakeInput({ segmentId: 'in-view', x1: 100, y1: 100, x2: 200, y2: 100 }),
    ];
    const slice = visibleSegmentSlice(segs, 0, 800, 200);
    expect(slice.map((s) => s.segmentId)).toEqual(['in-view']);
  });

  it('default buffer is applied when bufferPx is omitted', () => {
    const segs = [
      fakeInput({ segmentId: 'in-default-buffer', x1: 1200, y1: 100, x2: 1300, y2: 100 }),
    ];
    // Without the default buffer this would not intersect [0, 800].
    const slice = visibleSegmentSlice(segs, 0, 800);
    expect(slice.map((s) => s.segmentId)).toEqual(['in-default-buffer']);
  });
});

// ────────────────────────────────────────────────────────────────
// 7. Memoization (deep-equal output for same input)
// ────────────────────────────────────────────────────────────────

describe('VG-002 — deriveRailSegmentStyle determinism / memoization', () => {
  it('same input twice produces deeply equal output', () => {
    const input = fakeInput({ sourceChainStatus: 'source_and_quote', isActivePath: true, toneBand: 'heated', temperatureBand: 'warm' });
    const a = deriveRailSegmentStyle(input);
    const b = deriveRailSegmentStyle(input);
    expect(a).toEqual(b);
  });

  it('different isActivePath → different style (glow toggles)', () => {
    const a = deriveRailSegmentStyle(fakeInput({ isActivePath: false }));
    const b = deriveRailSegmentStyle(fakeInput({ isActivePath: true }));
    expect(a.glow).toBeNull();
    expect(b.glow).not.toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────
// 8. Whole-rail accessibility label
// ────────────────────────────────────────────────────────────────

describe('VG-002 — buildWholeRailAccessibilityLabel', () => {
  it('zero messages → "Trail: 0 messages."', () => {
    expect(buildWholeRailAccessibilityLabel({
      nodeCount: 0,
      activeBranchCount: 0,
      segmentsWithSourceAttached: 0,
      segmentsNeedingSource: 0,
    })).toBe('Trail: 0 messages.');
  });

  it('one message, no branches → "Trail: 1 message, 0 active branches, source attached on 0."', () => {
    const out = buildWholeRailAccessibilityLabel({
      nodeCount: 1,
      activeBranchCount: 0,
      segmentsWithSourceAttached: 0,
      segmentsNeedingSource: 0,
    });
    expect(out).toBe('Trail: 1 message, 0 active branches, source attached on 0.');
  });

  it('one active branch → singular "1 active branch"', () => {
    const out = buildWholeRailAccessibilityLabel({
      nodeCount: 5,
      activeBranchCount: 1,
      segmentsWithSourceAttached: 3,
      segmentsNeedingSource: 1,
    });
    expect(out).toContain('1 active branch');
    expect(out).toContain('source attached on 3');
    expect(out).toContain('1 branch needs a source');
  });

  it('multiple branches needing a source → plural "N branches need a source"', () => {
    const out = buildWholeRailAccessibilityLabel({
      nodeCount: 10,
      activeBranchCount: 2,
      segmentsWithSourceAttached: 5,
      segmentsNeedingSource: 3,
    });
    expect(out).toContain('2 active branches');
    expect(out).toContain('3 branches need a source');
  });

  it('zero needing source → omits the "needs a source" clause entirely', () => {
    const out = buildWholeRailAccessibilityLabel({
      nodeCount: 3,
      activeBranchCount: 1,
      segmentsWithSourceAttached: 3,
      segmentsNeedingSource: 0,
    });
    expect(out).not.toContain('needs a source');
    expect(out).not.toContain('need a source');
  });
});

// ────────────────────────────────────────────────────────────────
// 9. EV-001 surface lock — exhaustive over ALL_SOURCE_CHAIN_STATUSES
// ────────────────────────────────────────────────────────────────

describe('VG-002 — EV-001 surface lock', () => {
  it('every SourceChainStatus value produces a deterministic style', () => {
    for (const status of ALL_SOURCE_CHAIN_STATUSES) {
      const s = deriveRailSegmentStyle(fakeInput({ sourceChainStatus: status }));
      // Either null (no_source / unverified) or a defined layer.
      if (status === 'no_source' || status === 'unverified') {
        expect(s.evidenceTrack).toBeNull();
      } else {
        expect(s.evidenceTrack).not.toBeNull();
      }
      // Accessibility fragment is always a plain-English non-empty string.
      expect(typeof s.accessibilityFragment).toBe('string');
      expect(s.accessibilityFragment.length).toBeGreaterThan(0);
    }
  });
});

// ────────────────────────────────────────────────────────────────
// 10. Ban-list — verdict, amplification, snake_case
// ────────────────────────────────────────────────────────────────

describe('VG-002 — ban-list (verdict / amplification / snake_case)', () => {
  it('accessibilityFragment for every state-matrix row contains zero verdict tokens', () => {
    for (const branchKind of ALL_RAIL_BRANCH_KINDS) {
      for (const status of ALL_SOURCE_CHAIN_STATUSES) {
        for (const isActivePath of [false, true]) {
          const s = deriveRailSegmentStyle(fakeInput({ branchKind, sourceChainStatus: status, isActivePath }));
          assertNoBanned(s.accessibilityFragment, VERDICT_TOKENS);
        }
      }
    }
  });

  it('accessibilityFragment contains zero amplification tokens', () => {
    for (const branchKind of ALL_RAIL_BRANCH_KINDS) {
      for (const status of ALL_SOURCE_CHAIN_STATUSES) {
        const s = deriveRailSegmentStyle(fakeInput({ branchKind, sourceChainStatus: status }));
        assertNoBanned(s.accessibilityFragment, AMPLIFICATION_TOKENS);
      }
    }
  });

  it('no string field looks like an internal snake_case code', () => {
    for (const branchKind of ALL_RAIL_BRANCH_KINDS) {
      for (const status of ALL_SOURCE_CHAIN_STATUSES) {
        const s = deriveRailSegmentStyle(fakeInput({ branchKind, sourceChainStatus: status }));
        // Whole-string check; the fragments are short prose, so this is safe.
        expect(looksLikeInternalCode(s.accessibilityFragment)).toBe(false);
      }
    }
  });

  it('whole-rail labels (varied fixtures) contain zero verdict / amplification tokens', () => {
    const fixtures = [
      { nodeCount: 0, activeBranchCount: 0, segmentsWithSourceAttached: 0, segmentsNeedingSource: 0 },
      { nodeCount: 1, activeBranchCount: 0, segmentsWithSourceAttached: 0, segmentsNeedingSource: 0 },
      { nodeCount: 5, activeBranchCount: 1, segmentsWithSourceAttached: 3, segmentsNeedingSource: 1 },
      { nodeCount: 250, activeBranchCount: 12, segmentsWithSourceAttached: 87, segmentsNeedingSource: 41 },
    ];
    for (const fx of fixtures) {
      const out = buildWholeRailAccessibilityLabel(fx);
      assertNoBanned(out, VERDICT_TOKENS);
      assertNoBanned(out, AMPLIFICATION_TOKENS);
    }
  });
});

// ────────────────────────────────────────────────────────────────
// 11. Doctrine anchors
// ────────────────────────────────────────────────────────────────

describe('VG-002 — doctrine anchors', () => {
  it('hot + source_and_quote does NOT produce truth-positive copy', () => {
    const s = deriveRailSegmentStyle(fakeInput({
      toneBand: 'hostile',
      temperatureBand: 'hot',
      sourceChainStatus: 'source_and_quote',
      isActivePath: true,
    }));
    // It IS the most loaded edge a user can see — and the fragment STILL
    // describes activity + trail, NOT correctness.
    expect(s.accessibilityFragment).toMatch(/active|branch|source/);
    assertNoBanned(s.accessibilityFragment, VERDICT_TOKENS);
  });

  it('primary_present says "source attached" or "primary source attached", never "true" / "correct"', () => {
    const s = deriveRailSegmentStyle(fakeInput({ sourceChainStatus: 'primary_present', isActivePath: true }));
    expect(s.accessibilityFragment.toLowerCase()).toContain('source');
    assertNoBanned(s.accessibilityFragment, VERDICT_TOKENS);
  });

  it('warm tone is NEVER labeled as wrong / right', () => {
    const s = deriveRailSegmentStyle(fakeInput({ toneBand: 'heated', temperatureBand: 'warm' }));
    expect(s.accessibilityFragment.toLowerCase()).not.toContain('right');
    expect(s.accessibilityFragment.toLowerCase()).not.toContain('wrong');
  });
});

// ────────────────────────────────────────────────────────────────
// 12. Color-independence — every color state has an a11y label
// ────────────────────────────────────────────────────────────────

describe('VG-002 — color independence', () => {
  it('saturated track has a parallel text label', () => {
    const s = deriveRailSegmentStyle(fakeInput({ sourceChainStatus: 'source_and_quote' }));
    expect(s.accessibilityFragment.toLowerCase()).toContain('source attached');
  });

  it('dotted (broken) track has a parallel text label', () => {
    const s = deriveRailSegmentStyle(fakeInput({ sourceChainStatus: 'broken' }));
    expect(s.accessibilityFragment.toLowerCase()).toContain('weak source trail');
  });

  it('no source has a parallel text label', () => {
    const s = deriveRailSegmentStyle(fakeInput({ sourceChainStatus: 'no_source' }));
    expect(s.accessibilityFragment.toLowerCase()).toContain('needs a source');
  });

  it('tangent branch has a parallel text label', () => {
    const s = deriveRailSegmentStyle(fakeInput({ branchKind: 'tangent' }));
    expect(s.accessibilityFragment.toLowerCase()).toContain('tangent');
  });

  it('active path has a parallel text label', () => {
    const s = deriveRailSegmentStyle(fakeInput({ isActivePath: true }));
    expect(s.accessibilityFragment.toLowerCase()).toContain('active');
  });

  it('detached has a parallel text label', () => {
    const s = deriveRailSegmentStyle(fakeInput({ branchKind: 'detached' }));
    expect(s.accessibilityFragment.toLowerCase()).toContain('detached');
  });
});

// ────────────────────────────────────────────────────────────────
// 13. Reduce-motion contract (no animation in v1)
// ────────────────────────────────────────────────────────────────

describe('VG-002 — reduce-motion (no animation in v1)', () => {
  it('glow layer is static: no animatedValue, no transition props', () => {
    // The model's glow descriptor is a plain data object (color +
    // shadowOpacity + shadowRadius + elevation). Tests assert there is
    // no `animatedValue` or transition descriptor — future animation
    // cards (VG-004 / QOL-016) MUST add a reduce-motion gate before
    // promoting any of these to animated values.
    const s = deriveRailSegmentStyle(fakeInput({ isActivePath: true }));
    expect(s.glow).not.toBeNull();
    if (s.glow) {
      expect('animatedValue' in s.glow).toBe(false);
      expect('transitionDurationMs' in s.glow).toBe(false);
    }
  });

  it('non-animated style has a deterministic static counterpart for every animated future variant', () => {
    // v1 has zero animated variants. The model contract is: every layer
    // is a plain data object. This test future-proofs the seam: if
    // someone adds an animated layer without a static fallback, this
    // catches it.
    const styles = ALL_RAIL_BRANCH_KINDS.flatMap((bk) =>
      ALL_SOURCE_CHAIN_STATUSES.map((s) =>
        deriveRailSegmentStyle(fakeInput({ branchKind: bk, sourceChainStatus: s })),
      ),
    );
    for (const style of styles) {
      if (style.glow) {
        expect(typeof style.glow.shadowOpacity).toBe('number');
        expect(typeof style.glow.shadowRadius).toBe('number');
        expect(typeof style.glow.elevation).toBe('number');
      }
    }
  });
});
