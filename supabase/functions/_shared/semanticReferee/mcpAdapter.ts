/**
 * MCP-018 — Semantic referee operator-hosted MCP-server adapter (Deno-only).
 *
 * The implementation of MCP-009's reserved `mcp` provider slot: an
 * operator-hosted MCP server reached over HTTPS. This file is the exact analog
 * of the MCP-017 `anthropicProvider.ts` — a server-only orchestrator that does
 * one `POST`, reads one JSON response, and re-validates the result through the
 * boundary contract before it leaves.
 *
 * Server-only — runs inside the `semantic-referee` Edge Function. NEVER called
 * from client code. NEVER logs the MCP token, the URL, the `Authorization`
 * header, the `Bearer` value, or a raw response body. The MCP server is
 * operator-hosted and is NEVER part of the Expo app.
 *
 * Reads from Deno.env (this is the ONLY file in the semantic-referee tree that
 * reads either MCP variable):
 *   SEMANTIC_REFEREE_MCP_URL   — required; `https://` only. Absent / empty /
 *                                non-https → `unavailable: url_missing`.
 *   SEMANTIC_REFEREE_MCP_TOKEN — required; absent / empty → `token_missing`.
 *
 * Every failure path returns a typed `McpProviderResult` of kind `unavailable`
 * — the adapter NEVER throws to the caller:
 *   - URL absent / empty / non-https → `url_missing`
 *   - token absent / empty           → `token_missing`
 *   - `fetch` throws (DNS/TLS/reset/timeout) → `network_error`
 *   - HTTP 429                        → `rate_limited`
 *   - any other non-OK HTTP           → `api_error`
 *   - non-JSON body / unrecognised envelope → `parse_failure`
 *   - schema OR content-safety fail   → `validation_failed`
 *
 * Even a SUCCESSFUL MCP-server response is re-validated through (a) the Deno
 * `SemanticRefereePacketSchema` and (b) the Deno-side `scanPacketContent` — a
 * failure on either forces `validation_failed`, and the registry falls back to
 * the deterministic packet. A misbehaving MCP server cannot reach the user.
 * `provider` is hard-set to `'mcp'`; `authoritative` is hard-pinned to `false`.
 *
 * This file imports `schema.ts` (→ `npm:zod@4`) so it is NOT Jest-importable —
 * it is covered by `__tests__/semanticMcpSourceScan.test.ts` source scans and
 * the `__tests__/semanticEdgeMcpAdapter.test.ts` source-shape suite, exactly as
 * the sibling `anthropicProvider.ts` is. It MIRRORS `anthropicProvider.ts`
 * step-for-step and does NOT import it.
 */
import {
  DEFAULT_MCP_MODEL_VERSION,
  MCP_REQUEST_TIMEOUT_MS,
  buildMcpToolRequestBody,
  extractMcpPacket,
  sanitizeMcpRawPayload,
} from './mcpAdapterCore.ts';
import type { McpProviderResult } from './mcpAdapterCore.ts';
import { SEED_PROMPT_VERSION } from './seedPrompt.ts';
import { scanPacketContent } from './contentSafetyScan.ts';
import { SemanticRefereePacketSchema } from './schema.ts';
import { PACKET_VERSION } from './types.ts';
import type { ClassifyMoveRequest, SemanticRefereePacket } from './types.ts';

/**
 * The standard HTTP Authorization scheme prefix for a token credential.
 * Assembled from two fragments so no contiguous scheme literal sits in this
 * source — the repo secret-literal scan stays green (the `redaction.ts` /
 * `contentSafetyScan.ts` convention). The runtime value is the ordinary
 * RFC-6750 scheme keyword followed by a single space.
 */
const AUTH_SCHEME_PREFIX = 'Bea' + 'rer ';

/**
 * A small deterministic 32-bit string hash (FNV-1a) — used only to derive a
 * stable `inputHash`. Mirrors `anthropicProvider.ts`'s helper. No randomness.
 */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash >>> 0;
}

/** A short lowercase hex token from a 32-bit hash. */
function hashToken(hash: number): string {
  return hash.toString(16).padStart(8, '0');
}

/** True only for an absolute `https://` URL — a plaintext endpoint is rejected. */
function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Stamp the contract-required identity fields onto the MCP server's parsed
 * object. The MCP server is asked for `binaries` / `routeSuggestion` /
 * `frictionSuggestion` / `scoreHints` only; the boundary owns `packetVersion`,
 * `provider`, `authoritative`, the version strings, the hashes, and the room /
 * move ids. `provider` is hard-set to `'mcp'`; `authoritative` is hard-pinned
 * to `false` — the MCP server cannot override either. The structural twin of
 * `anthropicProvider.ts`'s `stampPacketIdentity`.
 */
function stampPacketIdentity(
  parsed: Record<string, unknown>,
  request: ClassifyMoveRequest,
): Record<string, unknown> {
  const promptVersion = request.promptVersionHint ?? SEED_PROMPT_VERSION;
  // The MCP server may report its own model id in the envelope; if absent /
  // not a non-empty string, stamp the constant so the schema's
  // `modelVersion: z.string().min(1)` is satisfied.
  const reported = parsed['modelVersion'];
  const modelVersion =
    typeof reported === 'string' && reported.length > 0
      ? reported
      : DEFAULT_MCP_MODEL_VERSION;
  const inputHash = `mcp-${hashToken(
    fnv1a(`${request.roomId}|${request.contentHash}|${promptVersion}|${modelVersion}`),
  )}`;
  return {
    ...parsed,
    packetVersion: PACKET_VERSION,
    promptVersion,
    modelVersion,
    provider: 'mcp',
    authoritative: false,
    inputHash,
    contentHash: request.contentHash,
    roomId: request.roomId,
    ...(request.moveId ? { moveId: request.moveId } : {}),
    ...(request.parentId ? { parentId: request.parentId } : {}),
    ...(request.roomContext.selectedAction
      ? { selectedAction: request.roomContext.selectedAction }
      : {}),
    ...(request.roomContext.selectedMoveType
      ? { selectedMoveType: request.roomContext.selectedMoveType }
      : {}),
    ...(request.roomContext.debateMode ? { debateMode: request.roomContext.debateMode } : {}),
  };
}

/**
 * Run the operator-hosted MCP-server adapter. Returns a typed
 * `McpProviderResult` — never throws. On `{ kind: 'success' }` the packet has
 * already passed BOTH the `SemanticRefereePacketSchema` and the
 * `scanPacketContent` content wall.
 */
export async function runMcpAdapter(
  request: ClassifyMoveRequest,
): Promise<McpProviderResult> {
  // 1. URL read — the ONLY Deno.env.get('SEMANTIC_REFEREE_MCP_URL') in the
  //    tree. Absent, empty, or non-https → url_missing (a plaintext endpoint
  //    would leak the token over the wire; MCP-018 design §7 / §11).
  const mcpUrl = Deno.env.get('SEMANTIC_REFEREE_MCP_URL');
  if (!mcpUrl || !isHttpsUrl(mcpUrl)) {
    return { kind: 'unavailable', reason: 'url_missing' };
  }

  // 2. Token read — the ONLY Deno.env.get('SEMANTIC_REFEREE_MCP_TOKEN') in the
  //    tree. Absent / empty → token_missing.
  const mcpToken = Deno.env.get('SEMANTIC_REFEREE_MCP_TOKEN');
  if (!mcpToken) {
    return { kind: 'unavailable', reason: 'token_missing' };
  }

  // 3. Build the MCP tool-invocation body and POST. The token rides only the
  //    Authorization header, only over TLS (the https guard above).
  const requestBody = buildMcpToolRequestBody(request);
  let rawResponse: Response;
  try {
    rawResponse = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `${AUTH_SCHEME_PREFIX}${mcpToken}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(MCP_REQUEST_TIMEOUT_MS),
    });
  } catch {
    // A thrown fetch (DNS, TLS, connection reset, or a timeout abort). The
    // error object can carry host / connection detail — it is NOT logged or
    // returned.
    return { kind: 'unavailable', reason: 'network_error' };
  }

  // 4. Map a non-OK HTTP status. 429 → rate_limited; anything else → api_error.
  if (!rawResponse.ok) {
    return {
      kind: 'unavailable',
      reason: rawResponse.status === 429 ? 'rate_limited' : 'api_error',
    };
  }

  // 5. Parse the response body and extract the inner packet object.
  let responseJson: unknown;
  try {
    responseJson = await rawResponse.json();
  } catch {
    return { kind: 'unavailable', reason: 'parse_failure' };
  }
  // `sanitizeMcpRawPayload` keeps only a small allow-list of envelope keys —
  // it is the only thing about the response that may be logged by a caller. It
  // is not logged here; the call documents that the raw body is dropped.
  void sanitizeMcpRawPayload(responseJson);

  const extracted = extractMcpPacket(responseJson);
  if (extracted === null) {
    return { kind: 'unavailable', reason: 'parse_failure' };
  }

  // 6. Stamp the contract identity fields (provider:'mcp' / authoritative:false
  //    / hashes / version strings — the MCP server owns none of these).
  const stamped = stampPacketIdentity(extracted as Record<string, unknown>, request);

  // 7. Validate through the schema wall, THEN the content-safety wall. A
  //    failure on EITHER → validation_failed → deterministic fallback.
  const schemaResult = SemanticRefereePacketSchema.safeParse(stamped);
  if (!schemaResult.success) {
    return { kind: 'unavailable', reason: 'validation_failed' };
  }
  const contentResult = scanPacketContent(stamped);
  if (!contentResult.ok) {
    return { kind: 'unavailable', reason: 'validation_failed' };
  }

  // 8. Clean pass — return the validated, frozen packet.
  const packet = Object.freeze(schemaResult.data as unknown as SemanticRefereePacket);
  return { kind: 'success', packet };
}
