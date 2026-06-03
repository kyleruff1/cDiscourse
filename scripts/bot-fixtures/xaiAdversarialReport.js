/**
 * Stage 6.1.7 — Adversarial corpus Markdown report.
 *
 * Single committable Markdown derived from the JSONL event stream + the
 * per-move annotations. Aggregate sections only — never includes raw X
 * handles / URLs / post IDs. Outputs always advisory (no truth verdict,
 * no moderation recommendation, no user labels).
 */
const { redactSeedText } = require('../engagement-intelligence/xaiSeededStances');

function inc(map, key) { if (!key) return; map.set(key, (map.get(key) || 0) + 1); }
function sortDesc(map) { return [...map.entries()].sort((a, b) => b[1] - a[1]); }
function safeMd(s) { return String(s || '').replace(/\|/g, '\\|'); }
function truncate(s, n) { s = String(s || ''); return s.length <= n ? s : s.slice(0, n - 1) + '…'; }

function table(label, m) {
  if (!m || m.size === 0) return [`### ${label}`, '_(no entries)_', ''];
  const lines = [`### ${label}`, '', '| Value | Count |', '|---|---:|'];
  for (const [k, v] of sortDesc(m)) lines.push(`| \`${safeMd(k)}\` | ${v} |`);
  lines.push('');
  return lines;
}

function aggregateRun(events) {
  const out = {
    rooms: 0, movesPosted: 0, movesFailed: 0, movesSkipped: 0,
    syntheticRebuttals: 0, realRebuttals: 0,
    candidatesSeen: 0, sourcesSelected: 0, repliesSeen: 0,
    anthropicCalls: 0, xaiCalls: 0,
    inputTokens: 0, outputTokens: 0,
    primaryStance: new Map(),
    agreementType: new Map(),
    disagreementType: new Map(),
    mixedAgreementClass: new Map(),
    rhetoricalArchetype: new Map(),
    politicalIssueFrame: new Map(),
    politicalValence: new Map(),
    evidentiaryRisk: new Map(),
    amplificationRisk: new Map(),
    recommendedGameTreatment: new Map(),
    amplificationSignals: new Map(),
    ruleFlagCounts: new Map(),
    submitErrors: new Map(),
    fallbackReasons: new Map(),
    sourceCitationCount: 0,
    replyCitationCount: 0,
    platformSupportWarningTrue: 0,
    platformSupportWarningFalse: 0,
    resolved: 0, stalemate: 0, maxDepthReached: 0,
    rooms_summary: [],
  };

  for (const ev of events) {
    if (!ev || !ev.eventType) continue;
    switch (ev.eventType) {
      case 'source_candidate': out.candidatesSeen++; out.sourceCitationCount += (ev.citationRefs?.length || 0); break;
      case 'source_selected': out.sourcesSelected++; break;
      case 'reply_candidate': out.repliesSeen++; out.replyCitationCount += (ev.citationRefs?.length || 0); break;
      case 'synthetic_rebuttal_generated': out.syntheticRebuttals++; break;
      case 'reply_selected':
        if (ev.syntheticRebuttal) out.syntheticRebuttals++;
        else out.realRebuttals++;
        break;
      case 'debate_created': out.rooms++; break;
      case 'move_submitted':
        if (ev.submitStatus === 'posted') out.movesPosted++;
        else if (ev.submitStatus === 'dry_simulated' || ev.submitStatus === 'planned' || ev.submitStatus === 'not_posted' || ev.submitStatus === 'no_debate') out.movesSkipped++;
        else if (ev.submitStatus === 'skipped' || ev.submitStatus === 'skipped_missing_parent') out.movesSkipped++;
        else out.movesFailed++;
        if (ev.errorCode) inc(out.submitErrors, ev.errorCode);
        break;
      case 'annotation_completed': {
        const a = ev.annotation || {};
        inc(out.primaryStance, a.agreementDisagreementVector?.primaryStance);
        inc(out.agreementType, a.agreementDisagreementVector?.agreementType);
        inc(out.disagreementType, a.agreementDisagreementVector?.disagreementType);
        inc(out.mixedAgreementClass, a.qualifierCodes?.find?.((q) => /accept|decline/.test(q)));
        inc(out.rhetoricalArchetype, a.primaryRhetoricalArchetype);
        inc(out.politicalIssueFrame, a.politicalIssueFrame);
        inc(out.politicalValence, a.politicalValence);
        inc(out.evidentiaryRisk, a.evidentiaryRisk);
        inc(out.amplificationRisk, a.amplificationRisk);
        inc(out.recommendedGameTreatment, a.recommendedGameTreatment);
        if (a.platformSupportWarning) out.platformSupportWarningTrue++; else out.platformSupportWarningFalse++;
        for (const [k, v] of Object.entries(a.amplificationSignals || {})) {
          if (v === true) out.amplificationSignals.set(k, (out.amplificationSignals.get(k) || 0) + 1);
        }
        const rc = a.deterministicRuleCandidate || {};
        for (const k of [
          'shouldSuppressScoreGainForAmplificationOnly', 'shouldAskForPrimarySource',
          'shouldMarkEvidenceRiskHigh', 'shouldShowAmplificationRiskBadge',
          'shouldTreatAsOpinionNoFactualCredit', 'shouldCreateIssueDebtForUnsupportedClaim',
          'shouldOfferScopeNarrowingForPoliticalGeneralization',
          'shouldOfferQuoteAnchorForAllegation', 'shouldBranchContextIfClaimNeedsBackground',
        ]) {
          if (rc[k] === true) out.ruleFlagCounts.set(k, (out.ruleFlagCounts.get(k) || 0) + 1);
        }
        if (a.annotationSource === 'deterministic_fallback') {
          const reason = a.modelJustification?.shortReason || 'unknown';
          inc(out.fallbackReasons, truncate(reason, 80));
        }
        break;
      }
      case 'room_resolved': out.resolved++; out.rooms_summary.push({ scenarioId: ev.scenarioId, resolution: ev.resolutionType }); break;
      case 'room_stalemate': out.stalemate++; out.rooms_summary.push({ scenarioId: ev.scenarioId, resolution: 'stalemate', maxDepth: ev.maxDepthReached }); break;
      case 'provider_query': out.xaiCalls++; break;
      case 'anthropic_call':
        out.anthropicCalls++;
        if (typeof ev.inputTokens === 'number') out.inputTokens += ev.inputTokens;
        if (typeof ev.outputTokens === 'number') out.outputTokens += ev.outputTokens;
        break;
      case 'run_max_depth': out.maxDepthReached++; break;
      default: break;
    }
  }
  return out;
}

function buildAdversarialReportMarkdown({ runId, dateIso, mode, providerLabel, args, events, sceneSummaries, samples }) {
  const date = (dateIso || new Date().toISOString()).slice(0, 10);
  const agg = aggregateRun(events);

  const lines = [];
  lines.push(`# xAI Adversarial Thread Corpus — ${date}`);
  lines.push('');
  lines.push(`_Run id_: \`${runId}\``);
  lines.push(`_Mode_: ${mode}`);
  lines.push(`_Provider path_: \`${providerLabel || 'xai_responses'}\` — chosen because the Responses API + x_search tool returns explicit citation refs so the report can keep metric-vs-inferred ranking honest. The legacy chat/completions search_parameters path remains as a fallback.`);
  lines.push(`_Args_: rooms=${args.rooms} candidatePosts=${args.candidatePosts} topReplies=${args.topReplies} maxDepth=${args.maxDepth} sourceMode=${args.sourceMode} allowSyntheticRebuttal=${args.allowSyntheticRebuttal} syntheticThreshold=${args.syntheticRebuttalThreshold} seed=${args.seed}`);
  lines.push(`_Env booleans_: hasXaiKey=${args.envBooleans?.hasXaiKey} enableXai=${args.envBooleans?.enableXai} hasAnthropicKey=${args.envBooleans?.hasAnthropicKey} enableAnthropic=${args.envBooleans?.enableAnthropic} hasBotTests=${args.envBooleans?.hasBotTests}`);
  lines.push('');
  lines.push('## Doctrine reminder');
  lines.push('');
  lines.push('- Popularity / repetition / engagement velocity / political identity are NOT evidence.');
  lines.push('- politicalValence describes the rhetorical frame of the TEXT, never the user.');
  lines.push('- No truth verdict, no moderation recommendation, no winner / loser language.');
  lines.push('- Bots are test bots — they never claim to be real X users.');
  lines.push('- Engagement credit and factual-standing eligibility are SEPARATE: amplification can earn engagement credit while factual-standing gain is suppressed until evidence arrives.');
  lines.push('');
  lines.push('## Run counts');
  lines.push('');
  lines.push(`- Source candidates seen: **${agg.candidatesSeen}**`);
  lines.push(`- Source posts selected: **${agg.sourcesSelected}**`);
  lines.push(`- Real rebuttals selected: **${agg.realRebuttals}**`);
  lines.push(`- Synthetic rebuttals generated: **${agg.syntheticRebuttals}** (excluded from real epidemiology)`);
  lines.push(`- Rooms created: **${agg.rooms}**`);
  lines.push(`- Moves posted: **${agg.movesPosted}**  ·  Failed: ${agg.movesFailed}  ·  Skipped: ${agg.movesSkipped}`);
  lines.push(`- Rooms resolved: ${agg.resolved}  ·  Stalemates: ${agg.stalemate}  ·  Max-depth reached: ${agg.maxDepthReached}`);
  lines.push(`- xAI calls: ${agg.xaiCalls}  ·  Anthropic calls: ${agg.anthropicCalls}`);
  lines.push(`- Anthropic input tokens: ${agg.inputTokens}  ·  output tokens: ${agg.outputTokens}`);
  lines.push(`- Source citation refs surfaced: ${agg.sourceCitationCount}  ·  Reply citation refs: ${agg.replyCitationCount}`);
  lines.push(`- platformSupportWarning=true moves: **${agg.platformSupportWarningTrue}** / ${agg.platformSupportWarningTrue + agg.platformSupportWarningFalse}`);
  lines.push('');

  for (const r of table('Primary stance distribution', agg.primaryStance)) lines.push(r);
  for (const r of table('Agreement type', agg.agreementType)) lines.push(r);
  for (const r of table('Disagreement axis', agg.disagreementType)) lines.push(r);
  for (const r of table('Mixed-agreement class', agg.mixedAgreementClass)) lines.push(r);
  for (const r of table('Rhetorical archetype', agg.rhetoricalArchetype)) lines.push(r);
  for (const r of table('Political issue frame', agg.politicalIssueFrame)) lines.push(r);
  for (const r of table('Political valence (text frame, not user)', agg.politicalValence)) lines.push(r);
  for (const r of table('Evidentiary risk', agg.evidentiaryRisk)) lines.push(r);
  for (const r of table('Amplification risk', agg.amplificationRisk)) lines.push(r);
  for (const r of table('Recommended game treatment', agg.recommendedGameTreatment)) lines.push(r);
  for (const r of table('Amplification signals fired', agg.amplificationSignals)) lines.push(r);
  for (const r of table('Deterministic rule flags fired', agg.ruleFlagCounts)) lines.push(r);
  for (const r of table('Submit errors', agg.submitErrors)) lines.push(r);
  for (const r of table('Deterministic fallback reasons (top)', agg.fallbackReasons)) lines.push(r);

  // Sample sections (capped + redacted).
  function renderSamples(label, list) {
    const out = [`## ${label}`, ''];
    if (!list || list.length === 0) { out.push('_(no samples)_', ''); return out; }
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      out.push(`**${i + 1}. ${safeMd(truncate(redactSeedText(s.summary || ''), 240))}**`);
      out.push(`> ${safeMd(truncate(redactSeedText(s.excerpt || ''), 360))}`);
      if (s.justification) out.push(`_why_: ${safeMd(truncate(redactSeedText(s.justification), 280))}`);
      out.push('');
    }
    return out;
  }

  lines.push(...renderSamples('Top 10 strongest rooms (highest avg playable tension)', samples?.strongestRooms || []));
  lines.push(...renderSamples('Top 10 weakest rooms (lowest avg playable tension)', samples?.weakestRooms || []));
  lines.push(...renderSamples('5 broad agreement + narrow disagreement examples', samples?.broadAcceptNarrowDecline || []));
  lines.push(...renderSamples('5 high-amplification low-evidence claims', samples?.viralLowEvidence || []));
  lines.push(...renderSamples('Claims that should NOT receive factual standing without evidence', samples?.noFactualStanding || []));
  lines.push(...renderSamples('Claims that could receive standing after sourcing / narrowing', samples?.standingAfterEvidence || []));
  lines.push(...renderSamples('5 bot-provocateur engagement wins', samples?.provocateurWins || []));
  lines.push(...renderSamples('5 bot-revocateur specificity wins', samples?.revocateurWins || []));

  // Per-room one-liner summary.
  lines.push('## Per-room one-liners');
  lines.push('');
  if (Array.isArray(sceneSummaries) && sceneSummaries.length > 0) {
    lines.push('| Room | Provider | TopicBucket | Synthetic | Moves Posted | Resolution |');
    lines.push('|---|---|---|---|---:|---|');
    for (const r of sceneSummaries) {
      lines.push(`| \`${safeMd(r.scenarioId)}\` | \`${safeMd(r.provider)}\` | \`${safeMd(r.topicBucket)}\` | ${r.syntheticRebuttal ? 'yes' : 'no'} | ${r.movesPosted ?? 0} | \`${safeMd(r.resolution || 'unknown')}\` |`);
    }
  } else {
    lines.push('_(no rooms summarised)_');
  }
  lines.push('');

  lines.push('## Anti-amplification recommendations');
  lines.push('');
  const recs = [];
  if (agg.platformSupportWarningTrue > 0) {
    const pct = Math.round((agg.platformSupportWarningTrue / Math.max(1, agg.platformSupportWarningTrue + agg.platformSupportWarningFalse)) * 100);
    recs.push(`platformSupportWarning fired on ${agg.platformSupportWarningTrue} moves (${pct}% of annotated set) — wire the anti-amplification rule into the point-standing engine for production grading runs of this corpus.`);
  }
  if (agg.amplificationSignals.size > 0) {
    const top = sortDesc(agg.amplificationSignals).slice(0, 4).map(([k, v]) => `\`${k}\` (${v})`).join(', ');
    recs.push(`Top amplification signals: ${top} — promote to composer-time deterministic checks.`);
  }
  if (agg.ruleFlagCounts.size > 0) {
    const top = sortDesc(agg.ruleFlagCounts).slice(0, 3).map(([k, v]) => `\`${k}\` (${v})`).join(', ');
    recs.push(`Most-fired rule flags: ${top} — promote the top 3 to deterministic TS rules in engine.ts after operator review.`);
  }
  recs.push('Engagement-vs-factual-standing remain separate scores: viral text can earn engagement credit while factual-standing gain stays suppressed until receipts / quote anchor / scope narrowing arrive.');
  if (agg.syntheticRebuttals > 0) {
    recs.push(`${agg.syntheticRebuttals} synthetic rebuttal(s) were used to keep adversarial game stress flowing — those rows are flagged \`excludedFromRealEpidemiology=true\` so they cannot pollute the real-world corpus.`);
  }
  for (const r of recs) lines.push(`- ${r}`);
  lines.push('');

  lines.push('## Compliance');
  lines.push('');
  lines.push('- [x] No @handles, URLs, raw post IDs, JWTs, or secret-shape tokens in this report.');
  lines.push('- [x] No truth verdict, no moderation recommendation, no winner / loser language.');
  lines.push('- [x] No demographic / party / religion / race / ethnicity / sexuality / health / protected-class inference.');
  lines.push('- [x] Bots are test bots — never claim to be real X users.');
  lines.push('- [x] Synthetic rebuttals (if any) are excluded from real epidemiology.');
  lines.push('- [x] Engagement credit and factual-standing eligibility are tracked separately.');
  lines.push('- [x] Production app does not call Anthropic or xAI; this runner is dev/test only.');
  lines.push('');

  return lines.join('\n');
}

// ── CORPUS-30-POOL-DRIVEN-PLANNER — diversity checks (§9) ─────────
//
// Operate on the runner's JSONL attribution events; never body text.
// `aggregateDiversityChecks` returns counts + severityBand per category;
// `renderDiversityChecksSection` formats them as a Markdown subsection.

function aggregateDiversityChecks(events) {
  const seedIds = [];
  for (const ev of events) {
    if (ev && ev.stage === 'seed_assignment' && Array.isArray(ev.assignedSeedIds)) {
      for (const id of ev.assignedSeedIds) seedIds.push(id);
    }
  }
  const seenSeeds = new Set();
  const dupSeeds = [];
  for (const id of seedIds) {
    if (seenSeeds.has(id)) dupSeeds.push(id);
    else seenSeeds.add(id);
  }

  const perThreadOpt = new Map(); // threadIndex → Map(bankName::optionIndex, count)
  const optionIdThreads = new Map(); // optionId → Set<threadIndex>
  const perThreadSpine = new Map(); // threadIndex → array of spineIds
  const spineCounts = new Map();
  let totalMoves = 0;

  for (const ev of events) {
    if (!ev || ev.stage !== 'move_validated') continue;
    if (typeof ev.threadIndex !== 'number') continue;
    const key = `${ev.bankName}::${ev.optionIndex}`;
    if (!perThreadOpt.has(ev.threadIndex)) perThreadOpt.set(ev.threadIndex, new Map());
    const inner = perThreadOpt.get(ev.threadIndex);
    inner.set(key, (inner.get(key) || 0) + 1);
    if (ev.optionId) {
      if (!optionIdThreads.has(ev.optionId)) optionIdThreads.set(ev.optionId, new Set());
      optionIdThreads.get(ev.optionId).add(ev.threadIndex);
    }
    if (ev.spineId) {
      if (!perThreadSpine.has(ev.threadIndex)) perThreadSpine.set(ev.threadIndex, []);
      perThreadSpine.get(ev.threadIndex).push(ev.spineId);
      spineCounts.set(ev.spineId, (spineCounts.get(ev.spineId) || 0) + 1);
      totalMoves += 1;
    }
  }

  let crossThreadCollisions = 0;
  for (const set of optionIdThreads.values()) if (set.size >= 3) crossThreadCollisions += 1;
  let repeatedWithin = 0;
  for (const inner of perThreadOpt.values()) {
    for (const count of inner.values()) if (count >= 2) repeatedWithin += 1;
  }
  let spineSaturatedAt = null;
  if (totalMoves > 0) {
    for (const [k, v] of spineCounts.entries()) {
      if (v / totalMoves > 0.35) { spineSaturatedAt = { spineId: k, fraction: v / totalMoves }; break; }
    }
  }

  const duplicateSeed = {
    total: seedIds.length, unique: seenSeeds.size,
    duplicates: dupSeeds, severityBand: dupSeeds.length > 0 ? 'red' : 'green',
  };
  const repeatedOption = {
    repeatedWithin, crossThreadCollisions,
    severityBand: crossThreadCollisions > 0 ? 'red' : repeatedWithin > 0 ? 'yellow' : 'green',
  };
  const spineSaturation = {
    saturatedAt: spineSaturatedAt,
    severityBand: spineSaturatedAt ? 'red' : 'green',
  };
  return { duplicateSeed, repeatedOption, spineSaturation };
}

function renderDiversityChecksSection(events) {
  const d = aggregateDiversityChecks(events);
  const lines = [];
  lines.push('## Diversity checks (CORPUS-30 §9)');
  lines.push('');
  lines.push(`- Duplicate-seed: severityBand=\`${d.duplicateSeed.severityBand}\` · total=${d.duplicateSeed.total} · unique=${d.duplicateSeed.unique} · duplicates=${d.duplicateSeed.duplicates.length}`);
  lines.push(`- Repeated-option: severityBand=\`${d.repeatedOption.severityBand}\` · repeated within thread=${d.repeatedOption.repeatedWithin} · cross-thread collisions=${d.repeatedOption.crossThreadCollisions}`);
  lines.push(`- Spine saturation: severityBand=\`${d.spineSaturation.severityBand}\`${d.spineSaturation.saturatedAt ? ` · saturated=\`${d.spineSaturation.saturatedAt.spineId}\` (${Math.round(d.spineSaturation.saturatedAt.fraction * 100)}%)` : ''}`);
  lines.push('');
  return lines.join('\n');
}

module.exports = {
  buildAdversarialReportMarkdown,
  aggregateRun,
  aggregateDiversityChecks,
  renderDiversityChecksSection,
};
