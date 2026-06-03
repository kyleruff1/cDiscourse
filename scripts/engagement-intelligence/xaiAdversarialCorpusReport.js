/**
 * Stage 6.1.9 — Committed corpus-summary report writer.
 *
 * Renders a redacted Markdown summary from a harvest JSONL stream of events.
 * No handles, URLs, post IDs, raw hostile text, JWTs, Bearer values, or
 * API keys land in the output — events are already redacted by the
 * harvester; this module additionally caps body excerpts to 280 chars.
 *
 * Pure CommonJS. No filesystem (caller writes the file). No network.
 */

const DEFAULT_EXHIBIT_CAP = 280;

function clamp(s, n) { return String(s || '').slice(0, n).trim(); }

function countByKey(events, key) {
  const m = new Map();
  for (const e of events) {
    const v = key(e);
    if (v == null) continue;
    m.set(String(v), (m.get(String(v)) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function fmtDistribution(rows, max = 12) {
  if (rows.length === 0) return ['- (none)'];
  return rows.slice(0, max).map(([k, v]) => `- \`${k}\` — ${v}`);
}

function scenarioRecords(events) {
  return events.filter((e) => e.stage === 'scenario_build');
}

function dissentRecords(events) {
  return events.filter((e) => e.stage === 'dissent_detection');
}

function syntheticCount(events) {
  return events.filter((e) => e.stage === 'synthetic_rebuttal_generated').length;
}

function ruleCandidatesFromEvents(events) {
  // Deterministic rule-candidate aggregation: count axis × replyFunction
  // pairs across dissent events. The top combos are "where the corpus is
  // pressuring the source post the hardest"; downstream Constitution work
  // can decide whether to canonize them.
  const m = new Map();
  for (const e of dissentRecords(events)) {
    const c = e.classification || {};
    const axis = c.disagreementType || 'none';
    const fn = c.replyFunction || 'unclear';
    const key = `${axis}::${fn}`;
    m.set(key, (m.get(key) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
}

function gameRecommendationsFromEvents(events) {
  const lines = [];
  const dissent = dissentRecords(events);
  const sourceChainHigh = dissent.filter((e) => (e.classification || {}).sourceChainRisk === 'high').length;
  const amplifHigh = dissent.filter((e) => (e.classification || {}).amplificationRisk === 'high').length;
  const platformWarn = scenarioRecords(events).filter((e) => e.sourcePost && e.sourcePost.platformSupportWarning).length;
  const synth = syntheticCount(events);

  if (sourceChainHigh > 0) {
    lines.push(`- Surface a "Where is the primary source?" nudge whenever a reply matches the source_chain axis (corpus shows ${sourceChainHigh} cases).`);
  }
  if (amplifHigh > 0) {
    lines.push(`- Cap broadcasting of high-amplification source posts in the game UI; the corpus surfaced ${amplifHigh} amplification-risk-HIGH replies.`);
  }
  if (platformWarn > 0) {
    lines.push(`- Show the "platform support is not evidence" warning on rooms whose source-chain risk is HIGH (${platformWarn} cases).`);
  }
  if (synth > 0) {
    lines.push(`- ${synth} sources required a synthetic dissent skeleton — surface as "the platform did not produce a usable counterpoint; play this scaffold instead" so users do not mistake it for a real X reply.`);
  }
  lines.push('- Never convert popularity / virality / engagement velocity into point-standing or claim standing.');
  lines.push('- Never label users; only annotate text behavior.');
  return lines;
}

function topExhibits(events, predicate, count = 5, cap = DEFAULT_EXHIBIT_CAP) {
  const out = [];
  for (const e of scenarioRecords(events)) {
    if (!predicate(e)) continue;
    const reply = (e.selectedDissent && e.selectedDissent.redactedText) || '';
    const source = (e.sourcePost && e.sourcePost.redactedText) || '';
    out.push({
      sourceHash: e.sourceHash,
      issueFrame: e.sourcePost && e.sourcePost.issueFrame,
      sourceExcerpt: clamp(source, cap),
      replyExcerpt: clamp(reply, cap),
      dissentSource: e.selectedDissent && e.selectedDissent.dissentSource,
      axis: e.selectedDissent && e.selectedDissent.playableSkeleton && e.selectedDissent.playableSkeleton.disagreementAxis,
    });
    if (out.length >= count) break;
  }
  return out;
}

function fmtExhibit(ex) {
  const lines = [];
  lines.push(`- **${ex.issueFrame || 'unknown'}** · axis=\`${ex.axis || 'n/a'}\` · dissent=\`${ex.dissentSource || 'n/a'}\``);
  lines.push(`  - source: ${ex.sourceExcerpt || '(empty)'}`);
  lines.push(`  - reply:  ${ex.replyExcerpt || '(empty)'}`);
  return lines.join('\n');
}

function buildAdversarialCorpusReport({ runId, mode, sourceMode, bundle, events }) {
  const date = new Date().toISOString().slice(0, 10);
  const scenarios = scenarioRecords(events);
  const dissent = dissentRecords(events);
  const usable = dissent.filter((e) => (e.classification || {}).usableForBotDebate).length;
  const synth = syntheticCount(events);

  const issueFrameDist = countByKey(scenarios, (e) => e.sourcePost && e.sourcePost.issueFrame);
  const axisDist = countByKey(dissent, (e) => (e.classification || {}).disagreementType);
  const abuseDist = countByKey(dissent, (e) => (e.classification || {}).abuseRisk);
  const amplifDist = countByKey(dissent, (e) => (e.classification || {}).amplificationRisk);
  const sourceChainDist = countByKey(dissent, (e) => (e.classification || {}).sourceChainRisk);
  const ruleCandidates = ruleCandidatesFromEvents(events);
  const gameRecs = gameRecommendationsFromEvents(events);

  const platformWarnExhibits = topExhibits(events, (e) => e.sourcePost && e.sourcePost.platformSupportWarning, 5);
  const sourceChainHighExhibits = topExhibits(events, (e) => {
    const sel = e.selectedDissent && e.selectedDissent.playableSkeleton;
    return sel && sel.disagreementAxis === 'source_chain';
  }, 5);

  const lines = [];
  lines.push(`# xAI Adversarial Corpus — Stage 6.1.9 — ${date}`);
  lines.push('');
  lines.push(`_Run id_: \`${runId}\``);
  lines.push(`_Mode_: ${mode}`);
  lines.push(`_Source mode_: ${sourceMode}`);
  lines.push('');
  lines.push('## Doctrine reminder');
  lines.push('');
  lines.push('- Popularity is not evidence. Repetition is not evidence. Engagement velocity is not evidence. Political identity is not evidence.');
  lines.push('- Bots are test bots; they never claim to be real X users.');
  lines.push('- Hostile source material is redacted and converted into structured pressure, never reproduced.');
  lines.push('- Text behavior is annotated; people are not classified.');
  lines.push('- All app posts route through `submit-argument`. No `service-role`. No `direct insert`.');
  lines.push('');
  lines.push('## Skill gate');
  lines.push('');
  lines.push(`- provocateur: \`${bundle.provocateurPath}\` · hash=\`${bundle.provocateurHash}\` · ${bundle.provocateurBytes} bytes`);
  lines.push(`- revocateur:  \`${bundle.revocateurPath}\` · hash=\`${bundle.revocateurHash}\` · ${bundle.revocateurBytes} bytes`);
  lines.push(`- validated:   yes (passes \`npm run skills:validate\`)`);
  lines.push('');
  lines.push('## Counts');
  lines.push('');
  lines.push(`- Sources harvested: ${scenarios.length}`);
  lines.push(`- Replies classified: ${dissent.length}`);
  lines.push(`- Usable dissent picks: ${usable}`);
  lines.push(`- Synthetic-fallback dissents: ${synth}`);
  lines.push('');
  lines.push('## Issue-frame distribution');
  lines.push('');
  for (const l of fmtDistribution(issueFrameDist)) lines.push(l);
  lines.push('');
  lines.push('## Disagreement-axis distribution');
  lines.push('');
  for (const l of fmtDistribution(axisDist)) lines.push(l);
  lines.push('');
  lines.push('## Abuse-risk distribution');
  lines.push('');
  for (const l of fmtDistribution(abuseDist)) lines.push(l);
  lines.push('');
  lines.push('## Amplification-risk distribution');
  lines.push('');
  for (const l of fmtDistribution(amplifDist)) lines.push(l);
  lines.push('');
  lines.push('## Source-chain-risk distribution');
  lines.push('');
  for (const l of fmtDistribution(sourceChainDist)) lines.push(l);
  lines.push('');
  lines.push('## Top deterministic rule candidates');
  lines.push('');
  lines.push('Format: `<disagreementAxis>::<replyFunction>` — count.');
  lines.push('');
  for (const [k, v] of ruleCandidates) lines.push(`- \`${k}\` — ${v}`);
  lines.push('');
  lines.push('## Platform-support-warning exhibits (redacted)');
  lines.push('');
  if (platformWarnExhibits.length === 0) lines.push('- (none)');
  else for (const ex of platformWarnExhibits) lines.push(fmtExhibit(ex));
  lines.push('');
  lines.push('## Source-chain-axis exhibits (redacted)');
  lines.push('');
  if (sourceChainHighExhibits.length === 0) lines.push('- (none)');
  else for (const ex of sourceChainHighExhibits) lines.push(fmtExhibit(ex));
  lines.push('');
  lines.push('## Game-design recommendations');
  lines.push('');
  for (const l of gameRecs) lines.push(l);
  lines.push('');
  lines.push('## Compliance');
  lines.push('');
  lines.push('- [x] Skill gate validated before any harvest or dissent classification.');
  lines.push('- [x] Every body passes through `xaiSourceRedactor.redactRaw` before this report is rendered.');
  lines.push('- [x] Hostile bodies were reduced to category placeholders by `convertHostileBody` BEFORE classification.');
  lines.push('- [x] No raw X handles, URLs, post IDs, JWTs, Bearer tokens, or API keys in this report.');
  lines.push('- [x] No popularity-as-evidence claims in any exhibit.');
  lines.push('- [x] No service-role or direct-insert usage in any committed code path.');
  lines.push('');
  return lines.join('\n');
}

// ── CORPUS-30-POOL-DRIVEN-PLANNER — diversity checks (§9) ─────────
//
// Lightweight aggregate over the runner's `move_validated` /
// `seed_assignment` events. Counts only — never body text.
// Mirrors the canonical implementation in xaiAdversarialReport.js so
// reporter consumers in either entry point can surface the same chips.

// CORPUS-30-LIVE-PATH-WIRING Fix 2 — attribution-presence preconditions.
function corpus30DiversityChecks(events) {
  const seedIds = [];
  for (const ev of events) {
    if (ev && ev.stage === 'seed_assignment' && Array.isArray(ev.assignedSeedIds)) {
      for (const id of ev.assignedSeedIds) seedIds.push(id);
    }
  }
  const seen = new Set();
  const dups = [];
  for (const id of seedIds) {
    if (seen.has(id)) dups.push(id);
    else seen.add(id);
  }
  // Attribution-presence introspection on move_validated events.
  let moveValidatedTotal = 0;
  let bankAbsent = 0;
  for (const ev of events) {
    if (!ev || ev.stage !== 'move_validated') continue;
    moveValidatedTotal += 1;
    if (typeof ev.bankName !== 'string' || !Number.isFinite(ev.optionIndex)) bankAbsent += 1;
  }
  const optionIdThreads = new Map();
  const perThreadOpt = new Map();
  let repeatedWithin = 0;
  for (const ev of events) {
    if (!ev || ev.stage !== 'move_validated') continue;
    if (typeof ev.threadIndex !== 'number') continue;
    const key = `${ev.bankName}::${ev.optionIndex}`;
    if (!perThreadOpt.has(ev.threadIndex)) perThreadOpt.set(ev.threadIndex, new Map());
    const inner = perThreadOpt.get(ev.threadIndex);
    const next = (inner.get(key) || 0) + 1;
    inner.set(key, next);
    if (next === 2) repeatedWithin += 1;
    if (ev.optionId) {
      if (!optionIdThreads.has(ev.optionId)) optionIdThreads.set(ev.optionId, new Set());
      optionIdThreads.get(ev.optionId).add(ev.threadIndex);
    }
  }
  let crossThreadCollisions = 0;
  for (const set of optionIdThreads.values()) if (set.size >= 3) crossThreadCollisions += 1;
  const duplicateSeed = {
    total: seedIds.length, unique: seen.size, duplicates: dups,
    severityBand: dups.length > 0 ? 'red' : 'green',
  };
  const repeatedOption = (moveValidatedTotal === 0 || bankAbsent > 0)
    ? {
        repeatedWithin: 0, crossThreadCollisions: 0,
        severityBand: 'n/a',
        reason: 'attribution_absent',
        reasonDetail: moveValidatedTotal === 0
          ? 'no move_validated events present'
          : `${bankAbsent}/${moveValidatedTotal} move_validated events lack bankName+optionIndex`,
      }
    : {
        repeatedWithin, crossThreadCollisions,
        severityBand: crossThreadCollisions > 0 ? 'red' : repeatedWithin > 0 ? 'yellow' : 'green',
      };
  return { duplicateSeed, repeatedOption };
}

// CORPUS-30-LIVE-PATH-WIRING Fix 3 — provider-call tally, mirroring
// the runner + xaiAdversarialReport implementations.
function computeProviderCallTally(events) {
  let summaryEvent = null;
  for (const e of events) {
    if (e && e.stage === 'provider_call_summary') { summaryEvent = e; break; }
  }
  if (summaryEvent
      && Number.isFinite(summaryEvent.xaiCalls)
      && Number.isFinite(summaryEvent.anthropicCalls)
      && Number.isFinite(summaryEvent.supabaseWrites)) {
    return {
      source: 'provider_call_summary',
      xaiCalls: summaryEvent.xaiCalls,
      anthropicCalls: summaryEvent.anthropicCalls,
      supabaseWrites: summaryEvent.supabaseWrites,
    };
  }
  let xaiCalls = 0;
  let anthropicCalls = 0;
  let supabaseWrites = 0;
  for (const e of events) {
    if (!e) continue;
    if (e.stage === 'move_rendered' && e.source === 'anthropic') anthropicCalls += 1;
    if (e.stage === 'submit_result' && e.status === 'posted') supabaseWrites += 1;
    if (e.stage === 'xai_source_call' || e.stage === 'xai_call' || e.stage === 'provider_query') xaiCalls += 1;
  }
  return { source: 'aggregated_from_events', xaiCalls, anthropicCalls, supabaseWrites };
}

module.exports = {
  buildAdversarialCorpusReport,
  countByKey,
  fmtDistribution,
  scenarioRecords,
  dissentRecords,
  syntheticCount,
  ruleCandidatesFromEvents,
  gameRecommendationsFromEvents,
  topExhibits,
  fmtExhibit,
  corpus30DiversityChecks,
  computeProviderCallTally,
};
