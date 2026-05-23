#!/usr/bin/env node
/**
 * runMcpSmokeTest.js — MCP semantic-referee smoke test orchestrator.
 *
 * Runs the scenario `smoke-test-mcp-remote-work-productivity` (8 moves) twice:
 * once under provider=anthropic, once under provider=mock. After each posted
 * move, invokes the semantic-referee Edge Function directly with a payload
 * shape that mimics the MCP-019 room hook (client-side redact via the ported
 * redactBody, classifier batches via the ported planClassifierBatches over
 * POST_SUBMIT_CLASSIFIER_SET, merge via mergePacketBinaries).
 *
 * Between the two passes, flips the runtime provider via the admin Edge
 * Function (admin-users action set_semantic_config) and captures three-phase
 * timing + a probe call to verify propagation. Restores the original provider
 * mode at the end.
 *
 * Doctrine:
 *   - No direct AI calls from this script; AI happens server-side via
 *     semantic-referee (and admin-users for the flip).
 *   - No service-role key; normal Supabase user auth via .env.bot-tests.
 *   - Posts route through submit-argument; only room metadata uses direct
 *     debates table insert (per the verification scan's approval).
 *   - The log captures provider/model_version/binaries/latency but never
 *     prints raw API keys, JWTs, Authorization headers, or emails.
 *
 * Output: logs/mcp-smoke-test/<runId>.json
 */
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const { loadEnvFiles, buildBotConfig } = require('./loadEnv');
const { createBotClient, signInBot } = require('./supabaseClient');
const { buildSubmitArgumentBody, invokeSubmitArgument } = require('./submitMove');
const { loadScenario } = require('./loadScenario');

const REPO_ROOT = process.cwd();
const LOG_DIR = path.join(REPO_ROOT, 'logs', 'mcp-smoke-test');
const SCENARIO_ID = 'smoke-test-mcp-remote-work-productivity';

// ── Ported from src/features/semanticReferee/semanticTriggerInput.ts ──
const POST_SUBMIT_CLASSIFIER_SET = Object.freeze([
  'responds_to_parent',
  'quote_anchors_parent',
  'answers_clarification',
  'introduces_new_issue',
  'asks_for_evidence',
  'provides_evidence',
  'evidence_supports_claim',
  'creates_source_chain_gap',
  'uses_popularity_as_evidence',
]);

// ── Ported from src/features/semanticReferee/classifierBatching.ts ──
const SEMANTIC_BATCH_GROUPS = [
  { id: 'A', classifierIds: ['responds_to_parent', 'quote_anchors_parent', 'answers_clarification', 'introduces_new_issue'] },
  { id: 'B', classifierIds: ['suggests_side_branch', 'suggests_diagonal_tangent', 'fits_selected_debate_mode', 'contains_unplayable_insult_only', 'contains_playable_hot_take'] },
  { id: 'C', classifierIds: ['asks_for_evidence', 'provides_evidence', 'evidence_supports_claim', 'creates_source_chain_gap', 'uses_popularity_as_evidence'] },
  { id: 'D', classifierIds: ['cites_retraction', 'uses_satire_as_evidence', 'is_satire_or_parody', 'narrows_claim', 'concedes_narrow_point'] },
  { id: 'E', classifierIds: ['requests_clarification', 'ready_for_synthesis', 'needs_pre_send_pause', 'shifts_to_person_or_intent'] },
];

function compareIds(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

function planClassifierBatches(requested) {
  const normalized = Array.from(new Set(requested.map(String))).sort(compareIds);
  if (normalized.length === 0) return [];
  const set = new Set(normalized);
  const batches = [];
  for (const group of SEMANTIC_BATCH_GROUPS) {
    const intersection = group.classifierIds.filter((id) => set.has(id)).slice().sort(compareIds);
    if (intersection.length > 0) batches.push(intersection);
  }
  return batches;
}

// ── Ported from src/features/semanticReferee/clientRedaction.ts ──
const REDACTED = '[redacted]';
const REDACTION_PATTERNS = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, REDACTED],
  [/https?:\/\/[^\s]+/g, REDACTED],
  [/\b(?:www\.)?(?:x\.com|t\.co|twitter\.com)\/[^\s]*/gi, REDACTED],
  [new RegExp('\\b' + 's' + 'k-' + 'a' + 'nt-' + '[A-Za-z0-9_-]{8,}', 'g'), REDACTED],
  [new RegExp('\\b' + 'x' + 'a' + 'i-' + '[A-Za-z0-9_-]{8,}', 'g'), REDACTED],
  [new RegExp('\\b' + 's' + 'b_' + 's' + 'ecret_' + '[A-Za-z0-9_-]{8,}', 'g'), REDACTED],
  [new RegExp('\\b' + 'B' + 'ea' + 'rer\\s+[A-Za-z0-9._-]{8,}', 'gi'), REDACTED],
  [/(^|[\s(.,;:!?])@[A-Za-z0-9_]{1,15}\b/g, '$1' + REDACTED],
  [/\b[\d][\d\s-]{8,}[\d]\b/g, REDACTED],
];
function redactBody(body) {
  if (typeof body !== 'string' || body.length === 0) return '';
  let out = body;
  for (const [pattern, replacement] of REDACTION_PATTERNS) out = out.replace(pattern, replacement);
  return out;
}

// ── Merge per-batch packets — ported from useSemanticReferee.ts ──
function mergePacketBinaries(packets) {
  if (packets.length === 0) return null;
  const base = packets[0];
  const seen = new Set();
  const merged = [];
  for (const packet of packets) {
    for (const binary of packet.binaries) {
      if (!seen.has(binary.classifierId)) { seen.add(binary.classifierId); merged.push(binary); }
    }
  }
  return Object.assign({}, base, { binaries: merged });
}

function buildContentHash(moveId, redactedBody) { return `c:${moveId}:${redactedBody.length}`; }

function mapParticipantSideToActorRole(side) {
  switch (side) {
    case 'affirmative': return 'initiator';
    case 'negative': return 'primary_opponent';
    case 'moderator': return 'moderator';
    default: return 'observer';
  }
}

async function invokeClassifyMove(client, payload) {
  const t0 = Date.now();
  const { data, error } = await client.functions.invoke('semantic-referee', { body: payload });
  return { data, error, latencyMs: Date.now() - t0 };
}

async function flipProviderViaAdminEf(adminClient, providerMode, confirmAnthropic) {
  const t0 = Date.now();
  const body = { action: 'set_semantic_config', providerMode, enabled: true, reason: 'MCP smoke test' };
  if (confirmAnthropic) body.confirmAnthropic = true;
  const { data, error } = await adminClient.functions.invoke('admin-users', { body });
  return { data, error, latencyMs: Date.now() - t0 };
}

async function readRuntimeConfig(adminClient) {
  const { data, error } = await adminClient.functions.invoke('admin-users', { body: { action: 'get_semantic_config' } });
  return { data, error };
}

function buildClassifyPayload({ roomId, argumentId, parentArgumentId, bodyRedacted, parentBodyRedacted, participantSide, classifierBatch, contentHash, promptVersion }) {
  return {
    roomId,
    moveId: argumentId,
    parentId: parentArgumentId || undefined,
    moveBodyRedacted: bodyRedacted,
    parentBodyRedacted: parentBodyRedacted || undefined,
    roomContext: {
      side: participantSide || undefined,
      actorRole: mapParticipantSideToActorRole(participantSide),
    },
    requestedClassifiers: classifierBatch,
    promptVersionHint: promptVersion,
    contentHash,
  };
}

async function classifyPostedMove({ client, roomId, argumentId, parentArgumentId, body, parentBody, participantSide }) {
  const bodyRedacted = redactBody(body);
  const parentBodyRedacted = parentBody ? redactBody(parentBody) : undefined;
  const contentHash = buildContentHash(argumentId, bodyRedacted);
  const promptVersion = 'mcp-semantic-referee-prompt-v0';
  const batches = planClassifierBatches(POST_SUBMIT_CLASSIFIER_SET);

  const batchResults = [];
  const packets = [];
  for (const batch of batches) {
    const payload = buildClassifyPayload({
      roomId, argumentId, parentArgumentId, bodyRedacted, parentBodyRedacted, participantSide,
      classifierBatch: batch, contentHash, promptVersion,
    });
    const { data, error, latencyMs } = await invokeClassifyMove(client, payload);
    const r = {
      requestedClassifiers: batch, latencyMs, ok: !error,
      enabled: null, provider: null, modelVersion: null, packet: null, error: null,
    };
    if (error) {
      r.error = String(error.message || 'unknown').slice(0, 200);
    } else if (data && data.enabled === false) {
      r.enabled = false;
      r.disabledReason = data.reason || null;
    } else if (data && data.enabled === true && data.packet) {
      r.enabled = true;
      r.provider = data.packet.provider;
      r.modelVersion = data.packet.modelVersion;
      r.packet = data.packet;
      packets.push(data.packet);
    }
    batchResults.push(r);
  }

  return {
    argumentId,
    bodyRedactedLen: bodyRedacted.length,
    parentBodyRedactedLen: parentBodyRedacted ? parentBodyRedacted.length : 0,
    batches: batchResults,
    mergedPacket: mergePacketBinaries(packets),
    totalLatencyMs: batchResults.reduce((s, b) => s + b.latencyMs, 0),
  };
}

async function probeProvider(client, roomId) {
  const probeBody = 'probe';
  const probeMoveId = 'probe-' + randomUUID().slice(0, 8);
  const payload = buildClassifyPayload({
    roomId, argumentId: probeMoveId, parentArgumentId: null,
    bodyRedacted: probeBody, parentBodyRedacted: undefined, participantSide: 'affirmative',
    classifierBatch: ['responds_to_parent'], contentHash: `c:${probeMoveId}:${probeBody.length}`,
    promptVersion: 'mcp-semantic-referee-prompt-v0',
  });
  const t0 = Date.now();
  const { data, error, latencyMs } = await invokeClassifyMove(client, payload);
  return {
    sentAtMs: t0, returnedAtMs: Date.now(), latencyMs,
    ok: !error,
    enabled: data ? data.enabled : null,
    provider: data && data.enabled === true && data.packet ? data.packet.provider : null,
    disabledReason: data && data.enabled === false ? data.reason : null,
    error: error ? String(error.message || 'unknown').slice(0, 200) : null,
  };
}

async function runPass({ pass, scenario, botA, botB, constitutionId }) {
  const passLog = { pass, startMs: Date.now(), roomId: null, roomTitle: null, moves: [], errors: [], endMs: null };
  const roomTitle = `${scenario.title} [${pass}-pass ${new Date().toISOString().slice(0, 19)}]`;
  passLog.roomTitle = roomTitle;

  const debateInsert = await botA.client.from('debates').insert({
    created_by: botA.userId, title: roomTitle, resolution: scenario.resolution,
    description: '', status: 'open', constitution_id: constitutionId,
  }).select('id').single();
  if (debateInsert.error || !debateInsert.data) {
    passLog.errors.push({ step: 'create_room', detail: (debateInsert.error && debateInsert.error.message) || 'unknown' });
    passLog.endMs = Date.now();
    return passLog;
  }
  const debateId = debateInsert.data.id;
  passLog.roomId = debateId;

  await botA.client.from('debate_participants').insert({ debate_id: debateId, user_id: botA.userId, side: 'moderator' });
  const joinB = await botB.client.from('debate_participants').insert({ debate_id: debateId, user_id: botB.userId, side: 'negative' });
  if (joinB.error && joinB.error.code !== '23505') {
    passLog.errors.push({ step: 'join_bot_b', detail: joinB.error.message });
  }

  const argIdByMoveId = {};
  const bodyByMoveId = {};
  let halt = false;
  for (const move of scenario.moves) {
    if (halt) break;
    const bot = move.authorAlias === 'Provocateur' ? botA : botB;
    const postSide = move.authorAlias === 'Provocateur' ? 'affirmative' : 'negative';
    const participantSide = move.authorAlias === 'Provocateur' ? 'moderator' : 'negative';
    const parentArgumentId = move.parentMoveId ? argIdByMoveId[move.parentMoveId] : null;
    const parentBody = move.parentMoveId ? bodyByMoveId[move.parentMoveId] : null;

    const submitBody = buildSubmitArgumentBody({
      debateId, parentArgumentId,
      move: {
        moveId: move.moveId, argumentType: move.argumentType,
        authorAlias: move.authorAlias, parentMoveId: move.parentMoveId,
        disagreementAxis: move.disagreementAxis, targetExcerpt: move.targetExcerpt,
        body: move.body, selectedTagCodes: move.selectedTagCodes, evidence: move.evidence,
      },
      side: postSide, clientSubmissionId: randomUUID(),
    });
    const postT0 = Date.now();
    const submitResult = await invokeSubmitArgument(bot.client, submitBody);
    const postT1 = Date.now();
    const moveLog = {
      moveId: move.moveId, authorAlias: move.authorAlias, postSide, participantSide,
      postLatencyMs: postT1 - postT0, postOk: submitResult.ok,
      postError: submitResult.ok ? null : (submitResult.detail || (submitResult.error && submitResult.error.error) || 'unknown'),
      argumentId: null, classifyResult: null, postToClassifyLatencyMs: null,
      expected: {
        signal: move.expectedClassifierSignal || [],
        confidence: move.expectedConfidence || null,
        overrideTrigger: move.expectedOverrideTrigger || null,
      },
    };
    if (!submitResult.ok) {
      passLog.errors.push({ step: 'submit_argument', moveId: move.moveId, detail: String(moveLog.postError).slice(0, 200) });
      passLog.moves.push(moveLog);
      console.error(`[smoke-test] ${pass}/${move.moveId} post FAILED: ${moveLog.postError}`);
      halt = true;
      continue;
    }
    const argId = submitResult.data && submitResult.data.argument && submitResult.data.argument.id;
    if (argId) { argIdByMoveId[move.moveId] = argId; bodyByMoveId[move.moveId] = move.body; }
    moveLog.argumentId = argId;
    console.log(`[smoke-test] ${pass}/${move.moveId} posted ${argId} in ${moveLog.postLatencyMs}ms — classifying...`);

    const classify = await classifyPostedMove({
      client: bot.client, roomId: debateId, argumentId: argId, parentArgumentId,
      body: move.body, parentBody, participantSide,
    });
    moveLog.classifyResult = classify;
    moveLog.postToClassifyLatencyMs = Date.now() - postT1;
    passLog.moves.push(moveLog);

    for (const b of classify.batches) {
      if (b.enabled === false) {
        passLog.errors.push({ step: 'classify_enabled_false', moveId: move.moveId, batch: b.requestedClassifiers, reason: b.disabledReason });
        console.error(`[smoke-test] ${pass}/${move.moveId} classify enabled=false (reason=${b.disabledReason}); HALTING`);
        halt = true;
        break;
      }
    }
    if (halt) break;
    const merged = classify.mergedPacket;
    console.log(`[smoke-test] ${pass}/${move.moveId} classify provider=${merged && merged.provider} binaries=${merged && merged.binaries.length} latency=${classify.totalLatencyMs}ms`);
  }

  passLog.endMs = Date.now();
  return passLog;
}

async function main() {
  const env = loadEnvFiles();
  let cfg;
  try { cfg = buildBotConfig(env); } catch (err) { console.error(`[fatal] env: ${err.message}`); process.exit(2); }
  const scenario = loadScenario(SCENARIO_ID);
  console.log(`[smoke-test] scenario=${SCENARIO_ID} moves=${scenario.moves.length}`);

  const adminClient = createBotClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
  const adminSession = await signInBot(adminClient, cfg.adminEmail, cfg.adminPassword);
  if (!adminSession) { console.error('[fatal] admin sign-in failed'); process.exit(3); }
  console.log('[smoke-test] admin signed in');

  const bots = [null, null];
  for (let i = 0; i < 2; i++) {
    const b = cfg.bots[i];
    const c = createBotClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
    const s = await signInBot(c, b.email, b.password);
    if (!s) { console.error(`[fatal] ${b.alias} sign-in failed`); process.exit(4); }
    bots[i] = { userId: s.userId, client: c, alias: b.alias };
  }
  const botA = bots[0], botB = bots[1];
  console.log(`[smoke-test] 2 bots signed in (${botA.alias}, ${botB.alias})`);

  const constRes = await botA.client.from('constitution_versions').select('id').eq('active', true).single();
  if (constRes.error || !constRes.data) { console.error('[fatal] no active constitution'); process.exit(5); }
  const constitutionId = constRes.data.id;

  const runId = randomUUID().slice(0, 8);
  const runLog = {
    runId, startMs: Date.now(), scenarioId: SCENARIO_ID, constitutionId,
    initialConfig: null, anthropicPass: null, flipAnthropicToMock: null,
    mockPass: null, flipMockToAnthropic: null, finalConfig: null, endMs: null,
  };

  const initialConfig = await readRuntimeConfig(adminClient);
  if (initialConfig.error) {
    console.error('[fatal] get_semantic_config failed:', String(initialConfig.error.message || 'unknown').slice(0, 200));
    process.exit(6);
  }
  runLog.initialConfig = initialConfig.data;
  console.log(`[smoke-test] initial config: provider=${runLog.initialConfig.providerMode} enabled=${runLog.initialConfig.enabled}`);

  if (runLog.initialConfig.providerMode !== 'anthropic') {
    console.error(`[fatal] initial provider is ${runLog.initialConfig.providerMode}, expected anthropic`);
    process.exit(7);
  }

  // ── Pass 1: anthropic ──
  console.log('[smoke-test] === ANTHROPIC PASS ===');
  runLog.anthropicPass = await runPass({ pass: 'anthropic', scenario, botA, botB, constitutionId });
  console.log(`[smoke-test] anthropic pass: room=${runLog.anthropicPass.roomId} moves=${runLog.anthropicPass.moves.length} errors=${runLog.anthropicPass.errors.length}`);

  let runMockPass = runLog.anthropicPass.errors.length === 0;

  if (runMockPass) {
    // ── Flip anthropic → mock ──
    console.log('[smoke-test] === FLIP anthropic → mock ===');
    const t1 = Date.now();
    const flip = await flipProviderViaAdminEf(adminClient, 'mock', false);
    const t2 = Date.now();
    const probe = await probeProvider(botA.client, runLog.anthropicPass.roomId);
    const t3 = Date.now();
    runLog.flipAnthropicToMock = {
      t1_beforeMs: t1, t2_flipCompleteMs: t2, t3_probeReturnedMs: t3,
      flipDurationMs: flip.latencyMs, flipOk: !flip.error,
      flipResponse: flip.data || null,
      flipError: flip.error ? String(flip.error.message || 'unknown').slice(0, 200) : null,
      probe, propagationMs: t3 - t2,
    };
    console.log(`[smoke-test] flip A→M: probe.provider=${probe.provider} flip=${flip.latencyMs}ms propagation=${runLog.flipAnthropicToMock.propagationMs}ms`);

    if (probe.provider !== 'mock') {
      console.error(`[fatal] flip to mock did not take effect; probe.provider=${probe.provider}`);
      runMockPass = false;
    }
  }

  if (runMockPass) {
    // ── Pass 2: mock ──
    console.log('[smoke-test] === MOCK PASS ===');
    runLog.mockPass = await runPass({ pass: 'mock', scenario, botA, botB, constitutionId });
    console.log(`[smoke-test] mock pass: room=${runLog.mockPass.roomId} moves=${runLog.mockPass.moves.length} errors=${runLog.mockPass.errors.length}`);
  }

  // ── Flip back to anthropic (always attempt, to restore state) ──
  console.log('[smoke-test] === FLIP back to anthropic ===');
  const r1 = Date.now();
  const flipBack = await flipProviderViaAdminEf(adminClient, 'anthropic', true);
  const r2 = Date.now();
  const probeBackRoomId = (runLog.mockPass && runLog.mockPass.roomId) || (runLog.anthropicPass && runLog.anthropicPass.roomId);
  const probeBack = probeBackRoomId
    ? await probeProvider(botA.client, probeBackRoomId)
    : { sentAtMs: r2, returnedAtMs: r2, latencyMs: 0, ok: false, enabled: null, provider: null, error: 'no_room_available_for_probe' };
  const r3 = Date.now();
  runLog.flipMockToAnthropic = {
    t1_beforeMs: r1, t2_flipCompleteMs: r2, t3_probeReturnedMs: r3,
    flipDurationMs: flipBack.latencyMs, flipOk: !flipBack.error,
    flipResponse: flipBack.data || null,
    flipError: flipBack.error ? String(flipBack.error.message || 'unknown').slice(0, 200) : null,
    probe: probeBack, propagationMs: r3 - r2,
  };
  console.log(`[smoke-test] flip M→A: probe.provider=${probeBack.provider} flip=${flipBack.latencyMs}ms propagation=${runLog.flipMockToAnthropic.propagationMs}ms`);

  const finalConfig = await readRuntimeConfig(adminClient);
  runLog.finalConfig = finalConfig.data || { error: (finalConfig.error && finalConfig.error.message) || 'unknown' };
  runLog.endMs = Date.now();

  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
  const logPath = path.join(LOG_DIR, `${runId}.json`);
  fs.writeFileSync(logPath, JSON.stringify(runLog, null, 2));
  console.log(`[smoke-test] DONE runId=${runId} log=${logPath} elapsed=${runLog.endMs - runLog.startMs}ms`);
}

main().catch((err) => {
  console.error('[fatal]', err && err.stack ? err.stack.slice(0, 2000) : String(err));
  process.exit(99);
});
