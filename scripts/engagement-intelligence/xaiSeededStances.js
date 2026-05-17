/**
 * Stage 6.1.5 / 6.1.5.2 — xAI X Search position seeder.
 *
 * Returns topic seeds (same shape as `topicBank.json` entries) sourced from
 * live xAI X Search **or** from a local synthetic seed file. Live calls are
 * fail-closed: the loader refuses unless the operator has explicitly opted
 * in (`ENGAGEMENT_INTEL_ENABLE_XAI=true` AND the caller passes `--pilot`).
 *
 * The synthetic path is the default and never touches the network.
 *
 * Note: this module does NOT call xAI to *classify* anything. It uses xAI's
 * official chat/completions endpoint with `search_parameters` (xAI's Live
 * Search feature) to surface real public news-topic stances that the
 * AI-driven bot fixture can then defend / challenge in dev/test scenarios.
 *
 * Safety:
 *   - No XAI_API_KEY, Bearer token, or Authorization header is ever logged.
 *   - The response body is parsed for a single JSON object then discarded.
 *   - All returned topic text is run through the redactor before it leaves
 *     this module (no raw X handles, URLs, JWTs, or secret-shape tokens).
 *   - No demographic / party / protected-trait inference is requested.
 *   - The prompt asks for issue stances that are debatable — never for
 *     verdicts about any user, account, or group.
 *   - One xAI call per `loadXaiSeedsLive(N)` invocation. Hard timeout.
 */
const fs = require('node:fs');
const path = require('node:path');
const { loadEngagementEnv, snapshotForLog } = require('./loadEngagementEnv');

const XAI_BASE = 'https://api.x.ai';
const CHAT_PATH = '/v1/chat/completions';
const DEFAULT_MODEL = 'grok-4-latest';
const DEFAULT_TIMEOUT_MS = 30000;

const SECRET_REDACTERS = [
  [/xai-[A-Za-z0-9_-]+/g, '[redacted]'],
  [/sk-ant-[A-Za-z0-9_-]+/g, '[redacted]'],
  [/sb_secret_[A-Za-z0-9_-]+/g, '[redacted]'],
  [/eyJ[A-Za-z0-9_-]{10,}/g, '[redacted]'],
  [/Bearer\s+[A-Za-z0-9._-]{8,}/gi, 'Bearer [redacted]'],
  [/Authorization\s*:\s*\S+/gi, 'Authorization: [redacted]'],
  // Strip raw X URLs and handles to keep redacted text out of committed
  // fixtures. Topic body text itself is preserved.
  [/https?:\/\/(?:x|twitter)\.com\/\S+/gi, '<x-link>'],
  [/https?:\/\/t\.co\/\S+/gi, '<x-link>'],
  [/@[A-Za-z0-9_]{2,15}/g, '<x-handle>'],
];

function redactSeedText(s) {
  let out = String(s || '');
  for (const [re, sub] of SECRET_REDACTERS) out = out.replace(re, sub);
  return out;
}

const SYNTHETIC_SEEDS_PATH = path.join(
  process.cwd(),
  'fixtures',
  'engagement-intelligence',
  'synthetic-xai-seeded-stances.json',
);

class XaiSeedDisabledError extends Error {
  constructor(reason) {
    super(`xAI seed source disabled: ${reason}. Set ENGAGEMENT_INTEL_ENABLE_XAI=true + XAI_API_KEY and pass --pilot to enable.`);
    this.name = 'XaiSeedDisabledError';
    this.reason = reason;
  }
}

function readSyntheticSeeds() {
  if (!fs.existsSync(SYNTHETIC_SEEDS_PATH)) return [];
  const parsed = JSON.parse(fs.readFileSync(SYNTHETIC_SEEDS_PATH, 'utf8'));
  return Array.isArray(parsed?.topics) ? parsed.topics : [];
}

/**
 * Synthetic source — returns N topic seeds shaped like topicBank entries.
 */
function loadSyntheticSeeds(count) {
  const seeds = readSyntheticSeeds();
  if (seeds.length === 0) throw new Error('Synthetic seeds file is empty or missing.');
  return seeds.slice(0, Math.max(1, Math.min(count || seeds.length, seeds.length)));
}

function buildSeederSystemPrompt() {
  return [
    'You are a research assistant for a debate-game dev environment.',
    'Return a list of CURRENT, debatable news topics as JSON ONLY.',
    'Each topic must be defensible from at least two sides.',
    'You may identify the issue family / political frame as context, but you do NOT label any account, user, or group as a liar, propagandist, extremist, troll, bot, astroturfer, bad-faith, dishonest, or manipulative.',
    'You do NOT infer demographic, party-registration, ideology, religion, race, ethnicity, sexuality, health, or other protected-class attributes.',
    'You do NOT make truth verdicts. You return topics, not conclusions.',
    'You do NOT include X handles, URLs, or any image data in the topic text.',
    'You return compact JSON only, no prose outside the JSON, no code fences.',
  ].join(' ');
}

function buildSeederUserPrompt(count, query) {
  return [
    `Return ${count} current debatable news-topic stances from public posts on X. Use the live search feature.`,
    `Search topic hint: ${query || 'current news'}.`,
    'For each topic, return one debatable RESOLUTION statement that a debate room could form around (a statement the affirmative side could support and the negative side could oppose, with evidence available on either side).',
    'Return ONE JSON object with this exact shape:',
    `{
  "topics": [
    {
      "topicId": "ai-seed-<short-slug>",
      "title": "<short title, no handles, no URLs>",
      "resolution": "<one debatable resolution statement>",
      "resolutionKeywords": ["...", "..."],
      "thesisFraming": "<2-3 sentences framing the affirmative side, observable language only>",
      "counterClaims": ["<negative-side claim 1>", "<negative-side claim 2>"],
      "evidenceFacts": [
        { "label": "<short label>", "sourceText": "<one observable fact or quoted excerpt; NO URL, NO handle>" }
      ],
      "scopeNarrowings": ["<narrower scope option>", "<narrower scope option>"],
      "tangentHooks": ["<adjacent topic for branch threads — separate thread>"]
    }
  ]
}`,
    'NEVER include X handles (no "@name"), URLs, or screenshots in any field.',
    'NEVER label any user / group / account.',
    'NEVER pre-decide who is correct.',
  ].join('\n');
}

/**
 * Drain the response body so undici closes the underlying socket before we
 * return. Mirrors the xaiAuthProbe.releaseResponseBody pattern.
 */
async function releaseResponseBody(res) {
  if (!res || !res.body) return;
  try {
    if (typeof res.body.cancel === 'function') {
      await res.body.cancel();
      return;
    }
  } catch { /* fall through */ }
  try { await res.arrayBuffer().catch(() => undefined); } catch { /* swallow */ }
}

function sanitizeError(err) {
  const raw = err && (err.cause?.code || err.code || err.message) || 'unknown_error';
  return redactSeedText(String(raw)).slice(0, 240);
}

/**
 * Pull `topics` from a parsed xAI chat-completions response. xAI returns
 * `{ choices: [{ message: { content: "<string>" } }] }`. We expect the
 * content to be a JSON object with a `topics` array.
 */
function extractTopicsFromXaiResponse(json) {
  if (!json || !Array.isArray(json.choices) || json.choices.length === 0) return null;
  const content = json.choices[0]?.message?.content;
  if (typeof content !== 'string') return null;
  let trimmed = content.trim();
  if (trimmed.startsWith('```')) trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  let parsed;
  try { parsed = JSON.parse(trimmed); } catch { return null; }
  if (!parsed || !Array.isArray(parsed.topics)) return null;
  return parsed.topics;
}

function sanitizeSeed(t) {
  if (!t || typeof t !== 'object') return null;
  const evidenceFacts = Array.isArray(t.evidenceFacts) ? t.evidenceFacts.map((e) => ({
    label: redactSeedText(e?.label || '').slice(0, 120),
    sourceText: redactSeedText(e?.sourceText || '').slice(0, 600),
  })).filter((e) => e.label || e.sourceText) : [];
  const scopeNarrowings = Array.isArray(t.scopeNarrowings) ? t.scopeNarrowings.map((s) => redactSeedText(s).slice(0, 200)).filter(Boolean) : [];
  const tangentHooks = Array.isArray(t.tangentHooks) ? t.tangentHooks.map((s) => redactSeedText(s).slice(0, 240)).filter(Boolean) : [];
  const counterClaims = Array.isArray(t.counterClaims) ? t.counterClaims.map((s) => redactSeedText(s).slice(0, 280)).filter(Boolean) : [];
  const resolutionKeywords = Array.isArray(t.resolutionKeywords) ? t.resolutionKeywords.map((s) => redactSeedText(String(s)).slice(0, 40)).filter(Boolean).slice(0, 8) : [];
  const topicId = typeof t.topicId === 'string' && t.topicId ? redactSeedText(t.topicId).replace(/[^a-z0-9-]/gi, '-').slice(0, 80) : null;
  const title = redactSeedText(t.title || '').slice(0, 160);
  const resolution = redactSeedText(t.resolution || '').slice(0, 280);
  const thesisFraming = redactSeedText(t.thesisFraming || '').slice(0, 600);
  if (!topicId || !title || !resolution) return null;
  return {
    topicId, title, resolution, resolutionKeywords, thesisFraming,
    counterClaims, evidenceFacts, scopeNarrowings, tangentHooks,
  };
}

/**
 * Live xAI X Search path. Calls `POST /v1/chat/completions` with the
 * `search_parameters` Live Search feature. Returns up to `count` topic
 * seeds. NOT executed by tests — tests mock `globalThis.fetch`.
 *
 * Live calls require ALL of:
 *   - .env.engagement-intelligence file present
 *   - ENGAGEMENT_INTEL_ENABLE_XAI=true
 *   - XAI_API_KEY non-empty
 *   - opts.pilot === true
 *
 * Returns: Array<topicSeed>. On parse failure or empty topics: throws
 * XaiSeedDisabledError('xai_returned_unusable_payload'). Network errors
 * throw XaiSeedDisabledError('xai_transport_error:<sanitized>').
 */
async function loadXaiSeedsLive(count, opts) {
  const env = loadEngagementEnv();
  if (!env.fileExists) throw new XaiSeedDisabledError('env_file_missing');
  if (!env.enableXai) throw new XaiSeedDisabledError('env_flag_off');
  if (!env.hasXaiKey) throw new XaiSeedDisabledError('api_key_missing');
  if (!opts || !opts.pilot) throw new XaiSeedDisabledError('no_pilot_flag');

  // Read the key locally; never log it. The merged env (file + process.env)
  // is used so the same precedence as xaiAuthProbe applies.
  const merged = readMergedEnv();
  const key = merged.XAI_API_KEY;
  if (!key) throw new XaiSeedDisabledError('api_key_missing');
  const model = (merged.XAI_MODEL && /^[a-z0-9._-]+$/i.test(merged.XAI_MODEL) && merged.XAI_MODEL.length < 80) ? merged.XAI_MODEL : DEFAULT_MODEL;
  const query = merged.ENGAGEMENT_INTEL_NEWS_QUERY || env.newsQuery || 'current news';
  const safeCount = Math.max(1, Math.min(Number(count) || 8, 20));

  const body = {
    model,
    messages: [
      { role: 'system', content: buildSeederSystemPrompt() },
      { role: 'user', content: buildSeederUserPrompt(safeCount, query) },
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' },
    search_parameters: {
      mode: 'on',
      sources: [{ type: 'x' }],
      max_search_results: Math.max(10, safeCount * 3),
    },
  };

  const controller = new AbortController();
  const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new XaiSeedDisabledError('no_fetch_available');

  let res;
  try {
    res = await fetchImpl(`${XAI_BASE}${CHAT_PATH}`, {
      method: 'POST',
      headers: {
        'User-Agent': 'cdiscourse-xai-seeder/0.1',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    throw new XaiSeedDisabledError(`xai_transport_error:${sanitizeError(err)}`);
  }
  clearTimeout(timer);

  const status = res.status;
  if (status !== 200) {
    await releaseResponseBody(res);
    if (status === 401 || status === 403) throw new XaiSeedDisabledError(`xai_auth_failed_${status}`);
    if (status === 429) throw new XaiSeedDisabledError('xai_rate_limited_429');
    if (status >= 500) throw new XaiSeedDisabledError(`xai_upstream_${status}`);
    throw new XaiSeedDisabledError(`xai_unexpected_status_${status}`);
  }

  // Parse the body, then release. Body content is the parsed JSON only; we
  // discard the raw text after parse to keep nothing on the heap.
  let parsedBody;
  try {
    parsedBody = await res.json();
  } catch (err) {
    await releaseResponseBody(res);
    throw new XaiSeedDisabledError(`xai_json_parse_error:${sanitizeError(err)}`);
  }

  const rawTopics = extractTopicsFromXaiResponse(parsedBody);
  if (!rawTopics) throw new XaiSeedDisabledError('xai_returned_unusable_payload');
  const sanitized = rawTopics.map(sanitizeSeed).filter(Boolean).slice(0, safeCount);
  if (sanitized.length === 0) throw new XaiSeedDisabledError('xai_returned_no_seeds_after_sanitize');
  return sanitized;
}

function readMergedEnv() {
  const ENV_FILE = path.join(process.cwd(), '.env.engagement-intelligence');
  let parsed = {};
  if (fs.existsSync(ENV_FILE)) {
    for (const raw of String(fs.readFileSync(ENV_FILE, 'utf8') || '').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      let v = line.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      parsed[line.slice(0, eq).trim()] = v;
    }
  }
  return { ...parsed, ...process.env };
}

/**
 * Top-level seed loader used by the AI-driven corpus runner.
 *
 * `mode`:
 *   - `synthetic` (default) — reads `fixtures/engagement-intelligence/synthetic-xai-seeded-stances.json`.
 *   - `xai_live` — calls the live xAI seeder (gated; refuses without env+--pilot).
 *   - `both` — synthetic first; if pilot is also enabled, the live results
 *     are appended after the synthetic ones (capped at `count`).
 */
async function loadSeeds(opts = {}) {
  const mode = opts.mode || 'synthetic';
  const count = Number.isFinite(opts.count) && opts.count > 0 ? opts.count : 8;
  if (mode === 'synthetic') return loadSyntheticSeeds(count);
  if (mode === 'xai_live') return loadXaiSeedsLive(count, opts);
  if (mode === 'both') {
    const a = loadSyntheticSeeds(Math.ceil(count / 2));
    if (!opts.pilot) return a; // synthetic only when not in pilot
    try {
      const b = await loadXaiSeedsLive(Math.ceil(count / 2), opts);
      return a.concat(b).slice(0, count);
    } catch (err) {
      // Live path disabled — return synthetic only with a note.
      return a;
    }
  }
  return loadSyntheticSeeds(count);
}

module.exports = {
  loadSeeds,
  loadSyntheticSeeds,
  loadXaiSeedsLive,
  XaiSeedDisabledError,
  SYNTHETIC_SEEDS_PATH,
  XAI_BASE,
  CHAT_PATH,
  redactSeedText,
  sanitizeSeed,
  extractTopicsFromXaiResponse,
  buildSeederSystemPrompt,
  buildSeederUserPrompt,
  releaseResponseBody,
  snapshotForLog,
};
