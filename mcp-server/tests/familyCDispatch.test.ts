/**
 * MCP-SERVER-004-FAMILY-C — Family C tool dispatcher tests.
 *
 * Critical invariants:
 *   - Family C fixture-mode request returns a Family C canonical response
 *     (classifierSetVersion='family-c-v1', 17 keys, no Family A or B keys).
 *   - Family A and Family B fixture-mode requests continue to return their
 *     respective canonical responses (regression — byte-equal preservation).
 *   - Cross-family rejection: Family A rawKey under requestedFamilies=
 *     ['misunderstanding_repair'] returns unsupported_rawKey; Family B
 *     rawKey under the same returns unsupported_rawKey; Family C rawKey
 *     under requestedFamilies=['parent_relation'] returns unsupported_rawKey;
 *     Family C rawKey under requestedFamilies=['disagreement_axis']
 *     returns unsupported_rawKey.
 *   - The dispatcher routes the FIRST registered family in requestedFamilies
 *     when multiple are given (per design §7 binding rule).
 *   - Unregistered families (D/E) return unsupported_family with all three
 *     supported families in the envelope.
 *
 * All tests run under MCP_SERVER_USE_FIXTURE_PROVIDER=true so no Anthropic
 * call is made.
 */
import { assertEquals } from 'std/assert/mod.ts';
import { handleClassifyArgumentBooleanObservations } from '../tools/classifyArgumentBooleanObservations.ts';

const SCHEMA_VERSION = 'mcp-021.machine-observations.boolean.v1';

function withFixtureEnv<T>(fn: () => Promise<T>): Promise<T> {
  const prev = Deno.env.get('MCP_SERVER_USE_FIXTURE_PROVIDER');
  Deno.env.set('MCP_SERVER_USE_FIXTURE_PROVIDER', 'true');
  return fn().finally(() => {
    if (prev === undefined) Deno.env.delete('MCP_SERVER_USE_FIXTURE_PROVIDER');
    else Deno.env.set('MCP_SERVER_USE_FIXTURE_PROVIDER', prev);
  });
}

function familyCRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: SCHEMA_VERSION,
    nodeId: 'fixture-node-c-1',
    parentNodeId: null,
    currentText: 'Are you saying libraries are public goods funded like roads?',
    parentText: 'Libraries are infrastructure.',
    threadContextExcerpt: 'fixture Family C thread context',
    requestedFamilies: ['misunderstanding_repair'],
    requestedRawKeys: ['offers_candidate_understanding', 'confirms_understanding'],
    definitions: {},
    timeoutMs: 12000,
    ...overrides,
  };
}

function familyBRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: SCHEMA_VERSION,
    nodeId: 'fixture-node-b-1',
    parentNodeId: null,
    currentText: 'fixture Family B move text',
    parentText: null,
    threadContextExcerpt: 'fixture Family B thread context',
    requestedFamilies: ['disagreement_axis'],
    requestedRawKeys: ['disagreement_present', 'disputes_definition'],
    definitions: {},
    timeoutMs: 12000,
    ...overrides,
  };
}

function familyARequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: SCHEMA_VERSION,
    nodeId: 'fixture-node-a-1',
    parentNodeId: null,
    currentText: 'fixture Family A move text',
    parentText: null,
    threadContextExcerpt: 'fixture Family A thread context',
    requestedFamilies: ['parent_relation'],
    requestedRawKeys: ['supports_parent', 'challenges_parent'],
    definitions: {},
    timeoutMs: 12000,
    ...overrides,
  };
}

Deno.test('dispatch: Family C request routes to Family C fixture provider (family-c-v1)', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyCRequest(),
      requestId: 'r-dispatch-c-1',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, false);
    const sc = result.structuredContent as Record<string, unknown>;
    const modelInfo = sc.modelInfo as Record<string, unknown>;
    assertEquals(modelInfo.classifierSetVersion, 'family-c-v1');
  });
});

Deno.test('dispatch: Family C fixture response includes 17 Family C rawKeys (not Family A or B keys)', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyCRequest(),
      requestId: 'r-dispatch-c-2',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, false);
    const sc = result.structuredContent as Record<string, unknown>;
    const checkedRawKeys = sc.checkedRawKeys as string[];
    assertEquals(checkedRawKeys.length, 17);
    // offers_candidate_understanding is a Family C key; supports_parent is
    // Family A; disagreement_present is Family B. The Family C response
    // MUST include the former but NOT the latter two.
    if (!checkedRawKeys.includes('offers_candidate_understanding')) {
      throw new Error('Family C dispatch did not return offers_candidate_understanding');
    }
    if (checkedRawKeys.includes('supports_parent')) {
      throw new Error('Family C dispatch incorrectly returned Family A rawKey supports_parent');
    }
    if (checkedRawKeys.includes('disagreement_present')) {
      throw new Error('Family C dispatch incorrectly returned Family B rawKey disagreement_present');
    }
  });
});

Deno.test('dispatch: Family A request continues to route to Family A fixture provider (regression)', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyARequest(),
      requestId: 'r-dispatch-a-1',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, false);
    const sc = result.structuredContent as Record<string, unknown>;
    const modelInfo = sc.modelInfo as Record<string, unknown>;
    assertEquals(modelInfo.classifierSetVersion, 'family-a-v1');
  });
});

Deno.test('dispatch: Family B request continues to route to Family B fixture provider (regression)', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyBRequest(),
      requestId: 'r-dispatch-b-1',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, false);
    const sc = result.structuredContent as Record<string, unknown>;
    const modelInfo = sc.modelInfo as Record<string, unknown>;
    assertEquals(modelInfo.classifierSetVersion, 'family-b-v1');
  });
});

Deno.test('dispatch: cross-family request (Family A rawKey under misunderstanding_repair) returns unsupported_rawKey', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyCRequest({
        requestedRawKeys: ['supports_parent'], // Family A key
      }),
      requestId: 'r-dispatch-cross-c-a',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as {
      reason: string;
      unsupportedRawKeys?: string[];
    };
    assertEquals(sc.reason, 'unsupported_rawKey');
    assertEquals(sc.unsupportedRawKeys, ['supports_parent']);
  });
});

Deno.test('dispatch: cross-family request (Family B rawKey under misunderstanding_repair) returns unsupported_rawKey', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyCRequest({
        requestedRawKeys: ['disputes_definition'], // Family B key
      }),
      requestId: 'r-dispatch-cross-c-b',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as {
      reason: string;
      unsupportedRawKeys?: string[];
    };
    assertEquals(sc.reason, 'unsupported_rawKey');
    assertEquals(sc.unsupportedRawKeys, ['disputes_definition']);
  });
});

Deno.test('dispatch: cross-family request (Family C rawKey under parent_relation) returns unsupported_rawKey', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyARequest({
        requestedRawKeys: ['offers_candidate_understanding'], // Family C key
      }),
      requestId: 'r-dispatch-cross-a-c',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as {
      reason: string;
      unsupportedRawKeys?: string[];
    };
    assertEquals(sc.reason, 'unsupported_rawKey');
    assertEquals(sc.unsupportedRawKeys, ['offers_candidate_understanding']);
  });
});

Deno.test('dispatch: cross-family request (Family C rawKey under disagreement_axis) returns unsupported_rawKey', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyBRequest({
        requestedRawKeys: ['offers_candidate_understanding'], // Family C key
      }),
      requestId: 'r-dispatch-cross-b-c',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as {
      reason: string;
      unsupportedRawKeys?: string[];
    };
    assertEquals(sc.reason, 'unsupported_rawKey');
    assertEquals(sc.unsupportedRawKeys, ['offers_candidate_understanding']);
  });
});

Deno.test('dispatch: unsupported family D (evidence_source_chain) returns unsupported_family with full supportedFamilies list', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyCRequest({
        requestedFamilies: ['evidence_source_chain'],
      }),
      requestId: 'r-dispatch-d-1',
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
    assertEquals(sc.supportedFamilies, ['parent_relation', 'disagreement_axis', 'misunderstanding_repair']);
  });
});

Deno.test('dispatch: unsupported family E (argument_scheme) returns unsupported_family', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyCRequest({
        requestedFamilies: ['argument_scheme'],
      }),
      requestId: 'r-dispatch-e-1',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as { reason: string };
    assertEquals(sc.reason, 'unsupported_family');
  });
});

Deno.test('dispatch: Family C tool description advertises Family C alongside A and B', () => {
  // Defensive doctrine check: the tool description must include all three
  // family names so MCP clients (e.g., Edge adapter, hosted smoke) can route
  // requests correctly. The tool description text is part of the wire
  // contract.
  // Imported lazily via dynamic import so this test stays in the dispatch
  // file rather than ballooning the classifyArgumentBooleanObservations test
  // file.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return import('../tools/classifyArgumentBooleanObservations.ts').then((mod) => {
    const description = mod.CLASSIFY_BOOLEAN_OBSERVATIONS_TOOL.description;
    if (!description.includes('Family A')) {
      throw new Error('Tool description missing "Family A"');
    }
    if (!description.includes('Family B')) {
      throw new Error('Tool description missing "Family B"');
    }
    if (!description.includes('Family C')) {
      throw new Error('Tool description missing "Family C"');
    }
    if (!description.includes('parent_relation')) {
      throw new Error('Tool description missing "parent_relation"');
    }
    if (!description.includes('disagreement_axis')) {
      throw new Error('Tool description missing "disagreement_axis"');
    }
    if (!description.includes('misunderstanding_repair')) {
      throw new Error('Tool description missing "misunderstanding_repair"');
    }
  });
});
