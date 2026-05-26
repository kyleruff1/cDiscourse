/**
 * MCP-SERVER-001 — POST /mcp/adapter-compat endpoint.
 *
 * Accepts the SIMPLIFIED `{tool, input}` envelope the shipped MCP-018 +
 * MCP-021C-EDGE adapters send today (verbatim shape extracted in design
 * §1.1 + §1.2). Routes to the same tool handlers the official /mcp endpoint
 * uses, then wraps the result in the `{result: {...}}` shape that
 * `extractMcpPacket` (`supabase/functions/_shared/semanticReferee/mcpAdapterCore.ts:184-222`)
 * recognises as priority-1.
 *
 * NO duplicate handler logic — the underlying tool invocation goes through
 * `invokeToolByName` shared with /mcp.
 */
import { log } from '../lib/logging.ts';
import { runAuthGate } from '../server.ts';
import { isPlainObject } from '../lib/jsonRpc.ts';
import { buildCommonHeaders, jsonResponse } from '../lib/responseHelpers.ts';
import { invokeToolByName } from '../lib/toolDispatch.ts';

export async function handleAdapterCompat(
  req: Request,
  requestId: string,
  _protocolVersion: string,
): Promise<Response> {
  const gate = runAuthGate(req, requestId, _protocolVersion, '/mcp/adapter-compat');
  if (gate) return gate;

  const contentType = req.headers.get('Content-Type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    log('warn', 'compat_bad_content_type', {
      requestId,
      endpoint: '/mcp/adapter-compat',
      httpStatus: 415,
      status: 'rejected',
    });
    return jsonResponse(
      { error: 'unsupported_media_type', message: 'Content-Type must be application/json' },
      415,
      buildCommonHeaders(requestId),
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    log('warn', 'compat_parse_failure', {
      requestId,
      endpoint: '/mcp/adapter-compat',
      httpStatus: 400,
      status: 'rejected',
    });
    return jsonResponse(
      { error: 'parse_error', message: 'Request body was not valid JSON' },
      400,
      buildCommonHeaders(requestId),
    );
  }

  if (!isPlainObject(raw)) {
    return jsonResponse(
      { error: 'invalid_request', message: 'Request body must be a JSON object' },
      400,
      buildCommonHeaders(requestId),
    );
  }

  const toolName = raw['tool'];
  const input = raw['input'];
  if (typeof toolName !== 'string' || toolName.length === 0) {
    return jsonResponse(
      { error: 'invalid_request', message: 'tool must be a non-empty string' },
      400,
      buildCommonHeaders(requestId),
    );
  }

  const startMs = performance.now();
  try {
    const result = await invokeToolByName({
      toolName,
      rawArgs: input,
      requestId,
      envelope: 'adapterCompat',
    });
    const duration = Math.round(performance.now() - startMs);
    log('info', 'compat_tools_call', {
      requestId,
      endpoint: '/mcp/adapter-compat',
      tool: toolName,
      duration_ms: duration,
      status: result.isError ? 'failure' : 'success',
      httpStatus: 200,
    });
    // Wrap in {result: {...}}, matching extractMcpPacket priority-1 shape.
    // For successful semantic-referee calls, structuredContent is the packet.
    // For error envelopes (scaffold/timeout/validation_failed), we surface
    // {isError: true, reason: <code>} under `result` so the upstream adapter
    // parses it as a non-packet (which it does via SemanticRefereePacketSchema
    // rejection → validation_failed → deterministic fallback).
    const innerResult = result.isError
      ? {
          isError: true,
          ...(isPlainObject(result.structuredContent) ? result.structuredContent : {}),
        }
      : result.structuredContent;
    return jsonResponse(
      { result: innerResult },
      200,
      buildCommonHeaders(requestId),
    );
  } catch (err) {
    const duration = Math.round(performance.now() - startMs);
    log('error', 'compat_tools_call_threw', {
      requestId,
      endpoint: '/mcp/adapter-compat',
      tool: toolName,
      duration_ms: duration,
      httpStatus: 500,
      status: 'failure',
      errorClass: err instanceof Error ? err.name : 'unknown',
    });
    return jsonResponse(
      { error: 'internal_error', message: 'Tool handler threw' },
      500,
      buildCommonHeaders(requestId),
    );
  }
}
