# LIFE-001 — Point lifecycle metadata model

**Status:** Design draft
**Epic:** Epic 12 — Evidence-Enhanced Game Rules and Flow (Rules UX)
**Release:** 6.6
**Wave:** 1 (Foundation)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/61
**Branch:** `feat/LIFE-001-point-lifecycle-metadata-model`
**Card body:** `C:\Users\kyler\AppData\Local\Temp\cd-roadmap-context\LIFE-001.md`
**Depends on (all shipped):** BR-001 (`branchTopologyModel.ts` — branch identity + `buildEvidenceThreadMap` + `BranchCollapseState`), `argumentGameSurfaceModel.ts` (`ArgumentTimelineMap*`, `branchRootMessageId`, `siblingIndex`, `replyCount`, `descendantCount`, `kindColorFamily`, `droppedTags`, `flagCodes` upstream), EV-001 (`evidenceModel.ts` — `EvidenceArtifact`, `SourceChainStatus`, `summarizeArtifactsForReceiptChip`, `getTimelineEvidenceContract`), `messageQualifiers.ts` (`MessageCategory` / `MessageQualifier`), `pointStanding/` (Stage 6.1.4 — `PointStandingDelta`, `OpenIssueDebt`, `ConcessionEffect`), `pointStanding/antiAmplification.ts` (Stage 6.1.5.2), `gameCopy.ts` (Stage 6.4 — `toPlainLanguage`).

---

## Goal

LIFE-001 introduces the **per-point lifecycle layer** that turns the timeline from "messages over time" into "points with state." It produces a single deterministic `PointLifecycleState` value (from a locked 18-value vocabulary) for each point cluster in a debate tree, plus a per-message snapshot and a tree-level map. Later cards (SC-004, ST-002, GAME-001, RULE-003, GAL-002, AN-003) consume this state to drive the board action dock, suggested-next-move chips, exhaustion advisories, plain-language labels, and gallery hints. **Building those surfaces on ad-hoc derivations would fragment the doctrine** — LIFE-001 is the shared input.

The model is doctrine-anchored on five sentences:

1. **A lifecycle state is a gameplay signal, never a verdict.** No state describes truth, winning, losing, or correctness.
2. **Heat / popularity / engagement / virality / strength bands never feed lifecycle derivation.** Wrong-but-loud and right-but-quiet produce the same lifecycle state when the move structure is identical.
3. **`ignored_by_*` describes a cluster, never a person.** The model labels a *point* as having unanswered requests on a *side*. It never labels a user as "ignoring" anything.
4. **Concession is a scoring repair, not a defeat.** A `narrowed` or `conceded` cluster does not "lose" — the responder typically gains broad standing per the point-standing economy. Lifecycle reports the *move structure*, not the score outcome.
5. **Exhaustion / moved-on / ignored / branch-recommended are ADVISORIES, never blocking.** They never prevent posting, never auto-archive, never auto-hide, never suppress an ordinary reply.

LIFE-001 must build *on top of* the existing semantic-flag, qualifier, evidence-contract, and branch-topology surfaces — NOT in parallel. This is roadmap §16 risk #1 ("LIFE-001 must build *on top* of existing flags and qualifiers, not in parallel") called out by name. The classifier reads existing node fields and EV-001 contract output; it never re-derives `MessageCategory`, re-classifies a challenge axis, or re-runs anti-amplification.

LIFE-001 ships **no new dependency**, **no migration**, **no Edge Function**, **no schema change**, **no AI inference path**, **no Supabase write**, **no `.env*` change**, and **no UI**. The classifier is a pure-TS model. SC-004 / ST-002 / GAME-001 / RULE-003 are the UI consumers, in later cards.

---

## Product context — what does this card define that later cards consume?

| Card | What it consumes from LIFE-001 | What it should NOT redefine |
|---|---|---|
| **META-001** | `PointLifecycleState` (read-only, as an input to its tag/metadata ledger). META-001 reads `lifecycleStateByCluster` and tags transitions; it does NOT compute lifecycle itself. | The 18-state vocabulary, the priority order, the per-state derivation rules. |
| **SC-004** | `lifecycleStateByCluster` + `lifecycleSnapshotByMessage` → drives which actions appear in the board action dock for the selected cluster. | None of the lifecycle states. SC-004 maps states to action sets; LIFE-001 owns what state a cluster is in. |
| **ST-002** | `lifecycleStateByCluster` + the per-cluster `OpenIssueDebtSummary` → drives suggested-next-move chips on bubble cards. | The state-to-suggestion mapping is ST-002's; the *state itself* is LIFE-001's. |
| **GAME-001** | `lifecycleStateByCluster` + `LifecycleAdvisoryInputs` (turn counts, ages, pressure counts) → renders exhaustion / moved-on / ignored advisories. | The 4 advisory state codes (`exhausted`, `moved_on_by_*`, `ignored_by_*`, `synthesis_ready`). GAME-001 may TUNE the thresholds (`EXHAUSTION_REPEAT_THRESHOLD`, `MOVED_ON_TURN_THRESHOLD`, etc.) but MUST consume the same derivation entry point. |
| **RULE-003** | All 18 state codes → maps each to plain-language label + helper + allowed action set. The plain-language fallback in this card's `LIFECYCLE_PLAIN_LABEL` is the v1 default; RULE-003 may extend with helpers + action lists. | The 18 state codes themselves. The codes are locked in this card. |
| **GAL-002** | The *root cluster's* lifecycle state → drives the gallery card's first-suggested-move hint. | None of the lifecycle states. |
| **AN-003** | Aggregate counts per lifecycle state per debate → diagnostics view (dev-only). | The state codes. |

LIFE-001 itself does NOT consume any of these cards. The dependency is one-way: LIFE-001 → everything in Wave 2 / Wave 3 / 6.6.

---

## Module ownership — where does this code live?

**Decision:** new directory `src/features/lifecycle/`, NOT under `src/features/pointStanding/`.

Rationale:

- `src/features/pointStanding/` owns the **scoring economy** (deltas, debts, eligibility, anti-amplification). Lifecycle is **gameplay metadata**, not scoring. Conflating them would muddy the doctrine — lifecycle should be readable without forcing the reader to also reason about standing bands.
- `src/features/arguments/` already houses the timeline / surface / qualifier model. Adding lifecycle here would push that directory toward 20 files and would make it visually harder to enforce the "lifecycle reads, never writes" invariant.
- A new `src/features/lifecycle/` directory leaves room for META-001 (`metadataLedger.ts`) and GAME-001 (`exhaustionAdvisor.ts`) to live alongside in the same module, since all three share the same input contract (the timeline map + evidence contract + branch topology).

File layout:

```
src/features/lifecycle/
  pointLifecycleModel.ts          # this card — the 18-state model, pure-TS
  pointLifecycleClusters.ts       # this card — cluster identity + member iteration
  pointLifecycleAdvisoryInputs.ts # this card — non-blocking advisory threshold constants + observable inputs
  index.ts                        # this card — public re-exports
  __tests__ co-located? NO — repo convention is __tests__/ at root
```

`pointStanding/`, `arguments/`, and `evidence/` files are NOT modified by this card. The lifecycle model imports types from them; it does not edit them.

---

## Data model

All shapes are pure-TS, JSON-serializable, immutable (`readonly` where structural), and contain no `Date` objects, no functions, no class instances, no React types.

### The locked 18-state enum

```ts
/**
 * LIFE-001 — Point lifecycle vocabulary. Each value is a board signal, NEVER
 * a verdict. The 18 values partition the gameplay states a cluster can be in
 * given the move-structure inputs LIFE-001 reads (parent → reply axis, evidence
 * artifacts, qualifier codes, branch topology, turn sequence per side).
 *
 * Doctrine: no state may be inferred from truth / winner / loser / correctness.
 * No state may be inferred from heat / popularity / engagement / virality /
 * strength bands. Wrong-but-loud + right-but-quiet → identical lifecycle when
 * move structure matches.
 */
export type PointLifecycleState =
  | 'open'                       // reply exists, no rebuttal yet (root case + open clusters)
  | 'answered'                   // a direct reply on the same axis exists, neither party rebutting
  | 'rebutted'                   // a counter-claim on the same axis exists (under pressure)
  | 'clarified'                  // author edited / posted a clarification reply
  | 'sourced'                    // evidence attached at `source_and_quote` or `primary_present` per EV-001
  | 'quote_requested'            // other side asked for a quote (request open)
  | 'source_requested'           // other side asked for a source (request open)
  | 'narrowed'                   // author posted a narrow concession (preserves broader claim)
  | 'conceded'                   // author posted an explicit broad concession
  | 'confirmed'                  // other side confirmed without rebuttal
  | 'synthesis_ready'            // concession / narrowing landed + no unresolved evidence-debt on axis
  | 'moved_on_by_affirmative'    // affirmative side stopped engaging this cluster (advisory)
  | 'moved_on_by_negative'       // negative side stopped engaging this cluster (advisory)
  | 'ignored_by_affirmative'     // affirmative never responded to an open request on this cluster (advisory)
  | 'ignored_by_negative'        // negative never responded to an open request on this cluster (advisory)
  | 'ignored_by_both'            // both sides dormant past threshold (advisory)
  | 'exhausted'                  // same-axis pressure repeated ≥ N times without new evidence/scope/definition/mechanism info (advisory)
  | 'branch_recommended'         // off-axis pressure repeated under the same root → suggest branching (advisory)
  | 'archived_or_resolved';      // cluster closed by synthesis or admin resolution

/** Frozen array of every state. Tests + RULE-003 iterate this. */
export const ALL_POINT_LIFECYCLE_STATES: ReadonlyArray<PointLifecycleState>;
```

### Priority order (worst-priority-wins for cluster summary)

Per roadmap §6, branch / mini-map / gallery summaries pick the **worst-priority** state when summarising a cluster's sub-tree. Priority is gameplay urgency, NOT severity-of-truth.

```ts
/** Higher value = higher priority. Worst-priority-wins for cluster summary. */
export const LIFECYCLE_PRIORITY: Readonly<Record<PointLifecycleState, number>> = Object.freeze({
  // 0 — resolved / closed (lowest priority; "nothing to nudge")
  archived_or_resolved: 0,
  synthesis_ready: 5,
  // 10 — resolved-ish (one-sided closure)
  conceded: 10,
  narrowed: 10,
  confirmed: 10,
  // 20 — neutral progress
  sourced: 20,
  clarified: 20,
  // 30 — open conversation
  open: 30,
  answered: 30,
  // 50 — active pressure
  rebutted: 50,
  quote_requested: 50,
  source_requested: 50,
  // 60 — branch suggestion (off-axis pressure)
  branch_recommended: 60,
  // 70 — moved on (one side)
  moved_on_by_affirmative: 70,
  moved_on_by_negative: 70,
  // 80 — ignored (one side)
  ignored_by_affirmative: 80,
  ignored_by_negative: 80,
  // 85 — ignored (both)
  ignored_by_both: 85,
  // 90 — exhausted (highest priority; "out of new angles")
  exhausted: 90,
});
```

Tests assert: (a) every state has a priority; (b) priorities are integers; (c) `synthesis_ready` < `open` (resolution-ish is calmer than open); (d) `exhausted` > `rebutted` (exhausted dominates an ordinary push).

### Per-message snapshot

```ts
/**
 * Per-message lifecycle snapshot. One per non-deleted message in the tree.
 * The cluster-level state is `lifecycleStateByCluster[clusterId]`; this
 * shape additionally exposes the per-message contribution so ST-002 can
 * surface "this move's contribution to the cluster's state" in Cards
 * detail.
 *
 * Pure data. JSON-serializable.
 */
export interface PointLifecycleSnapshot {
  /** Same as the message's `id` field on `public.arguments`. */
  messageId: string;
  /** Cluster the message belongs to. Equal to its `branchRootMessageId` in
   *  the surface model. Renamed here to keep lifecycle vocabulary distinct
   *  from rail vocabulary. */
  clusterId: string;
  /** The cluster's current lifecycle state (worst-priority of its members,
   *  with the cluster-level rules in §"Cluster summary" applied). Repeated
   *  here so per-message consumers don't have to do a second lookup. */
  clusterState: PointLifecycleState;
  /** This message's individual contribution. May differ from `clusterState`
   *  — e.g., a message that requests a source contributes `source_requested`
   *  even when the cluster's worst-priority state is `exhausted`. */
  messageContribution: PointLifecycleState;
  /** Convenience: which axis the message was acting on, when derivable from
   *  qualifiers/argument-type. `null` when no axis is identified. Reads
   *  existing `droppedTags[].code` only — does NOT re-derive
   *  `MessageCategory`. */
  axis: PointLifecycleAxis | null;
  /** True when this message creates an open request that the other side has
   *  not yet answered (drives `source_requested` / `quote_requested`). */
  opensRequest: boolean;
  /** True when this message resolves an open request by sourcing / quoting /
   *  evidencing the parent (drives `sourced`). */
  resolvesRequest: boolean;
  /** True when this message is an explicit concession-shape move per the
   *  qualifier code (`concede_broad_point` / `concede_small_point`). */
  isConcessionShape: boolean;
  /** True when this message is an explicit synthesis-shape move
   *  (`synthesize_agreement` / `synthesize_open_question`). */
  isSynthesisShape: boolean;
  /** Optional plain-language label fallback. Defaults to
   *  `LIFECYCLE_PLAIN_LABEL[clusterState]`. RULE-003 may override per
   *  surface; this is the safe v1 default. */
  plainLabel: string;
}

/** Axes LIFE-001 reads from existing qualifier / argument-type fields. */
export type PointLifecycleAxis =
  | 'fact'
  | 'definition'
  | 'causal'
  | 'value'
  | 'evidence'
  | 'logic'
  | 'scope'
  | 'source'
  | 'quote'
  | 'unaxed'; // no axis derivable — used by the "no_axis" eligibility gate consumers
```

### Per-cluster summary

```ts
export interface PointLifecycleClusterSummary {
  clusterId: string;
  /** Cluster root message id (the move that opened the cluster — equals
   *  `branchRootMessageId` in the surface model). */
  rootMessageId: string;
  /** Worst-priority state across the cluster's members + cluster-level
   *  rules (see §"Cluster summary"). */
  state: PointLifecycleState;
  /** Plain-language default label. RULE-003 may override per surface. */
  plainLabel: string;
  /** Ordered chronological message-id list. Includes the cluster root. */
  messageIds: ReadonlyArray<string>;
  /** Count of unique members. */
  memberCount: number;
  /** Per-side activity counts (used by GAME-001 to TUNE thresholds; reading
   *  is safe in this card). */
  affirmativeMoveCount: number;
  negativeMoveCount: number;
  observerMoveCount: number;
  /** True when the cluster has at least one open `source_requested` or
   *  `quote_requested` request. Used by RULE-003 / SC-004 to surface
   *  "ask source" affordances. */
  hasOpenSourceOrQuoteRequest: boolean;
  /** True when the cluster has at least one explicit concession-shape or
   *  synthesis-shape move. */
  hasConcessionOrSynthesisMove: boolean;
  /** EV-001 contract worst-status across the cluster (`primary_present` |
   *  `source_and_quote` | `source_no_quote` | `unverified` | `no_source` |
   *  `broken`). Used to disambiguate `sourced` vs `source_requested`. */
  worstEvidenceStatus: import('../evidence/evidenceModel').SourceChainStatus;
  /** Detected axis distribution (chronologically last axis wins ties). */
  primaryAxis: PointLifecycleAxis | null;
  /** True when LIFE-001 decided the cluster's state is an advisory state
   *  (exhausted / moved_on_by_* / ignored_by_* / branch_recommended). UI
   *  consumers can use this single flag to switch to advisory styling. */
  isAdvisory: boolean;
}
```

### Per-tree map

```ts
export interface PointLifecycleMap {
  /** Frozen map keyed by cluster id (`branchRootMessageId`). */
  byCluster: ReadonlyMap<string, PointLifecycleClusterSummary>;
  /** Frozen map keyed by message id. */
  byMessage: ReadonlyMap<string, PointLifecycleSnapshot>;
  /** Frozen list of cluster ids in chronological order (cluster root's
   *  ordinal in the surface model). */
  clusterOrder: ReadonlyArray<string>;
  /** Frozen list of every cluster's state for the room (for AN-003
   *  aggregation; one entry per cluster in `clusterOrder`). */
  cumulativeStateSequence: ReadonlyArray<PointLifecycleState>;
  /** Stable hash of the inputs. Memoization key for the room shell. */
  inputHash: string;
}
```

All maps are returned as `ReadonlyMap` via `Object.freeze`-style wrappers; the implementer uses native `Map` internally and returns it through a `Readonly<Map<…>>` cast. The shape is JSON-serializable when the consumer spreads it (`Array.from(map.entries())`), and the model itself emits both `byCluster` and `byMessage` as `Map`s for O(1) lookup. The `inputHash` is a stable hash of `(messages length, last message id, last message updatedAt ?? createdAt, branchTopologyMap stable signature, evidenceArtifacts length, advisoryConfig signature)`.

### Optional `LifecycleAdvisoryInputs` (configuration)

```ts
/**
 * Threshold constants for the four advisory states. LIFE-001 ships safe
 * defaults; GAME-001 may pass override values to tune. None of the
 * non-advisory states use these.
 *
 * Doctrine: thresholds are advisory only — they NEVER block posting,
 * NEVER auto-archive, NEVER auto-message a user.
 */
export interface LifecycleAdvisoryConfig {
  /** Same-axis pressure repeats required to fire `exhausted`. Default: 3. */
  exhaustionRepeatThreshold: number;
  /** Turns since the side last posted to this cluster (across the whole
   *  room — not just this cluster) required to fire `moved_on_by_<side>`.
   *  Default: 4. */
  movedOnTurnThreshold: number;
  /** Turns since the side received an open request on this cluster
   *  required to fire `ignored_by_<side>`. Default: 3. */
  ignoredBySideTurnThreshold: number;
  /** Combined-side dormancy turns required to fire `ignored_by_both`.
   *  Default: 6. */
  ignoredByBothTurnThreshold: number;
  /** Off-axis pressure repeats required to fire `branch_recommended`.
   *  Default: 2. */
  branchRecommendedRepeatThreshold: number;
}

export const DEFAULT_LIFECYCLE_ADVISORY_CONFIG: Readonly<LifecycleAdvisoryConfig>;
```

These are v1 conservative defaults — they rarely fire under short rooms and reliably fire under genuinely stale clusters. GAME-001 may tune them after AN-003 lands; LIFE-001 ships the safe defaults.

---

## Lifecycle derivation rules — decision table

Every state has a deterministic rule. The classifier reads only:

- `ArgumentTimelineMapNode` fields (`messageId`, `parentId`, `branchRootMessageId`, `siblingIndex`, `replyCount`, `descendantCount`, `kindColorFamily`, `droppedTags`, `actorLabel`, `sideLabel`, `ordinal`, `createdAt`, `isDeleted` filtered upstream).
- `ArgumentTimelineMapEdge.fromMessageId` / `toMessageId` (for parent-axis matching).
- `branchTopologyModel` outputs (`branchKindMap`, `evidenceThreadByBranchRoot`, `BranchCollapseState` — not consumed for derivation, but available).
- EV-001's `getTimelineEvidenceContract(argumentType, artifacts)` → `SourceChainStatus`.
- `messageQualifiers` codes already populated on `droppedTags[].code` (`concede_small_point`, `concede_broad_point`, `synthesize_agreement`, `synthesize_open_question`, `narrow_scope`, `ask_receipts`, `quote_exact_bit`, `branch_this_off`, `tangent_or_joke`, axis codes).
- Optional pre-derived `flagCodes` on `ArgumentTimelineMapMessageInput` (`argument_resolved`, `archived_by_admin` — see edge cases).
- `LifecycleAdvisoryConfig` thresholds.

The classifier does NOT read:

- `standingBand`, `toneBand`, `temperatureBand`, `topicScore`, `kindColor`, gradient stops (these are heat/popularity/strength signals).
- Any user identifier beyond `actorLabel` / `sideLabel` (no person-labels).
- Anti-amplification flags (LIFE-001 reports move structure; anti-amplification post-processes *standing*, not lifecycle).
- Any AI annotation field.

### Per-message contribution (Pass 1)

Computed for every non-deleted message. The deriver returns ONE `PointLifecycleState` per message — the message's contribution to its cluster. Cluster-level worst-priority-wins composes them into the cluster state.

| # | Rule (observable inputs) | → contribution | Why |
|--:|---|---|---|
| 1 | Argument type is `synthesis` OR `droppedTags` contains `synthesize_agreement` / `synthesize_open_question` | `synthesis_ready` | Explicit synthesis-shape move |
| 2 | `flagCodes` contains `argument_resolved` OR `archived_by_admin` | `archived_or_resolved` | Admin-set resolution; only an admin / synthesis can produce this state |
| 3 | `droppedTags` contains `concede_broad_point` OR argument type is `concession` AND body indicates broad concession (axis = unaxed AND no narrow lexeme) | `conceded` | Explicit broad concession |
| 4 | `droppedTags` contains `concede_small_point` OR (argument type is `concession` AND narrow lexeme present OR `narrow_scope` qualifier) | `narrowed` | Narrow concession preserves broad point |
| 5 | Argument type is `confirmation` OR `droppedTags` contains `pure_accept` (and message is not the root) | `confirmed` | Other side confirmed without rebuttal |
| 6 | EV-001 contract `summarizeArtifactsForReceiptChip(artifactsByMessageId.get(messageId))` returns status `source_and_quote` OR `primary_present` | `sourced` | Evidence is anchored on this move; resolves prior source/quote request when one was open on the parent |
| 7 | Argument type is `clarification_request` AND `droppedTags` contains `ask_receipts` (or body lexeme via `MessageCategory === 'receipt_request'`) | `source_requested` | Open request for a source |
| 8 | Argument type is `clarification_request` AND `droppedTags` contains `quote_exact_bit` (or body lexeme via `MessageCategory === 'quote_request'`) | `quote_requested` | Open request for a quote |
| 9 | Argument type is `clarification_request` OR `droppedTags` contains other clarification qualifiers (`define_term`) | `clarified` | A clarification was offered or requested without source/quote shape |
| 10 | Argument type is `rebuttal` OR `counter_rebuttal` AND a same-axis ancestor exists in the cluster | `rebutted` | Counter-claim on the same axis exists (under pressure) |
| 11 | Argument type is `rebuttal` OR `counter_rebuttal` AND no same-axis ancestor (first attack on this axis) | `answered` | A direct reply on the axis exists, not yet rebutted |
| 12 | Any other reply (claim / support / evidence / thesis) | `answered` | Reply exists; default for "engagement happened" |
| 13 | Root message with no replies | `open` | Reply exists at root level only — open for response |
| 14 | Message is the cluster root AND no descendants | `open` | Same as 13 for non-mainline cluster roots |

Each rule reads ONLY the observable inputs listed above. Rules are evaluated in order; first match wins (synthesis / resolution dominate everything else).

### Cluster summary (Pass 2) — composing per-message contributions

A cluster = the subtree rooted at `branchRootMessageId` per the surface model. (BR-001 calls these "branch roots"; LIFE-001 calls them "cluster ids" because the lifecycle vocabulary is point-shaped, not topology-shaped.) The cluster state is computed by:

1. **Resolution dominance.** If ANY member's contribution is `archived_or_resolved`, the cluster is `archived_or_resolved`. Stop.
2. **Synthesis dominance.** If ANY member's contribution is `synthesis_ready` AND the cluster has no open `source_requested` / `quote_requested` requests AND no `rebutted` after the synthesis move, the cluster is `synthesis_ready`. Otherwise the synthesis move counts as a regular `narrowed` / `clarified` contribution and composition continues.
3. **Concession dominance (with caveat).** If the chronologically-last member's contribution is `conceded` AND no later `rebutted` exists on the same axis, the cluster is `conceded`. If `narrowed`, the cluster is `narrowed`. (Earlier concessions that were rebutted do not dominate.)
4. **Confirmed dominance.** If the chronologically-last member's contribution is `confirmed` AND no later activity, the cluster is `confirmed`.
5. **Open request dominance.** If the cluster has an open `source_requested` or `quote_requested` (a request whose answer-shape — `sourced` / a same-axis answer with evidence — has NOT landed since), the cluster carries that state. `source_requested` and `quote_requested` are equally prioritised; if both are open, `quote_requested` wins (more specific). Once a `sourced` move lands on the same axis chain, the request is closed and the cluster's state drops to `sourced`.
6. **Sourced dominance (no open request).** If the chronologically-last member's contribution is `sourced` AND no open request precedes it, the cluster is `sourced`.
7. **Pressure dominance.** If the cluster has any `rebutted` contribution AND no later concession / synthesis / sourced answer, the cluster is `rebutted`.
8. **Advisory pass.** If none of 1–7 applied, run the four advisory checks in this order against `LifecycleAdvisoryConfig`:
    - **Exhaustion.** Count distinct same-axis `rebutted` / `answered` contributions where each subsequent one adds no new evidence/scope/definition/mechanism information. If count ≥ `exhaustionRepeatThreshold` → `exhausted`.
    - **Branch recommended.** Count off-axis pressure under the cluster root (qualifier `branch_this_off` / `tangent_or_joke` or `MessageCategory === 'tangent'`). If count ≥ `branchRecommendedRepeatThreshold` → `branch_recommended`.
    - **Ignored by both.** Both sides have no posts to this cluster in their last `ignoredByBothTurnThreshold` of room-wide turns AND there is at least one open `source_requested` or `quote_requested`. → `ignored_by_both`.
    - **Ignored by one side.** A side has an open request on this cluster AND has had `ignoredBySideTurnThreshold` room-wide turns since without responding here. → `ignored_by_affirmative` or `ignored_by_negative`.
    - **Moved on.** A side has not posted to this cluster in `movedOnTurnThreshold` of its own subsequent turns AND there is no open request directed at them. → `moved_on_by_affirmative` or `moved_on_by_negative`.
9. **Open default.** If none applied and the cluster has only a root → `open`. If it has at least one direct reply → `answered`. If it has a `clarified` contribution but no other axis activity → `clarified`. If it has a `sourced` contribution + no rebuttal → `sourced` (covered by rule 6 above; defensive duplicate).

### Why this ordering — design rationale

- **Resolution / synthesis dominate** because once a cluster is closed by synthesis or admin action, advisory states no longer apply (a "resolved" cluster cannot also be "exhausted").
- **Concession dominates pressure** because a conceded cluster has reached an outcome; the pressure that produced the concession is no longer relevant for nudging.
- **Open requests dominate ordinary pressure** because the highest-leverage next move is closing the open request (drives SC-004 dock to surface "drop receipts").
- **Advisory states are last** because they are by definition non-progressing — they fire when the cluster is genuinely stale, not when ordinary play is happening.

### Axis resolution

Axis is derived per-message from existing fields. Order of precedence:

1. `disagreementAxis` field on the message (already populated on input rows for `rebuttal` / `counter_rebuttal`).
2. `droppedTags[].code` membership in axis codes (`fact_challenge` → `fact`, `scope_challenge` → `scope`, `definition_challenge` → `definition`, `causal_challenge` → `causal`, `value_challenge` → `value`, `evidence_challenge` → `evidence`, `logic_challenge` → `logic`, `ask_receipts` → `source`, `quote_exact_bit` → `quote`).
3. Argument type fallback: `evidence` → `evidence`, `clarification_request` → `clarified` (no axis), `concession` → parent's axis.
4. Default: `unaxed`.

The classifier never re-derives axis via `MessageCategory.deriveMessageCategory`. It reads only the surface model's already-populated `droppedTags` codes plus the optional `disagreementAxis` field.

### Same-axis lineage (used by rules 10 / pressure dominance / exhaustion)

A message has a "same-axis ancestor" when there is any non-deleted message in its parent chain (up to the cluster root) whose axis equals this message's axis. This is an O(depth) walk per message; total O(n × depth_avg) ≪ O(n²) for typical trees.

The exhaustion counter increments only when the same-axis pressure adds NO new information. "New information" is observable:

- A new `EvidenceArtifact` is attached to the pressing move (EV-001 contract).
- A new `targetExcerpt` is provided (the pressing move quoted a different part of the parent).
- A new axis-narrowing qualifier is present (`narrow_scope`, `define_term`).

If any of these is present, the pressure is "additive" and does NOT increment the exhaustion counter. This is the doctrine guardrail: a user who quotes a different sentence and asks again is still doing valid work.

---

## Plain-language label map — extend `gameCopy.toPlainLanguage`

`gameCopy.PLAIN_LANGUAGE_COPY` already contains some lifecycle-adjacent codes (`synthesis_ready`, `concession`, `synthesis`, `evidence_debt`, `source_chain`). LIFE-001 extends the map with the 18 lifecycle codes. NO new mapping table is introduced — there must be exactly one plain-language map in the app.

### v1 default labels (this card commits these to `PLAIN_LANGUAGE_COPY`)

```ts
// Appended to PLAIN_LANGUAGE_COPY in `src/features/arguments/gameCopy.ts`.
// RULE-003 (later card) may add helpers + action sets; the labels themselves
// are LIFE-001 territory.
open: 'Open for response',
answered: 'Has a reply',
rebutted: 'Under pressure',
clarified: 'Clarified',
sourced: 'Source attached',
quote_requested: 'Quote requested',
source_requested: 'Source requested',
narrowed: 'Narrowed',
conceded: 'Conceded by author',
confirmed: 'Confirmed by other side',
// 'synthesis_ready' already mapped to 'Near resolution' — UPDATE to 'Ready for synthesis' for accuracy
moved_on_by_affirmative: 'Affirmative moved on',
moved_on_by_negative: 'Negative moved on',
ignored_by_affirmative: 'Affirmative did not respond',
ignored_by_negative: 'Negative did not respond',
ignored_by_both: 'Nobody followed up',
exhausted: 'Out of new angles',
branch_recommended: 'Branch suggested',
archived_or_resolved: 'Resolved',
```

**Doctrine check on every label:** zero verdict tokens (`winner`, `loser`, `correct`, `incorrect`, `true`, `false`, `liar`, `dishonest`, `bad faith`, `manipulative`, `extremist`, `propagandist`, `proof`, `proven`, `disproven`, `verdict`); zero amplification tokens (`viral`, `popular`, `trending`, `likes`, `retweets`, `engagement`); zero person-attribution tokens (`troll`, `bot`, `astroturfer`). The ban-list test in §"Test plan" enforces.

Note on `synthesis_ready`: the existing `PLAIN_LANGUAGE_COPY['synthesis_ready']` is `'Near resolution'`. LIFE-001 changes this to `'Ready for synthesis'` (matches roadmap §6 verbatim and is more specific). The existing `'Near resolution'` was added for the runner pipeline; the runner consumes the *code* via internal log paths and never reads the human label, so the change is safe. Test asserts no runner-side regressions by reading the code path, not the string.

### `LIFECYCLE_PLAIN_LABEL` — the typed lookup helper

```ts
/**
 * Direct typed lookup for the 18 lifecycle codes. Always returns a string;
 * unknown values would be impossible (the type system constrains the
 * argument). Equivalent to `toPlainLanguage(state)` but typed.
 *
 * RULE-003 may layer helpers + action sets on top; this helper is the
 * unconditional safe-default label.
 */
export function getPointLifecyclePlainLabel(state: PointLifecycleState): string;
```

This helper exists so consumers can avoid the case-insensitive map lookup overhead in hot rendering paths. Internally it reads the same `PLAIN_LANGUAGE_COPY` table.

---

## API / interface contracts

### `src/features/lifecycle/pointLifecycleModel.ts`

```ts
import type {
  ArgumentTimelineMapNode,
  ArgumentTimelineMapEdge,
  ArgumentTimelineMapModel,
} from '../arguments/argumentGameSurfaceModel';
import type { EvidenceArtifact, SourceChainStatus } from '../evidence/evidenceModel';

// ── Public types — exported in §"Data model" ──────────────────

export type PointLifecycleState = /* 18-value union from §"Data model" */;
export const ALL_POINT_LIFECYCLE_STATES: ReadonlyArray<PointLifecycleState>;
export const LIFECYCLE_PRIORITY: Readonly<Record<PointLifecycleState, number>>;
export type PointLifecycleAxis = /* 10-value union from §"Data model" */;
export interface PointLifecycleSnapshot { /* per §"Data model" */ }
export interface PointLifecycleClusterSummary { /* per §"Data model" */ }
export interface PointLifecycleMap { /* per §"Data model" */ }
export interface LifecycleAdvisoryConfig { /* per §"Data model" */ }
export const DEFAULT_LIFECYCLE_ADVISORY_CONFIG: Readonly<LifecycleAdvisoryConfig>;

// ── Per-message classifier ────────────────────────────────────

export interface DerivePointLifecycleSnapshotInput {
  node: ArgumentTimelineMapNode;
  parentNode: ArgumentTimelineMapNode | null;
  clusterId: string;
  /** Cluster's current state (computed by the cluster summary in a separate
   *  pass; per-message classifier reads it for the snapshot only — does NOT
   *  use it to determine `messageContribution`). */
  clusterState: PointLifecycleState;
  /** EV-001 contract status for this message's artifacts. `null` when no
   *  artifacts are attached. */
  artifactStatus: SourceChainStatus | null;
  /** Other messages in the cluster (chronological order). Used by axis
   *  lineage check. */
  clusterMembers: ReadonlyArray<ArgumentTimelineMapNode>;
}

/**
 * Returns the per-message snapshot. Pure. Deterministic.
 *
 * Reads ONLY the inputs above. Never reads `standingBand`, `toneBand`,
 * `temperatureBand`, `topicScore`, or any AI annotation. Never re-derives
 * `MessageCategory`.
 */
export function derivePointLifecycleSnapshot(
  input: DerivePointLifecycleSnapshotInput,
): PointLifecycleSnapshot;

// ── Per-cluster classifier ─────────────────────────────────────

export interface DeriveClusterSummaryInput {
  clusterId: string;
  rootMessageId: string;
  members: ReadonlyArray<ArgumentTimelineMapNode>;
  /** All edges in the cluster (subset of the timeline map's edges). */
  edges: ReadonlyArray<ArgumentTimelineMapEdge>;
  /** Frozen map keyed by messageId — EV-001 contract status for each
   *  cluster member's attached artifacts. Empty when no artifacts. */
  artifactStatusByMessageId: ReadonlyMap<string, SourceChainStatus>;
  /** Frozen map keyed by messageId — `flagCodes` upstream. Drives rule 2
   *  (`archived_or_resolved`). */
  flagCodesByMessageId: ReadonlyMap<string, ReadonlyArray<string>>;
  /** Map of side → ordered list of room-wide message ids that side has
   *  posted (for advisory turn counts). Computed once per render in
   *  `buildPointLifecycleMap`. */
  sideTurnSequence: ReadonlyMap<'affirmative' | 'negative', ReadonlyArray<string>>;
  /** Advisory thresholds. */
  advisoryConfig: LifecycleAdvisoryConfig;
}

export function deriveClusterLifecycleSummary(
  input: DeriveClusterSummaryInput,
): PointLifecycleClusterSummary;

// ── Tree-level entry point ─────────────────────────────────────

export interface BuildPointLifecycleMapInput {
  /** Pass the already-built timeline map (no recomputation). */
  timelineMap: ArgumentTimelineMapModel;
  /** Frozen map keyed by argumentId → artifacts (built once by the room
   *  shell via EV-001's `buildEvidenceArtifacts`). Empty map when no
   *  artifacts. */
  artifactsByMessageId: ReadonlyMap<string, ReadonlyArray<EvidenceArtifact>>;
  /** Optional `flagCodes` lookup. Defaults to empty. */
  flagCodesByMessageId?: ReadonlyMap<string, ReadonlyArray<string>>;
  /** Optional advisory threshold overrides. Defaults to
   *  `DEFAULT_LIFECYCLE_ADVISORY_CONFIG`. */
  advisoryConfig?: LifecycleAdvisoryConfig;
}

/**
 * Builds the per-tree lifecycle map in three passes:
 *   Pass 1 — group nodes by `branchRootMessageId` into clusters.
 *   Pass 2 — for each cluster, compute the cluster summary.
 *   Pass 3 — for each non-deleted message, compute the snapshot.
 *
 * Pure. Deterministic. O(n + n × depth_avg) where n = messages,
 * depth_avg ≤ ~20 for realistic rooms. Memoization is the caller's
 * responsibility (the room shell keys on `inputHash`).
 */
export function buildPointLifecycleMap(
  input: BuildPointLifecycleMapInput,
): PointLifecycleMap;

// ── Plain-language helper ──────────────────────────────────────

export function getPointLifecyclePlainLabel(state: PointLifecycleState): string;

// ── Forbidden-token sanity (used by ban-list test) ─────────────

/** The forbidden token list LIFE-001 ban-list assertions check. */
export function _forbiddenLifecycleTokens(): string[];
```

### `src/features/lifecycle/pointLifecycleClusters.ts` (internal helpers)

```ts
/** Group the timeline map's nodes by `branchRootMessageId`. */
export function groupNodesByCluster(
  nodes: ReadonlyArray<ArgumentTimelineMapNode>,
): ReadonlyMap<string, ReadonlyArray<ArgumentTimelineMapNode>>;

/** Walk parent chain to find a same-axis ancestor in the same cluster. */
export function findSameAxisAncestor(
  node: ArgumentTimelineMapNode,
  axis: PointLifecycleAxis,
  clusterMembers: ReadonlyArray<ArgumentTimelineMapNode>,
  nodeById: ReadonlyMap<string, ArgumentTimelineMapNode>,
): ArgumentTimelineMapNode | null;

/** Compute room-wide side turn sequence. Used by advisory rules. */
export function buildSideTurnSequence(
  nodes: ReadonlyArray<ArgumentTimelineMapNode>,
): ReadonlyMap<'affirmative' | 'negative', ReadonlyArray<string>>;

/** Compute per-message axis from existing fields. */
export function deriveAxis(node: ArgumentTimelineMapNode): PointLifecycleAxis | null;
```

### `src/features/lifecycle/pointLifecycleAdvisoryInputs.ts` (advisory threshold helpers)

```ts
/** Count distinct same-axis pressure moves under the cluster. */
export function countSameAxisPressure(
  cluster: ReadonlyArray<ArgumentTimelineMapNode>,
  axis: PointLifecycleAxis,
): number;

/** True when the move adds new evidence/scope/definition information. */
export function moveAddsAxisInformation(
  node: ArgumentTimelineMapNode,
  artifactStatus: SourceChainStatus | null,
): boolean;

/** Count room-wide turns since the side's last post to this cluster. */
export function turnsSinceSideEngagedCluster(
  side: 'affirmative' | 'negative',
  cluster: ReadonlyArray<ArgumentTimelineMapNode>,
  sideTurnSequence: ReadonlyMap<'affirmative' | 'negative', ReadonlyArray<string>>,
): number;

/** Count off-axis pressure moves under the cluster (branch_this_off /
 *  tangent_or_joke / MessageCategory === 'tangent'). Used by
 *  branch_recommended. */
export function countOffAxisPressure(
  cluster: ReadonlyArray<ArgumentTimelineMapNode>,
): number;
```

### `src/features/lifecycle/index.ts`

```ts
export {
  type PointLifecycleState,
  type PointLifecycleSnapshot,
  type PointLifecycleClusterSummary,
  type PointLifecycleMap,
  type PointLifecycleAxis,
  type LifecycleAdvisoryConfig,
  ALL_POINT_LIFECYCLE_STATES,
  LIFECYCLE_PRIORITY,
  DEFAULT_LIFECYCLE_ADVISORY_CONFIG,
  derivePointLifecycleSnapshot,
  deriveClusterLifecycleSummary,
  buildPointLifecycleMap,
  getPointLifecyclePlainLabel,
  _forbiddenLifecycleTokens,
} from './pointLifecycleModel';
```

---

## File changes

### New files

| Path | Purpose | Approx LOC |
|---|---|---:|
| `src/features/lifecycle/pointLifecycleModel.ts` | The 18-state model. Exports the enum, priority map, snapshot / cluster / map types, the three derivers (`derivePointLifecycleSnapshot`, `deriveClusterLifecycleSummary`, `buildPointLifecycleMap`), the plain-language helper, the forbidden-token list, the default advisory config. Pure TS. No React, no Supabase. | ~520 |
| `src/features/lifecycle/pointLifecycleClusters.ts` | Internal helpers: `groupNodesByCluster`, `findSameAxisAncestor`, `buildSideTurnSequence`, `deriveAxis`. Pure TS. | ~140 |
| `src/features/lifecycle/pointLifecycleAdvisoryInputs.ts` | Advisory input helpers: `countSameAxisPressure`, `moveAddsAxisInformation`, `turnsSinceSideEngagedCluster`, `countOffAxisPressure`. Pure TS. | ~120 |
| `src/features/lifecycle/index.ts` | Public re-exports. Single import surface for consumers. | ~25 |
| `__tests__/pointLifecycleModel.test.ts` | Pure-model tests: per-state derivation fixtures (one happy + one boundary each for all 18 states), per-message snapshot tests, cluster composition tests (resolution / synthesis / concession / open-request / advisory order), priority order assertions, ban-list, doctrine anchors (no heat/standing/popularity input), JSON-serializability. | ~620 |
| `__tests__/pointLifecycleAdvisories.test.ts` | Advisory tests: exhaustion threshold boundary, moved-on threshold boundary, ignored-by-side boundary, ignored-by-both boundary, branch-recommended boundary, "additive same-axis move does not exhaust" guardrail, advisory-state ≠ blocking assertion. | ~280 |
| `__tests__/pointLifecyclePlainLabels.test.ts` | Plain-language mapping tests: every state has a label, ban-list per label, `toPlainLanguage(state)` returns the same string as `getPointLifecyclePlainLabel(state)`, `looksLikeInternalCode` returns false for every label. | ~120 |
| `__tests__/pointLifecycleClustersIntegration.test.ts` | Integration: build a 50-node fixture with BR-001's branch model, run `buildPointLifecycleMap`, assert clusters match `branchRootMessageId` grouping, assert cluster sequence is chronological. | ~200 |

### Modified files

| Path | What changes | What stays |
|---|---|---|
| `src/features/arguments/gameCopy.ts` | Append 17 new entries to `PLAIN_LANGUAGE_COPY` for the 18 lifecycle codes (1 already present — `synthesis_ready` — gets its value updated from `'Near resolution'` to `'Ready for synthesis'`). NO new exported function added; `toPlainLanguage` already handles new keys. NO new file imports. | All existing entries (other than `synthesis_ready`), all existing exports (`toPlainLanguage`, `toPlainLanguageOrSuppress`, `looksLikeInternalCode`), all other constants. |

### Deleted files

None.

### Approximate test-count delta

**+115 to +145** tests across the four new test files, plus +1–2 minor adjustments in any existing `gameCopy.test.ts` (the existing test currently asserts `synthesis_ready` maps to a label — the same assertion passes with the new label; if the existing test checks the exact string, update it).

---

## UI contract — which surfaces consume the lifecycle map

LIFE-001 ships the **MODEL only**. The following surfaces are NOT touched by this card; they consume the map in their own cards:

- **SC-004 (Timeline node action dock)** reads `lifecycleStateByCluster[selectedClusterId]` to pick the action set. Per roadmap §8, the dock surfaces "Reply / Challenge / Ask source / Ask quote / Clarify / Add evidence / Narrow / Concede / Confirm / Mark moved on / Mark ignored / Branch / Synthesize / Flag" based on lifecycle state + actor.
- **ST-002 (Suggested reply flags)** reads `byMessage[messageId].messageContribution` + `byCluster[clusterId].state` to render suggested-move chips on Cards detail.
- **GAME-001 (Exhaustion advisories)** reads the four advisory states (`exhausted` / `moved_on_by_*` / `ignored_by_*`) and renders a chip on the rail's mini-map. GAME-001 may pass a custom `LifecycleAdvisoryConfig` if it tunes thresholds after AN-003 lands.
- **RULE-003 (Lifecycle-to-UX map)** extends `PLAIN_LANGUAGE_COPY` with helpers + action lists for each state. The label itself is LIFE-001's.
- **GAL-002 (Gallery first-suggested-move)** reads the root cluster's `state` (the cluster rooted at the room's root message) to seed the gallery card's hint.
- **IX-002 (Timeline mini-map)** reads `byCluster[clusterId].state` for the cluster summary chip.
- **AN-003 (Diagnostics)** reads `cumulativeStateSequence` for per-room aggregate counts.

LIFE-001 itself touches:

- **`gameCopy.ts`** — extends `PLAIN_LANGUAGE_COPY` with the 18 codes (the only modified file).

No timeline / sidecar / dock / gallery / stack screen is modified by this card. The model is built and unused until SC-004 / ST-002 wire it.

---

## Accessibility contract

LIFE-001 is a pure model — it has no rendered output. The plain-language labels in `PLAIN_LANGUAGE_COPY` are written to be screen-reader-safe:

- Every label is a complete English phrase (no internal codes, no abbreviations).
- Labels never contain emojis (the runtime banned-token assertion enforces).
- Labels never assume color is the only signal (per `timeline-grammar`, the label is the textual signal).
- Labels are ≤ 32 characters to fit chip layout per `accessibility-targets` minimum chip width.

When SC-004 / ST-002 / GAME-001 wire the labels into UI:

- `accessibilityLabel` should include the cluster state phrase ("Cluster: Ready for synthesis."), the cluster's plain label, and the actor's role.
- Tap targets on advisory chips ≥ 44×44 px per `accessibility-targets`.
- Reduced-motion: state-change announcements via `AccessibilityInfo.announceForAccessibility` only when the cluster state actually changes (debounced; not on every node selection).
- Color independence: the label IS the signal. SC-004 / RULE-003 may pair it with shape + stroke per `timeline-grammar`.

The implementer should add a placeholder `accessibilityLabel` field to `PointLifecycleClusterSummary` if SC-004's design needs it. **Not required for this card.**

---

## Edge cases

The implementer MUST handle each. Tests in §"Test plan" cover them by name.

1. **Empty room (`messages.length === 0`).** `buildPointLifecycleMap` returns `{ byCluster: new Map(), byMessage: new Map(), clusterOrder: [], cumulativeStateSequence: [], inputHash: '' }`. No clusters, no advisories.
2. **Root-only room (one message, no replies).** Single cluster keyed by the root's id. `clusterState === 'open'`. `byMessage[rootId].messageContribution === 'open'`.
3. **Deleted messages (`is_deleted: true` upstream).** Filtered upstream by the room shell before `buildArgumentTimelineMap`. The model sees them as if absent. Tests assert: if a fixture includes a soft-deleted node, it does not appear in `byMessage` or `byCluster.messageIds`.
4. **Detached messages (`isDetached: true`).** Form their own clusters (each detached node IS its own `branchRootMessageId`). `clusterState === 'open'` by default. Tests assert detached nodes do not poison the main cluster's lifecycle.
5. **Concurrent edits / new message arrives.** Memoization invalidates because `inputHash` changes (the last message id changes). One O(n) rebuild — no cumulative growth in cost.
6. **Own-bubble restrictions.** Lifecycle is read-only; there is no participant-action surface in this card. SC-004 (action dock) enforces actor-aware action sets. LIFE-001 simply reports state.
7. **Observer mode.** Lifecycle derivation is identical for observers. No state changes based on viewer identity; lifecycle describes the cluster, not the viewer.
8. **Very deep trees (depth ≥ 50).** Same-axis ancestor walk is O(depth). At depth 50 with 250 messages, the worst case is 250 × 50 = 12,500 comparisons — < 1 ms in V8.
9. **Oscillating concede / rebut sequences.** "A concedes → B rebuts the concession → A re-asserts" must NOT produce a stable `conceded` state. Rule: if a later same-axis `rebutted` exists *after* a `conceded` move, the cluster is `rebutted`. Tests assert with a fixture.
10. **Multiple concessions in one cluster.** Last-wins for cluster state composition (rule 3 of cluster summary). Earlier concessions still contribute to `byMessage[id].messageContribution`.
11. **Synthesis without prior concession.** Per rule 1 of per-message classifier, a synthesis-shape move contributes `synthesis_ready` regardless of whether a concession preceded it. Per rule 2 of cluster summary, the cluster-level `synthesis_ready` requires no open requests and no later rebuttal — so an unsupported synthesis (no concession first, no narrowing) still triggers `synthesis_ready` at the cluster level if no other dominant state applies. This is intentional: a user explicitly synthesizing is doing the gameplay work.
12. **Open request resolved by a different axis.** "A asks for source on the fact axis → B responds with a scope-narrowing move." The source request is NOT closed by a scope move. Tests assert: `source_requested` remains until a `sourced` move on the same axis lands.
13. **Open request resolved by external evidence.** "A asks for source → C (third-party participant) attaches a source." The request is closed. Tests assert.
14. **Admin-resolved cluster.** A cluster whose root or any member carries `flagCodes` `argument_resolved` or `archived_by_admin` → `archived_or_resolved` per rule 2 of per-message classifier. Resolution dominates everything else per rule 1 of cluster summary.
15. **Cluster with only requests (no answers).** A cluster of 1 root + 1 source request, no other activity → `source_requested`. After `ignoredBySideTurnThreshold` turns without response → `ignored_by_<requestee-side>`.
16. **Repeated tangent qualifier.** ≥ 2 messages tagged `branch_this_off` / `tangent_or_joke` under the same root → `branch_recommended`. The 2-message threshold (default) is intentionally low; tangents are visible and one or two is normal.
17. **No advisory threshold reached + ordinary open state.** Cluster stays `open` / `answered` indefinitely (no advisory fires). This is the v1 default — quiet rooms are not flagged stale.
18. **Both sides observer.** Both are in `observer_only`. No advisory fires for `moved_on_by_*` / `ignored_by_*` (advisories require side identification). `synthesis_ready` / `narrowed` / `conceded` can still fire.
19. **The clusterId-to-message-id mapping changes mid-render.** Cannot happen — `branchRootMessageId` is deterministic from the surface model's chronological + sibling-index pass. Tests assert: stable input → stable cluster ids.
20. **Empty advisory threshold (operator passes `0`).** Defensive — the model treats `0` as "fire immediately on first turn." This is the GAME-001 tuning path; LIFE-001 ships safe defaults. Tests assert behavior at threshold = 0 + threshold = 999.
21. **`PointLifecycleAxis === 'unaxed'`.** Messages without a derivable axis cannot create exhaustion pressure (the "same-axis ancestor" check returns null). They count as ordinary `answered` contributions. Doctrine: no-axis = no pressure credit per `point-standing-economy` skill, same logic applies to lifecycle.
22. **Synthesis that arrives after an existing `archived_or_resolved`.** Resolution dominates per rule 1 of cluster summary — the synthesis still contributes `synthesis_ready` at the per-message level but the cluster stays `archived_or_resolved`.
23. **`getPointLifecyclePlainLabel` for an extended state.** If a future card adds a 19th state, the type system catches the missing entry in `LIFECYCLE_PRIORITY` and `PLAIN_LANGUAGE_COPY`. Tests use `ALL_POINT_LIFECYCLE_STATES` for iteration so the new state is automatically covered.

---

## Test plan

Tests follow `test-discipline` — pure-model tests in `__tests__/`, no React, no Supabase, no network.

### `__tests__/pointLifecycleModel.test.ts` (~620 lines)

Pure-model tests for the 18-state classifier, snapshot composition, and tree-level entry point.

**Per-state derivation (one happy + one boundary for each of 18)**

For each `PointLifecycleState`:
- Build a minimal fixture (2–6 messages) that produces the target state at the cluster level.
- Assert `buildPointLifecycleMap(input).byCluster.get(clusterId).state === expectedState`.
- Assert the chronologically-last member's `byMessage.get(id).messageContribution` is consistent with the derivation rule.
- Assert the cluster's `plainLabel` equals `PLAIN_LANGUAGE_COPY[state]`.

Tests for `archived_or_resolved`, `synthesis_ready`, `conceded`, `narrowed`, `confirmed`, `sourced`, `quote_requested`, `source_requested`, `clarified`, `rebutted`, `answered`, `open` are straightforward fixtures.

Tests for the four advisories (`exhausted`, `moved_on_by_affirmative`, `moved_on_by_negative`, `ignored_by_affirmative`, `ignored_by_negative`, `ignored_by_both`, `branch_recommended`) are covered in `pointLifecycleAdvisories.test.ts`.

**Cluster composition order**

- Resolution beats synthesis: a cluster with both `archived_or_resolved` and `synthesis_ready` contributions is `archived_or_resolved`.
- Synthesis beats concession: a cluster with both `synthesis_ready` and `conceded` contributions is `synthesis_ready` (when no open request blocks it).
- Open request beats pressure: a cluster with both `source_requested` and `rebutted` contributions is `source_requested`.
- Concession at the end beats pressure: a `conceded` chronologically-last contribution wins over an earlier `rebutted`.
- Rebut after concession invalidates: "A concedes → B rebuts" → `rebutted`.
- Sourced answer closes a source request: "A asks for source → B sources" → `sourced`.

**Per-message snapshot fields**

- `axis` is correctly derived from `disagreementAxis` + qualifier codes + argument-type fallback.
- `opensRequest` is true for `source_requested` / `quote_requested` contributions; false otherwise.
- `resolvesRequest` is true for `sourced` contributions when a same-axis parent or earlier cluster member had an open request.
- `isConcessionShape` is true for `conceded` / `narrowed` contributions.
- `isSynthesisShape` is true for `synthesis_ready` contributions.

**Map shape**

- `byCluster.keys()` equals the chronologically-ordered set of `branchRootMessageId`s in the surface model.
- `clusterOrder.length === byCluster.size`.
- `cumulativeStateSequence.length === clusterOrder.length`.
- `inputHash` changes when any input field changes; reference-equal when inputs are reference-equal.

**Priority order assertions**

- Every state has a numeric priority in `LIFECYCLE_PRIORITY`.
- `LIFECYCLE_PRIORITY['archived_or_resolved'] < LIFECYCLE_PRIORITY['open']`.
- `LIFECYCLE_PRIORITY['exhausted'] > LIFECYCLE_PRIORITY['rebutted']`.
- `LIFECYCLE_PRIORITY['ignored_by_both'] > LIFECYCLE_PRIORITY['ignored_by_affirmative']`.

**Doctrine anchor — heat / standing / popularity do not feed lifecycle**

- Build two identical fixtures, one with every node's `standingBand === 'completely_right'`, one with `'pretty_wrong'`. Assert `buildPointLifecycleMap` returns deep-equal `byCluster` and `byMessage`.
- Same for `toneBand` (`calm` vs `hostile`).
- Same for `temperatureBand` (`cool` vs `hot`).
- Same for `topicScore` (`0.95` vs `0.1`).
- All four assert deep equality, confirming the classifier never reads these signals.

**Doctrine anchor — `ignored_by_*` is cluster, not user**

- Build a fixture where a single user posts to multiple unrelated clusters. Only the cluster with the open request fires `ignored_by_affirmative`; other clusters are unaffected.
- Ban-list scan of every produced label and `plainLabel`: zero person-attribution tokens (`troll`, `bot`, `astroturfer`, `liar`, `dishonest`).

**Doctrine anchor — concession is repair, not defeat**

- Build a fixture: cluster ends with `conceded`. Assert `clusterState === 'conceded'`. Cross-reference: the doctrine line "Concession does NOT mean the conceding side lost the room." Lifecycle reports `conceded`; point-standing per its own module reports the broad-lift effect (separate concern, not tested here — assert only that LIFE-001 does NOT emit a `lost` / `defeated` flag).

**Ban-list — verdict tokens**

- For every `PointLifecycleState`: `getPointLifecyclePlainLabel(state)` contains zero tokens from `['winner', 'loser', 'correct', 'incorrect', 'true', 'false', 'liar', 'dishonest', 'bad faith', 'manipulative', 'extremist', 'propagandist', 'troll', 'bot', 'astroturfer', 'verdict', 'proof', 'proven', 'disproven', 'lost', 'defeated', 'won']`.

**Ban-list — amplification tokens**

- Same: `['likes', 'retweets', 'shares', 'views', 'followers', 'verified', 'engagement', 'amplification', 'trending', 'virality', 'popular', 'viral']`.

**Ban-list — snake_case codes**

- `looksLikeInternalCode(getPointLifecyclePlainLabel(state))` returns `false` for every state.

**JSON-serializability**

- `JSON.parse(JSON.stringify(Array.from(map.byCluster.entries())))` round-trips successfully and produces deep-equal data (after rebuilding the `Map`).

**Performance**

- 250-message synthetic fixture (50 clusters × 5 messages each): `buildPointLifecycleMap` returns in < 30 ms in a Jest run. Verified via `performance.now()`.

**Edge cases (numbered to match §"Edge cases")**

- Empty room (1), root-only (2), detached (4), deeply nested (8), oscillating (9), multiple concessions (10), synthesis without concession (11), cross-axis non-closure (12), external evidence (13), admin-resolved (14), open-request-only cluster (15), repeated tangent (16), quiet cluster (17), observer-both (18), `axis === unaxed` (21), synthesis-after-resolved (22).

### `__tests__/pointLifecycleAdvisories.test.ts` (~280 lines)

Threshold-boundary tests for the four advisories.

**Exhaustion**

- Build a cluster with 2 same-axis pressure moves, no new info → state is `rebutted`, NOT `exhausted`.
- 3 same-axis pressure moves with no new info → `exhausted`.
- 3 same-axis pressure moves where the 3rd attaches an `EvidenceArtifact` → `rebutted` (additive move; exhaustion counter does NOT increment).
- 3 same-axis pressure moves where the 3rd carries `narrow_scope` qualifier → `rebutted` (additive).
- 4 same-axis pressure moves, none additive → `exhausted` (threshold once reached, state holds).
- Custom config with `exhaustionRepeatThreshold === 1`: 1 pressure move → `exhausted` (defensive).

**Moved on**

- Side has posted to other clusters 3 turns ago, no recent posts to this cluster, threshold 4 → `rebutted` / `answered` (not moved-on).
- Side has posted to other clusters 5 turns ago, no recent posts to this cluster, no open request directed at them → `moved_on_by_<side>`.
- Side has posted to other clusters 5 turns ago BUT cluster has an open request directed at them → NOT `moved_on_by_<side>` (the side has an obligation to answer; ignored advisory may apply instead).

**Ignored by one side**

- Side has open request on cluster, 3 room-wide turns since with response → `ignored_by_<side>` (threshold met).
- Side responded within the threshold → request is closed; `ignored_by_<side>` does NOT fire.
- The "other side" has the open request; only the requestee side can be `ignored_by_<requestee>`.

**Ignored by both**

- Both sides dormant on cluster for ≥ 6 room-wide turns AND there is an open request → `ignored_by_both`.
- Both sides dormant for < 6 turns → not yet `ignored_by_both`.
- Both sides dormant for ≥ 6 turns BUT no open request → cluster stays `open` (`ignored_by_both` requires the request).

**Branch recommended**

- 1 message tagged `branch_this_off` → not yet `branch_recommended` (threshold default 2).
- 2 messages tagged `branch_this_off` under the same root → `branch_recommended`.
- 2 messages with `MessageCategory === 'tangent'` (derived upstream) → `branch_recommended`.
- 1 `branch_this_off` + 1 `tangent_or_joke` → `branch_recommended` (both count).

**Advisory ≠ blocking**

- Critical test: explicit assertion that LIFE-001 produces NO `block` / `prevent` / `reject` flag on any state.
- Programmatic check: `JSON.stringify` every state's snapshot, scan for the strings `'block'`, `'prevent'`, `'reject'`, `'forbid'`, `'disallow'`, `'denied'`. Zero matches.

**Doctrine anchor — exhausted is "out of new angles", not "you lost"**

- Plain label assertion: `getPointLifecyclePlainLabel('exhausted') === 'Out of new angles'`.
- Ban-list scan as above.

### `__tests__/pointLifecyclePlainLabels.test.ts` (~120 lines)

Plain-language mapping coverage.

- For every state in `ALL_POINT_LIFECYCLE_STATES`:
  - `toPlainLanguage(state)` returns a non-empty string.
  - `getPointLifecyclePlainLabel(state)` returns the same string.
  - `looksLikeInternalCode(label)` returns `false`.
  - Label ≤ 32 characters.
  - Label is mixed-case English (not snake_case, not ALL CAPS).
- `synthesis_ready` label assertion: the value is `'Ready for synthesis'` (the updated label).
- Backward compat: existing `PLAIN_LANGUAGE_COPY` codes (`source_chain`, `evidence_debt`, `synthesis`, `concession`, etc.) are unchanged.

### `__tests__/pointLifecycleClustersIntegration.test.ts` (~200 lines)

Integration with BR-001's branch model.

- Build a 50-node synthetic fixture: 1 root + 4 branches × 12 messages each + 1 tangent off branch 2.
- Run `buildArgumentTimelineMap` → run `buildBranchKindMap` (BR-001) → run `buildPointLifecycleMap`.
- Assert `byCluster.size === 5` (root cluster + 4 branch clusters).
- Assert `clusterOrder[0]` is the root cluster.
- Assert the tangent's cluster id matches the BR-001 branch root id.
- Assert no cluster spans across BR-001 branch boundaries (cluster boundaries == BR-001 branch root boundaries).
- Assert collapsed branches (from `BranchCollapseState`) do NOT change lifecycle derivation — visible vs hidden is a UI concern, lifecycle reads the underlying tree.

### Integration touches

- `__tests__/gameCopy.test.ts` (existing) — if the existing test asserts `PLAIN_LANGUAGE_COPY['synthesis_ready'] === 'Near resolution'`, update the assertion to `'Ready for synthesis'`. Comment in the test file referencing LIFE-001.
- No existing test files in `src/features/arguments/` need updates — LIFE-001 doesn't touch those modules.

### Coverage target

- 100% line + branch coverage on `pointLifecycleModel.ts`, `pointLifecycleClusters.ts`, `pointLifecycleAdvisoryInputs.ts` (achievable — pure-TS, no I/O, every branch reachable from the decision table).
- ≥ 95% coverage on `index.ts` (re-exports only — auto-covered).

---

## Doctrine / safety self-check

- **A lifecycle state is a gameplay signal, never a verdict.** Ban-list test enforces; doctrine-anchor test asserts no truth/heat/popularity input affects output. ✓
- **No verdict / person-label tokens in any produced string.** `PLAIN_LANGUAGE_COPY` extension ban-list scanned. `getPointLifecyclePlainLabel` ban-list scanned. ✓
- **`ignored_by_*` describes a cluster, never a user.** No user identifier appears in any lifecycle state; the side label (`affirmative` / `negative`) is a cluster property. Test asserts a single user posting to multiple clusters does not "tag" the user. ✓
- **Concession is a repair, not a defeat.** No `lost` / `defeated` / `won` token in any label. The doctrine line is anchored in the model file's docblock + tested. ✓
- **Exhaustion / moved-on / ignored / branch-recommended are ADVISORIES, never blocking.** Programmatic assertion: zero `block` / `prevent` / `reject` / `forbid` / `disallow` / `denied` tokens in any produced field. ✓
- **No raw `snake_case` codes in user-facing labels.** `looksLikeInternalCode` returns `false` for every label. ✓
- **No heat / popularity / engagement / virality / strength-band input.** Deep-equal classifier output regardless of `standingBand` / `toneBand` / `temperatureBand` / `topicScore` value. Tests assert. ✓
- **No service-role / no direct insert / no production AI / no Supabase mutation / no `.env*` changes.** Pure-TS model. No network. No DB. No Edge Function. No env. ✓
- **Rules engine stays pure.** `src/lib/constitution/engine.ts` untouched. ✓
- **AI moderator hard limits.** No AI call. No `authoritative: true` flag emitted. ✓
- **v1 scope guards.** No voting, no search, no push, no OAuth, no public API. ✓
- **BR-001 surface lock.** `RailBranchKind` / `RailSegmentInput` / `branchTopologyModel.deriveBranchKindFromConstitutionModel` signatures unchanged. LIFE-001 reads them; it does not modify them. ✓
- **VG-002 surface lock.** Rail rendering contract untouched. ✓
- **EV-001 / EV-002 surface lock.** `EvidenceArtifact` / `SourceChainStatus` / `getTimelineEvidenceContract` consumed read-only. ✓
- **No new dependency.** `package.json` unchanged. Pure-TS only. ✓
- **No persistence.** Lifecycle state is computed per render. No Supabase column, no migration, no Edge Function. Future v2 may persist; not in v1. ✓
- **Accessibility — color independence.** Labels are the textual signal. No surface in this card. ✓
- **Accessibility — reduce-motion.** No animation in this card. ✓
- **Performance — O(n + n × depth_avg).** Verified in §"Test plan"; 250-message synthetic fixture < 30 ms. ✓
- **JSON-serializability.** Verified by test (round-trip via JSON.parse / JSON.stringify). ✓
- **All inputs are read from existing fields.** LIFE-001 never re-derives `MessageCategory`, never re-classifies axis, never re-runs anti-amplification. Reads only existing `droppedTags[].code` / `argumentType` / `disagreementAxis` / `flagCodes`. ✓
- **`PLAIN_LANGUAGE_COPY` is the single source of plain-language truth.** No parallel map introduced. Existing `synthesis_ready` entry updated in place (value change only; key unchanged). ✓

---

## Operator steps

**None — pure code change.** LIFE-001 adds:

- 4 new TS files in `src/features/lifecycle/`.
- 4 new test files in `__tests__/`.
- 1 modified file (`src/features/arguments/gameCopy.ts` — extends `PLAIN_LANGUAGE_COPY` by 17 entries + updates `synthesis_ready` value).

No migration, no Edge Function deploy, no Supabase write, no env change, no new dependency. Operator runs the standard pre-PR checks during Review:

```powershell
npm run typecheck
npm run lint
npm run test
```

Expected test-count delta: approximately **+115 to +145**.

---

## Dependencies (cards / docs / files)

### LIFE-001 consumes (from shipped surfaces)

- **BR-001 (`branchTopologyModel.ts`)** — `buildEvidenceThreadMap` (cross-check axis); not strictly required for v1 derivation but architecturally available. **Used:** `branchRootMessageId` on `ArgumentTimelineMapNode` as the cluster identifier. **Not used (in v1):** `BranchCollapseState` (collapse is a UI concern; lifecycle reads the underlying tree regardless of visibility).
- **`argumentGameSurfaceModel.ts`** — `ArgumentTimelineMapNode` / `ArgumentTimelineMapEdge` / `ArgumentTimelineMapModel`. Read-only consumer of `messageId`, `parentId`, `branchRootMessageId`, `siblingIndex`, `replyCount`, `descendantCount`, `kindColorFamily`, `droppedTags`, `actorLabel`, `sideLabel`, `ordinal`, `createdAt`. Does NOT consume `standingBand`, `toneBand`, `temperatureBand`, `topicScore`, `kindColor`, or gradient fields.
- **`messageQualifiers.ts`** — `MessageCategory` / `MessageQualifier` types referenced in docs only; the qualifier codes are read via `droppedTags[].code` (already populated by `mapDroppedTags` upstream). Does NOT call `deriveMessageCategory` per render.
- **`evidence/evidenceModel.ts`** — `EvidenceArtifact`, `SourceChainStatus`, `summarizeArtifactsForReceiptChip`, `getTimelineEvidenceContract`. Consumed read-only to derive `sourced` / `source_requested` / `quote_requested` contributions.
- **`pointStanding/types.ts`** — `PointStandingDelta`, `OpenIssueDebt`, `ConcessionEffect`. Referenced in docs; LIFE-001 does NOT call `gradeChallenge` / `gradeRepair`. Lifecycle reports move structure; point-standing reports score outcomes — separate concerns.
- **`pointStanding/antiAmplification.ts`** — Referenced in docs; LIFE-001 does NOT call `applyAntiAmplification`. Anti-amplification post-processes *standing*, not lifecycle.
- **`arguments/gameCopy.ts`** — `PLAIN_LANGUAGE_COPY` (extended in place), `toPlainLanguage`, `looksLikeInternalCode`. Single source of plain-language truth.

### LIFE-001 blocks

- **META-001** — Manual tag / auto metadata ledger reads `lifecycleStateByCluster` for the "concession_offered" / "ready_for_synthesis" auto-tag derivations.
- **SC-004** — Timeline node action dock reads lifecycle state to drive the action set.
- **ST-002** — Suggested reply flags reads lifecycle state for per-bubble suggestions.
- **GAME-001** — Exhaustion advisories tune the four advisory threshold constants; consume the same derivation entry point.
- **RULE-003** — Lifecycle-to-UX doctrine map extends `PLAIN_LANGUAGE_COPY` with helpers + action lists.
- **GAL-002** — Gallery first-suggested-move hint reads the root cluster's lifecycle state.
- **AN-003** — Tree playability diagnostics aggregates per-room counts.

Per `docs/ux-ui-project-board.md` line 411: "LIFE-001 blocks META-001, ST-002 expansion, GAL-002 expansion, GAME-001, RULE-003 (lifecycle state is the input)."

### LIFE-001 is blocked by

- **BR-001 (shipped — `6097802`)** — cluster id (`branchRootMessageId`) and branch identity come from BR-001's surface model.
- **EV-001 (shipped)** — `SourceChainStatus` / `EvidenceArtifact` model.
- **Stage 6.1.5.1 message qualifiers (shipped)** — qualifier codes on `droppedTags[].code`.
- **Stage 6.1.4 point-standing (shipped)** — referenced for doctrine cross-check only; not consumed.
- **Stage 6.4 gameCopy.toPlainLanguage (shipped)** — the plain-language extension lives in the existing table.

All prerequisites are merged.

---

## Risks

1. **Re-deriving signals from scratch instead of reading existing fields.** This is roadmap §16 risk #1 by name. Mitigation: the design lists EVERY input field by name; the classifier API has explicit guards in tests ("does not call `deriveMessageCategory`" — verified by reading source under the test). A test scans `pointLifecycleModel.ts` for imports of `MessageCategory` deriver functions; the test fails if `deriveMessageCategory` or `derivePrimaryQualifier` is imported. (Type imports are OK; function imports are not.)
2. **Advisory thresholds wrong for v1.** A wrong `exhaustionRepeatThreshold` value could fire `exhausted` too eagerly and nag users. Mitigation: v1 defaults are conservative (3 same-axis repeats + no additive info — most rooms won't hit it). GAME-001 will tune after AN-003 lands. The thresholds are explicit constants, easy to change without touching the model.
3. **`ignored_by_*` framing might read as a personal accusation.** Mitigation: the plain label is `"Affirmative did not respond"` — descriptive of the *cluster*, not the *user*. Ban-list test guards against any person-attribution token slipping in.
4. **Concession composition might allow gaming.** "Concede → silently rebut → repeat" — a user could try to oscillate the cluster between `conceded` and `rebutted` to farm a UI effect. Mitigation: lifecycle is read-only at the data layer (no persistence), so there is nothing to farm. Score-side gaming is the `pointStanding/antiAmplification.ts` concern; LIFE-001 is silent on score.
5. **The 18-state vocabulary is too large.** SC-004 + ST-002 will have to map all 18 to action sets / suggestions. Mitigation: the priority table collapses 18 states into 6 priority tiers; UI surfaces consume the tier when fine granularity isn't needed. RULE-003 may also alias states (e.g., treat `moved_on_by_affirmative` and `moved_on_by_negative` as the same "moved on" action in some surfaces).
6. **`synthesis_ready` plain-label change breaks an existing test.** Mitigation: the existing `gameCopy.test.ts` test (if it asserts the value) needs a one-line update. The implementer must search for the exact string `'Near resolution'` and update any test assertion. The runner pipeline reads the code, not the label, so no runner-side regression.
7. **Performance at 250+ messages.** Same-axis ancestor walk is O(depth) per message. Worst case (path-graph, depth 250) = 250 × 250 = 62,500 comparisons. Mitigation: realistic rooms have depth < 50. The test asserts < 30 ms at 250 messages. If a real room ever hits the pathological case, a memoized parent-axis-chain cache per cluster is a < 20-LOC follow-up.
8. **`branchRootMessageId` redefinition by a later card.** Cluster id depends on BR-001's `branchRootMessageId`. If BR-002 or a future refactor changes the boundary rule, LIFE-001's cluster boundaries change. Mitigation: the cluster boundary IS the BR-001 contract; LIFE-001 explicitly imports it. Tests assert cluster boundaries match BR-001 outputs.
9. **EV-001 contract change.** `SourceChainStatus` is the input to `sourced` / `source_requested` derivations. Mitigation: LIFE-001 reads `summarizeArtifactsForReceiptChip` (EV-001's stable export), not the internal status fields. If EV-001 adds a new status value, LIFE-001's `worstEvidenceStatus` field auto-typechecks; the derivation rules might need a one-line update.
10. **Future META-001 might duplicate lifecycle derivation.** META-001 owns manual tags + auto metadata. The risk is META-001 re-deriving "this cluster is ready for synthesis" from scratch. Mitigation: this design doc explicitly lists which auto-metadata kinds (`synthesis_candidate`, `point_stalled`, `point_exhausted`, `branch_suggested`, etc.) should consume LIFE-001's output. META-001's design doc must cross-reference.

---

## Do not implement in this card

Explicit list of related work that LIFE-001 does NOT include. Reduces scope creep.

- **META-001 manual tag / auto metadata ledger.** Manual tags + auto-derived metadata are META-001's responsibility. LIFE-001 produces the lifecycle state; META-001 produces the tag set and the event log.
- **GAME-001 exhaustion threshold tuning.** LIFE-001 ships safe defaults; GAME-001 may tune.
- **RULE-003 lifecycle-to-UX doctrine map.** Helpers + action lists per state are RULE-003's; LIFE-001 ships only the labels.
- **SC-004 timeline node action dock.** No UI in this card.
- **ST-002 suggested reply flags.** Suggestion derivation is ST-002's; LIFE-001 ships the input.
- **GAL-002 gallery first-suggested-move.** Gallery card hint sourcing is GAL-002's; LIFE-001 ships the input.
- **AN-003 diagnostics.** Per-room aggregate counts is AN-003's; LIFE-001 ships the input.
- **Persistence.** No `point_lifecycle_events` table. No migration. No Supabase write. v1 is render-time only.
- **Edge Function.** No `derive-lifecycle` or similar. Pure-TS only.
- **AI inference.** No Anthropic / xAI / OpenAI call. No `authoritative: true` flag emitted.
- **`submit-argument` change.** No change to the existing posting flow. Lifecycle is a downstream consumer.
- **Constitution engine change.** Out of scope.
- **`RailBranchKind` / `RailSegmentInput` / `argumentGameSurfaceModel` mutation.** All consumed read-only.
- **`PointStandingDelta` / `OpenIssueDebt` mutation.** Read-only references in docs; no calls.
- **Anti-amplification post-processing of lifecycle.** Anti-amplification operates on standing, not lifecycle. The doctrine guardrail is in this card's docblock, not in code.
- **Adding new color or stroke tokens.** No visual layer in this card.
- **A new UI surface for lifecycle.** SC-004 / ST-002 / GAME-001 / RULE-003 ship the UIs.
- **Auto-archiving an `archived_or_resolved` cluster.** Per doctrine, lifecycle is non-blocking. Admin resolution is set upstream via the `flagCodes` field, not by LIFE-001.
- **Persisting `BranchCollapseState`.** BR-001 already says no; LIFE-001 doesn't touch it.
- **Animation / transitions on lifecycle state change.** No UI; no animation.
- **Keyboard shortcut for cycling lifecycle states.** No UI.
- **Adding lifecycle to the constitution version JSON.** Lifecycle is computed at render time; not a constitution concern.

---

## Discovery / follow-up candidates (per §18 backlog policy)

These appeared while walking the design. Each passes the three-criterion test (removes timeline friction, deterministically testable, no new dependency / live AI / service-role). They are NOT part of LIFE-001 acceptance; file as P2 issues after LIFE-001 lands.

- **COPY-001 (already noted in roadmap §18)** — Plain-language label review with a PR for every state. The labels in `LIFECYCLE_PLAIN_LABEL` are the v1 default; copy review would tune for tone (per RULE-003).
- **HIST-001 (already noted in roadmap §18)** — Lifecycle event history in Cards detail. LIFE-001 ships per-render `cumulativeStateSequence`; HIST-001 adds an event-log view of cluster state transitions over time.
- **NAV-004 (already noted in roadmap §18)** — Unresolved point queue sidebar. Consumes `byCluster` filtered to advisory + open-request states.
- **LIFE-002 (new)** — Persisted lifecycle event ledger. If META-001 later wants to persist transitions to a `point_lifecycle_events` table, that's a separate card with operator-approved migration. LIFE-001 stays render-time.
- **LIFE-003 (new)** — Memoized cluster-level `byCluster` cache per room. LIFE-001 ships `inputHash` for memoization; LIFE-003 wires it into the room shell.

---

## Designer's eight answers (operator's standing prompt)

1. **What does this card define that later cards consume?**
   - The 18-state `PointLifecycleState` vocabulary, the `LIFECYCLE_PRIORITY` worst-priority-wins table, the per-message `PointLifecycleSnapshot`, the per-cluster `PointLifecycleClusterSummary`, the per-tree `PointLifecycleMap`, the `LifecycleAdvisoryConfig` thresholds, and the v1 plain-language labels for all 18 states.

2. **What should later cards NOT redefine?**
   - The 18 state codes (the vocabulary is locked). The priority table. The derivation rules. The cluster boundary (= `branchRootMessageId`). The plain-language labels (RULE-003 may extend with helpers; the labels themselves are LIFE-001's). The advisory state names (`exhausted` / `moved_on_by_*` / `ignored_by_*` / `branch_recommended`).

3. **Which existing module owns the model?**
   - A new module: `src/features/lifecycle/`. Not under `pointStanding/` (lifecycle ≠ scoring) and not under `arguments/` (would push that directory toward 20 files). New directory leaves room for META-001 and GAME-001 to live alongside.

4. **Which UI copy is normal-user-facing?**
   - All 18 plain-language labels in `PLAIN_LANGUAGE_COPY` (extended). Examples: `"Open for response"`, `"Under pressure"`, `"Ready for synthesis"`, `"Out of new angles"`, `"Affirmative did not respond"`. Zero internal codes. Zero verdict tokens.

5. **Which states are internal only?**
   - None. All 18 are user-visible via RULE-003's eventual surfaces. Internal-only fields are limited to `PointLifecycleSnapshot.opensRequest`, `resolvesRequest`, `isConcessionShape`, `isSynthesisShape` — these drive UI behavior but are not labels.

6. **Which actions are participant-only vs observer-safe vs own-bubble restricted?**
   - LIFE-001 ships NO action surface. It is a read-only model. SC-004 owns the actor-aware action set. The lifecycle state itself is identical for all viewers (observer / participant / admin) — derivation does not depend on viewer identity.

7. **Which tests prove acceptance?**
   - Per-state derivation (18 happy + 18 boundary). Cluster composition order (5 tests). Advisory threshold boundaries (4 advisory states × 3 boundaries = 12 tests). Doctrine anchors (4 deep-equal tests + 3 ban-list categories). JSON-serializability (1 round-trip test). Performance (1 < 30 ms at 250 messages). Integration with BR-001 (5 tests). Plain-language coverage (18 label tests + 4 doctrine tests). Total: ~115–145 new tests.

8. **What would make this card block Build?**
   - (a) BR-001 surface lock break — if `branchRootMessageId` semantics change, LIFE-001's cluster boundaries change.
   - (b) EV-001 contract change — if `SourceChainStatus` adds a value LIFE-001 doesn't handle, `sourced` / `source_requested` derivations are incomplete.
   - (c) Missing `flagCodes` upstream — `archived_or_resolved` rule requires `flagCodes` to be populated; the room shell may need a one-line addition. (Verify the upstream `loadDebateArguments` returns `flagCodes` — if not, that's a build-time blocker.)
   - (d) `messageQualifiers.deriveMessageCategory` accidentally imported as a function — the test scan asserts the model file imports types only.
   - (e) `gameCopy.PLAIN_LANGUAGE_COPY` schema change — if Stage 6.5 splits the table, the LIFE-001 extension must follow the new schema.

---

## Discovery — designer raised one boundary concern

**Boundary concern: does META-001 actually need to ship before LIFE-001 can be wired into the UI?**

Per the dependency chart in `docs/ux-ui-project-board.md` line 411: "LIFE-001 blocks META-001". The roadmap says Wave 1 ordering is BR-001 → LIFE-001 → META-001. LIFE-001 produces the lifecycle state; META-001 produces tag / metadata events that *consume* lifecycle state.

I have audited this card to ensure LIFE-001 can ship completely without META-001:

- LIFE-001 does NOT need META-001's `ManualTag[]` or `AutoMetadata[]` shapes. The `PointCluster.manualTags` / `autoMetadata` fields in roadmap §5 are META-001's; this card's `PointLifecycleClusterSummary` does NOT include them.
- LIFE-001 does NOT emit auto-metadata events (`point_exhausted`, `synthesis_candidate`, etc.). META-001 may derive these from LIFE-001 state changes.
- LIFE-001's tests, doctrine anchors, and UI consumers (SC-004 / ST-002 / GAME-001 / RULE-003) all reference lifecycle state directly, never via a META-001 layer.

**Conclusion: LIFE-001 ships cleanly without META-001.** META-001 is a downstream consumer. No card split or new issue needed.

A small note for the META-001 designer (when that card is reached): consider whether the `synthesis_candidate` auto-metadata kind is redundant with LIFE-001's `synthesis_ready` state. If META-001 finds it does nothing on top of LIFE-001 for that case, the kind may be retired.

---

## Summary for the implementer

Build a new pure-TS module at `src/features/lifecycle/` with three files (`pointLifecycleModel.ts`, `pointLifecycleClusters.ts`, `pointLifecycleAdvisoryInputs.ts`) plus an `index.ts` re-export. Add 17 entries to `gameCopy.ts` `PLAIN_LANGUAGE_COPY` (one — `synthesis_ready` — gets its value updated). Write four new test files. Do not modify any other source file. Run typecheck + lint + test before opening a PR. Expected test-count delta: +115 to +145.

Everything else — the action dock, the suggestions, the diagnostics, the gallery hint — is a downstream card. LIFE-001 ships the shared input; the rest of Wave 1–4 consumes it.
