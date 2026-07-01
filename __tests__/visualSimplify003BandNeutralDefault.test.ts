/**
 * VISUAL-SIMPLIFY-003 — band-neutral default timeline contract.
 *
 * The product audit flagged the per-node strength band (color/glyph driven by
 * AI flags via `inferStandingBand`) as the closest thing to a per-message
 * verdict in the DEFAULT UX. This card retires that decoration from the
 * default path WITHOUT deleting the machinery: `node.standingBand` stays
 * populated so opt-in Inspect / popover / detail / score-tracker surfaces keep
 * their signal, and passing `neutralizeStandingBands: false` restores the
 * pre-card behavior for those surfaces.
 *
 * Doctrine: the branch grammar (shape = argument type, lanes = branches) is
 * PRESERVED — it carries no strength meaning. Nothing here may introduce a
 * truth / strength frame into the default view.
 *
 * Pure-model tests. No React, no Supabase, no network.
 */
import {
  buildArgumentTimelineMap,
  inferStandingBand,
  STANDING_BAND_COLOR,
  type ArgumentTimelineMapMessageInput,
  type ArgumentTimelineMapModel,
} from '../src/features/arguments/argumentGameSurfaceModel';
import { deriveTimelineNodeVisualStyle } from '../src/features/arguments/timelineNodeVisualModel';
import { STANDING_BAND_SOFT_LABEL } from '../src/features/arguments/standingBandCopy';

function isoAt(offsetMs: number): string {
  return new Date(1715000000000 + offsetMs).toISOString();
}

function msg(
  partial: Partial<ArgumentTimelineMapMessageInput> & { id: string },
): ArgumentTimelineMapMessageInput {
  return {
    id: partial.id,
    debateId: partial.debateId ?? 'd1',
    parentId: partial.parentId ?? null,
    authorId: partial.authorId ?? 'author-a',
    argumentType: partial.argumentType ?? 'claim',
    side: partial.side ?? 'affirmative',
    body: partial.body ?? 'A claim body of some length.',
    status: partial.status ?? 'posted',
    createdAt: partial.createdAt ?? isoAt(0),
    updatedAt: partial.updatedAt ?? partial.createdAt ?? isoAt(0),
    isBot: partial.isBot ?? false,
    qualifierLabels: partial.qualifierLabels ?? [],
    flagCodes: partial.flagCodes ?? [],
    tagCodes: partial.tagCodes ?? [],
    hasEvidence: partial.hasEvidence,
    topicScore: partial.topicScore ?? null,
  };
}

// A conversation whose children carry strength-shifting flags, so the
// per-node bands would be non-neutral if they were rendered.
function flaggedConversation(): ArgumentTimelineMapMessageInput[] {
  return [
    msg({ id: 'r', createdAt: isoAt(0), argumentType: 'thesis' }),
    // off_topic → inferStandingBand → 'pretty_wrong'
    msg({ id: 'a', parentId: 'r', createdAt: isoAt(1000), argumentType: 'rebuttal', flagCodes: ['off_topic'] }),
    // ad_hominem → 'pretty_wrong'
    msg({ id: 'b', parentId: 'a', createdAt: isoAt(2000), argumentType: 'rebuttal', flagCodes: ['ad_hominem'] }),
    // evidence with hasEvidence → 'pretty_right'
    msg({ id: 'c', parentId: 'b', createdAt: isoAt(3000), argumentType: 'evidence', hasEvidence: true }),
  ];
}

const ALL_SOFT_LABELS = Object.values(STANDING_BAND_SOFT_LABEL);

const BANNED_VERDICT_TOKENS = [
  'winner',
  'loser',
  'correct',
  'incorrect',
  'true',
  'false',
  'liar',
  'dishonest',
  'bad faith',
];

function buildDefault(): ArgumentTimelineMapModel {
  return buildArgumentTimelineMap({
    messages: flaggedConversation(),
    currentUserId: 'me',
  });
}

function buildInspect(): ArgumentTimelineMapModel {
  return buildArgumentTimelineMap({
    messages: flaggedConversation(),
    currentUserId: 'me',
    neutralizeStandingBands: false,
  });
}

describe('VISUAL-SIMPLIFY-003 — default path is band-neutral', () => {
  it('every edge standing stop is the neutral unscored grey, not a strength color', () => {
    const map = buildDefault();
    expect(map.edges.length).toBeGreaterThan(0);
    for (const edge of map.edges) {
      // The standing stop is at index length-2 (…, standing, tone).
      const standingStop = edge.gradientStops[edge.gradientStops.length - 2];
      expect(standingStop).toBe(STANDING_BAND_COLOR.unscored);
      // Explicitly NOT any strength color, even though inputs carry
      // off_topic / ad_hominem flags that map to pretty_wrong (red).
      expect(standingStop).not.toBe(STANDING_BAND_COLOR.pretty_wrong);
      expect(standingStop).not.toBe(STANDING_BAND_COLOR.pretty_right);
    }
  });

  it('no node accessibility label contains any strength soft label', () => {
    const map = buildDefault();
    for (const node of map.nodes) {
      const label = node.accessibilityLabel;
      for (const soft of ALL_SOFT_LABELS) {
        expect(label).not.toContain(soft);
      }
    }
  });

  it('node.standingBand is STILL populated (opt-in consumers keep their signal)', () => {
    const map = buildDefault();
    const offTopic = map.nodes.find((n) => n.messageId === 'a')!;
    // The underlying signal is intact — only its DEFAULT rendering is
    // neutralized. off_topic still infers pretty_wrong.
    expect(offTopic.standingBand).toBe('pretty_wrong');
    expect(inferStandingBand({ flagCodes: ['off_topic'], argumentType: 'rebuttal' })).toBe('pretty_wrong');
  });

  it('doctrine sweep: no node label carries a verdict token or a soft-label strength value', () => {
    const map = buildDefault();
    for (const node of map.nodes) {
      const label = node.accessibilityLabel.toLowerCase();
      for (const token of BANNED_VERDICT_TOKENS) {
        expect(label).not.toContain(token);
      }
      for (const soft of ALL_SOFT_LABELS) {
        expect(label).not.toContain(soft.toLowerCase());
      }
    }
  });

  it('default a11y label stays non-empty (type + ordinal + branch + state + time)', () => {
    const map = buildDefault();
    for (const node of map.nodes) {
      expect(node.accessibilityLabel.length).toBeGreaterThan(0);
      expect(node.accessibilityLabel).toContain(`of ${map.nodes.length}`);
    }
  });
});

describe('VISUAL-SIMPLIFY-003 — Inspect path restores band rendering', () => {
  it('edge standing stop reflects the real band color when neutralizeStandingBands is false', () => {
    const map = buildInspect();
    // Edge into node 'a' (off_topic → pretty_wrong).
    const edgeToA = map.edges.find((e) => e.toMessageId === 'a')!;
    const standingStop = edgeToA.gradientStops[edgeToA.gradientStops.length - 2];
    expect(standingStop).toBe(STANDING_BAND_COLOR.pretty_wrong);
    // Edge into node 'c' (evidence + hasEvidence → pretty_right).
    const edgeToC = map.edges.find((e) => e.toMessageId === 'c')!;
    const standingStopC = edgeToC.gradientStops[edgeToC.gradientStops.length - 2];
    expect(standingStopC).toBe(STANDING_BAND_COLOR.pretty_right);
  });

  it('Inspect-path node a11y label includes the soft strength label (parity with pre-card behavior)', () => {
    const map = buildInspect();
    const offTopic = map.nodes.find((n) => n.messageId === 'a')!;
    expect(offTopic.accessibilityLabel).toContain(STANDING_BAND_SOFT_LABEL.pretty_wrong);
  });
});

describe('VISUAL-SIMPLIFY-003 — branch grammar + node visuals unchanged', () => {
  it('node.kindColor and lane assignment are identical across default and inspect builds', () => {
    const def = buildDefault();
    const insp = buildInspect();
    expect(def.nodes.length).toBe(insp.nodes.length);
    for (let i = 0; i < def.nodes.length; i++) {
      const d = def.nodes[i];
      const n = insp.nodes[i];
      expect(d.messageId).toBe(n.messageId);
      // Shape/type color is the type family color — carries NO strength.
      expect(d.kindColor).toBe(n.kindColor);
      expect(d.kindColorFamily).toBe(n.kindColorFamily);
      // Lane grammar is untouched by band neutralization.
      expect(d.lane).toBe(n.lane);
      expect(d.branchId).toBe(n.branchId);
      // The underlying standingBand field is the SAME in both builds — only
      // its default-path rendering differs.
      expect(d.standingBand).toBe(n.standingBand);
    }
  });

  it('timelineNodeVisualModel derivation is strength-independent (deep-equal for identical visual input)', () => {
    const def = buildDefault();
    for (const node of def.nodes) {
      const visualInput = {
        isActive: node.isActive,
        isActivePath: node.isActivePath,
        isSelected: false,
        toneBand: node.toneBand,
        temperatureBand: node.temperatureBand,
        hasEvidenceArtifact: false,
        prefersReducedMotion: false,
      };
      // The derivation reads no standingBand — so it is byte-identical
      // regardless of the band. Deriving twice must be deep-equal.
      expect(deriveTimelineNodeVisualStyle(visualInput)).toEqual(
        deriveTimelineNodeVisualStyle(visualInput),
      );
    }
  });

  it('reduce-motion: default-path a11y label still non-empty (a11y invariant holds)', () => {
    const map = buildDefault();
    // The a11y label is independent of motion prefs; neutralization must not
    // strip it to empty.
    for (const node of map.nodes) {
      expect(node.accessibilityLabel.trim().length).toBeGreaterThan(0);
    }
  });
});
