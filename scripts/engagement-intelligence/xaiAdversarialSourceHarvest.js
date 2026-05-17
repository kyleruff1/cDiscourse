#!/usr/bin/env node
/**
 * Stage 6.1.9 — xAI X Search adversarial source harvester (CLI).
 *
 * Calls `xaiXSearchClient.searchPosts` per topic bucket, then for each source
 * `xaiXSearchClient.searchReplies`, then classifies every reply via
 * `xaiDissentDetector.classifyReply` (deterministic; no AI), then picks the
 * first usable dissent.
 *
 * Output: a single JSONL file under `logs/engagement-intelligence/` with the
 * Stage 6.1.9 normalized shape per source:
 *
 *   {
 *     "sourceMode": "xai_x_search",
 *     "sourceQuery": "...",
 *     "sourcePost": { redactedText, issueFrame, popularityBucket,
 *                     sourceChainRisk, platformSupportWarning },
 *     "candidateReplies": [{ rank, redactedText, agreementScore,
 *                            disagreementScore, coexistenceScore,
 *                            uncertaintyScore, primaryStance,
 *                            disagreementType, replyFunction,
 *                            dissentStrength, sourceChainRisk, abuseRisk,
 *                            evidentiaryRisk, amplificationRisk,
 *                            usableForBotDebate, reason }],
 *     "selectedDissent": { rank, redactedText, dissentSource,
 *                          playableSkeleton: { targetExcerpt,
 *                                              disagreementAxis,
 *                                              mechanism, evidenceDebt,
 *                                              antiAmplificationNote } }
 *   }
 *
 * Gates (live mode requires ALL):
 *   - `.env.engagement-intelligence` present
 *   - `ENGAGEMENT_INTEL_ENABLE_XAI=true`
 *   - `XAI_API_KEY` non-empty
 *   - `--pilot` on CLI
 *
 * Dry mode: makes ZERO network calls. Reads the canonical synthetic fixture
 * at `fixtures/engagement-intelligence/xai-adversarial-dry-fixture.json`
 * and produces the same JSONL shape so downstream consumers can be tested
 * without keys or quota.
 *
 * Defaults: --stories 5 --replies 5 --max-replies-per-story 12 --report.
 *
 * No key / Bearer / Authorization / raw response body / raw hostile text /
 * handles / URLs / post-IDs ever land in any logged output or committed
 * artifact. Hostile-source bodies (high/medium abuse risk) are reduced to
 * category placeholders via `convertHostileBody` BEFORE the dissent detector
 * sees them.
 */
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const REPO_ROOT = process.cwd();
const LOG_DIR = path.join(REPO_ROOT, 'logs', 'engagement-intelligence');
const REPORT_DIR = path.join(REPO_ROOT, 'docs', 'testing-runs');
const FIXTURE_PATH = path.join(REPO_ROOT, 'fixtures', 'engagement-intelligence', 'xai-adversarial-dry-fixture.json');

const { searchPosts, searchReplies, XaiXSearchClientDisabled } = require('./xaiXSearchClient');
const { redactRaw, convertHostileBody } = require('./xaiSourceRedactor');
const { classifyReply, selectFirstUsableDissent } = require('./xaiDissentDetector');
const { loadAdversarialSkillBundle, redactedSkillGate } = require('../bot-fixtures/skillFileLoader');
const { buildAdversarialCorpusReport } = require('./xaiAdversarialCorpusReport');

const DEFAULT_TOPIC_BUCKETS = [
  'current debatable news topic',
  'tech policy / platform debate',
  'sports rule change debate',
  'civic policy debate (everyday)',
  'culture / media discussion',
];

function parseArgs(argv) {
  const args = {
    dry: true,
    pilot: false,
    stories: 5,
    replies: 5,
    maxRepliesPerStory: 12,
    seed: 'cdiscourse-stage-6.1.9-harvest',
    fixturePath: FIXTURE_PATH,
    topicBuckets: null,
    fromDate: null,
    toDate: null,
    writeReport: true,
    outDir: LOG_DIR,
    reportName: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry') args.dry = true;
    else if (a === '--pilot') { args.pilot = true; args.dry = false; }
    else if (a === '--stories' && argv[i + 1]) args.stories = Math.max(1, Math.min(300, Number(argv[++i]) || 5));
    else if (a === '--replies' && argv[i + 1]) args.replies = Math.max(1, Math.min(30, Number(argv[++i]) || 5));
    else if (a === '--max-replies-per-story' && argv[i + 1]) args.maxRepliesPerStory = Math.max(1, Math.min(50, Number(argv[++i]) || 12));
    else if (a === '--seed' && argv[i + 1]) args.seed = String(argv[++i]);
    else if (a === '--fixture' && argv[i + 1]) args.fixturePath = String(argv[++i]);
    else if (a === '--topics' && argv[i + 1]) args.topicBuckets = String(argv[++i]).split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--from-date' && argv[i + 1]) args.fromDate = String(argv[++i]);
    else if (a === '--to-date' && argv[i + 1]) args.toDate = String(argv[++i]);
    else if (a === '--no-report') args.writeReport = false;
    else if (a === '--out-dir' && argv[i + 1]) args.outDir = String(argv[++i]);
    else if (a === '--report-name' && argv[i + 1]) args.reportName = String(argv[++i]);
  }
  return args;
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

// ── JSONL writer with skill gate stamping ───────────────────────

class HarvestJsonlStream {
  constructor(filePath, skillGate, runId, sourceMode) {
    ensureDir(path.dirname(filePath));
    this.stream = fs.createWriteStream(filePath);
    this.path = filePath;
    this.skillGate = skillGate;
    this.runId = runId;
    this.sourceMode = sourceMode;
    this.counts = new Map();
  }
  write(stage, extras = {}) {
    const ev = {
      runId: this.runId,
      ts: new Date().toISOString(),
      stage,
      sourceMode: this.sourceMode,
      skillGate: this.skillGate,
      ...extras,
    };
    this.stream.write(JSON.stringify(ev) + '\n');
    this.counts.set(stage, (this.counts.get(stage) || 0) + 1);
  }
  end() { return new Promise((resolve) => this.stream.end(resolve)); }
}

// ── Normalization helpers ──────────────────────────────────────

function popularityBucketFromMetrics(metrics) {
  if (!metrics || typeof metrics !== 'object') return 'unknown';
  const total = (Number(metrics.likeCount) || 0)
              + (Number(metrics.replyCount) || 0) * 2
              + (Number(metrics.retweetCount) || 0) * 3
              + (Number(metrics.viewCount) || 0) / 1000;
  if (!Number.isFinite(total) || total <= 0) return 'unknown';
  if (total < 50) return 'low';
  if (total < 5000) return 'medium';
  return 'high';
}

function classifyReplyToCard(source, rawReply, rankFallback) {
  // Run hostile-source conversion first; if discarded, the placeholder is
  // what the classifier sees (deterministic abuse_risk).
  const conv = convertHostileBody(rawReply.replyTextRedacted || '');
  const replyText = conv.kept ? conv.bodyForAnnotation : conv.placeholder;
  const classification = classifyReply({
    sourceText: source.sourceTextRedacted || source.sourceClaimSummary || '',
    replyText,
    hasEvidence: Array.isArray(rawReply.citationRefs) && rawReply.citationRefs.length > 0,
  });
  return {
    rank: rawReply.providerRank || rankFallback,
    redactedText: replyText,
    agreementScore: classification.agreementScore,
    disagreementScore: classification.disagreementScore,
    coexistenceScore: classification.coexistenceScore,
    uncertaintyScore: classification.uncertaintyScore,
    primaryStance: classification.primaryStance,
    disagreementType: classification.disagreementType,
    replyFunction: classification.replyFunction,
    dissentStrength: classification.dissentStrength,
    sourceChainRisk: classification.sourceChainRisk,
    abuseRisk: classification.abuseRisk,
    evidentiaryRisk: classification.evidentiaryRisk,
    amplificationRisk: classification.amplificationRisk,
    usableForBotDebate: classification.usableForBotDebate,
    reason: classification.reason,
    // Raw kept for the runner to feed into bot move bodies. Hostile bodies
    // are reduced to a placeholder here so no raw abuse leaves the harvest.
    rawForRunner: replyText,
    bodyConversion: { kept: conv.kept, level: conv.level, categories: conv.categories },
  };
}

function buildPlayableSkeleton({ source, selectedCard }) {
  if (!selectedCard) return null;
  const sourceExcerpt = (source.sourceTextRedacted || source.sourceClaimSummary || '').slice(0, 120).replace(/\s+/g, ' ').trim();
  const axis = selectedCard.disagreementType && selectedCard.disagreementType !== 'none'
    ? selectedCard.disagreementType
    : 'source_chain';
  const mechanism = axis === 'source_chain'
    ? 'Primary-source line + mechanism, not slogan + virality.'
    : `Press on the ${axis}: the mechanism is asserted, not shown.`;
  return {
    targetExcerpt: sourceExcerpt,
    disagreementAxis: axis,
    mechanism,
    evidenceDebt: ['primary source for the named mechanism', 'quote anchor for the broad form'],
    antiAmplificationNote: 'popularity is not doing the evidentiary work here; mechanism + receipt does',
  };
}

function buildSyntheticDissentCard(source) {
  // Last-resort synthetic dissent skeleton. NEVER pretends to be a real X
  // reply — the dissentSource string makes that explicit downstream.
  const body = `Quote the part where ${(source.sourceClaimSummary || 'the claim').slice(0, 80)} is shown, not asserted. The mechanism is missing and the source-chain has no primary record. Narrow the claim to what the evidence actually supports.`;
  return {
    rank: 0,
    redactedText: body,
    agreementScore: 0,
    disagreementScore: 0.7,
    coexistenceScore: 0.1,
    uncertaintyScore: 0.1,
    primaryStance: 'weak_disagree',
    disagreementType: 'source_chain',
    replyFunction: 'ask_source',
    dissentStrength: 0.7,
    sourceChainRisk: 'medium',
    abuseRisk: 'none',
    evidentiaryRisk: 'medium',
    amplificationRisk: 'none_observed',
    usableForBotDebate: true,
    reason: 'synthetic dissent skeleton — deterministic; not a real X reply',
    rawForRunner: body,
    bodyConversion: { kept: true, level: 'none', categories: [] },
    syntheticRebuttal: true,
  };
}

// ── Dry-mode (fixture) reader ──────────────────────────────────

function readDryFixture(fixturePath) {
  const raw = fs.readFileSync(fixturePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.sources)) throw new Error('dry fixture is malformed');
  return parsed;
}

function shapeFixtureSourceForHarvest(s, ordinal, runSalt) {
  const idCore = `${runSalt}-src-${String(ordinal).padStart(3, '0')}`;
  return {
    sourceOrdinal: ordinal,
    sourceHash: idCore,
    provider: 'dry_fixture',
    providerQuery: s.topicBucket || 'dry fixture',
    providerRank: s.providerRank || ordinal,
    providerConfidence: s.providerConfidence || 0.5,
    citationRefs: [],
    topicBucket: s.topicBucket || 'unknown',
    sourceTextRedacted: redactRaw(s.sourceTextRedacted),
    sourceClaimSummary: redactRaw(s.sourceClaimSummary || s.sourceTextRedacted.slice(0, 160)),
    sourceClaimType: s.sourceClaimType || 'unclear',
    sourceMetricsIfAvailable: null,
    sourceCollectedAt: new Date().toISOString(),
    redactionApplied: true,
    redactionNotes: 'dry fixture; redactor re-applied',
    popularityBucket: s.popularityBucket || 'unknown',
    replies: (s.replies || []).map((r, i) => ({
      replyOrdinal: r.replyOrdinal || i + 1,
      replyHash: `${idCore}-rep-${String(r.replyOrdinal || i + 1).padStart(2, '0')}`,
      sourceHash: idCore,
      provider: 'dry_fixture',
      providerRank: r.replyOrdinal || i + 1,
      providerConfidence: 0.5,
      topReplyMethod: 'dry_fixture',
      replyTextRedacted: redactRaw(r.replyTextRedacted || ''),
      replyClaimSummary: redactRaw((r.replyTextRedacted || '').slice(0, 160)),
      replyMetricsIfAvailable: null,
      citationRefs: [],
      collectedAt: new Date().toISOString(),
      redactionApplied: true,
      redactionNotes: 'dry fixture',
      kind: r.kind || 'unspecified',
    })),
  };
}

// ── Live harvest loop ──────────────────────────────────────────

async function harvestOneTopic({ topicHint, args, runSalt, jsonl }) {
  let result;
  try {
    result = await searchPosts({
      topicHint,
      count: Math.max(args.stories, 5),
      pilot: args.pilot,
      runSalt,
      fromDate: args.fromDate,
      toDate: args.toDate,
    });
  } catch (err) {
    const reason = String((err && err.reason) || (err && err.message) || 'unknown').slice(0, 200);
    jsonl.write('source_harvest', { mode: 'xai_live_error', topicHint, reason });
    return [];
  }
  jsonl.write('source_harvest', {
    mode: 'xai_live',
    provider: result.provider,
    model: result.model,
    topicHint,
    candidatesReturned: (result.candidates || []).length,
  });
  return (result.candidates || []).map((c) => ({
    ...c,
    sourceTextRedacted: redactRaw(c.sourceTextRedacted),
    sourceClaimSummary: redactRaw(c.sourceClaimSummary),
    topicBucket: topicHint,
    popularityBucket: popularityBucketFromMetrics(c.sourceMetricsIfAvailable),
  }));
}

async function harvestRepliesFor(source, args, runSalt, jsonl) {
  try {
    const { replies } = await searchReplies({
      source,
      count: args.maxRepliesPerStory,
      pilot: args.pilot,
      runSalt,
    });
    jsonl.write('reply_harvest', {
      sourceHash: source.sourceHash,
      repliesReturned: replies.length,
      mode: 'xai_live',
    });
    return replies;
  } catch (err) {
    const reason = String((err && err.reason) || (err && err.message) || 'unknown').slice(0, 200);
    jsonl.write('reply_harvest', { sourceHash: source.sourceHash, mode: 'xai_live_error', reason });
    return [];
  }
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;

  console.log(`[xai-harvest] mode=${args.dry ? 'dry' : 'live'} stories=${args.stories} replies=${args.replies} max-per-story=${args.maxRepliesPerStory}`);

  // ── Skill gate FIRST.
  let bundle;
  try { bundle = loadAdversarialSkillBundle(); }
  catch (err) {
    console.error(`[xai-harvest] SKILL GATE FAILED: ${String(err.message)}`);
    process.exitCode = 2;
    return;
  }
  console.log(`[xai-harvest] skill gate OK · provocateur=${bundle.provocateurHash} · revocateur=${bundle.revocateurHash}`);

  ensureDir(args.outDir);
  const jsonlPath = path.join(args.outDir, `${runId}-xai-adversarial-semantic-corpus.jsonl`);
  const sourceMode = args.dry ? 'dry_fixture' : 'xai_x_search';
  const skillGate = redactedSkillGate(bundle, true);
  const jsonl = new HarvestJsonlStream(jsonlPath, skillGate, runId, sourceMode);
  console.log(`[xai-harvest] jsonl: ${path.relative(REPO_ROOT, jsonlPath)} (gitignored)`);

  jsonl.write('run_start', {
    runId, stories: args.stories, replies: args.replies, maxRepliesPerStory: args.maxRepliesPerStory,
    seed: args.seed, dry: args.dry,
  });
  jsonl.write('skill_validation', { skillGate });

  // ── Source phase.
  const shapedSources = [];
  if (args.dry) {
    let fixture;
    try { fixture = readDryFixture(args.fixturePath); }
    catch (err) {
      console.error(`[xai-harvest] dry fixture load failed: ${err.message}`);
      process.exitCode = 3;
      return;
    }
    const wanted = Math.min(args.stories, fixture.sources.length);
    fixture.sources.slice(0, wanted).forEach((s, i) => {
      shapedSources.push(shapeFixtureSourceForHarvest(s, i + 1, args.seed));
    });
    shapedSources.forEach((s) => {
      jsonl.write('source_harvest', {
        sourceMode: 'dry_fixture',
        sourcePost: {
          redactedText: s.sourceTextRedacted,
          issueFrame: s.topicBucket,
          popularityBucket: s.popularityBucket,
          sourceChainRisk: s.popularityBucket === 'high' ? 'high' : 'unknown',
          platformSupportWarning: s.popularityBucket === 'high',
        },
        sourceOrdinal: s.sourceOrdinal,
        sourceHash: s.sourceHash,
        providerRank: s.providerRank,
        providerConfidence: s.providerConfidence,
        replyCount: s.replies.length,
      });
    });
  } else {
    const topics = args.topicBuckets && args.topicBuckets.length > 0 ? args.topicBuckets : DEFAULT_TOPIC_BUCKETS;
    for (const t of topics) {
      if (shapedSources.length >= args.stories) break;
      const cand = await harvestOneTopic({ topicHint: t, args, runSalt: args.seed, jsonl });
      for (const c of cand) {
        if (shapedSources.length >= args.stories) break;
        const replies = await harvestRepliesFor(c, args, args.seed, jsonl);
        shapedSources.push({
          ...c,
          replies: replies.map((r) => ({ ...r, replyTextRedacted: redactRaw(r.replyTextRedacted), replyClaimSummary: redactRaw(r.replyClaimSummary || '') })),
        });
        jsonl.write('source_harvest', {
          sourceMode: 'xai_x_search',
          sourcePost: {
            redactedText: c.sourceTextRedacted,
            issueFrame: c.topicBucket,
            popularityBucket: c.popularityBucket,
            sourceChainRisk: c.popularityBucket === 'high' ? 'high' : 'unknown',
            platformSupportWarning: c.popularityBucket === 'high',
          },
          sourceOrdinal: c.sourceOrdinal,
          sourceHash: c.sourceHash,
          providerRank: c.providerRank,
          providerConfidence: c.providerConfidence,
          replyCount: replies.length,
        });
      }
    }
  }

  // ── Dissent classification + selection per source.
  let usableDissentCount = 0;
  let syntheticFallbackCount = 0;
  for (const source of shapedSources) {
    const candidateReplies = source.replies.map((r, i) => classifyReplyToCard(source, r, i + 1));
    // Log each classification.
    for (const c of candidateReplies) {
      jsonl.write('dissent_detection', {
        sourceHash: source.sourceHash,
        rank: c.rank,
        classification: {
          agreementScore: c.agreementScore,
          disagreementScore: c.disagreementScore,
          coexistenceScore: c.coexistenceScore,
          uncertaintyScore: c.uncertaintyScore,
          primaryStance: c.primaryStance,
          disagreementType: c.disagreementType,
          replyFunction: c.replyFunction,
          dissentStrength: c.dissentStrength,
          sourceChainRisk: c.sourceChainRisk,
          abuseRisk: c.abuseRisk,
          evidentiaryRisk: c.evidentiaryRisk,
          amplificationRisk: c.amplificationRisk,
          usableForBotDebate: c.usableForBotDebate,
          reason: c.reason,
        },
        bodyConversion: c.bodyConversion,
      });
    }
    // First usable dissent.
    const usable = candidateReplies.find((c) => c.usableForBotDebate);
    let selectedDissent;
    let dissentSource;
    if (usable) {
      usableDissentCount += 1;
      dissentSource = 'xai_x_search';
      selectedDissent = {
        rank: usable.rank,
        redactedText: usable.redactedText,
        dissentSource,
        playableSkeleton: buildPlayableSkeleton({ source, selectedCard: usable }),
      };
    } else {
      syntheticFallbackCount += 1;
      const synth = buildSyntheticDissentCard(source);
      dissentSource = 'synthetic_fallback';
      candidateReplies.push(synth);
      selectedDissent = {
        rank: 0,
        redactedText: synth.redactedText,
        dissentSource,
        playableSkeleton: buildPlayableSkeleton({ source, selectedCard: synth }),
      };
      jsonl.write('synthetic_rebuttal_generated', {
        sourceHash: source.sourceHash,
        scanned: source.replies.length,
        reason: 'no_usable_dissent_after_exhaustion',
      });
    }

    // Emit the normalized per-source record (spec contract).
    jsonl.write('scenario_build', {
      sourceMode,
      sourceQuery: source.providerQuery || source.topicBucket || 'unspecified',
      sourceHash: source.sourceHash,
      sourcePost: {
        redactedText: source.sourceTextRedacted,
        issueFrame: source.topicBucket,
        popularityBucket: source.popularityBucket,
        sourceChainRisk: source.popularityBucket === 'high' ? 'high' : 'unknown',
        platformSupportWarning: source.popularityBucket === 'high',
      },
      candidateReplies: candidateReplies.map((c) => ({
        rank: c.rank,
        redactedText: c.redactedText,
        agreementScore: c.agreementScore,
        disagreementScore: c.disagreementScore,
        coexistenceScore: c.coexistenceScore,
        uncertaintyScore: c.uncertaintyScore,
        primaryStance: c.primaryStance,
        disagreementType: c.disagreementType,
        replyFunction: c.replyFunction,
        dissentStrength: c.dissentStrength,
        sourceChainRisk: c.sourceChainRisk,
        abuseRisk: c.abuseRisk,
        evidentiaryRisk: c.evidentiaryRisk,
        amplificationRisk: c.amplificationRisk,
        usableForBotDebate: c.usableForBotDebate,
        reason: c.reason,
      })),
      selectedDissent,
    });
  }

  jsonl.write('run_summary', {
    runId,
    mode: args.dry ? 'dry' : 'live',
    sourceMode,
    sourcesHarvested: shapedSources.length,
    usableDissentCount,
    syntheticFallbackCount,
  });
  await jsonl.end();
  console.log(`[xai-harvest] done — sources=${shapedSources.length} usable=${usableDissentCount} synthetic=${syntheticFallbackCount}`);

  // ── Committed report.
  if (args.writeReport) {
    ensureDir(REPORT_DIR);
    const date = new Date().toISOString().slice(0, 10);
    const baseName = args.reportName || 'xai-adversarial-corpus-summary';
    const suffix = args.dry ? '-dry' : '';
    const reportPath = path.join(REPORT_DIR, `${date}-${baseName}${suffix}.md`);
    const events = fs.readFileSync(jsonlPath, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    const md = buildAdversarialCorpusReport({
      runId, mode: args.dry ? 'dry' : 'live', sourceMode, bundle, events,
    });
    fs.writeFileSync(reportPath, md);
    console.log(`[xai-harvest] report: ${path.relative(REPO_ROOT, reportPath)}`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    if (err instanceof XaiXSearchClientDisabled) {
      console.error(`[xai-harvest][refusal] ${err.message}`);
      process.exitCode = 2;
    } else {
      console.error('[xai-harvest][fatal]', String(err && err.message || err).slice(0, 400));
      process.exitCode = 99;
    }
  });
}

module.exports = {
  parseArgs,
  popularityBucketFromMetrics,
  classifyReplyToCard,
  buildPlayableSkeleton,
  buildSyntheticDissentCard,
  shapeFixtureSourceForHarvest,
  readDryFixture,
  DEFAULT_TOPIC_BUCKETS,
};
