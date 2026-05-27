# OPS-MCP-OBSERVABILITY — Multi-family MCP classifier telemetry

**Status:** Design draft
**Epic:** OPS — Machine Observation operational telemetry
**Release:** v0.1 (Stage 6.x operational tooling)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/320
**Intent brief:** `docs/designs/OPS-MCP-OBSERVABILITY-intent.md` (binding source; 554 lines)
**Predecessor chain on main:**
- `MCP-SERVER-004-FAMILY-C-SMOKE` PASS at `70b18f2`
- `MCP-SERVER-003-FAMILY-B-SMOKE` PASS at `05b42c3`
- `MCP-021C-AUTO-TRIGGER-FAMILY-A-SMOKE` PASS at `e281753`

---

## Goal (one paragraph)

This card converts seven recurring ad-hoc SQL inspections (per-family run counts, failure-reason aggregation, positive-rawKey density, production-vs-admin_validation separation, cross-family raw_key leak check, duplicate-run detection, recent failure-reason trend) into one reproducible read-only operator script that runs against the linked Supabase project via `npx supabase db query --linked --file <file>` (the existing OAuth-free Management API path) and emits a doctrine-safe markdown report + sibling JSON artifact answering all 13 telemetry questions in intent brief §6. The surface is **script-first, no UI, no migration, no view, no Edge Function change, no taxonomy change** (per intent brief §7 + §8). The Source 6 production-only filter at `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127` is the binding constraint — observability reads BOTH `run_mode='production'` and `run_mode='admin_validation'` rows (so the operator can see both surfaces) but the production rendering chain stays production-only and is independently verified by a section in the report that re-reads the literal source file line. Doctrine constraints that shape the design: `cdiscourse-doctrine §1` (no verdict labels in any section heading or table column; the report describes counts and rawKeys, never claims a person, family, or argument is "winner" / "correct" / "manipulative"); `§3` (engagement / popularity is not surfaced — runs and results have no view-count or like-count columns to begin with, and the report deliberately omits any aggregation that could be misread as a popularity ranking); `§6` (no secrets / no Authorization / no JWT / no service-role in the script source or output); `§10a` (Machine Observations are structural facts about moves, not verdicts on participants — the report's rawKey columns echo the registered key names without adding interpretive language); `evidence-doctrine` (evidence_span content is suppressed by default; an optional `--include-evidence-preview` flag is provided but ships **truncated to 120 chars + doctrine-scanned** before any character prints).

---

## Scope reality (Phase A.1 + A.2 verification output)

### A.1 — Schema reality check (live DB vs intent brief §3)

Verified live via `npx supabase db query --linked --file <tmp>.sql` at design authoring (2026-05-27, post-Family-C smoke). Three queries: `information_schema.columns` for column shape, `pg_indexes` for index list, aggregate counts for row totals.

**Result: zero deviation from intent brief §3.** All columns, types, defaults, and indexes match exactly. Live row counts also match the §3 snapshot:

| Counter | §3 snapshot | Live (2026-05-27) | Match |
| --- | --- | --- | --- |
| Total runs | 30 | 30 | YES |
| Production-mode runs | 7 | 7 | YES |
| Admin_validation-mode runs | 23 | 23 | YES |
| Successful runs | 19 | 19 | YES |
| Failed runs | 11 | 11 | YES |
| Fallback runs | 0 | 0 | YES |
| Total positive result rows | 43 | 43 | YES |

Indexes confirmed present:

| Index | Source file | Used by |
| --- | --- | --- |
| `amor_runs_argument_version_completed_idx` | `20260526000018` | latency / completion-time queries |
| `argument_machine_observation_runs_run_mode_idx` | `20260526000019` | every group-by-run_mode query in this design |
| `amor_results_argument_version_rawkey_idx` | `20260526000018` | per-argument lookup (not used by observability; Source 6 path) |
| `amor_results_run_idx` | `20260526000018` | run → results joins |
| `amor_unique_run_rawkey` | `20260526000018` | UNIQUE constraint; idempotency |

No structural drift; no HALT condition. Design proceeds.

### A.2 — Source 6 binding constraint (literal line content)

Verified directly: `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127` reads:

```ts
.eq('argument_machine_observation_runs.run_mode', 'production');
```

This is the binding production-only filter at the rendering layer. The observability surface MUST NOT alter, weaken, bypass, or shadow this filter. Existing pinning tests in `__tests__/mcpOneTwoOneCEdgeSourceSixRunModeFilter.test.ts`:

| Test ID | What it pins |
| --- | --- |
| S6F-2 | SELECT columns include `argument_machine_observation_runs!inner(run_mode)` |
| S6F-4 | `.eq("argument_machine_observation_runs.run_mode", "production")` is applied |
| S6F-5 | The query NEVER filters by `admin_validation` |
| S6F-7 | Production-mode rows are mapped to `MachineObservationResultRow` and the joined runs object is dropped |

This design preserves all four assertions byte-equal (we do not touch the file, the import path, or any of its callers). The observability surface's "Source 6 safety" section in the report re-reads the literal source-file line and asserts the `'production'` string is present — a string-level (not behavioral) verification that does not require running the JS. The unit-test counterpart re-reads the same line content from the file system and asserts the literal substring.

---

## Data model

**No new data model.** No tables, no columns, no view, no migration. The existing two tables (`argument_machine_observation_runs` + `argument_machine_observation_results`) plus their 5 indexes answer all 13 telemetry questions (Phase 0 evidence per intent brief §3 + verified live in A.1 above).

### Report data shape (TypeScript, in the script source)

The script's internal stitching uses these shapes (not exported, not persisted):

```ts
// Per-query result envelope from `npx supabase db query --linked --file <file> --output json`.
// The CLI wraps row arrays in { boundary: string, rows: T[], warning: string }.
interface SupabaseQueryEnvelope<TRow> {
  boundary: string;
  rows: TRow[];
  warning?: string;
}

// One section in the markdown report = one SQL file = one query result set.
interface ReportSection {
  id: string;                 // stable anchor: 'q01-runs-by-run-mode' etc.
  title: string;              // human-readable, no banned tokens
  question: string;           // restates §6 question number + text
  sqlFile: string;            // path to the SQL file under scripts/ops/sql/
  rows: ReadonlyArray<Record<string, unknown>>;
  columns: ReadonlyArray<string>;  // ordered column list for markdown table
  emptyMessage: string;       // shown when rows.length === 0
}

// The final JSON artifact is the array of sections plus a header.
interface ReportArtifact {
  schemaVersion: 'ops-mcp-observability.report.v1';
  generatedAt: string;        // ISO 8601 UTC
  source: 'linked-supabase';
  defaultTimeWindowDays: 7;   // matches the 7-day overlay queries
  sections: ReadonlyArray<ReportSection>;
}
```

No raw row body content, no `evidence_span` content, no secret values, no `argument_id` strings printed in the default report (Q13 surfaces aggregate counts only; the optional `--include-argument-detail` flag emits a per-argument-id table with no body text per intent brief §11 D4).

---

## File changes

**New files (in-scope):**

- `scripts/ops/mcp-observability-report.mjs` — Node entry point. Approx 350 LOC. Pure Node 20+ (no new deps). Parses argv; iterates 13 SQL files; shells out to `npx supabase db query --linked --file <abs path> --output json` for each; stitches markdown + JSON; runs the Source 6 literal-line verification; emits doctrine-scan ban-list check over its own output before printing. Writes to `--out-dir <path>` (default `./out/ops-observability/<UTC-timestamp>/`).
- `scripts/ops/sql/01-runs-by-run-mode.sql` — Q1
- `scripts/ops/sql/02-runs-by-family.sql` — Q2 (uses `results.family` DISTINCT per run, see D5)
- `scripts/ops/sql/02b-runs-by-requested-family.sql` — Q2 (uses `unnest(requested_families)`, see D5; complements 02 not replaces)
- `scripts/ops/sql/03-runs-by-family-and-status.sql` — Q3
- `scripts/ops/sql/04-failure-reasons-by-family.sql` — Q4
- `scripts/ops/sql/05-positive-results-by-family.sql` — Q5
- `scripts/ops/sql/06-top-positive-raw-keys-by-family.sql` — Q6
- `scripts/ops/sql/07-positive-density-7d.sql` — Q7 (last-7-days time-window overlay)
- `scripts/ops/sql/08-source-six-safety-row-counts.sql` — Q8 supporting data (production vs admin_validation result counts that WOULD render if filter were absent)
- `scripts/ops/sql/09-duplicate-runs.sql` — Q9
- `scripts/ops/sql/10-family-a-auto-trigger-recent.sql` — Q10
- `scripts/ops/sql/11-family-bc-admin-validation-check.sql` — Q11
- `scripts/ops/sql/12-unsupported-family-attempts.sql` — Q12
- `scripts/ops/sql/13-over-under-firing-summary.sql` — Q13
- `__tests__/opsMcpObservabilityReportShape.test.ts` — sections present + ordered + ids stable
- `__tests__/opsMcpObservabilityDoctrineBanList.test.ts` — markdown + JSON never contain banned tokens; uses a JSON fixture for the stitcher
- `__tests__/opsMcpObservabilityNoLiveDb.test.ts` — unit tests use the fixture; no `npx supabase db query` invocation in the test process
- `__tests__/opsMcpObservabilitySourceSixSafety.test.ts` — re-reads `src/features/nodeLabels/machineObservationPersistenceQuery.ts` from disk; asserts the literal `'production'` substring + the literal full `.eq(...)` line; assert-by-absence: no occurrence of `'admin_validation'` in the file
- `__tests__/opsMcpObservabilityNoServiceRoleNoSecrets.test.ts` — source-scan over `scripts/ops/*.mjs` + `scripts/ops/sql/*.sql`: no `SERVICE_ROLE`, no `ANTHROPIC_API_KEY`, no `Bearer`, no `Authorization`, no `sk-ant-`, no `xai-`
- `__tests__/opsMcpObservabilitySqlSafety.test.ts` — for each SQL file: no `select * from public.arguments`, no `select` of `arguments.body`, no `evidence_span` SELECT without aggregation (LENGTH/AVG/MAX/MIN allowed), no `INSERT/UPDATE/DELETE/ALTER/CREATE/DROP`
- `__tests__/opsMcpObservabilityEmptyDbSafety.test.ts` — stitcher with `rows: []` for every section produces a clean markdown report with explicit "no data" lines, no `NaN`, no `undefined`
- `__tests__/opsMcpObservabilityCliArgParsing.test.ts` — `--include-argument-detail`, `--include-evidence-preview`, `--out-dir`, `--time-window-days` parsing
- `__tests__/opsMcpObservabilityEvidencePreviewSafety.test.ts` — when `--include-evidence-preview` is on, every emitted excerpt is ≤ 120 chars AND doctrine-scanned (banned tokens absent); when off (default), no evidence_span content appears anywhere in markdown or JSON
- `__tests__/opsMcpObservabilityMultiFamily.test.ts` — fixture covers all 3 families; aggregation groups correctly; row totals reconcile
- `docs/ops/OPS-MCP-OBSERVABILITY.md` — operator-facing how-to-run + how-to-interpret doc
- `docs/audits/OPS-MCP-OBSERVABILITY-SMOKE-template.md` — 6-phase smoke audit template
- `__tests__/fixtures/opsMcpObservabilityFixture.ts` — JSON-shape fixture covering all 3 families + production / admin_validation / both modes + success / failed / fallback statuses

**Modified files: NONE.** This is a pure-additive card. No existing source touched.

**Deleted files: NONE.**

**Estimated LOC (new):**
- 1 Node script: ~350 LOC
- 14 SQL files: ~10–25 LOC each → ~250 LOC total
- 9 test files: ~80–150 LOC each → ~1000 LOC total
- 2 docs: ~200 LOC each → ~400 LOC
- 1 fixture: ~150 LOC
- **Total: ~2150 LOC of new code/SQL/docs/tests**

---

## API / interface contracts

### CLI surface (`scripts/ops/mcp-observability-report.mjs`)

```
npx node scripts/ops/mcp-observability-report.mjs [flags]

FLAGS
  --out-dir <path>                 Output directory (default: ./out/ops-observability/<UTC>/)
  --time-window-days <int>         Window for Q7 (default: 7)
  --include-argument-detail        Emit a sibling per-argument-id table per family (no body text)
  --include-evidence-preview       Emit truncated (≤120 chars, doctrine-scanned) evidence excerpts
  --json-only                      Skip markdown emission; emit only the JSON artifact
  --no-write                       Run all queries, validate, but do not write files (dry-run)
  --help                           Show usage

EXIT CODES
  0   Success; markdown + JSON written; doctrine scan clean
  1   At least one SQL file failed to execute (preserved exit code from supabase CLI)
  2   Doctrine ban-list scan triggered (DEFENSE-IN-DEPTH; should not fire if SQL files are clean)
  3   Source 6 safety check failed (literal 'production' substring missing or 'admin_validation' present)
  4   --include-evidence-preview emitted an excerpt > 120 chars OR failed doctrine scan (refuse to write)
  5   CLI argument parse error
```

### Script orchestration contract

```
1. Parse argv.
2. Resolve repo root via fileURLToPath(import.meta.url) + relative .. .. .
3. Run Source 6 literal-line safety check FIRST (defensive — if Source 6 was edited, abort BEFORE running queries).
4. For each SQL file in the 14-file ordered list:
     - Resolve absolute path
     - Invoke spawnSync('npx', ['supabase', 'db', 'query', '--linked', '--file', <abs>, '--output', 'json'])
     - Parse stdout; extract `rows` from the SupabaseQueryEnvelope
     - Drop the `boundary` and `warning` envelope keys before storing rows
5. Run doctrine ban-list scan over the stitched markdown + JSON-stringified artifact.
6. If --include-evidence-preview: run additional excerpt safety check (each excerpt ≤ 120 chars + ban-list).
7. Write `<out-dir>/report.md` and `<out-dir>/report.json` (unless --json-only).
8. Print path to written files on stdout (no body content, no secrets).
9. Exit 0.
```

### Doctrine ban-list (asserted both in script and in test)

```js
const BANNED_TOKENS = [
  'winner', 'loser', 'fallacy', 'bad faith', 'manipulative',
  'extremist', 'propagandist', 'liar', 'correct', 'incorrect',
  'dishonest', 'true', 'false', // 'true'/'false' as VERDICT — see exception list below
];

// Exception list — these strings appear in our source code as JSON booleans,
// field names, or status names and are not banned in context:
const ALLOWED_OCCURRENCES = [
  /"true"/, /"false"/,  // JSON literals
  /\btrue\b(?=\s*[,)\]:}])/, /\bfalse\b(?=\s*[,)\]:}])/,  // JS booleans
  // (the rendered markdown should not contain these tokens at all; the
  // exceptions exist for the JSON artifact only)
];
```

The script asserts no banned token survives outside the exception list in the rendered markdown. The JSON artifact may legitimately contain `"status": "success"` etc.; banned tokens are scanned in the markdown only.

---

## Query design

One SQL block per telemetry question. All 13 questions answered. All queries are read-only (`SELECT` only; no `WITH ... INSERT`; no `UPDATE`; no DDL). All queries use available indexes where applicable.

### Q1 — How many runs exist by run_mode?
**SQL file:** `scripts/ops/sql/01-runs-by-run-mode.sql`
**Index used:** `argument_machine_observation_runs_run_mode_idx` (direct on run_mode)

```sql
select
  run_mode,
  count(*) as run_count,
  count(*) filter (where status = 'success') as success_count,
  count(*) filter (where status = 'failed') as failed_count,
  count(*) filter (where status = 'fallback') as fallback_count
from public.argument_machine_observation_runs
group by run_mode
order by run_mode;
```

**Expected shape (live snapshot):**
```
run_mode='admin_validation', run_count=23, success_count=12, failed_count=11, fallback_count=0
run_mode='production',       run_count=7,  success_count=7,  failed_count=0,  fallback_count=0
```

### Q2 — How many runs exist by family?
**Two complementary queries (per D5 resolution).**

**Q2a — via `results.family` DISTINCT (only counts runs that produced at least one positive):**
**SQL file:** `scripts/ops/sql/02-runs-by-family.sql`
**Index used:** `amor_results_run_idx` for the join; `argument_machine_observation_runs_run_mode_idx` if filtering by mode.

```sql
select
  res.family,
  r.run_mode,
  count(distinct r.id) as runs_with_positives
from public.argument_machine_observation_runs r
inner join public.argument_machine_observation_results res
  on res.run_id = r.id
group by res.family, r.run_mode
order by res.family, r.run_mode;
```

**Q2b — via `unnest(runs.requested_families)` (counts every run including those with zero positives):**
**SQL file:** `scripts/ops/sql/02b-runs-by-requested-family.sql`
**Index used:** sequential scan acceptable (~30 rows today); no index needed at this corpus size.

```sql
select
  requested_family,
  run_mode,
  count(*) as total_runs
from (
  select
    unnest(requested_families) as requested_family,
    run_mode
  from public.argument_machine_observation_runs
) t
group by requested_family, run_mode
order by requested_family, run_mode;
```

The two queries together let the operator see both "runs that fired positive" (Q2a) and "runs that were attempted regardless of outcome" (Q2b). Per D5, both ship; the markdown places them side-by-side.

### Q3 — How many runs succeeded / failed by family?
**SQL file:** `scripts/ops/sql/03-runs-by-family-and-status.sql`
**Index used:** sequential scan (small corpus); `unnest` over `requested_families` is the source-of-truth for family attribution because failed runs may not have any results rows.

```sql
select
  requested_family,
  run_mode,
  status,
  count(*) as run_count
from (
  select
    unnest(requested_families) as requested_family,
    run_mode,
    status
  from public.argument_machine_observation_runs
) t
group by requested_family, run_mode, status
order by requested_family, run_mode, status;
```

### Q4 — What are the top failure_reason values by family?
**SQL file:** `scripts/ops/sql/04-failure-reasons-by-family.sql`
**Index used:** sequential scan acceptable; ~11 failed rows today.

```sql
select
  requested_family,
  run_mode,
  failure_reason,
  count(*) as occurrences
from (
  select
    unnest(requested_families) as requested_family,
    run_mode,
    failure_reason
  from public.argument_machine_observation_runs
  where status = 'failed'
    and failure_reason is not null
) t
group by requested_family, run_mode, failure_reason
order by occurrences desc, requested_family, run_mode, failure_reason
limit 100;
```

### Q5 — How many positive result rows exist by family?
**SQL file:** `scripts/ops/sql/05-positive-results-by-family.sql`
**Index used:** sequential scan over results (~43 rows); join via `amor_results_run_idx`.

```sql
select
  res.family,
  r.run_mode,
  count(*) as positive_count,
  count(distinct res.raw_key) as distinct_raw_keys,
  count(distinct res.argument_id) as distinct_arguments,
  count(*) filter (where res.confidence = 'high') as high_confidence_count,
  count(*) filter (where res.confidence = 'medium') as medium_confidence_count,
  count(*) filter (where res.confidence = 'low') as low_confidence_count
from public.argument_machine_observation_results res
inner join public.argument_machine_observation_runs r on r.id = res.run_id
group by res.family, r.run_mode
order by res.family, r.run_mode;
```

### Q6 — What are the top positive raw_keys by family?
**SQL file:** `scripts/ops/sql/06-top-positive-raw-keys-by-family.sql`
**Index used:** `amor_results_argument_version_rawkey_idx` (rawKey-keyed); join via `amor_results_run_idx`.

```sql
select
  res.family,
  r.run_mode,
  res.raw_key,
  count(*) as positive_count,
  count(distinct res.argument_id) as distinct_arguments,
  count(*) filter (where res.confidence = 'high') as high_confidence
from public.argument_machine_observation_results res
inner join public.argument_machine_observation_runs r on r.id = res.run_id
group by res.family, r.run_mode, res.raw_key
order by res.family, r.run_mode, positive_count desc, res.raw_key
limit 100;
```

### Q7 — For a recent time window, what is the positive density per family?
**SQL file:** `scripts/ops/sql/07-positive-density-7d.sql`
**Index used:** `amor_runs_argument_version_completed_idx` on the `completed_at` predicate; results joined via `amor_results_run_idx`.

```sql
with recent_runs as (
  select id, run_mode, started_at, completed_at
  from public.argument_machine_observation_runs
  where started_at >= now() - interval '7 days'
)
select
  res.family,
  r.run_mode,
  count(distinct r.id) as recent_runs,
  count(res.id) as recent_positives,
  case
    when count(distinct r.id) = 0 then null
    else round(count(res.id)::numeric / count(distinct r.id), 3)
  end as positives_per_run
from recent_runs r
left join public.argument_machine_observation_results res on res.run_id = r.id
group by res.family, r.run_mode
order by res.family nulls last, r.run_mode;
```

Note the LEFT JOIN so runs with zero positives appear (family = null in that row).

### Q8 — Are admin_validation rows excluded from production rendering?
**Two-part answer:**

**Part A — literal source-file assertion (script-level, not SQL):**

The script re-reads `src/features/nodeLabels/machineObservationPersistenceQuery.ts`, asserts the literal substring `.eq('argument_machine_observation_runs.run_mode', 'production')` is present, AND asserts no occurrence of the substring `'admin_validation'` in the file. Both assertions are also covered by `opsMcpObservabilitySourceSixSafety.test.ts`.

**Part B — supporting row counts (SQL):**
**SQL file:** `scripts/ops/sql/08-source-six-safety-row-counts.sql`
**Index used:** `argument_machine_observation_runs_run_mode_idx`; `amor_results_run_idx`.

```sql
select
  r.run_mode,
  count(distinct r.id) as runs,
  count(res.id) as results_that_would_render_if_filter_absent
from public.argument_machine_observation_runs r
left join public.argument_machine_observation_results res on res.run_id = r.id
group by r.run_mode
order by r.run_mode;
```

This surfaces the count of admin_validation results that the Source 6 filter is actively excluding (expected: ~36 rows today by subtraction from §3 if we hold the assumption that ~7 of the 43 are production; the actual numbers come from the live query).

### Q9 — Are production rows accumulating duplicates for the same (argument_id, family, run_mode, schema_version, provider_key, model_name) tuple?

**Per D5 resolution:** family lives on `results` not on `runs`. We use a join-through-results-with-DISTINCT-family approach for this query (because the duplicate semantics ARE about the family that fired positive, not what was requested). For runs that produced zero positives, the duplicate question is less meaningful (a run with no positives doesn't produce idempotency conflicts), but we still surface it via a secondary aggregation.

**SQL file:** `scripts/ops/sql/09-duplicate-runs.sql`
**Index used:** sequential scan on runs (small) + `amor_results_run_idx` for the join.

```sql
with run_to_family as (
  -- For each run that produced ANY positive, pick the DISTINCT families fired.
  -- A run requesting multiple families could produce positives for multiple
  -- families; the (run_id, family) tuple is the deduplication key.
  select distinct r.id as run_id, r.argument_id, r.run_mode,
                  r.schema_version, r.provider_key, r.model_name,
                  res.family,
                  r.status
  from public.argument_machine_observation_runs r
  left join public.argument_machine_observation_results res on res.run_id = r.id
  where r.status = 'success'
)
select
  argument_id,
  family,
  run_mode,
  schema_version,
  provider_key,
  model_name,
  count(distinct run_id) as duplicate_successful_runs
from run_to_family
where family is not null
group by argument_id, family, run_mode, schema_version, provider_key, model_name
having count(distinct run_id) > 1
order by duplicate_successful_runs desc, argument_id, family;
```

Expected today: zero rows (Family A auto-trigger idempotency is per-arg; Family B+C admin_validation smokes used distinct argument sets). Non-zero rows would file `OPS-MCP-IDEMPOTENCY-HARDENING` per intent brief §15.

### Q10 — Are Family A auto-trigger production runs happening recently?
**SQL file:** `scripts/ops/sql/10-family-a-auto-trigger-recent.sql`
**Index used:** `argument_machine_observation_runs_run_mode_idx` for the mode predicate; `amor_runs_argument_version_completed_idx` for the `completed_at` filter.

```sql
select
  date_trunc('day', completed_at) as day,
  count(*) as production_runs,
  count(*) filter (where status = 'success') as success_count,
  count(*) filter (where status = 'failed') as failed_count
from public.argument_machine_observation_runs
where run_mode = 'production'
  and 'parent_relation' = any(requested_families)
  and completed_at >= now() - interval '7 days'
group by date_trunc('day', completed_at)
order by day desc;
```

### Q11 — Are Family B and C still admin_validation-only?
**Two-part answer:**

**Part A — registry assertion (script-level):**

The script reads `supabase/functions/_shared/booleanObservations/familyRegistry.ts` and asserts:
- `parent_relation`: `productionEnabled: true`
- `disagreement_axis`: `productionEnabled: false`
- `misunderstanding_repair`: `productionEnabled: false`

**Part B — DB observation (SQL):**
**SQL file:** `scripts/ops/sql/11-family-bc-admin-validation-check.sql`
**Index used:** `argument_machine_observation_runs_run_mode_idx`.

```sql
select
  requested_family,
  run_mode,
  count(*) as run_count
from (
  select unnest(requested_families) as requested_family, run_mode
  from public.argument_machine_observation_runs
  where status = 'success'
) t
where requested_family in ('disagreement_axis', 'misunderstanding_repair')
group by requested_family, run_mode
order by requested_family, run_mode;
```

If any row appears with `requested_family in ('disagreement_axis', 'misunderstanding_repair') and run_mode = 'production'`, the report flags it as a registry-vs-DB inconsistency. Expected today: zero such rows.

### Q12 — Are unsupported-family attempts (D-J) visible as failed runs without positive rows?
**SQL file:** `scripts/ops/sql/12-unsupported-family-attempts.sql`
**Index used:** sequential scan; small corpus.

```sql
with unsupported as (
  select unnest(array[
    'evidence_source_chain', 'argument_scheme', 'critical_question',
    'resolution_progress', 'claim_clarity', 'thread_topology',
    'sensitive_composer'
  ]) as family_name
)
select
  u.family_name as unsupported_family_attempted,
  count(r.id) as attempts,
  count(r.id) filter (where r.status = 'failed') as failed_attempts,
  count(r.id) filter (where r.failure_reason = 'mcp_validation_failed') as mcp_validation_failed_attempts,
  -- Confirm zero positives for unsupported families (binding assertion).
  (
    select count(res.id)
    from public.argument_machine_observation_results res
    inner join public.argument_machine_observation_runs r2 on r2.id = res.run_id
    where res.family = u.family_name
       or u.family_name = any(r2.requested_families)
  ) as positives_observed
from unsupported u
left join public.argument_machine_observation_runs r
  on u.family_name = any(r.requested_families)
group by u.family_name
order by u.family_name;
```

Binding assertion: `positives_observed = 0` for every unsupported family. Non-zero would file a security-adjacent finding.

### Q13 — Can an operator identify whether a family is over-firing or under-firing?

This is a meta-question answered by the **stitched markdown summary** rather than a single SQL query. The report's final section combines:
- Q5 distinct_raw_keys (positive variety)
- Q6 top raw_keys (rawKey concentration)
- Q7 positives_per_run (density trend last 7 days)
- Family registry expected raw_keys count (from `mcp-server/lib/family[ABC]Keys.ts` parsed offline)

**SQL file:** `scripts/ops/sql/13-over-under-firing-summary.sql`
**Index used:** join via `amor_results_run_idx`; predicate on `argument_machine_observation_runs_run_mode_idx`.

```sql
select
  res.family,
  r.run_mode,
  count(distinct r.id) as completed_runs,
  count(distinct res.argument_id) as arguments_with_positives,
  count(distinct res.raw_key) as raw_keys_observed,
  count(res.id) as total_positives,
  round(count(res.id)::numeric / nullif(count(distinct r.id), 0), 3) as avg_positives_per_run,
  round(
    count(distinct res.argument_id)::numeric / nullif(count(distinct r.id), 0),
    3
  ) as fraction_of_runs_with_any_positive
from public.argument_machine_observation_runs r
left join public.argument_machine_observation_results res on res.run_id = r.id
where r.status = 'success'
group by res.family, r.run_mode
order by res.family nulls last, r.run_mode;
```

The markdown section adds a static reference table (expected raw_keys per family from `mcp-server/lib/family[ABC]Keys.ts`: A=16, B=14, C=17) so the operator can compare `raw_keys_observed / expected` and visually identify under-firing (very low fraction) or over-firing (high `avg_positives_per_run`). Crucially the report does NOT label any family as "over-firing" or "under-firing" — it surfaces the ratios and lets the operator interpret.

---

## Output design

### Markdown structure

```
# OPS-MCP-OBSERVABILITY — Multi-family MCP classifier telemetry report

**Generated:** <ISO 8601 UTC>
**Source:** linked Supabase project (read-only)
**Schema version:** ops-mcp-observability.report.v1
**Default time window:** 7 days (Q7 and Q10)

## Table of contents
1. [Q1 — Runs by run_mode](#q01-runs-by-run-mode)
2. [Q2 — Runs by family (positive-firing)](#q02-runs-by-family)
3. [Q2b — Runs by requested family (all attempts)](#q02b-runs-by-requested-family)
4. [Q3 — Runs by family and status](#q03-runs-by-family-and-status)
5. [Q4 — Top failure reasons by family](#q04-failure-reasons-by-family)
6. [Q5 — Positive results by family](#q05-positive-results-by-family)
7. [Q6 — Top positive raw_keys by family](#q06-top-positive-raw-keys-by-family)
8. [Q7 — Positive density (last 7 days)](#q07-positive-density-7d)
9. [Q8 — Source 6 safety assertion](#q08-source-six-safety)
10. [Q9 — Duplicate runs](#q09-duplicate-runs)
11. [Q10 — Family A auto-trigger recent activity](#q10-family-a-auto-trigger-recent)
12. [Q11 — Family B and C admin-validation-only check](#q11-family-bc-admin-validation-check)
13. [Q12 — Unsupported-family attempt visibility](#q12-unsupported-family-attempts)
14. [Q13 — Over/under-firing summary](#q13-over-under-firing-summary)

## Q01 — Runs by run_mode
**Question:** How many runs exist by `run_mode`?
**SQL:** `scripts/ops/sql/01-runs-by-run-mode.sql`
**Index:** `argument_machine_observation_runs_run_mode_idx`

| run_mode | run_count | success_count | failed_count | fallback_count |
| --- | --- | --- | --- | --- |
| admin_validation | 23 | 12 | 11 | 0 |
| production | 7 | 7 | 0 | 0 |

<sub>If empty: "No rows. The runs table contains zero entries for this query."</sub>

## Q02 — Runs by family (positive-firing)
... (same pattern, one section per question)

## Q08 — Source 6 safety assertion
**Question:** Are admin_validation rows excluded from production rendering?

### Part A — literal source-file assertion
Reads `src/features/nodeLabels/machineObservationPersistenceQuery.ts` from disk and asserts:
- Substring `.eq('argument_machine_observation_runs.run_mode', 'production')` is PRESENT.
- Substring `'admin_validation'` is ABSENT.

Result: PASS / FAIL (the script exits 3 on FAIL).

### Part B — supporting DB row counts
**SQL:** `scripts/ops/sql/08-source-six-safety-row-counts.sql`

| run_mode | runs | results_that_would_render_if_filter_absent |
| --- | --- | --- |
| admin_validation | 23 | 36 |
| production | 7 | 7 |

The "results_that_would_render_if_filter_absent" count for admin_validation is the number of result rows the Source 6 filter is actively excluding from production rendering today.

## (continues for Q01-Q13)

## Appendix A — Family registry source-of-truth
- MCP server registry: `mcp-server/lib/familyRegistryInit.ts`
  - registered families: `parent_relation`, `disagreement_axis`, `misunderstanding_repair`
- Edge registry: `supabase/functions/_shared/booleanObservations/familyRegistry.ts`
  - productionEnabled: `parent_relation` only
  - adminValidationEnabled: all 10 declared families

## Appendix B — Doctrine scan
Banned tokens scanned and absent: winner, loser, fallacy, bad faith, manipulative, extremist, propagandist, liar, correct, incorrect, dishonest, true, false (as verdicts).
Source 6 filter literal present: YES.
Evidence span preview included: NO (default).
```

### JSON schema (sibling artifact)

```jsonc
{
  "schemaVersion": "ops-mcp-observability.report.v1",
  "generatedAt": "2026-05-27T18:00:00.000Z",
  "source": "linked-supabase",
  "defaultTimeWindowDays": 7,
  "sourceSixSafety": {
    "literalProductionStringPresent": true,
    "literalAdminValidationStringAbsent": true,
    "filePathChecked": "src/features/nodeLabels/machineObservationPersistenceQuery.ts"
  },
  "familyRegistrySnapshot": {
    "mcpServerSource": "mcp-server/lib/familyRegistryInit.ts",
    "edgeRegistrySource": "supabase/functions/_shared/booleanObservations/familyRegistry.ts",
    "productionEnabled": ["parent_relation"],
    "adminValidationEnabled": [
      "parent_relation", "disagreement_axis", "misunderstanding_repair",
      "evidence_source_chain", "argument_scheme", "critical_question",
      "resolution_progress", "claim_clarity", "thread_topology", "sensitive_composer"
    ]
  },
  "sections": [
    {
      "id": "q01-runs-by-run-mode",
      "title": "Runs by run_mode",
      "question": "Q1 — How many runs exist by run_mode?",
      "sqlFile": "scripts/ops/sql/01-runs-by-run-mode.sql",
      "columns": ["run_mode", "run_count", "success_count", "failed_count", "fallback_count"],
      "rows": [
        { "run_mode": "admin_validation", "run_count": 23, "success_count": 12, "failed_count": 11, "fallback_count": 0 },
        { "run_mode": "production", "run_count": 7, "success_count": 7, "failed_count": 0, "fallback_count": 0 }
      ]
    }
    // ... 13 more sections (Q02, Q02b, Q03, Q04, Q05, Q06, Q07, Q08, Q09, Q10, Q11, Q12, Q13)
  ]
}
```

### No banned tokens in any section heading or label

Verified by direct inspection of the markdown skeleton above:
- Section headings: "Runs by run_mode", "Positive results by family", "Source 6 safety assertion", "Over/under-firing summary" etc.
- The word "over-firing" and "under-firing" appear in the Q13 question text (as the original §6 phrasing) but are NOT applied as verdicts to any specific family in the report output (the report surfaces ratios; operator interprets).
- No occurrence of: winner / loser / fallacy / bad faith / manipulative / extremist / propagandist / liar / correct / incorrect / dishonest.

---

## Safety + doctrine scan strategy

### Source-scan tests (Tier 1 — script + SQL source files)

`__tests__/opsMcpObservabilityNoServiceRoleNoSecrets.test.ts` reads every file in `scripts/ops/` (recursively) and asserts:
- No literal `SERVICE_ROLE`, `service_role`, `service-role`, `SUPABASE_SERVICE_ROLE_KEY`.
- No literal `ANTHROPIC_API_KEY`, `anthropic`, `xai`, `X_BEARER_TOKEN`.
- No literal `Bearer ` (with trailing space).
- No literal `Authorization` (case-insensitive).
- No `sk-ant-`, `xai-`, `sb_secret`, `sbp_secret_`.
- No `process.env.SUPABASE_SERVICE_ROLE_KEY` reference.

`__tests__/opsMcpObservabilitySqlSafety.test.ts` reads every `scripts/ops/sql/*.sql` file and asserts:
- No `INSERT`, `UPDATE`, `DELETE`, `ALTER`, `CREATE`, `DROP`, `TRUNCATE`, `GRANT`, `REVOKE` keywords (case-insensitive).
- No `select * from public.arguments` substring.
- No `select` of `arguments.body` (regex `\barguments\.body\b` only acceptable inside `LENGTH(`, `AVG(`, `MAX(`, `MIN(`, `COALESCE(` aggregations — the test allows these wrappers and rejects bare selects).
- No `evidence_span` SELECT without aggregation (same allow-wrapper logic).

### Output-scan tests (Tier 2 — rendered markdown + JSON)

`__tests__/opsMcpObservabilityDoctrineBanList.test.ts` uses the fixture to render markdown + JSON, then scans for the BANNED_TOKENS list (with the explicit exception list for JSON booleans and field names). Asserts no banned token survives in the markdown render.

`__tests__/opsMcpObservabilityEvidencePreviewSafety.test.ts`:
- Default (no `--include-evidence-preview`): no occurrence of `evidence_span` field VALUES in markdown or JSON (only the column NAME may appear in SQL or schema descriptions).
- With flag: every emitted excerpt is ≤ 120 chars AND scanned against BANNED_TOKENS. Refuses to write if either fails (exit code 4).

### Source 6 byte-equal preservation

`__tests__/opsMcpObservabilitySourceSixSafety.test.ts` is the script-side counterpart to the existing `mcpOneTwoOneCEdgeSourceSixRunModeFilter.test.ts`:
- Reads `src/features/nodeLabels/machineObservationPersistenceQuery.ts` from disk.
- Asserts the literal string `.eq('argument_machine_observation_runs.run_mode', 'production')` is present.
- Asserts the literal string `'admin_validation'` is ABSENT from the file.

The 11 existing S6F-* tests in `mcpOneTwoOneCEdgeSourceSixRunModeFilter.test.ts` are NOT modified by this card and remain byte-equal.

---

## Test plan

Forecast: **+72 to +88 tests**, within the +40 to +80 band (slightly above on the higher end; well below the +200 HALT threshold).

| Test file | New tests | What it covers |
| --- | --- | --- |
| `__tests__/opsMcpObservabilityReportShape.test.ts` | ~12 | sections present + ordered + ids stable; section ids match expected anchors (q01...q13); columns ordered correctly; empty-rows handling shape |
| `__tests__/opsMcpObservabilityDoctrineBanList.test.ts` | ~14 | markdown + JSON ban-list scan; exception list works; fixture produces clean output; each banned token absent (one assertion per banned token in the BANNED_TOKENS list) |
| `__tests__/opsMcpObservabilityNoLiveDb.test.ts` | ~4 | the test process never invokes `npx supabase db query`; the stitcher is driven entirely by the fixture; no `spawnSync` calls in the unit test path |
| `__tests__/opsMcpObservabilitySourceSixSafety.test.ts` | ~6 | literal 'production' substring present; literal 'admin_validation' absent from `machineObservationPersistenceQuery.ts`; the test reads the file fresh each run (no cache); fails if file is moved or content changes such that 'production' no longer appears |
| `__tests__/opsMcpObservabilityNoServiceRoleNoSecrets.test.ts` | ~10 | scans `scripts/ops/**/*.{mjs,sql}`; one assertion per banned token category (SERVICE_ROLE, ANTHROPIC_API_KEY, Bearer, Authorization, sk-ant-, xai-, sb_secret, sbp_secret_, process.env.SUPABASE_SERVICE_ROLE_KEY) |
| `__tests__/opsMcpObservabilitySqlSafety.test.ts` | ~15 | per-SQL-file safety: no DDL keywords (one assertion per keyword × 14 files compressed via parameterized describes); no bare `arguments.body`; no bare `evidence_span` |
| `__tests__/opsMcpObservabilityEmptyDbSafety.test.ts` | ~8 | empty rows in every section produce explicit "no data" line; no NaN; no undefined; markdown still renders all 13 sections; JSON has empty arrays not nulls |
| `__tests__/opsMcpObservabilityCliArgParsing.test.ts` | ~10 | `--out-dir`, `--time-window-days`, `--include-argument-detail`, `--include-evidence-preview`, `--json-only`, `--no-write`, `--help`; default values; invalid values rejected |
| `__tests__/opsMcpObservabilityEvidencePreviewSafety.test.ts` | ~7 | default off → no evidence content; flag on → ≤ 120 chars; doctrine scan on excerpts; exit code 4 on failure |
| `__tests__/opsMcpObservabilityMultiFamily.test.ts` | ~8 | fixture covers A+B+C; Q5 reconciles totals; Q2 vs Q2b cross-check (Q2 ≤ Q2b counts per family); registry expected vs observed reconciliation |
| **Total forecast** | **~94** | (slightly over upper band; still within HALT) |

Re-forecast: **+94 tests**, which is over the +40-to-+80 upper band by ~14 but well within HALT (+200). Justification: 6 of the 9 test files are minimum-coverage (3-8 tests each); the parameterized SQL safety file and the multi-banned-token doctrine file account for most of the surplus. If the implementer wants to consolidate by parameterization, the count could drop to ~70-80.

**Existing tests preserved byte-equal:**
- All 22 `mcpOneTwoOneC*.test.ts` files — untouched.
- All 9 `mcpOneTwoOneB*.test.ts` files — untouched.
- The 11 S6F-* assertions in `mcpOneTwoOneCEdgeSourceSixRunModeFilter.test.ts` — untouched.
- All `uxOneOneFiveA*.test.ts` files — untouched.

**No live DB calls in unit tests.** The fixture in `__tests__/fixtures/opsMcpObservabilityFixture.ts` provides a complete `SupabaseQueryEnvelope`-shaped object for every section's expected output. The stitcher is exported separately from the spawnSync invocation so tests can drive it with the fixture directly.

**Run gates (per intent brief §13):**
- `npm run typecheck`
- `npm run lint`
- `npx jest --testPathPattern="(mcpOneTwoOneB|mcpOneTwoOneC|uxOneOneFiveA|opsMcpObservability)" --no-coverage`
- `npm test` (full suite)

Network discipline: unit tests do not make live DB calls. Smoke audit (Phase 2 of the smoke plan) does.

---

## Smoke plan

Parallel to the Family C smoke template. 6 phases (no Phase 7/8 — this card has no Edge deploy and no hosted MCP component). Smoke template lives at `docs/audits/OPS-MCP-OBSERVABILITY-SMOKE-template.md`.

### Phase 1 — Pre-flight
- HEAD at merge SHA.
- Working tree contains only the 10 known operator-territory untracked files.
- Predecessor audits present (Family A auto-trigger, Family B, Family C, validator-refactor).
- `npx supabase db query --linked --output json` returns a valid JSON envelope against a trivial `select 1` query (Management API reachable; OAuth not required for this path).
- Source 6 file at `src/features/nodeLabels/machineObservationPersistenceQuery.ts` byte-equal to pre-merge.

### Phase 2 — Run the report against linked Supabase
- `node scripts/ops/mcp-observability-report.mjs --out-dir <tmp>` executed by operator.
- Exit code 0 captured.
- `report.md` and `report.json` produced.
- All 13 sections present in markdown (assert by section heading grep).
- JSON validates against the schema (run `jq` on `.schemaVersion` etc.).

### Phase 3 — Verify each required section is populated
- Q1 — 2 rows (production + admin_validation).
- Q2 + Q2b — 1+ row per active family.
- Q3 — rows for each (family, mode, status) combination present.
- Q4 — failure_reasons surfaced (mcp_validation_failed primary candidate).
- Q5 — Family A, B, C positives counted.
- Q6 — top raw_keys per family present.
- Q7 — 7-day window populated (or "no recent activity" if window is empty).
- Q8 — Source 6 safety assertion PASS.
- Q9 — duplicate-runs query returned (zero rows expected; non-zero would file `OPS-MCP-IDEMPOTENCY-HARDENING`).
- Q10 — Family A auto-trigger 7-day activity present (or "no recent activity").
- Q11 — registry says B+C not production; DB confirms zero production rows for B+C.
- Q12 — D-J unsupported attempts visible; all have `positives_observed = 0`.
- Q13 — over/under-firing summary present.

### Phase 4 — Verify default output safety
- `grep -E "(Bearer|service_role|SERVICE_ROLE|ANTHROPIC_API_KEY|sk-ant-|xai-)" <out-dir>/report.md` returns no matches.
- `grep -E "(winner|loser|fallacy|bad faith|manipulative|extremist|propagandist|liar)" <out-dir>/report.md` returns no matches.
- `grep -E "BEGIN [A-Z ]+PRIVATE KEY" <out-dir>/report.md` returns no matches.
- File size sanity: markdown < 100 KB (sanity bound — 13 sections of aggregate rows should not exceed this).
- No `evidence_span` content present in default output (grep for any 240-char-ish runs of free text — none expected).

### Phase 5 — Targeted regression
- `npx jest --testPathPattern="(mcpOneTwoOneB|mcpOneTwoOneC|uxOneOneFiveA|opsMcpObservability)" --no-coverage`
- All exit 0.
- New `opsMcpObservability*` test counts match the design forecast (~94 tests).

### Phase 6 — OPS observations + verdict + audit doc commit
- PASS criteria: Phase 1-5 all PASS; report produced; default output safe; all targeted regressions green.
- PARTIAL criteria: report runs but some family has no positives yet (e.g., Family C ages out of 7-day window); explicit "no data" line present rather than missing section.
- FAIL criteria: report prints raw bodies or secrets; report cannot distinguish run_mode; SQL files contain DDL; targeted regressions fail.

### Smoke proof of correctness (D8 resolution)

The smoke verifies:
1. The report runs against linked Supabase (Phase 2 exit 0).
2. All 13 sections are present (Phase 3 grep).
3. No banned tokens in default output (Phase 4 grep).
4. Production vs admin_validation separation visible in Q1 and Q8 (Phase 3 + 4 cross-check).
5. Source 6 safety section asserts the literal 'production' filter (Phase 3 Q8 PASS).
6. Targeted regression including the 11 S6F-* tests passes (Phase 5).

---

## Read-only boundary list (locked files)

The implementer MUST NOT touch:

- `src/features/nodeLabels/**` — taxonomy + Source 6 query module (taxonomy registry; Source 6 query at `machineObservationPersistenceQuery.ts:127`).
- `src/features/nodeLabels/machineObservationPersistenceQuery.ts` — explicit; line 127 is the binding constraint.
- `mcp-server/lib/family*.ts` — classifier sources (Family A, B, C key files, validators, prompts).
- `mcp-server/lib/familyRegistryInit.ts` — read-only reference for family list (the script READS this file as input; does not modify it).
- `mcp-server/lib/familyRegistry.ts` — Edge-side registry interfaces.
- `mcp-server/tools/classifyArgumentBooleanObservations.ts` — dispatcher.
- `supabase/functions/_shared/booleanObservations/**` — Edge gate (the script READS `familyRegistry.ts` as input; does not modify it).
- `supabase/functions/classify-argument-boolean-observations/**` — Edge Function source.
- `supabase/migrations/**` — no new migration; no edits to existing.
- `__tests__/mcpOneTwoOneB*.test.ts` (9 files) — preserve byte-equal.
- `__tests__/mcpOneTwoOneC*.test.ts` (22 files) — preserve byte-equal.
- `__tests__/uxOneOneFiveA*.test.ts` (UX-001.5A regression coverage) — preserve byte-equal.
- The 10 operator-territory untracked files in working tree.

The implementer MAY create files under:

- `scripts/ops/` (new directory)
- `scripts/ops/sql/` (new sub-directory)
- `__tests__/opsMcpObservability*.test.ts`
- `__tests__/fixtures/opsMcpObservabilityFixture.ts`
- `docs/ops/OPS-MCP-OBSERVABILITY.md`
- `docs/audits/OPS-MCP-OBSERVABILITY-SMOKE-template.md`

The implementer MUST NOT:

- Modify `package.json` (no new dependencies; pure Node 20+ stdlib).
- Add an npm script entry (optional and out of scope for v0; operator runs via `node scripts/ops/mcp-observability-report.mjs`).
- Run `npx supabase db query` from the unit test suite (only the smoke audit does).

---

## HALT trigger table (all 22 evaluated against the design)

| # | HALT trigger | Status |
| --- | --- | --- |
| 1 | Proposes client-side service-role or direct DB access | NOT TRIGGERED — script uses `npx supabase db query --linked` (Management API; OAuth-free; operator-only); no client code touched |
| 2 | Proposes exposing secrets | NOT TRIGGERED — source-scan test enforces no SERVICE_ROLE, ANTHROPIC_API_KEY, Bearer, Authorization in script source; output never logs these |
| 3 | Proposes printing raw argument bodies by default | NOT TRIGGERED — Q5/Q6/Q9 aggregate at family/raw_key level; no body content selected by any SQL file |
| 4 | Proposes printing full evidence spans by default | NOT TRIGGERED — default skips `evidence_span`; optional flag truncates to ≤120 + doctrine-scans |
| 5 | Proposes changing taxonomy | NOT TRIGGERED — `src/features/nodeLabels/**` locked; no edits |
| 6 | Proposes changing classifier prompts | NOT TRIGGERED — `mcp-server/lib/family*Prompt.ts` locked |
| 7 | Proposes changing MCP server runtime behavior | NOT TRIGGERED — `mcp-server/**` locked |
| 8 | Proposes enabling production mode for Family B or C | NOT TRIGGERED — registry not modified; Q11 surfaces current state and asserts B+C still admin-only |
| 9 | Proposes modifying Source 6 rendering | NOT TRIGGERED — `machineObservationPersistenceQuery.ts` locked; Q8 re-reads the line and asserts |
| 10 | Proposes auto-trigger changes | NOT TRIGGERED — auto-trigger files untouched; Q10 only observes |
| 11 | Proposes new tables/migrations before proving existing tables are insufficient | NOT TRIGGERED — A.1 confirms existing tables answer all 13 questions |
| 12 | Proposes UI before evaluating script/report first | NOT TRIGGERED — script-only (D1 = script + SQL files) |
| 13 | Weakens admin_validation / production separation | NOT TRIGGERED — Q8 + S6F-* tests independently pin the separation |
| 14 | Cannot distinguish production vs admin_validation rows | NOT TRIGGERED — Q1 explicitly groups by run_mode |
| 15 | Cannot group by family | NOT TRIGGERED — Q2/Q2b/Q5/Q6 all group by family |
| 16 | Cannot identify failure reasons | NOT TRIGGERED — Q4 aggregates failure_reason text |
| 17 | Cannot identify rawKey positive density | NOT TRIGGERED — Q6 + Q7 surface raw_key density |
| 18 | Test forecast exceeds +200 without rationale | NOT TRIGGERED — forecast +94; rationale documented above |
| 19 | Requires OAuth / browser interaction for basic report generation | NOT TRIGGERED — `npx supabase db query --linked` uses Management API (no OAuth flow) |
| 20 | Adds third-party observability vendor | NOT TRIGGERED — pure Node 20+ stdlib; no new deps |
| 21 | Dirty worktree includes smoke artifacts at PR creation | NOT TRIGGERED at design time; implementer enforces |
| 22 | Doctrine verdict / person-language in operator-facing report labels | NOT TRIGGERED — ban-list test scans every label; no winner/loser/etc. in any section heading |

**Zero HALT triggers fire at design time.**

---

## Design-question resolution table (D1-D8)

| D# | Question | Resolution | Justification |
| --- | --- | --- | --- |
| D1 | Script vs SQL view vs admin UI | **Script + SQL files (hybrid C — Option 12.C).** Node `.mjs` entry shells out to `npx supabase db query --linked --file <file>` per SQL file; SQL files are individually replayable. | Aligned with intent brief §8 default. Hybrid C balances reproducibility (each SQL file standalone) with stitching ergonomics (Node handles ban-list scan, file writes, Source 6 literal check). Operator can run any single SQL file directly with `npx supabase db query --linked --file scripts/ops/sql/01-runs-by-run-mode.sql`. |
| D2 | Output format | **Both — markdown primary, JSON sibling.** Default emits both; `--json-only` flag skips markdown. | Markdown is operator-facing per intent brief §8 + §11; JSON enables follow-on tooling (next card `OPS-MCP-IDEMPOTENCY-HARDENING` may consume JSON). |
| D3 | Default time window | **All-time aggregates + 7-day overlay (Q7, Q10).** Configurable via `--time-window-days <int>` (affects Q7 + Q10 only). | Aligned with intent brief §11 default. Most queries are state-of-the-corpus (all-time); only the recency-sensitive queries (Q7 positive density, Q10 auto-trigger heartbeat) use the window. |
| D4 | Per-argument detail vs aggregates only | **Aggregates only by default; `--include-argument-detail` flag emits a per-argument-id table (no body text).** | Aligned with intent brief §11 default. Aggregate is the audit primary; argument-detail is for the rare drill-down where an operator wants to know "which specific arguments fired positive for `acknowledges_misread`". Even with the flag, only `argument_id` (a uuid) is emitted, not body. |
| D5 | Duplicate-run query semantics | **Both join-through-results-with-DISTINCT-family (Q2 + Q9) AND unnest-requested_families (Q2b + Q3 + Q4 + Q11).** Q2 and Q2b are sibling sections. | Per intent brief §11 D5 the family lives on `results` not `runs`. The two approaches answer different questions: Q2 ("which families actually fired positive in this run?") via results join; Q2b ("which families were attempted regardless of outcome?") via unnest. Failed runs have no results rows so Q3/Q4 must use unnest. Q9 uses join-through-results because duplicates are meaningful only for runs that produced positives (a duplicate run with zero positives is not an idempotency concern). |
| D6 | Family support status surface | **Static enumeration in report's Appendix A, citing two source-of-truth files (`mcp-server/lib/familyRegistryInit.ts` + `supabase/functions/_shared/booleanObservations/familyRegistry.ts`), annotated with `observed in DB` from Q5.** | Aligned with intent brief §11 default. The script reads both source files at runtime, parses their static `register('...')` calls + `productionEnabled: true/false` flags, and prints the snapshot alongside the DB-observed positives. If the static enumeration drifts from the source files, a test catches it. |
| D7 | DB view necessity | **NO — no migration, no view.** | Aligned with intent brief §11 default. A view encapsulating Source 6's production filter would be reusable, but it requires a migration which would expand scope beyond the operator-script preference in §8. Future card `OPS-MCP-OBSERVABILITY-DB-VIEW` (currently unfiled) could add it if the script pattern reveals a need; the existing Source 6 query is the canonical filter and is independently tested. |
| D8 | Smoke proof of correctness | **6-criterion verdict.** The smoke verifies: (1) report runs against linked Supabase (exit 0), (2) all 13 sections present (grep), (3) no banned tokens in default output (grep), (4) production vs admin_validation separation visible in Q1/Q8 (grep), (5) Source 6 safety section PASS (Q8 explicit), (6) targeted regression (mcpOneTwoOneB+C, uxOneOneFiveA, opsMcpObservability) all PASS. | These six checks together prove correctness end-to-end: the queries are reachable, the report shape is stable, the doctrine guarantees hold, the production filter is intact, and no existing test surfaces regressed. |

---

## Brief ledger

This design is implementer-authored against the operator-authored intent brief at `docs/designs/OPS-MCP-OBSERVABILITY-intent.md`. Per POSTRUN-UX001 lesson, the brief origin matters.

| Section | Source | Note |
| --- | --- | --- |
| Goal paragraph | Synthesis of intent brief §1-§5 | Derived from operator intent statement + cdiscourse-doctrine constraints |
| Scope reality A.1 (schema check) | Live DB query at design authoring | Zero deviation from intent brief §3 |
| Scope reality A.2 (Source 6 line) | Direct file read of `machineObservationPersistenceQuery.ts:127` | Zero deviation from intent brief §4 |
| Data model | Intent brief §3 schema snapshot | No new data model |
| File changes | Designer judgment within intent brief §17 file allowlist | All proposed files match brief ledger |
| Query design Q1-Q13 | Intent brief §6 telemetry questions (13/13 answered) | Each query designer-authored; index usage verified against A.1 |
| Output design | Intent brief §11 D2-D4 defaults + designer markdown structure | Designer-authored structure; defaults aligned with brief |
| Safety + doctrine | Intent brief §9 telemetry safety rules | Three tiers of scan (script-source, output, Source 6 byte-equal) |
| Test plan | Intent brief §13 binding minimum + designer expansion | Forecast +94 (slightly above upper band; rationale provided) |
| Smoke plan | Intent brief §14 6-phase template | Parallel to Family C smoke |
| HALT triggers | Intent brief §10 (22 triggers) | All 22 evaluated; zero fire at design time |
| Design-question resolution D1-D8 | Intent brief §11 defaults + designer justification | D1=hybrid C; D2=both; D3=all-time+7d; D4=aggregates default; D5=both; D6=static+annotated; D7=NO view; D8=6-criterion |

**Operator-deferred decisions (post-ship):**

- The `--include-evidence-preview` flag exists in the design (per intent brief §9 "evidence span inspection: optional flag only; default off; if implemented, max 120 chars per excerpt + doctrine scan required if so"). Whether to actually invoke it in production smoke runs is operator discretion; default smoke runs without the flag.
- The 7-day window default (Q7, Q10) may need re-tuning once the operator runs the first smoke and sees the corpus density. The CLI flag `--time-window-days` makes this trivial to adjust without a code change.

---

## Risks

1. **`npx supabase db query --linked --output json` envelope shape.** The CLI wraps rows in `{ boundary: string, rows: T[], warning: string }`. The script's parser must handle this envelope and drop both `boundary` and `warning` before stitching. The fixture must mirror this shape exactly. Mitigation: explicit parser unit test in `opsMcpObservabilityReportShape.test.ts`; fixture documents the envelope.
2. **Drift between `mcp-server/lib/familyRegistryInit.ts` and `supabase/functions/_shared/booleanObservations/familyRegistry.ts`.** Two source-of-truth files for "what families exist". If they drift, the report's Appendix A would surface the inconsistency but the runtime would already be broken. Mitigation: the report explicitly lists both files and their parsed content side-by-side. Drift is operator-observable from the report itself.
3. **SQL parser strictness in `opsMcpObservabilitySqlSafety.test.ts`.** The "no DDL keyword" check is regex-based and may have edge cases. For example, `select ... from public.argument_machine_observation_results res` contains `creates`-adjacent substrings if a future column or table is named with a problematic substring. Mitigation: the regex uses word boundaries (`\bCREATE\b` etc.); tests assert each safety rule with positive and negative examples.
4. **`--include-evidence-preview` flag implementation.** The 120-char truncation must happen BEFORE doctrine scan, and the doctrine scan must happen BEFORE write. Off-by-one in the truncation could leak a banned token. Mitigation: explicit unit test that constructs an evidence span containing each banned token at characters 115-120 and asserts the doctrine scan catches it post-truncation.
5. **`npx supabase db query` performance with 14 sequential invocations.** Each invocation re-authenticates to the Management API. Empirically (~1s per query in A.1), the full report should take ~15-20s. Acceptable for a manual operator command; not acceptable for a cron job (cron is out of scope). Mitigation: the script prints elapsed time per section; future optimization (single connection, prepared statements) is a separate card.
6. **Test-count forecast over upper band.** +94 tests vs the +40-to-+80 brief upper band. Per HALT trigger #18 the HALT threshold is +200, so we are clear. Justification: 6 of 9 test files are minimum-coverage (3-8 tests each); the parameterized files surface the count. The implementer MAY consolidate via parameterization to land closer to the upper band of the forecast.
7. **Doctrine ban-list false positives.** The word `false` appears legitimately in JSON booleans, status names ("failed" contains it but not as a verdict), and the registry literal `false` value. The exception list and the markdown-only scan (not JSON-content scan for these tokens) keeps false positives manageable. Mitigation: explicit test cases for "the word `false` in `\"productionEnabled\": false` is allowed in JSON but banned in markdown narrative text".
8. **Markdown vs JSON content divergence.** The doctrine ban-list scan applies to markdown only (JSON legitimately contains `"status": "success"` etc.). A future maintainer might add narrative content to JSON. Mitigation: tests assert the JSON schema does not contain banned-narrative fields; new narrative fields would require updating the schema and re-running the scan.

---

## Dependencies

### Upstream (this card assumes complete)

- **MCP-021B** (`20260526000018`): the runs + results tables exist with RLS.
- **MCP-021C-EDGE** (`20260526000019`): the `run_mode` column + `argument_machine_observation_runs_run_mode_idx` index.
- **MCP-021C-EDGE** (Source 6 query layer): the production-only filter at `machineObservationPersistenceQuery.ts:127`.
- **MCP-SERVER-002** (Family A registration): `parent_relation` registered in MCP server.
- **MCP-SERVER-003** (Family B registration): `disagreement_axis` registered.
- **MCP-SERVER-004** (Family C registration): `misunderstanding_repair` registered.
- **OPS-MCP-FAMILY-VALIDATOR-REFACTOR**: shared validator registry pattern.
- **MCP-021C-AUTO-TRIGGER-FAMILY-A**: production traffic for Family A; required for Q10 to surface data.

### Downstream (this card unblocks / informs)

- **`OPS-MCP-IDEMPOTENCY-HARDENING`** — Q9 surfaces duplicate-run candidates. If Q9 returns non-zero rows at first smoke, file this card.
- **`OPS-MCP-TOKEN-BUDGET`** — Q5 + Q7 surface latency-vs-positive-density signals. If saturation evidence appears, file this card.
- **`MCP-021C-EDGE-FAMILIES-B-C-ENABLE`** — Q5 + Q6 + Q11 give the operator the calibration data to decide whether to flip Family B and/or Family C to production.
- **`MCP-SERVER-005-FAMILY-D`** — the Stage-2B operator-decision checkpoint for the ai_classifier subset filter decision consumes Q5 + Q6 across families A+B+C as calibration evidence.

### File-level dependencies

- The script READS (does not modify):
  - `src/features/nodeLabels/machineObservationPersistenceQuery.ts` (Q8 literal-line check)
  - `mcp-server/lib/familyRegistryInit.ts` (registry source-of-truth)
  - `supabase/functions/_shared/booleanObservations/familyRegistry.ts` (Edge registry)
  - `mcp-server/lib/familyAKeys.ts`, `familyBKeys.ts`, `familyCKeys.ts` (expected raw_keys lists for Q13)
- The script INVOKES (shell):
  - `npx supabase db query --linked --file <abs path> --output json` (per SQL file)

---

## Open questions for the operator

**None.** The intent brief is comprehensive (§1-§18 + 13 telemetry questions + 22 HALT triggers + 8 design questions). All 8 design questions are resolved with explicit justifications. All 22 HALT triggers evaluate to NOT TRIGGERED at design time. The reality audit (A.1, A.2) confirmed the schema snapshot and Source 6 binding constraint with zero drift.

If the implementer encounters any of the following during Phase B implementation, they should HALT and surface to operator:

- `npx supabase db query --linked --file <file>` returns a JSON envelope shape that differs from the A.1 observation (`{boundary, rows, warning}`).
- Any new HALT condition emerges from the actual data the queries return (e.g., Q12 surfaces a positive for an unsupported family — that would be a security-adjacent finding).
- The test count forecast exceeds +120 (10% above design forecast +94) — surface for review even though it remains below the +200 HALT.

---

## Out-of-scope explicit list

Per intent brief §7 OUT plus designer enumeration:

1. **No taxonomy changes.** `src/features/nodeLabels/**` is locked.
2. **No prompt changes.** `mcp-server/lib/family*Prompt.ts` is locked.
3. **No MCP server runtime behavior changes.** `mcp-server/lib/**`, `mcp-server/tools/**` are read-only references.
4. **No production-mode flip for Family B/C.** `supabase/functions/_shared/booleanObservations/familyRegistry.ts` is a read-only reference.
5. **No auto-trigger changes.** Family A auto-trigger remains byte-equal.
6. **No Source 6 rendering changes.** `machineObservationPersistenceQuery.ts:127` is the binding constraint; the script READS this file for Q8 verification, never modifies it.
7. **No UI.** Default per D1 is script + SQL; HALT trigger #12 fires if any UI proposal sneaks in.
8. **No new tables / migrations.** Existing tables answer all 13 questions; HALT #11 enforces.
9. **No view.** Per D7 = NO.
10. **No alerting integration.** No Slack/PagerDuty/email hooks.
11. **No third-party observability vendor.** No Datadog/Honeycomb/Grafana Cloud.
12. **No dashboards requiring secrets in the client.**
13. **No cron / scheduled invocation.** The script runs on operator command; scheduling is future-work.
14. **No idempotency hardening.** Q9 only OBSERVES duplicates; the fix is a separate card.
15. **No token-budget telemetry instrumentation.** No new columns; latency-only via `completed_at - started_at`.
16. **No deletion / mutation of any runs or results rows.** Read-only.
17. **No service-role usage.** `npx supabase db query --linked` uses the operator's authenticated Management API session (the operator has already logged in via `npx supabase login`); does not use service-role credentials.
18. **No live DB calls in unit tests.** Smoke audit only.
19. **No npm script entry.** Operator runs `node scripts/ops/mcp-observability-report.mjs` directly (a future micro-card may add `npm run ops:mcp-observability`).
20. **No new npm dependencies.** Pure Node 20+ stdlib.

---

## Doctrine self-check

Walking through each invoked skill and asserting compliance:

### cdiscourse-doctrine §1 — Score is gameplay analysis, never truth
The report never labels a family, argument, or person as winner/loser/correct/manipulative. Q13's "over-firing / under-firing" wording in the SECTION TITLE comes from the intent brief §6 phrasing as a question; the report SURFACES ratios but does not apply the labels as verdicts to specific families. Ban-list test enforces this.

### cdiscourse-doctrine §2 — Heat means activity / friction
The report does not surface heat-as-truth. Counts and densities are descriptive activity metrics, not consensus claims. No "popular" / "trending" / "consensus" language.

### cdiscourse-doctrine §3 — Popularity is not evidence
The report does not surface like-counts, view-counts, follower-counts (none exist in the schema to begin with). Engagement and factual-standing are not confused.

### cdiscourse-doctrine §4 — AI moderator hard limits
The script is not an AI moderator. It is a read-only operator telemetry tool. No AI calls. No content modification. No deletion. No truth-value assignment.

### cdiscourse-doctrine §5 — Rules engine is sacred
`src/lib/constitution/engine.ts` not touched.

### cdiscourse-doctrine §6 — Secrets policy
The script's source contains no `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `X_BEARER_TOKEN`, `XAI_API_KEY`, `Authorization`, or `Bearer` literal. Source-scan test enforces. No `.env` file is read (the script delegates auth entirely to `npx supabase db query --linked` which uses the operator's already-authenticated Management API session). Output never contains keys; default output never contains raw bodies or evidence spans.

### cdiscourse-doctrine §7 — No AI calls from production app
Not applicable; this is operator tooling under `scripts/ops/`, not the production app. Even so, no Anthropic / xAI / X API calls.

### cdiscourse-doctrine §8 — Supabase conventions
RLS not disabled. No migrations written. No INSERT/UPDATE/DELETE in any SQL file. No soft-delete bypass. No flag mutation.

### cdiscourse-doctrine §9 — Plain language for users
The report's section titles use plain English ("Runs by run_mode", "Top failure reasons by family"). Internal codes (`raw_key`, `requested_families`, `mcp_validation_failed`) appear as data values in tables — they are operator-facing telemetry, not end-user UI strings, so the §9 mapping-to-plain-language doesn't apply (this is the same posture as admin tables in AdminArgumentsTab).

### cdiscourse-doctrine §10a — Observations vs Allegations
The report deals exclusively with machine-Observation persistence rows (`argument_machine_observation_results`, `argument_machine_observation_runs`). It does not surface user-allegation rows. The `family` and `raw_key` columns reflect the machine taxonomy; the report does not introduce verdicts on top of them.

### cdiscourse-doctrine §10 — v1 scope guards
No voting, no real-time collaboration, no OAuth, no public API, no push notifications, no argument search. All clear.

### test-discipline
Tests are part of the deliverable, not a follow-up. Forecast +94 tests; all listed by file with per-file coverage. No `.skip` / `.only`. No `console.log` in committed code. No live DB calls in unit tests. Source-scan tests enforce doctrine constraints. The 11 S6F-* tests are preserved byte-equal.

### supabase-edge-contract
No service-role key in client. No direct insert into any table. No RLS disable. No migration. The script uses `npx supabase db query --linked` which is the operator's authenticated Management API session — NOT service-role and NOT in client code. No Edge Function written.

### evidence-doctrine
Evidence spans are doctrinally suppressed by default. The optional flag truncates to 120 chars + doctrine-scans before printing. No popularity / engagement signals surfaced (the schema has none anyway). Anti-amplification posture preserved: the report does not surface any signal that could be mistaken for "this family is more correct because it fires more often" — the over/under-firing wording is operator-interpretive only.

---

## Operator steps (if any)

**None required after implementer commits.** This card adds:
- A new directory `scripts/ops/` with one Node script + 14 SQL files
- 9 new test files under `__tests__/opsMcpObservability*.test.ts`
- 1 new fixture under `__tests__/fixtures/`
- 1 new docs file `docs/ops/OPS-MCP-OBSERVABILITY.md`
- 1 new audit template `docs/audits/OPS-MCP-OBSERVABILITY-SMOKE-template.md`

No migration to deploy. No Edge Function to deploy. No environment variable to set. No npm dependency to install. No supabase config change.

**Operator action POST-merge for smoke audit (per smoke plan Phase 2):**

```bash
node scripts/ops/mcp-observability-report.mjs --out-dir <tmp>/ops-observability-smoke
```

Then inspect `<tmp>/ops-observability-smoke/report.md` and `<tmp>/ops-observability-smoke/report.json`, follow the smoke template at `docs/audits/OPS-MCP-OBSERVABILITY-SMOKE-template.md`, and commit the filled-in audit document.

---

## Implementer pre-flight checklist

Before the implementer commits the first file, they should verify:

1. `git rev-parse --show-toplevel` returns the worktree root, not the main checkout.
2. `git status --short` shows ONLY the 10 known operator-territory untracked files.
3. `npm run typecheck && npm run lint && npm run test` exit 0 against the current HEAD.
4. `npx supabase db query --linked --output json` works against a trivial `select 1` (re-confirms A.1 design assumption).
5. The 11 S6F-* tests in `mcpOneTwoOneCEdgeSourceSixRunModeFilter.test.ts` PASS unchanged.
6. The script file uses `import.meta.url` + `fileURLToPath` to resolve repo root (do NOT use `process.cwd()` — implementer must run from anywhere).

Then implement the script + SQL files first (no tests yet to fail-out the implementer's loop), then tests, then docs.

End of design.
