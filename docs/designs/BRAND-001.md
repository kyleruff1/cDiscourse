# BRAND-001 — Global app shell: dark theme + CivilDiscourse logo header (Stage 2)

**Status:** Design draft
**Epic:** Epic 2 — Visual Grammar (release 6.5)
**Release:** 6.5 — Timeline-first polish
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/46

> This design covers the **reopened Stage 2** of BRAND-001 only. Stage 1 (dark
> backdrop tokens, `AppHeader` skeleton, asset committed, App.tsx wiring,
> 24 tests) is already shipped on `main` via PR #55 / commit `abba2e8` and
> recorded as `Done` in `docs/product-status-ledger.md`. The implementer
> EXTENDS the existing `AppHeader` + token files; they do not rebuild them.

## Goal

The Stage 1 header reads as a small chrome strip on the live shell; the
wordmark sits at 44px in a 64px bar and feels undersized for a brand-first
surface. Stage 2 makes the CivilDiscourse mark **the first thing a user
notices on every screen** and pairs it with a one-line tagline fixture
("Just get to the bottom of it"). It also tightens vertical rhythm and
adds a hairline divider so the header looks consciously designed instead
of "a logo nailed to the top".

Doctrine constraints that shape the design:

- `cdiscourse-doctrine` — the tagline must contain zero truth / verdict
  vocabulary. "Get to the bottom of it" is permitted because it describes
  the user's investigative process, not a verdict on a person or claim.
  No copy in the header may say winner / loser / true / false / correct /
  liar / dishonest / bad faith / amplification.
- `accessibility-targets` — logo + tagline + home pressable each meet
  4.5:1 contrast against `surface.app` and the pressable hit target is
  ≥ 44×44 even after the visual height grows.
- `expo-rn-patterns` — no Bootstrap, no web-only deps; if a display font
  is loaded it goes through `expo-font` / `@expo-google-fonts/*` (the
  jest `transformIgnorePatterns` is already permissive for that path).
- `timeline-grammar` — header is global chrome, not timeline grammar.
  The implementer must NOT pull in `TIMELINE_KIND_COLORS`, strength
  bands, or argument tokens; those stay in their own modules.
- `test-discipline` — Stage 2 extends `__tests__/appHeader.test.ts` and
  adds focused suites for the tagline + breakpoint behavior. Target net
  delta `+20 to +40` tests; ban-list assertions are mandatory.

The TL-003 no-route invariant continues to hold: logo press is a
state-only `dispatch({ type: 'SIGNED_IN', userId })`, never a router
navigate. There is no router in this app.

## Data model

**No new data model.** Stage 2 is pure UI + token constants.

The following constants are extended on `BRAND` in
`src/lib/designTokens.ts`. They are pure compile-time literals — no
runtime computation, no environment branching:

```ts
// Additions to BRAND in src/lib/designTokens.ts
export const BRAND = {
  surface: {
    app:         { bg: '#08060F' },
    appElevated: { bg: '#13101D' },
  },
  text: {
    primary: '#F5EDE0',
    muted:   '#B6AFA1',
    // NEW: a slightly de-saturated cream used for the tagline so it does
    // not visually outshout the wordmark. Still ≥ 7:1 against surface.app.
    taglineFg: '#E6DCC8',
  },
  accent: {
    cream:           '#F5EDE0',
    // NEW: low-opacity cream used by the header hairline divider.
    creamHairline:   'rgba(245, 237, 224, 0.18)',
  },
  // EXISTING — keep the value. The header total height grows via paddings,
  // not by changing this constant, so anything outside the header that
  // reads APP_HEADER_HEIGHT keeps working.
  headerHeightPx: 64 as const,
  // CHANGED behavior contract (existing constant, value unchanged):
  // `logoHeightPx` is now the BASE logo height used for the **small**
  // breakpoint. The wide-breakpoint height is exposed below.
  logoHeightPx: 44 as const,
  // NEW: 2.5x of logoHeightPx, rounded to a stable integer (110). This is
  // the wide-breakpoint logo height. The implementer MUST NOT derive this
  // at runtime; it is a frozen literal so snapshot tests stay deterministic.
  logoHeightPxWide: 110 as const,
  // NEW: header outer height (padding + logo row + divider) per breakpoint.
  // The existing `headerHeightPx` (64) is preserved for the small
  // breakpoint and the existing `APP_HEADER_HEIGHT` export. The wide
  // breakpoint exposes a separate constant so external layout code
  // (sticky offsets, room toolbar paddings if any) can opt in.
  headerHeightPxWide: 152 as const,
  // NEW: breakpoint in dp at which the wide layout activates. Below this
  // the tagline stacks under the logo at small size; above it the
  // tagline sits to the right of the logo on a shared baseline.
  headerWideBreakpointPx: 720 as const,
  // NEW: the tagline fixture. Hard-coded ASCII; no i18n, no templating.
  // Forbidden-token assertions in the test file pin this exact string.
  taglineText: 'Just get to the bottom of it' as const,
} as const;
```

Notes on each addition:

- `taglineFg` exists so the tagline is unmistakably secondary to the
  wordmark in the visual hierarchy while still hitting WCAG AA Large
  (≥ 3:1) AND AA Body (≥ 4.5:1) against `#08060F`. `#E6DCC8` on `#08060F`
  measures ~14.5:1, well above AA.
- `creamHairline` is the only `rgba()` color in `BRAND`. The existing
  `HEX_6` regex in `__tests__/appHeader.test.ts` runs against
  `surface.app.bg`, `surface.appElevated.bg`, `text.primary`,
  `text.muted`, `accent.cream` — the new keys live OUTSIDE that scan, so
  the existing test does not need relaxing. The new test
  (`accent.creamHairline is a valid rgba string`) covers it explicitly.
- `headerHeightPx` keeps the value `64` so the existing
  `APP_HEADER_HEIGHT` export and any external consumer keeps the Stage 1
  contract. The wide-breakpoint total height ships as
  `headerHeightPxWide` next to it.
- `logoHeightPxWide` is a literal `110` (≈ 2.5 × 44) not a derived value.
  This is a deliberate design call so the test that asserts the wide
  height can compare a literal against a literal.

The implementer MUST NOT introduce any `Math.*` call or env-derived value
inside `BRAND`. The token module stays a static object.

## File changes

### New files

- `src/components/AppHeaderTagline.tsx` — ~70 lines.
  Small presentational sub-component that owns the tagline `<Text>` and
  optional serif-font wiring. Lives in its own file so the AppHeader
  test stays a source-scan over `AppHeader.tsx` only and the tagline
  test can target a single file. Exports:
  - `AppHeaderTagline({ variant }: { variant: 'inline' | 'stacked' })`.
  - `APP_HEADER_TAGLINE_TEXT` constant re-exported from BRAND for
    consumers that want the literal without importing all of `BRAND`.

- `src/components/useHeaderBreakpoint.ts` — ~40 lines.
  Tiny `useWindowDimensions()` wrapper that returns
  `{ isWide: boolean }` based on `BRAND.headerWideBreakpointPx`. Pure
  React hook, no Platform branching beyond what `useWindowDimensions`
  already gives us. Reads `BRAND` constants only.

- `__tests__/appHeaderTagline.test.ts` — ~120 lines.
  Source-scan + token-contract tests. Suite list:
  1. `taglineText is the exact fixture "Just get to the bottom of it"`.
  2. `taglineText has zero verdict tokens` (FORBIDDEN_TOKEN_TOKENS scan).
  3. `taglineFg passes WCAG AA on surface.app` (deterministic contrast
     math, see "WCAG verification" below).
  4. `AppHeaderTagline source uses BRAND.text.taglineFg, not a literal`.
  5. `AppHeaderTagline does NOT import any router or navigation`.
  6. `AppHeaderTagline renders an italic / display style only when the
     font has been loaded (graceful fallback to system serif)`.
  7. `AppHeaderTagline body is wrapped in <Text>` (RN crash guard).
  8. `AppHeaderTagline exposes accessibilityRole="text"` so screen
     readers don't treat it as a button.

- `__tests__/appHeaderStage2.test.ts` — ~180 lines.
  Stage 2 behavior over the existing `AppHeader.tsx` + `App.tsx` +
  `designTokens.ts`. Suite list:
  1. `BRAND.logoHeightPxWide is 110 (exact literal, 2.5× base)`.
  2. `BRAND.headerHeightPxWide is 152` and `> BRAND.headerHeightPx`.
  3. `BRAND.headerWideBreakpointPx is 720` and `> 320` and `< 1024`.
  4. `AppHeader source imports useHeaderBreakpoint and AppHeaderTagline`.
  5. `AppHeader passes BRAND.logoHeightPxWide to the wide branch`.
  6. `AppHeader renders a bottom hairline (View with
     borderBottomColor: BRAND.accent.creamHairline)`.
  7. `AppHeader home pressable hitSlop is configured so the effective
     touch target stays ≥ 44×44 even at small breakpoint`.
  8. `AppHeader still wires onHomePress to a state-only deselect (no
     router push)` — re-asserts the Stage 1 invariant.
  9. `BRAND.taglineText contains zero verdict tokens` (ban-list).
  10. `Header divider does NOT use a heavy shadow (no shadowRadius >
      0 in AppHeader styles)`.
  11. `Logo aspect ratio is preserved (width style is `undefined` or
      `null` when `resizeMode="contain"` is used with a height-only
      style)` — source-scan style assertion.
  12. `AppHeader exposes a `header-divider` testID so end-to-end can
      verify it rendered`.
  13. `Tagline accessibility — wide layout renders tagline INSIDE the
      same homePressable accessible group so VoiceOver / TalkBack reads
      "CivilDiscourse, Just get to the bottom of it, button"`.
  14. `Tagline accessibility — stacked layout still groups identically`.
  15. `AppHeader source does NOT add an animation library import` (no
      Animated, no Reanimated, no LayoutAnimation in this file).
  16. `AppHeader source does NOT add a new icon library import`.
  17. `package.json contains exactly one new runtime dep at most
      (`@expo-google-fonts/cormorant-garamond` OR none)` — a regex
      scan that fails CI if a second dep slipped in.

  Total Stage 2 net delta: **+24 to +26 tests** in two new files. With
  `appHeaderTagline.test.ts` (~8 tests) + `appHeaderStage2.test.ts`
  (~17 tests) we land near the bottom of the +20-40 band requested by
  the operator. The existing `__tests__/appHeader.test.ts` is NOT
  modified.

### Modified files

- `src/lib/designTokens.ts` — ~+35 lines additive.
  Add the new BRAND keys listed in **Data model**. Append-only inside
  the `BRAND` object literal. The existing `as const` cast stays.
  Existing `TOKENS.brand = BRAND` aggregate continues to expose the
  full new shape. The new optional `getToken('brand.taglineText')` path
  works for free because `getToken` walks the tree.

- `src/components/AppHeader.tsx` — ~+120 lines, ~−5 lines.
  - Import `useHeaderBreakpoint` and `AppHeaderTagline`.
  - Wrap the existing logo `<Image>` in a layout view that consults
    `useHeaderBreakpoint()` and picks `logoHeightPx` vs
    `logoHeightPxWide`.
  - On wide breakpoint, render `<AppHeaderTagline variant="inline" />`
    immediately after the `<Image>` inside the same `Pressable` so
    screen readers receive a single composed accessibility label.
  - On narrow breakpoint, render `<AppHeaderTagline variant="stacked" />`
    BELOW the logo, still inside the same `Pressable`.
  - Render a 1px bottom hairline View at the bottom of the header root
    using `BRAND.accent.creamHairline`. Replace the existing solid
    `borderBottomColor: BRAND.surface.appElevated.bg` so the hairline
    is the only divider.
  - Add `hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}` on the
    home pressable so the effective touch target is ≥ 44×44 even when
    the visual collapses on narrow screens (logoHeightPx 44 + 8+8 ≥ 60).
  - Compute root container `height` from
    `isWide ? BRAND.headerHeightPxWide : BRAND.headerHeightPx`.
  - Add `testID="app-header-divider"` to the hairline view.
  - Preserve every existing Stage 1 testID + accessibility label
    verbatim. Do NOT remove `app-header`, `app-header-home`,
    `app-header-logo-image`, `app-header-logo-fallback`,
    `app-header-right-slot`.

- `App.tsx` — ~+0 to +4 lines.
  No structural changes. The existing `<AppHeader onHomePress={…} />`
  call site continues to work; AppHeader handles its own height
  internally. If a layout regression surfaces in audit (e.g. the
  StatusBar on iOS overlapping the larger header), add `paddingTop`
  to `styles.appRoot` referencing `Platform.select`. This is the
  ONLY anticipated App.tsx delta and it is contingent on the audit.

- `package.json` — ~+1 line (optional).
  Add `@expo-google-fonts/cormorant-garamond` (Cormorant Garamond
  Italic). This is the single dep we are willing to consider. The
  package is roughly 32 KB gzipped per weight; we only ship one
  weight (`Cormorant_500Medium_Italic`). If the implementer decides
  during the audit that the platform default serif italic
  (`fontFamily: Platform.select({ ios: 'Georgia', android: 'serif',
  default: 'Georgia, "Times New Roman", serif' }), fontStyle:
  'italic'`) reads well enough, they may skip the dep entirely. The
  design's preferred default is **no new dep, system serif italic** —
  it ships smaller, behaves identically on web/native, and avoids a
  font-load flash on cold boot. The font dep is a fallback if the
  audit shows the system stack is illegible on Android.

- `docs/core/current-status.md` — ~+12 lines.
  Append a new sub-section under "BRAND-001 — CivilDiscourse global
  identity (Stage 6.5)" titled "Stage 2 — Logo sizing + tagline".
  Update the "Status" line. Do NOT bump the global test count in
  CLAUDE.md — that is the reviewer's job per `test-discipline`.

### Deleted files

None.

## API / interface contracts

### AppHeader (extended)

The existing props stay identical. The component gains internal layout
behavior but its public surface is unchanged so callers in `App.tsx` and
tests don't break.

```ts
interface Props {
  onHomePress?: () => void;
  rightSlot?: React.ReactNode;
  logoSource?: React.ComponentProps<typeof Image>['source'];
  // NO new public props. The breakpoint hook is internal.
}
```

### AppHeaderTagline (new)

```ts
import type { TextStyle } from 'react-native';

export const APP_HEADER_TAGLINE_TEXT: string; // re-exported from BRAND

export interface AppHeaderTaglineProps {
  /**
   * `inline` — tagline sits to the right of the logo on a shared baseline.
   * `stacked` — tagline sits beneath the logo at a smaller font size.
   */
  variant: 'inline' | 'stacked';
  /**
   * Optional style override. Implementer MUST NOT use this to swap
   * the tagline text — callers can only adjust typography.
   */
  style?: TextStyle;
}

export function AppHeaderTagline(props: AppHeaderTaglineProps): JSX.Element;
```

The component is **pure**: it renders the BRAND fixture string, applies
italic serif typography, and exposes `accessibilityRole="text"`.

### useHeaderBreakpoint (new)

```ts
export interface HeaderBreakpoint {
  /** True when window width ≥ BRAND.headerWideBreakpointPx. */
  isWide: boolean;
  /** Resolved logo height for this breakpoint. */
  logoHeightPx: number;
  /** Resolved header total height for this breakpoint. */
  headerHeightPx: number;
}

export function useHeaderBreakpoint(): HeaderBreakpoint;
```

Uses `useWindowDimensions()` only — no `Dimensions.addEventListener`,
no `Platform.OS` branching. Web and native get the same hook.

### BRAND (extended)

The new fields are listed in **Data model** above. All are `as const`
and frozen. No runtime mutation, no factory.

## Edge cases

- **Empty / null logo asset.** Stage 1 already handled this with the
  `wordmarkFallback` Text. Stage 2 must ensure the fallback ALSO
  picks up the bigger size on wide breakpoint (font size ≈ 28 on
  wide, 18 on narrow). The fallback path is rare but the test
  verifies it.

- **Tagline overflowing on a 320px viewport.** At the narrow
  breakpoint, tagline stacks BELOW the logo and renders at a smaller
  font size (14px on narrow vs 18px on wide). Maximum string width
  of "Just get to the bottom of it" at 14px ≈ 220px. Fits 320px
  with 50px padding on each side. Tested via a snapshot of styles.

- **Very narrow viewport (≤ 360px).** Header switches to stacked
  variant automatically because `headerWideBreakpointPx = 720`.
  Stacked variant uses `headerHeightPx = 64`, same as Stage 1, so
  vertical real estate stays identical for the most space-constrained
  users. The visual gain (bigger logo) is reserved for wide
  viewports where there is room.

- **Sticky behavior on web.** Stage 1 already documented the web
  sticky path; Stage 2 does not regress it. The hairline divider
  uses a deterministic rgba string, not a shadow, so it composites
  correctly when stuck.

- **Safe-area insets on native.** The SafeAreaView in `App.tsx`
  already wraps the header. On iOS notched devices the SafeAreaView
  adds padding above the header automatically; no change needed.
  On Android the existing `StatusBar style="auto"` continues to
  pick a light status bar on the dark backdrop.

- **Reduce-motion preference.** The header is static — no
  animations are added in Stage 2. `AccessibilityInfo` check is
  unnecessary because there is nothing to disable.

- **Concurrent breakpoint resize on web.** `useWindowDimensions`
  triggers a re-render. The header re-mounts the tagline in the
  correct variant. No layout effect is needed — React's render
  semantics handle the swap.

- **Font load flash (FOUT) when using `@expo-google-fonts`.** If
  the optional font dep is added, AppHeaderTagline must render the
  system serif italic as a placeholder until `useFonts()` resolves.
  The test for this is suite #6 in `appHeaderTagline.test.ts`.

- **Missing-asset path that returns a numeric require id.** Some
  Metro configs return a number from `require()`. The existing
  `source ? ... : fallback` ternary in Stage 1 treats `0` as
  falsy — fine for that case. Stage 2 does not change this branch.

- **Right slot collision with bigger logo.** `App.tsx` does not
  currently pass a `rightSlot`. If a future card adds one (per
  `Epic 9 — Profile, Preferences, Avatar, Identity`), the wide
  layout has ~ (viewportWidth − 168px logo − 220px tagline − 24px
  gaps) of breathing room before the right slot clips. Document
  this as a known constraint in `docs/core/current-status.md` so the
  Profile card knows about it.

- **Doctrine edge case: tagline becoming a verdict.** If a future
  copy edit changes "Just get to the bottom of it" to something
  like "Find the truth" or "Beat the loser arguments", the
  ban-list test on `BRAND.taglineText` fires and the build breaks.
  This is by design.

## Test plan

All new tests live in two files. No existing test is modified or
deleted. Test count goes UP only.

### `__tests__/appHeaderTagline.test.ts` (~8 tests)

```ts
import fs from 'fs';
import path from 'path';
import { BRAND, FORBIDDEN_TOKEN_TOKENS } from '../src/lib/designTokens';

describe('BRAND-001 Stage 2 — tagline fixture contract', () => {
  // 1. Exact-string assertion (pins the fixture).
  // 2. Zero verdict tokens.
  // 3. WCAG contrast check on taglineFg vs surface.app.bg.
  // 4. AppHeaderTagline source imports BRAND.text.taglineFg.
  // 5. AppHeaderTagline source has no router/nav import.
  // 6. AppHeaderTagline source has a system serif fallback branch.
  // 7. AppHeaderTagline source wraps body in <Text>.
  // 8. AppHeaderTagline source exposes accessibilityRole="text".
});
```

### `__tests__/appHeaderStage2.test.ts` (~17 tests)

```ts
// Token contract additions
//  1. logoHeightPxWide is exactly 110 and equals Math.round(logoHeightPx * 2.5)
//  2. headerHeightPxWide is exactly 152 and > headerHeightPx
//  3. headerWideBreakpointPx is exactly 720, in (320, 1024) range
//  4. accent.creamHairline matches /^rgba\(245,\s*237,\s*224,\s*0\.18\)$/

// AppHeader.tsx source contract
//  5. imports useHeaderBreakpoint
//  6. imports AppHeaderTagline
//  7. references BRAND.logoHeightPxWide
//  8. references BRAND.accent.creamHairline OR uses creamHairline via token getter
//  9. hitSlop is configured with all four edges ≥ 8
// 10. has testID="app-header-divider"
// 11. does NOT import 'react-native/Libraries/Animated/...'
// 12. does NOT import any icon library
// 13. no shadowRadius style declared
// 14. Logo image style is height-only (no fixed width) so aspect ratio survives

// Doctrine + plain-language
// 15. BRAND.taglineText has zero verdict tokens
// 16. AppHeader.tsx does NOT contain the literal string "true" / "false" / "winner" / "loser"
// 17. App.tsx still wires onHomePress to dispatch SIGNED_IN (Stage 1 invariant)
```

### Ban-list helpers

Stage 2 reuses the existing `FORBIDDEN_TOKEN_TOKENS` array from
`designTokens.ts`. No new ban list is introduced.

### WCAG verification (deterministic, not a screenshot diff)

Contrast is computed in pure TS using the WCAG 2.1 relative-luminance
formula. Add a tiny helper to the test file (not the production
module) — keeping it local avoids polluting `designTokens.ts` with a
runtime function and keeps the BRAND module a pure constant table:

```ts
// Inside __tests__/appHeaderTagline.test.ts
function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`bad hex ${hex}`);
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = channel(parseInt(m[1], 16));
  const g = channel(parseInt(m[2], 16));
  const b = channel(parseInt(m[3], 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg: string, bg: string): number {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

it('taglineFg passes WCAG AA Body on surface.app', () => {
  expect(contrastRatio(BRAND.text.taglineFg, BRAND.surface.app.bg))
    .toBeGreaterThanOrEqual(4.5);
});

it('text.primary passes WCAG AA Body on surface.app', () => {
  expect(contrastRatio(BRAND.text.primary, BRAND.surface.app.bg))
    .toBeGreaterThanOrEqual(4.5);
});

it('text.muted passes WCAG AA Large on surface.app', () => {
  expect(contrastRatio(BRAND.text.muted, BRAND.surface.app.bg))
    .toBeGreaterThanOrEqual(3);
});
```

This is deterministic, fast (no rendering), and fails the build the
moment someone shifts a token outside the AA band.

## Screen-by-screen audit table

The Stage 2 issue mandates a re-audit after the header grows. Below is
the explicit scoped table the implementer fills in. Each row lists what
to verify, what is in scope to change, and which test guards it. Out-of-
scope items are listed explicitly to prevent audit scope creep.

| Screen | What to verify | In scope to change | Out of scope | Test reference |
|---|---|---|---|---|
| **AuthScreen** (`src/features/auth/AuthScreen.tsx`) | Confirmation panel + form fit beneath new wide-breakpoint header. Cream text on `surface.app` reads at AA. | Adjust `Screen` content paddings if header overlap appears; otherwise no edit. | Refactoring auth form layout, OAuth, password rules. | Existing `Screen` styles + new `appHeaderStage2` invariants. No new screen-specific test. |
| **ConversationGalleryScreen** (`src/features/debates/ConversationGalleryScreen.tsx`) | Section group headers (`Jump into a live dispute`, etc.) remain legible against `surface.app`. Card backgrounds on `surface.appElevated` keep ≥ 3:1 contrast at borders. GAL-002 entry hints still render. | None expected — gallery already paints on dark surface. | Changing card layout, dedupe rules, gallery sections, entry-hint copy. | Existing `conversationGalleryModel.test.ts` + GAL-002 tests stay green. |
| **ArgumentTimelineScreen / ArgumentTreeScreen** (`src/features/arguments/`) | Stage 6.4 observer rail (`ArgumentSideActionRail`) collapsed by default. Sidecar + bubble cards readable. Header divider does not clip the room toolbar's top border. | Possibly tweak `roomToolbar` top border color if it visually merges with header divider. | Timeline grammar, score model, lane assignment, observer-vs-participant matrix. | Existing argument-room tests + Stage 1 BRAND tests stay green. New manual: confirm `room-toolbar-timeline` testID still receives press. |
| **AccountScreen / AccountSettings** (`src/features/account/AccountScreen.tsx`) | Body padding remains visually separated from header. Form inputs readable on dark surface. | Adjust `Screen` content padding only if header overlap appears. | Profile edit logic, avatar upload, preferences UI. | Existing `accountProfile.test.ts` stays green. |
| **AdminScreen** (`src/features/admin/AdminScreen.tsx`) | Admin Arguments / Debates / History tables remain on `surface.app` backdrop. Sort header chips remain pressable; no header divider overlap. | None expected — admin tables already use BRAND tokens. | Admin auth, RLS, table sort logic. | Existing `adminArguments.test.ts`, `adminArgumentsSort.test.ts`, `adminSecurity.test.ts` stay green. |
| **Error / 404 / Offline screens** | The app currently surfaces errors through `ErrorNotice` and `LoadingNotice`. Both render inside `Screen`, which is already on dark surface. Confirm both pass AA. | None expected. | Building a dedicated 404 route — there is no router. | No new test; existing `ErrorNotice` rendering paths covered indirectly. |
| **DevEnvironmentBanner** (`src/features/devEnvironment/`) | Banner appears immediately under the header. Confirm the header hairline + banner top edge do not double-line in dev. | If a double-line appears, set the banner top border to `transparent` (one-line edit). | Banner copy, dev-vs-prod branching. | Visual smoke only; no test. |

The audit row is intentionally short. **Audit scope creep is the named
risk in the issue.** If the implementer finds a contrast regression
outside the rows above, they file a new card (`BRAND-002` or similar)
rather than fixing it inside this PR.

## Dependencies (cards / docs / files)

- **Assumes Stage 1 BRAND-001 is shipped** (commit `abba2e8`, PR #55).
  The implementer reads `src/components/AppHeader.tsx`,
  `src/lib/designTokens.ts`, `App.tsx`, and `__tests__/appHeader.test.ts`
  as the existing baseline and EXTENDS them. They do not re-create
  files or duplicate exports.
- **Assumes GAL-002 is shipped** (commit `08a892f`, PR #103). The
  gallery's `deriveGalleryEntryHint` integration must continue to work
  after the audit; the design does not touch gallery files.
- **Reads** `BRAND` from `src/lib/designTokens.ts`. Adds keys only;
  does not remove or rename.
- **Reads** `assets/branding/civic-discourse-logo.png`. Operator-saved.
- **Does NOT block any future card**, because the public AppHeader
  surface is unchanged. A future Epic 9 profile card can pass a
  `rightSlot` without touching this design.

## Risks

1. **Audit scope creep.** Named in the issue. Mitigation: the
   screen-by-screen table above lists the ONLY edits in scope. Anything
   else is a follow-up card. The implementer must resist the urge to
   "fix one more contrast bug while I'm here."
2. **Font-load flash on cold web boot.** If the optional Cormorant
   Garamond Italic dep is added, the first paint may show system serif
   for ~200ms before the web font resolves. Mitigation: design's
   default is NO new font dep — use the system serif italic everywhere.
   Implementer ONLY adds the dep if Android renders the system stack
   illegibly during audit. The decision is in-scope for this PR.
3. **Wide header eating native vertical real estate.** A 152px header
   on a 5.4" iPhone burns 16% of the viewport. Mitigation: wide
   breakpoint activates only at ≥ 720dp width. iPhones in portrait are
   ~390dp wide and stay on the narrow (64px) header. Tablets and web
   get the wide header. This is the right trade-off per the issue's
   "no clip / no overlap" criterion.
4. **WCAG measurement disagreement.** The implementer must use the
   exact `relativeLuminance` helper in the test file. Tools that use
   sRGB midpoints or D65 vs D50 illuminants produce slightly different
   numbers. Mitigation: the helper is inline in the test, not pulled
   from a lib.
5. **Existing Stage 1 tests rely on a numeric `headerHeightPx`.**
   Suite asserts `headerHeightPx` is `≥ 48` and `≤ 96`. Keeping the
   value at `64` and shipping the wide size as `headerHeightPxWide`
   preserves every Stage 1 assertion. If the implementer is tempted
   to bump `headerHeightPx` instead, the test suite will catch it.
6. **`react-native-web` SSR / static-export quirks with
   `useWindowDimensions`.** On the static web build (`expo export
   --platform web`), the initial render may use a default `width = 0`
   before hydration. Mitigation: treat `width === 0` as wide
   (default to the polished layout) in `useHeaderBreakpoint`.

## Out of scope

The verbatim list from the issue:

- Tagline copy alternates / A-B testing (this card commits to one
  fixture string).
- Tagline localization.
- Animated logo / tagline reveal.
- Icon-only logo variants (still a separate follow-up card).
- Light-mode theme.

Additional items this design also excludes:

- Adding a router / `react-navigation` / `expo-router` of any kind.
- Adding a settings / theme-switching toggle.
- Logo motion on cold boot (separate `BRAND-002` candidate).
- Marketing site / landing page.
- Brand guidelines doc (the issue lists this separately).
- Any Supabase, Edge Function, or migration change.
- Any AI / Anthropic / xAI / X API call.
- Modifying `argumentGameSurfaceModel` or `argumentScoreModel` or
  any timeline grammar token.
- Reflowing the side action rail, sidecar, composer, or score bands.

## Doctrine self-check

- **cdiscourse-doctrine (truth labels):** `BRAND.taglineText` is the
  exact string `"Just get to the bottom of it"`. No "winner / loser /
  truth / liar / dishonest / bad faith / manipulative / extremist /
  propagandist" tokens. Phrase describes the user's process of
  reaching root claims, not a verdict on any person or post. The
  Stage 2 test pins this and ban-lists it.
- **cdiscourse-doctrine (no score-blocks-posting):** Header is
  presentational chrome. It does not gate submission, score, or any
  user action. The home pressable's only effect is a state-only
  deselect.
- **cdiscourse-doctrine (no service-role):** No Supabase client is
  touched in any file in this design. No `.env` change. No new
  secret. The PR is pure UI.
- **cdiscourse-doctrine (no AI from production):** No Anthropic / xAI
  / X API call anywhere in the header or its tests.
- **cdiscourse-doctrine (no popularity as evidence):** The tagline
  does not invoke engagement, virality, follower count, or
  amplification. It describes investigation, not popularity.
- **timeline-grammar:** Header is global chrome, not timeline grammar.
  The implementer does NOT import `TIMELINE_KIND_COLORS`, strength
  bands, lane assignment, or any timeline module. The visual divider
  is a flat 1px line — no shape encoding, no kind affordance — so it
  cannot drift into a timeline grammar element.
- **expo-rn-patterns:**
  - At most one new dep (`@expo-google-fonts/cormorant-garamond`,
    likely skipped). Documented in the dep policy section.
  - No Bootstrap. No web-only library.
  - Header uses RN primitives only: `View`, `Text`, `Image`,
    `Pressable`, `useWindowDimensions`.
  - All text wrapped in `<Text>`.
  - Component file structure mirrors the convention:
    `AppHeader.tsx`, `AppHeaderTagline.tsx`,
    `useHeaderBreakpoint.ts`.
- **accessibility-targets:**
  - Home pressable has `accessibilityRole="button"`,
    `accessibilityLabel="CivilDiscourse — back to gallery"`,
    `accessibilityHint="Returns to the conversation gallery"`,
    `hitSlop` ≥ 8 each edge → effective hit area ≥ 60×60 even at
    narrow breakpoint.
  - Tagline `<Text>` has `accessibilityRole="text"` so it is not
    misread as a button.
  - When the tagline lives inside the home pressable (wide
    layout), VoiceOver / TalkBack reads the composed label
    "CivilDiscourse, Just get to the bottom of it, button" via
    React Native's default accessibility grouping (no manual
    `accessibilityElementsHidden` needed). Stacked variant
    behaves identically.
  - Color is never the only signal: the home pressable is a
    pressable regardless of color; the divider is a divider
    regardless of opacity.
  - Reduce-motion compliance: no animations added.
  - WCAG AA verified deterministically in tests.
- **test-discipline:**
  - +24 to +26 tests in two new files, no skipped tests.
  - Existing 24 Stage 1 tests untouched and still passing.
  - Pure-TS contrast helper inline in test (no production code
    bloat).
  - Ban-list assertion on `BRAND.taglineText`.
  - Source-scan assertions match the repo's existing pattern (the
    Stage 1 tests already do source-scans).

## Operator steps

**None.** The PNG asset is already saved. No Supabase migration. No
Edge Function deploy. No `.env` change. No new secret. After the
implementer commits the PR and the reviewer approves:

1. Merge the PR.
2. Smoke-check the live shell: open Gallery, open a room, open
   Account, open Admin. Confirm the wide header renders only on
   ≥ 720dp width.

If the implementer chooses to add the optional Cormorant Garamond
Italic font dep (NOT the design's default recommendation), they must
run `npx expo install @expo-google-fonts/cormorant-garamond
expo-font` once. That is the only operator-equivalent step and the
implementer runs it themselves; the operator does nothing extra.
