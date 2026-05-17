#!/usr/bin/env node
/**
 * Stage 6.1.7 — xAI adversarial thread corpus runner.
 *
 * Pipeline (operator-gated):
 *   1. Refuse unless all env + key + --pilot gates pass (for any live mode).
 *   2. Collect source candidates via the xAI provider abstraction.
 *   3. Sample N source posts from the candidate pool (deterministic seed).
 *   4. For each source, collect top reply candidates and pick the first
 *      meaningfully disagreeable reply.
 *   5. Build a scene with three bots (deterministic skill assignment).
 *   6. Run continuation via the existing AI move renderer + submit-argument
 *      flow until: synthesis / explicit concession / unresolved debt
 *      acknowledged / max depth / repeated validation failure / submit
 *      failure on a parent.
 *   7. Annotate every event into the v2 schema via the existing annotator
 *      (deterministic fallback when Anthropic refuses or returns bad JSON).
 *   8. Stream every event to a gitignored JSONL.
 *   9. Emit one committable Markdown report (`docs/testing-runs/<date>-…`).
 *
 * Dry mode skips all network + Supabase. The JSONL + Markdown are still
 * produced from deterministic placeholders so the pipeline shape can be
 * inspected without spend.
 *
 * This module never decides truth, never labels users, never makes
 * moderation recommendations.
 */
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');

const REPO_ROOT = process.cwd();
const REPORT_DIR = path.join(REPO_ROOT, 'docs', 'testing-runs');
const LOG_DIR = path.join(REPO_ROOT, 'logs', 'engagement-intelligence');

const { loadEnvFiles, buildBotConfig } = require('./loadEnv');
const { createBotClient, signInBot } = require('./supabaseClient');
const { ensureBotUser } = require('./adminOps');
const { buildSubmitArgumentBody, invokeSubmitArgument } = require('./submitMove');
const { mapPersonaSideToParticipantSide } = require('./personaMapping');
const claudeClient = require('./claudeMessagesClient');
const { renderMoveBody } = require('./aiMoveRenderer');
const { annotateMove, fallbackAnnotation } = require('./anthropicArgumentAnnotator');
const { computeAgreementDisagreementVector } = require('../engagement-intelligence/agreementScalarJs');
const { collectSourceCandidates, sampleDeterministic } = require('../engagement-intelligence/xaiAdversarialSourceCollector');
const { collectReplyCandidates } = require('../engagement-intelligence/xaiReplyCollector');
const { selectFirstDisagreeableReply, buildSyntheticRebuttal } = require('../engagement-intelligence/selectFirstDisagreeableReply');
const { buildAdversarialScene } = require('./xaiAdversarialSceneBuilder');
const { buildAdversarialReportMarkdown } = require('./xaiAdversarialReport');
const { envSnapshot: xaiEnvSnapshot } = require('../engagement-intelligence/xaiAdversarialProvider');

function parseArgs(argv) {
  const args = {
    pilot: false,
    dry: true,
    rooms: 3,
    candidatePosts: 30,
    topReplies: 12,
    maxDepth: 5,
    sourceMode: 'synthetic',
    provider: 'xai_responses',
    annotationJsonl: null,
    reportName: null,
    postToDevSupabase: false,
    allowSyntheticRebuttal: false,
    syntheticRebuttalThreshold: 3,
    seed: 'cdiscourse-xai-adv',
    budgetMaxAnthropicCalls: 200,
    budgetMaxInputTokens: 400_000,
    budgetMaxOutputTokens: 120_000,
    budgetMaxXaiCalls: 200,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry') args.dry = true;
    else if (a === '--pilot') { args.pilot = true; args.dry = false; }
    else if (a === '--rooms' && argv[i + 1]) args.rooms = Math.max(1, Math.min(200, Number(argv[++i]) || 3));
    else if (a === '--candidate-posts' && argv[i + 1]) args.candidatePosts = Math.max(1, Math.min(1000, Number(argv[++i]) || 30));
    else if (a === '--top-replies' && argv[i + 1]) args.topReplies = Math.max(1, Math.min(30, Number(argv[++i]) || 12));
    else if (a === '--max-depth' && argv[i + 1]) args.maxDepth = Math.max(2, Math.min(20, Number(argv[++i]) || 5));
    else if (a === '--source-mode' && argv[i + 1]) args.sourceMode = String(argv[++i]);
    else if (a === '--provider' && argv[i + 1]) args.provider = String(argv[++i]);
    else if (a === '--annotation-jsonl' && argv[i + 1]) args.annotationJsonl = String(argv[++i]);
    else if (a === '--report-name' && argv[i + 1]) args.reportName = String(argv[++i]);
    else if (a === '--post-to-dev-supabase') args.postToDevSupabase = true;
    else if (a === '--allow-synthetic-rebuttal') args.allowSyntheticRebuttal = true;
    else if (a === '--synthetic-rebuttal-threshold' && argv[i + 1]) args.syntheticRebuttalThreshold = Math.max(1, Number(argv[++i]) || 3);
    else if (a === '--seed' && argv[i + 1]) args.seed = String(argv[++i]);
    else if (a === '--budget-max-anthropic-calls' && argv[i + 1]) args.budgetMaxAnthropicCalls = Math.max(1, Number(argv[++i]) || 200);
    else if (a === '--budget-max-input-tokens' && argv[i + 1]) args.budgetMaxInputTokens = Math.max(1, Number(argv[++i]) || 400_000);
    else if (a === '--budget-max-output-tokens' && argv[i + 1]) args.budgetMaxOutputTokens = Math.max(1, Number(argv[++i]) || 120_000);
    else if (a === '--budget-max-xai-calls' && argv[i + 1]) args.budgetMaxXaiCalls = Math.max(1, Number(argv[++i]) || 200);
  }
  return args;
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function envBooleans() {
  const xs = xaiEnvSnapshot();
  let botTestsExists = false;
  try { botTestsExists = fs.existsSync(path.join(REPO_ROOT, '.env.bot-tests')); } catch { /* ignore */ }
  // Anthropic env is read by claudeMessagesClient; we re-derive booleans
  // here without printing any value.
  const envFile = path.join(REPO_ROOT, '.env.engagement-intelligence');
  let anthropicKey = false; let enableAnthropic = false;
  if (fs.existsSync(envFile)) {
    const txt = fs.readFileSync(envFile, 'utf8');
    anthropicKey = /^ANTHROPIC_API_KEY=\S/m.test(txt) && !/^ANTHROPIC_API_KEY=\s*$/m.test(txt);
    enableAnthropic = /^ENGAGEMENT_INTEL_ENABLE_ANTHROPIC=true\b/m.test(txt);
  }
  // process.env wins.
  if (process.env.ANTHROPIC_API_KEY) anthropicKey = true;
  if (String(process.env.ENGAGEMENT_INTEL_ENABLE_ANTHROPIC || '').toLowerCase() === 'true') enableAnthropic = true;
  return {
    hasXaiKey: xs.hasXaiKey,
    enableXai: xs.enableXai,
    hasAnthropicKey: anthropicKey,
    enableAnthropic,
    hasBotTests: botTestsExists,
  };
}

function refuseLive(args, bools) {
  const reasons = [];
  if (!bools.hasXaiKey) reasons.push('XAI_API_KEY missing');
  if (!bools.enableXai) reasons.push('ENGAGEMENT_INTEL_ENABLE_XAI not true');
  if (!bools.hasAnthropicKey) reasons.push('ANTHROPIC_API_KEY missing');
  if (!bools.enableAnthropic) reasons.push('ENGAGEMENT_INTEL_ENABLE_ANTHROPIC not true');
  if (!bools.hasBotTests) reasons.push('.env.bot-tests missing');
  if (!args.pilot) reasons.push('--pilot not set');
  if (args.sourceMode === 'xai_live' && !args.pilot) reasons.push('xai_live source-mode requires --pilot');
  return reasons;
}

// ── JSONL writer ───────────────────────────────────────────────

class JsonlStream {
  constructor(filePath) {
    ensureDir(path.dirname(filePath));
    this.stream = fs.createWriteStream(filePath);
    this.path = filePath;
    this.eventTypes = new Set();
  }
  write(eventType, data = {}) {
    this.eventTypes.add(eventType);
    // The outer eventType is canonical. Spread `data` FIRST so caller-supplied
    // keys cannot override the eventType label; then overwrite ts + eventType.
    this.stream.write(JSON.stringify({ ...data, ts: new Date().toISOString(), eventType }) + '\n');
  }
  end() { return new Promise((resolve) => this.stream.end(resolve)); }
}

// ── Continuation move generation ───────────────────────────────

const STOP_CONCESSION_PATTERN = /you'?re right about|i'll narrow that|i concede|i'll grant|i accept your point on|fair point on/i;
const STOP_SYNTHESIS_PATTERN = /shared ground|both sides agree|let's close (the )?thread/i;

function buildThreadContext(scenario, postedMoves) {
  return postedMoves.map((m, i) => ({
    moveId: m.moveId,
    argumentType: m.argumentType,
    side: m.authorAlias,
    parentMoveId: m.parentMoveId,
    body: m.body,
  }));
}

function decideStopAfter(scenario, lastMove, postedMoves, maxDepth) {
  if (postedMoves.length >= maxDepth + 2) return 'max_depth_reached'; // +2 for thesis + initial rebuttal
  const body = String(lastMove.body || '').toLowerCase();
  if (lastMove.argumentType === 'synthesis') return 'synthesis_accepted';
  if (lastMove.argumentType === 'concession') return 'explicit_concession';
  if (STOP_CONCESSION_PATTERN.test(body)) return 'soft_concession_marker';
  if (STOP_SYNTHESIS_PATTERN.test(body)) return 'soft_synthesis_marker';
  return null;
}

function buildNextSlot(scenario, postedMoves) {
  // Simple alternation between the two defenders, with the synthesizer
  // (persona[2]) stepping in late if a concession or synthesis marker
  // appears. Skill-respecting renderer handles body generation.
  const personas = scenario.personas;
  const last = postedMoves[postedMoves.length - 1];
  const lastIdx = personas.findIndex((p) => p.alias === last.authorAlias);
  const nextPersona = personas[(lastIdx + 1) % 2 === 0 ? 1 : 0];
  const turnNum = postedMoves.length + 1;
  const moveId = `m${turnNum}`;
  // Slot shape mirrors what aiMoveRenderer expects from stress templates.
  return {
    moveId,
    parent: last.moveId,
    moveKind: 'continuation',
    argumentType: turnNum % 2 === 0 ? 'rebuttal' : 'counter_rebuttal',
    author: personas.findIndex((p) => p.alias === nextPersona.alias),
    target: true,
    playfulLabel: null,
    branchCandidate: false,
    nextPersona,
  };
}

// ── Per-room runner ────────────────────────────────────────────

async function runOneRoom({ scenario, args, supabase, anthropicClient, jsonl, runId, sceneSummaries }) {
  const personasByAlias = new Map(scenario.personas.map((p) => [p.alias, p]));
  const postedMoves = []; // [{moveId, body, authorAlias, argumentType, parentMoveId, supabaseArgumentId}]
  const seededMoves = scenario.seededMoves || [];

  // Seed thesis (m1) and rebuttal (m2) as already-existing moves. They
  // come from the source / reply that have already been redacted.
  for (const seeded of seededMoves) {
    postedMoves.push({ ...seeded });
    jsonl.write('move_generated', {
      runId, scenarioId: scenario.scenarioId, moveId: seeded.moveId,
      argumentType: seeded.argumentType, bodySource: seeded.bodySource, bodyHash: seeded.bodyHash,
      isSeed: true,
    });
  }

  // Optional Supabase write: only when --post-to-dev-supabase + supabase is ready.
  let debateId = null;
  if (supabase && args.postToDevSupabase && !args.dry) {
    try {
      const constitutionRes = await supabase.adminClient.from('constitution_versions').select('id').eq('active', true).single();
      if (!constitutionRes.error && constitutionRes.data) {
        const botA = supabase.botByAlias[scenario.personas[0].alias];
        const debateInsert = await botA.client.from('debates').insert({
          created_by: botA.userId,
          title: `${scenario.title} [xai-adv ${runId.slice(0, 8)}]`,
          resolution: scenario.resolution,
          description: '',
          status: 'open',
          constitution_id: constitutionRes.data.id,
        }).select('id').single();
        if (!debateInsert.error && debateInsert.data) {
          debateId = debateInsert.data.id;
          await botA.client.from('debate_participants').insert({ debate_id: debateId, user_id: botA.userId, side: 'moderator' });
          for (let pi = 1; pi < scenario.personas.length; pi++) {
            const persona = scenario.personas[pi];
            const bot = supabase.botByAlias[persona.alias];
            const side = mapPersonaSideToParticipantSide(persona.assignedSide === 'reply_defender' ? 'negative' : (persona.assignedSide === 'synthesis_moderator' ? 'neutral' : 'affirmative'));
            const { error } = await bot.client.from('debate_participants').insert({ debate_id: debateId, user_id: bot.userId, side });
            if (error && error.code !== '23505') console.warn(`[xai-adv] join failed: ${error.message}`);
          }
          jsonl.write('debate_created', { runId, scenarioId: scenario.scenarioId, debateId });
        }
      }
    } catch (err) {
      jsonl.write('debate_create_failed', { runId, scenarioId: scenario.scenarioId, error: String(err.message).slice(0, 240) });
    }
  } else {
    jsonl.write('debate_created', { runId, scenarioId: scenario.scenarioId, debateId: null, mode: args.dry ? 'dry' : 'no_supabase' });
  }
  for (const persona of scenario.personas) {
    jsonl.write('bot_assigned', {
      runId, scenarioId: scenario.scenarioId,
      botUserAlias: persona.alias, skillRole: persona.skillRole, assignedSide: persona.assignedSide,
      stanceDefended: persona.stanceDefended, sourceHash: persona.sourceHash, replyHash: persona.replyHash,
    });
  }

  // ── Annotate the two seeded moves first.
  for (let i = 0; i < seededMoves.length; i++) {
    const m = seededMoves[i];
    const parent = i === 0 ? null : seededMoves[i - 1];
    const deterministicVector = parent
      ? computeAgreementDisagreementVector(parent.body, m.body)
      : computeAgreementDisagreementVector('', m.body);
    const annotation = await annotateAndLog({
      anthropicClient, scenario, move: m, parent, thread: postedMoves.slice(0, i),
      deterministicVector, jsonl, runId, eventType: i === 0 ? 'source_annotated' : 'reply_annotated',
    });
    if (annotation && parent) { /* link nothing; annotation written by helper */ }
  }

  // ── Generate continuation moves up to maxDepth.
  let stopReason = null;
  let lastSubmitFailed = 0;
  while (!stopReason) {
    const last = postedMoves[postedMoves.length - 1];
    const slot = buildNextSlot(scenario, postedMoves);
    const parentBody = last.body;
    const persona = slot.nextPersona.skillRole === 'bot-provocateur' ? 'provocateur' : (slot.nextPersona.skillRole === 'bot-revocateur' ? 'revocateur' : 'synthesizer');
    const topic = {
      topicId: scenario.scenarioId,
      title: scenario.title,
      resolution: scenario.resolution,
      thesisFraming: scenario.rootClaim,
      counterClaims: [],
      evidenceFacts: [],
      scopeNarrowings: [],
      tangentHooks: [],
    };
    jsonl.write('move_prompt_built', { runId, scenarioId: scenario.scenarioId, moveId: slot.moveId, persona, argumentType: slot.argumentType });

    let renderResult;
    if (args.dry || !anthropicClient) {
      renderResult = {
        source: 'dry_placeholder',
        body: `[DRY] ${persona} continuation for ${scenario.scenarioId} slot ${slot.moveId} — ${slot.argumentType} on parent ${last.moveId}.`,
        attempts: 0,
        validationFailureReason: null,
      };
    } else {
      renderResult = await renderMoveBody({
        client: anthropicClient,
        persona,
        topic,
        scenarioCategory: 'xai_adversarial',
        parentBody,
        slot,
        conversationSummary: buildThreadContext(scenario, postedMoves).slice(-6).map((t) => `${t.moveId}/${t.argumentType}: ${t.body.slice(0, 120)}`).join('\n'),
        rng: Math.random,
        evidenceFact: null,
        maxRetries: 1,
        fallbackDeterministic: true,
      });
      jsonl.write('anthropic_call', {
        runId, scenarioId: scenario.scenarioId, moveId: slot.moveId,
        source: renderResult.source, attempts: renderResult.attempts,
        inputTokens: renderResult.inputTokens || 0, outputTokens: renderResult.outputTokens || 0,
      });
    }
    jsonl.write('move_validated', {
      runId, scenarioId: scenario.scenarioId, moveId: slot.moveId,
      validationStatus: renderResult.validationFailureReason ? 'failed' : 'ok',
      validationErrors: renderResult.validationFailureReason ? [renderResult.validationFailureReason] : [],
      renderSource: renderResult.source,
    });

    const moveRow = {
      moveId: slot.moveId,
      authorAlias: slot.nextPersona.alias,
      parentMoveId: last.moveId,
      argumentType: slot.argumentType,
      disagreementAxis: slot.argumentType === 'rebuttal' ? 'logic' : null,
      targetExcerpt: parentBody.slice(0, 120),
      body: renderResult.body,
      selectedTagCodes: [],
      evidence: null,
    };

    // Submit through submit-argument (NEVER direct insert).
    let submitStatus = 'planned';
    let submitErrorCode = null;
    let submitErrorDetail = null;
    let supabaseArgumentId = null;
    if (supabase && args.postToDevSupabase && debateId && !args.dry) {
      const bot = supabase.botByAlias[moveRow.authorAlias];
      const parentArgumentId = postedMoves.find((m) => m.moveId === moveRow.parentMoveId)?.supabaseArgumentId || null;
      const body = buildSubmitArgumentBody({
        debateId, parentArgumentId,
        move: {
          moveId: moveRow.moveId, argumentType: moveRow.argumentType,
          authorAlias: moveRow.authorAlias, parentMoveId: moveRow.parentMoveId,
          disagreementAxis: moveRow.disagreementAxis, targetExcerpt: moveRow.targetExcerpt,
          body: moveRow.body, selectedTagCodes: moveRow.selectedTagCodes, evidence: moveRow.evidence,
        },
        side: slot.nextPersona.assignedSide === 'reply_defender' ? 'negative' : (slot.nextPersona.assignedSide === 'synthesis_moderator' ? 'neutral' : 'affirmative'),
        clientSubmissionId: randomUUID(),
      });
      const r = await invokeSubmitArgument(bot.client, body);
      if (r.ok) {
        submitStatus = 'posted';
        supabaseArgumentId = r.data && r.data.argument && r.data.argument.id;
      } else {
        submitStatus = `failed_${r.status}`;
        submitErrorCode = (r.error && r.error.error) || 'unknown';
        submitErrorDetail = r.detail || null;
        lastSubmitFailed++;
      }
    } else {
      submitStatus = args.dry ? 'dry_simulated' : (args.postToDevSupabase ? 'no_debate' : 'not_posted');
    }

    moveRow.supabaseArgumentId = supabaseArgumentId;
    postedMoves.push(moveRow);
    jsonl.write('move_submitted', {
      runId, scenarioId: scenario.scenarioId, moveId: moveRow.moveId,
      submitStatus, errorCode: submitErrorCode,
      errorDetail: submitErrorDetail ? String(submitErrorDetail).slice(0, 240) : null,
      argumentId: supabaseArgumentId,
    });

    // Annotate this move.
    const parentForAnn = { moveId: last.moveId, argumentType: last.argumentType, body: parentBody };
    const deterministicVector = computeAgreementDisagreementVector(parentBody, moveRow.body);
    await annotateAndLog({
      anthropicClient, scenario, move: moveRow, parent: parentForAnn, thread: postedMoves.slice(0, -1),
      deterministicVector, jsonl, runId, eventType: 'move_annotated',
    });

    // Stop logic.
    stopReason = decideStopAfter(scenario, moveRow, postedMoves, args.maxDepth);
    if (!stopReason && lastSubmitFailed >= 3) stopReason = 'submit_failures_three_in_a_row';
  }

  const movesPosted = postedMoves.filter((m) => !m.isSeed).length;
  if (stopReason === 'max_depth_reached') jsonl.write('run_max_depth', { runId, scenarioId: scenario.scenarioId, maxDepthReached: args.maxDepth });
  if (stopReason === 'explicit_concession' || stopReason === 'soft_concession_marker' || stopReason === 'synthesis_accepted' || stopReason === 'soft_synthesis_marker') {
    jsonl.write('room_resolved', { runId, scenarioId: scenario.scenarioId, resolutionType: stopReason });
  } else {
    jsonl.write('room_stalemate', { runId, scenarioId: scenario.scenarioId, maxDepthReached: postedMoves.length });
  }
  sceneSummaries.push({
    scenarioId: scenario.scenarioId,
    provider: scenario.provider || 'unknown',
    topicBucket: scenario.topicBucket || 'unknown',
    syntheticRebuttal: Boolean(scenario.syntheticRebuttal),
    movesPosted,
    resolution: stopReason,
  });
  return { stopReason, movesPosted };
}

async function annotateAndLog({ anthropicClient, scenario, move, parent, thread, deterministicVector, jsonl, runId, eventType }) {
  const enriched = { ...scenario, roomId: scenario.scenarioId, resolution: scenario.resolution };
  let annotation;
  try {
    annotation = await annotateMove({
      client: anthropicClient,
      scenario: enriched,
      move: { ...move, side: move.authorAlias },
      parent: parent ? { moveId: parent.moveId, argumentType: parent.argumentType, body: parent.body } : null,
      thread,
      body: move.body,
      deterministicVector,
    });
  } catch (err) {
    annotation = fallbackAnnotation({
      scenario: enriched,
      move: { ...move, side: move.authorAlias },
      parent: parent ? { moveId: parent.moveId, argumentType: parent.argumentType, body: parent.body } : null,
      thread, body: move.body, deterministicVector,
      reason: 'annotation_threw',
    });
  }
  jsonl.write('annotation_completed', {
    runId, scenarioId: scenario.scenarioId, moveId: move.moveId,
    parentMoveId: parent?.moveId || null,
    annotation,
    annotationKind: eventType,
  });
  if (annotation && annotation.platformSupportWarning) {
    jsonl.write('point_standing_candidate', {
      runId, scenarioId: scenario.scenarioId, moveId: move.moveId,
      recommendedGameTreatment: annotation.recommendedGameTreatment,
      platformSupportWarning: true,
      evidentiaryRisk: annotation.evidentiaryRisk,
      amplificationRisk: annotation.amplificationRisk,
    });
  }
  return annotation;
}

// ── Source / reply selection orchestration ─────────────────────

async function selectScenes({ args, runId, jsonl, providerLabel }) {
  // Dry mode: synthetic source candidates from the existing seed file.
  if (args.dry || args.sourceMode === 'synthetic') {
    const { loadSyntheticSeeds } = require('../engagement-intelligence/xaiSeededStances');
    const seeds = loadSyntheticSeeds(Math.max(args.rooms, args.candidatePosts));
    const candidates = seeds.slice(0, args.rooms).map((s, i) => ({
      sourceOrdinal: i + 1,
      sourceHash: createHash('sha256').update(`${args.seed}:${s.topicId}`).digest('hex').slice(0, 16),
      provider: 'synthetic',
      providerQuery: 'synthetic-seed-fixture',
      providerRank: i + 1,
      providerConfidence: 0.6,
      citationRefs: [],
      topicBucket: s.topicId,
      sourceTextRedacted: s.thesisFraming || s.resolution,
      sourceClaimSummary: s.resolution || s.title,
      sourceClaimType: 'opinion',
      sourceMetricsIfAvailable: null,
      sourceCollectedAt: new Date().toISOString(),
      redactionApplied: true,
      redactionNotes: 'synthetic seed; no provider call',
    }));
    candidates.forEach((c) => jsonl.write('source_candidate', { runId, ...c }));
    candidates.forEach((c) => jsonl.write('source_selected', { runId, ...c }));
    return { candidates, selected: candidates };
  }

  // Live mode.
  jsonl.write('provider_query', { runId, provider: providerLabel, topicHint: 'current news', count: args.candidatePosts });
  const result = await collectSourceCandidates({
    topicHint: 'current news', count: args.candidatePosts, pilot: args.pilot,
    providerLabel, runSalt: args.seed,
  });
  result.candidates.forEach((c) => jsonl.write('source_candidate', { runId, ...c }));
  const selected = sampleDeterministic(result.candidates, args.rooms, args.seed);
  selected.forEach((c) => jsonl.write('source_selected', { runId, ...c }));
  return { candidates: result.candidates, selected };
}

async function selectReplyForSource({ args, runId, jsonl, source, providerLabel }) {
  // Dry / synthetic path → use existing synthetic counter-claim.
  if (args.dry || source.provider === 'synthetic') {
    const { loadSyntheticSeeds } = require('../engagement-intelligence/xaiSeededStances');
    const seeds = loadSyntheticSeeds(100);
    const seed = seeds.find((s) => s.topicId === source.topicBucket) || seeds[0];
    const reply = {
      replyOrdinal: 1,
      replyHash: createHash('sha256').update(`${args.seed}:${source.sourceHash}:reply`).digest('hex').slice(0, 16),
      sourceHash: source.sourceHash,
      provider: 'synthetic',
      providerRank: 1,
      providerConfidence: 0.6,
      topReplyMethod: 'provider_inferred',
      replyTextRedacted: (seed.counterClaims && seed.counterClaims[0]) || 'I disagree; the scope is too broad and the evidence is thin.',
      replyClaimSummary: 'Counter-position from synthetic seed fixture.',
      replyMetricsIfAvailable: null,
      citationRefs: [],
      collectedAt: new Date().toISOString(),
      redactionApplied: true,
      redactionNotes: 'synthetic counter-claim from seed fixture',
    };
    jsonl.write('reply_candidate', { runId, ...reply });
    jsonl.write('reply_selected', { runId, ...reply, classification: { primaryStance: 'weak_disagree', mixedAgreementClass: 'broad_accept_narrow_decline' } });
    return reply;
  }

  // Live: collect + select; on no qualifier, try synthetic fallback if allowed.
  let attemptsForSource = 0;
  let lastReason = null;
  while (attemptsForSource < args.syntheticRebuttalThreshold) {
    attemptsForSource++;
    try {
      const r = await collectReplyCandidates({
        source, count: args.topReplies, pilot: args.pilot,
        providerLabel, runSalt: args.seed,
      });
      r.replies.forEach((rep) => jsonl.write('reply_candidate', { runId, ...rep }));
      const sel = selectFirstDisagreeableReply({ source, replies: r.replies });
      lastReason = sel.reason;
      if (sel.selected) {
        jsonl.write('reply_selected', {
          runId, ...sel.selected.reply,
          classification: sel.selected.classification,
          reason: sel.reason,
        });
        return sel.selected.reply;
      }
    } catch (err) {
      jsonl.write('reply_collect_failed', { runId, sourceHash: source.sourceHash, error: String(err.message).slice(0, 240) });
      break;
    }
  }
  if (args.allowSyntheticRebuttal) {
    const synth = buildSyntheticRebuttal(source);
    jsonl.write('synthetic_rebuttal_generated', { runId, sourceHash: source.sourceHash, lastReason });
    jsonl.write('reply_selected', { runId, ...synth, reason: 'synthetic_fallback' });
    return synth;
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv);
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const bools = envBooleans();

  console.log(`[xai-adv] mode=${args.dry ? 'dry' : 'live'} rooms=${args.rooms} provider=${args.provider} sourceMode=${args.sourceMode}`);
  console.log(`[xai-adv] env: ${JSON.stringify(bools)}`);

  if (!args.dry) {
    const refusal = refuseLive(args, bools);
    if (refusal.length > 0) {
      console.error(`[xai-adv] refusing live run: ${refusal.join('; ')}`);
      process.exitCode = 2;
      return;
    }
    if (args.sourceMode === 'xai_live' && !args.pilot) {
      console.error('[xai-adv] refusing: xai_live source-mode requires --pilot');
      process.exitCode = 2;
      return;
    }
  }

  ensureDir(REPORT_DIR);
  ensureDir(LOG_DIR);
  const jsonlPath = args.annotationJsonl || path.join(LOG_DIR, `${runId}-xai-adversarial-thread-corpus.jsonl`);
  const jsonl = new JsonlStream(jsonlPath);
  console.log(`[xai-adv] jsonl: ${path.relative(REPO_ROOT, jsonlPath)} (gitignored — do not commit)`);

  jsonl.write('run_start', { runId, args: { ...args, envBooleans: bools }, providerLabel: args.provider });

  // Anthropic client (live only).
  let anthropicClient = null;
  if (!args.dry) {
    try {
      anthropicClient = claudeClient.createClient({ requirePilotFlag: true, pilot: args.pilot });
      console.log(`[xai-adv] anthropic client ready (model=${anthropicClient.snapshotUsage().model})`);
    } catch (err) {
      console.error(`[xai-adv] anthropic client refused: ${err.message}`);
      process.exitCode = 2;
      jsonl.write('run_summary', { runId, fatal: 'anthropic_client_refused' });
      await jsonl.end();
      return;
    }
  }

  // Source selection.
  const { selected } = await selectScenes({ args, runId, jsonl, providerLabel: args.provider });
  console.log(`[xai-adv] selected ${selected.length} source(s)`);

  // Bot pool from .env.bot-tests when live + posting; otherwise placeholder.
  let supabaseHandles = null;
  if (args.pilot && args.postToDevSupabase && !args.dry) {
    const env = loadEnvFiles();
    const cfg = buildBotConfig(env);
    const adminClient = createBotClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
    const adminSession = await signInBot(adminClient, cfg.adminEmail, cfg.adminPassword);
    if (!adminSession) { console.error('[xai-adv] admin sign-in failed'); process.exitCode = 3; await jsonl.end(); return; }
    const botByAlias = {};
    for (const bot of cfg.bots) {
      const { userId } = await ensureBotUser(adminClient, {
        label: bot.label, email: bot.email, password: bot.password,
        persona: bot.persona, displayName: bot.label,
      });
      const c = createBotClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
      const s = await signInBot(c, bot.email, bot.password);
      if (!s) { console.error(`[xai-adv] bot ${bot.alias} sign-in failed`); process.exitCode = 4; await jsonl.end(); return; }
      botByAlias[bot.alias] = { userId, email: bot.email, client: c };
    }
    supabaseHandles = { adminClient, botByAlias };
  }
  const botPool = supabaseHandles
    ? Object.entries(supabaseHandles.botByAlias).map(([alias, b]) => ({ alias, label: alias, email: b.email }))
    : [
        { alias: 'Alex', label: 'Alex', email: '<dev>' },
        { alias: 'Jordan', label: 'Jordan', email: '<dev>' },
        { alias: 'Sam', label: 'Sam', email: '<dev>' },
      ];

  // Per-source: pick reply, build scene, run continuation.
  const sceneSummaries = [];
  for (const source of selected) {
    const reply = await selectReplyForSource({ args, runId, jsonl, source, providerLabel: args.provider });
    if (!reply) {
      jsonl.write('room_skipped_no_reply', { runId, sourceHash: source.sourceHash });
      continue;
    }
    const scene = buildAdversarialScene({
      source, reply, botPool,
      opts: { runId, seed: args.seed },
    });
    await runOneRoom({
      scenario: scene,
      args, supabase: supabaseHandles, anthropicClient, jsonl, runId, sceneSummaries,
    });
  }

  // Drain JSONL events into memory for the Markdown report.
  await jsonl.end();
  const events = fs.readFileSync(jsonlPath, 'utf8').split('\n').filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);

  jsonl.write = () => {}; // closed
  const date = new Date().toISOString().slice(0, 10);
  const baseName = args.reportName || 'xai-adversarial-thread-corpus';
  const suffix = args.dry ? '-dry' : '';
  const mdPath = path.join(REPORT_DIR, `${date}-${baseName}${suffix}.md`);
  const md = buildAdversarialReportMarkdown({
    runId, dateIso: new Date().toISOString(), mode: args.dry ? 'dry' : 'live',
    providerLabel: args.provider,
    args: { ...args, envBooleans: bools },
    events,
    sceneSummaries,
    samples: collectSamples(events),
  });
  fs.writeFileSync(mdPath, md);
  console.log(`[xai-adv] markdown: ${path.relative(REPO_ROOT, mdPath)}`);

  // Final run summary.
  const stream = fs.createWriteStream(jsonlPath, { flags: 'a' });
  stream.write(JSON.stringify({ ts: new Date().toISOString(), eventType: 'run_summary', runId, mode: args.dry ? 'dry' : 'live', rooms: selected.length, jsonlPath, mdPath }) + '\n');
  stream.end();
  console.log('[xai-adv] done.');
}

function collectSamples(events) {
  // Pull a few small example arrays for the report. Capped + redacted.
  const broadAcceptNarrowDecline = [];
  const viralLowEvidence = [];
  const noFactualStanding = [];
  const standingAfterEvidence = [];
  for (const ev of events) {
    if (ev.eventType !== 'annotation_completed') continue;
    const a = ev.annotation || {};
    const move = a && a.moveId ? a.moveId : ev.moveId;
    const summary = a.modelJustification?.shortReason || a.justification || 'observable text features only';
    const excerpt = a.qualifierCodes?.join(', ') || '';
    if (a.qualifierCodes && a.qualifierCodes.includes && a.qualifierCodes.includes('broad_accept_narrow_decline') && broadAcceptNarrowDecline.length < 5) {
      broadAcceptNarrowDecline.push({ summary, excerpt, justification: a.justification });
    }
    if ((a.amplificationSignals?.appeal_to_virality || a.amplificationSignals?.high_engagement_low_evidence) && viralLowEvidence.length < 5) {
      viralLowEvidence.push({ summary, excerpt, justification: a.justification });
    }
    if (a.deterministicRuleCandidate?.shouldTreatAsOpinionNoFactualCredit && noFactualStanding.length < 8) {
      noFactualStanding.push({ summary, excerpt, justification: a.justification });
    }
    if (a.recommendedGameTreatment === 'allow_point_standing_after_evidence' && standingAfterEvidence.length < 8) {
      standingAfterEvidence.push({ summary, excerpt, justification: a.justification });
    }
  }
  return {
    broadAcceptNarrowDecline,
    viralLowEvidence,
    noFactualStanding,
    standingAfterEvidence,
    strongestRooms: [], weakestRooms: [],
    provocateurWins: [], revocateurWins: [],
  };
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[xai-adv][fatal]', String(err.message).slice(0, 400));
    process.exitCode = 99;
  });
}

module.exports = {
  parseArgs,
  envBooleans,
  refuseLive,
  selectScenes,
  selectReplyForSource,
  buildNextSlot,
  decideStopAfter,
  collectSamples,
};
