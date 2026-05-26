import { assertEquals } from 'std/assert/mod.ts';
import {
  validateClassifyMoveInput,
  validateSemanticRefereePacket,
} from '../lib/semanticRefereePacketSchema.ts';

Deno.test('validateClassifyMoveInput accepts a minimal valid request', () => {
  const r = validateClassifyMoveInput({
    moveBodyRedacted: '[fixture] x',
    roomContext: {},
    requestedClassifiers: ['responds_to_parent'],
    contentHash: 'h',
    roomId: 'r',
  });
  if (!r.ok) throw new Error(`expected ok, got ${r.path}: ${r.detail}`);
});

Deno.test('validateClassifyMoveInput rejects when requestedClassifiers is empty', () => {
  const r = validateClassifyMoveInput({
    moveBodyRedacted: '[fixture] x',
    roomContext: {},
    requestedClassifiers: [],
    contentHash: 'h',
    roomId: 'r',
  });
  if (r.ok) throw new Error('expected error');
  assertEquals(r.path, 'requestedClassifiers');
});

Deno.test('validateClassifyMoveInput rejects when requestedClassifiers exceeds 5', () => {
  const r = validateClassifyMoveInput({
    moveBodyRedacted: '[fixture] x',
    roomContext: {},
    requestedClassifiers: ['a', 'b', 'c', 'd', 'e', 'f'],
    contentHash: 'h',
    roomId: 'r',
  });
  if (r.ok) throw new Error('expected error');
});

Deno.test('validateClassifyMoveInput rejects unknown side', () => {
  const r = validateClassifyMoveInput({
    moveBodyRedacted: '[fixture] x',
    roomContext: { side: 'judge' },
    requestedClassifiers: ['responds_to_parent'],
    contentHash: 'h',
    roomId: 'r',
  });
  if (r.ok) throw new Error('expected error');
});

Deno.test('validateSemanticRefereePacket accepts the fixture-derived response', () => {
  const r = validateSemanticRefereePacket({
    binaries: [
      {
        classifierId: 'responds_to_parent',
        value: 1,
        confidence: 'high',
        reasonCode: 'parent_continuity_direct_claim_response',
      },
    ],
    routeSuggestion: 'mainline',
    frictionSuggestion: 'none',
    scoreHints: {
      continuityCredit: 2,
      evidencePressure: 0,
      branchHygiene: 0,
      synthesisReadiness: 0,
      sourceChainDebt: 0,
      unresolvedRedirectRisk: 0,
    },
    modelVersion: 'fixture-semantic-referee-v0',
  });
  if (!r.ok) throw new Error(`expected ok, got ${r.path}: ${r.detail}`);
});

Deno.test('validateSemanticRefereePacket REJECTS a smuggled "verdict" field in a binary (additionalProperties)', () => {
  const r = validateSemanticRefereePacket({
    binaries: [
      {
        classifierId: 'responds_to_parent',
        value: 1,
        confidence: 'high',
        reasonCode: 'parent_continuity_direct_claim_response',
        verdict: 'correct',
      },
    ],
    routeSuggestion: 'mainline',
    frictionSuggestion: 'none',
    scoreHints: {
      continuityCredit: 2,
      evidencePressure: 0,
      branchHygiene: 0,
      synthesisReadiness: 0,
      sourceChainDebt: 0,
      unresolvedRedirectRisk: 0,
    },
  });
  if (r.ok) throw new Error('expected validation_failed');
  assertEquals(r.detail, 'additionalProperties not allowed');
});

Deno.test('validateSemanticRefereePacket REJECTS a reasonCode that contains a banned token', () => {
  const r = validateSemanticRefereePacket({
    binaries: [
      {
        classifierId: 'responds_to_parent',
        value: 1,
        confidence: 'high',
        reasonCode: 'winner_decided',
      },
    ],
    routeSuggestion: 'mainline',
    frictionSuggestion: 'none',
    scoreHints: {
      continuityCredit: 1,
      evidencePressure: 0,
      branchHygiene: 0,
      synthesisReadiness: 0,
      sourceChainDebt: 0,
      unresolvedRedirectRisk: 0,
    },
  });
  if (r.ok) throw new Error('expected doctrine_ban_list rejection');
  assertEquals(r.detail, 'doctrine_ban_list');
});

Deno.test('validateSemanticRefereePacket REJECTS reasonCode with uppercase', () => {
  const r = validateSemanticRefereePacket({
    binaries: [
      {
        classifierId: 'responds_to_parent',
        value: 1,
        confidence: 'high',
        reasonCode: 'parent_continuity_DIRECT_claim',
      },
    ],
    routeSuggestion: 'mainline',
    frictionSuggestion: 'none',
    scoreHints: {
      continuityCredit: 1,
      evidencePressure: 0,
      branchHygiene: 0,
      synthesisReadiness: 0,
      sourceChainDebt: 0,
      unresolvedRedirectRisk: 0,
    },
  });
  if (r.ok) throw new Error('expected snake_case rejection');
});

Deno.test('validateSemanticRefereePacket REJECTS scoreHint > 3', () => {
  const r = validateSemanticRefereePacket({
    binaries: [],
    routeSuggestion: 'mainline',
    frictionSuggestion: 'none',
    scoreHints: {
      continuityCredit: 5,
      evidencePressure: 0,
      branchHygiene: 0,
      synthesisReadiness: 0,
      sourceChainDebt: 0,
      unresolvedRedirectRisk: 0,
    },
  });
  if (r.ok) throw new Error('expected range rejection');
});

Deno.test('validateSemanticRefereePacket REJECTS unknown routeSuggestion', () => {
  const r = validateSemanticRefereePacket({
    binaries: [],
    routeSuggestion: 'crown_winner',
    frictionSuggestion: 'none',
    scoreHints: {
      continuityCredit: 0,
      evidencePressure: 0,
      branchHygiene: 0,
      synthesisReadiness: 0,
      sourceChainDebt: 0,
      unresolvedRedirectRisk: 0,
    },
  });
  if (r.ok) throw new Error('expected route rejection');
});
