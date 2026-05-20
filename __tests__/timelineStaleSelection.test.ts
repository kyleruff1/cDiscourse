/**
 * IX-004 — stale-selection fallback.
 *
 * When the previously-selected message disappears upstream (admin
 * removal / soft-delete / filter), the room's stale-snap effect snaps
 * `activeMessageId` to the latest and sets `selectionStatus =
 * 'stale_fallback'`. The readout panel then shows the verbatim banner
 * "That message is no longer here — showing the latest move." If the
 * room is now empty, the panel falls through to the empty state with NO
 * stale banner and no crash.
 *
 * This file covers:
 *
 *   1. Model: `status === 'stale_fallback'` surfaces the verbatim banner
 *      and prefixes the live-region announcement with it.
 *   2. Model: every non-stale status leaves `staleNotice` null.
 *   3. Model: a stale status with an empty room → empty state, no
 *      banner, no throw.
 *   4. Source scan: the `ArgumentGameSurface` stale-snap effect sets
 *      `selectionStatus` to `'stale_fallback'` when it snaps to latest,
 *      and every explicit selection callback resets it to `'explicit'`
 *      (so the banner does not latch after the user moves on).
 */
import fs from 'fs';
import path from 'path';

import {
  buildTimelineSelectedReadoutViewModel,
  TIMELINE_READOUT_COPY,
  type ReadoutSelectionStatus,
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
  path.join(process.cwd(), 'src', 'features', 'arguments', 'ArgumentGameSurface.tsx'),
  'utf8',
);

const VERBATIM_STALE_NOTICE = 'That message is no longer here — showing the latest move.';

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

function fakeSidecar(messageId: string | null): SidecarViewModel {
  const isEmpty = messageId === null;
  return {
    isEmpty,
    selectedMessageId: messageId,
    viewMode: 'timeline',
    sections: [],
    accessibilityRootLabel: isEmpty
      ? 'Pick a message on the timeline to see details.'
      : 'Claim from You. Message 1 of 1.',
    emptyStateMessage: 'Pick a message on the timeline to see details.',
  };
}

// ── 1. Stale fallback surfaces the verbatim banner ────────────

describe('IX-004 — stale_fallback surfaces the verbatim banner', () => {
  it('status stale_fallback sets staleNotice to the exact frozen string', () => {
    const vm = buildTimelineSelectedReadoutViewModel({
      sidecar: fakeSidecar('m1'),
      timelineMap: fakeTimelineMap([fakeNode({ messageId: 'm1', isActive: true, isLatest: true })]),
      selectedMessageId: 'm1',
      status: 'stale_fallback',
    });
    expect(vm.staleNotice).toBe(VERBATIM_STALE_NOTICE);
    expect(vm.staleNotice).toBe(TIMELINE_READOUT_COPY.STALE_NOTICE);
  });

  it('the live-region announcement is prefixed with the stale notice', () => {
    const vm = buildTimelineSelectedReadoutViewModel({
      sidecar: fakeSidecar('m1'),
      timelineMap: fakeTimelineMap([fakeNode({ messageId: 'm1', isActive: true })]),
      selectedMessageId: 'm1',
      status: 'stale_fallback',
    });
    expect(vm.accessibilitySelectionAnnouncement.startsWith(VERBATIM_STALE_NOTICE)).toBe(true);
    // The announcement still carries the new subject's panel label.
    expect(vm.accessibilitySelectionAnnouncement).toContain(vm.accessibilityPanelLabel);
  });

  it('the snapped subject is the latest move (the readout still describes a real node)', () => {
    const nodes = [
      fakeNode({ messageId: 'm1', ordinal: 1 }),
      fakeNode({ messageId: 'm3', ordinal: 3, isActive: true, isLatest: true }),
    ];
    const vm = buildTimelineSelectedReadoutViewModel({
      sidecar: fakeSidecar('m3'),
      timelineMap: fakeTimelineMap(nodes),
      selectedMessageId: 'm3',
      status: 'stale_fallback',
    });
    expect(vm.selectedMessageId).toBe('m3');
    expect(vm.isEmpty).toBe(false);
  });
});

// ── 2. Non-stale statuses never carry the banner ──────────────

describe('IX-004 — non-stale statuses leave staleNotice null', () => {
  const NON_STALE: ReadoutSelectionStatus[] = ['explicit', 'entry_hint', 'default_latest'];
  it.each(NON_STALE)('status %s → staleNotice is null', (status) => {
    const vm = buildTimelineSelectedReadoutViewModel({
      sidecar: fakeSidecar('m1'),
      timelineMap: fakeTimelineMap([fakeNode({ messageId: 'm1', isActive: true })]),
      selectedMessageId: 'm1',
      status,
    });
    expect(vm.staleNotice).toBeNull();
    expect(vm.accessibilitySelectionAnnouncement).toBe(vm.accessibilityPanelLabel);
  });
});

// ── 3. Stale + now-empty room → empty state, no banner ────────

describe('IX-004 — stale snap into a now-empty room', () => {
  it('falls through to the empty state with no stale banner and no crash', () => {
    let vm: ReturnType<typeof buildTimelineSelectedReadoutViewModel> | undefined;
    expect(() => {
      vm = buildTimelineSelectedReadoutViewModel({
        sidecar: fakeSidecar(null),
        timelineMap: fakeTimelineMap([]),
        selectedMessageId: null,
        status: 'stale_fallback',
      });
    }).not.toThrow();
    expect(vm!.isEmpty).toBe(true);
    // An empty room shows the empty hint, NOT the stale banner.
    expect(vm!.staleNotice).toBeNull();
  });
});

// ── 4. Source scan: stale-snap sets the status; explicit resets ─

describe('IX-004 — ArgumentGameSurface stale-snap wiring', () => {
  it('the stale-snap effect sets selectionStatus to stale_fallback when the active message vanishes', () => {
    // The effect snaps to latest then marks the snap as a stale fallback.
    expect(GAME_SURFACE_SRC).toMatch(
      /!sorted\.find\(\(m\) => m\.id === activeMessageId\)\) \{[\s\S]*?setActiveMessageId\(latestId\);[\s\S]*?setSelectionStatus\('stale_fallback'\);/,
    );
  });

  it('selectionStatus initialises from the entry hint (entry_hint else default_latest)', () => {
    expect(GAME_SURFACE_SRC).toMatch(
      /useState<ReadoutSelectionStatus>\(\s*entryHint \? 'entry_hint' : 'default_latest',?\s*\)/,
    );
  });

  it('every explicit selection callback resets the status so the banner does not latch', () => {
    // handleActivate / handlePrev / handleNext + the jump closures all
    // set selectionStatus to 'explicit'. Count the explicit resets — at
    // least the three handlers plus the two jump closures.
    const explicitResets = GAME_SURFACE_SRC.match(/setSelectionStatus\('explicit'\)/g) ?? [];
    expect(explicitResets.length).toBeGreaterThanOrEqual(5);
  });

  it('stale_fallback is set in exactly one place — the vanished-message snap', () => {
    const staleSets = GAME_SURFACE_SRC.match(/setSelectionStatus\('stale_fallback'\)/g) ?? [];
    expect(staleSets.length).toBe(1);
  });
});
