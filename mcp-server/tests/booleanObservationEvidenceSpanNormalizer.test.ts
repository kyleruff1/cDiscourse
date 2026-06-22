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
  EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS,
  EVIDENCE_SPAN_NORMALIZATION_CATEGORY,
  EVIDENCE_SPAN_NORMALIZATION_EVENT_NAME,
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

Deno.test('MCP-EGI-007 — exports the five confirmed compound rawKeys', () => {
  // The set is locked to the live D3 evidence. MCP-EGI-006 opened with 4
  // rawKeys (E `tradeoff_reasoning_present` / `convergent_premise_structure`,
  // G `synthesis_proposed`, I `compares_options`). MCP-EGI-007 added a 5th
  // (H `reason_present`) on the basis of the post-MCP-EGI-006 D3 canary.
  // Any future widening must be a separate card; this test guards against
  // accidental drift.
  assertEquals(
    [...EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS].sort(),
    [
      'compares_options',
      'convergent_premise_structure',
      'reason_present',
      'synthesis_proposed',
      'tradeoff_reasoning_present',
    ],
  );
  assertEquals(EVIDENCE_SPAN_LENGTH_NORMALIZE_KEYS.size, 5);
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

Deno.test('MCP-EGI-007 — non-target Family H rawKey: 241-char string NOT normalized (widening is narrow)', () => {
  // `claim_present` is a Family H rawKey ADJACENT to the new MCP-EGI-007
  // target `reason_present` (both live in `familyHKeys.ts`'s FAMILY_H_RAW_KEYS
  // list, both are "MEDIUM-risk" formulation-state observations). The widening
  // must be NARROW: only `reason_present` was added to the locked set, not
  // the rest of Family H. Adversarial regression: an overlong `claim_present`
  // string under the same family must NOT be normalized — the validator
  // should reject it for length as it does today.
  const overlong = 'a'.repeat(MAX_EVIDENCE_SPAN_CHARS + 1);
  const packet = {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'egi-007-node-1',
    checkedRawKeys: ['claim_present'],
    observations: { claim_present: true },
    confidence: { claim_present: 'medium' },
    evidenceSpan: { claim_present: overlong },
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
  assertEquals(spans.claim_present, overlong);
  assertEquals(result.events.length, 0);
  const validated = validateMcpBooleanObservationResponse(result.packet);
  assertEquals(validated.ok, false);
  if (!validated.ok) {
    assertEquals(validated.path, 'evidenceSpan.claim_present');
  }
});

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
