/**
 * MCP-CAT-001 — Reason-code safety whitelist verification.
 *
 * The packet validator at `src/features/semanticReferee/semanticRefereeValidator.ts`
 * accepts a `reasonCode` only when it matches a known family prefix from
 * `REASON_CODE_FAMILIES` and contains no verdict / person-label token. MCP-CAT-001
 * extended the family prefix list with `settlement` (covering the two new
 * settlement classifier ids' reason codes), in addition to the existing
 * eight families.
 *
 * This test asserts:
 *   1. The validator accepts the existing eight family prefixes (no regression).
 *   2. The validator accepts the new `settlement` family prefix.
 *   3. The validator rejects a reason code that contains a verdict token
 *      (`*_winner_*`, `*_true_*`, etc.) even when prefixed by a known family.
 *   4. The validator rejects a reason code that contains a person-label token
 *      even when prefixed by a known family.
 *   5. Adding a `settlement_` reason code does not bypass the verdict scan
 *      (a `settlement_winner_takes_all` reason code still fails).
 *
 * Pure-TS — imports the Node validator only.
 */
import { parseSemanticPacket } from '../src/features/semanticReferee/semanticRefereeValidator';
import {
  PACKET_VERSION,
  REASON_CODE_FAMILIES,
} from '../src/features/semanticReferee/semanticRefereeTypes';
import type {
  SemanticBinarySample,
  SemanticClassifierId,
} from '../src/features/semanticReferee/semanticRefereeTypes';

function buildPacket(reasonCode: string, classifierId: SemanticClassifierId): unknown {
  return {
    packetVersion: PACKET_VERSION,
    promptVersion: 'mcp-semantic-referee-prompt-v0',
    modelVersion: 'mock-model-0',
    provider: 'mock',
    authoritative: false,
    inputHash: 'h',
    contentHash: 'h',
    roomId: 'r',
    binaries: [
      {
        classifierId,
        value: 1,
        confidence: 'high',
        reasonCode,
      },
    ] as readonly SemanticBinarySample[],
    routeSuggestion: 'mainline',
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

describe('MCP-CAT-001 — reason-code family whitelist', () => {
  it('REASON_CODE_FAMILIES includes the new `settlement` family', () => {
    expect(REASON_CODE_FAMILIES).toContain('settlement');
  });

  it('REASON_CODE_FAMILIES preserves the existing eight family prefixes (no regression)', () => {
    for (const family of [
      'parent_continuity',
      'branch_routing',
      'evidence',
      'source_chain',
      'movement',
      'mode_fit',
      'friction',
      'banner',
    ]) {
      expect(REASON_CODE_FAMILIES).toContain(family);
    }
  });

  it.each([
    ['parent_continuity', 'parent_continuity_engaged'],
    ['branch_routing', 'branch_routing_same_topic'],
    ['evidence', 'evidence_applicability_disputed'],
    ['source_chain', 'source_chain_corroboration_supplied'],
    ['movement', 'movement_concession_with_caveat'],
    ['mode_fit', 'mode_fit_register_aligned'],
    ['friction', 'friction_pacing_pause'],
    ['banner', 'banner_routed'],
    // MCP-CAT-001 — the new family
    ['settlement', 'settlement_proposed'],
    ['settlement', 'settlement_terms_accepted'],
  ])(
    'accepts a reason code under the %s family — %s',
    (_family: string, reasonCode: string) => {
      const packet = buildPacket(reasonCode, 'responds_to_parent');
      const result = parseSemanticPacket(packet);
      expect(result.ok).toBe(true);
    },
  );
});

describe('MCP-CAT-001 — reason-code whitelist still rejects verdict tokens', () => {
  it.each([
    'evidence_winner_detected',
    'movement_correct_concession',
    'parent_continuity_wrong_anchor',
    'evidence_false_premise',
    'evidence_true_anchor',
    'movement_proven_concession',
    'movement_defeated_axis',
    // The new family does not bypass the verdict scan.
    'settlement_winner_takes_all',
    'settlement_true_resolution',
    'settlement_proven_terms',
  ])('rejects %s as containing a verdict / outcome token', (reasonCode: string) => {
    const packet = buildPacket(reasonCode, 'responds_to_parent');
    const result = parseSemanticPacket(packet);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejections.some((r) => r.code === 'verdict_token')).toBe(true);
    }
  });
});

describe('MCP-CAT-001 — reason-code whitelist still rejects person-label tokens', () => {
  it.each([
    'parent_continuity_liar_response',
    'evidence_dishonest_source',
    'movement_manipulative_concession',
    'friction_extremist_label',
    'settlement_troll_terms',
    'settlement_propagandist_offer',
  ])('rejects %s as containing a person-label token', (reasonCode: string) => {
    const packet = buildPacket(reasonCode, 'responds_to_parent');
    const result = parseSemanticPacket(packet);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejections.some((r) => r.code === 'person_label')).toBe(true);
    }
  });
});

describe('MCP-CAT-001 — reason-code whitelist rejects unknown family prefixes', () => {
  it.each([
    'verdict_evidence_supplied',
    'truth_score_high',
    'judgement_evaluation',
    'final_ruling_made',
    'unprefixed_reason_code',
  ])('rejects %s as missing a known family prefix', (reasonCode: string) => {
    const packet = buildPacket(reasonCode, 'responds_to_parent');
    const result = parseSemanticPacket(packet);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejections.some((r) => r.code === 'unknown_reason_code')).toBe(
        true,
      );
    }
  });
});

describe('MCP-CAT-001 — settlement family covers the two new settlement ids cleanly', () => {
  it('accepts settlement_terms_proposed on proposes_settlement_terms', () => {
    const packet = buildPacket(
      'settlement_terms_proposed',
      'proposes_settlement_terms',
    );
    const result = parseSemanticPacket(packet);
    expect(result.ok).toBe(true);
  });

  it('accepts settlement_terms_accepted on accepts_settlement_terms', () => {
    const packet = buildPacket(
      'settlement_terms_accepted',
      'accepts_settlement_terms',
    );
    const result = parseSemanticPacket(packet);
    expect(result.ok).toBe(true);
  });
});
