# QUICK-BRAND-LOCKUP-002 — new gold/cream duotone CivilDiscourse lockup

Issue: #722
Branch: `feat/QUICK-BRAND-LOCKUP-002-lockup`
Type: brand asset swap + aspect-ratio re-cut + test wiring + freeze guard
(UI/asset only — no schema, no Edge, no scoring, no AI, no secrets).

## What changed

The horizontal CivilDiscourse lockup was re-cut from the gold **800×260**
art (UX-BRAND-ASSETS-002) to a gold/cream **duotone 960×342** lockup:

- Source: `civil_discourse.png`.
- Treatment: gold/cream duotone (`#C6A15B` gold + `#F5EDE0` cream) with a
  soft gold glow.
- Output: **960×342**, 8-bit RGBA (PNG colorType 6), ~164 KB.
- The asset binary was processed with a scratch image tool under `.tmp/`
  (NOT a repo dependency — no package was installed, and `.tmp` is never
  staged).

The new PNG was placed by the operator at both canonical lockup paths
BEFORE this card, and both files are byte-identical (the app masthead and
the Sign In hero render the same lockup file content):

- `assets/branding/lockup-horizontal.png` (Sign In hero)
- `assets/branding/civic-discourse-logo.png` (app masthead)

## Aspect ratio change

| | old (gold) | new (duotone) |
|---|---|---|
| intrinsic size | 800 × 260 | 960 × 342 |
| aspect (w/h) | ≈ 3.077 | ≈ 2.807 |

The new lockup is **narrower per unit height** (taller proportionally), so
the rendered width at any given height is *smaller* than before. The
masthead + Sign In sizing helpers already cap height by the available
width on every band, so the narrower aspect can only *reduce* overflow
risk — every responsive viewport (320/360/390/414/768/1024/1280/1440)
stays width-safe with no body horizontal overflow.

Files carrying the aspect constant / pinned expectations were updated from
`800 / 260` to `960 / 342` (and the implied `≈ 3.077` → `≈ 2.807` in
comments / recomputed pixel figures):

- `src/components/AppHeader.tsx` — `LOGO_ASPECT_RATIO` + comments
  (`886` → `808` prominent width, `148` → `135` compact width).
- `src/features/auth/signInLockupModel.ts` — `SIGNIN_LOCKUP_ASPECT_RATIO`
  + doc comments (intrinsic height `260` → `342`).
- Test files pinning the aspect / recomputed pixels:
  `__tests__/appHeaderResponsiveLogo.test.ts` (fit `241` → `265`,
  threshold `≳ 910` → `≳ 832`), `__tests__/signInLockupModel.test.ts`
  (the `> 3` aspect floor relaxed to `> 2.5`),
  `__tests__/uxBrandAssets001SignInLockup.test.ts`,
  `__tests__/uxBrandAssets002GoldLockup.test.ts`,
  `__tests__/uxMobile003ResponsiveShellNavRail.test.ts`,
  `__tests__/uxMobile004CompactPhoneLogo.test.ts` (390-phone height
  `118` → `130`),
  `__tests__/uxRoomChrome001CompactHeaderAndMediatorReadout.test.tsx`.

A repo-wide scan confirms ZERO stale *active* `800/260` references remain
(the only surviving `800×260` mentions are intentional provenance comments
describing what the art was re-cut *from*).

## New freeze-guard test

`__tests__/quickBrandLockup002.test.ts`:

1. Both lockup PNGs are PNG, **960×342, colorType 6 (RGBA), bitDepth 8**
   (read directly from the IHDR), small editorial size, and byte-identical
   to each other.
2. The rendered aspect (`SIGNIN_LOCKUP_ASPECT_RATIO` + the AppHeader source
   constant + the masthead resolver behavior) is `960 / 342`.
3. **Favicon FREEZE:** `app.json` `expo.web.favicon` is still
   `./assets/branding/civildiscourse-favicon.png`; the favicon PNG is the
   unchanged **512×512** art; the native `expo.icon` /
   `android.adaptiveIcon.foregroundImage` / `splash.image` paths are
   untouched; and no icon/favicon was repointed at a lockup asset.

## Frozen (NOT touched)

- `app.json` (including `expo.web.favicon`).
- `assets/branding/civildiscourse-favicon.png` (512×512, byte-unchanged).
- Any favicon / `.ico` / apple-touch / manifest.
- Native icon / adaptive-icon / splash.
- App slug / package / domain / env.
- `assets/branding/civildiscourse-mark.png` (gold bird mark).
- No Sign In copy change; no room / mediator / board / submit change.
- No package install; `.tmp/` scratch tool is never staged.

## Doctrine self-check

No scoring, no truth/heat/popularity labels, no AI calls, no secrets, no
RLS / schema / Edge change. Pure brand-asset + aspect re-cut. All ten
`cdiscourse-doctrine` rules hold trivially (the change touches only the
rendered brand mark's proportions and the asset bytes).

## Gates (full suite, exit codes captured)

- `npm run typecheck` → exit 0
- `npm run lint -- --max-warnings 0` → exit 0
- `npm run test` → exit 0 (838 suites; 31748 passed + 1 pre-existing
  skipped = 31749 total)
- `npm run web:build` → exit 0 (both lockup PNGs bundle at the same
  content hash, confirming byte-identical; `dist/index.html` favicon link
  unchanged: `<link rel="icon" href="/favicon.ico" />`)
