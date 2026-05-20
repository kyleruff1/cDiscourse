/**
 * AN-002 — Visual QA snapshot fixtures (pure TypeScript).
 *
 * Dev / QA-only. A deterministic library of 8 named argument-timeline
 * fixtures used as a stable visual review surface: when the timeline
 * renderer changes (Epic 2 visual grammar, Epic 3 branches, Epic 7
 * strength bands), QA has a fixed set of named scenes to eyeball for
 * regressions, and `__tests__/visualQaFixtures.test.ts` guarantees each
 * fixture still builds into the shape its name promises.
 *
 * Each builder returns the INPUT array (`ArgumentTimelineMapMessageInput[]`),
 * NOT a built map — so a test, the checklist doc, and any future dev
 * harness can each call `buildArgumentTimelineMap` (and
 * `buildPointLifecycleMap`) on the same deterministic input.
 *
 * NEVER:
 *   - imported by `app/` or any production screen / component. This is
 *     dev/QA tooling only; `__tests__/visualQaFixtures.test.ts` asserts
 *     no `app/**` file imports this module.
 *   - calls AI (Anthropic, xAI, OpenAI, X), Supabase, or the network.
 *   - uses `Date.now()` / `Math.random()` — every builder is total and
 *     deterministic; timestamps come from the fixed `isoAt` epoch anchor.
 *   - encodes popularity / engagement signal (likes, views, retweets,
 *     followers, virality) — the timeline input type has no such field
 *     and a ban-list test scans for the words anyway.
 *   - uses verdict / truth tokens (winner / loser / correct / true /
 *     false / liar / dishonest / bad faith) in any body, label, or
 *     descriptor. Fixture content uses neutral, low-stakes topics.
 *
 * The only runtime import is the TYPE `ArgumentTimelineMapMessageInput`.
 * AN-002 introduces no new product model — only the fixture-registry
 * descriptors below.
 */

import type { ArgumentTimelineMapMessageInput }
  from '../arguments/argumentGameSurfaceModel';

// ── Deterministic time anchor ──────────────────────────────────

/**
 * Fixed epoch anchor — identical to the one `argumentTimelineMap.test.ts`
 * uses (`1715000000000`), so fixture timestamps are consistent across the
 * repo. NEVER `Date.now()`.
 */
const EPOCH_ANCHOR_MS = 1715000000000;

/** Deterministic ISO timestamp at a fixed offset from the epoch anchor. */
function isoAt(offsetMs: number): string {
  return new Date(EPOCH_ANCHOR_MS + offsetMs).toISOString();
}

// ── Private message factory ────────────────────────────────────

/**
 * Builds a single `ArgumentTimelineMapMessageInput` from a partial,
 * filling neutral, verdict-free defaults. Mirrors the proven `msg(...)`
 * helper in `argumentTimelineMap.test.ts`.
 */
function msg(
  partial: Partial<ArgumentTimelineMapMessageInput> & { id: string },
): ArgumentTimelineMapMessageInput {
  const createdAt = partial.createdAt ?? isoAt(0);
  return {
    id: partial.id,
    debateId: partial.debateId ?? 'qa-debate',
    parentId: partial.parentId ?? null,
    authorId: partial.authorId ?? 'qa-author-a',
    argumentType: partial.argumentType ?? 'claim',
    side: partial.side ?? 'affirmative',
    body: partial.body ?? 'A plain claim about the topic.',
    status: partial.status ?? 'posted',
    createdAt,
    updatedAt: partial.updatedAt ?? createdAt,
    isBot: partial.isBot ?? false,
    qualifierLabels: partial.qualifierLabels ?? [],
    flagCodes: partial.flagCodes ?? [],
    tagCodes: partial.tagCodes ?? [],
    topicScore: partial.topicScore ?? null,
    hasEvidence: partial.hasEvidence ?? false,
  };
}

// ── Fixture registry types ─────────────────────────────────────

/** Stable identifier for one of the 8 visual-QA fixtures. */
export type VisualQaFixtureId =
  | 'no_rebuttal'
  | 'straight_chain_10'
  | 'source_chain_fight'
  | 'evidence_heavy_branch'
  | 'tangent_kink_branch'
  | 'synthesis_path'
  | 'stress_board_250'
  | 'avatar_profile_display';

/** Every fixture id, in canonical (checklist-walk) order. */
export const ALL_VISUAL_QA_FIXTURE_IDS: ReadonlyArray<VisualQaFixtureId> =
  Object.freeze([
    'no_rebuttal',
    'straight_chain_10',
    'source_chain_fight',
    'evidence_heavy_branch',
    'tangent_kink_branch',
    'synthesis_path',
    'stress_board_250',
    'avatar_profile_display',
  ]);

/** What a reviewer is meant to verify visually — the bridge to the checklist doc. */
export interface VisualQaFixtureDescriptor {
  /** Stable id; matches the builder export name's snake_case form. */
  id: VisualQaFixtureId;
  /** Human title used as the checklist section header. No verdict tokens. */
  title: string;
  /** One-paragraph plain-language description of the scene. No verdict tokens. */
  summary: string;
  /**
   * The structural invariant the fixture guarantees, stated so a model
   * test and a human reviewer agree.
   */
  structuralInvariant: string;
  /** The deterministic builder. Pure; returns a fresh array every call. */
  build: () => ArgumentTimelineMapMessageInput[];
}

/**
 * The `currentUserId` callers should pass to `buildArgumentTimelineMap`
 * for fixture 8, so "you" resolves to a real author in that fixture.
 */
export const AVATAR_PROFILE_DISPLAY_CURRENT_USER_ID = 'qa-author-self';

// ── Fixture 1 — no rebuttal ────────────────────────────────────

/**
 * A single root `thesis` and nothing else — the "empty room, opening
 * move only" case.
 */
export function buildNoRebuttalFixture(): ArgumentTimelineMapMessageInput[] {
  return [
    msg({
      id: 'root',
      argumentType: 'thesis',
      createdAt: isoAt(0),
      body: 'Our town should add a protected bike lane on Main Street.',
    }),
  ];
}

// ── Fixture 2 — straight 10-move chain ─────────────────────────

/**
 * A 10-move linear chain: root + 9 single-child replies, no branching.
 * Every node continues on lane 0 (first-child-continues-the-rail rule).
 */
export function buildStraightChain10Fixture(): ArgumentTimelineMapMessageInput[] {
  const out: ArgumentTimelineMapMessageInput[] = [
    msg({
      id: 'm1',
      argumentType: 'thesis',
      createdAt: isoAt(0),
      body: 'Remote work should be the default for our knowledge teams.',
    }),
  ];
  const chainBodies = [
    'Office time still matters for onboarding new teammates.',
    'Onboarding can run as scheduled remote pairing instead.',
    'Some teammates have no quiet space to work from home.',
    'A stipend for a co-working desk covers that case.',
    'Co-working desks add cost the budget has not planned for.',
    'The office lease we drop covers the desk stipend.',
    'The lease also covers shared lab equipment, not just desks.',
    'Lab equipment can stay in one small retained suite.',
    'A retained suite still needs a schedule so it is not double-booked.',
  ];
  let parentId = 'm1';
  for (let i = 0; i < chainBodies.length; i++) {
    const id = `m${i + 2}`;
    out.push(
      msg({
        id,
        parentId,
        argumentType: i % 2 === 0 ? 'rebuttal' : 'counter_rebuttal',
        createdAt: isoAt(1000 * (i + 1)),
        body: chainBodies[i],
      }),
    );
    parentId = id;
  }
  return out;
}

// ── Fixture 3 — source-chain fight ─────────────────────────────

/**
 * A claim challenged by a `clarification_request` tagged `source_request`,
 * answered by `evidence`, re-challenged with another source ask — the
 * "where's your receipt" exchange. Deliberately unresolved (no
 * concession / synthesis).
 */
export function buildSourceChainFightFixture(): ArgumentTimelineMapMessageInput[] {
  return [
    msg({
      id: 'root',
      argumentType: 'thesis',
      createdAt: isoAt(0),
      body: 'Switching to LED street lighting cut our energy bill last year.',
    }),
    msg({
      id: 'ask1',
      parentId: 'root',
      argumentType: 'clarification_request',
      tagCodes: ['source_request'],
      createdAt: isoAt(1000),
      body: 'Which report shows the bill figure? Please link the source.',
    }),
    msg({
      id: 'ev1',
      parentId: 'ask1',
      argumentType: 'evidence',
      hasEvidence: true,
      createdAt: isoAt(2000),
      body: 'The town utilities summary lists the monthly figures by quarter.',
    }),
    msg({
      id: 'ask2',
      parentId: 'ev1',
      argumentType: 'clarification_request',
      tagCodes: ['source_request'],
      createdAt: isoAt(3000),
      body: 'That summary cites another table — can you point to the table itself?',
    }),
    msg({
      id: 'reb1',
      parentId: 'ask2',
      argumentType: 'rebuttal',
      createdAt: isoAt(4000),
      body: 'The table is paged separately; the figure still stands on the summary.',
    }),
  ];
}

// ── Fixture 4 — evidence-heavy branch ──────────────────────────

/**
 * A branch lane where 3+ contiguous `evidence` nodes stack — drives the
 * "Evidence run" band heuristic. Includes a real off-rail branch
 * (lane !== 0) and one heated node that still keeps a verdict-free body
 * (heat is not truth).
 */
export function buildEvidenceHeavyBranchFixture(): ArgumentTimelineMapMessageInput[] {
  return [
    msg({
      id: 'root',
      argumentType: 'thesis',
      createdAt: isoAt(0),
      body: 'A four-day work week would keep our weekly output steady.',
    }),
    msg({
      id: 'reb1',
      parentId: 'root',
      argumentType: 'rebuttal',
      createdAt: isoAt(1000),
      body: 'Output usually tracks total hours, so a shorter week would lower it.',
    }),
    // Second child of `reb1` forces an off-rail branch lane.
    msg({
      id: 'side1',
      parentId: 'reb1',
      argumentType: 'rebuttal',
      createdAt: isoAt(1500),
      body: 'Hours and output are not the same once meetings are counted.',
    }),
    msg({
      id: 'ev1',
      parentId: 'reb1',
      argumentType: 'evidence',
      hasEvidence: true,
      createdAt: isoAt(2000),
      body: 'A pilot team logged equal task completion across both schedules.',
    }),
    msg({
      id: 'ev2',
      parentId: 'ev1',
      argumentType: 'evidence',
      hasEvidence: true,
      createdAt: isoAt(3000),
      body: 'A second pilot in a different department logged the same pattern.',
    }),
    msg({
      id: 'ev3',
      parentId: 'ev2',
      argumentType: 'source',
      hasEvidence: true,
      createdAt: isoAt(4000),
      body: 'The HR records summary lists task counts for both pilot periods.',
    }),
  ];
}

// ── Fixture 5 — tangent / kink branch ──────────────────────────

/**
 * A mainline chain with one side issue: a parent with 2+ replies,
 * producing a junction and an off-rail branch (lane !== 0), plus one
 * detached node (missing parent — the "kink").
 */
export function buildTangentKinkBranchFixture(): ArgumentTimelineMapMessageInput[] {
  return [
    msg({
      id: 'root',
      argumentType: 'thesis',
      createdAt: isoAt(0),
      body: 'The library should extend its weekend opening hours.',
    }),
    msg({
      id: 'reb1',
      parentId: 'root',
      argumentType: 'rebuttal',
      createdAt: isoAt(1000),
      body: 'Weekend staffing is already stretched thin.',
    }),
    // `reb1` gets a SECOND child → junction + a real off-rail tangent lane.
    msg({
      id: 'main2',
      parentId: 'reb1',
      argumentType: 'counter_rebuttal',
      createdAt: isoAt(2000),
      body: 'Volunteer shifts could cover the extra weekend window.',
    }),
    msg({
      id: 'tangent1',
      parentId: 'reb1',
      argumentType: 'clarification_request',
      createdAt: isoAt(3000),
      body: 'Side question: does the staffing plan include the new branch?',
    }),
    msg({
      id: 'main3',
      parentId: 'main2',
      argumentType: 'rebuttal',
      createdAt: isoAt(4000),
      body: 'Volunteers still need a trained staff member on site.',
    }),
    msg({
      id: 'main4',
      parentId: 'main3',
      argumentType: 'counter_rebuttal',
      createdAt: isoAt(5000),
      body: 'One trained staff member can supervise several volunteers.',
    }),
    // The "kink": parentId points at an id that is not in the fixture.
    msg({
      id: 'kink1',
      parentId: 'missing-parent',
      argumentType: 'claim',
      createdAt: isoAt(6000),
      body: 'A reply whose parent is not part of this loaded view.',
    }),
  ];
}

// ── Fixture 6 — synthesis path ─────────────────────────────────

/**
 * A clash that resolves: claim → challenge → concession (narrow) →
 * synthesis. The "this point got resolved" arc.
 */
export function buildSynthesisPathFixture(): ArgumentTimelineMapMessageInput[] {
  return [
    msg({
      id: 'root',
      argumentType: 'thesis',
      createdAt: isoAt(0),
      body: 'The town should plant street trees along every residential block.',
    }),
    msg({
      id: 'reb1',
      parentId: 'root',
      argumentType: 'rebuttal',
      createdAt: isoAt(1000),
      body: 'Some blocks have narrow sidewalks that cannot host a tree pit.',
    }),
    msg({
      id: 'reb2',
      parentId: 'reb1',
      argumentType: 'counter_rebuttal',
      createdAt: isoAt(2000),
      body: 'Narrow blocks could use smaller planter species instead.',
    }),
    msg({
      id: 'con1',
      parentId: 'reb2',
      argumentType: 'concession',
      tagCodes: ['concession_marker'],
      createdAt: isoAt(3000),
      body: 'Agreed the narrow blocks need a smaller species — narrowing to that.',
    }),
    msg({
      id: 'syn1',
      parentId: 'con1',
      argumentType: 'synthesis',
      createdAt: isoAt(4000),
      body: 'So: standard trees on wide blocks, planter species on narrow ones.',
    }),
  ];
}

// ── Fixture 7 — 250-node stress board ──────────────────────────

/**
 * The performance / layout stress case: a 250-node board mixing a wide
 * first level, a deep sub-chain, and a block of detached nodes. Produces
 * exactly 251 total nodes (root + 250) and 50 detached, matching the
 * existing inline `buildStressFixture()` in `argumentTimelineMap.test.ts`.
 */
export function buildStressBoard250Fixture(): ArgumentTimelineMapMessageInput[] {
  const out: ArgumentTimelineMapMessageInput[] = [];
  // Root.
  out.push(msg({ id: 'root', argumentType: 'thesis', createdAt: isoAt(0) }));
  // 50 first-level replies (a wide opening level).
  for (let i = 0; i < 50; i++) {
    out.push(
      msg({
        id: `L1-${i}`,
        parentId: 'root',
        createdAt: isoAt(1000 * (i + 1)),
        argumentType: i % 3 === 0 ? 'rebuttal' : 'claim',
        authorId: `qa-user-${i % 5}`,
      }),
    );
  }
  // 50 second-level moves under L1-0.
  for (let i = 0; i < 50; i++) {
    out.push(
      msg({
        id: `L2-${i}`,
        parentId: 'L1-0',
        createdAt: isoAt(1000 * (60 + i)),
        argumentType: i % 4 === 0 ? 'evidence' : 'counter_rebuttal',
        flagCodes: i % 10 === 0 ? ['ad_hominem'] : [],
        hasEvidence: i % 4 === 0,
      }),
    );
  }
  // 100 third-level moves under L2-0 (a deep sub-chain population).
  for (let i = 0; i < 100; i++) {
    out.push(
      msg({
        id: `L3-${i}`,
        parentId: 'L2-0',
        createdAt: isoAt(1000 * (120 + i)),
        argumentType: 'claim',
      }),
    );
  }
  // 50 detached replies (parent id absent from the fixture).
  for (let i = 0; i < 50; i++) {
    out.push(
      msg({
        id: `orphan-${i}`,
        parentId: `missing-${i}`,
        createdAt: isoAt(1000 * (250 + i)),
        argumentType: 'claim',
      }),
    );
  }
  return out;
}

// ── Fixture 8 — avatar / profile display ───────────────────────

/**
 * A short multi-author thread: 3+ distinct `authorId`s, one equal to
 * `AVATAR_PROFILE_DISPLAY_CURRENT_USER_ID` (self), one a non-self human
 * (other), one with `isBot === true`. Drives participant-trend and
 * actor-label rendering.
 */
export function buildAvatarProfileDisplayFixture(): ArgumentTimelineMapMessageInput[] {
  return [
    msg({
      id: 'root',
      argumentType: 'thesis',
      authorId: 'qa-author-other',
      createdAt: isoAt(0),
      body: 'The community garden should reserve plots for first-time growers.',
    }),
    msg({
      id: 'm2',
      parentId: 'root',
      argumentType: 'rebuttal',
      authorId: AVATAR_PROFILE_DISPLAY_CURRENT_USER_ID,
      createdAt: isoAt(1000),
      body: 'Reserved plots could sit empty if no first-time growers sign up.',
    }),
    msg({
      id: 'm3',
      parentId: 'm2',
      argumentType: 'counter_rebuttal',
      authorId: 'qa-author-bot',
      isBot: true,
      createdAt: isoAt(2000),
      body: 'Unclaimed reserved plots can release to the waitlist after a set date.',
    }),
    msg({
      id: 'm4',
      parentId: 'm3',
      argumentType: 'claim',
      authorId: 'qa-author-other',
      createdAt: isoAt(3000),
      body: 'A release date keeps the plots in use either way.',
    }),
  ];
}

// ── Registry ───────────────────────────────────────────────────

/**
 * The canonical registry. Order is stable and is the order the checklist
 * doc walks. `VISUAL_QA_FIXTURES.length === 8` is asserted by a test.
 */
export const VISUAL_QA_FIXTURES: ReadonlyArray<VisualQaFixtureDescriptor> =
  Object.freeze([
    {
      id: 'no_rebuttal',
      title: 'No rebuttal — opening move only',
      summary:
        'An empty room with just the opening claim. There are no replies, ' +
        'so the board shows a single node and the onboarding hint that ' +
        'invites the first rebuttal.',
      structuralInvariant:
        'Exactly one node; it is the root; the timeline has no rebuttal and ' +
        'no edges; the root onboarding hint is present.',
      build: buildNoRebuttalFixture,
    },
    {
      id: 'straight_chain_10',
      title: 'Straight 10-move chain',
      summary:
        'A ten-move conversation that goes back and forth in a single line ' +
        'with no branching. Each reply continues the previous one on the ' +
        'same center rail.',
      structuralInvariant:
        'Ten nodes; the deepest node is depth nine; every node sits on ' +
        'lane zero; nine edges; no junctions.',
      build: buildStraightChain10Fixture,
    },
    {
      id: 'source_chain_fight',
      title: 'Source-chain fight',
      summary:
        'A claim is asked for its source, an evidence reply answers, and ' +
        'another source ask follows. The exchange is left unresolved — no ' +
        'concession and no synthesis.',
      structuralInvariant:
        'Five or more nodes; at least two clarify-family nodes carry a ' +
        'source-request dropped tag; at least one evidence-family node; no ' +
        'concession or synthesis node.',
      build: buildSourceChainFightFixture,
    },
    {
      id: 'evidence_heavy_branch',
      title: 'Evidence-heavy branch',
      summary:
        'A branch where several evidence replies stack one after another, ' +
        'enough to trigger the timeline’s evidence-run band. One ' +
        'heated reply sits in the mix; a heated reply is still just a reply.',
      structuralInvariant:
        'Six or more nodes; three or more evidence-family nodes with two ' +
        'contiguous; an evidence-run band is present; at least one node is ' +
        'on a non-zero lane.',
      build: buildEvidenceHeavyBranchFixture,
    },
    {
      id: 'tangent_kink_branch',
      title: 'Tangent / kink branch',
      summary:
        'A mainline chain with one side question that splits a parent into ' +
        'two replies, plus one reply whose parent is not part of the loaded ' +
        'view — the detached "kink".',
      structuralInvariant:
        'Seven or more nodes; exactly one junction node with two or more ' +
        'children; at least one node on a non-zero lane; exactly one ' +
        'detached node.',
      build: buildTangentKinkBranchFixture,
    },
    {
      id: 'synthesis_path',
      title: 'Synthesis path',
      summary:
        'A clash that resolves: a claim is challenged, a narrowing ' +
        'concession is offered, and a synthesis reply closes the point.',
      structuralInvariant:
        'Five or more nodes; at least one concession-family node; exactly ' +
        'one synthesis node and it is chronologically last.',
      build: buildSynthesisPathFixture,
    },
    {
      id: 'stress_board_250',
      title: '250-node stress board',
      summary:
        'A large board that mixes a wide first level, a deep sub-chain, and ' +
        'a block of detached replies. Used to check timeline layout and ' +
        'scroll performance at scale.',
      structuralInvariant:
        'About 250 nodes (251 with the root); fifty detached nodes; no ' +
        'duplicate node or edge ids; x positions strictly increasing.',
      build: buildStressBoard250Fixture,
    },
    {
      id: 'avatar_profile_display',
      title: 'Avatar / profile display',
      summary:
        'A short thread with three distinct authors: you, another person, ' +
        'and a bot. Used to check participant-trend rows and the actor ' +
        'labels on each node.',
      structuralInvariant:
        'Four or more nodes; three or more distinct authors; three or more ' +
        'participant-trend rows; one node renders as "You" and one as a bot.',
      build: buildAvatarProfileDisplayFixture,
    },
  ]);

/** Lookup by id; returns `null` for an unknown id (never throws). */
export function getVisualQaFixture(
  id: string,
): VisualQaFixtureDescriptor | null {
  for (const fixture of VISUAL_QA_FIXTURES) {
    if (fixture.id === id) return fixture;
  }
  return null;
}
