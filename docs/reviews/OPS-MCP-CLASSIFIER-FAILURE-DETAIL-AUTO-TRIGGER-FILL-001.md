# OPS-MCP-CLASSIFIER-FAILURE-DETAIL-AUTO-TRIGGER-FILL-001 — Review (Edge GATE-C)

**Verdict:** APPROVE
**Reviewer agent run:** 2026-06-04
**Branch:** feat/ops-mcp-classifier-failure-detail-fill-001
**Design:** docs/designs/OPS-MCP-CLASSIFIER-FAILURE-DETAIL-AUTO-TRIGGER-FILL-001.md (byte-equal to main — confirmed)
**GitHub issue:** #485

## Summary

This card populates `failure_detail` (jsonb) + `failure_sub_reason` (text) on the
direct-dispatch (auto-trigger) terminal-failure persist path, reusing the existing
leak-safe builder `buildRunRowFailureDetail` exactly as the queue drainer does. The
implementation is minimal and surgical: two ADDITIVE optional fields on
`PersistRunInput` with a conditional spread (so the success path and the queue path
produce byte-equal INSERTs), and a single builder call inside the
`adapterResult.kind === 'unavailable'` failed branch fed ONLY allow-listed structural
inputs. The builder file, drainer, familyRegistry (H/I/J `productionEnabled:false`),
engine, and submit-argument are all byte-equal/untouched. The leak wall (structural
deny-list + secret-shape drop + 200/2000-char caps) is the same one the drainer
already relies on; nothing new is fed to it. The operator-authorized THR-4 sibling-test
update is a legitimate, intent-preserving STRENGTHENING (count 1→2 plus new
confinement + success-path-clean assertions), not bar-lowering. Typecheck, lint, and the
full suite (638 / 19393 / 1 skipped) all pass green at the expected delta. No remaining
concerns. APPROVE.

## Verification

- typecheck: **pass** (exit 0)
- lint: **pass** (exit 0, --max-warnings 0)
- test (full): **pass** (exit 0) — **637 → 638 suites / 19372 → 19393 passing / 1 skipped (unchanged) / 19394 total** (+1 suite / +21 tests). Captured line: `Test Suites: 638 passed, 638 total` / `Tests: 1 skipped, 19393 passed, 19394 total`.
- targeted suites: **pass** — `PASS __tests__/opsMcpClassifierFailureDetailAutoTriggerFill.test.ts` (21/21) AND `PASS __tests__/mcpOneTwoOneCFailureSubreasonThreading.test.ts` (THR-4 now green; 7/7). Combined `28 passed, 28 total`.
- secret scan: **clean** — only hit is a test regex literal `SUPABASE_SERVICE_ROLE_KEY` inside FILL-6, which ASSERTS the writer does NOT read that env. No key material.
- doctrine scan: **clean** — zero verdict tokens (winner/loser/liar/dishonest/bad faith/manipulative/extremist/propagandist) in added lines; the FILL-17 ban-list array is fragment-assembled and asserts their ABSENCE in the SUT.

## The 11 adversarial checks (Edge GATE-C)

1. **Leak-safety — projection output bounded & structured (PASS).** The failed-branch builder call (`classifyArgumentCore.ts:259-265`) is fed ONLY allow-listed structural inputs: `validatorPath: adapterResult.detail?.path` (the structural validator path string, e.g. `'schemaVersion'` — itself a product of the adapter's `buildFailureDetail`, never span text), `reason: failureReason` (the controlled `mcp_*` enum from `unavailableReasonToFailureReason`), `family: eligibleFamilies[0]`, `runMode: mode`, `schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION`. NO body/prompt/payload/response/message/evidenceSpan/extra/raw-provider token is fed — `classifierRunRowFailureDetail.ts:60-75` has no such input key (structural deny-list), and FILL-16 source-scans the builder-call argument to prove it. The builder's secret-shape matchers + 200/2000-char caps (`classifierRunRowFailureDetail.ts:88-99,177-191`) remain the wall, exercised by FILL-20.

2. **Parity with the queue path (PASS).** `git diff main -- classifierRunRowFailureDetail.ts` is empty (builder reused, NOT edited). Drainer call site (`classifierDrainerCore.ts:350-358`) feeds `validatorPath: classify.adapterResult.detail?.path / reason / family / runMode / schemaVersion`; the direct path (`classifyArgumentCore.ts:259-265`) feeds the identical-shape inputs (direct path omits `correlationId`/`attemptCount` because `runId` is not known until after the INSERT — documented at `classifyArgumentCore.ts:254-255`). One projection, both paths. FILL-18 runnable coverage asserts the output shape.

3. **Classifier behavior byte-equal (PASS).** Only the row-write payload changed. The `unavailable` branch guard (`classifyArgumentCore.ts:246`), `unavailableReasonToFailureReason` (line 247), the success branch (line 302+), and the `argument_not_found` early-return (lines 205-217, returns WITHOUT persistRun) are unchanged in control flow. No retry count, timeout, concurrency, or terminal-failure condition changed.

4. **No migration (PASS).** `git diff main..HEAD --name-only | grep "^supabase/migrations/"` → 0. (Both columns pre-exist: `failure_detail` from 20260602000001, `failure_sub_reason` from 20260528000021.)

5. **familyRegistry.ts byte-equal (PASS).** `git diff main -- familyRegistry.ts` empty. H/I/J `productionEnabled:false` untouched.

6. **engine.ts + submit-argument untouched (PASS).** `git diff main -- src/lib/constitution/engine.ts` empty; `git diff main --name-only | grep "supabase/functions/submit-argument/"` → 0.

7. **No new env reads / secret surface (PASS).** `git diff main..HEAD | grep "+.*( Deno.env.get | process.env )"` → 0. FILL-6 additionally asserts the writer reads no new env.

8. **No new provider call / outbound HTTP / MCP invocation (PASS).** `git diff main..HEAD | grep "+.*( fetch( | https?:// | api.anthropic | api.x.ai | MCP_SERVER )"` → 0.

9. **Backward compatibility / byte-equal success path (PASS).** Success-path persistRun (`classifyArgumentCore.ts:308-321`) sets `status: 'success'`, `failureReason: null`, and OMITS both new fields → columns stay NULL. `PersistRunInput`'s two new fields are OPTIONAL (`persistenceWriter.ts:57-58`); `insertPayload` spreads them only when `!== undefined` (`persistenceWriter.ts:111-116`), so the queue path + success path produce byte-equal INSERTs. Writer stays INSERT-only — no `.update(`/`.delete(`/`.upsert(` added (`persistenceWriter.ts:123,176` are the only `.insert(` sites; diff grep for added update/delete/upsert → 0; FILL-5 asserts this). FILL-15 source-anchors the success call and proves it carries neither field.

10. **Acceptance-gate invariant preserved (PASS).** The new code runs inside the post-201 classifier path (`classifyOneArgumentCore`), AFTER terminal classifier failure, on a run row whose classification already terminally failed. `submit-argument/` has no reference to this core (separate auto-trigger dispatch). It adds no read/branch/gate/latency to the submit path. `engine.ts` byte-equal. Nothing can block/route/delay a user post.

11. **THR-4 is legitimate, not gaming (PASS).** Single-hunk diff in `mcpOneTwoOneCFailureSubreasonThreading.test.ts` (only THR-4; THR-1/2/3/5/6/7 byte-equal — verified by `grep -c "^@@"` = 1).
    - (a) **Necessitated by correct behavior:** the card's failed-branch persistRun adds a SECOND occurrence of `failureSubReason`/`failureDetail` (`classifyArgumentCore.ts:280-281`), both INSIDE the unavailable branch, so the old `=== 1` count necessarily broke. Not a cover for regression.
    - (b) **Strictly stronger:** the old test asserted a flat count of 1 only. The new test asserts count == 2, that BOTH occurrences are confined to the unavailable-branch block (regex anchored `adapterResult.kind === 'unavailable'` → `// Success path`, CRLF-robust), AND that the success-path persistRun matches NEITHER field — a strict superset.
    - (c) **Semantic intent preserved:** test name and intent ("only the unavailable branch sets these; success/persist/not-found do not") unchanged; the confinement + success-clean assertions enforce exactly that.
    - (d) **No other assertion weakened:** single hunk; siblings byte-equal.

## Green gate

All three exit 0; full suite at the predicted post-card delta (638 / 19393 / 1 skipped). Both `mcpOneTwoOneCFailureSubreasonThreading` (THR-4 green) and the new `opsMcpClassifierFailureDetailAutoTriggerFill` (21/21) pass.

## Boundary attestation

`git diff main..HEAD --name-only` is exactly:
- `__tests__/mcpOneTwoOneCFailureSubreasonThreading.test.ts` (authorized THR-4 update)
- `__tests__/opsMcpClassifierFailureDetailAutoTriggerFill.test.ts` (new, +21)
- `docs/core/current-status.md` (one appended HTML comment)
- `supabase/functions/_shared/booleanObservations/classifyArgumentCore.ts`
- `supabase/functions/_shared/booleanObservations/persistenceWriter.ts`

(plus this review doc). Design doc byte-equal to main. No out-of-allowlist file.

**No code modified. No push. No PR opened. No merge.**

## merge = deploy → operator-only

**This is a GATE-C Edge card: merge = deploy.** `persistenceWriter.ts` and
`classifyArgumentCore.ts` are in the `submit-argument` import graph, so merging to
main redeploys the function via the Supabase GitHub integration. **Do NOT auto-merge.**
The merge is the deploy and is the operator's decision alone. The reviewer does not
push, does not open the PR, and does not merge.

### Operator post-merge smoke checklist

1. Confirm the Supabase integration redeploy of `submit-argument` (and the shared
   `_shared/booleanObservations` bundle) completed cleanly in the deploy log.
2. Verify the function **loads + responds on its non-provider path** (e.g. a normal
   submit returns 201; the classifier auto-trigger fires post-201 as before). Do NOT
   trigger a real terminal MCP failure as the smoke — that live failure-mode exercise
   is #479's job, not this card's smoke.
3. (Optional, soft dependency) OPS-MCP-OBSERVABILITY-002 (#470) reads the now-populated
   direct-path `failure_detail`/`failure_sub_reason` rows; it is not blocked by this card.

## Blockers

None.

## Suggestions (non-blocking)

None material. The implementation matches the design and reuses the proven drainer-path
projection without duplication.
