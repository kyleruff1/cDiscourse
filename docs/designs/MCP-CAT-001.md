# MCP-CAT-001 — Binary classifier catalog design and scenario-derived question set

**Status:** Design draft (finalized proposal of record for operator GATE-A review)
**Epic:** Epic 12 — Semantic-referee / Rules UX (MCP track)
**Release:** MCP semantic-referee tree (post-MCP-MOD-004)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/238

---

## Status / boundary (read first)

This is a **DESIGN-ONLY** card. The deliverable is a finalized catalog *proposal*, not an
implementation. No production code, type, fixture, prompt, banner, or ledger file is changed by this
document.

Three boundaries bind the whole proposal:

1. **The binary return model is preserved (hard architectural constraint).** The model returns
   **0/1 signals only** — `value: 0 | 1` per classifier, plus a bounded `confidence` and a bounded
   `reasonCode`. Richness comes from **deterministic composition of binary vectors**, never from
   model-generated natural language. No proposal in this document introduces a free-text or
   multi-valued classifier output. The packet has no banner field, no truth field, no verdict field,
   no copy field by schema (`SemanticRefereePacket` in
   `src/features/semanticReferee/semanticRefereeTypes.ts`).
2. **Implementation is a SEPARATE follow-up.** Per issue #238 and the research doc §12, the catalog
   *implementation* (adding ids to the constant, wiring banners/ledger, extending the prompt) lands
   AFTER both this card (the finalized proposal) and MCP-MOD-004 / #233 (the source-of-truth
   structure) have shipped. This document is the proposal those follow-ups consume.
3. **This document does not adjudicate truth.** Per `cdiscourse-doctrine` §1, §4, §10a: no classifier
   id, reasonCode, banner code, or plain-language label is a verdict or person label. Every id
   describes a *text feature*. Machine-generated labels are **Observations**, never **Allegations**
   (§10a).

### Process finding — design/implementation inversion (PRIMARY open item for the operator)

During the design survey it was discovered that **the catalog v1 implementation has already landed on
`main`** ahead of this design card:

- `src/features/semanticReferee/semanticRefereeTypes.ts` already declares the **35-id** union
  (`SemanticClassifierId`) and `ALL_SEMANTIC_CLASSIFIER_IDS` — catalog v0's 23 ids plus 12 new ids,
  under a `// ── MCP-CAT-001 (catalog v1) — 12 new ids` comment block.
- `src/lib/constitution/semanticClassifierCatalog.ts` (the MCP-MOD-004 source-of-truth constant,
  `SEMANTIC_CLASSIFIER_CATALOG`) carries full per-id metadata for all 35 ids.
- The reasonCode safety rules, the banner library, the ledger reconciliation, the full-thread context
  helpers, and the batching plan are all implemented.
- Git: commit `78e9056` "MCP-CAT-001: catalog v1 — extend SEMANTIC_CLASSIFIER_CATALOG from 23 to 35
  ids (#252)" is merged. Issue #238 (this design card) is still **OPEN**.

This means the design card is being authored **retroactively** against an already-shipped
implementation. That is an inversion of the intended order (`research doc → MCP-CAT-001 design →
GATE-A → implementation`). The consequence for this document: it serves a **dual role** —

- It is the **finalized proposal of record** (the artifact GATE-A was meant to review), authored to
  match the implementation that shipped, so the proposal and the code agree.
- It is **partly retroactive documentation**: where the implementation resolved an open question, this
  doc records the resolution *and* states whether the resolution matches the research doc's
  recommendation or diverges from it (two material divergences are flagged in §G).

No paper-over: the inversion itself is surfaced as the first open question in §I, because the operator
should decide whether GATE-A is now a ratification review (the implementation stands) or a
reconsideration (some shipped decisions get revisited). The remainder of this document is written so
either decision is well-supported.

---

## Goal (one paragraph)

The catalog-v0 semantic referee classifies a move against **23 binary structural signals**. The
band-space-rent evidence scenario (a calm, two-participant private dispute over which obligation a
$120 payment covered) exercises only 9 of those 23 and surfaces concrete gaps: there is no signal for
*evidence applicability* (the evidence exists but is being applied to the wrong obligation), no signal
for a *tracked evidence-debt marker* (distinct from a rhetorical "got a source?"), no signal for
*qualified concession with a caveat*, and no signal for a *sub-axis opened on the same mainline*.
MCP-CAT-001 finalizes a **catalog v1** that adds 12 new binary ids (plus the reasonCode safety
discipline the smoke-test investigation showed is needed regardless), each carrying a family
assignment, a candidate banner code, a candidate ledger feedback code, a candidate plain-language
label, a depends-on list, and an example scenario move. The design is shaped by `cdiscourse-doctrine`:
every id is a text-feature detector, never a truth verdict (§1); the AI never decides who is right
(§4); composition is deterministic and auditable so the model cannot smuggle a verdict through a
free-text field (§1, §4); machine-generated labels are Observations (§10a); and the proposal preserves
the binary return model as the safety boundary that keeps the smallest model in the family sufficient.

---

## Data model

**No new runtime data model is proposed by this design.** The catalog change is additive metadata
within existing shapes. For reference, the shapes the proposal targets (all already defined; the
proposal does not redefine them):

```ts
// src/features/semanticReferee/semanticRefereeTypes.ts (existing — the contract this design targets)
export type SemanticClassifierId = /* 35-id union (catalog v1) */;
export type Binary01 = 0 | 1;
export type SemanticConfidence = 'low' | 'medium' | 'high';

export type SemanticBinarySample = Readonly<{
  classifierId: SemanticClassifierId;
  value: Binary01;            // the literal 0 or 1 — never a JSON boolean
  confidence: SemanticConfidence;
  reasonCode: string;         // bounded snake_case; family-prefixed; ban-list scanned
  evidenceSpan?: string;      // bounded substring of input, ≤ MAX_COPY_FIELD_LEN
  parentSpan?: string;
}>;
```

```ts
// src/lib/constitution/semanticClassifierCatalog.ts (MCP-MOD-004 source-of-truth — the per-id metadata table)
export interface SemanticClassifierCatalogEntry {
  readonly id: SemanticClassifierId;
  readonly binarySignal: string;            // plain-language description of what the binary detects
  readonly structuralQuestion: string;      // the yes/no question asked of the model (drives the prompt)
  readonly family: SemanticClassifierFamily; // parent_continuity | evidence | movement | mode_fit | routing | friction
  readonly bannerCode: string | null;       // primary banner code (null = intentionally silent)
  readonly bannerCodePriorityList: readonly string[];
  readonly ledgerFeedbackCode: string | null;
  readonly ledgerCategories: readonly string[];
  readonly plainLanguageLabel?: string;     // forward-compat seam; v0 leaves empty
}
```

The 12 new ids are 12 additional `SemanticClassifierCatalogEntry` rows plus 12 additional
`SemanticClassifierId` union members. The binary signal stays binary; nothing widens to free text.

---

## A1. Inventory of the current 23 classifier ids (criterion 1)

> **Cross-reference, not duplicate.** The authoritative per-id inventory — with the byte-exact AI
> question, banner code, ledger feedback code, and source-of-truth file per id — already lives at
> **`docs/architecture/semantic-referee-classifier-catalog.md`** (MCP-MOD-002's deliverable, with a
> §F catalog-v1 extension). The per-id metadata is also machine-readable in
> **`src/lib/constitution/semanticClassifierCatalog.ts`** (`SEMANTIC_CLASSIFIER_CATALOG`, the
> MCP-MOD-004 source of truth). This section is a **compact index** keyed to those documents — it does
> not restate the per-id prose. Read the inventory doc for the full per-id rows.

The 23 catalog-v0 ids, grouped by the family the source-of-truth constant assigns, with the binary
signal (one line), the primary banner code, and the primary ledger feedback code (`—` = no per-id
category mapping; the id contributes through `scoreHints` / anti-amplification / layer-1 facts):

### Family: parent_continuity (6 ids as grouped in the constant)

| Id | Binary signal (one line) | Banner code (primary) | Ledger code (primary) |
|---|---|---|---|
| `responds_to_parent` | Directly engages the parent's claim/mechanism/question/evidence | `continuity_clean_tie` | `clean_parent_tie` |
| `introduces_new_issue` | Raises a separately-debatable issue off the parent's axis | `tangent_new_issue_here` | `—` |
| `quote_anchors_parent` | Quotes/paraphrases a parent span and engages it | `clever_rebuttal_anchored` | `nicely_anchored` |
| `requests_clarification` | Asks what a term/statement means | `continuity_clarification_landed` | `clarification_in_play` |
| `answers_clarification` | Answers an earlier clarification request | `continuity_clarification_landed` | `—` |

### Family: evidence (7 ids)

| Id | Binary signal (one line) | Banner code (primary) | Ledger code (primary) |
|---|---|---|---|
| `asks_for_evidence` | Requests a source/citation/quote | `evidence_debt_opened` | `—` |
| `provides_evidence` | Includes/references an attached source/excerpt/record | `evidence_debt_source_attached` | `source_attached` |
| `evidence_supports_claim` | Attached evidence attaches to the exact claim | `evidence_debt_resolved` | `evidence_connects` |
| `uses_popularity_as_evidence` | Uses likes/shares/"everyone says" as support | `source_chain_gap_popularity_not_proof` | `—` |
| `uses_satire_as_evidence` | Uses satire/parody/meme as factual support | `source_chain_gap_satire_not_evidence` | `—` |
| `cites_retraction` | Cites a retraction/correction/changed record | `source_chain_gap_retraction_noted` | `—` |
| `creates_source_chain_gap` | Leaves a gap in the source trail | `source_chain_gap_chain_breaks` | `—` |

### Family: movement (4 ids)

| Id | Binary signal (one line) | Banner code (primary) | Ledger code (primary) |
|---|---|---|---|
| `narrows_claim` | Limits a broad claim to a defensible scope | `synthesis_nice_narrowing` | `nice_narrowing` |
| `concedes_narrow_point` | Accepts a specific limited point; broad point stands | `synthesis_narrow_concession_noted` | `concession_noted` |
| `ready_for_synthesis` | Shared ground plus limited unresolved debt | `synthesis_shared_ground_named` | `synthesis_named` |
| `needs_pre_send_pause` | Could be tightened before sending (pacing nudge) | `pacing_a_pause_before_sending` | `—` |

### Family: mode_fit (3 ids)

| Id | Binary signal (one line) | Banner code (primary) | Ledger code (primary) |
|---|---|---|---|
| `fits_selected_debate_mode` | Register fits the room's selected argument mode | `mode_mismatch_fits_the_room` | `fits_the_room` |
| `contains_playable_hot_take` | Spicy/contrarian yet coherent and answerable | `hot_take_playable` | `—` |
| `is_satire_or_parody` | Reads as satire/parody/fiction, not a literal claim | `hot_take_invites_a_reply` | `—` |

### Family: routing (2 ids)

| Id | Binary signal (one line) | Banner code (primary) | Ledger code (primary) |
|---|---|---|---|
| `suggests_side_branch` | Reads more cleanly on a same-topic side branch | `branch_new_voice_welcome` | `clean_branch` |
| `suggests_diagonal_tangent` | Steps to a related-but-distinct tangent issue | `tangent_different_axis` | `—` |

### Family: friction (2 ids)

| Id | Binary signal (one line) | Banner code (primary) | Ledger code (primary) |
|---|---|---|---|
| `shifts_to_person_or_intent` | Redirects toward the participant or their intent (routing signal) | `hot_take_keeps_it_about_the_claim` | `back_to_the_claim` |
| `contains_unplayable_insult_only` | Only an insult, nothing to engage | **`—` (intentionally silent)** | `—` |

> **Doctrine note on the two friction ids:** `shifts_to_person_or_intent` and
> `contains_unplayable_insult_only` are **Observations rendered composer-only** (`cdiscourse-doctrine`
> §10a) — they never render on the target's node, because surfacing them publicly reads as accusation.
> `contains_unplayable_insult_only` is in `INTENTIONALLY_SILENT_CLASSIFIERS` (no banner code).

**Family-naming reconciliation (cross-reference detail).** The source-of-truth constant's
`SemanticClassifierFamily` uses six values: `parent_continuity | evidence | movement | mode_fit |
routing | friction`. The MCP-MOD-002 inventory doc groups under five lettered sections (§A–§E) plus a
§F extension. These are the same groupings under different labels; the inventory doc is authoritative
for the lettered presentation, the constant is authoritative for the machine `family` field. No
proposal changes either.

**Source-of-truth-location reconciliation (cross-reference detail).** Two docs name different
"source-of-truth" files for the id list: the catalog constant's header names the **Node-side**
`SemanticClassifierId` union in `src/features/semanticReferee/semanticRefereeTypes.ts`; the inventory
doc names the **Deno mirror** `supabase/functions/_shared/semanticReferee/types.ts`. Both are
byte-identical mirrors kept in parity by a parity test; the Node side is canonical and the Deno side
mirrors it. This proposal does not change the parity arrangement; it only notes that a reader should
treat the Node union as canonical.

---

## A2. Per-id keep / rename / merge / split / retire status (criterion 2)

The research doc §12 recommends: **retire none, rename none.** "The catalog v0 is frozen until a
future MCP- card explicitly proposes retirements. Even the unused-in-this-scenario ids stay because a
different scenario exercises them." This proposal **affirms that recommendation in full** for all 23
existing ids.

| Existing id | Status | Rationale |
|---|---|---|
| All 5 parent_continuity ids | **KEEP** | Core continuity vocabulary; `responds_to_parent` + `quote_anchors_parent` are the two most-fired ids in the scenario. |
| All 7 evidence ids | **KEEP** | Evidence hygiene is the scenario's spine; `asks_for_evidence` / `provides_evidence` / `evidence_supports_claim` / `creates_source_chain_gap` all fire. The 3 anti-amplification ids (`uses_popularity_as_evidence`, `uses_satire_as_evidence`, `cites_retraction`) are unused here but doctrine-load-bearing (§3) — a satire/popularity fixture exercises them. |
| All 4 movement ids | **KEEP** | `narrows_claim` / `concedes_narrow_point` / `ready_for_synthesis` fire; `needs_pre_send_pause` is a pacing nudge used by other scenarios. |
| All 3 mode_fit ids | **KEEP** | Unused in this calm scenario by design; a hot-take/satire fixture exercises them. |
| Both routing ids | **KEEP** | Unused here (the dispute stays on mainline); branch/tangent scenarios exercise them. **See split note below — `introduces_sub_axis` is added rather than overloading `suggests_side_branch`.** |
| Both friction ids | **KEEP** | Composer-only Observations; doctrine-load-bearing. |

**No renames.** Every existing id-string is stable. Renaming would be a contract touch
(`SemanticClassifierId` union member change) and would invalidate the cache-key hashes and the
parity mirrors for no design benefit.

**No retirements.** The 14 ids unused by the band-space-rent scenario stay; the scenario is
deliberately narrow (calm two-party evidence dispute) and a future fixture exercises the satire /
popularity / person-shift / hot-take / side-branch ids (the fixture's `currentCatalogCoverage`
documents this as intentional negative coverage).

**No merges of existing ids into each other.** The one *near*-merge the scenario forces is a **split,
documented as a new id, not a merge:** `introduces_sub_axis` is added rather than overloading the
existing `introduces_new_issue`. The two are deliberately distinct: `introduces_new_issue` signals a
wholly new debatable issue (a side-branch candidate, routes off mainline); `introduces_sub_axis`
signals a finer dispute that **stays on the same mainline**. Collapsing them would lose the routing
distinction the composition layer needs (mainline vs branch). This is recorded here as a **conceptual
split of the "introduces…" space into two ids**, with `introduces_new_issue` unchanged.

> The 12 new ids in §A3 are *additions*, not renames/merges/splits of existing ids (except the
> `introduces_new_issue` → `introduces_sub_axis` conceptual split noted above). Summary counts:
> **23 existing ids: 23 KEEP, 0 rename, 0 merge, 0 retire; 1 conceptual split (adds 1 new id).**

---

## A3. Finalized list of NEW classifier ids (criterion 3)

**Catalog v1 adds 14 new ids** (12 scenario-derived + 2 settlement). Each is a binary text-feature
detector; none emits prose. The banner code / ledger code / family columns are taken from the realized
source-of-truth constant (`src/lib/constitution/semanticClassifierCatalog.ts`) so the proposal and the
implementation agree. Plain-language labels below are **candidate** labels for the downstream registry
(`gameCopy.toPlainLanguage` / the Observation registry) — they are NOT model output and are subject to
the ban-list (§A4).

> **Count note.** The research doc §5 surfaced **12** candidate ids. Two of those 12
> (`disputes_specific_amount`, `cites_temporal_boundary`) were **merged away** at implementation (see
> §G Q1); and two settlement ids (`proposes_settlement_terms`, `accepts_settlement_terms`) were
> **added** beyond the research doc's list, derived from the fixture's `expectedSettlement` section.
> Net realized additions: **14**. This proposal ratifies the realized 14 (see §I open question 1 for
> the GATE-A decision on whether to revisit the two merged-away ids).

### Group 1 — evidence-family additions (5 ids)

| New id (snake_case) | Binary signal | Family | Banner code (candidate) | Ledger code | Plain-language label (candidate) | Depends-on (non-MCP work) | Example move |
|---|---|---|---|---|---|---|---|
| `disputes_evidence_applicability` | Move challenges what an attached evidence object COVERS, not whether it exists | evidence | `evidence_debt_applicability_disputed` | `—` | "Disputes what the evidence covers" | QOL-037 (evidence applicability flow) | m3 |
| `opens_evidence_debt_marker` | Move opens a structured, tracked Ask-for-source request (distinct from a rhetorical ask) | evidence | `evidence_debt_marker_opened` | `—` | "Opened a tracked source request" | QOL-037; EV-003 (debt tracker underlying state) | m5 |
| `closes_evidence_debt_marker` | Move responds to an open evidence-debt marker with the requested source | evidence | `evidence_debt_marker_closed` | `—` | "Answered the source request" | QOL-037; EV-003 | m6 |
| `supplies_corroborating_document` | Move attaches a document that corroborates a prior timeline claim rather than introducing new primary evidence | evidence | `evidence_debt_corroborating_document` | `—` | "Added corroborating document" | QOL-036 (evidence object fields); QOL-037 | m6, m8 |
| `references_prior_agreement` | Move cites a prior agreement between participants bearing on the dispute | **movement** | `synthesis_prior_agreement_cited` | `—` | "Cited a prior agreement" | none (text-only; ships with catalog) | m3 |

> Note `references_prior_agreement` is assigned to **movement**, not evidence, in the realized
> constant — it is a constructive-context signal, not an evidence-hygiene signal. Documented so the
> family assignment is intentional, not an oversight.

### Group 2 — movement-family additions (qualified concession + structural) (5 ids)

| New id (snake_case) | Binary signal | Family | Banner code (candidate) | Ledger code | Plain-language label (candidate) | Depends-on | Example move |
|---|---|---|---|---|---|---|---|
| `provides_temporal_constraint` | Move cites a specific date/timeline/temporal boundary constraining the dispute | movement | `synthesis_temporal_anchor_added` | `—` | "Added a date/timeline anchor" | none (text-only) | m3, m8 |
| `accepts_partial_with_caveat` | Move accepts a specific point while qualifying/restricting the acceptance | movement | `synthesis_qualified_concession_with_caveat` | `—` | "Agreed with a caveat" | none (UI: structured "Agree with caveat" choice is QOL-037, but the signal ships text-only) | m4 |
| `provides_alternate_interpretation` | Move offers an alternate reading of an existing artifact the parent treated as fixed | movement | `synthesis_alternate_interpretation_offered` | `—` | "Offered an alternate reading" | none (text-only) | m4 |
| `introduces_sub_axis` | Move opens a new, more specific sub-dispute on the SAME mainline (not a side branch) | movement | `synthesis_sub_axis_introduced` | `—` | "Opened a sub-point on the same thread" | none (BR-003/BR-004 for per-branch labels, but the signal ships text-only) | m7 |
| `concedes_with_new_dispute` | Move pairs a concession on one axis with a new dispute on a different axis | movement | `synthesis_concession_with_new_dispute` | `—` | "Conceded one point, opened another" | none (text-only) | m7 |

### Group 3 — settlement additions (2 ids; beyond the research doc's 12)

| New id (snake_case) | Binary signal | Family | Banner code (candidate) | Ledger code | Plain-language label (candidate) | Depends-on | Example move |
|---|---|---|---|---|---|---|---|
| `proposes_settlement_terms` | Move proposes a settlement summary or resolution terms the other participant could accept | movement | `synthesis_settlement_proposed` | `—` | "Proposed terms to settle" | Settlement state model (exists per fixture §expectedSettlement) | (post-m8 settlement move) |
| `accepts_settlement_terms` | Move accepts a proposed settlement summary or resolution terms | movement | `synthesis_settlement_accepted` | `—` | "Accepted the settlement terms" | Settlement state model | (post-m8 confirm move) |

> **Doctrine guard on settlement ids (binding).** Settlement is a **structural state** — the move
> *proposes/accepts resolution TERMS* — never a verdict that a party was right or that a claim is true.
> The fixture's `expectedSettlement` section is explicit: permitted language is *settled / resolved /
> evidence accepted / applicability accepted / evidence-debt resolved / sub-dispute closed*; forbidden
> language is *proven / true / false / winner / loser / case closed / right / wrong / correct /
> incorrect / victory / defeated*. The candidate banner codes (`synthesis_settlement_proposed`,
> `synthesis_settlement_accepted`) and plain-language labels above carry no forbidden token. The
> `settlement` reasonCode family prefix was added to the whitelist (see §A4) to carry these without
> tripping the family-prefix check.

**Depends-on summary.** Of the 14 new ids, **7 can ship the moment the catalog lands** (text-only
detectors: `references_prior_agreement`, `provides_temporal_constraint`, `accepts_partial_with_caveat`,
`provides_alternate_interpretation`, `introduces_sub_axis`, `concedes_with_new_dispute`, and — given an
existing settlement state — the two settlement ids). **4 depend on QOL-037's evidence applicability /
evidence-debt UI** to be *usefully* surfaced (`disputes_evidence_applicability`,
`opens_evidence_debt_marker`, `closes_evidence_debt_marker`, `supplies_corroborating_document`) and
some also touch **QOL-036** (payment-evidence object fields). The model can *detect* all 14 from text
today; the UI affordances that make 4 of them actionable are the gated dependency, per research doc §11.

---

## A4. reasonCode safety rules (criterion 4)

The `reasonCode` is the one free-form string the model returns. It is the highest-risk field for a
doctrine violation, because a plausible classifier reason like `false_premise` or `true_to_topic`
carries a banned token. The smoke-test failure investigation (research doc §1, §8) confirmed this is a
live failure surface. The safety discipline is therefore **three layered checks**, all on the
**OUTBOUND** packet (the model's output), not the inbound request.

### Where the check lands (binding)

**File:** `src/features/semanticReferee/semanticRefereeValidator.ts` (with a byte-identical Deno mirror
under `supabase/functions/_shared/semanticReferee/`). **Function:** `validateBinary(...)` — for each
element of `binaries`, after structural field validation, the `reasonCode` is checked in two stages:

1. `validateReasonCode(value, field)` — the **structural + family-prefix whitelist** stage.
2. `scanStringContent(value)` — the **token ban-list** stage (verdict tokens, person-label tokens,
   person-label phrases, plus secret-shape / PII-shape).

This is the correct placement per research doc §8: "The check belongs in the OUTBOUND schema (the
packet validator), not the INBOUND request schema — it's a property of the model's output, not the
caller's input." It is reached on every binary of every packet before the packet can be surfaced.

### Rule 1 — verdict-token ban-list

A `reasonCode` whose lowercase snake_case **segments** contain any of the following is rejected
`verdict_token`:

```
winner, loser, won, lost, right, wrong, true, false, correct, incorrect, proven, defeated
```

(Matched by segment, not substring, so `evidence_false_premise` → segment `false` → reject;
`evidence_applicability_disputed` → no banned segment → pass.)

### Rule 2 — person-label ban-list

Rejected `person_label` if any segment is one of:

```
liar, lying, dishonest, manipulative, troll, propagandist, extremist, stupid, idiot, dumb, smart
```

Plus a **phrase** check (after whitespace collapse) for the multi-word label:

```
bad faith
```

### Rule 3 — family-prefix whitelist regex

A `reasonCode` is accepted only if it is a lowercase snake_case token AND begins with a known family
prefix. The structural shape check is:

```
/^[a-z0-9]+(?:_[a-z0-9]+)*$/        // lowercase snake_case, no leading/trailing/double underscore
```

…and the family check requires the value to equal a family or start with `<family>_`, where the
whitelisted families are (from `REASON_CODE_FAMILIES` in `semanticRefereeTypes.ts`):

```
parent_continuity | branch_routing | evidence | source_chain | movement | mode_fit | friction | banner | settlement
```

Equivalent single-regex form (for the implementer / for a ban-list test):

```
/^(parent_continuity|branch_routing|evidence|source_chain|movement|mode_fit|friction|banner|settlement)_[a-z0-9_]+$/
```

> **Divergence from research doc, flagged (finding).** The research doc §8 proposed an **8-family**
> regex (no `settlement`). The realized implementation adds **`settlement`** as a ninth family prefix
> to carry the two settlement reasonCodes. This is consistent with the doctrine posture (settlement is
> a structural state, not a verdict) and is documented in the `REASON_CODE_FAMILIES` comment. The
> proposal **ratifies** the 9-family whitelist. Any GATE-A reconsideration that drops the settlement
> ids must also drop the `settlement` prefix.

### Example safe vs unsafe reasonCodes

Safe (pass all three rules): `evidence_applicability_disputed`, `evidence_debt_marker_opened`,
`evidence_debt_marker_closed`, `movement_concession_with_caveat`, `movement_sub_axis_introduced`,
`parent_continuity_quote_anchored`, `source_chain_corroboration_supplied`,
`settlement_terms_proposed`.

Unsafe (each rejected, code in parentheses): `evidence_false_premise` (`verdict_token`),
`evidence_true_anchor` (`verdict_token`), `movement_correct_concession` (`verdict_token`),
`parent_continuity_wrong_anchor` (`verdict_token`), `movement_winner_takes_axis` (`verdict_token`),
`movement_liar_detected` (`person_label`), `xyz_unfamiliar_family` (`unknown_reason_code` — no family
prefix).

> **Defense in depth.** The same `scanStringContent` ban-list also guards `evidenceSpan` / `parentSpan`
> (bounded input substrings) and is paired with secret-shape (`secret_shape`) and PII-shape
> (`pii_shape`) scanners that mirror the engagement-intelligence sanitizer. The rejection-code names
> (`verdict_token`, `person_label`) are validator internals, NOT user-facing strings — a documented
> expected false positive for the repo-wide ban-list test (the validator's own comment notes this).

---

## A5. Full-thread context design (criterion 5)

When classification fires (from each participant's **second** move onward — see §A6 / the trigger
gate), the request carries the **full thread** as context, each prior body redacted and labeled with a
stable, non-identifying alias. The realized design lives in
`src/features/semanticReferee/threadContext.ts` (helpers `buildAuthorAliasMap`,
`assemblePriorMovesPayload`, `aliasForIndex`) and `src/features/semanticReferee/tokenBudget.ts`. This
section is the design of record; the proposal does not change those helpers.

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

### Author-alias map

Aliases are derived **deterministically from chronological order of distinct authors**: the N-th
distinct author maps to the N-th alias in `A, B, C, … Z, AA, AB, …` (`aliasForIndex(index)`:
`0 → 'A'`, `25 → 'Z'`, `26 → 'AA'`). `A` is always the originator, `B` the first respondent, `C` the
first chime-in. `buildAuthorAliasMap` optionally folds the current move's author in so the
just-posted move's author has an alias too. **The map is computed per classify call from room state
and is never persisted.**

### Redaction rules

Every body (prior and current) runs through the existing redactor — the client-side first pass
`src/features/semanticReferee/clientRedaction.ts` (`redactBody`), backstopped by the Edge-side
`supabase/functions/_shared/semanticReferee/redaction.ts`. The same rules apply to every prior-move
body that already apply to the current move: email shapes, URL shapes (incl. x.com / twitter.com /
t.co), X-family @handles (1–15 chars), secret-shape prefixes, Bearer tokens, long digit runs,
payment-account-shaped digits. Only the **placeholder** crosses the boundary, never the redacted span
content.

### Token-budget handling

`tokenBudget.ts` sets a conservative, tokenizer-free estimate: `SEMANTIC_PACKET_TOKEN_BUDGET = 1500`,
`OUTPUT_TOKEN_RESERVE = 450`, `CHARS_PER_TOKEN = 3.5`, plus per-classifier-id and per-prior-move
scaffold overheads. `assemblePriorMovesPayload` counts prior-move bytes alongside move + parent. When
the full thread overflows:

1. **Drop the OLDEST prior moves first (FIFO).**
2. If still over budget after dropping all prior moves, **fall back to the pre-refactor payload shape
   (current + parent only).** The hook does **not** skip the call — it **gracefully degrades**.
   (`assemblePriorMovesPayload` returns `[]` when even move + parent alone overflow.)

### Doctrine constraints on what may be sent (binding)

- **Never** raw author names, emails, handles, user ids, or any PII — only the chronological alias.
- **Never** the redaction reveals — only the placeholder.
- **Never** the room id / user id / move id as model-reasoning content (move ids appear only as
  structural references in the alias/parent map; the model's output does not carry them back).
- **Never** prior-classifier outputs (prior packets) — sending them would create **feedback
  amplification** (the model classifying its own prior judgments). The model classifies the move's
  *text*, not prior AI judgments.
- **Always** the alias map and the parent chain — the model needs who-said-what to judge continuity.
- The system prompt **forbids person-labeling regardless**; aliases are belt-and-suspenders, not the
  only guard (`cdiscourse-doctrine` §4).

---

## A6. Deterministic composition patterns (criterion 6)

The model returns binary signals; **all** natural-language output (banner, sidecar, timeline label,
settlement summary affordance) is produced by deterministic composition rules over the binary vector.
The realized composition layer is `src/features/semanticReferee/compositionLayer.ts` /
`compositionTypes.ts`; this section is the pattern catalog of record, drawn from and extending the
fixture's `compositionRules` section.

Each rule is `inputPattern (binary vector) → {banner, sidecar, evidence-panel transition, evidence-debt
transition, route suggestion, friction suggestion, settlement readiness}`. The eight representative
rules:

| Rule id | Input pattern (binaries = 1) | Output banner | Output sidecar / state |
|---|---|---|---|
| `root_proclamation_exemption` | `isRoot` | `null` (no banner) | sidecar "Opening claim — no prior context to engage."; **no classifier call fired** |
| `first_move_per_participant_exemption` | `isFirstMoveByThisAuthor` | `null` | sidecar "Author's first move — exempt from classification"; **no classifier call fired** |
| `applicability_dispute_with_prior_agreement_and_temporal_anchor` | `disputes_evidence_applicability`, `references_prior_agreement`, `provides_temporal_constraint` | "Applicability disputed — prior agreement cited" | evidence panel: `attached_unchallenged → applicability_disputed`; route `mainline`; friction `none` |
| `qualified_concession_with_alternate_interpretation` | `concedes_narrow_point`, `accepts_partial_with_caveat`, `provides_alternate_interpretation` | "Agreed with caveat — alternate interpretation offered" | friction `ask_for_source` (the alternate reading invites corroboration) |
| `explicit_source_request_opens_debt_marker` | `asks_for_evidence`, `opens_evidence_debt_marker` | "Source requested" | evidence-debt: `new_debt_marker_opened`; room status line "Evidence requested"; friction `ask_for_source` |
| `source_supplied_closes_debt_and_strengthens_prior_evidence` | `provides_evidence`, `evidence_supports_claim`, `closes_evidence_debt_marker`, `supplies_corroborating_document` | "Source supplied — debt resolved" | prior evidence `applicability_disputed → applicability_supported`; new evidence `attached_supporting`; debt `resolved`; friction `none` |
| `concede_and_open_sub_axis_on_same_mainline` | `concedes_narrow_point`, `narrows_claim`, `introduces_sub_axis`, `concedes_with_new_dispute` | "Conceded; new sub-dispute opened" | route `mainline` (a side branch would fragment the resolution); friction `ask_for_source` |
| `evidence_backed_sub_axis_resolution_ready_for_synthesis` | `provides_evidence`, `evidence_supports_claim`, `ready_for_synthesis` (+ amount/temporal signals where present) | "Sub-dispute evidence supplied; ready for synthesis" | settlement readiness `room_ready_for_settlement_pending_acceptance`; friction `none` |

### Extension rule proposed by this design (settlement close)

Drawn from the fixture's `expectedSettlement` (the move beyond m8) and the two new settlement ids, a
ninth rule completes the arc:

| Rule id (proposed) | Input pattern | Output banner | Output state |
|---|---|---|---|
| `settlement_terms_accepted_locks_room` | `accepts_settlement_terms` (preceded by `proposes_settlement_terms` on the prior move) | "Settled — evidence accepted" | room → `settled_and_locked_private`; evidence ev1 → `applicability_accepted`, ev3 → `attached_accepted` |

> **Doctrine guard (binding):** the banner reads "Settled", never "Proven" / "Case closed" / "Winner".
> The settlement summary is **user-written**; the system never authors a truth claim. This matches the
> fixture's `permittedSettlementLanguage` / `forbiddenSettlementLanguage` lists exactly.

### Why composition, not model interpretation (three load-bearing reasons)

1. **Doctrine safety.** The model cannot smuggle a verdict, truth claim, or person label if its only
   output surface is `{0, 1}` + a ban-list-scanned reasonCode. The composition layer is auditable code.
2. **Determinism.** The same binary vector always yields the same banner/sidecar — good for caching
   (`semanticCache.ts`), testing, user trust, and operator review.
3. **Cost.** Bounded outputs let the smallest model in the family classify reliably. Asking the model
   to *write* a banner would require a larger model for the same safety guarantees.

The richness comes from the **combinatorial space** of binary vectors: with 35 ids, the composition
layer recognizes a large set of specific patterns and can add rules without changing the model
contract. New patterns are deterministic-layer additions, not model retrains.

---

## A7. Resolution of the 6 open questions (criterion 7)

The research doc §14 leaves 6 questions for MCP-CAT-001's design phase. Each is resolved below with a
decision, a rationale, and **how the realized implementation actually resolved it** (since the
implementation has landed). Where the implementation and the recommended decision agree, the proposal
ratifies; where they diverge, the divergence is flagged for GATE-A.

### Q1 — Do `provides_temporal_constraint` and `cites_temporal_boundary` merge?

**Decision: MERGE — keep only `provides_temporal_constraint`; do not add `cites_temporal_boundary`.**
Rationale: a boundary ("rent rose in April") is a special case of a temporal constraint ("a date that
constrains the dispute"). The model returns the same binary for both shapes; the *boundary vs point*
distinction, if ever needed, belongs in the `reasonCode` suffix
(`movement_temporal_boundary` vs `movement_temporal_point`), not in a second id. A second id doubles
the prompt cost for a sub-distinction the composition layer rarely needs.
**Realized: MERGED — `cites_temporal_boundary` is absent from the 35-id catalog; m8's boundary is
covered by `provides_temporal_constraint`.** Proposal ratifies. *(Consequence: the fixture's m8
`expectedClassifierSignal` still references `cites_temporal_boundary` and `disputes_specific_amount` —
those fixture lines are now stale relative to the shipped catalog; see §H risk + §I open question 2.)*

### Q2 — Does `accepts_partial_with_caveat` merge with `concedes_narrow_point`?

**Decision: DO NOT MERGE — keep both as distinct ids.** Rationale: `concedes_narrow_point` is "accept
the narrow point and stop"; `accepts_partial_with_caveat` is "accept the specific point **but** restrict
the acceptance / keep fighting the broader frame." The fixture's m4 fires **both** (B concedes the
March-10 due date AND qualifies with the early-payment caveat), which is only expressible if they are
two ids feeding one composition rule (`qualified_concession_with_alternate_interpretation`). Merging
would collapse a composable distinction.
**Realized: KEPT SEPARATE — both ids are in the catalog, both family `movement`.** Proposal ratifies.

### Q3 — Is `concedes_with_new_dispute` a classifier id or a composition-rule output?

**Decision (this proposal's recommendation): COMPOSITION RULE preferred, but ID is acceptable.** The
research doc §5 recommends a composition rule (the model already detects `concedes_narrow_point` +
`introduces_sub_axis` independently, so the paired banner can fire from those two binaries without a
third id). **Realized: implemented as an ID** (`concedes_with_new_dispute` is in the catalog).
**Divergence, flagged.** The realized choice is defensible — a dedicated binary lets the model assert
the *pairing is intentional in this single move* (concede + open in one breath), which two independent
binaries on two moves cannot capture as cleanly, and it gives the composition rule a precise trigger.
The cost is one extra prompt id and a redundancy with the two-binary path. **Proposal ratifies the ID
but records this as the one new-id decision GATE-A is most likely to want to revisit** (see §I). If
GATE-A prefers the composition-rule path, retiring this single id is low-risk (it is purely additive
and not yet depended on by any UI).

### Q4 — Should `provides_structured_evidence_object` be a layer-1 metadata signal, not an AI id?

**Decision: LAYER-1 METADATA — do NOT add it to the AI catalog.** Rationale: "is there an evidence
object attached to this move?" is a **structural fact** readable from `evidenceAttached[]`, not an AI
judgment. Routing it through the model would waste budget and invite the model to opine on a
deterministic fact. **Realized: NOT added — `provides_structured_evidence_object` is absent from the
catalog; the layer-1 deterministic surface reads `evidenceAttached[]` directly** (the fixture's m2
demonstrates this: evidence pill renders with `noClassifierCallFired: true`). Proposal ratifies.

### Q5 — Should the catalog grow by 8–12 new ids in one revision, or in multiple smaller revisions?

**Decision: ONE REVISION.** Rationale: the 12 (→14) ids are a coherent scenario-derived set; splitting
them across revisions would mean the composition rules (which combine new ids — e.g.
`source_supplied_closes_debt_and_strengthens_prior_evidence` needs both `closes_evidence_debt_marker`
and `supplies_corroborating_document`) would land half-wired across two revisions, leaving the
intermediate state with rules referencing absent ids. The cache-key version bump and the parity-mirror
update are one-time costs better paid once. **Realized: ONE REVISION — commit `78e9056` added all 12
(and the 2 settlement ids) in a single 23 → 35 extension.** Proposal ratifies.

### Q6 — Maximum batch size in the post-revision world?

**Decision: KEEP `BATCH_CAP = 5`; partition the 35 ids into logical groups; target ≤ 2 batches per
trigger.** Rationale: the research doc worried 12 new ids might force 3 batches. Keeping the per-call
cap at 5 (the proven safe size) and partitioning by *logical group* rather than raising the cap keeps
each provider call small and cacheable. **Realized: `BATCH_CAP = 5` UNCHANGED; the 35 ids are
partitioned into 8 groups `A–H` (`SEMANTIC_BATCH_GROUPS` in `classifierBatching.ts`), and
`EXPECTED_MAX_BATCHES_PER_TRIGGER = 2`.** Proposal ratifies. The partition property (each group ≤ 5,
relevant ids for a given move land in ≤ 2 groups) is enforced by the batching module's tests.

**Summary of the 6 resolutions:** Q1 merge · Q2 keep-separate · Q3 id (ratified, flagged) · Q4
layer-1 metadata · Q5 single revision · Q6 BATCH_CAP=5 / 8 groups / ≤2 batches. **Five match the
research doc's recommendation; one (Q3) diverges and is flagged.**

---

## Edge cases (for the eventual implementation card)

- **Empty thread / root move.** No classifier call fires (`root_proclamation_exemption`); layer-1
  renders the opening-claim surface. Covered.
- **First move by a participant (incl. chime-in's first contribution).** Exempt
  (`first_move_per_participant_exemption` / `chimeInExemption`); continuity/movement signals would be 0
  by definition. The eligibility rule is **participant-scoped**, applied uniformly to primary and
  chime-in authors (research doc §10).
- **Participant rejoins after long absence.** Their next move is their (2+N)-th; the move-position
  helper returns `'later'`; classification fires normally. No special case.
- **Thread exceeds token budget.** FIFO-drop oldest prior moves; if still over, degrade to move +
  parent only; never skip the call.
- **reasonCode carries a banned token.** Rejected at `validateBinary` (`verdict_token` /
  `person_label`); the packet does not surface. The composition layer treats a rejected packet as
  "no signal," not as a block (score never blocks posting — `cdiscourse-doctrine` §1).
- **New id fires but its UI dependency is absent** (e.g. `disputes_evidence_applicability` before
  QOL-037). The binary still computes; the composition rule that needs the applicability-panel
  transition degrades to the banner/sidecar only (no panel mutation). The implementation card must
  guard panel-transition outputs behind a capability check, not assume QOL-037 is present.
- **Concurrent edits / re-classification.** The cache key (`semanticRefereeCacheKey.ts`) is content-
  addressed; a re-classify with the same content+catalog version hits cache deterministically. A
  catalog version bump (35 → future N) invalidates the cache, as intended.
- **Permission-denied / observer-moderator actor.** `triggerGates.ts` `isNonParticipantRole` refuses
  classification for observer/moderator roles, layered below the move-position gate. Unchanged.
- **Settlement banner doctrine.** A settlement banner must never read "proven"/"won"; the composition
  rule and the banner-library entries for `synthesis_settlement_*` are ban-list-scanned.

---

## Test plan (for the eventual implementation card)

> This card writes no code, so it writes no tests. The plan below is what the **implementation**
> follow-up must deliver (`test-discipline`: tests are part of "done"). Because the implementation has
> *already landed*, this doubles as the **audit checklist** GATE-A's reviewer should run against the
> existing suite to confirm coverage exists.

- **Catalog parity** — `__tests__/semanticClassifierCatalogParity.test.ts`: every catalog entry id is a
  member of `ALL_SEMANTIC_CLASSIFIER_IDS`; the catalog declares in the same order; `bannerCode ===
  bannerCodePriorityList[0]` for non-silent ids; `bannerCode === null ↔ bannerCodePriorityList === []`;
  every `ledgerCategories` value is in `ALL_REFEREE_POINT_CATEGORIES`; Node↔Deno catalog mirrors are
  byte-identical.
- **reasonCode ban-list (doctrine)** — assert every catalog `bannerCode`, `structuralQuestion`,
  `binarySignal`, and `plainLanguageLabel` is free of verdict tokens (`winner/loser/true/false/correct/
  …`) and person-label tokens (`liar/dishonest/bad faith/…`). Assert the validator **rejects**
  `evidence_false_premise`, `movement_winner_takes_axis`, `movement_liar_detected` and **accepts**
  `evidence_applicability_disputed`, `settlement_terms_proposed`. (Mirror
  `semanticAnthropicSeedPromptBanList.test.ts`.)
- **Family-prefix whitelist** — assert `validateReasonCode` accepts each of the 9 family prefixes and
  rejects an unknown prefix (`unknown_reason_code`); assert snake_case shape enforcement (rejects
  `Evidence_X`, `evidence__x`, `_evidence_x`).
- **Composition determinism** — for each rule in §A6, feed the exact binary vector and assert the
  exact banner / sidecar / panel-transition / route / friction output; assert the same vector twice
  yields identical output (no nondeterminism); assert an unmatched vector yields the safe default (no
  banner), never a verdict.
- **Plain-language coverage** — assert `toPlainLanguage(id)` returns a non-empty, snake_case-free
  string for **all 35 ids** (the new 14 included); assert no raw id leaks to a UI string (Observation
  registry coverage per `cdiscourse-doctrine` §9, §10a).
- **Full-thread context** — assert `buildAuthorAliasMap` is chronological/stable (`A`=originator);
  assert `aliasForIndex(25)='Z'`, `aliasForIndex(26)='AA'`; assert `assemblePriorMovesPayload` redacts
  every prior body (email/URL/handle/secret); assert FIFO drop order; assert degradation to
  move+parent on overflow and `[]` when move+parent alone overflow; assert **no PII and no prior
  packet** crosses the boundary.
- **Batching** — assert no emitted batch exceeds `BATCH_CAP=5`; assert the 35 ids partition into the 8
  groups with no id dropped/duplicated; assert `≤ EXPECTED_MAX_BATCHES_PER_TRIGGER` for a
  representative move.
- **Settlement doctrine** — assert the settlement banner/sidecar strings are a subset of the fixture's
  `permittedSettlementLanguage` and disjoint from `forbiddenSettlementLanguage`.
- **Eligibility** — assert root + first-move-per-participant + chime-in-first exemptions skip the call;
  assert the second move fires.

---

## Dependencies (cards / docs / files)

- **Reads** `src/features/semanticReferee/semanticRefereeTypes.ts` (`SemanticClassifierId`,
  `ALL_SEMANTIC_CLASSIFIER_IDS`, `REASON_CODE_FAMILIES`) — the canonical id union + family prefixes.
- **Reads** `src/lib/constitution/semanticClassifierCatalog.ts` (`SEMANTIC_CLASSIFIER_CATALOG`) — the
  MCP-MOD-004 source-of-truth per-id metadata table this proposal's §A1/§A3 are keyed to.
- **Reads** `src/features/semanticReferee/semanticRefereeValidator.ts` (`validateBinary`,
  `validateReasonCode`, `scanStringContent`, `VERDICT_TOKENS`, `PERSON_LABEL_TOKENS`) — where §A4
  lands.
- **Reads** `src/features/semanticReferee/threadContext.ts` + `tokenBudget.ts` +
  `classifierBatching.ts` — §A5 / §A6 / Q6 design of record.
- **Cross-references (does not duplicate)** `docs/architecture/semantic-referee-classifier-catalog.md`
  (MCP-MOD-002 inventory, §F extension) and `docs/architecture/semantic-referee-prompt-template.md`.
- **Assumes MCP-MOD-004 (#233) is complete** because the proposal targets `SEMANTIC_CLASSIFIER_CATALOG`'s
  `SemanticClassifierCatalogEntry` shape — and it is complete (the constant exists and carries all 35
  entries).
- **Depends on (for usefulness, not for the catalog to land)**: QOL-037 (evidence applicability /
  evidence-debt UI) for 4 of the new ids; QOL-036 (payment-evidence object fields); a settlement state
  model (exists per fixture) for the 2 settlement ids. Per research doc §11, the model can *detect*
  all 14 from text today; these are the *surfacing* dependencies.
- **Blocks**: nothing further — the implementation it was meant to gate has already landed (the
  inversion in the Status header). Its remaining downstream value is the GATE-A ratification record.

---

## Risks

- **PRIMARY: design/implementation inversion.** The implementation landed before this design card and
  its GATE-A review. Risk: a shipped decision (e.g. Q3 `concedes_with_new_dispute` as an id, or the 2
  settlement ids) may not survive GATE-A scrutiny, but is already in production code, cache keys, and
  parity mirrors. Mitigation: §I open question 1 asks the operator to declare GATE-A a *ratification*
  or a *reconsideration*; §A2/§A3/§A7 flag every divergence so reconsideration is targeted, not
  wholesale.
- **Stale fixture lines.** The fixture `catalog-design-band-space-rent-evidence.json` still lists
  `cites_temporal_boundary` and `disputes_specific_amount` in m8's `expectedClassifierSignal` and in
  `proposedClassifierNeeds`. Those two ids were merged away / not added. A reader who treats the
  fixture as current will expect ids that do not exist in the 35-id catalog. Mitigation: §I open
  question 2 recommends a fixture-reconciliation follow-up (out of scope for this design-only card —
  the brief forbids fixture edits).
- **`settlement` family prefix not in the research doc.** The realized whitelist has 9 families; the
  research doc proposed 8. A reviewer cross-checking the regex against the research doc will see a
  mismatch. Mitigation: flagged in §A4 as a ratified divergence.
- **UI-dependent ids firing into absent affordances.** If the 4 QOL-037-dependent ids fire before
  QOL-037 ships, their composition rules must degrade to banner/sidecar only. Mitigation: edge-case
  list + test plan require a capability guard on panel-transition outputs.
- **Ban-list drift.** New banner codes or plain-language labels added later could slip a banned token
  past review. Mitigation: the ban-list test must scan the catalog constant's strings, not just
  rendered UI (the test plan requires this).

---

## Out of scope

- Implementing any new classifier id in code (already landed; this card does not re-touch it).
- Modifying `semanticRefereeTypes.ts`, `semanticClassifierCatalog.ts`, the validator, the prompt
  template, the banner library, the ledger, the batching module, or any fixture.
- Filing or implementing QOL-036 (payment metadata) / QOL-037 (applicability flow) — named as
  depends-on, not owned here.
- A new fixture exercising the 14 ids the band-space-rent scenario does not (satire / popularity /
  person-shift / hot-take / side-branch) — recommended as a follow-up, not part of this card.
- Reconciling the stale fixture lines (§I Q2) — a follow-up, since this card may not edit fixtures.
- Any change to the trigger-gate behavior, eligibility curve, or move-position helper (MCP-MOD-007/008
  territory; documented here for context only).

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks).** Every one of the 14 new ids is a
  text-feature detector. No id, banner code, ledger code, or candidate plain-language label is a
  verdict (winner/loser/true/false/correct/proven) or a person label. The settlement ids describe a
  structural state (proposing/accepting TERMS), guarded by the fixture's
  permitted/forbidden-language lists. A rejected packet (banned reasonCode) yields "no signal," never a
  block — score/advisory output never blocks posting. ✔
- **cdiscourse-doctrine §3 (popularity is not evidence).** The 3 anti-amplification ids
  (`uses_popularity_as_evidence`, `uses_satire_as_evidence`, `cites_retraction`) are KEEP/unchanged;
  the new evidence ids distinguish *applicability* and *corroboration* — neither grants factual
  standing from popularity. ✔
- **cdiscourse-doctrine §4 (AI moderator limits).** The model returns 0/1 only; it never decides who is
  right, never assigns truth, never blocks; `authoritative` is the literal `false` by type. AI runs in
  the Edge Function, not the client (the proposal does not move it). ✔
- **cdiscourse-doctrine §9 (plain language).** Every new id must map through the Observation registry /
  `gameCopy.toPlainLanguage`; raw ids never reach UI (test-plan coverage required for all 35). ✔
- **cdiscourse-doctrine §10a (Observations vs Allegations).** All 14 new ids are machine-generated →
  **Observations**, never Allegations. The two friction Observations
  (`shifts_to_person_or_intent`, `contains_unplayable_insult_only`) render composer-only, never on the
  target's node. ✔
- **Binary-return architectural constraint.** No proposal introduces a free-text or multi-valued
  classifier output. Richness = deterministic composition over binary vectors. ✔
- **Rules engine sacred / secrets policy.** The catalog constant and validator are pure TypeScript,
  no network/React imports; no secret literal appears (secret-shape patterns are assembled from
  fragments). No service-role usage. ✔

---

## Operator steps (if any)

**None — pure design document.** No migration, no Edge Function deploy, no env var. (The catalog
*implementation* already shipped via PR #252 and the Supabase merge auto-deploy; no further operator
action is created by *this* design doc.)

The one operator *decision* this doc requests is **GATE-A review** of the §I open questions — in
particular whether GATE-A ratifies the shipped catalog v1 or reconsiders the flagged divergences
(Q3 id-vs-rule; the 2 settlement ids; the 9th `settlement` family prefix). That is a review action, not
a deploy action.

---

## I. Open questions / sequencing (for operator GATE-A)

Implementation is deferred per the card framing; this doc is the proposal for GATE-A. The open items:

1. **Ratify or reconsider? (the inversion.)** The catalog v1 implementation has already landed
   (commit `78e9056`, PR #252) while this design card / GATE-A was still pending. **Decision needed:**
   is GATE-A a *ratification* (the shipped 35-id catalog stands; this doc is the record) or a
   *reconsideration* (revisit the flagged divergences below before the catalog is considered final)?
   This proposal is authored to support either, and recommends **ratification** — the shipped design is
   doctrine-clean and the divergences are defensible — with the two narrow reconsideration candidates
   in items 2–3.
2. **Reconsideration candidate A — Q3 `concedes_with_new_dispute` as id vs composition rule.** The
   research doc recommended a composition rule; the implementation shipped an id. Both are
   doctrine-clean. If GATE-A prefers the rule, retiring this single additive id is low-risk. *(This
   proposal ratifies the id.)*
3. **Reconsideration candidate B — the 2 settlement ids + the `settlement` family prefix.** These were
   added beyond the research doc's 12 candidates, derived from the fixture's `expectedSettlement`. They
   are doctrine-guarded but represent a scope expansion the research doc did not pre-authorize.
   *(This proposal ratifies them.)*
4. **Stale fixture reconciliation (follow-up, not this card).** The fixture still references
   `cites_temporal_boundary` and `disputes_specific_amount` (merged away). Recommend a small
   follow-up to update m8's `expectedClassifierSignal` and `proposedClassifierNeeds` to the realized
   12+2. This card may not edit fixtures (boundary), so it is filed as a recommendation.
5. **New-id coverage fixture (follow-up).** The band-space-rent scenario exercises evidence/concession
   ids but none of the satire/popularity/hot-take/branch ids. Recommend a second design fixture so the
   full 35-id catalog has positive-coverage exhibits.

### Sequencing (recorded for completeness)

`research doc (2026-05-23) → [MCP-MOD-001..008 modularity slate] → MCP-MOD-004 source-of-truth →
MCP-CAT-001 design (this doc, GATE-A) → catalog implementation`. The intended order placed this design
+ GATE-A **before** implementation; in practice the implementation (PR #252) landed first. The
modularity slate (#230–#237), MCP-MOD-004 (#233), and the catalog implementation are all complete; the
remaining sequencing item is the GATE-A decision in item 1.
