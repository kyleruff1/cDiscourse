# GAME-006 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-20
**Branch:** feat/GAME-006-game-006-jump-branch-once-per-room-cross
**Design:** docs/designs/GAME-006.md
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/144

## Summary

GAME-006 ships the Jump Branch rule — a deliberate, confirm-required, once-per-room
cross-branch participation action for public-room chime-ins. The implementation is a
clean, doctrine-faithful execution of the design: a pure-TS deterministic model
(`jumpBranchModel.ts`) plus two thin read-time RN components, with no migration, no
Edge Function, no schema write, no new dependency, and no operator step. The
load-bearing DERIVE-NOT-PERSIST guarantee is honored exactly — `JumpBranchRecord`
and the `jumpsUsed` counter are recomputed from existing `arguments` rows on every
read; there is no `jump_branch_records` table and no new write path (a jump commits
through the unchanged `submit-argument` path). `canJump` is a deterministic 7-reason
predicate with fixed reason precedence and no clock parameter. The model consumes
GAME-004 / GAME-005 / BR-004 types without modifying any of their source files.
Typecheck and lint are clean; all 82 new GAME-006 tests pass; the full suite is
5711 passing with only the 19 known pre-existing environmental xAI/bot-fixture
failures. Footprint is exactly the 13 expected files. No blockers. Two minor,
non-blocking observations are listed under Suggestions.

## Verification
- typecheck: pass (`tsc --noEmit`, zero errors)
- lint: pass (`eslint . --ext .ts,.tsx --max-warnings 0`, zero warnings)
- test: 5648 → 5730 tests / 205 → 210 suites (5711 passing in this bare worktree;
  +82 GAME-006 tests / +5 suites). GAME-006-only run: 82/82 pass across 5 suites.
- secret scan: clean (no API keys, no Bearer/Authorization, no JWT, no service-role)
- doctrine scan: clean (all verdict-token grep hits are inside the
  `_forbiddenJumpBranchTokens()` ban-list definition and doctrine comments — i.e.
  the tokens being banned, never user-facing copy)

### Environmental vs genuine failures
19 failures across 5 suites — `xaiSeededStancesLive`, `xaiAdversarialProvider`,
`xaiAdversarialSourceHarvest`, `xaiAdversarialPipeline`, `aiDrivenBotCorpus`. Every
one is a pre-existing environmental failure: the gitignored
`.env.engagement-intelligence` and the `logs/engagement-intelligence/` directory are
absent from this isolated worktree. None touches any GAME-006 file or any file
GAME-006 imports. **Zero genuine failures. Zero GAME-006 regression.**

## Design conformance
- [x] All design file-changes are present (13 of 13 — see note below on the 14th)
- [x] No undocumented file-changes
- [x] Data model matches design (`JumpBranchRecord`, `JumpEligibility`,
  `BranchEngagementState`, `JumpControlViewModel`, `JumpMarkerViewModel`,
  `MAX_JUMPS_PER_ROOM = 1`, all 7 `JumpDenyReason` values — verbatim to §1)
- [x] API contracts match design (`deriveParticipantHomeBranch`,
  `listJumpsForParticipant`, `jumpsUsed`, `canJump` — no `nowMs`,
  `buildBranchEngagementMap`, `buildJumpControlViewModel`, `buildJumpMarkers` — all
  match §2 signatures and the fixed `canJump` reason precedence)

Notes on conformance:
- The design's §6 lists a 14th line item — a "minimal additive room-shell wiring"
  step to mount the control + markers. The implementer shipped no room-shell
  modification. This is **design-permitted**: §6 marks every new prop optional with
  a no-render default and §10 (Risks) explicitly names "render the markers and gate
  the control behind a later wiring step" as an acceptable degraded path.
  `current-status.md` honestly records the wiring as "a small additive follow-up."
  Not a defect — the card's deliverable is the model + components + copy + tests,
  all present.
- The model adds three symbols beyond the design's literal §1/§2 list:
  `disabled_hint` (a small a11y hint string in `JUMP_BRANCH_COPY`),
  `ALL_JUMP_DENY_REASONS` (a frozen iteration list for tests), and
  `jumpDenyReasonLabel` (the `JumpDenyReason → copy` mapper the design described
  prose-only as "mapped via `JUMP_BRANCH_COPY`"). All three are consistent with
  design intent and improve testability — same discipline the design itself cites
  (GAME-004 adding `explainQualifyingResponse`). Acceptable.

## Doctrine self-check (all ✓)
- [x] No truth/winner/loser language in user-facing strings — `jumpBranchDoctrine.test.ts`
  collects every visible string from `JUMP_BRANCH_COPY` + every `buildJumpControlViewModel`
  / `buildJumpMarkers` output and asserts none contains any of 33 banned tokens.
- [x] Score never blocks posting — a jump commits *as* a normal move via the unchanged
  `submit-argument` path; `canJump` gates only the Jump affordance, never the ability
  to post. No score, band, or numeric field anywhere in the model.
- [x] No service-role in client code — `jumpBranchDoctrine.test.ts` source-scans the
  model + both components for `SERVICE_ROLE`; zero matches. Confirmed by diff scan.
- [x] No direct insert into public.arguments — model imports nothing from Supabase;
  the no-Edge-Function test asserts no `functions.invoke` / no `arguments` insert.
- [x] No AI calls in production app paths — `canJump` and every derivation are
  deterministic pure TS; the forbidden-import test proves no network/AI import.
- [x] Plain language only — `looksLikeInternalCode` returns false for every visible
  string (tested); no `JumpDenyReason` enum value appears verbatim in any user
  string (tested).
- [x] Epic-specific doctrine (cdiscourse-doctrine + timeline-grammar): a Jump is a
  STRUCTURAL movement signal, never a verdict/quality/truth claim on the person or
  either branch. `canJump` reads only seat role, used-jump count, and destination
  structural state — never heat, popularity, reply count, or standing (enforced by
  the forbidden-import test — the model imports nothing from any score/heat/
  anti-amplification module). The old branch is never deleted/hidden — the
  `departed_from` marker is purely additive (cdiscourse-doctrine §8). Confirm-required
  two-step gate is encoded in the contract (`JumpControlViewModel` carries
  `confirmPrompt`/`confirmLabel`/`cancelLabel`) so a component cannot ship without it.

## Test coverage
- [x] New public functions have unit tests — all 7 model functions + `jumpDenyReasonLabel`
  + `MAX_JUMPS_PER_ROOM` + `ALL_JUMP_DENY_REASONS` covered; the full `canJump`
  permutation matrix (each of the 7 `JumpDenyReason` values + the ok path + fixed
  reason precedence + no-clock determinism) is in `jumpBranchEligibility.test.ts`.
- [x] User-facing strings have ban-list assertion — `jumpBranchDoctrine.test.ts`
  scans every produced string against a 33-token ban list plus the model's own
  `_forbiddenJumpBranchTokens()`.
- [x] Edge cases from design §7 have tests — empty room, OP-only room,
  two-moves-same-branch (no jump), jump-then-stay, jump-to-mainline (ok + seat role
  unchanged), jump-back (second jump), unknown destination, collapsed/evidence
  destination, no-home-branch participant, no-reset (OD-1) — all present.
- [x] Accessibility assertions present — `jumpBranchControl.test.tsx` verifies role/
  label/hint/state, `hitSlop` ≥44px target, disabled-reason as visible text,
  confirm+cancel focusable in reading order, shape-not-color disabled distinction.
  `jumpBranchMarker.test.tsx` verifies non-interactive root, `accessibilityLabel`,
  every string inside `<Text>`, glyph-not-color departed/arrived distinction.

DERIVE-NOT-PERSIST verification: there is no test literally titled "derive-not-persist,"
but the guarantee is enforced and proven by construction — every test feeds
`JumpBranchRecord`s from `arguments` rows + a `branchIdByArgumentId` map (no DB, no
persisted jump rows); the API-surface test asserts no `forceJump`/`resetJumps`/
`setJumpCount` escape hatch; the forbidden-import test proves the model imports
nothing from Supabase/network; the no-Edge-Function/no-insert test confirms there is
no write path. The guarantee holds. (Listed as a non-blocking suggestion below.)

## Blockers
None.

## Suggestions (non-blocking)
1. The two cited copy corrections are both **correct catches** and the copy is
   doctrine-clean: `disabled_destination_closed` reads "...open to join at the
   moment." ("right now" would have tripped the `right` ban-list token), and
   `when_unknown: 'a little while ago'` (the single lowercase word "recently" trips
   `looksLikeInternalCode`'s snake-case-ish heuristic; the design §1.6 requires
   `looksLikeInternalCode` false for every visible string, so a multi-word fallback
   is required). No action needed — noted as confirmation.
2. The component tests (`jumpBranchControl.test.tsx`, `jumpBranchMarker.test.tsx`)
   use a source-scan + view-model approach rather than a runtime
   `react-test-renderer` render-and-`fireEvent` test. The test header documents this
   as deliberate repo convention ("The repo's test discipline avoids runtime
   react-test-renderer") and it is consistent with prior cards (GAME-005's
   `ChimeInGovernanceControl`). The two-step confirm gate is proven structurally
   (handleActionPress only sets state; `onConfirmJump` fires only from
   handleConfirm). A future behavioral render test would be marginally stronger but
   is not required for this card. Defer.
3. Consider adding an explicitly-named DERIVE-NOT-PERSIST test in a future card if
   persistence ever lands — today the guarantee is proven by construction +
   import/escape-hatch/no-insert scans, which is sufficient. Defer.

## Operator next steps
- Push the branch: `git push -u origin feat/GAME-006-game-006-jump-branch-once-per-room-cross`
- Open PR: `gh pr create --title "GAME-006: Jump Branch — once-per-room cross-branch participation" --body-file docs/reviews/GAME-006.md`
- Deploy steps: **None.** GAME-006 is a pure client-side code change — no migration
  (`npx supabase db push` not needed), no Edge Function deploy, no new env var, no
  new dependency. A jump commits through the existing, already-deployed
  `submit-argument` path.
- Operator decisions (isolated — none gate merge): OD-1 confirm
  `MAX_JUMPS_PER_ROOM = 1` (no reset); OD-2 confirm no arrival-approval gate in v1;
  OD-3 final `JUMP_BRANCH_COPY` copy review.
- Follow-up (not this card): the minimal additive room-shell wiring to mount
  `JumpBranchControl` + `JumpBranchMarker` — design §6 marks it optional-prop,
  no-render-by-default.
