# QUICK-BRAND-LOCKUP-003 — isolated b/w bird + larger gold wordmark

Issue #724. Aspect-ratio + test-wiring card only. The new lockup asset was
already placed by the operator; this card commits it and re-points the two
aspect constants (plus every test that pins them).

## What changed

The operator re-cut the horizontal CivilDiscourse lockup from the
QUICK-BRAND-LOCKUP-002 gold/cream duotone **960×342** art to an **isolated
black/white bird + a LARGER gold wordmark** (the full "C" is preserved) with
the gold glow, exported at **1400×331** 8-bit RGBA (PNG colorType 6). Both
`assets/branding/lockup-horizontal.png` (Sign In hero) and
`assets/branding/civic-discourse-logo.png` (app masthead) are the same art,
byte-identical (235,931 bytes each).

## Aspect change

| | before (002) | after (003) |
|---|---|---|
| intrinsic size | 960 × 342 | 1400 × 331 |
| aspect (w / h) | ≈ 2.807 | ≈ 4.230 |

Every active `960 / 342` (and `≈ 2.807`) reference is updated to `1400 / 331`
(`≈ 4.230`). The two source constants:

- `src/components/AppHeader.tsx` — `LOGO_ASPECT_RATIO = 1400 / 331`
- `src/features/auth/signInLockupModel.ts` — `SIGNIN_LOCKUP_ASPECT_RATIO = 1400 / 331`

Provenance comments that describe the 002 history (e.g. "was 960/342 ≈ 2.807")
are intentionally kept.

## Prominent-288 masthead threshold: 1024 → 1280 (correct, NOT a weakening)

`resolveMastheadLogoHeightPx` is **unchanged** — its
`min(PROMINENT_288, widthFit)` is already correct (prominent height where it
physically fits; width-fit otherwise so it can never overflow).

The wider aspect simply moves the viewport at which the prominent 288 px height
fits:

- rendered prominent width = `288 × 4.230 ≈ 1218 px`, needing
  `available ≥ 1218` i.e. viewport ≳ 1242 px.
- At viewport **1280**: available = 1256, `widthFit = floor(1256 / 4.230) = 296`
  → `min(288, 296) = 288` ✓ (prominent honored).
- At viewport **1024**: available = 1000, `widthFit = floor(1000 / 4.230) = 236`
  → `min(288, 236) = 236` (the logo width-fits below 288 — correct, no overflow).

So any test that pinned the prominent 288 at **1024** is updated to **1280**.
This is a "prominent-where-it-fits" threshold update, not a relaxation: every
no-overflow assertion (`height × aspect ≤ available width`) is retained and
still passes, and the resolver constants (`PROMINENT 288`, `MIN_PHONE 64`,
`MAX_PHONE 160`, compact 48, header budget 24) and logic are untouched.

Phone is unaffected: at 320, `widthFit = floor(296 / 4.230) = 69 ≥ 64` floor →
returns 69; `69 × 4.230 ≈ 292 ≤ 320`, no overflow. The phone-floor test (≥64)
still passes.

## Tests

- `__tests__/quickBrandLockup002.test.ts` — dimension assertions 960×342 →
  1400×331 (IHDR), aspect → 1400/331, 390-phone width-fit 130 → 86, size
  ceiling 200 KB → 500 KB (the new art is 236 KB; still rules out the 2.3 MB
  scene). colorType-6 RGBA, byte-identical, and favicon-FREEZE assertions kept.
- `__tests__/quickBrandLockup003.test.ts` — NEW card-named authoritative guard:
  1400×331 RGBA + byte-identical, aspect 1400/331, the prominent-288 threshold
  (1280 → 288, 1024 → < 288) with no-overflow at every band, the phone floor,
  and the favicon/native FREEZE.
- `appHeaderResponsiveLogo.test.ts`, `signInLockupModel.test.ts`,
  `uxBrandAssets001SignInLockup.test.ts`, `uxBrandAssets002GoldLockup.test.ts`,
  `uxMobile003ResponsiveShellNavRail.test.ts`,
  `uxMobile004CompactPhoneLogo.test.ts`,
  `uxRoomChrome001CompactHeaderAndMediatorReadout.test.tsx` — ASPECT constants,
  the prominent-288-at-1024 → 1280 pins, the 390-phone width-fit value, and the
  asset size ceilings updated to reflect the new aspect. No assertion weakened
  beyond reflecting the correct new-aspect values.

## FROZEN (unchanged, verified zero-diff vs main)

`app.json` (incl. `expo.web.favicon`), `assets/branding/civildiscourse-favicon.png`
(512×512), the native icon / adaptive-icon / splash paths,
`assets/branding/civildiscourse-mark.png` (420×315), app slug / package /
domain / env. No resolver-logic change, no Sign In copy / room / mediator /
board / submit change, no dependency install.

## Gates

`npm run typecheck` (exit 0), `npm run lint -- --max-warnings 0` (exit 0),
`npm run test` (exit 1 only from the documented LIFE-001 wall-clock full-suite
flake; passes isolated; not in this diff — otherwise 31760 passed / 1 skipped /
839 suites), `npm run web:build` (exit 0; both lockups bundle at one shared
content hash, favicon path unchanged in dist). No body horizontal overflow at
320 / 360 / 390 / 414 / 768 / 1024 (resolver guarantees height × aspect ≤
available width).

## Doctrine

No scoring / AI / secrets / RLS / Edge surface touched. The lockup is a brand
asset; nothing implies truth, heat, popularity, or a verdict. The rules engine
is untouched.
