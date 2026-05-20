/**
 * VG-004 — Timeline node visual model (pure TypeScript).
 *
 * No React. No Supabase. No network. No AI. Pure model for the six
 * visual-only refinements that make the horizontal argument board read
 * as a playable map:
 *
 *   1. Node-level active-path glow.
 *   2. Selected-node halo (the SC-004 dock target).
 *   3. Evidence "receipt" inner mark.
 *   4. (BranchCollapseStub glyph — lives in its own file.)
 *   5. Tone tint on active-path nodes only.
 *   6. Density-aware inter-node spacing (`resolveNodeGapPx`).
 *
 * Doctrine (cdiscourse-doctrine §1/§2, timeline-grammar):
 *   - The glow / halo communicate *navigation* and *selection* — never
 *     truth, correctness, or strength. They are strength-independent:
 *     they never read `standingBand`, `heat`, or any score.
 *   - The tone tint is the ONLY field that reads `toneBand` /
 *     `temperatureBand`. It describes *activity*, is applied to
 *     active-path nodes only, and is capped at alpha ≤ 0.18.
 *   - Every new state has a non-color signal (geometry / stroke / text)
 *     and a plain-English `accessibilityFragment` with zero verdict /
 *     amplification / snake_case tokens.
 *
 * No verdict tokens (winner, loser, truth, liar, dishonest, bad faith,
 * manipulative, extremist, propagandist) ever appear in this module.
 */

import type {
  TimelineTemperatureBand,
  TimelineToneBand,
} from './argumentGameSurfaceModel';

// ── Density mode ────────────────────────────────────────────────

/** Density preset for inter-node horizontal spacing. */
export type TimelineDensityMode = 'compact' | 'normal' | 'expanded';

export const ALL_TIMELINE_DENSITY_MODES: ReadonlyArray<TimelineDensityMode> =
  Object.freeze(['compact', 'normal', 'expanded']);

/**
 * Inter-node gap in px per density mode.
 *
 * VG-004 operator decision (design §0 Q1, option b): the board adopts
 * the card's literal numbers — `normal` is 44 (deliberately looser than
 * the historical 28). `resolveNodeGapPx(undefined)` therefore returns
 * 44 — the new default board spacing for every user.
 */
export const TIMELINE_NODE_GAP_BY_DENSITY: Readonly<
  Record<TimelineDensityMode, number>
> = Object.freeze({ compact: 28, normal: 44, expanded: 64 });

/**
 * Inter-node gap for a density mode. Undefined → 'normal' (44px, the
 * VG-004 default). Pure / deterministic.
 */
export function resolveNodeGapPx(
  density: TimelineDensityMode | undefined,
): number {
  if (density && density in TIMELINE_NODE_GAP_BY_DENSITY) {
    return TIMELINE_NODE_GAP_BY_DENSITY[density];
  }
  return TIMELINE_NODE_GAP_BY_DENSITY.normal;
}

// ── Node visual style ───────────────────────────────────────────

/**
 * Glow tier for a node. `active_node` is the single active node;
 * `active_path` is any other node on the active path; `none` otherwise.
 */
export type NodeGlowTier = 'none' | 'active_path' | 'active_node';

/** The visual treatment block for one timeline node. Pure-derived. */
export interface TimelineNodeVisualStyle {
  /** Outer glow tier. */
  glowTier: NodeGlowTier;
  /** Outer stroke width in px for the glow ring (reduce-motion still
   *  draws this — geometry, not motion). */
  glowStrokeWidthPx: number; // 0 | 2
  /** Soft shadow radius in px. 0 when reduce-motion is on (stroke-only
   *  fallback per card item 1). */
  glowShadowRadiusPx: number; // 0 | 12
  /** Halo ring width in px for the *selected* node. 0 when not selected. */
  haloRingWidthPx: number; // 0 | 3
  /** True when this node carries the evidence receipt inner mark. */
  showsReceiptMark: boolean;
  /** Tone tint applied to active-path nodes only. null = no tint. */
  toneTint: { color: string; alpha: number } | null;
  /** Plain-English a11y fragment describing the added states. Appended
   *  to the node's existing accessibilityLabel. Never verdict copy. */
  accessibilityFragment: string;
}

export interface DeriveTimelineNodeVisualInput {
  /** node.isActive — the single currently-active node. */
  isActive: boolean;
  /** node.isActivePath — node sits on the active navigation path. */
  isActivePath: boolean;
  /** node.messageId === selectedTarget?.messageId (SC-004 dock target). */
  isSelected: boolean;
  /** node.toneBand — activity tone, never correctness. */
  toneBand: TimelineToneBand;
  /** node.temperatureBand — activity warmth, never correctness. */
  temperatureBand: TimelineTemperatureBand;
  /** True when the node's message has ≥ 1 EvidenceArtifact. */
  hasEvidenceArtifact: boolean;
  /** AccessibilityInfo.isReduceMotionEnabled result. */
  prefersReducedMotion: boolean;
}

/** Card item 1 — outer glow stroke width in px. */
export const NODE_GLOW_STROKE_WIDTH_PX = 2;
/** Card item 1 — soft shadow radius in px (dropped under reduce-motion). */
export const NODE_GLOW_SHADOW_RADIUS_PX = 12;
/** Card item 2 — selected-node halo ring width in px. */
export const NODE_HALO_RING_WIDTH_PX = 3;

/**
 * Tone tint alpha cap. The node tint is intentionally far subtler than
 * the rail's tone wash (which reaches 0.45). Doctrine: a node tint must
 * never read as a verdict, so it stays a whisper.
 */
export const NODE_TONE_TINT_MAX_ALPHA = 0.18;

/**
 * VG-002 tone-band hue table. Re-stated here (not imported — the rail
 * keeps its copy private) so this pure model has zero React/component
 * imports. Values are byte-identical to `railSegmentModel.TONE_BAND_HEX`;
 * a token test pins them so the two never drift.
 */
const TONE_BAND_HEX: Readonly<Record<TimelineToneBand, string>> = Object.freeze({
  calm: '#22c55e',
  measured: '#3b82f6',
  heated: '#f97316',
  hostile: '#ef4444',
  unknown: '#94a3b8',
});

/**
 * Per-temperature tint alpha for active-path nodes. Every value is at or
 * below `NODE_TONE_TINT_MAX_ALPHA`. Cooler activity → fainter tint.
 */
const TONE_TINT_ALPHA_BY_TEMPERATURE: Readonly<
  Record<TimelineTemperatureBand, number>
> = Object.freeze({
  cool: 0.04,
  mild: 0.08,
  warm: 0.13,
  hot: NODE_TONE_TINT_MAX_ALPHA,
  unknown: 0.04,
});

/**
 * Derive the full visual treatment for one node. Pure. Deterministic —
 * same input → deep-equal output (the renderer may memoize by node id).
 *
 *  - glowTier: 'active_node' if isActive; else 'active_path' if
 *    isActivePath; else 'none'.
 *  - glowStrokeWidthPx: 2 when glowTier !== 'none', else 0.
 *  - glowShadowRadiusPx: 0 if prefersReducedMotion (stroke-only
 *    fallback), else 12 when glowTier !== 'none', else 0.
 *  - haloRingWidthPx: 3 when isSelected, else 0.
 *  - showsReceiptMark: input.hasEvidenceArtifact.
 *  - toneTint: null unless isActivePath; when on the active path it is
 *    the VG-002 tone-band hue at a capped low alpha (≤ 0.18) — activity,
 *    never correctness. NEVER returned for non-active-path nodes.
 *  - accessibilityFragment: plain English, e.g. "active move", "on the
 *    active path", "selected", "has an attached source". Empty string
 *    when nothing applies. Never verdict / amplification / snake_case.
 */
export function deriveTimelineNodeVisualStyle(
  input: DeriveTimelineNodeVisualInput,
): TimelineNodeVisualStyle {
  const glowTier: NodeGlowTier = input.isActive
    ? 'active_node'
    : input.isActivePath
      ? 'active_path'
      : 'none';

  const hasGlow = glowTier !== 'none';
  const glowStrokeWidthPx = hasGlow ? NODE_GLOW_STROKE_WIDTH_PX : 0;
  const glowShadowRadiusPx =
    hasGlow && !input.prefersReducedMotion ? NODE_GLOW_SHADOW_RADIUS_PX : 0;

  const haloRingWidthPx = input.isSelected ? NODE_HALO_RING_WIDTH_PX : 0;

  // Tone tint: active-path nodes only. Detached nodes are never on the
  // active path (the surface model guarantees it), so they get null.
  const toneTint: { color: string; alpha: number } | null = input.isActivePath
    ? {
        color: TONE_BAND_HEX[input.toneBand] ?? TONE_BAND_HEX.unknown,
        alpha: Math.min(
          NODE_TONE_TINT_MAX_ALPHA,
          TONE_TINT_ALPHA_BY_TEMPERATURE[input.temperatureBand] ??
            TONE_TINT_ALPHA_BY_TEMPERATURE.unknown,
        ),
      }
    : null;

  return {
    glowTier,
    glowStrokeWidthPx,
    glowShadowRadiusPx,
    haloRingWidthPx,
    showsReceiptMark: input.hasEvidenceArtifact === true,
    toneTint,
    accessibilityFragment: buildNodeAccessibilityFragment({
      glowTier,
      isSelected: input.isSelected,
      hasEvidenceArtifact: input.hasEvidenceArtifact === true,
    }),
  };
}

/**
 * Build the plain-English a11y fragment for a node's added visual
 * states. Pure. Returns an empty string when nothing applies.
 *
 * Phrasing describes navigation / selection / artifact presence only —
 * never correctness, strength, popularity, or heat.
 */
function buildNodeAccessibilityFragment(args: {
  glowTier: NodeGlowTier;
  isSelected: boolean;
  hasEvidenceArtifact: boolean;
}): string {
  const parts: string[] = [];
  if (args.glowTier === 'active_node') {
    parts.push('active move');
  } else if (args.glowTier === 'active_path') {
    parts.push('on the active path');
  }
  if (args.isSelected) {
    // Multi-word phrase so the fragment never reads as a bare
    // single-token code (a lone "selected" trips looksLikeInternalCode).
    parts.push('selected for actions');
  }
  if (args.hasEvidenceArtifact) {
    parts.push('has an attached source');
  }
  return parts.join(', ');
}
