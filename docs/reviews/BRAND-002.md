# BRAND-002 — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-20
**Branch:** feat/BRAND-002-brand-002-app-wide-dark-surface-cohesion (tip 15dd1bc)
**Design:** docs/designs/BRAND-002.md (as amended 2026-05-20)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/138

## Summary

BRAND-002 extends `src/lib/designTokens.ts` with an additive `SURFACE_TOKENS`
dark-surface scale and a `CONTROL` button-intent object, then replaces every
raw light hex literal across 18 screen/component files (Account, Auth, Invite,
AdminScreen + 7 admin tabs + AdminUserDetailPanel + AdminCreateUserForm, and
the 5 composer files) with token references. This is a genuinely visual-only
pass: the entire diff is hex-to-token substitution inside `StyleSheet.create`
blocks plus additive `placeholderTextColor` props and additive style-array
composition for destructive-button text. No JSX structure, no handlers, no
copy, no new dependency, no Supabase/Edge/migration changes. The card went
through a design-defect cycle — the implementer correctly flagged that three
contrast pairs in the original table were numerically wrong; the design
amendment fixed them, the implementer applied the amended `CONTROL.primary`
tokens, and the test pins the corrected ratios. Independent WCAG 2.x
recomputation confirms the amendment is real, not hand-waved. All four
verification commands pass. No concerns remain.

## Verification
- typecheck: pass (`tsc --noEmit`, clean)
- lint: pass (`eslint --max-warnings 0`, clean)
- test: 6733 tests / 259 suites — 6732 pass, 1 pre-existing flake (see note)
- skills:validate: pass (both bot skills OK)
- secret scan: clean (only hit is the literal grep-command string inside the
  BRAND-002 design doc's doctrine self-check — documentation, not a secret)
- doctrine scan: clean (no verdict language in any code/test +line)

**Test-flake note (not a blocker).** The full `npm run test` run reported one
failure: `__tests__/dockerfileShape.test.ts` › "no *.json file matches the GCP
service-account-key shape" failed with `ENOENT` on
`fixtures/generated-scenarios-corpus-test/stress-001-...json`. This is a
parallel-test race: that suite globs JSON files then `readFileSync`s them, and
a concurrently-running bot-fixture suite created and deleted the transient
corpus fixture between the glob and the read. It is **unrelated to BRAND-002**
(the BRAND-002 diff touches zero JSON files). Re-running
`dockerfileShape.test.ts` in isolation passes. The two BRAND-002 suites
(`darkSurfaceTokens.test.ts` 41 tests, updated `designTokens.test.ts`) both
pass in isolation and in the full run. Net BRAND-002 result: green.

## Design conformance
- [x] All design file-changes are present (23 files: 1 token file, 1 new test,
  1 updated test, 2 docs, 18 screen/component files — exactly the amended
  footprint)
- [x] No undocumented file-changes (no supabase/, no .env, no migration, no
  package.json/lock change, no node-visual-grammar file)
- [x] Data model matches design (`SURFACE_TOKENS` 14 keys, `CONTROL`
  primary/secondary/danger; both added to `TOKENS` aggregate; existing
  `SURFACE`/`BRAND`/`GLOW`/`STATUS`/`ARGUMENT` byte-identical)
- [x] API contracts match design (`CONTROL.primary.bg = #4f46e5`,
  `CONTROL.primary.fg = #ffffff` per the amendment; `getToken` resolves the
  two new dotted paths; `SurfaceTokenKey`/`ControlKey` exported)

## Doctrine self-check (must all be ✓)
- [x] No truth/winner/loser language in user-facing strings — token names are
  structural (`base`, `elevated`, `border`, `danger`); zero copy changed;
  ban-list test asserts no new key matches `FORBIDDEN_TOKEN_TOKENS`
- [x] Score never blocks posting — no scoring/validation/post path touched
- [x] No service-role in client code — clean scan
- [x] No direct insert into public.arguments — clean scan
- [x] No AI calls in production app paths — clean scan; no fetch added
- [x] Plain language only — no internal codes surfaced; no copy edited at all
- [x] Epic-specific doctrine (expo-rn-patterns): no new dependency; RN
  primitives + token layer only — the token scale is the RN-native substitute
  for Bootstrap. (accessibility-targets): destructive controls carry meaning
  via label text + border (not color alone); the focus-ring token is specified
  and pinned at the 3:1 bar; AA contrast verified on every body-text/button
  pair.

## Test coverage
- [x] New public token surface (`SURFACE_TOKENS`, `CONTROL`, `getToken`
  paths) has unit tests — `darkSurfaceTokens.test.ts` covers structure, hex
  validity, room-family anchoring, aggregate wiring, and contrast.
- [x] Ban-list assertion present — new token keys are scanned against
  `FORBIDDEN_TOKEN_TOKENS`. (Card adds zero user-facing strings, so no copy
  ban-list is required.)
- [x] Edge cases from design covered — the converted-screen scan reads all 18
  source files and asserts (a) no banned light hex literal, (b) no near-white
  hex (all 3 channels ≥ 0xc0), (c) each file imports `designTokens` and
  references a surface/control token. `#000`/`#000000` shadows are explicitly
  allow-listed per the design exemption.
- [x] Accessibility assertions present — contrast-pair tests use a pure-TS
  WCAG 2.x `relativeLuminance`/`contrastRatio` helper and pin every row of the
  amended contrast table.

## Contrast doctrine — independently verified

Recomputed every load-bearing pair with a standard WCAG 2.x implementation:

- `CONTROL.primary` (amended): white `#ffffff` on `#4f46e5` = **6.29:1** —
  genuinely clears the 4.5:1 body bar. The OLD pairs genuinely failed: dark
  `#0b1220` on `#6366f1` = 4.19:1, white on `#6366f1` = 4.47:1. The amendment
  is real, not cosmetic.
- Focus ring `#a5b4fc`: 10.12:1 on base, 9.39:1 on elevated — clears 3:1.
- `CONTROL.danger.fg #fca5a5`: 10.63:1 / 9.86:1 — clears 4.5:1.
- `textPrimary` 16.36:1, `textSecondary` 7.87:1, `textMuted` 4.24:1 (≥3:1,
  non-body use only).
- Decorative hairlines (`border` 1.38:1, `divider` 1.14:1, `inputBorder`
  1.81:1) are correctly **not** pinned to 3:1 — the test asserts only the
  lighter-than-backdrop luminance ordering plus a < 3:1 "still a hairline"
  ceiling. The WCAG 1.4.11 reasoning (a card/input/table separator is not
  non-text UI *required to identify* a component or state) is sound; the focus
  ring — the one token that IS required to identify the focused component —
  correctly keeps the full 3:1 bar.

Every pinned ratio in `darkSurfaceTokens.test.ts` matches my independent
computation to two decimals.

## Destructive controls — verified

All four destructive controls use the bordered `CONTROL.danger` treatment, not
a red flood:
- `AccountScreen.signOutButton` — transparent bg + 1px maroon border + light-
  red fg (was a `#ef4444` flood).
- `AdminUserDetailPanel.btnDanger` ("Disable user" / "Soft delete") —
  transparent bg + border + `btnDangerText` light-red fg (was `#dc2626`
  flood); the JSX change is additive style-array composition only, visible
  text unchanged.
- `ArgumentComposer.discardText` — text link, recolored to `CONTROL.danger.fg`
  only, no border added (correct — the bordered rule applies to buttons).
- `ComposerDraftRecoveryNotice.discardButton` — transparent bg + border +
  light-red fg.

## Blockers
None.

## Suggestions (non-blocking)
1. `AdminScreen.subtabActive` changed from `#dc2626` (red) to
   `CONTROL.primary.bg` (indigo). This is the correct call — the red was being
   used as an active-tab accent, not a destructive signal — but it is the one
   place where a hue's *role* shifted rather than a literal-to-token swap.
   Worth a one-line mention in the PR body so a visual reviewer is not
   surprised the admin subtab indicator is now indigo.
2. The `dockerfileShape.test.ts` parallel-fixture race is a pre-existing
   repo-wide flake, not introduced here. Worth a small follow-up card to make
   that suite tolerate `ENOENT` (re-glob or skip vanished files) so future
   full-suite runs are not noisy.

## Operator next steps
- Push the branch: `git push -u origin feat/BRAND-002-brand-002-app-wide-dark-surface-cohesion`
- Open PR: `gh pr create --title "BRAND-002: App-wide dark surface cohesion pass" --body-file docs/reviews/BRAND-002.md`
- Deploy steps: none — pure client code. No migration, no Edge Function
  deploy, no env var, no Supabase write. After merge, the operator only runs
  the standard `npm run typecheck && npm run lint && npm run test`.
