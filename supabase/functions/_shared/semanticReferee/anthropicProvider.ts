/**
 * MCP-017 — Semantic referee Anthropic LIVE provider (Deno-only orchestrator).
 *
 * The implementation of MCP-009's `anthropic` provider slot: a Haiku-class
 * model reached via the same `Deno.env.get` + `fetch` pattern the
 * `process-language-draft` provider already uses. This is the ONLY file in the
 * MCP-001 … MCP-017 family that makes a live AI call.
 *
 * Server-only — runs inside the `semantic-referee` Edge Function. NEVER called
 * from client code. NEVER logs the API key, the `x-api-key` header, the
 * Authorization header, or a raw response body.
 *
 * It MIRRORS the sibling `_shared/languageProcessing/anthropicProvider.ts`
 * step-for-step — but it does NOT import or re-export the sibling. It is a
 * separate file with its own model-id constant and its own system prompt.
 *
 * Reads from Deno.env (this is the ONLY file in the semantic-referee tree that
 * reads either key):
 *   ANTHROPIC_API_KEY      — required; returns `unavailable: key_missing` if absent.
 *   SEMANTIC_REFEREE_MODEL — optional; defaults to DEFAULT_SEMANTIC_REFEREE_MODEL.
 *
 * Every failure path returns a typed `ProviderResult` of kind `unavailable` —
 * the provider NEVER throws to the caller:
 *   - key absent              → `key_missing`
 *   - `fetch` throws          → `network_error`
 *   - HTTP 429                → `rate_limited`
 *   - any other non-OK HTTP   → `api_error`
 *   - missing / non-JSON text → `parse_failure`
 *   - schema OR content fail  → `validation_failed`
 *
 * Even a SUCCESSFUL Anthropic response is re-validated through (a) the Deno
 * `SemanticRefereePacketSchema` and (b) the Deno-side `scanPacketContent` —
 * a failure on either forces `validation_failed`, and the registry falls back
 * to the deterministic packet. A misbehaving model cannot reach the user.
 *
 * This file imports `schema.ts` (→ `npm:zod@4`) so it is NOT Jest-importable —
 * it is covered by `__tests__/semanticAnthropicSourceScan.test.ts` source scans
 * and the `__tests__/semanticEdgeAuthAnthropic.test.ts` integration suite,
 * exactly as the sibling provider is.
 */
import {
  DEFAULT_SEMANTIC_REFEREE_MODEL,
  buildAnthropicRequestBody,
  extractAnthropicContentText,
  parseJsonFromContent,
  sanitizeRawPayload,
} from './anthropicClassifierCore.ts';
import type { ProviderResult } from './anthropicClassifierCore.ts';
import { SEED_PROMPT_VERSION } from './seedPrompt.ts';
import { scanPacketContent } from './contentSafetyScan.ts';
import { SemanticRefereePacketSchema } from './schema.ts';
import { PACKET_VERSION } from './types.ts';
import type { ClassifyMoveRequest, SemanticRefereePacket } from './types.ts';

/** The Anthropic Messages API endpoint — this is the only file that names it. */
const ANTHROPIC_MESSAGES_ENDPOINT = 'https://api.anthropic.com/v1/messages';

/** The Anthropic API version header value — matches the sibling provider. */
const ANTHROPIC_API_VERSION = '2023-06-01';

/**
 * A small deterministic 32-bit string hash (FNV-1a) — used only to derive a
 * stable `inputHash`. Mirrors `mockProvider.ts`'s helper. No randomness.
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

/**
 * Stamp the contract-required identity fields onto the model's parsed object.
 * The model is asked for `binaries` / `routeSuggestion` / `frictionSuggestion`
 * / `scoreHints` only; the boundary owns `packetVersion`, `provider`,
 * `authoritative`, the version strings, the hashes, and the room / move ids.
 * `authoritative` is hard-pinned to `false` — the model cannot override it.
 */
function stampPacketIdentity(
  parsed: Record<string, unknown>,
  request: ClassifyMoveRequest,
  model: string,
): Record<string, unknown> {
  const promptVersion = request.promptVersionHint ?? SEED_PROMPT_VERSION;
  const inputHash = `anthropic-${hashToken(
    fnv1a(`${request.roomId}|${request.contentHash}|${promptVersion}|${model}`),
  )}`;
  return {
    ...parsed,
    packetVersion: PACKET_VERSION,
    promptVersion,
    modelVersion: model,
    provider: 'anthropic',
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
 * Run the live Anthropic classifier. Returns a typed `ProviderResult` — never
 * throws. On `{ kind: 'success' }` the packet has already passed BOTH the
 * `SemanticRefereePacketSchema` and the `scanPacketContent` content wall.
 */
export async function runAnthropicClassifier(
  request: ClassifyMoveRequest,
): Promise<ProviderResult> {
  // 1. Key read — the ONLY Deno.env.get('ANTHROPIC_API_KEY') in the tree.
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return { kind: 'unavailable', reason: 'key_missing' };
  }

  // 2. Optional model override.
  const model = Deno.env.get('SEMANTIC_REFEREE_MODEL') ?? DEFAULT_SEMANTIC_REFEREE_MODEL;

  // 3. Build the request body and POST.
  const requestBody = buildAnthropicRequestBody(request, model);
  let rawResponse: Response;
  try {
    rawResponse = await fetch(ANTHROPIC_MESSAGES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify(requestBody),
    });
  } catch {
    // A thrown fetch (DNS, TLS, connection reset). The error object can carry
    // host / connection detail — it is NOT logged or returned.
    return { kind: 'unavailable', reason: 'network_error' };
  }

  // 4. Map a non-OK HTTP status. 429 → rate_limited; anything else → api_error.
  if (!rawResponse.ok) {
    return {
      kind: 'unavailable',
      reason: rawResponse.status === 429 ? 'rate_limited' : 'api_error',
    };
  }

  // 5. Parse the response body, extract the model text, parse the JSON object.
  let responseJson: unknown;
  try {
    responseJson = await rawResponse.json();
  } catch {
    return { kind: 'unavailable', reason: 'parse_failure' };
  }
  // `sanitizeRawPayload` keeps only { model, stop_reason, usage } — it is the
  // only thing about the response that may be logged by a caller. It is not
  // logged here; the call documents that the raw body is dropped.
  void sanitizeRawPayload(responseJson);

  const contentText = extractAnthropicContentText(responseJson);
  if (contentText === undefined) {
    return { kind: 'unavailable', reason: 'parse_failure' };
  }
  const parsed = parseJsonFromContent(contentText);
  if (parsed === null) {
    return { kind: 'unavailable', reason: 'parse_failure' };
  }

  // 6. Stamp the contract identity fields (provider / authoritative / hashes).
  const stamped = stampPacketIdentity(parsed as Record<string, unknown>, request, model);

  // 7. Validate through the schema wall, THEN the content-safety wall. A
  //    failure on EITHER → validation_failed → deterministic fallback.
  const schemaResult = SemanticRefereePacketSchema.safeParse(stamped);
  if (!schemaResult.success) {
    // SMOKE-FIX-001 §5.2 — single sanitized diagnostic line per failed call.
    // Only the schema issue PATH is logged (e.g. ["binaries", 0, "value"]) —
    // never the offending VALUE, never the response body / model text / API
    // key / Authorization header / JWT / room id / move id / user id.
    // `inputHash` is the deterministic, non-secret per-request correlator
    // already stamped on the packet at line 92-94; it lets a Supabase log
    // line join to a smoke-test log entry by run+request.
    // eslint-disable-next-line no-console
    console.warn(JSON.stringify({
      semanticReferee: 'validation_failed',
      layer: 'schema',
      path: schemaResult.error.issues[0]?.path ?? [],
      inputHash: typeof stamped.inputHash === 'string' ? stamped.inputHash : null,
    }));
    return { kind: 'unavailable', reason: 'validation_failed' };
  }
  const contentResult = scanPacketContent(stamped);
  if (!contentResult.ok) {
    // SMOKE-FIX-001 §5.2 — single sanitized diagnostic line per failed call.
    // `contentResult.detail` is already a category-only string from
    // contentSafetyScan.ts:228-230 (e.g. "binaries[0].reasonCode contained a
    // verdict / outcome token") — it never echoes the offending VALUE.
    // eslint-disable-next-line no-console
    console.warn(JSON.stringify({
      semanticReferee: 'validation_failed',
      layer: 'content_scan',
      detail: contentResult.detail,
      inputHash: typeof stamped.inputHash === 'string' ? stamped.inputHash : null,
    }));
    return { kind: 'unavailable', reason: 'validation_failed' };
  }

  // 8. Clean pass — return the validated, frozen packet.
  const packet = Object.freeze(schemaResult.data as unknown as SemanticRefereePacket);
  return { kind: 'success', packet };
}
