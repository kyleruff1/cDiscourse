#!/usr/bin/env node
/**
 * Stress batch runner — drives N generated scenarios end-to-end through normal
 * Supabase auth + `submit-argument`. No service-role key. No Anthropic. No
 * direct posted-argument insert.
 *
 * Modes:
 *   --dry         validate + plan only; no Supabase writes
 *   --count N     number of scenarios to run (default 10)
 *   --regenerate  regenerate fixtures before running
 *   --seed STR    seed for regeneration (passed to generator)
 *
 * Log outputs:
 *   logs/bot-stress/<runId>-stress.jsonl         (full event stream, local-only)
 *   docs/testing-runs/<date>-bot-stress-summary.md (safe summary, committable)
 *
 * Aliases in logs only — no emails, passwords, JWTs, or apikeys.
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
const { generate } = require('./generateStressScenarios');
const {
  buildEngagementCorpusMarkdown,
  buildEngagementCorpusJsonlEvents,
} = require('./engagementCorpus');

function parseArgs(argv) {
  const args = {
    dry: false,
    count: 10,
    regenerate: false,
    seed: STRESS_CONFIG.DEFAULT_SEED,
    corpus: false,
    corpusOnly: false,
    writeMarkdown: true,
    writeJsonl: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry') args.dry = true;
    else if (a === '--count' && argv[i + 1]) args.count = Number(argv[++i]);
    else if (a === '--regenerate') args.regenerate = true;
    else if (a === '--seed' && argv[i + 1]) args.seed = argv[++i];
    else if (a === '--corpus') args.corpus = true;
    else if (a === '--corpus-only') { args.corpus = true; args.corpusOnly = true; }
    else if (a === '--write-markdown') args.writeMarkdown = true;
    else if (a === '--no-write-markdown') args.writeMarkdown = false;
    else if (a === '--write-jsonl') args.writeJsonl = true;
  }
  if (!Number.isFinite(args.count) || args.count < 1) args.count = 10;
  return args;
}

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }

function loadGeneratedScenarios() {
  if (!fs.existsSync(STRESS_CONFIG.GENERATED_FIXTURE_DIR)) return [];
  return fs
    .readdirSync(STRESS_CONFIG.GENERATED_FIXTURE_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(STRESS_CONFIG.GENERATED_FIXTURE_DIR, f), 'utf8')));
}

function aliasForEmail(emailToAlias, email) {
  return emailToAlias[email] || '<bot>';
}

function writeEvent(stream, evt) {
  stream.write(JSON.stringify(evt) + '\n');
}

// ── Body-overlap pre-flight check ───────────────────────────────
// Cheap heuristic: every non-root move body should share at least one
// non-stop token (length>=4) with both the resolution AND the parent body.
// Catches generator bugs without re-implementing the engine.
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'have', 'about', 'from', 'into',
  'then', 'than', 'their', 'they', 'them', 'these', 'those', 'will', 'just',
]);
function tokens(text) {
  return new Set(
    String(text || '').toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/).filter((t) => t.length >= 4 && !STOP_WORDS.has(t)),
  );
}
function intersects(a, b) {
  for (const x of a) if (b.has(x)) return true;
  return false;
}

function planScenario(scenario) {
  const resTokens = tokens(scenario.resolution);
  const issues = [];
  const moveById = new Map(scenario.moves.map((m) => [m.moveId, m]));
  for (const m of scenario.moves) {
    const bodyTokens = tokens(m.body);
    if (!intersects(bodyTokens, resTokens)) issues.push(`${m.moveId} body lacks resolution overlap`);
    if (m.parentMoveId) {
      const parent = moveById.get(m.parentMoveId);
      if (parent && !intersects(bodyTokens, tokens(parent.body))) issues.push(`${m.moveId} body lacks parent overlap`);
    }
  }
  return issues;
}

// ── Live run helpers (only called when !args.dry) ───────────────

async function runOneScenario({ scenario, adminClient, botByAlias, runId, jsonl, emailToAlias }) {
  const personas = scenario.personas || [];
  const botAliases = Object.keys(botByAlias);
  const authorToBotAlias = {};
  for (let i = 0; i < personas.length && i < botAliases.length; i++) {
    authorToBotAlias[personas[i].alias] = botAliases[i];
  }

  // Constitution lookup for the room
  const constitutionRes = await adminClient
    .from('constitution_versions').select('id').eq('active', true).single();
  if (constitutionRes.error || !constitutionRes.data) {
    return { roomId: null, results: [], fatal: 'no_active_constitution' };
  }

  const botA = botByAlias[botAliases[0]];
  const roomTitle = `${scenario.title} [stress ${runId.slice(0, 8)} #${scenario.scenarioId}]`;
  const debateInsert = await botA.client.from('debates').insert({
    created_by: botA.userId,
    title: roomTitle,
    resolution: scenario.resolution,
    description: '',
    status: 'open',
    constitution_id: constitutionRes.data.id,
  }).select('id').single();
  if (debateInsert.error || !debateInsert.data) {
    return { roomId: null, results: [], fatal: `debate_create_failed:${debateInsert.error?.message || 'unknown'}` };
  }
  const debateId = debateInsert.data.id;

  // Join: creator as moderator, others by persona mapping.
  await botA.client.from('debate_participants').insert({ debate_id: debateId, user_id: botA.userId, side: 'moderator' });
  for (let i = 1; i < botAliases.length && i < personas.length; i++) {
    const bot = botByAlias[botAliases[i]];
    const side = mapPersonaSideToParticipantSide(personas[i].side);
    const { error } = await bot.client.from('debate_participants').insert({ debate_id: debateId, user_id: bot.userId, side });
    if (error && error.code !== '23505') {
      writeEvent(jsonl, {
        ts: new Date().toISOString(), runId, scenarioId: scenario.scenarioId, category: scenario.category,
        roomId: debateId, event: 'participant_join_failed', alias: botAliases[i], side, errorMessage: error.message,
      });
    }
  }

  // Submit moves
  const argIdByMoveId = {};
  const results = [];
  for (const move of scenario.moves) {
    const botAlias = authorToBotAlias[move.authorAlias];
    const bot = botByAlias[botAlias];
    if (!bot) {
      results.push({ moveId: move.moveId, actualStatus: 'skipped_no_bot' });
      writeEvent(jsonl, {
        ts: new Date().toISOString(), runId, scenarioId: scenario.scenarioId, category: scenario.category,
        roomId: debateId, moveId: move.moveId, authorAlias: botAlias || null, status: 'skipped_no_bot',
        expectedStatus: move.expectedStatus, actualStatus: 'skipped_no_bot',
      });
      continue;
    }

    if (move.parentMoveId && !argIdByMoveId[move.parentMoveId]) {
      results.push({ moveId: move.moveId, actualStatus: 'skipped_missing_parent' });
      writeEvent(jsonl, {
        ts: new Date().toISOString(), runId, scenarioId: scenario.scenarioId, category: scenario.category,
        roomId: debateId, moveId: move.moveId, authorAlias: aliasForEmail(emailToAlias, bot.email || ''),
        moveKind: move.moveKind, argumentType: move.argumentType, parentMoveId: move.parentMoveId,
        status: 'skipped_missing_parent', expectedStatus: move.expectedStatus, actualStatus: 'skipped_missing_parent',
      });
      continue;
    }

    const persona = personas.find((p) => p.alias === move.authorAlias);
    const side = (persona && persona.side) || 'neutral';
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

    const startedAt = Date.now();
    const result = await invokeSubmitArgument(bot.client, body);
    const durationMs = Date.now() - startedAt;

    if (result.ok) {
      const argId = (result.data && result.data.argument && result.data.argument.id) || null;
      if (argId) argIdByMoveId[move.moveId] = argId;
      results.push({ moveId: move.moveId, actualStatus: 'posted', argumentId: argId });
      writeEvent(jsonl, {
        ts: new Date().toISOString(), runId, scenarioId: scenario.scenarioId, category: scenario.category,
        roomId: debateId, moveId: move.moveId,
        authorAlias: botAlias, moveKind: move.moveKind, qualifierCode: move.qualifierCode,
        argumentType: move.argumentType, parentMoveId: move.parentMoveId, parentArgumentId,
        status: 'posted', httpStatus: 201, errorCode: null, errorDetail: null,
        argumentId: argId, bodyLength: (move.body || '').length, tagCount: (move.selectedTagCodes || []).length,
        hasTargetExcerpt: Boolean(move.targetExcerpt), hasEvidence: Boolean(move.evidence),
        expectedStatus: move.expectedStatus, actualStatus: 'posted', durationMs,
      });
    } else {
      const errCode = typeof result.error === 'object' && result.error ? result.error.error || 'unknown' : String(result.error);
      results.push({ moveId: move.moveId, actualStatus: `failed_${result.status}`, errorCode: errCode, errorDetail: result.detail });
      writeEvent(jsonl, {
        ts: new Date().toISOString(), runId, scenarioId: scenario.scenarioId, category: scenario.category,
        roomId: debateId, moveId: move.moveId,
        authorAlias: botAlias, moveKind: move.moveKind, qualifierCode: move.qualifierCode,
        argumentType: move.argumentType, parentMoveId: move.parentMoveId, parentArgumentId,
        status: `failed_${result.status}`, httpStatus: result.status, errorCode: errCode,
        errorDetail: result.detail || null,
        argumentId: null, bodyLength: (move.body || '').length, tagCount: (move.selectedTagCodes || []).length,
        hasTargetExcerpt: Boolean(move.targetExcerpt), hasEvidence: Boolean(move.evidence),
        expectedStatus: move.expectedStatus, actualStatus: `failed_${result.status}`, durationMs,
      });
    }
  }
  return { roomId: debateId, results, fatal: null };
}

function summarize(runRecords) {
  const totals = {
    rooms: runRecords.length,
    roomsCreated: runRecords.filter((r) => r.roomId).length,
    moves: 0, posted: 0, failed_422: 0, failed_403: 0, failed_500: 0,
    skipped_missing_parent: 0, skipped_no_bot: 0,
  };
  const errorReasons = new Map();
  const categoryFailures = new Map();
  for (const r of runRecords) {
    const cat = r.scenario.category;
    for (const move of r.results) {
      totals.moves++;
      const s = move.actualStatus;
      if (s === 'posted') totals.posted++;
      else if (s === 'failed_422') totals.failed_422++;
      else if (s === 'failed_403') totals.failed_403++;
      else if (s === 'failed_500') totals.failed_500++;
      else if (s === 'skipped_missing_parent') totals.skipped_missing_parent++;
      else if (s === 'skipped_no_bot') totals.skipped_no_bot++;

      if (s && s.startsWith('failed_') && move.errorDetail) {
        const ruleCode = String(move.errorDetail).split(':')[0].trim();
        errorReasons.set(ruleCode, (errorReasons.get(ruleCode) || 0) + 1);
      }
      if (s && s.startsWith('failed_')) {
        categoryFailures.set(cat, (categoryFailures.get(cat) || 0) + 1);
      }
    }
  }
  return { totals, errorReasons, categoryFailures };
}

function writeSummary({ runId, args, totals, errorReasons, categoryFailures, scenarios, runRecords }) {
  ensureDir(STRESS_CONFIG.SUMMARY_DIR);
  const date = new Date().toISOString().slice(0, 10);
  const summaryPath = path.join(STRESS_CONFIG.SUMMARY_DIR, `${date}-bot-stress-summary.md`);
  const lines = [
    `# Bot stress run — ${date}`, '',
    `_Run id_: \`${runId}\``,
    `_Mode_: ${args.dry ? 'dry' : 'live'}  ·  scenarios: ${scenarios.length}  ·  rooms attempted: ${totals.rooms}  ·  rooms created: ${totals.roomsCreated}`, '',
    '## Move totals', '',
    '| Status | Count | % |', '|---|---:|---:|',
    `| posted | ${totals.posted} | ${pct(totals.posted, totals.moves)} |`,
    `| failed_422 | ${totals.failed_422} | ${pct(totals.failed_422, totals.moves)} |`,
    `| failed_403 | ${totals.failed_403} | ${pct(totals.failed_403, totals.moves)} |`,
    `| failed_500 | ${totals.failed_500} | ${pct(totals.failed_500, totals.moves)} |`,
    `| skipped_missing_parent | ${totals.skipped_missing_parent} | ${pct(totals.skipped_missing_parent, totals.moves)} |`,
    `| skipped_no_bot | ${totals.skipped_no_bot} | ${pct(totals.skipped_no_bot, totals.moves)} |`,
    `| **total moves** | **${totals.moves}** | 100% |`,
    '',
    '## Top failure reasons (rule code from blockingErrors[0])', '',
    ...topN(errorReasons, 10).map(([k, v]) => `- \`${k}\` — ${v}`),
    '',
    '## Failures by category', '',
    ...topN(categoryFailures, 10).map(([k, v]) => `- ${k} — ${v}`),
    '',
    '## Sample rooms for inspection', '',
    ...runRecords.filter((r) => r.roomId).slice(0, 8).map((r) => `- \`${r.roomId}\` — ${r.scenario.scenarioId} (${r.scenario.category})`),
    '',
    '## Secrets check', '',
    '- [x] No emails in plaintext (this summary uses aliases only)',
    '- [x] No passwords logged',
    '- [x] No JWTs logged',
    '- [x] No service-role key used by runner',
    '',
    `_Full detailed JSONL (local, gitignored)_: \`logs/bot-stress/${runId}-stress.jsonl\``, '',
  ];
  fs.writeFileSync(summaryPath, lines.join('\n'));
  return summaryPath;
}

function pct(num, denom) { return denom === 0 ? '0%' : `${Math.round((num / denom) * 100)}%`; }
function topN(map, n) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function writeCorpus({ runId, mode, scenarios, runRecords, args }) {
  ensureDir(STRESS_CONFIG.SUMMARY_DIR);
  ensureDir(STRESS_CONFIG.STRESS_LOG_DIR);
  const dateIso = new Date().toISOString();
  const date = dateIso.slice(0, 10);
  const run = {
    runId,
    dateIso,
    mode,
    scenarios,
    // Align roomResults positionally to scenarios; if a scenario didn't run, its
    // entry is { roomId: null, results: [] }.
    roomResults: scenarios.map((s) => {
      const rec = runRecords.find((r) => r.scenario && r.scenario.scenarioId === s.scenarioId);
      return rec ? { roomId: rec.roomId, results: rec.results } : { roomId: null, results: [] };
    }),
  };

  let markdownPath = null;
  let jsonlPath = null;

  if (args.writeMarkdown !== false) {
    const md = buildEngagementCorpusMarkdown(run);
    const suffix = mode === 'dry' ? '-dry' : '';
    markdownPath = path.join(STRESS_CONFIG.SUMMARY_DIR, `${date}-bot-engagement-corpus${suffix}.md`);
    fs.writeFileSync(markdownPath, md);
  }

  if (args.writeJsonl) {
    const events = buildEngagementCorpusJsonlEvents(run);
    jsonlPath = path.join(STRESS_CONFIG.STRESS_LOG_DIR, `${runId}-engagement-corpus.jsonl`);
    fs.writeFileSync(jsonlPath, events.map((e) => JSON.stringify(e)).join('\n') + '\n');
  }

  return { markdownPath, jsonlPath };
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.regenerate) {
    console.log(`[stress] regenerating ${args.count} scenarios (seed=${args.seed})`);
    generate({ count: args.count, seed: args.seed });
  }

  let scenarios = loadGeneratedScenarios();
  if (scenarios.length === 0) {
    console.log(`[stress] no generated scenarios; auto-generating ${args.count} now (seed=${args.seed})`);
    generate({ count: args.count, seed: args.seed });
    scenarios = loadGeneratedScenarios();
  }
  scenarios = scenarios.slice(0, args.count);

  // Plan / pre-flight (cheap heuristic only)
  let planIssues = 0;
  for (const s of scenarios) {
    const issues = planScenario(s);
    if (issues.length > 0) planIssues += issues.length;
  }
  console.log(`[stress] mode=${args.dry ? 'dry' : 'live'} scenarios=${scenarios.length} planIssues=${planIssues}`);
  if (args.dry) {
    console.log('[stress] dry run — no Supabase calls. Use --count to control plan size.');
    console.log(`[stress] first 3 planned scenarios:`);
    for (const s of scenarios.slice(0, 3)) console.log(`  • ${s.scenarioId} (${s.category}, ${s.moves.length} moves)`);
    if (args.corpus) {
      const corpusRunId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
      const corpusPaths = writeCorpus({
        runId: corpusRunId,
        mode: 'dry',
        scenarios,
        runRecords: scenarios.map((s) => ({ scenario: s, roomId: null, results: [] })),
        args,
      });
      if (corpusPaths.markdownPath) console.log(`[stress] corpus markdown (dry): ${corpusPaths.markdownPath}`);
      if (corpusPaths.jsonlPath) console.log(`[stress] corpus jsonl (dry, local-only): ${corpusPaths.jsonlPath}`);
    }
    return;
  }

  // Live mode
  const env = loadEnvFiles();
  let cfg;
  try { cfg = buildBotConfig(env); }
  catch (err) {
    console.error(`[fatal] env validation: ${err.message}`);
    process.exit(2);
  }

  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  ensureDir(STRESS_CONFIG.STRESS_LOG_DIR);
  const jsonlPath = path.join(STRESS_CONFIG.STRESS_LOG_DIR, `${runId}-stress.jsonl`);
  const jsonl = fs.createWriteStream(jsonlPath);

  const adminClient = createBotClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
  const adminSession = await signInBot(adminClient, cfg.adminEmail, cfg.adminPassword);
  if (!adminSession) { console.error('[fatal] admin sign-in failed'); process.exit(3); }
  console.log('[stress] admin signed in');

  // Build email→alias mapping (aliases only used in logs)
  const emailToAlias = {};
  emailToAlias[cfg.adminEmail] = 'admin-1';
  const botByAlias = {};
  for (const bot of cfg.bots) {
    const { userId, email } = await ensureBotUser(adminClient, {
      label: bot.label, email: bot.email, password: bot.password,
      persona: bot.persona, displayName: bot.label,
    });
    botByAlias[bot.alias] = { userId, email, client: null };
    emailToAlias[bot.email] = bot.alias;
  }
  for (const bot of cfg.bots) {
    const c = createBotClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
    const s = await signInBot(c, bot.email, bot.password);
    if (!s) { console.error(`[fatal] bot ${bot.alias} sign-in failed`); process.exit(4); }
    botByAlias[bot.alias].client = c;
  }
  console.log(`[stress] ${Object.keys(botByAlias).length} bots signed in`);

  const runRecords = [];
  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i];
    process.stdout.write(`[stress] (${i + 1}/${scenarios.length}) ${s.scenarioId} ... `);
    let outcome;
    try {
      outcome = await runOneScenario({ scenario: s, adminClient, botByAlias, runId, jsonl, emailToAlias });
    } catch (err) {
      outcome = { roomId: null, results: [], fatal: `exception:${err.message}` };
    }
    runRecords.push({ scenario: s, roomId: outcome.roomId, results: outcome.results, fatal: outcome.fatal });
    if (outcome.fatal) console.log(`fatal=${outcome.fatal}`);
    else {
      const posted = outcome.results.filter((r) => r.actualStatus === 'posted').length;
      console.log(`room=${outcome.roomId} posted=${posted}/${outcome.results.length}`);
    }
  }

  jsonl.end();
  const { totals, errorReasons, categoryFailures } = summarize(runRecords);
  const summaryPath = writeSummary({
    runId, args, totals, errorReasons, categoryFailures,
    scenarios, runRecords,
  });

  let corpusPaths = { markdownPath: null, jsonlPath: null };
  if (args.corpus) {
    corpusPaths = writeCorpus({ runId, mode: 'live', scenarios, runRecords, args });
  }

  console.log('');
  console.log(`[stress] summary written: ${summaryPath}`);
  console.log(`[stress] full JSONL log: ${jsonlPath}`);
  if (corpusPaths.markdownPath) console.log(`[stress] corpus markdown: ${corpusPaths.markdownPath}`);
  if (corpusPaths.jsonlPath) console.log(`[stress] corpus jsonl (local-only): ${corpusPaths.jsonlPath}`);
  console.log(`[stress] rooms_created=${totals.roomsCreated}/${totals.rooms} posted=${totals.posted}/${totals.moves}`);
  console.log(`[stress] failed_422=${totals.failed_422} failed_403=${totals.failed_403} failed_500=${totals.failed_500} skipped_parent=${totals.skipped_missing_parent}`);
}

if (require.main === module) {
  main().catch((err) => { console.error('[fatal]', err.message); process.exit(99); });
}

module.exports = { parseArgs, loadGeneratedScenarios, planScenario, summarize };
