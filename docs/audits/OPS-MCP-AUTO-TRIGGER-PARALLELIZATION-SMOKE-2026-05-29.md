# OPS-MCP-AUTO-TRIGGER-PARALLELIZATION-SMOKE — Post-merge smoke (2026-05-29)

Audit-Lint: v1

**Date:** 2026-05-29
**Operator:** Kyler
**Merge:** PR #364 squash-merged to `main` at `2394aef` (sequential `for...await` → bounded-parallel dispatch, concurrency limit 2).
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/363
**Scope:** Post-merge live verification of the bounded-parallel auto-trigger dispatcher. Canary-first (1 submission), then N=5 total. Verifies the submit-nonblocking property, 7-family dispatch (A–G), the overlap diagnostic (max observed concurrency), the 429/rate-limit capture, the live latency re-measure vs the 34.555s sequential baseline, and the D5 latency-report anchor fix. No prompt/taxonomy/schema/key change; no flag flip; no family enablement.

**Verdict: PARTIAL** — bounded parallelism is LIVE and effective (overlap=2 on every argument; `wall_clock_background` p95 improved from ~34.6s sequential to ~19.3s, below the 30s PASS line; submit nonblocking; zero 429; all 7 families dispatched per argument; no missing/duplicate dispatch). However, the N=5 live burst produced **4 of 35 family runs failing with `mcp_validation_failed`**. The failure mode is pre-existing (first observed 2026-05-28 under the OLD sequential code) and is NOT dispatcher-caused, but it is a material production-readiness finding under high cross-argument concurrency. A PASS verdict would understate the operational risk. Not a rollback — a follow-up hardening card.

---

## Summary

The card's primary implementation and latency objectives were achieved: submit stays fire-and-forget, exactly 7 production runs A–G are created per submitted argument, H/I/J do not run, no duplicate family runs appear, bounded overlap reaches 2 on every measured argument, no 429/rate-limit signal appears, and `wall_clock_background` p95 dropped from ~34.6s (sequential, prior Family-G smoke) to ~19.3s (parallel) — a ~44% reduction, below the 30s PASS line. The D5 anchor fix is live (the latency report's projection anchor now derives `7` from the measured data, not the stale `6`).

The blemish: under the N=5 back-to-back burst, 4 family runs failed `mcp_validation_failed`. These ran for ~4–8 seconds (a full Anthropic-classification duration) and then failed at the result-validation stage — they are NOT fast request-construction rejects, and they are NOT 429/rate-limit. They clustered at peak cross-argument concurrency (7–8 simultaneous classifications). The canary (single argument, organic-representative load, peak concurrency 2) was 7/7 clean.

---

## Phase 1 — Pre-flight + non-spend gates

**Status:** PASS

`main` at `2394aef`. Post-merge non-spend verification (no Anthropic): `typecheck` clean; `lint --max-warnings 0` clean; targeted Jest (auto-trigger + latency + bounded-concurrency) **8 suites / 206 tests PASS**; Deno regression not applicable (jest-only harness; the runner is pure-TS with zero Deno imports, covered via the test bridge); Supabase deploy check on `2394aef` = success. Merge propagated > 60 min before the smoke (deploy live).

## Phase 2 — Canary (submit-nonblocking gate FIRST)

**Status:** PASS

One synthetic smoke-tagged submission (topic "four-day work week", arg `1faddb4d`). Submit response **3.29s** (fire-and-forget; the background 7-family chain does not block submit — the HALT-5 existential holds live). The argument received **exactly 7 production runs A–G, all `success`**: parent_relation, disagreement_axis, misunderstanding_repair, evidence_source_chain, argument_scheme, critical_question, resolution_progress. H/I/J: zero. No duplicate family runs. **Max observed concurrency = 2** (families start in pairs: 22:16:43.728+43.743 → 47.826+48.051 → 53.574+…). `wall_clock_background` 19.23s vs sum-of-per-family 32.04s — the parallel signature (work that summed to ~32s completed in ~19s wall-clock). Zero 429. Canary clean on all criteria → proceeded to N=5 per operator authorization.

## Phase 3 — N=5 dispatch + family coverage

**Status:** PASS (dispatch); see Phase 5 for run-result blemish

Five total submissions (canary + 4 distinct synthetic topics, no re-submit): four-day work week (`1faddb4d`), open-plan offices (`e4124367`), code review gating (`cbdecc5a`), monorepo vs polyrepo (`7fed2f2a`), on-call rotation length (`8dc8c3f5`). Submit latencies 1.35–3.29s (all nonblocking). **Every argument received exactly 7 production run rows for the 7 A–G families** (no family missing, no H/I/J, no duplicate family run). Overlap reached 2 on every argument (min observed overlap across the 5 = 2; max = 2). Per-argument family-run success: 7/7, 7/7, 6/7, 6/7, 5/7 (the 4 non-success runs are Phase 5).

## Phase 4 — Latency re-measure (D2 binding clock) + D5 anchor

**Status:** PASS

`mcp-latency-report.mjs` (read-only, linked CLI) over the recent-5 (= the 5 smoke args):

| metric | sequential baseline (Family-G smoke) | bounded-parallel (this smoke) |
| --- | --- | --- |
| `wall_clock_background` p50 | 32.892s | **18.698s** |
| `wall_clock_background` p95 (binding) | **34.555s** | **19.328s** |
| min | 32.236s | 18.117s |
| max | — | 19.328s |
| classification | PARTIAL (warning band) | **PASS (< 30s)** |

`classifyLatencyBudget(19.328, submitBlocked=false)` → **PASS**. The ~44% reduction is the overlap dividend (≈2× per-arg concurrency hiding the per-family classification windows under each other).

**D5 anchor fix verified live:** the projection's `anchorFamilyCount` is now `7` (data-derived from `measuredPerFamilyP95.length`), not the stale hardcoded `6`. Projection with parallelism: 7 families → 19.3s; 8 (Family H) → 24.8s (no warn); 9 → 30.3s (warn); 10 → 35.8s (warn). The **45s FAIL line is no longer crossed even at 10 families** — the card bought the latency headroom it was filed for.

## Phase 4b — Overlap diagnostic (make/break)

**Status:** PASS

Max observed concurrency computed from per-family `started_at`/`completed_at` (conservative tie handling: a reported peak of 2 = genuine simultaneity). Every one of the 5 arguments: **max overlap = 2** (bound reached, never exceeded). No argument showed overlap=1 (which would have indicated downstream serialization or a non-propagated deploy). Bounded parallelism is confirmed live and correct.

## Phase 4c — Rate-limit capture

**Status:** PASS

Zero 429/rate-limit signals across all 5 submissions (submit responses all 200) and across all 35 family runs (no `failure_reason` matching rate/429/throttle). The 4 failed runs (Phase 5) are `mcp_validation_failed`, a validation class — explicitly NOT 429. Concurrency limit 2 leaves rate-limit headroom; this pre-justifies that a future bump to 3 would not be rate-limited — but see the follow-up: a bump to 3 is blocked on the validation finding, not on 429.

## Phase 5 — Finding: `mcp_validation_failed` under burst concurrency

**Status:** FINDING (the basis for the PARTIAL verdict)

4 of 35 family runs failed. All four:

| family | argument id | failure_reason | duration | concurrency-at-start | pre-existing? |
| --- | --- | --- | --- | --- | --- |
| evidence_source_chain | `8dc8c3f5` | mcp_validation_failed | 5.809s | 7 | mode pre-existing (2026-05-28) |
| critical_question | `8dc8c3f5` | mcp_validation_failed | 6.070s | 8 | mode pre-existing |
| critical_question | `cbdecc5a` | mcp_validation_failed | 7.740s | 8 | mode pre-existing |
| argument_scheme | `e4124367` | mcp_validation_failed | 4.189s | 8 | mode pre-existing |

Characterization (evidence-based):

- **NOT a 429/rate-limit failure.** No rate/throttle signal anywhere; submit all 200.
- **NOT evidence of dispatcher request corruption.** Each failed run consumed ~4–8s — a full Anthropic-classification duration — before failing. A malformed request from the dispatcher would be rejected at input validation in < 1s. The MCP server accepted each request, performed the classification, and the failure occurred at the result-validation stage. The canary (identical dispatcher code) was 7/7 clean. This is consistent with the design's Q7/Q8 (the dispatcher and request builder are stateless/reentrant; per-family requests are well-formed).
- **Pre-existing failure mode.** Production run history: 154 `success` runs across 31 arguments; `mcp_validation_failed` total = 5 across 4 arguments, **first observed 2026-05-28 10:27** — one occurrence under the OLD sequential code, before this card merged. This card did not introduce the failure class.
- **Concurrency-correlated.** All 4 failures clustered at peak cross-argument concurrency (7–8 simultaneous classifications, in a tight 22:23:03–22:23:10 window). The card's ≈2× per-argument concurrency raised the burst peak (~8 vs ~4 under sequential), elevating the hit-rate of this pre-existing server-side limit.
- **Not organic-representative.** Organic users submit one argument at a time → per-argument peak concurrency = 2 (= the clean canary). 7–8 concurrent classifications is an artifact of the N=5 back-to-back smoke burst. The risk is not "the app breaks" — submit stays nonblocking and a single submission classifies cleanly. The risk is **silent partial classifier coverage under burst load** (an argument ending with 5–6 of 7 machine observations), which under-represents some families in Source 6 / observability and downstream UI.

**Operational consequence:** `mcp_validation_failed` result-validation fragility must be investigated before Family H **production** enablement and before any concurrency-limit increase above 2.

## Phase 6 — Duplicate / dedup check

**Status:** PASS

No duplicate family run rows on any argument (each A–G family appears exactly once per argument; the one-production-run-per-family-per-argument idempotency held under parallel dispatch). The 5 submissions used distinct synthetic topics (no content overlap). The dispatch-level dedup property this card could affect is intact.

## Phase 6b — Doctrine evidence_span inspection (L5; doctrine-risk families)

**Status:** PASS

This smoke exercised four doctrine-risk families in production — evidence_source_chain (D), argument_scheme (E), critical_question (F), resolution_progress (G). To confirm bounded-parallel dispatch did not corrupt doctrine-clean classifier output, the persisted `evidence_span` of every positive doctrine-risk observation across the 5 smoke arguments was read from `argument_machine_observation_results` and scanned for resolution-verdict / ban-list tokens.

**37 positive doctrine-risk `evidence_span` rows scanned** (argument_scheme 12, critical_question 15, evidence_source_chain 10; resolution_progress emitted 0 positives on these synthetic theses — the family ran and succeeded but produced no positive observation, expected for non-convergence topics). **Zero banned verdict tokens** (won / lost / winner / loser / defeated / prevailed / capitulated / beat / proved / invalid / wrong + the shared ban-list). Every span is a descriptive structural observation:

| family | raw_key | confidence | evidence_span (excerpt) |
| --- | --- | --- | --- |
| argument_scheme | causal_reasoning_present | high | "The mechanism is attentional — concentrated focus blocks crowd out low-value meeting overhead…" |
| argument_scheme | classification_reasoning_present | high | "organizations under a few hundred engineers vs. above that scale" |
| argument_scheme | tradeoff_reasoning_present | high | "Above that scale the build-tooling investment required begins to offset the benefit" |
| argument_scheme | consequence_reasoning_present | high | "week-long rotations produce better incident outcomes than day-long rotations" |

The 5-layer descriptive-convergence doctrine defense holds in production under bounded-parallel dispatch — the dispatch-strategy change does not alter classifier output or its doctrine cleanliness. Note (honest): the 4 `mcp_validation_failed` runs (Phase 5) persisted NO results row — a failed run writes no `evidence_span` — so the finding is a *missing* observation, never a doctrine-tainted one.

## Phase 7 — Observability + doctrine

**Status:** PASS

Bounded-parallel dispatch is live for the 7-family (A–G) production auto-trigger. Latency is treated as a system-performance metric only — no gameplay/heat/verdict signal enters dispatch ordering (registry order) or concurrency (fixed safety constant). No verdict/winner-loser language in the dispatcher, runner, or this audit. No service-role usage (submissions via the `.env.bot-tests` anon path; reads via the operator's linked Supabase CLI). No secrets logged.

## Phase 8 — Verdict

**Status:** PARTIAL

---

## Final verdict

**PARTIAL**

- Bounded parallelism is live and effective: overlap=2 on every argument; `wall_clock_background` p95 34.555s → 19.328s (PASS band); submit nonblocking (1.35–3.29s); zero 429; all 7 A–G families dispatched per argument; no missing/duplicate dispatch; D5 anchor fix live (`anchorFamilyCount=7`); Family H now projects 24.8s (45s line uncrossed through 10 families).
- The N=5 burst surfaced a pre-existing MCP result-validation fragility: 4/35 family runs `mcp_validation_failed`, clustered at peak 7–8 cross-argument concurrency, ~4–8s duration (post-classification, not a fast request reject), not 429, not dispatcher request corruption, not organic-representative (the canary at organic per-arg load was clean).
- This is a production-readiness finding, not a regression in the card's dispatch change and not a rollback trigger. The dispatch change shipped and is measured; the validation fragility is handed to a follow-up hardening card.

---

## Authorizations + follow-ups

- `OPS-MCP-AUTO-TRIGGER-PARALLELIZATION-SMOKE: PARTIAL` — latency objective achieved; result-validation fragility found under burst concurrency.
- **Do NOT raise the concurrency limit above 2** until the follow-up card passes.
- **Hold Family H PRODUCTION enablement** until the follow-up card passes or a Gate H explicitly accepts the risk. (Family H admin_validation design/ship may proceed independently — it is not production traffic.)
- **Follow-up card: `OPS-MCP-RESULT-VALIDATION-BURST-HARDENING`** (narrow scope — answer one question: why do some family runs return `mcp_validation_failed` after completing a full Anthropic-classification-duration call, and why does the rate rise under burst concurrency?). Layers: (1) split `mcp_validation_failed` into typed sub-reasons (invalid JSON / schema mismatch / unsupported raw key / missing required key / evidence-span doctrine rejection / output truncation / provider refusal / timeout / response-shape drift) — typed observability before guessing; (2) compare production auto-trigger failures vs hosted MCP direct calls (Edge-side vs model-output/hosted-MCP); (3) reproduce under a controlled burst matrix (1 arg / 2 back-to-back / 5 back-to-back) at concurrency 2 — do NOT test concurrency 3 yet; (4) confirm the cross-family distribution (critical_question / argument_scheme / evidence_source_chain → argues against a single bad family prompt, toward a shared validation/response-shape or provider-load issue). Success target after hardening: a clean N=5 — p95 < 30s, overlap=2, zero 429, **zero `mcp_validation_failed`**, all 35 runs success.

Smoke artifacts (remain in the dev DB as tagged test fixtures, `[ops-parallelization-smoke 2026-05-29]`): 5 args (`1faddb4d`, `e4124367`, `cbdecc5a`, `7fed2f2a`, `8dc8c3f5`) in 5 rooms, each with 7 production family runs (A–G). No secrets logged; no service-role; submissions via the `.env.bot-tests` anon path; reads via the operator's linked Supabase CLI.
