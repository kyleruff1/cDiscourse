# OPS-MCP-RESULT-VALIDATION-BURST-HARDENING — Phase 4 production-path verify (2026-05-29)

Audit-Lint: v1

**Date:** 2026-05-29
**Operator:** Kyler
**Merge:** Phase 3 (FIX) PR #367 squash-merged to `main` at `34c8847` (detect `{isError}` envelope before the validator; type `provider_server_error` on the retryable `api_error` carrier).
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/365 (remains OPEN — PARTIAL).
**Scope:** Gated-SPEND production-path verification of the Phase 3 fix. Canary-first (1 synthetic submit), then a tight 5-arg back-to-back burst (6 total submits), A–G only. Verifies run-completeness, the retry healing the `{isError}` class, latency-with-retry, dispatch correctness, and doctrine cleanliness on the PRODUCTION auto-trigger path. Budget ceiling ~60 family-classification calls (spent ~42).

**Verdict: PARTIAL** — the Phase 3 fix is LIVE and behaving exactly as designed (the burst failures flipped from the opaque, non-retryable `mcp_validation_failed` to the correctly-typed, retryable `mcp_api_error`/`provider_server_error`, and the retry fired), latency stayed under budget (p95 22.44s), and dispatch correctness held (no H/I/J, no duplicate rows, submit nonblocking, no 429). BUT under a SUSTAINED concurrency-10 burst the single retry's 2s backoff re-entered the still-hot server window, so the retry did NOT heal: **2 of 35 (argument, family) cells remained terminal failures** (`retryHeals = 0`). Run-completeness is therefore not achieved. Not a regression and not a fix defect — a characterized retry-timing gap under sustained burst. #365 stays open; follow-up `OPS-MCP-RESULT-VALIDATION-RETRY-TUNING` filed.

---

## Summary

Phase 3 detects the operator-hosted MCP server's `{isError, reason, path, detail}` error envelope before the MCP-021A validator and routes it through the existing retryable `mcp_api_error` carrier (typed `provider_server_error`). Phase 4 verifies this on the production auto-trigger path. The canary (1 arg, low concurrency) was 7/7 clean. The 5-arg burst reached cross-argument concurrency 10 (a valid burst, exceeding the original 7–8 envelope). The fix is confirmed live: **zero `mcp_validation_failed` across the entire burst** — every server-error envelope is now typed `mcp_api_error` and retried. But the burst's two `{isError}` events each failed BOTH attempts (the 2s-backoff retry re-entered the hot window), leaving 2 terminal coverage holes. The improvement over pre-fix (opaque permanent holes at ~10–11%) is real — correct diagnosis always, transient/organic heal — but the sustained-burst coverage hole is not yet closed.

---

## Phase 1 — Pre-flight (non-spend)

**Status:** PASS

`main` at `34c8847`; Phase 3 fix merged; `Supabase Preview` deploy check `completed/success` (merged 7 min before the canary → propagated). Non-spend gates on the merged tree: typecheck clean; lint clean; targeted Jest 5 suites / 127 tests pass; squash-diff boundary clean (only `booleanObservationMcpAdapter.ts` + `booleanObservationFailureSubreason.ts` production edits; dispatcher/core/schema/mirrors/migration/package.json byte-equal). No migration.

## Phase 2 — Canary

**Status:** PASS

One synthetic smoke-tagged submission (`3d02e306`, `[ops-result-validation-p4 2026-05-29]`). Submit response **3.48s** (nonblocking). Production auto-trigger produced **exactly 7 family runs A–G, all `success`**; H/I/J zero; no duplicate family rows; no terminal failed run; intra-arg overlap=2 (+ deploy confirmed live); `wall_clock_background` 18.41s; no 429. Canary clean → proceeded to the burst.

## Phase 3 — Burst (the result)

**Status:** see Phase 5

Five synthetic submissions back-to-back (`e010bb43`, `cdc9b80d`, `743e592a`, `97552904`, `525c857a`); submit responses 1.37–2.38s (all nonblocking; fired over ~10s). **Cross-argument max concurrency = 10** (valid burst — exceeds the original 7–8 envelope; minimum burst validity satisfied). Per-argument:

| argument | distinct families | success families | total rows | wall_clock_bg | note |
| --- | --- | --- | --- | --- | --- |
| 525c857a | 7 (A–G) | 7 | 7 | 19.42s | clean |
| 743e592a | 7 (A–G) | 7 | 7 | 19.16s | clean |
| 97552904 | 7 (A–G) | 7 | 7 | 19.13s | clean |
| cdc9b80d | 7 (A–G) | 6 | 8 | 18.54s | critical_question terminal (2× mcp_api_error) |
| e010bb43 | 7 (A–G) | 6 | 8 | 22.44s | argument_scheme terminal (2× mcp_api_error) |

No H/I/J on any arg. No duplicate (≥2 success) family rows. No 429.

## Phase 4 — Fix-is-live confirmation

**Status:** PASS

The decisive proof the Phase 3 fix is live and correct on the production path: **the entire burst produced ZERO `mcp_validation_failed` rows.** The two terminal-failure families (`cdc9b80d/critical_question`, `e010bb43/argument_scheme`) each carry `failure_reason = mcp_api_error` on BOTH of their two run rows. Pre-fix, an `{isError}` envelope produced a single `mcp_validation_failed` row (non-retryable → permanent, mis-diagnosed as a schema concern). Post-fix it produces `mcp_api_error` rows (correctly typed `provider_server_error` on the RETURN/log; the carrier is retryable) and the dispatcher retried (2 attempts = the 8-row args). The classification flipped from `mcp_validation_failed` → `mcp_api_error` exactly as designed.

## Phase 5 — Run-completeness (the PARTIAL basis)

**Status:** PARTIAL

`runCompleteness.everyExpectedCellHasSuccess = false`. Of 35 expected (argument, family) cells, **33 ended with ≥1 success; 2 are terminal failures**:

| arg | family | run rows | reasons | outcome |
| --- | --- | --- | --- | --- |
| cdc9b80d | critical_question | 2 | mcp_api_error, mcp_api_error | terminal (attempt 1 + retry both `{isError}`) |
| e010bb43 | argument_scheme | 2 | mcp_api_error, mcp_api_error | terminal (attempt 1 + retry both `{isError}`) |

`retryHeals = 0`, `trueDuplicates = 0`. The retry FIRED for both (the 2-row pattern proves the bounded 1-retry executed), but BOTH attempts hit the server-overload `{isError}` because the **2s backoff re-entered the still-hot concurrency-10 burst window**. The retry would heal an isolated/transient `{isError}` (the Phase 3 mechanistic unit test proves recovery when attempt 2 succeeds; organic single-submission load has per-arg peak concurrency 2, where a 2s-later retry hits a quiet server). The residual 2/35 (5.7%) holes are specifically a SUSTAINED-burst phenomenon. This is the documented retry-timing gap, not a fix defect.

## Phase 6 — Latency with retry

**Status:** PASS

`wall_clock_background` over the 5 burst args: p50 19.16s, **p95 22.44s** (min 18.54, max 22.44). The retried arg (`e010bb43`, 22.44s) shows the retry's bounded cost (~+3s vs the clean ~19s) — p95 stayed **under the 30s PASS line even with the retry in place**. Submit response time (1.37–3.48s) is recorded separately from background completion and is unaffected (fire-and-forget). No 429/rate-limit instability.

## Phase 6b — Doctrine evidence_span inspection (L5; doctrine-risk families)

**Status:** PASS

The burst exercised doctrine-risk families (argument_scheme (E), critical_question (F), evidence_source_chain (D), resolution_progress (G)) in production. The persisted `evidence_span` of every positive doctrine-risk observation across the 6 Phase-4 args was scanned for verdict tokens. **62 positive doctrine-risk `evidence_span` rows scanned** (critical_question 30, argument_scheme 16, evidence_source_chain 15, resolution_progress 1). **Zero banned verdict tokens** (won/lost/winner/loser/defeated/prevailed/capitulated/beat/proved/invalid + the shared ban-list). The retry/fix does not alter classifier output or its doctrine cleanliness. (The 2 terminal-failure runs persisted NO results row — a failed run writes no `evidence_span` — so the finding is a missing observation, never a doctrine-tainted one.)

## Phase 7 — Observability + doctrine

**Status:** PASS

The fix ships as designed: `provider_server_error` is a transport/server-side diagnostic (verdict-free, operator-only, never user-facing). Concurrency stayed bounded at 2 per argument (the cross-arg 10 is the multi-submission burst, not a dispatch-limit change). No service-role usage (submissions via the `.env.bot-tests` anon path; reads via the operator's linked Supabase CLI). No secrets logged. No prompt/taxonomy/flag/schema-mirror change.

## Phase 8 — Verdict

**Status:** PARTIAL

---

## Final verdict

**PARTIAL**

- Phase 3 fix LIVE + correct: burst failures flipped `mcp_validation_failed` → `mcp_api_error`/`provider_server_error` (zero `mcp_validation_failed` in the burst); retry fired (2 attempts on each `{isError}` family).
- Dispatch + latency PASS-level: cross-arg burst valid (overlap 10), submit nonblocking, no H/I/J, no duplicate rows, no 429, intra-arg concurrency 2 intact, p95 22.44s (<30s with retry).
- Doctrine clean: 62 doctrine-risk `evidence_span`, 0 verdict tokens.
- **NOT PASS:** run-completeness not achieved — 2/35 (5.7%) terminal coverage holes (`cdc9b80d/critical_question`, `e010bb43/argument_scheme`), `retryHeals = 0`. Under the sustained concurrency-10 burst the 2s-backoff retry re-entered the hot window and re-failed.
- **NOT FAIL:** no FAIL condition met (correctly typed not generic; narrow retry; no secrets; concurrency 2 intact; submit nonblocking; no H/I/J; no dup; p95 22.44s « 45s; no 429 instability).

Per the operator's Phase 4 verdict rules, this is PARTIAL: "retry behavior typed and characterized but terminal failed family runs remain."

---

## Authorizations + follow-ups

- `OPS-MCP-RESULT-VALIDATION-BURST-HARDENING Phase 4: PARTIAL`. **#365 remains OPEN** (verdict + evidence do not support closure).
- **Follow-up filed: `OPS-MCP-RESULT-VALIDATION-RETRY-TUNING`** — narrow retry-timing tune for `provider_server_error` ONLY: lengthen the single retry's backoff to ~7–10s with bounded jitter so it waits out the hot burst window (prefer tuning the existing single retry before adding a 2nd attempt; concurrency stays 2). This closes the residual sustained-burst holes. After that card PASSes (clean production burst, run-completeness, p95<30s), #365 closes and Family H planning may resume.
- **Family H remains FROZEN** (admin design included) until #365 reaches PASS or a separate Gate H explicitly accepts the residual risk.

Smoke artifacts (remain in the dev DB as tagged test fixtures, `[ops-result-validation-p4 2026-05-29]`): 6 args (canary `3d02e306` + burst `e010bb43`, `cdc9b80d`, `743e592a`, `97552904`, `525c857a`); ~42 production family-classification calls (under the ~60 ceiling); 2 terminal `mcp_api_error` rows retained as the characterizing evidence. No secrets logged; no service-role; anon submit path + linked-CLI reads.
