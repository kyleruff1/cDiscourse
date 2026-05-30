# OPS-MCP-RESULT-VALIDATION-RETRY-TUNING — Phase 4 production-path verify (2026-05-30)

Audit-Lint: v1

**Date:** 2026-05-30
**Operator:** Kyler
**Merge:** PR #369 squash-merged to `main` at `d24988e` (provider_server_error-specific longer jittered retry backoff ~7–10s).
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/368 (remains OPEN); blocks #365 (remains OPEN).
**Scope:** Gated-SPEND production-path re-verification of the #368 retry-tuning. Canary-first (1 synthetic submit), then a tight 5-arg back-to-back burst (6 total submits), A–G only. Tests whether lengthening the `provider_server_error` retry backoff to ~7–10s closes the sustained-burst coverage holes the #365 Phase 4 found, without breaching the latency budget. Budget ceiling ~60 family-classification calls (spent ~50).

**Verdict: FAIL** — `wall_clock_background` p95 reached **49.46s** (above the 45s FAIL threshold) and **2 of 35 (argument, family) cells remained terminal coverage holes**. The longer retry DID heal some isolated `{isError}` failures (heal rate improved 0/2 → 2/4), but it did NOT close run-completeness under burst, AND when multiple `{isError}` families clustered on one argument the stacked long retries created a latency failure. The residual is now clearly **server-side** (hosted-MCP overload behavior), not an Edge retry-timing problem. The #368 retry-tuning is not product-safe enough to keep → revert; the Phase 3 typing fix is valid and stays.

---

## Summary

#365 Phase 3 correctly types the hosted MCP `{isError, reason, path, detail}` overload envelope as `provider_server_error` (on the retryable `mcp_api_error` carrier); #365 Phase 4 found the shared 2s backoff re-entered the hot burst window (0/2 heal). #368 lengthened the `provider_server_error` retry to ~7–10s jittered to wait out the burst. This Phase 4 re-verify: the canary was 7/7 clean; the 5-arg burst reached cross-arg concurrency 10 (valid). The longer backoff healed 2 of 4 `{isError}` events (failed-then-success) — real improvement. BUT one argument (`62244faa`) hit a 3-`{isError}` cluster: 1 healed, 2 stayed terminal even at 7–10s, and the stacked long retries pushed that argument's wall_clock to 49.46s (> 45s). Run-completeness failed (2 terminal holes) and the latency budget failed (p95 49.46s). The Edge retry has reached its useful limit.

---

## Phase 1 — Pre-flight (non-spend)

**Status:** PASS

`main` at `d24988e`; #368 merged; `Supabase Preview` deploy `completed/success` (merged 31 min before the canary → propagated). Non-spend gates: typecheck clean; lint clean; targeted Jest 6 suites / 145 tests pass; squash-diff boundary clean (only `providerServerErrorBackoff.ts` + the `autoTriggerDispatcher.ts` backoff conditional; `RETRY_BACKOFF_MS`/`MAX_ATTEMPTS`/concurrency/adapter/schema/mirrors byte-equal). No migration.

## Phase 2 — Canary

**Status:** PASS

One synthetic submission (`bedf94c7`, `[ops-retry-tuning-p4 2026-05-30]`). Submit response 3.32s (nonblocking). 7 family runs A–G, all `success`; H/I/J zero; no duplicate rows; no terminal failure; overlap=2; `wall_clock_background` 18.98s; no 429. Canary clean → burst.

## Phase 3 — Burst (valid; overlap 10)

**Status:** see Phase 5

Five synthetic submissions back-to-back; submit responses 1.37–2.30s (nonblocking). **Cross-argument max concurrency = 10** (valid burst). Per-argument:

| argument | success / 7 | total rows | wall_clock_bg | note |
| --- | --- | --- | --- | --- |
| 0e79c9aa | 7 | 7 | 18.19s | clean |
| 93b94cb5 | 7 | 7 | 19.58s | clean |
| 0c01a8f2 | 7 | 7 | 20.15s | clean |
| dbd46139 | 7 | 8 | 30.37s | critical_question `{isError}` → retry HEALED (complete) |
| 62244faa | 5 | 10 | **49.46s** | 3 `{isError}`: critical_question HEALED; evidence_source_chain + argument_scheme terminal |

No H/I/J; no duplicate (≥2 success) rows; no 429.

## Phase 4 — Retry-heal evidence (the improvement)

**Status:** PASS (the tuning DID heal some cases)

`retryHeals = 2` (failed-then-success — the longer backoff waited out the blip):

| arg | family | failed attempts | outcome |
| --- | --- | --- | --- |
| dbd46139 | critical_question | 1 (mcp_api_error) | recovered to success → argument complete |
| 62244faa | critical_question | 1 (mcp_api_error) | recovered to success |

Heal rate improved from 0/2 (#365 Phase 4 at 2s) to **2/4** at 7–10s. The fix works for isolated `{isError}`.

## Phase 5 — Run-completeness (FAIL basis #1)

**Status:** FAIL

`runCompleteness.everyExpectedCellHasSuccess = false`. 33/35 cells succeeded; **2 terminal failures**, BOTH on the clustered argument `62244faa`:

| arg | family | run rows | reasons | outcome |
| --- | --- | --- | --- | --- |
| 62244faa | evidence_source_chain | 2 | mcp_api_error, mcp_api_error | terminal (both attempts `{isError}`) |
| 62244faa | argument_scheme | 2 | mcp_api_error, mcp_api_error | terminal (both attempts `{isError}`) |

`trueDuplicates = 0`. `62244faa` hit a deep overload pocket where even the 7–10s backoff's second attempt re-hit `{isError}`. A longer Edge backoff cannot guarantee completeness against a sustained server overload.

## Phase 6 — Latency (FAIL basis #2)

**Status:** FAIL

`wall_clock_background` over the 5 burst args: p50 20.15s, **p95 49.46s** (min 18.19, max 49.46). The p95 is `62244faa`: with 3 `{isError}` families each retrying on the ~7–10s backoff, the long retries stacked (serialized under the concurrency-2 dispatch) and pushed that argument's background wall_clock to **49.46s, above the 45s FAIL line**. (The single-`{isError}` heal `dbd46139` landed at 30.37s — already in the 30–45s warning band.) Submit response time (1.37–3.32s) is separate and unaffected (fire-and-forget). No 429.

This is the trade-off the tuning exposed: the longer backoff buys isolated-case heal but its cost scales with the number of `{isError}` families on an argument, breaching the latency budget under clustering.

## Phase 6b — Doctrine evidence_span inspection (L5)

**Status:** PASS

64 positive doctrine-risk `evidence_span` rows across the 6 args (critical_question 36, argument_scheme 16, evidence_source_chain 12) scanned for verdict tokens. **Zero banned tokens.** The retry-tuning does not alter classifier output or its doctrine cleanliness. (Terminal-failure runs persist no results row — a missing observation, never a doctrine-tainted one.)

## Phase 7 — Observability + doctrine

**Status:** PASS

Concurrency stayed bounded at 2 per argument (cross-arg 10 is the multi-submission burst, not a limit change). No service-role; no secrets/raw provider/model/prompt/auth data in logs or output. No prompt/taxonomy/flag/schema-mirror change.

## Phase 8 — Verdict

**Status:** FAIL

---

## Final verdict

**FAIL**

- `wall_clock_background` p95 = 49.46s (> 45s FAIL threshold) — the longer retry stacks under clustered `{isError}` and breaches the latency budget.
- Run-completeness not achieved: 2/35 terminal holes (`62244faa/evidence_source_chain`, `62244faa/argument_scheme`), both `mcp_api_error` ×2 (deep overload pocket; the 7–10s backoff's second attempt also re-failed).
- The tuning DID improve heal rate (0/2 → 2/4) — the Phase 3 typing + the longer backoff heal isolated `{isError}`. But it does not reliably close coverage and it can push latency over the FAIL line.
- Clean dimensions: canary clean; burst valid (overlap 10); no H/I/J; no duplicate success rows; submit nonblocking; concurrency bounded 2; no 429; doctrine `evidence_span` clean (64 spans, 0 tokens); no secrets.

Per the operator's verdict rules, p95 > 45s is FAIL. #368 and #365 do NOT close.

---

## Authorizations + follow-ups

- `OPS-MCP-RESULT-VALIDATION-RETRY-TUNING Phase 4: FAIL`. **#368 and #365 remain OPEN.**
- **Revert filed: `OPS-MCP-RESULT-VALIDATION-RETRY-TUNING-REVERT`** — surgically revert the #368 long `provider_server_error` backoff (`d24988e`), returning production to the Phase 3 state (provider/server errors typed correctly + the existing 2s retry; no long delay). PRESERVE Phase 1 (typed sub-reason) + Phase 3 (`{isError}` detection + `provider_server_error` classification + sanitized detail + the retryable carrier). Do NOT touch bounded-parallel, concurrency, prompts, taxonomy, family keys, schema mirror, Source 6, flags, audit-lint, package.json; no migration/column.
- **Root-cause card to file: `OPS-MCP-SERVER-CAPACITY-INVESTIGATION`** — investigate/fix the hosted MCP server emitting `{isError}` under burst load (provider concurrency / rate limit / internal timeout / queue exhaustion / fanout limit / resource pressure); options: server-side bounded queue / concurrency cap / provider backpressure / request shedding with a typed retry-after; eventually Edge could honor a server `retry-after` instead of a static backoff. The Edge retry path has reached its useful limit; this is the root-cause path.
- **Family H remains FROZEN** (admin design included) until the server-side investigation lands a PASS-level fix with production-path A–G completeness under burst, OR a Gate H explicitly accepts the residual risk. Do NOT add another Edge retry-tuning pass before the server-side investigation.

Smoke artifacts (dev DB, `[ops-retry-tuning-p4 2026-05-30]`): 6 args (canary `bedf94c7` + burst `62244faa`, `dbd46139`, `0c01a8f2`, `0e79c9aa`, `93b94cb5`); ~50 production family-classification calls (under the ~60 ceiling); 2 retry-heal pairs + 2 terminal `mcp_api_error` rows retained as the characterizing evidence. No secrets logged; no service-role; anon submit path + linked-CLI reads.
