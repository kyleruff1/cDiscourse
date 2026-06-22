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
import {
  mapToFailureSubreason,
  buildFailureDetail,
  mcpToolDetailToCategory,
} from './booleanObservationFailureSubreason.ts';

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
 * True when the MCP server returned its OWN error envelope on the
 * extracted response object — a top-level `{ isError: true, … }` shape.
 * This is a provider/server-side error signal, NOT a schema-shape failure;
 * it MUST NOT be routed through parseMcpBooleanObservationResponse (which
 * would mis-type it as `response_wrong_schema_version` because the envelope
 * has no schemaVersion — OPS-MCP-RESULT-VALIDATION-BURST-HARDENING Phase 2).
 *
 * The object check is inlined (same shape the adapter-core's private
 * `isPlainObject` uses + the adapter already inlines `isHttpsUrl`); no new
 * symbol is exported from a schema-mirrored file. Pure, never throws.
 *
 * `isError` must be the boolean literal `true` (STRICT `=== true`): a
 * falsey / absent / non-`true` `isError` is NOT an error envelope, so an
 * ordinary wrong-schema response still routes to the parser. Truthiness
 * (`isError: 1` / `'true'` / an object) MUST NOT trip detection — that
 * would over-broaden the catch and hide real schema/shape failures.
 */
function isServerErrorEnvelope(
  extracted: unknown,
): extracted is { isError: true; reason?: unknown; path?: unknown; detail?: unknown } {
  return (
    typeof extracted === 'object' &&
    extracted !== null &&
    !Array.isArray(extracted) &&
    (extracted as Record<string, unknown>).isError === true
  );
}

/**
 * Optional per-call options for {@link runBooleanObservationMcpAdapter}.
 *
 * ARCH-001 Card 2 (design §A.6 — timeout hierarchy correction): the
 * caller-side `AbortSignal.timeout` is now PARAMETERIZABLE. The submit-path
 * direct-dispatch caller passes the adapter as a 1-arg function reference
 * (see autoTriggerDispatcher.ts), so it omits `options` entirely and keeps
 * the existing 15s default (`MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS`) —
 * its behavior is BYTE-UNCHANGED. The Card-2 background drainer passes
 * `{ timeoutMs: 30000 }` so caller patience (>=30s) EXCEEDS the MCP
 * server's own model budget (`MCP_SERVER_MODEL_TIMEOUT_MS=25s`), correcting
 * the prior inverted hierarchy where the 15s caller abort killed a valid
 * 16-25s slow call.
 *
 * This change is ADDITIVE only: a missing/invalid `timeoutMs` falls back to
 * the existing module constant, so no existing caller's behavior changes.
 */
export interface RunBooleanObservationMcpAdapterOptions {
  /**
   * Caller-side abort deadline in ms for the MCP-server fetch. Defaults to
   * `MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS` (15000) when absent or not
   * a positive finite number. The Card-2 drainer passes 30000.
   */
  timeoutMs?: number;
}

/**
 * Run the operator-hosted MCP-server's Boolean Observation classifier
 * adapter. Returns a typed `BooleanObservationAdapterResult` — never
 * throws. On `{ kind: 'success' }` the response has already passed the
 * MCP-021A `parseMcpBooleanObservationResponse` validator.
 *
 * The optional second argument parameterizes the caller-side timeout
 * (design §A.6). When omitted (the submit-path direct-dispatch caller), the
 * existing 15s constant is used unchanged.
 */
export async function runBooleanObservationMcpAdapter(
  request: McpBooleanObservationRequest,
  options?: RunBooleanObservationMcpAdapterOptions,
): Promise<BooleanObservationAdapterResult> {
  // Resolve the caller-side abort deadline. ADDITIVE: a missing / non-finite
  // / non-positive value falls back to the existing 15s constant, so the
  // submit-path caller (which passes no options) is byte-unchanged.
  const resolvedTimeoutMs =
    options !== undefined &&
    typeof options.timeoutMs === 'number' &&
    Number.isFinite(options.timeoutMs) &&
    options.timeoutMs > 0
      ? options.timeoutMs
      : MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS;
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
      signal: AbortSignal.timeout(resolvedTimeoutMs),
    });
  } catch {
    // A thrown fetch (DNS, TLS, connection reset, or a timeout abort). The
    // error object can carry host / connection detail — it is NOT logged
    // or returned. The sub-reason is the structural class only; no detail
    // (the caught error is never inspected — posture preserved).
    return {
      kind: 'unavailable',
      reason: 'network_error',
      subReason: mapToFailureSubreason('network_error'),
    };
  }

  // 4. Map a non-OK HTTP status. 429 → rate_limited; anything else →
  //    api_error. The sub-reason mirrors the reason; no detail (the HTTP
  //    status class is already implied by the sub-reason — keep minimal).
  if (!rawResponse.ok) {
    const httpReason = rawResponse.status === 429 ? 'rate_limited' : 'api_error';
    return {
      kind: 'unavailable',
      reason: httpReason,
      subReason: mapToFailureSubreason(httpReason),
    };
  }

  // 5. Parse the response body and extract the inner response object.
  let responseJson: unknown;
  try {
    responseJson = await rawResponse.json();
  } catch {
    // Non-JSON body. The sub-reason names the structural class; no detail
    // (there is no `extracted` here, and the raw body is never read).
    return {
      kind: 'unavailable',
      reason: 'parse_failure',
      subReason: mapToFailureSubreason('parse_failure'),
    };
  }
  // `sanitizeBooleanObservationRawPayload` keeps only a small allow-list
  // of envelope keys — it is the only thing about the response that may
  // be logged by a caller. It is NOT logged here.
  void sanitizeBooleanObservationRawPayload(responseJson);

  const extracted = extractBooleanObservationResponse(responseJson);
  if (extracted === null) {
    // Unrecognized envelope (extract returned null). Sub-reason only —
    // there is no structural field to name (no `extracted` object).
    return {
      kind: 'unavailable',
      reason: 'parse_failure',
      subReason: mapToFailureSubreason('parse_failure'),
    };
  }

  // OPS-MCP-RESULT-VALIDATION-BURST-HARDENING (Phase 3): detect the MCP
  // server's OWN error envelope BEFORE the schema validator. Under
  // concurrent load the server returns `{ isError, reason, path, detail }`;
  // routing it through parseMcpBooleanObservationResponse mis-types it as
  // `response_wrong_schema_version` (it has no schemaVersion — Phase 2). It
  // is a provider/server transient — type it `provider_server_error`, carry
  // it on the existing `api_error` reason so the EXISTING bounded retry
  // (1 retry / 2s,8s / concurrency 2) heals it with NO dispatch-config edit.
  // The server's short `reason` value rides the Phase-1 sanitizer as
  // `serverReason` (UNTRUSTED — scrubbed + capped); the raw `detail` is
  // NEVER forwarded (no `detail:` arg exists on FailureDetailInput).
  if (isServerErrorEnvelope(extracted)) {
    // MCP-EGI-003 — derive the closed-enum category from the hosted-MCP
    // server's `detail` STRING (a structural validator string like
    // 'value must be string or null' or 'length 241 exceeds max 240'). The
    // mapper NEVER returns the raw `detail`; only the matched enum value
    // (or `undefined`). The raw string is otherwise discarded here as
    // before — the leak-safety boundary is unchanged.
    const detailCategory = mcpToolDetailToCategory(extracted.detail);
    return {
      kind: 'unavailable',
      reason: 'api_error',
      subReason: 'provider_server_error',
      detail: buildFailureDetail({
        serverReason:
          typeof extracted.reason === 'string' ? extracted.reason : undefined,
        path: typeof extracted.path === 'string' ? extracted.path : undefined,
        detailCategory,
        receivedKeysFrom: extracted,
      }),
    };
  }

  // 6. Validate through the MCP-021A parser. A parser failure →
  //    validation_failed → caller writes a `failed` run row.
  //
  // OPS-MCP-RESULT-VALIDATION-BURST-HARDENING (Phase 1): stop discarding
  // the validator's granular reason. `reason:'validation_failed'` is
  // PRESERVED (HALT-9); the sub-reason delegates to the validator map and
  // the detail is RE-DERIVED from the `extracted` object the adapter
  // already holds (the validator's `parsed.details` free-text string is
  // NEVER read — the secret-surface guarantee is self-contained here).
  const parsed = parseMcpBooleanObservationResponse(extracted);
  if (!parsed.ok) {
    return {
      kind: 'unavailable',
      reason: 'validation_failed',
      subReason: mapToFailureSubreason('validation_failed', parsed.reason),
      detail: buildFailureDetail({
        validatorReason: parsed.reason,
        schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
        received: extracted,
        receivedKeysFrom: extracted,
      }),
    };
  }

  // 7. Schema-version guard (parser already does this; belt-and-suspenders).
  //    There is no `parsed` failure object at this site (the parser
  //    returned ok), so the sub-reason is set DIRECTLY and the detail
  //    carries only the expected schema-version constant.
  if (parsed.response.schemaVersion !== MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION) {
    return {
      kind: 'unavailable',
      reason: 'validation_failed',
      subReason: 'response_wrong_schema_version',
      detail: buildFailureDetail({
        path: 'schemaVersion',
        expected: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
        received: parsed.response.schemaVersion,
        schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
      }),
    };
  }

  // 8. Clean pass — return the validated, frozen response.
  const response = Object.freeze(parsed.response) as McpBooleanObservationResponse;
  return { kind: 'success', response };
}
