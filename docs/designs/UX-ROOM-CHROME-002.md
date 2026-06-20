# UX-ROOM-CHROME-002 — signed-in masthead lockup/nav spatial balance

**Issue:** kyleruff1/cDiscourse#734
**Scope:** Signed-in TOP CHROME ONLY. UI / UX only.
**Branch:** `feat/UX-ROOM-CHROME-002-masthead-balance`

## Summary

The signed-in shell masthead (`App.tsx` ~778) mounts the navSlot-bearing
`<AppHeader>`. Since UX-ROOM-CHROME-001 it rendered the gold lockup in the
**compact** variant: `resolveMastheadLogoHeightPx(band, width, true)` =
`min(48, widthFit)` ≈ a 48 px lockup (≈203 px wide) on every band. Against the
`flex:1` nav band this left the top-left brand zone under-filled — the chrome
read as a small floating block rather than one composed region (operator
screenshot).

This card adds an **additive `balanced` variant** to `AppHeader`: a band-aware
"balanced" lockup height (phone 48 / tablet 88 / wide 112) that is larger and
more proportional than compact, far shorter than the prominent 288 px lockup,
and **still width-capped** so it can never overflow at any viewport. The
signed-in masthead's `compact` prop is replaced with `balanced`. The
compact + prominent resolver paths are **untouched (byte-equivalent)**; the
bare/transient masthead, AuthScreen / Sign In hero, favicon, and all branding
assets are **frozen**.

The board stays the dominant first surface — the balanced header
(`headerHeightPx = balH + 8` → wide 120, tablet 96, phone 56) is far shorter
than the old 296 px prominent shell.

## Required mapping table

| Surface | Current implementation | Current defect | Proposed change | Files touched | Behavior touched (Y/N) | Topology touched (Y/N) | Data/API touched (Y/N) | Responsive widths affected | Safe now or deferred | Test coverage |
|---|---|---|---|---|---|---|---|---|---|---|
| Signed-in AppHeader lockup sizing | `compact` path → `min(48, widthFit)` = 48 px on every band | 48 px lockup under-fills the top-left brand zone against the `flex:1` nav band; reads as a tiny floating block | New `balanced` variant → `resolveSignedInMastheadLogoHeightPx(band, width)` = `min(BALANCED_LOGO_HEIGHT_BY_BAND[band], widthFit)` (phone 48 / tablet 88 / wide 112), still width-capped | `src/components/AppHeader.tsx` | N (presentational sizing only; no state/route) | N | N | tablet 600–1279, wide ≥1280 grow; phone unchanged | Safe now | `uxRoomChrome002MastheadBalance` §1, §2, §4 |
| Nav slot positioning / composition | `navSlot` (`flex:1`) top-aligned via `paddingTop:6` in the compact slim root | Nav top-anchored beside a tiny lockup; the band does not read as one composed row | New `navSlotBalanced` style (center vertically, drop top-inset) + `rootWithNavBalanced` root (`alignItems:'center'`) so lockup + nav companion + right slot sit as one centered composed row | `src/components/AppHeader.tsx` | N (layout style only; AppPrimaryNav untouched, nav still reachable + touch-safe) | N | N | tablet + wide (centered row); phone reflows to column (`rootWithNavPhone`, unchanged) | Safe now | `uxRoomChrome002MastheadBalance` §4 (navSlot present + reachable) |
| Phone widths | `compact` path caps phone at 48 | (no defect — phone is the tightest budget) | Balanced keeps phone at 48 (`BALANCED_LOGO_HEIGHT_BY_BAND.phone = 48`); masthead reflows to a column on phone so a taller logo would only eat the mobile first screen | `src/components/AppHeader.tsx` | N | N | N | phone ≤599 (unchanged height) | Safe now | `uxRoomChrome002MastheadBalance` §1 (phone ≥ 48, ≤ 48), §2 (no overflow at 320/360/390/414) |
| App.tsx wiring switch | Signed-in shell `<AppHeader compact … navSlot={<AppPrimaryNav…>} />` | Wires the under-filled compact variant | Replace `compact` with `balanced` on the signed-in shell masthead; update the adjacent comment. Line-405 transient `<AppHeader>` untouched | `App.tsx` | N (one prop swap; no other logic) | N | N | all (the variant applies on every band) | Safe now | `uxRoomChrome001` §1d (updated to `balanced`); `uxRoomChrome002MastheadBalance` §6 (Sign In untouched) |

## Balanced sizing table (proves no overflow)

`balH` = `resolveSignedInMastheadLogoHeightPx(band, width)` = `min(target, widthFit)`,
`widthFit = floor((width − 24) / (1400/331))`, rendered width = `balH × (1400/331)`,
available = `width − 24`. Aspect (1400/331 ≈ 4.230) is **always** preserved
(`width = height × aspect`, `resizeMode="contain"`).

| Viewport width | Band | Target (band const) | Balanced height (`balH`) | Rendered width (`balH × 4.230`) | Available width (`width − 24`) | Fits? |
|---|---|---|---|---|---|---|
| 320 | phone | 48 | 48 | 203 | 296 | yes |
| 360 | phone | 48 | 48 | 203 | 336 | yes |
| 390 | phone | 48 | 48 | 203 | 366 | yes |
| 414 | phone | 48 | 48 | 203 | 390 | yes |
| 600 | tablet | 88 | 88 | 372.2 | 576 | yes |
| 768 | tablet | 88 | 88 | 372.2 | 744 | yes |
| 1024 | tablet | 88 | 88 | 372.2 | 1000 | yes |
| 1366 | wide | 112 | 112 | 473.7 | 1342 | yes |
| 1920 | wide | 112 | 112 | 473.7 | 1896 | yes |

At every supported width the rendered width is well under both the available
header width and the full viewport, so there is **no body-level horizontal
overflow**. The width-cap (`min(target, widthFit)`) guarantees this
structurally: `balH ≤ widthFit ⇒ balH × aspect ≤ available`. The lockup is
never smaller than 48 (compact floor) on any band and never reaches the
prominent 288.

## The balanced layout (chosen composition)

- **Height:** `resolveSignedInMastheadLogoHeightPx` → `BALANCED_LOGO_HEIGHT_BY_BAND`
  (phone 48 / tablet 88 / wide 112), width-capped per band.
- **Root style `rootWithNavBalanced`:** like `rootWithNavCompact` (no 296 px
  prominent `minHeight`; `minHeight: headerHeightPx`; slim `paddingVertical: 4`)
  BUT `alignItems: 'center'` so the larger lockup, the inline nav companion,
  and the right slot sit as **one centered composed row** — the "composed
  companion, not a disconnected floating block" the card asks for. This is a
  balanced-variant-only choice; the prominent top-align (`rootWithNav`,
  `alignItems:'flex-start'`) decision is unchanged.
- **Nav slot `navSlotBalanced`:** centers the nav vertically
  (`justifyContent:'center'`, `paddingTop:0`) so it reads as a companion beside
  the lockup rather than a top-anchored strip. `flex:1` (inherited from
  `navSlot`) still claims the middle space; AppPrimaryNav itself is untouched
  (nav reachable + touch-safe).
- **Phone:** still reflows to a column (`rootWithNavPhone`,
  `flexDirection:'column'`) — `navSlotBalanced` is applied only on non-phone.
- **Tagline:** omitted (same as compact) so the masthead stays trim; the brand
  is still announced via the logo's `accessibilityLabel="CivilDiscourse"`.
- **Precedence:** `balanced` → `compact` → prominent.

## Frozen surfaces (NOT touched)

- `App.tsx` line ~405 transient `<AppHeader>` (unconfigured / invite / callback) — stays prominent.
- `src/features/auth/AuthScreen.tsx` + its `signInLockupModel` (Sign In hero).
- `app.json` favicon.
- `assets/branding/*` bytes (no asset bytes change; the single `civic-discourse-logo.png` require is unchanged).
- `resolveMastheadLogoHeightPx`, the compact + prominent branches, `rootWithNav`,
  `rootWithNavCompact`, `LOGO_ASPECT_RATIO`, `COMPACT_LOGO_HEIGHT_PX`,
  `PROMINENT_LOGO_HEIGHT_PX`, `HEADER_HORIZONTAL_BUDGET_PX` — all byte-equivalent.
- Board topology / `RoomBoardLayout` / `DisagreementPointsRail` / timeline geometry /
  mediator derivation / room-seat-chime-in / submit — untouched.
- No new dependency, no package/lockfile/.env/supabase/Edge/MCP/provider change.

## Doctrine / halt check (cdiscourse-doctrine)

1. **Score is gameplay analysis, never truth** — N/A; no scoring/labels. No
   banned tokens (winner/loser/score/verdict/truth/wrong/dishonest/bad
   faith/manipulative) emitted; a render ban-list test asserts this.
2. **Heat / popularity** — N/A.
3. **AI moderator limits** — N/A; no AI calls. Production app makes no AI calls (unchanged).
4. **Rules engine sacred** — untouched.
5. **Secrets policy** — no `ANTHROPIC_API_KEY` / `SERVICE_ROLE` introduced; secret scan clean.
6. **No AI calls from the production app** — unchanged.
7. **Supabase conventions** — no DB / RLS / migration change.
8. **Plain language** — no internal codes surfaced; the masthead carries only the brand mark + nav.
9. **Observations vs Allegations** — N/A (no node labels touched).
10. **v1 scope guards** — no voting/scoring/search/etc. introduced.
11. **Accessibility (accessibility-targets)** — home pressable keeps
    `accessibilityRole="button"` + hint + 44×44 via `hitSlop`; logo keeps
    `resizeMode="contain"` (aspect preserved, no deform); nav reachable + touch-safe.
12. **Banned copy** — no "Just get to the bottom of it" / "GAMEPLAY ANALYSIS" /
    "Where the points stand" / "Mediator readout" touched.

No halt condition: the change is additive, the frozen surfaces are untouched,
and no topology/data/API is affected.
