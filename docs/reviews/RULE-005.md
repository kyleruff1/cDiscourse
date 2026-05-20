# RULE-005 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-20
**Branch:** feat/RULE-005-rule-005-structured-argument-channels-mo
**Design:** docs/designs/RULE-005.md
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/115

## Summary

RULE-005 ships a thin, plain-language "channel" layer above the 8 Constitution
argument types: a pure-TS model (`channelModel.ts`), two presentational
components (`ChannelChipRow.tsx`, `ChannelHelperFields.tsx`), three frozen
copy blocks in `gameCopy.ts`, and a non-destructive wiring into the existing
`ArgumentComposerDock`. The implementation matches the design doc closely,
including the four documented card-vs-reality decisions (D1 file placement,
D3/OD-2 non-persistence, OD-1 inline advisory, OD-3 dock-local state). The
model is genuinely deterministic — it imports types only, inspects no draft
body text, reads no heat/popularity signal, and returns a `ChannelSuggestion`
with no blocking field. Doctrine is clean: no verdict tokens in any
user-facing string, plain-language copy via `gameCopy`, no AI, no network, no
service-role, no migration. Typecheck and lint pass; all six RULE-005 test
suites pass plus the one modified suite. The only genuine test failures (19,
in 5 suites) are the documented pre-existing `xai*`/`aiDrivenBotCorpus`
environmental failures — confirmed unrelated to this card. The work is ready
to push.

## Verification

- typecheck: pass (`tsc --noEmit`, zero errors)
- lint: pass (`eslint . --max-warnings 0`, zero warnings)
- test: 5235 tests / 188 suites total — **5216 pass / 19 fail**; **183 suites pass / 5 fail**
  - The 19 failures are all in 5 env-gated bot-fixture suites:
    `xaiAdversarialProvider`, `xaiSeededStancesLive`, `xaiAdversarialPipeline`,
    `xaiAdversarialSourceHarvest`, `aiDrivenBotCorpus`. Each fails because the
    gitignored `.env.engagement-intelligence` is absent from this isolated
    worktree (errors are `env_file_missing` instead of the expected
    `no_pilot_flag` / `api_key_missing`). These are the documented main-baseline
    environmental failures — **NOT a RULE-005 regression.**
  - All RULE-005 suites pass: `channelModel.test.ts`,
    `channelSuggestionDerivation.test.ts`, `channelNoKeywordBlock.test.ts`,
    `channelCopyBanList.test.ts`, `ChannelChipRow.test.tsx`, plus the modified
    `composerDockPresetWiring.test.ts`. RULE-005 adds ~123 tests.
- secret scan: clean (no API keys, Bearer tokens, JWTs, or service-role refs in the diff)
- doctrine scan: clean (the only `winner/loser/...` hits in the diff are the
  ban-list array literal inside `_forbiddenChannelTokens()` — the test fixture
  that scans *for* those tokens, not user-facing copy)

## Design conformance

- [x] All design file-changes are present — 15-file footprint matches exactly
  (3 new production, 3 modified production, 5 new tests, 1 modified test,
  1 new design doc, 2 modified docs).
- [x] No undocumented file-changes — no `supabase/` files, no migration, no
  Edge Function, no `.env*` change, no `package.json` / `package-lock.json`
  change (no new dependency).
- [x] Data model matches design — `MoveChannel` (12 active + 2 reserved),
  `ChannelDefinition`, `ChannelSuggestion`, `CHANNEL_DEFINITIONS`,
  `ChannelSuggestionReason`/`Confidence`/`Mode` all match §3.1. Channel is a
  draft-time advisory field; no `arguments.channel` column (design §3.2 / D3 / OD-2).
- [x] API contracts match design — `channelDefinition`, `suggestChannelFromDraft`
  (6-rule ordered derivation per §5.2), `channelToDraftPatch` (§5.3),
  `deriveChannelForPostedMove` (§5.4) all present with the documented signatures.
  `resolveChallengeType` exported one-word from `conversationMoves.ts` and reused
  (no duplicated transition logic). Forward/reverse maps share one private
  `classifyByTypeAndTags` helper (design R2 — no drift).
- [x] Documented decisions honored honestly:
  - **D1** — model placed at `src/features/arguments/channelModel.ts` (no
    `src/features/composer/` exists). Correct.
  - **D3 / OD-2** — channel not persisted; META-001's locked `ManualTagCode`
    vocabulary untouched (`src/features/metadata/*` not in the diff). Correct.
  - **OD-1** — mismatch advisory ships inline in `ChannelChipRow` (RULE-004's
    `PreSendReviewSheet` does not exist); the model is the single source a
    future sheet can consume. Correct and honest.
  - **OD-3** — channel held in dock-local `useState`, not threaded through
    `MoveDraftPatch` (smaller diff). `conversationMoves.ts` only gains the
    one-word export. Correct.

## Doctrine self-check (must all be ✓)

- [x] No truth/winner/loser language in user-facing strings — `channelCopyBanList.test.ts`
  scans every label, purpose, rationale, and the three `gameCopy` blocks against
  a verdict/amplification/block token list; zero matches. `concede` copy
  describes the move shape, never a defeat.
- [x] Score never blocks posting — `ChannelSuggestion` has no `structuralBlock` /
  `blocked` / `canPost` field; `channelNoKeywordBlock.test.ts` asserts this
  structurally. The re-route advisory is a `Pressable` the user may ignore.
- [x] No service-role in client code — diff scan clean; the model imports types only.
- [x] No direct insert into public.arguments — no DB access of any kind in the diff.
- [x] No AI calls in production app paths — `channelModel.ts` imports types +
  frozen copy tables only; no `fetch`, no Anthropic/xAI, no Edge Function call.
  `suggestChannelFromDraft` is pure/deterministic/idempotent.
- [x] Plain language only — every channel string read from `gameCopy`
  (`CHANNEL_LABEL_COPY` / `CHANNEL_PURPOSE_COPY` / `CHANNEL_RATIONALE_COPY`);
  `looksLikeInternalCode` asserted false for every label; no snake_case leak.
- [x] Epic-specific doctrine (timeline-grammar) — RULE-005 adds no new node
  visual; `branch_tangent` maps to the existing `branch` visual. The
  "Suggested" affordance uses text + a heavier border (shape), never color
  alone; `ChannelChipRow.test.tsx` asserts the affordance text is a literal
  word a grayscale/screen-reader user can perceive.
- [x] No-heat-input doctrine — `suggestChannelFromDraft` reads `argumentType`,
  qualifier codes, and the parent's *structural* lifecycle state only;
  `channelNoKeywordBlock.test.ts` feeds two structurally-identical clusters
  with wildly different move counts and asserts identical suggestions.

## Test coverage

- [x] New public functions have unit tests — `channelDefinition`,
  `suggestChannelFromDraft` (all 6 derivation rules + branches),
  `channelToDraftPatch` (every channel, including the empty-patch channels and
  the engine-would-reject case), `deriveChannelForPostedMove` (type map,
  lifecycle fallback, qualifier disambiguation, unknown fallback),
  `getChannelLabel`, plus the chip-row / helper-field pure helpers.
- [x] User-facing strings have ban-list assertion — `channelCopyBanList.test.ts`
  covers all produced strings + the per-call rationale paths; `branch_tangent`
  non-punitive check (no dodge/evade/avoid) and `concede`-not-a-defeat check.
- [x] Edge cases from design §7 have tests — root draft (no parent),
  empty/untyped draft, rule-1-wins-over-rule-3 no-contradiction, mismatch when
  draft type changes underneath, `meta_process` empty patch, channel→type the
  engine would reject (separation of concerns), unknown-channel throw,
  reverse-map unknown fallback. Reduce-motion is a documented no-op (the row
  has no animation) — acceptable.
- [x] Accessibility assertions present — `ChannelChipRow.test.tsx` asserts the
  suggested chip's a11y label carries "suggested", selected chips carry
  "selected", the hit slop yields a ≥ 44×44 effective target (36 + 12 + 12 =
  60), and the advisory text is non-punitive. The component additionally sets
  `accessibilityRole="radio"` / `radiogroup`, `accessibilityState={{ selected }}`,
  and `accessibilityLabel` on every chip and `accessibilityLabel` on every
  helper-field `TextInput`.

## Blockers

None.

## Suggestions (non-blocking)

1. **Dock suggestion is currently inert.** In `ArgumentComposerDock`,
   `suggestChannelFromDraft` is called with `argumentType: null` and a fully
   null parent (`parentSnapshot`/`parentClusterSummary`/`parentLinkage` all
   `null`). With those inputs the model can only ever return rule 6
   (`no_signal` / `reply`), so in v1 the dock's rationale line always reads
   "Start anywhere…" and `isMismatch` only fires after the user manually picks
   a non-`reply` chip. This is *honestly documented* in the dock comment and is
   forward-compatible (a later card threading the LIFE-001 / META-001 maps
   needs no model change), and the model itself is fully exercised by the unit
   tests — so this is not a blocker. But the user-visible value of the
   suggestion engine is deferred until those maps are threaded in. Consider a
   fast-follow that passes at least the parent's `argumentType` (available on
   `parentArgument`) so the dock can produce a `deterministic_match` / rule-1
   suggestion today.

2. **`disagreementAxis` is accepted but unused.** `SuggestChannelDraftInput`
   carries `disagreementAxis` and the model never reads it. This matches the
   design's input contract, but a one-line comment in the model noting it is
   reserved for a future rule (or RULE-006) would prevent a future reader
   assuming it is a missed branch.

3. **`getChannelPurpose` fallback string differs from `getChannelLabel`.**
   The reserved-channel fallbacks are "Reserved" (label) vs "Reserved for a
   future card." (purpose). Harmless — reserved channels are never surfaced —
   but worth a glance for consistency if the reserved channels ever activate.

## Operator next steps

- Push the branch: `git push -u origin feat/RULE-005-rule-005-structured-argument-channels-mo`
- Open PR: `gh pr create --title "RULE-005: Structured argument channels — move-type field model" --body-file docs/reviews/RULE-005.md`
- Deploy steps (from design §13): **None.** RULE-005 v1 is client-only pure
  TypeScript + two presentational components. No migration
  (`npx supabase db push`), no Edge Function deploy, no env var, no manual step.
