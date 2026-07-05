/**
 * RESEED-001 — Markdown reporter + diversity checks.
 *
 * Mirrors the ratified CORPUS-30 §9 attribution-presence pattern:
 *   - On an empty / attribution-less event stream, EVERY diversity check
 *     returns `severityBand: 'n/a'` with `reason: 'attribution_absent'`. The
 *     report can NEVER render a green band from absence (never green-by-absence).
 *   - Samey / near-verbatim bands honor a >= 50-sample floor; below it they
 *     return `n/a` with `reason: 'insufficient_samples'`.
 *   - Adds an engine-rejection count section (Edge-vs-src drift is logged
 *     signal, not a crash).
 *
 * All rendered strings pass a ban-list (no verdict / truth / victory / defeat
 * tokens) — asserted by a test. The report is passed through the redactor so
 * no source URL / secret can leak.
 *
 * CommonJS / pure.
 */

const { redact } = require('./redactor');
const { tokenize, tokenSetJaccard, NEAR_VERBATIM_THRESHOLD } = require('./reseedJaccard');
const { fallbackReasonHistogram } = require('./reseedMoveRenderer');

const SAMPLE_FLOOR = 50; // twin of xaiAdversarialReport.SAMEY_MOVE_SAMPLE_FLOOR

const ATTR_FIELDS = ['seedId', 'threadIndex', 'spineId', 'voiceId', 'bankName', 'optionIndex'];

function naBand(reason) {
  return { severityBand: 'n/a', reason, count: 0 };
}

function eventsHaveAttribution(events) {
  if (!Array.isArray(events) || events.length === 0) return false;
  // At least one event must carry the full attribution field set with
  // non-empty values, or the whole stream is treated as attribution_absent.
  return events.some((ev) => {
    if (!ev || typeof ev !== 'object') return false;
    return ATTR_FIELDS.every((f) => {
      const v = ev[f];
      if (f === 'threadIndex' || f === 'optionIndex') return typeof v === 'number';
      return typeof v === 'string' && v.length > 0;
    });
  });
}

/**
 * Diversity checks over move-event records.
 * @param {Array<object>} events ReseedMoveEvent[] (move_body_sample / move_* etc.)
 * @returns {{ duplicateSeed, voiceDistribution, spineSaturation, nearVerbatimCluster, sameyMove, engineRejection }}
 */
function reseedDiversityChecks(events) {
  const list = Array.isArray(events) ? events : [];

  if (!eventsHaveAttribution(list)) {
    return {
      duplicateSeed: naBand('attribution_absent'),
      voiceDistribution: naBand('attribution_absent'),
      spineSaturation: naBand('attribution_absent'),
      nearVerbatimCluster: naBand('attribution_absent'),
      sameyMove: naBand('attribution_absent'),
      engineRejection: computeEngineRejection(list),
    };
  }

  return {
    duplicateSeed: computeDuplicateSeed(list),
    voiceDistribution: computeVoiceDistribution(list),
    spineSaturation: computeSpineSaturation(list),
    nearVerbatimCluster: computeNearVerbatim(list),
    sameyMove: computeSameyMove(list),
    engineRejection: computeEngineRejection(list),
  };
}

function computeDuplicateSeed(events) {
  const bySeed = new Map();
  for (const ev of events) {
    if (!ev.seedId) continue;
    bySeed.set(ev.seedId, (bySeed.get(ev.seedId) || 0) + 1);
  }
  const distinct = bySeed.size;
  // "green" when there is more than one distinct seed (variety), yellow when
  // a single seed dominates every thread.
  const band = distinct >= 2 ? 'green' : 'yellow';
  return { severityBand: band, distinctSeeds: distinct, count: events.length };
}

function computeVoiceDistribution(events) {
  const byVoice = new Map();
  for (const ev of events) {
    if (!ev.voiceId) continue;
    byVoice.set(ev.voiceId, (byVoice.get(ev.voiceId) || 0) + 1);
  }
  const distinct = byVoice.size;
  const band = distinct >= 2 ? 'green' : 'yellow';
  return { severityBand: band, distinctVoices: distinct, distribution: Object.fromEntries(byVoice), count: events.length };
}

function computeSpineSaturation(events) {
  const bySpine = new Map();
  for (const ev of events) {
    if (!ev.spineId) continue;
    bySpine.set(ev.spineId, (bySpine.get(ev.spineId) || 0) + 1);
  }
  const distinct = bySpine.size;
  const total = [...bySpine.values()].reduce((a, b) => a + b, 0);
  const maxShare = total > 0 ? Math.max(0, ...bySpine.values()) / total : 0;
  // Saturated (yellow) if one spine is > 90% of moves AND only one spine.
  const band = distinct >= 2 || maxShare <= 0.9 ? 'green' : 'yellow';
  return { severityBand: band, distinctSpines: distinct, maxShare: Number(maxShare.toFixed(3)), count: events.length };
}

/** Tokenized body samples grouped per thread. */
function perThreadTokenSets(events) {
  const perThread = new Map();
  for (const ev of events) {
    if (typeof ev.threadIndex !== 'number') continue;
    const body = typeof ev.bodySample === 'string' ? ev.bodySample : ev.body;
    if (typeof body !== 'string' || body.length === 0) continue;
    if (!perThread.has(ev.threadIndex)) perThread.set(ev.threadIndex, []);
    perThread.get(ev.threadIndex).push({ moveId: ev.moveId, tokens: tokenize(body) });
  }
  return perThread;
}

function computeNearVerbatim(events) {
  const withBody = events.filter((e) => typeof (e.bodySample || e.body) === 'string');
  if (withBody.length < SAMPLE_FLOOR) {
    return naBand('insufficient_samples');
  }
  const perThread = perThreadTokenSets(events);
  let highPairs = 0;
  for (const list of perThread.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (tokenSetJaccard(list[i].tokens, list[j].tokens) >= NEAR_VERBATIM_THRESHOLD) highPairs += 1;
      }
    }
  }
  // Fires (yellow) when at least one near-verbatim pair exists.
  const band = highPairs > 0 ? 'yellow' : 'green';
  return { severityBand: band, highPairs, threshold: NEAR_VERBATIM_THRESHOLD, count: withBody.length };
}

function computeSameyMove(events) {
  const withBody = events.filter((e) => typeof (e.bodySample || e.body) === 'string');
  if (withBody.length < SAMPLE_FLOOR) {
    return naBand('insufficient_samples');
  }
  const perThread = perThreadTokenSets(events);
  let meanSum = 0;
  let meanCount = 0;
  for (const list of perThread.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        meanSum += tokenSetJaccard(list[i].tokens, list[j].tokens);
        meanCount += 1;
      }
    }
  }
  const mean = meanCount > 0 ? meanSum / meanCount : 0;
  const band = mean >= 0.35 ? 'yellow' : 'green';
  return { severityBand: band, meanPairwiseJaccard: Number(mean.toFixed(3)), count: withBody.length };
}

function computeEngineRejection(events) {
  let rejected = 0;
  let posted = 0;
  for (const ev of events) {
    if (ev.engineValid === false) rejected += 1;
    if (ev.postStatus && String(ev.postStatus).startsWith('failed')) rejected += 1;
    if (ev.postStatus === 'posted') posted += 1;
  }
  return { count: rejected, posted, severityBand: rejected === 0 ? 'green' : 'yellow' };
}

// ── Markdown ───────────────────────────────────────────────────────

function fmtBand(check) {
  const band = check.severityBand;
  const reason = check.reason ? ` (${check.reason})` : '';
  return `${band}${reason}`;
}

/**
 * Build the committed Markdown report.
 * @param {object} opts { runId, dateIso, mode, pack, events, args }
 * @returns {string}
 */
function buildReseedMarkdown(opts) {
  const { runId, dateIso, mode, pack, events, args } = opts || {};
  const list = Array.isArray(events) ? events : [];
  const checks = reseedDiversityChecks(list);

  const postedList = list.filter((e) => e.postStatus === 'posted');
  const failedList = list.filter((e) => e.postStatus && String(e.postStatus).startsWith('failed'));
  const skippedList = list.filter((e) => e.postStatus === 'skipped_missing_parent');
  const rooms = new Set(list.map((e) => e.roomId).filter(Boolean));

  const fallbackHist = fallbackReasonHistogram(list);

  // Note: the report never emits a bare `true`/`false` token (a ban-list test
  // forbids standalone verdict words). Mode is carried by the "Mode:" line;
  // the args summary omits the dry boolean.
  const argsSummary = args
    ? `pack=${args.pack || pack} count=${args.count} seed=${args.seed} provider=${args.provider}`
    : `pack=${pack}`;

  const lines = [
    `# Reseeder run — ${pack} — ${(dateIso || '').slice(0, 10)}`,
    '',
    'Generated by `scripts/reseeder/runReseeder.js`. Dev/test content only.',
    'Raw source URLs and attribution live only in the gitignored `logs/reseeder/` bank; this report carries counts + attribution-presence bands.',
    '',
    '## Run',
    '',
    `- Run id: \`${runId || ''}\``,
    `- Mode: ${mode || 'dry'}`,
    `- Args: ${argsSummary}`,
    `- Rooms: ${rooms.size}`,
    `- Move events: ${list.length}`,
    '',
    '## Posting outcome',
    '',
    `- Posted: ${postedList.length}`,
    `- Failed (submit-argument): ${failedList.length}`,
    `- Skipped (missing parent): ${skippedList.length}`,
    '',
    '## Engine-rejection count',
    '',
    `- Engine rejections (pre-check invalid OR Edge-rejected at post): **${checks.engineRejection.count}**`,
    `- Posted via submit-argument: ${checks.engineRejection.posted}`,
    checks.engineRejection.count > 0
      ? '- Note: a non-zero count indicates src-vs-Edge constitution drift; treated as logged signal, not a harness failure. Re-deploy submit-argument to reconcile.'
      : '- Note: no engine rejections observed.',
    '',
    '## Diversity checks',
    '',
    '| Check | Band |',
    '|---|---|',
    `| duplicate-seed | ${fmtBand(checks.duplicateSeed)} |`,
    `| voice-distribution | ${fmtBand(checks.voiceDistribution)} |`,
    `| spine-saturation | ${fmtBand(checks.spineSaturation)} |`,
    `| near-verbatim-cluster | ${fmtBand(checks.nearVerbatimCluster)} |`,
    `| samey-move | ${fmtBand(checks.sameyMove)} |`,
    '',
    '## Fallback-reason histogram (Sonnet path)',
    '',
    Object.keys(fallbackHist).length === 0
      ? '- (no provider fallbacks — deterministic path or no Sonnet run)'
      : Object.entries(fallbackHist).map(([k, v]) => `- ${k}: ${v}`).join('\n'),
    '',
    '## Attribution presence',
    '',
    eventsHaveAttribution(list)
      ? '- Attribution present on move events (seedId, threadIndex, spineId, voiceId, bankName, optionIndex).'
      : '- Attribution absent → all diversity checks report n/a (never green-by-absence).',
    '',
    '## Notes',
    '',
    '- Score is gameplay analysis, never a verdict. This report emits activity/diversity bands only; it assigns no verdict and no truth value.',
    '- No service-role key used; arguments posted only via submit-argument.',
    '',
  ];

  return redact(lines.join('\n'));
}

module.exports = {
  buildReseedMarkdown,
  reseedDiversityChecks,
  eventsHaveAttribution,
  SAMPLE_FLOOR,
  ATTR_FIELDS,
};
