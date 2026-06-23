/**
 * MCP-EGI-006 — Tests for the pre-validation evidenceSpan length-overflow
 * normalizer.
 *
 * Three layers:
 *
 *   1. Helper unit tests — the four target rawKeys (E
 *      `tradeoff_reasoning_present` / `convergent_premise_structure`,
 *      G `synthesis_proposed`, I `compares_options`) are normalized to null
 *      when their evidenceSpan string is >240 chars; everything else is
 *      byte-identical.
 *
 *   2. Doctrine-preservation tests — an overlong string that contains
 *      banned content under the family's pattern set is NOT normalized;
 *      the validator's length reject still fires. This is the GATE-A
 *      preservation requirement: the helper never silently discards
 *      banned content.
 *
 *   3. Validator-preservation integration tests — direct validator calls
 *      against (overlong + target rawKey) still fail; the normalizer's
 *      output (post-null) passes; non-target rawKeys' overlong strings
 *      still fail; safe-log events carry no raw span content.
 *
 * No raw evidenceSpan values are surfaced in event fields — only the
 * structural identifiers `family` / `rawKey` / `path` / `category` /
 * `originalLength` / `maxLength` / `schemaVersion` / `requestId`.
 */
import { assertEquals, assertNotStrictEquals, assertStrictEquals } from 'std/assert/mod.ts';
import {
  EVIDENCE_SPAN_KEY_SET_COMPLETE_KEYS,
  EVIDENCE_SPAN_KEY_SET_COMPLETION_CATEGORY,
  EVIDENCE_SPAN_KEY_SET_COMPLETION_EVENT_NAME,
  EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS_DEPRECATED,
  EVIDENCE_SPAN_NORMALIZATION_CATEGORY,
  EVIDENCE_SPAN_NORMALIZATION_EVENT_NAME,
  LENGTH_NORMALIZE_ELIGIBLE_FAMILIES,
  normalizeLongEvidenceSpansForBooleanObservations,
} from '../lib/booleanObservationEvidenceSpanNormalizer.ts';
import {
  MAX_EVIDENCE_SPAN_CHARS,
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  validateMcpBooleanObservationResponse,
} from '../lib/mcpBooleanObservationSchemaMirror.ts';

interface TargetCase {
  readonly family: string;
  readonly classifierSetVersion: string;
  readonly rawKey: string;
}

const TARGETS: readonly TargetCase[] = [
  {
    family: 'argument_scheme',
    classifierSetVersion: 'family-e-v1',
    rawKey: 'tradeoff_reasoning_present',
  },
  {
    family: 'argument_scheme',
    classifierSetVersion: 'family-e-v1',
    rawKey: 'convergent_premise_structure',
  },
  {
    family: 'resolution_progress',
    classifierSetVersion: 'family-g-v1',
    rawKey: 'synthesis_proposed',
  },
  {
    family: 'thread_topology',
    classifierSetVersion: 'family-i-v1',
    rawKey: 'compares_options',
  },
  {
    // MCP-EGI-007 — added on the basis of the post-MCP-EGI-006 D3 canary
    // (target `72a5526c-7ab1-4ca4-85f7-1a651ad64565`) whose H row carried
    // validator_path=`evidenceSpan.reason_present` +
    // mcp_tool_detail_category=`evidence_span_length_exceeded`. The
    // for-loop below templates the normalize / boundary / post-validation /
    // doctrine-preservation / type-branch tests across all targets.
    family: 'claim_clarity',
    classifierSetVersion: 'family-h-v1',
    rawKey: 'reason_present',
  },
  // MCP-EGI-008 — added on the basis of the post-MCP-EGI-007 D3 burst (debate
  // `bd7b732c-306a-4c11-b5c3-9d3cafd2bbbc`, 2026-06-22T08:15:54Z; 8 targets ×
  // 9 families = 72 cells). The burst surfaced 8 additional rawKeys with
  // `evidence_span_length_exceeded` row evidence that the canary's single-target
  // shape didn't trigger. Each rawKey's family is already in
  // KEY_LEVEL_FAIL_CLOSED_FAMILIES so banPatternsForKeyLevelFamily() composes
  // the correct stack; no dispatcher/ban-list/validator changes required.
  {
    family: 'parent_relation',
    classifierSetVersion: 'family-a-v1',
    rawKey: 'contrasts_with_parent',
  },
  {
    family: 'disagreement_axis',
    classifierSetVersion: 'family-b-v1',
    rawKey: 'preserves_face_while_disagreeing',
  },
  {
    family: 'misunderstanding_repair',
    classifierSetVersion: 'family-c-v1',
    rawKey: 'provides_alternate_interpretation',
  },
  {
    family: 'evidence_source_chain',
    classifierSetVersion: 'family-d-v1',
    rawKey: 'evidence_gap_present',
  },
  {
    family: 'evidence_source_chain',
    classifierSetVersion: 'family-d-v1',
    rawKey: 'names_method_difference',
  },
  {
    family: 'argument_scheme',
    classifierSetVersion: 'family-e-v1',
    rawKey: 'analogy_reasoning_present',
  },
  {
    family: 'resolution_progress',
    classifierSetVersion: 'family-g-v1',
    rawKey: 'separates_normative_from_empirical',
  },
  {
    family: 'claim_clarity',
    classifierSetVersion: 'family-h-v1',
    rawKey: 'claim_present',
  },
  // MCP-EGI-010 — added on the basis of the post-MCP-EGI-009 D3 burst (debate
  // `4d75daeb-f09a-430d-aa01-3ee6374922c6`, 2026-06-23T05:04:25Z; 8 targets ×
  // 9 families = 72 cells, runId `28eb3908-2d39-4a37-a34a-3de5256ba807`). This
  // was the FIRST burst against the verified MCP-EGI-008 + MCP-EGI-009
  // production deploy. The 13 EGI-008 length-targets and 3 EGI-009 key-set-
  // completion targets BOTH worked as designed; the burst surfaced 7 NEW
  // distinct length-overflow rawKeys with row-level evidence
  // (`multiple_claims_present` recurring 3×, `missing_warrant` 2×,
  // `separates_observation_from_inference` 2×, others 1×). Each family is
  // already in KEY_LEVEL_FAIL_CLOSED_FAMILIES; no dispatcher/ban-list/
  // validator/prompt change required. Note Family F (`critical_question`)
  // gains its FIRST length-normalize rawKey via `missing_warrant`.
  {
    family: 'parent_relation',
    classifierSetVersion: 'family-a-v1',
    rawKey: 'distinguishes_parent',
  },
  {
    family: 'disagreement_axis',
    classifierSetVersion: 'family-b-v1',
    rawKey: 'disputes_scope',
  },
  {
    family: 'misunderstanding_repair',
    classifierSetVersion: 'family-c-v1',
    rawKey: 'offers_candidate_understanding',
  },
  {
    family: 'evidence_source_chain',
    classifierSetVersion: 'family-d-v1',
    rawKey: 'separates_observation_from_inference',
  },
  {
    family: 'critical_question',
    classifierSetVersion: 'family-f-v1',
    rawKey: 'missing_warrant',
  },
  {
    family: 'claim_clarity',
    classifierSetVersion: 'family-h-v1',
    rawKey: 'multiple_claims_present',
  },
  {
    family: 'thread_topology',
    classifierSetVersion: 'family-i-v1',
    rawKey: 'introduces_sub_axis',
  },
  // MCP-EGI-012 — added on the basis of the post-MCP-EGI-010 D3 burst (debate
  // `f4655492-d24b-4223-aa64-de17a577f8c1`, 2026-06-23T19:09:56Z; runId
  // `719b7b8f-7ac7-44df-bb79-4ea3d38e210c`; 8 targets × 9 families = 72 cells).
  // These 10 rawKeys are the THIRD-burst length-overflow surface. With
  // MCP-EGI-012's categorical eligibility rule, every family-valid rawKey is
  // covered automatically; these TARGETS exist to PROVE that the new categorical
  // rule actually covers each of them end-to-end (not just in theory).
  {
    family: 'parent_relation',
    classifierSetVersion: 'family-a-v1',
    rawKey: 'summarizes_parent',
  },
  {
    family: 'parent_relation',
    classifierSetVersion: 'family-a-v1',
    rawKey: 'supports_parent',
  },
  {
    family: 'parent_relation',
    classifierSetVersion: 'family-a-v1',
    rawKey: 'challenges_parent',
  },
  {
    family: 'disagreement_axis',
    classifierSetVersion: 'family-b-v1',
    rawKey: 'disagreement_present',
  },
  {
    family: 'disagreement_axis',
    classifierSetVersion: 'family-b-v1',
    rawKey: 'disputes_evidence_applicability',
  },
  {
    family: 'misunderstanding_repair',
    classifierSetVersion: 'family-c-v1',
    rawKey: 'scope_mismatch_identified',
  },
  {
    family: 'evidence_source_chain',
    classifierSetVersion: 'family-d-v1',
    rawKey: 'concrete_example_provided',
  },
  {
    family: 'critical_question',
    classifierSetVersion: 'family-f-v1',
    rawKey: 'example_representativeness_unclear',
  },
  {
    family: 'resolution_progress',
    classifierSetVersion: 'family-g-v1',
    rawKey: 'defines_next_evidence_needed',
  },
  {
    family: 'resolution_progress',
    classifierSetVersion: 'family-g-v1',
    rawKey: 'unresolved_point_isolated',
  },
];

function basePacket(
  testCase: TargetCase,
  span: string | null | unknown,
): Record<string, unknown> {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'egi-006-node-1',
    checkedRawKeys: [testCase.rawKey],
    observations: { [testCase.rawKey]: true },
    confidence: { [testCase.rawKey]: 'medium' },
    evidenceSpan: { [testCase.rawKey]: span as string | null },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: testCase.classifierSetVersion,
    },
  };
}

Deno.test('MCP-EGI-012 — LENGTH_NORMALIZE_ELIGIBLE_FAMILIES is exactly A-I (9 production families)', () => {
  // The categorical eligibility rule replaces the prior MCP-EGI-006 → 010 narrow
  // allowlist trajectory (4 → 5 → 13 → 20 rawKeys). The new invariant: any
  // family-valid rawKey under one of the 9 production families A-I is eligible.
  // Family J `sensitive_composer` is EXCLUDED here even though it is registered
  // in the mcp-server familyRegistry singleton, because J is
  // `productionEnabled:false` at the Edge boundary. This test guards against
  // accidental drift (e.g., re-adding J without a doctrine review, or dropping
  // one of the 9 production families).
  assertEquals(
    [...LENGTH_NORMALIZE_ELIGIBLE_FAMILIES].sort(),
    [
      'argument_scheme',         // Family E
      'claim_clarity',           // Family H
      'critical_question',       // Family F
      'disagreement_axis',       // Family B
      'evidence_source_chain',   // Family D
      'misunderstanding_repair', // Family C
      'parent_relation',         // Family A
      'resolution_progress',     // Family G
      'thread_topology',         // Family I
    ],
  );
  assertEquals(LENGTH_NORMALIZE_ELIGIBLE_FAMILIES.size, 9);
  // Explicit J exclusion guard.
  assertEquals(LENGTH_NORMALIZE_ELIGIBLE_FAMILIES.has('sensitive_composer'), false);
});

Deno.test('MCP-EGI-012 — DEPRECATED 20-key allowlist constant is frozen as a historical record', () => {
  // Historical allowlist from the MCP-EGI-006 → 007 → 008 → 010 trajectory.
  // No longer consulted by Pass 1 (categorical eligibility is now the source of
  // truth). Frozen here so historical analyses can introspect the prior
  // trajectory. Adding a new key here would NOT widen normalizer scope; it
  // would just create a stale comment. This test pins the frozen contents.
  assertEquals(
    [...EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS_DEPRECATED].sort(),
    [
      'analogy_reasoning_present',
      'claim_present',
      'compares_options',
      'contrasts_with_parent',
      'convergent_premise_structure',
      'disputes_scope',
      'distinguishes_parent',
      'evidence_gap_present',
      'introduces_sub_axis',
      'missing_warrant',
      'multiple_claims_present',
      'names_method_difference',
      'offers_candidate_understanding',
      'preserves_face_while_disagreeing',
      'provides_alternate_interpretation',
      'reason_present',
      'separates_normative_from_empirical',
      'separates_observation_from_inference',
      'synthesis_proposed',
      'tradeoff_reasoning_present',
    ],
  );
  assertEquals(EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS_DEPRECATED.size, 20);
});

Deno.test('MCP-EGI-006 — event and category constants are stable structural identifiers', () => {
  assertEquals(EVIDENCE_SPAN_NORMALIZATION_EVENT_NAME, 'boolean_observations_evidence_span_normalized');
  assertEquals(EVIDENCE_SPAN_NORMALIZATION_CATEGORY, 'evidence_span_length_exceeded_to_null');
});

for (const testCase of TARGETS) {
  Deno.test(`MCP-EGI-006 — ${testCase.family} / ${testCase.rawKey}: 241-char string normalized to null`, () => {
    const overlong = 'a'.repeat(MAX_EVIDENCE_SPAN_CHARS + 1);
    const packet = basePacket(testCase, overlong);
    const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
      family: testCase.family,
      schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
      requestId: 'egi-006-req-1',
    });
    const normalizedSpans = result.packet.evidenceSpan as Record<string, unknown>;
    assertEquals(normalizedSpans[testCase.rawKey], null);
    assertEquals(result.events.length, 1);
    assertEquals(result.events[0].rawKey, testCase.rawKey);
    assertEquals(result.events[0].path, `evidenceSpan.${testCase.rawKey}`);
    assertEquals(result.events[0].family, testCase.family);
    assertEquals(result.events[0].category, EVIDENCE_SPAN_NORMALIZATION_CATEGORY);
    assertEquals(result.events[0].event, EVIDENCE_SPAN_NORMALIZATION_EVENT_NAME);
    assertEquals(result.events[0].originalLength, MAX_EVIDENCE_SPAN_CHARS + 1);
    assertEquals(result.events[0].maxLength, MAX_EVIDENCE_SPAN_CHARS);
    assertEquals(result.events[0].schemaVersion, MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION);
    assertEquals(result.events[0].requestId, 'egi-006-req-1');
  });

  Deno.test(`MCP-EGI-006 — ${testCase.family} / ${testCase.rawKey}: exactly 240-char string preserved (boundary)`, () => {
    const atCap = 'a'.repeat(MAX_EVIDENCE_SPAN_CHARS);
    const packet = basePacket(testCase, atCap);
    const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
      family: testCase.family,
    });
    const spans = result.packet.evidenceSpan as Record<string, unknown>;
    assertEquals(spans[testCase.rawKey], atCap);
    assertEquals(result.events.length, 0);
    assertStrictEquals(result.packet, packet);
  });

  Deno.test(`MCP-EGI-006 — ${testCase.family} / ${testCase.rawKey}: post-normalization packet validates and observation preserved`, () => {
    const overlong = 'a'.repeat(MAX_EVIDENCE_SPAN_CHARS + 1);
    const packet = basePacket(testCase, overlong);
    const normalized = normalizeLongEvidenceSpansForBooleanObservations(packet, {
      family: testCase.family,
    });
    const validated = validateMcpBooleanObservationResponse(normalized.packet);
    assertEquals(validated.ok, true);
    if (validated.ok) {
      assertEquals(validated.value.observations[testCase.rawKey], true);
      assertEquals(validated.value.confidence[testCase.rawKey], 'medium');
      assertEquals(validated.value.evidenceSpan[testCase.rawKey], null);
    }
  });

  Deno.test(`MCP-EGI-006 — ${testCase.family} / ${testCase.rawKey}: doctrine preservation — overlong + banned content NOT normalized`, () => {
    // Pick a banned token from the SHARED DOCTRINE_BAN_PATTERNS set that
    // lives in every family's pattern stack. `winner` is in BANNED_TOKENS
    // (doctrineBanList.ts:32-46), so it matches under E/G/I/J and any
    // future widened family — no per-family token selection needed.
    const overlongBanned = ('the proposed winner is ' + 'b'.repeat(MAX_EVIDENCE_SPAN_CHARS)).slice(
      0,
      MAX_EVIDENCE_SPAN_CHARS + 1,
    );
    const packet = basePacket(testCase, overlongBanned);
    const normalized = normalizeLongEvidenceSpansForBooleanObservations(packet, {
      family: testCase.family,
    });
    const spans = normalized.packet.evidenceSpan as Record<string, unknown>;
    // The packet is untouched — the validator's length reject must still fire.
    assertEquals(spans[testCase.rawKey], overlongBanned);
    assertEquals(normalized.events.length, 0);
    // Validator still rejects with evidence_span_length_exceeded shape.
    const validated = validateMcpBooleanObservationResponse(normalized.packet);
    assertEquals(validated.ok, false);
    if (!validated.ok) {
      assertEquals(validated.path, `evidenceSpan.${testCase.rawKey}`);
    }
  });
}

Deno.test('MCP-EGI-006 — non-target rawKey: 241-char string NOT normalized (out of scope set)', () => {
  // `cited_source_present` is a real Family D rawKey but is NOT in the
  // confirmed length-residual set. Its overlong string must NOT be
  // normalized — the validator should reject it for length as it does today.
  const overlong = 'a'.repeat(MAX_EVIDENCE_SPAN_CHARS + 1);
  const packet = {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'egi-006-node-1',
    checkedRawKeys: ['cited_source_present'],
    observations: { cited_source_present: true },
    confidence: { cited_source_present: 'medium' },
    evidenceSpan: { cited_source_present: overlong },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-d-v1',
    },
  };
  const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
    family: 'evidence_source_chain',
  });
  const spans = result.packet.evidenceSpan as Record<string, unknown>;
  assertEquals(spans.cited_source_present, overlong);
  assertEquals(result.events.length, 0);
  const validated = validateMcpBooleanObservationResponse(result.packet);
  assertEquals(validated.ok, false);
  if (!validated.ok) {
    assertEquals(validated.path, 'evidenceSpan.cited_source_present');
  }
});

Deno.test('MCP-EGI-012 — cross-family rawKey: 241-char string NOT normalized (rawKey not valid for packet family)', () => {
  // Under MCP-EGI-012's categorical rule, eligibility is family-valid rawKey
  // membership, not a hand-maintained allowlist. So `quantifier_present` (a
  // real Family H rawKey) IS eligible under `claim_clarity` (Family H). To
  // test the family-mismatch reject path, this test puts `quantifier_present`
  // under family `argument_scheme` (Family E) — same rawKey but the WRONG
  // family. The categorical gate `isRawKeySupportedForFamily('argument_scheme',
  // 'quantifier_present')` returns false, so the normalizer leaves the value
  // untouched and the validator rejects on key-set asymmetry.
  //
  // History: MCP-EGI-007 used `claim_present` as the sibling; MCP-EGI-008
  // moved it in-scope, so the sibling was relocated to `quantifier_present`
  // for the MCP-EGI-008 / MCP-EGI-010 narrow-allowlist era. MCP-EGI-012's
  // categorical rule made `quantifier_present` ELIGIBLE under its native
  // family, so the negative case now exercises the CROSS-FAMILY mismatch.
  const overlong = 'a'.repeat(MAX_EVIDENCE_SPAN_CHARS + 1);
  const packet = {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'egi-012-node-cross-family',
    checkedRawKeys: ['quantifier_present'],
    observations: { quantifier_present: true },
    confidence: { quantifier_present: 'medium' },
    evidenceSpan: { quantifier_present: overlong },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-e-v1',
    },
  };
  // Note: family='argument_scheme' (Family E), but quantifier_present is a
  // Family H rawKey. isRawKeySupportedForFamily('argument_scheme',
  // 'quantifier_present') returns false → normalizer SKIPS this rawKey.
  const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
    family: 'argument_scheme',
  });
  const spans = result.packet.evidenceSpan as Record<string, unknown>;
  assertEquals(spans.quantifier_present, overlong);
  assertEquals(result.events.length, 0);
  const validated = validateMcpBooleanObservationResponse(result.packet);
  assertEquals(validated.ok, false);
  if (!validated.ok) {
    assertEquals(validated.path, 'evidenceSpan.quantifier_present');
  }
});

Deno.test('MCP-EGI-012 — Family H rawKey IS normalized under correct family (quantifier_present under claim_clarity)', () => {
  // The flip side of the cross-family test: `quantifier_present` under
  // family='claim_clarity' (its native Family H) IS eligible for normalization
  // under MCP-EGI-012's categorical rule, because the family is in
  // LENGTH_NORMALIZE_ELIGIBLE_FAMILIES and isRawKeySupportedForFamily(
  // 'claim_clarity', 'quantifier_present') returns true.
  const overlong = 'a'.repeat(MAX_EVIDENCE_SPAN_CHARS + 1);
  const packet = {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'egi-012-node-quant-h',
    checkedRawKeys: ['quantifier_present'],
    observations: { quantifier_present: true },
    confidence: { quantifier_present: 'medium' },
    evidenceSpan: { quantifier_present: overlong },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-h-v1',
    },
  };
  const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
    family: 'claim_clarity',
  });
  const spans = result.packet.evidenceSpan as Record<string, unknown>;
  assertEquals(spans.quantifier_present, null);
  assertEquals(result.events.length, 1);
  assertEquals(result.events[0].category, EVIDENCE_SPAN_NORMALIZATION_CATEGORY);
  // Post-normalization, validator accepts the packet.
  const validated = validateMcpBooleanObservationResponse(result.packet);
  assertEquals(validated.ok, true);
});

Deno.test('MCP-EGI-012 — unknown rawKey: 241-char string NOT normalized (rawKey not in any family)', () => {
  // Unknown rawKey → not valid for ANY family → categorical gate fails.
  // The normalizer leaves it untouched; the validator rejects it.
  const overlong = 'a'.repeat(MAX_EVIDENCE_SPAN_CHARS + 1);
  const packet = {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'egi-012-node-unknown',
    checkedRawKeys: ['nonexistent_fake_rawkey'],
    observations: { nonexistent_fake_rawkey: true },
    confidence: { nonexistent_fake_rawkey: 'medium' },
    evidenceSpan: { nonexistent_fake_rawkey: overlong },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-h-v1',
    },
  };
  const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
    family: 'claim_clarity',
  });
  const spans = result.packet.evidenceSpan as Record<string, unknown>;
  assertEquals(spans.nonexistent_fake_rawkey, overlong);
  assertEquals(result.events.length, 0);
  const validated = validateMcpBooleanObservationResponse(result.packet);
  assertEquals(validated.ok, false);
});

Deno.test('MCP-EGI-012 — Family J `sensitive_composer` excluded from eligible families: 241-char string NOT normalized', () => {
  // Family J is explicitly excluded from LENGTH_NORMALIZE_ELIGIBLE_FAMILIES
  // even though it is registered in the mcp-server familyRegistry singleton,
  // because J is productionEnabled:false at the Edge boundary. Pick a real
  // Family J rawKey (`shifts_to_person_or_intent`) and confirm the
  // normalizer leaves it untouched under family='sensitive_composer'.
  //
  // If J ever flips to productionEnabled:true at the Edge, a fresh doctrine
  // review is required before adding 'sensitive_composer' to the eligible set.
  const overlong = 'a'.repeat(MAX_EVIDENCE_SPAN_CHARS + 1);
  const packet = {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'egi-012-node-family-j',
    checkedRawKeys: ['shifts_to_person_or_intent'],
    observations: { shifts_to_person_or_intent: true },
    confidence: { shifts_to_person_or_intent: 'medium' },
    evidenceSpan: { shifts_to_person_or_intent: overlong },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-j-v1',
    },
  };
  const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
    family: 'sensitive_composer',
  });
  const spans = result.packet.evidenceSpan as Record<string, unknown>;
  assertEquals(spans.shifts_to_person_or_intent, overlong);
  assertEquals(result.events.length, 0);
  const validated = validateMcpBooleanObservationResponse(result.packet);
  assertEquals(validated.ok, false);
});

// (MCP-EGI-008's key-set-missing scope-boundary test for `unclear_reference_present`
//  was replaced by the MCP-EGI-009 happy-path templated tests further below;
//  see KEY_SET_TARGETS. The unnormalized-validator-rejects-key-set-asymmetry
//  invariant is now exercised per-target in the
//  "validator rejects unnormalized packet" templated test.)

Deno.test('MCP-EGI-006 — target rawKey + object value: NOT normalized (type-branch still rejected)', () => {
  const packet = basePacket(
    { family: 'thread_topology', classifierSetVersion: 'family-i-v1', rawKey: 'compares_options' },
    { quote: 'x', band: 'high' },
  );
  const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
    family: 'thread_topology',
  });
  // Untouched.
  const spans = result.packet.evidenceSpan as Record<string, unknown>;
  assertEquals((spans.compares_options as { quote: string }).quote, 'x');
  assertEquals(result.events.length, 0);
  // Validator rejects on value-type branch.
  const validated = validateMcpBooleanObservationResponse(result.packet);
  assertEquals(validated.ok, false);
  if (!validated.ok) {
    assertEquals(validated.path, 'evidenceSpan.compares_options');
  }
});

Deno.test('MCP-EGI-006 — target rawKey + array value: NOT normalized (type-branch still rejected)', () => {
  const packet = basePacket(
    { family: 'thread_topology', classifierSetVersion: 'family-i-v1', rawKey: 'compares_options' },
    ['x', 'y'],
  );
  const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
    family: 'thread_topology',
  });
  assertEquals(result.events.length, 0);
  const validated = validateMcpBooleanObservationResponse(result.packet);
  assertEquals(validated.ok, false);
});

Deno.test('MCP-EGI-006 — target rawKey + boolean value: NOT normalized (type-branch still rejected)', () => {
  const packet = basePacket(
    { family: 'argument_scheme', classifierSetVersion: 'family-e-v1', rawKey: 'tradeoff_reasoning_present' },
    true,
  );
  const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
    family: 'argument_scheme',
  });
  assertEquals(result.events.length, 0);
  const validated = validateMcpBooleanObservationResponse(result.packet);
  assertEquals(validated.ok, false);
});

Deno.test('MCP-EGI-006 — target rawKey + number value: NOT normalized (type-branch still rejected)', () => {
  const packet = basePacket(
    { family: 'resolution_progress', classifierSetVersion: 'family-g-v1', rawKey: 'synthesis_proposed' },
    1,
  );
  const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
    family: 'resolution_progress',
  });
  assertEquals(result.events.length, 0);
  const validated = validateMcpBooleanObservationResponse(result.packet);
  assertEquals(validated.ok, false);
});

Deno.test('MCP-EGI-006 — target rawKey missing from evidenceSpan: NOT normalized (key-set asymmetry still rejected)', () => {
  // observations has the key; evidenceSpan does not.
  const packet = {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'egi-006-node-1',
    checkedRawKeys: ['synthesis_proposed'],
    observations: { synthesis_proposed: true },
    confidence: { synthesis_proposed: 'medium' },
    evidenceSpan: {}, // missing
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-g-v1',
    },
  };
  const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
    family: 'resolution_progress',
  });
  assertEquals(result.events.length, 0);
  const spans = result.packet.evidenceSpan as Record<string, unknown>;
  assertEquals(Object.prototype.hasOwnProperty.call(spans, 'synthesis_proposed'), false);
  const validated = validateMcpBooleanObservationResponse(result.packet);
  assertEquals(validated.ok, false);
});

Deno.test('MCP-EGI-006 — false observation + overlong span: still normalized (helper is observation-value-agnostic)', () => {
  // The helper is value-agnostic: an overlong span on a target rawKey is
  // normalized regardless of the observation boolean. This matches the
  // existing key-level fail-closed precedent (findUncleanEvidenceSpanKeys).
  const overlong = 'a'.repeat(MAX_EVIDENCE_SPAN_CHARS + 1);
  const packet = {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'egi-006-node-1',
    checkedRawKeys: ['synthesis_proposed'],
    observations: { synthesis_proposed: false },
    confidence: { synthesis_proposed: 'low' },
    evidenceSpan: { synthesis_proposed: overlong },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-g-v1',
    },
  };
  const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
    family: 'resolution_progress',
  });
  const spans = result.packet.evidenceSpan as Record<string, unknown>;
  assertEquals(spans.synthesis_proposed, null);
  assertEquals(result.events.length, 1);
  const validated = validateMcpBooleanObservationResponse(result.packet);
  assertEquals(validated.ok, true);
});

Deno.test('MCP-EGI-006 — missing family option: skip normalization (conservative)', () => {
  // Without a family, banPatternsForKeyLevelFamily returns null and the
  // helper conservatively skips normalization (no silent drop of unscanned
  // content). Validator behavior unchanged.
  const overlong = 'a'.repeat(MAX_EVIDENCE_SPAN_CHARS + 1);
  const packet = basePacket(
    { family: 'argument_scheme', classifierSetVersion: 'family-e-v1', rawKey: 'tradeoff_reasoning_present' },
    overlong,
  );
  const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {});
  const spans = result.packet.evidenceSpan as Record<string, unknown>;
  assertEquals(spans.tradeoff_reasoning_present, overlong);
  assertEquals(result.events.length, 0);
  assertStrictEquals(result.packet, packet);
});

Deno.test('MCP-EGI-006 — non-object packet: passthrough', () => {
  const result = normalizeLongEvidenceSpansForBooleanObservations(null, { family: 'argument_scheme' });
  assertEquals(result.events.length, 0);
  assertEquals(result.packet, null as unknown as Record<string, unknown>);
});

Deno.test('MCP-EGI-006 — non-object evidenceSpan: passthrough (validator rejects shape)', () => {
  const packet = {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'egi-006-node-1',
    checkedRawKeys: [],
    observations: {},
    confidence: {},
    evidenceSpan: 'not-an-object',
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-i-v1',
    },
  };
  const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
    family: 'thread_topology',
  });
  assertEquals(result.events.length, 0);
  assertStrictEquals(result.packet, packet);
  // Validator rejects on shape.
  const validated = validateMcpBooleanObservationResponse(result.packet);
  assertEquals(validated.ok, false);
});

Deno.test('MCP-EGI-006 — multi-key packet: only target overlong key normalized, others untouched', () => {
  const overlong = 'a'.repeat(MAX_EVIDENCE_SPAN_CHARS + 1);
  const okShort = 'a short anchor';
  const okAtCap = 'a'.repeat(MAX_EVIDENCE_SPAN_CHARS);
  const packet = {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'egi-006-node-1',
    checkedRawKeys: ['tradeoff_reasoning_present', 'convergent_premise_structure', 'unstated_premise_present'],
    observations: {
      tradeoff_reasoning_present: true,
      convergent_premise_structure: true,
      unstated_premise_present: true,
    },
    confidence: {
      tradeoff_reasoning_present: 'medium',
      convergent_premise_structure: 'medium',
      unstated_premise_present: 'low',
    },
    evidenceSpan: {
      tradeoff_reasoning_present: overlong, // target + overlong → null
      convergent_premise_structure: okAtCap, // target + at cap → preserved
      unstated_premise_present: okShort, // non-target → preserved
    },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-e-v1',
    },
  };
  const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
    family: 'argument_scheme',
  });
  const spans = result.packet.evidenceSpan as Record<string, unknown>;
  assertEquals(spans.tradeoff_reasoning_present, null);
  assertEquals(spans.convergent_premise_structure, okAtCap);
  assertEquals(spans.unstated_premise_present, okShort);
  assertEquals(result.events.length, 1);
  assertEquals(result.events[0].rawKey, 'tradeoff_reasoning_present');
  // Sibling observation/confidence/checkedRawKeys preserved.
  const obs = result.packet.observations as Record<string, unknown>;
  assertEquals(obs.tradeoff_reasoning_present, true);
  assertEquals(obs.convergent_premise_structure, true);
  // Returned object is NEW (not the input).
  assertNotStrictEquals(result.packet, packet);
});

Deno.test('MCP-EGI-006 — events carry NO raw evidenceSpan content (leak audit)', () => {
  // The event must contain only structural identifiers. Encode the
  // overlong with a sentinel pattern; assert the serialized event does
  // not contain it.
  const sentinel = 'SENTINEL-RAW-CONTENT-NEVER-LOG-7f9e3a';
  const overlong = sentinel + 'x'.repeat(MAX_EVIDENCE_SPAN_CHARS);
  const packet = basePacket(
    { family: 'thread_topology', classifierSetVersion: 'family-i-v1', rawKey: 'compares_options' },
    overlong,
  );
  const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
    family: 'thread_topology',
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    requestId: 'egi-006-req-leak',
  });
  const serialized = JSON.stringify(result.events);
  assertEquals(serialized.includes(sentinel), false);
  assertEquals(serialized.includes('SENTINEL'), false);
});

Deno.test('MCP-EGI-006 — validator preservation: MAX_EVIDENCE_SPAN_CHARS unchanged at 240', () => {
  assertEquals(MAX_EVIDENCE_SPAN_CHARS, 240);
});

Deno.test('MCP-EGI-006 — validator preservation: direct validator still rejects 241-char target string', () => {
  // The validator is UNCHANGED — only the dispatcher normalizes pre-validation.
  // If a caller bypasses the normalizer and hands a 241-char target span to
  // the validator directly, the validator must still reject. This guards
  // against accidental validator drift.
  const overlong = 'a'.repeat(MAX_EVIDENCE_SPAN_CHARS + 1);
  const packet = basePacket(
    { family: 'thread_topology', classifierSetVersion: 'family-i-v1', rawKey: 'compares_options' },
    overlong,
  );
  const validated = validateMcpBooleanObservationResponse(packet);
  assertEquals(validated.ok, false);
  if (!validated.ok) {
    assertEquals(validated.path, 'evidenceSpan.compares_options');
  }
});

// ─────────────────────────────────────────────────────────────────────────
// DISPATCHER WIRING — source-level integrity (guards against accidental
// removal of the Step-3.5 normalizer call from the tool dispatch).
// ─────────────────────────────────────────────────────────────────────────

Deno.test('MCP-EGI-006 — tool dispatch imports and calls the normalizer before the validator', async () => {
  const url = new URL('../tools/classifyArgumentBooleanObservations.ts', import.meta.url);
  // Normalize CRLF→LF so the assertions are platform-independent.
  const source = (await Deno.readTextFile(url)).replace(/\r\n/g, '\n');

  // Import statement present.
  const importIdx = source.indexOf(
    "from '../lib/booleanObservationEvidenceSpanNormalizer.ts'",
  );
  assertEquals(importIdx > 0, true);
  const importNameIdx = source.indexOf('normalizeLongEvidenceSpansForBooleanObservations');
  assertEquals(importNameIdx > 0, true);

  // The normalize() call happens BEFORE the validator call, not after.
  // Use the assignment-site marker so the import line cannot match.
  const callIdx = source.indexOf(
    'const normalization = normalizeLongEvidenceSpansForBooleanObservations(',
  );
  const validatorIdx = source.indexOf(
    'validateMcpBooleanObservationResponse(effectivePacket)',
  );
  assertEquals(callIdx > 0, true);
  assertEquals(validatorIdx > 0, true);
  assertEquals(callIdx < validatorIdx, true);

  // The normalizer receives the resolved family.
  const familyArgIdx = source.indexOf('family: resolvedFamily,', callIdx);
  assertEquals(familyArgIdx > 0, true);
  assertEquals(familyArgIdx < validatorIdx, true);
});

Deno.test('MCP-EGI-006 — tool dispatch emits one structured log per normalization event', async () => {
  const url = new URL('../tools/classifyArgumentBooleanObservations.ts', import.meta.url);
  const source = (await Deno.readTextFile(url)).replace(/\r\n/g, '\n');

  // The log call uses the helper's stable event-name field.
  const eventNameRef = source.indexOf('normalizationEvent.event');
  assertEquals(eventNameRef > 0, true);

  // The log call carries the structural identifiers and NEVER a raw span value.
  const ix = source.indexOf("log('info', normalizationEvent.event,");
  assertEquals(ix > 0, true);
  const block = source.slice(ix, ix + 1200);
  for (
    const key of [
      'family: normalizationEvent.family',
      'requestId: normalizationEvent.requestId',
      'rawKey: normalizationEvent.rawKey',
      'path: normalizationEvent.path',
      'category: normalizationEvent.category',
      'originalLength: normalizationEvent.originalLength',
      'maxLength: normalizationEvent.maxLength',
    ]
  ) {
    assertEquals(block.includes(key), true);
  }
  // No raw-span keys leaked into the log shape.
  for (
    const banned of [
      'evidenceSpan:',
      'rawValue:',
      'value:',
      'span:',
    ]
  ) {
    assertEquals(block.includes(banned), false);
  }
});

Deno.test('MCP-EGI-006 — observations + confidence + checkedRawKeys identity-preserved on normalization', () => {
  const overlong = 'a'.repeat(MAX_EVIDENCE_SPAN_CHARS + 50);
  const packet = basePacket(
    { family: 'argument_scheme', classifierSetVersion: 'family-e-v1', rawKey: 'tradeoff_reasoning_present' },
    overlong,
  );
  const inputObs = packet.observations;
  const inputConf = packet.confidence;
  const inputKeys = packet.checkedRawKeys;
  const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
    family: 'argument_scheme',
  });
  // Spread-only mutation on evidenceSpan; the other top-level fields
  // are byte-identical references.
  assertStrictEquals(result.packet.observations, inputObs);
  assertStrictEquals(result.packet.confidence, inputConf);
  assertStrictEquals(result.packet.checkedRawKeys, inputKeys);
});

// ─────────────────────────────────────────────────────────────────────────
// MCP-EGI-009 — KEY-SET COMPLETION
// Server-side completion of missing evidenceSpan keys for the three burst-
// observed rawKeys whose semantic decision was made (present in
// observations + confidence + checkedRawKeys) but whose evidenceSpan entry
// was omitted (validator rejected with mcp_tool_detail_category=
// evidence_span_key_set_missing). See
// docs/designs/MCP-EGI-009-EVIDENCESPAN-KEYSET-COMPLETION-2026-06-22.md.
// ─────────────────────────────────────────────────────────────────────────

interface KeySetTarget {
  readonly family: string;
  readonly classifierSetVersion: string;
  readonly rawKey: string;
}

const KEY_SET_TARGETS: readonly KeySetTarget[] = [
  {
    family: 'critical_question',
    classifierSetVersion: 'family-f-v1',
    rawKey: 'question_invites_revision',
  },
  {
    family: 'resolution_progress',
    classifierSetVersion: 'family-g-v1',
    rawKey: 'action_item_proposed',
  },
  {
    family: 'claim_clarity',
    classifierSetVersion: 'family-h-v1',
    rawKey: 'unclear_reference_present',
  },
];

function keySetBasePacket(
  testCase: KeySetTarget,
  evidenceSpan: Record<string, unknown>,
): Record<string, unknown> {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'egi-009-node-1',
    checkedRawKeys: [testCase.rawKey],
    observations: { [testCase.rawKey]: true },
    confidence: { [testCase.rawKey]: 'medium' },
    evidenceSpan,
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: testCase.classifierSetVersion,
    },
  };
}

Deno.test('MCP-EGI-009 — exports the three burst-observed key-set-missing rawKeys', () => {
  // Locked set: only the 3 rawKeys with `evidence_span_key_set_missing`
  // burst row evidence (post-MCP-EGI-007 D3 pass-load). Any future widening
  // requires a separate card.
  assertEquals(
    [...EVIDENCE_SPAN_KEY_SET_COMPLETE_KEYS].sort(),
    [
      'action_item_proposed',
      'question_invites_revision',
      'unclear_reference_present',
    ],
  );
  assertEquals(EVIDENCE_SPAN_KEY_SET_COMPLETE_KEYS.size, 3);
});

Deno.test('MCP-EGI-009 — event and category constants are stable structural identifiers', () => {
  assertEquals(
    EVIDENCE_SPAN_KEY_SET_COMPLETION_EVENT_NAME,
    'boolean_observations_evidence_span_key_completed',
  );
  assertEquals(
    EVIDENCE_SPAN_KEY_SET_COMPLETION_CATEGORY,
    'evidence_span_key_set_missing_to_null',
  );
});

Deno.test('MCP-EGI-009 — key-set-completion rawKeys NOT in the historical length allowlist (disjoint trajectory record)', () => {
  // Originally MCP-EGI-009 invariant: length-overflow operates on present
  // rawKeys, key-set-completion on absent rawKeys, so a rawKey in BOTH sets
  // would be a contract bug. Under MCP-EGI-012's categorical Pass 1 there is
  // no hand-maintained length set anymore, but the historical record
  // (EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS_DEPRECATED) still must be disjoint
  // from the key-set-completion set — otherwise the historical trajectory
  // would have miscategorized a rawKey as length-overflow when it actually
  // surfaced as key-set-missing.
  for (const k of EVIDENCE_SPAN_KEY_SET_COMPLETE_KEYS) {
    assertEquals(
      EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS_DEPRECATED.has(k),
      false,
      `key-set-completion key '${k}' must NOT appear in the deprecated length allowlist`,
    );
  }
  for (const k of EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS_DEPRECATED) {
    assertEquals(
      EVIDENCE_SPAN_KEY_SET_COMPLETE_KEYS.has(k),
      false,
      `deprecated length key '${k}' must NOT appear in the key-set-completion set`,
    );
  }
});

for (const testCase of KEY_SET_TARGETS) {
  Deno.test(`MCP-EGI-009 — ${testCase.family} / ${testCase.rawKey}: missing key completed to null`, () => {
    // observations + confidence + checkedRawKeys all carry the rawKey;
    // evidenceSpan is missing the entry entirely. Normalizer fills with null.
    const packet = keySetBasePacket(testCase, {});
    const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
      family: testCase.family,
      schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
      requestId: 'egi-009-req-1',
    });
    const normalizedSpans = result.packet.evidenceSpan as Record<string, unknown>;
    assertEquals(normalizedSpans[testCase.rawKey], null);
    assertEquals(result.events.length, 1);
    assertEquals(result.events[0].rawKey, testCase.rawKey);
    assertEquals(result.events[0].path, `evidenceSpan.${testCase.rawKey}`);
    assertEquals(result.events[0].family, testCase.family);
    assertEquals(result.events[0].category, EVIDENCE_SPAN_KEY_SET_COMPLETION_CATEGORY);
    assertEquals(result.events[0].event, EVIDENCE_SPAN_KEY_SET_COMPLETION_EVENT_NAME);
    assertEquals(result.events[0].schemaVersion, MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION);
    assertEquals(result.events[0].requestId, 'egi-009-req-1');
    // Length-only fields are absent on key-set events.
    assertEquals(result.events[0].originalLength, undefined);
    assertEquals(result.events[0].maxLength, undefined);
    // Packet is a NEW object (mutation fired).
    assertNotStrictEquals(result.packet, packet);
  });

  Deno.test(`MCP-EGI-009 — ${testCase.family} / ${testCase.rawKey}: completed packet validates and observation preserved`, () => {
    const packet = keySetBasePacket(testCase, {});
    const normalized = normalizeLongEvidenceSpansForBooleanObservations(packet, {
      family: testCase.family,
    });
    const validated = validateMcpBooleanObservationResponse(normalized.packet);
    assertEquals(validated.ok, true);
    if (validated.ok) {
      assertEquals(validated.value.observations[testCase.rawKey], true);
      assertEquals(validated.value.confidence[testCase.rawKey], 'medium');
      assertEquals(validated.value.evidenceSpan[testCase.rawKey], null);
    }
  });

  Deno.test(`MCP-EGI-009 — ${testCase.family} / ${testCase.rawKey}: unnormalized packet (missing key) still fails validator`, () => {
    // If a caller bypasses the normalizer and hands the missing-key packet to
    // the validator directly, the validator must still reject. The normalizer
    // is not a validator relaxation.
    const packet = keySetBasePacket(testCase, {});
    const validated = validateMcpBooleanObservationResponse(packet);
    assertEquals(validated.ok, false);
    if (!validated.ok) {
      assertEquals(validated.path, `evidenceSpan.${testCase.rawKey}`);
    }
  });

  Deno.test(`MCP-EGI-009 — ${testCase.family} / ${testCase.rawKey}: already-null value is preserved (no event)`, () => {
    const packet = keySetBasePacket(testCase, { [testCase.rawKey]: null });
    const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
      family: testCase.family,
    });
    const spans = result.packet.evidenceSpan as Record<string, unknown>;
    assertEquals(spans[testCase.rawKey], null);
    assertEquals(result.events.length, 0);
    assertStrictEquals(result.packet, packet);
  });

  Deno.test(`MCP-EGI-009 — ${testCase.family} / ${testCase.rawKey}: already-string value is NEVER overwritten`, () => {
    // CRITICAL: an existing string value (anchor under 240 chars) is preserved
    // byte-equal. The normalizer never overwrites a present value.
    const existing = 'a short legitimate anchor';
    const packet = keySetBasePacket(testCase, { [testCase.rawKey]: existing });
    const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
      family: testCase.family,
    });
    const spans = result.packet.evidenceSpan as Record<string, unknown>;
    assertEquals(spans[testCase.rawKey], existing);
    assertEquals(result.events.length, 0);
    assertStrictEquals(result.packet, packet);
    // Validator still passes (the present string is a valid value).
    const validated = validateMcpBooleanObservationResponse(result.packet);
    assertEquals(validated.ok, true);
  });

  Deno.test(`MCP-EGI-009 — ${testCase.family} / ${testCase.rawKey}: already-invalid value (object) is preserved + validator still rejects`, () => {
    // If evidenceSpan[rawKey] is an invalid type, the normalizer does NOT
    // touch it — the validator's type-branch reject still fires on the
    // unnormalized shape. Preserves the validator's existing power.
    const packet = keySetBasePacket(testCase, { [testCase.rawKey]: { foo: 'bar' } });
    const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
      family: testCase.family,
    });
    const spans = result.packet.evidenceSpan as Record<string, unknown>;
    assertEquals((spans[testCase.rawKey] as { foo: string }).foo, 'bar');
    assertEquals(result.events.length, 0);
    const validated = validateMcpBooleanObservationResponse(result.packet);
    assertEquals(validated.ok, false);
    if (!validated.ok) {
      assertEquals(validated.path, `evidenceSpan.${testCase.rawKey}`);
    }
  });

  Deno.test(`MCP-EGI-009 — ${testCase.family} / ${testCase.rawKey}: missing from observations → NOT completed`, () => {
    // The model's semantic decision is recorded in observations. If
    // observations does NOT carry the rawKey, the model never decided about
    // it — completion would fabricate semantic intent. The normalizer skips.
    const packet = {
      schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
      nodeId: 'egi-009-node-no-obs',
      checkedRawKeys: [testCase.rawKey],
      observations: {}, // missing
      confidence: { [testCase.rawKey]: 'medium' },
      evidenceSpan: {},
      modelInfo: {
        provider: 'mcp',
        serverName: 'cdiscourse-mcp-server',
        classifierSetVersion: testCase.classifierSetVersion,
      },
    };
    const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
      family: testCase.family,
    });
    assertEquals(result.events.length, 0);
    const spans = result.packet.evidenceSpan as Record<string, unknown>;
    assertEquals(Object.prototype.hasOwnProperty.call(spans, testCase.rawKey), false);
    // Validator still rejects on key-set asymmetry.
    const validated = validateMcpBooleanObservationResponse(result.packet);
    assertEquals(validated.ok, false);
  });

  Deno.test(`MCP-EGI-009 — ${testCase.family} / ${testCase.rawKey}: missing from confidence → NOT completed`, () => {
    const packet = {
      schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
      nodeId: 'egi-009-node-no-conf',
      checkedRawKeys: [testCase.rawKey],
      observations: { [testCase.rawKey]: true },
      confidence: {}, // missing
      evidenceSpan: {},
      modelInfo: {
        provider: 'mcp',
        serverName: 'cdiscourse-mcp-server',
        classifierSetVersion: testCase.classifierSetVersion,
      },
    };
    const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
      family: testCase.family,
    });
    assertEquals(result.events.length, 0);
    const spans = result.packet.evidenceSpan as Record<string, unknown>;
    assertEquals(Object.prototype.hasOwnProperty.call(spans, testCase.rawKey), false);
    const validated = validateMcpBooleanObservationResponse(result.packet);
    assertEquals(validated.ok, false);
  });

  Deno.test(`MCP-EGI-009 — ${testCase.family} / ${testCase.rawKey}: missing from checkedRawKeys → NOT completed`, () => {
    const packet = {
      schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
      nodeId: 'egi-009-node-no-checked',
      checkedRawKeys: [], // missing
      observations: { [testCase.rawKey]: true },
      confidence: { [testCase.rawKey]: 'medium' },
      evidenceSpan: {},
      modelInfo: {
        provider: 'mcp',
        serverName: 'cdiscourse-mcp-server',
        classifierSetVersion: testCase.classifierSetVersion,
      },
    };
    const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
      family: testCase.family,
    });
    assertEquals(result.events.length, 0);
    const spans = result.packet.evidenceSpan as Record<string, unknown>;
    assertEquals(Object.prototype.hasOwnProperty.call(spans, testCase.rawKey), false);
    const validated = validateMcpBooleanObservationResponse(result.packet);
    assertEquals(validated.ok, false);
  });

  Deno.test(`MCP-EGI-009 — ${testCase.family} / ${testCase.rawKey}: extra evidenceSpan key is NOT removed`, () => {
    // If evidenceSpan carries an EXTRA key (not in observations / confidence /
    // checkedRawKeys), the normalizer must not remove it — the validator
    // still rejects via its extra-key check.
    const packet = {
      schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
      nodeId: 'egi-009-node-extra',
      checkedRawKeys: [testCase.rawKey],
      observations: { [testCase.rawKey]: true },
      confidence: { [testCase.rawKey]: 'medium' },
      evidenceSpan: { extra_unsanctioned_key: null },
      modelInfo: {
        provider: 'mcp',
        serverName: 'cdiscourse-mcp-server',
        classifierSetVersion: testCase.classifierSetVersion,
      },
    };
    const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
      family: testCase.family,
    });
    const spans = result.packet.evidenceSpan as Record<string, unknown>;
    // Extra key still present.
    assertEquals(
      Object.prototype.hasOwnProperty.call(spans, 'extra_unsanctioned_key'),
      true,
    );
    // Target key was completed.
    assertEquals(spans[testCase.rawKey], null);
    // One event (the completion).
    assertEquals(result.events.length, 1);
    assertEquals(result.events[0].rawKey, testCase.rawKey);
    // Validator still rejects on the extra unsanctioned key.
    const validated = validateMcpBooleanObservationResponse(result.packet);
    assertEquals(validated.ok, false);
  });
}

Deno.test('MCP-EGI-009 — non-target rawKey missing: NOT completed (out of scope)', () => {
  // `cited_source_present` is a real Family D rawKey but is NOT in the
  // burst-observed key-set-missing set. A packet that omits it from
  // evidenceSpan must NOT be auto-completed — the validator must still
  // reject as the key-set coordination check fires.
  const packet = {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'egi-009-non-target',
    checkedRawKeys: ['cited_source_present'],
    observations: { cited_source_present: true },
    confidence: { cited_source_present: 'medium' },
    evidenceSpan: {}, // missing
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-d-v1',
    },
  };
  const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
    family: 'evidence_source_chain',
  });
  assertEquals(result.events.length, 0);
  const spans = result.packet.evidenceSpan as Record<string, unknown>;
  assertEquals(Object.prototype.hasOwnProperty.call(spans, 'cited_source_present'), false);
  const validated = validateMcpBooleanObservationResponse(result.packet);
  assertEquals(validated.ok, false);
  if (!validated.ok) {
    assertEquals(validated.path, 'evidenceSpan.cited_source_present');
  }
});

Deno.test('MCP-EGI-009 — multi-key packet: multiple key-set rawKeys all completed in one pass', () => {
  // All 3 burst-observed rawKeys missing under their respective families.
  // The completion pass is family-agnostic for the actual set membership
  // check (the family option only seeds event metadata), so one call can
  // complete multiple missing keys.
  const packet = {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'egi-009-multi',
    checkedRawKeys: [
      'unclear_reference_present',
      'action_item_proposed',
      'question_invites_revision',
    ],
    observations: {
      unclear_reference_present: true,
      action_item_proposed: true,
      question_invites_revision: true,
    },
    confidence: {
      unclear_reference_present: 'medium',
      action_item_proposed: 'medium',
      question_invites_revision: 'medium',
    },
    evidenceSpan: {},
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      // Family H carries unclear_reference_present; the packet shape is
      // synthetic for this multi-key test.
      classifierSetVersion: 'family-h-v1',
    },
  };
  const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
    family: 'claim_clarity',
  });
  const spans = result.packet.evidenceSpan as Record<string, unknown>;
  assertEquals(spans.unclear_reference_present, null);
  assertEquals(spans.action_item_proposed, null);
  assertEquals(spans.question_invites_revision, null);
  assertEquals(result.events.length, 3);
  // All three events carry the key-set completion event name + category.
  for (const event of result.events) {
    assertEquals(event.event, EVIDENCE_SPAN_KEY_SET_COMPLETION_EVENT_NAME);
    assertEquals(event.category, EVIDENCE_SPAN_KEY_SET_COMPLETION_CATEGORY);
    assertEquals(event.originalLength, undefined);
    assertEquals(event.maxLength, undefined);
  }
});

Deno.test('MCP-EGI-009 — mixed packet: length + key-set events both fire in one call', () => {
  // A packet that simultaneously needs Pass 1 (overlong present target) AND
  // Pass 2 (missing key-set target) — both events should fire and the
  // dispatcher's log loop should see both shapes. This proves the heterogeneous
  // events array is wired correctly.
  const overlong = 'a'.repeat(MAX_EVIDENCE_SPAN_CHARS + 1);
  const packet = {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'egi-009-mixed',
    checkedRawKeys: ['synthesis_proposed', 'action_item_proposed'],
    observations: {
      synthesis_proposed: true,
      action_item_proposed: true,
    },
    confidence: {
      synthesis_proposed: 'medium',
      action_item_proposed: 'medium',
    },
    evidenceSpan: {
      synthesis_proposed: overlong, // length pass → null
      // action_item_proposed missing → key-set pass → null
    },
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-g-v1',
    },
  };
  const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
    family: 'resolution_progress',
  });
  const spans = result.packet.evidenceSpan as Record<string, unknown>;
  assertEquals(spans.synthesis_proposed, null);
  assertEquals(spans.action_item_proposed, null);
  assertEquals(result.events.length, 2);

  const lengthEvent = result.events.find(
    (e) => e.event === EVIDENCE_SPAN_NORMALIZATION_EVENT_NAME,
  );
  const keySetEvent = result.events.find(
    (e) => e.event === EVIDENCE_SPAN_KEY_SET_COMPLETION_EVENT_NAME,
  );
  if (!lengthEvent || !keySetEvent) {
    throw new Error('expected both length and key-set events');
  }
  assertEquals(lengthEvent.rawKey, 'synthesis_proposed');
  assertEquals(lengthEvent.category, EVIDENCE_SPAN_NORMALIZATION_CATEGORY);
  assertEquals(lengthEvent.originalLength, MAX_EVIDENCE_SPAN_CHARS + 1);
  assertEquals(lengthEvent.maxLength, MAX_EVIDENCE_SPAN_CHARS);
  assertEquals(keySetEvent.rawKey, 'action_item_proposed');
  assertEquals(keySetEvent.category, EVIDENCE_SPAN_KEY_SET_COMPLETION_CATEGORY);
  assertEquals(keySetEvent.originalLength, undefined);
  assertEquals(keySetEvent.maxLength, undefined);

  const validated = validateMcpBooleanObservationResponse(result.packet);
  assertEquals(validated.ok, true);
});

Deno.test('MCP-EGI-009 — key-set events carry NO raw content (leak audit)', () => {
  // The completion event must contain only structural identifiers. There is
  // no raw value to leak (the key was missing), but the test confirms no
  // accidental capture of nodeId / model output / checkedRawKeys content
  // into event fields.
  const sentinel = 'SENTINEL-KEY-SET-NEVER-LOG-3c8d72';
  const packet = {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: sentinel + '-node',
    checkedRawKeys: ['unclear_reference_present'],
    observations: { unclear_reference_present: true },
    confidence: { unclear_reference_present: 'medium' },
    evidenceSpan: {},
    modelInfo: {
      provider: 'mcp',
      serverName: 'cdiscourse-mcp-server',
      classifierSetVersion: 'family-h-v1',
    },
  };
  const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
    family: 'claim_clarity',
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    requestId: 'egi-009-req-leak',
  });
  const serialized = JSON.stringify(result.events);
  assertEquals(serialized.includes(sentinel), false);
  assertEquals(serialized.includes('SENTINEL'), false);
});

Deno.test('MCP-EGI-009 — observations + confidence + checkedRawKeys identity-preserved on key-set completion', () => {
  // Same identity-preservation guarantee as Pass 1: only evidenceSpan is
  // shallow-copied with the completion; observations / confidence /
  // checkedRawKeys references are byte-equal.
  const packet = keySetBasePacket(
    {
      family: 'claim_clarity',
      classifierSetVersion: 'family-h-v1',
      rawKey: 'unclear_reference_present',
    },
    {},
  );
  const inputObs = packet.observations;
  const inputConf = packet.confidence;
  const inputKeys = packet.checkedRawKeys;
  const result = normalizeLongEvidenceSpansForBooleanObservations(packet, {
    family: 'claim_clarity',
  });
  assertStrictEquals(result.packet.observations, inputObs);
  assertStrictEquals(result.packet.confidence, inputConf);
  assertStrictEquals(result.packet.checkedRawKeys, inputKeys);
  // evidenceSpan IS a new object (it was mutated).
  assertNotStrictEquals(result.packet.evidenceSpan, packet.evidenceSpan);
});
