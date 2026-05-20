# Visual QA snapshots — browser visual checklist

**Card:** AN-002 — Visual QA snapshots (Epic 13, Release 6.8)
**Fixtures module:** `src/features/analytics/visualQaFixtures.ts`
**Model test suite:** `__tests__/visualQaFixtures.test.ts`

---

## What this is

A fixed set of **8 named argument-timeline fixtures** that act as a stable
visual review surface. When the timeline renderer changes — visual grammar
(Epic 2), branches (Epic 3), strength bands (Epic 7) — a human reviewer can
render each named fixture and eyeball it for regressions, and the model test
suite guarantees each fixture still *builds* into the shape its name promises.

The fixtures are **dev / QA-only**:

- `src/features/analytics/visualQaFixtures.ts` is never imported by `app/` or
  any production screen — a test in `__tests__/visualQaFixtures.test.ts`
  enforces this.
- The fixtures call no AI, no Supabase, no network. Each builder is pure and
  deterministic — calling it twice returns deep-equal arrays.
- Fixture content uses neutral, low-stakes topics (bike lanes, remote work,
  street trees). No verdict or truth tokens; no popularity or engagement
  signal. A ban-list test enforces this.

## How to render a fixture

Each builder returns the timeline **input array**
(`ArgumentTimelineMapMessageInput[]`) — *not* a built map — so the consumer
chooses what to do with it:

```ts
import { buildTangentKinkBranchFixture }
  from '../src/features/analytics/visualQaFixtures';
import { buildArgumentTimelineMap }
  from '../src/features/arguments/argumentGameSurfaceModel';

const messages = buildTangentKinkBranchFixture();
const map = buildArgumentTimelineMap({ messages, currentUserId: 'qa-reviewer' });
// map.nodes / map.edges / map.bands / map.participantTrends are the scene.
```

AN-002 ships **no in-app dev harness screen** and **no screenshot tooling** —
that is out of scope. Until a dedicated harness screen exists, each fixture is
verified two ways: by reading its builder and the `structuralInvariant` below,
and by running `npm run test -- visualQaFixtures`. When a harness screen is
built later it can `import { VISUAL_QA_FIXTURES }` directly — the registry is
designed for it.

**Doctrine reminder for every section below:** heat is not truth. A heated node
(an `ad_hominem` or `civility_risk` flag) is still just a node — when you
review a heated fixture, check the *strength stroke*, not the warmth. The
strength band describes a point's standing in the game, never an objective
verdict.

---

## 1. No rebuttal — opening move only · `no_rebuttal`

**Builder:** `buildNoRebuttalFixture()`

An empty room with just the opening claim. There are no replies, so the board
shows a single node and the onboarding hint that invites the first rebuttal.

**Structural invariant:** Exactly one node; it is the root; the timeline has no
rebuttal and no edges; the root onboarding hint is present.

A human reviewer should see:

- [ ] Exactly one node is rendered.
- [ ] The single node is styled as the root / opening claim.
- [ ] No rail or edge is drawn (there is nothing to connect).
- [ ] The "be the first rebuttal" onboarding hint is visible.
- [ ] No participant-trend rows imply any back-and-forth has happened.

---

## 2. Straight 10-move chain · `straight_chain_10`

**Builder:** `buildStraightChain10Fixture()`

A ten-move conversation that goes back and forth in a single line with no
branching. Each reply continues the previous one on the same center rail.

**Structural invariant:** Ten nodes; the deepest node is depth nine; every node
sits on lane zero; nine edges; no junctions.

A human reviewer should see:

- [ ] Ten nodes on a single horizontal rail.
- [ ] No node sits above or below the center rail (every lane is 0).
- [ ] No junction pill appears anywhere.
- [ ] Nine connecting edges, one per gap.
- [ ] x positions increase strictly left to right.

---

## 3. Source-chain fight · `source_chain_fight`

**Builder:** `buildSourceChainFightFixture()`

A claim is asked for its source, an evidence reply answers, and another source
ask follows. The exchange is left unresolved — no concession and no synthesis.

**Structural invariant:** Five or more nodes; at least two clarify-family nodes
carry a source-request dropped tag; at least one evidence-family node; no
concession or synthesis node.

A human reviewer should see:

- [ ] At least two clarify-family nodes show a "Source?" dropped tag.
- [ ] At least one evidence-family node is visibly distinct from the asks.
- [ ] No concession or synthesis node — the fight is still open.
- [ ] The exchange reads as a back-and-forth, not a resolved point.

---

## 4. Evidence-heavy branch · `evidence_heavy_branch`

**Builder:** `buildEvidenceHeavyBranchFixture()`

A branch where several evidence replies stack one after another, enough to
trigger the timeline's evidence-run band. One reply is heated; a heated reply is
still just a reply.

**Structural invariant:** Six or more nodes; three or more evidence-family nodes
with two contiguous; an evidence-run band is present; at least one node is on a
non-zero lane.

A human reviewer should see:

- [ ] Three or more evidence-family nodes are visible.
- [ ] An "Evidence run" band is drawn over the contiguous evidence stretch.
- [ ] At least one node sits on a lane off the center rail.
- [ ] A heated node is not a wrong node — check the strength stroke, not the
      warmth.

---

## 5. Tangent / kink branch · `tangent_kink_branch`

**Builder:** `buildTangentKinkBranchFixture()`

A mainline chain with one side question that splits a parent into two replies,
plus one reply whose parent is not part of the loaded view — the detached
"kink".

**Structural invariant:** Seven or more nodes; exactly one junction node with
two or more children; at least one node on a non-zero lane; exactly one
detached node.

A human reviewer should see:

- [ ] Exactly one junction pill is visible.
- [ ] The branch lane is visibly off the center rail.
- [ ] Exactly one node shows the "detached" pill / state.
- [ ] The detached node draws no edge to a parent.
- [ ] The mainline chain is still readable past the junction.

---

## 6. Synthesis path · `synthesis_path`

**Builder:** `buildSynthesisPathFixture()`

A clash that resolves: a claim is challenged, a narrowing concession is offered,
and a synthesis reply closes the point.

**Structural invariant:** Five or more nodes; at least one concession-family
node; exactly one synthesis node and it is chronologically last.

A human reviewer should see:

- [ ] At least one concession-family node is visible.
- [ ] Exactly one synthesis node, and it is the last (rightmost) node.
- [ ] The arc reads as a point that got resolved, not a verdict on a person.
- [ ] The concession and synthesis nodes share the concede color family.

---

## 7. 250-node stress board · `stress_board_250`

**Builder:** `buildStressBoard250Fixture()`

A large board that mixes a wide first level, a deep sub-chain, and a block of
detached replies. Used to check timeline layout and scroll performance at
scale.

**Structural invariant:** About 250 nodes (251 with the root); fifty detached
nodes; no duplicate node or edge ids; x positions strictly increasing.

A human reviewer should see:

- [ ] The board renders roughly 250 nodes without crashing or hanging.
- [ ] Horizontal scrolling stays smooth across the full width.
- [ ] The fifty detached nodes are visibly distinguished from connected ones.
- [ ] No node visibly overlaps a neighbor in a way that hides it.
- [ ] Bands and participant-trend rows still render at this scale.

---

## 8. Avatar / profile display · `avatar_profile_display`

**Builder:** `buildAvatarProfileDisplayFixture()`
**Pass `currentUserId`:** `AVATAR_PROFILE_DISPLAY_CURRENT_USER_ID`

A short thread with three distinct authors: you, another person, and a bot.
Used to check participant-trend rows and the actor labels on each node.

**Structural invariant:** Four or more nodes; three or more distinct authors;
three or more participant-trend rows; one node renders as "You" and one as a
bot.

A human reviewer should see:

- [ ] Three or more participant-trend rows, one per author.
- [ ] One node is labelled as "You" (when built with
      `AVATAR_PROFILE_DISPLAY_CURRENT_USER_ID`).
- [ ] One node is labelled as a bot author.
- [ ] The non-self human author is distinct from both "You" and the bot.
- [ ] Actor labels stay neutral — no label implies anyone is right or wrong.
