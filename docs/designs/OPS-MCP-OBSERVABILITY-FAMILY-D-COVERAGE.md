# OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE — 4-family observability update

**Status:** Design draft
**Epic:** OPS — Multi-family observability
**Release:** v0.1 (Stage 6.x operational tooling)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/333

**Card position:** Card 1 of 3 in the FAMILY-D-COVERAGE → EDGE-FAMILY-D-ENABLE → FAMILY-E chain
**Predecessor:** MCP-SERVER-005-FAMILY-D-SMOKE PASS at `0da43f9`; fix(MCP-SERVER-005-FAMILY-D) Edge→MCP subset filter at `b0fd068`; MCP-021C-EDGE-FAMILIES-B-C-ENABLE-SMOKE PASS at `ac66b2e`.
**Intent brief:** `docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE-intent.md` (operator-authored; binding).

---

## Goal (one paragraph)

The observability report shipped under `OPS-MCP-OBSERVABILITY` (`docs/designs/OPS-MCP-OBSERVABILITY.md`) was designed for the 3-family world (A+B+C with A in production, B+C admin_validation-only). After three predecessor cards landed — `MCP-021C-EDGE-FAMILIES-B-C-ENABLE` (B+C went production), `MCP-SERVER-005-FAMILY-D` (Family D shipped admin_validation-only with a 19-key ai_classifier Subset), and `OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING` (Q12 became data-derived) — the 4-family operational state no longer matches the report's narrative. This card updates the report to **match the 4-family state by changing only SQL + the runner manifest, never runtime code**: Q11 reframes from a B+C admin-only assertion to a per-family per-mode coverage table that surfaces all four families with both modes; Q14 adds per-family per-mode signal density with a hardcoded `family_key_count` denominator (16/14/17/19); Q15 adds Family-D-specific 19-key subset coverage including a deterministic-leak guard. The doctrine constraints that shape this design: `cdiscourse-doctrine §1` (no verdict labels — counts and density ratios only, no "this family is over-firing" verdict on any family); `§3` (no popularity surfacing — density is positives / (runs × key_count), never a "best family" ranking); `§6` (no secrets in output — Phase A verification confirmed `npx supabase db query --linked` uses operator's authenticated Management API session); `§9` (operator-facing telemetry only, not user UI — the `gameCopy.toPlainLanguage` rule does not apply); `§10a` (machine taxonomy values like `evidence_gap_present` appear verbatim as data values, never as verdicts about a user); `supabase-edge-contract` (no migration, no Edge Function change, no RLS change, no service-role usage); `evidence-doctrine` (evidence_span content remains suppressed by default; no new flag in this card).

---

## 1. Scope reality (Phase A.1 + A.3 verification output)

### A.1 — Current Q11 semantics + live 4-family state

**Current `scripts/ops/sql/11-family-bc-admin-validation-check.sql` shape (verified by direct file read):**

```sql
-- Filters to status='success' and requested_family in ('disagreement_axis', 'misunderstanding_repair')
-- Header asserts: "If any row appears with `requested_family in ('disagreement_axis',
-- 'misunderstanding_repair') and run_mode = 'production'`, the script flags it as a
-- registry-vs-DB inconsistency. Expected today: zero such rows."
```

**Output columns:** `requested_family`, `run_mode`, `run_count` (3 columns; SECTIONS pinned).

**Live DB query at design authoring (2026-05-27, `npx supabase db query --linked --file 11-...sql`):**

| requested_family | run_mode | run_count |
| --- | --- | --- |
| disagreement_axis | admin_validation | 3 |
| disagreement_axis | **production** | **1** |
| misunderstanding_repair | admin_validation | 3 |
| misunderstanding_repair | **production** | **1** |

The current Q11 SQL **runs cleanly under 4-family state** and surfaces production rows correctly — but its **header narrative is stale**: it asserts "Expected today: zero such rows" for B+C production, which is no longer true (B+C are now production-enabled per the prior launch). The query returns the production rows because B+C now have them; the script reads this as "registry-vs-DB inconsistency" semantically even though the registry has been updated to allow it.

**The reframe (designed below in §2):** rename the file, restructure the SQL to surface ALL families per mode (not just B+C), preserve B+C admin_validation visibility, add A+D rows, and update the header to drop the stale "B+C-only" assertion.

### A.3 — supported_families derivation verification (live DB)

**Question:** does Family D appear in supported_families derivation? Does Q12 NOT flag Family D as an unsupported attempt?

**Live queries at design authoring:**

Query 1 — `supported_families` CTE from Q12:
```
| family_name |
| --- |
| disagreement_axis |
| evidence_source_chain |
| misunderstanding_repair |
| parent_relation |
```
**ANSWER 1:** **Family D IS in supported_families** alongside A, B, C. The data-derived CTE picked it up automatically when Family D's first real-provider rows landed (`provider_key='mcp:classify_argument_boolean_observations'` from the post-MCP-SERVER-005 admin_validation runs).

Query 2 — Q12 full output:
```
{ "rows": [] }
```
**ANSWER 2:** **Q12 returns 0 rows. Family D is NOT flagged as unsupported.** All four families with result rows (A, B, C, D) are in supported_families; `unsupported_families` is empty because the only result rows in the table came from real providers, and the OPS-MCP-TEST-DATA-CLEANUP cleanup removed all synthetic-only rows.

Query 3 — Observed Family D raw_keys:
```
| raw_key | run_mode | positive_count | distinct_arguments | provider_key |
| --- | --- | --- | --- | --- |
| evidence_gap_present | admin_validation | 2 | 2 | mcp:classify_argument_boolean_observations |
| opens_evidence_debt_marker | admin_validation | 2 | 2 | mcp:classify_argument_boolean_observations |
```
**ANSWER 3:** **2 distinct raw_keys observed**; both ∈ 19-key ai_classifier subset (`FAMILY_D_RAW_KEYS` at `mcp-server/lib/familyDKeys.ts:85-105`). **Zero deterministic-key leaks** (none of `has_evidence`, `source_requested`, `quote_requested`, `source_attached`, `quote_attached`, `sourced` appeared as raw_keys).

**Conclusion:** the Q12 SEMANTIC TIGHTENING fix's data-derived CTE handles the 4-family state correctly without code change. Family D migrated from `unsupported_families` (where it was at the Q12 fix time) to `supported_families` (where it is now) the moment its first real-provider row landed. **No HALT trigger fires under A.3.**

---

## 2. Q11 reframe design (Phase A.1)

### 2.1 — Decision: file rename + structural reframe

The current filename `11-family-bc-admin-validation-check.sql` encodes a stale assumption. The reframe:

- **New filename:** `11-per-family-per-mode-coverage.sql`
- **New section title:** "Per-family per-mode coverage"
- **New section id (anchor):** `q11-per-family-per-mode-coverage`
- **New question:** "Q11 — How are runs distributed across families and run_modes? (Captures the 4-family operational state including B+C production, Family D admin_validation, A in both modes.)"

The old filename remains gone after the rename (no compat shim — the file is renamed in git so blame chain is preserved; the SECTIONS manifest id is also renamed in lockstep, see §7).

### 2.2 — New SQL shape

```sql
-- OPS-MCP-OBSERVABILITY — Q11: Per-family per-mode coverage.
--
-- Surfaces run counts and status breakdown across ALL registered families
-- and both run_modes, providing a single coverage table that captures the
-- 4-family operational state:
--   - Family A (parent_relation): production + auto-trigger live + admin_validation
--   - Family B (disagreement_axis): production + auto-trigger live + admin_validation
--   - Family C (misunderstanding_repair): production + auto-trigger live + admin_validation
--   - Family D (evidence_source_chain): admin_validation only (19-key ai_classifier Subset)
--   - Families E-J: unsupported (failed attempts only if any)
--
-- Family attribution: unnest(requested_families) so failed runs (which may
-- have no `results` rows) are still counted under their requested family.
-- This is the same attribution Q2b + Q3 + Q4 use.
--
-- The query makes NO assumption that any family is mode-restricted; it
-- reports the actual observed state. The operator interprets per the
-- Edge registry (Appendix A in the report).
--
-- Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE.md §2.
-- Runs standalone via:
--   npx supabase db query --linked --file scripts/ops/sql/11-per-family-per-mode-coverage.sql
--
-- Doctrine: aggregate counts only; family names are taxonomy values.
select
  requested_family,
  run_mode,
  count(*) as run_count,
  count(*) filter (where status = 'success') as success_count,
  count(*) filter (where status = 'failed') as failed_count,
  count(*) filter (where status = 'fallback') as fallback_count
from (
  select
    unnest(requested_families) as requested_family,
    run_mode,
    status
  from public.argument_machine_observation_runs
) t
group by requested_family, run_mode
order by requested_family, run_mode;
```

### 2.3 — Preservation property

The reframe surfaces a strict superset of the original Q11 information:

- **Original Q11 rows** (B+C admin_validation success counts) are recoverable via filtering: the new Q11 includes every (`disagreement_axis`, `admin_validation`) and (`misunderstanding_repair`, `admin_validation`) row that the old Q11 would have shown, with the `success_count` column matching the old `run_count` column for `status='success'` filter. Any operator who needs the old shape can read `success_count` from the rows where `requested_family in ('disagreement_axis', 'misunderstanding_repair') and run_mode = 'admin_validation'`.
- **The new Q11 additionally surfaces** B+C production rows, A in both modes, D admin_validation, and any unsupported-family failed attempts (which already show up in Q12 with zero positives).
- **No information is dropped.** This satisfies HALT #10 ("Q11 reframe drops the original B+C visibility — must preserve + extend, not replace").

### 2.4 — Live output preview (verified at design authoring against `npx supabase db query`)

| requested_family | run_mode | run_count | success_count | failed_count | fallback_count |
| --- | --- | --- | --- | --- | --- |
| argument_scheme | admin_validation | 3 | 0 | 3 | 0 |
| claim_clarity | admin_validation | 2 | 0 | 2 | 0 |
| critical_question | admin_validation | 2 | 0 | 2 | 0 |
| disagreement_axis | admin_validation | 4 | 3 | 1 | 0 |
| disagreement_axis | production | 1 | 1 | 0 | 0 |
| evidence_source_chain | admin_validation | 14 | 3 | 11 | 0 |
| misunderstanding_repair | admin_validation | 4 | 3 | 1 | 0 |
| misunderstanding_repair | production | 1 | 1 | 0 | 0 |
| parent_relation | admin_validation | 6 | 6 | 0 | 0 |
| parent_relation | production | 6 | 6 | 0 | 0 |
| resolution_progress | admin_validation | 2 | 0 | 2 | 0 |
| sensitive_composer | admin_validation | 2 | 0 | 2 | 0 |
| thread_topology | admin_validation | 2 | 0 | 2 | 0 |

The 4-family state is visible at a glance: A+B+C have production rows; D has only admin_validation; E-J are failed admin_validation attempts.

### 2.5 — Runner SECTIONS update (§7 details runner manifest)

The SECTIONS entry at `scripts/ops/mcp-observability-report-lib.cjs:263-270` updates as follows:

```js
{
  id: 'q11-per-family-per-mode-coverage',   // RENAMED from 'q11-family-bc-admin-validation-check'
  title: 'Per-family per-mode coverage',     // RENAMED
  question: 'Q11 — How are runs distributed across families and run_modes? (4-family state: A+B+C production + admin_validation; D admin_validation only; E-J failed attempts.)',
  sqlFile: '11-per-family-per-mode-coverage.sql',   // RENAMED
  columns: [
    'requested_family',
    'run_mode',
    'run_count',
    'success_count',    // NEW
    'failed_count',     // NEW
    'fallback_count',   // NEW
  ],
  emptyMessage: 'No runs in the table.',
},
```

3 new columns (`success_count`, `failed_count`, `fallback_count`). The 1 renamed `id` + the rename of file + title.

---

## 3. Q14 density math + denominator strategy (Phase A.2)

### 3.1 — Density formula choice

**Three candidates considered:**

1. **`positives / runs`** — simple mean. Doesn't normalize by family size; Family A (16 keys) and Family D (19 keys) compared directly understate D's density.
2. **`positives / (runs × key_count)`** — normalized density per (run, possible_key). This is the "what fraction of (run × key) cells fired positive" interpretation. Comparable across families.
3. **`positive_keys / key_count`** — distinct-keys-observed coverage. This is "what fraction of the family's possible vocabulary has fired at all". Doesn't capture concentration.

**Decision: formula 2** (`positives / (runs × key_count)`) — the **per-(run, key) signal density** is the metric that lets the operator compare D's 19-key subset density to A/B/C, and lets them compare production vs admin_validation per family. Formula 3 (`positive_keys / key_count`) is *also* a useful signal but is captured by Q13's existing `raw_keys_observed` column; adding it to Q14 would duplicate Q13.

Reasoning chain:
- Family A's 16 keys × 6 production runs = 96 (run × key) cells; if 12 positives, density = 0.125.
- Family D's 19 keys × 2 admin_validation runs = 38 (run × key) cells; if 4 positives, density = 0.105.
- Direct comparison: A production fires at 12.5% density; D admin_validation fires at 10.5% density. Comparable; tells the operator D is not over- or under-firing relative to A.

### 3.2 — `family_key_count` denominator: Option A — hardcoded CASE

**Three candidates considered:**

- **Option A — Hardcoded CASE in SQL** (cite mcp-server lib files in the header comment).
- **Option B — Derive from a lookup CTE** (e.g., `select 'parent_relation' as family, 16 as key_count union all select 'disagreement_axis', 14 ...`).
- **Option C — Static map in SQL header comment** (purely documentation; no actual SQL participation).

**Decision: Option A** (hardcoded CASE in SQL) — the values 16 / 14 / 17 / 19 are operator-binding contract constants per the family Stage 2B decisions (citation in the SQL header). Hardcoding them in a CASE expression keeps the SQL self-contained (single-file replay works) and surfaces the constants visibly so an operator reviewing the SQL can verify them against `mcp-server/lib/family[ABCD]Keys.ts`.

Option B (lookup CTE) is semantically identical but adds boilerplate without behavioral difference. Option C (comment-only) breaks the math — Q14 needs the value at runtime.

**Family key counts (citation):**

| Family | Key count | Source file (citation in SQL header) |
| --- | --- | --- |
| parent_relation | 16 | `mcp-server/lib/familyAKeys.ts:49` — `FAMILY_A_RAW_KEYS` array length |
| disagreement_axis | 14 | `mcp-server/lib/familyBKeys.ts:53` — `FAMILY_B_RAW_KEYS` array length |
| misunderstanding_repair | 17 | `mcp-server/lib/familyCKeys.ts:61` — `FAMILY_C_RAW_KEYS` array length |
| evidence_source_chain | 19 | `mcp-server/lib/familyDKeys.ts:85` — `FAMILY_D_RAW_KEYS` array length (Subset; 8 deterministic excluded) |

The SQL CASE expression includes a fallback (`else 0`) so unsupported families (E-J) get `family_key_count = 0` and the density division returns NULL via `nullif`.

### 3.3 — Zero-runs and zero-positives handling

- **Zero runs:** `nullif(runs * family_key_count, 0)` returns NULL; density renders as `null` in JSON / `—` in markdown.
- **Zero positives:** density = `0 / (runs × key_count)` = 0 cleanly.
- **Unsupported family (key_count = 0):** `nullif(runs * 0, 0)` = NULL; density renders as `—`.
- **NULL family** (a run that produced no positives → result.family is NULL after LEFT JOIN): the GROUP BY puts these in their own row with `family = NULL`; the CASE returns 0; density = NULL.

### 3.4 — Q14 SQL shape

```sql
-- OPS-MCP-OBSERVABILITY — Q14: Per-family per-mode signal density.
--
-- For each (family, run_mode) pair, computes the per-(run, possible_key)
-- signal density: the fraction of (run × key) cells that fired positive.
--
-- Density = total_positive_observations / (run_count × family_key_count)
--
-- family_key_count is hardcoded per family from the binding contract
-- in mcp-server/lib/family[ABCD]Keys.ts (Subset path for Family D per
-- operator Stage 2B decision):
--   - parent_relation        16   mcp-server/lib/familyAKeys.ts:49
--   - disagreement_axis      14   mcp-server/lib/familyBKeys.ts:53
--   - misunderstanding_repair 17  mcp-server/lib/familyCKeys.ts:61
--   - evidence_source_chain  19   mcp-server/lib/familyDKeys.ts:85 (Subset; 8 deterministic excluded)
--   - others (E-J)            0   no MCP-supported keys
--
-- Use cases:
--   - Compare D's 19-key admin_validation density to A's 16-key production density
--   - Compare production vs admin_validation per family
--   - Spot over- or under-firing patterns (operator interprets; no verdict label)
--
-- Doctrine: aggregate ratios only; raw_key + family + run_mode are
-- machine-taxonomy values; the report does NOT label a family as
-- "over-firing" or "under-firing" (per cdiscourse-doctrine §1).
--
-- Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE.md §3.
-- Runs standalone via:
--   npx supabase db query --linked --file scripts/ops/sql/14-per-family-per-mode-signal-density.sql
with run_to_family as (
  -- One row per (run, family) — LEFT JOIN so zero-positive runs are
  -- preserved. status filter excluded so failed runs count as runs in
  -- the denominator (a failed run still consumed a (run × key) cell
  -- attempt; the density measures attempt-to-positive ratio).
  select
    r.id as run_id,
    r.run_mode,
    res.family,
    res.id as result_id,
    res.raw_key
  from public.argument_machine_observation_runs r
  left join public.argument_machine_observation_results res on res.run_id = r.id
),
keyed as (
  select
    family,
    run_mode,
    count(distinct run_id) as runs,
    count(result_id) as positives,
    count(distinct raw_key) as raw_keys_observed,
    case family
      when 'parent_relation' then 16
      when 'disagreement_axis' then 14
      when 'misunderstanding_repair' then 17
      when 'evidence_source_chain' then 19
      else 0
    end as family_key_count
  from run_to_family
  group by family, run_mode
)
select
  family,
  run_mode,
  runs,
  positives,
  raw_keys_observed,
  family_key_count,
  round(
    positives::numeric / nullif(runs * family_key_count, 0),
    4
  ) as positives_per_run_key_cell
from keyed
order by family nulls last, run_mode;
```

### 3.5 — Live output preview (verified against `npx supabase db query`)

| family | run_mode | runs | positives | raw_keys_observed | family_key_count | positives_per_run_key_cell |
| --- | --- | --- | --- | --- | --- | --- |
| disagreement_axis | admin_validation | 2 | 7 | 4 | 14 | 0.2500 |
| evidence_source_chain | admin_validation | 2 | 4 | 2 | 19 | 0.1053 |
| misunderstanding_repair | admin_validation | 2 | 3 | 2 | 17 | 0.0882 |
| parent_relation | admin_validation | 4 | 12 | 3 | 16 | 0.1875 |
| parent_relation | production | 4 | 12 | 4 | 16 | 0.1875 |
| (null) | admin_validation | 5 | 0 | 0 | 0 | (null) |
| (null) | production | 4 | 0 | 0 | 0 | (null) |

The denominator math reconciles cleanly. Note that the design pre-filters `status='success'` in `run_to_family` would give a cleaner picture, but failing runs are legitimate input to density (a failed run consumed attempt cells); the SQL stays inclusive and lets the operator interpret. The `nullif` over `runs × family_key_count` handles unsupported families gracefully.

**Decision detail on `status` filter:** the design **does not filter `status='success'`** in `run_to_family` because:
1. A failed run consumed (run × key) attempt cells — including failed runs in the denominator measures the real attempt-to-positive ratio.
2. Excluding failed runs would skew density upward for families with frequent failures (like Family D pre-fix).
3. Q13 (`13-over-under-firing-summary.sql`) already filters `status='success'` and provides the success-only density signal (`avg_positives_per_run`). Q14 complements Q13 by giving the **all-runs** density.

### 3.6 — Runner SECTIONS new entry

```js
{
  id: 'q14-per-family-per-mode-signal-density',
  title: 'Per-family per-mode signal density',
  question:
    'Q14 — What is the per-(run, possible_key) signal density across all four supported families and both run_modes?',
  sqlFile: '14-per-family-per-mode-signal-density.sql',
  columns: [
    'family',
    'run_mode',
    'runs',
    'positives',
    'raw_keys_observed',
    'family_key_count',
    'positives_per_run_key_cell',
  ],
  emptyMessage:
    'No runs in the table. Density math requires runs to evaluate.',
},
```

---

## 4. Q15 Family D subset coverage (Phase A.3)

### 4.1 — Strategy decision: separate file (not annotation)

**Two options:**
- **Option A — Separate Q15 file** (`15-family-d-subset-coverage.sql`).
- **Option B — Annotation row inside Q6** or Q13 that flags subset membership inline.

**Decision: Option A** (separate file). Reasoning:
- Each SQL file is independently replayable via `npx supabase db query --linked --file scripts/ops/sql/15-...sql` per Decision D1 of the original observability design. Option B couples Family D's distinct concern (subset membership) to general queries (Q6 / Q13) that already serve a different purpose.
- A separate file lets future families (E-J) follow the same pattern — `16-family-e-subset-coverage.sql` etc. — when they ship with subset filters.
- The runner manifest registration is identical effort either way (1 SECTIONS entry).

### 4.2 — Q15 design surface

For each observed Family D raw_key:
1. Verify it ∈ 19-key ai_classifier subset (`FAMILY_D_RAW_KEYS` from `mcp-server/lib/familyDKeys.ts:85-105`).
2. Flag if any deterministic key appears (would indicate a leak; expected 0).
3. Document the 19-vs-27 distinction explicitly in the SQL header.

### 4.3 — Q15 SQL shape

```sql
-- OPS-MCP-OBSERVABILITY — Q15: Family D subset coverage.
--
-- ------------------------------------------------------------
-- The 19-vs-27 distinction (binding context)
-- ------------------------------------------------------------
--
-- Family D (evidence_source_chain) has 27 entries in the upstream Edge
-- taxonomy registry (src/features/nodeLabels/machineObservationDefinitions/familyD.ts):
--   - 19 ai_classifier-source rawKeys (the "Subset")
--   - 8 deterministic rawKeys split across auto_metadata + lifecycle:
--       * auto_metadata: has_evidence, source_requested, quote_requested,
--         source_attached, quote_attached (5)
--       * lifecycle: sourced, source_requested, quote_requested (3; 2
--         share string names with auto_metadata)
--
-- Per operator Stage 2B decision (MCP-SERVER-005-FAMILY-D), only the 19
-- ai_classifier keys are routed to the MCP server. The 8 deterministic
-- keys are intentionally excluded by the Edge subset filter at
-- supabase/functions/_shared/booleanObservations/booleanObservationRequestBuilder.ts
-- (MCP_SERVER_SUPPORTED_FAMILY_SOURCES). Future Edge/app-side card
-- (MCP-021C-EDGE-FAMILY-D-DETERMINISTIC-KEYS) will compute the 8
-- deterministic keys app-side without an Anthropic call.
--
-- Q15 verifies the binding contract holds in the persisted data:
--   1. All observed Family D raw_keys must be ∈ the 19-key ai_classifier Subset.
--   2. If any of the 8 deterministic-key strings appears in result rows,
--      it indicates a leak from somewhere outside the MCP path (which
--      this card does NOT expect to happen — but a non-zero leak count
--      is a security-adjacent finding worth surfacing).
--
-- Source-of-truth:
--   - docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE.md §4
--   - docs/designs/MCP-SERVER-005-FAMILY-D.md (Subset path operator decision)
--   - mcp-server/lib/familyDKeys.ts:85-105 (19-key list)
--   - mcp-server/lib/familyDKeys.ts:119-129 (8 deterministic exclusion list)
--
-- Runs standalone via:
--   npx supabase db query --linked --file scripts/ops/sql/15-family-d-subset-coverage.sql
--
-- Doctrine: aggregate counts; no body content; no evidence span;
-- machine-taxonomy raw_key strings only (per cdiscourse-doctrine §10a).
with family_d_observed as (
  select
    res.raw_key,
    r.run_mode,
    count(*) as positive_count,
    count(distinct res.argument_id) as distinct_arguments
  from public.argument_machine_observation_results res
  inner join public.argument_machine_observation_runs r on r.id = res.run_id
  where res.family = 'evidence_source_chain'
  group by res.raw_key, r.run_mode
),
classification as (
  select
    raw_key,
    run_mode,
    positive_count,
    distinct_arguments,
    case
      when raw_key in (
        -- 19-key ai_classifier Subset (FAMILY_D_RAW_KEYS at
        -- mcp-server/lib/familyDKeys.ts:85-105). Verbatim, in
        -- declaration order:
        'asks_for_evidence',
        'provides_evidence',
        'evidence_supports_claim',
        'creates_source_chain_gap',
        'opens_evidence_debt_marker',
        'closes_evidence_debt_marker',
        'supplies_corroborating_document',
        'source_provided',
        'quote_provided',
        'concrete_example_requested',
        'concrete_example_provided',
        'evidence_claim_present',
        'evidence_gap_present',
        'source_chain_repair',
        'anecdote_used',
        'statistic_used',
        'external_authority_used',
        'evidence_quality_questioned',
        'burden_request_present'
      ) then 'ai_classifier_subset'
      when raw_key in (
        -- 8 deterministic keys explicitly excluded from the Subset.
        -- A non-zero positive count here is a leak indicator.
        -- FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS at
        -- mcp-server/lib/familyDKeys.ts:119-129.
        'has_evidence',
        'source_requested',
        'quote_requested',
        'source_attached',
        'quote_attached',
        'sourced'
      ) then 'deterministic_excluded_leak'
      else 'unknown_key_outside_taxonomy'
    end as subset_membership
  from family_d_observed
)
select
  raw_key,
  run_mode,
  positive_count,
  distinct_arguments,
  subset_membership
from classification
order by
  -- Surface leaks first if any (defensive ordering so the operator
  -- sees the most-urgent classification at the top of the section).
  case subset_membership
    when 'deterministic_excluded_leak' then 1
    when 'unknown_key_outside_taxonomy' then 2
    when 'ai_classifier_subset' then 3
    else 4
  end,
  positive_count desc,
  raw_key;
```

### 4.4 — Live output preview (verified against `npx supabase db query`)

| raw_key | run_mode | positive_count | distinct_arguments | subset_membership |
| --- | --- | --- | --- | --- |
| evidence_gap_present | admin_validation | 2 | 2 | ai_classifier_subset |
| opens_evidence_debt_marker | admin_validation | 2 | 2 | ai_classifier_subset |

**0 rows with `subset_membership = 'deterministic_excluded_leak'`.** The Stage 2B Subset path contract holds in the persisted data.

### 4.5 — Runner SECTIONS new entry

```js
{
  id: 'q15-family-d-subset-coverage',
  title: 'Family D 19-key subset coverage',
  question:
    'Q15 — Are all observed Family D raw_keys within the 19-key ai_classifier Subset, with zero deterministic-key leaks?',
  sqlFile: '15-family-d-subset-coverage.sql',
  columns: [
    'raw_key',
    'run_mode',
    'positive_count',
    'distinct_arguments',
    'subset_membership',
  ],
  emptyMessage:
    'No Family D positive results yet. Subset coverage will populate after admin_validation runs produce positives.',
},
```

---

## 5. supported_families 4-family edge case verification (Phase A.3)

The Q12 SEMANTIC TIGHTENING fix (`docs/audits/OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING-SMOKE-2026-05-27.md:121`) explicitly predicted: *"Future-proof: Family D ship will not require this SQL to change. When Family D's first real-provider row lands (`mcp:classify_argument_boolean_observations`), `evidence_source_chain` will automatically migrate from `unsupported_families` to `supported_families` and disappear from Q12 output."*

This card's Phase A.3 confirmed that prediction held:
- Family D's first real-provider rows landed via MCP-SERVER-005-FAMILY-D admin_validation runs.
- `supported_families` CTE now contains all four families: A, B, C, D (verified live).
- Q12 returns 0 rows (verified live; the post-cleanup test-data state has no unsupported-only-synthetic families left).
- Family D is NOT flagged as unsupported-family attempt.

**Edge case handled correctly:** Family D is the first family in the system that is **MCP-supported but not production-enabled** (admin_validation only). The Q12 data-derived CTE handles this state because the CTE filters on `provider_key not like 'smoke-%'` and **does NOT filter on `run_mode`** — it picks up any real-provider row regardless of mode. This is the correct semantic: a family is "supported" when it has produced real-provider results in any mode.

**No SQL change required to Q12 for this card.** Q12 remains byte-equal per HALT constraint.

### Cross-verification: Q12 expected output post-card

Q12 should continue to return 0 rows because:
1. `supported_families` derivation picks up all 4 real-provider families.
2. The only families with result rows are those 4.
3. `unsupported_families = (all result-bearing families) - supported_families` = empty.
4. The outer SELECT iterates over an empty `unsupported_families` CTE; output is 0 rows.

If a future synthetic-test seed reintroduces a smoke-% row for an unsupported family, Q12 will surface it correctly (the test cleanup ran post-Q12-SEMANTIC-TIGHTENING and removed the prior synthetic rows; the design's expectation is that no new synthetic rows are added).

---

## 6. Test plan (Phase A.4)

### 6.1 — Test file: `__tests__/opsMcpObservabilityFamilyDCoverage.test.ts` (NEW)

Pattern modeled on `__tests__/opsMcpObservabilityQ12SemanticTightening.test.ts` (the most recent precedent for a card-scoped SQL safety test file). Pure Jest; no live DB.

**Test groups:**

#### Group A — Q11 reframe (file rename + new shape)

1. **`renamed file exists at scripts/ops/sql/11-per-family-per-mode-coverage.sql`** — `fs.existsSync` true.
2. **`old filename scripts/ops/sql/11-family-bc-admin-validation-check.sql no longer exists`** — `fs.existsSync` false (the rename is complete; no compat shim).
3. **`Q11 SQL header references OPS-MCP-OBSERVABILITY and per-family per-mode`** — first non-empty line is `--` comment containing both substrings.
4. **`Q11 SQL preserves the 6-column report-parser contract`** — `as <column>` regex assertions for `requested_family`, `run_mode`, `run_count`, `success_count`, `failed_count`, `fallback_count`.
5. **`Q11 SQL no longer hardcodes B+C-only family filter`** — assert no occurrence of `requested_family in ('disagreement_axis', 'misunderstanding_repair')` string.
6. **`Q11 SQL uses unnest(requested_families) for family attribution`** — assert `unnest(requested_families)` substring present.
7. **`Q11 SQL has no verdict tokens`** — banned-token scan (winner / loser / fallacy / etc.).
8. **`lib SECTIONS contains q11-per-family-per-mode-coverage with the 6 expected columns`** — require the lib, find section by id, assert columns.
9. **`lib SECTIONS no longer contains q11-family-bc-admin-validation-check`** — assert absence by id.

#### Group B — Q14 (new file + density math)

10. **`Q14 SQL file exists at scripts/ops/sql/14-per-family-per-mode-signal-density.sql`** — `fs.existsSync` true.
11. **`Q14 SQL header references the 16/14/17/19 family_key_count constants with citations`** — header substring assertions for each of `familyAKeys.ts`, `familyBKeys.ts`, `familyCKeys.ts`, `familyDKeys.ts`.
12. **`Q14 SQL preserves the 7-column report-parser contract`** — `as <column>` regex for `family`, `run_mode`, `runs`, `positives`, `raw_keys_observed`, `family_key_count`, `positives_per_run_key_cell`.
13. **`Q14 SQL hardcoded CASE includes the 4 family constants verbatim`** — substring assertions: `when 'parent_relation' then 16`, `when 'disagreement_axis' then 14`, `when 'misunderstanding_repair' then 17`, `when 'evidence_source_chain' then 19`.
14. **`Q14 SQL uses nullif over runs × family_key_count to handle zero gracefully`** — assert `nullif(` substring + `runs * family_key_count` substring.
15. **`Q14 SQL has no verdict tokens`** — banned-token scan.
16. **`lib SECTIONS contains q14-per-family-per-mode-signal-density with the 7 expected columns`** — find by id, assert columns.

#### Group C — Q15 (new file + Family D subset coverage)

17. **`Q15 SQL file exists at scripts/ops/sql/15-family-d-subset-coverage.sql`** — `fs.existsSync` true.
18. **`Q15 SQL header documents the 19-vs-27 distinction explicitly`** — header substring assertion: `19` AND `27` AND `ai_classifier` AND `Subset` (case-insensitive).
19. **`Q15 SQL header cites mcp-server/lib/familyDKeys.ts at lines 85-105 and 119-129`** — substring assertions for both line references.
20. **`Q15 SQL contains all 19 Subset rawKeys verbatim`** — substring assertions for each of the 19 strings (parameterized describe.each over the 19-key list).
21. **`Q15 SQL contains all 6 deterministic-excluded rawKey strings`** — `has_evidence`, `source_requested`, `quote_requested`, `source_attached`, `quote_attached`, `sourced`.
22. **`Q15 SQL classifies via subset_membership column with the three expected values`** — substring assertion that `'ai_classifier_subset'`, `'deterministic_excluded_leak'`, `'unknown_key_outside_taxonomy'` all appear.
23. **`Q15 SQL preserves the 5-column report-parser contract`** — `raw_key`, `run_mode`, `positive_count`, `distinct_arguments`, `subset_membership`.
24. **`Q15 SQL filters on family = 'evidence_source_chain'`** — substring assertion.
25. **`Q15 SQL has no verdict tokens`** — banned-token scan.
26. **`Q15 ordering prioritizes deterministic_excluded_leak first`** — substring assertion that the ORDER BY contains `when 'deterministic_excluded_leak' then 1`.
27. **`lib SECTIONS contains q15-family-d-subset-coverage with the 5 expected columns`** — find by id, assert columns.

#### Group D — Cross-section invariants

28. **`SECTIONS length is now 16`** — pre-card was 14; +2 (Q14, Q15). Q11 was renamed (counts as a replacement, not addition).
29. **`SECTIONS section ids are stable, unique, and ordered`** — assert ordered list matches the expected sequence (q01...q11 reframed...q12, q13, q14, q15).
30. **`Q11 + Q14 + Q15 all carry the 19-vs-27 / 4-family doctrine note`** — assert each header references the 4-family operational state (`parent_relation`, `disagreement_axis`, `misunderstanding_repair`, `evidence_source_chain`).
31. **`No Q14 or Q15 column name overlaps with Q1-Q13 in a confusing way`** — light sanity check; the column names are unique enough.

#### Group E — Fixture compatibility (live DB shape)

The fixture file `__tests__/fixtures/opsMcpObservabilityFixture.ts` needs to gain `q14-per-family-per-mode-signal-density` and `q15-family-d-subset-coverage` keys. The Q11 key renames from `q11-family-bc-admin-validation-check` to `q11-per-family-per-mode-coverage` and gains 3 columns. Implementer updates the fixture; tests verify the runner stitcher consumes the fixture cleanly.

32. **`fixture has q14-... key with at least 1 row`** — assert via Object.prototype.hasOwnProperty.
33. **`fixture has q15-... key with at least 1 row`** — assert via Object.prototype.hasOwnProperty.
34. **`fixture q11-... key uses the renamed id`** — assert by Object.prototype.hasOwnProperty for the new id; assert absence for the old id.

### 6.2 — Tests possibly added to existing files (NOT counted in the +N forecast)

The existing test files reference SECTIONS shape:

- **`opsMcpObservabilityReportShape.test.ts:58-80`** — pins SECTIONS length at 14 and asserts exact id list. **MUST UPDATE** to expect 16 sections with the renamed id and 2 new ids. Treating these as MODIFIED tests (not new); the existing test count of 12 in this file stays roughly the same (might tick up 1-2 for the new sections). **Forecast: +2 modified-or-new in this file.**
- **`opsMcpObservabilitySqlSafety.test.ts:58`** — pins file count at 14. **MUST UPDATE** to 16 (or 15 if we count the renamed file as a replacement; depends on whether the new files count as +2). With the rename + 2 new files, the count is 15 (Q11 rename = -1, +1 = net 0; Q14 = +1; Q15 = +1). **Forecast: +0 net file count, the test count assertion updates from 14 to 15.**
- **`opsMcpObservabilityEmptyDbSafety.test.ts`** — drives the stitcher with empty fixtures across all sections. The fixture's `FIXTURE_EMPTY_SECTIONS_DATA` (lines 503-518) gains 2 new keys. **Forecast: +2 tests-added by virtue of new fixture entries iterating.**
- **`opsMcpObservabilityMultiFamily.test.ts`** — may need a Family D row added to fixture verification. **Forecast: +1 to +3 modified-or-new tests.**
- **`opsMcpObservabilityDoctrineBanList.test.ts`** — scans the rendered markdown. The added sections gain doctrine-scan coverage automatically. **Forecast: +0 new but the scan now covers more text.**

### 6.3 — Test count forecast summary

| Bucket | Count |
| --- | --- |
| New file `opsMcpObservabilityFamilyDCoverage.test.ts` (Groups A-E) | 34 |
| Modifications to existing test files (counted conservatively) | +5 to +10 |
| **Forecast total** | **+39 to +44** |

**Within the +15 to +40 brief band** (slightly over the upper bound by 4 at the high end). Below the +80 HALT threshold per HALT #15.

If the implementer wants to tighten to the +40 ceiling, they can consolidate Group C's parameterized substring assertions for the 19 Subset rawKeys into 1 test that iterates internally rather than 19 separate tests (the precedent is `opsMcpObservabilitySqlSafety.test.ts` line 85's `describe.each` pattern over DDL keywords). That would drop the count to ~27-32.

**Final forecast: +30 to +44.**

### 6.4 — Run gates (per intent brief §8)

```bash
npm run typecheck
npm run lint
npx jest --testPathPattern="(opsMcp|opsMcpObservability|opsMcpObservabilityFamilyDCoverage)" --no-coverage
cd mcp-server && deno test --allow-net --allow-env --allow-read   # Regression sanity (byte-equal expected)
```

The Deno test sanity check is a regression — no `mcp-server/*` file is modified by this card, so it must remain `614 passed | 0 failed` (per the Phase 1 baseline at spawn).

---

## 7. Report-runner manifest update plan (Phase A.4)

### 7.1 — Insertion point

`scripts/ops/mcp-observability-report-lib.cjs` SECTIONS const (lines 124-304). Three changes:

1. **Edit the Q11 entry (lines 263-270)** — rename `id`, `title`, `question`, `sqlFile`, and add 3 columns (`success_count`, `failed_count`, `fallback_count`).
2. **Add Q14 entry after Q13 (after line 303)** — new SECTIONS member with the 7 columns from §3.6.
3. **Add Q15 entry after Q14** — new SECTIONS member with the 5 columns from §4.5.

The SECTIONS array length goes from 14 to 16. The .mjs entry (`mcp-observability-report.mjs`) does not need changes (it iterates SECTIONS).

### 7.2 — Default-output safety scan extension

The default ban-list scan (`scanMarkdownForBannedTokens` at lib lines 405-417) already iterates BANNED_TOKENS over the entire markdown body before Appendix B. Adding 2 new sections does not change the scan path — the new sections' rendered content is scanned alongside Q1-Q13. **No code change required to the scan.**

The Q14 + Q15 SQL files are scanned by `opsMcpObservabilitySqlSafety.test.ts` automatically (it iterates `scripts/ops/sql/*.sql`). **No code change required to the SQL safety test** beyond updating the file-count assertion from 14 to 15.

### 7.3 — Fixture update

`__tests__/fixtures/opsMcpObservabilityFixture.ts` needs:

- **Rename key**: `q11-family-bc-admin-validation-check` → `q11-per-family-per-mode-coverage`. The fixture rows expand to include the 3 new columns (`success_count`, `failed_count`, `fallback_count`). Also include 1 or more production rows for B/C and admin_validation rows for D to exercise the new shape.
- **Add key**: `q14-per-family-per-mode-signal-density` with sample rows that exercise the density math (including a zero-positives row, a zero-runs case if natural, and rows for all four families).
- **Add key**: `q15-family-d-subset-coverage` with sample rows that exercise `ai_classifier_subset` (the only realistic case today; the test must also verify the SQL **could** classify a deterministic_excluded_leak row if one appeared — this is a unit-test invariant, not a fixture row).
- **Update key**: `FIXTURE_EMPTY_SECTIONS_DATA` gains 2 new empty keys and the renamed key.

### 7.4 — Operator doc update

`docs/ops/OPS-MCP-OBSERVABILITY.md` needs:

- Update "How to interpret the report" Q11 section heading and narrative (was "Family B + C admin-validation-only check", becomes "Per-family per-mode coverage"). Drop the "Healthy state: All Q11 rows have `run_mode = 'admin_validation'`" line.
- Add new Q14 section describing the density formula choice + denominator.
- Add new Q15 section describing the 19-vs-27 distinction and what `subset_membership` values mean.
- Update the table of "47 supported raw_keys (Family A=16, B=14, C=17)" to "66 supported raw_keys (Family A=16, B=14, C=17, D=19)".

### 7.5 — Order of SECTIONS array (final)

```
q01-runs-by-run-mode
q02-runs-by-family
q02b-runs-by-requested-family
q03-runs-by-family-and-status
q04-failure-reasons-by-family
q05-positive-results-by-family
q06-top-positive-raw-keys-by-family
q07-positive-density-7d
q08-source-six-safety
q09-duplicate-runs
q10-family-a-auto-trigger-recent
q11-per-family-per-mode-coverage           ← RENAMED (was q11-family-bc-admin-validation-check)
q12-unsupported-family-attempts
q13-over-under-firing-summary
q14-per-family-per-mode-signal-density     ← NEW
q15-family-d-subset-coverage               ← NEW
```

16 sections total. Insertion is additive after Q13; Q11 is renamed in place.

---

## 8. Read-only boundary list (locked files)

The implementer MUST NOT touch:

- `src/features/nodeLabels/**` — taxonomy + Source 6 query module.
- `src/features/nodeLabels/machineObservationPersistenceQuery.ts` — Source 6 binding line 127.
- `mcp-server/lib/family*.ts` — classifier sources (A/B/C/D key files); the design **reads** these as the source of truth for the 16/14/17/19 constants but does not modify them.
- `mcp-server/lib/familyRegistry*.ts` — registry.
- `mcp-server/tools/classifyArgumentBooleanObservations.ts` — dispatcher.
- `supabase/functions/_shared/booleanObservations/**` — Edge gate (the design **reads** `booleanObservationRequestBuilder.ts` as the source of truth for `MCP_SERVER_SUPPORTED_FAMILY_SOURCES`, does not modify it).
- `supabase/functions/classify-argument-boolean-observations/**` — Edge Function source.
- `supabase/migrations/**` — no new migration; no edits.
- `scripts/ops/sql/01-*.sql` through `scripts/ops/sql/10-*.sql` and `scripts/ops/sql/12-*.sql` + `scripts/ops/sql/13-*.sql` — preserve byte-equal.
- All `__tests__/mcpOneTwoOneB*.test.ts`, `__tests__/mcpOneTwoOneC*.test.ts`, `__tests__/uxOneOneFiveA*.test.ts`, `__tests__/mcpFamilyD*.test.ts` files — preserve byte-equal.
- The 11 S6F-* tests in `mcpOneTwoOneCEdgeSourceSixRunModeFilter.test.ts` — preserve byte-equal.
- The 10 operator-territory untracked files in working tree.

The implementer MAY:

- Rename `scripts/ops/sql/11-family-bc-admin-validation-check.sql` → `scripts/ops/sql/11-per-family-per-mode-coverage.sql` and rewrite its body per §2.
- Create `scripts/ops/sql/14-per-family-per-mode-signal-density.sql` (new file, design §3).
- Create `scripts/ops/sql/15-family-d-subset-coverage.sql` (new file, design §4).
- Edit `scripts/ops/mcp-observability-report-lib.cjs` — SECTIONS const only (the rename + 2 new entries; §7).
- Create `__tests__/opsMcpObservabilityFamilyDCoverage.test.ts` (new test file, §6).
- Edit `__tests__/fixtures/opsMcpObservabilityFixture.ts` — add new keys + rename old key (§7.3).
- Edit `__tests__/opsMcpObservabilityReportShape.test.ts` — update SECTIONS length + id list (§6.2).
- Edit `__tests__/opsMcpObservabilitySqlSafety.test.ts` — update file count assertion (§6.2).
- Edit `__tests__/opsMcpObservabilityEmptyDbSafety.test.ts` — natural test count expansion via fixture (§6.2).
- Edit `__tests__/opsMcpObservabilityMultiFamily.test.ts` — Family D row coverage if needed (§6.2).
- Edit `docs/ops/OPS-MCP-OBSERVABILITY.md` — Q11 narrative + new Q14 + Q15 sections (§7.4).
- Edit `docs/core/current-status.md` — Stage 6.4+ handoff note for the 4-family observability state.

The implementer MUST NOT:

- Add new SQL files outside `scripts/ops/sql/11-*.sql`, `14-*.sql`, `15-*.sql`.
- Modify `package.json` (no new dependencies).
- Run `npx supabase db query` from the unit test suite (only the smoke audit does).
- Add any runtime code change (`mcp-server/*`, `supabase/functions/*`).
- Modify the original observability design `docs/designs/OPS-MCP-OBSERVABILITY.md` (this card has its own design doc).

---

## 9. HALT trigger table (all 16 evaluated)

### Scope (1-7)

| # | HALT trigger | Status |
| --- | --- | --- |
| 1 | Any runtime code change | NOT TRIGGERED — only SQL files + runner manifest + tests + docs |
| 2 | Any registry change | NOT TRIGGERED — `familyRegistry.ts` on both sides is read-only reference |
| 3 | Any production-mode flip | NOT TRIGGERED — Card 2 of this chain handles Family D production flip; this is Card 1 |
| 4 | New taxonomy keys | NOT TRIGGERED — Q15 references existing 19-key Subset and 6 deterministic strings; no new keys |
| 5 | Schema migration | NOT TRIGGERED — no migration file |
| 6 | Source 6 filter change | NOT TRIGGERED — `machineObservationPersistenceQuery.ts` is in the locked boundary list |
| 7 | New family registration | NOT TRIGGERED — no registry edit |

### Correctness (8-12)

| # | HALT trigger | Status |
| --- | --- | --- |
| 8 | New per-family-per-mode query mislabels a family's mode | NOT TRIGGERED — Q11/Q14 use `r.run_mode` directly from the runs table; no derived mode |
| 9 | Family D coverage query conflates 27 taxonomy entries with 19 MCP-routed keys | NOT TRIGGERED — Q15 header explicitly documents the 19-vs-27 distinction; the SQL classifies into `ai_classifier_subset` (19) vs `deterministic_excluded_leak` (6 of the 8; 2 dedupe to the same string) vs `unknown_key_outside_taxonomy` |
| 10 | Q11 reframe drops the original B+C visibility | NOT TRIGGERED — §2.3 documents the preservation property; B+C admin_validation rows are still present in the reframed output as a strict subset of the new rows |
| 11 | supported_families derivation breaks under 4-family state | NOT TRIGGERED — Phase A.3 live verification confirmed Family D is in supported_families; Q12 returns 0 rows correctly |
| 12 | Report runner fails to execute any query | NOT TRIGGERED — Phase A live execution of all 3 new SQL files (current Q11 + designed Q14 + designed Q15) verified each returns valid JSON envelope via `npx supabase db query --linked` |

### Doctrine (13-14)

| # | HALT trigger | Status |
| --- | --- | --- |
| 13 | Report default output exposes evidence_span content, raw bodies, secrets, or tokens | NOT TRIGGERED — all 3 new SQL queries select only aggregate counts + machine-taxonomy values; no `evidence_span`; no `arguments.body`; the SQL safety test catches this if regressed |
| 14 | Verdict tokens in SQL comments or report labels (except negation) | NOT TRIGGERED — section titles use "coverage", "density", "subset coverage"; no winner/loser/correct/dishonest; the design's banned-token list is enforced by `opsMcpObservabilityFamilyDCoverage` and `opsMcpObservabilityDoctrineBanList` tests |

### Working tree (15-16)

| # | HALT trigger | Status |
| --- | --- | --- |
| 15 | Test forecast exceeds +80 | NOT TRIGGERED — forecast +30 to +44, well below +80; well within +40 brief band with optional consolidation |
| 16 | Unclassified untracked files at PR creation | NOT TRIGGERED at design time — only the 10 known operator-territory files; implementer enforces |

**Zero HALT triggers fire at design time.**

---

## 10. Brief ledger

This design is implementer-authored against the operator-authored intent brief at `docs/designs/OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE-intent.md`. Per POSTRUN-UX001 lesson, the brief origin matters.

| Section | Source | Note |
| --- | --- | --- |
| Goal paragraph | Synthesis of intent brief §1-§5 + doctrine | Derived from operator intent statement + Phase 0 4-family inventory |
| §1 Scope reality A.1 | Direct file read of current `11-*.sql` + live `npx supabase db query --linked --file` execution | Confirmed Q11's header narrative is stale; the SQL itself runs cleanly |
| §1 Scope reality A.3 | Live `npx supabase db query --linked --file <tmp>.sql` execution at design authoring | Confirmed Family D ∈ supported_families; Q12 returns 0 rows; 2 observed Family D raw_keys both ∈ 19-key Subset |
| §2 Q11 reframe | Intent brief §2 Decision 1 + designer judgment | Designer chose to rename file (intent brief explicit option); preserved 6-column SECTIONS shape adding 3 status columns |
| §3 Q14 density math | Intent brief §2 Decision 2 + designer Phase A.2 audit | Picked formula 2 (positives / (runs × key_count)); picked Option A (hardcoded CASE) with citation to family key files |
| §4 Q15 Family D subset coverage | Intent brief §2 Decision 3 + designer Phase A.3 audit | Picked separate file approach (Option A); SQL explicitly documents 19-vs-27 distinction; classifies into 3 buckets |
| §5 supported_families verification | Intent brief §3 Decision 4 + Q12 SEMANTIC TIGHTENING audit prediction | Confirmed the audit's "future-proof" prediction held: D migrated automatically |
| §6 Test plan | Intent brief §8 test forecast + design §3 test plan in original OPS-MCP-OBSERVABILITY | Forecast +30 to +44; within +15 to +40 brief band at low/mid; modeled on `opsMcpObservabilityQ12SemanticTightening.test.ts` |
| §7 Runner manifest update | Intent brief §4 Decision 5 + designer SECTIONS analysis | 1 rename + 2 additions; SECTIONS goes from 14 to 16; insertion is additive after Q13 |
| §8 Read-only boundary | Intent brief §5 OUT + intent brief §6 HALT #1-7 + original OPS-MCP-OBSERVABILITY locked-files | Boundary list enforces no runtime code change |
| §9 HALT triggers | Intent brief §6 (16 triggers) | All 16 evaluated; zero fire at design time |
| §10 Brief ledger | POSTRUN-UX001 protocol | This section enumerates source of each interpretation |

**Operator-deferred decisions (post-ship):**

- **Q14 density formula tuning:** the design chose `positives / (runs × key_count)` as the per-(run, key) density. After the operator runs the first smoke with real data, if the value range is hard to interpret (e.g., always between 0.05 and 0.30), the operator may file a follow-up to add a more intuitive presentation (e.g., a percentage rendering). The CLI / report shape stays stable; only the markdown rendering would change.
- **Q15 future families:** the design picked "separate file" (Option A) so future families (E-J) with subset filters can each have their own `16-family-e-subset-coverage.sql` etc. If the operator later prefers a single combined "subset coverage for all subset-filtered families" file, the pattern can converge in a future card.
- **Test count consolidation:** if the implementer wants to land closer to the +40 ceiling, they MAY consolidate the 19 Subset rawKey substring assertions into a single parameterized test via `describe.each`. Either form (19 separate tests or 1 parameterized) is acceptable.
- **Q11 file rename in git history:** the design assumes the implementer uses `git mv` to preserve blame chain. If the implementer creates the new file fresh + deletes the old one, the blame chain is broken; this is acceptable but `git mv` is preferred.

**Open questions for the operator:** **None.** All 5 intent brief decisions (Q11 reframe, Q14 density math, Q15 subset coverage, supported_families 4-family edge case, runner manifest update) are resolved with explicit justifications. All 16 HALT triggers evaluate to NOT TRIGGERED. The 4 Phase A audits were completed live against the database with zero blockers.

---

## 11. Operator steps (if any)

**None required after implementer commits.** This card adds:

- 2 new SQL files (`scripts/ops/sql/14-*.sql`, `scripts/ops/sql/15-*.sql`)
- 1 renamed SQL file (`scripts/ops/sql/11-per-family-per-mode-coverage.sql`)
- 1 new test file (`__tests__/opsMcpObservabilityFamilyDCoverage.test.ts`)
- Modified files: `scripts/ops/mcp-observability-report-lib.cjs`, `__tests__/fixtures/opsMcpObservabilityFixture.ts`, ~3 existing test files (length pin updates), `docs/ops/OPS-MCP-OBSERVABILITY.md`, `docs/core/current-status.md`.

No migration. No Edge Function deploy. No environment variable. No npm dependency. No supabase config change. No runtime code change.

**Operator action POST-merge for smoke audit (per intent brief §9):**

```bash
node scripts/ops/mcp-observability-report.mjs --out-dir /tmp/card1-smoke
```

Then inspect `/tmp/card1-smoke/report.md`:
- Q11 section renamed; per-family per-mode coverage shows all 4 families with both modes
- Q14 section present; density math runs cleanly
- Q15 section present; Family D observed raw_keys are all `ai_classifier_subset`; no `deterministic_excluded_leak` rows
- Q12 still returns 0 rows (Family D not flagged as unsupported)
- Default output safety preserved (no evidence_span / secrets / tokens via grep scan)

Audit lives at `docs/audits/OPS-MCP-OBSERVABILITY-FAMILY-D-COVERAGE-SMOKE-<date>.md`.

---

End of design.
