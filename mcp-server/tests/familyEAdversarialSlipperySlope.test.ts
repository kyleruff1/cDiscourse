/**
 * MCP-SERVER-006-FAMILY-E — Adversarial slippery_slope doctrine tests
 * (amendment §2 BINDING).
 *
 * This file is dedicated to the amendment §2 binding requirement: ≥3
 * adversarial fixtures targeting slippery_slope_reasoning_present must
 * exist, AND the runtime ban-list scanner must reject every fallacy /
 * weak / invalid / flawed / wrong / bad-reasoning / logical-error /
 * informal-fallacy / proof-of token that the model might emit.
 *
 * Per design §11 reviewer matrix item: the 7 sub-checks for the
 * slippery_slope doctrine item are encoded as individual Deno.test
 * cases below. A FAIL on any one is a doctrine violation requiring
 * revert.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  scanFamilyEBooleanResponseForBanList,
  FAMILY_E_BAN_PATTERNS,
} from '../lib/familyEBanListScan.ts';
import type { McpBooleanObservationValidatedResponse } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { FAMILY_E_PROMPT_ENTRIES } from '../lib/familyEKeys.ts';

const FIXTURE_DIR = new URL('../fixtures/', import.meta.url);

async function loadFixture(name: string): Promise<unknown> {
  const url = new URL(name, FIXTURE_DIR);
  const text = await Deno.readTextFile(url);
  return JSON.parse(text);
}

function buildSlipperySlopeResponse(
  evidenceSpanValue: string | null,
): McpBooleanObservationValidatedResponse {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'fixture-node-slippery-slope-test',
    checkedRawKeys: ['slippery_slope_reasoning_present'],
    observations: { slippery_slope_reasoning_present: true },
    confidence: { slippery_slope_reasoning_present: 'high' },
    evidenceSpan: { slippery_slope_reasoning_present: evidenceSpanValue },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-e-v1',
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Amendment §2 BINDING: 3 adversarial fixtures targeting slippery_slope
// ─────────────────────────────────────────────────────────────────────────

Deno.test('amendment §2.1: family-e-slippery-slope-clear fixture exists and is parseable', async () => {
  const fixture = await loadFixture(
    'classify-argument-boolean-observations.family-e-slippery-slope-clear-request.json',
  );
  if (typeof fixture !== 'object' || fixture === null) {
    throw new Error('slippery-slope-clear fixture not parseable as object');
  }
  const wrapper = fixture as { tool: string; input: Record<string, unknown> };
  assertEquals(wrapper.tool, 'classify_argument_boolean_observations');
  const rawKeys = wrapper.input.requestedRawKeys as string[];
  if (!rawKeys.includes('slippery_slope_reasoning_present')) {
    throw new Error('slippery-slope-clear fixture should request slippery_slope_reasoning_present');
  }
});

Deno.test('amendment §2.2 BINDING: adversarial-fallacy-word fixture INPUT contains "fallacy"', async () => {
  // The existential adversarial test. The input deliberately contains the
  // word "fallacy". The classifier's job is to detect the underlying
  // slippery-slope PATTERN without echoing the framing in its OUTPUT.
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-e-slippery-slope-adversarial-fallacy-word-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  const moveText = fixture.input.currentText as string;
  if (!/\bfallacy\b/i.test(moveText)) {
    throw new Error(
      `amendment §2.2 BINDING: adversarial-fallacy-word fixture MUST contain "fallacy" in input. Got: ${moveText}`,
    );
  }
});

Deno.test('amendment §2.2: adversarial-fallacy-word fixture is parseable and targets slippery_slope', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-e-slippery-slope-adversarial-fallacy-word-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const rawKeys = fixture.input.requestedRawKeys as string[];
  if (!rawKeys.includes('slippery_slope_reasoning_present')) {
    throw new Error('adversarial-fallacy-word fixture should request slippery_slope_reasoning_present');
  }
});

Deno.test('amendment §2.3: multi-scheme fixture is parseable, targets slippery_slope + at least 1 other scheme', async () => {
  const fixture = (await loadFixture(
    'classify-argument-boolean-observations.family-e-slippery-slope-multi-scheme-request.json',
  )) as { tool: string; input: Record<string, unknown> };
  assertEquals(fixture.tool, 'classify_argument_boolean_observations');
  const rawKeys = fixture.input.requestedRawKeys as string[];
  if (!rawKeys.includes('slippery_slope_reasoning_present')) {
    throw new Error('multi-scheme fixture should request slippery_slope_reasoning_present');
  }
  const otherSchemes = rawKeys.filter((k) => k !== 'slippery_slope_reasoning_present');
  if (otherSchemes.length === 0) {
    throw new Error('multi-scheme fixture should request at least 1 OTHER scheme beyond slippery_slope');
  }
});

// ─────────────────────────────────────────────────────────────────────────
// Runtime ban-list assertions: smuggled fallacy/weak/invalid/etc. variants
// must be rejected by the Family E scanner (amendment §3 BINDING)
// ─────────────────────────────────────────────────────────────────────────

Deno.test('amendment §3 BINDING: ban-list rejects smuggled "fallacy" in slippery_slope evidenceSpan', () => {
  // The existential constraint. Even if the classifier somehow produces a
  // slippery_slope-true response with "fallacy" in the evidenceSpan, the
  // ban-list scan catches it before the response reaches the client.
  const response = buildSlipperySlopeResponse('this is a slippery-slope fallacy chain');
  const result = scanFamilyEBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.path, 'evidenceSpan.slippery_slope_reasoning_present');
  }
});

Deno.test('amendment §3 BINDING: ban-list rejects "weak argument" in slippery_slope evidenceSpan', () => {
  const response = buildSlipperySlopeResponse('this is a weak argument with a chain');
  const result = scanFamilyEBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('amendment §3 BINDING: ban-list rejects "invalid" in slippery_slope evidenceSpan', () => {
  const response = buildSlipperySlopeResponse('the chain inference is invalid here');
  const result = scanFamilyEBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('amendment §3 BINDING: ban-list rejects "flawed" in slippery_slope evidenceSpan', () => {
  const response = buildSlipperySlopeResponse('the reasoning chain is flawed at step 3');
  const result = scanFamilyEBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('amendment §3 BINDING: ban-list rejects "wrong" in slippery_slope evidenceSpan', () => {
  const response = buildSlipperySlopeResponse('this chain inference is wrong');
  const result = scanFamilyEBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('amendment §3 BINDING: ban-list rejects "proof of" two-word phrase in slippery_slope evidenceSpan', () => {
  const response = buildSlipperySlopeResponse('this is proof of cascading consequences');
  const result = scanFamilyEBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('amendment §3 BINDING: ban-list rejects "logical error" two-word phrase in slippery_slope evidenceSpan', () => {
  const response = buildSlipperySlopeResponse('a logical error in the chain transitions');
  const result = scanFamilyEBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('amendment §3 BINDING: ban-list rejects "informal fallacy" two-word phrase in slippery_slope evidenceSpan', () => {
  const response = buildSlipperySlopeResponse('this counts as informal fallacy');
  const result = scanFamilyEBooleanResponseForBanList(response);
  assertEquals(result.ok, false);
});

Deno.test('amendment §3 BINDING: clean slippery_slope evidenceSpan (anchoring chain text) passes ban-list', () => {
  // The positive case: the classifier produced a doctrine-clean output that
  // anchors the chain pattern with a verbatim quote from the input — no
  // fallacy framing. This is the desired output shape.
  const response = buildSlipperySlopeResponse(
    'expand to a second category, then a third, then a fourth',
  );
  const result = scanFamilyEBooleanResponseForBanList(response);
  assertEquals(result.ok, true);
});

Deno.test('amendment §3 BINDING: FAMILY_E_BAN_PATTERNS contains all 11 amendment binding tokens', () => {
  // The amendment §3 BINDING token list. Each token MUST have a
  // corresponding pattern in FAMILY_E_BAN_PATTERNS. The 12th pattern
  // ('proof of') is defense-in-depth — also exists in shared
  // DOCTRINE_BAN_PATTERNS.
  const targetTokens = [
    'fallacy',
    'fallacious',
    'invalid',
    'flawed',
    'wrong',
    'weak argument',
    'invalid argument',
    'bad reasoning',
    'flawed reasoning',
    'logical error',
    'informal fallacy',
  ];
  for (const token of targetTokens) {
    const pattern = FAMILY_E_BAN_PATTERNS.find((p) => p.test(`prefix ${token} suffix`));
    if (!pattern) {
      throw new Error(`FAMILY_E_BAN_PATTERNS missing pattern for amendment §3 token: '${token}'`);
    }
  }
});

Deno.test('design §11 reviewer matrix sub-check: slippery_slope prompt entry doctrine guard surfaces verbatim', () => {
  // Reviewer matrix sub-check (1) and (2): the per-key falsePositiveGuards
  // for slippery_slope_reasoning_present contain verbatim text forbidding
  // the output from labeling the pattern as a fallacy / weak / invalid /
  // flawed / bad-reasoning / logical-error / wrong / proof-of.
  const entry = FAMILY_E_PROMPT_ENTRIES.find((e) => e.rawKey === 'slippery_slope_reasoning_present');
  if (!entry) throw new Error('slippery_slope_reasoning_present prompt entry missing');
  const expectedForbiddenWords = [
    'fallacy',
    'fallacious',
    'weak',
    'invalid',
    'bad reasoning',
    'flawed',
    'wrong',
    'proof of',
    'logical error',
  ];
  // The guard must explicitly list these as forbidden via "MUST NOT contain".
  for (const word of expectedForbiddenWords) {
    if (!entry.falsePositiveGuards.includes(word)) {
      throw new Error(
        `slippery_slope_reasoning_present falsePositiveGuards missing explicit mention of '${word}' as forbidden output`,
      );
    }
  }
});
