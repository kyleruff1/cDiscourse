# CDiscourse — Binary classifier catalog design (2026-05-23)

**Type:** Planning material only. No production code is modified by this document. This is the basis for a future
**MCP-CAT-001** card; the card's implementation lands AFTER the MCP-MOD-004 source-of-truth structure has shipped, so
the revised catalog can be authored directly into the new structure rather than retrofitted.

**Hard architectural constraint preserved:** the model returns **binary 0/1** classifier signals only. All
natural-language output (banners, sidecar copy, timeline labels, settlement summaries) is produced by deterministic
composition rules in the downstream layer. The richness comes from composition, not from model interpretation. Any
proposal in this document that would require the model to emit prose is out of scope.

**Companion artifacts:**

- [`fixtures/argument-scenarios/catalog-design-band-space-rent-evidence.json`](../../fixtures/argument-scenarios/catalog-design-band-space-rent-evidence.json) — the scenario fixture this document accompanies.
- [`docs/ux-storyboards/band-space-rent-private-evidence-argument.md`](../ux-storyboards/band-space-rent-private-evidence-argument.md) — the source storyboard.
- [`docs/designs/MCP-001.md`](../designs/MCP-001.md) — the original 23-id catalog declaration.
- [`docs/testing-runs/2026-05-22-smoke-test-failure-investigation.md`](../testing-runs/2026-05-22-smoke-test-failure-investigation.md) — the reasonCode safety risk surfaced here.
- [`docs/designs/SMOKE-FIX-001.md`](../designs/SMOKE-FIX-001.md) — the focused fix that restores live classification quickly; independent of this catalog work.
- [`docs/roadmap-expansions/2026-05-22-semantic-referee-modularity-roadmap.md`](2026-05-22-semantic-referee-modularity-roadmap.md) — the 8-card modularity slate (issues #230-#237). This catalog design lands after MCP-MOD-004.

---

## 1. Why this document exists

The current 23-id classifier catalog at
`src/features/semanticReferee/semanticRefereeTypes.ts:30-53` is the design baseline frozen by MCP-001. It is a
deliberate v0 — broad, structural, advisory-only. It does not yet have evidence applicability ids, structured
evidence-debt markers, sub-axis introduction, or qualified-concession variants — concepts that the
band-space-rent storyboard makes concrete.

The smoke-test failure investigation (`docs/testing-runs/2026-05-22-smoke-test-failure-investigation.md`) showed that
the live Anthropic provider's outbound packet validation is the most likely failure surface, and that the
reasonCode strings are at risk of containing banned tokens like `false` / `true` / `correct`. The catalog's safety
discipline therefore needs the reasonCode whitelist made explicit, regardless of whether new ids are added.

This document, together with the scenario fixture it accompanies, makes the catalog gaps and the safety discipline
concrete. It is the design input to a later **MCP-CAT-001** card whose deliverable is a finalized catalog proposal,
NOT a catalog implementation.

---

## 2. Schema-mapping notes (from fixture inspection)

The fixture at `fixtures/argument-scenarios/catalog-design-band-space-rent-evidence.json` carries the design content.
Stage one of this work was reading the existing fixtures to align with their schema. Findings:

**Existing canonical fields** (preserved by the new fixture):

- Top level: `scenarioId`, `title`, `resolution`, `category`, `personas[]`, `moves[]`, `expectedFlags`,
  `expectedTopicChecks`, `expectedTurnStatuses`, `expectedFinalRestingStatus`, `expectedFinalClaimStanding`,
  `hasBranchCandidate`, `notes`.
- Per move: `moveId`, `authorAlias`, `parentMoveId`, `moveKind`, `qualifierCode`, `argumentType`, `disagreementAxis`,
  `targetExcerpt`, `body`, `selectedTagCodes`, `evidence`, `expectedStatus`, `expectedClassifierSignal`,
  `expectedConfidence`, `expectedOverrideTrigger`, `displayMeta`.

**Fields the new fixture adds** (with rationale in the fixture's `schemaMappingNotes` section):

- `artifactType: "design_fixture_not_runner_ready"` at the top level.
- `roomMetadata` block (visibility, room type, title source, settlement state).
- `participants[]` block (richer per-actor record, kept in sync with `personas[]` by alias).
- `semanticRefereeRules` block (binary return model, root exemption, first-rebuttal exemption, after-second-move
  rule, full-thread requirement, chime-in exemption).
- Top-level `evidence[]` array of first-class evidence objects with applicability lifecycle. The storyboard's
  evidence-object model demanded this — applicability is a distinct axis from existence, and the existing
  per-move inline `evidence` field cannot express the lifecycle.
- Per move: `participantRole`, `branchId`, `timelineLane`, `evidenceAttached[]`, `concessions[]`, `refutations[]`,
  `semanticEligible`, `semanticExemptionReason`, `expectedDeterministicComposition`, `expectedUIState`,
  `expectedTimelineBehavior`.
- Top level: `expectedTimeline`, `expectedSettlement`, `currentCatalogCoverage`, `proposedClassifierNeeds`,
  `compositionRules`, `reasonCodeSafetyNotes`.

**Conflicts avoided** by deliberately keeping both shapes side-by-side:

- The existing inline per-move `evidence` shape `{ label, sourceText }` is preserved (set to `null` where the move
  only REFERENCES, not introduces, evidence). The new top-level `evidence[]` array is the design-time
  authoritative shape. A future runner extension can read either or both.
- The existing `personas[]` is preserved. The new `participants[]` carries richer role information without
  displacing the simpler shape.

The fixture is marked `artifactType: "design_fixture_not_runner_ready"` so an existing runner does not try to
execute it. Adding runner support for the extended fields is a non-goal of this card; it falls naturally to a later
work item if and when the runner is taught the new vocabulary.

---

## 3. Inventory of the current 23-id catalog (plain-language descriptions)

From `src/features/semanticReferee/semanticRefereeTypes.ts:30-53`. Each id is grouped by the family it belongs to in
MCP-001 §6. The plain-language description is the binary signal a model must detect to return `1` for that id.

### §A parent continuity (5 ids)

| Id | Binary signal — plain language |
|---|---|
| `responds_to_parent` | Does this move directly engage the parent's claim, mechanism, question, evidence, or requested clarification? |
| `introduces_new_issue` | Does this move raise a new debatable issue distinct from the parent? |
| `quote_anchors_parent` | Does this move quote or paraphrase a span of the parent and then engage that span? |
| `requests_clarification` | Does this move ask what the other participant means by a term or statement? |
| `answers_clarification` | Does this move answer a clarification request raised earlier in the thread? |

### §C evidence and source chain (7 ids)

| Id | Binary signal — plain language |
|---|---|
| `asks_for_evidence` | Does this move request a source, citation, primary source, receipt, or exact quote? |
| `provides_evidence` | Does this move include or reference an attached source, excerpt, quotation, or record? |
| `evidence_supports_claim` | Does the attached evidence appear to attach to the exact claim being made? |
| `uses_popularity_as_evidence` | Does this move use likes, shares, virality, or an "everyone says" appeal as evidentiary support? |
| `uses_satire_as_evidence` | Does this move use satire, parody, a meme, or fiction as factual support for a claim? |
| `cites_retraction` | Does this move cite a retraction, correction, update, or changed record? |
| `creates_source_chain_gap` | Does this move leave a gap in the source trail — missing origin, quote, context, or link? |

### §D constructive movement (4 ids)

| Id | Binary signal — plain language |
|---|---|
| `narrows_claim` | Does this move limit a broader claim to a more specific, more defensible scope? |
| `concedes_narrow_point` | Does this move accept a specific, limited point raised by the other participant? |
| `ready_for_synthesis` | Is there clear shared ground in the thread plus only limited unresolved debt? |
| `needs_pre_send_pause` | Could this move be tightened by its author before it is sent? |

### §E debate-mode fit (3 ids)

| Id | Binary signal — plain language |
|---|---|
| `fits_selected_debate_mode` | Does this move's register fit the room's selected debate mode? |
| `contains_playable_hot_take` | Is this move spicy / contrarian / provocative while still being a coherent, answerable claim? |
| `is_satire_or_parody` | Does this move itself read as satire, parody, a meme, or fiction rather than a literal claim? |

### §B + §G branch routing and friction (4 ids)

| Id | Binary signal — plain language |
|---|---|
| `suggests_side_branch` | Would this move read more cleanly on a same-topic side branch than on the main line? |
| `suggests_diagonal_tangent` | Does this move step to a related but distinct issue that fits its own tangent branch? |
| `shifts_to_person_or_intent` | Does this move redirect from the argument toward the other participant or their intent? |
| `contains_unplayable_insult_only` | Is this move only an insult, with no claim, question, or evidence to engage? |

23 total. Of these, **9 are exercised positively by the band-space-rent scenario**: `responds_to_parent`,
`quote_anchors_parent`, `concedes_narrow_point`, `narrows_claim`, `asks_for_evidence`, `provides_evidence`,
`evidence_supports_claim`, `creates_source_chain_gap`, `ready_for_synthesis`. The remaining 14 are not exercised by
this scenario by design — band-space-rent is a structured, calm, two-participant dispute. A future fixture should
exercise the satire / hot-take / popularity / person-shift / side-branch ids that this scenario doesn't model.

---

## 4. Move-by-move walkthrough of the band-space-rent scenario

For each eligible move below, the desired downstream output is described, then the binary signals required to
deterministically produce that output are enumerated. Existing catalog ids are cited verbatim; proposed new ids are
flagged `[PROPOSED]`.

### m1 — A's root proclamation (exempt)

**Eligibility:** `semanticEligible: false`, exemption `root_proclamation`. No classifier call fires.

**Desired output:** opening-claim layer-1 banner only; no AI signal.

**Composition:** the `root_proclamation_exemption` rule (no classifier call); the layer-1 deterministic surface knows
the move has no parent and renders accordingly.

### m2 — B's evidence-backed rebuttal with concessions (exempt)

**Eligibility:** `semanticEligible: false`, exemption `first_move_by_this_participant`. No classifier call fires.

**Desired output:** layer-1 deterministic signals from the structural fields — `concessions[]` is non-empty,
`evidenceAttached[]` is non-empty, `refutations[]` is non-empty. The UI renders the evidence pill (`ev1`) and a
two-item concession list without an AI call.

**Catalog observation:** the first-move-per-participant exemption removes the need to classify what is structurally
obvious. If the catalog had a `provides_structured_evidence_object` id, layer-1 could ALSO check it deterministically
on every move (regardless of eligibility) since "is there an evidence object attached?" is a metadata question.

### m3 — A's evidence applicability challenge (eligible)

**Desired output:** banner "Applicability disputed — prior agreement cited"; sidecar explains dispute is about WHAT
the payment covers, not whether it happened; `ev1.status` transitions to `applicability_disputed`.

**Required signals:**

- `responds_to_parent` = 1 (existing)
- `quote_anchors_parent` = 1 (existing — quotes "practice space")
- `disputes_evidence_applicability` = 1 **[PROPOSED]** — the central new signal
- `references_prior_agreement` = 1 **[PROPOSED]** — A cites the prior agreement about February reimbursement
- `provides_temporal_constraint` = 1 **[PROPOSED]** — A cites the March 10 due date
- `asks_for_evidence` = 0 (existing — A is disputing, not requesting)
- `provides_evidence` = 0 (existing — A is challenging existing evidence)

**Composition rule:** `applicability_dispute_with_prior_agreement_and_temporal_anchor`.

### m4 — B's agree with caveat (eligible)

**Desired output:** banner "Agreed with caveat — alternate interpretation offered"; sidecar notes the partial
concession and the alternate reading of the payment label.

**Required signals:**

- `responds_to_parent` = 1
- `quote_anchors_parent` = 1
- `concedes_narrow_point` = 1 (existing — conceded the March 10 due date)
- `accepts_partial_with_caveat` = 1 **[PROPOSED]** — the structured "Agree with caveat" choice
- `provides_alternate_interpretation` = 1 **[PROPOSED]** — re-interprets the "practice space" label

**Composition rule:** `qualified_concession_with_alternate_interpretation`.

### m5 — A's ask for source (eligible)

**Desired output:** banner "Source requested"; room status line "Evidence requested"; evidence-debt chip on m4.

**Required signals:**

- `responds_to_parent` = 1
- `quote_anchors_parent` = 1
- `asks_for_evidence` = 1 (existing)
- `opens_evidence_debt_marker` = 1 **[PROPOSED]** — distinguishes the structured "Ask for source" tap from any
  rhetorical ask
- `requests_clarification` = 0 (existing — this is a source request, not a meaning request)

**Composition rule:** `explicit_source_request_opens_debt_marker`.

### m6 — B's group-chat evidence supply (eligible)

**Desired output:** banner "Source supplied — debt resolved"; `ev1.status` transitions to `applicability_supported`;
the evidence-debt chip on m4 flips to resolved.

**Required signals:**

- `responds_to_parent` = 1
- `provides_evidence` = 1 (existing)
- `evidence_supports_claim` = 1 (existing)
- `closes_evidence_debt_marker` = 1 **[PROPOSED]** — the paired closing signal to `opens_evidence_debt_marker`
- `supplies_corroborating_document` = 1 **[PROPOSED]** — distinguishes corroborating from primary evidence
- `creates_source_chain_gap` = 0 (existing — B closed the gap, didn't open a new one)

**Composition rule:** `source_supplied_closes_debt_and_strengthens_prior_evidence`.

### m7 — A's concession + new sub-axis (eligible)

**Desired output:** banner "Conceded; new sub-dispute opened"; live dispute narrows to amount; `ev1.status`
transitions to `applicability_accepted`.

**Required signals:**

- `responds_to_parent` = 1
- `concedes_narrow_point` = 1 (existing)
- `narrows_claim` = 1 (existing — narrows the live dispute from applicability+amount to amount only)
- `introduces_sub_axis` = 1 **[PROPOSED]** — opens a new specific sub-dispute on the same mainline
- `concedes_with_new_dispute` = 1 **[PROPOSED]** — the paired pattern (concede + open). May be expressible as a
  composition rule rather than a new id; flagged for reviewer.
- `ready_for_synthesis` = 0 (existing — sub-axis still open)

**Composition rule:** `concede_and_open_sub_axis_on_same_mainline`.

### m8 — B's evidence-backed rebuttal on the sub-axis (eligible, optional confirmation move)

**Desired output:** banner "Sub-dispute evidence supplied; ready for synthesis"; settlement affordance offered to A.

**Required signals:**

- `responds_to_parent` = 1
- `quote_anchors_parent` = 1
- `provides_evidence` = 1
- `evidence_supports_claim` = 1
- `disputes_specific_amount` = 1 **[PROPOSED]** — the specific-amount challenge shape
- `cites_temporal_boundary` = 1 **[PROPOSED]** — the rent-increase boundary (March vs April)
- `supplies_corroborating_document` = 1
- `ready_for_synthesis` = 1 (existing — room is one acceptance move from settlement)

**Composition rule:** `evidence_backed_sub_axis_resolution_ready_for_synthesis`.

---

## 5. Proposed classifier needs (consolidated)

Twelve candidate new ids surfaced by this scenario, each with a plain-language signal description, a rationale for
why the existing catalog does not cover it, and the scenario move that exemplifies it.

| Candidate id | Binary signal | Why the existing catalog does not cover it | Example move |
|---|---|---|---|
| `disputes_evidence_applicability` | Does this move challenge what an attached evidence object COVERS rather than whether it exists? | `evidence_supports_claim` covers a different question (does evidence support THIS claim); applicability is a distinct axis per the storyboard's evidence-object model. | m3 |
| `references_prior_agreement` | Does this move cite a prior agreement between participants that bears on the dispute? | No catalog signal for cross-temporal context that participants previously established. | m3 |
| `provides_temporal_constraint` | Does this move cite a specific date, timeline, or temporal boundary? | Catalog has evidence-presence and source-chain signals but no temporal-anchor signal. | m3 |
| `accepts_partial_with_caveat` | Does this move accept a specific point while qualifying or restricting the acceptance? | Sits between `concedes_narrow_point` (full narrow concession) and full rebuttal. Reviewer may merge with `concedes_narrow_point` instead of adding a new id. | m4 |
| `provides_alternate_interpretation` | Does this move offer an alternate reading of an existing artifact the parent treated as fixed? | Distinct from `requests_clarification` and from `provides_evidence`; re-frames an artifact. | m4 |
| `opens_evidence_debt_marker` | Does this move open a structured evidence-debt marker (tracked Ask for source)? | Distinct from generic `asks_for_evidence`; the deterministic ledger needs to open a tracked debt object. | m5 |
| `closes_evidence_debt_marker` | Does this move respond to an open evidence-debt marker with the requested source? | `provides_evidence` is too broad (fires on any attachment); the debt-closure signal is needed by the ledger. | m6 |
| `supplies_corroborating_document` | Does this move attach a document that corroborates a prior claim rather than introducing primary evidence? | Differentiates corroborating from primary; deterministic layer renders them differently. | m6, m8 |
| `introduces_sub_axis` | Does this move open a new, more specific sub-dispute on the SAME mainline rather than continuing the parent's axis? | Distinct from `introduces_new_issue` (a wholly new debatable issue, side-branch candidate). Sub-axis stays on mainline. | m7 |
| `concedes_with_new_dispute` | Does this move pair a concession on one axis with a new dispute on a different axis? | Common move shape; may be expressible as composition rule rather than a new id. Flagged for reviewer. | m7 |
| `disputes_specific_amount` | Does this move challenge a specific numeric amount named in the parent? | Distinct from generic applicability or generic evidence challenge; affords number-anchored UI. | m8 |
| `cites_temporal_boundary` | Does this move cite a specific boundary date that demarcates one period from another? | Similar to `provides_temporal_constraint` but BOUNDARY-shaped. Reviewer may merge. | m8 |

**Reviewer questions to resolve in MCP-CAT-001:**

- Are `accepts_partial_with_caveat` and `concedes_narrow_point` a single id with a sub-state, or two ids? The
  scenario's `m4` argues for two — the structural shape "accept the specific point but reject the broader frame" is
  different from "accept the narrow point and stop."
- Are `provides_temporal_constraint` and `cites_temporal_boundary` a single id? The scenario uses both because m3
  cites a single date (March 10 = deadline) while m8 cites a boundary (March = $120, April = $140). A reviewer may
  prefer one id with a sub-distinction in `reasonCode`.
- Is `concedes_with_new_dispute` a classifier id or a composition rule output? The model can already detect
  `concedes_narrow_point` + `introduces_sub_axis` independently; the composition layer can fire the paired-banner
  rule from those two binaries. Recommendation: keep it as a composition rule, not a classifier id.
- Should `provides_structured_evidence_object` (binary: "is there an evidence object attached to this move?") be a
  classifier id or a layer-1 metadata signal? Recommendation: layer-1 metadata — the evidenceAttached[] array is a
  structural fact, not an AI judgment. Don't add it to the AI catalog.

---

## 6. Full-thread context design

The post-MCP-MOD-008 trigger gate skips classification on each participant's first move; from each participant's
SECOND move onward, classification fires with the FULL THREAD as context. This section captures the design.

### Context string structure

```
Room thread context:
- Move A1 by A (parent: none): {redacted_body_A1}
- Move B1 by B (parent: A1): {redacted_body_B1}
- Move A2 by A (parent: B1): {redacted_body_A2}
...
- Move {current.id} by {current.alias} (parent: {parent.id}): {redacted_body_current}

Move to classify: the LAST entry above.

Author alias map:
A = first distinct author chronologically
B = second distinct author chronologically
C = third distinct author chronologically (chime-in, if present)
```

### Aliases — stability and privacy

Aliases are derived deterministically from chronological order of distinct authors. `A` is always the originator;
`B` is the first respondent; `C` is the first chime-in (if any). The alias map is computed per classify call from
the room state and is local to the call — it is never persisted.

**Why aliases instead of names:**

- No PII crosses the boundary. Display names, email addresses, handles never appear in the model's input.
- The model can reason about continuity ("A asked for a source in A2 and B supplied it in B2") without being able to
  label a real person.
- The system prompt forbids person-labeling regardless; aliases are a belt-and-suspenders measure.

### Redaction rules

Each body in the context block runs through the existing redactor
(`supabase/functions/_shared/semanticReferee/redaction.ts`, plus the client-side first pass in
`src/features/semanticReferee/clientRedaction.ts`). The same redaction rules apply to every prior-move body that the
current-move body already has applied to it: email shapes, URL shapes, X-family handles, secret-shape prefixes,
Bearer tokens, long digit runs, payment-account-shaped digits, and the X / Twitter / t.co URL family.

### Token-budget handling

The existing `isWithinBudget` helper extends to count prior-move bytes alongside the current move + parent. When the
full thread would exceed the budget:

1. Drop the OLDEST prior moves first (FIFO).
2. If the budget is still exceeded after dropping all prior moves, fall back to the pre-refactor payload shape
   (current + parent only). The hook does NOT skip the call; it gracefully degrades.

### Doctrine constraints on what may be sent

- **Never** raw author names, emails, handles, or any PII. Only the chronological alias.
- **Never** the redaction reveals (the actual redacted span content). Only the placeholder.
- **Never** the room id, the user id, the move id (except as a structural reference in the alias map; the model's
  output doesn't carry it back).
- **Never** the prior-classifier outputs. The model's structural classification is on the move's text, not on prior
  AI judgments — sending prior packets would create feedback amplification.
- **Always** the alias map and the parent chain. The model needs to know who said what to judge continuity.

---

## 7. Deterministic composition

The model returns binary signals only. All natural-language output is produced by composition rules. This section
makes the architecture explicit.

### What the model produces

For each classifier id requested:

```json
{
  "classifierId": "disputes_evidence_applicability",
  "value": 1,
  "confidence": "high",
  "reasonCode": "evidence_applicability_disputed",
  "evidenceSpan": "prior agreement that February reimbursement",
  "parentSpan": "practice space"
}
```

Five fields, all bounded:

- `classifierId` — from the catalog enum.
- `value` — `0` or `1` only (the literal integers, never JSON booleans).
- `confidence` — `low | medium | high`.
- `reasonCode` — snake_case from a bounded vocabulary (see §8).
- Optional `evidenceSpan` / `parentSpan` — bounded substrings from the input, capped at MAX_COPY_FIELD_LEN.

The model never returns a banner, a sidecar string, a winner verdict, a truth value, a hide-this-content flag, or
any other user-facing copy. The packet has no such field by schema.

### What the deterministic layer produces

The composition layer reads the binary signal vector and produces user-facing output by deterministic rules. From
the fixture's `compositionRules` section, two examples:

**Rule 1 — `explicit_source_request_opens_debt_marker`:**

```
INPUT:  asks_for_evidence=1 AND opens_evidence_debt_marker=1
OUTPUT:
  banner: "Source requested"
  sidecar: "Room status: Evidence requested."
  evidenceDebtTransition: new_debt_marker_opened
  roomStatusLine: "Evidence requested"
  frictionSuggestion: ask_for_source
```

**Rule 2 — `source_supplied_closes_debt_and_strengthens_prior_evidence`:**

```
INPUT:  provides_evidence=1 AND evidence_supports_claim=1
        AND closes_evidence_debt_marker=1 AND supplies_corroborating_document=1
OUTPUT:
  banner: "Source supplied — debt resolved"
  sidecar: "Evidence chain stronger."
  evidencePanelTransition: prior_evidence: applicability_disputed → applicability_supported;
                           new_evidence: attached_supporting
  evidenceDebtTransition: debt_resolved
  frictionSuggestion: none
```

### Why composition, not model interpretation

Three reasons, each load-bearing:

1. **Doctrine safety.** The model cannot smuggle a verdict, a truth claim, or a person label if its only output
   surface is `{0, 1}`. The composition layer is auditable code.
2. **Determinism.** The same binary vector always produces the same banner / sidecar — useful for caching, testing,
   user trust, and operator review.
3. **Cost.** Bounded outputs let the smallest model in the family handle the classification reliably. Asking a
   model to write a banner means a larger model is needed for the same safety guarantees.

### Where the richness comes from

From the COMBINATORIAL space of binary vectors. With 23 ids (or 23 + 12 = 35 if all proposed are added), the number
of meaningful patterns the composition layer can recognize is large. Each composition rule maps a SPECIFIC pattern
to a SPECIFIC output, and the layer is free to add rules without changing the model contract. New patterns are
deterministic-layer additions, not model retrains.

---

## 8. Reason code safety

The smoke-test failure investigation surfaced that the live Anthropic response can fail outbound validation when a
`reasonCode` includes a banned verdict token. This section makes the safety discipline explicit.

### Constraints the validator must enforce on `reasonCode`

1. **No verdict tokens.** The reason code's snake_case segments must not include any of:
   `winner, loser, won, lost, right, wrong, true, false, correct, incorrect, proven, defeated`.
2. **No person-label tokens.** Must not include any of:
   `liar, lying, dishonest, manipulative, troll, propagandist, extremist, stupid, idiot, dumb, smart`.
3. **No person-label phrases.** Must not include `bad faith` as a substring (after whitespace collapse).
4. **No truth claims.** The reason describes the move's STRUCTURE, never asserts the move IS / IS NOT truthful.
5. **Snake_case bounded vocabulary.** The validator should accept reasonCode only if it matches
   `/^(parent_continuity|branch_routing|evidence|source_chain|movement|mode_fit|friction|banner)_[a-z0-9_]+$/` AND
   none of its segments are in the verdict/person ban-list.

### Example safe reason codes (catalog families × specific reason)

- `evidence_applicability_disputed`
- `evidence_debt_marker_opened`
- `evidence_debt_marker_closed`
- `movement_concession_with_caveat`
- `movement_sub_axis_introduced`
- `parent_continuity_quote_anchored`
- `source_chain_corroboration_supplied`

### Example unsafe reason codes the validator MUST reject

- `evidence_false_premise` — contains `false`
- `evidence_true_anchor` — contains `true`
- `movement_correct_concession` — contains `correct`
- `parent_continuity_wrong_anchor` — contains `wrong`
- `movement_winner_takes_axis` — contains `winner`

### Implementation recommendation

The validator at `supabase/functions/_shared/semanticReferee/schema.ts` should add a per-`reasonCode` regex check
that enforces the family prefix + segment ban-list. The check belongs in the OUTBOUND schema (the packet validator),
not the INBOUND request schema — it's a property of the model's output, not the caller's input.

This is largely orthogonal to MCP-CAT-001's catalog work, but the catalog proposal should ship with the safe reason
codes for each new id pre-named, so the implementer doesn't have to invent them ad hoc.

---

## 9. How this full scenario informs the existing modularity slate

The catalog design work is INDEPENDENT of the 8-card modularity slate filed at issues #230-#237 — none of the
modularity cards' designs change because of this work. But each modularity card has a clearer scope when this
scenario and document exist alongside it. The mappings:

### MCP-MOD-001 — Documentation reorganization (#230)

**What this adds:** the meta-roadmap referenced by MCP-MOD-001 already names this catalog-design document. After
MCP-MOD-001 lands, this document moves to `docs/core/` alongside the other foundational repo docs (the catalog
design is a foundation for the semantic-referee tree, not a card-specific roadmap expansion). The move is a small
addition to MCP-MOD-001's checklist.

### MCP-MOD-002 — Classifier catalog inventory (#231)

**What this adds:** MCP-MOD-002's deliverable is a document at `docs/architecture/semantic-referee-classifier-catalog.md`
with one section per CURRENT id. This research document's §3 is a precursor — it's already grouped by family and
already includes plain-language signals. MCP-MOD-002's implementer should use §3 as the starting structure and add
the banner-code / ledger-feedback-code columns the inventory specifies. The catalog inventory is for the CURRENT 23
ids only; the proposed new ids from this document are tracked separately under MCP-CAT-001.

### MCP-MOD-003 — Prompt template inventory (#232)

**What this adds:** the prompt template inventory documents how `buildClassifierPrompt` assembles the model input.
This research document's §6 (full-thread context design) is the input it should reference when the prompt template
is extended in MCP-MOD-008. MCP-MOD-003's deliverable is the pre-MCP-MOD-008 template; the post-MCP-MOD-008
extension (with prior-moves context) is documented at landing time.

### MCP-MOD-004 — Source-of-truth extraction (#233)

**What this adds:** MCP-MOD-004's `SEMANTIC_CLASSIFIER_CATALOG` constant carries per-id metadata. MCP-CAT-001 will
add the new ids surfaced here AFTER MCP-MOD-004 lands; the constant's shape is the design target this document
points at. The fields the catalog entry needs (per `SemanticClassifierCatalogEntry` in MCP-MOD-004's design):
`id`, `binarySignal`, `structuralQuestion`, `family`, `bannerCode`, `ledgerFeedbackCode`,
`plainLanguageLabel`. The §5 proposed new ids each pre-name these fields.

### MCP-MOD-005 — Prompt template refactor (#234)

**What this adds:** MCP-MOD-005 makes the prompt template iterate the catalog. Adding new ids becomes a single-file
change to the catalog after MCP-MOD-005 lands. This catalog design's §5 proposal is what gets added — the prompt
template automatically picks up each new id with its `structuralQuestion`.

### MCP-MOD-006 — Banner and ledger refactor (#235)

**What this adds:** MCP-MOD-006 routes per-id banner-code and ledger-feedback-code through the catalog. The proposed
new ids each need a banner code and a ledger code. The composition rules in this document's §7 (and the fixture's
`compositionRules` section) are what those banner / ledger consumers read.

### MCP-MOD-007 — Move-position tracking helper (#236)

**What this adds:** the helper's signature (returning `'first' | 'second' | 'later'`) is what the
`semanticRefereeRules.afterSecondMoveClassificationRule` in this fixture exercises. MCP-MOD-007 ships the helper
without behavior change; MCP-MOD-008 wires it in.

### MCP-MOD-008 — Move-position-aware triggering rule + full-thread context (#237)

**What this adds:** this document's §6 (full-thread context design) is the design input MCP-MOD-008's implementer
reads. The chime-in exemption rule in `semanticRefereeRules` is also documented here and should be honored by
MCP-MOD-008's design.

### Net effect

The 8 modularity cards remain unchanged. This document adds clarity on the WHERE — which card touches which file,
which proposal lands at which step. MCP-CAT-001 (this card) is the 9th piece of work, sequenced AFTER MCP-MOD-004.

---

## 10. Classification eligibility design

Beyond the root-proclamation and first-move-per-participant exemptions, the design must answer: how does eligibility
apply when a chime-in participant joins later?

### The rule

A chime-in participant's FIRST contribution is exempt; classification fires from their SECOND contribution onward.
The eligibility rule is participant-scoped, not primary-vs-chime-in-scoped. It applies uniformly.

### The trigger gate change

The current `evaluateTrigger` in `src/features/semanticReferee/triggerGates.ts` refuses observer / moderator roles
via `isNonParticipantRole`. The new check, layered ABOVE that one:

```ts
// pseudocode, sketched here for design only — implementation is in MCP-MOD-008
if (movePosition === 'first') {
  return { allowed: false, reasonCode: 'first_move_by_author' };
}
if (parentId === null) {
  return { allowed: false, reasonCode: 'root_proclamation' };
}
// existing non-participant check, unchanged
if (isNonParticipantRole(actorRole)) {
  return { allowed: false, reasonCode: 'non_participant_actor' };
}
// existing gate checks fall through
```

### Rationale for chime-in uniformity

Chime-in moves have prior context the chime-in author CAN engage (the mainline arc). But the chime-in author's
SELF-CONTEXT (their own prior moves in the room) is empty for their first contribution. The signals that depend on
the author's own movement (`narrows_claim`, `concedes_narrow_point`, `ready_for_synthesis`) all return 0 by
definition on a chime-in's first move. Skipping classification matches the data the model would actually produce.

### Edge cases

- **A participant rejoins the room after a long absence.** Their NEXT move is their `2 + N`th move overall; the
  helper returns `'later'`, classification fires. No special case.
- **A participant deletes their first move and posts a new first move.** The deletion model is request-only
  (Stage 6.1.8); a posted move is not removed. So this case does not arise.
- **A chime-in participant posts only one move ever.** That move is exempt; the AI never sees the chime-in. The
  layer-1 deterministic UI still renders structural metadata.

---

## 11. Gaps against the current app implementation

The scenario includes concepts that may not exist in the current codebase as of 2026-05-22. This section catalogs
them so the catalog design and the future MCP-CAT-001 card can reason about which proposals depend on which
capabilities.

| Scenario concept | Current implementation status | What would be required to fully support |
|---|---|---|
| Private room from creation | Partial — room model exists; enforced private-from-creation path is QOL-039 territory. | QOL-039 (Public ↔ private room visibility transition). |
| Evidence object as first-class with applicability lifecycle | Partial — EV-001 `EvidenceArtifact` exists; payment-specific fields (amount, date, redacted payer/payee, note, claimedApplicability) are QOL-036; the applicability dispute flow is QOL-037. | QOL-036 + QOL-037. |
| Evidence-debt marker (open / resolved) | Partial — EV-003 evidence-debt tracker exists; the explicit "Source requested" room status line is QOL-037 follow-up. | EV-003 already supports the underlying state; the room-status surfacing is QOL-037 / interaction work. |
| Structured evidence response choices (Accept / Accept-with-caveat / Dispute-applicability / Ask-for-source / etc.) | Missing — QOL-037 territory. | QOL-037. |
| Branch labels for evidence / amount disputes on the same mainline | Partially supported — branch model exists; per-branch label rendering is BR-003 / BR-004 territory. | BR-003 / BR-004 follow-up. |
| Settlement state + locked-private-room rendering | Already supported — debate status + immutable body model. | Existing. |
| Timeline lanes | Already supported — `argumentGameSurfaceModel.computeLane` (Stage 6.3 fix landed the first-child-on-parent-lane rule). | Existing. |
| Chime-in eligibility for classification | NOT yet implemented (`triggerGates.ts`'s `isNonParticipantRole` exists but eligibility is participant-scoped). MCP-MOD-008 will add the move-position-aware rule. | MCP-MOD-007 + MCP-MOD-008. |

### Implications for MCP-CAT-001

- The catalog can be DESIGNED today regardless of the gaps — the design is about what the model should detect, not
  what the UI currently renders.
- The catalog cannot be FULLY DEPLOYED until the supporting concepts (evidence applicability lifecycle,
  evidence-debt UI, structured evidence responses) are implemented. Specifically: the proposed
  `disputes_evidence_applicability`, `opens_evidence_debt_marker`, `closes_evidence_debt_marker`, and
  `supplies_corroborating_document` ids depend on QOL-037's evidence applicability flow.
- The proposed ids whose UI surface already exists (`introduces_sub_axis`, `accepts_partial_with_caveat`,
  `provides_temporal_constraint`, `disputes_specific_amount`, `cites_temporal_boundary`,
  `provides_alternate_interpretation`, `references_prior_agreement`) can ship as soon as MCP-MOD-004 / MCP-CAT-001
  lands.

The MCP-CAT-001 card's finalized proposal should explicitly mark each new id with its "depends-on" list (which
non-MCP feature work it requires to be usable).

---

## 12. Recommendations — sequencing

The recommended sequence, summarizing the operator's overall work plan:

1. **SMOKE-FIX-001** (#229) — ships first. Restores live classification quickly and adds the diagnostic log line
   that gives us the named cause of move-2's `validation_failed`. Independent of everything in this document.
2. **(Optional) SMOKE-FIX-002** — ships next if SMOKE-FIX-001's diagnostic log line indicates a remediation is
   needed (likely a content-scanner exemption for reasonCode or a prompt-tightening pass).
3. **MCP-MOD-001 through MCP-MOD-008** (#230-#237) — ships in the dependency order documented in the modularity
   meta-roadmap. After MCP-MOD-004 lands, the source-of-truth structure exists; MCP-CAT-001 can then design
   directly into it.
4. **MCP-CAT-001** — the card this document is the design input for. Lands AFTER MCP-MOD-004 has shipped. Its
   deliverable is the finalized catalog proposal (new ids, banner codes, ledger codes, reasonCode whitelist, depends-on
   list per id). Its IMPLEMENTATION (adding the new ids to the catalog constant, wiring banners/ledger, extending the
   prompt) is a follow-up card — keeping the design and implementation separate matches the modularity-slate posture.

### What this document does NOT recommend

- Changes to the existing modularity slate cards. They are filed, sized, and ready. This document adds context
  alongside them, not changes inside them.
- Implementing any new classifier id before MCP-MOD-004 lands. The catalog should be authored INTO the new
  source-of-truth structure, not retrofitted later.
- Removing any of the current 23 ids. The catalog v0 is frozen until a future MCP- card explicitly proposes
  retirements. Even the unused-in-this-scenario ids stay because a different scenario exercises them.
- Adding the proposed ids to `ALL_SEMANTIC_CLASSIFIER_IDS` directly. That is a code change MCP-CAT-001 makes after
  the proposal is finalized and after MCP-MOD-004 has shipped.

---

## 13. What this document does NOT do (out of scope, name them so they don't accrete)

- No production code change. The `src/features/semanticReferee/semanticRefereeTypes.ts` 23-id catalog is unchanged.
- No prompt change. The seed prompt in `supabase/functions/_shared/semanticReferee/seedPrompt.ts` is unchanged.
- No banner / ledger change. Their files are unchanged.
- No fixture-runner change. The new fixture is marked `design_fixture_not_runner_ready`.
- No AI call. No Supabase write. No live posting. No smoke-test rerun.
- No invention of fields that conflict with existing fixture conventions. The new fixture extends with new fields
  carrying explicit rationale; canonical fields are preserved.

---

## 14. Status — open questions to resolve in MCP-CAT-001

The following questions are deliberately left open in this design document; MCP-CAT-001's reviewer should resolve
them as part of the card's design phase.

1. Do `provides_temporal_constraint` and `cites_temporal_boundary` merge?
2. Does `accepts_partial_with_caveat` merge with `concedes_narrow_point`?
3. Is `concedes_with_new_dispute` a classifier id or a composition rule output?
4. Should `provides_structured_evidence_object` be a layer-1 metadata signal rather than an AI catalog id?
5. Should the catalog grow by 8-12 new ids in one revision, or in multiple smaller revisions?
6. What is the maximum batch size in the post-revision world? The current ≤5-per-call limit is conservative; with
   12 new ids, batching for post-submit moments may need to grow to 3 batches instead of 2. Reviewer input needed.

None of these blocks this design document from landing. They block MCP-CAT-001's design phase from finalizing.
