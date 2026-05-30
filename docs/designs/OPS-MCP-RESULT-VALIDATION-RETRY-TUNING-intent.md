# OPS-MCP-RESULT-VALIDATION-RETRY-TUNING — Intent brief

**Operator:** Kyler · **Date:** 2026-05-29 · **Issue:** #368
**Card type:** narrow retry-timing tune (one code cycle). Closes the residual sustained-burst coverage holes from `OPS-MCP-RESULT-VALIDATION-BURST-HARDENING` (#365, PARTIAL). **Stage 2B APPROVED** (the retry-timing change is the operator's explicit approval). NO migration, NO column, NO schema-mirror/prompt/taxonomy/family-key/Source-6/flag/audit-lint/package.json/.gitignore change. Concurrency stays 2. Family H frozen until #365 PASS or Gate H.

## Phase 4 finding (what this closes)
The #365 Phase 3 fix correctly types the MCP `{isError}` server-overload envelope as `provider_server_error` and routes it through the retryable `mcp_api_error` carrier; the existing 1-retry/2s-backoff fired. Phase 4 production verify (PARTIAL): under a sustained concurrency-10 burst the **2s backoff re-entered the still-hot server window → both attempts hit `{isError}` → `retryHeals=0` → 2/35 (5.7%) terminal coverage holes** (`cdc9b80d/critical_question`, `e010bb43/argument_scheme`, both `mcp_api_error` ×2). The retry heals isolated/organic `{isError}` (mechanistic test; per-arg concurrency 2) but not a sustained burst. Root: the retry-delay is too short to wait out the burst peak.

## Scope (operator's — implement exactly)
1. **Tune the retry ONLY for `provider_server_error`.** Lengthen its single retry's backoff to **~7–10s with bounded jitter** so it waits out the hot burst window (target: ~7000ms base + a bounded jitter of a few seconds). **Prefer tuning the EXISTING single retry before adding a 2nd attempt** — do NOT add a 2nd retry unless a later Stage 2B approves it on evidence the single longer retry is insufficient.
2. **Sub-reason-keyed, NOT the shared backoff.** The longer delay applies ONLY when `lastSummary.failureSubReason === 'provider_server_error'`. The shared `RETRY_BACKOFF_MS` ([2000, 8000]) MUST stay byte-equal — genuine `mcp_api_error` / `mcp_network_error` / `mcp_rate_limited` keep their 2s first-retry. Concurrency 2 (`MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES`) unchanged; `MAX_ATTEMPTS` stays 2 (one retry).
3. **Keep all other retry behavior unchanged.** No broad retry; do NOT retry all `mcp_validation_failed` / doctrine-ban-list / ordinary response-schema failures.

## Exact anchor
`autoTriggerDispatcher.ts:325–331` (the retry-backoff branch):
```ts
if (!isSummaryRetryable(lastSummary)) break;
if (attemptNumber >= MAX_ATTEMPTS) break;
const waitMs = RETRY_BACKOFF_MS[attemptNumber - 1] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
await sleep(waitMs);
```
Replace the `waitMs` selection with a conditional: when `lastSummary.failureSubReason === 'provider_server_error'`, `waitMs = providerServerErrorBackoffMs(attemptNumber, rand01)` (longer + jittered); else the existing `RETRY_BACKOFF_MS[...]` (byte-equal). `failureSubReason` is on `PerArgumentSummary` (added in #365 Phase 1) — available in the loop's `lastSummary`. The `isSummaryRetryable` gate (keyed on `mcp_api_error`) is unchanged — `provider_server_error` already rides `mcp_api_error`, so it IS retryable; this card only changes the DELAY, not WHETHER it retries.

## Testability — the jitter must be deterministic-testable
The dispatcher is not Jest-loadable (source-scan). Put the delay computation in a **pure, Jest-loadable helper** `providerServerErrorBackoffMs(attemptNumber, rand01)` (rand01 ∈ [0,1) injected — default `Math.random()` at the dispatcher call site, source-scanned). The helper returns `BASE_MS + Math.floor(rand01 * JITTER_MS)` (bounded). Tests assert `BASE_MS ≤ result ≤ BASE_MS + JITTER_MS` for rand01 ∈ {0, ~0.5, ~0.999}. Constants (`PROVIDER_SERVER_ERROR_RETRY_BASE_MS ≈ 7000`, `PROVIDER_SERVER_ERROR_RETRY_JITTER_MS ≈ 3000`) live in a pure module (the designer picks the home — likely a small pure module or alongside the existing concurrency constant; NOT the schema-mirrored files). NO `Math.random` inside the pure helper (it takes rand01); the call site supplies it.

## Required non-spend unit tests (the operator's 8)
(a) first attempt `{isError}`/`provider_server_error`, delayed retry returns valid → final SUCCESS; (b) repeated `{isError}` → fails after the allowed attempts, still typed `provider_server_error`; (c) ordinary response-schema failures NOT swept into this retry path (they stay non-retryable / use the standard backoff); (d) doctrine/ban-list failures NOT retried; (e) the `provider_server_error` retry delay + jitter are BOUNDED (BASE ≤ delay ≤ BASE+JITTER) and longer than the standard 2s; (f) concurrency stays 2; (g) submit fire-and-forget unchanged; (h) no secrets/raw payloads/prompts/bodies/JWT/bearer/keys/auth in return-log detail. Plus a source-scan: the shared `RETRY_BACKOFF_MS` is byte-equal and the longer delay is gated on `failureSubReason === 'provider_server_error'`. The recovery (a) rides the established coverage-wall split (behavioral on the pure helper + dispatcher source-scan).

## Reviewer focus (operator's 7)
not a broad retry; only `provider_server_error` gets the tuned delay; concurrency 2; retry doesn't bypass doctrine guards; submit nonblocking; no schema/migration/registry/prompt/family-key/Source-6/audit-lint/package.json change; the shared `RETRY_BACKOFF_MS` byte-equal.

## HALT triggers
1 the tuned delay applies to any class other than `provider_server_error`; 2 the shared `RETRY_BACKOFF_MS` edited (would affect genuine api_error/network/rate-limit); 3 a 2nd retry added (MAX_ATTEMPTS change) without a fresh Stage 2B; 4 concurrency changed/>2; 5 migration/column; 6 `Math.random` inside the pure helper (non-deterministic test); 7 schema-mirror/prompt/flag/family-key/audit-lint/package.json touched; 8 submit becomes blocking; 9 forecast >+40 (expected +10 to +20).

## Post-merge Phase 4 (gated SPEND — separate operator gate)
Same production-path discipline as the #365 Phase 4: canary-first; synthetic smoke-tagged; A–G; no H/I/J; concurrency ≤2; every (arg,family) ends ≥1 success (failed-then-success = recovery OK; failed+failed = terminal hole; 2 success = dup defect); submit nonblocking; overlap bounded 2; no 429; **p95<30s with the TUNED retry** (the longer ~7–10s retry adds latency to a healed family — must still stay <30s; if a retried family pushes p95 into 30–45s that is PARTIAL). Reach meaningful burst pressure (cross-arg overlap ≥ ~7–8) or mark INCONCLUSIVE.

## Verdict (#368 → then #365)
PASS: mechanistic retry test passes + production burst reaches meaningful pressure + every (arg,family) ends success + no H/I/J + no dup + no 429 + nonblocking + overlap 2 + p95<30s → **close #365**, Family H planning resumes. PARTIAL: holes remain / p95 30–45s / insufficient burst → if persistent `provider_server_error`, file the server-side investigation card. FAIL: generic again / broad retry / doctrine retry / secrets / concurrency>2 / submit blocks / H-I-J / dup / p95>45s.

## Test forecast
+10 to +20 (the pure backoff helper + bound tests, the sub-reason-keyed-delay source-scan, the shared-RETRY_BACKOFF_MS-byte-equal regression, the recovery composition).
