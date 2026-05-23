# MCP-MOD-005 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-23
**Branch:** feat/MCP-MOD-005-prompt-template-refactor
**Commit reviewed:** cb2ae71
**Design:** docs/designs/modularity-slate/MCP-MOD-005.md
**GitHub issue:** https://github.com/kyleruff1/cDiscourse/issues/234

## Summary

`buildClassifierPrompt` in `supabase/functions/_shared/semanticReferee/seedPrompt.ts`
now iterates `SEMANTIC_CLASSIFIER_CATALOG` directly with a single `for…of` loop
that filters by `request.requestedClassifiers`, de-duplicates via a `seen` set,
and emits one `- <id>: <structuralQuestion>` line per matching entry. The
`CLASSIFIER_QUESTION_TEXT` lookup table is removed entirely — production code
(`src/`, `supabase/functions/`) has zero remaining references to it. The
behaviour-preservation posture is rigorously instrumented: a new 3-test
fuzz-parity suite (50 random subsets, fixed Mulberry32 seed `0xc0ffee_05`, LOCAL
`legacyBuildClassifierPrompt` reference) and a new 5-test iteration-order suite
(full, reverse, subsequence, dedup) pin every behavioural property. The
pre-existing MCP-MOD-004 byte-identity snapshot test passes unchanged, proving
the assembled prompt is byte-for-byte the same as before the refactor. Neither
`PACKET_VERSION` nor `SEED_PROMPT_VERSION` was bumped — correct, the prompt
content is unchanged. Six call sites that previously read
`CLASSIFIER_QUESTION_TEXT` were migrated to read `structuralQuestion` directly
from the catalog (via the `DENO_CATALOG_BY_ID` re-export); each migration is
semantically equivalent or strictly safer.

## Verification

- typecheck: **pass** (no output)
- lint: **pass** (no output, `--max-warnings 0`)
- test: **9163 → 9171 tests / 338 → 340 suites** (+8 tests / +2 suites — matches design)
- fuzz-parity test: **3/3 pass** (50/50 byte-identical legacy vs new)
- iteration-order test: **5/5 pass**
- snapshot test (MCP-MOD-004 baseline): **4/4 pass** (byte-identity preserved)
- secret scan: **clean** (no ANTHROPIC_API_KEY, SERVICE_ROLE, xai-, sk-ant-, sb_secret_, Bearer, Authorization, JWT shape, XAI_API_KEY, X_BEARER_TOKEN)
- doctrine scan: **clean** (only diff matches for ban-list tokens are inside the
  test files' explicit `BANNED_TOKENS` arrays + the prompt's existing "Do not
  include any blocking, verdict, truth, or winner field." prohibition sentence)

## 18-check verdict matrix

| # | Check | Verdict | Justification |
|---|---|---|---|
| 1 | Path B confirmation | PASS | `git rev-parse --show-toplevel` = `C:/Users/kyler/cdiscourse/debate-constitution-app`; `git branch --show-current` = `feat/MCP-MOD-005-prompt-template-refactor`. |
| 2 | Skills invoked | PASS | `cdiscourse-doctrine` + `test-discipline` loaded at session start; relevant content summarized below. |
| 3 | `SEMANTIC_REFEREE_PACKET_VERSION` + `SEED_PROMPT_VERSION` unchanged | PASS | `PACKET_VERSION = 'mcp-semantic-referee-v0'` (types.ts:206, not in diff); `SEED_PROMPT_VERSION = 'mcp-semantic-referee-prompt-v1'` (seedPrompt.ts:41, unchanged from SMOKE-FIX-002 baseline). Neither bumped. |
| 4 | `SemanticClassifierId` union unchanged | PASS | `git diff main..HEAD -- supabase/functions/_shared/semanticReferee/types.ts src/features/semanticReferee/semanticRefereeTypes.ts` returns 0 lines. |
| 5 | No new verdict / person-label tokens | PASS | Doctrine ban-list scan returns only matches in (a) test files' `BANNED_TOKENS` arrays (the scan vocabulary itself), (b) the pre-existing prohibition sentence `'Do not include any blocking, verdict, truth, or winner field.'`, and (c) JSDoc doctrine prose explaining what is forbidden. No new user-facing strings introduce verdict language. |
| 6 | `buildClassifierPrompt` iterates the catalog | PASS | seedPrompt.ts:84 — `for (const entry of SEMANTIC_CLASSIFIER_CATALOG)`. Pre-refactor per-id `CLASSIFIER_QUESTION_TEXT[id]` lookup is gone. |
| 7 | `CLASSIFIER_QUESTION_TEXT` export removed | PASS | `Grep` for `export.+CLASSIFIER_QUESTION_TEXT` in `seedPrompt.ts` returns zero matches. |
| 8 | No remaining caller imports the removed export from production code | PASS | `Grep` for `CLASSIFIER_QUESTION_TEXT` across `src/` returns zero matches; across `supabase/functions/` returns zero matches. All remaining mentions are in test-file JSDoc comments, the `_helpers/semanticRefereeDeno.ts` bridge comment explaining the removal, historical design docs (MCP-017, MCP-MOD-002, MCP-MOD-004), and the inventory doc's documentation prose. |
| 9 | Test caller migrations semantically equivalent | PASS | See detailed semantic-equivalence table below. All six migrations preserve the original property or are strictly safer. |
| 10 | Fuzz-parity test is rigorous | PASS | Mulberry32 PRNG seeded `0xc0ffee_05` (committed in file, line 50); `legacyBuildClassifierPrompt` defined LOCALLY (lines 80-175), never imported, never exported, never used in production; faithful reproduction of pre-refactor per-id-lookup approach with same instruction text + worked example + buildInputBlock shape; 50 random subsets drawn in catalog declaration order (precondition for byte-identity correctly documented in JSDoc lines 22-30); each subset asserted byte-identical; test passes 50/50. |
| 11 | Iteration-order test pins declaration order | PASS | `requestedClassifiers = ALL_SEMANTIC_CLASSIFIER_IDS` asserts catalog declaration order (test 1); reversed-order request still emits catalog order (test 2, proves iteration source is the catalog not the request); subsequence preservation (test 4); dedup keeps catalog order (test 5). All 5 pass. |
| 12 | MCP-MOD-004 snapshot test passes unchanged | PASS | `npx jest semanticClassifierCatalogSnapshotPrompt` → 4/4 pass. The golden file at `__tests__/__fixtures__/semanticClassifierCatalog/firstThreeIdsGolden.txt` is byte-identical to the new function's output. Behaviour preservation is fully demonstrated. |
| 13 | All existing tests pass | PASS | `npm run test` → 9171 tests / 340 suites, all green (matches implementer's claim exactly). |
| 14 | typecheck + lint pass | PASS | `npm run typecheck` exits clean; `npm run lint` exits clean at `--max-warnings 0`. |
| 15 | No production code touched beyond named files | PASS | `git diff main..HEAD --stat` lists exactly the 14 files named in the task spec (2 new + 12 modified). No collateral. |
| 16 | No `git add -A` evidence | PASS | `git diff main..HEAD --name-only` does NOT include the pre-existing dirty `docs/testing-runs/*.md` files or the untracked `assets/branding/semantic-referee.zip`. Implementer staged surgically. |
| 17 | No secret leak | PASS | Diff scan against `ANTHROPIC_API_KEY|XAI_API_KEY|X_BEARER_TOKEN|SUPABASE_SERVICE_ROLE_KEY|sb_secret_|sk-ant-|^xai-|Bearer |Authorization:|eyJ[A-Za-z0-9_-]{20,}` returns zero hits. New test files use only literal markers like `[MOVE_BODY_${index}]` and `'hash-fuzz-${index}'`. |
| 18 | Test-discipline conformance | PASS | Both new test files live in `__tests__/`; pure-TS (only React-free / Supabase-free / fetch-free imports — `_helpers/semanticRefereeDeno` bridge + edge-function types); zero `.skip`, `.only`, `xit`, `xdescribe`, or committed `console.log`; assertions fail loudly on drift (50 fuzz mismatches collected with `{index, ids}` triples, 5 iteration-order assertions); `legacyBuildClassifierPrompt` is LOCAL to the fuzz test (declared as `function legacyBuildClassifierPrompt(...)` inside the file, not exported, no production caller). |

## Skills invocation confirmation

**`cdiscourse-doctrine` — applied:**
- §1 Score never blocks; no verdict labels. Verified ban-list scan + check 5.
- §4 AI moderator hard limits. Refactor changes only how the catalog is iterated; the prompt's system text and structural-question vocabulary are unchanged (verified by the snapshot test and the explicit version-constant unchanged check 3). No new AI surface introduced.
- §6 Secrets policy. Check 17 (clean).
- §7 No AI calls from production app paths. Refactor is in `supabase/functions/_shared/semanticReferee/seedPrompt.ts` (Edge-Function shared module — already the correct location for AI prompt logic). No `src/` calls Anthropic.

**`test-discipline` — applied:**
- "Tests are part of the deliverable, not a follow-up." Both new test files live in `__tests__/`, are pure-TS, exercise the refactor's invariants.
- "Test count goes UP" — confirmed 9163 → 9171.
- "Pure-model test" pattern matched — bridge `_helpers/semanticRefereeDeno` is the established repo convention for the Deno-tree.
- No `.skip` / `.only` / committed `console.log` (verified).
- The fuzz reference function pattern (LOCAL legacy implementation that proves byte-identity, then dies in-PR) is a textbook behaviour-preservation guard.

## Test-migration semantic-equivalence summary

| Test file | Migration | Semantic-equivalence verdict |
|---|---|---|
| `semanticAnthropicCore.test.ts` | `CLASSIFIER_QUESTION_TEXT.<id>` references → `questionFor(id)` helper reading from `DENO_CATALOG_BY_ID.get(id)?.structuralQuestion`. | **Equivalent.** The helper resolves to the same `structuralQuestion` string that `CLASSIFIER_QUESTION_TEXT[id]` resolved to (both derive from the catalog entry's `structuralQuestion` field). Throws on unknown id — strictly safer than the pre-refactor undefined lookup. |
| `semanticAnthropicSeedPromptBanList.test.ts` | Id-coverage + ban-list scans now read `structuralQuestion` from `DENO_CATALOG_BY_ID` via a `questionFor` helper. | **Equivalent.** Same set of strings scanned (every catalog id's `structuralQuestion`); same `BANNED_TOKENS` + `BANNED_PHRASES` + `SHAPE_PATTERNS`. Additional id-parity assertions (`DENO_CATALOG_BY_ID.size === 23`, `SEED_PROMPT_CLASSIFIER_IDS.sort() === ALL_SEMANTIC_CLASSIFIER_IDS.sort()`) are strictly stronger. |
| `semanticClassifierCatalogParity.test.ts` | "byte-equal to `CLASSIFIER_QUESTION_TEXT[id]`" → "every catalog entry has non-empty `structuralQuestion`". | **Weakening that is correct and acknowledged.** Pre-refactor the assertion was already tautological after MCP-MOD-004 made `CLASSIFIER_QUESTION_TEXT` a derived view of the catalog (the comparison was catalog-vs-catalog). The new assertion is the only non-tautological property left after the indirection's removal. The byte-identity property of the *prompt* is held by the MCP-MOD-004 snapshot test (check 12, passes). |
| `semanticRefereeClassifierCatalogParity.test.ts` (MCP-MOD-002) | Doc-vs-source byte-equality now reads `DENO_CATALOG_BY_ID.get(id)?.structuralQuestion` instead of `CLASSIFIER_QUESTION_TEXT[id]`. | **Equivalent.** The inventory doc's `<!-- ai-question:<id> -->` block is still compared byte-for-byte to the source-of-truth structural question. The source-of-truth changed from "the derived `CLASSIFIER_QUESTION_TEXT` map" to "the catalog entry directly" — semantically the same string. |
| `seedPromptNoHardcodedClassifierIds.test.ts` | "derives `CLASSIFIER_QUESTION_TEXT` from catalog" → "iterates `SEMANTIC_CLASSIFIER_CATALOG` directly" + "does NOT export `CLASSIFIER_QUESTION_TEXT`". | **Both assertions present (lines 105-108) and stronger.** The first pins the post-refactor iteration pattern (regex `/for\s*\(\s*const\s+entry\s+of\s+SEMANTIC_CLASSIFIER_CATALOG\s*\)/`); the second guarantees the lookup table cannot be reintroduced (regex `/export\s+const\s+CLASSIFIER_QUESTION_TEXT/`). The original per-id no-hardcoded-id-string scan (23 `for`-generated tests) is preserved. |
| `semanticRefereeSeedPromptEnumCoverage.test.ts` | One stale comment updated; no executable change. | **No behavioural impact** (confirmed by reading the diff: comment-only edit). |

## Bottom line

Ready to push and merge. The refactor delivers the design's stated goal
(single-file change for a question wording edit) without altering the live
prompt's bytes or the packet contract. Behaviour preservation is
unambiguous (snapshot test + fuzz-parity test + iteration-order test all
green; `PACKET_VERSION` + `SEED_PROMPT_VERSION` unchanged; production-side
import surface confirmed empty of the removed export). The migration
pattern leaves the codebase in a strictly better shape for MCP-MOD-008's
extension (full-thread context block) — the per-id iteration is now the
only place that needs to learn about new prompt fields.

## Operator next steps

- Push the branch: `git push -u origin feat/MCP-MOD-005-prompt-template-refactor`
- Open PR: `gh pr create --title "MCP-MOD-005: prompt template refactor — buildClassifierPrompt iterates SEMANTIC_CLASSIFIER_CATALOG" --body-file docs/reviews/MCP-MOD-005.md`
- Post-merge deploy (per design §6): `npx supabase functions deploy semantic-referee --linked`
- Post-deploy smoke-test re-run (per design §5): confirm the result set matches the pre-refactor baseline byte-identically (the snapshot test is the unit-level proof; the smoke test is the integration-level confirmation).
- Rollback (per design §7): revert the merge commit; `buildClassifierPrompt` returns to its pre-refactor per-id literal lookup. No migration to roll back. No secret to rotate.
