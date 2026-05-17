/**
 * Stage 6.1.3.2 — loadEngagementEnv.
 *
 * Parses `.env.engagement-intelligence` (if present) and exposes the kill-
 * switches needed by the X-API / xAI scripts. Never prints secret values.
 *
 * CommonJS / pure.
 */
const fs = require('node:fs');
const path = require('node:path');

const ENV_FILE = path.join(process.cwd(), '.env.engagement-intelligence');

function parseDotEnv(text) {
  const out = {};
  if (!text) return out;
  const lines = String(text).split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function loadEngagementEnv() {
  let parsed = {};
  if (fs.existsSync(ENV_FILE)) {
    parsed = parseDotEnv(fs.readFileSync(ENV_FILE, 'utf8'));
  }
  // Process env wins over file so CI can override without writing a file.
  const merged = { ...parsed, ...process.env };
  const flag = (v) => String(v || '').trim().toLowerCase() === 'true';
  const num = (v, def) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : def;
  };
  return {
    fileExists: fs.existsSync(ENV_FILE),
    enableXApi: flag(merged.ENGAGEMENT_INTEL_ENABLE_X_API),
    enableXai: flag(merged.ENGAGEMENT_INTEL_ENABLE_XAI),
    hasXBearer: Boolean(merged.X_BEARER_TOKEN),
    hasXaiKey: Boolean(merged.XAI_API_KEY),
    maxNewsStories: num(merged.ENGAGEMENT_INTEL_MAX_NEWS_STORIES, 5),
    maxPostsPerStory: num(merged.ENGAGEMENT_INTEL_MAX_POSTS_PER_STORY, 3),
    topRepliesPerPost: num(merged.ENGAGEMENT_INTEL_TOP_REPLIES_PER_POST, 12),
    maxTotalReplyPairs: num(merged.ENGAGEMENT_INTEL_MAX_TOTAL_REPLY_PAIRS, 180),
    newsQuery: String(merged.ENGAGEMENT_INTEL_NEWS_QUERY || 'news'),
    maxAgeHours: num(merged.ENGAGEMENT_INTEL_MAX_AGE_HOURS, 24),
  };
}

/** Used by tests to assert no secret value ever leaves this module. */
function snapshotForLog(env) {
  return {
    fileExists: env.fileExists,
    enableXApi: env.enableXApi,
    enableXai: env.enableXai,
    hasXBearer: env.hasXBearer,
    hasXaiKey: env.hasXaiKey,
    maxNewsStories: env.maxNewsStories,
    maxPostsPerStory: env.maxPostsPerStory,
    topRepliesPerPost: env.topRepliesPerPost,
    maxTotalReplyPairs: env.maxTotalReplyPairs,
    newsQuery: env.newsQuery,
    maxAgeHours: env.maxAgeHours,
  };
}

module.exports = { loadEngagementEnv, parseDotEnv, snapshotForLog };
