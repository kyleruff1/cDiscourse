/**
 * MCP-SERVER-001 — Structured logger.
 *
 * Doctrine:
 *   - NEVER log Authorization header, bearer tokens (full or partial), Anthropic
 *     API keys (full or partial), raw prompt text, raw model response text,
 *     argument body text, or upstream user identifiers.
 *   - Prompt/response SHA-256 hashes are acceptable when debugging is needed.
 *
 * Single console.log emission per line so Deno Deploy captures it as a
 * structured log entry.
 */
export type LogLevel = 'info' | 'warn' | 'error';

export interface LogFields {
  requestId?: string;
  tool?: string;
  endpoint?: string;
  duration_ms?: number;
  status?: 'success' | 'failure' | 'timeout' | 'rejected';
  errorClass?: string;
  httpStatus?: number;
  promptHash?: string;
  responseHash?: string;
  protocolVersion?: string;
  reason?: string;
  method?: string;
  [key: string]: unknown;
}

/**
 * Substring patterns that, if found anywhere in a value, indicate a leak.
 * The logger refuses to emit fields containing any of these patterns and
 * substitutes the literal '[REDACTED]'.
 */
const SECRET_SUBSTRING_PATTERNS: readonly RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]+/i, // Anthropic API key
  /\bBearer\s+[A-Za-z0-9._-]+/i, // Bearer prefix + token
  /\beyJ[A-Za-z0-9._-]{20,}/, // JWT-ish
];

const FORBIDDEN_FIELD_KEYS: ReadonlySet<string> = new Set([
  'authorization',
  'authorizationHeader',
  'auth',
  'bearer',
  'bearerToken',
  'apiKey',
  'apikey',
  'anthropicApiKey',
  'anthropicKey',
  'token',
  'rawPrompt',
  'prompt',
  'promptText',
  'rawResponse',
  'responseText',
  'argumentBody',
  'moveBody',
  'parentBody',
  'roomBody',
  'userId',
  'caller',
  'callerUserId',
]);

function isSecretLeak(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  for (const re of SECRET_SUBSTRING_PATTERNS) {
    if (re.test(value)) return true;
  }
  return false;
}

function scrubFields(fields: LogFields): Record<string, unknown> {
  const scrubbed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (FORBIDDEN_FIELD_KEYS.has(key)) {
      scrubbed[key] = '[REDACTED]';
      continue;
    }
    if (isSecretLeak(value)) {
      scrubbed[key] = '[REDACTED]';
      continue;
    }
    scrubbed[key] = value;
  }
  return scrubbed;
}

let logSink: (line: string) => void = (line) => {
  // Intentional: Deno Deploy captures stdout as structured log entries.
  // eslint-disable-next-line no-console
  console.log(line);
};

/** Test-only — replace the sink to capture log lines in unit tests. */
export function _setLogSinkForTesting(sink: (line: string) => void): void {
  logSink = sink;
}

/** Test-only — restore default sink. */
export function _resetLogSinkForTesting(): void {
  logSink = (line) => {
    // eslint-disable-next-line no-console
    console.log(line);
  };
}

export function log(level: LogLevel, event: string, fields: LogFields = {}): void {
  const scrubbed = scrubFields(fields);
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...scrubbed,
  });
  logSink(line);
}

/**
 * SHA-256 hex digest helper for prompt/response hashing in logs. Returns the
 * empty string on any input that cannot be hashed (the caller decides whether
 * to log the field at all).
 */
export async function sha256Hex(input: string): Promise<string> {
  try {
    const enc = new TextEncoder().encode(input);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    const bytes = new Uint8Array(buf);
    let hex = '';
    for (const b of bytes) hex += b.toString(16).padStart(2, '0');
    return hex;
  } catch {
    return '';
  }
}

export function generateRequestId(): string {
  // crypto.randomUUID is available in Deno and modern browsers/Node.
  try {
    return crypto.randomUUID();
  } catch {
    // Fallback — extremely unlikely in Deno but keeps the function total.
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
    let hex = '';
    for (const b of bytes) hex += b.toString(16).padStart(2, '0');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  }
}
