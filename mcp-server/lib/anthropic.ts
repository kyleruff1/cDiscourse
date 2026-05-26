/**
 * MCP-SERVER-001 — Anthropic Messages API client (server-side).
 *
 * The single point where the Anthropic API key reaches the network. The key
 * is read via Deno.env at call time and NEVER logged, NEVER returned in any
 * response body. The key reaches the request as the `x-api-key` header — the
 * sanitizer scrubs the Authorization variant elsewhere as a defensive
 * defence-in-depth.
 *
 * Timeouts are governed by `MCP_SERVER_MODEL_TIMEOUT_MS` (default 25_000ms).
 * The outer per-request timeout is enforced at the server level
 * (`MCP_SERVER_REQUEST_TIMEOUT_MS`, default 30_000ms).
 *
 * Mirrors the request body construction from
 * `supabase/functions/_shared/semanticReferee/anthropicClassifierCore.ts`
 * (`buildAnthropicRequestBody`).
 */
import { log, sha256Hex } from './logging.ts';
import {
  SEMANTIC_REFEREE_SYSTEM_PROMPT,
  MAX_TOKENS,
  TEMPERATURE,
  buildClassifierPrompt,
} from './seedPrompt.ts';
import type { ClassifyMoveRequestValue } from './semanticRefereePacketSchema.ts';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';
const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5';
const DEFAULT_MODEL_TIMEOUT_MS = 25_000;

export type AnthropicFailureReason =
  | 'key_missing'
  | 'model_timeout'
  | 'api_error'
  | 'rate_limited'
  | 'network_error'
  | 'parse_failure';

export interface AnthropicResult {
  ok: true;
  /** The parsed packet object (still needs schema validation by the caller). */
  packet: Record<string, unknown>;
}

export interface AnthropicFailure {
  ok: false;
  reason: AnthropicFailureReason;
  detail?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Extract the first `content[].type === 'text'` text out of an Anthropic
 * Messages API response. Mirror of
 * `extractAnthropicContentText` in `anthropicClassifierCore.ts`.
 */
export function extractAnthropicContentText(responseJson: unknown): string | undefined {
  if (!isPlainObject(responseJson)) return undefined;
  const content = responseJson['content'];
  if (!Array.isArray(content)) return undefined;
  for (const block of content) {
    if (
      isPlainObject(block) &&
      block['type'] === 'text' &&
      typeof block['text'] === 'string'
    ) {
      return block['text'] as string;
    }
  }
  return undefined;
}

/**
 * Parse and extract the first `{...}` object from a response text. Returns
 * the parsed value or null. Mirror of `parseJsonFromContent` in
 * `anthropicClassifierCore.ts`.
 */
export function parseJsonFromContent(text: unknown): Record<string, unknown> | null {
  if (typeof text !== 'string') return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as unknown;
    if (!isPlainObject(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readTimeoutMs(): number {
  const raw = Deno.env.get('MCP_SERVER_MODEL_TIMEOUT_MS');
  if (!raw) return DEFAULT_MODEL_TIMEOUT_MS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MODEL_TIMEOUT_MS;
  return parsed;
}

function readModel(): string {
  const raw = Deno.env.get('ANTHROPIC_MODEL');
  if (typeof raw === 'string' && raw.length > 0) return raw;
  return DEFAULT_ANTHROPIC_MODEL;
}

/**
 * Run the semantic-referee call against Anthropic. Public for the tool
 * handler and for unit tests via a fetch override.
 *
 * @param request Validated `ClassifyMoveRequest`.
 * @param requestId Server-generated correlation id for log lines.
 * @param fetchImpl Optional override for unit tests.
 */
export async function runAnthropicSemanticReferee(
  request: ClassifyMoveRequestValue,
  requestId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AnthropicResult | AnthropicFailure> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey || apiKey.length === 0) {
    log('warn', 'anthropic_key_missing', {
      requestId,
      tool: 'classify_semantic_move',
      reason: 'key_missing',
      status: 'failure',
    });
    return { ok: false, reason: 'key_missing' };
  }
  const model = readModel();
  const timeoutMs = readTimeoutMs();
  const userPrompt = buildClassifierPrompt(request);
  const body = {
    model,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    system: SEMANTIC_REFEREE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  };

  const promptHash = await sha256Hex(userPrompt);
  log('info', 'anthropic_call_start', {
    requestId,
    tool: 'classify_semantic_move',
    promptHash,
    protocolVersion: undefined,
  });

  const startMs = performance.now();
  let response: Response;
  try {
    response = await fetchImpl(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const duration = Math.round(performance.now() - startMs);
    const reason: AnthropicFailureReason =
      err instanceof Error && err.name === 'TimeoutError'
        ? 'model_timeout'
        : 'network_error';
    log('error', 'anthropic_call_fetch_threw', {
      requestId,
      tool: 'classify_semantic_move',
      reason,
      duration_ms: duration,
      status: 'failure',
      errorClass: err instanceof Error ? err.name : 'unknown',
    });
    return { ok: false, reason };
  }

  const duration = Math.round(performance.now() - startMs);

  if (response.status === 429) {
    log('warn', 'anthropic_rate_limited', {
      requestId,
      tool: 'classify_semantic_move',
      httpStatus: 429,
      duration_ms: duration,
      status: 'failure',
      reason: 'rate_limited',
    });
    return { ok: false, reason: 'rate_limited' };
  }
  if (!response.ok) {
    log('error', 'anthropic_api_error', {
      requestId,
      tool: 'classify_semantic_move',
      httpStatus: response.status,
      duration_ms: duration,
      status: 'failure',
      reason: 'api_error',
    });
    // Drain body to free the connection — do NOT log it.
    try {
      await response.text();
    } catch {
      // ignore
    }
    return { ok: false, reason: 'api_error' };
  }

  let responseJson: unknown;
  try {
    responseJson = await response.json();
  } catch {
    log('error', 'anthropic_response_not_json', {
      requestId,
      tool: 'classify_semantic_move',
      reason: 'parse_failure',
      duration_ms: duration,
      status: 'failure',
    });
    return { ok: false, reason: 'parse_failure' };
  }
  const text = extractAnthropicContentText(responseJson);
  const parsed = parseJsonFromContent(text);
  if (parsed === null) {
    log('error', 'anthropic_parse_failure', {
      requestId,
      tool: 'classify_semantic_move',
      reason: 'parse_failure',
      duration_ms: duration,
      status: 'failure',
    });
    return { ok: false, reason: 'parse_failure' };
  }
  const responseHash = await sha256Hex(text ?? '');
  log('info', 'anthropic_call_success', {
    requestId,
    tool: 'classify_semantic_move',
    promptHash,
    responseHash,
    duration_ms: duration,
    status: 'success',
    httpStatus: response.status,
  });
  return { ok: true, packet: parsed };
}

/** Constants re-exported for tests / parity check. */
export {
  ANTHROPIC_API_URL,
  ANTHROPIC_API_VERSION,
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_MODEL_TIMEOUT_MS,
};
