/**
 * Stage 6.1.5.2 — Anti-amplification scoring rule tests.
 *
 * Doctrine: amplification earns engagement credit, never factual-standing
 * credit until evidence arrives. Narrowing / sourcing / clarification of a
 * viral claim earns standing — the original amplification does not.
 */
import {
  applyAntiAmplification,
  amplificationContextFromAnnotationFields,
} from '../src/features/pointStanding/antiAmplification';
import type { AmplificationContext, PointStandingDelta } from '../src/features/pointStanding/types';

function baseDelta(over: Partial<PointStandingDelta> = {}): PointStandingDelta {
  return {
    pointId: 'p1',
    causedByArgumentId: 'a1',
    broadStandingDelta: 0,
    narrowStandingDelta: 0,
    challengerPressureGain: 0.2,
    responderRecoveryGain: 0,
    concessionIntegrityGain: 0,
    impliedConcessionPenalty: 0,
    unresolvedDebtPenalty: 0,
    exploitRiskScore: 0,
    ...over,
  };
}

function ctx(over: Partial<AmplificationContext> = {}): AmplificationContext {
  return {
    platformSupportWarning: false,
    evidentiaryRisk: 'low',
    amplificationRisk: 'none_observed',
    appealToVirality: false,
    appealToCrowdSize: false,
    highEngagementLowEvidence: false,
    unknownSourceChain: false,
    bringsEvidenceOrNarrowing: false,
    ...over,
  };
}

describe('applyAntiAmplification — no concerns → pass through', () => {
  it('preserves the delta exactly when there are no amplification signals', () => {
    const d = baseDelta({ broadStandingDelta: 0.2, narrowStandingDelta: 0.1 });
    const r = applyAntiAmplification(d, ctx());
    expect(r.adjustedDelta.broadStandingDelta).toBe(0.2);
    expect(r.adjustedDelta.narrowStandingDelta).toBe(0.1);
    expect(r.factualStandingGainSuppressed).toBe(false);
    expect(r.evidenceConversionRewarded).toBe(false);
    expect(r.recommendedNudge).toBe('none');
  });
});

describe('applyAntiAmplification — high-amplification + low-evidence → suppress factual gain', () => {
  it('zeroes positive broad + narrow standing when platformSupportWarning is true', () => {
    const d = baseDelta({ broadStandingDelta: 0.25, narrowStandingDelta: 0.15, challengerPressureGain: 0.3 });
    const r = applyAntiAmplification(d, ctx({
      platformSupportWarning: true,
      evidentiaryRisk: 'high',
      amplificationRisk: 'high',
      highEngagementLowEvidence: true,
      appealToVirality: true,
    }));
    expect(r.adjustedDelta.broadStandingDelta).toBe(0);
    expect(r.adjustedDelta.narrowStandingDelta).toBe(0);
    // Engagement credit IS preserved.
    expect(r.adjustedDelta.challengerPressureGain).toBe(0.3);
    expect(r.factualStandingGainSuppressed).toBe(true);
    expect(r.recommendedNudge).toBe('ask_for_primary_source');
  });

  it('preserves negative standing deltas (penalties / declines)', () => {
    const d = baseDelta({ broadStandingDelta: -0.1, narrowStandingDelta: -0.2 });
    const r = applyAntiAmplification(d, ctx({
      platformSupportWarning: true,
      amplificationRisk: 'high',
      highEngagementLowEvidence: true,
    }));
    expect(r.adjustedDelta.broadStandingDelta).toBe(-0.1);
    expect(r.adjustedDelta.narrowStandingDelta).toBe(-0.2);
    // No factual GAIN to suppress — flag should be false.
    expect(r.factualStandingGainSuppressed).toBe(false);
  });

  it('bumps exploitRiskScore on appeal-to-virality / crowd', () => {
    const d = baseDelta({ exploitRiskScore: 0 });
    const r = applyAntiAmplification(d, ctx({
      platformSupportWarning: true,
      amplificationRisk: 'high',
      appealToVirality: true,
    }));
    expect(r.adjustedDelta.exploitRiskScore).toBeCloseTo(0.1, 3);
  });

  it('recommends ask_for_quote_anchor on unknown_source_chain', () => {
    const d = baseDelta({ broadStandingDelta: 0.2 });
    const r = applyAntiAmplification(d, ctx({
      platformSupportWarning: true,
      amplificationRisk: 'medium',
      unknownSourceChain: true,
      evidentiaryRisk: 'high',
    }));
    expect(r.recommendedNudge).toBe('ask_for_quote_anchor');
  });
});

describe('applyAntiAmplification — evidence-conversion path → reward', () => {
  it('preserves positive standing AND credits a small conversion bonus when bringsEvidenceOrNarrowing', () => {
    const d = baseDelta({ broadStandingDelta: 0.2, narrowStandingDelta: 0.1 });
    const r = applyAntiAmplification(d, ctx({
      platformSupportWarning: true,
      amplificationRisk: 'high',
      appealToVirality: true,
      bringsEvidenceOrNarrowing: true,
    }));
    expect(r.adjustedDelta.broadStandingDelta).toBeCloseTo(0.25, 3);
    expect(r.adjustedDelta.narrowStandingDelta).toBe(0.1);
    expect(r.evidenceConversionRewarded).toBe(true);
    expect(r.factualStandingGainSuppressed).toBe(false);
    expect(r.recommendedNudge).toBe('allow_point_standing_after_evidence');
  });
});

describe('amplificationContextFromAnnotationFields', () => {
  it('maps annotation fields to context booleans', () => {
    const c = amplificationContextFromAnnotationFields({
      platformSupportWarning: true,
      evidentiaryRisk: 'high',
      amplificationRisk: 'medium',
      amplificationSignals: {
        appeal_to_virality: true,
        appeal_to_crowd_size: false,
        high_engagement_low_evidence: true,
        unknown_source_chain: false,
      },
      hasEvidence: false,
      hasTargetExcerpt: false,
      hasScopeNarrowing: true,
    });
    expect(c.platformSupportWarning).toBe(true);
    expect(c.evidentiaryRisk).toBe('high');
    expect(c.amplificationRisk).toBe('medium');
    expect(c.appealToVirality).toBe(true);
    expect(c.appealToCrowdSize).toBe(false);
    expect(c.highEngagementLowEvidence).toBe(true);
    expect(c.unknownSourceChain).toBe(false);
    expect(c.bringsEvidenceOrNarrowing).toBe(true);
  });
});

describe('doctrine — worked example', () => {
  it('viral reply that agrees without evidence: agreement counts, factual support does not', () => {
    // Move was graded as "broadly accepting" a viral root claim. The raw
    // delta lifted broad standing by 0.2. With amplification context, the
    // factual lift is suppressed; pressure / engagement credit is intact.
    const d = baseDelta({
      broadStandingDelta: 0.2,
      narrowStandingDelta: 0,
      challengerPressureGain: 0.25, // engagement credit
    });
    const r = applyAntiAmplification(d, ctx({
      platformSupportWarning: true,
      amplificationRisk: 'high',
      highEngagementLowEvidence: true,
      appealToVirality: true,
    }));
    expect(r.adjustedDelta.broadStandingDelta).toBe(0); // factual standing did NOT move
    expect(r.adjustedDelta.challengerPressureGain).toBe(0.25); // engagement DID
    expect(r.factualStandingGainSuppressed).toBe(true);
  });

  it('reply that narrows the viral claim with a primary source: standing lifts + conversion bonus', () => {
    const d = baseDelta({
      broadStandingDelta: 0.1,
      narrowStandingDelta: 0.2, // earned by narrowing
      challengerPressureGain: 0.2,
    });
    const r = applyAntiAmplification(d, ctx({
      platformSupportWarning: true,
      amplificationRisk: 'medium',
      bringsEvidenceOrNarrowing: true,
    }));
    expect(r.adjustedDelta.broadStandingDelta).toBeCloseTo(0.15, 3); // +0.05 conversion bonus
    expect(r.adjustedDelta.narrowStandingDelta).toBe(0.2);
    expect(r.evidenceConversionRewarded).toBe(true);
  });
});
