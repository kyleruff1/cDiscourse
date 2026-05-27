/**
 * MCP-SERVER-002 — scanFamilyABooleanResponseForBanList unit tests.
 *
 * Covers every banned-token shape against:
 *   - evidenceSpan strings (any rawKey)
 *   - modelInfo.serverName
 *   - modelInfo.classifierSetVersion
 *
 * The patterns themselves are tested in upstream `doctrineBanList.test.ts`;
 * this file exercises the SCAN logic and field coverage.
 */
import { assertEquals } from 'std/assert/mod.ts';
import { scanFamilyABooleanResponseForBanList } from '../lib/familyABanListScan.ts';
import type { McpBooleanObservationValidatedResponse } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../lib/mcpBooleanObservationSchemaMirror.ts';

function validResponse(
  overrides: Partial<McpBooleanObservationValidatedResponse> = {},
): McpBooleanObservationValidatedResponse {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'node-1',
    checkedRawKeys: ['supports_parent'],
    observations: { supports_parent: true },
    confidence: { supports_parent: 'high' },
    evidenceSpan: { supports_parent: 'clean evidence text' },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-a-v1',
    },
    ...overrides,
  };
}

Deno.test('ban-list scan: clean response returns ok=true', () => {
  const result = scanFamilyABooleanResponseForBanList(validResponse());
  assertEquals(result.ok, true);
});

Deno.test('ban-list scan: evidenceSpan with "winner" fails', () => {
  const r = validResponse({
    evidenceSpan: { supports_parent: 'declared the winner of round two' },
  });
  const result = scanFamilyABooleanResponseForBanList(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'evidenceSpan.supports_parent');
  }
});

Deno.test('ban-list scan: evidenceSpan with "loser" fails', () => {
  const r = validResponse({
    evidenceSpan: { supports_parent: 'this is the loser argument' },
  });
  const result = scanFamilyABooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('ban-list scan: evidenceSpan with "verdict" fails', () => {
  const r = validResponse({
    evidenceSpan: { supports_parent: 'the verdict is in' },
  });
  const result = scanFamilyABooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('ban-list scan: evidenceSpan with "truth" fails', () => {
  const r = validResponse({
    evidenceSpan: { supports_parent: 'the underlying truth here' },
  });
  const result = scanFamilyABooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('ban-list scan: evidenceSpan with "liar" fails', () => {
  const r = validResponse({
    evidenceSpan: { supports_parent: 'the speaker is a liar' },
  });
  const result = scanFamilyABooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('ban-list scan: evidenceSpan with "bad faith" fails', () => {
  const r = validResponse({
    evidenceSpan: { supports_parent: 'arguing in bad faith here' },
  });
  const result = scanFamilyABooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('ban-list scan: evidenceSpan with "extremist" fails', () => {
  const r = validResponse({
    evidenceSpan: { supports_parent: 'this is an extremist position' },
  });
  const result = scanFamilyABooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('ban-list scan: evidenceSpan with "manipulative" fails', () => {
  const r = validResponse({
    evidenceSpan: { supports_parent: 'a manipulative framing' },
  });
  const result = scanFamilyABooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('ban-list scan: modelInfo.serverName with banned token fails', () => {
  const r = validResponse({
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-winner-server',
      classifierSetVersion: 'family-a-v1',
    },
  });
  const result = scanFamilyABooleanResponseForBanList(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'modelInfo.serverName');
  }
});

Deno.test('ban-list scan: modelInfo.classifierSetVersion with banned token fails', () => {
  const r = validResponse({
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-a-verdict-v1',
    },
  });
  const result = scanFamilyABooleanResponseForBanList(r);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'modelInfo.classifierSetVersion');
  }
});

Deno.test('ban-list scan: null evidenceSpan values are skipped (no false positive)', () => {
  const r = validResponse({
    checkedRawKeys: ['supports_parent', 'challenges_parent'],
    observations: { supports_parent: true, challenges_parent: false },
    confidence: { supports_parent: 'high', challenges_parent: 'medium' },
    evidenceSpan: { supports_parent: 'clean text', challenges_parent: null },
  });
  const result = scanFamilyABooleanResponseForBanList(r);
  assertEquals(result.ok, true);
});

Deno.test('ban-list scan: detects "proof of" two-word phrase', () => {
  const r = validResponse({
    evidenceSpan: { supports_parent: 'this is proof of the claim' },
  });
  const result = scanFamilyABooleanResponseForBanList(r);
  assertEquals(result.ok, false);
});

Deno.test('ban-list scan: neutral compound words are NOT flagged', () => {
  // "hottake" contains "hot" but no banned token. "playable" not banned.
  const r = validResponse({
    evidenceSpan: { supports_parent: 'a playable_hot_take move' },
  });
  const result = scanFamilyABooleanResponseForBanList(r);
  assertEquals(result.ok, true);
});
