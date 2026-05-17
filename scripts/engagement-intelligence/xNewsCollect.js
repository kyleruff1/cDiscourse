#!/usr/bin/env node
/**
 * Live-or-dry News collector. DEFAULT MODE IS DRY.
 *
 * Live mode requires:
 *   - `.env.engagement-intelligence` present with ENGAGEMENT_INTEL_ENABLE_X_API=true
 *   - X_BEARER_TOKEN populated
 *   - `--pilot` flag explicitly passed on the command line
 *
 * Otherwise this script prints the planned shape only — it does not call X.
 */
const fs = require('node:fs');
const path = require('node:path');
const { loadEngagementEnv, snapshotForLog } = require('./loadEngagementEnv');
const { NEWS_QUERY_BUCKETS } = require('./xNewsPlan');

function parseArgs(argv) {
  const args = { dry: true, pilot: false };
  for (const a of argv.slice(2)) {
    if (a === '--dry') args.dry = true;
    else if (a === '--pilot') { args.pilot = true; args.dry = false; }
  }
  return args;
}

async function liveCollect(env) {
  const { xApiFetch } = require('./xApiClient');
  const { normalizeNewsStory } = require('./normalizeXSample');

  console.log('[x-news-collect] LIVE PILOT — calling /2/news/search');
  const stories = [];
  for (const bucket of NEWS_QUERY_BUCKETS) {
    if (stories.length >= env.maxNewsStories) break;
    try {
      const res = await xApiFetch('/news/search', {
        query: {
          query: bucket.query,
          max_results: Math.min(10, env.maxNewsStories - stories.length),
          'expansions': 'cluster_posts_results',
          'news.fields': 'name,summary,hook,keywords,context_topics,category',
        },
      });
      const data = Array.isArray(res?.data) ? res.data : [];
      for (const story of data) {
        if (stories.length >= env.maxNewsStories) break;
        stories.push(normalizeNewsStory(story, { query: bucket.query }));
      }
    } catch (err) {
      console.warn(`[x-news-collect] bucket=${bucket.id} failed: ${err.message}`);
      // Stop on rate-limit; retry spam is not allowed.
      if (/rate_limited/.test(err.message)) break;
    }
  }
  return stories;
}

async function main() {
  const args = parseArgs(process.argv);
  const env = loadEngagementEnv();

  if (!args.pilot) {
    console.log('[x-news-collect] dry mode — no X API calls');
    console.log('[x-news-collect] env: ' + JSON.stringify(snapshotForLog(env)));
    console.log('[x-news-collect] planned buckets:');
    for (const b of NEWS_QUERY_BUCKETS) console.log(`[x-news-collect]   • ${b.id} — ${b.query}`);
    console.log('[x-news-collect] to run live: ensure .env.engagement-intelligence has ENGAGEMENT_INTEL_ENABLE_X_API=true and pass --pilot');
    return;
  }

  // Pilot path
  if (!env.enableXApi) {
    console.error('[x-news-collect] refusing live run: ENGAGEMENT_INTEL_ENABLE_X_API is not true');
    process.exit(2);
  }
  if (!env.hasXBearer) {
    console.error('[x-news-collect] refusing live run: X_BEARER_TOKEN missing');
    process.exit(2);
  }

  const stories = await liveCollect(env);
  const outDir = path.join(process.cwd(), 'data', 'engagement-intelligence', 'redacted');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${new Date().toISOString().replace(/[:.]/g, '-')}-news-stories.jsonl`);
  fs.writeFileSync(outFile, stories.map((s) => JSON.stringify(s)).join('\n') + '\n');
  console.log(`[x-news-collect] wrote ${stories.length} redacted stories -> ${outFile}`);
  console.log('[x-news-collect] reminder: this directory is gitignored. Do not commit raw data.');
}

if (require.main === module) {
  main().catch((err) => { console.error('[x-news-collect][fatal]', err.message); process.exit(99); });
}

module.exports = { parseArgs };
