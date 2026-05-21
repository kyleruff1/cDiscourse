/**
 * IX-002 — Timeline mini-map doctrine ban-list.
 *
 * cdiscourse-doctrine §1 + §2: the mini-map renders no verdict / truth /
 * winner-loser language, and heat is an ACTIVITY signal — never a result.
 * This file scans every string the model + the component's exported copy
 * builders can emit for the banned set, and proves a `pretty_wrong` move
 * can still be `hot` (heat ≠ correctness) without any standing band
 * leaking into a mini-map field.
 */
import {
  buildArgumentTimelineMap,
  type ArgumentTimelineMapMessageInput,
} from '../src/features/arguments/argumentGameSurfaceModel';
import {
  buildTimelineMiniMapModel,
  mapTemperatureToHeatTier,
  type MiniMapHeatTier,
  type TimelineMiniMapModel,
} from '../src/features/arguments/timelineMiniMapModel';
import {
  buildMiniMapAccessibilityLabel,
  buildBranchChipAccessibilityLabel,
  buildBranchChipLabel,
  buildHotZoneChipLabel,
  buildHotZoneChipAccessibilityLabel,
} from '../src/features/arguments/TimelineMiniMap';

// ── Ban-list ─────────────────────────────────────────────────────

const BANNED: ReadonlyArray<string> = [
  'winner',
  'loser',
  'winning',
  'losing',
  'correct',
  'incorrect',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  // Standalone-judgment words. Checked with word boundaries so "True"
  // inside "construe" etc. does not false-positive.
];

const BANNED_WORD_BOUNDARY: ReadonlyArray<string> = [
  'true',
  'false',
  'right',
  'wrong',
];

function assertNoBannedToken(s: string): void {
  const lower = s.toLowerCase();
  for (const token of BANNED) {
    expect(lower.includes(token)).toBe(false);
  }
  for (const token of BANNED_WORD_BOUNDARY) {
    const re = new RegExp(`\\b${token}\\b`, 'i');
    expect(re.test(s)).toBe(false);
  }
}

function isoAt(offsetMs: number): string {
  return new Date(1715000000000 + offsetMs).toISOString();
}

function msg(
  partial: Partial<ArgumentTimelineMapMessageInput> & { id: string },
): ArgumentTimelineMapMessageInput {
  return {
    id: partial.id,
    debateId: 'd1',
    parentId: partial.parentId ?? null,
    authorId: 'author-a',
    argumentType: partial.argumentType ?? 'claim',
    side: 'affirmative',
    body: partial.body ?? 'A body.',
    status: 'posted',
    createdAt: partial.createdAt ?? isoAt(0),
    updatedAt: partial.createdAt ?? isoAt(0),
    isBot: false,
    qualifierLabels: [],
    flagCodes: partial.flagCodes ?? [],
    tagCodes: partial.tagCodes ?? [],
    topicScore: null,
    hasEvidence: partial.hasEvidence ?? false,
  };
}

/** A 14-move debate with a side branch + a contiguous hot run. */
function buildRichModel(): TimelineMiniMapModel {
  const messages: ArgumentTimelineMapMessageInput[] = [
    msg({ id: 'r', createdAt: isoAt(0), argumentType: 'thesis' }),
  ];
  for (let i = 0; i < 13; i++) {
    messages.push(
      msg({
        id: `m${i}`,
        parentId: i < 3 ? 'r' : `m${i - 1}`,
        createdAt: isoAt((i + 1) * 1000),
        flagCodes: i >= 5 && i <= 7 ? ['ad_hominem'] : [],
      }),
    );
  }
  const map = buildArgumentTimelineMap({ messages, currentUserId: 'me' });
  return buildTimelineMiniMapModel({ timelineMap: map });
}

// ── Model strings ───────────────────────────────────────────────

describe('IX-002 ban-list — model strings carry no verdict tokens', () => {
  const model = buildRichModel();

  it('summaryLine has no banned token', () => {
    assertNoBannedToken(model.summaryLine);
  });

  it('every branch cluster laneLabel has no banned token', () => {
    for (const c of model.branchClusters) {
      assertNoBannedToken(c.laneLabel);
    }
  });
});

// ── Component copy builders ─────────────────────────────────────

describe('IX-002 ban-list — component copy builders carry no verdict tokens', () => {
  const model = buildRichModel();

  it('whole-mini-map accessibility label has no banned token', () => {
    assertNoBannedToken(buildMiniMapAccessibilityLabel(model));
  });

  it('every branch chip label + a11y label has no banned token', () => {
    for (const c of model.branchClusters) {
      assertNoBannedToken(buildBranchChipLabel(c));
      assertNoBannedToken(buildBranchChipAccessibilityLabel(c));
    }
  });

  it('hot-zone chip label + a11y label has no banned token', () => {
    expect(model.hotZone).not.toBeNull();
    assertNoBannedToken(buildHotZoneChipLabel(model.hotZone!));
    assertNoBannedToken(buildHotZoneChipAccessibilityLabel(model.hotZone!));
  });

  it('the whole-mini-map a11y label frames heat as activity, not a result', () => {
    const label = buildMiniMapAccessibilityLabel(model).toLowerCase();
    expect(label).toContain('recent activity');
    expect(label).toContain('not a result');
  });
});

// ── Heat-tier union safety ──────────────────────────────────────

describe('IX-002 ban-list — heat tier union has no truth-laden literal', () => {
  const ALL_TIERS: ReadonlyArray<MiniMapHeatTier> = ['quiet', 'mild', 'warm', 'hot'];

  it('the heat tier literals are exactly quiet | mild | warm | hot', () => {
    for (const tier of ALL_TIERS) {
      assertNoBannedToken(tier);
    }
    // Sanity — the temperature → tier mapping never produces another value.
    expect(mapTemperatureToHeatTier('cool')).toBe('quiet');
    expect(mapTemperatureToHeatTier('mild')).toBe('mild');
    expect(mapTemperatureToHeatTier('warm')).toBe('warm');
    expect(mapTemperatureToHeatTier('hot')).toBe('hot');
    expect(mapTemperatureToHeatTier('unknown')).toBe('quiet');
  });
});

// ── Heat is not truth ───────────────────────────────────────────

describe('IX-002 doctrine — heat is activity, never correctness', () => {
  it('the hottest marker can sit on a pretty_wrong move; no standing band leaks into any mini-map field', () => {
    // A 12-move debate where the most heated moves carry off_topic
    // (→ standingBand pretty_wrong) AND ad_hominem (→ temperatureBand hot).
    const messages: ArgumentTimelineMapMessageInput[] = [];
    for (let i = 0; i < 12; i++) {
      messages.push(
        msg({
          id: `m${i}`,
          parentId: i === 0 ? null : `m${i - 1}`,
          createdAt: isoAt(i * 1000),
          flagCodes: i >= 4 && i <= 6 ? ['ad_hominem', 'off_topic'] : [],
        }),
      );
    }
    const map = buildArgumentTimelineMap({ messages, currentUserId: 'me' });
    // The flagged nodes are pretty_wrong on the underlying map.
    const flaggedNode = map.nodes.find((n) => n.messageId === 'm5')!;
    expect(flaggedNode.standingBand).toBe('pretty_wrong');

    const mini = buildTimelineMiniMapModel({ timelineMap: map });
    const flaggedMarker = mini.markers.find((m) => m.messageId === 'm5')!;
    // The mini-map shows the `hot` tier on that same move...
    expect(flaggedMarker.heatTier).toBe('hot');

    // ...and NO standing band leaks into any mini-map marker field. The
    // marker shape has no `standingBand` / `standing` / `band` key at all.
    const markerKeys = Object.keys(flaggedMarker);
    expect(markerKeys).not.toContain('standingBand');
    expect(markerKeys).not.toContain('standing');
    expect(markerKeys.some((k) => /standing/i.test(k))).toBe(false);
  });

  it('the hot zone is chosen by run length, never by which move is "hottest"', () => {
    // Hot markers come in a short run; warm markers in a longer run.
    const messages: ArgumentTimelineMapMessageInput[] = [];
    for (let i = 0; i < 14; i++) {
      let flags: string[] = [];
      if (i === 2 || i === 3) flags = ['ad_hominem']; // hot, run of 2
      if (i >= 7 && i <= 10) flags = ['civility_risk']; // warm, run of 4
      messages.push(
        msg({
          id: `m${i}`,
          parentId: i === 0 ? null : `m${i - 1}`,
          createdAt: isoAt(i * 1000),
          flagCodes: flags,
        }),
      );
    }
    const map = buildArgumentTimelineMap({ messages, currentUserId: 'me' });
    const mini = buildTimelineMiniMapModel({ timelineMap: map });
    expect(mini.hotZone).not.toBeNull();
    // The 4-warm run wins over the 2-hot run.
    expect(mini.hotZone!.moveCount).toBe(4);
    expect(mini.hotZone!.jumpTargetMessageId).toBe('m7');
  });
});
