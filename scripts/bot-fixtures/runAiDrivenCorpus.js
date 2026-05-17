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

async function runLiveBatch({ args, scenarios, runId, client, jsonlStream }) {
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
    runRecords.push({ scenario: s, roomId: debateId, results });
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
  const mdPath = path.join(REPORT_DIR, `${date}-ai-driven-bot-corpus${suffix}.md`);

  if (args.dry) {
    const md = buildEngagementCorpusMarkdown({
      runId, dateIso: new Date().toISOString(), mode: 'dry',
      scenarios: renderedScenarios,
      roomResults: renderedScenarios.map(() => ({ roomId: null, results: [] })),
    });
    if (args.writeMarkdown !== false) fs.writeFileSync(mdPath, md);
    console.log(`[ai-corpus] dry corpus md: ${path.relative(REPO_ROOT, mdPath)}`);
    return 0;
  }

  // Live mode: post to Supabase + emit final corpus md.
  let jsonlStream = null;
  if (args.writeJsonl) {
    jsonlStream = fs.createWriteStream(path.join(LOG_DIR, `${runId}-ai-corpus.jsonl`));
  }
  const runRecords = await runLiveBatch({ args, scenarios: renderedScenarios, runId, client, jsonlStream });
  if (jsonlStream) jsonlStream.end();

  const md = buildEngagementCorpusMarkdown({
    runId, dateIso: new Date().toISOString(), mode: 'live',
    scenarios: runRecords.map((r) => r.scenario),
    roomResults: runRecords.map((r) => ({ roomId: r.roomId, results: r.results })),
  });
  fs.writeFileSync(mdPath, md);
  console.log(`[ai-corpus] live corpus md: ${path.relative(REPO_ROOT, mdPath)}`);
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
};
