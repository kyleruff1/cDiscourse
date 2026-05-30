# OPS-MCP-SERVER-CAPACITY-INVESTIGATION — cap=2 env re-smoke production verify (2026-05-30)

Audit-Lint: v1

**Date:** 2026-05-30
**Operator:** Kyler
**Merge:** PR #372 squash-merged to `main` at `12eab05` (per-isolate provider-concurrency cap in `mcp-server/`). No code change for this re-smoke — only the runtime env `MCP_SERVER_MAX_PROVIDER_CONCURRENCY=2` (override of the default 5). Operator set the env in Deno Deploy and manually redeployed the hosted MCP server (build `s28hxr47jgxy`, URL `https://cdiscourse-mcp-server.civildiscourse.deno.net`, on commit `191b240` — the cap=5 PARTIAL audit doc commit, which is doc-only on top of `12eab05`, so the deployed CODE is byte-identical to the cap commit; only the env value differs).
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/371 (remains OPEN); blocks #365 + #368.
**Scope:** Lower-bound env re-smoke (cap=2) of the per-isolate provider-concurrency cap, anchored to the **deployed** hosted MCP server. Goal: discriminate the two PARTIAL hypotheses from the cap=5 smoke — (a) single-isolate, cap merely too high (→ a lower cap would PASS) vs (b) multi-isolate fan-in, per-isolate cap structurally insufficient (→ no cap value passes). Canary-first + a tight 5-arg back-to-back A–G burst (6 total submits). No cap=5 re-proof (the cap=5 evidence already exists).

**Verdict: FAIL** — cap=2 did not improve on cap=5; it **collapsed the burst in the opposite direction**. The canary (single arg, 2 concurrent slots) was 7/7 clean, but the 5-arg burst produced only **8 / 35** successful (argument, family) cells with **27 terminal holes**, and the failure mode flipped from cap=5's server-side `{isError}` (`mcp_api_error`) to **`mcp_network_error` clustered tightly at 15.08–15.46s** — a fixed ~15s Edge→MCP request timeout firing on families that never acquired a cap=2 semaphore slot. The per-isolate queue starved requests *inside the request lifecycle*, and that lifecycle has a hard external ~15s deadline too short to host a deep queue. Combined with the cap=5 PARTIAL, this is a definitive topology diagnosis: **the per-isolate semaphore is the wrong control point — no cap value satisfies both run-completeness and latency.**

---

## Summary

cap=5 and cap=2 fail in **opposite** ways. At cap=5 the per-isolate queue did not meaningfully reduce `{isError}` events (the global Anthropic concurrency across isolates is unbounded by a per-isolate cap) and added latency (p95 37.61s). At cap=2 the per-isolate queue prevented some immediate server overload but starved requests long enough that the Edge→MCP request hit its ~15s timeout before a provider slot opened — 53 `mcp_network_error` rows clustered at ~15.1s, 27 terminal holes, 0 retry-heals (the 2s retry re-entered the same saturated queue). The cap is inside the request lifecycle; the request lifecycle is too short to host a deep queue, and the cap only bounds *per isolate*, not globally across the Deno Deploy runtime. The durable fix is not "make the in-request queue better" — it is to move provider-work admission control to a shared/global layer and make overload explicit, typed, and retryable without blocking the user submit.

---

## Phase 1 — Pre-flight (non-spend)

**Status:** PASS

`main` HEAD = `191b240` (cap=5 PARTIAL audit doc; the cap CODE is `12eab05`, byte-identical in the deployed build). `mcp-server/lib/providerConcurrency.ts` present; `callAnthropic` gate wired. Clean tree (only untracked workspace strays; no tracked changes). Deno baseline 1041/0. Operator confirmed env `MCP_SERVER_MAX_PROVIDER_CONCURRENCY=2` saved in Deno Deploy and the server redeployed (build `s28hxr47jgxy`, Serving). Liveness confirmed end-to-end by the canary.

## Phase 2 — Canary

**Status:** PASS (clean)

One synthetic submission (`f6a94fa8`, `[ops-server-cap2-p4 2026-05-30]`). Submit 3.30s (nonblocking). 7 family runs A–G all `success`; H/I/J zero; no duplicate; no terminal hole; cross-arg overlap = 2; `wall_clock_background` 19.46s; no 429. A single argument needs only 2 concurrent provider slots, which fits exactly within cap=2 → no queueing. Clean → proceed to burst.

## Phase 3 — Burst (valid; overlap 10)

**Status:** see Phase 4/5

Five synthetic submissions back-to-back; submit 1.30–2.37s (nonblocking). **Cross-argument max concurrency = 10** (valid burst). Per-argument (settle confirmed: **0 in-flight**):

| argument | success / 7 | totalRows | wall (success-derived) | note |
| --- | --- | --- | --- | --- |
| 1bc2cc02 | **0** | 14 | — (no success) | all 7 families terminal (mcp_network_error ×2 each) |
| 2139bfdb | 3 | 11 | 11.88s | 4 families terminal |
| 7d97c52f | 2 | 12 | 5.65s | 5 families terminal |
| b9c30894 | 2 | 12 | 11.29s | 5 families terminal |
| b2dd6455 | 1 | 13 | 12.90s | 6 families terminal |

No H/I/J; no duplicate (≥2 success) rows; no 429. **Total: 8 / 35 (argument, family) cells succeeded; 27 terminal holes.**

## Phase 4 — Failure-mode flip (the core finding)

**Status:** the smoking gun

Failure-timing breakdown across all 62 burst run rows (started→completed duration):

| status | failure_reason | n | avg dur | min | max |
| --- | --- | --- | --- | --- | --- |
| failed | **mcp_network_error** | **53** | **15.11s** | **15.08s** | **15.46s** |
| success | (null) | 8 | 7.56s | 3.61s | 12.90s |
| failed | mcp_api_error | 1 | 13.95s | 13.95s | 13.95s |

The 53 `mcp_network_error` rows are clustered in a 15.08–15.46s band — far too tight for random transport loss. This is a **fixed ~15s Edge→MCP request timeout** firing on every family whose request sat in the cap=2 per-isolate queue without acquiring a provider slot. The 8 successes are all first-wave (3.6–12.9s, slots acquired immediately). The server-side `{isError}` (`mcp_api_error`) that dominated cap=5 is now essentially gone (n=1) — because at cap=2 most requests never reach Anthropic; they die at the Edge deadline first. **The MCP server cap sits inside the request lifecycle, and the request lifecycle is too short to host a deep queue.**

## Phase 5 — Run-completeness (FAIL basis)

**Status:** FAIL

`everyExpectedCellHasSuccess = false`. **8/35 cells succeeded; 27 terminal failures** (each exhausted MAX_ATTEMPTS=2). The 2s retry (the production Phase-3 backoff) re-entered the *same saturated queue* and timed out again at ~15s → `retryHeals = 0`. `trueDuplicates = 0` (the success-only idempotency guard held even under the failure storm). This is a far worse coverage outcome than cap=5 (33/35, 2 holes).

## Phase 6 — Latency / failure character (FAIL basis)

**Status:** FAIL (mass timeout)

Unlike cap=5 (all 5 args slow-completed at 33–37.6s), the cap=2 failures **fast-failed at the ~15s Edge deadline**. The p95 of the *success-derived* walls is 12.90s (4 samples; arg `1bc2cc02` excluded — 0 successes, no wall). **That number is NOT a latency pass and must not be read as "p95 < 30s ⇒ PASS"** — it reflects only the 8 cells that succeeded; the dominant outcome (27/35) is termination at the 15s timeout. Run-completeness fails outright, which is dispositive regardless of the success-wall p95.

## Phase 6b — Doctrine evidence_span (not the gating factor; named for completeness)

**Status:** N/A to the verdict; doctrine risk unchanged

The persisted `evidence_span` column of `argument_machine_observation_results` was not re-scanned this run: only 8 cells produced output, and the deployed change is the runtime env value only — a pure concurrency-admission control that never touches classifier prompts, taxonomy, or output. Doctrine cleanliness is therefore unchanged from the cap=5 smoke, which scanned 66 positive doctrine-risk `evidence_span` rows (critical_question, argument_scheme, evidence_source_chain, resolution_progress) and found **zero banned verdict tokens** on byte-identical classifier code. The cap value cannot alter `evidence_span` content. Doctrine risk is not the gating factor here; run-completeness is.

## Phase 7 — Diagnosis: per-isolate cap is the wrong control point

**Status:** the topology conclusion

The two post-deploy smokes bracket the concurrency-control tradeoff curve:

| cap | mechanism | failure | success | latency | verdict |
| --- | --- | --- | --- | --- | --- |
| uncapped (#368) | global Anthropic overload | `mcp_api_error` `{isError}` ~4 | 33/35 | p95 ~38s | (baseline) |
| **5** | per-isolate queue; global still overloads | `mcp_api_error` ~5 | 33/35 | **p95 37.61s** | **PARTIAL** |
| **2** | per-isolate queue starves vs ~15s Edge timeout | **`mcp_network_error` 53 @ ~15.1s** | **8/35** | mass timeout | **FAIL** |

There is **no per-isolate value that satisfies both** run-completeness and latency: a high cap leaves global Anthropic concurrency unbounded across isolates → `{isError}` overload; a low cap starves the per-isolate queue against the fixed ~15s Edge deadline → transport-timeout mass incompleteness. The knob controls *per-isolate* concurrency in an *in-memory* semaphore, while the failure is driven by *global* concurrency across an unknown isolate count **and** a fixed external request deadline. This confirms hypothesis (b): multi-isolate fan-in / lifecycle-bound queue — the per-isolate semaphore is structurally insufficient as the final fix.

## Phase 8 — Safety + observability (held even in failure)

**Status:** PASS

No H/I/J family triggered (only A–G requested/run). **No duplicate success rows** (idempotency guard held under the failure storm). No 429. Submit nonblocking (1.30–3.30s) — the user-facing path is unaffected; the FAIL is confined to background auto-trigger run-completeness. Edge auto-trigger overlap bounded at 2 per argument (cross-arg 10 is the burst). No service-role; no secrets / raw provider / model / prompt / auth in logs or output. No prompt / taxonomy / family-key / schema-mirror / Source 6 / production-flag / package.json change (the deployed delta is the env value only; code byte-equal to `12eab05`).

## Final verdict

**FAIL**

- **27/35 terminal holes** — run-completeness collapsed (cap=5 was 33/35).
- Failure mode flipped server-overload `{isError}` (`mcp_api_error`) → transport-timeout `mcp_network_error`, **clustered tightly at ~15.1s** = the fixed Edge→MCP request deadline firing on a starved cap=2 queue.
- `retryHeals = 0` — the 2s retry re-entered the same saturated queue.
- Confirms the per-isolate cap is the **wrong control point**; combined with cap=5 PARTIAL, **no cap value satisfies both run-completeness and latency**.
- Clean elsewhere: canary clean; burst valid (overlap 10); no H/I/J; no duplicate rows; submit nonblocking; no 429; safety/observability intact.

This is a **definitive FAIL treated as a topology diagnosis, not another per-isolate tuning opportunity.**

---

## Operator decision + follow-ups

- **Restore production away from cap=2 immediately** (operator runtime action): set `MCP_SERVER_MAX_PROVIDER_CONCURRENCY` back to 5 (or remove the env var → default 5) and redeploy the hosted MCP server. cap=2 is worse than cap=5 and must not remain live. **No cap=5 re-proof smoke** — the cap=5 evidence already exists.
- **Preserve the useful work from this chain:** bounded Edge auto-trigger parallelism (limit 2), typed `{isError}` provider/server-error detection + classification (#365 Phase 3, `mcp_api_error` carrier with `provider_server_error` sub-reason), and safe diagnostics. **Abandon** per-isolate cap tuning and Edge static-backoff retry-tuning — both strategies are now exhausted (Edge backoff: #365 Phase 4 / #368 Phase 4; per-isolate cap: cap=5 PARTIAL / cap=2 FAIL).
- **`OPS-MCP-SERVER-CAPACITY-INVESTIGATION` (#371) remains OPEN** — not closed, not PASS. **#365 + #368 remain OPEN, blocked by #371.** **Family H FROZEN** (until #371's successor passes or a Gate H explicitly accepts risk). `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES` stays 2.
- **Next card (operator-directed): `OPS-MCP-GLOBAL-PROVIDER-CAPACITY-CONTROL`** — design and implement topology-aware provider capacity control, because per-isolate in-memory caps are insufficient under Deno Deploy multi-isolate fan-in. Likely durable design: a shared **global** provider-call limiter across isolates (shared store — Deno KV or equivalent), a **short** max-wait for a provider slot (no unbounded in-request queue), a typed server-capacity envelope (`reason: capacity_exhausted`-class enum + bounded `retryAfterMs`, no raw prompt/body/payload/secrets/auth) when no slot is available quickly, and the Edge honoring `retryAfterMs` inside `waitUntil` without blocking submit. **Retry-after is NOT a standalone first move** — the cap=2 test proved the issue is not retry timing; retry-after belongs inside the broader global-capacity card.

Smoke artifacts (dev DB, `[ops-server-cap2-p4 2026-05-30]`): 6 args (canary `f6a94fa8` + burst `1bc2cc02`, `2139bfdb`, `7d97c52f`, `b9c30894`, `b2dd6455`); ~62 production family-classification run rows; 8 success + 53 `mcp_network_error` + 1 `mcp_api_error` retained as the characterizing evidence. No secrets logged; no service-role; anon submit path + linked-CLI reads.
