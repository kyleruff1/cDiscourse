/**
 * MCP-011 — Semantic referee validator tests.
 *
 * Covers `parseSemanticPacket` accept / reject coverage, the credit-eligibility
 * predicates, and rejection-message safety (a caught secret is never echoed).
 */

import {
  parseSemanticPacket,
  isCreditEligible,
  creditEligibleBinaries,
  looksLikeInternalCode,
} from '../src/features/semanticReferee/semanticRefereeValidator';
import {
  VALID_FIXTURES,
  MALFORMED_FIXTURES,
} from '../src/features/semanticReferee/semanticRefereeFixtures';
import { PACKET_VERSION } from '../src/features/semanticReferee/semanticRefereeTypes';
import type {
  SemanticBinarySample,
  SemanticRejectionCode,
} from '../src/features/semanticReferee/semanticRefereeTypes';

/** A fresh known-good packet object the targeted tests mutate. */
function goodPacket(): Record<string, unknown> {
  return {
    packetVersion: PACKET_VERSION,
    promptVersion: 'mcp-semantic-referee-prompt-v0',
    modelVersion: 'mock-model-0',
    provider: 'mock',
    authoritative: false,
    inputHash: 'inputhash-good',
    contentHash: 'contenthash-good',
    roomId: 'room-good',
    binaries: [
      {
        classifierId: 'responds_to_parent',
        value: 1,
        confidence: 'high',
        reasonCode: 'parent_continuity_direct_claim_response',
      },
    ],
    routeSuggestion: 'no_route_change',
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

function codesOf(result: ReturnType<typeof parseSemanticPacket>): SemanticRejectionCode[] {
  if (result.ok) return [];
  return result.rejections.map((r) => r.code);
}

describe('MCP-011 parseSemanticPacket — valid fixtures', () => {
  for (const [name, packet] of Object.entries(VALID_FIXTURES)) {
    it(`accepts the valid fixture "${name}"`, () => {
      const result = parseSemanticPacket(packet);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.packet.authoritative).toBe(false);
        expect(result.packet.packetVersion).toBe(PACKET_VERSION);
      }
    });
  }

  it('returns a frozen packet on success', () => {
    const result = parseSemanticPacket(goodPacket());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.isFrozen(result.packet)).toBe(true);
      expect(Object.isFrozen(result.packet.binaries)).toBe(true);
      expect(Object.isFrozen(result.packet.scoreHints)).toBe(true);
    }
  });

  it('accepts a packet supplied as a JSON string', () => {
    const result = parseSemanticPacket(JSON.stringify(goodPacket()));
    expect(result.ok).toBe(true);
  });
});

describe('MCP-011 parseSemanticPacket — malformed fixtures', () => {
  for (const fixture of MALFORMED_FIXTURES) {
    it(`rejects "${fixture.id}" with ${fixture.expectedRejectionCodes.join(', ')}`, () => {
      const result = parseSemanticPacket(fixture.raw);
      expect(result.ok).toBe(false);
      const codes = codesOf(result);
      for (const expected of fixture.expectedRejectionCodes) {
        expect(codes).toContain(expected);
      }
    });
  }
});

describe('MCP-011 parseSemanticPacket — targeted rejection assertions', () => {
  it('non-JSON string → non_json', () => {
    expect(codesOf(parseSemanticPacket('not json {{'))).toContain('non_json');
  });

  it('top-level array → top_level_array', () => {
    expect(codesOf(parseSemanticPacket([goodPacket()]))).toContain('top_level_array');
  });

  it('number / boolean / null → not_an_object', () => {
    expect(codesOf(parseSemanticPacket(7))).toContain('not_an_object');
    expect(codesOf(parseSemanticPacket(true))).toContain('not_an_object');
    expect(codesOf(parseSemanticPacket(null))).toContain('not_an_object');
  });

  it('authoritative: true → authoritative_not_false', () => {
    const result = parseSemanticPacket({ ...goodPacket(), authoritative: true });
    expect(codesOf(result)).toContain('authoritative_not_false');
  });

  it('missing authoritative → authoritative is required (missing_field)', () => {
    const obj = goodPacket();
    delete obj.authoritative;
    expect(codesOf(parseSemanticPacket(obj))).toContain('missing_field');
  });

  it('a block field → block_field', () => {
    expect(codesOf(parseSemanticPacket({ ...goodPacket(), block: true }))).toContain(
      'block_field',
    );
  });

  it('a reasoning field → chain_of_thought_field', () => {
    expect(
      codesOf(parseSemanticPacket({ ...goodPacket(), reasoning: 'a paragraph' })),
    ).toContain('chain_of_thought_field');
  });

  it('a prompt field → raw_prompt_field', () => {
    expect(
      codesOf(parseSemanticPacket({ ...goodPacket(), prompt: 'echoed prompt' })),
    ).toContain('raw_prompt_field');
  });

  it('a bannerText field → copy_field_smuggled', () => {
    expect(
      codesOf(parseSemanticPacket({ ...goodPacket(), bannerText: 'banner copy' })),
    ).toContain('copy_field_smuggled');
  });

  it('an unrecognized field → unknown_field', () => {
    expect(
      codesOf(parseSemanticPacket({ ...goodPacket(), randomKey: 'x' })),
    ).toContain('unknown_field');
  });

  it('an unknown classifierId → unknown_classifier_id', () => {
    const obj = goodPacket();
    obj.binaries = [
      {
        classifierId: 'invented_classifier',
        value: 1,
        confidence: 'high',
        reasonCode: 'parent_continuity_direct_claim_response',
      },
    ];
    expect(codesOf(parseSemanticPacket(obj))).toContain('unknown_classifier_id');
  });

  it('non-binary values 2 / 0.5 / "1" / true → non_binary_value', () => {
    for (const badValue of [2, 0.5, '1', true]) {
      const obj = goodPacket();
      obj.binaries = [
        {
          classifierId: 'responds_to_parent',
          value: badValue,
          confidence: 'high',
          reasonCode: 'parent_continuity_direct_claim_response',
        },
      ];
      expect(codesOf(parseSemanticPacket(obj))).toContain('non_binary_value');
    }
  });

  it('a verdict token in a reasonCode → verdict_token', () => {
    const obj = goodPacket();
    obj.binaries = [
      {
        classifierId: 'responds_to_parent',
        value: 1,
        confidence: 'high',
        reasonCode: 'parent_continuity_winner_detected',
      },
    ];
    expect(codesOf(parseSemanticPacket(obj))).toContain('verdict_token');
  });

  it('a person-label token in a string field → person_label', () => {
    const obj = goodPacket();
    obj.binaries = [
      {
        classifierId: 'responds_to_parent',
        value: 1,
        confidence: 'high',
        reasonCode: 'parent_continuity_direct_claim_response',
        evidenceSpan: 'names the speaker a troll',
      },
    ];
    expect(codesOf(parseSemanticPacket(obj))).toContain('person_label');
  });

  it('a "bad faith" phrase → person_label', () => {
    const obj = goodPacket();
    obj.modelVersion = 'argued in bad faith';
    expect(codesOf(parseSemanticPacket(obj))).toContain('person_label');
  });

  it('a synthetic key-shaped string → secret_shape', () => {
    const obj = goodPacket();
    obj.binaries = [
      {
        classifierId: 'responds_to_parent',
        value: 1,
        confidence: 'high',
        reasonCode: 'parent_continuity_direct_claim_response',
        evidenceSpan: 'token ' + 'sk-' + 'ant-' + 'Y'.repeat(20),
      },
    ];
    expect(codesOf(parseSemanticPacket(obj))).toContain('secret_shape');
  });

  it('an @handle / URL / email / post-id → pii_shape', () => {
    const piiSpans = [
      'mentions ' + '@' + 'someuser',
      'see ' + 'https://' + 'example' + '.invalid/x',
      'contact ' + 'someone' + '@' + 'mail.invalid',
      'post ' + '1'.repeat(18),
    ];
    for (const span of piiSpans) {
      const obj = goodPacket();
      obj.binaries = [
        {
          classifierId: 'responds_to_parent',
          value: 1,
          confidence: 'high',
          reasonCode: 'parent_continuity_direct_claim_response',
          evidenceSpan: span,
        },
      ];
      expect(codesOf(parseSemanticPacket(obj))).toContain('pii_shape');
    }
  });

  it('a scoreHints value of 9 → score_hint_out_of_range', () => {
    const obj = goodPacket();
    obj.scoreHints = {
      continuityCredit: 9,
      evidencePressure: 0,
      branchHygiene: 0,
      synthesisReadiness: 0,
      sourceChainDebt: 0,
      unresolvedRedirectRisk: 0,
    };
    expect(codesOf(parseSemanticPacket(obj))).toContain('score_hint_out_of_range');
  });

  it('a non-integer scoreHints value → score_hint_out_of_range', () => {
    const obj = goodPacket();
    obj.scoreHints = {
      continuityCredit: 1.5,
      evidencePressure: 0,
      branchHygiene: 0,
      synthesisReadiness: 0,
      sourceChainDebt: 0,
      unresolvedRedirectRisk: 0,
    };
    expect(codesOf(parseSemanticPacket(obj))).toContain('score_hint_out_of_range');
  });

  it('a duplicate classifierId → duplicate_classifier_id', () => {
    const obj = goodPacket();
    obj.binaries = [
      {
        classifierId: 'responds_to_parent',
        value: 1,
        confidence: 'high',
        reasonCode: 'parent_continuity_direct_claim_response',
      },
      {
        classifierId: 'responds_to_parent',
        value: 0,
        confidence: 'low',
        reasonCode: 'parent_continuity_redirects_topic',
      },
    ];
    expect(codesOf(parseSemanticPacket(obj))).toContain('duplicate_classifier_id');
  });

  it('an over-length reasonCode → field_too_long', () => {
    const obj = goodPacket();
    obj.binaries = [
      {
        classifierId: 'responds_to_parent',
        value: 1,
        confidence: 'high',
        reasonCode: 'parent_continuity_' + 'a'.repeat(400),
      },
    ];
    expect(codesOf(parseSemanticPacket(obj))).toContain('field_too_long');
  });

  it('a reasonCode with no known family → unknown_reason_code', () => {
    const obj = goodPacket();
    obj.binaries = [
      {
        classifierId: 'responds_to_parent',
        value: 1,
        confidence: 'high',
        reasonCode: 'mystery_family_token',
      },
    ];
    expect(codesOf(parseSemanticPacket(obj))).toContain('unknown_reason_code');
  });

  it('a non-snake_case reasonCode → unknown_reason_code', () => {
    const obj = goodPacket();
    obj.binaries = [
      {
        classifierId: 'responds_to_parent',
        value: 1,
        confidence: 'high',
        reasonCode: 'Parent Continuity Direct',
      },
    ];
    expect(codesOf(parseSemanticPacket(obj))).toContain('unknown_reason_code');
  });

  it('an unknown route / friction / confidence → matching codes', () => {
    expect(
      codesOf(parseSemanticPacket({ ...goodPacket(), routeSuggestion: 'warp_lane' })),
    ).toContain('unknown_route_suggestion');
    expect(
      codesOf(parseSemanticPacket({ ...goodPacket(), frictionSuggestion: 'ban_user' })),
    ).toContain('unknown_friction_suggestion');
    const obj = goodPacket();
    obj.binaries = [
      {
        classifierId: 'responds_to_parent',
        value: 1,
        confidence: 'certain',
        reasonCode: 'parent_continuity_direct_claim_response',
      },
    ];
    expect(codesOf(parseSemanticPacket(obj))).toContain('unknown_confidence');
  });

  it('a missing required field → missing_field', () => {
    const obj = goodPacket();
    delete obj.contentHash;
    expect(codesOf(parseSemanticPacket(obj))).toContain('missing_field');
  });

  it('an empty required hash string → missing_field', () => {
    expect(codesOf(parseSemanticPacket({ ...goodPacket(), roomId: '' }))).toContain(
      'missing_field',
    );
  });

  it('the validator collects multiple rejections at once', () => {
    const obj = goodPacket();
    obj.authoritative = true;
    obj.routeSuggestion = 'warp_lane';
    (obj as Record<string, unknown>).block = true;
    const result = parseSemanticPacket(obj);
    expect(result.ok).toBe(false);
    const codes = codesOf(result);
    expect(codes).toContain('authoritative_not_false');
    expect(codes).toContain('unknown_route_suggestion');
    expect(codes).toContain('block_field');
  });
});

describe('MCP-011 parseSemanticPacket — rejection-message safety', () => {
  it('a secret_shape rejection never echoes the offending raw value', () => {
    const secret = 'sk-' + 'ant-' + 'Z'.repeat(28);
    const obj = goodPacket();
    obj.binaries = [
      {
        classifierId: 'responds_to_parent',
        value: 1,
        confidence: 'high',
        reasonCode: 'parent_continuity_direct_claim_response',
        evidenceSpan: 'leaked ' + secret,
      },
    ];
    const result = parseSemanticPacket(obj);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      for (const r of result.rejections) {
        expect(r.detail.includes(secret)).toBe(false);
        if (r.field !== undefined) {
          expect(r.field.includes(secret)).toBe(false);
        }
      }
    }
  });

  it('a pii_shape rejection never echoes the offending handle', () => {
    const handle = '@' + 'leakeduser';
    const obj = goodPacket();
    obj.binaries = [
      {
        classifierId: 'responds_to_parent',
        value: 1,
        confidence: 'high',
        reasonCode: 'parent_continuity_direct_claim_response',
        evidenceSpan: 'cites ' + handle,
      },
    ];
    const result = parseSemanticPacket(obj);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      for (const r of result.rejections) {
        expect(r.detail.includes(handle)).toBe(false);
      }
    }
  });
});

describe('MCP-011 credit-eligibility predicates', () => {
  function sample(confidence: SemanticBinarySample['confidence']): SemanticBinarySample {
    return {
      classifierId: 'responds_to_parent',
      value: 1,
      confidence,
      reasonCode: 'parent_continuity_direct_claim_response',
    };
  }

  it('isCreditEligible is false for low confidence, true for medium / high', () => {
    expect(isCreditEligible(sample('low'))).toBe(false);
    expect(isCreditEligible(sample('medium'))).toBe(true);
    expect(isCreditEligible(sample('high'))).toBe(true);
  });

  it('creditEligibleBinaries drops low-confidence binaries (fixture 15)', () => {
    const lowResult = parseSemanticPacket(VALID_FIXTURES.validLowConfidence);
    expect(lowResult.ok).toBe(true);
    if (lowResult.ok) {
      expect(creditEligibleBinaries(lowResult.packet)).toHaveLength(0);
    }
  });

  it('creditEligibleBinaries keeps medium / high binaries', () => {
    const result = parseSemanticPacket(VALID_FIXTURES.validContinuity);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(creditEligibleBinaries(result.packet).length).toBe(
        result.packet.binaries.length,
      );
    }
  });
});

describe('MCP-011 looksLikeInternalCode', () => {
  it('recognizes snake_case internal codes', () => {
    expect(looksLikeInternalCode('responds_to_parent')).toBe(true);
    expect(looksLikeInternalCode('parent_continuity_direct_claim_response')).toBe(true);
  });

  it('rejects plain-language strings and single tokens', () => {
    expect(looksLikeInternalCode('This answers the parent')).toBe(false);
    expect(looksLikeInternalCode('mainline')).toBe(false);
    expect(looksLikeInternalCode('')).toBe(false);
  });
});
