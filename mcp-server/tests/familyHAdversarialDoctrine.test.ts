/**
 * MCP-SERVER-009-FAMILY-H — Adversarial claim_clarity doctrine tests
 * (design §A.4 D4 BINDING).
 *
 * This file is dedicated to the design §A.4 binding requirement: 4
 * mandatory adversarial fixtures (the 4 HIGHEST-risk per-key existentials:
 * conclusion_missing, reason_missing, claim_specificity_low,
 * unclear_reference_present) + 4 supplementary canonical fixtures + the
 * canonical-response fixture + the ban-list-violation fixture + the
 * malformed-response fixture, AND the runtime ban-list scanner must
 * reject every clarity-verdict token (weak / sloppy / lazy / careless /
 * confused / unsound / unsupported / incoherent / illogical + the 8
 * compound phrases) that the model might emit.
 *
 * Per intent §7 HALT triggers #17 + #18 + #20 + #22: a FAIL on any one
 * adversarial assertion is a doctrine violation requiring revert. The
 * existential is Fixture E — a broad claim wrapped in verdict words
 * ("weak"/"lazy") in the INPUT, where the OUTPUT must stay clean. This is
 * the H-equivalent of F's Fixture C ("fallacy" twice) and G's Fixtures C
 * + E ("won"/"lost"/"settled in favor").
 *
 * Fixture matrix (design §A.4):
 *   - A (mandatory): canonical met — claim + reason + specific scope; no
 *     verdict framing.
 *   - B (mandatory): canonical unmet (broad claim, no reason); the two
 *     HIGHEST-risk keys are positive.
 *   - C (mandatory; EXISTENTIAL for conclusion_missing): input contains
 *     verdict words "weak/sloppy/no clear point". OUTPUT must not echo.
 *   - D (mandatory; EXISTENTIAL for reason_missing): input contains
 *     verdict word "unsupported". OUTPUT must not echo.
 *   - E (mandatory; EXISTENTIAL for claim_specificity_low — the axis-
 *     partner): input contains verdict words "weak/lazy/broad and weak".
 *     OUTPUT must not echo. A FAIL HERE IS HALT + REVERT.
 *   - F (mandatory; EXISTENTIAL for unclear_reference_present): input
 *     contains verdict words "unclear/sloppy" applied to speaker. OUTPUT
 *     must not echo.
 *   - G/H/I/J (supplementary): multi-claim / hedging / modal / temporal
 *     canonical fixtures; doctrine-clean baselines.
 *   - K (mandatory; ban-list-violation response fixture): intentionally
 *     dirty evidence_span; the scan MUST reject.
 *   - L (mandatory; canonical-response): doctrine-clean; smoke Checks
 *     22+23 load this.
 *   - M (mandatory; malformed-response): schema violation; validator
 *     MUST reject.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  scanFamilyHBooleanResponseForBanList,
  FAMILY_H_BAN_PATTERNS,
} from '../lib/familyHBanListScan.ts';
import type { McpBooleanObservationValidatedResponse } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { validateMcpBooleanObservationResponse } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { FAMILY_H_PROMPT_ENTRIES } from '../lib/familyHKeys.ts';
import { loadFixtureFamilyHPacket } from '../lib/familyHFixtureProvider.ts';

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
    nodeId: 'fixture-node-h-doctrine-test',
    checkedRawKeys: [rawKey],
    observations: { [rawKey]: true },
    confidence: { [rawKey]: 'high' },
    evidenceSpan: { [rawKey]: evidenceSpanValue },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-h-v1',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Design §A.4 D4 BINDING: 4 mandatory adversarial fixtures (the 4
// HIGHEST-risk per-key existentials) + 4 supplementary canonical + 3
// response fixtures
// ─────────────────────────────────────────────────────────────────────────

Deno.test('design §A.4.A (mandatory): canonical-met fixture exists, parseable, targets all-good claim-clarity keys', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-h-canonical-met-request.json',
  );
  if (typeof fixture !== 'object' || fixture === null) {
    throw new Error('canonical-met fixture not parseable as object');
  }
  const wrapper = fixture as { tool: string; input: Record<string, unknown> };
  assertEquals(wrapper.tool, 'classify_argument_boolean_observations');
  const rawKeys = wrapper.input.requestedRawKeys as string[];
  for (const expected of ['claim_present', 'reason_present', 'claim_specificity_high']) {
    if (!rawKeys.includes(expected)) {
      throw new Error(`canonical-met fixture should request ${expected}`);
    }
  }
  const families = wrapper.input.requestedFamilies as string[];
  if (!families.includes('claim_clarity')) {
    throw new Error('canonical-met fixture should request claim_clarity family');
  }
});

Deno.test('design §A.4.A: canonical-met input contains attached reason + specific scope', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-h-canonical-met-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  if (!/because/i.test(moveText)) {
    throw new Error('canonical-met fixture should contain "because" (reason marker). Got: ' + moveText);
  }
  if (!/2015-2020/.test(moveText)) {
    throw new Error('canonical-met fixture should contain a specific temporal range. Got: ' + moveText);
  }
});

Deno.test('design §A.4.B (mandatory): canonical-unmet fixture exists, parseable, targets the two HIGHEST-risk axis-partner keys', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-h-canonical-unmet-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const rawKeys = fixture.input.requestedRawKeys as string[];
  for (const expected of ['claim_specificity_low', 'reason_missing']) {
    if (!rawKeys.includes(expected)) {
      throw new Error(`canonical-unmet fixture should request ${expected}`);
    }
  }
});

Deno.test('design §A.4.B: canonical-unmet input is the bare broad claim "Carbon taxes work"', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-h-canonical-unmet-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  if (!/Carbon taxes work/.test(moveText)) {
    throw new Error('canonical-unmet fixture should contain the bare broad claim. Got: ' + moveText);
  }
});

Deno.test('design §A.4.C BINDING (mandatory; EXISTENTIAL for conclusion_missing): input contains verdict words', async () => {
  // The 1st existential adversarial test. Input contains "weak"/"sloppy"/
  // "no clear point". Classifier's job: detect conclusion_missing without
  // echoing the framing in OUTPUT evidence_span.
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-h-conclusion-missing-adversarial-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  if (!/weak/i.test(moveText)) {
    throw new Error(
      `design §A.4.C BINDING: conclusion-missing adversarial fixture MUST contain "weak" in input. Got: ${moveText}`,
    );
  }
  if (!/sloppy/i.test(moveText)) {
    throw new Error(
      `design §A.4.C BINDING: conclusion-missing adversarial fixture MUST contain "sloppy" in input. Got: ${moveText}`,
    );
  }
  if (!/no clear point/i.test(moveText)) {
    throw new Error(
      `design §A.4.C BINDING: conclusion-missing adversarial fixture MUST contain "no clear point" in input. Got: ${moveText}`,
    );
  }
});

Deno.test('design §A.4.C: conclusion-missing-adversarial fixture is parseable and targets conclusion_missing', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-h-conclusion-missing-adversarial-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const rawKeys = fixture.input.requestedRawKeys as string[];
  if (!rawKeys.includes('conclusion_missing')) {
    throw new Error('conclusion-missing-adversarial fixture should request conclusion_missing');
  }
});

Deno.test('design §A.4.D BINDING (mandatory; EXISTENTIAL for reason_missing): input contains verdict word "unsupported"', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-h-reason-missing-adversarial-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  if (!/unsupported/i.test(moveText)) {
    throw new Error(
      `design §A.4.D BINDING: reason-missing adversarial fixture MUST contain "unsupported" in input. Got: ${moveText}`,
    );
  }
});

Deno.test('design §A.4.D: reason-missing-adversarial fixture is parseable and targets reason_missing', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-h-reason-missing-adversarial-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const rawKeys = fixture.input.requestedRawKeys as string[];
  if (!rawKeys.includes('reason_missing')) {
    throw new Error('reason-missing-adversarial fixture should request reason_missing');
  }
});

Deno.test('design §A.4.E BINDING (mandatory; EXISTENTIAL for claim_specificity_low — the axis-partner): input contains verdict words "weak" and "lazy"', async () => {
  // THE H-equivalent of F's Fixture C and G's Fixture C — the axis-partner
  // existential adversarial. A FAIL HERE IN LIVE SMOKE IS HALT + REVERT.
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-h-broad-claim-adversarial-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  if (!/weak/i.test(moveText)) {
    throw new Error(
      `design §A.4.E BINDING: broad-claim adversarial fixture MUST contain "weak" in input. Got: ${moveText}`,
    );
  }
  if (!/lazy/i.test(moveText)) {
    throw new Error(
      `design §A.4.E BINDING: broad-claim adversarial fixture MUST contain "lazy" in input. Got: ${moveText}`,
    );
  }
  if (!/broad/i.test(moveText)) {
    throw new Error(
      `design §A.4.E BINDING: broad-claim adversarial fixture MUST contain "broad" in input. Got: ${moveText}`,
    );
  }
});

Deno.test('design §A.4.E: broad-claim-adversarial fixture is parseable and targets claim_specificity_low', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-h-broad-claim-adversarial-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const rawKeys = fixture.input.requestedRawKeys as string[];
  if (!rawKeys.includes('claim_specificity_low')) {
    throw new Error('broad-claim-adversarial fixture should request claim_specificity_low');
  }
});

Deno.test('design §A.4.F BINDING (mandatory; EXISTENTIAL for unclear_reference_present): input contains speaker-verdict words "unclear" and "sloppy"', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-h-unclear-reference-adversarial-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  if (!/unclear/i.test(moveText)) {
    throw new Error(
      `design §A.4.F BINDING: unclear-reference adversarial fixture MUST contain "unclear" in input. Got: ${moveText}`,
    );
  }
  if (!/sloppy/i.test(moveText)) {
    throw new Error(
      `design §A.4.F BINDING: unclear-reference adversarial fixture MUST contain "sloppy" in input. Got: ${moveText}`,
    );
  }
});

Deno.test('design §A.4.F: unclear-reference-adversarial fixture is parseable and targets unclear_reference_present', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-h-unclear-reference-adversarial-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const rawKeys = fixture.input.requestedRawKeys as string[];
  if (!rawKeys.includes('unclear_reference_present')) {
    throw new Error('unclear-reference-adversarial fixture should request unclear_reference_present');
  }
});

Deno.test('design §A.4.G (supplementary): multi-claim fixture exists, parseable, targets multiple_claims_present', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-h-multi-claim-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const rawKeys = fixture.input.requestedRawKeys as string[];
  if (!rawKeys.includes('multiple_claims_present')) {
    throw new Error('multi-claim fixture should request multiple_claims_present');
  }
  const moveText = fixture.input.currentText as string;
  if (!/AND/.test(moveText)) {
    throw new Error('multi-claim fixture should contain conjunction AND. Got: ' + moveText);
  }
});

Deno.test('design §A.4.H (supplementary): hedging fixture exists, parseable, targets hedging_present', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-h-hedging-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const rawKeys = fixture.input.requestedRawKeys as string[];
  if (!rawKeys.includes('hedging_present')) {
    throw new Error('hedging fixture should request hedging_present');
  }
  const moveText = fixture.input.currentText as string;
  if (!/probably/i.test(moveText)) {
    throw new Error('hedging fixture should contain hedge word "probably". Got: ' + moveText);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Canonical response fixture (smoke Checks 22+23) — valid + doctrine-clean
// ─────────────────────────────────────────────────────────────────────────

Deno.test('canonical-response fixture validates against the wire schema and is doctrine-clean', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-h-canonical-response.json',
  );
  const validated = validateMcpBooleanObservationResponse(fixture);
  assertEquals(validated.ok, true);
  if (validated.ok) {
    // The canonical response is positive-sparse and doctrine-clean.
    const scan = scanFamilyHBooleanResponseForBanList(validated.value);
    assertEquals(scan.ok, true);
    // Exactly 12 keys (the full ai_classifier uniform set).
    assertEquals(validated.value.checkedRawKeys.length, 12);
    assertEquals(validated.value.modelInfo.classifierSetVersion, 'family-h-v1');
  }
});

Deno.test('fixture provider loads the canonical Family H packet', async () => {
  const result = await loadFixtureFamilyHPacket();
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.value.schemaVersion, MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION);
    assertEquals(
      (result.value.modelInfo as Record<string, unknown>).classifierSetVersion,
      'family-h-v1',
    );
  }
});

Deno.test('ban-list-response fixture (dirty) is REJECTED by the scan', async () => {
  // Defensive: the ban-list fixture deliberately carries verdict tokens; the
  // scanner must reject it. Proves the scan is wired to the fixture shape.
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-h-ban-list-response.json',
  );
  const validated = validateMcpBooleanObservationResponse(fixture);
  assertEquals(validated.ok, true);
  if (validated.ok) {
    const scan = scanFamilyHBooleanResponseForBanList(validated.value);
    assertEquals(scan.ok, false);
    if (!scan.ok) {
      assertEquals(scan.path, 'evidenceSpan.claim_specificity_low');
    }
  }
});

Deno.test('malformed-response fixture is REJECTED by the wire-schema validator', async () => {
  // The malformed fixture has `observations.claim_specificity_low: "not-a-boolean"`
  // (string instead of boolean). The validator MUST reject. Mirrors G's
  // malformed-response fixture pattern.
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-h-malformed-response.json',
  );
  const validated = validateMcpBooleanObservationResponse(fixture);
  assertEquals(validated.ok, false);
});

// ─────────────────────────────────────────────────────────────────────────
// Runtime ban-list assertions: design §A.3.3 clarity-verdict tokens
// (HALT trigger #19)
// ─────────────────────────────────────────────────────────────────────────

Deno.test('design §A.3.3 BINDING: ban-list rejects "weak" in claim_specificity_low evidenceSpan', () => {
  const response = buildResponse('claim_specificity_low', 'this claim is weak in scope');
  const result = scanFamilyHBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'evidenceSpan.claim_specificity_low');
  }
});

Deno.test('design §A.3.3 BINDING: ban-list rejects "sloppy" in evidenceSpan', () => {
  const response = buildResponse('unclear_reference_present', 'the speaker is sloppy');
  const result = scanFamilyHBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §A.3.3 BINDING: ban-list rejects "lazy" in evidenceSpan', () => {
  const response = buildResponse('claim_specificity_low', 'this is a lazy framing');
  const result = scanFamilyHBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §A.3.3 BINDING: ban-list rejects "unsupported" in evidenceSpan (reason_missing drift)', () => {
  const response = buildResponse('reason_missing', 'the claim is unsupported by any reason');
  const result = scanFamilyHBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §A.3.3 BINDING: ban-list rejects "argument is incomplete" compound in evidenceSpan (conclusion_missing drift)', () => {
  const response = buildResponse('conclusion_missing', 'the argument is incomplete');
  const result = scanFamilyHBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §A.3.3 BINDING: ban-list rejects "argument is unsupported" compound in evidenceSpan', () => {
  const response = buildResponse('reason_missing', 'the argument is unsupported');
  const result = scanFamilyHBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §A.3.3 BINDING: ban-list rejects "argument is weak" compound in evidenceSpan', () => {
  const response = buildResponse('claim_specificity_low', 'the argument is weak');
  const result = scanFamilyHBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §A.3.3 BINDING: ban-list rejects "claim fails" compound in evidenceSpan', () => {
  const response = buildResponse('claim_specificity_low', 'the claim fails');
  const result = scanFamilyHBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §A.3.3 BINDING: clean claim-clarity evidenceSpan (anchors broad scope, no verdict) passes ban-list', () => {
  // The positive case: a doctrine-clean output that anchors the structural
  // broad scope with a verbatim quote — no verdict framing.
  const response = buildResponse('claim_specificity_low', 'Carbon taxes work');
  const result = scanFamilyHBooleanResponseForBanList(response);
  assertEquals(result.ok, true);
});

Deno.test('design §A.3.3 BINDING: FAMILY_H_BAN_PATTERNS contains all 17 clarity-verdict patterns', () => {
  const targetTokens = [
    // single tokens (9)
    'weak',
    'sloppy',
    'lazy',
    'careless',
    'confused',
    'unsound',
    'unsupported',
    'incoherent',
    'illogical',
    // compound phrases (8)
    'bad reasoning',
    'bad argument',
    'bad writing',
    'argument is incomplete',
    'argument is unsupported',
    'argument is weak',
    'claim fails',
    'claim is wrong',
  ];
  for (const token of targetTokens) {
    const pattern = FAMILY_H_BAN_PATTERNS.find((p) => p.test(`prefix ${token} suffix`));
    if (!pattern) {
      throw new Error(`FAMILY_H_BAN_PATTERNS missing pattern for token: '${token}'`);
    }
  }
  assertEquals(FAMILY_H_BAN_PATTERNS.length, 17);
});

Deno.test('design §A.3.3 BINDING: near-miss words (wonderful) are NOT flagged', () => {
  const nearMisses = [
    'this is a wonderful synthesis',
    'the foundation has weakened',
    'carelessness is sometimes noted in sources',
  ];
  for (const span of nearMisses) {
    const response = buildResponse('claim_present', span);
    const result = scanFamilyHBooleanResponseForBanList(response);
    assertEquals(result.ok, true, `near-miss should NOT be flagged: "${span}"`);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Existential cross-checks (design §A.4 Fixtures C/D/E/F): the OUTPUT
// stays clean regardless of verdict words in the INPUT.
// ─────────────────────────────────────────────────────────────────────────

Deno.test('design §A.4 Fixture C cross-check: simulated clean output (anchors reasoning chain) passes', () => {
  // Fixture C input contains "weak"/"sloppy"/"no clear point". The model's
  // job: detect conclusion_missing but anchor the evidence_span on the
  // REASONING CHAIN, NOT on the verdict words from input.
  const response = buildResponse(
    'conclusion_missing',
    'Library funding has dropped 20% since 2019. Literacy rates have fallen.',
  );
  const result = scanFamilyHBooleanResponseForBanList(response);
  assertEquals(result.ok, true);
});

Deno.test('design §A.4 Fixture C cross-check: simulated dirty output (echoes "weak"/"sloppy") FAILS', () => {
  // The negative pole. If the model lifted the verdict words from input into
  // its evidence_span, the ban-list MUST catch it. This is the existential
  // adversarial proof (a FAIL here in live smoke is HALT + revert).
  for (const dirtySpan of [
    'the move has no clear point and is weak',
    'I wrote a sloppy argument',
    'no clear point because the writer was lazy',
  ]) {
    const response = buildResponse('conclusion_missing', dirtySpan);
    const result = scanFamilyHBooleanResponseForBanList(response);
    assertEquals(result.ok, false, `dirty output should be rejected: "${dirtySpan}"`);
  }
});

Deno.test('design §A.4 Fixture D cross-check: simulated clean output (anchors bare claim) passes', () => {
  const response = buildResponse('reason_missing', 'This policy will work');
  const result = scanFamilyHBooleanResponseForBanList(response);
  assertEquals(result.ok, true);
});

Deno.test('design §A.4 Fixture D cross-check: simulated dirty output (echoes "unsupported") FAILS', () => {
  for (const dirtySpan of [
    'the claim is unsupported',
    'argument is unsupported by any ground',
    'the move is unsupported and ungrounded',
  ]) {
    const response = buildResponse('reason_missing', dirtySpan);
    const result = scanFamilyHBooleanResponseForBanList(response);
    assertEquals(result.ok, false, `dirty output should be rejected: "${dirtySpan}"`);
  }
});

Deno.test('design §A.4 Fixture E (AXIS-PARTNER EXISTENTIAL) cross-check: simulated clean output (anchors broad scope) passes', () => {
  // The axis-partner existential. The clean output anchors the broad
  // wording verbatim — no verdict words echoed.
  const response = buildResponse('claim_specificity_low', 'Carbon taxes work');
  const result = scanFamilyHBooleanResponseForBanList(response);
  assertEquals(result.ok, true);
});

Deno.test('design §A.4 Fixture E (AXIS-PARTNER EXISTENTIAL) cross-check: simulated dirty output (echoes "weak"/"lazy") FAILS', () => {
  // THE existential. A FAIL in live smoke is HALT + REVERT.
  for (const dirtySpan of [
    'the broad claim is weak',
    'broad and weak claim',
    'the speaker is being lazy with scope',
    'this argument is weak',
  ]) {
    const response = buildResponse('claim_specificity_low', dirtySpan);
    const result = scanFamilyHBooleanResponseForBanList(response);
    assertEquals(result.ok, false, `dirty output should be rejected: "${dirtySpan}"`);
  }
});

Deno.test('design §A.4 Fixture F cross-check: simulated clean output (anchors ambiguous pronoun + alternative referents) passes', () => {
  // Fixture F input contains speaker-verdict words "unclear"/"sloppy". The
  // clean output anchors the pronoun "this" and names the candidate
  // referents (library / museum funding), never the speaker verdict.
  const response = buildResponse(
    'unclear_reference_present',
    'This is the wrong approach (referent ambiguous between library funding and museum funding)',
  );
  const result = scanFamilyHBooleanResponseForBanList(response);
  // Note: 'wrong' is NOT in H's ban-list (intentional per design §A.3.3 —
  // H's verdict tokens focus on the formulation slice; bare 'wrong' is a
  // truth verdict carried by F's and G's own scans, not H's). The shared
  // list catches 'truth' but not bare 'wrong' either. This evidence_span is
  // clean per H's ban-list.
  assertEquals(result.ok, true);
});

Deno.test('design §A.4 Fixture F cross-check: simulated dirty output (echoes "sloppy") FAILS', () => {
  for (const dirtySpan of [
    'the speaker is sloppy with pronouns',
    'the author was careless about referents',
    'speaker is confused',
  ]) {
    const response = buildResponse('unclear_reference_present', dirtySpan);
    const result = scanFamilyHBooleanResponseForBanList(response);
    assertEquals(result.ok, false, `dirty output should be rejected: "${dirtySpan}"`);
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Per-key prompt-entry guard sub-check (design §A.3.2 reviewer matrix)
// ─────────────────────────────────────────────────────────────────────────

Deno.test('design §A.3.2 reviewer matrix sub-check: 4 HIGHEST-risk keys each surface forbidden clarity-verdict words in their guards', () => {
  // The 4 HIGHEST-risk keys' falsePositiveGuards must explicitly list
  // forbidden output words via "MUST NOT contain".
  const matrix: Record<string, readonly string[]> = {
    claim_specificity_low: ['weak', 'sloppy', 'lazy', 'careless', 'unsound', 'unsupported'],
    conclusion_missing: ['incomplete', 'unfinished', 'broken'],
    reason_missing: ['unsupported', 'ungrounded', 'unjustified'],
    unclear_reference_present: ['unclear', 'sloppy', 'careless', 'confused'],
  };
  for (const [rawKey, forbidden] of Object.entries(matrix)) {
    const entry = FAMILY_H_PROMPT_ENTRIES.find((e) => e.rawKey === rawKey);
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
