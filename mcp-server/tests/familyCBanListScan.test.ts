/**
 * MCP-SERVER-004-FAMILY-C — scanFamilyCBooleanResponseForBanList unit tests.
 *
 * Covers every banned-token shape against:
 *   - evidenceSpan strings (any Family C rawKey)
 *   - modelInfo.serverName
 *   - modelInfo.classifierSetVersion
 *
 * The patterns themselves are tested in upstream `doctrineBanList.test.ts`;
 * this file exercises the SCAN logic and field coverage against Family C
 * fixture shapes (17 keys, family-c-v1).
 */
import { assertEquals } from 'std/assert/mod.ts';
import { scanFamilyCBooleanResponseForBanList } from '../lib/familyCBanListScan.ts';
import type { McpBooleanObservationValidatedResponse } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../lib/mcpBooleanObservationSchemaMirror.ts';

function validResponse(
  overrides: Partial<McpBooleanObservationValidatedResponse> = {},
): McpBooleanObservationValidatedResponse {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'node-1',
    checkedRawKeys: ['offers_candidate_understanding'],
    observations: { offers_candidate_understanding: true },
    confidence: { offers_candidate_understanding: 'high' },
    evidenceSpan: { offers_candidate_understanding: 'Are you saying libraries are like roads?' },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-c-v1',
    },
    ...overrides,
  };
}

Deno.test('Family C ban-list scan: clean response returns ok=true', () => {
  const result = scanFamilyCBooleanResponseForBanList(validResponse());
  assertEquals(result.ok, true);
});

Deno.test('Family C ban-list scan: evidenceSpan with "winner" fails', () => {
  const r = validResponse({
    evidenceSpan: { offers_candidate_understanding: 'declared the winner of round two' },
  });
  const result = scanFamilyCBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'evidenceSpan.offers_candidate_understanding');
  }
});

Deno.test('Family C ban-list scan: evidenceSpan with "loser" fails', () => {
  const r = validResponse({
    evidenceSpan: { offers_candidate_understanding: 'this is the loser argument' },
  });
  const result = scanFamilyCBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family C ban-list scan: evidenceSpan with "verdict" fails', () => {
  const r = validResponse({
    evidenceSpan: { offers_candidate_understanding: 'the verdict is in' },
  });
  const result = scanFamilyCBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family C ban-list scan: evidenceSpan with "truth" fails', () => {
  const r = validResponse({
    evidenceSpan: { offers_candidate_understanding: 'the underlying truth here' },
  });
  const result = scanFamilyCBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family C ban-list scan: evidenceSpan with "liar" fails', () => {
  const r = validResponse({
    evidenceSpan: { offers_candidate_understanding: 'the speaker is a liar' },
  });
  const result = scanFamilyCBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family C ban-list scan: evidenceSpan with "bad faith" fails', () => {
  const r = validResponse({
    evidenceSpan: { offers_candidate_understanding: 'arguing in bad faith here' },
  });
  const result = scanFamilyCBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family C ban-list scan: evidenceSpan with "extremist" fails', () => {
  const r = validResponse({
    evidenceSpan: { offers_candidate_understanding: 'this is an extremist position' },
  });
  const result = scanFamilyCBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family C ban-list scan: evidenceSpan with "manipulative" fails', () => {
  const r = validResponse({
    evidenceSpan: { offers_candidate_understanding: 'a manipulative framing' },
  });
  const result = scanFamilyCBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family C ban-list scan: evidenceSpan with "propagandist" fails', () => {
  const r = validResponse({
    evidenceSpan: { offers_candidate_understanding: 'anyone who says otherwise is a propagandist' },
  });
  const result = scanFamilyCBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family C ban-list scan: evidenceSpan with "correct" fails (rejects-as-wrong doctrine risk)', () => {
  // The rejects_candidate_understanding doctrine guard forbids "wrong" / "incorrect"
  // framing. The ban-list catches `correct` (and `incorrect`) as banned tokens.
  // Although the guard text is about "wrong", the upstream BANNED_TOKENS list
  // doesn't include "wrong" — it does include "correct" / "incorrect" / "verdict"
  // which are the structural verdict tokens.
  const r = validResponse({
    evidenceSpan: { rejects_candidate_understanding: 'they got the correct interpretation' },
    observations: { rejects_candidate_understanding: true },
    confidence: { rejects_candidate_understanding: 'high' },
    checkedRawKeys: ['rejects_candidate_understanding'],
  });
  const result = scanFamilyCBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'evidenceSpan.rejects_candidate_understanding');
  }
});

Deno.test('Family C ban-list scan: evidenceSpan with "incorrect" fails', () => {
  const r = validResponse({
    evidenceSpan: { acknowledges_misread: 'I admit my reading was incorrect' },
    observations: { acknowledges_misread: true },
    confidence: { acknowledges_misread: 'high' },
    checkedRawKeys: ['acknowledges_misread'],
  });
  const result = scanFamilyCBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family C ban-list scan: evidenceSpan with "dishonest" fails', () => {
  const r = validResponse({
    evidenceSpan: { offers_candidate_understanding: 'a dishonest framing' },
  });
  const result = scanFamilyCBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family C ban-list scan: modelInfo.serverName with banned token fails', () => {
  const r = validResponse({
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-winner-server',
      classifierSetVersion: 'family-c-v1',
    },
  });
  const result = scanFamilyCBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'modelInfo.serverName');
  }
});

Deno.test('Family C ban-list scan: modelInfo.classifierSetVersion with banned token fails', () => {
  const r = validResponse({
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-c-verdict-v1',
    },
  });
  const result = scanFamilyCBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'modelInfo.classifierSetVersion');
  }
});

Deno.test('Family C ban-list scan: null evidenceSpan values are skipped (no false positive)', () => {
  const r = validResponse({
    checkedRawKeys: ['offers_candidate_understanding', 'flags_term_ambiguity'],
    observations: { offers_candidate_understanding: true, flags_term_ambiguity: false },
    confidence: { offers_candidate_understanding: 'high', flags_term_ambiguity: 'medium' },
    evidenceSpan: { offers_candidate_understanding: 'clean text', flags_term_ambiguity: null },
  });
  const result = scanFamilyCBooleanResponseForBanList(r);
  assertEquals(result.ok, true);
});

Deno.test('Family C ban-list scan: neutral compound words are NOT flagged', () => {
  // "playable" not banned; "hot" not banned alone; "clarification" contains no banned substrings.
  const r = validResponse({
    evidenceSpan: { offers_candidate_understanding: 'a clarification-positive grounding move' },
  });
  const result = scanFamilyCBooleanResponseForBanList(r);
  assertEquals(result.ok, true);
});
