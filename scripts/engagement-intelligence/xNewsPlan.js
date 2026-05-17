#!/usr/bin/env node
/**
 * xNewsPlan — print the planned collection profile WITHOUT calling X.
 *
 * Outputs the query templates, volume caps, and safety guards. Operators use
 * this to sanity-check before turning the API on.
 */
const { loadEngagementEnv, snapshotForLog } = require('./loadEngagementEnv');

const NEWS_QUERY_BUCKETS = [
  { id: 'tech',           query: 'tech news -filter:advertising lang:en',           riskTier: 'low' },
  { id: 'sports',         query: 'sports news -filter:advertising lang:en',         riskTier: 'low' },
  { id: 'entertainment',  query: 'entertainment news -filter:advertising lang:en',  riskTier: 'low' },
  { id: 'product_design', query: 'product launch OR design news lang:en',           riskTier: 'low' },
  { id: 'transport_city', query: 'transit OR bike lanes OR city council lang:en',   riskTier: 'low' },
  { id: 'science_space',  query: 'science OR space news lang:en',                   riskTier: 'low' },
  { id: 'culture_media',  query: 'culture OR media news lang:en',                   riskTier: 'low' },
];

const EXCLUDED_TOPICS = [
  'medical advice', 'legal advice', 'financial advice',
  'active tragedies', 'protected-class conflict',
  'sexual content', 'violence', 'self-harm', 'extremism',
  'real-person accusations', 'current named politicians (until politics-mode is opted-in)',
];

function main() {
  const env = loadEngagementEnv();
  const totalCap = Math.min(
    env.maxNewsStories * env.maxPostsPerStory * env.topRepliesPerPost,
    env.maxTotalReplyPairs,
  );
  console.log('[x-news-plan] ===== Engagement Intelligence — collection plan =====');
  console.log('[x-news-plan] mode             : dry / plan-only — NO X API CALLS');
  console.log('[x-news-plan] env file present : ' + env.fileExists);
  console.log('[x-news-plan] enable_x_api     : ' + env.enableXApi);
  console.log('[x-news-plan] enable_xai       : ' + env.enableXai);
  console.log('[x-news-plan] has X bearer     : ' + env.hasXBearer);
  console.log('[x-news-plan] has xAI key      : ' + env.hasXaiKey);
  console.log('[x-news-plan] max news stories : ' + env.maxNewsStories);
  console.log('[x-news-plan] posts per story  : ' + env.maxPostsPerStory);
  console.log('[x-news-plan] top replies      : ' + env.topRepliesPerPost);
  console.log('[x-news-plan] reply pair cap   : ' + env.maxTotalReplyPairs);
  console.log('[x-news-plan] derived total cap: ' + totalCap);
  console.log('[x-news-plan] max age (hrs)    : ' + env.maxAgeHours);
  console.log('[x-news-plan]');
  console.log('[x-news-plan] Query buckets:');
  for (const b of NEWS_QUERY_BUCKETS) {
    console.log(`[x-news-plan]   • ${b.id.padEnd(16)} (${b.riskTier}) — ${b.query}`);
  }
  console.log('[x-news-plan]');
  console.log('[x-news-plan] Excluded topics (initial pilot):');
  for (const t of EXCLUDED_TOPICS) console.log(`[x-news-plan]   • ${t}`);
  console.log('[x-news-plan]');
  console.log('[x-news-plan] env snapshot (no secrets): ' + JSON.stringify(snapshotForLog(env)));
  console.log('[x-news-plan] no live calls will be made unless ENGAGEMENT_INTEL_ENABLE_X_API=true AND --pilot is passed.');
}

if (require.main === module) main();

module.exports = { NEWS_QUERY_BUCKETS, EXCLUDED_TOPICS };
