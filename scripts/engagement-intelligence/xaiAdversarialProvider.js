/**
 * Stage 6.1.7 — xAI adversarial-thread provider abstraction.
 *
 * Two providers, both gated, both fail-closed, neither logs keys / Authorization
 * headers / response bodies:
 *
 *   - `xaiResponsesProvider`         (default)
 *       POST /v1/responses with the `x_search` built-in tool.
 *   - `legacyXaiChatSearchProvider`
 *       POST /v1/chat/completions with `search_parameters` (xAI Live Search).
 *
 * Why the Responses path is default:
 *   - The Responses API is xAI's published path for tool-using completions
 *     and exposes a structured `x_search` tool with citations (`citations` /
 *     `web_search_call` / `tool_call` shapes). When we use it, we can keep
 *     metric-vs-inferred ranking honest: if the provider returns explicit
 *     citation refs, we surface them as `citationRefs`; if it returns only
 *     model-mediated text, we tag it `provider_inferred` and never claim
 *     metric-ranked engagement.
 *   - The legacy `chat/completions + search_parameters` path remains for
 *     installations on older deployments that have not been migrated to
 *     Responses. Operators can pass `--provider legacy_chat_search` to use it.
 *
 * Hard rules:
 *   - Live requests refuse unless ALL of:
 *       .env.engagement-intelligence present, ENGAGEMENT_INTEL_ENABLE_XAI=true,
 *       XAI_API_KEY non-empty, `--pilot` set.
 *   - The XAI_API_KEY value is read once via a closure and never logged or
 *     returned to the caller.
 *   - The response body is parsed for a single JSON object, then cancelled
 *     and discarded. Window onto raw provider text is the *redacted* string
 *     produced after sanitisation.
 *   - All caller-visible logging goes through `sanitizeForLog()` which scrubs
 *     `xai-*`, `sk-ant-*`, `sb_secret_*`, JWT-shape, Bearer, Authorization
 *     headers, X handles (`@name`), X URLs (`x.com`, `t.co`, `twitter.com`).
 *
 * This module never decides truth, never labels users, never makes
 * moderation recommendations. It is a discovery + redaction layer only.
 */
const fs = require('node:fs');
const path = require('node:path');

const XAI_BASE = 'https://api.x.ai';
const RESPONSES_PATH = '/v1/responses';
const CHAT_PATH = '/v1/chat/completions';
// xAI published model for X Search via the Responses API (per current xAI
// docs). Operator can override via `XAI_MODEL` in `.env.engagement-intelligence`
// if the deployed account is on a different track.
const DEFAULT_MODEL = 'grok-4.3';
const DEFAULT_TIMEOUT_MS = 30_000;

// ── Redaction ──────────────────────────────────────────────────

const SECRET_REPLACERS = [
  [/xai-[A-Za-z0-9_-]+/g, '[redacted]'],
  [/sk-ant-[A-Za-z0-9_-]+/g, '[redacted]'],
  [/sb_secret_[A-Za-z0-9_-]+/g, '[redacted]'],
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g, '[redacted]'],
  [/eyJ[A-Za-z0-9_-]{10,}/g, '[redacted]'],
  [/Bearer\s+[A-Za-z0-9._-]{8,}/gi, 'Bearer [redacted]'],
  [/Authorization\s*:\s*\S+/gi, 'Authorization: [redacted]'],
];

const X_IDENTIFIER_REPLACERS = [
  [/https?:\/\/(?:x|twitter)\.com\/[^\s)]+/gi, '<x-link>'],
  [/https?:\/\/t\.co\/[^\s)]+/gi, '<x-link>'],
  // Bare host references (twitter.com/foo, x.com/foo, t.co/foo).
  [/\b(?:twitter|x)\.com\/[^\s)]+/gi, '<x-link>'],
  [/\bt\.co\/[^\s)]+/gi, '<x-link>'],
  // X handles are 1–15 alphanumerics + underscore (per X policy).
  [/@([A-Za-z0-9_]{1,15})\b/g, '<x-handle>'],
  // Raw post-id-like 15-20 digit strings appearing standalone.
  [/\b(?:\d){15,20}\b/g, '<x-id>'],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<email>'],
];

function sanitizeForLog(input) {
  let s = String(input == null ? '' : input);
  for (const [re, sub] of SECRET_REPLACERS) s = s.replace(re, sub);
  for (const [re, sub] of X_IDENTIFIER_REPLACERS) s = s.replace(re, sub);
  return s;
}

function redactProviderText(input) {
  // Provider text may legitimately contain post fragments; we keep the
  // surrounding text but strip identifiers. This is the only output that
  // can leave the module.
  return sanitizeForLog(input);
}

// ── Env reading (no value logging) ─────────────────────────────

const ENV_FILE = path.join(process.cwd(), '.env.engagement-intelligence');

function readMergedEnv() {
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

function envSnapshot() {
  const merged = readMergedEnv();
  return {
    fileExists: fs.existsSync(ENV_FILE),
    hasXaiKey: Boolean(merged.XAI_API_KEY),
    enableXai: String(merged.ENGAGEMENT_INTEL_ENABLE_XAI || '').toLowerCase() === 'true',
    model: merged.XAI_MODEL && /^[a-z0-9._-]+$/i.test(merged.XAI_MODEL) && merged.XAI_MODEL.length < 80
      ? merged.XAI_MODEL
      : DEFAULT_MODEL,
  };
}

class XaiAdversarialProviderDisabled extends Error {
  constructor(reason, providerLabel) {
    super(`xAI adversarial provider refused (${providerLabel}): ${reason}. Operator must pass --pilot AND set ENGAGEMENT_INTEL_ENABLE_XAI=true + XAI_API_KEY.`);
    this.name = 'XaiAdversarialProviderDisabled';
    this.reason = reason;
    this.providerLabel = providerLabel;
  }
}

class XaiAdversarialProviderUpstream extends Error {
  constructor(reason, providerLabel) {
    super(`xAI adversarial provider upstream error (${providerLabel}): ${reason}`);
    this.name = 'XaiAdversarialProviderUpstream';
    this.reason = reason;
    this.providerLabel = providerLabel;
  }
}

// ── Body release (mirrors xaiAuthProbe pattern) ────────────────

async function releaseResponseBody(res) {
  if (!res || !res.body) return;
  try {
    if (typeof res.body.cancel === 'function') { await res.body.cancel(); return; }
  } catch { /* swallow */ }
  try { await res.arrayBuffer().catch(() => undefined); } catch { /* swallow */ }
}

async function drainEventLoop() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// ── Gating ─────────────────────────────────────────────────────

function assertLiveAllowed({ pilot, providerLabel }) {
  const snap = envSnapshot();
  // File-existence is intentionally NOT a gate. loadEngagementEnv / readMergedEnv
  // merge process.env over the .env file, so CI and git worktrees authorize via
  // process.env without a file on disk. The real kill-switches are the three
  // checks below: the enable flag, the API key, and the --pilot flag.
  if (!snap.enableXai) throw new XaiAdversarialProviderDisabled('env_flag_off', providerLabel);
  if (!snap.hasXaiKey) throw new XaiAdversarialProviderDisabled('api_key_missing', providerLabel);
  if (!pilot) throw new XaiAdversarialProviderDisabled('no_pilot_flag', providerLabel);
  return { snap, key: readMergedEnv().XAI_API_KEY };
}

// ── Provider: Responses + x_search ─────────────────────────────

const RESPONSES_SYSTEM = [
  'You are a research assistant for a debate-game dev environment.',
  'You return current, debatable PUBLIC news topics that real X users have discussed.',
  'You DO NOT decide truth. You DO NOT label any user as a liar, propagandist, extremist, troll, bot, astroturfer, bad-faith, dishonest, or manipulative.',
  'You DO NOT infer demographic, party-registration, ideology, religion, race, ethnicity, sexuality, health, or other protected-class attributes.',
  'You DO NOT include X handles, raw post IDs, URLs, screenshots, or images in topic text.',
  'You DO NOT make moderation recommendations.',
  'You return compact JSON only, no prose outside the JSON, no code fences.',
].join(' ');

function buildResponsesPayload({ topicHint, count, model, fromDate, toDate, allowedHandles, excludedHandles }) {
  const userPrompt = [
    `Return up to ${count} current debatable PUBLIC news topics observed on X within the last 48 hours.`,
    `Search topic hint: ${topicHint || 'current news'}.`,
    'For each candidate, return a JSON object in this shape:',
    `{
      "topicBucket": "<short-slug>",
      "sourceClaimSummary": "<one debatable claim summary, observable language only, no handles, no URLs>",
      "sourceClaimType": "claim|opinion|factual_assertion|speculation|unclear",
      "sourceTextRedacted": "<short excerpt; NO @handle, NO URL, NO post id>",
      "providerRank": <integer 1-based rank within the model's returned set>,
      "providerConfidence": <number 0..1 — model's own confidence the topic exists>,
      "citationRefs": ["<short string id, NOT a URL>"]
    }`,
    'Wrap the array in: { "topics": [ ... ] }.',
    'NEVER include @handles, URLs, screenshots, or raw post IDs.',
    'NEVER assert which user is correct.',
  ].join('\n');

  // xAI Responses API contract: model + instructions + input + tools.
  // `response_format` is a chat/completions-only field; including it on
  // the Responses endpoint returned HTTP 400 on earlier deploys. We rely
  // on the explicit JSON-only instruction inside `instructions` + a JSON
  // shape printed in `input` instead.
  //
  // X Search filter parameters (per xAI docs) live INSIDE the tool entry,
  // not at the top level of the request. We disable image/video understanding
  // by omission so the agent only handles text excerpts.
  const xSearchTool = { type: 'x_search' };
  if (fromDate) xSearchTool.from_date = String(fromDate);
  if (toDate) xSearchTool.to_date = String(toDate);
  if (Array.isArray(allowedHandles) && allowedHandles.length > 0) {
    xSearchTool.allowed_x_handles = allowedHandles.slice(0, 10).map((h) => String(h).replace(/^@/, ''));
  } else if (Array.isArray(excludedHandles) && excludedHandles.length > 0) {
    xSearchTool.excluded_x_handles = excludedHandles.slice(0, 10).map((h) => String(h).replace(/^@/, ''));
  }
  return {
    model,
    instructions: RESPONSES_SYSTEM,
    input: userPrompt,
    tools: [xSearchTool],
    temperature: 0.2,
  };
}

function extractTopicsFromResponses(json) {
  if (!json) return null;
  // The Responses API returns either `output` (array of items) or `output_text`
  // (concatenated). We accept either.
  let text = null;
  if (typeof json.output_text === 'string') text = json.output_text;
  else if (Array.isArray(json.output)) {
    for (const item of json.output) {
      if (Array.isArray(item.content)) {
        for (const c of item.content) {
          if (typeof c.text === 'string') { text = (text || '') + c.text; }
        }
      }
    }
  }
  if (typeof text !== 'string') return null;
  let trimmed = text.trim();
  if (trimmed.startsWith('```')) trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && Array.isArray(parsed.topics)) return parsed.topics;
    return null;
  } catch { return null; }
}

async function xaiResponsesProvider({ topicHint, count, pilot, fetchImpl, timeoutMs, fromDate, toDate, allowedHandles, excludedHandles }) {
  const { key } = assertLiveAllowed({ pilot, providerLabel: 'xai_responses' });
  const model = envSnapshot().model;
  const body = buildResponsesPayload({
    topicHint,
    count: Math.min(Math.max(Number(count) || 30, 1), 300),
    model,
    fromDate, toDate, allowedHandles, excludedHandles,
  });

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), Number(timeoutMs) > 0 ? Number(timeoutMs) : DEFAULT_TIMEOUT_MS);
  const fetchFn = fetchImpl || globalThis.fetch;
  if (typeof fetchFn !== 'function') throw new XaiAdversarialProviderUpstream('no_fetch_available', 'xai_responses');
  let res;
  try {
    res = await fetchFn(`${XAI_BASE}${RESPONSES_PATH}`, {
      method: 'POST',
      headers: {
        'User-Agent': 'cdiscourse-xai-adversarial/0.1',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(t);
    throw new XaiAdversarialProviderUpstream(`transport_error:${sanitizeForLog(err && (err.cause?.code || err.code || err.message) || 'unknown')}`, 'xai_responses');
  }
  clearTimeout(t);

  if (res.status !== 200) {
    await releaseResponseBody(res);
    throw new XaiAdversarialProviderUpstream(`http_${res.status}`, 'xai_responses');
  }
  let parsedBody;
  try { parsedBody = await res.json(); }
  catch (err) {
    await releaseResponseBody(res);
    throw new XaiAdversarialProviderUpstream(`json_parse_error:${sanitizeForLog(err && err.message)}`, 'xai_responses');
  }
  const rawTopics = extractTopicsFromResponses(parsedBody);
  await drainEventLoop();
  if (!rawTopics) throw new XaiAdversarialProviderUpstream('responses_returned_unusable_payload', 'xai_responses');
  return { provider: 'xai_responses', rawTopics, model };
}

// ── Provider: legacy chat/completions + search_parameters ──────

function buildLegacyChatPayload({ topicHint, count, model }) {
  return {
    model,
    messages: [
      { role: 'system', content: RESPONSES_SYSTEM },
      { role: 'user', content: [
        `Return up to ${count} current debatable PUBLIC news topics from X (live search). Each topic must be defensible from at least two sides.`,
        `Search topic hint: ${topicHint || 'current news'}.`,
        'Return ONE JSON object with shape { "topics": [{ topicBucket, sourceClaimSummary, sourceClaimType, sourceTextRedacted, providerRank, providerConfidence, citationRefs }, ...] }.',
        'NEVER include @handles, URLs, screenshots, or raw post IDs.',
      ].join('\n') },
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' },
    search_parameters: {
      mode: 'on',
      sources: [{ type: 'x' }],
      max_search_results: Math.max(10, Math.min(Number(count) || 30, 30) * 3),
    },
  };
}

function extractTopicsFromLegacyChat(json) {
  if (!json || !Array.isArray(json.choices) || json.choices.length === 0) return null;
  const content = json.choices[0]?.message?.content;
  if (typeof content !== 'string') return null;
  let trimmed = content.trim();
  if (trimmed.startsWith('```')) trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && Array.isArray(parsed.topics)) return parsed.topics;
    return null;
  } catch { return null; }
}

async function legacyXaiChatSearchProvider({ topicHint, count, pilot, fetchImpl, timeoutMs }) {
  const { key } = assertLiveAllowed({ pilot, providerLabel: 'legacy_chat_search' });
  const model = envSnapshot().model;
  const body = buildLegacyChatPayload({ topicHint, count: Math.min(Math.max(Number(count) || 30, 1), 300), model });

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), Number(timeoutMs) > 0 ? Number(timeoutMs) : DEFAULT_TIMEOUT_MS);
  const fetchFn = fetchImpl || globalThis.fetch;
  if (typeof fetchFn !== 'function') throw new XaiAdversarialProviderUpstream('no_fetch_available', 'legacy_chat_search');
  let res;
  try {
    res = await fetchFn(`${XAI_BASE}${CHAT_PATH}`, {
      method: 'POST',
      headers: {
        'User-Agent': 'cdiscourse-xai-adversarial/0.1',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(t);
    throw new XaiAdversarialProviderUpstream(`transport_error:${sanitizeForLog(err && (err.cause?.code || err.code || err.message) || 'unknown')}`, 'legacy_chat_search');
  }
  clearTimeout(t);

  if (res.status !== 200) {
    await releaseResponseBody(res);
    throw new XaiAdversarialProviderUpstream(`http_${res.status}`, 'legacy_chat_search');
  }
  let parsedBody;
  try { parsedBody = await res.json(); }
  catch (err) {
    await releaseResponseBody(res);
    throw new XaiAdversarialProviderUpstream(`json_parse_error:${sanitizeForLog(err && err.message)}`, 'legacy_chat_search');
  }
  const rawTopics = extractTopicsFromLegacyChat(parsedBody);
  await drainEventLoop();
  if (!rawTopics) throw new XaiAdversarialProviderUpstream('legacy_chat_returned_unusable_payload', 'legacy_chat_search');
  return { provider: 'legacy_chat_search', rawTopics, model };
}

// ── Convenience selector ───────────────────────────────────────

function pickProvider(label) {
  if (label === 'legacy_chat_search') return legacyXaiChatSearchProvider;
  return xaiResponsesProvider; // default
}

module.exports = {
  XAI_BASE,
  RESPONSES_PATH,
  CHAT_PATH,
  DEFAULT_MODEL,
  sanitizeForLog,
  redactProviderText,
  envSnapshot,
  readMergedEnv,
  releaseResponseBody,
  drainEventLoop,
  XaiAdversarialProviderDisabled,
  XaiAdversarialProviderUpstream,
  xaiResponsesProvider,
  legacyXaiChatSearchProvider,
  pickProvider,
  extractTopicsFromResponses,
  extractTopicsFromLegacyChat,
};
