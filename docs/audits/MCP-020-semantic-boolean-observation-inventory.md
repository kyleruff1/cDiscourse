# MCP-020 — Semantic Boolean Observation Inventory

**Filed:** 2026-05-25
**Author:** roadmap-designer subagent (AUDIT mode)
**Status:** Audit complete; recommendation recorded
**Smoke input:** smoke deferred; MCP-020 proceeds against current vocabulary without first-contact input
**Adjacent cards:** consumes UX-001.5A (PR #299 at `154ca3f`) registry shape + MCP-019 dormant referee provider wiring (`docs/designs/MCP-019.md`)
**Operator authorization:** audit-mode subagent invocation; commits direct to `main` per prompt; no implementation
**Predecessor exemplar:** `docs/audits/UX-001.5A-source-access-audit.md` (commit `e477fa8`)

---

## Why this audit exists

The dormant MCP slot in the semantic-referee Edge Function path can return *named boolean observations* about a posted move (e.g. "this move asks for clarification" → `true`/`false`). MCP-019 wired the provider abstraction; UX-001.5A wired a Machine Observation registry that consumes named classifier IDs through an adapter-with-empty-fallback. The Source-6 future_source seam (`adaptRawClassifierBinarySource(...) → []` in `src/features/nodeLabels/nodeLabelSourceAdapters.ts`) is the destination the MCP server's output ultimately lands in. The current 25 AI-classifier entries in `machineObservationRegistry.ts` are the v1 vocabulary surface — every one carries `disposition: 'future_source'`. **MCP-021 will curate the first batch the MCP server is wired to actually answer.** MCP-020 is the upstream research card that produces the option set MCP-021 chooses from.

The card is non-implementing by construction. No code change, no test, no migration, no Edge Function deploy. The deliverable is one research document committed direct to `main` so MCP-021 has a single anchored reference when it selects which keys the live MCP server will support. The output is grouped by classifier family and graded against `cdiscourse-doctrine` §10a so the operator never has to re-walk the doctrine boundary at curation time.

The investigation was run in audit-mode after first-contact smoke was deferred. Bot rooms were seeded (13 rooms / 166 moves across two annotated runs on 2026-05-25), but operator-led Phase 2-4 first-contact observation against the seeded rooms did not run, so no confusion log exists to anchor "what's missing" against real user gap-finding. The first-batch recommendation in §"First-batch recommendation" carries elevated operator-review weight as a result — the curation at MCP-021 is the load-bearing decision, not the designer-default proposed here.

---

## Phase A — Current vocabulary inventory

All 75 currently-registered keys (65 Machine Observations + 10 User Allegations). Sources verified by direct read of `src/features/nodeLabels/machineObservationRegistry.ts` (commit `069270b`) and `src/features/nodeLabels/userAllegationRegistry.ts` (commit `069270b`); contents cross-checked against `docs/designs/UX-001.5A.md` §4 and §5.

### Scope-reality reconciliation (per `roadmap-designer` §"Scope-reality audit rule")

| Claim source | Stated count | Actual count | Note |
|---|---|---|---|
| Prompt forecast | 16 + 19 + 25 + 5 + 10 = **75** | 16 + 19 + 25 + 5 + 10 = **75** | Aggregate matches |
| `machineObservationRegistry.ts` module header (line 4-5) | "64 entries — 16 auto-metadata + 18 lifecycle + 25 AI classifier + 5 sensitive composer-only" | 16 + 19 + 25 + 5 = **65** entries | **Stale header comment.** Lifecycle entry count is 19 (not 18); `archived_or_resolved` is the 19th. The design doc at `docs/designs/UX-001.5A.md` §4.5 (line 419) says 64; current-status.md line 1620 says "65 entries (16 auto + 19 lifecycle + 25 AI classifier + 5 sensitive)" and footnotes the off-by-one explicitly (line 1683-1687). The implementer caught and corrected the design's arithmetic — registry ships 65, design doc was updated downstream. **No live drift; doc lineage tracks the fix.** |
| `docs/designs/UX-001.5A.md` §4.5 (line 419) | "16 + 18 + 25 + 5 = **64**" | 65 (per `current-status.md` line 1620 + per registry source) | Design's pre-implementation forecast undercounted lifecycle by 1. Implementer notes added at design §19 (`current-status.md` line 1683-1687). |

Net: actual registry is **75 total**. The header comment in `machineObservationRegistry.ts` is stale and should be corrected to "65 entries — 16 auto-metadata + 19 lifecycle + 25 AI classifier + 5 sensitive" when an adjacent card next touches that file (out of scope for MCP-020). No HALT (Stop Condition 1): contents are exactly as the live downstream doc lineage describes; the only drift is a single comment one line off in the source file, with no functional impact (the registry build sums all four arrays).

### A.1 Auto-metadata entries (16; source: `auto_metadata`)

Plain labels routed through `getAutoMetadataPlainLabel` (META-001 ban-list-clean). All 16 have `kind: 'machine_observation'`, `source: 'auto_metadata'`, `disposition: 'rendered_now'` or `'inspect_only'`.

| # | raw_key | source_category | disposition | label | one-sentence interpretation | accretion-or-deliberate |
|---|---|---|---|---|---|---|
| 1 | `has_reply` | auto_metadata | inspect_only | Has a reply | Any reply (regardless of type) exists. | Deliberate (META-001 §5; tracking presence-only signal). |
| 2 | `has_rebuttal` | auto_metadata | rendered_now | Has a challenge | A rebuttal-type reply exists. | Deliberate (META-001 §5; surfaces "this move is being pushed back on"). |
| 3 | `has_counter_rebuttal` | auto_metadata | rendered_now | Has a counter-challenge | The rebuttal itself has been countered. | Deliberate (META-001 §5; one-step-deeper depth signal). |
| 4 | `has_evidence` | auto_metadata | rendered_now | Evidence attached | At least one evidence artifact is attached. | Deliberate (META-001 §5; primary "this is sourced" indicator). |
| 5 | `source_requested` | auto_metadata | rendered_now | Source requested | A `needs_source` tag or `ask_source` action exists on this move. | Deliberate (META-001 §5). |
| 6 | `quote_requested` | auto_metadata | rendered_now | Quote requested | A `needs_quote` tag or `ask_quote` action exists on this move. | Deliberate (META-001 §5). |
| 7 | `source_attached` | auto_metadata | rendered_now | Source attached | A source artifact (URL / file) is attached. | Deliberate (META-001 §5; pairs with #5). |
| 8 | `quote_attached` | auto_metadata | rendered_now | Quote attached | A direct quote artifact is attached. | Deliberate (META-001 §5; pairs with #6). |
| 9 | `participant_skipped_node` | auto_metadata | inspect_only | Same side skipped | The poster's own side has moved on without responding to this node. | Deliberate (META-001 §5; lifecycle-adjacent skipped indicator). |
| 10 | `no_response_after_n_turns` | auto_metadata | rendered_now | No follow-up yet | N turns have elapsed with no reply. | Deliberate (META-001 §5; advisory). |
| 11 | `repeated_axis_pressure` | auto_metadata | rendered_now | Repeated challenge on same axis | The same disagreement axis has been pressured multiple times. | Deliberate (META-001 §5; signals need to narrow or branch). |
| 12 | `branch_suggested` | auto_metadata | rendered_now | Branch suggested | Branch-creation suggestion is active. | Deliberate (META-001 §5). |
| 13 | `branch_created` | auto_metadata | rendered_now | Branch created here | A branch was actually created at this node. | Deliberate (META-001 §5; pairs with #12). |
| 14 | `point_stalled` | auto_metadata | rendered_now | Point stalled | No recent activity. | Deliberate (META-001 §5; complements lifecycle `exhausted`). |
| 15 | `point_exhausted` | auto_metadata | rendered_now | Point exhausted | No fresh angles remain. | Deliberate (META-001 §5; complements lifecycle `exhausted` cluster summary). |
| 16 | `synthesis_candidate` | auto_metadata | rendered_now | Synthesis candidate | This exchange is a candidate for synthesis. | Deliberate (META-001 §5; pairs with lifecycle `synthesis_ready`). |

### A.2 Lifecycle entries (19; source: `lifecycle`)

Plain labels routed through `getPointLifecyclePlainLabel` (LIFE-001 ban-list-clean). Two `rawKey` overlaps with `auto_metadata` (`source_requested`, `quote_requested`) — disambiguated by compound key `${source}:${rawKey}` in the registry. Lifecycle wins the dedupe priority tiebreak (per `nodeLabelPriorityModel.ts` `PRIORITY_BY_SOURCE` = 20 for lifecycle vs 30 for auto_metadata).

| # | raw_key | source_category | disposition | label | one-sentence interpretation | accretion-or-deliberate |
|---|---|---|---|---|---|---|
| 17 | `open` | lifecycle | inspect_only | Open for response | The cluster has no reply yet. | Deliberate (LIFE-001 union §80-99). |
| 18 | `answered` | lifecycle | inspect_only | Has a reply | The cluster has any reply. | Deliberate (LIFE-001). |
| 19 | `rebutted` | lifecycle | rendered_now | Under pressure | The cluster has an active challenge. | Deliberate (LIFE-001). |
| 20 | `clarified` | lifecycle | rendered_now | Clarified | A clarification has landed. | Deliberate (LIFE-001). |
| 21 | `sourced` | lifecycle | rendered_now | Source attached | A source has been attached in the cluster. | Deliberate (LIFE-001). |
| 22 | `quote_requested` | lifecycle | rendered_now | Quote requested | A direct quote has been requested. | Deliberate (LIFE-001; overlaps with auto_metadata #6). |
| 23 | `source_requested` | lifecycle | rendered_now | Source requested | A source has been requested. | Deliberate (LIFE-001; overlaps with auto_metadata #5). |
| 24 | `narrowed` | lifecycle | rendered_now | Narrowed | The claim has been narrowed. | Deliberate (LIFE-001). |
| 25 | `conceded` | lifecycle | rendered_now | Conceded by author | An explicit concession was offered. | Deliberate (LIFE-001; doctrine: concession is a scoring REPAIR, never a defeat — see `point-standing-economy`). |
| 26 | `confirmed` | lifecycle | rendered_now | Confirmed by other side | The other side confirmed this point. | Deliberate (LIFE-001). |
| 27 | `synthesis_ready` | lifecycle | rendered_now | Ready for synthesis | Cluster is synthesis-ready. | Deliberate (LIFE-001; pairs with auto_metadata #16). |
| 28 | `moved_on_by_affirmative` | lifecycle | inspect_only | Affirmative moved on | The affirmative cluster's pressure was not answered before that side moved on. | Deliberate (LIFE-001; labels a cluster, never a person — doctrine anchor `pointLifecycleModel.ts:75-78`). |
| 29 | `moved_on_by_negative` | lifecycle | inspect_only | Negative moved on | Same as #28 for the negative side. | Deliberate (LIFE-001). |
| 30 | `ignored_by_affirmative` | lifecycle | inspect_only | Affirmative did not respond | The affirmative cluster has an unanswered request. | Deliberate (LIFE-001; cluster-not-person doctrine). |
| 31 | `ignored_by_negative` | lifecycle | inspect_only | Negative did not respond | Same as #30 for the negative side. | Deliberate (LIFE-001). |
| 32 | `ignored_by_both` | lifecycle | rendered_now | Nobody followed up | Both sides have unanswered requests on the cluster. | Deliberate (LIFE-001). |
| 33 | `exhausted` | lifecycle | rendered_now | Out of new angles | Cluster is exhausted of fresh angles. | Deliberate (LIFE-001; pairs with auto_metadata #15). |
| 34 | `branch_recommended` | lifecycle | rendered_now | Branch suggested | Branching is recommended. | Deliberate (LIFE-001; cluster-level twin of auto_metadata #12). |
| 35 | `archived_or_resolved` | lifecycle | inspect_only | Resolved | Cluster is archived or resolved. | Deliberate (LIFE-001 19th value; the off-by-one the implementer caught at UX-001.5A — see scope-reality reconciliation above). |

### A.3 AI-classifier entries (25; source: `ai_classifier`)

**Every entry carries `disposition: 'future_source'`** — adapter `adaptRawClassifierBinarySource(...)` returns `[]` unconditionally; presentation model's surface filter also excludes `future_source`. The slot exists for the reviewer mechanical check (every classifier ID accounted for) and for forward compatibility once an MCP server actually returns these. **These 25 are the most important inventory rows for MCP-020 / MCP-021** — they are the existing namespace MCP-021 will curate from + extend with the new candidates from Phase C.

Documented derivation source for all 25: roadmap §"Initial Machine Observation mapping" lines 142-168 (per `docs/designs/UX-001.5A.md` §4.3, line 343-344). The implementer added them verbatim from the roadmap doc; the roadmap was operator-authored. **None of the 25 were accreted in the implementation phase without doc-source backing.**

| # | raw_key | source_category | disposition | label | one-sentence interpretation | accretion-or-deliberate |
|---|---|---|---|---|---|---|
| 36 | `introduces_new_issue` | ai_classifier | future_source | Side issue | Move introduces a new sub-axis. | Deliberate (roadmap §"Initial Machine Observation mapping" line 143). |
| 37 | `quote_anchors_parent` | ai_classifier | future_source | Anchored reply | Reply is anchored to a parent quote. | Deliberate (roadmap §143). |
| 38 | `requests_clarification` | ai_classifier | future_source | Clarification asked | Move requests a clarification. | Deliberate (roadmap §143). |
| 39 | `answers_clarification` | ai_classifier | future_source | Clarification answered | Move answers a prior clarification request. | Deliberate (roadmap §143). |
| 40 | `asks_for_evidence` | ai_classifier | future_source | Evidence requested | Move requests evidence. | Deliberate (roadmap §143). |
| 41 | `provides_evidence` | ai_classifier | future_source | Evidence provided | Move provides evidence. | Deliberate (roadmap §143). |
| 42 | `evidence_supports_claim` | ai_classifier | inspect_only | Evidence matched to claim | Provided evidence supports the named claim (inspect-only as a softer disposition). | Deliberate (roadmap §143). |
| 43 | `creates_source_chain_gap` | ai_classifier | future_source | Source gap | Move opens a gap in the source chain. | Deliberate (roadmap §143). |
| 44 | `narrows_claim` | ai_classifier | future_source | Claim narrowed | Move narrows the claim's scope. | Deliberate (roadmap §143). |
| 45 | `concedes_narrow_point` | ai_classifier | future_source | Narrow concession | Move concedes a narrow point while preserving broader frame. | Deliberate (roadmap §143; pairs with `point-standing-economy` doctrine). |
| 46 | `ready_for_synthesis` | ai_classifier | future_source | Synthesis ready | Exchange is ready for synthesis. | Deliberate (roadmap §143; AI twin of lifecycle #27). |
| 47 | `suggests_side_branch` | ai_classifier | future_source | Side branch suggested | Move suggests a side branch. | Deliberate (roadmap §143). |
| 48 | `suggests_diagonal_tangent` | ai_classifier | future_source | Tangent branch suggested | Move suggests a tangent branch. | Deliberate (roadmap §143). |
| 49 | `disputes_evidence_applicability` | ai_classifier | future_source | Evidence applicability challenged | Move disputes whether the cited evidence applies. | Deliberate (roadmap §143). |
| 50 | `references_prior_agreement` | ai_classifier | future_source | Prior agreement referenced | Move references a prior agreement in the room. | Deliberate (roadmap §143). |
| 51 | `provides_temporal_constraint` | ai_classifier | future_source | Time boundary | Move introduces a time boundary. | Deliberate (roadmap §143). |
| 52 | `accepts_partial_with_caveat` | ai_classifier | future_source | Partial acceptance | Move accepts part of a claim with a caveat. | Deliberate (roadmap §143). |
| 53 | `provides_alternate_interpretation` | ai_classifier | future_source | Alternate reading | Move offers an alternate reading. | Deliberate (roadmap §143). |
| 54 | `opens_evidence_debt_marker` | ai_classifier | future_source | Evidence debt opened | Move opens an evidence debt. | Deliberate (roadmap §143; pairs with `evidence-doctrine`). |
| 55 | `closes_evidence_debt_marker` | ai_classifier | future_source | Evidence debt answered | Move closes an evidence debt. | Deliberate (roadmap §143). |
| 56 | `supplies_corroborating_document` | ai_classifier | future_source | Corroborating document | Move provides corroborating documentation. | Deliberate (roadmap §143). |
| 57 | `introduces_sub_axis` | ai_classifier | future_source | Sub-axis opened | Move opens a sub-axis under the current axis. | Deliberate (roadmap §143). |
| 58 | `concedes_with_new_dispute` | ai_classifier | future_source | Concession plus new dispute | Move concedes one point but opens another. | Deliberate (roadmap §143). |
| 59 | `proposes_settlement_terms` | ai_classifier | future_source | Settlement proposed | Move proposes settlement terms. | Deliberate (roadmap §143). |
| 60 | `accepts_settlement_terms` | ai_classifier | future_source | Settlement accepted | Move accepts proposed settlement. | Deliberate (roadmap §143). |

### A.4 Sensitive composer-only entries (5; source: `semantic_referee`)

All five have `source: 'semantic_referee'`. Entries 61-63 carry `disposition: 'composer_only'` (the canonical 3 sensitive IDs). Entries 64-65 carry `disposition: 'inspect_only'` (popularity/satire-as-evidence). **All 5 stay as-is — MCP-020 does NOT propose modifications to any of them.** Documented in `docs/designs/UX-001.5A.md` §4.4.

| # | raw_key | source_category | disposition | label | one-sentence interpretation | accretion-or-deliberate |
|---|---|---|---|---|---|---|
| 61 | `shifts_to_person_or_intent` | semantic_referee | composer_only | Person / intent shift | Move shifts focus from the claim to the poster or their intent. | Deliberate (roadmap §"Sensitive Machine Observations" lines 170-178). |
| 62 | `contains_unplayable_insult_only` | semantic_referee | composer_only | No playable claim | Move is insult-only with no playable claim. | Deliberate (roadmap §170-178). |
| 63 | `needs_pre_send_pause` | semantic_referee | composer_only | Pause suggested | Move would benefit from a pause before sending. | Deliberate (roadmap §170-178). |
| 64 | `uses_popularity_as_evidence` | semantic_referee | inspect_only | Popularity used as support | Move uses popularity as a substitute for evidence. | Deliberate (`cdiscourse-doctrine` §3 anti-amplification anchor). |
| 65 | `uses_satire_as_evidence` | semantic_referee | inspect_only | Satire used as support | Move uses satire as evidence. | Deliberate (`cdiscourse-doctrine` adjacent — protects against weaponizing satire). |

### A.5 User-allegation entries (10; source: `manual_tag`)

Plain labels routed through `getManualTagPlainLabel` (META-001 ban-list-clean). All 10 have `kind: 'user_allegation'`, `source: 'manual_tag'`, `disposition: 'rendered_now'`. **MCP-020 proposes no changes to this registry** — User Allegations are participant-authored, MCP server has no business proposing them, and the MCP slot is exclusively a Machine Observation source.

| # | raw_key | source_category | disposition | label | one-sentence interpretation | accretion-or-deliberate |
|---|---|---|---|---|---|---|
| 66 | `needs_source` | manual_tag | rendered_now | Needs source | Participant flags the move as needing a source. | Deliberate (META-001 §"Manual Tag vocabulary"). |
| 67 | `needs_quote` | manual_tag | rendered_now | Needs quote | Participant flags the move as needing a direct quote. | Deliberate (META-001). |
| 68 | `definition_issue` | manual_tag | rendered_now | Definition fight | Participant flags a definition dispute. | Deliberate (META-001). |
| 69 | `scope_issue` | manual_tag | rendered_now | Scope challenge | Participant flags a scope challenge. | Deliberate (META-001). |
| 70 | `causal_mechanism` | manual_tag | rendered_now | Mechanism challenge | Participant flags a mechanism challenge. | Deliberate (META-001). |
| 71 | `evidence_debt` | manual_tag | rendered_now | Evidence debt | Participant flags the move as carrying evidence debt. | Deliberate (META-001; doctrine: never collapse with Machine Observation `opens_evidence_debt_marker` — both render distinctly per cdiscourse-doctrine §10a). |
| 72 | `concession_offered` | manual_tag | rendered_now | Concession offered | Participant marks the move as a concession. | Deliberate (META-001). |
| 73 | `narrowed_claim` | manual_tag | rendered_now | Narrowed claim | Participant marks the move as narrowing the claim. | Deliberate (META-001). |
| 74 | `tangent` | manual_tag | rendered_now | Tangent / side issue | Participant flags the move as a tangent. | Deliberate (META-001). |
| 75 | `ready_for_synthesis` | manual_tag | rendered_now | Ready for synthesis | Participant marks the cluster as synthesis-ready. | Deliberate (META-001). |

### A.6 Net inventory shape (used by Phase C as the additive baseline)

| Bucket | Count | Source | Disposition profile | Rendering today |
|---|---|---:|---|---|
| Auto-metadata | 16 | `auto_metadata` | 12 `rendered_now` + 2 `inspect_only` + 2 mixed | Renders live across Timeline / Selected / Inspect per disposition |
| Lifecycle | 19 | `lifecycle` | 11 `rendered_now` + 8 `inspect_only` | Renders live |
| AI-classifier | 25 | `ai_classifier` | 24 `future_source` + 1 `inspect_only` (#42) | Adapter returns `[]` — slot reserved for MCP-server output |
| Sensitive composer-only | 5 | `semantic_referee` | 3 `composer_only` + 2 `inspect_only` | Composer-only path lives via `RefereeBannerView.observationChips`; node-mount surfaces never receive them |
| User allegations | 10 | `manual_tag` | 10 `rendered_now` | Renders live |
| **Total** | **75** | | | |

The 25 AI-classifier slots are the **operative namespace** MCP-020 / MCP-021 work in. Phase C proposes additive candidates to extend the existing 25; MCP-021 picks the first batch and decides whether to keep, deprecate, or merge any of the 25 already there.

---

## Phase B — External literature synthesis

Decision-input synthesis only — six families relevant to a boolean-classifier vocabulary CDiscourse could host without violating §10a. Citations are inline where they shape a Phase C candidate; no bibliography section. The families overlap; the per-candidate `literature_source` column in §C attributes the strongest single source. Sources consulted via WebFetch were rare — most synthesis came from prior domain knowledge already encoded in `evidence-doctrine`, `point-standing-economy`, and the existing 25 AI-classifier registry entries (which themselves are descended from the same literature). The work below is summary, not novel research.

### B.1 Argument mining / structural classification

Argument mining (Habernal & Gurevych 2017 *Computational Linguistics*; Stab & Gurevych 2017; IBM Project Debater) produces structural labels: claim vs. premise; support vs. attack; argument-relation type (`undercut`, `rebut`, `support`); per-argument component role (`claim`, `evidence`, `concession`, `qualifier`). The literature is large and battle-tested; modern boolean classifiers achieve high accuracy on parent-relation labels in particular.

**What fits CDiscourse.** Parent-relation labels are the cleanest fit — "this move supports its parent", "this move attacks its parent", "this move refines its parent". These are structural facts about the move's relationship to the conversation, not judgments about correctness. They map cleanly to candidates in §C Family A (parent_relation). The roadmap's existing `quote_anchors_parent` (#37) is the first member of this family.

**What does NOT fit.** Many argument-mining labels degrade into quality assessment ("strong premise", "weak claim", "fallacious") — those collapse with strength bands and would be a §10a violation. The "warrant-strength" / "premise-quality" labels common in academic argument-quality scoring are explicitly rejected (see §"Rejected labels"). CDiscourse renders strength as gameplay analysis through the Constitution + point-standing economy, not as a boolean labeled "weak argument".

### B.2 Walton-style argumentation schemes

Walton (2008, *Argumentation Schemes*) catalogues ~60 named schemes — argument-from-expert-opinion, argument-from-analogy, argument-from-sign, argument-from-cause-to-effect, practical reasoning, argument-from-lack-of-knowledge, argument-from-commitment, slippery slope, argument-from-example, argument-from-classification. Each scheme has critical questions whose unanswered status signals weakness (the questions, not a verdict).

**What fits CDiscourse.** The structural "is this scheme present?" boolean is fine: "this move uses an expert-opinion appeal", "this move uses an analogy", "this move uses a cause-to-effect chain". These are descriptive of move shape, not evaluative. They map to §C Family F (argument_scheme). The CDiscourse twist: each present-scheme candidate must surface the corresponding critical question as the recommended next move (so the chip becomes actionable advisory, not just a tag).

**What does NOT fit.** "Argument-from-fallacy" / "ad-hominem-detected" / "straw-man-used" are scheme classifications that read as verdicts in user surfaces — they implicitly call the speaker wrong. CDiscourse cannot render them as Machine Observations even when an MCP classifier is highly confident. The sensitive composer-only IDs (#61 `shifts_to_person_or_intent`, #62 `contains_unplayable_insult_only`) already cover the soft case (composer-only, never on a target node). MCP-020 does NOT propose extending the sensitive set; that is Family G's province (see §"Explicitly out of scope").

### B.3 Toulmin model

Toulmin (1958, *The Uses of Argument*) defines six argument components: claim, grounds (data), warrant (the rule that licenses claim from grounds), qualifier (modal hedge like "probably"), rebuttal (exception conditions), backing (support for the warrant). The model is canonical in argumentation theory and gives clean structural distinctions.

**What fits CDiscourse.** `qualifier_hedge_present`, `backing_present`, `rebuttal_present` are structural shape facts. `hedged_claim` is a real signal (the move was qualified with "probably", "in most cases", etc.) that participants benefit from seeing — strong claims and hedged claims play differently in the game. Map to §C Family D (evidence_quality) and Family A (parent_relation, for rebuttal).

**What does NOT fit.** "Warrant-missing" as a Machine Observation reads like a verdict — it implies the argument is incomplete. The Constitution + point-standing economy already pressure unwarranted claims through the source-chain and evidence-debt mechanisms. MCP-020 does not need a separate "warrant-missing" classifier and would risk doctrine drift if it shipped one.

### B.4 ISO 24617-2 dialogue acts + communicative functions

ISO 24617-2 standardizes dialogue-act annotation across 10 dimensions including task, auto-feedback, allo-feedback, turn management, time management, discourse structuring, own communication management, partner communication management, social obligations management, contact management. Communicative functions inside the "Information-seeking" dimension include `set_question` / `propositional_question` / `check_question` / `choice_question`; inside "Action-discussion" they include `offer` / `promise` / `request` / `suggestion` / `address_request` / `accept_request`.

**What fits CDiscourse.** Information-seeking and action-discussion functions are clean structural classifications: "this move asks a check question", "this move makes a suggestion", "this move accepts a prior request". Map to §C Family C (misunderstanding_repair) and Family A (parent_relation). The existing `requests_clarification` (#38) / `answers_clarification` (#39) are ISO-flavored entries.

**What does NOT fit.** Many ISO categories are conversation-management housekeeping (turn-taking, contact management) that doesn't map to CDiscourse's persistent move stream — there's no "I'm about to take a turn" signal in a persisted timeline. Skip those.

### B.5 Conversation repair / misunderstanding (Schegloff/Sacks; Clark & Brennan grounding)

Schegloff & Sacks (1977, *Language*) formalized the repair organization of conversation: self-initiated self-repair (the speaker corrects themselves), self-initiated other-repair (the speaker asks for help correcting), other-initiated self-repair (the listener flags trouble and the speaker fixes it), other-initiated other-repair (the listener proposes a correction). Clark & Brennan (1991) added the grounding apparatus: candidate understandings ("Do you mean X?"), partial repeats, and explicit acknowledgments.

**What fits CDiscourse.** This family is *load-bearing* for CDiscourse — the platform's whole purpose is to handle disagreement-driven misunderstanding constructively. Candidate-understanding moves, partial-repeat moves, and grounding-question moves are first-class boolean classifications: "this move offers a candidate understanding of the parent", "this move asks 'do you mean X?'", "this move repeats part of the parent for confirmation". Map to §C Family C (misunderstanding_repair) — the family with the highest signal-to-noise ratio in the candidate inventory.

**What does NOT fit.** Repair organization includes some labels that read as criticism — "trouble source identified" implies the speaker made a mistake. Use the action ("repair offered", "candidate understanding given") rather than the diagnosis ("trouble source"). The action labels are descriptive; the diagnosis labels drift toward verdict.

### B.6 Agreement/disagreement + constructiveness corpora

Internet Argument Corpus (IAC, Walker et al. 2012), Yahoo News Annotated Comments Corpus (YNACC, Napoles et al. 2017), and follow-up work (e.g. SemEval-2019 Task 6 on offensive language; the constructiveness corpus from Napoles et al.) annotate disagreement type, agreement type, constructiveness, persuasiveness, off-topic, ad-hominem.

**What fits CDiscourse.** Agreement / disagreement type sub-distinctions (factual disagreement vs definitional disagreement vs scope disagreement vs value disagreement vs causal-mechanism disagreement vs evidence-quality disagreement) are structural and map to §C Family B (disagreement_axis). Concession-vs-narrowing-vs-synthesis sub-distinctions map to §C Family E (resolution_progress).

**What does NOT fit.** Constructiveness scoring, persuasiveness scoring, "off-topic" as a hard label, "ad-hominem-detected" as a hard label — all read as verdicts. The IAC labels for ad-hominem are explicitly behavioral attributions ("user is attacking") which collapse with §10a's person-not-claim boundary. CDiscourse uses the soft composer-only path (entries #61-63) instead.

---

## Phase C — Candidate inventory

54 candidates across six families A-F. Each row is a candidate for the MCP-021 curation — operator decides at MCP-021 which to land in the first batch, which to defer, which to drop. Doctrine risk is the load-bearing field — anything `high` is named here to be transparent about cost, but a `high`-risk candidate is unlikely to ship without a stronger rationale than this audit provides.

**Notation.**
- `proposed_surface` is a recommendation. The actual disposition lives in the registry; MCP-021 may downgrade `timeline_node` candidates to `inspect_only` or `future_source` based on first-batch capacity.
- `overlap_with_existing` cites the closest already-registered key from §A. When overlap is meaningful, the new candidate is either a sub-type of the existing or a complement (covers a different shape of the same phenomenon).
- `literature_source` cites the strongest single source from §B (B.1 = argument mining, B.2 = Walton schemes, B.3 = Toulmin, B.4 = ISO 24617, B.5 = repair/grounding, B.6 = IAC/YNACC).
- `boolean_question` is the exact yes/no the MCP server would answer for a given move. Designed to be answerable from move + parent move only (no broad context retrieval).

### C.1 Family A — `parent_relation` (10 candidates)

How the move relates to its parent. The most foundational family; every move has exactly one parent (except root claims).

| raw_key | proposed_label | boolean_question | family | proposed_surface | doctrine_risk | literature_source | overlap_with_existing |
|---|---|---|---|---|---|---|---|
| `supports_parent` | Supports parent | Does this move's substantive content support the parent's position? | A | timeline_node | low — structural, not evaluative | B.1 (argument mining: support/attack relation) | New family root; complements `quote_anchors_parent` (#37). |
| `attacks_parent` | Attacks parent | Does this move's substantive content attack the parent's position? | A | timeline_node | low — structural | B.1 | New family root; pairs with `has_rebuttal` (#2) and `rebutted` (#19). |
| `refines_parent` | Refines parent | Does this move accept the parent's core claim while modifying scope or qualification? | A | timeline_node | low — structural | B.1, B.3 (Toulmin qualifier) | Adjacent to `narrows_claim` (#44); refinement is broader (covers scope-tightening, qualifier-adding, condition-adding). |
| `parent_responsive` | Responds to parent | Does this move respond to the substantive content of the parent (vs replying to a sibling or jumping topic)? | A | inspect_only | low — structural | B.5 (grounding) | New; explicit responsiveness check. |
| `parent_quotes_directly` | Quotes parent | Does this move include a direct quotation from the parent's body? | A | inspect_only | low — structural | B.5 | Adjacent to `quote_anchors_parent` (#37); pure quotation-presence check. |
| `parent_paraphrases` | Paraphrases parent | Does this move paraphrase the parent's claim back before responding? | A | inspect_only | low — structural; signals good-faith grounding | B.5 | New; complements `parent_quotes_directly`. |
| `parent_acknowledges` | Acknowledges parent | Does this move explicitly acknowledge a point in the parent before responding? | A | timeline_node | low — structural | B.5 | New; high signal-to-noise for good-faith discourse. |
| `extends_parent` | Extends parent | Does this move accept the parent and extend it with new support or a related claim? | A | timeline_node | low — structural; same-side coalition signal | B.1 | New; complements `supports_parent`. |
| `challenges_parent_warrant` | Challenges parent's reasoning | Does this move challenge the inferential link between the parent's grounds and its claim (not the grounds themselves)? | A | timeline_node | medium — borderline structural / evaluative; sub-distinction from `attacks_parent` | B.3 (Toulmin warrant) | Adjacent to `attacks_parent`; sub-type for inference-vs-evidence-vs-claim attack. |
| `challenges_parent_grounds` | Challenges parent's evidence | Does this move challenge the evidence the parent relies on (vs the inference or the claim)? | A | timeline_node | medium — borderline | B.3 | Sub-type of `attacks_parent`. |

### C.2 Family B — `disagreement_axis` (10 candidates)

Sub-types of disagreement. The §D structural recommendation governs whether these render on Timeline or Inspect-only.

| raw_key | proposed_label | boolean_question | family | proposed_surface | doctrine_risk | literature_source | overlap_with_existing |
|---|---|---|---|---|---|---|---|
| `disagreement_present` | Disagreement | Does this move express disagreement with the parent? | B | timeline_node | low — structural; the umbrella signal | B.6 (IAC) | Umbrella over the sub-types below; pairs with `attacks_parent` (Family A). Adjacent to `has_rebuttal` (#2) which is post-hoc evidence; `disagreement_present` is move-intrinsic. |
| `disagreement_factual` | Factual disagreement | Does this move dispute a factual claim in the parent? | B | timeline_node (per §D option) | low — structural | B.6 | Sub-type of `disagreement_present`. Adjacent to user-allegation `causal_mechanism` (#70). |
| `disagreement_definitional` | Definition dispute | Does this move dispute the parent's definition of a key term? | B | timeline_node (per §D option) | low — structural | B.6 | Adjacent to user-allegation `definition_issue` (#68); the AI version. |
| `disagreement_scope` | Scope dispute | Does this move dispute the parent's scope (over-generalization, hidden cases, edge cases)? | B | timeline_node (per §D option) | low — structural | B.6 | Adjacent to user-allegation `scope_issue` (#69). |
| `disagreement_value` | Value disagreement | Does this move disagree with the parent based on a value claim (vs a factual or definitional claim)? | B | timeline_node (per §D option) | medium — value-talk in user surfaces can drift toward identity; needs careful copy | B.6 | New; the value-axis disagreement type. |
| `disagreement_causal` | Causal dispute | Does this move dispute the parent's causal mechanism or causal direction? | B | timeline_node (per §D option) | low — structural | B.6 | Adjacent to user-allegation `causal_mechanism` (#70). |
| `disagreement_evidence_quality` | Evidence-quality dispute | Does this move dispute the quality of the parent's evidence (without disputing the underlying fact)? | B | timeline_node (per §D option) | low — structural | B.1, B.6 | Adjacent to `disputes_evidence_applicability` (#49); sub-distinction (quality vs applicability). |
| `disagreement_evidence_applicability` | Evidence-applicability dispute | Does this move dispute whether the parent's evidence actually supports the claim being made? | B | timeline_node (per §D option) | low — structural | B.1 | Substantially the same shape as existing #49 `disputes_evidence_applicability`. **Defer / merge candidate at MCP-021** — likely duplicates #49 with a clearer name. |
| `disagreement_priority` | Priority disagreement | Does this move agree the parent's claim is true but argue it's the wrong thing to focus on? | B | timeline_node (per §D option) | medium — borderline structural; can read as dismissive | B.6 | New. |
| `disagreement_mixed_with_partial_agreement` | Mixed agreement | Does this move both agree with part of the parent and disagree with another part? | B | timeline_node (per §D option) | low — structural; the most productive disagreement shape | B.6 (mixed agreement is a YNACC bucket) | Adjacent to `accepts_partial_with_caveat` (#52); the mixed-agreement umbrella. |

### C.3 Family C — `misunderstanding_repair` (9 candidates)

The conversation-repair family. Highest signal-to-noise ratio in the candidate set per Phase B.5.

| raw_key | proposed_label | boolean_question | family | proposed_surface | doctrine_risk | literature_source | overlap_with_existing |
|---|---|---|---|---|---|---|---|
| `requests_clarification_present` | Clarification asked | Does this move ask the parent's poster to clarify a specific point? | C | timeline_node | low — structural | B.5, B.4 | Duplicates existing #38 `requests_clarification`. **Merge candidate at MCP-021.** Listed here for completeness — would NOT ship; flag noted. |
| `offers_candidate_understanding` | "Do you mean X?" | Does this move offer a paraphrase of the parent's claim for confirmation ("Do you mean X?")? | C | timeline_node | low — structural; high signal of good faith | B.5 (Clark & Brennan candidate understanding) | New. Distinct from `requests_clarification` — this offers a specific reading rather than asking a question. |
| `offers_partial_repeat` | Partial repeat | Does this move repeat part of the parent's exact wording to confirm understanding of that part? | C | inspect_only | low — structural | B.5 | New. Often co-occurs with a follow-up clarification request. |
| `confirms_understanding` | Confirms understanding | Does this move explicitly confirm the previous candidate-understanding offer (or a previous paraphrase)? | C | timeline_node | low — structural | B.5 | New. Completes the candidate-understanding repair pair. |
| `requests_specific_clarification` | Asks for specific clarification | Does this move ask the parent to clarify a *specific identified point* (rather than asking a general clarification)? | C | inspect_only | low — structural | B.5 | New; sub-type of `requests_clarification` (#38). |
| `flags_potential_misreading` | Possible misreading | Does this move flag that the parent may have misread the grand-parent? | C | inspect_only | medium — could read as accusation if phrased poorly; copy must be careful | B.5 | New. Useful but doctrine-sensitive — surfaces only with neutral copy ("This may be a different reading of [grandparent]."). |
| `self_initiates_self_repair` | Speaker corrects self | Does this move correct or amend the speaker's own prior move? | C | timeline_node | low — structural; signals epistemic humility | B.5 (self-initiated self-repair) | New. Distinct shape from concession — speaker fixing their own claim, not yielding to the other side. |
| `requests_concrete_example` | Asks for an example | Does this move ask the parent to provide a concrete example? | C | timeline_node | low — structural | B.4 | New. Common repair move; pairs with `provides_alternate_interpretation` (#53). |
| `offers_concrete_example` | Provides an example | Does this move provide a concrete example to illustrate the parent's claim or the speaker's prior claim? | C | inspect_only | low — structural | B.4 | New. Pairs with `requests_concrete_example`. |

### C.4 Family D — `evidence_quality` (8 candidates)

Structural evidence properties. These are observable in the move text + attached artifacts; no judgment on whether the evidence is "good" — just structural shape facts.

| raw_key | proposed_label | boolean_question | family | proposed_surface | doctrine_risk | literature_source | overlap_with_existing |
|---|---|---|---|---|---|---|---|
| `cites_primary_source` | Primary source cited | Does the move cite a primary source (vs secondary / summary / aggregator)? | D | inspect_only | low — structural | B.1, `evidence-doctrine` source-trail buckets | New; complements `has_evidence` (#4) and `sourced` (#21) with primary/secondary distinction. |
| `cites_secondary_source` | Secondary source cited | Does the move cite a secondary source (review article, summary, news report of primary)? | D | inspect_only | low — structural | `evidence-doctrine` | New. |
| `cites_expert_attribution` | Expert attribution | Does the move cite a named expert or expert body as a source? | D | inspect_only | low — structural | B.2 (Walton expert opinion) | New; complements `provides_evidence` (#41). |
| `cites_anecdote` | Anecdotal evidence | Does the move use an anecdote as evidence (vs a study, dataset, or quoted source)? | D | inspect_only | medium — anecdotes are legitimate evidence in some debates; copy must not imply weakness | B.6 | New. The chip should NOT score-degrade; surfaces the shape only. |
| `scope_narrowed_explicitly` | Scope narrowed | Does the move explicitly state a scope condition for its claim ("under condition X")? | D | timeline_node | low — structural; positive signal | B.3 (Toulmin qualifier) | Adjacent to `narrows_claim` (#44) and lifecycle `narrowed` (#24); this is the move-intrinsic check at posting time. |
| `qualifier_hedge_present` | Hedged claim | Does the move use a probabilistic hedge ("probably", "in most cases", "tends to")? | D | inspect_only | low — structural | B.3 (Toulmin qualifier) | New. |
| `evidence_recency_stated` | Evidence date stated | Does the move state when the cited evidence was produced or last updated? | D | inspect_only | low — structural | `evidence-doctrine` | New. |
| `source_location_specific` | Source location specific | Does the move cite a specific page / paragraph / timestamp in the source (vs the whole source)? | D | inspect_only | low — structural | `evidence-doctrine` | New. Adjacent to `quote_anchors_parent` (#37) but for the cited source, not the parent move. |

### C.5 Family E — `resolution_progress` (8 candidates)

Standing and closing signals. These complement the lifecycle (Source 3) family by surfacing per-move signals before the cluster-level lifecycle has stabilized.

| raw_key | proposed_label | boolean_question | family | proposed_surface | doctrine_risk | literature_source | overlap_with_existing |
|---|---|---|---|---|---|---|---|
| `narrow_concession_present` | Narrow concession | Does this move concede a narrow point while preserving the broader frame? | E | timeline_node | low — structural; the point-standing economy's primary repair shape | `point-standing-economy` doctrine | Duplicates existing #45 `concedes_narrow_point`. **Merge candidate at MCP-021.** |
| `broad_concession_present` | Broad concession | Does this move concede the broader frame (not just a narrow point)? | E | timeline_node | medium — broad concession in a live argument is a high-stakes signal; copy must not read as "loss" | `point-standing-economy` | New; distinct from #45. |
| `synthesis_proposed` | Synthesis proposed | Does this move propose a synthesis that combines parts of both sides? | E | timeline_node | low — structural | B.6 | New. Distinct from `ready_for_synthesis` (#46) which is a state, this is a move-intrinsic check. |
| `agreement_reached` | Agreement reached | Does this move explicitly state that the parties agree on this point now? | E | timeline_node | low — structural; positive signal | B.6 | New. |
| `axis_set_aside` | Axis set aside | Does this move explicitly say "let's set this axis aside for now"? | E | timeline_node | low — structural | B.6 | New; complements lifecycle `moved_on_by_*` (#28, #29). |
| `axis_escalated` | Axis escalated | Does this move escalate the disagreement axis (going deeper rather than wider)? | E | timeline_node | medium — "escalation" copy can read as criticism; needs neutral framing | B.6 | New. |
| `point_abandoned_by_speaker` | Speaker abandons point | Does the speaker explicitly abandon their own prior point in this move? | E | inspect_only | low — structural; signals epistemic humility | B.5 (self-initiated self-repair) | Adjacent to `self_initiates_self_repair` (Family C); this one focuses on the abandonment specifically. |
| `evidence_debt_acknowledged` | Evidence debt acknowledged | Does the move acknowledge that the speaker owes evidence (without yet providing it)? | E | inspect_only | low — structural; positive signal of good faith | `evidence-doctrine` | New; complements `opens_evidence_debt_marker` (#54). |

### C.6 Family F — `argument_scheme` (9 candidates)

Walton schemes (the descriptive ones, not the fallacy diagnoses). Each ships with the relevant critical question as the recommended next move.

| raw_key | proposed_label | boolean_question | family | proposed_surface | doctrine_risk | literature_source | overlap_with_existing |
|---|---|---|---|---|---|---|---|
| `scheme_expert_opinion` | Expert-opinion appeal | Does the move appeal to a named expert's opinion as support? | F | inspect_only | low — structural; critical question = "is the expert qualified for this claim domain?" | B.2 (Walton expert opinion scheme) | New; complements `cites_expert_attribution` (Family D). |
| `scheme_analogy` | Analogy used | Does the move use an analogy as the primary support? | F | inspect_only | low — structural; critical question = "are there relevant disanalogies?" | B.2 (Walton analogy scheme) | New. |
| `scheme_sign` | Sign-based reasoning | Does the move use a "sign" (visible indicator → underlying state) as support? | F | inspect_only | low — structural | B.2 (Walton sign scheme) | New. |
| `scheme_cause_to_effect` | Cause-to-effect reasoning | Does the move argue a cause produces an effect (rather than vice versa)? | F | inspect_only | low — structural | B.2 | New; adjacent to user-allegation `causal_mechanism` (#70). |
| `scheme_practical_reasoning` | Practical reasoning | Does the move argue "we want goal G; action A would achieve G; so we should A"? | F | inspect_only | low — structural | B.2 | New. |
| `scheme_lack_of_knowledge` | Argument from ignorance | Does the move argue "we don't have evidence of X, therefore not X"? | F | inspect_only | medium — this scheme often signals weakness; copy must be neutral ("appeal to absence of evidence") | B.2 | New. The chip surfaces the shape; the critical question is "is absence of evidence here evidence of absence?". Borderline doctrine-risk: must not call the move wrong. |
| `scheme_commitment` | Commitment-based | Does the move argue "you previously committed to X; this entails Y"? | F | inspect_only | low — structural | B.2 | New. |
| `scheme_example_based` | Example-based | Does the move generalize from one or more concrete examples? | F | inspect_only | low — structural; pairs with `offers_concrete_example` (Family C) | B.2 | New. |
| `scheme_classification` | Classification-based | Does the move argue "X is a member of category C; C entails Y; so X entails Y"? | F | inspect_only | low — structural | B.2 | New. |

### C.7 Candidate count

10 (A) + 10 (B) + 9 (C) + 8 (D) + 8 (E) + 9 (F) = **54 candidates**. Below the 100-candidate halt threshold. Two candidates explicitly named as merge candidates with existing keys (`disagreement_evidence_applicability` ≈ #49, `requests_clarification_present` ≈ #38, `narrow_concession_present` ≈ #45) — those would not ship as new keys; operator decides at MCP-021 whether to keep the existing name or replace with the candidate name.

---

## Phase D — Disagreement-axis structural recommendation

Three options for how disagreement-axis sub-types render. Each has different doctrine-risk and product-clarity tradeoffs.

### D.1 Option 1 — Single umbrella `disagreement_present` on Timeline; sub-types Inspect-only

**Mechanism.** `disagreement_present` is the only Family B candidate on the Timeline. The seven sub-types (`disagreement_factual`, `disagreement_definitional`, `disagreement_scope`, `disagreement_value`, `disagreement_causal`, `disagreement_evidence_quality`, `disagreement_priority`) carry `disposition: 'inspect_only'`. The Timeline chip shows just "Disagreement" with a count of unresolved sub-types in the tooltip; Inspect surfaces the full sub-type list.

**Pros.**
- Lowest doctrine risk. The Timeline never shows a sub-type that could imply a taste judgment about which kind of disagreement is "real".
- Stays within the existing 1 Observation + 1 Allegation per Timeline node budget without forcing overflow.
- Easy to extend later (add a new sub-type to Inspect without changing Timeline behavior).
- The presentation model needs no priority tiebreak between sub-types (only the umbrella ever surfaces on Timeline).

**Cons.**
- Loses information density on the Timeline. A user skimming the timeline sees "Disagreement" everywhere disagreement exists; they have to open Inspect to see the disagreement axis.
- Doesn't help discoverability of `disagreement_mixed_with_partial_agreement` (the most productive shape) — it gets buried in Inspect alongside the others.

### D.2 Option 2 — Sub-types on Timeline with explicit priority order + 1-chip cap

**Mechanism.** All sub-types ship with `disposition: 'rendered_now'`. When multiple sub-types fire for the same move, the highest-priority sub-type wins the single Family B Timeline slot. Priority order (proposed): `disagreement_mixed_with_partial_agreement` > `disagreement_factual` > `disagreement_evidence_quality` > `disagreement_evidence_applicability` > `disagreement_definitional` > `disagreement_scope` > `disagreement_causal` > `disagreement_value` > `disagreement_priority`. Inspect shows all fired sub-types.

**Pros.**
- More information density on the Timeline. Power users can scan for "Definition fight" / "Scope fight" / "Mixed agreement" at a glance.
- Encourages the priority-ordered sub-type (`mixed_with_partial_agreement`) which is the most productive shape — surfacing it first reinforces good discourse.

**Cons.**
- **The priority order itself encodes a taste judgment.** Ranking "factual" above "value" implies one is more important than the other. Ranking "mixed agreement" first is a doctrinal claim that mixed agreement is the most productive shape — defensible but not neutral.
- The Constitution doesn't currently encode disagreement-axis priority; this would be a new ordered list maintained somewhere.
- A future operator who disagrees with the ordering has to file a new card to change it.

### D.3 Option 3 — Defer disagreement axis from any first batch entirely

**Mechanism.** Family B is removed from MCP-021's first-batch candidate set. The first batch ships parent_relation (Family A) + misunderstanding_repair (Family C) + resolution_progress (Family E) keys. Disagreement axis is observed indirectly through `attacks_parent` (Family A) and the user-allegation axis tags (`definition_issue`, `scope_issue`, `causal_mechanism`) that already exist. A later card files Family B once real user-confusion data (from a smoke run that actually happens, post-MCP-021) shows where users want disagreement-axis disambiguation.

**Pros.**
- Lowest doctrine risk of all three options.
- Doesn't lock in a priority order or an umbrella-vs-sub-type tradeoff that may need to be revisited.
- Lets MCP-021's first batch demonstrate Phase E (MCP output schema) on a less contested family first.

**Cons.**
- Disagreement axis is the most important *additive* family relative to what's already in the registry — punting it means MCP-021 ships less new product value.
- User-allegation axis tags require participant action; an MCP-generated axis chip would surface the axis without requiring a tag.

### D.4 Designer recommendation

**Recommend Option 1 (umbrella on Timeline; sub-types Inspect-only) for the first batch, with Option 2 as a deferred upgrade.**

**Reasoning.** The smoke deferral means there is no real user-confusion data to anchor "sub-types help discoverability". In the absence of that data, the lower-doctrine-risk Option 1 is the defensible default — it ships the disagreement-axis family, surfaces sub-types in Inspect (so the data is captured), and avoids encoding a priority order that may need to be revisited. Option 2 is the natural follow-up: once Option 1 has shipped and the operator has real timeline data showing which sub-types fire most often, the priority order can be encoded with confidence. Option 3 is the most conservative; defensible if the operator wants to ship MCP-021 with zero new families and re-evaluate against post-MCP-021 smoke data.

The operator decides at MCP-021 curation time. This recommendation is designer-default per Stop Condition note (no smoke validation).

---

## Phase E — MCP output schema

### E.1 Confirmed shape

The operator-proposed `SemanticBooleanFlagResult` shape is **confirmed verbatim** with two refinements documented in §E.2. The shape mirrors `SemanticRefereePacket` discipline (no verdict tokens at the type level; bounded confidence union; explicit provenance).

```typescript
// src/features/semanticReferee/semanticBooleanFlagResult.ts (proposed at MCP-021)

export interface SemanticBooleanFlagResult {
  /** Versioned schema marker. Cache key + parser route on this. */
  schemaVersion: 'semantic_boolean_flags.v1';

  /** The move being classified. */
  moveId: string;

  /** The move's parent (null when classifying a root claim). */
  parentMoveId: string | null;

  /** Per-classifier boolean assertions. Order is not significant. */
  flags: Array<{
    /** Registry key the server is answering for (e.g. `supports_parent`). */
    rawKey: SemanticBooleanClassifierId;
    /** The yes/no result. */
    present: boolean;
    /** Server's confidence band. Required (see §E.2 refinement 1). */
    confidence: 'low' | 'medium' | 'high';
    /** Optional supporting span from the move body. */
    evidenceSpan?: string;
    /** Optional supporting span from the parent body. */
    targetSpan?: string;
    /** Audit trail; NEVER rendered directly to users. Server may include
     *  a brief justification for operator review at the MCP-021 curation
     *  step. UI surfaces NEVER read this field. */
    rationaleForAudit?: string;
  }>;

  /** Provenance for cache invalidation and operator audit. */
  modelInfo: {
    provider: 'mcp';
    serverName: string;
    /** Pinned classifier-set version; cache key depends on this. */
    classifierSetVersion: string;
  };
}

/** Bounded union of the registry's MCP-eligible classifier IDs. The MCP
 *  server can only respond about IDs in this union; any unknown rawKey
 *  is dropped at the adapter boundary. The union ships in MCP-021 with
 *  exactly the first-batch keys. */
export type SemanticBooleanClassifierId = string; // narrowed in MCP-021
```

### E.2 Refinements

**Refinement 1 — `confidence` is required, not optional.** A bare `present: boolean` without a confidence band makes the downstream adapter unable to gate which booleans surface. MCP-019's existing `SemanticRefereePacket` requires confidence for the same reason. Server-side default should be `'medium'` when the server cannot honestly report a band — never silently omit.

**Refinement 2 — Per-call timeout + sanitization contract.** The wrapper that consumes `SemanticBooleanFlagResult` (presumably named `classifyBooleanFlags` or similar, parallel to MCP-019's `classifyMove`) must:
- Enforce a per-call timeout of 5 seconds (matching MCP-019's existing budget posture).
- Strip `evidenceSpan` and `targetSpan` of any pattern that matches `@handle`-shape, URL, email, JWT, Bearer, or 15-20 digit IDs — same pattern as MCP-019's `clientRedaction.ts`.
- Cap `evidenceSpan` and `targetSpan` at 240 characters (truncate with ellipsis). The UI surface (UX-001.5A registry tooltip) renders at most ~200 characters of description; longer spans add no value.
- Cap `flags.length` at 20. The first batch is 8-12 keys; future batches expand. A response with > 20 flags is presumed malformed and rejected (see failure-mode below).
- Cap `rationaleForAudit` at 500 characters and NEVER surface it in any user-facing render path. The adapter routes it to operator audit logs only.

**Refinement 3 — Discard rule for unknown `rawKey`.** If the MCP server returns a flag whose `rawKey` is not in `SemanticBooleanClassifierId`, the adapter drops it silently (never echoes the unknown key to a logged warning that could include user text). Matches the existing pattern in `nodeLabelSourceAdapters.ts` (`if (!registryEntry) continue; // Unknown code — drop, never echo`).

### E.3 Failure-mode contract

**Malformed MCP output → no chip emitted.** The failure mode is the same as the 2026-05-25 AI annotator run where the annotator's response failed validation 38/38 times and the deterministic fallback fired cleanly — the system continues, the UI is unaffected, and an operator log entry records the malformation count.

Specific failure cases the adapter must detect:
- Response is not valid JSON → drop entire response, emit zero chips for the move
- Response JSON does not match the `SemanticBooleanFlagResult` shape → drop, zero chips
- `schemaVersion` is missing or unrecognized → drop, zero chips
- `flags.length` > 20 → drop, zero chips
- Any individual flag fails shape validation → drop that flag, keep the rest
- Per-call timeout exceeded → drop, zero chips
- `present` field absent or non-boolean → drop that flag, keep the rest
- `rawKey` is not in the registry → drop that flag silently (never echo)
- `evidenceSpan` / `targetSpan` redaction-removes the entire string → drop the span field, keep the flag

Test pinning (proposed for MCP-021 implementer card):
- `__tests__/semanticBooleanFlagResultParser.test.ts` covers each failure case above with an explicit fixture.
- A `__tests__/semanticBooleanFlagResultDoctrine.test.ts` ban-list test scans every parsed flag's surfaces (label / shortLabel / description) for the standard verdict ban-list (winner / loser / liar / true / false / correct / dishonest / bad faith / etc.). The adapter must NEVER surface a flag whose registry entry violates the ban-list — this is a backstop against a future registry edit that accidentally lands a verdict token.
- A `__tests__/semanticBooleanFlagAdapter.test.ts` happy-path test verifies that a well-formed response produces the expected `NodeLabelMark[]` via the same adapter pattern as Sources 1-3.

### E.4 Caching contract

Cache key: `${moveId}:${classifierSetVersion}:${moveBodyContentHash}`. Parent body change does NOT invalidate the cache (the relationship to a specific parent is the question being answered; if the parent changes, the question is different and gets a fresh classification). Cache lifetime: room-session-scoped (matches MCP-019's `SemanticPacketCache` posture). Capacity: 256 (matches MCP-012's `DEFAULT_CACHE_CAPACITY`).

---

## First-batch recommendation

Designer-default, no smoke validation. **MCP-021 operator-review weight is elevated** per Stop Condition note. The first batch ships 10 keys grouped to give MCP-021 a coherent slice across three families (A parent_relation, C misunderstanding_repair, E resolution_progress). Family B (disagreement_axis) deferred per §D.4 (Option 1 / 3 hybrid: Family B umbrella is not in the first batch; revisit after first-batch smoke). Family D (evidence_quality) deferred — evidence quality is `inspect_only` heavy and adds complexity to the first batch; revisit when source-chain UX (Epic 6 follow-ups) is more mature. Family F (argument_scheme) deferred — Walton schemes are powerful but each one requires curated critical-question copy, which is a separate authoring effort.

| # | raw_key | family | proposed_surface | rationale |
|---|---|---|---|---|
| 1 | `supports_parent` | A | timeline_node | The foundational parent_relation classifier; pairs with #2 to cover the agree/disagree binary at move level. |
| 2 | `attacks_parent` | A | timeline_node | Foundational counterpart; required to complete #1's coverage. |
| 3 | `refines_parent` | A | timeline_node | The agree-and-extend variant; surfaces the productive middle case between #1 and #2. |
| 4 | `parent_acknowledges` | A | timeline_node | High signal of good-faith discourse; gives the timeline a positive structural marker. |
| 5 | `offers_candidate_understanding` | C | timeline_node | The single highest-signal repair move per Phase B.5 — "Do you mean X?" is what good-faith disagreement looks like. |
| 6 | `confirms_understanding` | C | timeline_node | Completes the candidate-understanding repair pair (pairs with #5). |
| 7 | `requests_concrete_example` | C | timeline_node | Common, high-signal repair move that pairs with the existing `requests_clarification` (#38). |
| 8 | `self_initiates_self_repair` | C | timeline_node | Epistemic-humility signal; distinct from concession; rare but high-value. |
| 9 | `narrow_concession_present` | E | timeline_node | The point-standing economy's primary repair shape. **Merge candidate with existing #45 `concedes_narrow_point`** — MCP-021 should keep one or the other; named here for completeness. |
| 10 | `synthesis_proposed` | E | timeline_node | The single highest-signal resolution-progress move; pairs with lifecycle `synthesis_ready` (#27). |

This is **10 keys** — within the operator's 8-12 range. Every key is `timeline_node` to maximize the visible product impact of the first MCP server wiring. All 10 are `low` doctrine risk per Phase C; none are sub-type-of-sub-type combinations that would force a priority-order decision. MCP-021 may swap individual keys for ones it prefers; the curation is the operator's call.

---

## Rejected labels

Labels surfaced by the literature in Phase B that fail CDiscourse's `cdiscourse-doctrine` §10a boundary and would NOT ship as Machine Observations regardless of MCP server capability. Listed with rejection rationale.

| Rejected key (sketch) | Source family | Why rejected |
|---|---|---|
| `fallacy_detected` (e.g. "appeal to authority detected", "slippery slope detected") | B.2 (Walton fallacy classifications) | "Fallacy" reads as verdict — implies the speaker reasoned incorrectly. Even when classifier confidence is high, the label collapses with §1 (no truth labels). The structural sibling (e.g. `scheme_lack_of_knowledge` in Family F) describes the SHAPE without naming it a fallacy. |
| `straw_man_used` | B.2, B.6 | Names a fallacy directly; same problem as `fallacy_detected`. Also implies bad faith. The repair move (`offers_candidate_understanding`, Family C) addresses the same dynamic constructively. |
| `ad_hominem_present` | B.6 | Names a fallacy + implies the speaker is attacking the person. The existing sensitive composer-only #61 `shifts_to_person_or_intent` already covers the soft case (composer-only, never on a target node). Surfacing `ad_hominem_present` on a target node would be an accusation. |
| `weak_argument` / `argument_quality_low` | B.1 (argument-quality scoring) | Quality scoring is explicit truth/strength labeling — collapses with strength bands. CDiscourse renders strength as gameplay analysis through the Constitution + point-standing economy; an independent "weak" boolean would create a second, conflicting strength signal. |
| `bad_faith_present` | B.6 (IAC constructiveness) | Attributes intent to the speaker. §10a (Observations vs Allegations) is explicit that no Observation may imply user intent. The user-allegation path exists for participants to flag intent perceptions; the MCP server may not. |
| `troll_pattern_detected` | B.6 | Person-attacking label (the entire CDiscourse-doctrine §1 ban list refuses "troll" as a user label). Hard reject. |
| `unconstructive` / `low_constructiveness` | B.6 (constructiveness corpora) | Constructiveness scoring is taste judgment that drifts toward verdict. The repair moves in Family C surface constructive shapes positively; an "unconstructive" label would punish-frame. |
| `winner` / `loser` | (none — explicitly banned in cdiscourse-doctrine §1) | Hard reject; would not appear in any literature-defensible classifier. Listed for completeness so MCP-021 reviewer can confirm explicitly. |
| `off_topic_hard` (as a hard verdict label) | B.6 | The existing soft path (`topic_satisfaction_lexical` is advisory; OFF_TOPIC is advisory per Stage 6.2's correction) is correct. A hard `off_topic` Observation would re-introduce the blocked-posting behavior Stage 6.2 explicitly removed. |
| `appeal_to_emotion` | B.2 | Names a Walton "fallacy" scheme; same rejection as `fallacy_detected`. Emotional argumentation can be legitimate; flagging the shape as if it's wrong is doctrine drift. |
| `dogwhistle_present` / `coded_language_used` | (proposed in some constructiveness work) | Requires cultural-context judgment the MCP can't reliably make; the false-positive cost is enormous (accusing speakers of bad faith based on ambiguous patterns). Hard reject. |

**At least 11 rejected labels** documented above; this is not exhaustive. The principle: any boolean classifier whose plain-English rendering would imply (a) the speaker is wrong, (b) the argument is weak, (c) the speaker is acting in bad faith, or (d) the argument fits a named fallacy is automatically rejected. The MCP server's confidence cannot rescue a verdict-flavored label.

---

## Explicitly out of scope

### Family G — constructiveness / conversation-health classifiers (DEFERRED to a dedicated future card)

Family G covers candidates like `temperature_rising`, `snark_present`, `identity_group_blame_shift`, `bridging_language_present`, `civility_violation`. These are **higher doctrine risk than Families A-F** because:

1. They make per-move judgments about *conversational health* rather than structural shape.
2. They risk implying that "civility" or "calm" are the standard CDiscourse holds users to — a value-laden product position that is not currently doctrine.
3. They overlap with the sensitive composer-only IDs (#61-63) but at a much broader scope than those three carefully-defined IDs.
4. They require careful copy authoring per candidate to avoid §10a violation — much more authoring effort than Families A-F.

**Family G is out of scope for MCP-020.** A dedicated follow-up audit (post-MCP-021 smoke) should evaluate whether constructiveness classifiers are appropriate for CDiscourse at all. The audit would need its own doctrine review separate from this audit's structural-classifier focus.

### Sensitive composer-only IDs preservation

The 5 existing sensitive composer-only entries (`shifts_to_person_or_intent`, `contains_unplayable_insult_only`, `needs_pre_send_pause`, `uses_popularity_as_evidence`, `uses_satire_as_evidence`) remain as they are. **MCP-020 does NOT propose:**
- Modifying any of the 5 entries
- Deprecating any of the 5 entries
- Extending the sensitive composer-only set (that is part of Family G's province per the above carve-out)
- Promoting any sensitive entry to a Timeline-node surface

### Other out-of-scope items

- No code change in this audit. No registry edit. No adapter edit. No test edit. No migration.
- No proposal to merge / deprecate existing keys without explicit operator review at MCP-021 (the named merge candidates in §C are flagged with "merge candidate at MCP-021" so the operator can choose).
- No new visual primitive proposal — UX-001.5/UX-001.7 token + primitive ceiling holds.
- No proposal to change the `AnnotationChipDescriptor` contract — MCP-020's keys ride the existing UX-001.5A adapter path.
- No proposal to enable the dormant MCP provider — `SEMANTIC_REFEREE_PROVIDER=mcp` remains operator-gated; MCP-020 is research only.
- No proposal to extend User Allegations (the 10-key registry is participant-authored and complete for v1).
- No proposal to backfill the existing 25 AI-classifier entries to `rendered_now` — they remain `future_source` per UX-001.5A binding until MCP-021 explicitly ships a first batch.

---

## Audit ledger

Per `roadmap-designer` §"Orchestrator-authored brief ledger", the following interpretive judgments are designer-default and flagged for operator review at MCP-021 curation time.

1. **`source-access-audit` skill is missing from the registered skill set.** The prompt referenced applying "the source-access-audit skill" but the registered skills (verified at `C:\Users\kyler\cdiscourse\debate-constitution-app\.claude\skills/`) include only the 14 skills listed in the system-reminder. The `source-access-audit` skill was a discussion item at the end of UX-001.5A as a future OPS-006-style promotion candidate but never landed. MCP-020 substituted the audit-mode protocol from `docs/audits/UX-001.5A-source-access-audit.md` (commit `e477fa8`) as exemplar — same author/structure pattern, applied to a different research question. **Recommendation:** the operator may file an OPS-006-style skill-promotion card to land `source-access-audit` as a registered skill once the second or third audit-mode card lands (so the pattern is established before formalizing). Not blocking for MCP-020.

2. **Scope-reality finding: registry header comment is stale.** `src/features/nodeLabels/machineObservationRegistry.ts` line 4-5 says "64 entries — 16 auto-metadata + 18 lifecycle + 25 AI classifier + 5 sensitive composer-only". Actual count is 65 (lifecycle is 19, not 18; `archived_or_resolved` is the 19th). Downstream docs (`current-status.md` line 1620, design doc §19 at lines 1683-1687) correctly track the 65 count. **No functional drift** — the build sums all four arrays. **Recommendation:** when an adjacent card next touches this file, correct the header comment. Out of scope for MCP-020.

3. **Smoke-deferral makes the first-batch recommendation designer-default, not user-validated.** No first-contact observation against the 13 seeded rooms / 166 moves from today's two annotated runs exists. The 10-key first batch in §"First-batch recommendation" is designer judgment from doctrine + literature + existing registry shape — not from observed user confusion. **Recommendation:** if MCP-021 has bandwidth to drive Phase 2-4 smoke before curating, the smoke output should override this audit's first-batch list. If smoke remains deferred, the operator carries the curation decision with elevated weight.

4. **Phase D recommendation is Option 1 (umbrella on Timeline; sub-types Inspect-only).** This is a defensible default in the absence of smoke data. Options 2 and 3 are documented so the operator has the full decision surface. **Recommendation:** if the operator has strong intuition from the seeded-rooms work that disagreement-axis sub-types are productively distinguishable in real conversations, Option 2 is defensible. If the operator wants the smallest possible first batch, Option 3 (defer Family B entirely) is defensible. The audit's recommendation is intermediate.

5. **Three merge-candidate keys flagged for operator review.** `disagreement_evidence_applicability` (§C.2) is substantially the same as existing #49 `disputes_evidence_applicability` (registered with a clearer name candidate). `requests_clarification_present` (§C.3) duplicates existing #38 `requests_clarification`. `narrow_concession_present` (§C.5) duplicates existing #45 `concedes_narrow_point`. **Recommendation:** at MCP-021 curation, the operator should choose for each pair whether to keep the existing name (preserve UX-001.5A's design lineage), replace with the new name (if the new name is clearer), or note it as already-covered (drop the new candidate). The first-batch recommendation includes `narrow_concession_present` as the more parseable name but flags it explicitly as a merge candidate.

6. **Family G constructiveness carve-out is binding for MCP-020.** No constructiveness-flavored classifier is in the candidate inventory. The operator may file a separate audit card for Family G once MCP-021 ships and the team has post-smoke data on whether constructiveness signals are needed. **Recommendation:** do NOT include constructiveness candidates in MCP-021's first batch even if the operator finds them appealing — they require their own doctrine review that this audit explicitly did not conduct.

7. **No doctrine drift detected in existing registry contents.** All 75 existing entries respect §10a; no verdict tokens; no person-attacking labels; sensitive IDs are composer-only; lifecycle labels describe clusters not persons. Stop Condition 2 (literature surfaces a doctrine CDiscourse violates) is CLEAN. The literature flagged a number of would-be classifiers that violate §10a, and the registry correctly already excludes all of them.

8. **No HALT triggered.** Stop Condition 1 (registry differs from design doc) is the one item that warranted spot-checking; reconciliation in §A above shows the design doc was corrected during UX-001.5A implementation and downstream docs (current-status.md) track the correction. Stop Condition 3 (context window > 70%) not reached. Stop Condition 4 (candidate count > 100) not reached — final count is 54.

9. **Recommended next action.** Operator reviews this audit. At MCP-021 curation time, operator (a) selects the first batch (the 10 designer-default keys + any additions/replacements), (b) decides Phase D structural option for disagreement axis (1/2/3), (c) confirms the MCP output schema (verbatim or refined), (d) resolves the three merge-candidate pairs, (e) authorizes implementation per the standard `roadmap-implementer` pipeline. MCP-021 implementation lands the first batch keys in `machineObservationRegistry.ts` with `disposition: 'rendered_now'`, wires the `SemanticBooleanFlagResult` adapter + parser + cache, adds the test suite per §E.3, and updates the doctrine ban-list test to include the new keys' surfaces.

---

## References

- Existing registry source (commit `069270b`): `src/features/nodeLabels/machineObservationRegistry.ts` (715 lines, 65 entries) + `src/features/nodeLabels/userAllegationRegistry.ts` (160 lines, 10 entries) + `src/features/nodeLabels/nodeLabelTypes.ts` (163 lines, type contracts)
- Existing adapter source (commit `069270b`): `src/features/nodeLabels/nodeLabelSourceAdapters.ts` — `adaptRawClassifierBinarySource(...)` is the destination Source-6 future_source seam MCP-020 informs
- UX-001.5A design doc (`docs/designs/UX-001.5A.md`, commit `154ca3f`) — §4.3 "AI classifier IDs (25 entries)" + §4.4 "Sensitive composer-only IDs (5 entries)" + §5 "userAllegationRegistry (10 entries)"
- UX-001.5A intent brief (`docs/designs/UX-001.5A-intent.md`, commit `a1a622b`) — operator-authored binding doctrine constraints
- UX-001.5A source-access audit (`docs/audits/UX-001.5A-source-access-audit.md`, commit `e477fa8`) — exemplar for this audit's structure; PASS verdict for Sources 1-3 ACCESSIBLE_NOW + Sources 4/5-node-mount/6 future_source
- MCP-019 design (`docs/designs/MCP-019.md`) — dormant semantic-referee provider wiring; the upstream Edge Function path MCP-020's classifier set will ride
- MCP-017 design — `anthropic` provider slot un-stubbed (the slot MCP-020's `mcp` provider would parallel)
- META-001 source (`src/features/metadata/moveMetadataLedger.ts` lines 91-115 `ManualTagCode` union + lines 129-145 `AutoMetadataCode` union)
- LIFE-001 source (`src/features/lifecycle/pointLifecycleModel.ts` lines 80-99 `PointLifecycleState` union + lines 75-78 doctrine anchor)
- `cdiscourse-doctrine` skill §10a (Observations vs Allegations boundary) — load-bearing for every Phase C candidate's doctrine_risk grading
- `point-standing-economy` skill — doctrine for Family E (resolution_progress) candidates
- `evidence-doctrine` skill — doctrine for Family D (evidence_quality) candidates
- `accessibility-targets` skill — ariaLabel prefix discipline (Machine Observation: / User Allegation: prefixes that the registry already enforces via the existing descriptor adapter)
- `expo-rn-patterns` skill — chip rendering primitives context for label-length cap (≤20 chars per shortLabel)
- Test baseline at audit time: 16,759 tests / 502 suites passing (unchanged — audit is docs-only)
- Project board context: `docs/core/ux-ui-project-board.md` (Epic 12 — Rules UX track; MCP-017/018/019 + ADMIN-AI-001 shipped; MCP-020 is the upstream research card for the MCP-021 first-batch curation)
- Current status line (Stage 6.4 complete; UX-001 epic closed; UX-001.5A shipped post-epic): `docs/core/current-status.md` lines 1603-1720
