# OPS-MCP-SERVER-CAPACITY-INVESTIGATION — Phase 4 post-deploy production verify (2026-05-30)

Audit-Lint: v1

**Date:** 2026-05-30
**Operator:** Kyler
**Merge:** PR #372 squash-merged to `main` at `12eab05` (per-isolate provider-concurrency cap in `mcp-server/`). Operator manually redeployed the hosted MCP server to Deno Deploy before this smoke.
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/371 (remains OPEN); blocks #365 + #368.
**Scope:** Post-deploy production-path verification of the per-isolate provider-concurrency cap (default 5), anchored to the **deployed** hosted MCP server (not local Deno tests). Canary-first + a tight 5-arg back-to-back A–G burst (6 total submits). Tests whether the cap prevents the `{isError}` under burst → restores A–G run-completeness with p95<30s.

**Verdict: PARTIAL** — the deployed cap did NOT prevent the `{isError}` envelope (5 events across the burst, ~the same rate as the uncapped #368 burst) AND it **added latency** (all 5 burst args 33.1–37.6s; **p95 37.61s**, in the 30–45s warning band — vs the canary's 18.79s). 2 of 35 (argument, family) cells remained terminal holes; the reverted 2s retry healed 3 of the 5 `{isError}`. The per-isolate cap is **only partially effective** — almost certainly defeated by multi-isolate fan-in: ~10 concurrent Edge→MCP requests spread across Deno Deploy isolates, so each isolate's cap=5 queues *within* the isolate (the latency) without bounding *global* Anthropic concurrency (the `{isError}` cause). Not a PASS (holes + p95 not <30s); not a FAIL (p95<45s, no H/I/J, no dup, nonblocking, no 429, no shape change).

---

## Summary

The canary (1 arg, low concurrency) was 7/7 clean at 18.79s. The 5-arg burst reached cross-arg concurrency 10 (valid). With the cap live, each arg produced exactly **1 `{isError}` family** (totalRows=8 = 7 families + 1 retry per arg) — 3 healed at the 2s retry, 2 stayed terminal. The total `{isError}` rate (~5/35) did not improve over the uncapped #368 burst (~4/35); the cap reshaped the distribution (1/arg, spread out, vs #368's cluster) by serializing the load, but did not reduce the generation, because the per-isolate cap does not bound global Anthropic concurrency under multi-isolate fan-in. Meanwhile the per-isolate queue serialized each arg's families into waves, pushing every burst arg into the 30–45s warning band.

---

## Phase 1 — Pre-flight (non-spend)

**Status:** PASS

`main` HEAD = `12eab05` (the cap commit); `mcp-server/lib/providerConcurrency.ts` present; `callAnthropic` gate wired (acquire count 1); clean tree (no local changes). Deno baseline 1041/0. Operator confirmed the capped build deployed to Deno Deploy. (Liveness confirmed end-to-end by the canary; the hosted server's URL/token are operator secrets not held locally.)

## Phase 2 — Canary

**Status:** PASS

One synthetic submission (`6cd1c33b`, `[ops-server-cap-p4 2026-05-30]`). Submit 3.25s (nonblocking). 7 family runs A–G all `success`; H/I/J zero; no dup; no terminal hole; overlap=2; `wall_clock_background` 18.79s; no 429. Clean → burst.

## Phase 3 — Burst (valid; overlap 10)

**Status:** see Phase 5/6

Five synthetic submissions back-to-back; submit 1.45–2.17s (nonblocking). **Cross-argument max concurrency = 10** (valid burst). Per-arg (each totalRows=8 = 7 families + 1 retry):

| argument | success / 7 | wall_clock_bg | note |
| --- | --- | --- | --- |
| 74169ab1 | 6 | 33.11s | argument_scheme terminal (2× mcp_api_error @2s) |
| cb4540aa | 6 | 34.21s | evidence_source_chain terminal (2× mcp_api_error @2s) |
| f604a39a | 7 | 35.85s | evidence_source_chain retry-heal (2s) |
| 134cf62c | 7 | 37.54s | critical_question retry-heal (2s) |
| fec00046 | 7 | 37.61s | critical_question retry-heal (2s) |

No H/I/J; no duplicate (≥2 success) rows; no 429. **Settle confirmed: 40 rows, 0 in-flight.**

## Phase 4 — Did the cap prevent the `{isError}`?

**Status:** NO (the core finding)

5 `{isError}` events across the burst (1 per arg), `failure_reason = mcp_api_error` (the typed provider/server-error class from #365 Phase 3). The uncapped #368 burst had ~4. **The per-isolate cap=5 did not reduce the `{isError}` generation rate.** Diagnosis: the burst's ~10 concurrent Edge→MCP requests are load-balanced across multiple Deno Deploy isolates; each isolate independently admits up to 5 → global concurrent Anthropic calls stay ~10 (unbounded by a per-isolate semaphore). The cap queued *within* each isolate (serializing that isolate's share → latency) but could not bound the *global* load that drives Anthropic's 429/timeout. This is the "topology limits make the per-isolate cap only partially effective" PARTIAL condition, now evidenced.

## Phase 5 — Run-completeness (PARTIAL basis #1)

**Status:** PARTIAL

`everyExpectedCellHasSuccess = false`. 33/35 cells succeeded; **2 terminal failures** (both exhausted MAX_ATTEMPTS=2 at the 2s retry):

| arg | family | rows | reasons | attempt-1 | retry (2s) |
| --- | --- | --- | --- | --- | --- |
| 74169ab1 | argument_scheme | 2 | mcp_api_error, mcp_api_error | 17:34:19→26.9 | 17:34:29→37.9 (failed) |
| cb4540aa | evidence_source_chain | 2 | mcp_api_error, mcp_api_error | 17:34:18→28.7 | 17:34:30→41.4 (failed) |

`retryHeals = 3` (134cf62c/cq, f604a39a/esc, fec00046/cq — attempt-2 success at ~2s backoff). `trueDuplicates = 0`. The 2s retry (reverted from #368's 7–10s) re-entered the still-hot window for the 2 terminal families.

## Phase 6 — Latency (PARTIAL basis #2)

**Status:** PARTIAL

`wall_clock_background` over the 5 burst args: p50 35.85s, **p95 37.61s** (min 33.11, max 37.61) — **all 5 args in the 30–45s warning band**, vs the canary's 18.79s. The per-isolate queue serialized each arg's 7 families into waves (cap=5), and the queued families' delayed completion (plus the 2s retries) pushed every arg to ~33–37.6s. The cap traded ~15–18s of added latency for no reduction in `{isError}`. Submit nonblocking (1.45–3.25s); no 429.

## Phase 6b — Doctrine evidence_span (clean)

**Status:** PASS

66 positive doctrine-risk `evidence_span` rows across the 6 args (critical_question 36, argument_scheme 17, evidence_source_chain 12, resolution_progress 1) scanned for verdict tokens. **Zero banned tokens.** The cap does not alter classifier output or its doctrine cleanliness.

## Phase 7 — Observability + doctrine

**Status:** PASS

Edge overlap bounded at 2 per argument (cross-arg 10 is the burst). No service-role; no secrets/raw provider/model/prompt/auth in logs or output. No prompt/taxonomy/flag/schema-mirror change (the deployed change is the server cap only).

## Phase 8 — Verdict

**Status:** PARTIAL

---

## Final verdict

**PARTIAL**

- The cap **did not prevent** the `{isError}` (5 events, ~the uncapped rate) — the per-isolate semaphore does not bound global Anthropic concurrency under multi-isolate fan-in.
- The cap **added latency**: p95 37.61s (30–45s warning band), all 5 burst args 33–37.6s, vs 18.79s canary.
- Run-completeness not achieved: 2/35 terminal holes (both exhausted the 2s retry).
- Clean: canary clean; burst valid (overlap 10); no H/I/J; no duplicate success rows; submit nonblocking; no 429; doctrine evidence_span clean (66 spans).
- NOT FAIL (p95 37.61s < 45s; no FAIL condition met).

Per the operator's rules, terminal holes + p95 in the 30–45s warning band + per-isolate cap only partially effective ⇒ PARTIAL.

---

## Authorizations + follow-ups

- `OPS-MCP-SERVER-CAPACITY-INVESTIGATION Phase 4: PARTIAL`. **#371 + #365 + #368 remain OPEN** (not resolved). **Family H FROZEN.**
- **Operator's prescribed PARTIAL follow-up: file `OPS-MCP-SERVER-RETRY-AFTER-PROTOCOL`.** Surfaced to the operator alongside this audit, because the diagnosis materially informs the next fix: the per-isolate cap added latency WITHOUT reducing `{isError}` (multi-isolate fan-in). So the next fix likely needs more than retry-after timing — candidates to weigh: (a) honor Anthropic's `Retry-After` so the retry waits out the overload (closes holes, but adds latency — same tradeoff class as #368's static long backoff); (b) a **lower** per-isolate cap (env `MCP_SERVER_MAX_PROVIDER_CONCURRENCY=3`, single-isolate test) — but only helps if single-isolate; (c) a **global** concurrency bound (distributed limiter) if the deployment is genuinely multi-isolate — the per-isolate semaphore is the wrong shape for that topology; (d) reconsider whether the per-isolate cap should be reverted (it added latency without benefit under multi-isolate). The cap's env knob (`MCP_SERVER_MAX_PROVIDER_CONCURRENCY`) allows retuning without a code change.

Smoke artifacts (dev DB, `[ops-server-cap-p4 2026-05-30]`): 6 args (canary `6cd1c33b` + burst `74169ab1`, `cb4540aa`, `f604a39a`, `134cf62c`, `fec00046`); ~47 production family-classification calls; 3 retry-heals + 2 terminal `mcp_api_error` rows retained as the characterizing evidence. No secrets logged; no service-role; anon submit path + linked-CLI reads.
