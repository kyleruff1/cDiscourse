# OPS-MCP-OBSERVABILITY-FAMILY-HI-COVERAGE — combined observability backfill (Family H + Family I)

**Status:** Design draft
**Epic:** Observability / MCP classifier telemetry (ops tooling; not a product epic)
**Release:** Operability backlog (umbrella issue #388)
**Issues:** #396 (Family H coverage) + #397 (Family I coverage)
**Intents:** `docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-H-COVERAGE-intent.md` · `docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-I-COVERAGE-intent.md`
**Predecessors merged + smoke PASS:** Family H production-enabled (PR #559, audit `docs/audits/MCP-021C-EDGE-FAMILY-H-ENABLE-SMOKE-2026-06-10.md`); Family I production-enabled (PR #562, audit `docs/audits/MCP-021C-EDGE-FAMILY-I-ENABLE-SMOKE-2026-06-10.md`).
**Live roster at design time:** A–I = 9 production families.
**Branch / base:** `feat/ops-observability-family-hi-coverage` from main `3f9650a`.

> This is a single combined lane shipping two cards in sequence (H first, then I). The doc is sectioned per card. H and I are independent edits except that I depends on H's Q14 SECTIONS-question count-word state (see §HI-3 chain protocol). The implementer SHOULD land H as one commit and I as a second commit so each card's gates are independently green; a single combined commit is acceptable if both cards' tests pass together.

---

## 0. Goal (one paragraph)

The per-family observability SQL set in `scripts/ops/sql/` lets the operator inspect the MCP boolean-classifier telemetry (`argument_machine_observation_runs` + `argument_machine_observation_results`) per family and per run_mode. Families A–G already have coverage; H (`claim_clarity`) and I (`thread_topology`) are now production-enabled but invisible in the per-family signal-density (Q14) and coverage (Q11) queries, and I's mixed-source Subset has no leak-detection query. This card backfills both. **All work is read-only operator tooling**: SQL `SELECT`s, a runner manifest (`SECTIONS`) entry, a fixture, the runbook, and tests. No runtime code, no migration, no Edge change, no service-role, no taxonomy change. Per `cdiscourse-doctrine` §1/§3/§10a the queries surface aggregate counts and machine-taxonomy `raw_key` strings only — never a verdict about a person, a move, or a claim; H's clarity keys are DESCRIPTIVE FORMULATION-STATE and I's topology keys are DESCRIPTIVE STRUCTURE, never standing penalties.

---

## 0.1 — Resolution of the three `[OPERATOR DECISION NEEDED]` markers (precedent-derived)

The operator authorized precedent-following. All three markers resolve cleanly from the codebase; none required orchestrator invention. Evidence is cited with `file:line`.

### Marker (a) — H: which Q files get an H variant?

**Resolved: NO new SQL file for H. H gets Q11 narrative + Q14 CASE edits only.**

The precedent rule, derived from what D/E/F/G actually did, is:

- A family gets a dedicated `NN-family-x-subset-coverage.sql` leak-detection file **if and only if it is a mixed-source / Subset family** — i.e., it has a `FAMILY_X_EXCLUDED_DETERMINISTIC_RAW_KEYS` constant (only a subset of its taxonomy is routed through the ai_classifier/MCP path; the rest are deterministic and could "leak").
  - Family D (mixed-source) → `scripts/ops/sql/15-family-d-subset-coverage.sql` (added by the D card, #334).
  - Family G (mixed-source) → `scripts/ops/sql/16-family-g-subset-coverage.sql` (added by the G card, #401).
- A **uniform / single-source family** (all keys `ai_classifier`, no exclusion constant) gets **no dedicated file** — only the Q11 header-narrative bullet + the Q14 hardcoded-CASE branch.
  - Family E (`argument_scheme`, uniform) and Family F (`critical_question`, uniform) were folded into the Q14 CASE by `MCP-BUILD2e` (#542) and `MCP-BUILD2f` (#543) with **no dedicated SQL file**.

Family H is **UNIFORM** ai_classifier: `mcp-server/lib/familyHKeys.ts:16-17` states "**No `FAMILY_H_EXCLUDED_DETERMINISTIC_RAW_KEYS` constant** (no exclusions; uniform source mirrors the E + F precedent)." Therefore H follows the E/F precedent: Q11 narrative + Q14 CASE branch (`when 'claim_clarity' then 12`), **no `17-family-h-...sql`**.

### Marker (b) — test-count forecast

**Resolved (refined from the codebase, FLAGGING a deviation from the intent's lower bound — see §HI-5).**

- The shipped G coverage test (`__tests__/opsMcpObservabilityFamilyGCoverage.test.ts`) has ~31 tests across 6 groups (A–F). G is mixed-source (new file + fixture + section-count).
- **H is uniform** → its test has no Group C (no Q-file), no Group D section-count delta, no Group E fixture key. Realistic H delta: **+14 to +26** (Group A Q11 ~4, Group B Q14 ~5, doctrine self-check ~4, no-new-file guard ~1; the implementer lands near the top of the band by expanding per-key verbatim assertions or near the bottom by consolidating into one iterating test). NOTE: this is **below** the intent's "+20 to +50" forecast because the intent (authored 2026-05-31, before H's uniform source was settled) assumed H might be mixed-source. See §HI-5 R1.
- **I is mixed-source** → full G-shape (Groups A–F): **+28 to +36**.
- **Combined H+I net new tests: +42 to +62.** Edits to existing test files (count pins) are net-zero. The implementer SHOULD consolidate to keep the combined delta at or under **+60** (the chain-prompt HALT-15 ceiling, see §HI-4); if per-key expansion pushes over, consolidate the I Group C key assertions into single iterating tests (the G test already does this at `opsMcpObservabilityFamilyGCoverage.test.ts:302-320`).

### Marker (c) — I: is a source-mode breakdown needed for the mixed-source family?

**Resolved: NO 3-way source-mode breakdown. I mirrors the Family D 2-way `subset_membership` precedent.**

Family D is the named mixed-source precedent. Its subset-coverage SQL `scripts/ops/sql/15-family-d-subset-coverage.sql:66-109` classifies every observed key into a **2-way** `subset_membership` CASE — `'ai_classifier_subset'` (the 22 routed keys) vs `'deterministic_excluded_leak'` (the 8 excluded keys, grouped regardless of whether they are `auto_metadata` or `lifecycle`) vs `'unknown_key_outside_taxonomy'`. It does **not** emit a separate `auto_metadata`-vs-`lifecycle` source-mode column; the auto_metadata/lifecycle split is documented in the SQL **header comment** (`15-family-d-subset-coverage.sql:15-20`) only. Family G's file does the same (`16-family-g-subset-coverage.sql:78-128`).

So D set the no-source-mode-breakdown precedent and I follows it: I's `17-family-i-subset-coverage.sql` uses the identical 2-way classification — `ai_classifier_subset` = the 6 routed keys, `deterministic_excluded_leak` = all 15 excluded keys (8 `auto_metadata` + 7 `lifecycle`, named in the header comment but bucketed together in the CASE), `unknown_key_outside_taxonomy` = everything else. The 8/7 split is descriptive header context, not a query dimension.

> **Asymmetry note (observability-relevant, not a scope change):** unlike D (22 of 30 routed) and G (21 of 33 routed), Family I routes only the **minority** of its keys (6 of 21). 15 keys are deterministic-excluded. The leak-detection query is therefore *more* load-bearing for I — a misrouted deterministic key has a 15/21 chance of being one of the excluded set. The header comment should call this out.

---

## 1. Data model

**No new data model.** No migration, no new table, no new column, no taxonomy key. The queries read the existing two tables:

- `public.argument_machine_observation_runs` (columns used: `id`, `run_mode`, `requested_families`, `status`)
- `public.argument_machine_observation_results` (columns used: `run_id`, `family`, `raw_key`, `argument_id`)

The `family` enum values for the two new families (confirmed in `mcp-server/lib/familyRegistryInit.ts:173` and `:197`):

| Family | `family` enum value | Source profile | ai_classifier Subset size | Excluded deterministic |
| --- | --- | --- | --- | --- |
| H | `claim_clarity` | UNIFORM ai_classifier | 12 (all keys) | none (no exclusion constant) |
| I | `thread_topology` | MIXED Subset | 6 | 15 (8 auto_metadata + 7 lifecycle) |

### Family H — 12 ai_classifier keys (verbatim, declaration order)

Source of truth: `mcp-server/lib/familyHKeys.ts:86-99` (`FAMILY_H_RAW_KEYS`).

```
provides_temporal_constraint, claim_present, reason_present, conclusion_missing,
reason_missing, multiple_claims_present, claim_specificity_high, claim_specificity_low,
quantifier_present, modal_language_present, hedging_present, unclear_reference_present
```

### Family I — 6 ai_classifier keys (verbatim, declaration order)

Source of truth: `mcp-server/lib/familyIKeys.ts:92-99` (`FAMILY_I_RAW_KEYS`).

```
introduces_new_issue, references_prior_agreement, introduces_sub_axis,
returns_to_prior_issue, references_external_context, compares_options
```

### Family I — 15 deterministic-excluded keys (verbatim, declaration order)

Source of truth: `mcp-server/lib/familyIKeys.ts:117-135` (`FAMILY_I_EXCLUDED_DETERMINISTIC_RAW_KEYS`). All 21 I strings are unique within the family (no name-pair collision, unlike G), so included(6) + excluded(15) are disjoint and union to 21 (`familyIKeys.ts:113-115`).

```
auto_metadata (8): has_reply, participant_skipped_node, no_response_after_n_turns,
                   repeated_axis_pressure, splits_thread, merges_thread,
                   references_sibling_node, references_ancestor_node
lifecycle (7):     open, answered, moved_on_by_affirmative, moved_on_by_negative,
                   ignored_by_affirmative, ignored_by_negative, ignored_by_both
```

---

## 2. Current state (pre-launch reality audit)

Verified against main `3f9650a`. The HI cards must be designed against this CURRENT state, not the (now-stale) state described in the G design doc.

| Surface | Current state at `3f9650a` | Note |
| --- | --- | --- |
| `scripts/ops/sql/*.sql` count | **17** (`01`–`16`, incl. `02b`) | flat dir; no nesting; recursive `scripts/ops/**/*.sql` is also 17 |
| `report-lib.cjs` `SECTIONS.length` | **17** (`q01`…`q16` incl. `q02b`) | dumped live via the runner lib |
| Q14 hardcoded CASE | **A=19, B=17, C=20, D=22, E=19, F=17, G=21, else 0** | E/F already present (added by `MCP-BUILD2e/f`); counts are post-BUILD2 |
| Q14 SECTIONS question text | `"…across all five Subset-backfilled families (A, B, C, D, G)…"` | **STALE**: omits E/F though both are in the CASE (see §HI-5 R2) |
| Q11 SQL header narrative | lists A/B/C/D/G; line "Families E, F, H-J: … H Card-1 admin_validation; I, J unsupported" | **STALE**: H + I are now production-enabled |
| Runbook intro (`docs/ops/OPS-MCP-OBSERVABILITY.md:11,13`) | "runs **17** SQL queries", "answering **16** telemetry questions" | the literal count strings |
| Runbook Q6 narrative (`:138-142`) | "84 supported raw_keys (A=16, B=14, C=17, D=19, G=18). Family E (16), F (14), H (12) … queued" | **PRE-BUILD2 STALE** for A–G counts; see §HI-5 R3 (out of HI scope to fully fix) |
| `manifest.json` | **does not exist** | the "manifest" in the intent = the `SECTIONS` array in `report-lib.cjs` + the runbook prose. There is no literal "N production families" string to find-replace. See §HI-5 R2. |

**Reality-audit conclusions:**
1. The intent's "7→8→9 production families" is **conceptual**, not a literal string. The concrete count strings that exist are: the runbook intro `17 SQL queries` / `16 telemetry questions`, and the Q14 SECTIONS-question count word. There is no `manifest.json`.
2. The Q14 SECTIONS question already drifted (omits E/F). The HI cards correct it to the true roster while adding H and I. This is flagged for operator review (§HI-5 R2), but it is in-scope because the cards are editing that exact string.
3. H adds **no** SQL file and **no** SECTIONS entry → it does NOT move the `17` counts. **Only the I card moves 17→18.**

---

## 3. File changes

### CARD H — Family H (`claim_clarity`), uniform, no new file

**Modified**

- `scripts/ops/sql/11-per-family-per-mode-coverage.sql` — **header comment only; SQL body byte-equal.** Add a `claim_clarity` bullet to the family list; update the "Families E, F, H-J" operator-note line to reflect H production-enabled. (~3-5 comment lines.)
- `scripts/ops/sql/14-per-family-per-mode-signal-density.sql` — header comment table gains a `claim_clarity 12 mcp-server/lib/familyHKeys.ts:86 (uniform; 12 ai_classifier)` row + a second source-of-truth citation to this design; CASE expression gains exactly one branch `when 'claim_clarity' then 12` placed in family-letter order (after `'critical_question' then 17`, before `'resolution_progress' then 21`). (~6-8 lines.)
- `scripts/ops/mcp-observability-report-lib.cjs` — update the `q14-per-family-per-mode-signal-density` SECTIONS `question` string: count word `five`→`eight` and enumerate the true roster `(A, B, C, D, E, F, G, H)` (corrects the E/F drift). No new SECTIONS entry. (~1 line.)
- `__tests__/opsMcpObservabilityFamilyGCoverage.test.ts` — refactor the Group B Q14-question canary (line ~266, currently `expect(q14?.question.toLowerCase()).toContain('five')`) to a **stable** comma-letter-entry assertion `expect(q14?.question).toContain(', G')` so it no longer breaks when the count word moves (recommended; see §HI-5 R2). (~1-2 lines.)

**New**

- `__tests__/opsMcpObservabilityFamilyHCoverage.test.ts` — see §6. (~180-260 lines, +14 to +26 tests.)

**Not touched by H:** no fixture (H adds no section/row requirement), no `.sql` count pins (count unchanged at 17), no new SQL file.

### CARD I — Family I (`thread_topology`), mixed-source, new subset file

**Modified**

- `scripts/ops/sql/11-per-family-per-mode-coverage.sql` — header comment only; SQL body byte-equal. Add a `thread_topology` bullet (note "6-key ai_classifier Subset; 15 deterministic excluded"); update the operator-note line to reflect I production-enabled. (~3-5 comment lines.)
- `scripts/ops/sql/14-per-family-per-mode-signal-density.sql` — header table gains `thread_topology 6 mcp-server/lib/familyIKeys.ts:92 (Subset; 15 deterministic excluded)` row; CASE gains `when 'thread_topology' then 6` (after the `claim_clarity` branch, before `else 0`). (~6-8 lines.)
- `scripts/ops/mcp-observability-report-lib.cjs` — (1) append the `q17-family-i-subset-coverage` SECTIONS entry (see §5); (2) update the Q14 question count word `eight`→`nine` and enumeration `(A, B, C, D, E, F, G, H, I)`. (~14-18 lines.)
- `__tests__/fixtures/opsMcpObservabilityFixture.ts` — add `q17-family-i-subset-coverage` key to `FIXTURE_SECTIONS_DATA` (1-2 healthy `ai_classifier_subset` sample rows) and to `FIXTURE_EMPTY_SECTIONS_DATA` (`Object.freeze([])`). Optionally add a `thread_topology` row to the Q11/Q14 fixtures for cross-section invariants. (~10-20 lines.)
- `docs/ops/OPS-MCP-OBSERVABILITY.md` — intro counts `17`→`18` SQL queries and `16`→`17` telemetry questions (line 11, 13); add the H + I roster bullets to the Q6 narrative; add a Q17 section description mirroring the existing Q15/Q16 descriptions. (~25-45 lines.)
- `docs/core/current-status.md` — one-line note + updated test count after both cards (confirmed from a captured `npm test` line, per `test-discipline`).
- **Count-pin edits (I card only; 17→18):**
  - `__tests__/opsMcpObservabilitySqlSafety.test.ts:58-59` — `discovers all 17 SQL files` → 18; `expect(FILES.length).toBe(17)` → `toBe(18)`.
  - `__tests__/opsMcpObservabilityReportShape.test.ts:58-59` (`SECTIONS).toHaveLength(17)`→18), `:62` id list append `'q17-family-i-subset-coverage'`, `:107` "all 17 section links"→18, `:168` (`json.sections).toHaveLength(17)`→18.
  - `__tests__/opsMcpObservabilityEmptyDbSafety.test.ts:50,93,95` — title text "17"→"18" and `json.sections.length).toBe(17)`→18.
  - `__tests__/opsMcpObservabilityNoServiceRoleNoSecrets.test.ts:74-81` — `sqlFiles.length).toBe(17)`→18; `toBeGreaterThanOrEqual(19)`→`(20)`.
  - `__tests__/opsMcpObservabilityFamilyDCoverage.test.ts:443-445` — `SECTIONS).length).toBe(17)`→18; `:448` id list append `q17`.
  - `__tests__/opsMcpObservabilityFamilyGCoverage.test.ts:405-407` (`SECTIONS).length).toBe(17)`→18), `:410-431` id list append `q17`, `:560,569` `json.sections` 17→18; and bump the H-card-refactored Q14 canary if the H card used the count word (the recommended `', G'` refactor makes this a no-op).
  - `__tests__/opsMcpObservabilityFamilyHCoverage.test.ts` (just shipped by card H) — if H asserted the Q14 count word `eight`, update to `nine`; the recommended stable canary (`', H'`) makes this a no-op.

**New**

- `scripts/ops/sql/17-family-i-subset-coverage.sql` — see §4. (~140 lines, mirror of Q16.)
- `__tests__/opsMcpObservabilityFamilyICoverage.test.ts` — see §6. (~560-600 lines, +28 to +36 tests.)

---

## 4. The new SQL file — `scripts/ops/sql/17-family-i-subset-coverage.sql`

Structural mirror of `scripts/ops/sql/16-family-g-subset-coverage.sql`. Substitute Family I content. Required shape:

- **Header comment** documenting the **6-vs-21 distinction**: `thread_topology` has 21 entries in the upstream taxonomy (`src/features/nodeLabels/machineObservationDefinitions/familyI.ts`); only **6** are `ai_classifier`-source (the Subset routed to MCP); **15** are deterministic (8 `auto_metadata` + 7 `lifecycle`) and intentionally excluded by the Edge subset filter. Cite `mcp-server/lib/familyIKeys.ts:92-99` (6-key list) and `mcp-server/lib/familyIKeys.ts:117-135` (15-key exclusion list). Source-of-truth citations: this design `§4`, and `docs/designs/MCP-SERVER-010-FAMILY-I.md`. Include the minority-subset asymmetry note (§0.1 marker c). Include the standalone-run line `npx supabase db query --linked --file scripts/ops/sql/17-family-i-subset-coverage.sql`.
- **CTE `family_i_observed`**: `select res.raw_key, r.run_mode, count(*) as positive_count, count(distinct res.argument_id) as distinct_arguments from public.argument_machine_observation_results res inner join public.argument_machine_observation_runs r on r.id = res.run_id where res.family = 'thread_topology' group by res.raw_key, r.run_mode`.
- **CTE `classification`**: a 2-way `subset_membership` CASE (per §0.1 marker c):
  - `when raw_key in ( <6 verbatim Subset keys> ) then 'ai_classifier_subset'`
  - `when raw_key in ( <15 verbatim excluded keys, with `-- auto_metadata (8)` / `-- lifecycle (7)` comment dividers> ) then 'deterministic_excluded_leak'`
  - `else 'unknown_key_outside_taxonomy'`
- **Final SELECT (5-column report-parser contract, bare names):** `raw_key, run_mode, positive_count, distinct_arguments, subset_membership`.
- **Leak-first ORDER BY**: `order by case subset_membership when 'deterministic_excluded_leak' then 1 when 'unknown_key_outside_taxonomy' then 2 when 'ai_classifier_subset' then 3 else 4 end, positive_count desc, raw_key;`
- **Doctrine note** (header): I's thread-topology keys are DESCRIPTIVE STRUCTURE per `cdiscourse-doctrine §1`; a new issue is not a derailment, returning to a prior issue is not repetition, comparing options does not pick a side; `references_external_context` records the structural fact of an external reference and never grants factual standing (`cdiscourse-doctrine §3`, popularity ≠ evidence); `point-standing-economy`: I emits no standing delta.

**SQL-safety constraints (enforced by `opsMcpObservabilitySqlSafety.test.ts`):**
- `.sql` extension; first non-empty line starts with `--`; file contains the literal `OPS-MCP-OBSERVABILITY`; file ends with `;`.
- No DDL keywords (`INSERT/UPDATE/DELETE/ALTER/CREATE/DROP/TRUNCATE/GRANT/REVOKE`) in executable SQL (comments are stripped before the scan, so they may appear in commentary).
- No `select * from public.arguments`; no bare `arguments.body`; no bare `evidence_span` (none are referenced here — only `raw_key`/`family`/aggregates).

**Ban-list constraints (CRITICAL for I — its key guards quote verdict words):**
- The whole-file lowercase scan (mirrors `opsMcpObservabilityFamilyGCoverage.test.ts:353-358`) forbids the base tokens `winner, loser, fallacy, bad faith, manipulative, extremist, propagandist, liar, dishonest, correct, incorrect` anywhere — **including comments**. So the doctrine note must NOT use "winner", "correct", or "incorrect". Phrase `compares_options` as "records the STRUCTURE of a comparison, never an adjudication of which option prevails" — and note `prevails`/`prevailed` is on the I verdict-adjacency list below, so it is forbidden only in *executable* SQL (comment-stripped), which this isn't — but to be safe, prefer "never adjudicates between the options."
- An **I-specific verdict-adjacency** scan (define in the I test, mirror of G's `G_VERDICT_ADJACENCY_BANNED_PHRASES`) forbids, in comment-stripped executable SQL, the phrases from `familyIKeys.ts`: `off-topic, derailing, evasive, dodging, rehashing, repetitive, going in circles, the right option, the correct choice, winner, prevailed`. The executable SQL is only key-name string literals + column names, so this passes trivially; the scan guards against future drift.

---

## 5. SECTIONS manifest entry (I card) — `report-lib.cjs`

Append after the `q16-family-g-subset-coverage` entry, mirroring the q15/q16 shape exactly:

```js
{
  id: 'q17-family-i-subset-coverage',
  title: 'Family I 6-key subset coverage',
  question:
    'Q17 — Are all observed Family I raw_keys within the 6-key ai_classifier Subset, with zero deterministic-key leaks (15 keys excluded)?',
  sqlFile: '17-family-i-subset-coverage.sql',
  columns: ['raw_key', 'run_mode', 'positive_count', 'distinct_arguments', 'subset_membership'],
  emptyMessage:
    'No Family I positive results yet. Subset coverage will populate after admin_validation or production runs produce positives.',
}
```

The rendered Markdown section heading will be `## Family I 6-key subset coverage` (the I test Group E asserts this, mirroring the G test at line 557).

---

## 6. Test plan

Two new test files, both pure Jest + `fs.readFileSync` + regex/substring (no live DB; the live sanity check is the optional post-merge smoke). Modeled on `__tests__/opsMcpObservabilityFamilyGCoverage.test.ts`.

### `__tests__/opsMcpObservabilityFamilyHCoverage.test.ts` (card H; +14 to +26)

H is uniform → NO Group C (no Q-file), NO Group D section/file-count delta, NO Group E fixture key. Groups:

- **Group A — Q11 narrative regression (~4):** Q11 header references `claim_clarity` and "Family H" production-enabled state; Q11 SQL body byte-equal (assert the 4 column aliases `run_count/success_count/failed_count/fallback_count` + `unnest(requested_families)` + NO `family_key_count`/`subset_membership` aliases — same assertions as G test lines 180-203); Q11 SECTIONS question still present; Q11 SQL has no base banned tokens.
- **Group B — Q14 CASE regression (~5):** Q14 CASE contains `when 'claim_clarity' then 12` verbatim; the A–G branches (`'parent_relation' then 19`, …, `'resolution_progress' then 21`) and `else 0` are all preserved; Q14 header table contains a `claim_clarity` row citing `familyHKeys.ts`; Q14 SECTIONS question reflects the new roster — assert the **stable** canary `expect(q14.question).toContain(', H')` (NOT the fragile count word); Q14 SQL has no base banned tokens.
- **Group C — H doctrine self-check (~4):** Q11 + Q14 edited SQL contain no base banned tokens (case-insensitive whole-file); the H **verdict-adjacency** phrases (`weak, vague, lazy, sloppy, careless, confused, unsound, unsupported, incoherent, illogical, bad reasoning, bad argument, incomplete, unfinished, ungrounded, unjustified` — from `familyHKeys.ts:252,193,207,313`) are absent from the comment-stripped executable SQL of Q11/Q14; assert the H key family is described as DESCRIPTIVE FORMULATION-STATE (the design/header framing).
- **Group D — uniform-source guard (~1-2):** assert **no** `scripts/ops/sql/17-family-h-subset-coverage.sql` (and no `NN-family-h-*`) exists — H is uniform like E/F and must not gain a subset file; assert `report-lib.cjs` SECTIONS has no `q*-family-h-*` entry.

### `__tests__/opsMcpObservabilityFamilyICoverage.test.ts` (card I; +28 to +36)

Full G-shape (Groups A–F). Define module constants `FAMILY_I_SUBSET_KEYS` (6) and `FAMILY_I_EXCLUDED_DETERMINISTIC_KEYS` (15) verbatim from `familyIKeys.ts`.

- **Group A — Q11 narrative (~4):** Q11 header references `thread_topology` + "Family I" production-enabled; Q11 SQL body byte-equal; SECTIONS question mentions the family; no base banned tokens.
- **Group B — Q14 CASE (~3):** Q14 CASE contains `when 'thread_topology' then 6`; A–H branches + `else 0` preserved; Q14 header cites `familyIKeys.ts`; Q14 SECTIONS question stable canary `toContain(', I')`.
- **Group C — Q17 new file (~13):** file exists at `scripts/ops/sql/17-family-i-subset-coverage.sql`; header documents the 6-vs-21 distinction (`lower` contains `6`, `21`, `ai_classifier`, `subset`); header cites `familyIKeys.ts:92-99` and `familyIKeys.ts:117-135`; contains every Subset key verbatim (single iterating test over the 6); contains every excluded key verbatim (single iterating test over the 15); `subset_membership` has the 3 expected values; preserves the 5-column contract; filters `where res.family = 'thread_topology'`; no base banned tokens; leak-first ORDER BY (CASE `deterministic_excluded_leak then 1`, `unknown… then 2`, `ai_classifier_subset then 3`); lib SECTIONS `q17-…` entry has the 5 expected columns + `sqlFile`; doctrine note present (`cdiscourse-doctrine §1`, `§3` popularity-not-evidence for `references_external_context`, `point-standing-economy`).
- **Group D — cross-section invariants (~5):** `SECTIONS.length === 18`; ordered id list `q01..q16 + q17` (with `q02b`); Q11/Q14/Q17 each reference `thread_topology`; Q17 columns mirror Q15/Q16 5-col shape; Q17 column names don't collide with Q11/Q14 (`family_key_count`/`positives_per_run_key_cell` absent; `subset_membership` present, shared with Q15/Q16).
- **Group E — fixture compatibility (~5):** `FIXTURE_SECTIONS_DATA` has `q17-…` with ≥1 row; `FIXTURE_EMPTY_SECTIONS_DATA` has `q17-…` = `[]`; every fixture row iterates cleanly through the SECTIONS columns (no NaN/undefined); fixture rows are `ai_classifier_subset`; the stitcher renders `## Family I 6-key subset coverage` with no `NaN`/`undefined`; JSON artifact has 18 sections including `q17-…`.
- **Group F — I verdict-adjacency doctrine (~1):** the I-specific banned phrases (§4) are absent from the comment-stripped executable SQL of Q17.

### Existing-test count-pin updates (I card; not new tests)

Bump the `17`→`18` assertions enumerated in §3 CARD I. These are edits, not additions — net test count is unchanged by them.

### Gate verification (per `test-discipline`)

After EACH card: `npm run typecheck`, `npm run lint`, `npm run test` all exit 0 (capture the `Test Suites:`/`Tests:` line + explicit exit code; tool-timeouts are INDETERMINATE, re-run with `; echo "EXIT: $?"`). Plus `node scripts/ops/audit-lint.mjs docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-HI-COVERAGE.md` → 0 findings.

---

## 7. Edge cases

- **Empty DB / no Family H or I positives yet:** all queries return 0 rows; `emptyMessage` renders; the stitcher must not emit `NaN`/`undefined`. Q17's `count(distinct argument_id)` over an empty result is fine. (Mirrors the empty-db safety test.)
- **A deterministic key appears as a Family I positive (a "leak"):** the Q17 CASE classifies it `deterministic_excluded_leak` and the leak-first ORDER BY surfaces it at the top. This is the intended security-adjacent signal, not an error. Given I routes only 6/21, this is the single most important reason I gets a subset file.
- **An unknown key appears (taxonomy drift):** classified `unknown_key_outside_taxonomy`, ordered second. Surfaces upstream registry drift.
- **Q14 density for H/I with zero runs:** `family_key_count` is 12 (H) / 6 (I) but `positives_per_run_key_cell` is `null` (division by `nullif(runs * family_key_count, 0)`); renders as `null`, not a crash. (Same as every other family pre-traffic.)
- **Name-pair collision:** N/A for I (all 21 strings unique, per `familyIKeys.ts:113-115`) — unlike G where lifecycle/ai_classifier share names. The 6-included and 15-excluded sets are disjoint.
- **Doctrine-constraint edge case — does "heat"/popularity reach Family I's `references_external_context`?** No. The key records only the structural fact that the move cites something outside the room; the Q17 query counts its occurrences and never weights by engagement. Popularity is not evidence (`cdiscourse-doctrine §3`); the SQL has no engagement column to leak through.
- **Concurrent edits to Q14 by H then I:** H adds the `claim_clarity` branch; I adds the `thread_topology` branch below it. If shipped as separate commits, the I commit rebases on H's Q14. No conflict if I appends after H's branch. (See §HI-3.)

---

## HI-3. Multi-card chain protocol (H → I)

- **Order:** H first (no count moves), then I (moves 17→18). This keeps each card's count-pin edits isolated to I.
- **Between cards:** after H merges, re-run typecheck/lint/test and confirm the H test + the (refactored) G test pass; confirm worktree clean. Then start I from the post-H state.
- **Shared moving string:** the Q14 SECTIONS question count word (`five`→`eight`→`nine`). The recommended mitigation is to refactor every coverage test's Q14 canary to a **stable comma-letter entry** (`', G'` / `', H'` / `', I'`) so no test depends on the count word. If the implementer instead keeps count-word canaries, the I card MUST update the count word in the G test AND the H test (both), or those tests go red.
- **Handoff record:** after the chain, update `docs/core/current-status.md` H2 with both cards' confirmed test counts (cross-check against `docs/reviews/<card>-review.md` if reviews are produced).

---

## HI-4. HALT triggers (inherited from the G coverage card §10; re-evaluated for H+I)

Quoted from `docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-G-COVERAGE.md` §10. All 16 are NOT TRIGGERED for this card; the implementer MUST HALT and surface to the operator if any becomes true during implementation.

| # | HALT trigger | H+I status |
| --- | --- | --- |
| 1 | Any runtime code change | NOT TRIGGERED — only `scripts/ops/sql/**`, the runner manifest, fixture, tests, docs. `mcp-server/**`, `supabase/functions/**`, `src/**` untouched. |
| 2 | Any registry change | NOT TRIGGERED — `familyRegistryInit.ts` read as reference only. |
| 3 | Any production-mode flip | NOT TRIGGERED — H flipped by #559, I by #562; this is observability backfill, not a flip. |
| 4 | New taxonomy keys | NOT TRIGGERED — Q14/Q17 reference existing keys; no upstream taxonomy edit. |
| 5 | Schema migration | NOT TRIGGERED — no `supabase/migrations/**`. |
| 6 | Source 6 filter change | NOT TRIGGERED — `machineObservationPersistenceQuery.ts` untouched. |
| 7 | New family registration | NOT TRIGGERED — no registry edit. |
| 8 | A new per-family-per-mode query mislabels a family's mode | NOT TRIGGERED — Q11/Q14 use `r.run_mode` directly; H/I surface in both modes via `unnest(requested_families)`. |
| 9 | A subset-coverage query conflates the full taxonomy with the MCP-routed subset | NOT TRIGGERED — Q17 header documents the 6-vs-21 distinction; CASE splits `ai_classifier_subset`(6) vs `deterministic_excluded_leak`(15) vs `unknown`. H has no subset query (uniform). |
| 10 | Q11 narrative drops any prior family's visibility | NOT TRIGGERED — H/I add bullets only; Q11 SQL body byte-equal; all prior rows still surface. |
| 11 | `supported_families` derivation breaks under the 9-family state | NOT TRIGGERED — Q12's `supported_families` CTE is data-derived; H/I migrate automatically from their first real-provider rows. Q12 byte-equal. |
| 12 | Report runner fails to execute any query | NOT TRIGGERED — Q17 mirrors Q15/Q16 (live-verified shape); Q14 CASE edits are additive. Operator validates in the optional post-merge smoke. |
| 13 | Default output exposes evidence_span / raw bodies / secrets / tokens | NOT TRIGGERED — Q17 selects only `raw_key`, `run_mode`, aggregates, and the CASE-derived `subset_membership`; no `evidence_span`/`arguments.body`. SQL-safety test guards this. |
| 14 | Edge `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` / subset filter change | NOT TRIGGERED — `booleanObservationRequestBuilder.ts` untouched (H needs no entry; I's Edge subset entry is a separate Card-3 follow-up per `familyIKeys.ts:26-30`). |
| 15 | Test forecast exceeds +60 (chain-prompt cap) | NOT TRIGGERED — combined +42 to +62; the implementer consolidates I Group C key-iteration to keep ≤ +60. FLAG if expansion would exceed. |
| 16 | Unclassified untracked files at PR creation | NOT TRIGGERED at design time — the working tree's untracked entries (per `git status`) are operator/session territory (`out/`, `scripts/*-sql/`, `docs/testing-runs/*`, `netlify-prod.git`, etc.); the implementer adds only the explicitly-named SQL + test files. NEVER `git add -A`. |

---

## HI-5. Risks

- **R1 — H test delta below the intent's lower bound.** The H intent forecast +20 to +50; H is uniform so the realistic delta is +14 to +26 (no Q-file/fixture/section tests). This is correct, not a defect. The implementer may land near +20-26 by per-key expansion over the 12 H keys, or near +14 by consolidating; either is acceptable. FLAGGED for operator awareness — do not pad with low-value tests just to hit +20.
- **R2 — Q14 SECTIONS-question E/F drift + count-word fragility.** The current question says "five … (A, B, C, D, G)" but the CASE has A–G (7 families). The HI cards correct the enumeration to the true roster while bumping the count word. Two interpretive choices are FLAGGED for operator review: (a) correcting the E/F omission (recommended — it makes observability honest), and (b) refactoring the coverage tests' Q14 canary from the count word to the stable comma-letter entry (`', G'`/`', H'`/`', I'`). If the operator prefers the literal G precedent (count word only, no E/F correction), the cards can be re-scoped to leave E/F out of the enumeration and keep a count-word canary — but then the count math is misleading.
- **R3 — Pre-BUILD2 staleness in the runbook Q6 narrative is OUT of HI scope.** `docs/ops/OPS-MCP-OBSERVABILITY.md:138-142` states A=16/B=14/C=17/D=19/G=18 (pre-BUILD2 counts; current CASE is A=19/B=17/C=20/D=22/G=21). The HI cards add H/I bullets to this narrative but should NOT undertake a full A–G recount — that is a separate doc-hygiene card. FLAGGED so the implementer adds H(12)/I(6) without "fixing" the neighbors and without being blocked. (Operator may file a follow-up doc-hygiene card.)
- **R4 — Cross-test count-pin breakage (I card).** Adding `q17`/the new `.sql` file breaks SEVEN existing assertions across five test files (enumerated in §3 CARD I). Miss one → red suite. The implementer must run the FULL `npm test` (not a filtered subset) before claiming green, because the breakage is spread across shape/safety/empty-db/no-service-role/D-coverage/G-coverage files.
- **R5 — Ban-list trip in the I SQL doctrine note.** I's key guards quote verdict words (`winner`, "the correct choice", "off-topic", "rehashing"). The whole-file scan forbids `winner/correct/incorrect` even in comments. The doctrine note must paraphrase around them (see §4). The G card hit the analogous constraint and resolved it; mirror that.
- **R6 — Family enum name mismatch.** The queries filter on the `family` column string. Confirmed `claim_clarity` and `thread_topology` (`familyRegistryInit.ts:173,197`). Do NOT use the letter ("H"/"I") or a guessed name. (Analogous to the UX-001.5 `flags`-vs-`semanticFlags` reality-audit lesson.)
- **R7 — `node_modules`/Windows path:** the SQL-safety test reads `scripts/ops/sql` via `fs.readdirSync` and counts `.sql` files; ensure the new file is committed (not gitignored) and has the `.sql` extension exactly.

---

## 8. Out of scope (explicit non-scope list)

Mirrors the G card §16; updated for H+I.

1. **Family E / F observability re-work** — E/F are already in the Q14 CASE (via `MCP-BUILD2e/f`); the HI cards only correct their enumeration in the SECTIONS question text (R2), not the SQL.
2. **A full pre-BUILD2 recount of the runbook Q6 narrative (A–G)** — separate doc-hygiene card (R3).
3. **Family H/I production-mode flips** — already done (#559 / #562).
4. **MCP server runtime changes** — `mcp-server/**` byte-equal.
5. **Edge Function changes** — `supabase/functions/**` byte-equal; I's Edge `MCP_SERVER_SUPPORTED_FAMILY_SOURCES` subset entry is a separate follow-up (`familyIKeys.ts:26-30`).
6. **Migration files** — `supabase/migrations/**` byte-equal.
7. **`package.json` / dependencies** — none.
8. **Q15 / Q16 modifications** — byte-equal (the D and G subset files are locked).
9. **Q12 / Q13 modifications** — Q12 `supported_families` is data-derived (handles H/I automatically); Q13 is family-agnostic. Both SQL byte-equal; only optional runbook narrative bullets.
10. **A dedicated `17-family-h-subset-coverage.sql`** — H is uniform; NO file (the H test asserts its absence).
11. **A 3-way auto_metadata-vs-lifecycle source-mode breakdown for I** — D set the 2-way precedent (§0.1 marker c).
12. **App-side UI / CI/CD / audit-lint v1 marker** — observability is operator telemetry; the audit-lint v1 marker is for smoke-audit docs only, not this card.

---

## 9. Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks):** the queries surface aggregate counts + machine `raw_key` strings; no verdict about a person/move/claim. H's clarity keys (`conclusion_missing`, `claim_specificity_low`, …) are DESCRIPTIVE FORMULATION-STATE; I's topology keys (`introduces_new_issue`, `returns_to_prior_issue`, …) are DESCRIPTIVE STRUCTURE. The SQL never labels a move weak/off-topic/repetitive/winner. Nothing here blocks posting (it is read-only telemetry).
- **cdiscourse-doctrine §3 (popularity ≠ evidence):** Family I's `references_external_context` records the structural fact of an external reference only; Q17 counts occurrences and has no engagement/virality column. No amplification path.
- **cdiscourse-doctrine §10a (Observations vs Allegations):** every `raw_key` surfaced is a machine Observation; no user Allegation is involved. No raw classifier ID reaches a user-facing surface (this is operator-only tooling). The sensitive composer-only Observations are not part of any family-H/I MCP subset surfaced here.
- **cdiscourse-doctrine §6/§7 (secrets; no AI in app):** no secret read; no service-role; no Anthropic/xAI/X call; the runner uses the operator's authenticated Supabase session (no key stored). The SQL-safety + no-service-role tests guard this.
- **point-standing-economy:** H and I emit no standing delta; clarity/topology positives never lower factual-standing eligibility. The Q17 doctrine note states this; no scoring repair/defeat semantics are introduced.
- **test-discipline:** two new test files ship WITH the cards (not follow-ups); full-suite green with captured exit codes; count goes up; no `.skip`/`.only`; no `console.log`.
- **supabase conventions:** RLS untouched; no migration; reads only the two existing observation tables; never deletes/mutates rows.

---

## 10. Operator steps

**None — pure code/doc/test change after the implementer commits.** No `npx supabase db push`, no `functions deploy`, no env var, no npm dep, no config change.

**Optional post-merge smoke (recommended; mirrors the G card §17.1):**

```bash
node scripts/ops/mcp-observability-report.mjs --out-dir /tmp/hi-coverage-smoke
```

Inspect `/tmp/hi-coverage-smoke/report.md` + JSON:
- Q11 narrative reflects the 9-family roster (H + I production-enabled).
- Q14 shows `claim_clarity` rows with `family_key_count = 12` and `thread_topology` rows with `family_key_count = 6`, `positives_per_run_key_cell` computed (or `null` if no traffic yet).
- Q17 section present; observed Family I raw_keys all `ai_classifier_subset`; zero `deterministic_excluded_leak` rows.
- Q12 returns 0 rows for `claim_clarity` / `thread_topology` (not flagged unsupported).
- Default output safety preserved (no `evidence_span` / secrets / verdict tokens).

**Audit-lint v1 marker NOT required** — this is ops tooling, not a smoke audit.

---

## 11. Orchestrator-authored brief ledger (POSTRUN-UX001 protocol)

This design is orchestrator-authored from the two operator intent briefs + a pre-launch codebase reality audit at `3f9650a`.

| Section | Source | Note |
| --- | --- | --- |
| Header / §0 goal | H + I intent §1 + D/G precedent | Combined-lane framing; H-first ordering. |
| §0.1 marker (a) H Q-files | Pre-launch survey: `familyHKeys.ts:16-17` (uniform, no exclusion) + E/F precedent (no dedicated file) | Derived from codebase, not operator default. |
| §0.1 marker (b) forecast | G test count (~31) + H uniform shape | Refined band; FLAGS deviation below intent lower bound (R1). |
| §0.1 marker (c) I source-mode | `15-family-d-subset-coverage.sql:66-109` (2-way, no source-mode column) | D set the no-breakdown precedent; I mirrors. |
| §2 current state | Pre-launch reality audit (live `report-lib` dump + file reads at `3f9650a`) | Surfaced the E/F + pre-BUILD2 drift the G design doc predates. |
| §3 file changes | D/G precedent §6 + reality audit | Per-card; H moves no counts, I moves 17→18. |
| §4 new SQL | `16-family-g-subset-coverage.sql` mirror + `familyIKeys.ts` | Verbatim key lists from source. |
| §5 SECTIONS entry | live q15/q16 entries | Shape mirror. |
| §6 test plan | G test structure + `test-discipline` | H smaller (no Group C/D/E); I full G-shape. |
| §HI-4 HALT | G design §10 verbatim, re-evaluated | All 16 NOT TRIGGERED. |
| §HI-5 risks / §8 OUT / §10 operator | G precedent + reality audit | R2/R3 are the orchestrator-surfaced drift items. |

### Operator-deferred review (post-ship, optional)

- **R2 (a):** correcting the E/F enumeration omission in the Q14 question. Resolved by orchestrator default = correct it (honest observability). Operator may revert to the literal G precedent.
- **R2 (b):** refactoring the coverage-test Q14 canary from count word to stable comma-letter entry. Resolved by orchestrator default = refactor (eliminates cross-card fragility). Operator may keep count-word canaries.
- **R1:** H test delta below intent's +20 floor (uniform family). Resolved by orchestrator default = accept the lower realistic band; do not pad. Operator may direct per-key expansion to reach +20.
- **R3:** pre-BUILD2 runbook Q6 recount left OUT of scope. Operator may file a follow-up doc-hygiene card.

### Open questions for the operator

**None blocking.** All three intent markers resolve from precedent + the codebase. The two interpretive judgments (R2 a/b) are surfaced above for optional post-ship review; both have a recommended default that ships cleanly.
