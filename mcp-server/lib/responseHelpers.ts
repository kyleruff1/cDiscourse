/**
 * MCP-SERVER-001 — Shared response-helper utilities.
 *
 * Centralizes the headers we always set on /mcp and /mcp/adapter-compat
 * responses (Content-Type, MCP-Protocol-Version, X-Request-Id), and the
 * JSON-stringify-and-respond pattern.
 */
import { MCP_TARGETED_PROTOCOL_VERSION } from './protocolVersion.ts';

export interface CommonResponseHeaders {
  'Content-Type': string;
  'MCP-Protocol-Version': string;
  'X-Request-Id': string;
}

export function buildCommonHeaders(requestId: string): CommonResponseHeaders {
  return {
    'Content-Type': 'application/json',
    'MCP-Protocol-Version': MCP_TARGETED_PROTOCOL_VERSION,
    'X-Request-Id': requestId,
  };
}

export function jsonResponse(
  body: unknown,
  status: number,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}
