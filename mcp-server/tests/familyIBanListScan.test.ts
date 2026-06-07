/**
 * MCP-SERVER-010-FAMILY-I — Family I doctrine ban-list scan unit tests.
 *
 * Verifies scanFamilyIBooleanResponseForBanList rejects:
 *   - every shared DOCTRINE_BAN_PATTERNS token (winner/loser/truth/verdict/etc.)
 *   - every Family I-specific topology-verdict token (design §A.3.3:
 *     off-topic / derailing / evasive / rehashing / repetitive + the 3
 *     compound phrases)
 * in evidenceSpan / modelInfo.serverName / modelInfo.classifierSetVersion,
 * AND that neutral near-miss words (topical, circle) are NOT flagged, AND
 * that null evidence_span values are skipped, AND that a clean
 * thread-topology evidence_span passes.
 *
 * Per design §A.3.3: a FAIL on the doctrine boundary is the existential
 * Family I risk; this scanner is the runtime backstop.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  scanFamilyIBooleanResponseForBanList,
  FAMILY_I_BAN_PATTERNS,
} from '../lib/familyIBanListScan.ts';
import type { McpBooleanObservationValidatedResponse } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../lib/mcpBooleanObservationSchemaMirror.ts';

function buildResponse(
  rawKey: string,
  evidenceSpanValue: string | null,
  overrides: Partial<{ serverName: string; classifierSetVersion: string }> = {},
): McpBooleanObservationValidatedResponse {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'fixture-node-i-banlist-test',
    checkedRawKeys: [rawKey],
    observations: { [rawKey]: true },
    confidence: { [rawKey]: 'high' },
    evidenceSpan: { [rawKey]: evidenceSpanValue },
    modelInfo: {
      provider: 'mcp',
      serverName: overrides.serverName ?? 'cdiscourse-mcp-server',
      classifierSetVersion: overrides.classifierSetVersion ?? 'family-i-v1',
    },
  };
}

// ── Shared DOCTRINE_BAN_PATTERNS tokens ──

Deno.test('Family I ban-list rejects shared token "winner" in evidenceSpan', () => {
  const result = scanFamilyIBooleanResponseForBanList(
    buildResponse('compares_options', 'the winner is option A'),
  );
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.path, 'evidenceSpan.compares_options');
});

Deno.test('Family I ban-list rejects shared token "loser" in evidenceSpan', () => {
  const result = scanFamilyIBooleanResponseForBanList(
    buildResponse('compares_options', 'option B is the loser here'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family I ban-list rejects shared token "truth" in evidenceSpan', () => {
  const result = scanFamilyIBooleanResponseForBanList(
    buildResponse('references_external_context', 'the article establishes the truth'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family I ban-list rejects shared token "verdict" in evidenceSpan', () => {
  const result = scanFamilyIBooleanResponseForBanList(
    buildResponse('introduces_new_issue', 'the verdict is in on the new topic'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family I ban-list rejects shared phrase "bad faith" in evidenceSpan', () => {
  const result = scanFamilyIBooleanResponseForBanList(
    buildResponse('returns_to_prior_issue', 'this is a bad faith return'),
  );
  assertEquals(result.ok, false);
});

// ── Family I-specific topology-verdict single tokens (design §A.3.3) ──

Deno.test('Family I ban-list rejects "off-topic" single token in evidenceSpan', () => {
  const result = scanFamilyIBooleanResponseForBanList(
    buildResponse('introduces_new_issue', 'the move is off-topic'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family I ban-list rejects "offtopic" (no separator) in evidenceSpan', () => {
  const result = scanFamilyIBooleanResponseForBanList(
    buildResponse('introduces_new_issue', 'this reads as offtopic'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family I ban-list rejects "derail" single token in evidenceSpan', () => {
  const result = scanFamilyIBooleanResponseForBanList(
    buildResponse('introduces_new_issue', 'this is an attempt to derail'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family I ban-list rejects "derailing" (verb inflection) in evidenceSpan', () => {
  const result = scanFamilyIBooleanResponseForBanList(
    buildResponse('introduces_new_issue', 'the speaker is derailing the thread'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family I ban-list rejects "evasive" single token in evidenceSpan', () => {
  const result = scanFamilyIBooleanResponseForBanList(
    buildResponse('introduces_new_issue', 'the move is evasive'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family I ban-list rejects "evading" (verb inflection) in evidenceSpan', () => {
  const result = scanFamilyIBooleanResponseForBanList(
    buildResponse('introduces_new_issue', 'the speaker is evading the question'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family I ban-list rejects "rehashing" in evidenceSpan (returns_to_prior_issue drift)', () => {
  const result = scanFamilyIBooleanResponseForBanList(
    buildResponse('returns_to_prior_issue', 'the speaker is rehashing the old point'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family I ban-list rejects "rehash" single token in evidenceSpan', () => {
  const result = scanFamilyIBooleanResponseForBanList(
    buildResponse('returns_to_prior_issue', 'a pointless rehash of the parked topic'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family I ban-list rejects "repetitive" single token in evidenceSpan', () => {
  const result = scanFamilyIBooleanResponseForBanList(
    buildResponse('returns_to_prior_issue', 'this is repetitive'),
  );
  assertEquals(result.ok, false);
});

// ── Family I-specific topology-verdict compound phrases (design §A.3.3) ──

Deno.test('Family I ban-list rejects "going in circles" phrase in evidenceSpan', () => {
  const result = scanFamilyIBooleanResponseForBanList(
    buildResponse('returns_to_prior_issue', 'the debate is going in circles'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family I ban-list rejects "changing the subject" phrase in evidenceSpan', () => {
  const result = scanFamilyIBooleanResponseForBanList(
    buildResponse('introduces_new_issue', 'the speaker is changing the subject'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family I ban-list rejects "beating a dead horse" phrase in evidenceSpan', () => {
  const result = scanFamilyIBooleanResponseForBanList(
    buildResponse('returns_to_prior_issue', 'this is just beating a dead horse'),
  );
  assertEquals(result.ok, false);
});

// ── serverName + classifierSetVersion scanning ──

Deno.test('Family I ban-list rejects verdict token in modelInfo.serverName', () => {
  const result = scanFamilyIBooleanResponseForBanList(
    buildResponse('introduces_new_issue', null, { serverName: 'cdiscourse-off-topic-server' }),
  );
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.path, 'modelInfo.serverName');
});

Deno.test('Family I ban-list rejects verdict token in modelInfo.classifierSetVersion', () => {
  const result = scanFamilyIBooleanResponseForBanList(
    buildResponse('introduces_new_issue', null, { classifierSetVersion: 'family-derail-v1' }),
  );
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.path, 'modelInfo.classifierSetVersion');
});

// ── Near-miss negatives (operator-required) ──

Deno.test('Family I ban-list does NOT flag neutral near-miss "topical" (does not match off-topic)', () => {
  const result = scanFamilyIBooleanResponseForBanList(
    buildResponse('introduces_new_issue', 'the move opens a new topical area about museum funding'),
  );
  assertEquals(result.ok, true);
});

Deno.test('Family I ban-list does NOT flag bare "circle" (does not match "going in circles" phrase)', () => {
  const result = scanFamilyIBooleanResponseForBanList(
    buildResponse('introduces_new_issue', 'the move draws a circle around the funding question'),
  );
  assertEquals(result.ok, true);
});

Deno.test('Family I ban-list does NOT flag "repetition" (suffix differs from "repetitive")', () => {
  // 'repetition' ends in '-tion' not '-tive'; the strict-boundary 'repetitive'
  // pattern does NOT match 'repetition'. Documented boundary trade-off.
  const result = scanFamilyIBooleanResponseForBanList(
    buildResponse('returns_to_prior_issue', 'the move notes a repetition in the cited data'),
  );
  assertEquals(result.ok, true);
});

// ── null evidence_span + clean output ──

Deno.test('Family I ban-list skips null evidenceSpan values', () => {
  const result = scanFamilyIBooleanResponseForBanList(buildResponse('introduces_new_issue', null));
  assertEquals(result.ok, true);
});

Deno.test('Family I ban-list passes a clean thread-topology evidenceSpan (anchors new topic, no verdict)', () => {
  const result = scanFamilyIBooleanResponseForBanList(
    buildResponse('introduces_new_issue', "Worth thinking about museum funding too — that's a different question"),
  );
  assertEquals(result.ok, true);
});

Deno.test('Family I ban-list passes a clean returns_to_prior_issue evidenceSpan (anchors re-engagement)', () => {
  const result = scanFamilyIBooleanResponseForBanList(
    buildResponse('returns_to_prior_issue', 'Coming back to the library staffing question — the new union-contract data does support X'),
  );
  assertEquals(result.ok, true);
});

Deno.test('Family I ban-list passes a clean compares_options evidenceSpan (anchors compared options)', () => {
  const result = scanFamilyIBooleanResponseForBanList(
    buildResponse('compares_options', 'the tax is simpler and more predictable; cap-and-trade has better political durability'),
  );
  assertEquals(result.ok, true);
});

// ── FAMILY_I_BAN_PATTERNS contents (design §A.3.3) ──

Deno.test('FAMILY_I_BAN_PATTERNS contains all 8 design §A.3.3 topology-verdict patterns (5 single + 3 phrase)', () => {
  const targetTokens = [
    // design §A.3.3 single tokens (5)
    'off-topic',
    'derailing',
    'evasive',
    'rehashing',
    'repetitive',
    // design §A.3.3 compound phrases (3)
    'going in circles',
    'changing the subject',
    'beating a dead horse',
  ];
  for (const token of targetTokens) {
    const pattern = FAMILY_I_BAN_PATTERNS.find((p) => p.test(`prefix ${token} suffix`));
    if (!pattern) {
      throw new Error(`FAMILY_I_BAN_PATTERNS missing pattern for token: '${token}'`);
    }
  }
  // 8 patterns total (5 single + 3 phrase) — the smallest family-local list.
  assertEquals(FAMILY_I_BAN_PATTERNS.length, 8);
});

Deno.test('FAMILY_I_BAN_PATTERNS is frozen (readonly RegExp[])', () => {
  assertEquals(Object.isFrozen(FAMILY_I_BAN_PATTERNS), true);
});

Deno.test('FAMILY_I_BAN_PATTERNS phrase forms accept underscore + hyphen separators', () => {
  const phrase = FAMILY_I_BAN_PATTERNS.find((p) => p.test('going in circles'));
  if (!phrase) throw new Error('missing going-in-circles phrase pattern');
  assertEquals(phrase.test('going_in_circles'), true);
  assertEquals(phrase.test('going-in-circles'), true);
});
