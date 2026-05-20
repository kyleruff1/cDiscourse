/**
 * IX-004 — readout ban-list: no verdict / person-label copy, no
 * snake_case leakage in any rendered string.
 *
 * cdiscourse-doctrine §1/§2/§9: the readout renders standing/heat/tone
 * BANDS (sourced from SC-003) in non-verdict language; it must never
 * label a person or claim, and it must never echo an internal code.
 * IX-004 authors only three new strings — `replyCountLabel`,
 * `actingOnShortLabel`, the stale banner — plus the panel a11y labels.
 *
 * This file scans:
 *
 *   1. Every string IX-004's model produces (replyCountLabel,
 *      actingOnShortLabel, staleNotice, accessibilityPanelLabel,
 *      accessibilitySelectionAnnouncement, TIMELINE_READOUT_COPY) for the
 *      banned verdict / person-label set.
 *   2. The same strings for snake_case (no `[a-z]+_[a-z]+`).
 *   3. The model + panel SOURCE for hard-coded `<Text>` literal copy
 *      carrying a banned token or snake_case.
 *
 * Heat / reply-count specifically: a high reply count must not read as
 * "winning". `replyCountLabel` is asserted to be a plain count only.
 */
import fs from 'fs';
import path from 'path';

import {
  buildTimelineSelectedReadoutViewModel,
  buildReplyCountLabel,
  buildActingOnShortLabel,
  TIMELINE_READOUT_COPY,
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

// ── Banned vocab ──────────────────────────────────────────────

const BANNED_VERDICT_PERSON: ReadonlyArray<string> = [
  'winner', 'loser', 'won', 'lost', 'defeated',
  'correct', 'incorrect', 'right', 'wrong',
  'true', 'false', 'proof', 'proven', 'verdict',
  'liar', 'dishonest', 'bad faith', 'manipulative',
  'extremist', 'propagandist', 'troll', 'astroturfer',
  'stupid', 'idiot',
];

/** Word-boundary check so "wrong" doesn't false-match inside another word. */
function containsBanned(s: string): string | null {
  const lower = s.toLowerCase();
  for (const token of BANNED_VERDICT_PERSON) {
    const re = new RegExp(`\\b${token.replace(/ /g, '\\s')}\\b`);
    if (re.test(lower)) return token;
  }
  return null;
}

const SNAKE_CASE = /[a-z]{2,}_[a-z]{2,}/;

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

function fakeSidecar(rootLabel: string): SidecarViewModel {
  return {
    isEmpty: false,
    selectedMessageId: 'm1',
    viewMode: 'timeline',
    sections: [],
    // The SC-003 root label is already doctrine-clean — we use a
    // realistic plain-language band summary here.
    accessibilityRootLabel: rootLabel,
    emptyStateMessage: 'Pick a message on the timeline to see details.',
  };
}

/** Collect every IX-004-authored string from a built view model. */
function readoutStrings(
  vm: ReturnType<typeof buildTimelineSelectedReadoutViewModel>,
): string[] {
  return [
    vm.replyCountLabel,
    vm.actingOnShortLabel,
    vm.staleNotice ?? '',
    vm.accessibilityPanelLabel,
    vm.accessibilitySelectionAnnouncement,
  ].filter((s) => s.length > 0);
}

// ── 1. Frozen copy constants ──────────────────────────────────

describe('IX-004 — TIMELINE_READOUT_COPY carries no verdict / person token', () => {
  it.each(Object.entries(TIMELINE_READOUT_COPY))('%s is doctrine-clean', (_key, value) => {
    expect(containsBanned(value)).toBeNull();
    expect(SNAKE_CASE.test(value)).toBe(false);
  });
});

// ── 2. Reply-count labels — counts, never verdicts ────────────

describe('IX-004 — replyCountLabel is a plain count, never a verdict', () => {
  it.each([0, 1, 2, 3, 12, 99])('count %i → no verdict word, no snake_case', (n) => {
    const label = buildReplyCountLabel(n);
    expect(containsBanned(label)).toBeNull();
    expect(SNAKE_CASE.test(label)).toBe(false);
  });

  it('a high reply count does not read as "winning" — copy is purely numeric', () => {
    const label = buildReplyCountLabel(50);
    expect(label).toBe('50 direct replies');
    // No "popular", "important", "trending", "winning" framing.
    for (const framing of ['popular', 'important', 'trending', 'winning', 'leading']) {
      expect(label.toLowerCase()).not.toContain(framing);
    }
  });
});

// ── 3. actingOnShortLabel ─────────────────────────────────────

describe('IX-004 — actingOnShortLabel carries no verdict / person token', () => {
  it.each(['Claim', 'Challenge', 'Evidence', 'Source request', 'Narrowed', 'Synthesis'])(
    'kind "%s" → clean dock label',
    (kind) => {
      const label = buildActingOnShortLabel(kind, 4);
      expect(containsBanned(label)).toBeNull();
      // The "·" + "#N" form has no snake_case.
      expect(SNAKE_CASE.test(label)).toBe(false);
    },
  );
});

// ── 4. Full view-model strings across statuses ────────────────

describe('IX-004 — every rendered readout string is doctrine-clean', () => {
  const nodes = [
    fakeNode({ messageId: 'm1', ordinal: 1, isActive: true, isRoot: true }),
    fakeNode({ messageId: 'm2', ordinal: 2, parentId: 'm1' }),
    fakeNode({ messageId: 'm3', ordinal: 3, parentId: 'm1' }),
  ];
  const statuses = ['explicit', 'entry_hint', 'default_latest', 'stale_fallback'] as const;

  it.each(statuses)('status %s → no banned token in any rendered string', (status) => {
    const vm = buildTimelineSelectedReadoutViewModel({
      sidecar: fakeSidecar('Challenge from Other side. Message 1 of 3. This point needs a source.'),
      timelineMap: fakeTimelineMap(nodes),
      selectedMessageId: 'm1',
      status,
    });
    for (const s of readoutStrings(vm)) {
      const hit = containsBanned(s);
      expect(hit).toBeNull();
    }
  });

  it.each(statuses)('status %s → no snake_case in any rendered string', (status) => {
    const vm = buildTimelineSelectedReadoutViewModel({
      sidecar: fakeSidecar('Evidence from You. Message 1 of 3.'),
      timelineMap: fakeTimelineMap(nodes),
      selectedMessageId: 'm1',
      status,
    });
    for (const s of readoutStrings(vm)) {
      expect(SNAKE_CASE.test(s)).toBe(false);
    }
  });

  it('the empty-state panel label is doctrine-clean', () => {
    const vm = buildTimelineSelectedReadoutViewModel({
      sidecar: { ...fakeSidecar(''), isEmpty: true, selectedMessageId: null },
      timelineMap: fakeTimelineMap([]),
      selectedMessageId: null,
      status: 'default_latest',
    });
    expect(containsBanned(vm.accessibilityPanelLabel)).toBeNull();
    expect(SNAKE_CASE.test(vm.accessibilityPanelLabel)).toBe(false);
  });
});

// ── 5. Source scan: model + panel hard-coded copy ─────────────

describe('IX-004 — model + panel source carry no banned / snake_case literal copy', () => {
  const MODEL_SRC = fs.readFileSync(
    path.join(process.cwd(), 'src', 'features', 'arguments', 'timelineSelectedReadoutModel.ts'),
    'utf8',
  );
  const PANEL_SRC = fs.readFileSync(
    path.join(process.cwd(), 'src', 'features', 'arguments', 'TimelineSelectedReadoutPanel.tsx'),
    'utf8',
  );

  it('the panel renders no <Text> literal containing a banned token', () => {
    const textChildren = PANEL_SRC.match(/<Text[^>]*>([^<{}]+)<\/Text>/g) ?? [];
    for (const m of textChildren) {
      const inner = m.replace(/^<Text[^>]*>/, '').replace(/<\/Text>$/, '');
      expect(containsBanned(inner)).toBeNull();
    }
  });

  it('the panel renders no <Text> literal containing snake_case', () => {
    const textChildren = PANEL_SRC.match(/<Text[^>]*>([^<{}]+)<\/Text>/g) ?? [];
    for (const m of textChildren) {
      const inner = m.replace(/^<Text[^>]*>/, '').replace(/<\/Text>$/, '');
      expect(SNAKE_CASE.test(inner)).toBe(false);
    }
  });

  it('the model declares no string literal carrying a verdict / person token', () => {
    // Scan single- and double-quoted string literals in the model.
    const literals = MODEL_SRC.match(/(['"])(?:(?!\1).){4,}\1/g) ?? [];
    for (const lit of literals) {
      const inner = lit.slice(1, -1);
      // Skip identifier-style status literals (they are typed unions, not
      // user-facing copy) — those legitimately use snake_case.
      if (/^[a-z_]+$/.test(inner)) continue;
      expect(containsBanned(inner)).toBeNull();
    }
  });
});
