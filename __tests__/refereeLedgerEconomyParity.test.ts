/**
 * MCP-013 — Referee ledger: economy-parity proof.
 *
 * For the economy-owned categories (`narrowing`, `concession`,
 * `evidence_debt_resolution`), the ledger's adopted reading delta is
 * BIT-FOR-BIT equal to the corresponding field of `gradeRepair` /
 * `gradeChallenge` output for the SAME input. This proves the ledger does not
 * silently re-derive standing — `docs/point-standing-economy.md` worked
 * examples still hold.
 *
 * The economy call and the `reconcileMove` call run on IDENTICAL inputs;
 * numeric equality is asserted with `toBe`, never `toBeCloseTo`.
 */

import { reconcileMove } from '../src/features/refereeLedger';
import type { DeterministicMoveMetadata } from '../src/features/refereeLedger';
import {
  gradeChallenge,
  gradeRepair,
  IssueDebtLedger,
} from '../src/features/pointStanding';
import type {
  ChallengeGradingInput,
  GradingFlags,
  RepairGradingInput,
} from '../src/features/pointStanding';
import { computeAgreementDisagreementVector } from '../src/features/engagementIntelligence/agreementScalar';
import { classifyMixedAgreement, toGradingFlags } from '../src/features/engagementIntelligence/mixedAgreementTaxonomy';

function makeFlagsFor(rootText: string, replyText: string) {
  const v = computeAgreementDisagreementVector(rootText, replyText);
  const f = classifyMixedAgreement(v, rootText, replyText);
  return { vector: v, flags: toGradingFlags(f) as GradingFlags };
}

function challengeInput(rootText: string, replyText: string): ChallengeGradingInput {
  const { vector, flags } = makeFlagsFor(rootText, replyText);
  const parent = makeFlagsFor(rootText, rootText);
  return {
    pointId: 'point-bike',
    parentArgumentId: 'a1',
    parentFlags: parent.flags,
    parentVector: parent.vector,
    openDebts: [],
    replyArgumentId: 'b1',
    replyFlags: flags,
    replyVector: vector,
    replyText,
  };
}

function repairInput(args: {
  rootText: string;
  repairText: string;
  targetDebtId: string;
  openDebts: RepairGradingInput['openDebts'];
}): RepairGradingInput {
  const { vector, flags } = makeFlagsFor(args.rootText, args.repairText);
  const parent = makeFlagsFor(args.rootText, args.rootText);
  return {
    pointId: 'point-bike',
    parentArgumentId: 'a1',
    parentFlags: parent.flags,
    parentVector: parent.vector,
    openDebts: args.openDebts,
    repairArgumentId: 'a2',
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
const CHALLENGE =
  'I agree bike lanes improve safety overall and the value frame is right. But narrow the claim — replacing every downtown curb lane is too broad without corridor demand data.';
const REPAIR_NARROW =
  'Fair point. I mean high-demand corridors with crash data, not every downtown block.';
const REPAIR_BROAD_ABANDON = 'I concede. Whole claim is wrong, I withdraw the claim.';
const EVASION = 'Cars are bad anyway.';

/**
 * Run the economy directly and the ledger on IDENTICAL repair inputs. Returns
 * the economy's `gradeRepair` result delta and the ledger's `LedgerResult`.
 */
function runParity(repairText: string) {
  // Open a debt with the economy directly.
  const economyChallenge = gradeChallenge(challengeInput(ROOT, CHALLENGE));
  const debtId = economyChallenge.newDebt!.debtId;
  const openDebts = [economyChallenge.newDebt!];

  const economyRepairInput = repairInput({
    rootText: ROOT,
    repairText,
    targetDebtId: debtId,
    openDebts,
  });
  const economyResult = gradeRepair(economyRepairInput, {
    repairAuthorIsOriginalSpeaker: true,
    previousRepairsByAuthor: 0,
  });

  // Run the ledger on the SAME repair input. Re-open the debt in a fresh
  // ledger so the inputs are byte-identical (the economy input is shared).
  const ledger = new IssueDebtLedger();
  ledger.appendDebt(economyChallenge.newDebt!);
  const ledgerResult = reconcileMove({
    pointId: 'point-bike',
    moveArgumentId: 'a2',
    deterministicMetadata: baseMeta({ authorIsOriginalSpeaker: true }),
    moveRole: 'repair',
    economyInput: economyRepairInput,
    repairOptions: { repairAuthorIsOriginalSpeaker: true, previousRepairsByAuthor: 0 },
    debtLedger: ledger,
  });

  return { economyResult, ledgerResult };
}

// ── narrowing parity ──────────────────────────────────────────────

describe('refereeLedger economy parity — narrowing', () => {
  it('the narrowing reading delta is bit-for-bit equal to gradeRepair narrowStandingDelta', () => {
    const { economyResult, ledgerResult } = runParity(REPAIR_NARROW);
    const narrowing = ledgerResult.categoryReadings.find((r) => r.category === 'narrowing');
    expect(narrowing).toBeDefined();
    // toBe, NOT toBeCloseTo — bit-for-bit adoption.
    expect(narrowing!.delta).toBe(economyResult.delta!.narrowStandingDelta);
  });
});

// ── concession parity ─────────────────────────────────────────────

describe('refereeLedger economy parity — concession', () => {
  it('a narrow concession reading delta equals gradeRepair broadStandingDelta bit-for-bit', () => {
    const { economyResult, ledgerResult } = runParity(REPAIR_NARROW);
    const concession = ledgerResult.categoryReadings.find((r) => r.category === 'concession');
    expect(concession).toBeDefined();
    expect(concession!.delta).toBe(economyResult.delta!.broadStandingDelta);
  });

  it('a broad concession reading delta equals gradeRepair broadStandingDelta bit-for-bit', () => {
    const { economyResult, ledgerResult } = runParity(REPAIR_BROAD_ABANDON);
    const concession = ledgerResult.categoryReadings.find((r) => r.category === 'concession');
    expect(concession).toBeDefined();
    expect(concession!.delta).toBe(economyResult.delta!.broadStandingDelta);
  });

  it('an evasion repair: the concession reading adopts the economy penalty bit-for-bit', () => {
    const { economyResult, ledgerResult } = runParity(EVASION);
    const concession = ledgerResult.categoryReadings.find((r) => r.category === 'concession');
    expect(concession).toBeDefined();
    // The economy's negative broadStandingDelta is adopted verbatim — the
    // ledger adds NO extra penalty.
    expect(concession!.delta).toBe(economyResult.delta!.broadStandingDelta);
  });
});

// ── evidence_debt_resolution parity ───────────────────────────────

describe('refereeLedger economy parity — evidence_debt_resolution', () => {
  it('the evidence_debt_resolution reading delta equals gradeRepair responderRecoveryGain', () => {
    const { economyResult, ledgerResult } = runParity(REPAIR_NARROW);
    const debtResolution = ledgerResult.categoryReadings.find(
      (r) => r.category === 'evidence_debt_resolution',
    );
    expect(debtResolution).toBeDefined();
    expect(debtResolution!.delta).toBe(economyResult.delta!.responderRecoveryGain);
  });
});

// ── economyDelta forwarded verbatim ───────────────────────────────

describe('refereeLedger economy parity — economyDelta forwarded verbatim', () => {
  it('LedgerResult.economyDelta is structurally equal to the economy gradeRepair delta', () => {
    const { economyResult, ledgerResult } = runParity(REPAIR_NARROW);
    expect(ledgerResult.economyDelta).toEqual(economyResult.delta);
  });

  it('LedgerResult.exploitRiskScore equals the economy delta exploitRiskScore', () => {
    const { economyResult, ledgerResult } = runParity(REPAIR_NARROW);
    expect(ledgerResult.exploitRiskScore).toBe(economyResult.delta!.exploitRiskScore);
  });

  it('a challenge: LedgerResult.economyDelta is structurally equal to gradeChallenge delta', () => {
    const economyInput = challengeInput(ROOT, CHALLENGE);
    const economyResult = gradeChallenge(economyInput);
    const ledgerResult = reconcileMove({
      pointId: 'point-bike',
      moveArgumentId: 'b1',
      deterministicMetadata: baseMeta(),
      moveRole: 'challenge',
      economyInput,
      debtLedger: new IssueDebtLedger(),
    });
    expect(ledgerResult.economyDelta).toEqual(economyResult.delta);
    expect(ledgerResult.exploitRiskScore).toBe(economyResult.delta!.exploitRiskScore);
  });
});
