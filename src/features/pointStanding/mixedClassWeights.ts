/**
 * Stage 6.1.4 — `mixedAgreementClass` → playable-tension floor + UI nudge.
 *
 * These weights are read by the scoring engine when deciding whether a move
 * created issue debt and what nudge the UI should show. They are constants;
 * the operator changes them with a code review, not with config.
 */

import type { MixedAgreementClass, MixedClassWeights } from './types';

export const MIXED_CLASS_WEIGHTS: Record<MixedAgreementClass, MixedClassWeights> = {
  broad_accept_narrow_decline: {
    playableTensionScore: 0.9,
    createsIssueDebt: true,
    preferredUiNudge: 'You agree with the main point. Name the narrower issue you reject.',
  },
  narrow_accept_broad_decline: {
    playableTensionScore: 0.75,
    createsIssueDebt: true,
    preferredUiNudge: 'You accept a subpoint but reject the larger framing. Make that contrast explicit.',
  },
  broad_accept_broad_decline: {
    playableTensionScore: 0.55,
    createsIssueDebt: true,
    preferredUiNudge: 'This looks conflicted. Separate the accepted framing from the rejected conclusion.',
  },
  narrow_accept_narrow_decline: {
    playableTensionScore: 0.7,
    createsIssueDebt: true,
    preferredUiNudge: 'You are splitting the local issue. Clarify which narrow part stands and which fails.',
  },
  pure_accept: {
    playableTensionScore: 0.25,
    createsIssueDebt: false,
    preferredUiNudge: 'Extend, add evidence, or identify a caveat to make this playable.',
  },
  pure_decline: {
    playableTensionScore: 0.45,
    createsIssueDebt: true,
    preferredUiNudge: 'Name the axis of disagreement: scope, evidence, definition, causal, logic, or value.',
  },
  unclear_mixed: {
    playableTensionScore: 0.2,
    createsIssueDebt: false,
    preferredUiNudge: 'Clarify what you accept and what you reject.',
  },
  tangent_or_joke: {
    playableTensionScore: 0.1,
    createsIssueDebt: false,
    preferredUiNudge: 'This may be a tangent. Branch it or connect it to the parent point.',
  },
};

/** Convenience accessor used by the engine + tests. */
export function getMixedClassWeights(klass: MixedAgreementClass): MixedClassWeights {
  return MIXED_CLASS_WEIGHTS[klass];
}
