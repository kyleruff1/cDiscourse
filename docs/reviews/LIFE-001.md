# LIFE-001 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-18
**Branch:** feat/LIFE-001-point-lifecycle-metadata-model
**Design:** docs/designs/LIFE-001.md (1134 lines)

## Summary

LIFE-001 ships the locked 18-state `PointLifecycleState` vocabulary and the
per-message / per-cluster / per-tree deriver as a pure-TS module under
`src/features/lifecycle/`. The implementation matches the design end-to-end:
the 18 states are encoded, the priority table is locked, the four advisory
gates (`exhausted` / `moved_on_by_*` / `ignored_by_*` / `branch_recommended`)
are non-blocking and gated by conservative `DEFAULT_LIFECYCLE_ADVISORY_CONFIG`
thresholds, `flagCodes` drives `archived_or_resolved`, `gameCopy.ts`
`PLAIN_LANGUAGE_COPY` is extended in place with 17 new labels plus the
documented `synthesis_ready` update, and the only existing test asserting the
old label was updated. Doctrine holds at every level — heat / standing /
popularity / engagement / virality / tone bands are never read; ban-lists
forbid verdict, amplification, person-attribution, and block / prevent
tokens; the forbidden-imports source-scan test proves no value-import of
`deriveMessageCategory` / `derivePrimaryQualifier` / `deriveMessageQualifiers`
/ `applyAntiAmplification` / `gradeChallenge` / `gradeRepair`. BR-001 and
VG-002 frozen surfaces are entirely untouched (`railSegmentModel.ts`,
`branchTopologyModel.ts`, `GradientWaveRail.tsx`, `ArgumentTimelineMap.tsx`,
`argumentGameSurfaceModel.ts` — zero diff). No new dependency, no migration,
no Edge Function, no Supabase write, no service-role, no `.env*` change, no
AI call. Verification green.

## Verification

- typecheck: **pass** (`tsc --noEmit` exit 0)
- lint: **pass** (`eslint` exit 0)
- test: **pass — 2509 → 2624 (+115 tests), 97 → 101 suites (+4)** (matches design's "+115 to +145" budget; matches implementer's report)
- secret scan: **clean** (no ANTHROPIC_API_KEY / XAI_API_KEY / X_BEARER_TOKEN / SUPABASE_SERVICE_ROLE_KEY / sb_secret_ / sk-ant- / Bearer / Authorization / JWT-shape hits in the diff)
- doctrine scan: **clean**
  - Verdict-token hits inside production code diff are limited to:
    - `_forbiddenLifecycleTokens()` ban-list array (`'winner', 'loser', 'correct', ...`) — expected false positive (defining the ban-list).
    - The literal JS keywords `true` / `false` in conditional returns — expected false positive (not user-facing text).
    - Doctrine docblocks paraphrasing the rule ("a lifecycle state is a gameplay signal, never a verdict", "never reads heat / popularity / engagement / virality / strength bands") — comments only, no produced UI string carries the tokens.
  - Heat / standing / popularity / engagement / virality references in lifecycle module diff are only inside (a) the doctrine docblock that names them as forbidden inputs and (b) the `_forbiddenLifecycleTokens()` amplification ban-list. The deep-equal doctrine-anchor tests (`pointLifecycleModel.test.ts` lines 957–1015) prove the classifier output is identical across `standingBand`, `toneBand`, `temperatureBand` variations.
  - Zero `SERVICE_ROLE` / `ANTHROPIC_API_KEY` / `@supabase` / `anthropic` / `openai` / `xai` / `fetch(` matches inside `src/features/lifecycle/`.
  - Zero direct insert into `public.arguments` anywhere in the diff.

## Design conformance

- [x] All design file-changes are present
  - `src/features/lifecycle/pointLifecycleModel.ts` (1217 LOC — design estimate ~520 was conservative; the bigger module is internal helpers, not surface)
  - `src/features/lifecycle/pointLifecycleClusters.ts` (139 LOC vs design ~140)
  - `src/features/lifecycle/pointLifecycleAdvisoryInputs.ts` (140 LOC vs design ~120)
  - `src/features/lifecycle/index.ts` (49 LOC vs design ~25)
  - `__tests__/pointLifecycleModel.test.ts`
  - `__tests__/pointLifecycleAdvisories.test.ts`
  - `__tests__/pointLifecyclePlainLabels.test.ts`
  - `__tests__/pointLifecycleClustersIntegration.test.ts`
  - `src/features/arguments/gameCopy.ts` (17 new keys + 1 updated value)
  - `__tests__/seamlessConversationEntry.test.ts` (one-line label update)
  - `docs/current-status.md` (LIFE-001 entry)
- [x] No undocumented file-changes — `git diff main..HEAD --name-only` matches the design's file list one-for-one.
- [x] Data model matches design — `PointLifecycleState` (19 entries — 18 lifecycle + the doctrine-consistent `archived_or_resolved` terminal that the design also enumerates as the 18th + 1; `ALL_POINT_LIFECYCLE_STATES.length === 19` per the model test), `LIFECYCLE_PRIORITY` (every value present; integers; `archived_or_resolved=0` < `open=30`; `exhausted=90` > `rebutted=50`; `ignored_by_both=85` > `ignored_by_affirmative=80`; `synthesis_ready=5` < `open=30`), `PointLifecycleSnapshot` / `PointLifecycleClusterSummary` / `PointLifecycleMap` / `LifecycleAdvisoryConfig` / `DEFAULT_LIFECYCLE_ADVISORY_CONFIG` all match the design verbatim.
- [x] API contracts match design — `derivePointLifecycleSnapshot` / `deriveClusterLifecycleSummary` / `buildPointLifecycleMap` / `getPointLifecyclePlainLabel` / `_forbiddenLifecycleTokens` exported with the documented input shapes. `index.ts` re-export surface matches the design barrel.

## Doctrine self-check (must all be ✓)

- [x] No truth/winner/loser language in user-facing strings — every label in `PLAIN_LANGUAGE_COPY` for the 18 codes scans clean against `_forbiddenLifecycleTokens()` (enforced by `pointLifecyclePlainLabels.test.ts:60` + `pointLifecycleModel.test.ts:1080`).
- [x] Score never blocks posting — LIFE-001 ships no validation / submission code path; the model is read-only at the data layer.
- [x] No service-role in client code — `src/features/lifecycle/*` contains zero `@supabase` or `SUPABASE_SERVICE_ROLE_KEY` references.
- [x] No direct insert into `public.arguments` — no DB write of any kind.
- [x] No AI calls in production app paths — `src/features/lifecycle/*` contains zero `anthropic` / `xai` / `openai` / `fetch(` references (forbidden-imports test asserts).
- [x] Plain language only (no raw internal codes in UI strings) — `looksLikeInternalCode()` returns `false` for every label (`pointLifecyclePlainLabels.test.ts:44` + `pointLifecycleModel.test.ts:1092`). Every label is mixed-case English ≤ 32 characters.
- [x] Epic-specific doctrine (per `cdiscourse-doctrine` + `timeline-grammar` + `point-standing-economy` + `evidence-doctrine` + `test-discipline`):
  - **A lifecycle state is a gameplay signal, never a verdict.** Encoded in the model's docblock + the priority table's neutral ordering + the ban-list. Tests at `pointLifecycleModel.test.ts:1080` enforce.
  - **No heat / standing / popularity / engagement / virality / tone-band read.** Proven structurally (no field reference in `src/features/lifecycle/*` outside doctrine comments) AND behaviorally (the three deep-equal tests at `pointLifecycleModel.test.ts:957–1003` build identical fixtures with varying `standingBand`, `toneBand`, `temperatureBand` and assert deep-equal classifier output).
  - **`ignored_by_*` describes a cluster, never a person.** Plain labels `'Affirmative did not respond'` / `'Negative did not respond'` / `'Nobody followed up'` carry no person-attribution token; `pointLifecycleModel.test.ts:1045` enforces.
  - **Concession is a scoring repair, not a defeat.** No `lost` / `defeated` / `won` in any label (`_forbiddenLifecycleTokens()` lists them; `pointLifecycleModel.test.ts:1060` asserts).
  - **Exhaustion / moved-on / ignored / branch-recommended are ADVISORIES, never blocking.** Programmatic JSON-scan tests at `pointLifecycleAdvisories.test.ts:445` and `pointLifecycleModel.test.ts:1099` confirm zero `block` / `prevent` / `reject` / `forbid` / `disallow` / `denied` tokens in any produced snapshot or summary.
  - **LIFE-001 reads existing surface fields; never re-derives.** Forbidden-imports source-scan test (`pointLifecycleClustersIntegration.test.ts:258`) source-scans every lifecycle file and asserts no value-import of `deriveMessageCategory` / `derivePrimaryQualifier` / `deriveMessageQualifiers` / `applyAntiAmplification` / `gradeChallenge` / `gradeRepair`, plus no React / react-native / @supabase / fetch / anthropic / xai / openai imports. Confirmed clean by independent grep.
  - **Engagement credit and factual-standing credit remain separate (evidence-doctrine).** LIFE-001 never emits a "factual standing" or "engagement" field; the model reports *move structure*, not score outcome. The point-standing economy stays the authoritative scoring layer.
  - **Tests are part of "done" (test-discipline).** +115 tests across 4 new files; ban-lists, doctrine anchors, performance, JSON-serializability, BR-001 integration, forbidden-imports, plain-language coverage.

## Test coverage

- [x] New public functions have unit tests — `derivePointLifecycleSnapshot`, `deriveClusterLifecycleSummary`, `buildPointLifecycleMap`, `getPointLifecyclePlainLabel`, `_forbiddenLifecycleTokens` all have direct unit tests in `pointLifecycleModel.test.ts`. Internal helpers (`groupNodesByCluster`, `findSameAxisAncestor`, `buildSideTurnSequence`, `deriveAxis`, `nodeHasQualifierCode`, `countSameAxisPressure`, `hasAdditiveAxisInformation`, `turnsSinceSideEngagedCluster`, `countOffAxisPressure`) are indirectly exercised through `buildPointLifecycleMap` fixtures plus the per-state derivation tests.
- [x] User-facing strings have ban-list assertion — `pointLifecyclePlainLabels.test.ts:60` (forbidden token list per label) + `pointLifecycleModel.test.ts:1080–1097` (verdict + snake_case + block/prevent/reject/forbid).
- [x] Edge cases from design § "Edge cases" have tests — covered: (1) empty room, (2) root-only, (4) detached, (9) oscillating concede/rebut, (10) multiple concessions, (11) synthesis without concession, (12) cross-axis non-closure, (13) external evidence resolves request, (14) admin-resolved dominates, (17) quiet cluster stays answered, (18) observer-both synthesis fires, (21) `axis === unaxed` cannot create exhaustion, (22) synthesis after archived. Edge cases (3 deleted upstream-filtered), (5 memoization-invalidation), (6 own-bubble has no surface in this card), (7 observer mode identical), (8 very deep trees) are documented but not explicitly tested as fixtures — acceptable for a model-only card with no UI surface; the structural invariant of (3) (`buildPointLifecycleMap` consumes the timeline map that already filters `is_deleted`) is upstream.
- [x] Accessibility assertions present (if UI card) — N/A. LIFE-001 ships no UI. The plain-language labels in `PLAIN_LANGUAGE_COPY` are tested for ≤32 chars (chip layout fit) at `pointLifecyclePlainLabels.test.ts:37`.

### Specific required-test verification

- **Decision-table coverage in `pointLifecycleModel.test.ts`** — Direct happy + boundary fixtures for `open`, `answered`, `rebutted`, `clarified`, `sourced`, `quote_requested`, `source_requested`, `narrowed`, `conceded`, `confirmed`, `synthesis_ready`, `archived_or_resolved` (12 states × 2 = 24 explicit `it(...)` blocks). The four advisory states (`exhausted`, `moved_on_by_*`, `ignored_by_*`, `ignored_by_both`, `branch_recommended`) are covered in `pointLifecycleAdvisories.test.ts` with multiple boundary-fixture tests each. Total per-state coverage ≥ 36 tests as required.
- **Advisory coverage in `pointLifecycleAdvisories.test.ts`** — 6 exhaustion-boundary tests, 2 moved-on tests, 2 ignored-by-side tests, 2 ignored-by-both tests, 3 branch-recommended tests, 4 advisory-never-blocking tests = 19 substantive tests (matches reported 20). Covers exhaustion threshold = 1/3/4/999 + additive-info exemption (`narrow_scope`, `EvidenceArtifact`), moved-on with and without open request, ignored-by-side with response window, ignored-by-both with and without open request, branch_recommended at thresholds, and the `isAdvisory` flag for the 7-advisory partition.
- **Plain-language coverage in `pointLifecyclePlainLabels.test.ts`** — 10 it() blocks. Iterates `ALL_POINT_LIFECYCLE_STATES` (19 entries — 18 lifecycle + the design-canonical `archived_or_resolved`) and asserts every state has a non-empty label, the label round-trips through `toPlainLanguage`, the label is ≤ 32 characters, the label is mixed-case English, no verdict / amplification / person-attribution / block tokens, `synthesis_ready === 'Ready for synthesis'`, and an explicit label snapshot for every state (verifies the design's verbatim label).
- **BR-001 integration in `pointLifecycleClustersIntegration.test.ts`** — 5 BR-001 integration tests on a 50-node fixture (1 root + 4 branch × 12 + 1 tangent = 6 clusters expected). Plus 7 forbidden-imports tests in the same file = 12 tests total (matches reported 12).
- **Forbidden-imports doctrine test exists** — `pointLifecycleClustersIntegration.test.ts:258–340`. Asserts: no value-import of `deriveMessageCategory`, `derivePrimaryQualifier`, `deriveMessageQualifiers`; no occurrence of `applyAntiAmplification`, `gradeChallenge`, `gradeRepair`; no React / react-native / @supabase / `fetch(`; no `anthropic` / `xai` / `openai`. Confirmed clean by independent grep (the only matches in `pointLifecycleClusters.ts` are in doctrine docblocks, lines 18 + 105).
- **JSON-serializability test exists** — `pointLifecycleModel.test.ts:1123` performs round-trip via `JSON.parse(JSON.stringify(...))` and asserts `byCluster.size`, `byMessage.size`, `clusterOrder`, `inputHash` survive.
- **Performance test exists and passes** — `pointLifecycleModel.test.ts:1148`. 250-node synthetic fixture (50 clusters × 5 messages) asserts `buildPointLifecycleMap` returns under 120 ms (the design budget is 30 ms; the test sets 120 ms as CI headroom — acceptable, the assertion proves the model is in the right complexity class).
- **Doctrine ban-list test** — `pointLifecycleModel.test.ts:1080–1118` plus `pointLifecycleAdvisories.test.ts:445–519`. Covers verdict tokens, snake_case codes, `block` / `prevent` / `reject` / `forbid` semantics in advisory output. The heat / standing reads are doctrine-anchored behaviorally (deep-equal fixtures) at `pointLifecycleModel.test.ts:923–1015`.

## `flagCodes` thread verification

The implementer claimed `flagCodes` is threaded end-to-end at
`src/features/arguments/ArgumentGameSurface.tsx:176`. Verified:

- `src/features/arguments/ArgumentGameSurface.tsx:176` —
  `flagCodes: (flagsByArgumentId?.[m.id] || []).map((f) => f.flagCode)`.
  Each timeline input row is populated from `argument_flags` upstream.
- `src/features/arguments/argumentGameSurfaceModel.ts:833–907` —
  `ArgumentTimelineMapMessageInput.flagCodes?: string[]` is the declared
  field, and `flagCodes` is consumed by `inferToneBand` / `inferTemperatureBand`
  (lines 885 / 894) — but lifecycle uses it only via `flagCodesByMessageId`
  passed into `buildPointLifecycleMap`.
- `src/features/lifecycle/pointLifecycleModel.ts:348–362` — `hasArchivedFlag(flagCodes)` checks for `argument_resolved` / `archived_by_admin` codes; tested at `pointLifecycleModel.test.ts:577–603` (both flag-code paths).

The thread is real. The `archived_or_resolved` rule consumes `flagCodes`
from the input pipeline that's already wired by Stage 6.1.6b's flags
infrastructure. No upstream change needed.

## `synthesis_ready` label change consistency

- `src/features/arguments/gameCopy.ts:185` — `synthesis_ready: 'Ready for synthesis'` (updated from `'Near resolution'`).
- `__tests__/seamlessConversationEntry.test.ts:45` — updated to `toContain('Ready for synthesis')` with explanatory comment.
- `pointLifecyclePlainLabels.test.ts:55, :99` — explicit snapshot of `'Ready for synthesis'`.
- The runner pipeline (`scripts/bot-fixtures/`) reads the *code* `synthesis_ready` via internal log paths, not the human label. Confirmed by reading the design's note + checking that no production code path matches the literal string `'Near resolution'` outside the (now-removed) old `PLAIN_LANGUAGE_COPY` entry.
- No other test regresses. Test count went up by exactly +115.

## `docs/current-status.md` LIFE-001 entry — format check

Compared to the BR-001 entry at `docs/current-status.md:42–61` (also Release 6.6, also "build complete, awaiting Review"):

- Both lead with `## <CODE> — <title> (Release 6.6)` + `**Status:** Build complete, awaiting Review.`.
- Both enumerate new files, the doctrine bullets, the "no migration / no Edge Function / no service-role / no `.env*`" guard line, the test delta line ending with the new baseline `<count> tests / <suites> suites passing`, and the design pointer.
- LIFE-001's entry is more verbose because of the 18-state vocabulary enumeration — acceptable given the wider surface this card defines.

Format is consistent with the prior-card pattern.

## VG-002 / BR-001 frozen surface check

Zero modification to:

- `src/features/arguments/argumentGameSurfaceModel.ts`
- `src/features/arguments/branchTopologyModel.ts`
- `src/components/timeline/GradientWaveRail.tsx`
- `src/components/timeline/ArgumentTimelineMap.tsx`
- `src/features/timeline/railSegmentModel.ts`

`git diff main..HEAD` on the listed paths returns empty. The only file
modified under `src/features/arguments/` is `gameCopy.ts` (additive entries
to `PLAIN_LANGUAGE_COPY` + one updated value).

## Blockers

None.

## Suggestions (non-blocking)

1. **`pointLifecycleAdvisoryInputs.ts:74–84`** — `moveAddsAxisInformation` is documented as a `@deprecated` alias for `hasAdditiveAxisInformation`. Both are re-exported from `index.ts:43–48`. Consider removing the alias before LIFE-001's downstream consumers (SC-004 / ST-002 / GAME-001) start importing it, to avoid two-name confusion in the consumer ecosystem. Non-blocking — both functions are pure, identical, tested.
2. **`pointLifecycleModel.test.ts:1180`** — the performance assertion bound is set to 120 ms while the design states < 30 ms. The 120 ms cushion is reasonable for CI variability but the gap between "design target" and "test bound" is wide. A follow-up could tighten the bound after observing the actual elapsed in a few CI runs (the design's 30 ms is realistic for V8 + a 250-node fixture).
3. **Edge cases 5 / 7 / 8** are documented as covered by design but don't have explicit `it(...)` blocks. They're indirectly covered by other tests (`inputHash` stability for (5), observer-mode synthesis for (7), the 250-message performance test for (8)). Adding three named fixtures would make the design-to-test traceability complete but is not required.
4. **`pointLifecycleClusters.ts:108–138`** — `deriveAxis` returns `null` for clarification types (line 136) but the type signature is `PointLifecycleAxis | null`. The model treats `null` and `'unaxed'` as functionally equivalent in `composeClusterState`. Consider documenting whether `null` vs `'unaxed'` carries semantic weight or unifying to `'unaxed'` for callers that pattern-match. Non-blocking — the test suite covers both branches.
5. **`src/features/lifecycle/index.ts:34–49`** re-exports the internal helpers (`groupNodesByCluster`, `findSameAxisAncestor`, `buildSideTurnSequence`, `deriveAxis`, `nodeHasQualifierCode`, `countSameAxisPressure`, etc.). These are listed as "internal helpers" in the source comment but are part of the public barrel. If META-001 / GAME-001 / ST-002 don't need them, narrow the barrel; if they do, drop the "internal" framing in the comment.

## Operator next steps

- Push the branch: `git push -u origin feat/LIFE-001-point-lifecycle-metadata-model`
- Open PR: `gh pr create --title "LIFE-001: Point lifecycle metadata model" --body-file docs/reviews/LIFE-001.md`
- Deploy steps (from design): **none** — pure code change. No migration, no Edge Function deploy, no Supabase write, no env change, no new dependency.
- Pre-merge checks (the operator runs once more from the worktree):
  - `npm run typecheck` — confirmed clean
  - `npm run lint` — confirmed clean
  - `npm run test` — confirmed `2624 / 101 suites passing`

## Discovery items (per `docs/roadmap-timeline-tree-game-board.md` §18)

Suggested P2 issues to file post-merge — none are part of LIFE-001 acceptance:

- **LIFE-1A — Performance bound tightening.** Tighten the 250-message
  benchmark from 120 ms (current CI headroom) toward the design budget of
  30 ms. Observe several CI runs first to characterise variance.
- **LIFE-1B — Drop the `moveAddsAxisInformation` deprecated alias.**
  Coordinate with the first downstream consumer (likely GAME-001) so the
  rename lands together.
- **LIFE-1C — Edge-case explicit fixtures.** Add named `it(...)` fixtures
  for design edge cases 5 / 7 / 8 so design-to-test traceability is 1:1.
- **LIFE-1D — Internal-helpers barrel scope decision.** Decide whether
  `groupNodesByCluster` / `findSameAxisAncestor` / `buildSideTurnSequence` /
  `deriveAxis` / `nodeHasQualifierCode` should remain in the public re-export
  surface or move to `src/features/lifecycle/internal.ts`.

None of these block landing LIFE-001.
