# MCP-MOD-004 — Source-of-truth extraction (`SEMANTIC_CLASSIFIER_CATALOG` constant)

**Card:** MCP-MOD-004 (Rules UX · P2 · M · Release 6.9 · Movement B). **Keystone refactor of the slate.**
**Status:** Design summary.
**Epic:** Rules UX.
**Movement:** B (modularity refactor).
**Meta-roadmap:** [`docs/core/roadmap-semantic-referee-modularity.md`](../../core/roadmap-semantic-referee-modularity.md).
**Depends on:** MCP-MOD-002 (classifier catalog inventory — the ground-truth declaration), MCP-MOD-003 (prompt template
inventory — confirms question text invariants).
**Unblocks:** MCP-MOD-005 (prompt refactor reads the constant), MCP-MOD-006 (banner / ledger refactor reads the
constant), MCP-MOD-007 (move-position helper's interface lives alongside the constant).

---

## 1. Goal

Consolidate the classifier definitions currently scattered across `types.ts` (id list), `seedPrompt.ts` (question
text per id), the banner files (per-id banner-code mapping), and the ledger files (per-id feedback-code mapping) into
a single TypeScript object `SEMANTIC_CLASSIFIER_CATALOG` that holds, per id, every piece of metadata. Existing files
import from this new constant rather than maintaining their own per-id duplicates. Behavior is preserved exactly — the
refactor is structural.

## 2. File created

`src/lib/constitution/semanticClassifierCatalog.ts` (Node-side; pure TypeScript; no imports from Supabase, React, or
network libraries — same purity rules as `engine.ts`).

The Deno-side mirror lives at `supabase/functions/_shared/semanticReferee/semanticClassifierCatalog.ts` because the
Deno boundary's `seedPrompt.ts` consumes it server-side, and the Node ↔ Deno parity-test pattern from
`semanticAnthropicContentScanParity.test.ts` requires file-as-text parity.

## 3. Shape of the constant

```ts
export interface SemanticClassifierCatalogEntry {
  /** The id-string — must match a member of `ALL_SEMANTIC_CLASSIFIER_IDS`. */
  id: SemanticClassifierId;
  /** Plain-language description of what the binary detects. From MCP-MOD-002. */
  binarySignal: string;
  /** The structural yes/no question asked of the model. Verbatim from `seedPrompt.ts`. */
  structuralQuestion: string;
  /** The family the id belongs to (§A parent continuity / §C evidence / §D movement / §E mode / §B routing / §G friction). */
  family: 'parent_continuity' | 'evidence' | 'movement' | 'mode_fit' | 'routing' | 'friction';
  /** Banner code mapped to this classifier when value=1 + medium/high confidence. `null` if unmapped. */
  bannerCode: string | null;
  /** Ledger feedback code for this classifier. `null` if no ledger entry. */
  ledgerFeedbackCode: string | null;
  /** Optional plain-language label used in user-facing copy via `gameCopy.toPlainLanguage`. */
  plainLanguageLabel?: string;
}

export const SEMANTIC_CLASSIFIER_CATALOG: ReadonlyArray<SemanticClassifierCatalogEntry> = Object.freeze([
  // 23 entries, one per id, declaration order matching ALL_SEMANTIC_CLASSIFIER_IDS.
]);

/** Index by id for O(1) lookup. */
export const CATALOG_BY_ID: ReadonlyMap<SemanticClassifierId, SemanticClassifierCatalogEntry>;
```

## 4. Files that change to consume the constant

The refactor is mechanical: every file that currently holds a per-id literal switches to importing the constant.

- **`supabase/functions/_shared/semanticReferee/seedPrompt.ts`**: `CLASSIFIER_QUESTION_TEXT` is derived from the
  catalog by mapping `id → structuralQuestion`. The exported constant remains (so existing callers don't break) but
  its initialization is now a one-line `Object.fromEntries(CATALOG_BY_ID.entries().map(...))` rather than 23
  hand-written entries.
- **`src/features/refereeBanners/`** files: every per-id banner-code mapping reads `CATALOG_BY_ID.get(id).bannerCode`.
- **`src/features/pointStanding/`** ledger files: same pattern for `ledgerFeedbackCode`.
- **`src/lib/gameCopy.ts`** (or wherever `toPlainLanguage` lives): the `plainLanguageLabel` overrides come from the
  catalog when present.

The catalog is the AUTHORITY for per-id metadata after this card. Existing per-id constants in other files are either
deleted (if they duplicate the catalog) or rewritten as derived views.

## 5. Behavior preservation

This is a structural refactor. No observed behavior changes. Specifically:

- The seed prompt produces a byte-identical user-message for any given `ClassifyMoveRequest` (verified by snapshot test).
- The banner library produces byte-identical `BannerSelectionResult` for any given packet (verified by existing tests).
- The ledger produces byte-identical feedback for any given input (verified by existing tests).
- `ALL_SEMANTIC_CLASSIFIER_IDS` continues to be the canonical id union (the catalog imports the union from `types.ts`,
  not the reverse).

## 6. Tests

Required new tests:

- **`__tests__/semanticClassifierCatalogParity.test.ts`** — asserts:
  - Every member of `ALL_SEMANTIC_CLASSIFIER_IDS` has a catalog entry.
  - Every catalog entry's `id` is in `ALL_SEMANTIC_CLASSIFIER_IDS`.
  - For every id, `CATALOG_BY_ID.get(id).structuralQuestion === CLASSIFIER_QUESTION_TEXT[id]` (initially; after the
    refactor lands and `CLASSIFIER_QUESTION_TEXT` becomes a derived view, the equality is tautological — the test still
    asserts it as forward-compat insurance).
- **Snapshot test of `buildClassifierPrompt`** for a fixed sample request — asserts the user-message is byte-identical
  to a frozen golden file (the implementer captures the pre-refactor output as the golden).
- **Deno ↔ Node catalog parity** — source-scan test asserting the two `semanticClassifierCatalog.ts` files declare
  the same 23 ids with the same `structuralQuestion` / `family` values (mirrors `semanticAnthropicContentScanParity`
  posture).

Existing tests must continue to pass without modification — most importantly:

- `__tests__/semanticAnthropicSeedPromptBanList.test.ts` (id-coverage parity + ban-list scan).
- Every banner-library test.
- Every ledger test.

## 7. Smoke-test regression check

After the card lands and is deployed, the operator re-runs the smoke test
(`node scripts/bot-fixtures/runMcpSmokeTest.js`) and confirms results match the pre-refactor baseline. The smoke-test
framework is the structural regression check; the unit tests are the behavioral check.

## 8. Deployment

Operator-only: `npx supabase functions deploy semantic-referee --linked` after merge (the Deno-side catalog ships in
the function bundle). No migration. No secret change. No admin runtime-config change.

## 9. Rollback

Revert the merge commit. The pre-existing per-id constants in `seedPrompt.ts` / banner files / ledger files were
preserved (rewritten as derived views), so a revert restores the original explicit per-id declarations.

## 10. Acceptance criteria

- [ ] `src/lib/constitution/semanticClassifierCatalog.ts` exists with the constant declared as in §3.
- [ ] The Deno-side mirror at `supabase/functions/_shared/semanticReferee/semanticClassifierCatalog.ts` exists with
      byte-identical 23-id metadata.
- [ ] `seedPrompt.ts`'s `CLASSIFIER_QUESTION_TEXT` is derived from the catalog (not hand-written).
- [ ] Banner files consume `CATALOG_BY_ID.get(id).bannerCode`.
- [ ] Ledger files consume `CATALOG_BY_ID.get(id).ledgerFeedbackCode`.
- [ ] The three new tests in §6 pass.
- [ ] All existing tests pass without modification.
- [ ] The snapshot test's golden file is committed.
- [ ] `npm run typecheck && npm run lint && npm run test` all pass.
- [ ] Smoke-test re-run produces results matching the pre-refactor baseline.

## 11. Risks

- **A per-id mapping is missed.** Mitigation: the parity test in §6 fails the build for any id-coverage gap.
- **The Deno mirror drifts from the Node version.** Mitigation: the file-as-text parity test in §6.
- **A test depends on the pre-refactor file structure rather than behavior.** Mitigation: if such a test breaks, the
  test is the bug — rewrite the test to assert behavior. Get reviewer sign-off before changing any test.

## 12. Not in scope

- Adding new fields to the catalog beyond what §3 lists. New fields require a follow-up card.
- Changing the question text. The refactor preserves it.
- Reorganizing the existing files (renaming, moving, splitting). The refactor is purely additive on a new constant.
- Removing `ALL_SEMANTIC_CLASSIFIER_IDS` from `types.ts`. It stays as the canonical union.
