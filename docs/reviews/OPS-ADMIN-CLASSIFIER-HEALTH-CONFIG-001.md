# OPS-ADMIN-CLASSIFIER-HEALTH-CONFIG-001 — Review

**Verdict:** Changes requested
**Reviewer agent run:** 2026-06-05
**Branch:** feat/ops-admin-classifier-health-config-001
**HEAD:** 56f3560 (base origin/main 8278390)
**Issue:** #509
**Gate:** GATE C (config.toml touches the deploy surface → merge = function redeploy → operator-only)

## Summary

The implementer's CODE is clean, correctly scoped, and well tested: it adds a root
`[functions.admin-classifier-health]` block (`verify_jwt = true`, mirroring
`admin-users`; the function enforces `requireAdmin` internally) plus a genuinely
useful class-guard test asserting config.toml ⇄ functions-dir registration parity.
typecheck / lint / full suite are all green; the guard's negative control fires
correctly.

**But the card's root-cause PREMISE is wrong, and that gates the verdict.** The fix
assumes the Supabase deploy ships ONLY functions that have a root
`[functions.*]` block, so a missing block = function not deployed = `FunctionsFetchError`
= `network_error`. Adversarial verification disproves this: the deploy ships **ALL**
functions under `supabase/functions/`, regardless of root config registration. The
proof is the `apply-manual-tag` natural experiment (below). Therefore **merging #509
will NOT resolve the live `network_error`** — the function was already deployed, and
the real cause is elsewhere. The PR should still merge (the block is correct
defense-in-depth and the guard test has standing value), but it must be re-scoped:
it does not close the live incident, and a follow-up is required to find the true
cause. Hence **Changes requested**, not Approve.

## Verification

| Check | Result |
| --- | --- |
| typecheck | pass (exit 0) |
| lint | pass (exit 0, `--max-warnings 0`) |
| test (full, clean run) | **648 suites passed / 648 · 19565 passed + 1 skipped / 19566 · exit 0** |
| guard test in isolation | 6/6 pass (exit 0) |
| guard negative control | **confirmed** — removing the block fails `every function directory has a root registration` with `Received: ["admin-classifier-health"]` |
| `moveMetadataLedger` flake | known pre-existing perf-timing flake (`:1210 toBeLessThan(60)`); passes 49/49 in isolation at ~1.3s; flaked only in a load-contaminated concurrent run, not the clean run |
| secret scan | clean |
| doctrine scan (truth tokens / service-role-in-client / console.log / direct `public.arguments` insert) | clean (the `public.arguments` grep hits are prose inside prior `current-status.md` comments, not SQL) |
| Migration apply | n/a — no `supabase/migrations/**` in diff |

Note: my first full-suite run reported "2 failed" because it overlapped a temporary
negative-control edit I made to config.toml; I restored the file (git diff clean) and
re-ran. The clean re-run is the authoritative result above (exit 0). The implementer's
claimed counts (648 suites / 19565 of 19566) reproduce exactly.

## Deploy-mechanism finding (the premise check) — DECISIVE

**Finding: the deploy ships ALL functions under `supabase/functions/`, NOT only
config-registered ones.** Evidence:

1. **No repo-side deploy gate.** `.github/workflows/` contains only `audit-lint.yml`
   (no deploy job). `package.json` has no deploy script. Deploy is the **Supabase
   GitHub integration** (memory `supabase-merge-autodeploy`: "on a PR merge to `main`
   … auto-applies pending migrations and **redeploys all Edge Functions**"; confirmed
   2026-05-22 — "all 6 Edge Functions redeployed").

2. **The `apply-manual-tag` natural experiment (decisive).** `apply-manual-tag`
   (shipped #134) has an `index.ts`, is client-invoked at `pointTagsApi.ts:82` via the
   identical `supabase.functions.invoke(...)` pattern, has **NO root config block** (its
   name has never appeared in `config.toml` — `git log -S` returns nothing) **and no
   function-local config.toml**. At commit `3bc375a` (2026-05-22), the live
   `supabase functions list` captured in
   `docs/testing-runs/2026-05-22-smoke-test-verification-scans.md` Scan 5 listed **7**
   deployed functions including `apply-manual-tag`, while `config.toml` at that same
   commit registered only **6** `[functions.*]` blocks — and `apply-manual-tag` was NOT
   one of them. A function with no config block was deployed live. **Config registration
   does not gate deployment.**

3. **Corroborating runtime detail.** A genuinely-undeployed function returns HTTP 404
   → supabase-js `FunctionsHttpError` (the client even anticipates this:
   `adminClassifierHealthApi.ts:116` maps a 404 to "…is not deployed yet"). The operator
   reported `network_error`, which is `FunctionsFetchError` (mapped to 503 at
   `adminClassifierHealthApi.ts:66`). `FunctionsFetchError` indicates the fetch itself
   failed — a **boot/runtime failure, a CORS rejection, or a transport error** — not a
   missing route. This is inconsistent with "function was never deployed" and consistent
   with "function is deployed but fails to respond cleanly."

**Conclusion: the `[functions.*]` blocks configure per-function settings (e.g.
`verify_jwt`); they do NOT select which functions deploy.**

## Will merging #509 actually fix the live `network_error`?

**NO.** The function was already deployed (deploy = all-functions). Adding the root
block changes nothing about whether the function exists at its URL. The block is still
*correct* — it pins `verify_jwt = true` declaratively instead of relying on the
platform default, matching `admin-users` — but it does not address the failure mode the
operator is seeing. The card's stated outcome ("admin panel showed `network_error` …
FIX: add the block") will not be met by this change.

## Real root-cause investigation (premise wrong → required by charter §3)

Static review narrows it but cannot fully pin a runtime fault without a live admin-JWT
invoke + `supabase functions list` (a deploy-state observation the operator must make).
Candidates examined:

- **CORS / preflight:** identical to the working `admin-users` (both import
  `corsHeaders` from `_shared/http.ts`; both handle `OPTIONS` → `new Response('ok',
  { headers: corsHeaders })`). **Not the cause.**
- **Client name/URL mismatch:** `adminClassifierHealthApi.ts` invokes
  `'admin-classifier-health'` (lines 75, 94), which matches the directory name exactly.
  **Not the cause.**
- **Admin gate / query shape:** `requireAdmin` is real and correct; the SELECT is
  column-explicit against `argument_machine_observation_runs` (a table the OBS-002
  review confirmed exists). A query error would return a clean 500
  `runs_read_failed`, not a `FunctionsFetchError`. **Unlikely to be the cause.**
- **Cross-tree `src/` import (LEADING CANDIDATE):** `admin-classifier-health/index.ts`
  imports from `../../../src/features/...` (lines 58–65) — **outside** the
  `supabase/functions/` tree. The working `admin-users/index.ts` imports **only** from
  `../_shared/`. If the Supabase deploy bundler does not resolve / include files outside
  `supabase/functions/`, the function fails to boot → every invoke returns a transport
  failure → `FunctionsFetchError` → `network_error`. This exactly matches the observed
  symptom and is the single structural difference between the broken function and the
  working one.
  - *Counter-evidence to weigh:* `cutover-health-monitor/index.ts` also imports
    `../../../src/features/cutoverHealthAlerts/cutoverHealthAlertModel.ts` and was
    deployed (#411/#413). But `cutover-health-monitor` is **server/cron-invoked**
    (`verify_jwt = false`, no client `functions.invoke` call site), so it is **not
    confirmed to have ever booted successfully on an invoke path** — its apparent
    "working" status is weaker evidence than it looks. The cross-tree import remains the
    most plausible boot-failure cause for `admin-classifier-health`.
  - The transitively-imported `src/` modules also use **extensionless** relative imports
    (`'./classifierHealthPlainLanguage'`, no `.ts`), which Deno's bundler can reject;
    another way the boot could fail at deploy time even if the files are reachable.

**Recommended real fix (for the follow-up):** make `admin-classifier-health`
self-contained like every other client-invoked Edge function — relocate the pure-TS
helpers it needs (`aggregateClassifierHealth`, `buildClassifierHealthCsv`,
`containsForbiddenSubstring`, the row/filter types) into `supabase/functions/_shared/`
(or vendor copies under the function dir) so the function imports nothing outside
`supabase/functions/`. Before any of that, the operator should **confirm the failure
mode empirically**: `supabase functions list` (is `admin-classifier-health` present and
what is its `updated_at`?) + an admin-JWT smoke invoke (capture the exact error class —
`FunctionsFetchError` vs `FunctionsHttpError` vs a 500 body). That single observation
decides between "boot failure" (cross-tree import) and any remaining hypothesis.

## apply-manual-tag determination

`apply-manual-tag` is **deployed and reachable** (proven live at 2026-05-22 despite no
config block), so it is **not "broken" in the deploy sense** the card assumes — which is
precisely why it serves as the premise-disproving control. It IS, however, a real
config-hygiene gap (no root block, no local config → relies on the platform-default
`verify_jwt`). Registering it is a legitimate cleanup but is **a separate concern from
this card** and correctly out of scope here. The implementer's choice to enumerate it as
the single `KNOWN_UNREGISTERED` allow-list entry (rather than silently register it) is
the right call: the guard asserts the allow-list itself (the gap can't be widened or go
stale), and a follow-up can register it with a one-line edit. **Do NOT drop the
exclusion in this PR.**

## Design conformance

- [x] All stated file-changes present (config.toml block, guard test, current-status note)
- [x] No undocumented file-changes (diff is exactly 3 files)
- [x] No migration, no Edge code change, no client change
- [ ] **Root-cause claim does NOT match reality** — the card asserts a deploy-gating
      mechanism that does not exist; the change does not produce the claimed outcome
      (live `network_error` resolution)

## Doctrine self-check

- [x] No truth/winner/loser language in user-facing strings
- [x] Score never blocks posting (panel is read-only diagnostic; acceptance gate untouched)
- [x] No service-role in client code (no client change; Edge uses service-role only after `requireAdmin`)
- [x] No direct insert into public.arguments
- [x] No AI calls in production app paths
- [x] Plain language only (no raw internal codes added to UI strings)
- [x] Supabase-edge-contract: `verify_jwt = true` + internal `requireAdmin` is the correct admin-function shape; RLS untouched; no migration

## Test coverage

- [x] New guard has positive + sanity + negative-control coverage (6 tests)
- [x] Negative control independently re-verified by the reviewer (fails on pre-fix config)
- [x] Allow-list is self-asserting (KNOWN_UNREGISTERED entry must exist on disk AND be unregistered)
- [x] `verify_jwt = true` (and not `false`) asserted for the registered block

## Changes requested (what must happen before this closes the incident)

1. **Re-scope the card / commit message + current-status note.** They currently state
   the fix resolves the live `network_error`. It does not (deploy = all-functions; the
   function was already deployed). Reword to: "registers the function declaratively +
   adds a config-parity guard; does NOT by itself resolve the observed
   `network_error`." This prevents a false "fixed" signal at merge.
2. **File the real follow-up** to investigate + fix the actual `network_error`. Leading
   hypothesis: boot failure from the cross-tree `../../../src/...` imports in
   `admin-classifier-health/index.ts` (the only structural difference vs the working
   `admin-users`). Fix = make the function self-contained under `supabase/functions/`.
   Gate the follow-up on the operator's empirical observation (functions list + admin-JWT
   smoke invoke capturing the exact error class).
3. **Keep `apply-manual-tag` in `KNOWN_UNREGISTERED`** (separate concern; do not drop
   the exclusion here).

These are documentation/scoping + follow-up items, not code defects in the diff — hence
**Changes requested**, not Block. The block + guard are safe to ship.

## Suggestions (non-blocking)

1. The guard could additionally warn when a client `functions.invoke('<name>')` call
   site exists for a function in `KNOWN_UNREGISTERED` (it would have surfaced the
   `apply-manual-tag` gap from the client side too). Optional.
2. Consider a stronger guard that flags any client-invoked function importing from
   outside `supabase/functions/` — that is the structural smell behind the real bug, and
   a lint-style assertion would catch the next occurrence at test time rather than at
   deploy.

## Operator next steps

- This branch is safe to merge (block is correct, guard is valuable) BUT merging does
  NOT close #509's live symptom. Treat merge as a partial step, not the fix.
- Before/after merge, confirm the failure mode empirically:
  - `npx supabase functions list` — is `admin-classifier-health` present? `updated_at`?
  - Admin-JWT smoke invoke of `admin-classifier-health` — capture the exact error
    class (`FunctionsFetchError` boot/transport vs `FunctionsHttpError` 404/4xx/5xx).
- Push the branch: `git push -u origin feat/ops-admin-classifier-health-config-001`
- Open PR: `gh pr create --title "OPS-ADMIN-CLASSIFIER-HEALTH-CONFIG-001: register admin-classifier-health in config.toml + parity guard (does NOT resolve live network_error — see review)" --body-file docs/reviews/OPS-ADMIN-CLASSIFIER-HEALTH-CONFIG-001.md`
- Merge = function redeploy via the Supabase GitHub integration → **GATE C operator-only** (never self-approve a merge that deploys).
- File the real-cause follow-up (item 2 above) before considering #509 resolved.
- Post-merge worktree cleanup per roadmap-reviewer.md § "Post-merge worktree cleanup (operator step)".
