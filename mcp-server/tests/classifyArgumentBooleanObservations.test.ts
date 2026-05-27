/**
 * MCP-SERVER-002 — Real `classify_argument_boolean_observations` tool tests.
 *
 * Replaces the scaffold tests (which asserted the not_implemented envelope).
 * Critical invariants:
 *   - Valid Family A request via fixture provider returns full schema-compliant response
 *   - schemaVersion mismatch returns invalid_params with structured detail
 *   - requestedFamilies outside parent_relation returns unsupported_family
 *   - requestedRawKeys outside FAMILY_A_RAW_KEYS returns unsupported_rawKey
 *   - timeoutMs out of range returns invalid_params
 *   - missing required field returns invalid_params
 *   - dispatch path returns the same result envelope
 *   - tool description is doctrine-clean (no verdict tokens)
 *
 * NOTE: the doctrine ban-list scan + validation_failed paths are exercised
 * by the response-validator + ban-list-scan unit tests in dedicated test
 * files (`familyAResponseValidator.test.ts`, `familyABanListScan.test.ts`).
 * This test file focuses on the tool-handler orchestration.
 */
import { assertEquals } from 'std/assert/mod.ts';
import {
  CLASSIFY_BOOLEAN_OBSERVATIONS_TOOL,
  handleClassifyArgumentBooleanObservations,
} from '../tools/classifyArgumentBooleanObservations.ts';
import { invokeToolByName } from '../lib/toolDispatch.ts';

const SCHEMA_VERSION = 'mcp-021.machine-observations.boolean.v1';

function withFixtureEnv<T>(fn: () => Promise<T>): Promise<T> {
  const prev = Deno.env.get('MCP_SERVER_USE_FIXTURE_PROVIDER');
  Deno.env.set('MCP_SERVER_USE_FIXTURE_PROVIDER', 'true');
  return fn().finally(() => {
    if (prev === undefined) Deno.env.delete('MCP_SERVER_USE_FIXTURE_PROVIDER');
    else Deno.env.set('MCP_SERVER_USE_FIXTURE_PROVIDER', prev);
  });
}

function withoutFixtureEnv<T>(fn: () => Promise<T>): Promise<T> {
  const prevFixture = Deno.env.get('MCP_SERVER_USE_FIXTURE_PROVIDER');
  const prevKey = Deno.env.get('ANTHROPIC_API_KEY');
  Deno.env.delete('MCP_SERVER_USE_FIXTURE_PROVIDER');
  Deno.env.delete('ANTHROPIC_API_KEY');
  return fn().finally(() => {
    if (prevFixture === undefined) Deno.env.delete('MCP_SERVER_USE_FIXTURE_PROVIDER');
    else Deno.env.set('MCP_SERVER_USE_FIXTURE_PROVIDER', prevFixture);
    if (prevKey === undefined) Deno.env.delete('ANTHROPIC_API_KEY');
    else Deno.env.set('ANTHROPIC_API_KEY', prevKey);
  });
}

function validRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: SCHEMA_VERSION,
    nodeId: 'fixture-node-mainline-001',
    parentNodeId: null,
    currentText: 'fixture body text',
    parentText: null,
    threadContextExcerpt: 'fixture thread context',
    requestedFamilies: ['parent_relation'],
    requestedRawKeys: ['supports_parent', 'challenges_parent'],
    definitions: {},
    timeoutMs: 12000,
    ...overrides,
  };
}

Deno.test('boolean tool returns full schema-compliant response via fixture provider', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: validRequest(),
      requestId: 'r-fixture-1',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, false);
    assertEquals(result.content.length, 1);
    assertEquals(result.content[0].type, 'text');
    const sc = result.structuredContent as Record<string, unknown>;
    assertEquals(sc.schemaVersion, SCHEMA_VERSION);
    assertEquals(sc.nodeId, 'fixture-node-mainline-001');
    if (typeof sc.observations !== 'object' || sc.observations === null) {
      throw new Error('observations not an object');
    }
    if (typeof sc.confidence !== 'object' || sc.confidence === null) {
      throw new Error('confidence not an object');
    }
    if (typeof sc.modelInfo !== 'object' || sc.modelInfo === null) {
      throw new Error('modelInfo not an object');
    }
    const modelInfo = sc.modelInfo as Record<string, unknown>;
    assertEquals(modelInfo.provider, 'mcp');
    assertEquals(modelInfo.classifierSetVersion, 'family-a-v1');
  });
});

Deno.test('boolean tool rejects non-object input', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: 'not an object',
      requestId: 'r-bad-input-1',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as { reason: string };
    assertEquals(sc.reason, 'invalid_params');
  });
});

Deno.test('boolean tool rejects schemaVersion mismatch with invalid_params', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: validRequest({ schemaVersion: 'mcp-021.bogus.v99' }),
      requestId: 'r-bad-schema-1',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as { reason: string; path?: string };
    assertEquals(sc.reason, 'invalid_params');
    assertEquals(sc.path, 'schemaVersion');
  });
});

Deno.test('boolean tool rejects unsupported requestedFamilies with unsupported_family (C/D/E remain unsupported)', async () => {
  await withFixtureEnv(async () => {
    // MCP-SERVER-003-FAMILY-B uses 'evidence_source_chain' (Family D) which
    // remains unsupported. The supportedFamilies envelope now lists both
    // registered families (Family A and Family B).
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: validRequest({ requestedFamilies: ['evidence_source_chain'] }),
      requestId: 'r-bad-family-1',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as {
      reason: string;
      requestedFamilies?: string[];
      supportedFamilies?: string[];
    };
    assertEquals(sc.reason, 'unsupported_family');
    assertEquals(sc.requestedFamilies, ['evidence_source_chain']);
    assertEquals(sc.supportedFamilies, ['parent_relation', 'disagreement_axis']);
  });
});

Deno.test('boolean tool rejects unsupported requestedRawKeys with unsupported_rawKey', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: validRequest({
        requestedRawKeys: ['supports_parent', 'fictional_raw_key_xyz'],
      }),
      requestId: 'r-bad-rawkey-1',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as {
      reason: string;
      unsupportedRawKeys?: string[];
    };
    assertEquals(sc.reason, 'unsupported_rawKey');
    assertEquals(sc.unsupportedRawKeys, ['fictional_raw_key_xyz']);
  });
});

Deno.test('boolean tool rejects timeoutMs below range', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: validRequest({ timeoutMs: 0 }),
      requestId: 'r-bad-timeout-1',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as { reason: string; path?: string };
    assertEquals(sc.reason, 'invalid_params');
    assertEquals(sc.path, 'timeoutMs');
  });
});

Deno.test('boolean tool rejects timeoutMs above range', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: validRequest({ timeoutMs: 90000 }),
      requestId: 'r-bad-timeout-2',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as { reason: string; path?: string };
    assertEquals(sc.reason, 'invalid_params');
    assertEquals(sc.path, 'timeoutMs');
  });
});

Deno.test('boolean tool rejects missing required field', async () => {
  await withFixtureEnv(async () => {
    const req = validRequest();
    delete (req as Record<string, unknown>).nodeId;
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: req,
      requestId: 'r-missing-field-1',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as { reason: string };
    assertEquals(sc.reason, 'invalid_params');
  });
});

Deno.test('boolean tool returns key_missing when neither fixture provider nor Anthropic key is set', async () => {
  await withoutFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: validRequest(),
      requestId: 'r-no-key-1',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as { reason: string };
    assertEquals(sc.reason, 'key_missing');
  });
});

Deno.test('boolean tool via dispatch returns the same successful packet shape', async () => {
  await withFixtureEnv(async () => {
    const result = await invokeToolByName({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: validRequest(),
      requestId: 'r-dispatch-1',
      envelope: 'adapterCompat',
    });
    assertEquals(result.isError, false);
    const sc = result.structuredContent as Record<string, unknown>;
    assertEquals(sc.schemaVersion, SCHEMA_VERSION);
  });
});

Deno.test('boolean tool empty requestedRawKeys is accepted (means: classify all 16)', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: validRequest({ requestedRawKeys: [] }),
      requestId: 'r-empty-keys-1',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, false);
  });
});

Deno.test('boolean tool description is doctrine-clean (no verdict tokens)', () => {
  const banned = [/winner/i, /loser/i, /\btruth\b/i, /verdict/i, /liar/i, /dishonest/i, /bad faith/i];
  const text = `${CLASSIFY_BOOLEAN_OBSERVATIONS_TOOL.title} ${CLASSIFY_BOOLEAN_OBSERVATIONS_TOOL.description}`;
  for (const re of banned) {
    if (re.test(text)) {
      throw new Error(`boolean tool description contains banned token matching ${re}`);
    }
  }
  // Description should NOT contain the scaffold marker.
  if (/scaffolded for MCP-SERVER-002/i.test(text)) {
    throw new Error('boolean tool description still references scaffold language');
  }
  if (/not yet implemented/i.test(text)) {
    throw new Error('boolean tool description still references not-yet-implemented');
  }
});
