# MCP-CAT-001-FIXTURE-002 — Catalog fixture reconcile + under-exercised-id coverage

**Status:** Design draft
**Epic:** 12 (Rules UX) / MCP semantic-referee classifier track
**Release:** post-MCP-CAT-001 follow-up (dev-tooling only)
**Issues:**
- #452 — https://github.com/kyleruff1/debate-constitution-app/issues/452 (RECONCILE)
- #453 — https://github.com/kyleruff1/debate-constitution-app/issues/453 (COVERAGE)

> One card closes both issues because they are the two halves of the same follow-up
> recorded in the MCP-CAT-001 design doc's "Open questions" §I items 4 and 5
> (`docs/designs/MCP-CAT-001.md` lines 823-829). Item 4 is #452; item 5 is #453.
> Both were filed as out-of-scope-for-that-card recommendations because MCP-CAT-001
> "may not edit fixtures." This card holds the fixture-edit authority for exactly
> those two recommendations and nothing else.

---

## Goal (one paragraph)

The ratified MCP-CAT-001 classifier catalog is **catalog v1 — 35 ids** (the frozen
23-id v0 set + 12 additions), realized in
`src/features/semanticReferee/semanticRefereeTypes.ts` and mirrored in
`src/lib/constitution/semanticClassifierCatalog.ts` and the Deno mirror under
`supabase/functions/_shared/semanticReferee/`. During implementation the catalog
**merged** `cites_temporal_boundary` into `provides_temporal_constraint` (Q1) and
**dropped** `disputes_specific_amount` entirely (no successor id). The design fixture
`fixtures/argument-scenarios/catalog-design-band-space-rent-evidence.json` still
references both retired ids in move `m8` and in its `proposedClassifierNeeds` /
`compositionRules` / `expectedDeterministicComposition` sections — stale lines that
describe ids absent from the shipped 35-id catalog. **Deliverable A** reconciles those
lines to the ratified 12+2 catalog. Separately, the band-space-rent scenario is a
calm, evidence-driven two-party dispute that positively exercises only 9 of the 23 v0
ids and 6 of the 12 v1 ids; the satire/parody, popularity-as-evidence, hot-take,
branch/tangent-routing, and friction/composer-only ids have **no positive-coverage
exhibit anywhere in the fixture corpus**. **Deliverable B** adds a new, runnable
scenario fixture that fires each of those under-exercised ids at least once and proves
— via a composition-layer replay test — that the *already-shipped* runtime
(`composeVisualState`, COMP-001) produces a coherent, doctrine-clean mutation set for
them. Doctrine shapes this card directly: classifier signals encode only what the AI
layer may **assert about a move's structure** — never truth, correctness, victory,
popularity-as-proof, or a person label. The reconcile must not introduce a banned token
through a renamed id, and the coverage fixture must demonstrate that the popularity /
satire / person-shift ids surface **advisory warnings**, never verdicts.
(`cdiscourse-doctrine` §1 score-is-not-truth, §2 heat, §3 popularity-is-not-evidence,
§4 AI-moderator-limits, §10a Observations-vs-Allegations + composer-only sensitive
Observations.)

This is a **fixture/test-only** change. **NO** `src/` production code, **NO**
`supabase/` change, **NO** catalog/runtime/prompt change. It merges as a normal
dev-tooling PR with no migration, no Edge deploy, no UI.

---

## Data model

**No new data model. No type change. No catalog change.**

This card edits one JSON fixture (A), adds one JSON fixture (B), and adds/extends test
files. It does not touch:

- `SemanticClassifierId` union or `ALL_SEMANTIC_CLASSIFIER_IDS`
  (`src/features/semanticReferee/semanticRefereeTypes.ts`) — the 35-id set is frozen
  and correct.
- `SEMANTIC_CLASSIFIER_CATALOG` (`src/lib/constitution/semanticClassifierCatalog.ts`)
  or its Deno mirror.
- The composition layer (`src/features/semanticReferee/compositionLayer.ts`).
- The validator, prompt template, banner library, ledger, or batching module.

The JSON shapes already exist and are consumed by existing tests; this card reuses them
verbatim. The two relevant shapes:

1. **Design-fixture shape** — `catalog-design-band-space-rent-evidence.json`. Carries
   `expectedClassifierSignal[]` entries of the form
   `{ "id": string, "value": 0|1, "source": "current_catalog" | "PROPOSED_new_id" }`.
   The `source` tag is documentation-only (no test reads it as of this card; see
   "Risks").
2. **Runnable-scenario shape** — `smoke-test-mcp-remote-work-productivity.json` /
   the four committed fixtures. Carries `expectedClassifierSignal[]` entries of the
   form `{ "id": string, "value": 0|1 }` (no `source` tag) plus the runner fields
   (`moveKind`, `qualifierCode`, `argumentType`, `targetExcerpt`, `evidence`,
   `displayMeta`, `expectedStatus`, `expectedConfidence`, `expectedOverrideTrigger`).

The new coverage fixture (B) uses shape 2 (runnable), because shape 2 is the one
`composeVisualState` replay tests and `validateScenario` consume.

---

## Deliverable A — #452 RECONCILE

### A.1 The retired ids and their disposition (authoritative source)

The disposition is fixed by the ratified MCP-CAT-001 design doc
(`docs/designs/MCP-CAT-001.md`), confirmed against the realized catalog constant:

| Retired id (in fixture) | Disposition | Ratified successor | Source of truth |
|---|---|---|---|
| `cites_temporal_boundary` | **MERGED** into `provides_temporal_constraint` | `provides_temporal_constraint` | MCP-CAT-001 §G Q1 "Decision: MERGE — keep only `provides_temporal_constraint`; do not add `cites_temporal_boundary`" (lines 552-563); realized: absent from the 35-id catalog |
| `disputes_specific_amount` | **DROPPED** (no successor id minted) | — (expressed by surviving evidence + temporal ids) | MCP-CAT-001 §A3 count note "Two of those 12 (`disputes_specific_amount`, `cites_temporal_boundary`) were **merged away** at implementation" (lines 264-269); realized: absent from the 35-id catalog |

**Why `disputes_specific_amount` has no 1:1 successor.** The 12 ratified additions
contain no amount-/number-specific id. The catalog design doc's reviewer questions
folded the "specific-amount challenge" shape into the general evidence-applicability +
temporal-constraint + corroborating-document machinery (m8's structural reality: B
disputes A's `$140` figure by attaching a landlord-message excerpt that names the
March/April boundary). The shipped m8 structural signal set therefore expresses the
amount dispute through `provides_temporal_constraint` (the March/April boundary),
`supplies_corroborating_document` (the landlord message), and the existing
`evidence_supports_claim` — not through a dedicated amount id. The reconcile **removes**
the `disputes_specific_amount` line rather than renaming it.

Verification performed during design (cache-cold):
- `ALL_SEMANTIC_CLASSIFIER_IDS` has length 35 and contains `provides_temporal_constraint`
  but neither `cites_temporal_boundary` nor `disputes_specific_amount`
  (`semanticRefereeTypes.ts` lines 34-70, 148-185; asserted by
  `__tests__/mcpCat001NewClassifierIds.test.ts` line 96).
- The Deno mirror `supabase/functions/_shared/semanticReferee/semanticClassifierCatalog.ts`
  matches `provides_temporal_constraint` exactly once and neither retired id (grep
  count = 1 across the three temporal terms → the survivor only). So the reconcile is
  genuinely fixture-only; the runtime catalog already excludes the retired ids.

### A.2 Exact id-mapping table the implementer applies

| Location in `catalog-design-band-space-rent-evidence.json` | Current (stale) | Replace with |
|---|---|---|
| `moves[m8].expectedClassifierSignal[]` — entry id `cites_temporal_boundary` (line ~587) | `{ "id": "cites_temporal_boundary", "value": 1, "source": "PROPOSED_new_id" }` | `{ "id": "provides_temporal_constraint", "value": 1, "source": "current_catalog" }` |
| `moves[m8].expectedClassifierSignal[]` — entry id `disputes_specific_amount` (line ~586) | `{ "id": "disputes_specific_amount", "value": 1, "source": "PROPOSED_new_id" }` | **DELETE the entry** (no successor id) |
| `moves[m8].expectedDeterministicComposition.input[]` (lines ~597-598) | contains `"disputes_specific_amount=1"` and `"cites_temporal_boundary=1"` | replace `"cites_temporal_boundary=1"` → `"provides_temporal_constraint=1"`; **delete** `"disputes_specific_amount=1"` |
| `proposedClassifierNeeds[]` — the `disputes_specific_amount` object (lines ~781-785) | full candidate object | **DELETE the object** — the id was not added; it is no longer a "proposed need" |
| `proposedClassifierNeeds[]` — the `cites_temporal_boundary` object (lines ~786-791) | full candidate object | **DELETE the object** — merged into `provides_temporal_constraint`, which is already documented as its own `proposedClassifierNeeds` entry (lines ~732-737) |
| `compositionRules[]` — rule `evidence_backed_sub_axis_resolution_ready_for_synthesis`, its `inputPattern` (lines ~862-863) | contains `"disputes_specific_amount": 1` and `"cites_temporal_boundary": 1` | replace `"cites_temporal_boundary": 1` → `"provides_temporal_constraint": 1`; **delete** `"disputes_specific_amount": 1` |

> **`source` tag normalization.** After the rename, `provides_temporal_constraint` is a
> shipped catalog id, so its `source` becomes `"current_catalog"` (matching how m3
> already tags `provides_temporal_constraint` — line ~297). Do NOT leave it tagged
> `"PROPOSED_new_id"`; that would be a second, subtler stale line.

### A.3 What MUST NOT change in deliverable A

- The fixture's `currentCatalogCoverage.usedFromCurrent23IdCatalog` /
  `unusedFromCurrent23IdCatalog` arrays (lines ~690-717) — these list **v0** ids only;
  neither retired id is in them, so they are already correct. Do not touch.
- `m8`'s narrative fields: `body`, `expectedDeterministicComposition.outputBanner`,
  `outputSidecar`, `outputSettlementReadiness`, `expectedUIState`,
  `expectedTimelineBehavior`, `displayMeta`. The structural meaning of m8 is unchanged
  (evidence-backed sub-axis resolution ready for synthesis); only the id labels change.
- Every other move (m1-m7), the evidence objects (ev1-ev3), `expectedSettlement`,
  `reasonCodeSafetyNotes`, `schemaMappingNotes`. Out of scope for A.
- m8's `ready_for_synthesis` and m7's `introduces_sub_axis` — these drive the 35-id-mode
  assertions in `compositionLayerBandSpaceRent.test.ts` (synthesis_ready retargets to
  m7); they are NOT the retired ids and must stay.

### A.4 Regression surface for deliverable A

`__tests__/compositionLayerBandSpaceRent.test.ts` reads this JSON directly
(`fs.readFileSync`, line 67) and builds packets from `move.expectedClassifierSignal`
(`buildPacket`, lines 100-139), casting `s.id as SemanticClassifierId`. It runs in two
modes:

- **23-id mode** (line 108-110): filters signals to a hardcoded `CURRENT_23_IDS` set
  (lines 74-98). Both retired ids are absent from that set, so they are already stripped
  today → the reconcile changes **nothing** in 23-id mode. (After the rename,
  `provides_temporal_constraint` is a v1 id, still not in `CURRENT_23_IDS`, so it is
  still stripped in 23-id mode. No 23-id assertion shifts.)
- **35-id mode** (line 110, unfiltered): passes ALL signals through. Today the retired
  ids reach `composeVisualState` as ids absent from the catalog; the
  `classifierInCatalog(...)` guards (compositionLayer.ts lines 115-117, 939-1105) make
  unknown ids no-ops, so the test passes *despite* the stale ids. After the reconcile,
  m8 carries `provides_temporal_constraint=1` (a real v1 id) → R-EV-APP-01's temporal
  branch fires `temporal_constraint_provided` on m8 (compositionLayer.ts lines 997-1009).
  This is an **additive** mutation on m8.

**The implementer MUST confirm the 35-id-mode superset assertion still holds.** The
relevant test (lines 301-323) asserts every 23-id-mode mutation reappears in 35-id mode
(except the documented m8 synthesis_ready retarget) AND `extended.length >=
baseline.length`. Adding `temporal_constraint_provided` to m8 only grows the 35-id set,
so the `>=` holds. Removing `disputes_specific_amount` removes a no-op (it never produced
a mutation), so no mutation disappears. The m8 sub-axis/synthesis assertions
(lines 325-343) depend on m7's `introduces_sub_axis` and m8's `ready_for_synthesis`,
neither of which the reconcile touches → those assertions are unaffected.

> **Net expected test delta for A: zero failing assertions, zero changed assertions.**
> If `compositionLayerBandSpaceRent.test.ts` goes red after the edit, the most likely
> cause is an accidental duplicate `provides_temporal_constraint` entry in m8 (the
> validator/composition layer dedupes by first occurrence — `buildSignalLookup` lines
> 95-103 — so a duplicate is silently harmless, but it is still a fixture defect). m8
> must carry **exactly one** `provides_temporal_constraint` entry after the rename.

---

## Deliverable B — #453 COVERAGE

### B.1 Under-exercised ids the new fixture must positively exercise

Derived from the fixture's own `currentCatalogCoverage.unusedFromCurrent23IdCatalog`
(lines 701-716) intersected with the issue's named targets (satire/parody,
popularity-as-evidence, hot take, branch/tangent routing, friction/composer-only), then
cross-checked against the composition-layer rules that consume each id
(`compositionLayer.ts`). Each target id has a live runtime rule, so firing it in a
fixture is meaningful (it produces a real mutation), not decorative.

| Target id (value=1 in the new fixture) | Family | COMP-001 rule that consumes it | Resulting mutation | Doctrine note |
|---|---|---|---|---|
| `contains_playable_hot_take` | mode_fit | R-DM-02 (compositionLayer.ts line 816) | `playable_hot_take` | spicy ≠ correct; advisory only |
| `is_satire_or_parody` | mode_fit | R-DM-03 (line 828) | `satire_marker` | marks register, not truth |
| `uses_satire_as_evidence` | evidence | R-EV-05 (line 599) | `satire_as_evidence_warning` | satire is not evidence (§3-adjacent) |
| `uses_popularity_as_evidence` | evidence | R-EV-04 (line 587) | `popularity_amplification_warning` | popularity ≠ proof (§3) |
| `suggests_side_branch` | routing | R-BR-01 (line 842) | `side_branch_suggested` + `branch_route_hint` | routing hint, not a verdict |
| `suggests_diagonal_tangent` | routing | R-BR-02 (line 863) | `diagonal_tangent_suggested` + `tangent_route_hint` | routing hint |
| `shifts_to_person_or_intent` | friction | R-BR-03 (line 901) | `person_shift_warning` | composer-only sensitive Observation (doctrine §10a) — never a person label |
| `contains_unplayable_insult_only` | friction | R-BR-04 (line 914) | `unplayable_move` | composer-only; intentionally silent banner (catalog `bannerCode: null`) |

**Secondary ids the same fixture naturally covers (bonus, also currently unused by
band-space-rent):**

| Bonus id | Rule | Mutation |
|---|---|---|
| `introduces_new_issue` (with `responds_to_parent=0`) | R-PC-02 (line 432) | `new_issue_introduced` + `branch_suggested` |
| `requests_clarification` | R-PC-03 (line 452) | `clarification_requested` (opens clarification debt) |
| `answers_clarification` | R-PC-04 (line 469) | `clarification_answered` (+ `clarification_resolved`) |
| `cites_retraction` | R-EV-06 (line 611) | `retraction_cited` (+ `evidence_retracted` if an upstream evidence ancestor exists) |
| `creates_source_chain_gap` | R-EV-07 (line 649) | `source_chain_gap_flagged` (opens gap) |
| `fits_selected_debate_mode=0` | R-DM-01 (line 804) | `mode_mismatch_warning` (fires on `has && value===0`) |

> **`needs_pre_send_pause`** (R-CM-04, line 790, → `pre_send_pause_advised`,
> composer-only per doctrine §10a) is OPTIONAL. It can be included on one move for
> completeness, but it is not in the issue's named target list. The implementer should
> include it only if it can be added without pushing past the 10-move cap or breaking
> the runnable-scenario register. Recommended: include it on the same move as
> `shifts_to_person_or_intent` (both are composer-only friction signals), so one move
> demonstrates the composer-only Observation class.

### B.2 New fixture file

- **New file:** `fixtures/argument-scenarios/catalog-coverage-satire-popularity-routing.json`
  — purpose: a runnable 8-10-move scenario that fires every B.1 primary target id at
  least once. ~180-260 lines (comparable to `smoke-test-mcp-remote-work-productivity.json`).

**Shape:** the **runnable-scenario shape** (shape 2 above), so the fixture is replayable
through `composeVisualState` and (optionally) runnable by `scripts/bot-fixtures/runScenario.js`.
NOT the design-fixture shape — it must NOT carry `artifactType`, `roomMetadata`,
`semanticRefereeRules`, the first-class `evidence[]` array, or
`expectedDeterministicComposition`. Per-move fields:
`moveId / authorAlias / parentMoveId / moveKind / qualifierCode / argumentType /
disagreementAxis / targetExcerpt / body / selectedTagCodes / evidence / expectedStatus /
expectedClassifierSignal / expectedConfidence / expectedOverrideTrigger / displayMeta`.

**Top-level fields:** `scenarioId` (kebab-case, unique:
`catalog-coverage-satire-popularity-routing`), `title`, `resolution`, `category`,
`personas[]`, `moves[]`, `notes`.

**`category`:** use `smoke_test_mcp` (matches the sibling runnable MCP fixture
`smoke-test-mcp-remote-work-productivity.json`). This signals "MCP classifier exhibit,
not one of the four canonical demo scenarios."

### B.3 Scenario design — which move exercises which id

A worked outline the implementer fills in with real prose. The topic is a deliberately
**low-stakes, light register** resolution so the spicy/satire/popularity moves read
naturally without tripping the forbidden-term ban-list (see B.5). Suggested resolution:
a pop-culture / everyday claim (e.g. *"streaming-era TV finales are written worse than
finales from the boxed-DVD era"*) — concrete enough to anchor quotes, light enough to
host a hot take and a satirical reply.

| Move | author | parent | moveKind | argumentType | Signals set `value=1` | id(s) under test | Notes |
|---|---|---|---|---|---|---|---|
| m1 | A | null | `start_thesis` | `thesis` | (root — exempt; no packet) | — | root proclamation; `displayMeta.quoteAnchorCandidate` set. **A spicy-but-coherent root** so a downstream classifier could read `contains_playable_hot_take`, but root is exempt so the hot-take exhibit lands on a later move. |
| m2 | B | m1 | `challenge_parent` | `rebuttal` | (first move by B — exempt; no packet) | — | first-move-per-author exemption; carries `disagreementAxis` + `targetExcerpt` (verbatim from m1) for the validator. |
| m3 | A | m2 | `challenge_parent` | `counter_rebuttal` | `responds_to_parent`, `quote_anchors_parent`, `contains_playable_hot_take`, `fits_selected_debate_mode`=**0** | `contains_playable_hot_take` (R-DM-02), `fits_selected_debate_mode=0` (R-DM-01) | A's second move → eligible. A spicy, in-bounds reply that mismatches a stated calm mode. |
| m4 | B | m3 | `challenge_parent` | `rebuttal` | `responds_to_parent`, `is_satire_or_parody`, `uses_satire_as_evidence` | `is_satire_or_parody` (R-DM-03), `uses_satire_as_evidence` (R-EV-05) | B replies with a parody/meme used as if it were proof. |
| m5 | A | m4 | `challenge_parent` | `rebuttal` | `responds_to_parent`, `uses_popularity_as_evidence` | `uses_popularity_as_evidence` (R-EV-04) | A appeals to view counts / "everyone agrees" — popularity-as-evidence. |
| m6 | B | m5 | `ask_clarification` | `clarification_request` | `responds_to_parent`, `requests_clarification`, `suggests_side_branch` | `requests_clarification` (R-PC-03), `suggests_side_branch` (R-BR-01) | B asks what A means AND flags that a sub-point belongs on a side branch. Satisfies the required `ask_clarification` move kind. |
| m7 | A | m6 | `add_evidence` | `evidence` | `responds_to_parent`, `answers_clarification`, `provides_evidence`, `creates_source_chain_gap`, `suggests_diagonal_tangent` | `answers_clarification` (R-PC-04), `creates_source_chain_gap` (R-EV-07), `suggests_diagonal_tangent` (R-BR-02) | A answers, attaches a weak source with a gap, and steps to a tangent. Satisfies the required `add_evidence` move kind. `provides_evidence=1` with `evidence_supports_claim=0` → R-EV-03 unverified (bonus). |
| m8 | B | m7 | `challenge_parent` | `counter_rebuttal` | `responds_to_parent`, `shifts_to_person_or_intent`, `contains_unplayable_insult_only`, `needs_pre_send_pause` (optional) | `shifts_to_person_or_intent` (R-BR-03), `contains_unplayable_insult_only` (R-BR-04), `needs_pre_send_pause` (R-CM-04, optional) | The composer-only friction exhibit. Body shows a move drifting toward the person — written so the **fixture body itself contains no banned token** (the classifier *signal* marks the drift; the body must not actually insult). |
| m9 | C | m1 | `concede_or_narrow` | `concession` | `responds_to_parent`, `concedes_narrow_point`, `cites_retraction` | `cites_retraction` (R-EV-06) bonus; satisfies required `concede_or_narrow` move kind | A third persona concedes a narrow point and cites a correction. `displayMeta.playfulLabel` set here (validator requires one). Body MUST contain a concession marker (see B.5). |
| m10 | C | m9 | `synthesize_thread` | `synthesis` | `responds_to_parent`, `ready_for_synthesis` | satisfies required `synthesize_thread` move kind | Wrap-up; body MUST contain a concession marker. Settlement-language safe (no `proven`/`true`/`winner`). |

> **Move-kind coverage check (validator hard requirement, B.5).** The outline includes
> all five required kinds: `challenge_parent` (m2/m3/m4/m5/m8), `ask_clarification`
> (m6), `add_evidence` (m7), `concede_or_narrow` (m9), `synthesize_thread` (m10). Move
> count = 10 (the maximum; if the implementer prefers headroom, fold m9's retraction
> onto m7 and drop to 9 moves — but keep all five required kinds).

> **Eligibility realism.** m1 (root) and m2/m9-as-first-move-of-an-author are exempt
> from classification in the real pipeline. The replay test (B.4) applies the SAME
> exemption logic the `compositionLayerRemoteWorkProductivity.test.ts` precedent applies
> (no packet for root; no packet for an author's first move). So the target ids must
> land on **second-or-later moves of an author**. The outline above respects this: every
> id under test is on m3-m8 / m9-m10 where the author already has a prior move OR (for
> persona C) the test treats C's first move as exempt and places C's load-bearing
> `ready_for_synthesis` on m10 (C's second move). **Implementer note:** if persona C
> appears for the first time at m9, then m9 is C-first → exempt → `cites_retraction`
> on m9 would NOT fire in the replay. Two clean fixes: (a) give C an earlier throwaway
> chime-in so m9 is C's second move, or (b) move `cites_retraction` to A's m7 (A is
> already non-first there) and let m9 carry only the `concede_or_narrow` move-kind
> requirement (its `concedes_narrow_point` signal will also be exempt if m9 is C-first,
> which is fine — the *move kind* satisfies the validator regardless of eligibility).
> **Recommend (b)** — it keeps the persona count at the conventional 2-3 without a
> filler move. The design's id-coverage contract (B.1) is satisfied as long as each
> target id fires on at least one eligible move; (b) preserves that.

### B.4 The "does the runtime already handle these?" determination (#453's conditional)

#453 says: add coverage, **no runtime behavior change UNLESS the new fixture exposes a
genuine runtime/catalog mismatch, in which case DOCUMENT it as a finding** (do not
silently change runtime).

**Determination (made at design time by reading `compositionLayer.ts`): NO runtime
mismatch is expected.** Every B.1 target id already has a live, shipped composition rule
(R-DM-02, R-DM-03, R-EV-04, R-EV-05, R-BR-01, R-BR-02, R-BR-03, R-BR-04 — see B.1
table, all present in `compositionLayer.ts` lines 587-924, i.e. catalog-v0 rules, not
even the guarded v1 additions). Every target id is a member of the 35-id catalog
(`ALL_SEMANTIC_CLASSIFIER_IDS`). So the coverage fixture is **purely additive
verification**: it proves the existing runtime produces the expected mutations. The
expected outcome is green tests with zero runtime edits.

**If the implementer's replay test surfaces a real gap** (e.g. a target id that produces
no mutation, or a mutation carrying a banned token), the implementer MUST:
1. NOT change `compositionLayer.ts` / the catalog / the prompt.
2. Record the gap as a **"Finding for operator"** section in the card's review/handoff
   notes (and flag it back up to the orchestrator), with the move id, the id under test,
   the observed vs expected mutation, and a proposed follow-up card.
This preserves the boundary: this card ships fixtures + tests only.

### B.5 Validator constraints the new fixture MUST satisfy

`src/features/devFixtures/argumentScenarioValidation.ts` (`validateScenario`) is strict.
The new fixture must pass it cleanly (the card registers the fixture in the validation
test — see B.6). Hard requirements:

- **6-10 moves** (default `minMoves=6`, `maxMoves=10`). The outline uses 9-10. Do not
  exceed 10.
- **All five required move kinds** present: `challenge_parent`, `ask_clarification`,
  `add_evidence`, `concede_or_narrow`, `synthesize_thread` (validator lines 142-151).
- **Exactly one root** (`parentMoveId: null`), all other `parentMoveId`s resolve
  (lines 119-129).
- **Every `challenge_parent` move** carries `disagreementAxis` or `qualifierCode`
  (lines 132-138).
- **At least one quote anchor** — a `targetExcerpt` OR a
  `displayMeta.quoteAnchorCandidate` (lines 154-157).
- **At least one `displayMeta.playfulLabel`** (lines 160-163). Put it on m9
  (the concession). The playful label must itself be ban-list clean (no `winner` etc.).
- **Every `targetExcerpt` must appear VERBATIM in its parent's `body`** (lines 166-175).
  This is the most common authoring break — the implementer must copy excerpts exactly.
- **Forbidden-term ban-list (word-boundary, case-insensitive, lines 3-12):**
  `bad faith`, `manipulation`, `liar`, `dishonest`, `winner`, **`truth`**, `ban`,
  `hide`. **`truth` is banned** — the satire/popularity bodies must not say "the truth
  is…"; phrase around it. `ban`/`hide` are word-boundary matched (so "urban"/"hideaway"
  are safe, but avoid literal "ban"/"hide").
- **Concession markers (lines 74-83):** the validator's default mode
  (`checkConstitution=false`, which is what the committed-fixture test uses) does NOT
  enforce concession markers or Constitution transitions. **However**, to keep the
  fixture robust if anyone later runs it in stress mode, the `concession` (m9) and
  `synthesis` (m10) bodies SHOULD each contain a marker (`I concede`, `I grant`,
  `you're right`, `fair point`, `I acknowledge`, etc.). Cheap insurance; recommended.
- **No secrets / emails / `password`** (lines 22-30, 40-50). Trivially satisfied with
  invented prose.
- **The classifier-signal bodies must not contain a banned token even though the SIGNAL
  marks the behavior.** Critical for m8: the *signal* `shifts_to_person_or_intent=1` and
  `contains_unplayable_insult_only=1` mark a move that drifts to the person — but the
  fixture *body* must NOT actually contain an insult or a banned token. Write the body
  as a mild, on-the-edge sentence; the classifier signal (set by hand in the fixture)
  carries the structural claim, not the literal text. This mirrors how the catalog's own
  ban-list tests treat these ids (the id name is a structural detector, never a verdict).

### B.6 Test plan (deliverable B)

All tests are pure (no network, no Supabase, no React), mirroring the existing
`compositionLayer*` replay tests.

1. **New file:** `__tests__/compositionLayerCatalogCoverage.test.ts` — the replay test.
   Structure copied from `__tests__/compositionLayerRemoteWorkProductivity.test.ts`
   (the runnable-shape precedent): `fs.readFileSync` the new fixture, build packets with
   the root + first-move-per-author exemptions, replay through `composeVisualState`
   accumulating state, assert per-move mutations. Required assertions (≈12-16 `it`
   blocks):
   - `m3` mutations include `{ mutation: 'playable_hot_take', targetMoveId: 'm3' }` AND
     `{ mutation: 'mode_mismatch_warning', targetMoveId: 'm3' }`.
   - `m4` includes `satire_marker` and `satire_as_evidence_warning` (both target m4).
   - `m5` includes `popularity_amplification_warning` (target m5).
   - `m6` includes `clarification_requested` (target m5, the parent) AND
     `side_branch_suggested` + `branch_route_hint` (target m6); assert the clarification
     debt is opened in `state.clarificationDebts`.
   - `m7` includes `clarification_answered` (target m7) AND `clarification_resolved`
     (target m6, the asking move) AND `source_chain_gap_flagged` (target m7) AND
     `diagonal_tangent_suggested` + `tangent_route_hint` (target m7); assert the
     source-chain gap is opened in `state.sourceChainGaps`.
   - `m8` includes `person_shift_warning` (target m8) AND `unplayable_move`
     (target m8); assert `state.personShiftMoves.has('m8')` and
     `state.unplayableMoves.has('m8')`. If `needs_pre_send_pause` is included, assert
     `pre_send_pause_advised`.
   - `m7` (or wherever `cites_retraction` lands) includes `retraction_cited`.
   - `m10` includes `synthesis_ready` + `synthesis_offered`; assert
     `state.synthesisReadiness.ready === true`.
   - A **coverage roll-up assertion**: collect every `mutation` string emitted across
     all moves into a Set and assert it is a superset of the expected B.1 mutation set
     (`playable_hot_take`, `satire_marker`, `satire_as_evidence_warning`,
     `popularity_amplification_warning`, `side_branch_suggested`,
     `diagonal_tangent_suggested`, `person_shift_warning`, `unplayable_move`). This is
     the single assertion that guarantees the fixture keeps exercising every target id
     even if the prose is later edited.
2. **New file (or extend existing):** a **doctrine ban-list scan** over the new fixture's
   rendered strings. Add a block to `__tests__/compositionLayerCatalogCoverage.test.ts`
   (or a tiny `__tests__/catalogCoverageFixtureDoctrine.test.ts`) that:
   - Loads the new fixture JSON.
   - Scans every `move.body`, `move.targetExcerpt`, `move.displayMeta.playfulLabel`,
     `title`, `resolution`, `notes`, and `evidence.label/sourceText` for the doctrine
     ban-list (reuse the token list from `mcpCat001NewClassifierIds.test.ts` lines 53-78:
     `winner / loser / won / lost / right / wrong / true / false / correct / incorrect /
     proven / defeated / liar / lying / dishonest / manipulative / troll / propagandist /
     extremist / stupid / idiot` + phrase `bad faith`) AND the validator's
     `FORBIDDEN_TERMS` (`truth`, `ban`, `hide`, `manipulation`).
   - Asserts zero hits. This is the §1/§3/§10a guard: the coverage fixture marks
     popularity/satire/person-shift *structurally* without ever printing a verdict or a
     person label.
3. **Extend:** `__tests__/argumentScenarioValidation.test.ts` — add the new fixture to
   the hardcoded `files` array (lines 286-291) so it is run through `validateScenario`
   alongside the four canonical fixtures. This is the line that turns the README's
   "auto-discover" aspiration into a real gate for this file. Adds 4 `it` blocks (the
   per-file `it.each`-style group already present: passes-validation / root-has-no-parent
   / non-root-has-parent / challenge-has-axis).

> **Why register in the validation test (vs. relying on auto-discovery):** the README
> claims the suite "auto-discovers new JSON files" (line 59), but the actual test uses a
> **hardcoded 4-entry list** (lines 286-291) — which is why the design fixture
> `catalog-design-band-space-rent-evidence.json` and the runnable
> `smoke-test-mcp-remote-work-productivity.json` are NOT validated today. To get real
> validation coverage for the new fixture, it MUST be added to that list. (Optionally
> file a separate follow-up to make the discovery genuinely dynamic; out of scope here.)

### B.7 Approximate test-count delta

- `compositionLayerCatalogCoverage.test.ts`: ≈ 14 `it` blocks (per-move + roll-up).
- doctrine ban-list scan: ≈ 2 `it` blocks (token scan + validator-forbidden scan), or
  folded into the replay file.
- `argumentScenarioValidation.test.ts`: +4 `it` blocks (one new file × the 4-assertion
  group).

**Estimated net new tests: ~18-20.** Test count goes UP (test-discipline §"Test count
tracking"). The implementer captures the exact `Tests: X passed` line and updates
`docs/core/current-status.md` after a green full-suite run.

---

## File changes

- **modified:** `fixtures/argument-scenarios/catalog-design-band-space-rent-evidence.json`
  — deliverable A. Six surgical edits per the A.2 table (one rename, one delete in m8's
  `expectedClassifierSignal`; the `expectedDeterministicComposition.input` mirror; two
  `proposedClassifierNeeds` object deletes; one `compositionRules` inputPattern mirror).
  ~10-14 lines changed/removed. No structural/narrative change.
- **new:** `fixtures/argument-scenarios/catalog-coverage-satire-popularity-routing.json`
  — deliverable B. ~180-260 lines. Runnable-scenario shape; 9-10 moves; fires every B.1
  target id.
- **new:** `__tests__/compositionLayerCatalogCoverage.test.ts` — replay + per-move
  mutation assertions + coverage roll-up (+ optionally the doctrine ban-list scan).
  ~180-240 lines.
- **modified:** `__tests__/argumentScenarioValidation.test.ts` — add the new fixture to
  the hardcoded `files` array (lines 286-291). ~1-4 lines.
- **(optional) new:** `__tests__/catalogCoverageFixtureDoctrine.test.ts` — if the
  doctrine scan is kept separate from the replay file. ~40-60 lines.
- **modified (post-merge, by implementer):** `docs/core/current-status.md` — bump the
  test count + one-line note. (Doc-only; not part of the test surface.)

**No** changes under `src/`, `app/`, `supabase/`, `mcp-server/`, `scripts/`, or any
migration / Edge Function / prompt / catalog file.

---

## API / interface contracts

No code interface changes. The fixtures conform to existing TypeScript shapes the tests
already import:

- `FixtureScenario` / `FixtureMove` from
  `src/features/devFixtures/argumentScenarioTypes.ts` (consumed by
  `validateScenario`).
- `SemanticRefereePacket` / `SemanticBinarySample` / `SemanticClassifierId` from
  `src/features/semanticReferee/semanticRefereeTypes.ts` (the replay test builds packets
  of this shape).
- `composeVisualState(input: ComposeVisualStateInput): CompositionResult` from
  `src/features/semanticReferee/compositionLayer.ts` — called read-only by the replay
  test; signature unchanged.

The replay-test packet builder is a copy of the proven helper in
`__tests__/compositionLayerRemoteWorkProductivity.test.ts` (lines 59-100): exempt root
(no parent → `undefined`), exempt first-move-per-author (→ `undefined`), otherwise build
a `mock`-provider packet with `authoritative: false`, zeroed `scoreHints`,
`routeSuggestion: 'no_route_change'`, `frictionSuggestion: 'none'`, and one binary per
fixture signal.

---

## Edge cases

- **Empty / malformed fixture:** `validateScenario` returns a non-empty error array →
  the registered validation test (B.6 #3) fails with the exact error. This is the
  intended guard.
- **`targetExcerpt` not verbatim in parent body:** validator error
  (`argumentScenarioValidation.ts` lines 166-175). The implementer must copy excerpts
  byte-for-byte; this is the single most likely authoring slip.
- **A target id placed on a root or first-move-per-author:** the replay exemption
  (no packet) means the id never reaches `composeVisualState` → the expected mutation is
  absent → the coverage roll-up assertion (B.6 #1) fails. Mitigation: B.3's eligibility
  note + recommendation (b); every target id lands on an eligible move.
- **Duplicate signal id within one move (A or B):** `buildSignalLookup` keeps the FIRST
  occurrence (compositionLayer.ts lines 95-103) — silently harmless at runtime, but a
  fixture defect. For A specifically: after renaming `cites_temporal_boundary` →
  `provides_temporal_constraint`, m8 must have exactly ONE
  `provides_temporal_constraint`. (m3 already has its own; that's a different move and
  fine.)
- **`fits_selected_debate_mode` semantics:** R-DM-01 fires the warning on
  `sig.has(...) && value === 0` (line 804) — i.e. the signal must be PRESENT with
  `value: 0` to produce `mode_mismatch_warning`. Omitting the id entirely does NOT fire
  it. The fixture must explicitly include `{ "id": "fits_selected_debate_mode",
  "value": 0 }` on m3 to exercise R-DM-01.
- **`uses_satire_as_evidence` vs `is_satire_or_parody`:** these are TWO distinct ids
  with TWO distinct rules (R-EV-05 evidence-warning vs R-DM-03 register-marker). m4
  should set both `value: 1` to exercise both; do not assume one implies the other.
- **Person-shift / unplayable body purity:** the move that carries
  `shifts_to_person_or_intent=1` / `contains_unplayable_insult_only=1` must have a body
  that contains NO banned token (the doctrine scan B.6 #2 will catch a slip). The signal
  marks the structure; the prose stays clean. This is the doctrine §10a composer-only
  boundary made concrete.
- **Doctrine-constraint edge case (heat/popularity):** the `popularity_amplification_warning`
  exhibit must read as "popularity is not evidence" — never as "this claim is false."
  The mutation is a typed enum (`popularity_amplification_warning`), so the runtime
  cannot leak prose; the fixture body must also not editorialize a verdict (caught by
  the doctrine scan).
- **No-mismatch determination is provisional until the replay runs:** B.4 predicts green
  from a static read of `compositionLayer.ts`. If reality differs, the implementer
  documents a finding rather than editing runtime (B.4 escalation path).

---

## Dependencies (cards / docs / files)

- **Assumes MCP-CAT-001 is complete** because the 35-id catalog and the composition-layer
  v1 rules are the source of truth this card reconciles against and exercises.
  (Implementation landed before the MCP-CAT-001 *design* card per that doc's "design/
  implementation inversion" note; both are now in `main`.)
- **Reads** `src/features/semanticReferee/semanticRefereeTypes.ts`
  (`ALL_SEMANTIC_CLASSIFIER_IDS`) and `src/lib/constitution/semanticClassifierCatalog.ts`
  (the per-id metadata) to confirm the ratified id set — read-only, no edit.
- **Reads** `src/features/semanticReferee/compositionLayer.ts` to map each target id to
  its rule/mutation — read-only, no edit.
- **Reuses** the test pattern in
  `__tests__/compositionLayerRemoteWorkProductivity.test.ts` and
  `__tests__/compositionLayerBandSpaceRent.test.ts` (replay-from-JSON harness).
- **Reuses** `src/features/devFixtures/argumentScenarioValidation.ts` +
  `argumentScenarioTypes.ts` (validator + shape).
- **Closes** the MCP-CAT-001 design doc's §I open questions 4 (#452) and 5 (#453).
- **Does NOT block** any future card; it is a leaf follow-up. It does *improve* the
  safety net for any future card that adds a classifier id (the coverage fixture +
  roll-up assertion will catch a new id that silently produces no mutation).

---

## Risks

- **Validator strictness (highest-likelihood implementer trip).** The new fixture must
  satisfy `validateScenario` exactly: 6-10 moves, all five required move kinds, verbatim
  `targetExcerpt`s, a playful label, and the `truth`/`ban`/`hide` ban-list. The
  satire/popularity/hot-take register fights the ban-list (it is tempting to write "the
  truth is…" or "that's a ban-worthy take"). Mitigation: B.5 enumerates every constraint;
  the doctrine scan + the registered validation test catch slips at test time, not in
  prod.
- **Eligibility/exemption mismatch.** If a target id lands on an exempt move (root /
  author-first), the replay produces no mutation and the roll-up assertion fails for a
  confusing reason. Mitigation: B.3 eligibility note + recommendation (b).
- **35-id-mode superset assertion in `compositionLayerBandSpaceRent.test.ts` (deliverable
  A).** Adding `provides_temporal_constraint` to m8 grows the 35-id mutation set with
  `temporal_constraint_provided`. The superset assertion (every 23-id mutation reappears,
  `extended.length >= baseline.length`) still holds because the change is additive, but
  the implementer MUST run this test and confirm green. If a future refactor ever made
  the 35-id assertion an EQUALITY (it is currently `>=`), this edit would break it; it is
  `>=` today (line 321), so safe.
- **The `source` field is documentation-only — for now.** No current test reads
  `expectedClassifierSignal[].source`. The reconcile updates it (`PROPOSED_new_id` →
  `current_catalog`) for correctness, but if a future card adds a test that asserts
  `source` consistency against the catalog, that test belongs to that card, not this one.
  (Recorded so the reviewer does not expect a `source`-validation test here.)
- **README "auto-discovery" is misleading.** A reviewer may assume adding the JSON file
  is sufficient for validation coverage. It is NOT — the validation test hardcodes the
  file list (lines 286-291). B.6 #3 explicitly adds the registration line. (Optional
  follow-up: make discovery genuinely dynamic.)
- **No live/provider exposure.** This card runs no classifier and no provider; all
  signals are hand-authored in the fixture and replayed through the pure composition
  layer. There is no token spend, no network, no `--pilot` path. (Zero risk on the
  secrets/provider axis.)

---

## Out of scope

- **Any catalog / runtime / prompt / type change.** The 35-id catalog, the composition
  layer, the validator, the prompt template, the banner library, the ledger, and the
  batching module are all untouched. If the coverage fixture reveals a real gap, it is
  documented as a finding for the operator (B.4), not fixed here.
- **Re-touching any band-space-rent move other than m8** (and the m8-derived
  `proposedClassifierNeeds`/`compositionRules`/`input` lines named in A.2). m1-m7,
  ev1-ev3, `expectedSettlement`, `reasonCodeSafetyNotes`, `schemaMappingNotes` stay.
- **The two settlement ids (`proposes_settlement_terms` / `accepts_settlement_terms`)
  and `concedes_with_new_dispute`.** These are ratified (MCP-CAT-001 §G Q3, §I items 2-3
  flag them for possible GATE-A reconsideration) but are NOT under-exercised in the sense
  #453 targets, and revisiting them is a separate decision. The coverage fixture does not
  need to exercise them (band-space-rent already covers `introduces_sub_axis` /
  settlement-adjacent flow). Not in scope.
- **Making the validation suite genuinely auto-discover fixtures.** Recommended as a
  separate follow-up; this card only registers the one new file.
- **Running `scripts/bot-fixtures/runScenario.js` live against the new fixture, or any
  Supabase seed.** The fixture is *shaped* to be runnable, but this card verifies it only
  through the pure `composeVisualState` replay. No live run, no DB write.
- **Migration, Edge Function deploy, UI.** None — pure fixture/test change.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (score is not truth):** No fixture string, no test assertion,
  and no resulting mutation asserts a winner/loser/true/false/correct/proven. The
  composition mutations are typed enums describing structure (`playable_hot_take`,
  `satire_marker`, `popularity_amplification_warning`, …). The doctrine ban-list scan
  (B.6 #2) enforces zero verdict/person tokens across every fixture string. The
  reconcile (A) replaces a retired id with another structural id and deletes a dropped
  id — it cannot introduce a verdict token (both ids are structural detectors).
- **cdiscourse-doctrine §2 (heat = activity, not correctness):** The hot-take exhibit
  (`contains_playable_hot_take` → `playable_hot_take`) marks a move as spicy-but-coherent
  — register, not correctness. The fixture body must not imply the spicy take is right.
- **cdiscourse-doctrine §3 (popularity is not evidence):** The
  `uses_popularity_as_evidence` exhibit fires `popularity_amplification_warning`
  (R-EV-04) — the doctrine's deterministic surfacing of "popularity ≠ proof." Engagement
  framing in the m5 body must read as an *appeal being flagged*, never as the claim being
  validated by popularity.
- **cdiscourse-doctrine §4 (AI moderator limits):** This card runs no AI. All signals are
  hand-authored; the only execution is the pure, side-effect-free `composeVisualState`.
  No client AI call, no authoritative flag, no auto-moderation. `authoritative: false`
  on every replay packet (B.4 helper).
- **cdiscourse-doctrine §10a (Observations vs Allegations; composer-only sensitive
  Observations):** The friction ids `shifts_to_person_or_intent`,
  `contains_unplayable_insult_only`, and (optional) `needs_pre_send_pause` are
  machine-generated Observations and are composer-only sensitive Observations — they must
  never render on the target's node as an accusation, and the fixture demonstrates this
  by keeping the move *body* clean while the *signal* marks the drift. No id name leaks
  to a user surface in this card (fixtures + tests only).
- **cdiscourse-doctrine §9 (plain language) / §10 (v1 scope):** No user-facing strings
  are added (fixtures are dev artifacts). No v1-scope-banned feature is touched (no
  voting/scoring-winner, no search, no push, no OAuth, no public API). The classifier
  layer remains advisory.
- **test-discipline:** Tests are part of this deliverable, not a follow-up. Pure-model /
  replay tests, no `.skip`/`.only`, test count goes UP (~18-20), and the gate-green
  contract (captured `Tests: X passed` exit-0 line) governs the count claim. The
  doctrine ban-list scan is the required safety test for a card touching classifier
  exhibits.

---

## Operator steps (if any)

**None — pure code change (fixtures + tests).** No migration (`npx supabase db push`),
no Edge Function deploy (`npx supabase functions deploy`), no env var, no manual step.
Merges as a normal dev-tooling PR. The only post-merge action is the implementer's own
`docs/core/current-status.md` test-count bump, which is part of the PR, not an operator
task.
