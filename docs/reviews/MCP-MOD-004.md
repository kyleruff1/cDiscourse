# MCP-MOD-004 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-23
**Branch:** feat/MCP-MOD-004-source-of-truth-extraction
**Commit reviewed:** dbe33ae
**Design:** docs/designs/modularity-slate/MCP-MOD-004.md
**Path B confirmed:** working dir `C:/Users/kyler/cdiscourse/debate-constitution-app`, branch `feat/MCP-MOD-004-source-of-truth-extraction`.

## Summary

The keystone modularity refactor ships exactly what the design spec promised: a single `SEMANTIC_CLASSIFIER_CATALOG` constant (Node + Deno mirror) is now the source of truth for per-id classifier metadata (id, binarySignal, structuralQuestion, family, primary bannerCode, primary ledgerFeedbackCode, optional plainLanguageLabel). `seedPrompt.ts`'s `CLASSIFIER_QUESTION_TEXT` no longer hand-writes 23 entries — it derives them from the catalog via `Object.fromEntries(SEMANTIC_CLASSIFIER_CATALOG.map(...))`. Behavior preservation is enforced by a `buildClassifierPrompt` golden-file byte-identity snapshot (captured pre-refactor) plus a Node ↔ Deno source-text parity test plus a source-scan test asserting no per-id id-string literal appears in `seedPrompt.ts` executable source. The two documented departures (catalog records primary banner code while `CLASSIFIER_TO_BANNERS` keeps the full priority list; catalog records primary ledger code while `classifierFor` keeps the inverse `category→classifier` table) are honest, justified by the consuming code's actual shape (`selectBanner` iterates the full list; `responds_to_parent` legitimately surfaces under two categories), and explicitly flagged for MCP-MOD-006 to close. **All 9163 tests pass, typecheck clean, lint clean, no doctrine violations, no secret leaks.**

## Verification battery

| Check | Result |
|---|---|
| `npm run typecheck` | PASS (exit 0, no output) |
| `npm run lint` | PASS (exit 0, no output, `--max-warnings 0`) |
| `npm run test` | PASS — 9163 / 9163 tests, 338 / 338 suites |
| Baseline confirmation | PASS — main = 9108 / 334 (re-run in clean checkout). Delta = +55 tests / +4 suites |
| MCP-MOD-004 suites in isolation | PASS — 55 tests / 4 suites (17 + 4 + 8 + 26) |
| Secret scan | CLEAN — no `ANTHROPIC_API_KEY` / `XAI_API_KEY` / `X_BEARER_TOKEN` / `SERVICE_ROLE` / `sb_secret_` / `sk-ant-` / `Bearer ` / JWT-shape strings in the diff |
| Doctrine verdict-token scan | CLEAN — no `winner` / `loser` / `liar` / `dishonest` / `manipulative` / `extremist` / `propagandist` / `stupid` / `idiot` / `won` / `lost` / `defeated` / `proven` in the diff. Matches for "truth" appear only in `// never about truth ...` comments (prohibition-naming, not fact-asserting). "Insult" appears only in the pre-existing `contains_unplayable_insult_only` classifier text. |
| `console.log` scan | CLEAN — no committed `console.log` in the diff |
| Direct `public.arguments` insert scan | CLEAN — no insert / from `public.arguments` references in the diff |

## Per-check matrix (21 checks)

| # | Check | Verdict | Notes |
|---|---|---|---|
| 1 | Path B confirmation (cwd + branch) | PASS | `git rev-parse --show-toplevel` = expected; `git branch --show-current` = `feat/MCP-MOD-004-source-of-truth-extraction` |
| 2 | Skills invoked | PASS | `cdiscourse-doctrine` + `test-discipline` both read in full before any code inspection |
| 3 | Catalog purity (Node) | PASS | `src/lib/constitution/semanticClassifierCatalog.ts:53` has the ONLY import: `import type { SemanticClassifierId } from '../../features/semanticReferee/semanticRefereeTypes'`. No Supabase / React / Expo / network. Frozen with `Object.freeze`. JSON-serializable. Pure data. |
| 4 | Catalog purity (Deno) | PASS | `supabase/functions/_shared/semanticReferee/semanticClassifierCatalog.ts:34` has the ONLY import: `import type { SemanticClassifierId } from './types.ts'`. Deno-style `.ts` extension. No `npm:` import. |
| 5 | No verdict / person-label tokens in catalog | PASS | Scan of both catalogs found no banned tokens in any `binarySignal` or `structuralQuestion`. "Truth" appears only in comments explicitly forbidding truth-language. The `contains_unplayable_insult_only` entry names a structural prohibition (allowed), not a label applied to a person. The `uses_popularity_as_evidence` and `shifts_to_person_or_intent` entries include explicit doctrine-marker phrases ("never a verdict about the participant" / "never a person label") to make the prohibition explicit. |
| 6 | `PACKET_VERSION` unchanged | PASS | `src/features/semanticReferee/semanticRefereeTypes.ts:192` still: `export const PACKET_VERSION = 'mcp-semantic-referee-v0' as const;` |
| 7 | `SemanticClassifierId` union unchanged | PASS | `semanticRefereeTypes.ts:30-53` — all 23 ids present, none added, none removed. The catalog imports the union (does NOT widen it). |
| 8 | All 23 ids present in catalog (both sides) | PASS | Both catalogs have exactly 23 entries, in `ALL_SEMANTIC_CLASSIFIER_IDS` order. Asserted by `semanticClassifierCatalogParity` test "has exactly 23 entries" + "declares entries in the same order as ALL_SEMANTIC_CLASSIFIER_IDS". |
| 9 | `structuralQuestion` byte parity (5-id spot check vs MCP-MOD-002) | PASS | Spot-checked `responds_to_parent`, `introduces_new_issue`, `quote_anchors_parent`, `requests_clarification`, `asks_for_evidence` against `docs/architecture/semantic-referee-classifier-catalog.md` `<!-- ai-question:... -->` markers — all byte-identical. The parity test `catalog structuralQuestion matches CLASSIFIER_QUESTION_TEXT for every id` enforces the property for the full set. |
| 10 | Node ↔ Deno parity test | PASS | `semanticClassifierCatalogDenoNodeParity.test.ts` (8 tests) asserts byte-equality of the catalog span between the two files via `extractCatalogSpan` regex, plus per-row id / banner / ledger / family literal equality. Test passes. |
| 11 | `seedPrompt.ts` source-scan test | PASS | `seedPromptNoHardcodedClassifierIds.test.ts` (26 tests) reads `seedPrompt.ts`, strips block + line comments via a quote-aware walker, then asserts no `'<id>'` or `"<id>"` literal appears for any of the 23 ids. Also asserts the file imports `SEMANTIC_CLASSIFIER_CATALOG` and uses `Object.fromEntries(SEMANTIC_CLASSIFIER_CATALOG.map(...))`. The comment-stripper handles the worked-example caveat correctly: the example's classifier-id is `SEMANTIC_CLASSIFIER_CATALOG[0].id` (an indexed reference, not a literal). Test passes. |
| 12 | Snapshot golden parity | PASS | `__tests__/__fixtures__/semanticClassifierCatalog/firstThreeIdsGolden.txt` (39 lines) is the pre-refactor `buildClassifierPrompt` output for a fixed sample (`responds_to_parent`, `introduces_new_issue`, `asks_for_evidence`). The snapshot test asserts byte-identity. Test passes. This is the regression check that says "the prompt assembly produces the same output as pre-refactor". |
| 13 | Banner-library departure is honest | PASS | `src/features/refereeBanners/selectBanner.ts:91,97` shows `const codes = CLASSIFIER_TO_BANNERS[binary.classifierId]; for (const bannerCode of codes) { ... pool.push(...) }` — `selectBanner` iterates the FULL list per id, not just the first. The catalog's single `bannerCode` field is the PRIMARY (first entry); the parity test `every non-null bannerCode matches the FIRST code in CLASSIFIER_TO_BANNERS[id]` enforces agreement. Keeping the full list in the banner library is correct; routing the full list through the catalog is properly deferred to MCP-MOD-006. |
| 14 | Ledger departure is honest | PASS | `src/features/refereeLedger/reconcileMove.ts:178-189` shows `classifierFor: Partial<Record<RefereePointCategory, SemanticClassifierId>>` — the table direction is `category → classifier` (inverse of catalog's `id → ledgerFeedbackCode`). Critically, `responds_to_parent` appears on BOTH `continuity` AND `direct_response` keys (lines 179-180), with distinct downstream feedback codes (`clean_parent_tie` vs `answered_the_question` per MCP-MOD-002 inventory line 58-60). Inverting the catalog to derive this table would NOT be behavior-preserving (it would force a 1:1 mapping). The catalog's `ledgerFeedbackCode` field records the PRIMARY per-id feedback code; the table stays. Properly deferred to MCP-MOD-006. |
| 15 | All existing tests still pass | PASS | Full suite: 9163 / 9163 tests, 338 / 338 suites. No pre-existing red suites (the `diagnosticInspectPackage.test.ts` flake referenced in earlier MCP-MOD entries has cleared on this branch — confirmed by the all-green run). |
| 16 | typecheck + lint pass | PASS | Both exit 0 with no output. Lint is `--max-warnings 0`. |
| 17 | No production code touched beyond named files | PASS | `git diff main..HEAD --name-only` returns exactly 11 files: the 7 new (Node catalog, Deno catalog, 4 test files, 1 golden fixture) + 4 modified (seedPrompt.ts, classifierBannerMap.ts, reconcileMove.ts, current-status.md). No files outside this list. Note: the task brief said "8 new + 4 modified = 12", but the design itself names only 7 new artifacts (the brief's count was off by one — there is no 8th new file in the design). |
| 18 | No `git add -A` evidence | PASS | Pre-existing dirty files (`docs/testing-runs/2026-05-23-ai-driven-bot-corpus-dry.md`, `docs/testing-runs/2026-05-23-engagement-epidemiology-synthetic.md`) and untracked `assets/branding/semantic-referee.zip` are NOT in the branch diff. They remain in working tree as `M` / `??` (pre-existing on main, not staged on this branch). |
| 19 | No secret leak | PASS | Scan of full diff for `ANTHROPIC_API_KEY` / `SERVICE_ROLE` / `xai-` / `sk-ant-` / `sb_secret_` / `XAI_API_KEY` / JWT-shape / Bearer tokens returned zero matches in the catalog or modified files. |
| 20 | Test-count delta accounting | PASS — but task brief's premise was wrong | The task brief stated "+55 net but 62 new tests added, implying 7 tests removed". This arithmetic was based on the implementer's `current-status.md` note "+62 tests / +4 suites" which is an overcount. The reviewer verified the actual counts by running each new suite in isolation: parity = 17, snapshot = 4, deno-node = 8, no-hardcoded = 26. **Sum = 55**, exactly matching the observed 9108 → 9163 delta. **No tests were removed, renamed, or merged.** No pre-existing test was deleted. The implementer's status-doc note is slightly off (says 62 vs actual 55) — non-blocking documentation nit but worth flagging. |
| 21 | Test-discipline conformance | PASS | All 4 new tests in `__tests__/` (not co-located); pure source-scan + import + parity assertions; no React, no Supabase client, no `fetch`, no network. No `.skip` / `.only` / committed `console.log`. Mental mutation check: changing a `structuralQuestion` value in the Node catalog would fail (a) the snapshot test (`buildClassifierPrompt` byte-identity), (b) the parity test `catalog structuralQuestion matches CLASSIFIER_QUESTION_TEXT`, and (c) the Deno-Node source-text parity test. Changing a `bannerCode` would fail the banner-code parity test. Changing an `id` would fail the order-equality test. Removing an entry would fail the "exactly 23 entries" test. The tests fail loudly on real drift. |

## Skills invocation confirmation

**`cdiscourse-doctrine` — read in full.** Key rules relevant to this card:
- §1 (Score is gameplay analysis, never truth) — the catalog's `structuralQuestion` and `binarySignal` fields are structural, not truth-asserting. PASS.
- §4 (AI moderator hard limits) — the catalog defines structural questions only. No truth value, no winner verdict, no delete/hide instruction. PASS.
- §5 (Rules engine is sacred) — the catalog lives at `src/lib/constitution/semanticClassifierCatalog.ts` next to `engine.ts` and follows the same purity rules (pure TS, no async, no side effect, no Supabase/React/network import). Single `import type` only. PASS.
- §6 (Secrets policy) — no secret literal in either catalog or any new test. PASS.
- §7 (No AI calls from production app) — the catalog is data only. No fetch, no provider call. PASS.

**`test-discipline` — read in full.** Key rules relevant to this card:
- "Tests are part of the deliverable" — 55 new tests across 4 new suites. PASS.
- "Pure-model tests: import the model directly, no React, no Supabase, no fetch" — all 4 new test files conform. PASS.
- "Test count goes UP, never down" — 9108 → 9163 = +55. PASS.
- "No `.skip` / `.only` / `console.log` in committed test code" — confirmed. PASS.
- "Tests fail loudly on real drift" — mental-mutation verification passes (see check 21).

## Behavior-preservation departure assessment

**Departure 1 — banner library `CLASSIFIER_TO_BANNERS` kept intact.** Justified. `selectBanner` (`src/features/refereeBanners/selectBanner.ts:97`) iterates the entire `CLASSIFIER_TO_BANNERS[id]` array to build the candidate pool; collapsing to a single primary code would change the pool size and would not be byte-identical. The catalog records the primary code; the parity test enforces that the catalog's primary code matches `CLASSIFIER_TO_BANNERS[id][0]`. MCP-MOD-006 will route the full list through the catalog (likely as a `bannerCodePriorityList: readonly string[]` field) and the parity test will widen at that point. The deferral is the right call.

**Departure 2 — ledger `classifierFor` table kept intact.** Justified. The table maps `category → classifier` and `responds_to_parent` legitimately appears under both `continuity` and `direct_response` (`reconcileMove.ts:179-180`), each surfacing a different downstream feedback code per MCP-MOD-002 inventory (`clean_parent_tie` for continuity, `answered_the_question` for direct_response). Inverting the catalog's `id → primary code` direction into this table would force a 1:1 collapse and would not be behavior-preserving. The catalog records the primary feedback code per id; the table stays. MCP-MOD-006 will need a richer `ledgerMappingPerCategory: Partial<Record<RefereePointCategory, RefereeFeedbackCode>>` field per catalog entry to model the multi-category surface — explicitly the right time to make that change.

## Test-count delta accounting (the "7 missing tests")

The task brief's premise that 7 tests were removed is **incorrect**. Verified counts:

- `semanticClassifierCatalogParity.test.ts` — **17** tests (task brief said 24, off by 7)
- `semanticClassifierCatalogSnapshotPrompt.test.ts` — **4** tests
- `semanticClassifierCatalogDenoNodeParity.test.ts` — **8** tests
- `seedPromptNoHardcodedClassifierIds.test.ts` — **26** tests

**Total: 55 new tests.** Delta 9108 → 9163 = +55. No removal, no rename, no merge. The implementer's `current-status.md` line 12 says "+62 / +4 suites" which is itself off by 7; that is the source of the task brief's confusion. **Non-blocking documentation nit only** — strongly recommend the implementer correct `current-status.md` to "+55 tests / +4 suites" in a follow-up commit, but this is not a blocker.

## Blockers

None.

## Suggestions (non-blocking)

1. **`docs/core/current-status.md` line 12** says "+62 tests / +4 suites" — should be "+55 tests / +4 suites". The numeric baseline (9163 total) is correct; only the delta wording is off. A one-line fix the operator can make at squash-merge or in a follow-up.
2. **`current-status.md` text-banner above the entry** (line 2: `Full suite is 9163 tests / 338 suites`) is correct.
3. For MCP-MOD-006: the parity tests already pin the catalog's primary banner code to `CLASSIFIER_TO_BANNERS[id][0]` and the primary ledger code to the per-id primary mapping. When MCP-MOD-006 widens the catalog to a full per-id banner priority list and per-category ledger mapping, the parity assertions can be lifted from "primary equals first" to "catalog list equals library list" with no behavior change. Document this expected progression in the MCP-MOD-006 design.

## Operator next steps

- Push the branch: `git push -u origin feat/MCP-MOD-004-source-of-truth-extraction`
- Open PR: `gh pr create --title "MCP-MOD-004: source-of-truth extraction — SEMANTIC_CLASSIFIER_CATALOG" --body-file docs/reviews/MCP-MOD-004.md`
- After merge, the Supabase GitHub integration auto-deploys both the Node and Deno catalogs (no migration; no env-var change; no secret rotation; no admin runtime-config change).
- Then re-run the smoke test as the operator's post-merge contract-end-to-end gate: `node scripts/bot-fixtures/runMcpSmokeTest.js`. Because the refactor is byte-identity preserving (the golden snapshot enforces it and the prompt-version stamp `mcp-semantic-referee-prompt-v1` is unchanged), the smoke test result should match the pre-refactor baseline exactly.
- Rollback is `git revert` of the merge commit. The pre-refactor per-id constants are not preserved on the branch, but re-deriving them from the catalog at any commit is a 30-second mechanical edit.

## Bottom line

**Approve.** This is a textbook keystone refactor — byte-identity preserved, doctrine clean, tests cover both Node and Deno surfaces with golden + parity + source-scan rigour, departures are honest and properly deferred. Ready to push and merge. The post-merge smoke-test re-run should pass.
