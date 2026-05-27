/**
 * MCP-SERVER-003-FAMILY-B — scanFamilyBBooleanResponseForBanList unit tests.
 *
 * Covers every banned-token shape against:
 *   - evidenceSpan strings (any Family B rawKey)
 *   - modelInfo.serverName
 *   - modelInfo.classifierSetVersion
 *
 * The patterns themselves are tested in upstream `doctrineBanList.test.ts`;
 * this file exercises the SCAN logic and field coverage against Family B
 * fixture shapes (14 keys, family-b-v1).
 */
import { assertEquals } from 'std/assert/mod.ts';
import { scanFamilyBBooleanResponseForBanList } from '../lib/familyBBanListScan.ts';
import type { McpBooleanObservationValidatedResponse } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../lib/mcpBooleanObservationSchemaMirror.ts';

function validResponse(
  overrides: Partial<McpBooleanObservationValidatedResponse> = {},
): McpBooleanObservationValidatedResponse {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'node-1',
    checkedRawKeys: ['disagreement_present'],
    observations: { disagreement_present: true },
    confidence: { disagreement_present: 'high' },
    evidenceSpan: { disagreement_present: 'clean evidence text' },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-b-v1',
    },
    ...overrides,
  };
}

Deno.test('Family B ban-list scan: clean response returns ok=true', () => {
  const result = scanFamilyBBooleanResponseForBanList(validResponse());
  assertEquals(result.ok, true);
});

Deno.test('Family B ban-list scan: evidenceSpan with "winner" fails', () => {
  const r = validResponse({
    evidenceSpan: { disagreement_present: 'declared the winner of round two' },
  });
  const result = scanFamilyBBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'evidenceSpan.disagreement_present');
  }
});

Deno.test('Family B ban-list scan: evidenceSpan with "loser" fails', () => {
  const r = validResponse({
    evidenceSpan: { disagreement_present: 'this is the loser argument' },
  });
  const result = scanFamilyBBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family B ban-list scan: evidenceSpan with "verdict" fails', () => {
  const r = validResponse({
    evidenceSpan: { disagreement_present: 'the verdict is in' },
  });
  const result = scanFamilyBBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family B ban-list scan: evidenceSpan with "truth" fails', () => {
  const r = validResponse({
    evidenceSpan: { disagreement_present: 'the underlying truth here' },
  });
  const result = scanFamilyBBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family B ban-list scan: evidenceSpan with "liar" fails', () => {
  const r = validResponse({
    evidenceSpan: { disagreement_present: 'the speaker is a liar' },
  });
  const result = scanFamilyBBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family B ban-list scan: evidenceSpan with "bad faith" fails', () => {
  const r = validResponse({
    evidenceSpan: { disagreement_present: 'arguing in bad faith here' },
  });
  const result = scanFamilyBBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family B ban-list scan: evidenceSpan with "extremist" fails', () => {
  const r = validResponse({
    evidenceSpan: { disagreement_present: 'this is an extremist position' },
  });
  const result = scanFamilyBBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family B ban-list scan: evidenceSpan with "manipulative" fails', () => {
  const r = validResponse({
    evidenceSpan: { disagreement_present: 'a manipulative framing' },
  });
  const result = scanFamilyBBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family B ban-list scan: evidenceSpan with "propagandist" fails (doctrine-stress)', () => {
  // The doctrine-stress fixture (per design §6) tests this specific token.
  const r = validResponse({
    evidenceSpan: { disagreement_present: 'anyone who says otherwise is a propagandist' },
  });
  const result = scanFamilyBBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family B ban-list scan: evidenceSpan with "correct" fails (value-weighting risk)', () => {
  // The disputes_value_weighting doctrine guard forbids "correct value" framing.
  // The ban-list catches `correct` as a banned token.
  const r = validResponse({
    evidenceSpan: { disagreement_present: 'security is the correct value here' },
  });
  const result = scanFamilyBBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('Family B ban-list scan: modelInfo.serverName with banned token fails', () => {
  const r = validResponse({
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-winner-server',
      classifierSetVersion: 'family-b-v1',
    },
  });
  const result = scanFamilyBBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'modelInfo.serverName');
  }
});

Deno.test('Family B ban-list scan: modelInfo.classifierSetVersion with banned token fails', () => {
  const r = validResponse({
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-b-verdict-v1',
    },
  });
  const result = scanFamilyBBooleanResponseForBanList(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'modelInfo.classifierSetVersion');
  }
});

Deno.test('Family B ban-list scan: null evidenceSpan values are skipped (no false positive)', () => {
  const r = validResponse({
    checkedRawKeys: ['disagreement_present', 'disputes_definition'],
    observations: { disagreement_present: true, disputes_definition: false },
    confidence: { disagreement_present: 'high', disputes_definition: 'medium' },
    evidenceSpan: { disagreement_present: 'clean text', disputes_definition: null },
  });
  const result = scanFamilyBBooleanResponseForBanList(r);
  assertEquals(result.ok, true);
});

Deno.test('Family B ban-list scan: neutral compound words are NOT flagged', () => {
  // "playable" not banned; "hot" not banned alone.
  const r = validResponse({
    evidenceSpan: { disagreement_present: 'a playable_hot_take move' },
  });
  const result = scanFamilyBBooleanResponseForBanList(r);
  assertEquals(result.ok, true);
});
