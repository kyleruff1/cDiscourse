# AUTH-FETCH-TIMEOUT-001 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-06-13
**Branch:** feat/AUTH-FETCH-TIMEOUT-001
**Design:** (no design doc; STANDARD client-side card, defense-in-depth for #639/#640)

## Summary
Ships a tiny, pure `makeTimeoutFetch(baseFetch, timeoutMs=30_000)` wrapper
(`src/lib/timeoutFetch.ts`) and wires it into the shared Supabase client via the
`global.fetch` option in `src/lib/supabase.ts`, guarded by
`typeof fetch !== 'undefined'`. It is defense-in-depth beneath
AUTH-CALLBACK-TIMEOUT-001's consume-layer guard: auth-js's fetch has no timeout
and no AbortSignal, so a stalled GoTrue/PostgREST/Storage/Functions request
otherwise hangs forever. The wrapper is correct, minimal, side-effect-free, and
strictly safer than the status quo. All gates green; the implementer's claimed
counts reproduce exactly. No concerns remain.

## Verification
- typecheck: pass (exit 0)
- lint: pass (exit 0, `--max-warnings 0`)
- test (targeted): pass — `__tests__/timeoutFetch.test.ts` 4/4 (exit 0)
- test (full): pass — Test Suites: 795 passed, 795 total / Tests: 1 skipped, 30998 passed, 30999 total (exit 0). +4 tests vs baseline; the 1 skip is pre-existing.
- secret scan: clean (no matches)
- doctrine scan: clean (no matches)
- service-role / ANTHROPIC scan: clean (no matches)
- console.* / .skip / .only / xit / xdescribe scan: clean (no matches)
- direct insert into public.arguments: clean (no matches)

## Correctness (per request)
- [x] Call WITHOUT `init.signal` gets a fresh `AbortController` signal + `setTimeout(abort, timeoutMs)`.
- [x] Call WITH a caller `init.signal` is passed through UNCHANGED — early `return baseFetch(input, init)`, no override. Test asserts `init.signal === controller.signal` (exact object identity).
- [x] Timer cleared in `.finally` on settle (resolve OR reject) — no leak, no spurious later abort of a reused controller (controller is per-call, so even without clear there'd be no false abort, but the clear avoids the dangling handle).
- [x] Returns a `typeof fetch`-compatible function (cast at the boundary; signature matches `(input, init?) => Promise<Response>`).
- [x] Does not swallow or alter the response/errors — it forwards `baseFetch`'s promise verbatim; only adds a signal on the no-signal path and clears the timer on settle.
- [x] Default 30s is bounded — `DEFAULT_FETCH_TIMEOUT_MS = 30_000`, test asserts `>0` and `<= 60_000`.

## Blast radius (per request)
- [x] Wraps every REST Supabase call (auth + PostgREST + storage + functions.invoke). Confirmed only `global.fetch` is overridden — there is no other `global:` config in `src/`/`app/`.
- [x] Realtime is UNAFFECTED — realtime uses WebSocket transport (`RealtimeClient`), not `global.fetch`. The override routes only fetch-based REST.
- [x] No legitimate >30s synchronous client wait exists in this app. The only invoke that can approach MCP p95 latencies (`classifyMove` → `semantic-referee`, `src/lib/edgeFunctions.ts`) explicitly treats ANY error/abort as `{ enabled: false }` → deterministic layer-1 fallback, NO user-facing error. All other invokes (CRUD, notifications, deletion request) are quick. Server-side MCP→Anthropic latency (~19–34s p95 from memory notes) is internal to the queue/auto-trigger path, not a synchronous client wait. 30s abort is strictly-safer than an unbounded hang.
- [x] `typeof fetch !== 'undefined'` guard means no load-time crash in Node/Jest or native; when fetch is absent, the `global.fetch` option is omitted and supabase-js falls back to its own fetch (the prior behavior). Acceptable.
- [x] AbortController availability: RN 0.81.5 + Hermes provide `AbortController` natively (supabase-js itself relies on it); no polyfill needed. The guard path never constructs the wrapper when fetch is absent anyway.
- [x] Placeholder client (SUPABASE_CONFIGURED=false) path unaffected — wrapper attaches regardless; calls still fail gracefully via existing config_missing handling, now with a bounded ceiling instead of a hang.

## Doctrine self-check (must all be ✓)
- [x] No truth/winner/loser language in user-facing strings — no user-facing strings touched at all.
- [x] Score never blocks posting — N/A; no scoring touched.
- [x] No service-role in client code — none; pure fetch wrapper.
- [x] No direct insert into public.arguments — none.
- [x] No AI calls in production app paths — none; the wrapper is transport-only and provider-agnostic.
- [x] Plain language only (no raw internal codes in UI strings) — N/A; no UI strings.
- [x] Edge contract skill (supabase-edge-contract): no Edge Function, no migration, no RLS, no secret handling. Client-side transport hardening only — within doctrine.

## Test coverage
- [x] New public function `makeTimeoutFetch` has unit tests — fast-pass (timer cleared, signal attached + not aborted), abort-after-timeout (base honours injected signal, rejects), caller-signal-respected (exact same object), bounded default.
- [x] Tests inject a mock base fetch — pure, no real network, no React, no Supabase. Matches test-discipline for pure-TS.
- [x] No accessibility assertions needed (no UI).
- Note (non-blocking): there is no explicit assertion that `clearTimeout` is called on the fast path (the "timer cleared / no leak" claim is asserted indirectly via no false abort). A jest fake-timers assertion on the cleared handle would make the leak guarantee explicit. Not required — the code is obviously correct and the leak window is harmless (per-call controller).

## Interaction with #640
- [x] Independent files — `src/features/auth/consumeAuthCallback.ts` (+ its test) vs `src/lib/timeoutFetch.ts` / `src/lib/supabase.ts`. No overlap, no merge conflict.
- [x] They compose: the fetch abort makes the stalled request reject (this layer); the consume guard is the backstop (that layer). Defense-in-depth, not redundancy.

## Migration apply
N/A — no files under `supabase/migrations/`. Not a migration-bearing card.

## Blockers
None.

## Suggestions (non-blocking)
1. Optionally add a fake-timers test asserting `clearTimeout` fires on the fast (resolve) path, to make the "no dangling handle" guarantee explicit rather than implied. Defer-able.
2. Optionally allow per-call override of `timeoutMs` for a future long-running invoke (none exists today). YAGNI for now.

## Operator next steps
- Push the branch: `git push -u origin feat/AUTH-FETCH-TIMEOUT-001` (already pushed; branch tracks origin).
- Open PR: `gh pr create --title "AUTH-FETCH-TIMEOUT-001: client fetch timeout guard for the Supabase client" --body-file docs/reviews/AUTH-FETCH-TIMEOUT-001.md`
- Deploy: no Edge/migration/hosted-config. Merge to main may auto-deploy the frontend bundle to dev-cdiscourse. This change is strictly-safer (replaces an unbounded hang with a bounded 30s abort + graceful fallback); no regression risk identified.
- Post-merge worktree cleanup per roadmap-reviewer.md § "Post-merge worktree cleanup (operator step)".
