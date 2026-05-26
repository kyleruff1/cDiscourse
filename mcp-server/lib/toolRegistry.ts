/**
 * MCP-SERVER-001 — Tool registry.
 *
 * Owns the static metadata for every tool the server exposes and produces
 * the `tools/list` JSON-RPC result shape. The actual handler invocation
 * lives in `toolDispatch.ts`; the registry only describes what's available.
 *
 * The two tool names below are PINNED — they match the verbatim constants
 * shipped Edge Functions read:
 *   - `classify_semantic_move`: `supabase/functions/_shared/semanticReferee/
 *     mcpAdapterCore.ts:38` (`MCP_CLASSIFY_TOOL_NAME`)
 *   - `classify_argument_boolean_observations`:
 *     `supabase/functions/_shared/booleanObservations/
 *     booleanObservationMcpAdapterCore.ts:44-45`
 *     (`MCP_BOOLEAN_OBSERVATION_TOOL_NAME`)
 *
 * Renaming either constant breaks the deployed wire contract — commit 1 keeps
 * both as string literals; commits 3-4 attach handlers.
 */
import { CLASSIFY_SEMANTIC_MOVE_TOOL } from '../tools/classifySemanticMove.ts';
import { CLASSIFY_BOOLEAN_OBSERVATIONS_TOOL } from '../tools/classifyArgumentBooleanObservations.ts';
import { SERVER_VERSION } from '../routes/health.ts';

export interface ToolMetadata {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export const REGISTERED_TOOLS: readonly ToolMetadata[] = Object.freeze([
  CLASSIFY_SEMANTIC_MOVE_TOOL,
  CLASSIFY_BOOLEAN_OBSERVATIONS_TOOL,
]);

export function buildToolsListResult(): { tools: readonly ToolMetadata[] } {
  return { tools: REGISTERED_TOOLS };
}

export function buildInitializeResult(protocolVersion: string): {
  protocolVersion: string;
  capabilities: { tools: { listChanged: false } };
  serverInfo: { name: 'cdiscourse-mcp-server'; version: string };
} {
  return {
    protocolVersion,
    capabilities: { tools: { listChanged: false } },
    serverInfo: { name: 'cdiscourse-mcp-server', version: SERVER_VERSION },
  };
}
