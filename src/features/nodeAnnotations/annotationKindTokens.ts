/**
 * UX-001.5 — Annotation chip kind/iconHint → designToken color mapping
 * (pure TS).
 *
 * The single source of truth for chip / badge / outline colors used by
 * the primitive layer. Every color is resolved from `designTokens.ts`
 * (`SURFACE_TOKENS`, `STATUS`, `ARGUMENT`) — primitive code NEVER uses
 * hex literals.
 *
 * Per-band cross-viewport sizing tables (chip strip max-visible, chip
 * height, badge diameter, overflow chip min-width) also live here so the
 * primitive layer keeps one resolver per dimension.
 *
 * Doctrine:
 *   - No verdict / green-correct / red-wrong traffic-light coloring.
 *     `STATUS.success.bg` / `STATUS.danger.bg` are used ONLY for the
 *     border accent on `iconHint: 'check'`; primary chip backgrounds
 *     stay grayscale + neutral indigo/orange/cobalt — informational,
 *     not evaluative.
 *   - Color is supplementary; shape, glyph, and label carry meaning.
 *   - Pure TS. No React. No Supabase. No network.
 */

import { ARGUMENT, STATUS, SURFACE_TOKENS } from '../../lib/designTokens';
import type {
  AnnotationChipDescriptor,
  AnnotationChipIconHint,
  AnnotationChipKind,
} from './annotationChipDescriptor';

/** The resolved chip color triple. */
export interface ChipColors {
  /** Background fill — surface token only. */
  bg: string;
  /** Foreground text + icon color — text token only. */
  fg: string;
  /** Border color — defaults to `SURFACE_TOKENS.border`; may shift per iconHint. */
  borderColor: string;
}

/**
 * Kind → color triple. Every value is a token, never a literal.
 *
 * Mapping rationale (design §10):
 *   - `state`     → raised + textPrimary  (the bright resting chip)
 *   - `context`   → STATUS.neutral        (neutral information chip)
 *   - `lifecycle` → elevated + textSecondary (de-emphasized stage)
 *   - `evidence`  → ARGUMENT.evidence     (uses the existing argument family)
 *   - `flag`      → elevated + warning border (advisory, not evaluative)
 *   - `semantic`  → elevated + textSecondary (referee output, muted)
 */
const KIND_TOKEN_TABLE: Readonly<Record<AnnotationChipKind, ChipColors>> = Object.freeze({
  state: {
    bg: SURFACE_TOKENS.raised,
    fg: SURFACE_TOKENS.textPrimary,
    borderColor: SURFACE_TOKENS.border,
  },
  context: {
    bg: STATUS.neutral.bg,
    fg: STATUS.neutral.fg,
    borderColor: SURFACE_TOKENS.border,
  },
  lifecycle: {
    bg: SURFACE_TOKENS.elevated,
    fg: SURFACE_TOKENS.textSecondary,
    borderColor: SURFACE_TOKENS.border,
  },
  evidence: {
    bg: ARGUMENT.evidence.bg,
    fg: ARGUMENT.evidence.fg,
    borderColor: SURFACE_TOKENS.border,
  },
  flag: {
    bg: SURFACE_TOKENS.elevated,
    fg: SURFACE_TOKENS.textPrimary,
    borderColor: STATUS.warning.bg,
  },
  semantic: {
    bg: SURFACE_TOKENS.elevated,
    fg: SURFACE_TOKENS.textSecondary,
    borderColor: SURFACE_TOKENS.border,
  },
});

/**
 * Resolves the chip color triple for a descriptor's kind + iconHint.
 *
 * Default kind: `'context'` (neutral, informative). `iconHint` may shift
 * the BORDER only — the glyph carries the meaning regardless; the border
 * shade is supplementary.
 *
 * Pure. Deterministic. No allocation beyond the returned object.
 */
export function resolveChipColors(
  kind?: AnnotationChipKind,
  iconHint?: AnnotationChipIconHint,
): ChipColors {
  const base = KIND_TOKEN_TABLE[kind ?? 'context'];

  if (iconHint === 'warn') {
    return { ...base, borderColor: STATUS.warning.bg };
  }
  if (iconHint === 'check') {
    return { ...base, borderColor: STATUS.success.bg };
  }
  return { ...base };
}

/**
 * Convenience: resolve colors for a full descriptor. Tiny wrapper so
 * callers don't have to destructure.
 */
export function resolveChipColorsForDescriptor(
  descriptor: AnnotationChipDescriptor,
): ChipColors {
  return resolveChipColors(descriptor.kind, descriptor.iconHint);
}

// ── Cross-viewport sizing (design §9) ──────────────────────────

/**
 * Maximum visible chips in an `AnnotationChipStrip` before the
 * overflow chip appears. Per-band caps from design §9.
 */
export const ANNOTATION_STRIP_MAX_VISIBLE_BY_BAND = Object.freeze({
  phone: 3,
  tablet: 4,
  wide: 6,
}) as Readonly<Record<'phone' | 'tablet' | 'wide', number>>;

/**
 * Chip outer height by band. Phone keeps the 28-px target chip; tablet
 * + wide use the 32-px chip.
 */
export const ANNOTATION_CHIP_HEIGHT_BY_BAND = Object.freeze({
  phone: 28,
  tablet: 32,
  wide: 32,
}) as Readonly<Record<'phone' | 'tablet' | 'wide', number>>;

/**
 * Badge diameter by band. Phone caps at 8 px (per brief §"Cross-viewport
 * rendering"); tablet + wide use 10 px so an inner glyph fits.
 */
export const ANNOTATION_BADGE_DIAMETER_BY_BAND = Object.freeze({
  phone: 8,
  tablet: 10,
  wide: 10,
}) as Readonly<Record<'phone' | 'tablet' | 'wide', number>>;

/**
 * Minimum width for an `AnnotationOverflowChip` so a `+N` value with up
 * to two digits stays legible. The chip ALSO grows to fit larger N
 * (this is a floor, not a clamp).
 */
export const ANNOTATION_OVERFLOW_MIN_WIDTH_BY_BAND = Object.freeze({
  phone: 28,
  tablet: 32,
  wide: 36,
}) as Readonly<Record<'phone' | 'tablet' | 'wide', number>>;

/** A band label. Matches `useHeaderBreakpoint`'s `Band` type. */
export type AnnotationBand = 'phone' | 'tablet' | 'wide';

/**
 * Pure resolver — looks up a band table value with the `tablet` default
 * for an unknown band. Used by component code that may receive an
 * absent or unexpected `band` prop.
 */
export function resolveBandValue<T>(
  table: Readonly<Record<AnnotationBand, T>>,
  band: AnnotationBand | undefined,
): T {
  if (band === 'phone' || band === 'tablet' || band === 'wide') {
    return table[band];
  }
  return table.tablet;
}
