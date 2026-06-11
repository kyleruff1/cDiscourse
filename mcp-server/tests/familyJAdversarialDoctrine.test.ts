/**
 * MCP-SERVER-011-FAMILY-J — Adversarial sensitive_composer doctrine tests
 * (design §11 D4 BINDING; modeled on familyHAdversarialDoctrine.test.ts depth).
 *
 * This file is dedicated to the design §11 binding requirement: the canonical
 * per-key fixtures + THE EXISTENTIAL person-shift-adversarial fixture (slur in
 * the INPUT, clean OUTPUT) + the no-sensitive baseline + the canonical-response
 * fixture + the ban-list-violation fixture + the malformed-response fixture,
 * AND the runtime ban-list scanner must reject every person/intent token
 * (troll / bot / toxic / hostile / abusive / aggressive / etc. + the 7 compound
 * phrases) that the model might emit.
 *
 * THE EXISTENTIAL (design §6 / §11): the person-shift-adversarial fixture's
 * INPUT contains a slur ("you're such a troll"/"you're toxic"); the expected
 * clean OUTPUT evidence_span anchors the STRUCTURAL focus-shift wording WITHOUT
 * echoing the slur. A FAIL here is HALT + revert. This is the J-equivalent of
 * H's Fixture E (the axis-partner existential).
 *
 * Fixture matrix (design §4):
 *   - A (mandatory): canonical person-shift — addresses the poster's motive;
 *     no slur in the input.
 *   - B (mandatory; THE EXISTENTIAL for shifts_to_person_or_intent): input
 *     contains "troll"/"toxic". OUTPUT must not echo. A FAIL HERE IS HALT + REVERT.
 *   - C (mandatory): insult-only (no playable claim).
 *   - D (mandatory): pause (reactive/escalatory markers).
 *   - E (mandatory): popularity (§3 anti-amplification).
 *   - F (mandatory): satire (satire cited as fact).
 *   - G (supplementary; all-negative): no-sensitive baseline — stays on the
 *     substantive claim; no over-fire.
 *   - H (mandatory; ban-list-violation response fixture): dirty evidence_span;
 *     the scan MUST reject.
 *   - I (mandatory; canonical-response): doctrine-clean; smoke Checks 40+41 load this.
 *   - J (mandatory; malformed-response): schema violation; validator MUST reject.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  scanFamilyJBooleanResponseForBanList,
  FAMILY_J_BAN_PATTERNS,
} from '../lib/familyJBanListScan.ts';
import type { McpBooleanObservationValidatedResponse } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { validateMcpBooleanObservationResponse } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { FAMILY_J_PROMPT_ENTRIES } from '../lib/familyJKeys.ts';
import { loadFixtureFamilyJPacket } from '../lib/familyJFixtureProvider.ts';

const FIXTURE_DIR = new URL('../fixtures/', import.meta.url);

async function loadFixture(name: string): Promise<unknown> {
  const url = new URL(name, FIXTURE_DIR);
  const text = await Deno.readTextFile(url);
  return JSON.parse(text);
}

function buildResponse(
  rawKey: string,
  evidenceSpanValue: string | null,
): McpBooleanObservationValidatedResponse {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'fixture-node-j-doctrine-test',
    checkedRawKeys: [rawKey],
    observations: { [rawKey]: true },
    confidence: { [rawKey]: 'high' },
    evidenceSpan: { [rawKey]: evidenceSpanValue },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-j-v1',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Design §4 fixtures: canonical + THE EXISTENTIAL + per-key + baseline
// ─────────────────────────────────────────────────────────────────────────

Deno.test('design §4.A (mandatory): canonical person-shift fixture exists, parseable, targets shifts_to_person_or_intent', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-j-person-shift-request.json',
  );
  if (typeof fixture !== 'object' || fixture === null) {
    throw new Error('person-shift fixture not parseable as object');
  }
  const wrapper = fixture as { tool: string; input: Record<string, unknown> };
  assertEquals(wrapper.tool, 'classify_argument_boolean_observations');
  const rawKeys = wrapper.input.requestedRawKeys as string[];
  if (!rawKeys.includes('shifts_to_person_or_intent')) {
    throw new Error('person-shift fixture should request shifts_to_person_or_intent');
  }
  const families = wrapper.input.requestedFamilies as string[];
  if (!families.includes('sensitive_composer')) {
    throw new Error('person-shift fixture should request sensitive_composer family');
  }
});

Deno.test('design §4.A: canonical person-shift input addresses the poster motive (because you work for)', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-j-person-shift-request.json',
  )) as { input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  if (!/because you work for/i.test(moveText)) {
    throw new Error('person-shift fixture should address the poster motive. Got: ' + moveText);
  }
});

Deno.test('design §4.A: canonical (non-adversarial) person-shift input contains NO slur / person label', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-j-person-shift-request.json',
  )) as { input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  for (const pattern of FAMILY_J_BAN_PATTERNS) {
    if (pattern.test(moveText)) {
      throw new Error(`canonical person-shift input should NOT contain a person token (${pattern}). Got: ${moveText}`);
    }
  }
});

Deno.test('design §4.B BINDING (THE EXISTENTIAL for shifts_to_person_or_intent): input contains slur words', async () => {
  // The existential adversarial test. Input contains "troll"/"toxic".
  // Classifier's job: detect shifts_to_person_or_intent without echoing the
  // slur in OUTPUT evidence_span. A FAIL HERE IN LIVE SMOKE IS HALT + REVERT.
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-j-person-shift-adversarial-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  if (!/troll/i.test(moveText)) {
    throw new Error(`design §4.B BINDING: person-shift adversarial fixture MUST contain "troll" in input. Got: ${moveText}`);
  }
  if (!/toxic/i.test(moveText)) {
    throw new Error(`design §4.B BINDING: person-shift adversarial fixture MUST contain "toxic" in input. Got: ${moveText}`);
  }
});

Deno.test('design §4.B: person-shift-adversarial fixture is parseable and targets shifts_to_person_or_intent', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-j-person-shift-adversarial-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const rawKeys = fixture.input.requestedRawKeys as string[];
  if (!rawKeys.includes('shifts_to_person_or_intent')) {
    throw new Error('person-shift-adversarial fixture should request shifts_to_person_or_intent');
  }
});

Deno.test('design §4.C (mandatory): insult-only fixture exists, parseable, targets contains_unplayable_insult_only', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-j-insult-only-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const rawKeys = fixture.input.requestedRawKeys as string[];
  if (!rawKeys.includes('contains_unplayable_insult_only')) {
    throw new Error('insult-only fixture should request contains_unplayable_insult_only');
  }
});

Deno.test('design §4.D (mandatory): pause fixture exists, parseable, targets needs_pre_send_pause, has reactive markers', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-j-pause-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const rawKeys = fixture.input.requestedRawKeys as string[];
  if (!rawKeys.includes('needs_pre_send_pause')) {
    throw new Error('pause fixture should request needs_pre_send_pause');
  }
  const moveText = fixture.input.currentText as string;
  // ALL CAPS burst + repeated punctuation = reactive structural markers.
  if (!/WRONG/.test(moveText) || !/!!!/.test(moveText)) {
    throw new Error('pause fixture should contain reactive markers (ALL CAPS + repeated punctuation). Got: ' + moveText);
  }
});

Deno.test('design §4.E (mandatory): popularity fixture exists, parseable, targets uses_popularity_as_evidence', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-j-popularity-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const rawKeys = fixture.input.requestedRawKeys as string[];
  if (!rawKeys.includes('uses_popularity_as_evidence')) {
    throw new Error('popularity fixture should request uses_popularity_as_evidence');
  }
  const moveText = fixture.input.currentText as string;
  if (!/everyone knows/i.test(moveText)) {
    throw new Error('popularity fixture should lean on popularity. Got: ' + moveText);
  }
});

Deno.test('design §4.F (mandatory): satire fixture exists, parseable, targets uses_satire_as_evidence', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-j-satire-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const rawKeys = fixture.input.requestedRawKeys as string[];
  if (!rawKeys.includes('uses_satire_as_evidence')) {
    throw new Error('satire fixture should request uses_satire_as_evidence');
  }
  const moveText = fixture.input.currentText as string;
  if (!/The Onion/i.test(moveText)) {
    throw new Error('satire fixture should cite a satire source. Got: ' + moveText);
  }
});

Deno.test('design §4.G (supplementary; all-negative): no-sensitive fixture exists, parseable, requests all 5 keys, stays substantive', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-j-no-sensitive-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const rawKeys = fixture.input.requestedRawKeys as string[];
  assertEquals(rawKeys.length, 5);
  const moveText = fixture.input.currentText as string;
  // The no-sensitive move makes a substantive claim about budget figures.
  if (!/capital budget, not the operating budget/i.test(moveText)) {
    throw new Error('no-sensitive fixture should stay on a substantive claim. Got: ' + moveText);
  }
  // It must contain NO person/intent token (no over-fire bait).
  for (const pattern of FAMILY_J_BAN_PATTERNS) {
    if (pattern.test(moveText)) {
      throw new Error(`no-sensitive baseline move text should NOT contain a person token (${pattern}). Got: ${moveText}`);
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Canonical response fixture (smoke Checks 40+41) — valid + doctrine-clean
// ─────────────────────────────────────────────────────────────────────────

Deno.test('canonical-response fixture validates against the wire schema and is doctrine-clean', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-j-canonical-response.json',
  );
  const validated = validateMcpBooleanObservationResponse(fixture);
  assertEquals(validated.ok, true);
  if (validated.ok) {
    const scan = scanFamilyJBooleanResponseForBanList(validated.value);
    assertEquals(scan.ok, true);
    // Exactly 5 keys (the full semantic_referee SOURCE-UNIFORM set).
    assertEquals(validated.value.checkedRawKeys.length, 5);
    assertEquals(validated.value.modelInfo.classifierSetVersion, 'family-j-v1');
  }
});

Deno.test('fixture provider loads the canonical Family J packet', async () => {
  const result = await loadFixtureFamilyJPacket();
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.schemaVersion, MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION);
    assertEquals(
      (result.value.modelInfo as Record<string, unknown>).classifierSetVersion,
      'family-j-v1',
    );
  }
});

Deno.test('ban-list-response fixture (dirty) is REJECTED by the scan with the correct path', async () => {
  // Defensive: the ban-list fixture deliberately carries person tokens
  // ("troll"/"toxic"); the scanner must reject it.
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-j-ban-list-response.json',
  );
  const validated = validateMcpBooleanObservationResponse(fixture);
  assertEquals(validated.ok, true);
  if (validated.ok) {
    const scan = scanFamilyJBooleanResponseForBanList(validated.value);
    assertEquals(scan.ok, false);
    if (!scan.ok) {
      assertEquals(scan.path, 'evidenceSpan.shifts_to_person_or_intent');
    }
  }
});

Deno.test('malformed-response fixture is REJECTED by the wire-schema validator (non-boolean observation)', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-j-malformed-response.json',
  );
  const validated = validateMcpBooleanObservationResponse(fixture);
  assertEquals(validated.ok, false);
});

// ─────────────────────────────────────────────────────────────────────────
// Runtime ban-list assertions: design §6 person/intent tokens (HALT trigger)
// ─────────────────────────────────────────────────────────────────────────

Deno.test('design §6 BINDING: ban-list rejects "troll" in shifts_to_person_or_intent evidenceSpan', () => {
  const response = buildResponse('shifts_to_person_or_intent', 'the author is just a troll');
  const result = scanFamilyJBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'evidenceSpan.shifts_to_person_or_intent');
  }
});

Deno.test('design §6 BINDING: ban-list rejects "toxic" in evidenceSpan', () => {
  const response = buildResponse('contains_unplayable_insult_only', 'the move is toxic');
  const result = scanFamilyJBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §6 BINDING: ban-list rejects "ad hominem" compound in evidenceSpan', () => {
  const response = buildResponse('shifts_to_person_or_intent', 'this is an ad hominem');
  const result = scanFamilyJBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §6 BINDING: ban-list rejects "personal attack" compound in evidenceSpan', () => {
  const response = buildResponse('shifts_to_person_or_intent', 'this is a personal attack');
  const result = scanFamilyJBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §6 BINDING: ban-list rejects "fake news" in uses_satire_as_evidence evidenceSpan', () => {
  const response = buildResponse('uses_satire_as_evidence', 'the source is fake news');
  const result = scanFamilyJBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §6 BINDING: ban-list rejects "unhinged" in needs_pre_send_pause evidenceSpan', () => {
  const response = buildResponse('needs_pre_send_pause', 'the author is unhinged');
  const result = scanFamilyJBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §6 BINDING: clean structural person-shift evidenceSpan (anchors wording, no slur) passes ban-list', () => {
  const response = buildResponse('shifts_to_person_or_intent', 'because you work for an EV company');
  const result = scanFamilyJBooleanResponseForBanList(response);
  assertEquals(result.ok, true);
});

Deno.test('design §6 BINDING: FAMILY_J_BAN_PATTERNS contains all 18 person/intent patterns', () => {
  const targetTokens = [
    // single tokens (11)
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
    // compound phrases (7)
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
  assertEquals(FAMILY_J_BAN_PATTERNS.length, 18);
});

Deno.test('design §6 BINDING: near-miss words (robot, toxicity) are NOT flagged', () => {
  const nearMisses = [
    'the move quotes a robot vacuum review',
    'the move cites soil toxicity data',
    'the move references a sabotage report',
  ];
  for (const span of nearMisses) {
    const response = buildResponse('shifts_to_person_or_intent', span);
    const result = scanFamilyJBooleanResponseForBanList(response);
    assertEquals(result.ok, true, `near-miss should NOT be flagged: "${span}"`);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Existential cross-checks (Fixture B + per-key): OUTPUT stays clean
// regardless of slur / person words in the INPUT.
// ─────────────────────────────────────────────────────────────────────────

Deno.test('design §4.B THE EXISTENTIAL cross-check: simulated clean output (anchors focus-shift wording) passes', () => {
  // Fixture B input contains "troll"/"toxic". The model's job: detect
  // shifts_to_person_or_intent but anchor the evidence_span on the STRUCTURAL
  // focus-shift wording, NOT on the slur from input.
  const response = buildResponse('shifts_to_person_or_intent', 'you only push this because you work for an EV company');
  const result = scanFamilyJBooleanResponseForBanList(response);
  assertEquals(result.ok, true);
});

Deno.test('design §4.B THE EXISTENTIAL cross-check: simulated dirty output (echoes "troll"/"toxic") FAILS', () => {
  // The negative pole. If the model lifted the slur from input into its
  // evidence_span, the ban-list MUST catch it. A FAIL here in live smoke is
  // HALT + revert.
  for (const dirtySpan of [
    "you're such a troll about this",
    "you only push this because you're toxic",
    'the author is a troll and a bad actor',
  ]) {
    const response = buildResponse('shifts_to_person_or_intent', dirtySpan);
    const result = scanFamilyJBooleanResponseForBanList(response);
    assertEquals(result.ok, false, `dirty output should be rejected: "${dirtySpan}"`);
  }
});

Deno.test('design §4.C cross-check: insult-only clean output (anchors absence of claim) passes; dirty output fails', () => {
  const clean = buildResponse('contains_unplayable_insult_only', 'the move is only "That is dumb." with no claim attached');
  assertEquals(scanFamilyJBooleanResponseForBanList(clean).ok, true);
  for (const dirtySpan of ['the author is a troll', 'this is just name calling', 'the move is toxic']) {
    const response = buildResponse('contains_unplayable_insult_only', dirtySpan);
    assertEquals(scanFamilyJBooleanResponseForBanList(response).ok, false, `dirty: "${dirtySpan}"`);
  }
});

Deno.test('design §4.D cross-check: pause clean output (anchors reactive markers) passes; dirty output fails', () => {
  const clean = buildResponse('needs_pre_send_pause', 'NO YOU ARE WRONG WRONG WRONG!!!');
  assertEquals(scanFamilyJBooleanResponseForBanList(clean).ok, true);
  for (const dirtySpan of ['the author is unhinged', 'the author is losing it', 'the author is hostile']) {
    const response = buildResponse('needs_pre_send_pause', dirtySpan);
    assertEquals(scanFamilyJBooleanResponseForBanList(response).ok, false, `dirty: "${dirtySpan}"`);
  }
});

Deno.test('design §4.E cross-check: popularity clean output (anchors popularity wording) passes; dirty output (truth/verdict) fails', () => {
  const clean = buildResponse('uses_popularity_as_evidence', 'Everyone knows this is the case');
  assertEquals(scanFamilyJBooleanResponseForBanList(clean).ok, true);
  for (const dirtySpan of ['the popularity proves the truth of the claim', 'the verdict is settled by the share count']) {
    const response = buildResponse('uses_popularity_as_evidence', dirtySpan);
    assertEquals(scanFamilyJBooleanResponseForBanList(response).ok, false, `dirty: "${dirtySpan}"`);
  }
});

Deno.test('design §4.F cross-check: satire clean output (anchors satire-as-fact citation) passes; dirty output fails', () => {
  const clean = buildResponse('uses_satire_as_evidence', 'See, The Onion confirmed this last week');
  assertEquals(scanFamilyJBooleanResponseForBanList(clean).ok, true);
  for (const dirtySpan of ['the satire is fake news', 'the author is gullible']) {
    const response = buildResponse('uses_satire_as_evidence', dirtySpan);
    assertEquals(scanFamilyJBooleanResponseForBanList(response).ok, false, `dirty: "${dirtySpan}"`);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Per-key prompt-entry guard sub-check (design §5.2 reviewer matrix)
// ─────────────────────────────────────────────────────────────────────────

Deno.test('design §5.2 reviewer matrix sub-check: the 4 verdict-adjacent keys each surface forbidden person/intent words in their guards', () => {
  const matrix: Record<string, readonly string[]> = {
    shifts_to_person_or_intent: ['troll', 'toxic', 'ad hominem', 'personal attack', 'bad actor'],
    contains_unplayable_insult_only: ['troll', 'toxic', 'name calling'],
    needs_pre_send_pause: ['unhinged', 'hostile', 'losing it'],
    uses_satire_as_evidence: ['fake news', 'gullible'],
  };
  for (const [rawKey, forbidden] of Object.entries(matrix)) {
    const entry = FAMILY_J_PROMPT_ENTRIES.find((e) => e.rawKey === rawKey);
    if (!entry) throw new Error(`${rawKey} prompt entry missing`);
    for (const word of forbidden) {
      if (!entry.falsePositiveGuards.includes(word)) {
        throw new Error(`${rawKey} falsePositiveGuards missing explicit mention of '${word}' as forbidden output`);
      }
    }
  }
});

Deno.test('design §4 canonical per-key fixtures (non-adversarial) produce NO person token in their move text', async () => {
  // The non-adversarial canonical inputs must be doctrine-clean: no person/
  // intent token in the move text. (The adversarial fixture B is the explicit
  // exception — its INPUT contains a slur by design.)
  for (const name of [
    'classify-argument-boolean-observations.family-j-person-shift-request.json',
    'classify-argument-boolean-observations.family-j-popularity-request.json',
    'classify-argument-boolean-observations.family-j-satire-request.json',
    'classify-argument-boolean-observations.family-j-no-sensitive-request.json',
  ]) {
    const fixture = (await loadFixture(name)) as { input: Record<string, unknown> };
    const moveText = fixture.input.currentText as string;
    for (const pattern of FAMILY_J_BAN_PATTERNS) {
      if (pattern.test(moveText)) {
        throw new Error(`canonical fixture ${name} move text contains a person token (${pattern}). Got: ${moveText}`);
      }
    }
  }
});
