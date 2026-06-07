/**
 * CARD-VIEW-DETAIL-HUB-001 (Slice 3) — `hubColumnLayout` + actor-color grammar.
 *
 * Pure-model tests for the responsive multi-column helper (design §7.2) and
 * the parent-comparison actor-color grammar (operator refinement §2.A).
 *
 * Covers:
 *   - ≥1024 web → 3-col; narrow / native / degenerate → stacked
 *   - the SAME column regions are present in BOTH layouts (none dropped)
 *   - the SR reading order is stable + identical across layouts
 *   - determinism (same input → same output)
 *   - the actor → bubble-color grammar (distinct colors per actor;
 *     color encodes actor, never a verdict; total over the actor union)
 *   - `buildParentComparisonBubble` happy path / degrade / no-dangling-ref
 */

import {
  ACTOR_BUBBLE_COLOR,
  HUB_READING_ORDER,
  HUB_WIDE_LAYOUT_WIDTH_THRESHOLD,
  actorBubbleColor,
  buildParentComparisonBubble,
  hubColumnLayout,
  type HubColumnRegion,
} from '../src/features/arguments/detail/argumentDetailModel';
import type { ArgumentBubbleActor } from '../src/features/arguments/argumentGameSurfaceModel';

const ALL_REGIONS: HubColumnRegion[] = ['centerpiece', 'classifier', 'tags'];
const ALL_ACTORS: ArgumentBubbleActor[] = ['self', 'other', 'admin', 'bot', 'unknown'];

describe('CVDH-001 Slice 3 — hubColumnLayout', () => {
  it('returns three_column on web at exactly the ≥1024 boundary', () => {
    const layout = hubColumnLayout(HUB_WIDE_LAYOUT_WIDTH_THRESHOLD, 'web');
    expect(layout.mode).toBe('three_column');
    expect(layout.columnCount).toBe(3);
  });

  it('returns three_column on a wide web viewport (1440)', () => {
    expect(hubColumnLayout(1440, 'web').mode).toBe('three_column');
  });

  it('returns stacked on a narrow web viewport (just below 1024)', () => {
    const layout = hubColumnLayout(HUB_WIDE_LAYOUT_WIDTH_THRESHOLD - 1, 'web');
    expect(layout.mode).toBe('stacked');
    expect(layout.columnCount).toBe(1);
  });

  it('returns stacked on a phone-width web viewport (390)', () => {
    expect(hubColumnLayout(390, 'web').mode).toBe('stacked');
  });

  it('returns stacked on native regardless of width (1440 iOS / Android)', () => {
    expect(hubColumnLayout(1440, 'ios').mode).toBe('stacked');
    expect(hubColumnLayout(1440, 'android').mode).toBe('stacked');
    expect(hubColumnLayout(1440, 'windows').mode).toBe('stacked');
    expect(hubColumnLayout(1440, 'macos').mode).toBe('stacked');
  });

  it('returns stacked (fail-safe) for non-finite / non-positive width', () => {
    expect(hubColumnLayout(Number.NaN, 'web').mode).toBe('stacked');
    expect(hubColumnLayout(0, 'web').mode).toBe('stacked');
    expect(hubColumnLayout(-100, 'web').mode).toBe('stacked');
    expect(hubColumnLayout(Number.POSITIVE_INFINITY, 'web').mode).toBe('stacked');
  });

  it('presents the SAME column regions in BOTH layouts — never drops a section', () => {
    const wide = hubColumnLayout(1440, 'web');
    const stacked = hubColumnLayout(390, 'web');
    // Visual order is a permutation of the canonical regions in both modes.
    expect([...wide.visualOrder].sort()).toEqual([...ALL_REGIONS].sort());
    expect([...stacked.visualOrder].sort()).toEqual([...ALL_REGIONS].sort());
    // Reading order is the full region set in both modes.
    expect([...wide.readingOrder].sort()).toEqual([...ALL_REGIONS].sort());
    expect([...stacked.readingOrder].sort()).toEqual([...ALL_REGIONS].sort());
  });

  it('keeps the SR reading order stable + identical across layouts', () => {
    const wide = hubColumnLayout(1440, 'web');
    const stacked = hubColumnLayout(390, 'web');
    expect(wide.readingOrder).toEqual(HUB_READING_ORDER);
    expect(stacked.readingOrder).toEqual(HUB_READING_ORDER);
    expect(wide.readingOrder).toEqual(stacked.readingOrder);
    // The canonical reading order leads with the centerpiece.
    expect(HUB_READING_ORDER[0]).toBe('centerpiece');
  });

  it('places the centerpiece between the two flanking columns on wide (visual order)', () => {
    const wide = hubColumnLayout(1440, 'web');
    expect(wide.visualOrder).toEqual(['tags', 'centerpiece', 'classifier']);
    // The centerpiece is the MIDDLE visual column → visually centered.
    expect(wide.visualOrder[1]).toBe('centerpiece');
  });

  it('stacked visual order equals the reading order', () => {
    const stacked = hubColumnLayout(390, 'web');
    expect(stacked.visualOrder).toEqual(stacked.readingOrder);
  });

  it('is deterministic — same input yields a structurally-equal result', () => {
    expect(hubColumnLayout(1440, 'web')).toEqual(hubColumnLayout(1440, 'web'));
    expect(hubColumnLayout(390, 'ios')).toEqual(hubColumnLayout(390, 'ios'));
  });
});

describe('CVDH-001 Slice 3 — actor bubble-color grammar', () => {
  it('is total over the actor union', () => {
    for (const actor of ALL_ACTORS) {
      const color = actorBubbleColor(actor);
      expect(typeof color.bg).toBe('string');
      expect(typeof color.border).toBe('string');
      expect(typeof color.accent).toBe('string');
    }
  });

  it('collapses null / undefined / unexpected actor to the neutral unknown pair', () => {
    expect(actorBubbleColor(null)).toEqual(ACTOR_BUBBLE_COLOR.unknown);
    expect(actorBubbleColor(undefined)).toEqual(ACTOR_BUBBLE_COLOR.unknown);
    expect(actorBubbleColor('nope' as ArgumentBubbleActor)).toEqual(
      ACTOR_BUBBLE_COLOR.unknown,
    );
  });

  it('gives self vs other DISTINCT colors so the two parties contrast', () => {
    const self = actorBubbleColor('self');
    const other = actorBubbleColor('other');
    expect(self.bg).not.toBe(other.bg);
    expect(self.border).not.toBe(other.border);
  });

  it('mirrors the Timeline actor grammar (self=cyan / other=indigo / bot=purple / admin=amber)', () => {
    // Border hue mirrors ArgumentTimelineScrubber.actorTone so the bubble
    // reads as the SAME system the Timeline uses.
    expect(ACTOR_BUBBLE_COLOR.self.border).toBe('#22d3ee');
    expect(ACTOR_BUBBLE_COLOR.other.border).toBe('#818cf8');
    expect(ACTOR_BUBBLE_COLOR.bot.border).toBe('#a855f7');
    expect(ACTOR_BUBBLE_COLOR.admin.border).toBe('#facc15');
    expect(ACTOR_BUBBLE_COLOR.unknown.border).toBe('#475569');
  });
});

describe('CVDH-001 Slice 3 — buildParentComparisonBubble', () => {
  function input(over: Partial<Parameters<typeof buildParentComparisonBubble>[0]> = {}) {
    return buildParentComparisonBubble({
      parentBodyPreview: 'We should narrow the scope to the downtown core.',
      parentOrdinal: 6,
      parentKindLabel: 'rebuttal',
      parentMessageId: 'msg-parent',
      parentActor: 'other',
      parentActorLabel: 'Other side',
      ...over,
    });
  }

  it('happy path — renders a parent bubble with reference + actor color', () => {
    const bubble = input();
    expect(bubble.kind).toBe('parent');
    expect(bubble.quote.quote).toBe('We should narrow the scope to the downtown core.');
    expect(bubble.referenceToken).toBe('#6');
    expect(bubble.referenceLabel).toBe('#6 · rebuttal');
    expect(bubble.parentMessageId).toBe('msg-parent');
    expect(bubble.actor).toBe('other');
    expect(bubble.color).toEqual(ACTOR_BUBBLE_COLOR.other);
    expect(bubble.actorLabel).toBe('Other side');
    expect(bubble.accessibilityLabel.length).toBeGreaterThan(0);
  });

  it('degrades to kind:none (no bubble) when the parent body is empty / null', () => {
    expect(input({ parentBodyPreview: null }).kind).toBe('none');
    expect(input({ parentBodyPreview: '' }).kind).toBe('none');
    expect(input({ parentBodyPreview: '   ' }).kind).toBe('none');
  });

  it('on degrade carries NO reference token / id and NO "hidden because" reason', () => {
    const bubble = input({ parentBodyPreview: null });
    expect(bubble.referenceToken).toBeNull();
    expect(bubble.referenceLabel).toBeNull();
    expect(bubble.parentMessageId).toBeNull();
    expect(bubble.accessibilityLabel.toLowerCase()).not.toContain('hidden');
    expect(bubble.accessibilityLabel.toLowerCase()).not.toContain('because');
  });

  it('emits NO dangling tappable id when the parent message id is missing', () => {
    const bubble = input({ parentMessageId: null });
    expect(bubble.kind).toBe('parent');
    expect(bubble.parentMessageId).toBeNull();
    // The reference LABEL still renders (display-only) but is not tappable.
    expect(bubble.referenceLabel).toBe('#6 · rebuttal');
  });

  it('emits NO reference token when the ordinal is unknown', () => {
    const bubble = input({ parentOrdinal: null });
    expect(bubble.referenceToken).toBeNull();
    expect(bubble.referenceLabel).toBeNull();
    expect(bubble.parentMessageId).toBeNull();
  });

  it('truncates the quote to ≤120 chars (shared PARENT_BODY_PREVIEW_CAP)', () => {
    const long = 'x'.repeat(400);
    const bubble = input({ parentBodyPreview: long });
    expect(bubble.quote.quote!.length).toBeLessThanOrEqual(120);
  });

  it('falls back to a neutral actor label + unknown color for an unknown actor', () => {
    const bubble = input({ parentActor: null, parentActorLabel: null });
    expect(bubble.actor).toBe('unknown');
    expect(bubble.color).toEqual(ACTOR_BUBBLE_COLOR.unknown);
    expect(bubble.actorLabel).toBe('Replying to');
  });

  it('never echoes a raw code for an empty parent kind label', () => {
    const bubble = input({ parentKindLabel: '   ' });
    expect(bubble.referenceLabel).toBe('#6 · move');
  });
});
