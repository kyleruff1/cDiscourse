/**
 * IX-004 — timelineSelectedReadoutModel: builder happy path + click→subject.
 *
 * The model is pure TypeScript. These tests exercise
 * `buildTimelineSelectedReadoutViewModel` directly (no React renderer):
 *
 *   - Happy path: populated SidecarViewModel + map → correct
 *     selectedMessageId, directReplyCount, replyCountLabel,
 *     actingOnShortLabel.
 *   - Empty room → isEmpty safe shape; no throw.
 *   - Reply-count pluralization: 0 / 1 / N (immediate children only).
 *   - actingOnShortLabel format "<kind> · #<ordinal>".
 *   - "Click → readout subject changes": rebuilding with a new
 *     selectedMessageId changes the subject the panel renders.
 *
 * The component (`TimelineSelectedReadoutPanel`) is a thin presentation
 * layer; its behaviour is fully expressed in this view model and is
 * additionally locked by a source scan in `timelineReadoutNoRoute.test.ts`
 * and `timelineReadoutBanList.test.ts`.
 */
import {
  buildTimelineSelectedReadoutViewModel,
  buildReplyCountLabel,
  buildActingOnShortLabel,
  TIMELINE_READOUT_COPY,
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
  SidecarSection_WhatThisMoveSays,
} from '../src/features/arguments/argumentReplySidecarModel';

// ── Fixtures ──────────────────────────────────────────────────

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
    sideLabel: over.sideLabel ?? 'Aff',
    bodyPreview: over.bodyPreview ?? 'preview body',
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
    x: over.x ?? 0,
    y: over.y ?? 120,
    accessibilityLabel: over.accessibilityLabel ?? 'm1',
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

function fakeWhatSays(
  over: Partial<SidecarSection_WhatThisMoveSays> = {},
): SidecarSection_WhatThisMoveSays {
  return {
    kind: 'what_this_move_says',
    bodyExcerpt: over.bodyExcerpt ?? 'A readable body excerpt for the selected move.',
    isTruncated: over.isTruncated ?? false,
    fullBodyLength: over.fullBodyLength ?? 48,
    createdAtLabel: over.createdAtLabel ?? '2026-05-18 10:00',
    relativeLabel: over.relativeLabel ?? 'now',
    parentHint: over.parentHint ?? null,
    parentBodyPreview: over.parentBodyPreview ?? null,
    actorLabel: over.actorLabel ?? 'You',
    sideLabel: over.sideLabel ?? 'Aff',
    kindLabel: over.kindLabel ?? 'Claim',
    isHidden: over.isHidden ?? false,
    hiddenNotice: over.hiddenNotice ?? null,
    standingLine: over.standingLine ?? 'Standing: neutral',
    toneLine: over.toneLine ?? 'Tone: calm',
    heatLine: over.heatLine ?? 'Heat: cool',
  };
}

function fakeSidecar(over: Partial<SidecarViewModel> = {}): SidecarViewModel {
  const isEmpty = over.isEmpty ?? false;
  return {
    isEmpty,
    selectedMessageId: 'selectedMessageId' in over ? over.selectedMessageId! : (isEmpty ? null : 'm1'),
    viewMode: over.viewMode ?? 'timeline',
    sections: over.sections ?? (isEmpty ? [] : [fakeWhatSays()]),
    accessibilityRootLabel:
      over.accessibilityRootLabel ?? 'Claim from You. Message 1 of 3.',
    emptyStateMessage:
      over.emptyStateMessage ?? 'Pick a message on the timeline to see details.',
  };
}

function emptySidecar(): SidecarViewModel {
  return fakeSidecar({ isEmpty: true, selectedMessageId: null, sections: [] });
}

function buildInput(
  over: Partial<BuildTimelineSelectedReadoutInput> = {},
): BuildTimelineSelectedReadoutInput {
  return {
    sidecar: over.sidecar ?? fakeSidecar(),
    timelineMap: over.timelineMap ?? fakeTimelineMap([fakeNode({ messageId: 'm1', isActive: true })]),
    selectedMessageId: 'selectedMessageId' in over ? over.selectedMessageId! : 'm1',
    status: over.status ?? 'explicit',
  };
}

// ── Helper unit tests ─────────────────────────────────────────

describe('buildReplyCountLabel', () => {
  it('returns the no-replies copy for 0', () => {
    expect(buildReplyCountLabel(0)).toBe('No direct replies yet');
    expect(buildReplyCountLabel(0)).toBe(TIMELINE_READOUT_COPY.NO_REPLIES_LABEL);
  });

  it('returns the singular copy for 1', () => {
    expect(buildReplyCountLabel(1)).toBe('1 direct reply');
  });

  it('returns the plural copy for N > 1', () => {
    expect(buildReplyCountLabel(2)).toBe('2 direct replies');
    expect(buildReplyCountLabel(7)).toBe('7 direct replies');
  });

  it('treats negative / NaN as 0', () => {
    expect(buildReplyCountLabel(-3)).toBe('No direct replies yet');
    expect(buildReplyCountLabel(Number.NaN)).toBe('No direct replies yet');
  });
});

describe('buildActingOnShortLabel', () => {
  it('formats "<kind> · #<ordinal>"', () => {
    expect(buildActingOnShortLabel('Challenge', 4)).toBe('Challenge · #4');
    expect(buildActingOnShortLabel('Claim', 1)).toBe('Claim · #1');
  });

  it('returns empty string when kind or ordinal is missing', () => {
    expect(buildActingOnShortLabel('', 4)).toBe('');
    expect(buildActingOnShortLabel('Claim', null)).toBe('');
    expect(buildActingOnShortLabel(null, null)).toBe('');
  });

  it('stays within the 48-char dock budget for realistic labels', () => {
    expect(buildActingOnShortLabel('Source request', 120).length).toBeLessThanOrEqual(48);
  });
});

// ── Builder: happy path ───────────────────────────────────────

describe('buildTimelineSelectedReadoutViewModel — happy path', () => {
  it('projects selectedMessageId, directReplyCount and labels from the inputs', () => {
    const nodes = [
      fakeNode({ messageId: 'm1', ordinal: 1, isRoot: true }),
      fakeNode({ messageId: 'm2', ordinal: 2, parentId: 'm1', isActive: true, kindLabel: 'Challenge' }),
      fakeNode({ messageId: 'm3', ordinal: 3, parentId: 'm2' }),
    ];
    const vm = buildTimelineSelectedReadoutViewModel(
      buildInput({
        timelineMap: fakeTimelineMap(nodes),
        sidecar: fakeSidecar({ selectedMessageId: 'm2' }),
        selectedMessageId: 'm2',
        status: 'explicit',
      }),
    );
    expect(vm.isEmpty).toBe(false);
    expect(vm.selectedMessageId).toBe('m2');
    expect(vm.status).toBe('explicit');
    expect(vm.directReplyCount).toBe(1); // only m3 has parentId === m2
    expect(vm.replyCountLabel).toBe('1 direct reply');
    expect(vm.actingOnShortLabel).toBe('Challenge · #2');
    expect(vm.staleNotice).toBeNull();
  });

  it('reuses the SC-003 sidecar view-model verbatim (does not rebuild it)', () => {
    const sidecar = fakeSidecar({ selectedMessageId: 'm1' });
    const vm = buildTimelineSelectedReadoutViewModel(buildInput({ sidecar }));
    expect(vm.sidecar).toBe(sidecar);
  });

  it('builds the panel a11y label from the sidecar root label + reply count', () => {
    const vm = buildTimelineSelectedReadoutViewModel(
      buildInput({
        sidecar: fakeSidecar({
          selectedMessageId: 'm1',
          accessibilityRootLabel: 'Claim from You. Message 1 of 3.',
        }),
      }),
    );
    expect(vm.accessibilityPanelLabel).toContain('Claim from You. Message 1 of 3.');
    expect(vm.accessibilityPanelLabel).toContain('No direct replies yet');
  });

  it('is deterministic — same inputs produce an equal view model', () => {
    const input = buildInput();
    const a = buildTimelineSelectedReadoutViewModel(input);
    const b = buildTimelineSelectedReadoutViewModel(input);
    expect(a).toEqual(b);
  });
});

// ── Reply-count pluralization (immediate children only) ───────

describe('buildTimelineSelectedReadoutViewModel — direct reply count semantics', () => {
  it('counts 0 direct replies when the node is a leaf', () => {
    const nodes = [
      fakeNode({ messageId: 'm1', isActive: true }),
      fakeNode({ messageId: 'm2', parentId: 'm1' }),
    ];
    const vm = buildTimelineSelectedReadoutViewModel(
      buildInput({
        timelineMap: fakeTimelineMap(nodes),
        sidecar: fakeSidecar({ selectedMessageId: 'm2' }),
        selectedMessageId: 'm2',
      }),
    );
    expect(vm.directReplyCount).toBe(0);
    expect(vm.replyCountLabel).toBe('No direct replies yet');
  });

  it('counts only IMMEDIATE children, never deep descendants (3-level tree)', () => {
    // m1 → m2 → m3 → m4 ; m1 → m5. m1 has exactly TWO direct children
    // (m2, m5); m3 + m4 are descendants but not direct replies.
    const nodes = [
      fakeNode({ messageId: 'm1', ordinal: 1, isActive: true }),
      fakeNode({ messageId: 'm2', ordinal: 2, parentId: 'm1' }),
      fakeNode({ messageId: 'm3', ordinal: 3, parentId: 'm2' }),
      fakeNode({ messageId: 'm4', ordinal: 4, parentId: 'm3' }),
      fakeNode({ messageId: 'm5', ordinal: 5, parentId: 'm1' }),
    ];
    const vm = buildTimelineSelectedReadoutViewModel(
      buildInput({
        timelineMap: fakeTimelineMap(nodes),
        sidecar: fakeSidecar({ selectedMessageId: 'm1' }),
        selectedMessageId: 'm1',
      }),
    );
    expect(vm.directReplyCount).toBe(2);
    expect(vm.replyCountLabel).toBe('2 direct replies');
  });

  it('a junction node with > 1 direct child pluralizes correctly', () => {
    const nodes = [
      fakeNode({ messageId: 'm1', isActive: true, isJunction: true, junctionChildCount: 3 }),
      fakeNode({ messageId: 'm2', parentId: 'm1' }),
      fakeNode({ messageId: 'm3', parentId: 'm1' }),
      fakeNode({ messageId: 'm4', parentId: 'm1' }),
    ];
    const vm = buildTimelineSelectedReadoutViewModel(
      buildInput({
        timelineMap: fakeTimelineMap(nodes),
        sidecar: fakeSidecar({ selectedMessageId: 'm1' }),
        selectedMessageId: 'm1',
      }),
    );
    expect(vm.directReplyCount).toBe(3);
    expect(vm.replyCountLabel).toBe('3 direct replies');
  });
});

// ── Empty room ────────────────────────────────────────────────

describe('buildTimelineSelectedReadoutViewModel — empty room', () => {
  it('returns the isEmpty safe shape when the map has zero nodes', () => {
    const vm = buildTimelineSelectedReadoutViewModel({
      sidecar: emptySidecar(),
      timelineMap: fakeTimelineMap([]),
      selectedMessageId: null,
      status: 'default_latest',
    });
    expect(vm.isEmpty).toBe(true);
    expect(vm.selectedMessageId).toBeNull();
    expect(vm.staleNotice).toBeNull();
    expect(vm.directReplyCount).toBe(0);
    expect(vm.replyCountLabel).toBe('No direct replies yet');
    expect(vm.actingOnShortLabel).toBe('');
  });

  it('returns the isEmpty shape when the sidecar itself is empty', () => {
    const vm = buildTimelineSelectedReadoutViewModel({
      sidecar: emptySidecar(),
      timelineMap: fakeTimelineMap([fakeNode({ messageId: 'm1' })]),
      selectedMessageId: 'm1',
      status: 'default_latest',
    });
    expect(vm.isEmpty).toBe(true);
  });

  it('does not throw on a null selectedMessageId with a populated map', () => {
    expect(() =>
      buildTimelineSelectedReadoutViewModel(
        buildInput({
          sidecar: emptySidecar(),
          selectedMessageId: null,
        }),
      ),
    ).not.toThrow();
  });
});

// ── Click → readout subject changes ───────────────────────────

describe('buildTimelineSelectedReadoutViewModel — click changes the subject', () => {
  it('rebuilding with a different selectedMessageId changes the readout subject', () => {
    const nodes = [
      fakeNode({ messageId: 'm1', ordinal: 1, kindLabel: 'Claim' }),
      fakeNode({ messageId: 'm2', ordinal: 2, parentId: 'm1', kindLabel: 'Challenge' }),
    ];
    const map = fakeTimelineMap(nodes);

    const first = buildTimelineSelectedReadoutViewModel(
      buildInput({
        timelineMap: map,
        sidecar: fakeSidecar({
          selectedMessageId: 'm1',
          accessibilityRootLabel: 'Claim from You. Message 1 of 2.',
        }),
        selectedMessageId: 'm1',
      }),
    );
    // Simulates a node click selecting m2 — the room shell rebuilds the
    // sidecar + readout view-model with the new subject.
    const second = buildTimelineSelectedReadoutViewModel(
      buildInput({
        timelineMap: map,
        sidecar: fakeSidecar({
          selectedMessageId: 'm2',
          accessibilityRootLabel: 'Challenge from Other side. Message 2 of 2.',
        }),
        selectedMessageId: 'm2',
      }),
    );

    expect(first.selectedMessageId).toBe('m1');
    expect(first.actingOnShortLabel).toBe('Claim · #1');
    expect(second.selectedMessageId).toBe('m2');
    expect(second.actingOnShortLabel).toBe('Challenge · #2');
    expect(second.accessibilityPanelLabel).not.toBe(first.accessibilityPanelLabel);
  });
});
