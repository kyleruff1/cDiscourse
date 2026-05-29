/**
 * MCP-SERVER-006-FAMILY-E — Family E tool dispatcher tests.
 *
 * Critical invariants:
 *   - Family E fixture-mode request returns a Family E canonical response
 *     (classifierSetVersion='family-e-v1', 16 keys, no Family A/B/C/D keys).
 *   - Family A, B, C, D fixture-mode requests continue to return their
 *     respective canonical responses (regression — byte-equal preservation).
 *   - 5-way cross-family rejection: each family's keys rejected under
 *     other 4 families (20 combinations sampled + 5 sanity).
 *   - Unregistered families (F-J) return unsupported_family with the
 *     supportedFamilies envelope including all five real families.
 *   - Tool description advertises Family E alongside A, B, C, D.
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

function familyERequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: SCHEMA_VERSION,
    nodeId: 'fixture-node-e-1',
    parentNodeId: null,
    currentText: 'If we permit this, agencies will start defining acceptable speech, then expand the categories, then arrive at full suppression.',
    parentText: 'A targeted regulation against fraudulent product claims has been proposed.',
    threadContextExcerpt: 'fixture Family E thread context',
    requestedFamilies: ['argument_scheme'],
    requestedRawKeys: ['slippery_slope_reasoning_present', 'causal_reasoning_present'],
    definitions: {},
    timeoutMs: 12000,
    ...overrides,
  };
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

Deno.test('dispatch: Family E request routes to Family E fixture provider (family-e-v1)', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyERequest(),
      requestId: 'r-dispatch-e-1',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, false);
    const sc = result.structuredContent as Record<string, unknown>;
    const modelInfo = sc.modelInfo as Record<string, unknown>;
    assertEquals(modelInfo.classifierSetVersion, 'family-e-v1');
  });
});

Deno.test('dispatch: Family E fixture response uses only the 16 Family E keys (not Family A/B/C/D keys)', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyERequest(),
      requestId: 'r-dispatch-e-2',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, false);
    const sc = result.structuredContent as Record<string, unknown>;
    const checkedRawKeys = sc.checkedRawKeys as string[];
    // slippery_slope_reasoning_present is a Family E key; supports_parent is A;
    // disagreement_present is B; offers_candidate_understanding is C;
    // source_provided is D. The Family E response MUST NOT include any of
    // the Family A/B/C/D keys.
    if (!checkedRawKeys.includes('slippery_slope_reasoning_present')) {
      throw new Error('Family E dispatch did not return slippery_slope_reasoning_present');
    }
    if (checkedRawKeys.includes('supports_parent')) {
      throw new Error('Family E dispatch incorrectly returned Family A rawKey supports_parent');
    }
    if (checkedRawKeys.includes('disagreement_present')) {
      throw new Error('Family E dispatch incorrectly returned Family B rawKey disagreement_present');
    }
    if (checkedRawKeys.includes('offers_candidate_understanding')) {
      throw new Error('Family E dispatch incorrectly returned Family C rawKey offers_candidate_understanding');
    }
    if (checkedRawKeys.includes('source_provided')) {
      throw new Error('Family E dispatch incorrectly returned Family D rawKey source_provided');
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

Deno.test('dispatch: Family D request continues to route to Family D fixture provider (regression)', async () => {
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

// ─────────────────────────────────────────────────────────────────────────
// 5-way cross-family rejection (A↔E, B↔E, C↔E, D↔E + sanity)
// ─────────────────────────────────────────────────────────────────────────

Deno.test('dispatch: 5-way cross-family rejection (Family A rawKey under argument_scheme) returns unsupported_rawKey', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyERequest({
        requestedRawKeys: ['supports_parent'],
      }),
      requestId: 'r-dispatch-cross-e-a',
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

Deno.test('dispatch: 5-way cross-family rejection (Family B rawKey under argument_scheme) returns unsupported_rawKey', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyERequest({
        requestedRawKeys: ['disputes_definition'],
      }),
      requestId: 'r-dispatch-cross-e-b',
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

Deno.test('dispatch: 5-way cross-family rejection (Family C rawKey under argument_scheme) returns unsupported_rawKey', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyERequest({
        requestedRawKeys: ['offers_candidate_understanding'],
      }),
      requestId: 'r-dispatch-cross-e-c',
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

Deno.test('dispatch: 5-way cross-family rejection (Family D rawKey under argument_scheme) returns unsupported_rawKey', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyERequest({
        requestedRawKeys: ['source_provided'],
      }),
      requestId: 'r-dispatch-cross-e-d',
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

Deno.test('dispatch: 5-way cross-family rejection (Family E rawKey under parent_relation) returns unsupported_rawKey', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyARequest({
        requestedRawKeys: ['slippery_slope_reasoning_present'],
      }),
      requestId: 'r-dispatch-cross-a-e',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as {
      reason: string;
      unsupportedRawKeys?: string[];
    };
    assertEquals(sc.reason, 'unsupported_rawKey');
    assertEquals(sc.unsupportedRawKeys, ['slippery_slope_reasoning_present']);
  });
});

Deno.test('dispatch: 5-way cross-family rejection (Family E rawKey under disagreement_axis) returns unsupported_rawKey', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyBRequest({
        requestedRawKeys: ['causal_reasoning_present'],
      }),
      requestId: 'r-dispatch-cross-b-e',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as {
      reason: string;
      unsupportedRawKeys?: string[];
    };
    assertEquals(sc.reason, 'unsupported_rawKey');
    assertEquals(sc.unsupportedRawKeys, ['causal_reasoning_present']);
  });
});

Deno.test('dispatch: 5-way cross-family rejection (Family E rawKey under misunderstanding_repair) returns unsupported_rawKey', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyCRequest({
        requestedRawKeys: ['analogy_reasoning_present'],
      }),
      requestId: 'r-dispatch-cross-c-e',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as {
      reason: string;
      unsupportedRawKeys?: string[];
    };
    assertEquals(sc.reason, 'unsupported_rawKey');
    assertEquals(sc.unsupportedRawKeys, ['analogy_reasoning_present']);
  });
});

Deno.test('dispatch: 5-way cross-family rejection (Family E rawKey under evidence_source_chain) returns unsupported_rawKey', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyDRequest({
        requestedRawKeys: ['precedent_reasoning_present'],
      }),
      requestId: 'r-dispatch-cross-d-e',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as {
      reason: string;
      unsupportedRawKeys?: string[];
    };
    assertEquals(sc.reason, 'unsupported_rawKey');
    assertEquals(sc.unsupportedRawKeys, ['precedent_reasoning_present']);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// Unsupported families H-J (post MCP-SERVER-008-FAMILY-G; Family G now supported)
// ─────────────────────────────────────────────────────────────────────────

Deno.test('dispatch: unsupported family H (claim_clarity) returns unsupported_family with 7-family supportedFamilies list', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyERequest({
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
      'resolution_progress',
    ]);
  });
});

Deno.test('dispatch: unsupported families H/I/J all return unsupported_family', async () => {
  await withFixtureEnv(async () => {
    for (const family of ['claim_clarity', 'thread_topology', 'sensitive_composer']) {
      const result = await handleClassifyArgumentBooleanObservations({
        toolName: 'classify_argument_boolean_observations',
        rawArgs: familyERequest({
          requestedFamilies: [family],
        }),
        requestId: `r-dispatch-unsup-${family}`,
        envelope: 'jsonRpc',
      });
      assertEquals(result.isError, true, `${family} should be unsupported`);
      const sc = result.structuredContent as { reason: string };
      assertEquals(sc.reason, 'unsupported_family');
    }
  });
});

// MCP-SERVER-008-FAMILY-G: resolution_progress (Family G) is now SUPPORTED at
// the dispatch layer. Verify the fixture-provider path returns a clean packet
// (the F-card dispatch-retarget pattern: the newly-promoted family gets a
// positive dispatch assertion when the prior family's dispatch file is
// retargeted).
Deno.test('dispatch: supported family G (resolution_progress) returns a clean family-g-v1 packet via fixture provider', async () => {
  await withFixtureEnv(async () => {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: familyERequest({
        requestedFamilies: ['resolution_progress'],
        requestedRawKeys: ['synthesis_proposed', 'common_ground_identified'],
      }),
      requestId: 'r-dispatch-g-supported-1',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, false);
    const sc = result.structuredContent as Record<string, unknown>;
    const modelInfo = sc.modelInfo as Record<string, unknown>;
    assertEquals(modelInfo.classifierSetVersion, 'family-g-v1');
  });
});

Deno.test('dispatch: Family E tool description advertises Family E alongside A, B, C, D', () => {
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
    if (!description.includes('Family E')) {
      throw new Error('Tool description missing "Family E"');
    }
    if (!description.includes('parent_relation')) {
      throw new Error('Tool description missing "parent_relation"');
    }
    if (!description.includes('argument_scheme')) {
      throw new Error('Tool description missing "argument_scheme"');
    }
    if (!description.includes('Walton')) {
      throw new Error('Tool description missing Family E "Walton" reference');
    }
    if (!description.includes('slippery-slope')) {
      throw new Error('Tool description missing "slippery-slope" reference');
    }
  });
});
