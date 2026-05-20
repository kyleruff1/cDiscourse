# GAME-004 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-20
**Branch:** feat/GAME-004-game-004-1v1-pvp-room-contract-and-prima
**Design:** docs/designs/GAME-004.md

## Summary
GAME-004 ships the 1v1 PvP room contract: a pure-TS deterministic model
(`roomContractModel.ts`), a read-only RN seat strip (`RoomContractSeatStrip.tsx`),
and a read-only hook (`useRoomContract.ts`) wired into `DebateDetailHeader` via
`App.tsx`. The model is genuinely pure — no React/Supabase/network/AI imports,
JSON-serializable, frozen output, no input mutation. `resolvePrimaryOpponent`
and `isQualifyingResponse`/`explainQualifyingResponse` are deterministic and
cover every edge case the issue names (spam-first, flag-first, off-topic-first,
deletion-requested-first, OP's-own-reply, bot-move, invited-private override,
private-without-invite fallback, malformed self-invite, same-millisecond
tie-break). The OP-cannot-reject-a-qualifier rule is correctly encoded by
omission and asserted by a test. `roomType` is caller-supplied with a
doctrine-safe `'public'` default; no migration, no DB column, no new dependency.
Doctrine is clean: seat labels are role-only (`You`/`Initiator`/`Opponent`/`Open
seat …`), the contract carries no score/heat/band field, color is never the only
turn signal (the strip uses a shape glyph + a turn chip with text), and the strip
exposes an `accessibilityLabel`. Typecheck, lint, and the 66 GAME-004 tests pass.
The only failing suites in the broad run are the 5 pre-flagged xAI/bot-fixture
suites that need the gitignored `.env.engagement-intelligence` (absent in this
worktree) — GAME-004's diff does not touch them. No blockers.

## Verification
- typecheck: pass
- lint: pass (`--max-warnings 0`)
- test (GAME-004 suites): 66 passed / 3 suites — `roomContractModel.test.ts`,
  `roomContractSeatStrip.test.tsx`, `roomContractDoctrine.test.ts`
- test (broad run): 4939 passed / 19 failed, 171 passed / 5 failed suites.
  All 19 failures are the pre-flagged environment-only suites
  (`xaiSeededStancesLive`, `xaiAdversarialProvider`, `xaiAdversarialSourceHarvest`,
  `xaiAdversarialPipeline`, `aiDrivenBotCorpus`) failing on `env_file_missing` /
  missing `logs/engagement-intelligence` dir — NOT a GAME-004 defect. They pass
  in the main checkout; GAME-004's diff touches none of them.
- secret scan: clean (no API keys, tokens, JWTs, Bearer/Authorization literals)
- doctrine scan: clean (no verdict/person-label tokens, no SERVICE_ROLE, no
  ANTHROPIC_API_KEY, no direct insert into arguments, no console.* in new files)

## Design conformance
- [x] All design file-changes are present (model, seat strip, hook, barrel,
  DebateDetailHeader, App.tsx, 3 test files, current-status doc)
- [x] No undocumented file-changes (diff footprint matches; package.json and
  supabase/ diffs are empty)
- [x] Data model matches design (`RoomType` / `PrimarySeat` / `RoomContract` /
  `BuildRoomContractInput` / `QualifyingResponseResult` / `SeatViewModel` /
  `RoomContractViewModel` all as specified)
- [x] API contracts match design (`buildRoomContract`, `resolvePrimaryOpponent`,
  `isQualifyingResponse`, `explainQualifyingResponse`,
  `buildRoomContractViewModel`, `isPrimaryOpponentSeatStale`, constants)
- **Accepted deviation (coordinator-sanctioned, not a defect):** the design
  proposed `src/features/rooms/`; the implementer co-located the new files in the
  existing `src/features/debates/` directory. Confirmed: no stray `rooms/` dir,
  the `src/features/debates/index.ts` barrel cleanly re-exports all new symbols,
  and every import (`listArgumentsForDebate`, `ArgumentRow`, model types,
  `useRoomContract`) resolves — typecheck passes.

## Doctrine self-check (must all be ✓)
- [x] No truth/winner/loser language in user-facing strings — `ROOM_CONTRACT_COPY`
  and every `buildRoomContractViewModel` label across all viewer permutations
  are ban-list-asserted in `roomContractDoctrine.test.ts`
- [x] Score never blocks posting — the model has no write path at all; it is a
  read-time derivation
- [x] No service-role in client code — model is pure-TS; the hook uses the
  standard RLS-bound anon client, reads only (`select` on `debate_participants`
  and `arguments` via `listArgumentsForDebate`)
- [x] No direct insert into public.arguments — none; read-only throughout
- [x] No AI calls in production app paths — none; model imports nothing
- [x] Plain language only — `DisqualifyReason` snake_case values are internal
  enum members used only in tests; the doctrine test asserts no snake_case
  reaches any rendered string
- [x] Epic-specific doctrine:
  - **cdiscourse-doctrine §2 (heat = activity, not a seat property):**
    `roomContractModel.ts` imports nothing from `argumentScoreModel` /
    `claimStanding` / `pointStanding` / `heatModel` / `antiAmplification` —
    enforced by a forbidden-import source-scan test. `RoomContract` and
    `SeatViewModel` carry no numeric/score/band field.
  - **point-standing-economy (seats stay separate from standing):** a seat is
    "who holds this game role", orthogonal to point standing — verified by the
    same forbidden-import test and the absence of any numeric field.
  - **accessibility-targets:** strip root carries `accessibilityLabel`; room-type
    chip uses a shape/text glyph (lock vs open circle) so meaning survives
    without color; turn state is a text chip, not a color cue; every visible
    string is inside `<Text>`; the strip is informational (no `Pressable`, scan-
    asserted) so the 44px tap-target rule does not apply.
  - **expo-rn-patterns:** no new dependency (package.json diff empty); strip is
    `<View>`/`<Text>` flexbox only; model follows the `*Model.ts` pure-TS
    convention.

## Test coverage
- [x] New public functions have unit tests — `resolvePrimaryOpponent` (13-row
  edge table), `isQualifyingResponse`/`explainQualifyingResponse` (full
  `DisqualifyReason` table + 39/40-char boundary + happy path), `buildRoomContract`,
  `buildRoomContractViewModel` (all viewer permutations + turn states),
  `isPrimaryOpponentSeatStale` (before/after window, re-armed, open seat)
- [x] User-facing strings have ban-list assertion — `roomContractDoctrine.test.ts`
  collects all copy + every projected label and asserts zero verdict tokens and
  zero snake_case
- [x] Edge cases from design § "Edge cases" have tests — spam-first, flag-first,
  deletion-requested-first, off-topic-one-liner, OP's-own-reply, bot-move,
  invited-private override, private-without-invite, self-invite ignored,
  empty room, root-only room, same-millisecond tie-break, determinism,
  no-mutation, and the anti-griefing API-surface omission assertion
- [x] Accessibility assertions present — the view-model `accessibilityLabel` is
  asserted non-empty; the strip source-scan asserts `accessibilityLabel` on the
  root, `<Text>`-wrapped strings, RN primitives only, and no router import
- **Adjudication on test method (per the run's standard):** the implementer used
  the repo's established discipline — pure-model assertions plus source-scans of
  the component — rather than runtime `react-test-renderer` rendering, because
  this repo has no working RTL render infrastructure (the test file documents
  the pinned-renderer/peer mismatch). For GAME-004 this is adequate: the
  component is a thin, stateless projection whose every render decision is fully
  determined by the pure `RoomContractViewModel`, which IS exercised directly
  across all permutations. The source-scan covers the remaining structural
  guarantees (Text wrapping, a11y label, no Pressable, no router). Consistent
  with prior cards in this run. Accepted.

## Blockers
None.

## Suggestions (non-blocking)
1. `useRoomContract.toRoomArgumentInput` does not map an `isBot` field — and
   `ArgumentRow` has no such field — so the `bot_move` disqualification branch
   is effectively dead in the live in-app path (it still works for the model's
   own tests and any future caller that supplies `isBot`). This is correct for
   v1 (bot moves are a fixture-only concept; GAME-008 owns bot rooms) and not a
   defect, but a one-line comment in `toRoomArgumentInput` noting "isBot
   intentionally unmapped — no persisted source in v1" would prevent a future
   reader thinking it was an oversight.
2. The design's degraded-fallback path (derive a contract from `currentDebate`
   alone when the participants query is blocked) is partially realized — a
   `debate_participants` RLS failure degrades to an empty participants list and
   the public resolver still works. That is the intended safe behavior; no
   action needed, just confirming it matches the design's Risks section.
3. `isPrimaryOpponentSeatStale` is exported and tested but has no in-app caller
   yet (re-open UI is a follow-up card, as the design states). Fine for v1;
   noting it so a future card knows the detector is already shipped.

## Operator next steps
- Push the branch: `git push -u origin feat/GAME-004-game-004-1v1-pvp-room-contract-and-prima`
- Open PR: `gh pr create --title "GAME-004: 1v1 PvP room contract and Primary Opponent model" --body-file docs/reviews/GAME-004.md`
- Deploy steps: none. Pure code change — no migration (`npx supabase db push`
  not needed), no Edge Function deploy, no new env var, no dependency to install.
