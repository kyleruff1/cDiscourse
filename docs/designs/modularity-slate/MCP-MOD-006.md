# MCP-MOD-006 — Banner and ledger refactor (consume `SEMANTIC_CLASSIFIER_CATALOG`)

**Card:** MCP-MOD-006 (Rules UX · P2 · S · Release 6.9 · Movement B).
**Status:** Design summary.
**Epic:** Rules UX.
**Movement:** B (modularity refactor). **Final card of Movement B.**
**Meta-roadmap:** [`docs/core/roadmap-semantic-referee-modularity.md`](../../core/roadmap-semantic-referee-modularity.md).
**Depends on:** MCP-MOD-004 (the source-of-truth must exist).
**Parallelizable with:** MCP-MOD-005 (both depend on `004` and touch different files).

---

## 1. Goal

Make changing a classifier's banner copy or ledger feedback code a single-file change. After MCP-MOD-004, the catalog
already holds the `bannerCode` and `ledgerFeedbackCode` per id; this card changes the banner library and the ledger to
consume those mappings directly, eliminating any remaining per-id duplicate constants.

## 2. Files changed

The implementer surveys (using MCP-MOD-002's inventory as the ground truth) every per-id mapping in:

- **`src/features/refereeBanners/`** — every file under this tree. Any hand-written `id → bannerCode` map becomes a
  view over `CATALOG_BY_ID.get(id).bannerCode`. The banner files themselves (the per-banner React components and
  selection logic) stay; only the per-id LOOKUP is refactored.
- **`src/features/pointStanding/`** — every per-id `ledgerFeedbackCode` lookup. Same refactor: each lookup goes through
  the catalog.
- **`src/lib/gameCopy.ts`** (or wherever `toPlainLanguage` lives) — per-id plain-language overrides come from
  `CATALOG_BY_ID.get(id).plainLanguageLabel` when present, with the existing fallback for ids without an override.

## 3. Behavior preservation

For every input (a `SemanticRefereePacket` for the banner library; a per-id feedback event for the ledger), output is
byte-identical to the pre-refactor behavior.

Verification:

- Existing banner tests pass without modification.
- Existing ledger tests pass without modification.
- A new fuzz-style test for the banner library generates 50 random packets and asserts byte-identical output between
  pre-refactor (preserved for review duration) and post-refactor selections.

## 4. Tests

Required new tests:

- **Banner fuzz-parity test** — 50 random packets, byte-identical `BannerSelectionResult`.
- **Ledger fuzz-parity test** — 50 random per-id feedback events, byte-identical ledger writes.
- **Plain-language parity test** — for every classifier id in `ALL_SEMANTIC_CLASSIFIER_IDS`, `toPlainLanguage(id)`
  returns the same string pre- and post-refactor.

Existing tests:

- Every banner-library test passes without modification.
- Every ledger test passes without modification.
- `__tests__/semanticAnthropicSeedPromptBanList.test.ts` continues to pass (this card doesn't touch the prompt).

## 5. Smoke-test regression check

After the card lands and is deployed, the operator re-runs the smoke test and confirms results match the pre-refactor
baseline. The smoke test does not exercise banner / ledger directly (it asserts only that classify calls succeed and the
packet shape is valid), so the regression check is the unit tests + the fuzz tests + a manual UI sanity check that the
banner and ledger UI still render for a packet with each catalog-id triggered.

## 6. Deployment

This card's diff is entirely client-side (`src/`). No Edge Function redeploy is required. CI is sufficient. No migration.
No secret. No admin runtime-config change.

## 7. Rollback

Revert the merge commit. The pre-refactor per-id maps were preserved as private helpers during review; a revert restores
them.

## 8. Acceptance criteria

- [ ] Every per-id banner-code mapping reads from `CATALOG_BY_ID.get(id).bannerCode`.
- [ ] Every per-id ledger feedback code reads from `CATALOG_BY_ID.get(id).ledgerFeedbackCode`.
- [ ] `toPlainLanguage` uses `CATALOG_BY_ID.get(id).plainLanguageLabel` where present.
- [ ] The three fuzz-parity tests pass.
- [ ] All existing tests pass without modification.
- [ ] `npm run typecheck && npm run lint && npm run test` all pass.
- [ ] Smoke-test re-run matches baseline.

## 9. Risks

- **A per-id mapping in a banner / ledger file is missed.** Mitigation: the implementer cross-checks against MCP-MOD-002's
  inventory; any miss is caught by the fuzz tests in §4.
- **A banner / ledger file holds metadata that doesn't fit the catalog's current shape.** Mitigation: the catalog's
  `SemanticClassifierCatalogEntry` may need an additional field; if so, this card adds the field (a one-line extension)
  rather than punting to a follow-up. If the field is genuinely orthogonal (e.g. UX timing), it stays in the banner / ledger
  file and the card's design summary is updated.

## 10. Not in scope

- Changing banner copy. The refactor preserves it.
- Changing ledger feedback effects. The refactor preserves them.
- Adding new banners or ledger codes. New mappings require a separate roadmap card.
- Removing classifier ids. Out of scope by doctrine — catalog v0 is frozen.
