/**
 * MCP-SERVER-011-FAMILY-J — Family J doctrine ban-list scan unit tests.
 *
 * Verifies scanFamilyJBooleanResponseForBanList rejects:
 *   - every shared DOCTRINE_BAN_PATTERNS token (winner/loser/truth/verdict/etc.)
 *   - every Family J-specific person/intent token (design §6: troll / bot /
 *     astroturfer / toxic / hostile / abusive / aggressive / uncivil /
 *     incivility / gullible / unhinged + the 7 compound phrases)
 * in evidenceSpan / modelInfo.serverName / modelInfo.classifierSetVersion,
 * AND that neutral near-miss words (robot, toxicity) are NOT flagged, AND
 * that null evidence_span values are skipped, AND that a clean structural
 * person-shift evidence_span (anchors wording, no slur) passes.
 *
 * Per design §6: a FAIL on the doctrine boundary is the existential Family J
 * risk (this is the MOST sensitive family); this scanner is the runtime
 * backstop. The verbatim-quote tension is the binding test design: a clean
 * structural anchor passes while a slur echo is rejected.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  scanFamilyJBooleanResponseForBanList,
  FAMILY_J_BAN_PATTERNS,
} from '../lib/familyJBanListScan.ts';
import type { McpBooleanObservationValidatedResponse } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../lib/mcpBooleanObservationSchemaMirror.ts';

function buildResponse(
  rawKey: string,
  evidenceSpanValue: string | null,
  overrides: Partial<{ serverName: string; classifierSetVersion: string }> = {},
): McpBooleanObservationValidatedResponse {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'fixture-node-j-banlist-test',
    checkedRawKeys: [rawKey],
    observations: { [rawKey]: true },
    confidence: { [rawKey]: 'high' },
    evidenceSpan: { [rawKey]: evidenceSpanValue },
    modelInfo: {
      provider: 'mcp',
      serverName: overrides.serverName ?? 'cdiscourse-mcp-server',
      classifierSetVersion: overrides.classifierSetVersion ?? 'family-j-v1',
    },
  };
}

// ── Shared DOCTRINE_BAN_PATTERNS tokens ──

Deno.test('Family J ban-list rejects shared token "winner" in evidenceSpan', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('shifts_to_person_or_intent', 'the winner of this exchange'),
  );
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.path, 'evidenceSpan.shifts_to_person_or_intent');
});

Deno.test('Family J ban-list rejects shared token "loser" in evidenceSpan', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('needs_pre_send_pause', 'calling the parent poster a loser'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family J ban-list rejects shared token "truth" in evidenceSpan', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('uses_satire_as_evidence', 'the satire establishes the truth'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family J ban-list rejects shared token "verdict" in evidenceSpan', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('shifts_to_person_or_intent', 'the verdict on the author'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family J ban-list rejects shared phrase "bad faith" in evidenceSpan', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('shifts_to_person_or_intent', 'this is a bad faith move'),
  );
  assertEquals(result.ok, false);
});

// ── Family J-specific person/intent single tokens (design §6) ──

Deno.test('Family J ban-list rejects "troll" single token in evidenceSpan', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('shifts_to_person_or_intent', 'you are such a troll'),
  );
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.path, 'evidenceSpan.shifts_to_person_or_intent');
});

Deno.test('Family J ban-list rejects "bot" single token in evidenceSpan', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('shifts_to_person_or_intent', 'the author is a bot'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family J ban-list rejects "astroturfer" (astroturf inflection) in evidenceSpan', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('uses_popularity_as_evidence', 'this reads like an astroturfer campaign'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family J ban-list rejects "toxic" single token in evidenceSpan', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('contains_unplayable_insult_only', 'the move is toxic'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family J ban-list rejects "hostile" single token in evidenceSpan', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('needs_pre_send_pause', 'the author is hostile'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family J ban-list rejects "abusive" (abus inflection) in evidenceSpan', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('contains_unplayable_insult_only', 'the reply is abusive'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family J ban-list rejects "abuse" (abus inflection) in evidenceSpan', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('contains_unplayable_insult_only', 'this is verbal abuse'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family J ban-list rejects "aggressive" single token in evidenceSpan', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('needs_pre_send_pause', 'the author is aggressive'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family J ban-list rejects "uncivil" single token in evidenceSpan', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('needs_pre_send_pause', 'this is uncivil'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family J ban-list rejects "incivility" single token in evidenceSpan', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('needs_pre_send_pause', 'a pattern of incivility'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family J ban-list rejects "gullible" single token in evidenceSpan', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('uses_satire_as_evidence', 'the author is gullible'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family J ban-list rejects "unhinged" single token in evidenceSpan', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('needs_pre_send_pause', 'the author is unhinged'),
  );
  assertEquals(result.ok, false);
});

// ── Family J-specific compound phrases (design §6) ──

Deno.test('Family J ban-list rejects "ad hominem" phrase in evidenceSpan', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('shifts_to_person_or_intent', 'this is an ad hominem'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family J ban-list rejects "ad-hominem" (hyphen separator) in evidenceSpan', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('shifts_to_person_or_intent', 'an ad-hominem attack'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family J ban-list rejects "personal attack" phrase in evidenceSpan', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('shifts_to_person_or_intent', 'this is a personal attack'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family J ban-list rejects "personal attacks" (plural inflection) in evidenceSpan', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('shifts_to_person_or_intent', 'a string of personal attacks'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family J ban-list rejects "attacking the person" phrase in evidenceSpan', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('shifts_to_person_or_intent', 'the move is attacking the person'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family J ban-list rejects "bad actor" phrase in evidenceSpan', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('shifts_to_person_or_intent', 'treats the poster as a bad actor'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family J ban-list rejects "name calling" phrase in evidenceSpan', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('contains_unplayable_insult_only', 'this is just name calling'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family J ban-list rejects "fake news" phrase in evidenceSpan', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('uses_satire_as_evidence', 'the satire is fake news'),
  );
  assertEquals(result.ok, false);
});

Deno.test('Family J ban-list rejects "losing it" phrase in evidenceSpan', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('needs_pre_send_pause', 'the author is losing it'),
  );
  assertEquals(result.ok, false);
});

// ── serverName + classifierSetVersion scanning ──

Deno.test('Family J ban-list rejects person token in modelInfo.serverName', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('shifts_to_person_or_intent', null, { serverName: 'cdiscourse-troll-server' }),
  );
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.path, 'modelInfo.serverName');
});

Deno.test('Family J ban-list rejects person token in modelInfo.classifierSetVersion', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('shifts_to_person_or_intent', null, { classifierSetVersion: 'family-toxic-v1' }),
  );
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.path, 'modelInfo.classifierSetVersion');
});

// ── Near-miss negatives (operator-required) ──

Deno.test('Family J ban-list does NOT flag neutral near-miss "robot" (does not match bot)', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('shifts_to_person_or_intent', 'the claim references a robot vacuum review'),
  );
  assertEquals(result.ok, true);
});

Deno.test('Family J ban-list does NOT flag "toxicity" (suffix differs from strict "toxic")', () => {
  // 'toxicity' continues into alpha after 'toxic'; the strict-boundary 'toxic'
  // pattern does NOT match 'toxicity'. Documented boundary trade-off (mirrors
  // H's 'weakly' not matching 'weak').
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('uses_popularity_as_evidence', 'the move cites soil toxicity data'),
  );
  assertEquals(result.ok, true);
});

Deno.test('Family J ban-list does NOT flag a benign word containing the "bot" substring inside alpha boundaries', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('shifts_to_person_or_intent', 'the move quotes a sabotage report'),
  );
  assertEquals(result.ok, true);
});

// ── null evidence_span + clean output ──

Deno.test('Family J ban-list skips null evidenceSpan values', () => {
  const result = scanFamilyJBooleanResponseForBanList(buildResponse('shifts_to_person_or_intent', null));
  assertEquals(result.ok, true);
});

Deno.test('Family J ban-list passes a clean structural person-shift evidenceSpan (anchors wording, no slur)', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('shifts_to_person_or_intent', 'because you work for an EV company'),
  );
  assertEquals(result.ok, true);
});

Deno.test('Family J ban-list passes a clean popularity evidenceSpan (anchors popularity wording)', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('uses_popularity_as_evidence', 'Everyone knows this is the case'),
  );
  assertEquals(result.ok, true);
});

Deno.test('Family J ban-list passes a clean satire evidenceSpan (anchors satire-as-fact citation)', () => {
  const result = scanFamilyJBooleanResponseForBanList(
    buildResponse('uses_satire_as_evidence', 'See, The Onion confirmed this last week'),
  );
  assertEquals(result.ok, true);
});

// ── FAMILY_J_BAN_PATTERNS contents (design §6) ──

Deno.test('FAMILY_J_BAN_PATTERNS contains all 18 design §6 person/intent patterns (11 single + 7 phrase)', () => {
  const targetTokens = [
    // design §6 single tokens (11)
    'troll',
    'bot',
    'astroturfer',
    'toxic',
    'hostile',
    'abusive',
    'aggressive',
    'uncivil',
    'incivility',
    'gullible',
    'unhinged',
    // design §6 compound phrases (7)
    'ad hominem',
    'personal attack',
    'attacking the person',
    'bad actor',
    'name calling',
    'fake news',
    'losing it',
  ];
  for (const token of targetTokens) {
    const pattern = FAMILY_J_BAN_PATTERNS.find((p) => p.test(`prefix ${token} suffix`));
    if (!pattern) {
      throw new Error(`FAMILY_J_BAN_PATTERNS missing pattern for token: '${token}'`);
    }
  }
  // 18 patterns total (11 single + 7 phrase) — the LARGEST family-local list.
  assertEquals(FAMILY_J_BAN_PATTERNS.length, 18);
});

Deno.test('FAMILY_J_BAN_PATTERNS is frozen (readonly RegExp[])', () => {
  assertEquals(Object.isFrozen(FAMILY_J_BAN_PATTERNS), true);
});

Deno.test('FAMILY_J_BAN_PATTERNS phrase forms accept underscore + hyphen separators', () => {
  const phrase = FAMILY_J_BAN_PATTERNS.find((p) => p.test('name calling'));
  if (!phrase) throw new Error('missing name-calling phrase pattern');
  assertEquals(phrase.test('name_calling'), true);
  assertEquals(phrase.test('name-calling'), true);
});
