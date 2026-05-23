# MCP-CAT-001 — Review verdict

**Branch:** `feat/MCP-CAT-001-catalog-extension`
**Final commit:** `873d43e` — "MCP-CAT-001: catalog v1 — extend SEMANTIC_CLASSIFIER_CATALOG from 23 → 35 ids; activate composition rules"
**Design source-of-truth:** `docs/roadmap-expansions/2026-05-23-binary-classifier-catalog-design.md` + `docs/designs/COMP-001-worked-examples.md` + operator addendum (Path B card — no GitHub issue).
**Reviewer agent run:** 2026-05-23

## Skill attestation

- `cdiscourse-doctrine`: invoked ✓ (verdict/person tokens, rules-engine purity, no AI in production, secrets policy, plain language)
- `test-discipline`: invoked ✓ (test discipline, cascade-test integrity, no skip/only, count goes up not down)

## Mid-run verifications

- [x] **V1 — Deno mirror byte-parity confirmed.**
  `diff <(sed -n '154,679p' src/lib/constitution/semanticClassifierCatalog.ts) <(sed -n '102,627p' supabase/functions/_shared/semanticReferee/semanticClassifierCatalog.ts)` produced ZERO output for the entry data sections. Header docstrings differ by design (Node references MCP-MOD-005 / MCP-MOD-006 chain and `gameCopy` fallback; Deno references the Jest bridge + parity test mechanism). The structural rows (id, binarySignal, structuralQuestion, family, bannerCode, bannerCodePriorityList, ledgerFeedbackCode, ledgerCategories) are byte-equal across all 35 entries, confirmed both by the diff above and by the existing parity test `__tests__/semanticClassifierCatalogDenoNodeParity.test.ts` (PASS) which iterates id literals + bannerCode + ledgerCode + family + bannerCodePriorityList + ledgerCategories extractors at 35 entries each.

- [x] **V2 — Content-safety / reason-code whitelist covers all new reason-code family prefixes.**
  The codebase uses FAMILY prefixes (not per-id prefixes). Inspection of `src/features/semanticReferee/semanticRefereeTypes.ts:247-257` confirms the whitelist now lists `['parent_continuity', 'branch_routing', 'evidence', 'source_chain', 'movement', 'mode_fit', 'friction', 'banner', 'settlement']` — `settlement` is the only new family because the 11 other new ids inherit from existing `evidence` / `movement` families. The validator at `src/features/semanticReferee/semanticRefereeValidator.ts:368-377` performs `value === family || value.startsWith(`${family}_`)` matching. The new `__tests__/mcpCat001ReasonCodeWhitelist.test.ts` (PASS) confirms:
  - the existing 8 families are preserved (no regression);
  - `settlement_proposed` / `settlement_terms_accepted` are accepted;
  - `settlement_winner_takes_all`, `settlement_true_resolution`, `settlement_proven_terms` are REJECTED with `verdict_token`;
  - `settlement_troll_terms`, `settlement_propagandist_offer` are REJECTED with `person_label`.
  Deno-side `contentSafetyScan.ts` does NOT use a family-prefix scan — it only scans tokens — so the Deno mirror needs no `REASON_CODE_FAMILIES` addition. Correct architectural split.

- [x] **V3 — Every new or un-stubbed composition rule has a rationale comment with a worked-example reference.**
  In `src/features/semanticReferee/compositionLayer.ts`:
  - L929-930: R-CAT-SubAxis cites band-space-rent m7 (35-id mode)
  - L957-958: R-EV-APP-01 cites band-space-rent m3 (35-id mode) + the `prior_agreement_cited` and `temporal_constraint_provided` sub-rules
  - L1002-1003: R-CAT-QualifiedConcession cites band-space-rent m4 (35-id mode)
  - L1033-1035: R-CAT-Corroborating cites band-space-rent m6 + m8 (35-id mode)
  - L1050-1061: R-CAT-Settlement carries the operator-extension justification — names the band-space-rent fixture's `expectedSettlement` and `permittedSettlementLanguage` whitelist, explains the settlement structural-question doctrine ("resolution terms, never verdict on truth"), and acknowledges the rule is not in the worked-examples doc. All 5 rationale comments are in source.

- [x] **V4 — SEED_PROMPT_VERSION unchanged by this card.**
  `git diff main..HEAD -- supabase/functions/_shared/semanticReferee/seedPrompt.ts` produces ZERO output. The current value `SEED_PROMPT_VERSION = 'mcp-semantic-referee-prompt-v2'` (file L46) was bumped from v1 → v2 in commit `980ebea` (MCP-MOD-008, adding `priorMovesRedacted`); that is the legitimate baseline. MCP-CAT-001 grows the catalog (the prompt iterates it) but does NOT change the prompt's structural shape — instruction text, worked-example block, redacted-input block layout are unchanged. Implementer's documented decision matches MCP-MOD-005's design rule for when to bump.

## Standard checks

- [x] **Doctrine §1/§4 — no verdict/person tokens.**
  - 12 new `binarySignal` strings + 12 new `structuralQuestion` strings: scanned by `mcpCat001NewClassifierIds.test.ts` describe `'MCP-CAT-001 — binarySignal doctrine scan'` (PASS) for verdict + person tokens + `bad faith` phrase + `forbiddenSettlementLanguage` (`proven`, `true`, `false`, `winner`, `loser`, `case closed`, `right`, `wrong`, `correct`, `incorrect`, `victory`, `defeated`).
  - 8 new `NodeVisualMutationType` enum values: scanned by `compositionLayerDoctrineScan.test.ts` `'mutation type "%s" contains no verdict or person-label token'` (PASS) which iterates the live `ALL_NODE_VISUAL_MUTATION_TYPES`.
  - 24 new banner copy entries: scanned by the existing `refereeBannerBanList.test.ts` which iterates the whole library (PASS — implicit in the 9542/360 full-suite run).
  - 24 new `gameCopy` plain-language entries: scanned by the existing gameCopy ban-list tests (PASS — implicit in the full-suite run).
  - The new doctrine-scan in `mcpCat001CompositionRules.test.ts` `'every MCP-CAT-001 mutation value carries no banned token'` (PASS) fires every new rule on an all-12-ones packet and asserts each emitted mutation has zero banned-token substrings.

- [x] **Doctrine §3 — Rules engine purity.**
  `src/features/semanticReferee/compositionLayer.ts` imports only `CATALOG_BY_ID` (pure-TS catalog), local `compositionTypes`, local `compositionUpstreamSearch`, and types from `semanticRefereeTypes`. No new Supabase / React / network / Anthropic / xAI imports. `compositionLayerPurity.test.ts` (PASS) enforces this property by scanning the module source.

- [x] **Doctrine §6 — security.**
  - Secret scan: `git diff main..HEAD | grep -iE 'ANTHROPIC_API_KEY|XAI_API_KEY|X_BEARER_TOKEN|SUPABASE_SERVICE_ROLE_KEY|sb_secret_|sk-ant-|Bearer |Authorization:|eyJ[A-Za-z0-9_-]{20,}'` → zero output.
  - Service-role / API-key scan in `src/` / `app/`: zero matches.
  - No new AI-call sites (catalog + composition layer + banner library are all pure-TS consumers of upstream packets; they never originate a model call).
  - No `.env*` touched. No migration. No Edge Function added or modified by this branch.

- [x] **Test discipline — cascade tests updated, not weakened.**
  Verified each of the 10 modified test files preserves or strengthens its property:
  - `compositionLayerBandSpaceRent.test.ts`: **STRENGTHENED.** The 23-id mode filter is now a HARDCODED LITERAL of the catalog v0 ids (L69-94) instead of being derived from `ALL_SEMANTIC_CLASSIFIER_IDS` — preventing silent regression-baseline drift. The 35-id-mode test was rewritten from a strict-equality check into a superset check with the documented R-CM-03 retarget on m8 (the one intentional 35-id-mode tightening per the worked-examples doc), plus two NEW explicit assertions verifying R-CAT-SubAxis fires on m7 and R-CM-03 retargets from m1 to m7 on m8. Test count went 9 → 11.
  - `refereeBannerLibrary.test.ts`: count 103 → 127 (24 new entries, matches diff). Coverage assertion `keys exactly the 35-id SemanticClassifierId catalog` strengthened from `23` to `35`.
  - `semanticAnthropicSeedPromptBanList.test.ts`: count 23 → 35; no assertion removed; the per-id ban-list scan still iterates the live catalog.
  - `semanticBannerFuzzParity.test.ts`: 12 new entries added to the frozen reference table (rationale comment cites mirror of `bannerCodePriorityList`).
  - `semanticBatching.test.ts`: A-E → A-H groups (3 new, 4 ids each); partition + disjoint + union assertions still fire, just with new totals.
  - `semanticClassifierCatalogDenoNodeParity.test.ts`: all 6 per-id extractors check `35` entries on each side; equality assertion unchanged.
  - `semanticClassifierCatalogParity.test.ts`: length 23 → 35; with-cat 9 (unchanged), without-cat 14 → 26 (with documented rationale); null-ledger 12 → 24 (with documented rationale).
  - `semanticLedgerFuzzParity.test.ts`: documented 14-id set extended to 26-id set listing all 12 new ids explicitly.
  - `semanticPlainLanguageParity.test.ts`: reference table extended with 12 explicit `null` entries (with rationale).
  - `semanticRefereeClassifierCatalogParity.test.ts`: inventory doc length 23 → 35.
  None of the modifications skip, xfail, or weaken an assertion. The count-update pattern is "documented expected delta with rationale comment", not "loosen the predicate". Zero `.skip` / `.only` / `xit` / `xdescribe` added across the diff.

- [x] **Test discipline — new test coverage adequacy.**
  Three new test files (`mcpCat001NewClassifierIds.test.ts`, `mcpCat001CompositionRules.test.ts`, `mcpCat001ReasonCodeWhitelist.test.ts`) cover, per the targeted MCP-CAT-001 jest run, 186 tests across 5 suites including 3 new + 2 existing cascade tests. Coverage map:
  - **All 12 new ids in the union + catalog:** asserted by `mcpCat001NewClassifierIds` describe `'all 12 new ids present'` and `'catalog grew by exactly 12 entries (23 + 12 = 35)'`.
  - **Catalog entry shape:** every new id has populated `binarySignal`, `structuralQuestion`, `family`, `bannerCodePriorityList`, `ledgerCategories`; structural-only convention verified (`startsWith('Does this move')`, `endsWith('?')`).
  - **Banner mapping:** every new bannerCode resolves in `BANNER_BY_CODE`; every entry in `bannerCodePriorityList` resolves.
  - **5 activated composition rules:** R-CAT-SubAxis (positive + negative case + SubAxisState recorded), R-EV-APP-01 (3 sub-rules + combined m3-shape input), R-CAT-QualifiedConcession (both + combined m4-shape), R-CAT-Corroborating, R-CAT-Settlement (both proposes + accepts + negative case).
  - **Reason-code whitelist:** `settlement` family accepted; existing 8 families preserved; verdict tokens rejected even with the new family prefix (`settlement_winner_takes_all` still fails); person-label tokens rejected even with the new family prefix; unknown family prefixes still rejected. Both settlement ids round-trip through `parseSemanticPacket`.
  - **Frozen-state property:** every new catalog entry is `Object.isFrozen`; `SEMANTIC_CLASSIFIER_CATALOG` itself remains frozen.
  Net delta: +151 tests / +3 suites (per current-status.md and confirmed by `npx jest --listTests | wc -l` 357 → 360).

- [x] **No CompositionState shape change.**
  `git diff main..HEAD -- src/features/semanticReferee/compositionTypes.ts` adds ONLY 8 entries to the `NodeVisualMutationType` union (lines after `'opening_claim_marker'`) plus 8 entries to `ALL_NODE_VISUAL_MUTATION_TYPES`. No change to `CompositionState` field list. The `activeSubAxes` field used by R-CAT-SubAxis (verified via `grep -n "sub_axis_opened\|activeSubAxes\|SubAxisState" compositionTypes.ts`: L62, L114, L133, L170, L233) was already present from COMP-001 — the diff confirms it was not re-added.

## Verification battery

- `npm run typecheck`: **PASS** (exit 0)
- `npm run lint`: **PASS** (exit 0)
- `npm run test`: **PASS** (9542 tests / 360 suites passing, 0 failures, 0 snapshots)
- Targeted MCP-CAT-001 + cascade suites (`mcpCat001*` + `compositionLayerDoctrineScan` + `compositionLayerBandSpaceRent`): 186 / 186 PASS across 5 suites
- Secret scan against diff: clean
- Doctrine scan against added lines: only meta-comments and ban-list-test definitions hit (no new user-facing copy carries a banned token)

## Findings

No blocking issues found. Non-blocking observations:

1. **(Praise)** The 23-id-mode hardcoded literal in `compositionLayerBandSpaceRent.test.ts` (L69-94) is the right move — without it, the regression baseline would silently follow the catalog forward, defeating the purpose of a baseline. The 4-line comment justifying the hardcoding is explicit. This pattern should be replicated for any future catalog extension.

2. **(Praise)** The `classifierInCatalog()` runtime guard on each new MCP-CAT-001 rule (compositionLayer.ts L932, L960, L973, L986, L1005, L1018, L1037, L1063, L1076) is appropriate belt-and-suspenders — a future card that retires an id will degrade cleanly. Implementer's note that "the runtime catalog guards remain as belt-and-suspenders safety so a future card that removes an id degrades cleanly instead of throwing" (L920-923) accurately describes the design intent.

3. **(Observation, non-blocking)** `opens_evidence_debt_marker` and `closes_evidence_debt_marker` have catalog entries and banner codes but no dedicated composition rule (per implementer's conservatism note in current-status.md). They surface through banners only. This is consistent with the worked-examples doc's "Note: R-EV-01 fires whether or not `opens_evidence_debt_marker` is available. The proposed signal would tighten the rule…" and the task spec's "conservative recommendation". A future card can tighten R-EV-01 if the rhetorical-vs-structured ask distinction becomes necessary.

4. **(Observation, non-blocking)** The operator-deploy follow-up `npx supabase functions deploy semantic-referee --linked` is correctly identified in the status entry. The Supabase GitHub integration auto-deploy may handle this on merge to main per the memory note `supabase-merge-autodeploy.md`; if so, no manual step is required.

## Verdict

**approve**

All four mid-run checkmarks verified. All standard checks pass. All 9542 tests / 360 suites green. Doctrine clean across binarySignals, structuralQuestions, mutation enums, banner copy, ledger codes, reason codes. Tests strengthened in the cascade (not weakened). Three new test files cover new ids + composition rules + whitelist behavior with positive + negative cases. Composition layer purity preserved. No CompositionState shape change. No new secrets, no service-role usage, no direct insert into `public.arguments`, no production-app AI calls. Settlement extension is documented as operator-derived and grounded in the band-space-rent fixture's `permittedSettlementLanguage` / `forbiddenSettlementLanguage`. Implementer decisions on what NOT to do (no SEED_PROMPT_VERSION bump, no R-EV-01 tightening, no opens/closes evidence-debt-marker rules) are conservatively scoped and documented.

## Operator next steps

- Push the branch: `git push -u origin feat/MCP-CAT-001-catalog-extension`
- Open PR: `gh pr create --title "MCP-CAT-001: catalog v1 — extend SEMANTIC_CLASSIFIER_CATALOG from 23 → 35 ids" --body-file docs/reviews/MCP-CAT-001.md`
- After merge: confirm Supabase GitHub integration auto-redeploys `semantic-referee` Edge Function (per `supabase-merge-autodeploy.md`). If manual deploy is needed: `npx supabase functions deploy semantic-referee --linked`.
- No migration. No secret change. No admin runtime-config change.
- Live Anthropic provider will start receiving requests for the new ids once MCP-002's per-moment requested-classifier policy is taught about them (future card); until then the new ids land dormant on the contract.
- Rollback: `git revert` the merge commit — the new ids disappear from both mirrors, the banner library drops the 24 new entries, the composition rules drop the new mutation types, and the catalog returns to its 23-id v0 shape.
