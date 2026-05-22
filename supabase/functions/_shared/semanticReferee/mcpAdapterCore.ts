/**
 * MCP-018 — Semantic referee MCP-adapter core (zod-free).
 *
 * The pure, Jest-importable logic for the operator-hosted MCP-server provider:
 * MCP-tool request-body assembly, MCP-response packet extraction, JSON-from-
 * content parse, and the raw-payload sanitizer. NONE of this touches `Deno`,
 * `fetch`, `npm:zod`, or any I/O — so the `_helpers/semanticRefereeDeno.ts`
 * Jest bridge can `require()` it directly and unit-test every function.
 *
 * The zod-coupled orchestration (the `fetch`, the `Deno.env.get`, the schema +
 * content validation dispatch) lives in `mcpAdapter.ts`, which imports this
 * file. That split is what makes the adapter unit-testable — the exact analog
 * of `anthropicClassifierCore.ts` ↔ `anthropicProvider.ts` (MCP-018 design §8
 * "Test reality").
 *
 * This file MIRRORS the sibling `anthropicClassifierCore.ts` step-for-step. It
 * does NOT import or re-export the sibling — the `parseJsonFromContent` helper
 * is a documented LOCAL COPY of the sibling's identical ~12-line pure helper
 * (MCP-018 design §5 / OQ-4: AC5 forbids modifying `anthropicClassifierCore.ts`,
 * so a shared-module extraction is out of scope; the local copy is the design's
 * recommended path, with a parity test feeding both copies the same inputs).
 *
 * DOCTRINE: the MCP-tool request asks for STRUCTURAL yes/no answers only — no
 * verdict, no truth, no winner, no popularity reading. The MCP server is
 * contractually required to honor MCP-001's catalog (MCP-009 §"MCP-server
 * placement"). The boundary owns `provider` / `authoritative` — `mcpAdapter.ts`
 * hard-pins `authoritative: false`.
 *
 * PURE TYPESCRIPT — imports only `types.ts`. Zero `npm:` imports.
 */
import type { ClassifyMoveRequest, SemanticRefereePacket } from './types.ts';

/**
 * The MCP tool name the operator-hosted server exposes (MCP-009 §"MCP-server
 * placement" names exactly this tool). The adapter invokes this tool; the
 * server classifies one argument move's STRUCTURE and returns a packet.
 */
export const MCP_CLASSIFY_TOOL_NAME = 'classify_semantic_move';

/**
 * A bounded request timeout for the MCP-server `fetch` — applied in
 * `mcpAdapter.ts` via `AbortSignal.timeout`. The sibling `anthropicProvider.ts`
 * has no explicit timeout; an operator-hosted server is a less-known quantity,
 * so a timeout is prudent (MCP-018 design §5 / OQ-5 — the single intentional
 * divergence from the `anthropicProvider.ts` mirror). A timed-out `fetch`
 * throws and maps to `network_error`.
 */
export const MCP_REQUEST_TIMEOUT_MS = 15_000;

/**
 * The `modelVersion` stamped on the packet when the MCP server's envelope does
 * not report its own model id. The Deno `SemanticRefereePacketSchema` requires
 * `modelVersion` to be a non-empty string; this constant satisfies it for an
 * operator-hosted server that does not surface a model id of its own.
 */
export const DEFAULT_MCP_MODEL_VERSION = 'operator-mcp-server';

/**
 * The MCP adapter's own failure vocabulary — a BOUNDARY-INTERNAL type, NOT a
 * `ClassifyMoveDisabledReason` value. The exact analog of the sibling's
 * `ProviderUnavailableReason`, but with `url_missing` / `token_missing` in
 * place of `key_missing` — the `mcp` provider has TWO configuration inputs (a
 * URL and a token), so a single "key_missing" is the wrong word (MCP-018
 * design §4 resolution 1). `runMcpAdapter` returns one of these on every
 * non-success path; `providerRoutingCore.ts` translates it into the outbound
 * `ClassifyMoveOutcome` reason (`url_missing` / `token_missing` → the existing
 * `'not_configured'`; the other five are already legal disabled reasons).
 */
export type McpUnavailableReason =
  | 'url_missing'
  | 'token_missing'
  | 'api_error'
  | 'rate_limited'
  | 'network_error'
  | 'parse_failure'
  | 'validation_failed';

/** Every documented `McpUnavailableReason` value — a guard for the union. */
export const ALL_MCP_UNAVAILABLE_REASONS: readonly McpUnavailableReason[] = [
  'url_missing',
  'token_missing',
  'api_error',
  'rate_limited',
  'network_error',
  'parse_failure',
  'validation_failed',
];

/**
 * The result of one MCP-adapter call. `success` carries a fully validated
 * packet; `unavailable` carries a typed reason. The adapter NEVER throws — a
 * missing URL / token, a thrown `fetch`, an HTTP error, a parse miss, and a
 * validation failure all map to an `unavailable` result. This is the analog of
 * the sibling's `ProviderResult`, parameterized on `McpUnavailableReason`.
 */
export type McpProviderResult =
  | { kind: 'success'; packet: SemanticRefereePacket }
  | { kind: 'unavailable'; reason: McpUnavailableReason };

/**
 * Build the MCP tool-invocation request body. Pure — exported so tests can
 * assert its shape without a network call. Same `request` → byte-identical
 * output (no `Date.now()`, no randomness).
 *
 * The body carries the redacted move + parent bodies + room context + the
 * requested catalog-v0 classifier ids — the same payload `buildAnthropicRequestBody`
 * assembles, minus the Anthropic-Messages envelope. It carries NOTHING that
 * asks whether anything is true, correct, who is winning, or how popular a
 * claim is, and NO `block` field (MCP-018 design §3 rule 5 / §8 ban-list).
 */
export function buildMcpToolRequestBody(
  request: ClassifyMoveRequest,
): Record<string, unknown> {
  const ctx = request.roomContext;
  const input: Record<string, unknown> = {
    moveBodyRedacted: request.moveBodyRedacted,
    roomContext: {
      ...(ctx.debateMode ? { debateMode: ctx.debateMode } : {}),
      ...(ctx.selectedAction ? { selectedAction: ctx.selectedAction } : {}),
      ...(ctx.selectedMoveType ? { selectedMoveType: ctx.selectedMoveType } : {}),
      ...(ctx.side ? { side: ctx.side } : {}),
      ...(ctx.actorRole ? { actorRole: ctx.actorRole } : {}),
    },
    requestedClassifiers: [...request.requestedClassifiers],
    contentHash: request.contentHash,
    roomId: request.roomId,
  };
  if (request.parentBodyRedacted !== undefined) {
    input.parentBodyRedacted = request.parentBodyRedacted;
  }
  if (request.moveId !== undefined) input.moveId = request.moveId;
  if (request.parentId !== undefined) input.parentId = request.parentId;
  if (request.promptVersionHint !== undefined) {
    input.promptVersionHint = request.promptVersionHint;
  }
  return { tool: MCP_CLASSIFY_TOOL_NAME, input };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Extract and `JSON.parse` the first `{...}` object from a content string.
 * Returns the parsed value, or `null` on ANY failure — non-JSON, a JSON array,
 * empty input, a malformed object. NEVER throws.
 *
 * This is a DOCUMENTED LOCAL COPY of the identical helper in the sibling
 * `anthropicClassifierCore.ts` (MCP-018 design §5 / OQ-4: AC5 forbids editing
 * that file, and a shared-module extraction would change its import line). A
 * parity test in `semanticMcpAdapterCore.test.ts` feeds both copies the same
 * inputs to prove they never diverge.
 */
export function parseJsonFromContent(text: unknown): unknown | null {
  if (typeof text !== 'string') return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as unknown;
    // A `{...}` match always parses to an object on success; guard anyway so a
    // caller never receives an array / primitive.
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Pull the packet object out of an MCP-server response envelope. The MCP
 * convention is a result wrapper — this accepts a small, documented set of
 * shapes, in order:
 *   1. `{ result: {...} }`     — a direct result object.
 *   2. `{ output: {...} }`     — an `output`-keyed result object.
 *   3. `{ content: [...] }`    — a `content[]` array of typed blocks; the first
 *      `type:'json'` block's `json` payload, else the first `type:'text'`
 *      block's `text` JSON-parsed via `parseJsonFromContent`.
 * Returns the inner object, or `null` on any miss. NEVER throws (MCP-018
 * design §5; the unrecognised-shape → `null` → `parse_failure` path is the
 * graceful-degradation guard from §11 risks).
 */
export function extractMcpPacket(responseJson: unknown): unknown | null {
  if (!isPlainObject(responseJson)) return null;

  // 1. { result: {...} }
  const result = responseJson['result'];
  if (isPlainObject(result)) return result;

  // 2. { output: {...} }
  const output = responseJson['output'];
  if (isPlainObject(output)) return output;

  // 3. { content: [ ...typed blocks ] }
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
 * Keep ONLY a small allow-list of non-sensitive envelope keys
 * (`tool`, `status`, `stop_reason`, `usage`) from a raw MCP-server response.
 * NEVER returns the raw body, the token, request headers, or the inner
 * packet's free-text fields. The analog of the sibling's `sanitizeRawPayload`
 * — used for the (sanitized) log line only.
 */
export function sanitizeMcpRawPayload(raw: unknown): Record<string, unknown> {
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
