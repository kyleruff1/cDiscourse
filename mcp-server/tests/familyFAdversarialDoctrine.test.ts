/**
 * MCP-SERVER-007-FAMILY-F — Adversarial critical_question doctrine tests
 * (intent §4 D4 BINDING).
 *
 * This file is dedicated to the design §4 binding requirement: 3
 * mandatory + 2 optional adversarial fixtures targeting the E↔F
 * doctrine boundary must exist, AND the runtime ban-list scanner must
 * reject every fallacy / fallacious / weak argument / invalid argument /
 * bad reasoning / flawed / wrong / proof of / unmet-means-fallacy /
 * proves wrong / invalidates / refutes token (12 D5 BINDING tokens)
 * that the model might emit.
 *
 * Per intent §6 trigger #17 + #18 + #21 + #22: a FAIL on any one
 * adversarial assertion is a doctrine violation requiring revert.
 *
 * Fixture matrix:
 *   - Fixture A (mandatory): scheme present, CQ unmet, no fallacy framing
 *     in input. Tests existential E↔F doctrine boundary.
 *   - Fixture B (mandatory): scheme present, CQ MET (probability anchors).
 *     Doctrine-clean baseline.
 *   - Fixture C (mandatory): input contains "fallacy" TWICE. Adversarial —
 *     model must detect unmet CQ without echoing the fallacy framing.
 *     EXISTENTIAL ADVERSARIAL.
 *   - Fixture D (optional): multi-CQ mixed states.
 *   - Fixture E (optional): adversarial verdict-baiting wording.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  scanFamilyFBooleanResponseForBanList,
  FAMILY_F_BAN_PATTERNS,
} from '../lib/familyFBanListScan.ts';
import type { McpBooleanObservationValidatedResponse } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { FAMILY_F_PROMPT_ENTRIES } from '../lib/familyFKeys.ts';

const FIXTURE_DIR = new URL('../fixtures/', import.meta.url);

async function loadFixture(name: string): Promise<unknown> {
  const url = new URL(name, FIXTURE_DIR);
  const text = await Deno.readTextFile(url);
  return JSON.parse(text);
}

function buildCqResponse(
  rawKey: string,
  evidenceSpanValue: string | null,
): McpBooleanObservationValidatedResponse {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'fixture-node-cq-doctrine-test',
    checkedRawKeys: [rawKey],
    observations: { [rawKey]: true },
    confidence: { [rawKey]: 'high' },
    evidenceSpan: { [rawKey]: evidenceSpanValue },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-f-v1',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Design §4 D4 BINDING: 3 mandatory + 2 optional adversarial fixtures
// ─────────────────────────────────────────────────────────────────────────

Deno.test('design §4 D4.A (mandatory): cq-unmet-slippery-slope fixture exists and is parseable', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-f-cq-unmet-slippery-slope-request.json',
  );
  if (typeof fixture !== 'object' || fixture === null) {
    throw new Error('cq-unmet-slippery-slope fixture not parseable as object');
  }
  const wrapper = fixture as { tool: string; input: Record<string, unknown> };
  assertEquals(wrapper.tool, 'classify_argument_boolean_observations');
  const rawKeys = wrapper.input.requestedRawKeys as string[];
  if (!rawKeys.includes('consequence_probability_unclear')) {
    throw new Error(
      'cq-unmet-slippery-slope fixture should request consequence_probability_unclear',
    );
  }
  const families = wrapper.input.requestedFamilies as string[];
  if (!families.includes('critical_question')) {
    throw new Error('cq-unmet-slippery-slope fixture should request critical_question family');
  }
});

Deno.test('design §4 D4.A: cq-unmet-slippery-slope input contains slippery-slope chain pattern', async () => {
  // The fixture reuses Family E's slippery-slope-clear input verbatim
  // (per design §9 ledger item 4): proves F can flag the unmet CQ on the
  // same text WITHOUT labeling E's scheme a fallacy.
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-f-cq-unmet-slippery-slope-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  if (!/second category/i.test(moveText) || !/third/i.test(moveText)) {
    throw new Error(
      'cq-unmet-slippery-slope fixture should contain chain-of-consequences text. Got: ' +
        moveText,
    );
  }
});

Deno.test('design §4 D4.B (mandatory): cq-met-baseline fixture exists and is parseable', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-f-cq-met-baseline-request.json',
  );
  const wrapper = fixture as { tool: string; input: Record<string, unknown> };
  assertEquals(wrapper.tool, 'classify_argument_boolean_observations');
  const rawKeys = wrapper.input.requestedRawKeys as string[];
  if (!rawKeys.includes('consequence_probability_unclear')) {
    throw new Error('cq-met-baseline fixture should request consequence_probability_unclear');
  }
});

Deno.test('design §4 D4.B: cq-met-baseline input contains probability anchors (CQ MET)', async () => {
  // Fixture B establishes the doctrine-clean negative baseline. The input
  // explicitly anchors probabilities — the CQ should NOT fire.
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-f-cq-met-baseline-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  if (!/70-80%/i.test(moveText) && !/probability/i.test(moveText)) {
    throw new Error(
      'cq-met-baseline fixture should contain explicit probability anchors. Got: ' + moveText,
    );
  }
});

Deno.test('design §4 D4.C BINDING (mandatory): cq-adversarial-fallacy-word fixture INPUT contains "fallacy"', async () => {
  // The existential adversarial test. The input deliberately contains the
  // word "fallacy" TWICE. The classifier's job is to detect the underlying
  // CQ gap without echoing the framing in its OUTPUT evidenceSpan.
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-f-cq-adversarial-fallacy-word-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  const fallacyMatches = moveText.match(/\bfallacy\b/gi);
  if (!fallacyMatches || fallacyMatches.length < 2) {
    throw new Error(
      `design §4 D4.C BINDING: cq-adversarial-fallacy-word fixture MUST contain "fallacy" at least twice in input. Got: ${moveText}`,
    );
  }
});

Deno.test('design §4 D4.C: cq-adversarial-fallacy-word fixture is parseable and targets consequence_probability_unclear', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-f-cq-adversarial-fallacy-word-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const rawKeys = fixture.input.requestedRawKeys as string[];
  if (!rawKeys.includes('consequence_probability_unclear')) {
    throw new Error(
      'cq-adversarial-fallacy-word fixture should request consequence_probability_unclear',
    );
  }
});

Deno.test('design §4 D4.D (optional): multi-cq-mixed fixture is parseable, requests ≥4 CQ rawKeys', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-f-multi-cq-mixed-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const rawKeys = fixture.input.requestedRawKeys as string[];
  if (rawKeys.length < 4) {
    throw new Error(
      `multi-cq-mixed fixture should request at least 4 CQ rawKeys for selectivity proof. Got: ${rawKeys.length}`,
    );
  }
});

Deno.test('design §4 D4.E (optional): adversarial-verdict-baiting fixture is parseable + input contains bait words', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-f-adversarial-verdict-baiting-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const moveText = fixture.input.currentText as string;
  // Input should contain verdict-bait words for the adversarial test
  // (the F ban-list catches these in OUTPUT, not input — fixture is bait).
  if (!/invalid|flawed|wrong|fallacy/i.test(moveText)) {
    throw new Error(
      'adversarial-verdict-baiting fixture INPUT should contain bait verdict words. Got: ' +
        moveText,
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Runtime ban-list assertions: 12 D5 BINDING tokens
// (intent §4 D5 + design §3 ban-list scope; HALT trigger #19)
// ─────────────────────────────────────────────────────────────────────────

Deno.test('design §3 BINDING: ban-list rejects "fallacy" in consequence_probability_unclear evidenceSpan', () => {
  const response = buildCqResponse(
    'consequence_probability_unclear',
    'this argument is a slippery-slope fallacy with no probability anchor',
  );
  const result = scanFamilyFBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'evidenceSpan.consequence_probability_unclear');
  }
});

Deno.test('design §3 BINDING: ban-list rejects "fallacious" in evidenceSpan', () => {
  const response = buildCqResponse(
    'consequence_probability_unclear',
    'the chain reasoning is fallacious',
  );
  const result = scanFamilyFBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §3 BINDING: ban-list rejects "weak argument" two-word phrase in evidenceSpan', () => {
  const response = buildCqResponse(
    'missing_warrant',
    'this is a weak argument because the warrant is missing',
  );
  const result = scanFamilyFBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §3 BINDING: ban-list rejects "invalid argument" two-word phrase in evidenceSpan', () => {
  const response = buildCqResponse(
    'causal_mechanism_missing',
    'this is an invalid argument without a mechanism',
  );
  const result = scanFamilyFBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §3 BINDING: ban-list rejects "bad reasoning" two-word phrase in evidenceSpan', () => {
  const response = buildCqResponse(
    'analogy_mapping_missing',
    'this is bad reasoning when no analogy mapping is given',
  );
  const result = scanFamilyFBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §3 BINDING: ban-list rejects "flawed" single-token in evidenceSpan', () => {
  const response = buildCqResponse(
    'authority_basis_missing',
    'the authority appeal is flawed at the base',
  );
  const result = scanFamilyFBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §3 BINDING: ban-list rejects "wrong" single-token in evidenceSpan', () => {
  const response = buildCqResponse(
    'counterexample_available',
    'the generalization is wrong because counterexamples exist',
  );
  const result = scanFamilyFBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §3 BINDING: ban-list rejects "proof of" two-word phrase in evidenceSpan', () => {
  const response = buildCqResponse(
    'comparison_baseline_missing',
    'this is proof of incomplete comparison',
  );
  const result = scanFamilyFBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §3 BINDING D5: ban-list rejects "unmet-means-fallacy" CQ-specific compound in evidenceSpan', () => {
  // The existential CQ-as-verdict compound. Per intent §6 trigger #17:
  // this exact failure mode is what Family F's defense prevents.
  const response = buildCqResponse(
    'consequence_probability_unclear',
    'this is an unmet-means-fallacy pattern',
  );
  const result = scanFamilyFBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §3 BINDING D5: ban-list rejects "proves wrong" CQ-specific compound in evidenceSpan', () => {
  const response = buildCqResponse(
    'consequence_probability_unclear',
    'the gap proves wrong the chain inference',
  );
  const result = scanFamilyFBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §3 BINDING D5: ban-list rejects "invalidates" CQ-specific compound in evidenceSpan', () => {
  const response = buildCqResponse(
    'alternative_explanation_available',
    'the alternative invalidates the abductive inference',
  );
  const result = scanFamilyFBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §3 BINDING D5: ban-list rejects "refutes" CQ-specific compound in evidenceSpan', () => {
  const response = buildCqResponse(
    'counterexample_available',
    'the counterexample refutes the generalization',
  );
  const result = scanFamilyFBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('design §3 BINDING: clean CQ evidenceSpan (anchoring gap text without verdict framing) passes ban-list', () => {
  // The positive case: the classifier produced a doctrine-clean output that
  // anchors the CQ probability gap with a verbatim quote — no fallacy framing.
  const response = buildCqResponse(
    'consequence_probability_unclear',
    'they will expand to a second category, then a third, then a fourth',
  );
  const result = scanFamilyFBooleanResponseForBanList(response);
  assertEquals(result.ok, true);
});

Deno.test('design §3 BINDING: FAMILY_F_BAN_PATTERNS contains all 12 D5 binding tokens', () => {
  // The intent §4 D5 BINDING token list. Each token MUST have a
  // corresponding pattern in FAMILY_F_BAN_PATTERNS.
  // 4 CQ-specific compounds + 4 single-token verdicts + 4 two-word phrases.
  const targetTokens = [
    // CQ-specific compounds (4)
    'unmet-means-fallacy',
    'proves wrong',
    'invalidates',
    'refutes',
    // Single-token verdicts (4)
    'fallacy',
    'fallacious',
    'flawed',
    'wrong',
    // Two-word phrases (4)
    'weak argument',
    'invalid argument',
    'bad reasoning',
    'proof of',
  ];
  for (const token of targetTokens) {
    const pattern = FAMILY_F_BAN_PATTERNS.find((p) => p.test(`prefix ${token} suffix`));
    if (!pattern) {
      throw new Error(`FAMILY_F_BAN_PATTERNS missing pattern for D5 token: '${token}'`);
    }
  }
  // 12 D5 binding tokens, but the FAMILY_F_BAN_PATTERNS array contains
  // exactly 12 patterns (one per token).
  assertEquals(FAMILY_F_BAN_PATTERNS.length, 12);
});

Deno.test('design §3 reviewer matrix sub-check: consequence_probability_unclear prompt entry doctrine guard surfaces verbatim', () => {
  // Reviewer matrix sub-check (1): the per-key falsePositiveGuards for
  // consequence_probability_unclear contain verbatim text forbidding the
  // output from labeling the CQ as a fallacy / weak / invalid / flawed /
  // bad-reasoning / wrong / proves-wrong / refutes / invalidates /
  // unmet-means-fallacy.
  const entry = FAMILY_F_PROMPT_ENTRIES.find((e) => e.rawKey === 'consequence_probability_unclear');
  if (!entry) throw new Error('consequence_probability_unclear prompt entry missing');
  const expectedForbiddenWords = [
    'fallacy',
    'fallacious',
    'weak',
    'invalid',
    'flawed',
    'wrong',
    'bad reasoning',
    'proves wrong',
    'refutes',
    'invalidates',
    'unmet-means-fallacy',
  ];
  // The guard must explicitly list these as forbidden via "MUST NOT contain".
  for (const word of expectedForbiddenWords) {
    if (!entry.falsePositiveGuards.includes(word)) {
      throw new Error(
        `consequence_probability_unclear falsePositiveGuards missing explicit mention of '${word}' as forbidden output`,
      );
    }
  }
});

// ─────────────────────────────────────────────────────────────────────────
// E↔F doctrine cross-checks (per design §3): F output classifying
// Fixture A's slippery-slope text MUST NOT produce E-style fallacy verdict
// even if F's CQ fires.
// ─────────────────────────────────────────────────────────────────────────

Deno.test('design §3 E↔F cross-check: Fixture A clean CQ-positive output passes F ban-list', () => {
  // The E↔F partnership: same input text Family E's smoke run classified
  // WITHOUT fallacy framing. If F flags the CQ as unmet, the evidenceSpan
  // anchors the probability gap (verbatim quote) — not a verdict.
  const response = buildCqResponse(
    'consequence_probability_unclear',
    'they will expand to a second category, then a third, then a fourth',
  );
  const result = scanFamilyFBooleanResponseForBanList(response);
  assertEquals(result.ok, true);
});

Deno.test('design §3 E↔F cross-check: simulated F-on-Fixture-C output (CQ fires; clean evidenceSpan) passes', () => {
  // Fixture C input contains "fallacy" twice. The model's job: detect the
  // unmet probability CQ if present, but anchor the evidenceSpan on the
  // STRUCTURAL GAP (e.g., "probabilities are not the point"), NOT on the
  // fallacy framing words from input.
  const response = buildCqResponse(
    'consequence_probability_unclear',
    'probabilities are not the point: once a single category gets restricted',
  );
  const result = scanFamilyFBooleanResponseForBanList(response);
  assertEquals(result.ok, true);
});

Deno.test('design §3 E↔F cross-check: simulated F-on-Fixture-C output (CQ fires; echoes "fallacy") FAILS', () => {
  // The negative pole. If the model lifted "fallacy" from input into its
  // evidenceSpan, the ban-list MUST catch it. This is the existential
  // adversarial proof.
  const response = buildCqResponse(
    'consequence_probability_unclear',
    'critics call this a slippery-slope fallacy',
  );
  const result = scanFamilyFBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});
