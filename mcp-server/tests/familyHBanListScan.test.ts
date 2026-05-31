/**
 * MCP-SERVER-009-FAMILY-H — Family H doctrine ban-list scan unit tests.
 *
 * Verifies scanFamilyHBooleanResponseForBanList rejects:
 *   - every shared DOCTRINE_BAN_PATTERNS token (winner/loser/truth/verdict/etc.)
 *   - every Family H-specific clarity-verdict token (design §A.3.3:
 *     weak/sloppy/lazy/careless/confused/unsound/unsupported/incoherent/
 *     illogical + the 8 compound phrases)
 * in evidenceSpan / modelInfo.serverName / modelInfo.classifierSetVersion,
 * AND that neutral near-miss words (wonderful) are NOT flagged, AND that
 * null evidence_span values are skipped, AND that a clean claim-clarity
 * evidence_span passes.
 *
 * Per design §A.3.3: a FAIL on the doctrine boundary is the existential
 * Family H risk; this scanner is the runtime backstop.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  scanFamilyHBooleanResponseForBanList,
  FAMILY_H_BAN_PATTERNS,
} from '../lib/familyHBanListScan.ts';
import type { McpBooleanObservationValidatedResponse } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../lib/mcpBooleanObservationSchemaMirror.ts';

function buildResponse(
  rawKey: string,
  evidenceSpanValue: string | null,
  overrides: Partial<{ serverName: string; classifierSetVersion: string }> = {},
): McpBooleanObservationValidatedResponse {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'fixture-node-h-banlist-test',
    checkedRawKeys: [rawKey],
    observations: { [rawKey]: true },
    confidence: { [rawKey]: 'high' },
    evidenceSpan: { [rawKey]: evidenceSpanValue },
    modelInfo: {
      provider: 'mcp',
      serverName: overrides.serverName ?? 'cdiscourse-mcp-server',
      classifierSetVersion: overrides.classifierSetVersion ?? 'family-h-v1',
    },
  };
}

// ── Shared DOCTRINE_BAN_PATTERNS tokens ──

Deno.test('Family H ban-list rejects shared token "winner" in evidenceSpan', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('claim_specificity_low', 'the winner is the pro side'),
  );
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.path, 'evidenceSpan.claim_specificity_low');
});

Deno.test('Family H ban-list rejects shared token "loser" in evidenceSpan', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('conclusion_missing', 'the speaker is the loser here'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family H ban-list rejects shared token "truth" in evidenceSpan', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('claim_present', 'this establishes the truth of the matter'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family H ban-list rejects shared token "verdict" in evidenceSpan', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('reason_missing', 'the verdict is in'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family H ban-list rejects shared phrase "bad faith" in evidenceSpan', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('hedging_present', 'this is a bad faith hedge'),
  );
  assertEquals(result.ok, false);
});

// ── Family H-specific clarity-verdict single tokens (design §A.3.3) ──

Deno.test('Family H ban-list rejects "weak" single token in evidenceSpan', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('claim_specificity_low', 'the claim is weak and broad'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family H ban-list rejects "sloppy" single token in evidenceSpan', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('unclear_reference_present', 'the speaker is sloppy with pronouns'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family H ban-list rejects "lazy" single token in evidenceSpan', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('claim_specificity_low', 'this is a lazy claim'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family H ban-list rejects "careless" single token in evidenceSpan', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('unclear_reference_present', 'the author was careless about referents'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family H ban-list rejects "confused" single token in evidenceSpan', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('multiple_claims_present', 'the move is confused and scattered'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family H ban-list rejects "unsound" single token in evidenceSpan', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('reason_missing', 'the reasoning is unsound'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family H ban-list rejects "unsupported" single token in evidenceSpan (the reason_missing verdict drift)', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('reason_missing', 'the claim is unsupported by any reason'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family H ban-list rejects "incoherent" single token in evidenceSpan', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('multiple_claims_present', 'the argument is incoherent'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family H ban-list rejects "illogical" single token in evidenceSpan', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('reason_missing', 'this conclusion is illogical'),
  );
  assertEquals(result.ok, false);
});

// ── Family H-specific clarity-verdict compound phrases (design §A.3.3) ──

Deno.test('Family H ban-list rejects "bad reasoning" phrase in evidenceSpan', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('reason_missing', 'this is bad reasoning'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family H ban-list rejects "bad argument" phrase in evidenceSpan', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('claim_specificity_low', 'a bad argument is on the table'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family H ban-list rejects "bad writing" phrase in evidenceSpan', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('unclear_reference_present', 'this is bad writing on the part of the author'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family H ban-list rejects "argument is incomplete" phrase in evidenceSpan (the conclusion_missing verdict drift)', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('conclusion_missing', 'the argument is incomplete without a stated conclusion'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family H ban-list rejects "argument is unsupported" phrase in evidenceSpan (the reason_missing verdict drift)', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('reason_missing', 'the argument is unsupported by any ground'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family H ban-list rejects "argument is weak" phrase in evidenceSpan', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('claim_specificity_low', 'the argument is weak'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family H ban-list rejects "claim fails" phrase in evidenceSpan', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('claim_specificity_low', 'the claim fails on its own terms'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family H ban-list rejects "claim is wrong" phrase in evidenceSpan', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('claim_specificity_low', 'the claim is wrong on its face'),
  );
  assertEquals(result.ok, false);
});

// ── serverName + classifierSetVersion scanning ──

Deno.test('Family H ban-list rejects verdict token in modelInfo.serverName', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('claim_present', null, { serverName: 'cdiscourse-weak-server' }),
  );
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.path, 'modelInfo.serverName');
});

Deno.test('Family H ban-list rejects verdict token in modelInfo.classifierSetVersion', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('claim_present', null, { classifierSetVersion: 'family-sloppy-v1' }),
  );
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.path, 'modelInfo.classifierSetVersion');
});

// ── Near-miss negatives (operator-required) ──

Deno.test('Family H ban-list does NOT flag neutral near-miss "wonderful" (does not match any H token)', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('claim_present', 'this is a wonderful claim'),
  );
  assertEquals(result.ok, true);
});

Deno.test('Family H ban-list does NOT flag "weakly" / "weakened" (suffix continues into alpha → no boundary)', () => {
  // 'weakly' is 'weak' + 'l' + 'y'; the 'l' is alpha → no boundary break,
  // so the strict-boundary 'weak' pattern does NOT match 'weakly'. This is
  // the documented boundary trade-off (mirrors G's strict-boundary precedent).
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('claim_present', 'the foundation has weakened over time'),
  );
  assertEquals(result.ok, true);
});

Deno.test('Family H ban-list does NOT flag "carelessness" or "carelessly" (suffix continues into alpha)', () => {
  // 'careless' followed by 'l' or 'n' is not a boundary; the strict-boundary
  // 'careless' pattern does NOT match 'carelessly'/'carelessness'.
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('claim_present', 'the speaker noted carelessness in some sources'),
  );
  assertEquals(result.ok, true);
});

// ── null evidence_span + clean output ──

Deno.test('Family H ban-list skips null evidenceSpan values', () => {
  const result = scanFamilyHBooleanResponseForBanList(buildResponse('claim_specificity_low', null));
  assertEquals(result.ok, true);
});

Deno.test('Family H ban-list passes a clean claim-clarity evidenceSpan (anchors broad scope, no verdict)', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('claim_specificity_low', 'Carbon taxes work'),
  );
  assertEquals(result.ok, true);
});

Deno.test('Family H ban-list passes a clean reason_missing evidenceSpan (anchors bare claim)', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('reason_missing', 'EVs reduce pollution'),
  );
  assertEquals(result.ok, true);
});

Deno.test('Family H ban-list passes a clean conclusion_missing evidenceSpan (anchors reasoning chain)', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse(
      'conclusion_missing',
      'Library funding has dropped 20% since 2019. Literacy rates have fallen.',
    ),
  );
  assertEquals(result.ok, true);
});

Deno.test('Family H ban-list passes a clean unclear_reference_present evidenceSpan (anchors ambiguous pronoun)', () => {
  const result = scanFamilyHBooleanResponseForBanList(
    buildResponse('unclear_reference_present', 'This is the wrong approach'),
  );
  // Note: 'wrong' is NOT in H's ban-list (H doesn't add it like G did,
  // because H's clarity verdicts focus on the formulation-quality slice;
  // 'wrong' is a truth verdict). The shared list catches 'truth' but not
  // bare 'wrong'. This evidence_span is clean per H's ban-list as
  // specified in design §A.3.3.
  assertEquals(result.ok, true);
});

// ── FAMILY_H_BAN_PATTERNS contents (design §A.3.3) ──

Deno.test('FAMILY_H_BAN_PATTERNS contains all 17 design §A.3.3 clarity-verdict tokens (9 single + 8 phrase)', () => {
  const targetTokens = [
    // design §A.3.3 single tokens (9)
    'weak',
    'sloppy',
    'lazy',
    'careless',
    'confused',
    'unsound',
    'unsupported',
    'incoherent',
    'illogical',
    // design §A.3.3 compound phrases (8)
    'bad reasoning',
    'bad argument',
    'bad writing',
    'argument is incomplete',
    'argument is unsupported',
    'argument is weak',
    'claim fails',
    'claim is wrong',
  ];
  for (const token of targetTokens) {
    const pattern = FAMILY_H_BAN_PATTERNS.find((p) => p.test(`prefix ${token} suffix`));
    if (!pattern) {
      throw new Error(`FAMILY_H_BAN_PATTERNS missing pattern for token: '${token}'`);
    }
  }
  // 17 patterns total (9 single + 8 phrase).
  assertEquals(FAMILY_H_BAN_PATTERNS.length, 17);
});

Deno.test('FAMILY_H_BAN_PATTERNS is frozen (readonly RegExp[])', () => {
  assertEquals(Object.isFrozen(FAMILY_H_BAN_PATTERNS), true);
});

Deno.test('FAMILY_H_BAN_PATTERNS phrase forms accept underscore + hyphen separators', () => {
  // The phrase patterns use `[\s_-]+` so `argument_is_incomplete` matches
  // as well as `argument-is-incomplete`.
  const phrase1 = FAMILY_H_BAN_PATTERNS.find((p) => p.test('argument is incomplete'));
  if (!phrase1) throw new Error('missing argument-is-incomplete phrase pattern');
  assertEquals(phrase1.test('argument_is_incomplete'), true);
  assertEquals(phrase1.test('argument-is-incomplete'), true);
});
