# GAME-005 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-20
**Branch:** feat/GAME-005-game-005-public-room-participant-seats-a
**Design:** docs/designs/GAME-005.md
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/142

## Summary

GAME-005 ships a deterministic pure-TS public-room seat model (`publicSeatModel.ts`)
that extends GAME-004's 1v1 `RoomContract` to a 6-seat public room — seat 1 Initiator,
seat 2 Primary Opponent, seats 3–6 chime-ins in first-qualifying-move claim order — plus
a chime-in governance evaluator, an actor-matrix predicate, two read-time view-model
builders, two presentational RN components, and a thin in-session governance hook. The
build matches the design doc precisely. It is doctrine-clean: governance reactions are
participation-structure signals (no verdict vocabulary), observer-fallback is framed as a
structural transition, and heat/popularity is never an input. No migration, no Edge
Function, no schema write, no AI/network call, no new dependency. The file footprint is
exactly the 14 files the design declared. The governance evaluator's both-parties +
bounded-window + reversibility anti-abuse core is implemented correctly and tested
directly. The implementer's optional `chimeInBranchIdByUserId` input is an honest
card-vs-reality resolution (GAME-004's narrowed `RoomArgumentInput` carries no
`branchId`) that avoids modifying GAME-004 — confirmed correct, not a defect. The
implementer's reword of `overflow_observer_body` ("right now" → "at the moment") to clear
the ban-list token "right" is a correct catch and the copy remains doctrine-clean. No
concerns remain.

## Verification

- typecheck: **pass** (`tsc --noEmit`, exit 0)
- lint: **pass** (eslint on all 11 GAME-005 files, exit 0)
- test: 5535 → 5629 genuine tests passing / 195 → 200 suites passing.
  GAME-005 adds **94 new tests across 5 new suites**, all passing.
  - 19 failures in 5 suites (`xaiAdversarialProvider`, `xaiSeededStancesLive`,
    `xaiAdversarialSourceHarvest`, `xaiAdversarialPipeline`, `aiDrivenBotCorpus`) are
    **pre-existing environmental failures** — the gitignored `.env.engagement-intelligence`
    and `logs/engagement-intelligence/` directory are absent from the isolated worktree.
    They are not GAME-005 code, are not imported by GAME-005, and are not a regression.
  - **Real GAME-005 result: 94/94 passing.** No genuine failures anywhere in the tree.
- secret scan: **clean** (no hits for any key pattern / Bearer / JWT)
- doctrine scan: **clean** (verdict-token hits are confined to the `_forbiddenChimeInGovernanceTokens()`
  ban-list array and doc comments; `console.log` hits are test assertions verifying its
  absence; the `.side` regex hit is doc prose in `current-status.md` — no schema write)

## Design conformance

- [x] All design file-changes are present — exactly the 14 declared files:
  4 new production (`publicSeatModel.ts`, `ChimeInGovernanceControl.tsx`,
  `PublicRoomMetricsStrip.tsx`, `useChimeInGovernance.ts`), 2 modified production
  (`gameCopy.ts` `CHIME_IN_GOVERNANCE_COPY` block, `index.ts` barrel re-exports),
  5 new test files, 1 new design doc, 2 modified docs.
- [x] No undocumented file-changes — `git diff main..HEAD --stat` shows 14 files, all
  in footprint. No `supabase/`, no `.env*`, no `package.json`/`package-lock.json`.
- [x] Data model matches design — `SeatRole`, `PublicSeat`, `PublicRoomSeatMap`,
  `MovedToObserverRecord`, `GovernanceReaction`, `GovernanceReactionKind`,
  `GovernanceActorResult`, the two view-models, `PUBLIC_ROOM_SEAT_CAP = 6`,
  `PRIMARY_SEAT_COUNT = 2`, `CHIME_IN_GOVERNANCE_WINDOW_MS = 24h` all match §1–§2.5
  field-for-field. `chime_in` is a derived role, never persisted (D3/D4 honored).
- [x] API contracts match design — `buildPublicRoomSeatMap`, `evaluateChimeInStanding`,
  `canApplyGovernanceReaction`, `buildPublicRoomMetricsViewModel`,
  `buildGovernanceControlViewModel` match the §2 signatures and documented behavior.
  The one honest deviation — `BuildPublicRoomSeatMapInput.chimeInBranchIdByUserId` (an
  optional caller-supplied join) — is added *because* GAME-004's narrowed
  `RoomArgumentInput` has no `branchId`. This is a correct card-vs-reality resolution: it
  lets GAME-005 carry `branchId` on its records without modifying GAME-004. Verified:
  `roomContractModel.ts` last commit is GAME-004's (e94c9dd) — genuinely unmodified.

## Doctrine self-check (all ✓)

- [x] No truth/winner/loser language in user-facing strings — `chimeInGovernanceDoctrine.test.ts`
  collects every frozen-copy string and every label/notice from both view-model builders
  across all permutations and asserts none contains any verdict / amplification / punitive /
  person-attribution / like-vote token (whole-word match for short tokens). Passes.
- [x] Score never blocks posting — governance has no post path, no validation gate. A
  moved-to-observer user keeps every byte of their content; their branch stays on record.
  `evaluateChimeInStanding` returns a *structural standing* (`active`/`observer_only`),
  never a correctness verdict.
- [x] No service-role in client code — `publicSeatModel.ts` is pure TS; the hook holds
  in-session `useState` only with no I/O. Doctrine test scans all 4 source files for
  `SERVICE_ROLE`/`service_role`/`functions.invoke` → zero matches.
- [x] No direct insert into public.arguments — none anywhere; doctrine test asserts the
  model + hook contain no `.from('debate_participants')` / `.insert(` / `.update(`.
- [x] No AI calls in production app paths — model is deterministic pure TS; doctrine test
  asserts no `anthropic`/`Anthropic`/`api.x.ai`/`fetch(`/`XMLHttpRequest`.
- [x] Plain language only — `looksLikeInternalCode` returns false for every visible
  string; the enum value `off_track` never reaches a user string (label is "Off the
  current thread"); a no-snake_case regex assertion passes.
- [x] Epic-specific doctrine (point-standing-economy): seats and governance are
  orthogonal to standing. `PublicSeat`/`GovernanceReaction` carry no numeric/band/debt
  field. `publicSeatModel.ts` imports nothing from `argumentScoreModel`/`pointStanding`/
  `claimStanding`/`heatModel`/`antiAmplification` — enforced by the forbidden-import test.
  Seat order is `createdAt` of the first qualifying move only — a high-reply chime-in
  gets no seat priority. Governance pauses when a primary seat is open; both-parties +
  bounded-window + per-actor reversibility are the anti-abuse core, all tested.

## Test coverage

- [x] New public functions have unit tests — `publicSeatModel.test.ts` (917 lines)
  covers `buildPublicRoomSeatMap`, `evaluateChimeInStanding`, `canApplyGovernanceReaction`,
  both view-model builders, `governanceReactionLabel`, determinism, and frozen-input
  no-mutation.
- [x] User-facing strings have ban-list assertion — `chimeInGovernanceDoctrine.test.ts`
  with whole-word matching for short tokens.
- [x] Edge cases from design §9 have tests — empty room, root-only, exactly-6,
  9-chime-in overflow swarm, non-qualifying first move, single-primary `off_track`,
  both-primaries-outside-window, both-primaries-within-window, retraction reversibility,
  same-primary-twice, chime-in/observer cannot govern, self-target, mainline/other-primary
  target, open Primary Opponent seat (governance pauses), and the doctrine seat-order edge
  (earlier low-activity chime-in holds a lower seat index than a later high-activity one).
- [x] Accessibility assertions present — `chimeInGovernanceControl.test.tsx` asserts
  `accessibilityRole="button"`, `accessibilityState` (`selected` = applied), `hitSlop`
  for the ≥44px target, and applied state being a shape/text marker (`✓ Applied`) not
  color alone. `publicRoomMetricsStrip.test.tsx` asserts the strip root carries an
  `accessibilityLabel` and every visible string sits inside `<Text>`.

## Blockers

None.

## Suggestions (non-blocking)

1. The room-shell wiring step (mounting `PublicRoomMetricsStrip` + `ChimeInGovernanceControl`
   into the existing room shell) is explicitly deferred per design §8 / §12 — the components
   are exported and ready. A follow-up wiring card or commit should mount them so the
   feature is user-reachable; until then GAME-005 is a built-and-tested model + components
   not yet rendered. This is the design's stated plan, not a defect — noted only so the
   operator tracks it.
2. `ChimeInGovernanceControl` uses a fixed heading "Keep this chime-in on track" that is
   not routed through `CHIME_IN_GOVERNANCE_COPY`. It is doctrine-clean and structural, but
   for OD-2 copy-review consistency the operator may want it in the frozen copy block.
   Non-blocking.

## Operator next steps

- Push the branch: `git push -u origin feat/GAME-005-game-005-public-room-participant-seats-a`
- Open PR: `gh pr create --title "GAME-005: Public room participant seats and chime-in governance" --body-file docs/reviews/GAME-005.md`
- Deploy steps: **none** — pure code change. No `db push`, no `functions deploy`, no env
  var, no new dependency (design §15).
- Operator decisions (isolated, do not gate merge): OD-1 confirm
  `CHIME_IN_GOVERNANCE_WINDOW_MS = 24h` and `PUBLIC_ROOM_SEAT_CAP = 6`; OD-2 copy-review
  the four reaction labels + observer-fallback copy; OD-3 (re-entry/appeal UI) is
  deliberately deferred to a future card.
- Plan the follow-up room-shell wiring step and the future
  `public.chime_in_governance_reactions` persistence migration card (design §1.6 / §4).
