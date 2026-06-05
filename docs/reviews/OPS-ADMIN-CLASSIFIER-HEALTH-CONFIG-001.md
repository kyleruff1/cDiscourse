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

---
---

# OPS-ADMIN-CLASSIFIER-HEALTH-CONFIG-001 — Review (Pass 2: the CONFIRMED real fix)

**Verdict:** Approve
**Reviewer agent run:** 2026-06-05 (pass 2)
**Branch:** feat/ops-admin-classifier-health-config-001
**HEAD:** 5a5c668 (merge-base origin/main 8278390; current origin/main b422385 is +2 commits, no overlap with this diff)
**Issue:** #509
**Gate:** GATE C — Edge-bearing. Merge = function redeploy via the Supabase GitHub
integration → **operator-gated** (the orchestrator presents at the gate; does NOT
auto-merge, never self-approves a deploy).

## Summary

Pass 1 (above) requested changes: the config-block step was correct defense-in-depth
but did NOT resolve the live `network_error`, and the leading real cause was the
cross-tree `../../../src/...` import in `admin-classifier-health/index.ts` (boot
failure → `FunctionsFetchError` → `network_error`). **This pass reviews the real fix,
which implements exactly the pass-1-recommended remedy:** make the function
Deno-self-contained by relocating its pure-TS helpers into
`supabase/functions/_shared/` and repointing the imports. Six `_shared` twins (5 under
`_shared/adminClassifierHealth/` + 1 `_shared/cutoverHealthAlertModel.ts`), both
`admin-classifier-health/index.ts` and `cutover-health-monitor/index.ts` repointed to
`../_shared/`, two new strict tests (no-cross-tree-import guard + `_shared`⇄`src`
parity), the pass-1 config-block + config-parity guard kept, client untouched.

I confirmed the boot-failure mechanism and its repair **empirically with `deno check`
(Deno 2.8.0 available)**: PRE-fix `admin-classifier-health` reports **3× `TS2307`
cannot-find-module** on the transitive extensionless `src/` imports (the boot failure)
**+ 1× `TS2352`** supabase-js `.select()` strictness note; POST-fix the 3 `TS2307` are
**gone** and only the **pre-existing `TS2352`** remains (line 184 `RUN_COLUMNS_WITH_TITLE`
join string — untouched by this diff, present in the original, typecheck-only, does not
affect the Deno runtime which deploys without `deno check`). `cutover-health-monitor`
POST-fix `deno check`s **fully clean (exit 0)**. The fix does what it claims. The diff
is correctly scoped, doctrine-clean, leak-boundary-intact, and the current-status note
honestly re-scopes the pass-1 config step. **Approve, operator-gated merge.**

## Verification (pass 2)

| Check | Result |
| --- | --- |
| typecheck (`tsc --noEmit`) | **pass (exit 0)** |
| lint (`eslint . --max-warnings 0`) | **pass (exit 0)** |
| test (full, clean run) | **650 suites passed / 650 · 19600 passed + 1 skipped / 19601 · exit 0** (was 648/19565 at pass 1 → **+2 suites / +35 tests**; matches implementer claim exactly) |
| 3 card suites in isolation | **41/41 pass (exit 0)** (parity 24 + guard 4 + config 6, plus the 7 sanity/extra cases counted in the 41) |
| no-cross-tree guard — negative control | **confirmed STRICT** — injecting a synthetic `../../../src/features/foo/bar.ts` Edge import made the guard FAIL (2 tests: "no relative import escapes" + "no src/ path import"), exit 1; removed; worktree clean |
| `deno check admin-classifier-health/index.ts` | POST = **1 error (pre-existing TS2352 only)**; PRE = 4 errors (3× TS2307 boot-failure + the same TS2352) — the 3 boot-failure errors are eliminated |
| `deno check cutover-health-monitor/index.ts` | POST = **clean, exit 0** |
| no `../../../src/` import under `supabase/functions/**` | **0 matches** (independently grep-confirmed, not just guard-asserted) |
| secret scan | **clean** — the one `Authorization:` hit is a `FORBIDDEN_OUTPUT_SUBSTRINGS` sentinel (the scrubber screens FOR it), not a leaked header; `eyJ` likewise a JWT-prefix sentinel |
| doctrine scan | **clean** — `winner/loser/liar/dishonest` hits are ban-list ENTRIES (the doctrine-enforcing mechanism) + doc prose; no service-role/ANTHROPIC in `src/` (no `src/` change); no direct `public.arguments` insert |
| Migration apply | **n/a** — no `supabase/migrations/**` in diff |

## Edge-gate criteria (the 7 checks from the charter)

1. **Deno self-containment — PASS.** No `supabase/functions/**` file imports
   `../../../src/` anymore (grep-confirmed 0 + the guard asserts it repo-wide). The new
   `__tests__/edgeFunctionsNoCrossTreeImport.test.ts` is **STRICT** (scans every `.ts`
   under `supabase/functions/`, resolves every relative specifier, asserts none escape
   the tree; plus an explicit `src/`-segment smell check; comment-stripped so the
   documented old paths in docstrings don't false-positive) and **passing**; its
   negative control fires. `deno check` confirms POST-fix resolution; the single
   `TS2352` is verified **PRE-EXISTING** (present in the original at merge-base, on a
   line untouched by this diff).
2. **No Node-only dependency leakage — PASS.** The 6 twins use only Deno-safe imports:
   extensionful `./x.ts` intra-`_shared`, no RN/Node deps, and — critically — the
   plain-language twin is **self-contained (no `gameCopy` import)**. The single
   gameCopy-overlap code (`validation_failed_after_retries`) is pinned to the exact
   gameCopy string (`'The move needs a clearer shape before it can play well.'` —
   verified against `gameCopy.ts:186`) so parity holds; the parity test asserts it.
3. **Parity — PASS.** `__tests__/adminClassifierHealthSharedParity.test.ts` is a **real
   assertion, not a stub**: `toEqual` on the aggregate verdict and `toBe` (byte-identical)
   on the CSV across **11 filter shapes**, plus plain-language agreement on every
   transport code (incl. the gameCopy-overlap pin + case-insensitive/null/unknown probes),
   frozen-family + provider-cluster constants, and the runTag heuristic + `runTagMatches`.
   The cutover twin is a verbatim copy of its `src/` original (the `src/` original has no
   imports) — `git diff --no-index` shows **zero non-comment line changes**; its existing
   src-side suite covers the logic.
4. **Leak boundary intact — PASS.** The repoint changed **only the import lines** in both
   `index.ts` files (confirmed by the diff). `RUN_COLUMNS` (no `body`, no `evidence_span`,
   no results join, never `*`), `RUN_COLUMNS_WITH_TITLE` (title-only join, runTag-gated),
   and `readFailureDetailAllowListed` (strict 7-key allow-list) are **unchanged**.
5. **Client untouched — PASS.** `git diff --name-only` for
   `src/features/adminClassifierHealth/**`, `src/features/cutoverHealthAlerts/**`, and
   `src/features/admin/**` is **empty**. The RN twins are left as-is — standard RN/Deno
   duplication, mirroring the `_shared/constitution/*` ⇄ `src/lib/constitution/*` precedent.
6. **First-pass hygiene present — PASS.** The `[functions.admin-classifier-health]` block
   (`verify_jwt = true`) and `__tests__/supabaseFunctionsConfigRegistration.test.ts`
   (self-asserting `KNOWN_UNREGISTERED` allow-list for `apply-manual-tag`) are kept.
7. **Full battery — PASS.** typecheck + lint + 650/650 suites, all exit 0 (above). No
   flake on the clean run; the pass-1 `moveMetadataLedger` perf-timing flake did not recur.

## Design conformance

The card is a hotfix; its spec is pass-1's "Recommended real fix" (lines 129-138) —
relocate the helpers into `supabase/functions/_shared/` so the function imports nothing
outside the tree. The implementer followed that prescription precisely.

- [x] All stated file-changes present (6 `_shared` twins, 2 index repoints, 2 new tests, config-block + config guard kept, current-status note)
- [x] No undocumented file-changes (diff is exactly the 14 expected files)
- [x] Data model / query shape matches design (leak-safe allow-list unchanged)
- [x] API contracts match design (the Edge response shape is byte-parity, proven by the parity test)
- [x] **Pass-1 "changes requested" addressed** — current-status note now states the config step did NOT resolve the live symptom and names this Deno-self-containment fix as the real one; the apply-manual-tag exclusion is kept

## Doctrine self-check (all ✓)

- [x] No truth/winner/loser language in user-facing strings (the verdict tokens in the diff are ban-list ENTRIES the scrubber screens for)
- [x] Score never blocks posting (read-only diagnostic panel; the deterministic engine remains the sole acceptance gate — no submit/classifier/routing behavior touched)
- [x] No service-role in client code (no client change; the Edge uses service-role only after `requireAdmin`)
- [x] No direct insert into public.arguments
- [x] No AI calls in production app paths (no provider call anywhere in the diff)
- [x] Plain language only — the self-contained plain-language twin maps transport codes; unknown codes SUPPRESSED (returns `null`), never echoed
- [x] supabase-edge-contract: every Edge function now imports only from within `supabase/functions/` (the standard self-contained shape); `verify_jwt` settings unchanged; RLS untouched; no migration

## Test coverage

- [x] New public twins have unit coverage via the parity suite (deep-equal/byte-equal against the already-tested `src/` originals across 11 filters)
- [x] Structural guard has positive + sanity (`length > 0`, two named functions present) + negative-control (reviewer-verified) coverage
- [x] Plain-language parity asserts the gameCopy-overlap pin (the one real divergence risk)
- [x] No `.skip`/`.only`; test count goes UP (+35); no `console.log` added

## Blockers

None.

## Suggestions (non-blocking)

1. The cutover twin (`_shared/cutoverHealthAlertModel.ts`) has no dedicated `_shared`⇄`src`
   parity test (unlike the adminClassifierHealth twins). It is verbatim-minus-comments
   today and the guard ensures it is the one used, so this is low-risk — but a one-line
   parity assertion (or a "twin is byte-identical-minus-header" test) would catch future
   drift between the RN copy and the Deno copy. Defer-able.
2. Pass-1 suggestion still stands: the config.toml comment block for
   `[functions.admin-classifier-health]` still asserts the (disproven) "deploy keys off
   root blocks" causation. The block itself is correct; only the explanatory comment
   overstates. Optional copy fix in a follow-up.
3. The pass-1 follow-up to register `apply-manual-tag` (separate config-hygiene gap)
   remains open and out of scope here.

## Operator next steps

- **Do NOT auto-merge.** Edge-bearing → merge = redeploy of `admin-classifier-health`
  and `cutover-health-monitor` via the Supabase GitHub integration → **GATE C
  operator-only**. The orchestrator presents at the gate after this approve.
- Push the branch: `git push -u origin feat/ops-admin-classifier-health-config-001`
- Open PR: `gh pr create --title "OPS-ADMIN-CLASSIFIER-HEALTH-CONFIG-001: Deno-self-contained admin-classifier-health (real fix for #509 network_error)" --body-file docs/reviews/OPS-ADMIN-CLASSIFIER-HEALTH-CONFIG-001.md`
- **Operator smoke (decisive, post-merge — enumerate before declaring #509 resolved):**
  1. `npx supabase functions list` — confirm `admin-classifier-health` is present with a
     **fresh `updated_at`** (proves the redeploy landed).
  2. Admin-JWT invoke of `admin-classifier-health` (e.g. the Admin → Classifier Health
     tab, or a direct `functions.invoke` with an admin token) — the panel should **load
     with real aggregate data**, no more `network_error` / `FunctionsFetchError`.
  3. Verify the **expected empty/error states**: a filter that matches nothing renders the
     counts-zero / "—" placeholders (never literal "null"/"undefined"); a non-admin token
     → 403, no token → 401 (not a fetch error).
  4. Confirm **no client secret exposure**: the network response is counts/keys/labels +
     CSV only — no `body`, no `evidence_span`, no service-role key, no admin email.
  5. Confirm the H/I/J frozen-family tripwire reads **0** (sanity — the panel observes it).
- File the pass-1 real-cause investigation as resolved by this fix; keep the
  `apply-manual-tag` registration follow-up open.
- Post-merge worktree cleanup per roadmap-reviewer.md § "Post-merge worktree cleanup
  (operator step)" (double force `-f -f`; on Windows use the `\\?\` UNC long-path
  workaround if `node_modules` trips `Filename too long`).
