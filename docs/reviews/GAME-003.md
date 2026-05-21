# GAME-003 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-20
**Branch:** feat/GAME-003-game-003-argument-mode-setup-for-1v1-pvp
**Design:** docs/designs/GAME-003.md
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/119

## Summary

GAME-003 Part A ships the pure-TS argument-mode model: a 13-mode `ArgumentMode`
enum, the canonical `SemanticClassificationMode`, the `ArgumentModeDefinition`
field record, the `ArgumentModeTemplate` wrapper, a frozen 13-entry
`ARGUMENT_MODE_TEMPLATES` registry (4 `shipped` MVP modes + 9 fully-typed
`design_only` stubs), nine accessor / setup-screen-support functions, an
`ARGUMENT_MODE_COPY` plain-language block in `gameCopy.ts`, and three test
files. The implementation matches the design precisely. Every mode's `pacing`
is constructed via GAME-002's `createPacingRule(...)` — never an object literal —
and `cooldownEnabled` + `permanentRecordWarning` are derived from the
constructed pacing rule inside one private `buildDefinition` helper, so the
two-place copies cannot drift; both invariants are test-asserted for all 13
modes. No mode field, copy string, helper, or disclaimer carries a
verdict / winner / loser / amplification token; no export turns a mode field
into a post-blocking gate. The mode setup screen is correctly deferred to the
named follow-up card GAME-003B. No code concerns remain — the card is ready for
the operator to push.

## Verification

- typecheck: pass
- lint: pass
- test: 6901 → 6961 tests / 266 → 269 suites (+60 tests / +3 suites; all pass, zero failures, exactly the implementer-reported count)
- skills:validate: pass (both bot skills hash-OK)
- secret scan: clean (the only `ANTHROPIC_API_KEY` / `SERVICE_ROLE` hits are documentation prose in the design doc and code comments that explicitly state "NO Supabase, NO network")
- doctrine scan: clean (the only `winner` / `loser` hits are a doc comment stating modes never declare one, and the ban-list helper that lists them as *forbidden* tokens)

## Design conformance

- [x] All design file-changes are present — exactly the 8 files: 6 expected (`argumentModeModel.ts`, `modes/index.ts`, `gameCopy.ts`, 3 test files, `current-status.md`) + the design doc itself. Nothing else.
- [x] No undocumented file-changes — no `supabase/` file, no `.env`, no migration, no React component, no GAME-002/RULE-004/RULE-005/BR-003/MCP file modified, no `package.json` / lockfile change.
- [x] Data model matches design — `ArgumentModeDefinition` is byte-identical to the issue's field list; `status` lives on the `ArgumentModeTemplate` wrapper as designed; `SemanticClassificationMode` is declared canonically here.
- [x] API contracts match design — all 9 exported accessors (`argumentModeTemplate`, `argumentModeDefinition`, `isShippedMode`, `isSensitiveMode`, `coerceArgumentMode`, `argumentModeDisplayName`, `argumentModeDescription`, `buildModeRuleRows`, `reviewModeForArgumentMode`) plus `_forbiddenArgumentModeTokens` match the design signatures; barrel re-exports are additive (GAME-002 pacing exports untouched).

Minor cosmetic note (non-blocking): the design taxonomy table renders
`negotiation_tradeoff`'s display name as "Negotiation / trade-offs"; the
implementation ships "Negotiation and trade-offs". The reworded form is the
more plain-language choice and the design body text already calls it
"Negotiation / trade-off framing" loosely — no functional impact, no doctrine
impact. Listed only for completeness.

## Doctrine self-check (all ✓)

- [x] No truth/winner/loser language in user-facing strings — `argumentModeBanList.test.ts` collects every produced user-facing string (all 13 display names, all 13 descriptions, every `buildModeRuleRows` label + value across all 13 modes, every present disclaimer, AND every value in `ARGUMENT_MODE_COPY`) and asserts none contains any token in `_forbiddenArgumentModeTokens()` — the verdict set (incl. `verdict`, `true`, `false`, `winner`, `loser`, `correct`, `right`, `wrong`, `validated`, `proven`, …), the amplification set (`viral`, `popular`, `trending`, `engagement`, `likes`, …), the block set (`block`, `reject`, `prevent`, …), and the person-attribution set. The implementer's `political_debate` "your view" copy reads "it only suggests a move, it never rules on a claim" — the design's "verdict" wording was reworded out; **zero verdict tokens remain in any `ARGUMENT_MODE_COPY` value**, confirmed by the passing ban-list scan over the whole block.
- [x] Score never blocks posting — GAME-003 adds no scoring logic. No mode field can block a post; `evidenceStrictness: 'strict'` is advisory strength only. No export returns a block-shaped result (verified by reading every exported function — they return templates, definitions, booleans, rule-row arrays, and a `'casual' | 'strict'` mapping value).
- [x] No service-role in client code — `argumentModeModel.ts` is pure TS; no Supabase import anywhere.
- [x] No direct insert into public.arguments — scan clean; no DB access of any kind.
- [x] No AI calls in production app paths — none. `semanticClassification` is an inert data field that *gates* a downstream advisory; it triggers nothing. Default `'off'` (fail-closed).
- [x] Plain language only — `buildModeRuleRows` maps every internal enum value (`loose`, `restricted`, `metadata_and_chip`, …) to prose via `ARGUMENT_MODE_COPY`; `argumentModeBanList.test.ts` asserts no rule-row value contains a raw enum value (word-boundary check) and no user-facing string leaks a snake_case `ArgumentMode` id, and re-uses `looksLikeInternalCode` from `gameCopy.ts`.
- [x] Epic-specific doctrine (point-standing-economy) — GAME-003 adds no scoring, no auto-concession, no inference from silence. `finalSynthesisExpected` is a setup-time *nudge*, never a score event and never an inferred concession. Modes do not write to point standing and do not touch `antiAmplification.ts`. A mode cannot win a point for anyone. `internet_fact_check` / `political_debate` foreground *evidence* and their copy is amplification-token-scanned — consistent with "popularity is not evidence."

## Test coverage

- [x] New public functions have unit tests — `argumentModeModel.test.ts` (413 lines) covers every public function including failure cases: `argumentModeTemplate` / `argumentModeDefinition` throw on `'not_a_mode'`; `coerceArgumentMode` tested against `''`, `null`, `undefined`, `42`, `{}`, `[]`, `Symbol`, `NaN`, `'COURT'`, `'casual disagreement'`; both cross-field invariants (cooldown sync, permanent-record sync) asserted for all 13 modes; frozen-object guards; determinism.
- [x] User-facing strings have ban-list assertion — `argumentModeBanList.test.ts` (181 lines) scans the full produced string set against the verdict / amplification / block / person-attribution ban-list; word-boundary matching is used for short ambiguous tokens (`true`, `won`, `right`, …) and substring matching for unambiguous ones — both still scan every token.
- [x] Edge cases from design § "Edge cases" have tests — unknown-mode throw + `coerceArgumentMode` fallback (cases 1-3), sensitive-disclaimer presence (case 4), cooldown-sync (case 6), permanent-record-sync (case 7), frozen objects (case 9), `semanticClassification` default `'off'` for the 5 named modes (case 10) — all covered.
- [x] Accessibility assertions present (if UI card) — N/A; Part A is a pure-TS model with no UI component. The setup-screen a11y requirements are documented in the design for the GAME-003B follow-up.

Sensitive-mode coverage: `argumentModeNoLegalAdvice.test.ts` (131 lines) asserts
exactly 2 sensitive modes (`co_parenting_custody`, `relationship_repair`), each
with a non-empty disclaimer ≥ 80 chars that states "does not give … advice",
names `legal` / `therap`, points to a qualified professional, does not read as
advice-giving instructions, and re-scans clean through the ban-list. All 4 MVP
modes asserted non-sensitive and disclaimer-free.

## Blockers

None.

## Suggestions (non-blocking)

1. Align the `negotiation_tradeoff` display name between the design taxonomy
   table ("Negotiation / trade-offs") and the shipped copy ("Negotiation and
   trade-offs"), or note the rewording in the design — purely cosmetic, the
   shipped form is the better one; defer or ignore.
2. When the future cleanup card reconciles MCP-012's local `SemanticClassificationMode`
   to import the canonical type from `argumentModeModel.ts`, this card's type is
   ready to be the single source — no action needed now (correctly out of scope).

## Operator next steps

- Push the branch: `git push -u origin feat/GAME-003-game-003-argument-mode-setup-for-1v1-pvp`
- Open PR: `gh pr create --title "GAME-003: Argument mode setup for 1v1 PvP (design + 4 templates)" --body-file docs/reviews/GAME-003.md`
- Deploy steps: **none** — pure-TS model + copy block + 3 tests + design doc. No `db push`, no `functions deploy`, no env var, no migration, no dependency install.
- Follow-ups (named, not this card): GAME-003B (mode setup screen component) and a later mode-persistence card (`debates.mode` column + RLS). The 2 sensitive-mode disclaimers are committed as design-only copy and need operator copy review only when a later card promotes those modes to `shipped`.
