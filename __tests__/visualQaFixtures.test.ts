/**
 * AN-002 — Visual QA snapshot fixtures tests.
 *
 * Pure-model tests for `src/features/analytics/visualQaFixtures.ts`. No
 * React, no Supabase, no network. Each fixture is run through
 * `buildArgumentTimelineMap` (and, for a small cross-check subset,
 * `buildPointLifecycleMap`) and asserted against the structural
 * invariant the design table promises.
 */
import fs from 'fs';
import path from 'path';

import {
  buildArgumentTimelineMap,
  type ArgumentTimelineMapModel,
} from '../src/features/arguments/argumentGameSurfaceModel';
import { buildPointLifecycleMap } from '../src/features/lifecycle';
import type { EvidenceArtifact } from '../src/features/evidence/evidenceModel';
import {
  ALL_VISUAL_QA_FIXTURE_IDS,
  AVATAR_PROFILE_DISPLAY_CURRENT_USER_ID,
  VISUAL_QA_FIXTURES,
  buildAvatarProfileDisplayFixture,
  buildSynthesisPathFixture,
  getVisualQaFixture,
  type VisualQaFixtureId,
} from '../src/features/analytics/visualQaFixtures';

const QA_REVIEWER = 'qa-reviewer';

/** Build the timeline map for a fixture id with a fixed reviewer user. */
function mapFor(id: VisualQaFixtureId, currentUserId = QA_REVIEWER): ArgumentTimelineMapModel {
  const fixture = getVisualQaFixture(id);
  if (!fixture) throw new Error(`unknown fixture ${id}`);
  return buildArgumentTimelineMap({ messages: fixture.build(), currentUserId });
}

/** Doctrine ban-list — verdict / truth / popularity tokens. */
const BANNED_TOKENS = [
  'winner',
  'loser',
  'correct',
  'incorrect',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'troll',
  'likes',
  'retweets',
  'views',
  'followers',
  'viral',
  'trending',
  'engagement',
];

/** Whole-word ban-list scan; returns the first banned token found, or null. */
function findBannedToken(text: string): string | null {
  const lower = String(text || '').toLowerCase();
  for (const token of BANNED_TOKENS) {
    const pattern = new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
    if (pattern.test(lower)) return token;
  }
  return null;
}

// ── Registry + builder-shape tests ─────────────────────────────

describe('visualQaFixtures — registry + builder shape', () => {
  it('VISUAL_QA_FIXTURES has exactly 8 descriptors', () => {
    expect(VISUAL_QA_FIXTURES.length).toBe(8);
  });

  it('every VisualQaFixtureId appears exactly once in the registry', () => {
    const ids = VISUAL_QA_FIXTURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(8);
    for (const id of ALL_VISUAL_QA_FIXTURE_IDS) {
      expect(ids.filter((x) => x === id).length).toBe(1);
    }
  });

  it('every descriptor exposes a build function whose id matches', () => {
    for (const fixture of VISUAL_QA_FIXTURES) {
      expect(typeof fixture.build).toBe('function');
      expect(typeof fixture.id).toBe('string');
      expect(typeof fixture.title).toBe('string');
      expect(typeof fixture.summary).toBe('string');
      expect(typeof fixture.structuralInvariant).toBe('string');
      expect(getVisualQaFixture(fixture.id)).toBe(fixture);
    }
  });

  it('getVisualQaFixture returns a descriptor for each known id and null for an unknown id', () => {
    for (const id of ALL_VISUAL_QA_FIXTURE_IDS) {
      expect(getVisualQaFixture(id)?.id).toBe(id);
    }
    expect(getVisualQaFixture('bogus')).toBeNull();
    expect(getVisualQaFixture('')).toBeNull();
  });

  it('every builder returns a non-empty array', () => {
    for (const fixture of VISUAL_QA_FIXTURES) {
      expect(fixture.build().length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every builder is deterministic — build() deep-equals build()', () => {
    for (const fixture of VISUAL_QA_FIXTURES) {
      expect(fixture.build()).toEqual(fixture.build());
    }
  });

  it('every builder returns a fresh array (mutating one call does not affect the next)', () => {
    for (const fixture of VISUAL_QA_FIXTURES) {
      const first = fixture.build();
      first.push(first[0]);
      expect(fixture.build().length).toBe(first.length - 1);
    }
  });

  it('node ids are unique within every fixture', () => {
    for (const fixture of VISUAL_QA_FIXTURES) {
      const ids = fixture.build().map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('no fixture node resolves to the default color family', () => {
    for (const id of ALL_VISUAL_QA_FIXTURE_IDS) {
      const map = mapFor(id);
      for (const node of map.nodes) {
        expect(node.kindColorFamily).not.toBe('default');
      }
    }
  });
});

// ── Per-fixture structural-invariant tests ─────────────────────

describe('no_rebuttal fixture', () => {
  it('builds a single root node with no rebuttal and no edges', () => {
    const map = mapFor('no_rebuttal');
    expect(map.nodes.length).toBe(1);
    expect(map.nodes[0].isRoot).toBe(true);
    expect(map.hasRebuttal).toBe(false);
    expect(map.firstRebuttalMessageId).toBeNull();
    expect(map.edges.length).toBe(0);
  });

  it('surfaces a root onboarding hint', () => {
    const map = mapFor('no_rebuttal');
    expect(map.rootOnboardingHint).not.toBeNull();
    expect(typeof map.rootOnboardingHint).toBe('string');
  });
});

describe('straight_chain_10 fixture', () => {
  it('builds a 10-node chain with deepest depth 9 and nine edges', () => {
    const map = mapFor('straight_chain_10');
    expect(map.nodes.length).toBe(10);
    const deepest = map.nodes.reduce((m, n) => Math.max(m, n.depth), 0);
    expect(deepest).toBe(9);
    expect(map.edges.length).toBe(9);
  });

  it('keeps every node on lane 0 with no junctions', () => {
    const map = mapFor('straight_chain_10');
    for (const node of map.nodes) {
      expect(node.lane).toBe(0);
      expect(node.isJunction).toBe(false);
    }
  });
});

describe('source_chain_fight fixture', () => {
  it('has at least two clarify-family nodes carrying a source-request dropped tag', () => {
    const map = mapFor('source_chain_fight');
    expect(map.nodes.length).toBeGreaterThanOrEqual(5);
    const sourceAsks = map.nodes.filter(
      (n) =>
        n.kindColorFamily === 'clarify' &&
        n.droppedTags.some((t) => t.code === 'source_request'),
    );
    expect(sourceAsks.length).toBeGreaterThanOrEqual(2);
  });

  it('has an evidence-family node and no concession or synthesis node', () => {
    const map = mapFor('source_chain_fight');
    expect(map.nodes.some((n) => n.kindColorFamily === 'evidence')).toBe(true);
    expect(map.nodes.some((n) => n.kindColorFamily === 'concede')).toBe(false);
  });
});

describe('evidence_heavy_branch fixture', () => {
  it('has three or more evidence-family nodes and an Evidence run band', () => {
    const map = mapFor('evidence_heavy_branch');
    expect(map.nodes.length).toBeGreaterThanOrEqual(6);
    const evidenceNodes = map.nodes.filter((n) => n.kindColorFamily === 'evidence');
    expect(evidenceNodes.length).toBeGreaterThanOrEqual(3);
    expect(map.bands.some((b) => b.label === 'Evidence run')).toBe(true);
  });

  it('has at least one node on a non-zero lane (a real branch)', () => {
    const map = mapFor('evidence_heavy_branch');
    expect(map.nodes.some((n) => n.lane !== 0)).toBe(true);
  });
});

describe('tangent_kink_branch fixture', () => {
  it('has exactly one junction node with two or more children and an off-rail lane', () => {
    const map = mapFor('tangent_kink_branch');
    expect(map.nodes.length).toBeGreaterThanOrEqual(7);
    const junctions = map.nodes.filter((n) => n.isJunction);
    expect(junctions.length).toBe(1);
    expect(junctions[0].junctionChildCount).toBeGreaterThanOrEqual(2);
    expect(map.nodes.some((n) => n.lane !== 0)).toBe(true);
  });

  it('has exactly one detached node whose accessibility label says "detached"', () => {
    const map = mapFor('tangent_kink_branch');
    const detached = map.nodes.filter((n) => n.isDetached);
    expect(detached.length).toBe(1);
    expect(detached[0].accessibilityLabel.toLowerCase()).toContain('detached');
  });
});

describe('synthesis_path fixture', () => {
  it('has at least one concession-family node', () => {
    const map = mapFor('synthesis_path');
    expect(map.nodes.length).toBeGreaterThanOrEqual(5);
    const concedeFamily = map.nodes.filter((n) => n.kindColorFamily === 'concede');
    expect(concedeFamily.length).toBeGreaterThanOrEqual(1);
  });

  it('has exactly one synthesis node and it is chronologically last', () => {
    const messages = buildSynthesisPathFixture();
    const synthesisInputs = messages.filter((m) => m.argumentType === 'synthesis');
    expect(synthesisInputs.length).toBe(1);
    const map = mapFor('synthesis_path');
    const last = map.nodes[map.nodes.length - 1];
    expect(last.messageId).toBe(synthesisInputs[0].id);
    expect(last.kindColorFamily).toBe('concede');
  });
});

describe('stress_board_250 fixture', () => {
  let map: ArgumentTimelineMapModel;
  beforeAll(() => {
    map = mapFor('stress_board_250');
  });

  it('builds 251 nodes with 50 detached', () => {
    expect(map.nodes.length).toBe(251);
    expect(map.nodes.filter((n) => n.isDetached).length).toBe(50);
  });

  it('has no duplicate node or edge ids and strictly monotonic x positions', () => {
    expect(new Set(map.nodes.map((n) => n.messageId)).size).toBe(map.nodes.length);
    expect(new Set(map.edges.map((e) => e.edgeId)).size).toBe(map.edges.length);
    for (let i = 1; i < map.nodes.length; i++) {
      expect(map.nodes[i].x).toBeGreaterThan(map.nodes[i - 1].x);
    }
  });
});

describe('avatar_profile_display fixture', () => {
  it('has four or more nodes from three or more distinct authors', () => {
    const messages = buildAvatarProfileDisplayFixture();
    expect(messages.length).toBeGreaterThanOrEqual(4);
    const authors = new Set(messages.map((m) => m.authorId));
    expect(authors.size).toBeGreaterThanOrEqual(3);
  });

  it('produces three or more participant-trend rows', () => {
    const map = mapFor('avatar_profile_display', AVATAR_PROFILE_DISPLAY_CURRENT_USER_ID);
    expect(map.participantTrends.length).toBeGreaterThanOrEqual(3);
  });

  it('renders one node as "You" and one node with a bot actor label', () => {
    const map = mapFor('avatar_profile_display', AVATAR_PROFILE_DISPLAY_CURRENT_USER_ID);
    expect(map.nodes.some((n) => n.actorLabel === 'You')).toBe(true);
    expect(map.nodes.some((n) => n.actorLabel === 'Bot')).toBe(true);
  });
});

// ── Lifecycle cross-check tests (LIFE-001) ─────────────────────
//
// A bonus cross-check that the fixtures are usable by the OTHER analytics
// consumers, not just the timeline map. `buildPointLifecycleMap` accepts
// `{ timelineMap, artifactsByMessageId }`; AN-002 fixtures satisfy this
// directly — `artifactsByMessageId` is simply an empty Map for fixtures
// that carry no attached artifacts. These tests are kept (the LIFE-001
// input contract is satisfiable from the fixtures; see design §R4).

describe('visualQaFixtures — LIFE-001 lifecycle cross-check', () => {
  const noArtifacts: ReadonlyMap<string, ReadonlyArray<EvidenceArtifact>> = new Map();

  it('synthesis_path produces a lifecycle map with a resolved-family cluster state', () => {
    const timelineMap = mapFor('synthesis_path');
    const lifecycle = buildPointLifecycleMap({
      timelineMap,
      artifactsByMessageId: noArtifacts,
    });
    const states = Array.from(lifecycle.byCluster.values()).map((c) => c.state);
    expect(states.length).toBeGreaterThanOrEqual(1);
    const resolvedFamily = new Set([
      'narrowed',
      'conceded',
      'synthesis_ready',
      'archived_or_resolved',
      'confirmed',
    ]);
    expect(states.some((s) => resolvedFamily.has(s))).toBe(true);
  });

  it('source_chain_fight produces a lifecycle map with at least one cluster', () => {
    const timelineMap = mapFor('source_chain_fight');
    const lifecycle = buildPointLifecycleMap({
      timelineMap,
      artifactsByMessageId: noArtifacts,
    });
    expect(lifecycle.byCluster.size).toBeGreaterThanOrEqual(1);
    expect(lifecycle.byMessage.size).toBe(timelineMap.nodes.length);
  });

  it('no_rebuttal produces exactly one cluster in an open state', () => {
    const timelineMap = mapFor('no_rebuttal');
    const lifecycle = buildPointLifecycleMap({
      timelineMap,
      artifactsByMessageId: noArtifacts,
    });
    expect(lifecycle.byCluster.size).toBe(1);
    const only = Array.from(lifecycle.byCluster.values())[0];
    expect(only.state).toBe('open');
  });
});

// ── Doctrine ban-list tests ────────────────────────────────────

describe('visualQaFixtures — doctrine ban-list', () => {
  it('no fixture message body, qualifier, flag, or tag uses a banned token', () => {
    for (const fixture of VISUAL_QA_FIXTURES) {
      for (const m of fixture.build()) {
        const fields = [
          m.body,
          ...(m.qualifierLabels ?? []),
          ...(m.flagCodes ?? []),
          ...(m.tagCodes ?? []),
        ];
        for (const field of fields) {
          const hit = findBannedToken(field);
          expect(hit ? `${fixture.id}: ${hit}` : null).toBeNull();
        }
      }
    }
  });

  it('no descriptor title, summary, or structuralInvariant uses a banned token', () => {
    for (const fixture of VISUAL_QA_FIXTURES) {
      for (const field of [fixture.title, fixture.summary, fixture.structuralInvariant]) {
        const hit = findBannedToken(field);
        expect(hit ? `${fixture.id}: ${hit}` : null).toBeNull();
      }
    }
  });

  it('no rendered timeline label uses a banned token', () => {
    for (const id of ALL_VISUAL_QA_FIXTURE_IDS) {
      const map = mapFor(id);
      const labels: string[] = [];
      for (const node of map.nodes) {
        labels.push(node.kindLabel, node.accessibilityLabel, node.bodyPreview);
      }
      for (const band of map.bands) labels.push(band.label);
      for (const label of labels) {
        const hit = findBannedToken(label);
        expect(hit ? `${id}: ${hit}` : null).toBeNull();
      }
    }
  });
});

// ── Doc / structural-isolation tests ───────────────────────────

describe('visualQaFixtures — doc + isolation', () => {
  it('docs/visual-qa-snapshots.md references every fixture id', () => {
    const docPath = path.join(__dirname, '..', 'docs', 'visual-qa-snapshots.md');
    const doc = fs.readFileSync(docPath, 'utf8');
    for (const id of ALL_VISUAL_QA_FIXTURE_IDS) {
      expect(doc).toContain(id);
    }
  });

  it('no file under app/ imports visualQaFixtures (dev/QA-only isolation)', () => {
    const appDir = path.join(__dirname, '..', 'app');
    if (!fs.existsSync(appDir)) {
      // No app/ directory yet — isolation holds vacuously.
      expect(true).toBe(true);
      return;
    }
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          const content = fs.readFileSync(full, 'utf8');
          if (content.includes('visualQaFixtures')) offenders.push(full);
        }
      }
    };
    walk(appDir);
    expect(offenders).toEqual([]);
  });
});
