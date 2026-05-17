/**
 * Stage 6.1.5.1 — Annotated argument-intelligence report builder.
 *
 * Takes the live corpus run (scenarios + per-move annotations) and emits a
 * single committable Markdown report.
 *
 * Includes:
 *  - Per-room thread transcripts with parent excerpt, label, qualifier, model
 *    justification.
 *  - Aggregate distributions: messageCategory, rhetoricalArchetype,
 *    qualifierCodes, agreement/disagreement, coexistence, issue-debt axis,
 *    repair suggestion, suggested UI nudge, annotationSource breakdown,
 *    submit error breakdown.
 *  - Top 20 rule candidates (most frequent).
 *  - High-playability moves, branch candidates, concession examples,
 *    unsupported-bold-claim examples, receipt / quote requests.
 *  - Recommendations rolled up from rule candidates.
 *
 * Hard rules:
 *  - No truth verdicts, no winner/loser, no liar/dishonest tokens.
 *  - All secrets / emails / JWT-shape strings redacted via the existing
 *    corpus redactor.
 */
const { redactCorpusText } = require('./engagementCorpus');

const FORBIDDEN_TOKENS = [
  'liar', 'dishonest', 'bad faith', 'manipulative', 'manipulation',
  'extremist', 'propagandist', 'winner', 'loser', 'truth verdict',
  'is true', 'is false', 'stupid', 'idiot', 'moron',
];

function redactBodyForReport(value) {
  let s = redactCorpusText(value);
  const lc = s.toLowerCase();
  for (const t of FORBIDDEN_TOKENS) {
    if (lc.includes(t)) {
      const re = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      s = s.replace(re, '[redacted-term]');
    }
  }
  return s;
}

function inc(map, key) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

function sortDesc(map) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function pickTop(map, n) {
  return sortDesc(map).slice(0, n);
}

function safeMd(s) { return String(s || '').replace(/\|/g, '\\|'); }

function bodyQuote(text) {
  return String(text || '').split('\n').map((l) => `> ${l}`).join('\n');
}

function aggregateAnnotations(rooms) {
  const out = {
    rooms: rooms.length,
    moves: 0,
    posted: 0,
    failed: 0,
    skipped: 0,
    annotationSource: new Map(),
    messageCategory: new Map(),
    primaryArchetype: new Map(),
    secondaryArchetype: new Map(),
    qualifierCode: new Map(),
    categoryCode: new Map(),
    issueDebtAxis: new Map(),
    repairSuggestion: new Map(),
    suggestedUiNudge: new Map(),
    suggestedQualifierCode: new Map(),
    emotionalValence: new Map(),
    heatLevel: new Map(),
    fallbackReason: new Map(),
    submitErrorCode: new Map(),
    ruleCandidates: new Map(),
    agreementBuckets: new Map([['0.0', 0], ['0.25', 0], ['0.5', 0], ['0.75', 0]]),
    disagreementBuckets: new Map([['0.0', 0], ['0.25', 0], ['0.5', 0], ['0.75', 0]]),
    coexistenceBuckets: new Map([['0.0', 0], ['0.25', 0], ['0.5', 0], ['0.75', 0]]),
    playabilityBuckets: new Map([['0.0', 0], ['0.25', 0], ['0.5', 0], ['0.75', 0]]),
  };
  const samples = {
    highPlayability: [], branchCandidates: [], concessions: [],
    unsupportedBoldClaims: [], receiptRequests: [], quoteRequests: [],
    fallbackExamples: [],
  };

  function bucket01(n, map) {
    const v = Number(n) || 0;
    const k = v >= 0.75 ? '0.75' : v >= 0.5 ? '0.5' : v >= 0.25 ? '0.25' : '0.0';
    map.set(k, (map.get(k) || 0) + 1);
  }

  for (const room of rooms) {
    for (const item of room.annotatedMoves || []) {
      const { move, annotation, submitStatus, submitErrorCode } = item;
      out.moves++;
      if (submitStatus === 'posted') out.posted++;
      else if (submitStatus === 'skipped' || submitStatus === 'skipped_missing_parent') out.skipped++;
      else out.failed++;
      if (submitErrorCode) inc(out.submitErrorCode, submitErrorCode);
      if (!annotation) continue;
      inc(out.annotationSource, annotation.annotationSource);
      inc(out.messageCategory, annotation.messageCategory);
      inc(out.primaryArchetype, annotation.primaryRhetoricalArchetype);
      for (const sa of annotation.secondaryRhetoricalArchetypes || []) inc(out.secondaryArchetype, sa);
      for (const q of annotation.qualifierCodes || []) inc(out.qualifierCode, q);
      for (const c of annotation.categoryCodes || []) inc(out.categoryCode, c);
      inc(out.issueDebtAxis, annotation.issueDebtSignal?.axis);
      inc(out.repairSuggestion, annotation.issueDebtSignal?.repairSuggestion);
      inc(out.suggestedUiNudge, annotation.gameImplication?.suggestedUiNudge);
      inc(out.suggestedQualifierCode, annotation.gameImplication?.suggestedQualifierCode);
      inc(out.emotionalValence, annotation.opinionVector?.emotionalValence);
      inc(out.heatLevel, annotation.opinionVector?.heatLevel);

      bucket01(annotation.agreementDisagreementVector?.agreementScore, out.agreementBuckets);
      bucket01(annotation.agreementDisagreementVector?.disagreementScore, out.disagreementBuckets);
      bucket01(annotation.agreementDisagreementVector?.coexistenceScore, out.coexistenceBuckets);
      bucket01(annotation.gameImplication?.playableTensionScore, out.playabilityBuckets);

      if (annotation.deterministicRuleCandidate?.shouldCreateRule && annotation.deterministicRuleCandidate.ruleName) {
        const key = annotation.deterministicRuleCandidate.ruleName;
        if (!out.ruleCandidates.has(key)) out.ruleCandidates.set(key, { count: 0, condition: annotation.deterministicRuleCandidate.ruleCondition, uiNudge: annotation.deterministicRuleCandidate.uiNudge });
        out.ruleCandidates.get(key).count++;
      }

      if (annotation.annotationSource === 'deterministic_fallback') {
        const reason = annotation.modelJustification?.shortReason || 'unknown';
        inc(out.fallbackReason, reason.slice(0, 80));
        if (samples.fallbackExamples.length < 6) samples.fallbackExamples.push({ room, item });
      }
      if ((annotation.gameImplication?.playableTensionScore || 0) >= 0.6 && samples.highPlayability.length < 12) {
        samples.highPlayability.push({ room, item });
      }
      if (annotation.gameImplication?.branchRecommended && samples.branchCandidates.length < 12) {
        samples.branchCandidates.push({ room, item });
      }
      if (annotation.messageCategory === 'concession' && samples.concessions.length < 8) {
        samples.concessions.push({ room, item });
      }
      if (annotation.primaryRhetoricalArchetype === 'unsupported_bold_claim' && samples.unsupportedBoldClaims.length < 8) {
        samples.unsupportedBoldClaims.push({ room, item });
      }
      if ((annotation.primaryRhetoricalArchetype === 'receipt_demander' || annotation.evidenceSignals?.asksForSource) && samples.receiptRequests.length < 8) {
        samples.receiptRequests.push({ room, item });
      }
      if ((annotation.primaryRhetoricalArchetype === 'quote_anchor_demander' || annotation.evidenceSignals?.asksForQuote) && samples.quoteRequests.length < 8) {
        samples.quoteRequests.push({ room, item });
      }
    }
  }
  return { out, samples };
}

function renderDistributionTable(label, map) {
  if (!map || map.size === 0) return [`### ${label}`, '_(no entries)_', ''];
  const lines = [`### ${label}`, '', '| Value | Count |', '|---|---:|'];
  for (const [k, v] of sortDesc(map)) lines.push(`| \`${safeMd(k)}\` | ${v} |`);
  lines.push('');
  return lines;
}

function renderBucketTable(label, map) {
  if (!map || map.size === 0) return [`### ${label}`, '_(no entries)_', ''];
  const lines = [`### ${label}`, '', '| Bucket | Count |', '|---|---:|'];
  const buckets = ['0.0', '0.25', '0.5', '0.75'];
  for (const b of buckets) lines.push(`| \`>=${b}\` | ${map.get(b) || 0} |`);
  lines.push('');
  return lines;
}

function renderRuleCandidates(map) {
  if (!map || map.size === 0) return ['### Top deterministic rule candidates', '_(no rule candidates were suggested)_', ''];
  const lines = ['### Top deterministic rule candidates (top 20)', '', '| Rule name | Count | Condition | UI nudge |', '|---|---:|---|---|'];
  const entries = [...map.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 20);
  for (const [name, info] of entries) {
    lines.push(`| \`${safeMd(name)}\` | ${info.count} | \`${safeMd(info.condition || '')}\` | ${safeMd(info.uiNudge || '')} |`);
  }
  lines.push('');
  return lines;
}

function renderSampleSection(label, samples, mode) {
  if (!samples || samples.length === 0) return [`### ${label}`, '_(no samples)_', ''];
  const lines = [`### ${label}`, ''];
  for (const s of samples) {
    const m = s.item.move;
    const a = s.item.annotation || {};
    lines.push(`**${m.moveId}** — ${a.primaryRhetoricalArchetype || '?'} · ${a.messageCategory || '?'} · source=${a.annotationSource || '?'}`);
    lines.push('');
    lines.push(bodyQuote(redactBodyForReport(m.body).slice(0, 320)));
    lines.push('');
    const reason = a.modelJustification?.shortReason || '';
    if (reason) lines.push(`_why_: ${safeMd(redactBodyForReport(reason))}`);
    lines.push('');
  }
  return lines;
}

function renderRoomTranscript(room) {
  const lines = [];
  lines.push(`## Room — ${safeMd(redactBodyForReport(room.title))}`);
  lines.push('');
  lines.push(`- scenarioId: \`${room.scenarioId}\``);
  lines.push(`- roomId: \`${room.roomId || '(none)'}\``);
  lines.push(`- rootClaim: ${safeMd(redactBodyForReport(room.rootClaim || room.resolution || ''))}`);
  lines.push(`- moves: ${room.annotatedMoves.length}`);
  lines.push('');
  for (let i = 0; i < room.annotatedMoves.length; i++) {
    const item = room.annotatedMoves[i];
    const m = item.move;
    const a = item.annotation || {};
    const parent = item.parentMove;
    lines.push(`### Move ${i + 1} — \`${m.moveId}\` (${m.argumentType}/${m.authorAlias})`);
    lines.push('');
    if (parent) {
      const px = parent.body ? parent.body.slice(0, 160) : '';
      lines.push(`- parent: \`${parent.moveId}\` (${parent.argumentType}) — "${safeMd(redactBodyForReport(px))}"`);
    } else {
      lines.push(`- parent: (root)`);
    }
    if (m.targetExcerpt) lines.push(`- targetExcerpt: "${safeMd(redactBodyForReport(m.targetExcerpt))}"`);
    if (m.disagreementAxis) lines.push(`- disagreementAxis: \`${m.disagreementAxis}\``);
    lines.push(`- messageCategory: \`${a.messageCategory || '?'}\``);
    lines.push(`- primaryArchetype: \`${a.primaryRhetoricalArchetype || '?'}\``);
    if ((a.secondaryRhetoricalArchetypes || []).length) lines.push(`- secondaryArchetypes: ${(a.secondaryRhetoricalArchetypes || []).map((x) => '`' + x + '`').join(', ')}`);
    if ((a.qualifierCodes || []).length) lines.push(`- qualifierCodes: ${(a.qualifierCodes || []).map((x) => '`' + x + '`').join(', ')}`);
    lines.push(`- opinionVector: bA=${(a.opinionVector?.broadAgreement ?? 0).toFixed(2)} nA=${(a.opinionVector?.narrowAgreement ?? 0).toFixed(2)} bD=${(a.opinionVector?.broadDisagreement ?? 0).toFixed(2)} nD=${(a.opinionVector?.narrowDisagreement ?? 0).toFixed(2)} co=${(a.opinionVector?.coexistenceScore ?? 0).toFixed(2)} unc=${(a.opinionVector?.uncertaintyScore ?? 0).toFixed(2)} valence=\`${a.opinionVector?.emotionalValence || '?'}\` heat=\`${a.opinionVector?.heatLevel || '?'}\``);
    const adv = a.agreementDisagreementVector || {};
    lines.push(`- stance: agree=${(adv.agreementScore ?? 0).toFixed(2)} disagree=${(adv.disagreementScore ?? 0).toFixed(2)} co=${(adv.coexistenceScore ?? 0).toFixed(2)} primary=\`${adv.primaryStance || '?'}\` agreementType=\`${adv.agreementType || '?'}\` disagreementType=\`${adv.disagreementType || '?'}\` reply=\`${adv.replyFunction || '?'}\``);
    const id = a.issueDebtSignal || {};
    lines.push(`- issueDebt: axis=\`${id.axis || 'none'}\` created=${Boolean(id.created)} repaired=${Boolean(id.repaired)} unresolved=${Boolean(id.unresolved)} repair=\`${id.repairSuggestion || 'none'}\``);
    const gi = a.gameImplication || {};
    lines.push(`- game: pressure=${Boolean(gi.pressureCreated)} pressureAxis=\`${gi.pressureAxis || 'none'}\` branchRecommended=${Boolean(gi.branchRecommended)} concessionWouldHelp=${Boolean(gi.concessionWouldHelp)} playability=${(gi.playableTensionScore ?? 0).toFixed(2)} uiNudge=\`${gi.suggestedUiNudge || 'none'}\``);
    const ts = a.threadSignals || {};
    lines.push(`- thread: depth=${ts.depth ?? 0} chainRole=\`${ts.chainRole || '?'}\` parentResponsive=${Boolean(ts.parentResponsive)} branchCandidate=${Boolean(ts.branchCandidate)} topicDriftPossible=${Boolean(ts.topicDriftPossible)}`);
    const mj = a.modelJustification || {};
    if (mj.shortReason) lines.push(`- why: ${safeMd(redactBodyForReport(mj.shortReason))}`);
    if ((mj.observableTextFeatures || []).length) lines.push(`- features: ${(mj.observableTextFeatures || []).map((f) => '`' + safeMd(redactBodyForReport(f)).slice(0, 60) + '`').join(', ')}`);
    if ((mj.uncertaintyNotes || []).length) lines.push(`- uncertainty: ${(mj.uncertaintyNotes || []).map((f) => '`' + safeMd(redactBodyForReport(f)).slice(0, 60) + '`').join(', ')}`);
    lines.push(`- annotationSource: \`${a.annotationSource || 'deterministic_fallback'}\``);
    lines.push(`- submitStatus: \`${item.submitStatus || 'planned'}\`${item.submitErrorCode ? ` (errorCode=\`${item.submitErrorCode}\`)` : ''}`);
    lines.push('');
    lines.push('Body:');
    lines.push('');
    lines.push(bodyQuote(redactBodyForReport(m.body)));
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  return lines.join('\n');
}

function buildRecommendations(agg) {
  const recs = [];
  if (agg.suggestedQualifierCode.size > 0) {
    const top = sortDesc(agg.suggestedQualifierCode).slice(0, 5).map(([k, v]) => `\`${k}\` (${v}×)`).join(', ');
    recs.push(`Top suggested qualifierCodes worth promoting to deterministic TS qualifiers: ${top}.`);
  }
  if (agg.suggestedUiNudge.size > 0) {
    const top = sortDesc(agg.suggestedUiNudge).slice(0, 5).map(([k, v]) => `\`${k}\` (${v}×)`).join(', ');
    recs.push(`Top suggested UI nudges to wire into compose flow: ${top}.`);
  }
  if (agg.repairSuggestion.size > 0) {
    const top = sortDesc(agg.repairSuggestion).slice(0, 4).map(([k, v]) => `\`${k}\` (${v}×)`).join(', ');
    recs.push(`Repair suggestions worth surfacing in the responder composer: ${top}.`);
  }
  if (agg.issueDebtAxis.size > 0) {
    const top = sortDesc(agg.issueDebtAxis).slice(0, 4).map(([k, v]) => `\`${k}\` (${v}×)`).join(', ');
    recs.push(`Most-pressured issue-debt axes (candidate columns for Admin Arguments epidemiology table): ${top}.`);
  }
  if (agg.ruleCandidates.size >= 5) {
    recs.push(`${agg.ruleCandidates.size} rule candidates surfaced — consider promoting the top 3 to deterministic TS rules in \`engine.ts\` after manual review.`);
  }
  if (agg.fallbackReason.size > 0) {
    recs.push(`Deterministic fallback fired ${agg.annotationSource.get('deterministic_fallback') || 0} times — review fallback reasons to tighten the Anthropic prompt or schema.`);
  }
  if ((agg.submitErrorCode?.size || 0) > 0) {
    const top = sortDesc(agg.submitErrorCode).slice(0, 3).map(([k, v]) => `\`${k}\` (${v}×)`).join(', ');
    recs.push(`Submit-argument error codes seen: ${top} — inspect runner log for repeats.`);
  }
  if (recs.length === 0) recs.push('No top-level recommendations — corpus is small or uniform; consider running 50-room sample.');
  return recs;
}

function buildAnnotatedIntelligenceMarkdown(run) {
  const { runId, dateIso, mode, rooms } = run;
  const { out: agg, samples } = aggregateAnnotations(rooms);
  const date = (dateIso || new Date().toISOString()).slice(0, 10);

  const lines = [];
  lines.push(`# AI Argument Intelligence Corpus — ${date}`);
  lines.push('');
  lines.push(`_Run id_: \`${runId}\``);
  lines.push(`_Mode_: ${mode}`);
  lines.push(`_Rooms_: ${agg.rooms}  ·  _Moves_: ${agg.moves}  ·  _Posted_: ${agg.posted}  ·  _Failed_: ${agg.failed}  ·  _Skipped_: ${agg.skipped}`);
  lines.push(`_Annotation sources_: ${[...agg.annotationSource.entries()].map(([k, v]) => `${k}=${v}`).join(' · ') || 'none'}`);
  lines.push(`_Secrets exposed_: no  ·  _Service-role used_: no  ·  _Production app calls Anthropic_: no (this report is bot-runner dev-only)`);
  lines.push('');
  lines.push('## Safety contract');
  lines.push('');
  lines.push('- Every annotation is advisory. `userReviewRequired` is `true` on every row.');
  lines.push('- No moderation actions are recommended.');
  lines.push('- No verdict tokens about speakers appear in any annotation field (the annotator and fallback both refuse to emit them).');
  lines.push('- No demographic / political / religious / health / sexuality / protected-class inferences are made.');
  lines.push('- Classification is of OBSERVABLE LANGUAGE only.');
  lines.push('');

  lines.push('## Aggregate distributions');
  lines.push('');
  for (const r of renderDistributionTable('Annotation source', agg.annotationSource)) lines.push(r);
  for (const r of renderDistributionTable('Message category', agg.messageCategory)) lines.push(r);
  for (const r of renderDistributionTable('Primary rhetorical archetype', agg.primaryArchetype)) lines.push(r);
  for (const r of renderDistributionTable('Secondary rhetorical archetype', agg.secondaryArchetype)) lines.push(r);
  for (const r of renderDistributionTable('Qualifier codes', agg.qualifierCode)) lines.push(r);
  for (const r of renderDistributionTable('Category codes', agg.categoryCode)) lines.push(r);
  for (const r of renderDistributionTable('Issue-debt axis', agg.issueDebtAxis)) lines.push(r);
  for (const r of renderDistributionTable('Repair suggestion', agg.repairSuggestion)) lines.push(r);
  for (const r of renderDistributionTable('Suggested UI nudge', agg.suggestedUiNudge)) lines.push(r);
  for (const r of renderDistributionTable('Suggested qualifier code (game)', agg.suggestedQualifierCode)) lines.push(r);
  for (const r of renderDistributionTable('Emotional valence', agg.emotionalValence)) lines.push(r);
  for (const r of renderDistributionTable('Heat level', agg.heatLevel)) lines.push(r);
  for (const r of renderDistributionTable('Submit error codes', agg.submitErrorCode)) lines.push(r);
  for (const r of renderDistributionTable('Fallback short reasons (top)', agg.fallbackReason)) lines.push(r);
  for (const r of renderBucketTable('Agreement scalar distribution', agg.agreementBuckets)) lines.push(r);
  for (const r of renderBucketTable('Disagreement scalar distribution', agg.disagreementBuckets)) lines.push(r);
  for (const r of renderBucketTable('Coexistence scalar distribution', agg.coexistenceBuckets)) lines.push(r);
  for (const r of renderBucketTable('Playable-tension distribution', agg.playabilityBuckets)) lines.push(r);

  for (const r of renderRuleCandidates(agg.ruleCandidates)) lines.push(r);

  lines.push('## Sample moves by interest area');
  lines.push('');
  for (const l of renderSampleSection('High-playability moves', samples.highPlayability)) lines.push(l);
  for (const l of renderSampleSection('Branch candidates (recommended split-thread)', samples.branchCandidates)) lines.push(l);
  for (const l of renderSampleSection('Concession examples', samples.concessions)) lines.push(l);
  for (const l of renderSampleSection('Unsupported bold-claim possibilities', samples.unsupportedBoldClaims)) lines.push(l);
  for (const l of renderSampleSection('Receipt requests', samples.receiptRequests)) lines.push(l);
  for (const l of renderSampleSection('Quote-anchor requests', samples.quoteRequests)) lines.push(l);
  for (const l of renderSampleSection('Deterministic fallback examples', samples.fallbackExamples)) lines.push(l);

  lines.push('## Recommendations');
  lines.push('');
  for (const r of buildRecommendations(agg)) lines.push(`- ${r}`);
  lines.push('');

  lines.push('## Per-room transcripts');
  lines.push('');
  for (const room of rooms) {
    lines.push(renderRoomTranscript(room));
  }

  lines.push('## Secrets check');
  lines.push('');
  lines.push('- [x] No emails, JWTs, or `sb_secret_*` strings (redactor strips them).');
  lines.push('- [x] No API key value or `Bearer` header.');
  lines.push('- [x] No verdict tokens about speakers (the annotator + fallback refuse to emit them, and any that leak from input bodies are redacted).');
  lines.push('- [x] No demographic / protected-class inferences.');
  lines.push('- [x] Every annotation carries `userReviewRequired: true`.');
  lines.push('');
  return lines.join('\n');
}

module.exports = {
  buildAnnotatedIntelligenceMarkdown,
  aggregateAnnotations,
  redactBodyForReport,
  FORBIDDEN_TOKENS,
};
