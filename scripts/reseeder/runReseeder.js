/**
 * RESEED-001 — reseeder orchestrator + poster + reporter entry.
 *
 * Pipeline: fetch/ingest -> gitignored source bank JSONL -> plan (engine-valid
 * by construction) -> render (no-provider by default; Sonnet behind a gate) ->
 * post through submit-argument -> gitignored move-event JSONL -> committed
 * Markdown report.
 *
 * Boundaries (doctrine):
 *   - NO direct insert into public.arguments — every argument goes through
 *     `invokeSubmitArgument` -> submit-argument (JWT, RLS-respecting).
 *   - NO service-role in the posting path — the bot client only receives the
 *     publishable/anon key.
 *   - Debate + participant inserts use the AUTHENTICATED bot client (allowed).
 *   - `--no-provider` (default) makes ZERO model calls. `--provider sonnet`
 *     requires `--pilot` + the Anthropic env gate. Live posting requires
 *     `--pilot` + `.env.bot-tests`.
 *   - Raw source URLs / attribution live ONLY in the gitignored bank.
 *
 * The Sonnet model string is NEVER hardcoded here: the client is built via
 * `claudeMessagesClient.createClient(...)` and the resolved model is read back
 * from `client.snapshotUsage().model`.
 *
 * CommonJS. Node entry point.
 */

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const { loadEnvFiles, buildBotConfig } = require('../bot-fixtures/loadEnv');
const { createBotClient, signInBot } = require('../bot-fixtures/supabaseClient');
const { ensureBotUser } = require('../bot-fixtures/adminOps');
const { buildSubmitArgumentBody, invokeSubmitArgument } = require('../bot-fixtures/submitMove');
const { mapPersonaSideToParticipantSide } = require('../bot-fixtures/personaMapping');

const { RESEED_PACK_NAMES } = require('./reseedPacks');
const { planPack } = require('./reseedPackPlanner');
const { renderSonnet } = require('./reseedMoveRenderer');
const { populateSourceBank } = require('./argsMeSourceFetcher');
const { ingestOfflineDump } = require('./reseedOfflineIngest');
const { buildReseedMarkdown } = require('./reseedReport');

const LOG_DIR = path.resolve(__dirname, '..', '..', 'logs', 'reseeder');
const REPORT_DIR = path.resolve(__dirname, '..', '..', 'docs', 'testing-runs');

// Default topics used to populate the source bank (broad, low-stakes).
const DEFAULT_TOPICS = [
  'school uniforms',
  'nuclear energy',
  'remote work',
  'social media regulation',
  'universal basic income',
  'public transportation',
];

function parseArgs(argv) {
  const args = {
    dry: false,
    pilot: false,
    pack: 'baseline',
    count: 5,
    seed: 'reseed',
    provider: 'none',
    topics: null,
    offlineDump: null,
    writeJsonl: true,
    writeMarkdown: true,
  };
  const list = Array.isArray(argv) ? argv.slice(2) : [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a === '--dry') args.dry = true;
    else if (a === '--pilot') args.pilot = true;
    else if (a === '--no-provider') args.provider = 'none';
    else if (a === '--provider') args.provider = list[++i] || 'none';
    else if (a === '--pack') args.pack = list[++i] || 'baseline';
    else if (a === '--count') args.count = parseInt(list[++i], 10) || 5;
    else if (a === '--seed') args.seed = list[++i] || 'reseed';
    else if (a === '--topics') args.topics = String(list[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--offline-dump') args.offlineDump = list[++i] || null;
    else if (a === '--no-jsonl') args.writeJsonl = false;
    else if (a === '--no-markdown') args.writeMarkdown = false;
  }
  return args;
}

function yyyymmdd(d) {
  const dt = d instanceof Date ? d : new Date();
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function buildReseedRunTag(pack, dateYyyymmdd, hash8) {
  return `reseed-${pack}-${dateYyyymmdd}-${hash8}`;
}

function buildRoomTitle(seedTitle, runTag) {
  return `${seedTitle} [${runTag}]`;
}

function shortHash(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 8);
}

/** Append one JSONL event to the gitignored move-event log. */
function makeJsonlAppender(filePath, enabled) {
  if (!enabled) return () => {};
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const stream = fs.createWriteStream(filePath, { flags: 'a' });
  return (obj) => stream.write(JSON.stringify(obj) + '\n');
}

/**
 * Load the source bank for a run. Live fetch first (unless --offline-dump);
 * on empty, fall back to offline dump. Hard-exits if no material is available.
 */
async function loadBank(args, runId) {
  const bankPath = path.join(LOG_DIR, `${runId}-source-bank.jsonl`);
  const topics = args.topics && args.topics.length > 0 ? args.topics : DEFAULT_TOPICS;

  if (args.offlineDump) {
    const { records } = ingestOfflineDump({ dumpPath: args.offlineDump, bankPath, runId });
    return { records, bankPath, source: 'offline_dump' };
  }

  // Live fetch (uses global fetch at runtime).
  let live = { written: 0 };
  try {
    live = await populateSourceBank({ topics, perTopic: 6, bankPath, runId });
  } catch (err) {
    console.warn(`[reseed] args.me fetch failed: ${err.message}`);
  }

  // Re-read the bank JSONL we just wrote to get the records.
  const records = [];
  if (fs.existsSync(bankPath)) {
    for (const line of fs.readFileSync(bankPath, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t) continue;
      try { records.push(JSON.parse(t)); } catch { /* skip */ }
    }
  }
  return { records, bankPath, source: 'args_me_live', liveWritten: live.written };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!RESEED_PACK_NAMES.includes(args.pack)) {
    console.error(`[reseed] unknown pack "${args.pack}". Known: ${RESEED_PACK_NAMES.join(', ')}`);
    process.exit(2);
  }

  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const dateIso = new Date().toISOString();
  const runTag = buildReseedRunTag(args.pack, yyyymmdd(new Date()), shortHash(runId));
  console.log(`[reseed] mode=${args.dry ? 'dry' : 'live'} pack=${args.pack} count=${args.count} provider=${args.provider} runTag=${runTag}`);

  // ── Source bank ──────────────────────────────────────────────────
  const { records: bank, bankPath, source } = await loadBank(args, runId);
  if (!bank || bank.length === 0) {
    console.error('[reseed] no source material: provide --offline-dump or restore connectivity to args.me.');
    process.exit(3);
  }
  console.log(`[reseed] source bank: ${bank.length} record(s) via ${source} (${bankPath})`);

  // ── Plan (engine-valid by construction) ──────────────────────────
  const { scenarios, rejectedTemplates } = planPack({
    pack: args.pack, count: args.count, seed: args.seed, runId, bank,
  });
  console.log(`[reseed] planned ${scenarios.length} thread(s), rejectedTemplates=${rejectedTemplates}`);

  // ── Optional Sonnet client (gated) ───────────────────────────────
  let sonnetClient = null;
  if (args.provider === 'sonnet') {
    if (!args.pilot) {
      console.error('[reseed] --provider sonnet requires --pilot.');
      process.exit(2);
    }
    const claudeClient = require('../bot-fixtures/claudeMessagesClient');
    try {
      // The Sonnet model is read back from the client, not hardcoded. Operator
      // sets ANTHROPIC_MODEL=claude-sonnet-4-6 (current sonnet snapshot) in
      // .env.engagement-intelligence, or passes it here.
      sonnetClient = claudeClient.createClient({
        pilot: true,
        requirePilotFlag: true,
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
      });
      const snap = sonnetClient.snapshotUsage();
      console.log(`[reseed] sonnet client ready (model=${snap.model})`);
    } catch (err) {
      console.error(`[reseed] sonnet client disabled: ${err.message}`);
      process.exit(2);
    }
  }

  const jsonlPath = path.join(LOG_DIR, `${runId}-reseed.jsonl`);
  const appendEvent = makeJsonlAppender(jsonlPath, args.writeJsonl);
  const allEvents = [];

  function record(ev) {
    allEvents.push(ev);
    appendEvent(ev);
  }

  // ── Render every move (optionally via Sonnet) ────────────────────
  for (const sc of scenarios) {
    for (const mv of sc.moves) {
      // move_planned event (attribution non-zero from move 1).
      record({
        stage: 'move_planned', runId, pack: args.pack, scenarioId: sc.scenarioId, roomId: null,
        seedId: mv.seedId, threadIndex: mv.threadIndex, moveIndex: 0, moveId: mv.moveId,
        spineId: mv.spineId, voiceId: mv.voiceId, bankName: mv.bankName, optionIndex: mv.optionIndex,
        argumentType: mv.argumentType, source: 'deterministic_template', issues: [], seed: mv.parentMoveId == null,
        engineValid: mv.engineValid,
      });

      if (sonnetClient) {
        const seedRecord = bank.find((b) => b.bankName === mv.bankName) || bank[0];
        const { seededRng } = require('../bot-fixtures/stressScenarioTemplates');
        const rng = seededRng(`${runId}::${sc.scenarioId}::${mv.moveId}`);
        const rendered = await renderSonnet({
          client: sonnetClient,
          move: { ...mv, spineId: mv.spineId, requiredOpeningToken: null },
          seedRecord, rng, maxRetries: 1,
        });
        mv.body = rendered.body;
        mv.source = rendered.source;
        record({
          stage: 'move_rendered', runId, pack: args.pack, scenarioId: sc.scenarioId, roomId: null,
          seedId: mv.seedId, threadIndex: mv.threadIndex, moveIndex: 0, moveId: mv.moveId,
          spineId: mv.spineId, voiceId: mv.voiceId, bankName: mv.bankName, optionIndex: mv.optionIndex,
          argumentType: mv.argumentType, source: rendered.source, issues: rendered.issues, seed: mv.parentMoveId == null,
          engineValid: mv.engineValid,
        });
      } else {
        mv.source = 'deterministic_template';
      }

      // move_body_sample (samey-move fingerprint).
      record({
        stage: 'move_body_sample', runId, pack: args.pack, scenarioId: sc.scenarioId, roomId: null,
        seedId: mv.seedId, threadIndex: mv.threadIndex, moveIndex: 0, moveId: mv.moveId,
        spineId: mv.spineId, voiceId: mv.voiceId, bankName: mv.bankName, optionIndex: mv.optionIndex,
        argumentType: mv.argumentType, source: mv.source, issues: [], seed: mv.parentMoveId == null,
        engineValid: mv.engineValid, bodySample: mv.body,
      });
    }
  }

  // ── Dry mode: report only, no posting ────────────────────────────
  if (args.dry) {
    if (args.writeMarkdown) writeReport({ runId, dateIso, mode: 'dry', pack: args.pack, events: allEvents, args });
    console.log(`[reseed] dry run complete. events=${allEvents.length} jsonl=${args.writeJsonl ? jsonlPath : '(off)'}`);
    return;
  }

  // ── Live posting via submit-argument ─────────────────────────────
  await postScenarios({ args, scenarios, runId, record });

  if (args.writeMarkdown) writeReport({ runId, dateIso, mode: 'live', pack: args.pack, events: allEvents, args });
  const posted = allEvents.filter((e) => e.postStatus === 'posted').length;
  console.log(`[reseed] live run complete. posted=${posted} events=${allEvents.length}`);
}

async function postScenarios({ args, scenarios, runId, record }) {
  const env = loadEnvFiles(process.cwd());
  const cfg = buildBotConfig(env);

  const adminClient = createBotClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
  const adminSession = await signInBot(adminClient, cfg.adminEmail, cfg.adminPassword);
  if (!adminSession) { console.error('[reseed] fatal: admin sign-in failed'); process.exit(4); }

  const botByAlias = {};
  for (const bot of cfg.bots) {
    await ensureBotUser(adminClient, {
      label: bot.label, email: bot.email, password: bot.password, persona: bot.persona, displayName: bot.label,
    });
    botByAlias[bot.alias] = { userId: null, client: null, email: bot.email, password: bot.password };
  }
  for (const bot of cfg.bots) {
    const c = createBotClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
    const s = await signInBot(c, bot.email, bot.password);
    if (!s) { console.error(`[reseed] fatal: bot ${bot.alias} sign-in failed`); process.exit(4); }
    botByAlias[bot.alias].client = c;
    botByAlias[bot.alias].userId = s.userId;
  }
  const botAliases = Object.keys(botByAlias);

  const constitutionRes = await adminClient.from('constitution_versions').select('id').eq('active', true).single();
  if (constitutionRes.error || !constitutionRes.data) {
    console.error('[reseed] fatal: no active constitution');
    process.exit(4);
  }

  for (const sc of scenarios) {
    const personas = sc.personas || [];
    const authorToBotAlias = {};
    for (let p = 0; p < personas.length && p < botAliases.length; p++) authorToBotAlias[personas[p].alias] = botAliases[p];

    const botA = botByAlias[botAliases[0]];
    const runTag = buildReseedRunTag(sc.scenarioId.split('-t')[0] || 'baseline', yyyymmdd(new Date()), shortHash(runId + sc.scenarioId));
    const roomTitle = buildRoomTitle(sc.title, runTag);
    const debateInsert = await botA.client.from('debates').insert({
      created_by: botA.userId, title: roomTitle, run_tag: runTag, resolution: sc.resolution,
      description: '', status: 'open', constitution_id: constitutionRes.data.id,
    }).select('id').single();
    if (debateInsert.error || !debateInsert.data) {
      console.warn(`[reseed] create_room_failed for ${sc.scenarioId}`);
      continue;
    }
    const debateId = debateInsert.data.id;

    await botA.client.from('debate_participants').insert({ debate_id: debateId, user_id: botA.userId, side: 'moderator' });
    for (let p = 1; p < botAliases.length && p < personas.length; p++) {
      const bot = botByAlias[botAliases[p]];
      const side = mapPersonaSideToParticipantSide(personas[p].side);
      const { error } = await bot.client.from('debate_participants').insert({ debate_id: debateId, user_id: bot.userId, side });
      if (error && error.code !== '23505') console.warn(`[reseed] join failed: ${error.message}`);
    }

    const argIdByMoveId = {};
    // Assign each move to an author alias round-robin over personas.
    for (const mv of sc.moves) {
      const personaIdx = mv.threadIndex != null ? 0 : 0;
      const authorAlias = personas[(hashMove(mv.moveId)) % personas.length].alias;
      const bot = botByAlias[authorToBotAlias[authorAlias]];
      if (mv.parentMoveId && !argIdByMoveId[mv.parentMoveId]) {
        record(postEvent(runId, args.pack, sc, mv, debateId, 'skipped_missing_parent', null));
        continue;
      }
      const parentArgumentId = mv.parentMoveId ? argIdByMoveId[mv.parentMoveId] : null;
      const side = mapPersonaSideToParticipantSide(personas.find((pp) => pp.alias === authorAlias).side);
      const body = buildSubmitArgumentBody({
        debateId, parentArgumentId,
        move: {
          moveId: mv.moveId, argumentType: mv.argumentType, disagreementAxis: mv.disagreementAxis || undefined,
          targetExcerpt: mv.targetExcerpt || undefined, body: mv.body, selectedTagCodes: mv.selectedTagCodes || [],
          evidence: mv.attachedEvidence && mv.attachedEvidence.length > 0 ? { sourceText: mv.attachedEvidence[0].sourceText } : undefined,
        },
        side, clientSubmissionId: randomUUID(),
      });
      const r = await invokeSubmitArgument(bot.client, body);
      if (r.ok) {
        const argId = r.data && r.data.argument && r.data.argument.id;
        if (argId) argIdByMoveId[mv.moveId] = argId;
        record(postEvent(runId, args.pack, sc, mv, debateId, 'posted', argId));
      } else {
        record(postEvent(runId, args.pack, sc, mv, debateId, `failed_${r.status}`, null, r.detail));
      }
    }
  }
}

function hashMove(id) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

function postEvent(runId, pack, sc, mv, roomId, postStatus, argumentId, detail) {
  return {
    stage: 'move_posted', runId, pack, scenarioId: sc.scenarioId, roomId,
    seedId: mv.seedId, threadIndex: mv.threadIndex, moveIndex: 0, moveId: mv.moveId,
    spineId: mv.spineId, voiceId: mv.voiceId, bankName: mv.bankName, optionIndex: mv.optionIndex,
    argumentType: mv.argumentType, source: mv.source || 'deterministic_template', issues: [], seed: mv.parentMoveId == null,
    engineValid: mv.engineValid, postStatus, argumentId: argumentId || undefined, errorDetail: detail || undefined,
    bodySample: mv.body,
  };
}

function writeReport({ runId, dateIso, mode, pack, events, args }) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const md = buildReseedMarkdown({ runId, dateIso, mode, pack, events, args });
  const filePath = path.join(REPORT_DIR, `${dateIso.slice(0, 10)}-reseeder-${pack}-${mode}.md`);
  fs.writeFileSync(filePath, md, 'utf8');
  console.log(`[reseed] report: ${filePath}`);
  return filePath;
}

module.exports = {
  parseArgs,
  buildReseedRunTag,
  buildRoomTitle,
  yyyymmdd,
  shortHash,
  main,
  DEFAULT_TOPICS,
};

if (require.main === module) {
  main().catch((err) => {
    console.error(`[reseed] fatal: ${err && err.message ? err.message : err}`);
    process.exit(1);
  });
}
