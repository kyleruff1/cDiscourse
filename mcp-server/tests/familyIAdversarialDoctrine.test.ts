/**
 * MCP-SERVER-010-FAMILY-I — Adversarial thread_topology doctrine tests
 * (design §A.4 D4 BINDING).
 *
 * This file is dedicated to the design §A.4 binding requirement: 2 mandatory
 * boundary-adversarial fixtures (the 2 misreadable per-key existentials:
 * introduces_new_issue + returns_to_prior_issue) + the canonical fixtures +
 * 3 supplementary canonical fixtures + the canonical-response fixture + the
 * ban-list-violation fixture + the malformed-response fixture, AND the
 * runtime ban-list scanner must reject every topology-verdict token
 * (off-topic / derailing / evasive / rehashing / repetitive + the 3 compound
 * phrases) that the model might emit.
 *
 * Per intent §7 HALT triggers #18 + #19 + #20 + #22: a FAIL on any one
 * adversarial assertion is a doctrine violation requiring revert. The
 * existentials are Fixtures C + D — input contains verdict words
 * ("dodging"/"off-topic"/"rehashing"/"going in circles") where the OUTPUT
 * must stay clean. This is the I-equivalent of H's Fixtures C/D/E/F and G's
 * Fixtures C/E. Because doctrine-risk is LOW, I needs only 2 per-key boundary
 * fixtures (vs H's 4 HIGHEST-risk).
 *
 * Fixture matrix (design §A.4):
 *   - A (mandatory): canonical new-issue.
 *   - B (mandatory): canonical comparison + sub-axis.
 *   - C (mandatory; EXISTENTIAL for introduces_new_issue): input contains
 *     verdict words "dodging"/"changing the subject"/"evasive"/"off-topic".
 *     OUTPUT must not echo. A FAIL HERE IS HALT + REVERT.
 *   - D (mandatory; EXISTENTIAL for returns_to_prior_issue): input contains
 *     verdict words "rehashing"/"going in circles". OUTPUT must not echo.
 *     A FAIL HERE IS HALT + REVERT.
 *   - E/F (supplementary): prior-agreement / external-context canonical.
 *   - G (supplementary): no-topology (all-negative) — no over-fire.
 *   - H (mandatory; ban-list-violation response fixture): intentionally
 *     dirty evidence_span; the scan MUST reject.
 *   - I (mandatory; canonical-response): doctrine-clean; smoke Checks 24+25
 *     load this.
 *   - J (mandatory; malformed-response): schema violation; validator MUST reject.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  scanFamilyIBooleanResponseForBanList,
  FAMILY_I_BAN_PATTERNS,
} from '../lib/familyIBanListScan.ts';
import type { McpBooleanObservationValidatedResponse } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { validateMcpBooleanObservationResponse } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { FAMILY_I_PROMPT_ENTRIES } from '../lib/familyIKeys.ts';
import { loadFixtureFamilyIPacket } from '../lib/familyIFixtureProvider.ts';

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
    nodeId: 'fixture-node-i-doctrine-test',
    checkedRawKeys: [rawKey],
    observations: { [rawKey]: true },
    confidence: { [rawKey]: 'high' },
    evidenceSpan: { [rawKey]: evidenceSpanValue },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-i-v1',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Design §A.4 D4 BINDING: canonical + 2 boundary-adversarial fixtures
// ─────────────────────────────────────────────────────────────────────────

Deno.test('design §A.4.A (mandatory): canonical new-issue fixture exists, parseable, targets introduces_new_issue', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-i-new-issue-request.json',
  );
  if (typeof fixture !== 'object' || fixture === null) {
    throw new Error('new-issue fixture not parseable as object');
  }
  const wrapper = fixture as { tool: string; input: Record<string, unknown> };
  assertEquals(wrapper.tool, 'classify_argument_boolean_observations');
  const rawKeys = wrapper.input.requestedRawKeys as string[];
  if (!rawKeys.includes('introduces_new_issue')) {
    throw new Error('new-issue fixture should request introduces_new_issue');
  }
  const families = wrapper.input.requestedFamilies as string[];
  if (!families.includes('thread_topology')) {
    throw new Error('new-issue fixture should request thread_topology family');
  }
});

Deno.test('design §A.4.A: canonical new-issue input opens a topic distinct from the parent (museum funding)', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-i-new-issue-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  if (!/museum funding/i.test(moveText)) {
    throw new Error('new-issue fixture should open a distinct topic (museum funding). Got: ' + moveText);
  }
  // The canonical (non-adversarial) input MUST NOT contain motive-verdict words.
  for (const banned of [/off-topic/i, /derailing/i, /evasive/i, /dodging/i]) {
    if (banned.test(moveText)) {
      throw new Error(`canonical new-issue input should NOT contain verdict word ${banned}. Got: ${moveText}`);
    }
  }
});

Deno.test('design §A.4.B (mandatory): canonical comparison+sub-axis fixture exists, parseable, targets compares_options + introduces_sub_axis', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-i-comparison-subaxis-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const rawKeys = fixture.input.requestedRawKeys as string[];
  for (const expected of ['introduces_sub_axis', 'compares_options']) {
    if (!rawKeys.includes(expected)) {
      throw new Error(`comparison+sub-axis fixture should request ${expected}`);
    }
  }
});

Deno.test('design §A.4.B: comparison input weighs two options (carbon tax vs cap-and-trade)', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-i-comparison-subaxis-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  if (!/carbon tax vs cap-and-trade/i.test(moveText)) {
    throw new Error('comparison fixture should weigh two options. Got: ' + moveText);
  }
});

Deno.test('design §A.4.C BINDING (mandatory; EXISTENTIAL for introduces_new_issue): input contains motive-verdict words', async () => {
  // The 1st existential adversarial test. Input contains "dodging"/"changing
  // the subject"/"evasive"/"off-topic". Classifier's job: detect
  // introduces_new_issue without echoing the framing in OUTPUT evidence_span.
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-i-new-issue-adversarial-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  for (const [label, re] of [
    ['dodging', /dodging/i],
    ['changing the subject', /changing the subject/i],
    ['evasive', /evasive/i],
    ['off-topic', /off-topic/i],
  ] as const) {
    if (!re.test(moveText)) {
      throw new Error(
        `design §A.4.C BINDING: new-issue adversarial fixture MUST contain "${label}" in input. Got: ${moveText}`,
      );
    }
  }
});

Deno.test('design §A.4.C: new-issue-adversarial fixture is parseable and targets introduces_new_issue', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-i-new-issue-adversarial-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const rawKeys = fixture.input.requestedRawKeys as string[];
  if (!rawKeys.includes('introduces_new_issue')) {
    throw new Error('new-issue-adversarial fixture should request introduces_new_issue');
  }
});

Deno.test('design §A.4.D BINDING (mandatory; EXISTENTIAL for returns_to_prior_issue): input contains motive-verdict words', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-i-return-issue-adversarial-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  if (!/rehashing/i.test(moveText)) {
    throw new Error(
      `design §A.4.D BINDING: return-issue adversarial fixture MUST contain "rehashing" in input. Got: ${moveText}`,
    );
  }
  if (!/going in circles/i.test(moveText)) {
    throw new Error(
      `design §A.4.D BINDING: return-issue adversarial fixture MUST contain "going in circles" in input. Got: ${moveText}`,
    );
  }
});

Deno.test('design §A.4.D: return-issue-adversarial fixture is parseable and targets returns_to_prior_issue', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-i-return-issue-adversarial-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const rawKeys = fixture.input.requestedRawKeys as string[];
  if (!rawKeys.includes('returns_to_prior_issue')) {
    throw new Error('return-issue-adversarial fixture should request returns_to_prior_issue');
  }
});

Deno.test('design §A.4.E (supplementary): prior-agreement fixture exists, parseable, targets references_prior_agreement', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-i-prior-agreement-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const rawKeys = fixture.input.requestedRawKeys as string[];
  if (!rawKeys.includes('references_prior_agreement')) {
    throw new Error('prior-agreement fixture should request references_prior_agreement');
  }
  const moveText = fixture.input.currentText as string;
  if (!/we agreed earlier/i.test(moveText)) {
    throw new Error('prior-agreement fixture should cite a prior agreement. Got: ' + moveText);
  }
});

Deno.test('design §A.4.F (supplementary): external-context fixture exists, parseable, targets references_external_context', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-i-external-context-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const rawKeys = fixture.input.requestedRawKeys as string[];
  if (!rawKeys.includes('references_external_context')) {
    throw new Error('external-context fixture should request references_external_context');
  }
  const moveText = fixture.input.currentText as string;
  if (!/NYT article/i.test(moveText)) {
    throw new Error('external-context fixture should reference an external source. Got: ' + moveText);
  }
});

Deno.test('design §A.4.G (supplementary; all-negative): no-topology fixture exists, parseable, requests all 6 keys', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-i-no-topology-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const rawKeys = fixture.input.requestedRawKeys as string[];
  assertEquals(rawKeys.length, 6);
  // The no-topology move stays on the parent's topic (a disagreement on a
  // funding figure); it should exhibit no topology relation.
  const moveText = fixture.input.currentText as string;
  if (!/capital, not operating budget/i.test(moveText)) {
    throw new Error('no-topology fixture should stay on the parent topic. Got: ' + moveText);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Canonical response fixture (smoke Checks 24+25) — valid + doctrine-clean
// ─────────────────────────────────────────────────────────────────────────

Deno.test('canonical-response fixture validates against the wire schema and is doctrine-clean', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-i-canonical-response.json',
  );
  const validated = validateMcpBooleanObservationResponse(fixture);
  assertEquals(validated.ok, true);
  if (validated.ok) {
    const scan = scanFamilyIBooleanResponseForBanList(validated.value);
    assertEquals(scan.ok, true);
    // Exactly 6 keys (the full ai_classifier mixed-source Subset).
    assertEquals(validated.value.checkedRawKeys.length, 6);
    assertEquals(validated.value.modelInfo.classifierSetVersion, 'family-i-v1');
  }
});

Deno.test('fixture provider loads the canonical Family I packet', async () => {
  const result = await loadFixtureFamilyIPacket();
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.schemaVersion, MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION);
    assertEquals(
      (result.value.modelInfo as Record<string, unknown>).classifierSetVersion,
      'family-i-v1',
    );
  }
});

Deno.test('ban-list-response fixture (dirty) is REJECTED by the scan with the correct path', async () => {
  // Defensive: the ban-list fixture deliberately carries verdict tokens
  // ("evasive and off-topic"); the scanner must reject it.
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-i-ban-list-response.json',
  );
  const validated = validateMcpBooleanObservationResponse(fixture);
  assertEquals(validated.ok, true);
  if (validated.ok) {
    const scan = scanFamilyIBooleanResponseForBanList(validated.value);
    assertEquals(scan.ok, false);
    if (!scan.ok) {
      assertEquals(scan.path, 'evidenceSpan.introduces_new_issue');
    }
  }
});

Deno.test('malformed-response fixture is REJECTED by the wire-schema validator (missing confidence)', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-i-malformed-response.json',
  );
  const validated = validateMcpBooleanObservationResponse(fixture);
  assertEquals(validated.ok, false);
});

// ─────────────────────────────────────────────────────────────────────────
// Runtime ban-list assertions: design §A.3.3 topology-verdict tokens
// (HALT trigger #19)
// ─────────────────────────────────────────────────────────────────────────

Deno.test('design §A.3.3 BINDING: ban-list rejects "off-topic" in introduces_new_issue evidenceSpan', () => {
  const response = buildResponse('introduces_new_issue', 'the move is off-topic');
  const result = scanFamilyIBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'evidenceSpan.introduces_new_issue');
  }
});

Deno.test('design §A.3.3 BINDING: ban-list rejects "derailing" in evidenceSpan', () => {
  const response = buildResponse('introduces_new_issue', 'the speaker is derailing the thread');
  const result = scanFamilyIBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §A.3.3 BINDING: ban-list rejects "rehashing" in evidenceSpan (returns_to_prior_issue drift)', () => {
  const response = buildResponse('returns_to_prior_issue', 'the speaker is rehashing the old point');
  const result = scanFamilyIBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §A.3.3 BINDING: ban-list rejects "going in circles" compound in evidenceSpan', () => {
  const response = buildResponse('returns_to_prior_issue', 'the debate is going in circles');
  const result = scanFamilyIBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §A.3.3 BINDING: clean thread-topology evidenceSpan (anchors new topic, no verdict) passes ban-list', () => {
  const response = buildResponse(
    'introduces_new_issue',
    "Worth thinking about museum funding too — that's a different question",
  );
  const result = scanFamilyIBooleanResponseForBanList(response);
  assertEquals(result.ok, true);
});

Deno.test('design §A.3.3 BINDING: FAMILY_I_BAN_PATTERNS contains all 8 topology-verdict patterns', () => {
  const targetTokens = [
    // single tokens (5)
    'off-topic',
    'derailing',
    'evasive',
    'rehashing',
    'repetitive',
    // compound phrases (3)
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
  assertEquals(FAMILY_I_BAN_PATTERNS.length, 8);
});

Deno.test('design §A.3.3 BINDING: near-miss words (topical, circle) are NOT flagged', () => {
  const nearMisses = [
    'the move opens a new topical area',
    'the move draws a circle around the question',
    'the move notes a repetition in the data',
  ];
  for (const span of nearMisses) {
    const response = buildResponse('introduces_new_issue', span);
    const result = scanFamilyIBooleanResponseForBanList(response);
    assertEquals(result.ok, true, `near-miss should NOT be flagged: "${span}"`);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Existential cross-checks (design §A.4 Fixtures C/D): the OUTPUT stays
// clean regardless of verdict words in the INPUT.
// ─────────────────────────────────────────────────────────────────────────

Deno.test('design §A.4 Fixture C cross-check: simulated clean output (anchors new topic) passes', () => {
  // Fixture C input contains "dodging"/"changing the subject"/"evasive"/
  // "off-topic". The model's job: detect introduces_new_issue but anchor the
  // evidence_span on the NEW TOPIC, NOT on the verdict words from input.
  const response = buildResponse(
    'introduces_new_issue',
    "let's talk about museum funding instead",
  );
  const result = scanFamilyIBooleanResponseForBanList(response);
  assertEquals(result.ok, true);
});

Deno.test('design §A.4 Fixture C cross-check: simulated dirty output (echoes "off-topic"/"evasive") FAILS', () => {
  // The negative pole. If the model lifted the verdict words from input into
  // its evidence_span, the ban-list MUST catch it. A FAIL here in live smoke
  // is HALT + revert.
  for (const dirtySpan of [
    "let's talk about museum funding because the speaker is being evasive",
    'the move is off-topic and changing the subject',
    'the speaker is dodging by changing the subject',
  ]) {
    const response = buildResponse('introduces_new_issue', dirtySpan);
    const result = scanFamilyIBooleanResponseForBanList(response);
    assertEquals(result.ok, false, `dirty output should be rejected: "${dirtySpan}"`);
  }
});

Deno.test('design §A.4 Fixture D cross-check: simulated clean output (anchors re-engagement + new evidence) passes', () => {
  const response = buildResponse(
    'returns_to_prior_issue',
    'Coming back to the library staffing question — the new union-contract data does support X',
  );
  const result = scanFamilyIBooleanResponseForBanList(response);
  assertEquals(result.ok, true);
});

Deno.test('design §A.4 Fixture D cross-check: simulated dirty output (echoes "rehashing"/"going in circles") FAILS', () => {
  for (const dirtySpan of [
    'the speaker is rehashing the parked topic',
    'the move is going in circles on staffing',
    'the move is repetitive and beating a dead horse',
  ]) {
    const response = buildResponse('returns_to_prior_issue', dirtySpan);
    const result = scanFamilyIBooleanResponseForBanList(response);
    assertEquals(result.ok, false, `dirty output should be rejected: "${dirtySpan}"`);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Per-key prompt-entry guard sub-check (design §A.3.2 reviewer matrix)
// ─────────────────────────────────────────────────────────────────────────

Deno.test('design §A.3.2 reviewer matrix sub-check: the 2 misreadable keys each surface forbidden topology-verdict words in their guards', () => {
  // The 2 misreadable keys' falsePositiveGuards must explicitly list
  // forbidden output words via "MUST NOT contain".
  const matrix: Record<string, readonly string[]> = {
    introduces_new_issue: ['off-topic', 'derailing', 'evasive', 'dodging'],
    returns_to_prior_issue: ['rehashing', 'repetitive', 'going in circles'],
  };
  for (const [rawKey, forbidden] of Object.entries(matrix)) {
    const entry = FAMILY_I_PROMPT_ENTRIES.find((e) => e.rawKey === rawKey);
    if (!entry) throw new Error(`${rawKey} prompt entry missing`);
    for (const word of forbidden) {
      if (!entry.falsePositiveGuards.includes(word)) {
        throw new Error(
          `${rawKey} falsePositiveGuards missing explicit mention of '${word}' as forbidden output`,
        );
      }
    }
  }
});

Deno.test('design §A.4 canonical Fixtures A + B produce NO verdict framing in their requested move text', async () => {
  // The non-adversarial canonical inputs must be doctrine-clean: no
  // topology-verdict words in the move text.
  for (const name of [
    'classify-argument-boolean-observations.family-i-new-issue-request.json',
    'classify-argument-boolean-observations.family-i-comparison-subaxis-request.json',
  ]) {
    const fixture = (await loadFixture(name)) as { input: Record<string, unknown> };
    const moveText = fixture.input.currentText as string;
    for (const pattern of FAMILY_I_BAN_PATTERNS) {
      if (pattern.test(moveText)) {
        throw new Error(`canonical fixture ${name} move text contains a topology-verdict token (${pattern}). Got: ${moveText}`);
      }
    }
  }
});
