/**
 * Stage 6.1.4 — Concession effects.
 *
 * Doctrine encoded here: a narrow, explicit concession that preserves the
 * broad point earns the most "responder recovery" credit. A performative
 * concession that does no actual repair earns nothing AND opens an
 * unresolved-debt penalty.
 */

import { CONCESSION_MARKERS } from '../devFixtures/argumentScenarioValidation';
import type {
  ConcessionEffect,
  ConcessionEffectWeights,
  GradingFlags,
} from './types';

export const CONCESSION_EFFECT_WEIGHTS: Record<ConcessionEffect, ConcessionEffectWeights> = {
  explicit_narrow_concession_preserves_broad_point: {
    responderRecoveryGain: 0.35,
    concessionIntegrityGain: 0.25,
    challengerPressureGain: 0.20,
    unresolvedDebtPenalty: 0,
  },
  explicit_broad_concession_abandons_point: {
    responderRecoveryGain: 0.05,
    concessionIntegrityGain: 0.30,
    challengerPressureGain: 0.40,
    unresolvedDebtPenalty: 0,
  },
  implied_narrow_concession_preserves_broad_point: {
    responderRecoveryGain: 0.20,
    concessionIntegrityGain: 0.05,
    challengerPressureGain: 0.25,
    unresolvedDebtPenalty: 0,
  },
  implied_broad_concession_abandons_point: {
    responderRecoveryGain: 0,
    concessionIntegrityGain: 0.05,
    challengerPressureGain: 0.45,
    unresolvedDebtPenalty: 0,
  },
  performative_concession_no_repair: {
    responderRecoveryGain: 0,
    concessionIntegrityGain: 0,
    challengerPressureGain: 0.10,
    unresolvedDebtPenalty: 0.20,
  },
  no_concession: {
    responderRecoveryGain: 0,
    concessionIntegrityGain: 0,
    challengerPressureGain: 0,
    unresolvedDebtPenalty: 0.25,
  },
};

export function getConcessionEffectWeights(effect: ConcessionEffect): ConcessionEffectWeights {
  return CONCESSION_EFFECT_WEIGHTS[effect];
}

// ── Detection ─────────────────────────────────────────────────

/**
 * Phrases that indicate the responder is *narrowing* their original claim
 * rather than abandoning it. The presence of any of these — plus a
 * concession marker — qualifies the move as
 * `*_narrow_concession_preserves_broad_point`.
 */
const NARROWING_PHRASES = [
  'i mean',
  'specifically',
  'in the narrow',
  'limited to',
  'limited only to',
  'only for',
  'only the',
  'narrow the claim',
  'narrow that',
  'narrow that down',
  'the narrower',
  'narrower claim',
  'i\'ll narrow',
  "i'll narrow",
  'i grant the narrow',
  'i grant only',
  'i acknowledge only',
  'high-demand',
  'edge case',
  'in this case',
  'this case',
  'corridor',
  'specific to',
];

const ABANDONMENT_PHRASES = [
  'i was wrong about the whole',
  'i was wrong overall',
  'i drop the claim',
  'i withdraw the claim',
  'whole claim is wrong',
  'i was off',
  'i overreached',
  "i'll drop it",
  'abandon the claim',
  'retract the claim',
];

function hasAnyLower(text: string, patterns: string[]): boolean {
  const lc = String(text || '').toLowerCase();
  return patterns.some((p) => lc.includes(p));
}

function hasExplicitConcessionMarker(text: string): boolean {
  const lc = String(text || '').toLowerCase();
  return CONCESSION_MARKERS.some((m) => lc.includes(m));
}

/**
 * Per-doctrine: a concession is only ELIGIBLE if there's a live debt. The
 * detector here only asks "what shape of concession did the responder make?"
 * — the eligibility gate is enforced upstream in the engine.
 */
export interface ClassifyConcessionInput {
  repairText: string;
  repairFlags: GradingFlags;
  /** Did the responder originally voice this point? Used to detect "self-concession loops." */
  repairAuthorIsOriginalSpeaker: boolean;
}

export function classifyConcessionEffect(input: ClassifyConcessionInput): ConcessionEffect {
  const text = String(input.repairText || '');
  const explicit = hasExplicitConcessionMarker(text);
  const narrows = hasAnyLower(text, NARROWING_PHRASES);
  const abandons = hasAnyLower(text, ABANDONMENT_PHRASES);

  // No concession marker and no shift at all → no_concession.
  if (!explicit && !narrows && !abandons) return 'no_concession';

  // A "fair point." that doesn't actually narrow or abandon is performative.
  if (explicit && !narrows && !abandons) return 'performative_concession_no_repair';

  if (explicit && narrows) return 'explicit_narrow_concession_preserves_broad_point';
  if (explicit && abandons) return 'explicit_broad_concession_abandons_point';
  if (!explicit && narrows) return 'implied_narrow_concession_preserves_broad_point';
  if (!explicit && abandons) return 'implied_broad_concession_abandons_point';

  return 'no_concession';
}

export {
  NARROWING_PHRASES as NARROWING_CONCESSION_PHRASES,
  ABANDONMENT_PHRASES as ABANDONMENT_CONCESSION_PHRASES,
  hasExplicitConcessionMarker,
};
