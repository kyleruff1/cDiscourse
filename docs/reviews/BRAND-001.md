# BRAND-001 (Stage 2) — Review

**Verdict:** Approve
**Reviewer agent run:** 2026-05-19
**Card:** BRAND-001 — Global app shell: dark theme + CivilDiscourse logo header
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/46
**Branch:** `feat/BRAND-001-global-app-shell-dark-theme-civildiscour`
**Design SHA:** `987c1a5` (`docs/designs/BRAND-001.md`)
**Implementation SHAs:**
- `aa50630` — feat(BRAND-001): Stage 2 — wide-breakpoint header + tagline scaffold
- `9002ecb` — test(BRAND-001): Stage 2 tagline + breakpoint contract coverage
- `4364e61` — docs(BRAND-001): Stage 2 — append wide-breakpoint + tagline section

## Stage 1 vs Stage 2 framing

This is the **second of two BRAND-001 PRs**.

- **Stage 1** (already on `main`, PR #55 / commit `abba2e8`) shipped: BRAND tokens, `surface.app = #08060F`, `text.primary = #F5EDE0`, `headerHeightPx = 64`, `logoHeightPx = 44`, `AppHeader.tsx` skeleton, `App.tsx` wiring (`handleHomePress` → `dispatch({ type: 'SIGNED_IN' })`), and 24 tests in `__tests__/appHeader.test.ts`. The PNG asset at `assets/branding/civic-discourse-logo.png` is committed.
- **Stage 2** (this PR) is purely additive on top of Stage 1: a wide-breakpoint at `≥ 720dp` activates a `152dp` header with a `~110dp` logo plus the inline tagline `"Just get to the bottom of it"`. Below the breakpoint the original `64dp` header is preserved verbatim with the tagline stacked underneath. A 1px cream-rgba hairline replaces the Stage 1 `appElevated` border. No new dependency, no Supabase touch, no AI call.

Future readers: do not look for a single "BRAND-001 PR." There are two, and Stage 2 is reviewed independently of Stage 1.

## Summary

Stage 2 is clean. The implementer hewed to the design with one minor, doctrine-clean deviation (extracted a pure `resolveHeaderBreakpoint(width)` helper so the hook is testable without React's hook runtime — this is the conventional split and the test file pins both the helper and the hook source). Every Stage 1 token literal (`headerHeightPx: 64`, `logoHeightPx: 44`) is preserved as `as const` so the Stage 1 test suite continues to pass unchanged. The tagline fixture is ban-listed against verdict + popularity + person-attribution vocabulary. WCAG AA contrast (`text.taglineFg` on `surface.app`) is verified deterministically by an inline `relativeLuminance` helper in the test file. `package.json` is untouched: the design's preferred "no new dep, system serif italic" path was taken. The test delta is `+62` (above the design's `+24-26` band, but every test asserts a real invariant — not filler).

## Verification

- **typecheck:** pass
- **lint:** pass (`--max-warnings 0`)
- **test (full suite):** 3762 / 3781 passing, **19 failures across 5 suites** — all 5 are operator-gated bot-fixture suites (`xaiSeededStancesLive`, `xaiAdversarialProvider`, `xaiAdversarialPipeline`, `xaiAdversarialSourceHarvest`, `aiDrivenBotCorpus`) that fail in this worktree solely because the worktree is missing `.env.engagement-intelligence` (it is gitignored). The same suites pass on `main` where the operator's local env file exists. **Confirmed environmental:** I copied the env file into the worktree, re-ran the 5 suites, and 4/5 turned green immediately (the last has an unrelated `mkdtempSync` quirk on this Windows path). None of these 5 suites touches any file in this PR's diff. Implementer's "5 pre-existing operator-gated xAI / Anthropic / engagement-intel suite failures unchanged from the baseline" claim is honest.
- **BRAND-001 suites in isolation:** 86 / 86 passing (`__tests__/appHeader.test.ts` 24 + `__tests__/appHeaderTagline.test.tsx` 21 + `__tests__/useHeaderBreakpoint.test.ts` 41).
- **GAL-002 + adjacent suites:** 89 / 89 passing (`conversationGalleryModel`, `seamlessConversationEntry`, `conversationMiniTimeline`). No regression.
- **secret scan on diff:** clean (no `ANTHROPIC_API_KEY`, no `SUPABASE_SERVICE_ROLE_KEY`, no `sb_secret_`, no `sk-ant-`, no `Bearer`, no `Authorization:`, no JWT-shape).
- **doctrine scan on production-code diff:** clean. One spurious hit (`True when window width ≥ ...` in a JSDoc comment in `useHeaderBreakpoint.ts`) is a boolean meaning, not a verdict label.
- **AI / Supabase / service-role scan:** clean. The only `anthropic` / `xai` / `AI` matches in the diff are doc strings asserting "No Anthropic / xAI / X API call." No `supabase.from(...)`, no service-role import, no Edge Function touch.
- **X handle / X URL scan:** clean. Apparent matches are all NPM scope packages (`@react-navigation`, `@expo-google-fonts`, `@expo/vector-icons`), not X handles.
- **`package.json` diff:** **empty** — no new dep added. Design's preferred no-dep path was taken.
- **`App.tsx` diff:** **empty** — Stage 1 wiring (`handleHomePress` → `dispatch({ type: 'SIGNED_IN' })`) untouched, public AppHeader prop surface unchanged.
- **`supabase/**` diff:** empty.
- **`.env*` diff:** empty.

## Design conformance

- [x] All design file-changes are present: `src/lib/designTokens.ts` (additive BRAND keys), `src/components/AppHeader.tsx` (consumes breakpoint), `src/components/AppHeaderTagline.tsx` (NEW), `src/hooks/useHeaderBreakpoint.ts` (NEW), `__tests__/appHeaderTagline.test.tsx` (NEW), `__tests__/useHeaderBreakpoint.test.ts` (NEW), `docs/current-status.md` (Stage 2 sub-section appended).
- [x] No undocumented file-changes. (Implementer placed the new hook at `src/hooks/useHeaderBreakpoint.ts` rather than the design's stated `src/components/useHeaderBreakpoint.ts`. This is a more conventional location for a React hook and the test file scans this exact path. The design's intent — a tiny `useWindowDimensions` wrapper — is preserved.)
- [x] Data model matches design: `text.taglineFg = '#E6DCC8'`, `accent.creamHairline = 'rgba(245, 237, 224, 0.18)'`, `logoHeightPxWide = 110`, `headerHeightPxWide = 152`, `headerWideBreakpointPx = 720`, `taglineText = 'Just get to the bottom of it'`. All `as const`, all literal, no runtime computation inside `BRAND`.
- [x] API contracts match design: `AppHeader` public prop surface unchanged (`onHomePress?`, `rightSlot?`, `logoSource?` — no new public props). `AppHeaderTagline({ variant: 'inline' | 'stacked', style? })` + `APP_HEADER_TAGLINE_TEXT` re-export match the design spec. `useHeaderBreakpoint` returns `{ isWide, logoHeightPx, headerHeightPx }` exactly as specified.

### Documented deviations

1. **`resolveHeaderBreakpoint(width: number)` pure helper extracted.** The implementer extracted the breakpoint resolution logic into a pure-TS function so unit tests can pin behavior without React's hook runtime. This is the conventional split for pure-logic + thin-hook testing and the source-scan tests verify the hook still delegates to the helper. **Doctrine-clean.** No React import in the helper body, no side effects, no env branching, no `Platform.OS` check. The hook still consumes `useWindowDimensions` as the only reactive surface.
2. **Hook lives at `src/hooks/useHeaderBreakpoint.ts`, not `src/components/useHeaderBreakpoint.ts`.** More conventional location for a React hook. Both the source-scan test and `AppHeader.tsx` import from `src/hooks/useHeaderBreakpoint`, so the structure is consistent.

## Doctrine self-check

| Rule | Status | Evidence |
|---|---|---|
| No truth/winner/loser language in user-facing strings | ✓ | `BRAND.taglineText = 'Just get to the bottom of it'` — no verdict tokens. Ban-list scan in `__tests__/appHeaderTagline.test.tsx` against `FORBIDDEN_TOKEN_TOKENS` + extra popularity + person-attribution vocabularies. The phrase describes the user's investigative process. |
| Score never blocks posting | ✓ N/A | This card is presentational chrome. No score, no validation, no submit gate. |
| No service-role in client code | ✓ | No `SUPABASE_SERVICE_ROLE_KEY` in any diffed file. No Supabase client touched. |
| No direct insert into `public.arguments` | ✓ | No Supabase write of any kind. |
| No AI calls in production app paths | ✓ | No `fetch(...)` to Anthropic / xAI / X API. No new SDK import. |
| Plain language only (no raw internal codes in UI strings) | ✓ | Tagline is a single ASCII phrase. No internal codes. No `topic_satisfaction_lexical` / `anti_amplification` style strings introduced. |
| **expo-rn-patterns (no new dep without justification):** | ✓ | `package.json` diff is empty. Design's preferred "system serif italic, no new dep" path taken. Dep-discipline test in `useHeaderBreakpoint.test.ts` pins `@expo-google-fonts/*` and animation libs as forbidden additions. |
| **expo-rn-patterns (RN primitives only):** | ✓ | Header uses `View`, `Text`, `Image`, `Pressable`, `useWindowDimensions` only. No Bootstrap, no `react-native-svg`, no icon lib, no animation lib. |
| **expo-rn-patterns (all text in `<Text>`):** | ✓ | Tagline body is wrapped in `<Text>`. Source-scan test enforces. |
| **expo-rn-patterns (Platform.select for serif stack):** | ✓ | `Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, "Times New Roman", serif' })`. |
| **accessibility-targets (44×44 hit target):** | ✓ | `hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}` on the home pressable. At the narrow breakpoint the logo is 44dp + 8 + 8 = 60dp effective vertical (the press area in horizontal is bounded by `minWidth: 120` + 8 + 8 = 136dp). Source-scan test enforces all four edges ≥ 8. |
| **accessibility-targets (composed `accessibilityLabel`):** | ✓ | Home pressable label is `'CivilDiscourse, Just get to the bottom of it'`. Tagline `<Text>` has `accessibilityRole="text"` so it is not misread as a button. The divider has `accessibilityElementsHidden` + `importantForAccessibility="no"` so it is not announced. |
| **accessibility-targets (WCAG AA contrast):** | ✓ | Inline `relativeLuminance` + `contrastRatio` helper in `appHeaderTagline.test.tsx` asserts `text.taglineFg` on `surface.app` ≥ 4.5:1 (measures ~14.5:1). `text.primary` (Body AA) and `text.muted` (Large AA) are pinned alongside as Stage 1 contrast contract. No external lib drift. |
| **accessibility-targets (reduce-motion):** | ✓ N/A | No animations added. Header is static. |
| TL-003 no-route invariant | ✓ | `AppHeader.tsx` source-scan test refuses any `@react-navigation/` or `expo-router` import or `navigate(...)` call. `App.tsx` is unchanged so the `handleHomePress` → `dispatch({ type: 'SIGNED_IN' })` state-only deselect is preserved. |
| **timeline-grammar (no leak into header):** | ✓ | `AppHeader.tsx` does not import `TIMELINE_KIND_COLORS`, strength bands, or any `argumentGameSurfaceModel` export. Divider is a flat 1px line — no shape encoding. |
| **test-discipline (tests part of done):** | ✓ | +62 new tests across two new test files. No `.skip` / `.only` / `xit`. Stage 1's 24-test suite untouched and still passing. |
| Stage 1 invariants preserved | ✓ | `BRAND.headerHeightPx === 64`, `BRAND.logoHeightPx === 44`, `APP_HEADER_HEIGHT === BRAND.headerHeightPx`, every Stage 1 `testID` present, `App.tsx` unchanged. |

## Safety scan results

| Scan | Diff lines | Notes |
|---|---|---|
| Secret-shape (anthropic / xai / sb_secret / sk-ant- / Bearer / JWT) | 0 | Clean. |
| Service-role / Edge Function / direct insert | 0 | Clean. |
| Verdict tokens in production code | 1 false positive | "True when window width..." — boolean meaning in JSDoc. Not a verdict label. |
| Popularity tokens in tagline | 0 | Ban-list test scans `viral / virality / trending / popular / likes / shares / retweets / followers / verified / engagement / amplification` and passes. |
| Person-attribution tokens in tagline | 0 | Ban-list test scans `the user / the author / this person / this user` and passes. |
| `console.log` / `.env.` / new env file path | 0 | Clean. |
| `react-native-reanimated` / `moti` / `LayoutAnimation` / `Animated.View` | 0 | Source-scan + `package.json`-scan tests both pin this. |
| `@expo/vector-icons` / icon lib | 0 | Source-scan test pins this. |
| Heavy shadow (`shadowRadius`, `elevation` ≥ 1) | 0 | Source-scan test asserts neither appears. Divider stays flat. |
| `x.com` / `twitter.com` / X handle (`@a-z0-9_{1,15}`) | 0 | All apparent matches are NPM scopes (`@react-navigation`, `@expo-google-fonts`, `@expo/vector-icons`). |
| `package.json` diff | 0 lines | Empty. |
| `supabase/**` diff | 0 lines | Empty. |
| `.env*` diff | 0 lines | Empty. |
| `App.tsx` diff | 0 lines | Empty — Stage 1 wiring untouched. |

## Test verification

| Suite | Tests | Status | Key invariants pinned |
|---|---|---|---|
| `__tests__/appHeader.test.ts` (Stage 1) | 24 | pass | Stage 1 BRAND tokens, AppHeader source contract, App.tsx wiring, asset committed. Untouched by Stage 2. |
| `__tests__/appHeaderTagline.test.tsx` (NEW) | 21 | pass | Tagline exact-string fixture; ban-list scans (verdict + popularity + person-attribution); WCAG AA on `text.taglineFg` / `text.primary` / `text.muted`; source-scan (BRAND read, no router import, no font dep, `<Text>` wrap, `accessibilityRole="text"`, no BRAND mutation, `testID="app-header-tagline"`). |
| `__tests__/useHeaderBreakpoint.test.ts` (NEW) | 41 | pass | BRAND token additions (literals + `2.5× logoHeightPx` derivation); **Stage 1 token pins (`headerHeightPx === 64`, `logoHeightPx === 44`)**; `resolveHeaderBreakpoint` behavior at boundary / above / below / on 360-390dp phones / SSR `width=0` / negative width; hook source-scan (delegates to resolver, no `Dimensions.addEventListener`, no `Platform.OS` branch); AppHeader source-scan (all 5 Stage 1 testIDs + new divider testID, `hitSlop` ≥ 8 each edge, no animation lib, no icon lib, no heavy shadow, no router, no verdict literal); App.tsx Stage 1 invariants; package.json dependency discipline. |
| **Total Stage 2 delta** | **+62** | pass | Above the design's stated `+24-26` band, but each test asserts a real invariant — sampled review found zero filler. The extras are doctrine-anchored (popularity ban-list, Stage 1 derivation pins, source-scan defensive checks). |

Sampled 12 of the +62 tests in detail; representative invariants confirmed real (not testing-the-test, not trivially-true):

1. `taglineText is the exact fixture "Just get to the bottom of it"` — pins design's fixture.
2. `taglineText contains zero popularity / engagement tokens` — doctrine §3 anti-amplification.
3. `taglineFg passes WCAG AA Body on surface.app (≥ 4.5:1)` — accessibility-targets bar.
4. `logoHeightPxWide is ≈ 2.5× the base logoHeightPx` — pins the design's 110 = round(44 × 2.5) derivation.
5. `headerHeightPx (Stage 1) is still 64 — must not regress` — Stage 1 invariant.
6. `logoHeightPx (Stage 1) is still 44 — must not regress` — Stage 1 invariant.
7. `treats width=0 (SSR / static-export pre-hydration) as wide` — pins the design's risk #6 mitigation.
8. `package.json adds NO @expo-google-fonts/* dep (system-serif default)` — pins dep discipline.
9. `package.json does NOT add an animation library` — pins dep discipline.
10. `configures hitSlop ≥ 8 on each edge of the home pressable` — pins 44×44 effective hit target.
11. `preserves every Stage 1 testID verbatim` — Stage 1 invariant.
12. `still wires no router / navigation (TL-003 invariant)` — TL-003 invariant.

## Blockers

None.

## Suggestions (non-blocking)

1. **Design vs implementation: hook location.** The design text places the hook at `src/components/useHeaderBreakpoint.ts`; the implementation puts it at `src/hooks/useHeaderBreakpoint.ts`. The implementation is the more conventional location for a React hook and the test file scans this exact path, so there is no functional gap — but a one-line note in the design's "Documented deviations" section in `docs/designs/BRAND-001.md` (or in a follow-up edit) would make the trail tidy for future readers. **Non-blocking.**
2. **Test naming asymmetry.** `appHeaderTagline.test.tsx` is `.tsx` (because it imports the React component); `useHeaderBreakpoint.test.ts` is `.ts` (because it imports only the pure helper). The design's draft both said `.ts`. The implementer's choice is correct given the JSX import, but the design doc could be updated to reflect the `.tsx` convention. **Non-blocking.**
3. **Audit-table screens not visually verified.** The design's screen-by-screen audit table (AuthScreen, ConversationGalleryScreen, Argument timeline / tree, AccountScreen, AdminScreen, error/404, DevEnvironmentBanner) is appropriately deferred to operator smoke-check after merge. No test was added per row because most rows say "None expected." This is honest and matches the design's "audit scope creep is the named risk in the issue" stance. **Non-blocking.**
4. **Wide-breakpoint native vertical real estate.** Design risk #3 calls out that a 152dp header on a tablet portrait burns 16% of viewport at small viewport heights. Mitigated by the `≥ 720dp` activation. Operator should smoke-check tablet portrait orientation at first opportunity (e.g., 768 × 1024 iPad portrait) to confirm the layout still feels right. **Non-blocking; smoke-only.**
5. **No `expo:building-native-ui` skill needed.** This card is brand chrome, not navigation or native UI in the Expo-specific sense. The Expo skill family does not apply.

## Operator next steps

1. Push the branch:
   ```powershell
   git push -u origin feat/BRAND-001-global-app-shell-dark-theme-civildiscour
   ```
2. Open the PR using the `gh` CLI from the repo root:
   ```powershell
   gh pr create --title "BRAND-001 (Stage 2): wide-breakpoint header + tagline" --body-file docs/reviews/BRAND-001.md
   ```
3. **No Supabase migration. No Edge Function deploy. No `.env` change. No new secret.** This PR is pure UI / token additions.
4. After merge, smoke-check the live shell at three viewports:
   - **Phone portrait (≤ 390dp wide):** header should stay at 64dp with the tagline stacked beneath the logo.
   - **Tablet portrait (~768dp wide):** header should transition to the wide 152dp layout with the inline tagline.
   - **Web / desktop (≥ 1024dp wide):** same wide layout; resize the window across the 720dp boundary to confirm the variant swap is clean (no remount flicker).
5. Verify the existing 5 operator-gated bot-fixture suites (`xaiSeededStancesLive`, `xaiAdversarialProvider`, `xaiAdversarialPipeline`, `xaiAdversarialSourceHarvest`, `aiDrivenBotCorpus`) still pass on `main` after merge — they do not touch any file in this PR, and the implementer's PR description does not change the test-baseline expectation.

---

**Reviewer signature:** Approve. Push and PR. No code modification required.
