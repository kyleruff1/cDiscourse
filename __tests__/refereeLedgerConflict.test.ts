/**
 * MCP-013 — Referee ledger: layer-1 / layer-2 conflict + low-confidence gate.
 *
 * A conflict on a `neither`-authority category routes (`conflict_routed`,
 * `delta: 0`, `confidence: 'low'`, `requiresUserChoice: true`) — NEVER a
 * penalty. A low-confidence binary forces `low_confidence_semantic`,
 * `delta: 0`. An `l1`-authority conflict resolves `conflict_l1_dominant`,
 * uses the L1 value, drops confidence to medium, no penalty.
 */

import {
  reconcileMove,
  reconcileCategory,
} from '../src/features/refereeLedger';
import type {
  DeterministicMoveMetadata,
  LedgerMoveInput,
} from '../src/features/refereeLedger';
import { IssueDebtLedger } from '../src/features/pointStanding';
import type {
  ChallengeGradingInput,
  GradingFlags,
} from '../src/features/pointStanding';
import { computeAgreementDisagreementVector } from '../src/features/engagementIntelligence/agreementScalar';
import { classifyMixedAgreement, toGradingFlags } from '../src/features/engagementIntelligence/mixedAgreementTaxonomy';
import { VALID_FIXTURES } from '../src/features/semanticReferee';
import type {
  SemanticBinarySample,
  SemanticRefereePacket,
} from '../src/features/semanticReferee';

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
  'I agree bike lanes improve safety overall. But narrow the claim — replacing every downtown curb lane is too broad without corridor demand data.';

/** A packet with one binary, fully controllable. */
function packetWithBinary(binary: SemanticBinarySample): SemanticRefereePacket {
  return {
    ...VALID_FIXTURES.validMinimal,
    binaries: [binary],
  };
}

// ── conflict on a neither-authority category (continuity) ─────────

describe('reconcileMove — conflict on a neither-authority category', () => {
  it('L1 says responds, L2 says no (high confidence) → conflict_routed, delta 0, no penalty', () => {
    // L1: parentArgumentId set → sign 1. L2: responds_to_parent value 0 at
    // HIGH confidence → sign 0. They disagree → route.
    const packet = packetWithBinary({
      classifierId: 'responds_to_parent',
      value: 0,
      confidence: 'high',
      reasonCode: 'parent_continuity_redirects_topic',
    });
    const input: LedgerMoveInput = {
      pointId: 'point-bike',
      moveArgumentId: 'b1',
      semanticPacket: packet,
      deterministicMetadata: baseMeta({ parentArgumentId: 'a1' }),
      moveRole: 'challenge',
      economyInput: challengeInput(ROOT, CHALLENGE),
      debtLedger: new IssueDebtLedger(),
    };
    const result = reconcileMove(input);
    const continuity = result.categoryReadings.find((r) => r.category === 'continuity');
    expect(continuity).toBeDefined();
    expect(continuity!.outcome).toBe('conflict_routed');
    expect(continuity!.delta).toBe(0);
    expect(continuity!.confidence).toBe('low');
    expect(continuity!.requiresUserChoice).toBe(true);
    expect(continuity!.feedbackCode).toBe('you_decide_the_lane');
    // Never a negative delta — a conflict routes, it never penalizes.
    expect(continuity!.delta).toBeGreaterThanOrEqual(0);
    expect(result.needsUserChoice).toBe(true);
  });
});

// ── low-confidence semantic binary ────────────────────────────────

describe('reconcileMove — low-confidence semantic binary', () => {
  it('a low-confidence binary on a category with no L1 → low_confidence_semantic, delta 0', () => {
    // evidence_relevance is l2-authority and has NO L1 derivation. A
    // low-confidence binary there cannot move standing.
    const packet = packetWithBinary({
      classifierId: 'evidence_supports_claim',
      value: 1,
      confidence: 'low',
      reasonCode: 'evidence_relevance_weak_link',
    });
    const reading = reconcileCategory({
      category: 'evidence_relevance',
      l1Signal: { present: false, sign: 0 },
      l2Signal: { present: true, sign: 1, confidence: 'low' },
      hintMagnitude: 0.16,
    });
    expect(reading.outcome).toBe('low_confidence_semantic');
    expect(reading.delta).toBe(0);
    expect(reading.confidence).toBe('low');
    // It uses the soft feedback code — a gentle prompt, not a credit.
    expect(reading.feedbackCode).toBe('evidence_needs_connecting');
    expect(packet.binaries[0].confidence).toBe('low');
  });

  it('a low-confidence binary on a category WITH an L1 fact falls to l1_only', () => {
    const reading = reconcileCategory({
      category: 'continuity',
      l1Signal: { present: true, sign: 1 },
      l2Signal: { present: true, sign: 1, confidence: 'low' },
      hintMagnitude: 0.16,
    });
    // The low-confidence binary is "no usable signal" — L1 stands.
    expect(reading.outcome).toBe('l1_only');
    expect(reading.delta).toBeGreaterThan(0);
  });

  it('a low-confidence binary never triggers conflict_routed', () => {
    // L1 sign 1, L2 sign 0 at LOW confidence. Even though the signs differ,
    // a low-confidence binary cannot create a conflict — L1 stands.
    const reading = reconcileCategory({
      category: 'continuity',
      l1Signal: { present: true, sign: 1 },
      l2Signal: { present: true, sign: 0, confidence: 'low' },
      hintMagnitude: 0.08,
    });
    expect(reading.outcome).not.toBe('conflict_routed');
    expect(reading.outcome).toBe('l1_only');
  });
});

// ── conflict on an l1-authority category ──────────────────────────

describe('reconcileMove — conflict on an l1-authority category', () => {
  it('L1 says evidence attached, L2 says no (high confidence) → conflict_l1_dominant', () => {
    // evidence_provided is l1-authority. L1: hasAttachedEvidence true → sign 1.
    // L2: provides_evidence value 0 at high confidence → sign 0. Conflict.
    const reading = reconcileCategory({
      category: 'evidence_provided',
      l1Signal: { present: true, sign: 1 },
      l2Signal: { present: true, sign: 0, confidence: 'high' },
      hintMagnitude: 0.16,
    });
    expect(reading.outcome).toBe('conflict_l1_dominant');
    // Uses the L1 value — a positive credit, confidence dropped to medium.
    expect(reading.delta).toBeGreaterThan(0);
    expect(reading.confidence).toBe('medium');
    expect(reading.requiresUserChoice).toBe(false);
  });

  it('respecting_pacing is l1-authority — an L1 fact stands with no semantic signal', () => {
    const reading = reconcileCategory({
      category: 'respecting_pacing',
      l1Signal: { present: true, sign: 1 },
      l2Signal: null,
      hintMagnitude: 0,
    });
    expect(reading.outcome).toBe('l1_only');
    expect(reading.confidence).toBe('high');
  });
});
