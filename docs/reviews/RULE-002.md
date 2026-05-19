# RULE-002 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-19
**Branch:** feat/RULE-002-evidence-symmetry-between-validation-and
**Design SHA:** e8b7745
**Implementation SHAs:** da5a7c8, 1a08845, 4bf23cc
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/33
**Design:** docs/designs/RULE-002.md

## Summary

RULE-002 ships a pure-TS validation-action adapter (`src/features/rulesUx/validationActionMap.ts`) plus a chip render in `ComposerValidationPanel` and a one-call routing handler in `ArgumentComposer`. The map keys 23 codes (16 engine `FLAG_CODES` + 7 Stage 6.2 / 6.4 advisory codes) to a render-ready `{ chipLabel, helperLine, suggestedMove, dockAction, presetKey }` tuple. The chip is purely additive — it pre-seeds a draft patch through existing `quickActionToPreset` + `handleMovePatch` paths and never touches the submit gate. The constitution engine is untouched, only type-paths from sibling models are imported, no new dependencies are added, and no AI / fetch / Supabase / service-role calls appear anywhere in the diff. All three documented divergences from the design (dropped `FlagCode` value-import, two helper-line rewordings, narrowed cross-surface ST-002 scan) are doctrine-justified and covered by stronger replacement tests. The 67 new tests cover coverage / exhaustiveness, length caps, three independent ban-list scans, issue acceptance criteria, submit-button-additive invariant, normalisation, RULE-001 vocabulary parity, render contract, structural hygiene, doctrine self-check (engine sacredness + no AI / network / React in the source file), and a regression check on the plain-language layer.

## Verification

- **typecheck:** pass (`npm run typecheck` exits 0)
- **lint:** pass (`npm run lint` exits 0, `--max-warnings 0`)
- **test:** 3913 → 3980 tests / 135 → 136 suites (+67 tests / +1 suite). 19 pre-existing operator-gated xAI/Anthropic suite failures unchanged.
- **secret scan:** clean. Hits on `winner`/`loser`/`liar`/`bad faith`/`manipulative`/`extremist`/`propagandist` are all inside `_forbiddenValidationActionTokens()` — i.e. they are the ban-list array that *enforces* the doctrine, not violations.
- **doctrine scan:** clean. The only `anthropic` / `xai` matches in the production diff are inside a source comment that *explicitly says the file does not call them*.
- **engine sacredness:** `src/domain/constitution/engine.ts` zero-diff; `src/domain/constitution/types.ts` zero-diff. `validationActionMap.ts` has no `constitution/*` imports at all (only three pure type-imports from sibling models). Verified by Grep on `^import`.
- **no-new-deps:** `package.json` / `package-lock.json` zero-diff.
- **no Supabase / migration / Edge Function / .env touch:** all zero-diff.

## Design conformance

- [x] All design file-changes are present: `validationActionMap.ts`, `validationActionMap.test.ts`, `ComposerValidationPanel.tsx`, `ArgumentComposer.tsx`, `docs/current-status.md`. Exactly six files diffed, matching the brief's expected footprint.
- [x] No undocumented file-changes (GAL-001 / GAL-002 / BRAND-001 / RULE-001 / RULE-003 / suggestedMovesModel / quickActionPresets / timelineNodeActionDockModel / engine / migrations all zero-diff).
- [x] Data model matches design: 23 codes (16 engine + 7 advisory), `ValidationActionUx` shape matches contract, `VALIDATION_ACTION_MAP` is `Readonly<Record<...>>`, `ALL_VALIDATION_ACTION_CODES` is frozen, three public readers + one render-contract helper exported, `_forbiddenValidationActionTokens` exported for tests.
- [x] API contracts match design: `getValidationAction` is total, `mapValidationActionOrSuppress` normalises and suppresses unknowns, `shouldRenderValidationActionChip` is the renderer guard. Field caps (`chipLabel` ≤ 32, `helperLine` ≤ 80) verified at runtime: chipLabel max = 26, helperLine max = 78.
- [x] The mapping table in the design matches the shipped values for all 23 entries, with the three documented divergences applied verbatim.

## Documented divergences from the design (each assessed)

1. **`FlagCode` value-import dropped — Accept.**
   tsc + ESLint flagged it as unused; the union mirrors `FLAG_CODES` values directly. The contract is preserved by two stronger tests in `validationActionMap.test.ts`:
   - Lines 130-136 (`every value of FLAG_CODES (engine) appears in ALL_VALIDATION_ACTION_CODES`) — runtime iteration over `Object.values(FLAG_CODES)`.
   - Lines 734-750 (`validationActionMap NEVER value-imports the constitution engine module (sacred rule)`) — direct regex scan of the source file for any non-type import from `constitution/engine` or `constitution/*`.
   - Plus lines 760-786 (`engine module file is not modified by this change`) — sanity guard on `FLAG_CODES` keyset.
   The original "at least one type-import" intent has been replaced by a stronger pair of structural invariants. Engine sacred rule is preserved by construction (no engine import at all, value or type, in this module).

2. **Two helper-line rewordings for ban-list compliance — Accept.**
   - `ad_hominem_possible.helperLine`: "Keep this move on the argument, not on a person." The original "the speaker" is on the `PERSON_ATTRIBUTION_TOKENS` list (verified at `suggestedMovesModel.ts:220`). The new phrase says "a person" generically, which is not on the ban-list. Doctrine intent preserved (refocus on argument structure, not the author).
   - `anti_amplification.helperLine`: "...Reach does not equal support." The original "Engagement does not equal support" used the standalone `engagement` token, which is on the `_forbiddenMetadataTokens` list (verified at `moveMetadataLedger.ts:464`). "Reach" carries the same semantic and is doctrine-clean. **chipLabel "Popularity is not proof" preserved verbatim per doctrine §3** (verified at line 309 of the source, and pinned by lines 360-362 of the test file with literal equality).

3. **Cross-surface ST-002 ban-list scan narrowed to person-attribution subset — Accept.**
   `_forbiddenSuggestionTokens()` includes `proof` (verdict-shape token from the metadata ban-list) and `popular` (amplification-shape token), which collide with the doctrine-canonical chipLabel "Popularity is not proof". The narrowing rationale is sound: applying the full ST-002 list directly would falsely flag the canonical phrase. The implementer correctly replaced the broad cross-check with three tighter, independent scans:
   - `VERDICT_TOKEN_REGEX` covers winner/loser/liar/dishonest/bad faith/manipulative/extremist/propagandist/stupid/idiot/astroturfer/troll/verdict/proven/disproven/validated/lost/defeated/won/incorrect.
   - `STRICT_VERDICT_TOKEN_REGEX` covers `true|false|correct` as standalone tokens.
   - `AMPLIFICATION_TOKEN_REGEX` covers viral/trending/likes/retweets/shares/followers/virality/amplification.
   - `STANDALONE_POPULAR_REGEX` uses `\bpopular\b` (which does NOT match "Popularity" — `\b` boundary preserves the canonical phrasing).
   - Cross-surface vocabulary parity with RULE-001 is enforced separately by lines 549-557 (`SHARED_CODES` × `RULE_002.chipLabel === RULE_001.toolLabel`).
   The combined coverage is at least as strict as the original design intent. **Verified that `chipLabel: 'Popularity is not proof'` passes all four direct scans.**

## Doctrine self-check (must all be ✓)

| Check | Status | Evidence |
| --- | --- | --- |
| **§5 Rules engine is sacred** | ✓ | `src/domain/constitution/engine.ts` zero-diff (`git diff main..HEAD --stat` on the path returned empty). `validationActionMap.ts` imports nothing from `constitution/*`. Test at lines 734-750 enforces no value-import of `constitution/engine`. Test at 760-786 pins `FLAG_CODES` keyset. |
| No truth/winner/loser language in user-facing strings | ✓ | `VERDICT_TOKEN_REGEX` test runs over all 46 strings (23 chipLabel + 23 helperLine). Tokens only appear inside `_forbiddenValidationActionTokens()` (test helper). |
| Score never blocks posting | ✓ | `ArgumentComposer.tsx` diff confirms `canSubmit` is unchanged. The new `handleValidationAction` only calls `quickActionToPreset` + `handleMovePatch` (existing functions). Submit-additive invariant pinned by tests at lines 427-498. |
| No service-role in client code | ✓ | Production diff scan for `SERVICE_ROLE` returned zero. |
| No direct insert into public.arguments | ✓ | Production diff scan returned zero. |
| No AI calls in production app paths | ✓ | Source file forbids `fetch`/`supabase`/`anthropic`/`xai` imports — enforced by test at lines 724-732. The only mention is in a doctrine comment explaining the file does NOT call them. |
| Plain language only (no raw internal codes in UI strings) | ✓ | `looksLikeInternalCode` test at lines 192-198 runs over all 46 strings. Snake_case-leak test at 200-208 confirms no `code` substring appears in any chipLabel/helperLine. |
| **Evidence-doctrine — popularity is not evidence** | ✓ | `anti_amplification.chipLabel = "Popularity is not proof"` (pinned literal). `anti_amplification` + `platform_support_warning` + `evidence_debt` + `source_chain` all route to `ask_source` / `source` preset — i.e. "ask for evidence" affordances, never "discredit user" actions. |
| **Evidence-doctrine — ask-for-evidence, not "this is false"** | ✓ | `evidence_required` routes to `ask_source` / `add_evidence` / `evidence` preset (verified at lines 393-399 of test). The chip never carries a falsity claim. |
| **Stage 6.2 advisory semantics preserved** | ✓ | `OFF_TOPIC` and `PARENT_NONRESPONSIVE` remain advisory — they appear in the map but the chip is *additive*; no new gate is introduced. Pre-existing `evaluateArgumentDraft.ts` advisory framing is untouched (zero diff). |
| Accessibility — 44×44 tap target | ✓ | `ComposerValidationPanel.tsx` line 51: `hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}` lifts the ~24px visual to ≥ 48px effective. |
| Accessibility — role + label + state | ✓ | Lines 47-50 of `ComposerValidationPanel.tsx`: `accessibilityRole`, `accessibilityLabel = ${chipLabel}. ${helperLine}`, `accessibilityHint`, `accessibilityState`. Two states — `'button'` when pressable, `'text'` when not. |
| Color is never the only signal | ✓ | Chip uses neutral surface (`#e5e7eb`); the `chipLabel` text carries the meaning. Documented at line 201-202 of `ComposerValidationPanel.tsx`. |
| No new dependency | ✓ | `package.json` / `package-lock.json` zero-diff. |
| No migration / Edge Function / service-role / .env touch | ✓ | `supabase/` zero-diff. `.env*` zero-diff. |

## Test coverage

- [x] New public functions (`getValidationAction`, `mapValidationActionOrSuppress`, `shouldRenderValidationActionChip`) all have unit tests.
- [x] User-facing strings have three independent ban-list assertions (verdict tokens, strict verdict tokens, amplification tokens, person-attribution tokens, standalone `popular`).
- [x] Edge cases from design § "Edge cases" have tests: unknown code → null (line 162-168), all-null routing → suppressed (lines 599-607), submit-additive (lines 427-498), normalisation variants (lines 504-531).
- [x] Accessibility surfaced indirectly through `accessibilityLabel`-shape test (lines 617-624); render contract pins the data shape the panel consumes. The Pressable's `accessibilityRole` / `accessibilityLabel` / `hitSlop` are wired in code; no UI integration test mounts the panel (acceptable per `test-discipline` "pure-TS models test in isolation" — the panel itself is a straightforward Pressable render).

### Tests pinning the load-bearing invariants

| Invariant | Test |
| --- | --- |
| Engine sacred — no value-import | `validationActionMap.test.ts:734-750` |
| Engine sacred — module not modified | `validationActionMap.test.ts:760-786` |
| Coverage: 16 FLAG_CODES present | `validationActionMap.test.ts:130-136`, `841-845` |
| Coverage: 7 advisory codes present | `validationActionMap.test.ts:138-142` |
| Length caps | `validationActionMap.test.ts:176-189` |
| Verdict / amplification / person-attribution ban | `validationActionMap.test.ts:262-300` |
| Doctrine-canonical "Popularity is not proof" | `validationActionMap.test.ts:360-362` |
| RULE-001 chipLabel parity | `validationActionMap.test.ts:549-557` |
| Submit-button is additive only | `validationActionMap.test.ts:427-498` |
| All-null routing → chip suppressed | `validationActionMap.test.ts:599-607` |
| No fetch / Supabase / Anthropic / xAI / React / async | `validationActionMap.test.ts:724-758` |

## Blockers

None.

## Suggestions (non-blocking)

1. **CLAUDE.md path drift (project-wide, not RULE-002's responsibility).** CLAUDE.md still says the engine lives at `src/lib/constitution/engine.ts`; it actually lives at `src/domain/constitution/engine.ts`. Worth a follow-up cleanup card.
2. **Optional v2: duplicate-chip dedup.** Two warnings that both route to `ask_source` produce two visually-stacked chips. The design notes this is a v2 concern; current behavior is acceptable.
3. **Optional v2: chip disable when `quickActionToPreset` returns `null`.** Today the chip is rendered but the press becomes a no-op (composer receives no patch). Not a crash, but a slightly inert affordance. Design tracks this as v2.
4. **Render-layer integration test.** Optional: a lightweight `@testing-library/react-native` test that mounts `ComposerValidationPanel` with a warning fixture and asserts the chip's `accessibilityLabel` is concatenated correctly. Pure-TS coverage is already complete; this would be belt-and-braces for the UI seam.

## Operator next steps

- Push the branch: `git push -u origin feat/RULE-002-evidence-symmetry-between-validation-and`
- Open PR: `gh pr create --title "RULE-002: Evidence symmetry between validation and visuals" --body-file docs/reviews/RULE-002.md`
- Deploy steps: **none.** Pure code change; no migration, no Edge Function deploy, no env var, no Supabase write.
