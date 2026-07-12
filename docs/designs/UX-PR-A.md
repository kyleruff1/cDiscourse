# UX-PR-A — dark-theme shared components + Button→CONTROL (front-door contrast fix)

**Status:** Design draft
**Epic:** Style-system adoption / a11y conformance (UX continuity audit 2026-07 — `UX_ACTION_PLAN` PR-A)
**Release:** UX continuity remediation (PR-A lane; P0-1 front-door a11y + P1-3 Button)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/916

---

## Goal (one paragraph)

The mature `src/lib/designTokens.ts` layer (BRAND-001 / BRAND-002 / UX-BRAND-001) already ships a full dark token system, but a body of **pre-era light-theme shared components** still paints light-mode hexes while rendering on the dark `#08060F` shell — a two-generation adoption drift, not a token-system gap. On the **auth front door** (the first screen every new user meets), `TextInputField` labels compute to ~1.9:1 on `#08060F` — effectively invisible. PR-A re-skins the drifted shared components onto the existing tokens (colors only — no new tokens, no props/layout/typography change) and points `Button`'s `primary` + `danger` variants at `CONTROL.*` so the primary label clears the 4.5:1 AA bar and the destructive control stops being a full-bleed red flood. A **grep-guard test** bans the gray/light hex family inside `src/components/` so the drift cannot regress. This card is governed by `cdiscourse-doctrine` §1 (color is structural state, never a verdict), `accessibility-targets` (WCAG AA: 4.5:1 body, 3:1 non-text, color is never the only signal), and `expo-rn-patterns` (reuse the token layer; no new deps).

**Scope-reality-audit correction (read before implementing):** the issue brief and the launch prompt both assert that Button's `secondary` variant "was fixed to point at `CONTROL.secondary`." **That is not what the file does.** `Button.tsx:71,77` point `secondary` at `BRAND.accent.goldBorder` + `BRAND.text.primary` (a UX-BRAND-001 premium ghost button), and `__tests__/uxBrand001GoldAccent.test.ts:97-100` **pins those exact references**. Therefore:
- **Do NOT touch the `secondary` variant.** Changing it to `CONTROL.secondary` would break a shipped pin.
- The "mirror the precedent" instruction means mirror the **mechanical pattern** (reference a token object's fields inside the `StyleSheet` instead of a raw hex), sourcing `primary` from `CONTROL.primary` and `danger` from `CONTROL.danger` per the issue's explicit direction and the `designTokens.ts:426-451` doc.

---

## Data model

**No new data model. No new tokens.** PR-A only remaps existing color literals in six component files onto tokens that already ship in `src/lib/designTokens.ts`:

| Token group (existing) | Members consumed | Source |
|---|---|---|
| `SURFACE_TOKENS` | `inputBg #0b1220`, `inputBorder #334155`, `placeholder #64748b`, `textPrimary #e2e8f0`, `textSecondary #94a3b8`, `textMuted #64748b`, `base #020617`, `elevated #0b1220`, `raised #162033`, `border #1e293b`, `focusRing #a5b4fc` | BRAND-002 |
| `STATUS.danger` | `bg #7f1d1d`, `fg #fecaca` | VG-003 |
| `CONTROL.primary` | `bg #4f46e5`, `fg #ffffff` | BRAND-002 |
| `CONTROL.danger` | `bg 'transparent'`, `fg #fca5a5`, `borderColor #7f1d1d` | BRAND-002 |
| `BRAND.text.primary` | `#F5EDE0` (unchanged, secondary spinner only) | BRAND-001 |

`designTokens.ts` itself is **not edited** (it is `requiredApi`-pinned by `uxOneOneSixReadOnlyBoundary.test.ts:67-78`; additive tokens are PR-E's job). Because PR-A references existing tokens by name and never edits the token file, that pin holds automatically.

---

## The re-skin map (component × light literal → existing token)

All contrast ratios below are **WCAG 2.x, measured against the real shell `#08060F` (`BRAND.surface.app.bg`)** unless the row states a different backdrop (input internals sit on `inputBg #0b1220`; error text sits on `STATUS.danger.bg #7f1d1d`; the primary button label sits on `CONTROL.primary.bg #4f46e5`). AA bar: 4.5:1 body text, 3:1 non-text/large. Decorative hairlines carry no ratio bar per WCAG 1.4.11 (see `darkSurfaceTokens.test.ts:192-222`).

### 1. `src/components/TextInputField.tsx`

| Style / prop (line) | Before | → token | After value | Contrast (backdrop) | Verdict |
|---|---|---|---|---|---|
| `label.color` (50) | `#374151` | `SURFACE_TOKENS.textSecondary` | `#94a3b8` | **7.85:1** (#08060F) | AA pass (body) — fixes the ~1.9:1 front-door defect |
| `input.borderColor` (53) | `#d1d5db` | `SURFACE_TOKENS.inputBorder` | `#334155` | decorative hairline (lighter-than-inputBg; no 3:1 bar) | pass |
| `input.color` (58) | `#111827` | `SURFACE_TOKENS.textPrimary` | `#e2e8f0` | **15.19:1** (#0b1220) | AA pass |
| `input.backgroundColor` (59) | `#fff` | `SURFACE_TOKENS.inputBg` | `#0b1220` | surface | pass |
| `placeholderTextColor` prop (35) | `#9ca3af` | `SURFACE_TOKENS.placeholder` | `#64748b` | **3.93:1** (#0b1220) | placeholder (exempt from body AA; clears 3:1) |
| `inputDisabled.backgroundColor` (62) | `#f9fafb` | `SURFACE_TOKENS.base` | `#020617` | recessed disabled surface | pass |
| `inputDisabled.color` (62) | `#6b7280` | `SURFACE_TOKENS.textMuted` | `#64748b` | 4.24:1 (#020617) | disabled text (exempt from AA) |
| `inputError.borderColor` (63) | `#ef4444` | `STATUS.danger.fg` | `#fecaca` | error accent (meaning also carried by error text below) | pass |
| `error.color` (64) | `#ef4444` | `STATUS.danger.fg` | `#fecaca` | **13.91:1** (#08060F) | AA pass |

Import to add: `import { SURFACE_TOKENS, STATUS } from '../lib/designTokens';`

### 2. `src/components/ErrorNotice.tsx`

| Style (line) | Before | → token | After value | Contrast | Verdict |
|---|---|---|---|---|---|
| `container.backgroundColor` (18) | `#fef2f2` | `STATUS.danger.bg` | `#7f1d1d` | filled danger status surface (dark maroon, NOT a bright flood) | pass |
| `container.borderColor` (20) | `#fecaca` | `STATUS.danger.fg` | `#fecaca` | outline hairline | pass |
| `message.color` (25) | `#991b1b` | `STATUS.danger.fg` | `#fecaca` | **6.93:1** (on `#7f1d1d`) | AA pass |

Import to add: `import { STATUS } from '../lib/designTokens';`

### 3. `src/components/EmptyState.tsx`

| Style (line) | Before | → token | After value | Contrast (#08060F) | Verdict |
|---|---|---|---|---|---|
| `title.color` (28) | `#111827` | `SURFACE_TOKENS.textPrimary` | `#e2e8f0` | **16.33:1** | AA pass |
| `body.color` (29) | `#6b7280` | `SURFACE_TOKENS.textSecondary` | `#94a3b8` | **7.85:1** | AA pass |

Import to add: `import { SURFACE_TOKENS } from '../lib/designTokens';`

### 4. `src/features/debates/CreateDebateForm.tsx`

Color is never the only selection signal here — the `● / ○` glyph (shape) + `fontWeight 700/500` (weight) both carry selected state, and `CreateDebateForm.visibility.test.tsx:61` already pins that. My mapping preserves both, so color-independence holds.

| Style (line) | Before | → token | After value | Contrast | Verdict |
|---|---|---|---|---|---|
| `visibilityGroupLabel.color` (155) | `#444` | `SURFACE_TOKENS.textSecondary` | `#94a3b8` | 7.85:1 (#08060F) | AA pass |
| `visibilityOption.borderColor` (166) | `#ddd` | `SURFACE_TOKENS.border` | `#1e293b` | decorative card hairline | pass |
| `visibilityOption.backgroundColor` (167) | `#fafafa` | `SURFACE_TOKENS.elevated` | `#0b1220` | card surface | pass |
| `visibilityOptionSelected.borderColor` (171) | `#444` | `SURFACE_TOKENS.focusRing` | `#a5b4fc` | 9.39:1 (on `#0b1220`) | selected outline (3:1 pass) |
| `visibilityOptionSelected.backgroundColor` (173) | `#f4f4f4` | `SURFACE_TOKENS.raised` | `#162033` | selected surface (one step up) | pass |
| `visibilityCheck.color` (182) | `#888` | `SURFACE_TOKENS.textMuted` | `#64748b` | 4.23:1 (#08060F) | `○` glyph (large/non-body; 3:1 pass) |
| `visibilityCheckOn.color` (185) | `#222` | `SURFACE_TOKENS.textPrimary` | `#e2e8f0` | 16.33:1 (#08060F) | `●` glyph high-contrast |
| `visibilityLabel.color` (190) | `#444` | `SURFACE_TOKENS.textSecondary` | `#94a3b8` | 7.30:1 (on `#0b1220`) | AA pass |
| `visibilityLabelSelected.color` (194) | `#222` | `SURFACE_TOKENS.textPrimary` | `#e2e8f0` | 13.22:1 (on `#162033`) | AA pass |
| `visibilityHelper.color` (198) | `#666` | `SURFACE_TOKENS.textSecondary` | `#94a3b8` | 7.85:1 (#08060F) | AA pass (12px body → 4.5 bar) |

Import to add: `import { SURFACE_TOKENS } from '../../lib/designTokens';` (path from `src/features/debates/`).

**Deliberate hierarchy note:** the light theme dimmed `helper` (`#666`) below `label` (`#444`). On dark, a 12px helper must clear the 4.5:1 body bar, so both land on `textSecondary` (`#94a3b8`). The label/helper tonal split is intentionally flattened to preserve AA; the size difference (15px vs 12px) still carries hierarchy. Do **not** reach for `textMuted` on the 12px helper — it is 4.24:1 (fails body AA; token doc marks it "large/non-body only").

### 5. `src/components/Button.tsx` — primary + danger → `CONTROL.*` (secondary UNCHANGED)

| Style / usage (line) | Before | → token | After value | Contrast | Verdict |
|---|---|---|---|---|---|
| `primary.backgroundColor` (67) | `#6366f1` | `CONTROL.primary.bg` | `#4f46e5` | fill (indigo-600) | — |
| `primaryLabel.color` (76) | `#fff` | `CONTROL.primary.fg` | `#ffffff` | **6.29:1** (on `#4f46e5`) | AA pass (was the 4.47:1 miss) |
| `danger.backgroundColor` (72) | `#ef4444` | `CONTROL.danger.bg` | `transparent` | + `borderWidth: 1` + `borderColor: CONTROL.danger.borderColor` (`#7f1d1d`) | not a flood |
| `dangerLabel.color` (78) | `#fff` | `CONTROL.danger.fg` | `#fca5a5` | **10.61:1** (#08060F) | AA pass |
| `ActivityIndicator` color, primary (48) | `#fff` | `CONTROL.primary.fg` | `#ffffff` | on indigo fill | — |
| `ActivityIndicator` color, danger (48) | `BRAND.text.primary` | `CONTROL.danger.fg` | `#fca5a5` | on shell | — |
| `ActivityIndicator` color, secondary (48) | `BRAND.text.primary` | **unchanged** | `#F5EDE0` | — | preserved |
| `secondary` variant (71,77) | — | **unchanged** | `BRAND.accent.goldBorder` + `BRAND.text.primary` | — | **must not edit (pinned)** |

**Button mechanical shape:**
- Change the import to `import { BRAND, CONTROL } from '../lib/designTokens';` (keep `BRAND` — the secondary variant and secondary spinner still use it).
- `danger` gains a border to become the sanctioned bordered treatment, mirroring `secondary`'s `{ backgroundColor: 'transparent', borderWidth: 1, borderColor: … }` structure:
  `danger: { backgroundColor: CONTROL.danger.bg, borderWidth: 1, borderColor: CONTROL.danger.borderColor }`.
- Replace the `variant === 'primary' ? '#fff' : BRAND.text.primary` ternary with a per-variant lookup so no `#fff` literal survives and secondary stays exactly as-is:
  `const SPINNER_FG = { primary: CONTROL.primary.fg, secondary: BRAND.text.primary, danger: CONTROL.danger.fg } as const;`
  then `color={SPINNER_FG[variant]}`. (Behavior identical — the spinner still shows during `loading`. A nested ternary is equivalent; the map reads cleaner.)

### 6. `src/components/LoadingNotice.tsx` — SCOPE ADDITION (6th file)

Not named in the issue's P0-1 list, but it is a shared component **inside `src/components/`** with the same drift (`#6366f1` spinner + `#6b7280` gray text). For the directory-wide grep-guard to be genuinely green (see Risks / Guard design), the whole directory must be clean, which requires re-skinning it. Trivial (+2 hex maps). This is the scope-reality-audit recommendation.

| Style / usage (line) | Before | → token | After value | Contrast (#08060F) | Verdict |
|---|---|---|---|---|---|
| `ActivityIndicator` color (11) | `#6366f1` | `SURFACE_TOKENS.focusRing` | `#a5b4fc` | 10.1:1 | spinner (3:1 pass, visible on dark) |
| `message.color` (19) | `#6b7280` | `SURFACE_TOKENS.textSecondary` | `#94a3b8` | 7.85:1 | AA pass |

Import to add: `import { SURFACE_TOKENS } from '../lib/designTokens';`

---

## MISSING-TOKEN reconciliation points (defer-to-PR-E candidates)

**No hard missing tokens.** Every one of the ~30 literals across the six files maps onto a token that already ships — PR-E is **not a blocker** for PR-A. Two **soft, optional** future-token candidates are noted so PR-E has the context; PR-A deliberately does **not** create them (no-new-tokens rule):

1. **`inputBgDisabled` (soft).** The disabled `TextInput` reuses `SURFACE_TOKENS.base` (`#020617`) as a "recessed" fill — a borrow of the page-background token for a disabled surface. It reads correctly (recessed, dimmer), but a dedicated disabled-input surface token would be semantically cleaner. Defer to PR-E if the operator wants the distinction named.
2. **Two cross-role borrows (documented, not missing):** `STATUS.danger.fg` (`#fecaca`) is used as a **border** color on the input-error and error-notice outlines, and `CONTROL.danger.borderColor` (`#7f1d1d`) is a `bg`-family maroon used as a **border**. Both borrows already have in-layer precedent — `CONTROL.danger.borderColor` is itself `STATUS.danger.bg` used as a border (`designTokens.ts:449`). No new token needed; flagged only so the reviewer sees the borrow is intentional.
3. **Quiet danger-button border (soft, eyes-on).** `CONTROL.danger.borderColor` (`#7f1d1d`) measures **2.01:1** on `#08060F` — below 3:1, but that is the token's documented "quiet maroon outline" character; the destructive meaning is carried by the light-red **label** (`#fca5a5`, 10.61:1) + the button word, so WCAG 1.4.11 / color-independence hold. If RUNTIME-CHECK eyes-on finds it too faint, a slightly lighter danger-border token is a PR-E candidate — but PR-A ships the sanctioned token as-is.

---

## File changes

New:
- `docs/designs/UX-PR-A.md` — this design (committed on `feat/ux-pra-dark-components`).
- `__tests__/componentsDarkThemeGuard.test.ts` — the grep-guard + firing control (~90 lines).
- `__tests__/uxPrADarkComponents.test.tsx` — per-component render + token + contrast tests (~180 lines). (May be split per component if preferred; keep in one suite for cohesion.)

Modified (production — colors only):
- `src/components/TextInputField.tsx` — 9 style/prop values + 1 import. ~10 lines.
- `src/components/ErrorNotice.tsx` — 3 values + 1 import. ~4 lines.
- `src/components/EmptyState.tsx` — 2 values + 1 import. ~3 lines.
- `src/components/Button.tsx` — primary bg, primary label, danger (3 props), danger label, spinner map + import change. ~10 lines. **Secondary variant byte-unchanged.**
- `src/components/LoadingNotice.tsx` — 2 values + 1 import. ~3 lines. (scope addition)
- `src/features/debates/CreateDebateForm.tsx` — 10 style values + 1 import. ~11 lines.

Docs:
- `docs/core/current-status.md` — append the PR-A note + the new test count after `npm run test` confirms it (per test-discipline).

Deleted: none.

Total production delta: ~41 lines across 6 files. No props, no layout, no typography, no behavior change.

---

## API / interface contracts

**Zero API change.** No exported signature, prop, or type is touched:
- `TextInputField(props: TextInputFieldProps)` — unchanged.
- `ErrorNotice({ message })`, `EmptyState({ title, body, actionLabel, onAction })`, `LoadingNotice({ message? })` — unchanged.
- `Button({ label, onPress, variant, loading, disabled, testID })` — unchanged; `variant` union stays `'primary' | 'secondary' | 'danger'`.
- `CreateDebateForm({ onSubmit, onCancel })` — unchanged.

The internal `SPINNER_FG` map in `Button.tsx` is a module-local const, not exported. `uxOneOneSixReadOnlyBoundary.test.ts` `requiredApi` for `designTokens.ts` is untouched because `designTokens.ts` is not edited.

---

## Edge cases

- **Empty / missing props:** `EmptyState` with no `body`, `LoadingNotice` with default message, `TextInputField` with no `errorMessage`/`placeholder` — all render; color-only change touches none of the conditional branches.
- **Error state:** `TextInputField` in error shows the `STATUS.danger.fg` border + the `STATUS.danger.fg` message text — the error is signalled by **text + border**, not color alone (color-independence).
- **Disabled state:** disabled `TextInput` uses the recessed `base` fill + `textMuted` text; disabled `Button` keeps the existing `styles.disabled { opacity: 0.45 }` (unchanged) layered over the new variant fills.
- **Loading state:** `Button loading` shows the per-variant `ActivityIndicator` (primary → white, secondary → cream, danger → light red); the label is hidden as before.
- **Selection state (CreateDebateForm):** selected option = `focusRing` border + `raised` fill + `●` + bold; unselected = `border` hairline + `elevated` fill + `○` + medium. Shape + weight carry the state independent of color.
- **Doctrine edge:** none of these colors encodes a verdict — `danger`/`STATUS.danger` describe **app state** (a validation error, a destructive action), never a claim's truth or a user's character (`cdiscourse-doctrine` §1, §10a). No user-facing strings are added.
- **Backdrop variance:** components render on `#08060F` (Screen `content`) or `#13101D` (Screen `header`, `appElevated`). Every AA-critical foreground clears 4.5:1 on **both** (the worst case is `#08060F`, tabulated above; `#0b1220`/`#13101D` are marginally more forgiving).

---

## Test plan

Repo idiom: pure-token + source-scan + light render, RTL on JSDOM, a local WCAG `contrast()` helper (no shared util exists — mirror `uxBrand001GoldAccent.test.ts:16-29` / `darkSurfaceTokens.test.ts:28-48`).

**`__tests__/componentsDarkThemeGuard.test.ts` (the grep-guard):**
- Scan set = every `*.tsx`/`*.ts` under `src/components/` (dynamic `fs.readdirSync`, so future components are auto-covered) **plus** the explicit path `src/features/debates/CreateDebateForm.tsx` (the one PR-A target outside `src/components/`).
- `BANNED_LIGHT_HEX` (case-insensitive) = the light/gray/flood family found across the 6 files:
  `#fff, #ffffff, #fafafa, #f4f4f4, #f9fafb, #f3f4f6, #e5e7eb, #fef2f2, #fee2e2, #fecaca, #374151, #111827, #6b7280, #9ca3af, #d1d5db, #991b1b, #ddd, #ccc, #eee, #444, #666, #888, #222, #333, #555, #999, #6366f1, #ef4444`.
- Reuse the `isNearWhite()` near-white catch-all (all channels ≥ `0xc0`) from `darkSurfaceTokens.test.ts:271` as a second scan so any *future* near-white literal is caught even if not enumerated.
- `ALLOWED_HEX = ['#000', '#000000']` (drop shadows are correct on dark — precedent parity).
- **Firing negative control:** assert the matcher flags a fixture string, e.g. `expect(offendersIn('color: "#374151"')).not.toEqual([])` and `expect(isNearWhite('#fafafa')).toBe(true)` — proves the guard actually fires, not vacuously green.
- **Must-NOT-ban control:** assert `#654`, `#746` (AppHeader issue-ref comments), `#1f1c2c` (Screen dark border) are **not** flagged (not in the banned set, not near-white) — proves the guard does not false-positive on legitimate dark literals / comment issue-refs.

**`__tests__/uxPrADarkComponents.test.tsx` (per-component):**
- **Source-scan per file** (mirrors `darkSurfaceTokens.test.ts:299-308`): each of the 6 files imports `designTokens` and references the expected token(s) — e.g. `TextInputField` source matches `/SURFACE_TOKENS\.inputBg/` and `/STATUS\.danger/`; `Button` matches `/CONTROL\.primary/` and `/CONTROL\.danger/`; and `Button` source **still** matches `/secondary:\s*\{[^}]*BRAND\.accent\.goldBorder/` + `/secondaryLabel:\s*\{\s*color:\s*BRAND\.text\.primary/` (guards the untouched secondary — complements `uxBrand001GoldAccent.test.ts`).
- **Render assertions** (RTL): render each component; flatten the style of the target node and assert the color equals the **token value** (e.g. `TextInputField` label style `color === SURFACE_TOKENS.textSecondary`; `Button` primary label `color === CONTROL.primary.fg`; `Button` danger has `borderWidth === 1` + `borderColor === CONTROL.danger.borderColor` + `backgroundColor === 'transparent'`). Assert against the token constant, **not** the raw hex, so the test tracks the token if the operator retunes it.
- **Contrast assertions (jest-provable):** with the local `contrast()` helper, pin every AA-critical pair: label `textSecondary` on `#08060F` ≥ 4.5 (7.85); input text on `#0b1220` ≥ 4.5 (15.19); error text on `#7f1d1d` ≥ 4.5 (6.93); EmptyState title/body on `#08060F` ≥ 4.5 (16.33 / 7.85); CreateDebateForm helper on `#08060F` ≥ 4.5 (7.85); `CONTROL.primary.fg` on `#4f46e5` ≥ 4.5 (6.29); `CONTROL.danger.fg` on `#08060F` ≥ 4.5 (10.61); LoadingNotice text on `#08060F` ≥ 4.5. Non-text/large: `focusRing` on `#0b1220` ≥ 3 (9.39); `textMuted` glyph on `#08060F` ≥ 3 (4.23). **Do NOT** assert the danger *border* ≥ 3 — it is 2.01 by design; instead add an explicit documenting assertion that the danger *label* ≥ 4.5 (color-independence carries the meaning).
- **Doctrine ban-list:** assert none of the 6 component sources contain any `FORBIDDEN_TOKEN_TOKENS` verdict word (colors-only change adds no strings, but pin it — test-discipline).
- **Color-independence (CreateDebateForm):** `CreateDebateForm.visibility.test.tsx:61` already covers this; re-run it green (it asserts `●/○` + bold, not hexes → unaffected by the re-skin).

**Consumer suites to re-run (see Risks — no snapshots exist):**
`__tests__/CreateDebateForm.visibility.test.tsx`, `__tests__/AuthCallbackScreen.test.tsx`, `__tests__/authScreenProviderRegion.test.tsx`, plus any suite rendering `Button` (`InvitePanel`, `MakePrivateConfirmation`, `RoomSettleConfirmation`, `proofButtonRouting`, etc.). They assert roles/labels/behavior, not colors → expected green with no edits.

**Perf-flake note (test-discipline / memory):** `LIFE-001` / `META-001` wall-clock budget tests can flake under full-suite parallel load and are unrelated to this diff — re-run any failure isolated before attributing it to PR-A.

**Gate discipline:** capture the `Test Suites: … / Tests: …` line with an explicit `; echo "EXIT: $?"`; run `npm run typecheck`, `npm run lint`, `npm run test`, and **`npm run web:build`** (asset/import-path correctness is not caught by jest — jest mocks requires; see memory "Jest mocks asset requires — run web:build"; here the imports are plain token imports, low risk, but run it).

---

## Dependencies (cards / docs / files)

- **Reads** `src/lib/designTokens.ts` exports `SURFACE_TOKENS`, `STATUS`, `CONTROL`, `BRAND` (shipped by BRAND-001 / BRAND-002 / UX-BRAND-001). No card blocks PR-A.
- **Precedents to mirror:** `__tests__/darkSurfaceTokens.test.ts` (banned-hex scanner + contrast helpers + `CONVERTED_FILES` idiom — the guard template); `Button.tsx:68-77` (UX-BRAND-001 secondary — the token-reference mechanical pattern, but sourced from BRAND not CONTROL — see the correction above).
- **Must not break:** `__tests__/uxBrand001GoldAccent.test.ts:89-101` (pins Button's secondary → `BRAND.accent.goldBorder` + `BRAND.text.primary`, and pins the *absence* of `#374151`/`#d1d5db` in Button).
- **PR-E** (additive tokens) is **not** a blocker; two soft candidates noted above.
- **Does not block** other cards (leaf conformance fix).

---

## Risks

1. **Secondary-variant trap (highest).** The brief/prompt say secondary points at `CONTROL.secondary`; it does not (it uses `BRAND.accent.goldBorder` + `BRAND.text.primary`, pinned by `uxBrand001GoldAccent.test.ts`). An implementer who "mirrors" by rewriting secondary to `CONTROL.secondary` breaks a shipped pin. **Leave secondary byte-unchanged; only primary + danger move to `CONTROL.*`.**
2. **Guard scope forces a 6th file.** `LoadingNotice.tsx` (a `src/components/` sibling, not in the issue's named list) carries `#6366f1` + `#6b7280`; a directory-wide guard is red until it is re-skinned. Options were: (a) re-skin it (chosen — trivial, same defect class, keeps the guard genuinely directory-wide), (b) allowlist its hexes (rejected — defeats the guard), (c) scope the guard to only the 4 named files (rejected — leaves siblings unguarded). Effort re-estimate: +2 hex maps, ~3 lines.
3. **Guard false-positive hazard.** `AppHeader.tsx` has `#654`/`#746` in **comments** (GitHub issue refs, not colors) and `Screen.tsx` has `#1f1c2c` (a legitimate dark border). A naive "any light-ish hex" scan could trip on these. The specific-hex ban-list (plus the near-white channel test, which none of these pass) avoids it — and the "must-NOT-ban control" test pins that they stay green. Do **not** add `#1f1c2c` / `#654` / `#746` to the banned set.
4. **"Re-snapshot" is a misnomer.** The repo has **zero** jest snapshot files (`git ls-files __tests__/__snapshots__` is empty; no `toMatchSnapshot` anywhere). The issue's "re-snapshot the 5 consumers" maps to "re-run the 5 consumer suites and confirm the color-only change breaks no assertion." Those suites assert roles/labels/behavior, not hexes → expected green.
5. **Danger border faintness (2.01:1).** Documented token character, meaning carried by the label — but confirm eyes-on in RUNTIME-CHECK. Not a jest failure (we do not assert the border ≥ 3).
6. **`designTokens.ts` pin.** It is `requiredApi`-pinned (uxOneOneSix). PR-A must **not** edit it (no new tokens). Verified: the mapping needs no token that isn't already exported.
7. **web:build.** Import paths differ by directory depth (`../lib` from `src/components/`, `../../lib` from `src/features/debates/`). A wrong relative path passes jest (mocked) but breaks Metro/Netlify. Run `npm run web:build`.

---

## Out of scope

- **No new tokens / no additive token extensions** — that is PR-E.
- **No typography, spacing, layout, radius, or hit-target change** — `TYPOGRAPHY` is test-pinned; PR-A is colors-only.
- **No component API / props / behavior change.**
- **No re-skin of the ~18 BRAND-002 `CONVERTED_FILES`** (admin / auth / composer screens — already converted).
- **No edit to `AppHeader.tsx`, `AppHeaderTagline.tsx`** (pinned by uxOneOneFive/Six; already guard-clean — comments only) or **`Screen.tsx`** (already dark; `#1f1c2c` is a legitimate dark border).
- **No migration, Edge Function, RLS, storage, auth, or flag** — UNFLAGGED conformance.
- **No deploy** by Claude. The RUNTIME-CHECK is an eyes-on QA step, not a deploy.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels):** colors are structural — `STATUS.danger`/`CONTROL.danger` mean "app-level error / destructive action," never a verdict on a claim or person. No user-facing strings added. Score never involved. ✓
- **cdiscourse-doctrine §6 (secrets):** no `.env`, no service-role, no keys touched. ✓
- **cdiscourse-doctrine §7 (no AI in prod):** none. ✓
- **cdiscourse-doctrine §10 (v1 scope):** no voting/search/OAuth/push/public-API — pure conformance. ✓
- **accessibility-targets (contrast):** every AA-critical foreground ≥ 4.5:1 on the worst-case `#08060F` (tabulated + jest-pinned); non-text/large ≥ 3:1; the front-door `TextInputField` label goes ~1.9:1 → 7.85:1. ✓
- **accessibility-targets (color is never the only signal):** `TextInputField` error = border + text; `Button danger` = light-red label + word (not a color-only alarm); `CreateDebateForm` selection = shape (`●/○`) + weight + color. ✓
- **accessibility-targets (targets unchanged):** colors-only — `minHeight`/`hitSlop`/roles/labels all preserved. ✓
- **expo-rn-patterns:** reuse the existing token layer, no new deps, RN primitives + model/UI boundaries untouched, correct relative import depths. ✓
- **timeline-grammar:** no node/rail visuals touched; the "color is structural, not a verdict" principle upheld. ✓
- **test-discipline:** tests ship with the card (guard + render + contrast + ban-list); test count goes up; gates captured with explicit exit codes; `web:build` run. ✓

---

## Operator steps (if any)

**None for merge — pure code change** (no migration, no Edge deploy, no flag flip, no env var).

**Post-merge RUNTIME-CHECK (eyes-on QA acceptance gate, doable UNAUTHENTICATED):** on `dev-cdiscourse.netlify.app`, open the **auth front door** (the sign-in screen renders both `TextInputField` — email/password labels + inputs — and `Button` primary). Confirm: (1) field labels are clearly legible on the dark shell (was near-invisible); (2) the primary CTA reads as indigo-600 with a crisp white label; (3) the destructive `Button danger` (reachable on `MakePrivateConfirmation` / `RoomSettleConfirmation` / deletion flows — those require auth, so verify the danger variant there or in the component gallery) is a **bordered** control, not a full-bleed red flood, and its light-red label is readable. Items (1)-(2) are unauthenticated; the danger visual delta needs a signed-in destructive screen. The pure contrast math is jest-proven; this smoke is the rendered-pixel confirmation.
