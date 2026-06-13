# DEMO-001 — Review

**Verdict:** **Approve** (delta re-review 2026-06-12 — review §1 closed; see "Delta re-review" at the bottom). Prior round: Changes requested (light; single coverage/accuracy item).
**Risk classification:** **UI/fixture-only — YES (automerge-eligible on safety grounds).** Re-confirmed at delta: the two fix commits add a test file + a status-doc wording fix only — strictly safer than the base diff.
**Reviewer agent run:** 2026-06-12
**Branch:** feat/DEMO-001-recruitable-debate-demo-corridor-fi
**Design:** docs/designs/DEMO-001.md
**Diff reviewed:** `02c61bd..bb7cdf9` (5 commits: ffae19c model+fixture, c3f2f96 screen+chrome, 7cf4a5c App.tsx entry, 37ef6a7 tests, bb7cdf9 docs)

## Summary

A deterministic, no-provider, no-spend first-run corridor that walks a cold viewer through exactly one disagreement using the **real shipped components** (`ArgumentGameSurface` + real `OneBox`) fed from a bundled in-memory fixture. The honesty claims at the heart of the card all hold under independent verification: the submit chain is byte-untouched (none of `ArgumentComposer.tsx` / `OneBox.tsx` / `composerSubmit.ts` / `supabase/functions/**` / `actPopoutModel.ts` / `refereeLoop/**` / `refereeBanners/**` / `requestReview/**` is in the diff), the corridor cannot reach a real network submit by any path (verified by code-reading and a `submitArgumentDraft` spy), the surface is genuinely the shipped component (prop-driven, zero internal I/O), and the `Source owed` state derives through the real `deriveEvidenceDebts → buildOpenIssue` chain rather than a hand-set label. Doctrine is clean, all gates are green, and the diff is exactly the 15 expected files. The card is **safe to merge**.

The one thing standing between this and a clean Approve is a named design edge case that is both unmet and untested, paired with a status-doc claim that overstates coverage. The design's highest risk (#1) and its Edge-cases section explicitly require an `evaluateArgumentDraft`-per-preset test proving each of the four presets yields `allowPost: true` so the real Post button is pressable. The implementation deviates (only `ask_source`/`narrow` are immediately Post-able; `add_evidence` needs a receipt and `branch` needs a chosen type), there is **no** DEMO-001 test pinning `allowPost` for any preset, and there is no assembled test that presses the real Post and asserts the corridor advances — yet the status entry claims "engine `allowPost` per move is pinned." Close that gap (or correct the wording) and the card is a clean Approve / automerge.

## Verification

| Gate | Result |
|---|---|
| typecheck (`npx tsc --noEmit`) | **pass** (exit 0) |
| lint (scoped eslint: 7 src + App.tsx + 6 tests) | **pass** (exit 0) |
| targeted (`npx jest demoCorridor DemoCorridor`) | **pass** — 6 suites / 82 tests (exit 0) |
| full (`npx jest --silent`) | **pass** — **744 suites / 30237 passed + 1 skip (30238 total)** (exit 0); matches expected exactly; nondecreasing from 738 / 30155 baseline (+6 suites / +82 tests) |
| secret scan | **clean** (the lone regex hit is `current-status.md` prose quoting the verification command `grep ANTHROPIC_API_KEY\|SERVICE_ROLE`; no `sk-ant-`/`eyJ`/`sb_secret_`/Bearer value present; src-scoped scan empty) |
| doctrine scan | **clean** (the lone token hit is the word "verdict" inside a prohibition-framing comment in `corridorModel.ts`; no verdict/person token in any user-facing string) |
| console.* / .only / .skip / xit | **none** in the diff |
| anchors (REF-002/003/004, openIssuesRail, requestReview, actPopoutModel, uxOneOneFiveReadOnlyBoundary, uxOneOneTwoDoctrine, boardActPopoutMountSite) | **green** (all within the 744 passing suites) |

## Checklist findings

**a. Submit-chain seam (the central honesty claim) — VERIFIED.**
- Zero-diff confirmed on all named files (`git diff --name-only` lists only the 15 corridor/App/test/doc files; no submit-chain file present).
- Interception is exactly the two existing additive props. `ArgumentGameSurface.onAction` (required prop, different value) → `DemoCorridorScreen.tsx:195-202` dispatches `MOVE_PICKED`, reducer-guarded to act only on the `choose_move` beat (`corridorModel.ts:339`). `OneBox.onBeforeSubmit` returning `false` → `DemoComposerPanel.tsx:53,73` via `makeDemoBeforeSubmit` (`corridorModel.ts:441-446`, always returns `false`).
- Pre-network short-circuit confirmed in production code: `ArgumentComposer.handlePostIntent` (`ArgumentComposer.tsx:244-247`) calls `onBeforeSubmit()` and `return`s on `false` **before** `handleSubmit()` (which calls `submitArgumentDraft` at line 272). The only other submit trigger, the `postSignal` bypass effect (`ArgumentComposer.tsx:302-307`), is inert: the demo never passes `postSignal` to `OneBox` → `undefined` → `signal === 0` short-circuit.
- No real network submit reachable by ANY path: read `DemoComposerPanel`/`DemoCorridorScreen` handlers line by line; the only submit path is the Post button → `handlePostIntent` → suppressed. `onSubmitSuccess` (also passed) only fires inside `handleSubmit` after `result.ok`, which is never reached. `DemoCorridorScreen.test.tsx:110-115` mocks `submitArgumentDraft` and asserts `not.toHaveBeenCalled()` across the flow.
- The no-provider scan (`demoCorridorNoProvider.test.ts`) genuinely pins import-absence: it reads every corridor file and bans `supabase`/`submitArgumentDraft`/`edgeFunctions`/`useArgumentRoomMessages`/`fetch(`/`Anthropic`/`xai`/`x_search`/`SERVICE_ROLE`/`request-review`, plus a separate import-absence assertion for `ArgumentComposer`/`composerSubmit`/`useArgumentComposer`/`composerState`.

**b. Production-inertness — VERIFIED.** `App.tsx` diff adds `demoCorridorOpen` (default `false`) mirroring `aboutOpen`, the `<DemoCorridorScreen>` routed mount, and `!demoCorridorOpen` guards on the arguments-tab gallery/room/notifications/about renders only. With the corridor closed (default), the only behavioral delta is one extra Pressable in the gallery toolbar; the live gallery/room paths are unchanged. The "See how it works" trigger is naturally gated to the gallery-only block (`!hasDebate`). `App.tsx` is **not** in any read-only boundary list — confirmed against `uxOneOneFiveReadOnlyBoundary.test.ts:44-101` (the list contains the submit-chain files, none touched here).

**c. Real-components claim — VERIFIED.** The corridor mounts the shipped `ArgumentGameSurface` (`DemoCorridorScreen.tsx:180`) and the real `OneBox` (`DemoComposerPanel.tsx:62`). `DemoCorridorScreen.test.tsx:37-44,90-99` asserts the real `referee-card-view`, `open-issues-rail`, and `one-box` testIDs render inside the corridor, and `:60-69` walks to the referee beat and asserts the real `referee-card-zone2` derives "Source owed" from the fixture. The new chrome (`DemoMoveMenu`/`DemoCorridorGuidancePanel`/`DemoComposerPanel`) **frames** the real surfaces rather than re-implementing them — allowed corridor scaffolding; no real component's rendering is duplicated.

**d. Fixture honesty — VERIFIED.** `demoCorridorFixture.test.ts` derives state through the real `deriveEvidenceDebts` + `buildRefereeCardInput` + `buildOpenIssue` (not hand-coded): pins `burden === 'source_owed'`, `axis === 'evidence'`, `state === 'source_requested'` on the disputed claim, and the per-move debt deltas (`add_evidence` 1→0, `ask_source` 1→2, `narrow` 1, `branch` 1) — each distinct and sensible. The documented deviation (`relationToParent === 'challenges'`, not the design's inspection-guess `asks_source`) is faithful: the binding burden/axis hold exactly, and the design itself flagged its guess as not-to-be-trusted (`demoCorridorFixture.test.ts:135-140`). Fixture content is synthetic, neutral (library weeknight hours), with no real persons/handles/URLs (the lone URL is `example.test`); ban-list + no-raw-code scans over all fixture strings pass.

**e. One-primary-action invariant — VERIFIED.** `corridorModel.ts` gives every step exactly one `primaryAction`; `demoCorridorModel.test.ts:45-49` pins `countPrimaryActions(step) === 1` for all 7 steps; the `choose_move` step renders its primary as a non-pressable heading so the four move buttons live only in `DemoMoveMenu` (`DemoCorridorGuidancePanel.tsx:37,55-76`). Secondary actions are all `emphasis: 'subordinate'` and render as underlined text-link weight.

**f. Corridor copy + doctrine — VERIFIED.** `demoCorridorCopy.test.ts` scans every `CORRIDOR_COPY` atom + step teaching/action/move labels + accessibility labels for the 16-token ban-list, standalone `true`/`false`, and raw `snake_case`; pins the plain-move set ("Ask for a source" etc., no type codes per REF-ADR-001). The stand-in participant resolution is rendered as explicit honest framing ("Step into one side of a live dispute. You are a stand-in here — nothing you do leaves this walkthrough."). Acceptance-gate invariant respected: the corridor adds no path to the submit pipeline and gates nothing.

**g. A11y — VERIFIED.** `demoCorridorA11y.test.tsx` pins role + label (+ 44×44 via `minSize`/`hitSlop`) on the primary, close, secondary, and all four move options; proves the corridor is completable via labelled buttons alone; the reduce-motion path renders static (the OS value is forwarded to the surface's `reduceMotionOverride`); teaching lines are wrapped in `<Text>`; leading glyphs are `accessibilityElementsHidden` so color is not the only signal. Reduce-motion read is defensively guarded against a missing API.

**h. Gates — re-run myself (numbers in Verification table).** No `.skip`/`.only`; no guard loosened; count nondecreasing (738/30155 → 744/30237).

**i. Boundary + hygiene — VERIFIED with one accuracy exception.** Exactly the 15 expected files; no secrets; conventional commit messages by Kyler (no evidence of `--no-verify`; the test-discipline gate is green). Status entry documents the stand-in resolution and both deviations (the `challenges` relation; the interactive-not-1-tap composer) — **but** it also asserts "engine `allowPost` per move is pinned," which no DEMO-001 test substantiates (see Changes requested §1). Note: an unrelated untracked file `docs/testing-runs/2026-06-13-xai-adversarial-bot-corpus-dry.md` exists in the worktree; it is not part of this branch's commits and is not mine to commit — flagging so the operator doesn't sweep it into the PR.

## Doctrine self-check
- [x] No truth/winner/loser language in user-facing strings (ban-list tests over copy + fixture; only prohibition-framing comments contain the tokens)
- [x] Score never blocks posting (corridor adds no submit path; engine stays sole gate; verified the pre-network short-circuit)
- [x] No service-role in client code (src-scoped scan empty)
- [x] No direct insert into public.arguments (no DB access of any kind)
- [x] No AI calls in production app paths (no-provider scan bans Anthropic/xai/fetch; corridor is fixture-fed)
- [x] Plain language only — no raw internal codes in UI strings (no-snake_case scan; plain-move proof)
- [x] Epic-specific (evidence/Referee loop): `Source owed` derives through the real `deriveEvidenceDebts → buildOpenIssue` chain; engagement/popularity never granted standing; the corridor adds no new strings to the Referee Card

## Test coverage
- [x] New public model functions have unit tests (reducer, view resolver, mapping, suppressor, fixture derivation)
- [x] User-facing strings have ban-list assertion (copy + fixture)
- [~] Edge cases from design § "Edge cases" — covered **except** "prefilled draft engine-invalid → Post button disabled": each preset's `allowPost` is neither pinned by `evaluateArgumentDraft` (the design's named mitigation) nor exercised through an assembled real-Post press (see Changes requested §1)
- [x] Accessibility assertions present (`demoCorridorA11y.test.tsx`)

## Changes requested

1. **Pin the design's risk-#1 / edge-case `allowPost` behavior, and correct the status claim.** The real "Post move" button is `disabled={!canSubmit}`, and `canSubmit` requires `evaluationResult?.allowPost === true` (`src/features/arguments/ArgumentComposer.tsx:188-195, 665-668`). The corridor advances to `issue_state_change` only when the viewer presses an **enabled** Post (→ `onBeforeSubmit` → `MOVE_CONFIRMED`). The design's Edge-cases section and Risk #1 require an `evaluateArgumentDraft`-per-preset test proving each of the four presets yields `allowPost: true`. No DEMO-001 test references `evaluateArgumentDraft`/`allowPost`/`quickActionToPreset` (grep over `__tests__/` returns 26 files, none under `demoCorridor*`), and the assembled `DemoCorridorScreen.test.tsx` opens the composer but never presses the real Post nor asserts the corridor advances. Yet `docs/core/current-status.md` states "engine `allowPost` per move is pinned." Do one of:
   - **Preferred:** add an `evaluateArgumentDraft`-per-preset test recording which moves yield `allowPost: true` against the fixture, **plus** one assembled `DemoCorridorScreen` test that presses the real Post for an immediately-valid move (`ask_source` or `narrow`) and asserts advance to `issue_state_change` — closing the only end-to-end seam currently proven by inspection alone; **or**
   - at minimum, correct the status wording to state that only `ask_source`/`narrow` are immediately Post-able and that the advance seam is unit-pinned (`makeDemoBeforeSubmit` + reducer), not integration-pinned.

   Rationale: this is the card's highest design risk, the behavior deviates from the design's stated edge case for 2 of 4 moves, and the PR-body claim currently overstates coverage. The deviation itself (interactive composer for `add_evidence`/`branch`) is acceptable and consistent with the design's step-4b copy — the issue is coverage + accuracy, not the choice.

## Suggestions (non-blocking)

1. **Recruit-UX rough edge to surface to the operator / REF-006.** Because `add_evidence` (needs a receipt) and `branch` (needs a chosen type) render the Post button disabled until the viewer completes the draft, the "frictionless <3-min" promise holds cleanly only for `ask_source`/`narrow`. The corridor stays completable (those two are immediately valid; Cancel always returns to the menu), but the REF-006 timed dogfood should time at least one immediately-valid move for the budget claim, and consider whether `add_evidence`/`branch` warrant a one-line in-composer nudge ("add a source to enable Post").
2. `DemoComposerPanel` passes both `onBeforeSubmit` (returns `false`) and `onSubmitSuccess={onConfirm}` to `OneBox`. The latter is dead under the suppressor (it only fires after a real `result.ok`). Harmless belt-and-suspenders; consider dropping `onSubmitSuccess` to make the "no real submit" contract self-evident at the call site.

## Operator next steps
- This card is **safe** (UI/fixture-only; submit-chain byte-untouched and verified; no network reachable; no `supabase/**`/MCP/provider/routing/auth/secret/submit-acceptance surface). The requested change is coverage + status-accuracy, not safety — once §1 is addressed the card is **automerge-eligible**.
- Re-review after the implementer adds the `allowPost`/assembled-Post test (or corrects the status wording).
- Then push: `git push -u origin feat/DEMO-001-recruitable-debate-demo-corridor-fi`
- Open PR: `gh pr create --title "DEMO-001: Recruitable Debate Demo Corridor" --body-file docs/reviews/DEMO-001.md`
- **Deploy steps:** none — pure `src` UI + fixture change; no migration, no `db push`, no `functions deploy`, no env var, no new dependency. Merge is not a deploy.
- **Stand-in framing (operator-overridable):** the corridor mounts as a stand-in participant (`viewerRole='participant'`, `participantSide='affirmative'`) so the four real moves are reachable without a "Join" beat; the strict-observer-with-inline-Join alternative (+~15s) remains the fallback if the posture reads wrong to investors.
- **REF-006 (#589) dogfood handoff:** the timed <3-min pass runs against this shipped corridor (a usability session, not a deploy); see Suggestion 1 for the move-timing note.
- Post-merge: standard worktree cleanup per roadmap-reviewer.md § "Post-merge worktree cleanup (operator step)".

---

## Delta re-review (2026-06-12)

**Scope.** Re-review of the two fix commits since the prior round (`e54d6e7`):
`ade5e2d` (new `__tests__/demoCorridorEngineValidity.test.tsx`) and `43c9774`
(status-wording correction). All other prior-round findings stand unchanged.
**Outcome: §1 is genuinely closed — verdict flips to Approve.**

**Delta diff (`e54d6e7..43c9774`) — boundary clean.** `--stat` shows exactly
two files: `__tests__/demoCorridorEngineValidity.test.tsx` (+273) and
`docs/core/current-status.md` (+1/-1). No production code, no guard, no
fixture, no `App.tsx` touched. This is a test-and-doc-only delta — strictly
safer than the already-safe base.

**The new test drives the REAL engine chain (no mocked engine) — VERIFIED.**
- *Part A (per-preset, pure):* `draftFromPreset` builds each move's draft from
  the SHIPPED `quickActionToPreset(DEMO_MOVE_TO_QUICK_ACTION[move], …)` (the
  same mapping `DemoComposerPanel.tsx:49` seeds), parented to
  `DEMO_PARENT_ARGUMENT` — confirmed to be the fixture's **disputed sub-claim**
  (a `rebuttal`, child of root, `id = DEMO_MSG.claim`; `demoFixtureRoom.ts:310-332`
  comments it "the node every demo move acts on"). `evalAllowPost` runs the
  real `buildEvaluationInput` + `evaluateArgumentDraft` from
  `src/domain/constitution`. The four module-level mocks (async-storage,
  `edgeFunctions.submitArgumentDraft` spy, `supabase` `SUPABASE_CONFIGURED`/auth,
  `useConstitution`) shape only Part B's render; **none mocks the engine,
  `quickActionToPreset`, or `buildEvaluationInput`** — Part A imports and calls
  them directly. The honest negatives are pinned: `add_evidence` as-offered →
  `allowPost: false` (no body/receipt), `branch` preset → `quickActionToPreset`
  returns `null` (verified at `quickActionPresets.ts:143-145`) → not yet
  Post-able; both reach `true` only with the corridor-instructed completion
  (receipt+body / chosen type+body). The roll-up test asserts all four
  completed drafts yield `allowPost: true`.
- *Part B (assembled, real OneBox):* mounts the real `DemoCorridorScreen` →
  real `OneBox`, walks to `choose_move`, picks `ask_source`, asserts the real
  `one-box` renders, completes the move through the real composer controls
  (Clarification type + body + Affirmative side), asserts the real "Post move"
  button's `accessibilityState.disabled === false` (the production
  `canSubmit`/`allowPost` gate genuinely opened — not a no-op), presses it, then
  asserts (i) the corridor advanced to `issue_state_change`
  (`CORRIDOR_COPY.issueStateChangeLines[0]` = "Your move is on the record.",
  confirmed `corridorModel.ts:126-128`), the composer is gone, and (ii)
  `submitArgumentDraft` was **never called**. The advance seam is now
  integration-pinned, not inspection-only — exactly the gap §1 named.
- No `.skip`/`.only`/`xit`/`xdescribe`; no guard loosened. Read in full.

**Status wording now accurate — VERIFIED.** The overstated "engine `allowPost`
per move is pinned" is replaced with a precise, substantiated claim: only
`ask_source`/`narrow` are immediately Post-able; `add_evidence`/`branch` reach
`allowPost: true` only after the corridor-instructed completion; each is proven
by the per-preset test plus the assembled real-Post regression. The count is
corrected to the measured `745 / 30245 (+1 skip) / +7 suites / +90 tests`.

**Gates re-run by the reviewer (exact numbers).**

| Gate | Result |
|---|---|
| targeted (`npx jest demoCorridor DemoCorridor demoCorridorEngineValidity --silent`) | **pass** — 7 suites / 90 tests (exit 0) |
| full (`npx jest --silent`) | **pass** — **745 suites / 30245 passed + 1 skip (30246 total)** (exit 0); matches expected exactly; +7 suites / +90 tests over the prior 738/30155 baseline |
| typecheck (`npx tsc --noEmit`) | **pass** (exit 0) |
| eslint (`npx eslint __tests__/demoCorridorEngineValidity.test.tsx`) | **pass** (exit 0) |

**Test-coverage checklist item resolved.** The prior `[~]` edge case
("prefilled draft engine-invalid → Post button disabled") is now `[x]`:
`evaluateArgumentDraft`-per-preset proves the validity gradient, and the
assembled real-Post press exercises the production `canSubmit` gate end-to-end.

**Residual / non-blocking.** Suggestions 1–2 from the prior round still stand
(REF-006 timed dogfood should clock an immediately-valid move; `onSubmitSuccess`
remains harmless dead-weight under the suppressor). The stray untracked file
`docs/testing-runs/2026-06-13-xai-adversarial-bot-corpus-dry.md` is still in the
worktree, still not part of this branch's commits — flagging again so the
operator does not sweep it into the PR.

**Verdict: Approve.** §1 is closed by code, not by hand-waving; doctrine,
secrets, and submit-chain inertness findings from the prior round are unchanged
and unaffected by a test-and-doc delta. Operator next steps above are unchanged
(push + PR; no deploy; merge is not a deploy).
