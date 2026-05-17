/**
 * Stage 6.1.7 — xAI adversarial source-post candidate collector.
 *
 * Calls the xAI provider abstraction (`xai_responses` default, optional
 * `legacy_chat_search`) to surface up to N candidate news-topic source
 * posts. Output is fully redacted: no @handles, URLs, raw post IDs, JWTs,
 * emails, or secret-shape tokens leave this module.
 *
 * Honest ranking: when the provider returns only model-mediated text (no
 * official metrics), each candidate is tagged with `topReplyMethod=
 * "provider_inferred"`-style `providerRank` + `providerConfidence`, never as
 * a metric-ranked engagement rank.
 *
 * No truth verdict. No user labels. No moderation recommendations.
 */
const { createHash } = require('node:crypto');
const {
  redactProviderText,
  sanitizeForLog,
  pickProvider,
  envSnapshot,
} = require('./xaiAdversarialProvider');

const ALLOWED_CLAIM_TYPES = new Set([
  'claim', 'opinion', 'factual_assertion', 'speculation', 'unclear',
]);

function shortHash(text, salt) {
  return createHash('sha256').update(`${salt || ''}::${String(text || '')}`).digest('hex').slice(0, 16);
}

function clean(value) {
  return redactProviderText(value || '').slice(0, 800).trim();
}

function safeCitationRefs(refs) {
  if (!Array.isArray(refs)) return [];
  return refs
    .map((r) => (typeof r === 'string' ? r : (r && typeof r.id === 'string' ? r.id : '')))
    .map((s) => sanitizeForLog(s).slice(0, 80))
    .filter((s) => Boolean(s));
}

function safeMetrics(m) {
  if (!m || typeof m !== 'object') return null;
  // Numeric metrics only; never include strings (might carry handles).
  const out = {};
  for (const k of ['likeCount', 'replyCount', 'retweetCount', 'viewCount', 'quoteCount']) {
    if (typeof m[k] === 'number' && Number.isFinite(m[k])) out[k] = m[k];
  }
  return Object.keys(out).length === 0 ? null : out;
}

function normalizeOne(raw, opts, ordinal) {
  if (!raw || typeof raw !== 'object') return null;
  const sourceClaimSummary = clean(raw.sourceClaimSummary).slice(0, 280);
  const sourceTextRedacted = clean(raw.sourceTextRedacted).slice(0, 600);
  if (!sourceClaimSummary || !sourceTextRedacted) return null;
  const claimType = ALLOWED_CLAIM_TYPES.has(raw.sourceClaimType) ? raw.sourceClaimType : 'unclear';
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
  const topicBucket = sanitizeForLog(String(raw.topicBucket || 'unknown')).replace(/[^a-z0-9-]/gi, '-').slice(0, 64) || 'unknown';

  return {
    sourceOrdinal: ordinal,
    sourceHash: shortHash(sourceClaimSummary + '||' + sourceTextRedacted, opts.runSalt),
    provider: opts.provider,
    providerQuery: sanitizeForLog(opts.topicHint || '').slice(0, 200),
    providerRank,
    providerConfidence,
    citationRefs: safeCitationRefs(raw.citationRefs),
    topicBucket,
    sourceTextRedacted,
    sourceClaimSummary,
    sourceClaimType: claimType,
    sourceMetricsIfAvailable: safeMetrics(raw.sourceMetricsIfAvailable),
    sourceCollectedAt: new Date().toISOString(),
    redactionApplied: true,
    redactionNotes: 'handles, URLs, post IDs, JWTs, secrets stripped via xaiAdversarialProvider.redactProviderText',
  };
}

/**
 * Collect candidate source posts. Live calls require the provider gate
 * (`--pilot` + env + key). The synthetic path (`mode === 'synthetic'`)
 * reuses the existing synthetic seed file via the existing seeder when
 * the operator runs in dry mode.
 *
 * Returns: { provider, candidates: Array, raw: {topicHint, count, snap} }
 */
async function collectSourceCandidates({
  topicHint,
  count,
  pilot,
  providerLabel,
  fetchImpl,
  timeoutMs,
  runSalt,
} = {}) {
  const provider = pickProvider(providerLabel);
  const result = await provider({ topicHint, count, pilot, fetchImpl, timeoutMs });
  const rawTopics = Array.isArray(result.rawTopics) ? result.rawTopics : [];
  const candidates = [];
  for (let i = 0; i < rawTopics.length; i++) {
    const normalized = normalizeOne(rawTopics[i], { provider: result.provider, topicHint, runSalt }, i + 1);
    if (normalized) candidates.push(normalized);
  }
  return {
    provider: result.provider,
    model: result.model,
    candidates,
    raw: { topicHint, count, snap: envSnapshot() },
  };
}

/** Deterministic sampling helper — used by the runner when target pool is
 *  larger than `--rooms`. Picks N candidates with a seeded RNG. */
function sampleDeterministic(arr, n, seedString) {
  if (!Array.isArray(arr) || arr.length === 0 || n <= 0) return [];
  if (arr.length <= n) return arr.slice();
  let seed = 0;
  for (const ch of String(seedString || 'cdiscourse')) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  function next() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xFFFFFFFF;
  }
  const tagged = arr.map((v, i) => ({ v, key: next(), origIdx: i }));
  tagged.sort((a, b) => a.key - b.key);
  // Preserve providerRank order WITHIN the sample so downstream selection
  // remains "first by provider rank".
  const subset = tagged.slice(0, n).map((t) => t.v);
  subset.sort((a, b) => (a.providerRank || 0) - (b.providerRank || 0));
  return subset;
}

module.exports = {
  collectSourceCandidates,
  normalizeOne,
  sampleDeterministic,
  shortHash,
  safeCitationRefs,
  safeMetrics,
};
