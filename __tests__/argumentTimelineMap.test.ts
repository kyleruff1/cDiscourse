/**
 * Stage 6.2 — Timeline Map Model tests (Milestone 1).
 *
 * Pure-function tests for `buildArgumentTimelineMap` and helpers in
 * argumentGameSurfaceModel.ts. No React, no Supabase, no network.
 *
 * IX-002 extends this suite (per the design's test plan — "do not create a
 * parallel one") with a source-scan `describe` block proving
 * `ArgumentTimelineMap.tsx` wires the mini-map in: rendered above the
 * onboarding banner, jumps routed through `onActivate` (no route
 * transition), branch jumps toggle `collapseState`.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  buildArgumentTimelineMap,
  timelineMapPrevId,
  timelineMapNextId,
  inferStandingBand,
  inferToneBand,
  inferTemperatureBand,
  mixHex,
  TIMELINE_KIND_COLORS,
  TIMELINE_NODE_SIZE,
  type ArgumentTimelineMapMessageInput,
  type ArgumentTimelineMapModel,
} from '../src/features/arguments/argumentGameSurfaceModel';
import { buildTimelineMiniMapModel } from '../src/features/arguments/timelineMiniMapModel';

function isoAt(offsetMs: number): string {
  // Anchor to a fixed timestamp so tests are deterministic.
  return new Date(1715000000000 + offsetMs).toISOString();
}

function msg(partial: Partial<ArgumentTimelineMapMessageInput> & { id: string; createdAt?: string }): ArgumentTimelineMapMessageInput {
  return {
    id: partial.id,
    debateId: partial.debateId ?? 'd1',
    parentId: partial.parentId ?? null,
    authorId: partial.authorId ?? 'author-a',
    argumentType: partial.argumentType ?? 'claim',
    side: partial.side ?? 'affirmative',
    body: partial.body ?? 'A claim body.',
    status: partial.status ?? 'posted',
    createdAt: partial.createdAt ?? isoAt(0),
    updatedAt: partial.updatedAt ?? partial.createdAt ?? isoAt(0),
    isBot: partial.isBot ?? false,
    qualifierLabels: partial.qualifierLabels ?? [],
    flagCodes: partial.flagCodes ?? [],
    tagCodes: partial.tagCodes ?? [],
    topicScore: partial.topicScore ?? null,
    hasEvidence: partial.hasEvidence ?? false,
  };
}

describe('buildArgumentTimelineMap — chronology + node creation', () => {
  it('returns an empty model when no messages are provided', () => {
    const map = buildArgumentTimelineMap({ messages: [], currentUserId: 'me' });
    expect(map.nodes).toEqual([]);
    expect(map.edges).toEqual([]);
    expect(map.bands).toEqual([]);
    expect(map.activeNode).toBeNull();
    expect(map.latestMessageId).toBeNull();
    expect(map.activePathIds).toEqual([]);
    expect(map.legend.length).toBeGreaterThan(0);
  });

  it('orders nodes chronologically left to right (earliest leftmost, latest rightmost)', () => {
    const map = buildArgumentTimelineMap({
      messages: [
        msg({ id: 'c', createdAt: isoAt(2000), argumentType: 'rebuttal' }),
        msg({ id: 'a', createdAt: isoAt(0), argumentType: 'thesis' }),
        msg({ id: 'b', createdAt: isoAt(1000), argumentType: 'claim' }),
      ],
      currentUserId: 'me',
    });
    expect(map.nodes.map((n) => n.messageId)).toEqual(['a', 'b', 'c']);
    expect(map.nodes[0].x).toBeLessThan(map.nodes[1].x);
    expect(map.nodes[1].x).toBeLessThan(map.nodes[2].x);
  });

  it('uses stable id tie-break when timestamps are equal', () => {
    const t = isoAt(0);
    const map = buildArgumentTimelineMap({
      messages: [
        msg({ id: 'm2', createdAt: t }),
        msg({ id: 'm1', createdAt: t }),
      ],
      currentUserId: 'me',
    });
    expect(map.nodes.map((n) => n.messageId)).toEqual(['m1', 'm2']);
  });

  it('every posted message becomes exactly one node', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `m${i + 1}`);
    const messages = ids.map((id, i) => msg({ id, createdAt: isoAt(i * 1000) }));
    const map = buildArgumentTimelineMap({ messages, currentUserId: 'me' });
    expect(map.nodes.length).toBe(12);
    expect(new Set(map.nodes.map((n) => n.messageId)).size).toBe(12);
  });

  it('x positions are strictly monotonic by chronological order', () => {
    const messages = Array.from({ length: 20 }, (_, i) => msg({ id: `m${i}`, createdAt: isoAt(i * 1000) }));
    const map = buildArgumentTimelineMap({ messages, currentUserId: 'me' });
    for (let i = 1; i < map.nodes.length; i++) {
      expect(map.nodes[i].x).toBeGreaterThan(map.nodes[i - 1].x);
    }
  });

  it('no duplicate node ids and no duplicate edge ids', () => {
    const messages = [
      msg({ id: 'r', createdAt: isoAt(0), argumentType: 'thesis' }),
      msg({ id: 'a', parentId: 'r', createdAt: isoAt(1000), argumentType: 'rebuttal' }),
      msg({ id: 'b', parentId: 'r', createdAt: isoAt(2000), argumentType: 'rebuttal' }),
      msg({ id: 'c', parentId: 'a', createdAt: isoAt(3000), argumentType: 'counter_rebuttal' }),
    ];
    const map = buildArgumentTimelineMap({ messages, currentUserId: 'me' });
    const nodeIds = map.nodes.map((n) => n.messageId);
    expect(new Set(nodeIds).size).toBe(nodeIds.length);
    const edgeIds = map.edges.map((e) => e.edgeId);
    expect(new Set(edgeIds).size).toBe(edgeIds.length);
  });

  it('node touch area meets the 44px target', () => {
    expect(TIMELINE_NODE_SIZE).toBeGreaterThanOrEqual(44);
  });
});

describe('buildArgumentTimelineMap — edges', () => {
  it('produces parent-child edges for every child whose parent is present', () => {
    const map = buildArgumentTimelineMap({
      messages: [
        msg({ id: 'r', createdAt: isoAt(0), argumentType: 'thesis' }),
        msg({ id: 'a', parentId: 'r', createdAt: isoAt(1000) }),
        msg({ id: 'b', parentId: 'a', createdAt: isoAt(2000) }),
      ],
      currentUserId: 'me',
    });
    expect(map.edges.length).toBe(2);
    expect(map.edges[0].fromMessageId).toBe('r');
    expect(map.edges[0].toMessageId).toBe('a');
    expect(map.edges[1].fromMessageId).toBe('a');
    expect(map.edges[1].toMessageId).toBe('b');
  });

  it('edges carry gradient stops blending parent kind, child kind, standing and tone', () => {
    const map = buildArgumentTimelineMap({
      messages: [
        msg({ id: 'r', createdAt: isoAt(0), argumentType: 'thesis' }),
        msg({ id: 'a', parentId: 'r', createdAt: isoAt(1000), argumentType: 'rebuttal', flagCodes: ['ad_hominem'] }),
      ],
      currentUserId: 'me',
    });
    expect(map.edges[0].gradientStops.length).toBeGreaterThanOrEqual(3);
    // Parent thesis (claim family) is indigo; rebuttal (challenge) is orange.
    expect(map.edges[0].gradientStops[0]).toBe(TIMELINE_KIND_COLORS.claim);
    expect(map.edges[0].gradientStops[map.edges[0].gradientStops.length - 3]).toBe(TIMELINE_KIND_COLORS.challenge);
  });
});

describe('buildArgumentTimelineMap — detached children', () => {
  it('marks missing-parent children as isDetached, does not drop them', () => {
    const map = buildArgumentTimelineMap({
      messages: [
        msg({ id: 'r', createdAt: isoAt(0), argumentType: 'thesis' }),
        msg({ id: 'orphan', parentId: 'missing-parent', createdAt: isoAt(1000) }),
      ],
      currentUserId: 'me',
    });
    expect(map.nodes.length).toBe(2);
    const orphan = map.nodes.find((n) => n.messageId === 'orphan')!;
    expect(orphan.isDetached).toBe(true);
    expect(orphan.accessibilityLabel.toLowerCase()).toContain('detached');
    // No edge for the detached child.
    expect(map.edges.find((e) => e.toMessageId === 'orphan')).toBeUndefined();
  });
});

describe('buildArgumentTimelineMap — active path + latest', () => {
  it('walks parent chain from active node to root', () => {
    const map = buildArgumentTimelineMap({
      messages: [
        msg({ id: 'r', createdAt: isoAt(0), argumentType: 'thesis' }),
        msg({ id: 'a', parentId: 'r', createdAt: isoAt(1000) }),
        msg({ id: 'b', parentId: 'a', createdAt: isoAt(2000) }),
        msg({ id: 'c', parentId: 'b', createdAt: isoAt(3000) }),
      ],
      currentUserId: 'me',
      activeMessageId: 'c',
    });
    expect(map.activePathIds).toEqual(['r', 'a', 'b', 'c']);
    const onPath = map.nodes.filter((n) => n.isActivePath).map((n) => n.messageId).sort();
    expect(onPath).toEqual(['a', 'b', 'c', 'r']);
  });

  it('makes latest message active by default when no active id is provided', () => {
    const map = buildArgumentTimelineMap({
      messages: [
        msg({ id: 'r', createdAt: isoAt(0), argumentType: 'thesis' }),
        msg({ id: 'a', parentId: 'r', createdAt: isoAt(1000) }),
        msg({ id: 'b', parentId: 'a', createdAt: isoAt(2000) }),
      ],
      currentUserId: 'me',
    });
    expect(map.latestMessageId).toBe('b');
    expect(map.activeNode?.messageId).toBe('b');
    expect(map.nodes.find((n) => n.messageId === 'b')?.isActive).toBe(true);
    expect(map.nodes.find((n) => n.messageId === 'b')?.isLatest).toBe(true);
  });
});

describe('buildArgumentTimelineMap — junctions', () => {
  it('flags a parent with 2+ replies as a junction and assigns junctionGroupId', () => {
    const map = buildArgumentTimelineMap({
      messages: [
        msg({ id: 'r', createdAt: isoAt(0), argumentType: 'thesis' }),
        msg({ id: 'a', parentId: 'r', createdAt: isoAt(1000) }),
        msg({ id: 'b', parentId: 'r', createdAt: isoAt(2000) }),
        msg({ id: 'c', parentId: 'r', createdAt: isoAt(3000) }),
      ],
      currentUserId: 'me',
    });
    const root = map.nodes.find((n) => n.messageId === 'r')!;
    expect(root.isJunction).toBe(true);
    expect(root.junctionChildCount).toBe(3);
    expect(root.junctionGroupId).toBe('junction-r');
  });

  it('non-branching parents are not flagged as junctions', () => {
    const map = buildArgumentTimelineMap({
      messages: [
        msg({ id: 'r', createdAt: isoAt(0) }),
        msg({ id: 'a', parentId: 'r', createdAt: isoAt(1000) }),
      ],
      currentUserId: 'me',
    });
    const root = map.nodes.find((n) => n.messageId === 'r')!;
    expect(root.isJunction).toBe(false);
    expect(root.junctionGroupId).toBeNull();
  });
});

describe('buildArgumentTimelineMap — lanes + layout determinism', () => {
  it('roots stay on the center rail (lane 0)', () => {
    const map = buildArgumentTimelineMap({
      messages: [
        msg({ id: 'r1', createdAt: isoAt(0), argumentType: 'thesis' }),
        msg({ id: 'r2', createdAt: isoAt(1000), argumentType: 'thesis' }),
      ],
      currentUserId: 'me',
    });
    for (const n of map.nodes) expect(n.lane).toBe(0);
  });

  it('first child stays on the parent rail; additional siblings branch above/below (horizontal-first)', () => {
    const map = buildArgumentTimelineMap({
      messages: [
        msg({ id: 'r', createdAt: isoAt(0), argumentType: 'thesis' }),
        msg({ id: 'a', parentId: 'r', createdAt: isoAt(1000) }),
        msg({ id: 'b', parentId: 'r', createdAt: isoAt(2000) }),
        msg({ id: 'c', parentId: 'r', createdAt: isoAt(3000) }),
      ],
      currentUserId: 'me',
    });
    // Stage 6.3: first sibling continues the chain on the parent's lane (0),
    // additional siblings branch off — odd index above, even index below.
    expect(map.nodes.find((n) => n.messageId === 'a')!.lane).toBe(0);
    expect(map.nodes.find((n) => n.messageId === 'b')!.lane).toBe(-1);
    expect(map.nodes.find((n) => n.messageId === 'c')!.lane).toBe(1);
  });

  it('lane assignment is deterministic across repeated builds', () => {
    const input = {
      messages: [
        msg({ id: 'r', createdAt: isoAt(0), argumentType: 'thesis' }),
        msg({ id: 'a', parentId: 'r', createdAt: isoAt(1000) }),
        msg({ id: 'b', parentId: 'r', createdAt: isoAt(2000) }),
        msg({ id: 'c', parentId: 'a', createdAt: isoAt(3000) }),
        msg({ id: 'd', parentId: 'a', createdAt: isoAt(4000) }),
      ],
      currentUserId: 'me',
    };
    const map1 = buildArgumentTimelineMap(input);
    const map2 = buildArgumentTimelineMap(input);
    expect(map1.nodes.map((n) => `${n.messageId}:${n.lane}:${n.x}:${n.y}`)).toEqual(
      map2.nodes.map((n) => `${n.messageId}:${n.lane}:${n.x}:${n.y}`),
    );
  });
});

describe('buildArgumentTimelineMap — dropped tags + badges', () => {
  it('maps known tag codes to colored display chips', () => {
    const map = buildArgumentTimelineMap({
      messages: [
        msg({
          id: 'r', createdAt: isoAt(0), argumentType: 'rebuttal',
          tagCodes: ['evidence_challenge', 'source_request', 'unknown_tag_code'],
        }),
      ],
      currentUserId: 'me',
    });
    const tags = map.nodes[0].droppedTags;
    expect(tags.length).toBe(3);
    expect(tags[0].label).toBe('Evidence');
    expect(tags[0].color).toBe('#06b6d4');
    expect(tags[1].label).toBe('Source?');
    expect(tags[2].code).toBe('unknown_tag_code');
  });
});

describe('inferStandingBand — bands + tone/temperature', () => {
  it('returns not_enough_signal when no flags and no signals', () => {
    expect(inferStandingBand({})).toBe('not_enough_signal');
  });

  it('returns pretty_wrong on hard-negative flags (off_topic)', () => {
    expect(inferStandingBand({ flagCodes: ['off_topic'] })).toBe('pretty_wrong');
  });

  it('pure evidence + has-evidence with no negatives → pretty_right', () => {
    expect(inferStandingBand({ argumentType: 'evidence', hasEvidence: true })).toBe('pretty_right');
  });

  it('positive substance + heated tone → maybe_right_misguided', () => {
    expect(inferStandingBand({
      argumentType: 'evidence', hasEvidence: true, flagCodes: ['ad_hominem'],
    })).toBe('maybe_right_misguided');
  });

  it('inferToneBand + inferTemperatureBand never throw on missing input', () => {
    expect(() => inferToneBand(undefined)).not.toThrow();
    expect(() => inferTemperatureBand(undefined)).not.toThrow();
    expect(inferToneBand([])).toBe('unknown');
    expect(inferTemperatureBand([])).toBe('unknown');
    expect(inferToneBand(['ad_hominem'])).toBe('hostile');
    expect(inferTemperatureBand(['ad_hominem'])).toBe('hot');
  });
});

describe('buildArgumentTimelineMap — bands', () => {
  it('builds an Opening band for the first 1-3 nodes', () => {
    const map = buildArgumentTimelineMap({
      messages: [
        msg({ id: 'r', createdAt: isoAt(0), argumentType: 'thesis' }),
        msg({ id: 'a', parentId: 'r', createdAt: isoAt(1000) }),
      ],
      currentUserId: 'me',
    });
    expect(map.bands.find((b) => b.label === 'Opening')).toBeTruthy();
  });

  it('detects an Evidence run when 2+ contiguous evidence nodes exist', () => {
    const map = buildArgumentTimelineMap({
      messages: [
        msg({ id: 'r', createdAt: isoAt(0), argumentType: 'thesis' }),
        msg({ id: 'a', parentId: 'r', createdAt: isoAt(1000), argumentType: 'rebuttal' }),
        msg({ id: 'b', parentId: 'a', createdAt: isoAt(2000), argumentType: 'evidence' }),
        msg({ id: 'c', parentId: 'b', createdAt: isoAt(3000), argumentType: 'evidence' }),
      ],
      currentUserId: 'me',
    });
    expect(map.bands.find((b) => b.label === 'Evidence run')).toBeTruthy();
  });

  it('detects a Hot zone for 2+ contiguous heated/hostile or wrong nodes', () => {
    const map = buildArgumentTimelineMap({
      messages: [
        msg({ id: 'r', createdAt: isoAt(0), argumentType: 'thesis' }),
        msg({ id: 'a', parentId: 'r', createdAt: isoAt(1000), argumentType: 'rebuttal', flagCodes: ['ad_hominem'] }),
        msg({ id: 'b', parentId: 'a', createdAt: isoAt(2000), argumentType: 'rebuttal', flagCodes: ['civility_risk'] }),
        msg({ id: 'c', parentId: 'b', createdAt: isoAt(3000), argumentType: 'claim' }),
      ],
      currentUserId: 'me',
    });
    expect(map.bands.find((b) => b.label === 'Hot zone')).toBeTruthy();
  });
});

describe('buildArgumentTimelineMap — 250+ stress fixture', () => {
  function buildStressFixture(): ArgumentTimelineMapMessageInput[] {
    const out: ArgumentTimelineMapMessageInput[] = [];
    // Root
    out.push(msg({ id: 'root', createdAt: isoAt(0), argumentType: 'thesis' }));
    // 50 first-level rebuttals.
    for (let i = 0; i < 50; i++) {
      out.push(msg({
        id: `L1-${i}`, parentId: 'root',
        createdAt: isoAt(1000 * (i + 1)),
        argumentType: i % 3 === 0 ? 'rebuttal' : 'claim',
        authorId: `user-${i % 5}`,
      }));
    }
    // 50 second-level moves under L1-0.
    for (let i = 0; i < 50; i++) {
      out.push(msg({
        id: `L2-${i}`, parentId: 'L1-0',
        createdAt: isoAt(1000 * (60 + i)),
        argumentType: i % 4 === 0 ? 'evidence' : 'counter_rebuttal',
        flagCodes: i % 10 === 0 ? ['ad_hominem'] : [],
        hasEvidence: i % 4 === 0,
      }));
    }
    // 100 third-level moves under L2-0.
    for (let i = 0; i < 100; i++) {
      out.push(msg({
        id: `L3-${i}`, parentId: 'L2-0',
        createdAt: isoAt(1000 * (120 + i)),
        argumentType: 'claim',
      }));
    }
    // 50 orphaned (detached) replies.
    for (let i = 0; i < 50; i++) {
      out.push(msg({
        id: `orphan-${i}`, parentId: `missing-${i}`,
        createdAt: isoAt(1000 * (250 + i)),
        argumentType: 'claim',
      }));
    }
    return out;
  }

  let map: ArgumentTimelineMapModel;
  beforeAll(() => {
    map = buildArgumentTimelineMap({ messages: buildStressFixture(), currentUserId: 'me' });
  });

  it('produces a stable node count for 250+ messages', () => {
    expect(map.nodes.length).toBe(251);
  });

  it('contains 50 detached nodes', () => {
    expect(map.nodes.filter((n) => n.isDetached).length).toBe(50);
  });

  it('no duplicate node or edge ids in a 250+ fixture', () => {
    expect(new Set(map.nodes.map((n) => n.messageId)).size).toBe(map.nodes.length);
    expect(new Set(map.edges.map((e) => e.edgeId)).size).toBe(map.edges.length);
  });

  it('x positions remain strictly monotonic in a 250+ fixture', () => {
    for (let i = 1; i < map.nodes.length; i++) {
      expect(map.nodes[i].x).toBeGreaterThan(map.nodes[i - 1].x);
    }
  });

  it('participant trends derived deterministically', () => {
    expect(map.participantTrends.length).toBeGreaterThan(0);
    for (const t of map.participantTrends) {
      expect(typeof t.averageScore).toBe('number');
      expect(t.sparkline.length).toBeGreaterThan(0);
      expect(t.sparkline.length).toBeLessThanOrEqual(12);
    }
  });
});

describe('timelineMapPrevId / timelineMapNextId', () => {
  let map: ArgumentTimelineMapModel;
  beforeAll(() => {
    map = buildArgumentTimelineMap({
      messages: [
        msg({ id: 'a', createdAt: isoAt(0) }),
        msg({ id: 'b', createdAt: isoAt(1000), parentId: 'a' }),
        msg({ id: 'c', createdAt: isoAt(2000), parentId: 'b' }),
      ],
      currentUserId: 'me',
    });
  });

  it('prev from middle returns previous chronological id', () => {
    expect(timelineMapPrevId(map, 'b')).toBe('a');
    expect(timelineMapPrevId(map, 'a')).toBeNull();
  });

  it('next from middle returns next chronological id', () => {
    expect(timelineMapNextId(map, 'a')).toBe('b');
    expect(timelineMapNextId(map, 'c')).toBeNull();
  });

  it('with null current → prev returns latest, next returns earliest', () => {
    expect(timelineMapPrevId(map, null)).toBe('c');
    expect(timelineMapNextId(map, null)).toBe('a');
  });
});

describe('mixHex', () => {
  it('returns the start color at t=0', () => {
    expect(mixHex('#ff0000', '#0000ff', 0)).toBe('#ff0000');
  });
  it('returns the end color at t=1', () => {
    expect(mixHex('#ff0000', '#0000ff', 1)).toBe('#0000ff');
  });
  it('returns a midpoint color at t=0.5', () => {
    const mid = mixHex('#ff0000', '#0000ff', 0.5);
    expect(mid.length).toBe(7);
    expect(mid[0]).toBe('#');
  });
});

// ── IX-002 — TimelineMiniMap wiring inside ArgumentTimelineMap ──

describe('IX-002 — ArgumentTimelineMap wires the mini-map overview', () => {
  const HOST_SRC = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'features', 'arguments', 'ArgumentTimelineMap.tsx'),
    'utf8',
  );

  it('imports TimelineMiniMap + the mini-map model builders', () => {
    expect(HOST_SRC).toContain("from './TimelineMiniMap'");
    expect(HOST_SRC).toContain('buildTimelineMiniMapModel');
    expect(HOST_SRC).toContain('buildViewportWindow');
  });

  it('builds the mini-map model via useMemo from the map + collapseState', () => {
    expect(HOST_SRC).toMatch(/buildTimelineMiniMapModel\(\{\s*timelineMap:\s*map/);
    expect(HOST_SRC).toContain('collapseState');
  });

  it('builds the viewport window from the already-tracked scrollX + viewportWidth', () => {
    expect(HOST_SRC).toMatch(/buildViewportWindow\(\{/);
    expect(HOST_SRC).toContain('scrollWidth: map.scrollWidth');
  });

  it('renders <TimelineMiniMap> above the onboarding banner', () => {
    const miniIdx = HOST_SRC.indexOf('<TimelineMiniMap');
    const bannerIdx = HOST_SRC.indexOf('timeline-root-onboarding');
    expect(miniIdx).toBeGreaterThan(0);
    expect(bannerIdx).toBeGreaterThan(0);
    expect(miniIdx).toBeLessThan(bannerIdx);
  });

  it('routes every mini-map jump through the existing onActivate channel (no route transition)', () => {
    // handleMiniMapJump calls onActivate — proves there is no navigation /
    // route push; the mini-map only uses in-component callbacks.
    expect(HOST_SRC).toContain('handleMiniMapJump');
    expect(HOST_SRC).toMatch(/handleMiniMapJump[\s\S]{0,400}onActivate\(req\.messageId\)/);
    // No router / navigation / Linking is introduced for the jump.
    expect(HOST_SRC.includes('Linking')).toBe(false);
    expect(HOST_SRC.includes('navigation.navigate')).toBe(false);
  });

  it('routes a mini-map jump through the imperative scrollRef scroll', () => {
    expect(HOST_SRC).toMatch(/handleMiniMapJump[\s\S]{0,600}scrollRef\.current\.scrollTo/);
  });

  it("a branch jump into a collapsed branch toggles collapseState (expand-first)", () => {
    expect(HOST_SRC).toMatch(/req\.kind\s*===\s*'branch'/);
    expect(HOST_SRC).toMatch(/handleMiniMapJump[\s\S]{0,400}toggleBranchCollapse/);
  });

  it('passes the effective reduce-motion preference to the mini-map', () => {
    expect(HOST_SRC).toMatch(/<TimelineMiniMap[\s\S]{0,400}reduceMotion=\{effectiveReducedMotion\}/);
  });

  it('does not add a new prop to the ArgumentTimelineMap Props interface for the mini-map', () => {
    // The mini-map is internal chrome — the room shell needs zero changes.
    expect(HOST_SRC.includes('miniMap?:')).toBe(false);
    expect(HOST_SRC.includes('onMiniMapJump')).toBe(false);
  });
});

describe('IX-002 — mini-map availability gates on debate length', () => {
  function chain(n: number): ArgumentTimelineMapModel {
    const messages: ArgumentTimelineMapMessageInput[] = [];
    for (let i = 0; i < n; i++) {
      messages.push(
        msg({
          id: `m${i}`,
          parentId: i === 0 ? null : `m${i - 1}`,
          createdAt: isoAt(i * 1000),
          argumentType: i === 0 ? 'thesis' : 'claim',
        }),
      );
    }
    return buildArgumentTimelineMap({ messages, currentUserId: 'me' });
  }

  it('a 12+-move map yields an available mini-map model', () => {
    expect(buildTimelineMiniMapModel({ timelineMap: chain(12) }).isAvailable).toBe(true);
  });

  it('a 5-move map yields an unavailable mini-map model (component renders nothing)', () => {
    expect(buildTimelineMiniMapModel({ timelineMap: chain(5) }).isAvailable).toBe(false);
  });
});
