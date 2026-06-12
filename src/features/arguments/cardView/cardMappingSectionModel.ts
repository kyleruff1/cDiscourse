/**
 * MCP-OBSERVATION-MAPPING-EXPANSION-001 (Slice B) — Card "Combination
 * observations" section model.
 *
 * Pure-TS builder that turns the Slice-A evaluator's `ObservationMappingResult[]`
 * (already composite-supersedes-singles-resolved, already surface-filtered to
 * `card`, already routed through `gameCopy.toPlainLanguageOrSuppress`) into the
 * display props the `CardDetailPanel` renders as a NEW, ADDITIVE "Combination
 * observations" section.
 *
 * What this model does NOT do (it is the THIN render-prep layer):
 *   - It NEVER calls the evaluator (the surface computes the per-node positive
 *     rawKeys and calls `evaluateObservationMapping`; this model only formats
 *     the results). POST-STORAGE, display-only.
 *   - It NEVER blocks / routes / suppresses / delays a post — there is no gate
 *     field on a chip.
 *
 * Doctrine (cdiscourse-doctrine §1 / §9 / §10a; design §2 / §3 invariant 2/5):
 *   - Every chip is advisory ("what the referee noticed — advisory, not a
 *     verdict."), about the MOVE, never a verdict, never a person label.
 *   - Confidence is rendered as PIPS (1/2/3), NEVER a number.
 *   - DEFENSIVE plain-language guard: any chip whose `displayLabel` still
 *     looks like an internal snake_case code is DROPPED (the evaluator already
 *     guarantees this, but the card never echoes a raw code — mirrors the
 *     §10a posture of the existing classifier strip).
 *   - DEFENSIVE production-roster guard: the registry is the A–I production
 *     roster, but any result whose `familyKey` references the frozen Family J
 *     (`sensitive_composer`) is DROPPED so the card can never surface J even
 *     if a future registry edit slips one in.
 *   - All output is `machine_observation`; no `inactive_reason` / "why hidden"
 *     copy is ever emitted (§10a).
 *
 * Pure TS. No React. No Supabase. No network. No AI. No `Date.now()`,
 * no `Math.random()`, no mutation of inputs. Deterministic.
 */

import type { ObservationMappingResult } from '../../nodeLabels/observationMapping';
import { FROZEN_HIJ_FAMILIES } from '../../nodeLabels/observationMapping';
import { looksLikeInternalCode } from '../gameCopy';

// ── Locked plain-language copy (doctrine-anchored constants) ──────────

/** Section heading. NEUTRAL — never "Add …" (which would imply a mutation).
 *  These richer combination labels sit beside the per-observation strip. */
export const CARD_MAPPING_SECTION_HEADING = 'Combination observations';

/** Advisory caption rendered ABOVE the section. Display-only; identical
 *  framing to the existing classifier zone so the two read as one advisory
 *  surface. */
export const CARD_MAPPING_ADVISORY_CAPTION =
  'What the referee noticed — advisory, not a verdict.';

/** Teaching empty state — shown when no combination rule fired. Never
 *  "clean" / "no issues" (which would read as a verdict). */
export const CARD_MAPPING_EMPTY_STATE =
  'No combination observations yet on this move.';

/** Plain-language confidence words (for screen readers). Mapped from the
 *  result's pip level; never surfaced as a number. */
const CONFIDENCE_LABEL: Record<'low' | 'medium' | 'high', string> = {
  low: 'low confidence',
  medium: 'medium confidence',
  high: 'high confidence',
};

const CONFIDENCE_PIPS: Record<'low' | 'medium' | 'high', 1 | 2 | 3> = {
  low: 1,
  medium: 2,
  high: 3,
};

const FROZEN_HIJ_FAMILY_SET: ReadonlySet<string> = new Set<string>(
  FROZEN_HIJ_FAMILIES,
);

// ── Public model shapes ───────────────────────────────────────────────

/**
 * One combination-observation chip. Display-only — there is NO onPress,
 * NO route/block/suppress field, and the screen-reader role is `text`.
 */
export interface CardMappingChip {
  /** Stable React key — the rule's `mappingId`. */
  id: string;
  /** Compact plain-language combination label (the result's `shortLabel`). */
  label: string;
  /** The longer plain-language display label (the result's `displayLabel`),
   *  routed through gameCopy by the evaluator. Used for the a11y name. */
  longLabel: string;
  /** Verdict-free one-line diagnostic sentence about the MOVE. */
  diagnosticSentence: string;
  /** Confidence pip count: low=1, medium=2, high=3. Never a number. */
  confidencePips: 1 | 2 | 3;
  /** Locked plain-language confidence word for screen readers. */
  confidenceLabel: string;
  /** Pre-built screen-reader label (advisory framing + confidence word). */
  accessibilityLabel: string;
}

export interface CardMappingSectionModel {
  /** Ordered combination chips (ordering preserved from the evaluator, which
   *  already sorts by displayPriority then mappingId). */
  chips: ReadonlyArray<CardMappingChip>;
  /** Section heading — locked copy. */
  heading: string;
  /** Fixed advisory caption — locked copy. */
  advisoryCaption: string;
  /** Empty-state copy when `chips.length === 0`. Teaching copy. */
  emptyStateCopy: string;
  /** True when there is at least one chip. */
  hasSignals: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────

/** A result is renderable on the card iff it is a machine observation with a
 *  plain-language (non-internal-code) display + short label AND its family is
 *  not a frozen H/I/J family (defensive). Pure. */
function isRenderableResult(result: ObservationMappingResult): boolean {
  if (!result || result.kind !== 'machine_observation') return false;
  const label =
    typeof result.displayLabel === 'string' ? result.displayLabel.trim() : '';
  const shortLabel =
    typeof result.shortLabel === 'string' ? result.shortLabel.trim() : '';
  if (label.length === 0 || shortLabel.length === 0) return false;
  // Never echo a raw internal code (§9 / §10a). The evaluator already
  // guarantees this; this is the card's own defensive guard.
  if (looksLikeInternalCode(label) || looksLikeInternalCode(shortLabel)) {
    return false;
  }
  // Production roster only (A–I) — drop anything referencing the frozen
  // Family J even though the registry never authors one (the
  // `${famA}+${famB}` cross-family key is split so either half tripping the
  // set drops the chip).
  const familyKey = typeof result.familyKey === 'string' ? result.familyKey : '';
  for (const part of familyKey.split('+')) {
    if (FROZEN_HIJ_FAMILY_SET.has(part)) return false;
  }
  return true;
}

function toChip(result: ObservationMappingResult): CardMappingChip {
  const pips = CONFIDENCE_PIPS[result.confidencePip];
  const confidenceLabel = CONFIDENCE_LABEL[result.confidencePip];
  const longLabel = result.displayLabel.trim();
  const shortLabel = result.shortLabel.trim();
  const diagnosticSentence =
    typeof result.diagnosticSentence === 'string'
      ? result.diagnosticSentence.trim()
      : '';
  const accessibilityLabel = `Machine observation: ${longLabel}, ${confidenceLabel}`;
  return {
    id: result.mappingId,
    label: shortLabel,
    longLabel,
    diagnosticSentence,
    confidencePips: pips,
    confidenceLabel,
    accessibilityLabel,
  };
}

// ── Builder ───────────────────────────────────────────────────────────

/**
 * Build the "Combination observations" section model from the evaluator's
 * already-computed `card`-surface results. Pure.
 *
 * Returns the teaching empty-state model for every degenerate input
 * (no results, all results dropped by the defensive guards). Never throws,
 * never mutates the input.
 */
export function buildCardMappingSection(
  results: ReadonlyArray<ObservationMappingResult> | null | undefined,
): CardMappingSectionModel {
  const base = {
    heading: CARD_MAPPING_SECTION_HEADING,
    advisoryCaption: CARD_MAPPING_ADVISORY_CAPTION,
    emptyStateCopy: CARD_MAPPING_EMPTY_STATE,
  };
  if (!Array.isArray(results) || results.length === 0) {
    return { ...base, chips: [], hasSignals: false };
  }
  const chips = results.filter(isRenderableResult).map(toChip);
  return { ...base, chips, hasSignals: chips.length > 0 };
}
