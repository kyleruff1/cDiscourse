# GAME-008 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-20
**Branch:** feat/GAME-008-game-008-bot-public-room-policy-and-publ
**Design:** docs/designs/GAME-008.md
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/147

## Summary

GAME-008 ships the product-level **policy + read-time UI marking** for bots in public
argument rooms — and nothing more. The deliverable is a pure-TS model
(`botRoomPolicyModel.ts`: the frozen `BOT_ROOM_POLICY` constant, the `isBotSeededRoom`
fail-safe-human predicate, the `assertBotRoomEligibility` 4-reason policy GATE, the
`buildBotMarkingViewModel` view contract, and `looksLikeBotSeedTag`), a neutral
`BOT_MARKER_COPY` block, two non-interactive read-time marker components, and additive
optional-prop wiring into the gallery card. The implementation matches the design
contract verbatim. The load-bearing constraints all hold: the module enables **zero**
live bot posting / corpus / xAI / Anthropic — it imports types only, makes no network
or DB call, and an API-surface test proves no posting/scheduling/harvest function is
exported. No schema change of any kind (no `profiles.is_bot` column, no migration, no
Edge Function). Doctrine is clean: the marker describes an account type, never a
verdict; copy is neutral and non-deceptive. The one design-vs-implementation deviation
(`participant_a11y` reworded from "...never decide who is right" to "...never judge a
debate") is a **correct catch** — the design's own §10 ban-list forbids the token
"right", so shipping §1.5's literal copy would have failed the ban-list test. The
reworded copy preserves the doctrine intent and is ban-list clean. No concerns remain.

## Verification
- typecheck: **pass** (`tsc --noEmit`, clean)
- lint: **pass** (`eslint . --max-warnings 0`, clean)
- test: 5811 → **5813 total**; **5794 pass** / 19 fail — all 19 failures are
  **pre-existing environmental** failures in 5 bot-fixture suites
  (`xaiSeededStancesLive`, `xaiAdversarialProvider`, `xaiAdversarialPipeline`,
  `xaiAdversarialSourceHarvest`, `aiDrivenBotCorpus`) caused by the gitignored
  `.env.engagement-intelligence` being absent from the isolated worktree
  (`env_file_missing`). **Zero genuine failures.** The 4 GAME-008 suites run in
  isolation: **83 tests / 4 suites, all pass.** 209 → **209 non-environmental suites
  pass** (4 new GAME-008 suites included).
- secret scan: **clean** — two `grep` hits are test-assertion source lines
  (`expect(src).not.toContain('XAI_API_KEY')`), not secrets.
- doctrine scan: **clean** — verdict-word `grep` hits are all inside the
  `_forbiddenBotMarkerTokens()` ban-list array (tokens being *forbidden*, not used).
  No `SERVICE_ROLE`/`ANTHROPIC` in `src/`. No insert into `public.arguments`.
  No `console.log` added.

## Design conformance
- [x] All design file-changes are present — exactly the 13 expected files, no more.
- [x] No undocumented file-changes — `git diff --name-only` matches §5 footprint.
- [x] Data model matches design — `BotRoomPolicy` (5 fields, frozen), `BotParticipantHint`,
      `BotRoomInputs`, `BotParticipantMarking`, `BotMarkingViewModel`, `BotRoomAction`,
      `BotPolicyDenyReason`, `BotRoomEligibilityResult`, `AssertBotRoomEligibilityInput`
      all match §1/§2 verbatim. (`ALL_BOT_POLICY_DENY_REASONS` is a small additive
      frozen list — a reasonable test-support addition, in spirit with the design.)
- [x] API contracts match design — `isBotSeededRoom`, `looksLikeBotSeedTag`,
      `buildBotMarkingViewModel`, `assertBotRoomEligibility`, `_forbiddenBotMarkerTokens`
      match §2.1–2.4 signatures and the documented step lists.
- [x] No upstream source modified — `roomContractModel.ts` / `publicSeatModel.ts` /
      `branchGrammarModel.ts` (GAME-004/005/BR-004) are untouched; GAME-008 imports
      GAME-004 types only (`import type`).
- [x] No `supabase/` file, no `.env*`, no `package.json`/`package-lock.json` change,
      no new dependency.

## Doctrine self-check (all ✓)
- [x] No truth/winner/loser language in user-facing strings — `BOT_MARKER_COPY` and
      every `buildBotMarkingViewModel` output scanned by `botRoomPolicyDoctrine.test.ts`
      against a 33-token ban-list (verdict + amplification + alarming + punitive),
      word-boundary matched for short tokens. The `participant_a11y` rewording ("never
      judge a debate") is the doctrine-correct fix for §1.5's own ban-list collision.
- [x] Score never blocks posting — GAME-008 has no post path; `assertBotRoomEligibility`
      vets *bot* actions only, with no branch touching a real user's submission
      (design §6.22). `BotRoomPolicy` carries no score/band/heat/verdict field — tested.
- [x] No service-role in client code — doctrine test scans all 3 source files for
      `SERVICE_ROLE`/`service_role` → zero matches; confirmed by diff scan.
- [x] No direct insert into `public.arguments` — model imports nothing from Supabase;
      makes no query. Forbidden-import test enforces it.
- [x] No AI calls in production app paths — doctrine test scans for `anthropic`,
      `api.x.ai`, `XAI_API_KEY`, `functions.invoke` → zero matches. Module is pure TS.
- [x] Plain language only — `looksLikeInternalCode` is `false` for every `BOT_MARKER_COPY`
      string; an enum-leak test forbids `join_as_primary`/`bot_chime_in_not_permitted`/
      `public_only` etc. from any user-facing string.
- [x] Epic-specific doctrine (cdiscourse-doctrine §4/§7): **bots never decide who is
      right** — GAME-008 ships no verdict path; `assertBotRoomEligibility` is a pure
      predicate GATE, never a trigger. **No live bot posting** — the API-surface test
      proves the module exports no `enableBotPosting`/`scheduleBotRun`/`postBotMove`/
      `harvestCorpus`/`runBotCorpus`/`triggerBotPosting`, and a second test asserts no
      export name matches `/post|schedule|harvest|run|trigger|enable|deploy|fetch|send/i`.
      No deceptive framing — doctrine test forbids `real user`/`real person`/`human`
      describing the bot, and allowlists exactly one whole-word use of "person" (the
      negation "not a person"). **No schema change** — confirmed: no `profiles.is_bot`,
      no migration, no Edge Function; `isBotSeededRoom` is a pure predicate over
      already-derived `isBot` hints, absent hint → fail-safe-human (tested).
- [x] Policy rules match design §2.4 — `assertBotRoomEligibility` enforces all 4 deny
      reasons in the documented order: `bots_create_public_only` (non-public create),
      `bot_in_private_room_with_real_user` (any seat in private 1v1 w/ real party),
      `bot_primary_against_real_user` (seat 2 vs real-user party),
      `bot_chime_in_not_permitted` (chime-in always denied); observer always allowed;
      bot-vs-bot primary allowed. Consistent with GAME-005 already excluding bots from
      chime-in seats 3–6; `botsYieldSeatsToRealUsers: true` records the recommended OD-1
      default.

## Test coverage
- [x] New public functions have unit tests — `botRoomPolicyModel.test.ts` covers
      `BOT_ROOM_POLICY` (shape/frozen/no-score-field), `isBotSeededRoom` (bot root /
      human root / empty / unposted root / **absent-hint fail-safe-human** / multi-root),
      `looksLikeBotSeedTag` (xai-adv/ai-corpus/stress recognition, human title rejected,
      null/empty, **parity with gallery `SUFFIX_TAG_PATTERNS`**), `buildBotMarkingViewModel`
      (pure-bot/mixed/human, per-bot individual marking, persona variant, banned-persona
      fallback, empty-persona fallback, hint-only users, frozen output), the full
      `assertBotRoomEligibility` matrix (all 4 deny reasons + ok paths + rule order),
      determinism + no-mutation of frozen inputs, and the **API-surface omission proof**.
- [x] User-facing strings have ban-list assertion — `botRoomPolicyDoctrine.test.ts`
      collects all `BOT_MARKER_COPY` + view-model strings across pure-bot/mixed/human/
      persona permutations and scans the 33-token ban-list + no-deceptive-framing +
      plain-language + enum-leak checks.
- [x] Edge cases from design §6 have tests — §6.4 fail-safe-human, §6.5 individual
      mixed-room marking, §6.6–6.11 eligibility matrix, §6.14 persona variant, §6.15
      banned-persona fallback, §6.17 determinism/no-mutation are all covered.
- [x] Accessibility assertions present — `botParticipantMarker.test.tsx` /
      `botRoomMarker.test.tsx` assert: renders null for non-bot; verbose
      `accessibilityLabel` on the marker root; every visible string inside `<Text>`;
      shape-glyph present so the marker is grayscale-legible (color-independence); no
      `Pressable`/`Touchable` (non-interactive — 44px rule documented N/A); View/Text
      RN primitives only (no new dependency); no router/navigation import (no route
      transition). Per accessibility-targets: markers are non-interactive read-time
      markers, so the 44×44 hit-target rule does not apply — correctly documented in
      both the design §7 and the component headers.

## Blockers
None.

## Suggestions (non-blocking)
1. `BotParticipantMarker.tsx` / `BotRoomMarker.tsx` — neither marker root sets
   `accessibilityRole`. The design §7 and accessibility-targets both state an
   informational element with a descriptive `accessibilityLabel` and no role is
   acceptable (matches the `RoomContractSeatStrip` precedent), so this is conformant.
   A future polish pass could add `accessibilityRole="text"` for extra screen-reader
   clarity on web. Defer — not required by the card.
2. The gallery wiring (`ConversationGalleryScreen.tsx`) builds a synthetic single-arg
   `BotMarkingViewModel` purely to drive the room-level marker — the documented §5
   no-query degraded fallback. It works and is type-correct, but a future card that
   adds real per-author bot hints to the gallery loader could call
   `buildBotMarkingViewModel` with real inputs and also surface per-participant
   markers. Already named as a follow-up in the design §5 implementer note. Defer.
3. The per-participant in-room `BotParticipantMarker` mount is intentionally deferred
   to the loader-hint wiring (design §5 + §965 implementer note) — the component and
   model ship complete and tested; only the in-room mount is the follow-up step. This
   is in-scope-as-documented, not a gap.

## Operator next steps
- Push the branch: `git push -u origin feat/GAME-008-game-008-bot-public-room-policy-and-publ`
- Open PR: `gh pr create --title "GAME-008: Bot public-room policy and public argument seeding" --body-file docs/reviews/GAME-008.md`
- Deploy steps (from design §15): **none** — pure code change. No migration
  (`npx supabase db push` not needed), no Edge Function deploy, no new env var, no new
  dependency. No live bot posting is enabled by this card.
- OD-1 (isolated, does not gate merge): a copy/design review may confirm the final
  `BOT_MARKER_COPY` wording ("Test bot" / "Test room" / "Bot-seeded test room") and
  marker placement, and the user-facing "bots yield seats" framing. Single-spot edits;
  not a merge blocker.
