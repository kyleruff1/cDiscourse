# OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING — design document

**Status:** Design draft (binds the implementer subagent)
**Epic:** OPS — observability quality
**Effort:** XS (1-2 hour pipeline)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/322
**Intent brief:** `docs/designs/OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING-intent.md`
**Predecessor chain on main:**
- `OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING` operator-authored intent brief at `84c2d71`
- `OPS-MCP-OBSERVABILITY-SMOKE PARTIAL` at `0e98c27` (surfaced the Q12 bug)
- `OPS-MCP-OBSERVABILITY` ship at `d500037` (PR #321)

---

## Goal (one paragraph)

Tighten the Q12 SQL semantics in `scripts/ops/sql/12-unsupported-family-attempts.sql` so the `positives_observed` count reflects only result rows whose persisted `family` column matches the unsupported family. Replace the current hardcoded `unsupported` array (7 unsupported families baked in) with a data-derived `supported_families` CTE that discovers supported families from `argument_machine_observation_results` rows produced by real providers (excluding `provider_key LIKE 'smoke-%'` synthetic seeds), then derives `unsupported_families` as the complement against the same result set. This satisfies intent brief Decision 2 (data-derived; not hardcoded) and removes the per-family-ship maintenance burden the hardcoded list would have created when Families D-J ship. The fix is one SQL file, no schema change, no Node runner change. Doctrine guarantees (aggregate counts only, no `evidence_span` content in default output, no verdict tokens in SQL comments, no service-role) are preserved.

---

## 1. Phase A.1 — Current Q12 SQL inspection + bug reproduction

### Current file (scripts/ops/sql/12-unsupported-family-attempts.sql, 42 lines)

```sql
-- OPS-MCP-OBSERVABILITY — Q12: Unsupported-family attempts (D-J) visibility.
--
-- For each unsupported family (D-J: 7 families), counts:
--   - attempts (any run that requested the family)
--   - failed_attempts
--   - mcp_validation_failed (the specific failure_reason most expected
--     for unsupported families per the registry rejection path)
--   - positives_observed (BINDING ASSERTION: must be 0 for every
--     unsupported family — any non-zero is a security-adjacent finding)
--
-- Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY.md §6 Q12.
-- Runs standalone via: npx supabase db query --linked --file scripts/ops/sql/12-unsupported-family-attempts.sql
--
-- Doctrine: aggregate counts only; failure_reason values are
-- server-controlled enums. Binding: positives_observed = 0 for every
-- unsupported family.
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
  -- Binding assertion: zero positives for unsupported families.
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

### The bug

The `positives_observed` subquery (lines 30–36) counts a result row when EITHER:

- `res.family = u.family_name` (strict per-row family match — correct), OR
- `u.family_name = any(r2.requested_families)` (the run's `requested_families` array contained the unsupported family — incorrect; over-counts).

**Why the OR clause is wrong:** the second predicate matches every result row in a multi-family run whose request array included the unsupported family, regardless of which family the result row itself represents. Multi-family admin_validation requests are a supported request shape (Family B and Family C are co-requested in some smokes), so the OR clause systematically over-counts in shared-family runs.

### Worked example (per intent brief)

Hypothetical multi-family run with `requested_families = ['parent_relation', 'evidence_source_chain']`:

- 4 `parent_relation` positive rows produced (supported family — these are correct positives).
- 0 `evidence_source_chain` positive rows produced (unsupported family — correctly zero).

Current SQL says (under `u.family_name = 'evidence_source_chain'`):

- `res.family = 'evidence_source_chain'` → matches 0 rows.
- `'evidence_source_chain' = any(['parent_relation', 'evidence_source_chain'])` → matches all 4 `parent_relation` rows because the run's `requested_families` array contained `'evidence_source_chain'`.
- `positives_observed = 4` (wrong; the truth is 0).

Fixed SQL says (strict `res.family = 'evidence_source_chain'`):

- `positives_observed = 0` (correct).

### Smoke ground truth (live, OPS-MCP-OBSERVABILITY-SMOKE Phase 3)

Per `docs/audits/OPS-MCP-OBSERVABILITY-SMOKE-2026-05-27.md` Phase 3 Q12 row and Phase 4 follow-up:

- Current SQL reports: `evidence_source_chain = 4`, `resolution_progress = 4` (inflated; total 8).
- Strict family= match reports: `evidence_source_chain = 1`, `resolution_progress = 2` (true; total 3).
- All 3 true positives trace to a single synthetic test seed at `2026-05-26 05:56:33` with `provider_key='smoke-mcp:test-server'` and `model_name='smoke-test-model-v1'`.

The 3 synthetic positives surface correctly as unsupported-family signal post-fix; they will be cleaned up by the next OPS card (`OPS-MCP-TEST-DATA-CLEANUP`), out of scope here.

### Current return shape (preserved post-fix)

| Column | Type | Semantics |
|---|---|---|
| `unsupported_family_attempted` | text | The unsupported family name. |
| `attempts` | bigint | Number of runs whose `requested_families` array contained this family. |
| `failed_attempts` | bigint | Subset of `attempts` where `status = 'failed'`. |
| `mcp_validation_failed_attempts` | bigint | Subset of `failed_attempts` where `failure_reason = 'mcp_validation_failed'`. |
| `positives_observed` | bigint | Number of `argument_machine_observation_results` rows whose persisted `family` column equals this unsupported family. |

The column names are pinned by `scripts/ops/mcp-observability-report-lib.cjs` SECTIONS entry `q12-unsupported-family-attempts` (verified at lib lines 271–284). All 5 names must be preserved verbatim post-fix.

---

## 2. Phase A.2 — Data-derived `supported_families` approach

### Decision (per intent brief §2 + §3)

Replace the hardcoded `unsupported` CTE (7 baked family names) with a **data-derived complement**:

- `supported_families` = `DISTINCT family` from `argument_machine_observation_results` JOINed to `argument_machine_observation_runs` where `runs.provider_key NOT LIKE 'smoke-%'` AND `runs.provider_key IS NOT NULL`. This is the set of family names a real (non-synthetic) provider has ever produced a result row for.
- `unsupported_families` = `DISTINCT family` from `argument_machine_observation_results` (any provider, including synthetic) MINUS `supported_families`. This is the set of families that ONLY synthetic providers have produced rows for — i.e., families that have NOT been ratified by real producer traffic yet.

### Why `provider_key` lives on `runs`, not `results`

From `supabase/migrations/20260526000018_mcp_021b_machine_observation_results.sql`:

- `argument_machine_observation_runs.provider_key text` (line 86) — present.
- `argument_machine_observation_results` (lines 99–118) — has `run_id` FK to runs, but no `provider_key` column directly.

The CTE must JOIN `results` to `runs` to filter by `provider_key`.

### Exact CTE SQL (data-derived, JOIN through runs)

```sql
with supported_families as (
  select distinct res.family as family_name
  from public.argument_machine_observation_results res
  inner join public.argument_machine_observation_runs r_sf
    on r_sf.id = res.run_id
  where res.family is not null
    and r_sf.provider_key is not null
    and r_sf.provider_key not like 'smoke-%'
),
unsupported_families as (
  select distinct res.family as family_name
  from public.argument_machine_observation_results res
  where res.family is not null
    and res.family not in (select family_name from supported_families)
)
```

Implementation notes:

- The `provider_key is not null` predicate avoids accidental inclusion of legacy rows that pre-date the `provider_key` column being populated (intent brief does not explicitly call this out, but it is a strictly-safer reading of the intent — a NULL `provider_key` is not a verified real provider).
- The `r_sf` alias on the JOIN in `supported_families` does not collide with the `r` and `r2` aliases used later in the main SELECT and the `positives_observed` subquery.
- Both CTEs select from `argument_machine_observation_results`, so a family that has NEVER produced any result row (real OR synthetic) does NOT appear in `unsupported_families`. This is doctrinally aligned: Q12 surfaces "unsupported family produced positive output" as a security-adjacent signal; a registered-but-silent family is invisible to this query by design. (Family-registry coverage is verified separately by Appendix A in the report runner, which reads `supabase/functions/_shared/booleanObservations/familyRegistry.ts`.)

### Post-fix main SELECT

The main SELECT becomes:

```sql
select
  u.family_name as unsupported_family_attempted,
  count(r.id) as attempts,
  count(r.id) filter (where r.status = 'failed') as failed_attempts,
  count(r.id) filter (where r.failure_reason = 'mcp_validation_failed') as mcp_validation_failed_attempts,
  -- Strict per-row family match; the previous OR-clause over-counted.
  (
    select count(res.id)
    from public.argument_machine_observation_results res
    where res.family = u.family_name
  ) as positives_observed
from unsupported_families u
left join public.argument_machine_observation_runs r
  on u.family_name = any(r.requested_families)
group by u.family_name
order by u.family_name;
```

Key changes vs current SQL:

- `unsupported u` (hardcoded array) → `unsupported_families u` (data-derived CTE).
- `positives_observed` subquery: drops the `inner join … on r2.id = res.run_id` (no longer needed because there is no `r2` predicate post-fix) and drops the `or u.family_name = any(r2.requested_families)` clause. Leaves only `where res.family = u.family_name`.
- The `left join` on `requested_families` for the `attempts` / `failed_attempts` / `mcp_validation_failed_attempts` columns is preserved (those columns count requests, not results, and the per-family-array match is correct for them).

### Edge cases addressed

1. **Registered family with zero real rows yet.** A family registered in `familyRegistry.ts` but for which no real provider has yet produced a result row will not appear in either CTE (it has zero `argument_machine_observation_results` rows). The family is invisible to Q12 — correct, because Q12 is about "unsupported families that produced unexpected output", not about coverage. Family-registry coverage is the job of Appendix A in the report runner.

2. **Real provider posts a row with an unregistered family.** If a real-provider row arrives with a `family` value never previously seen (e.g., a typo or a new family rolled out without registry update), the row's `family` will appear in BOTH `supported_families` (because its provider_key is not `smoke-%`) AND in the result set of the second CTE before the `NOT IN` filter; the `NOT IN` subtraction will remove it from `unsupported_families`. So a real provider's stray family will NOT appear in Q12. The security-adjacent surfacing for that case lives in Appendix A's registry-vs-DB comparison, not here. **This matches the intent brief Phase A.2 edge-case framing**: real providers' rows define "supported"; only synthetic-only families surface as unsupported.

3. **Synthetic test rows.** `provider_key LIKE 'smoke-%'` is excluded from `supported_families` (the predicate `r_sf.provider_key not like 'smoke-%'`). Synthetic-produced families therefore appear in `unsupported_families` if and only if NO real provider has ever produced a row with that family. The 3 known synthetic rows (`evidence_source_chain × 1`, `resolution_progress × 2`) correctly surface as 3 unsupported-family positives until the next OPS card cleans up the seed.

4. **`provider_key IS NULL`.** Legacy rows or partial test seeds with a NULL `provider_key` are excluded from `supported_families` (cannot be confirmed real). This is a strictly-safer reading. If the operator's live DB has zero NULL `provider_key` rows, this predicate is a no-op. If it has any, those rows do not falsely ratify a family as "supported".

### Confirmed post-fix Q12 output (per intent brief Phase A.2 last bullet)

Against the live DB at `2026-05-27`:

- `supported_families` (real-provider rows): `parent_relation`, `disagreement_axis`, `misunderstanding_repair` (3 families, all from `mcp:classify_argument_boolean_observations` provider).
- `unsupported_families`: `evidence_source_chain`, `resolution_progress` (2 families, both from `smoke-mcp:test-server`).
- Q12 output rows: 2 rows total (one per unsupported family).
- `positives_observed` per row: 1 (`evidence_source_chain`) + 2 (`resolution_progress`) = 3 total.

**Note on intent brief row count vs design row count:** the intent brief says "3 rows (1 evidence_source_chain + 2 resolution_progress)"; that wording refers to the 3 row-level positives across the 2 unsupported families, not 3 rows in the Q12 output. The Q12 output is 2 rows (one per unsupported family), with the breakdown `(evidence_source_chain, positives_observed=1)` and `(resolution_progress, positives_observed=2)`. The Phase 1 smoke-audit Verdict block under §8 of the intent brief should be read as binding on the underlying row-count of 3, not on the Q12 output cardinality of 2. Implementer should treat the Q12 output as 2 rows summing to 3 positives.

### Rejected alternative — hardcoded supported list

```sql
-- Rejected. Would require a follow-on PR every time a family ships.
where family in ('parent_relation', 'disagreement_axis', 'misunderstanding_repair')
```

Rejected because:

- Every family ship (Family D, E, F, G, H, I, J) would require a follow-on PR to update this SQL.
- Defeats the observability surface's promise of being a stable signal across family rollouts.
- The intent brief Decision 2 binds the data-derived choice.

---

## 3. Phase A.3 — Test plan

### Forecast: +9 tests

Within the +5 to +15 band per intent brief §7 (HALT trigger fires at +50). Tests follow the existing pattern in `__tests__/opsMcpObservabilitySqlSafety.test.ts` (and similar) — pure Jest unit tests that parse the SQL file content via `fs.readFileSync` and run regex/substring assertions against the text. No live DB call in tests. Live DB validation happens in the post-merge 3-phase smoke (intent brief §8).

### Test file

New file: `__tests__/opsMcpObservabilityQ12SemanticTightening.test.ts`

### Per-test enumeration (9 tests)

1. **OR-clause regression.** Assert the substring `or u.family_name = any(r2.requested_families)` is NOT present anywhere in the file (case-insensitive). This is the binding new test per intent brief §10. Also assert the older form `or u.family_name = any(r2.requested_families)` with variant whitespace is not present.

2. **`supported_families` CTE presence.** Assert the file contains the substring `supported_families` AND the file contains a `with` clause that defines it. Use a regex like `/\bwith\s+supported_families\s+as\b/i` to confirm CTE shape.

3. **`unsupported_families` CTE presence.** Assert the file contains a CTE named `unsupported_families` derived from results. Regex: `/\bunsupported_families\s+as\b/i`.

4. **`supported_families` excludes synthetic providers.** Assert the file contains the substring `provider_key not like 'smoke-%'` (the synthetic-seed exclusion predicate; case-insensitive).

5. **`supported_families` JOINs through runs.** Assert the `supported_families` CTE block (between the `supported_families as (` opener and the matching `)`) contains `inner join public.argument_machine_observation_runs` and references `provider_key`. This proves the JOIN path is correct.

6. **Strict `family =` match in positives_observed.** Assert the file contains the substring `where res.family = u.family_name` AND that the `positives_observed` subquery block does NOT contain `requested_families` or `any(` (which would indicate the OR clause survived). Implementation: extract the subquery block from `(` to the matching `)` preceding `as positives_observed`.

7. **Hardcoded D-J array removed.** Assert the file does NOT contain the literal substring `'evidence_source_chain', 'argument_scheme', 'critical_question'` (the start of the hardcoded array in the pre-fix SQL).

8. **Column names preserved (report parser contract).** Assert all 5 column names from `mcp-observability-report-lib.cjs` SECTIONS `q12-unsupported-family-attempts` appear in the file as `as <name>` aliases: `unsupported_family_attempted`, `attempts`, `failed_attempts`, `mcp_validation_failed_attempts`, `positives_observed`. Cross-check by importing `SECTIONS` from the lib and asserting each expected name is found via regex `/\bas\s+<name>\b/i`.

9. **Doctrine + header preserved.** Assert (a) the file's first non-empty line is a `-- ` comment that references `OPS-MCP-OBSERVABILITY` (matches the existing `opsMcpObservabilitySqlSafety.test.ts` convention); (b) no verdict tokens (`winner`, `loser`, `fallacy`, `bad faith`, `manipulative`, `extremist`, `propagandist`, `liar`, `dishonest`, `correct`, `incorrect`) appear in the SQL comments (case-insensitive); (c) the header comment block describes the data-derived approach (assert the substring `data-derived` or `supported_families` appears in the comment block of the file before the `with` keyword).

### Existing tests that must continue to pass (regression sanity)

- `__tests__/opsMcpObservabilitySqlSafety.test.ts` — the SQL file count check (`expect(FILES.length).toBe(14)`) is preserved (no SQL file added or removed). Read-only keyword scan continues to pass (no INSERT/UPDATE/DELETE/etc. added). Header-comment scan continues to pass (the post-fix file retains the `-- OPS-MCP-OBSERVABILITY` header). Terminating semicolon check passes.
- `__tests__/opsMcpObservabilityReportShape.test.ts` — section column names for `q12-unsupported-family-attempts` are NOT changed in the lib file; the report shape test passes unchanged.
- `__tests__/opsMcpObservabilityDoctrineBanList.test.ts` — no banned token introduced.
- `__tests__/opsMcpObservabilityEmptyDbSafety.test.ts` — Q12 returns 0 rows when both CTEs are empty (the empty-DB path); the new CTE preserves this.

### Run gates (per intent brief §7)

```
npm run typecheck           # exit 0
npm run lint                # exit 0
npx jest --testPathPattern="opsMcpObservability" --no-coverage   # exit 0
cd mcp-server && deno test --allow-net --allow-env --allow-read   # exit 0 (regression sanity; untouched)
```

Test count progression: baseline `17,834 → 17,843` (+9 tests). Within forecast band.

---

## 4. Proposed post-fix SQL file content (full text)

The implementer writes the entire file content below, replacing `scripts/ops/sql/12-unsupported-family-attempts.sql` byte-for-byte.

```sql
-- OPS-MCP-OBSERVABILITY — Q12: Unsupported-family attempts visibility.
--
-- Per intent brief OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING:
-- the unsupported-family list is data-derived (not hardcoded), and
-- positives_observed is computed by strict per-row family= match.
--
-- supported_families: DISTINCT family from result rows produced by a
-- real (non-synthetic) provider. provider_key lives on runs, so this
-- CTE JOINs results to runs and excludes provider_key LIKE 'smoke-%'
-- (synthetic test seeds) plus NULL provider_key (unverified rows).
--
-- unsupported_families: DISTINCT family from all result rows MINUS
-- the supported set. A family appears here only if every result row
-- bearing it was produced by a synthetic (smoke) provider — i.e., no
-- real provider has ever ratified the family.
--
-- For each unsupported family, counts:
--   - attempts (any run that requested the family)
--   - failed_attempts
--   - mcp_validation_failed (the specific failure_reason most expected
--     for unsupported families per the registry rejection path)
--   - positives_observed (strict res.family = u.family_name; the
--     previous OR-on-requested_families clause has been removed; in a
--     multi-family run, a positive row counts only against its own
--     persisted family)
--
-- Source-of-truth: docs/designs/OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING.md.
-- Runs standalone via: npx supabase db query --linked --file scripts/ops/sql/12-unsupported-family-attempts.sql
--
-- Doctrine: aggregate counts only; failure_reason values are
-- server-controlled enums; family names are machine taxonomy values
-- (not verdicts).
with supported_families as (
  select distinct res.family as family_name
  from public.argument_machine_observation_results res
  inner join public.argument_machine_observation_runs r_sf
    on r_sf.id = res.run_id
  where res.family is not null
    and r_sf.provider_key is not null
    and r_sf.provider_key not like 'smoke-%'
),
unsupported_families as (
  select distinct res.family as family_name
  from public.argument_machine_observation_results res
  where res.family is not null
    and res.family not in (select family_name from supported_families)
)
select
  u.family_name as unsupported_family_attempted,
  count(r.id) as attempts,
  count(r.id) filter (where r.status = 'failed') as failed_attempts,
  count(r.id) filter (where r.failure_reason = 'mcp_validation_failed') as mcp_validation_failed_attempts,
  -- Strict per-row family= match; OR-on-requested_families removed.
  (
    select count(res.id)
    from public.argument_machine_observation_results res
    where res.family = u.family_name
  ) as positives_observed
from unsupported_families u
left join public.argument_machine_observation_runs r
  on u.family_name = any(r.requested_families)
group by u.family_name
order by u.family_name;
```

Line-count diff: pre-fix file is 42 lines (incl. blank line 23); post-fix file is approximately 56 lines. Net add: ~14 lines (comment block expands; CTE replaces array). Removals: 7 lines (the hardcoded array CTE body, the `inner join … on r2.id = res.run_id`, the OR-clause). Adds: ~21 lines (two-CTE block, expanded comment).

---

## 5. Read-only boundary list (locked files; HALT if touched)

The implementer may edit ONLY this file:

- `scripts/ops/sql/12-unsupported-family-attempts.sql` ← the single in-scope file.

And may CREATE ONLY this file:

- `__tests__/opsMcpObservabilityQ12SemanticTightening.test.ts` ← the new test file.

Every other file is locked. Specifically:

| Locked file | Reason |
|---|---|
| `scripts/ops/sql/01-runs-by-run-mode.sql` ... `13-over-under-firing-summary.sql` (every other SQL file) | Intent brief HALT triggers 1, 3. |
| `scripts/ops/sql/02b-runs-by-requested-family.sql` | Intent brief HALT trigger 1. |
| `scripts/ops/mcp-observability-report.mjs` | Intent brief HALT trigger 2. |
| `scripts/ops/mcp-observability-report-lib.cjs` | Intent brief HALT trigger 2; the `q12-unsupported-family-attempts` section descriptor MUST stay byte-equal so the report parser contract holds. |
| `supabase/migrations/**` | Intent brief HALT trigger 4. |
| `mcp-server/lib/familyRegistry.ts` | Intent brief HALT trigger 5. |
| `mcp-server/lib/familyRegistryInit.ts` | Intent brief HALT trigger 5. |
| `supabase/functions/_shared/booleanObservations/familyRegistry.ts` | Intent brief HALT trigger 5 (Edge registry). |
| `src/features/nodeLabels/machineObservationPersistenceQuery.ts` | Source 6 production filter; locked by OPS-MCP-OBSERVABILITY review template. |
| Any Edge Function file under `supabase/functions/**` | Intent brief Out-of-scope §4. |
| `__tests__/opsMcpObservabilitySqlSafety.test.ts` | Existing test; must continue to pass. Implementer may not modify it. |
| `__tests__/opsMcpObservabilityReportShape.test.ts` | Existing test; must continue to pass unchanged. |
| 10 operator-territory untracked files | Operator-managed; must remain unstaged at commit time. |

Before commit, the implementer runs `git status --short` and confirms ONLY:

- `M scripts/ops/sql/12-unsupported-family-attempts.sql`
- `?? __tests__/opsMcpObservabilityQ12SemanticTightening.test.ts` (or `A`/`AM` after `git add`)

… are present in the staged set. NEVER use `git add .` or `git add -A`.

---

## 6. HALT trigger table (all 14 evaluated)

Per intent brief §5. Each row evaluated against the design proposal in §4.

| # | Trigger | Evaluated | Designer status |
|---|---|---|---|
| 1 | Proposes editing any SQL file other than `12-unsupported-family-attempts.sql` | No — only the one SQL file is in scope per §4 and §5. | **NOT FIRED** |
| 2 | Proposes editing `mcp-observability-report.mjs` runner | No — runner untouched. | **NOT FIRED** |
| 3 | Proposes adding a new SQL query | No — Q1-Q13 + Q2b unchanged; no new query file. | **NOT FIRED** |
| 4 | Proposes a database migration | No — schema unchanged. | **NOT FIRED** |
| 5 | Proposes registry changes (`familyRegistry.ts` / `familyRegistryInit.ts`) | No — registry untouched. | **NOT FIRED** |
| 6 | Proposes Family D/E/F/G/H/I/J registration | No — family lifecycle unchanged. | **NOT FIRED** |
| 7 | Proposes test-data cleanup | No — synthetic seed remains until `OPS-MCP-TEST-DATA-CLEANUP`. | **NOT FIRED** |
| 8 | New Q12 SQL returns counts that include rows where `family` column is supported (parent_relation, disagreement_axis, misunderstanding_repair) | No — the `unsupported_families` CTE excludes families ratified by real providers. Supported families' result rows are filtered out by the `family not in (select family_name from supported_families)` clause. The `positives_observed` subquery uses strict `res.family = u.family_name`, which can never select a supported-family row given `u` comes from `unsupported_families`. | **NOT FIRED** |
| 9 | New Q12 SQL excludes legitimately-unsupported-family rows (false negative) | No — every family with a result row not produced by a real provider appears in `unsupported_families`. The 3 known synthetic positives (1 + 2) appear in the post-fix output. | **NOT FIRED** |
| 10 | Designer Phase A does not enumerate the supported-family derivation approach | No — §2 explicitly documents the data-derived approach (Decision 2 from intent brief), with exact CTE SQL, JOIN through runs, and rejected-alternative rationale. | **NOT FIRED** |
| 11 | Test forecast exceeds +50 | No — forecast is +9 (within +5 to +15 band; well under +50). | **NOT FIRED** |
| 12 | Verdict/winner/fallacy tokens introduced in SQL comments | No — §4 post-fix comment block uses only neutral taxonomy terms (`supported_families`, `unsupported_families`, `aggregate counts`, `taxonomy values`). Test 9 enforces this. | **NOT FIRED** |
| 13 | SQL output exposes `evidence_span` content | No — post-fix SQL selects only aggregate counts and the `family_name` text. No `evidence_span` reference at all. | **NOT FIRED** |
| 14 | Unclassified untracked files at PR creation | Pre-flight clean; 10 known operator-territory files are documented exclusions; the implementer enforces selective `git add` per §5. | **NOT FIRED** |

**Designer total: 0 HALT triggers fired. Design is HALT-clean and proceeds to implementer.**

---

## 7. Operator steps after merge

None during implementation. After merge, the post-merge smoke (intent brief §8) runs:

```
node scripts/ops/mcp-observability-report.mjs --out-dir /tmp/q12-smoke
```

Expected Q12 section: 2 rows summing to 3 positives (1 `evidence_source_chain` + 2 `resolution_progress`), all 3 rows tracing to `provider_key='smoke-mcp:test-server'`. The Q12 surface is then a clean signal for `OPS-MCP-TEST-DATA-CLEANUP` to consume.

No Supabase migration push needed (no schema change). No Edge Function deploy needed.

---

## 8. Doctrine self-check

Per `Skill(cdiscourse-doctrine)`:

- **§1 Score is gameplay analysis, never truth.** Q12 is an operator telemetry query; no user-facing strings emitted. The new CTE references neutral taxonomy fields only.
- **§4 AI moderator hard limits.** No AI moderation, no client AI call, no Edge Function call introduced; Q12 is a read-only operator SQL.
- **§5 Rules engine sacred.** Not touched.
- **§6 Secrets policy.** No env / key / token reference in SQL. The `npx supabase db query --linked` invocation uses operator-side auth; SQL itself has zero secret material.
- **§7 No AI calls from production app.** N/A; this is an operator-only script.
- **§8 Supabase conventions.** RLS unchanged (read-only SELECT); no DDL; no migration; no service-role.
- **§9 Plain language for users.** Family names are machine taxonomy values, not user-facing strings; the report runner wraps them in operator-facing markdown tables (no end-user surface).
- **§10a Observations vs Allegations.** Q12 reports machine observation aggregates only; no user-allegation surface.
- **§10 v1 scope guards.** N/A.

Per `Skill(test-discipline)`:

- **+9 tests added; baseline 17,834 → 17,843.** Within forecast.
- **Test surface is pure Jest, no live DB call.** Live DB validation lives in the post-merge smoke audit, not in the unit-test surface.
- **No `.skip` / `.only` / `xit` / `xdescribe`.** Tests are real.
- **Test count goes UP.** +9.

---

## 9. Risks the implementer should know about

1. **SQL whitespace sensitivity in regex tests.** Tests #1, #5, #6 match substrings or regex patterns over the raw file text. If the implementer reformats the SQL (e.g., changes single-space to multi-space, splits a line), the regex needs to be tolerant. Use the `stripSqlComments` helper from `opsMcpObservabilitySqlSafety.test.ts` if the test scans for code-only content; use direct file scan if scanning for comments.

2. **`r_sf` alias collision.** If the implementer renames the alias used inside `supported_families` (e.g., to `r` or `r2`), it shadows the outer aliases. Pick a non-colliding alias.

3. **`provider_key IS NULL` predicate.** The design adds this predicate to `supported_families` for strict safety. The intent brief does not explicitly require it. If the operator wants to permit NULL-provider rows to ratify a family as supported, drop the predicate. Default per design: include the predicate (strictly safer).

4. **Empty-DB path.** When both CTEs are empty (no result rows in the table at all), the main SELECT produces 0 rows, which the report empty-message `'No unsupported-family attempts observed.'` handles correctly (lib SECTIONS line 283). The existing `opsMcpObservabilityEmptyDbSafety.test.ts` test must continue to pass; the new CTE preserves this behavior because `unsupported_families` is empty when the join base is empty.

5. **Source 6 byte-equal preservation.** The OPS-MCP-OBSERVABILITY review template requires the Source 6 production filter line at `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127` to remain byte-equal. The post-fix SQL does not touch that file; verify via `git diff main -- src/` returns empty before PR.

6. **Column-name contract.** Test #8 cross-checks the SQL aliases against the lib SECTIONS entry. If the implementer accidentally renames `positives_observed` or any of the other 4 columns, the report runner parser will produce mis-aligned markdown rows AND test #8 will fail.

7. **Lib `q02b-runs-by-requested-family` ordering.** The lib SECTIONS array has `q02b-runs-by-requested-family` between `q02-runs-by-family` and `q03-runs-by-family-and-status` (lib lines 148–156). Q12 is at index 12 (zero-based) → 13th entry. The post-fix SQL preserves the section position by being the same file path; lib stays untouched.

8. **`group by u.family_name` correctness.** The post-fix main SELECT's `group by u.family_name` is correct because `u.family_name` is the only non-aggregate select-list column. The `positives_observed` subquery is a scalar correlated subquery and does not enter the GROUP BY.

---

## 10. Out of scope (explicit)

Per intent brief §4:

- Test data cleanup (next OPS card).
- Idempotency hardening (after that).
- Any other observability SQL file.
- Node runner script.
- Library helpers (`mcp-observability-report-lib.cjs`).
- Database migrations.
- Registry changes.
- Edge Function changes.
- Source 6 filter.
- Family registration.

If the implementer encounters an issue that requires touching any of the above, **STOP** and surface to operator. Do not paper over the conflict.

---

## 11. Brief ledger (sources of judgment)

| Section | Authorship source |
|---|---|
| §1 — Current Q12 SQL inspection + bug reproduction | Derived from intent brief §1 + `scripts/ops/sql/12-unsupported-family-attempts.sql` verbatim + OPS-MCP-OBSERVABILITY-SMOKE Phase 3 ground truth. |
| §2 — Data-derived `supported_families` approach | Derived from intent brief §3 (binding Decision 2) + migration `20260526000018` schema inspection + `provider_key`-location verification. The `provider_key IS NOT NULL` predicate is an orchestrator-default strictly-safer reading (intent brief silent). |
| §3 — Test plan | Derived from intent brief §7 + Phase A.3 enumeration + `opsMcpObservabilitySqlSafety.test.ts` and `opsMcpObservabilityReportShape.test.ts` pattern survey. The +9 number is an orchestrator default within the +5 to +15 band; implementer may consolidate to lower or expand toward upper if helpful. |
| §4 — Post-fix SQL file content | Derived from §2 CTE SQL + intent brief §3 CTE pattern + existing file header conventions across the 13 other SQL files. |
| §5 — Read-only boundary list | Derived from intent brief §4 (out-of-scope) + intent brief §5 (HALT triggers 1-5). |
| §6 — HALT trigger table | Derived from intent brief §5 verbatim; each row independently evaluated against §4. |
| §7 — Operator steps | Derived from intent brief §8 smoke plan; no implementation-time operator step required. |
| §8 — Doctrine self-check | Derived from `Skill(cdiscourse-doctrine)` walk-through and `Skill(test-discipline)` walk-through. |
| §9 — Risks | Orchestrator-authored from codebase inspection (regex sensitivity, alias collisions, Source 6 review template invariants, lib SECTIONS contract). |
| §10 — Out of scope | Derived from intent brief §4. |

**Operator-deferred review items:** None. The intent brief is operator-authored and binding; this design fills in mechanical detail (CTE alias choice, `provider_key IS NOT NULL` predicate, test enumeration cardinality at +9). If the operator wants the `provider_key IS NOT NULL` predicate dropped (allowing NULL-provider rows to ratify a family as supported), they should communicate that to the implementer; the design defaults to the strictly-safer inclusion.

---

## 12. Implementer execution checklist (for handoff)

1. Read this design doc fully.
2. Read the intent brief at `docs/designs/OPS-MCP-OBSERVABILITY-Q12-SEMANTIC-TIGHTENING-intent.md`.
3. Confirm working tree state: `git status --short` shows only the 10 operator-territory untracked files.
4. Replace `scripts/ops/sql/12-unsupported-family-attempts.sql` with the §4 content byte-for-byte.
5. Create `__tests__/opsMcpObservabilityQ12SemanticTightening.test.ts` per §3 enumeration (9 tests).
6. Run gates: `npm run typecheck && npm run lint && npx jest --testPathPattern="opsMcpObservability" --no-coverage`. All exit 0.
7. Optional but recommended: run the full Jest suite once to verify test count is 17,843 (baseline 17,834 + 9 = 17,843). Capture the `Test Suites: X passed / Tests: Y passed` line.
8. Stage selectively: `git add scripts/ops/sql/12-unsupported-family-attempts.sql __tests__/opsMcpObservabilityQ12SemanticTightening.test.ts`. NEVER `git add .` or `git add -A`.
9. Confirm `git status --short` shows ONLY the two staged changes plus the 10 operator-territory untracked files.
10. Commit. Push. Open PR. Hand off to roadmap-reviewer.
