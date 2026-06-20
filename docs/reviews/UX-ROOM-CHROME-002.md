# UX-ROOM-CHROME-002 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-06-20
**Branch:** feat/UX-ROOM-CHROME-002-masthead-balance (HEAD e43e3e4)
**Design:** docs/designs/UX-ROOM-CHROME-002.md

## Summary
The signed-in shell masthead rendered the gold lockup in the UX-ROOM-CHROME-001
`compact` variant (~48px on every band), under-filling the top-left brand zone
against the `flex:1` nav band. This card adds an additive, default-`false`
`balanced` variant: a band-aware lockup height `{phone:48, tablet:88, wide:112}`
sized by a new pure `resolveSignedInMastheadLogoHeightPx(band, width)` that
width-caps via `min(target, floor(available/aspect))`, plus a `rootWithNavBalanced`
(`alignItems:'center'`) + `navSlotBalanced` so the lockup + nav + right slot read
as one centered composed row. App.tsx swaps the signed-in shell `compact -> balanced`
(one prop). The compact + prominent resolver paths, the constants, the prominent
root styles, the single asset require, AuthScreen / Sign In / favicon / branding
assets, and all board topology are untouched. Diff is 6 files, additive,
presentational only. All gates green. No doctrine, security, or scope concerns.
Non-blocking: the 88/112 pixel choices are an aesthetic judgement; the invariants
(width-safe, > compact, < prominent, board dominant) all hold structurally, so
the operator can visually gate at FF.

## Verification
- typecheck: pass (exit 0)
- lint (`--max-warnings 0`): pass (exit 0)
- jest (uxRoomChrome002MastheadBalance uxRoomChrome001 appHeaderResponsiveLogo appHeader HeaderNavigation.mastheadInline): pass — 7 suites / 146 tests, exit 0
- web:build: pass (exit 0; 773 modules; only the two existing branding PNGs at the same content hash, favicon.ico unchanged — no new asset bytes)
- secret scan: clean (the single grep "hit" is the design doc's own prose stating the policy is clean, not a secret)
- doctrine scan: clean (no verdict tokens; no SERVICE_ROLE / ANTHROPIC_API_KEY / public.arguments in source; no console.log added)
- frozen-surface scan: clean (AuthScreen / signInLockupModel / app.json / assets/branding / package.json / lockfile / .env / supabase / RoomBoardLayout / DisagreementPointsRail / ArgumentTimelineMap / deriveMediatorBoardState / argumentGameSurfaceModel — none in the diff)

## Design conformance
- [x] All design file-changes are present (AppHeader.tsx, App.tsx, 2 test files, 2 docs)
- [x] No undocumented file-changes (exactly the 6 files the design names)
- [x] Data model matches design (N/A — presentational sizing only)
- [x] API contracts match design (new pure resolver + additive `balanced?: boolean` prop, default false; precedence balanced > compact > prominent)

## Doctrine self-check (all ✓)
- [x] No truth/winner/loser language in user-facing strings (render ban-list test §5 asserts 12 tokens absent; grep clean)
- [x] Score never blocks posting (N/A — chrome sizing; no scoring path touched)
- [x] No service-role in client code (grep over src/**/*.ts(x) + App.tsx clean)
- [x] No direct insert into public.arguments (none in diff)
- [x] No AI calls in production app paths (none added)
- [x] Plain language only (masthead carries only the brand mark + nav; no internal codes)
- [x] Epic-specific doctrine:
  - accessibility-targets — home Pressable keeps `accessibilityRole="button"`, gallery hint, and 44×44 via `hitSlop={{8,8,8,8}}` (AppHeader.tsx:375-385; test §4 asserts all three). Logo keeps `resizeMode="contain"` + aspect-true width (no color-only signal, no deform).
  - expo-rn-patterns — RN `View`/`Image`/`Pressable` primitives only; named band constants (`BALANCED_LOGO_HEIGHT_BY_BAND`) not inline magic px; no new dependency, no banned web-only dep; band derived from the existing `useHeaderBreakpoint` hook (reused, not rebuilt). Phone reflow preserved via existing `rootWithNavPhone`.

## Test coverage
- [x] New public function has unit tests (`resolveSignedInMastheadLogoHeightPx` — §1 per-band, §2 width-safe at all 9 widths + table parity, §1 SSR/non-positive→wide default, §3 independence from the compact/prominent resolver)
- [x] User-facing strings have ban-list assertion (§5, 12 banned tokens over the rendered tree)
- [x] Edge cases from design have tests (overflow at 320/360/390/414/600/768/1024/1366/1920 §2; phone floor/ceiling §1; SSR width §1; compact `<=48` + prominent `===288` byte-equivalence regression §3)
- [x] Accessibility assertions present (UI card — §4 logo aspect preserved, navSlot reachable, home role+hint+hitSlop, rightSlot renders, tagline omitted)

## Reviewer focus items (card's named criteria)
1. Larger + satisfying, not a splash — PASS. `{48,88,112}` between the 48 compact and 288 prominent; the old 288 signed-in path does not return (App.tsx uses `balanced`, never prominent on the signed-in shell); logo never below 48 (phone floor) (AppHeader.tsx:174-178; test §1/§2).
2. Proportional + undeformed — PASS. Image `width = logoHeightPx * LOGO_ASPECT_RATIO` (1400/331) + `resizeMode="contain"` (AppHeader.tsx:396-402); test §4 asserts `w ≈ h*aspect`.
3. No overflow — PASS. `resolveSignedInMastheadLogoHeightPx` returns `min(target, floor(available/aspect))` (AppHeader.tsx:308-310) so `h*aspect <= available` structurally; test §2 proves all 9 widths; nav `flexWrap` inherited via navSlot `flex:1` + phone column reflow prevent body-level horizontal scroll.
4. Nav is a composed companion — PASS. `rootWithNavBalanced` `alignItems:'center'` (AppHeader.tsx:524-528) + `navSlotBalanced` `justifyContent:'center', paddingTop:0` (AppHeader.tsx:549-552); phone still reflows column (`navSlotBalanced` applied only `!isPhone`, AppHeader.tsx:450).
5. Board stays dominant — PASS. Balanced root releases the 296 prominent minHeight; `minHeight: headerHeightPx` = balanced logo + 8 (wide 120 / tablet 96 / phone 56), far shorter than 296; no fixed 296 on the balanced path (AppHeader.tsx:342-348).
6. Phone safety — PASS. `BALANCED_LOGO_HEIGHT_BY_BAND.phone = 48`; reflows column; no overflow at 320/360/390/414 (test §1/§2).
7. No board topology change — PASS. RoomBoardLayout / DisagreementPointsRail / timeline / mediator derivation absent from the diff (name-only scan clean).
8. Sign In + favicon frozen — PASS. AuthScreen / signInLockupModel / app.json / assets/branding absent from the diff; web:build emits no new asset bytes (same PNG hashes, favicon.ico 14.5kB unchanged). Transient App.tsx `<AppHeader>` (prominent, no nav) unchanged — only the adjacent comment in the signed-in block changed.
9. compact + prominent paths intact — PASS. `resolveMastheadLogoHeightPx` body + `COMPACT_LOGO_HEIGHT_PX` / `PROMINENT_LOGO_HEIGHT_PX` / `LOGO_ASPECT_RATIO` / `rootWithNav` / `rootWithNavCompact` unchanged; the only changes are additive + the App.tsx prop swap. Pinned uxRoomChrome001 + appHeaderResponsiveLogo suites pass (test §3 + 146/146 battery).
10. No banned copy — PASS. §5 render ban-list (12 tokens incl. the three banned phrases) passes; "Mediator readout" untouched (not in diff); grep clean.
11. Security/config — PASS. No secrets; no package/lockfile/.env/supabase/Edge/MCP/provider/dependency change.
12. Tests real — PASS. §1-§6 assert per-band sizing, the width-safe invariant at all 9 widths, aspect preservation, nav reachability, compact/prominent regression, banned copy, and frozen surfaces — substantive assertions, not tautologies.

## Blockers
None.

## Suggestions (non-blocking)
1. The 88 (tablet) / 112 (wide) pixel values are an aesthetic judgement. Every structural invariant holds (width-safe, > 48 compact, < 288 prominent, board dominant), so this is safe to ship; the operator should visually gate the exact proportions at FF and bump the two band constants if the composed row still reads light. No code change required to do so — they are named constants in one place (`BALANCED_LOGO_HEIGHT_BY_BAND`, AppHeader.tsx:174-178).

## Operator next steps
- Push the branch: `git push -u origin feat/UX-ROOM-CHROME-002-masthead-balance`
- Open PR: `gh pr create --title "UX-ROOM-CHROME-002: signed-in masthead lockup/nav spatial balance" --body-file docs/reviews/UX-ROOM-CHROME-002.md`
- Deploy steps: none. Signed-in chrome UI/test-scoped; no migration, no Edge Function, no Supabase write, no dependency change. Safe to merge with no deploy. (Netlify serves the committed bundle; no provider/secret arming required.)
- Post-merge worktree cleanup (commands in roadmap-reviewer.md § "Post-merge worktree cleanup (operator step)"); the worktree is `.claude/worktrees/agent-chrome002`.
