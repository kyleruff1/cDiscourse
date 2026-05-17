#!/usr/bin/env node
/**
 * Stage 6.1.3.3 — Tiny X News pilot orchestrator.
 *
 * Pipeline (operator-gated):
 *   1. Refuse unless `.env.engagement-intelligence` is present, ENABLE_X_API
 *      is true, X_BEARER_TOKEN is set, and `--pilot` is on the CLI.
 *   2. Refuse if ENABLE_XAI is on unless the operator passes `--allow-xai`.
 *   3. Fetch up to MAX_NEWS_STORIES from /2/news/search across the safe
 *      query buckets in xNewsPlan.js.
 *   4. For each story, expand to up to MAX_POSTS_PER_STORY raw post IDs.
 *   5. Look those posts up via /2/tweets?ids=... to get public metrics.
 *   6. Rank by popularityScore; keep the top per-story posts.
 *   7. For each selected root, run xReplyCollect (conversation_id search),
 *      keep top TOP_REPLIES_PER_POST per root.
 *   8. Cap at MAX_TOTAL_REPLY_PAIRS.
 *   9. Write redacted reply-pair JSONL to
 *      `data/engagement-intelligence/redacted/<runId>-reply-pairs.jsonl`
 *      (gitignored).
 *  10. Run the analyzer over the redacted JSONL.
 *  11. Write the committable Markdown report to
 *      `docs/testing-runs/<date>-x-news-reply-pilot.md`.
 *
 * Raw post IDs / text are held in memory during the run and persisted only
 * to `data/engagement-intelligence/raw/<runId>-roots.json` (gitignored) so
 * the reply step can re-key them. Nothing raw lands in `docs/`.
 *
 * xAI is NOT called by this script.
 */
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const { loadEngagementEnv, snapshotForLog } = require('./loadEngagementEnv');
const { NEWS_QUERY_BUCKETS } = require('./xNewsPlan');
const { normalizeNewsStory, popularityScore, publicMetrics } = require('./normalizeXSample');
const { liveCollect: liveCollectReplies } = require('./xReplyCollect');

const REPO_ROOT = process.cwd();
const RAW_DIR = path.join(REPO_ROOT, 'data', 'engagement-intelligence', 'raw');
const REDACTED_DIR = path.join(REPO_ROOT, 'data', 'engagement-intelligence', 'redacted');
const REPORT_DIR = path.join(REPO_ROOT, 'docs', 'testing-runs');

function parseArgs(argv) {
  const args = { pilot: false, allowXai: false };
  for (const a of argv.slice(2)) {
    if (a === '--pilot') args.pilot = true;
    else if (a === '--allow-xai') args.allowXai = true;
  }
  return args;
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function summarizeRefusal(reason) {
  console.error(`[tiny-pilot] refusing: ${reason}`);
  return 2;
}

async function fetchNewsStories(env) {
  const { xApiFetch } = require('./xApiClient');
  const stories = [];
  for (const bucket of NEWS_QUERY_BUCKETS) {
    if (stories.length >= env.maxNewsStories) break;
    try {
      const res = await xApiFetch('/news/search', {
        query: {
          query: bucket.query,
          max_results: Math.min(10, env.maxNewsStories - stories.length),
          expansions: 'cluster_posts_results',
          'news.fields': 'name,summary,hook,keywords,context_topics,category',
        },
      });
      const data = Array.isArray(res?.data) ? res.data : [];
      for (const story of data) {
        if (stories.length >= env.maxNewsStories) break;
        const normalized = normalizeNewsStory(story, { query: bucket.query });
        stories.push({ ...normalized, _bucketId: bucket.id, _clusterRawIds: extractClusterIds(story) });
      }
    } catch (err) {
      console.warn(`[tiny-pilot] news bucket=${bucket.id} failed: ${String(err.message).slice(0, 200)}`);
      if (/rate_limited/.test(err.message)) break;
    }
  }
  return stories;
}

function extractClusterIds(story) {
  // The news.search response usually carries cluster_posts_results as either
  // an array of IDs or an array of objects with `post_id` / `id`.
  const cluster = Array.isArray(story.cluster_posts_results) ? story.cluster_posts_results : [];
  const ids = [];
  for (const entry of cluster) {
    if (typeof entry === 'string') ids.push(entry);
    else if (entry && typeof entry === 'object') ids.push(entry.id || entry.post_id);
  }
  return ids.filter(Boolean);
}

async function lookupTweets(ids) {
  if (ids.length === 0) return [];
  const { xApiFetch } = require('./xApiClient');
  // /2/tweets accepts up to 100 ids in one batch.
  const out = [];
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    try {
      const res = await xApiFetch('/tweets', {
        query: {
          ids: batch.join(','),
          'tweet.fields': 'id,text,created_at,lang,author_id,conversation_id,public_metrics,referenced_tweets',
        },
      });
      const data = Array.isArray(res?.data) ? res.data : [];
      for (const t of data) out.push(t);
    } catch (err) {
      console.warn(`[tiny-pilot] tweet lookup batch failed: ${String(err.message).slice(0, 200)}`);
      if (/rate_limited/.test(err.message)) break;
    }
  }
  return out;
}

function pickTopRootsPerStory(stories, lookedUp, maxPerStory) {
  const byId = new Map(lookedUp.map((t) => [String(t.id), t]));
  const roots = [];
  for (const story of stories) {
    const cluster = (story._clusterRawIds || []).map((id) => byId.get(String(id))).filter(Boolean);
    const ranked = cluster
      .map((t) => ({ raw: t, score: popularityScore(publicMetrics(t.public_metrics)) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxPerStory);
    for (const r of ranked) {
      roots.push({ ...r.raw, _storyIdHash: story.storyIdHash, _queryBucket: story._bucketId });
    }
  }
  return roots;
}

function buildAnalyzerInput(redactedPath) {
  // The analyzer accepts ReplyPairSample shapes. Each line maps to a record
  // with `rootText` / `replyText` aliases the JS scalar already understands.
  const lines = fs.readFileSync(redactedPath, 'utf8').split(/\r?\n/).filter(Boolean);
  return lines.map((line, i) => {
    const o = JSON.parse(line);
    return {
      pairId: o.pairId || `live-${i + 1}`,
      rootText: o.rootTextRedacted,
      replyText: o.replyTextRedacted,
      _bucketId: o.queryBucket || null,
      _meta: { rootMetrics: o.rootMetrics, replyMetrics: o.replyMetrics },
    };
  });
}

async function runAnalyzerAndReport({ pairs, runId }) {
  // Use the existing analyzer + report builder, then enrich with the
  // mixed-agreement taxonomy and example exhibits.
  const { interpretReplyPair } = require('./agreementScalarJs');
  const { classifyMixedAgreement, toGradingFlags } = require('./mixedAgreementTaxonomyJs');
  const interpretations = pairs.map((p) => {
    const interp = interpretReplyPair(p);
    const flags = classifyMixedAgreement(interp.finalVector, p.rootText, p.replyText);
    interp.mixedFlags = flags;
    interp.gradingFlags = toGradingFlags(flags);
    return interp;
  });
  return interpretations;
}

function bucketLabel(score) {
  if (score < 0.2) return '0.0-0.2';
  if (score < 0.4) return '0.2-0.4';
  if (score < 0.6) return '0.4-0.6';
  if (score < 0.8) return '0.6-0.8';
  return '0.8-1.0';
}

function buildReport({ runId, scenarios, rootCount, interpretations, bucketsUsed }) {
  const total = interpretations.length;
  const stanceDist = {};
  const agreeDist = {};
  const disagreeDist = {};
  const replyFnDist = {};
  const classDist = {};
  let broadAcc = 0, narrowAcc = 0, broadDec = 0, narrowDec = 0;
  const heat = {};
  for (const i of interpretations) {
    const v = i.finalVector; const f = i.mixedFlags;
    stanceDist[v.primaryStance] = (stanceDist[v.primaryStance] || 0) + 1;
    agreeDist[v.agreementType] = (agreeDist[v.agreementType] || 0) + 1;
    disagreeDist[v.disagreementType] = (disagreeDist[v.disagreementType] || 0) + 1;
    replyFnDist[v.replyFunction] = (replyFnDist[v.replyFunction] || 0) + 1;
    classDist[f.mixedAgreementClass] = (classDist[f.mixedAgreementClass] || 0) + 1;
    if (f.broadAcceptor) broadAcc++;
    if (f.narrowAcceptor) narrowAcc++;
    if (f.broadDecliner) broadDec++;
    if (f.narrowDecliner) narrowDec++;
    const k = `${bucketLabel(v.agreementScore)} × ${bucketLabel(v.disagreementScore)}`;
    heat[k] = (heat[k] || 0) + 1;
  }
  function pct(num, denom) { return denom === 0 ? '0%' : `${Math.round((num / denom) * 100)}%`; }
  function top(map, n) { return [...Object.entries(map)].sort((a, b) => b[1] - a[1]).slice(0, n); }
  function tableRow(k, v) { return `| \`${k}\` | ${v} | ${pct(v, total)} |`; }

  const byTension = [...interpretations].sort((a, b) => (b.mixedFlags?.playableTensionScore || 0) - (a.mixedFlags?.playableTensionScore || 0));
  const byBroadAccNarrowDec = byTension.filter((i) => i.mixedFlags?.mixedAgreementClass === 'broad_accept_narrow_decline').slice(0, 10);
  const byNarrowAccBroadDec = byTension.filter((i) => i.mixedFlags?.mixedAgreementClass === 'narrow_accept_broad_decline').slice(0, 10);

  function exhibits(list) {
    if (list.length === 0) return ['_(none)_'];
    return list.slice(0, 10).map((i, idx) => {
      const v = i.finalVector; const f = i.mixedFlags;
      return [
        `### Exhibit ${idx + 1} — pair \`${i.pairId}\``,
        `- stance=\`${v.primaryStance}\` · function=\`${v.replyFunction}\` · class=\`${f.mixedAgreementClass}\``,
        `- agreement=${v.agreementScore.toFixed(2)} (\`${v.agreementType}\`) · disagreement=${v.disagreementScore.toFixed(2)} (\`${v.disagreementType}\`) · coexistence=${v.coexistenceScore.toFixed(2)} · playable=${f.playableTensionScore.toFixed(2)}`,
        `- suggestedGameNudge: \`${f.suggestedGameNudge}\``,
        `- root: ${truncate(i._rootTextRedacted || i.rootText || '', 220)}`,
        `- reply: ${truncate(i._replyTextRedacted || i.replyText || '', 220)}`,
        '',
      ].join('\n');
    });
  }
  function truncate(s, n) { s = String(s || ''); return s.length <= n ? s : s.slice(0, n - 1) + '…'; }

  const date = new Date().toISOString().slice(0, 10);
  const lines = [];
  lines.push(`# X News Reply Pilot — ${date}`);
  lines.push('');
  lines.push(`_Run id_: \`${runId}\``);
  lines.push(`_Mode_: live_x_api_only`);
  lines.push(`_xAI used_: no`);
  lines.push(`_X API live calls_: yes (this run) · _xAI calls_: no · _service-role_: no · _user-review required_: ALWAYS`);
  lines.push(`_Stories_: ${scenarios.length}  ·  _Root posts_: ${rootCount}  ·  _Reply pairs_: ${total}  ·  _Query buckets_: ${bucketsUsed.join(', ') || 'n/a'}`);
  lines.push(`_Compliance_: official X API only · no scraping · no browser automation · no raw handles, raw post IDs, URLs, or auth headers in this report.`);
  lines.push('');
  lines.push('## Aggregate primary-stance counts');
  lines.push('');
  lines.push('| primaryStance | count | % |');
  lines.push('|---|---:|---:|');
  for (const [k, v] of Object.entries(stanceDist)) lines.push(tableRow(k, v));
  lines.push('');
  lines.push('## Agreement type counts');
  lines.push('');
  lines.push('| agreementType | count | % |');
  lines.push('|---|---:|---:|');
  for (const [k, v] of Object.entries(agreeDist)) lines.push(tableRow(k, v));
  lines.push('');
  lines.push('## Disagreement type counts');
  lines.push('');
  lines.push('| disagreementType | count | % |');
  lines.push('|---|---:|---:|');
  for (const [k, v] of Object.entries(disagreeDist)) lines.push(tableRow(k, v));
  lines.push('');
  lines.push('## Reply function counts');
  lines.push('');
  lines.push('| replyFunction | count | % |');
  lines.push('|---|---:|---:|');
  for (const [k, v] of Object.entries(replyFnDist)) lines.push(tableRow(k, v));
  lines.push('');
  lines.push('## Mixed-agreement class counts');
  lines.push('');
  lines.push('| mixedAgreementClass | count | % |');
  lines.push('|---|---:|---:|');
  for (const [k, v] of Object.entries(classDist)) lines.push(tableRow(k, v));
  lines.push('');
  lines.push('## Broad / narrow acceptor + decliner counts');
  lines.push('');
  lines.push('| flag | count | % |');
  lines.push('|---|---:|---:|');
  lines.push(`| broadAcceptor | ${broadAcc} | ${pct(broadAcc, total)} |`);
  lines.push(`| narrowAcceptor | ${narrowAcc} | ${pct(narrowAcc, total)} |`);
  lines.push(`| broadDecliner | ${broadDec} | ${pct(broadDec, total)} |`);
  lines.push(`| narrowDecliner | ${narrowDec} | ${pct(narrowDec, total)} |`);
  lines.push('');
  lines.push('## Agreement × disagreement heatmap');
  lines.push('');
  for (const [k, v] of top(heat, 20)) lines.push(`- \`${k}\` — ${v}`);
  lines.push('');
  lines.push('## Top 10 playable-tension exhibits (redacted)');
  lines.push('');
  lines.push(exhibits(byTension).join('\n'));
  lines.push('## Top 10 broad_accept_narrow_decline exhibits (redacted)');
  lines.push('');
  lines.push(exhibits(byBroadAccNarrowDec).join('\n'));
  lines.push('## Top 10 narrow_accept_broad_decline exhibits (redacted)');
  lines.push('');
  lines.push(exhibits(byNarrowAccBroadDec).join('\n'));
  lines.push('## Deterministic rule candidates (advisory only — none auto-wired)');
  lines.push('');
  lines.push('- `shouldPromptForReceipts` — offer evidence-prompt UI when reply.replyFunction === ask_source.');
  lines.push('- `shouldPromptQuoteExactBit` — offer quote-anchor UI when reply.replyFunction === ask_quote.');
  lines.push('- `shouldSuggestNarrowScope` — surface narrow_scope move when disagreementType === scope or class is broad_accept_narrow_decline with scope axis.');
  lines.push('- `shouldSuggestDefineTerm` — surface define-term move when disagreementType === definition.');
  lines.push('- `shouldSuggestBranchThread` — branch_prompt when replyFunction === branch_tangent OR class === tangent_or_joke.');
  lines.push('- `shouldOfferConcedeSmallPoint` — concession_prompt when narrowAcceptor && disagreementScore >= 0.3.');
  lines.push('- `shouldShowMixedAgreementDisagreementStatus` — resting_status UI cue when coexistenceScore >= 0.4.');
  lines.push('- `shouldGradeAsBroadAcceptNarrowDecline` — grading_system flag derived from `MixedAgreementFlags`.');
  lines.push('');
  lines.push('## Limitations');
  lines.push('');
  lines.push('- This is a tiny pilot, not a representative sample.');
  lines.push('- No truth scoring. No moderation. No user profiling.');
  lines.push('- Deterministic classifier only; xAI was off.');
  lines.push('- Outputs are advisory; every interpretation carries `userReviewRequired: true`.');
  lines.push('- Volume caps: ≤ 5 stories, ≤ 3 posts/story, ≤ 12 replies/post, ≤ 180 reply pairs total.');
  lines.push('');
  lines.push('## Compliance');
  lines.push('');
  lines.push('- [x] Official X API only (no scraping, no browser automation).');
  lines.push('- [x] No raw post IDs / handles / URLs / emails / auth headers in this report.');
  lines.push('- [x] xAI not called.');
  lines.push('- [x] No moderation recommendations; outputs are advisory.');
  lines.push('- [x] No truth claims; no winner / loser; no bad-faith / liar / extremist labels.');
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv);
  const env = loadEngagementEnv();

  console.log('[tiny-pilot] env: ' + JSON.stringify(snapshotForLog(env)));

  // ── Refusals ──
  if (!args.pilot) {
    console.log('[tiny-pilot] dry mode — no X API calls. Pass --pilot to run live.');
    return 0;
  }
  if (!env.fileExists) return summarizeRefusal('.env.engagement-intelligence is missing');
  if (!env.enableXApi) return summarizeRefusal('ENGAGEMENT_INTEL_ENABLE_X_API is not true');
  if (!env.hasXBearer) return summarizeRefusal('X_BEARER_TOKEN is missing');
  if (env.enableXai && !args.allowXai) return summarizeRefusal('ENGAGEMENT_INTEL_ENABLE_XAI=true but --allow-xai was not passed; Stage 6.1.3.3 keeps xAI off');

  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  ensureDir(RAW_DIR); ensureDir(REDACTED_DIR); ensureDir(REPORT_DIR);

  // ── News fetch ──
  console.log('[tiny-pilot] fetching news stories…');
  const stories = await fetchNewsStories(env);
  console.log(`[tiny-pilot] stories=${stories.length}`);
  if (stories.length === 0) return summarizeRefusal('no stories returned — aborting');

  // ── Root post lookup ──
  const allClusterIds = stories.flatMap((s) => s._clusterRawIds || []);
  const uniqueIds = Array.from(new Set(allClusterIds)).slice(0, Math.min(allClusterIds.length, 100));
  console.log(`[tiny-pilot] looking up ${uniqueIds.length} cluster post IDs`);
  const lookedUp = await lookupTweets(uniqueIds);
  const roots = pickTopRootsPerStory(stories, lookedUp, env.maxPostsPerStory);
  console.log(`[tiny-pilot] selected ${roots.length} root posts (cap ${env.maxNewsStories} × ${env.maxPostsPerStory})`);

  // Persist raw roots locally (gitignored) so xReplyCollect can reuse them.
  const rootsFile = path.join(RAW_DIR, `${runId}-roots.json`);
  fs.writeFileSync(rootsFile, JSON.stringify(roots, null, 2));

  // ── Reply fetch ──
  const redactedFile = path.join(REDACTED_DIR, `${runId}-reply-pairs.jsonl`);
  console.log('[tiny-pilot] fetching replies…');
  const replyResult = await liveCollectReplies(env, roots, redactedFile, runId);
  console.log(`[tiny-pilot] redacted reply pairs: ${replyResult.totalReplies} → ${path.relative(REPO_ROOT, redactedFile)}`);

  // ── Analyze + report ──
  if (replyResult.totalReplies === 0) {
    console.warn('[tiny-pilot] no reply pairs collected; skipping analyzer');
  }
  const pairs = replyResult.totalReplies > 0 ? buildAnalyzerInput(redactedFile) : [];
  const interpretations = await runAnalyzerAndReport({ pairs, runId });
  // Carry redacted text into the interpretation for exhibit rendering.
  for (let i = 0; i < interpretations.length; i++) {
    interpretations[i]._rootTextRedacted = pairs[i].rootText;
    interpretations[i]._replyTextRedacted = pairs[i].replyText;
  }
  const bucketsUsed = Array.from(new Set(roots.map((r) => r._queryBucket).filter(Boolean)));
  const md = buildReport({
    runId,
    scenarios: stories,
    rootCount: roots.length,
    interpretations,
    bucketsUsed,
  });
  const reportPath = path.join(REPORT_DIR, `${new Date().toISOString().slice(0, 10)}-x-news-reply-pilot.md`);
  fs.writeFileSync(reportPath, md);
  console.log(`[tiny-pilot] report: ${path.relative(REPO_ROOT, reportPath)}`);
  console.log(`[tiny-pilot] local redacted JSONL: ${path.relative(REPO_ROOT, redactedFile)}`);
  console.log('[tiny-pilot] done.');
  return 0;
}

if (require.main === module) {
  main().then((c) => process.exit(c || 0)).catch((err) => { console.error('[tiny-pilot][fatal]', String(err.message).slice(0, 300)); process.exit(99); });
}

module.exports = {
  parseArgs,
  extractClusterIds,
  pickTopRootsPerStory,
  buildAnalyzerInput,
  buildReport,
};
