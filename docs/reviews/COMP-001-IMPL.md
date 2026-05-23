# COMP-001 — Implementation Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-23
**Branch:** feat/COMP-001-composition-layer
**Commit:** 83213ea
**Design:** docs/designs/COMP-001.md (design review at docs/reviews/COMP-001.md — Approve 12/12)
**Worked examples:** docs/designs/COMP-001-worked-examples.md

## Skills invocation confirmation

- `Skill(cdiscourse-doctrine)` — invoked and read in full.
- `Skill(test-discipline)` — invoked and read in full.

## Summary

COMP-001 ships a pure-TS deterministic composition layer (`composeVisualState`) that maps `SemanticRefereePacket` binary signals + accumulated `CompositionState` + structural `MoveMetadata` to typed `NodeVisualMutation` objects targeting connected `moveId`s. The layer encodes all 22 active composition rules + 2 exemption patterns + 1 PROPOSED-id-guarded rule (R-CAT-SubAxis using `introduces_sub_axis`); the other 11 PROPOSED MCP-CAT-001 ids are deliberately deferred to that card's implementation per the design's §8 stop condition. The function is referentially transparent, frozen, makes no truth claims, contains no verdict / person-label tokens (enforced by the 38-test doctrine-scan suite), and imports nothing from React, Supabase, the network, or any AI SDK (enforced by the 7-test purity suite). Integration into `useSemanticReferee` and `argumentGameSurfaceModel` is strictly additive — the existing public surface is preserved, the new `getMutationsForMove` / `getCompositionState` / `getCrossNodeMutations` accessors are net-new, and the only existing test touched (`useSemanticReferee.test.ts`) was widened to assert the two new methods on the public surface. Smoke-test orchestrator gains a guarded-import diagnostic logger that cannot change the exit code. Tests: 9271 → 9391 (+120 / +8 suites). Typecheck + lint + full test suite all pass.

## Verification

- typecheck: pass (`npm run typecheck` exit 0)
- lint: pass (`npm run lint` exit 0, max-warnings 0)
- test: 9271 → **9391 tests / 357 suites**, all green
- secret scan: clean (no `ANTHROPIC_API_KEY`/`SERVICE_ROLE`/`xai-`/`sk-ant-`/`sb_secret_`/JWT/Bearer in diff)
- doctrine ban-list scan: clean (the only matches in the diff are the literal ban-list constants in `compositionLayerDoctrineScan.test.ts` plus a doctrine recap in `docs/core/current-status.md` — both legitimate)
- no `console.log/error/warn` in production diff
- no `.skip`/`.only`/`xit`/`xdescribe` in diff
- no out-of-scope files in the commit (pre-existing dirty `docs/testing-runs/2026-05-23-*.md` + `assets/branding/semantic-referee.zip` confirmed NOT included)
- no `git add -A` evidence — the named 16 files only

## Per-check verdict matrix

### Doctrine + architectural

| # | Check | Verdict | Note |
|---|---|---|---|
| 1 | Path B confirmation (cwd + branch) | **PASS** | `C:/Users/kyler/cdiscourse/debate-constitution-app`, `feat/COMP-001-composition-layer` |
| 2 | Both skills invoked | **PASS** | `cdiscourse-doctrine` + `test-discipline` read in full |
| 3 | `composeVisualState` is PURE | **PASS** | Imports only `compositionTypes` + `compositionUpstreamSearch` + `CATALOG_BY_ID` (pure data) + types from `semanticRefereeTypes`. No `react`, `expo`, `react-native`, `@supabase/*`, `axios`, `fetch`, `node-fetch`, `@anthropic-ai/*`, `xai`. The purity test scans the source for these literals and they are absent. The function returns synchronously. |
| 4 | `compositionTypes.ts` is PURE | **PASS** | Type declarations + frozen `EMPTY_COMPOSITION_STATE` constant + ordered enum-value array. Only import is type-only from `semanticRefereeTypes`. |
| 5 | `compositionUpstreamSearch.ts` is PURE | **PASS** | Type-only import from `compositionTypes`. Three small synchronous functions; reverse iteration; no async. |
| 6 | `NodeVisualMutationType` doctrine scan | **PASS** | All 35 enum values pass the 38-test doctrine scan. Spot-checked manually: `evidence_debt_opened`, `point_conceded`, `sub_axis_resolved`, `popularity_amplification_warning`, `unplayable_move` — every name describes a structural state, none contain `winner` / `loser` / `truth` / `correct` / `wrong` / `right` / `proven` / `defeated` / `won` / `lost` / `liar` / `dishonest` / `bad faith` / `manipulative` / `extremist` / `propagandist`. |
| 7 | No truth claims in 5 emitted mutations | **PASS** | Spot-checked: R-EV-01 emits `evidence_debt_opened` (structural — debt opened on parent), R-CM-02 emits `point_conceded` + `concession_landed` (structural — concession recorded), R-EV-04 emits `popularity_amplification_warning` on CURRENT only (doctrine §3 — never attaches the warning to the ancestor), R-PC-04 emits `clarification_resolved` (structural — debt cleared), R-CM-03 emits `synthesis_ready` (structural — ready, not won). None describe who's right. |
| 8 | Determinism enforced | **PASS** | `compositionLayerPurity.test.ts` runs `composeVisualState` twice and asserts identical mutations + targets + sources; asserts `Object.isFrozen(nextState)` + `Object.isFrozen(mutations)`; asserts input `threadState` is not mutated. All 7 tests pass. |
| 9 | Binary-contract respected | **PASS** | The function reads `binaries[].value` (0/1) and `binaries[].classifierId` only. It does NOT inspect `reasonCode` text. The signal-lookup helper materializes a `value: 0 \| 1 / confidence: 'low' \| 'medium' \| 'high'` view; rule predicates compare against `=== 1` or `=== 0`. The design's narrow exception (MAY read `confidence` for rule gating) is not exercised in the shipped rules — every guard is on `.value` only. |

### Rule coverage

| # | Check | Verdict | Note |
|---|---|---|---|
| 10 | All 22 + 2 patterns implemented | **PASS** | Verified line-by-line against design §4: R-PC-01..04 (lines 414–492), R-EV-01..07 (496–649), R-CM-01..04 (653–786), R-DM-01..03 (790–824), R-BR-01..04 (828–911), R-EX-01 root (372–386), R-EX-02 first-move-per-author (389–396). Each rule's classifier-id triggers + target node + mutation type match the design. Snapshot tests in `compositionLayerRules.test.ts` (31 tests) cover each rule. |
| 11 | Catalog import — no magic strings | **PASS** | Line 39: `import { CATALOG_BY_ID } from '../../lib/constitution/semanticClassifierCatalog'`. The PROPOSED-id guards call `CATALOG_BY_ID.has(id as SemanticClassifierId)` before firing — no speculative rule execution. Active rules index `sig.get('asks_for_evidence')`, etc.; the classifier-id literals are typed `SemanticClassifierId` so the type system catches drift. |
| 12 | PROPOSED-id guards consistent with §8 | **PASS** | Only `introduces_sub_axis` is wired (R-CAT-SubAxis, lines 919–943) and it's guarded by `classifierInCatalog('introduces_sub_axis')`. The other 11 PROPOSED ids (`disputes_evidence_applicability`, `opens_evidence_debt_marker`, `closes_evidence_debt_marker`, `concedes_with_new_dispute`, `supplies_corroborating_document`, `references_prior_agreement`, `provides_temporal_constraint`, `accepts_partial_with_caveat`, `provides_alternate_interpretation`, `disputes_specific_amount`, `cites_temporal_boundary`) are documented as forward-compat seams in the header (lines 18–25) and NOT referenced in any rule body. The band-space-rent 35-id-mode test (`compositionLayerBandSpaceRent.test.ts` lines 265–283) asserts mutations with PROPOSED signals supplied equal the 23-id mutations — confirming the rules do not misfire speculatively. |

### Scenario replay correctness

| # | Check | Verdict | Note |
|---|---|---|---|
| 13 | Band-space-rent replay matches worked-examples | **PASS** | All 9 tests pass. m3 spot-check: R-PC-01 fires → `parent_engaged_quoted` on m2 (matches worked-examples §1 m3 — Bandmate A quotes Bandmate B); m7 spot-check: R-CM-01 fires → `point_narrowed` on a same-author ancestor (m5) + `narrowing_landed` on m7 AND R-CM-02 fires (`concession_landed` on m7) — matches worked-examples §1 m7. m8 synthesis target falls back to room root (m1) in 23-id mode, exactly as the worked-examples notes for that mode. |
| 14 | Remote-work-productivity replay matches | **PASS** | All 8 tests pass. m5 spot-check: R-EV-04 fires → `popularity_amplification_warning` on m5 only (doctrine — never on the ancestor), R-EV-07 fires → second `source_chain_gap_flagged` on m5; m8 spot-check: R-CM-03 fires → `synthesis_ready` on m1 (room root, since 23-id mode has no sub-axis state) + `synthesis_offered` on m8, R-BR-01 fires → `side_branch_suggested` on m8 + `branch_route_hint` with `edgeOtherEndpointMoveId: 'm7'`. Matches worked-examples §2. |

### CompositionState lifecycle

| # | Check | Verdict | Note |
|---|---|---|---|
| 15 | `CompositionState` shape matches design §3 | **PASS** | `evidenceDebts: ReadonlyMap`, `clarificationDebts: ReadonlyMap`, `activeSubAxes: ReadonlyMap`, `concessionChains: ReadonlyMap`, `sourceChainGaps: ReadonlyMap`, `narrowingLinks: ReadonlyMap`, `personShiftMoves: ReadonlySet`, `unplayableMoves: ReadonlySet`, `synthesisReadiness: SynthesisReadinessState` — all present, all readonly, all typed exactly per design §3. `EMPTY_COMPOSITION_STATE` is frozen + uses empty `Map`/`Set` initializers. |
| 16 | Lifecycle transitions per design §3.3 | **PASS** | Evidence debt: R-EV-01 inserts `EvidenceDebtState { status: 'open' }` (line 506); R-EV-02 transitions to `'resolved'` with `resolvingMoveId` (line 518); R-EV-06 retraction can also resolve an open debt against the retracted ancestor (line 620–631). Clarification: R-PC-03 opens (line 456); R-PC-04 resolves (line 468). Sub-axis: R-BR-02 abandons an open sub-axis (line 871); R-CM-02 resolves the open sub-axis when concession lands (line 730). Source-chain gap: R-EV-07 opens (line 645); R-EV-02's downstream branch can fill it (line 536). All transitions exercised by tests. |

### Integration

| # | Check | Verdict | Note |
|---|---|---|---|
| 17 | `useSemanticReferee` integration is ADDITIVE | **PASS** | Existing methods (`onMovePosted`, `getMoveState`, `confirmOverride`, `getOverrideRecords`, `repeatedSignal`) are unchanged. New `getMutationsForMove` + `getCompositionState` are pure accessors over two new `useRef`s (`compositionStateRef`, `mutationsByMoveIdRef`). The composition call is inlined into `finalizeReady` after the packet is in hand; it is pure / sync so it cannot block the existing flow. The cache-hit branch correctly passes `null` for the composition inputs (line 475) — preventing double-counting debts when the same packet is replayed from cache. The `useSemanticReferee.test.ts` update is semantically equivalent: it widens the public-surface assertion to include the two additive method names. |
| 18 | `argumentGameSurfaceModel` extension is optional + non-breaking | **PASS** | `crossNodeMutations` field on `ArgumentSurfaceState` is OPTIONAL (`crossNodeMutations?: ReadonlyMap<...>`). `getCrossNodeMutations` is a pure new helper that returns `[]` when the map is absent. The import is `type`-only, so no runtime coupling. No existing test was modified. |
| 19 | Smoke-test orchestrator is diagnostic-only | **PASS** | The composition module import (lines 41–53) is wrapped in try/catch. The composition call (line 309–344) is wrapped in try/catch. Failures append `moveLog.compositionError` but do NOT change the run's exit code, `halt`, or any other control flow. The `composition` field is only attached to the per-move log when the layer was successfully imported AND the call succeeded. |

### Regression checks

| # | Check | Verdict | Note |
|---|---|---|---|
| 20 | All existing tests pass | **PASS** | `npm run test` reports **9391 passed / 357 suites** — exactly the expected count. The one modified existing test (`useSemanticReferee.test.ts`) was updated additively to expect the two new public-surface keys. |
| 21 | typecheck + lint pass | **PASS** | `tsc --noEmit` exit 0. `eslint . --ext .ts,.tsx --max-warnings 0` exit 0. |
| 22 | No `git add -A` evidence + no out-of-scope changes + no secret leak | **PASS** | `git diff main..HEAD --name-only` lists exactly the 16 named files. Pre-existing dirty files (`docs/testing-runs/2026-05-23-ai-driven-bot-corpus-dry.md`, `docs/testing-runs/2026-05-23-engagement-epidemiology-synthetic.md`, `assets/branding/semantic-referee.zip`) confirmed NOT in the diff. Secret scan over the full diff is clean. |

## Test-discipline conformance

- All 8 new test files are in `__tests__/` (top-level suite location).
- The pure-model tests (rules, edge cases, doctrine scan, purity, replays, upstream search) import only the pure modules; no React, no Supabase, no fetch.
- The hook integration test (`useSemanticRefereeComposition.test.tsx`) uses `@testing-library/react-native` + a Jest mock of `classifyMove` — that is the established pattern in this repo for the existing `useSemanticReferee.test.ts`.
- No `.skip` / `.only` / `xit` / `xdescribe` introduced.
- No committed `console.log` / `console.error` / `console.warn` in production code (smoke-test orchestrator `console.log` calls are pre-existing diagnostic; the COMP-001 additions follow that same convention and are in `scripts/`, not `src/`).
- The doctrine-scan test (`compositionLayerDoctrineScan.test.ts`, 38 tests) iterates every enum value AND every emitted mutation under an all-ones packet — meaningful coverage, not a token check.
- The purity test (`compositionLayerPurity.test.ts`, 7 tests) physically scans the source files for forbidden import literals — drift-proof.
- Test count rose from 9271 to 9391 (+120) and from 349 to 357 suites (+8) — net upward as the discipline requires.

## Behavior assessment

The composition layer is **additive only** for v1 UI: mutations are stored on the hook + exposed via `getMutationsForMove` and on `ArgumentSurfaceState.crossNodeMutations` via `getCrossNodeMutations`, but no existing rendering code consumes them yet (downstream UI cards will). This is the right call — the layer's correctness can be regression-tested independently of any visual treatment, and the absence of rendering consumers means there is zero behavior change for shipped UI. Composition is referentially transparent (deep determinism test), immutable (input untouched), bounded (rule list is finite, signal-lookup is O(1)), and the cache-hit branch correctly avoids double-composition.

## Rule coverage assessment

- **22 active rules** implemented: R-PC-01..04 (4), R-EV-01..07 (7), R-CM-01..04 (4), R-DM-01..03 (3), R-BR-01..04 (4). Confirmed by direct line-by-line read of `compositionLayer.ts` against design §4.
- **2 exemption patterns**: R-EX-01 (root proclamation) and R-EX-02 (first-move-per-author). Both correctly preempt classifier-driven rules.
- **1 PROPOSED rule guarded**: R-CAT-SubAxis on `introduces_sub_axis`, runtime-gated by `CATALOG_BY_ID.has(...)`. Consistent with design §8 stop condition: COMP-001 ships with rules for the current 23-id catalog; the 11 additional rules ship with MCP-CAT-001. The 35-id parity test confirms no speculative firing.

## Actionable findings

None.

## Bottom line

Ready to push and merge. The driver can:

1. `git push -u origin feat/COMP-001-composition-layer`
2. `gh pr create --title "COMP-001: deterministic composition layer for connected-node visual state" --body-file docs/reviews/COMP-001-IMPL.md`
3. Merge after CI green.

No code changes needed. No re-design needed.
