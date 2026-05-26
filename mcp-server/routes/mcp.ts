/**
 * MCP-SERVER-001 — POST /mcp official endpoint (JSON-RPC 2.0).
 *
 * Implements the official MCP Streamable HTTP transport methods:
 *   initialize                    — capability handshake
 *   notifications/initialized     — JSON-RPC notification, no response
 *   tools/list                    — returns the registered tools
 *   tools/call                    — invokes a registered tool by name
 *   ping                          — empty result
 *
 * Bearer + Origin gating runs in `runAuthGate` from server.ts BEFORE we get
 * here. This handler assumes the request is already authorized.
 */
import { log } from '../lib/logging.ts';
import { runAuthGate } from '../server.ts';
import {
  buildError as buildJsonRpcError,
  buildSuccess as buildJsonRpcSuccess,
  parseJsonRpcRequest,
  isPlainObject,
  JSON_RPC_PARSE_ERROR,
  JSON_RPC_METHOD_NOT_FOUND,
  JSON_RPC_INVALID_PARAMS,
  JSON_RPC_INTERNAL_ERROR,
} from '../lib/jsonRpc.ts';
import { buildCommonHeaders, jsonResponse } from '../lib/responseHelpers.ts';
import {
  buildInitializeResult,
  buildToolsListResult,
} from '../lib/toolRegistry.ts';
import { invokeToolByName } from '../lib/toolDispatch.ts';

export async function handleMcp(
  req: Request,
  requestId: string,
  protocolVersion: string,
): Promise<Response> {
  const gate = runAuthGate(req, requestId, protocolVersion, '/mcp');
  if (gate) return gate;

  const contentType = req.headers.get('Content-Type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    log('warn', 'mcp_bad_content_type', {
      requestId,
      endpoint: '/mcp',
      httpStatus: 415,
      status: 'rejected',
    });
    return jsonResponse(
      buildJsonRpcError(null, JSON_RPC_PARSE_ERROR, 'unsupported_media_type', {
        reason: 'Content-Type must be application/json',
      }),
      415,
      buildCommonHeaders(requestId),
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    log('warn', 'mcp_parse_failure', {
      requestId,
      endpoint: '/mcp',
      httpStatus: 400,
      status: 'rejected',
    });
    return jsonResponse(
      buildJsonRpcError(null, JSON_RPC_PARSE_ERROR, 'parse_error', {
        reason: 'Request body was not valid JSON',
      }),
      400,
      buildCommonHeaders(requestId),
    );
  }

  const parsed = parseJsonRpcRequest(raw);
  if (!parsed.ok) {
    log('warn', 'mcp_invalid_request', {
      requestId,
      endpoint: '/mcp',
      reason: parsed.error.message,
      httpStatus: 400,
      status: 'rejected',
    });
    return jsonResponse(
      buildJsonRpcError(parsed.id, parsed.error.code, parsed.error.message),
      400,
      buildCommonHeaders(requestId),
    );
  }

  const { request, isNotification } = parsed;
  const id = request.id ?? null;

  // Notifications — no response body per JSON-RPC 2.0.
  if (isNotification) {
    if (request.method === 'notifications/initialized') {
      log('info', 'mcp_notifications_initialized', {
        requestId,
        endpoint: '/mcp',
        method: request.method,
        httpStatus: 204,
        status: 'success',
      });
    } else {
      log('info', 'mcp_notification', {
        requestId,
        endpoint: '/mcp',
        method: request.method,
        httpStatus: 204,
        status: 'success',
      });
    }
    return new Response(null, { status: 204, headers: buildCommonHeaders(requestId) });
  }

  // Method dispatch.
  switch (request.method) {
    case 'initialize': {
      log('info', 'mcp_initialize', {
        requestId,
        endpoint: '/mcp',
        method: 'initialize',
        httpStatus: 200,
        status: 'success',
        protocolVersion,
      });
      return jsonResponse(
        buildJsonRpcSuccess(id, buildInitializeResult(protocolVersion)),
        200,
        buildCommonHeaders(requestId),
      );
    }
    case 'tools/list': {
      log('info', 'mcp_tools_list', {
        requestId,
        endpoint: '/mcp',
        method: 'tools/list',
        httpStatus: 200,
        status: 'success',
      });
      return jsonResponse(
        buildJsonRpcSuccess(id, buildToolsListResult()),
        200,
        buildCommonHeaders(requestId),
      );
    }
    case 'ping': {
      log('info', 'mcp_ping', {
        requestId,
        endpoint: '/mcp',
        method: 'ping',
        httpStatus: 200,
        status: 'success',
      });
      return jsonResponse(
        buildJsonRpcSuccess(id, {}),
        200,
        buildCommonHeaders(requestId),
      );
    }
    case 'tools/call': {
      const params = request.params;
      if (!isPlainObject(params)) {
        return jsonResponse(
          buildJsonRpcError(id, JSON_RPC_INVALID_PARAMS, 'invalid_params', {
            reason: 'params must be an object with name and arguments',
          }),
          400,
          buildCommonHeaders(requestId),
        );
      }
      const name = params['name'];
      const args = params['arguments'];
      if (typeof name !== 'string' || name.length === 0) {
        return jsonResponse(
          buildJsonRpcError(id, JSON_RPC_INVALID_PARAMS, 'invalid_params', {
            reason: 'tools/call.params.name must be a non-empty string',
          }),
          400,
          buildCommonHeaders(requestId),
        );
      }
      const startMs = performance.now();
      try {
        const result = await invokeToolByName({
          toolName: name,
          rawArgs: args,
          requestId,
          envelope: 'jsonRpc',
        });
        const duration = Math.round(performance.now() - startMs);
        log('info', 'mcp_tools_call', {
          requestId,
          endpoint: '/mcp',
          tool: name,
          duration_ms: duration,
          status: result.isError ? 'failure' : 'success',
          httpStatus: 200,
        });
        return jsonResponse(
          buildJsonRpcSuccess(id, result),
          200,
          buildCommonHeaders(requestId),
        );
      } catch (err) {
        const duration = Math.round(performance.now() - startMs);
        log('error', 'mcp_tools_call_threw', {
          requestId,
          endpoint: '/mcp',
          tool: name,
          duration_ms: duration,
          httpStatus: 500,
          status: 'failure',
          errorClass: err instanceof Error ? err.name : 'unknown',
        });
        return jsonResponse(
          buildJsonRpcError(id, JSON_RPC_INTERNAL_ERROR, 'internal_error', {
            reason: 'Tool handler threw',
          }),
          500,
          buildCommonHeaders(requestId),
        );
      }
    }
    default: {
      log('warn', 'mcp_unknown_method', {
        requestId,
        endpoint: '/mcp',
        method: request.method,
        httpStatus: 404,
        status: 'rejected',
      });
      return jsonResponse(
        buildJsonRpcError(id, JSON_RPC_METHOD_NOT_FOUND, 'method_not_found', {
          reason: `No handler for method "${request.method}"`,
        }),
        404,
        buildCommonHeaders(requestId),
      );
    }
  }
}
