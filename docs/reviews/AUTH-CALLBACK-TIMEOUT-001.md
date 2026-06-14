# AUTH-CALLBACK-TIMEOUT-001 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-06-13
**Branch:** feat/AUTH-CALLBACK-TIMEOUT-001
**Issue:** #639
**Design:** no formal `docs/designs/` doc; spec is the issue + the two testing-run records that land in this diff (`docs/testing-runs/2026-06-13-auth-live-invite-seed-smoke.md` § devtest100 root cause).

## Summary
A client-only fix that bounds `consumeAuthCallback` so a stalled GoTrue call can no
longer pin `AuthCallbackScreen` on its `'checking'` state forever. A new
`raceWithTimeout` helper races each injected client call against a `setTimeout`
that resolves to a unique `Symbol` sentinel; a timeout maps to the existing
recoverable `{status:'error', reason:'network'}` outcome. All three awaited
branches (empty/`getSession`, tokens/`setSession`, code/`exchangeCodeForSession`)
are guarded; the timer is always cleared in a `finally`, so the fast path is
unchanged. `DEFAULT_CONSUME_TIMEOUT_MS = 12_000` is exported and injectable via a
new optional `timeoutMs`. +5 tests; two testing-run docs land alongside. No
Edge/migration/secret/hosted-config change. Gates re-run green. No doctrine or
security concern. Ready to PR + merge.

## Verification
- typecheck: **pass** (exit 0)
- lint: **pass** (exit 0, `--max-warnings 0`)
- test: **pass** (exit 0) — `Test Suites: 794 passed, 794 total` / `Tests: 1 skipped, 30999 passed, 31000 total`. The 1 skip is pre-existing (the diff adds no `.skip`/`.only`/`xit`). Matches the implementer's claimed counts exactly.
- targeted suite: `consumeAuthCallback.test.ts` — 31 passed (26 existing + 5 new), exit 0.
- secret scan: **clean** (full diff + src/app-only diff)
- doctrine scan: **clean** in code; one non-user-facing "winner" usage in a testing-run doc (retry-race language, not a debate verdict — see Suggestions)

## Design conformance
- [x] Fix is exactly where the root-cause doc points: `src/features/auth/consumeAuthCallback.ts`
- [x] No undocumented file-changes (1 source, 1 test, 2 testing-run docs)
- [x] No data-model / API-contract change; the only public surface delta is an additive optional `timeoutMs` param + an exported `DEFAULT_CONSUME_TIMEOUT_MS`
- [x] Call site (`AuthCallbackScreen.tsx`) unchanged — uses the default 12s; the screen already carries the `ranRef` once-guard + `cancelled` cleanup guard

## Security self-check (point 1)
- [x] **Timeout never grants access or fabricates a session.** On timeout the function returns `{status:'error', reason:'network'}` only. The screen's phase is derived purely from `outcomeToPhase(outcome)`; it never inspects session storage to decide the authed phase. A timeout → error phase ("Return to sign in"), never `needs_password`/`success`/`already_session`.
- [x] **No behind-the-back session establishment.** If the abandoned GoTrue `setSession`/`exchange` promise later settles and writes a token to storage, `AuthCallbackScreen` is already past its single run (`ranRef` once-guard) and `cancelled` is true, so `setPhase` is never called again. The abandoned promise settles into the void; the screen stays on the recoverable error and the user must re-initiate. No code path turns a settled-late call into an authed UI transition that matters here.
- [x] **No token/secret logged.** Module remains no-console / no-fetch / no-supabase-import / no-SERVICE_ROLE — all four source-scan tests pass with the new `setTimeout`/`Promise.race`/`Symbol` code in place.

## Correctness self-check (point 2)
- [x] `raceWithTimeout` resolves to the work result or the unique `CONSUME_TIMEOUT = Symbol(...)` sentinel; never rejects on the timeout leg (a rejecting `work` propagates and is caught by each branch's existing try/catch → `network`).
- [x] `res === CONSUME_TIMEOUT` narrows correctly (a `Symbol` can never collide with a `{data,error}` shape), so the subsequent `res.error` / `res.data` access is type-safe and runtime-safe.
- [x] All three awaited branches guarded: empty/`getSession` (L136), tokens/`setSession` (L150), code/`exchangeCodeForSession` (L164).
- [x] Timer always cleared on the fast path via `finally { if (timer) clearTimeout(timer) }` — no dangling handle, no false later timeout.
- [x] `DEFAULT_CONSUME_TIMEOUT_MS = 12_000` — bounded/sane; comfortably above a healthy round-trip, well under the 30s test ceiling.
- [x] Fast path semantically unchanged (existing 26 tests still green; outcomes identical).

## Tests self-check (point 3)
- [x] Hang genuinely exercised: never-settling `hung()` promise + `timeoutMs: 20` resolves to `error:network` for all three branches (observed ~28–31ms — the timer fired, not a mock shortcut).
- [x] Fast path proven: `makeClient()` + `timeoutMs: 5000` → `needs_password` in ~1ms (no false timeout).
- [x] Bounded default asserted: number, > 0, ≤ 30_000.
- [x] No `.skip` / `.only` / `xit` / `xdescribe`; existing 26 tests still pass; source-scan tests still hold.

## Doctrine self-check (point 4)
- [x] No verdict/secret tokens in new copy or code. Reason class stays the non-secret `network`.
- [x] Both testing-run docs carry no secret/token (project ref + invite UUIDs only; aliases are `kyleruff+...@gmail.com`, which is the operator's own address used as the action target, not third-party PII).
- [x] No service-role in client; no direct `public.arguments` insert; no AI call; this is auth-flow plumbing, untouched by §1–§3 scoring doctrine.

## Suggestions (non-blocking)
1. `docs/testing-runs/2026-06-13-arg-room-004-email-smoke.md` uses "winner" to mean the retry attempt that won the race to a valid token. It is not user-facing and not a debate verdict, so it is not a doctrine violation — but it does trip a literal ban-list grep. Consider "the token-bearing attempt" in a future edit to keep the scan quiet. No action required for this card.
2. The implementer's own note already flags the right defense-in-depth follow-up: a custom `global.fetch` with `AbortSignal.timeout` in `src/lib/supabase.ts` so the hung GoTrue request actually aborts (this card only bounds the consume-path *wait*; the underlying request still leaks until GC). Track separately; out of scope here.

## Operator next steps
- Push the branch: `git push -u origin feat/AUTH-CALLBACK-TIMEOUT-001`
- Open PR: `gh pr create --title "AUTH-CALLBACK-TIMEOUT-001: bound the /auth/callback consume (#639)" --body-file docs/reviews/AUTH-CALLBACK-TIMEOUT-001.md`
- Deploy: **no backend deploy** (no Edge Function / migration / secret / hosted-config change). Merge to `main` may auto-deploy the **frontend** to `dev-cdiscourse` via the Netlify integration — this is a strictly-safer change (a previously-infinite hang now falls to the existing recoverable error after 12s; no flow that worked before regresses).
- Post-merge worktree cleanup per roadmap-reviewer.md § "Post-merge worktree cleanup (operator step)".
