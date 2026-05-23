# MCP-MOD-008 — Move-position-aware triggering rule + full-thread context

**Card:** MCP-MOD-008 (Rules UX · P2 · M · Release 6.9 · Movement C). **Only card in the slate that changes user-observable behavior.**
**Status:** Design summary.
**Epic:** Rules UX.
**Movement:** C (triggering rule). **Final card of the slate.**
**Meta-roadmap:** [`docs/core/roadmap-semantic-referee-modularity.md`](../../core/roadmap-semantic-referee-modularity.md).
**Depends on:** MCP-MOD-007 (the move-position helper), MCP-MOD-005 (the prompt template now driven by the catalog —
the full-thread-context extension lives here).
**Final card.**

---

## 1. Goal

Use the move-position helper from MCP-MOD-007 to SKIP classification on each participant's FIRST move in a debate (the
proclamation and the first rebuttal). From each participant's SECOND move onward, classification fires WITH the FULL
THREAD CONTEXT — every prior move's body, plus author identifications, sent to the AI so it can judge continuity,
evidence support, narrowing, etc. across the whole conversation rather than just against the parent move.

Why skip the first move: the first move by each participant is the OPENING STATEMENT. There is no prior context the
participant can engage; classification (especially `responds_to_parent`, `quote_anchors_parent`, `answers_clarification`)
returns mostly negatives by definition. The classify call wastes a token budget and shows the user a degraded banner.
Skipping it is both cheaper and clearer.

Why full thread context from the second move on: today the classify payload sends only the move body + parent body
(`moveBodyRedacted` + `parentBodyRedacted`). A move that responds to a debate's THIRD-level point or quotes a SEVENTH
move cannot be classified accurately without seeing the chain. Sending the full thread (still redacted, still bounded by
the token budget) restores the AI's ability to judge structural continuity across depth.

## 2. Files changed

- **`src/features/semanticReferee/triggerGates.ts`**: `evaluateTrigger` consults the move-position helper. A `'first'`
  position returns `{ allowed: false, reasonCode: 'first_move_by_author' }`. A `'second'` or `'later'` proceeds to the
  existing gate checks.
- **`src/features/arguments/useSemanticReferee.ts`**: `onMovePosted` passes the prior moves into `evaluateTrigger`. The
  hook assembles them from the room state — the room shell already exposes `useArgumentRoomMessages`, which is the
  source. The hook also assembles the full thread context for the classify call (see §4).
- **`src/lib/edgeFunctions.ts`**: `ClassifyMoveRequest` gains a new optional field `priorMovesRedacted: Array<{
  authorAlias: string; bodyRedacted: string }>` — see §3 for the contract details.
- **`supabase/functions/_shared/semanticReferee/schema.ts`**: the inbound schema gains the matching `priorMovesRedacted`
  optional array.
- **`supabase/functions/_shared/semanticReferee/seedPrompt.ts`**: `buildInputBlock` includes the `priorMovesRedacted`
  block when present (above the parent + move blocks).
- **`supabase/functions/_shared/semanticReferee/redaction.ts`**: the boundary redactor runs over `priorMovesRedacted`
  entries too — the same belt-and-suspenders posture the current code applies to `moveBodyRedacted` and
  `parentBodyRedacted`.

## 3. Contract — `priorMovesRedacted`

```ts
interface PriorMoveContext {
  /** A short, stable, non-identifying alias for the author. NEVER a user id, NEVER a display name. */
  authorAlias: string;
  /** The move body, already client-redacted via `redactBody`. <= MOVE_BODY_MAX chars. */
  bodyRedacted: string;
}
```

Author identifications carry a STABLE, NON-IDENTIFYING alias — e.g. `'A'`, `'B'`, `'C'` derived deterministically from
the move's chronological order of distinct authors in the room. The alias map is local to the classify call; no PII
crosses the boundary. The Anthropic system prompt already prohibits the model from labeling the person; the alias
ensures even the SHAPE of the input cannot smuggle a real name or handle.

## 4. Token budget

The full thread can be long. The existing `isWithinBudget` helper (referenced in `useSemanticReferee.ts:408-415`)
extends to count `priorMovesRedacted` characters. When the budget is exceeded:

- Drop the OLDEST prior moves first.
- If the budget is still exceeded after dropping all prior moves, the classify call proceeds with just `moveBodyRedacted`
  + `parentBodyRedacted` (the current pre-refactor behavior). The hook does NOT skip the call; it gracefully degrades.

A new test `__tests__/movePositionThreadBudget.test.ts` covers:

- Under budget → all prior moves included.
- Just over budget → oldest prior moves dropped until under budget.
- Way over budget → prior moves array empty; payload identical to pre-refactor shape.

## 5. User impact

This is the only behavior-changing card in the slate. The release note (added to `docs/core/current-status.md` when the
card lands) reads approximately:

> Stage 6.4.x — From each participant's SECOND move onward, the semantic referee evaluates the FULL thread context, not
> just the parent. Each participant's FIRST move in a debate no longer triggers classification (it would mostly fail by
> definition). Visible effect: users see the referee banner on their second move and onward; the layer-1 fallback is
> what they see on the opening statement and first rebuttal, exactly as if `{ enabled: false }` came back.

The "Visible effect" is INTENTIONAL and is the user-visible meaning of the gate.

## 6. Tests

Required new tests:

- **`__tests__/triggerGateFirstMoveSkip.test.ts`** — asserts that `evaluateTrigger` returns
  `{ allowed: false, reasonCode: 'first_move_by_author' }` when the move-position helper returns `'first'`, regardless
  of other gate conditions.
- **`__tests__/movePositionThreadBudget.test.ts`** — see §4.
- **`__tests__/seedPromptThreadContextBlock.test.ts`** — asserts that `buildInputBlock` includes the prior-moves block
  in the documented format when present and excludes it when absent.
- **`__tests__/classifyMoveRequestPriorMovesParity.test.ts`** — a source-scan test asserting the Node and Deno
  `ClassifyMoveRequest` shapes agree on the new optional field.
- **`__tests__/movePositionRoomHookIntegration.test.ts`** — exercises `useSemanticReferee.onMovePosted` end-to-end with
  a mock `classifyMove` and a synthetic 5-move room: the first move triggers no call; the second move triggers one
  call carrying the first move in `priorMovesRedacted`; the third carries the first two; etc.

Existing tests:

- `__tests__/semanticAnthropicSeedPromptBanList.test.ts` continues to pass.
- Banner-library and ledger tests pass without modification (the packet shape is unchanged).
- All existing `triggerGates` tests pass except those that asserted "first move triggers a call" — those tests need to
  be updated to reflect the new behavior. The implementer flags any such test in the PR description for the reviewer
  to sign off on; behavior changes require explicit acknowledgement.

## 7. Smoke-test regression check

The smoke-test framework's scenario `smoke-test-mcp-remote-work-productivity` opens with a Provocateur move (no prior
context for that author) and a Revocateur reply. Under MCP-MOD-008's rule:

- Provocateur's m1: first move by Provocateur → NO classify call. Smoke-test log records the move as posted but with
  `classifyResult: null` and a marker noting the skip.
- Revocateur's m2: first move by Revocateur → NO classify call. Same marker.
- Provocateur's m3 (if the scenario has one): Provocateur's second move → classify fires, payload includes m1's body in
  `priorMovesRedacted`.
- Revocateur's m4: Revocateur's second move → classify fires, payload includes m1, m2, m3 in `priorMovesRedacted`.

The smoke-test orchestrator (`scripts/bot-fixtures/runMcpSmokeTest.js`) gains a small update to record the skip markers
and to assert the expected classify-call count per move under the new rule. The acceptance criterion: a re-run produces
the expected skip-and-classify pattern, the function logs show the prior-moves block was sent on the classified calls
(verifiable via the diagnostic log line from SMOKE-FIX-001 if it's present, or via the `inputHash` correlator's content
hash including the new payload bytes).

## 8. Deployment

Operator-only: `npx supabase functions deploy semantic-referee --linked` after merge. No migration. No secret. No admin
runtime-config change. The new request field is optional; old clients can still call the function and get the same
behavior as before (no prior-moves context).

## 9. Rollback

Two levels:

1. **Code rollback**: revert the merge commit. The trigger gate stops consulting move position; the seed prompt stops
   emitting the prior-moves block; the request schema's new field becomes ignored (it's optional).
2. **Feature-flag rollback** (if the operator wants the option without a revert): the implementer adds a
   `SEMANTIC_REFEREE_FIRST_MOVE_SKIP` env / admin-config flag that defaults to `true` and, when set to `false`, restores
   the pre-MCP-MOD-008 behavior (every move triggers classification, payload omits `priorMovesRedacted`). The flag is
   small and adds insurance. The implementer decides whether to include it in the card or skip it; reviewer can ask
   for it. Recommendation: INCLUDE the flag — it's a one-line `Deno.env.get` plus an admin-config field; the cost is
   trivial and the rollback option is real.

## 10. Acceptance criteria

- [ ] `triggerGates.ts`'s `evaluateTrigger` returns `{ allowed: false, reasonCode: 'first_move_by_author' }` when the
      author's move position is `'first'`.
- [ ] `useSemanticReferee.ts` assembles prior moves from the room state and passes them to `evaluateTrigger` + the
      classify call.
- [ ] `ClassifyMoveRequest` (Node + Deno) accepts an optional `priorMovesRedacted` array with the shape in §3.
- [ ] `buildInputBlock` includes the prior-moves block when present.
- [ ] `redaction.ts` runs the boundary redactor over prior-moves bodies.
- [ ] `isWithinBudget` accounts for prior-moves bytes and drops oldest first when over budget.
- [ ] All five new tests in §6 pass.
- [ ] All existing tests pass; trigger-gate tests that previously asserted "first move triggers a call" are updated and
      called out in the PR.
- [ ] `npm run typecheck && npm run lint && npm run test` all pass.
- [ ] Smoke-test re-run produces the expected skip-and-classify pattern.
- [ ] `docs/core/current-status.md` carries the release note from §5.

## 11. Risks

- **Author aliasing collides with the AI's tendency to attribute claims to people.** Mitigation: the system prompt
  already forbids person-labeling; the alias is `'A'/'B'/'C'`, not a name; the content-safety scanner rejects
  person-label tokens in any output string.
- **The thread can grow without bound.** Mitigation: the budget check drops oldest first; if a single move's body
  alone exceeds the budget, the function falls back to the pre-refactor payload shape.
- **A debate with many participants exhausts the alias pool.** Mitigation: aliases are derived from chronological order
  of distinct authors; a debate with 26+ distinct authors wraps to `'AA'/'AB'/...`. Out of scope to pre-optimize; very
  rare in practice for the rooms this layer is deployed to.

## 12. Not in scope

- Persisting the alias map. Aliases are derived per call from the room state.
- Sending the full debate metadata (room title, resolution, status) beyond what the existing payload already carries.
- Per-classifier "first-move trigger" flags in the catalog. The skip is moment-level, not classifier-level.
- Changing the cache key. The existing `buildSemanticCacheKey` already incorporates `contentHash`, which now includes the
  prior-moves payload bytes; no key shape change needed.
