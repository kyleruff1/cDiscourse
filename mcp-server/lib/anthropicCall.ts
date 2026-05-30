/**
 * MCP-SERVER-002 — Shared Anthropic call skeleton.
 *
 * Extracted from `anthropic.ts` (semantic-move-specific) so both the
 * semantic-move tool and the Family A boolean classifier share the
 * same HTTP / timeout / fetch / status-code-mapping / response-parsing
 * code. ADDITIVE refactor — semantic-move's public exports in
 * anthropic.ts (`runAnthropicSemanticReferee`, the 4 named constants,
 * `extractAnthropicContentText`, `parseJsonFromContent`) stay byte-equal
 * for the caller; only the internal call structure now routes through
 * `callAnthropic` here.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §6 (secrets policy) — ANTHROPIC_API_KEY reaches
 *     network via x-api-key header; never logged; never returned in any
 *     response body. The sanitizer scrubs the Authorization variant
 *     elsewhere as defence-in-depth.
 *   - cdiscourse-doctrine §7 — this module is server-side Deno only.
 *
 * Timeout discipline:
 *   - Per-call timeout via `MCP_SERVER_MODEL_TIMEOUT_MS` env (default 25_000ms)
 *   - Per-tool timeout via the request's timeoutMs (caller-controlled)
 *   - Effective timeout = min(per-call, per-tool)
 *   - AbortSignal.timeout(effectiveMs) used for the fetch
 */
import { log, sha256Hex } from './logging.ts';
import { providerConcurrencyGate } from './providerConcurrency.ts';

export const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_API_VERSION = '2023-06-01';
export const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5';
export const DEFAULT_MODEL_TIMEOUT_MS = 25_000;

export type AnthropicFailureReason =
  | 'key_missing'
  | 'model_timeout'
  | 'api_error'
  | 'rate_limited'
  | 'network_error'
  | 'parse_failure';

export interface AnthropicCallSuccess {
  ok: true;
  /** The parsed packet object (still needs schema validation by the caller). */
  packet: Record<string, unknown>;
}

export interface AnthropicCallFailure {
  ok: false;
  reason: AnthropicFailureReason;
  detail?: string;
}

export type AnthropicCallResult = AnthropicCallSuccess | AnthropicCallFailure;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Extract the first `content[].type === 'text'` text out of an Anthropic
 * Messages API response. Mirror of the upstream helper.
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
 * Parse and extract the first `{...}` object from a response text.
 * Returns the parsed value or null.
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

export function readEnvTimeoutMs(): number {
  const raw = Deno.env.get('MCP_SERVER_MODEL_TIMEOUT_MS');
  if (!raw) return DEFAULT_MODEL_TIMEOUT_MS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MODEL_TIMEOUT_MS;
  return parsed;
}

export function readEnvModel(): string {
  const raw = Deno.env.get('ANTHROPIC_MODEL');
  if (typeof raw === 'string' && raw.length > 0) return raw;
  return DEFAULT_ANTHROPIC_MODEL;
}

/**
 * Compute the effective timeout from (env, request-supplied). Returns the
 * smaller of the two. The request's per-tool timeoutMs is caller-controlled
 * and should already be in [1, 60000]; the env default is 25000ms.
 */
export function effectiveTimeoutMs(perToolTimeoutMs: number | undefined): number {
  const envMs = readEnvTimeoutMs();
  if (perToolTimeoutMs === undefined || perToolTimeoutMs <= 0) return envMs;
  return Math.min(envMs, perToolTimeoutMs);
}

export interface CallAnthropicOpts {
  /** System prompt — full text. */
  system: string;
  /** User prompt — full text. */
  userPrompt: string;
  /** MAX_TOKENS for the model response. */
  maxTokens: number;
  /** TEMPERATURE for the model response (0 for deterministic). */
  temperature: number;
  /** Tool name used in log tags ('classify_semantic_move' or 'classify_argument_boolean_observations'). */
  toolNameForLogging: string;
  /** Correlation id propagated through logs. */
  requestId: string;
  /** Per-tool timeout in ms; effective timeout = min(env, this). */
  perToolTimeoutMs?: number;
  /** Override for unit tests. */
  fetchImpl?: typeof fetch;
}

/**
 * Generic Anthropic Messages-API caller. Returns the parsed JSON object
 * the model produced, or a typed failure reason.
 *
 *   - Reads ANTHROPIC_API_KEY from Deno.env; returns key_missing if absent.
 *   - Reads ANTHROPIC_MODEL override from env; defaults to claude-haiku-4-5.
 *   - Uses min(env timeout, per-tool timeout) as the AbortSignal duration.
 *   - Logs anthropic_call_start + anthropic_call_success + the failure-path
 *     events. NEVER logs the API key, x-api-key header, Authorization
 *     header, or response body.
 *   - Drains the response body on non-OK status to free the connection
 *     WITHOUT logging.
 */
export async function callAnthropic(opts: CallAnthropicOpts): Promise<AnthropicCallResult> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey || apiKey.length === 0) {
    log('warn', 'anthropic_key_missing', {
      requestId: opts.requestId,
      tool: opts.toolNameForLogging,
      reason: 'key_missing',
      status: 'failure',
    });
    return { ok: false, reason: 'key_missing' };
  }
  const model = readEnvModel();
  const timeoutMs = effectiveTimeoutMs(opts.perToolTimeoutMs);
  const body = {
    model,
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
    system: opts.system,
    messages: [{ role: 'user', content: opts.userPrompt }],
  };

  const promptHash = await sha256Hex(opts.userPrompt);
  log('info', 'anthropic_call_start', {
    requestId: opts.requestId,
    tool: opts.toolNameForLogging,
    promptHash,
    protocolVersion: undefined,
  });

  const startMs = performance.now();
  const fetchImpl = opts.fetchImpl ?? fetch;

  // PER-ISOLATE provider-concurrency cap (OPS-MCP-SERVER-CAPACITY-INVESTIGATION).
  // Acquire AFTER the key check (a missing key must not consume a slot) and
  // BEFORE the fetch (the slot must cover the actual provider round-trip).
  // Released in `finally` AFTER the body is consumed or drained on EVERY path
  // (success, 429, !ok, fetch-throw/timeout, json-throw, parse-null) via the
  // idempotent ReleaseFn. This is a per-isolate cap, NOT a global cap.
  const release = await providerConcurrencyGate.acquire();
  try {
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
      const reason: AnthropicFailureReason = err instanceof Error && err.name === 'TimeoutError'
        ? 'model_timeout'
        : 'network_error';
      log('error', 'anthropic_call_fetch_threw', {
        requestId: opts.requestId,
        tool: opts.toolNameForLogging,
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
        requestId: opts.requestId,
        tool: opts.toolNameForLogging,
        httpStatus: 429,
        duration_ms: duration,
        status: 'failure',
        reason: 'rate_limited',
      });
      // Drain body to free the connection — do NOT log it.
      try {
        await response.text();
      } catch {
        // ignore
      }
      return { ok: false, reason: 'rate_limited' };
    }
    if (!response.ok) {
      log('error', 'anthropic_api_error', {
        requestId: opts.requestId,
        tool: opts.toolNameForLogging,
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
        requestId: opts.requestId,
        tool: opts.toolNameForLogging,
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
        requestId: opts.requestId,
        tool: opts.toolNameForLogging,
        reason: 'parse_failure',
        duration_ms: duration,
        status: 'failure',
      });
      return { ok: false, reason: 'parse_failure' };
    }
    const responseHash = await sha256Hex(text ?? '');
    log('info', 'anthropic_call_success', {
      requestId: opts.requestId,
      tool: opts.toolNameForLogging,
      promptHash,
      responseHash,
      duration_ms: duration,
      status: 'success',
      httpStatus: response.status,
    });
    return { ok: true, packet: parsed };
  } finally {
    release();
  }
}
