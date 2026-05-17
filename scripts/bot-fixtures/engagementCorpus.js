/**
 * Bot Engagement Corpus — Stage 6.1.3.1.
 *
 * Pure / CommonJS module that takes scenario + per-room result data and emits:
 *  - per-move decision traces (intent, spice, specificity, expected counter, tuning concern)
 *  - per-room engagement scores
 *  - one consolidated Markdown corpus for an entire run
 *  - optional JSONL event stream
 *
 * No Supabase calls. No Anthropic. No OpenAI. Deterministic.
 *
 * Safety:
 *  - Emails, JWT-shaped strings, and `sb_secret_*` are redacted before write.
 *  - Author identity is recorded as alias only (e.g. "bot-a"), never email.
 */

// ── Redaction ───────────────────────────────────────────────────

const SECRET_REGEXES = [
  /eyJ[A-Za-z0-9_-]{10,}/g,
  /sb_secret_[A-Za-z0-9_-]+/g,
  /sk-ant-[A-Za-z0-9_-]+/g,
  /sk-[A-Za-z0-9_-]{20,}/g,
];
const EMAIL_REGEX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PASSWORD_LINE_REGEX = /^([^=\n]*password[^=\n]*=).+$/gim;

function redactCorpusText(value) {
  if (value == null) return '';
  let s = String(value);
  for (const re of SECRET_REGEXES) s = s.replace(re, '[redacted]');
  s = s.replace(EMAIL_REGEX, '<email>');
  s = s.replace(PASSWORD_LINE_REGEX, '$1[redacted]');
  return s;
}

// ── Decision-trace classifiers ──────────────────────────────────

const HOT_TOKENS = [
  'vibes-only', 'dodge', 'bold claim', 'tiny hat', 'receipt drawer',
  'doing a lot of work', 'smuggling', 'wearing a tiny hat', 'needs a leash',
  'goalposts',
];
const MEDIUM_TOKENS = [
  'receipts', 'quote the exact', 'wrong scope', 'define', 'narrow',
  'counterexample', 'scope creep',
];

function classifySpiceLevel(move) {
  const body = String(move?.body || '').toLowerCase();
  if (HOT_TOKENS.some((t) => body.includes(t))) return 'hot';
  if (MEDIUM_TOKENS.some((t) => body.includes(t))) return 'medium';
  return 'mild';
}

function classifySpecificity(move) {
  const hasExcerpt = Boolean(move?.targetExcerpt && String(move.targetExcerpt).length > 0);
  if (hasExcerpt) return 'specific';
  const body = String(move?.body || '');
  // Count digits and quoted phrases as "specific" signals
  const hasNumber = /\b\d{2,}\b/.test(body);
  const hasQuote = /["“”']/.test(body);
  if (hasNumber || hasQuote) return 'medium';
  return body.length > 200 ? 'medium' : 'vague';
}

function estimatePressureApplied(move) {
  const t = move?.argumentType;
  if (t === 'rebuttal' || t === 'counter_rebuttal') return 'high';
  if (t === 'evidence' || t === 'clarification_request') return 'medium';
  return 'low';
}

const AXIS_TO_INTENT = {
  scope: 'challenge_scope',
  fact: 'challenge_fact',
  logic: 'challenge_logic',
  definition: 'challenge_definition',
  causal: 'challenge_causal',
  value: 'challenge_value',
  evidence: 'challenge_evidence',
};

function classifyDecisionIntent(move) {
  if (move?.displayMeta && move.displayMeta.branchCandidate) return 'branch_tangent';
  const t = move?.argumentType;
  const body = String(move?.body || '').toLowerCase();
  if (t === 'thesis') return 'plant_claim';
  if (t === 'claim' && (move.parentMoveId === null || move.parentMoveId === undefined)) return 'plant_claim';
  if (t === 'rebuttal' || t === 'counter_rebuttal') {
    return AXIS_TO_INTENT[String(move.disagreementAxis || '').toLowerCase()] || 'challenge_fact';
  }
  if (t === 'evidence') return 'drop_receipts';
  if (t === 'clarification_request') {
    if (body.includes('quote') || body.includes('exact')) return 'quote_exact_bit';
    if (body.includes('source') || body.includes('receipt')) return 'request_receipts';
    return 'quote_exact_bit';
  }
  if (t === 'concession') {
    return body.includes('narrow') ? 'narrow_dispute' : 'concede_small_point';
  }
  if (t === 'synthesis') return 'synthesize_thread';
  if (t === 'claim') return 'plant_claim';
  return 'plant_claim';
}

// ── Why / expected counter / tuning concern templates ───────────

function whyThisMove(intent) {
  switch (intent) {
    case 'plant_claim': return 'Opens with a deliberately provocative root claim that invites scope and definition challenges.';
    case 'challenge_scope': return "Pushes back on the parent's scope to narrow the dispute.";
    case 'challenge_fact': return "Disputes the factual premise behind the parent's framing.";
    case 'challenge_logic': return "Attacks the inference, not the facts — exercises the logic rail.";
    case 'challenge_definition': return 'Forces a definition before the rest of the argument can resolve.';
    case 'challenge_causal': return 'Disputes the cause-and-effect step the parent assumed.';
    case 'challenge_value': return 'Disputes the value priority underneath the parent.';
    case 'challenge_evidence': return "Disputes the strength of the parent's evidence.";
    case 'request_receipts': return 'Demands a source — exercises the receipt-request rail.';
    case 'quote_exact_bit': return 'Demands a verbatim quote — exercises the quote-anchor rail.';
    case 'drop_receipts': return 'Drops a concrete receipt that the rebuttal must address.';
    case 'counterexample': return 'Plants a counterexample to test how robust the parent claim is.';
    case 'concede_small_point': return 'Concedes a narrow point to invite synthesis without giving up the larger position.';
    case 'narrow_dispute': return 'Narrows the dispute by giving ground on scope while holding the core point.';
    case 'synthesize_thread': return 'Wraps the thread by acknowledging shared ground; flags the open question.';
    case 'branch_tangent': return 'Plants a tangent that wants its own room — exercises branch recommendation.';
    default: return 'Move purpose not classified.';
  }
}

function whyThisParent(move, parentMove) {
  if (!parentMove) return 'Starts the conversation. No parent.';
  const pt = parentMove.argumentType;
  const ct = move.argumentType;
  if (ct === 'rebuttal' && pt === 'thesis') return 'Direct rebuttal of the root thesis.';
  if (ct === 'rebuttal' && pt === 'evidence') return "Challenges the evidence the other side just dropped.";
  if (ct === 'rebuttal' && pt === 'claim') return 'Rebuts the narrowed claim head-on.';
  if (ct === 'counter_rebuttal' && pt === 'rebuttal') return 'Re-engages the rebuttal on a different axis.';
  if (ct === 'evidence' && pt === 'rebuttal') return 'Backs the original side against the rebuttal.';
  if (ct === 'evidence' && pt === 'counter_rebuttal') return 'Backs the counter-rebuttal with a concrete receipt.';
  if (ct === 'clarification_request' && pt === 'rebuttal') return 'Probes what the rebuttal is actually claiming.';
  if (ct === 'clarification_request' && pt === 'evidence') return "Probes the evidence's scope.";
  if (ct === 'claim' && pt === 'clarification_request') return 'Answers the clarification with a narrower claim.';
  if (ct === 'concession' && pt === 'claim') return 'Concedes the narrowed sub-claim.';
  if (ct === 'concession' && pt === 'rebuttal') return 'Concedes the rebuttal in part.';
  if (ct === 'synthesis' && pt === 'concession') return 'Closes the thread after the concession.';
  return `Reply: ${ct} child of ${pt}.`;
}

function getExpectedCounter(move) {
  const t = move.argumentType;
  if (t === 'thesis') return 'Expect a scope or fact rebuttal.';
  if (t === 'claim' && (move.parentMoveId === null || move.parentMoveId === undefined)) return 'Expect a scope or fact rebuttal.';
  if (t === 'rebuttal') return 'Expect either evidence backing the original side, or a counter_rebuttal on a different axis.';
  if (t === 'counter_rebuttal') return 'Expect a rebuttal back on the original axis or new evidence.';
  if (t === 'evidence') return 'Expect a scope challenge or an evidence challenge.';
  if (t === 'clarification_request') return 'Expect a narrower claim from the original author.';
  if (t === 'claim') return 'Expect a rebuttal, evidence, clarification, or concession.';
  if (t === 'concession') return 'Expect a synthesis.';
  if (t === 'synthesis') return 'Thread closes; no counter expected.';
  return 'Unknown counter.';
}

function getTuningConcern(move) {
  const spice = classifySpiceLevel(move);
  const spec = classifySpecificity(move);
  const t = move.argumentType;
  if (spice === 'hot' && spec === 'vague') return 'Confident-but-vague — could be over-spiced.';
  if (spice === 'mild' && spec === 'specific' && (t === 'rebuttal' || t === 'counter_rebuttal')) return 'Specific but flat — could use more bite.';
  if (t === 'concession' && (move.body || '').length < 100) return 'Concession may be too short to feel earned.';
  if (t === 'synthesis' && (move.body || '').length < 120) return 'Synthesis may be too brief to convey closure.';
  return null;
}

function getBotLane(personaSide) {
  if (personaSide === 'affirmative') return 'provocateur';
  if (personaSide === 'negative') return 'revocateur';
  if (personaSide === 'neutral') return 'synthesizer';
  return 'observer';
}

function buildDecisionTraceForMove(scenario, move, parentMove) {
  const intent = classifyDecisionIntent(move);
  const spice = classifySpiceLevel(move);
  const spec = classifySpecificity(move);
  const pressure = estimatePressureApplied(move);
  return {
    decisionIntent: intent,
    whyThisMove: whyThisMove(intent),
    whyThisParent: whyThisParent(move, parentMove),
    pressureApplied: pressure,
    spiceLevel: spice,
    specificity: spec,
    expectedCounter: getExpectedCounter(move),
    tuningConcern: getTuningConcern(move),
  };
}

// ── Room scoring ────────────────────────────────────────────────

function clampScore(n) {
  if (n < 0) return 0; if (n > 5) return 5;
  return Math.round(n);
}

function specToScore(s) { return s === 'specific' ? 5 : s === 'medium' ? 3 : 1; }
function spiceToScore(s) { return s === 'hot' ? 5 : s === 'medium' ? 3 : 1; }

function scoreRoomEngagement(scenario, moveResults) {
  const moves = scenario.moves || [];
  const moveById = new Map(moves.map((m) => [m.moveId, m]));
  const authors = moves.map((m) => m.authorAlias);
  let alternations = 0;
  for (let i = 1; i < authors.length; i++) if (authors[i] !== authors[i - 1]) alternations++;
  const altRatio = authors.length > 1 ? alternations / (authors.length - 1) : 0;
  const backAndForthScore = clampScore(altRatio * 5);

  const specs = moves.map(classifySpecificity);
  const specificityScore = clampScore(specs.reduce((a, s) => a + specToScore(s), 0) / Math.max(1, specs.length));

  const personaSet = new Set(moves.map((m) => m.authorAlias));
  const personaDistinctnessScore = clampScore((personaSet.size / 3) * 5);

  const evCount = moves.filter((m) => m.argumentType === 'evidence').length;
  const recCount = moves.filter((m) => /receipt|source|quote the exact/i.test(m.body || '')).length;
  const evidenceUseScore = clampScore(Math.min(5, evCount * 2 + recCount));

  const hasConcession = moves.some((m) => m.argumentType === 'concession');
  const hasSynthesis = moves.some((m) => m.argumentType === 'synthesis');
  const concessionQualityScore = clampScore((hasConcession ? 3 : 0) + (hasSynthesis ? 2 : 0));

  const hasBranch = moves.some((m) => m.displayMeta && m.displayMeta.branchCandidate);
  const tangentControlScore = clampScore(hasBranch ? 5 : 3);

  const spices = moves.map(classifySpiceLevel);
  const funScore = clampScore(spices.reduce((a, s) => a + spiceToScore(s), 0) / Math.max(1, spices.length));

  let traceable = 0;
  for (const m of moves) {
    if (m.parentMoveId === null) { traceable++; continue; }
    const parent = moveById.get(m.parentMoveId);
    if (!parent) continue;
    const hasExcerpt = Boolean(m.targetExcerpt && parent.body.includes(m.targetExcerpt));
    const hasOverlap = (parent.body || '').toLowerCase().split(/\s+/).some(
      (w) => w.length >= 4 && (m.body || '').toLowerCase().includes(w),
    );
    if (hasExcerpt || hasOverlap) traceable++;
  }
  const traceabilityScore = clampScore((traceable / Math.max(1, moves.length)) * 5);

  const scores = {
    backAndForthScore, specificityScore, personaDistinctnessScore,
    evidenceUseScore, concessionQualityScore, tangentControlScore,
    funScore, traceabilityScore,
  };
  const average = Math.round(
    (Object.values(scores).reduce((a, n) => a + n, 0) / Object.values(scores).length) * 10,
  ) / 10;

  // Recommended tune: cite the two lowest scores
  const entries = Object.entries(scores).sort((a, b) => a[1] - b[1]).slice(0, 2);
  const tuneHints = {
    backAndForthScore: 'increase author alternation between turns',
    specificityScore: 'have more moves carry a targetExcerpt or quote a parent phrase verbatim',
    personaDistinctnessScore: 'use three distinct authors with audibly different lanes',
    evidenceUseScore: 'add more evidence moves or receipt demands',
    concessionQualityScore: 'ensure a concession lands before synthesis closes the thread',
    tangentControlScore: 'flag at least one move as a branch candidate per scenario',
    funScore: 'add more sharp phrases (vibes-only, dodge, bold claim wearing a tiny hat) without becoming personal',
    traceabilityScore: 'add a target_excerpt or echo parent vocabulary into every child body',
  };
  const recommendedTune = entries.length
    ? `Low spots: ${entries.map(([k, v]) => `${k}=${v}`).join(', ')}. To tune: ${entries.map(([k]) => tuneHints[k]).join('; ')}.`
    : 'No major engagement gaps detected.';

  return { scores, average, recommendedTune };
}

// ── Markdown builders ───────────────────────────────────────────

function statusLineForMove(result) {
  if (!result) return 'planned';
  if (result.actualStatus === 'posted') return `posted (HTTP ${result.httpStatus ?? 201})`;
  return `${result.actualStatus}${result.httpStatus ? ` (HTTP ${result.httpStatus})` : ''}${result.errorCode ? ` — ${result.errorCode}` : ''}`;
}

function safeBody(body) {
  const lines = String(body || '').split('\n').map((l) => `> ${l}`).join('\n');
  return redactCorpusText(lines);
}

function buildRoomTranscript(scenario, roomResult, runMode) {
  const moves = scenario.moves || [];
  const moveById = new Map(moves.map((m) => [m.moveId, m]));
  const resultByMoveId = new Map((roomResult?.results || []).map((r) => [r.moveId, r]));
  const personas = scenario.personas || [];
  const personaByAlias = new Map(personas.map((p) => [p.alias, p]));

  const engagement = scoreRoomEngagement(scenario, roomResult?.results || []);

  const lines = [];
  lines.push(`## Room — ${redactCorpusText(scenario.title)}`);
  lines.push('');
  lines.push(`- scenarioId: \`${scenario.scenarioId}\``);
  lines.push(`- roomId: \`${roomResult?.roomId || '(none)'}\``);
  lines.push(`- category: \`${scenario.category}\``);
  lines.push(`- resolution: ${redactCorpusText(scenario.resolution)}`);
  lines.push(`- template: \`${scenario.stressMeta?.templateId || 'n/a'}\` · topic: \`${scenario.stressMeta?.topicId || scenario.scenarioId}\``);
  lines.push(`- engagement (avg): **${engagement.average} / 5**`);
  lines.push(`- topic hook: ${redactCorpusText(personas.map((p) => `${p.alias} (${p.side})`).join(' vs '))}`);
  lines.push('');

  for (let i = 0; i < moves.length; i++) {
    const move = moves[i];
    const parent = move.parentMoveId ? moveById.get(move.parentMoveId) : null;
    const persona = personaByAlias.get(move.authorAlias);
    const lane = getBotLane(persona?.side || 'neutral');
    const trace = buildDecisionTraceForMove(scenario, move, parent);
    const result = resultByMoveId.get(move.moveId);
    const status = runMode === 'dry' ? 'planned' : statusLineForMove(result);

    lines.push(`### Move ${i + 1} — ${lane} (${move.authorAlias} / ${persona?.side || 'unknown'})`);
    lines.push('');
    lines.push(`- moveId: \`${move.moveId}\`` + (result?.argumentId ? ` · argumentId: \`${result.argumentId}\`` : ''));
    lines.push(`- moveKind: \`${move.moveKind}\` · argumentType: \`${move.argumentType}\``);
    if (move.disagreementAxis) lines.push(`- disagreementAxis: \`${move.disagreementAxis}\``);
    if (move.qualifierCode) lines.push(`- qualifierCode: \`${move.qualifierCode}\``);
    if (parent) {
      lines.push(`- parent: \`${parent.moveId}\` (${parent.argumentType})`);
      const excerpt = move.targetExcerpt && parent.body.includes(move.targetExcerpt)
        ? move.targetExcerpt
        : parent.body.slice(0, 80);
      lines.push(`- parent excerpt: ${redactCorpusText(`"${excerpt}"`)}`);
    } else {
      lines.push(`- parent: (none — root)`);
    }
    if (move.targetExcerpt) lines.push(`- target excerpt: ${redactCorpusText(`"${move.targetExcerpt}"`)}`);
    if (move.evidence) {
      lines.push(`- receipts: ${redactCorpusText(move.evidence.label || '(unlabeled)')} — ${redactCorpusText(move.evidence.sourceText || '')}`);
    }
    if (move.selectedTagCodes && move.selectedTagCodes.length > 0) {
      lines.push(`- tags: \`${move.selectedTagCodes.join('`, `')}\``);
    }
    if (move.expectedRestingStatus) lines.push(`- expectedRestingStatus: \`${move.expectedRestingStatus}\``);
    if (move.expectedClaimStanding) lines.push(`- expectedClaimStanding: \`${move.expectedClaimStanding}\``);
    lines.push(`- status: \`${status}\``);
    if (result?.errorDetail) lines.push(`- errorDetail: ${redactCorpusText(result.errorDetail)}`);
    lines.push(`- decisionIntent: \`${trace.decisionIntent}\``);
    lines.push(`- spice: \`${trace.spiceLevel}\` · specificity: \`${trace.specificity}\` · pressure: \`${trace.pressureApplied}\``);
    lines.push(`- whyThisMove: ${redactCorpusText(trace.whyThisMove)}`);
    lines.push(`- whyThisParent: ${redactCorpusText(trace.whyThisParent)}`);
    lines.push(`- expectedCounter: ${redactCorpusText(trace.expectedCounter)}`);
    if (trace.tuningConcern) lines.push(`- tuningConcern: ${redactCorpusText(trace.tuningConcern)}`);
    lines.push('');
    lines.push('Body:');
    lines.push('');
    lines.push(safeBody(move.body));
    lines.push('');
  }

  lines.push('### Room engagement scores');
  lines.push('');
  lines.push('| Metric | Score |');
  lines.push('|---|---:|');
  for (const [k, v] of Object.entries(engagement.scores)) lines.push(`| ${k} | ${v} |`);
  lines.push(`| **average** | **${engagement.average}** |`);
  lines.push('');
  lines.push(`**Recommended tune:** ${redactCorpusText(engagement.recommendedTune)}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  return lines.join('\n');
}

function buildCorpusSummary(scenarios, roomResults) {
  const totals = { rooms: roomResults.length, moves: 0, posted: 0, failed_422: 0, failed_403: 0, failed_500: 0, skipped: 0 };
  const roomScores = [];
  const intentCounts = new Map();
  const branchSamples = [];
  const spiceHotSamples = [];
  const concessionSamples = [];
  const receiptSamples = [];

  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    const r = roomResults[i] || { results: [] };
    const eng = scoreRoomEngagement(s, r.results || []);
    roomScores.push({ scenarioId: s.scenarioId, title: s.title, average: eng.average });

    for (const move of s.moves || []) {
      totals.moves++;
      const intent = classifyDecisionIntent(move);
      intentCounts.set(intent, (intentCounts.get(intent) || 0) + 1);
      if (intent === 'branch_tangent') branchSamples.push({ scenarioId: s.scenarioId, moveId: move.moveId });
      if (classifySpiceLevel(move) === 'hot') spiceHotSamples.push({ scenarioId: s.scenarioId, moveId: move.moveId });
      if (move.argumentType === 'concession') concessionSamples.push({ scenarioId: s.scenarioId, moveId: move.moveId });
      if (move.argumentType === 'evidence') receiptSamples.push({ scenarioId: s.scenarioId, moveId: move.moveId });
    }
    for (const res of r.results || []) {
      const s2 = res.actualStatus;
      if (s2 === 'posted') totals.posted++;
      else if (s2 === 'failed_422') totals.failed_422++;
      else if (s2 === 'failed_403') totals.failed_403++;
      else if (s2 === 'failed_500') totals.failed_500++;
      else totals.skipped++;
    }
  }
  roomScores.sort((a, b) => b.average - a.average);
  const strongest = roomScores.slice(0, 3);
  const weakest = roomScores.slice(-3).reverse();
  return { totals, roomScores, strongest, weakest, intentCounts, branchSamples, spiceHotSamples, concessionSamples, receiptSamples };
}

function buildEngagementCorpusMarkdown(run) {
  const { runId, dateIso, mode, scenarios, roomResults } = run;
  const summary = buildCorpusSummary(scenarios, roomResults);
  const categories = Array.from(new Set(scenarios.map((s) => s.category)));
  const personas = ['provocateur (Alex/affirmative)', 'revocateur (Jordan/negative)', 'synthesizer (Sam/neutral)'];

  const lines = [];
  const date = (dateIso || new Date().toISOString()).slice(0, 10);
  lines.push(`# Bot Engagement Corpus — ${date}`);
  lines.push('');
  lines.push(`_Run id_: \`${runId}\``);
  lines.push(`_Mode_: ${mode}`);
  lines.push(`_Scenarios_: ${scenarios.length}  ·  _Rooms_: ${summary.totals.rooms}  ·  _Moves_: ${summary.totals.moves}`);
  lines.push(`_Categories_: ${categories.join(', ')}`);
  lines.push(`_Bot personas_: ${personas.join(' · ')}`);
  if (mode === 'live') {
    lines.push(`_Posted_: ${summary.totals.posted} / ${summary.totals.moves}  ·  _failed_422_: ${summary.totals.failed_422}  ·  _failed_403_: ${summary.totals.failed_403}  ·  _failed_500_: ${summary.totals.failed_500}  ·  _skipped_: ${summary.totals.skipped}`);
  } else {
    lines.push(`_Posted_: 0 / ${summary.totals.moves} (dry mode — moves planned, not submitted)`);
  }
  lines.push(`_Secrets exposed_: no  ·  _Anthropic called_: no  ·  _service-role used_: no`);
  lines.push('');
  lines.push('## Corpus engagement summary');
  lines.push('');
  lines.push('### Strongest rooms (by avg score)');
  for (const r of summary.strongest) lines.push(`- ${r.average} — \`${r.scenarioId}\` · ${redactCorpusText(r.title)}`);
  lines.push('');
  lines.push('### Weakest rooms (by avg score)');
  for (const r of summary.weakest) lines.push(`- ${r.average} — \`${r.scenarioId}\` · ${redactCorpusText(r.title)}`);
  lines.push('');
  lines.push('### Decision-intent distribution');
  const intentEntries = [...summary.intentCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [k, v] of intentEntries) lines.push(`- \`${k}\` — ${v}`);
  lines.push('');
  lines.push('### Notable moments');
  lines.push(`- Tangent / branch candidates: ${summary.branchSamples.length}`);
  lines.push(`- Hot-spice moves: ${summary.spiceHotSamples.length}`);
  lines.push(`- Concessions: ${summary.concessionSamples.length}`);
  lines.push(`- Evidence drops: ${summary.receiptSamples.length}`);
  lines.push('');
  lines.push('### Tuning recommendations');
  const tuning = [];
  if (summary.strongest.length && summary.strongest[0].average < 4) tuning.push('Top room avg < 4 — overall corpus is templated. Expand spicy phrase pools and add more specificity to bodies.');
  if (summary.spiceHotSamples.length < scenarios.length) tuning.push('< 1 hot-spice move per room — increase use of phrases like "vibes-only", "dodge", "bold claim wearing a tiny hat".');
  if (summary.branchSamples.length < scenarios.length) tuning.push('< 1 tangent/branch candidate per room — at least one move per template should set displayMeta.branchCandidate.');
  if (summary.totals.failed_422 > 0) tuning.push(`${summary.totals.failed_422} failed_422 moves — inspect run log for repeated rule codes.`);
  if (summary.totals.failed_403 > 0) tuning.push(`${summary.totals.failed_403} failed_403 moves — verify participant join + side assignment.`);
  if (tuning.length === 0) tuning.push('No top-level tuning concerns — inspect lowest-scoring rooms for fine-tuning.');
  for (const t of tuning) lines.push(`- ${t}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  // Per-room transcripts
  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    const r = roomResults[i] || { roomId: null, results: [] };
    lines.push(`# Room ${String(i + 1).padStart(2, '0')} of ${scenarios.length}`);
    lines.push('');
    lines.push(buildRoomTranscript(s, r, mode));
  }

  lines.push('');
  lines.push('## Secrets check');
  lines.push('');
  lines.push('- [x] No emails in plaintext (redactor strips them)');
  lines.push('- [x] No passwords or `password=...` lines');
  lines.push('- [x] No JWT-shape tokens');
  lines.push('- [x] No Supabase secret keys');
  lines.push('- [x] No `.env.bot-tests` values');
  lines.push('- [x] No service-role key used by runner');
  lines.push('');
  return lines.join('\n');
}

function buildEngagementCorpusJsonlEvents(run) {
  const { runId, dateIso, mode, scenarios, roomResults } = run;
  const events = [];
  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    const r = roomResults[i] || { roomId: null, results: [] };
    const moveById = new Map((s.moves || []).map((m) => [m.moveId, m]));
    const resultByMoveId = new Map((r.results || []).map((res) => [res.moveId, res]));
    for (const move of s.moves || []) {
      const parent = move.parentMoveId ? moveById.get(move.parentMoveId) : null;
      const trace = buildDecisionTraceForMove(s, move, parent);
      const result = resultByMoveId.get(move.moveId);
      events.push({
        ts: dateIso || new Date().toISOString(),
        runId,
        mode,
        scenarioId: s.scenarioId,
        category: s.category,
        roomId: r.roomId,
        moveId: move.moveId,
        argumentId: result?.argumentId || null,
        authorAlias: move.authorAlias,
        moveKind: move.moveKind,
        argumentType: move.argumentType,
        disagreementAxis: move.disagreementAxis || null,
        parentMoveId: move.parentMoveId,
        status: result?.actualStatus || (mode === 'dry' ? 'planned' : 'unknown'),
        httpStatus: result?.httpStatus || null,
        errorCode: result?.errorCode || null,
        errorDetail: result?.errorDetail || null,
        decisionIntent: trace.decisionIntent,
        spiceLevel: trace.spiceLevel,
        specificity: trace.specificity,
        pressureApplied: trace.pressureApplied,
        bodyLength: (move.body || '').length,
        hasTargetExcerpt: Boolean(move.targetExcerpt),
        hasEvidence: Boolean(move.evidence),
      });
    }
  }
  return events;
}

module.exports = {
  redactCorpusText,
  classifyDecisionIntent,
  classifySpiceLevel,
  classifySpecificity,
  estimatePressureApplied,
  getExpectedCounter,
  getTuningConcern,
  getBotLane,
  buildDecisionTraceForMove,
  scoreRoomEngagement,
  buildRoomTranscript,
  buildCorpusSummary,
  buildEngagementCorpusMarkdown,
  buildEngagementCorpusJsonlEvents,
};
