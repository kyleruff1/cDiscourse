/**
 * Stage 6.1.5.2 — Anti-amplification scoring rule.
 *
 * Doctrine (verbatim from the spec):
 *
 *   "A message can receive engagement credit for creating playable tension,
 *    but it cannot receive factual-standing credit merely because it is
 *    popular, repeated, or aligned with a visible crowd.
 *
 *    If a claim is high-amplification and low-evidence:
 *      - allow it as an opinion or playable prompt,
 *      - mark evidence debt,
 *      - ask for a receipt / quote / primary source,
 *      - suppress factual-standing gain until support arrives.
 *
 *    If a reply agrees with a viral claim but adds no evidence:
 *      - count it as agreement,
 *      - do not count it as evidentiary support.
 *
 *    If a reply narrows, sources, or clarifies the viral claim:
 *      - reward the narrowing / sourcing / clarification,
 *      - not the original amplification."
 *
 * Implementation:
 *   - This module post-processes a `PointStandingDelta` already produced by
 *     `gradeChallenge` / `gradeRepair`. Engagement credit
 *     (`challengerPressureGain`, `responderRecoveryGain`,
 *     `concessionIntegrityGain`) is preserved.
 *   - Factual-standing credit (positive `broadStandingDelta` /
 *     `narrowStandingDelta`) is suppressed when the move is high-amplification
 *     and brings no evidence. Negative deltas (penalties / decline shifts)
 *     are preserved — the doctrine constrains gains, not consequences.
 *   - When a reply brings evidence or narrows scope, the suppression is
 *     released and the move is also flagged as
 *     `evidenceConversionRewarded: true` so the UI can credit the conversion.
 *
 * Pure TypeScript. No network. No Supabase. No xAI. No Anthropic.
 */

import type {
  AmplificationContext,
  PointStandingDelta,
} from './types';

export interface AntiAmplificationResult {
  adjustedDelta: PointStandingDelta;
  /** True when factual-standing gain was suppressed on this move. */
  factualStandingGainSuppressed: boolean;
  /** True when the move converted amplification into evidence/narrowing and earned the conversion credit. */
  evidenceConversionRewarded: boolean;
  /** Recommended composer nudge — drawn from the doctrine. */
  recommendedNudge:
    | 'ask_for_primary_source'
    | 'ask_for_quote_anchor'
    | 'ask_for_scope_narrowing'
    | 'allow_as_opinion_no_factual_credit'
    | 'allow_point_standing_after_evidence'
    | 'none';
  /** Short human-readable rationale referencing observable fields only. */
  rationale: string;
}

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

function shallowCopyDelta(d: PointStandingDelta): PointStandingDelta {
  return { ...d };
}

/**
 * Apply the anti-amplification doctrine to a `PointStandingDelta`. Returns
 * a NEW delta (the input is not mutated) plus advisory flags.
 *
 * Inputs:
 *   - `delta`: the raw delta produced by `gradeChallenge` / `gradeRepair`.
 *   - `ctx`: amplification + evidentiary signals for the move, derived from
 *     the move's Anthropic annotation (or the deterministic fallback's
 *     equivalents).
 */
export function applyAntiAmplification(
  delta: PointStandingDelta,
  ctx: AmplificationContext,
): AntiAmplificationResult {
  const out = shallowCopyDelta(delta);

  // ── Fast path: no amplification concerns + no warning → return as-is.
  if (!ctx.platformSupportWarning && ctx.amplificationRisk === 'none_observed' && ctx.evidentiaryRisk !== 'high') {
    return {
      adjustedDelta: out,
      factualStandingGainSuppressed: false,
      evidenceConversionRewarded: false,
      recommendedNudge: 'none',
      rationale: 'no amplification-risk signals on this move',
    };
  }

  // ── Evidence-conversion path: the move brings receipts / quote / scope.
  if (ctx.bringsEvidenceOrNarrowing) {
    // Doctrine: "reward the narrowing / sourcing / clarification, not the
    // original amplification." Standing gains stay in place, and we credit a
    // small explicit conversion bonus on broad standing (capped).
    out.broadStandingDelta = clamp(out.broadStandingDelta + 0.05, -1, 1);
    out.exploitRiskScore = clamp(out.exploitRiskScore, 0, 1);
    return {
      adjustedDelta: out,
      factualStandingGainSuppressed: false,
      evidenceConversionRewarded: true,
      recommendedNudge: 'allow_point_standing_after_evidence',
      rationale: 'move converted amplification energy into evidence / narrowing / quote anchor; conversion rewarded',
    };
  }

  // ── Suppression path: factual-standing GAIN is zeroed; engagement credit
  //    (pressure / recovery / concession integrity) is preserved.
  let suppressed = false;
  if (out.broadStandingDelta > 0) {
    out.broadStandingDelta = 0;
    suppressed = true;
  }
  if (out.narrowStandingDelta > 0) {
    out.narrowStandingDelta = 0;
    suppressed = true;
  }
  // Amplification-only agreement bumps the exploit-risk audit signal so the
  // grading-system auditor can spot point-farming attempts.
  if (ctx.highEngagementLowEvidence || ctx.appealToVirality || ctx.appealToCrowdSize) {
    out.exploitRiskScore = clamp(out.exploitRiskScore + 0.1, 0, 1);
  }

  let nudge: AntiAmplificationResult['recommendedNudge'] = 'allow_as_opinion_no_factual_credit';
  if (ctx.unknownSourceChain) nudge = 'ask_for_quote_anchor';
  else if (ctx.evidentiaryRisk === 'high' && ctx.platformSupportWarning) nudge = 'ask_for_primary_source';
  else if (ctx.amplificationRisk === 'high') nudge = 'ask_for_scope_narrowing';

  const rationalParts: string[] = [];
  if (ctx.platformSupportWarning) rationalParts.push('platformSupportWarning=true');
  if (ctx.highEngagementLowEvidence) rationalParts.push('high_engagement_low_evidence');
  if (ctx.appealToVirality) rationalParts.push('appeal_to_virality');
  if (ctx.appealToCrowdSize) rationalParts.push('appeal_to_crowd_size');
  if (ctx.unknownSourceChain) rationalParts.push('unknown_source_chain');
  if (rationalParts.length === 0) rationalParts.push(`evidentiaryRisk=${ctx.evidentiaryRisk}`);

  return {
    adjustedDelta: out,
    factualStandingGainSuppressed: suppressed,
    evidenceConversionRewarded: false,
    recommendedNudge: nudge,
    rationale: `factual-standing gain suppressed: ${rationalParts.join(', ')}; engagement credit preserved`,
  };
}

/**
 * Convenience: build an `AmplificationContext` directly from the fields an
 * Anthropic annotation already carries. Callers typically import this in
 * the grading glue code rather than re-deriving the shape.
 */
export function amplificationContextFromAnnotationFields(input: {
  platformSupportWarning: boolean;
  evidentiaryRisk: AmplificationContext['evidentiaryRisk'];
  amplificationRisk: AmplificationContext['amplificationRisk'];
  amplificationSignals: Record<string, boolean>;
  hasEvidence: boolean;
  hasTargetExcerpt: boolean;
  hasScopeNarrowing: boolean;
}): AmplificationContext {
  return {
    platformSupportWarning: Boolean(input.platformSupportWarning),
    evidentiaryRisk: input.evidentiaryRisk,
    amplificationRisk: input.amplificationRisk,
    appealToVirality: Boolean(input.amplificationSignals?.appeal_to_virality),
    appealToCrowdSize: Boolean(input.amplificationSignals?.appeal_to_crowd_size),
    highEngagementLowEvidence: Boolean(input.amplificationSignals?.high_engagement_low_evidence),
    unknownSourceChain: Boolean(input.amplificationSignals?.unknown_source_chain),
    bringsEvidenceOrNarrowing: Boolean(input.hasEvidence || input.hasTargetExcerpt || input.hasScopeNarrowing),
  };
}
