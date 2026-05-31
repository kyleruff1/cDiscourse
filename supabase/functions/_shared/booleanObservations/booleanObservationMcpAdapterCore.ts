/**
 * MCP-021C-EDGE — Boolean Observation MCP adapter core (pure, Jest-loadable).
 *
 * The pure, Jest-importable logic for the operator-hosted MCP-server
 * Boolean Observation classifier: tool-request body assembly, response
 * extraction, raw-payload sanitizer, and the failure-vocabulary type
 * (`BooleanObservationUnavailableReason`).
 *
 * MIRRORS the MCP-018 sibling at
 * supabase/functions/_shared/semanticReferee/mcpAdapterCore.ts step-for-step,
 * but for the `classify_argument_boolean_observations` tool name and the
 * MCP-021A response schema instead of the SemanticRefereePacket shape.
 *
 * Pure TS — no Deno, no fetch, no npm import. The zod-coupled
 * orchestration (the fetch, the Deno.env.get, the parser dispatch) lives
 * in `booleanObservationMcpAdapter.ts`, which imports this file.
 *
 * Doctrine encoded:
 *   - cdiscourse-doctrine §7: this file is server-only; sibling
 *     `booleanObservationMcpAdapter.ts` is the sole MCP-call surface
 *     for this tool.
 *   - cdiscourse-doctrine §10a: the MCP-tool request asks for STRUCTURAL
 *     yes/no answers only — no verdict, no truth, no winner, no
 *     popularity reading.
 *   - cdiscourse-doctrine §1: hard-pinned `provider: 'mcp'` on the
 *     response (the parser in mcpBooleanObservationSchema.ts:311
 *     enforces this at validation time).
 *
 * Imports only `mcpBooleanObservationSchema.ts` (pure TS). Zero `npm:`
 * imports.
 */

import type {
  McpBooleanObservationRequest,
  McpBooleanObservationResponse,
} from './mcpBooleanObservationSchema.ts';
import type {
  BooleanObservationFailureSubreason,
  BooleanObservationFailureDetail,
} from './booleanObservationFailureSubreason.ts';

/**
 * The MCP tool name the operator-hosted server exposes for the Boolean
 * Observation classifier. The MCP server is contractually expected to
 * surface a `classify_argument_boolean_observations` tool conforming to
 * the MCP-021A request/response schema.
 */
export const MCP_BOOLEAN_OBSERVATION_TOOL_NAME =
  'classify_argument_boolean_observations';

/**
 * Bounded request timeout for the MCP-server fetch — applied in
 * `booleanObservationMcpAdapter.ts` via `AbortSignal.timeout`. Matches
 * the MCP-018 sibling's 15s posture. This is the DEFAULT (submit-path /
 * direct-dispatch) caller-side abort deadline and is UNCHANGED by ARCH-001
 * Card 2.
 */
export const MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS = 15_000;

/**
 * ARCH-001 Card 2 (design §A.6 — timeout hierarchy correction): the
 * BACKGROUND DRAINER's caller-side abort deadline for the MCP-server fetch.
 *
 * The prior submit-path 15s abort was TIGHTER than the MCP server's own
 * model budget (`MCP_SERVER_MODEL_TIMEOUT_MS=25000`), so a valid slow
 * provider call (16-25s, within the server's tolerance) was killed by the
 * caller — an inverted hierarchy. The drainer runs OFF the user's path, so
 * it can (and must) be patient: 30s ≥ 25s server model budget + 5s headroom
 * ⇒ caller patience exceeds callee work budget. Passed by the drainer via
 * `runBooleanObservationMcpAdapter(request, { timeoutMs:
 * DRAINER_MCP_REQUEST_TIMEOUT_MS })`. The 15s default above is left
 * untouched (the submit path is byte-unchanged).
 */
export const DRAINER_MCP_REQUEST_TIMEOUT_MS = 30_000;

/**
 * The `serverName` stamped on the response's modelInfo block when the MCP
 * server does not surface its own server name. The MCP-021A parser
 * requires `modelInfo.serverName` to be a non-empty string.
 */
export const DEFAULT_MCP_BOOLEAN_OBSERVATION_SERVER_NAME = 'operator-mcp-server';

/**
 * The `classifierSetVersion` stamped on the response when the MCP server
 * does not surface its own. The MCP-021A parser requires it to be a
 * non-empty string.
 */
export const DEFAULT_MCP_BOOLEAN_OBSERVATION_CLASSIFIER_SET_VERSION =
  'mcp-021.classifier-set.v1';

/**
 * The Boolean Observation adapter's failure vocabulary. NEVER thrown — the
 * adapter always returns a typed {kind: 'unavailable', reason} on every
 * non-success path. Mirrors the MCP-018 sibling's `McpUnavailableReason`.
 */
export type BooleanObservationUnavailableReason =
  | 'url_missing'
  | 'token_missing'
  | 'api_error'
  | 'rate_limited'
  | 'network_error'
  | 'parse_failure'
  | 'validation_failed';

/** Every documented `BooleanObservationUnavailableReason` value. */
export const ALL_BOOLEAN_OBSERVATION_UNAVAILABLE_REASONS:
  readonly BooleanObservationUnavailableReason[] = [
    'url_missing',
    'token_missing',
    'api_error',
    'rate_limited',
    'network_error',
    'parse_failure',
    'validation_failed',
  ];

/**
 * The result of one MCP Boolean Observation adapter call. `success`
 * carries the validated MCP-021A response object; `unavailable` carries
 * a typed reason.
 *
 * OPS-MCP-RESULT-VALIDATION-BURST-HARDENING (Phase 1): the `unavailable`
 * variant gains an OPTIONAL typed `subReason` + a bounded, sanitized
 * `detail`. Both are ADDITIVE — `reason` is byte-equal and
 * `'validation_failed'` is preserved so `unavailableReasonToFailureReason`
 * still yields `failure_reason='mcp_validation_failed'` (HALT-9). The
 * `detail` field is a secret-surface guarded by the allowlist builder in
 * `booleanObservationFailureSubreason.ts` (cdiscourse-doctrine §6).
 */
export type BooleanObservationAdapterResult =
  | { kind: 'success'; response: McpBooleanObservationResponse }
  | {
      kind: 'unavailable';
      reason: BooleanObservationUnavailableReason;
      subReason?: BooleanObservationFailureSubreason;
      detail?: BooleanObservationFailureDetail;
    };

/**
 * Build the MCP tool-invocation request body. Pure — exported so tests
 * can assert its shape without a network call. Same `request` →
 * byte-identical output (no Date.now, no randomness).
 *
 * The body carries the move + parent bodies + requested rawKeys + thread
 * context excerpt + the schema version pin — the exact shape MCP-021A's
 * `McpBooleanObservationRequest` defines. The `definitions` map is
 * INCLUDED (the MCP server uses it to formulate the boolean questions
 * per rawKey).
 *
 * Doctrine: this body carries STRUCTURAL questions only — no verdict,
 * no truth, no winner.
 */
export function buildBooleanObservationToolRequestBody(
  request: McpBooleanObservationRequest,
): Record<string, unknown> {
  const input: Record<string, unknown> = {
    schemaVersion: request.schemaVersion,
    nodeId: request.nodeId,
    parentNodeId: request.parentNodeId,
    currentText: request.currentText,
    parentText: request.parentText,
    threadContextExcerpt: request.threadContextExcerpt,
    requestedFamilies: [...request.requestedFamilies],
    requestedRawKeys: [...request.requestedRawKeys],
    definitions: request.definitions,
    timeoutMs: request.timeoutMs,
  };
  return {
    tool: MCP_BOOLEAN_OBSERVATION_TOOL_NAME,
    input,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Extract and `JSON.parse` the first `{...}` object from a content string.
 * Returns the parsed value, or `null` on ANY failure. NEVER throws.
 *
 * DOCUMENTED LOCAL COPY of the identical helper in the MCP-018 sibling.
 * Kept local so this file remains independent (no cross-tree import).
 */
function parseJsonFromContent(text: unknown): unknown | null {
  if (typeof text !== 'string') return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Pull the response object out of an MCP-server response envelope. Same
 * shape support as the MCP-018 sibling's `extractMcpPacket`:
 *   1. `{ result: {...} }` — direct result object.
 *   2. `{ output: {...} }` — output-keyed result object.
 *   3. `{ content: [...] }` — content[] array; the first `type:'json'`
 *      block's `json` payload, else the first `type:'text'` block's
 *      text JSON-parsed via `parseJsonFromContent`.
 *
 * Returns the inner object, or `null` on any miss. NEVER throws.
 */
export function extractBooleanObservationResponse(
  responseJson: unknown,
): unknown | null {
  if (!isPlainObject(responseJson)) return null;

  // 1. { result: {...} }
  const result = responseJson['result'];
  if (isPlainObject(result)) return result;

  // 2. { output: {...} }
  const output = responseJson['output'];
  if (isPlainObject(output)) return output;

  // 3. { content: [...] }
  const content = responseJson['content'];
  if (Array.isArray(content)) {
    // Prefer an explicit json block.
    for (const block of content) {
      if (
        isPlainObject(block) &&
        block['type'] === 'json' &&
        isPlainObject(block['json'])
      ) {
        return block['json'];
      }
    }
    // Fall back to the first text block carrying a JSON object.
    for (const block of content) {
      if (
        isPlainObject(block) &&
        block['type'] === 'text' &&
        typeof block['text'] === 'string'
      ) {
        const parsed = parseJsonFromContent(block['text']);
        if (parsed !== null) return parsed;
      }
    }
  }

  return null;
}

/**
 * Keep ONLY a small allow-list of non-sensitive envelope keys (`tool`,
 * `status`, `stop_reason`, `usage`) from a raw MCP-server response. NEVER
 * returns the raw body, the token, request headers, or the inner
 * response's free-text fields. The analog of the MCP-018 sibling's
 * `sanitizeMcpRawPayload` — used for the (sanitized) log line only.
 */
export function sanitizeBooleanObservationRawPayload(
  raw: unknown,
): Record<string, unknown> {
  if (!isPlainObject(raw)) {
    return { tool: undefined, status: undefined, stop_reason: undefined, usage: undefined };
  }
  return {
    tool: raw['tool'],
    status: raw['status'],
    stop_reason: raw['stop_reason'],
    usage: raw['usage'],
  };
}
