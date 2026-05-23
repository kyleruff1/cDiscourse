# COMP-001 — Deterministic composition layer for connected-node visual state

**Card:** COMP-001 (Rules UX · P1 · M · Release 6.9).
**Status:** Design.
**Epic:** Rules UX.
**Hard dependency:** MCP-MOD-004 (#233) — the `SEMANTIC_CLASSIFIER_CATALOG` constant is the catalog reference COMP-001's rules import.
**Soft dependency:** MCP-CAT-001 (#238) — the 12 proposed new ids (`disputes_evidence_applicability`, `opens_evidence_debt_marker`, `closes_evidence_debt_marker`, `introduces_sub_axis`, `concedes_with_new_dispute`, …) make several composition rules sharper. COMP-001 ships rules for the current 23-id catalog and gains the new-id rules when MCP-CAT-001 lands.
**Unblocks:** BR-001 (point-lifecycle states), VG-002 (gradient wave rail), QOL-036/QOL-037 (evidence-object UI). These cards consume `NodeVisualMutation` values rather than reading raw classifier packets.
**Companion:** [`COMP-001-worked-examples.md`](./COMP-001-worked-examples.md) — move-by-move walkthrough of two scenarios.

---

## §1 — Goal

The composition layer is a pure TypeScript function that sits between the semantic referee's binary classifier output and the timeline / tree UI. It takes three inputs — the current move's `SemanticRefereePacket` (the 23-boolean signal vector today, 35 after MCP-CAT-001), the thread's accumulated `CompositionState` (open evidence debts, active sub-axes, concession chains, source-chain gaps, synthesis readiness), and the current move's structural metadata (`moveId`, `parentId`, `authorId`, `argumentType`, `side`, `depth`, position in the author's move sequence) — and returns a `CompositionResult` containing zero or more `NodeVisualMutation` objects (each naming a target `moveId` and a typed enum mutation), the updated `CompositionState` for the next call, and the current move's own visual state. The timeline cards downstream consume `NodeVisualMutation` values; no classifier prose ever reaches the user surface.

---

## §2 — Hard architectural constraints

Each constraint is load-bearing. The reviewer enforces them.

### 2.1 The function is pure

No network, no async, no side effects, no database reads. The function receives its inputs and returns its outputs. The caller (the room hook or the smoke-test orchestrator) is responsible for accumulating `CompositionState` across moves.

**Why:** purity makes the layer fully snapshot-testable. Identical inputs always produce identical outputs. No mocks needed; no flakes possible.

### 2.2 The function makes no truth claims

It maps structural patterns to visual states. "Evidence debt opened" is a structural state (a request was filed; it has not yet been answered), not a judgment that the evidence is bad. "Point conceded" is a structural state (an author marked a narrowing or concession), not a judgment that the concession was correct.

**Why:** doctrine. The composition layer is bound by the same rule as the classifier — never decide who is right.

### 2.3 The function produces no natural language

Every visual state mutation is a typed enum value. The UI rendering layer downstream maps enum values to user-facing copy via the existing `gameCopy.toPlainLanguage` pattern. The composition function never emits a string that a user reads.

**Why:** copy lives in one place. Adding a new locale or rewording a banner does not touch composition logic; rewording is a downstream concern.

### 2.4 The function is deterministic

Same inputs → same outputs. No randomness, no model calls, no heuristics that depend on external state. Snapshot tests are the regression baseline.

**Why:** auditability. The reviewer can read the function and predict its output for any input. Cache keys are reliable.

### 2.5 The function respects the binary contract

It reads `0` / `1` values from `SemanticBinarySample.value`. It does not interpret `reasonCode` strings, confidence levels, or any free-text field. Richness comes from combinatorial patterns of binary signals — not from parsing model prose.

**Why:** the binary contract is what bounds the model's safety surface. The composition layer extending into reason-code parsing would re-introduce model prose as a load-bearing input, defeating the contract.

A narrow exception: the layer MAY read `confidence` to gate a rule (e.g., emit a mutation only on `medium`/`high` confidence). This is allowed because confidence is a bounded enum (`low | medium | high`), not free text. It is not encouraged — most rules should fire on the binary alone.

### 2.6 The function does NOT decide what the AI classifies

The classifier catalog (`SEMANTIC_CLASSIFIER_CATALOG` after MCP-MOD-004 lands) defines which binary questions are asked. The composition layer defines what visual consequences follow from the answers. These are separate concerns with separate owners. Adding a new classifier id is a catalog change (MCP-CAT-001 territory). Adding a new composition rule is a COMP-001 change. The two slates do not collide.

---

## §3 — `CompositionState` data structure

The accumulator tracks thread-level state across moves. It is a typed object, not a class. The hook owns one instance per room session.

### 3.1 Top-level shape

```ts
export interface CompositionState {
  /** Evidence debts: each open one is keyed by openingMoveId. */
  readonly evidenceDebts: ReadonlyMap<string, EvidenceDebtState>;

  /** Clarification debts: separate ledger from evidence (they resolve differently). */
  readonly clarificationDebts: ReadonlyMap<string, ClarificationDebtState>;

  /** Active sub-axes: a sub-axis is opened when a move introduces a narrower
   * dispute on the same mainline; closed when the sub-axis reaches synthesis
   * or is abandoned by a tangent. */
  readonly activeSubAxes: ReadonlyMap<string, SubAxisState>;

  /** Concession chains: link a concession back to the challenge that elicited
   * it, so the challenge node can render "point resolved." */
  readonly concessionChains: ReadonlyMap<string, ConcessionLinkState>;

  /** Open source-chain gaps: keyed by the move that opened the gap. */
  readonly sourceChainGaps: ReadonlyMap<string, SourceChainGapState>;

  /** Narrowing lineage: links a narrowing move back to the broader-scoped
   * ancestor it narrows. The ancestor renders "scope narrowed downstream." */
  readonly narrowingLinks: ReadonlyMap<string, NarrowingLinkState>;

  /** Person-shift flags: which moves carry a person-shift warning. The
   * warning persists for the move's lifetime; resolution would require a
   * future "shift_repaired" classifier that doesn't exist yet. */
  readonly personShiftMoves: ReadonlySet<string>;

  /** Unplayable moves: which moves are marked as unengageable. */
  readonly unplayableMoves: ReadonlySet<string>;

  /** Derived: is the current sub-thread ready for synthesis? Computed from
   * accumulated state at the end of each composition call, but stored so
   * callers can read it without recomputing. */
  readonly synthesisReadiness: SynthesisReadinessState;
}
```

### 3.2 Per-item lifecycle types

```ts
export interface EvidenceDebtState {
  readonly openingMoveId: string;            // the move that fired asks_for_evidence
  readonly targetMoveId: string;             // the parent move whose evidence was requested
  readonly openingAuthorId: string;          // who asked
  readonly status: 'open' | 'resolved' | 'abandoned';
  readonly resolvingMoveId?: string;         // present iff status === 'resolved'
  readonly openedAt: string;                 // ISO timestamp from the opening move
}

export interface ClarificationDebtState {
  readonly openingMoveId: string;
  readonly targetMoveId: string;             // the move whose term/statement is unclear
  readonly status: 'open' | 'resolved' | 'abandoned';
  readonly resolvingMoveId?: string;
  readonly openedAt: string;
}

export interface SubAxisState {
  readonly openingMoveId: string;            // the move that introduced the sub-axis
  readonly parentAxisRootMoveId: string;     // the move where the parent axis began
  readonly status: 'open' | 'resolved' | 'abandoned';
  readonly resolvingMoveId?: string;
  readonly openedAt: string;
}

export interface ConcessionLinkState {
  readonly concedingMoveId: string;
  readonly conceededOnAxis: string | null;   // disagreementAxis when available
  readonly originatingChallengeMoveId: string | null;
                                              // the upstream challenge that elicited the concession;
                                              // null when no clear originator can be found
  readonly atMoveId: string;
}

export interface SourceChainGapState {
  readonly openingMoveId: string;
  readonly status: 'open' | 'filled' | 'abandoned';
  readonly fillingMoveId?: string;
}

export interface NarrowingLinkState {
  readonly narrowingMoveId: string;
  readonly broaderAncestorMoveId: string | null; // null when no broader scope can be identified
  readonly atMoveId: string;
}

export interface SynthesisReadinessState {
  readonly ready: boolean;
  readonly subThreadRootMoveId: string | null;  // which sub-thread is ready
  readonly openDebtCount: number;
  readonly sharedGroundMoveCount: number;
}
```

### 3.3 Lifecycle rules

For each tracked item type, the lifecycle is a small state machine:

- **Evidence debt:** `open` → `resolved` (when a downstream move fires `provides_evidence=1` + `evidence_supports_claim=1` against the debt's target) → terminal. Or `open` → `abandoned` (when the sub-thread containing the debt's target is fully superseded by a sub-axis resolution that doesn't engage the debt) → terminal.
- **Clarification debt:** identical state machine, triggered by `requests_clarification` / `answers_clarification`.
- **Sub-axis:** `open` → `resolved` (when the sub-axis reaches `ready_for_synthesis=1`) → terminal. Or `open` → `abandoned` (when a diagonal tangent navigates away from the sub-axis).
- **Source-chain gap:** `open` → `filled` (when a downstream move provides the missing link via `provides_evidence=1` + `evidence_supports_claim=1`, OR via `cites_retraction=1` against the gap-creating move) → terminal.
- **Concession link, narrowing link:** insert-only. These are historical records, not lifecycle objects. They never close.
- **Person-shift, unplayable:** insert-only sets. A move marked unplayable stays unplayable; the composition layer does not erase a structural fact.

### 3.4 What `CompositionState` does NOT track

- It does not track the argument's *content*. No bodies, no quotes, no excerpts. The state is purely structural.
- It does not track *truth*. No verdicts, no winner/loser.
- It does not track *user identity beyond authorId*. No display names, no PII.
- It does not track *prior classifier packets*. Each composition call is given the current move's packet; the layer's job is to reduce structural patterns into state transitions, not to re-classify.

---

## §4 — Composition rules

22 rules covering the current 23 classifier ids. Rules are grouped by the classifier family they primarily consume. Each rule documents: the triggering pattern, the target node(s) the mutation applies to, the `NodeVisualMutation` type emitted, how `CompositionState` is updated, and a one-line plain-language description of what the user sees on the timeline (for the implementer's benefit, not for the function to emit).

When several rules match a single packet, ALL matching rules fire. The mutations accumulate; the timeline renders the union.

### 4.1 Parent continuity rules

#### R-PC-01 — Parent engaged with anchored quote

- **Triggering pattern:** `responds_to_parent=1` AND `quote_anchors_parent=1`.
- **Target node:** the parent move (`parentId`).
- **Mutation:** `parent_engaged_quoted` on parent.
- **State update:** none.
- **What the user sees:** the parent node shows a faint "quoted" tick; the timeline thread between current and parent gets a slightly heavier weight.

#### R-PC-02 — Off-parent new issue introduced

- **Triggering pattern:** `responds_to_parent=0` AND `introduces_new_issue=1`.
- **Target node:** current move.
- **Mutation:** `new_issue_introduced` on current; `branch_suggested` on parent (the parent has lost continuity; UI may invite a branch-routing prompt).
- **State update:** none (the layer does not auto-route to a branch — it surfaces the structural fact).
- **What the user sees:** a "new issue" pip on current; a soft "consider a branch" suggestion on the parent edge.

#### R-PC-03 — Clarification requested

- **Triggering pattern:** `requests_clarification=1`.
- **Target node:** parent move.
- **Mutation:** `clarification_requested` on parent.
- **State update:** insert `ClarificationDebtState { openingMoveId: current, targetMoveId: parent, status: 'open' }`.
- **What the user sees:** the parent node shows a "?" chip.

#### R-PC-04 — Clarification answered

- **Triggering pattern:** `answers_clarification=1`.
- **Target node:** the *clarification-requesting move* — walk up the chain to find the most-recent open clarification debt whose `targetMoveId` is an ancestor of the current move.
- **Mutation:** `clarification_resolved` on the clarification-requesting move; `clarification_answered` on current.
- **State update:** mark the matched `ClarificationDebtState` as `resolved` with `resolvingMoveId: current`.
- **What the user sees:** the "?" chip flips to a resolved state on the asking node; current gets a brief "answered" tick.

### 4.2 Evidence and source-chain rules

#### R-EV-01 — Evidence requested (debt opened)

- **Triggering pattern:** `asks_for_evidence=1`.
- **Target node:** parent move.
- **Mutation:** `evidence_debt_opened` on parent (`sourceClassifier: 'asks_for_evidence'`, `sourceMoveId: current`).
- **State update:** insert `EvidenceDebtState { openingMoveId: current, targetMoveId: parent, openingAuthorId, status: 'open' }`.
- **What the user sees:** a debt-chip appears on the parent node ("evidence requested"). The room status line surfaces the debt.

#### R-EV-02 — Evidence supplied (debt resolved)

- **Triggering pattern:** `provides_evidence=1` AND `evidence_supports_claim=1`.
- **Target node:** the *debt-opening move's target* — find the most-recent open `EvidenceDebtState` whose `targetMoveId` is the current move's parent or an ancestor of the current move. If found, target that debt's `targetMoveId`.
- **Mutation:** `evidence_debt_resolved` on the debt's target node; `evidence_attached_supporting` on current.
- **State update:** mark the matched `EvidenceDebtState` as `resolved` with `resolvingMoveId: current`. If the resolved debt was opened against a source-chain gap, also mark the matching `SourceChainGapState` as `filled` (see R-EV-07).
- **What the user sees:** the debt-chip on the upstream node flips to resolved; current shows an "evidence attached, supporting" tick.

#### R-EV-03 — Evidence attached but unverified

- **Triggering pattern:** `provides_evidence=1` AND `evidence_supports_claim=0`.
- **Target node:** current move.
- **Mutation:** `evidence_attached_unverified` on current.
- **State update:** none. The matching `EvidenceDebtState` (if any) stays `open` — the attachment did not close the debt.
- **What the user sees:** current shows an "evidence attached" pill in a muted state, signaling the attachment exists but did not yet resolve the debt.

#### R-EV-04 — Popularity used as evidence (amplification warning)

- **Triggering pattern:** `uses_popularity_as_evidence=1`.
- **Target node:** current move.
- **Mutation:** `popularity_amplification_warning` on current.
- **State update:** none (the warning is per-move; doctrine forbids attaching a verdict to the ancestor).
- **What the user sees:** current shows an anti-amplification chip ("popularity is not evidence").

#### R-EV-05 — Satire used as evidence

- **Triggering pattern:** `uses_satire_as_evidence=1`.
- **Target node:** current move.
- **Mutation:** `satire_as_evidence_warning` on current.
- **State update:** none.
- **What the user sees:** current shows a "satire cited as evidence" chip.

#### R-EV-06 — Retraction cited

- **Triggering pattern:** `cites_retraction=1`.
- **Target node:** current move.
- **Mutation:** `retraction_cited` on current. If the citation can be linked to an upstream evidence claim — walk up the chain to find the most-recent move with `provides_evidence=1` — also emit `evidence_retracted` on that ancestor.
- **State update:** if a matching `EvidenceDebtState` is still `open` against that ancestor, mark it `resolved` (the retraction settles the debt by withdrawing the underlying claim).
- **What the user sees:** the cited-retraction chip on current; if linked, a "retracted" marker on the upstream evidence node.

#### R-EV-07 — Source-chain gap flagged

- **Triggering pattern:** `creates_source_chain_gap=1`.
- **Target node:** current move.
- **Mutation:** `source_chain_gap_flagged` on current.
- **State update:** insert `SourceChainGapState { openingMoveId: current, status: 'open' }`.
- **What the user sees:** current shows a gap-indicator pill ("missing source link").

### 4.3 Constructive movement rules

#### R-CM-01 — Claim narrowed

- **Triggering pattern:** `narrows_claim=1`.
- **Target node:** the *broader-scoped ancestor* — walk up the chain from `parentId`. The broader ancestor is the most-recent move authored by the same author whose body asserted the wider scope. If no such ancestor can be cleanly identified, target the immediate parent.
- **Mutation:** `point_narrowed` on the broader ancestor; `narrowing_landed` on current.
- **State update:** insert `NarrowingLinkState { narrowingMoveId: current, broaderAncestorMoveId, atMoveId: current }`.
- **What the user sees:** the broader-ancestor node shows a "scope narrowed downstream" indicator; current shows a "narrowing" pill.

#### R-CM-02 — Point conceded

- **Triggering pattern:** `concedes_narrow_point=1`.
- **Target node:** the *originating challenge move* — walk up the chain to find the most-recent move authored by a DIFFERENT author whose `disagreementAxis` matches the current move's `disagreementAxis`. If no axis match, target the immediate parent.
- **Mutation:** `point_conceded` on the originating challenge; `concession_landed` on current.
- **State update:** insert `ConcessionLinkState { concedingMoveId: current, conceededOnAxis, originatingChallengeMoveId, atMoveId: current }`. If the conceded point was the active sub-axis, mark the matching `SubAxisState` as `resolved`.
- **What the user sees:** the originating-challenge node shows a "point conceded" marker; current shows a "conceded" pill.

#### R-CM-03 — Synthesis ready

- **Triggering pattern:** `ready_for_synthesis=1`.
- **Target node:** the *sub-thread root* — walk up the chain to find the move that opened the active sub-axis (the most-recent `SubAxisState` with `status: 'open'` whose `openingMoveId` is an ancestor of current). If no open sub-axis is found, target the room root.
- **Mutation:** `synthesis_ready` on the sub-thread root; `synthesis_offered` on current.
- **State update:** update `SynthesisReadinessState { ready: true, subThreadRootMoveId, openDebtCount, sharedGroundMoveCount }`.
- **What the user sees:** the sub-thread root shows a "ready for synthesis" indicator; the room may offer a synthesis affordance.

#### R-CM-04 — Pre-send pause advised

- **Triggering pattern:** `needs_pre_send_pause=1`.
- **Target node:** current move.
- **Mutation:** `pre_send_pause_advised` on current.
- **State update:** none.
- **What the user sees:** current shows a soft "tightenable" indicator (advisory; never blocks the move).

### 4.4 Debate-mode fit rules

#### R-DM-01 — Mode mismatch

- **Triggering pattern:** `fits_selected_debate_mode=0`.
- **Target node:** current move.
- **Mutation:** `mode_mismatch_warning` on current.
- **State update:** none.
- **What the user sees:** current shows a "register mismatch" indicator (the room is in a sober mode but the move is flippant, or vice versa).

#### R-DM-02 — Playable hot take

- **Triggering pattern:** `contains_playable_hot_take=1`.
- **Target node:** current move.
- **Mutation:** `playable_hot_take` on current.
- **State update:** none.
- **What the user sees:** current shows a "hot take" marker — a structural shape, not a quality judgment.

#### R-DM-03 — Satire/parody marker

- **Triggering pattern:** `is_satire_or_parody=1`.
- **Target node:** current move.
- **Mutation:** `satire_marker` on current.
- **State update:** none.
- **What the user sees:** current shows a "satire" marker (the move is rendered as a joke, not a literal claim).

### 4.5 Branch routing and friction rules

#### R-BR-01 — Side branch suggested

- **Triggering pattern:** `suggests_side_branch=1`.
- **Target node:** current move; edge to parent.
- **Mutation:** `side_branch_suggested` on current; `branch_route_hint` on the parent edge.
- **State update:** none.
- **What the user sees:** current shows a "side branch" hint; the edge gains a subtle directional cue.

#### R-BR-02 — Diagonal tangent suggested

- **Triggering pattern:** `suggests_diagonal_tangent=1`.
- **Target node:** current move; edge to parent.
- **Mutation:** `diagonal_tangent_suggested` on current; `tangent_route_hint` on the parent edge.
- **State update:** if an open sub-axis exists in the chain above current, mark it `abandoned` (a tangent navigates away from the active sub-dispute).
- **What the user sees:** current shows a "diagonal tangent" hint; the open sub-axis indicator dims.

#### R-BR-03 — Person shift warning

- **Triggering pattern:** `shifts_to_person_or_intent=1`.
- **Target node:** current move.
- **Mutation:** `person_shift_warning` on current.
- **State update:** add current's `moveId` to `personShiftMoves` set.
- **What the user sees:** current shows a "redirected to person" indicator.

#### R-BR-04 — Unplayable move

- **Triggering pattern:** `contains_unplayable_insult_only=1`.
- **Target node:** current move.
- **Mutation:** `unplayable_move` on current.
- **State update:** add current's `moveId` to `unplayableMoves` set.
- **What the user sees:** current is rendered as unengageable — no reply / disagree / score affordances; only "ignore" or "request moderation."

### 4.6 Exemption "rules"

Two patterns produce NO mutations and consume no classifier output. They are documented here so the implementer can pattern-match on them:

#### R-EX-01 — Root proclamation

- **Triggering pattern:** `parentId === null` (regardless of packet).
- **Target node:** current move.
- **Mutation:** `opening_claim_marker` on current. No cross-node mutations.
- **State update:** none.
- **What the user sees:** the root node renders with an opening-claim hat.

#### R-EX-02 — First move by this author

- **Triggering pattern:** the author's move-position helper returns `'first'` (regardless of packet).
- **Target node:** current move.
- **Mutation:** none from the composition layer. Layer-1 deterministic surface (from structural metadata: `evidenceAttached[]`, `concessions[]`, `refutations[]`) renders directly.
- **State update:** none.
- **What the user sees:** the first-move bubble; metadata-only rendering.

### 4.7 Rule coverage matrix

Of the 22 active composition rules, 9 emit at least one CROSS-NODE mutation (the design's primary value): R-PC-01, R-PC-02, R-PC-03, R-PC-04, R-EV-01, R-EV-02, R-EV-06, R-CM-01, R-CM-02, R-CM-03. The remaining 13 emit only per-move (current-node) mutations. This satisfies the design's stop condition ("at least 8 distinct composition rules expressible with the current 23 ids" — we have 22).

After MCP-CAT-001 lands, the proposed new ids (`opens_evidence_debt_marker`, `closes_evidence_debt_marker`, `disputes_evidence_applicability`, `introduces_sub_axis`, `concedes_with_new_dispute`, `supplies_corroborating_document`, `references_prior_agreement`, `provides_temporal_constraint`, `accepts_partial_with_caveat`, `provides_alternate_interpretation`, `disputes_specific_amount`, `cites_temporal_boundary`) tighten R-EV-01 / R-EV-02 / R-CM-01 / R-CM-02 and add four new rules covering applicability disputes, sub-axis introduction, qualified concessions, and amount-specific challenges. The worked-examples document marks these as `[PROPOSED — MCP-CAT-001]` and shows what the layer does today vs. after.

---

## §5 — `NodeVisualMutation` enum

Every visual state mutation the composition layer can produce. The UI rendering layer downstream maps each value to its visual treatment.

```ts
export type NodeVisualMutationType =
  // ── Evidence / source-chain (cross-node) ─────────────────────
  | 'evidence_debt_opened'
  | 'evidence_debt_resolved'
  | 'evidence_attached_supporting'
  | 'evidence_attached_unverified'
  | 'evidence_retracted'
  | 'source_chain_gap_flagged'
  | 'source_chain_gap_filled'
  // ── Constructive movement (cross-node) ────────────────────────
  | 'point_conceded'
  | 'concession_landed'
  | 'point_narrowed'
  | 'narrowing_landed'
  | 'sub_axis_opened'
  | 'sub_axis_resolved'
  | 'sub_axis_abandoned'
  | 'synthesis_ready'
  | 'synthesis_offered'
  // ── Parent continuity (cross-node) ────────────────────────────
  | 'parent_engaged_quoted'
  | 'new_issue_introduced'
  | 'clarification_requested'
  | 'clarification_resolved'
  | 'clarification_answered'
  // ── Friction / safety (per-move) ──────────────────────────────
  | 'popularity_amplification_warning'
  | 'satire_as_evidence_warning'
  | 'satire_marker'
  | 'retraction_cited'
  | 'person_shift_warning'
  | 'unplayable_move'
  | 'mode_mismatch_warning'
  | 'pre_send_pause_advised'
  | 'playable_hot_take'
  // ── Branch routing (per-move + edge) ──────────────────────────
  | 'side_branch_suggested'
  | 'diagonal_tangent_suggested'
  | 'branch_route_hint'        // on edge
  | 'tangent_route_hint'       // on edge
  | 'branch_suggested'         // emitted on parent in R-PC-02
  // ── Exemption markers (per-move) ──────────────────────────────
  | 'opening_claim_marker';
```

### 5.1 `NodeVisualMutation` shape

```ts
export interface NodeVisualMutation {
  /** The node this mutation targets. */
  readonly targetMoveId: string;
  /** The structural state this mutation expresses. */
  readonly mutation: NodeVisualMutationType;
  /** Which classifier triggered this rule (for trace / debug). */
  readonly sourceClassifier: SemanticClassifierId | 'exemption' | 'derived';
  /** Which move's composition call produced this mutation. */
  readonly sourceMoveId: string;
  /** Optional: when the mutation logically attaches to an edge, this is the
   * edge's other endpoint. */
  readonly edgeOtherEndpointMoveId?: string;
}
```

### 5.2 Doctrine scan

Every value in `NodeVisualMutationType` describes a *structural* state. None contains a verdict token (`winner`, `loser`, `truth`, `correct`, `wrong`, `right`, `false`, `proven`, `defeated`, `won`, `lost`). None contains a person-label token (`liar`, `dishonest`, `bad faith`, `manipulative`, `extremist`, `propagandist`). The acceptance criteria require this property to be asserted by a unit test.

---

## §6 — Integration with existing code

### 6.1 Where the function is called

Inside `useSemanticReferee` (`src/features/arguments/useSemanticReferee.ts`), AFTER `classifyMove` returns a packet and BEFORE `selectBanner` runs. The new call slot is in the post-classify branch of `onMovePosted`:

```text
classifyMove → returns SemanticRefereePacket
  ↓
composeVisualState({ packet, state: compositionStateRef.current, metadata })
  ↓ returns { mutations, nextState, currentMoveVisualState }
compositionStateRef.current = nextState
  ↓
selectBanner(packet) → returns BannerSelectionResult   // unchanged
  ↓
emit { banner, mutations } to the room's render layer
```

The banner system stays per-move; the composition system adds the cross-node layer. They are complementary.

### 6.2 How `CompositionState` is accumulated

The hook maintains a `useRef<CompositionState>` initialized to `EMPTY_COMPOSITION_STATE`. Two paths populate it:

- **Live path:** each `onMovePosted` call updates the ref with the `nextState` returned by `composeVisualState`.
- **Replay path:** when the room loads, the hook walks all prior packets (already cached in `clientCacheRef`) in chronological order and calls `composeVisualState` for each, rebuilding the state from scratch. This is a pure-function loop; no AI calls, no network. The state never persists — it is reconstructed on every room mount.

The replay loop is O(N) in the number of prior classified moves per room. For a 100-move room (the practical ceiling for v1), the loop is sub-millisecond. Memoization is not needed.

### 6.3 How `NodeVisualMutation` objects reach the timeline

The hook's public surface gains one new method:

```ts
export interface UseSemanticRefereeResult {
  // ... existing fields ...

  /** The cross-node visual mutations targeting a specific move. Returns the
   * union of mutations emitted across all prior composition calls in this
   * room session, keyed by targetMoveId. */
  readonly getMutationsForMove: (moveId: string) => readonly NodeVisualMutation[];

  /** The current room-scoped composition state (for tests + debugging). */
  readonly getCompositionState: () => CompositionState;
}
```

The room's render layer (`ArgumentGameSurface.tsx` and friends) reads `getMutationsForMove(moveId)` for each rendered node and translates the mutation enum values to visual elements using the existing `gameCopy.toPlainLanguage` pattern. The cross-node mutations sit alongside the per-move banner — both render on the same node when both fire.

The `argumentGameSurfaceModel.ts` `ArgumentSurfaceState` gains one new field:

```ts
export interface ArgumentSurfaceState {
  // ... existing fields ...

  /** Cross-node mutations keyed by targetMoveId. Optional — absent when no
   * composition has run for the room (e.g., observer / read-only mode). */
  readonly crossNodeMutations?: ReadonlyMap<string, readonly NodeVisualMutation[]>;
}
```

The model exposes a single helper `getCrossNodeMutations(state, moveId)` that returns the array (or empty). The bubble-rendering code in `buildArgumentBubbleViewModels` looks up mutations for each rendered move via this helper.

### 6.4 How the existing MCP-014 banner layer interacts

The banner layer is unchanged. `selectBanner(packet)` continues to return one banner per move based on the per-move binary signals. The composition layer adds cross-node markers in addition to the banner; it does not replace the banner.

Banner enrichment is allowed but optional. If a future card wants the banner copy to incorporate cross-node context ("Evidence requested — source chain gap on [parent]"), it can read the composition state alongside the packet and produce an enriched copy string. That enrichment lives in the banner library or in `gameCopy.toPlainLanguage` — not in the composition function.

### 6.5 How the smoke-test orchestrator consumes the layer

`scripts/bot-fixtures/runMcpSmokeTest.js` runs both fixtures through the classifier. After classification of each move, it can call `composeVisualState` (imported as a pure function — no React, no hook) and assert that the resulting mutations match the fixture's `expectedDeterministicComposition` block. This is the smoke-test verification path: it gives operators a deterministic check that the composition layer produces the same output the design predicted.

---

## §7 — Test plan

### 7.1 Snapshot tests per rule

For each of the 22 composition rules (plus the 2 exemption patterns), a snapshot test with a fixed input — a synthesized signal vector + a synthesized `CompositionState` + synthesized move metadata — produces a fixed output (mutations + updated state). These are the regression baseline. A change to a rule changes the snapshot; the diff is reviewable.

24 snapshot tests minimum. Located at `__tests__/compositionLayerRules.test.ts`.

### 7.2 Scenario replay tests

#### 7.2.1 Band-space-rent (8 moves)

`__tests__/compositionLayerBandSpaceRent.test.ts`. Replays the 8 moves from `fixtures/argument-scenarios/catalog-design-band-space-rent-evidence.json` in order, accumulating `CompositionState`. After each move, asserts:

- The set of mutations emitted matches the fixture's `expectedDeterministicComposition` block.
- The `CompositionState` snapshot matches an inline expected shape.
- The visual state of every node — derived from the accumulated mutations — matches the fixture's `expectedUIState`.

The test runs in TWO MODES: (a) 23-id mode (the current catalog; some `[PROPOSED]` signals are missing from packets and the rules degrade gracefully); (b) 35-id mode (all signals available; the rules fire as designed). Mode (a) is the regression baseline COMP-001 ships against; mode (b) verifies the design forward-compatibility into MCP-CAT-001 territory.

#### 7.2.2 Remote-work-productivity (8 moves)

`__tests__/compositionLayerRemoteWorkProductivity.test.ts`. Replays the 8 moves from `fixtures/argument-scenarios/smoke-test-mcp-remote-work-productivity.json`. This scenario exercises the parent-continuity and evidence-challenge families that band-space-rent does not cover heavily — `introduces_new_issue`, `requests_clarification`, `creates_source_chain_gap`, `uses_popularity_as_evidence`, `suggests_side_branch`. After each move, asserts the same three properties (mutations, state, visual state).

This scenario uses only current-23-id classifiers; no `[PROPOSED]` markers. It is the cleanest regression test for COMP-001 at ship time.

### 7.3 Edge-case tests

`__tests__/compositionLayerEdgeCases.test.ts`. Covers:

- Empty signal vector (all 0s): zero mutations, no state change.
- All-1s signal vector: every rule fires; mutations accumulate sanely (no duplicate-target collisions); the resulting state is consistent.
- Root move (`parentId === null`): R-EX-01 fires; no cross-node mutations.
- Chime-in's first move (move-position `'first'`): R-EX-02 fires; no mutations from the layer; the layer-1 metadata path is the only render source.
- Move whose parent has been soft-deleted (`is_deleted=true`): the layer treats the deletion as "parent invisible." Mutations targeting the deleted parent are emitted but rendering MAY suppress them at the layer-1 level (rendering policy, not composition policy).
- Move with no packet (classification disabled or fallback): the layer is not called; state unchanged.
- Multiple open evidence debts in a chain: R-EV-02 resolves the MOST-RECENT matching debt. Older debts stay open until separately resolved.
- A retraction citation against a move with no preceding evidence: R-EV-06 emits `retraction_cited` on current but no `evidence_retracted` ancestor mutation.

### 7.4 Doctrine assertion tests

`__tests__/compositionLayerDoctrineScan.test.ts`. Two assertions:

- For every value in `NodeVisualMutationType`, the string contains no token from the verdict ban-list (`winner`, `loser`, `truth`, `correct`, `wrong`, `right`, `false`, `proven`, `defeated`, `won`, `lost`) and no token from the person-label ban-list (`liar`, `dishonest`, `bad faith`, `manipulative`, `extremist`, `propagandist`).
- For every composition rule's emitted mutation, the same scan passes (i.e., the rules themselves only produce safe enum values).

### 7.5 Purity / safety tests

`__tests__/compositionLayerPurity.test.ts`. Asserts:

- The composition module file does not import `fetch`, `axios`, `supabase-js`, or any Edge Function client.
- The composition module file does not import from `'react'`, `'expo'`, or any React-Native package.
- The composition module file does not import any Anthropic / xAI SDK.
- Calling `composeVisualState` twice with deep-frozen inputs returns identical outputs (purity check).
- Calling `composeVisualState` does not mutate its input state object (immutability check; the returned `nextState` is a fresh object).

### 7.6 Total new test count

24 (rule snapshots) + 8 + 8 (scenario replays, ×2 modes for band-space-rent) + 9 (edge cases) + 2 (doctrine) + 5 (purity) = approximately 56 new tests across 5 new test files. The implementation card's acceptance check requires the count to not decrease.

---

## §8 — Dependency chain

```
                            MCP-MOD-004 (#233)
                                    │
                                    │ HARD — COMP-001 imports the catalog
                                    │ constant for classifier id references
                                    ▼
                            COMP-001 (this card)
                                    │
                                    │ unblocks
                                    ├──→ BR-001 (point-lifecycle states)
                                    ├──→ VG-002 (gradient wave rail)
                                    ├──→ QOL-036 (evidence-object UI)
                                    └──→ QOL-037 (evidence applicability)

  MCP-CAT-001 (#238) ◄────── SOFT — when MCP-CAT-001 lands with the 12 new
                              ids, COMP-001 gains 4 new rules and tightens
                              R-EV-01/R-EV-02/R-CM-01/R-CM-02. Until then,
                              COMP-001 ships with rules for the current 23
                              ids and degrades gracefully when [PROPOSED]
                              signals are absent.
```

### 8.1 What COMP-001 does not depend on

- **MCP-MOD-005, MCP-MOD-006:** the prompt-template and banner/ledger refactors do not change the catalog content; they only restructure how it is read. COMP-001 reads the catalog through MCP-MOD-004's constant regardless.
- **MCP-MOD-007, MCP-MOD-008:** the move-position helper and the full-thread context refactor make the *classifier's* signals more accurate. COMP-001 consumes the packet regardless of how it was produced; better classifier signals make better mutations, but COMP-001's contract with the classifier is the packet shape, which doesn't change.

### 8.2 When COMP-001 should ship

After MCP-MOD-004 merges. COMP-001 can ship before, in parallel with, or after MCP-CAT-001 — the layer is forward-compatible with new classifier ids (rules that reference unknown ids simply never fire, and the layer treats absent signals as `0`).

---

## §9 — What COMP-001 does NOT do

- **Does NOT render anything.** The UI cards downstream do the rendering. COMP-001 produces enum values; the consumer translates them.
- **Does NOT call the AI.** The classifier (upstream) does that. COMP-001 reads packets; it does not make them.
- **Does NOT persist `CompositionState` to the database.** The state is ephemeral, rebuilt from packets on room load. Persistence is a future optimization; the v1 layer does not need it.
- **Does NOT modify the classifier catalog, the seed prompt, or the banner library.** It READS the catalog (via MCP-MOD-004's constant) for id references only. The other systems are untouched.
- **Does NOT produce user-facing copy.** `gameCopy.toPlainLanguage` (or its successor) maps mutation enum values to strings in the UI layer. The composition function never emits human-readable text.
- **Does NOT decide eligibility for classification.** That is `triggerGates.ts` (MCP-MOD-008's territory). COMP-001 is downstream of eligibility — it runs only when classification fires and a packet exists.
- **Does NOT call out via fetch, axios, or any client.** Purity is enforced by a unit test.

---

## §10 — Acceptance criteria

The implementation card's reviewer uses this checklist.

- [ ] `composeVisualState` is a pure function with the signature documented in §1, exported from `src/features/composition/composeVisualState.ts`.
- [ ] `CompositionState`, `NodeVisualMutation`, `NodeVisualMutationType`, and the per-item lifecycle types are typed in `src/features/composition/types.ts`.
- [ ] `EMPTY_COMPOSITION_STATE` is exported and is the initial value the hook uses.
- [ ] Every composition rule documented in §4 (22 rules + 2 exemption patterns = 24 total) has a corresponding snapshot test in `__tests__/compositionLayerRules.test.ts`.
- [ ] `__tests__/compositionLayerBandSpaceRent.test.ts` exists and asserts mutations, state, and visual states match the fixture's `expectedDeterministicComposition` for all 8 moves in BOTH 23-id mode and 35-id mode (mode-b uses fixture signals as-given; mode-a strips `[PROPOSED]` signals from the packet).
- [ ] `__tests__/compositionLayerRemoteWorkProductivity.test.ts` exists and asserts mutations and state for all 8 moves.
- [ ] `__tests__/compositionLayerEdgeCases.test.ts` covers the 8 edge cases enumerated in §7.3.
- [ ] `__tests__/compositionLayerDoctrineScan.test.ts` asserts no verdict / person-label tokens appear in any `NodeVisualMutationType` value or any rule's emitted mutation.
- [ ] `__tests__/compositionLayerPurity.test.ts` asserts no forbidden imports, immutability, and determinism.
- [ ] `useSemanticReferee` is extended with `getMutationsForMove(moveId)` and `getCompositionState()` per §6.3; the existing public surface is unchanged.
- [ ] `argumentGameSurfaceModel.ts` gains the optional `crossNodeMutations` field and the `getCrossNodeMutations` helper.
- [ ] `scripts/bot-fixtures/runMcpSmokeTest.js` imports `composeVisualState` and surfaces the produced mutations in its per-move report. The smoke test's exit code is unchanged (composition is additive, not a gate).
- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run test` passes (new tests added, no existing tests regressed).
- [ ] `npm run skills:validate` passes if defined.
- [ ] Documentation: `docs/core/current-status.md` is updated; `docs/core/roadmap-semantic-referee-modularity.md` (or a sibling meta-roadmap if the composition layer's roadmap lives elsewhere) gains a reference to this card and the worked-examples document.

---

## §11 — Risks

- **R-1 (low):** The "walk up the chain" helper used by R-EV-02 / R-CM-01 / R-CM-02 / R-CM-03 has subtle edge cases (deleted ancestors, missing parentIds, very deep chains). Mitigation: a separate well-tested helper `findUpstreamMove(state, currentMoveId, matchFn)` with its own test suite. The helper takes a match predicate and returns the most-recent matching ancestor or `null`.
- **R-2 (low):** Rule conflicts when multiple rules fire on the same packet. Mitigation: rules are additive (the timeline renders the union of mutations). The enum values are designed so two mutations on the same `targetMoveId` are visually composable (e.g., `evidence_debt_opened` + `parent_engaged_quoted` on the same parent both render).
- **R-3 (medium):** Replay performance on very large rooms (>500 moves). Mitigation: O(N) replay is sub-millisecond at room sizes up to 100; if a future room grows past 500 moves the layer should add memoization, but the v1 design does not. The acceptance test runs replay on the 8-move fixtures; a future load test would target larger rooms.
- **R-4 (low):** `CompositionState` schema drift across versions. Mitigation: the state is in-memory only; on room mount it is rebuilt from scratch. There is no persistence, no migration concern. If a future card adds persistence, that card owns the migration.
- **R-5 (medium):** Doctrine drift. A future contributor may add a rule that produces a value containing a verdict token. Mitigation: `__tests__/compositionLayerDoctrineScan.test.ts` is the regression baseline. The CI suite fails if any mutation value contains a banned token.

---

## §12 — Not in scope (named so they don't accrete)

- A new classifier id. That is MCP-CAT-001 territory.
- A new banner code. That is MCP-MOD-006 territory.
- A new ledger feedback code. That is MCP-MOD-006 territory.
- A change to `SEMANTIC_REFEREE_PACKET_VERSION`. The packet shape is unchanged.
- A change to `triggerGates.ts` or any eligibility logic. That is MCP-MOD-008 territory.
- A migration. The state is ephemeral.
- An Edge Function change. The composition runs on the client and in the smoke-test orchestrator; no Edge Function calls it.
- A UI implementation. The bubble / chip / pill rendering is BR-001 / VG-002 / QOL-036 / QOL-037 territory.
- A copy string. The enum values are structural; `gameCopy.toPlainLanguage` produces the user-facing strings.
- A scoring delta. The point-standing economy (`src/features/pointStanding/`) reads the packet directly today; whether it should consume composition state instead is a future card's question, not COMP-001's.

---

## §13 — Open questions for the implementer

These do not block the design from landing; the implementer's reviewer resolves them in the build phase.

1. **Should `CompositionState` be a class or a plain object?** The design uses readonly types + a pure function, which strongly suggests a plain object. An immutable.js Map-style class would also work but adds a dependency. Recommendation: plain object with `ReadonlyMap` / `ReadonlySet` typed properties; the implementer constructs a new state object on each call.
2. **Should the `findUpstreamMove` helper be exported?** It is used internally by R-EV-02 / R-CM-01 / R-CM-02 / R-CM-03. Exporting it lets the smoke-test orchestrator reuse it; not exporting it keeps the module API tight. Recommendation: export it under a `composition/upstreamSearch.ts` sub-module so tests and the orchestrator can import it without coupling to the rule list.
3. **When multiple rules fire on a single packet, in what order do they execute?** Order does not matter for the *mutations* (they accumulate as a set), but order MAY matter for *state updates* (e.g., R-EV-02 closes a debt; R-EV-06 may simultaneously retract a related evidence claim and abandon a different debt). Recommendation: rules execute in the order they appear in §4 (parent-continuity → evidence → constructive movement → debate-mode → branch-routing). The reviewer asserts this via a test.
4. **How does the layer handle a move that is `is_deleted=true` in the database but still present in the cache?** The layer's input is the packet — if the packet exists, the layer composes against it. Suppression at the render layer is a layer-1 concern. Recommendation: keep the composition layer indifferent to deletion state; let the consumer handle rendering policy.

---

## §14 — Status

This is a design document. No production code changes accompany it. The implementation card (a follow-up COMP-001-BUILD or simply COMP-001 once design is approved) will land after MCP-MOD-004 (#233) merges, so the catalog constant is available for `composeVisualState` to import classifier ids from.

The companion document [`COMP-001-worked-examples.md`](./COMP-001-worked-examples.md) walks the two scenarios move-by-move so the implementer has a concrete reference for what the rules should produce.
