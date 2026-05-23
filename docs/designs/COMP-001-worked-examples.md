# COMP-001 — Worked examples

**Parent:** [`COMP-001.md`](./COMP-001.md).
**Purpose:** Move-by-move walkthrough of the composition layer for two scenarios. For each move: the binary signal vector, the `CompositionState` before, the rules that match, the `NodeVisualMutation` objects produced, the `CompositionState` after, and a plain-language description of what the timeline would show.

Each scenario is presented twice when relevant:

- **23-id mode (today, what COMP-001 ships against):** the layer reads only the current-catalog signals; `[PROPOSED]` signals are absent (treated as `0`). Some downstream nuance is lost; the layer still produces sensible output.
- **35-id mode (after MCP-CAT-001 lands):** the layer reads all signals; rules tighten. Marked `[PROPOSED — MCP-CAT-001]` per signal.

---

## Scenario 1 — Band space rent (8 moves)

**Fixture:** `fixtures/argument-scenarios/catalog-design-band-space-rent-evidence.json`.
**Storyline:** Bandmate A claims B did not pay March share of practice-room rent. B presents payment evidence; A disputes its applicability; B narrows; A asks for source; B supplies; A concedes and opens a sub-axis on amount; B closes the sub-axis with primary-source evidence.

### m1 — A's root proclamation

- **Eligibility:** root (no parent) — R-EX-01 applies; no classifier call fires.
- **Signal vector:** —
- **State before:** `EMPTY_COMPOSITION_STATE`.
- **Matching rules:** R-EX-01 only.
- **Mutations produced:**
  - `{ targetMoveId: m1, mutation: opening_claim_marker, sourceClassifier: 'exemption', sourceMoveId: m1 }`
- **State after:** unchanged.
- **Timeline view:** root node with an opening-claim hat; no cross-node markers.

### m2 — B's evidence-backed rebuttal with concessions

- **Eligibility:** B's first move in the room — R-EX-02 applies; no classifier call fires.
- **Signal vector:** —
- **State before:** unchanged from m1.
- **Matching rules:** R-EX-02 only (no composition-layer mutations; layer-1 metadata renders the evidence pill and the two-item concession list from the structural fields).
- **Mutations produced:** none from the composition layer.
- **State after:** unchanged.
- **Timeline view:** m2 bubble shows an `ev1` evidence pill and two concession marks (concessions to "I did owe a March share" and "The amount was $120"). These render from layer-1 metadata (`evidenceAttached=[ev1]`, `concessions.length=2`), not from a composition rule.

### m3 — A's evidence applicability challenge

#### 23-id mode

- **Signal vector available:** `responds_to_parent=1`, `quote_anchors_parent=1`, `asks_for_evidence=0`, `provides_evidence=0`. The proposed `disputes_evidence_applicability=1`, `references_prior_agreement=1`, `provides_temporal_constraint=1` signals are absent.
- **State before:** empty state from m2.
- **Matching rules:** R-PC-01.
- **Mutations produced:**
  - `{ targetMoveId: m2, mutation: parent_engaged_quoted, sourceClassifier: 'quote_anchors_parent', sourceMoveId: m3 }`
- **State after:** unchanged.
- **Timeline view:** the m2 parent node gets a quoted-engagement tick. The applicability-dispute structural state is NOT yet expressible — the timeline does not yet flip ev1's pill to "disputed" because no classifier signaled that distinction.
- **Honest limitation in 23-id mode:** the fixture's `expectedDeterministicComposition` for m3 names `applicability_dispute_with_prior_agreement_and_temporal_anchor` as the composition rule applied. That rule REQUIRES the 3 proposed signals. In 23-id mode, COMP-001 cannot fire this rule; the layer-1 evidence panel may surface the dispute via the move's `selectedTagCodes` (`evidence_applicability_dispute`) instead. This is a graceful degradation, not a failure.

#### 35-id mode

- **Signal vector available:** all of the above PLUS `disputes_evidence_applicability=1` [PROPOSED — MCP-CAT-001], `references_prior_agreement=1` [PROPOSED — MCP-CAT-001], `provides_temporal_constraint=1` [PROPOSED — MCP-CAT-001].
- **Matching rules:** R-PC-01 (existing) PLUS a new composition rule that COMP-CAT-001's slate would add (call it `R-EV-APP-01: applicability_dispute_with_prior_agreement_and_temporal_anchor`).
- **Mutations produced:**
  - `parent_engaged_quoted` on m2 (from R-PC-01)
  - `evidence_applicability_disputed` on m2 (new mutation type added with the rule; targets the evidence-attaching parent)
  - `prior_agreement_cited` on m3 (per-move)
  - `temporal_constraint_provided` on m3 (per-move)
- **State after:** evidence-applicability ledger gains an `applicability_disputed` entry against `ev1` (this ledger is a sub-state of `CompositionState` added by the proposed rules).
- **Timeline view:** the ev1 pill on m2 flips to "applicability disputed"; m3 shows two contextual chips ("prior agreement cited", "temporal anchor").

### m4 — B's agree with caveat

#### 23-id mode

- **Signal vector available:** `responds_to_parent=1`, `quote_anchors_parent=1`, `concedes_narrow_point=1`. Proposed `accepts_partial_with_caveat=1`, `provides_alternate_interpretation=1` absent.
- **State before:** empty (in 23-id mode m3 produced no state change).
- **Matching rules:** R-PC-01, R-CM-02.
- **Mutations produced:**
  - `parent_engaged_quoted` on m3 (from R-PC-01)
  - `point_conceded` on m3 (target: the originating challenge; in this chain m3 is A's challenge, m4 is B's concession — R-CM-02's helper walks up to find m3 since the `disagreementAxis` matches `applicability_of_evidence`)
  - `concession_landed` on m4
- **State after:** `concessionChains` gains an entry: `{ concedingMoveId: m4, conceededOnAxis: 'applicability_of_evidence', originatingChallengeMoveId: m3, atMoveId: m4 }`.
- **Timeline view:** m3 shows a "point conceded" marker; m4 shows a "conceded" pill. The caveat / alternate-interpretation nuance is NOT yet visible (no signal supports it in 23-id mode).

#### 35-id mode

- **Additional signals:** `accepts_partial_with_caveat=1`, `provides_alternate_interpretation=1`.
- **Additional mutations:**
  - `qualified_concession_with_caveat` on m4 (new per-move marker)
  - `alternate_interpretation_offered` on m4 (per-move)
- **Additional state:** the `concessionChains` entry gains a `caveatedFlag: true` and an `alternateInterpretationOffered: true`.
- **Timeline view:** m4 shows the conceded pill plus a "caveat / alternate reading" chip.

### m5 — A's ask for source

#### 23-id mode

- **Signal vector available:** `responds_to_parent=1`, `quote_anchors_parent=1`, `asks_for_evidence=1`, `requests_clarification=0`. Proposed `opens_evidence_debt_marker=1` absent.
- **State before:** (in 23-id mode) `concessionChains` populated from m4.
- **Matching rules:** R-PC-01, R-EV-01.
- **Mutations produced:**
  - `parent_engaged_quoted` on m4
  - `evidence_debt_opened` on m4 (sourceClassifier: `asks_for_evidence`, sourceMoveId: m5)
- **State after:** `evidenceDebts` gains an entry: `{ openingMoveId: m5, targetMoveId: m4, openingAuthorId: A, status: 'open' }`.
- **Timeline view:** m4 shows an "evidence requested" chip; room status line ("Evidence requested") may surface via the consumer reading `compositionState.evidenceDebts.size > 0`.
- **Note:** R-EV-01 fires whether or not `opens_evidence_debt_marker` is available. The proposed signal would tighten the rule (R-EV-01 could require both `asks_for_evidence=1` AND `opens_evidence_debt_marker=1` to distinguish a structured "Ask for source" tap from a rhetorical ask), but the 23-id rule fires on `asks_for_evidence=1` alone.

#### 35-id mode

- **Additional signal:** `opens_evidence_debt_marker=1` [PROPOSED — MCP-CAT-001].
- **Tightened rule:** R-EV-01 becomes `asks_for_evidence=1 AND opens_evidence_debt_marker=1` → `evidence_debt_opened` (distinguishes structured taps from rhetorical asks; a future rhetorical-ask might fire `asks_for_evidence=1, opens_evidence_debt_marker=0` and produce a different mutation like `informal_source_question`).
- **Mutations produced:** same as 23-id mode (the rule's output is identical; only its precondition is tighter).
- **State after:** same as 23-id mode.

### m6 — B's group-chat evidence supply

#### 23-id mode

- **Signal vector available:** `responds_to_parent=1`, `provides_evidence=1`, `evidence_supports_claim=1`, `creates_source_chain_gap=0`. Proposed `closes_evidence_debt_marker=1`, `supplies_corroborating_document=1` absent.
- **State before:** `evidenceDebts` has the open debt from m5 (target: m4).
- **Matching rules:** R-PC-01 (no — `quote_anchors_parent=0` was not asserted in the signal vector, so R-PC-01 does not fire here — only `responds_to_parent=1`; check §4.1 rule R-PC-01 carefully: it requires BOTH `responds_to_parent=1` AND `quote_anchors_parent=1`. Here only `responds_to_parent=1` is asserted; the vector does not include `quote_anchors_parent`, which the layer treats as `0`. So R-PC-01 does NOT fire). R-EV-02 fires.
- **Mutations produced:**
  - `evidence_debt_resolved` on m4 (the debt's target; R-EV-02's helper walks the state for the most-recent open debt whose target is `currentMove.parent` or an ancestor — m5 is current's parent, m5's parent is m4, and m4 has the open debt. The helper finds it.)
  - `evidence_attached_supporting` on m6
- **State after:** the `EvidenceDebtState` keyed by m5 flips to `status: 'resolved', resolvingMoveId: m6`.
- **Timeline view:** the "evidence requested" chip on m4 flips to "resolved"; m6 shows an "evidence attached, supporting" pill.

#### 35-id mode

- **Additional signals:** `closes_evidence_debt_marker=1`, `supplies_corroborating_document=1`.
- **Tightened rule:** R-EV-02 becomes `provides_evidence=1 AND evidence_supports_claim=1 AND closes_evidence_debt_marker=1` → `evidence_debt_resolved`. The `supplies_corroborating_document` signal adds a `corroborating_document_attached` per-move marker.
- **Mutations produced:** same as 23-id mode PLUS `corroborating_document_attached` on m6 and `evidence_applicability_supported` on m2 (the original evidence that's now corroborated).
- **State after:** the proposed evidence-applicability ledger flips m2's `ev1` status to `applicability_supported`.

### m7 — A's concession + new sub-axis

#### 23-id mode

- **Signal vector available:** `responds_to_parent=1`, `concedes_narrow_point=1`, `narrows_claim=1`, `provides_evidence=0`, `ready_for_synthesis=0`. Proposed `introduces_sub_axis=1`, `concedes_with_new_dispute=1` absent.
- **State before:** evidence debt from m5 is resolved; concession chain from m4 exists.
- **Matching rules:** R-CM-01 (`narrows_claim`), R-CM-02 (`concedes_narrow_point`).
- **Mutations produced:**
  - `point_conceded` on m4 (R-CM-02's helper walks up: m6 is parent, m6 is B's evidence supply (not a challenge), m6's parent is m5 (A's source request), m5's parent is m4 (B's agree-with-caveat) — the most-recent move by a DIFFERENT author with a matching `disagreementAxis: applicability_of_evidence` is m4. Target: m4.)
  - `concession_landed` on m7
  - `point_narrowed` on m1 (R-CM-01's helper walks up: looking for the broader-scoped ancestor by the same author. A authored m1, m3, m5, m7. The broadest A move is m1 — the original claim "you still owe your March share, the $120 was for February." Target: m1.)
  - `narrowing_landed` on m7
- **State after:** `concessionChains` gains a second entry; `narrowingLinks` gains an entry. The active sub-axis is NOT yet known to the layer (no `introduces_sub_axis` signal in 23-id mode).
- **Timeline view:** m4 shows another "point conceded" marker (in addition to the m4 chip from m6's resolved debt); m1 shows a "scope narrowed downstream" indicator; m7 shows "conceded + narrowing" pills.
- **Honest limitation in 23-id mode:** the sub-axis opening on amount ($120 vs $140) is NOT captured as a structural state. The fixture's `expectedDeterministicComposition` for m7 names `concede_and_open_sub_axis_on_same_mainline`; that requires `introduces_sub_axis=1`. In 23-id mode, the sub-axis is invisible to the composition layer; the layer-1 metadata (`disagreementAxis: 'amount'` on m7) may surface it via a different rendering path.

#### 35-id mode

- **Additional signals:** `introduces_sub_axis=1` [PROPOSED — MCP-CAT-001], `concedes_with_new_dispute=1` [PROPOSED — MCP-CAT-001].
- **Additional rule:** `R-CAT-SubAxis: introduces_sub_axis=1 → sub_axis_opened`.
- **Additional mutations:**
  - `sub_axis_opened` on m7 (target: m7 itself, marking the sub-axis origin)
  - `prior_dispute_resolved` on m4 (or m2, depending on whose dispute was settled by the concession — implementer decision documented in the rule)
- **State after:** `activeSubAxes` gains: `{ openingMoveId: m7, parentAxisRootMoveId: m1, status: 'open' }`. The original applicability dispute's `SubAxisState` (if tracked) is marked `resolved`.
- **Timeline view:** m7 shows a "sub-axis opened: amount" chip; the prior applicability dispute's nodes show "resolved" markers.

### m8 — B's evidence-backed rebuttal on the sub-axis

#### 23-id mode

- **Signal vector available:** `responds_to_parent=1`, `quote_anchors_parent=1`, `provides_evidence=1`, `evidence_supports_claim=1`, `ready_for_synthesis=1`. Proposed `disputes_specific_amount=1`, `cites_temporal_boundary=1`, `supplies_corroborating_document=1` absent.
- **State before:** state from m7.
- **Matching rules:** R-PC-01, R-EV-02 (no — there is no OPEN evidence debt against m7 or its ancestors at this point; R-EV-02 requires an open debt to fire `evidence_debt_resolved`. Without one, only R-EV-03's "supplies new evidence without an open debt" path applies — but R-EV-03 fires only when `evidence_supports_claim=0`; here it's `=1`. So neither R-EV-02 nor R-EV-03 produces a cross-node mutation. The evidence supply is captured as a per-move marker via the layer-1 metadata or via a non-cross-node rule the implementer may add for `provides_evidence=1 AND evidence_supports_claim=1` without an open debt.) R-CM-03 fires (`ready_for_synthesis=1`).
- **Mutations produced:**
  - `parent_engaged_quoted` on m7 (R-PC-01)
  - `synthesis_ready` on m7 (R-CM-03's helper looks for the most-recent open sub-axis; in 23-id mode there is none, so the helper falls back to the room root m1. Target: m1.)
  - `synthesis_offered` on m8
- **State after:** `synthesisReadiness.ready = true`; `subThreadRootMoveId = m1` (fallback).
- **Timeline view:** m1 shows a "ready for synthesis" indicator; m8 shows a "synthesis offered" pill.
- **Honest limitation in 23-id mode:** the synthesis target is m1 (the room root), not m7 (the sub-axis root, which is the more useful target). The sub-thread root cannot be identified without the sub-axis state, which requires the proposed signal.

#### 35-id mode

- **Additional signals:** `disputes_specific_amount=1`, `cites_temporal_boundary=1`, `supplies_corroborating_document=1`.
- **Additional rules:**
  - `R-CAT-AmountDispute: disputes_specific_amount=1 → amount_dispute_marker` on current.
  - `R-CAT-TemporalBoundary: cites_temporal_boundary=1 → temporal_boundary_marker` on current.
  - `R-CAT-CorroboratingDoc: supplies_corroborating_document=1 → corroborating_document_attached` on current.
- **Tightened R-CM-03:** with `activeSubAxes` populated (from m7's `sub_axis_opened`), the helper finds the open sub-axis and targets `m7` for `synthesis_ready` instead of falling back to m1.
- **Additional mutations:**
  - `amount_dispute_marker` on m8
  - `temporal_boundary_marker` on m8
  - `corroborating_document_attached` on m8
  - `sub_axis_resolved` on m7 (the sub-axis's resolving move is m8; the state transition is recorded)
- **State after:** the `SubAxisState` keyed by m7 flips to `resolved, resolvingMoveId: m8`.
- **Timeline view:** m7 shows "ready for synthesis" AND "sub-axis resolved"; m8 shows amount-dispute + temporal-boundary + corroborating-doc chips.

### Summary: band-space-rent

After 8 moves, the timeline (in 23-id mode) shows:

- m1: opening claim marker; scope-narrowed-downstream indicator (from m7).
- m2: parent-engaged-quoted (from m3); evidence pill.
- m3: parent-engaged-quoted (from R-PC-01 within itself, target was m2); no own-node mutations from composition layer.
- m4: parent-engaged-quoted (from m4 itself targeting m3, plus from m5 and m6 layers); evidence-debt opened (from m5), then resolved (from m6); point-conceded (from m7).
- m5: parent-engaged-quoted; no own mutations.
- m6: evidence-attached-supporting; no cross-node mutations from itself other than the resolve on m4.
- m7: concession-landed + narrowing-landed; no own-node markers from composition rules other than these.
- m8: parent-engaged-quoted; synthesis-offered.

In 35-id mode, the additional rules add: applicability-disputed on m2, sub-axis opened on m7, sub-axis resolved on m7, amount-dispute marker on m8, corroborating-doc marker on m6 and m8, plus the qualified-concession nuance on m4.

The 23-id mode produces a coherent timeline; the 35-id mode produces a richer one. Both are doctrine-safe (no verdict tokens, no person labels, only structural states).

---

## Scenario 2 — Remote work productivity (8 moves, current 23-id catalog only)

**Fixture:** `fixtures/argument-scenarios/smoke-test-mcp-remote-work-productivity.json`.
**Storyline:** Provocateur claims "twenty percent productivity drop under remote work"; Revocateur asks for source; Provocateur supplies vague citation; Revocateur asks for definition; Provocateur appeals to popularity; Revocateur invokes anti-amplification; Provocateur narrows; Revocateur synthesizes and suggests a side branch.

This scenario uses only current-23-id classifiers — no `[PROPOSED]` signals. It is COMP-001's cleanest regression test.

### m1 — Provocateur's thesis (root)

- **Eligibility:** root — R-EX-01.
- **Signal vector:** `introduces_new_issue=1`, `responds_to_parent=0`, `provides_evidence=0`. (Root has no parent; `responds_to_parent` is necessarily 0.)
- **Matching rules:** R-EX-01 only (root takes precedence over R-PC-02; R-PC-02 fires on non-root moves with `responds_to_parent=0 AND introduces_new_issue=1`, and the root exemption preempts).
- **Mutations produced:**
  - `opening_claim_marker` on m1
- **State after:** unchanged.
- **Timeline view:** root node with the opening hat.

### m2 — Revocateur's rebuttal asking for evidence

- **Eligibility:** Revocateur's first move — R-EX-02 applies.
- **Signal vector:** `responds_to_parent=1`, `asks_for_evidence=1`, `creates_source_chain_gap=0`.
- **Matching rules:** R-EX-02 (no composition mutations).
- **Mutations produced:** none from the composition layer.
- **State after:** unchanged.
- **Timeline view:** m2 bubble shows layer-1 metadata (rebuttal type, quote anchor); no cross-node markers.

### m3 — Provocateur's vague-citation evidence supply

- **Eligibility:** Provocateur's second move — classification fires.
- **Signal vector:** `responds_to_parent=1`, `provides_evidence=1`, `evidence_supports_claim=0`, `creates_source_chain_gap=1`, `quote_anchors_parent=0`.
- **State before:** empty.
- **Matching rules:** R-EV-03 (`provides_evidence=1 AND evidence_supports_claim=0`), R-EV-07 (`creates_source_chain_gap=1`).
- **Mutations produced:**
  - `evidence_attached_unverified` on m3
  - `source_chain_gap_flagged` on m3
- **State after:** `sourceChainGaps` gains: `{ openingMoveId: m3, status: 'open' }`.
- **Timeline view:** m3 shows a muted "evidence attached, unverified" pill plus a "source chain gap" indicator.
- **Note:** R-EV-02 does NOT fire because there is no open `EvidenceDebtState` (m2 was Revocateur's FIRST move — exempt — so no debt was opened in state, even though m2's body contained `asks_for_evidence=1`). This is an honest gap: in the current design, debts are only opened from classified moves. The implementer may revisit whether to open debts from exempt moves on a future card; for COMP-001, debt opening requires a packet, and exempt moves have no packet.

### m4 — Revocateur's clarification request

- **Signal vector:** `responds_to_parent=1`, `requests_clarification=1`, `asks_for_evidence=0`.
- **State before:** `sourceChainGaps` from m3.
- **Matching rules:** R-PC-03 (`requests_clarification=1`).
- **Mutations produced:**
  - `clarification_requested` on m3
- **State after:** `clarificationDebts` gains: `{ openingMoveId: m4, targetMoveId: m3, status: 'open' }`.
- **Timeline view:** m3 shows a "?" clarification chip.

### m5 — Provocateur's popularity appeal

- **Signal vector:** `responds_to_parent=1`, `provides_evidence=0`, `uses_popularity_as_evidence=1`, `creates_source_chain_gap=1`.
- **State before:** `sourceChainGaps` has m3's gap; `clarificationDebts` has m4's debt.
- **Matching rules:** R-EV-04 (`uses_popularity_as_evidence=1`), R-EV-07 (`creates_source_chain_gap=1`).
- **Mutations produced:**
  - `popularity_amplification_warning` on m5
  - `source_chain_gap_flagged` on m5
- **State after:** `sourceChainGaps` gains a second entry: `{ openingMoveId: m5, status: 'open' }`.
- **Timeline view:** m5 shows an "amplification" warning chip plus a "source chain gap" indicator.
- **Note:** m5 does NOT answer m4's clarification request (no `answers_clarification=1`); the clarification debt stays open.

### m6 — Revocateur's anti-amplification rebuttal

- **Signal vector:** `responds_to_parent=1`, `asks_for_evidence=1`, `requests_clarification=1`.
- **State before:** state from m5.
- **Matching rules:** R-PC-03 (`requests_clarification=1`), R-EV-01 (`asks_for_evidence=1`).
- **Mutations produced:**
  - `clarification_requested` on m5
  - `evidence_debt_opened` on m5
- **State after:** `clarificationDebts` gains a second entry (`openingMoveId: m6, targetMoveId: m5`); `evidenceDebts` gains an entry (`openingMoveId: m6, targetMoveId: m5`).
- **Timeline view:** m5 now shows both a "?" clarification chip and an "evidence requested" chip.

### m7 — Provocateur's narrowing concession

- **Signal vector:** `responds_to_parent=1`, `narrows_claim=1`, `concedes_narrow_point=1`.
- **State before:** state from m6 (two open clarification debts, one open evidence debt, two open source-chain gaps).
- **Matching rules:** R-CM-01 (`narrows_claim`), R-CM-02 (`concedes_narrow_point`).
- **Mutations produced:**
  - `point_narrowed` on m1 (R-CM-01's helper walks up Provocateur's authored chain: m7's prior Provocateur moves are m5, m3, m1. The broader claim is m1's original 20% across all software engineering. Target: m1.)
  - `narrowing_landed` on m7
  - `point_conceded` on m6 (R-CM-02's helper walks up to find the most-recent move by a DIFFERENT author with a matching axis. m7's parent is m6 (Revocateur); the disagreement axes are not directly named on every move, but m6 is the most-recent challenge. Target: m6.)
  - `concession_landed` on m7
- **State after:** `concessionChains` gains an entry; `narrowingLinks` gains an entry. The evidence debt from m6 is NOT automatically resolved — concession is not evidence supply. The clarification debt is NOT automatically resolved either.
- **Timeline view:** m1 shows "scope narrowed downstream"; m6 shows "point conceded"; m7 shows "concession + narrowing" pills.

### m8 — Revocateur's synthesis + side-branch suggestion

- **Signal vector:** `responds_to_parent=1`, `concedes_narrow_point=1`, `ready_for_synthesis=1`, `suggests_side_branch=1`.
- **State before:** state from m7.
- **Matching rules:** R-CM-02 (`concedes_narrow_point`), R-CM-03 (`ready_for_synthesis`), R-BR-01 (`suggests_side_branch`).
- **Mutations produced:**
  - `point_conceded` on m7 (R-CM-02's helper walks up to find the most-recent move by a DIFFERENT author. m8's parent is m7 (Provocateur). Target: m7.)
  - `concession_landed` on m8
  - `synthesis_ready` on m1 (R-CM-03's helper: no open sub-axis in state, so falls back to the room root. Target: m1.)
  - `synthesis_offered` on m8
  - `side_branch_suggested` on m8
  - `branch_route_hint` on the m8-m7 edge
- **State after:** `synthesisReadiness.ready = true`; concession chain extended.
- **Timeline view:** m1 shows "ready for synthesis"; m7 shows "point conceded"; m8 shows "synthesis offered" + "side branch" pills; the m8-m7 edge gets a branch hint.

### Summary: remote-work-productivity

The composition layer produces a coherent narrative after 8 moves:

- m1 is the opening claim, narrowed downstream, ready for synthesis.
- m3 is unverified evidence with a source-chain gap and an unresolved clarification request.
- m5 is an amplification warning with a second source-chain gap, an unresolved clarification request, and an unresolved evidence debt.
- m6 is a challenge that opened debt + clarification, then was conceded by m7.
- m7 narrows the original claim and concedes.
- m8 synthesizes and proposes a side branch.

The structural narrative is rich even with just the current 23-id catalog. The two source-chain gaps (m3 and m5) remain open at the end of the 8 moves — they are visible on the timeline but unresolved, which is a faithful representation: the scenario does not actually close them. A future move that supplied a primary source would fire R-EV-02 and close one of them.

---

## Cross-scenario observations

1. **The composition layer adds the most value when an evidence debt is opened and resolved across multiple moves.** Both scenarios exercise this pattern; both produce visible "debt opened → debt resolved" timeline state. The band-space-rent scenario does this with the m5 → m6 pair; the remote-work scenario opens debts but does not resolve them in the 8 moves shown (which is itself a useful signal).
2. **23-id mode produces a coherent timeline.** The composition layer does not require MCP-CAT-001 to be useful. The proposed new ids add precision; they are not a prerequisite for COMP-001 to ship.
3. **The exemption rules (R-EX-01, R-EX-02) are the most-fired patterns.** Both scenarios have a root move (m1) and a first-respondent move (m2) that produce no composition mutations. The layer must handle these without error.
4. **The "walk up the chain" helper (`findUpstreamMove`) is exercised by R-CM-01, R-CM-02, R-EV-02, R-EV-06, R-CM-03, and R-PC-04.** It is the most heavily reused internal helper. A bug in it would cascade across 6 rules — hence the design's recommendation to extract it as a separately-testable module.
5. **The `disagreementAxis` field on each move is a useful match key for R-CM-02 but optional.** When the axis is set, the rule targets the upstream challenger with a matching axis. When it is unset, the rule falls back to the immediate parent. Both fixtures include `disagreementAxis` for most eligible moves; production rooms may or may not populate it consistently, and the rule must work either way.
6. **Doctrine holds throughout.** Across 32 moves of worked examples (16 per scenario × 2 modes for band-space-rent + 8 single-mode for remote-work + cross-scenario summary), no mutation value contains a verdict token or a person-label token. Every state transition describes a STRUCTURAL fact (debt opened, point conceded, sub-axis resolved) — never a judgment about who is right.

---

## How the implementer should use this document

1. **For each rule in `COMP-001.md` §4, find the worked example that exercises it.** The walkthroughs above show the input signal vector, the matched rule, and the expected mutations. The implementation must reproduce these exactly.
2. **The 23-id-mode walkthroughs are the regression baseline.** Snapshot tests for `composeVisualState` should match the mutations and state transitions described in 23-id mode for each move of both scenarios.
3. **The 35-id-mode walkthroughs are the forward-compatibility check.** After MCP-CAT-001 lands, snapshot tests in a separate file (with the proposed-signal vectors) should match the 35-id-mode mutations. COMP-001's PR may include these tests behind a feature flag or as `xtest` cases that activate once MCP-CAT-001 ships.
4. **The "Honest limitation in 23-id mode" callouts are the gaps the design knows about.** They are not bugs; they are graceful degradations. The composition layer produces less rich output without the proposed signals — and that is the correct behavior, not something to paper over.

The implementation card's reviewer will use the per-move walkthroughs to verify the layer produces the expected mutations move-by-move. If a discrepancy surfaces, the reviewer raises it for triage: either the rule needs adjustment, the walkthrough needs adjustment, or a new sub-rule is needed.
