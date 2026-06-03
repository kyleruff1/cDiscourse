/**
 * CORPUS-30-POOL-DRIVEN-PLANNER — constants module.
 *
 * Exports the fixed catalogues the planner consumes:
 *
 *   VOICES               — 8 voice catalogue entries (per design §7.1)
 *   SPINES               — 9 move-spine ids (per design §7.2)
 *   PROVOCATEUR_BANKS    — banks the provocateur may draw from (per design §4.3)
 *   REVOCATEUR_BANKS     — banks the revocateur may draw from (per design §4.3)
 *   BANK_FLOORS          — minimum option counts per bank (per design §4.2)
 *   MOVE_PLAN            — per-move bank rotation table keyed by moveIndex
 *                          (per design §4.4)
 *   ALLOWED_AXIS_HINTS   — the 10-axis vocab the renderer accepts
 *
 * Pure CommonJS. No imports of Supabase, React, network. Side-effect free.
 *
 * No truth labels appear here. No person-label, winner/loser, verdict, or
 * forbidden-user-label token is part of any voice id, spine id, or bank
 * name. These are structural metadata only.
 */

const VOICES = Object.freeze([
  'empiricist',
  'mechanism_hunter',
  'definitions_lawyer',
  'analogist',
  'steelman_cutter',
  'scope_narrower',
  'systems_thinker',
  'plain_skeptic',
]);

const SPINES = Object.freeze([
  'quote-led',
  'counterexample-led',
  'definition-led',
  'mechanism-led',
  'scope-led',
  'concession-then-pivot',
  'question-led',
  'analogy-led',
  'second-order-effect-led',
]);

const PROVOCATEUR_BANKS = Object.freeze([
  'opening_claim_options',
  'evidence_pressure_options',
  'alternative_explanation_options',
  'concession_or_narrowing_options',
]);

const REVOCATEUR_BANKS = Object.freeze([
  'objection_options',
  'evidence_pressure_options',
  'alternative_explanation_options',
  'resolution_pressure_options',
]);

const ALL_BANK_NAMES = Object.freeze([
  'opening_claim_options',
  'objection_options',
  'evidence_pressure_options',
  'alternative_explanation_options',
  'concession_or_narrowing_options',
  'resolution_pressure_options',
]);

/**
 * Per-bank floor counts. A seed whose bank falls below its floor is
 * marked `bankShortfall: true` by the post-processor and skipped by
 * the planner during selection (design §4.2 + §5 step 1).
 */
const BANK_FLOORS = Object.freeze({
  opening_claim_options: 4,
  objection_options: 4,
  evidence_pressure_options: 4,
  alternative_explanation_options: 3,
  concession_or_narrowing_options: 3,
  resolution_pressure_options: 3,
});

/**
 * Move-plan table per design §4.4.
 *
 * Each entry says: which role moves at this index, and either a fixed
 * bank (M1/M2/M9/M10) or a rotation set the planner picks from
 * deterministically.
 *
 * `role` ∈ { 'provocateur', 'revocateur' }.
 * `bankName` is non-null for fixed slots; null when a rotation applies.
 * `rotationSet` is non-null when bank is selected by deterministic hash.
 */
const MOVE_PLAN = Object.freeze({
  1: { role: 'provocateur', bankName: 'opening_claim_options', rotationSet: null },
  2: { role: 'revocateur', bankName: 'objection_options', rotationSet: null },
  3: {
    role: 'provocateur',
    bankName: null,
    rotationSet: ['evidence_pressure_options', 'alternative_explanation_options', 'concession_or_narrowing_options'],
  },
  4: {
    role: 'revocateur',
    bankName: null,
    rotationSet: ['evidence_pressure_options', 'alternative_explanation_options'],
  },
  5: {
    role: 'provocateur',
    bankName: null,
    rotationSet: ['concession_or_narrowing_options', 'evidence_pressure_options', 'alternative_explanation_options'],
  },
  6: {
    role: 'revocateur',
    bankName: null,
    rotationSet: ['resolution_pressure_options', 'evidence_pressure_options', 'alternative_explanation_options'],
  },
  7: {
    role: 'provocateur',
    bankName: null,
    rotationSet: ['alternative_explanation_options', 'concession_or_narrowing_options', 'evidence_pressure_options'],
  },
  8: {
    role: 'revocateur',
    bankName: null,
    rotationSet: ['resolution_pressure_options', 'alternative_explanation_options'],
  },
  9: { role: 'provocateur', bankName: 'concession_or_narrowing_options', rotationSet: null },
  10: { role: 'revocateur', bankName: 'resolution_pressure_options', rotationSet: null },
});

/**
 * Axis vocabulary mirrors xaiAdversarialMoveRenderer.ALLOWED_AXES.
 * Duplicated here as a constant so the planner can pick a deterministic
 * `axisHint` without importing the renderer (circular dep risk and to
 * keep this module dependency-free).
 */
const ALLOWED_AXIS_HINTS = Object.freeze([
  'fact',
  'definition',
  'causal',
  'value',
  'evidence',
  'logic',
  'scope',
  'source_chain',
  'anti_amplification',
  'framing',
]);

module.exports = {
  VOICES,
  SPINES,
  PROVOCATEUR_BANKS,
  REVOCATEUR_BANKS,
  ALL_BANK_NAMES,
  BANK_FLOORS,
  MOVE_PLAN,
  ALLOWED_AXIS_HINTS,
};
