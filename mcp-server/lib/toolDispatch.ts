/**
 * MCP-SERVER-001 — Tool dispatch shared by /mcp + /mcp/adapter-compat.
 *
 * The official `/mcp` endpoint wraps `tools/call.result` in JSON-RPC; the
 * `/mcp/adapter-compat` endpoint wraps the same shape in `{result: {...}}`.
 * Both endpoints invoke `invokeToolByName` and let that single function carry
 * tool selection, input validation, and result envelope.
 *
 * The shape returned matches MCP's official `tools/call` result:
 *   { content: [...], structuredContent: {...}, isError: boolean }
 *
 * Routes are responsible for wrapping this in the correct outer envelope.
 */
import { handleClassifySemanticMove } from '../tools/classifySemanticMove.ts';
import {
  handleClassifyArgumentBooleanObservations,
} from '../tools/classifyArgumentBooleanObservations.ts';

export interface ToolCallResult {
  content: ReadonlyArray<{ type: 'text'; text: string }>;
  structuredContent: unknown;
  isError: boolean;
}

export interface ToolInvocation {
  toolName: string;
  rawArgs: unknown;
  requestId: string;
  envelope: 'jsonRpc' | 'adapterCompat';
}

export async function invokeToolByName(input: ToolInvocation): Promise<ToolCallResult> {
  switch (input.toolName) {
    case 'classify_semantic_move':
      return await handleClassifySemanticMove(input);
    case 'classify_argument_boolean_observations':
      return await handleClassifyArgumentBooleanObservations(input);
    default:
      return {
        content: [
          { type: 'text' as const, text: `No tool registered with name "${input.toolName}"` },
        ],
        structuredContent: {
          reason: 'unknown_tool',
          toolName: input.toolName,
        },
        isError: true,
      };
  }
}
