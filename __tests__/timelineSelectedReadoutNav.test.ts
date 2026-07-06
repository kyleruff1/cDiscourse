/**
 * IX-004 — Prev / Next / Latest / Back-to-root update the readout.
 *
 * The room's Prev / Next / Latest / Back-to-root controls all mutate
 * `activeMessageId` (the single selection source of truth) and mark
 * `selectionStatus = 'explicit'`. The readout view-model is rebuilt from
 * `activeMessageId`, so its subject + a11y label follow every nav move.
 *
 * Following the repo's `.test.tsx` discipline (see
 * `argumentReplySidecar.test.tsx` / `composerDockInRoom.test.ts`):
 * runtime react-test-renderer rendering is intentionally avoided (the
 * pinned react-test-renderer is outside @testing-library's peer range).
 * Instead this file combines:
 *
 *   1. A model assertion: rebuilding the readout with each nav target
 *      (prev / next / latest / root) yields the matching subject +
 *      accessibilityPanelLabel.
 *   2. A source scan of `ArgumentGameSurface.tsx` proving `handlePrev`,
 *      `handleNext`, the `handleJumpLatest` / `handleJumpToRoot` handlers
 *      (ASP-EXTRACT-001 lifted these from the former onJumpLatest /
 *      onJumpToRoot inline closures) and the keyboard-driven `onActivate`
 *      (`handleActivate`) path each set `selectionStatus` to `'explicit'`
 *      alongside `setActiveMessageId`.
 */
import fs from 'fs';
import path from 'path';

import {
  buildTimelineSelectedReadoutViewModel,
  type BuildTimelineSelectedReadoutInput,
} from '../src/features/arguments/timelineSelectedReadoutModel';
import type {
  ArgumentTimelineMapModel,
  ArgumentTimelineMapNode,
  TimelineKindColorFamily,
  TimelineStandingBand,
  TimelineTemperatureBand,
  TimelineToneBand,
} from '../src/features/arguments/argumentGameSurfaceModel';
import type { SidecarViewModel } from '../src/features/arguments/argumentReplySidecarModel';

const GAME_SURFACE_SRC = fs.readFileSync(
  path.join(process.cwd(), 'src', 'features', 'arguments', 'room', 'ArgumentRoom.tsx'),
  'utf8',
);

// ── Fixtures ──────────────────────────────────────────────────

function fakeNode(over: Partial<ArgumentTimelineMapNode> = {}): ArgumentTimelineMapNode {
  return {
    messageId: over.messageId ?? 'm1',
    parentId: over.parentId ?? null,
    ordinal: over.ordinal ?? 1,
    createdAt: '2026-05-18T10:00:00.000Z',
    createdAtLabel: '2026-05-18 10:00',
    relativeLabel: 'now',
    actorLabel: 'You',
    kindLabel: over.kindLabel ?? 'Claim',
    sideLabel: 'Aff',
    bodyPreview: 'preview',
    badges: [],
    droppedTags: [],
    depth: over.depth ?? 0,
    lane: over.lane ?? 0,
    siblingIndex: 0,
    replyCount: 0,
    descendantCount: 0,
    branchId: 'branch-1',
    branchRootMessageId: over.branchRootMessageId ?? over.messageId ?? 'm1',
    junctionGroupId: null,
    isJunction: false,
    junctionChildCount: 0,
    isActive: over.isActive ?? false,
    isLatest: over.isLatest ?? false,
    isDetached: false,
    isActivePath: false,
    isRoot: over.isRoot ?? false,
    isFirstRebuttal: false,
    standingBand: 'neutral' as TimelineStandingBand,
    toneBand: 'calm' as TimelineToneBand,
    temperatureBand: 'cool' as TimelineTemperatureBand,
    kindColor: '#22c55e',
    kindColorFamily: 'claim' as TimelineKindColorFamily,
    x: 0,
    y: 120,
    accessibilityLabel: over.messageId ?? 'm1',
  };
}

function fakeTimelineMap(nodes: ArgumentTimelineMapNode[]): ArgumentTimelineMapModel {
  const active = nodes.find((n) => n.isActive) ?? null;
  return {
    nodes,
    edges: [],
    bands: [],
    activeNode: active,
    latestMessageId: nodes.length ? nodes[nodes.length - 1].messageId : null,
    activePathIds: active ? [active.messageId] : [],
    width: 100,
    height: 240,
    scrollWidth: 100,
    beginningLabel: 'start',
    middleLabel: 'mid',
    endLabel: 'end',
    participantTrends: [],
    legend: [],
    rootMessageId: nodes.length ? nodes[0].messageId : null,
    firstRebuttalMessageId: null,
    hasRebuttal: false,
    rootOnboardingHint: null,
    showBackToRootControl: true,
  };
}

function fakeSidecar(messageId: string, rootLabel: string): SidecarViewModel {
  return {
    isEmpty: false,
    selectedMessageId: messageId,
    viewMode: 'timeline',
    sections: [],
    accessibilityRootLabel: rootLabel,
    emptyStateMessage: 'Pick a message on the timeline to see details.',
  };
}

const NODES = [
  fakeNode({ messageId: 'm1', ordinal: 1, isRoot: true, kindLabel: 'Claim' }),
  fakeNode({ messageId: 'm2', ordinal: 2, parentId: 'm1', kindLabel: 'Challenge' }),
  fakeNode({ messageId: 'm3', ordinal: 3, parentId: 'm2', isLatest: true, kindLabel: 'Evidence' }),
];

function readoutFor(messageId: string): ReturnType<typeof buildTimelineSelectedReadoutViewModel> {
  const node = NODES.find((n) => n.messageId === messageId)!;
  const input: BuildTimelineSelectedReadoutInput = {
    sidecar: fakeSidecar(messageId, `${node.kindLabel} from You. Message ${node.ordinal} of 3.`),
    timelineMap: fakeTimelineMap(NODES),
    selectedMessageId: messageId,
    status: 'explicit',
  };
  return buildTimelineSelectedReadoutViewModel(input);
}

// ── 1. Model: each nav target produces the matching subject ───

describe('IX-004 — readout follows Prev / Next / Latest / Back-to-root', () => {
  it('Next from the root readout shows the next chronological message', () => {
    // Starting subject m1; Next selects m2.
    const before = readoutFor('m1');
    const after = readoutFor('m2');
    expect(before.selectedMessageId).toBe('m1');
    expect(after.selectedMessageId).toBe('m2');
    expect(after.actingOnShortLabel).toBe('Challenge · #2');
    expect(after.accessibilityPanelLabel).not.toBe(before.accessibilityPanelLabel);
  });

  it('Prev from a mid readout shows the previous chronological message', () => {
    const before = readoutFor('m2');
    const after = readoutFor('m1');
    expect(after.selectedMessageId).toBe('m1');
    expect(after.actingOnShortLabel).toBe('Claim · #1');
    expect(after.accessibilityPanelLabel).not.toBe(before.accessibilityPanelLabel);
  });

  it('Latest jumps the readout to the last chronological message', () => {
    const after = readoutFor('m3');
    expect(after.selectedMessageId).toBe('m3');
    expect(after.actingOnShortLabel).toBe('Evidence · #3');
    expect(after.accessibilityPanelLabel).toContain('Message 3 of 3');
  });

  it('Back-to-root jumps the readout to the opening claim', () => {
    const after = readoutFor('m1');
    expect(after.selectedMessageId).toBe('m1');
    expect(after.accessibilityPanelLabel).toContain('Message 1 of 3');
  });
});

// ── 2. Source scan: nav callbacks mark the selection explicit ──

describe('IX-004 — ArgumentGameSurface nav callbacks set selectionStatus explicit', () => {
  it('handleActivate (tap + keyboard onActivate path) sets selectionStatus to explicit', () => {
    expect(GAME_SURFACE_SRC).toMatch(
      /const handleActivate = useCallback\(\(id: string\) => \{[\s\S]*?setActiveMessageId\(id\);[\s\S]*?setSelectionStatus\('explicit'\);[\s\S]*?\}/,
    );
  });

  it('handlePrev sets selectionStatus to explicit alongside setActiveMessageId', () => {
    expect(GAME_SURFACE_SRC).toMatch(
      /const handlePrev = useCallback\(\(\) => \{[\s\S]*?setActiveMessageId\(prev\);[\s\S]*?setSelectionStatus\('explicit'\);/,
    );
  });

  it('handleNext sets selectionStatus to explicit alongside setActiveMessageId', () => {
    expect(GAME_SURFACE_SRC).toMatch(
      /const handleNext = useCallback\(\(\) => \{[\s\S]*?setActiveMessageId\(next\);[\s\S]*?setSelectionStatus\('explicit'\);/,
    );
  });

  it('the handleJumpLatest handler (lifted onJumpLatest) sets selectionStatus to explicit', () => {
    // ASP-EXTRACT-001 — the former onJumpLatest inline arrow was lifted into
    // this named orchestrator handler so MapView can receive it as a prop.
    const idx = GAME_SURFACE_SRC.indexOf('const handleJumpLatest');
    expect(idx).toBeGreaterThan(-1);
    const block = GAME_SURFACE_SRC.slice(idx, idx + 240);
    expect(block).toMatch(/setActiveMessageId\(latestId\)/);
    expect(block).toMatch(/setSelectionStatus\('explicit'\)/);
  });

  it('the handleJumpToRoot handler (lifted onJumpToRoot) sets selectionStatus to explicit', () => {
    // ASP-EXTRACT-001 — lifted from the former onJumpToRoot inline arrow.
    const idx = GAME_SURFACE_SRC.indexOf('const handleJumpToRoot');
    expect(idx).toBeGreaterThan(-1);
    const block = GAME_SURFACE_SRC.slice(idx, idx + 260);
    expect(block).toMatch(/setActiveMessageId\(timelineMap\.rootMessageId\)/);
    expect(block).toMatch(/setSelectionStatus\('explicit'\)/);
  });

  it('the readout view-model is rebuilt from activeMessageId so it follows every nav move', () => {
    expect(GAME_SURFACE_SRC).toMatch(
      /buildTimelineSelectedReadoutViewModel\(\{[\s\S]*?selectedMessageId: activeMessageId,[\s\S]*?\}\)/,
    );
  });

  it('UX-001.2 — the readout panel is rendered BELOW the timeline (MapView) in the timeline branch', () => {
    // IX-004 originally placed the panel above the Timeline; UX-001.2
    // relocates it below so the Timeline becomes the first substantive
    // in-room object beneath the AppHeader + compact strip. The IX-004
    // contract (model, selection source of truth, a11y live region) is
    // preserved verbatim — only the mount-site flips.
    // ASP-EXTRACT-001 (Slice 1) — the mode === timeline col1 body is now
    // <MapView> (ArgumentTimelineMap moved inside it). The col1-before-col2
    // ordering is unchanged.
    const panelIdx = GAME_SURFACE_SRC.indexOf('<TimelineSelectedReadoutPanel');
    const mapIdx = GAME_SURFACE_SRC.indexOf('<MapView');
    expect(panelIdx).toBeGreaterThan(-1);
    expect(mapIdx).toBeGreaterThan(-1);
    expect(panelIdx).toBeGreaterThan(mapIdx);
  });
});
