/**
 * MCP-SERVER-002 + MCP-SERVER-003-FAMILY-B + MCP-SERVER-004-FAMILY-C — `classify_argument_boolean_observations` tool.
 *
 * Tool name pinned verbatim from MCP-021C-EDGE's deployed adapter:
 *   `supabase/functions/_shared/booleanObservations/
 *    booleanObservationMcpAdapterCore.ts:44-45` (MCP_BOOLEAN_OBSERVATION_TOOL_NAME)
 *
 * Flow (per design §3 + MCP-SERVER-003-FAMILY-B design §7 +
 * MCP-SERVER-004-FAMILY-C design §1):
 *   1. Validate input against the MCP-021A request shape + per-family
 *      rawKey-membership routing (requestedFamilies ⊆ registered families,
 *      requestedRawKeys ⊆ one-of-the-requested-family rawKey sets,
 *      timeoutMs in [1, 60000]). Rejection paths: invalid_params,
 *      unsupported_family, unsupported_rawKey.
 *   2. Resolve which family this request targets (first entry of
 *      requestedFamilies; defaults to 'parent_relation' for byte-equal
 *      preservation when requestedFamilies is empty).
 *   3. Select provider per resolved family — fixture provider
 *      (MCP_SERVER_USE_FIXTURE_PROVIDER=true) OR family-specific Anthropic
 *      orchestrator (default). Family A → runAnthropicFamilyAClassifier /
 *      loadFixtureFamilyAPacket; Family B → runAnthropicFamilyBClassifier /
 *      loadFixtureFamilyBPacket; Family C → runAnthropicFamilyCClassifier /
 *      loadFixtureFamilyCPacket.
 *   4. Validate the model response against the MCP-021A wire shape
 *      (validateMcpBooleanObservationResponse). Failure → validation_failed.
 *   5. Doctrine ban-list scan over every string field, using the
 *      family-specific scanner (Family A → scanFamilyABooleanResponseForBanList;
 *      Family B → scanFamilyBBooleanResponseForBanList; Family C →
 *      scanFamilyCBooleanResponseForBanList). Match → validation_failed.
 *   6. Return the tool result with content[text] + structuredContent.
 *
 * Family D-J are NOT implemented in this card. The unsupported_family error
 * envelope is the boundary; the validator already rejects them at the
 * registry layer. Future MCP-SERVER-005+ cards add additional families.
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
import { validateFamilyBooleanRequest } from '../lib/familyBooleanRequestSchema.ts';
// Side-effect import: ensure the family registry is initialized (Family A
// + Family B + Family C self-register) before the validator runs.
import '../lib/familyRegistryInit.ts';
import { getSupportedFamilies } from '../lib/familyRegistry.ts';
import { runAnthropicFamilyAClassifier } from '../lib/familyAAnthropic.ts';
import { loadFixtureFamilyAPacket } from '../lib/familyAFixtureProvider.ts';
import { runAnthropicFamilyBClassifier } from '../lib/familyBAnthropic.ts';
import { loadFixtureFamilyBPacket } from '../lib/familyBFixtureProvider.ts';
import { runAnthropicFamilyCClassifier } from '../lib/familyCAnthropic.ts';
import { loadFixtureFamilyCPacket } from '../lib/familyCFixtureProvider.ts';
import {
  validateMcpBooleanObservationResponse,
  type McpBooleanObservationValidatedResponse,
} from '../lib/mcpBooleanObservationSchemaMirror.ts';
import { scanFamilyABooleanResponseForBanList } from '../lib/familyABanListScan.ts';
import { scanFamilyBBooleanResponseForBanList } from '../lib/familyBBanListScan.ts';
import { scanFamilyCBooleanResponseForBanList } from '../lib/familyCBanListScan.ts';
import type { AnthropicCallResult } from '../lib/anthropicCall.ts';
import type { ValidatedFamilyARequest } from '../lib/familyAPrompt.ts';
import type { ValidatedFamilyBRequest } from '../lib/familyBPrompt.ts';
import type { ValidatedFamilyCRequest } from '../lib/familyCPrompt.ts';

export const CLASSIFY_BOOLEAN_OBSERVATIONS_TOOL: ToolMetadata = {
  name: 'classify_argument_boolean_observations',
  title: 'Argument Boolean Observation Classifier',
  description:
    "Classifies an argument move against MCP-021A Family A (parent_relation), Family B (disagreement_axis), OR Family C (misunderstanding_repair) boolean Machine Observation taxonomy. Accepts McpBooleanObservationRequest with requestedFamilies=['parent_relation'] or requestedFamilies=['disagreement_axis'] or requestedFamilies=['misunderstanding_repair'] and returns McpBooleanObservationResponse per the schema in src/features/nodeLabels/mcpBooleanObservationSchema.ts. Family D through J return an unsupported_family error envelope in this server build. STRUCTURAL questions only — does not assign factual standing, does not award outcomes, does not treat engagement or popularity as evidence.",
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
 * Family-specific provider table. The validator has already gated the
 * resolvedFamily to a registered family; the table maps family → (Anthropic
 * orchestrator, fixture provider, ban-list scan). Family A, Family B, and
 * Family C share the same Anthropic-call envelope (AnthropicCallResult)
 * and the same response-shape (McpBooleanObservationValidatedResponse),
 * so the dispatcher can route uniformly post-resolution.
 *
 * The Family A wrapper accepts ValidatedFamilyARequest, which is structurally
 * identical to ValidatedFamilyBRequest and ValidatedFamilyCRequest (all
 * three mirror the wire shape); we cast at the boundary since all shapes
 * accept the same fields.
 */
interface FamilyProviders {
  anthropic: (
    req: ValidatedFamilyARequest | ValidatedFamilyBRequest | ValidatedFamilyCRequest,
    requestId: string,
  ) => Promise<AnthropicCallResult>;
  fixture: () => Promise<
    | { ok: true; value: Record<string, unknown> }
    | { ok: false; reason: 'fixture_load_failed' }
  >;
  banListScan: (
    resp: McpBooleanObservationValidatedResponse,
  ) => { ok: true } | { ok: false; path: string };
}

function pickFamilyProviders(family: string): FamilyProviders | null {
  if (family === 'parent_relation') {
    return {
      anthropic: (req, requestId) =>
        runAnthropicFamilyAClassifier(req as ValidatedFamilyARequest, requestId),
      fixture: loadFixtureFamilyAPacket,
      banListScan: scanFamilyABooleanResponseForBanList,
    };
  }
  if (family === 'disagreement_axis') {
    return {
      anthropic: (req, requestId) =>
        runAnthropicFamilyBClassifier(req as ValidatedFamilyBRequest, requestId),
      fixture: loadFixtureFamilyBPacket,
      banListScan: scanFamilyBBooleanResponseForBanList,
    };
  }
  if (family === 'misunderstanding_repair') {
    return {
      anthropic: (req, requestId) =>
        runAnthropicFamilyCClassifier(req as ValidatedFamilyCRequest, requestId),
      fixture: loadFixtureFamilyCPacket,
      banListScan: scanFamilyCBooleanResponseForBanList,
    };
  }
  return null; // unreachable post-validation; defensive
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
  const validated = validateFamilyBooleanRequest(args);
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
        'Requested family is not supported by this server build',
        {
          requestedFamilies: validated.requestedFamilies,
          supportedFamilies: getSupportedFamilies(),
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
        'One or more requestedRawKeys are not supported by the requested family',
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

  // Step 2: resolve which family this request targets. Per design §7, when
  // requestedFamilies is non-empty we route to the first entry; when empty,
  // the byte-equal-preservation default routes to 'parent_relation' (the
  // validator already gated rawKey membership against this same default).
  const resolvedFamily: string =
    request.requestedFamilies.length > 0
      ? request.requestedFamilies[0]
      : 'parent_relation';
  const providers = pickFamilyProviders(resolvedFamily);
  if (!providers) {
    // Defensive — validator already gated this; if we reach here, a
    // registered family is missing a provider table entry.
    log('warn', 'boolean_observations_no_provider_for_family', {
      requestId: input.requestId,
      tool: 'classify_argument_boolean_observations',
      family: resolvedFamily,
      reason: 'unsupported_family',
      status: 'rejected',
      httpStatus: 200,
    });
    return errorResult(
      'unsupported_family',
      'No provider for resolved family',
      {
        requestedFamilies: request.requestedFamilies,
        supportedFamilies: getSupportedFamilies(),
      },
    );
  }

  // Step 3: provider selection (fixture vs Anthropic).
  let providerResult:
    | { ok: true; packet: Record<string, unknown> }
    | { ok: false; reason: string; detail?: string };
  if (Deno.env.get('MCP_SERVER_USE_FIXTURE_PROVIDER') === 'true') {
    const fixture = await providers.fixture();
    if (fixture.ok) {
      providerResult = { ok: true, packet: fixture.value };
    } else {
      providerResult = { ok: false, reason: fixture.reason };
    }
  } else {
    const anthropic = await providers.anthropic(request, input.requestId);
    if (anthropic.ok) {
      providerResult = { ok: true, packet: anthropic.packet };
    } else {
      providerResult = { ok: false, reason: anthropic.reason, detail: anthropic.detail };
    }
  }

  if (!providerResult.ok) {
    return errorResult(
      providerResult.reason,
      `Boolean-observation classifier call failed: ${providerResult.reason}`,
      providerResult.detail !== undefined ? { detail: providerResult.detail } : {},
    );
  }

  // Step 4: validate response against MCP-021A wire shape.
  const responseCheck = validateMcpBooleanObservationResponse(providerResult.packet);
  if (!responseCheck.ok) {
    log('warn', 'boolean_observations_packet_invalid', {
      requestId: input.requestId,
      tool: 'classify_argument_boolean_observations',
      family: resolvedFamily,
      reason: 'validation_failed',
      status: 'failure',
    });
    return errorResult('validation_failed', 'Model response failed packet schema', {
      path: responseCheck.path,
      detail: responseCheck.detail,
    });
  }

  // Step 5: doctrine ban-list scan (family-specific).
  const banScanResult = providers.banListScan(responseCheck.value);
  if (!banScanResult.ok) {
    log('warn', 'boolean_observations_doctrine_ban_list', {
      requestId: input.requestId,
      tool: 'classify_argument_boolean_observations',
      family: resolvedFamily,
      reason: 'validation_failed',
      status: 'failure',
      path: banScanResult.path,
    });
    return errorResult('validation_failed', 'Model response failed doctrine ban-list scan', {
      path: banScanResult.path,
      detail: 'doctrine_ban_list',
    });
  }

  // Step 6: return the validated tool result.
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(responseCheck.value) }],
    structuredContent: responseCheck.value as unknown as Record<string, unknown>,
    isError: false,
  };
}
