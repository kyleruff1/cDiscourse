/**
 * SW-001 — Strong vs weak talking-point bands.
 *
 * Single source of truth for the user-facing copy + shape/texture
 * descriptors of the nine `TimelineStandingBand` values. Keeps strength
 * legible without truth/winner language and without relying only on
 * color (a screen-reader user, a desaturated display, or a color-blind
 * user can still tell the bands apart).
 *
 * Internal enum names (`pretty_wrong` / `completely_right` / …) are
 * deliberately preserved for back-compat across the existing model and
 * tests; only the rendered copy changed.
 */
import type { TimelineStandingBand } from './argumentGameSurfaceModel';

/**
 * Short, softened, Timeline-grade label. This is what users see on the
 * compact timeline and score tracker.
 *
 * Mapping from the SW-001 issue body:
 *   - Pretty wrong              -> "Needs work"
 *   - Slightly wrong            -> "Thin"
 *   - Neutral                   -> "Neutral"
 *   - Slightly right            -> "Some support"
 *   - Maybe right but misguided -> "Has a point, but risky"
 *   - Pretty right              -> "Well supported"
 *   - Completely right          -> "Strongly supported"
 *
 * Unscored / Not-enough-signal are kept as observation states; never as
 * verdict labels.
 */
export const STANDING_BAND_SOFT_LABEL: Record<TimelineStandingBand, string> = {
  pretty_wrong: 'Needs work',
  slightly_wrong: 'Thin',
  neutral: 'Neutral',
  slightly_right: 'Some support',
  maybe_right_misguided: 'Has a point, but risky',
  pretty_right: 'Well supported',
  completely_right: 'Strongly supported',
  unscored: 'No reading yet',
  not_enough_signal: 'Not enough yet',
};

/**
 * Longer one-sentence prose suitable for Stack / Cards surfaces where
 * there is room for the richer seven-band label. Optional — components
 * that need a short label still use STANDING_BAND_SOFT_LABEL.
 */
export const STANDING_BAND_RICH_DESCRIPTION: Record<TimelineStandingBand, string> = {
  pretty_wrong: 'Needs work — the supporting chain has visible gaps.',
  slightly_wrong: 'Thin — some support, but the chain breaks under pressure.',
  neutral: 'Neutral — neither lifted nor pressured by what is on the table.',
  slightly_right: 'Some support — at least one piece of evidence stands up.',
  maybe_right_misguided: 'Has a point, but risky — the framing or scope may overreach.',
  pretty_right: 'Well supported — multiple pieces of the chain hold up.',
  completely_right: 'Strongly supported — every challenged piece has been answered.',
  unscored: 'No reading yet — this move has not been pressured or supported.',
  not_enough_signal: 'Not enough yet — too few signals to read confidently.',
};

/**
 * Single-character glyph that varies per band. Used as a prefix in
 * compact UIs so the band is distinguishable from color alone (covers
 * desaturated displays and color-blind users).
 *
 * Glyphs chosen for visual variety, not semantic ranking: a reader
 * should NOT infer "more is better" from the symbol order; the soft
 * label carries the meaning.
 */
export const STANDING_BAND_SHAPE_HINT: Record<TimelineStandingBand, string> = {
  pretty_wrong: '◌',           // dotted small circle
  slightly_wrong: '△',          // upward triangle
  neutral: '·',                 // middle dot
  slightly_right: '◇',          // open diamond
  maybe_right_misguided: '◈',   // diamond with inner point
  pretty_right: '◐',            // half-filled circle
  completely_right: '◆',        // filled diamond
  unscored: '○',                // empty circle
  not_enough_signal: '◌',       // dotted circle (same as pretty_wrong by design — both mean "low signal")
};

/**
 * Texture descriptor data. Components that render the band can use
 * this to apply a fill pattern (stripes / cross-hatch / solid) in
 * addition to color. Pure data; the components decide whether to
 * honor it.
 */
export type StandingBandTexture =
  | 'none'
  | 'cross_hatch'
  | 'diagonal_stripes'
  | 'solid_fill';

export const STANDING_BAND_TEXTURE_HINT: Record<TimelineStandingBand, StandingBandTexture> = {
  pretty_wrong: 'diagonal_stripes',
  slightly_wrong: 'diagonal_stripes',
  neutral: 'none',
  slightly_right: 'none',
  maybe_right_misguided: 'cross_hatch',
  pretty_right: 'solid_fill',
  completely_right: 'solid_fill',
  unscored: 'none',
  not_enough_signal: 'cross_hatch',
};

/**
 * Format a band with its shape glyph + soft label, e.g. "◐ Well supported".
 */
export function formatStandingBandShort(band: TimelineStandingBand): string {
  return `${STANDING_BAND_SHAPE_HINT[band]} ${STANDING_BAND_SOFT_LABEL[band]}`;
}

/**
 * Format the band for Stack / Cards rendering: soft label + dash + rich
 * description. Plain language; no internal codes.
 */
export function formatStandingBandRich(band: TimelineStandingBand): string {
  return STANDING_BAND_RICH_DESCRIPTION[band];
}

/**
 * Tokens that must never appear in user-facing standing-band copy.
 * Used by `__tests__/standingBandCopy.test.ts` to lock the contract.
 *
 * "right" and "wrong" appear in the internal enum keys (for stable
 * model API), so the test scans labels and descriptions only, not the
 * `TimelineStandingBand` union itself.
 */
export const FORBIDDEN_STANDING_BAND_TOKENS: readonly string[] = [
  'winner',
  'loser',
  'truth',
  'liar',
  'dishonest',
  'bad faith',
  'manipulative',
  'extremist',
  'propagandist',
  'right',
  'wrong',
];
