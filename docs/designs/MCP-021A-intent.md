# MCP-021A Design Intent Brief — Maximal Boolean Machine Observation Taxonomy

**Card:** MCP-021A — Maximal Boolean Machine Observation Taxonomy (taxonomy + schema + tests only; no persistence, no live MCP call, no UI behavior change)
**Epic:** MCP track (continuation of MCP-019 dormant provider wiring + UX-001.5A registry consumer)
**Priority:** P0 / Urgent
**Effort:** L (registry size + verbose definitions + comprehensive test suite)
**Filed:** 2026-05-25
**Author:** Operator-authored
**Status:** Binding for MCP-021A designer phase. Stage 2 HALT is CONDITIONAL per autonomous-pipeline authorization; HALT fires only on the explicit conditional triggers below. Keep-moving authorization applies otherwise. This card is exceptionally safe for autonomous execution because zero runtime behavior changes — Source 6 adapter still returns [] post-merge.
**Audit grounding:** docs/audits/MCP-020-semantic-boolean-observation-inventory.md at commit e1b4e52 (54 candidates across 6 families A-F, plus operator's expansion to 10 families A-J in narrative)

---

## Why this brief exists

MCP-020 inventoried 54 candidate Machine Observation booleans plus the 25 existing future-source AI-classifier registry entries. The operator's strategic call at MCP-021 launch was to scrap the 10-key first batch in favor of maximal boolean expansion: ~150-170 total registry entries after dedup against existing 65, organized into 10 families with verbose internal definitions but unchanged compact UI rendering.

This is MCP-021**A** specifically — taxonomy + types + schema + tests. MCP-021B (persistence) and MCP-021C (live MCP execution) are sequenced separately. MCP-021A's contract is **additive registry growth with zero runtime behavior change**: existing rendering paths see no diff because Source 6 adapter (`adaptRawClassifierBinarySource`) continues to return `[]` unconditionally until MCP-021B/C land.

---

## The central product rule (binding)

**"The registry can carry verbose internal classifier definitions while the UI stays disciplined. Verbosity belongs in the registry, prompt contract, tests, Inspect surface, and audit trail. It does not become visual clutter."**

MCP-021A grows the registry maximally. The UI sees no difference because no live classifier is wired (MCP-021C territory). Display caps remain unchanged from UX-001.5A. The card is preparation infrastructure, not visible product change.

---

## Binding strategic decisions (encoded at brief authoring per operator narrative)

**Decision 1 — Registry size: maximal.** Target ~150-170 total entries post-dedup against existing 65. Operator's narrative proposes 128 candidates across families A-J; designer subagent reconciles overlap with existing 65 entries during Phase A (some entries already cover proposed concepts; do not add duplicates). Final count is a designer + operator joint decision at Stage 2 HALT.

**Decision 2 — Boolean only.** Each `rawKey` has `present: true | false`. `confidence: 'low' | 'medium' | 'high'` is REQUIRED in MCP response shape but ONLY as validation/gating metadata — never user-facing, never a third truth state. No scalar scores. No verdict tokens. No correctness language anywhere.

**Decision 3 — Display caps preserved from UX-001.5A verbatim.** Timeline `1 Machine Observation + 1 User Allegation + overflow`. Selected Context `3 Machine Observations + 3 User Allegations + overflow`. Inspect unbounded grouped. Composer-only for sensitive draft-time observations. MCP-021A does NOT touch these caps; growing the registry from 65 to 150+ entries produces zero display diff because Source 6 still returns [].

**Decision 4 — Disagreement axis: umbrella on Timeline, subtypes Inspect-only.** Per MCP-020 audit Phase D Option 1 confirmed by operator. Timeline renders `disagreement_present` (umbrella) or parent-relation keys like `challenges_parent`. Specific subtypes (`disputes_definition`, `disputes_scope`, `disputes_evidence_applicability`, etc.) are `inspect_only` disposition by default.

**Decision 5 — Existing raw keys preserved when concepts overlap.** Per MCP-020 audit ledger #5 three merge candidates: keep `disputes_evidence_applicability` (existing #49), keep `requests_clarification` (existing #38), keep `concedes_narrow_point` (existing #45). Designer adds the operator's narrative-proposed `narrow_concession_present` as an alias mapping OR drops it; designer chooses with rationale at Stage 1.

**Decision 6 — MCP schema refinements from MCP-020 audit carry forward.** Schema versions as `mcp-021.machine-observations.boolean.v1`. Three audit-confirmed refinements ARE binding: (a) `confidence` REQUIRED, (b) per-call timeout + sanitization contract included, (c) unknown `rawKey` values discarded silently. Failure mode: malformed MCP output → zero chips emitted (matches today's bot annotator `deterministic_fallback` pattern).

**Decision 7 — Family I thread-topology evaluated for auto-metadata derivation.** Several Family I candidates (`introduces_new_issue`, `returns_to_prior_issue`, `repeats_prior_point`, `references_ancestor_node`, `references_sibling_node`) are deterministically computable from argument tree structure. Designer evaluates each at Phase A; deterministically-derivable keys move to `source: 'auto_metadata'` rather than `source: 'ai_classifier'`. Designer documents per-key rationale.

---

## The 10-family target inventory (operator narrative, binding starting point)

The designer subagent uses this as the binding input for registry expansion. Per-family counts are approximate; designer adjusts during Phase A reconciliation with existing 65 entries.

**Family A — Parent relation / reply posture (12 candidates):** `supports_parent`, `challenges_parent`, `refines_parent`, `extends_parent`, `distinguishes_parent`, `reframes_parent`, `questions_parent`, `summarizes_parent`, `acknowledges_parent`, `corrects_parent_detail`, `contrasts_with_parent`, `answers_parent_question`.

**Family B — Disagreement axis (14 candidates, mostly Inspect-only):** `disagreement_present` (umbrella, Timeline-eligible), `disputes_definition`, `disputes_scope`, `disputes_fact`, `disputes_causal_link`, `disputes_value_weighting`, `disputes_decision_criterion`, `disputes_evidence_applicability` (existing #49 — keep), `disputes_generalization`, `disputes_analogy`, `disputes_interpretation`, `disputes_priority_order`, `disputes_remedy_or_solution`, `disputes_relevance`.

**Family C — Misunderstanding and repair (14 candidates):** `offers_candidate_understanding`, `confirms_understanding`, `rejects_candidate_understanding`, `requests_clarification` (existing #38 — keep), `requests_restatement`, `self_initiates_self_repair`, `other_initiates_repair`, `acknowledges_misread`, `flags_ambiguous_reference`, `flags_term_ambiguity`, `proposes_shared_definition`, `confirms_shared_definition`, `scope_mismatch_identified`, `question_answer_mismatch`.

**Family D — Evidence and source chain (16 candidates):** `source_requested` (existing auto-metadata — verify shape match), `source_provided`, `quote_requested` (existing auto-metadata — verify), `quote_provided`, `concrete_example_requested`, `concrete_example_provided`, `evidence_claim_present`, `evidence_gap_present`, `source_chain_gap`, `source_chain_repair`, `anecdote_used`, `statistic_used`, `external_authority_used`, `evidence_applicability_questioned`, `evidence_quality_questioned`, `burden_request_present`.

**Family E — Argument schemes (16 candidates, Inspect-first):** `causal_reasoning_present`, `analogy_reasoning_present`, `example_reasoning_present`, `authority_reasoning_present`, `consequence_reasoning_present`, `principle_reasoning_present`, `definition_reasoning_present`, `classification_reasoning_present`, `precedent_reasoning_present`, `means_end_reasoning_present`, `tradeoff_reasoning_present`, `abductive_explanation_present`, `exception_reasoning_present`, `slippery_slope_reasoning_present`, `cost_benefit_reasoning_present`, `risk_reasoning_present`.

**Family F — Critical-question / vulnerability observations (14 candidates, Inspect-first):** `missing_warrant`, `unstated_assumption`, `authority_basis_missing`, `causal_mechanism_missing`, `analogy_mapping_missing`, `example_representativeness_unclear`, `consequence_probability_unclear`, `definition_boundary_unclear`, `criterion_weighting_unclear`, `alternative_explanation_available`, `counterexample_available`, `scope_limit_unstated`, `qualification_missing`, `comparison_baseline_missing`.

**Family G — Resolution progress (12 candidates):** `concedes_narrow_point` (existing #45 — keep), `concedes_broader_point`, `common_ground_identified`, `unresolved_point_isolated`, `synthesis_proposed`, `ready_for_synthesis` (existing — verify), `branch_recommended`, `move_on_requested`, `issue_closed_by_participant`, `decision_criterion_proposed`, `action_item_proposed`, `followup_question_proposed`.

**Family H — Claim clarity and structure (12 candidates):** `claim_present`, `reason_present`, `conclusion_missing`, `reason_missing`, `multiple_claims_present`, `claim_specificity_high`, `claim_specificity_low`, `timeframe_present`, `quantifier_present`, `modal_language_present`, `hedging_present`, `unclear_reference_present`.

**Family I — Thread topology and context movement (10 candidates, MOST CANDIDATES FOR `auto_metadata` SOURCE):** `introduces_new_issue`, `returns_to_prior_issue`, `splits_thread`, `merges_thread`, `references_sibling_node`, `references_ancestor_node`, `references_external_context`, `repeats_prior_point`, `changes_subject`, `compares_options`. Designer evaluates each for deterministic derivability per Decision 7.

**Family J — Composer-only / sensitive machine observations (8 candidates, OVERLAPS EXISTING 5 SENSITIVE ENTRIES):** `shifts_to_person_or_intent` (existing — keep), `contains_unplayable_insult_only` (existing — keep), `needs_pre_send_pause` (existing — keep), `hostile_generalization_present`, `identity_group_reference_present`, `sarcasm_or_mockery_present`, `excessive_heat_present`, `moderation_boundary_near`. Designer reconciles overlap with existing 5 sensitive entries.

**Total candidate count: 128.** Realistic post-dedup target: ~150-170 total registry entries (current 65 + ~85-105 net new after reconciliation).

---

## MachineObservationDefinition schema (verbose internal contract)

Every Machine Observation registry entry MUST include:

```typescript
export interface MachineObservationDefinition {
  // Existing UX-001.5A NodeLabelMark fields (preserved):
  rawKey: string;
  label: string;                                  // long-form, Inspect-surface
  shortLabel: string;                             // Timeline cap: ≤20 chars
  description: string;
  family: MachineObservationFamily;
  source: NodeLabelSource;
  defaultSurface: NodeLabelSurface;
  disposition: NodeLabelDisposition;
  priority: number;
  visibleByDefault: boolean;

  // MCP-021A new fields (verbose internal contract):
  booleanQuestion: string;                        // exact yes/no question MCP server answers
  positiveDefinition: string;                     // verbose; what makes this TRUE
  negativeDefinition: string;                     // verbose; what makes this FALSE
  positiveExamples: string[];                     // 2-5 concrete examples
  negativeExamples: string[];                     // 2-5 concrete near-misses
  falsePositiveGuards: string[];                  // patterns that look positive but aren't
  doctrineNotes: string[];                        // §10a, §point-standing, §evidence-doctrine notes
  confidenceEligibility: {                        // which confidence levels render where
    timelineMinConfidence: 'low' | 'medium' | 'high';
    selectedContextMinConfidence: 'low' | 'medium' | 'high';
    inspectMinConfidence: 'low' | 'medium' | 'high';
  };
}
```

Existing 65 registry entries get the new MCP-021A fields populated retroactively as part of MCP-021A scope. Designer subagent enumerates verbose definitions for existing entries (they were sparse at UX-001.5A time).

---

## MCP request/response schema (binding)

```typescript
export interface McpBooleanObservationRequest {
  schemaVersion: 'mcp-021.machine-observations.boolean.v1';
  nodeId: string;
  parentNodeId: string | null;
  currentText: string;
  parentText: string | null;
  threadContextExcerpt: string;
  requestedFamilies: MachineObservationFamily[];
  requestedRawKeys: string[];
  definitions: Record<string, MachineObservationDefinition>;
  timeoutMs: number;                              // per-call timeout
}

export interface McpBooleanObservationResponse {
  schemaVersion: 'mcp-021.machine-observations.boolean.v1';
  nodeId: string;
  checkedRawKeys: string[];
  observations: Record<string, boolean>;
  confidence: Record<string, 'low' | 'medium' | 'high'>;  // REQUIRED per audit refinement
  evidenceSpan: Record<string, string | null>;
  modelInfo: {
    provider: 'mcp';
    serverName: string;
    classifierSetVersion: string;
  };
}
```

Failure-mode contract:
- Malformed JSON → zero chips emitted
- Family result malformed (missing checked key, unparseable values) → zero chips for that family only
- Unknown `rawKey` in observations → silently discarded (per audit refinement #3)
- `present: false` → no `NodeLabelMark` emitted
- `present: true` + confidence below registry entry's `confidenceEligibility.timelineMinConfidence` → not rendered on Timeline; may render at Inspect if eligible
- Per-call timeout exceeded → zero chips for the call (no partial results)

MCP-021A defines this schema in TypeScript + JSON Schema; does NOT implement the call path (MCP-021C).

---

## Surface policy (preserves UX-001.5A display contract verbatim)

| Surface | UX-001.5A cap (preserved) | MCP-021A behavior |
|---|---|---|
| Timeline node | 1 Machine Observation + 1 User Allegation + overflow | Unchanged; Source 6 returns [] so caps not stressed |
| Selected context | 3 Machine Observations + 3 User Allegations + overflow | Unchanged |
| Inspect popout | Unbounded grouped via `InspectGroupHeader` | Unchanged (gains 85-105 future_source entries hidden by disposition) |
| Composer | Sensitive composer-only via `RefereeBannerView.observationChips` | Unchanged |
| Hidden / future_source | Not rendered | Most new entries default here until MCP-021B/C land |

Default disposition for new entries: `future_source` unless explicitly promoted (the designer-default first batch keys per MCP-020 audit may be promoted to `rendered_now` IF MCP-021C ships — but MCP-021A leaves all new entries as `future_source`).

---

## Out of scope (strict — every item is a HALT condition if violated)

- Any change to `adaptRawClassifierBinarySource` runtime behavior (must still return [] unconditionally)
- Any change to display caps (UX-001.5A territory)
- Any change to UX-001.{1-7} or UX-001.5A files outside additive extensions to `src/features/nodeLabels/`
- Any new visual primitive (UX-001.5 territory)
- Any new design token (UX-001.7 territory)
- Any backend write path (migrations, Edge Functions, direct inserts, service-role)
- Any new AI provider call path
- Any classifier prompt changes
- Any semantic-referee model changes
- Any composer behavior changes (UX-001.3 territory)
- Any Act/Inspect/Go behavior changes (UX-001.4 territory)
- Any Timeline layout changes (UX-001.2 territory)
- Any truth/verdict/winner/correctness language anywhere
- Any raw classifier IDs in user-facing strings
- Any new third-party dependencies
- Any Family G constructiveness candidates beyond existing 5 sensitive entries (per MCP-020 audit ledger #6 — constructiveness needs its own future audit)

---

## Read-only API boundaries

MCP-021A MAY modify (bounded):
- `src/features/nodeLabels/machineObservationRegistry.ts` (additive registry expansion + retroactive field population)
- `src/features/nodeLabels/nodeLabelTypes.ts` (additive type extensions for `MachineObservationDefinition`)
- New file `src/features/nodeLabels/mcpBooleanObservationSchema.ts` for MCP request/response types
- New tests in `__tests__/` (at least 8 categories per operator's test plan)
- `docs/designs/MCP-021A.md` (design document)
- `docs/core/current-status.md` (MCP-021A handoff section APPENDED after existing sections)

MCP-021A MAY NOT modify:
- `src/features/nodeLabels/nodeLabelSourceAdapters.ts` (Source 6 adapter behavior is binding-preserved)
- `src/features/nodeLabels/userAllegationRegistry.ts` (User Allegations are UX-001.5A territory; unchanged)
- `src/features/nodeLabels/nodeLabelPresentationModel.ts` (display caps are UX-001.5A binding)
- `src/features/nodeLabels/nodeLabelPriorityModel.ts` (priority logic unchanged in MCP-021A)
- `src/features/nodeLabels/NodeLabelStrip.tsx`, `NodeLabelInspectGroups.tsx` (consumers unchanged)
- All `supabase/migrations/` files (no backend; MCP-021B territory)
- All Edge Functions
- `src/features/arguments/useSemanticReferee.ts` (MCP-021C territory)
- All UX-001.6 cross-device QA test files (must remain byte-equal per UX-001.5A precedent rule)
- All UX-001.{1-7} read-only files

---

## Required tests (8 categories per operator's test plan)

1. **Registry count test:** `MachineObservationRegistry` contains ≥100 entries (target ~150-170); every entry has the full `MachineObservationDefinition` shape
2. **Boolean definition completeness test:** every MCP-owned `rawKey` has non-empty `booleanQuestion`, `positiveDefinition`, `negativeDefinition`, ≥1 `falsePositiveGuard`, ≥1 `doctrineNote`
3. **No duplicate semantic aliases test:** explicitly verifies the three MCP-020 merge candidates resolved correctly (existing keys preserved; no synonym duplicates added)
4. **Surface policy test:** Timeline-eligible keys are a strict subset; disagreement subtypes are Inspect-first; sensitive keys are `composer_only` or `hidden_sensitive`
5. **MCP schema validation test:** valid keyed boolean map accepted; unknown `rawKey` discarded; missing checked key marks family malformed; malformed JSON emits zero chips; low confidence does not render on Timeline unless explicitly allowed
6. **Display cap preservation test:** even with 150+ positive booleans, Timeline renders max 1 Machine + 1 User + overflow; Selected max 3+3+overflow; Inspect receives full grouped observations
7. **Doctrine test:** no `rawKey` rendered as user-facing string; no truth/winner/proof/correctness/verdict copy; sensitive keys excluded from Timeline and Selected; Machine Observations never render as User Allegations
8. **Source 6 runtime invariance test:** `adaptRawClassifierBinarySource(any_input)` returns `[]` unconditionally (Source 6 behavior preserved byte-equal)

Test count delta forecast: +400 to +700 (large registry + 8 test categories + per-key validation tests). Well below +1,000 ceiling but on the higher end of recent cards.

---

## Conditional HALT triggers (9 triggers per autonomous pipeline pattern)

1. Designer proposes changing `adaptRawClassifierBinarySource` runtime behavior
2. Designer proposes changing any UX-001.5A display cap
3. Designer proposes any backend write path
4. Designer proposes any new visual primitive
5. Designer proposes any new design token
6. Designer proposes any new AI provider call path
7. Designer proposes modifying any UX-001.{1-7} or UX-001.5A read-only file outside bounded list
8. Test count delta forecast exceeds +1,000
9. Designer's scope-reality audit surfaces doctrine drift in proposed candidate definitions

Plus:

10. Designer proposes any Family G constructiveness candidate beyond existing 5 sensitive entries
11. Final registry count exceeds 200 entries (signals overbuild)
12. Any `MachineObservationDefinition` lacks all 8 verbose fields after Phase B

---

## Sequencing context (MCP-021A → 021B → 021C)

**MCP-021A (this card):** Taxonomy + types + schema + tests. Zero runtime behavior change. Source 6 returns []. Effort: L.

**MCP-021B (future card, contingent):** Persistence layer. Supabase table for classifier outputs. RLS for per-room read access. `adaptRawClassifierBinarySource` wired to read from persisted rows. Effort: M-L. Filed when MCP-021C requires durable cross-actor / cross-reload classifier visibility.

**MCP-021C (future card, contingent):** Live MCP call path. Family-sharded request batching. Per-call timeout. Sanitization. Retry/fallback. Smoke tests against staging MCP server. Effort: M-L. Filed when operator decides classifier vocabulary is worth wiring live.

This three-card split lets MCP-021A ship safely without any live network call, any backend, or any visible UI change. The maximal taxonomy infrastructure lands; the runtime decisions are deferred to subsequent cards based on real product value signals.

---

## Explicit deliverables

1. `docs/designs/MCP-021A.md` — design document with per-family enumeration, verbose definitions for every entry, schema specification, reconciliation table for existing vs new entries
2. Registry expansion in `src/features/nodeLabels/machineObservationRegistry.ts` (additive)
3. Type contracts in `src/features/nodeLabels/nodeLabelTypes.ts` (additive)
4. MCP schema types in new `src/features/nodeLabels/mcpBooleanObservationSchema.ts`
5. 8 test categories per operator's test plan
6. MCP-021A handoff section in `docs/core/current-status.md` (appended after UX-001.5A section)
7. Completion report with test count delta + per-family entry count + reconciliation summary

---

## Brief ledger requirement

MCP-021A's design document MUST include a ledger naming:
- Per-family count adjustments made during Phase A reconciliation (existing vs new)
- Decision 7 outcomes per Family I key (kept as `ai_classifier` vs moved to `auto_metadata`)
- Decision 5 outcomes per merge candidate (existing key kept; alias dropped; rationale)
- Any candidate from operator narrative dropped during design phase (with rationale)
- Items flagged for operator-deferred review at completion report
