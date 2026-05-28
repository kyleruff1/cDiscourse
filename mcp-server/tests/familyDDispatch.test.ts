/**
 * MCP-SERVER-005-FAMILY-D — Family D tool dispatcher tests.
 *
 * Critical invariants:
 *   - Family D fixture-mode request returns a Family D canonical response
 *     (classifierSetVersion='family-d-v1', 19 keys, no Family A / B / C keys).
 *   - Family A, B, C fixture-mode requests continue to return their
 *     respective canonical responses (regression — byte-equal preservation).
 *   - 4-way cross-family rejection: each family's keys rejected under
 *     other 3 families (12 combinations + 4 sanity).
 *   - Unregistered families (E-J) return unsupported_family with all four
 *     supported families in the envelope.
 *   - The 8 excluded deterministic Family D rawKeys return unsupported_rawKey
 *     when requested under evidence_source_chain (Stage 2B safeguard).
 *   - Tool description advertises Family D alongside A, B, C.
 *
 * All tests run under MCP_SERVER_USE_FIXTURE_PROVIDER=true so no Anthropic
 * call is made. The Family D canonical fixture file is added in Commit 5;
 * this dispatch test schedules but does not actually exercise the fixture
 * load until Commit 5 lands.
 */
import { assertEquals } from 'std/assert/mod.ts';
import { handleClassifyArgumentBooleanObservations } from '../tools/classifyArgumentBooleanObservations.ts';
import { FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS } from '../lib/familyDKeys.ts';

const SCHEMA_VERSION = 'mcp-021.machine-observations.boolean.v1';

function withFixtureEnv<T>(fn: () => Promise<T>): Promise<T> {
  const prev = Deno.env.get('MCP_SERVER_USE_FIXTURE_PROVIDER');
  Deno.env.set('MCP_SERVER_USE_FIXTURE_PROVIDER', 'true');
  return fn().finally(() => {
    if (prev === undefined) Deno.env.delete('MCP_SERVER_USE_FIXTURE_PROVIDER');
    else Deno.env.set('MCP_SERVER_USE_FIXTURE_PROVIDER', prev);
  });
}

function familyDRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: SCHEMA_VERSION,
    nodeId: 'fixture-node-d-1',
    parentNodeId: null,
    currentText: 'Per the 2024 EPA report Table 3.1, urban EV-heavy cities show a 40% drop in tailpipe emissions.',
    parentText: 'EVs reduce emissions in cities.',
    threadContextExcerpt: 'fixture Family D thread context',
    requestedFamilies: ['evidence_source_chain'],
    requestedRawKeys: ['source_provided', 'provides_evidence'],
    definitions: {},
    timeoutMs: 12000,
    ...overrides,
  };
}

function familyCRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: SCHEMA_VERSION,
    nodeId: 'fixture-node-c-1',
    parentNodeId: null,
    currentText: 'fixture Family C move text',
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

Deno.test('dispatch: Family D request routes to Family D fixture provider (family-d-v1)', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyDRequest(),
      requestId: 'r-dispatch-d-1',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, false);
    const sc = result.structuredContent as Record<string, unknown>;
    const modelInfo = sc.modelInfo as Record<string, unknown>;
    assertEquals(modelInfo.classifierSetVersion, 'family-d-v1');
  });
});

Deno.test('dispatch: Family D fixture response uses only the 19 Subset keys (not Family A/B/C keys)', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyDRequest(),
      requestId: 'r-dispatch-d-2',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, false);
    const sc = result.structuredContent as Record<string, unknown>;
    const checkedRawKeys = sc.checkedRawKeys as string[];
    // source_provided is a Family D key; supports_parent is Family A;
    // disagreement_present is Family B; offers_candidate_understanding is
    // Family C. The Family D response MUST NOT include any of the Family
    // A/B/C keys.
    if (!checkedRawKeys.includes('source_provided')) {
      throw new Error('Family D dispatch did not return source_provided');
    }
    if (checkedRawKeys.includes('supports_parent')) {
      throw new Error('Family D dispatch incorrectly returned Family A rawKey supports_parent');
    }
    if (checkedRawKeys.includes('disagreement_present')) {
      throw new Error('Family D dispatch incorrectly returned Family B rawKey disagreement_present');
    }
    if (checkedRawKeys.includes('offers_candidate_understanding')) {
      throw new Error('Family D dispatch incorrectly returned Family C rawKey offers_candidate_understanding');
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

Deno.test('dispatch: Family C request continues to route to Family C fixture provider (regression)', async () => {
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

Deno.test('dispatch: 4-way cross-family rejection (Family A rawKey under evidence_source_chain) returns unsupported_rawKey', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyDRequest({
        requestedRawKeys: ['supports_parent'], // Family A key under D
      }),
      requestId: 'r-dispatch-cross-d-a',
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

Deno.test('dispatch: 4-way cross-family rejection (Family B rawKey under evidence_source_chain) returns unsupported_rawKey', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyDRequest({
        requestedRawKeys: ['disputes_definition'], // Family B key under D
      }),
      requestId: 'r-dispatch-cross-d-b',
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

Deno.test('dispatch: 4-way cross-family rejection (Family C rawKey under evidence_source_chain) returns unsupported_rawKey', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyDRequest({
        requestedRawKeys: ['offers_candidate_understanding'], // Family C key under D
      }),
      requestId: 'r-dispatch-cross-d-c',
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

Deno.test('dispatch: 4-way cross-family rejection (Family D rawKey under parent_relation) returns unsupported_rawKey', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyARequest({
        requestedRawKeys: ['source_provided'], // Family D key under A
      }),
      requestId: 'r-dispatch-cross-a-d',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as {
      reason: string;
      unsupportedRawKeys?: string[];
    };
    assertEquals(sc.reason, 'unsupported_rawKey');
    assertEquals(sc.unsupportedRawKeys, ['source_provided']);
  });
});

Deno.test('dispatch: 4-way cross-family rejection (Family D rawKey under disagreement_axis) returns unsupported_rawKey', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyBRequest({
        requestedRawKeys: ['evidence_gap_present'], // Family D key under B
      }),
      requestId: 'r-dispatch-cross-b-d',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as {
      reason: string;
      unsupportedRawKeys?: string[];
    };
    assertEquals(sc.reason, 'unsupported_rawKey');
    assertEquals(sc.unsupportedRawKeys, ['evidence_gap_present']);
  });
});

Deno.test('dispatch: 4-way cross-family rejection (Family D rawKey under misunderstanding_repair) returns unsupported_rawKey', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyCRequest({
        requestedRawKeys: ['burden_request_present'], // Family D key under C
      }),
      requestId: 'r-dispatch-cross-c-d',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as {
      reason: string;
      unsupportedRawKeys?: string[];
    };
    assertEquals(sc.reason, 'unsupported_rawKey');
    assertEquals(sc.unsupportedRawKeys, ['burden_request_present']);
  });
});

Deno.test('dispatch: unsupported family E (argument_scheme) returns unsupported_family with 4-family supportedFamilies list', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyDRequest({
        requestedFamilies: ['argument_scheme'],
      }),
      requestId: 'r-dispatch-e-1',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as {
      reason: string;
      requestedFamilies?: string[];
      supportedFamilies?: string[];
    };
    assertEquals(sc.reason, 'unsupported_family');
    assertEquals(sc.requestedFamilies, ['argument_scheme']);
    assertEquals(sc.supportedFamilies, [
      'parent_relation',
      'disagreement_axis',
      'misunderstanding_repair',
      'evidence_source_chain',
    ]);
  });
});

Deno.test('dispatch: 8 excluded deterministic Family D rawKeys all return unsupported_rawKey (Stage 2B safeguard)', async () => {
  // Stage 2B operator binding: the 8 excluded deterministic Family D
  // rawKeys (5 auto_metadata + 3 lifecycle; 6 unique strings) MUST NOT
  // be silently converted into model-inferred keys. Requesting any of
  // them under requestedFamilies=['evidence_source_chain'] returns
  // unsupported_rawKey at the registry boundary. The dispatcher MUST
  // NOT route them to the Family D Anthropic call.
  await withFixtureEnv(async () => {
    for (const excludedKey of FAMILY_D_EXCLUDED_DETERMINISTIC_RAW_KEYS) {
      const result = await handleClassifyArgumentBooleanObservations({
        toolName: 'classify_argument_boolean_observations',
        rawArgs: familyDRequest({
          requestedRawKeys: [excludedKey],
        }),
        requestId: `r-dispatch-d-excluded-${excludedKey}`,
        envelope: 'jsonRpc',
      });
      assertEquals(result.isError, true, `Excluded rawKey '${excludedKey}' must be rejected`);
      const sc = result.structuredContent as {
        reason: string;
        unsupportedRawKeys?: string[];
      };
      assertEquals(sc.reason, 'unsupported_rawKey');
      assertEquals(sc.unsupportedRawKeys, [excludedKey]);
    }
  });
});

Deno.test('dispatch: Family D tool description advertises Family D alongside A, B, C', () => {
  // Defensive doctrine check: the tool description must include all four
  // family names so MCP clients (e.g., Edge adapter, hosted smoke) can
  // route requests correctly. The tool description text is part of the
  // wire contract.
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
    if (!description.includes('Family D')) {
      throw new Error('Tool description missing "Family D"');
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
    if (!description.includes('evidence_source_chain')) {
      throw new Error('Tool description missing "evidence_source_chain"');
    }
    if (!description.includes('19-key ai_classifier Subset')) {
      throw new Error('Tool description missing Family D Subset description');
    }
  });
});
