/**
 * Normalize raw X API objects into engagement-intelligence sample shapes.
 *
 * Pure / CommonJS — no network here. Caller passes parsed JSON; this module
 * hashes IDs and redacts text so the result is safe to write locally.
 */
const crypto = require('crypto');

function shortHash(value, salt = 'cdiscourse-ei') {
  if (value == null) return null;
  return crypto.createHash('sha256').update(`${salt}::${String(value)}`).digest('hex').slice(0, 16);
}

const HANDLE_RE = /@[A-Za-z0-9_]{1,15}\b/g;
const URL_RE = /https?:\/\/\S+/g;
const SHORT_URL_RE = /\b[A-Za-z0-9.-]+\.(com|net|org|io|gov|co|uk|us|info|news)\/\S*/gi;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const SECRET_RES = [
  /eyJ[A-Za-z0-9_-]{10,}/g,
  /sb_secret_[A-Za-z0-9_-]+/g,
  /sk-ant-[A-Za-z0-9_-]+/g,
  /sk-[A-Za-z0-9_-]{20,}/g,
  /Bearer\s+[A-Za-z0-9._-]{16,}/gi,
];

function redact(text) {
  if (text == null) return '';
  let s = String(text);
  s = s.replace(HANDLE_RE, '<handle>');
  s = s.replace(URL_RE, '<url>').replace(SHORT_URL_RE, '<url>');
  s = s.replace(EMAIL_RE, '<email>');
  for (const re of SECRET_RES) s = s.replace(re, '[redacted]');
  return s.replace(/\s+/g, ' ').trim();
}

function fingerprint(text) {
  return shortHash(String(text || '').toLowerCase(), 'ei-fp');
}

function publicMetrics(pm) {
  const safe = pm && typeof pm === 'object' ? pm : {};
  return {
    replyCount: Number(safe.reply_count || 0),
    repostCount: Number(safe.retweet_count || safe.repost_count || 0),
    quoteCount: Number(safe.quote_count || 0),
    likeCount: Number(safe.like_count || 0),
    viewCount: safe.impression_count != null ? Number(safe.impression_count) : null,
    bookmarkCount: safe.bookmark_count != null ? Number(safe.bookmark_count) : null,
  };
}

function popularityScore(m) {
  return m.replyCount * 3 + m.quoteCount * 2 + m.repostCount * 1.5 + m.likeCount + (m.viewCount ? m.viewCount * 0.05 : 0);
}

function replyRankScore(m) {
  return m.likeCount + m.replyCount * 2 + m.quoteCount * 2 + m.repostCount;
}

function classifySafety(text) {
  const lc = String(text || '').toLowerCase();
  const sensitivePatterns = [
    /\bsuicid|\bself[\s-]?harm/, /\bgore\b/, /\bnsfw\b/,
    /\b(diagnose|prescribe|investing advice|legal advice)\b/,
  ];
  const realAccusationPatterns = [/\b(corrupt|criminal|fraud|paedo|pedo)\b/];
  const sensitiveTopicPossible = sensitivePatterns.some((re) => re.test(lc));
  const realAccusationPossible = realAccusationPatterns.some((re) => re.test(lc));
  const privatePersonPossible = /\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b/.test(String(text || ''));
  const shouldExclude = sensitiveTopicPossible || realAccusationPossible;
  return {
    shouldExclude,
    exclusionReason: shouldExclude
      ? sensitiveTopicPossible ? 'sensitive_topic' : 'real_accusation'
      : null,
    sensitiveTopicPossible,
    privatePersonPossible,
    realAccusationPossible,
  };
}

function normalizePublicPost(rawTweet, opts = {}) {
  const t = rawTweet || {};
  const metrics = publicMetrics(t.public_metrics);
  const textRedacted = redact(t.text || '');
  return {
    postIdHash: shortHash(t.id),
    source: opts.source || 'x_recent_search',
    storyIdHash: opts.storyIdHash || null,
    collectedAt: new Date().toISOString(),
    createdAt: t.created_at || null,
    lang: t.lang || null,
    textRedacted,
    textFingerprint: fingerprint(textRedacted),
    conversationIdHash: shortHash(t.conversation_id),
    parentPostIdHash: shortHash(t.in_reply_to_user_id || t.referenced_tweets?.[0]?.id || null),
    authorIdHash: shortHash(t.author_id),
    publicMetrics: metrics,
    rankSignals: {
      popularityScore: popularityScore(metrics),
      replyPressureScore: metrics.replyCount,
      quotePressureScore: metrics.quoteCount,
      disagreementCandidateScore: metrics.replyCount + metrics.quoteCount * 1.5,
    },
    safety: classifySafety(t.text || ''),
  };
}

function normalizeNewsStory(rawStory, opts = {}) {
  const s = rawStory || {};
  const cluster = Array.isArray(s.cluster_posts_results) ? s.cluster_posts_results : [];
  return {
    storyIdHash: shortHash(s.id || s.name),
    source: 'x_news',
    collectedAt: new Date().toISOString(),
    query: opts.query || '',
    category: s.category || null,
    nameRedacted: s.name ? redact(s.name) : null,
    summaryRedacted: s.summary ? redact(s.summary) : null,
    hookRedacted: s.hook ? redact(s.hook) : null,
    keywords: Array.isArray(s.keywords) ? s.keywords.map((k) => String(k)).slice(0, 12) : [],
    clusterPostIdHashes: cluster.map((p) => shortHash(p.id || p.post_id)).filter(Boolean),
    contextTopics: Array.isArray(s.context_topics) ? s.context_topics.slice(0, 12) : [],
    publicOnly: true,
  };
}

function buildReplyPair(rootPost, replyPost, rank) {
  return {
    pairId: shortHash(`${rootPost.postIdHash}::${replyPost.postIdHash}::${rank}`),
    rootPostIdHash: rootPost.postIdHash,
    replyPostIdHash: replyPost.postIdHash,
    storyIdHash: rootPost.storyIdHash,
    rootTextRedacted: rootPost.textRedacted,
    replyTextRedacted: replyPost.textRedacted,
    rootMetrics: rootPost.publicMetrics,
    replyMetrics: replyPost.publicMetrics,
    replyRank: rank,
    collectedAt: new Date().toISOString(),
    threadContext: {
      conversationIdHash: replyPost.conversationIdHash,
      replyDepthEstimate: 1,
      isDirectReply: Boolean(replyPost.parentPostIdHash && replyPost.parentPostIdHash === rootPost.authorIdHash),
      hasQuoteReference: replyPost.rankSignals.quotePressureScore > 0,
    },
    safety: {
      shouldExclude: replyPost.safety.shouldExclude || rootPost.safety.shouldExclude,
      exclusionReason: replyPost.safety.exclusionReason || rootPost.safety.exclusionReason,
    },
  };
}

module.exports = {
  shortHash,
  redact,
  fingerprint,
  publicMetrics,
  popularityScore,
  replyRankScore,
  classifySafety,
  normalizePublicPost,
  normalizeNewsStory,
  buildReplyPair,
};
