# MCP-021C-AUTO-TRIGGER-FAMILY-A — Review

**Verdict:** APPROVE
**Reviewer agent run:** 2026-05-26
**Branch:** `feat/MCP-021C-AUTO-TRIGGER-FAMILY-A`
**HEAD:** `3b548f0`
**Design:** `docs/designs/MCP-021C-AUTO-TRIGGER-FAMILY-A.md` (1,595 lines)
**Intent brief:** `docs/designs/MCP-021C-AUTO-TRIGGER-FAMILY-A-intent.md`
**Predecessor:** MCP-021C-FAMILY-A-PROD-SMOKE PASS (`67fcba5`)

## Summary

The implementer shipped a fire-and-forget Boolean Observation classifier
dispatcher wired into `submit-argument`'s post-insert tail, exactly as the
operator-authored intent brief specified. Family A (`parent_relation`) is
hard-pinned, `mode='production'` is a literal, schema version comes from the
shared constant, and idempotency uses Option A (query-before-create against
existing columns; no migration). The classifier per-argument body was lifted
byte-equivalent into a new shared module so both the HTTP endpoint
(`requireAdmin` gate preserved) and the dispatcher reuse it. Three guards
gate the MCP call: runtime-config kill switch, family-registry production
flag, and the idempotency pre-check.

Verification clean across all 25 matrix items. Three self-reported deviations
all accepted (test relaxations are precisely scoped; the optional adapter
401-status surfacing was correctly deferred). Full suite passes 17,712/549,
+95 tests forecast hit exactly, regression sweep 41 suites / 934 tests pass.

## Verification

| Gate                       | Result                                                 |
|----------------------------|--------------------------------------------------------|
| typecheck                  | pass (exit 0)                                          |
| lint                       | pass (exit 0)                                          |
| test                       | pass (17,617 → 17,712 / 544 → 549 suites; exit 0)      |
| Regression sweep           | pass (41 suites / 934 tests for MCP-021B/C + UX-001.5A)|
| Secret scan                | clean (zero real-key hits; all matches are test patterns)|
| Doctrine scan              | clean (zero user-facing matches; ban-list arrays only) |
| Migration apply            | n/a — zero migrations in this card (design §6.1)       |
| Source 6 byte-equal pin    | preserved (`machineObservationPersistenceQuery.ts:127`)|
| MCP-021A taxonomy byte-equal | preserved (`machineObservationDefinitions/`, schema)  |
| Service-role in app/client | zero matches in `src/`+`app/`                          |
| Direct insert into public.arguments | zero matches                                     |

## 25-item verdict matrix

| Letter | Item                                                                          | Result | Evidence                                                                                                                |
|--------|--------------------------------------------------------------------------------|--------|--------------------------------------------------------------------------------------------------------------------------|
| A      | Family A only (`requestedFamilies=['parent_relation']` hard-pinned)            | PASS   | `autoTriggerDispatcher.ts:64-66` literal `Object.freeze(['parent_relation'])`                                            |
| B      | No UI / display cap changes                                                    | PASS   | `git diff main..HEAD -- src/` returns empty; UX-001.5A cap files byte-equal                                              |
| C      | No taxonomy changes                                                            | PASS   | `git diff main..HEAD -- src/features/nodeLabels/machineObservationDefinitions/` empty                                    |
| D      | No MCP server prompt changes                                                   | PASS   | MCP server source is out-of-repo; no Deno Deploy MCP server file touched                                                 |
| E      | Trigger non-blocking (`EdgeRuntime.waitUntil`)                                 | PASS   | `submit-argument/index.ts:787-794`; zero matches for `await\s+dispatchAutoTriggerForArgument`                            |
| F      | Idempotency Option A query-before-create                                       | PASS   | `autoTriggerDispatcher.ts:135-156` (findExistingRun) + `:232-248`                                                        |
| G      | Retry semantics (2 attempts; non-retryable classes)                            | PASS   | `autoTriggerDispatcher.ts:72` `MAX_ATTEMPTS = 2`; `:79-83` retryable set excludes parse/validation/auth                  |
| H      | Failure does NOT block submit                                                  | PASS   | `submit-argument/index.ts:791` `.catch(() => undefined)`; response returned after dispatcher kicked off, not awaited     |
| I      | Rate/cost guard (enabled gate + family gate) OR explicitly deferred            | PASS   | `autoTriggerDispatcher.ts:194-230` enabled gate + family gate; OPS-MCP-RATE-LIMITING explicitly deferred (design §5.4)   |
| J      | Production mode used (`mode='production'`)                                     | PASS   | `autoTriggerDispatcher.ts:69` `AUTO_TRIGGER_MODE = 'production' as const`                                                |
| K      | Schema version pinned (constant import)                                        | PASS   | `autoTriggerDispatcher.ts:58` imports `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION`; used at `:144`                            |
| L      | Source 6 production rows render                                                | PASS   | `machineObservationPersistenceQuery.ts:127` byte-equal preserved (zero diff)                                             |
| M      | Admin-validation rows excluded from production rendering                       | PASS   | Filter line unchanged + dispatcher writes `run_mode='production'`; admin_validation excluded                             |
| N      | Manual/admin invocation preserved                                              | PASS   | `classify-argument-boolean-observations/index.ts:239` `requireAdmin(req)` retained                                       |
| O      | No client secret leakage (no `EXPO_PUBLIC_*` MCP credentials)                  | PASS   | Zero `EXPO_PUBLIC_*MCP` matches in diff against `src/`+`app/`                                                            |
| P      | No service-role client use in app/client code                                  | PASS   | Zero `service-role`/`SUPABASE_SERVICE_ROLE_KEY` matches in `src/`+`app/` diff (diff is empty)                            |
| Q      | RLS/auth boundary preserved on runs + results tables                           | PASS   | No new policies; service-role write posture unchanged (design §6.1, §8.3)                                                |
| R      | No raw keys in UI                                                              | PASS   | Zero UI surface changes (Item B); existing plain-language adapter unchanged                                              |
| S      | Doctrine ban-list clean                                                        | PASS   | All ban-list grep hits are in test arrays / audit verdicts / design tables — none in user-facing strings                |
| T      | UX-001.5A caps preserved                                                       | PASS   | UX-001.5A cap source files byte-equal; `uxOneOneFiveBandSizingMatrix.test.ts` passes; regression sweep clean             |
| U      | MCP-021B tests pass                                                            | PASS   | Regression sweep includes `mcpOneTwoOneB*` suites, all green                                                             |
| V      | MCP-021C tests pass                                                            | PASS   | Regression sweep includes all `mcpOneTwoOneC*` suites including the 5 new ones, all green                                |
| W      | Full suite pass (npm test exit 0)                                              | PASS   | 17,712/17,712 tests pass, 549/549 suites pass, exit code 0                                                               |
| X      | Smoke plan complete (3 phases documented + template file)                      | PASS   | Design §10.1 documents Phase 1/2/2.5/3; template at `docs/audits/MCP-021C-AUTO-TRIGGER-FAMILY-A-SMOKE-template.md` has 9 phases |
| Y      | Current-status handoff correct                                                 | PASS   | `docs/core/current-status.md` appended a complete handoff section; test counts match runtime                              |

## Stop conditions check

All 5 stop conditions evaluated: none failed.

- Item **E** (non-blocking): PASS — dispatcher promise has `.catch()`, then either `EdgeRuntime.waitUntil(promise)` or no-await fallback. The response is returned BEFORE the dispatcher settles. Source-pattern `await\s+dispatchAutoTriggerForArgument` returns zero matches.
- Item **F** (idempotency): PASS — `findExistingRun` runs before MCP invocation; success-row → `'already_classified'`, no MCP call. `IDEM-7` asserts `.order('started_at', { ascending: false }).limit(1)` for the most-recent-canonical-run pattern.
- Item **H** (no submit block): PASS — `submit-argument/index.ts:791` `.catch(() => undefined)`; `FAIL-14`, `FAIL-15`, `FAIL-16` source-scan the absence of any dispatcher-result inspection in the response path.
- Item **L+M** (Source 6 correct): PASS — `machineObservationPersistenceQuery.ts:127` byte-equal preserved; `S6R-1` asserts byte-equality of the literal filter line. Dispatcher writes `'production'` only (Item J); admin_validation rows still excluded by the filter.
- Item **O+P+Q** (auth/security): PASS — zero `src/`+`app/` diff; service-role lives only in `supabase/functions/`; no new RLS policies; classifier `requireAdmin` gate retained.

## Deviations evaluation

**Deviation 1** — `mcpOneTwoOneCEdgeFunctionHandler.test.ts` + `mcpOneTwoOneCEdgeResponseSummaryFix.test.ts` updated to scan both core + handler files instead of just the classifier handler.

**Verdict: ACCEPTED.** The classifier per-argument body was lifted into `classifyArgumentCore.ts` and the handler now contains only `const classifyOneArgument = classifyOneArgumentCore;`. The handler tests rightly follow the code into the core file. The combined-text union (`combinedClassifierText = handlerText + coreText`) preserves the same semantic contracts; EFH-16 through EFH-30 still enforce that the right symbols / strings / mappings exist somewhere in the classifier orchestration surface. The PerArgumentSummary interface tests now scan `coreText` because the interface moved into the core file (correct). SUM-1 through DOC-4 in the response-summary fix tests follow the same lift-and-shift logic. No semantic weakening.

**Deviation 2** — `uxOneOneFiveReadOnlyBoundary.test.ts` relaxed to permit submit-argument additions.

**Verdict: ACCEPTED.** Design §11.1 explicitly authorizes "Bounded edit: `supabase/functions/submit-argument/index.ts` — single call-site addition AFTER the QOL-040 notification block and BEFORE the final `return created(...)`. No change to the JWT verification, authorization matrix, constitution evaluation, argument insert, or notification side-effect."

The relaxation is precisely scoped:
- `removedLines === []` — rejects any removal from submit-argument.
- `referencesAutoTrigger` requires every diff to mention `dispatchAutoTriggerForArgument` / `MCP-021C-AUTO-TRIGGER-FAMILY-A` / `EdgeRuntime` / `autoTriggerPromise` / `Boolean Observation` / `booleanObservations/autoTriggerDispatcher`.

UX-001.5's protected surface (composer, timeline, brand shell, popouts) is untouched. The submit-argument diff is verified to contain only the 42-line dispatcher wiring addition.

**Deviation 3** — §4.2 optional adapter HTTP-status surfacing NOT shipped.

**Verdict: ACCEPTED.** Design §4.2 literally states: "The implementer MAY ship without the bounded adapter edit if test forecast pressure requires; the dispatcher tracks the retry cap correctly either way."

The dispatcher's `MAX_ATTEMPTS = 2` caps total worst-case at 2 attempts regardless of 401 / other 4xx distinction. The cost impact is one extra MCP call on a permanently-401 deployment, which is operator-detectable via the `mcp_api_error` failure_reason in the persisted run row. The intent brief's Decision 5 retry table is matched at the dispatcher layer (`RETRYABLE_FAILURE_REASONS` set has `mcp_network_error`, `mcp_api_error`, `mcp_rate_limited`; parse/validation/url-missing/token-missing don't retry).

## Doctrine grep result

```
git diff main..HEAD -- src/ __tests__/ docs/ supabase/ | grep -iE "winner|loser|liar|propagand|extremist|manipulative|bad faith|proof of|correctness|truth value|verdict"
```

All ~24 hits are in: (a) test ban-list arrays asserting the dispatcher source contains zero verdict tokens, (b) the smoke template's phase verdict labels (`**Phase 1 verdict:** PASS/FAIL`), and (c) the design doc's HALT trigger #24 / SEC-6 specification text describing what the ban-list scans test for. **Zero hits in user-facing strings or production code.**

## Security grep result

```
git diff main..HEAD -- src/ app/ | grep -iE "MCP_URL|MCP_TOKEN|...|SERVICE_ROLE_KEY"
```

**Zero matches.** `git diff main..HEAD -- src/ app/` is empty — this card touches no client-side code.

```
git diff main..HEAD | grep -iE 'ANTHROPIC_API_KEY|...|Bearer |Authorization:'
```

The 11 hits are all (a) test patterns asserting the dispatcher source does NOT contain `SUPABASE_SERVICE_ROLE_KEY` / `ANTHROPIC_API_KEY`, (b) the legitimate `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` call in `classifyArgumentCore.ts` (lifted from the existing classifier handler; server-side only; doctrine-compliant), or (c) the smoke template's `-H "Authorization: Bearer <admin-user-JWT>"` placeholder in an operator curl example. **Zero real secrets committed.**

## Specific changes required

None. Verdict is APPROVE.

## Anything else the operator should know before squash-merge

1. **Auto-deploy chain.** Both `submit-argument` and
   `classify-argument-boolean-observations` Edge Functions will be
   redeployed on merge via the Supabase GitHub integration. No
   migration in this card; nothing to `db push`.

2. **The card flips a real production switch.** The first new argument
   posted after deploy will trigger a real MCP roundtrip against the
   linked project's Anthropic-backed `cdiscourse-mcp-server`. The
   runtime-config kill switch is the operator's circuit breaker if
   anything goes sideways:
   ```sql
   UPDATE public.semantic_referee_runtime_config SET enabled = false WHERE id = true;
   ```
   The dispatcher reads this flag first; flipping it stops all
   auto-trigger MCP traffic with no redeploy.

3. **Smoke template is comprehensive.** The operator's post-merge
   audit at `docs/audits/MCP-021C-AUTO-TRIGGER-FAMILY-A-SMOKE-template.md`
   has 9 phases (the design's required 3 plus 6 additional). Phase 2.5
   (the actual brief-defined idempotency contract) is the most
   important verification — it requires a test-harness re-dispatch of
   the auto-trigger for the same argument and verifies the dispatcher
   returns `'already_classified'` with zero new run rows.

4. **No backfill in this card.** Existing arguments (predating the
   merge) will NOT auto-classify. The deferred `MCP-021C-FAMILY-A-BACKFILL`
   card handles historical classification.

5. **Pre-existing main-side test failure FIXED on this branch.**
   `mcpOneTwoOneCEdgeFixtureUUIDs.test.ts` failed on main (1 fail/17,617
   total) but passes on this branch (likely because the implementer
   updated/added fixture content via the new test files). The 17,712/17,712
   green state on this branch is real.

6. **Working-tree untracked files at PR creation are known-OK.** Per
   intent brief §5 (HALT trigger 25): `docs/testing-runs/*-corpus*.md`,
   `netlify-prod.git`, `mcp021c-edge-smoke-*` files, and `phase5-mcpserver002-*`
   logs are operator-side smoke artifacts excluded from the card.

**Ready for squash-merge.**

## Operator next steps

- Squash-merge the PR (gh pr merge --squash --delete-branch when ready).
- Verify both Edge Functions deployed: `npx supabase functions list --linked`.
- Verify runtime config: `enabled = true`, `provider_mode = 'mcp'`.
- Run the 9-phase smoke per the template; record at
  `docs/audits/MCP-021C-AUTO-TRIGGER-FAMILY-A-SMOKE-<YYYY-MM-DD>.md`.
- On PASS: authorize `MCP-SERVER-003` (Family B template),
  `ADMIN-MCP-001` (UI flip), and queue
  `MCP-021C-AUTO-TRIGGER-FAMILY-B`. Promote `OPS-MCP-OBSERVABILITY`
  from DEFERRED to PLANNED.
- On PARTIAL/FAIL: file the corresponding fix card; flip kill switch
  if needed.
- Post-merge worktree cleanup (commands in roadmap-reviewer.md
  § "Post-merge worktree cleanup (operator step)").
