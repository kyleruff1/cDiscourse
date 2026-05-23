# Review — SMOKE-FIX-002

**Verdict:** Approve
**Reviewer:** roadmap-reviewer (agent)
**Branch:** feat/SMOKE-FIX-002-seed-prompt-enum-coverage
**Checkout:** C:/Users/kyler/cdiscourse/debate-constitution-app (main checkout — Path B, no worktree)
**Commits reviewed (7, oldest → newest above merge base `75e6965`):**

- `e990abc` — design: SMOKE-FIX-002 — tighten seed prompt to enumerate routeSuggestion and frictionSuggestion
- `ec2b80e` — feat(SMOKE-FIX-002): enumerate routeSuggestion + frictionSuggestion enum values in seed prompt
- `c40bfed` — feat(SMOKE-FIX-002): add worked-example packet block to seed prompt
- `3ca9eba` — feat(SMOKE-FIX-002): bump SEED_PROMPT_VERSION to v1 after wording change
- `4c559ef` — test(SMOKE-FIX-002): source-scan test for enum coverage and worked example
- `4add358` — docs(SMOKE-FIX-002): record seed prompt v1 + enum enumeration footnote
- `4617cb8` — fix(SMOKE-FIX-002): align semanticAnthropicCore version literal + implementer note

## Summary

SMOKE-FIX-002 lands the narrow Option B2d remediation that SMOKE-FIX-001's diagnostic lines named: tighten `seedPrompt.ts`'s user-message instruction so the model sees the 7 `routeSuggestion` and 8 `frictionSuggestion` enum values verbatim, add a one-shot worked-example packet block, and bump `SEED_PROMPT_VERSION` from v0 to v1. Three source files + one new test + one doc footnote — exactly the footprint the design promised. All three gates green; the previously-flaky `diagnosticInspectPackage` suite is also green this run (331/331). Both implementer-note corrections in §13 are within-spirit one-line / one-strip-step adjustments that follow directly from §5.3's binding intent and §5.4's stated ban-list-scan intent.

## Doctrine pass

| # | Check | Result |
|---|-------|--------|
| 1 | Worked example contains no verdict token (winner / loser / won / lost / right / wrong / true / false / correct / incorrect / proven / defeated) in any field | **Pass** — every field is structural (`classifierId: responds_to_parent`, `confidence: high`, `reasonCode: parent_continuity_engaged`, `routeSuggestion: mainline`, `frictionSuggestion: none`). The integer literal `1` for `binaries[0].value` is the schema-required integer, not the JSON boolean `true`. |
| 2 | Worked example contains no person-label token (liar / lying / dishonest / manipulative / troll / propagandist / extremist / stupid / idiot / dumb / smart) and no 'bad faith' phrase | **Pass** — the example is a JSON shape with classifier-id / enum literals only. No person-label text anywhere. |
| 3 | `binaries[0].value` is integer literal `0` or `1`, NOT JSON boolean | **Pass** — `"value": 1` (line 164 of `seedPrompt.ts`). The new test pins this with `expect(src).toMatch(/"value":\s*1\b/)`. |
| 4 | `confidence` is exactly one of `low | medium | high` | **Pass** — `"confidence": "high"` (line 165). |
| 5 | `routeSuggestion` is one of the 7 catalog values | **Pass** — `"routeSuggestion": "mainline"` (line 169). Matches `ALL_ROUTE_SUGGESTIONS[0]`. |
| 6 | `frictionSuggestion` is one of the 8 catalog values | **Pass** — `"frictionSuggestion": "none"` (line 170). Matches `ALL_FRICTION_SUGGESTIONS[0]`. |
| 7 | `scoreHints` has all six fields with integers in `0..3` | **Pass** — `continuityCredit: 2, evidencePressure: 1, branchHygiene: 1, synthesisReadiness: 0, sourceChainDebt: 0, unresolvedRedirectRisk: 0` (lines 172-177). All six fields present, all in-range. |
| 8 | `reasonCode` starts with one of the eight family prefixes | **Pass** — `parent_continuity_engaged` (line 166) starts with `parent_continuity` from `REASON_CODE_FAMILIES`. |
| 9 | Worked example does NOT contain `authoritative` | **Pass** — field is absent from the example; `authoritative: false` is stamped by the boundary, not the model. |
| 10 | No secret literal anywhere in the diff (`ANTHROPIC_API_KEY`, `Authorization`, `Bearer`, `sk-ant-`, `xai-`, `sb_secret_`, JWT-shape) | **Pass** — the only string hits in the diff are inside `docs/designs/SMOKE-FIX-002.md` prose stating "the worked example carries no `sk-ant-…` / `xai-…` / `sb_secret_…`" — those are explicit negations inside the design doc. No production source or test introduces a secret-shaped substring. |

## Design fidelity

| § | Requirement | Result |
|---|------|--------|
| 5.1 | User-message `instruction` enumerates all 7 `routeSuggestion` + all 8 `frictionSuggestion` values inline as double-quoted JSON literals | **Pass** — `seedPrompt.ts:147-151`. Each value matches `ALL_ROUTE_SUGGESTIONS` / `ALL_FRICTION_SUGGESTIONS` in `src/features/semanticReferee/semanticRefereeTypes.ts:157-176` exactly. |
| 5.2 | Worked-example block present in `seedPrompt.ts` source | **Pass** — `seedPrompt.ts:155-181`. Framing sentence on lines 156-158 carries the "illustrative — do not copy verbatim" disclaimer per Risk-A mitigation. |
| 5.3 | `SEED_PROMPT_VERSION === 'mcp-semantic-referee-prompt-v1'` | **Pass** — `seedPrompt.ts:31`. The new test pins both the v1 presence and the v0 absence. |
| 5.4 | `__tests__/semanticRefereeSeedPromptEnumCoverage.test.ts` exists with at least 5 `expect` assertions; source-scan posture (reads file as text) | **Pass** — file has 5 `it()` blocks, each with one or more `expect` calls. Reads `seedPrompt.ts` via `fs.readFileSync` — no Deno-style import. |
| 5.5 | `docs/core/current-status.md` carries a 3-line SMOKE-FIX-002 footnote pointing to the design | **Pass** — line 11 of `current-status.md` carries the footnote and references `docs/designs/SMOKE-FIX-002.md`. |
| 2 (out of scope) | No touch to `schema.ts`, `anthropicProvider.ts`, `mockProvider.ts`, `contentSafetyScan.ts`, `mcpAdapter.ts`, `mcpAdapterCore.ts`, `process-language-draft`, `src/features/`, `src/lib/edgeFunctions.ts`, `triggerGates.ts`, `semanticTriggerInput.ts`, migrations | **Pass** — `git diff --name-only 75e6965..HEAD` lists exactly 5 files: `seedPrompt.ts`, the new test, the core test (one-line literal update per §13), the design doc, and `current-status.md`. Zero out-of-scope files. |
| 3 (doctrine 2) | No widening of `SemanticRefereePacketSchema`, no new field on the packet, no `PACKET_VERSION` change, no `ClassifyMoveDisabledReason` change | **Pass** — `schema.ts` not in the diff; `PACKET_VERSION` and `ClassifyMoveDisabledReason` literals untouched; the 23-id catalog (`ALL_SEMANTIC_CLASSIFIER_IDS`) unchanged. |
| 3 (doctrine 9) | SMOKE-FIX-001's diagnostic `console.warn` lines in `anthropicProvider.ts` untouched | **Pass** — `anthropicProvider.ts` not in the diff. |

## Implementer-note corrections (§13)

**Correction (a) — `__tests__/semanticAnthropicCore.test.ts:161` v0 → v1 literal update.** Within-spirit. §5.3 mandates the bump and §8.3 erroneously stated that no test asserts the v0 literal — the pre-existing assertion at line 161 trivially required updating to keep the suite green. The change is one line plus a one-line comment citing SMOKE-FIX-002. The implementer correctly flagged the §8.3 / reality mismatch in the design's §13 appendix instead of silently editing. Not a scope expansion; not a redesign.

**Correction (b) — extend the test's pre-scan stripper to remove JSDoc blocks before the `do not` / `must not` line filter.** Within-spirit. The design's §5.4 explicitly states the load-bearing safety is "banned tokens never appear OUTSIDE a 'Do not' / 'MUST NOT' / 'must not' sentence" — the *prohibition concept*, not the literal substring. The file's own JSDoc doctrine block (`seedPrompt.ts:10-14`) wraps the prohibition sentence across multiple lines; the wrapped continuation lines (containing `true, correct, right, wrong, factual, proven, popular`) carry the banned tokens without the prohibition marker. JSDoc blocks are developer documentation and never reach the model. The implementer's `withoutJsDocBlocks = src.replace(/\/\*\*[\s\S]*?\*\//g, '')` strip step preserves the design's intent while letting the existing JSDoc stand. Critically, the executable string literals (the user-message `instruction`, the new `workedExample`, the `CLASSIFIER_QUESTION_TEXT` dictionary, the `buildInputBlock` lines) are STILL scanned — that's the actual prompt content the model sees. The safety pin is intact.

Both corrections are tightly scoped, do not widen, and do not introduce new code paths.

## Test analysis

- **Test count.** Pre-card baseline: 9068 tests / 330 suites. Post-card: **9073 tests / 331 suites** — exactly +5 tests / +1 suite as the implementer claimed.
- **All gates green.** `npm run typecheck`: exit 0, no output. `npm run lint`: exit 0, no output. `npm run test`: `Test Suites: 331 passed, 331 total. Tests: 9073 passed, 9073 total. Time: 15.075 s.`
- **Flake note.** The `diagnosticInspectPackage.test.ts` suite documented as a "pre-existing flake unrelated to this card" in SMOKE-FIX-001 went green this run. Not a regression — flakes by definition do not fail every run. No follow-up required for this card; the flake remains a separate concern.
- **No `.skip` / `.only` / `console.log` in test files.** Verified by source scan.
- **Posture.** The new test is a source-scan over `seedPrompt.ts` — reads the file as text with `fs.readFileSync`. It does not depend on the Deno runtime or the Jest `_helpers/semanticRefereeDeno.ts` bridge, so a future move of the literal enum values into a generated form would still be caught (it would fail the `expect(src).toContain("${value}")` assertions).
- **Source-of-truth check.** The test imports `ALL_ROUTE_SUGGESTIONS` / `ALL_FRICTION_SUGGESTIONS` from `src/features/semanticReferee/semanticRefereeTypes.ts` — the Node-side canonical arrays. The existing `__tests__/semanticDenoNodeParity.test.ts` already enforces parity between the Deno-side and Node-side arrays, so the enum coverage assertion has a transitive guarantee that the prompt covers the Deno-side schema's accepted values.

## Findings

None. The card ships exactly what the design specifies. The two §13 implementer-note corrections are well-justified and within scope.

## Operator follow-up after merge

1. **Supabase auto-redeploy.** The Supabase GitHub integration will auto-redeploy `semantic-referee` on merge to `main`. Expected version bump: `39 → 40`. No `npx supabase functions deploy` command required; no migration.
2. **Smoke-test re-run.** Operator runs `node scripts/bot-fixtures/runMcpSmokeTest.js`. Acceptance criterion (§8.4): move 1's two batches AND move 2's two batches AND the post-flip probe each return `ok: true, enabled: true, packet: { ... }`. The packets MUST carry `promptVersion === 'mcp-semantic-referee-prompt-v1'`, `routeSuggestion` ∈ `ALL_ROUTE_SUGGESTIONS`, `frictionSuggestion` ∈ `ALL_FRICTION_SUGGESTIONS`, all six `scoreHints` integers in `0..3`.
3. **Cache invalidation.** The v0 → v1 bump means the in-memory `SemanticPacketCache` in `src/features/semanticReferee/semanticCache.ts` keys differently. ~256 entries per warm Edge instance miss on first call; second call on the same body hits the cache normally. No persisted state affected.
4. **If `validation_failed` persists.** The SMOKE-FIX-001 diagnostic `console.warn` lines (untouched in this card) will name the new failure path. File SMOKE-FIX-003 with the same shape — pick the narrowest applicable B2* option from SMOKE-FIX-001 §11, ship the prompt edit, bump `SEED_PROMPT_VERSION` to v2.
