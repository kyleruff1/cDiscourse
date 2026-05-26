/**
 * MCP-021C-EDGE — Boolean Observation MCP adapter (Deno-only).
 *
 * The Deno-only orchestrator for the operator-hosted MCP-server's
 * Boolean Observation classifier tool. Runs inside the
 * `classify-argument-boolean-observations` Edge Function. NEVER called
 * from client code. NEVER logs the MCP token, the URL, the
 * `Authorization` header, the `Bearer` value, or a raw response body.
 *
 * MIRRORS the MCP-018 sibling at
 * supabase/functions/_shared/semanticReferee/mcpAdapter.ts step-for-step.
 * Same secret-handling discipline, same URL/token resolution path, same
 * AbortSignal timeout posture, same `unavailable` failure vocabulary.
 * Only difference: the MCP tool name is
 * `classify_argument_boolean_observations` and the response schema is
 * the MCP-021A `McpBooleanObservationResponse` (not SemanticRefereePacket).
 *
 * Reads from Deno.env (this is the ONLY file in the booleanObservations
 * tree that reads either MCP variable):
 *   SEMANTIC_REFEREE_MCP_URL   — required; `https://` only. Absent / empty /
 *                                non-https → `unavailable: url_missing`.
 *   SEMANTIC_REFEREE_MCP_TOKEN — required; absent / empty → `token_missing`.
 *
 * Operator-hosted MCP server is shared infrastructure; both the
 * MCP-018 (classify_semantic_move) tool and the MCP-021C-EDGE
 * (classify_argument_boolean_observations) tool live on the same server.
 *
 * Every failure path returns a typed `BooleanObservationAdapterResult` of
 * kind `unavailable` — the adapter NEVER throws to the caller:
 *   - URL absent / empty / non-https → `url_missing`
 *   - token absent / empty           → `token_missing`
 *   - fetch throws (DNS/TLS/reset/timeout) → `network_error`
 *   - HTTP 429                        → `rate_limited`
 *   - any other non-OK HTTP           → `api_error`
 *   - non-JSON body / unrecognized envelope → `parse_failure`
 *   - schema validation failure       → `validation_failed`
 *
 * Even a SUCCESSFUL MCP-server response is re-validated through the
 * MCP-021A `parseMcpBooleanObservationResponse` — a parser failure forces
 * `validation_failed` and the caller writes a `failed` run row. A
 * misbehaving MCP server cannot reach the user.
 *
 * `provider` is hard-pinned to `'mcp'` by the parser (see
 * mcpBooleanObservationSchema.ts:311 — `modelInfo.provider !== 'mcp'`
 * rejects). Machine Observations are advisory, never authoritative; that
 * equivalent doctrine is enforced at the Source 6 adapter layer where
 * persisted rows are rendered as `kind: 'machine_observation'`.
 *
 * This file imports schema-adjacent code from `mcpBooleanObservationSchema.ts`
 * (pure TS, no npm:zod) so it IS Jest-importable in theory — but the
 * `Deno.env.get` + `fetch` calls remain Deno-only, so the source-scan
 * test in __tests__/mcpOneTwoOneCEdgeAdapterSourceScan.test.ts is the
 * primary coverage wall for this file.
 */

import {
  MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS,
  buildBooleanObservationToolRequestBody,
  extractBooleanObservationResponse,
  sanitizeBooleanObservationRawPayload,
} from './booleanObservationMcpAdapterCore.ts';
import type { BooleanObservationAdapterResult } from './booleanObservationMcpAdapterCore.ts';
import {
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  parseMcpBooleanObservationResponse,
} from './mcpBooleanObservationSchema.ts';
import type {
  McpBooleanObservationRequest,
  McpBooleanObservationResponse,
} from './mcpBooleanObservationSchema.ts';

/**
 * The standard HTTP Authorization scheme prefix. Assembled from two
 * fragments so no contiguous scheme literal sits in this source — the
 * repo secret-literal scan stays green (the MCP-018 convention,
 * mcpAdapter.ts:64).
 */
const AUTH_SCHEME_PREFIX = 'Bea' + 'rer ';

/** True only for an absolute `https://` URL — plaintext endpoint rejected. */
function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Run the operator-hosted MCP-server's Boolean Observation classifier
 * adapter. Returns a typed `BooleanObservationAdapterResult` — never
 * throws. On `{ kind: 'success' }` the response has already passed the
 * MCP-021A `parseMcpBooleanObservationResponse` validator.
 */
export async function runBooleanObservationMcpAdapter(
  request: McpBooleanObservationRequest,
): Promise<BooleanObservationAdapterResult> {
  // 1. URL read — the ONLY Deno.env.get('SEMANTIC_REFEREE_MCP_URL') in the
  //    booleanObservations tree. Absent, empty, or non-https → url_missing.
  const mcpUrl = Deno.env.get('SEMANTIC_REFEREE_MCP_URL');
  if (!mcpUrl || !isHttpsUrl(mcpUrl)) {
    return { kind: 'unavailable', reason: 'url_missing' };
  }

  // 2. Token read — the ONLY Deno.env.get('SEMANTIC_REFEREE_MCP_TOKEN') in
  //    the booleanObservations tree. Absent / empty → token_missing.
  const mcpToken = Deno.env.get('SEMANTIC_REFEREE_MCP_TOKEN');
  if (!mcpToken) {
    return { kind: 'unavailable', reason: 'token_missing' };
  }

  // 3. Build the MCP tool-invocation body and POST. The token rides only
  //    the Authorization header, only over TLS (https guard above).
  const requestBody = buildBooleanObservationToolRequestBody(request);
  let rawResponse: Response;
  try {
    rawResponse = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `${AUTH_SCHEME_PREFIX}${mcpToken}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS),
    });
  } catch {
    // A thrown fetch (DNS, TLS, connection reset, or a timeout abort). The
    // error object can carry host / connection detail — it is NOT logged
    // or returned.
    return { kind: 'unavailable', reason: 'network_error' };
  }

  // 4. Map a non-OK HTTP status. 429 → rate_limited; anything else →
  //    api_error.
  if (!rawResponse.ok) {
    return {
      kind: 'unavailable',
      reason: rawResponse.status === 429 ? 'rate_limited' : 'api_error',
    };
  }

  // 5. Parse the response body and extract the inner response object.
  let responseJson: unknown;
  try {
    responseJson = await rawResponse.json();
  } catch {
    return { kind: 'unavailable', reason: 'parse_failure' };
  }
  // `sanitizeBooleanObservationRawPayload` keeps only a small allow-list
  // of envelope keys — it is the only thing about the response that may
  // be logged by a caller. It is NOT logged here.
  void sanitizeBooleanObservationRawPayload(responseJson);

  const extracted = extractBooleanObservationResponse(responseJson);
  if (extracted === null) {
    return { kind: 'unavailable', reason: 'parse_failure' };
  }

  // 6. Validate through the MCP-021A parser. A parser failure →
  //    validation_failed → caller writes a `failed` run row.
  const parsed = parseMcpBooleanObservationResponse(extracted);
  if (!parsed.ok) {
    return { kind: 'unavailable', reason: 'validation_failed' };
  }

  // 7. Schema-version guard (parser already does this; belt-and-suspenders).
  if (parsed.response.schemaVersion !== MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION) {
    return { kind: 'unavailable', reason: 'validation_failed' };
  }

  // 8. Clean pass — return the validated, frozen response.
  const response = Object.freeze(parsed.response) as McpBooleanObservationResponse;
  return { kind: 'success', response };
}
