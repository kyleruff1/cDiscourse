# Semantic-referee classifier catalog (v1)

**Card:** MCP-MOD-002 (initial inventory) extended by MCP-CAT-001 (catalog v1 extension).
**Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts` — the `ALL_SEMANTIC_CLASSIFIER_IDS` constant freezes the 35-id catalog v1 (catalog v0's 23 ids + MCP-CAT-001's 12 new ids).
**AI question source-of-truth:** `supabase/functions/_shared/semanticReferee/seedPrompt.ts` — `CLASSIFIER_QUESTION_TEXT`.
**Banner mapping source-of-truth:** `src/features/refereeBanners/classifierBannerMap.ts` — `CLASSIFIER_TO_BANNERS`.
**Ledger mapping source-of-truth:** `src/features/refereeLedger/reconcileMove.ts` — the `classifierFor` table inside `l2SignalForCategory` plus the per-category `RefereeFeedbackCode` (`src/features/refereeLedger/types.ts`).

This document inventories every classifier id in catalog v0 and names — per id — the binary signal it
detects, the structural question asked of the AI to detect it, the banner-library code that fires when the
binary returns `value=1` with medium/high confidence, the ledger feedback code emitted for the move's
reconciliation, and the file that today is authoritative for the id-string and structural metadata. The
content is reconstructed from those source files only; no semantics were invented here.

## How to read each section

Each id has five rows:

- **Binary signal** — one-sentence plain-language description of the structural property the binary
  detects. The first place this is written down in plain language. Reconstructed from the AI question text
  and the family description in `docs/designs/MCP-001.md` §8 (Families 1–5). Not transcribed from any
  source file.
- **AI question** — the exact `CLASSIFIER_QUESTION_TEXT[id]` value asked of the live provider, rendered
  byte-for-byte in a fenced code block immediately under a `<!-- ai-question:<id> -->` HTML comment
  marker. The parity test
  (`__tests__/semanticRefereeClassifierCatalogParity.test.ts`) extracts the code-block content via that
  marker and asserts equality with `CLASSIFIER_QUESTION_TEXT[id]`.
- **Banner code** — the first banner-library code listed in `CLASSIFIER_TO_BANNERS[id]`. Rendering inside
  `selectBanner` is bounded by the `BANNER_CATEGORY_PRIORITY` ranking; this row reports the per-id
  candidate, not the per-move selection that `selectBanner` returns at runtime. When the array is empty
  (the `INTENTIONALLY_SILENT_CLASSIFIERS` set), the row reads `—` with the note "intentionally silent".
- **Ledger feedback code** — the `RefereeFeedbackCode` the ledger emits when the binary fires `1` for the
  category this classifier id maps to in `reconcileMove.l2SignalForCategory`'s `classifierFor` table. When
  no category-mapping row exists, the row reads `—` with the note "not yet mapped".
- **Source-of-truth file (today)** — `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`) is the canonical id list for every entry. Listed per row so a future
  source-of-truth move (MCP-MOD-004) only needs to update this column.

The family grouping matches the MCP-MOD-002 design (§3): five sections totaling 23 ids (catalog v0).
MCP-CAT-001 added a sixth section (§F) carrying the 12 catalog v1 extension ids; total is 35.

---

## §A — Parent continuity (5 ids)

### `responds_to_parent`

- **Binary signal:** The move directly engages the parent's claim, mechanism, question, evidence, or
  requested clarification.
- **AI question:**

<!-- ai-question:responds_to_parent -->
```
Does this move directly engage the parent's claim, mechanism, question, evidence, or requested clarification?
```

- **Banner code:** `continuity_clean_tie` (first of `continuity_clean_tie`, `continuity_engages_mechanism`,
  `continuity_picks_up_thread`).
- **Ledger feedback code:** `clean_parent_tie` for the `continuity` category;
  `answered_the_question` for the `direct_response` category (both backed by the same binary in
  `reconcileMove.classifierFor`).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `introduces_new_issue`

- **Binary signal:** The move raises a separately-debatable issue that does not engage the parent's
  current axis.
- **AI question:**

<!-- ai-question:introduces_new_issue -->
```
Does this move raise a new issue that could be debated separately from the parent?
```

- **Banner code:** `tangent_new_issue_here` (first of `tangent_new_issue_here`,
  `branch_belongs_on_branch`).
- **Ledger feedback code:** — (not yet mapped — `reconcileMove.l2SignalForCategory` has no
  `classifierFor` entry for this id; the routing intent surfaces via the `branch_hygiene` /
  `suggests_side_branch` path instead).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `quote_anchors_parent`

- **Binary signal:** The move quotes or paraphrases a span of the parent and engages that span in its
  body.
- **AI question:**

<!-- ai-question:quote_anchors_parent -->
```
Does this move quote or paraphrase a span of the parent and then engage that span in its body?
```

- **Banner code:** `clever_rebuttal_anchored` (first of `clever_rebuttal_anchored`,
  `continuity_clean_tie`).
- **Ledger feedback code:** `nicely_anchored` for the `quote_anchoring` category.
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `requests_clarification`

- **Binary signal:** The move asks what the other participant means by a term or statement.
- **AI question:**

<!-- ai-question:requests_clarification -->
```
Does this move ask what the other participant means by a term or statement?
```

- **Banner code:** `continuity_clarification_landed` (first of `continuity_clarification_landed`,
  `quote_needed_pin_the_passage`).
- **Ledger feedback code:** `clarification_in_play` for the `clarification` category.
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `answers_clarification`

- **Binary signal:** The move answers a clarification request that was raised earlier in the thread.
- **AI question:**

<!-- ai-question:answers_clarification -->
```
Does this move answer a clarification request raised earlier in the thread?
```

- **Banner code:** `continuity_clarification_landed` (first of `continuity_clarification_landed`,
  `continuity_answers_question`).
- **Ledger feedback code:** — (not yet mapped — `reconcileMove.l2SignalForCategory` keys the
  `clarification` category off `requests_clarification`; an answer is observed by the `continuity` /
  `responds_to_parent` row instead).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

---

## §C — Evidence and source chain (7 ids)

### `asks_for_evidence`

- **Binary signal:** The move requests a source, citation, primary source, receipt, or exact quote from
  the participant being replied to.
- **AI question:**

<!-- ai-question:asks_for_evidence -->
```
Does this move request a source, citation, primary source, receipt, or exact quote?
```

- **Banner code:** `evidence_debt_opened` (first of `evidence_debt_opened`,
  `evidence_debt_a_source_would_help`).
- **Ledger feedback code:** — (not yet mapped — `reconcileMove.l2SignalForCategory` reads the
  `evidence_provided` category off `provides_evidence`; an *ask* surfaces upstream through
  `scoreHints.evidencePressure` rather than a per-id `classifierFor` entry).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `provides_evidence`

- **Binary signal:** The move includes or references an attached source, excerpt, quotation, or record.
- **AI question:**

<!-- ai-question:provides_evidence -->
```
Does this move include or reference an attached source, excerpt, quotation, or record?
```

- **Banner code:** `evidence_debt_source_attached` (first of `evidence_debt_source_attached`,
  `evidence_debt_resolved`).
- **Ledger feedback code:** `source_attached` for the `evidence_provided` category;
  `evidence_debt_open` is the soft / debt-opened sibling for the same category.
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `evidence_supports_claim`

- **Binary signal:** The attached evidence appears to attach to the exact claim being made in the move.
- **AI question:**

<!-- ai-question:evidence_supports_claim -->
```
Does the attached evidence appear to attach to the exact claim being made in this move?
```

- **Banner code:** `evidence_debt_resolved` (first of `evidence_debt_resolved`,
  `evidence_debt_source_attached`).
- **Ledger feedback code:** `evidence_connects` for the `evidence_relevance` category;
  `evidence_needs_connecting` is the soft sibling for the same category.
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `uses_popularity_as_evidence`

- **Binary signal:** The move uses likes, shares, virality, or an "everyone says" appeal as evidentiary
  support — never a verdict about the participant.
- **AI question:**

<!-- ai-question:uses_popularity_as_evidence -->
```
Does this move use likes, shares, virality, or an "everyone says" appeal as evidentiary support?
```

- **Banner code:** `source_chain_gap_popularity_not_proof`.
- **Ledger feedback code:** — (not yet mapped — `reconcileMove` feeds this binary into the
  anti-amplification context (`amplificationContextFromAnnotationFields`), which can suppress factual-
  standing gain on the `evidence_*` categories; there is no direct `classifierFor` row).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `uses_satire_as_evidence`

- **Binary signal:** The move uses satire, parody, a meme, or fiction as factual support for a claim.
- **AI question:**

<!-- ai-question:uses_satire_as_evidence -->
```
Does this move use satire, parody, a meme, or fiction as factual support for a claim?
```

- **Banner code:** `source_chain_gap_satire_not_evidence`.
- **Ledger feedback code:** — (not yet mapped — `reconcileMove.l2SignalForCategory` has no
  `classifierFor` entry for this id).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `cites_retraction`

- **Binary signal:** The move cites a retraction, correction, update, or changed record relevant to the
  source chain.
- **AI question:**

<!-- ai-question:cites_retraction -->
```
Does this move cite a retraction, correction, update, or changed record?
```

- **Banner code:** `source_chain_gap_retraction_noted`.
- **Ledger feedback code:** — (not yet mapped — `reconcileMove.l2SignalForCategory` has no
  `classifierFor` entry for this id).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `creates_source_chain_gap`

- **Binary signal:** The move leaves a gap in the source trail — a missing origin, quote, context, or
  link — that prevents the move from carrying factual-standing weight.
- **AI question:**

<!-- ai-question:creates_source_chain_gap -->
```
Does this move leave a gap in the source trail — a missing origin, quote, context, or link?
```

- **Banner code:** `source_chain_gap_chain_breaks` (first of `source_chain_gap_chain_breaks`,
  `source_chain_gap_trace_it_back`, `source_chain_gap_one_more_link`).
- **Ledger feedback code:** — (not yet mapped — `reconcileMove` feeds this binary into the
  anti-amplification context (`evidentiaryRisk: 'high'` / `amplificationSignals.unknown_source_chain`),
  which suppresses factual-standing gain via the `evidence_*` categories rather than emitting a per-id
  feedback code).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

---

## §D — Constructive movement (4 ids)

### `narrows_claim`

- **Binary signal:** The move limits a broader claim to a more specific, more defensible scope.
- **AI question:**

<!-- ai-question:narrows_claim -->
```
Does this move limit a broader claim to a more specific, more defensible scope?
```

- **Banner code:** `synthesis_nice_narrowing` (first of `synthesis_nice_narrowing`,
  `synthesis_narrow_concession_noted`).
- **Ledger feedback code:** `nice_narrowing` for the `narrowing` category (category authority is
  `economy`; the ledger adopts the point-standing-economy delta bit-for-bit and the feedback code is
  named in `RefereeFeedbackCode`).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `concedes_narrow_point`

- **Binary signal:** The move accepts a specific, limited point raised by the other participant; the
  broad point still stands.
- **AI question:**

<!-- ai-question:concedes_narrow_point -->
```
Does this move accept a specific, limited point raised by the other participant?
```

- **Banner code:** `synthesis_narrow_concession_noted` (first of `synthesis_narrow_concession_noted`,
  `synthesis_nice_narrowing`).
- **Ledger feedback code:** `concession_noted` for the `concession` category;
  `broad_point_set_down` is the sibling code for a broad concession on the same category.
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `ready_for_synthesis`

- **Binary signal:** There is clear shared ground in the thread plus only limited unresolved debt — the
  point is ready to be summarized as a synthesis.
- **AI question:**

<!-- ai-question:ready_for_synthesis -->
```
Is there clear shared ground in the thread plus only limited unresolved debt?
```

- **Banner code:** `synthesis_shared_ground_named` (first of `synthesis_shared_ground_named`,
  `synthesis_almost_there`, `synthesis_sides_converging`).
- **Ledger feedback code:** `synthesis_named` for the `synthesis` category;
  `almost_a_synthesis` is the prompt sibling when `lifecycleSynthesisReady` is false (hint magnitude
  clamps to 0 and the reconciler emits the soft prompt).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `needs_pre_send_pause`

- **Binary signal:** The move could be tightened by its author before it is sent — a pacing nudge, never
  a block.
- **AI question:**

<!-- ai-question:needs_pre_send_pause -->
```
Could this move be tightened by its author before it is sent?
```

- **Banner code:** `pacing_a_pause_before_sending` (first of `pacing_a_pause_before_sending`,
  `pacing_take_a_short_pause`).
- **Ledger feedback code:** — (not yet mapped — `reconcileMove.l2SignalForCategory` has no
  `classifierFor` entry for this id; pacing surfaces deterministically through the
  `respecting_pacing` category's `respectsPacing` layer-1 fact).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

---

## §E — Debate-mode fit (3 ids)

### `fits_selected_debate_mode`

- **Binary signal:** The move's register fits the room's selected debate mode.
- **AI question:**

<!-- ai-question:fits_selected_debate_mode -->
```
Does this move's register fit the room's selected debate mode?
```

- **Banner code:** `mode_mismatch_fits_the_room`.
- **Ledger feedback code:** `fits_the_room` for the `staying_in_mode` category.
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `contains_playable_hot_take`

- **Binary signal:** The move is spicy, contrarian, or provocative while still being a coherent,
  answerable claim.
- **AI question:**

<!-- ai-question:contains_playable_hot_take -->
```
Is this move spicy, contrarian, or provocative while still being a coherent, answerable claim?
```

- **Banner code:** `hot_take_playable` (first of `hot_take_playable`, `hot_take_has_an_edge`,
  `hot_take_room_can_engage`).
- **Ledger feedback code:** — (not yet mapped — `reconcileMove.l2SignalForCategory` has no
  `classifierFor` entry for this id).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `is_satire_or_parody`

- **Binary signal:** The move itself reads as satire, parody, a meme, or fiction rather than a literal
  claim.
- **AI question:**

<!-- ai-question:is_satire_or_parody -->
```
Does this move itself read as satire, parody, a meme, or fiction rather than a literal claim?
```

- **Banner code:** `hot_take_invites_a_reply`.
- **Ledger feedback code:** — (not yet mapped — `reconcileMove.l2SignalForCategory` has no
  `classifierFor` entry for this id).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

---

## §B / §G — Branch routing and friction (4 ids)

### `suggests_side_branch`

- **Binary signal:** The move would read more cleanly on a same-topic side branch than on the main line.
- **AI question:**

<!-- ai-question:suggests_side_branch -->
```
Would this move read more cleanly on a same-topic side branch than on the main line?
```

- **Banner code:** `branch_new_voice_welcome` (first of `branch_new_voice_welcome`,
  `branch_belongs_on_branch`).
- **Ledger feedback code:** `clean_branch` for the `branch_hygiene` category;
  `belongs_on_a_branch` is the route-prompt sibling for the same category.
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `suggests_diagonal_tangent`

- **Binary signal:** The move steps to a related but distinct issue that fits its own tangent branch.
- **AI question:**

<!-- ai-question:suggests_diagonal_tangent -->
```
Does this move step to a related but distinct issue that fits its own tangent branch?
```

- **Banner code:** `tangent_different_axis` (first of `tangent_different_axis`,
  `tangent_new_issue_here`).
- **Ledger feedback code:** — (not yet mapped — `reconcileMove.l2SignalForCategory` keys
  `branch_hygiene` off `suggests_side_branch`; a diagonal tangent surfaces deterministically through the
  `branchKind` layer-1 fact and the `branch_hygiene` reading).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `shifts_to_person_or_intent`

- **Binary signal:** The move redirects from the argument toward the other participant or their intent
  — a routing signal, never a person label.
- **AI question:**

<!-- ai-question:shifts_to_person_or_intent -->
```
Does this move redirect from the argument toward the other participant or their intent?
```

- **Banner code:** `hot_take_keeps_it_about_the_claim`.
- **Ledger feedback code:** `back_to_the_claim` for the `person_intent_drift` category
  (negative-only hygiene reading — a fired binary maps to a `-1` sign in `reconcileMove.semanticSign`;
  the ledger never produces a positive `person_intent_drift` delta).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `contains_unplayable_insult_only`

- **Binary signal:** The move is only an insult, with no claim, question, or evidence the room can
  engage.
- **AI question:**

<!-- ai-question:contains_unplayable_insult_only -->
```
Is this move only an insult, with no claim, question, or evidence to engage?
```

- **Banner code:** — (intentionally silent — `CLASSIFIER_TO_BANNERS[contains_unplayable_insult_only]`
  is `[]` and the id is the sole member of `INTENTIONALLY_SILENT_CLASSIFIERS` in
  `refereeBannerLibrary.ts`; the move is never labelled "an insult" — the binary is a routing signal
  for the friction-suggestion path).
- **Ledger feedback code:** — (not yet mapped — `reconcileMove.l2SignalForCategory` has no
  `classifierFor` entry for this id; consistent with the intentionally silent banner posture).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

---

## §F — MCP-CAT-001 extensions (12 ids — catalog v1)

The MCP-CAT-001 catalog extension landed 12 new ids surfaced by the band-space-rent evidence scenario
(`fixtures/argument-scenarios/catalog-design-band-space-rent-evidence.json`) and documented in the
catalog design at `docs/roadmap-expansions/2026-05-23-binary-classifier-catalog-design.md` §5. Two
settlement ids (`proposes_settlement_terms` / `accepts_settlement_terms`) were operator-specified
extensions; their structural questions were derived from the scenario's `expectedSettlement` section.

Every new id has a per-id `bannerCode` (no intentional silence in this batch) and a `null`
`ledgerFeedbackCode` (the new ids surface through the banner library and through new composition
rules, not through the per-category ledger lookup — see "Classifier ids with no ledger feedback
mapping" below for the consolidated count).

### `disputes_evidence_applicability`

- **Binary signal:** The move challenges what an attached evidence object COVERS rather than whether
  the evidence exists.
- **AI question:**

<!-- ai-question:disputes_evidence_applicability -->
```
Does this move challenge what an attached evidence object covers rather than whether it exists?
```

- **Banner code:** `evidence_debt_applicability_disputed`.
- **Ledger feedback code:** — (not yet mapped — surfaces through the banner library and the
  `R-EV-APP-01` composition rule).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `references_prior_agreement`

- **Binary signal:** The move cites a prior agreement between the participants that bears on the
  current dispute.
- **AI question:**

<!-- ai-question:references_prior_agreement -->
```
Does this move cite a prior agreement between the participants that bears on the current dispute?
```

- **Banner code:** `synthesis_prior_agreement_cited`.
- **Ledger feedback code:** — (not yet mapped — surfaces through the banner library).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `provides_temporal_constraint`

- **Binary signal:** The move cites a specific date, timeline, or temporal boundary that constrains
  the dispute.
- **AI question:**

<!-- ai-question:provides_temporal_constraint -->
```
Does this move cite a specific date, timeline, or temporal boundary that constrains the dispute?
```

- **Banner code:** `synthesis_temporal_anchor_added`.
- **Ledger feedback code:** — (not yet mapped — surfaces through the banner library).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `accepts_partial_with_caveat`

- **Binary signal:** The move accepts a specific point raised by the parent while qualifying or
  restricting the acceptance.
- **AI question:**

<!-- ai-question:accepts_partial_with_caveat -->
```
Does this move accept a specific point raised by the parent while qualifying or restricting the acceptance?
```

- **Banner code:** `synthesis_qualified_concession_with_caveat`.
- **Ledger feedback code:** — (not yet mapped — surfaces through the banner library and the
  `R-CAT-QualifiedConcession` composition rule).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `provides_alternate_interpretation`

- **Binary signal:** The move offers an alternate reading of an existing artifact (note text, date,
  label) that the parent treated as fixed.
- **AI question:**

<!-- ai-question:provides_alternate_interpretation -->
```
Does this move offer an alternate reading of an existing artifact that the parent treated as fixed?
```

- **Banner code:** `synthesis_alternate_interpretation_offered`.
- **Ledger feedback code:** — (not yet mapped — surfaces through the banner library).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `opens_evidence_debt_marker`

- **Binary signal:** The move opens a structured evidence-debt marker — a tracked Ask-for-source
  request distinct from a rhetorical ask.
- **AI question:**

<!-- ai-question:opens_evidence_debt_marker -->
```
Does this move open a structured evidence-debt marker (a tracked Ask-for-source request)?
```

- **Banner code:** `evidence_debt_marker_opened`.
- **Ledger feedback code:** — (not yet mapped — surfaces through the banner library).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `closes_evidence_debt_marker`

- **Binary signal:** The move responds to an open evidence-debt marker with the requested source or
  quote.
- **AI question:**

<!-- ai-question:closes_evidence_debt_marker -->
```
Does this move respond to an open evidence-debt marker with the requested source or quote?
```

- **Banner code:** `evidence_debt_marker_closed`.
- **Ledger feedback code:** — (not yet mapped — surfaces through the banner library).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `supplies_corroborating_document`

- **Binary signal:** The move attaches a document that corroborates a prior claim on the timeline
  rather than introducing new primary evidence.
- **AI question:**

<!-- ai-question:supplies_corroborating_document -->
```
Does this move attach a document that corroborates a prior claim rather than introducing primary evidence?
```

- **Banner code:** `evidence_debt_corroborating_document`.
- **Ledger feedback code:** — (not yet mapped — surfaces through the banner library and the
  `R-CAT-Corroborating` composition rule).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `introduces_sub_axis`

- **Binary signal:** The move opens a new, more specific sub-dispute on the SAME mainline rather
  than continuing the parent axis.
- **AI question:**

<!-- ai-question:introduces_sub_axis -->
```
Does this move open a new, more specific sub-dispute on the same mainline rather than continuing the parent axis?
```

- **Banner code:** `synthesis_sub_axis_introduced`.
- **Ledger feedback code:** — (not yet mapped — surfaces through the banner library and the
  `R-CAT-SubAxis` composition rule, which fires
  `sub_axis_opened` on the current move and records a `SubAxisState` on the composition state).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `concedes_with_new_dispute`

- **Binary signal:** The move pairs a concession on one axis with a new dispute on a different axis.
- **AI question:**

<!-- ai-question:concedes_with_new_dispute -->
```
Does this move pair a concession on one axis with a new dispute on a different axis?
```

- **Banner code:** `synthesis_concession_with_new_dispute`.
- **Ledger feedback code:** — (not yet mapped — surfaces through the banner library; the paired
  concede-and-open pattern is also expressible as a composition rule that AND's
  `concedes_narrow_point=1` with `introduces_sub_axis=1`).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `proposes_settlement_terms`

- **Binary signal:** The move proposes a settlement summary or resolution terms the other
  participant could accept.
- **AI question:**

<!-- ai-question:proposes_settlement_terms -->
```
Does this move propose a settlement summary or resolution terms the other participant could accept?
```

- **Banner code:** `synthesis_settlement_proposed`.
- **Ledger feedback code:** — (not yet mapped — surfaces through the banner library and the
  `R-CAT-Settlement` composition rule).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

### `accepts_settlement_terms`

- **Binary signal:** The move accepts a proposed settlement summary or resolution terms.
- **AI question:**

<!-- ai-question:accepts_settlement_terms -->
```
Does this move accept a proposed settlement summary or resolution terms?
```

- **Banner code:** `synthesis_settlement_accepted`.
- **Ledger feedback code:** — (not yet mapped — surfaces through the banner library and the
  `R-CAT-Settlement` composition rule).
- **Source-of-truth file (today):** `supabase/functions/_shared/semanticReferee/types.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`).

---

## Findings

These findings are **informational** — the design (MCP-MOD-002 §6) names them as inputs to MCP-MOD-004
(the source-of-truth extraction). They are not fixed here.

### Classifier ids with no banner mapping (1)

- `contains_unplayable_insult_only` — intentional silence. The id is the sole member of
  `INTENTIONALLY_SILENT_CLASSIFIERS` in `refereeBannerLibrary.ts`. This is a *deliberate* gap and is
  asserted exactly by `refereeBannerLibrary.test.ts`. Future MCP-MOD-004 / MCP-MOD-006 work should
  preserve this carve-out by lifting the silence flag into the source-of-truth metadata rather than
  re-deriving it from an empty array.

### Classifier ids with no ledger feedback mapping (24, catalog v1)

The ledger today maps 11 of the 35 classifier ids to a `RefereeFeedbackCode` via
`reconcileMove.l2SignalForCategory`'s `classifierFor` table (the same 11 catalog-v0 ids — MCP-CAT-001
did NOT add per-id ledger mappings for the new ids; they surface through the banner library and the
composition layer). The remaining 24 ids contribute either through `scoreHints` (the six
`SemanticScoreHints` integers — `continuityCredit`, `evidencePressure`, `branchHygiene`,
`synthesisReadiness`, `sourceChainDebt`, `unresolvedRedirectRisk`) or through the anti-amplification
context or the banner library — they have no direct per-id `classifierFor` row:

- `introduces_new_issue` — surfaces via the `branch_hygiene` / `suggests_side_branch` path.
- `answers_clarification` — `clarification` category keys off `requests_clarification`.
- `asks_for_evidence` — surfaces via `scoreHints.evidencePressure`.
- `uses_popularity_as_evidence` — feeds the anti-amplification context (suppresses factual-standing
  gain on the `evidence_*` categories).
- `uses_satire_as_evidence` — no `classifierFor` row.
- `cites_retraction` — no `classifierFor` row.
- `creates_source_chain_gap` — feeds the anti-amplification context.
- `needs_pre_send_pause` — `respecting_pacing` category derives its signal from the layer-1
  `respectsPacing` fact, not a classifier id.
- `contains_playable_hot_take` — no `classifierFor` row.
- `is_satire_or_parody` — no `classifierFor` row.
- `suggests_diagonal_tangent` — `branch_hygiene` category keys off `suggests_side_branch`.
- `contains_unplayable_insult_only` — intentionally silent on both the banner and ledger sides.
- `disputes_evidence_applicability` (MCP-CAT-001) — surfaces through the banner library and the
  `R-EV-APP-01` composition rule.
- `references_prior_agreement` (MCP-CAT-001) — surfaces through the banner library.
- `provides_temporal_constraint` (MCP-CAT-001) — surfaces through the banner library.
- `accepts_partial_with_caveat` (MCP-CAT-001) — surfaces through the banner library and the
  `R-CAT-QualifiedConcession` composition rule.
- `provides_alternate_interpretation` (MCP-CAT-001) — surfaces through the banner library.
- `opens_evidence_debt_marker` (MCP-CAT-001) — surfaces through the banner library.
- `closes_evidence_debt_marker` (MCP-CAT-001) — surfaces through the banner library.
- `supplies_corroborating_document` (MCP-CAT-001) — surfaces through the banner library and the
  `R-CAT-Corroborating` composition rule.
- `introduces_sub_axis` (MCP-CAT-001) — surfaces through the banner library and the `R-CAT-SubAxis`
  composition rule.
- `concedes_with_new_dispute` (MCP-CAT-001) — surfaces through the banner library.
- `proposes_settlement_terms` (MCP-CAT-001) — surfaces through the banner library and the
  `R-CAT-Settlement` composition rule.
- `accepts_settlement_terms` (MCP-CAT-001) — surfaces through the banner library and the
  `R-CAT-Settlement` composition rule.

The pattern is consistent: ids whose downstream effect is routing, friction-suggestion, anti-
amplification, pacing, banner-only surfacing, or composition-rule-only surfacing currently bypass
`classifierFor`. MCP-CAT-001 added 12 new ids in this same posture (banner + composition, no
`classifierFor` row).

### Wording-vs-family drift (none observed)

Each question's wording matches its family-section claim. No §A id reads §C-flavored, no §C id reads
§D-flavored, and so on. The bracketed §B/§G grouping for branch-routing-and-friction is sound — the
four ids (`suggests_side_branch`, `suggests_diagonal_tangent`, `shifts_to_person_or_intent`,
`contains_unplayable_insult_only`) share the routing / friction-suggestion downstream surface.

### Near-duplicate questions (one notable pair)

- `suggests_side_branch` ("Would this move read more cleanly on a same-topic side branch than on the
  main line?") and `suggests_diagonal_tangent` ("Does this move step to a related but distinct issue
  that fits its own tangent branch?") both ask about branch / tangent placement. The questions differ
  in the *type* of branch (same-topic vertical vs related-distinct diagonal) but a model may answer
  both `1` on the same move. This is the only near-duplicate pair in catalog v0; it does NOT need a fix
  here, but MCP-MOD-004 should consider whether the source-of-truth distinguishes them by
  `routeSuggestion` value (`vertical_chime_branch` vs `diagonal_tangent`) rather than by separate
  binary ids.

A weaker overlap exists in §D between `narrows_claim` ("limit a broader claim to a more specific
scope") and `concedes_narrow_point` ("accept a specific, limited point") — both can fire `1` on a
narrowing repair. The ledger handles this by mapping them to two distinct economy-owned categories
(`narrowing` and `concession`) with distinct `RefereeFeedbackCode`s, so it is not a near-duplicate at
the downstream level.
