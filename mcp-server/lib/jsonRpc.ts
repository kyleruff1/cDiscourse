/**
 * MCP-SERVER-001 — JSON-RPC 2.0 envelope helpers.
 *
 * Implements the small subset of JSON-RPC 2.0 the MCP Streamable HTTP transport
 * requires: success envelope, error envelope, notification detection, and
 * minimal validation of incoming requests.
 *
 * Pure functions — no IO, no logger, no Deno globals.
 */

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  /** Absent => notification (no response). */
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export interface JsonRpcSuccess<TResult = unknown> {
  jsonrpc: '2.0';
  id: string | number | null;
  result: TResult;
}

export interface JsonRpcErrorObject {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcError {
  jsonrpc: '2.0';
  id: string | number | null;
  error: JsonRpcErrorObject;
}

export type JsonRpcResponse<TResult = unknown> =
  | JsonRpcSuccess<TResult>
  | JsonRpcError;

// Standard JSON-RPC 2.0 error codes.
export const JSON_RPC_PARSE_ERROR = -32700;
export const JSON_RPC_INVALID_REQUEST = -32600;
export const JSON_RPC_METHOD_NOT_FOUND = -32601;
export const JSON_RPC_INVALID_PARAMS = -32602;
export const JSON_RPC_INTERNAL_ERROR = -32603;
// Implementation-defined range. -32000 is the generic server error.
export const JSON_RPC_SERVER_ERROR = -32000;

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate the structural shape of an incoming JSON-RPC 2.0 request body.
 * Returns the typed request on success, or a JsonRpcErrorObject describing the
 * structural failure.
 *
 * NOTE: the `id` field may legally be `null` per the spec. A missing `id` (as
 * opposed to an explicit `null`) signals a notification. We surface this via
 * the `isNotification` boolean.
 */
export function parseJsonRpcRequest(raw: unknown): {
  ok: true;
  request: JsonRpcRequest;
  isNotification: boolean;
} | {
  ok: false;
  error: JsonRpcErrorObject;
  id: string | number | null;
} {
  if (!isPlainObject(raw)) {
    return {
      ok: false,
      id: null,
      error: { code: JSON_RPC_INVALID_REQUEST, message: 'Request must be a JSON object' },
    };
  }
  if (raw['jsonrpc'] !== '2.0') {
    return {
      ok: false,
      id: typeof raw['id'] === 'string' || typeof raw['id'] === 'number' ? raw['id'] : null,
      error: { code: JSON_RPC_INVALID_REQUEST, message: 'jsonrpc field must equal "2.0"' },
    };
  }
  if (typeof raw['method'] !== 'string' || raw['method'].length === 0) {
    return {
      ok: false,
      id: typeof raw['id'] === 'string' || typeof raw['id'] === 'number' ? raw['id'] : null,
      error: { code: JSON_RPC_INVALID_REQUEST, message: 'method must be a non-empty string' },
    };
  }
  const hasId = Object.prototype.hasOwnProperty.call(raw, 'id');
  const id = hasId ? (raw['id'] as string | number | null) : null;
  if (hasId && id !== null && typeof id !== 'string' && typeof id !== 'number') {
    return {
      ok: false,
      id: null,
      error: { code: JSON_RPC_INVALID_REQUEST, message: 'id must be string, number, or null' },
    };
  }
  const request: JsonRpcRequest = {
    jsonrpc: '2.0',
    method: raw['method'],
  };
  if (hasId) request.id = id;
  if ('params' in raw) request.params = raw['params'];
  return {
    ok: true,
    request,
    isNotification: !hasId,
  };
}

export function buildSuccess<TResult>(
  id: string | number | null,
  result: TResult,
): JsonRpcSuccess<TResult> {
  return { jsonrpc: '2.0', id, result };
}

export function buildError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcError {
  const error: JsonRpcErrorObject = { code, message };
  if (data !== undefined) error.data = data;
  return { jsonrpc: '2.0', id, error };
}
