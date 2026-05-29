# OPS-MCP-LATENCY-BUDGET-SMOKE — Post-merge smoke (2026-05-28)

Audit-Lint: v1
Doctrine-risk: false

**Date:** 2026-05-28 (measurement executed 2026-05-29 UTC)
**Operator:** Kyler
**Merge:** PR #352 squash-merged to `main` at `0f3501b`.
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/351
**Scope:** Post-merge live verification of the auto-trigger latency budget. Measures per-family + total background latency across N=5 fresh production submissions, classifies against the codified `wall_clock_background` thresholds (30s warn / 45s FAIL), and projects the family count at which sequential dispatch crosses the budget. This is a measurement smoke; the latency budget is advisory system-performance instrumentation — `Doctrine-risk: false` (it inspects timing, never argument doctrine; family names appear only as timing labels).

**Anthropic spend:** operator-approved, exactly 5 fresh `submit-argument` calls → 30 background classifier calls (6 families × 5 args), all `success`. Canary-first (1 submit verified clean before the remaining 4). No organic user text; all bodies clearly tagged `[ops-latency-budget-smoke]`.

---

## Summary

**Verdict: PARTIAL** — the fresh N=5 `wall_clock_background` p95 = **30.82s** sits in the **30–45s warning band** (headroom pressure), not over the 45s FAIL line. Submit is non-blocking (1.3–2.9s vs ~26–31s background). The projection shows **Family G (the 7th) is UNDER the 45s budget (≈36.3s); the 45s FAIL line is first crossed at the 9th family (Family I)**. So G can ship sequentially with this documented budget; a parallelization card is the pre-Family-I gate, not the pre-G gate. The PARTIAL is the designed "warning crossed" signal, not a failure.

This live N=5 confirms and tightens the read-only baseline (which had E at 2 samples and F at 1); all 6 families are now at 5 samples with no `low_sample_warning`.

---

## Phase 1 — Multi-sample submission (D1, D3)

**Status:** PASS

5 fresh synthetic root claims submitted via `submit-argument` (each its own debate; smoke-tagged resolution + body; `side=affirmative`, `argument_type=claim`). User-facing submit response time recorded per submission (D3):

| sample | argument_id | submit response (ms) | ok |
| --- | --- | --- | --- |
| 1 (canary) | 39e92809-443c-472d-90d4-8efd8680fb19 | 2885 | yes |
| 2 | 0b86eaae-d4f0-4932-aedd-4ef9eb3afdd6 | 1887 | yes |
| 3 | cab0be89-aef2-4702-aeaf-88d3f85ade5e | 1307 | yes |
| 4 | 3d94f718-bb83-4871-bb39-44f673a65d12 | 1292 | yes |
| 5 | 3dea2e27-b03a-402d-808f-80ad7dd566b3 | 1295 | yes |

Submit response p50 ≈ 1.3s, max 2.9s — **all an order of magnitude below the ~26–31s background time**, confirming the submit path is fire-and-forget (`EdgeRuntime.waitUntil`) and never blocks on classification (D3). If submit had blocked on the 6-family chain, each response would have been ~26–31s; it was not.

---

## Phase 2 — Six-run verification per sample

**Status:** PASS

Each of the 5 arguments produced **exactly 6 production run rows** (one per family A–F), all `run_mode='production'`, all `status='success'`, zero `failure_reason`. **No G/H/I/J runs** (the 4 unsupported families did not fire). Verified by per-argument completed-run count (6/6 for every argument) and the Q17 `family_runs` column (6 for all 5).

Canary (arg `39e92809`) per-family confirmation: parent_relation, disagreement_axis, misunderstanding_repair, evidence_source_chain, argument_scheme, critical_question — all `success`, `production`.

---

## Phase 3 — Per-family + total timing (D2, D4)

**Status:** PASS

Three clocks computed; the budget binds to **`wall_clock_background`** (D2) = `max(completed_at) − min(started_at)` per argument.

**Per-family duration (fresh N=5; all families at 5 samples — no `low_sample_warning`):**

| family | min | p50 | p95 | max |
| --- | --- | --- | --- | --- |
| parent_relation (A) | 3.937s | 4.246s | 4.877s | 4.877s |
| disagreement_axis (B) | 3.370s | 3.770s | 3.909s | 3.909s |
| misunderstanding_repair (C) | 4.450s | 4.586s | 4.777s | 4.777s |
| evidence_source_chain (D) | 4.691s | 5.024s | 5.271s | 5.271s |
| argument_scheme (E) | 4.078s | 4.149s | 4.612s | 4.612s |
| critical_question (F) | 3.613s | 3.649s | 7.616s | 7.616s |

**Per-argument wall-clock (Q17):**

| argument_id | family_runs | wall_clock_background (s) | sum_of_per_family (s) | gap (s) |
| --- | --- | --- | --- | --- |
| 3dea2e27… | 6 | 30.820 | 29.514 | 1.306 |
| 3d94f718… | 6 | 28.332 | 26.847 | 1.485 |
| 39e92809… | 6 | 28.037 | 25.850 | 2.187 |
| cab0be89… | 6 | 27.650 | 26.275 | 1.375 |
| 0b86eaae… | 6 | 26.426 | 25.049 | 1.377 |

**Wall-clock background summary (binding clock):** p50 = **28.037s**, **p95 = 30.820s**, min 26.426s, max 30.820s. The gap (wall − sum, ~1.3–2.2s) is the inter-family dispatch overhead, which is exactly why the budget binds to wall-clock (the larger, real-elapsed quantity) and not the per-family sum (which under-counts). `submit_to_last_complete` is dominated by the background time (submit ≈ 1.3–2.9s + background ≈ 26–31s); the binding clock excludes the submit kickoff so the budget measures pure background work.

---

## Phase 4 — Budget classification + projection (D5, D6)

**Status:** PASS (classification result: **PARTIAL**)

`classifyLatencyBudget(wallClockBackgroundP95Seconds = 30.820, submitBlocked = false)` → **PARTIAL** (≥ 30s warning, < 45s FAIL; submit not blocked).

**Sequential-dispatch projection** (anchored on measured 6-family wall-clock p95 = 30.820s; central added-family p95 = 5.0s = median of measured per-family p95 rounded up; per-family dispatch gap = 0.5s):

| families | projected wall-clock p95 | crosses 30s warn | crosses 45s FAIL |
| --- | --- | --- | --- |
| 7 (Family G) | 36.32s | YES | no |
| 8 (Family H) | 41.82s | YES | no |
| 9 (Family I) | 47.32s | YES | **YES** |
| 10 (Family J) | 52.82s | YES | YES |

Sensitivity (worst measured family p95 = 7.6s): the 45s line is crossed at the 8th family.

**Verdict (mechanical, from the 7-family row): G (7th family) is projected UNDER the 45s FAIL budget. The 30s warning line is already crossed at the current 6 / next 7. The 45s FAIL line is first crossed at the 9th family (Family I)** (central) or the 8th (pessimistic). A FAIL projection is a signal to file `OPS-MCP-AUTO-TRIGGER-PARALLELIZATION`; it is never an instruction to drop a family or block a submit.

---

## Phase 5 — Observability + duplicate check (Q9)

**Status:** PASS

The latency report re-ran cleanly over the fresh N=5 (`sample_count = 5` per family; classification PARTIAL — consistent). Q9 (`09-duplicate-runs.sql`) returned **3 rows, all `audit_or_smoke_rerun`** (the pre-documented historical pairs); **zero `organic_duplicate_candidate`**. None of the 5 smoke arguments appears in Q9 — each (argument, family) tuple ran exactly once (idempotency held), so no duplicate was created. Requirement satisfied: the smoke produced no organic duplicate-risk signal.

---

## Phase 6 — Regression + dogfood

**Status:** PASS

Run on the merged commit `0f3501b` (the smoke executed no code change — only the read-only report + gated live submissions):

| Gate | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npx jest --testPathPattern="opsMcpLatency" --no-coverage` | 2 suites / 67 tests, exit 0 |
| `npx jest --testPathPattern="opsMcpObservability" --no-coverage` | 12 suites / 173 tests, exit 0 (observability ownership intact; SQL dir at 16) |
| `cd mcp-server && deno test --allow-net --allow-env --allow-read` | 871 passed, exit 0 (unchanged — no mcp-server touch) |

**Dogfood:** this smoke audit self-lints clean — `node scripts/ops/audit-lint.mjs docs/audits/OPS-MCP-LATENCY-BUDGET-SMOKE-2026-05-28.md` → exit 0 (`ops` audit type, verdict PARTIAL, `Doctrine-risk: false`).

---

## Read-only baseline vs live N=5 (separated per operator requirement)

| metric | read-only baseline (existing runs) | live N=5 (this smoke) |
| --- | --- | --- |
| wall_clock_background p95 | 30.44s | 30.82s |
| wall_clock_background p50 | 21.54s | 28.04s |
| classification | PARTIAL | PARTIAL |
| families at ≥5 samples | A,B,C,D (E=2, F=1; low-sample) | all 6 (A–F) |
| full 6-family wall-clock samples | 1 | 5 |
| G (7th) projection | ≈36.9s UNDER 45s | ≈36.3s UNDER 45s |
| 45s FAIL crossing | 9th family | 9th family (central) / 8th (pessimistic) |

The live N=5 raises every family to 5 samples and supplies 5 clean 6-family wall-clock samples, replacing the baseline's low-sample E/F and single full sample. Both agree: PARTIAL, G under budget, FAIL crossing at the 9th family.

---

## Final verdict

**PARTIAL**

- Budget classification = PARTIAL: `wall_clock_background` p95 = 30.82s, in the 30–45s warning band (headroom pressure), not over the 45s FAIL line; submit non-blocking. This is the designed "warning crossed" outcome.
- Six-run verification: all 5 samples produced exactly 6 production runs (A–F), 0 G/H/I/J, all `success`.
- All three clocks computed; budget bound to `wall_clock_background` (not the per-family sum).
- Submit-response latency (1.3–2.9s) separated from background latency (26–31s) — submit confirmed fire-and-forget.
- Projection for 7/8/9/10 families present; **G (7th) UNDER 45s; 45s FAIL first crossed at the 9th family (Family I)**.
- Budget-classification + projection logic unit-tested at boundaries (67 latency tests green).
- Regression + dogfood clean; observability ownership intact; Q9 no organic duplicate.

---

## Authorizations + follow-ups

- `OPS-MCP-LATENCY-BUDGET-SMOKE: PARTIAL` (headroom-pressure flag — the 30s warning line is crossed at the current/next family count; this is the intended budget signal, not a defect).
- The latency budget is **codified** (`docs/ops/LATENCY-BUDGET.md`) and re-measurable (`node scripts/ops/mcp-latency-report.mjs`); future production-enable smokes re-measure against it.
- **`MCP-SERVER-008-FAMILY-G` is authorized to enter the production path under sequential dispatch** — G is projected UNDER the 45s budget (≈36.3s). G ships with a known budget.
- **File `OPS-MCP-AUTO-TRIGGER-PARALLELIZATION` before the 9th family (Family I) production-enable** — the projection crosses 45s at N=9 (central) / N=8 (pessimistic). Parallelization is the pre-I gate, not the pre-G gate. Sequential dispatch is unchanged by this card (D9).

---

## Smoke artifacts (remain in DB as tagged test fixtures)

5 smoke-tagged debates + 5 root-claim arguments + 30 production run rows (6 per argument), all `[ops-latency-budget-smoke]`-tagged. Like the F-amendment fixtures, they remain as historical test data and contribute to Q14 per-family density signal. Argument IDs: `39e92809`, `0b86eaae`, `cab0be89`, `3d94f718`, `3dea2e27`. No secrets logged; no service-role used; submissions made from the `.env.bot-tests` bot session via the public anon path.
