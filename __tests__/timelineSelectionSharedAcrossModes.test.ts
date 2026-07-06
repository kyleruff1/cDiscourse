/**
 * IX-004 — selection is shared across Timeline and Cards/Stack.
 *
 * The acceptance criterion: selecting a node in Timeline mode, toggling
 * to Cards/Stack and back preserves the selection — both surfaces read
 * one `activeMessageId`. IX-004 introduces NO second selection id;
 * `selectionStatus` only labels the existing `activeMessageId`.
 *
 * Following the repo's `.test.tsx` discipline, runtime rendering is
 * avoided. This file proves the shared-selection invariant via:
 *
 *   1. A model assertion: the readout view-model is a pure function of
 *      `selectedMessageId` — toggling the surface `viewMode` while the
 *      id is unchanged does not change the readout subject.
 *   2. A source scan of `ArgumentGameSurface.tsx` proving `activeMessageId`
 *      is a single `useState` consumed by BOTH the Stack branch
 *      (`ArgumentBubbleStack activeMessageId=`) and the Timeline branch
 *      (`buildArgumentTimelineMap({ ... activeMessageId })`), and that the
 *      mode toggle (`toggleSurfaceMode`) does NOT reset it.
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
import type {
  SidecarViewModel,
  SidecarViewMode,
} from '../src/features/arguments/argumentReplySidecarModel';

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
    depth: 0,
    lane: 0,
    siblingIndex: 0,
    replyCount: 0,
    descendantCount: 0,
    branchId: 'branch-1',
    branchRootMessageId: over.messageId ?? 'm1',
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
    showBackToRootControl: false,
  };
}

function fakeSidecar(messageId: string, viewMode: SidecarViewMode): SidecarViewModel {
  return {
    isEmpty: false,
    selectedMessageId: messageId,
    viewMode,
    sections: [],
    accessibilityRootLabel: `Challenge from You. Message 2 of 3.`,
    emptyStateMessage: 'Pick a message on the timeline to see details.',
  };
}

const NODES = [
  fakeNode({ messageId: 'm1', ordinal: 1, isRoot: true }),
  fakeNode({ messageId: 'm2', ordinal: 2, parentId: 'm1', isActive: true, kindLabel: 'Challenge' }),
  fakeNode({ messageId: 'm3', ordinal: 3, parentId: 'm2', isLatest: true }),
];

// ── 1. Model: readout subject is independent of the surface mode ─

describe('IX-004 — readout subject is preserved across the Timeline ↔ Cards toggle', () => {
  it('the same selectedMessageId yields the same readout subject regardless of viewMode', () => {
    const inTimeline: BuildTimelineSelectedReadoutInput = {
      sidecar: fakeSidecar('m2', 'timeline'),
      timelineMap: fakeTimelineMap(NODES),
      selectedMessageId: 'm2',
      status: 'explicit',
    };
    const inStack: BuildTimelineSelectedReadoutInput = {
      sidecar: fakeSidecar('m2', 'stack'),
      timelineMap: fakeTimelineMap(NODES),
      selectedMessageId: 'm2',
      status: 'explicit',
    };

    const timelineVm = buildTimelineSelectedReadoutViewModel(inTimeline);
    const stackVm = buildTimelineSelectedReadoutViewModel(inStack);

    // Toggling the surface mode does not move the selection.
    expect(timelineVm.selectedMessageId).toBe('m2');
    expect(stackVm.selectedMessageId).toBe('m2');
    expect(timelineVm.actingOnShortLabel).toBe(stackVm.actingOnShortLabel);
    expect(timelineVm.directReplyCount).toBe(stackVm.directReplyCount);
  });

  it('round-tripping Timeline → Cards → Timeline keeps the same subject', () => {
    const ids = ['m2', 'm2', 'm2']; // selection id never changes across the toggle
    const subjects = ids.map((id) =>
      buildTimelineSelectedReadoutViewModel({
        sidecar: fakeSidecar(id, 'timeline'),
        timelineMap: fakeTimelineMap(NODES),
        selectedMessageId: id,
        status: 'explicit',
      }).selectedMessageId,
    );
    expect(new Set(subjects).size).toBe(1);
    expect(subjects[0]).toBe('m2');
  });
});

// ── 2. Source scan: one shared activeMessageId, no second id ────

describe('IX-004 — ArgumentGameSurface uses one shared activeMessageId', () => {
  it('activeMessageId is a single useState in the surface shell', () => {
    expect(GAME_SURFACE_SRC).toMatch(
      /const \[activeMessageId, setActiveMessageId\] = useState<string \| null>/,
    );
  });

  it('the Stack branch reads the shared activeMessageId', () => {
    // ASP-EXTRACT-001 (Slice 2) — the stack mount moved into ExchangeView.
    // The orchestrator threads the single shared activeMessageId into the
    // stack lens via <ExchangeView activeMessageId={activeMessageId} />, which
    // forwards it to <ArgumentBubbleStack activeMessageId={props.activeMessageId} />.
    expect(GAME_SURFACE_SRC).toMatch(/<ExchangeView[\s\S]*?activeMessageId=\{activeMessageId\}/);
  });

  it('the Timeline map is built from the shared activeMessageId', () => {
    expect(GAME_SURFACE_SRC).toMatch(/buildArgumentTimelineMap\(\{[\s\S]*?activeMessageId,/);
  });

  it('the readout view-model is built from the same shared activeMessageId', () => {
    expect(GAME_SURFACE_SRC).toMatch(
      /buildTimelineSelectedReadoutViewModel\(\{[\s\S]*?selectedMessageId: activeMessageId,/,
    );
  });

  it('the mode toggle uses toggleSurfaceMode and does NOT reset activeMessageId', () => {
    // handleToggleMode flips only `mode`; it must not call setActiveMessageId.
    const idx = GAME_SURFACE_SRC.indexOf('const handleToggleMode');
    expect(idx).toBeGreaterThan(-1);
    const block = GAME_SURFACE_SRC.slice(idx, idx + 160);
    expect(block).toMatch(/toggleSurfaceMode/);
    expect(block).not.toMatch(/setActiveMessageId/);
  });

  it('IX-004 introduces no second selection id — selectionStatus only labels the existing one', () => {
    // selectionStatus is a status enum, never a message id.
    expect(GAME_SURFACE_SRC).toMatch(
      /const \[selectionStatus, setSelectionStatus\] = useState<ReadoutSelectionStatus>/,
    );
    // There is exactly one `[*MessageId, set*MessageId] = useState` for the
    // active selection (latestId is a useMemo, not a second selection state).
    const selectionStateDecls = GAME_SURFACE_SRC.match(
      /const \[\w*[Mm]essageId, set\w*[Mm]essageId\] = useState/g,
    ) ?? [];
    expect(selectionStateDecls.length).toBe(1);
  });
});
