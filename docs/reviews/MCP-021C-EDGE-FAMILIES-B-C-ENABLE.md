# MCP-021C-EDGE-FAMILIES-B-C-ENABLE — Review

**Verdict:** approve

**Reviewer agent run:** 2026-05-27
**Branch:** feat/MCP-021C-EDGE-FAMILIES-B-C-ENABLE
**HEAD:** 3db8cb4 (4 implementation commits on top of designer 7bf0148)
**Design:** docs/designs/MCP-021C-EDGE-FAMILIES-B-C-ENABLE.md (Stage 2B Option A approved)
**Intent brief:** docs/designs/MCP-021C-EDGE-FAMILIES-B-C-ENABLE-intent.md

---

## Summary

The dispatcher refactor lands cleanly. `familyRegistry.ts` flips exactly the two requested booleans (B + C `productionEnabled: false → true`) with byte-equal preservation of Family A's `productionEnabled: true` and D–J's `productionEnabled: false`. `autoTriggerDispatcher.ts` is the largest change: it removes the hard-coded `AUTO_TRIGGER_FAMILIES = ['parent_relation']` constant, imports `productionEnabledFamilies` from the registry, parameterizes `findExistingRun` with a per-family argument, and wraps the dispatch in a sequential `for-of` loop over eligible families with each iteration isolated by its own try/catch via the new `dispatchOneFamilyIteration` helper. Family A's behavior is byte-equal preserved at iteration #1 because registry iteration order is A→J. The submit-argument call site is unchanged, the MCP server tree is byte-equal, `classifyArgumentCore.ts` is byte-equal, and the Source 6 filter at `machineObservationPersistenceQuery.ts:127` is byte-equal. The +43 test forecast lands inside the operator's +30 to +45 band. All eight Stage 2B "preferred implementation shape" guardrails are honored.

## Verification

| Check | Result |
|---|---|
| Full diff vs main | 14 files changed, 1646 insertions, 196 deletions |
| `npm run typecheck` | pass (EXIT 0) |
| `npm run lint` | pass (EXIT 0) |
| `npm run test` | 17881 → 17924 / 562 → 563 suites (+43 tests, +1 suite, EXIT 0) |
| `cd mcp-server && deno test` | 467 / 467 passing (byte-equal preserved, EXIT 0) |
| Targeted MCP pattern (intent brief §10) | 49 suites / 964 tests pass (EXIT 0) |
| `mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts` | 34 / 34 tests pass |
| Secret scan | clean (only test ban-list assertions and doctrine prose hit) |
| Doctrine scan | clean (only test ban-list assertions and doctrine prose hit) |
| Service-role / direct-insert scan | clean (only test ban-list negative assertions) |
| Working tree (HALT trigger 18) | 10 known operator-territory files; no card-territory untracked |

## Top 3 things

1. **Family A byte-equal preservation is provably correct (good).** `autoTriggerDispatcher.ts:431` runs `for (const family of eligibleFamilies)` where `eligibleFamilies = productionEnabledFamilies()` (line 403). The registry iteration order at `familyRegistry.ts:68-119` places `parent_relation` first (line 70), so Family A is iteration #1. Per-iteration logic at `autoTriggerDispatcher.ts:224-356` (the `dispatchOneFamilyIteration` helper) re-uses the same `findExistingRun → classifyOneArgumentCore → emitAutoTriggerLog` chain that previously lived inline, and `findExistingRun` (line 174-196) keeps the same query posture (`schema_version`, `run_mode='production'`, `provider_key`, `started_at desc limit 1`) — the only change is `.contains('requested_families', [family])` is now parameterized (line 187) instead of hard-coded. DREG-33/DREG-34 + the existing TRG-1..TRG-25 wiring tests are the binding gate.

2. **Per-family idempotency scope is the correct posture (good).** `findExistingRun` at `autoTriggerDispatcher.ts:174` takes `family: MachineObservationFamily` as its second parameter and uses it in `.contains('requested_families', [family])` at line 187. This means a successful Family A run for argument X does NOT make Family B's first run for argument X skip — each family has its own idempotency scope. No new uniqueness index, no `forceRerun`, no new idempotency mechanism — Stage 2B item #7 honored. Tests IDEM-6 (updated) + DREG-11/12/13/14/15 cover this.

3. **Return-type evolution is forward-compatible (good).** `dispatchAutoTriggerForArgument` now returns `Promise<AutoTriggerOutcome[]>` (line 376) instead of `Promise<AutoTriggerOutcome>`. The submit-argument call site at `supabase/functions/submit-argument/index.ts:787-794` does not inspect the return value — it only `.catch(() => undefined)` and passes the promise to `EdgeRuntime.waitUntil`. Item O (no `submit-argument` logic change) is preserved. DREG-19/20/21 cover this.

## 24-item verdict matrix

### Scope verification (10 items)

| # | Item | Result | Anchor |
|---|---|---|---|
| A | `familyRegistry.ts`: `disagreement_axis.productionEnabled = true` | PASS | familyRegistry.ts:76 |
| B | `familyRegistry.ts`: `misunderstanding_repair.productionEnabled = true` | PASS | familyRegistry.ts:81 |
| C | `familyRegistry.ts`: `parent_relation.productionEnabled = true` UNCHANGED | PASS | familyRegistry.ts:71 (line 71 not in the diff hunk; Family A entry byte-equal) |
| D | `familyRegistry.ts`: D-J entries `productionEnabled = false` UNCHANGED | PASS | familyRegistry.ts:86,91,96,101,106,111,116 (D–J entries not in the diff hunk; byte-equal) |
| E | `autoTriggerDispatcher.ts`: hardcoded `AUTO_TRIGGER_FAMILIES = ['parent_relation']` REMOVED | PASS | Verified by Grep: `AUTO_TRIGGER_FAMILIES` literal does not appear in autoTriggerDispatcher.ts (DREG-2 asserts) |
| F | `autoTriggerDispatcher.ts`: derives from `productionEnabledFamilies()` | PASS | autoTriggerDispatcher.ts:87 (import), 403 (call site) |
| G | `autoTriggerDispatcher.ts`: per-family idempotency check | PASS | autoTriggerDispatcher.ts:174-196 (`findExistingRun(argumentId, family, serviceClient)` + `.contains('requested_families', [family])` at line 187) |
| H | `autoTriggerDispatcher.ts`: one-run-per-family sequential loop | PASS | autoTriggerDispatcher.ts:431-438 (`for (const family of eligibleFamilies)` + `outcomes.push(iterationOutcome)`); DREG-5/6 assert sequential, not Promise.all |
| I | `classifyArgumentCore.ts` byte-equal preserved | PASS | `git diff --stat 5a88f7c..HEAD -- classifyArgumentCore.ts` → empty |
| J | `mcp-server/**` byte-equal preserved | PASS | `git diff --stat 5a88f7c..HEAD -- mcp-server/` → empty |

### Locked-file integrity (6 items)

| # | Item | Result | Anchor |
|---|---|---|---|
| K | No `supabase/migrations/**` file added | PASS | `git diff --stat 5a88f7c..HEAD -- supabase/migrations/` → empty |
| L | `src/features/nodeLabels/machineObservationPersistenceQuery.ts:127` byte-equal preserved (Source 6 filter) | PASS | Line 127 still reads `.eq('argument_machine_observation_runs.run_mode', 'production')`; diff stat empty |
| M | No `src/features/nodeLabels/machineObservationDefinitions/**` change (taxonomy locked) | PASS | `src/features/nodeLabels/` diff stat empty |
| N | No `mcp-server/lib/family*Prompt.ts` change (prompts locked) | PASS | `mcp-server/` diff stat empty (covered by item J) |
| O | No `supabase/functions/submit-argument/index.ts` logic change | PASS | `git diff --stat 5a88f7c..HEAD -- supabase/functions/submit-argument/` → empty |
| P | No new uniqueness index / `forceRerun` / new idempotency mechanism | PASS | Grep for `forceRerun\|UNIQUE\|unique index` in autoTriggerDispatcher.ts → no matches |

### Test coverage (5 items)

| # | Item | Result | Anchor |
|---|---|---|---|
| Q | Test forecast: +43 (within +30–45 operator-approved band) | PASS | 17881 → 17924 (+43, +1 suite) confirmed by full `npm run test` |
| R | Registry test asserts production-enabled = exactly [A, B, C] | PASS | mcpOneTwoOneCEdgeFamilyRegistry.test.ts FR-5 (lines 64-74) + FR-6 (lines 76-83) |
| S | Dispatcher test asserts D-J not included | PASS | mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts DREG-31 (lines 333-352) + mcpOneTwoOneCEdgeFamilyRegistry.test.ts FR-7 (lines 86-96) |
| T | Auto-trigger test asserts new argument creates production runs for A+B+C | PASS | mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts DREG-29 + DREG-5/7/8 (loop semantics) |
| U | Family A behavior preserved test exists | PASS | mcpOneTwoOneCAutoTriggerFamilyA.test.ts (25 tests still pass, all TRG-* updated to assert registry-derived semantics that include Family A as iteration #1) + DREG-33/34 (Family A first in iteration order) |

### Doctrine + safety (3 items)

| # | Item | Result | Anchor |
|---|---|---|---|
| V | No verdict tokens in any new code or test labels | PASS | DREG-24 ban-list scan over dispatcher source passes; `git diff | grep` for verdict tokens hits only test ban-list assertions and doctrine prose |
| W | No client secret / no raw body / no evidence_span in new output paths | PASS | DREG-27 asserts no `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `EXPO_PUBLIC_`, `createServiceClient(`; `emitAutoTriggerLog` emits structured `argument_id`/`family`/`outcome`/`skip_reason`/`failure_reason`/`attempt_number`/`latency_ms`/`run_id` only — no payload bodies |
| X | No `console.log` of bearer tokens or service-role references | PASS | DREG-25 asserts dispatcher source contains no `console.log` (only `emitAutoTriggerLog`); confirmed via Grep |

**Matrix result: 24 / 24 PASS, 0 FAIL, 0 NOT-APPLICABLE.** No STOP condition fires.

## Operator Stage 2B binding decision compliance scan

The 8 binding items from "Preferred implementation shape":

| # | Binding requirement | Status | Anchor |
|---|---|---|---|
| 1 | Flip `productionEnabled` for `disagreement_axis` and `misunderstanding_repair` | DONE | familyRegistry.ts:76, 81 |
| 2 | Refactor `autoTriggerDispatcher.ts` to derive from registry | DONE | autoTriggerDispatcher.ts:87 (import), 403 (`const eligibleFamilies = productionEnabledFamilies();`) |
| 3 | One-run-per-family loop (sequential, not Promise.all) | DONE | autoTriggerDispatcher.ts:431 (sequential `for-of`); DREG-5/6 enforce non-`Promise.all` |
| 4 | Preserve Family A behavior | DONE | Family A is iteration #1 (registry order A→J); `findExistingRun` posture unchanged except per-family parameterization; same retry + log shape; TRG-1..TRG-25 (25 tests) still pass |
| 5 | Preserve admin_validation behavior | DONE | autoTriggerDispatcher.ts hardcodes `AUTO_TRIGGER_MODE = 'production'` at line 94; never writes admin_validation rows. DREG-26 asserts dispatcher source contains no `'admin_validation'` literal. Classify Edge Function HTTP endpoint admin gate unchanged (submit-argument byte-equal). Tests in mcpOneTwoOneCEdgeAdminValidationMode.test.ts pass with updated AVM-10/13 + AVM-11/12 unchanged. |
| 6 | Preserve unsupported-family rejection for D-J | DONE | Tests FR-26 + FR-28 + DREG-31 + FA-13 + RB-12 + AVM-11/12 all assert D-J are filtered out at the request-builder + registry layer |
| 7 | Preserve current idempotency behavior; NO new uniqueness index, NO `forceRerun`, NO idempotency card work | DONE | No new index, no `forceRerun`, no new mechanism (verified by Grep). `findExistingRun` query keeps the same `(argument_id, schema_version, run_mode='production', provider_key)` posture + adds the per-family `.contains` parameterization (which is the existing posture from before, just parameterized) |
| 8 | No schema migration, no UI, no MCP server, no taxonomy, no Source 6 rendering policy | DONE | All five locked-file diffs empty (`supabase/migrations/`, UI under `src/`, `mcp-server/`, taxonomy under `src/features/nodeLabels/`, Source 6 filter at line 127) |

All 8 binding items honored.

## Doctrine deep-check findings

**1. Family A byte-equal preservation.** Verified end-to-end. The dispatcher refactor hoisted the per-family-loop body into `dispatchOneFamilyIteration` (autoTriggerDispatcher.ts:224-356). When the loop iterates once with `family='parent_relation'` (the first eligible family at iteration #1), the body runs the same `findExistingRun → classifyOneArgumentCore → emitAutoTriggerLog` chain that lived inline before, against the same `serviceClient`, the same `MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION`, the same `MAX_ATTEMPTS=2`, the same `RETRYABLE_FAILURE_REASONS`, the same `RETRY_BACKOFF_MS=[2000, 8000]`, and the same `argument_not_found` skip branch. The only change is that the idempotency `.contains` call (line 187) is parameterized with the iteration's `family` value, which evaluates to `'parent_relation'` at iteration #1 — byte-equal to the previous hard-coded literal. Family A's test surface (mcpOneTwoOneCAutoTriggerFamilyA.test.ts, 25 tests) continues to pass with surgical TRG-11/18/19 updates that assert the registry-derived shape while preserving the per-family behavior. DREG-33/34 are the cross-check that Family A stays first.

**2. mcp-server byte-equal verification.** `git diff --stat 5a88f7c..HEAD -- mcp-server/` returned empty. `cd mcp-server && deno test --allow-net --allow-env --allow-read` reported 467/467 passing. The MCP server's single-family-per-call resolution at `mcp-server/tools/classifyArgumentBooleanObservations.ts:297-305` continues to take `requestedFamilies[0]` as the resolved family, and the Edge dispatcher honors this by sending single-element `[family]` arrays per iteration (DREG-7). HALT trigger 10 + the operator's binding #10 are clear.

**3. classifyArgumentCore.ts byte-equal verification.** `git diff --stat 5a88f7c..HEAD -- supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts` returned empty. The pre-existing core already accepts `ReadonlyArray<MachineObservationFamily>`, runs `filterFamiliesForMode`, builds ONE MCP request, and persists ONE run row per invocation. The dispatcher achieves the one-run-per-family pattern by calling `classifyOneArgumentCore` once per eligible family with a `[family]` single-element array — exactly as the Stage 2B `classifyArgumentCore.ts decision` section of the design predicted. DREG-32 is the binding gate.

**4. Source 6 filter byte-equal verification.** `machineObservationPersistenceQuery.ts:127` still reads `.eq('argument_machine_observation_runs.run_mode', 'production')` verbatim. The filter operates on `run_mode`, not on `family`, so the new B + C production rows pass through it automatically. Admin-validation rows for B + C continue to be filtered out at this same layer. HALT trigger 5 boundary clear; binding #12 honored.

**5. Idempotency posture preserved.** The per-family idempotency check at autoTriggerDispatcher.ts:174-196 keeps the same `argument_machine_observation_runs` query shape (`schema_version`, `run_mode='production'`, `provider_key`, `started_at desc limit 1`) and only parameterizes the `requested_families` `.contains` argument with the per-iteration `family` value. No new uniqueness constraint is added (no `UNIQUE` / `unique index` / `CREATE INDEX` in the dispatcher), no `forceRerun` parameter is introduced (Grep confirmed), and no new idempotency mechanism is invoked. This is precisely the existing posture extended per-family, exactly as Stage 2B binding #7 requires. The race-tolerance documentation at autoTriggerDispatcher.ts:64-72 spells out the rationale (raw_keys are pairwise disjoint across families; Source 6 dedupes by `raw_key` per argument; benign double-writes can occur and are absorbed by Source 6's dedup, not by a new uniqueness gate).

**6. Test surface integrity.** Updated assertion shapes verified:
- **FR-5/6/7/15/16** (mcpOneTwoOneCEdgeFamilyRegistry.test.ts): production-enabled allowlist extended from `[parent_relation]` to `[parent_relation, disagreement_axis, misunderstanding_repair]`; the non-production family list contracts symmetrically. Behavior-preserving.
- **TRG-11/18/19** (mcpOneTwoOneCAutoTriggerFamilyA.test.ts): TRG-11 (was "hard-codes requestedFamilies = ['parent_relation']") becomes "derives requestedFamilies from productionEnabledFamilies()". TRG-18 (was "dispatcher source contains 'parent_relation' literal") becomes "dispatcher source contains NO family literals at all" — strengthened. TRG-19 (was "passes AUTO_TRIGGER_FAMILIES const") becomes "loops over eligibleFamilies with [family] single-element array + AUTO_TRIGGER_MODE preserved + AUTO_TRIGGER_FAMILIES removed". All three updates are behavior-preserving + tightening.
- **IDEM-6/12** (mcpOneTwoOneCAutoTriggerIdempotency.test.ts): IDEM-6 (was ".contains contains 'parent_relation' literal") becomes ".contains contains [family] parameter; literal must NOT appear". IDEM-12 (was "findExistingRun(argumentId, serviceClient)") becomes "findExistingRun(argumentId, family, serviceClient)". Per-family-scoped extension of the same idempotency contract.
- **FAIL-13** (mcpOneTwoOneCAutoTriggerFailureMode.test.ts): The defensive zero-length branch's upstream helper changed from `filterFamiliesForMode` to `productionEnabledFamilies` — behavior is identical (`family_not_enabled` skip outcome still fires when the eligible-family list is empty); only the helper name changes.
- **FE-1..4** (mcpOneTwoOneCEdgeFamilyEnablement.test.ts): production-enabled count moves from 1 to 3; admin_validation enablement (FE-5/6) byte-equal preserved.
- **AVM-10/13** (mcpOneTwoOneCEdgeAdminValidationMode.test.ts): AVM-10 (was "disagreement_axis drops in production") becomes "disagreement_axis kept in production". AVM-11/12 (evidence_source_chain, sensitive_composer) byte-equal — D-J still drop.
- **RB-10/11** (mcpOneTwoOneCEdgeRequestBuilder.test.ts): same shape as AVM-10/13; B kept, D-J still drop; raw_key count updated from "0 / 16" to "14 / 30".
- **INT-12** (mcpOneTwoOneCEdgeIntegrationFlow.test.ts): integration flow assertion extended from "production rejects non-Family-A" to "production accepts A+B+C, rejects D-J" — B's 14 keys now expected in the captured request.
- **FA-12/14** (mcpOneTwoOneCEdgeFamilyARequest.test.ts): FA-12 (was "request does NOT contain Family B keys") becomes "request CONTAINS Family B keys when B is requested". FA-13 (Family J) byte-equal. FA-14 (allowed family set) extends from `{parent_relation}` to `{parent_relation, disagreement_axis}`; D explicitly forbidden via `not.toBe('evidence_source_chain')`.

Every updated test is either behavior-preserving (same contract, extended allowlist) or behavior-strengthening (TRG-18 forbids ALL family literals, not just non-A literals). Zero updates regress an existing assertion.

**7. New test file shape.** mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts adds 34 DREG-* tests covering:
- Registry-derivation imports + runtime call shape (DREG-1/2/3/4)
- Sequential for-of loop, no Promise.all, single-element [family] array, per-iteration try/catch isolation (DREG-5/6/7/8/9/10)
- Per-family idempotency signature + .contains parameter + run_mode + schema_version preservation (DREG-11/12/13/14/15)
- Family tag in every per-family emitAutoTriggerLog + AutoTriggerOutcome.family optional field + discriminator preserved (DREG-16/17/18)
- Submit-argument call-site preservation (DREG-19/20/21)
- Guard 1 once-per-dispatch (DREG-22/23)
- Doctrine ban-list scan + no console.log + no admin_validation literal + no service-role / Anthropic / EXPO_PUBLIC + no direct persistRun call (DREG-24/25/26/27/28)
- Registry alignment to [A, B, C] + D–J stays false + classifyArgumentCore.ts NOT modified (DREG-29/30/31/32)
- Family A first in iteration order (DREG-33/34)

All 34 tests pass. The file follows the established `fs.readFileSync + regex/substring` source-scan pattern from mcpOneTwoOneCAutoTriggerFamilyA.test.ts — Jest-compatible (no Deno import attempt). No new dependencies, no new fixture pattern. The tests verify everything the matrix items require.

**8. Working tree pre-PR.** `git status --porcelain` shows exactly 10 untracked files, all in operator territory:
- `docs/testing-runs/2026-05-25-ai-driven-bot-corpus-annotated.md`
- `docs/testing-runs/2026-05-25-ai-driven-bot-corpus.md`
- `docs/testing-runs/2026-05-25-bot-engagement-corpus.md`
- `docs/testing-runs/2026-05-25-bot-stress-summary.md`
- `mcp021c-edge-smoke-request.json`
- `mcp021c-edge-smoke-response.json`
- `mcp021c-edge-smoke-runids.txt`
- `netlify-prod.git`
- `phase5-mcpserver002-hosted-smoke.log`
- `phase5-mcpserver002-validator.log`

No card-territory untracked files. HALT trigger 18 clear.

## Specific actionable comments

None. The implementation is approval-ready.

## Optional polish suggestions (post-merge; non-blocking)

1. **DREG count comment in test file header.** The new test file's header at `__tests__/mcpOneTwoOneCAutoTriggerFamiliesABCRegistryDerived.test.ts:15` says `Forecast: ~25 tests (DREG-1 through DREG-25)` but the file actually carries 34 tests (DREG-1 through DREG-34). The forecast comment is the only artifact that under-counts; the actual file is correct. A future cleanup card could update the comment to `Forecast: 34 tests (DREG-1 through DREG-34)`. This is cosmetic; the test count itself is accurate.

2. **AutoTriggerOutcome JSDoc note on multi-family return.** The interface comment at `autoTriggerDispatcher.ts:118-131` describes a per-family outcome, and the function return type (`Promise<AutoTriggerOutcome[]>`) is correct. A short note in the function-level docstring at line 359-371 that the array length equals `productionEnabledFamilies().length` in the happy path (with edge cases for `config_disabled` → 1-element and outer-catch → 1-element with no family tag) would help future readers reason about the contract. Optional; the current docstring is accurate.

3. **Smoke verification operator naming convention.** The intent brief §11 names the smoke audit file `docs/audits/MCP-021C-EDGE-FAMILIES-B-C-ENABLE-SMOKE-2026-05-27.md`. The operator should ensure the date stamp matches the actual smoke run date if the merge slips past the brief's authoring date. No code change needed.

## Recommendation to operator

**PR title:** `MCP-021C-EDGE-FAMILIES-B-C-ENABLE: enable Families B + C in production with registry-derived auto-trigger`

**PR body summary:**

```
Card 1 of the MCP-021C combined launch sequence — production-mode flip
for Families B (disagreement_axis, 14 keys) and C
(misunderstanding_repair, 17 keys) + registry-derived auto-trigger
dispatcher refactor.

Stage 2B Option A approved by operator. Scope expanded from intent
brief's "2-boolean flip" to "2-boolean flip + dispatcher refactor"
to make production auto-trigger derive its family list from the
Edge family registry (so future family enablement is a 1-boolean
flip without additional code change).

Changes:
- familyRegistry.ts: disagreement_axis + misunderstanding_repair
  productionEnabled flipped to true. Family A unchanged.
  D-J unchanged (admin-validation only).
- autoTriggerDispatcher.ts: AUTO_TRIGGER_FAMILIES const removed.
  productionEnabledFamilies() imported. Sequential for-of loop over
  eligible families. findExistingRun parameterized by family.
  New dispatchOneFamilyIteration helper isolates per-family failure.
  AutoTriggerOutcome.family optional field added. Return type
  evolved to AutoTriggerOutcome[]. Family A behavior byte-equal
  preserved at iteration #1 (registry iteration order A→J).

Verification: 17924 tests / 563 suites pass (+43 / +1).
mcp-server Deno 467 / 467 passing (byte-equal). typecheck + lint
clean. classifyArgumentCore.ts byte-equal. mcp-server/** byte-equal.
src/features/nodeLabels/** byte-equal. submit-argument byte-equal.
supabase/migrations/** unchanged.

Doctrine: no verdict tokens, no service-role in client, no
Anthropic in app, no console.log, no admin_validation in dispatcher,
no client secret exposure, no direct insert into public.arguments.

Next step (operator):
1. Push the branch: git push -u origin feat/MCP-021C-EDGE-FAMILIES-B-C-ENABLE
2. Open PR (use this review body)
3. Squash-merge to main
4. Supabase GitHub integration auto-deploys submit-argument +
   classify-argument-boolean-observations (~30-90s)
5. Run smoke verification per intent brief §11 (5-phase):
   - Phase 1: pre-flight (HEAD at merge SHA; Edge versions bumped)
   - Phase 2: submit new argument; expect 3 new runs (one per family)
   - Phase 3: Source 6 returns A+B+C raw_keys
   - Phase 4: observability Q9/Q11/Q12 healthy
   - Phase 5: regression sanity
6. Write audit to docs/audits/MCP-021C-EDGE-FAMILIES-B-C-ENABLE-SMOKE-<date>.md
7. On PASS, Card 2 (MCP-SERVER-005-FAMILY-D) becomes the next card
8. Post-merge worktree cleanup per
   .claude/agents/roadmap-reviewer.md § "Post-merge worktree cleanup"
```

## Operator next steps

- **Push the branch:** `git push -u origin feat/MCP-021C-EDGE-FAMILIES-B-C-ENABLE`
- **Open PR:** `gh pr create --title "MCP-021C-EDGE-FAMILIES-B-C-ENABLE: enable Families B + C in production with registry-derived auto-trigger" --body-file docs/reviews/MCP-021C-EDGE-FAMILIES-B-C-ENABLE.md`
- **Deploy:** Supabase GitHub integration auto-deploys `submit-argument` and `classify-argument-boolean-observations` on merge to main. No manual `npx supabase functions deploy` required. No `npx supabase db push --linked` because no migration ships.
- **Post-merge smoke:** 5-phase audit per intent brief §11, output to `docs/audits/MCP-021C-EDGE-FAMILIES-B-C-ENABLE-SMOKE-<date>.md`.
- **Card 2 unblock:** On smoke PASS, `MCP-SERVER-005-FAMILY-D` becomes the next card per intent brief §12.
- **Post-merge worktree cleanup** (commands in `.claude/agents/roadmap-reviewer.md` § "Post-merge worktree cleanup (operator step)").
