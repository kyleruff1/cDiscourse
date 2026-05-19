# META-001 — Move tag / flag / metadata event ledger

**Status:** Design draft
**Epic:** Epic 12 — Evidence-Enhanced Game Rules and Flow (Rules UX)
**Release:** 6.6
**Wave:** 1 (Foundation)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/62
**Branch:** `feat/META-001-move-tag-flag-metadata-event-ledger`
**Card body:** `C:\Users\kyler\AppData\Local\Temp\cd-roadmap-context\META-001.md`
**Depends on (all shipped):** BR-001 (`branchTopologyModel.ts` — `branchRootMessageId`, `BranchCollapseState`, `buildEvidenceThreadMap`, `isEvidenceLikeNode`), LIFE-001 (`pointLifecycleModel.ts` — `PointLifecycleState`, `PointLifecycleMap`, `PointLifecycleSnapshot`, `PointLifecycleClusterSummary`, `getPointLifecyclePlainLabel`), `argumentGameSurfaceModel.ts` (`ArgumentTimelineMapNode`, `ArgumentTimelineMapEdge`, `ArgumentTimelineMapModel`, `TimelineDroppedTag`), EV-001 (`evidenceModel.ts` — `EvidenceArtifact`, `SourceChainStatus`, `summarizeArtifactsForReceiptChip`), EV-002 (`sourceChainPopoverModel.ts`), `messageQualifiers.ts` (`MessageCategory`, `MessageQualifier` — TYPE imports only), `pointStanding/antiAmplification.ts` (referenced for doctrine; never called), `gameCopy.ts` (`PLAIN_LANGUAGE_COPY`, `toPlainLanguage`, `looksLikeInternalCode`).

---

## Goal

META-001 introduces the **per-move metadata layer** that ties each reply back to (a) the point it acts on, (b) the manual gameplay annotations a participant attached, and (c) the auto-derived signals the system observes from the move's structure. It produces three deterministic shapes per debate tree: a `MoveLinkageRecord` per non-deleted message, a `MoveMetadataLedger` per tree, and a `MetadataEvent` log of add/remove/transition events keyed by move. Later cards (SC-004 action dock, ST-002 Cards suggestions, GAME-001 advisories, RULE-003 plain-language map, GAL-002 gallery hints, AN-003 diagnostics) consume the ledger to drive their surfaces. Building those surfaces on ad-hoc derivations would refragment the doctrine and re-cross the manual-tag-vs-moderation-flag boundary that this card explicitly fixes (roadmap §16 risk #4).

The model is doctrine-anchored on six sentences:

1. **A manual tag is a participant annotation, never a verdict.** It signals "this move could use a source" — not "this move is wrong."
2. **An auto-derived metadata code is an observation about move structure, never a truth claim.** `has_evidence` means an artifact is attached, not that the evidence is sufficient or correct.
3. **A moderation flag is NOT a gameplay tag.** Manual tags live in this card's model; `public.flags` rows live in the existing moderation table. They never cross — by type, by name, by storage, or by UI surface.
4. **Heat / popularity / engagement / virality / strength bands NEVER feed any tag or metadata signal.** Wrong-but-loud and right-but-quiet produce identical ledgers when the move structure matches.
5. **META-001 reads existing seams; it never re-derives.** It consumes `PointLifecycleSnapshot` / `PointLifecycleClusterSummary` from LIFE-001, `EvidenceArtifact` + `summarizeArtifactsForReceiptChip` from EV-001, qualifier codes already populated on `node.droppedTags[].code`, and BR-001's branch identity. It does NOT call `deriveMessageCategory`, does NOT re-classify axis, and does NOT call `applyAntiAmplification`.
6. **Auto-derived metadata is non-blocking.** No metadata signal prevents posting, auto-archives, auto-hides, or suppresses a reply. The ledger is advisory information for SC-004 / ST-002 / GAME-001 to surface.

META-001 ships **no new dependency**, **no migration**, **no Edge Function**, **no schema change**, **no AI inference path**, **no Supabase write**, **no `.env*` change**, and **no UI**. It is a pure-TS render-time model — manual tags live in `useState` (or equivalent) and disappear at unmount. Persistence is explicitly v2 per roadmap §19 ("Do not persist manual tags to Supabase yet"). SC-004 / ST-002 / GAME-001 / RULE-003 are the UI consumers, in later cards.

---

## Product context — what does this card define that later cards consume?

| Card | What it consumes from META-001 | What it should NOT redefine |
|---|---|---|
| **SC-004** (Timeline action dock) | `ledger.byMessage[messageId].userAppliedTags` + `autoDerivedMetadata` to gate which action chips appear. E.g. `source_requested` auto-metadata surfaces "Drop receipts" prominently; an applied `needs_source` manual tag surfaces an "Already asked — escalate?" affordance. | The 10 manual tag codes, the 16 auto metadata codes, the application/derivation rules, the actor-eligibility matrix, the event log shape. |
| **ST-002** (Cards suggested-reply flags) | `MoveLinkageRecord` per message → drives bubble badges + "What this move is doing" summary + suggested-next-move chip ordering. | The codes, the linkage record shape, the per-move axis derivation (reads `PointLifecycleSnapshot.axis`). |
| **GAME-001** (exhaustion advisories) | `ledger.byCluster[clusterId].autoDerivedMetadata` (specifically `repeated_axis_pressure`, `point_stalled`, `point_exhausted`, `synthesis_candidate`) → tuning. | Any new advisory state. GAME-001 reads LIFE-001's lifecycle state; META-001 supplies the observation log that explains *why* a cluster reached the state. |
| **RULE-003** (lifecycle-to-UX map) | All 10 + 16 codes → maps each to plain-language label + helper + allowed action set. The plain-language fallback in this card's `MANUAL_TAG_PLAIN_LABEL` + `AUTO_METADATA_PLAIN_LABEL` is the v1 default; RULE-003 may extend with helpers + action lists. | The codes themselves — they are locked in this card. |
| **GAL-002** (gallery first-suggested-move) | Root cluster's `autoDerivedMetadata` → drives gallery card's first-suggested-move hint. E.g. `synthesis_candidate` on the root cluster suggests "Try a synthesis" hint. | None of the codes. |
| **AN-003** (board diagnostics) | Aggregate counts per metadata code per debate → dev-only diagnostics. | The codes; the ledger shape. |
| **GAME-001 / SC-004 / ST-002 together** | The `metadataEvents` log → "what changed on this move?" affordances + Cards-detail history (HIST-001 follow-up). | The event shape (`add` / `remove` / `transition` + `code` + `cause` + `at`). |
| **EV-003** (evidence-debt tracker, future) | The `evidence_debt` manual tag + the `source_requested` / `quote_requested` auto codes. | The codes — EV-003 owns debt resolution mechanics, not tag/metadata vocabulary. |

META-001 itself does NOT consume any of these cards. The dependency is one-way: BR-001 → LIFE-001 → META-001 → Wave 2 / 3 / 4 surfaces.

---

## Module ownership — where does this code live?

**Decision:** new directory `src/features/metadata/`, NOT under `src/features/lifecycle/` and NOT under `src/features/arguments/`.

Rationale:

- `src/features/lifecycle/` owns the **18-state lifecycle vocabulary**. Manual tags + auto metadata are a **broader observation layer** that *uses* lifecycle as an input but produces a different shape (per-move ledger of explicit annotations, not per-cluster state). Conflating them would muddy LIFE-001's tightly-scoped 18-state contract.
- `src/features/arguments/` already houses the timeline / surface / qualifier model. Adding metadata here would push that directory toward 25 files and would make it visually harder to enforce the read-only invariant that META-001 must not write surface-model fields.
- `src/features/pointStanding/` is the scoring economy. Metadata is observation, not scoring.
- A new `src/features/metadata/` directory matches LIFE-001's precedent (siblings get their own module) and leaves room for the SC-004 dock policy + RULE-003 plain-language extension to live alongside in the same module if their shape grows beyond `gameCopy.PLAIN_LANGUAGE_COPY`.

File layout:

```
src/features/metadata/
  moveMetadataLedger.ts       # this card — ledger + linkage + event log entry point
  manualTagModel.ts           # this card — 10 manual tag codes + eligibility rules
  autoMetadataModel.ts        # this card — 16 auto metadata codes + derivation rules
  metadataEvents.ts           # this card — event shape + snapshot-diff causation
  index.ts                    # this card — public re-exports
```

`pointStanding/`, `arguments/`, `evidence/`, and `lifecycle/` files are NOT modified by this card except `gameCopy.ts` (plain-language label extension — the single source of plain-language truth, same pattern LIFE-001 used).

---

## Data model

All shapes are pure-TS, JSON-serializable, immutable (`readonly` where structural), and contain no `Date` objects, no functions, no class instances, no React types.

### Manual tag vocabulary (locked 10-code enum)

```ts
/**
 * META-001 — Manual user-applied gameplay tags. A participant marks a move
 * with a manual tag to annotate gameplay status. Each value is a gameplay
 * signal, NEVER a verdict. The 10 values match roadmap §7 verbatim.
 *
 * Doctrine: no tag may be inferred from truth / winner / loser / correctness.
 * No tag may be inferred from heat / popularity / engagement / virality /
 * strength bands. A manual tag is a participant annotation, not a moderation
 * flag — moderation flags live in `public.flags` and never appear in this
 * vocabulary.
 */
export type ManualTagCode =
  | 'needs_source'           // "Could you back this up?"
  | 'needs_quote'            // "Quote the exact passage that says this."
  | 'definition_issue'       // "We're using different definitions of this term."
  | 'scope_issue'            // "What scope are you claiming this for?"
  | 'causal_mechanism'       // "What's the cause-and-effect here?"
  | 'evidence_debt'          // "An earlier point still needs evidence."
  | 'concession_offered'     // "The author offered a concession here."
  | 'narrowed_claim'         // "The author narrowed their original claim."
  | 'tangent'                // "This is a side issue, not the main thread."
  | 'ready_for_synthesis';   // "Both sides are close — try a synthesis."

/** Frozen array of every manual tag. Tests + RULE-003 iterate this. */
export const ALL_MANUAL_TAG_CODES: ReadonlyArray<ManualTagCode>;
```

### Auto-derived metadata vocabulary (locked 16-code enum)

```ts
/**
 * META-001 — Auto-derived gameplay metadata. Observed deterministically from
 * the move stream + existing semantic-flag, qualifier, evidence-contract,
 * lifecycle, and branch-topology surfaces. Each value is an observation,
 * NEVER a truth claim. The 16 values match roadmap §5 verbatim.
 *
 * Doctrine: no code may be inferred from heat / popularity / engagement /
 * virality / strength bands / AI annotation. Auto metadata is non-blocking
 * advisory information.
 */
export type AutoMetadataCode =
  | 'has_reply'                  // node has ≥ 1 direct child
  | 'has_rebuttal'               // node has ≥ 1 child whose argument-type family is challenge
  | 'has_counter_rebuttal'       // node has ≥ 1 grandchild whose argument-type family is challenge
  | 'has_evidence'               // node has ≥ 1 attached EvidenceArtifact (any status)
  | 'source_requested'           // node has ≥ 1 child whose lifecycle contribution is source_requested
  | 'quote_requested'            // node has ≥ 1 child whose lifecycle contribution is quote_requested
  | 'source_attached'            // node's own artifacts include kind 'url' or 'dataset'
  | 'quote_attached'             // node's own artifacts include a non-empty `quote` field
  | 'participant_skipped_node'   // a same-side participant posted to another cluster but not this one within K turns of seeing it
  | 'no_response_after_n_turns'  // node has open request and no response after N turns (default 3)
  | 'repeated_axis_pressure'     // ≥ 2 same-axis challenge moves under this node, none additive
  | 'branch_suggested'           // node carries qualifier `branch_this_off` / `tangent_or_joke` OR lifecycle cluster is `branch_recommended`
  | 'branch_created'             // node is the root of a BR-001 branch (i.e. `node.branchRootMessageId === node.messageId` AND `node.parentId !== null`)
  | 'point_stalled'              // lifecycle state of this node's cluster is `moved_on_by_*` OR `ignored_by_*`
  | 'point_exhausted'            // lifecycle state of this node's cluster is `exhausted`
  | 'synthesis_candidate';       // lifecycle state of this node's cluster is `synthesis_ready` OR `narrowed` + `conceded` present

/** Frozen array of every auto metadata code. Tests + RULE-003 iterate this. */
export const ALL_AUTO_METADATA_CODES: ReadonlyArray<AutoMetadataCode>;
```

### Per-move linkage record (the headline export)

```ts
/**
 * META-001 — Per-move linkage trace. One record per non-deleted message in
 * the tree. Maps a move back to the point it acts on, the manual tags a
 * participant has applied, and the auto-derived metadata observed about
 * the move's structure.
 *
 * Pure data. JSON-serializable.
 *
 * Doctrine guardrails:
 *   - `userAppliedTags` is empty until a participant explicitly applies a tag
 *     (manual tags are participant-applied; no auto-population).
 *   - `autoDerivedMetadata` is computed from existing seams — never re-derived.
 *   - `lifecycleEventsCausedByMove` is a snapshot-diff result (see §"Lifecycle
 *     causation"); it does NOT mutate LIFE-001.
 *   - `disagreementAxis` mirrors the existing field on the timeline node;
 *     META-001 does NOT re-classify axis.
 */
export interface MoveLinkageRecord {
  /** Same as the message's `id` field on `public.arguments`. */
  messageId: string;
  /** Parent message id (null for the root). */
  parentMessageId: string | null;
  /** Root of the cluster this move belongs to. Equal to
   *  `node.branchRootMessageId` from the surface model. */
  rootPointId: string;
  /** Cluster id (= `node.branchRootMessageId`). Same shape as LIFE-001's
   *  cluster id. Synonym of `rootPointId`; both kept for surface clarity
   *  (rootPointId = "what point is being argued"; pointClusterId = "which
   *  cluster bucket"). When BR-001 ever produces a non-root cluster id,
   *  these can diverge — for v1 they are identical. */
  pointClusterId: string;
  /** Branch id (= `node.branchId` from BR-001's surface model). */
  branchId: string;
  /** Optional target excerpt the move quoted from its parent. Mirrors the
   *  existing field on the message. */
  targetExcerpt: string | null;
  /** The disagreement axis derived upstream (mirrors LIFE-001's
   *  `PointLifecycleSnapshot.axis`). Never re-derived by META-001. */
  disagreementAxis: PointLifecycleAxis | null;
  /** Existing semantic-flag codes from the upstream qualifier deriver.
   *  Reads only `node.droppedTags[].code` plus an optional
   *  `messageQualifiers.MessageQualifier[]`. */
  semanticFlags: ReadonlyArray<string>;
  /** Manual tags a participant applied. Empty by default. */
  userAppliedTags: ReadonlyArray<ManualTagEntry>;
  /** Auto-derived metadata observed about this move's structure. */
  autoDerivedMetadata: ReadonlyArray<AutoMetadataEntry>;
  /** Lifecycle transitions this move caused at the per-message or per-cluster
   *  level (snapshot-diff). Empty when the move did not change any state. */
  lifecycleEventsCausedByMove: ReadonlyArray<LifecycleCausationEntry>;
}

/**
 * One manual tag application. The applier is identified by `appliedByUserId`
 * for audit (in the in-memory v1, this is the current viewer id passed by the
 * caller; v2 persistence would canonicalize via a DB column).
 */
export interface ManualTagEntry {
  code: ManualTagCode;
  appliedByUserId: string;
  appliedByActorRole: 'participant_affirmative'
    | 'participant_negative'
    | 'observer'
    | 'admin';
  appliedAt: string;             // ISO-8601 — caller-supplied
  /** Stable dedupe key. Equal to `${code}:${appliedByUserId}`. Multiple
   *  participants applying the same tag produce multiple entries; the same
   *  participant applying the same tag twice is idempotent. */
  dedupeKey: string;
  /** Optional free-text note from the applier (≤ 140 chars). v1 does NOT
   *  render this in any normal-user surface — reserved for v2 audit UI. */
  note?: string | null;
}

/**
 * One auto-derived metadata observation. Idempotent: re-running the deriver
 * with the same inputs produces the same set (no duplicate `code` entries).
 */
export interface AutoMetadataEntry {
  code: AutoMetadataCode;
  /** ISO-8601 timestamp the deriver computed. Stable across re-renders when
   *  the inputs are stable (driven by `inputHash`). */
  detectedAt: string;
  /** Names of the upstream signals that triggered the observation. Internal
   *  debug field — NEVER rendered in UI. Each entry is one of the existing
   *  field paths the deriver reads, e.g. `'node.replyCount > 0'` or
   *  `'lifecycle.cluster.state === exhausted'`. The list is bounded (≤ 4
   *  entries per observation). */
  inputSignals: ReadonlyArray<string>;
}

/**
 * One lifecycle-causation entry. Indicates this move caused a transition
 * at the per-message or per-cluster level by comparing pre-move and
 * post-move lifecycle maps (snapshot-diff). META-001 does NOT mutate
 * LIFE-001's output; the comparison is read-only.
 */
export interface LifecycleCausationEntry {
  /** What level changed. */
  level: 'message_contribution' | 'cluster_state';
  /** The cluster id at which the change occurred. */
  clusterId: string;
  /** Optional message id when level === 'message_contribution'. */
  messageId?: string | null;
  /** The state before this move (chronologically — the cluster state at the
   *  immediately-prior message's ordinal, or 'open' for the cluster's first
   *  member). */
  fromState: PointLifecycleState;
  /** The state after this move. */
  toState: PointLifecycleState;
  /** Stable hash used by tests / dedupers. */
  causationKey: string;          // `${level}:${clusterId}:${fromState}->${toState}`
}
```

### Per-tree ledger

```ts
/**
 * META-001 — Per-tree metadata ledger. Built once per render alongside
 * the timeline map + lifecycle map. Memoization is the caller's
 * responsibility (use `inputHash`).
 */
export interface MoveMetadataLedger {
  /** Frozen map keyed by messageId. One record per non-deleted message. */
  byMessage: ReadonlyMap<string, MoveLinkageRecord>;
  /** Frozen map keyed by clusterId. Aggregates manual + auto metadata
   *  across all members of the cluster. */
  byCluster: ReadonlyMap<string, ClusterMetadataSummary>;
  /** Chronological log of every metadata event emitted by the most recent
   *  ledger rebuild. Events fire when:
   *    - A manual tag was added or removed since the last ledger.
   *    - An auto-metadata code's presence flipped on a move.
   *    - A lifecycle-causation entry was newly observed.
   *  When called on a fresh tree (no prior ledger), every observed code
   *  fires as an `add` event so consumers can subscribe to the "first
   *  ledger" stream as if it were a normal change stream. */
  metadataEvents: ReadonlyArray<MetadataEvent>;
  /** Frozen list of message ids in chronological order (matches surface
   *  model's chronological ordering). */
  messageOrder: ReadonlyArray<string>;
  /** Stable hash of the inputs. Memoization key for the room shell. */
  inputHash: string;
}

/**
 * Cluster-level aggregate. Convenience for SC-004 / ST-002 — never replaces
 * LIFE-001's `PointLifecycleClusterSummary`; this is layered on top.
 */
export interface ClusterMetadataSummary {
  clusterId: string;
  /** All distinct manual tag codes present on any member. */
  manualTagCodes: ReadonlyArray<ManualTagCode>;
  /** All distinct auto-derived codes present on any member. */
  autoMetadataCodes: ReadonlyArray<AutoMetadataCode>;
  /** The cluster's lifecycle state, copied from LIFE-001 for convenience.
   *  This is a READ — META-001 does NOT compute lifecycle. */
  lifecycleState: PointLifecycleState;
  /** Latest manual-tag application timestamp across members (ISO-8601).
   *  `null` when no manual tags have been applied. */
  lastManualTagAt: string | null;
  /** Count of distinct participants who have ever applied any tag in this
   *  cluster (in the in-memory v1, derived from the `appliedByUserId`
   *  field of `userAppliedTags`). */
  taggingParticipantCount: number;
}

/**
 * One metadata event. Fires when a code is added, removed, or transitions
 * state on a move. The event log is the basis for SC-004's "what changed"
 * affordance + ST-002's Cards-detail history + the HIST-001 follow-up
 * (lifecycle event history view).
 */
export interface MetadataEvent {
  /** Stable id derived from `${kind}:${codeFamily}:${code}:${messageId}:${at}`. */
  eventId: string;
  /** What kind of event. */
  kind: 'add' | 'remove' | 'transition';
  /** Which code family. */
  codeFamily: 'manual_tag' | 'auto_metadata' | 'lifecycle_causation';
  /** The code that changed (manual tag code, auto metadata code, or
   *  `${fromState}->${toState}` for lifecycle_causation). */
  code: string;
  /** The message id the event is anchored to. */
  messageId: string;
  /** The cluster id (`branchRootMessageId`) the event applies to. */
  clusterId: string;
  /** ISO-8601 timestamp the event was observed (deriver's clock for
   *  auto/lifecycle; caller-supplied for manual-tag application). */
  at: string;
  /** Optional cause — internal debug field for AN-003 only; never rendered
   *  in normal-user surfaces. */
  cause?: string | null;
}
```

### Inputs

```ts
/**
 * Inputs to `buildMoveMetadataLedger`. All seams are read-only.
 */
export interface BuildMoveMetadataLedgerInput {
  /** Already-built timeline map (BR-001-aware). */
  timelineMap: ArgumentTimelineMapModel;
  /** Already-built lifecycle map (LIFE-001). */
  lifecycleMap: PointLifecycleMap;
  /** EV-001 artifacts per messageId. Empty map when no artifacts. */
  artifactsByMessageId: ReadonlyMap<string, ReadonlyArray<EvidenceArtifact>>;
  /** Manual tag entries the caller has accumulated in memory. Keyed by
   *  messageId → list of tag entries. The caller (room shell) owns the
   *  in-memory store. */
  manualTagsByMessageId: ReadonlyMap<string, ReadonlyArray<ManualTagEntry>>;
  /** Optional prior ledger from the last render. Used to diff events.
   *  When null, every observed code emits as `add`. */
  previousLedger?: MoveMetadataLedger | null;
  /** Optional auto-metadata config. Threshold tuning for GAME-001. */
  autoMetadataConfig?: AutoMetadataConfig;
}

/**
 * Tuning constants for auto-metadata derivation. Conservative defaults;
 * GAME-001 may tune after AN-003 lands.
 */
export interface AutoMetadataConfig {
  /** Default 3. Used by `no_response_after_n_turns`. */
  noResponseTurnThreshold: number;
  /** Default 2. Used by `repeated_axis_pressure`. */
  repeatedAxisPressureThreshold: number;
  /** Default 3. Used by `participant_skipped_node`. */
  participantSkippedTurnThreshold: number;
}

export const DEFAULT_AUTO_METADATA_CONFIG: Readonly<AutoMetadataConfig>;
```

---

## Manual tag vocabulary table

| Code | Plain label | Trigger condition | Who can apply | UI affordance recommendation (SC-004) |
|---|---|---|---|---|
| `needs_source` | "Needs source" | Participant believes a source would strengthen the claim. | Any participant (affirmative / negative) on **another participant's bubble**. Observers may NOT apply. **Own-bubble: NOT allowed.** | A chip in the action dock when actor is on a non-own bubble. Tapping applies the tag + auto-opens the composer with EV-002's `ASK_SOURCE_PRESET_BODY`. |
| `needs_quote` | "Needs quote" | Participant wants the original passage quoted verbatim. | Any participant on another participant's bubble. Observers NO. Own-bubble NO. | Action dock chip; pairs with EV-002's `ASK_QUOTE_PRESET_BODY`. |
| `definition_issue` | "Definition fight" | Participant marks the term as contested. | Any participant on another participant's bubble. Observers NO. Own-bubble NO. | Action dock chip; surfaces "Pin definition" composer preset. |
| `scope_issue` | "Scope challenge" | Participant marks scope as contested (claim too broad or too narrow). | Any participant on another participant's bubble. Observers NO. Own-bubble NO. | Action dock chip; surfaces "Narrow the claim" suggestion. |
| `causal_mechanism` | "Mechanism challenge" | Participant marks the cause-and-effect step as missing or contested. | Any participant on another participant's bubble. Observers NO. Own-bubble NO. | Action dock chip; surfaces "Ask for mechanism" composer preset. |
| `evidence_debt` | "Evidence debt" | Participant marks the move as inheriting an unresolved evidence request from earlier in the thread. | Any participant on another participant's bubble. Observers NO. Own-bubble NO. | Action dock chip; pairs with EV-003 future debt-tracker. |
| `concession_offered` | "Concession offered" | Author OR participant marks a move as a concession (often the author confirming a narrowing). | **Own-bubble: ALLOWED** (mirrors the Stage 6.1.8 own-bubble own-action set). Other participants may also apply. Observers NO. | Action dock chip — only shows on own bubble OR after author confirms. |
| `narrowed_claim` | "Narrowed claim" | Author confirms narrowing of original scope. | **Own-bubble: ALLOWED**. Other participants may also apply. Observers NO. | Mirrors `concession_offered` — own-bubble chip plus optional confirmation by other side. |
| `tangent` | "Tangent / side issue" | Any participant marks the move as off-axis from the cluster root. | Any participant on another participant's bubble. Observers NO. Own-bubble NO. | Action dock chip; pairs with the SC-004 "Branch this off" action (which calls into BR-001's branch creation). |
| `ready_for_synthesis` | "Ready for synthesis" | Any participant marks the cluster as ripe for a synthesis move. | Any participant (any bubble). **Own-bubble: ALLOWED** (the author may signal "I'm ready"). Observers NO. | Cluster-level chip; SC-004 surfaces "Synthesize" composer preset. |

Eligibility matrix (matches Stage 6.1.8 own-bubble safety rules):

| Tag | Affirmative on non-own | Negative on non-own | Own bubble | Observer | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| `needs_source` | yes | yes | **no** | **no** | yes |
| `needs_quote` | yes | yes | **no** | **no** | yes |
| `definition_issue` | yes | yes | **no** | **no** | yes |
| `scope_issue` | yes | yes | **no** | **no** | yes |
| `causal_mechanism` | yes | yes | **no** | **no** | yes |
| `evidence_debt` | yes | yes | **no** | **no** | yes |
| `concession_offered` | yes | yes | **yes** | **no** | yes |
| `narrowed_claim` | yes | yes | **yes** | **no** | yes |
| `tangent` | yes | yes | **no** | **no** | yes |
| `ready_for_synthesis` | yes | yes | **yes** | **no** | yes |

Doctrine notes on the matrix:

- **Observers may NEVER apply manual tags in v1.** Observer mode (Stage 6.4) is read-only on the gameplay surface; granting observers tag-application would let watchers shape the room without joining a side. This is the conservative default; PR-001 or a future card may revisit with operator approval.
- **Own-bubble applications are limited to `concession_offered`, `narrowed_claim`, and `ready_for_synthesis`** — mirrors the Stage 6.1.8 own-bubble own-action set (`Qualifiers · Request deletion`). The author may signal their own narrowing/concession/synthesis intent; they may NOT apply tags that pressure another side (`needs_source`, `scope_issue`, etc.) to their own bubble.
- **Admins may apply any tag** for moderation review and demo seeding. This does NOT cross into the moderation-flag boundary — admin-applied tags are still gameplay annotations and live in the in-memory ledger, NOT in `public.flags`.

The `applyManualTag` API enforces the matrix via the `EligibilityContext` shape (see §"API contracts"). Calls with disallowed combinations return the previous ledger unchanged AND produce a debug-only `MetadataEvent` with `kind: 'add'`, `codeFamily: 'manual_tag'`, `cause: 'eligibility_refused'`. Tests assert that no surface-visible state changes.

---

## Auto metadata vocabulary table

Each code's derivation rule reads ONLY the existing seams listed. The deriver never re-derives anything that already lives upstream.

| Code | Plain label | Derivation rule | Idempotency | When emitted |
|---|---|---|---|---|
| `has_reply` | "Has a reply" | `node.replyCount > 0`. | Reads `replyCount` (already populated by surface model). One observation per move. | Whenever `replyCount` flips from 0 to ≥1. |
| `has_rebuttal` | "Has a challenge" | `node` has a direct child whose `kindColorFamily === 'challenge'`. | Iterates children once; sets bool. | Whenever first challenge child arrives. |
| `has_counter_rebuttal` | "Has a counter-challenge" | `node` has a grandchild whose `kindColorFamily === 'challenge'` AND whose parent is also a challenge. | Iterates children of challenge children; sets bool. | Whenever first counter arrives. |
| `has_evidence` | "Evidence attached" | `artifactsByMessageId.get(messageId).length > 0`. | Reads EV-001 artifact list. | Whenever first artifact lands. |
| `source_requested` | "Source requested" | A direct child has `PointLifecycleSnapshot.messageContribution === 'source_requested'`. | Reads LIFE-001 snapshot. | When first ask-source child arrives. |
| `quote_requested` | "Quote requested" | A direct child has `PointLifecycleSnapshot.messageContribution === 'quote_requested'`. | Reads LIFE-001 snapshot. | When first ask-quote child arrives. |
| `source_attached` | "Source attached" | `artifactsByMessageId.get(messageId)` contains any artifact with `kind === 'url'` OR `kind === 'dataset'`. | Reads EV-001 kinds. | When first URL/dataset artifact lands. |
| `quote_attached` | "Quote attached" | `artifactsByMessageId.get(messageId)` contains any artifact whose `quote` field is non-empty. | Reads EV-001 `quote`. | When first artifact with a quote lands. |
| `participant_skipped_node` | "Same side skipped" | A same-side participant has posted ≥1 message in the room AFTER this node was created BUT did not post a direct reply to this node within `participantSkippedTurnThreshold` of their own subsequent turns. Reads `actorLabel` / `sideLabel` from `ArgumentTimelineMapNode` + room-wide chronological order. | Bool — fires once per side per node. | When the threshold is crossed without a reply. |
| `no_response_after_n_turns` | "No follow-up yet" | Node has at least one direct child whose `messageContribution` is `source_requested` or `quote_requested` AND no descendant has `messageContribution === 'sourced'` AND `noResponseTurnThreshold` room-wide turns have passed. | Bool — fires once per open request per node. | When threshold is crossed. |
| `repeated_axis_pressure` | "Repeated challenge on same axis" | Node has ≥ `repeatedAxisPressureThreshold` descendants whose `axis === node.disagreementAxis` AND none of them is additive per `hasAdditiveAxisInformation` (LIFE-001 export). | Bool. | When threshold is crossed. |
| `branch_suggested` | "Branch suggested" | Node has `droppedTags` containing `'branch_this_off'` OR `'tangent_or_joke'` OR the node's cluster lifecycle state is `branch_recommended`. | Bool. | When qualifier appears OR cluster reaches `branch_recommended`. |
| `branch_created` | "Branch created here" | `node.branchRootMessageId === node.messageId` AND `node.parentId !== null`. (Mirrors BR-001's `kink_start` topology.) | Bool. | When the node becomes a branch root. |
| `point_stalled` | "Point stalled" | The cluster this node belongs to has lifecycle state in `{moved_on_by_affirmative, moved_on_by_negative, ignored_by_affirmative, ignored_by_negative, ignored_by_both}`. | Bool — cluster-wide observation, mirrored on every member. | When cluster reaches a stalled state. |
| `point_exhausted` | "Point exhausted" | The cluster's lifecycle state is `exhausted`. | Bool — mirrored on every member. | When cluster reaches `exhausted`. |
| `synthesis_candidate` | "Synthesis candidate" | Cluster's lifecycle state is `synthesis_ready` OR the cluster has any `narrowed` contribution AND any `conceded` contribution AND no `rebutted` after them. | Bool — mirrored on every member. | When synthesis conditions met. |

Doctrine notes on the derivation:

- **Heat / popularity / engagement NEVER appears.** No code reads `temperatureBand`, `toneBand`, `standingBand`, `topicScore`, or any AI annotation.
- **The deriver never re-derives axis.** It reads `PointLifecycleSnapshot.axis` (LIFE-001) which itself reads `disagreementAxis` + qualifier codes already populated upstream.
- **Cluster-wide codes mirror on every member.** `point_stalled` / `point_exhausted` / `synthesis_candidate` are cluster facts; each member of the cluster gets the same code so SC-004 / ST-002 can render the chip on any selected bubble without a second cluster lookup.
- **Cluster-wide codes never appear at the cluster summary BUT ALSO at the per-message level pretending to be per-message.** `ClusterMetadataSummary.autoMetadataCodes` de-duplicates the cluster-wide entries; `MoveLinkageRecord.autoDerivedMetadata` carries them too, but the `inputSignals` field documents the cluster derivation so AN-003 can distinguish per-message from cluster-mirrored signals.

---

## Move-to-point linkage rules

For each non-deleted message `node` in the timeline map, the linkage record is built deterministically:

```
1. messageId = node.messageId
2. parentMessageId = node.parentId
3. rootPointId = node.branchRootMessageId
4. pointClusterId = node.branchRootMessageId             (synonym in v1)
5. branchId = node.branchId
6. targetExcerpt = node.targetExcerpt                   (when surface model carries it; otherwise null)
7. disagreementAxis = lifecycleMap.byMessage.get(messageId)?.axis ?? null
8. semanticFlags = uniqueLowercased(node.droppedTags.map(t => t.code))
9. userAppliedTags = manualTagsByMessageId.get(messageId) ?? []
10. autoDerivedMetadata = deriveAutoMetadataForMessage(node, ...)
11. lifecycleEventsCausedByMove = computeLifecycleCausation(node, previousLifecycleMap, currentLifecycleMap)
```

### Edge cases

1. **Missing parent (`isDetached === true`).** `parentMessageId = null` (already that way upstream); `rootPointId` falls back to the node's own messageId (BR-001 treats detached nodes as their own cluster roots). `semanticFlags` and `autoDerivedMetadata` are computed normally — detached nodes can still carry `branch_created`, `has_evidence`, etc.
2. **Observer move.** Observers cannot reply in v1 (Stage 6.4 lock). The deriver does not need to special-case observers because they produce no rows in `public.arguments`. If a stray observer-authored row ever appears (admin testing fixture), the linkage record is still computed; the `userAppliedTags` list will simply never see an `observer` actor role.
3. **Soft-deleted parent (`is_deleted: true` upstream).** The room shell filters deleted messages before passing them to the timeline model. META-001 sees them as absent. `parentMessageId` may point to a deleted id; in that case the deriver treats the link as detached (uses node's own id as `rootPointId`). Tests assert this.
4. **Concurrent edits / realtime new message arrives.** Memoization key (`inputHash`) changes; ledger rebuilds. One O(n) rebuild — no cumulative cost growth.
5. **Conflicting manual tags (two participants apply opposing tags).** Tag application is additive: both participants' entries appear in `userAppliedTags`. There is no "winning" tag. The dedupe key (`${code}:${appliedByUserId}`) prevents the same participant from double-applying the same code.
6. **Same participant applies same tag twice.** The dedupe key suppresses the second application; `applyManualTag` returns the previous ledger reference-equal when called with a duplicate.
7. **Tag applied to soft-deleted message.** Tag application requires the message id to exist in the timeline map. Calls with a non-existent id return the previous ledger unchanged AND emit a debug-only `MetadataEvent` with `cause: 'unknown_message_id'`.
8. **Detached branch with no parent in load.** Treated as its own cluster (BR-001 surface). `rootPointId === messageId`. Tag application + auto metadata work normally.
9. **Very deep trees (depth ≥ 50).** Auto-metadata derivers that look at descendants (`has_counter_rebuttal`, `repeated_axis_pressure`, `no_response_after_n_turns`) use BR-001's subtree iteration (capped at cluster size). Worst-case O(n) per cluster; total O(n × depth_avg) ≪ O(n²).

---

## Lifecycle causation rules — snapshot-diff approach

**Decision: snapshot-diff, NOT a new event channel in LIFE-001.**

### Rationale

A new event channel on LIFE-001 (option A) would require:

- Extending `pointLifecycleModel.ts` with an event emitter or change-list output.
- Re-shipping LIFE-001 to add the surface.
- Risking that the event channel becomes the only way other cards observe lifecycle state — fragmenting the doctrine.

The snapshot-diff approach (option B, chosen):

- Reads two `PointLifecycleMap`s — the prior render's map (`previousLifecycleMap`, optional) and the current map — and computes the set of transitions.
- Does NOT require any change to LIFE-001's surface.
- Is purely a META-001 concern; if LIFE-001 changes the lifecycle vocabulary, snapshot-diff still works (auto-handles new state values).
- Is testable in isolation: feed two known maps, assert the diff result.
- Aligns with BR-001's snapshot-pre-collapse precedent (caller threads "before" + "after" through META-001's API).

LIFE-001 is unchanged. META-001 stores no global state — the caller is expected to thread the prior ledger (or its inputs) through `buildMoveMetadataLedger` between renders.

### Algorithm

```
function computeLifecycleCausation(
  currentNode,
  previousLifecycleMap (nullable),
  currentLifecycleMap,
): LifecycleCausationEntry[] {
  if (!previousLifecycleMap) {
    // First render — emit the current state of the cluster as if it
    // transitioned from 'open'. This lets consumers subscribe to a
    // uniform "always emit on first observation" stream.
    const cluster = currentLifecycleMap.byCluster.get(currentNode.branchRootMessageId);
    if (!cluster) return [];
    if (cluster.state === 'open') return [];
    return [{
      level: 'cluster_state',
      clusterId: cluster.clusterId,
      fromState: 'open',
      toState: cluster.state,
      causationKey: `cluster_state:${cluster.clusterId}:open->${cluster.state}`,
    }];
  }

  const out: LifecycleCausationEntry[] = [];

  // Cluster-level transition
  const prevCluster = previousLifecycleMap.byCluster.get(currentNode.branchRootMessageId);
  const currCluster = currentLifecycleMap.byCluster.get(currentNode.branchRootMessageId);
  if (prevCluster && currCluster && prevCluster.state !== currCluster.state) {
    // Only attribute the transition to THIS move when the move is the
    // latest member of the cluster (no other later message could have
    // caused the transition). Same rule as the "last contribution
    // dominates" convention LIFE-001 uses.
    const clusterMembers = currentLifecycleMap.byCluster.get(currCluster.clusterId)?.messageIds ?? [];
    const isLatestInCluster = clusterMembers[clusterMembers.length - 1] === currentNode.messageId;
    if (isLatestInCluster) {
      out.push({
        level: 'cluster_state',
        clusterId: currCluster.clusterId,
        fromState: prevCluster.state,
        toState: currCluster.state,
        causationKey: `cluster_state:${currCluster.clusterId}:${prevCluster.state}->${currCluster.state}`,
      });
    }
  }

  // Per-message contribution change
  const prevSnap = previousLifecycleMap.byMessage.get(currentNode.messageId);
  const currSnap = currentLifecycleMap.byMessage.get(currentNode.messageId);
  if (currSnap && (!prevSnap || prevSnap.messageContribution !== currSnap.messageContribution)) {
    out.push({
      level: 'message_contribution',
      clusterId: currSnap.clusterId,
      messageId: currentNode.messageId,
      fromState: prevSnap?.messageContribution ?? 'open',
      toState: currSnap.messageContribution,
      causationKey: `message_contribution:${currentNode.messageId}:${prevSnap?.messageContribution ?? 'open'}->${currSnap.messageContribution}`,
    });
  }

  return out;
}
```

### Why "isLatestInCluster" guard

Without it, a late-arriving evidence move on cluster A could be mis-attributed to a *different* node that happens to be selected by the user as the active node. The guard ensures we only credit the chronologically-last move as the cause of the cluster transition. This matches LIFE-001's "last contribution dominates" rule for cluster summaries.

### Edge cases for causation

1. **First render.** `previousLifecycleMap === null` → emit only when the cluster's current state ≠ `'open'`. Avoids spamming the event log with no-op opens.
2. **Cluster state unchanged.** No event emitted; no-op.
3. **Same state but different per-message contributions.** `message_contribution` event emitted; `cluster_state` event NOT emitted (the cluster didn't change).
4. **Cluster splits via BR-001 branch creation.** A new cluster appears in `currentLifecycleMap` that wasn't in `previousLifecycleMap`. The first member of the new cluster fires a cluster-state event with `fromState: 'open'`.
5. **Cluster gets resolved by admin (`flagCodes` `argument_resolved`).** The cluster transitions to `archived_or_resolved`. Snapshot-diff captures the transition. Resolution comes from upstream (`flagCodesByMessageId`), so the cause is attributed to whichever message carried the resolution flag.
6. **A non-latest-in-cluster move triggers a state change** (rare; e.g. a backfilled edit). The guard suppresses attribution to that node. The cluster-state event still appears in the log — but anchored on the chronologically-last node in the cluster (so SC-004 / ST-002 can render the chip on the move that "owns" the change).

---

## Boundary with LIFE-001 (no redefinition)

META-001 does NOT:

- Re-declare any of the 18 `PointLifecycleState` codes.
- Re-derive `axis` (reads `PointLifecycleSnapshot.axis`).
- Re-classify message contribution (reads `PointLifecycleSnapshot.messageContribution`).
- Re-run cluster composition (reads `PointLifecycleClusterSummary.state`).
- Modify LIFE-001 advisory thresholds.

META-001 DOES:

- Subscribe to lifecycle state via snapshot-diff for causation events.
- Mirror cluster-wide auto-metadata codes (`point_stalled`, `point_exhausted`, `synthesis_candidate`) onto every cluster member for SC-004's per-bubble convenience.
- Add the manual-tag layer on top of lifecycle (lifecycle is automatic; tags are participant-applied).

### Forbidden-imports test (the headline guard)

A test scans every META-001 source file (`src/features/metadata/*.ts`) and asserts:

- No value import of `deriveMessageCategory` / `derivePrimaryQualifier` / `deriveMessageQualifiers` from `messageQualifiers.ts`. Type-only imports are OK.
- No value import of `deriveAxis` from `pointLifecycleClusters.ts` (deprecated re-use surface; we re-export the axis from the snapshot).
- No value import of `applyAntiAmplification` from `pointStanding/antiAmplification.ts`. Type imports OK if needed.
- No value import of any AI-pipeline file from `src/features/engagementIntelligence/`.
- No import of `'react'` / `'react-native'` / `'@supabase/supabase-js'`.

This is roadmap §16 risk #1 mitigation by name — caught at source-scan time.

---

## Boundary with SC-004 / ST-002 / GAME-001 / AN-003 (no UI in this card)

META-001 ships the MODEL only. The following surfaces are NOT touched by this card; they consume the ledger in their own cards:

- **SC-004** reads `byMessage[messageId].userAppliedTags` + `autoDerivedMetadata` + `lifecycleEventsCausedByMove` to gate action dock chips. Per roadmap §8, the dock surfaces "Reply / Challenge / Ask source / Ask quote / Clarify / Add evidence / Narrow / Concede / Confirm / Mark moved on / Mark ignored / Branch / Synthesize / Flag" based on lifecycle state + actor + applied tags.
- **ST-002** reads `MoveLinkageRecord` to render per-bubble badges + "What this move is doing" summary + suggested-next-move chip ordering.
- **GAME-001** reads `byCluster[clusterId].autoMetadataCodes` (specifically `repeated_axis_pressure`, `point_stalled`, `point_exhausted`, `synthesis_candidate`) → tunes the four advisory thresholds (LIFE-001's `LifecycleAdvisoryConfig`).
- **RULE-003** reads `ALL_MANUAL_TAG_CODES` + `ALL_AUTO_METADATA_CODES` + extends `PLAIN_LANGUAGE_COPY` with helpers + action lists.
- **GAL-002** reads the root cluster's `autoMetadataCodes` for the gallery first-suggested-move hint.
- **AN-003** reads `metadataEvents` for per-room aggregate diagnostics.

META-001 itself touches:

- **`gameCopy.ts`** — extends `PLAIN_LANGUAGE_COPY` with the 26 new codes (10 manual + 16 auto).

No timeline / sidecar / dock / gallery / stack screen is modified by this card. The ledger is built and unused until SC-004 / ST-002 / GAME-001 / RULE-003 wire it.

---

## Plain-language label map — extend `gameCopy.PLAIN_LANGUAGE_COPY`

`PLAIN_LANGUAGE_COPY` already contains lifecycle codes (LIFE-001's 18 entries) and some pipeline codes. META-001 appends the 26 new metadata codes. **NO new mapping table is introduced** — there must be exactly one plain-language map in the app (the doctrine LIFE-001 established).

### v1 default labels (this card commits these to `PLAIN_LANGUAGE_COPY`)

Manual tag labels (10 new entries):

```ts
// Appended to PLAIN_LANGUAGE_COPY in `src/features/arguments/gameCopy.ts`.
needs_source: 'Needs source',
needs_quote: 'Needs quote',
definition_issue: 'Definition fight',
scope_issue: 'Scope challenge',
causal_mechanism: 'Mechanism challenge',
// 'evidence_debt' already mapped to 'Receipts needed' — UPDATE to 'Evidence debt'
//   to match roadmap §7 verbatim. The pipeline reads the code, not the label,
//   so no runner-side regression.
concession_offered: 'Concession offered',
narrowed_claim: 'Narrowed claim',
tangent: 'Tangent / side issue',
ready_for_synthesis: 'Ready for synthesis',
// (already present from LIFE-001 — value unchanged)
```

Auto metadata labels (16 new entries):

```ts
has_reply: 'Has a reply',
has_rebuttal: 'Has a challenge',
has_counter_rebuttal: 'Has a counter-challenge',
has_evidence: 'Evidence attached',
// 'source_requested' / 'quote_requested' already mapped by LIFE-001
//   (lifecycle state vocabulary). Reused — auto-metadata code shares the
//   internal code with the lifecycle state by design (both observe the same
//   thing — an open request).
source_attached: 'Source attached',
quote_attached: 'Quote attached',
participant_skipped_node: 'Same side skipped',
no_response_after_n_turns: 'No follow-up yet',
repeated_axis_pressure: 'Repeated challenge on same axis',
branch_suggested: 'Branch suggested',                    // matches LIFE-001 (shared code)
branch_created: 'Branch created here',
point_stalled: 'Point stalled',
point_exhausted: 'Point exhausted',
synthesis_candidate: 'Synthesis candidate',
```

Note on `evidence_debt`: the existing map has it as `'Receipts needed'`. META-001 changes this to `'Evidence debt'` to match the roadmap §7 manual-tag table verbatim. The pipeline reads the code, not the label (similar to LIFE-001's `synthesis_ready` update). A test asserts no runner-side regression by reading the code path, not the string. The existing test (if any) that asserts the exact string is updated.

Codes shared between LIFE-001 lifecycle vocabulary and META-001 auto metadata (`source_requested`, `quote_requested`, `branch_suggested`, `synthesis_candidate` if used as a lifecycle alias — currently it's `synthesis_ready` in lifecycle, separate `synthesis_candidate` in metadata) keep their LIFE-001-set labels untouched. The two layers describe the same observation from two angles.

### Doctrine check on every label

Zero verdict tokens (`winner`, `loser`, `correct`, `incorrect`, `true`, `false`, `liar`, `dishonest`, `bad faith`, `manipulative`, `extremist`, `propagandist`, `proof`, `proven`, `disproven`, `verdict`, `lost`, `defeated`, `won`); zero amplification tokens (`viral`, `popular`, `trending`, `likes`, `retweets`, `engagement`); zero person-attribution tokens (`troll`, `bot`, `astroturfer`). The ban-list test in §"Test plan" enforces.

### `getManualTagPlainLabel` / `getAutoMetadataPlainLabel` — typed lookup helpers

```ts
export function getManualTagPlainLabel(code: ManualTagCode): string;
export function getAutoMetadataPlainLabel(code: AutoMetadataCode): string;
```

Both read from `PLAIN_LANGUAGE_COPY` (single source of truth) and return a string. Type system ensures every code maps; tests + RULE-003 iterate `ALL_MANUAL_TAG_CODES` / `ALL_AUTO_METADATA_CODES` to assert completeness.

---

## API / interface contracts

### `src/features/metadata/moveMetadataLedger.ts`

```ts
import type {
  ArgumentTimelineMapModel,
  ArgumentTimelineMapNode,
} from '../arguments/argumentGameSurfaceModel';
import type {
  EvidenceArtifact,
} from '../evidence/evidenceModel';
import type {
  PointLifecycleMap,
  PointLifecycleState,
  PointLifecycleAxis,
} from '../lifecycle';

// ── Public types — exported in §"Data model" ──────────────────

export interface MoveLinkageRecord { /* per §"Data model" */ }
export interface ManualTagEntry { /* per §"Data model" */ }
export interface AutoMetadataEntry { /* per §"Data model" */ }
export interface LifecycleCausationEntry { /* per §"Data model" */ }
export interface MoveMetadataLedger { /* per §"Data model" */ }
export interface ClusterMetadataSummary { /* per §"Data model" */ }
export interface MetadataEvent { /* per §"Data model" */ }
export interface AutoMetadataConfig { /* per §"Data model" */ }
export const DEFAULT_AUTO_METADATA_CONFIG: Readonly<AutoMetadataConfig>;

// ── Tree-level entry point ─────────────────────────────────────

export interface BuildMoveMetadataLedgerInput {
  timelineMap: ArgumentTimelineMapModel;
  lifecycleMap: PointLifecycleMap;
  artifactsByMessageId: ReadonlyMap<string, ReadonlyArray<EvidenceArtifact>>;
  manualTagsByMessageId: ReadonlyMap<string, ReadonlyArray<ManualTagEntry>>;
  previousLedger?: MoveMetadataLedger | null;
  /** Previous lifecycle map — used for snapshot-diff causation. When the
   *  caller does not have one yet (first render), pass `null`. */
  previousLifecycleMap?: PointLifecycleMap | null;
  autoMetadataConfig?: AutoMetadataConfig;
}

/**
 * Build the per-tree ledger in three passes:
 *   Pass 1 — per-message linkage records (reads surface model + lifecycle map).
 *   Pass 2 — auto-derived metadata observations (reads EV-001 artifacts +
 *            lifecycle + cluster state).
 *   Pass 3 — snapshot-diff lifecycle causation events vs the previous
 *            lifecycle map.
 * Plus: per-cluster aggregation + metadata-event log composition.
 *
 * Pure. Deterministic. O(n) where n = messages (per-message walk; descendant
 * walks are bounded by cluster size, summing to O(n) total).
 */
export function buildMoveMetadataLedger(
  input: BuildMoveMetadataLedgerInput,
): MoveMetadataLedger;

// ── Manual tag operations ─────────────────────────────────────

export interface EligibilityContext {
  /** The viewer applying the tag. */
  applierUserId: string;
  /** The viewer's role on this room. */
  applierActorRole: 'participant_affirmative'
    | 'participant_negative'
    | 'observer'
    | 'admin';
  /** True when `messageId` is the applier's own bubble (author === applier). */
  isOwnBubble: boolean;
}

export interface ApplyManualTagInput {
  /** The ledger we're updating. */
  ledger: MoveMetadataLedger;
  /** The message to tag. */
  messageId: string;
  /** The tag code. */
  code: ManualTagCode;
  /** The applier + eligibility context. */
  eligibility: EligibilityContext;
  /** ISO-8601 timestamp the caller assigns. */
  appliedAt: string;
  /** Optional free-text note (≤ 140 chars). */
  note?: string | null;
}

/**
 * Apply a manual tag to a move. Returns a NEW ledger (immutable update).
 * Returns the input ledger reference-equal when:
 *   - Eligibility fails (e.g., observer applying any tag, own-bubble applying
 *     a non-own-allowed tag).
 *   - The tag is already present for this applier (dedupe).
 *   - The messageId does not exist in the ledger.
 *
 * Eligibility-refused calls emit a debug-only `MetadataEvent` with
 * `cause: 'eligibility_refused'` (not surfaced to UI).
 */
export function applyManualTag(input: ApplyManualTagInput): MoveMetadataLedger;

/**
 * Remove a manual tag previously applied by the same user. Idempotent —
 * removing a non-present tag returns the ledger reference-equal.
 *
 * Reverts the application; a "remove" event fires in the next ledger build.
 * v1 has no UI surface for tag removal; this API exists so SC-004 can
 * implement "undo" without round-tripping through `buildMoveMetadataLedger`.
 */
export function removeManualTag(args: {
  ledger: MoveMetadataLedger;
  messageId: string;
  code: ManualTagCode;
  applierUserId: string;
}): MoveMetadataLedger;

// ── Plain-language helpers ──────────────────────────────────────

export function getManualTagPlainLabel(code: ManualTagCode): string;
export function getAutoMetadataPlainLabel(code: AutoMetadataCode): string;

// ── Frozen vocabularies ────────────────────────────────────────

export const ALL_MANUAL_TAG_CODES: ReadonlyArray<ManualTagCode>;
export const ALL_AUTO_METADATA_CODES: ReadonlyArray<AutoMetadataCode>;

// ── Eligibility table (exported for SC-004 + tests) ─────────────

export const MANUAL_TAG_ELIGIBILITY: Readonly<Record<ManualTagCode, {
  allowOnOwnBubble: boolean;
  allowOnOtherBubble: boolean;
  allowObserver: boolean;
  allowAdmin: boolean;
}>>;

// ── Forbidden-token sanity (used by ban-list test) ─────────────

/** The forbidden token list META-001 ban-list assertions check. */
export function _forbiddenMetadataTokens(): string[];
```

### `src/features/metadata/manualTagModel.ts` (internal helpers)

```ts
/** Pure helper. Returns the static eligibility record for a tag. */
export function getManualTagEligibility(code: ManualTagCode): Readonly<{
  allowOnOwnBubble: boolean;
  allowOnOtherBubble: boolean;
  allowObserver: boolean;
  allowAdmin: boolean;
}>;

/** Pure helper. Returns true when an apply attempt would be allowed. */
export function isApplyAllowed(
  code: ManualTagCode,
  eligibility: EligibilityContext,
): boolean;

/** Pure helper. Dedupe key for a manual tag application. */
export function makeManualTagDedupeKey(
  code: ManualTagCode,
  applierUserId: string,
): string;
```

### `src/features/metadata/autoMetadataModel.ts` (internal helpers)

```ts
/** Returns the list of auto-derived metadata codes observed for one move.
 *  Reads ONLY the inputs (surface node, lifecycle snapshot/cluster summary,
 *  artifact list, descendant info). Never re-derives anything upstream. */
export function deriveAutoMetadataForMessage(args: {
  node: ArgumentTimelineMapNode;
  clusterSummary: PointLifecycleClusterSummary;
  messageSnapshot: PointLifecycleSnapshot | null;
  childNodes: ReadonlyArray<ArgumentTimelineMapNode>;
  descendantNodes: ReadonlyArray<ArgumentTimelineMapNode>;
  artifacts: ReadonlyArray<EvidenceArtifact>;
  detectedAt: string;
  autoMetadataConfig: AutoMetadataConfig;
  /** Pre-computed lookup of `messageContribution` for each descendant. */
  descendantContributions: ReadonlyMap<string, PointLifecycleState>;
}): AutoMetadataEntry[];
```

### `src/features/metadata/metadataEvents.ts` (internal helpers)

```ts
/** Snapshot-diff two ledgers to produce the event log. */
export function diffLedgers(args: {
  previous: MoveMetadataLedger | null;
  current: MoveMetadataLedger;
  currentLifecycleMap: PointLifecycleMap;
  previousLifecycleMap: PointLifecycleMap | null;
}): MetadataEvent[];

/** Build the lifecycle-causation entries for a single move via snapshot-diff. */
export function computeLifecycleCausationForMove(args: {
  node: ArgumentTimelineMapNode;
  previousLifecycleMap: PointLifecycleMap | null;
  currentLifecycleMap: PointLifecycleMap;
}): LifecycleCausationEntry[];
```

### `src/features/metadata/index.ts`

```ts
export type {
  ManualTagCode,
  AutoMetadataCode,
  ManualTagEntry,
  AutoMetadataEntry,
  LifecycleCausationEntry,
  MoveLinkageRecord,
  ClusterMetadataSummary,
  MetadataEvent,
  MoveMetadataLedger,
  BuildMoveMetadataLedgerInput,
  ApplyManualTagInput,
  EligibilityContext,
  AutoMetadataConfig,
} from './moveMetadataLedger';

export {
  ALL_MANUAL_TAG_CODES,
  ALL_AUTO_METADATA_CODES,
  MANUAL_TAG_ELIGIBILITY,
  DEFAULT_AUTO_METADATA_CONFIG,
  buildMoveMetadataLedger,
  applyManualTag,
  removeManualTag,
  getManualTagPlainLabel,
  getAutoMetadataPlainLabel,
  _forbiddenMetadataTokens,
} from './moveMetadataLedger';

// Internal helpers re-exported for unit tests + advanced consumers.
export {
  getManualTagEligibility,
  isApplyAllowed,
  makeManualTagDedupeKey,
} from './manualTagModel';

export {
  deriveAutoMetadataForMessage,
} from './autoMetadataModel';

export {
  diffLedgers,
  computeLifecycleCausationForMove,
} from './metadataEvents';
```

---

## UI contract — which surfaces consume the metadata ledger

META-001 ships the MODEL only. SC-004 / ST-002 / GAME-001 / GAL-002 are the wiring cards:

- **Timeline rail** — does NOT consume metadata directly. Visual grammar continues to flow through VG-001 / VG-002 / BR-001. Auto-metadata observations are not visual; they drive action affordances.
- **Selected-node popover (SC-002 + SC-003)** — SC-003 already displays the lifecycle banner; the SC-004 expansion adds the metadata-driven action chips.
- **Cards / Stack detail (ST-002)** — bubble badges read `byMessage[messageId].userAppliedTags` + `autoDerivedMetadata`. Suggested-next-move ordering reads the codes plus the lifecycle state.
- **Action dock (SC-004)** — gates which chips appear based on `MANUAL_TAG_ELIGIBILITY` (actor role + own-bubble) + the present auto-metadata codes.
- **Gallery card (GAL-002)** — reads `byCluster[rootClusterId].autoMetadataCodes` for the first-suggested-move hint.
- **Diagnostics (AN-003)** — reads `metadataEvents` for per-room aggregate counts. Dev-only.

META-001 itself touches:

- **`gameCopy.ts`** — extends `PLAIN_LANGUAGE_COPY` with the 26 new codes (+ updates `evidence_debt` value from `'Receipts needed'` to `'Evidence debt'`).

No timeline / sidecar / dock / gallery / stack screen is modified by this card.

---

## Accessibility contract

META-001 is a pure model — it has no rendered output. The plain-language labels in `PLAIN_LANGUAGE_COPY` are written to be screen-reader-safe (per LIFE-001's accessibility contract):

- Every label is a complete English phrase (no internal codes, no abbreviations).
- Labels never contain emojis.
- Labels never assume color is the only signal — the textual label is the signal.
- Labels are ≤ 32 characters to fit chip layout per `accessibility-targets` minimum chip width.

When SC-004 / ST-002 / GAL-002 wire the labels into UI:

- `accessibilityLabel` should include the tag/code phrase + the actor's role + the move's ordinal + the cluster's lifecycle state.
- Tap targets on tag chips + dock chips ≥ 44×44 px per `accessibility-targets`.
- Reduce-motion: tag-add / tag-remove transitions snap, no animation. State-change announcements via `AccessibilityInfo.announceForAccessibility` only on tag application (one announcement per applied tag, debounced).
- Color independence: the label IS the signal. SC-004 may pair it with shape (e.g., a small icon) per `timeline-grammar` for redundancy.
- Keyboard support (web): IX-003 owns. META-001 does not need a keyboard binding because it has no UI in this card.

The implementer does NOT need to add accessibility fields to `MoveLinkageRecord` — those belong on the rendering surfaces.

---

## Edge cases

The implementer MUST handle each. Tests in §"Test plan" cover them by name.

1. **Empty room (`messages.length === 0`).** `buildMoveMetadataLedger` returns an empty ledger: `byMessage: new Map()`, `byCluster: new Map()`, `metadataEvents: []`, `messageOrder: []`, `inputHash: ''`. No errors.
2. **Root-only room.** Single linkage record for the root. `userAppliedTags: []`. `autoDerivedMetadata` includes only what applies to a root with no children (typically `[]` because most auto codes require descendants). `lifecycleEventsCausedByMove: []` on first render (current cluster state is `'open'`).
3. **Deleted messages.** Filtered upstream. Their ids never appear in `byMessage`. A manual tag previously attached to a now-deleted message id is silently dropped on the next ledger rebuild; a `remove` event fires for that tag with `cause: 'message_deleted'`.
4. **Detached messages.** Form their own cluster (per BR-001). `rootPointId === messageId`. Auto-metadata derivers run normally.
5. **Concurrent edits / new message arrives.** `inputHash` changes; ledger rebuilds. Snapshot-diff emits events for the new message + any cluster state transitions caused by it.
6. **Own-bubble restrictions.** `applyManualTag` enforces via `MANUAL_TAG_ELIGIBILITY` table. Test fixtures exercise every (code, actor role, own-bubble flag) combination.
7. **Observer mode.** Observers cannot apply manual tags in v1. `applyManualTag` returns the previous ledger unchanged when `applierActorRole === 'observer'`. Tests assert.
8. **Very deep trees (depth ≥ 50).** Auto-metadata derivers use BR-001-style cluster-bounded walks. Worst case O(n × depth_avg) ≪ O(n²). Test fixture asserts < 30 ms at 250 messages.
9. **Oscillating tags.** A participant applies `tangent`, removes it, re-applies. The ledger reflects the current state; the event log captures every transition. Tests assert.
10. **Conflicting tags from different participants.** Participant A applies `needs_source`; Participant B applies `concession_offered` on the same move. Both entries appear; no merging or conflict resolution. Tests assert.
11. **Same tag applied by two different participants.** Both entries appear in `userAppliedTags` (different `dedupeKey`s). The aggregated `ClusterMetadataSummary.manualTagCodes` lists the code once. Tests assert.
12. **Tag application to a soft-deleted message.** Returns the previous ledger unchanged + debug event with `cause: 'unknown_message_id'`. Tests assert no surface state changes.
13. **Eligibility-refused tag application.** Returns the previous ledger unchanged + debug event with `cause: 'eligibility_refused'`. No UI-visible state change. Tests assert.
14. **First render — no `previousLifecycleMap`.** Lifecycle causation entries fire for any cluster whose state ≠ `'open'`. This lets consumers subscribe to a uniform stream. Tests assert.
15. **Lifecycle map's cluster set differs between renders.** A new cluster appears (BR-001 branch creation) — its first member fires a cluster-state event with `fromState: 'open'`. An old cluster disappears (rare — e.g., admin merged) — no event; the absent cluster is treated as if it never existed.
16. **Same participant double-tag.** The dedupe key suppresses; `applyManualTag` returns the ledger reference-equal.
17. **`tangent` tag on a node that's already in a `branch_recommended` cluster.** Tag is added; the `branch_suggested` auto-metadata code is also present. No conflict — both signals can coexist (manual + auto).
18. **`concession_offered` applied to own bubble before the author's narrowing.** Allowed (eligibility table). The tag is a signal of intent; the actual lifecycle state still requires a concession-shape move to fire `narrowed` / `conceded`.
19. **Admin applies a tag.** Allowed for all 10 codes. Admin-applied tags are gameplay annotations (in-memory ledger), NOT moderation flags (which live in `public.flags`). Tests assert no `public.flags` interaction.
20. **`evidence_debt` tag in conjunction with a lifecycle `sourced` cluster.** Allowed — the tag is a participant's gameplay annotation that can coexist with a sourced state. Useful for "this move's source is weak even though one is attached." The doctrine guardrail: the tag is NOT a verdict about the source's truth; it's a participant's signal that more receipts would help.
21. **`needs_source` applied to an evidence-typed move (`argument_type === 'evidence'`).** Allowed. The tag is "I want more sources" even on an evidence move. No conflict.
22. **Auto metadata `source_attached` AND manual `needs_source` on the same move.** Both present. Doctrine: a participant can still want MORE sources. No automatic conflict resolution.

---

## Test plan

Tests follow `test-discipline` — pure-model tests in `__tests__/`, no React, no Supabase, no network.

### `__tests__/moveMetadataLedger.test.ts` (~520 lines)

Pure-model tests for the ledger entry point.

**Linkage record fields**

- For a 5-message fixture, assert `byMessage.get(messageId)` returns a record with the expected `parentMessageId`, `rootPointId`, `pointClusterId`, `branchId`, `disagreementAxis` (mirrors lifecycle snapshot's axis), `semanticFlags` (from `node.droppedTags`).
- Root with no replies: `userAppliedTags: []`, `autoDerivedMetadata: []` (no descendants), `lifecycleEventsCausedByMove: []` on first render when state is `'open'`.
- Root with `'archived_or_resolved'` first render: a cluster-state event fires (`'open' → 'archived_or_resolved'`).

**Per-message ↔ cluster aggregation**

- `byCluster.get(clusterId).manualTagCodes` equals the union of `userAppliedTags[].code` across cluster members.
- `byCluster.get(clusterId).autoMetadataCodes` equals the union of `autoDerivedMetadata[].code` across cluster members.
- `byCluster.get(clusterId).lifecycleState` equals `lifecycleMap.byCluster.get(clusterId).state` (mirror).
- `byCluster.get(clusterId).lastManualTagAt` is the latest `appliedAt` across members (ISO-8601 sort).
- `byCluster.get(clusterId).taggingParticipantCount` counts distinct `appliedByUserId`.

**Map shape**

- `byMessage.keys()` equals the chronologically-ordered set of non-deleted message ids.
- `messageOrder.length === byMessage.size`.
- `inputHash` changes when any input field changes; reference-equal when inputs are reference-equal.

**JSON-serializability**

- `JSON.parse(JSON.stringify(Array.from(ledger.byMessage.entries())))` round-trips successfully and produces deep-equal data after rebuilding the `Map`.

**Doctrine anchor — heat / standing / popularity do not feed any code**

- Build two identical fixtures, one with every node's `standingBand === 'completely_right'`, one with `'pretty_wrong'`. Assert `buildMoveMetadataLedger` returns deep-equal `byMessage` (ignoring `inputHash`).
- Same for `toneBand` (`calm` vs `hostile`).
- Same for `temperatureBand` (`cool` vs `hot`).
- All assert deep equality, confirming the deriver never reads these signals.

**Doctrine anchor — manual tags never auto-populate**

- Build a fixture with rich lifecycle and evidence state but no manual tags applied. Assert `byMessage.get(any).userAppliedTags === []` for every message.

**Doctrine anchor — moderation flag boundary**

- Build a fixture with `node.droppedTags` containing `'flag:civility'`. Assert `byMessage.get(messageId).semanticFlags` includes the flag code (it's a semantic-flag mirror) BUT no `userAppliedTags` entry is created, AND no `autoDerivedMetadata` entry is created. Moderation flags are surface-level signals; they never cross into manual-tag or auto-metadata layers.

**Performance**

- 250-message synthetic fixture: `buildMoveMetadataLedger` returns in < 30 ms in a Jest run. Verified via `performance.now()`.

**Edge cases (numbered to match §"Edge cases")**

- Empty room (1), root-only (2), deleted messages (3), detached (4), realtime arrival (5), own-bubble restrictions (6), observer mode (7), deep trees (8), oscillating tags (9), conflicting tags (10), same tag by two participants (11), tag to deleted message (12), eligibility refused (13), first render (14), new cluster mid-stream (15), double-tag (16), tangent + branch_recommended (17), own-bubble concession (18), admin (19), evidence_debt + sourced (20), needs_source on evidence (21), source_attached + needs_source (22).

### `__tests__/manualTagModel.test.ts` (~280 lines)

**Eligibility matrix coverage**

- For each of the 10 manual tag codes × 4 actor roles × 2 own-bubble values (80 cases), assert `isApplyAllowed` returns the expected value per the matrix in §"Manual tag vocabulary".

**Apply / remove semantics**

- `applyManualTag` with allowed eligibility → ledger contains the new entry.
- `applyManualTag` with disallowed eligibility → ledger unchanged (reference-equal); debug event with `cause: 'eligibility_refused'`.
- `applyManualTag` with the same `(code, userId)` twice → ledger unchanged on second call (dedupe).
- `applyManualTag` to non-existent `messageId` → ledger unchanged; debug event with `cause: 'unknown_message_id'`.
- `removeManualTag` of a present tag → entry removed; ledger structurally changed.
- `removeManualTag` of an absent tag → ledger reference-equal.

**Dedupe key stability**

- `makeManualTagDedupeKey('needs_source', 'user-1')` returns the same string across two calls.
- Different users produce different keys.

**Cluster-level aggregation**

- Two participants apply different tags on different moves in the same cluster → `ClusterMetadataSummary.manualTagCodes` contains both codes once.
- `taggingParticipantCount` counts distinct user ids.

### `__tests__/autoMetadataModel.test.ts` (~360 lines)

**Per-code derivation (one happy + one boundary for each of 16)**

For each `AutoMetadataCode`:
- Build a minimal fixture that produces the target code.
- Assert `byMessage.get(messageId).autoDerivedMetadata.map(e => e.code)` includes the target.
- Assert `inputSignals` lists ≤ 4 string entries naming the upstream sources.

Tests for boundary conditions:
- `has_reply` boundary: 0 children vs 1 child.
- `has_rebuttal` boundary: 1 non-challenge child vs 1 challenge child.
- `source_requested` boundary: child with `messageContribution === 'source_requested'` vs `messageContribution === 'clarified'`.
- `repeated_axis_pressure` boundary: 1 same-axis non-additive vs 2 same-axis non-additive (default threshold 2).
- `no_response_after_n_turns` boundary: 2 room-wide turns since open request vs 3 turns (default threshold 3).
- `point_stalled` boundary: cluster state `'rebutted'` vs `'moved_on_by_affirmative'`.
- `point_exhausted` boundary: cluster state `'rebutted'` vs `'exhausted'`.
- `synthesis_candidate` boundary: cluster state `'rebutted'` vs `'synthesis_ready'`.

**Cluster-wide mirroring**

- `point_stalled` / `point_exhausted` / `synthesis_candidate` appear on every cluster member when the cluster reaches the corresponding lifecycle state.
- The `inputSignals` field documents the cluster derivation (e.g. `'lifecycle.cluster.state === exhausted'`).

**Doctrine anchor — popularity / heat / engagement do not feed auto-metadata**

- Same approach as ledger test: identical fixtures with different heat/standing produce deep-equal auto-metadata entries (modulo `detectedAt`).

**Doctrine anchor — no AI re-derivation**

- A source-scan test asserts no value import of `deriveMessageCategory` etc. (see "Forbidden imports" below).

**Idempotency**

- Calling the deriver twice with reference-equal inputs produces deep-equal outputs (or reference-equal if the implementer adds an internal cache).

### `__tests__/metadataEvents.test.ts` (~240 lines)

**Snapshot-diff causation**

- First render with cluster state `'open'` → no events.
- First render with cluster state `'rebutted'` → one event `'open' → 'rebutted'`.
- Second render with cluster transitioning `'rebutted' → 'sourced'` → one event.
- Same state across two renders → no event.
- `message_contribution` change without cluster-state change → message-level event only.
- Cluster transition attribution: only the latest member of the cluster is credited.
- New cluster appears (BR-001 branch creation) → event with `fromState: 'open'`.

**Event log composition**

- Add-tag → `kind: 'add'`, `codeFamily: 'manual_tag'`.
- Remove-tag → `kind: 'remove'`.
- Auto-metadata code flips on → `kind: 'add'`, `codeFamily: 'auto_metadata'`.
- Auto-metadata code flips off → `kind: 'remove'` (rare in normal play; possible when a deletion upstream eliminates the trigger).
- Event ids are stable across re-derivations with the same inputs.

**Ban-list on `cause` field**

- `cause` field contains no verdict / amplification / person-attribution tokens.
- All `cause` values are limited to the known causes (`'eligibility_refused'`, `'unknown_message_id'`, `'message_deleted'`, `null`).

### `__tests__/metadataPlainLabels.test.ts` (~140 lines)

**Plain-language mapping coverage**

For every code in `ALL_MANUAL_TAG_CODES`:
- `toPlainLanguage(code)` returns a non-empty string.
- `getManualTagPlainLabel(code)` returns the same string.
- `looksLikeInternalCode(label)` returns `false`.
- Label ≤ 32 characters.
- Label is mixed-case English (not snake_case, not ALL CAPS).

Same for every code in `ALL_AUTO_METADATA_CODES`.

**Backward compat with LIFE-001 labels**

- Shared codes (`source_requested`, `quote_requested`, `branch_suggested`) keep their LIFE-001-set labels.
- `evidence_debt` label updated from `'Receipts needed'` to `'Evidence debt'` (the only change). Other existing labels unchanged.

**Ban-list — verdict tokens**

- For every code: `getManualTagPlainLabel(code)` and `getAutoMetadataPlainLabel(code)` contain zero tokens from the verdict list.

**Ban-list — amplification tokens**

- Same for the amplification list.

**Ban-list — snake_case**

- `looksLikeInternalCode(label)` returns `false` for every label.

### `__tests__/metadataForbiddenImports.test.ts` (~80 lines)

A source-scan test (uses `fs.readFileSync` per LIFE-001 precedent) that asserts:

- No file in `src/features/metadata/` imports `deriveMessageCategory`, `derivePrimaryQualifier`, `deriveMessageQualifiers` as a value (type-only imports OK).
- No file imports `deriveAxis` as a value (axis comes from `PointLifecycleSnapshot.axis`).
- No file imports `applyAntiAmplification` as a value.
- No file imports anything from `src/features/engagementIntelligence/`.
- No file imports `'react'`, `'react-native'`, `'@supabase/supabase-js'`, `'expo-*'`.
- No file calls `fetch`, `XMLHttpRequest`, or any network primitive.
- No file uses `process.env.ANTHROPIC_API_KEY` / `XAI_API_KEY` / `SUPABASE_SERVICE_ROLE_KEY`.

### `__tests__/metadataDoctrineAnchors.test.ts` (~180 lines)

Concentrated doctrine tests across all surfaces:

**Manual tag ≠ moderation flag**

- Build a fixture with both `public.flags`-style flag codes (`'flag:civility'`) in `node.droppedTags` AND a manual tag applied. Assert:
  - `MoveLinkageRecord.userAppliedTags` does NOT contain the flag code.
  - `MoveLinkageRecord.semanticFlags` mirrors the flag code (as one would expect — it's a surface signal) but no auto-metadata code is derived from it.
  - No `MetadataEvent` of `codeFamily: 'manual_tag'` references the flag code.

**Auto metadata is non-blocking**

- Programmatic check: `JSON.stringify(ledger)` scanned for `'block'`, `'prevent'`, `'reject'`, `'forbid'`, `'disallow'`, `'denied'`. Zero matches.

**No verdict tokens in any produced field**

- Recursively scan every string field in the ledger for verdict tokens. Zero matches.

**Observers cannot apply tags**

- 10 cases (one per tag code) where observer attempts apply → ledger unchanged.

**Cluster-wide auto codes mirror correctly**

- A 5-member cluster reaches `'exhausted'`. Every member's `autoDerivedMetadata` includes `'point_exhausted'`.

### Integration with LIFE-001

`__tests__/metadataLifecycleIntegration.test.ts` (~200 lines):

- Build a 50-node fixture with BR-001's branch model + LIFE-001's lifecycle map. Run `buildMoveMetadataLedger`.
- Assert cluster boundaries in `ledger.byCluster` match `lifecycleMap.byCluster`.
- Assert `byMessage.get(id).disagreementAxis === lifecycleMap.byMessage.get(id).axis`.
- Assert lifecycle causation entries follow snapshot-diff semantics across two renders.

### Coverage target

- 100% line + branch coverage on `moveMetadataLedger.ts`, `manualTagModel.ts`, `autoMetadataModel.ts`, `metadataEvents.ts` (achievable — pure-TS, no I/O, every branch reachable from the decision tables).
- ≥ 95% coverage on `index.ts` (re-exports only).

### Approximate test-count delta

**+200 to +250** tests across the seven new test files.

---

## Doctrine / safety self-check

- **Manual tags + auto metadata are gameplay signals, never verdicts.** Ban-list test enforces; doctrine-anchor test asserts no truth/heat/popularity input affects output. ✓
- **No verdict / person-label tokens in any produced string.** `PLAIN_LANGUAGE_COPY` extension ban-list scanned. `getManualTagPlainLabel` + `getAutoMetadataPlainLabel` ban-list scanned. ✓
- **Manual tag ≠ moderation flag.** Type-level separation: `ManualTagCode` is a closed union of 10 codes; flag codes never appear. `userAppliedTags` is structurally distinct from `semanticFlags`. Test asserts. ✓
- **`evidence_debt` describes a debt, not a moral failing.** Plain label is `'Evidence debt'`; ban-list scanned. ✓
- **Heat / popularity / engagement / virality / strength bands NEVER feed any code.** Deep-equal ledger output regardless of `standingBand` / `toneBand` / `temperatureBand` / `topicScore` value. Tests assert. ✓
- **No service-role / no direct insert / no production AI / no Supabase mutation / no `.env*` changes.** Pure-TS model. No network. No DB. No Edge Function. No env. ✓
- **Rules engine stays pure.** `src/lib/constitution/engine.ts` untouched. ✓
- **AI moderator hard limits.** No AI call. No `authoritative: true` flag emitted. ✓
- **v1 scope guards.** No voting, no search, no push, no OAuth, no public API. ✓
- **LIFE-001 surface lock.** `PointLifecycleState`, `PointLifecycleMap`, `getPointLifecyclePlainLabel`, `LIFECYCLE_PRIORITY` all consumed read-only. ✓
- **BR-001 surface lock.** `branchRootMessageId`, `branchId`, `BranchCollapseState` all consumed read-only. ✓
- **VG-002 surface lock.** Rail rendering contract untouched. ✓
- **EV-001 / EV-002 surface lock.** `EvidenceArtifact`, `SourceChainStatus`, `summarizeArtifactsForReceiptChip` consumed read-only. ✓
- **No new dependency.** `package.json` unchanged. Pure-TS only. ✓
- **No persistence.** Manual tags + ledger are in-memory; no Supabase column, no migration, no Edge Function. v2 may persist via a `point_tags` table with operator approval; explicitly NOT in this card. ✓
- **No auto-amplification.** No code's derivation rule reads engagement / popularity. No code's plain label sounds like an amplification claim. ✓
- **Observer-safe.** Observers can READ the ledger (it's a model — anyone can read). Observers cannot APPLY tags (eligibility table). ✓
- **Own-bubble safe.** Own-bubble can apply only `concession_offered`, `narrowed_claim`, `ready_for_synthesis` (mirrors Stage 6.1.8 safety). Other tags refused via eligibility. ✓
- **Accessibility — color independence.** Labels are the textual signal. ✓
- **Accessibility — reduce-motion.** No animation in this card. ✓
- **Performance — O(n).** Verified in §"Test plan"; 250-message synthetic fixture < 30 ms. ✓
- **JSON-serializability.** Verified by test (round-trip via JSON.parse / JSON.stringify). ✓
- **All inputs read from existing fields.** META-001 never re-derives `MessageCategory`, never re-classifies axis, never re-runs anti-amplification. Source-scan test (forbidden-imports) enforces. ✓
- **`PLAIN_LANGUAGE_COPY` is the single source of plain-language truth.** No parallel map introduced. Existing `evidence_debt` entry updated in place; new entries appended. ✓
- **Forbidden-imports doctrine anchor.** Source-scan test asserts no value imports of derivation functions, no React/RN/Supabase imports, no AI pipeline imports. ✓

---

## File changes

### New files

| Path | Purpose | Approx LOC |
|---|---|---:|
| `src/features/metadata/moveMetadataLedger.ts` | Entry point. Exports `MoveLinkageRecord`, `MoveMetadataLedger`, `ManualTagEntry`, `AutoMetadataEntry`, `MetadataEvent`, `LifecycleCausationEntry`, `ClusterMetadataSummary`, `AutoMetadataConfig`, `EligibilityContext`, `ApplyManualTagInput`, `BuildMoveMetadataLedgerInput`. Exports `buildMoveMetadataLedger`, `applyManualTag`, `removeManualTag`, `getManualTagPlainLabel`, `getAutoMetadataPlainLabel`, `_forbiddenMetadataTokens`. Frozen vocabularies + eligibility table + default config. Pure TS. No React, no Supabase. | ~480 |
| `src/features/metadata/manualTagModel.ts` | Internal helpers: `getManualTagEligibility`, `isApplyAllowed`, `makeManualTagDedupeKey`. Pure TS. | ~120 |
| `src/features/metadata/autoMetadataModel.ts` | Internal helpers: `deriveAutoMetadataForMessage` + per-code predicates. Pure TS. | ~280 |
| `src/features/metadata/metadataEvents.ts` | Snapshot-diff helpers: `diffLedgers`, `computeLifecycleCausationForMove`. Pure TS. | ~180 |
| `src/features/metadata/index.ts` | Public re-exports. Single import surface for consumers. | ~50 |
| `__tests__/moveMetadataLedger.test.ts` | Ledger entry-point tests: per-message fields, cluster aggregation, map shape, JSON-serializability, doctrine anchors (no heat input, no auto-population, moderation-flag boundary), performance, all edge cases. | ~520 |
| `__tests__/manualTagModel.test.ts` | Eligibility matrix coverage (80 cases), apply/remove semantics, dedupe key, cluster aggregation. | ~280 |
| `__tests__/autoMetadataModel.test.ts` | Per-code derivation (16 codes × happy + boundary), cluster mirroring, doctrine anchors, idempotency. | ~360 |
| `__tests__/metadataEvents.test.ts` | Snapshot-diff causation, event log composition, attribution, `cause` field ban-list. | ~240 |
| `__tests__/metadataPlainLabels.test.ts` | Plain-language mapping coverage for all 26 codes + LIFE-001 backward-compat + ban-list. | ~140 |
| `__tests__/metadataForbiddenImports.test.ts` | Source-scan: no derivation function value imports, no React/RN/Supabase imports, no AI pipeline imports. | ~80 |
| `__tests__/metadataDoctrineAnchors.test.ts` | Concentrated doctrine tests: tag ≠ flag, no blocking, no verdict tokens, observer ineligibility, cluster mirroring. | ~180 |
| `__tests__/metadataLifecycleIntegration.test.ts` | Integration with LIFE-001 + BR-001: cluster boundaries, axis mirror, snapshot-diff across two renders. | ~200 |

### Modified files

| Path | What changes | What stays |
|---|---|---|
| `src/features/arguments/gameCopy.ts` | Append 25 new entries to `PLAIN_LANGUAGE_COPY` for the 26 codes (1 already present: `evidence_debt`, value updated from `'Receipts needed'` to `'Evidence debt'`; shared codes from LIFE-001 — `source_requested`, `quote_requested`, `branch_suggested` — unchanged). NO new exported function added; `toPlainLanguage` already handles new keys. NO new file imports. | All existing entries (other than `evidence_debt`), all existing exports (`toPlainLanguage`, `toPlainLanguageOrSuppress`, `looksLikeInternalCode`), all other constants. |

### Deleted files

None.

### Approximate test-count delta

**+200 to +250** tests across the seven new test files, plus +1–2 minor adjustments in any existing test that asserts the exact string `'Receipts needed'` for `evidence_debt`.

---

## Operator steps

**None — pure code change.** META-001 adds:

- 5 new TS files in `src/features/metadata/`.
- 7 new test files in `__tests__/`.
- 1 modified file (`src/features/arguments/gameCopy.ts` — extends `PLAIN_LANGUAGE_COPY` by 25 entries + updates `evidence_debt` value).

No migration, no Edge Function deploy, no Supabase write, no env change, no new dependency. Operator runs the standard pre-PR checks during Review:

```powershell
npm run typecheck
npm run lint
npm run test
```

Expected test-count delta: approximately **+200 to +250** (taking the baseline from 2624 to roughly 2820–2870).

---

## Dependencies (cards / docs / files)

### META-001 consumes (from shipped surfaces)

- **BR-001 (`branchTopologyModel.ts`)** — `branchRootMessageId` on `ArgumentTimelineMapNode` as the cluster identifier. `isEvidenceLikeNode` and `buildEvidenceThreadMap` cross-referenced for auto-metadata derivation (not yet used in v1 but available). `BranchCollapseState` not consumed (collapse is a UI concern).
- **LIFE-001 (`pointLifecycleModel.ts`)** — `PointLifecycleState`, `PointLifecycleMap`, `PointLifecycleSnapshot`, `PointLifecycleClusterSummary`, `getPointLifecyclePlainLabel`, `PointLifecycleAxis`. Read-only consumers.
- **`argumentGameSurfaceModel.ts`** — `ArgumentTimelineMapNode`, `ArgumentTimelineMapEdge`, `ArgumentTimelineMapModel`. Read-only.
- **`messageQualifiers.ts`** — `MessageCategory` / `MessageQualifier` types referenced in docs; the qualifier codes are read via `node.droppedTags[].code` (already populated by upstream). Does NOT call `deriveMessageCategory` per render (forbidden-imports test enforces).
- **`evidence/evidenceModel.ts`** — `EvidenceArtifact`, `SourceChainStatus`, `summarizeArtifactsForReceiptChip`. Consumed read-only.
- **`pointStanding/antiAmplification.ts`** — Referenced in docs only; META-001 does NOT call `applyAntiAmplification`. Anti-amplification operates on standing, not metadata.
- **`arguments/gameCopy.ts`** — `PLAIN_LANGUAGE_COPY` (extended in place), `toPlainLanguage`, `looksLikeInternalCode`. Single source of plain-language truth.

### META-001 blocks

- **SC-004** — Timeline node action dock reads metadata to gate action chips.
- **ST-002** — Suggested reply flags reads metadata for per-bubble badges + suggestion ordering.
- **GAME-001** — Advisory threshold tuning consumes auto-metadata observations.
- **RULE-003** — Lifecycle-to-UX doctrine map extends `PLAIN_LANGUAGE_COPY` with helpers per tag/code.
- **GAL-002** — Gallery first-suggested-move hint reads root-cluster auto-metadata.
- **AN-003** — Diagnostics aggregates per-room metadata-event counts.
- **EV-003** (future) — Evidence-debt tracker consumes `evidence_debt` tag + `source_requested` / `quote_requested` auto codes.
- **HIST-001** (P2 backlog) — Lifecycle event history surfaces `metadataEvents` chronologically.

Per `docs/roadmap-timeline-tree-game-board.md` line 442–451: META-001 is Wave 1 Foundation; SC-004 / ST-002 / GAME-001 / RULE-003 / GAL-002 / AN-003 are Waves 2–4 consumers.

### META-001 is blocked by

- **BR-001 (shipped — `6097802`)** — cluster id (`branchRootMessageId`) and branch identity come from BR-001's surface model.
- **LIFE-001 (shipped — `ea62b6e`)** — lifecycle state, axis, snapshot, cluster summary.
- **EV-001 / EV-002 (shipped)** — `EvidenceArtifact`, `SourceChainStatus`.
- **Stage 6.1.5.1 message qualifiers (shipped)** — qualifier codes on `node.droppedTags[].code`.
- **Stage 6.4 gameCopy.toPlainLanguage (shipped)** — the plain-language extension lives in the existing table.

All prerequisites are merged.

---

## Risks

1. **Re-deriving signals from scratch instead of reading existing fields.** This is roadmap §16 risk #1. Mitigation: the design lists EVERY input field by name; the forbidden-imports test scans source files and fails if `deriveMessageCategory` / `derivePrimaryQualifier` / `deriveAxis` / `applyAntiAmplification` is value-imported (type imports OK). LIFE-001 established the precedent.
2. **Manual-tag vs moderation-flag confusion bleeds back into UI.** This is roadmap §16 risk #4 by name. Mitigation: type-level separation (`ManualTagCode` is a closed 10-code union; flag codes are never imported as `ManualTagCode`); test asserts no flag code surfaces in `userAppliedTags`; field names in the linkage record (`userAppliedTags` vs `semanticFlags`) are visually distinct.
3. **`evidence_debt` tag colliding with the existing `'Receipts needed'` label.** Mitigation: the label change is a value update; the code is unchanged; runner pipeline reads the code, not the label (same precedent as LIFE-001's `synthesis_ready` update). A test asserts no runner-side regression.
4. **The 16 auto-metadata codes are too granular.** SC-004 + ST-002 may struggle to map all 16 to action sets. Mitigation: the code list is locked at design time; consumers may map multiple codes to a single action (e.g., `point_stalled` / `point_exhausted` / `point_stalled` all map to "Branch this off or synthesize" in SC-004). RULE-003 will add the mapping helpers.
5. **Snapshot-diff misses transitions in race conditions.** If two renders happen in quick succession and `previousLifecycleMap` is not threaded, transitions are missed. Mitigation: the caller (room shell) owns persisting `previousLifecycleMap` across renders. The API documents the requirement. Test asserts the no-previous case fires `from: 'open'` events for non-open clusters.
6. **Cluster-wide auto-metadata mirroring blurs the per-move ↔ per-cluster distinction.** A user inspecting one bubble sees `point_exhausted` even though the bubble itself isn't the exhausted move. Mitigation: `inputSignals` documents the cluster source; ST-002 / SC-004 can format the chip as "Cluster: Point exhausted" vs "This move: Has evidence" for clarity. The doctrine guardrail is that the code is correctly applied to every cluster member — the user-facing copy is RULE-003's job.
7. **Concurrent manual-tag applications.** Two participants apply the same tag simultaneously; both succeed (different `appliedByUserId` → different `dedupeKey`s). The ledger reflects both entries; no merge conflict. Mitigation: the dedupe key is per-user, so concurrent applies are independent.
8. **Performance at 250+ messages with snapshot-diff.** Snapshot-diff is O(clusters × member-count). At 250 messages / 30 clusters / avg 8 members = 240 comparisons. < 1 ms in V8. Mitigation: test asserts < 30 ms at 250 messages.
9. **A future LIFE-001 vocabulary change breaks META-001's `LifecycleCausationEntry`.** Mitigation: META-001 uses LIFE-001's `PointLifecycleState` type union directly; a new state automatically typechecks. Tests use `ALL_POINT_LIFECYCLE_STATES` for iteration, so a new state is automatically covered.
10. **The eligibility matrix may not match every operator's intent.** v1 conservative: observers cannot apply, own-bubble can apply only `concession_offered` / `narrowed_claim` / `ready_for_synthesis`. Mitigation: the matrix is an exported constant (`MANUAL_TAG_ELIGIBILITY`) — operator review can adjust without changing application code. A follow-up card may extend.
11. **`participant_skipped_node` rule fires too aggressively in low-activity rooms.** Mitigation: default threshold is conservative (3 same-side turns elsewhere); GAME-001 will tune.
12. **Admin-applied tags get persisted to a future migration accidentally.** Mitigation: explicit "no persistence" doctrine line + tests asserting no Supabase calls. v2 persistence card will require operator approval and a dedicated `point_tags` table — META-001 explicitly does not introduce one.

---

## Do not implement in this card

Explicit list of related work that META-001 does NOT include. Reduces scope creep.

- **SC-004 timeline node action dock.** No UI in this card. Action dock is Wave 2.
- **ST-002 suggested reply flags.** Suggestion derivation is ST-002's; META-001 ships the input.
- **GAME-001 exhaustion threshold tuning.** META-001 ships safe defaults for `noResponseTurnThreshold` / `repeatedAxisPressureThreshold` / `participantSkippedTurnThreshold`; GAME-001 may tune.
- **RULE-003 lifecycle-to-UX doctrine map.** Helpers + action lists per tag/code are RULE-003's; META-001 ships only the labels.
- **GAL-002 gallery first-suggested-move.** Gallery card hint sourcing is GAL-002's; META-001 ships the input.
- **AN-003 diagnostics.** Per-room aggregate counts is AN-003's; META-001 ships the event log.
- **EV-003 evidence-debt tracker.** EV-003 will use the `evidence_debt` manual tag; META-001 just provides the tag vocabulary.
- **HIST-001 lifecycle event history view.** Cards-detail history UI is HIST-001 (P2 backlog); META-001 ships the `metadataEvents` log it would consume.
- **Persistence.** No `point_tags` table. No migration. No Supabase write. v1 is render-time only. Per roadmap §19.
- **Edge Function.** No `derive-metadata` or similar. Pure-TS only.
- **AI inference.** No Anthropic / xAI / OpenAI call. No `authoritative: true` flag emitted.
- **`submit-argument` change.** No change to the existing posting flow. Metadata is a downstream consumer of the surface model + lifecycle.
- **Constitution engine change.** Out of scope.
- **`RailBranchKind` / `RailSegmentInput` / `argumentGameSurfaceModel` mutation.** All consumed read-only.
- **LIFE-001 vocabulary change.** All 18 lifecycle states consumed read-only.
- **`PointStandingDelta` / `OpenIssueDebt` mutation.** Read-only references in docs; no calls.
- **Anti-amplification post-processing of metadata.** Anti-amplification operates on standing, not metadata. Doctrine line in module docblock.
- **Adding new color or stroke tokens.** No visual layer in this card.
- **A new UI surface for tags/metadata.** SC-004 / ST-002 / GAL-002 ship the UIs.
- **Auto-applying manual tags from deterministic rules.** Manual tags are participant-applied only. Auto-derived signals are a separate vocabulary.
- **Cross-room tag aggregation.** Tags are per-room (per-tree). No room-spanning state.
- **Persistence of `MoveMetadataLedger` to Supabase.** Per roadmap §19.
- **Moderation-flag insertion or dismissal.** Moderation flags live in `public.flags` and are not touched by META-001.
- **Animation / transitions on tag application.** No UI; no animation.
- **Keyboard shortcut for tag application.** No UI in this card; IX-003 owns keyboard nav.
- **Tag taxonomy extension.** The 10 manual + 16 auto codes are locked.

---

## Discovery / follow-up candidates (per §18 backlog policy)

These appeared while walking the design. Each passes the three-criterion test (removes timeline friction, deterministically testable, no new dependency / live AI / service-role). They are NOT part of META-001 acceptance; file as P2 issues after META-001 lands.

- **META-1A — Persisted ledger.** Add a `point_tags` table (operator-approved migration) + an Edge Function that reads RLS-scoped tags + a sync layer on the room shell. Persists manual tags across sessions / users. Out of scope per roadmap §19. P2.
- **META-1B — Real-time multi-user tag sync.** When persistence lands (META-1A), Supabase Realtime broadcasts tag changes to all room subscribers. Requires META-1A. P2.
- **META-1C — Admin audit-log surface.** Admin tab showing the chronological `metadataEvents` log for a room. Useful for moderation review. Depends on META-1A for persistence; otherwise dev-only. P2.
- **META-1D — Tag taxonomy cleanup.** Six-month review of usage data (after AN-003 lands). Some codes may be merged or dropped if rarely used. P2.
- **META-1E — Metadata-diff inspector for Cards mode.** A Cards-detail panel showing "what changed on this move" (consumes `metadataEvents` for the selected message). Companion to HIST-001. P2.
- **COPY-001 (already in roadmap §18)** — Plain-language label review for all 26 META-001 codes. Same pass that LIFE-001 will need. P2.
- **A11Y-001 (already in roadmap §18)** — Touch target audit for tag chips. Companion to SC-004. P2.
- **HIST-001 (already in roadmap §18)** — Cards-detail event history view. Consumes `metadataEvents` directly. P2.

---

## Designer's eight answers (operator's standing prompt)

1. **What does this card define that later cards consume?**
   - The 10-code `ManualTagCode` enum, the 16-code `AutoMetadataCode` enum, the per-move `MoveLinkageRecord` shape, the per-cluster `ClusterMetadataSummary` shape, the per-tree `MoveMetadataLedger` shape, the `MetadataEvent` log shape, the `LifecycleCausationEntry` snapshot-diff shape, the eligibility matrix (`MANUAL_TAG_ELIGIBILITY`), the v1 plain-language labels for all 26 codes, and the `applyManualTag` / `removeManualTag` / `buildMoveMetadataLedger` API surface.

2. **What should later cards NOT redefine?**
   - The 10 manual tag codes and the 16 auto metadata codes (both locked vocabularies).
   - The eligibility matrix (who can apply which tag in which actor role / own-bubble combination).
   - The snapshot-diff causation algorithm.
   - The cluster boundary (= `branchRootMessageId`, inherited from BR-001).
   - The plain-language labels (RULE-003 may extend with helpers; the labels themselves are META-001's).
   - The manual-tag-vs-moderation-flag boundary (`userAppliedTags` is structurally distinct from `semanticFlags`; flag codes never appear in `ManualTagCode`).

3. **Which existing module owns the model?**
   - A new module: `src/features/metadata/`. Not under `lifecycle/` (lifecycle is the 18-state vocabulary; metadata is the broader observation + manual-tag layer) and not under `arguments/` (would push that directory toward 25 files). New directory matches LIFE-001's sibling-module precedent.

4. **Which UI copy is normal-user-facing?**
   - All 10 manual-tag plain labels (`'Needs source'`, `'Needs quote'`, `'Definition fight'`, `'Scope challenge'`, `'Mechanism challenge'`, `'Evidence debt'`, `'Concession offered'`, `'Narrowed claim'`, `'Tangent / side issue'`, `'Ready for synthesis'`).
   - All 16 auto-metadata plain labels (`'Has a reply'`, `'Has a challenge'`, `'Has a counter-challenge'`, `'Evidence attached'`, `'Source requested'`, `'Quote requested'`, `'Source attached'`, `'Quote attached'`, `'Same side skipped'`, `'No follow-up yet'`, `'Repeated challenge on same axis'`, `'Branch suggested'`, `'Branch created here'`, `'Point stalled'`, `'Point exhausted'`, `'Synthesis candidate'`).
   - Zero internal codes. Zero verdict tokens. Zero amplification tokens.

5. **Which states are internal only?**
   - The `eventId` / `causationKey` / `dedupeKey` / `inputSignals` / `cause` fields are internal debug surfaces. They never appear in normal-user UI.
   - The `MetadataEvent.cause` enum values (`'eligibility_refused'`, `'unknown_message_id'`, `'message_deleted'`) are internal.
   - The threshold constants (`noResponseTurnThreshold`, etc.) are internal — RULE-003 / GAME-001 may surface plain-language descriptions but the numeric values are not user-facing.

6. **Which actions are participant-only vs observer-safe vs own-bubble restricted?**
   - **Manual tag application is participant-only.** Observers cannot apply tags in v1. Admins can apply all 10 tags.
   - **Own-bubble may apply only `concession_offered`, `narrowed_claim`, `ready_for_synthesis`.** Other tags on own bubble are eligibility-refused. This mirrors the Stage 6.1.8 own-bubble own-action set (`Qualifiers · Request deletion` + new tag controls).
   - **Reading the ledger is observer-safe.** The model is a pure-TS deriver; anyone (including observers) can compute and read it.
   - **Auto-derived metadata applies regardless of viewer.** It's an observation about move structure, not an action.
   - **Tag removal is restricted to the original applier** (`removeManualTag` takes `applierUserId` and only removes that user's tag with that code).

7. **Which tests prove acceptance?**
   - `moveMetadataLedger.test.ts` — linkage record fields, cluster aggregation, map shape, JSON-serializability, all edge cases.
   - `manualTagModel.test.ts` — eligibility matrix (80 cases), apply/remove semantics, dedupe.
   - `autoMetadataModel.test.ts` — per-code derivation (16 codes × happy + boundary), cluster mirroring, doctrine anchors.
   - `metadataEvents.test.ts` — snapshot-diff causation, attribution, event log composition.
   - `metadataPlainLabels.test.ts` — plain-language coverage for all 26 codes, LIFE-001 backward-compat, ban-list.
   - `metadataForbiddenImports.test.ts` — source-scan for forbidden value imports (the headline doctrine guard).
   - `metadataDoctrineAnchors.test.ts` — concentrated doctrine tests (tag ≠ flag, no blocking, no verdict tokens, observer ineligibility, cluster mirroring).
   - `metadataLifecycleIntegration.test.ts` — integration with LIFE-001 + BR-001 (cluster boundary match, axis mirror, snapshot-diff across renders).

8. **What would make this card block Build?**
   - Discovery: if LIFE-001's `PointLifecycleSnapshot.axis` turns out NOT to be populated for every message in practice (rare — but if upstream pipeline doesn't always set it), META-001 would need to either fall back to re-deriving (forbidden) or accept `null` axis on some moves. Mitigation: the design explicitly types `disagreementAxis` as `PointLifecycleAxis | null` and treats `null` as "no axis derivable" (no exhaustion pressure attributable, no axis-based auto codes fire). Build need not be blocked.
   - Discovery: if EV-001's `artifactsByMessageId` is not exposed by the room shell at render time, the implementer must thread it (already done via `getTimelineEvidenceContract` callers; pattern established).
   - Discovery: if the `MetadataEvent` log grows unboundedly across renders without a TTL, memory usage could climb. v1 mitigation: events are scoped to the current ledger build (= one render); the caller decides whether to persist them. Test asserts no global accumulator.
   - Discovery: if the `applyManualTag` API needs to support "tag with note" before SC-004 ships, the `note` field is already in the shape. SC-004 reads it; v1 has no UI for it.

---

## Quality bar

A good META-001 design doc lets a fresh implementer build the module without asking clarifying questions about:
- The locked 10 + 16 code vocabularies (table-defined here).
- The eligibility matrix (table-defined here).
- The snapshot-diff causation algorithm (pseudocode here).
- The forbidden-imports test (LIFE-001 precedent referenced).
- The plain-language map extension (single source of truth, same pattern as LIFE-001).
- Persistence (explicitly out of scope per roadmap §19).
- UI (explicitly deferred to SC-004 / ST-002 / GAL-002).

If any of those are unclear after reading this doc, file a follow-up question — do not improvise.
