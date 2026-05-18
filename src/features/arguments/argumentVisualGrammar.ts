/**
 * VG-001 — Argument visual grammar.
 *
 * Pure-TS mapper from `(argumentType, standingBand)` (+ optional
 * evidence / source-chain pressure inputs) to a visual token a
 * renderer can layer onto a timeline node. The token always carries
 * shape, color, stroke style, stroke weight, and texture — so the
 * node is distinguishable WITHOUT relying on color alone.
 *
 * Consumes:
 *   - `designTokens.ARGUMENT` for argument-kind color families (VG-003)
 *   - `STANDING_BAND_TEXTURE_HINT` + `STANDING_BAND_SHAPE_HINT` for
 *     strength variation (SW-001)
 *   - `STANDING_BAND_SOFT_LABEL` for plain-language band copy
 *
 * This module is data-only — no UI integration here. Renderers (the
 * timeline node, the popover, the stack card) consume tokens in a
 * follow-up card.
 */
import { ARGUMENT } from '../../lib/designTokens';
import {
  STANDING_BAND_SHAPE_HINT,
  STANDING_BAND_SOFT_LABEL,
  STANDING_BAND_TEXTURE_HINT,
  type StandingBandTexture,
} from './standingBandCopy';
import type { TimelineKindColorFamily, TimelineStandingBand } from './argumentGameSurfaceModel';

// ── Public types ─────────────────────────────────────────────────

export type NodeShape =
  | 'circle'           // default / claim
  | 'diamond'          // challenge / disagreement
  | 'rounded_square'   // evidence
  | 'square'           // concession / synthesis
  | 'triangle'         // clarification request
  | 'branch_fork';     // structural branch

export type NodeStrokeStyle =
  | 'solid'
  | 'dashed'
  | 'dotted'
  | 'double';

export type NodeStrokeWeight = 1 | 2 | 3;

export type EvidenceMarker = 'none' | 'corner_dot' | 'underline';
export type SourceChainPressureMarker = 'none' | 'top_band' | 'left_chevron';

export interface ArgumentNodeVisualToken {
  /** Shape — never inferred from color; orthogonal to color so a
   *  desaturated or color-blind viewer can still distinguish nodes. */
  shape: NodeShape;
  /** Background + foreground hex pair from `designTokens.ARGUMENT`. */
  color: { bg: string; fg: string };
  /** Stroke style; varies by standing band strength. */
  stroke: { style: NodeStrokeStyle; weight: NodeStrokeWeight; color: string };
  /** Pattern descriptor; varies by standing band. */
  texture: StandingBandTexture;
  /** Standing-band shape glyph (single character) for compact
   *  desaturation-safe rendering. */
  shapeGlyph: string;
  /** Optional decoration when the argument is evidence-backed. */
  evidenceMarker: EvidenceMarker;
  /** Optional decoration when the message sits under unresolved
   *  source-chain pressure. */
  sourceChainPressureMarker: SourceChainPressureMarker;
  /** Tap target in dp/px; mobile a11y floor. */
  minTapTargetPx: 44;
  /** Plain-language label combining kind + soft band, suitable for
   *  screen readers. */
  accessibilityLabel: string;
}

export interface BuildVisualTokenInput {
  argumentType: TimelineKindColorFamily;
  standingBand: TimelineStandingBand;
  /** True when the message carries supporting evidence. */
  hasEvidence?: boolean;
  /** True when an open source-chain challenge sits on this message. */
  sourceChainPressure?: boolean;
}

export const MIN_TAP_TARGET_PX = 44 as const;

// ── Mapping tables ───────────────────────────────────────────────

/** Argument-type → shape. Pure structural; not a verdict. */
const SHAPE_BY_KIND: Record<TimelineKindColorFamily, NodeShape> = {
  claim: 'circle',
  challenge: 'diamond',
  evidence: 'rounded_square',
  clarify: 'triangle',
  concede: 'square',
  flag: 'circle',
  default: 'circle',
};

/** Pretty-cased kind labels. Plain language. */
const KIND_LABEL: Record<TimelineKindColorFamily, string> = {
  claim: 'Claim',
  challenge: 'Challenge',
  evidence: 'Evidence',
  clarify: 'Clarification',
  concede: 'Concession or synthesis',
  flag: 'Flag',
  default: 'Move',
};

/** Color pair per argument family. Falls back to neutral grey-tone if
 *  the designTokens.ARGUMENT does not have an entry. */
function colorForKind(kind: TimelineKindColorFamily): { bg: string; fg: string } {
  if (kind === 'claim') return ARGUMENT.claim;
  if (kind === 'challenge') return ARGUMENT.challenge;
  if (kind === 'evidence') return ARGUMENT.evidence;
  if (kind === 'clarify') return ARGUMENT.clarify;
  if (kind === 'concede') return ARGUMENT.concede;
  // `flag` + `default` fall back to a neutral surface tone.
  return { bg: '#1f2937', fg: '#cbd5e1' };
}

/** Standing band → stroke style + weight. Stronger bands get heavier
 *  / doubled outlines; weak / under-pressure bands get dashed. */
function strokeForBand(band: TimelineStandingBand): { style: NodeStrokeStyle; weight: NodeStrokeWeight } {
  switch (band) {
    case 'pretty_wrong':
      return { style: 'dashed', weight: 1 };
    case 'slightly_wrong':
      return { style: 'dotted', weight: 1 };
    case 'neutral':
      return { style: 'solid', weight: 1 };
    case 'slightly_right':
      return { style: 'solid', weight: 2 };
    case 'maybe_right_misguided':
      return { style: 'dashed', weight: 2 };
    case 'pretty_right':
      return { style: 'solid', weight: 3 };
    case 'completely_right':
      return { style: 'double', weight: 3 };
    case 'unscored':
      return { style: 'dotted', weight: 1 };
    case 'not_enough_signal':
      return { style: 'dotted', weight: 1 };
  }
}

// ── Public mapper ────────────────────────────────────────────────

export function buildArgumentNodeVisualToken(input: BuildVisualTokenInput): ArgumentNodeVisualToken {
  const { argumentType, standingBand, hasEvidence, sourceChainPressure } = input;

  const shape = SHAPE_BY_KIND[argumentType] ?? 'circle';
  const color = colorForKind(argumentType);
  const strokeBase = strokeForBand(standingBand);
  const texture = STANDING_BAND_TEXTURE_HINT[standingBand] ?? 'none';
  const shapeGlyph = STANDING_BAND_SHAPE_HINT[standingBand] ?? '·';

  const evidenceMarker: EvidenceMarker = hasEvidence ? 'corner_dot' : 'none';
  const sourceChainPressureMarker: SourceChainPressureMarker = sourceChainPressure ? 'top_band' : 'none';

  const accessibilityLabel = `${KIND_LABEL[argumentType] ?? 'Move'} · ${STANDING_BAND_SOFT_LABEL[standingBand]}`;

  return {
    shape,
    color,
    stroke: { ...strokeBase, color: color.fg },
    texture,
    shapeGlyph,
    evidenceMarker,
    sourceChainPressureMarker,
    minTapTargetPx: MIN_TAP_TARGET_PX,
    accessibilityLabel,
  };
}

// ── Re-export for consumers ──────────────────────────────────────

export { FORBIDDEN_TOKEN_TOKENS } from '../../lib/designTokens';
