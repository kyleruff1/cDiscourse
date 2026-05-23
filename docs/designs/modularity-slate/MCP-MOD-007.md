# MCP-MOD-007 — Move-position tracking helper

**Card:** MCP-MOD-007 (Rules UX · P2 · S · Release 6.9 · Movement C).
**Status:** Design summary.
**Epic:** Rules UX.
**Movement:** C (triggering rule). **No behavior change in this card** — adds a helper used by MCP-MOD-008.
**Meta-roadmap:** [`docs/core/roadmap-semantic-referee-modularity.md`](../../core/roadmap-semantic-referee-modularity.md).
**Depends on:** MCP-MOD-004 (the source-of-truth's metadata adds a per-classifier "first-move trigger" flag in this card,
or alongside it).
**Unblocks:** MCP-MOD-008 (the triggering-rule change consumes this helper).

---

## 1. Goal

Add a small, pure helper that derives, for any move, whether it is the FIRST move by its author in the debate, the
SECOND move, or a LATER move. The helper is used in MCP-MOD-008 to gate classification. This card ships only the
helper + tests — no behavior change. Splitting the helper from the triggering rule means MCP-MOD-008 reviews only the
gate logic, not the position-counting code.

## 2. File created

`src/features/semanticReferee/movePosition.ts` (Node-side; pure TypeScript; no Supabase, no React, no async).

Shape:

```ts
export type MovePosition = 'first' | 'second' | 'later';

export interface MovePositionInput {
  /** The just-posted (or about-to-be-posted) move's id. */
  moveId: string;
  /** The move's author id. */
  authorId: string;
  /** Every move already posted in the room, in chronological order, with author + id. */
  priorMoves: ReadonlyArray<{ id: string; authorId: string }>;
}

/**
 * Derive whether `moveId` is the author's first, second, or later move in the room.
 *
 * - 'first'  — no prior move in `priorMoves` is by `authorId`.
 * - 'second' — exactly one prior move in `priorMoves` is by `authorId`.
 * - 'later'  — two or more prior moves in `priorMoves` are by `authorId`.
 *
 * `priorMoves` does NOT include the move being classified — the caller separates them.
 */
export function getMovePositionForAuthor(input: MovePositionInput): MovePosition;
```

## 3. Behavior

Pure, deterministic. Counts how many entries in `priorMoves` have `authorId === input.authorId`. The function does NOT
talk to Supabase; the caller (MCP-MOD-008) is responsible for assembling `priorMoves` from the room state.

## 4. Tests

`__tests__/movePositionHelper.test.ts` covers:

- A move with no prior author moves → `'first'`.
- A move whose author has exactly one prior move → `'second'`.
- A move whose author has two prior moves → `'later'`.
- A move whose author has many prior moves → `'later'`.
- The function ignores moves by other authors when counting.
- An empty `priorMoves` array → `'first'`.
- A move whose `moveId` accidentally appears in `priorMoves` is still counted correctly (the function counts authors,
  not ids; the caller is responsible for not including the move under classification in `priorMoves`).

## 5. Smoke-test regression check

This card adds a helper that no current code path calls. The smoke test continues to pass byte-identically because the
classify flow is unchanged.

## 6. Deployment

None. This card's diff is entirely `src/` + tests. No Edge Function redeploy. CI is sufficient.

## 7. Rollback

Revert the merge commit. The helper file disappears; no caller depended on it.

## 8. Acceptance criteria

- [ ] `src/features/semanticReferee/movePosition.ts` exists with the helper as in §2.
- [ ] `__tests__/movePositionHelper.test.ts` exists and covers the cases in §4.
- [ ] `npm run typecheck && npm run lint && npm run test` all pass.
- [ ] No file outside `src/features/semanticReferee/movePosition.ts` and its test imports the new helper yet (MCP-MOD-008
      wires it in).

## 9. Risks

- **The helper's contract changes once MCP-MOD-008 starts wiring it.** Mitigation: the helper is pure and additive; if a
  shape change is needed, MCP-MOD-008's design picks it up and this card's helper signature changes via a small follow-up.

## 10. Not in scope

- Wiring the helper into the trigger gate. That is MCP-MOD-008.
- Fetching prior moves from Supabase. The helper takes them as a pure input.
- Defining what "first move" means for chime-in branches vs the mainline. MCP-MOD-008's design picks that up.
- Skipping or running classification based on the helper's result. MCP-MOD-008 owns the gate.
