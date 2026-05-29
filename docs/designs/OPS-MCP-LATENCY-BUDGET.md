# OPS-MCP-LATENCY-BUDGET — Auto-trigger latency budget (measure + codify)

**Status:** Design draft
**Epic:** Epic 12 / OPS (MCP semantic-referee track — measurement + codification)
**Release:** MCP observability hardening (pre-Family-G)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/351
**Intent brief:** `docs/designs/OPS-MCP-LATENCY-BUDGET-intent.md` (binding decisions D1–D9)

---

## Goal (one paragraph)

Six Boolean-Observation classification families (A+B+C+D+E+F) now fire
**sequentially** per new argument as a fire-and-forget background task
(`autoTriggerDispatcher.ts`: `for (const family of eligibleFamilies) { await
dispatchOneFamilyIteration(...) }`, run via `EdgeRuntime.waitUntil`). Background
latency therefore grows roughly **linearly** with family count. Family G is
authorized but must enter the production path with a *defined* budget rather
than a reactive surprise. This card **measures** current per-family + total
latency across **N=5** fresh production submissions, **codifies** warning/FAIL
thresholds against one precisely-defined clock (`wall_clock_background`), and
**projects** the family count at which sequential dispatch crosses the
threshold — answering the operative question: *can G go production under
sequential dispatch, or must a parallelization card precede it?* It **measures
and codifies only**. It does **not** redesign, parallelize, or change dispatch
behavior (D9). The doctrine that shapes this design: latency is a
**system-performance** metric, never a gameplay/truth signal
(cdiscourse-doctrine §1) — the budget governs background work time and must
**never** be allowed to block argument posting (validation can block; nothing
about classification timing can — cdiscourse-doctrine §1, and the dispatcher's
fire-and-forget contract §2.3).

This design is grounded in a **live read-only probe** of the linked Supabase
project (see § "Evidence (read-only probe)") — the exact SQL below executed
cleanly and the current 6-family `wall_clock_background` is **already 30.44s**,
sitting on the 30s warning line. The projection is therefore not hypothetical:
G is the card's reason to exist.

---

## Data model

**No new data model. No migration. Read-only query only.** (HALT triggers 4
& 6 not approached.)

The card reads the existing table created by
`20260526000018_mcp_021b_machine_observation_results.sql`:

```sql
public.argument_machine_observation_runs (
  id                  uuid PRIMARY KEY,
  debate_id           uuid NOT NULL,
  argument_id         uuid NOT NULL,
  schema_version      text NOT NULL,
  requested_families  text[] NOT NULL,    -- production auto-trigger rows carry exactly ONE element
  provider_key        text,
  model_name          text,
  input_hash          text,
  status              text NOT NULL,      -- 'success' | 'failed' | 'fallback'
  failure_reason      text,
  started_at          timestamptz NOT NULL DEFAULT now(),   -- per-run clock start
  completed_at        timestamptz,                          -- per-run clock end (nullable)
  created_at          timestamptz NOT NULL
)
```

**Live-verified (read-only probe, this session):** `started_at` =
`timestamp with time zone, NOT NULL`; `completed_at` = `timestamp with time
zone, nullable`; `run_mode` text NOT NULL; `requested_families` ARRAY NOT NULL;
`status` text NOT NULL. All three clocks are computable purely from these
columns (the third — `submit_to_last_complete` — additionally needs the app-side
submit timestamp, captured during the post-merge smoke).

**Per-family duration** = `completed_at − started_at` for a single production
run (`run_mode='production'`, `status='success'`, `requested_families` of
length 1 carrying that family).
**`wall_clock_background`** for an argument = `max(completed_at) −
min(started_at)` across that argument's production runs.

> **Fallback note (columns absent):** if `started_at`/`completed_at` had been
> absent, the fallback would have been the dispatcher's structured-log
> `latency_ms` (per-family, app-side). They are **present and live-confirmed**,
> so the DB columns are the canonical source and no fallback is used. (See
> § A.2 for why the DB columns bind over the log clock.)

---

## File changes

All paths are within the STRICT-SCOPE allow-list. No forbidden file is touched.

**New files:**

- `scripts/ops/mcp-latency-report.mjs` (~180–220 lines) — read-only operator
  CLI. Mirrors `mcp-observability-report.mjs`'s shape: resolves repo root via
  `import.meta.url`, `createRequire`s its `.cjs` lib, runs the latency SQL files
  via the lib's `runSupabaseSqlFile` (reused), computes per-family and
  wall-clock percentiles + classification + projection in JS, stitches a
  markdown + JSON artifact, runs the doctrine ban-list scan, writes to
  `out/ops-latency/<ts>/report.{md,json}` (or `--no-write`). Exit 0 on success.
- `scripts/ops/mcp-latency-report-lib.cjs` (~220–280 lines) — pure CommonJS
  helpers (so Jest `require()`s them, mirroring `audit-lint-lib.cjs`):
  `classifyLatencyBudget(...)`, `projectWallClockForFamilyCounts(...)`,
  `percentile(values, p)`, `aggregatePerFamily(rows)`,
  `computeWallClockSamples(rows)`, `stitchLatencyMarkdown(...)`,
  `buildLatencyJson(...)`, `LATENCY_SECTIONS`, `WARN_SECONDS`/`FAIL_SECONDS`
  constants, plus a re-export of the observability lib's `runSupabaseSqlFile`
  and `scanMarkdownForBannedTokens` (require-and-reexport — no copy).
- `scripts/ops/sql/16-auto-trigger-per-family-duration.sql` (~35 lines) —
  per-(argument, family) production-success durations for the most recent N
  arguments (one row per family run; the report computes percentiles in JS).
- `scripts/ops/sql/17-auto-trigger-wall-clock-per-argument.sql` (~30 lines) —
  per-argument `wall_clock_background` + `sum_of_per_family` + family-run count
  for the same recent N arguments.
- `docs/ops/LATENCY-BUDGET.md` (~120–160 lines) — the budget doc: the three
  clock definitions, the explicit statement that **45s is defined against
  `wall_clock_background`**, the 30s/45s thresholds + rationale, the projection
  method + the G under/over-budget call, and how to run the report.
- `__tests__/opsMcpLatencyBudget.test.ts` (~260–340 lines) — Jest suite that
  `require()`s `mcp-latency-report-lib.cjs` and exercises the classification
  boundary cases, the projection arithmetic, the percentile helper, the
  ban-list scan on stitched markdown, and a no-network purity assertion on the
  lib.

**Modified files:**

- `docs/core/current-status.md` — append a Phase-framing handoff section
  ("Stage 6.4 follow-up — OPS-MCP-LATENCY-BUDGET") with the binding clock, the
  thresholds, the test count delta, and the patterns a future
  parallelization card consumes. *What stays:* every prior stage section
  unchanged.

**This card's own docs (already in scope):**

- `docs/designs/OPS-MCP-LATENCY-BUDGET.md` (this file).
- `docs/audits/OPS-MCP-LATENCY-BUDGET-SMOKE-2026-05-28.md` (post-merge smoke;
  authored by the implementer/operator, carries `Audit-Lint: v1`, self-lints
  clean — out of design scope to write here, but named for the chain).

**Deleted files:** none.

**Decision — extend vs new report (D8):** **NEW `mcp-latency-report.mjs`**, not
an extension of `mcp-observability-report.mjs`. Rationale:

1. The observability report's `SECTIONS` + `stitchMarkdownReport` pipeline is a
   **generic raw-row table renderer** (`renderSectionMarkdown` emits one
   markdown table per section keyed by `columns`). The latency deliverable
   needs **computed aggregates** (p50/p95 per family, three derived clocks,
   a PASS/PARTIAL/FAIL **classification**, and a **projection** for 7/8/9/10
   families). Bolting computed/projection sections onto a row-dump renderer
   would force either fake "rows" or a parallel render path inside a file whose
   contract is "one SQL file → one table."
2. The observability report carries a frozen `schemaVersion:
   'ops-mcp-observability.report.v1'` and a fixed 15-section table of contents
   that downstream audits (Q9–Q15 smoke phases) key against. Adding latency
   sections would perturb that surface and its tests. A separate report with
   its own `schemaVersion: 'ops-mcp-latency.report.v1'` keeps both stable.
3. The two share the *mechanism* (read-only SQL via `npx supabase db query
   --linked`, doctrine ban-list scan, markdown+JSON artifact). The new lib
   **reuses** `runSupabaseSqlFile` + `scanMarkdownForBannedTokens` by
   `require()`-and-re-export — no copy, no drift — so the shared machinery has a
   single source of truth while the *reporting concern* (raw rows vs computed
   budget) is cleanly separated.

Both run the same way (`node scripts/ops/<x>.mjs`, no npm script — confirmed
neither has one in `package.json`, so **no `package.json` change**, HALT
trigger 6 untouched).

---

## API / interface contracts

### Read-only SQL — `16-auto-trigger-per-family-duration.sql` (EXACT)

The report computes percentiles in JS from these per-sample rows (per A.1: SQL
percentiles are awkward across a tiny N=5; JS `percentile()` is clearer and
testable). The SQL returns one row per production-success family run for the
most recent N arguments.

```sql
-- OPS-MCP-LATENCY-BUDGET — Q16: per-(argument, family) production durations.
--
-- One row per production auto-trigger SUCCESS run for the most recent N
-- arguments (N defaults to 5 via the LIMIT in recent_args). Production
-- auto-trigger runs carry EXACTLY ONE element in requested_families
-- (the dispatcher classifies one family per iteration), so
-- requested_families[1] is the family. Duration = completed_at − started_at,
-- in seconds. The report aggregates min/p50/p95/max per family in JS.
--
-- Doctrine: aggregate timing only; no body content; no evidence_span.
--           Latency is a system-performance metric, never a gameplay signal.
-- Runs standalone via:
--   npx supabase db query --linked --file scripts/ops/sql/16-auto-trigger-per-family-duration.sql
with recent_args as (
  select argument_id, min(started_at) as arg_first_started
  from public.argument_machine_observation_runs
  where run_mode = 'production'
    and status = 'success'
    and completed_at is not null
  group by argument_id
  order by arg_first_started desc
  limit 5
)
select
  r.argument_id,
  (r.requested_families)[1]                                   as family,
  round(extract(epoch from (r.completed_at - r.started_at))::numeric, 3)
                                                              as family_seconds,
  r.started_at,
  r.completed_at
from public.argument_machine_observation_runs r
join recent_args ra on ra.argument_id = r.argument_id
where r.run_mode = 'production'
  and r.status = 'success'
  and r.completed_at is not null
  and array_length(r.requested_families, 1) = 1
order by r.argument_id, family;
```

> **N is fixed at 5 via the `LIMIT` in `recent_args`** to satisfy D1 (N=5; HALT
> trigger 9 — single-sample — is structurally impossible because the report
> asserts `samples ≥ 2` per family before emitting a p95 and surfaces a
> `low_sample_warning` when an individual family has `< 5` post-merge). The
> live probe already shows several families at 5 samples and F at 1 (F is the
> newest production family) — the smoke's 5 fresh submissions bring every
> family to ≥ 5.

### Read-only SQL — `17-auto-trigger-wall-clock-per-argument.sql` (EXACT)

```sql
-- OPS-MCP-LATENCY-BUDGET — Q17: per-argument wall-clock background time.
--
-- wall_clock_background = max(completed_at) − min(started_at) over an
-- argument's production SUCCESS runs (the BINDING threshold clock, D2).
-- sum_of_per_family   = Σ (completed_at − started_at)        (context clock).
-- The gap (wall_clock − sum) is the inter-family dispatch overhead
-- (idempotency pre-check + scheduling between sequential iterations).
--
-- Same recent-N argument set as Q16. The report computes p50/p95 of
-- wall_clock_background across these argument rows in JS.
--
-- Doctrine: aggregate timing only; no body content.
-- Runs standalone via:
--   npx supabase db query --linked --file scripts/ops/sql/17-auto-trigger-wall-clock-per-argument.sql
with recent_args as (
  select argument_id, min(started_at) as arg_first_started
  from public.argument_machine_observation_runs
  where run_mode = 'production'
    and status = 'success'
    and completed_at is not null
  group by argument_id
  order by arg_first_started desc
  limit 5
)
select
  r.argument_id,
  count(*)                                                              as family_runs,
  round(extract(epoch from (max(r.completed_at) - min(r.started_at)))::numeric, 3)
                                                                        as wall_clock_background_seconds,
  round(extract(epoch from sum(r.completed_at - r.started_at))::numeric, 3)
                                                                        as sum_of_per_family_seconds
from public.argument_machine_observation_runs r
join recent_args ra on ra.argument_id = r.argument_id
where r.run_mode = 'production'
  and r.status = 'success'
  and r.completed_at is not null
group by r.argument_id
order by wall_clock_background_seconds desc;
```

Both queries executed cleanly against the linked DB this session (§ Evidence).
Both are pure aggregate reads — no body text, no `evidence_span`, no service-role
(the report uses `npx supabase db query --linked`, the operator's authenticated
CLI session, identical to the observability report).

### Pure classification function (D8) — lives in `mcp-latency-report-lib.cjs`

```ts
// Signature (documented in TS; implemented in CommonJS for jest require()).
type LatencyClassification = 'PASS' | 'PARTIAL' | 'FAIL';

function classifyLatencyBudget(
  wallClockBackgroundP95Seconds: number,
  submitBlocked: boolean,
): LatencyClassification;
//   submitBlocked === true                         -> 'FAIL'  (checked FIRST; D3)
//   wallClockBackgroundP95Seconds >= FAIL_SECONDS  -> 'FAIL'  (>= 45)
//   wallClockBackgroundP95Seconds >= WARN_SECONDS  -> 'PARTIAL'(>= 30 and < 45)
//   otherwise                                      -> 'PASS'  (< 30, not blocked)
//
//   WARN_SECONDS = 30 ; FAIL_SECONDS = 45 (confirmed; see § A.3 rationale).
//   Non-finite / negative input -> throws RangeError (guarded; not silently PASS).
```

Decision order matters: **`submitBlocked` is evaluated first** so a fast
background time can never mask a blocked submit (D3 — a blocked submit is an
immediate FAIL regardless of background timing). This is HALT-trigger-8's
correctness core encoded as control flow.

### Pure projection function (D6) — `mcp-latency-report-lib.cjs`

```ts
interface PerFamilyP95 { family: string; p95Seconds: number; }

interface ProjectionRow {
  familyCount: number;            // 7, 8, 9, 10
  projectedWallClockP95Seconds: number;
  crossesWarn: boolean;           // >= 30
  crossesFail: boolean;           // >= 45
}

function projectWallClockForFamilyCounts(
  measuredPerFamilyP95: PerFamilyP95[],   // the 6 measured families
  measuredWallClockP95Seconds: number,    // current 6-family wall-clock p95 (anchor)
  targetCounts: number[],                 // [7, 8, 9, 10]
  options?: { addedFamilyP95Seconds?: number; perFamilyDispatchGapSeconds?: number },
): { addedFamilyP95Used: number; dispatchGapUsed: number; rows: ProjectionRow[] };
```

**Projection arithmetic (A.3).** Anchored on the measured 6-family wall-clock
p95 (not the raw per-family sum — the anchor already includes the real
dispatch gaps), then add, per family beyond 6:

```
projectedWallClockP95(n) = measuredWallClockP95(6)
                         + (n - 6) * (addedFamilyP95 + perFamilyDispatchGap)
```

- **`addedFamilyP95`** (assumption, stated + justified): the **median of the 6
  measured per-family p95 values**, rounded up to the nearest whole second as a
  conservative ceiling. Rationale: G/H/I/J are unmeasured, so the most defensible
  estimate of each added family's p95 is the central tendency of the families we
  *have* measured — and per-family duration is empirically flat across families
  (live probe: 4.0–7.6s max across A–F regardless of key-count), so the median
  is representative. Using the **median (robust to D's high tail) rounded up**
  is conservative without over-inflating from a single slow family. Live probe
  per-family maxima: A 6.08, B 4.79, C 5.42, D 7.63, E 5.07, F 5.13 → median of
  maxima ≈ 5.25s → **`addedFamilyP95 = 6s`** (rounded up). The report also
  prints a **sensitivity row** using the *worst* measured family p95 (D ≈ 7.6s)
  so the operator sees both the central and the pessimistic projection.
- **`perFamilyDispatchGap`** (assumption, stated): the observed gap between
  `wall_clock_background` and `sum_of_per_family`, divided by `(familyRuns − 1)`.
  Live probe at 6 families: wall 30.44s − sum 28.73s = 1.71s over 5 gaps ≈
  **0.34s/family**; default **`perFamilyDispatchGap = 0.5s`** (rounded up). This
  term is why the projection anchors on measured wall-clock, not the per-family
  sum: the sum alone systematically under-estimates wall-clock by the dispatch
  overhead.

**How the design reports the crossing counts + the G call.** The report emits a
projection table (family count → projected wall-clock p95 → crosses-warn →
crosses-fail), then a one-line verdict: *"G (7th family) is projected
UNDER/OVER the 45s FAIL budget; the 30s warning line is crossed at N=__; the 45s
FAIL line is crossed at N=__."* The G call is derived mechanically from
`projectWallClockForFamilyCounts(...)[familyCount=7].crossesFail`.

> **Worked example with live numbers** (illustrative; the implementer
> recomputes from the smoke's fresh N=5): measured 6-family wall p95 ≈ 30.4s,
> `addedFamilyP95 = 6s`, gap `= 0.5s` →
> 7 families ≈ 30.4 + 6.5 = **36.9s** (PARTIAL: ≥30, <45 → **G UNDER the 45s
> FAIL budget, but already past the 30s warning**);
> 8 ≈ 43.4s (PARTIAL, near the line); 9 ≈ 49.9s (**FAIL — crosses 45s**);
> 10 ≈ 56.4s (FAIL). So: 30s warning already crossed at the **current 6**;
> 45s FAIL line projected to cross at the **9th family (I)**. G can ship
> sequentially with a known, documented budget; the parallelization card is
> the pre-I gate, not the pre-G gate. (Final numbers come from the post-merge
> smoke's fresh N=5 measurement.)

### CLI surface — `mcp-latency-report.mjs`

```
node scripts/ops/mcp-latency-report.mjs [flags]
  --sample-limit <int>   N for the recent-args window (default 5; informational —
                         the SQL LIMIT is the binding cap; values < 2 rejected)
  --no-write             dry-run: compute + validate, do not write files
  --json-only            emit JSON artifact only
  --out-dir <path>       output dir (default out/ops-latency/<UTC>/)
  --help
EXIT CODES:
  0 success
  1 at least one SQL file failed (supabase CLI exit preserved)
  2 doctrine ban-list scan triggered in stitched output
  5 CLI argument parse error
```

The classification + projection are pure (in the lib) and run regardless of SQL
success; if a SQL file fails the report still emits the codified thresholds +
projection method with an empty-data note and exits 1 (so the *codification* is
never blocked by a transient DB hiccup — mirrors the consistent-PARTIAL posture
in § Operator steps).

---

## Edge cases

The implementer MUST handle:

- **Empty result set** (no recent production runs). Report emits the codified
  thresholds + projection *method* with a `no_samples` note; classification is
  reported as `indeterminate (no samples)`, NOT `PASS`. Exit 1 if the SQL
  itself failed; exit 0 if the SQL succeeded but returned zero rows (DB simply
  has no production runs yet).
- **A family with `< 5` samples** (live probe shows F at 1 today). The
  per-family aggregate emits a `low_sample_warning: true` flag and the p95 is
  computed from what exists; the budget verdict notes the affected families. The
  post-merge smoke's 5 fresh submissions raise all 6 to ≥ 5.
- **Single sample for a family** → p95 == p50 == that one value; flagged
  `low_sample_warning`. (HALT trigger 9 — single-sample — applies to the
  *measurement design*: D1 fixes N=5 fresh submissions; this case is only a
  transient pre-smoke state, never the codified budget basis.)
- **`completed_at IS NULL`** (a run that started but never finished — crash /
  timeout). Excluded by `completed_at is not null` in both queries. The report
  notes the count of excluded-incomplete runs (a separate diagnostic line) so a
  silent classifier hang is visible rather than hidden.
- **A production run with `requested_families` length ≠ 1** (defensive — the
  dispatcher always sends length 1, but a future admin/batch path might not).
  Q16 filters `array_length = 1` so multi-family rows never corrupt per-family
  durations; Q17 (wall-clock) includes all production-success runs for the arg
  regardless of length (wall-clock is per-argument, not per-family).
- **Non-finite / negative classification input** → `classifyLatencyBudget`
  throws `RangeError` (never silently returns PASS). Tested.
- **Exactly-30 / exactly-45 boundaries** → `>= WARN` and `>= FAIL` use
  inclusive `>=`, so exactly-30 → PARTIAL and exactly-45 → FAIL. Tested
  explicitly (see Test plan).
- **`submitBlocked = true` with a fast background time** → FAIL (checked first).
  This is the D3 correctness case and HALT-trigger-8's guard. Tested.
- **Doctrine-constraint edge case:** *"what if a slow family makes the budget
  want to suppress that family's classification to stay under 45s?"* — it does
  **not**. The budget is **advisory measurement**; it never gates which families
  run (that's `familyRegistry.ts`, which this card must not touch — HALT trigger
  3) and never gates posting. A FAIL classification is a *signal to file a
  parallelization card*, not an instruction to drop a family or block a submit.
- **Doctrine-constraint edge case:** *"could latency be read as a quality/heat
  signal?"* — no. Latency is system-performance only; the report carries no
  per-argument verdict, no "fast = good / slow = bad" framing, and the ban-list
  scan refuses any verdict token. Heat (cdiscourse-doctrine §2) is move-activity,
  unrelated.

---

## Test plan

All tests in `__tests__/opsMcpLatencyBudget.test.ts`, `require()`-ing
`scripts/ops/mcp-latency-report-lib.cjs` (the `audit-lint-lib.cjs` +
`opsAuditLint.test.ts` pattern). Pure functions only — no network, no DB, no
React.

**`classifyLatencyBudget` boundary cases (the D8 centerpiece):**
- `classify(44.9, false)` → `'PASS'` (just-under-45, not blocked).
- `classify(29.9, false)` → `'PASS'` (just-under-30).
- `classify(30, false)` → `'PARTIAL'` (exactly-30 is the warning line, inclusive).
- `classify(37, false)` → `'PARTIAL'` (in the 30..45 band).
- `classify(44.999, false)` → `'PARTIAL'` (just under FAIL).
- `classify(45, false)` → `'FAIL'` (exactly-45, inclusive).
- `classify(60, false)` → `'FAIL'` (well over).
- `classify(5, true)` → `'FAIL'` (**submitBlocked=true with fast background → FAIL**; D3).
- `classify(0, false)` → `'PASS'` (degenerate zero).
- `classify(NaN, false)` / `classify(-1, false)` → throws `RangeError`.

**`projectWallClockForFamilyCounts` arithmetic (D6):**
- Given a fixed measured 6-family wall p95 and a fixed `addedFamilyP95` +
  `gap`, assert the projected 7/8/9/10 values equal the closed-form
  `anchor + (n-6)*(addedFamilyP95+gap)` exactly.
- Assert `crossesWarn`/`crossesFail` booleans flip at the right family count
  (a fixture chosen so FAIL first occurs at n=9, matching the worked example).
- Assert the **default `addedFamilyP95` = median-of-measured rounded up** and
  the sensitivity-row uses the max measured p95 (two distinct projection rows
  from the same input).
- Assert the **G call** (`familyCount === 7`) derives `crossesFail === false`
  for the worked-example fixture and `crossesFail === true` for a pessimistic
  fixture (proves the call is data-derived, not hard-coded).

**`percentile` helper:**
- p50 / p95 / min / max on a known 5-element array.
- p95 on a 1-element array == that element (low-sample path).
- empty array → returns `null` (not `0`, not throw) so callers branch on it.

**`aggregatePerFamily` / `computeWallClockSamples`:**
- A fixture of Q16-shaped rows aggregates to the expected per-family
  min/p50/p95/max + `samples` count + `low_sample_warning` for the `<5` family.
- A fixture of Q17-shaped rows yields the expected wall-clock p50/p95.

**Doctrine ban-list (mandatory — card emits operator-facing markdown):**
- `stitchLatencyMarkdown(fixture)` output, scanned by the re-exported
  `scanMarkdownForBannedTokens`, contains **zero** banned tokens
  (`winner`, `loser`, `correct`, `incorrect`, `liar`, `dishonest`,
  `bad faith`, `manipulative`, `extremist`, `propagandist`, `fallacy`).
  Asserts latency framing never drifts into verdict/quality language.
- The markdown contains **no** raw `evidence_span`/body field (the SQL never
  selects one; the test asserts the section column set excludes any body-ish key).

**Purity / safety:**
- The lib module source contains no `require('node:http'|'node:https'|'node-fetch')`
  and no `spawnSync` *other than* the re-exported `runSupabaseSqlFile` (which
  lives in the observability lib, not this one) — asserts the pure helpers stay
  pure. (Pattern: the audit-lint-lib purity test.)
- `classifyLatencyBudget` is referentially transparent: same input → same output
  across 100 calls (cheap property check).

**Test forecast: +18 (band +10 to +30; HALT ceiling +50).** Breakdown: ~10
classification boundary cases, ~4 projection cases, ~3 percentile cases, ~2
aggregate cases, ~2 ban-list/no-body cases, ~2 purity cases. Comfortably inside
the forecast and far under the +50 HALT ceiling (HALT trigger 10 not approached).

---

## Dependencies (cards / docs / files)

- **Assumes Family F is production-enabled** (it is — `familyRegistry.ts`
  post-merge A+B+C+D+E+F `productionEnabled: true`, confirmed by the F-enable
  smoke `65dbfc3`). The 6-family baseline is the measurement subject.
- **Reads** `argument_machine_observation_runs` (`started_at`/`completed_at`)
  created by `20260526000018_mcp_021b_machine_observation_results.sql`
  (applied). **Reads** the dispatcher's sequential contract (does not modify it).
- **Reuses** `scripts/ops/mcp-observability-report-lib.cjs` exports
  `runSupabaseSqlFile` + `scanMarkdownForBannedTokens` (require-and-re-export).
  This couples the new lib to that file's API surface; if a future card renames
  those exports, this lib's re-export breaks loudly (a test catches it) — an
  acceptable, visible coupling.
- **Mirrors** the test+lib pattern of `audit-lint-lib.cjs` +
  `__tests__/opsAuditLint.test.ts` (pure `.cjs` lib `require()`d by Jest).
- **Confirms/supersedes** the Family-D amendment §7 latency note (`docs/audits/
  MCP-021C-EDGE-FAMILY-D-ENABLE-SMOKE-AMENDMENT-2026-05-27.md`) — see § A.3 for
  the threshold reconciliation.
- **Blocks/enables** the future `OPS-MCP-AUTO-TRIGGER-PARALLELIZATION` card: per
  D9 that card is filed **only if** this projection shows G (or a near-term
  family) crosses the 45s FAIL line. The projection's crossing-count output is
  that card's trigger condition.
- **Informs** `MCP-SERVER-008-FAMILY-G` (and the eventual G-enable card): G
  enters production with this budget in hand.

---

## Risks

- **Live-measurement credential dependency.** Phases 1–4 of the post-merge smoke
  need live `submit-argument` calls (`.env.bot-tests`, present). If the keys are
  unavailable at smoke time, the measurement is operator-deferred and the smoke
  is **PARTIAL** (thresholds + classification logic + projection method codified;
  actual fresh-N numbers pending) — the established consistent-PARTIAL pattern.
  The *design and the pure logic do not depend on live creds*; only the final
  numbers do. This is a smoke risk, not a code risk.
- **Tiny-N percentile.** p95 of 5 samples is a coarse estimate. Mitigation: the
  report prints min/p50/p95/max + sample count + `low_sample_warning`, and the
  projection prints both a central (median) and a pessimistic (max) row, so the
  operator never reads a single p95 as gospel. D1 fixes N=5 as the *minimum*;
  the report accepts more if the window has more.
- **Per-family-sum vs wall-clock gap.** The live probe shows wall-clock
  (30.44s) > per-family sum (28.73s) by the dispatch overhead. A naive
  projection that summed per-family p95 would **under**-estimate wall-clock.
  Mitigation: the projection **anchors on measured wall-clock p95** and adds an
  explicit `perFamilyDispatchGap` term per added family — documented in § A.3.
- **`supabase db query` shell quirk on Windows.** The reused `runSupabaseSqlFile`
  already sets `shell: process.platform === 'win32'` and parses `parsed.rows`;
  the new SQL files were executed via that exact path this session and parsed
  cleanly, so no new platform risk.
- **Existing tests.** No existing test is modified — the new report is a
  separate file with a separate `schemaVersion`, and the observability lib is
  imported read-only. The observability report's 15-section TOC and its
  doctrine ban-list suite are untouched. Test count goes strictly **up**.
- **Operator deploy.** None required — pure code + read-only SQL + docs. No
  migration, no Edge Function, no env var, no `package.json`. The Supabase
  GitHub auto-deploy is a no-op for this card.

---

## Out of scope

Explicitly NOT in this card (reduces scope creep):

- **Any change to `autoTriggerDispatcher.ts`** — no dispatch change, no
  parallelization, no `Promise.all`, no reordering. (HALT triggers 1 & 2.)
- **Any change to `familyRegistry.ts`** — no production flips, no G/H/I/J
  registration. (HALT trigger 3.)
- **Parallelizing the dispatcher** — that is a *future* card
  (`OPS-MCP-AUTO-TRIGGER-PARALLELIZATION`), filed only if this projection shows
  a near-term FAIL crossing. (D9.)
- **Any prompt / taxonomy / schema / key change**; any `mcp-server/**` runtime
  change. (HALT triggers 4 & 5.)
- **`package.json` / `package-lock.json`** — no npm script, no dependency.
  (HALT trigger 6.)
- **The audit-lint enforcement surface** (`audit-lint-rules.cjs`,
  `audit-lint-lib.cjs`, `audit-lint.mjs`, its fixtures). (HALT trigger 7.) The
  new lib `require()`s the *observability* lib, not the audit-lint lib.
- **Optimizing or caching the classifier**; **adding the structured-log
  `latency_ms` as a binding source** (it is noted as a *secondary* signal only;
  the DB columns bind — § A.2).
- **Any user-facing surface.** The report is operator tooling under `out/`; no
  `app/`, no `src/`, no `gameCopy` code, no node-label change.
- **Reducing the smoke's submission load** below N=5 (D1).

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels; score never blocks posting):** the
  report carries **no** verdict/winner/loser/correct language (enforced by a
  ban-list test on the stitched markdown). The budget is **advisory
  measurement** — it never blocks posting and never gates which families run.
  Submit remains fire-and-forget (`EdgeRuntime.waitUntil`); a FAIL
  classification is a signal to file a parallelization card, never an
  instruction to block a submit or drop a family. **RESPECTED.**
- **cdiscourse-doctrine §2 (heat = activity, not truth):** latency is a distinct
  **system-performance** metric; the report never conflates timing with heat,
  quality, popularity, or correctness. No "fast = good" framing. **RESPECTED.**
- **cdiscourse-doctrine §3 (popularity is not evidence):** the queried table has
  no engagement/view/retweet column; the SQL selects only timing + family +
  status. No amplification signal enters the budget. **RESPECTED.**
- **cdiscourse-doctrine §4 (AI moderator limits):** unchanged. This card reads
  *that classification ran and how long it took* — it does not adjudicate,
  delete, or assign truth. The dispatcher (which calls the AI moderator via the
  MCP boundary) is read-only here. **RESPECTED.**
- **cdiscourse-doctrine §5 (rules engine is sacred):** `engine.ts` is not
  imported or touched. **RESPECTED.**
- **cdiscourse-doctrine §6 + §7 (secrets; no AI calls from the app):** the
  report runs via the operator's `npx supabase db query --linked` CLI session
  (no service-role in code, no `ANTHROPIC_API_KEY`, no key literal). The pure
  lib makes no network call. No `app/`/`src/` file is touched, so the §7 app
  boundary is not approached. Live `submit-argument` calls in the *smoke* are
  the deployed production system's normal behavior, `.env.bot-tests`-gated —
  out of code scope. **RESPECTED.**
- **cdiscourse-doctrine §8 (Supabase conventions):** no migration, no RLS change,
  no table mutation, read-only query only; RLS is unchanged (the operator CLI
  reads as itself). **RESPECTED.**
- **cdiscourse-doctrine §9 (plain language):** the report is operator tooling;
  family taxonomy values (`parent_relation`, `critical_question`, …) are
  machine-taxonomy strings in an operator-facing report, never surfaced to end
  users — same posture as the observability report. No `gameCopy` code added.
  **RESPECTED.**
- **cdiscourse-doctrine §10a (Observations vs Allegations):** the runs being
  timed are Machine Observations; the budget doc never reframes a timing number
  as a person-level claim. **RESPECTED.**
- **cdiscourse-doctrine §10 (v1 scope guards):** no voting, no search, no push,
  no OAuth, no public API, no realtime editing. Read-only OPS measurement.
  **RESPECTED.**
- **test-discipline:** the new pure lib gets full boundary-case unit coverage
  (classification, projection, percentile, aggregate, ban-list, purity); tests
  ship *with* the card; test count goes up (+18); no `.skip`/`.only`; no
  committed `console.log`. **RESPECTED.**

---

## HALT-trigger evaluation (all 10)

| # | Trigger | Fires? | Why not |
| --- | --- | --- | --- |
| 1 | `autoTriggerDispatcher.ts` change (dispatch behavior) | **NO** | Read-only in this card; not in the file-changes list; explicitly out of scope. **[scope core]** |
| 2 | Any parallelization in this card | **NO** | No `Promise.all`, no reorder; sequential dispatch unchanged (D9). Parallelization is a future card. **[scope core]** |
| 3 | `familyRegistry.ts` change (flips/registration) | **NO** | Not touched; G/H/I/J stay `productionEnabled: false`; not in file-changes. |
| 4 | Prompt / taxonomy / schema / key change | **NO** | No migration, no schema, no key; read-only query against existing columns. |
| 5 | `mcp-server/**` runtime change | **NO** | Not touched; the design only *reads* run rows. |
| 6 | `package.json` / `package-lock.json` change | **NO** | No npm script (neither obs-report nor audit-lint has one); no dependency. Report runs via `node scripts/ops/…`. |
| 7 | Audit-lint surface change (rules/lib/mjs/fixtures) | **NO** | The new lib `require()`s the **observability** lib, not the audit-lint lib; audit-lint files untouched. |
| 8 | Budget defined against the wrong clock (sum / submit-to-complete) | **NO** | Threshold binds to **`wall_clock_background`** (D2); `classifyLatencyBudget`'s parameter is named `wallClockBackgroundP95Seconds`; the other two clocks are context-only; live probe distinguishes them. **[correctness core]** |
| 9 | Single-sample measurement | **NO** | D1 fixes **N=5**; SQL `LIMIT 5`; report asserts `samples ≥ 2` before emitting a p95 and flags `<5` families; smoke submits 5 fresh args. |
| 10 | Test forecast > +50 | **NO** | Forecast **+18** (band +10..+30). |

**Conclusion: none of the 10 HALT triggers fire.** The two scope-core triggers
(1, 2 — dispatch/parallelization) are structurally avoided (the dispatcher is
read-only and absent from the file-changes list), and the correctness-core
trigger (8 — wrong clock) is encoded in the function signature
(`wallClockBackgroundP95Seconds`) and confirmed against the live probe that
shows `wall_clock_background` (30.44s) is strictly distinct from — and the
binding superset of — `sum_of_per_family` (28.73s).

---

## Evidence (read-only probe, this session)

All probes were **read-only** (`npx supabase db query --linked`, the operator
CLI session; no writes, no service-role, no `submit-argument` call). Temp SQL
files were removed after use. The probes (a) confirm the timing columns are
live, (b) prove the exact design SQL executes cleanly, and (c) supply real
numbers that anchor the projection.

**(1) Timing columns live** (`information_schema.columns`):
`started_at` = `timestamp with time zone`, `is_nullable = NO`;
`completed_at` = `timestamp with time zone`, `is_nullable = YES`;
`run_mode` text NOT NULL; `requested_families` ARRAY NOT NULL;
`status` text NOT NULL. → A.1 confirmed.

**(2) Per-family durations** (Q16 shape, most-recent-5-arg window; seconds):

| family | samples | min | avg | max |
| --- | --- | --- | --- | --- |
| parent_relation (A) | 5 | 4.33 | 5.14 | 6.08 |
| disagreement_axis (B) | 5 | 3.51 | 4.00 | 4.79 |
| misunderstanding_repair (C) | 5 | 4.73 | 4.97 | 5.42 |
| evidence_source_chain (D) | 5 | 5.39 | 6.03 | 7.63 |
| argument_scheme (E) | 2 | 4.81 | 4.94 | 5.07 |
| critical_question (F) | 1 | 5.13 | 5.13 | 5.13 |

Per-family duration is empirically flat (~4–6s; D heaviest at the 19-key
subset). Median of per-family maxima ≈ 5.25s → `addedFamilyP95 = 6s` (rounded
up). E/F have `< 5` samples today (newest families) — the smoke's fresh N=5
raises all six to ≥ 5. → A.1 + A.3 confirmed.

**(3) Per-argument wall-clock** (Q17 shape; seconds):

| argument | family_runs | wall_clock_background | sum_of_per_family | gap |
| --- | --- | --- | --- | --- |
| 163d66d1… | 6 | **30.44** | 28.73 | 1.71 |
| b5bc7680… | 5 | 27.98 | 26.67 | 1.31 |
| f1757532… | 4 | 21.54 | 20.49 | 1.05 |
| cd67e76f… | 4 | 21.16 | 20.23 | 0.93 |
| 5242c8cd… | 4 | 20.64 | 19.60 | 1.04 |

The current **6-family `wall_clock_background` is 30.44s — already on the 30s
warning line**, and is strictly **greater** than the per-family sum by the
dispatch gap (1.71s over 5 inter-family gaps ≈ 0.34s/family → `dispatchGap =
0.5s` rounded up). This is the empirical proof that (a) `wall_clock_background`
is the correct binding clock (it is the larger quantity that crosses the
threshold — HALT trigger 8 substantiated), and (b) the card is timely: G enters
right as the warning line is reached. These numbers are *illustrative anchors
from existing runs*; the binding measurement is the post-merge smoke's fresh
N=5 per D1. → A.2 + A.3 + A.4 confirmed.

These match the documented progression in `MCP-021C-EDGE-FAMILY-F-ENABLE-SMOKE-
2026-05-28.md` (4-family ~18–20s, 5-family 22s, 6-family 26s — the smoke's
"~26s" was first-dispatch-to-last-completion measured live during that card;
the 30.44s here is a later, heavier-D sample) and supersede the Family-D
amendment §7 note (see § A.3).

---

## Appendix — Phase A audit findings (the 4 required audits)

### A.1 — Timing-column availability + exact SQL

`started_at` (NOT NULL) and `completed_at` (nullable) **exist** on
`argument_machine_observation_runs` — confirmed in the migration *and* live
against the linked DB (§ Evidence (1)). The EXACT extraction SQL is Q16
(per-(argument, family) durations, filtered `run_mode='production'`,
`status='success'`, `array_length(requested_families,1)=1`, most-recent-N
arguments) and Q17 (per-argument `wall_clock_background` + `sum_of_per_family`).
**Percentiles are computed in the report JS**, not in SQL — across a tiny N=5 a
JS `percentile()` is clearer, unit-testable, and avoids `percentile_cont`
ordered-set-aggregate awkwardness. Both queries executed cleanly this session.

### A.2 — Clock definitions + binding choice (D2)

Three clocks, all computed per sample:
- `sum_of_per_family_durations` = Σ (`completed_at − started_at`) over the
  argument's production runs — **work time; context only**.
- **`wall_clock_background`** = `max(completed_at) − min(started_at)` over the
  argument's production runs — **the BINDING threshold clock.** It grows with
  family count and is the quantity that actually crosses 45s. *Rationale (one
  line):* it is the real elapsed background wall-time a user's classification
  takes end-to-end, and it is strictly ≥ the per-family sum (live: 30.44 vs
  28.73) because it includes the inter-family dispatch gaps the sum omits — so
  binding to it is conservative and correct.
- `submit_to_last_complete` = `max(completed_at) − submit_started_at` (app-side
  submit timestamp correlated with the run rows) — **full elapsed incl. dispatch
  kickoff; context only**, captured during the smoke.

The dispatcher's structured-log `latency_ms` (`Date.now() − iterationStartMs` in
`dispatchOneFamilyIteration`) is a **secondary app-side signal** and is
deliberately **not** the binding source: it includes the idempotency pre-check
and any retry-backoff `sleep` (2s/8s) *inside* the measured span, so it
over-counts pure classification time and is not persisted/queryable. The DB
columns are canonical because they are persistent, queryable, and bound exactly
to the classifier run boundary.

### A.3 — Threshold + projection design (D5, D6)

**Thresholds confirmed: 30s warning / 45s FAIL.** Reconciliation of the prior
sources: the Family-D amendment §7 (`…AMENDMENT-2026-05-27.md:138`) called 45s
"the amendment's 45-second **PARTIAL** threshold" while the F-enable smoke
(`…FAMILY-F-ENABLE-SMOKE-2026-05-28.md:204-209`) and the intent brief D5 treat
**45s as the FAIL line and 30s as the warning/PARTIAL line**. I adopt the
intent/F-enable framing (30s warning = PARTIAL, 45s = FAIL) as canonical and
treat the D-amendment's single "45s PARTIAL" wording as the earlier, looser
phrasing now superseded — *rationale:* a two-band model (warn + fail) gives the
operator a headroom signal *before* the hard ceiling, which is exactly what a
budget card should provide, and it matches the most recent (F-enable) audit's
headroom table. The 45s ceiling itself is well under the `EdgeRuntime.waitUntil`
budget (~150s; F-enable smoke "5.8x headroom"), so 45s is a *product-experience*
ceiling (fresh observations should land within a reasonable window), not a
platform hard limit — confirmed reasonable.

**Projection arithmetic:** anchor on the measured 6-family `wall_clock_background`
p95, then add `(n−6) × (addedFamilyP95 + perFamilyDispatchGap)` for
n ∈ {7,8,9,10}. **Assumption for added families' per-family p95:** the **median
of the 6 measured per-family p95 values, rounded up to the next whole second**
(`= 6s` from the live probe), justified because per-family duration is
empirically flat across A–F and the median is robust to D's heavy tail; a
**sensitivity row** additionally projects with the worst measured family p95
(D ≈ 7.6s) so the operator sees central + pessimistic. **`perFamilyDispatchGap`**
= observed `(wall_clock − sum)/(familyRuns−1)` ≈ 0.34s → `0.5s` rounded up;
including it is why the projection anchors on wall-clock, not the per-family sum
(which under-counts). The report prints the projection table (count → projected
wall p95 → crosses-warn → crosses-fail) and a one-line verdict naming the
warning-crossing count, the FAIL-crossing count, and the **G (7th-family)
under/over-budget call** — all derived mechanically from the projection rows.

### A.4 — Budget-classification logic + test plan (D8)

Pure function `classifyLatencyBudget(wallClockBackgroundP95Seconds: number,
submitBlocked: boolean) → 'PASS'|'PARTIAL'|'FAIL'`, in
`scripts/ops/mcp-latency-report-lib.cjs` (a `.cjs` lib Jest `require()`s —
mirroring `audit-lint-lib.cjs` + `opsAuditLint.test.ts`). `submitBlocked`
checked **first** (D3 → FAIL regardless of background time); then `>= 45` → FAIL,
`>= 30` → PARTIAL, else PASS; non-finite/negative → `RangeError`. Boundary
tests: just-under-45 → PASS; just-under-30 → PASS; exactly-30 → PARTIAL;
30..45 → PARTIAL; just-under-45 → PARTIAL; exactly-45 → FAIL; ≥45 → FAIL;
`submitBlocked=true` + fast background → FAIL; zero → PASS; NaN/-1 → throws.
**Decision: NEW `mcp-latency-report.mjs`** (not an extension) — the
observability report is a generic row-table renderer with a frozen schema and a
fixed 15-section TOC keyed by downstream audits; computed aggregates +
classification + projection belong in a separate report with its own schema,
reusing the shared SQL-runner + ban-list helpers by require-and-re-export.
**Test forecast: +18** (band +10..+30).

---

## Implementer note: cannot proceed all-green within STRICT SCOPE (2026-05-28)

**Author:** implementer (OPS-MCP-LATENCY-BUDGET, branch
`feat/OPS-MCP-LATENCY-BUDGET`).
**Trigger:** the design's § Risks → "Existing tests" assumption — *"No existing
test is modified … Test count goes strictly up"* — is **materially incomplete**.
Two existing **observability** test suites assert **exclusive ownership of the
shared `scripts/ops/sql/` directory** by a hard file count and a card-name
header. The card's own STRICT-SCOPE-mandated SQL files (`16-…sql`, `17-…sql`,
placed in that exact directory per the design's file list) break **3
assertions across 2 files**. Resolving it requires editing files **outside the
implementer's explicit create/edit allow-list**, so per the implementer
protocol I am stopping rather than silently expanding scope or leaving red
tests on the branch.

### Exactly what breaks (verified by `npx jest`)

The implementation is complete and its own gates are green (typecheck 0, lint
0, `__tests__/opsMcpLatencyBudget.test.ts` 47/47). The **full** suite is red
only on these 3 pre-existing assertions, all of which over-claim sole
ownership of the now-shared SQL directory:

1. `__tests__/opsMcpObservabilitySqlSafety.test.ts:59` —
   `expect(FILES.length).toBe(16)` → now **18**. (`FILES` = every
   `scripts/ops/sql/*.sql`.)
2. `__tests__/opsMcpObservabilitySqlSafety.test.ts:163` —
   `expect(src).toContain('OPS-MCP-OBSERVABILITY')` for **every** SQL file →
   the two new files honestly reference `OPS-MCP-LATENCY-BUDGET`.
3. `__tests__/opsMcpObservabilityNoServiceRoleNoSecrets.test.ts:81` —
   `expect(sqlFiles.length).toBe(16)` → now **18**.

**Everything else passes.** The same two suites' *doctrine-safety* scans
(read-only / no `select *` / no bare `arguments.body` / no bare
`evidence_span` / terminating-semicolon / no `SERVICE_ROLE` / no
`Authorization` / no `@supabase/supabase-js` / no `fetch(` / no
`anthropic`/`xai`) all run over the two new SQL files **and the new
`.mjs`/`.cjs`** and **pass** — confirming the new artifacts are doctrine-clean
and that the suites' *intent* (scan everything in `scripts/ops/` for safety) is
correctly served; only the two **directory-ownership invariants** (exact count
+ card-name header) need to become shared-directory-aware.

### Why I did not just fix it

- The STRICT-SCOPE "create/edit ONLY" list is exclusive and does **not**
  include `__tests__/opsMcpObservability*.test.ts`. The dispatcher/registry/etc.
  BLOCK-level list is a different (also-forbidden) set; these two test files are
  simply not authorized for edit.
- The SQL files cannot move (the design's file list and the observability
  report's own `SECTIONS` both pin `scripts/ops/sql/`), and they cannot
  honestly carry an `OPS-MCP-OBSERVABILITY` header. The `=== 16` count
  assertions are unfixable without editing the observability suites. So there
  is **no allow-list-compliant path to all-green**.

### Proposed minimal resolution (for operator/designer authorization)

Authorize a 3-assertion edit to the two observability test files to make their
directory invariants **observability-scoped** rather than
whole-directory-exclusive (a faithful tightening, not a weakening — the safety
scans still cover every file):

- `opsMcpObservabilitySqlSafety.test.ts`: change `toBe(16)` →
  `toBeGreaterThanOrEqual(16)` (or assert the 16 observability files by name),
  and scope the `OPS-MCP-OBSERVABILITY` header check to files whose first
  comment line names that card (other cards' SQL in the shared dir are headed
  with their own card name). Keep all safety scans applied to **all** files.
- `opsMcpObservabilityNoServiceRoleNoSecrets.test.ts:81`: change
  `sqlFiles.length).toBe(16)` → `toBeGreaterThanOrEqual(16)` (the adjacent
  `FILES.length >= 18` already uses the inclusive form; this aligns them).

Alternatively, if the operator prefers zero edits to the observability suite,
the designer can re-place the latency SQL outside `scripts/ops/sql/` (e.g.
`scripts/ops/sql-latency/`) and adjust the latency report's `SQL_DIR` — but
that diverges from the design's current file list and is a designer decision.

**State left on branch:** 3 commits (report+lib+SQL `63681a1`; tests `26e496d`;
this note will be a 4th, committed alone). `out/` untracked. The
`docs/ops/LATENCY-BUDGET.md` + `docs/core/current-status.md` handoff are
written locally but **not committed** pending this decision, so the branch is
not left in a misleadingly-complete state.
