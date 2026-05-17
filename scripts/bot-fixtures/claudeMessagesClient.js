/**
 * Stage 6.1.5 — Anthropic Messages API adapter for AI-driven bot move bodies.
 *
 * Hard gates:
 *   - Refuses to issue any HTTP call unless ALL of these are true:
 *       * `.env.engagement-intelligence` exists
 *       * `ANTHROPIC_API_KEY` is set (in the env file or process.env)
 *       * `ENGAGEMENT_INTEL_ENABLE_ANTHROPIC=true`
 *       * the caller passes `--pilot` on the CLI (the caller verifies that;
 *         this module accepts an `enabled` flag from the orchestrator)
 *   - Hard cost cap: refuses to issue a call once `cumulativeTokenSpend`
 *     exceeds the configured budget (default 200,000 input + 60,000 output
 *     tokens — enough for ~50 rooms × 12 moves with caching).
 *   - Output is body text only; the caller validates length / language /
 *     concession marker / etc. before posting.
 *
 * Never logs `ANTHROPIC_API_KEY`, `Authorization` headers, or raw HTTP
 * bodies. Errors are sanitized before being returned.
 *
 * This is a Node-only CommonJS module — no React, no Supabase.
 */
const fs = require('node:fs');
const path = require('node:path');

const ANTHROPIC_BASE = 'https://api.anthropic.com';
const MESSAGES_ENDPOINT = '/v1/messages';
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_MAX_TOKENS = 360;

// Budget defaults sized for a 50-room annotated corpus run:
//   - 50 rooms × ~13 moves = ~650 generations + 650 annotations
//   - generation prompts are ~3k input tokens after prompt cache
//   - annotation prompts are ~4k input tokens
//   - generation output ≈ 60 tokens; annotation output ≈ 600 tokens
//   ⇒ projected input ~5M, projected output ~430k
//
// Earlier defaults (200k / 60k) were sized for one tiny pilot only; they
// silently tripped after ~60 generation calls in a 50-room run and made
// every subsequent annotation fall back to deterministic. The new ceilings
// give a 50-room run headroom while keeping a hard cap.
const DEFAULT_BUDGET = {
  maxInputTokens: 8_000_000,
  maxOutputTokens: 500_000,
};

const ENV_FILE = path.join(process.cwd(), '.env.engagement-intelligence');

function parseDotEnv(text) {
  const out = {};
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
}

function loadConfig() {
  const fileExists = fs.existsSync(ENV_FILE);
  const parsed = fileExists ? parseDotEnv(fs.readFileSync(ENV_FILE, 'utf8')) : {};
  const merged = { ...parsed, ...process.env };
  return {
    fileExists,
    hasAnthropicKey: Boolean(merged.ANTHROPIC_API_KEY && merged.ANTHROPIC_API_KEY.length > 0),
    enableAnthropic: String(merged.ENGAGEMENT_INTEL_ENABLE_ANTHROPIC || '').toLowerCase() === 'true',
    model: String(merged.ANTHROPIC_MODEL || DEFAULT_MODEL),
    // Internal-only: we read the key here but never return it from any
    // function. Callers receive a closure over it via `createClient`.
    _key: merged.ANTHROPIC_API_KEY || '',
  };
}

const AUTH_HEADER_SCRUB = /(authorization|x-api-key|x-auth-token)\s*[:=]\s*\S+/gi;
const KEY_LIKE_SCRUB = /sk-ant-[A-Za-z0-9_-]+/gi;
const BEARER_SCRUB = /Bearer\s+[A-Za-z0-9._-]+/gi;
const JWT_SCRUB = /eyJ[A-Za-z0-9_-]{10,}/g;

function sanitize(text) {
  let s = String(text || '');
  s = s.replace(KEY_LIKE_SCRUB, '[redacted]');
  s = s.replace(BEARER_SCRUB, 'Bearer [redacted]');
  s = s.replace(JWT_SCRUB, '[redacted]');
  s = s.replace(AUTH_HEADER_SCRUB, '$1: [redacted]');
  return s;
}

class AnthropicAdapterDisabledError extends Error {
  constructor(reason) {
    super(`Anthropic adapter disabled: ${reason}. Set ENGAGEMENT_INTEL_ENABLE_ANTHROPIC=true and ANTHROPIC_API_KEY to enable. Pass --pilot on the CLI.`);
    this.name = 'AnthropicAdapterDisabledError';
    this.reason = reason;
  }
}

class AnthropicBudgetExceededError extends Error {
  constructor(spent, budget) {
    super(`Anthropic budget exceeded — refusing further calls (spent ${JSON.stringify(spent)} / budget ${JSON.stringify(budget)}).`);
    this.name = 'AnthropicBudgetExceededError';
    this.spent = spent;
    this.budget = budget;
  }
}

/**
 * Build a client closure. The closure owns the API key; callers receive only
 * a `generate(input)` method. No path through the public API returns the
 * key or includes it in any logged error.
 */
function createClient(options = {}) {
  const cfg = loadConfig();
  if (!cfg.fileExists) throw new AnthropicAdapterDisabledError('env_file_missing');
  if (!cfg.enableAnthropic) throw new AnthropicAdapterDisabledError('env_flag_off');
  if (!cfg.hasAnthropicKey) throw new AnthropicAdapterDisabledError('api_key_missing');
  if (options.requirePilotFlag && !options.pilot) throw new AnthropicAdapterDisabledError('no_pilot_flag');

  const budget = { ...DEFAULT_BUDGET, ...(options.budget || {}) };
  const spent = { inputTokens: 0, outputTokens: 0, calls: 0 };
  const model = options.model || cfg.model;
  const key = cfg._key;

  /**
   * Issue ONE Messages API call. Returns sanitized text only.
   *
   * Inputs:
   *  - `systemPrompt`: the cached system text (persona + skill rules).
   *  - `userPayload`: structured user-content blocks (conversation context).
   *  - `maxTokens`: per-call output cap.
   */
  async function generate(input) {
    if (!input || typeof input !== 'object') throw new Error('generate(): missing input');
    const { systemPrompt, userPayload, maxTokens } = input;
    if (!systemPrompt) throw new Error('generate(): systemPrompt required');
    if (!userPayload) throw new Error('generate(): userPayload required');

    const requestedMax = Math.min(maxTokens || DEFAULT_MAX_TOKENS, 1024);
    // Pre-flight budget check (BOTH output projection and accumulated input).
    // Refusing before the HTTP call is sent avoids burning spend on a call
    // whose result we will reject. The earlier post-flight check left
    // every "over budget" call's response stranded — that's how the 50-room
    // run silently fell back to deterministic on every annotation.
    if (spent.outputTokens + requestedMax > budget.maxOutputTokens) {
      throw new AnthropicBudgetExceededError({ ...spent }, { ...budget });
    }
    if (spent.inputTokens > budget.maxInputTokens) {
      throw new AnthropicBudgetExceededError({ ...spent }, { ...budget });
    }

    const body = {
      model,
      max_tokens: requestedMax,
      system: [{
        type: 'text',
        text: String(systemPrompt),
        // Prompt cache lets us reuse the persona/system text across the
        // ~12 turns of one room AND across rooms in the same run.
        cache_control: { type: 'ephemeral' },
      }],
      messages: [{ role: 'user', content: String(userPayload) }],
      temperature: typeof input.temperature === 'number' ? input.temperature : 0.7,
    };

    const controller = new AbortController();
    const timeoutMs = options.timeoutMs || 20000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${ANTHROPIC_BASE}${MESSAGES_ENDPOINT}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'prompt-caching-2024-07-31',
          'user-agent': 'cdiscourse-bot-fixtures/0.1 (dev-test)',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const raw = await res.text().catch(() => '');
        throw new Error(sanitize(`anthropic_http_${res.status}; preview=${raw.slice(0, 200)}`));
      }
      const parsed = await res.json();
      const text = Array.isArray(parsed?.content)
        ? parsed.content.filter((c) => c.type === 'text').map((c) => c.text).join('').trim()
        : '';
      // Accounting. The Messages API returns `usage` with input/output token counts.
      const u = parsed?.usage || {};
      const inputTokens = Number(u.input_tokens || 0);
      const outputTokens = Number(u.output_tokens || 0);
      const cacheReadTokens = Number(u.cache_read_input_tokens || 0);
      const cacheCreationTokens = Number(u.cache_creation_input_tokens || 0);
      // Cached reads are heavily discounted but we count fresh input + creation
      // against the budget; cache reads are tracked separately for visibility.
      spent.inputTokens += inputTokens + cacheCreationTokens;
      spent.outputTokens += outputTokens;
      spent.calls += 1;
      // Post-flight check removed in Stage 6.1.7 follow-up — replaced by the
      // pre-flight check above so we never burn an HTTP call whose result we
      // will reject. (Earlier the post-flight throw was silently swallowed by
      // the annotator's catch block, leaving 100% deterministic fallback
      // across a 50-room corpus.)
      return {
        text: sanitize(text),
        usage: { inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens },
        modelEcho: parsed?.model || model,
      };
    } catch (err) {
      throw new Error(sanitize(err && err.message ? err.message : String(err)));
    } finally {
      clearTimeout(timer);
    }
  }

  function snapshotUsage() { return { ...spent, budget: { ...budget }, model }; }

  return { generate, snapshotUsage };
}

module.exports = {
  createClient,
  loadConfig,
  parseDotEnv,
  sanitize,
  AnthropicAdapterDisabledError,
  AnthropicBudgetExceededError,
  ANTHROPIC_BASE,
  MESSAGES_ENDPOINT,
  DEFAULT_MODEL,
};
