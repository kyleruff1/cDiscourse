#!/usr/bin/env node
/**
 * Offline analyzer for the engagement-intelligence pipeline.
 *
 * Reads a synthetic fixture (or a redacted local sample file from a future
 * pilot), runs the deterministic scalar over every reply pair, aggregates the
 * results, and writes a committable Markdown epidemiology report.
 *
 * No network. No xAI by default. No Supabase. No live X calls.
 */
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { interpretReplyPair } = require('./agreementScalarJs');
const { buildReportMarkdown } = require('./writeEpidemiologyReport');

const REPO_ROOT = process.cwd();
const SYNTHETIC_PATH = path.join(REPO_ROOT, 'fixtures', 'engagement-intelligence', 'synthetic-news-reply-pairs.json');
const REPORT_DIR = path.join(REPO_ROOT, 'docs', 'testing-runs');

function parseArgs(argv) {
  const args = { synthetic: false, input: null, useXai: false };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--synthetic') args.synthetic = true;
    else if (a === '--input' && rest[i + 1]) args.input = rest[++i];
    else if (a === '--use-xai') args.useXai = true;
  }
  return args;
}

function loadPairs(args) {
  if (args.input) {
    if (!fs.existsSync(args.input)) throw new Error(`input not found: ${args.input}`);
    const raw = fs.readFileSync(args.input, 'utf8');
    // Accept either a fixture JSON (with .pairs) or a JSONL of pair samples.
    if (args.input.endsWith('.jsonl')) {
      return raw.split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (parsed.pairs || []);
  }
  if (args.synthetic) {
    const parsed = JSON.parse(fs.readFileSync(SYNTHETIC_PATH, 'utf8'));
    return parsed.pairs || [];
  }
  // Default: synthetic.
  const parsed = JSON.parse(fs.readFileSync(SYNTHETIC_PATH, 'utf8'));
  return parsed.pairs || [];
}

// Distribution buckets used by the aggregator.
const STANCES = ['strong_agree','weak_agree','mixed_agree_disagree','weak_disagree','strong_disagree','unclear','tangent','joke_or_meme','receipt_request','quote_request'];
const AGREE_TYPES = ['premise','evidence','conclusion','value','framing','context','none'];
const DISAGREE_TYPES = ['fact','definition','causal','value','evidence','logic','scope','framing','none'];

function emptyDist(keys) { const o = {}; for (const k of keys) o[k] = 0; return o; }

function bucketLabel(score) {
  if (score < 0.2) return '0.0-0.2';
  if (score < 0.4) return '0.2-0.4';
  if (score < 0.6) return '0.4-0.6';
  if (score < 0.8) return '0.6-0.8';
  return '0.8-1.0';
}

function buildAggregate(interpretations, source, runId, notes) {
  const stanceDistribution = emptyDist(STANCES);
  const disagreementTypeDistribution = emptyDist(DISAGREE_TYPES);
  const agreementTypeDistribution = emptyDist(AGREE_TYPES);
  const buckets = {};
  const fnCounts = new Map();
  let excluded = 0;
  for (const i of interpretations) {
    if (i.excluded) { excluded++; continue; }
    const v = i.finalVector;
    stanceDistribution[v.primaryStance]++;
    disagreementTypeDistribution[v.disagreementType]++;
    agreementTypeDistribution[v.agreementType]++;
    const key = `${bucketLabel(v.agreementScore)} × ${bucketLabel(v.disagreementScore)}`;
    buckets[key] = (buckets[key] || 0) + 1;
    fnCounts.set(v.replyFunction, (fnCounts.get(v.replyFunction) || 0) + 1);
  }
  const topReplyFunctions = [...fnCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([replyFunction, count]) => ({ replyFunction, count }));

  // Rule candidates (JS-side mirror of ruleCandidates.ts logic — simpler).
  const exampleByPredicate = new Map();
  function addExample(p, id) {
    const arr = exampleByPredicate.get(p) || [];
    if (arr.length < 3) arr.push(id);
    exampleByPredicate.set(p, arr);
  }
  let r = 0, q = 0, sc = 0, df = 0, br = 0, mx = 0, cn = 0;
  for (const i of interpretations) {
    if (i.excluded) continue;
    const v = i.finalVector;
    if (v.replyFunction === 'ask_source') { r++; addExample('shouldPromptForReceipts', i.pairId); }
    if (v.replyFunction === 'ask_quote') { q++; addExample('shouldPromptQuoteExactBit', i.pairId); }
    if (v.replyFunction === 'narrow_scope' || v.disagreementType === 'scope') { sc++; addExample('shouldSuggestNarrowScope', i.pairId); }
    if (v.replyFunction === 'ask_definition' || v.disagreementType === 'definition') { df++; addExample('shouldSuggestDefineTerm', i.pairId); }
    if (v.replyFunction === 'branch_tangent') { br++; addExample('shouldSuggestBranchThread', i.pairId); }
    if (v.coexistenceScore >= 0.4) { mx++; addExample('shouldShowMixedAgreementDisagreementStatus', i.pairId); }
    if (v.agreementType !== 'none' && v.disagreementScore >= 0.3 && v.agreementScore >= 0.25) {
      cn++;
      addExample('shouldOfferConcedeSmallPoint', i.pairId);
    }
  }
  const topRuleCandidates = [];
  function pushRC(predicate, target, title, pattern, condition, risk) {
    topRuleCandidates.push({
      ruleId: `rc-${predicate}`, title, observedPattern: pattern,
      deterministicPredicateName: predicate, conditionDescription: condition,
      targetAppSurface: target,
      examplePairIds: exampleByPredicate.get(predicate) || [],
      riskNotes: risk, enabledByDefault: false,
    });
  }
  if (r) pushRC('shouldPromptForReceipts','evidence_prompt','Offer receipts prompt when reply asks for source',`${r} replies asked for sources`,'reply.replyFunction === ask_source',['Advisory only; does not gate posting.']);
  if (q) pushRC('shouldPromptQuoteExactBit','quote_anchor','Offer quote-anchor prompt when reply asks for the exact bit',`${q} replies requested a quote anchor`,'reply.replyFunction === ask_quote',['Do not auto-quote.']);
  if (sc) pushRC('shouldSuggestNarrowScope','move_navigator','Suggest narrow_scope move when scope challenge detected',`${sc} replies challenged scope`,'reply.disagreementType === scope',['Narrowing is a tactic, not a verdict.']);
  if (df) pushRC('shouldSuggestDefineTerm','move_navigator','Suggest define-term move when definition challenge detected',`${df} replies asked for a definition`,'reply.disagreementType === definition',['Definitions are local to the room.']);
  if (br) pushRC('shouldSuggestBranchThread','branch_prompt','Suggest branch when reply reads as tangent',`${br} replies introduced a tangent`,'reply.replyFunction === branch_tangent',['Branch does not delete original thread.']);
  if (mx) pushRC('shouldShowMixedAgreementDisagreementStatus','resting_status','Surface mixed-agreement status when coexistence is high',`${mx} replies had coexistence >= 0.4`,'reply.coexistenceScore >= 0.4',['Mixed state is a cue, not a verdict.']);
  if (cn) pushRC('shouldOfferConcedeSmallPoint','concession_prompt','Offer concede-small-point prompt when reply both agrees on premise and disputes evidence',`${cn} replies showed partial agreement plus substantive disagreement`,'reply.agreementScore >= 0.25 AND reply.disagreementScore >= 0.3',['Concession is offered, never forced.']);

  return {
    runId,
    collectedAt: new Date().toISOString(),
    source,
    storyCount: 0,
    rootPostCount: interpretations.length,
    replyPairCount: interpretations.length,
    excludedCount: excluded,
    stanceDistribution,
    agreementDisagreementHeatmap: { buckets },
    disagreementTypeDistribution,
    agreementTypeDistribution,
    topReplyFunctions,
    topRuleCandidates,
    notes: notes || '',
  };
}

function main() {
  const args = parseArgs(process.argv);
  const pairs = loadPairs(args);
  if (pairs.length === 0) {
    console.error('[analyze] no pairs loaded; aborting');
    process.exit(2);
  }
  const interpretations = pairs.map((p) => interpretReplyPair(p));
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const source = args.synthetic || !args.input ? 'synthetic' : 'x_api_pilot';
  const aggregate = buildAggregate(interpretations, source, runId, args.synthetic
    ? 'Synthetic-only run. No X API call. No xAI call. Deterministic scalar only.'
    : 'Offline analysis of a previously-collected local sample.');

  // Write the report.
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const date = aggregate.collectedAt.slice(0, 10);
  const suffix = source === 'synthetic' ? 'synthetic' : 'pilot';
  const outPath = path.join(REPORT_DIR, `${date}-engagement-epidemiology-${suffix}.md`);
  fs.writeFileSync(outPath, buildReportMarkdown(aggregate, interpretations));

  // Console summary.
  console.log(`[analyze] wrote ${outPath}`);
  console.log(`[analyze] pairs=${pairs.length} excluded=${aggregate.excludedCount}`);
  console.log('[analyze] stances: ' + Object.entries(aggregate.stanceDistribution)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k}=${v}`).join(', '));
  console.log('[analyze] no X API calls, no xAI calls, no service-role usage');
}

if (require.main === module) {
  try { main(); }
  catch (err) { console.error('[analyze][fatal]', err.message); process.exit(99); }
}

module.exports = { parseArgs, buildAggregate };
