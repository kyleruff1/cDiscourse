# COMPOSER-002 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-20
**Branch:** feat/COMPOSER-002-composer-002-in-room-composer-dock-for-s
**Design:** docs/designs/COMPOSER-002.md

## Summary

COMPOSER-002 removes the largest UX regression of the Timeline-first pivot: opening the
composer no longer unmounts the argument room. `App.tsx` previously rendered
`<ArgumentTreeScreen>` only when `!composerOpen` and `<ArgumentComposer>` only when
`composerOpen` — two mutually-exclusive branches that swapped to a detached full-page
"Your Move" form. The implementation drops the `!composerOpen` term so the room stays
mounted, deletes the standalone composer branch, and adds a new presentational
`ArgumentComposerDock` (RN-primitive bottom sheet < 720px / right-side panel >= 720px)
mounted as a sibling inside the room view, driven by `visible={composerOpen}`.
`ArgumentComposer` gains a `mode?: 'dock' | 'page'` prop (default `'dock'`) that hides the
legacy "Your Move" page header except behind `mode === 'page' && __DEV__`. The
implementation matches the design doc closely — same file footprint, same close-path
contract (`Modal.onRequestClose` + web `keydown` Escape), same COMPOSER-001 preset round
trip, no new dependency, no service-role, no migration. The one deviation — test
methodology — is an acceptable environment fit (see below); coverage is adequate.
No concerns remain.

## Verification

- typecheck: pass
- lint: pass (`--max-warnings 0`, clean)
- test: COMPOSER-002 suites 4 suites / 77 tests, all pass. Full suite 4700 tests / 164
  suites; 4681 pass, 19 fail. The 19 failures are 5 pre-existing xAI/bot-fixture suites
  (`xaiSeededStancesLive`, `xaiAdversarialProvider`, `xaiAdversarialSourceHarvest`,
  `xaiAdversarialPipeline`, `aiDrivenBotCorpus`) that fail because this worktree lacks the
  gitignored `.env.engagement-intelligence` file — failure messages are `env_file_missing`
  / `mkdtempSync` on a missing `logs/engagement-intelligence` dir, not COMPOSER-002 code.
  Coordinator-confirmed environmental; COMPOSER-002's diff touches none of those files.
- secret scan: clean (only hit is the design doc quoting the `grep` command itself)
- doctrine scan: clean (only hits are the ban-list array in `composerDockA11y.test.ts` and
  the design doc — both are guard assertions, not user-facing strings)

## Design conformance

- [x] All design file-changes are present (NEW `ArgumentComposerDock.tsx`; MODIFIED
  `App.tsx`, `ArgumentComposer.tsx`, `docs/core/current-status.md`; 4 new test files)
- [x] No undocumented file-changes — `git diff main..HEAD --stat` is exactly the 9 expected
  files (design doc itself is the design commit). `ArgumentTreeScreen.tsx` has zero diff,
  as the design's "default plan: do not modify" predicted.
- [x] Data model matches design — no new data model; only the `mode?: 'dock' | 'page'`
  prop addition and the internal `DockLayoutVariant` type, both as specified.
- [x] API contracts match design — `ArgumentComposerDockProps` matches the design's prop
  list; `resolveDockLayoutVariant` exported as a pure unit-testable breakpoint helper
  (`width <= 0` / non-finite → `'side'`); reduce-motion override semantics match
  (`reduceMotionOverride` wins over the local OS read); close paths use `Modal` +
  scoped `keydown` exactly as designed.

## Doctrine self-check (must all be ✓)

- [x] No truth/winner/loser language in user-facing strings — the dock's only new copy is
  "Compose your move", "Cancel", and the SR label "Cancel and close composer". A
  parameterized ban-list test (`composerDockA11y.test.ts`) scans every `<Text>` literal
  and `accessibilityLabel` against 12 banned tokens and a snake_case-leak check.
- [x] Score never blocks posting — the post gate (`canSubmit` → `evaluateArgumentDraft`) is
  byte-identical; the dock only relocates where the composer renders.
- [x] No service-role in client code — `git diff` of `src/**` + `App.tsx` for
  `SERVICE_ROLE` / `ANTHROPIC_API_KEY` returns zero matches.
- [x] No direct insert into public.arguments — no `insert`/`from public.arguments` in the
  diff; the `submit-argument` Edge Function path through `submitArgumentDraft` is untouched.
- [x] No AI calls in production app paths — `ArgumentComposerDock.tsx` imports only RN
  primitives + `ArgumentComposer` + local types; no Anthropic/xAI/X import.
- [x] Plain language only — no internal codes in any dock string; the snake_case-leak test
  asserts this.
- [x] Epic-specific doctrine — `expo-rn-patterns`: no new dependency (`package.json` /
  `package-lock.json` diff is empty); the dock is built from `Modal`, `Animated`,
  `Pressable`, `View`, `Text`, `useWindowDimensions`, `AccessibilityInfo`, `Platform`,
  `StyleSheet` only — the `DeletionRequestSheet` `Modal` precedent, not a sheet library.
  `accessibility-targets`: 44x44 target via `minWidth/minHeight: 44` + `hitSlop: 14` on
  Cancel; `accessibilityRole`/`accessibilityLabel` on the Pressable; `accessibilityViewIsModal`
  focus trap; reduce-motion opacity-only fade path; color-independent affordances.

## Test coverage

- [x] New public functions have unit tests — `resolveDockLayoutVariant` has direct
  parameterized coverage (narrow/wide/zero/negative/NaN/Infinity/boundary-flip).
- [x] User-facing strings have ban-list assertion — `composerDockA11y.test.ts` §6.
- [x] Edge cases from design § "Edge cases" have tests — no-route invariant, hardware-back
  via `Modal.onRequestClose`, web Esc scoped to `visible` with cleanup, reduce-motion
  fade-only path, preset apply-once (`appliedPatchRef`), the `width <= 0` first-paint rule,
  the variant flip across the 720 boundary, the room-stays-mounted invariant, and the
  "no state-lifting" guard (`App.tsx` must not reference `activeMessageId`).
- [x] Accessibility assertions present — yes (this is a UI card): hit-target, role+label,
  focus trap, reduce-motion, color independence.

### Adjudication — test methodology deviation (the key review judgment)

The design's § Test plan envisioned React Testing Library render tests. The implementer
instead used the repo's actual established discipline: static source-scan + pure-helper
invariant tests. This is the correct call, not a shortcut:

- The repo has no working RTL render infrastructure — the pinned `react-test-renderer` is
  outside `@testing-library`'s peer range (documented in `AdminCreateUserForm.test.tsx`).
  Existing component tests (`AdminCreateUserForm.test.tsx`, `argumentReplySidecar.test.tsx`,
  `timelineNodeActionDockForbiddenImports.test.ts`) all use the source-scan pattern. The
  design itself acknowledged this discipline at line 219 / 235.
- The 4 delivered suites genuinely cover the design's intended assertions:
  - **In-room mount preservation** — `composerDockInRoom.test.ts` asserts the room guard
    no longer carries `!composerOpen`, the standalone `<ArgumentComposer>` branch is gone,
    `App.tsx` no longer imports `ArgumentComposer`, the dock mounts inside `debateRoom`
    after the action bar, `entryHint` still threads to `ArgumentTreeScreen`, and `App.tsx`
    does not lift `activeMessageId`. This pins the exact lines where the regression would
    reappear — a `key` prop or a re-introduced branch would fail these.
  - **Preset wiring regression** — `composerDockPresetWiring.test.ts` exercises the real
    `quickActionToPreset` / `actionDockToComposerPreset` for all 11 actions (narrow,
    confirm, synthesize, ask_source, ask_quote, challenge, clarify, evidence, concede,
    reply→null, branch→null) plus source-scan of the `composerPreset → initialPatch`
    thread and the `appliedPatchRef` apply-once guard.
  - **No-route** — `composerDockNoRoute.test.ts` is a value-import scan (skips `import
    type`) for navigation primitives + behavioral assertions on `Modal.onRequestClose`,
    the `[visible]`-scoped `keydown` listener, and the absence of a `composerOpen ?`
    screen swap in `App.tsx`.
  - **A11y / Esc** — `composerDockA11y.test.ts` covers 44x44, role+label, focus trap,
    reduce-motion fade-only, color independence, and the ban-list.
- The pure helper (`resolveDockLayoutVariant`) is genuinely unit-tested, not scanned.

For a card whose risk surface is "did the screen-swap branch come back" and "did the
preset patch still flow," a source-scan that pins those exact constructs is an adequate —
and in this repo, the only working — coverage standard. Accepted as an environment fit.

## Blockers (only if Block)

None.

## Suggestions (non-blocking)

1. The dock's `Modal animationType="none"` plus its own `Animated` slide is correct, but
   the manual-QA pass (already called out in `current-status.md`) should specifically
   confirm `Modal` z-order vs the app header on web — the design's Risk note flagged this
   and only manual testing can close it. Implementer can defer; it is operator/QA work.
2. The light-themed composer panel over the dark room is an accepted v1 seam (dark re-skin
   deferred to BRAND-002). The dock's border + shadow mitigate it as the design asked.
   No action needed — noted so the operator expects the visible seam.

## Operator next steps

- Push the branch: `git push -u origin feat/COMPOSER-002-composer-002-in-room-composer-dock-for-s`
- Open PR: `gh pr create --title "COMPOSER-002: In-room composer dock for Stack and Timeline (no Your Move redirect)" --body-file docs/reviews/COMPOSER-002.md`
- Deploy steps: none — pure UI code change. No `db push`, no `functions deploy`, no env
  var, no migration, no new dependency.
- Recommended before merge (visible-UI card): a human pass of open/close + reduce-motion +
  Esc + hardware-back in Expo web and on a native target.
