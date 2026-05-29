/**
 * MCP-SERVER-008-FAMILY-G — Family G doctrine ban-list scan unit tests.
 *
 * Verifies scanFamilyGBooleanResponseForBanList rejects:
 *   - every shared DOCTRINE_BAN_PATTERNS token (winner/loser/truth/verdict/etc.)
 *   - every Family G-specific resolution-verdict token (design §A.3.3 + the
 *     operator Stage 2B ban-list extension: won/lost/defeated/prevailed/
 *     capitulated/ahead/behind + the compound phrases + proved/invalid/wrong/
 *     "settled the truth")
 * in evidenceSpan / modelInfo.serverName / modelInfo.classifierSetVersion,
 * AND that neutral near-miss words (wonderful/lostandfound/aheadofschedule/
 * behindhand) are NOT flagged, AND that null evidence_span values are skipped,
 * AND that a clean resolution-progress evidence_span passes.
 *
 * Per design §A.3.3: a FAIL on the doctrine boundary is the existential
 * Family G risk; this scanner is the runtime backstop.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  scanFamilyGBooleanResponseForBanList,
  FAMILY_G_BAN_PATTERNS,
} from '../lib/familyGBanListScan.ts';
import type { McpBooleanObservationValidatedResponse } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../lib/mcpBooleanObservationSchemaMirror.ts';

function buildResponse(
  rawKey: string,
  evidenceSpanValue: string | null,
  overrides: Partial<{ serverName: string; classifierSetVersion: string }> = {},
): McpBooleanObservationValidatedResponse {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'fixture-node-g-banlist-test',
    checkedRawKeys: [rawKey],
    observations: { [rawKey]: true },
    confidence: { [rawKey]: 'high' },
    evidenceSpan: { [rawKey]: evidenceSpanValue },
    modelInfo: {
      provider: 'mcp',
      serverName: overrides.serverName ?? 'cdiscourse-mcp-server',
      classifierSetVersion: overrides.classifierSetVersion ?? 'family-g-v1',
    },
  };
}

// ── Shared DOCTRINE_BAN_PATTERNS tokens ──

Deno.test('Family G ban-list rejects shared token "winner" in evidenceSpan', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('synthesis_proposed', 'the winner is the pro side'),
  );
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.path, 'evidenceSpan.synthesis_proposed');
});

Deno.test('Family G ban-list rejects shared token "loser" in evidenceSpan', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('concedes_broader_point', 'the conceding side is the loser here'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family G ban-list rejects shared token "truth" in evidenceSpan', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('common_ground_identified', 'this establishes the truth of the matter'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family G ban-list rejects shared token "verdict" in evidenceSpan', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('issue_closed_by_participant', 'the verdict is in'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family G ban-list rejects shared phrase "bad faith" in evidenceSpan', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('move_on_requested', 'this is a bad faith request'),
  );
  assertEquals(result.ok, false);
});

// ── Family G-specific resolution-verdict single tokens (design §A.3.3) ──

Deno.test('Family G ban-list rejects "won" single token in evidenceSpan', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('accepts_settlement_terms', 'the pro side won this exchange'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family G ban-list rejects "lost" single token in evidenceSpan', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('concedes_broader_point', 'they lost the broad claim'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family G ban-list rejects "defeated" single token in evidenceSpan', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('concedes_narrow_point', 'the author is defeated on this point'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family G ban-list rejects "prevailed" single token in evidenceSpan', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('synthesis_proposed', 'the con side prevailed'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family G ban-list rejects "capitulated" single token in evidenceSpan', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('accepts_settlement_terms', 'the author capitulated to the terms'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family G ban-list rejects "ahead" single token in evidenceSpan', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('unresolved_point_isolated', 'the pro side is ahead on the open question'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family G ban-list rejects "behind" single token in evidenceSpan', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('unresolved_point_isolated', 'the con side is behind'),
  );
  assertEquals(result.ok, false);
});

// ── Family G-specific resolution-verdict compound phrases (design §A.3.3) ──

Deno.test('Family G ban-list rejects "settled in favor" phrase in evidenceSpan', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('proposes_settlement_terms', 'the dispute was settled in favor of the pro side'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family G ban-list rejects "settled in your favor" phrase in evidenceSpan (design Fixture E intent)', () => {
  // Design §A.4 Fixture E: the OUTPUT must not echo "settled in favor" /
  // "in your favor". The pattern tolerates an intervening possessive.
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('accepts_settlement_terms', 'the point is settled in your favor'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family G ban-list does NOT flag a benign "in favor of" without "settled" prefix', () => {
  // "argued in favor of the policy" is descriptive, not a settlement verdict;
  // the pattern requires "settled" before "in ... favor".
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('decision_criterion_proposed', 'the author argued in favor of the 5-year criterion'),
  );
  assertEquals(result.ok, true);
});

Deno.test('Family G ban-list rejects "won the argument" phrase in evidenceSpan', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('synthesis_proposed', 'the pro side won the argument'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family G ban-list rejects "conceded the loss" phrase in evidenceSpan (existential)', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('concedes_broader_point', 'the author conceded the loss of the broad claim'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family G ban-list rejects "lost the point" phrase in evidenceSpan', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('concedes_narrow_point', 'the author lost the point on durability'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family G ban-list rejects "lost the argument" phrase in evidenceSpan', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('concedes_broader_point', 'they lost the argument entirely'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family G ban-list rejects "lost the debate" phrase in evidenceSpan', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('issue_closed_by_participant', 'they lost the debate on this issue'),
  );
  assertEquals(result.ok, false);
});

// ── Operator Stage 2B ban-list extension ──

Deno.test('Family G ban-list rejects "settled the truth" phrase in evidenceSpan (operator extension)', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('issue_closed_by_participant', 'this settled the truth of the question'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family G ban-list rejects "proved" single token in evidenceSpan (operator extension)', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('synthesis_proposed', 'the synthesis proved the pro side right'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family G ban-list rejects "invalid" bare token in evidenceSpan (operator extension)', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('concedes_broader_point', 'the broad claim is invalid'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family G ban-list rejects "wrong" single token in evidenceSpan (operator extension)', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('concedes_narrow_point', 'the author was wrong on this point'),
  );
  assertEquals(result.ok, false);
});

// ── serverName + classifierSetVersion scanning ──

Deno.test('Family G ban-list rejects verdict token in modelInfo.serverName', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('synthesis_proposed', null, { serverName: 'cdiscourse-won-server' }),
  );
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.path, 'modelInfo.serverName');
});

Deno.test('Family G ban-list rejects verdict token in modelInfo.classifierSetVersion', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('synthesis_proposed', null, { classifierSetVersion: 'family-lost-v1' }),
  );
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.path, 'modelInfo.classifierSetVersion');
});

// ── Near-miss negatives (operator-required) ──

Deno.test('Family G ban-list does NOT flag neutral near-miss "wonderful" (does not match "won")', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('synthesis_proposed', 'this is a wonderful synthesis of both positions'),
  );
  assertEquals(result.ok, true);
});

Deno.test('Family G ban-list does NOT flag neutral near-miss "lostandfound" (does not match "lost")', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('action_item_proposed', 'check the lostandfound registry for the data'),
  );
  assertEquals(result.ok, true);
});

Deno.test('Family G ban-list does NOT flag neutral near-miss "aheadofschedule" (does not match "ahead")', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('action_item_proposed', 'we are aheadofschedule on the review'),
  );
  assertEquals(result.ok, true);
});

Deno.test('Family G ban-list does NOT flag neutral near-miss "behindhand" (does not match "behind")', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('move_on_requested', 'a behindhand response is still useful'),
  );
  assertEquals(result.ok, true);
});

Deno.test('Family G ban-list does NOT flag "invalidates" (does not match bare "invalid")', () => {
  // 'invalid' followed by 'a' is not a token boundary, so 'invalidates'
  // must NOT trip the bare-'invalid' pattern.
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse('common_ground_identified', 'the new data invalidates an earlier assumption'),
  );
  assertEquals(result.ok, true);
});

// ── null evidence_span + clean output ──

Deno.test('Family G ban-list skips null evidenceSpan values', () => {
  const result = scanFamilyGBooleanResponseForBanList(buildResponse('synthesis_proposed', null));
  assertEquals(result.ok, true);
});

Deno.test('Family G ban-list passes a clean resolution-progress evidenceSpan (anchors relinquishment, no verdict)', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse(
      'concedes_broader_point',
      'I withdraw the broad claim and stand on the narrow scope only',
    ),
  );
  assertEquals(result.ok, true);
});

Deno.test('Family G ban-list passes a clean synthesis evidenceSpan', () => {
  const result = scanFamilyGBooleanResponseForBanList(
    buildResponse(
      'synthesis_proposed',
      'both are true: EVs cut urban tailpipe pollution AND battery production needs cleaner grids',
    ),
  );
  assertEquals(result.ok, true);
});

// ── FAMILY_G_BAN_PATTERNS contents (design §A.3.3 + operator extension) ──

Deno.test('FAMILY_G_BAN_PATTERNS contains all 11 design §A.3.3 resolution-verdict tokens + 4 operator-extension tokens', () => {
  const targetTokens = [
    // design §A.3.3 single tokens (7)
    'won',
    'lost',
    'defeated',
    'prevailed',
    'capitulated',
    'ahead',
    'behind',
    // design §A.3.3 compound phrases (4)
    'settled in favor',
    'won the argument',
    'conceded the loss',
    'lost the point',
    // operator Stage 2B extension (4)
    'settled the truth',
    'proved',
    'invalid',
    'wrong',
  ];
  for (const token of targetTokens) {
    const pattern = FAMILY_G_BAN_PATTERNS.find((p) => p.test(`prefix ${token} suffix`));
    if (!pattern) {
      throw new Error(`FAMILY_G_BAN_PATTERNS missing pattern for token: '${token}'`);
    }
  }
  // 15 patterns total (11 design + 4 operator extension).
  assertEquals(FAMILY_G_BAN_PATTERNS.length, 15);
});

Deno.test('FAMILY_G_BAN_PATTERNS "lost the" phrase covers point AND argument AND debate', () => {
  const lostThePattern = FAMILY_G_BAN_PATTERNS.find((p) => p.test('they lost the point'));
  if (!lostThePattern) throw new Error('missing lost-the-point pattern');
  assertEquals(lostThePattern.test('they lost the argument'), true);
  assertEquals(lostThePattern.test('they lost the debate'), true);
  // 'lost the case' is NOT in the enumerated set, so it should not match the
  // phrase pattern — but the bare 'lost' single-token pattern catches it.
  const bareLost = FAMILY_G_BAN_PATTERNS.find((p) => p.test('prefix lost suffix'));
  if (!bareLost) throw new Error('missing bare lost pattern');
});
