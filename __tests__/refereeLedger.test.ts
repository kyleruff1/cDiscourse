/**
 * MCP-013 — Referee ledger: worked examples.
 *
 * Pure-model, fixture-driven. No live call. Asserts the ledger's headline
 * behaviours from the design's test plan: a continuity tie, an evidence-debt
 * open, narrowing / concession credit adopted from the economy, the evasion
 * path with no extra penalty, a missing packet, and the defensive
 * `authoritative` guard.
 */

import {
  reconcileMove,
  reconcileCategory,
  ALL_REFEREE_POINT_CATEGORIES,
  ALL_REFEREE_FEEDBACK_CODES,
  HINT_STEP,
  CATEGORY_DELTA_MIN,
  CATEGORY_DELTA_MAX,
  clampCategoryDelta,
  continuityCreditContribution,
  evidencePressureContribution,
  branchHygieneContribution,
  synthesisReadinessContribution,
  sourceChainDebtContribution,
  unresolvedRedirectRiskContribution,
  hintMagnitudeForCategory,
  CATEGORY_AUTHORITY,
} from '../src/features/refereeLedger';
import type {
  DeterministicMoveMetadata,
  LedgerMoveInput,
} from '../src/features/refereeLedger';
import type { SemanticScoreHints } from '../src/features/semanticReferee';
import { IssueDebtLedger } from '../src/features/pointStanding';
import type {
  ChallengeGradingInput,
  GradingFlags,
  OpenIssueDebt,
  RepairGradingInput,
} from '../src/features/pointStanding';
import { computeAgreementDisagreementVector } from '../src/features/engagementIntelligence/agreementScalar';
import { classifyMixedAgreement, toGradingFlags } from '../src/features/engagementIntelligence/mixedAgreementTaxonomy';
import { VALID_FIXTURES } from '../src/features/semanticReferee';
import type { SemanticRefereePacket } from '../src/features/semanticReferee';

// ── Economy-input helpers (mirror __tests__/pointStandingEngine.test.ts) ──

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
  openDebts?: OpenIssueDebt[];
}): ChallengeGradingInput {
  const { vector, flags } = makeFlagsFor(args.rootText, args.replyText);
  const parent = makeFlagsFor(args.rootText, args.rootText);
  return {
    pointId: args.pointId ?? 'point-bike',
    parentArgumentId: 'a1',
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
  targetDebtId: string;
  openDebts: OpenIssueDebt[];
}): RepairGradingInput {
  const { vector, flags } = makeFlagsFor(args.rootText, args.repairText);
  const parent = makeFlagsFor(args.rootText, args.rootText);
  return {
    pointId: args.pointId ?? 'point-bike',
    parentArgumentId: 'a1',
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

function baseMeta(overrides: Partial<DeterministicMoveMetadata> = {}): DeterministicMoveMetadata {
  return {
    parentArgumentId: 'a1',
    selectedAction: 'reply',
    selectedMoveType: 'rebuttal',
    authorIsOriginalSpeaker: false,
    hasAttachedEvidence: false,
    hasQuoteAnchor: false,
    selectedClarify: false,
    lifecycleSynthesisReady: false,
    branchKind: 'mainline',
    roomModeId: 'casual',
    moveFitsRoomMode: true,
    respectsPacing: true,
    ...overrides,
  };
}

const ROOT = 'Bike lanes should replace curb parking downtown.';
const CHALLENGE_TEXT =
  'I agree bike lanes improve safety overall and the value frame is right. But narrow the claim — replacing every downtown curb lane is too broad without corridor demand data.';
const REPAIR_NARROW =
  'Fair point. I mean high-demand corridors with crash data, not every downtown block.';
const REPAIR_BROAD_ABANDON = 'I concede. Whole claim is wrong, I withdraw the claim.';
const EVASION = 'Cars are bad anyway.';

// ── 1. continuity tie ─────────────────────────────────────────────

describe('reconcileMove — continuity tie', () => {
  it('parentArgumentId set + validContinuity packet → positive continuity reading', () => {
    const input: LedgerMoveInput = {
      pointId: 'point-bike',
      moveArgumentId: 'b1',
      semanticPacket: VALID_FIXTURES.validContinuity,
      deterministicMetadata: baseMeta({ parentArgumentId: 'a1' }),
      moveRole: 'challenge',
      economyInput: challengeInput({ rootText: ROOT, replyText: CHALLENGE_TEXT }),
      debtLedger: new IssueDebtLedger(),
    };
    const result = reconcileMove(input);
    const continuity = result.categoryReadings.find((r) => r.category === 'continuity');
    expect(continuity).toBeDefined();
    expect(continuity!.outcome).toBe('agreement');
    expect(continuity!.confidence).toBe('high');
    expect(continuity!.feedbackCode).toBe('clean_parent_tie');
    expect(continuity!.delta).toBeGreaterThan(0);
    expect(result.userReviewRequired).toBe(true);
  });
});

// ── 2. evidence-debt open ─────────────────────────────────────────

describe('reconcileMove — evidence-debt open', () => {
  it('evidence-bearing claim without attached evidence → evidence_debt_open, delta 0, no penalty', () => {
    const ledger = new IssueDebtLedger();
    const input: LedgerMoveInput = {
      pointId: 'point-bike',
      moveArgumentId: 'b1',
      semanticPacket: VALID_FIXTURES.validEvidenceDebt,
      deterministicMetadata: baseMeta({ hasAttachedEvidence: false }),
      moveRole: 'challenge',
      economyInput: challengeInput({ rootText: ROOT, replyText: CHALLENGE_TEXT }),
      debtLedger: ledger,
    };
    const result = reconcileMove(input);
    const evidence = result.categoryReadings.find((r) => r.category === 'evidence_provided');
    expect(evidence).toBeDefined();
    // The L1 sign is 0 (no attached evidence) — no positive credit, no penalty.
    expect(evidence!.delta).toBe(0);
    expect(evidence!.delta).toBeGreaterThanOrEqual(0);
    // The economy opened a debt on the eligible challenge.
    expect(ledger.size()).toBeGreaterThan(0);
  });

  it('an amplification-only move suppresses factual standing but never penalizes', () => {
    const popularityPacket: SemanticRefereePacket = {
      ...VALID_FIXTURES.validEvidenceDebt,
      binaries: [
        {
          classifierId: 'provides_evidence',
          value: 1,
          confidence: 'high',
          reasonCode: 'evidence_attached_artifact',
        },
        {
          classifierId: 'uses_popularity_as_evidence',
          value: 1,
          confidence: 'high',
          reasonCode: 'evidence_popularity_claimed_as_support',
        },
      ],
    };
    const input: LedgerMoveInput = {
      pointId: 'point-bike',
      moveArgumentId: 'b1',
      semanticPacket: popularityPacket,
      deterministicMetadata: baseMeta({ hasAttachedEvidence: false }),
      moveRole: 'challenge',
      economyInput: challengeInput({ rootText: ROOT, replyText: CHALLENGE_TEXT }),
      debtLedger: new IssueDebtLedger(),
    };
    const result = reconcileMove(input);
    expect(result.antiAmplification).not.toBeNull();
    const evidence = result.categoryReadings.find((r) => r.category === 'evidence_provided');
    expect(evidence).toBeDefined();
    // Factual-standing gain suppressed → evidence_debt_open, never a penalty.
    if (result.antiAmplification!.factualStandingGainSuppressed) {
      expect(evidence!.delta).toBe(0);
      expect(evidence!.feedbackCode).toBe('evidence_debt_open');
    }
    expect(evidence!.delta).toBeGreaterThanOrEqual(0);
  });
});

// ── 3. narrowing credit ───────────────────────────────────────────

describe('reconcileMove — narrowing credit', () => {
  it('a narrow concession routed through gradeRepair adopts the economy broadStandingDelta', () => {
    const challenge = challengeInput({ rootText: ROOT, replyText: CHALLENGE_TEXT });
    const ledger = new IssueDebtLedger();
    // First, run the challenge so a debt exists.
    reconcileMove({
      pointId: 'point-bike',
      moveArgumentId: 'b1',
      deterministicMetadata: baseMeta(),
      moveRole: 'challenge',
      economyInput: challenge,
      debtLedger: ledger,
    });
    const open = ledger.openDebtsForPoint('point-bike');
    expect(open.length).toBe(1);

    const result = reconcileMove({
      pointId: 'point-bike',
      moveArgumentId: 'a2',
      deterministicMetadata: baseMeta({ authorIsOriginalSpeaker: true }),
      moveRole: 'repair',
      economyInput: repairInput({
        rootText: ROOT,
        repairText: REPAIR_NARROW,
        targetDebtId: open[0].debtId,
        openDebts: open,
      }),
      repairOptions: { repairAuthorIsOriginalSpeaker: true, previousRepairsByAuthor: 0 },
      debtLedger: ledger,
    });

    const concession = result.categoryReadings.find((r) => r.category === 'concession');
    expect(concession).toBeDefined();
    // The concession delta IS the economy's broadStandingDelta (+0.25).
    expect(concession!.delta).toBe(result.economyDelta!.broadStandingDelta);
    expect(concession!.delta).toBeCloseTo(0.25, 5);
    expect(concession!.feedbackCode).toBe('concession_noted');
  });
});

// ── 4. broad concession ───────────────────────────────────────────

describe('reconcileMove — broad concession', () => {
  it('an explicit broad-concession-abandons repair → concession reading, never "you lost"', () => {
    const challenge = challengeInput({ rootText: ROOT, replyText: CHALLENGE_TEXT });
    const ledger = new IssueDebtLedger();
    reconcileMove({
      pointId: 'point-bike',
      moveArgumentId: 'b1',
      deterministicMetadata: baseMeta(),
      moveRole: 'challenge',
      economyInput: challenge,
      debtLedger: ledger,
    });
    const open = ledger.openDebtsForPoint('point-bike');

    const result = reconcileMove({
      pointId: 'point-bike',
      moveArgumentId: 'a2',
      deterministicMetadata: baseMeta({ authorIsOriginalSpeaker: true }),
      moveRole: 'repair',
      economyInput: repairInput({
        rootText: ROOT,
        repairText: REPAIR_BROAD_ABANDON,
        targetDebtId: open[0].debtId,
        openDebts: open,
      }),
      repairOptions: { repairAuthorIsOriginalSpeaker: true, previousRepairsByAuthor: 0 },
      debtLedger: ledger,
    });
    const concession = result.categoryReadings.find((r) => r.category === 'concession');
    expect(concession).toBeDefined();
    // The reading delta equals the economy's broadStandingDelta verbatim.
    expect(concession!.delta).toBe(result.economyDelta!.broadStandingDelta);
  });
});

// ── 5. evasion path ───────────────────────────────────────────────

describe('reconcileMove — evasion path', () => {
  it('an evasive repair adopts the economy penalty verbatim — the ledger adds no extra penalty', () => {
    const challenge = challengeInput({ rootText: ROOT, replyText: CHALLENGE_TEXT });
    const ledger = new IssueDebtLedger();
    reconcileMove({
      pointId: 'point-bike',
      moveArgumentId: 'b1',
      deterministicMetadata: baseMeta(),
      moveRole: 'challenge',
      economyInput: challenge,
      debtLedger: ledger,
    });
    const open = ledger.openDebtsForPoint('point-bike');

    const result = reconcileMove({
      pointId: 'point-bike',
      moveArgumentId: 'a2',
      deterministicMetadata: baseMeta({ authorIsOriginalSpeaker: true }),
      moveRole: 'repair',
      economyInput: repairInput({
        rootText: ROOT,
        repairText: EVASION,
        targetDebtId: open[0].debtId,
        openDebts: open,
      }),
      repairOptions: { repairAuthorIsOriginalSpeaker: true, previousRepairsByAuthor: 0 },
      debtLedger: ledger,
    });
    // The economy delta carries the evasion penalty; the ledger forwards it.
    expect(result.economyDelta).not.toBeNull();
    expect(result.economyDelta!.unresolvedDebtPenalty).toBeCloseTo(0.25, 5);
    // The concession reading adopts the economy's negative broadStandingDelta.
    const concession = result.categoryReadings.find((r) => r.category === 'concession');
    if (concession) {
      expect(concession.delta).toBe(result.economyDelta!.broadStandingDelta);
    }
  });
});

// ── 6. missing packet ─────────────────────────────────────────────

describe('reconcileMove — missing semantic packet', () => {
  it('an omitted packet runs the ledger l1_only with no error', () => {
    const result = reconcileMove({
      pointId: 'point-bike',
      moveArgumentId: 'b1',
      deterministicMetadata: baseMeta({ parentArgumentId: 'a1' }),
      moveRole: 'challenge',
      economyInput: challengeInput({ rootText: ROOT, replyText: CHALLENGE_TEXT }),
      debtLedger: new IssueDebtLedger(),
    });
    // Every non-economy reading is l1_only when no packet is supplied.
    for (const reading of result.categoryReadings) {
      expect(['l1_only', 'agreement']).toContain(reading.outcome);
      expect(reading.outcome).not.toBe('conflict_routed');
      expect(reading.outcome).not.toBe('low_confidence_semantic');
    }
    expect(result.needsUserChoice).toBe(false);
  });
});

// ── 7. defensive authoritative guard ──────────────────────────────

describe('reconcileMove — defensive authoritative guard', () => {
  it('a packet with authoritative not false falls back to l1_only', () => {
    const malformed = {
      ...VALID_FIXTURES.validContinuity,
      authoritative: true,
    } as unknown as SemanticRefereePacket;
    const result = reconcileMove({
      pointId: 'point-bike',
      moveArgumentId: 'b1',
      semanticPacket: malformed,
      deterministicMetadata: baseMeta({ parentArgumentId: 'a1' }),
      moveRole: 'challenge',
      economyInput: challengeInput({ rootText: ROOT, replyText: CHALLENGE_TEXT }),
      debtLedger: new IssueDebtLedger(),
    });
    for (const reading of result.categoryReadings) {
      expect(reading.outcome).not.toBe('conflict_routed');
      expect(reading.outcome).not.toBe('low_confidence_semantic');
    }
  });
});

// ── coverage scans ────────────────────────────────────────────────

describe('referee ledger constant arrays', () => {
  it('exports exactly 14 play categories', () => {
    expect(ALL_REFEREE_POINT_CATEGORIES.length).toBe(14);
    expect(new Set(ALL_REFEREE_POINT_CATEGORIES).size).toBe(14);
  });

  it('exports exactly 22 feedback codes (MCP-003 20 + broad_point_set_down + synthesis_named)', () => {
    // MCP-013 design §8 prose says "21"; the design's own RefereeFeedbackCode
    // union and gameCopy block both list 22 (MCP-003's 20 + the two new
    // codes the deviation note adds). 20 + 2 = 22 — the contract is 22.
    expect(ALL_REFEREE_FEEDBACK_CODES.length).toBe(22);
    expect(new Set(ALL_REFEREE_FEEDBACK_CODES).size).toBe(22);
  });
});

// ── scoreHintMapping coverage ─────────────────────────────────────

function makeScoreHints(partial: Partial<SemanticScoreHints>): SemanticScoreHints {
  return {
    continuityCredit: 0,
    evidencePressure: 0,
    branchHygiene: 0,
    synthesisReadiness: 0,
    sourceChainDebt: 0,
    unresolvedRedirectRisk: 0,
    ...partial,
  };
}

describe('clampCategoryDelta', () => {
  it('clamps to the [-0.4, +0.4] bounds', () => {
    expect(clampCategoryDelta(0.9)).toBe(CATEGORY_DELTA_MAX);
    expect(clampCategoryDelta(-0.9)).toBe(CATEGORY_DELTA_MIN);
    expect(clampCategoryDelta(0.1)).toBe(0.1);
  });

  it('returns 0 for a non-finite input (NaN / Infinity)', () => {
    expect(clampCategoryDelta(NaN)).toBe(0);
    expect(clampCategoryDelta(Infinity)).toBe(0);
    expect(clampCategoryDelta(-Infinity)).toBe(0);
  });
});

describe('scoreHintMapping — every hint function returns magnitude >= 0', () => {
  it('continuityCreditContribution scales by HINT_STEP and never goes negative', () => {
    const c = continuityCreditContribution(makeScoreHints({ continuityCredit: 2 }));
    expect(c.magnitude).toBeCloseTo(HINT_STEP * 2, 10);
    expect(c.mode).toBe('credit');
    expect(c.contributesTo).toContain('continuity');
    expect(c.contributesTo).toContain('direct_response');
  });

  it('evidencePressureContribution opens a debt, never subtracts standing', () => {
    const c = evidencePressureContribution(makeScoreHints({ evidencePressure: 3 }));
    expect(c.magnitude).toBeGreaterThanOrEqual(0);
    expect(c.mode).toBe('opens_debt');
  });

  it('branchHygieneContribution is a credit', () => {
    const c = branchHygieneContribution(makeScoreHints({ branchHygiene: 1 }));
    expect(c.magnitude).toBeCloseTo(HINT_STEP, 10);
    expect(c.mode).toBe('credit');
  });

  it('synthesisReadinessContribution feeds synthesis', () => {
    const c = synthesisReadinessContribution(makeScoreHints({ synthesisReadiness: 3 }));
    expect(c.contributesTo).toEqual(['synthesis']);
    expect(c.magnitude).toBeGreaterThan(0);
  });

  it('sourceChainDebtContribution opens a debt', () => {
    const c = sourceChainDebtContribution(makeScoreHints({ sourceChainDebt: 2 }));
    expect(c.mode).toBe('opens_debt');
  });

  it('unresolvedRedirectRiskContribution routes, never penalizes', () => {
    const c = unresolvedRedirectRiskContribution(makeScoreHints({ unresolvedRedirectRisk: 3 }));
    expect(c.mode).toBe('routes');
    expect(c.magnitude).toBeGreaterThanOrEqual(0);
  });

  it('a negative or non-finite raw hint coerces to magnitude 0', () => {
    const c = continuityCreditContribution(makeScoreHints({ continuityCredit: -5 }));
    expect(c.magnitude).toBe(0);
  });

  it('hintMagnitudeForCategory returns 0 when hints are absent', () => {
    expect(hintMagnitudeForCategory('continuity', undefined)).toBe(0);
  });

  it('hintMagnitudeForCategory sums every contribution touching the category', () => {
    const hints = makeScoreHints({ branchHygiene: 2, unresolvedRedirectRisk: 1 });
    // branch_hygiene is fed by both branchHygiene and unresolvedRedirectRisk.
    const total = hintMagnitudeForCategory('branch_hygiene', hints);
    expect(total).toBeCloseTo(HINT_STEP * 2 + HINT_STEP * 1, 10);
  });
});

describe('CATEGORY_AUTHORITY', () => {
  it('the three economy-owned categories carry the economy authority', () => {
    expect(CATEGORY_AUTHORITY.narrowing).toBe('economy');
    expect(CATEGORY_AUTHORITY.concession).toBe('economy');
    expect(CATEGORY_AUTHORITY.evidence_debt_resolution).toBe('economy');
  });

  it('continuity / direct_response / person_intent_drift route on conflict (neither)', () => {
    expect(CATEGORY_AUTHORITY.continuity).toBe('neither');
    expect(CATEGORY_AUTHORITY.direct_response).toBe('neither');
    expect(CATEGORY_AUTHORITY.person_intent_drift).toBe('neither');
  });
});

describe('reconcileCategory — economy-owned categories adopt the economy delta', () => {
  it('a low-confidence binary does not override an economy-owned delta', () => {
    const reading = reconcileCategory({
      category: 'concession',
      l1Signal: { present: false, sign: 0 },
      l2Signal: { present: true, sign: 1, confidence: 'low' },
      hintMagnitude: 0.3,
      economyDelta: 0.25,
    });
    // The economy delta is adopted verbatim; the low-confidence binary is
    // only a confirmation hint — outcome stays l1_only, delta intact.
    expect(reading.outcome).toBe('l1_only');
    expect(reading.delta).toBe(0.25);
  });

  it('a high-confidence confirming binary marks the economy reading agreement', () => {
    const reading = reconcileCategory({
      category: 'narrowing',
      l1Signal: { present: false, sign: 0 },
      l2Signal: { present: true, sign: 1, confidence: 'high' },
      hintMagnitude: 0.3,
      economyDelta: -0.15,
    });
    expect(reading.outcome).toBe('agreement');
    // Adopted bit-for-bit — the hint magnitude does NOT inflate it.
    expect(reading.delta).toBe(-0.15);
  });
});
