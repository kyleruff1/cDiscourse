/**
 * IX-003 — Pure-model tests for the keyboard navigation + accessibility
 * label model. No React, no renderer — the traversal resolver and the
 * label builder are exercised directly with tiny fixtures.
 */
import {
  buildNodeAccessibilityLabel,
  deriveBranchLabel,
  isTimelineNavKey,
  resolveTimelineNavEffect,
  TIMELINE_NAV_KEYS,
  type NodeAccessibilityInput,
  type TimelineNavInput,
} from '../src/features/arguments/keyboardNavigationModel';
import type {
  ArgumentTimelineMapModel,
  ArgumentTimelineMapNode,
  TimelineStandingBand,
} from '../src/features/arguments/argumentGameSurfaceModel';
import { STANDING_BAND_SOFT_LABEL } from '../src/features/arguments/standingBandCopy';

// ── Fixtures ────────────────────────────────────────────────────

/** Minimal node — only the fields `resolveTimelineNavEffect` reads. */
function node(id: string, over: Partial<ArgumentTimelineMapNode> = {}): ArgumentTimelineMapNode {
  return {
    messageId: id,
    parentId: null,
    ordinal: 1,
    createdAt: '2026-05-19T00:00:00.000Z',
    createdAtLabel: 'May 19',
    relativeLabel: '1m ago',
    actorLabel: 'Participant',
    kindLabel: 'claim',
    sideLabel: 'Aff',
    bodyPreview: 'body',
    badges: [],
    droppedTags: [],
    depth: 0,
    lane: 0,
    siblingIndex: 0,
    replyCount: 0,
    descendantCount: 0,
    branchId: 'branch-root',
    branchRootMessageId: id,
    junctionGroupId: null,
    isJunction: false,
    junctionChildCount: 0,
    isActive: false,
    isLatest: false,
    isDetached: false,
    isActivePath: false,
    isRoot: false,
    isFirstRebuttal: false,
    standingBand: 'neutral',
    toneBand: 'calm',
    temperatureBand: 'cool',
    kindColor: '#000000',
    kindColorFamily: 'claim',
    x: 0,
    y: 0,
    accessibilityLabel: '',
    ...over,
  };
}

/** Build a timeline map with `n` ordered nodes; ids are 'm1'..'mN'. */
function mkMap(ids: string[]): ArgumentTimelineMapModel {
  const nodes = ids.map((id, idx) =>
    node(id, { ordinal: idx + 1, isRoot: idx === 0, isLatest: idx === ids.length - 1 }),
  );
  return {
    nodes,
    edges: [],
    bands: [],
    activeNode: null,
    latestMessageId: ids.length ? ids[ids.length - 1] : null,
    activePathIds: [],
    width: 800,
    height: 240,
    scrollWidth: 800,
    beginningLabel: 'start',
    middleLabel: 'mid',
    endLabel: 'end',
    participantTrends: [],
    legend: [],
    rootMessageId: ids.length ? ids[0] : null,
    firstRebuttalMessageId: ids.length > 1 ? ids[1] : null,
    hasRebuttal: ids.length > 1,
    rootOnboardingHint: null,
    showBackToRootControl: false,
  };
}

function navInput(over: Partial<TimelineNavInput> & { key: string }): TimelineNavInput {
  return {
    key: over.key,
    activeMessageId: over.activeMessageId ?? null,
    map: over.map ?? mkMap(['m1', 'm2', 'm3', 'm4', 'm5']),
    hasOpenOverlay: over.hasOpenOverlay ?? false,
  };
}

// ── resolveTimelineNavEffect — traversal ────────────────────────

describe('resolveTimelineNavEffect — arrow traversal', () => {
  it('ArrowRight from mid-timeline activates the next node', () => {
    const effect = resolveTimelineNavEffect(navInput({ key: 'ArrowRight', activeMessageId: 'm3' }));
    expect(effect).toEqual({ type: 'activate', messageId: 'm4' });
  });

  it('ArrowLeft from mid-timeline activates the previous node', () => {
    const effect = resolveTimelineNavEffect(navInput({ key: 'ArrowLeft', activeMessageId: 'm3' }));
    expect(effect).toEqual({ type: 'activate', messageId: 'm2' });
  });

  it('ArrowRight on the last node returns none (no wrap)', () => {
    const effect = resolveTimelineNavEffect(navInput({ key: 'ArrowRight', activeMessageId: 'm5' }));
    expect(effect).toEqual({ type: 'none' });
  });

  it('ArrowLeft on the first node returns none (no wrap)', () => {
    const effect = resolveTimelineNavEffect(navInput({ key: 'ArrowLeft', activeMessageId: 'm1' }));
    expect(effect).toEqual({ type: 'none' });
  });

  it('repeated ArrowRight stops at the latest node and stays there', () => {
    const map = mkMap(['m1', 'm2', 'm3']);
    let active = 'm1';
    for (let i = 0; i < 6; i++) {
      const effect = resolveTimelineNavEffect(navInput({ key: 'ArrowRight', activeMessageId: active, map }));
      if (effect.type === 'activate') active = effect.messageId;
    }
    expect(active).toBe('m3');
  });
});

// ── resolveTimelineNavEffect — Home / End ───────────────────────

describe('resolveTimelineNavEffect — Home / End', () => {
  it('Home activates the root message', () => {
    const effect = resolveTimelineNavEffect(navInput({ key: 'Home', activeMessageId: 'm4' }));
    expect(effect).toEqual({ type: 'activate', messageId: 'm1' });
  });

  it('Home when root is already active returns none', () => {
    const effect = resolveTimelineNavEffect(navInput({ key: 'Home', activeMessageId: 'm1' }));
    expect(effect).toEqual({ type: 'none' });
  });

  it('End activates the latest message', () => {
    const effect = resolveTimelineNavEffect(navInput({ key: 'End', activeMessageId: 'm2' }));
    expect(effect).toEqual({ type: 'activate', messageId: 'm5' });
  });

  it('End when latest is already active returns none', () => {
    const effect = resolveTimelineNavEffect(navInput({ key: 'End', activeMessageId: 'm5' }));
    expect(effect).toEqual({ type: 'none' });
  });
});

// ── resolveTimelineNavEffect — no active node (cold start) ───────

describe('resolveTimelineNavEffect — cold start (no active node)', () => {
  it('ArrowLeft with no active node activates the root', () => {
    const effect = resolveTimelineNavEffect(navInput({ key: 'ArrowLeft', activeMessageId: null }));
    expect(effect).toEqual({ type: 'activate', messageId: 'm1' });
  });

  it('ArrowRight with no active node activates the latest', () => {
    const effect = resolveTimelineNavEffect(navInput({ key: 'ArrowRight', activeMessageId: null }));
    expect(effect).toEqual({ type: 'activate', messageId: 'm5' });
  });

  it('Home with no active node activates the root', () => {
    const effect = resolveTimelineNavEffect(navInput({ key: 'Home', activeMessageId: null }));
    expect(effect).toEqual({ type: 'activate', messageId: 'm1' });
  });

  it('End with no active node activates the latest', () => {
    const effect = resolveTimelineNavEffect(navInput({ key: 'End', activeMessageId: null }));
    expect(effect).toEqual({ type: 'activate', messageId: 'm5' });
  });
});

// ── resolveTimelineNavEffect — Enter / Space ────────────────────

describe('resolveTimelineNavEffect — Enter / Space open detail', () => {
  it('Enter on the active node returns open_detail', () => {
    const effect = resolveTimelineNavEffect(navInput({ key: 'Enter', activeMessageId: 'm2' }));
    expect(effect).toEqual({ type: 'open_detail', messageId: 'm2' });
  });

  it('Enter with no active node returns none', () => {
    const effect = resolveTimelineNavEffect(navInput({ key: 'Enter', activeMessageId: null }));
    expect(effect).toEqual({ type: 'none' });
  });

  it("Space (' ') returns open_detail for the active node", () => {
    const effect = resolveTimelineNavEffect(navInput({ key: ' ', activeMessageId: 'm3' }));
    expect(effect).toEqual({ type: 'open_detail', messageId: 'm3' });
  });

  it("legacy 'Spacebar' string also returns open_detail", () => {
    const effect = resolveTimelineNavEffect(navInput({ key: 'Spacebar', activeMessageId: 'm3' }));
    expect(effect).toEqual({ type: 'open_detail', messageId: 'm3' });
  });
});

// ── resolveTimelineNavEffect — Escape ───────────────────────────

describe('resolveTimelineNavEffect — Escape', () => {
  it('Escape with an open overlay returns close_overlay', () => {
    const effect = resolveTimelineNavEffect(navInput({ key: 'Escape', hasOpenOverlay: true }));
    expect(effect).toEqual({ type: 'close_overlay' });
  });

  it('Escape with nothing open returns none', () => {
    const effect = resolveTimelineNavEffect(navInput({ key: 'Escape', hasOpenOverlay: false }));
    expect(effect).toEqual({ type: 'none' });
  });
});

// ── resolveTimelineNavEffect — unhandled keys + edge cases ───────

describe('resolveTimelineNavEffect — unhandled keys + edge cases', () => {
  it.each(['a', 'Tab', 'PageDown', 'ArrowUp', 'ArrowDown', 'Shift'])(
    'returns none for unhandled key %s',
    (key) => {
      expect(resolveTimelineNavEffect(navInput({ key, activeMessageId: 'm3' }))).toEqual({
        type: 'none',
      });
    },
  );

  it('returns none for every key on an empty map (no throw)', () => {
    const empty = mkMap([]);
    for (const key of TIMELINE_NAV_KEYS) {
      expect(
        resolveTimelineNavEffect({ key, activeMessageId: null, map: empty, hasOpenOverlay: true }),
      ).toEqual({ type: 'none' });
    }
  });

  it('single-node map — arrows + Home + End all return none', () => {
    const solo = mkMap(['only']);
    for (const key of ['ArrowLeft', 'ArrowRight', 'Home', 'End']) {
      expect(
        resolveTimelineNavEffect(navInput({ key, activeMessageId: 'only', map: solo })),
      ).toEqual({ type: 'none' });
    }
  });

  it('single-node map — Enter returns open_detail for the lone node', () => {
    const solo = mkMap(['only']);
    expect(
      resolveTimelineNavEffect(navInput({ key: 'Enter', activeMessageId: 'only', map: solo })),
    ).toEqual({ type: 'open_detail', messageId: 'only' });
  });

  it('detached node active — arrows still walk chronological order', () => {
    const map = mkMap(['m1', 'm2', 'm3']);
    map.nodes[1].isDetached = true; // m2 detached but still in node order
    expect(
      resolveTimelineNavEffect(navInput({ key: 'ArrowLeft', activeMessageId: 'm2', map })),
    ).toEqual({ type: 'activate', messageId: 'm1' });
    expect(
      resolveTimelineNavEffect(navInput({ key: 'ArrowRight', activeMessageId: 'm2', map })),
    ).toEqual({ type: 'activate', messageId: 'm3' });
  });

  it('does not mutate its input map', () => {
    const map = mkMap(['m1', 'm2', 'm3']);
    const before = JSON.stringify(map);
    resolveTimelineNavEffect(navInput({ key: 'ArrowRight', activeMessageId: 'm1', map }));
    resolveTimelineNavEffect(navInput({ key: 'Home', activeMessageId: 'm3', map }));
    resolveTimelineNavEffect(navInput({ key: 'Escape', hasOpenOverlay: true, map }));
    expect(JSON.stringify(map)).toBe(before);
  });
});

// ── isTimelineNavKey ────────────────────────────────────────────

describe('isTimelineNavKey', () => {
  it('is true for every bound key string', () => {
    for (const key of TIMELINE_NAV_KEYS) {
      expect(isTimelineNavKey(key)).toBe(true);
    }
  });

  it('is false for unbound keys', () => {
    for (const key of ['a', 'Tab', 'PageDown', 'ArrowUp', 'ArrowDown', '', 'enter']) {
      expect(isTimelineNavKey(key)).toBe(false);
    }
  });
});

// ── deriveBranchLabel ───────────────────────────────────────────

describe('deriveBranchLabel', () => {
  it('lane 0 → "on the main line"', () => {
    expect(deriveBranchLabel({ lane: 0, isDetached: false })).toBe('on the main line');
  });

  it('positive lane → "on a side branch"', () => {
    expect(deriveBranchLabel({ lane: 2, isDetached: false })).toBe('on a side branch');
  });

  it('negative lane → "on a side branch"', () => {
    expect(deriveBranchLabel({ lane: -1, isDetached: false })).toBe('on a side branch');
  });

  it('detached → "detached from the main thread" (wins over lane)', () => {
    expect(deriveBranchLabel({ lane: 0, isDetached: true })).toBe(
      'detached from the main thread',
    );
  });
});

// ── buildNodeAccessibilityLabel ─────────────────────────────────

function labelInput(over: Partial<NodeAccessibilityInput> = {}): NodeAccessibilityInput {
  return {
    ordinal: 4,
    totalNodes: 12,
    kindLabel: 'rebuttal',
    sideLabel: 'Aff',
    standingBand: 'pretty_right',
    branchLabel: 'on a side branch',
    isActive: true,
    isLatest: false,
    isRoot: false,
    isDetached: false,
    isJunction: false,
    junctionChildCount: 0,
    relativeOrAbsoluteTime: '8m ago',
    ...over,
  };
}

describe('buildNodeAccessibilityLabel', () => {
  it('builds the full happy-path label in order', () => {
    const label = buildNodeAccessibilityLabel(labelInput());
    expect(label).toBe(
      'rebuttal on side Aff, position 4 of 12, Well supported, on a side branch, ' +
        'currently active, posted 8m ago',
    );
  });

  it('omits the side fragment when sideLabel is "—"', () => {
    const label = buildNodeAccessibilityLabel(labelInput({ sideLabel: '—' }));
    expect(label).toMatch(/^rebuttal, position 4 of 12/);
    expect(label).not.toContain('on side');
  });

  it('includes "opening claim" for a root node', () => {
    const label = buildNodeAccessibilityLabel(labelInput({ isRoot: true }));
    expect(label).toContain('opening claim');
  });

  it('includes "latest move" for the latest node', () => {
    const label = buildNodeAccessibilityLabel(labelInput({ isLatest: true }));
    expect(label).toContain('latest move');
  });

  it('includes the junction fragment with the reply count', () => {
    const label = buildNodeAccessibilityLabel(
      labelInput({ isJunction: true, junctionChildCount: 3 }),
    );
    expect(label).toContain('junction with 3 replies');
  });

  it('includes the detached fragment for a detached node (no crash)', () => {
    const label = buildNodeAccessibilityLabel(
      labelInput({ isDetached: true, branchLabel: 'detached from the main thread' }),
    );
    expect(label).toContain('detached from the main thread');
    expect(label).toContain('detached — parent unavailable');
  });

  it('omits the time fragment when relativeOrAbsoluteTime is empty', () => {
    const label = buildNodeAccessibilityLabel(labelInput({ relativeOrAbsoluteTime: '' }));
    expect(label).not.toContain('posted');
  });

  const ALL_BANDS: TimelineStandingBand[] = [
    'pretty_wrong',
    'slightly_wrong',
    'neutral',
    'slightly_right',
    'maybe_right_misguided',
    'pretty_right',
    'completely_right',
    'unscored',
    'not_enough_signal',
  ];

  it.each(ALL_BANDS)('strength fragment for band %s is the soft label', (band) => {
    const label = buildNodeAccessibilityLabel(labelInput({ standingBand: band }));
    expect(label).toContain(STANDING_BAND_SOFT_LABEL[band]);
  });

  // Doctrine ban-list: strength must read as gameplay standing, never a
  // verdict. STANDING_BAND_SOFT_LABEL is verdict-clean by construction;
  // this locks the assembled label too.
  const BANNED = [
    'winner',
    'loser',
    'correct',
    'incorrect',
    'true',
    'false',
    'liar',
    'dishonest',
    'bad faith',
    'winning',
  ];

  it.each(ALL_BANDS)('label for band %s contains no verdict token', (band) => {
    const label = buildNodeAccessibilityLabel(
      labelInput({ standingBand: band, isRoot: true, isLatest: true, isJunction: true }),
    ).toLowerCase();
    for (const token of BANNED) {
      expect(label).not.toContain(token);
    }
  });
});
