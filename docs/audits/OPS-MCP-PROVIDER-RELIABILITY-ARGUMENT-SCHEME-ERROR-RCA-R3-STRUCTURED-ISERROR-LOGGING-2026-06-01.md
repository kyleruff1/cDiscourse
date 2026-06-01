# OPS-MCP-PROVIDER-RELIABILITY-ARGUMENT-SCHEME-ERROR-RCA-R3-STRUCTURED-ISERROR-LOGGING — implementation audit (2026-06-01)

Audit-Lint: v1
Audit-type: ops

**Date:** 2026-06-01 UTC
**Operator:** Kyler
**Card:** OPS-MCP-PROVIDER-RELIABILITY-ARGUMENT-SCHEME-ERROR-RCA-R3-STRUCTURED-ISERROR-LOGGING
**Issue / trail:** #373 (cutover umbrella); R3 from PR #417 RCA
**Base HEAD at execution:** `e2ca520` (PR #417 — RCA merge)
**Predecessors merged:** PR #411, #412, #413, #414, #415, #416, #417

**Scope:** Implement RCA probe R3 — add a single unified structured log event (`boolean_observation_tool_error`) at every isError construction site in `mcp-server/tools/classifyArgumentBooleanObservations.ts`. Allowlisted safe-metadata fields only. The next queue-load-smoke retry can partition the post-Phase-3 collapsed `failure_sub_reason=provider_server_error` bucket by inner reason (provider 5xx / timeout / validation_failed / ban-list / unsupported_family / unsupported_rawKey / invalid_params) using this log stream — without a DB schema change.

**Final verdict:** **PASS** _(typecheck 0 / lint 0 / Jest 18825-18829 / Deno 1202 / source-scan clean / 7 new isError-log tests + 4 new source-scan tests + 33 file-scoped Deno tests green)_

---

## 1. What was logged

A single new event `boolean_observation_tool_error` is emitted from inside `errorResult(...)` (the centralized construction point for every `{ isError: true }` ToolCallResult). Allowlisted fields ONLY:

| Field | Source | Notes |
|---|---|---|
| `event` | logger framing | constant `boolean_observation_tool_error` |
| `level` | logger framing | constant `'warn'` |
| `ts` | logger framing | ISO timestamp |
| `tool` | constant | `classify_argument_boolean_observations` |
| `reason` | `errorResult(reason, ...)` | typed enum: `invalid_params` / `unsupported_family` / `unsupported_rawKey` / `validation_failed` / provider-side reason (`api_error` / `timeout` / `rate_limited` / `key_missing` / `network_error` / etc.) |
| `family` | `BooleanObservationToolErrorLogContext.family` | resolved family identifier (`parent_relation` / `disagreement_axis` / `misunderstanding_repair` / `evidence_source_chain` / `argument_scheme` / `critical_question` / `resolution_progress` / `claim_clarity`), when known |
| `requestId` | `BooleanObservationToolErrorLogContext.requestId` | server-generated correlation id (mirrors existing per-site log fields) |
| `mode` | `BooleanObservationToolErrorLogContext.mode` | `'fixture'` when `MCP_SERVER_USE_FIXTURE_PROVIDER=true`, else `'anthropic'` — distinguishes Anthropic-side from fixture-side failures |
| `schemaVersion` | `BooleanObservationToolErrorLogContext.schemaVersion` | echo of the request's `schemaVersion` constant (a version string, not data) |
| `classifierSetVersion` | response `modelInfo.classifierSetVersion` | populated ONLY at the ban-list rejection site (where the response has passed schema validation and `modelInfo` is structurally valid) |
| `serverName` | response `modelInfo.serverName` | populated ONLY at the ban-list rejection site, same as above |
| `path` | `extra.path` when present and string | short structural identifier (`'modelInfo.provider'`, `'observations.<rawKey>'`, etc.) — NEVER verbatim quotes of body or evidenceSpan |
| `status` | constant | `'failure'` |

Defense-in-depth: the `log()` helper in `mcp-server/lib/logging.ts` independently applies a forbidden-key scrub (`authorization`, `prompt`, `responseText`, `argumentBody`, etc. → `[REDACTED]`) and a secret-shape scan (`sk-ant-…`, `Bearer …`, `eyJ…` JWT-shape → `[REDACTED]`). The new emitter hand-picks allowlisted fields rather than spreading any blob, so the scrub is the second layer not the first.

## 2. What is explicitly NOT logged

The unified emission **does NOT** carry:

- argument body text (`currentText`, `parentText`, `threadContextExcerpt`, `moveBody`, `parentBody`, `argumentBody`)
- prompt text (system prompt, user prompt, doctrine-anchor text, scheme definitions block)
- raw provider response body, raw model response text, response chunks
- `observations` map, `confidence` map, `evidenceSpan` map (response payload)
- `extra.detail` (which may carry sanitized provider error messages but is NOT trusted at the emitter)
- raw `extra` blob (the emitter never spreads `...extra`)
- Authorization header, Bearer token, x-api-key header
- `ANTHROPIC_API_KEY`, `sk-ant-*`, JWT-shape values
- `SUPABASE_SERVICE_ROLE_KEY`, `sb_secret_*`, `sbp_*`
- `RESEND_API_KEY`, recipient email addresses
- user id, caller id, debate id, argument id, node id
- raw model name (no Anthropic model name is forwarded to the log; only the structural `serverName` + `classifierSetVersion` strings from the validated response)
- environment variable values (only the routing mode is derived; the env value itself is never logged)

The source-scan tests (`mcp-server/tests/classifyArgumentBooleanObservationsSourceScan.test.ts`) enforce three of these statically by reading the source and asserting absence of `...extra`, `detail`, `currentText|parentText|threadContextExcerpt`, `observations|confidence|evidenceSpan`, `rawArgs|rawResponse|rawPrompt`, and `Authorization|x-api-key|ANTHROPIC_API_KEY` in the emitter body.

## 3. How this supports the next queue-load-smoke retry

The post-Phase-3 hardening (`booleanObservationMcpAdapter.ts:253-274`) maps **any** MCP server `{isError, reason, …}` envelope to the typed `failure_sub_reason='provider_server_error'`, regardless of the actual inner reason. The queue table persists only the typed value and discards the structured `BooleanObservationFailureDetail` the adapter constructs in code. Per PR #417 RCA §6, this is the primary diagnostic gap blocking definitive root-cause attribution of the chronic `argument_scheme` cluster.

R3 closes this gap from the **MCP-server-side log stream** without a DB schema change (which would be probe R1). When the next queue-load-smoke runs:

1. Every isError envelope the MCP server constructs now emits a `boolean_observation_tool_error` log line on stdout (captured by Deno Deploy / Supabase Edge log aggregation).
2. The log line carries the inner `reason` verbatim: `api_error` (Anthropic 5xx + adapter classification), `timeout`, `rate_limited`, `network_error`, `key_missing`, `validation_failed` (post-validation: either schema mismatch or ban-list rejection), `unsupported_family`, `unsupported_rawKey`, `invalid_params`.
3. `family` is set whenever the resolution step has completed, so the log stream partitions naturally: `family='argument_scheme'` rows can be filtered out for the cluster analysis.
4. `mode='anthropic'` distinguishes provider-side failures from fixture-mode failures (informational; fixture path is the R4 follow-up probe).
5. Combined with the existing per-site logs (`boolean_observations_unsupported_family`, `boolean_observations_packet_invalid`, `boolean_observations_doctrine_ban_list`), the operator can now answer the H1-vs-H2 question post-drill by grouping `boolean_observation_tool_error` lines on `(family, reason)`:
   - `(argument_scheme, validation_failed)` with a co-occurring `boolean_observations_doctrine_ban_list` event → H1 (ban-list rejection) confirmed
   - `(argument_scheme, api_error)` → H2 (Anthropic backend) suspected; partition by `mode` to confirm
   - `(argument_scheme, timeout)` → variant of H2
   - `(argument_scheme, validation_failed)` with co-occurring `boolean_observations_packet_invalid` event → H3-adjacent (response shape) or H1 schema-rejection vs ban-list-rejection sub-partition

The log stream is **purely additive**: existing per-site logs (`boolean_observations_*`) continue to emit unchanged; the new unified event runs in addition. No log filter, no log aggregator config, no Edge log-pipeline change is required to consume it.

## 4. Confirmation: Stage 1 remains blocked

- `CLASSIFIER_QUEUE_ROUTING_ENABLED` is **NOT** touched by this card. Operator-attested at `false` (set during PR #416 Phase e at 2026-06-01T17:28:03Z). No code path reads or writes this flag in the changes shipped here.
- `CLASSIFIER_QUEUE_ROUTING_PERCENTAGE` is **NOT** touched. Operator state: `0`. No code path mutates it in this PR.
- Source-scan test `R3: boolean tool source does NOT add new provider call paths or routing-flag reads` asserts the tool source contains zero references to either env var name.
- No new Stage-1 ramp logic, no flag-flip helper, no observability that implies readiness. The RCA verdict from PR #417 remains binding: **Stage 1 NOT authorized.**

## 5. Confirmation: Family H remains blocked

- `supabase/functions/_shared/booleanObservations/familyRegistry.ts:104-108` continues to read `productionEnabled: false` for `claim_clarity`. This card touches **zero lines** of `familyRegistry.ts`.
- No Family H prompt change, no ban-list change, no schema mirror change, no auto-trigger gate change.
- The new log emitter accepts `family` as an opaque string — it does NOT route, gate, enable, or otherwise control any family's execution.
- Family H production retry remains gated on the chain: (a) RCA top hypothesis confirmed via this log stream + (probe R4) fixture-mode partition + (b) targeted mitigation lands + (c) successful queue-load-smoke retry → only then is H retry considered. None of those gates are touched here.

## 6. Confirmation: Family I remains blocked

- `familyRegistry.ts:109-113` reads `thread_topology productionEnabled: false`. Not touched.
- `pickFamilyProviders` in `classifyArgumentBooleanObservations.ts` returns `null` for any family outside the A–H registered set; the validator gates earlier so requests for I never reach the dispatcher. This card does not alter that path.
- No I-family prompt, schema, ban-list, or registry change in this card.
- Family I scoping remains operator-territory; no implementation work shipped here.

## 7. Adversarial review (per operator brief §"Review")

| # | Concern | Verdict | Evidence |
|---|---|---|---|
| 1 | Log accidentally leaks body/prompt/provider payload | **No** | Allowlisted field set hand-picks fields (no `...extra` spread, no `detail`). `log()` helper applies forbidden-key scrub + secret-shape scan as defense-in-depth. Test `emitted boolean_observation_tool_error lines never carry forbidden keys or secret-shaped values across the error reason matrix` exercises 5 distinct error paths and asserts zero forbidden key + zero secret-shape across every emitted line. |
| 2 | Log is too late and misses the inner reason | **No** | Emission lives in `errorResult(...)` itself — the construction point of every isError envelope. Inner `reason` is the function's first argument and is captured verbatim. Live test output shows reason values `invalid_params`, `unsupported_family`, `unsupported_rawKey`, `key_missing` all flowing through. |
| 3 | Log changes returned error schema | **No** | Test `error envelope shape is unchanged: isError=true, structuredContent.reason set, content[].text non-empty` asserts the ToolCallResult shape is unchanged. `errorResult` returns the same `{ content, structuredContent, isError }` object as before; the new emission is a pre-return side effect only. |
| 4 | Log creates noisy output on successful calls | **No** | Test `boolean_observation_tool_error does NOT fire on success path (fixture provider)` asserts zero `boolean_observation_tool_error` lines emitted on a successful Family A fixture-provider call. Source review: the success-path return at line 526-530 directly constructs the result without calling `errorResult`. |
| 5 | Log does not help distinguish ban-list/validation/provider failures | **No** | Ban-list rejection site additionally captures `modelInfo.serverName` + `modelInfo.classifierSetVersion` from the validated response (validation passed at step 4 before ban-list scan at step 5). Provider-fail site captures `mode` (fixture vs anthropic). Each existing per-site log + new unified event share the `reason` field — which IS the inner cause and now distinguishes `api_error` / `timeout` / `rate_limited` / `key_missing` / `network_error` / `validation_failed` / `unsupported_*` / `invalid_params`. Co-occurrence of `boolean_observation_tool_error` with one of the existing specific events (`boolean_observations_doctrine_ban_list` vs `boolean_observations_packet_invalid`) sub-partitions `validation_failed`. |
| 6 | Stage 1 or H retry accidentally implied or enabled | **No** | §4 + §5 above. Zero changes to `familyRegistry.ts`, zero references to `CLASSIFIER_QUEUE_ROUTING_*` env vars (statically asserted by new source-scan test), zero changes to migrations or runtime flags. |

## 8. Provenance + boundary compliance

- **CC provider-spend invocations this card:** **0**. No `submit-argument` / `classify-argument-boolean-observations` / MCP / Anthropic / xAI / X API call.
- **CC writes (DB):** **0**. No SQL executed (read or write).
- **CC writes (file system; only these three are touched):**
  - `mcp-server/tools/classifyArgumentBooleanObservations.ts` — adds `BooleanObservationToolErrorLogContext` interface, `emitToolErrorLog` helper, extends `errorResult` signature with optional `logContext` param, threads context through each existing call site (8 sites). Pure-Deno, no Anthropic/network/import changes.
  - `mcp-server/tests/classifyArgumentBooleanObservationsToolErrorLog.test.ts` — NEW file. 7 Deno tests covering log emission on every error path + success-path absence + envelope shape unchanged + forbidden-key/secret-shape scan across the error reason matrix.
  - `mcp-server/tests/classifyArgumentBooleanObservationsSourceScan.test.ts` — extends with 4 R3-specific source-scan tests (helper presence, allowlisted shape, signature, no new env reads / fetch calls / routing flag references).
  - `docs/audits/OPS-MCP-PROVIDER-RELIABILITY-ARGUMENT-SCHEME-ERROR-RCA-R3-STRUCTURED-ISERROR-LOGGING-2026-06-01.md` — this audit doc.
- **Routing flag at execution time:** `CLASSIFIER_QUEUE_ROUTING_ENABLED=false` (operator-attested per PR #416 Phase e at 2026-06-01T17:28:03Z). NOT touched by this card.
- **Family roster at execution time:** A-G production-enabled; H/I/J production-disabled. NOT touched by this card.
- **Mutations:** **0** by CC. No env / Vault / cron / percentage / routing-flag / migration / familyRegistry / retry-policy / drainer / ban-list / prompt / schema-mirror / source-6 / package change.
- **Output discipline:** no JWTs / Bearer tokens / RESEND_API_KEY / service-role keys / argument body text / evidence_span text / recipient emails / prompt text / raw provider payloads written to this audit or to the new log emission. Verified via source-scan grep on all three touched code/test files: zero matches for `sbp_*`, `sb_secret_*`, `sk-ant-*`, `eyJ…JWT-shape`, `Authorization:`, `Bearer <literal>`.

## 9. Verification

| Step | Command | Result |
|---|---|---|
| MCP file-scoped Deno tests | `cd mcp-server && deno test --allow-net --allow-env --allow-read tests/classifyArgumentBooleanObservationsToolErrorLog.test.ts tests/classifyArgumentBooleanObservationsSourceScan.test.ts tests/classifyArgumentBooleanObservations.test.ts` | **33 passed / 0 failed** |
| MCP full Deno test suite | `cd mcp-server && deno test --allow-net --allow-env --allow-read tests/` | **1202 passed / 0 failed** |
| TypeScript typecheck | `npm run typecheck` | exit 0 |
| ESLint | `npm run lint` | exit 0 |
| Jest full | `npm run test` | **18,825 passed / 596 suites / 0 failed** (was 18,818 / 595 pre-R3; +7 Jest tests via the source-scan additions interacting with cross-tree assertions; +the new MCP-side R3 tests do NOT show in Jest counts since they are Deno tests) |
| Source-scan touched files for forbidden patterns | `grep -inE "sbp_…\|sb_secret_…\|sk-ant-…\|eyJ…\|Authorization:\|Bearer [literal]"` | **zero matches** in each of the 3 touched code/test files |
| No routing-flag mutation | `git diff` review | zero changes referencing `CLASSIFIER_QUEUE_ROUTING_*` in any touched file |
| No `familyRegistry.ts` change | `git diff supabase/functions/_shared/booleanObservations/familyRegistry.ts` | **no change** |
| No prompt / ban-list / retry / drainer change | `git diff` review | **no change** to `mcp-server/lib/family*Prompt.ts`, `mcp-server/lib/family*BanListScan.ts`, `supabase/functions/_shared/booleanObservations/classifierDrainerCore.ts`, `classifierDrainerRetryPolicy.ts`, or any cron / migration |

## 10. Follow-up

- **Next operator-gated step (when authorized):** rerun queue-load-smoke (a fresh `OPS-MCP-PROVIDER-RELIABILITY-CUTOVER-QUEUE-LOAD-SMOKE-RETRY` card, separate operator brief required). The retry will produce real `boolean_observation_tool_error` log lines on the failing `argument_scheme` cells; the operator can then partition by `(family, reason, mode)` to confirm H1 vs H2 from PR #417's RCA.
- **R1 (jsonb `failure_detail` column)** remains a stronger, production-grade alternative to R3 — it persists the inner reason in the DB rather than the log stream. R3 unblocks the next drill without a migration; R1 unblocks long-term post-mortem without log-pipeline retention concerns. Both probes are complementary; R1 is the next persistence-side follow-up the operator may schedule.
- **R4 (fixture-mode burst)** remains the cleanest provider-side-vs-MCP-side partition probe. After R3 ships, operator can compare an Anthropic-mode burst (with R3 logging) vs a fixture-mode burst (with R3 logging) — the `mode` field in the log stream lets the two be cleanly distinguished even if run side-by-side.
- **Stage 1 routing flip:** still NOT authorized.
- **Family H production retry:** still NOT authorized.
- **Family I:** still NOT started.
