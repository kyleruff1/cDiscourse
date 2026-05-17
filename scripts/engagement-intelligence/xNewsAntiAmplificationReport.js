/**
 * Stage 6.1.5.2 — Anti-amplification report extension for the X News
 * tiny pilot.
 *
 * Takes the existing `interpretations` array (one per redacted reply pair)
 * and produces Markdown sections that surface:
 *   - per-root + per-reply annotations (politicalIssueFrame, politicalValence,
 *     amplificationSignals, evidentiaryRisk, amplificationRisk,
 *     platformSupportWarning, recommendedGameTreatment, justification)
 *   - top issue frames + valence frames
 *   - high amplification-risk / low-evidence patterns
 *   - claims that should NOT receive factual standing
 *   - claims that could receive standing AFTER evidence
 *   - most useful composer nudges + scoring changes
 *
 * Pure CommonJS. No network. Uses the existing deterministic annotator so
 * the X News pilot does not have to call Anthropic.
 */
const { deterministicAnnotate } = require('../bot-fixtures/deterministicArgumentAnnotator');

function annotatePair(pair, idx) {
  // The pair carries `rootText` and `replyText` redacted strings plus the
  // already-computed deterministic vector (`finalVector`). We feed the
  // reply through the deterministic annotator with the root as "parent".
  // The annotator does its own scalar / mixed classification internally —
  // we pass `deterministicVector` to keep parity with the existing pilot
  // numbers.
  const rootText = pair._rootTextRedacted || pair.rootText || '';
  const replyText = pair._replyTextRedacted || pair.replyText || '';
  const moveId = `xn-reply-${idx}`;
  const parentMoveId = `xn-root-${idx}`;

  const replyAnnotation = deterministicAnnotate({
    scenario: { scenarioId: 'x-news-tiny-pilot', roomId: pair.pairId || null, resolution: rootText },
    move: { moveId, argumentType: 'rebuttal', side: 'reply', body: replyText },
    parent: { moveId: parentMoveId, argumentType: 'thesis', body: rootText },
    thread: [{ moveId: parentMoveId, argumentType: 'thesis', side: 'root', parentMoveId: null, body: rootText }],
    body: replyText,
    deterministicVector: pair.finalVector || null,
    reason: 'x_news_pilot_deterministic_pass',
  });

  const rootAnnotation = deterministicAnnotate({
    scenario: { scenarioId: 'x-news-tiny-pilot', roomId: pair.pairId || null, resolution: rootText },
    move: { moveId: parentMoveId, argumentType: 'thesis', side: 'root', body: rootText },
    parent: null, thread: [], body: rootText,
    deterministicVector: null,
    reason: 'x_news_pilot_root_pass',
  });

  return { rootAnnotation, replyAnnotation };
}

function tally(map, k) { if (!k) return; map.set(k, (map.get(k) || 0) + 1); }
function sortDesc(map) { return [...map.entries()].sort((a, b) => b[1] - a[1]); }
function safeMd(s) { return String(s || '').replace(/\|/g, '\\|'); }
function truncate(s, n) { s = String(s || ''); return s.length <= n ? s : s.slice(0, n - 1) + '…'; }

function summarize(annotations) {
  const out = {
    politicalIssueFrame: new Map(),
    politicalValence: new Map(),
    evidentiaryRisk: new Map(),
    amplificationRisk: new Map(),
    recommendedGameTreatment: new Map(),
    amplificationSignalCounts: new Map(),
    ruleFlagCounts: new Map(),
    platformSupportWarningTrue: 0,
    platformSupportWarningFalse: 0,
  };
  for (const a of annotations) {
    tally(out.politicalIssueFrame, a.politicalIssueFrame);
    tally(out.politicalValence, a.politicalValence);
    tally(out.evidentiaryRisk, a.evidentiaryRisk);
    tally(out.amplificationRisk, a.amplificationRisk);
    tally(out.recommendedGameTreatment, a.recommendedGameTreatment);
    if (a.platformSupportWarning) out.platformSupportWarningTrue++; else out.platformSupportWarningFalse++;
    for (const [k, v] of Object.entries(a.amplificationSignals || {})) {
      if (v === true) out.amplificationSignalCounts.set(k, (out.amplificationSignalCounts.get(k) || 0) + 1);
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
  }
  return out;
}

function renderTable(label, map) {
  const lines = [`### ${label}`, ''];
  if (!map || map.size === 0) { lines.push('_(no entries)_', ''); return lines; }
  lines.push('| Value | Count |', '|---|---:|');
  for (const [k, v] of sortDesc(map)) lines.push(`| \`${safeMd(k)}\` | ${v} |`);
  lines.push('');
  return lines;
}

function renderPairExhibit(pair, rootAnn, replyAnn, idx) {
  const lines = [];
  lines.push(`### Pair ${idx + 1} — \`${pair.pairId || `pair-${idx}`}\``);
  lines.push('');
  lines.push(`**Root** (redacted):`);
  lines.push(`> ${truncate(pair._rootTextRedacted || pair.rootText || '', 360)}`);
  lines.push('');
  lines.push(`- root.politicalIssueFrame: \`${rootAnn.politicalIssueFrame}\` · politicalValence: \`${rootAnn.politicalValence}\``);
  lines.push(`- root.evidentiaryRisk: \`${rootAnn.evidentiaryRisk}\` · amplificationRisk: \`${rootAnn.amplificationRisk}\` · platformSupportWarning: ${Boolean(rootAnn.platformSupportWarning)}`);
  const rs = Object.entries(rootAnn.amplificationSignals || {}).filter(([, v]) => v).map(([k]) => '`' + k + '`');
  lines.push(`- root.amplificationSignals: ${rs.length === 0 ? '_(none)_' : rs.join(', ')}`);
  lines.push(`- root.recommendedGameTreatment: \`${rootAnn.recommendedGameTreatment}\``);
  if (rootAnn.justification) lines.push(`- root.justification: ${safeMd(truncate(rootAnn.justification, 280))}`);
  lines.push('');
  lines.push(`**Reply** (redacted):`);
  lines.push(`> ${truncate(pair._replyTextRedacted || pair.replyText || '', 360)}`);
  lines.push('');
  const v = pair.finalVector || {};
  const f = pair.mixedFlags || {};
  lines.push(`- reply.stance: \`${v.primaryStance || 'unclear'}\` · agreementType: \`${v.agreementType || 'none'}\` · disagreementType: \`${v.disagreementType || 'none'}\``);
  lines.push(`- reply.agreementScalar: ${(v.agreementScore ?? 0).toFixed(2)} · disagreementScalar: ${(v.disagreementScore ?? 0).toFixed(2)} · coexistenceScore: ${(v.coexistenceScore ?? 0).toFixed(2)}`);
  lines.push(`- reply.politicalIssueFrame: \`${replyAnn.politicalIssueFrame}\` · politicalValence: \`${replyAnn.politicalValence}\``);
  lines.push(`- reply.evidentiaryRisk: \`${replyAnn.evidentiaryRisk}\` · amplificationRisk: \`${replyAnn.amplificationRisk}\` · platformSupportWarning: ${Boolean(replyAnn.platformSupportWarning)}`);
  const repSignals = Object.entries(replyAnn.amplificationSignals || {}).filter(([, v2]) => v2).map(([k]) => '`' + k + '`');
  lines.push(`- reply.amplificationSignals: ${repSignals.length === 0 ? '_(none)_' : repSignals.join(', ')}`);
  lines.push(`- reply.recommendedGameTreatment: \`${replyAnn.recommendedGameTreatment}\``);
  lines.push(`- reply.issueDebtCreated: ${Boolean(replyAnn.issueDebtSignal?.created)} · concessionOrRepairOpportunity: ${Boolean(replyAnn.gameImplication?.concessionWouldHelp)}`);
  const rcKeys = Object.keys(replyAnn.deterministicRuleCandidate || {}).filter((k) => replyAnn.deterministicRuleCandidate[k] === true);
  if (rcKeys.length > 0) lines.push(`- reply.deterministicRuleCandidate: ${rcKeys.map((k) => '`' + k + '`').join(', ')}`);
  if (replyAnn.justification) lines.push(`- reply.justification: ${safeMd(truncate(replyAnn.justification, 280))}`);
  if (f.playableTensionScore) lines.push(`- pair.playableTensionScore: ${f.playableTensionScore.toFixed(2)}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  return lines;
}

/**
 * Annotate every pair and return the markdown to APPEND to the existing
 * pilot report. Returns:
 *   {
 *     markdown: string,
 *     rootAnnotations: AnthropicArgumentAnnotation[],
 *     replyAnnotations: AnthropicArgumentAnnotation[],
 *   }
 */
function buildAntiAmplificationSection({ pairs, interpretations }) {
  // Pair index → pair (with text) joined with the interpretation.
  const annotated = pairs.map((p, i) => {
    const interp = interpretations[i] || {};
    // Merge so the annotator gets the joined view.
    const joined = {
      ...p,
      pairId: interp.pairId || p.pairId,
      finalVector: interp.finalVector || p.finalVector || null,
      mixedFlags: interp.mixedFlags || p.mixedFlags || null,
      _rootTextRedacted: interp._rootTextRedacted || p.rootText,
      _replyTextRedacted: interp._replyTextRedacted || p.replyText,
    };
    return { pair: joined, ...annotatePair(joined, i) };
  });

  const rootAnnotations = annotated.map((a) => a.rootAnnotation);
  const replyAnnotations = annotated.map((a) => a.replyAnnotation);
  const rootSummary = summarize(rootAnnotations);
  const replySummary = summarize(replyAnnotations);

  const lines = [];
  lines.push('## Anti-amplification doctrine — root + reply annotations');
  lines.push('');
  lines.push('_Doctrine: popularity / repetition / engagement velocity / political identity are NOT evidence. politicalValence describes the TEXT, never the user. Annotations are advisory; every row carries `userReviewRequired: true`._');
  lines.push('');
  lines.push(`- root.platformSupportWarning=true: **${rootSummary.platformSupportWarningTrue}** / ${rootSummary.platformSupportWarningTrue + rootSummary.platformSupportWarningFalse} roots`);
  lines.push(`- reply.platformSupportWarning=true: **${replySummary.platformSupportWarningTrue}** / ${replySummary.platformSupportWarningTrue + replySummary.platformSupportWarningFalse} replies`);
  lines.push('');

  // Aggregates per root and per reply.
  lines.push('### Aggregate — roots');
  lines.push('');
  for (const r of renderTable('Top issue frames (roots)', rootSummary.politicalIssueFrame)) lines.push(r);
  for (const r of renderTable('Top political valence frames (roots)', rootSummary.politicalValence)) lines.push(r);
  for (const r of renderTable('Evidentiary risk (roots)', rootSummary.evidentiaryRisk)) lines.push(r);
  for (const r of renderTable('Amplification risk (roots)', rootSummary.amplificationRisk)) lines.push(r);
  for (const r of renderTable('Recommended game treatment (roots)', rootSummary.recommendedGameTreatment)) lines.push(r);
  for (const r of renderTable('Amplification signals fired (roots)', rootSummary.amplificationSignalCounts)) lines.push(r);

  lines.push('### Aggregate — replies');
  lines.push('');
  for (const r of renderTable('Top issue frames (replies)', replySummary.politicalIssueFrame)) lines.push(r);
  for (const r of renderTable('Top political valence frames (replies)', replySummary.politicalValence)) lines.push(r);
  for (const r of renderTable('Evidentiary risk (replies)', replySummary.evidentiaryRisk)) lines.push(r);
  for (const r of renderTable('Amplification risk (replies)', replySummary.amplificationRisk)) lines.push(r);
  for (const r of renderTable('Recommended game treatment (replies)', replySummary.recommendedGameTreatment)) lines.push(r);
  for (const r of renderTable('Amplification signals fired (replies)', replySummary.amplificationSignalCounts)) lines.push(r);
  for (const r of renderTable('Deterministic rule flags fired (replies)', replySummary.ruleFlagCounts)) lines.push(r);

  // Curated sample sections.
  const samplesShouldNotReceive = annotated.filter((a) => a.replyAnnotation.deterministicRuleCandidate?.shouldTreatAsOpinionNoFactualCredit).slice(0, 8);
  const samplesCouldReceive = annotated.filter((a) => a.replyAnnotation.recommendedGameTreatment === 'allow_point_standing_after_evidence').slice(0, 8);
  const samplesBroadAccNarrowDec = annotated.filter((a) => a.pair.mixedFlags?.mixedAgreementClass === 'broad_accept_narrow_decline').slice(0, 8);
  const samplesViralLowEvidence = annotated.filter((a) => a.replyAnnotation.amplificationSignals?.high_engagement_low_evidence || a.replyAnnotation.amplificationSignals?.appeal_to_virality).slice(0, 8);

  function renderSampleSection(label, list) {
    const out = [`## ${label}`, ''];
    if (!list || list.length === 0) { out.push('_(no examples)_', ''); return out; }
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      out.push(...renderPairExhibit(a.pair, a.rootAnnotation, a.replyAnnotation, i));
    }
    return out;
  }

  lines.push(...renderSampleSection('High amplification-risk / low-evidence pairs', samplesViralLowEvidence));
  lines.push(...renderSampleSection('Claims that should NOT receive factual standing', samplesShouldNotReceive));
  lines.push(...renderSampleSection('Claims that could receive standing AFTER evidence', samplesCouldReceive));
  lines.push(...renderSampleSection('Broad agreement + narrow disagreement coexists (highest-utility playable state)', samplesBroadAccNarrowDec));

  // Recommendations roll-up.
  lines.push('## Anti-amplification recommendations');
  lines.push('');
  const recs = [];
  if (replySummary.platformSupportWarningTrue > 0) {
    const pct = Math.round((replySummary.platformSupportWarningTrue / Math.max(1, replySummary.platformSupportWarningTrue + replySummary.platformSupportWarningFalse)) * 100);
    recs.push(`platformSupportWarning fired on ${replySummary.platformSupportWarningTrue} replies (${pct}%). Wire \`applyAntiAmplification\` into the point-standing engine for production grading runs.`);
  }
  if (replySummary.amplificationSignalCounts.size > 0) {
    const topSig = sortDesc(replySummary.amplificationSignalCounts).slice(0, 4).map(([k, v]) => `\`${k}\` (${v})`).join(', ');
    recs.push(`Top reply amplification signals: ${topSig}. Add composer-time warnings BEFORE submit so users can self-correct.`);
  }
  if (replySummary.ruleFlagCounts.size > 0) {
    const topRule = sortDesc(replySummary.ruleFlagCounts).slice(0, 3).map(([k, v]) => `\`${k}\` (${v})`).join(', ');
    recs.push(`Most-fired anti-amplification rule flags on replies: ${topRule}. Promote to deterministic TS rules in \`engine.ts\` after operator review.`);
  }
  if (rootSummary.politicalIssueFrame.size > 0) {
    const topFrame = sortDesc(rootSummary.politicalIssueFrame).filter(([k]) => k !== 'unclear' && k !== 'non_political').slice(0, 5).map(([k, v]) => `\`${k}\` (${v})`).join(', ');
    if (topFrame) recs.push(`Top issue frames in root posts: ${topFrame}. Surface as room-header badges in the app (context only — never as a verdict).`);
  }
  recs.push('Compose flow nudges to add: `ask_for_primary_source`, `ask_for_quote_anchor`, `ask_for_scope_narrowing`, `allow_as_opinion_no_factual_credit`.');
  recs.push('Point-standing economy change: when `platformSupportWarning=true` and the reply does NOT bring receipts / quote / narrowing, suppress factual-standing gain (engagement credit unchanged). When the reply DOES bring receipts / quote / narrowing, credit the conversion bonus.');
  recs.push('Most useful game qualifiers to add: `amplification_only`, `evidence_converted`, `viral_repeat_no_receipts`, `slogan_repeat`, `political_generalization`.');
  for (const r of recs) lines.push(`- ${r}`);
  lines.push('');

  return { markdown: lines.join('\n'), rootAnnotations, replyAnnotations };
}

module.exports = {
  annotatePair,
  buildAntiAmplificationSection,
  summarize,
};
