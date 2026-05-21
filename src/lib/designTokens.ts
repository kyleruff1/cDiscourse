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
