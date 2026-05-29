# OPS-MCP-AUTO-TRIGGER-PARALLELIZATION — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-29
**Branch:** feat/OPS-MCP-AUTO-TRIGGER-PARALLELIZATION (4 implementer commits on design `b5a9d57`; not pushed)
**Design:** docs/designs/OPS-MCP-AUTO-TRIGGER-PARALLELIZATION.md
**Intent:** docs/designs/OPS-MCP-AUTO-TRIGGER-PARALLELIZATION-intent.md (already on `main`; correctly absent from this branch's diff)

## Summary

The card replaces the sequential `for...await` family-dispatch loop in `autoTriggerDispatcher.ts`
with bounded parallelism (limit 2) via a new pure, adapter-free worker-pool runner
(`boundedConcurrencyRunner.ts`) and a single-export constant module (`autoTriggerConcurrency.ts`).
It also fixes a genuine off-by-one "6-family" anchor in `mcp-latency-report-lib.cjs` (D5) by making
the projection's anchor family-count data-derived from `measuredPerFamilyP95.length`. Implementation
matches the design byte-for-byte in intent: the dispatcher's return type, guards, idempotency
pre-check, retry backoff, both try/catches, and the `submit-argument` call site are all unchanged;
only the loop body and a header comment changed. All three gates are green on independent re-run
(typecheck/lint exit 0; 18337 tests / 577 suites, exit 0). All 16 HALT triggers verified clean. No
secrets, no service-role in the new code, no client import of the server-only modules, no migration,
no doctrine violation. The behavioural concurrency suite genuinely observes overlap and would fail if
the runner were unbounded; the D7 `toBe(2)` discipline (the Card-1B lesson) is correctly honoured
with a single value-pin. No blocking issues; no changes requested.

## Verification (independently captured)

| Gate | Result |
|---|---|
| typecheck | **pass** — `tsc --noEmit`, exit 0 |
| lint | **pass** — `eslint . --ext .ts,.tsx --max-warnings 0`, exit 0 |
| test | **pass** — `Test Suites: 577 passed, 577 total` / `Tests: 18337 passed, 18337 total`, exit 0 (background-task reported exit code 0) |
| test delta | 18307 → 18337 (**+30**), 576 → 577 suites (**+1**) — matches implementer claim and the task brief's expected delta |
| .skip / .only / xit / fdescribe | **zero** across the test tree |
| secret scan | **clean** — only hit is the design doc quoting the existing DREG-27 guard text (a reference, not a key literal) |
| doctrine scan | **clean** — only hits are the ban-list test's own BANNED array + ordinary-English "correct" in comments |
| Migration apply | **N/A — no `.sql` file in diff** (Edge-Function + script + tests only; migration-bearing heightened review does not apply) |

## Design conformance

- [x] All design file-changes are present — exactly the 11 files the design's "File changes" section names (intent doc already on main).
- [x] No undocumented file-changes — `git diff --name-only main...HEAD` = exactly 11; no stray files; no committed `out/`/`*.log`/smoke artifacts.
- [x] Data model matches design — no new table/column/RLS/migration; `BoundedRunnerResult<T>` is an in-memory orchestration type only.
- [x] API contracts match design — `runWithBoundedConcurrency(items, limit, task)` signature, `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES = 2`, `dispatchAutoTriggerForArgument(...): Promise<AutoTriggerOutcome[]>` unchanged, `projectWallClockForFamilyCounts(..., anchorFamilyCount?)` + returned `anchorFamilyCount`, bridge exports all as specified.

## The 12 scrutiny items + migration check

1. **HALT-4 (bounded, not unbounded) — PASS.** `boundedConcurrencyRunner.ts` read in full: `workerCount = Math.min(limit, items.length)` (line 91); the lone `Promise.all(workers)` (line 96) awaits the FIXED worker array, NOT `items.map(task)`; no `Promise.all`/`Promise.allSettled` over the item list anywhere; `limit` guard (line 58) `typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1` throws `RangeError` (catches NaN, 1.5, Infinity, 0, −1 — fail-loud). Max concurrency cannot exceed `limit`.
2. **HALT-5 (submit fire-and-forget) — PASS.** `submit-argument/index.ts` is byte-IDENTICAL to main (confirmed via `git diff --quiet`); dispatcher return type is still `Promise<AutoTriggerOutcome[]>` (line 391); nothing makes submit await classification. The usability property holds.
3. **HALT-6 (no sibling abort) — PASS.** Each worker wraps `await task(...)` in its own try/catch (lines 74–82); a rejection is caught inside the worker, written as `{ status: 'rejected', reason }`, and the worker continues pulling. Rejections never propagate out to abort siblings.
4. **HALT-15 / D7 (Card-1B `toBe(2)`) — PASS.** The ONLY `toBe(2)` is the single value-pin at line 179 `expect(MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES).toBe(2)`. Line 579 is a source-string assertion (`'export const ... = 2;'`), not a concurrency assertion. Every concurrency assertion (lines 198, 207, 220, 227, 238) uses the imported symbol. No `expect(maxObserved).toBe(2)`.
5. **Test is not vacuous — PASS.** D6 #2 genuinely observes overlap: `makeTrackingTask` increments `inFlight` synchronously at task start and only decrements in the `finally` after a test-controlled deferred resolves; with limit 2, 7 held tasks, exactly 2 sit in-flight, so `maxObserved` reaches 2 (`expect(...).toBe(MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES)` checked while held). D6 #1 would fail if unbounded — an `items.map(task)` runner would leave all 7 in-flight after `flushMicrotasks()` and `tracker.inFlight` (line 198) would be 7, failing `toBeLessThanOrEqual(2)`.
6. **DREG-22 re-anchor (kill-switch ordering) — PASS, no weakening.** Third landmark moved from `for-of eligibleFamilies` to `runWithBoundedConcurrency(`, but the invariant is preserved: `enabledIdx > -1`, `eligibleIdx > enabledIdx`, `dispatchIdx > eligibleIdx`. `readEnabledFlag` (Guard 1 / `config_disabled` kill switch) still runs ONCE, before the eligible-family derivation, before any dispatch. AI-moderation kill switch still short-circuits before any classification.
7. **DREG-8 re-anchor — PASS, green.** Now asserts the surviving shape `const outcomes: AutoTriggerOutcome[] = settled.map(` + the order-preserving `eligibleFamilies[i]` fallback, without pinning the brittle `outcomes.push(` token. One-outcome-per-family / order invariant preserved.
8. **DREG-6 — PASS, guards intact + strengthened.** BOTH negative guards still present: `not.toMatch(/Promise\.all\s*\([\s\S]*?eligibleFamilies/)` and `...productionEnabledFamilies/`. Implementer ADDED two more (`Promise.allSettled` over the same lists) plus a positive runner-delegation assertion. The dispatcher-level HALT-4 guard was strengthened, not removed.
9. **Idempotency / D-G subset (HALT-7/8) — PASS.** `classifyArgumentCore.ts`, `persistenceWriter.ts`, `booleanObservationRequestBuilder.ts` (and its `MCP_SERVER_SUPPORTED_FAMILY_SOURCES`), and `familyRegistry.ts` are all byte-IDENTICAL to main. `dispatchOneFamilyIteration` / `findExistingRun` bodies are untouched (diff only references them in comments + the new runner call). D6 #6 still asserts the D/G ai_classifier-only subset through `edgeBuildBooleanObservationRequestForArgument`.
10. **D5 anchor fix — PASS.** `buildProjectionRows` computes `anchor + (familyCount - anchorCount) * perAddedFamily` (data-derived); `projectWallClockForFamilyCounts` resolves `anchorFamilyCount` = explicit → else `measuredPerFamilyP95.length` → else `CURRENT_FAMILY_COUNT`. `CURRENT_FAMILY_COUNT` kept at `6`, repurposed to a documented fallback (NOT flipped 6→7) so the worked-example arithmetic stays correct. New 7-family test asserts the N=7 row equals the anchor exactly (zero added families) and the label reads "measured 7-family". No new SQL; `scripts/ops/sql/` untouched.
11. **Doctrine ban-list — PASS.** The two new source files + the edited dispatcher carry zero verdict/heat/winner-loser language (asserted by the suite's own ban-list test, lines 593–612, and confirmed by an independent diff scan). Latency is treated as a system-performance metric only; dispatch order is registry order; concurrency is a fixed safety constant reading no engagement/popularity signal.
12. **Secrets / server-only — PASS.** New files contain no key literals and no `createServiceClient`/`SERVICE_ROLE`; the dispatcher still receives the service client by argument (`serviceClient: ReturnType<typeof createServiceClient>`); neither new module is imported by `src/` or `app/` (server-only, under `supabase/functions/`).

**Migration check — PASS (none expected, none present).** No `.sql` file in the diff.

## Doctrine self-check (all ✓)

- [x] No truth/winner/loser language in user-facing strings (no user-facing strings added; ban-list test green)
- [x] Score never blocks posting (submit is fire-and-forget; HALT-5 boundary intact)
- [x] No service-role in client code (new modules are server-only; dispatcher receives client by arg)
- [x] No direct insert into public.arguments (no DB write code added; idempotency machinery byte-equal)
- [x] No AI calls in production app paths (the change is orchestration TIMING of the existing Edge MCP path; no new AI call; not imported by src/app)
- [x] Plain language only (no raw internal codes in UI strings; none added)
- [x] Epic-specific doctrine — `cdiscourse-doctrine` §1/§3: the runner reads no engagement/heat/popularity signal; the only ordering input is the caller's input index; latency is a system-performance metric, never a gameplay/truth/heat signal. §5: the runner is pure (no Deno/fetch/console/Date.now/module-level mutable state) — honours the engine purity bar without being the engine.

## Test coverage

- [x] New public functions have unit tests — `runWithBoundedConcurrency` has bound, reach-bound, n=1, isolation, sync-throw, one-run-per-index, RangeError (5 cases), order-preservation, and empty-array tests; `MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES` has a value pin + import test.
- [x] User-facing strings have ban-list assertion — the two new source files + edited dispatcher are scanned for the verdict ban-list (lines 593–612).
- [x] Edge cases from design § "Edge cases" have tests — empty array, n=1, all-fail (via rejection), sync-throw defense-in-depth, RangeError on 0/−1/NaN/non-integer/Infinity, order-preservation, D5 zero/7-family/default/override.
- [x] Accessibility assertions — N/A (no UI card).

## Blockers

None.

## Suggestions (non-blocking)

1. The D6 #6 D/G-subset guard test and the D6 #7 fire-and-forget source-scan live in
   `mcpAutoTriggerBoundedConcurrency.test.ts` rather than co-located with the request-builder /
   submit tests. The design explicitly permits this ("Lives in this file or a co-located
   request-builder test; either is acceptable"), so this is purely a future-locatability note, not a
   defect.
2. The runner's defense-in-depth `'rejected'` branch is currently unreachable in production (because
   `dispatchOneFamilyIteration` never throws). It is correctly tested directly at the runner seam
   (sync-throw + reject-index cases), so coverage is real; no action needed. Worth a one-line code
   comment cross-referencing the dispatcher's `eligibleFamilies[i]` mapping if a future reader wonders
   why the branch exists — optional.

## Operator next steps

- Push the branch: `git push -u origin feat/OPS-MCP-AUTO-TRIGGER-PARALLELIZATION`
- Open PR: `gh pr create --title "OPS-MCP-AUTO-TRIGGER-PARALLELIZATION: sequential→bounded-parallel auto-trigger dispatch (+30 tests)" --body-file docs/audits/OPS-MCP-AUTO-TRIGGER-PARALLELIZATION-REVIEW-2026-05-29.md`
- Deploy steps (from design § "Operator steps"):
  - Runtime change (`autoTriggerDispatcher.ts` + new runner): **no manual deploy** — the Supabase
    GitHub integration auto-redeploys Edge Functions on merge to main (~30–90s). No `db push` (no
    migration). No env var (the concurrency value is a code constant).
  - Latency-report change (`mcp-latency-report-lib.cjs`): no deploy — local operator script; run
    `node scripts/ops/mcp-latency-report.mjs` when a report is wanted.
  - Post-merge smoke (operator-gated; intent brief §8): canary-first smoke (submit-nonblocking GATE
    first → 7 production runs A–G → N=5 → Phase 4b overlap diagnostic + Phase 4c 429 capture). This is
    the operator's to authorize (~35–40 gated Anthropic calls); NOT part of this card's deliverable.
- Post-merge worktree cleanup (commands in roadmap-reviewer.md § "Post-merge worktree cleanup (operator step)").

**Note for the orchestrator:** this review doc is intentionally left un-`git add`-ed for the operator.
