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

Deno.test('dispatch: unsupported family H (claim_clarity) returns unsupported_family with full 6-family supportedFamilies list', async () => {
  // MCP-SERVER-007-FAMILY-F promoted critical_question from unsupported to
  // supported. This test continues to exercise an UNREGISTERED family
  // (Family H: claim_clarity). The supportedFamilies envelope now
  // includes all six currently-registered families: parent_relation,
  // disagreement_axis, misunderstanding_repair, evidence_source_chain,
  // argument_scheme, critical_question.
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyBRequest({
        requestedFamilies: ['claim_clarity'],
      }),
      requestId: 'r-dispatch-h-1',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as {
      reason: string;
      requestedFamilies?: string[];
      supportedFamilies?: string[];
    };
    assertEquals(sc.reason, 'unsupported_family');
    assertEquals(sc.requestedFamilies, ['claim_clarity']);
    assertEquals(sc.supportedFamilies, [
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
      'evidence_source_chain',
      'argument_scheme',
      'critical_question',
    ]);
  });
});

Deno.test('dispatch: unsupported family G (resolution_progress) returns unsupported_family (replaces stale Family D test)', async () => {
  // MCP-SERVER-005-FAMILY-D added Family D (evidence_source_chain) as a
  // supported family. This regression test now uses Family G to keep
  // the "unsupported family" check coverage. Family E/F/H/I/J also
  // remain unsupported (verified in familyBooleanRequestSchema.test.ts).
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyBRequest({
        requestedFamilies: ['resolution_progress'],
      }),
      requestId: 'r-dispatch-g-1',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as { reason: string };
    assertEquals(sc.reason, 'unsupported_family');
  });
});

Deno.test('dispatch: unsupported family I (thread_topology) returns unsupported_family (post MCP-SERVER-007-FAMILY-F)', async () => {
  // MCP-SERVER-007-FAMILY-F promoted critical_question to supported. The
  // unsupported-family regression for Family B now uses Family I instead.
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyBRequest({
        requestedFamilies: ['thread_topology'],
      }),
      requestId: 'r-dispatch-i-1',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as { reason: string };
    assertEquals(sc.reason, 'unsupported_family');
  });
});
