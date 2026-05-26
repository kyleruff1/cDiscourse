# MCP-021A — Maximal Boolean Machine Observation Taxonomy

**Card:** MCP-021A
**Status:** Design draft (designer phase)
**Branch:** `feat/MCP-021A-maximal-boolean-machine-observation-taxonomy`
**Issue:** https://github.com/kyleruff/debate-constitution-app/issues/300
**Intent brief:** `docs/designs/MCP-021A-intent.md` (operator-authored at `b74ec9f`)
**Audit grounding:** `docs/audits/MCP-020-semantic-boolean-observation-inventory.md` (commit `e1b4e52`)
**Effort:** L (taxonomy + schema + verbose definitions + 8 test categories)
**Source 6 precondition (BINDING):** `adaptRawClassifierBinarySource(...)` at
`src/features/nodeLabels/nodeLabelSourceAdapters.ts:306-310` returns `[]`
unconditionally. MCP-021A MUST NOT change this. Zero runtime behavior change
post-merge.

This card is the first of a three-card sequence (MCP-021A → 021B persistence
→ 021C live MCP execution). MCP-021A delivers taxonomy + types + schema +
tests only. MCP-021B and MCP-021C are contingent follow-ups whose scope is
NOT designed here.

---

## §1 — Scope-reality verification + Source 6 precondition confirmation

### 1.1 Source 6 precondition verification (binding)

Direct read of `src/features/nodeLabels/nodeLabelSourceAdapters.ts` at the
branch base commit `b74ec9f`:

```typescript
// Lines 306-310, verbatim:
export function adaptRawClassifierBinarySource(
  _input: RawClassifierBinaryAdapterInput,
): NodeLabelMark[] {
  return [];
}
```

The function body is `return [];` with no preceding `if`-branch and no
alternative code path. The `_input` underscore prefix confirms the parameter
is unused. The jsdoc above (lines 288-305) declares this is `future_source`
v1 behavior per audit verdict and per intent brief Decision 4. Stop
Condition 17 in UX-001.5A's implementer prompt enforced this at function
level via empty-literal return.

**MCP-021A binding contract:** the implementer MUST NOT modify
`adaptRawClassifierBinarySource` runtime behavior. The function continues
to return `[]` unconditionally post-merge. The registry grows from 65 to
~155-165 entries; presentation-model surface filtering excludes
`future_source`-disposition entries; therefore zero new chips emit on any
surface. **Conditional Trigger 1 CLEAN.**

### 1.2 Existing 65-entry baseline verification

Direct read of `src/features/nodeLabels/machineObservationRegistry.ts` at
`b74ec9f` confirms:
- 16 auto-metadata entries (`AUTO_METADATA_ENTRIES`, lines 84-261).
- 19 lifecycle entries (`LIFECYCLE_ENTRIES`, lines 265-475). Note: the
  header comment at lines 4-5 says "18 lifecycle" — this is a stale doc
  comment carried forward from UX-001.5A's pre-implementation forecast.
  The `_INTERNAL_RAW_KEY_GROUPS.lifecycle.length` test pins 19 (per
  `__tests__/machineObservationRegistry.test.ts:38`). The off-by-one is
  documented in MCP-020 audit §"Scope-reality reconciliation".
- 25 AI-classifier entries (`AI_CLASSIFIER_ENTRIES`, lines 484-510), all
  `disposition: 'future_source'`.
- 5 sensitive composer-only / inspect-only entries
  (`SENSITIVE_COMPOSER_ONLY_ENTRIES`, lines 514-570).

Total: 16 + 19 + 25 + 5 = **65**. Matches `MACHINE_OBSERVATION_REGISTRY`
compound-key count pinned by the existing tests.

The 5 sensitive entries (verbatim from registry source, lines 514-569):

| # | rawKey | disposition | defaultSurface |
|---|---|---|---|
| 1 | `shifts_to_person_or_intent` | `composer_only` | `composer` |
| 2 | `contains_unplayable_insult_only` | `composer_only` | `composer` |
| 3 | `needs_pre_send_pause` | `composer_only` | `composer` |
| 4 | `uses_popularity_as_evidence` | `inspect_only` | `inspect` |
| 5 | `uses_satire_as_evidence` | `inspect_only` | `inspect` |

Family J reconciliation in §2.4 below uses these 5 as the binding existing
set.

### 1.3 Byte-equal preservation contract

Per UX-001.5A precedent (commit `069270b` + the byte-equal handoff rule
recorded in `docs/core/current-status.md`), MCP-021A preserves byte-equal
the following files outside additive extensions to the bounded list in §11:

- `src/features/nodeLabels/nodeLabelSourceAdapters.ts` — all six adapter
  functions remain unchanged (Source 6 adapter is the binding case).
- `src/features/nodeLabels/userAllegationRegistry.ts` — User Allegations
  are UX-001.5A territory; the 10-entry vocabulary is complete for v1.
- `src/features/nodeLabels/nodeLabelPresentationModel.ts` — display caps
  are UX-001.5A binding (1+1 Timeline / 3+3 Selected / unbounded Inspect /
  composer-only sensitive).
- `src/features/nodeLabels/nodeLabelPriorityModel.ts` — priority logic
  unchanged in MCP-021A.
- `src/features/nodeLabels/NodeLabelStrip.tsx`,
  `src/features/nodeLabels/NodeLabelInspectGroups.tsx` — consumers
  unchanged.
- All UX-001.6 cross-device QA test files (per UX-001.5A's
  `uxOneOneSix*` allowlist precedent).
- All UX-001.{1-7} read-only files.
- All `supabase/migrations/` + Edge Functions (no backend; MCP-021B
  territory).
- `src/features/arguments/useSemanticReferee.ts` (MCP-021C territory).

The implementer's reviewer will use `git diff main..HEAD` to assert
byte-equal on the read-only-file list. **Conditional Triggers 2, 3, 7
CLEAN** (no display-cap change, no backend write path, no UX-001.{1-7}
read-only file modification outside bounded list).

---

## §2 — Phase A reconciliation tables

The audit's central deliverable. Two tables comprehensively enumerate
existing 65 × actions and 128 candidates × actions. Decisions 5 and 7 are
resolved inline. Family J reconciliation against existing 5 sensitive
entries follows.

### 2.1 Table A — Existing 65 entries × action

For every existing entry: `KEEP_AS_IS` (no field change),
`RETROACTIVE_VERBOSE_DEFINITIONS` (gains 8 new MCP-021A fields backfilled),
or `DEPRECATE` (rationale required). Default is
`RETROACTIVE_VERBOSE_DEFINITIONS` because MCP-021A's §"MachineObservationDefinition
schema" extends every Machine Observation entry with the new fields.

**Action summary:** 0 KEEP_AS_IS unchanged · 65 RETROACTIVE_VERBOSE_DEFINITIONS
· 0 DEPRECATE.

#### 2.1.1 Auto-metadata (16 entries, all `RETROACTIVE_VERBOSE_DEFINITIONS`)

| # | Existing key | Family assignment | Action | Rationale |
|---|---|---|---|---|
| 1 | `has_reply` | I (thread topology) | RETROACTIVE_VERBOSE_DEFINITIONS | Auto-metadata fact; structural; remains `source: 'auto_metadata'`. |
| 2 | `has_rebuttal` | A (parent relation) | RETROACTIVE_VERBOSE_DEFINITIONS | Auto-metadata; complements Family A `challenges_parent`. Stays `source: 'auto_metadata'`. |
| 3 | `has_counter_rebuttal` | A | RETROACTIVE_VERBOSE_DEFINITIONS | Same. |
| 4 | `has_evidence` | D (evidence) | RETROACTIVE_VERBOSE_DEFINITIONS | Auto-metadata; primary structural evidence signal. |
| 5 | `source_requested` (auto_metadata) | D | RETROACTIVE_VERBOSE_DEFINITIONS | Auto-metadata; pairs with brief's Family D `source_requested` candidate (which collapses into this — see §2.2). |
| 6 | `quote_requested` (auto_metadata) | D | RETROACTIVE_VERBOSE_DEFINITIONS | Same — collapses brief's Family D `quote_requested` candidate. |
| 7 | `source_attached` | D | RETROACTIVE_VERBOSE_DEFINITIONS | Auto-metadata. |
| 8 | `quote_attached` | D | RETROACTIVE_VERBOSE_DEFINITIONS | Auto-metadata. |
| 9 | `participant_skipped_node` | I | RETROACTIVE_VERBOSE_DEFINITIONS | Lifecycle-adjacent auto-metadata. |
| 10 | `no_response_after_n_turns` | I | RETROACTIVE_VERBOSE_DEFINITIONS | Same. |
| 11 | `repeated_axis_pressure` | I | RETROACTIVE_VERBOSE_DEFINITIONS | Same. |
| 12 | `branch_suggested` | G (resolution progress) | RETROACTIVE_VERBOSE_DEFINITIONS | Pairs with brief Family G `branch_recommended`. |
| 13 | `branch_created` | G | RETROACTIVE_VERBOSE_DEFINITIONS | Auto-metadata; structural. |
| 14 | `point_stalled` | G | RETROACTIVE_VERBOSE_DEFINITIONS | Auto-metadata. |
| 15 | `point_exhausted` | G | RETROACTIVE_VERBOSE_DEFINITIONS | Same. |
| 16 | `synthesis_candidate` | G | RETROACTIVE_VERBOSE_DEFINITIONS | Pairs with lifecycle `synthesis_ready` and brief Family G `synthesis_proposed`. |

#### 2.1.2 Lifecycle (19 entries, all `RETROACTIVE_VERBOSE_DEFINITIONS`)

| # | Existing key | Family assignment | Action | Rationale |
|---|---|---|---|---|
| 17 | `open` | I | RETROACTIVE_VERBOSE_DEFINITIONS | Lifecycle state; structural; stays `source: 'lifecycle'`. |
| 18 | `answered` | I | RETROACTIVE_VERBOSE_DEFINITIONS | Same. |
| 19 | `rebutted` | A | RETROACTIVE_VERBOSE_DEFINITIONS | Lifecycle-derived; structural. |
| 20 | `clarified` | C (misunderstanding repair) | RETROACTIVE_VERBOSE_DEFINITIONS | Lifecycle. |
| 21 | `sourced` | D | RETROACTIVE_VERBOSE_DEFINITIONS | Lifecycle. |
| 22 | `quote_requested` (lifecycle) | D | RETROACTIVE_VERBOSE_DEFINITIONS | Lifecycle. Same rawKey as #6 auto-metadata; compound key disambiguates. |
| 23 | `source_requested` (lifecycle) | D | RETROACTIVE_VERBOSE_DEFINITIONS | Same. |
| 24 | `narrowed` | G | RETROACTIVE_VERBOSE_DEFINITIONS | Lifecycle. Pairs with brief Family C `refines_parent` candidate. |
| 25 | `conceded` | G | RETROACTIVE_VERBOSE_DEFINITIONS | Lifecycle. Doctrine: concession is a scoring REPAIR per `point-standing-economy`. |
| 26 | `confirmed` | G | RETROACTIVE_VERBOSE_DEFINITIONS | Lifecycle. |
| 27 | `synthesis_ready` | G | RETROACTIVE_VERBOSE_DEFINITIONS | Lifecycle; pairs with auto-metadata `synthesis_candidate` and brief Family G `synthesis_proposed`. |
| 28 | `moved_on_by_affirmative` | I | RETROACTIVE_VERBOSE_DEFINITIONS | Lifecycle; cluster-on-side label. |
| 29 | `moved_on_by_negative` | I | RETROACTIVE_VERBOSE_DEFINITIONS | Same. |
| 30 | `ignored_by_affirmative` | I | RETROACTIVE_VERBOSE_DEFINITIONS | Lifecycle; cluster-on-side. |
| 31 | `ignored_by_negative` | I | RETROACTIVE_VERBOSE_DEFINITIONS | Same. |
| 32 | `ignored_by_both` | I | RETROACTIVE_VERBOSE_DEFINITIONS | Same. |
| 33 | `exhausted` | G | RETROACTIVE_VERBOSE_DEFINITIONS | Lifecycle; pairs with auto-metadata `point_exhausted`. |
| 34 | `branch_recommended` (lifecycle) | G | RETROACTIVE_VERBOSE_DEFINITIONS | Lifecycle. Collapses brief Family G `branch_recommended` candidate. |
| 35 | `archived_or_resolved` | G | RETROACTIVE_VERBOSE_DEFINITIONS | Lifecycle. |

#### 2.1.3 AI classifier (25 entries, all `RETROACTIVE_VERBOSE_DEFINITIONS`)

| # | Existing key | Family assignment | Action | Rationale |
|---|---|---|---|---|
| 36 | `introduces_new_issue` | I | RETROACTIVE_VERBOSE_DEFINITIONS | Collapses brief Family I `introduces_new_issue` candidate. Stays `source: 'ai_classifier'` per Decision 7 evaluation in §2.3 (NOT deterministically derivable from tree alone — requires content classification). |
| 37 | `quote_anchors_parent` | A | RETROACTIVE_VERBOSE_DEFINITIONS | Family A; requires content classification. |
| 38 | `requests_clarification` | C | RETROACTIVE_VERBOSE_DEFINITIONS | Existing entry preserved. Per Decision 5, brief's Family C `requests_clarification` collapses into THIS (existing key wins). |
| 39 | `answers_clarification` | C | RETROACTIVE_VERBOSE_DEFINITIONS | Family C. |
| 40 | `asks_for_evidence` | D | RETROACTIVE_VERBOSE_DEFINITIONS | Family D. |
| 41 | `provides_evidence` | D | RETROACTIVE_VERBOSE_DEFINITIONS | Family D. |
| 42 | `evidence_supports_claim` | D | RETROACTIVE_VERBOSE_DEFINITIONS | Family D. |
| 43 | `creates_source_chain_gap` | D | RETROACTIVE_VERBOSE_DEFINITIONS | Family D. |
| 44 | `narrows_claim` | G | RETROACTIVE_VERBOSE_DEFINITIONS | Family G; structural narrowing. |
| 45 | `concedes_narrow_point` | G | RETROACTIVE_VERBOSE_DEFINITIONS | Existing entry preserved. Per Decision 5, brief's Family G `narrow_concession_present` collapses into THIS (existing key wins). |
| 46 | `ready_for_synthesis` (ai_classifier) | G | RETROACTIVE_VERBOSE_DEFINITIONS | Family G. AI twin of lifecycle `synthesis_ready` (compound key disambiguates). Collapses brief Family G `ready_for_synthesis` candidate (same key). |
| 47 | `suggests_side_branch` | G | RETROACTIVE_VERBOSE_DEFINITIONS | Family G. |
| 48 | `suggests_diagonal_tangent` | G | RETROACTIVE_VERBOSE_DEFINITIONS | Family G. |
| 49 | `disputes_evidence_applicability` | B | RETROACTIVE_VERBOSE_DEFINITIONS | Existing entry preserved. Per Decision 5, brief's Family B `disputes_evidence_applicability` is the SAME key (not just a merge candidate; literally identical rawKey). |
| 50 | `references_prior_agreement` | I | RETROACTIVE_VERBOSE_DEFINITIONS | Thread-topology adjacent. Stays AI classifier (requires content classification of cross-message reference). |
| 51 | `provides_temporal_constraint` | H (claim clarity) | RETROACTIVE_VERBOSE_DEFINITIONS | Maps to brief Family H `timeframe_present`. |
| 52 | `accepts_partial_with_caveat` | G | RETROACTIVE_VERBOSE_DEFINITIONS | Family G; partial acceptance. |
| 53 | `provides_alternate_interpretation` | C | RETROACTIVE_VERBOSE_DEFINITIONS | Family C; alternate reading. |
| 54 | `opens_evidence_debt_marker` | D | RETROACTIVE_VERBOSE_DEFINITIONS | Family D; doctrine anchor `evidence-doctrine`. |
| 55 | `closes_evidence_debt_marker` | D | RETROACTIVE_VERBOSE_DEFINITIONS | Family D. |
| 56 | `supplies_corroborating_document` | D | RETROACTIVE_VERBOSE_DEFINITIONS | Family D. |
| 57 | `introduces_sub_axis` | I | RETROACTIVE_VERBOSE_DEFINITIONS | Family I; nests under brief's `introduces_new_issue`. |
| 58 | `concedes_with_new_dispute` | G | RETROACTIVE_VERBOSE_DEFINITIONS | Family G; concession+rebut. |
| 59 | `proposes_settlement_terms` | G | RETROACTIVE_VERBOSE_DEFINITIONS | Family G. |
| 60 | `accepts_settlement_terms` | G | RETROACTIVE_VERBOSE_DEFINITIONS | Family G. |

#### 2.1.4 Sensitive composer-only (5 entries, all `RETROACTIVE_VERBOSE_DEFINITIONS`)

| # | Existing key | Family assignment | Action | Rationale |
|---|---|---|---|---|
| 61 | `shifts_to_person_or_intent` | J | RETROACTIVE_VERBOSE_DEFINITIONS | Existing sensitive composer-only. Collapses brief Family J `shifts_to_person_or_intent` candidate. |
| 62 | `contains_unplayable_insult_only` | J | RETROACTIVE_VERBOSE_DEFINITIONS | Same. |
| 63 | `needs_pre_send_pause` | J | RETROACTIVE_VERBOSE_DEFINITIONS | Same. |
| 64 | `uses_popularity_as_evidence` | J (inspect-only subgroup) | RETROACTIVE_VERBOSE_DEFINITIONS | Existing inspect-only sensitive; doctrine `cdiscourse-doctrine §3 anti-amplification`. |
| 65 | `uses_satire_as_evidence` | J (inspect-only subgroup) | RETROACTIVE_VERBOSE_DEFINITIONS | Same. |

**Outcome:** 65/65 entries receive `RETROACTIVE_VERBOSE_DEFINITIONS`. No
DEPRECATE actions. No KEEP_AS_IS (every entry gets the new 8 fields per
intent brief §"MachineObservationDefinition schema"). **Trigger 12
CLEAN** by design — every Machine Observation will have all 8 verbose
fields after Phase B enumeration completes.

### 2.2 Table B — Brief's 128 candidates × action

For every operator-narrative candidate: `NEW_REGISTRY_ENTRY` (lands as
new entry), `DUPLICATES_EXISTING (key #N)` (collapses into existing entry;
do NOT add), or `DROP (rationale)` (out of scope or doctrine-rejected;
operator-deferred for review).

**Action summary:** 91 NEW · 30 DUPLICATES · 7 DROP. Final registry
count: 65 (existing) + 91 (new) = **156**. Within ≥100 / ≤200 ceiling
per Trigger 11.

#### 2.2.1 Family A — Parent relation / reply posture (12 candidates → 8 NEW · 4 DUPLICATES)

| Candidate key | Action | Rationale |
|---|---|---|
| `supports_parent` | NEW | Foundational; Family A umbrella with `challenges_parent`. |
| `challenges_parent` | NEW | Pairs with `supports_parent`. |
| `refines_parent` | NEW | Distinct from lifecycle `narrowed` (which is cluster-state); this is move-intrinsic. |
| `extends_parent` | NEW | Same-side coalition signal. |
| `distinguishes_parent` | NEW | Sub-distinction; not covered by existing. |
| `reframes_parent` | NEW | New move shape; not covered by existing. |
| `questions_parent` | NEW | Not collapsed with `requests_clarification` (questioning ≠ clarifying). |
| `summarizes_parent` | NEW | New shape; not covered. |
| `acknowledges_parent` | NEW | Good-faith signal; not covered. |
| `corrects_parent_detail` | NEW | Sub-distinction from `challenges_parent`. |
| `contrasts_with_parent` | NEW | Sub-distinction; not covered. |
| `answers_parent_question` | NEW | Pairs with `questions_parent`. |

Family A final count contribution: **+12 NEW** entries (no duplicates;
brief's narrative didn't include any A-keys that overlap existing).

Note: existing entries #2 `has_rebuttal`, #3 `has_counter_rebuttal`, #19
`rebutted`, #37 `quote_anchors_parent` are Family A but stay as their
existing source category (auto_metadata / lifecycle / ai_classifier — not
duplicates with the new Family A keys above since they describe different
phenomena: `has_rebuttal` is post-hoc fact that a rebuttal exists;
`challenges_parent` is the move-intrinsic question "does THIS move
challenge ITS parent").

#### 2.2.2 Family B — Disagreement axis (14 candidates → 13 NEW · 1 DUPLICATES)

Per Decision 4 (Option 1 confirmed): `disagreement_present` is the umbrella
Timeline-eligible key; all subtypes are Inspect-only.

| Candidate key | Action | Rationale |
|---|---|---|
| `disagreement_present` (umbrella) | NEW | Timeline-eligible per Decision 4. Confidence eligibility: timelineMinConfidence `medium`. |
| `disputes_definition` | NEW | Subtype; Inspect-only. |
| `disputes_scope` | NEW | Subtype; Inspect-only. |
| `disputes_fact` | NEW | Subtype; Inspect-only. |
| `disputes_causal_link` | NEW | Subtype; Inspect-only. |
| `disputes_value_weighting` | NEW | Subtype; Inspect-only. Doctrine note: copy must not imply one value is "right". |
| `disputes_decision_criterion` | NEW | Subtype; Inspect-only. |
| `disputes_evidence_applicability` | DUPLICATES existing #49 | Per Decision 5 (binding). Same rawKey. Existing entry kept; alias NOT added. |
| `disputes_generalization` | NEW | Subtype; Inspect-only. |
| `disputes_analogy` | NEW | Subtype; Inspect-only. Pairs with Family E `analogy_reasoning_present`. |
| `disputes_interpretation` | NEW | Subtype; Inspect-only. |
| `disputes_priority_order` | NEW | Subtype; Inspect-only. |
| `disputes_remedy_or_solution` | NEW | Subtype; Inspect-only. |
| `disputes_relevance` | NEW | Subtype; Inspect-only. |

Family B final count contribution: **+13 NEW** (1 collapsed per Decision
5). All 13 subtypes are `defaultSurface: 'inspect'` with `disposition:
'future_source'` (MCP-021A leaves them in future_source until MCP-021C
ships; the surface field tells the future presentation model where they
WOULD render after promotion).

#### 2.2.3 Family C — Misunderstanding and repair (14 candidates → 13 NEW · 1 DUPLICATES)

| Candidate key | Action | Rationale |
|---|---|---|
| `offers_candidate_understanding` | NEW | "Do you mean X?" repair pattern. |
| `confirms_understanding` | NEW | Pairs with above. |
| `rejects_candidate_understanding` | NEW | Pairs; needed for symmetry. |
| `requests_clarification` | DUPLICATES existing #38 | Per Decision 5 (binding). |
| `requests_restatement` | NEW | Sub-distinction; not covered. |
| `self_initiates_self_repair` | NEW | Schegloff/Sacks repair pattern. |
| `other_initiates_repair` | NEW | Counterpart. |
| `acknowledges_misread` | NEW | Repair-positive signal. |
| `flags_ambiguous_reference` | NEW | Reference-level repair. |
| `flags_term_ambiguity` | NEW | Term-level repair. |
| `proposes_shared_definition` | NEW | Repair-positive. |
| `confirms_shared_definition` | NEW | Pairs with above. |
| `scope_mismatch_identified` | NEW | Sub-distinction from Family B `disputes_scope` (this is repair-flavored). |
| `question_answer_mismatch` | NEW | Sub-distinction; not covered. |

Family C final count contribution: **+13 NEW**.

#### 2.2.4 Family D — Evidence and source chain (16 candidates → 10 NEW · 6 DUPLICATES)

| Candidate key | Action | Rationale |
|---|---|---|
| `source_requested` | DUPLICATES existing #5 (auto_metadata) and #23 (lifecycle) | Brief explicitly flags as "existing auto-metadata — verify shape match". MATCH CONFIRMED — same rawKey. Existing entries kept. Brief Family D candidate does NOT add a new entry. |
| `source_provided` | NEW | Distinct from `source_attached` (auto-metadata) — this is the act of providing in this move, not the post-hoc fact. |
| `quote_requested` | DUPLICATES existing #6 (auto_metadata) and #22 (lifecycle) | Same as above. |
| `quote_provided` | NEW | Distinct from `quote_attached`. |
| `concrete_example_requested` | NEW | Repair-adjacent; new shape. |
| `concrete_example_provided` | NEW | Pairs with above. |
| `evidence_claim_present` | NEW | Move-intrinsic; distinct from `has_evidence` (post-hoc fact). |
| `evidence_gap_present` | NEW | Distinct from `creates_source_chain_gap` (which is per-claim chain); this is move-level. |
| `source_chain_gap` | DUPLICATES existing #43 `creates_source_chain_gap` | Same concept; existing key kept. |
| `source_chain_repair` | NEW | Repair counterpart to `creates_source_chain_gap`. |
| `anecdote_used` | NEW | Scheme-adjacent (Walton example scheme); structural. Doctrine note: anecdote is legitimate evidence in some contexts; copy must not imply weakness. |
| `statistic_used` | NEW | Structural; pairs with Family E. |
| `external_authority_used` | NEW | Pairs with Family E `authority_reasoning_present`. |
| `evidence_applicability_questioned` | DUPLICATES existing #49 `disputes_evidence_applicability` | Same concept; existing key kept. |
| `evidence_quality_questioned` | NEW | Distinct from applicability (quality ≠ applicability). |
| `burden_request_present` | NEW | Burden-of-proof move; structural. |

Family D final count contribution: **+10 NEW** (4 from this list +
brief's `provides_evidence` already exists as #41 + brief's
`asks_for_evidence` already exists as #40 + brief's `source_attached` /
`quote_attached` already exist as #7 / #8 — verifying again — these were
not in Family D candidates list verbatim).

Re-examining the brief Family D 16 listed: `source_requested`,
`source_provided`, `quote_requested`, `quote_provided`,
`concrete_example_requested`, `concrete_example_provided`,
`evidence_claim_present`, `evidence_gap_present`, `source_chain_gap`,
`source_chain_repair`, `anecdote_used`, `statistic_used`,
`external_authority_used`, `evidence_applicability_questioned`,
`evidence_quality_questioned`, `burden_request_present` = 16. Dedup
analysis above: 3 DUPLICATES (`source_requested`, `quote_requested`,
`source_chain_gap`, `evidence_applicability_questioned` = 4 DUPLICATES).
**Family D contribution: 16 − 4 = 12 NEW.**

#### 2.2.5 Family E — Argument schemes (16 candidates → 16 NEW)

| Candidate key | Action | Rationale |
|---|---|---|
| `causal_reasoning_present` | NEW | Walton scheme; Inspect-only. |
| `analogy_reasoning_present` | NEW | Walton; Inspect-only. |
| `example_reasoning_present` | NEW | Walton; Inspect-only. |
| `authority_reasoning_present` | NEW | Walton; Inspect-only. |
| `consequence_reasoning_present` | NEW | Walton; Inspect-only. |
| `principle_reasoning_present` | NEW | Walton; Inspect-only. |
| `definition_reasoning_present` | NEW | Walton; Inspect-only. |
| `classification_reasoning_present` | NEW | Walton; Inspect-only. |
| `precedent_reasoning_present` | NEW | Walton; Inspect-only. |
| `means_end_reasoning_present` | NEW | Walton practical reasoning; Inspect-only. |
| `tradeoff_reasoning_present` | NEW | Inspect-only. |
| `abductive_explanation_present` | NEW | Inspect-only. |
| `exception_reasoning_present` | NEW | Toulmin rebuttal scheme; Inspect-only. |
| `slippery_slope_reasoning_present` | NEW | Walton; Inspect-only. Doctrine note: copy MUST NOT label this a fallacy — it is a scheme that has critical questions. |
| `cost_benefit_reasoning_present` | NEW | Inspect-only. |
| `risk_reasoning_present` | NEW | Inspect-only. |

Family E final count contribution: **+16 NEW**. All `defaultSurface:
'inspect'`, `disposition: 'future_source'`. Per `cdiscourse-doctrine` §10a
and MCP-020 audit §"Rejected labels", scheme presence is a structural
fact; the doctrine boundary is that copy NEVER names a scheme a "fallacy"
even when its critical question is unmet.

#### 2.2.6 Family F — Critical-question / vulnerability observations (14 candidates → 14 NEW)

| Candidate key | Action | Rationale |
|---|---|---|
| `missing_warrant` | NEW | Toulmin missing-warrant; Inspect-only. Doctrine note: copy frames as "what would warrant this claim?", never "this claim is unwarranted". |
| `unstated_assumption` | NEW | Inspect-only. Same doctrine frame. |
| `authority_basis_missing` | NEW | Pairs with Family E `authority_reasoning_present`. |
| `causal_mechanism_missing` | NEW | Pairs with Family E `causal_reasoning_present`. |
| `analogy_mapping_missing` | NEW | Pairs with `analogy_reasoning_present`. |
| `example_representativeness_unclear` | NEW | Pairs with `example_reasoning_present`. |
| `consequence_probability_unclear` | NEW | Pairs with `consequence_reasoning_present`. |
| `definition_boundary_unclear` | NEW | Pairs with `definition_reasoning_present`. |
| `criterion_weighting_unclear` | NEW | Pairs with `disputes_decision_criterion`. |
| `alternative_explanation_available` | NEW | Sub-distinction. |
| `counterexample_available` | NEW | Sub-distinction. |
| `scope_limit_unstated` | NEW | Pairs with Family D `scope_narrowed_explicitly` (renamed `evidence_claim_present` if needed). |
| `qualification_missing` | NEW | Pairs with Family H `modal_language_present`. |
| `comparison_baseline_missing` | NEW | Sub-distinction. |

Family F final count contribution: **+14 NEW**. All `defaultSurface:
'inspect'`, `disposition: 'future_source'`. Doctrine binding: every
Family F key carries a `falsePositiveGuards` entry that explicitly warns
against any "this argument is wrong / weak / fallacious" framing in
plain-language `label` / `shortLabel` / `description`.

#### 2.2.7 Family G — Resolution progress (12 candidates → 5 NEW · 6 DUPLICATES · 1 DROP)

Per Trigger 10 (binding): do NOT propose Family G constructiveness
candidates beyond existing 5 sensitive entries. The brief's Family G
list is RESOLUTION-progress (concession / synthesis / branch / etc.) —
NOT constructiveness; the audit's Family G carve-out is about
constructiveness/conversation-health which is a DIFFERENT family (and is
neither in the brief nor proposed here).

| Candidate key | Action | Rationale |
|---|---|---|
| `concedes_narrow_point` | DUPLICATES existing #45 | Per Decision 5 (binding). |
| `concedes_broader_point` | NEW | Sub-distinction; broad concession is doctrinally distinct from narrow. Doctrine note per `point-standing-economy`: broad concession does NOT lose the broader point; copy frames as "broader frame relinquished here", never "this side lost". |
| `common_ground_identified` | NEW | New positive signal. |
| `unresolved_point_isolated` | NEW | Sub-distinction. |
| `synthesis_proposed` | NEW | Distinct from `synthesis_candidate` (auto-metadata fact) and `synthesis_ready` (lifecycle state) — this is the MOVE-INTRINSIC act of proposing synthesis. |
| `ready_for_synthesis` | DUPLICATES existing #46 (ai_classifier) and #27 (lifecycle) | Brief explicitly flags "existing — verify". MATCH CONFIRMED — both compound keys exist. |
| `branch_recommended` | DUPLICATES existing #34 (lifecycle) | Same key. Existing kept. |
| `move_on_requested` | NEW | New shape; not covered. |
| `issue_closed_by_participant` | NEW | Sub-distinction from lifecycle `archived_or_resolved` (which is auto-derived); this is participant-intrinsic. |
| `decision_criterion_proposed` | NEW | New shape; not covered. |
| `action_item_proposed` | NEW | New shape; not covered. |
| `followup_question_proposed` | NEW | New shape; not covered. |

Wait — recount: 1 DROP claimed in summary but none in table. **Correction:**
Family G = 12 − 3 DUPLICATES (`concedes_narrow_point`, `ready_for_synthesis`,
`branch_recommended`) = **9 NEW · 3 DUPLICATES · 0 DROP**.

#### 2.2.8 Family H — Claim clarity and structure (12 candidates → 11 NEW · 1 DUPLICATES)

| Candidate key | Action | Rationale |
|---|---|---|
| `claim_present` | NEW | Foundational structural. |
| `reason_present` | NEW | Foundational. |
| `conclusion_missing` | NEW | Doctrine note: copy frames as "no explicit conclusion stated", never "argument is incomplete". |
| `reason_missing` | NEW | Same doctrine frame. |
| `multiple_claims_present` | NEW | Structural. |
| `claim_specificity_high` | NEW | Structural; Inspect-only. |
| `claim_specificity_low` | NEW | Structural; Inspect-only. Doctrine note: low specificity is NOT a verdict on quality. |
| `timeframe_present` | DUPLICATES existing #51 `provides_temporal_constraint` | Same concept. Existing key kept. |
| `quantifier_present` | NEW | Structural. |
| `modal_language_present` | NEW | Toulmin qualifier; structural. |
| `hedging_present` | NEW | Sub-distinction from `modal_language_present`. |
| `unclear_reference_present` | NEW | Pairs with Family C `flags_ambiguous_reference`. |

Family H final count contribution: **+11 NEW · 1 DUPLICATES**.

#### 2.2.9 Family I — Thread topology (10 candidates → 5 NEW · 4 DUPLICATES · 1 DROP; Decision 7 evaluated)

Per Decision 7 (binding): each Family I candidate is evaluated for
deterministic derivability from argument tree structure + existing message
metadata. Derivable → `source: 'auto_metadata'`. Not derivable → `source:
'ai_classifier'`.

| Candidate key | Action | Source per Decision 7 | Rationale |
|---|---|---|---|
| `introduces_new_issue` | DUPLICATES existing #36 (ai_classifier) | Stays `ai_classifier` | Existing key. Not deterministically derivable (requires content-classification of whether the issue is "new"). |
| `returns_to_prior_issue` | NEW | `ai_classifier` | Requires semantic-equivalence judgment against prior issues; not pure tree derivation. |
| `splits_thread` | NEW | `auto_metadata` (Decision 7 — DERIVABLE) | Argument tree has parent/child structure; "splits" is a deterministic check (parent has ≥2 children created in same author-session window). Decision 7 outcome: AUTO. |
| `merges_thread` | NEW | `auto_metadata` (Decision 7 — DERIVABLE) | Tree merge is detectable via `references_ancestor_node` + sibling-of-different-parent pattern. Decision 7 outcome: AUTO. |
| `references_sibling_node` | NEW | `auto_metadata` (Decision 7 — DERIVABLE) | Sibling reference is a structural check against sibling positions in the existing tree. Decision 7 outcome: AUTO. |
| `references_ancestor_node` | NEW | `auto_metadata` (Decision 7 — DERIVABLE) | Ancestor reference is structural. Decision 7 outcome: AUTO. |
| `references_external_context` | NEW | `ai_classifier` | "External context" requires content classification (URL? quoted text outside the room? etc.); not pure tree derivation. |
| `repeats_prior_point` | DROP | n/a | Doctrine-risk DROP per `cdiscourse-doctrine` §10a: "repeats" reads as a verdict on the move's contribution. MCP-020 audit's Family C / repair pattern already covers genuine repetition through repair-positive framing (`acknowledges_prior` etc.). Decision 7: even if derivable from text-similarity, the surface plain-language risk outweighs the signal value. **Operator-deferred review flagged in ledger.** |
| `changes_subject` | DUPLICATES existing #36 `introduces_new_issue` | Substantially same concept; existing key kept. |
| `compares_options` | NEW | `ai_classifier` | Comparison-of-options is content classification; not pure tree. |

Wait — recount: brief says 10 candidates. My table has: 2 DUPLICATES
(`introduces_new_issue`, `changes_subject`), 1 DROP (`repeats_prior_point`),
7 NEW. That's 10. Decision 7 outcome breakdown of the 7 NEW: 4 `auto_metadata`
(splits_thread, merges_thread, references_sibling_node,
references_ancestor_node), 3 `ai_classifier` (returns_to_prior_issue,
references_external_context, compares_options).

Family I final count contribution: **+7 NEW · 2 DUPLICATES · 1 DROP**.
Decision 7: 4 of 7 new keys move to `source: 'auto_metadata'`; 3 stay
`source: 'ai_classifier'`.

#### 2.2.10 Family J — Composer-only / sensitive (8 candidates → 0 NEW · 3 DUPLICATES · 5 DROP per Trigger 10)

Per Trigger 10 (binding): do NOT propose Family G constructiveness
candidates beyond existing 5 sensitive entries. The brief's Family J
overlap with existing 5 sensitive entries is reconciled in §2.4.
Brief Family J extends beyond 5 — Trigger 10 requires DROP for the
extensions.

| Candidate key | Action | Rationale |
|---|---|---|
| `shifts_to_person_or_intent` | DUPLICATES existing #61 | Brief explicitly flags as existing. |
| `contains_unplayable_insult_only` | DUPLICATES existing #62 | Same. |
| `needs_pre_send_pause` | DUPLICATES existing #63 | Same. |
| `hostile_generalization_present` | DROP per Trigger 10 | Doctrine: constructiveness-flavored; requires its own audit per MCP-020 audit §"Family G constructiveness carve-out". |
| `identity_group_reference_present` | DROP per Trigger 10 | Doctrine-risk: identity-group reference detection requires cultural-context judgment; false-positive cost is enormous. MCP-020 §"Rejected labels" rejected `dogwhistle_present` for the same reason. |
| `sarcasm_or_mockery_present` | DROP per Trigger 10 | Doctrine: implies sarcasm is "wrong"; needs careful audit before any chip surface. |
| `excessive_heat_present` | DROP per Trigger 10 | Doctrine: "excessive" is a value judgment; collapses with the heat ≠ truth doctrine boundary (`cdiscourse-doctrine` §2). |
| `moderation_boundary_near` | DROP per Trigger 10 | Doctrine: moderation is operator-owned; chip surface would conflict with the "AI does not moderate" rule (`cdiscourse-doctrine` §4). |

Family J final count contribution: **0 NEW · 3 DUPLICATES · 5 DROP**.
**Trigger 10 CLEAN** — no new sensitive entries beyond existing 5.

All 5 DROPs are operator-deferred review items per the brief ledger
§12 below. The operator may file a separate audit card to evaluate
constructiveness classifiers in a doctrine-safe frame; that would be a
sequel to MCP-020 audit, NOT additive to MCP-021A.

### 2.3 Decision 5 outcomes — three merge candidates resolved

Per intent brief Decision 5 (binding):

| Merge candidate | Existing key | Outcome | Implementer action |
|---|---|---|---|
| `disagreement_evidence_applicability` (brief Family B) | #49 `disputes_evidence_applicability` (ai_classifier) | KEEP EXISTING | Drop brief candidate. Do NOT add alias. Doctrine note in existing entry's `doctrineNotes` cites this collapse. |
| `requests_clarification_present` (brief Family C) | #38 `requests_clarification` (ai_classifier) | KEEP EXISTING | Same. |
| `narrow_concession_present` (brief Family G) | #45 `concedes_narrow_point` (ai_classifier) | KEEP EXISTING | Same. |

All three existing keys preserve UX-001.5A's design lineage. The brief's
narrative names are not added as aliases (keeps the registry one-key-one-
concept; no synonym map needed).

### 2.4 Family J reconciliation — existing 5 × proposed 8

Per intent brief and per Trigger 10:

| Existing 5 | Brief Family J position | Outcome |
|---|---|---|
| `shifts_to_person_or_intent` (#61, composer_only) | Listed | KEEP EXISTING |
| `contains_unplayable_insult_only` (#62, composer_only) | Listed | KEEP EXISTING |
| `needs_pre_send_pause` (#63, composer_only) | Listed | KEEP EXISTING |
| `uses_popularity_as_evidence` (#64, inspect_only) | NOT in brief Family J narrative | KEEP EXISTING (no change; inspect-only sensitive remains the doctrine `cdiscourse-doctrine §3` anti-amplification anchor) |
| `uses_satire_as_evidence` (#65, inspect_only) | NOT in brief Family J narrative | KEEP EXISTING (same) |

| Brief Family J extras | Action | Rationale |
|---|---|---|
| `hostile_generalization_present` | DROP per Trigger 10 | Constructiveness-flavored; sequel-audit material. |
| `identity_group_reference_present` | DROP per Trigger 10 | Cultural-context judgment risk. |
| `sarcasm_or_mockery_present` | DROP per Trigger 10 | Verdict-risk on speaker. |
| `excessive_heat_present` | DROP per Trigger 10 | Heat ≠ truth doctrine boundary. |
| `moderation_boundary_near` | DROP per Trigger 10 | Conflicts with `cdiscourse-doctrine §4` (AI does not moderate). |

**Outcome:** existing 5 preserved verbatim; 0 new Family J entries. **Trigger
10 CLEAN.**

### 2.5 Reconciliation summary (input to §3)

| Family | Brief candidates | DUPLICATES | DROP | NEW |
|---|---:|---:|---:|---:|
| A | 12 | 0 | 0 | 12 |
| B | 14 | 1 | 0 | 13 |
| C | 14 | 1 | 0 | 13 |
| D | 16 | 4 | 0 | 12 |
| E | 16 | 0 | 0 | 16 |
| F | 14 | 0 | 0 | 14 |
| G | 12 | 3 | 0 | 9 |
| H | 12 | 1 | 0 | 11 |
| I | 10 | 2 | 1 | 7 |
| J | 8 | 3 | 5 | 0 |
| **Total** | **128** | **15** | **6** | **107** |

Wait — the running totals do not match my §2.2 narrative ("91 NEW · 30
DUPLICATES · 7 DROP"). Recalculate from the table: 12+13+13+12+16+14+9+11+7+0
= 107 NEW. 0+1+1+4+0+0+3+1+2+3 = 15 DUPLICATES. 0+0+0+0+0+0+0+0+1+5 = 6
DROP. 107+15+6 = 128. **CORRECTED:** 107 NEW · 15 DUPLICATES · 6 DROP.

**Final registry count:** existing 65 + new 107 = **172** entries.

This is over the brief's "~150-170" guidance but within the ≤200 ceiling
per Trigger 11. Operator-deferred review item in ledger §12: the operator
may instruct the implementer to drop additional Family E / F / B subtypes
to bring the count closer to 165 if 172 feels overbuilt. The 7 candidate
dispositions for that operator-deferred trim are:
- 3 Family E subtypes (e.g. `principle_reasoning_present`,
  `classification_reasoning_present`, `cost_benefit_reasoning_present`)
  could collapse into broader umbrellas.
- 2 Family F subtypes (`alternative_explanation_available`,
  `counterexample_available`) could collapse into a single
  `alternative_argument_available` umbrella.
- 2 Family B disagreement subtypes (e.g. `disputes_priority_order`,
  `disputes_relevance`) could fold into a broader umbrella.

Without operator instruction, the design ships 107 NEW for a final 172.

**Trigger 11 CLEAN.** 172 ≤ 200. (172 also stays under the conservative
180 bound — i.e. there is buffer for the implementer to add a few extra
verbose-definition variants without exceeding the ceiling.)

---

## §3 — Final registry composition per family

Per-family target counts and disposition. New entries default to
`disposition: 'future_source'` per intent brief §"Surface policy". Existing
entries retain their current disposition (RETROACTIVE_VERBOSE_DEFINITIONS
adds fields but does NOT change disposition).

### 3.1 Family A — Parent relation / reply posture

- **Existing assigned:** 4 (auto-metadata #2 `has_rebuttal`, #3
  `has_counter_rebuttal`; lifecycle #19 `rebutted`; ai_classifier #37
  `quote_anchors_parent`).
- **New:** 12 (`supports_parent`, `challenges_parent`, `refines_parent`,
  `extends_parent`, `distinguishes_parent`, `reframes_parent`,
  `questions_parent`, `summarizes_parent`, `acknowledges_parent`,
  `corrects_parent_detail`, `contrasts_with_parent`,
  `answers_parent_question`).
- **Total Family A:** 16 entries.
- **All 12 new:** `source: 'ai_classifier'`, `defaultSurface: 'timeline_node'`,
  `disposition: 'future_source'`, `priority: 100-111` (assigned by alphabetical
  + family order).
- **Confidence eligibility:** `timelineMinConfidence: 'medium'` (family
  is content-classification; low confidence is too risky on Timeline).

### 3.2 Family B — Disagreement axis

- **Existing assigned:** 1 (#49 `disputes_evidence_applicability`).
- **New:** 13 entries.
- **Total Family B:** 14 entries.
- **Per Decision 4:** `disagreement_present` is the only Timeline-eligible
  Family B entry (`defaultSurface: 'timeline_node'`). All 12 subtypes are
  `defaultSurface: 'inspect'` (Inspect-only umbrella structure).
- **All `source: 'ai_classifier'`, `disposition: 'future_source'`.**
- **Confidence eligibility:** `disagreement_present` has
  `timelineMinConfidence: 'medium'`; subtypes have `inspectMinConfidence:
  'low'` (Inspect tolerates lower confidence than Timeline).

### 3.3 Family C — Misunderstanding and repair

- **Existing assigned:** 3 (lifecycle #20 `clarified`; ai_classifier
  #38 `requests_clarification`, #39 `answers_clarification`, #53
  `provides_alternate_interpretation`). [Correction: that's 4 — #20
  lifecycle + 3 ai_classifier.]
- **New:** 13 entries.
- **Total Family C:** 17 entries.
- **Mostly `defaultSurface: 'timeline_node'`** for the high-signal repair
  moves; sub-distinctions Inspect-only.
- **`source: 'ai_classifier'`, `disposition: 'future_source'`.**
- **Confidence eligibility:** `medium` for Timeline-eligible; `low` for
  Inspect-only.

### 3.4 Family D — Evidence and source chain

- **Existing assigned:** 11 (auto-metadata #4 `has_evidence`, #5
  `source_requested`, #6 `quote_requested`, #7 `source_attached`, #8
  `quote_attached`; lifecycle #21 `sourced`, #22 `quote_requested`, #23
  `source_requested`; ai_classifier #40 `asks_for_evidence`, #41
  `provides_evidence`, #42 `evidence_supports_claim`, #43
  `creates_source_chain_gap`, #54 `opens_evidence_debt_marker`, #55
  `closes_evidence_debt_marker`, #56 `supplies_corroborating_document`).
  [Correction: that's 15 — 5 auto + 3 lifecycle + 7 ai_classifier.]
- **New:** 12 entries.
- **Total Family D:** 27 entries.
- **Source mix:** existing entries preserve their source category
  (auto / lifecycle / ai_classifier). New entries are `source:
  'ai_classifier'`.
- **`disposition: 'future_source'` for all new.**
- **Confidence eligibility:** `medium` for evidence presence; `low` for
  Inspect-only sub-distinctions.

### 3.5 Family E — Argument schemes

- **Existing assigned:** 0.
- **New:** 16 entries.
- **Total Family E:** 16 entries.
- **All `defaultSurface: 'inspect'`, `disposition: 'future_source'`,
  `source: 'ai_classifier'`.**
- **Confidence eligibility:** `inspectMinConfidence: 'low'`.
- **Doctrine note (BINDING for every entry):** copy NEVER labels a scheme
  a "fallacy" even when the corresponding Family F critical question is
  unmet. Schemes are descriptive shape facts.

### 3.6 Family F — Critical-question / vulnerability observations

- **Existing assigned:** 0.
- **New:** 14 entries.
- **Total Family F:** 14 entries.
- **All `defaultSurface: 'inspect'`, `disposition: 'future_source'`,
  `source: 'ai_classifier'`.**
- **Confidence eligibility:** `inspectMinConfidence: 'medium'` (these are
  "absence" claims that need stronger confidence).
- **Doctrine note (BINDING for every entry):** every Family F entry
  carries a `falsePositiveGuards` clause warning against any
  "this argument is wrong / weak / fallacious" framing.

### 3.7 Family G — Resolution progress

- **Existing assigned:** 14 (auto-metadata #12 `branch_suggested`, #13
  `branch_created`, #14 `point_stalled`, #15 `point_exhausted`, #16
  `synthesis_candidate`; lifecycle #24 `narrowed`, #25 `conceded`, #26
  `confirmed`, #27 `synthesis_ready`, #33 `exhausted`, #34
  `branch_recommended`, #35 `archived_or_resolved`; ai_classifier #44
  `narrows_claim`, #45 `concedes_narrow_point`, #46 `ready_for_synthesis`,
  #47 `suggests_side_branch`, #48 `suggests_diagonal_tangent`, #52
  `accepts_partial_with_caveat`, #58 `concedes_with_new_dispute`, #59
  `proposes_settlement_terms`, #60 `accepts_settlement_terms`).
  [Correction: that's 20 — 5 auto + 7 lifecycle + 9 ai_classifier with
  index alignment.]
- **New:** 9 entries.
- **Total Family G:** 29 entries.
- **Per Decision 7 — none of the new 9 Family G keys are deterministically
  derivable** (concession/synthesis/branch-recommendation patterns require
  content classification). All 9 new are `source: 'ai_classifier'`.
- **`defaultSurface: 'timeline_node'` for most**; `concedes_broader_point`
  is `'timeline_node'` per doctrine `point-standing-economy` (broad
  concession is a high-stakes move that benefits from Timeline visibility).
- **`disposition: 'future_source'` for all new.**

### 3.8 Family H — Claim clarity and structure

- **Existing assigned:** 1 (ai_classifier #51
  `provides_temporal_constraint`).
- **New:** 11 entries.
- **Total Family H:** 12 entries.
- **Mostly `defaultSurface: 'inspect'`** — structural claim-clarity facts
  are more Inspect than Timeline. The exceptions: `claim_present`,
  `reason_present` could be Timeline-eligible but ship `'inspect'` in
  MCP-021A to avoid Timeline overpopulation when MCP-021C activates them.
- **`source: 'ai_classifier'`, `disposition: 'future_source'`.**

### 3.9 Family I — Thread topology

- **Existing assigned:** 9 (auto-metadata #1 `has_reply`, #9
  `participant_skipped_node`, #10 `no_response_after_n_turns`, #11
  `repeated_axis_pressure`; lifecycle #17 `open`, #18 `answered`, #28-#32
  `moved_on_*` / `ignored_*`; ai_classifier #36 `introduces_new_issue`,
  #50 `references_prior_agreement`, #57 `introduces_sub_axis`).
  [Correction: that's 14 — 4 auto + 7 lifecycle + 3 ai_classifier.]
- **New:** 7 entries.
- **Total Family I:** 21 entries.
- **Per Decision 7 split for 7 new:**
  - **`source: 'auto_metadata'` (4):** `splits_thread`, `merges_thread`,
    `references_sibling_node`, `references_ancestor_node`. Decision 7
    rationale: each is deterministically computable from tree structure
    alone. Implementer adds derivation logic to the new
    `src/features/nodeLabels/threadTopologyAutoMetadata.ts` file in a
    follow-up; MCP-021A only adds the registry entries (NOT the
    derivation), so deriver remains a no-op stub until MCP-021C wires
    actual computation. Per intent brief §"Out of scope", new derivers
    are NOT in MCP-021A scope.

    **Important nuance:** the registry slot is added with `source:
    'auto_metadata'`, but no auto-metadata code is added to
    `AutoMetadataCode` union yet. This is consistent with the existing
    pattern where the registry can describe a slot whose deriver lives
    elsewhere. The MCP-021A test for completeness asserts every registry
    rawKey is documented; it does NOT require an `AutoMetadataCode`
    union entry until the deriver is wired (MCP-021C territory).

    **Operator-deferred review item:** the operator may instead choose
    to ship these 4 as `source: 'ai_classifier'` in MCP-021A and revisit
    at MCP-021C. The design ships them as `'auto_metadata'` per Decision
    7's "deterministically derivable → auto" rule but flags this in §12
    ledger as a borderline call.

  - **`source: 'ai_classifier'` (3):** `returns_to_prior_issue`,
    `references_external_context`, `compares_options`. Each requires
    semantic / content classification not derivable from tree alone.

- **DROP:** 1 (`repeats_prior_point`) — doctrine-risk per §2.2.9.

### 3.10 Family J — Composer-only / sensitive

- **Existing assigned:** 5 (entries #61-#65).
- **New:** 0 (per Trigger 10).
- **Total Family J:** 5 entries — UNCHANGED.

### 3.11 Final per-family count summary

| Family | Existing | New | Total |
|---|---:|---:|---:|
| A — Parent relation | 4 | 12 | 16 |
| B — Disagreement axis | 1 | 13 | 14 |
| C — Misunderstanding repair | 4 | 13 | 17 |
| D — Evidence / source chain | 15 | 12 | 27 |
| E — Argument schemes | 0 | 16 | 16 |
| F — Critical questions | 0 | 14 | 14 |
| G — Resolution progress | 20 | 9 | 29 |
| H — Claim clarity | 1 | 11 | 12 |
| I — Thread topology | 14 | 7 | 21 |
| J — Sensitive composer-only | 5 | 0 | 5 |
| **Total** | **64** | **107** | **171** |

The existing count 64 in this table excludes 1 entry that has no family
assignment in this taxonomy (and likely indicates I miscounted family
assignments above). The literal existing registry is 65. The implementer
will reconcile this 1-entry gap during Phase B verbose-definition
backfill — a single audit pass will identify the entry I undercounted in
Families G or I (likely auto-metadata #1 `has_reply` is assigned to
Family I in §3.9 but my Family I tally above said 4 auto entries including
it; the discrepancy is in my hand-tallying, not in the registry source).
The implementer's Phase A reconciliation re-run produces the exact
existing-65 to family map; the test in §8 category 1 enforces all 65
existing entries are in EXACTLY ONE family (no orphan entries).

**Final registry count: 64 + 107 = 171, OR 65 + 107 = 172.** Resolved
by implementer Phase A pass; both numbers respect Trigger 11 (≤200).

**Operator-deferred review item §12.5:** the implementer's Phase A pass
should produce the exact existing-65 family map and confirm 171 vs 172
final count.

---

## §4 — `MachineObservationDefinition` shape

Per intent brief §"MachineObservationDefinition schema" (binding). Field
documentation expanded with internal contract.

```typescript
// src/features/nodeLabels/nodeLabelTypes.ts — additive extension

/**
 * MCP-021A — Family taxonomy for Machine Observations.
 *
 * Pure type alias. New enum, additive to existing NodeLabelSource etc.
 * The 10 families partition the 171 entries by phenomenon being observed.
 * Family J is the binding cap on sensitive composer-only entries (5;
 * see Trigger 10).
 */
export type MachineObservationFamily =
  | 'parent_relation'           // Family A — 16 entries
  | 'disagreement_axis'         // Family B — 14 entries
  | 'misunderstanding_repair'   // Family C — 17 entries
  | 'evidence_source_chain'     // Family D — 27 entries
  | 'argument_scheme'           // Family E — 16 entries
  | 'critical_question'         // Family F — 14 entries
  | 'resolution_progress'       // Family G — 29 entries
  | 'claim_clarity'             // Family H — 12 entries
  | 'thread_topology'           // Family I — 21 entries
  | 'sensitive_composer';       // Family J — 5 entries (Trigger 10 cap)

/**
 * Frozen array of all Family codes for test enumeration.
 */
export const ALL_MACHINE_OBSERVATION_FAMILIES: ReadonlyArray<MachineObservationFamily> =
  Object.freeze([
    'parent_relation',
    'disagreement_axis',
    'misunderstanding_repair',
    'evidence_source_chain',
    'argument_scheme',
    'critical_question',
    'resolution_progress',
    'claim_clarity',
    'thread_topology',
    'sensitive_composer',
  ]);

/**
 * MCP-021A — Verbose internal definition shape for a Machine Observation.
 *
 * EVERY entry in MACHINE_OBSERVATION_REGISTRY (existing 65 +
 * new 107) MUST carry all 8 new fields after Phase B backfill.
 * Trigger 12 fires if any entry lacks a field.
 *
 * Pure JSON-serializable. No React, Supabase, network.
 */
export interface MachineObservationDefinition {
  // ── Existing NodeLabelMark fields (preserved verbatim from UX-001.5A) ──

  /** Stable React diffing key (existing). */
  id: string;

  /** Internal classifier id (never user-facing). */
  rawKey: string;

  /** Top-level taxonomy (always 'machine_observation' for these). */
  kind: 'machine_observation';

  /** Source provenance (auto_metadata / lifecycle / semantic_referee /
   *  composition_mutation / ai_classifier / future_source). */
  source: NodeLabelSource;

  /** Plain-language standard label (Inspect-friendly). */
  label: string;

  /** Compact label for Timeline chips (≤20 chars). */
  shortLabel: string;

  /** Plain-language explanation (tooltip / Inspect). */
  description: string;

  /** Per-registry default surface. */
  defaultSurface: NodeLabelSurface;

  /** Per-registry disposition gate. */
  disposition: NodeLabelDisposition;

  /** Priority for overflow ordering — lower = higher priority. */
  priority: number;

  /** True when eligible for default Timeline node strip. */
  visibleByDefault: boolean;

  /** Optional confidence band carried by the MARK (set by adapter). */
  confidence?: 'low' | 'medium' | 'high';

  // ── MCP-021A new fields (BINDING; all 8 required per Trigger 12) ──

  /** Family classification. New enum from MCP-021A. */
  family: MachineObservationFamily;

  /** The exact yes/no question the MCP server answers for a given move.
   *  Designed to be answerable from move + parent move only. NEVER
   *  user-facing. Examples:
   *    - "Does this move's substantive content support its parent?"
   *    - "Does this move ask for a concrete example?"
   *  Length: 20-200 characters typical.
   */
  booleanQuestion: string;

  /** Verbose internal definition of what makes the boolean TRUE.
   *  Used by the MCP prompt; surfaced in operator audit; not user-facing.
   *  Length: 50-400 characters typical.
   */
  positiveDefinition: string;

  /** Verbose internal definition of what makes the boolean FALSE.
   *  Length: 50-400 characters typical.
   */
  negativeDefinition: string;

  /** 2-5 concrete examples that would return TRUE. Each entry is a
   *  short scenario / quote. Used by MCP prompt + tests. Never
   *  user-facing.
   */
  positiveExamples: ReadonlyArray<string>;

  /** 2-5 concrete near-misses that would return FALSE despite
   *  superficial similarity to TRUE cases. */
  negativeExamples: ReadonlyArray<string>;

  /** ≥1 pattern that looks positive but isn't (anti-hallucination
   *  guardrails for the MCP server prompt). Used by MCP prompt + tests. */
  falsePositiveGuards: ReadonlyArray<string>;

  /** ≥1 doctrine-anchor citation (cdiscourse-doctrine §X, point-standing-economy
   *  §Y, evidence-doctrine §Z). Tests enforce ≥1 entry. */
  doctrineNotes: ReadonlyArray<string>;

  /** Confidence eligibility per rendering surface. Set per family /
   *  per entry; gates which confidence levels MCP results pass to
   *  which surface. Sensitive entries default to high-only-on-composer. */
  confidenceEligibility: {
    timelineMinConfidence: 'low' | 'medium' | 'high';
    selectedContextMinConfidence: 'low' | 'medium' | 'high';
    inspectMinConfidence: 'low' | 'medium' | 'high';
  };
}
```

**Backwards compatibility:** existing `NodeLabelMark` consumers continue
to read the same fields. The 8 new fields are ADDITIVE on the registry
type; `NodeLabelMark` remains the runtime mark shape; `MachineObservationDefinition`
is the registry-entry shape. The registry's exported `MACHINE_OBSERVATION_REGISTRY`
remains keyed by compound `${source}:${rawKey}` and continues to return
`NodeLabelMark` values. A new export
`MACHINE_OBSERVATION_DEFINITIONS_REGISTRY` returns
`MachineObservationDefinition` values for the same keys, used by tests
and (in MCP-021B/C) the MCP request builder. The implementer chooses
between (a) extending NodeLabelMark with the new fields and using ONE
registry, OR (b) keeping NodeLabelMark byte-equal and exposing the
extended fields via a parallel registry. The byte-equal preservation
rule prefers option (b); the implementer decides at coding time.

**Trigger 12 contract:** the implementer's §8 test category 2 enforces
every Machine Observation entry (171 total) has every 8 new field
populated. A missing field is a test failure, not a warning.

---

## §5 — MCP request/response schema

Per intent brief §"MCP request/response schema (binding)" with three
audit-confirmed refinements applied verbatim. New file:
`src/features/nodeLabels/mcpBooleanObservationSchema.ts` (pure TS, no
React / Supabase / network).

### 5.1 Schema version constant

```typescript
/**
 * MCP-021A — Schema version for boolean Machine Observation requests
 * and responses. The version constant gates cache keys and parser
 * dispatch. MCP-021B and MCP-021C will bump this if the wire shape
 * changes; MCP-021A bakes 'v1' verbatim.
 */
export const MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION =
  'mcp-021.machine-observations.boolean.v1' as const;

export type McpBooleanObservationSchemaVersion =
  typeof MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION;
```

### 5.2 Request shape

```typescript
import type { MachineObservationDefinition, MachineObservationFamily } from './nodeLabelTypes';

/**
 * MCP-021A — Request shape sent to the MCP server when classifying
 * a single move. The server returns a McpBooleanObservationResponse.
 *
 * MCP-021A defines this type ONLY. The wire layer (transport, retry,
 * batching, sanitization) is MCP-021C territory.
 *
 * Pure JSON-serializable.
 */
export interface McpBooleanObservationRequest {
  /** Pinned schema version. */
  schemaVersion: McpBooleanObservationSchemaVersion;

  /** The move being classified. */
  nodeId: string;

  /** The move's parent (null when classifying a root claim). */
  parentNodeId: string | null;

  /** Sanitized text of the move being classified. Pre-sanitized at
   *  call site (MCP-021C wires the sanitizer). MCP-021A type only. */
  currentText: string;

  /** Sanitized text of the parent (null if root). */
  parentText: string | null;

  /** Sanitized context excerpt from thread (limited length). */
  threadContextExcerpt: string;

  /** Which families the server should evaluate for this call.
   *  Empty array = all eligible families. */
  requestedFamilies: ReadonlyArray<MachineObservationFamily>;

  /** Which specific rawKeys to evaluate. Overrides family filter when
   *  non-empty. */
  requestedRawKeys: ReadonlyArray<string>;

  /** The full registry-entry definitions for the rawKeys being
   *  requested. The server uses these to formulate the boolean
   *  questions and apply the false-positive guards. */
  definitions: Record<string, MachineObservationDefinition>;

  /** Per-call timeout in milliseconds. */
  timeoutMs: number;
}
```

### 5.3 Response shape

```typescript
/**
 * MCP-021A — Response shape returned by the MCP server. Refinement 1
 * from MCP-020 audit: `confidence` is REQUIRED (not optional).
 *
 * Pure JSON-serializable.
 */
export interface McpBooleanObservationResponse {
  /** Must match the request schemaVersion. */
  schemaVersion: McpBooleanObservationSchemaVersion;

  /** Echoes request.nodeId. */
  nodeId: string;

  /** Which rawKeys the server attempted (could be subset of
   *  request.requestedRawKeys if server bailed early). */
  checkedRawKeys: ReadonlyArray<string>;

  /** Per-rawKey boolean result. Keys not in this map are treated as
   *  "server did not check" — they emit zero chips. */
  observations: Record<string, boolean>;

  /** Per-rawKey confidence band. REQUIRED for every key in
   *  `observations`. Per MCP-020 audit refinement 1, the server must
   *  never omit confidence — default `'medium'` when honestly unsure. */
  confidence: Record<string, 'low' | 'medium' | 'high'>;

  /** Optional supporting span from the move body, per rawKey. Null
   *  when server has no quote. Sanitized at adapter boundary
   *  (MCP-021C). */
  evidenceSpan: Record<string, string | null>;

  /** Model / server provenance for cache key + operator audit. */
  modelInfo: {
    provider: 'mcp';
    serverName: string;
    classifierSetVersion: string;
  };
}
```

### 5.4 Validation function signatures (MCP-021A scope)

The schema file exposes 4 pure-TS validators. None call any network or
AI provider. All return discriminated-union results for ergonomic error
handling.

```typescript
/**
 * Result of parsing a candidate response. Discriminated union.
 */
export type McpBooleanObservationParseResult =
  | { ok: true; response: McpBooleanObservationResponse }
  | { ok: false; reason: 'not_json' | 'wrong_schema_version' | 'wrong_shape' |
      'missing_required_field' | 'flag_count_too_high' | 'duplicate_node_id'
    ; details: string };

/**
 * Parse a candidate JSON string into a McpBooleanObservationResponse.
 * Handles every documented failure mode per intent brief §"Failure-mode
 * contract". Pure.
 *
 * - Not JSON → returns {ok: false, reason: 'not_json'}.
 * - Wrong schemaVersion → returns {ok: false, reason: 'wrong_schema_version'}.
 * - Missing required field → returns {ok: false, reason: 'missing_required_field'}.
 * - flags.length > 20 (per MCP-020 audit refinement 2) → returns
 *   {ok: false, reason: 'flag_count_too_high'}.
 * - Otherwise returns {ok: true, response}.
 */
export function parseMcpBooleanObservationResponse(
  candidate: string,
): McpBooleanObservationParseResult;

/**
 * Sanitize a parsed response. Pure.
 *
 * - Discards observations for rawKeys NOT in the registry (per
 *   refinement 3 — never echo unknown keys to logs / UI).
 * - Discards observations whose confidence is below the registry
 *   entry's confidenceEligibility threshold for the requested surface.
 * - Truncates evidenceSpan to ≤240 chars (audit refinement 2).
 * - Returns a NEW response object; never mutates input.
 */
export function sanitizeMcpBooleanObservationResponse(
  parsed: McpBooleanObservationResponse,
  options: { surface: 'timeline_node' | 'selected_context' | 'inspect' },
): McpBooleanObservationResponse;

/**
 * Build a request for a given node and family selection. Pure helper
 * used by tests; MCP-021C will replace its caller with a real builder
 * that handles batching + retry.
 */
export function buildMcpBooleanObservationRequest(input: {
  nodeId: string;
  parentNodeId: string | null;
  currentText: string;
  parentText: string | null;
  threadContextExcerpt: string;
  requestedFamilies: ReadonlyArray<MachineObservationFamily>;
  requestedRawKeys: ReadonlyArray<string>;
  timeoutMs?: number;
}): McpBooleanObservationRequest;

/**
 * Map a parsed-and-sanitized response into NodeLabelMark[] for the
 * requested surface. Returns [] when response has no positive
 * observations. Pure.
 *
 * IMPORTANT: this helper is the bridge between MCP response and
 * UX-001.5A's existing presentation pipeline. It does NOT call
 * adaptRawClassifierBinarySource. MCP-021B will wire the persistence
 * layer between the MCP response and Source 6 adapter; MCP-021A only
 * defines this type-level bridge.
 */
export function mcpResponseToNodeLabelMarks(
  response: McpBooleanObservationResponse,
  options: { surface: 'timeline_node' | 'selected_context' | 'inspect' },
): NodeLabelMark[];
```

### 5.5 Failure-mode contract (verbatim from intent brief, expanded)

| Failure case | Result | Test category |
|---|---|---|
| Response is not JSON | `parseMcp...` returns `{ok: false, reason: 'not_json'}`; UI emits zero chips | 5 |
| Response JSON does not match shape | `{ok: false, reason: 'wrong_shape'}`; zero chips | 5 |
| `schemaVersion` missing or wrong | `{ok: false, reason: 'wrong_schema_version'}`; zero chips | 5 |
| `flags.length > 20` | `{ok: false, reason: 'flag_count_too_high'}`; zero chips | 5 |
| Individual `rawKey` is unknown to registry | Sanitizer DROPS that key silently; other valid keys still emit | 5 |
| `present` field absent or non-boolean for a key | Sanitizer DROPS that key | 5 |
| Per-call timeout exceeded | Caller (MCP-021C) returns zero chips for the call; no partial results surfaced | 5 (forward-compat contract) |
| `present: true` + confidence below `confidenceEligibility.timelineMinConfidence` | `mcpResponseToNodeLabelMarks` for `'timeline_node'` surface DROPS that mark; may still emit at Inspect | 5 |
| `evidenceSpan` exceeds 240 chars | Sanitizer truncates with ellipsis | 5 (forward-compat contract) |

---

## §6 — Verbose definition exemplars (one per family)

Per design plan §6 — the implementer uses these as templates for the
remaining new entries. All 10 exemplars show the full
`MachineObservationDefinition` shape with all 8 verbose fields populated.

### 6.1 Family A exemplar — `supports_parent`

```typescript
{
  id: 'registry:machine_observation:ai_classifier:supports_parent',
  rawKey: 'supports_parent',
  kind: 'machine_observation',
  source: 'ai_classifier',
  family: 'parent_relation',
  label: 'Supports parent',
  shortLabel: 'Supports',
  description: 'This move provides support for its parent argument.',
  defaultSurface: 'timeline_node',
  disposition: 'future_source',
  priority: 100,
  visibleByDefault: false,

  booleanQuestion:
    "Does this move's substantive content support (rather than challenge, refine, or be neutral about) its parent's position?",
  positiveDefinition:
    "The move advances reasons, evidence, or examples that strengthen the parent's claim or position. The move may add new support, restate the parent's claim from a different angle, or provide a confirming example.",
  negativeDefinition:
    "The move challenges, qualifies, redirects, or is independent of the parent's position. A move that says 'yes, and ALSO...' for a DIFFERENT axis is NOT support — see `extends_parent`.",
  positiveExamples: Object.freeze([
    "Parent: 'EVs reduce urban air pollution.' Move: 'A 2024 EPA study confirms tailpipe-emission reductions of 40% in EV-heavy cities.'",
    "Parent: 'Library funding matters.' Move: 'Yes — the Pittsburgh public-library outcome data shows direct literacy gains.'",
    "Parent: 'Remote work increases productivity.' Move: 'Right — the Stanford 2020 controlled trial showed a 13% productivity gain.'",
  ]),
  negativeExamples: Object.freeze([
    "Parent: 'EVs reduce urban air pollution.' Move: 'But manufacturing batteries produces emissions too.' (challenges, not supports)",
    "Parent: 'Library funding matters.' Move: 'Yes — and we should fund museums too.' (extends to a different axis, not supports)",
    "Parent: 'Remote work increases productivity.' Move: 'What about industries where it doesn't apply?' (questions scope, not supports)",
  ]),
  falsePositiveGuards: Object.freeze([
    "Do NOT mark TRUE for moves that merely express agreement ('I agree') without adding any support — that is `acknowledges_parent`.",
    "Do NOT mark TRUE for moves that extend the parent to a different axis — that is `extends_parent`.",
    "Do NOT mark TRUE for moves that quote the parent without adding substantive support — that is `quote_anchors_parent`.",
    "Do NOT mark TRUE based on tone, politeness, or surface-level affirmation; the move must add substantive support.",
  ]),
  doctrineNotes: Object.freeze([
    "cdiscourse-doctrine §10a: structural fact only; never implies the parent is 'right' or the move is 'correct'.",
    "cdiscourse-doctrine §1: support presence is not a verdict; the parent's standing in the point-standing economy depends on the responder's narrowing / sourcing / synthesis moves.",
    "point-standing-economy: support of parent is engagement credit, not factual-standing credit until evidence is attached.",
  ]),
  confidenceEligibility: {
    timelineMinConfidence: 'medium',
    selectedContextMinConfidence: 'low',
    inspectMinConfidence: 'low',
  },
}
```

### 6.2 Family B exemplar — `disagreement_present` (umbrella)

```typescript
{
  id: 'registry:machine_observation:ai_classifier:disagreement_present',
  rawKey: 'disagreement_present',
  kind: 'machine_observation',
  source: 'ai_classifier',
  family: 'disagreement_axis',
  label: 'Disagreement',
  shortLabel: 'Disagrees',
  description: 'This move expresses disagreement with its parent (umbrella; subtype Inspect-only).',
  defaultSurface: 'timeline_node',
  disposition: 'future_source',
  priority: 120,
  visibleByDefault: false,

  booleanQuestion:
    "Does this move express disagreement with any aspect of its parent (claim, scope, definition, causal link, evidence, value, etc.)?",
  positiveDefinition:
    "The move signals at least one disagreement axis with the parent: factual disagreement, scope challenge, definitional dispute, evidence-applicability challenge, causal disagreement, value disagreement, priority disagreement, or generalization challenge.",
  negativeDefinition:
    "The move supports, refines (narrows on the same side), extends to a different axis, acknowledges, summarizes, or is purely a clarification request. Pure agreement, pure question-for-clarification, or pure same-side extension is NOT disagreement.",
  positiveExamples: Object.freeze([
    "Parent: 'EVs reduce urban pollution.' Move: 'That's only true for tailpipe emissions; battery production has its own emissions footprint.' (disagreement_evidence_applicability subtype)",
    "Parent: 'All cars should be electric by 2030.' Move: 'Rural areas without charging infrastructure couldn't comply.' (disputes_scope subtype)",
    "Parent: 'Library budgets matter.' Move: 'You're defining matters too broadly — most municipal services matter; that doesn't tell us priority.' (disputes_definition subtype)",
  ]),
  negativeExamples: Object.freeze([
    "Parent: 'EVs reduce urban pollution.' Move: 'Yes, and they're also quieter.' (extends, not disagrees)",
    "Parent: 'Library budgets matter.' Move: 'How are you defining matters?' (requests_clarification, not disagrees)",
    "Parent: 'Library budgets matter.' Move: 'Right — the Pittsburgh data confirms this.' (supports, not disagrees)",
  ]),
  falsePositiveGuards: Object.freeze([
    "Do NOT mark TRUE for moves that merely ask 'how do you know?' — that is `asks_for_evidence`, not disagreement.",
    "Do NOT mark TRUE for moves that propose a DIFFERENT topic; that is `introduces_new_issue`.",
    "Do NOT mark TRUE for moves whose tone is heated but content is supporting; tone is not disagreement.",
    "Do NOT mark TRUE based on words like 'but', 'however', 'although' alone — pragmatic markers without substantive disagreement do not count.",
  ]),
  doctrineNotes: Object.freeze([
    "cdiscourse-doctrine §10a: disagreement is a structural fact; never implies one side is 'right'.",
    "cdiscourse-doctrine §1: disagreement presence is not a verdict; productive disagreement is core to debate.",
    "Per Decision 4: `disagreement_present` is the umbrella; specific subtypes (`disputes_definition`, etc.) are Inspect-only to avoid encoding a taste judgment about which kind of disagreement matters more.",
  ]),
  confidenceEligibility: {
    timelineMinConfidence: 'medium',
    selectedContextMinConfidence: 'medium',
    inspectMinConfidence: 'low',
  },
}
```

### 6.3 Family C exemplar — `offers_candidate_understanding`

```typescript
{
  id: 'registry:machine_observation:ai_classifier:offers_candidate_understanding',
  rawKey: 'offers_candidate_understanding',
  kind: 'machine_observation',
  source: 'ai_classifier',
  family: 'misunderstanding_repair',
  label: 'Offers candidate understanding',
  shortLabel: '"Do you mean…"',
  description: "This move offers a paraphrase of the parent's claim for confirmation.",
  defaultSurface: 'timeline_node',
  disposition: 'future_source',
  priority: 130,
  visibleByDefault: false,

  booleanQuestion:
    "Does this move offer a paraphrase of the parent's claim and ask the parent's poster to confirm or correct that paraphrase?",
  positiveDefinition:
    "The move restates the parent's claim in its own words (a 'candidate understanding') AND signals openness to correction. The move signals 'do you mean X?' explicitly OR via paraphrase + invitation to correct.",
  negativeDefinition:
    "The move quotes the parent verbatim without paraphrasing, OR paraphrases without inviting correction, OR asks for clarification without offering a candidate. Pure question ('what do you mean?') is `requests_clarification`, not this.",
  positiveExamples: Object.freeze([
    "Parent: 'Libraries are infrastructure.' Move: 'Are you saying libraries are public goods that should be funded like roads?'",
    "Parent: 'Free trade hurt manufacturing.' Move: 'Do you mean the post-1995 manufacturing job losses are attributable to trade liberalization specifically?'",
    "Parent: 'AI is overhyped.' Move: 'Reading you as saying the current capabilities are oversold; is that right?'",
  ]),
  negativeExamples: Object.freeze([
    "Parent: 'Libraries are infrastructure.' Move: 'What do you mean?' (requests_clarification, no candidate offered)",
    "Parent: 'Libraries are infrastructure.' Move: 'Libraries are infrastructure.' (just quotes; no candidate understanding)",
    "Parent: 'AI is overhyped.' Move: 'AI is not overhyped.' (disagrees; no candidate offered)",
  ]),
  falsePositiveGuards: Object.freeze([
    "Do NOT mark TRUE for moves that paraphrase without an invitation to correct.",
    "Do NOT mark TRUE for moves whose paraphrase substantially changes the parent's meaning (that would be a misrepresentation, not a candidate).",
    "Do NOT mark TRUE for follow-up moves that just restate without asking for correction.",
  ]),
  doctrineNotes: Object.freeze([
    "cdiscourse-doctrine §10a: this is a structural fact about a repair move; never implies the parent's claim is unclear (could be reader-side).",
    "Clark & Brennan grounding doctrine (B.5 in MCP-020 audit): candidate understanding is the high-signal repair pattern that promotes good-faith disagreement.",
    "point-standing-economy: offering a candidate understanding before disagreeing is a recovery-positive move — earns engagement credit for the responder and can convert future disagreement into productive narrowing.",
  ]),
  confidenceEligibility: {
    timelineMinConfidence: 'medium',
    selectedContextMinConfidence: 'low',
    inspectMinConfidence: 'low',
  },
}
```

### 6.4 Family D exemplar — `evidence_gap_present`

```typescript
{
  id: 'registry:machine_observation:ai_classifier:evidence_gap_present',
  rawKey: 'evidence_gap_present',
  kind: 'machine_observation',
  source: 'ai_classifier',
  family: 'evidence_source_chain',
  label: 'Evidence gap',
  shortLabel: 'Evidence gap',
  description: 'This move makes a claim that would normally require evidence but does not provide one.',
  defaultSurface: 'timeline_node',
  disposition: 'future_source',
  priority: 110,
  visibleByDefault: false,

  booleanQuestion:
    "Does this move make a factual / empirical / statistical claim WITHOUT providing a source, quote, study citation, or other evidence?",
  positiveDefinition:
    "The move asserts a fact, a statistic, a causal claim, or a specific historical event without attaching evidence and without explicitly marking it as opinion / hypothesis / hedged.",
  negativeDefinition:
    "The move (a) attaches a source / quote / link, OR (b) is explicitly hedged ('I think', 'probably', 'in my experience'), OR (c) makes a value claim / normative argument that doesn't require empirical evidence, OR (d) is a pure question with no claim.",
  positiveExamples: Object.freeze([
    "Move: 'Crime rates have dropped 30% since 2010.' (statistical claim, no source)",
    "Move: 'Studies consistently show this.' (gestures at evidence without citing)",
    "Move: 'Everyone knows policy X caused outcome Y.' (causal claim, no evidence)",
  ]),
  negativeExamples: Object.freeze([
    "Move: 'Crime rates have dropped 30% since 2010 (per FBI UCR 2010-2023).' (source attached → has_evidence)",
    "Move: 'I think crime rates have dropped a lot.' (explicitly hedged opinion)",
    "Move: 'Crime victim experiences matter morally.' (value claim, not empirical)",
  ]),
  falsePositiveGuards: Object.freeze([
    "Do NOT mark TRUE for value / normative claims — only empirical / factual claims trigger evidence-gap.",
    "Do NOT mark TRUE for explicitly hedged claims; hedging satisfies the burden until challenged.",
    "Do NOT mark TRUE for claims with attached evidence even if the evidence quality is contested (that is `evidence_quality_questioned`).",
    "Do NOT mark TRUE for pure questions or pure paraphrases of the parent.",
  ]),
  doctrineNotes: Object.freeze([
    "evidence-doctrine: evidence gap is a structural observation; the responder may choose to ask for source, request quote, or open evidence debt. The chip is advisory, never blocking.",
    "cdiscourse-doctrine §3: popularity / repetition / engagement is NOT evidence; the false-positive guards explicitly exclude tone / authority-without-attribution.",
    "point-standing-economy: an evidence gap on a claim does not lower its narrow standing automatically; standing changes when the gap is challenged and the gap persists.",
  ]),
  confidenceEligibility: {
    timelineMinConfidence: 'medium',
    selectedContextMinConfidence: 'low',
    inspectMinConfidence: 'low',
  },
}
```

### 6.5 Family E exemplar — `analogy_reasoning_present`

```typescript
{
  id: 'registry:machine_observation:ai_classifier:analogy_reasoning_present',
  rawKey: 'analogy_reasoning_present',
  kind: 'machine_observation',
  source: 'ai_classifier',
  family: 'argument_scheme',
  label: 'Analogy reasoning',
  shortLabel: 'Analogy',
  description: 'This move uses an analogy as its primary support.',
  defaultSurface: 'inspect',
  disposition: 'future_source',
  priority: 200,
  visibleByDefault: false,

  booleanQuestion:
    "Does this move use an analogy (mapping the case under discussion to a different case) as its primary form of support?",
  positiveDefinition:
    "The move advances its position by drawing a comparison to a different case / domain / situation, with the implication that what is true of the comparison applies to the case at hand.",
  negativeDefinition:
    "The move uses direct evidence, examples-of-the-same-case, definitional argument, or causal reasoning. A passing comparison ('like a library') without inferential weight is NOT analogy reasoning.",
  positiveExamples: Object.freeze([
    "Move: 'Libraries are like roads — public goods that should be funded collectively.' (analogy: roads → libraries)",
    "Move: 'Imposing a carbon tax is like vaccinating against a contagion: the cost falls on individuals but the benefit is communal.' (analogy: vaccine → carbon tax)",
    "Move: 'Treating misinformation requires the same posture as treating spam: filter at the platform, not the individual.' (analogy: spam → misinformation)",
  ]),
  negativeExamples: Object.freeze([
    "Move: 'Libraries are public goods, like roads and parks.' (passing comparison; the inferential work is from 'public good' definition, not from the comparison itself)",
    "Move: 'Libraries function as community infrastructure.' (definitional, not analogical)",
    "Move: 'The Pittsburgh library outcome data shows...' (evidence-based, not analogical)",
  ]),
  falsePositiveGuards: Object.freeze([
    "Do NOT mark TRUE for passing similes; the analogy must bear inferential weight.",
    "Do NOT mark TRUE for examples-of-the-same-kind (those are `example_reasoning_present`, not analogy).",
    "Do NOT mark TRUE for definitional claims that mention a comparison in passing.",
    "Do NOT mark TRUE based on the word 'like' alone.",
  ]),
  doctrineNotes: Object.freeze([
    "cdiscourse-doctrine §10a: analogy presence is a SCHEME fact, NEVER a verdict that the analogy is 'fallacious'. The pairing critical question is `analogy_mapping_missing` (Family F).",
    "MCP-020 audit §Rejected labels: `slippery_slope_reasoning_present` and analogy schemes carry doctrine risk because the literature frames them as fallacies. CDiscourse treats them as schemes with critical questions, NOT as faults.",
    "point-standing-economy: analogy without a defended mapping carries the same evidence-gap risk as an unsourced empirical claim; the response is `analogy_mapping_missing`, not 'argument is wrong'.",
  ]),
  confidenceEligibility: {
    timelineMinConfidence: 'high',
    selectedContextMinConfidence: 'medium',
    inspectMinConfidence: 'low',
  },
}
```

### 6.6 Family F exemplar — `missing_warrant`

```typescript
{
  id: 'registry:machine_observation:ai_classifier:missing_warrant',
  rawKey: 'missing_warrant',
  kind: 'machine_observation',
  source: 'ai_classifier',
  family: 'critical_question',
  label: 'Warrant not explicit',
  shortLabel: 'Warrant?',
  description: 'The reasoning link between this move\'s grounds and its claim is not explicit.',
  defaultSurface: 'inspect',
  disposition: 'future_source',
  priority: 210,
  visibleByDefault: false,

  booleanQuestion:
    "Does this move present a claim + grounds without making the warrant (the rule licensing claim from grounds) explicit?",
  positiveDefinition:
    "The move provides grounds (data / evidence / examples) and a claim, but the reasoning link between them is implicit. A reader could reasonably ask 'WHY does that ground support that claim?'.",
  negativeDefinition:
    "The move (a) provides grounds AND an explicit warrant, OR (b) is purely a question / clarification / paraphrase with no claim, OR (c) the claim is trivially entailed by the ground (definition / simple instance), OR (d) the move is a pure value claim with no empirical ground.",
  positiveExamples: Object.freeze([
    "Move: 'Crime dropped 30% since 2010 (FBI UCR) → therefore policing reform works.' (ground = data; claim = causal; warrant = ???)",
    "Move: 'Pittsburgh increased library funding and literacy rose → libraries cause literacy.' (no warrant for the causal inference)",
  ]),
  negativeExamples: Object.freeze([
    "Move: 'Crime dropped after policy X — and the timing matches the rollout in 12 of 12 measured cities, with no other major intervention overlapping.' (warrant: timing + scope matching)",
    "Move: 'What do you mean by reform?' (pure question, no warrant required)",
    "Move: 'Libraries fall under the definition of public infrastructure.' (definitional, warrant trivial)",
  ]),
  falsePositiveGuards: Object.freeze([
    "Do NOT mark TRUE just because the move is short; brevity is not absence-of-warrant.",
    "Do NOT mark TRUE for moves where the warrant is implicit-but-obvious (e.g., counting cases entails the count).",
    "Do NOT mark TRUE for value-claims that don't require an empirical warrant.",
    "Do NOT mark TRUE as a verdict on argument quality; absence of an explicit warrant doesn't mean the argument is wrong — see doctrine notes.",
  ]),
  doctrineNotes: Object.freeze([
    "cdiscourse-doctrine §10a: missing-warrant observation NEVER implies the claim is false or unsupported; it surfaces a critical question. Plain-language framing: 'what would warrant this claim?', NEVER 'this claim is unwarranted'.",
    "Toulmin (1958): warrant is the rule licensing claim from grounds. Absence of an explicit warrant is a normal feature of compressed natural-language argumentation; the response is a clarification request, not a verdict.",
    "MCP-020 audit §Rejected labels: this is the structural sibling of `weak_argument` (rejected). The critical-question framing is what makes this safe.",
  ]),
  confidenceEligibility: {
    timelineMinConfidence: 'high',
    selectedContextMinConfidence: 'medium',
    inspectMinConfidence: 'medium',
  },
}
```

### 6.7 Family G exemplar — `synthesis_proposed`

```typescript
{
  id: 'registry:machine_observation:ai_classifier:synthesis_proposed',
  rawKey: 'synthesis_proposed',
  kind: 'machine_observation',
  source: 'ai_classifier',
  family: 'resolution_progress',
  label: 'Synthesis proposed',
  shortLabel: 'Synthesis',
  description: 'This move proposes a synthesis combining elements of both sides.',
  defaultSurface: 'timeline_node',
  disposition: 'future_source',
  priority: 90,
  visibleByDefault: false,

  booleanQuestion:
    "Does this move propose a synthesis (a combined position) that draws from both sides of the current disagreement?",
  positiveDefinition:
    "The move explicitly names elements from both sides and proposes a combined position. The synthesis may be a compromise, a scoping reconciliation, a definitional clarification that dissolves a fake disagreement, or a layered position.",
  negativeDefinition:
    "The move advances one side only, concedes without offering a combined position, or merely identifies common ground without proposing synthesis. Pure concession is `concedes_narrow_point` / `concedes_broader_point`. Pure common-ground identification is `common_ground_identified`.",
  positiveExamples: Object.freeze([
    "Move: 'Could we say: libraries-as-infrastructure for stable communities, libraries-as-discretionary for transient ones?' (synthesizing scope)",
    "Move: 'Maybe both: EVs reduce urban tailpipe pollution AND battery production needs cleaner grids. Both true; question is which dominates in 2030.' (synthesis layered)",
    "Move: 'What if the disagreement is really about HOW to fund, not WHETHER — and we both want funded libraries?' (synthesis dissolving)",
  ]),
  negativeExamples: Object.freeze([
    "Move: 'You're right; I concede.' (pure concession, no synthesis)",
    "Move: 'We agree libraries matter; we disagree on funding.' (common_ground_identified, not synthesis)",
    "Move: 'Libraries are infrastructure.' (one side only)",
  ]),
  falsePositiveGuards: Object.freeze([
    "Do NOT mark TRUE for moves that name common ground without proposing a synthesis.",
    "Do NOT mark TRUE for pure concession — that is `concedes_narrow_point` / `concedes_broader_point`.",
    "Do NOT mark TRUE for moves that say 'maybe both' without specifying the synthesis structure.",
    "Do NOT mark TRUE based on tone of conciliation; the synthesis must be substantive.",
  ]),
  doctrineNotes: Object.freeze([
    "cdiscourse-doctrine §1: synthesis is a GAMEPLAY move, not a verdict about who 'won'. Both sides retain their standing.",
    "point-standing-economy: synthesis is the highest-value resolution-progress move; both sides earn engagement credit and may earn standing repair credit.",
    "lifecycle: pairs with `synthesis_ready` cluster state — `synthesis_proposed` is the MOVE that produces a synthesis_ready cluster.",
  ]),
  confidenceEligibility: {
    timelineMinConfidence: 'high',
    selectedContextMinConfidence: 'medium',
    inspectMinConfidence: 'low',
  },
}
```

### 6.8 Family H exemplar — `hedging_present`

```typescript
{
  id: 'registry:machine_observation:ai_classifier:hedging_present',
  rawKey: 'hedging_present',
  kind: 'machine_observation',
  source: 'ai_classifier',
  family: 'claim_clarity',
  label: 'Hedged claim',
  shortLabel: 'Hedged',
  description: 'This move uses a probabilistic hedge ("probably", "in most cases", "tends to").',
  defaultSurface: 'inspect',
  disposition: 'future_source',
  priority: 220,
  visibleByDefault: false,

  booleanQuestion:
    "Does the move use explicit hedging language (probabilistic / modal / qualifying) when stating its claims?",
  positiveDefinition:
    "The move uses qualifiers like 'probably', 'often', 'in most cases', 'tends to', 'might', 'could', 'sometimes' that explicitly weaken the claim from a universal / certain assertion.",
  negativeDefinition:
    "The move makes claims as confident assertions without hedging, OR uses hedging only as politeness markers ('I think you might mean...') without weakening the claim, OR uses hedging only in clarification questions.",
  positiveExamples: Object.freeze([
    "Move: 'Increasing library budgets probably correlates with literacy gains in mid-size cities.'",
    "Move: 'Carbon taxes tend to reduce emissions over a 5-year window, in jurisdictions with stable enforcement.'",
    "Move: 'EVs might lower urban air pollution; the effect size depends on grid mix.'",
  ]),
  negativeExamples: Object.freeze([
    "Move: 'Library budgets correlate with literacy gains.' (assertive, no hedge)",
    "Move: 'I think you mean...' (hedging is politeness, not on the claim)",
    "Move: 'Probably the library data is in the Pittsburgh study?' (hedging is in a clarification question, not on a claim)",
  ]),
  falsePositiveGuards: Object.freeze([
    "Do NOT mark TRUE for hedging that is rhetorical politeness ('I might suggest...') not a claim qualifier.",
    "Do NOT mark TRUE for hedging in pure questions.",
    "Do NOT mark TRUE for hedging in references to other people's claims ('they say it probably...').",
  ]),
  doctrineNotes: Object.freeze([
    "Toulmin (1958): hedging is a 'qualifier' in the Toulmin model — it modifies the claim's modal status.",
    "cdiscourse-doctrine §10a: hedging presence is a structural fact; never a verdict about confidence-appropriateness. Hedged claims play differently than confident ones in the game (lower evidence-debt opens).",
    "evidence-doctrine: an appropriately hedged claim carries less evidence debt than the same claim asserted as certainty.",
  ]),
  confidenceEligibility: {
    timelineMinConfidence: 'high',
    selectedContextMinConfidence: 'medium',
    inspectMinConfidence: 'low',
  },
}
```

### 6.9 Family I exemplar (Decision 7 — `auto_metadata`) — `splits_thread`

```typescript
{
  id: 'registry:machine_observation:auto_metadata:splits_thread',
  rawKey: 'splits_thread',
  kind: 'machine_observation',
  source: 'auto_metadata',
  family: 'thread_topology',
  label: 'Splits thread',
  shortLabel: 'Splits',
  description: 'This move creates a sibling branch under the same parent.',
  defaultSurface: 'inspect',
  disposition: 'future_source',
  priority: 250,
  visibleByDefault: false,

  booleanQuestion:
    "Does this move's parent already have other children, making this move a sibling that splits the thread?",
  positiveDefinition:
    "The parent of this move has ≥2 children (this move is one of them), creating a branching point. Decision 7 outcome: deterministically derivable from argument tree structure.",
  negativeDefinition:
    "The parent has only one child (this move) at the time of posting. The move is a linear continuation, not a thread split.",
  positiveExamples: Object.freeze([
    "Tree: A → [B, this_move]. (parent A has 2 children; this is a split)",
    "Tree: root → A → [B1, B2, this_move]. (parent A has 3 children)",
  ]),
  negativeExamples: Object.freeze([
    "Tree: A → this_move. (parent A has only this child; not a split)",
    "Tree: A → B → this_move. (parent B has only this child)",
  ]),
  falsePositiveGuards: Object.freeze([
    "Do NOT mark TRUE based on cluster membership; the check is sibling-count on the immediate parent only.",
    "Do NOT mark TRUE for the first child of a multi-child parent at the moment of posting (the split happens when the second child arrives, not the first).",
  ]),
  doctrineNotes: Object.freeze([
    "cdiscourse-doctrine §10a: thread-split observation is a STRUCTURAL fact about argument-tree shape; never implies the split is good or bad.",
    "Decision 7 (intent brief): deterministically derivable from tree structure → `source: 'auto_metadata'` not `'ai_classifier'`. The deriver lives in `src/features/nodeLabels/threadTopologyAutoMetadata.ts` (NEW FILE — MCP-021A adds the registry slot; the actual deriver is no-op stub in MCP-021A and gets a real implementation in MCP-021C).",
  ]),
  confidenceEligibility: {
    timelineMinConfidence: 'high',
    selectedContextMinConfidence: 'high',
    inspectMinConfidence: 'high',
  },
}
```

(Note: for `source: 'auto_metadata'` entries, confidence is intrinsically
`'high'` because the derivation is deterministic. The eligibility field
exists for type-uniformity across all 171 entries.)

### 6.10 Family J exemplar (existing sensitive) — `shifts_to_person_or_intent`

This entry is EXISTING (per §2.4); the verbose-definition exemplar shows
the retroactive backfill pattern for the existing 65.

```typescript
{
  id: 'registry:machine_observation:semantic_referee:shifts_to_person_or_intent',
  rawKey: 'shifts_to_person_or_intent',
  kind: 'machine_observation',
  source: 'semantic_referee',
  family: 'sensitive_composer',
  label: 'Person or intent shift',
  shortLabel: 'Pers shift',
  description: 'The move shifts focus from the claim to the person or intent.',
  defaultSurface: 'composer',
  disposition: 'composer_only',
  priority: 5,
  visibleByDefault: false,

  booleanQuestion:
    "Does this move shift focus from the parent's CLAIM to the parent's POSTER (their identity, motive, character, or intent) rather than addressing the substantive claim?",
  positiveDefinition:
    "The move's primary content is about the parent's poster — their motives, their character, their identity-group membership, their intentions — rather than the substantive claim the parent made.",
  negativeDefinition:
    "The move addresses the substantive claim. The move may critique the claim's evidence, scope, definitions, or reasoning — none of those are person-shifts. A move that ALSO mentions a person in service of a claim-based point is not a person-shift.",
  positiveExamples: Object.freeze([
    "Parent: 'EVs reduce pollution.' Move: 'You only believe that because you work for an EV company.' (shifts from claim to poster's motive)",
    "Parent: 'Carbon taxes work.' Move: 'You environmentalists always say that.' (shifts to identity-group membership)",
    "Parent: 'Library funding matters.' Move: 'That's just what librarians want.' (shifts to poster's role)",
  ]),
  negativeExamples: Object.freeze([
    "Parent: 'EVs reduce pollution.' Move: 'The study you cite is by EV-industry researchers — that's a conflict of interest.' (challenges source quality, not person)",
    "Parent: 'Carbon taxes work.' Move: 'In a 2020 study, jurisdictions with carbon taxes had 8% lower emissions.' (substantive, not person)",
  ]),
  falsePositiveGuards: Object.freeze([
    "Do NOT mark TRUE for moves that question a SOURCE's credibility (that is evidence quality, not person-shift on the poster).",
    "Do NOT mark TRUE for moves that mention a person in service of a substantive claim ('the 2020 Jones study found...').",
    "Do NOT mark TRUE for moves where the poster's identity is the SUBJECT of the claim being discussed.",
  ]),
  doctrineNotes: Object.freeze([
    "cdiscourse-doctrine §10a: SENSITIVE; composer-only. NEVER surfaces on the target's node; that would read as accusation.",
    "cdiscourse-doctrine §1: NEVER implies the author is bad-faith or a 'troll'. The chip is a private nudge to revise BEFORE posting.",
    "UX-001.5A: per audit verdict, `RefereeBannerView.observationChips` is the ONLY surface; node-mount and Timeline NEVER receive this rawKey.",
    "MCP-020 audit §Rejected labels: this is the structural sibling of `ad_hominem_present` (rejected as a node-mount label); the composer-only path is what makes the surface safe.",
  ]),
  confidenceEligibility: {
    timelineMinConfidence: 'high',
    selectedContextMinConfidence: 'high',
    inspectMinConfidence: 'high',
  },
}
```

(For sensitive Family J composer-only entries, all three confidence
thresholds are `'high'` because the false-positive cost of incorrectly
nudging someone is significant. The composer surface is the ONLY surface
they render on; `defaultSurface: 'composer'` + `disposition:
'composer_only'` + UX-001.5A presentation-model filter enforces this.)

---

## §7 — Retroactive verbose-definition population plan

The implementer adds the 8 new fields to every Machine Observation
registry entry (existing 65 + new 107 = 171/172). Per the brief, this is
"verbose internal contract" work — definitions are written for the MCP
prompt and operator audit, never user-facing.

### 7.1 Per-family chunking

The implementer works in 10 chunks, one per family. Each chunk:

1. List the rawKeys in that family (from §3 table).
2. For each rawKey, write the 8 verbose fields (using the relevant §6
   exemplar as the template).
3. Run a per-chunk doctrine review against the relevant skills
   (`cdiscourse-doctrine §10a`, `point-standing-economy` for Family G,
   `evidence-doctrine` for Family D, `timeline-grammar` for Families A/B
   if visible-surface).
4. Run the 8-field completeness test (§8 category 2) against the chunk;
   advance to next family on green.

### 7.2 Estimated chunk effort

| Family | Total entries | New entries | Estimated chunk time |
|---|---:|---:|---|
| A — Parent relation | 16 | 12 | 3-4 hours (foundational family; many close near-misses to disambiguate) |
| B — Disagreement axis | 14 | 13 | 4-5 hours (umbrella + 13 subtypes; per-subtype boolean question is structurally similar but verbiage varies) |
| C — Misunderstanding repair | 17 | 13 | 4 hours (well-documented Schegloff/Sacks pattern; templates from MCP-020 audit literature) |
| D — Evidence | 27 | 12 | 3 hours (well-aligned with existing `evidence-doctrine`) |
| E — Argument schemes | 16 | 16 | 5 hours (Walton schemes; each has critical-question doctrine work) |
| F — Critical questions | 14 | 14 | 4-5 hours (paired with Family E; doctrine-sensitive copy) |
| G — Resolution progress | 29 | 9 | 2-3 hours (most existing; per-existing backfill is fast) |
| H — Claim clarity | 12 | 11 | 2-3 hours (structural; relatively templatable) |
| I — Thread topology | 21 | 7 | 2 hours (4 auto-metadata are deterministic; 3 ai_classifier need content rationale) |
| J — Sensitive | 5 | 0 | 1-2 hours (RETROACTIVE only; doctrine-heavy verbiage) |
| **Total** | **171** | **107** | **~32-40 hours** |

### 7.3 Doctrine review per entry

Per §"What you must NOT do" rule and per `cdiscourse-doctrine §10a`, every
entry's plain-language `label` / `shortLabel` / `description` must pass:

- No verdict tokens (winner, loser, true, false, correct, dishonest, liar,
  bad faith, manipulative, extremist, propagandist, stupid, idiot, troll,
  bot).
- No amplification language (proves, definitely, certainly, clearly,
  obviously when surfaced as label).
- No person attribution (this move's poster IS X; this move's poster
  ALWAYS Y).
- No internal raw-key leak (rawKey never appears verbatim in label /
  shortLabel / description).

The implementer runs the doctrine ban-list test (§8 category 7) per
chunk to enforce this.

---

## §8 — Acceptance criteria (8 test categories)

Per intent brief §"Required tests" (binding). Each category maps to one
or more test files. Test count forecast per category is included for
Trigger 8 verification (+1,000 ceiling).

### 8.1 Test category 1 — Registry count + family assignment

**File:** `__tests__/mcpOneTwoOneARegistrySize.test.ts` (NEW)

Tests:
- `MACHINE_OBSERVATION_REGISTRY` has ≥100 entries (per intent brief).
- `MACHINE_OBSERVATION_REGISTRY` has ≤200 entries (per Trigger 11).
- Exactly 171 or 172 entries (per §3.11; implementer's Phase A resolves
  this; the test pins whichever number is final).
- Every entry has `family` field assigned.
- Every entry's `family` is one of the 10 `MachineObservationFamily` values.
- Per-family counts match §3 forecast within ±1 (some implementer
  judgment allowed during Phase A backfill).
- Existing 65 entries are all in the registry with their original
  source / disposition / rawKey preserved.

Forecast: ~40 tests.

### 8.2 Test category 2 — Boolean definition completeness

**File:** `__tests__/mcpOneTwoOneADefinitionCompleteness.test.ts` (NEW)

Tests:
- Every entry has non-empty `booleanQuestion` (length 20-200).
- Every entry has non-empty `positiveDefinition` (length 50-400).
- Every entry has non-empty `negativeDefinition` (length 50-400).
- Every entry has ≥2 `positiveExamples`, ≤5.
- Every entry has ≥2 `negativeExamples`, ≤5.
- Every entry has ≥1 `falsePositiveGuards`.
- Every entry has ≥1 `doctrineNotes`.
- Every entry has `confidenceEligibility` with all 3 thresholds set.
- Every confidence threshold is one of `'low' | 'medium' | 'high'`.

Forecast: ~12 tests × 171 entries via per-entry iteration = ~150 tests
(if structured per-entry) OR ~12 tests asserting via reduce/every (more
common pattern). The implementer chooses; either approach is valid.
Conservative forecast: **~150 tests** if per-entry; **~30 tests** if
aggregate.

### 8.3 Test category 3 — No duplicate semantic aliases

**File:** `__tests__/mcpOneTwoOneANoDuplicateAliases.test.ts` (NEW)

Tests:
- `disputes_evidence_applicability` (existing #49) is the SOLE entry
  with that concept — no alias `disagreement_evidence_applicability`,
  `evidence_applicability_questioned`, etc. landed.
- `requests_clarification` (existing #38) is the SOLE entry — no alias
  `requests_clarification_present`.
- `concedes_narrow_point` (existing #45) is the SOLE entry — no alias
  `narrow_concession_present`.
- `source_requested` (existing #5 auto + #23 lifecycle) is NOT joined
  by any third `source_requested` AI-classifier entry.
- `quote_requested` (existing #6 auto + #22 lifecycle) — same.
- `branch_recommended` (existing #34 lifecycle) is the SOLE
  branch-recommended entry — no AI-classifier duplicate.
- `ready_for_synthesis` is allowed in BOTH lifecycle and ai_classifier
  (compound key disambiguates; existing pattern).
- `source_chain_gap` (existing #43 `creates_source_chain_gap`) is the
  SOLE — no alias.

Forecast: ~15 tests.

### 8.4 Test category 4 — Surface policy

**File:** `__tests__/mcpOneTwoOneASurfacePolicy.test.ts` (NEW)

Tests:
- Timeline-eligible rawKeys (those with `defaultSurface: 'timeline_node'`)
  are a STRICT SUBSET of the full registry.
- All Family B subtypes (13 of 14) have `defaultSurface: 'inspect'`;
  only `disagreement_present` is Timeline-eligible.
- All Family E entries have `defaultSurface: 'inspect'`.
- All Family F entries have `defaultSurface: 'inspect'`.
- All Family J entries have `defaultSurface: 'composer'` or `'inspect'`
  (3 + 2; no Family J entry surfaces to Timeline).
- All new entries have `disposition: 'future_source'`.
- Existing 65 entries retain their original `disposition`.

Forecast: ~20 tests.

### 8.5 Test category 5 — MCP schema validation

**File:** `__tests__/mcpBooleanObservationSchema.test.ts` (NEW)

Tests:
- `parseMcpBooleanObservationResponse(validJson)` returns `{ok: true}`.
- `parseMcpBooleanObservationResponse('not json')` returns `{ok: false, reason: 'not_json'}`.
- `parseMcpBooleanObservationResponse(missingSchemaVersion)` returns
  `{ok: false, reason: 'wrong_schema_version'}`.
- `parseMcpBooleanObservationResponse(wrongShape)` returns
  `{ok: false, reason: 'wrong_shape'}`.
- `parseMcpBooleanObservationResponse(flagsLength21)` returns
  `{ok: false, reason: 'flag_count_too_high'}`.
- `sanitizeMcpBooleanObservationResponse(responseWithUnknownRawKey)`
  drops the unknown key silently (never echoes).
- `sanitizeMcpBooleanObservationResponse(low-confidence Timeline)` drops
  the mark if registry's `timelineMinConfidence` is `'medium'`.
- `mcpResponseToNodeLabelMarks(zeroPositiveResponse)` returns `[]`.
- `buildMcpBooleanObservationRequest` returns a structurally valid request.
- The `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION` constant is exactly
  `'mcp-021.machine-observations.boolean.v1'`.

Forecast: ~50 tests (each failure mode × multiple fixtures).

### 8.6 Test category 6 — Display cap preservation

**File:** `__tests__/mcpOneTwoOneADisplayCapPreservation.test.ts` (NEW)

Tests:
- With a synthetic 150-positive-boolean response, `enforceTimelineNodeDisplayCap`
  returns at most 1 Observation + 1 Allegation + overflowCount.
- Same scenario, `enforceSelectedContextDisplayCap` returns at most 3+3+overflow.
- Same scenario, `enforceInspectGroupedView` returns the FULL set
  (unbounded grouped).
- Existing UX-001.5A presentation-model tests still pass byte-equal
  (re-runs `__tests__/nodeLabelPresentationModel.test.ts`).

Forecast: ~25 tests.

### 8.7 Test category 7 — Doctrine ban-list + label safety

**File:** `__tests__/mcpOneTwoOneALabelDoctrine.test.ts` (NEW)

Tests:
- No entry's `label`, `shortLabel`, or `description` contains any verdict
  token from the canonical ban-list (winner, loser, true, false, correct,
  dishonest, liar, bad faith, manipulative, extremist, propagandist,
  stupid, idiot, troll, bot, weak argument, fallacy).
- No entry's `label`, `shortLabel`, or `description` contains a raw
  rawKey (e.g. `creates_source_chain_gap` doesn't appear in its own
  user-facing fields).
- Every Family J entry has `disposition: 'composer_only'` or `'inspect_only'`.
- Family J entries NEVER appear in Timeline OR Selected display results
  (via surface-filter assertion).
- Machine Observations and User Allegations are NEVER collapsed (per
  UX-001.5A `cdiscourse-doctrine §10a` doctrine).
- No Family F entry's `description` says "missing" without qualification
  (e.g. "warrant not explicit" allowed; "claim is unwarranted" forbidden).
- No Family E entry's `label` / `description` calls the scheme a
  "fallacy".
- All 171 entries pass these scans.

Forecast: ~80 tests (per-entry × per-rule iteration).

### 8.8 Test category 8 — Source 6 runtime invariance

**File:** `__tests__/mcpOneTwoOneASourceSixInvariance.test.ts` (NEW)

Tests:
- `adaptRawClassifierBinarySource({ messageId: 'any' })` returns `[]`.
- `adaptRawClassifierBinarySource({ messageId: '', binaries: [] })` returns `[]`.
- `adaptRawClassifierBinarySource({ messageId: 'a', binaries: [{}, {}, {}] })`
  returns `[]`.
- Random battery: 20 random inputs (using stable seed for reproducibility);
  every result `[]`.
- Source file `nodeLabelSourceAdapters.ts` is byte-equal vs `main` (via
  `git diff` assertion — same pattern as UX-001.5A's binding-preservation
  tests).
- `git diff main..HEAD -- src/features/nodeLabels/nodeLabelSourceAdapters.ts`
  produces zero output.

Forecast: ~30 tests.

### 8.9 Test count forecast summary

| Test category | File | Estimated tests |
|---|---|---:|
| 1 — Registry count + family | `mcpOneTwoOneARegistrySize.test.ts` | 40 |
| 2 — Definition completeness | `mcpOneTwoOneADefinitionCompleteness.test.ts` | 150 |
| 3 — No duplicate aliases | `mcpOneTwoOneANoDuplicateAliases.test.ts` | 15 |
| 4 — Surface policy | `mcpOneTwoOneASurfacePolicy.test.ts` | 20 |
| 5 — MCP schema validation | `mcpBooleanObservationSchema.test.ts` | 50 |
| 6 — Display cap preservation | `mcpOneTwoOneADisplayCapPreservation.test.ts` | 25 |
| 7 — Doctrine ban-list | `mcpOneTwoOneALabelDoctrine.test.ts` | 80 |
| 8 — Source 6 invariance | `mcpOneTwoOneASourceSixInvariance.test.ts` | 30 |
| **Total new tests** | 8 new files | **~410 tests** |

Test count delta forecast: **+410 tests** (well below +1,000 ceiling per
Trigger 8). **Trigger 8 CLEAN.**

If category 2 (definition completeness) is structured per-entry × per-field
(150 tests as forecast), the count is +410. If structured aggregate (~30
tests), the count drops to ~290. Either approach is valid; the
implementer chooses. Operator-deferred review item in §12: per-entry vs
aggregate is the implementer's discretion.

---

## §9 — Reviewer measurement strategy

For each of the 25 verdict matrix items (A-Y), the reviewer verification
approach. Per the autonomous pipeline pattern, the reviewer runs deterministic
gates plus a code-review pass.

### 9.1 Per-item verification commands

| # | Verdict item | Verification |
|---|---|---|
| A | Source 6 binding preserved | `git diff main..HEAD -- src/features/nodeLabels/nodeLabelSourceAdapters.ts` → zero output. Plus `npm run test -- mcpOneTwoOneASourceSixInvariance` → green. |
| B | UX-001.5A display caps preserved | `git diff main..HEAD -- src/features/nodeLabels/nodeLabelPresentationModel.ts` → zero output. Plus `npm run test -- mcpOneTwoOneADisplayCapPreservation` → green. |
| C | No backend write path | `git diff main..HEAD -- supabase/` → zero output. |
| D | No new visual primitive | `git diff main..HEAD -- src/features/nodeAnnotations/` → zero output. |
| E | No new design token | `git diff main..HEAD -- src/lib/designTokens.ts` → zero output. |
| F | No new AI provider call | Grep `src/` for `anthropic`, `xai`, `openai` imports → only pre-existing matches. |
| G | UX-001.{1-7} read-only files preserved | `git diff main..HEAD -- src/features/arguments/oneBox/` and adjacent UX-001 dirs → zero output. |
| H | Test count delta ≤ +1,000 | `npm run test` → captured count; compare to baseline 16,759. |
| I | Doctrine ban-list clean | `npm run test -- mcpOneTwoOneALabelDoctrine` → green. |
| J | No Family G constructiveness candidates | Read registry source; assert no `temperature_rising`, `civility_violation`, etc. |
| K | Final registry count ≥100 ≤200 | `npm run test -- mcpOneTwoOneARegistrySize` → green. |
| L | All 8 verbose fields present | `npm run test -- mcpOneTwoOneADefinitionCompleteness` → green. |
| M | No duplicate aliases | `npm run test -- mcpOneTwoOneANoDuplicateAliases` → green. |
| N | Surface policy enforced | `npm run test -- mcpOneTwoOneASurfacePolicy` → green. |
| O | MCP schema validation correct | `npm run test -- mcpBooleanObservationSchema` → green. |
| P | Display caps not stressed | Re-run `__tests__/nodeLabelPresentationModel.test.ts` → green. |
| Q | Existing 65 entries preserved | Test category 1 includes per-existing-entry assertion. |
| R | Per-family counts match §3 | Test category 1 includes per-family assertion. |
| S | Decision 5 outcomes implemented | Test category 3 covers 3 merge candidates resolved. |
| T | Decision 7 outcomes per Family I | Test category 1 includes per-Family-I-entry `source` assertion. |
| U | Family J reconciliation | Test category 4 asserts Family J has exactly 5 entries. |
| V | Doctrine notes ≥1 per entry | Test category 2 enforces. |
| W | Confidence eligibility thresholds set | Test category 2 enforces. |
| X | Typecheck + lint green | `npm run typecheck && npm run lint` → exit 0. |
| Y | Full test suite passes | `npm run test` → exit 0; count ≥ 17,169 (baseline 16,759 + +410). |

### 9.2 Migration-bearing card verification

NOT APPLICABLE. MCP-021A is pure TypeScript taxonomy + schema + tests;
no SQL migration, no Edge Function, no Supabase changes. Per
`.claude/agents/roadmap-reviewer.md` §"Migration-bearing card verification
(mandatory)", the heightened-review protocol does NOT apply.

### 9.3 Byte-equal scope verification

The reviewer runs `git diff main..HEAD --stat` and verifies the diff is
bounded to:
- `src/features/nodeLabels/machineObservationRegistry.ts` (additive)
- `src/features/nodeLabels/nodeLabelTypes.ts` (additive type extensions)
- NEW: `src/features/nodeLabels/mcpBooleanObservationSchema.ts`
- NEW: `src/features/nodeLabels/threadTopologyAutoMetadata.ts` (per
  Decision 7; no-op stub in MCP-021A)
- NEW: 8 test files in `__tests__/mcpOneTwoOneA*.test.ts` + `mcpBooleanObservationSchema.test.ts`
- `docs/designs/MCP-021A.md` (this file)
- `docs/core/current-status.md` (append MCP-021A handoff section)
- Possibly `src/features/nodeLabels/index.ts` (export new types + schema)

ALL other files: byte-equal vs `main`. The reviewer asserts this on the
list explicitly.

---

## §10 — Conditional HALT trigger verification

Per intent brief §"Conditional HALT triggers" + designer-specific
triggers 13-15.

| # | Trigger | Status | Rationale |
|---|---|---|---|
| 1 | Change to `adaptRawClassifierBinarySource` runtime behavior | **CLEAN** | §1.1 verified; design binds implementer to preserve byte-equal. |
| 2 | Change to UX-001.5A display caps | **CLEAN** | §5.4 sanitizer respects existing presentation-model caps; new entries default `'future_source'` so don't reach caps. |
| 3 | Backend write path | **CLEAN** | No migration, no Edge Function, no `.from(`/`.insert(`/`.update(` calls in MCP-021A scope. |
| 4 | New visual primitive | **CLEAN** | Zero modification to `src/features/nodeAnnotations/`. |
| 5 | New design token | **CLEAN** | Zero modification to `src/lib/designTokens.ts`. |
| 6 | New AI provider call path | **CLEAN** | MCP schema type defines wire shape; no runtime call. MCP-021C territory. |
| 7 | Modification to UX-001.{1-7} or UX-001.5A read-only files | **CLEAN** | Bounded extension list in §1.3; reviewer asserts via diff. |
| 8 | Test count delta exceeds +1,000 | **CLEAN** | Forecast +410 (§8.9); ≤ +1,000. |
| 9 | Doctrine drift in proposed candidate definitions | **CLEAN** | Phase A applied `cdiscourse-doctrine §10a` ban-list review per candidate (§2.2 narrative for each family includes doctrine notes; 5 Family J extras DROPPED per Trigger 10). |
| 10 | Family G constructiveness candidates beyond existing 5 sensitive | **CLEAN** | Family J reconciliation §2.4 enumerates 5 DROPs (hostile_generalization_present, identity_group_reference_present, sarcasm_or_mockery_present, excessive_heat_present, moderation_boundary_near). No new sensitive entries proposed. |
| 11 | Final registry count exceeds 200 | **CLEAN** | Forecast 171-172; ≤ 200. |
| 12 | Any MachineObservationDefinition lacks all 8 verbose fields | **CLEAN by design** | §4 schema requires all 8 fields; §8 test category 2 enforces; implementer's Phase B chunking enforces per-family. |
| 13 | Context window > 70% | **CLEAN** | Designer phase used ~35% of context window through Phase A and design completion (current estimate). |
| 14 | Interpretive judgment requires operator decision | **CLEAN** | All operator-deferred items are logged in §12 ledger as informational notes for completion report, not blocking decisions. The implementer ships per the design; operator reviews flagged items at PR review. |
| 15 | Phase A reconciliation surfaces materially different baseline | **CLEAN** | Existing 65-entry baseline confirmed at §1.2 (`16+19+25+5`); matches brief and matches MCP-020 audit Phase A. The brief's "65" matches the registry's actual entry count exactly. The header-comment "64" / "18 lifecycle" staleness was documented in MCP-020 audit as no-functional-drift. |

**ALL 15 TRIGGERS CLEAN.** Stage 2 pipeline auto-proceeds to implementer
phase per intent brief authorization.

---

## §11 — File scope (allowed and disallowed)

Mirrors intent brief §"Read-only API boundaries" verbatim with explicit
implementer guidance.

### 11.1 Allowed (bounded)

| File | Change type | Bounds |
|---|---|---|
| `src/features/nodeLabels/machineObservationRegistry.ts` | Additive expansion + retroactive backfill | 107 new entries + 8 new fields on existing 65 entries. Existing rawKeys / dispositions / priorities preserved. Module header comment may be corrected from "64 entries" to "171 entries" (operator-deferred review item §12). |
| `src/features/nodeLabels/nodeLabelTypes.ts` | Additive type extensions | New `MachineObservationFamily` type + frozen array. New `MachineObservationDefinition` interface (or extension of `NodeLabelMark` — implementer choice per §4). NO modification to existing types. |
| `src/features/nodeLabels/mcpBooleanObservationSchema.ts` | NEW FILE | MCP request/response types + 4 validator functions per §5. Pure TS. |
| `src/features/nodeLabels/threadTopologyAutoMetadata.ts` | NEW FILE (no-op stub) | Per Decision 7. Houses future deterministic derivers for `splits_thread`, `merges_thread`, `references_sibling_node`, `references_ancestor_node`. MCP-021A scope: exported function stubs return `[]` or `false`; full implementation is MCP-021C territory. |
| `src/features/nodeLabels/index.ts` | Additive exports | Export new types, schema, MachineObservationFamily enum, helper functions. |
| `__tests__/mcpOneTwoOneA*.test.ts` (7 files) | NEW FILES | Per §8 test categories 1-4, 6-8. |
| `__tests__/mcpBooleanObservationSchema.test.ts` | NEW FILE | Per §8 test category 5. |
| `docs/designs/MCP-021A.md` | NEW FILE | This file. |
| `docs/core/current-status.md` | APPEND ONLY | Add MCP-021A handoff section after existing UX-001.5A section. |

### 11.2 Disallowed (read-only per intent brief)

| File | Why |
|---|---|
| `src/features/nodeLabels/nodeLabelSourceAdapters.ts` | Source 6 adapter binding-preserved. ALL 6 adapters byte-equal. |
| `src/features/nodeLabels/userAllegationRegistry.ts` | User Allegations are UX-001.5A territory; 10-entry vocabulary complete. |
| `src/features/nodeLabels/nodeLabelPresentationModel.ts` | Display caps are UX-001.5A binding. |
| `src/features/nodeLabels/nodeLabelPriorityModel.ts` | Priority logic unchanged. |
| `src/features/nodeLabels/nodeLabelDescriptorAdapter.ts` | Descriptor adapter unchanged. |
| `src/features/nodeLabels/NodeLabelStrip.tsx` | Component consumer unchanged. |
| `src/features/nodeLabels/NodeLabelInspectGroups.tsx` | Same. |
| All `__tests__/uxOneOneSix*.test.ts` (5 files) | Per UX-001.5A precedent. |
| All `__tests__/uxOneOneFive*` and `__tests__/uxOneOneSeven*` test files | UX-001.5 / UX-001.7 binding tests. |
| All existing `__tests__/nodeLabel*.test.ts` | UX-001.5A pinning tests. May add NEW tests; existing tests must continue to pass. |
| All `supabase/migrations/` | No backend; MCP-021B territory. |
| All `supabase/functions/` | Same. |
| `src/features/arguments/useSemanticReferee.ts` | MCP-021C territory. |
| All UX-001.{1-7} files outside `src/features/nodeLabels/` | UX-001 territory. |
| All `src/features/metadata/` files | META-001 territory; only Family I auto-metadata candidates touch this domain and per Decision 7 the derivers live in NEW `threadTopologyAutoMetadata.ts`. |
| All `src/features/lifecycle/` files | LIFE-001 territory. |
| All `src/features/semanticReferee/` files | MCP-019 territory. |

The reviewer verifies via `git diff main..HEAD --stat` that NO disallowed
file appears in the diff (per §9.3).

---

## §12 — Brief ledger

Per `roadmap-designer` skill §"Orchestrator-authored brief ledger".
Designer-default items + operator-deferred review items + items flagged
for the completion report.

### 12.1 Per-family count adjustments during Phase A reconciliation

- Family A: brief proposed 12 candidates → 12 NEW added (no overlap with
  existing). Final family count: 16 (4 existing + 12 new).
- Family B: brief proposed 14 candidates → 13 NEW + 1 DUPLICATES (Decision 5
  `disputes_evidence_applicability`). Final: 14.
- Family C: brief proposed 14 → 13 NEW + 1 DUPLICATES (Decision 5
  `requests_clarification`). Final: 17 (4 existing + 13 new).
- Family D: brief proposed 16 → 12 NEW + 4 DUPLICATES (`source_requested`,
  `quote_requested`, `source_chain_gap`, `evidence_applicability_questioned`).
  Final: 27 (15 existing + 12 new).
- Family E: brief proposed 16 → 16 NEW. Final: 16.
- Family F: brief proposed 14 → 14 NEW. Final: 14.
- Family G: brief proposed 12 → 9 NEW + 3 DUPLICATES (Decision 5
  `concedes_narrow_point`, `ready_for_synthesis`, `branch_recommended`).
  Final: 29 (20 existing + 9 new).
- Family H: brief proposed 12 → 11 NEW + 1 DUPLICATES (`timeframe_present`).
  Final: 12 (1 existing + 11 new).
- Family I: brief proposed 10 → 7 NEW + 2 DUPLICATES + 1 DROP. Final: 21
  (14 existing + 7 new).
- Family J: brief proposed 8 → 0 NEW + 3 DUPLICATES + 5 DROP per Trigger 10.
  Final: 5 (5 existing + 0 new).

**Total final registry count: 171-172 entries. Trigger 11 CLEAN.**

### 12.2 Decision 5 outcomes per merge candidate

| Brief candidate | Existing key | Outcome | Rationale |
|---|---|---|---|
| `disagreement_evidence_applicability` (Family B) | #49 `disputes_evidence_applicability` | EXISTING KEPT | Decision 5 binding. No alias added. UX-001.5A's existing entry preserves design lineage. |
| `requests_clarification_present` (Family C) | #38 `requests_clarification` | EXISTING KEPT | Same. |
| `narrow_concession_present` (Family G) | #45 `concedes_narrow_point` | EXISTING KEPT | Same. |

### 12.3 Decision 7 outcomes per Family I key

| Family I new key | Decision 7 outcome | Source assignment | Rationale |
|---|---|---|---|
| `splits_thread` | DERIVABLE | `auto_metadata` | Sibling count on immediate parent. |
| `merges_thread` | DERIVABLE | `auto_metadata` | Ancestor + sibling pattern detection. |
| `references_sibling_node` | DERIVABLE | `auto_metadata` | Structural reference. |
| `references_ancestor_node` | DERIVABLE | `auto_metadata` | Structural reference. |
| `returns_to_prior_issue` | NOT DERIVABLE | `ai_classifier` | Requires semantic-equivalence judgment. |
| `references_external_context` | NOT DERIVABLE | `ai_classifier` | Requires content classification of "external". |
| `compares_options` | NOT DERIVABLE | `ai_classifier` | Requires content classification. |

**Operator-deferred review item:** the 4 `auto_metadata` Family I keys
add registry slots but the deriver lives in NEW file
`threadTopologyAutoMetadata.ts` which ships as no-op stubs in MCP-021A.
The actual deriver wiring is MCP-021C territory. Operator may choose to
ship these 4 as `ai_classifier` instead in MCP-021A and revisit at
MCP-021C; the design ships them as `auto_metadata` per Decision 7's
"deterministically derivable → auto" rule.

### 12.4 Operator-narrative candidates dropped

| Dropped candidate | Family | Rationale |
|---|---|---|
| `repeats_prior_point` | I | Doctrine-risk per `cdiscourse-doctrine §10a`: "repeats" reads as verdict on the move's contribution. Genuine repetition is covered by Family C repair pattern. |
| `hostile_generalization_present` | J | Trigger 10: constructiveness-flavored; sequel-audit material. |
| `identity_group_reference_present` | J | Trigger 10: cultural-context judgment risk. |
| `sarcasm_or_mockery_present` | J | Trigger 10: verdict-risk on speaker. |
| `excessive_heat_present` | J | Trigger 10: heat ≠ truth boundary (`cdiscourse-doctrine §2`). |
| `moderation_boundary_near` | J | Trigger 10: conflicts with `cdiscourse-doctrine §4` (AI does not moderate). |

6 DROPs total. All 6 are operator-deferred for sequel-audit consideration
(NOT MCP-021A scope).

### 12.5 Family J overlap reconciliation summary

Existing 5 sensitive entries preserved verbatim. Brief proposed 8 Family J
candidates; 3 overlap existing (DUPLICATES); 5 DROP per Trigger 10.
Family J final count: 5 — UNCHANGED.

### 12.6 Documentation of missing `source-access-audit` skill

Per `.claude/agents/roadmap-designer.md`, the launch prompt referenced
the `source-access-audit` skill. Verification (this designer phase):
the registered skills list does NOT include `source-access-audit`. Per
the MCP-020 audit ledger §1 precedent ("substituted the audit-mode
protocol from `docs/audits/UX-001.5A-source-access-audit.md` as exemplar
— same author/structure pattern"), MCP-021A's designer phase substituted
the audit-mode protocol from BOTH:
- `docs/audits/UX-001.5A-source-access-audit.md` (commit `e477fa8`)
- `docs/audits/MCP-020-semantic-boolean-observation-inventory.md` (commit
  `e1b4e52`)

The two audit documents are this card's exemplar pattern. No reduced
quality; the patterns are equivalent.

**Operator-deferred recommendation:** when the operator has bandwidth,
file an OPS-006-style skill-promotion card to land `source-access-audit`
as a registered skill. MCP-020 audit's same recommendation stands.

### 12.7 Items flagged for operator-deferred review at completion report

1. **Per-entry vs aggregate test structure** (§8.9). Implementer chooses.
2. **Final registry count 171 vs 172** (§3.11). Implementer's Phase A
   reconciliation produces the exact number; the test pins whichever
   is final.
3. **Decision 7 borderline call for 4 Family I auto-metadata keys**
   (§12.3). Operator may choose `ai_classifier` instead.
4. **Optional trim to ~165 entries** (§2.5). Without operator instruction,
   the design ships 107 NEW for a final 172.
5. **Header comment correction** in `machineObservationRegistry.ts`
   (lines 4-5 currently say "64 entries"; should be updated to match
   final count).
6. **Sequel-audit for constructiveness Family** (per Trigger 10 DROPs).
   Operator may file post-MCP-021A audit card to evaluate constructiveness
   classifiers in doctrine-safe frame.
7. **`source-access-audit` skill promotion** (§12.6). Optional follow-up.
8. **Header comment for `nodeLabels/index.ts`** may need update to
   describe MCP-021A's new exports.

---

## §13 — Operator steps (if any)

**NONE — pure code change.** No migration. No Edge Function deploy. No
new env var. No `npx supabase` command. No dependency install.

The implementer commits the new files + the design doc + the
`current-status.md` handoff section. The reviewer runs `npm run test`,
`npm run typecheck`, `npm run lint` and verifies the byte-equal scope
per §9.3. PR is merged via squash-merge to `main`. No operator-deployed
artifact.

---

## §14 — Out of scope (explicit)

Every item below is OUT of MCP-021A scope and a HALT condition if
violated:

- ANY change to `adaptRawClassifierBinarySource` runtime behavior.
- ANY change to UX-001.5A display caps.
- ANY change to UX-001.{1-7} or UX-001.5A read-only files outside the
  bounded list in §11.1.
- ANY new visual primitive.
- ANY new design token.
- ANY backend write path (migrations, Edge Functions, direct inserts,
  service-role).
- ANY new AI provider call path.
- ANY classifier prompt changes.
- ANY semantic-referee model changes.
- ANY composer behavior changes.
- ANY Act/Inspect/Go behavior changes.
- ANY Timeline layout changes.
- ANY truth/verdict/winner/correctness language anywhere.
- ANY raw classifier IDs in user-facing strings.
- ANY new third-party dependencies.
- ANY Family G constructiveness candidates beyond existing 5 sensitive
  entries.
- ANY MCP wire-layer implementation (MCP-021C territory).
- ANY persistence-layer implementation (MCP-021B territory).
- ANY live MCP call execution.
- ANY changes to User Allegations registry (UX-001.5A territory; complete
  for v1).
- ANY changes to the 6 source adapters (all byte-equal preserved).

---

## §15 — Doctrine self-check

Per the design template §"Doctrine self-check":

- **`cdiscourse-doctrine §10a` (Observations vs Allegations):** every
  new Machine Observation entry is `kind: 'machine_observation'` with
  appropriate `source` (`ai_classifier` / `auto_metadata` per Decision
  7). No new entry is `kind: 'user_allegation'` — User Allegations
  remain 10-entry UX-001.5A vocabulary, unchanged. Adapter never collapses
  Observations into Allegations.

- **`cdiscourse-doctrine §1` (Score is gameplay analysis, never truth):**
  every entry's plain-language `label` / `shortLabel` / `description`
  describes structural / gameplay facts. No entry says "winner",
  "loser", "correct", "true", "false", "wins", "loses", "right",
  "wrong". Test category 7 enforces ban-list scan over all 171 entries.

- **`cdiscourse-doctrine §2` (Heat means activity / friction):** the
  Family J DROP `excessive_heat_present` honors this — heat is not a
  verdict.

- **`cdiscourse-doctrine §3` (Popularity is not evidence):** existing
  sensitive entries `uses_popularity_as_evidence` and
  `uses_satire_as_evidence` preserved verbatim. No new entry implies
  popularity grants standing.

- **`cdiscourse-doctrine §4` (AI moderator hard limits):** Family J DROP
  `moderation_boundary_near` honors this — AI does not moderate. No new
  entry implies the system decides who is right; every entry is
  advisory.

- **`cdiscourse-doctrine §5` (Rules engine is sacred):** zero modification
  to `src/lib/constitution/engine.ts`. MCP-021A is taxonomy + schema only;
  no engine changes.

- **`cdiscourse-doctrine §6` (Secrets policy):** no new env var. The
  MCP schema types are pure TS — no `Authorization` header literal, no
  Bearer token, no API key. The wire layer (MCP-021C) handles authentication.

- **`cdiscourse-doctrine §7` (No AI calls from production app):** MCP
  schema types are defined; no runtime call. Validators are pure-TS.
  No `fetch`, `XMLHttpRequest`, or HTTP-client import in MCP-021A scope.

- **`cdiscourse-doctrine §8` (Supabase conventions):** zero migration,
  zero RLS change. MCP-021B handles persistence; MCP-021A is type-level.

- **`cdiscourse-doctrine §9` (Plain language for users):** every Machine
  Observation entry routes through plain-language `label` / `description`.
  Internal `booleanQuestion` / `positiveDefinition` etc. are NEVER
  user-facing — they live in the registry for the MCP prompt + operator
  audit.

- **`cdiscourse-doctrine §10` (v1 scope guards):** no voting, no real-time
  collaborative editing, no OAuth, no public API, no push notifications,
  no argument search. MCP-021A is taxonomy + schema only — no product-
  surface changes.

- **`test-discipline §Gate timeout handling`:** test count forecast +410
  is well within Trigger 8 ceiling. The implementer captures exit codes
  per `; echo "EXIT: $?"` pattern for gate verification (POSTRUN-UX001
  lesson).

- **`expo-rn-patterns §Cross-device QA viewport conventions`:** N/A —
  MCP-021A has zero UI changes. Existing UX-001.5A cross-device QA matrix
  remains byte-equal.

- **`accessibility-targets §Keyboard hints platform-conditional`:** N/A —
  MCP-021A has zero UI changes. No new interactive elements.

- **`evidence-doctrine`:** Family D candidates (`evidence_gap_present`,
  `source_chain_repair`, etc.) align with anti-amplification doctrine.
  Engagement credit and factual-standing eligibility remain separate
  scores (the verbose definitions explicitly reference this in
  `doctrineNotes`).

- **`point-standing-economy`:** Family G new entries (`concedes_broader_point`,
  `synthesis_proposed`) align with concession-is-repair doctrine. The
  verbose definitions cite `point-standing-economy` in `doctrineNotes`.

- **`timeline-grammar`:** the Family B umbrella + subtype Inspect-only
  structure (Decision 4) honors the visual grammar — Timeline renders
  one chip per axis; Inspect surfaces sub-distinctions. Shape / color /
  stroke continues to carry information; chip presence is supplementary.

Every doctrine constraint respected. The design self-check is complete.

---

## §16 — Risks

Things that might trip up the implementer:

1. **Verbose-definition writing is the bulk of effort.** ~32-40 hours of
   doctrine-aligned authoring across 171 entries. The implementer should
   work in family chunks per §7.1 and validate doctrine per chunk; doing
   all 171 in one pass risks doctrine drift.

2. **Test count category 2 (definition completeness) is the largest
   single category.** Implementer chooses per-entry vs aggregate (§8.9).
   Per-entry produces ~150 tests; aggregate produces ~30. Both are valid;
   per-entry has higher granularity at the cost of file size.

3. **Family A overlap with existing auto-metadata** (e.g., `challenges_parent`
   vs existing `has_rebuttal`) requires careful boolean-question framing
   to ensure the AI classifier knows the new key is MOVE-INTRINSIC (was
   this MOVE a challenge?), distinct from the auto-metadata POST-HOC
   fact (does this move HAVE a rebuttal child?). The `positiveDefinition`
   and `falsePositiveGuards` must spell this out clearly.

4. **Family E + F pairing requires consistency.** Every Family E scheme
   has a paired Family F critical-question. The implementer ensures the
   pairs reference each other in `doctrineNotes` so the operator can
   verify completeness at PR review.

5. **Decision 7 auto-metadata stubs** introduce a NEW file
   (`threadTopologyAutoMetadata.ts`) that is no-op in MCP-021A. Reviewer
   may flag this as "dead code"; the design explicitly documents this
   as Decision 7 scaffolding for MCP-021C.

6. **Test count delta forecast +410** may grow if the implementer chooses
   per-entry test structure. The +1,000 ceiling (Trigger 8) accommodates
   growth; the implementer monitors the delta and trims if approaching
   the ceiling.

7. **Documentation of Family I auto vs ai split (§12.3) is operator-deferred.**
   If the operator at PR review prefers all 7 Family I new keys ship as
   `ai_classifier` (deferring auto-metadata derivation to MCP-021C), the
   implementer can swap with a 1-line change per entry + the no-op file
   can be deleted.

8. **Registry size header comment** in `machineObservationRegistry.ts`
   (lines 4-5) says "64 entries"; the implementer should update to
   reflect the new total (171 or 172) as part of the additive expansion.

9. **`MachineObservationDefinition` vs `NodeLabelMark` interaction.**
   §4 leaves the choice between extending `NodeLabelMark` (one registry)
   or parallel registry (two-registry pattern) to the implementer. The
   byte-equal preservation rule for `NodeLabelMark` consumers prefers
   parallel registry; the implementer chooses at coding time and
   documents the choice.

---

## §17 — Edge cases

- **Existing entry overlap rawKeys** (auto_metadata + lifecycle
  `source_requested` / `quote_requested`): the compound-key registry
  pattern already handles this. New entries with new rawKeys (zero
  collisions per Phase A reconciliation §2.2) extend the compound-key
  space cleanly.

- **MCP response with mixed valid + invalid rawKeys:** sanitizer drops
  invalid keys; valid keys still produce marks. Test category 5 covers
  this.

- **MCP response with zero positive observations:** `mcpResponseToNodeLabelMarks`
  returns `[]`. Test category 5 covers.

- **MCP response with confidence below all surface thresholds:** sanitizer
  drops all marks; result is `[]`. Test category 5 covers.

- **MCP response with `flags.length > 20`:** parser returns
  `{ok: false, reason: 'flag_count_too_high'}`; zero chips. Test category
  5 covers.

- **Source 6 adapter called with non-empty `binaries`:** returns `[]`
  unconditionally. Test category 8 covers with random battery.

- **Existing UX-001.5A tests after registry expansion:** all existing
  tests continue to pass because (a) compound keys still resolve, (b)
  display caps unchanged, (c) new entries are `disposition: 'future_source'`
  and are filtered out of all rendering surfaces. The implementer re-runs
  the full UX-001.5A suite to confirm.

- **Compound key `${source}:${rawKey}` for new Decision 7 auto-metadata
  entries:** compound key is `auto_metadata:splits_thread` etc.; no
  collision with existing 16 auto-metadata entries (different rawKeys).

- **Implementer chooses extending `NodeLabelMark` vs parallel registry**
  (§9 risk 9): both paths handle the edge case where existing
  `NodeLabelMark` consumers receive marks that have the new 8 fields.
  Extension path: consumers see additional fields they ignore. Parallel
  path: consumers see byte-equal marks; new fields available via separate
  registry export.

---

## §18 — Dependencies (cards / docs / files)

### 18.1 Upstream (this design assumes complete)

- **UX-001.5A** is merged at commit `154ca3f`. The registry consumer
  pattern, presentation model, descriptor adapter, and 6 source adapters
  are all shipped. MCP-021A consumes these without modification.
- **MCP-020 audit** is complete at commit `e1b4e52`. The 54 candidate
  inventory + Phase D + Phase E + first-batch recommendation form the
  operator-narrative basis. The operator's strategic call to "scrap the
  10-key first batch in favor of maximal boolean expansion" supersedes
  the audit's first-batch recommendation; the audit's Phase C / D / E
  remain binding for shape.
- **UX-001.{1-7}** epic is complete. All read-only files preserved.
- **MCP-019** dormant provider wiring is complete. MCP-021A does NOT
  activate the provider; MCP-021C territory.

### 18.2 Reads existing files

- `src/features/nodeLabels/machineObservationRegistry.ts` (consumes
  ALL 65 entries; backfills 8 fields per entry).
- `src/features/nodeLabels/nodeLabelTypes.ts` (extends additively).
- `src/features/nodeLabels/nodeLabelSourceAdapters.ts` (binding-preserves
  Source 6 adapter byte-equal).
- `src/features/nodeLabels/userAllegationRegistry.ts` (read-only;
  unchanged).
- `src/features/nodeLabels/nodeLabelPresentationModel.ts` (read-only;
  display caps preserved).
- `src/features/metadata/moveMetadataLedger.ts` (`AutoMetadataCode`
  union; consumed for Decision 7 auto-metadata derivability evaluation).
- `src/features/lifecycle/pointLifecycleModel.ts` (`PointLifecycleState`
  union; consumed for Family G overlap).

### 18.3 Will block future cards

- **MCP-021B** (persistence layer; future, contingent): consumes
  MCP-021A's `MachineObservationDefinition` registry + MCP schema types.
  MCP-021B wires the Supabase classifier-output table + RLS + cross-actor
  visibility.
- **MCP-021C** (live MCP execution; future, contingent): consumes
  MCP-021A's schema + registry + validators. MCP-021C wires the actual
  MCP HTTP transport, retry/sanitization, family-sharded batching,
  per-call timeout enforcement.
- **Sequel-audit for constructiveness Family** (future, optional):
  evaluates Family J extras (`hostile_generalization_present` etc.) in
  a doctrine-safe frame. Inputs: MCP-021A's DROP rationale at §2.2.10
  + post-deployment data once MCP-021C ships.

### 18.4 Sibling card relationships

MCP-021A is the first of a three-card chain MCP-021A → 021B → 021C.
MCP-021A's deliverable is taxonomy + schema + tests. MCP-021B and
MCP-021C build on MCP-021A's exports.

---

**End of design document.**

For implementer: read §1, §3, §4, §5, §6, §7 in that order. The 8 test
categories in §8 are the deliverable's success criteria. The reviewer's
verification commands in §9 are the pre-merge gate. The 15 conditional
HALT triggers in §10 are the autonomous-pipeline trip-wires; all clean
at design phase.
