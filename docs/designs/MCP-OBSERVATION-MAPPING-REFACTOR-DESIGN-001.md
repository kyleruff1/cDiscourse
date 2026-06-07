# MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001 — Boolean observation mapping refactor (GATE-A design)

**Status:** Proposed — GATE A (design-only; authors/applies no code, no migration)
**Date:** 2026-06-07
**Epic:** Epic 12 (Rules UX) / MCP semantic-referee track (machine observations)
**Release:** Post-Stage 6.4; sequenced after the MCP-021A/B/C family-enablement chain
**Consolidates:** the two proposed cards #4 (no-migration mapping over existing booleans) and #5 (new-boolean schema expansion) into one design with a two-track split.
**Spawns:** `MCP-FAMILY-HITODS-DESIGN-001` (the new `disagreement_strategy_hitods` family is its own P4 doctrine-reviewed design card — NOT folded here).
**Companion docs:** `MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001-migration-plan.md` (GATE-A migration plan); `MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001-intent.md` (why-now / success / out-of-scope).
**Discovery brief:** `.claude-tmp/MCP-OBSERVATION-MAPPING-REFACTOR-discovery.md` (Phase 0, read-only against main @ 8410b54).
**Candidate artifact:** `docs/designs/mcp-observation-mapping/` (README + schema JSON + `proposed_new_boolean_flags.csv` [134 booleans] + `mcp_boolean_observation_mapping_expanded_1000plus.csv` [2,383 candidate rows]).

---

## 1. Header / summary

This card designs how CDiscourse turns the MCP boolean classifier's raw positive answers (currently mapped one rawKey → one display label) into **richer, combination-aware, display-only machine observations** — "what the referee noticed about this reply." It does this in two tracks:

- **Track 1 (no migration):** a declarative mapping *evaluator* that reads the booleans a move *already* has and emits richer composite labels for single / negative / pair / triple / cross-family combinations. Build 1 ships this against the **1,268** `fits_existing_or_planned_boolean_answers` rows. No new boolean, no schema-version bump, no migration.
- **Track 2 (new booleans, near-zero migration):** adopt a reviewed subset of new *production-family* booleans (the 21 across the 7 production families), which extends the evaluator's reachable label set. The discovery STORAGE VERDICT (verified in §6) is that the observation store is a **`raw_key`-row key-value model** — a new boolean is a new `raw_key` *value*, not a column — so this requires **no DDL for answer storage** (only a schema-version bump constant + new definitions in code + MCP-server prompts).

The new `disagreement_strategy_hitods` family (18 booleans, incl. face-attack/aggression observations) is the doctrine crux and is **fenced into its own card** (§7). The frozen H/I/J families and their 6 artifact booleans stay deferred (§5). The CSV is a **candidate** source, not a production file — adoption is via a reviewed subset seeded into a checked-in declarative registry (§8).

This is a GATE-A design card. It produces a migration *plan* for operator approval; it authors and applies nothing.

---

## 2. Context & problem

### 2.1 What exists today (verified against main @ 8410b54)

- **Storage:** `public.argument_machine_observation_results` (migration `20260526000018_mcp_021b_machine_observation_results.sql`) stores **one row per POSITIVE observation**, keyed by a `raw_key TEXT` column, with `CONSTRAINT amor_unique_run_rawkey UNIQUE (run_id, raw_key)`. Runs live in `argument_machine_observation_runs`. This is a key-value row model — *not* a wide table of boolean columns.
- **Family registry:** `supabase/functions/_shared/booleanObservations/familyRegistry.ts` — `Object.freeze`'d `FAMILY_REGISTRY`. The 7 production families (`parent_relation`, `disagreement_axis`, `misunderstanding_repair`, `evidence_source_chain`, `argument_scheme`, `critical_question`, `resolution_progress`) are `productionEnabled:true`; the frozen 3 (`claim_clarity` [H], `thread_topology` [I], `sensitive_composer` [J]) are `productionEnabled:false`, `adminValidationEnabled:true`.
- **Definitions:** mirrored in `src/features/nodeLabels/machineObservationDefinitions/familyA.ts … familyJ.ts` (client) AND `supabase/functions/_shared/booleanObservations/machineObservationDefinitions/familyA.ts … familyJ.ts` (Edge/Deno mirror, parity-tested). `MachineObservationDefinition` = `{ rawKey, family, label, shortLabel, description, confidenceEligibility, source, disposition, priority }` plus the presentation fields the adapter spreads. Composed into a frozen `MACHINE_OBSERVATION_DEFINITIONS_REGISTRY` keyed `${source}:${rawKey}`.
- **Schema version:** `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION = 'mcp-021.machine-observations.boolean.v1'` in `mcpBooleanObservationSchema.ts`.
- **Read pipeline:** `machineObservationPersistenceQuery.ts` → `machineObservationPersistenceAdapter.ts` (`mapPersistedObservationRowsToNodeLabelMarks` — filters by schema-version match, rawKey-registry membership, per-surface confidence floor; truncates evidence-span; spreads the *definition's* label, never the raw row) → `nodeLabelSourceAdapters.ts` (Source 6) → `nodeLabelDescriptorAdapter.ts` → `NodeLabelStrip.tsx` / `nodeLabelPresentationModel.ts`. The card detail (`CardDetailPanel` + `cardClassifierStripModel` + shared `argumentDetailModel`, post-#516/#518) renders the "what the referee noticed — advisory, not a verdict" strip.
- **Plain language:** `src/features/arguments/gameCopy.ts` `toPlainLanguage` / `toPlainLanguageOrSuppress` normalize codes (`[\s-]+` → `_`, lowercased) and **suppress unmapped codes** (return `null`).
- **Post-storage evaluation:** `classifyArgumentCore.ts` runs classification POST-storage (after the argument is stored; never in submit/acceptance), then `persistRun()` + `persistResults()`. `engine.ts` is the sole submission gate.

### 2.2 The gap the artifact addresses

Today the adapter is **1:1**: a single positive `raw_key` maps to a single `NodeLabelMark` whose label is spread verbatim from the definition. The artifact proposes a **many-booleans → one richer observation** layer: single-flag, negative-flag, pair, asymmetric, curated-triple, and cross-family rules that produce more specific, more useful diagnostic labels (e.g. "Central-point refutation with claim-matched evidence" from four positive booleans across two families). This is **display enrichment only** — no new gate, no routing, no scoring.

### 2.3 The two-track split (the core engineering decision)

The artifact's 2,383 rows split cleanly:

| Track | Rows | What it needs | Build | Migration? | Gate |
| --- | --- | --- | --- | --- | --- |
| **Track 1** — evaluator over *existing* booleans | 1,268 `fits_existing_or_planned_boolean_answers` | evaluator + reviewed registry subset | Build 1 (`MCP-OBSERVATION-MAPPING-EXPANSION-001`) | **No** | normal (no `supabase/**`/`mcp-server/**`) |
| **Track 2** — *new* booleans (production families) | subset of 1,115 `requires_sql_or_json_schema_extension` | new definitions + MCP prompts + schema-version bump | Build 2 (`MCP-BOOLEAN-SCHEMA-EXPANSION-001`) then Build 3 (mapping extension) | **near-zero** (see §6) | merge=deploy GATE C |
| **HiTODS** — new family | 18 booleans + their mapping rows | own P4 doctrine card | Build 4 (`MCP-FAMILY-HITODS-DESIGN-001`) | (designed separately) | P4 doctrine + GATE A |
| **Frozen H/I/J new booleans** | 6 booleans | deferred WITH families | — (not now) | — | — |

Track 1 delivers richer labels *now* with zero schema risk; Track 2 is the gated expansion. Separating them lets the high-value, zero-risk enrichment ship first.

---

## 3. Doctrine (the 9 invariants — restated verbatim; binding on every build this card sequences)

> **1. Acceptance-gate invariant:** `src/lib/constitution/engine.ts` is the SOLE submission gate. EVERYTHING here is POST-storage display. No mapping row, no boolean, no family (production/frozen/the new HiTODS) may block/reject/route/delay/gate a user post.
>
> **2. Display-only machine observations, never verdicts or author labels.** Every observation is about the MOVE/REPLY ("what the referee noticed about this reply"), advisory, NEVER about the author ("this person is X"), never winner/loser/correctness. Route all labels through `gameCopy.toPlainLanguage`/`toPlainLanguageOrSuppress` (unmapped codes dropped). Preserve the artifact's verdict-free register.
>
> **3. No suppression, no routing, no `productionEnabled` flip** from the mapping or any boolean. Adding a boolean/family never arms routing, never raises a percentage, never flips a family to production.
>
> **4. HiTODS new family (`disagreement_strategy_hitods`) is the doctrine crux — fence it hardest.** Its 18 booleans include face-attack/aggression observations (name_calling, blatant_aggressive_denial, ordering_or_commanding, ironic_echoing, irrelevancy_claim, tone_response_without_substance). Recommendation MUST be: (a) frozen-by-default (`productionEnabled:false` like H/I/J), enabled only via the cutover gate criteria, NEVER by this card; (b) observations about the MOVE, never the author; (c) its OWN dedicated P4-doctrine-reviewed build card (like the J-family deepen #473), NOT folded into the general schema build; (d) explicitly NOT a moderation surface — labels help a reader understand disagreement DYNAMICS; any future "act on this" affordance is separately scoped + out of bounds here.
>
> **5. Frozen H/I/J stay frozen.** The 6 artifact booleans for H/I/J are deferred WITH their families (productionEnabled:false pending organic traffic per the #471 ledger). Designed-but-deferred; out of scope to design into them now.
>
> **6. §10a / `inactive_reason` non-exposure** carries forward — no observation surface exposes moderation-reason labels.
>
> **7. Card-default-visible / timeline-tap-to-reveal posture** — consistent with CARD-VIEW-DETAIL-HUB-001 (ratified) + CARD-VIEW-COMPARISON-POLISH. Same data, different disclosure.
>
> **8. The CSV is a CANDIDATE source, not a production file.** Specify a reviewed-subset adoption + a declarative registry the evaluator reads — NOT a wholesale import of 2,383 unreviewed rows.
>
> **9. Migration discipline (GATE A):** this card produces a migration PLAN for operator approval; it authors/applies nothing. Per the discovery STORAGE VERDICT, the observation store is a `raw_key`-row key-value model → **a new boolean is a new `raw_key` VALUE, not a column → near-zero / no DDL** (verify + state precisely). JSON-keys-first equivalent already realized.

These nine bind every build card this document sequences. A build that violates any is rejected at review.

---

## 4. Mapping evaluator architecture (Decision 1 — resolved)

### 4.1 Shape

A **declarative mapping registry** of `ObservationMappingRule` rows, evaluated **post-storage** against a single move's set of positive boolean rawKeys, producing display observations. The rule shape mirrors the artifact's columns:

```
ObservationMappingRule {
  mappingId: string;                  // 'MBOM-00001' / 'parent_relation.single_true.0001'
  familyKey: MachineObservationFamily | CrossFamilyKey;
  ruleKind: 'single_true' | 'single_false' | 'pair_true_true'
          | 'pair_true_false' | 'pair_false_true'
          | 'curated_triple' | 'cross_family';
  requiredTrueFlags: ReadonlyArray<string>;   // rawKeys that must be present (positive)
  requiredFalseFlags: ReadonlyArray<string>;  // rawKeys that must be ABSENT (no positive row)
  observationCode: string;            // the code routed through gameCopy
  labelShort: string;                 // 'References the parent claim observed'
  labelNeutral: string;               // verdict-free family-pattern label
  diagnosticSentence: string;         // 'This reply states opposition but may need more reasons or evidence.'
  displayPriority: number;            // ordering only — NOT a score, NOT a verdict
  confidenceWeight: number;           // INTERNAL ordering hint; surfaced ONLY as PIPS (§4.5), never a number
  cardSurfaceVisibility: 'card_default_visible' | ...;
  timelineSurfaceVisibility: 'timeline_tap_to_reveal' | ...;
  safetyNote: string;                 // 'Display-only. Do not block/reject/suppress/route/delay.'
}
```

### 4.2 Evaluation contract (the public function)

```
evaluateObservationMapping(
  positiveRawKeys: ReadonlySet<string>,   // the move's POSITIVE booleans (one per persisted row)
  rules: ReadonlyArray<ObservationMappingRule>,
  options: { surface: 'timeline_node' | 'selected_context' | 'inspect' }
): ReadonlyArray<ObservationMappingMark>
```

- **Absence semantics.** A `requiredFalseFlags` rawKey is "absent" iff it is NOT in `positiveRawKeys`. The store has **no row for a negative**, so absence == not-present. This is doctrinally important: a negative observation ("References the parent claim absent") describes only that the classifier did not observe the positive — never that the author failed.
- **Determinism.** Pure function. Same input set + same rules → same marks. No I/O, no randomness, no clock.
- **No gate.** The function NEVER returns a "block" / "route" / "suppress" / "delay" signal. Its only output is display marks. It runs **after** `persistResults` (and at read time in the adapter), never in the submit path.
- **Ordering.** Marks are ordered by `displayPriority` then `mappingId` (stable). Higher-specificity rules (triple > pair > single) are emitted ahead of lower when both fire, so the richer label leads.

### 4.3 Home + evaluation point (where it lives, where it runs)

The evaluator is a **pure-TS model**, mirrored client + Edge exactly like the existing definitions (parity-tested). It hooks at the **read-time adapter layer**, which is the cleanest existing home:

- **Primary home:** a new pure-TS module `src/features/nodeLabels/observationMapping/observationMappingModel.ts` (client) with the byte-equal Edge mirror under `supabase/functions/_shared/booleanObservations/observationMapping/`. (Exact filenames are the BUILD card's call; this design fixes the *pattern* — pure-TS, mirrored, parity-tested, no React/Supabase/network import.)
- **Evaluation point:** **read time**, composed *after* `mapPersistedObservationRowsToNodeLabelMarks` collects the move's positive rawKeys, BEFORE `nodeLabelSourceAdapters` (Source 6) hands marks to presentation. The adapter already gathers exactly the positive-rawKey set the evaluator needs; the evaluator consumes that set and emits the richer composite marks. This keeps the 1:1 mark path intact (the existing per-rawKey marks can coexist or be superseded by the composite — Open Question §13c) and adds composites without any write-path change.
- **Why read-time, not write-time:** read-time evaluation means Track 1 needs **no Edge write change** and **no migration** — the booleans are already persisted; the evaluator is pure presentation. (A write-time pre-computation is possible later if a query/report workload justifies it; none does now — §6.)

### 4.4 Label-surfacing contract (via `toPlainLanguage`)

Every `observationCode` the evaluator emits MUST be routed through `gameCopy.toPlainLanguage` / `toPlainLanguageOrSuppress` before it reaches any user-facing string. Concretely:

- The build adds every adopted `observationCode` to the gameCopy catalog with a verdict-free plain-language mapping (the `labelNeutral` / `diagnosticSentence` register from the artifact).
- An `observationCode` with no gameCopy mapping is **suppressed** (the unmapped-code drop is the existing safety behavior — `toPlainLanguage` returns `null`). This means a rule cannot leak a raw code to the UI even if the registry contains it.
- The mapping-coverage test (test-discipline pattern) asserts every adopted `observationCode` has a non-null, snake-case-free gameCopy mapping.

### 4.5 Confidence as PIPS, not numbers

`confidenceWeight` is an INTERNAL ordering hint only. It is NEVER surfaced as a number, a percentage, or a "score." Where the UI shows confidence at all, it renders the existing `low|medium|high` band as **pips** (the established chrome posture), consistent with the per-rawKey confidence the adapter already carries. The evaluator does not invent a new numeric confidence surface.

### 4.6 Surface posture (carried from §9)

Each mark carries `card_default_visible` (card page loads + shows detail by default) and `timeline_tap_to_reveal` (timeline shows the same detail behind tap disclosure) — same data, different disclosure, consistent with CARD-VIEW-DETAIL-HUB-001 + CARD-VIEW-COMPARISON-POLISH. The evaluator preserves these per-rule flags; presentation honors them.

---

## 5. Boolean adoption table (Decision 2 — resolved)

### 5.1 The 8 adoption tests

Every adopted *new* boolean must pass all 8:

1. **Not derivable** — its value is not already computable from existing booleans.
2. **Enables a materially better label** — its presence unlocks a more specific verdict-free observation than the existing set can.
3. **Classifier-answerable yes/no** — the MCP server can answer it as a crisp boolean about the move.
4. **Improves reader understanding** — helps a reader understand the disagreement dynamics of the reply.
5. **Not a moderation/acceptance gate** — never blocks/routes; display-only.
6. **Fixture-testable** — a deterministic fixture can exercise it.
7. **Has a plain-language label** — verdict-free, routable through gameCopy.
8. **Has a clear absent-fallback** — its absence has a sensible display meaning (no row == not observed, never "author failed").

### 5.2 Adoption decision

**Track 1 (existing booleans):** all existing-family booleans already returnable by the classifier (`existing_or_planned_family_boolean` rows in the proposed CSV; ~89 of 134) are **already adopted** — they back the 1,268 no-migration mapping rows. Build 1 needs no boolean adoption, only the evaluator + the reviewed registry subset.

**Track 2 (new production-family booleans — ADOPT):** the 21 `proposed_new_boolean` rows across the 7 production families. The operator's named lean set is adopted; the remaining production-family proposals are adopted *if* they pass the 8 tests. Per-boolean below.

| # | Family (status) | New boolean (`proposed_new_boolean`) | Decision | 8-test note |
| --- | --- | --- | --- | --- |
| 1 | parent_relation (prod) | `acknowledges_parent_strength` | **Adopt** | not derivable; unlocks "preserves face before disagreeing" label; yes/no; display-only |
| 2 | parent_relation (prod) | `compares_parent_to_sibling_branch` | **Adopt (verify #3)** | enables topology-aware label; confirm classifier can answer reliably — Open Q candidate |
| 3 | parent_relation (prod) | `identifies_parent_scope_limit` | **Adopt** | unlocks scope-narrowing label; clear absent-fallback |
| 4 | disagreement_axis (prod) | `isolates_main_disagreement` *(operator lean)* | **Adopt** | high-value; "isolates exact disagreement point" label |
| 5 | disagreement_axis (prod) | `distinguishes_fact_value_disagreement` *(operator lean)* | **Adopt** | fact-vs-value is a materially better label; not derivable |
| 6 | disagreement_axis (prod) | `preserves_face_while_disagreeing` *(operator lean)* | **Adopt** | mitigation label; verdict-free; display-only |
| 7 | misunderstanding_repair (prod) | `offers_repair_path` | **Adopt** | repair-path label; yes/no; fixture-testable |
| 8 | misunderstanding_repair (prod) | `names_ambiguity_source` | **Adopt** | clarity-gap label; not derivable |
| 9 | misunderstanding_repair (prod) | `accepts_correction` | **Adopt** | mitigation label; clear absent-fallback |
| 10 | evidence_source_chain (prod) | `names_method_difference` *(operator lean)* | **Adopt** | method/measurement label; high-value evidence dynamic |
| 11 | evidence_source_chain (prod) | `separates_observation_from_inference` *(operator lean)* | **Adopt** | strong epistemic label; not derivable |
| 12 | evidence_source_chain (prod) | `flags_context_limit` *(operator lean)* | **Adopt** | applicability-limit label; uncertainty-related |
| 13 | argument_scheme (prod) | `linked_premise_structure` *(operator lean)* | **Adopt** | scheme-structure label; classifier-answerable |
| 14 | argument_scheme (prod) | `convergent_premise_structure` *(operator lean)* | **Adopt** | scheme-structure label; pairs with #13 |
| 15 | argument_scheme (prod) | `enthymeme_gap_detected` *(operator lean)* | **Adopt** | enthymeme-gap label; powers a strong cross-family rule |
| 16 | critical_question (prod) | `question_names_uncertainty` | **Adopt** | uncertainty-source label; yes/no |
| 17 | critical_question (prod) | `question_separates_claim_evidence` | **Adopt** | claim-vs-evidence label; not derivable |
| 18 | critical_question (prod) | `question_invites_revision` *(operator lean)* | **Adopt** | "invites revision not closure" — verdict-free; high-value |
| 19 | resolution_progress (prod) | `records_remaining_disagreement` *(operator lean)* | **Adopt** | resolution label; closes a real label gap |
| 20 | resolution_progress (prod) | `defines_next_evidence_needed` *(operator lean)* | **Adopt** | "what evidence next" label; actionable + verdict-free |
| 21 | resolution_progress (prod) | `separates_normative_from_empirical` *(operator lean)* | **Adopt** | normative-vs-empirical label; not derivable |

**HiTODS (18 booleans):** → **deferred to Decision 4 / Build 4** (`MCP-FAMILY-HITODS-DESIGN-001`). Not adopted here.

**Frozen H/I/J new booleans (6) — DEFER:** the 2 `claim_clarity` (`contains_absolute_quantifier`, `contains_vague_comparison`), 2 `thread_topology` (`timeline_card_mismatch_risk`, `branch_needs_room_grouping`), 2 `sensitive_composer` (`public_claim_about_protected_attribute`, `needs_private_composer_guidance_only`). These belong to families that are `productionEnabled:false`. They are **designed-but-deferred WITH their families** per the #471 readiness ledger — out of scope to design into them now.

### 5.3 Tally

- **Adopt (Track 2):** 21 production-family new booleans (subject to per-boolean 8-test pass; #2 flagged for classifier-reliability verification).
- **Already-adopted (Track 1):** the existing-family booleans backing the 1,268 no-migration rows (no adoption action needed).
- **Defer (HiTODS):** 18 → Build 4 / its own card.
- **Defer (frozen H/I/J):** 6 → with their families.
- **Total proposed_new_boolean accounted for:** 21 + 18 + 6 = 45. ✓ (matches the discovery tabulation).

---

## 6. Storage + GATE-A migration-plan reference (Decision 3 — resolved: NEAR-ZERO DDL)

**Verified finding:** the observation store is a **`raw_key`-row key-value model**. `argument_machine_observation_results` (migration `20260526000018`) stores **one row per positive observation**, keyed by the `raw_key TEXT` column, `UNIQUE (run_id, raw_key)`. A column COMMENT in that migration states verbatim: *"One of the 172 MCP-021A MachineObservationDefinition rawKeys. Unknown rawKeys are silently dropped by the adapter."* Therefore:

- **A new boolean = a new `raw_key` *string value* inserted as a row when the classifier returns it positive. This needs NO DDL.** The table already accepts any rawKey string; the adapter gates on registry membership at read time.
- **No migration is required for boolean-answer storage** in either track. The discovery brief's reconciliation is confirmed: the artifact's `schema_action = requires_sql_or_json_schema_extension` flag means *the boolean itself is new* (needs a definition + MCP prompt), **not** that a DDL change is required.

What a new boolean actually requires (all **code**, no DDL):

1. A new `MachineObservationDefinition` in BOTH mirror files (client + Edge) + parity test.
2. A schema-version bump — a single **constant** (`MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION`), code only.
3. The MCP server answering the new question — **mcp-server prompt** code (`mcp-server/**`).
4. For a NEW family only: a frozen `FAMILY_REGISTRY` entry (`productionEnabled:false`) — code only.

**JSON-keys-first posture:** the equivalent of "JSON keys first, promote to columns only if a workload justifies it" is **already realized** by the raw_key-row model — each rawKey is effectively a key in a key-value store. There is **no named query/filter/report workload** today that requires promoting any rawKey to a typed column. If one ever arises (e.g. an admin report that filters by a specific boolean at scale), THAT is a future, separately-gated, additive/nullable/no-backfill migration — not this card.

Full DDL posture, rollback, MCP-prompt expansion, and the merge=deploy note are in the companion **`MCP-OBSERVATION-MAPPING-REFACTOR-DESIGN-001-migration-plan.md`**. Headline: **DDL needed: NO** (for both tracks' answer storage).

---

## 7. HiTODS family recommendation (Decision 4 — resolved)

The new `disagreement_strategy_hitods` family is the doctrine crux. Its 18 booleans include face-attack / aggression observations: `name_calling`, `blatant_aggressive_denial`, `ordering_or_commanding`, `ironic_echoing`, `irrelevancy_claim`, `tone_response_without_substance`. **Recommendation (binding on Build 4):**

- **(a) Frozen-by-default.** The family ships as an 11th `FamilyRegistryEntry` with `productionEnabled:false` (exactly like H/I/J) and `adminValidationEnabled:true`. It is enabled to production ONLY via the cutover-gate criteria (`docs/designs/OPS-MCP-CUTOVER-GATE-CRITERIA-CONSOLIDATION.md`) in a *separate* operator-gated enablement card. **This card never enables it. Build 4 never enables it.**
- **(b) Move-level, never author-level.** Every observation is about the MOVE/REPLY ("this reply may shift attention from the argument to the person or social friction" — the artifact's `name_calling` `labelNeutral` register, confirmed in §8.2), NEVER about the author. The artifact's register already does this correctly; Build 4 preserves it verbatim and tests it.
- **(c) Its OWN dedicated P4-doctrine-reviewed build card** — `MCP-FAMILY-HITODS-DESIGN-001` — modeled on the J-family deepen card (#473). It is NOT folded into the general schema-expansion build (Build 2). The aggression booleans get their own doctrine review precisely because the face-attack surface is where a verdict/author-label could most easily creep in.
- **(d) Explicitly NOT a moderation surface.** The labels help a *reader* understand the disagreement DYNAMICS of a reply. They are not a "report this user" affordance, not a takedown signal, not a strike. Any future "act on this" affordance (e.g. a composer-only "consider rephrasing" nudge) is **separately scoped and out of bounds** for both this card and Build 4. §10a non-exposure applies: no moderation-reason label is surfaced.

Until Build 4 ships AND a separate enablement card flips it on after the cutover gate, the HiTODS family produces **zero production traffic** — it exists only in `admin_validation` mode (filtered out of production Source 6 rendering at the persistence-query layer, exactly as H/I/J are today).

---

## 8. CSV adoption + review pass (Decision 5 — resolved: reviewed subset, checked-in declarative data)

### 8.1 Posture

The 2,383-row CSV is a **CANDIDATE source, not a production file.** The registry is **seeded from a REVIEWED subset**, stored as a **checked-in declarative data file** (TS/JSON the evaluator reads), NOT a wholesale import of the raw CSV and NOT generated at runtime from the CSV.

- **Build 1 seeds:** the **1,268** `fits_existing_or_planned_boolean_answers` rows (the no-migration universe), each individually reviewed.
- **Build 3 seeds:** the new-boolean rows (from the 1,115 `requires_sql_or_json_schema_extension`) that reference *adopted* production-family booleans (§5) — **only after** Build 2's booleans land (GATE A boolean adoption complete). HiTODS rows are excluded (they belong to Build 4). Frozen H/I/J rows are excluded (deferred with families).

### 8.2 The review pass (per adopted row, mechanical + human)

Each adopted row must pass, before it enters the checked-in registry:

1. **Verdict-free labels.** `labelShort`, `labelNeutral`, `diagnosticSentence` contain none of the banned tokens (winner/loser/correct/true/false/liar/dishonest/bad faith/manipulative/extremist/propagandist/stupid/idiot, plus "is correct"/"is true"/"this person is"/"this user is"). **Verified across the full 2,383-row artifact in Phase 0: zero banned tokens found** — the artifact's register is clean (the 7 `labelNeutral` values are all move-pattern descriptions: "Reasoned disagreement", "Unsupported or lightly supported disagreement", "Person-directed or face-threatening disagreement pattern", etc.). The build's review pass re-runs this scan as a test.
2. **`safety_note` present.** Every row carries the no-block/reject/suppress/route/delay note. **Verified: all 2,383 rows carry it.**
3. **Cross-family author-labeling check.** The 10 `cross_family` rows are checked individually for any author-labeling. **One row needs remediation:** `cross_family.2379` has `labelShort = "Name-calling / ad hominem cluster"` — "ad hominem" is acceptable as a theory term in `graham_dh_label` but **must not** be the user-facing `labelShort`. The review pass re-registers this row's user-facing label through gameCopy with a verdict-free, move-level phrasing (e.g. "Person-directed pattern with stated reasons absent") and confirms the `observationCode` maps to that plain-language string, not the raw "ad hominem" wording. This is exactly the kind of theory-vocabulary leak the review pass exists to catch. (Note: this row is HiTODS-adjacent — it combines `disagreement_strategy_hitods.name_calling`; it therefore lands in Build 4, not Build 1/3, and Build 4's P4 doctrine review owns it.)
4. **Theory labels stay internal.** `graham_dh_level` / `graham_dh_label` / `hitods_alignment` / `walton_scheme_alignment` are INTERNAL metadata for the rule, never surfaced raw to users — only the gameCopy-mapped plain-language label is shown.
5. **Code → label routability.** The row's `observationCode` resolves through `toPlainLanguage` to a non-null, snake-case-free string (or it is suppressed).

### 8.3 How the review gate works

- The reviewed subset is committed as a declarative data file in the BUILD card's PR. The PR's test suite includes the verdict-free scan, the safety_note-presence assertion, and the cross-family author-label check as **automated tests** over the committed registry (not over the raw CSV). A row cannot enter the registry without passing.
- The raw CSV stays under `docs/designs/mcp-observation-mapping/` as the candidate/provenance source. It is never read at runtime.

---

## 9. Surface posture (Decision — card-default-visible / timeline-tap-to-reveal)

Carried from doctrine §7 and the artifact's surface rule, consistent with CARD-VIEW-DETAIL-HUB-001 (ratified) + CARD-VIEW-COMPARISON-POLISH:

- **Card page:** observation detail is loaded and **visible by default** (the "what the referee noticed — advisory, not a verdict" strip in `CardDetailPanel` / `cardClassifierStripModel`).
- **Timeline page:** the **same** detail is available behind **tap-to-reveal** disclosure (the timeline node stays uncluttered; tapping reveals the strip).
- Same data, different disclosure. The evaluator preserves each rule's `cardSurfaceVisibility` / `timelineSurfaceVisibility` flags; presentation honors them. No new visual node state is introduced (per timeline-grammar — this is chrome/detail, not a new node shape/strength/heat encoding), so no new token-table entry is needed.
- Accessibility: the detail strip and any tap-to-reveal control follow the existing `accessibilityRole`/`accessibilityLabel`/44×44 hit-area posture already used by the node-label strip. No truth/judgment language enters any label.

---

## 10. Test forecast (per build)

**Build 1 (`MCP-OBSERVATION-MAPPING-EXPANSION-001` — evaluator + reviewed registry over existing booleans):**
- `__tests__/observationMappingModel.test.ts` — evaluator unit tests: singles → label, negatives (absent rawKey) → label, pairs (true_true / true_false / false_true) → label, curated triples → label. Happy path + each rule_kind.
- `__tests__/observationMappingModel.test.ts` (cont.) — empty positive set → `[]`; unknown rawKey in set → ignored; deterministic ordering by displayPriority then mappingId.
- `__tests__/observationMappingRegistry.parity.test.ts` — client registry ≡ Edge mirror (byte-equal logic), matching the existing `machineObservationRegistry.test.ts` parity pattern.
- `__tests__/observationMappingVerdictFree.test.ts` — ban-list scan over every emitted label + every registry row's labelShort/labelNeutral/diagnosticSentence (no winner/loser/true/false/liar/etc.); no-author-label scan ("this person/user is").
- `__tests__/observationMappingPlainLanguage.test.ts` — every adopted `observationCode` resolves through `toPlainLanguage` to a non-null, snake-case-free string; unmapped codes suppressed.
- `__tests__/observationMappingNoSuppression.test.ts` — the evaluator's output type contains no block/route/suppress/delay field; a fixture asserts the function returns only display marks.
- `__tests__/observationMappingPostStorageOnly.test.ts` — assertion that the evaluator is never imported by `engine.ts` / the submit path (import-graph / grep guard), and runs only after `mapPersistedObservationRowsToNodeLabelMarks`.
- `__tests__/observationMappingNoModerationLeak.test.ts` — §10a leak test: no `inactive_reason` / moderation-reason label appears in any emitted mark.

**Build 2 (`MCP-BOOLEAN-SCHEMA-EXPANSION-001` — adopted new production booleans + MCP prompts + schema-version bump):**
- definition parity tests (client ≡ Edge) for each new boolean.
- schema-version-bump test (constant changed; old version rows still read under the matched-version filter).
- new-boolean fixture tests: the classifier-answerable yes/no shape; a fixture move that should trigger each new boolean.
- migration test: **assert NO DDL is added for answer storage** (the migration plan's "no migration" finding is encoded as a test that the BUILD adds no new column to the results table). If the build discovers a real workload need, the additive/nullable/no-backfill posture is tested instead.
- a post-storage-only assertion + verdict-free scan over the new booleans' labels.

**Build 3 (mapping extension to the new booleans):**
- evaluator tests for the new pairs/triples/cross-family rules the adopted booleans unlock.
- registry review-pass tests (verdict-free, safety_note present, cross-family author-label check) over the newly-seeded rows.

**Build 4 (`MCP-FAMILY-HITODS-DESIGN-001` — its own design, then a build):**
- `familyK.ts` client↔Edge parity test.
- `FAMILY_REGISTRY` entry presence test asserting `productionEnabled:false`.
- **HiTODS move-level-not-author fixtures** — every HiTODS label asserts move-level phrasing ("this reply…"), never author-level ("this person…"); ban-list scan with the face-attack vocabulary explicitly included.
- frozen-by-default test: the family produces zero production-mode marks; admin_validation only.
- the cross-family.2379 remediation test (verdict-free re-register of the "ad hominem cluster" label).

---

## 11. Adversarial-check set (for every build this card sequences)

A reviewer runs each of these against the BUILD PR:

1. **Acceptance-gate post-storage-only** — `engine.ts` unchanged; the evaluator/booleans never appear in the submit/acceptance path; classification stays post-storage.
2. **No suppression / routing / `productionEnabled` flip** — no family flipped to production; no routing armed; no percentage raised; the registry/evaluator emits no gate signal.
3. **Display-only, never author-label, never verdict** — ban-list scan over every emitted label + registry row passes; no "this person/user is X"; no winner/loser/true/false/correct.
4. **HiTODS frozen-by-default + move-level** — (Build 4) `productionEnabled:false`; zero production marks; every label move-level; aggression booleans reviewed under P4 doctrine.
5. **Frozen H/I/J untouched** — claim_clarity/thread_topology/sensitive_composer stay `productionEnabled:false`; their 6 new booleans not designed in.
6. **§10a non-exposure** — no `inactive_reason` / moderation-reason label surfaced anywhere.
7. **Labels via `toPlainLanguage`** — every `observationCode` routes through gameCopy; unmapped codes suppressed, never echoed; no snake_case leak.
8. **Confidence as pips, not numbers** — no numeric confidence/score surfaced; `confidenceWeight` stays internal; only `low|medium|high` pips render.
9. **Migration additive/nullable/no-backfill (or none)** — Build 2's migration plan's "no DDL" finding holds, OR any real DDL is additive, nullable, no-backfill, and reviewed under migration-bearing-card heightened verification (roadmap-reviewer §"Migration-bearing card verification").
10. **THR-4** — text/copy review: the verdict-free register holds in rendered strings (not just registry data); the "advisory, not a verdict" framing is present on the detail strip.

---

## 12. Sequencing (the 4 build cards)

1. **Build 1 — `MCP-OBSERVATION-MAPPING-EXPANSION-001`** (normal gate; no `supabase/**`, no `mcp-server/**`, no migration). The evaluator + the reviewed ~1,268-row existing-boolean registry → richer labels NOW. Pure-TS model + mirror + presentation wiring. Highest value-to-risk ratio; ships first.
2. **Build 2 — `MCP-BOOLEAN-SCHEMA-EXPANSION-001`** (`supabase/**` + `mcp-server/**` → merge=deploy GATE C). The 21 adopted new production-family booleans: new definitions (both mirrors), schema-version bump constant, MCP-server prompts. **No DDL for answer storage** (per §6 / migration plan). Heightened verification because it touches the deploy chain.
3. **Build 3 — mapping extension to the new booleans** (normal gate). Seeds the new-boolean mapping rows into the registry; adds the pairs/triples/cross-family rules the adopted booleans unlock. Depends on Build 2 landing.
4. **Build 4 — `MCP-FAMILY-HITODS-DESIGN-001`** (P4 doctrine design, then a separately-gated build + a still-separate enablement card). The new `disagreement_strategy_hitods` family, frozen-by-default, move-level, not a moderation surface. Owns the cross-family.2379 remediation. Never enabled by this chain.

Each build re-runs typecheck + lint + the full test suite (test count goes up, never down) and updates `docs/core/current-status.md` with the confirmed count.

---

## 13. Open Questions for the operator (each with a recommendation)

**(a) Genre-taxonomy coordination (cross-card hygiene).** The user-facing `startArgumentTaxonomy.ts` (NAV-START-ARGUMENT-001) ships Walton schemes + a verified HiTODS subset + disagreement causes, and the machine families draw on the same Walton/HiTODS/Graham theory — but **no shared concept-vocabulary source-of-truth exists**. *Recommendation:* establish a small doctrine doc `docs/core/CLASSIFICATION-THEORY-SCHEMA.md` that defines the verified Walton/HiTODS/Graham concept set ONCE, referenced by both the genre taxonomy and the machine families, so they don't drift. Non-blocking; can be its own tiny card sequenced before Build 4 (which adds the full HiTODS 18). Flag for operator: do this now, or accept the drift risk and note it as a constraint on Build 4?

**(b) `compares_parent_to_sibling_branch` adopt-bubble (boolean #2 in §5.2).** This new boolean requires the classifier to reason across *sibling branches*, not just the parent — a harder, less-reliable yes/no than the others. *Recommendation:* adopt it but flag it for a classifier-reliability check in Build 2; if the MCP server cannot answer it with adequate precision in admin_validation, **defer it** rather than ship a noisy label. Operator: accept this conditional adoption, or pre-defer it?

**(c) Registry-as-data vs composite-supersedes-singles.** The evaluator can either (i) emit composite marks *in addition to* the existing per-rawKey 1:1 marks, or (ii) have composites *supersede* the singles they subsume (to avoid showing both "References the parent claim" and "Central-point refutation with claim-matched evidence" on the same move). *Recommendation:* (ii) — composites supersede the singles whose rawKeys they fully consume, ordered by specificity (triple > pair > single), to keep the strip uncluttered; the singles still render when no composite consumes them. This is a presentation rule, fixture-testable in Build 1. Operator: confirm supersede semantics, or prefer additive?

---

## 14. Non-goals (explicit)

- **No migration applied** (this is GATE A — design + plan only; no `supabase/**` file authored).
- **No production code** (no `src/**`, `app/**`, `supabase/**`, `mcp-server/**`, `__tests__/**` — only the three design docs).
- **No H/I/J advancement** — the frozen families stay `productionEnabled:false`; their 6 new booleans are not designed in.
- **No moderation surface** — no "act on this" / report / strike affordance for any observation, HiTODS included.
- **No routing arm, no percentage ramp, no `productionEnabled` flip** of any family.
- **No wholesale CSV import** — only a reviewed subset, seeded as checked-in declarative data.
- **No genre / nav / Start-Argument work** — `startArgumentTaxonomy.ts` is untouched (coordination is Open Question (a) only).
- **No new visual node state** — the surface posture is chrome/detail disclosure, not a new timeline-grammar node shape/strength/heat encoding.
- **No HiTODS family build** here — that is Build 4 (`MCP-FAMILY-HITODS-DESIGN-001`), its own card.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels):** every label in the artifact register and every evaluator output is a move-pattern description, never a truth/winner/loser claim. Phase 0 ban-list scan over all 2,383 rows: zero banned tokens. ✓
- **cdiscourse-doctrine §1 (score never blocks posting):** the evaluator runs post-storage at read time; `engine.ts` stays the sole gate; the evaluator emits no gate signal. ✓
- **cdiscourse-doctrine §3 (popularity is not evidence):** the store + evaluator have no engagement/view/follower input (the migration COMMENT confirms the schema has no such columns); the mapping never grants standing from amplification. ✓
- **cdiscourse-doctrine §4 (AI moderator limits):** observations are advisory, `authoritative:false`, never decide right/wrong, never auto-modify content; MCP classification runs only in the Edge/MCP layer, never the client. ✓
- **cdiscourse-doctrine §9 (plain language):** every `observationCode` routes through `toPlainLanguage`; unmapped codes suppressed. ✓
- **cdiscourse-doctrine §10a (Observations vs Allegations):** all mapping output is `machine_observation` (source: machine), about the MOVE; no raw classifier IDs surfaced; sensitive HiTODS observations fenced to Build 4 with move-level-not-author tests. ✓
- **supabase-edge-contract (migration discipline):** no migration authored; the verified raw_key-row model means no DDL for answer storage; any future column promotion is additive/nullable/no-backfill + separately gated. No service-role in client; MCP writes stay service-role-in-Edge. RLS untouched. ✓
- **test-discipline:** per-build test forecast (§10) covers evaluator units, parity, verdict-free/no-author scan, post-storage-only, §10a leak, migration shape, HiTODS move-level fixtures. ✓
- **timeline-grammar:** no new node shape/strength/heat encoding; surface posture is detail-strip disclosure only; labels carry no truth/judgment language; card-default-visible / timeline-tap-to-reveal. ✓

---

## Operator steps (if any)

**None for this card** — it is design-only (three docs). The operator approves the migration plan (which concludes **no DDL**) and the boolean adoption set, then the build cards proceed. The merge=deploy step (`npx supabase functions deploy …` / the auto-deploy of registered Edge Functions on merge) applies **only when Build 2 lands** — never this design card. See the companion migration plan for the precise operator note.
