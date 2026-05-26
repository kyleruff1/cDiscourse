/**
 * MCP-SERVER-001 — HTTP server entry.
 *
 * Routes:
 *   GET  /health             — unauthenticated; returns capability ping
 *   POST /mcp                — official JSON-RPC 2.0 MCP Streamable HTTP; bearer required
 *   GET  /mcp                — 405 Method Not Allowed (v1; see §11)
 *   POST /mcp/adapter-compat — simplified {tool, input} envelope; bearer required
 *
 * Commit 1 lands the routing skeleton, /health, the bearer + origin + protocol
 * middleware, and a placeholder dispatch for /mcp + /mcp/adapter-compat that
 * the next commits replace with the real route handlers.
 */
import { log, generateRequestId } from './lib/logging.ts';
import { validateBearer, buildBearerErrorEnvelopes } from './lib/auth.ts';
import { parseAllowedOrigins, validateOrigin } from './lib/origin.ts';
import { evaluateProtocolVersion } from './lib/protocolVersion.ts';
import { handleHealth } from './routes/health.ts';
import {
  buildError as buildJsonRpcError,
  JSON_RPC_METHOD_NOT_FOUND,
  JSON_RPC_SERVER_ERROR,
  JSON_RPC_INTERNAL_ERROR,
} from './lib/jsonRpc.ts';
import { buildCommonHeaders, jsonResponse } from './lib/responseHelpers.ts';

export type McpRouteHandler = (
  req: Request,
  requestId: string,
  protocolVersion: string,
) => Promise<Response>;

interface RoutePlugins {
  mcp?: McpRouteHandler;
  adapterCompat?: McpRouteHandler;
}

let pluginsRegistry: RoutePlugins = {};

/**
 * Register the /mcp and /mcp/adapter-compat handlers. Commit 1 wires the
 * routing without the handlers; commit 2 calls this with the real
 * implementations.
 */
export function registerRouteHandlers(plugins: RoutePlugins): void {
  pluginsRegistry = { ...pluginsRegistry, ...plugins };
}

export function readPort(): number {
  const raw = Deno.env.get('MCP_SERVER_PORT');
  if (!raw) return 8080;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) return 8080;
  return parsed;
}

/**
 * Main request handler. Pure routing dispatch — auth happens inside each
 * authenticated route, NOT here, so /health stays unauthenticated.
 */
export async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method.toUpperCase();
  const incomingRequestId = req.headers.get('Mcp-Request-Id') ?? req.headers.get('X-Request-Id');
  const requestId = incomingRequestId && incomingRequestId.length > 0
    ? incomingRequestId
    : generateRequestId();

  const protocolDecision = evaluateProtocolVersion(req.headers.get('MCP-Protocol-Version'));
  if (protocolDecision.warn) {
    log('warn', 'protocol_version', {
      requestId,
      endpoint: path,
      reason: protocolDecision.warnReason,
      protocolVersion: protocolDecision.echoVersion,
    });
  }

  // ── /health (unauthenticated) ──────────────────────────────────────
  if (path === '/health' && method === 'GET') {
    return handleHealth(requestId, protocolDecision.echoVersion);
  }

  // ── /mcp ───────────────────────────────────────────────────────────
  if (path === '/mcp') {
    if (method === 'GET') {
      log('info', 'mcp_get_rejected', {
        requestId,
        endpoint: '/mcp',
        method: 'GET',
        httpStatus: 405,
        status: 'rejected',
      });
      return jsonResponse(
        buildJsonRpcError(null, JSON_RPC_METHOD_NOT_FOUND, 'method_not_allowed', {
          reason: 'GET /mcp is not supported in v1; use POST for JSON-RPC requests.',
        }),
        405,
        { ...buildCommonHeaders(requestId), Allow: 'POST' },
      );
    }
    if (method === 'POST') {
      const handler = pluginsRegistry.mcp;
      if (!handler) {
        log('error', 'mcp_handler_unregistered', {
          requestId,
          endpoint: '/mcp',
          httpStatus: 503,
          status: 'failure',
        });
        return jsonResponse(
          buildJsonRpcError(null, JSON_RPC_INTERNAL_ERROR, 'not_implemented', {
            reason: 'MCP handler not yet wired.',
          }),
          503,
          buildCommonHeaders(requestId),
        );
      }
      return await handler(req, requestId, protocolDecision.echoVersion);
    }
    return new Response(null, {
      status: 405,
      headers: { ...buildCommonHeaders(requestId), Allow: 'POST' },
    });
  }

  // ── /mcp/adapter-compat ────────────────────────────────────────────
  if (path === '/mcp/adapter-compat') {
    if (method === 'POST') {
      const handler = pluginsRegistry.adapterCompat;
      if (!handler) {
        log('error', 'compat_handler_unregistered', {
          requestId,
          endpoint: '/mcp/adapter-compat',
          httpStatus: 503,
          status: 'failure',
        });
        return jsonResponse(
          { error: 'not_implemented', message: 'Adapter-compat handler not yet wired.' },
          503,
          buildCommonHeaders(requestId),
        );
      }
      return await handler(req, requestId, protocolDecision.echoVersion);
    }
    return new Response(null, {
      status: 405,
      headers: { ...buildCommonHeaders(requestId), Allow: 'POST' },
    });
  }

  log('info', 'unknown_route', {
    requestId,
    endpoint: path,
    method,
    httpStatus: 404,
    status: 'rejected',
  });
  return jsonResponse(
    { error: 'not_found', message: `No route for ${method} ${path}` },
    404,
    buildCommonHeaders(requestId),
  );
}

/**
 * Shared bearer + origin gate used by /mcp and /mcp/adapter-compat handlers.
 * Returns null on pass; a Response otherwise.
 */
export function runAuthGate(
  req: Request,
  requestId: string,
  _protocolVersion: string,
  endpoint: '/mcp' | '/mcp/adapter-compat',
): Response | null {
  // Origin validation first (no auth secret involved).
  const allowed = parseAllowedOrigins(Deno.env.get('MCP_SERVER_ALLOWED_ORIGINS'));
  const origin = req.headers.get('Origin');
  const originResult = validateOrigin(origin, allowed);
  if (!originResult.ok) {
    log('warn', 'origin_rejected', {
      requestId,
      endpoint,
      reason: originResult.reason,
      httpStatus: 403,
      status: 'rejected',
    });
    const body = endpoint === '/mcp'
      ? buildJsonRpcError(null, JSON_RPC_SERVER_ERROR, 'forbidden', {
          reason: 'Origin not in allowed list',
        })
      : { error: 'forbidden', message: 'Origin not in allowed list' };
    return jsonResponse(body, 403, buildCommonHeaders(requestId));
  }

  // Bearer next.
  const bearerResult = validateBearer(
    req.headers.get('Authorization'),
    Deno.env.get('MCP_SERVER_BEARER_TOKEN'),
  );
  if (!bearerResult.ok) {
    log('warn', 'bearer_rejected', {
      requestId,
      endpoint,
      reason: bearerResult.reason,
      httpStatus: bearerResult.httpStatus,
      status: 'rejected',
    });
    const envelopes = buildBearerErrorEnvelopes(bearerResult.reason);
    const body = endpoint === '/mcp'
      ? buildJsonRpcError(null, envelopes.jsonRpc.code, envelopes.jsonRpc.message, envelopes.jsonRpc.data)
      : envelopes.adapterCompat;
    return jsonResponse(body, bearerResult.httpStatus, buildCommonHeaders(requestId));
  }
  return null;
}
