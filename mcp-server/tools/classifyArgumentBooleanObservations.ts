/**
 * MCP-SERVER-002 — `classify_argument_boolean_observations` tool (REAL).
 *
 * Tool name pinned verbatim from MCP-021C-EDGE's deployed adapter:
 *   `supabase/functions/_shared/booleanObservations/
 *    booleanObservationMcpAdapterCore.ts:44-45` (MCP_BOOLEAN_OBSERVATION_TOOL_NAME)
 *
 * Flow (per design §3):
 *   1. Validate input against the MCP-021A request shape + Family A-specific
 *      extras (schemaVersion match, requestedFamilies ⊆ {parent_relation},
 *      requestedRawKeys ⊆ FAMILY_A_RAW_KEYS, timeoutMs in [1, 60000]).
 *      Rejection paths: invalid_params, unsupported_family, unsupported_rawKey.
 *   2. Select provider — fixture provider (MCP_SERVER_USE_FIXTURE_PROVIDER=true)
 *      OR Anthropic (default).
 *   3. Validate the model response against the MCP-021A wire shape
 *      (validateMcpBooleanObservationResponse). Failure → validation_failed.
 *   4. Doctrine ban-list scan over every string field. Match → validation_failed.
 *   5. Return the tool result with content[text] + structuredContent.
 *
 * Family B-J are NOT implemented in this card. The unsupported_family error
 * envelope is the boundary. Future MCP-SERVER-003+ cards add additional
 * families.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §1 — server returns structural observations only,
 *     never verdicts; ban-list scan blocks verdict tokens in evidenceSpans.
 *   - cdiscourse-doctrine §4 — `modelInfo.provider = 'mcp'` identifies the
 *     output as machine-generated; advisory only.
 *   - cdiscourse-doctrine §6 — secrets stay on the server; no Authorization
 *     / x-api-key / ANTHROPIC_API_KEY ever appears in tool output or logs.
 *   - cdiscourse-doctrine §7 — Anthropic call happens server-side (Deno),
 *     never on the production app.
 *   - cdiscourse-doctrine §10a — observations vs allegations; this output
 *     is the Machine Observation layer.
 */
import type { ToolInvocation, ToolCallResult } from '../lib/toolDispatch.ts';
import type { ToolMetadata } from '../lib/toolRegistry.ts';
import { log } from '../lib/logging.ts';
import { validateFamilyABooleanRequest } from '../lib/familyABooleanRequestSchema.ts';
import { runAnthropicFamilyAClassifier } from '../lib/familyAAnthropic.ts';
import { loadFixtureFamilyAPacket } from '../lib/familyAFixtureProvider.ts';
import { validateMcpBooleanObservationResponse } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { scanFamilyABooleanResponseForBanList } from '../lib/familyABanListScan.ts';

export const CLASSIFY_BOOLEAN_OBSERVATIONS_TOOL: ToolMetadata = {
  name: 'classify_argument_boolean_observations',
  title: 'Argument Boolean Observation Classifier',
  description:
    "Classifies an argument move against MCP-021A Family A (parent_relation) boolean Machine Observation taxonomy. Accepts McpBooleanObservationRequest with requestedFamilies=['parent_relation'] and returns McpBooleanObservationResponse per the schema in src/features/nodeLabels/mcpBooleanObservationSchema.ts. Family B through J return an unsupported_family error envelope in this server build. STRUCTURAL questions only — does not assign factual standing, does not award outcomes, does not treat engagement or popularity as evidence.",
  inputSchema: {
    type: 'object',
    required: [
      'schemaVersion',
      'nodeId',
      'currentText',
      'threadContextExcerpt',
      'requestedFamilies',
      'requestedRawKeys',
      'definitions',
      'timeoutMs',
    ],
    properties: {
      schemaVersion: {
        type: 'string',
        const: 'mcp-021.machine-observations.boolean.v1',
      },
      nodeId: { type: 'string', minLength: 1 },
      parentNodeId: { type: ['string', 'null'] },
      currentText: { type: 'string' },
      parentText: { type: ['string', 'null'] },
      threadContextExcerpt: { type: 'string' },
      requestedFamilies: { type: 'array', items: { type: 'string' } },
      requestedRawKeys: { type: 'array', items: { type: 'string' } },
      definitions: { type: 'object', additionalProperties: true },
      timeoutMs: { type: 'integer', minimum: 1, maximum: 60000 },
    },
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    required: [
      'schemaVersion',
      'nodeId',
      'checkedRawKeys',
      'observations',
      'confidence',
      'evidenceSpan',
      'modelInfo',
    ],
    properties: {
      schemaVersion: {
        type: 'string',
        const: 'mcp-021.machine-observations.boolean.v1',
      },
      nodeId: { type: 'string' },
      checkedRawKeys: { type: 'array', items: { type: 'string' } },
      observations: {
        type: 'object',
        additionalProperties: { type: 'boolean' },
      },
      confidence: {
        type: 'object',
        additionalProperties: { type: 'string', enum: ['low', 'medium', 'high'] },
      },
      evidenceSpan: {
        type: 'object',
        additionalProperties: { type: ['string', 'null'] },
      },
      modelInfo: {
        type: 'object',
        required: ['provider', 'serverName', 'classifierSetVersion'],
        properties: {
          provider: { type: 'string', const: 'mcp' },
          serverName: { type: 'string' },
          classifierSetVersion: { type: 'string' },
        },
      },
    },
    additionalProperties: false,
  },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

function errorResult(
  reason: string,
  message: string,
  extra: Record<string, unknown> = {},
): ToolCallResult {
  return {
    content: [{ type: 'text' as const, text: message }],
    structuredContent: { reason, ...extra },
    isError: true,
  };
}

/**
 * Handle a `classify_argument_boolean_observations` invocation.
 *
 * Returns a structured tool result. Never throws. Errors at any step
 * return an isError envelope with a typed reason — NEVER a partial or
 * fake packet. The Edge Function adapter falls back to the deterministic
 * layer when the server returns an error envelope.
 */
export async function handleClassifyArgumentBooleanObservations(
  input: ToolInvocation,
): Promise<ToolCallResult> {
  const args = isPlainObject(input.rawArgs) ? input.rawArgs : null;
  if (args === null) {
    return errorResult(
      'invalid_params',
      'classify_argument_boolean_observations arguments must be a JSON object',
    );
  }

  // Step 1: server-side input validation.
  const validated = validateFamilyABooleanRequest(args);
  if (!validated.ok) {
    if (validated.kind === 'unsupported_family') {
      log('warn', 'boolean_observations_unsupported_family', {
        requestId: input.requestId,
        tool: 'classify_argument_boolean_observations',
        reason: 'unsupported_family',
        status: 'rejected',
        httpStatus: 200,
      });
      return errorResult(
        'unsupported_family',
        'Family A is the only supported family in this server build',
        {
          requestedFamilies: validated.requestedFamilies,
          supportedFamilies: ['parent_relation'],
        },
      );
    }
    if (validated.kind === 'unsupported_rawKey') {
      log('warn', 'boolean_observations_unsupported_raw_key', {
        requestId: input.requestId,
        tool: 'classify_argument_boolean_observations',
        reason: 'unsupported_rawKey',
        status: 'rejected',
        httpStatus: 200,
      });
      return errorResult(
        'unsupported_rawKey',
        'One or more requestedRawKeys are not in Family A',
        {
          unsupportedRawKeys: validated.unsupportedRawKeys,
        },
      );
    }
    log('warn', 'boolean_observations_invalid_params', {
      requestId: input.requestId,
      tool: 'classify_argument_boolean_observations',
      reason: 'invalid_params',
      status: 'rejected',
      httpStatus: 200,
    });
    return errorResult('invalid_params', 'Input failed schema validation', {
      path: validated.path,
      detail: validated.detail,
    });
  }
  const request = validated.value;

  // Step 2: provider selection.
  let providerResult:
    | { ok: true; packet: Record<string, unknown> }
    | { ok: false; reason: string; detail?: string };
  if (Deno.env.get('MCP_SERVER_USE_FIXTURE_PROVIDER') === 'true') {
    const fixture = await loadFixtureFamilyAPacket();
    if (fixture.ok) {
      providerResult = { ok: true, packet: fixture.value };
    } else {
      providerResult = { ok: false, reason: fixture.reason };
    }
  } else {
    const anthropic = await runAnthropicFamilyAClassifier(request, input.requestId);
    if (anthropic.ok) {
      providerResult = { ok: true, packet: anthropic.packet };
    } else {
      providerResult = { ok: false, reason: anthropic.reason, detail: anthropic.detail };
    }
  }

  if (!providerResult.ok) {
    return errorResult(
      providerResult.reason,
      `Family A classifier call failed: ${providerResult.reason}`,
      providerResult.detail !== undefined ? { detail: providerResult.detail } : {},
    );
  }

  // Step 3: validate response against MCP-021A wire shape.
  const responseCheck = validateMcpBooleanObservationResponse(providerResult.packet);
  if (!responseCheck.ok) {
    log('warn', 'boolean_observations_packet_invalid', {
      requestId: input.requestId,
      tool: 'classify_argument_boolean_observations',
      reason: 'validation_failed',
      status: 'failure',
    });
    return errorResult('validation_failed', 'Model response failed packet schema', {
      path: responseCheck.path,
      detail: responseCheck.detail,
    });
  }

  // Step 4: doctrine ban-list scan.
  const banScanResult = scanFamilyABooleanResponseForBanList(responseCheck.value);
  if (!banScanResult.ok) {
    log('warn', 'boolean_observations_doctrine_ban_list', {
      requestId: input.requestId,
      tool: 'classify_argument_boolean_observations',
      reason: 'validation_failed',
      status: 'failure',
      path: banScanResult.path,
    });
    return errorResult('validation_failed', 'Model response failed doctrine ban-list scan', {
      path: banScanResult.path,
      detail: 'doctrine_ban_list',
    });
  }

  // Step 5: return the validated tool result.
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(responseCheck.value) }],
    structuredContent: responseCheck.value as unknown as Record<string, unknown>,
    isError: false,
  };
}
