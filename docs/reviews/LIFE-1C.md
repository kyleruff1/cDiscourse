# LIFE-1C — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-19
**Branch:** feat/LIFE-1C-add-named-test-fixtures-for-life-001-des
**Design:** docs/designs/LIFE-001.md §"Edge cases" (entries 5, 7, 8) — no separate LIFE-1C design doc; issue #74 explicitly states "no design pass needed" (pure traceability / test-naming card).

## Summary

LIFE-1C appends three named `it()` blocks to the existing `describe('LIFE-001 edge cases', ...)` block in `__tests__/pointLifecycleModel.test.ts`, tracing 1:1 to `docs/designs/LIFE-001.md` §"Edge cases" entries 5, 7, and 8. The diff is 113 insertions, single file, zero production code. This closes a genuine traceability gap: the LIFE-001 Test plan's §"Edge cases" line (design line 854) lists named coverage for cases 1, 2, 4, 8–18, 21, 22 but **omits 5 and 7** — so a future reader could not previously grep the design doc and land on a test for "concurrent edits" or "observer mode." LIFE-1C adds the explicit `design edge case N - ...` anchor for all three. The new blocks reuse the established `fakeNode` / `buildTimelineMap` helpers and the already-present `EvidenceArtifact` / `ArgumentTimelineMapNode` imports, and each carries a real assertion that would fail on regression. No concerns remain.

## Verification

- typecheck: pass
- lint: pass (`eslint . --ext .ts,.tsx --max-warnings 0`)
- test: 4105 tests / 137 suites passing (full run, exit 0). Targeted run `--testNamePattern="design edge case"` → 3 passed, 73 skipped. Test count moves UP per test-discipline.
- secret scan: clean (no `ANTHROPIC_API_KEY` / `XAI_API_KEY` / `X_BEARER_TOKEN` / `SERVICE_ROLE` / `sk-ant-` / `xai-` / `sb_secret_` / Bearer / JWT-shape hits)
- doctrine scan: clean (no `winner` / `loser` / `liar` / `correct` / `dishonest` / `bad faith` / `manipulative` / `extremist` / `propagandist` / `defeated` / `proven` / `verdict`; no `SERVICE_ROLE`; no `insert public.arguments` / `from public.arguments`)

## Design conformance

- [x] All design file-changes are present — issue asked for exactly 3 named `it()` blocks; 3 present, named precisely "design edge case 5 - ...", "design edge case 7 - ...", "design edge case 8 - ...".
- [x] No undocumented file-changes — `git diff main..HEAD --name-only` returns only `__tests__/pointLifecycleModel.test.ts`.
- [x] Data model matches design — no model change; tests exercise `buildPointLifecycleMap` as-is.
- [x] API contracts match design — edge case 7 explicitly anchors the design assertion that `buildPointLifecycleMap` has no viewer parameter (signature: `timelineMap, artifactsByMessageId, flagCodesByMessageId?, advisoryConfig?`).

Per-case anchor check against `docs/designs/LIFE-001.md` §"Edge cases":

- **Case 5** (design line 742 — "Memoization invalidates because `inputHash` changes ... One O(n) rebuild"): test builds a 2-node fixture, then a 3-node fixture sharing the first 2 inputs, and asserts `after.inputHash !== before.inputHash`, the new node `'b'` is present in `byMessage` with a truthy `messageContribution`, single cluster, and cluster state `'rebutted'`. Would fail if `inputHash` stopped reacting to the last message id or if the rebuild dropped the new node.
- **Case 7** (design line 744 — "Lifecycle derivation is identical for observers. No state changes based on viewer identity"): test runs `buildPointLifecycleMap` twice on the same input and asserts deep-equal `inputHash`, `clusterOrder`, `cumulativeStateSequence`, `byCluster` entries, and `byMessage` entries. Would fail if a viewer parameter were ever introduced that perturbed output.
- **Case 8** (design line 745 — "Same-axis ancestor walk is O(depth). At depth 50 with 250 messages ... < 1 ms"): test builds a 60-node linear same-axis chain (depth ≥ 50), asserts a single root-keyed cluster, all 60 nodes classified with truthy `messageContribution`, and a defined cluster state. Would fail on a stack overflow, a dropped node, or an undefined cluster state in the deep walk.

## Doctrine self-check (must all be ✓)

- [x] No truth/winner/loser language in user-facing strings — diff adds no user-facing strings; only test code. Doctrine scan clean.
- [x] Score never blocks posting — N/A; no scoring or posting path touched.
- [x] No service-role in client code — no `SERVICE_ROLE` token anywhere in the diff.
- [x] No direct insert into public.arguments — no `insert`/`from public.arguments`; tests use in-memory `fakeNode` fixtures only.
- [x] No AI calls in production app paths — diff is a `__tests__/` file; no Anthropic / xAI / X API import or call.
- [x] Plain language only (no raw internal codes in UI strings) — N/A; no UI strings added. Internal codes used are test fixture inputs (`fact_challenge` tag codes), not user-facing copy.
- [x] Epic-specific doctrine — `cdiscourse-doctrine` rule 1 (score is gameplay analysis, never truth) and the LIFE-001 doctrine that lifecycle "describes the cluster, not the viewer": edge case 7 actively pins this — it asserts derivation is viewer-independent. The implementer's reword of "Proof:" → "Anchor:" in the case-7 comment correctly removed a `proof` token flagged by the design's verdict ban-list (design line 834). `test-discipline`: tests are part of the deliverable, added now (not deferred), count moves up, no `.skip`/`.only`/`xit`/`xdescribe`/`console.log` in the diff.

## Test coverage

- [x] New public functions have unit tests — no new public function; this card *is* added test coverage for existing `buildPointLifecycleMap`.
- [x] User-facing strings have ban-list assertion — N/A (no new user-facing strings); existing verdict/amplification/snake_case ban-list tests in the same suite remain green.
- [x] Edge cases from design §"Edge cases" have tests — this card adds the named anchors for entries 5, 7, 8; each makes a real, regression-sensitive assertion (see Design conformance above).
- [x] Accessibility assertions present (if UI card) — N/A; pure-model test card, no UI.

## Blockers

None.

## Suggestions (non-blocking)

1. Edge case 8's comment cites the design's "250 messages ... < 1 ms" figure but the test builds 60 nodes and asserts correctness, not timing — the explicit performance assertion already lives in the suite's separate "Performance" test (250-message fixture, `performance.now()`). The current comment is accurate enough (it frames the O(depth) walk), but a one-line note that timing is covered elsewhere would prevent a future reader expecting a `performance.now()` assertion in this block. Implementer may defer.
2. Optional: the LIFE-001 design Test plan line (design line 854) could later be amended to list cases 5 and 7 now that named tests exist — but that edits the design doc, which is out of scope for this card and not required.

## Operator next steps

- Push the branch: `git push -u origin feat/LIFE-1C-add-named-test-fixtures-for-life-001-des`
- Open PR: `gh pr create --title "LIFE-1C: Add named test fixtures for LIFE-001 design edge cases 5/7/8" --body-file docs/reviews/LIFE-1C.md`
- Deploy steps: none — test-only change, no migration, no Edge Function, no production code.
