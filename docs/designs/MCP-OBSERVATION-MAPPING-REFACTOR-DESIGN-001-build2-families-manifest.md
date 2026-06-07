# MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001 — Build 2 per-family build manifest (Families A, C, D, E, F, G)

**Status:** Proposed (Build-2 per-family build spec) — extends the ratified GATE-A design (#530 / `MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001.md`) and its Build-2 addendum (#537 / `…-build2-addendum.md`).
**Date:** 2026-06-07
**Owner:** orchestrator (post-Build-2a / Family-B scoping)
**Deploy posture:** Build 2 is **deploy-bearing** (Edge classifier mirror auto-deploys on merge; the MCP-server is a manual Deno Deploy step). This manifest is **DESIGN-ONLY** — it authors no production code, no test, no mcp-server change, and no migration. It is the spec each per-family implementer follows.
**Sequences:** Build 2b–2g — one card per family, each reusing the Family-B (Build 2a) template.

---

## 0. What this doc is, and how to read it

The Build-2 addendum scoped and templated **Family B** (`disagreement_axis`) — the 3 `disagreement_axis` booleans, their per-boolean mechanics, the verdict-adjacency defense for `preserves_face_while_disagreeing`, and the family-by-family sequencing. This manifest does the same partition work for the **remaining six production families** so each can ship as its own surgical card without re-deriving the scope.

It mirrors the addendum's structure. For each family in **[A, C, D, E, F, G]** it gives: the deployed family name + `productionEnabled` confirmation; the 3 ratified new booleans with rawKey / question / positive+negative sketches + examples + false-positive-guard focus + a **verdict-adjacency verdict**; the mapping rows the family unlocks; and the per-family 8-test adoption pass. Then a **global section** covers the 5-surface mechanics, the hard invariants, the stack order, and the per-family sign-off gate.

**Letter → deployed family-name map** (verified against `supabase/functions/_shared/booleanObservations/familyRegistry.ts` and the `family:` field of each `src/features/nodeLabels/machineObservationDefinitions/family*.ts`):

| Letter | Deployed family name | `productionEnabled` | Deployed key count (client = mcp-server) | After +3 |
|---|---|---|---|---|
| A | `parent_relation` | **true** ✓ | 16 | 19 |
| B | `disagreement_axis` | **true** ✓ | 14 | 17 *(Build 2a — already scoped)* |
| C | `misunderstanding_repair` | **true** ✓ | 17 | 20 |
| D | `evidence_source_chain` | **true** ✓ | 19 *(Subset; 8 deterministic excluded)* | 22 |
| E | `argument_scheme` | **true** ✓ | 16 | 19 |
| F | `critical_question` | **true** ✓ | 14 | 17 |
| G | `resolution_progress` | **true** ✓ | 18 *(Subset; 12 deterministic excluded)* | 21 |

All seven production families are `productionEnabled: true` today → **NO `familyRegistry.ts` change is needed by any family card** (that is the §6.5 / addendum-§5 hard invariant, and a Build-4-only operation for new families).

---

## BLOCKERS summary (top of doc — read first)

**NO HARD BLOCKERS — all 6 families (A, C, D, E, F, G) are ready to implement.**

Per the §3 hard-blocker scan:

- **Ratified-3 identifiable?** YES for every family. All 18 booleans (3 × 6) are present in the candidate artifact `proposed_new_boolean_flags.csv` as `proposed_new_boolean` rows with a `family_key`, `plain_language`, `flag_category`, and `default_dh_hint`, and they match the GATE-A §5.2 adoption table 1:1 (rows #1–3, #7–21 of that table; B's #4–6 are Build 2a). No family has fewer than 3.
- **Duplicates a deployed rawKey?** NONE. Every proposed rawKey was checked against the full deployed rawKey inventory of all 10 families (the `rawKey:` grep over `src/features/nodeLabels/machineObservationDefinitions/`). Zero collisions.
- **Irreducibly verdict-bearing?** NONE. Three booleans are **verdict-ADJACENT** and require the Family-B 5-layer defense (adversarial fixtures + describe-the-move fences): `acknowledges_parent_strength` (A), `accepts_correction` (C), and — to a lesser degree — `enthymeme_gap_detected` (E) and `question_invites_revision` (F). All four are fenceable to describe-the-MOVE (the candidate register already does so); none is irreducibly verdict-bearing.
- **Not productionEnabled?** N/A — all six are `productionEnabled: true`. No registry change in scope.

**Two NON-blocking flags carried forward for the implementer (not hard blockers):**

1. **`compares_parent_to_sibling_branch` (A) classifier-reliability** — GATE-A Open Question (b) flagged this as a harder cross-branch yes/no. The Family-A card must verify the MCP server answers it with adequate precision in admin_validation; if it cannot, **defer this one boolean** (Family A ships 2/3) rather than emit a noisy label. This is a conditional-adoption note, not a blocker on the card.
2. **Substring-vs-word ban-list collision (C)** — `accepts_correction`'s plain-language label contains the literal substring "correct". A naive substring ban-list scan flags it as the truth token "correct". The Family-C card's verdict-free test MUST use **word-boundary / phrase matching** (`is correct` / `correct answer`, not bare `correct`), or it will false-positive on this benign label. Surfaced here so the implementer does not relax the ban-list to make the test pass.

---

## 1. Family A — `parent_relation`

**Deployed family name:** `parent_relation` · `productionEnabled: true` ✓ (no registry change). Deployed keys: **16** → **19**. Existing rawKeys (do NOT duplicate): `has_rebuttal`, `has_counter_rebuttal`, `rebutted`, `quote_anchors_parent`, `supports_parent`, `challenges_parent`, `refines_parent`, `extends_parent`, `distinguishes_parent`, `reframes_parent`, `questions_parent`, `summarizes_parent`, `acknowledges_parent`, `corrects_parent_detail`, `contrasts_with_parent`, `answers_parent_question`. rawKey convention: snake_case, `*_parent` / `parent_*` verb-object naming, `source: 'ai_classifier'`, `disposition: 'future_source'`, `defaultSurface: 'timeline_node'`, `visibleByDefault: false`, `confidenceEligibility = NEW_FAMILY_A_ELIGIBILITY` (timeline `medium` / selected `low` / inspect `low`).

### The 3 ratified new booleans (GATE-A §5.2 rows #1–3)

| # | `rawKey` | `booleanQuestion` (the MOVE, never the author) | flag_category / DH hint | Verdict-adjacency |
|---|---|---|---|---|
| A1 | `acknowledges_parent_strength` | Does this move acknowledge a strength of the parent before disagreeing with it? | mitigation / DH4 | **YES (mild)** |
| A2 | `compares_parent_to_sibling_branch` | Does this move compare the parent move with a sibling branch in the same thread? | topology / DH4 | No (but reliability-flagged) |
| A3 | `identifies_parent_scope_limit` | Does this move identify a specific scope limit on the parent's claim? | scope / DH5 | No |

**A1 `acknowledges_parent_strength`** — pairs with B's `preserves_face_while_disagreeing` as a mitigation observation.
- *Positive:* the move explicitly grants that some part of the parent is right/strong, then proceeds to disagree. "You're right that tailpipe emissions drop — but battery manufacturing offsets some of that."
- *Negative:* the move disagrees with no acknowledgement (pure `challenges_parent`), or merely acknowledges with no following disagreement (that is the existing `acknowledges_parent`).
- *Pos examples:* (1) "Fair point on the urban data — but it doesn't hold for rural." (2) "Your strongest claim is the cost case; I accept that, and still think the equity case outweighs it."
- *Neg examples:* (1) "That's wrong." (no acknowledgement). (2) "Good point." (acknowledgement only, no disagreement → `acknowledges_parent`).
- *falsePositiveGuards focus:* do NOT mark on politeness/tone alone; the acknowledgement must name a substantive strength AND be followed by disagreement. Distinguish from bare `acknowledges_parent` (no disagreement) and from `supports_parent` (no disagreement at all).
- **VERDICT-ADJACENCY: YES (mild).** "Acknowledges parent **strength**" risks reading as "the parent is right/strong" — a standing verdict. **REQUIRE** Family-B-style adversarial fixtures + a describe-the-move fence: the label describes the *move's rhetorical structure* ("this reply grants a point before disagreeing"), NEVER asserts the parent point IS strong/correct. Ban "correct"/"true"/"wins" in label + diagnostic.

**A2 `compares_parent_to_sibling_branch`** — topology observation.
- *Positive:* the move references another branch in the same thread and contrasts the parent with it. "Unlike the branch on enforcement, this one assumes durable institutions."
- *Negative:* the move stays within the parent line with no sibling reference; or references an ancestor (that is a thread-topology concern, Family I, not in scope).
- *Pos examples:* (1) "The sibling thread already settled the cost question; this branch is really about equity." (2) "Compared to the other reply chain, this one ignores the enforcement variable."
- *Neg examples:* (1) "I disagree with the cost figure." (no sibling reference). (2) "Earlier you said X." (ancestor reference, not sibling).
- *falsePositiveGuards focus:* the comparison must be to a SIBLING branch (same parent, different child line), not the parent itself or an ancestor; do NOT mark on generic "elsewhere people argue…".
- **VERDICT-ADJACENCY: No.** Purely structural/topological. **Reliability flag (GATE-A Open Q b):** cross-branch reasoning is a harder classifier task; the card must verify admin_validation precision and **defer if noisy** (ship A as 2/3).

**A3 `identifies_parent_scope_limit`** — scope observation (collaborative cousin of B's `disputes_scope`).
- *Positive:* the move names a specific boundary where the parent's claim stops applying, without necessarily disputing it adversarially. "This holds for passenger EVs; commercial duty cycles are a different case."
- *Negative:* the move accepts the parent's scope wholesale; or adversarially disputes scope (that is `disputes_scope`, Family B).
- *Pos examples:* (1) "True within cities; the suburban case is open." (2) "Applies to the 5-year horizon you cited; beyond that the data thins out."
- *Neg examples:* (1) "That's just false." (`disputes_fact`). (2) "Carbon taxes never work." (no scope limit named).
- *falsePositiveGuards focus:* the scope limit must be SPECIFIC (a named population/time/setting); do NOT mark on vague "it depends". Distinguish the collaborative scope-naming here from the adversarial `disputes_scope` in Family B (both may co-fire; A3 is the structural fact, B's is the dispute framing).
- **VERDICT-ADJACENCY: No.** Describes a structural feature of the move; "scope limit" is a boundary observation, not a deficiency verdict.

### Mapping rows Family A unlocks
- Candidate-CSV rows referencing **only** Family-A new flags: **66** (`rule_kind`: 3 single_true, 3 single_false, 30 pair_true_false, 30 pair_false_true). Observation-code prefix `parent_relation.*` (samples: `parent_relation.single_true.0019`, `parent_relation.single_false.0020`, `parent_relation.single_true.0021`).
- Of those 66, **6 are immediately fireable** by Family A's 3 booleans alone (the 3 single_true + 3 single_false). The other **60 are pair rules** that also need a partner flag (existing/planned A flag or another family's flag) → seeded in **Build 3**, not the Family-A card.
- **Re-authoring requirement:** every adopted row's user-facing `observationCode` MUST route through `gameCopy.toPlainLanguageOrSuppress`; verdict-free ban-list applies (the candidate `label_neutral` register — "Reasoned disagreement" / "Unsupported or lightly supported disagreement" — is already clean; re-run the scan as a test). The A1 mitigation rows get the verdict-adjacency fence.

### Per-family 8-test adoption pass (Family A)
| Test | A1 | A2 | A3 |
|---|---|---|---|
| 1 Not derivable (from existing 16) | PASS | PASS | PASS |
| 2 Materially better label | PASS (face-preserving disagreement) | PASS (topology-aware) | PASS (collaborative scope-narrowing) |
| 3 Classifier-answerable yes/no | PASS | **FLAG — verify precision** | PASS |
| 4 Improves reader understanding | PASS | PASS | PASS |
| 5 Display-only / not a gate | PASS | PASS | PASS |
| 6 Fixture-testable | PASS | PASS | PASS |
| 7 Verdict-free label | PASS *with fence* | PASS | PASS |
| 8 Clear absent-fallback | PASS | PASS | PASS |

**Verdict:** Family A ready. A1 needs the verdict-adjacency fence; A2 carries the conditional-adoption reliability check (defer-if-noisy).

---

## 2. Family C — `misunderstanding_repair`

**Deployed family name:** `misunderstanding_repair` · `productionEnabled: true` ✓. Deployed keys: **17** → **20**. Existing rawKeys (do NOT duplicate): `clarified`, `requests_clarification`, `answers_clarification`, `provides_alternate_interpretation`, `offers_candidate_understanding`, `confirms_understanding`, `rejects_candidate_understanding`, `requests_restatement`, `self_initiates_self_repair`, `other_initiates_repair`, `acknowledges_misread`, `flags_ambiguous_reference`, `flags_term_ambiguity`, `proposes_shared_definition`, `confirms_shared_definition`, `scope_mismatch_identified`, `question_answer_mismatch`. Convention: repair/clarity verb-object snake_case, `source: 'ai_classifier'`, `future_source`.

### The 3 ratified new booleans (GATE-A §5.2 rows #7–9)

| # | `rawKey` | `booleanQuestion` | flag_category / DH | Verdict-adjacency |
|---|---|---|---|---|
| C1 | `offers_repair_path` | Does this move propose a concrete way to resolve a misunderstanding (a path, not just a flag)? | repair / DH4 | No |
| C2 | `names_ambiguity_source` | Does this move name the specific source of an ambiguity (which term / reference is unclear and why)? | clarity_gap / DH4 | No |
| C3 | `accepts_correction` | Does this move accept a correction that a prior move offered? | mitigation / DH4 | **YES (mild)** |

**C1 `offers_repair_path`** — distinct from existing `requests_restatement` / `requests_clarification` (which only *flag* the need); this proposes the resolution.
- *Positive:* "If we agree 'efficiency' means cost-per-visit, the disagreement narrows to whether that's the right metric." (offers a path to resolve).
- *Negative:* the move only flags confusion (`requests_clarification`), or restates without proposing a resolution path.
- *Pos examples:* (1) "Let's separate the cost claim from the equity claim and take them one at a time." (2) "I think we're using 'infrastructure' two ways — if we tag each use, we can see where we actually differ."
- *Neg examples:* (1) "I don't follow." (`requests_clarification`). (2) "What did you mean?" (`requests_clarification`).
- *falsePositiveGuards focus:* the move must propose a CONCRETE resolution mechanism, not merely express willingness to resolve; distinguish from `proposes_shared_definition` (definition-specific) — repair_path is broader (sequencing, separating, reframing the disagreement).
- **VERDICT-ADJACENCY: No.** Structural/procedural; describes a constructive move shape.

**C2 `names_ambiguity_source`** — sharper than existing `flags_ambiguous_reference` / `flags_term_ambiguity` (which flag *that* something is ambiguous); this names *what and why*.
- *Positive:* "The ambiguity is in 'works' — you mean reduces emissions, I read it as politically durable." (names the source + the two readings).
- *Negative:* the move flags ambiguity without identifying its source ("this is confusing"), or asks for clarification.
- *Pos examples:* (1) "'It' in your second sentence could point to the policy or the study — that's where we're talking past each other." (2) "The word 'fair' is doing two jobs here: procedural fairness and outcome fairness."
- *Neg examples:* (1) "This is ambiguous." (`flags_term_ambiguity`, no source named). (2) "Can you rephrase?" (`requests_restatement`).
- *falsePositiveGuards focus:* the move must NAME the specific term/reference AND why it's ambiguous; do NOT mark on a bare "ambiguous" flag. Both `flags_term_ambiguity` and C2 can co-fire (the flag + the naming).
- **VERDICT-ADJACENCY: No.** Diagnostic-structural; "ambiguity source" describes the text, not the author's competence.

**C3 `accepts_correction`** — mitigation/repair observation.
- *Positive:* a prior move corrected something; this move accepts it. "You're right, the figure is stock not new-sales — I'll use 10%."
- *Negative:* the move rejects the correction, ignores it, or there was no correction to accept.
- *Pos examples:* (1) "Fair — I had the date wrong, it's 2020." (2) "Accepted; my source was secondary, yours is primary."
- *Neg examples:* (1) "No, my number is right." (rejects). (2) "Anyway, as I was saying…" (ignores).
- *falsePositiveGuards focus:* there must be an identifiable prior correction the move accepts; do NOT mark generic agreement (`acknowledges_parent`) as correction-acceptance. **Ban-list note for the implementer:** the label "Accepts correction" contains the substring "correct" — the verdict-free test MUST use word-boundary / phrase matching (`is correct`, `correct answer`), NOT bare-substring `correct`, or it false-positives.
- **VERDICT-ADJACENCY: YES (mild).** "Accepts correction" can read as "the author was wrong / conceded a loss." **REQUIRE** the verdict-adjacency fence: the label describes the *repair move* ("this reply takes up a point a prior move offered"), NEVER frames it as defeat/concession-of-the-whole. cdiscourse-doctrine §1: concession is a scoring *repair*, not a defeat — the copy must reflect that.

### Mapping rows Family C unlocks
- Rows referencing only Family-C new flags: **66** (3 single_true, 3 single_false, 30 pair_true_false, 30 pair_false_true). Prefix `misunderstanding_repair.*` (samples: `misunderstanding_repair.single_true.0071`, `…single_false.0072`, `…single_true.0073`). 6 immediately fireable; 60 pair rows → Build 3.
- Re-authoring: route through `toPlainLanguageOrSuppress`; verdict-free ban-list (word-boundary); C3 mitigation rows get the repair-not-defeat fence.

### Per-family 8-test adoption pass (Family C)
All three booleans PASS tests 1–8, with: C3 test-7 PASS *with the repair-not-defeat fence + word-boundary ban-list*. **Verdict:** Family C ready. C3 needs the fence; the implementer must not weaken the ban-list to accommodate the "correct" substring.

---

## 3. Family D — `evidence_source_chain`

**Deployed family name:** `evidence_source_chain` · `productionEnabled: true` ✓. Deployed keys: **19** (mcp-server Subset; 8 deterministic excluded per the operator Stage-2B decision recorded in `scripts/ops/sql/14-…sql:14`) → **22**. Existing rawKeys (do NOT duplicate): `has_evidence`, `source_requested`, `quote_requested`, `source_attached`, `quote_attached`, `sourced`, `asks_for_evidence`, `provides_evidence`, `evidence_supports_claim`, `creates_source_chain_gap`, `opens_evidence_debt_marker`, `closes_evidence_debt_marker`, `supplies_corroborating_document`, `source_provided`, `quote_provided`, `concrete_example_requested`, `concrete_example_provided`, `evidence_claim_present`, `evidence_gap_present`, `source_chain_repair`, `anecdote_used`, `statistic_used`, `external_authority_used`, `evidence_quality_questioned`, `burden_request_present`. (The client file carries more entries than the 19-key mcp-server subset — the card adds the 3 new keys to BOTH the client definitions AND the mcp-server subset, taking the subset 19 → 22.)

### The 3 ratified new booleans (GATE-A §5.2 rows #10–12 — all "operator lean")

| # | `rawKey` | `booleanQuestion` | flag_category / DH | Verdict-adjacency |
|---|---|---|---|---|
| D1 | `names_method_difference` | Does this move name a difference in method or measurement between two pieces of evidence? | evidence / DH5 | No |
| D2 | `separates_observation_from_inference` | Does this move distinguish what was observed from what was inferred? | evidence / DH5 | No |
| D3 | `flags_context_limit` | Does this move flag a context or applicability limit on a piece of evidence? | uncertainty / DH4 | No |

**D1 `names_method_difference`** — high-value evidence dynamic; distinct from existing `evidence_quality_questioned` (which disputes quality) — this names a *methodological* difference neutrally.
- *Positive:* "Your study used self-report; the one I cited used administrative records — that's why the numbers diverge."
- *Negative:* the move disputes evidence quality without naming the method (`evidence_quality_questioned`), or asks for evidence.
- *Pos examples:* (1) "Survey vs. census — different denominators." (2) "They measured at 6 months, you at 5 years; the method difference is the time horizon."
- *Neg examples:* (1) "Your study is bad." (`evidence_quality_questioned`). (2) "Where's your source?" (`asks_for_evidence`).
- *falsePositiveGuards focus:* the move must NAME a specific method/measurement difference; do NOT mark generic "I trust mine more". Co-fires acceptably with `evidence_quality_questioned`.
- **VERDICT-ADJACENCY: No.** Neutral methodological observation about the evidence, not the author.

**D2 `separates_observation_from_inference`** — strong epistemic label; not derivable from existing keys.
- *Positive:* "We observed the correlation; the causal link is an inference, not in the data."
- *Negative:* the move conflates the two, or disputes a fact directly.
- *Pos examples:* (1) "The data shows X happened; that it was caused by Y is your read, not the measurement." (2) "What's measured is enrollment; 'literacy gain' is an inference on top of it."
- *Neg examples:* (1) "That's just false." (`disputes_fact`). (2) "Good evidence." (no separation).
- *falsePositiveGuards focus:* the move must explicitly mark the observation/inference boundary; do NOT mark on the word "infer" alone.
- **VERDICT-ADJACENCY: No.** Epistemic-structural; high-value, doctrine-clean.

**D3 `flags_context_limit`** — applicability-limit label; uncertainty-related.
- *Positive:* "That holds in the lab; field conditions add variables it doesn't account for."
- *Negative:* the move disputes the evidence outright, or accepts it with no limit flagged.
- *Pos examples:* (1) "Valid for the 2020 sample; the population has shifted since." (2) "True in high-trust institutions; the evidence doesn't speak to low-trust ones."
- *Neg examples:* (1) "That evidence is wrong." (`disputes_fact`/quality). (2) "Solid source." (no limit).
- *falsePositiveGuards focus:* the limit must be a CONTEXT/APPLICABILITY boundary on the evidence (vs. a scope limit on the claim, which is A3 / `disputes_scope`); do NOT mark vague hedging. Overlaps acceptably with `disputes_evidence_applicability` (Family B — the dispute) vs. D3 (the neutral flag).
- **VERDICT-ADJACENCY: No.** Describes a limit on the evidence; uncertainty observation.

### Mapping rows Family D unlocks
- Rows referencing only Family-D new flags: **66** (3 single_true, 3 single_false, 30 pair_true_false, 30 pair_false_true). Prefix `evidence_source_chain.*` (samples: `evidence_source_chain.single_true.0095`, `…single_false.0096`, `…single_true.0097`). 6 immediately fireable; 60 pair rows → Build 3.
- Re-authoring: `toPlainLanguageOrSuppress`; verdict-free ban-list. evidence-doctrine note: D's labels surface evidence *dynamics* (method, observation/inference, context limit) — they NEVER grant or deny factual standing (that is the anti-amplification module's job, untouched). The labels describe the move, not the truth of the evidence.

### Per-family 8-test adoption pass (Family D)
All three PASS tests 1–8 cleanly. No verdict-adjacency fence required (lowest-risk family alongside G). **Verdict:** Family D ready.

---

## 4. Family E — `argument_scheme`

**Deployed family name:** `argument_scheme` · `productionEnabled: true` ✓. Deployed keys: **16** → **19**. Existing rawKeys (do NOT duplicate): `causal_reasoning_present`, `analogy_reasoning_present`, `example_reasoning_present`, `authority_reasoning_present`, `consequence_reasoning_present`, `principle_reasoning_present`, `definition_reasoning_present`, `classification_reasoning_present`, `precedent_reasoning_present`, `means_end_reasoning_present`, `tradeoff_reasoning_present`, `abductive_explanation_present`, `exception_reasoning_present`, `slippery_slope_reasoning_present`, `cost_benefit_reasoning_present`, `risk_reasoning_present`. Convention: `*_reasoning_present` / `*_present` scheme-structure naming, `source: 'ai_classifier'`, `future_source`.

### The 3 ratified new booleans (GATE-A §5.2 rows #13–15 — all "operator lean")

| # | `rawKey` | `booleanQuestion` | flag_category / DH | Verdict-adjacency |
|---|---|---|---|---|
| E1 | `linked_premise_structure` | Does this move use linked premises (each premise needed; they fail together)? | scheme / DH5 | No |
| E2 | `convergent_premise_structure` | Does this move use convergent premises (each premise independently supports the conclusion)? | scheme / DH5 | No |
| E3 | `enthymeme_gap_detected` | Does this move rely on an unstated premise (an enthymeme gap)? | scheme / DH4 | **YES (mild)** |

**E1 `linked_premise_structure`** — pairs with E2; powers a strong scheme-structure cross-family rule.
- *Positive:* "Because A, and because B (and you need both), therefore C." Premises are interdependent.
- *Negative:* premises that each independently support the conclusion (that is E2 `convergent`), or a single-premise move.
- *Pos examples:* (1) "Only if the tax is durable AND enforced does it cut emissions — both are required." (2) "It works because the population is large and the effect is per-capita; remove either and the case collapses."
- *Neg examples:* (1) "It works for three independent reasons: cost, equity, and feasibility." (`convergent`). (2) "It works." (no premise structure).
- *falsePositiveGuards focus:* linked means the premises FAIL TOGETHER (interdependent); do NOT mark a list of independent reasons. Distinguish sharply from E2.
- **VERDICT-ADJACENCY: No.** Structural description of inference shape (Walton/argumentation-scheme theory term), surfaced as plain-language; no quality verdict.

**E2 `convergent_premise_structure`** — the independent-support counterpart.
- *Positive:* "Even if cost weren't an issue, equity alone justifies it; and feasibility alone would too." Each premise stands on its own.
- *Negative:* interdependent premises (E1 `linked`), or single-premise.
- *Pos examples:* (1) "Three separate reasons, any one sufficient." (2) "It's good on the merits AND independently good politically."
- *Neg examples:* (1) "You need both A and B." (`linked`). (2) "Because A." (single).
- *falsePositiveGuards focus:* convergent means each premise INDEPENDENTLY supports; do NOT mark interdependent premises. E1 and E2 are mutually exclusive on the same inference but both may appear in a multi-part move.
- **VERDICT-ADJACENCY: No.** Structural; mirror of E1.

**E3 `enthymeme_gap_detected`** — enthymeme-gap label; powers a strong cross-family rule with Family F critical questions.
- *Positive:* the move's conclusion depends on a premise it never states. "EVs are clean" (unstated: the grid is clean).
- *Negative:* the move states all its premises; or a critical-question move that asks for the missing premise (that is Family F `missing_warrant` / `unstated_assumption`).
- *Pos examples:* (1) "He's an expert, so he's right." (unstated: experts in this domain are reliable here). (2) "It's natural, therefore safe." (unstated: natural ⇒ safe).
- *Neg examples:* (1) "He's an expert in climate policy, his peers concur, so this estimate is credible." (premise stated). (2) "What's the unstated assumption here?" (Family F question, not the gap itself).
- *falsePositiveGuards focus:* the gap must be a load-bearing unstated premise, not a stylistic omission; do NOT mark every compressed sentence. Distinguish E3 (the move HAS a gap — structural fact about THIS move) from Family F's `unstated_assumption` (a critical QUESTION asking about a gap in the parent).
- **VERDICT-ADJACENCY: YES (mild).** "Enthymeme gap detected" / "gap" can read as a deficiency verdict ("this argument is flawed"). **REQUIRE** the fence: the label describes a *structural feature of the move's inference* ("this reply relies on an unstated step"), advisory, NEVER "this argument is weak/wrong". cdiscourse-doctrine §1: a gap is an invitation to state the premise, not a defeat. Adversarial fixtures confirm move-level, not author-level ("this reply", never "this person reasons sloppily").

### Mapping rows Family E unlocks
- Rows referencing only Family-E new flags: **66** (3 single_true, 3 single_false, 30 pair_true_false, 30 pair_false_true). Prefix `argument_scheme.*` (samples: `argument_scheme.single_true.0119`, `…single_false.0120`, `…single_true.0121`). 6 immediately fireable; 60 pair rows → Build 3.
- Re-authoring: `toPlainLanguageOrSuppress`; verdict-free ban-list. The theory terms `linked` / `convergent` / `enthymeme` stay INTERNAL (rawKey + internal metadata); the user-facing plain-language label is the gameCopy-mapped string (GATE-A §8.2 rule 4 — theory labels never surfaced raw).

### Per-family 8-test adoption pass (Family E)
All three PASS tests 1–8, with E3 test-7 PASS *with the gap-is-not-a-verdict fence*. **Verdict:** Family E ready. E3 needs the fence.

---

## 5. Family F — `critical_question`

**Deployed family name:** `critical_question` · `productionEnabled: true` ✓. Deployed keys: **14** → **17**. Existing rawKeys (do NOT duplicate): `missing_warrant`, `unstated_assumption`, `authority_basis_missing`, `causal_mechanism_missing`, `analogy_mapping_missing`, `example_representativeness_unclear`, `consequence_probability_unclear`, `definition_boundary_unclear`, `criterion_weighting_unclear`, `alternative_explanation_available`, `counterexample_available`, `scope_limit_unstated`, `qualification_missing`, `comparison_baseline_missing`. Convention: `*_missing` / `*_unclear` / `*_available` / `question_*` critical-question naming. **rawKey-convention note:** the 3 new F booleans use the `question_*` prefix (per §5.2 / artifact), which is a NEW prefix for this family — the existing keys use `*_missing`/`*_unclear`. The implementer should confirm the prefix is acceptable; it reads naturally ("the question names uncertainty") and does not collide.

### The 3 ratified new booleans (GATE-A §5.2 rows #16–18)

| # | `rawKey` | `booleanQuestion` | flag_category / DH | Verdict-adjacency |
|---|---|---|---|---|
| F1 | `question_names_uncertainty` | Does the question this move poses name a specific source of uncertainty? | uncertainty / DH4 | No |
| F2 | `question_separates_claim_evidence` | Does the question this move poses separate the claim from the evidence for it? | evidence / DH5 | No |
| F3 | `question_invites_revision` | Does the question this move poses invite revision rather than demand closure? | mitigation / DH4 | **YES (mild)** |

**F1 `question_names_uncertainty`** — uncertainty-source label; sharper than the generic `*_unclear` flags.
- *Positive:* "Is the 40% figure tailpipe-only or lifecycle? That distinction is where the uncertainty is."
- *Negative:* a critical question that doesn't name what's uncertain ("are you sure?"), or a non-question move.
- *Pos examples:* (1) "What's the confidence interval — that's the open question." (2) "Which population does this cover? The uncertainty is in the denominator."
- *Neg examples:* (1) "Really?" (no named uncertainty). (2) "That's wrong." (not a question).
- *falsePositiveGuards focus:* the move must POSE A QUESTION that names a specific uncertainty source; do NOT mark statements. Co-fires with the `*_unclear` existing keys.
- **VERDICT-ADJACENCY: No.** Structural feature of the question.

**F2 `question_separates_claim_evidence`** — claim-vs-evidence label; not derivable.
- *Positive:* "I get the claim — but what's the evidence specifically for the causal step?" (separates the two).
- *Negative:* a question that conflates claim and evidence, or asks for evidence without separating (`asks_for_evidence`, Family D).
- *Pos examples:* (1) "The claim is clear; my question is which study supports the 40% specifically." (2) "Granting the conclusion, what's the evidence for premise 2 as opposed to premise 1?"
- *Neg examples:* (1) "Source?" (`asks_for_evidence`). (2) "Is that true?" (no separation).
- *falsePositiveGuards focus:* the question must explicitly distinguish the claim from its evidentiary basis; do NOT mark a bare evidence request.
- **VERDICT-ADJACENCY: No.** Epistemic-structural; doctrine-clean.

**F3 `question_invites_revision`** — "invites revision not closure"; high-value, verdict-free by design but mitigation-adjacent.
- *Positive:* "Would the claim still hold if we restricted it to cities? — open, not gotcha." (invites the parent to refine).
- *Negative:* a question framed to corner/close ("so you admit X?"), or a neutral information question.
- *Pos examples:* (1) "Is there a narrower version you'd defend more confidently?" (2) "What would make this stronger — a different sample?"
- *Neg examples:* (1) "So you have no evidence?" (closure/gotcha framing). (2) "What time is it?" (irrelevant).
- *falsePositiveGuards focus:* "invites revision" is about the question's stance (open, improvement-seeking), not its politeness; do NOT mark gotcha questions dressed politely. The label must not imply the parent NEEDS revision as a verdict.
- **VERDICT-ADJACENCY: YES (mild).** "Invites revision" risks implying "the parent is deficient and must be revised." **REQUIRE** the fence: describes the *question's collaborative stance* ("this reply asks in a way that leaves room to refine"), NEVER asserts the parent is wrong/weak. Move-level adversarial fixtures.

### Mapping rows Family F unlocks
- Rows referencing only Family-F new flags: **67** (3 single_true, 3 single_false, 30 pair_true_false, 30 pair_false_true, **1 curated_triple** — the only family with a curated_triple in its unlock set). Prefix `critical_question.*` (samples: `critical_question.single_true.0143`, `…single_false.0144`, `…single_true.0145`). 6 single rules immediately fireable; the 60 pairs + 1 triple → Build 3.
- Re-authoring: `toPlainLanguageOrSuppress`; verdict-free ban-list; F3 mitigation rows get the fence.

### Per-family 8-test adoption pass (Family F)
All three PASS tests 1–8, with F3 test-7 PASS *with the invites-revision fence*. **Verdict:** Family F ready. F3 needs the fence; the `question_*` prefix is a minor convention note (not a blocker).

---

## 6. Family G — `resolution_progress`

**Deployed family name:** `resolution_progress` · `productionEnabled: true` ✓. Deployed keys: **18** (mcp-server Subset; 12 deterministic excluded per Stage-2B, `scripts/ops/sql/14-…sql:15`) → **21**. Existing rawKeys (do NOT duplicate): `branch_suggested`, `branch_created`, `point_stalled`, `point_exhausted`, `synthesis_candidate`, `narrowed`, `conceded`, `confirmed`, `synthesis_ready`, `exhausted`, `branch_recommended`, `archived_or_resolved`, `narrows_claim`, `concedes_narrow_point`, `ready_for_synthesis`, `suggests_side_branch`, `suggests_diagonal_tangent`, `accepts_partial_with_caveat`, `concedes_with_new_dispute`, `proposes_settlement_terms`, `accepts_settlement_terms`, `concedes_broader_point`, `common_ground_identified`, `unresolved_point_isolated`, `synthesis_proposed`, `move_on_requested`, `issue_closed_by_participant`, `decision_criterion_proposed`, `action_item_proposed`, `followup_question_proposed`. (Client carries more than the 18-key mcp-server subset; the card adds 3 new to BOTH, taking subset 18 → 21.)

### The 3 ratified new booleans (GATE-A §5.2 rows #19–21 — all "operator lean")

| # | `rawKey` | `booleanQuestion` | flag_category / DH | Verdict-adjacency |
|---|---|---|---|---|
| G1 | `records_remaining_disagreement` | Does this move explicitly record what remains in dispute? | resolution / DH4 | No |
| G2 | `defines_next_evidence_needed` | Does this move define what evidence would resolve the open point next? | resolution / DH5 | No |
| G3 | `separates_normative_from_empirical` | Does this move separate a normative dispute from an empirical one? | scope / DH5 | No |

**G1 `records_remaining_disagreement`** — closes a real label gap; distinct from existing `unresolved_point_isolated` (which isolates ONE point) — G1 records the remaining-disagreement SET.
- *Positive:* "We agree on cost; what's still open is whether equity outweighs it and whether enforcement is feasible."
- *Negative:* the move declares the issue closed, or isolates a single point without summarizing the remainder.
- *Pos examples:* (1) "Settled: the data. Open: the value weighting and the timeline." (2) "Two things still in dispute after all this: the denominator and the causal direction."
- *Neg examples:* (1) "Done here." (`issue_closed_by_participant`). (2) "This one point is unresolved." (`unresolved_point_isolated`).
- *falsePositiveGuards focus:* the move must RECORD what remains (a roundup), not just flag one open point; co-fires with `common_ground_identified`.
- **VERDICT-ADJACENCY: No.** Resolution bookkeeping; describes the state of the exchange.

**G2 `defines_next_evidence_needed`** — "what evidence next"; actionable + verdict-free; aligns with evidence-doctrine's evidence-debt model.
- *Positive:* "To settle this, we'd need a primary record of the enforcement dates — that's the next evidence."
- *Negative:* the move asks for evidence generically (`asks_for_evidence`, Family D), or proposes a settlement without naming the evidence.
- *Pos examples:* (1) "A longitudinal study past year 5 would resolve the durability question." (2) "What would close this: the original dataset, not the press summary."
- *Neg examples:* (1) "Got a source?" (`asks_for_evidence`). (2) "Let's just agree to disagree." (`move_on_requested`).
- *falsePositiveGuards focus:* the move must DEFINE the specific evidence that would advance resolution; do NOT mark a generic source request. evidence-doctrine: this names a `primary_record_needed` / `source_needed`-style next step, advisory.
- **VERDICT-ADJACENCY: No.** Forward-looking, constructive; doctrine-clean.

**G3 `separates_normative_from_empirical`** — normative-vs-empirical label; not derivable.
- *Positive:* "The 'does it work' part is empirical and we can check it; the 'is it worth it' part is normative and we won't settle it with data."
- *Negative:* the move conflates the two, or disputes within one without separating.
- *Pos examples:* (1) "Two questions tangled here: an empirical one (the effect size) and a values one (whether the tradeoff is acceptable)." (2) "We can measure the cost; whether it's 'too much' is a judgment, not a measurement."
- *Neg examples:* (1) "That's just wrong." (`disputes_fact`). (2) "I disagree on values." (no separation).
- *falsePositiveGuards focus:* the move must explicitly mark the normative/empirical boundary; do NOT mark on the word "values" alone. Related to D2 (`separates_observation_from_inference`) but distinct: G3 separates fact-questions from value-questions; D2 separates observed-data from inferred-conclusions.
- **VERDICT-ADJACENCY: No.** Epistemic-structural; cleanest alongside D.

### Mapping rows Family G unlocks
- Rows referencing only Family-G new flags: **66** (3 single_true, 3 single_false, 30 pair_true_false, 30 pair_false_true). Prefix `resolution_progress.*` (samples: `resolution_progress.single_true.0167`, `…single_false.0168`, `…single_true.0169`). 6 immediately fireable; 60 pair rows → Build 3.
- Re-authoring: `toPlainLanguageOrSuppress`; verdict-free ban-list.

### Per-family 8-test adoption pass (Family G)
All three PASS tests 1–8 cleanly. No verdict-adjacency fence required (lowest-risk family alongside D). **Verdict:** Family G ready.

---

## 7. GLOBAL SECTION

### 7.1 The 5-surface mechanics per boolean (same as Family B / addendum §5)

Adding one boolean to a production family is a vocabulary expansion across these surfaces (NO schema-version bump, NO DDL):

1. **Client definition** — a new `MachineObservationDefinition` (full shape: `id`, `rawKey`, `kind: 'machine_observation'`, `source: 'ai_classifier'`, `family`, `label`, `shortLabel`, `description`, `defaultSurface`, `disposition: 'future_source'`, `priority`, `visibleByDefault: false`, `booleanQuestion`, `positiveDefinition`, `negativeDefinition`, `positiveExamples`, `negativeExamples`, `falsePositiveGuards`, `doctrineNotes`, `confidenceEligibility`) appended to `src/features/nodeLabels/machineObservationDefinitions/family{A,C,D,E,F,G}.ts`.
2. **Byte-equal Edge mirror** — the identical definition appended to `supabase/functions/_shared/booleanObservations/machineObservationDefinitions/family{A,C,D,E,F,G}.ts`. Parity-tested.
3. **mcp-server question surfaces** — the mcp-server carries MORE than one file per family (verified): `mcp-server/lib/family{X}Keys.ts` (the `FAMILY_X_RAW_KEYS` array + `FAMILY_X_PROMPT_ENTRIES` — add the 3 rawKeys + 3 prompt entries), `family{X}Prompt.ts` (assembles the prompt), `family{X}Anthropic.ts`, `family{X}BanListScan.ts`, `family{X}FixtureProvider.ts`. The card adds the 3 keys + prompt entries and a fixture per new boolean. `FAMILY_X_CLASSIFIER_SET_VERSION` (`family-{x}-v1`) — the card decides whether to bump to `-v2` (this is the family's classifier-set version, distinct from the global schema version, which MUST NOT change — see §7.2). Recommended: bump the per-family set version to signal the prompt changed, while the global `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION` stays byte-equal `v1`.
4. **NO global schema-version bump** — `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION = 'mcp-021.machine-observations.boolean.v1'` stays byte-equal (addendum §1). A regression test asserts the constant is unchanged.
5. **Parity + fixture + ban-list tests** — extend the per-family parity test (`mcp-server/tests/family{X}KeysParity.test.ts`; note **Family F uses `familyFKeys.test.ts`** rather than a `*Parity*` file — each card follows its family's existing test name), the upstream `__tests__/machineObservationRegistry.test.ts` (registry counts go up), the verdict-free ban-list scan (word-boundary matching — see Family C note), and an adversarial-fixture suite for any verdict-adjacent boolean (A1, C3, E3, F3) proving move-level-not-author-level phrasing.

**Mapping-row note (Build-2 vs Build-3 boundary):** the per-family Build-2 card adds the 3 **booleans** (so the classifier returns them) and MAY seed the 6 immediately-fireable single rules (3 single_true + 3 single_false) into `observationMappingRegistry.ts`. The ~60 pair/triple rows per family that ALSO need a partner flag are **Build 3** (GATE-A §12) — they are *unlocked* by Build-2 booleans but *seeded* in the mapping-extension build. Each card states explicitly which rows it seeds vs. defers, and updates `OBSERVATION_MAPPING_ADOPTION_MANIFEST` counts accordingly.

### 7.2 Hard invariants every family card MUST honor

1. **NO global schema-version bump** — `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION` byte-equal (the read adapter filters on exact match; bumping hides every existing room's observations — addendum §1).
2. **NO DDL / NO migration** — the store is key-value (`argument_machine_observation_results.raw_key TEXT`, `UNIQUE (run_id, raw_key)`); a new boolean is a new row-VALUE, unknown keys dropped at read (GATE-A §6). `npx supabase db push` does nothing for these cards.
3. **NO `familyRegistry.ts` / `productionEnabled` change** — all six families are already `productionEnabled: true`; flipping flags is a Build-4 / new-family operation, out of scope.
4. **NO `engine.ts` / submission-path change** — classification is POST-storage, display-only; `engine.ts` is the sole submission gate (GATE-A doctrine invariant 1). No boolean blocks/routes/suppresses/delays a post.
5. **NO HiTODS / no H-I-J advancement** — the frozen families and the 18 HiTODS booleans stay deferred (Build 4); the 6 frozen-family new booleans are not designed in.
6. **Post-storage / display-only** — observations are about the MOVE, advisory, `authoritative: false`, never about the author, never a verdict (cdiscourse-doctrine §1, §10a). Route every `observationCode` through `gameCopy.toPlainLanguageOrSuppress`; unmapped codes suppressed.
7. **Deno Deploy is the MCP deploy mechanism** — the mcp-server is outside the Supabase GitHub integration; its deploy is a **manual Deno Deploy step** (the addendum §2 OPEN QUESTION is resolved by the prompt: Deno Deploy). Each card's deploy runbook names it. The Edge mirror auto-deploys on merge; until the operator redeploys the mcp-server, the new `booleanQuestion`s are not asked even though the Edge/client definitions are live. Deploy-bearing → GATE-C.
8. **No service-role in client; RLS untouched; THR-4** — no existing test relaxed; test count goes up.

### 7.3 Stack order (B → A → C → D → E → F → G)

Each card branches off the PRIOR card's branch (not main) so the shared files never conflict. **Shared files that EVERY family card touches (the conflict surface):**

- `src/features/nodeLabels/observationMapping/observationMappingRegistry.ts` — `OBSERVATION_MAPPING_ADOPTION_MANIFEST` count fields + any seeded single rules.
- `src/features/arguments/gameCopy.ts` — plain-language entries for each new `observationCode`.
- `__tests__/machineObservationRegistry.test.ts` — registry/per-family count assertions.
- `mcp-server/tests/familyRegistry.test.ts` / `familyRegistryInit.test.ts` — total-key-count assertions.
- `scripts/ops/sql/14-per-family-per-mode-signal-density.sql` — **hardcoded per-family `family_key_count`** (lines 59–63: A 16, C 17, D 19, E 16→note F/E, G 18). Each card bumps its family's count (+3) AND any mirror count test (per the "ops/sql dir has exact recursive .sql-count + per-family-count test" memory note — confirm a mirror test exists and update it).
- `docs/core/current-status.md` — the H2 Phase-framing section + confirmed test count.

**Order rationale:** B first (template-setter, already scoped). Then A → C → D → E → F → G in the deployed-registry iteration order. Each card rebases on the prior so the manifest counts, gameCopy entries, registry-test counts, mcp-server key-count tests, and the SQL per-family counts accrete monotonically without merge conflicts. A card MUST NOT branch from main once a prior family card is in flight.

**Phase-framing handoff (between cards):** after each family ships, its `current-status.md` H2 section must carry the patterns the next card consumes (the rawKey convention used, the verdict-adjacency fence pattern if applied, the gameCopy entry shape, the seeded-vs-deferred mapping-row decision). Cross-check the H2 test count against `docs/reviews/<card>-review.md` (the POSTRUN-UX001 stale-baseline lesson).

### 7.4 Per-family Deno Deploy + hosted-smoke + admin-validation sign-off gate (GATE-C)

Each family card is deploy-bearing. Sign-off sequence (mirrors addendum §3 + the family-G N=56/0-dead-letter bar):

1. **Merge** → Edge classifier mirror auto-deploys (registered in `supabase/config.toml`).
2. **Manual Deno Deploy** of the mcp-server (the one manual step) so the new `booleanQuestion`s are actually asked.
3. **Hosted smoke** — synthetic run exercising each of the 3 new booleans; **zero terminal dead-letters** (mirror the family-G N=56 / 0-dead-letter bar).
4. **admin_validation audit + operator sign-off** on the Admin → Classifier Health surface BEFORE the new booleans are trusted on the production card surface (all six families are `adminValidationEnabled: true`, so new booleans run admin-validation-first).
5. **Verdict-adjacent booleans (A1, C3, E3, F3)** additionally pass the **5-layer defense**: system-prompt doctrine block · per-key `falsePositiveGuards` · ban-list scan (word-boundary) · adversarial fixtures · live smoke audit.
6. **A2 reliability gate** — `compares_parent_to_sibling_branch` must clear the admin_validation precision check; defer (ship A 2/3) if noisy.

---

## 8. Per-family 3-boolean partition (compact table)

| Family | Deployed name | 3 new rawKeys | Verdict-adjacency |
|---|---|---|---|
| A | parent_relation | `acknowledges_parent_strength`, `compares_parent_to_sibling_branch`, `identifies_parent_scope_limit` | A1 **Y** · A2 N (reliability-flag) · A3 N |
| C | misunderstanding_repair | `offers_repair_path`, `names_ambiguity_source`, `accepts_correction` | C1 N · C2 N · C3 **Y** |
| D | evidence_source_chain | `names_method_difference`, `separates_observation_from_inference`, `flags_context_limit` | D1 N · D2 N · D3 N |
| E | argument_scheme | `linked_premise_structure`, `convergent_premise_structure`, `enthymeme_gap_detected` | E1 N · E2 N · E3 **Y** |
| F | critical_question | `question_names_uncertainty`, `question_separates_claim_evidence`, `question_invites_revision` | F1 N · F2 N · F3 **Y** |
| G | resolution_progress | `records_remaining_disagreement`, `defines_next_evidence_needed`, `separates_normative_from_empirical` | G1 N · G2 N · G3 N |

18 new booleans (3 × 6) + Family B's 3 (Build 2a) = the ratified **21**. 4 verdict-adjacent (A1, C3, E3, F3) need the Family-B 5-layer defense + adversarial fixtures.

---

## 9. Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels / score never blocks):** all 18 booleans are move-pattern descriptions; the 4 verdict-adjacent ones are fenced to describe-the-move; all are post-storage, display-only, `engine.ts` untouched. ✓
- **cdiscourse-doctrine §3 / evidence-doctrine (popularity ≠ evidence):** Family D/G evidence-dynamic labels describe the move, never grant/deny factual standing (anti-amplification module untouched). ✓
- **cdiscourse-doctrine §4 (AI moderator limits):** observations advisory, `authoritative: false`; classification runs only in the Edge/MCP layer, never the client. ✓
- **cdiscourse-doctrine §9 (plain language):** every `observationCode` routes through `toPlainLanguageOrSuppress`; theory terms (linked/convergent/enthymeme) stay internal. ✓
- **cdiscourse-doctrine §10a (Observations vs Allegations):** all output is `machine_observation` (source: machine), about the MOVE; no raw classifier IDs surfaced; the 4 verdict-adjacent booleans get move-level-not-author adversarial fixtures. ✓
- **supabase-edge-contract:** no migration; key-value store accepts new rawKey values; no service-role in client; RLS untouched; merge=deploy for the Edge mirror, manual Deno Deploy for the mcp-server. ✓
- **test-discipline:** per-family parity + fixture + verdict-free (word-boundary) + adversarial + registry-count + schema-version-unchanged tests; test count up; THR-4 (no test relaxed). ✓

---

## 10. Operator steps

**None for this manifest** — it is design-only (one doc). Per family card (Build 2b–2g), after the implementer merges: the operator runs the **manual Deno Deploy of the mcp-server** (the single manual step), then signs off on the admin_validation audit at Admin → Classifier Health before the family's new booleans are trusted on the production card surface. No `npx supabase db push` is needed (no DDL).
