/**
 * MCP-SERVER-003-FAMILY-B — Family B tool dispatcher tests.
 *
 * Critical invariants:
 *   - Family B fixture-mode request returns a Family B canonical response
 *     (classifierSetVersion='family-b-v1', 14 keys, no Family A keys).
 *   - Family A fixture-mode request continues to return the Family A
 *     canonical response (regression — byte-equal preservation).
 *   - Cross-family rejection: Family A rawKey under requestedFamilies=
 *     ['disagreement_axis'] returns unsupported_rawKey.
 *   - The dispatcher routes the FIRST registered family in requestedFamilies
 *     when multiple are given (per design §7 binding rule).
 *   - Unregistered families (C/D/E) return unsupported_family.
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

Deno.test('dispatch: Family B request routes to Family B fixture provider (family-b-v1)', async () => {
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

Deno.test('dispatch: Family B fixture response includes 14 Family B rawKeys (not Family A keys)', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyBRequest(),
      requestId: 'r-dispatch-b-2',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, false);
    const sc = result.structuredContent as Record<string, unknown>;
    const checkedRawKeys = sc.checkedRawKeys as string[];
    assertEquals(checkedRawKeys.length, 14);
    // disagreement_present is a Family B umbrella key; supports_parent is a
    // Family A key. The Family B response MUST include the former but NOT
    // the latter.
    if (!checkedRawKeys.includes('disagreement_present')) {
      throw new Error('Family B dispatch did not return disagreement_present');
    }
    if (checkedRawKeys.includes('supports_parent')) {
      throw new Error('Family B dispatch incorrectly returned Family A rawKey supports_parent');
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

Deno.test('dispatch: Family A fixture response includes 16 Family A rawKeys (not Family B keys)', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyARequest(),
      requestId: 'r-dispatch-a-2',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, false);
    const sc = result.structuredContent as Record<string, unknown>;
    const checkedRawKeys = sc.checkedRawKeys as string[];
    assertEquals(checkedRawKeys.length, 16);
    if (!checkedRawKeys.includes('supports_parent')) {
      throw new Error('Family A dispatch did not return supports_parent');
    }
    if (checkedRawKeys.includes('disagreement_present')) {
      throw new Error('Family A dispatch incorrectly returned Family B rawKey disagreement_present');
    }
  });
});

Deno.test('dispatch: cross-family request (Family A rawKey under disagreement_axis) returns unsupported_rawKey', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyBRequest({
        requestedRawKeys: ['supports_parent'], // Family A key
      }),
      requestId: 'r-dispatch-cross-1',
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

Deno.test('dispatch: cross-family request (Family B rawKey under parent_relation) returns unsupported_rawKey', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyARequest({
        requestedRawKeys: ['disputes_definition'], // Family B key
      }),
      requestId: 'r-dispatch-cross-2',
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

Deno.test('dispatch: unsupported family F (critical_question) returns unsupported_family with full supportedFamilies list', async () => {
  // MCP-SERVER-004-FAMILY-C promoted misunderstanding_repair from
  // unsupported to supported, so this test now exercises an UNREGISTERED
  // family (Family F: critical_question). The supportedFamilies envelope
  // includes all three currently-registered families: parent_relation,
  // disagreement_axis, misunderstanding_repair.
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyBRequest({
        requestedFamilies: ['critical_question'],
      }),
      requestId: 'r-dispatch-f-1',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as {
      reason: string;
      requestedFamilies?: string[];
      supportedFamilies?: string[];
    };
    assertEquals(sc.reason, 'unsupported_family');
    assertEquals(sc.requestedFamilies, ['critical_question']);
    assertEquals(sc.supportedFamilies, ['parent_relation', 'disagreement_axis', 'misunderstanding_repair']);
  });
});

Deno.test('dispatch: unsupported family D (evidence_source_chain) returns unsupported_family', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyBRequest({
        requestedFamilies: ['evidence_source_chain'],
      }),
      requestId: 'r-dispatch-d-1',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as { reason: string };
    assertEquals(sc.reason, 'unsupported_family');
  });
});

Deno.test('dispatch: unsupported family E (argument_scheme) returns unsupported_family', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyBRequest({
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
