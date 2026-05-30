# OPS-MCP-RESULT-VALIDATION-RETRY-TUNING — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-29
**Branch:** feat/OPS-MCP-RESULT-VALIDATION-RETRY-TUNING (3 commits: design + impl + status; none pushed)
**Issue:** #368
**Design:** docs/designs/OPS-MCP-RESULT-VALIDATION-RETRY-TUNING.md
**Intent (authoritative):** docs/designs/OPS-MCP-RESULT-VALIDATION-RETRY-TUNING-intent.md

## Summary

A surgical, non-spend retry-timing tune. `provider_server_error` failures (the hosted
MCP `{ isError }` overload envelope typed in #365 Phase 3) now take a longer bounded-
jittered backoff (~7–10s) before their single retry, instead of the shared 2s
first-retry. #365 Phase 4 (PARTIAL) found the 2s backoff re-enters the still-hot
server window under a concurrency-10 burst (`retryHeals=0` → 2/35 terminal holes); this
card waits out that window. The change is gated **strictly** on the literal
`lastSummary.failureSubReason === 'provider_server_error'`; every other retryable class
(`mcp_api_error` / `mcp_network_error` / `mcp_rate_limited`) keeps the byte-equal
`RETRY_BACKOFF_MS`. The delay computation lives in a new **pure, zero-import,
Jest-loadable** helper (`providerServerErrorBackoff.ts`) that takes an injected `rand01`
(no internal `Math.random`/`Date.now`); the dispatcher supplies `Math.random()` at the
call site. No migration, no schema/mirror, no concurrency change, no 2nd retry, no
package.json, no `src/`/`app/` touch. Doctrine clean (transport-timing only — no verdict,
no truth surface, no secret surface, submit stays nonblocking). All gates green; +30
tests. **No concerns; ready to push.**

## Verification

| Gate | Result |
|---|---|
| typecheck | **pass** — `tsc --noEmit`, exit 0 |
| lint | **pass** — `eslint . --ext .ts,.tsx --max-warnings 0`, exit 0 |
| test | **pass** — `Test Suites: 581 passed, 581 total / Tests: 18443 passed, 18443 total`, exit 0 (19.5s; no moveMetadataLedger flake observed) |
| test delta | 18413 → 18443 (**+30**), 580 → 581 suites (+1); under the +40 HALT |
| secret scan | **clean** — only hits are negative-assertion regexes inside the new test + design prose (the suite *proving* absence) |
| doctrine scan | **clean** — verdict-token hits are only the test ban-list array + doctrine self-check prose; no token in shipped code |
| Migration apply | **n/a — no migration** (confirmed `git diff --name-only main...HEAD -- 'supabase/migrations/**'` empty) |

## File footprint (matches design exactly)

NEW `supabase/functions/_shared/booleanObservations/providerServerErrorBackoff.ts` ·
edited `autoTriggerDispatcher.ts` (+16/-1) · edited bridge `__tests__/_helpers/booleanObservationEdgeDeno.ts` (+15) ·
NEW `__tests__/mcpAutoTriggerRetryTuning.test.ts` (372 LOC, 27 tests) ·
edited `__tests__/mcpOneTwoOneCAutoTriggerFailureMode.test.ts` (+42, FAIL-27/28/29) ·
`docs/core/current-status.md` (+1 ledger comment) · the design `.md`.

**Confirmed ABSENT:** `booleanObservationMcpAdapter.ts`, `booleanObservationFailureSubreason.ts`,
`classifyArgumentCore.ts`, `mcpBooleanObservationSchema.ts` + its 2 mirrors, `familyRegistry.ts`,
both Edge handlers (incl. `submit-argument/index.ts`), any migration, `package.json`/lockfile.

## Targeted scrutiny (all 8 + migration)

1. **Narrowness (HALT-1) — PASS.** Dispatcher `:341-344`: `waitMs = lastSummary.failureSubReason === 'provider_server_error' ? providerServerErrorBackoffMs(attemptNumber, Math.random()) : RETRY_BACKOFF_MS[attemptNumber - 1] ?? RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1]`. The else arm is **character-for-character** the original line. Exact-equality literal, not a prefix match (test d asserts no `startsWith('provider_')`). A genuine `mcp_api_error`/`mcp_network_error`/`mcp_rate_limited` (subReason ≠ provider_server_error) still gets the 2s first-retry.
2. **Shared backoff byte-equal (HALT-2) — PASS.** `RETRY_BACKOFF_MS = Object.freeze([2_000, 8_000])` (`:130`), `MAX_ATTEMPTS = 2` (`:113`), `RETRYABLE_FAILURE_REASONS = new Set(['mcp_network_error','mcp_api_error','mcp_rate_limited'])` (`:120-124`), `isSummaryRetryable` (`:217-221`) all unchanged (only the import + waitMs block are in the diff). `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES = 2` untouched. FAIL-9/FAIL-27 green.
3. **Pure helper — PASS.** `providerServerErrorBackoffMs(attemptNumber, rand01)` = `PROVIDER_SERVER_ERROR_RETRY_BASE_MS(7000) + Math.floor(clamp(rand01) * PROVIDER_SERVER_ERROR_RETRY_JITTER_MS(3000))`. Clamp: `Number.isFinite(rand01) && rand01 > 0 ? Math.min(rand01, 0.999_999_999) : 0`. Result ∈ [7000, 10000), always > 2000. **Zero imports; no `Math.random`/`Date.now`/`Deno.`/`fetch`/`console` inside** (test h source-scans confirm). `Math.random()` only at the dispatcher call site.
4. **Bound tests non-vacuous — PASS.** Helper bound tests assert exact endpoints (`toBe(7000)` at rand01=0; `toBe(8500)` at 0.5; `< 10000` & `>= 9999` near 0.999), `>= BASE && < BASE+JITTER && > 2000` across {0,0.25,0.5,0.75,0.999}, and a clamp matrix over {-1, 1, NaN, +Infinity}. These would FAIL if BASE/JITTER were wrong. Not padding.
5. **No broad / no doctrine retry — PASS.** Only the DELAY changes for a class that was *already* retryable via `mcp_api_error`; retryability set is byte-equal. `mcp_validation_failed` / `mcp_parse_failure` absent from the set; response_wrong_shape/missing_field/not_json stay non-retryable; doctrine/ban-list never retried (tests c/d).
6. **Strict-null soundness — PASS.** `lastSummary.failureSubReason` at `:342` uses direct access (no `?.`, no `!`). `lastSummary` (declared `PerArgumentSummary | null` at `:277`) is assigned from `classifyOneArgumentCore(...)` (non-nullable return) at `:280` within the same loop iteration and is already dereferenced at `:288` (`lastSummary.status`) and passed to `isSummaryRetryable(lastSummary: PerArgumentSummary)` at `:327`, with no reassignment in between — so it is control-flow-narrowed non-null. Project `tsc` passes; the narrowing is structural so the Deno deploy-time binding check is equally satisfied. No `!` suppression.
7. **Test delta substantive — PASS.** New suite = 27 tests (value-pin 1; bound/determinism/clamp 4; recovery 2; terminal-typed 2; not-swept-in 3; doctrine-not-retried 2; concurrency 2; submit fire-and-forget 2; helper-purity+secrets 6; Math.random-location 3). Failure-mode suite +3 (FAIL-27/28/29 regression guards). Total +30 — above the design's own +12–18 forecast but legitimate thoroughness (endpoint + clamp matrix), under the +40 HALT.
8. **Doctrine + fire-and-forget — PASS.** Pure latency/timing constant — no gameplay/heat/verdict signal. `submit-argument/index.ts` byte-equal (`:787-809`): `dispatchAutoTriggerForArgument(...).catch(() => undefined)` + `EdgeRuntime.waitUntil(...)`, response `created({... allowPost: true ...})` returned independently of the dispatcher. Score/retry never blocks posting (§1). No secret-shaped literal in the helper or dispatcher edit.

**Migration check — PASS.** No migration in the diff; none expected.

## Doctrine self-check (all ✓)
- ✓ No truth/winner/loser language in user-facing strings (verdict tokens appear only as test ban-list entries proving absence)
- ✓ Score never blocks posting (submit call site byte-equal, nonblocking; this is downstream of the returned 201)
- ✓ No service-role in client code (no `src/`/`app/` touched; server-only helper)
- ✓ No direct insert into public.arguments
- ✓ No AI calls in production app paths (the change governs *when* a classifier retries, not whether a model decides a verdict)
- ✓ Plain language only (`provider_server_error` is an operator/diagnostic sub-reason; the gate reads it, surfaces nothing new to users)
- ✓ Epic-specific (semantic-referee MCP track): cdiscourse-doctrine §4/§7 — outcomes remain structural Machine Observations; helper is pure with zero imports and no network. §6 — helper returns a `number`, adds no field to any log/return surface; terminal log's `failure_sub_reason`/`failure_detail` predate this card and are sanitized by `buildFailureDetail`.

## Test coverage (all ✓)
- ✓ New public function (`providerServerErrorBackoffMs`) has unit tests (bound, determinism, clamp, value-pin)
- ✓ Doctrine ban-list assertion present on the new source + edited dispatcher (test h)
- ✓ Edge cases from design tested (clamp of degenerate rand01; bound > 2000; endpoint exactness; the operator's a–h)
- ✓ Accessibility: n/a (no UI surface)

## Blockers
None.

## Suggestions (non-blocking)
1. (Carry-forward, NOT a code change) The latency budget is tight by the design's own reasoning: a healed family lands ~27–28s typical, ≤ ~30s worst case against the p95 < 30s PASS line. The `BASE + JITTER ≤ 10_000` cap is load-bearing for the budget — the gated post-merge Phase 4 verify is where this is actually validated. The card correctly defers this to the separate operator gate; flagged only so the operator re-checks p95 against 30s in Phase 4.

## Operator next steps
- Push the branch: `git push -u origin feat/OPS-MCP-RESULT-VALIDATION-RETRY-TUNING`
- Open PR: `gh pr create --title "OPS-MCP-RESULT-VALIDATION-RETRY-TUNING: provider_server_error longer jittered backoff (#368)" --body-file docs/audits/OPS-MCP-RESULT-VALIDATION-RETRY-TUNING-REVIEW-2026-05-29.md`
- Deploy: **none for merge** — no migration; the Supabase GitHub integration redeploys the Edge Function on merge to `main`.
- Gated, post-merge (separate operator gate, NOT this card): run the Phase 4 production verify (canary-first, synthetic smoke-tagged, A–G, concurrency ≤ 2, cross-arg overlap ≥ ~7–8, every (arg,family) ends ≥ 1 success, **p95 < 30s with the tuned retry**). PASS there closes #365 and resumes Family H planning.
- Post-merge worktree cleanup per roadmap-reviewer.md § "Post-merge worktree cleanup (operator step)".
