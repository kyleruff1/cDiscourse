# OPS-MCP-SERVER-CAPACITY-INVESTIGATION — Intent brief (server-cap-only fix)

> **SUPERSEDED for the active fix axis (pointer, body preserved).** The per-isolate
> synchronous-capacity cap approved in this intent brief was superseded by the canonical Postgres
> async classifier queue in [`ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md`](./ARCH-001-CIVIL-DISCOURSE-CLASSIFIER-QUEUE-ARCHITECTURE.md)
> §"Goal (one paragraph)". This brief is preserved byte-equal as the durable #371 card-intent; it is not a current prescription.

**Operator:** Kyler · **Date:** 2026-05-30 · **Issue:** #371
**Card type:** root-cause server-side fix — a per-isolate bounded provider-concurrency cap in `mcp-server/`. **Stage 2B APPROVED** (server-runtime change). Server-cap ONLY this card: NO retry-after protocol, NO Edge change, NO Family H. NO prompt/taxonomy/family-key/schema-mirror/Source-6/Edge-flag/audit-lint change; NO migration; no `package.json` change unless an existing test/script pattern requires it + operator approval.

## Phase 0 RCA (complete — the localized cause)
The hosted MCP server (`mcp-server/`) fans out **unthrottled** concurrent Anthropic calls: `lib/anthropicCall.ts` `callAnthropic` is a single fetch per call with NO semaphore/queue/retry, and `tools/classifyArgumentBooleanObservations.ts` issues exactly one `callAnthropic` per classify request (1:1, no internal fanout). The Edge's `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES=2` is **per-argument**; a cross-argument burst (5 args × up-to-2 = ~10 concurrent Edge→MCP requests) → ~10 concurrent unthrottled Anthropic calls → Anthropic **429 (`rate_limited`) / 25s timeout (`model_timeout`) / 5xx (`api_error`)** → `errorResult()` emits `{isError, reason, …}` (lines 457–462). This is the concurrency-correlated `{isError}` the #365/#368 program chased; no Edge backoff fixes it because the Edge can't bound cross-arg fan-in — the throttle must live at the server.

## Stage 2B decision (operator-chosen: server-cap ONLY)
Implement a **per-isolate bounded provider-call concurrency cap** around `callAnthropic`. Prove whether the cap alone restores A–G run-completeness under burst + keeps p95<30s before adding any retry-after protocol (that is a deferred follow-up, `OPS-MCP-SERVER-RETRY-AFTER-PROTOCOL`, filed only if this card is PARTIAL).

## Scope
- A small **bounded semaphore / provider-call runner** that gates concurrent Anthropic fetches; excess callers **queue** inside the isolate.
- Wrap the **provider round-trip** in `callAnthropic` (`anthropicCall.ts` ~lines 184–286: the `fetch` + response read) — acquire before the fetch, release in a `finally`. New pure module recommended: `mcp-server/lib/providerConcurrency.ts` (the semaphore + the cap).
- **Cap = env-configurable, default 5** (suggested 5–6 to drop the ~10 burst peak while preserving p95<30s; the established pattern is `Deno.env.get` — e.g. `MCP_SERVER_MAX_PROVIDER_CONCURRENCY`, default 5, validated `>=1`). If the designer finds evidence the provider tolerance is lower, surface before implementing.
- **No unbounded queue growth.** A plain semaphore's waiter queue is bounded by the isolate's in-flight request count (finite); if the designer adds an explicit queue-depth limit or a bounded wait-timeout, it MUST be bounded + tested.
- Preserve: the tool contract, all boolean-observation response schemas, all family prompts/keys/taxonomy/classifier behavior, provider failure typing (the `{isError}` envelopes may STILL occur if the cap can't protect the provider — the goal is to prevent them under the current A–G burst profile, not to eliminate the envelope class).

## TOPOLOGY HONESTY (binding)
A module-level semaphore bounds **per-isolate** concurrency. The hosted MCP server (Deno Deploy or similar) MAY run multiple isolates/processes → the cap is **per-isolate, NOT a true global cap**. The design + code comments + the audit MUST say "per-isolate" and must NOT claim global enforcement unless the deployment topology proves single-instance. The post-merge smoke determines whether the per-isolate cap is sufficient for the current product load.

## Anchor + test mechanics
- `mcp-server/lib/anthropicCall.ts` — `callAnthropic` (the gate site). `mcp-server/lib/toolDispatch.ts` + `tools/classifyArgumentBooleanObservations.ts` are the callers (no change needed — the gate is inside `callAnthropic`).
- Tests run via **`deno test --allow-net --allow-env --allow-read tests/`** in `mcp-server/` (Deno 2.8.0 available locally; the repo jest suite does NOT cover `mcp-server/`). Also `deno check` + `deno fmt` (the server uses `deno fmt`, lineWidth 100, singleQuote, semiColons). The semaphore module should be pure + unit-testable (inject a fake task to assert max-observed-concurrency, like the Edge `boundedConcurrencyRunner` pattern).

## Required non-spend tests (the operator's 10)
1. Provider calls are capped under concurrent tool calls (max observed concurrency ≤ cap). 2. The cap is around the actual Anthropic/provider fetch, NOT merely request parsing. 3. Queued calls eventually run + return normal classifier responses. 4. The cap does not change classifier response shape. 5. No prompt/key/family behavior change. 6. Provider failure envelopes remain sanitized. 7. No prompt / argument body / raw model response / full provider payload / JWT / bearer / API key / service-role / auth header in logs or returned detail. 8. Existing hosted MCP smoke/parity tests still pass. 9. Existing A–G family tests still pass. 10. No H/I/J enablement. Assert the cap against an IMPORTED constant (not a literal — Card-1B lesson). Forecast +10 to +25 (HALT >+50).

## Reviewer focus (operator's 8)
Cap is server-side (not Edge); bounds actual provider fetches; no unbounded `Promise.all` around provider calls; no broad retry added; no retry-after schema / Edge protocol change slipped in; no family/prompt/taxonomy/schema behavior change; secrets + raw provider/model payloads excluded; topology wording honest (per-isolate unless proven global).

## HALT triggers
1 cap implemented Edge-side instead of server-side; 2 retry-after schema / Edge protocol change added (deferred); 3 any prompt/taxonomy/family-key/schema-mirror/Source-6/Edge-flag/audit-lint change; 4 migration/DB column; 5 unbounded queue growth; 6 a broad retry added; 7 Family H touched; 8 classifier response shape changed; 9 a secret/raw payload reachable in log/detail; 10 "global cap" claimed without single-instance proof; 11 forecast >+50.

## Post-merge smoke (gated SPEND, separate gate)
Canary-first + a tight A–G burst matching the prior verification shape: submit nonblocking; A–G only; no H/I/J; every (arg,family) reaches success; no duplicate success rows; overlap bounded 2 (Edge); no 429 instability; the server cap observable via reduced concurrent provider-call pressure if instrumentation allows; **p95<30s**; doctrine evidence_span scan clean. Verdict: PASS = complete A–G coverage under meaningful burst + no H/I/J + no dup + no secret leak + nonblocking + p95<30s. PARTIAL = coverage improves but holes remain / p95 30–45s / per-isolate cap only partially effective / underpowered burst → file `OPS-MCP-SERVER-RETRY-AFTER-PROTOCOL`. FAIL = p95>45s / terminal holes under valid burst / secrets leak / response-shape change / H-I-J / dup / submit blocks.

## After PASS
Close #371; update #365 + #368 as resolved by server-side capacity control; re-surface Gate H (Family H may resume only after PASS or explicit Gate H residual-risk acceptance).

## Test forecast
+10 to +25 (the semaphore unit tests — cap bound, queue drains, purity/ban-list; the callAnthropic gate-site source-scan; the no-secret + no-shape-change regressions).
