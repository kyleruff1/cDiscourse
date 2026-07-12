# UX-PR-E — Additive dimension / motion / scrim / glyph tokens

**Status:** Design draft
**Epic:** UX Continuity Audit 2026-07 remediation / design-system cohesion (cross-cutting). This is the audit's **Wave-2 token-additions** move (`UX_STYLE_SYSTEM_AUDIT.md` §10 "Wave 2 — token additions (zero-risk, additive vs the pins)", §11 move 5). It ships the **scaffolding**; the literal→token migrations (P2-2 / P2-4 / P2-6 / P2-12) consume it later.
**Release:** UX Continuity 2026-07 remediation wave (ships alongside PR-A…PR-D; must land BEFORE the migration PRs so those have tokens to migrate onto).
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/927

> **Source of truth** for every audit claim below: `UX_STYLE_SYSTEM_AUDIT.md` on branch `origin/docs/ux-continuity-audit-2026-07` (NOT on main), at `docs/audits/ux-continuity-2026-07/UX_STYLE_SYSTEM_AUDIT.md`. Read it with
> `git show origin/docs/ux-continuity-audit-2026-07:docs/audits/ux-continuity-2026-07/UX_STYLE_SYSTEM_AUDIT.md`.
> Cited as **AUDIT F-XX / §N** throughout. Findings consumed: **F-06** (spacing 2/6/10), **F-07** (radius 6/10), **F-09** (typography body/title roles + sub-10px floor), **F-18** (SCRIM), **F-20** (GLYPHS), **F-26** (MOTION). The F-10 chip-tint colors are **deferred** (see §"Out of scope").

---

## Goal (one paragraph)

PR-E is an **additive, consumer-less token-scaffolding card. ZERO production consumer touch, ZERO rendered-pixel change, ZERO value mutation.** It adds six token families to `src/lib/designTokens.ts` (plus one new sibling module `src/lib/glyphs.ts`) that the current token layer *cannot express* today — the audit's verdict is "the gap is adoption, not architecture; additively extend the layer where it cannot express real needs, and never mutate the pinned values" (AUDIT §1). Concretely: SPACING interior steps 2/6/10 (F-06), RADIUS interior steps 6/10 (F-07), five TYPOGRAPHY roles the 13px-capped scale can't reach — `bodySm`/`body`/`titleSm`/`title`/`microLabel` (F-09), a `SCRIM` ladder replacing 14 ad-hoc `rgba(2,6,23,α)` variants (F-18), a `MOTION` duration scale (F-26), and a `GLYPHS` vocabulary for the ~13 unicode glyphs the app already uses (F-20). The doctrine that shapes the design is `cdiscourse-doctrine` §1/§2/§3 (nothing here may read as a verdict, heat, or popularity signal — the tokens are pure geometry/opacity/text-content), `timeline-grammar` (a glyph like `✓` signals *presence/completion*, never *truth/correctness*; SCRIM darkens, it does not rank), and the **UX-001.7 additive-against-pins precedent** (that card grew `TOKENS` 11→16 by adding keys AND extending the exact-key `toEqual` arrays + counts — that is expected maintenance, not a pin violation). The **critical constraint**: two pin tests assert EXACT key sets and counts; "additive" here means *add the keys AND extend the pins to match*, while every existing key, value, and sub-object stays byte-identical.

**Cannot-proceed check:** none. The card is well-specified, doctrine-aligned, and the audit is the validated source of truth. It adds inert data only — no product behavior, no palette re-hue, no consumer migration. **Proceed.**

---

## Data model

No database, no Edge Function, no RLS — this is a pure-TS constant module change. The "data model" is the token shapes. All new tokens are `as const` (readonly literal types), consistent with the file.

### The complete new-token master table

| Family | Key | Value | Type shape | Finding | Note |
|---|---|---|---|---|---|
| **SPACING** (add 3 interior) | `xxs` | `2` | number | F-06 | below `xs`; conventional extension |
| | `xs6` | `6` | number | F-06 | interior between `xs`(4) and `s`(8); value-in-name |
| | `m10` | `10` | number | F-06 | interior between `s`(8) and `m`(12); value-in-name |
| **RADIUS** (add 2 interior) | `sm6` | `6` | number | F-07 | between `sm`(4) and `md`(8) |
| | `md10` | `10` | number | F-07 | between `md`(8) and `lg`(12) |
| **TYPOGRAPHY** (add 5 roles) | `microLabel` | `{ fontSize: 10, lineHeight: 14, fontWeight: '600' }` | group | F-09 | the **min-10 legibility floor** the sub-10px sweep (9px×~23, 8px×1) migrates UP to |
| | `bodySm` | `{ fontSize: 13, lineHeight: 18, fontWeight: '400' }` | group | F-09 | secondary body; matches the existing 13px tier |
| | `body` | `{ fontSize: 15, lineHeight: 21, fontWeight: '400' }` | group | F-09 | **the reading-body role** — AUDIT §4 names body as "15/21 regular" |
| | `titleSm` | `{ fontSize: 16, lineHeight: 22, fontWeight: '600' }` | group | F-09 | small section title |
| | `title` | `{ fontSize: 18, lineHeight: 24, fontWeight: '700' }` | group | F-09 | screen/section title (top of scale) |
| **SCRIM** (new export, 3) | `light` | `'rgba(2,6,23,0.45)'` | string | F-18 | over interior base `#020617` = `rgb(2,6,23)` |
| | `medium` | `'rgba(2,6,23,0.6)'` | string | F-18 | |
| | `heavy` | `'rgba(2,6,23,0.8)'` | string | F-18 | |
| **MOTION** (new export, 3) | `fastMs` | `140` | number | F-26 | ms; `Ms` suffix mirrors the repo's `…Px` convention |
| | `baseMs` | `160` | number | F-26 | ms (the modal duration — 160 appears ×3 app-wide) |
| | `slowMs` | `180` | number | F-26 | ms |
| **GLYPHS** (new file `glyphs.ts`, 13) | `circleOutline` | `'○'` (U+25CB) | string | F-20 | empty / pending node marker |
| | `circleFilled` | `'●'` (U+25CF) | string | F-20 | filled / present node marker |
| | `triangleDown` | `'▾'` (U+25BE) | string | F-20 | expanded disclosure |
| | `triangleRight` | `'▸'` (U+25B8) | string | F-20 | collapsed disclosure |
| | `check` | `'✓'` (U+2713) | string | F-20 | **presence / completion tick — never a truth or correctness mark** |
| | `arrowRight` | `'→'` (U+2192) | string | F-20 | leads-to / next (gallery `Observe →` etc.) |
| | `diamondOutline` | `'◇'` (U+25C7) | string | F-20 | outline diamond marker |
| | `diamondFilled` | `'◆'` (U+25C6) | string | F-20 | filled diamond marker |
| | `bullet` | `'•'` (U+2022) | string | F-20 | list bullet |
| | `arrowUp` | `'↑'` (U+2191) | string | F-20 | |
| | `arrowDown` | `'↓'` (U+2193) | string | F-20 | |
| | `callback` | `'⤴'` (U+2934) | string | F-20 | canonical home for the existing `CALLBACK_GLYPH` (dedupe deferred to Wave-2) |
| | `replyReturn` | `'↩'` (U+21A9) | string | F-20 | reply / return-to-parent |

**Counts:** SPACING +3, RADIUS +2, TYPOGRAPHY +5 (10→15), SCRIM 3 (new), MOTION 3 (new), GLYPHS 13 (new). **New `TOKENS` aggregate keys: +3** (`motion`, `scrim`, `glyphs`; SPACING/RADIUS/TYPOGRAPHY are already aggregated, so their growth adds no aggregate key).

### Naming rationale (the two interpretive choices most likely to draw review)

1. **`body` = 15/21, not 14.** The card gave the range "14-15". Raw literal frequency in `src/` is `fontSize:14` ×98 > `fontSize:15` ×50, but that frequency is the *drifted reality*; **AUDIT §4 (the design intent) names the reading-body role explicitly as "15/21 regular"**, and PR-E establishes the *intended* canonical that Wave-2 migrates toward, not the most-common drift. The 14px literals are a mix of body + secondary text that Wave-2 (P2-4/P2-6) will map to `body`(15) or `bodySm`(13) by intent — a deliberate consolidation, same pattern as SCRIM. **Flagged for operator review** (see the interpretive ledger).
2. **SPACING interior names `xxs`/`xs6`/`m10`, RADIUS `sm6`/`md10`.** The brief suggested `xxs:2`, `sm:6`, `m10:10` and warned to "avoid `s`/`sm` confusion." `xxs` and `m10` are kept as suggested. The brief's `sm:6` is renamed **`xs6`** because a key named `sm` collides with the existing `s`(8) and reads as *smaller-than-s* while being *larger-than-`xs`* — exactly the confusion the brief flagged. `xs6`/`m10`/`sm6`/`md10` embed the pixel value so they are self-documenting and collision-proof against the `xs/s/m/l/xl` and `sm/md/lg/pill` scales. Because these tokens have **zero consumers**, a later rename is cheap; flagged for operator review.

---

## File changes

- **modified** `src/lib/designTokens.ts` — add the SPACING (3) / RADIUS (2) / TYPOGRAPHY (5) keys to the existing objects; add `MOTION` and `SCRIM` export blocks; `import { GLYPHS } from './glyphs'` + re-export it (`export { GLYPHS }` / `export type { GlyphKey }`); add `motion`/`scrim`/`glyphs` to the `TOKENS` aggregate. **~+60–70 lines**, all additive; **not one existing line's value changes.** (One comment tweak: the SPACING header comment "Add new values only at the ends." becomes inaccurate — update it to note interior values are permitted provided monotonic order is preserved.)
- **new** `src/lib/glyphs.ts` — pure-TS `GLYPHS` const (13 entries) + `GlyphKey` type + header doc-comment. Imports nothing (stays a pure leaf module; no cycle: `designTokens.ts → glyphs.ts`, never the reverse). **~40–50 lines.**
- **modified** `__tests__/designTokens.test.ts` — extend 3 exact-key/count assertions (SPACING keys, RADIUS keys, TOKENS keys). **~3 assertion edits + title text.**
- **modified** `__tests__/uxOneOneSevenTokenExports.test.ts` — extend 2 assertions (TYPOGRAPHY key array 10→15, TYPOGRAPHY `toHaveLength` 10→15). **~2 assertion edits + title text.**
- **new** `__tests__/uxPrETokenExports.test.ts` — all PR-E new-token coverage in one auditable file (existence, shape, values, aggregation, ordering, byte-identity of existing exports, doctrine ban-list over the new tokens). **~200–240 lines.**

**Blast radius: 5 files (2 source [1 new], 2 pin tests, 1 new test). No component, screen, migration, Edge Function, snapshot, or dependency touched.**

---

## API / interface contracts

### `src/lib/glyphs.ts` (new)

```ts
/**
 * UX-PR-E (F-20) — canonical unicode glyph vocabulary.
 *
 * The app ships a deliberate ZERO-DEPENDENCY icon strategy (no icon lib
 * in package.json). ~13 unicode glyphs recur across the surfaces; today
 * they are inlined as string literals, and the one previously-tokenized
 * glyph (CALLBACK_GLYPH in crossRoom/callbackComposerCopy.ts) is bypassed
 * by two inline callsites. This module is the single home for the
 * vocabulary so Wave-2 can migrate the literals onto named references.
 *
 * Doctrine: a glyph is CHROME / STRUCTURE, never a verdict. `check`
 * signals presence or completion of a step, NOT that a claim is correct
 * or true (cdiscourse-doctrine §1, timeline-grammar). No key or value
 * carries verdict / heat / popularity vocabulary.
 *
 * PR-E adds this vocabulary ONLY. It replaces no callsite; Wave-2
 * (P2-12) migrates the inline glyphs and dedupes CALLBACK_GLYPH onto
 * GLYPHS.callback.
 */
export const GLYPHS = {
  circleOutline: '○',
  circleFilled:  '●',
  triangleDown:  '▾',
  triangleRight: '▸',
  check:         '✓',
  arrowRight:    '→',
  diamondOutline:'◇',
  diamondFilled: '◆',
  bullet:        '•',
  arrowUp:       '↑',
  arrowDown:     '↓',
  callback:      '⤴',
  replyReturn:   '↩',
} as const;

export type GlyphKey = keyof typeof GLYPHS;
```

### `src/lib/designTokens.ts` (additions, sketch)

```ts
export const SPACING = {
  xxs: 2,   // UX-PR-E F-06 — interior micro-gap, below xs
  xs: 4,
  xs6: 6,   // UX-PR-E F-06 — interior 6px, between xs(4) and s(8)
  s: 8,
  m10: 10,  // UX-PR-E F-06 — interior 10px, between s(8) and m(12)
  m: 12,
  l: 16,
  xl: 24,
} as const;

export const RADIUS = {
  sm: 4,
  sm6: 6,   // UX-PR-E F-07 — between sm(4) and md(8)
  md: 8,
  md10: 10, // UX-PR-E F-07 — between md(8) and lg(12)
  lg: 12,
  pill: 999,
} as const;

// TYPOGRAPHY — APPEND these 5 groups (do not reorder or mutate the 10 existing):
//   microLabel: { fontSize: 10, lineHeight: 14, fontWeight: '600' as const },
//   bodySm:     { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
//   body:       { fontSize: 15, lineHeight: 21, fontWeight: '400' as const },
//   titleSm:    { fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
//   title:      { fontSize: 18, lineHeight: 24, fontWeight: '700' as const },

/**
 * UX-PR-E (F-26) — motion duration scale in milliseconds. Inert data:
 * PR-E wires NO animation and NO reduce-motion. Consumers (Wave-2 P2-12)
 * thread the existing `useReduceMotion` hook (1 consumer today) through
 * the uncovered Animated sites and drop these to 0 when reduce-motion is
 * on — see GLOW's reduce-motion contract. `Ms` suffix mirrors the repo's
 * `…Px` unit-in-key convention (TOUCH_TARGET.minSizePx, GLOW.strokeWidthPx).
 */
export const MOTION = {
  fastMs: 140 as const,
  baseMs: 160 as const,
  slowMs: 180 as const,
} as const;
export type MotionKey = keyof typeof MOTION;

/**
 * UX-PR-E (F-18) — scrim ladder over the interior base `#020617`
 * (= rgb(2,6,23) = SURFACE.base.bg = SURFACE_TOKENS.base). Replaces 14
 * ad-hoc `rgba(2,6,23,α)` variants (α∈{0.32…0.85}) across ~27 callsites.
 * Ready-to-use rgba STRINGS (not {base,alpha} objects) so a Wave-2
 * callsite is a direct literal→reference swap: `backgroundColor:
 * SCRIM.medium`. Compact no-space form matches the dominant existing
 * literal style (`rgba(2,6,23,0.7)`). Three canonical steps; Wave-2
 * (P2-2) maps each drifted alpha onto the nearest step (a deliberate,
 * reviewed consolidation — NOT a blind byte swap).
 */
export const SCRIM = {
  light:  'rgba(2,6,23,0.45)' as const,
  medium: 'rgba(2,6,23,0.6)' as const,
  heavy:  'rgba(2,6,23,0.8)' as const,
} as const;
export type ScrimKey = keyof typeof SCRIM;

import { GLYPHS } from './glyphs';
export { GLYPHS } from './glyphs';
export type { GlyphKey } from './glyphs';

export const TOKENS = {
  // …all existing keys unchanged…
  // UX-PR-E additions — additive only, existing keys above unchanged.
  motion: MOTION,
  scrim: SCRIM,
  glyphs: GLYPHS,
} as const;
```

After aggregation, `getToken('motion.baseMs') === 160`, `getToken('scrim.medium') === 'rgba(2,6,23,0.6)'`, `getToken('glyphs.arrowRight') === '→'` all resolve (existing `getToken` walks `TOKENS` — no change to the accessor).

**GLYPHS decision — separate file + re-export + aggregate.** A new `src/lib/glyphs.ts` (not an inline `designTokens.ts` block) because glyphs are **text content**, a different concern from dimensional/color style tokens, and the module gives a natural future home for per-glyph a11y-label pairing (a `✓` needs an `accessibilityLabel` "done"). It is **re-exported from `designTokens.ts` and aggregated into `TOKENS`** for discoverability (the brief's stated preference) and `getToken` reachability. This is the reason the `TOKENS` pin array grows by `glyphs`.

**SCRIM decision — rgba strings, not `{base, alpha}` objects.** Rationale in the code comment above: P2-2's callsites currently hold `rgba(2,6,23,α)` literals; a string token makes the migration a one-token reference swap with no recomposition and no place for the base hex to drift. The object form would force every callsite to rebuild the string, re-introducing the drift F-18 exists to kill.

---

## Edge cases

- **Empty / malformed input:** none — the module exports frozen constants; there is no runtime input path.
- **Interior-key ordering:** the new SPACING values must remain monotonic when the scale is read in value order (`xxs 2 < xs 4 < xs6 6 < s 8 < m10 10 < m 12 < l 16 < xl 24`) and RADIUS likewise (`sm 4 < sm6 6 < md 8 < md10 10 < lg 12 < pill 999`). The new test adds an explicit interior-ordering assertion; the existing `designTokens.test.ts` monotonic test (which references only `xs/s/m/l/xl`) is untouched and still passes.
- **TYPOGRAPHY legibility floor (hard constraint — two non-named guards):** `__tests__/uxOneOneSevenAccessibilityConsistency.test.ts:159-169` iterates **every** TYPOGRAPHY group and asserts `fontSize >= 10` AND `lineHeight >= fontSize`. All five new groups satisfy both by construction (`microLabel` 10/14, `bodySm` 13/18, `body` 15/21, `titleSm` 16/22, `title` 18/24). **An implementer who picked, e.g., `microLabel` lineHeight 8 would redden that guard** — the values in this design are chosen to clear it.
- **`badgeLabel` "smallest font" title becomes a tie:** `uxOneOneSevenTokenExports.test.ts:284` asserts `badgeLabel.fontSize === 10`. With `microLabel` also at 10 the two are tied at the 10px floor; the assertion (an equality, not a strict-minimum) still passes. Only the human-readable `it(...)` title is cosmetically stale — clarify it, do not change the assertion.
- **SCRIM base-hex drift:** the three strings hard-code `2,6,23`. The new test asserts each contains `2,6,23` and that `SURFACE.base.bg === '#020617'`, documenting the coupling so a future edit can't silently desync the scrim base from the surface base.
- **CALLBACK_GLYPH duplication:** `GLYPHS.callback` (`'⤴'`) intentionally equals the existing `CALLBACK_GLYPH` in `crossRoom/callbackComposerCopy.ts`. PR-E does **not** touch that file or its two inline callsites (`ArgumentEntryComposer.tsx:363`, `LinkedPriorArgumentChipRow.tsx:98,112`) — dedupe is a Wave-2 (P2-12) consumer task. Same value in two symbols is a temporary, harmless coexistence.
- **Doctrine edge — "does a glyph rank content?":** No. `✓`/`◆`/`●` are shape/presence markers. The `check` doc-comment and the new ban-list test assert no key/value carries verdict, heat, or popularity vocabulary. Heat never touches these tokens; SCRIM darkens for legibility/focus, it does not encode importance (cdiscourse-doctrine §2/§3).
- **Android fallback-font rendering (carried, not in scope):** AUDIT RUNTIME-CHECK #6 flags that `◆`/`⤴` may render via a fallback font on Android. PR-E only *names* the glyphs; it changes no rendered surface, so it cannot regress this. The check remains OPEN against the Wave-2 consumer PR, noted here for the record.

---

## Test plan

All pure-TS (no React, no Supabase). Run with `npm run test`, `npm run typecheck`, `npm run lint` — all exit 0. Test count goes UP.

### A. Pin-test extensions (exact edits in the §"Every pin-test edit" table below)
- `__tests__/designTokens.test.ts` — SPACING key array, RADIUS key array, TOKENS key array.
- `__tests__/uxOneOneSevenTokenExports.test.ts` — TYPOGRAPHY key array, TYPOGRAPHY length.

### B. New file `__tests__/uxPrETokenExports.test.ts`
- **SPACING interior:** `SPACING.xxs === 2`, `SPACING.xs6 === 6`, `SPACING.m10 === 10`; interior monotonicity `xxs<xs<xs6<s<m10<m<l<xl`; existing values byte-identical (`xs===4,s===8,m===12,l===16,xl===24`).
- **RADIUS interior:** `sm6 === 6`, `md10 === 10`; ordering `sm<sm6<md<md10<lg<pill`; existing `sm===4,md===8,lg===12,pill===999`.
- **TYPOGRAPHY new roles:** exact `{fontSize,lineHeight,fontWeight}` for `microLabel`/`bodySm`/`body`/`titleSm`/`title`; each `fontSize>=10` and `lineHeight>=fontSize` (explicit, echoing the a11y guard); spot-check two existing groups unchanged (`chipLabel` 11/14/'600', `composer` 13/18/'400').
- **MOTION:** defined; `fastMs===140,baseMs===160,slowMs===180`; ascending `fast<base<slow`; `TOKENS.motion === MOTION`; `getToken('motion.baseMs')===160`.
- **SCRIM:** defined; the three exact rgba strings; each contains `'2,6,23'`; `SURFACE.base.bg==='#020617'` (base coupling); alphas ascending (0.45<0.6<0.8 parsed); `TOKENS.scrim === SCRIM`; `getToken('scrim.heavy')==='rgba(2,6,23,0.8)'`.
- **GLYPHS:** `Object.keys(GLYPHS)` has all 13 documented keys; each value is a non-empty string of length ≥ 1; `GLYPHS.callback === '⤴'`; `TOKENS.glyphs === GLYPHS`; `getToken('glyphs.arrowRight')==='→'`.
- **Existing-export byte-identity (regression guard):** `TOKENS.spacing===SPACING`, `TOKENS.radius===RADIUS`, `TOKENS.typography===TYPOGRAPHY`, `TOKENS.surfaceTokens===SURFACE_TOKENS` all still `toBe` (reference-equal); `Object.keys(TYPOGRAPHY)` contains every one of the original 10 group names.
- **Doctrine ban-list over the NEW tokens** (mirror `uxOneOneSevenTokenExports.test.ts:357-424` — deep-scan keys + string values, lowercased, `.not.toContain`): forbidden set = `winner, loser, liar, truth, verdict, correct, incorrect, dishonest, bad faith, manipulative, extremist, propagandist, popular, trending, viral, amplification, engagement`. Scan `MOTION`, `SCRIM`, `GLYPHS`, and the new SPACING/RADIUS keys + new TYPOGRAPHY group keys. (Note `correct` is in the forbidden list; the `check` glyph key is `check`, not `correct`, and the value `'✓'` contains no letters — safe.)
- **Grand-total sanity:** assert the added key counts (SPACING +3, RADIUS +2, TYPOGRAPHY +5, MOTION 3, SCRIM 3, GLYPHS 13) and that the UX-001.7-family total (still tracked by `uxOneOneSevenTokenExports.test.ts:446`) is now 32 ≤ 50.

### C. Guards that pass UNCHANGED (assert, do not edit) — call these out in the PR body
- `designTokens.test.ts:30-35` SPACING monotonic (references only xs/s/m/l/xl).
- `designTokens.test.ts:132-146` "no token key contains a forbidden word" (auto-includes new SPACING/RADIUS keys via `...Object.keys(...)`; none are forbidden).
- `uxOneOneSevenTokenExports.test.ts:240-246, 321-330` (every TYPOGRAPHY group `fontSize>0/lineHeight>0`; every SPACING_PRESETS value maps into the SPACING value SET — growing SPACING only grows the set, presets unchanged).
- `uxOneOneSevenTokenExports.test.ts:357-424` doctrine ban-list — auto-includes the 5 new TYPOGRAPHY groups; none forbidden.
- `uxOneOneSevenAccessibilityConsistency.test.ts:159-169` (`fontSize>=10`, `lineHeight>=fontSize`) — satisfied by the chosen values.
- `uxOneOneSevenCrossDevicePreservation.test.ts:246-252` (SPACING scale set membership) — grows, still contains xs/s/m/l.
- `uxOneOneSixDoctrine.test.ts` (designTokens.ts is scanned) — no verdict literal, internal code, secret, or AI import added (see scanner checklist).
- `uxOneOneFiveALabelDoctrine.test.ts:395-402` — asserts designTokens.ts has no `UX-001.5A` marker; do not write that string.

---

## Every pin-test edit (precise, diff-level)

### `__tests__/designTokens.test.ts`

**Edit 1 — SPACING keys (line 27).** Title (line 26) → `'SPACING has xs / s / m / l / xl + interior xxs / xs6 / m10 (UX-PR-E F-06)'`.
```ts
// FROM:
expect(Object.keys(SPACING).sort()).toEqual(['l', 'm', 's', 'xl', 'xs']);
// TO:
expect(Object.keys(SPACING).sort()).toEqual(['l', 'm', 'm10', 's', 'xl', 'xs', 'xs6', 'xxs']);
```

**Edit 2 — RADIUS keys (line 38).** Title (line 37) → `'RADIUS has sm / md / lg / pill + interior sm6 / md10 (UX-PR-E F-07)'`.
```ts
// FROM:
expect(Object.keys(RADIUS).sort()).toEqual(['lg', 'md', 'pill', 'sm']);
// TO:
expect(Object.keys(RADIUS).sort()).toEqual(['lg', 'md', 'md10', 'pill', 'sm', 'sm6']);
```

**Edit 3 — TOKENS aggregate keys (lines 61-80).** Title (line 61) → `'TOKENS aggregate contains all nineteen categories (UX-PR-E added motion / scrim / glyphs)'`.
```ts
// TO (19 keys, sorted):
expect(Object.keys(TOKENS).sort()).toEqual([
  'argument',
  'borderWidth',
  'brand',
  'control',
  'focusRing',
  'glow',
  'glyphs',        // UX-PR-E
  'motion',        // UX-PR-E
  'radius',
  'rail',
  'receiptMark',
  'scrim',         // UX-PR-E
  'spacing',
  'spacingPresets',
  'status',
  'surface',
  'surfaceTokens',
  'touchTarget',
  'typography',
]);
```
> Ordering note: `'glow'` sorts BEFORE `'glyphs'` (`glo` < `gly`). Verify with the actual `.sort()` if in doubt.

### `__tests__/uxOneOneSevenTokenExports.test.ts`

**Edit 4 — TYPOGRAPHY key array (lines 223-238).** Title (line 223) → `'exports TYPOGRAPHY with all 15 documented groups (UX-PR-E added body/title roles + microLabel)'`.
```ts
// TO (15 keys, sorted):
expect(keys).toEqual([
  'badgeLabel',
  'body',          // UX-PR-E
  'bodySm',        // UX-PR-E
  'chipLabel',
  'composer',
  'inspectDetail',
  'keyboardHint',
  'microLabel',    // UX-PR-E
  'popoutBody',
  'popoutHeading',
  'roomStrip',
  'selectedContext',
  'timelineNode',
  'title',         // UX-PR-E
  'titleSm',       // UX-PR-E
]);
```

**Edit 5 — TYPOGRAPHY length (line 439).** Title (line 439) → `'TYPOGRAPHY adds 15 keys'`.
```ts
// FROM:  expect(Object.keys(TYPOGRAPHY)).toHaveLength(10);
// TO:    expect(Object.keys(TYPOGRAPHY)).toHaveLength(15);
```

**No assertion edit needed** at `uxOneOneSevenTokenExports.test.ts:446` (grand-total ≤ 50): the total recomputes dynamically to **3+3+3+15+8 = 32 ≤ 50** and stays green. Optionally clarify the surrounding comment. **No edit** at line 284 (`badgeLabel` = 10 still true; only the "smallest font" wording is now a tie — clarify the title only).

---

## Dependencies (cards / docs / files)

- **Reads** the pinned values in `src/lib/designTokens.ts` (SPACING/RADIUS/TYPOGRAPHY/SURFACE/TOKENS) and the two pin tests — the extended `toEqual` arrays MUST include every pre-existing key exactly.
- **Assumes** UX-001.7 is complete (it is — the `TOUCH_TARGET`/`FOCUS_RING`/`BORDER_WIDTH`/`TYPOGRAPHY`/`SPACING_PRESETS` exports and their pin test exist on `main`). PR-E mirrors that card's additive-against-pins playbook.
- **Consumes** the audit `UX_STYLE_SYSTEM_AUDIT.md` (off-main branch) as the finding source.
- **Blocks** the Wave-2 migration cards **P2-2** (SCRIM 27-site consolidation + F-10 chip tints + Era-A′ literals→references), **P2-4/P2-6** (TYPOGRAPHY body/title adoption + sub-10px floor sweep), **P2-12** (GLYPHS inline→reference + MOTION reduce-motion threading + `CALLBACK_GLYPH` dedupe), and the RADIUS.pill/interior + SPACING interior codemods — each needs these tokens to exist first. Landing PR-E before those is the whole point of the Wave-2 sequencing (AUDIT §10/§11).
- **Sibling** to PR-A…PR-D (same remediation wave); no ordering coupling with them — PR-E touches only `designTokens.ts` + a new file + two token tests.

---

## Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | **Sorted-array miscount** in an extended `toEqual` (e.g. placing `glyphs` before `glow`, or `m10` in the wrong slot). | The exact arrays are transcribed above with a note on the `glow`<`glyphs` and `xl`<`xs`<`xs6`<`xxs` orderings. The implementer should paste them verbatim; a wrong order fails immediately and loudly. |
| 2 | **A new TYPOGRAPHY group with `lineHeight < fontSize` or `fontSize < 10`** silently reddens the non-named a11y guard (`uxOneOneSevenAccessibilityConsistency.test.ts`). | Values in §Data model are pre-checked against both guards; §Edge cases calls the guard out by file:line. |
| 3 | **`body` finalized at 15 vs an operator expectation of 14.** | Grounded in AUDIT §4 ("15/21 regular"); flagged in the interpretive ledger for operator review; consumer-less so trivially re-tunable pre-Wave-2. |
| 4 | **Interior SPACING/RADIUS naming** disliked at review. | Documented rationale + operator-review flag; zero consumers ⇒ rename is a one-file edit before any migration. |
| 5 | **Accidental consumer touch** (an implementer "helpfully" migrating a callsite) would break the no-rendered-change invariant and dirty snapshots. | Hard non-goal, stated in §Out of scope; the `git status` must show only the 5 named files; snapshots + `web:build` stay byte-stable (verification below). |
| 6 | **Circular import** if `glyphs.ts` ever imports `designTokens.ts`. | `glyphs.ts` is a pure leaf (imports nothing); dependency is strictly `designTokens.ts → glyphs.ts`. |
| 7 | **Unicode corruption** on copy/paste of a glyph char. | The master table lists the U+XXXX codepoint for every glyph; the file must be saved UTF-8 (the repo already ships literal unicode, e.g. `proofDrawerModel.ts`). |
| 8 | **No existing snapshot/`web:build` regression** — because nothing consumes the tokens, there should be zero pixel diff. | Not a pin, but run `npm run web:build` to confirm the bundle still builds (adding an inert const + a new module cannot change output); existing snapshot suites must stay green with no `-u`. |

---

## Out of scope (non-goals)

- **No consumer migration.** No `src/`, `app/`, component, screen, or callsite is edited. The 14 `rgba(2,6,23,α)` scrim callsites, the 9/8px sub-floor sites, the inline glyphs, the two inline `⤴`, and the `CALLBACK_GLYPH` dedupe are all **Wave-2** (P2-2/P2-4/P2-6/P2-12). Note this **overrides** AUDIT F-20's "replace the 2 inline ⤴ now" — the PR-E card scopes to token-addition-only so the no-rendered-change invariant holds; the 2-callsite replacement moves to Wave-2.
- **No value mutation.** No existing SPACING/RADIUS value, TYPOGRAPHY group, SURFACE/STATUS/ARGUMENT color, or SPACING_PRESET changes. The pins that assert existing values stay byte-identical.
- **F-10 chip-tint COLORS (`#111827` / `#0c4a6e` / `#1e3a5f`) — DEFERRED to P2-2, not in PR-E.** Although pure-add, they are a *color* finding (F-10 Era-A′ consolidation) whose only purpose is the 4-file room/gallery literal→reference migration that P2-2 performs; naming three chip-background colors with no consumer risks mis-naming, and the audit itself sequences the chip tints as the token that move-10/F-10 consumes. PR-E's coherent charter is dimension/motion/scrim/glyph scaffolding. (The card explicitly made this rider optional and at the designer's discretion.)
- **No reduce-motion wiring, no Animated changes** — MOTION is inert data; threading `useReduceMotion` is P2-12.
- **No new dependency, migration, Edge Function, RLS, or `.env` change.**
- **No v1-scope-guarded feature** (no voting/search/OAuth/push/public API) — n/a; this is a token file.

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth/verdict labels):** every new key/value is geometry (px/ms/radius), opacity, typography metrics, or a chrome glyph. The `check` glyph is documented and tested as *presence/completion*, never *correct/true*. A new ban-list test scans all new tokens for verdict vocabulary. **Respected.**
- **cdiscourse-doctrine §2 (heat = activity, not truth):** no token encodes heat; SCRIM darkens for legibility/focus, MOTION times transitions — neither ranks or warms by importance. **Respected.**
- **cdiscourse-doctrine §3 (popularity ≠ evidence):** ban-list includes `popular/trending/viral/amplification/engagement`; none appear. **Respected.**
- **cdiscourse-doctrine §6/§7 (secrets / no AI in app):** no secret reference, no AI-provider import; `glyphs.ts` imports nothing. The `uxOneOneSixDoctrine` secret + AI-import scans over designTokens.ts stay green. **Respected.**
- **cdiscourse-doctrine §5 (engine purity):** the rules engine is untouched; the token layer stays pure-TS (no React/Supabase/network). **Respected.**
- **timeline-grammar (visual grammar, no truth drift):** glyphs/scrim/motion are chrome tokens; none introduce a node visual state or a strength/heat encoding, and no label vocabulary changes. **Respected.**
- **test-discipline:** tests ship WITH the code (pin extensions + a dedicated new-token file with existence/shape/value/aggregation/byte-identity/ban-list coverage). Count goes up. **Respected.**
- **UX-001.7 additive-against-pins precedent:** keys added AND exact-key `toEqual` arrays + `toHaveLength`/counts extended to match, existing exports byte-identical, aggregate grows deliberately. **Followed.**

---

## Operator steps (if any)

**None — pure code change.** No `supabase db push`, no `functions deploy`, no env var, no manual deploy. The tokens are inert until a Wave-2 card consumes them.

**Operator-deferred review (interpretive-ledger items to confirm before Wave-2 consumes the tokens):**
1. `body = 15/21` (AUDIT §4) vs the more-frequent `fontSize:14` literal — confirm the canonical body size.
2. Interior key names `xxs`/`xs6`/`m10` (SPACING) and `sm6`/`md10` (RADIUS) — confirm or rename (cheap; zero consumers).
3. Deferral of the F-10 chip-tint colors to P2-2 — confirm they should not ride PR-E.

---

## Scanner-hazard checklist (for the implementer)

- **Apostrophe / naive-STRING_RE scanner (`uxOneOneTwoDoctrine`):** `designTokens.ts` is **NOT** in that scanner's file list (verified — the file already contains many apostrophes in comments and passes). New comments may use apostrophes safely. `glyphs.ts` and the new test file are not in it either. **Clear.**
- **`uxOneOneSixDoctrine` verdict-declaring-file scan (designTokens.ts IS scanned):** every occurrence of a verdict token in designTokens.ts must sit inside a `FORBIDDEN_`/`BANNED_` declaration OR on a comment line. Do **not** introduce `winner/loser/liar/verdict/correctness/truth value/proof of/this is wrong|false|invalid` as executable (non-comment) tokens. The new keys/values contain none. Keep doc-comments clean (the `check` comment says "not a truth or correctness mark" — fine as a comment, but the word `correct` must never appear in a *key or string value*). **Clear.**
- **`uxOneOneSixDoctrine` internal-code / secret / AI-import scans:** no `*_lexical`/`anti_amplification`/etc. codes, no `SERVICE_ROLE`/`*_API_KEY`, no `@anthropic-ai/`/`openai`/… imports added. **Clear.**
- **`uxOneOneFiveALabelDoctrine.test.ts:395-402`:** do not write the literal `UX-001.5A` in designTokens.ts. **Clear.**
- **GLYPHS unicode:** the 13 chars are pure structural chrome (arrows/triangles/circles/diamonds/bullet/check/callback/reply). None is a red-family color, none is a word a verdict/red scanner matches (scanners match word tokens, not single glyphs). Emoji (🔒/⚑/🗑/😂) are deliberately excluded to keep the vocabulary structural and avoid any domain/sensitivity question. **Clear.**
- **SCRIM `#020617` / `rgba(2,6,23,…)`:** the base is the existing interior surface base (SURFACE.base.bg), not a red-family color. **Clear.**
- **The new-token ban-list test** (in `uxPrETokenExports.test.ts`) scans keys + string values for verdict/heat/popularity vocabulary — the enforcement the checklist above assumes.

---

## One-paragraph summary for the reviewer

PR-E adds six inert token families to `src/lib/designTokens.ts` plus one new pure-TS module `src/lib/glyphs.ts`, all additive with zero consumer migration and zero value mutation: **SPACING** `xxs:2`/`xs6:6`/`m10:10` (F-06), **RADIUS** `sm6:6`/`md10:10` (F-07), five **TYPOGRAPHY** roles `microLabel 10/14/600`, `bodySm 13/18/400`, `body 15/21/400`, `titleSm 16/22/600`, `title 18/24/700` (F-09, 10→15 groups), **SCRIM** `{light:'rgba(2,6,23,0.45)', medium:'…0.6…', heavy:'…0.8…'}` (F-18), **MOTION** `{fastMs:140, baseMs:160, slowMs:180}` (F-26), and **GLYPHS** — 13 unicode chrome glyphs in `glyphs.ts`, re-exported and aggregated into `TOKENS` (F-20). `MOTION`/`SCRIM`/`GLYPHS` join the `TOKENS` aggregate (16→19 keys). Exactly five pin assertions are extended to match — `designTokens.test.ts` SPACING keys → `['l','m','m10','s','xl','xs','xs6','xxs']`, RADIUS keys → `['lg','md','md10','pill','sm','sm6']`, TOKENS keys → the 19-key array (with `motion`/`scrim`/`glyphs`); `uxOneOneSevenTokenExports.test.ts` TYPOGRAPHY array → the 15-key array and `toHaveLength(10)→(15)` — while every existing key/value stays byte-identical, the UX-001.7 grand-total recomputes to 32 ≤ 50 unchanged, and no component, snapshot, migration, or dependency is touched. The reviewer should verify the extended arrays are complete and correctly sorted, that no existing value changed, that the new `uxPrETokenExports.test.ts` covers existence/shape/aggregation/byte-identity/doctrine-ban-list, and that `git status` shows only these five files.
