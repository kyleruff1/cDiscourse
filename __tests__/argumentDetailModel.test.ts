/**
 * CARD-VIEW-DETAIL-HUB-001 (Slice 2) — shared argumentDetailModel tests.
 *
 * Covers the new Slice-2 shared builders:
 *   - parent-quote slice (ask i): present / 120-truncation / soft-deleted
 *     degrade (neutral placeholder, no reason leak) / out-of-slice
 *   - Standing / Tone / Heat strip (ask v): plain-language mapping (no raw
 *     band tokens), verdict-token ban-list clean, caption framing
 *   - band-formatter plain-language (the intended Timeline copy improvement)
 *   - determinism + non-mutation
 *   - verdict-token ban-list + snake_case ban over every shared output string
 *
 * Pure-model test. No React, no Supabase.
 */

import {
  buildParentQuoteSlice,
  buildStandingToneHeatStrip,
  formatHeatLine,
  formatStandingLine,
  formatToneLine,
  HEAT_BAND_PLAIN_LABEL,
  PARENT_BODY_PREVIEW_CAP,
  PARENT_QUOTE_UNAVAILABLE,
  standingBandPlainLabel,
  STANDING_TONE_HEAT_CAPTION,
  TONE_BAND_PLAIN_LABEL,
} from '../src/features/arguments/detail/argumentDetailModel';
import { STANDING_BAND_SOFT_LABEL } from '../src/features/arguments/standingBandCopy';
import type {
  ArgumentBubbleViewModel,
  ArgumentTimelineMapNode,
  TimelineKindColorFamily,
  TimelineStandingBand,
  TimelineTemperatureBand,
  TimelineToneBand,
} from '../src/features/arguments/argumentGameSurfaceModel';

const VERDICT_BAN = [
  'winner',
  'loser',
  ' true ',
  ' false ',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'correct',
  'incorrect',
];

function fakeNode(over: Partial<ArgumentTimelineMapNode> = {}): ArgumentTimelineMapNode {
  return {
    messageId: over.messageId ?? 'm1',
    parentId: over.parentId ?? null,
    ordinal: over.ordinal ?? 1,
    createdAt: over.createdAt ?? '2026-05-18T10:00:00.000Z',
    createdAtLabel: over.createdAtLabel ?? '2026-05-18 10:00',
    relativeLabel: over.relativeLabel ?? 'now',
    actorLabel: over.actorLabel ?? 'You',
    kindLabel: over.kindLabel ?? 'claim',
    sideLabel: over.sideLabel ?? 'Aff',
    bodyPreview: over.bodyPreview ?? 'parent preview body',
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
    isActive: over.isActive ?? true,
    isLatest: over.isLatest ?? true,
    isDetached: over.isDetached ?? false,
    isActivePath: over.isActivePath ?? true,
    isRoot: over.isRoot ?? true,
    isFirstRebuttal: over.isFirstRebuttal ?? false,
    standingBand: (over.standingBand ?? 'pretty_right') as TimelineStandingBand,
    toneBand: (over.toneBand ?? 'measured') as TimelineToneBand,
    temperatureBand: (over.temperatureBand ?? 'warm') as TimelineTemperatureBand,
    kindColor: over.kindColor ?? '#22c55e',
    kindColorFamily: (over.kindColorFamily ?? 'claim') as TimelineKindColorFamily,
    x: over.x ?? 0,
    y: over.y ?? 0,
    accessibilityLabel: over.accessibilityLabel ?? 'm1',
  };
}

function fakeViewModel(over: Partial<ArgumentBubbleViewModel> = {}): ArgumentBubbleViewModel {
  return {
    messageId: over.messageId ?? 'm1',
    ordinal: over.ordinal ?? 1,
    createdAtLabel: over.createdAtLabel ?? '2026-05-18 10:00',
    relativeLabel: over.relativeLabel ?? 'now',
    body: over.body ?? 'The body of the active move.',
    kindLabel: over.kindLabel ?? 'claim',
    actor: over.actor ?? 'self',
    sideLabel: over.sideLabel ?? 'Aff',
    isLatest: over.isLatest ?? true,
    isActive: over.isActive ?? true,
    parentHint: over.parentHint ?? null,
    qualifierBadges: over.qualifierBadges ?? [],
    pointStandingHint: over.pointStandingHint ?? null,
    allowedControls: over.allowedControls ?? ['view_qualifiers', 'request_deletion'],
    deletionRequested: over.deletionRequested ?? false,
  };
}

// ── ask i — parent quote ──────────────────────────────────────────────

describe('CVDH-001 Slice 2 — buildParentQuoteSlice (ask i)', () => {
  it('present: surfaces the trimmed parent body as the quote', () => {
    const slice = buildParentQuoteSlice('  We should narrow the scope.  ');
    expect(slice.isAvailable).toBe(true);
    expect(slice.quote).toBe('We should narrow the scope.');
  });

  it('truncates to PARENT_BODY_PREVIEW_CAP (120) chars', () => {
    const long = 'x'.repeat(300);
    const slice = buildParentQuoteSlice(long);
    expect(slice.isAvailable).toBe(true);
    expect(slice.quote).toHaveLength(PARENT_BODY_PREVIEW_CAP);
    expect(PARENT_BODY_PREVIEW_CAP).toBe(120);
  });

  it('soft-deleted / RLS-hidden parent (null) → neutral placeholder, no quote', () => {
    const slice = buildParentQuoteSlice(null);
    expect(slice.isAvailable).toBe(false);
    expect(slice.quote).toBeNull();
    expect(slice.unavailableLabel).toBe(PARENT_QUOTE_UNAVAILABLE);
  });

  it('out-of-slice / empty preview ("") → neutral placeholder, never invents a quote', () => {
    for (const v of ['', '   ', undefined]) {
      const slice = buildParentQuoteSlice(v);
      expect(slice.isAvailable).toBe(false);
      expect(slice.quote).toBeNull();
    }
  });

  it('the placeholder never leaks a "hidden because…" / inactive reason', () => {
    const slice = buildParentQuoteSlice(null);
    const lower = slice.unavailableLabel.toLowerCase();
    expect(lower).not.toContain('hidden');
    expect(lower).not.toContain('because');
    expect(lower).not.toContain('reason');
    expect(lower).not.toContain('deleted');
    expect(lower).not.toContain('inactive');
  });
});

// ── ask v — Standing / Tone / Heat strip ──────────────────────────────

describe('CVDH-001 Slice 2 — Standing / Tone / Heat plain-language (ask v)', () => {
  it('tone band maps to plain-language; unknown → neutral em-dash', () => {
    expect(formatToneLine(fakeNode({ toneBand: 'calm' }))).toBe('Tone: Calm');
    expect(formatToneLine(fakeNode({ toneBand: 'measured' }))).toBe('Tone: Measured');
    expect(formatToneLine(fakeNode({ toneBand: 'heated' }))).toBe('Tone: Heated');
    expect(formatToneLine(fakeNode({ toneBand: 'hostile' }))).toBe('Tone: Hostile');
    expect(formatToneLine(fakeNode({ toneBand: 'unknown' }))).toBe('Tone: —');
  });

  it('heat band maps to plain-language; unknown → neutral em-dash', () => {
    expect(formatHeatLine(fakeNode({ temperatureBand: 'cool' }))).toBe('Heat: Cool');
    expect(formatHeatLine(fakeNode({ temperatureBand: 'mild' }))).toBe('Heat: Mild');
    expect(formatHeatLine(fakeNode({ temperatureBand: 'warm' }))).toBe('Heat: Warm');
    expect(formatHeatLine(fakeNode({ temperatureBand: 'hot' }))).toBe('Heat: Hot');
    expect(formatHeatLine(fakeNode({ temperatureBand: 'unknown' }))).toBe('Heat: —');
  });

  it('standing band reuses the SW-001 soft labels (plain-language)', () => {
    const vm = fakeViewModel();
    // SW-001 soft labels: pretty_right → "Well supported"; pretty_wrong → "Needs work".
    expect(formatStandingLine(vm, fakeNode({ standingBand: 'pretty_right' }))).toBe(
      'Standing: Well supported',
    );
    expect(formatStandingLine(vm, fakeNode({ standingBand: 'pretty_wrong' }))).toBe(
      'Standing: Needs work',
    );
    expect(standingBandPlainLabel('neutral')).toBe(STANDING_BAND_SOFT_LABEL.neutral);
  });

  it('no raw snake_case band token leaks into any formatted line', () => {
    const vm = fakeViewModel();
    const lines = [
      formatStandingLine(vm, fakeNode({ standingBand: 'maybe_right_misguided' })),
      formatToneLine(fakeNode({ toneBand: 'heated' })),
      formatHeatLine(fakeNode({ temperatureBand: 'warm' })),
    ];
    for (const line of lines) {
      // The value half (after the colon) must not be a raw snake_case token.
      const value = line.split(': ')[1] ?? '';
      expect(value).not.toMatch(/_/);
    }
  });

  it('buildStandingToneHeatStrip carries the "How this message reads" caption', () => {
    const strip = buildStandingToneHeatStrip(fakeViewModel(), fakeNode());
    expect(strip.caption).toBe(STANDING_TONE_HEAT_CAPTION);
    expect(strip.caption).toBe('How this message reads');
    // The caption frames the strip as a reading of the TEXT, not the author.
    expect(strip.caption.toLowerCase()).not.toContain('person');
    expect(strip.caption.toLowerCase()).not.toContain('you are');
  });

  it('carries the raw band codes for tests/a11y (never rendered)', () => {
    const strip = buildStandingToneHeatStrip(
      fakeViewModel(),
      fakeNode({ standingBand: 'pretty_right', toneBand: 'calm', temperatureBand: 'mild' }),
    );
    expect(strip.standingBandCode).toBe('pretty_right');
    expect(strip.toneBandCode).toBe('calm');
    expect(strip.heatBandCode).toBe('mild');
  });

  it('the band-label maps are total over the band unions', () => {
    const toneBands: TimelineToneBand[] = ['calm', 'measured', 'heated', 'hostile', 'unknown'];
    for (const b of toneBands) expect(typeof TONE_BAND_PLAIN_LABEL[b]).toBe('string');
    const heatBands: TimelineTemperatureBand[] = ['cool', 'mild', 'warm', 'hot', 'unknown'];
    for (const b of heatBands) expect(typeof HEAT_BAND_PLAIN_LABEL[b]).toBe('string');
  });
});

// ── doctrine: ban-list over the strip + parent-quote strings ───────────

describe('CVDH-001 Slice 2 — verdict-token ban-list over shared strip outputs', () => {
  const toneBands: TimelineToneBand[] = ['calm', 'measured', 'heated', 'hostile', 'unknown'];
  const heatBands: TimelineTemperatureBand[] = ['cool', 'mild', 'warm', 'hot', 'unknown'];
  const standingBands: TimelineStandingBand[] = [
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

  it('every Standing/Tone/Heat strip permutation is verdict-token clean', () => {
    const vm = fakeViewModel();
    for (const standingBand of standingBands) {
      for (const toneBand of toneBands) {
        for (const temperatureBand of heatBands) {
          const strip = buildStandingToneHeatStrip(
            vm,
            fakeNode({ standingBand, toneBand, temperatureBand }),
          );
          const blob = ` ${[strip.standingLine, strip.toneLine, strip.heatLine, strip.caption].join(' ').toLowerCase()} `;
          for (const banned of VERDICT_BAN) {
            expect(blob).not.toContain(banned);
          }
        }
      }
    }
  });

  it('the parent-quote placeholder is verdict-token clean', () => {
    const blob = ` ${PARENT_QUOTE_UNAVAILABLE.toLowerCase()} `;
    for (const banned of VERDICT_BAN) expect(blob).not.toContain(banned);
  });
});

// ── determinism + non-mutation ────────────────────────────────────────

describe('CVDH-001 Slice 2 — determinism + non-mutation', () => {
  it('buildStandingToneHeatStrip is deterministic + does not mutate inputs', () => {
    const node = fakeNode();
    const vm = fakeViewModel();
    const snapNode = JSON.stringify(node);
    const snapVm = JSON.stringify(vm);
    const a = buildStandingToneHeatStrip(vm, node);
    const b = buildStandingToneHeatStrip(vm, node);
    expect(a).toEqual(b);
    expect(JSON.stringify(node)).toBe(snapNode);
    expect(JSON.stringify(vm)).toBe(snapVm);
  });

  it('buildParentQuoteSlice is deterministic', () => {
    const a = buildParentQuoteSlice('some parent body');
    const b = buildParentQuoteSlice('some parent body');
    expect(a).toEqual(b);
  });
});
