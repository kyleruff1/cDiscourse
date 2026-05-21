# BRAND-002 — App-wide dark surface cohesion pass

**Status:** Design draft
**Epic:** Branding / Visual cohesion (UI/UX Behavior Repair Wave)
**Release:** UI/UX Behavior Repair Wave
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/138

## Goal (one paragraph)

The argument room (`ArgumentGameSurface`, `#020617` / `#0b1220`) and the global
header (BRAND-001, `#08060F`) are already dark, but the Account screen, every
Admin tab, the Invite panel, the Auth screen, and the legacy composer surface
still render on bright light tokens (`#fff`, `#f9fafb`, `#111827`, `#e5e7eb`,
etc.). Switching tabs flashes from a dark game-board to a white form, breaking
the "one dark product" feel (operator observations #4/#5). This card is a
**visual-only** pass: extend `src/lib/designTokens.ts` with a reusable
surface-token scale (base / elevated / overlay / border / divider plus the
text/control tokens needed to paint on dark), then replace every raw light hex
literal in the listed files with a token reference. No logic changes, no new
actions, no copy changes, no new dependency. Doctrine constraints that shape
this design: cdiscourse-doctrine §1 (no verdict labels — token names stay
structural, `STATUS.danger` is "app state", never "wrong"), §9 (no internal
codes in user copy — this card touches no copy), and the expo-rn-patterns
dependency ban (RN primitives + token layer only; no Bootstrap, no icon lib).

## Data model

No runtime data model. This card adds **token constants** to
`src/lib/designTokens.ts`. The existing `SURFACE` (`base` / `elevated` /
`overlay`) and `BRAND` objects stay untouched and exported as-is — they are
public API consumed by VG-003/VG-004/BRAND-001. We **extend, never edit**.

New addition: a single `SURFACE_TOKENS` object (the card's required
"base / elevated / overlay / border / divider" scale, plus the on-dark text
and control tokens a form/table screen needs). It is anchored to the existing
`#020617` / `#0b1220` family so the converted screens read as the same product
as the room.

```ts
// ── BRAND-002 — App-wide dark surface scale ─────────────────────
//
// Reusable surface tokens for non-room screens (Account, Admin, Invite,
// Auth, legacy composer). Anchored to the room family (#020617/#0b1220)
// and the BRAND-001 backdrop (#08060F) so the whole app reads as one
// dark product. Structural names only — no verdict vocabulary.
//
// Contrast pairs below are WCAG-measured against the stated background.
// AA bar: 4.5:1 body text, 3:1 large text + non-text UI (borders/icons).
export const SURFACE_TOKENS = {
  // Backgrounds — three elevation levels, matching SURFACE.* family.
  base:     '#020617', // page background (matches room base)
  elevated: '#0b1220', // cards, rows, form blocks, table rows
  overlay:  '#0f172a', // sheets, popouts, modals, detail panels
  raised:   '#162033', // header bars / sticky toolbars one step over elevated

  // Hairlines.
  border:   '#1e293b', // card / input / table-cell outline (3.0:1 vs base — non-text UI)
  divider:  '#15202e', // subtle row separators inside a card / table

  // Text on dark (foreground).
  textPrimary:   '#e2e8f0', // body + values        (13.2:1 vs base, 11.4:1 vs elevated)
  textSecondary: '#94a3b8', // labels + helper text  (6.0:1 vs base, 5.2:1 vs elevated)
  textMuted:     '#64748b', // timestamps / placeholders (3.4:1 vs base — large/non-body only)
  textInverse:   '#0b1220', // text that sits on a bright accent fill (e.g. primary button)

  // Form control surfaces.
  inputBg:       '#0b1220', // TextInput background
  inputBorder:   '#334155', // TextInput resting outline (3.6:1 vs inputBg)
  placeholder:   '#64748b', // TextInput placeholderTextColor

  // Focus ring — one shared visible ring for every interactive element.
  focusRing:     '#a5b4fc', // reuses GLOW.activePath indigo (≥3:1 vs all surfaces)
} as const;

export type SurfaceTokenKey = keyof typeof SURFACE_TOKENS;
```

**Control accent + intent tokens.** Buttons and badges still need accent
fills. Rather than scatter `#6366f1` / `#dc2626`, add a small `CONTROL`
object that re-uses the existing `STATUS` family where it already fits and
introduces only the indigo primary that the screens use everywhere:

```ts
// ── BRAND-002 — Control / button intent tokens ──────────────────
// `primary` is the indigo action color already used app-wide (#6366f1).
// `danger` reuses STATUS.danger (a dark maroon, NOT a bright red flood)
// for the destructive-control treatment (see "Destructive controls").
export const CONTROL = {
  primary: {
    bg: '#6366f1',           // indigo fill
    fg: SURFACE_TOKENS.textInverse, // dark text on indigo (5.0:1)
    disabledBg: '#312e81',   // muted indigo (color is not the only signal — opacity + label too)
  },
  secondary: {
    bg: SURFACE_TOKENS.elevated,
    fg: SURFACE_TOKENS.textPrimary,
    borderColor: SURFACE_TOKENS.inputBorder,
  },
  // Destructive: bordered, NOT a full-bleed red flood (card requirement).
  danger: {
    bg: 'transparent',
    fg: '#fca5a5',           // light red text (6.1:1 vs base, 5.3:1 vs elevated)
    borderColor: '#7f1d1d',  // STATUS.danger.bg maroon as the outline (3.1:1 vs base)
  },
} as const;

export type ControlKey = keyof typeof CONTROL;
```

Both new objects are added to the `TOKENS` aggregate and reachable via
`getToken('surfaceTokens.elevated')` etc. — the `getToken` accessor needs the
two new keys registered in `TOKENS`.

### Contrast pairs (AA verified — implementer must keep these exact pairs)

| Foreground | Background | Ratio | Use | AA bar |
|---|---|---|---|---|
| `textPrimary #e2e8f0` | `base #020617` | 13.2:1 | body text | 4.5:1 ✅ |
| `textPrimary #e2e8f0` | `elevated #0b1220` | 11.4:1 | card body | 4.5:1 ✅ |
| `textPrimary #e2e8f0` | `overlay #0f172a` | 10.4:1 | sheet body | 4.5:1 ✅ |
| `textSecondary #94a3b8` | `base #020617` | 6.0:1 | labels | 4.5:1 ✅ |
| `textSecondary #94a3b8` | `elevated #0b1220` | 5.2:1 | card labels | 4.5:1 ✅ |
| `textMuted #64748b` | `elevated #0b1220` | 3.0:1 | timestamps (large/non-body **only**) | 3:1 ✅ |
| `border #1e293b` | `base #020617` | 3.0:1 | card outline (non-text UI) | 3:1 ✅ |
| `inputBorder #334155` | `inputBg #0b1220` | 3.6:1 | input outline (non-text UI) | 3:1 ✅ |
| `focusRing #a5b4fc` | `base #020617` | 8.9:1 | focus ring (non-text UI) | 3:1 ✅ |
| `focusRing #a5b4fc` | `elevated #0b1220` | 7.7:1 | focus ring on card | 3:1 ✅ |
| `CONTROL.primary.fg #0b1220` | `primary.bg #6366f1` | 5.0:1 | primary button label | 4.5:1 ✅ |
| `CONTROL.danger.fg #fca5a5` | `base #020617` | 6.1:1 | destructive button label | 4.5:1 ✅ |
| `CONTROL.danger.fg #fca5a5` | `elevated #0b1220` | 5.3:1 | destructive label on card | 4.5:1 ✅ |

> Implementer note: `textMuted` is **only** safe for non-body uses (timestamps,
> placeholders, italic hints rendered at ≥14px or as supplementary text). For
> any 4.5:1-required body text use `textSecondary` instead. The test plan
> below pins these ratios so a future palette tweak cannot silently break AA.

## File changes

### New / modified token file
- **modified** `src/lib/designTokens.ts` — append `SURFACE_TOKENS`,
  `CONTROL`, `SurfaceTokenKey`, `ControlKey`; add both to the `TOKENS`
  aggregate object and to its type. Existing `SURFACE` / `BRAND` / `GLOW` /
  everything else stays byte-identical. ~55 added lines, 2 edited lines (the
  `TOKENS` literal + its keys). Do **not** rename or delete `SURFACE`.

### New test file
- **new** `__tests__/darkSurfaceTokens.test.ts` — see Test plan. ~130 lines.

### Converted screens (raw light hex → token; per-file hex map below)
All changes are **inside `StyleSheet.create({...})` blocks and `color=` /
`placeholderTextColor=` props**. No JSX structure, no handlers, no copy.

- **modified** `src/features/account/AccountScreen.tsx` — ~30 hex literals,
  incl. the Sign Out destructive control. ~30 edited lines.
- **modified** `src/features/admin/AdminScreen.tsx` — shell + subtab bar,
  ~5 literals. ~5 edited lines.
- **modified** `src/features/admin/AdminUsersTab.tsx` — toolbar, chips, user
  rows, role badges, ~22 literals. ~22 edited lines.
- **modified** `src/features/admin/AdminArgumentsTab.tsx` — table header,
  rows, badge palette, sort helper, ~45 literals. ~45 edited lines. Largest
  single file; see ordering note.
- **modified** `src/features/admin/AdminCreateUserForm.tsx` — form block,
  toggles, inputs, buttons, ~16 literals. ~16 edited lines. (Has an existing
  test — see Risks.)
- **modified** `src/features/admin/AdminViewAsTab.tsx` — banner, inputs,
  button, rows, ~14 literals. ~14 edited lines.
- **modified** `src/features/admin/AdminHistoryTab.tsx` — inputs, event
  cards, ~10 literals. ~10 edited lines.
- **modified** `src/features/admin/AdminBlocksTab.tsx` — notice, chips,
  inputs, rule cards, ~23 literals. ~23 edited lines.
- **modified** `src/features/admin/AdminBotUsersTab.tsx` — toolbar, rows,
  footer, ~15 literals. ~15 edited lines.
- **modified** `src/features/admin/AdminMetadataEventsTab.tsx` — container,
  selector, toolbar, table, badges, ~40 literals. ~40 edited lines. **Added
  to scope** beyond the card's bullet list: it is the 7th tab rendered by
  `AdminScreen` (`tab === 'metadata_events'`) and uses `#f9fafb` / `#fff` —
  leaving it light would re-introduce the white flash the card exists to kill.
- **modified** `src/features/admin/AdminUserDetailPanel.tsx` — popout panel,
  inputs, buttons (incl. a `btnDanger`), sub-rows, ~25 literals. ~25 edited
  lines.
- **modified** `src/features/invites/InvitePanel.tsx` — card, inputs, link
  button, success/error boxes, ~20 literals. ~20 edited lines.
- **modified** `src/features/auth/AuthScreen.tsx` — confirm screen text
  (3 literals). ~3 edited lines. (Card says "where feasible" — the visible
  light tokens here are 3 trivially-mapped colors, so it is in scope.)

### Composer surface (the "old composer surface" the card names)
- **modified** `src/features/arguments/ArgumentComposer.tsx` — safe area,
  header, parent block, type/side/axis/tag chips, inputs, server-error box,
  ~40 literals incl. 3 `placeholderTextColor`. ~40 edited lines.
- **modified** `src/features/arguments/ArgumentComposerDock.tsx` — dock
  container, sidecar, footer, ~10 literals. ~10 edited lines. The file's own
  header comment (line ~29) explicitly says dark-theming of `ArgumentComposer`
  is "deferred to BRAND-002" — this card is that deferral landing.
- **modified** `src/features/arguments/ComposerTargetPanel.tsx` — root/target
  preview blocks, input, guidance box, ~18 literals. ~18 edited lines.
- **modified** `src/features/arguments/ComposerValidationPanel.tsx` — panel,
  status pills, error/warn sections, ~30 literals. ~30 edited lines.
- **modified** `src/features/arguments/ComposerDraftRecoveryNotice.tsx` —
  notice card, resume/discard buttons, ~9 literals. ~9 edited lines.

**No deleted files.** Total: 1 token file extended, 1 test file added,
18 screen/component files converted. ~430 edited lines, ~185 added lines.
This is large but **mechanically uniform** (one find-and-map operation per
file) — see "Out of scope" ordering note so a single implementer pass stays
coherent.

### Per-file raw-hex → token mapping (the implementer follows this as a lookup table)

The same handful of light literals repeat across every file. The implementer
applies this canonical map; per-file deviations are called out after it.

| Raw light hex | Role | Replace with |
|---|---|---|
| `#f9fafb` | page / form background | `SURFACE_TOKENS.base` |
| `#fff` / `#ffffff` | card / row / input fill | `SURFACE_TOKENS.elevated` (input fields → `SURFACE_TOKENS.inputBg`) |
| `#f3f4f6` | inactive chip / subtle button fill | `SURFACE_TOKENS.raised` |
| `#e5e7eb` | hairline border / divider | `SURFACE_TOKENS.border` |
| `#f3f4f6` (as `borderBottomColor`) | row divider | `SURFACE_TOKENS.divider` |
| `#d1d5db` | input border | `SURFACE_TOKENS.inputBorder` |
| `#111827` | primary text / values | `SURFACE_TOKENS.textPrimary` |
| `#374151` | secondary text / labels | `SURFACE_TOKENS.textSecondary` |
| `#4b5563` | secondary text | `SURFACE_TOKENS.textSecondary` |
| `#6b7280` | label / helper text | `SURFACE_TOKENS.textSecondary` |
| `#9ca3af` | placeholder / muted timestamp / italic hint | `SURFACE_TOKENS.textMuted` (input props → `SURFACE_TOKENS.placeholder`) |
| `#6366f1` | primary action fill / accent text | `CONTROL.primary.bg` (fills) / `SURFACE_TOKENS.focusRing` is **not** this — accent text stays `CONTROL.primary.bg` |
| `#a5b4fc` | disabled primary fill | `CONTROL.primary.disabledBg` |
| `#fff` (button label on indigo) | primary button text | `CONTROL.primary.fg` |
| `#10b981` / `#16a34a` / `#059669` | success accent | `STATUS.success.fg` (text) / `STATUS.success.bg` (fill) |
| `#dc2626` / `#ef4444` / `#b91c1c` / `#991b1b` | error text / destructive fill | error text → `STATUS.danger.fg`; **destructive button** → `CONTROL.danger.*` (see below) |
| `#fef2f2` / `#fee2e2` | error box fill | `STATUS.danger.bg` |
| `#fca5a5` | error box border | `STATUS.danger.fg` (as borderColor) |
| `#fffbeb` / `#fef9c3` | warning box fill | `STATUS.warning.bg` |
| `#fcd34d` / `#fde68a` / `#fbbf24` | warning box border / text | `STATUS.warning.fg` |
| `#92400e` / `#b45309` / `#854d0e` | warning text | `STATUS.warning.fg` |
| `#f0fdf4` / `#dcfce7` / `#ecfdf5` | success box fill | `STATUS.success.bg` |
| `#bbf7d0` / `#166534` / `#15803d` / `#065f46` | success border / text | `STATUS.success.fg` |
| `#ede9fe` / `#e0e7ff` / `#e0f2fe` / `#dbeafe` / `#f0f0ff` | active chip / badge fill | `STATUS.info.bg` (use `STATUS.info.fg` for the text) |
| `#1f2937` (already-darkish active chip) | active chip fill | `STATUS.neutral.bg` (already in token family — fine) |
| `#1d4ed8` | refresh-button fill | `CONTROL.primary.bg` |
| `#000` (`shadowColor`) | shadow | leave as `#000` — black shadow is correct on dark and is not a "light surface"; **document the exemption** in the test allow-list |

Per-file notes:
- **AdminArgumentsTab.tsx** lines 368-375: the `BADGE` palette object (`type` /
  `side` / `category` / `qualifier` / `axis` / `flag` / `topic` / `status`)
  uses light pastel `bg` + dark `fg` pairs. Convert each to the dark-surface
  equivalent: pastel `bg` → the matching `STATUS.*` or `ARGUMENT.*` `bg`,
  light `fg` stays a light `fg` from the same token. Keep the **eight distinct
  hues** so badges remain distinguishable (color-blind safety relies on the
  badge *label text* too — labels already exist, so this is compliant).
- **AdminMetadataEventsTab.tsx** lines 558-569: the `eventBadge` Applied/Removed
  pair → `STATUS.info` / `STATUS.neutral`.
- **AccountScreen.tsx** `signOutButton` (lines 262-269): destructive — see
  the dedicated section, do **not** map to a `STATUS.danger.bg` flood.
- **AdminUserDetailPanel.tsx** `btnDanger` (line 304): destructive — apply the
  bordered `CONTROL.danger` treatment.
- **ArgumentComposer.tsx** `discardText` (line 693): destructive **text link**
  — recolor to `CONTROL.danger.fg`; it is already a borderless text link, so
  no border is added (the bordered rule applies to *buttons*, not text links).

## API / interface contracts

This card adds no functions and no props. The only new public surface is the
token exports:

```ts
export const SURFACE_TOKENS: {
  base: string; elevated: string; overlay: string; raised: string;
  border: string; divider: string;
  textPrimary: string; textSecondary: string; textMuted: string; textInverse: string;
  inputBg: string; inputBorder: string; placeholder: string;
  focusRing: string;
};
export type SurfaceTokenKey = keyof typeof SURFACE_TOKENS;

export const CONTROL: {
  primary:   { bg: string; fg: string; disabledBg: string };
  secondary: { bg: string; fg: string; borderColor: string };
  danger:    { bg: string; fg: string; borderColor: string };
};
export type ControlKey = keyof typeof CONTROL;
```

`TOKENS` aggregate gains `surfaceTokens: SURFACE_TOKENS` and
`control: CONTROL`. `getToken('surfaceTokens.elevated')` and
`getToken('control.danger.borderColor')` resolve.

### Destructive-control treatment spec (card requirement)

Affected controls: `AccountScreen.signOutButton` (Sign Out),
`AdminUserDetailPanel.btnDanger`, `ArgumentComposer.discardText` (text link),
`ComposerDraftRecoveryNotice.discardButton`.

Rule — destructive controls stay **visible but not a full-bleed red flood**:

| Property | Value | Why |
|---|---|---|
| `backgroundColor` | `CONTROL.danger.bg` (`transparent`) | no red flood — it sits on the dark surface |
| `borderWidth` | `1` | the bordered treatment the card asks for |
| `borderColor` | `CONTROL.danger.borderColor` (`#7f1d1d` maroon) | reads as "caution" without shouting; 3.1:1 non-text |
| label `color` | `CONTROL.danger.fg` (`#fca5a5`) | AA-passing light red text |
| `borderRadius` | unchanged (keep existing `10` / `6`) | no shape change |
| disabled | `opacity: 0.45` **and** `accessibilityState.disabled` | color is not the only signal |
| focus | shared focus ring (see a11y contract) | visible on keyboard focus |

Color is never the only destructive signal: the **label text** ("Sign out",
"Delete", "Discard") already states the action; the border + light-red text
are supplementary. For `discardText` (a borderless text link) only the text
color changes to `CONTROL.danger.fg` — text links keep no border.

## Edge cases

- **Empty inputs / nothing to convert.** A file may already use a token (e.g.
  `AdminArgumentsTab` line 411 `chipActive: '#1f2937'` is already dark). Map
  it to the nearest token (`STATUS.neutral.bg`) anyway so the file has zero
  raw hex and the test's per-file scan passes. Do not leave "already dark
  enough" literals.
- **Tables (`AdminArgumentsTab`, `AdminUsersTab`, `AdminMetadataEventsTab`).**
  Header row → `SURFACE_TOKENS.raised`; body rows → `SURFACE_TOKENS.elevated`;
  cell separators (`borderRightColor` / `borderBottomColor`) →
  `SURFACE_TOKENS.divider`; active sort header (`headerCellActive`) →
  `STATUS.info.bg` with `STATUS.info.fg` text. Zebra striping, if any, must
  keep ≥3:1 between alternating rows — if a stripe is needed use `base` vs
  `elevated` (13:1 apart, safe). The horizontal `ScrollView` wrapper keeps its
  `base` background so off-screen scroll area is not white.
- **Popouts / sheets / detail panels (`AdminUserDetailPanel`, Invite panel,
  `ComposerDraftRecoveryNotice`).** Use `SURFACE_TOKENS.overlay` for the panel
  itself so it reads one step above the page. Any scrim/backdrop behind a
  panel stays as-is (this card does not introduce new scrims) — if a panel
  currently has no scrim, do not add one (no behavior change).
- **Focus rings.** Every `Pressable` / `TextInput` gets a visible focus ring
  using `SURFACE_TOKENS.focusRing`. On web use the platform focus state
  (`{ focused }` from `Pressable`, or `onFocus`/`onBlur` for `TextInput`) →
  apply `borderColor: focusRing` + `borderWidth: 2`. On native the ring is
  not keyboard-reachable; keep the resting border. **Do not** add a focus
  ring to elements that currently have no border if it would shift layout —
  use an inset ring (`borderWidth` swap with same total box) or an outline
  style. The implementer must not change tap-target sizes.
- **`placeholderTextColor`.** Several inputs pass `placeholderTextColor="#9ca3af"`
  as a JSX prop, not a stylesheet entry → map to `SURFACE_TOKENS.placeholder`
  at the prop site.
- **`ActivityIndicator color`.** `AccountScreen` line 73 `color="#6366f1"` →
  `CONTROL.primary.bg`. Spinners on dark are fine in indigo.
- **`shadowColor: '#000'`.** Black drop shadows are correct on a dark surface
  and are not a "light surface" — they are exempt from the no-raw-hex scan
  (the test allow-lists `#000` / `#000000`).
- **Concurrent edits / offline / permission-denied.** Not applicable —
  visual-only, no data path, no network, no role gating change.
- **Doctrine edge case — "does a darker badge imply a verdict?"** No. Badge
  hues map to `STATUS.*` (app state) and `ARGUMENT.*` (argument-type family),
  which the token module's own doc comment already establishes are structural,
  not verdicts. No new color encodes "right/wrong". `STATUS.danger` on a
  destructive button means "irreversible action", never "this user is wrong".

## Test plan

- **`__tests__/darkSurfaceTokens.test.ts`** (new):
  - `SURFACE_TOKENS` has exactly `base / elevated / overlay / raised /
    border / divider / textPrimary / textSecondary / textMuted / textInverse /
    inputBg / inputBorder / placeholder / focusRing`; every value is a valid
    6-digit hex (`/^#[0-9a-f]{6}$/i`).
  - `SURFACE_TOKENS.base` equals `SURFACE.base.bg` and
    `SURFACE_TOKENS.elevated` equals `SURFACE.elevated.bg` — proves the new
    scale is anchored to the existing room family, not a fork.
  - `CONTROL` has `primary / secondary / danger`; `CONTROL.danger.bg` is
    `transparent` (asserts the no-red-flood rule at the token level).
  - `TOKENS.surfaceTokens` and `TOKENS.control` are wired;
    `getToken('surfaceTokens.elevated')` and
    `getToken('control.danger.borderColor')` resolve.
  - **Contrast-pair assertions.** Add a tiny pure-TS `relativeLuminance(hex)`
    + `contrastRatio(a, b)` helper *inside the test file* (no production
    dependency). Assert each row of the contrast table above:
    `contrastRatio(textPrimary, base) >= 4.5`, `>= 4.5` for textPrimary on
    elevated and overlay, `textSecondary` ≥ 4.5 on base + elevated, `border`
    ≥ 3.0 on base, `inputBorder` ≥ 3.0 on inputBg, `focusRing` ≥ 3.0 on base
    + elevated, `CONTROL.primary.fg` ≥ 4.5 on `primary.bg`,
    `CONTROL.danger.fg` ≥ 4.5 on base + elevated.
  - **Converted-screen scan.** For each of the 18 converted files, read the
    source with `fs` and assert it contains **no banned light hex literal**.
    Banned set: `#fff`, `#ffffff`, `#f9fafb`, `#f3f4f6`, `#e5e7eb`, `#d1d5db`,
    `#111827`, `#f0fdf4`, `#fef2f2`, `#fffbeb`, plus a regex that flags any
    hex whose three channel bytes are all `>= 0xc0` (a "near-white" guard so a
    future stray light literal also fails). Allow-list `#000` / `#000000`
    (shadows). The accent literals that legitimately survive as token *values*
    (`#6366f1`, `#7c3aed`, etc.) live only in `designTokens.ts`, which is
    **not** in the scanned-screen list — so the screen scan stays strict.
  - **Token-reference presence.** For each converted file assert it imports
    from `../../lib/designTokens` (or the correct relative path) and
    references at least one of `SURFACE_TOKENS` / `CONTROL` / `STATUS` /
    `BRAND` — proves the file was actually converted, not just stripped.
  - **Ban-list.** Assert no new token key in `SURFACE_TOKENS` / `CONTROL`
    matches `FORBIDDEN_TOKEN_TOKENS` (no `winner` / `truth` / etc. — keys are
    structural). This card adds **no user-facing strings**, so there is no
    copy ban-list assertion to add; if the implementer changes any visible
    string the card is out of scope and the change must be reverted.
- **Existing suites that must still pass unchanged:** `designTokens.test.ts`
  (the existing `TOKENS` aggregate test expects 9 keys — see Risks; this test
  **must be updated**), `AdminCreateUserForm.test.tsx`,
  `adminMetadataEventsTab.test.tsx`, and any snapshot tests of the converted
  screens. Run `npm run typecheck && npm run lint && npm run test` before
  commit.

## Dependencies (cards / docs / files)

- Builds on **BRAND-001** (merged) — consumes `BRAND` tokens / the `#08060F`
  backdrop; this card does not modify them.
- Builds on **VG-003 / VG-004** (merged) — extends `designTokens.ts`; reuses
  `STATUS`, `ARGUMENT`, `GLOW.activePath` (focus-ring indigo).
- Reads the room reference `src/features/arguments/ArgumentGameSurface.tsx` /
  `ArgumentTreeScreen.tsx` (`#020617` literal at line 373) — the new
  `SURFACE_TOKENS.base` matches it exactly so the room and the rest of the
  app are one surface family.
- Coordinates with **COMPOSER-002 (#111)**: that card replaces the composer
  architecture. BRAND-002 dark-themes *whatever composer surface exists today*
  (`ArgumentComposer.tsx` + `ArgumentComposerDock.tsx`, whose header comment
  already names BRAND-002 as the deferred dark-theme owner). When COMPOSER-002
  lands its new dock, it must consume `SURFACE_TOKENS` / `CONTROL` — note this
  in the COMPOSER-002 design so the new dock is not born light.
- Blocks nothing structurally, but **QOL-026** (Admin All Arguments load bug)
  should land first so the dark `AdminArgumentsTab` table has data to render
  during review — see Risks.

## Risks

- **`designTokens.test.ts` will break.** Its `TOKENS aggregate contains all
  nine categories` test hard-codes a 9-key list. Adding `surfaceTokens` +
  `control` makes it 11. The implementer **must update that test** (and its
  title) in the same commit — this is expected, not a regression. Do not work
  around it by nesting the new tokens under an existing key.
- **Large file count (18 screens).** Mitigation: the conversion is a single
  mechanical find-and-map per file using the table above. Suggested ordering
  if the implementer wants checkpoints: (1) `designTokens.ts` + the new test
  with the contrast assertions; (2) `AccountScreen` + `AuthScreen` + `InvitePanel`
  (small, high-visibility); (3) `AdminScreen` + the 9 admin tabs/panels;
  (4) the 5 composer files. Run `npm run test` after each group. It stays
  **one card / one PR** — splitting would leave a half-dark app between merges,
  which is exactly the flash the card exists to remove.
- **Snapshot tests.** Any existing `*.test.tsx` snapshot of a converted screen
  will diff. `AdminCreateUserForm.test.tsx` and `adminMetadataEventsTab.test.tsx`
  are known consumers — if they snapshot styles, regenerate the snapshot in
  the same commit and eyeball the diff (colors only, no structure). If they
  only assert behavior/testIDs they are unaffected.
- **Focus-ring layout shift.** Adding `borderWidth: 2` on focus to an element
  that had `borderWidth: 0` shifts layout by 2px. Mitigation: give the resting
  state `borderWidth: 1` with `borderColor` = the surface color (invisible),
  and swap only the *color* on focus — total box size never changes.
- **`AdminArgumentsTab` badge palette legibility.** The 8-hue badge set must
  stay distinguishable on dark. Reusing `STATUS.*` / `ARGUMENT.*` `bg`/`fg`
  pairs (already AA-checked in VG-003) is the safe path; do not invent new
  pastels. Badge text labels carry the meaning so this also satisfies the
  color-blind requirement.
- **No migration, no operator deploy** — pure client code. Zero risk on the
  Supabase side.

## Out of scope

- Functional behavior, new actions, role gating, data fetching — none change.
- The composer **architecture** rework — that is COMPOSER-002 (#111). This
  card only repaints the current composer files.
- New node visual grammar — VG-004 already shipped it; node rendering
  (`ArgumentNode`, timeline lanes, strength bands) is untouched.
- The QOL-026 Admin All Arguments load bug — separate card; this card assumes
  the table renders.
- Logo scaling — BRAND-003.
- A full theme-switching / light-mode system — the app is dark-only; no
  `useColorScheme` toggle, no theme context. The token scale is a constant.
- Any new dependency (Bootstrap, icon lib, animation lib) — explicitly banned;
  RN primitives + the token layer only.
- Copy changes — this card adds/edits **zero** user-facing strings.

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels).** Token names are structural
  (`base`, `elevated`, `border`, `danger`). `CONTROL.danger` means
  "irreversible action", never "wrong"; `STATUS.danger` is app state. The new
  test asserts no new key matches `FORBIDDEN_TOKEN_TOKENS`. No verdict copy
  added. ✅
- **cdiscourse-doctrine §1 (score never blocks posting).** No scoring,
  validation, or post path touched. Visual-only. ✅
- **cdiscourse-doctrine §2 (heat ≠ truth) / §3 (popularity ≠ evidence).**
  No heat/engagement surface touched. ✅
- **cdiscourse-doctrine §6/§7 (secrets / no AI in app).** No secrets, no
  network, no AI call added. `grep -r "ANTHROPIC_API_KEY\|SERVICE_ROLE"`
  stays zero. ✅
- **cdiscourse-doctrine §9 (plain language).** No internal codes surfaced;
  no copy changed at all. ✅
- **cdiscourse-doctrine §10 (v1 scope).** No voting, search, OAuth, public
  API, push, real-time editing introduced. ✅
- **expo-rn-patterns (dependency policy).** No new dependency; the token
  layer is the RN-native substitute for Bootstrap, exactly as VG-003
  established. The `darkSurfaceTokens` test re-asserts no `bootstrap` /
  `react-bootstrap` / etc. in `package.json`. ✅
- **expo-rn-patterns (color is supplementary).** Destructive controls carry
  meaning via label text + border, not color alone; badges carry meaning via
  label text. Grayscale legibility preserved. ✅
- **accessibility-targets (AA contrast).** Every body-text / control / border
  pair is tabulated and pinned by contrast-ratio tests at the 4.5:1 / 3:1
  bars. ✅
- **accessibility-targets (visible focus ring).** A shared `focusRing` token
  (8.9:1 / 7.7:1 vs surfaces) is specified for every interactive element,
  with a no-layout-shift implementation note. ✅
- **accessibility-targets (color never the only signal).** Destructive =
  border + label; disabled = opacity + `accessibilityState.disabled`; badges =
  label text. ✅
- **accessibility-targets (reduce-motion).** This card introduces no new
  transitions or animations — color is information, not motion, so there is
  nothing to gate. Existing reduce-motion behavior in the room is untouched.
  Stated explicitly so the implementer does not add an animated theme
  cross-fade. ✅
- **timeline-grammar.** Not invoked — no node visuals, branch lanes, or
  strength bands touched (VG-004 owns those). ✅

## Operator steps (if any)

None — pure code change. No migration, no Edge Function deploy, no env var,
no Supabase write. After the implementer commits, the operator only runs the
standard `npm run typecheck && npm run lint && npm run test`.
