/**
 * MCP-015 — Semantic override trigger model tests.
 *
 * Covers `evaluateSemanticOverridePrompt` + `routeSuggestionToLane`. All
 * mock-driven — no live call exists anywhere in the MCP family in v1. Mock
 * packets come from MCP-011's `VALID_FIXTURES` / `mockFixtureProvider` or are
 * constructed inline; `LedgerResult` fixtures are constructed inline against
 * MCP-013's `types.ts`.
 */

import {
  evaluateSemanticOverridePrompt,
  routeSuggestionToLane,
} from '../src/features/semanticOverride';
import { emptyRepeatedOverrideSignal } from '../src/features/semanticOverride';
import type {
  RepeatedOverrideSignal,
  SemanticOverrideActorRole,
} from '../src/features/semanticOverride';
import { VALID_FIXTURES } from '../src/features/semanticReferee/semanticRefereeFixtures';
import {
  ALL_ROUTE_SUGGESTIONS,
  PACKET_VERSION,
} from '../src/features/semanticReferee/semanticRefereeTypes';
import type {
  SemanticBinarySample,
  SemanticRefereePacket,
  SemanticRouteSuggestion,
} from '../src/features/semanticReferee/semanticRefereeTypes';
import type {
  CategoryReading,
  LedgerResult,
  RefereePointCategory,
  ReconciliationOutcome,
} from '../src/features/refereeLedger/types';

// ── Inline builders ───────────────────────────────────────────────

function packetWithBinaries(
  binaries: SemanticBinarySample[],
  routeSuggestion: SemanticRouteSuggestion = 'mainline',
): SemanticRefereePacket {
  return {
    packetVersion: PACKET_VERSION,
    promptVersion: 'mcp-semantic-referee-prompt-v0',
    modelVersion: 'mock-model-0',
    provider: 'mock',
    authoritative: false,
    inputHash: 'inputhash-trigger',
    contentHash: 'contenthash-trigger',
    roomId: 'room-trigger',
    binaries,
    routeSuggestion,
    frictionSuggestion: 'none',
    scoreHints: {
      continuityCredit: 0,
      evidencePressure: 0,
      branchHygiene: 0,
      synthesisReadiness: 0,
      sourceChainDebt: 0,
      unresolvedRedirectRisk: 0,
    },
  };
}

function reading(
  category: RefereePointCategory,
  outcome: ReconciliationOutcome,
): CategoryReading {
  return {
    category,
    delta: 0,
    outcome,
    confidence: 'medium',
    requiresUserChoice: outcome === 'conflict_routed',
    feedbackCode: 'you_decide_the_lane',
    factualStandingAxis: false,
    creditAxis: 'hygiene',
  };
}

function ledgerResult(
  readings: CategoryReading[],
  needsUserChoice: boolean,
): LedgerResult {
  return {
    pointId: 'point-trigger',
    moveArgumentId: 'move-trigger',
    categoryReadings: readings,
    economyDelta: null,
    antiAmplification: null,
    ineligibilityReasons: [],
    needsUserChoice,
    exploitRiskScore: 0,
    creditStates: [],
    userReviewRequired: true,
  };
}

const PARTICIPANT: SemanticOverrideActorRole = 'participant_affirmative';
const SIGNAL: RepeatedOverrideSignal = emptyRepeatedOverrideSignal('room-trigger');

// ── Low-confidence path ───────────────────────────────────────────

describe('evaluateSemanticOverridePrompt — low-confidence path', () => {
  it('a routing-relevant binary at low confidence offers the override', () => {
    const packet = packetWithBinaries([
      {
        classifierId: 'responds_to_parent',
        value: 0,
        confidence: 'low',
        reasonCode: 'parent_continuity_redirects_topic',
      },
    ]);
    const prompt = evaluateSemanticOverridePrompt({
      packet,
      viewerActorRole: PARTICIPANT,
      repeatedSignal: SIGNAL,
    });
    expect(prompt.shouldOffer).toBe(true);
    expect(prompt.triggerReason).toBe('low_confidence');
    expect(prompt.contestedClassifierId).toBe('responds_to_parent');
    expect(prompt.promptCopyCode).toBe('semantic_override_prompt_low_conf');
  });

  it('contestedClassifierId is the FIRST low-confidence routing binary in order', () => {
    const packet = packetWithBinaries([
      {
        classifierId: 'suggests_side_branch',
        value: 1,
        confidence: 'low',
        reasonCode: 'branch_routing_same_topic_chime_in',
      },
      {
        classifierId: 'responds_to_parent',
        value: 0,
        confidence: 'low',
        reasonCode: 'parent_continuity_redirects_topic',
      },
    ]);
    const prompt = evaluateSemanticOverridePrompt({
      packet,
      viewerActorRole: PARTICIPANT,
      repeatedSignal: SIGNAL,
    });
    expect(prompt.contestedClassifierId).toBe('suggests_side_branch');
  });

  it('a low-confidence NON-routing binary (evidence) does not trigger', () => {
    const packet = packetWithBinaries([
      {
        classifierId: 'provides_evidence',
        value: 1,
        confidence: 'low',
        reasonCode: 'evidence_artifact_attached',
      },
    ]);
    const prompt = evaluateSemanticOverridePrompt({
      packet,
      viewerActorRole: PARTICIPANT,
      repeatedSignal: SIGNAL,
    });
    expect(prompt.shouldOffer).toBe(false);
    expect(prompt.triggerReason).toBeNull();
    expect(prompt.promptCopyCode).toBe('');
  });

  it("MCP-011's validLowConfidence fixture has no routing binary — does not trigger", () => {
    // validLowConfidence carries `contains_playable_hot_take` at low conf —
    // not a routing classifier.
    const prompt = evaluateSemanticOverridePrompt({
      packet: VALID_FIXTURES.validLowConfidence,
      viewerActorRole: PARTICIPANT,
      repeatedSignal: SIGNAL,
    });
    expect(prompt.shouldOffer).toBe(false);
  });

  it('offersAnswersParentToggle is true for responds_to_parent, false for suggests_side_branch', () => {
    const rtp = evaluateSemanticOverridePrompt({
      packet: packetWithBinaries([
        {
          classifierId: 'responds_to_parent',
          value: 0,
          confidence: 'low',
          reasonCode: 'parent_continuity_redirects_topic',
        },
      ]),
      viewerActorRole: PARTICIPANT,
      repeatedSignal: SIGNAL,
    });
    expect(rtp.offersAnswersParentToggle).toBe(true);

    const branch = evaluateSemanticOverridePrompt({
      packet: packetWithBinaries([
        {
          classifierId: 'suggests_side_branch',
          value: 1,
          confidence: 'low',
          reasonCode: 'branch_routing_same_topic_chime_in',
        },
      ]),
      viewerActorRole: PARTICIPANT,
      repeatedSignal: SIGNAL,
    });
    expect(branch.offersAnswersParentToggle).toBe(false);
  });
});

// ── L1/L2 conflict path ───────────────────────────────────────────

describe('evaluateSemanticOverridePrompt — L1/L2 conflict path', () => {
  it('a conflict_routed continuity reading with needsUserChoice offers the override', () => {
    const prompt = evaluateSemanticOverridePrompt({
      ledgerResult: ledgerResult([reading('continuity', 'conflict_routed')], true),
      viewerActorRole: PARTICIPANT,
      repeatedSignal: SIGNAL,
    });
    expect(prompt.shouldOffer).toBe(true);
    expect(prompt.triggerReason).toBe('l1_l2_conflict');
    expect(prompt.contestedClassifierId).toBe('responds_to_parent');
    expect(prompt.offersAnswersParentToggle).toBe(true);
    expect(prompt.promptCopyCode).toBe('semantic_override_prompt_conflict');
  });

  it('a conflict_routed direct_response reading also triggers', () => {
    const prompt = evaluateSemanticOverridePrompt({
      ledgerResult: ledgerResult(
        [reading('direct_response', 'conflict_routed')],
        true,
      ),
      viewerActorRole: PARTICIPANT,
      repeatedSignal: SIGNAL,
    });
    expect(prompt.shouldOffer).toBe(true);
    expect(prompt.triggerReason).toBe('l1_l2_conflict');
  });

  it('a conflict_routed reading on a NON-routing category does not trigger via step 3', () => {
    const prompt = evaluateSemanticOverridePrompt({
      ledgerResult: ledgerResult(
        [reading('evidence_relevance', 'conflict_routed')],
        true,
      ),
      viewerActorRole: PARTICIPANT,
      repeatedSignal: SIGNAL,
    });
    expect(prompt.shouldOffer).toBe(false);
  });

  it('needsUserChoice: false suppresses the conflict trigger even with a routing conflict', () => {
    const prompt = evaluateSemanticOverridePrompt({
      ledgerResult: ledgerResult(
        [reading('continuity', 'conflict_routed')],
        false,
      ),
      viewerActorRole: PARTICIPANT,
      repeatedSignal: SIGNAL,
    });
    expect(prompt.shouldOffer).toBe(false);
  });

  it('the L1/L2 conflict takes priority over a low-confidence binary', () => {
    const packet = packetWithBinaries([
      {
        classifierId: 'responds_to_parent',
        value: 0,
        confidence: 'low',
        reasonCode: 'parent_continuity_redirects_topic',
      },
    ]);
    const prompt = evaluateSemanticOverridePrompt({
      packet,
      ledgerResult: ledgerResult([reading('continuity', 'conflict_routed')], true),
      viewerActorRole: PARTICIPANT,
      repeatedSignal: SIGNAL,
    });
    expect(prompt.triggerReason).toBe('l1_l2_conflict');
  });
});

// ── Confident path + no-input gate ────────────────────────────────

describe('evaluateSemanticOverridePrompt — confident path', () => {
  it('a confident packet with all medium/high routing binaries does not trigger', () => {
    const prompt = evaluateSemanticOverridePrompt({
      packet: VALID_FIXTURES.validContinuity,
      ledgerResult: ledgerResult([reading('continuity', 'agreement')], false),
      viewerActorRole: PARTICIPANT,
      repeatedSignal: SIGNAL,
    });
    expect(prompt.shouldOffer).toBe(false);
    expect(prompt.suggestedLane).toBe('mainline');
  });

  it('both packet and ledgerResult undefined hits the no-input gate', () => {
    const prompt = evaluateSemanticOverridePrompt({
      viewerActorRole: PARTICIPANT,
      repeatedSignal: SIGNAL,
    });
    expect(prompt.shouldOffer).toBe(false);
    expect(prompt.suggestedLane).toBe('mainline');
    expect(prompt.promptCopyCode).toBe('');
  });
});

// ── Actor gate ────────────────────────────────────────────────────

describe('evaluateSemanticOverridePrompt — actor gate (observers excluded)', () => {
  it('an observer never gets shouldOffer:true even with a triggering packet', () => {
    const packet = packetWithBinaries([
      {
        classifierId: 'responds_to_parent',
        value: 0,
        confidence: 'low',
        reasonCode: 'parent_continuity_redirects_topic',
      },
    ]);
    const prompt = evaluateSemanticOverridePrompt({
      packet,
      viewerActorRole: 'observer',
      repeatedSignal: SIGNAL,
    });
    expect(prompt.shouldOffer).toBe(false);
    expect(prompt.triggerReason).toBeNull();
  });

  it('an observer never gets shouldOffer:true even with a routing L1/L2 conflict', () => {
    const prompt = evaluateSemanticOverridePrompt({
      ledgerResult: ledgerResult([reading('continuity', 'conflict_routed')], true),
      viewerActorRole: 'observer',
      repeatedSignal: SIGNAL,
    });
    expect(prompt.shouldOffer).toBe(false);
  });

  it('participant_affirmative, participant_negative, and admin are all offered', () => {
    const packet = packetWithBinaries([
      {
        classifierId: 'responds_to_parent',
        value: 0,
        confidence: 'low',
        reasonCode: 'parent_continuity_redirects_topic',
      },
    ]);
    for (const role of [
      'participant_affirmative',
      'participant_negative',
      'admin',
    ] as SemanticOverrideActorRole[]) {
      const prompt = evaluateSemanticOverridePrompt({
        packet,
        viewerActorRole: role,
        repeatedSignal: SIGNAL,
      });
      expect(prompt.shouldOffer).toBe(true);
    }
  });
});

// ── softenCopy ────────────────────────────────────────────────────

describe('evaluateSemanticOverridePrompt — softenCopy copy code', () => {
  it('softenCopy:true picks the soft prompt code regardless of trigger reason', () => {
    const softSignal: RepeatedOverrideSignal = {
      roomId: 'room-trigger',
      overrideCountThisRoom: 4,
      softenCopy: true,
    };
    const lowConf = evaluateSemanticOverridePrompt({
      packet: packetWithBinaries([
        {
          classifierId: 'responds_to_parent',
          value: 0,
          confidence: 'low',
          reasonCode: 'parent_continuity_redirects_topic',
        },
      ]),
      viewerActorRole: PARTICIPANT,
      repeatedSignal: softSignal,
    });
    expect(lowConf.promptCopyCode).toBe('semantic_override_prompt_soft');

    const conflict = evaluateSemanticOverridePrompt({
      ledgerResult: ledgerResult([reading('continuity', 'conflict_routed')], true),
      viewerActorRole: PARTICIPANT,
      repeatedSignal: softSignal,
    });
    expect(conflict.promptCopyCode).toBe('semantic_override_prompt_soft');
  });
});

// ── routeSuggestionToLane ─────────────────────────────────────────

describe('routeSuggestionToLane — maps all seven route suggestions', () => {
  const expected: Record<SemanticRouteSuggestion, string> = {
    mainline: 'mainline',
    no_route_change: 'mainline',
    synthesis_lane: 'mainline',
    cards_detail: 'mainline',
    vertical_chime_branch: 'branch',
    diagonal_tangent: 'tangent',
    outer_realm: 'tangent',
  };

  it('every SemanticRouteSuggestion maps to the documented lane', () => {
    for (const suggestion of ALL_ROUTE_SUGGESTIONS) {
      expect(routeSuggestionToLane(suggestion)).toBe(expected[suggestion]);
    }
  });

  it('the suggestedLane on the prompt reflects routeSuggestionToLane', () => {
    const prompt = evaluateSemanticOverridePrompt({
      packet: packetWithBinaries([], 'vertical_chime_branch'),
      viewerActorRole: PARTICIPANT,
      repeatedSignal: SIGNAL,
    });
    expect(prompt.suggestedLane).toBe('branch');
  });
});
