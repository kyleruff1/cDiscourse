/**
 * MCP-SERVER-001 — `classify_argument_boolean_observations` tool (SCAFFOLDED).
 *
 * Tool name pinned verbatim from MCP-021C-EDGE's deployed adapter:
 *   `supabase/functions/_shared/booleanObservations/
 *    booleanObservationMcpAdapterCore.ts:44-45` (MCP_BOOLEAN_OBSERVATION_TOOL_NAME)
 *
 * v1 BEHAVIOR (this card):
 *   - Tool is registered; `tools/list` includes it.
 *   - Invocation returns the documented error envelope:
 *       isError: true
 *       content: [{type: "text", text: "Tool scaffolded for MCP-SERVER-002; not yet implemented"}]
 *       structuredContent: { reason: "not_implemented", scaffoldedFor: "MCP-SERVER-002" }
 *   - The handler DOES NOT call Anthropic and DOES NOT consume tokens.
 *   - Tests verify zero provider invocations on any number of calls.
 *
 * Real classifier implementation lands in MCP-SERVER-002.
 */
import type { ToolInvocation, ToolCallResult } from '../lib/toolDispatch.ts';
import type { ToolMetadata } from '../lib/toolRegistry.ts';
import { log } from '../lib/logging.ts';

export const CLASSIFY_BOOLEAN_OBSERVATIONS_TOOL: ToolMetadata = {
  name: 'classify_argument_boolean_observations',
  title: 'Argument Boolean Observation Classifier',
  description:
    'Scaffolded for MCP-SERVER-002; not yet implemented. Future: classifies an argument move against MCP-021A boolean Machine Observation taxonomy (family-sharded vocabulary). When implemented, accepts McpBooleanObservationRequest and returns McpBooleanObservationResponse per the schema in src/features/nodeLabels/mcpBooleanObservationSchema.ts. Currently returns isError: true with reason: not_implemented.',
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

/**
 * Handle an invocation. Returns the documented `not_implemented` envelope
 * without calling any provider. Logs the rejection so the smoke + audit
 * scripts can verify the boolean tool was reached but produced no tokens.
 */
export function handleClassifyArgumentBooleanObservations(
  input: ToolInvocation,
): Promise<ToolCallResult> {
  log('info', 'boolean_observations_not_implemented', {
    requestId: input.requestId,
    tool: 'classify_argument_boolean_observations',
    status: 'rejected',
    reason: 'not_implemented',
    httpStatus: 200,
  });
  return Promise.resolve({
    content: [
      {
        type: 'text' as const,
        text: 'Tool scaffolded for MCP-SERVER-002; not yet implemented',
      },
    ],
    structuredContent: {
      reason: 'not_implemented',
      scaffoldedFor: 'MCP-SERVER-002',
    },
    isError: true,
  });
}
