/**
 * MCP-SERVER-006-FAMILY-E — scanFamilyEBooleanResponseForBanList unit tests.
 *
 * Covers every banned-token shape against:
 *   - evidenceSpan strings (any Family E rawKey)
 *   - modelInfo.serverName
 *   - modelInfo.classifierSetVersion
 *
 * Layers scanned (the Family E scanner stacks both):
 *   1. Shared DOCTRINE_BAN_PATTERNS (winner/loser/verdict/truth/liar/etc.)
 *   2. FAMILY_E_BAN_PATTERNS (amendment §3 BINDING):
 *      - fallacy / fallacious / invalid / flawed / wrong
 *      - weak argument / invalid argument / bad reasoning / flawed reasoning
 *      - logical error / informal fallacy / proof of
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  scanFamilyEBooleanResponseForBanList,
  FAMILY_E_BAN_PATTERNS,
} from '../lib/familyEBanListScan.ts';
import type { McpBooleanObservationValidatedResponse } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../lib/mcpBooleanObservationSchemaMirror.ts';

function validResponse(
  overrides: Partial<McpBooleanObservationValidatedResponse> = {},
): McpBooleanObservationValidatedResponse {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'node-e-1',
    checkedRawKeys: ['slippery_slope_reasoning_present'],
    observations: { slippery_slope_reasoning_present: true },
    confidence: { slippery_slope_reasoning_present: 'high' },
    evidenceSpan: {
      slippery_slope_reasoning_present: 'If we ban X, that will normalize content restriction, which will lead to banning Y',
    },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-e-v1',
    },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Clean response baseline
// ─────────────────────────────────────────────────────────────────────────

Deno.test('Family E ban-list scan: clean response returns ok=true', () => {
  const result = scanFamilyEBooleanResponseForBanList(validResponse());
  assertEquals(result.ok, true);
});

Deno.test('Family E ban-list scan: clean slippery_slope evidenceSpan with chain anchor passes', () => {
  // Anchor the chain pattern without any fallacy framing.
  const r = validResponse({
    evidenceSpan: {
      slippery_slope_reasoning_present: 'expand to a second category, then a third, then a fourth',
    },
  });
  const result = scanFamilyEBooleanResponseForBanList(r);
  assertEquals(result.ok, true);
});

// ─────────────────────────────────────────────────────────────────────────
// Shared DOCTRINE_BAN_PATTERNS coverage (regression)
// ─────────────────────────────────────────────────────────────────────────

Deno.test('Family E ban-list scan: evidenceSpan with "winner" fails (shared ban-list)', () => {
  const r = validResponse({
    evidenceSpan: { slippery_slope_reasoning_present: 'declared the winner of round two' },
  });
  const result = scanFamilyEBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'evidenceSpan.slippery_slope_reasoning_present');
  }
});

Deno.test('Family E ban-list scan: evidenceSpan with "verdict" fails (shared ban-list)', () => {
  const r = validResponse({
    evidenceSpan: { slippery_slope_reasoning_present: 'the verdict is in on slippery slopes' },
  });
  const result = scanFamilyEBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family E ban-list scan: evidenceSpan with "truth" fails (shared ban-list)', () => {
  const r = validResponse({
    evidenceSpan: { slippery_slope_reasoning_present: 'the truth is that this leads to suppression' },
  });
  const result = scanFamilyEBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family E ban-list scan: evidenceSpan with "liar" fails (shared ban-list)', () => {
  const r = validResponse({
    evidenceSpan: { slippery_slope_reasoning_present: 'the author is a liar' },
  });
  const result = scanFamilyEBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family E ban-list scan: evidenceSpan with "bad faith" fails (shared ban-list)', () => {
  const r = validResponse({
    evidenceSpan: { slippery_slope_reasoning_present: 'arguing in bad faith here' },
  });
  const result = scanFamilyEBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

// ─────────────────────────────────────────────────────────────────────────
// FAMILY_E_BAN_PATTERNS coverage (amendment §3 BINDING)
// ─────────────────────────────────────────────────────────────────────────

Deno.test('Family E ban-list scan: evidenceSpan with "fallacy" fails (Family E specific)', () => {
  // The existential doctrine constraint of Card 3.
  const r = validResponse({
    evidenceSpan: { slippery_slope_reasoning_present: 'this is a classic slippery-slope fallacy' },
  });
  const result = scanFamilyEBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'evidenceSpan.slippery_slope_reasoning_present');
  }
});

Deno.test('Family E ban-list scan: evidenceSpan with "fallacious" fails (Family E specific)', () => {
  const r = validResponse({
    evidenceSpan: { slippery_slope_reasoning_present: 'the reasoning here is fallacious' },
  });
  const result = scanFamilyEBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family E ban-list scan: evidenceSpan with "invalid" fails (Family E specific)', () => {
  const r = validResponse({
    evidenceSpan: { slippery_slope_reasoning_present: 'the chain inference is invalid' },
  });
  const result = scanFamilyEBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family E ban-list scan: evidenceSpan with "flawed" fails (Family E specific)', () => {
  const r = validResponse({
    evidenceSpan: { slippery_slope_reasoning_present: 'the multi-step argument is flawed' },
  });
  const result = scanFamilyEBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family E ban-list scan: evidenceSpan with "wrong" fails (Family E specific)', () => {
  const r = validResponse({
    evidenceSpan: { slippery_slope_reasoning_present: 'this reasoning is wrong' },
  });
  const result = scanFamilyEBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family E ban-list scan: evidenceSpan with "weak argument" fails (Family E two-word)', () => {
  const r = validResponse({
    evidenceSpan: { slippery_slope_reasoning_present: 'this is a weak argument' },
  });
  const result = scanFamilyEBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family E ban-list scan: evidenceSpan with "invalid argument" fails (Family E two-word)', () => {
  const r = validResponse({
    evidenceSpan: { slippery_slope_reasoning_present: 'an invalid argument structure' },
  });
  const result = scanFamilyEBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family E ban-list scan: evidenceSpan with "bad reasoning" fails (Family E two-word)', () => {
  const r = validResponse({
    evidenceSpan: { slippery_slope_reasoning_present: 'this is bad reasoning' },
  });
  const result = scanFamilyEBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family E ban-list scan: evidenceSpan with "flawed reasoning" fails (Family E two-word)', () => {
  const r = validResponse({
    evidenceSpan: { slippery_slope_reasoning_present: 'flawed reasoning indeed' },
  });
  const result = scanFamilyEBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family E ban-list scan: evidenceSpan with "logical error" fails (Family E two-word)', () => {
  const r = validResponse({
    evidenceSpan: { slippery_slope_reasoning_present: 'a logical error in the chain' },
  });
  const result = scanFamilyEBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family E ban-list scan: evidenceSpan with "informal fallacy" fails (Family E two-word)', () => {
  const r = validResponse({
    evidenceSpan: { slippery_slope_reasoning_present: 'classic informal fallacy' },
  });
  const result = scanFamilyEBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family E ban-list scan: evidenceSpan with "proof of" fails (Family E two-word; also shared)', () => {
  const r = validResponse({
    evidenceSpan: { slippery_slope_reasoning_present: 'proof of suppression follows' },
  });
  const result = scanFamilyEBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

// ─────────────────────────────────────────────────────────────────────────
// modelInfo field coverage
// ─────────────────────────────────────────────────────────────────────────

Deno.test('Family E ban-list scan: modelInfo.serverName with banned shared token fails', () => {
  const r = validResponse({
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-winner-server',
      classifierSetVersion: 'family-e-v1',
    },
  });
  const result = scanFamilyEBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'modelInfo.serverName');
  }
});

Deno.test('Family E ban-list scan: modelInfo.serverName with Family E-specific "fallacy" fails', () => {
  const r = validResponse({
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-fallacy-server',
      classifierSetVersion: 'family-e-v1',
    },
  });
  const result = scanFamilyEBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'modelInfo.serverName');
  }
});

Deno.test('Family E ban-list scan: modelInfo.classifierSetVersion with banned token fails', () => {
  const r = validResponse({
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-e-verdict-v1',
    },
  });
  const result = scanFamilyEBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'modelInfo.classifierSetVersion');
  }
});

Deno.test('Family E ban-list scan: modelInfo.classifierSetVersion with Family E-specific "fallacy" fails', () => {
  const r = validResponse({
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-e-fallacy-v1',
    },
  });
  const result = scanFamilyEBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'modelInfo.classifierSetVersion');
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────────────────────────────────

Deno.test('Family E ban-list scan: null evidenceSpan values are skipped (no false positive)', () => {
  const r = validResponse({
    checkedRawKeys: ['slippery_slope_reasoning_present', 'analogy_reasoning_present'],
    observations: { slippery_slope_reasoning_present: true, analogy_reasoning_present: false },
    confidence: { slippery_slope_reasoning_present: 'high', analogy_reasoning_present: 'medium' },
    evidenceSpan: {
      slippery_slope_reasoning_present: 'clean chain text without any banned tokens',
      analogy_reasoning_present: null,
    },
  });
  const result = scanFamilyEBooleanResponseForBanList(r);
  assertEquals(result.ok, true);
});

Deno.test('Family E ban-list scan: neutral compound words are NOT flagged', () => {
  // "wrongful" should not match \bwrong\b due to boundary; "fallacious" is
  // banned (own pattern) but "fall" alone is not banned.
  const r = validResponse({
    evidenceSpan: {
      slippery_slope_reasoning_present: 'observing a fall in compliance metrics over time',
    },
  });
  const result = scanFamilyEBooleanResponseForBanList(r);
  assertEquals(result.ok, true);
});

Deno.test('Family E ban-list scan: snake_case verdict tokens still match (boundary handling)', () => {
  // "slippery_slope_is_a_fallacy" should match the fallacy pattern because
  // the boundary treats `_` as a word break.
  const r = validResponse({
    evidenceSpan: {
      slippery_slope_reasoning_present: 'slippery_slope_is_a_fallacy_in_logic',
    },
  });
  const result = scanFamilyEBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family E ban-list scan: FAMILY_E_BAN_PATTERNS contains all amendment §3 binding tokens', () => {
  // Defensive: prove the export contains the 12 expected patterns.
  assertEquals(FAMILY_E_BAN_PATTERNS.length, 12);
  // Spot-check a sample of patterns by testing each against a known target.
  const fallacyPattern = FAMILY_E_BAN_PATTERNS.find((p) => p.test('this is a fallacy'));
  if (!fallacyPattern) throw new Error('FAMILY_E_BAN_PATTERNS missing "fallacy" pattern');
  const invalidPattern = FAMILY_E_BAN_PATTERNS.find((p) => p.test('invalid claim'));
  if (!invalidPattern) throw new Error('FAMILY_E_BAN_PATTERNS missing "invalid" pattern');
  const weakArgumentPattern = FAMILY_E_BAN_PATTERNS.find((p) => p.test('a weak argument'));
  if (!weakArgumentPattern) throw new Error('FAMILY_E_BAN_PATTERNS missing "weak argument" pattern');
  const badReasoningPattern = FAMILY_E_BAN_PATTERNS.find((p) => p.test('bad reasoning'));
  if (!badReasoningPattern) throw new Error('FAMILY_E_BAN_PATTERNS missing "bad reasoning" pattern');
  const logicalErrorPattern = FAMILY_E_BAN_PATTERNS.find((p) => p.test('logical error'));
  if (!logicalErrorPattern) throw new Error('FAMILY_E_BAN_PATTERNS missing "logical error" pattern');
  const informalFallacyPattern = FAMILY_E_BAN_PATTERNS.find((p) => p.test('informal fallacy'));
  if (!informalFallacyPattern) throw new Error('FAMILY_E_BAN_PATTERNS missing "informal fallacy" pattern');
  const proofOfPattern = FAMILY_E_BAN_PATTERNS.find((p) => p.test('proof of'));
  if (!proofOfPattern) throw new Error('FAMILY_E_BAN_PATTERNS missing "proof of" pattern');
});

Deno.test('Family E ban-list scan: ban-list scan stacks shared DOCTRINE_BAN_PATTERNS first, then Family E', () => {
  // If a shared token is the first hit, the path reports correctly. If a
  // Family E-specific token is the only hit, the path still reports
  // correctly. This proves both layers are active.

  // Shared layer hit first:
  const r1 = validResponse({
    evidenceSpan: { slippery_slope_reasoning_present: 'this is a winner argument and a fallacy' },
  });
  const result1 = scanFamilyEBooleanResponseForBanList(r1);
  assertEquals(result1.ok, false);

  // Family E-specific layer hit only:
  const r2 = validResponse({
    evidenceSpan: { slippery_slope_reasoning_present: 'a flawed inference chain' },
  });
  const result2 = scanFamilyEBooleanResponseForBanList(r2);
  assertEquals(result2.ok, false);
  if (!result2.ok) {
    assertEquals(result2.path, 'evidenceSpan.slippery_slope_reasoning_present');
  }
});
