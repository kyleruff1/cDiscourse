# OPS-MCP-SERVER-CAPACITY-INVESTIGATION — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-30
**Branch:** feat/OPS-MCP-SERVER-CAPACITY-INVESTIGATION (4 implementer commits on design+intent; none pushed)
**Design:** docs/designs/OPS-MCP-SERVER-CAPACITY-INVESTIGATION.md (+ -intent.md, authoritative)
**Issue:** #371

## Summary
Ships a per-isolate bounded provider-concurrency cap in `mcp-server/`. A new pure
counting semaphore (`providerConcurrency.ts`, cap=5, env `MCP_SERVER_MAX_PROVIDER_CONCURRENCY`)
gates `callAnthropic`'s provider round-trip: acquire after the `key_missing` early-return,
release in a `finally` covering every return path. The cap wraps the single shared
`callAnthropic` chokepoint, so it throttles families A–G and the semantic-move tool with
one edit. The implementation matches the design and the intent brief exactly: server-cap
only, no retry, no Edge/family/prompt/schema/taxonomy/migration/package.json/deno.json
change, no Family H, topology described honestly as per-isolate. Verification battery and
secret/doctrine scans are clean. No blockers; no actionable comments.

## Verification (independently captured)
- `deno check mcp-server/lib/providerConcurrency.ts mcp-server/lib/anthropicCall.ts` → **EXIT 0**
- `deno fmt --config mcp-server/deno.json --check` on the 4 card files → **EXIT 0** ("Checked 4 files"). (The deno.json "exports" warning is pre-existing/cosmetic. The whole-tree `deno fmt --check mcp-server/` has ~102 PRE-EXISTING unformatted files from an older fmt version — out of scope; the card's 4 files are clean.)
- `deno test --config mcp-server/deno.json --allow-net --allow-env --allow-read mcp-server/tests/` → **1041 passed | 0 failed**, TEST-EXIT 0. Matches expected 1022→1041 (+19). `anthropicNoLogging`, family A–G, `mcpBooleanObservationSchemaParity`, `toolDispatch`, `classifySemanticMove`, structuredOutput, toolsList suites all green.
- secret scan: **clean** (all hits are the `ANTHROPIC_API_KEY` env-var NAME read, a clearly-labeled FAKE test key `sk-ant-fake-test-key-...`, or fragment-strings inside a prior card's current-status.md comment — no real key/Bearer/JWT/service-role value introduced)
- doctrine scan: **clean** (all `true`/`false` hits are `{ ok: true|false }` result shapes / `assertEquals(r.ok, true)` / boolean flags / the negating "NOT a true global cap" / the ban-list test's own array — no user-facing person/claim verdict)
- service-role / public.arguments direct insert: **none** (public.arguments grep exit 1)
- console.log in card source/test: **none** (grep exit 1)

## File footprint (diff vs main)
EXACTLY as specified:
- NEW `mcp-server/lib/providerConcurrency.ts`
- MODIFIED `mcp-server/lib/anthropicCall.ts`
- NEW `mcp-server/tests/providerConcurrency.test.ts`
- NEW `mcp-server/tests/anthropicCallProviderCap.test.ts`
- `docs/core/current-status.md` (additive HTML comment only)
- `docs/designs/OPS-MCP-SERVER-CAPACITY-INVESTIGATION.md`

ABSENT (confirmed): any family/prompt/schema-mirror/taxonomy file, `toolDispatch.ts`,
`lib/anthropic.ts` (semantic-move — byte-equal), any `supabase/` Edge file, any migration,
`package.json`, `deno.json`.

## Targeted scrutiny (the 8 + migration)

1. **Release-on-all-paths (deadlock guard) — PASS, non-vacuous.** `acquire()` is after
   the `key_missing` return and after `fetchImpl` resolution, before the fetch; the
   `try { … } finally { release(); }` wraps the entire fetch + 429-drain + !ok-drain +
   json + parse + success region (anthropicCall.ts:191→297). Every return (fetch-throw/
   timeout, 429, api_error, json-throw, parse-null, success) is inside the try. `ReleaseFn`
   is idempotent via a captured `released` flag. The deadlock-guard test fires cap+2 (=7)
   *failing* calls per {timeout, generic-throw, 429, 500, json-throw, parse-null}, asserts
   `inFlight === 0` after settle AND a subsequent healthy call resolves `{ok:true}`. This
   is non-vacuous: a leaked slot on any path would wedge the cap-5 pool (failing the
   `inFlight === 0` assertion) AND hang the healthy call's `acquire()` forever (test
   timeout). Firing >cap is the load-bearing choice — it forces the queue+handoff to run on
   the failure path. Moving any `return` outside the `try` fails the test two ways.
2. **Cap bounds the actual provider fetch — PASS.** T2 injects a barrier `fetchImpl` that
   counts live entries and asserts `maxLive <= RESOLVED_MAX_PROVIDER_CONCURRENCY` (the
   IMPORTED constant, not a literal 5). The barrier guarantees the cap is actually reached;
   the cap=3 injected variant asserts `maxLive === 3` exactly. Proven at the fetch boundary,
   not request parsing.
3. **Pure semaphore — PASS.** `providerConcurrency.ts` core has no `fetch(`/`console.`/
   `Date.now(`; `Deno.env.get(` appears exactly once and positionally inside
   `readEnvMaxProviderConcurrency` (source-scan asserts both). `createBoundedSemaphore(0|
   -1|NaN|Infinity|2.5)` throws RangeError (never silently unbounded). FIFO handoff is
   direct (no decrement-reincrement gap). Release idempotency is materially tested (queue
   B+C at cap=1, double-release A, assert C NOT admitted by the no-op second release).
4. **Byte-equal callAnthropic — PASS.** `git diff -w` shows only: (a) the import line,
   (b) the acquire/try/finally wrap. Headers (`x-api-key`, anthropic-version),
   body, `AbortSignal.timeout(timeoutMs)` signal, every log event, every `reason`, every
   return shape unchanged. One whitespace-only ternary reflow (`const reason: ... = err
   instanceof Error && ...`) is `deno fmt` re-layout — semantically identical. Signature +
   `AnthropicCallResult` union unchanged.
5. **No collateral / shared-chokepoint safe — PASS.** No retry loop, no Retry-After parse.
   No Edge/family/prompt/schema-mirror/taxonomy/migration/package.json/deno.json change. The
   cap wraps the shared `callAnthropic` → it also throttles the semantic-move tool;
   `lib/anthropic.ts` is byte-equal and `classifySemanticMove` tests stay green. Only timing
   under contention changes, not the contract.
6. **Topology honesty — PASS.** "per-isolate" used throughout the design, the module doc,
   and the gate comment. The only "global" usages are the negating "NOT a true global cap" /
   "Do not describe it as global." A source-scan test strips the disclaimer phrasings and
   asserts no affirmative `global` survives.
7. **Secrets — PASS.** No API key / x-api-key value / raw prompt / raw response body in any
   returned result or log across the success + all 6 failure paths. T6/T7 captures logs via
   `_setLogSinkForTesting` and asserts the FAKE key, RAW_PROMPT, and RAW_RESPONSE_TEXT never
   appear in any failure envelope or log line. `anthropicNoLogging.test.ts` keeps its
   dedicated `'anthropicCall source file never console.logs the Authorization header'` scan
   (+ x-api-key + ANTHROPIC_API_KEY) green.
8. **Test delta substantive — PASS.** +19 = 13 semaphore unit (cap bound ×2, drain, FIFO,
   cap-reader unset/valid/invalid, RESOLVED===5, cap=1, RangeError, idempotent release,
   purity/topology/ban scan, positive wiring scan) + 6 gate-site (T2 fetch-boundary, T4
   byte-equal packet, T4 failure-reason matrix, deadlock guard ×6-paths, key_missing-no-slot,
   T6/T7 no-secret). All legitimate behavioral coverage; no padding.

**Migration check — PASS (none).** `git diff --name-only -- 'supabase/migrations/**'`
returns empty. No migration → the migration-bearing-card heightened-verification section
does not trigger.

## Design conformance
- [x] All design file-changes present (6/6 exactly)
- [x] No undocumented file-changes
- [x] Data model matches design (none — in-isolate transient state only)
- [x] API contracts match design (semaphore exports + unchanged callAnthropic surface)
- [x] All 11 HALT triggers verified not fired

## Doctrine self-check
- [x] No truth/winner/loser language in user-facing strings
- [x] Score never blocks posting (cap touches no scoring path)
- [x] No service-role in client code (server-side Deno only; no service-role anywhere)
- [x] No direct insert into public.arguments
- [x] No AI calls in production app paths (change is entirely in mcp-server/)
- [x] Plain language only (no raw internal codes in UI strings — no UI surface)
- [x] Epic-specific (cdiscourse-doctrine §5 purity — gate core has no env/fetch/console/
      Date.now; §6 secrets — touches no secret/prompt/body; §1/§3 — ordering is pure FIFO,
      no heat/popularity/engagement signal)

## Test coverage
- [x] New public functions have unit tests (`createBoundedSemaphore`,
      `readEnvMaxProviderConcurrency`, `providerConcurrencyGate` all behaviorally covered)
- [x] Doctrine ban-list / no-secret assertions present (purity scan + T6/T7)
- [x] Edge cases from design § "Edge cases" tested (cap=1, key_missing, every failure-path
      release, double-release, empty-queue release, RangeError guard)
- [x] N/A accessibility (no UI card)

## Blockers
None.

## Suggestions (non-blocking)
None material. The implementation is faithful to a detailed design; the test suite is
unusually rigorous for a concurrency primitive (asserts against the imported cap, exercises
the queue+handoff on every failure path, materially proves release idempotency).

## Operator next steps
- Push the branch: `git push -u origin feat/OPS-MCP-SERVER-CAPACITY-INVESTIGATION`
- Open PR: `gh pr create --title "OPS-MCP-SERVER-CAPACITY-INVESTIGATION: per-isolate bounded provider-concurrency cap" --body-file docs/audits/OPS-MCP-SERVER-CAPACITY-INVESTIGATION-REVIEW-2026-05-30.md`
- Deploy: NONE for merge — pure server-side code; `MCP_SERVER_MAX_PROVIDER_CONCURRENCY`
  has a safe default (5). The hosted MCP server redeploys via the existing pipeline on
  merge (no `functions deploy` / `db push`). The operator MAY set the env later to retune
  without a code change.
- Post-merge SPEND smoke is a SEPARATE operator-gated gate (canary-first + tight A–G burst;
  PASS = full A–G coverage under burst + no H/I/J + no dup + no secret leak + nonblocking +
  p95<30s). PARTIAL → file `OPS-MCP-SERVER-RETRY-AFTER-PROTOCOL`.
- Post-merge worktree cleanup per roadmap-reviewer.md § "Post-merge worktree cleanup".
