# RULE-004 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-20
**Branch:** feat/RULE-004-rule-004-pause-before-send-move-review-a
**Design:** docs/designs/RULE-004.md

## Summary

RULE-004 ships the pause-before-send move review: a pure-TS deterministic model
(`preSendReviewModel.ts`) that derives a short list of advisories (info/soft,
never blocking) from already-computed structural fields, plus a thin React sheet
(`PreSendReviewSheet.tsx`) that the COMPOSER-002 dock shows on the Post intent.
The implementation is a faithful, disciplined build of the design. The
load-bearing doctrine — **RULE-004 adds zero new blocking rules** — is honoured
exactly: `AdvisorySeverity` is the exact union `'info' | 'soft'`, `structuralBlocks[]`
is a read-only projection of `evaluateArgumentDraft`'s pre-existing `blockingErrors`
(RULE-004 produces no block), and "Post anyway" is always available unless an
existing engine block is hit. The model imports types + frozen copy only — no AI,
no network, no React, no Supabase. RULE-005's channel-mismatch advisory is
absorbed as the `channel_mismatch` advisory kind without touching `channelModel.ts`
or `ChannelChipRow.tsx`. Footprint matches the design's 13-file expectation
exactly: no `supabase/` files, no migration, no Edge Function, no `.env` change,
no new dependency. typecheck + lint clean; all 84 RULE-004 tests pass. The 19
failing suites are pre-existing environmental bot-fixture failures unrelated to
this card. No blockers; one cosmetic non-blocking note.

## Verification

- typecheck: **pass** (`tsc --noEmit`, exit 0)
- lint: **pass** (`eslint . --max-warnings 0`, exit 0)
- test: **5300 passed / 5319 total (187 suites passed / 192 total)** on the branch.
  - **19 failures — all environmental, NOT RULE-004 regressions.** The 5 failing
    suites are `xaiAdversarialProvider`, `xaiSeededStancesLive`,
    `xaiAdversarialSourceHarvest`, `xaiAdversarialPipeline`, `aiDrivenBotCorpus`
    — all `scripts/bot-fixtures/` runners that require the gitignored
    `.env.engagement-intelligence` file, absent from the isolated worktree
    (errors: `env_file_missing`, `ENOENT mkdtemp logs/engagement-intelligence`).
    This matches the documented main baseline behaviour.
  - **RULE-004 genuine result: 5 suites / 104 tests pass, 0 fail** — `preSendReviewModel`
    (42), `preSendReviewSheetUi` (26), `preSendReviewBanList` (7),
    `preSendReviewNoBlockOnKeywords` (9), plus the modified `composerDockPresetWiring`
    (20). ~84 of these are new RULE-004 tests.
- secret scan: **clean** (no API key / Bearer / JWT / service-role literal in the diff)
- doctrine scan: **clean** — the only `winner/loser/liar/...` hits in the diff are
  inside `_forbiddenPreSendTokens()`, the ban-list array the test scans *against*
  (correct usage, not user-facing copy). No `console.log`, no `SERVICE_ROLE`, no
  `ANTHROPIC_API_KEY` in `src/`.

## Design conformance

- [x] All design file-changes are present — 13 files, exactly the §6 footprint
  (2 new production, 3 modified production, 4 new tests, 1 modified test, 1 new
  design, 2 modified docs).
- [x] No undocumented file-changes — `git diff --stat` shows exactly the 13 expected
  files. The two untracked `docs/testing-runs/*` files are pre-existing repo
  state, not part of this branch's commits.
- [x] Data model matches design — `AdvisoryKind` (7 kinds incl. `channel_mismatch`),
  `AdvisorySeverity = 'info' | 'soft'`, `StructuralBlockKind` (5 incl. reserved
  `cooldown_active`), `PreSendReview`, `PreSendReviewInput` all match §3 verbatim.
- [x] API contracts match design — `buildPreSendReview`, `advisoryDefinition`,
  `ADVISORY_DEFINITIONS`, `projectBlockKind`, `transformationToQuickAction`,
  `channelMismatchPlainLanguage` all present with the §5 signatures. Derivation
  order (§5.1 rules 1–8) matches the implementation exactly.

## Doctrine self-check (all ✓)

- [x] No truth/winner/loser language in user-facing strings — `PRESEND_ADVISORY_COPY`
  / `PRESEND_BLOCK_COPY` / `PRESEND_SHEET_COPY` scanned by `preSendReviewBanList.test.ts`
  against verdict + amplification + block + punitive + fear token lists; zero hits.
- [x] Score never blocks posting — RULE-004 adds **zero** blocking rules.
  `AdvisorySeverity` is exactly `'info' | 'soft'`; `structuralBlocks[]` is a
  read-only projection of `evaluateArgumentDraft.blockingErrors` (the pre-existing
  engine block). "Post anyway" hidden only on a real engine block.
- [x] No service-role in client code — none. RULE-004 is pure client TS.
- [x] No direct insert into public.arguments — the `submit-argument` path is
  unchanged; RULE-004 only adds a gate *before* the composer's existing submit.
- [x] No AI calls in production app paths — `preSendReviewModel.ts` imports types
  + frozen copy tables only; no Anthropic / xAI / network / Edge Function.
  `ArgumentComposerDock` source-scan test asserts no AI/network/service-role ref.
- [x] Plain language only — all copy read from frozen `gameCopy` blocks;
  `looksLikeInternalCode` is false for every produced string (test-enforced).
- [x] Stage 6.2 / no-keyword-block doctrine — `preSendReviewNoBlockOnKeywords.test.ts`
  proves a charged-keyword but structurally-valid body yields zero structuralBlocks,
  and that a charged body vs a benign body of equal length/shape produce identical
  advisories (only length / `?`-shape / typed fields can change output).
- [x] Epic-specific doctrine: **cdiscourse-doctrine §2/§3 (heat/popularity not signals)** —
  `preSendReviewNoBlockOnKeywords.test.ts` feeds two structurally-identical drafts
  with different mock `railPayload` heat/replyCount and asserts identical reviews;
  the model has no heat/engagement input at all. **point-standing-economy** — the
  `narrow` transformation routes to the existing `narrow` preset; RULE-004 adds no
  standing logic and no concession-as-loss framing.
- [x] RULE-005 reconciliation — `channelModel.ts` and `ChannelChipRow.tsx` are
  **untouched** (`git diff --stat` empty). `channel_mismatch` reuses RULE-005's
  `ChannelSuggestion` object (passed in by the dock) and `channelMismatchPlainLanguage()`
  prefers `suggestion.rationale` verbatim — one model, one copy line, no duplication.

## Test coverage

- [x] New public functions have unit tests — `buildPreSendReview` (8 derivation
  rules + edge cases + determinism), `advisoryDefinition` (incl. throw on unknown),
  `projectBlockKind` (known + unknown→generic), `transformationToQuickAction`,
  `channelMismatchPlainLanguage` (rationale-preferred + null-fallback) all covered.
- [x] User-facing strings have ban-list assertion — `preSendReviewBanList.test.ts`
  scans every produced advisory/block string + all 3 frozen copy blocks; explicitly
  asserts non-punitive (no dodge/evade/avoid) and `permanent_record_warning` is
  honest, not fear-based (no judged/punished/damage).
- [x] Edge cases from design §7 have tests — clean reply (shouldShowSheet false),
  root draft (no throw, depth skipped), null evaluation, evidence-no-source dual
  surface (advisory + block coexist), null channelSuggestion, "Post anyway" hidden
  on structural block, advisory-never-blocks, strict-mode dead-but-tested branch.
- [x] Accessibility assertions present — `preSendReviewSheetUi.test.tsx` asserts
  every Pressable declares `accessibilityRole="button"`, threads `PRESEND_HIT_SLOP`
  (≥44×44 effective target), verbose advisory `accessibilityLabel` with spoken
  severity word (color-independent), `accessibilityViewIsModal`, distinct
  block/advisory section headings + glyphs (grayscale-legible), no `console.log`.

## Blockers

None.

## Suggestions (non-blocking)

1. `PreSendReviewSheet` accepts `reduceMotionOverride` (props + threaded by the
   dock) but the sheet renders as a static `View` overlay with **no animation at
   all** — so it is inherently reduce-motion-safe and the prop is currently
   unused. This is a sound, well-tested design choice (the UI suite asserts "does
   not import Animated — the sheet snaps"), not a defect. Consider either dropping
   the unused prop or adding a brief comment that it is reserved for a future
   animated entry; harmless to leave as is.
2. `projectBlockKind` maps `OFF_TOPIC` / `WEAK_TOPIC` nowhere (they are read from
   `warnings` for `topic_drift`, correctly). If a future Constitution change ever
   makes a topic flag *blocking* again, it would project to the generic
   `invalid_transition` bucket. This is the documented safe-generic behaviour and
   consistent with Stage 6.2 (topic flags are advisory-only); no action needed,
   noted for awareness.

## Operator next steps

- Push the branch: `git push -u origin feat/RULE-004-rule-004-pause-before-send-move-review-a`
- Open PR: `gh pr create --title "RULE-004: Pause-before-send move review (advisory friction with payoff)" --body-file docs/reviews/RULE-004.md`
- Deploy steps: **None** — RULE-004 is client-only pure TypeScript + one
  presentational component + a dock wiring. No migration (`supabase db push`),
  no Edge Function deploy, no env var, no manual step (design §13).
