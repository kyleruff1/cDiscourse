#!/usr/bin/env node
/**
 * Stage 6.1.3.3 — Reply collector for the tiny X News pilot.
 *
 * For each root post that lives in `data/engagement-intelligence/raw/<runId>-roots.json`
 * (a local-only, gitignored cache produced by the pilot orchestrator), fetch up
 * to TOP_REPLIES_PER_POST replies via the official recent-search endpoint with
 * `conversation_id:<rootId>`, rank by engagement, redact, hash IDs, and append
 * the ReplyPairSamples into a redacted JSONL.
 *
 * Default mode is dry. Live runs require:
 *   - .env.engagement-intelligence file present
 *   - ENGAGEMENT_INTEL_ENABLE_X_API=true
 *   - X_BEARER_TOKEN populated
 *   - --pilot on the CLI
 *
 * The pilot orchestrator (`runTinyXNewsPilot.js`) drives this; you generally
 * don't call this script directly.
 */
const fs = require('node:fs');
const path = require('node:path');
const { loadEngagementEnv, snapshotForLog } = require('./loadEngagementEnv');
const { normalizePublicPost, buildReplyPair, replyRankScore } = require('./normalizeXSample');

function parseArgs(argv) {
  const args = { dry: true, pilot: false, rootsFile: null, outFile: null, runId: null };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--dry') args.dry = true;
    else if (a === '--pilot') { args.pilot = true; args.dry = false; }
    else if (a === '--roots' && rest[i + 1]) args.rootsFile = rest[++i];
    else if (a === '--out' && rest[i + 1]) args.outFile = rest[++i];
    else if (a === '--run-id' && rest[i + 1]) args.runId = rest[++i];
  }
  return args;
}

async function fetchRepliesForRoot({ xApiFetch, rootRaw, perPost }) {
  const { id: rootId } = rootRaw;
  // Use the recent-search endpoint with conversation_id. is:reply filters
  // out the root tweet itself. Replies are public-only by API design.
  const res = await xApiFetch('/tweets/search/recent', {
    query: {
      query: `conversation_id:${rootId} is:reply -is:retweet`,
      max_results: Math.min(50, Math.max(10, perPost * 3)),
      'tweet.fields': 'id,text,created_at,lang,author_id,conversation_id,public_metrics,referenced_tweets',
    },
  });
  const raw = Array.isArray(res?.data) ? res.data : [];
  // Rank by engagement and keep the top N.
  const ranked = raw
    .map((t) => ({ raw: t, rank: replyRankScore(t.public_metrics ? {
      replyCount: t.public_metrics.reply_count || 0,
      repostCount: t.public_metrics.retweet_count || 0,
      quoteCount: t.public_metrics.quote_count || 0,
      likeCount: t.public_metrics.like_count || 0,
      viewCount: t.public_metrics.impression_count || null,
    } : { replyCount: 0, repostCount: 0, quoteCount: 0, likeCount: 0 }) }))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, perPost);
  return ranked;
}

async function liveCollect(env, rootsRaw, outFile, runId) {
  const { xApiFetch } = require('./xApiClient');
  if (!Array.isArray(rootsRaw) || rootsRaw.length === 0) {
    console.warn('[x-reply-collect] no roots supplied; nothing to do');
    return { totalReplies: 0, outFile };
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const out = fs.createWriteStream(outFile);
  let totalPairs = 0;
  for (let i = 0; i < rootsRaw.length; i++) {
    if (totalPairs >= env.maxTotalReplyPairs) {
      console.log(`[x-reply-collect] cap reached (${env.maxTotalReplyPairs}); stopping`);
      break;
    }
    const root = rootsRaw[i];
    const remaining = env.maxTotalReplyPairs - totalPairs;
    const perPost = Math.min(env.topRepliesPerPost, remaining);
    if (perPost <= 0) break;
    try {
      const replies = await fetchRepliesForRoot({ xApiFetch, rootRaw: root, perPost });
      // Normalize root + each reply, build redacted pairs.
      const normRoot = normalizePublicPost(root, { source: 'x_recent_search', storyIdHash: root._storyIdHash || null });
      for (let r = 0; r < replies.length && totalPairs < env.maxTotalReplyPairs; r++) {
        const normReply = normalizePublicPost(replies[r].raw, { source: 'x_recent_search', storyIdHash: root._storyIdHash || null });
        const pair = buildReplyPair(normRoot, normReply, r + 1);
        if (pair.safety.shouldExclude) continue;
        // Tag the bucket the root came from for downstream filtering.
        if (root._queryBucket) pair.queryBucket = String(root._queryBucket).slice(0, 32);
        out.write(JSON.stringify(pair) + '\n');
        totalPairs++;
      }
      console.log(`[x-reply-collect] (${i + 1}/${rootsRaw.length}) replies=${replies.length} cumulative_pairs=${totalPairs}`);
    } catch (err) {
      console.warn(`[x-reply-collect] root ${i + 1} failed: ${String(err.message).slice(0, 200)}`);
      if (/rate_limited/.test(err.message)) {
        console.warn('[x-reply-collect] rate limit hit; stopping early');
        break;
      }
    }
  }
  out.end();
  return { totalReplies: totalPairs, outFile, runId };
}

async function main() {
  const args = parseArgs(process.argv);
  const env = loadEngagementEnv();
  if (!args.pilot) {
    console.log('[x-reply-collect] dry mode — no X API calls');
    console.log('[x-reply-collect] env: ' + JSON.stringify(snapshotForLog(env)));
    console.log('[x-reply-collect] would fetch up to ' + env.topRepliesPerPost + ' replies per root post');
    console.log('[x-reply-collect] hard ceiling: ' + env.maxTotalReplyPairs + ' total reply pairs');
    return;
  }
  if (!env.enableXApi) { console.error('[x-reply-collect] refusing: ENGAGEMENT_INTEL_ENABLE_X_API=false'); process.exit(2); }
  if (!env.hasXBearer) { console.error('[x-reply-collect] refusing: X_BEARER_TOKEN missing'); process.exit(2); }
  if (!args.rootsFile || !fs.existsSync(args.rootsFile)) {
    console.error('[x-reply-collect] live run requires --roots <path> to a local roots JSON file');
    process.exit(2);
  }
  if (!args.outFile) {
    console.error('[x-reply-collect] live run requires --out <path>');
    process.exit(2);
  }
  const roots = JSON.parse(fs.readFileSync(args.rootsFile, 'utf8'));
  const result = await liveCollect(env, roots, args.outFile, args.runId || 'standalone');
  console.log('[x-reply-collect] done: ' + JSON.stringify({ totalReplies: result.totalReplies, outFile: path.relative(process.cwd(), result.outFile) }));
}

if (require.main === module) {
  main().catch((err) => { console.error('[x-reply-collect][fatal]', err.message); process.exit(99); });
}

module.exports = { parseArgs, fetchRepliesForRoot, liveCollect };
