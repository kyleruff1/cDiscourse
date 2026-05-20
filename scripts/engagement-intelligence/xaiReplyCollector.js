/**
 * Stage 6.1.7 — xAI reply collector.
 *
 * For each selected source post, ask xAI's Responses API + x_search tool to
 * return up to N (default 12) public reply candidates. Output is fully
 * redacted; no @handles, URLs, raw IDs, or secrets leave the module.
 *
 * Honest ranking: if the provider cannot supply official engagement
 * metrics, `topReplyMethod = 'provider_inferred'` and `providerRank` is
 * the model's own ordering. If it does supply metrics,
 * `topReplyMethod = 'metric_ranked'`.
 *
 * Never decides truth. Never labels users. Never assigns demographic /
 * party / protected-trait inference.
 */
const { createHash } = require('node:crypto');
const {
  XAI_BASE,
  RESPONSES_PATH,
  CHAT_PATH,
  sanitizeForLog,
  redactProviderText,
  releaseResponseBody,
  drainEventLoop,
  envSnapshot,
  readMergedEnv,
  XaiAdversarialProviderDisabled,
  XaiAdversarialProviderUpstream,
} = require('./xaiAdversarialProvider');

const DEFAULT_TIMEOUT_MS = 30_000;

const REPLY_SYSTEM = [
  'You are a research assistant for a debate-game dev environment.',
  'You return public reply-style responses observed against a given source post on X.',
  'You DO NOT decide truth. You DO NOT make moderation recommendations.',
  'You DO NOT label any user as liar, propagandist, extremist, troll, bot, astroturfer, bad-faith, dishonest, or manipulative.',
  'You DO NOT infer demographic, party-registration, ideology, religion, race, ethnicity, sexuality, health, or protected-class attributes.',
  'You DO NOT include X handles, raw post IDs, URLs, screenshots, or images in the reply text.',
  'You return compact JSON only, no prose outside the JSON, no code fences.',
].join(' ');

function shortHash(text, salt) {
  return createHash('sha256').update(`${salt || ''}::${String(text || '')}`).digest('hex').slice(0, 16);
}

function buildResponsesReplyPayload({ source, count, model }) {
  const userPrompt = [
    'Source claim (text already redacted of handles and URLs):',
    `  topicBucket: ${source.topicBucket}`,
    `  sourceClaimSummary: ${source.sourceClaimSummary}`,
    `  sourceTextRedacted: ${source.sourceTextRedacted}`,
    '',
    `Return up to ${count} public reply-style responses you have observed against this source on X.`,
    'For each reply, return a JSON object in this shape:',
    `{
      "replyClaimSummary": "<one-sentence summary, observable language only>",
      "replyTextRedacted": "<reply excerpt; NO @handle, NO URL, NO post id>",
      "providerRank": <integer 1-based rank within this returned set>,
      "providerConfidence": <number 0..1>,
      "topReplyMethod": "metric_ranked" | "provider_inferred",
      "replyMetricsIfAvailable": { "likeCount": <int|null>, "replyCount": <int|null> } | null,
      "citationRefs": ["<short string id>"]
    }`,
    'Wrap the array in: { "replies": [ ... ] }.',
    'NEVER include @handles, URLs, screenshots, or raw post IDs.',
    'NEVER assert which user is correct.',
  ].join('\n');

  // xAI Responses API contract: no `response_format` (chat/completions-only).
  // The instructions + JSON shape in the prompt do the JSON-shape work.
  return {
    model,
    instructions: REPLY_SYSTEM,
    input: userPrompt,
    tools: [{ type: 'x_search' }],
    temperature: 0.2,
  };
}

function buildLegacyReplyPayload({ source, count, model }) {
  return {
    model,
    messages: [
      { role: 'system', content: REPLY_SYSTEM },
      { role: 'user', content: [
        `Source: topic ${source.topicBucket} — claim "${source.sourceClaimSummary}". Source excerpt: ${source.sourceTextRedacted}`,
        `Return up to ${count} public reply-style responses you have observed against this source on X.`,
        'Return ONE JSON object with shape { "replies": [{ replyClaimSummary, replyTextRedacted, providerRank, providerConfidence, topReplyMethod, replyMetricsIfAvailable, citationRefs }, ...] }.',
        'NEVER include @handles, URLs, screenshots, or raw post IDs.',
      ].join('\n') },
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' },
    search_parameters: {
      mode: 'on',
      sources: [{ type: 'x' }],
      max_search_results: Math.max(10, Math.min(Number(count) || 12, 30) * 2),
    },
  };
}

function extractRepliesFromResponses(json) {
  if (!json) return null;
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
  try { const parsed = JSON.parse(trimmed); return Array.isArray(parsed?.replies) ? parsed.replies : null; } catch { return null; }
}

function extractRepliesFromLegacy(json) {
  if (!json || !Array.isArray(json.choices) || json.choices.length === 0) return null;
  const content = json.choices[0]?.message?.content;
  if (typeof content !== 'string') return null;
  let trimmed = content.trim();
  if (trimmed.startsWith('```')) trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try { const parsed = JSON.parse(trimmed); return Array.isArray(parsed?.replies) ? parsed.replies : null; } catch { return null; }
}

function normalizeReply(raw, ctx, ordinal) {
  if (!raw || typeof raw !== 'object') return null;
  const replyTextRedacted = redactProviderText(raw.replyTextRedacted || '').slice(0, 600).trim();
  const replyClaimSummary = redactProviderText(raw.replyClaimSummary || '').slice(0, 280).trim();
  if (!replyTextRedacted || !replyClaimSummary) return null;
  const providerRank = typeof raw.providerRank === 'number' && Number.isFinite(raw.providerRank) && raw.providerRank > 0
    ? Math.floor(raw.providerRank)
    : ordinal;
  const providerConfidence = (() => {
    const c = Number(raw.providerConfidence);
    if (!Number.isFinite(c)) return 0.5;
    if (c < 0) return 0;
    if (c > 1) return 1;
    return c;
  })();
  let topReplyMethod = raw.topReplyMethod === 'metric_ranked' ? 'metric_ranked' : 'provider_inferred';
  // If the model gave us no metrics, demote any metric_ranked claim.
  const replyMetricsIfAvailable = (() => {
    const m = raw.replyMetricsIfAvailable;
    if (!m || typeof m !== 'object') return null;
    const out = {};
    for (const k of ['likeCount', 'replyCount', 'retweetCount', 'viewCount', 'quoteCount']) {
      if (typeof m[k] === 'number' && Number.isFinite(m[k])) out[k] = m[k];
    }
    return Object.keys(out).length === 0 ? null : out;
  })();
  if (!replyMetricsIfAvailable && topReplyMethod === 'metric_ranked') topReplyMethod = 'provider_inferred';
  const citationRefs = Array.isArray(raw.citationRefs)
    ? raw.citationRefs.map((r) => sanitizeForLog(String(r || '')).slice(0, 80)).filter(Boolean)
    : [];
  return {
    replyOrdinal: ordinal,
    replyHash: shortHash(replyClaimSummary + '||' + replyTextRedacted, ctx.runSalt),
    sourceHash: ctx.sourceHash,
    provider: ctx.provider,
    providerRank,
    providerConfidence,
    topReplyMethod,
    replyTextRedacted,
    replyClaimSummary,
    replyMetricsIfAvailable,
    citationRefs,
    collectedAt: new Date().toISOString(),
    redactionApplied: true,
    redactionNotes: 'handles, URLs, post IDs, JWTs, secrets stripped before return',
  };
}

async function fetchProviderRaw({ providerLabel, payload, key, fetchImpl, timeoutMs }) {
  const url = providerLabel === 'legacy_chat_search'
    ? `${XAI_BASE}${CHAT_PATH}`
    : `${XAI_BASE}${RESPONSES_PATH}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), Number(timeoutMs) > 0 ? Number(timeoutMs) : DEFAULT_TIMEOUT_MS);
  const fetchFn = fetchImpl || globalThis.fetch;
  if (typeof fetchFn !== 'function') throw new XaiAdversarialProviderUpstream('no_fetch_available', providerLabel);
  let res;
  try {
    res = await fetchFn(url, {
      method: 'POST',
      headers: {
        'User-Agent': 'cdiscourse-xai-adversarial-replies/0.1',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(t);
    throw new XaiAdversarialProviderUpstream(`transport_error:${sanitizeForLog(err && (err.cause?.code || err.code || err.message) || 'unknown')}`, providerLabel);
  }
  clearTimeout(t);
  if (res.status !== 200) {
    await releaseResponseBody(res);
    throw new XaiAdversarialProviderUpstream(`http_${res.status}`, providerLabel);
  }
  let parsed;
  try { parsed = await res.json(); }
  catch (err) {
    await releaseResponseBody(res);
    throw new XaiAdversarialProviderUpstream(`json_parse_error:${sanitizeForLog(err && err.message)}`, providerLabel);
  }
  await drainEventLoop();
  return parsed;
}

/**
 * Collect top-N reply candidates for a given source post.
 *
 * Returns: { provider, replies: Array, raw: { count, sourceHash } }
 */
async function collectReplyCandidates({
  source,
  count,
  pilot,
  providerLabel,
  fetchImpl,
  timeoutMs,
  runSalt,
} = {}) {
  if (!source || !source.sourceClaimSummary) throw new Error('collectReplyCandidates requires a source object');
  const snap = envSnapshot();
  // File-existence is intentionally NOT a gate: the merged env (file + process.env)
  // lets CI / worktrees authorize via process.env without a file on disk. The
  // enable flag + key + --pilot below are the real kill-switches.
  if (!snap.enableXai) throw new XaiAdversarialProviderDisabled('env_flag_off', providerLabel || 'xai_responses');
  if (!snap.hasXaiKey) throw new XaiAdversarialProviderDisabled('api_key_missing', providerLabel || 'xai_responses');
  if (!pilot) throw new XaiAdversarialProviderDisabled('no_pilot_flag', providerLabel || 'xai_responses');
  const key = readMergedEnv().XAI_API_KEY;
  const safeCount = Math.min(Math.max(Number(count) || 12, 1), 30);
  const model = snap.model;

  const provider = providerLabel === 'legacy_chat_search' ? 'legacy_chat_search' : 'xai_responses';
  const payload = provider === 'legacy_chat_search'
    ? buildLegacyReplyPayload({ source, count: safeCount, model })
    : buildResponsesReplyPayload({ source, count: safeCount, model });

  const parsedBody = await fetchProviderRaw({ providerLabel: provider, payload, key, fetchImpl, timeoutMs });
  const rawReplies = provider === 'legacy_chat_search'
    ? extractRepliesFromLegacy(parsedBody)
    : extractRepliesFromResponses(parsedBody);
  if (!rawReplies) throw new XaiAdversarialProviderUpstream(`${provider}_returned_unusable_payload`, provider);
  const ctx = { provider, sourceHash: source.sourceHash, runSalt };
  const replies = [];
  for (let i = 0; i < rawReplies.length; i++) {
    const r = normalizeReply(rawReplies[i], ctx, i + 1);
    if (r) replies.push(r);
  }
  return { provider, model, replies, raw: { count: safeCount, sourceHash: source.sourceHash } };
}

module.exports = {
  collectReplyCandidates,
  normalizeReply,
  extractRepliesFromResponses,
  extractRepliesFromLegacy,
  buildResponsesReplyPayload,
  buildLegacyReplyPayload,
};
