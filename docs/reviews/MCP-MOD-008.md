# MCP-MOD-008 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-23
**Branch:** feat/MCP-MOD-008-move-position-aware-triggering
**Commit:** 8fb6368
**Design:** docs/designs/modularity-slate/MCP-MOD-008.md
**Movement:** C (triggering rule) — **FINAL CARD of the modularity slate**

## Summary

This is the only behavior-changing card in the modularity slate. It wires the
MCP-MOD-007 move-position helper into the trigger gate so each participant's
FIRST move in a debate is exempt from semantic-referee classification (no
classify call fires), and from each participant's SECOND move onward the
classify payload now carries the full thread context (every prior move's body,
with alias-only author identification, redacted twice — once client-side,
once defensively at the boundary). The change is implemented as an additive
extension: when the room shell doesn't pass `authorId` + `priorMoves` (every
existing call site that isn't MCP-MOD-008's), the gate behaves exactly as
before. The Edge Function's `priorMovesRedacted` request field is optional, so
the smoke-test orchestrator and any other pre-MCP-MOD-008 caller continues to
work unchanged. The response/packet contract is untouched.

## Verification

- typecheck: PASS
- lint: PASS (`eslint . --ext .ts,.tsx --max-warnings 0` → exit 0)
- test: 9212 → **9271 tests / 349 suites** (+59 / +5 suites). 5 new test suites
  exercised individually: 59/59 pass.
- secret scan: clean
- doctrine scan: clean (no winner / loser / liar / correct / dishonest / bad
  faith / manipulative / extremist / propagandist tokens introduced; the only
  `true`/`false` matches in the diff are JS boolean literals, not verdicts
  about content)

## Skills invocation

- `Skill(cdiscourse-doctrine)` — read in full.
- `Skill(test-discipline)` — read in full.

## 22-check verdict matrix

| # | Check | Verdict | Note |
|---|---|---|---|
| 1 | Path B confirmation (cwd + branch) | PASS | `C:/Users/kyler/cdiscourse/debate-constitution-app` · `feat/MCP-MOD-008-move-position-aware-triggering` |
| 2 | Skills invoked | PASS | Both confirmed above |
| 3 | `SEMANTIC_REFEREE_PACKET_VERSION` unchanged | PASS | `PACKET_VERSION = 'mcp-semantic-referee-v0'` (`types.ts:206`) untouched by diff |
| 4 | `SEED_PROMPT_VERSION` bump justified | PASS | `buildInputBlock` (`seedPrompt.ts:64-88`) emits the new `Room thread context:` block above parent + move when `priorMovesRedacted` is non-empty. Format genuinely changed. v1 → v2 is correct |
| 5 | `SemanticClassifierId` union unchanged | PASS | No ids added (diff has no `+` lines on the catalog) |
| 6 | No new verdict / person-label tokens | PASS | Doctrine-scan clean |
| 7 | `evaluateTrigger` consults helper | PASS | `triggerGates.ts:31` imports `getMovePositionForAuthor`; gate consults it `triggerGates.ts:272-290`; `'first'` returns `{ allowed: false, reasonCode: 'first_move_by_author' }` |
| 8 | Backward compat preserved | PASS | Gate only runs the helper when `typeof authorId === 'string' && authorId.length > 0 && Array.isArray(priorMoves)` (`triggerGates.ts:277-280`); absent inputs preserve pre-MCP-MOD-008 behavior |
| 9 | `'first_move_by_author'` reason code added correctly | PASS | Added to `TriggerReasonCode` union (`triggerGates.ts:156`); existing codes untouched; ban-list test passes (the token `first` is not on the banned list) |
| 10 | Chime-in uniformity | PASS | `movePosition.ts:46-60` counts moves by `authorId` only. Chime-in's first move = `'first'` regardless of how many primary-participant moves preceded. Confirmed by `movePositionRoomHookIntegration.test.ts:91-107` (C's chime-in first contribution after 4 prior moves → 0 calls). Gate inherits this without special-casing |
| 11 | Contract matches design §3 | PASS | `PriorMoveContext { authorAlias: string; bodyRedacted: string }` (`edgeFunctions.ts:425-430`). Schema bounds: `authorAlias` 1..8, `bodyRedacted` 1..MOVE_BODY_MAX (8000) (`schema.ts:74-79`) |
| 12 | `priorMovesRedacted` optional | PASS | `priorMovesRedacted?: ReadonlyArray<PriorMoveContext>` (`edgeFunctions.ts:463`); Deno mirror `:299`; schema `.optional()` `:101`. Old callers work unchanged — backward-compat test in `movePositionRoomHookIntegration.test.ts:256-275` proves the field is omitted when caller doesn't supply it |
| 13 | Deno mirror parity | PASS | `types.ts:261-266` has matching `PriorMoveContext`; parity test 15/15 pass |
| 14 | Schema validates correctly | PASS | `PriorMoveContextSchema` is `.strict()` (`schema.ts:79`); `MAX_ALIAS_LEN = 8` (`:51`); `MAX_PRIOR_MOVES = 50` (`:60`); array bounded via `.max(MAX_PRIOR_MOVES, ...)` (`:99-100`). Top-level request schema is also `.strict()` |
| 15 | Alias scheme deterministic + non-identifying | PASS | `buildAuthorAliasMap` (`threadContext.ts:72-92`) builds `A`/`B`/`C`... from chronological order of distinct authors. `aliasForIndex` (`:99-107`) handles AA/AB wrap-around for 26+ authors (verified by parity test #14 of seed-prompt test, and the AA exhibit in the format test). No PII in the map — `userId`/`displayName`/`email` rejected by the parity test #152-168 |
| 16 | Alias stability across calls | PASS | `movePositionRoomHookIntegration.test.ts:169-222` — A is always `'A'`, B is always `'B'`, regardless of which move triggers the call |
| 17 | Oldest-first drop | PASS | `assemblePriorMovesPayload` calls `redacted.shift()` when over budget (`threadContext.ts:151`). `tokenBudget.ts:87-102` accounts for `priorMoveBodies.length + PER_PRIOR_MOVE_SCAFFOLD_CHARS` per entry. When fully trimmed, returns `[]` and the hook proceeds with the pre-refactor payload shape via the `...(priorMovesRedacted.length > 0 ? { priorMovesRedacted } : {})` spread (`useSemanticReferee.ts:523-525`) — the call is NOT skipped |
| 18 | Budget test rigor | PASS | 11/11 pass. All 3 regimes spot-checked (under = 3/3 included; just-over = oldest dropped, newest preserved; way-over = empty array returned). Defensive paths included (author-not-in-alias-map, empty input) |
| 19 | `buildInputBlock` thread block | PASS | `seedPrompt.ts:72-80` emits the block when `priorMovesRedacted !== undefined && priorMovesRedacted.length > 0`; omitted otherwise. 10/10 tests pass. Block is positioned ABOVE parent + move per design (test #62-78 asserts ordering) |
| 20 | Redaction at boundary | PASS | `redactClassifyMoveRequest` (`redaction.ts:88-103`) maps over `request.priorMovesRedacted` and runs `redactString(entry.bodyRedacted)` on each. Belt-and-suspenders matches `moveBodyRedacted` + `parentBodyRedacted` posture |
| 21 | All existing tests pass + 3 updated tests justified | PASS | Full suite 9271/9271 green. The 3 modifications are all semantically equivalent (see "Behavior-changing tests" below) |
| 22 | typecheck + lint + diff stat + no `git add -A` evidence + no secret leak | PASS | typecheck/lint exit 0; secret scan clean; diff stat = 19 files (6 new + 13 modified) — matches the named files exactly; pre-existing dirty files (`docs/testing-runs/*.md`, `assets/branding/semantic-referee.zip`) are NOT in the commit |

## Test-discipline check

The 5 new test files all conform:

- All located in `__tests__/` (the project's standard location).
- 4/5 are pure (no React, no fetch, no Supabase): the budget test, the
  parity test, the seed-prompt test, and the first-move-skip test.
- 1/5 (`movePositionRoomHookIntegration.test.ts`) is a React Testing Library
  hook integration test that mocks `classifyMove` at the module boundary; that
  is the standard, allowed pattern for exercising a hook end-to-end.
- No `.skip` / `.only` / `xit` / `xdescribe` in any of the 5 files.
- No `console.log` in committed test code or in the new
  `threadContext.ts` production module.
- Tests fail loudly on drift — the parity test reads source files as text and
  the integration test asserts exact alias values.

## Behavior-changing tests assessment

| File | Change | Verdict |
|---|---|---|
| `__tests__/semanticRouterBanList.test.ts` | Added `'first_move_by_author'` to `ALL_TRIGGER_REASON_CODES` enumeration | **Semantically equivalent.** Purely additive — extends the enum to match the widened `TriggerReasonCode` union. The token is not on the doctrine ban-list (`first` is neither a verdict, popularity, nor truth token). No assertion flipped |
| `__tests__/semanticAnthropicCore.test.ts` | `SEED_PROMPT_VERSION` assertion v1 → v2 | **Semantically equivalent.** Matches the documented version bump rationale in `seedPrompt.ts:46`. The version bump is required because `buildInputBlock`'s structural format changed |
| `__tests__/semanticRefereeSeedPromptEnumCoverage.test.ts` | `SEED_PROMPT_VERSION` source-text assertion v1 → v2; also adds a `not.toContain('-v1')` assertion | **Semantically equivalent.** Strengthens the test (now rejects v1 in addition to v0). Matches the same documented bump |

No quietly-flipped assertions in any of the three.

## `SEED_PROMPT_VERSION` bump assessment

**v1 → v2 is justified.** I confirmed `buildInputBlock` (`seedPrompt.ts:64-88`)
genuinely emits a new block when `request.priorMovesRedacted` is non-empty:

```
Room thread context (most recent move is the one to classify):
- Move 1 by A: ...
- Move 2 by B: ...
```

This is a structural format change to the prompt. The cache key is the
`promptVersion` × `contentHash` × `classifierIds` tuple
(`semanticRefereeCacheKey.ts`); bumping `SEED_PROMPT_VERSION` correctly
invalidates upstream caches so cached v1 packets aren't served against a v2
prompt format. The bump is required, not cosmetic.

The pre-MCP-MOD-008 path (no `priorMovesRedacted`) still emits a
byte-identical prompt shape to v1 except for the version stamp — but a
caller that requested v1 must not have its v1 cache entries returned for v2
calls, so a clean cache cut is correct. The seed-prompt test 30-44 confirms
the block is omitted when `priorMovesRedacted` is absent or empty.

## Movement C closure note

With MCP-MOD-008 merged the modularity slate is **COMPLETE** (8 cards):

1. **MOD-001** — docs reorganization (foundational docs → `docs/core/`)
2. **MOD-002** — semantic referee inventory
3. **MOD-003** — prompt inventory
4. **MOD-004** — catalog extraction (single source of truth for catalog v0)
5. **MOD-005** — prompt refactor (catalog-driven `buildClassifierPrompt`)
6. **MOD-006** — banner + ledger refactor
7. **MOD-007** — move-position pure helper
8. **MOD-008** — trigger gate + full-thread classifier context (**THIS CARD**)

Movement A (docs/inventory) shipped 3 cards, Movement B (catalog/refactor)
shipped 4 cards, Movement C (triggering rule) shipped 2 cards
(MOD-007 helper + MOD-008 consumer). MOD-008 is the only card in the slate
that changes user-observable behavior — every prior card was a pure refactor
or documentation pass.

## Findings (non-blocking)

None of these block approval. The implementer documented their decisions
clearly and they are defensible:

1. **Feature flag SKIPPED.** The design §9.2 recommended a
   `SEMANTIC_REFEREE_FIRST_MOVE_SKIP` env flag. The implementer omitted it
   because rollback is a one-line revert in `ArgumentTreeScreen.tsx` (stop
   passing `authorId` + `priorMoves` to `refereeOnMovePosted`). This is a
   defensible call — the design itself flagged the flag as optional. If
   operator wants the in-flight rollback option later, a follow-up card can
   add it without re-touching this slate.
2. **Smoke-test orchestrator update SKIPPED.** Design §7 described an
   orchestrator update for the skip-and-classify pattern. The implementer
   documented that the orchestrator bypasses `evaluateTrigger` entirely
   (calls the Edge Function directly), so the gate change is invisible to it.
   This is correct — the smoke-test orchestrator's job is to exercise the
   Edge Function, not the client-side hook. A future enhancement could add
   smoke-test coverage of the client hook directly. Not a blocker.

## Operator next steps

1. Push the branch:
   `git push -u origin feat/MCP-MOD-008-move-position-aware-triggering`
2. Open PR:
   `gh pr create --title "MCP-MOD-008: move-position-aware triggering + full-thread context" --body-file docs/reviews/MCP-MOD-008.md`
3. After merge, operator deploys Edge Function:
   `npx supabase functions deploy semantic-referee --linked`
   (no migration; no secret; no admin runtime-config change)

## Bottom line

**Ready to push and merge.** Tests green (9271/349), typecheck/lint clean,
doctrine clean, secret-scan clean, all 22 review checks PASS. The card ships
the user-observable behavior the design promised with no scope creep and a
documented backward-compat seam. The modularity slate is complete.
