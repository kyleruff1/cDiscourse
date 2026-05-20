/**
 * BR-004 — Branch grammar render contract (pure TypeScript).
 *
 * The render-token layer for the branch direction grammar. Given a
 * `BranchDirection`, it returns the geometry / shape / stroke tokens the
 * timeline rail uses to draw that direction. It is split out from
 * `branchGrammarModel.ts` so the grammar model never imports a render
 * concern and a future card can swap render tokens without touching the
 * grammar logic.
 *
 * Doctrine (timeline-grammar + accessibility-targets):
 *
 *   **Direction is conveyed by position + shape + stroke — never color
 *   alone.** A colorblind / grayscale user must still tell the three
 *   directions apart. The three non-evidence directions therefore each
 *   carry a UNIQUE `(positionToken, shapeToken, strokeToken)` triple:
 *     - mainline   -> horizontal      + spine   + solid_prominent
 *     - chime-in   -> vertical_offset + bracket + solid_subordinate
 *     - tangent    -> diagonal_kink   + kink    + dashed
 *
 *   **No new color token, no new shape primitive, no new stroke
 *   weight.** Every token value maps onto VG-001/VG-002's existing
 *   vocabulary — the rail already understands kink rotation, stub flags,
 *   and the spine/dashed strokes. BR-004 supplies WHICH token, never new
 *   geometry.
 *
 *   **`evidence_passthrough` yields entirely.** It returns `'inherit'`
 *   for every render token — the renderer is contractually told "do not
 *   apply a BR-004 visual; render exactly as BR-001/VG-002 already do."
 *   This is the explicit no-collision guarantee.
 *
 * Pure TS. No React. No Supabase. No network. No async. No mutation.
 */

import type { BranchDirection } from './branchGrammarModel';

// ── Token types ─────────────────────────────────────────────────

/**
 * Geometry token — how the branch leaves the mainline.
 *   'horizontal'      — mainline: continues straight along the spine
 *   'vertical_offset' — chime-in: leaves at a near-vertical angle
 *   'diagonal_kink'   — tangent: leaves at a visible diagonal kink
 *   'inherit'         — evidence_passthrough: BR-004 yields, no override
 */
export type BranchPositionToken =
  | 'horizontal'
  | 'vertical_offset'
  | 'diagonal_kink'
  | 'inherit';

/**
 * Shape token for the branch's connector node — reuses VG-001's existing
 * shape vocabulary. NO new shape primitive is invented.
 *   'spine'   — mainline: the rail's straight strip
 *   'bracket' — chime-in: a square-shouldered vertical join
 *   'kink'    — tangent: VG-001's existing bent-connector
 *   'inherit' — evidence_passthrough
 */
export type BranchShapeToken = 'spine' | 'bracket' | 'kink' | 'inherit';

/**
 * Stroke token — reuses VG-001's existing stroke weights.
 *   'solid_prominent'   — mainline: thickest, always most prominent
 *   'solid_subordinate' — chime-in: thinner, visually subordinate to the
 *                         mainline until clicked into
 *   'dashed'            — tangent: VG-001's existing dashed branch edge
 *   'inherit'           — evidence_passthrough
 */
export type BranchStrokeToken =
  | 'solid_prominent'
  | 'solid_subordinate'
  | 'dashed'
  | 'inherit';

/**
 * BR-004 — the render tokens for one `BranchDirection`. Consumed by the
 * rail / stub components. Color is SUPPLEMENTARY — shape + position +
 * stroke carry the meaning.
 */
export interface BranchDirectionVisual {
  direction: BranchDirection;
  positionToken: BranchPositionToken;
  shapeToken: BranchShapeToken;
  strokeToken: BranchStrokeToken;
  /**
   * Whether this direction's branch renders visually subordinate until
   * the user clicks into it. True only for `chime_in_vertical` — the
   * card requires chime-ins to be "visually subordinate to the mainline
   * until clicked" and to require an intentional click-in.
   */
  subordinateUntilSelected: boolean;
  /** Plain-language a11y fragment, e.g. "chime-in branch, vertical". */
  accessibilityFragment: string;
}

// ── The single source of the token map ──────────────────────────

/**
 * The closed token map. The render contract introduces no token value
 * outside this frozen record — tests assert every produced value is a
 * member.
 */
const VISUAL_BY_DIRECTION: Readonly<Record<BranchDirection, BranchDirectionVisual>> =
  Object.freeze({
    mainline: Object.freeze({
      direction: 'mainline',
      positionToken: 'horizontal',
      shapeToken: 'spine',
      strokeToken: 'solid_prominent',
      subordinateUntilSelected: false,
      accessibilityFragment: 'main thread, horizontal',
    }),
    chime_in_vertical: Object.freeze({
      direction: 'chime_in_vertical',
      positionToken: 'vertical_offset',
      shapeToken: 'bracket',
      strokeToken: 'solid_subordinate',
      subordinateUntilSelected: true,
      accessibilityFragment: 'chime-in branch, vertical',
    }),
    tangent_diagonal: Object.freeze({
      direction: 'tangent_diagonal',
      positionToken: 'diagonal_kink',
      shapeToken: 'kink',
      strokeToken: 'dashed',
      subordinateUntilSelected: false,
      accessibilityFragment: 'side issue branch, diagonal',
    }),
    evidence_passthrough: Object.freeze({
      direction: 'evidence_passthrough',
      positionToken: 'inherit',
      shapeToken: 'inherit',
      strokeToken: 'inherit',
      subordinateUntilSelected: false,
      accessibilityFragment: 'evidence branch',
    }),
  });

/**
 * Build the render tokens for one `BranchDirection`. Pure. Total over
 * the `BranchDirection` union. The single source of the token map — the
 * rail / stub read its output, never re-derive it.
 *
 * `evidence_passthrough` returns `'inherit'` for every token: BR-004
 * yields and the renderer draws the evidence branch exactly as
 * BR-001/VG-002 already do.
 */
export function buildBranchDirectionVisual(
  direction: BranchDirection,
): BranchDirectionVisual {
  return (
    VISUAL_BY_DIRECTION[direction] ??
    // Defensive — unreachable for the typed union. Yields rather than
    // guessing a visual.
    VISUAL_BY_DIRECTION.evidence_passthrough
  );
}

/** Frozen list of every position token. Tests assert closed vocabulary. */
export const ALL_BRANCH_POSITION_TOKENS: ReadonlyArray<BranchPositionToken> =
  Object.freeze(['horizontal', 'vertical_offset', 'diagonal_kink', 'inherit']);

/** Frozen list of every shape token. Tests assert closed vocabulary. */
export const ALL_BRANCH_SHAPE_TOKENS: ReadonlyArray<BranchShapeToken> =
  Object.freeze(['spine', 'bracket', 'kink', 'inherit']);

/** Frozen list of every stroke token. Tests assert closed vocabulary. */
export const ALL_BRANCH_STROKE_TOKENS: ReadonlyArray<BranchStrokeToken> =
  Object.freeze(['solid_prominent', 'solid_subordinate', 'dashed', 'inherit']);
