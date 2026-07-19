# UX-P2-2 — Era-A′ token migration (chip-tint tokens + byte-identical literal linkage)

**Status:** Design draft
**Epic:** Visual cohesion / design-token system (COHESION principle #2 — tokens by reference)
**Release:** Wave-2 (Era-A′)
**Issue:** https://github.com/kyleruff1/cDiscourse/issues/935

---

## Goal (one paragraph)

Era-A (UX-PR-D) proved four "canonical" files hex-clean and froze them with the
principle-#2 ratchet (`cohesionPrinciple2Guard`). Era-A′ (this card, UX-P2-2) is
the next slice: it (1) mints **three chip-tint SURFACE tokens** that today exist
only as repeated raw literals with real consumers, and (2) migrates the
already-token-matching color literals in **exactly five named files** from raw
hex to token references. This is a **byte-identical token-linkage refactor** —
every migrated reference resolves to the *exact same hex value* the literal held,
so no pixel changes. The doctrine that shapes the design: cdiscourse-doctrine
§1–§3 (a tint never encodes truth / heat / popularity — a chip is legible by its
glyph + text, never by fill alone), the COHESION principle #2 (a surface
references a token; it never hardcodes a hex that *happens to match* a token
value), and the "do-not-overbuild" rule (a token is justified only by ≥2 real
consumers; single-consumer literals stay literals). Two ratchets constrain the
work: the principle-#9 red guard (which scans `ConversationGalleryScreen.tsx`)
and the principle-#2 clean-set guard.

---

## Data model

**No new runtime data model** (no SQL, no types beyond a token export). One new
color-token export in `src/lib/designTokens.ts`:

```ts
// ── UX-P2-2 — Chip-tint surface tokens (Era-A-prime) ────────────
//
// Three inset-chip SURFACE tints promoted from repeated raw literals. Each is a
// chip fill or a span-highlight background only -- never a text color, never a
// verdict / heat / popularity signal (cdiscourse-doctrine sections 1-3). A chip
// is recognizable by its glyph plus text; the tint is supplementary. Consumers
// and byte-identity proofs live in docs/designs/UX-P2-2.md.
//
//   - quote  : quote / inset-context chip fill  (15 files use this value today)
//   - proof  : proof / receipt chip fill        (9 files use this value today)
//   - marker : timestamp-marker source-span highlight tint (single consumer today
//              -- added as a deliberate design-system tint; see Risks + ledger)
export const CHIP_TINT = {
  quote:  '#111827',
  proof:  '#0c4a6e',
  marker: '#1e3a5f',
} as const;

export type ChipTintKey = keyof typeof CHIP_TINT;
```

**Home decision:** a **new top-level `CHIP_TINT` export** (not an extension of an
existing group). Rationale: adding keys to `STATUS` / `SURFACE` / `ARGUMENT`
would break their exact-key `toEqual` pins in `designTokens.test.ts` (lines
45–59) and would mis-file a chip surface tint under a semantic that is not its
own. A dedicated export mirrors how `SURFACE_TOKENS`, `CONTROL`, `MOTION`,
`SCRIM`, `GLYPHS` were each added as their own export.

**Aggregation decision:** **YES — aggregate into `TOKENS` as `chipTint`**, exactly
per the PR-E playbook (PR-E added `motion` / `scrim` / `glyphs` to `TOKENS` and
extended the `designTokens.test.ts` key pin). Add to the aggregate (line ~710):

```ts
export const TOKENS = {
  // …existing keys unchanged…
  scrim: SCRIM,
  glyphs: GLYPHS,
  chipTint: CHIP_TINT, // UX-P2-2 — additive only; existing keys above unchanged.
} as const;
```

This keeps `getToken('chipTint.quote')` discoverable and keeps `CHIP_TINT`
consistent with every other color family. The cost is one pin edit
(`designTokens.test.ts`, below), which is the PR-E-sanctioned pattern.

---

## File changes

**Production source (5 named files — color-literal → token linkage, byte-identical):**

- `src/lib/designTokens.ts` — **modify.** Add the `CHIP_TINT` export + `ChipTintKey`
  type; add `chipTint: CHIP_TINT` to the `TOKENS` aggregate. ~15 added lines,
  zero existing bytes changed.
- `src/features/arguments/room/RingsideCard.tsx` — **modify.** Add
  `import { SURFACE_TOKENS, CHIP_TINT } from '../../../lib/designTokens';`.
  Migrate 4 module consts + StyleSheet literals per the table below. ~1 import
  line + ~17 in-place value swaps.
- `src/features/debates/ConversationGalleryScreen.tsx` — **modify.** Add
  `import { SURFACE_TOKENS } from '../../lib/designTokens';` (no CHIP_TINT — the
  gallery carries none of the 3 tints). Migrate the surface-bg / text / placeholder
  / inputBg literals per the table. ~1 import + ~24 in-place swaps. **Reds
  `#7f1d1d` / `#fecaca` left byte-for-byte untouched.**
- `src/features/arguments/RoomBoardLayout.tsx` — **modify.** Already imports
  `{ BORDER_WIDTH, SURFACE_TOKENS }`; extend that import is unnecessary
  (`SURFACE_TOKENS` already present). Migrate the sole hex `#020617` → base. ~1
  swap. Becomes **hex-clean** (see #2-SCAN_SET recommendation).
- `src/features/debates/RoomSettledNotice.tsx` — **modify.** Add
  `import { SURFACE_TOKENS } from '../../lib/designTokens';`. Migrate 4 literals
  per table. ~1 import + ~4 swaps.
- `src/features/arguments/markers/TimestampMarker.tsx` — **modify.** Add
  `import { SURFACE_TOKENS, CHIP_TINT } from '../../../lib/designTokens';`.
  Migrate 6 literals (incl. `:125` marker tint) per table. ~1 import + ~8 swaps.

**Tests:**

- `__tests__/designTokens.test.ts` — **modify (pin extension).** Add `'chipTint'`
  to the exact-key `toEqual` list (line 62) and bump the title wording
  ("nineteen" → "twenty"). This is the ONLY existing pin the aggregation touches.
- `__tests__/cohesionPrinciple2Guard.test.ts` — **modify (optional enhancement,
  recommended).** Add `RoomBoardLayout.tsx` to `SCAN_SET_P2`: extend the exact
  `toEqual([…])` array to 5 paths and `toHaveLength(4)` → `toHaveLength(5)`.
- `__tests__/uxP2TwoChipTintMigration.test.ts` — **new.** CHIP_TINT export
  contract + byte-value pins + ban-list; per-migrated-token value pins
  (byte-identity); and the **no-new-hex guard** for the 5 files with explicit
  per-file keep-lists. ~180 lines. Structure mirrors `cohesionPrinciple2Guard` +
  `uxPrETokenExports`.

**No deletions. No new dependency. No app/ change. No SQL/Edge/RLS.**

Confirmed paths (grep-verified): `RoomBoardLayout.tsx` lives at
`src/features/arguments/RoomBoardLayout.tsx` (NOT `.../arguments/room/`);
`RoomSettledNotice.tsx` lives at `src/features/debates/RoomSettledNotice.tsx`.

---

## API / interface contracts

New export only (no call-site API change — token references are plain constants):

```ts
export const CHIP_TINT: {
  readonly quote:  '#111827';
  readonly proof:  '#0c4a6e';
  readonly marker: '#1e3a5f';
};
export type ChipTintKey = 'quote' | 'proof' | 'marker';
// Reachable as TOKENS.chipTint and getToken('chipTint.quote' | 'chipTint.proof' | 'chipTint.marker').
```

### The migration decision rule (the contract the implementer follows)

For every quoted color-hex literal in the 5 files, classify:

1. **Value equals one of the 3 new chip tints** → reference `CHIP_TINT.{quote|proof|marker}`.
2. **Value equals an existing token AND the token is a GENERAL, role-compatible
   token** → reference it. "General role-compatible" means:
   - surface/background usage ↔ `SURFACE_TOKENS.{base, elevated, overlay, inputBg}`
   - border/hairline usage ↔ `SURFACE_TOKENS.{border, inputBorder, divider}`
   - body/label/timestamp text ↔ `SURFACE_TOKENS.{textPrimary, textSecondary, textMuted}`
   - TextInput placeholder ↔ `SURFACE_TOKENS.placeholder`
3. **Otherwise KEEP literal** — this covers (a) values with NO matching token, and
   (b) values whose only token match is **component/state-scoped** (`RAIL.*`,
   `STATUS.*`, `CONTROL.*`, `GLOW.*`, `ARGUMENT.*`) or **role-mismatched** (a
   foreground token value used as a background, a status-fg value used as body
   text). Borrowing a component-scoped token into an unrelated surface is a
   coupling the token system is meant to avoid, and re-toning it later would
   silently change an unrelated surface. Do-not-overbuild: do not mint a new
   token for these (they are not among the 3 sanctioned tints).
4. **`#9`-allowlisted content reds** (`#7f1d1d`, `#fecaca` in the gallery) →
   LEAVE untouched (see Guard interactions).

The token value **must equal** the literal exactly. Every mapping below pastes the
token's value next to the literal to prove equality (source: `designTokens.ts`).

---

## Per-file migration tables

Legend: **M** = migrate to the named token (value proven equal). **K** = keep
literal (reason). Token values verified against `src/lib/designTokens.ts`.

### 1. `RingsideCard.tsx`

| Line | Literal | Usage | Decision | Token (value) / keep reason |
|---|---|---|---|---|
| 66 | `#4338ca` | `PRIMARY_BG` const (actionChipPrimary bg) | **K** | no token has this value (CONTROL.primary.bg is `#4f46e5`) |
| 67 | `#1e293b` | `GHOST_BG` const (actionChipGhost bg) | **K** | value = `SURFACE_TOKENS.border`, but role is a **background**; no SURFACE surface token = `#1e293b` |
| 68 | `#334155` | `GHOST_BORDER` const (chip border) | **M** | `SURFACE_TOKENS.inputBorder` (`#334155`) — border↔border |
| 69 | `#334155` | `DISABLED_BG` const (actionChipDisabled bg) | **K** | value = inputBorder, but role is a **background**; no surface token = `#334155` |
| 419 | `#0b1220` | card bg | **M** | `SURFACE_TOKENS.elevated` (`#0b1220`) |
| 421 | `#1e293b` | card borderColor | **M** | `SURFACE_TOKENS.border` (`#1e293b`) — border↔border |
| 427 | `#6366f1` | cardActive borderColor | **K** | only match is `RAIL.active.borderColor` (rail-scoped); no general indigo-500 accent token |
| 428 | `#0f172a` | cardActive bg | **M** | `SURFACE_TOKENS.overlay` (`#0f172a`) |
| 435 | `#cbd5e1` | headerMeta text | **K** | only match is `STATUS.neutral.fg` (status-scoped); no text token = `#cbd5e1` |
| 436 | `#64748b` | headerTime text | **M** | `SURFACE_TOKENS.textMuted` (`#64748b`) — timestamp role |
| 445 | `#475569` | quoteChip borderLeft | **K** | no token has this value |
| 446 | `#111827` | quoteChip bg | **M** | `CHIP_TINT.quote` (`#111827`) |
| 450 | `#94a3b8` | quoteChipText | **M** | `SURFACE_TOKENS.textSecondary` (`#94a3b8`) |
| 451 | `#e2e8f0` | body text | **M** | `SURFACE_TOKENS.textPrimary` (`#e2e8f0`) |
| 461 | `#334155` | respondToThis borderColor | **M** | `SURFACE_TOKENS.inputBorder` (`#334155`) |
| 462 | `#111827` | respondToThis bg | **M** | `CHIP_TINT.quote` (`#111827`) |
| 467 | `#a5b4fc` | respondToThisText | **K** | value = `SURFACE_TOKENS.focusRing`/`GLOW.activePath.color`, but role is **text**; no text token = `#a5b4fc` |
| 473 | `#0c4a6e` | proofChip bg | **M** | `CHIP_TINT.proof` (`#0c4a6e`) |
| 477 | `#bae6fd` | proofChipText | **K** | no token has this value |
| 484 | `#0d9488` | owedChip borderColor | **K** | no token has this value |
| 485 | `#0b1220` | owedChip bg | **M** | `SURFACE_TOKENS.elevated` (`#0b1220`) |
| 489 | `#5eead4` | owedChipText | **K** | no token has this value |
| 495 | `#334155` | branchPill borderColor | **M** | `SURFACE_TOKENS.inputBorder` (`#334155`) |
| 496 | `#111827` | branchPill bg | **M** | `CHIP_TINT.quote` (`#111827`) |
| 501 | `#a5b4fc` | branchPillText | **K** | text role; no text token = `#a5b4fc` |
| 515 | `#f8fafc` | actionChipTextPrimary | **K** | no token has this value |
| 516 | `#cbd5e1` | actionChipTextGhost | **K** | status-scoped only; no text token = `#cbd5e1` |

Post-migration KEEP-LIST (unique on-disk hexes): `#4338ca, #1e293b, #334155,
#6366f1, #cbd5e1, #475569, #a5b4fc, #bae6fd, #0d9488, #5eead4, #f8fafc`.
(Note `#1e293b` remains only at L67, `#334155` only at L69 — the border usages
migrated; the background usages stayed. This role-split is intentional.)

### 2. `ConversationGalleryScreen.tsx`

Migrate the surface-bg / text / placeholder / inputBg matches; keep every
component/heat/indigo-scoped color and both allowlisted reds.

| Line(s) | Literal | Usage | Decision | Token (value) / keep reason |
|---|---|---|---|---|
| 132 | `#1e293b` / `#94a3b8` | `HEAT_TONE.cold` bg/fg | **K** | heat-tone data (P2-9 re-tone); role is a heat pill, not border/secondary-text |
| 133 | `#7c2d12` / `#fed7aa` | `HEAT_TONE.warming` | **K** | rust/amber heat tone (P2-9) |
| 134 | `#9a3412` / `#fde68a` | `HEAT_TONE.hot` | **K** | rust/amber heat tone (P2-9); `#9a3412` also = ARGUMENT.challenge.bg (component) |
| 135 | `#7f1d1d` / `#fecaca` | `HEAT_TONE.overheated` | **K (hard)** | **#9-allowlisted red — leave untouched** |
| 307 | `#64748b` | search `placeholderTextColor` | **M** | `SURFACE_TOKENS.placeholder` (`#64748b`) — exact role |
| 751 | `#020617` | container bg | **M** | `SURFACE_TOKENS.base` (`#020617`) |
| 753 | `#f8fafc` | title color | **K** | no token |
| 754 | `#94a3b8` | subtitle color | **M** | `SURFACE_TOKENS.textSecondary` |
| 757 | `#0b1220` | search **bg** | **M** | `SURFACE_TOKENS.inputBg` (`#0b1220`) — TextInput role |
| 757 | `#f8fafc` | search color | **K** | no token |
| 757 | `#1f2937` | search borderColor | **K** | no general border token = `#1f2937` (border is `#1e293b`); only RAIL.inactive/STATUS.neutral |
| 758 | `#312e81` | newButton bg | **K** | only match RAIL.active.bg / CONTROL.primary.disabledBg (component) |
| 759 | `#fff` | newButtonText | **K** | no token |
| 763 | `#0b1220` | bucketChip bg | **M** | `SURFACE_TOKENS.elevated` |
| 763 | `#1f2937` | bucketChip borderColor | **K** | component-scoped (see 757) |
| 764 | `#312e81` ×2 | bucketChipActive bg/border | **K** | component indigo |
| 765 | `#94a3b8` | bucketChipText | **M** | `SURFACE_TOKENS.textSecondary` |
| 766 | `#fff` | bucketChipTextActive | **K** | no token |
| 770 | `#1f2937` | sortChip borderColor | **K** | component-scoped |
| 771 | `#a5b4fc` | sortChipActive borderColor | **K** | active-state border ≠ focus ring; no general accent token = `#a5b4fc` |
| 771 | `#1e1b4b` | sortChipActive bg | **K** | no token |
| 772 | `#64748b` | sortChipText | **M** | `SURFACE_TOKENS.textMuted` |
| 773 | `#e2e8f0` | sortChipTextActive | **M** | `SURFACE_TOKENS.textPrimary` |
| 776 | `#64748b` | countText | **M** | `SURFACE_TOKENS.textMuted` |
| 778 | `#0b1220` | pageSizeChip bg | **M** | `SURFACE_TOKENS.elevated` |
| 778 | `#1f2937` | pageSizeChip borderColor | **K** | component-scoped |
| 779 | `#a5b4fc` | pageSizeChipActive borderColor | **K** | see 771 |
| 780 | `#94a3b8` | pageSizeText | **M** | `SURFACE_TOKENS.textSecondary` |
| 781 | `#e2e8f0` | pageSizeTextActive | **M** | `SURFACE_TOKENS.textPrimary` |
| 783 | `#7f1d1d` | errorBanner bg | **K (hard)** | **#9-allowlisted red — leave untouched** |
| 784 | `#fecaca` | errorText | **K (hard)** | **#9-allowlisted red — leave untouched** |
| 792 | `#e2e8f0` | laneHeaderLabel | **M** | `SURFACE_TOKENS.textPrimary` |
| 793 | `#94a3b8` | laneHeaderHelper | **M** | `SURFACE_TOKENS.textSecondary` |
| 795 | `#0b1220` | card bg | **M** | `SURFACE_TOKENS.elevated` |
| 795 | `#1f2937` | card borderColor | **K** | component-scoped |
| 796 | `#a5b4fc` | cardPressed borderColor | **K** | see 771 |
| 799 | `#a5b4fc` | cardHeadline text | **K** | text role; no text token = `#a5b4fc` |
| 802 | `#1f2937` | tempPill bg | **K** | component pill fill; no general surface token = `#1f2937` |
| 803 | `#94a3b8` | tempPillText | **M** | `SURFACE_TOKENS.textSecondary` |
| 804 | `#78350f` | botPill bg | **K** | = STATUS.warning.bg (component); amber tone (P2-9) |
| 805 | `#fef3c7` | botPillText | **K** | = ARGUMENT.clarify.fg (component) |
| 808 | `#134e4a` | visibilityPill bg | **K** | no token |
| 809 | `#4c1d95` | visibilityPillPrivate bg | **K** | no token |
| 810 | `#e2e8f0` | visibilityPillText | **M** | `SURFACE_TOKENS.textPrimary` |
| 812 | `#f8fafc` | cardTitle | **K** | no token |
| 813 | `#64748b` | starter | **M** | `SURFACE_TOKENS.textMuted` |
| 817 | `#64748b` | excerptLabel | **M** | `SURFACE_TOKENS.textMuted` |
| 818 | `#cbd5e1` | excerptText | **K** | status-scoped; no text token = `#cbd5e1` |
| 822 | `#f8fafc` | statValue | **K** | no token |
| 823 | `#64748b` | statLabel | **M** | `SURFACE_TOKENS.textMuted` |
| 826 | `#1f2937` | signalChip bg | **K** | component pill fill |
| 827 | `#7f1d1d` | signalChipCritical bg | **K (hard)** | **#9-allowlisted red — leave untouched** |
| 828 | `#7c2d12` | signalChipWarning bg | **K** | rust tone (P2-9) |
| 829 | `#064e3b` | signalChipPositive bg | **K** | no token |
| 830 | `#f8fafc` | signalChipText | **K** | no token |
| 832 | `#94a3b8` | accessLine | **M** | `SURFACE_TOKENS.textSecondary` |
| 834 | `#a5b4fc` | actionText | **K** | text role; no text token = `#a5b4fc` |
| 835 | `#64748b` | actionTextSecondary | **M** | `SURFACE_TOKENS.textMuted` |
| 837 | `#0b1220` | pagerRow bg | **M** | `SURFACE_TOKENS.elevated` |
| 837 | `#1f2937` | pagerRow borderTopColor | **K** | component-scoped |
| 838 | `#1f2937` | pageButton bg | **K** | component pill fill |
| 840 | `#e2e8f0` | pageButtonText | **M** | `SURFACE_TOKENS.textPrimary` |
| 841 | `#94a3b8` | pageStatus | **M** | `SURFACE_TOKENS.textSecondary` |

Post-migration KEEP-LIST (unique): `#1e293b, #94a3b8, #7c2d12, #fed7aa, #9a3412,
#fde68a, #7f1d1d, #fecaca, #f8fafc, #1f2937, #312e81, #fff, #1e1b4b, #a5b4fc,
#78350f, #fef3c7, #134e4a, #4c1d95, #cbd5e1, #064e3b`. (`#1e293b`/`#94a3b8`
remain only in `HEAT_TONE` at L132 — the text/border usages elsewhere migrated;
this role-split is intentional.)

### 3. `RoomBoardLayout.tsx`

| Line | Literal | Usage | Decision | Token (value) |
|---|---|---|---|---|
| 165 | `#020617` | outer bg | **M** | `SURFACE_TOKENS.base` (`#020617`) |

`SURFACE_TOKENS` is already imported (L33). Post-migration KEEP-LIST: **empty →
file is hex-clean.**

### 4. `RoomSettledNotice.tsx`

| Line | Literal | Usage | Decision | Token (value) / keep reason |
|---|---|---|---|---|
| 105 | `#0f172a` | container bg | **M** | `SURFACE_TOKENS.overlay` (`#0f172a`) |
| 107 | `#1f2937` | container borderTopColor | **K** | no general border/divider token = `#1f2937` (divider is `#15202e`); only RAIL.inactive/STATUS.neutral |
| 115 | `#e2e8f0` | title color | **M** | `SURFACE_TOKENS.textPrimary` |
| 119 | `#94a3b8` | body color | **M** | `SURFACE_TOKENS.textSecondary` |
| 129 | `#475569` | reopenButton borderColor | **K** | no token |
| 130 | `#1e293b` | reopenButton bg | **K** | value = border token, role is a **background**; no surface token = `#1e293b` |
| 137 | `#e2e8f0` | reopenLabel color | **M** | `SURFACE_TOKENS.textPrimary` |
| 141 | `#fca5a5` | errorText color | **K** | value = `CONTROL.danger.fg`, but CONTROL is button-intent-scoped and `#fca5a5` is red-family (P2-9 owns red re-tone); keep literal |

Post-migration KEEP-LIST: `#1f2937, #475569, #1e293b, #fca5a5`.

### 5. `TimestampMarker.tsx`

| Line | Literal | Usage | Decision | Token (value) / keep reason |
|---|---|---|---|---|
| 122 | `#e2e8f0` | sourceSpanBody text | **M** | `SURFACE_TOKENS.textPrimary` |
| 125 | `#1e3a5f` | sourceSpanMarked bg (marker tint) | **M** | `CHIP_TINT.marker` (`#1e3a5f`) |
| 126 | `#f8fafc` | sourceSpanMarked text | **K** | no token |
| 137 | `#6366f1` | replyChip borderLeft | **K** | only match RAIL.active.borderColor (rail-scoped) |
| 138 | `#111827` | replyChip bg | **M** | `CHIP_TINT.quote` (`#111827`) |
| 142 | `#a5b4fc` | replyChipText | **K** | text role; no text token = `#a5b4fc` |
| 153 | `#6366f1` | scopeChip borderLeft | **K** | rail-scoped (see 137) |
| 154 | `#111827` | scopeChip bg | **M** | `CHIP_TINT.quote` (`#111827`) |
| 157 | `#a5b4fc` | scopeChipText | **K** | text role |
| 164 | `#94a3b8` | scopeClearGlyph text | **M** | `SURFACE_TOKENS.textSecondary` |
| 172 | `#475569` | orphanChip borderLeft | **K** | no token |
| 173 | `#0b1220` | orphanChip bg | **M** | `SURFACE_TOKENS.elevated` |
| 178 | `#94a3b8` | orphanText | **M** | `SURFACE_TOKENS.textSecondary` |
| 179 | `#64748b` | orphanQuote | **M** | `SURFACE_TOKENS.textMuted` |

Post-migration KEEP-LIST: `#f8fafc, #6366f1, #a5b4fc, #475569`.

> **Out-of-5-files reminder (issue #935 point 3):** do NOT migrate the tint
> literals in the ~15 other `#111827` / ~9 other `#0c4a6e` consumers (e.g.
> `MapView.tsx`, `EvidenceAnnotationChip.tsx`). The token now *exists* for a
> future opportunistic pass; this card touches only the 5 named files.

---

## Edge cases

- **A value matches multiple tokens.** `#0b1220` = `SURFACE_TOKENS.elevated` =
  `SURFACE_TOKENS.inputBg` = `SURFACE.elevated.bg` = `CONTROL.secondary.bg`.
  Choose by role: TextInput bg → `inputBg` (gallery search L757); every other
  surface → `elevated`. `#64748b` = `textMuted` = `placeholder`: placeholderTextColor
  → `placeholder`; other text → `textMuted`. Both branches are byte-identical.
- **Same value, two roles in one file.** `#1e293b` migrates as a card border
  (→ `border`) but stays literal as a chip background (RingsideCard `GHOST_BG`);
  `#94a3b8` migrates as secondary text but stays literal as `HEAT_TONE.cold.fg`.
  This role-split is intentional and correct — link the token where the role
  matches, keep the literal where it does not.
- **Removing an allowlisted red.** Migrating or deleting `#7f1d1d` / `#fecaca`
  from the gallery would break the #9 allowlist-completeness ratchet ("every
  allowlist entry is still on disk"). Both are left byte-for-byte untouched.
- **Introducing a new red.** No migration references a red-family token value
  (`textMuted`/`textSecondary`/`textPrimary`/`base`/`elevated`/`inputBg`/
  `placeholder` are all non-red); token references are not quoted-hex, so the #9
  scanner never sees them. Net red count in the gallery is unchanged.
- **Wrong import depth.** From `.../arguments/room/` and `.../arguments/markers/`
  the path is `../../../lib/designTokens`; from `.../debates/` it is
  `../../lib/designTokens`; `RoomBoardLayout.tsx` already imports correctly. A
  wrong relative path passes jest (mocked) but breaks `web:build` — hence
  `web:build` is a required gate (see Test plan).
- **Scanner hazards (must handle exactly):**
  - Any migration-note comment references the card as `(issue 935)` — **never**
    `(#935)` — so no scanner reads a hex-shaped token. Never place an issue
    number inside quotes.
  - All comments stay **apostrophe-free** — `RingsideCard.tsx` and
    `TimestampMarker.tsx` are scanned by `uxOneOneTwoDoctrine`'s naive
    quote-parity scanner (one stray apostrophe poisons string parsing file-wide).
  - `ConversationGalleryScreen.tsx` is #9-scanned: introduce no quoted `#NNN`
    that decodes to a red hex.
- **`#1e3a5f` is single-consumer today** (only `TimestampMarker:125`). Minting a
  token for it is a documented deviation from the ≥2-consumer rule — see Risks +
  the operator ledger. It does not block; the card explicitly sanctions all 3
  tints as a coherent design-system set.

---

## Test plan

All in `__tests__/`. Pure-TS where possible (no React needed for the guards).

**A. New — `__tests__/uxP2TwoChipTintMigration.test.ts`:**

1. **CHIP_TINT export contract + byte values:**
   - `expect(CHIP_TINT).toEqual({ quote: '#111827', proof: '#0c4a6e', marker: '#1e3a5f' })`.
   - `expect(Object.keys(CHIP_TINT).sort()).toEqual(['marker', 'proof', 'quote'])`.
   - `expect(TOKENS.chipTint).toBe(CHIP_TINT)` and
     `expect(getToken('chipTint.quote')).toBe('#111827')` (+ proof/marker).
2. **Ban-list** (mirror `uxOneOneSeven` scan): CHIP_TINT keys + values contain no
   verdict/heat/popularity vocabulary.
3. **Byte-identity pins** (any token drift fails loudly): assert each migration
   target's value —
   `SURFACE_TOKENS.base==='#020617'`, `elevated==='#0b1220'`, `inputBg==='#0b1220'`,
   `overlay==='#0f172a'`, `border==='#1e293b'`, `inputBorder==='#334155'`,
   `placeholder==='#64748b'`, `textMuted==='#64748b'`, `textSecondary==='#94a3b8'`,
   `textPrimary==='#e2e8f0'`; `CHIP_TINT.quote/proof/marker` as above.
4. **No-new-hex guard** (mirror `cohesionPrinciple2Guard` scanner
   `/['"\`]#[0-9a-fA-F]{3,8}\b/g`): for each of the 5 files —
   - `quotedColorHex(file)` ⊆ that file's KEEP_LIST (below), AND
   - KEEP_LIST ⊆ `quotedColorHex(file)` (bidirectional, so the list cannot rot),
   - AND `quotedColorHex(file)` contains none of `#111827` / `#0c4a6e` / `#1e3a5f`
     (the 3 tints must be token refs, never literals, in these files).
   - Firing control: a seeded `"x: '#abcabc'"` appended to a file's source is an
     offender; a seeded `'#111827'` is caught by the tint-absence assertion.
   - Must-NOT-fire control: an unquoted `// (issue 935)` comment is not flagged.

   **KEEP_LISTs** (exact, per the tables above):
   - RingsideCard: `['#4338ca','#1e293b','#334155','#6366f1','#cbd5e1','#475569','#a5b4fc','#bae6fd','#0d9488','#5eead4','#f8fafc']`
   - ConversationGalleryScreen: `['#1e293b','#94a3b8','#7c2d12','#fed7aa','#9a3412','#fde68a','#7f1d1d','#fecaca','#f8fafc','#1f2937','#312e81','#fff','#1e1b4b','#a5b4fc','#78350f','#fef3c7','#134e4a','#4c1d95','#cbd5e1','#064e3b']`
   - RoomBoardLayout: `[]`
   - RoomSettledNotice: `['#1f2937','#475569','#1e293b','#fca5a5']`
   - TimestampMarker: `['#f8fafc','#6366f1','#a5b4fc','#475569']`

**B. Modify — `__tests__/designTokens.test.ts`:** add `'chipTint'` to the
`Object.keys(TOKENS).sort()` `toEqual` list (correct sorted position:
`…'brand', 'chipTint', 'control'…`), 19 → 20 entries; update the title string.

**C. Modify — `__tests__/cohesionPrinciple2Guard.test.ts`** (recommended, see
below): add `'src/features/arguments/RoomBoardLayout.tsx'` to `SCAN_SET_P2`'s
`toEqual([…])` and bump `toHaveLength(4)` → `(5)`.

**D. Regression — re-run green, must not change:**
`cohesionPrinciple9Guard` (gallery reds unchanged, both directions),
`darkSurfaceTokens`, `componentsDarkThemeGuard` (neither scans the 5 files),
`uxOneOneSevenTokenExports` / `uxPrETokenExports` (no exhaustive TOKENS-key or
TOKENS-length pin — verified; `chipTint` is not a UX-001.7 token so the `<=50`
sum is unaffected), plus the behavior/structure suites that mount the 5 files
(`ringsideFeed`, `timestampMarker`, `RoomSettledNotice`, `uxBoardRail002Topology`,
`ConversationGalleryScreen.visibility`, `a11y693AspSurfaceAudit`,
`uxOneOneTwoDoctrine`). A byte-identical color swap changes no JSX, testID,
a11y label, or comment, so these stay green.

**E. Doctrine ban-list:** no card-touched string is user-facing copy — the
migration only swaps color constants inside `StyleSheet.create`. No new
user-facing strings, so no new `gameCopy` mapping is needed.

---

## Byte-identity proof plan

Repo has **no jest snapshots**, so byte-identity is proven three ways:

1. **Per-migrated-ref value-equality** (Test A.3): every token consumed by the
   migration is pinned to its exact hex. Because each token value === the literal
   it replaced, every `StyleSheet.create` output object is byte-identical at
   runtime (RN resolves the constant to the same string). The migration tables
   above are the exhaustive enumeration that "no rendered style object changes":
   each **M** row swaps `'#xxxxxx'` → `TOKEN` where `TOKEN === '#xxxxxx'`; each
   **K** row is unchanged.
2. **`npm run web:build`** (`expo export --platform web`) — compiles the real
   Metro/web bundle, catching a wrong relative import path (which jest would mask
   because it mocks module resolution). Required gate for this card.
3. **`npm run typecheck` + `npm run lint` + `npm run test`** all exit 0 (capture
   the `Test Suites: … / Tests: …` line + explicit `EXIT: $?`).

No runtime style-object diff is possible when token value === literal value; the
value pins are the contract that keeps it that way.

---

## #2-SCAN_SET-addition recommendation

**RoomBoardLayout.tsx → YES (recommended).** Grep-verified: its **only** quoted
hex is `#020617` (L165); after `→ SURFACE_TOKENS.base` the file has **zero**
quoted color-hex, so `quotedColorHex(source).toEqual([])` passes. Adding it to
`SCAN_SET_P2` (extend the `toEqual` array to 5 entries + `toHaveLength(4)→(5)`)
protects the win from regressing. Low-risk; the file is already a token consumer
(`BORDER_WIDTH`, `SURFACE_TOKENS`).

**The other 4 → NO.** Each retains keep-list literals after migration
(RingsideCard 11, gallery 20, RoomSettledNotice 4, TimestampMarker 4), so they
are not hex-clean and would redden the #2 guard immediately. The new no-new-hex
guard (Test A.4) protects them instead, at the keep-list granularity.

---

## Dependencies (cards / docs / files)

- Reads `src/lib/designTokens.ts` — assumes the BRAND-002 `SURFACE_TOKENS` scale
  and `CONTROL` (PR present on `origin/main` @ 51b6b2df) and the PR-E `TOKENS`
  aggregate shape are as read here.
- Assumes UX-PR-D (#925) shipped both ratchet guards (`cohesionPrinciple2Guard`,
  `cohesionPrinciple9Guard`) — this card interacts with both.
- Assumes UX-PR-F / F-prime already removed the standing-band red from the #9
  allowlist values (the current gallery allowlist is exactly
  `['#7f1d1d','#fecaca']`).
- Unblocks a future opportunistic pass that migrates the remaining `#111827` /
  `#0c4a6e` consumers outside the 5 files (the token now exists for them).
- No card is blocked by this one; P2-9 (red re-tone) remains independent and
  owns every KEEP-listed red / rust / amber tone.

---

## Risks

| # | Risk | Mitigation |
|---|---|---|
| 1 | **`#1e3a5f` is single-consumer today** — minting `CHIP_TINT.marker` mildly bends the ≥2-consumer do-not-overbuild rule. | Card explicitly sanctions all 3 tints; documented here + in the operator ledger. The token-export test pins the value but does NOT assert ≥2 consumers for `marker`. Operator may elect to keep `#1e3a5f` literal and ship only `quote`+`proof` (see Out of scope note). |
| 2 | Removing an allowlisted red from the gallery breaks the #9 ratchet. | Reds are hard-KEEP; Test D re-runs `cohesionPrinciple9Guard` both directions. |
| 3 | Apostrophe in a new comment poisons the `uxOneOneTwoDoctrine` scanner (RingsideCard/TimestampMarker). | Migration notes are apostrophe-free; run the full suite pre-push. |
| 4 | Quoted issue-ref `'#935'` or a quoted red would trip the #2/#9 scanners. | Comments use unquoted `(issue 935)`; never quote issue numbers. |
| 5 | Wrong import depth passes jest but breaks the web bundle. | `web:build` is a required gate; depths specified above. |
| 6 | Role-split of a shared value (`#1e293b`, `#94a3b8`) looks inconsistent to a reviewer. | Documented as intentional in Edge cases + the tables; the no-new-hex keep-list encodes it. |
| 7 | `chipTint` added to `TOKENS` breaks the `designTokens.test.ts` key pin. | Pin extension is part of the card (Test B); it is the only pin the aggregation touches (verified `uxOneOneSeven` / `uxPrE` have no exhaustive TOKENS-key or length pin). |
| 8 | The no-new-hex guard cannot catch re-literalization of a *kept* value. | Accepted limitation (same as the #9 guard); the guard's job is preventing NEW unlinked values + enforcing tint-absence. |

---

## Out of scope

- **No hue/value change** — every migrated reference is byte-identical; this is
  linkage only.
- **No P2-9 work** — content-red re-toning (gallery heat maroon, flag red,
  standing-band, `#fca5a5` error red, rust/amber heat tones) stays untouched.
- **No P2-4 / P2-6 work** — no typography (fontSize/lineHeight/fontWeight) token
  migration, even where `TYPOGRAPHY.*` values coincide.
- **No migration outside the 5 named files** — the ~15 other `#111827` and ~9
  other `#0c4a6e` consumers are a later opportunistic pass.
- **No component-scoped value-borrows** — `RAIL.*` / `STATUS.*` / `CONTROL.*` /
  `GLOW.*` / `ARGUMENT.*` value-matches stay literal.
- **No new user-facing copy, no behavior change, no new dependency.**

---

## Doctrine self-check

- **cdiscourse-doctrine §1 (no truth labels):** the 3 tints are chip fills /
  span-highlight backgrounds only — never a verdict, strength, or truth signal;
  chips remain legible by glyph + text (timeline-grammar: color is supplementary).
  No score, no posting gate touched. Token keys `quote`/`proof`/`marker` carry no
  verdict vocabulary (ban-list test).
- **§2 (heat = activity):** every heat-tone literal (`HEAT_TONE`, `signalChip*`)
  is left as a literal — this card does not re-tone or re-map heat; P2-9 owns it.
- **§3 (popularity ≠ evidence):** untouched — no scoring/standing surface is in
  scope; `CHIP_TINT.proof` is a *receipt-chip fill*, not a factual-standing signal.
- **§9 (plain language):** no internal validation code enters any string; the
  change is color constants inside `StyleSheet.create`, no user-facing copy.
- **timeline-grammar:** `CHIP_TINT.marker` preserves the source-span highlight
  which already pairs tint + underline (grayscale-legible); this card only names
  the tint, changing no geometry, stroke, or shape.
- **expo-rn-patterns:** RN primitives only; no new dependency; token layer is the
  house pattern (`SURFACE_TOKENS`, PR-E). No AI, no Supabase, no service-role.
- **COHESION #2 (tokens by reference):** the core intent — a literal that
  *happens to match a token value* now references the token. **COHESION #9 (red =
  failure only):** allowlisted reds preserved; no new red introduced.
- **test-discipline:** tests ship with the card (new guard + pin extension +
  value pins); test count goes UP; no `.skip`/`.only`; gates verified by exit code.

---

## Orchestrator-authored brief ledger (issue #935)

This brief was **orchestrator-authored** (not operator-authored). Provenance:

- **Prior-Phase handoff / epic framing (operator-validated chain):** the 5 named
  files, the 3 tint values, the byte-identical mandate, the PR-E playbook, and
  the two ratchet-guard interactions — all supplied in the issue and confirmed
  against the codebase.
- **Pre-launch codebase survey (this design):** the per-file literal→token
  classification, the exact keep-lists, the import depths, the confirmed paths
  (`RoomBoardLayout` at `src/features/arguments/`), the ≥2-consumer counts
  (`#111827`=15 files, `#0c4a6e`=9 files, `#1e3a5f`=1 file), and the guard
  scan-set audit (`designTokens`/`uxOneOneSeven`/`uxPrE`/`darkSurface`/
  `componentsDarkTheme`).
- **Resolved by orchestrator default (not explicit operator direction):**
  1. The **migration decision rule** — migrate only GENERAL, role-compatible
     token matches; keep component-scoped value-matches literal. (Alternative: a
     strict "migrate every value-match" reading of the issue. Chosen the
     conservative rule for semantic hygiene + minimal coupling.)
  2. **KEEP `#fca5a5`** (RoomSettledNotice error text) rather than link it to
     `CONTROL.danger.fg` — treated as red / P2-9 territory + control-scoped.
  3. **Aggregate `chipTint` into `TOKENS`** (vs. leave `CHIP_TINT` un-aggregated).
  4. **Recommend adding `RoomBoardLayout` to `SCAN_SET_P2`.**

- **Operator-deferred review (post-ship targets):**
  1. **`#1e3a5f` single-consumer token** — proceed as a design-system tint, or
     drop it and keep the literal? (Risk #1.)
  2. **`#fca5a5` KEEP vs. `CONTROL.danger.fg`** — confirm the conservative call.
  3. **The GENERAL-only migration rule** — confirm the design should NOT migrate
     component-scoped value-matches (`#6366f1`→RAIL, `#cbd5e1`→STATUS,
     `#312e81`→RAIL/CONTROL). If the operator prefers maximal cohesion, a
     follow-up can broaden the rule.
  4. **`RoomBoardLayout` → `SCAN_SET_P2`** — approve the optional guard extension.

---

## Operator steps (if any)

**None — pure code change.** No migration, no Edge deploy, no env var. Standard
gates only: `npm run typecheck && npm run lint && npm run test && npm run web:build`.
