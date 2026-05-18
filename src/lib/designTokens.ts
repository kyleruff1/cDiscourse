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

// ── Aggregate ───────────────────────────────────────────────────

export const TOKENS = {
  spacing: SPACING,
  radius: RADIUS,
  status: STATUS,
  surface: SURFACE,
  rail: RAIL,
  argument: ARGUMENT,
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
