/**
 * VG-003 — Bootstrap-inspired design tokens.
 *
 * A single token layer for the timeline, side rail, sidecar, quick
 * actions, profile popout, and any other CDiscourse surface. Built so
 * we get Bootstrap-style consistency (spacing scale, status badges,
 * cards, pills, rails, popovers) **without** importing Bootstrap as a
 * runtime dependency — React Native cannot consume Bootstrap CSS, and
 * we want web and mobile to share the same naming anyway.
 *
 * Token names are deliberately structural, not semantic-of-correctness:
 *   - `STATUS` colors describe app-level state (info / warning / danger /
 *     success / neutral), NOT verdicts about user content.
 *   - `ARGUMENT` colors describe argument-type families (claim /
 *     challenge / evidence / clarify / concede / branch), NOT who is
 *     right or wrong.
 *
 * Existing kind-color constants (`TIMELINE_KIND_COLORS`) and standing-
 * band copy (`standingBandCopy.ts`) remain the source of truth for
 * those domains; this module is the broader surface system.
 */

// ── Spacing ──────────────────────────────────────────────────────

/** Monotonic spacing scale in dp/px. Add new values only at the ends. */
export const SPACING = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
} as const;

export type SpacingKey = keyof typeof SPACING;

// ── Radius ───────────────────────────────────────────────────────

/**
 * Corner radius scale. `pill` is intentionally a sentinel large value
 * so the renderer can clamp to half-height for true pill shapes
 * regardless of element height.
 */
export const RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  pill: 999,
} as const;

export type RadiusKey = keyof typeof RADIUS;

// ── Status (app-level state, NOT verdicts on user content) ───────

export interface ColorPair {
  bg: string;
  fg: string;
}

export const STATUS: Record<'info' | 'warning' | 'danger' | 'success' | 'neutral', ColorPair> = {
  info:    { bg: '#1e3a8a', fg: '#dbeafe' },
  warning: { bg: '#78350f', fg: '#fde68a' },
  danger:  { bg: '#7f1d1d', fg: '#fecaca' },
  success: { bg: '#14532d', fg: '#bbf7d0' },
  neutral: { bg: '#1f2937', fg: '#cbd5e1' },
};

export type StatusKey = keyof typeof STATUS;

// ── Surface elevation ───────────────────────────────────────────

/**
 * Three surface levels. `base` is the page background, `elevated` is a
 * card or rail, `overlay` is a popover / modal.
 */
export const SURFACE = {
  base:     { bg: '#020617' },
  elevated: { bg: '#0b1220' },
  overlay:  { bg: '#0f172a' },
} as const;

export type SurfaceKey = keyof typeof SURFACE;

// ── Rail (side action rail states) ──────────────────────────────

export const RAIL = {
  active:   { bg: '#312e81', fg: '#e0e7ff', borderColor: '#6366f1' },
  inactive: { bg: '#1f2937', fg: '#94a3b8', borderColor: '#1f2937' },
} as const;

export type RailKey = keyof typeof RAIL;

// ── Argument kind color families ────────────────────────────────

/**
 * Argument-type color families. Mirrors the kind buckets used by the
 * Constitution. `branch` is a structural / navigational category for
 * split-branch UIs (BR-001), not an argument kind in the rules engine.
 */
export const ARGUMENT = {
  claim:     { bg: '#3730a3', fg: '#e0e7ff' },
  challenge: { bg: '#9a3412', fg: '#fed7aa' },
  evidence:  { bg: '#0e7490', fg: '#cffafe' },
  clarify:   { bg: '#92400e', fg: '#fef3c7' },
  concede:   { bg: '#581c87', fg: '#e9d5ff' },
  branch:    { bg: '#0f766e', fg: '#ccfbf1' },
} as const;

export type ArgumentKindKey = keyof typeof ARGUMENT;

// ── BRAND-001 — CivilDiscourse brand tokens ─────────────────────

/**
 * BRAND-001 — Global CivilDiscourse identity. The cream-on-black mark
 * is the load-bearing visual move; the dark backdrop is a global
 * default, not a per-screen choice.
 *
 * - `surface.app` is the app-wide page background that matches the
 *   logo's black field.
 * - `surface.appElevated` is the card / rail / sidecar surface tone
 *   one step above `surface.app` — used so cards still read as a
 *   discrete layer on the dark backdrop.
 * - `text.primary` is the canonical cream that pairs with `surface.app`
 *   for body text. WCAG AA passes against `#08060F` (contrast > 14:1).
 * - `text.muted` is the secondary text tone for helpers + timestamps.
 * - `text.taglineFg` is a slightly de-saturated cream used by the
 *   Stage 2 tagline so it does not visually outshout the wordmark.
 *   Still ≥ 7:1 against `surface.app` (≈ 14.5:1 measured).
 * - `accent.cream` exposes the same cream value for non-text use
 *   (borders, dividers, focus rings).
 * - `accent.creamHairline` is a low-opacity cream used by the Stage 2
 *   header hairline divider — the only `rgba()` color in BRAND.
 *
 * Stage 2 (BRAND-001) adds:
 *   - `text.taglineFg`             — tagline foreground tone
 *   - `accent.creamHairline`       — header divider color (rgba)
 *   - `logoHeightPxWide`           — wide-breakpoint logo height (110)
 *   - `headerHeightPxWide`         — wide-breakpoint header height (152)
 *   - `headerWideBreakpointPx`     — breakpoint where wide layout activates (720)
 *   - `taglineText`                — frozen fixture for the tagline copy
 *
 * The existing `headerHeightPx` (64) and `logoHeightPx` (44) are
 * preserved so every Stage 1 consumer keeps working unchanged.
 */
export const BRAND = {
  surface: {
    app:         { bg: '#08060F' },
    appElevated: { bg: '#13101D' },
  },
  text: {
    primary:   '#F5EDE0',
    muted:     '#B6AFA1',
    taglineFg: '#E6DCC8',
  },
  accent: {
    cream:         '#F5EDE0',
    creamHairline: 'rgba(245, 237, 224, 0.18)',
    // UX-BRAND-001 — restrained gold accent system drawn from the logo's
    // subtle gold hue. Gold is an ACCENT, never the palette: small accent
    // lines, muted heading/value-prop emphasis, premium card borders/tints,
    // selected/focus nuance. NOT garish yellow, NOT casino gold.
    //   - `gold` is the antique-gold accent for TEXT on the dark app bg.
    //     Measured contrast ≈ 8.3:1 vs `surface.app` (#08060F) — clears WCAG
    //     AA (4.5) and AAA (7) for normal text, so it is safe for the
    //     sign-in value-prop lead.
    //   - `goldMuted` is a slightly softer accent for secondary flourishes.
    //   - `goldDeep` is the dark gold/brown reserved for text on a LIGHT fill
    //     (none today; provided so a future bright surface has an accessible
    //     gold text tone instead of reaching for `gold`).
    //   - `goldSoft` is a low-opacity gold SURFACE tint for premium cards.
    //   - `goldBorder` is the gold HAIRLINE for premium card / divider edges.
    gold:        '#C6A15B',
    goldMuted:   '#B89A5E',
    goldDeep:    '#7A5A24',
    goldSoft:    'rgba(198, 161, 91, 0.10)',
    goldBorder:  'rgba(198, 161, 91, 0.35)',
  },
  /** Header height target in dp/px (small / narrow breakpoint). */
  headerHeightPx: 64 as const,
  /** Logo height target inside the header (small / narrow breakpoint). */
  logoHeightPx: 44 as const,
  /**
   * Wide-breakpoint logo height. Frozen literal (≈ 2.5× the base
   * `logoHeightPx`). NOT derived at runtime so snapshot tests stay
   * deterministic.
   */
  logoHeightPxWide: 110 as const,
  /**
   * Wide-breakpoint header outer height (padding + logo row + divider).
   * Frozen literal next to `headerHeightPx` so existing consumers
   * keep using `headerHeightPx` and wide consumers can opt in.
   */
  headerHeightPxWide: 152 as const,
  /**
   * Breakpoint in dp at which the wide layout activates. Below this
   * the tagline stacks under the logo at small size; at or above it
   * the tagline sits to the right of the logo on a shared baseline.
   */
  headerWideBreakpointPx: 720 as const,
  /**
   * Tagline fixture. Hard-coded ASCII; no i18n, no templating. The
   * Stage 2 test pins this exact string and ban-lists it against
   * verdict / popularity vocabulary.
   */
  taglineText: 'Just get to the bottom of it' as const,

  // ── UX-001.1 — Phase 1 brand + app shell correction ──────────────
  //
  // Mental model — surface hierarchy mapping (Q2 verdict).
  //   The BRAND module ships a 2-level shell scale (surface.app +
  //   surface.appElevated). BRAND-002 (PR #138) ships a separate
  //   14-key dark surface scale in SURFACE_TOKENS for non-room
  //   screens. UX-001.1 maps the epic's "primary / secondary /
  //   tertiary" mental model onto the shipped tokens WITHOUT adding
  //   any new surface token:
  //     primary   → BRAND.surface.app.bg          (`#08060F`)
  //     secondary → BRAND.surface.appElevated.bg  (`#13101D`)
  //     tertiary  → SURFACE_TOKENS.overlay        (`#0f172a`)
  //   This mapping is documented here so UX-001.2-001.7 implementers
  //   have a single contract for shell vs non-room-screen surfaces.

  /**
   * UX-001.1 — 3-state breakpoint contract (Q1 verdict).
   *
   * `phone`   :   0 - 599  dp  (compact mobile + small Android)
   * `tablet`  : 600 - 1279 dp  (tablet portrait + tablet landscape + small desktop)
   * `wide`    : 1280+      dp  (laptop + desktop + wide desktop)
   *
   * The "phone" upper bound is 599 (not 720 or 768) because Material
   * Design 3 + iOS HIG both treat >= 600dp as "tablet class" for
   * typography + density. A 5.4-inch iPhone in portrait is 390dp; a
   * Galaxy Fold inner is 584dp. 599dp covers all common phones.
   *
   * The "wide" lower bound is 1280 (not 1024 or 1440) because 1280 is
   * the de-facto laptop minimum (MacBook Air, most 13" laptops). 1024
   * would push iPad landscape into "wide" with desktop-tuned density,
   * which is wrong; 1440 would leave 13" MacBooks stuck on "tablet".
   *
   * The legacy `headerWideBreakpointPx: 720` is PRESERVED for
   * back-compat (it still drives the existing `isWide` boolean). New
   * code should read these three new constants. The new `isWide`
   * semantic is `band !== 'phone'` (true for tablet AND wide); since
   * 720dp falls in the tablet band, every existing assertion on
   * `isWide` at 720dp continues to pass.
   */
  breakpoints: {
    phone:  { minPx: 0,    maxPx: 599  },
    tablet: { minPx: 600,  maxPx: 1279 },
    wide:   { minPx: 1280, maxPx: Number.POSITIVE_INFINITY },
  } as const,

  /**
   * UX-001.1 — Logo height per band (Q3 verdict).
   *
   * Phone   : 44 px (preserved from Stage 1)
   * Tablet  : 80 px (NEW; sized to fit the 96 px tablet header with 8+8 padding)
   * Wide    : 96 px (NEW; sized to fit the 120 px wide header with 12+12 padding)
   *
   * The single PNG at `assets/branding/civic-discourse-logo.png`
   * scales to all three heights via `resizeMode="contain"`. No asset
   * variants needed.
   *
   * The legacy `logoHeightPxWide: 110` constant is PRESERVED as a
   * back-compat alias (existing tests pin it). New code consumes
   * `logoHeightByBand`. The reduction from "wide = 110" to "wide = 96"
   * is a joint reconciliation with the wide-header tightening from
   * 152 to 120 — see the §9 math in `docs/designs/UX-001.1.md`.
   */
  logoHeightByBand: {
    phone:  44 as const,
    tablet: 80 as const,
    wide:   96 as const,
  },

  /**
   * UX-001.1 — Header outer height per band (Q5 verdict).
   *
   * Phone   :  64 px (preserved from Stage 1)
   * Tablet  :  96 px (NEW; tighter than the legacy 152 wide;
   *                    fits the 80 px logo with 8+8 padding)
   * Wide    : 120 px (TIGHTENED from 152 px;
   *                    fits the 96 px logo with 12+12 padding)
   *
   * Rationale for tightening 152 -> 120 on wide:
   *   - Epic non-negotiable: "header height does not bury the active
   *     board on any tested viewport".
   *   - 152 px on a 900 px-tall laptop browser is 16.9 % - too much.
   *   - 120 px on the same viewport is 13.3 % - comfortable.
   *   - 96 px logo at 120 px header = 24 px combined padding (12+12).
   *
   * Rationale for adding 96 on tablet:
   *   - 768 dp iPad portrait at 152 px header = 14.8 % viewport;
   *     at 96 px = 9.4 %. The tighter header keeps the timeline
   *     above the fold.
   *   - 80 px logo at 96 px header = 16 px combined padding (8+8).
   */
  headerHeightByBand: {
    phone:  64  as const,
    tablet: 96  as const,
    wide:   120 as const,
  },

  /**
   * UX-001.1 — Typography baseline (Q8 verdict).
   *
   * Three sub-objects only. UX-001.7 extends this into a full type
   * scale (display / heading / body / caption etc.) covering the rest
   * of the app. Phase 1 scope is intentionally tight - the smallest
   * viable surface that unblocks UX-001.4's Act/Inspect/Go right-slot
   * triggers without forcing UX-001.2/3/4 implementers to inline
   * typography decisions ad-hoc.
   *
   * Tokens:
   *   - `wordmarkFallback` - per-band sizes for the text-only fallback
   *     when the PNG asset fails to load.
   *   - `tagline`           - per-variant sizes for the
   *     AppHeaderTagline component (replaces the prior inline
   *     `fontSize: 18` / `fontSize: 14` literals).
   *   - `header`            - per-band sizes for the right-slot label
   *     (reserved for UX-001.4's Act/Inspect/Go triggers; phone is
   *     icon-only via `fontSize: 0`).
   *
   * All values are platform-neutral dp/px. `lineHeight` is included
   * because RN text layout uses it for vertical alignment.
   *
   * Token keys are structural English (band names: phone/tablet/wide;
   * variant names: inline/stacked). No verdict / popularity / truth
   * vocabulary leaks into key names or values (asserted by ban-list
   * tests in `__tests__/uxOneOneTypographyBaseline.test.ts`).
   */
  typography: {
    wordmarkFallback: {
      phone:  { fontSize: 18, lineHeight: 22, fontWeight: '800' as const, letterSpacing: 0.6 },
      tablet: { fontSize: 28, lineHeight: 34, fontWeight: '800' as const, letterSpacing: 0.6 },
      wide:   { fontSize: 34, lineHeight: 40, fontWeight: '800' as const, letterSpacing: 0.6 },
    },
    tagline: {
      inline:  { fontSize: 18, lineHeight: 24, letterSpacing: 0.2, fontWeight: '400' as const },
      stacked: { fontSize: 14, lineHeight: 18, letterSpacing: 0.2, fontWeight: '400' as const },
    },
    header: {
      // Right-slot label sizes (e.g. icon label on tablet+, hidden on phone).
      phone:  { fontSize: 0,  lineHeight: 0,  fontWeight: '500' as const }, // icon-only on phone
      tablet: { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
      wide:   { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
    },
  } as const,
} as const;

// ── VG-004 — Timeline node glow / halo tokens ───────────────────

/**
 * VG-004 — Node-level glow + selected-node halo tokens.
 *
 * `activePath` is the indigo navigation glow on nodes that sit on the
 * active path — reusing VG-002's `RAIL_ACTIVE_PATH_GLOW` indigo
 * (`#a5b4fc`) so the rail glow and the node glow read as one system.
 * `selectedHalo` is the cream selection ring on the SC-004 dock target,
 * reusing `BRAND.accent.cream` so no new color token is introduced.
 *
 * The two are deliberately different hues: indigo = "active", cream =
 * "selected". Neither encodes truth, strength, or heat (doctrine §1/§2).
 *
 * `strokeWidthPx` / `ringWidthPx` are geometry — they survive reduce-
 * motion. `shadowRadiusPx` is the soft drop shadow, dropped to 0 when
 * reduce-motion is on (the stroke alone then carries the signal).
 */
export const GLOW = {
  activePath: { strokeWidthPx: 2, shadowRadiusPx: 12, color: '#a5b4fc' },
  selectedHalo: { ringWidthPx: 3, color: BRAND.accent.cream },
} as const;

/**
 * VG-004 — Evidence "receipt" inner-mark token. A small corner badge on
 * the circular timeline node when the node's message has ≥ 1 attached
 * `EvidenceArtifact`. It signals *artifact presence*, never that a claim
 * is proven (doctrine §3). Colors reuse the `ARGUMENT.evidence` family —
 * no new color token.
 */
export const RECEIPT_MARK = {
  sizePx: 12,
  color: ARGUMENT.evidence.bg,
  innerColor: ARGUMENT.evidence.fg,
} as const;

// ── BRAND-002 — App-wide dark surface scale ─────────────────────
//
// Reusable surface tokens for non-room screens (Account, Admin, Invite,
// Auth, legacy composer). Anchored to the room family (#020617/#0b1220)
// and the BRAND-001 backdrop (#08060F) so the whole app reads as one
// dark product. Structural names only — no verdict vocabulary.
//
// Contrast pairs below are WCAG-measured against the stated background.
// AA bar: 4.5:1 body text, 3:1 the focus ring (meaningful non-text UI).
// NOTE on hairlines: `border` / `divider` / `inputBorder` are DECORATIVE
// separators — WCAG 1.4.11 imposes a 3:1 bar only on non-text UI that is
// *required to identify* a component/state; a card/input/table hairline is
// not. They carry no 3:1 bar — only the lighter-than-backdrop property.
export const SURFACE_TOKENS = {
  // Backgrounds — three elevation levels, matching SURFACE.* family.
  base:     '#020617', // page background (matches room base)
  elevated: '#0b1220', // cards, rows, form blocks, table rows
  overlay:  '#0f172a', // sheets, popouts, modals, detail panels
  raised:   '#162033', // header bars / sticky toolbars one step over elevated

  // Hairlines — DECORATIVE separators, not 3:1-bar non-text UI (see note above).
  border:   '#1e293b', // card / input / table-cell outline (decorative; lighter than backdrop)
  divider:  '#15202e', // subtle row separators inside a card / table (decorative; lighter than backdrop)

  // Text on dark (foreground).
  textPrimary:   '#e2e8f0', // body + values        (13.2:1 vs base, 11.4:1 vs elevated)
  textSecondary: '#94a3b8', // labels + helper text  (6.0:1 vs base, 5.2:1 vs elevated)
  textMuted:     '#64748b', // timestamps / placeholders (3.4:1 vs base — large/non-body only)
  textInverse:   '#0b1220', // text that sits on a bright accent fill (e.g. primary button)

  // Form control surfaces.
  inputBg:       '#0b1220', // TextInput background
  inputBorder:   '#334155', // TextInput resting outline (decorative hairline; lighter than inputBg)
  placeholder:   '#64748b', // TextInput placeholderTextColor

  // Focus ring — one shared visible ring for every interactive element.
  focusRing:     '#a5b4fc', // reuses GLOW.activePath indigo (≥3:1 vs all surfaces)
} as const;

export type SurfaceTokenKey = keyof typeof SURFACE_TOKENS;

// ── BRAND-002 — Control / button intent tokens ──────────────────
// `primary` is the indigo action color. The fill is indigo-600 (#4f46e5),
// one step darker than the indigo-500 (#6366f1) used elsewhere, so a WHITE
// label clears the 4.5:1 body-text AA bar (white on #6366f1 measures only
// 4.47:1 — a real fail; white on #4f46e5 measures 6.29:1). The label is
// white because a dark label can NOT reach 4.5:1 on any usable indigo fill.
// `danger` reuses STATUS.danger (a dark maroon, NOT a bright red flood)
// for the destructive-control treatment (see "Destructive controls").
export const CONTROL = {
  primary: {
    bg: '#4f46e5',           // indigo-600 fill (darker than #6366f1 so a white label passes AA)
    fg: '#ffffff',           // white text on indigo-600 (6.29:1 — clears the 4.5:1 body bar)
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

// ── UX-001.7 — Touch target preset ──────────────────────────────

/**
 * UX-001.7 — Touch target preset. Reads `accessibility-targets` minimum
 * 44×44 logical pixels. Consumed by every `Pressable` in UX-001 surfaces
 * that previously used a literal `44` (visual size) or a bespoke
 * `hitSlop` literal.
 *
 * - `minSizePx` is the visual minimum touch target.
 * - `hitSlopAll` is the canonical 12-on-all-sides preset that lifts a
 *   small chip's effective tap target to >= 44×44.
 * - `hitSlopCompact` is the 8-on-all-sides preset used by leaf-row
 *   surfaces (PopoutEntry-style) where the row already meets >=44 in
 *   visual height but a hitSlop is still desirable.
 *
 * Existing primitives (`AnnotationChip`, `AnnotationOverflowChip`,
 * `PopoutEntry`, `CollapsedComposerStrip`) are read-only per UX-001.7
 * §12.B and intentionally retain their literal forms; the token serves
 * NEW callsites + EvidenceAnnotationChip's bounded refactor.
 *
 * Asserted by `__tests__/uxOneOneSevenTokenExports.test.ts`.
 */
export const TOUCH_TARGET = {
  minSizePx: 44 as const,
  hitSlopAll: Object.freeze({ top: 12, bottom: 12, left: 12, right: 12 }),
  hitSlopCompact: Object.freeze({ top: 8, bottom: 8, left: 8, right: 8 }),
} as const;

// ── UX-001.7 — Focus ring dimensional preset ────────────────────

/**
 * UX-001.7 — Focus ring dimensional preset. The color is already
 * canonical (`SURFACE_TOKENS.focusRing` = `#a5b4fc`); this token names
 * the WIDTH + OFFSET so every focus state across UX-001 surfaces uses
 * the same metric. Reduce-motion safe: width survives, no animation.
 *
 * Replaces internal `borderWidth: 2` literals in:
 *   - `src/features/nodeAnnotations/AnnotationFocusRing.tsx` (focused state)
 *   - `src/features/nodeAnnotations/AnnotationOutline.tsx` (selected state)
 *
 * Runtime value is identical (2 = 2); the token only names the metric.
 *
 * Asserted by `__tests__/uxOneOneSevenTokenExports.test.ts`.
 */
export const FOCUS_RING = {
  widthPx: 2 as const,
  offsetPx: 2 as const,
  color: SURFACE_TOKENS.focusRing,
} as const;

// ── UX-001.7 — Border width scale ───────────────────────────────

/**
 * UX-001.7 — Border width scale. Mirrors `RADIUS` in shape (sm/md/lg)
 * with `sm = 1` (hairline), `md = 2` (standard outline), `lg = 3`
 * (emphasis). Consumed by primitives where a literal `borderWidth: 1|2|3`
 * appears with >=2 callsites; single-callsite literals stay literal per
 * the intent brief's "do not overbuild" rule.
 *
 * Asserted by `__tests__/uxOneOneSevenTokenExports.test.ts`.
 */
export const BORDER_WIDTH = {
  sm: 1 as const,
  md: 2 as const,
  lg: 3 as const,
} as const;

// ── UX-001.7 — App-wide typography scale ────────────────────────

/**
 * UX-001.7 — App-wide typography scale. UX-001.1's `BRAND.typography`
 * shipped the SHELL ONLY (wordmark, tagline, header right slot) and
 * explicitly deferred the app-wide scale to UX-001.7. This export ships
 * that scale.
 *
 * Naming uses structural English (group names refer to where the
 * typography is consumed, NOT to verdicts). Every group has >=2
 * consumers across UX-001 surfaces per `docs/designs/UX-001.7.md` §3.A
 * (single-consumer literals stay as literals per the intent brief's
 * "do not overbuild" rule).
 *
 * Values match the existing `fontSize`/`lineHeight`/`fontWeight`
 * literals already in the surfaces, so the token replacement is
 * runtime-byte-identical.
 *
 * Asserted by `__tests__/uxOneOneSevenTokenExports.test.ts`.
 */
export const TYPOGRAPHY = {
  /** DebateDetailHeader strip labels (title + status chip + side chip). */
  roomStrip:         { fontSize: 12, lineHeight: 16, fontWeight: '600' as const },
  /** ArgumentTimelineMap + ArgumentTimelineNode node labels. */
  timelineNode:      { fontSize: 11, lineHeight: 14, fontWeight: '600' as const },
  /** TimelineSelectedReadoutPanel + ArgumentReplySidecar compact rows. */
  selectedContext:   { fontSize: 12, lineHeight: 16, fontWeight: '500' as const },
  /** ArgumentComposer + ComposerContextStrip body text. */
  composer:          { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  /** Popout chassis headings (Act / Inspect / Go). */
  popoutHeading:     { fontSize: 13, lineHeight: 18, fontWeight: '700' as const },
  /** PopoutEntry body + InspectPopout section body. */
  popoutBody:        { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
  /** AnnotationChip + EvidenceAnnotationChip label text. */
  chipLabel:         { fontSize: 11, lineHeight: 14, fontWeight: '600' as const },
  /** AnnotationBadge + key-badge text (browser-only A/I/G). */
  badgeLabel:        { fontSize: 10, lineHeight: 12, fontWeight: '700' as const },
  /** A/I/G key badges (browser-only; matches `BRAND.typography.header.wide`). */
  keyboardHint:      { fontSize: 11, lineHeight: 14, fontWeight: '600' as const },
  /** InspectPopout section detail text. */
  inspectDetail:     { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
} as const;

export type TypographyKey = keyof typeof TYPOGRAPHY;

// ── UX-001.7 — Composite spacing presets ────────────────────────

/**
 * UX-001.7 — Composite spacing presets layered on the `SPACING` scale.
 * `SPACING` ships the scale (xs/s/m/l/xl); this preset names the
 * COMBINATIONS the design system actually uses. Every preset has >=2
 * consumers across UX-001 surfaces per `docs/designs/UX-001.7.md` §3.B.
 *
 * Note: `compactRowGap` and `chipGap` resolve to the same value (4).
 * They are intentionally separate tokens because they describe DIFFERENT
 * consumer intents — the operator might tune `compactRowGap` to 6 in a
 * future release without affecting chip gap. This separation is explicit
 * per the intent brief's "consolidation by intent, not by value"
 * principle.
 *
 * Asserted by `__tests__/uxOneOneSevenTokenExports.test.ts`.
 */
export const SPACING_PRESETS = {
  /** Outer screen padding (DebateDetailHeader screen inset, ArgumentComposer outer). */
  screenInset:           SPACING.l,    // 16
  /** Between stacked surfaces (e.g. between strip + Timeline). */
  surfaceGap:            SPACING.m,    // 12
  /** DebateDetailHeader strip row gaps; compact-row gap. */
  compactRowGap:         SPACING.xs,   // 4
  /** AnnotationChipStrip + EvidenceAnnotation chip-row gap. */
  chipGap:               SPACING.xs,   // 4
  /** ArgumentTimelineMap node internal padding. */
  nodeInternalPadding:   SPACING.s,    // 8
  /** Popout chassis internal padding. */
  popoutInternalPadding: SPACING.m,    // 12
  /** ArgumentComposer body padding. */
  composerPadding:       SPACING.m,    // 12
  /**
   * Touch target minimum — cross-reference to `TOUCH_TARGET.minSizePx`,
   * NOT a new value. Exposed here so consumers reading the spacing
   * preset table can find the touch-target metric in one place.
   */
  touchTargetMin:        TOUCH_TARGET.minSizePx, // 44
} as const;

export type SpacingPresetKey = keyof typeof SPACING_PRESETS;

// ── Aggregate ───────────────────────────────────────────────────

export const TOKENS = {
  spacing: SPACING,
  radius: RADIUS,
  status: STATUS,
  surface: SURFACE,
  rail: RAIL,
  argument: ARGUMENT,
  brand: BRAND,
  glow: GLOW,
  receiptMark: RECEIPT_MARK,
  surfaceTokens: SURFACE_TOKENS,
  control: CONTROL,
  // UX-001.7 additions — additive only, existing keys above unchanged.
  touchTarget: TOUCH_TARGET,
  focusRing: FOCUS_RING,
  borderWidth: BORDER_WIDTH,
  typography: TYPOGRAPHY,
  spacingPresets: SPACING_PRESETS,
} as const;

/**
 * Strings we refuse to ship in any user-facing token label. The token
 * module itself only exports color hex strings and structural names,
 * but this list is exported so VG-001 (and any consumer) can re-use it
 * when building component labels on top of these tokens.
 */
export const FORBIDDEN_TOKEN_TOKENS: readonly string[] = [
  'winner',
  'loser',
  'truth',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
];

/**
 * Lightweight typed accessor. `getToken('status.warning.bg')` →
 * `#78350f`. Returns undefined for unknown paths; callers should use
 * the typed exports directly when they can.
 */
export function getToken(path: string): unknown {
  const parts = path.split('.');
  let cursor: unknown = TOKENS;
  for (const p of parts) {
    if (cursor && typeof cursor === 'object' && p in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cursor;
}
