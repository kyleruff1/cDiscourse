# MCP-MOD-005 — Prompt template refactor (seed prompt generated from `SEMANTIC_CLASSIFIER_CATALOG`)

**Card:** MCP-MOD-005 (Rules UX · P2 · S · Release 6.9 · Movement B).
**Status:** Design summary.
**Epic:** Rules UX.
**Movement:** B (modularity refactor).
**Meta-roadmap:** [`docs/core/roadmap-semantic-referee-modularity.md`](../../core/roadmap-semantic-referee-modularity.md).
**Depends on:** MCP-MOD-004 (the source-of-truth must exist).
**Unblocks:** MCP-MOD-008 (the move-position-aware triggering rule's full-thread-context prompt extension lives here).
**Parallelizable with:** MCP-MOD-006 (banner / ledger refactor) — both depend on MCP-MOD-004 and touch different files.

---

## 1. Goal

Make changing a classifier's question text a single-file change. After MCP-MOD-004, the catalog holds the question text;
this card changes the seed prompt template to ITERATE the catalog rather than hand-writing one line per id. After this
card lands, deleting or renaming a classifier requires only adding/removing a catalog entry — the prompt template never
needs to be touched again unless the PROMPT STRUCTURE itself changes.

## 2. Files changed

- **`supabase/functions/_shared/semanticReferee/seedPrompt.ts`**: `buildClassifierPrompt` no longer reads
  `CLASSIFIER_QUESTION_TEXT[id]` per id. Instead it filters the catalog by `request.requestedClassifiers` and emits
  one line per matching entry. The `CLASSIFIER_QUESTION_TEXT` export is removed (it was already a derived view after
  MCP-MOD-004; this card removes the indirection).

The change is small (~10 lines). The new shape:

```ts
export function buildClassifierPrompt(request: ClassifyMoveRequest): string {
  const requestedIds = new Set(request.requestedClassifiers);
  const seen = new Set<string>();
  const questionLines: string[] = [];
  for (const entry of SEMANTIC_CLASSIFIER_CATALOG) {
    if (!requestedIds.has(entry.id) || seen.has(entry.id)) continue;
    seen.add(entry.id);
    questionLines.push(`- ${entry.id}: ${entry.structuralQuestion}`);
  }
  // ...rest unchanged (instruction text, input block)...
}
```

Iteration order is the catalog's declaration order — the same as `ALL_SEMANTIC_CLASSIFIER_IDS`, which is the same order
the pre-refactor `CLASSIFIER_QUESTION_TEXT` map produced when iterated. The implementer asserts iteration-order
stability with a snapshot test.

## 3. Behavior preservation

For every `ClassifyMoveRequest` the pre-refactor `buildClassifierPrompt` produced output X, the post-refactor function
produces byte-identical X. Verified by:

- The snapshot test introduced in MCP-MOD-004 against a fixed sample request.
- A new fuzz-style test that generates 50 random `requestedClassifiers` subsets and asserts byte-identical output
  between the old code path (preserved as a private helper for the duration of this card's review) and the new one.

After review sign-off, the old helper is removed in the same PR.

## 4. Tests

Required new tests:

- **Fuzz-parity test** as described in §3 — 50 random subsets, byte-identical output.
- **Iteration-order test** — asserts the question-line order for `requestedClassifiers = ALL_SEMANTIC_CLASSIFIER_IDS`
  matches the catalog's declaration order, which matches `ALL_SEMANTIC_CLASSIFIER_IDS`'s declaration order.

Existing tests:

- `__tests__/semanticAnthropicSeedPromptBanList.test.ts` continues to pass (the new code path still produces only
  structural questions, no ban-listed tokens).
- All other prompt-related tests pass without modification.

## 5. Smoke-test regression check

After the card lands and is deployed, the operator re-runs the smoke test and confirms results match the pre-refactor
baseline. Behavior preservation is the explicit acceptance bar.

## 6. Deployment

Operator-only: `npx supabase functions deploy semantic-referee --linked`. No migration. No secret. No runtime-config
change.

## 7. Rollback

Revert the merge commit. `buildClassifierPrompt` returns to its pre-refactor per-id literal lookup.

## 8. Acceptance criteria

- [ ] `seedPrompt.ts`'s `buildClassifierPrompt` iterates `SEMANTIC_CLASSIFIER_CATALOG`; the `CLASSIFIER_QUESTION_TEXT`
      hand-written map is removed.
- [ ] The fuzz-parity test passes 50/50.
- [ ] The iteration-order test passes.
- [ ] All existing tests pass without modification.
- [ ] `npm run typecheck && npm run lint && npm run test` all pass.
- [ ] Smoke-test re-run matches the pre-refactor baseline.

## 9. Risks

- **Iteration order silently changes when the catalog is reordered.** Mitigation: the iteration-order test pins it; the
  meta-roadmap's "behavior preservation" gate names this risk.
- **The fuzz test's RNG seed is non-deterministic.** Mitigation: the test seeds the RNG with a fixed value committed in
  the test file.

## 10. Not in scope

- Adding new fields to the prompt (e.g. full-thread context, author identifications). That is MCP-MOD-008's territory.
- Removing the `SEMANTIC_REFEREE_SYSTEM_PROMPT` constant. It stays in `anthropicClassifierCore.ts`.
- Changing the user-message instruction text (the strict-JSON contract block).
- Adding a per-id "active" flag to the catalog to dynamically include/exclude classifiers. Out of scope; if needed,
  ships as a separate card.
