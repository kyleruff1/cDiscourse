/**
 * Stage 6.1.4 — Point-standing engine tests.
 *
 * Doctrine being asserted: "Concession is a scoring repair, not a scoring
 * defeat." A narrow, explicit concession that preserves the broad point
 * earns recovery credit AND lifts broad standing. An evasion ("Cars are
 * bad anyway.") accrues an unresolved-debt penalty even though it bails
 * out via the tangent route.
 *
 * No network. No Supabase. No xAI.
 */
import {
  gradeChallenge,
  gradeRepair,
  IssueDebtLedger,
  MIXED_CLASS_WEIGHTS,
  CONCESSION_EFFECT_WEIGHTS,
  classifyConcessionEffect,
  isScoreEligible,
  buildChallengeEligibility,
  buildRepairEligibility,
} from '../src/features/pointStanding';
import { computeAgreementDisagreementVector } from '../src/features/engagementIntelligence/agreementScalar';
import { classifyMixedAgreement, toGradingFlags } from '../src/features/engagementIntelligence/mixedAgreementTaxonomy';
import type {
  ChallengeGradingInput,
  GradingFlags,
  OpenIssueDebt,
  RepairGradingInput,
} from '../src/features/pointStanding';

// ── Helpers ────────────────────────────────────────────────────

function makeFlagsFor(rootText: string, replyText: string) {
  const v = computeAgreementDisagreementVector(rootText, replyText);
  const f = classifyMixedAgreement(v, rootText, replyText);
  return { vector: v, flags: toGradingFlags(f) as GradingFlags };
}

function challengeInput(args: {
  pointId?: string;
  rootText: string;
  replyText: string;
  replyArgumentId?: string;
  parentArgumentId?: string;
  openDebts?: OpenIssueDebt[];
}): ChallengeGradingInput {
  const { vector, flags } = makeFlagsFor(args.rootText, args.replyText);
  const parent = makeFlagsFor(args.rootText, args.rootText);
  return {
    pointId: args.pointId ?? 'point-bike',
    parentArgumentId: args.parentArgumentId ?? 'a1',
    parentFlags: parent.flags,
    parentVector: parent.vector,
    openDebts: args.openDebts ?? [],
    replyArgumentId: args.replyArgumentId ?? 'b1',
    replyFlags: flags,
    replyVector: vector,
    replyText: args.replyText,
  };
}

function repairInput(args: {
  pointId?: string;
  rootText: string;
  repairText: string;
  repairArgumentId?: string;
  parentArgumentId?: string;
  targetDebtId: string;
  openDebts: OpenIssueDebt[];
}): RepairGradingInput {
  const { vector, flags } = makeFlagsFor(args.rootText, args.repairText);
  const parent = makeFlagsFor(args.rootText, args.rootText);
  return {
    pointId: args.pointId ?? 'point-bike',
    parentArgumentId: args.parentArgumentId ?? 'a1',
    parentFlags: parent.flags,
    parentVector: parent.vector,
    openDebts: args.openDebts,
    repairArgumentId: args.repairArgumentId ?? 'a2',
    repairFlags: flags,
    repairVector: vector,
    repairText: args.repairText,
    targetDebtId: args.targetDebtId,
  };
}

// ── Weight table sanity ───────────────────────────────────────

describe('MIXED_CLASS_WEIGHTS', () => {
  it('broad_accept_narrow_decline is the most playable class', () => {
    const cls = MIXED_CLASS_WEIGHTS;
    expect(cls.broad_accept_narrow_decline.playableTensionScore).toBe(0.9);
    expect(cls.broad_accept_narrow_decline.createsIssueDebt).toBe(true);
    expect(cls.pure_accept.createsIssueDebt).toBe(false);
    expect(cls.tangent_or_joke.createsIssueDebt).toBe(false);
    expect(cls.unclear_mixed.createsIssueDebt).toBe(false);
  });

  it('every class has a preferredUiNudge', () => {
    for (const v of Object.values(MIXED_CLASS_WEIGHTS)) {
      expect(typeof v.preferredUiNudge).toBe('string');
      expect(v.preferredUiNudge.length).toBeGreaterThan(0);
    }
  });
});

describe('CONCESSION_EFFECT_WEIGHTS', () => {
  it('explicit narrow concession preserves broad point pays the highest responder recovery', () => {
    const w = CONCESSION_EFFECT_WEIGHTS;
    expect(w.explicit_narrow_concession_preserves_broad_point.responderRecoveryGain).toBe(0.35);
    expect(w.explicit_broad_concession_abandons_point.responderRecoveryGain).toBe(0.05);
    expect(w.performative_concession_no_repair.responderRecoveryGain).toBe(0);
    expect(w.no_concession.responderRecoveryGain).toBe(0);
  });

  it('no_concession + performative pay the unresolved-debt penalty', () => {
    expect(CONCESSION_EFFECT_WEIGHTS.no_concession.unresolvedDebtPenalty).toBe(0.25);
    expect(CONCESSION_EFFECT_WEIGHTS.performative_concession_no_repair.unresolvedDebtPenalty).toBe(0.2);
  });

  it('explicit broad abandon gives the highest integrity credit', () => {
    expect(CONCESSION_EFFECT_WEIGHTS.explicit_broad_concession_abandons_point.concessionIntegrityGain).toBe(0.3);
  });
});

// ── Eligibility ───────────────────────────────────────────────

describe('isScoreEligible', () => {
  it('refuses tangents', () => {
    const elig = buildChallengeEligibility(challengeInput({
      rootText: 'Bike lanes should replace curb parking downtown.',
      replyText: 'Speaking of, off topic, parking is bad lately.',
    }));
    expect(elig.isTangent).toBe(true);
    expect(isScoreEligible(elig)).toBe(false);
  });

  it('refuses moves with no axis identified', () => {
    const elig = buildChallengeEligibility(challengeInput({
      rootText: 'Bike lanes should replace curb parking downtown.',
      replyText: 'Maybe.',
    }));
    expect(elig.isAxisIdentified).toBe(false);
    expect(isScoreEligible(elig)).toBe(false);
  });

  it('refuses near-duplicate pressure on the same axis + similar intensity', () => {
    const openDebt: OpenIssueDebt = {
      debtId: 'd1', pointId: 'point-bike', createdByArgumentId: 'b1',
      axis: 'scope', intensity: 0.9,
      explicitConcessionAwarded: false, impliedConcessionRecorded: false,
      recoveryCreditAwarded: false, closed: false,
    };
    const elig = buildChallengeEligibility(challengeInput({
      rootText: 'Bike lanes should replace curb parking downtown.',
      replyText: 'I agree the safety conclusion holds, but narrow the claim — this is too broad without corridor demand data.',
      openDebts: [openDebt],
    }));
    expect(elig.isNearDuplicate).toBe(true);
    expect(isScoreEligible(elig)).toBe(false);
  });

  it('allows specific, axis-identified, non-tangent challenges', () => {
    const elig = buildChallengeEligibility(challengeInput({
      rootText: 'Bike lanes should replace curb parking downtown.',
      replyText: 'I agree the overall conclusion on safety holds, but narrow the claim — too broad without corridor demand data.',
    }));
    expect(elig.isAxisIdentified).toBe(true);
    expect(elig.isTangent).toBe(false);
    expect(isScoreEligible(elig)).toBe(true);
  });
});

describe('buildRepairEligibility', () => {
  it('refuses self-concession loops', () => {
    const openDebt: OpenIssueDebt = {
      debtId: 'd1', pointId: 'point-bike', createdByArgumentId: 'b1',
      axis: 'scope', intensity: 0.9,
      explicitConcessionAwarded: false, impliedConcessionRecorded: false,
      recoveryCreditAwarded: false, closed: false,
    };
    const elig = buildRepairEligibility(
      repairInput({
        rootText: 'Bike lanes should replace curb parking downtown.',
        repairText: 'I grant the point again. Fair point.',
        openDebts: [openDebt],
        targetDebtId: 'd1',
      }),
      { repairAuthorIsOriginalSpeaker: true, previousRepairsByAuthor: 2 },
    );
    expect(elig.isSelfConcessionLoop).toBe(true);
  });
});

// ── Concession detection ─────────────────────────────────────

describe('classifyConcessionEffect', () => {
  function effectFor(repairText: string, root = 'A claim.') {
    const { flags } = makeFlagsFor(root, repairText);
    return classifyConcessionEffect({ repairText, repairFlags: flags as GradingFlags, repairAuthorIsOriginalSpeaker: true });
  }

  it('explicit + narrowing → explicit_narrow_concession_preserves_broad_point', () => {
    const e = effectFor('Fair point. I mean high-demand corridors with crash data, not every downtown block.');
    expect(e).toBe('explicit_narrow_concession_preserves_broad_point');
  });

  it('explicit + abandonment → explicit_broad_concession_abandons_point', () => {
    const e = effectFor('I concede. Whole claim is wrong, I withdraw the claim.');
    expect(e).toBe('explicit_broad_concession_abandons_point');
  });

  it('explicit alone (no narrowing or abandonment) → performative', () => {
    const e = effectFor('Fair point.');
    expect(e).toBe('performative_concession_no_repair');
  });

  it('no shift at all → no_concession', () => {
    const e = effectFor('Cars are bad anyway.');
    expect(e).toBe('no_concession');
  });

  it('implied narrowing without a marker → implied_narrow_concession_preserves_broad_point', () => {
    const e = effectFor('I mean the high-demand corridors, only the busiest ones.');
    expect(e).toBe('implied_narrow_concession_preserves_broad_point');
  });
});

// ── Worked example 1: cooperative bike-lane repair ────────────

describe('worked example — cooperative bike-lane repair', () => {
  const root = 'Bike lanes should replace curb parking downtown.';
  const challenge = 'I agree bike lanes improve safety overall and the value frame is right. But narrow the claim — replacing every downtown curb lane is too broad without corridor demand data.';
  const repair = 'Fair point. I mean high-demand corridors with crash data, not every downtown block.';

  it('challenge → broad_accept_narrow_decline + creates a debt', () => {
    const res = gradeChallenge(challengeInput({ rootText: root, replyText: challenge, replyArgumentId: 'b1' }));
    expect(res.eligible).toBe(true);
    expect(res.questionSet.whatIssueDebtWasCreated).not.toBe('none');
    expect(res.questionSet.whatIssueDebtWasCreated).not.toBeNull();
    expect(res.questionSet.shouldThisBecomeAPlayablePrompt).toBe(true);
    expect(res.delta).not.toBeNull();
    expect(res.delta!.challengerPressureGain).toBeGreaterThan(0);
    expect(res.newDebt).not.toBeNull();
  });

  it('repair after challenge → explicit_narrow_concession_preserves_broad_point + broad standing lifts', () => {
    const challengeRes = gradeChallenge(challengeInput({ rootText: root, replyText: challenge, replyArgumentId: 'b1' }));
    const ledger = new IssueDebtLedger();
    if (challengeRes.newDebt) ledger.appendDebt(challengeRes.newDebt);
    const open = ledger.openDebtsForPoint('point-bike');
    expect(open.length).toBe(1);

    const repairRes = gradeRepair(
      repairInput({ rootText: root, repairText: repair, repairArgumentId: 'a2', targetDebtId: open[0].debtId, openDebts: open }),
      { repairAuthorIsOriginalSpeaker: true, previousRepairsByAuthor: 0 },
    );
    expect(repairRes.eligible).toBe(true);
    expect(repairRes.effect).toBe('explicit_narrow_concession_preserves_broad_point');
    const d = repairRes.delta!;
    expect(d.responderRecoveryGain).toBeCloseTo(0.35, 5);
    expect(d.concessionIntegrityGain).toBeCloseTo(0.25, 5);
    expect(d.challengerPressureGain).toBeCloseTo(0.20, 5);
    // The doctrine: broad point recovers, narrow defect loses weight.
    expect(d.broadStandingDelta).toBeCloseTo(0.25, 5);
    expect(d.narrowStandingDelta).toBeCloseTo(-0.15, 5);
    expect(d.unresolvedDebtPenalty).toBe(0);
    expect(repairRes.updatedDebt!.closed).toBe(true);
    expect(repairRes.questionSet.canTheOriginalOpinionRecoverWeight).toBe(true);
  });
});

// ── Worked example 2: evasion ────────────────────────────────

describe('worked example — evasion ("Cars are bad anyway")', () => {
  const root = 'Bike lanes should replace curb parking downtown.';
  const challenge = 'I agree the overall conclusion on safety holds. But narrow the claim — replacing every downtown curb lane is too broad without corridor demand data.';
  const evasion = 'Cars are bad anyway.';

  it('evasion → no_concession + unresolved-debt penalty + narrow standing falls', () => {
    const challengeRes = gradeChallenge(challengeInput({ rootText: root, replyText: challenge, replyArgumentId: 'b1' }));
    const ledger = new IssueDebtLedger();
    if (challengeRes.newDebt) ledger.appendDebt(challengeRes.newDebt);
    const open = ledger.openDebtsForPoint('point-bike');
    const repairRes = gradeRepair(
      repairInput({ rootText: root, repairText: evasion, repairArgumentId: 'a2', targetDebtId: open[0].debtId, openDebts: open }),
      { repairAuthorIsOriginalSpeaker: true, previousRepairsByAuthor: 0 },
    );
    expect(repairRes.effect).toBe('no_concession');
    const d = repairRes.delta!;
    // Evasion: no responder recovery, no integrity, but pressure goes to challenger.
    expect(d.responderRecoveryGain).toBe(0);
    expect(d.concessionIntegrityGain).toBe(0);
    expect(d.challengerPressureGain).toBeCloseTo(0, 5);
    expect(d.unresolvedDebtPenalty).toBeCloseTo(0.25, 5);
    // Standing falls on the narrow defect and the broad point loses a little too.
    expect(d.broadStandingDelta).toBeLessThanOrEqual(0);
    expect(d.narrowStandingDelta).toBeLessThanOrEqual(-0.25);
    // Debt remains open — evasion does not close it.
    expect(repairRes.updatedDebt!.closed).toBe(false);
  });
});

// ── Anti-exploit: credit-once-per-debt + drilled performative ────

describe('anti-exploit gates', () => {
  it('a second explicit concession on the same closed debt does not double-credit', () => {
    const root = 'Bike lanes should replace curb parking downtown.';
    const challenge = 'I agree on safety. But narrow the claim — replacing every downtown curb is too broad.';
    const repair = 'Fair point. I mean high-demand corridors with crash data, not every downtown block.';

    const challengeRes = gradeChallenge(challengeInput({ rootText: root, replyText: challenge }));
    const ledger = new IssueDebtLedger();
    if (challengeRes.newDebt) ledger.appendDebt(challengeRes.newDebt);

    const first = gradeRepair(
      repairInput({ rootText: root, repairText: repair, openDebts: ledger.openDebtsForPoint('point-bike'), targetDebtId: ledger.snapshot()[0].debtId }),
      { repairAuthorIsOriginalSpeaker: true, previousRepairsByAuthor: 0 },
    );
    if (first.updatedDebt) ledger.updateDebt(first.updatedDebt.debtId, () => first.updatedDebt!);

    const second = gradeRepair(
      repairInput({ rootText: root, repairText: repair, openDebts: ledger.snapshot(), targetDebtId: ledger.snapshot()[0].debtId, repairArgumentId: 'a3' }),
      { repairAuthorIsOriginalSpeaker: true, previousRepairsByAuthor: 1 },
    );
    // Debt is now closed; the second repair receives no additional credit.
    // (Either eligible=false because debt is closed, or eligible=true but
    // credit gates suppress recovery/integrity/pressure.)
    if (second.delta) {
      expect(second.delta.responderRecoveryGain).toBe(0);
      expect(second.delta.concessionIntegrityGain).toBe(0);
      expect(second.delta.challengerPressureGain).toBe(0);
    }
  });

  it('performative concession ("Fair point.") receives 0 recovery and pays the audit signal', () => {
    const root = 'Bike lanes should replace curb parking downtown.';
    const challenge = 'I agree on safety. But narrow the claim — replacing every downtown curb is too broad.';
    const challengeRes = gradeChallenge(challengeInput({ rootText: root, replyText: challenge }));
    const ledger = new IssueDebtLedger();
    if (challengeRes.newDebt) ledger.appendDebt(challengeRes.newDebt);
    const open = ledger.openDebtsForPoint('point-bike');
    const repairRes = gradeRepair(
      repairInput({ rootText: root, repairText: 'Fair point.', openDebts: open, targetDebtId: open[0].debtId }),
      { repairAuthorIsOriginalSpeaker: true, previousRepairsByAuthor: 0 },
    );
    expect(repairRes.effect).toBe('performative_concession_no_repair');
    expect(repairRes.delta!.responderRecoveryGain).toBe(0);
    expect(repairRes.delta!.unresolvedDebtPenalty).toBeCloseTo(0.2, 5);
    expect(repairRes.delta!.exploitRiskScore).toBeGreaterThan(0);
  });
});

// ── Doctrine: concession is a repair, not a defeat ───────────

describe('doctrine — concession is a scoring REPAIR, not a defeat', () => {
  it('a narrow explicit concession that preserves the broad point gives both sides non-zero credit', () => {
    const root = 'Bike lanes should replace curb parking downtown.';
    const challenge = 'I agree on safety. But narrow the claim — replacing every downtown curb is too broad without corridor demand data.';
    const repair = 'Fair point. I mean high-demand corridors with crash data, only the busiest ones.';
    const challengeRes = gradeChallenge(challengeInput({ rootText: root, replyText: challenge }));
    const ledger = new IssueDebtLedger();
    if (challengeRes.newDebt) ledger.appendDebt(challengeRes.newDebt);
    const open = ledger.openDebtsForPoint('point-bike');
    const repairRes = gradeRepair(
      repairInput({ rootText: root, repairText: repair, openDebts: open, targetDebtId: open[0].debtId }),
      { repairAuthorIsOriginalSpeaker: true, previousRepairsByAuthor: 0 },
    );
    const d = repairRes.delta!;
    expect(d.responderRecoveryGain).toBeGreaterThan(0);
    expect(d.challengerPressureGain).toBeGreaterThan(0);
    expect(d.broadStandingDelta).toBeGreaterThan(0);
    expect(d.narrowStandingDelta).toBeLessThan(0);
  });

  it('the original opinion can recover weight after a narrow explicit concession', () => {
    const root = 'Bike lanes should replace curb parking downtown.';
    const challenge = 'I agree on safety. But narrow the claim — replacing every downtown curb is too broad.';
    const repair = 'Fair point. I mean high-demand corridors with crash data, not every downtown block.';
    const challengeRes = gradeChallenge(challengeInput({ rootText: root, replyText: challenge }));
    const ledger = new IssueDebtLedger();
    if (challengeRes.newDebt) ledger.appendDebt(challengeRes.newDebt);
    const open = ledger.openDebtsForPoint('point-bike');
    const repairRes = gradeRepair(
      repairInput({ rootText: root, repairText: repair, openDebts: open, targetDebtId: open[0].debtId }),
      { repairAuthorIsOriginalSpeaker: true, previousRepairsByAuthor: 0 },
    );
    expect(repairRes.questionSet.canTheOriginalOpinionRecoverWeight).toBe(true);
  });
});

// ── Safety: no moderation / verdict tokens in any output ─────

describe('safety', () => {
  it('engine outputs never contain moderation or verdict tokens', () => {
    const root = 'Bike lanes should replace curb parking downtown.';
    const reply = 'I agree on safety. But narrow the claim — replacing every downtown curb is too broad.';
    const challengeRes = gradeChallenge(challengeInput({ rootText: root, replyText: reply }));
    const json = JSON.stringify(challengeRes).toLowerCase();
    for (const t of ['liar', 'dishonest', 'bad faith', 'manipulative', 'manipulation', 'extremist', 'propagandist', 'winner', 'loser', 'verdict']) {
      expect(json).not.toContain(t);
    }
    expect(challengeRes.userReviewRequired).toBe(true);
  });
});

// ── Ledger semantics ─────────────────────────────────────────

describe('IssueDebtLedger', () => {
  it('snapshot is a copy — mutating it does not mutate the ledger', () => {
    const ledger = new IssueDebtLedger();
    const debt: OpenIssueDebt = {
      debtId: 'x', pointId: 'p', createdByArgumentId: 'b',
      axis: 'scope', intensity: 0.9,
      explicitConcessionAwarded: false, impliedConcessionRecorded: false,
      recoveryCreditAwarded: false, closed: false,
    };
    ledger.appendDebt(debt);
    const snap = ledger.snapshot();
    snap[0].closed = true;
    expect(ledger.snapshot()[0].closed).toBe(false);
  });
});
