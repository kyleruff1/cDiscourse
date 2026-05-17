#!/usr/bin/env node
/**
 * Stage 6.1.5 — AI-driven bot corpus orchestrator.
 *
 * Same shape as `runStressBatch.js` but the bot move bodies are generated
 * by Anthropic (Claude API) instead of the deterministic templates. The
 * fixture skeleton, persona mapping, transition rules, and submit-argument
 * flow are unchanged.
 *
 * Operator gates (live mode requires ALL):
 *   - `.env.engagement-intelligence` present
 *   - `ENGAGEMENT_INTEL_ENABLE_ANTHROPIC=true` in that file
 *   - `ANTHROPIC_API_KEY` populated
 *   - `.env.bot-tests` filled (for Supabase admin + bot auth)
 *   - `--pilot` on the CLI
 *
 * xAI seed source (separate from Anthropic):
 *   - `--seeds synthetic` (default) | `--seeds xai_live` | `--seeds both`
 *   - `xai_live` requires its own env flag + key + --pilot
 *
 * Default mode is DRY: no network calls, no Supabase writes. The dry path
 * prints the planned room/move structure and validates wiring.
 */
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const STRESS_CONFIG = require('./stressConfig');
const { loadEnvFiles, buildBotConfig } = require('./loadEnv');
const { createBotClient, signInBot } = require('./supabaseClient');
const { ensureBotUser } = require('./adminOps');
const { buildSubmitArgumentBody, invokeSubmitArgument } = require('./submitMove');
const { mapPersonaSideToParticipantSide } = require('./personaMapping');
const { TEMPLATES, seededRng, pickTargetExcerpt } = require('./stressScenarioTemplates');
const { renderMoveBody, personaForAuthor } = require('./aiMoveRenderer');
const claudeClient = require('./claudeMessagesClient');
const { loadSeeds } = require('../engagement-intelligence/xaiSeededStances');
const {
  buildEngagementCorpusMarkdown,
} = require('./engagementCorpus');
const { annotateMove, fallbackAnnotation } = require('./anthropicArgumentAnnotator');
const { buildAnnotatedIntelligenceMarkdown } = require('./aiArgumentIntelligenceReport');
const { computeAgreementDisagreementVector } = require('../engagement-intelligence/agreementScalarJs');

const REPO_ROOT = process.cwd();
const REPORT_DIR = path.join(REPO_ROOT, 'docs', 'testing-runs');
const LOG_DIR = path.join(REPO_ROOT, 'logs', 'bot-stress');

function parseArgs(argv) {
  const args = {
    dry: true,
    pilot: false,
    rooms: 3,
    seeds: 'synthetic', // synthetic | xai_live | both
    template: null,     // null → cycle templates
    seed: STRESS_CONFIG.DEFAULT_SEED,
    writeMarkdown: true,
    writeJsonl: false,
    annotate: false,
    annotationOnly: false,
    annotationJsonl: null,
    deep: false,
    reportName: null,
    maxMovesPerRoom: 15,
    minMovesPerRoom: 10,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry') args.dry = true;
    else if (a === '--pilot') { args.pilot = true; args.dry = false; }
    else if (a === '--rooms' && argv[i + 1]) args.rooms = Math.max(1, Math.min(50, Number(argv[++i]) || 3));
    else if (a === '--seeds' && argv[i + 1]) args.seeds = String(argv[++i]);
    else if (a === '--template' && argv[i + 1]) args.template = String(argv[++i]);
    else if (a === '--seed' && argv[i + 1]) args.seed = String(argv[++i]);
    else if (a === '--write-jsonl') args.writeJsonl = true;
    else if (a === '--annotate') args.annotate = true;
    else if (a === '--annotation-only') { args.annotationOnly = true; args.annotate = true; }
    else if (a === '--annotation-jsonl' && argv[i + 1]) args.annotationJsonl = String(argv[++i]);
    else if (a === '--deep') args.deep = true;
    else if (a === '--report-name' && argv[i + 1]) args.reportName = String(argv[++i]);
    else if (a === '--max-moves-per-room' && argv[i + 1]) args.maxMovesPerRoom = Math.max(3, Math.min(30, Number(argv[++i]) || 15));
    else if (a === '--min-moves-per-room' && argv[i + 1]) args.minMovesPerRoom = Math.max(2, Math.min(30, Number(argv[++i]) || 10));
  }
  return args;
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function pickTemplate(masterRng, override) {
  if (override) return TEMPLATES.find((t) => t.id === override) || TEMPLATES[0];
  return TEMPLATES[Math.floor(masterRng() * TEMPLATES.length)];
}

function summarizeConversation(history) {
  if (history.length === 0) return '';
  return history.map((h, i) => `  m${i + 1} (${h.persona}/${h.argumentType}): ${h.body.slice(0, 140)}`).join('\n');
}

function buildSceneFromSeed(seed, template) {
  const personas = [
    { alias: 'Alex', side: 'affirmative', tone: 'calm' },
    { alias: 'Jordan', side: 'negative', tone: 'skeptical' },
    { alias: 'Sam', side: 'neutral', tone: 'conciliatory' },
  ];
  const scenarioId = `ai-${seed.topicId}-${template.id.split('-').pop()}-${Math.floor(Math.random() * 1e6)}`;
  return {
    scenarioId,
    title: seed.title,
    resolution: seed.resolution,
    category: 'ai_seeded',
    personas,
    moves: [],
    notes: `AI-driven; seed=${seed.topicId}; template=${template.id}`,
    stressMeta: { templateId: template.id, topicId: seed.topicId, seed: 'ai-driven', scenarioIndex: 0 },
  };
}

async function renderScenarioMoves({ template, seed, scenarioCategory, client, rng, dry }) {
  const moves = [];
  const bodyByMoveId = {};
  const history = [];

  for (const slot of template.slots) {
    const parent = slot.parent ? { body: bodyByMoveId[slot.parent] || '', argumentType: moves.find((m) => m.moveId === slot.parent)?.argumentType } : null;
    const persona = personaForAuthor(slot.author);
    const evidenceFact = (seed.evidenceFacts || [])[(moves.length) % Math.max(1, (seed.evidenceFacts || []).length)] || null;

    let renderResult;
    if (dry || !client) {
      renderResult = {
        source: 'dry_placeholder',
        body: `[DRY] ${persona}/${slot.argumentType} on "${seed.title}" — slot ${slot.moveId}.`,
        attempts: 0,
        validationFailureReason: null,
      };
    } else {
      renderResult = await renderMoveBody({
        client,
        persona,
        topic: seed,
        scenarioCategory,
        parentBody: parent ? parent.body : null,
        slot,
        conversationSummary: summarizeConversation(history),
        rng,
        evidenceFact,
        maxRetries: 1,
        fallbackDeterministic: true,
      });
    }

    const move = {
      moveId: slot.moveId,
      authorAlias: ['Alex', 'Jordan', 'Sam'][slot.author],
      parentMoveId: slot.parent,
      moveKind: slot.moveKind,
      argumentType: slot.argumentType,
      disagreementAxis: slot.axis || null,
      qualifierCode: null,
      targetExcerpt: slot.target && parent && parent.body
        ? pickTargetExcerpt(parent.body, seed)
        : null,
      body: renderResult.body,
      selectedTagCodes: [],
      evidence: slot.argumentType === 'evidence' ? evidenceFact : null,
      expectedStatus: 'posted',
      expectedRestingStatus: null,
      expectedClaimStanding: null,
      displayMeta: {
        playfulLabel: slot.playfulLabel || undefined,
        branchCandidate: slot.branchCandidate ? true : undefined,
      },
      _aiRender: {
        source: renderResult.source,
        attempts: renderResult.attempts,
        validationFailureReason: renderResult.validationFailureReason,
      },
    };
    bodyByMoveId[slot.moveId] = renderResult.body;
    history.push({ persona, argumentType: slot.argumentType, body: renderResult.body });
    moves.push(move);
  }

  return moves;
}

function buildThreadEntriesUpTo({ scenario, moveById, bodyByMoveId, currentMoveId }) {
  const thread = [];
  for (const m of scenario.moves) {
    if (m.moveId === currentMoveId) break;
    thread.push({
      moveId: m.moveId,
      argumentType: m.argumentType,
      side: m.authorAlias,
      parentMoveId: m.parentMoveId || null,
      body: bodyByMoveId[m.moveId] || m.body || '',
    });
  }
  return thread;
}

async function annotateRoomMoves({ scenario, roomId, client, results }) {
  const annotated = [];
  const moveById = new Map(scenario.moves.map((m) => [m.moveId, m]));
  const bodyByMoveId = {};
  for (const m of scenario.moves) bodyByMoveId[m.moveId] = m.body || '';
  const resultByMoveId = new Map((results || []).map((r) => [r.moveId, r]));

  for (const move of scenario.moves) {
    const parent = move.parentMoveId ? moveById.get(move.parentMoveId) : null;
    const parentBody = parent ? (bodyByMoveId[parent.moveId] || parent.body || '') : '';
    const body = bodyByMoveId[move.moveId] || move.body || '';
    const deterministicVector = computeAgreementDisagreementVector(parentBody, body);
    const thread = buildThreadEntriesUpTo({ scenario, moveById, bodyByMoveId, currentMoveId: move.moveId });
    const enrichedScenario = { ...scenario, roomId, rootClaim: scenario.resolution };
    let annotation;
    try {
      annotation = await annotateMove({
        client,
        scenario: enrichedScenario,
        move: { ...move, side: move.authorAlias },
        parent: parent ? { moveId: parent.moveId, argumentType: parent.argumentType, body: parentBody } : null,
        thread,
        body,
        deterministicVector,
      });
    } catch (err) {
      annotation = fallbackAnnotation({
        scenario: enrichedScenario,
        move: { ...move, side: move.authorAlias },
        parent: parent ? { moveId: parent.moveId, argumentType: parent.argumentType, body: parentBody } : null,
        thread,
        body,
        deterministicVector,
        reason: 'annotation_call_threw',
      });
    }
    const result = resultByMoveId.get(move.moveId);
    annotated.push({
      move,
      parentMove: parent ? { moveId: parent.moveId, argumentType: parent.argumentType, body: parentBody } : null,
      annotation,
      submitStatus: result?.actualStatus || 'planned',
      submitErrorCode: result?.errorCode || null,
    });
  }
  return annotated;
}

async function runLiveBatch({ args, scenarios, runId, client, jsonlStream, annotationJsonlStream }) {
  // Mirror runStressBatch's submit flow.
  const env = loadEnvFiles();
  const cfg = buildBotConfig(env);
  const adminClient = createBotClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
  const adminSession = await signInBot(adminClient, cfg.adminEmail, cfg.adminPassword);
  if (!adminSession) { console.error('[ai-corpus] fatal: admin sign-in failed'); process.exit(3); }
  console.log('[ai-corpus] admin signed in');

  const botByAlias = {};
  const aliasByEmail = { [cfg.adminEmail]: 'admin-1' };
  for (const bot of cfg.bots) {
    const { userId, email } = await ensureBotUser(adminClient, {
      label: bot.label, email: bot.email, password: bot.password,
      persona: bot.persona, displayName: bot.label,
    });
    botByAlias[bot.alias] = { userId, email, client: null };
    aliasByEmail[bot.email] = bot.alias;
  }
  for (const bot of cfg.bots) {
    const c = createBotClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
    const s = await signInBot(c, bot.email, bot.password);
    if (!s) { console.error(`[ai-corpus] fatal: bot ${bot.alias} sign-in failed`); process.exit(4); }
    botByAlias[bot.alias].client = c;
  }
  console.log(`[ai-corpus] ${Object.keys(botByAlias).length} bots signed in`);

  const runRecords = [];
  const botAliases = Object.keys(botByAlias);
  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    process.stdout.write(`[ai-corpus] (${i + 1}/${scenarios.length}) ${s.scenarioId} ... `);
    const personas = s.personas || [];
    const authorToBotAlias = {};
    for (let p = 0; p < personas.length && p < botAliases.length; p++) authorToBotAlias[personas[p].alias] = botAliases[p];

    const constitutionRes = await adminClient.from('constitution_versions').select('id').eq('active', true).single();
    if (constitutionRes.error || !constitutionRes.data) {
      console.log('fatal=no_active_constitution');
      runRecords.push({ scenario: s, roomId: null, results: [], fatal: 'no_active_constitution' });
      continue;
    }

    const botA = botByAlias[botAliases[0]];
    const roomTitle = `${s.title} [ai-corpus ${runId.slice(0, 8)} #${s.scenarioId}]`;
    const debateInsert = await botA.client.from('debates').insert({
      created_by: botA.userId,
      title: roomTitle,
      resolution: s.resolution,
      description: '',
      status: 'open',
      constitution_id: constitutionRes.data.id,
    }).select('id').single();
    if (debateInsert.error || !debateInsert.data) {
      console.log(`fatal=create_room_failed`);
      runRecords.push({ scenario: s, roomId: null, results: [], fatal: 'create_room_failed' });
      continue;
    }
    const debateId = debateInsert.data.id;

    await botA.client.from('debate_participants').insert({ debate_id: debateId, user_id: botA.userId, side: 'moderator' });
    for (let p = 1; p < botAliases.length && p < personas.length; p++) {
      const bot = botByAlias[botAliases[p]];
      const side = mapPersonaSideToParticipantSide(personas[p].side);
      const { error } = await bot.client.from('debate_participants').insert({ debate_id: debateId, user_id: bot.userId, side });
      if (error && error.code !== '23505') console.warn(`[ai-corpus] join failed: ${error.message}`);
    }

    const argIdByMoveId = {};
    const results = [];
    for (const move of s.moves) {
      const persona = personas.find((pp) => pp.alias === move.authorAlias);
      const side = (persona && persona.side) || 'neutral';
      const bot = botByAlias[authorToBotAlias[move.authorAlias]];
      if (move.parentMoveId && !argIdByMoveId[move.parentMoveId]) {
        results.push({ moveId: move.moveId, actualStatus: 'skipped_missing_parent' });
        continue;
      }
      const parentArgumentId = move.parentMoveId ? argIdByMoveId[move.parentMoveId] : null;
      const body = buildSubmitArgumentBody({
        debateId, parentArgumentId,
        move: {
          moveId: move.moveId, argumentType: move.argumentType,
          authorAlias: move.authorAlias, parentMoveId: move.parentMoveId,
          disagreementAxis: move.disagreementAxis, targetExcerpt: move.targetExcerpt,
          body: move.body, selectedTagCodes: move.selectedTagCodes || [],
          evidence: move.evidence,
        },
        side, clientSubmissionId: randomUUID(),
      });
      const r = await invokeSubmitArgument(bot.client, body);
      if (r.ok) {
        const argId = r.data && r.data.argument && r.data.argument.id;
        if (argId) argIdByMoveId[move.moveId] = argId;
        results.push({ moveId: move.moveId, actualStatus: 'posted', argumentId: argId });
      } else {
        results.push({ moveId: move.moveId, actualStatus: `failed_${r.status}`, errorCode: (r.error && r.error.error) || 'unknown', errorDetail: r.detail || null });
      }
      if (jsonlStream) jsonlStream.write(JSON.stringify({ ts: new Date().toISOString(), runId, scenarioId: s.scenarioId, roomId: debateId, moveId: move.moveId, status: results[results.length - 1].actualStatus, aiSource: move._aiRender && move._aiRender.source }) + '\n');
    }
    const posted = results.filter((r) => r.actualStatus === 'posted').length;
    console.log(`room=${debateId} posted=${posted}/${results.length}`);

    let annotatedMoves = null;
    if (args.annotate) {
      process.stdout.write(`[ai-corpus]   annotating ${results.length} move(s) ... `);
      annotatedMoves = await annotateRoomMoves({ scenario: s, roomId: debateId, client, results });
      const sources = annotatedMoves.reduce((acc, am) => {
        const k = am.annotation?.annotationSource || 'deterministic_fallback';
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});
      console.log(Object.entries(sources).map(([k, v]) => `${k}=${v}`).join(' '));
      if (annotationJsonlStream) {
        for (const am of annotatedMoves) {
          annotationJsonlStream.write(JSON.stringify({
            ts: new Date().toISOString(),
            runId,
            scenarioId: s.scenarioId,
            roomId: debateId,
            moveId: am.move.moveId,
            argumentType: am.move.argumentType,
            authorAlias: am.move.authorAlias,
            submitStatus: am.submitStatus,
            annotation: am.annotation,
          }) + '\n');
        }
      }
    }
    runRecords.push({ scenario: s, roomId: debateId, results, annotatedMoves });
  }
  return runRecords;
}

async function main() {
  const args = parseArgs(process.argv);
  console.log(`[ai-corpus] mode=${args.dry ? 'dry' : 'live'} rooms=${args.rooms} seeds=${args.seeds}`);

  const seeds = await loadSeeds({ mode: args.seeds, count: args.rooms, pilot: args.pilot }).catch((err) => {
    console.error(`[ai-corpus] seed load failed: ${err.message}`);
    process.exit(2);
  });
  console.log(`[ai-corpus] loaded ${seeds.length} topic seed(s)`);

  const masterRng = seededRng(args.seed);
  const scenarios = [];
  for (let i = 0; i < args.rooms; i++) {
    const seed = seeds[i % seeds.length];
    const template = pickTemplate(masterRng, args.template);
    const scenario = buildSceneFromSeed(seed, template);
    scenarios.push({ scenario, seed, template });
  }

  let client = null;
  if (!args.dry) {
    try {
      client = claudeClient.createClient({ requirePilotFlag: true, pilot: args.pilot });
      console.log(`[ai-corpus] anthropic client ready (model=${client.snapshotUsage().model})`);
    } catch (err) {
      console.error(`[ai-corpus] anthropic client refused: ${err.message}`);
      process.exit(2);
    }
  }

  // Render all scenarios first (this is where the Anthropic spend happens).
  const renderedScenarios = [];
  for (const { scenario, seed, template } of scenarios) {
    const moves = await renderScenarioMoves({
      template, seed, scenarioCategory: 'ai_seeded',
      client, rng: seededRng(`${args.seed}::${scenario.scenarioId}`), dry: args.dry,
    });
    renderedScenarios.push({ ...scenario, moves });
  }

  const usage = client ? client.snapshotUsage() : null;
  if (usage) {
    console.log(`[ai-corpus] anthropic usage: calls=${usage.calls} inputTokens=${usage.inputTokens} outputTokens=${usage.outputTokens}`);
  }

  // Dry mode stops here — write a planned-only corpus md and exit.
  ensureDir(REPORT_DIR); ensureDir(LOG_DIR);
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const date = new Date().toISOString().slice(0, 10);
  const suffix = args.dry ? '-dry' : '';
  const baseName = args.reportName || 'ai-driven-bot-corpus';
  const mdPath = path.join(REPORT_DIR, `${date}-${baseName}${suffix}.md`);
  const annotatedMdPath = path.join(REPORT_DIR, `${date}-${baseName}-annotated${suffix}.md`);

  if (args.dry) {
    const md = buildEngagementCorpusMarkdown({
      runId, dateIso: new Date().toISOString(), mode: 'dry',
      scenarios: renderedScenarios,
      roomResults: renderedScenarios.map(() => ({ roomId: null, results: [] })),
    });
    if (args.writeMarkdown !== false) fs.writeFileSync(mdPath, md);
    console.log(`[ai-corpus] dry corpus md: ${path.relative(REPO_ROOT, mdPath)}`);

    if (args.annotate) {
      // Annotate in dry mode using deterministic fallback only (no Anthropic).
      const rooms = [];
      for (const s of renderedScenarios) {
        const annotatedMoves = await annotateRoomMoves({
          scenario: s, roomId: null, client: null, results: [],
        });
        rooms.push({
          scenarioId: s.scenarioId, roomId: null, title: s.title,
          rootClaim: s.resolution, resolution: s.resolution, annotatedMoves,
        });
      }
      const annotatedMd = buildAnnotatedIntelligenceMarkdown({
        runId, dateIso: new Date().toISOString(), mode: 'dry', rooms,
      });
      fs.writeFileSync(annotatedMdPath, annotatedMd);
      console.log(`[ai-corpus] dry annotated md: ${path.relative(REPO_ROOT, annotatedMdPath)}`);
    }
    return 0;
  }

  // Live mode: post to Supabase + emit final corpus md.
  let jsonlStream = null;
  if (args.writeJsonl) {
    jsonlStream = fs.createWriteStream(path.join(LOG_DIR, `${runId}-ai-corpus.jsonl`));
  }
  let annotationJsonlStream = null;
  if (args.annotate) {
    const annPath = args.annotationJsonl || path.join(LOG_DIR, `${runId}-ai-corpus-annotations.jsonl`);
    ensureDir(path.dirname(annPath));
    annotationJsonlStream = fs.createWriteStream(annPath);
    console.log(`[ai-corpus] annotation jsonl: ${path.relative(REPO_ROOT, annPath)} (gitignored — do not commit)`);
  }
  const runRecords = await runLiveBatch({ args, scenarios: renderedScenarios, runId, client, jsonlStream, annotationJsonlStream });
  if (jsonlStream) jsonlStream.end();
  if (annotationJsonlStream) annotationJsonlStream.end();

  const md = buildEngagementCorpusMarkdown({
    runId, dateIso: new Date().toISOString(), mode: 'live',
    scenarios: runRecords.map((r) => r.scenario),
    roomResults: runRecords.map((r) => ({ roomId: r.roomId, results: r.results })),
  });
  fs.writeFileSync(mdPath, md);
  console.log(`[ai-corpus] live corpus md: ${path.relative(REPO_ROOT, mdPath)}`);

  if (args.annotate) {
    const rooms = runRecords.map((r) => ({
      scenarioId: r.scenario.scenarioId,
      roomId: r.roomId,
      title: r.scenario.title,
      rootClaim: r.scenario.resolution,
      resolution: r.scenario.resolution,
      annotatedMoves: r.annotatedMoves || [],
    }));
    const annotatedMd = buildAnnotatedIntelligenceMarkdown({
      runId, dateIso: new Date().toISOString(), mode: 'live', rooms,
    });
    fs.writeFileSync(annotatedMdPath, annotatedMd);
    console.log(`[ai-corpus] live annotated md: ${path.relative(REPO_ROOT, annotatedMdPath)}`);
  }

  if (usage) console.log(`[ai-corpus] final usage: ${JSON.stringify(usage)}`);
  return 0;
}

if (require.main === module) {
  main().then((c) => process.exit(c || 0)).catch((err) => { console.error('[ai-corpus][fatal]', String(err.message).slice(0, 400)); process.exit(99); });
}

module.exports = {
  parseArgs,
  buildSceneFromSeed,
  pickTemplate,
  summarizeConversation,
  renderScenarioMoves,
  annotateRoomMoves,
  buildThreadEntriesUpTo,
};
