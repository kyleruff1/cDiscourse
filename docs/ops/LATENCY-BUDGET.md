# OPS — Auto-trigger latency budget

**Card:** OPS-MCP-LATENCY-BUDGET (issue #351)
**Status:** Codified. Measures + codifies only — no dispatch change, no
parallelization, no family flip (design D9).
**Source-of-truth:** `docs/designs/OPS-MCP-LATENCY-BUDGET.md` (+ the intent
brief at `docs/designs/OPS-MCP-LATENCY-BUDGET-intent.md`).
**Report:** `scripts/ops/mcp-latency-report.mjs` (read-only operator CLI).
**SQL:** `scripts/ops-latency-sql/01-…`, `scripts/ops-latency-sql/02-…` (see
§ "Directory ownership" below).

This document defines the latency budget that governs the **background**
Boolean-Observation classification work the auto-trigger dispatcher runs per
new argument. It exists so Family G (and later families) enter the production
path with a *defined* budget rather than a reactive surprise.

> **Doctrine.** Latency is a **system-performance** metric, never a
> gameplay / truth / heat signal (cdiscourse-doctrine §1, §2). The budget
> governs background work time. It **never** blocks argument posting:
> `submit-argument` is fire-and-forget (`EdgeRuntime.waitUntil`) and returns
> before the dispatcher settles. A FAIL classification is a signal to file a
> parallelization card — never an instruction to drop a family or block a
> submit, and never a quality verdict on any argument.

---

## The three clocks

Six families (A+B+C+D+E+F) currently fire **sequentially** per new argument
(`supabase/functions/_shared/booleanObservations/autoTriggerDispatcher.ts`:
one `await dispatchOneFamilyIteration(...)` per family in a `for-of` loop, run
as a background task). Three clocks are computable from the
`public.argument_machine_observation_runs` table (`started_at` NOT NULL,
`completed_at` nullable):

| Clock | Definition | Role |
| --- | --- | --- |
| `sum_of_per_family_durations` | Σ over the argument's production-success runs of (`completed_at − started_at`) | **work time; context only** |
| **`wall_clock_background`** | `max(completed_at) − min(started_at)` over the argument's production-success runs | **BINDING threshold clock** |
| `submit_to_last_complete` | `max(completed_at) − submit_started_at` (app-side submit timestamp correlated with the run rows) | full elapsed incl. dispatch kickoff; **context only**; captured during the smoke |

### The 45s budget is defined against `wall_clock_background`

This is load-bearing and explicit so a future reader does not apply the budget
to the wrong clock: **the warning (30s) and FAIL (45s) thresholds are defined
against `wall_clock_background` p95**, not against the per-family sum and not
against `submit_to_last_complete`.

`wall_clock_background` is the real elapsed background wall-time a user's
classification takes end-to-end. It is strictly **≥** the per-family sum
because it includes the inter-family dispatch gaps the sum omits (live probe:
`wall_clock_background` 30.44s vs `sum_of_per_family` 28.73s for a 6-family
argument). Binding to the larger, gap-inclusive quantity is conservative and
correct: it is the quantity that actually crosses the threshold.

The dispatcher's structured-log `latency_ms` is a **secondary app-side signal
only** and is deliberately not the binding source — it includes the
idempotency pre-check and any retry-backoff `sleep` inside the measured span,
so it over-counts pure classification time, and it is not persisted/queryable.
The DB columns are canonical because they are persistent, queryable, and bound
exactly to the classifier run boundary.

---

## Thresholds (against `wall_clock_background` p95)

| Classification | Condition |
| --- | --- |
| **PASS** | `wall_clock_background` p95 **< 30s** AND the submit path does not block on classification |
| **PARTIAL** | `wall_clock_background` p95 **≥ 30s and < 45s**, non-blocking — headroom pressure worth flagging before the next production family |
| **FAIL** | submit path blocks on classification (**checked first**), OR `wall_clock_background` p95 **≥ 45s** |

Boundaries are **inclusive** on the lower edge: exactly-30 → PARTIAL,
exactly-45 → FAIL (`>= WARN_SECONDS`, `>= FAIL_SECONDS`). Constants live in
`scripts/ops/mcp-latency-report-lib.cjs` as `WARN_SECONDS = 30` /
`FAIL_SECONDS = 45`.

### Rationale (30s warning / 45s FAIL)

A two-band model (warn + fail) gives the operator a **headroom signal before**
the hard ceiling — exactly what a budget card should provide. The 45s ceiling
is well under the `EdgeRuntime.waitUntil` platform budget (~150s; the F-enable
smoke reported ~5.8x headroom), so **45s is a product-experience ceiling**
(fresh observations should land within a reasonable window), not a platform
hard limit. The current 6-family `wall_clock_background` is already ~30.44s —
sitting on the 30s warning line — which is the card's reason to exist: Family G
enters right as the warning line is reached.

The classifier `classifyLatencyBudget(wallClockBackgroundP95Seconds,
submitBlocked)` evaluates **`submitBlocked` first** (a blocked submit is an
immediate FAIL regardless of background timing — design D3), then the `>= 45`
and `>= 30` bands. Non-finite / negative input throws `RangeError` (never
silently PASS).

---

## Projection method + the G call

The card's reason to exist is the **projection**: under continued sequential
dispatch, at what family count does `wall_clock_background` cross the warning
and FAIL lines, and is **G (the 7th family)** under or over budget?

`projectWallClockForFamilyCounts(...)` anchors on the measured 6-family
`wall_clock_background` p95 (the anchor already includes the real dispatch
gaps) and adds, per family beyond 6:

```
projectedWallClockP95(n) = measuredWallClockP95(6)
                         + (n − 6) * (addedFamilyP95 + perFamilyDispatchGap)
```

- **`addedFamilyP95`** (assumption, stated): the **median of the measured
  per-family p95 values, rounded up to the next whole second**. Per-family
  duration is empirically flat across A–F (live probe maxima 4.0–7.6s
  regardless of key count), so the median is representative; rounding up is a
  conservative ceiling robust to a single heavy family (D's tail). The report
  also prints a **sensitivity** projection using the **worst** measured family
  p95 (≈ 7.6s) so the operator sees both a central and a pessimistic curve.
- **`perFamilyDispatchGap`** (assumption, stated): the observed
  `(wall_clock − sum) / (familyRuns − 1)` (live ≈ 0.34s), default **0.5s**
  (rounded up). Including this term is why the projection anchors on measured
  wall-clock, not the per-family sum (which systematically under-counts).

The report emits a projection table (family count → projected
`wall_clock_background` p95 → crosses-30s-warn → crosses-45s-FAIL) and a
one-line verdict naming the warning-crossing count, the FAIL-crossing count,
and the **G under/over-budget call**. The G call is derived **mechanically**
from the 7-family row's FAIL flag (`projection.rows[familyCount=7].crossesFail`);
it is data-derived, never hard-coded.

> **Illustrative** (the operator recomputes from the post-merge smoke's fresh
> N=5): with a 6-family wall p95 ≈ 30.4s, `addedFamilyP95 = 6s`, gap = 0.5s →
> 7 families ≈ 36.9s (**PARTIAL — G UNDER the 45s FAIL budget, already past the
> 30s warning**), 8 ≈ 43.4s, 9 ≈ 49.9s (**FAIL — crosses 45s**), 10 ≈ 56.4s.
> So the 30s warning is already crossed at the current 6, and the 45s FAIL line
> is projected to cross at the 9th family. **G can ship sequentially with a
> known, documented budget; the parallelization card
> (`OPS-MCP-AUTO-TRIGGER-PARALLELIZATION`) is the pre-I gate, not the pre-G
> gate** — and is filed only if/when a projection shows a near-term FAIL
> crossing (design D9). Final numbers come from the post-merge smoke.

---

## Directory ownership

The latency SQL lives in its own dedicated directory:

```
scripts/ops-latency-sql/
  01-auto-trigger-per-family-duration.sql      (Q16 — per-family durations)
  02-auto-trigger-wall-clock-per-argument.sql  (Q17 — wall_clock_background)
```

`scripts/ops/sql/` remains **observability-owned** — it holds exactly the 16
`OPS-MCP-OBSERVABILITY` query files and nothing else. The latency SQL is kept
**out of that tree** on purpose: the observability SQL-safety suites
(`__tests__/opsMcpObservabilitySqlSafety.test.ts` and
`__tests__/opsMcpObservabilityNoServiceRoleNoSecrets.test.ts`) assert an
**exact 16-file count** over `scripts/ops/` — the latter scans `scripts/ops/`
**recursively** — and require every file in that directory to carry an
`OPS-MCP-OBSERVABILITY` header. Placing latency SQL anywhere under
`scripts/ops/` (including a `scripts/ops/<subdir>/`) would break those
invariants. A **sibling** directory (`scripts/ops-latency-sql/`, outside
`scripts/ops/`) keeps the observability suites green and byte-for-byte
untouched while giving the latency SQL a clear home.

> **Operator decision (Option B — relocate).** The original implementation
> placed the SQL at `scripts/ops/sql/16-…` / `…/17-…`, which broke three
> observability assertions. Per the operator's Option B resolution, the SQL was
> relocated out of the observability-owned dir and locally renumbered `01`/`02`.
> Because the observability secrets-scan counts `.sql` files **recursively**
> under `scripts/ops/`, the dedicated dir is a **sibling**
> (`scripts/ops-latency-sql/`) rather than a nested `scripts/ops/latency-sql/`,
> so the recursive 16-file count is preserved and no observability test is
> touched. The latency SQL retains equivalent doctrine coverage via
> `__tests__/opsMcpLatencySqlSafety.test.ts`, scoped to the new dir.

The latency report CLI stays at `scripts/ops/mcp-latency-report.mjs` and its
pure lib at `scripts/ops/mcp-latency-report-lib.cjs` (alongside the
observability report, with which they share `runSupabaseSqlFile` +
`scanMarkdownForBannedTokens` by require-and-re-export); only the **SQL files**
move to the sibling dir. The CLI resolves the SQL from `scripts/ops-latency-sql/`.

---

## How to run the report

The report is read-only operator tooling. It runs the two latency SQL files
via the operator's authenticated `npx supabase db query --linked` CLI session
(no service-role, identical envelope to the observability report), computes the
percentiles + classification + projection in JS, stitches a markdown + JSON
artifact, runs the doctrine ban-list scan, and writes to
`out/ops-latency/<UTC>/`.

```bash
# Full report (writes out/ops-latency/<ts>/report.{md,json}):
node scripts/ops/mcp-latency-report.mjs

# Dry-run (compute + validate + ban-list scan; no files written):
node scripts/ops/mcp-latency-report.mjs --no-write

# JSON artifact only:
node scripts/ops/mcp-latency-report.mjs --json-only

# Custom output directory:
node scripts/ops/mcp-latency-report.mjs --out-dir <path>
```

There is **no npm script** (consistent with the observability report) — the
report runs via `node scripts/ops/...` directly.

The two read-only SQL files can also be run standalone:

```bash
npx supabase db query --linked --file scripts/ops-latency-sql/01-auto-trigger-per-family-duration.sql
npx supabase db query --linked --file scripts/ops-latency-sql/02-auto-trigger-wall-clock-per-argument.sql
```

`01-…` returns one row per production-success family run for the most recent
N=5 arguments (`requested_families[1]` is the family; duration in seconds).
`02-…` returns per-argument `wall_clock_background_seconds`,
`sum_of_per_family_seconds`, and the family-run count for the same N=5 window.
Both are pure aggregate reads — no body text, no `evidence_span`.

### Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | At least one SQL file failed (supabase CLI exit preserved). The codified thresholds + projection method still emit with a no-data note, so codification is never blocked by a transient DB hiccup. |
| 2 | Doctrine ban-list scan triggered in the stitched output |
| 5 | CLI argument parse error |

### Edge cases the report surfaces

- **No production runs yet** → classification reported as
  `indeterminate (no samples)`, **never** `PASS`; exit 0 if the SQL succeeded
  with zero rows, exit 1 if the SQL itself failed.
- **A family with < 5 samples** → `low_sample_warning: true` on that family's
  aggregate (the live probe shows newer families at < 5 today; the post-merge
  smoke's 5 fresh submissions raise all six to ≥ 5).
- **A single sample** → p95 == p50 == that value, flagged `low_sample_warning`.
- **`completed_at IS NULL`** (a run that started but never finished) → excluded
  by both queries; the report notes the count so a silent classifier hang is
  visible rather than hidden.

---

## What this card does NOT do

- It does **not** change `autoTriggerDispatcher.ts` (no dispatch change, no
  `Promise.all`, no reordering).
- It does **not** change `familyRegistry.ts` (no production flips; G/H/I/J stay
  `productionEnabled: false`).
- It does **not** parallelize the dispatcher — that is the future
  `OPS-MCP-AUTO-TRIGGER-PARALLELIZATION` card, filed only if this projection
  shows a near-term FAIL crossing.
- It adds **no** prompt / taxonomy / schema / key / migration / Edge Function /
  `package.json` change, and **no** user-facing surface. It is OPS measurement
  tooling under `out/`.
