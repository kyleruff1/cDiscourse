/**
 * MCP-SERVER-005-FAMILY-D — scanFamilyDBooleanResponseForBanList unit tests.
 *
 * Covers every banned-token shape against:
 *   - evidenceSpan strings (any Family D Subset rawKey)
 *   - modelInfo.serverName
 *   - modelInfo.classifierSetVersion
 *
 * The patterns themselves are tested in upstream `doctrineBanList.test.ts`;
 * this file exercises the SCAN logic and field coverage against Family D
 * fixture shapes (19 keys, family-d-v1). Per design §4.4: NO Family-D-specific
 * patterns are added to the shared DOCTRINE_BAN_PATTERNS in this card;
 * per-key doctrine-risk assertions live in `familyDDoctrineFixtures.test.ts`.
 */
import { assertEquals } from 'std/assert/mod.ts';
import { scanFamilyDBooleanResponseForBanList } from '../lib/familyDBanListScan.ts';
import type { McpBooleanObservationValidatedResponse } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../lib/mcpBooleanObservationSchemaMirror.ts';

function validResponse(
  overrides: Partial<McpBooleanObservationValidatedResponse> = {},
): McpBooleanObservationValidatedResponse {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'node-d-1',
    checkedRawKeys: ['source_provided'],
    observations: { source_provided: true },
    confidence: { source_provided: 'high' },
    evidenceSpan: { source_provided: 'Per the 2024 EPA report, Table 3.1' },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-d-v1',
    },
    ...overrides,
  };
}

Deno.test('Family D ban-list scan: clean response returns ok=true', () => {
  const result = scanFamilyDBooleanResponseForBanList(validResponse());
  assertEquals(result.ok, true);
});

Deno.test('Family D ban-list scan: evidenceSpan with "winner" fails', () => {
  const r = validResponse({
    evidenceSpan: { source_provided: 'declared the winner of the debate' },
  });
  const result = scanFamilyDBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'evidenceSpan.source_provided');
  }
});

Deno.test('Family D ban-list scan: evidenceSpan with "loser" fails', () => {
  const r = validResponse({
    evidenceSpan: { source_provided: 'this is the loser argument' },
  });
  const result = scanFamilyDBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family D ban-list scan: evidenceSpan with "verdict" fails', () => {
  const r = validResponse({
    evidenceSpan: { source_provided: 'the verdict is in' },
  });
  const result = scanFamilyDBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family D ban-list scan: evidenceSpan with "truth" fails', () => {
  const r = validResponse({
    evidenceSpan: { evidence_supports_claim: 'establishes the truth of the matter' },
    observations: { evidence_supports_claim: true },
    confidence: { evidence_supports_claim: 'high' },
    checkedRawKeys: ['evidence_supports_claim'],
  });
  const result = scanFamilyDBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family D ban-list scan: evidenceSpan with "liar" fails', () => {
  const r = validResponse({
    evidenceSpan: { evidence_gap_present: 'the author is a liar' },
    observations: { evidence_gap_present: true },
    confidence: { evidence_gap_present: 'high' },
    checkedRawKeys: ['evidence_gap_present'],
  });
  const result = scanFamilyDBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'evidenceSpan.evidence_gap_present');
  }
});

Deno.test('Family D ban-list scan: evidenceSpan with "bad faith" fails', () => {
  const r = validResponse({
    evidenceSpan: { evidence_quality_questioned: 'arguing in bad faith here' },
    observations: { evidence_quality_questioned: true },
    confidence: { evidence_quality_questioned: 'high' },
    checkedRawKeys: ['evidence_quality_questioned'],
  });
  const result = scanFamilyDBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family D ban-list scan: evidenceSpan with "extremist" fails', () => {
  const r = validResponse({
    evidenceSpan: { anecdote_used: 'this is an extremist position' },
    observations: { anecdote_used: true },
    confidence: { anecdote_used: 'high' },
    checkedRawKeys: ['anecdote_used'],
  });
  const result = scanFamilyDBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family D ban-list scan: evidenceSpan with "manipulative" fails', () => {
  const r = validResponse({
    evidenceSpan: { evidence_gap_present: 'a manipulative framing' },
    observations: { evidence_gap_present: true },
    confidence: { evidence_gap_present: 'high' },
    checkedRawKeys: ['evidence_gap_present'],
  });
  const result = scanFamilyDBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family D ban-list scan: evidenceSpan with "propagandist" fails', () => {
  const r = validResponse({
    evidenceSpan: { external_authority_used: 'this is a propagandist source' },
    observations: { external_authority_used: true },
    confidence: { external_authority_used: 'high' },
    checkedRawKeys: ['external_authority_used'],
  });
  const result = scanFamilyDBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family D ban-list scan: evidenceSpan with "correct" fails', () => {
  // The doctrine ban-list catches `correct` as a verdict token. Family D
  // evidence-source-chain text legitimately AVOIDS this verdict framing.
  const r = validResponse({
    evidenceSpan: { evidence_supports_claim: 'the correct interpretation' },
    observations: { evidence_supports_claim: true },
    confidence: { evidence_supports_claim: 'high' },
    checkedRawKeys: ['evidence_supports_claim'],
  });
  const result = scanFamilyDBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family D ban-list scan: evidenceSpan with "incorrect" fails', () => {
  const r = validResponse({
    evidenceSpan: { evidence_quality_questioned: 'the data is incorrect' },
    observations: { evidence_quality_questioned: true },
    confidence: { evidence_quality_questioned: 'high' },
    checkedRawKeys: ['evidence_quality_questioned'],
  });
  const result = scanFamilyDBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family D ban-list scan: evidenceSpan with "dishonest" fails (evidence_gap_present doctrine risk)', () => {
  // Stage 2B + intent brief §4.3: evidence_gap_present must NOT be
  // framed as dishonest. The ban-list catches the model-emitted form
  // of this risk at the response boundary.
  const r = validResponse({
    evidenceSpan: { evidence_gap_present: 'a dishonest claim' },
    observations: { evidence_gap_present: true },
    confidence: { evidence_gap_present: 'high' },
    checkedRawKeys: ['evidence_gap_present'],
  });
  const result = scanFamilyDBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'evidenceSpan.evidence_gap_present');
  }
});

Deno.test('Family D ban-list scan: evidenceSpan with "proof of" fails (two-word phrase)', () => {
  // The shared ban-list catches `proof of` as a two-word phrase. Family D's
  // burden_request_present rawKey deliberately uses "burden of demonstration"
  // in its prompt-entry text to avoid this token; here we assert the
  // response-time scan also catches it if the model emits it.
  const r = validResponse({
    evidenceSpan: { burden_request_present: 'the proof of the claim' },
    observations: { burden_request_present: true },
    confidence: { burden_request_present: 'high' },
    checkedRawKeys: ['burden_request_present'],
  });
  const result = scanFamilyDBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family D ban-list scan: modelInfo.serverName with banned token fails', () => {
  const r = validResponse({
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-winner-server',
      classifierSetVersion: 'family-d-v1',
    },
  });
  const result = scanFamilyDBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'modelInfo.serverName');
  }
});

Deno.test('Family D ban-list scan: modelInfo.classifierSetVersion with banned token fails', () => {
  const r = validResponse({
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-d-verdict-v1',
    },
  });
  const result = scanFamilyDBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'modelInfo.classifierSetVersion');
  }
});

Deno.test('Family D ban-list scan: null evidenceSpan values are skipped (no false positive)', () => {
  const r = validResponse({
    checkedRawKeys: ['source_provided', 'evidence_gap_present'],
    observations: { source_provided: true, evidence_gap_present: false },
    confidence: { source_provided: 'high', evidence_gap_present: 'medium' },
    evidenceSpan: { source_provided: 'clean text', evidence_gap_present: null },
  });
  const result = scanFamilyDBooleanResponseForBanList(r);
  assertEquals(result.ok, true);
});

Deno.test('Family D ban-list scan: neutral compound words are NOT flagged', () => {
  // Family D evidence-source vocabulary frequently uses words like
  // "citation", "source", "evidence", "statistic" — none of these are
  // banned, none should trigger false positives.
  const r = validResponse({
    evidenceSpan: { source_provided: 'attached citation to a primary source for the statistical claim' },
  });
  const result = scanFamilyDBooleanResponseForBanList(r);
  assertEquals(result.ok, true);
});
