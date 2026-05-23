# MCP-MOD-006 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-23
**Branch:** feat/MCP-MOD-006-banner-ledger-refactor
**Design:** docs/designs/modularity-slate/MCP-MOD-006.md
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/235

## Summary

MCP-MOD-006 closes Movement B by promoting `SEMANTIC_CLASSIFIER_CATALOG` to the single
source of truth for two more per-id seams that MCP-MOD-004 had documented as departures.
The catalog entry now carries `bannerCodePriorityList: readonly string[]` (the full ordered
banner candidate list previously held in `classifierBannerMap.ts`) and `ledgerCategories:
readonly string[]` (the per-id list of `RefereePointCategory` values previously inverted by
the inline `classifierFor` table in `reconcileMove.ts`). Both fields are populated for all
23 ids, byte-mirrored to the Deno-side catalog at `supabase/functions/_shared/semanticReferee/`,
and consumed at module load by `CLASSIFIER_TO_BANNERS` (now a single `Object.fromEntries(...)`
derivation) and `CLASSIFIER_FOR_CATEGORY` (now a module-level inversion with a hard
collision guard that throws if a future catalog edit ever maps two ids to the same category).
`toPlainLanguage` gains a forward-compatibility seam — it consults
`CATALOG_BY_ID.get(id).plainLanguageLabel` before the existing `PLAIN_LANGUAGE_COPY` fallback;
catalog v0 leaves the label undefined for all 23 ids so behavior is byte-identical. Three
new fuzz/parity test files (29 tests) lock the refactor by comparing the live (catalog-derived)
behavior against pre-refactor literal reference tables embedded as local-only constants in
the test files themselves. With the merge, the two MCP-MOD-004 deferred parity gaps are closed.

## Verification

- typecheck: pass
- lint: pass (exit 0)
- test: 9171 → 9200 tests / 340 → 343 suites (+29 tests / +3 suites, exactly as reported)
- secret scan: clean (no API keys, tokens, JWTs, Bearer literals, or Authorization headers in diff)
- doctrine scan: clean (the only "winner" hits are local variable names in the fuzz test's
  reference impl, mirroring an identical pre-existing internal name in
  `src/features/refereeBanners/selectBanner.ts:205` — code-internal, never user-facing)
- direct insert into `public.arguments`: none
- `SERVICE_ROLE` / `ANTHROPIC_API_KEY` / `XAI_API_KEY` in client paths: none
- `console.log` / `.skip` / `.only` / `xit` / `xdescribe` in new test files: none

## Skills invoked

- `cdiscourse-doctrine` — universal product + safety doctrine. All 10 rules checked, none
  violated.
- `test-discipline` — testing discipline. New tests live in `__tests__/`, are pure-TS, fail
  loudly on real drift (frozen seeded RNG + byte-equal `expect(...).toEqual(...)` per fixture).

## Per-check verdict matrix (20 checks)

### Doctrine + structural checks

| # | Check | Verdict | Evidence |
|---|---|---|---|
| 1 | Path B (working dir + branch) | pass | `C:/Users/kyler/cdiscourse/debate-constitution-app` on `feat/MCP-MOD-006-banner-ledger-refactor` |
| 2 | Skills invoked | pass | `cdiscourse-doctrine` + `test-discipline` |
| 3 | `PACKET_VERSION` / `SEED_PROMPT_VERSION` unchanged | pass | `semanticRefereeTypes.ts` not in diff |
| 4 | `SemanticClassifierId` union unchanged (23 ids) | pass | `semanticRefereeTypes.ts` not in diff; catalog count assertion in parity test still passes |
| 5 | No new verdict / person-label tokens in any modified file | pass | doctrine scan clean (only `winner` as internal variable in mirror impl) |

### Catalog extension verification

| # | Check | Verdict | Evidence |
|---|---|---|---|
| 6 | Both new fields added correctly | pass | `SemanticClassifierCatalogEntry` (Node `semanticClassifierCatalog.ts:76-146`) declares `bannerCodePriorityList: readonly string[]` AND `ledgerCategories: readonly string[]`. All 23 entries populate both. |
| 7 | Deno mirror has byte-identical fields and values | pass | The `semanticClassifierCatalogDenoNodeParity` test asserts byte-equal catalog spans (`expect(denoSpan).toBe(nodeSpan)`); two new field-specific extractors (`extractBannerPriorityLists` / `extractLedgerCategoriesLists`) cross-check per-id arrays |
| 8 | Deno-Node parity test passes (new tests added) | pass | 9/9 in suite pass; 2 new tests added (`bannerCodePriorityList literal matches` + `ledgerCategories literal matches`) |
| 9 | `bannerCodePriorityList` content correct (spot-check 3 ids) | pass | `responds_to_parent` → `[continuity_clean_tie, continuity_engages_mechanism, continuity_picks_up_thread]`; `creates_source_chain_gap` → `[chain_breaks, trace_it_back, one_more_link]`; `contains_unplayable_insult_only` → `[]` — all match pre-refactor reference table in `semanticBannerFuzzParity.test.ts:57-143` |
| 10 | `ledgerCategories` content correct, special case `responds_to_parent` | pass | `responds_to_parent` → `Object.freeze(['continuity', 'direct_response'])` (line 168, catalog) — the documented only multi-category id. Spot-checked `provides_evidence` (`['evidence_provided']`) and `shifts_to_person_or_intent` (`['person_intent_drift']`); all match the pre-refactor `localOnlyClassifierFor` table |

### Derived-view correctness

| # | Check | Verdict | Evidence |
|---|---|---|---|
| 11 | `CLASSIFIER_TO_BANNERS` is a derived view, zero per-id literals | pass | `classifierBannerMap.ts` now a single `Object.freeze(Object.fromEntries(SEMANTIC_CLASSIFIER_CATALOG.map(...)))` block (lines 47-56). Grep for `\bid:\s*'` (literal id strings) returns 0 matches in the file. |
| 12 | `classifierFor` derived from catalog with collision guard | pass | `reconcileMove.ts:176-199` — `CLASSIFIER_FOR_CATEGORY` built at module load by inverting `entry.ledgerCategories` with explicit `throw new Error(...)` if two distinct ids hit the same category |
| 13 | `selectBanner` consumption pattern preserved | pass | `selectBanner.ts` unchanged (not in diff); the banner library reads `CLASSIFIER_TO_BANNERS[id]` exactly as before, iterating the full priority list |

### Plain-language refactor

| # | Check | Verdict | Evidence |
|---|---|---|---|
| 14 | `toPlainLanguage` reads catalog first | pass | `gameCopy.ts:451-486` — `toPlainLanguage` calls `catalogPlainLanguageLabelFor(key)` BEFORE the `PLAIN_LANGUAGE_COPY` table lookup. Fallback path preserved. Behavior byte-identical in catalog v0 (no `plainLanguageLabel` set). |

### Fuzz-parity test rigor

| # | Check | Verdict | Evidence |
|---|---|---|---|
| 15 | Banner fuzz-parity test | pass | `semanticBannerFuzzParity.test.ts` — committed `COMMITTED_SEED = 0x6dcb5106`, local-only `localOnlySelectBanner` + `localOnlyClassifierToBanners` reference, 50 generated `BannerSelectionInput`s, byte-identical `BannerSelectionResult` asserted. Suite passes 6/6. |
| 16 | Ledger fuzz-parity test | pass | `semanticLedgerFuzzParity.test.ts` — committed `COMMITTED_SEED = 0x4f6d8c12`, local-only `localOnlyClassifierFor` + `localOnlyL2Signal` reference, 50 generated `SemanticRefereePacket`s × 10 lookup categories = 500 assertions; also asserts inversion equals reference table entry-for-entry. Suite passes 10/10. |
| 17 | Plain-language parity test | pass | `semanticPlainLanguageParity.test.ts` — frozen `PRE_REFACTOR_PLAIN_LANGUAGE` table covers all 23 ids, asserts `toPlainLanguage(id)` returns the pre-refactor value for each. Suite passes 8/8. |

### Regression checks

| # | Check | Verdict | Evidence |
|---|---|---|---|
| 18 | All existing tests pass; rewritten parity tests meaningful, not tautological | pass | Full suite 9200/343 green. The MCP-MOD-004 snapshot test (`semanticClassifierCatalogSnapshotPrompt`) passes unchanged. The rewritten banner-code assertion (parity test `the derived CLASSIFIER_TO_BANNERS view equals the catalog entry-for-entry`) compares two independently-derived sides (live import vs catalog lookup) — non-tautological. The 4-test `ledger-categories parity` block adds: every category in `ALL_REFEREE_POINT_CATEGORIES`, inversion collision-free, exact 9/14 split, `responds_to_parent` two-category invariant |
| 19 | typecheck + lint pass | pass | both exit 0 |
| 20 | No `git add -A`, no production code touched outside named files, no secret leak | pass | diff touches exactly 12 files (6 code/doc + 6 test files); secret + doctrine scans clean |

## Catalog extension assessment

Both new catalog fields are correctly populated for all 23 ids, with byte-identical Deno
mirror. The implementer picked field names that match the design's `bannerCode` /
`ledgerFeedbackCode` naming convention (`bannerCodePriorityList`, `ledgerCategories`). The
typing posture is deliberate and well-documented: `ledgerCategories: readonly string[]`
rather than `readonly RefereePointCategory[]` so the catalog file stays standalone-pure (no
cross-feature type import), with the parity test enforcing every value belongs to
`ALL_REFEREE_POINT_CATEGORIES`. This is exactly the right tradeoff for a constitution-layer
data file.

The `responds_to_parent` double-category case (`continuity` AND `direct_response`) is
correctly handled: a dedicated parity-test assertion locks it (`semanticClassifierCatalogParity.test.ts:232-239`),
the inversion collision guard at `reconcileMove.ts:189-194` is defensive against accidental
collision in any future catalog edit, the documented `exactly 9 ids carry at least one
ledgerCategories entry; 14 carry none` invariant test gives an arithmetic check (10 (category,
id) pairs from 9 ids matches the pre-refactor 10-entry inline table), and the fuzz test
exercises the live + reference inversion side-by-side on 500 (packet, category) pairs.

## Behavior-preservation confidence

High. The combination of:

- A byte-identical Deno-Node source-span equality (`expect(denoSpan).toBe(nodeSpan)` in
  `semanticClassifierCatalogDenoNodeParity.test.ts:152`), plus dedicated per-field extractors
  for the two new arrays.
- Fuzz parity at the consumption layer: 50 random `selectBanner` packets + 50 random ledger
  l2-signal packets × 10 categories, ALL byte-identical to a frozen local-only reference
  implementation that reads pre-refactor literal tables.
- Catalog-internal invariants: `bannerCode === bannerCodePriorityList[0]` (or both
  null/empty) enforced per id; `ledgerCategories` membership enforced per value.
- Inversion equality: the catalog's inversion produces the SAME 10 (category, id) pairs as
  the frozen pre-refactor `classifierFor` table (`deriveLiveClassifierForFromCatalog()`
  result deep-equals `localOnlyClassifierFor` reference).

…gives me full confidence behavior is byte-identical for every input. If anything drifts in
a future card, at least one of three tests fails with a clear diagnostic.

## Movement B closure note

Confirmed. With MCP-MOD-006 merged, every per-id seam in the semantic-referee surface
(structural question text, family grouping, primary banner code, full banner priority list,
primary ledger feedback code, full ledger category list, optional plain-language label) is
authored exactly once — in `src/lib/constitution/semanticClassifierCatalog.ts` — and
consumed by derived views in `seedPrompt`, `classifierBannerMap`, `reconcileMove`, and
`gameCopy`. Adding a 24th classifier (a v1 catalog change, NOT v0) is now a single-catalog-edit
operation plus the Deno mirror. The "two MCP-MOD-004 documented departures" (banner library +
ledger holding per-id literals separate from the catalog) are closed.

## Actionable findings

None. All 20 checks pass.

## Non-blocking suggestions

1. (very minor) The `localOnlyClassifierFor` reference table in `semanticLedgerFuzzParity.test.ts`
   could expose its 10-entry expected size as a named constant so a future maintainer doesn't
   re-count. Not a blocker; the entries-list invariant test already covers it explicitly.
2. (very minor) The `COMMITTED_SEED` constants are documented "do not change" — a future
   doctrine roll-forward might want to centralize fuzz seeds in a single file. Defer.

## Bottom line

Ready to push and merge. Movement B of the modularity slate is complete.

## Operator next steps

- Push the branch: `git push -u origin feat/MCP-MOD-006-banner-ledger-refactor`
- Open PR: `gh pr create --title "MCP-MOD-006: Banner and ledger refactor (catalog as single source of truth)" --body-file docs/reviews/MCP-MOD-006.md`
- No deploy steps required (client-side only; no migration, no Edge Function redeploy, no
  secret change).
- After merge, the catalog is the single per-id source of truth for the entire semantic-referee
  surface — append-only for v0, with a clear path to v1 when a 24th classifier is added.
