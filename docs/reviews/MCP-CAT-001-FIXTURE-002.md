# MCP-CAT-001-FIXTURE-002 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-06-05
**Branch:** feat/mcp-cat-001-fixture-002 (HEAD `1225b40`; design `e49b5c3`; base `20264cc`)
**Design:** docs/designs/MCP-CAT-001-FIXTURE-002.md
**Closes:** #452 (RECONCILE) + #453 (COVERAGE)
**Gate:** GATE C (dev-tooling: fixtures + tests only — no migration, no Edge, no UI)

## Summary

A clean, well-scoped fixture/test-only card that closes the two halves of the
MCP-CAT-001 §I open questions. Deliverable A reconciles the design fixture
`catalog-design-band-space-rent-evidence.json` to the ratified 35-id catalog
(`cites_temporal_boundary` → `provides_temporal_constraint` with source tag
`current_catalog`; `disputes_specific_amount` deleted everywhere with no
successor) — six surgical edits that exactly match the design's A.2 mapping
table. Deliverable B adds a runnable 10-move coverage fixture that positively
exercises every under-exercised catalog id the band-space-rent scenario never
fires, replayed through the already-shipped `composeVisualState` (COMP-001) with
**zero runtime change** — the #453 conditional resolved to no-change as the
design predicted. The full suite is green (647 suites / 19559 tests, exit 0),
typecheck and lint are clean, the secret/doctrine scans are clean, and no `src/`
or `supabase/` file is touched. No concerns remain.

## Verification
- typecheck: **pass** (exit 0)
- lint: **pass** (exit 0, `--max-warnings 0`)
- test: 646 → **647 suites** / 19540 → **19558 passed + 1 skipped = 19559 total** (exit 0; matches implementer claim)
- Migration apply: **n/a** — no file under `supabase/migrations/**` (migration-bearing section does not trigger)
- secret scan: **clean** (ANTHROPIC/XAI/X_BEARER/SERVICE_ROLE/sk-ant/JWT/Bearer/Authorization — no hits)
- doctrine scan: **clean** (the only `public.arguments`/verdict-token grep hits are (a) a pre-existing ADMIN-ARGS-CANONICAL-001 *negation* comment present at the merge-base `20264cc` and surfaced only as diff context, and (b) the new test's own `DOCTRINE_TOKENS`/`FORBIDDEN_TERMS` ban-list vocabulary — neither is fixture prose)
- isolated re-run: `compositionLayerCatalogCoverage` + `argumentScenarioValidation` + `compositionLayerBandSpaceRent` = 75 tests, exit 0 (no flake)

## Design conformance
- [x] All design file-changes are present (2 fixtures, 2 test files, current-status.md, the design doc)
- [x] No undocumented file-changes (`git diff --name-only` = exactly the 6 expected files; zero under `src/`/`app/`/`supabase/`/`scripts/`/`mcp-server/`)
- [x] Data model matches design (no data-model / type / catalog change — confirmed)
- [x] API contracts match design (no interface change; replay uses the existing `composeVisualState` signature read-only)

### Deliverable A (#452 RECONCILE) — conforms exactly
- m8 `expectedClassifierSignal`: `disputes_specific_amount` DELETED; `cites_temporal_boundary` → `provides_temporal_constraint` with `source: "current_catalog"`. m8 carries **exactly one** `provides_temporal_constraint` (fixture line 586). ✓
- m8 `expectedDeterministicComposition.input`: `cites_temporal_boundary=1` → `provides_temporal_constraint=1`; `disputes_specific_amount=1` deleted. ✓
- `proposedClassifierNeeds`: both `disputes_specific_amount` and `cites_temporal_boundary` candidate objects deleted (the survivor `provides_temporal_constraint` retains its own entry at line 731). ✓
- `compositionRules` `evidence_backed_sub_axis_resolution_ready_for_synthesis` inputPattern: same rename + delete. ✓
- **ZERO remaining occurrences** of either retired id in `fixtures/**` (the 8 doc-file hits are historical design/review/testing-run narrative, correct to retain). Both retired ids are absent from `src/` and `supabase/`, confirming the catalog never carried them and the reconcile is genuinely fixture-only. ✓
- `provides_temporal_constraint` is a real member of the ratified catalog (`semanticRefereeTypes.ts:61,175`). ✓
- Regression target `compositionLayerBandSpaceRent.test.ts` green with zero changed assertions (the design's "net delta = zero" prediction held). ✓

### Deliverable B (#453 COVERAGE) — conforms exactly
- New runnable fixture `catalog-coverage-satire-popularity-routing.json` (10 moves, `category: smoke_test_mcp`, runnable-scenario shape). ✓
- Every B.1 primary target id fired on an eligible (non-root, non-author-first) move and asserted in the replay roll-up. ✓
- **NO `src/` and NO catalog/runtime/prompt change** — the "unless a mismatch is found" conditional resolved to no-change; the additive verification produced green tests against the already-shipped runtime. ✓
- New fixture **registered** in the hardcoded `files[]` array in `argumentScenarioValidation.test.ts` (adds the 4-assertion validation group). ✓

## Doctrine self-check (all ✓)
- [x] No truth/winner/loser language in user-facing strings — fixture is a dev artifact; the doctrine ban-list scan (new test §B.6#2) asserts zero verdict/person tokens across every fixture string; word-boundary grep of the fixture prose confirms clean (the only `true` matches are JSON booleans `branchCandidate`/`hasBranchCandidate`, which the scan correctly excludes by scanning string values only)
- [x] Score never blocks posting — n/a (no scoring/gate code touched); every fixture move `expectedStatus: "posted"`
- [x] No service-role in client code — n/a + scan clean
- [x] No direct insert into public.arguments — confirmed (the grep hit is a pre-existing negation comment in context, not this card's change)
- [x] No AI calls in production app paths — n/a; the only execution is the pure, side-effect-free `composeVisualState`; replay packets carry `authoritative: false`
- [x] Plain language only — no user-facing strings added; no raw classifier id leaks to a user surface
- [x] Epic-specific doctrine (cdiscourse-doctrine §3 popularity-is-not-evidence + §10a composer-only sensitive Observations): the m5 popularity exhibit frames the appeal as *flagged* (`popularity_amplification_warning`), never as the claim being upheld; the m8 friction body (`shifts_to_person_or_intent` / `contains_unplayable_insult_only` / `needs_pre_send_pause`) is written clean — the structural signal marks the drift while the prose contains no insult and no banned token, and the replay asserts those mutations target m8 itself (never the parent), exactly the composer-only boundary §10a requires

## Test coverage
- [x] New public functions have unit tests — n/a (no new source); the new replay test exercises the existing `composeVisualState` against the new fixture
- [x] User-facing strings have ban-list assertion — the new test's §B.6#2 block scans all fixture strings against both the doctrine token list AND the validator `FORBIDDEN_TERMS` (incl. literal `truth`/`ban`/`hide`/`manipulation`)
- [x] Edge cases from design § "Edge cases" have tests — verbatim `targetExcerpt` (verified m2–m8 against parent bodies + enforced by the registered validation test), `fits_selected_debate_mode=0` present-with-value-0 (m3), satire id vs satire-as-evidence id both set (m4), person-shift body purity (m8 doctrine scan), exemption realism (root/author-first → no packet, asserted on m1/m2/m9)
- [x] Accessibility assertions present — n/a (not a UI card)
- [x] No `.skip`/`.only`/`xit`/`xdescribe`/`fit` added (the lone `.skip` grep hit is design-doc prose); test count goes UP (+1 suite / +18 passing); the 1 skipped total is pre-existing

## Blockers
None.

## Suggestions (non-blocking)
1. The README still claims the validation suite "auto-discovers" fixtures while
   the test uses a hardcoded `files[]` list — the design flags this as an
   out-of-scope follow-up. Worth a separate card to make discovery genuinely
   dynamic so future fixtures are validated without a manual registration line.
2. m3 still tags `provides_temporal_constraint` with `source: "PROPOSED_new_id"`
   (fixture line 297) — a pre-existing documentation-only inconsistency the
   design explicitly chose not to touch (A.3 / Risks: `source` is read by no
   test today). Harmless; a future `source`-consistency card could normalize it.

## Operator next steps
- Push the branch: `git push -u origin feat/mcp-cat-001-fixture-002`
- Open PR: `gh pr create --title "MCP-CAT-001-FIXTURE-002: catalog fixture reconcile + under-exercised-id coverage (#452 #453)" --body-file docs/reviews/MCP-CAT-001-FIXTURE-002.md`
- Deploy steps: **none** — pure fixtures + tests; no migration (`npx supabase db push`), no Edge deploy (`npx supabase functions deploy`), no env var, no UI. Merges as a normal dev-tooling PR.
- Post-merge: the branch is behind `origin/main` only by the unrelated hotfixes (`4f259e9` ADMIN-ARGS-CANONICAL-001 + `d5bc837` profiles-embed) with no overlap — a squash-merge / rebase resolves cleanly.
- Post-merge worktree cleanup: see roadmap-reviewer § "Post-merge worktree cleanup (operator step)".
