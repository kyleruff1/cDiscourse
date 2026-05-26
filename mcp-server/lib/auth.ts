/**
 * MCP-SERVER-001 — Bearer token middleware.
 *
 * Constant-time compare against the env-configured bearer. Never logs the
 * presented or expected token, never returns either in any response body.
 */
import { JSON_RPC_SERVER_ERROR } from './jsonRpc.ts';

export type BearerCheckResult =
  | { ok: true }
  | { ok: false; httpStatus: number; reason: 'server_misconfigured' | 'missing_header' | 'wrong_scheme' | 'token_mismatch' };

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Validate an incoming Authorization header against the server-configured
 * bearer. Returns `{ok: true}` on success; otherwise a typed failure that the
 * caller maps to a response envelope.
 *
 * NOTE: the expectedToken argument is read via Deno.env in production routes,
 * but accepted explicitly here so the pure logic is unit-testable.
 */
export function validateBearer(
  authorizationHeader: string | null,
  expectedToken: string | undefined,
): BearerCheckResult {
  if (!expectedToken || expectedToken.length === 0) {
    return { ok: false, httpStatus: 500, reason: 'server_misconfigured' };
  }
  if (!authorizationHeader) {
    return { ok: false, httpStatus: 401, reason: 'missing_header' };
  }
  if (!authorizationHeader.startsWith('Bearer ')) {
    return { ok: false, httpStatus: 401, reason: 'wrong_scheme' };
  }
  const presented = authorizationHeader.slice('Bearer '.length);
  if (presented.length === 0) {
    return { ok: false, httpStatus: 401, reason: 'wrong_scheme' };
  }
  if (!constantTimeEqual(presented, expectedToken)) {
    return { ok: false, httpStatus: 401, reason: 'token_mismatch' };
  }
  return { ok: true };
}

export interface BearerErrorEnvelopes {
  adapterCompat: { error: string; message: string };
  jsonRpc: { code: number; message: string; data: { reason: string } };
}

const REASON_MESSAGES: Record<Exclude<BearerCheckResult, { ok: true }>['reason'], string> = {
  server_misconfigured: 'Server bearer not configured',
  missing_header: 'Missing or invalid Authorization header',
  wrong_scheme: 'Missing or invalid Authorization header',
  token_mismatch: 'Invalid bearer token',
};

export function buildBearerErrorEnvelopes(
  reason: Exclude<BearerCheckResult, { ok: true }>['reason'],
): BearerErrorEnvelopes {
  const message = REASON_MESSAGES[reason];
  const isServerSide = reason === 'server_misconfigured';
  return {
    adapterCompat: {
      error: isServerSide ? 'server_misconfigured' : 'unauthorized',
      message,
    },
    jsonRpc: {
      code: JSON_RPC_SERVER_ERROR,
      message: isServerSide ? 'server_misconfigured' : 'unauthorized',
      data: { reason: message },
    },
  };
}
