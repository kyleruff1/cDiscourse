#!/usr/bin/env node
/**
 * Existing-room engagement runner.
 *
 * Picks dev/test debate rooms that already exist in Supabase, identifies
 * the ones with no rebuttal or low move count, and has the bots take
 * turns posting until the target depth is reached (or a concession /
 * synthesis arrives). Bot-revocateur opens the pressure; bot-provocateur
 * defends + brings receipts on alternating turns.
 *
 * Gates (live mode):
 *   - `.env.engagement-intelligence` present + `ENGAGEMENT_INTEL_ENABLE_ANTHROPIC=true` + `ANTHROPIC_API_KEY`
 *   - `.env.bot-tests` with bot credentials
 *   - `--pilot` on the CLI
 *
 * - No xAI call (the rooms already exist; we're posting follow-ups).
 * - No service-role. No direct insert. Every move routes through
 *   `submit-argument` like any human user.
 * - Bots never claim to be real users; skill bodies enforce the test-bot
 *   identity disclaimer.
 */
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const REPO_ROOT = process.cwd();
const REPORT_DIR = path.join(REPO_ROOT, 'docs', 'testing-runs');
const LOG_DIR = path.join(REPO_ROOT, 'logs', 'engagement-intelligence');

const { loadAdversarialSkillBundle, redactedSkillGate } = require('./skillFileLoader');
const { renderAdversarialMove } = require('./xaiAdversarialMoveRenderer');
const claudeClient = require('./claudeMessagesClient');
const { loadEnvFiles, buildBotConfig } = require('./loadEnv');
const { createBotClient, signInBot } = require('./supabaseClient');
const { ensureBotUser } = require('./adminOps');
const { buildSubmitArgumentBody, invokeSubmitArgument } = require('./submitMove');

// ── CLI parsing ───────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    dry: true,
    pilot: false,
    samplePct: 50,
    targetMovesMin: 15,
    targetMovesMax: 25,
    maxRooms: 100,
    maxMovesPerRoom: 25,
    maxMovesTotal: 2000,
    skipExisting: false,
    seed: 'engage-existing-rooms-2026-05-18',
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry') args.dry = true;
    else if (a === '--pilot') { args.pilot = true; args.dry = false; }
    else if (a === '--sample-pct' && argv[i + 1]) args.samplePct = Math.max(1, Math.min(100, Number(argv[++i]) || 50));
    else if (a === '--target-moves' && argv[i + 1]) { const n = Number(argv[++i]) || 20; args.targetMovesMin = n - 2; args.targetMovesMax = n + 2; }
    else if (a === '--target-moves-min' && argv[i + 1]) args.targetMovesMin = Math.max(2, Number(argv[++i]) || 15);
    else if (a === '--target-moves-max' && argv[i + 1]) args.targetMovesMax = Math.max(args.targetMovesMin, Number(argv[++i]) || 25);
    else if (a === '--max-rooms' && argv[i + 1]) args.maxRooms = Math.max(1, Number(argv[++i]) || 100);
    else if (a === '--max-moves-total' && argv[i + 1]) args.maxMovesTotal = Math.max(1, Number(argv[++i]) || 2000);
    else if (a === '--skip-existing') args.skipExisting = true;
    else if (a === '--seed' && argv[i + 1]) args.seed = String(argv[++i]);
  }
  return args;
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

// ── Deterministic sampler ────────────────────────────────────

function seededRng(seedString) {
  let seed = 0;
  for (const ch of String(seedString)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  return function next() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xFFFFFFFF;
  };
}

function sampleDeterministic(arr, pct, seed) {
  if (arr.length === 0) return [];
  if (pct >= 100) return arr.slice();
  const rng = seededRng(seed);
  const target = Math.max(1, Math.round((pct / 100) * arr.length));
  const tagged = arr.map((v) => ({ v, k: rng() }));
  tagged.sort((a, b) => a.k - b.k);
  return tagged.slice(0, target).map((t) => t.v);
}

// ── Axis remap (matches the corpus runner's contract) ────────

const AXIS_REMAP_FOR_SUBMIT = {
  source_chain: 'evidence',
  anti_amplification: 'evidence',
  framing: 'scope',
  none: null,
};
function mapAxisForSubmit(axis) {
  if (axis == null) return null;
  if (Object.prototype.hasOwnProperty.call(AXIS_REMAP_FOR_SUBMIT, axis)) return AXIS_REMAP_FOR_SUBMIT[axis];
  return axis;
}

// ── JSONL writer ─────────────────────────────────────────────

class JsonlStream {
  constructor(filePath, runId, skillGate) {
    ensureDir(path.dirname(filePath));
    this.stream = fs.createWriteStream(filePath);
    this.path = filePath;
    this.runId = runId;
    this.skillGate = skillGate;
  }
  write(stage, extras = {}) {
    this.stream.write(JSON.stringify({
      runId: this.runId,
      ts: new Date().toISOString(),
      stage,
      skillGate: this.skillGate,
      ...extras,
    }) + '\n');
  }
  end() { return new Promise((resolve) => this.stream.end(resolve)); }
}

// ── Env booleans (no values logged) ──────────────────────────

function envBooleans() {
  const envFile = path.join(REPO_ROOT, '.env.engagement-intelligence');
  const botFile = path.join(REPO_ROOT, '.env.bot-tests');
  let hasAnthropic = false, enableAnthropic = false;
  if (fs.existsSync(envFile)) {
    const txt = fs.readFileSync(envFile, 'utf8');
    hasAnthropic = /^ANTHROPIC_API_KEY=\S/m.test(txt);
    enableAnthropic = /^ENGAGEMENT_INTEL_ENABLE_ANTHROPIC=true/m.test(txt);
  }
  if (process.env.ANTHROPIC_API_KEY) hasAnthropic = true;
  if (String(process.env.ENGAGEMENT_INTEL_ENABLE_ANTHROPIC || '').toLowerCase() === 'true') enableAnthropic = true;
  return {
    hasAnthropicKey: hasAnthropic,
    enableAnthropic,
    hasBotTests: fs.existsSync(botFile),
  };
}

function refuseLive(args, bools) {
  const reasons = [];
  if (!bools.hasAnthropicKey) reasons.push('ANTHROPIC_API_KEY missing');
  if (!bools.enableAnthropic) reasons.push('ENGAGEMENT_INTEL_ENABLE_ANTHROPIC not true');
  if (!bools.hasBotTests) reasons.push('.env.bot-tests missing');
  if (!args.pilot) reasons.push('--pilot not set');
  return reasons;
}

// ── Live setup ───────────────────────────────────────────────

async function setupLive(args) {
  const env = loadEnvFiles();
  let cfg;
  try { cfg = buildBotConfig(env); } catch (err) {
    console.error(`[engage] live setup: ${err.message}`); return null;
  }
  let anthropic;
  try { anthropic = claudeClient.createClient({ pilot: args.pilot, requirePilotFlag: true }); }
  catch (err) { console.error(`[engage] anthropic disabled: ${(err && err.reason) || err.message}`); return null; }

  const adminClient = createBotClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
  const adminSession = await signInBot(adminClient, cfg.adminEmail, cfg.adminPassword);
  if (!adminSession) { console.error('[engage] admin sign-in failed'); return null; }
  console.log('[engage] admin signed in');

  const botByAlias = {};
  for (const bot of cfg.bots) {
    try {
      const r = await ensureBotUser(adminClient, {
        label: bot.label, email: bot.email, password: bot.password,
        persona: bot.persona, displayName: bot.label,
      });
      const c = createBotClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
      const s = await signInBot(c, bot.email, bot.password);
      if (!s) { console.error(`[engage] bot ${bot.alias} sign-in failed`); return null; }
      botByAlias[bot.alias] = { userId: r.userId, email: bot.email, client: c, label: bot.label };
    } catch (err) {
      console.error(`[engage] ensure bot ${bot.alias}: ${(err && err.message) || 'unknown'}`); return null;
    }
  }
  console.log(`[engage] ${Object.keys(botByAlias).length} bots signed in`);
  return { cfg, adminClient, botByAlias, anthropic };
}

// ── Room discovery ──────────────────────────────────────────

async function listEligibleRooms(adminClient, args) {
  // 1. Fetch open debates.
  const { data: debates, error } = await adminClient
    .from('debates')
    .select('id, title, resolution, description, status, constitution_id, created_by, created_at, updated_at')
    .eq('status', 'open')
    .order('updated_at', { ascending: false })
    .limit(500);
  if (error) { console.error(`[engage] list debates failed: ${error.message}`); return []; }
  if (!debates || debates.length === 0) return [];

  // 2. Fetch arguments for those debates via in().
  const ids = debates.map((d) => d.id);
  const { data: rows, error: argErr } = await adminClient
    .from('arguments')
    .select('id, debate_id, parent_id, author_id, argument_type, side, body, status, created_at')
    .in('debate_id', ids)
    .eq('status', 'posted')
    .order('debate_id', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(20000);
  if (argErr) { console.error(`[engage] list arguments failed: ${argErr.message}`); return []; }
  const byDebate = new Map();
  for (const r of rows || []) {
    if (!byDebate.has(r.debate_id)) byDebate.set(r.debate_id, []);
    byDebate.get(r.debate_id).push(r);
  }

  // 3. Build room records with current depth.
  const out = [];
  for (const d of debates) {
    const msgs = byDebate.get(d.id) || [];
    const moveCount = msgs.length;
    const sortedMsgs = msgs.slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const rootMsg = sortedMsgs.find((m) => !m.parent_id) || sortedMsgs[0];
    const latestMsg = sortedMsgs[sortedMsgs.length - 1] || null;
    const rebuttalCount = msgs.filter((m) => m.argument_type === 'rebuttal' || m.argument_type === 'counter_rebuttal').length;
    const hasSynthesis = msgs.some((m) => m.argument_type === 'synthesis');
    const hasConcession = msgs.some((m) => m.argument_type === 'concession');
    if (hasSynthesis || hasConcession) continue; // already resolved
    if (moveCount >= args.targetMovesMax) continue; // already deep enough
    out.push({
      debate: d,
      messages: sortedMsgs,
      moveCount,
      rebuttalCount,
      rootMsg,
      latestMsg,
      hasUserResolved: false,
    });
  }
  return out;
}

// ── Move generation per room ────────────────────────────────

const AXES = ['source_chain', 'evidence', 'scope', 'definition', 'causal', 'logic', 'fact', 'framing'];

async function engageRoom({ room, args, jsonl, ctx, bundle, runId }) {
  const debateId = room.debate.id;
  // Personas: alternate revocateur (presses) and provocateur (defends).
  // bot-A defends (provocateur); bot-B presses (revocateur); bot-C synthesizes when needed.
  const botAliases = Object.keys(ctx.botByAlias);
  if (botAliases.length < 2) {
    jsonl.write('room_skipped', { debateId, reason: 'not_enough_bots' });
    return { moves: 0 };
  }
  const botA = ctx.botByAlias[botAliases[0]]; // provocateur seat
  const botB = ctx.botByAlias[botAliases[1]]; // revocateur seat
  const botC = botAliases.length >= 3 ? ctx.botByAlias[botAliases[2]] : null; // synthesizer seat

  // Ensure participants are joined; tolerate dup-key conflicts.
  await botA.client.from('debate_participants').insert({ debate_id: debateId, user_id: botA.userId, side: 'affirmative' }).then(() => null, () => null);
  const joinB = await botB.client.from('debate_participants').insert({ debate_id: debateId, user_id: botB.userId, side: 'negative' });
  if (joinB.error && joinB.error.code !== '23505') console.warn(`[engage] join B in ${debateId}: ${joinB.error.message}`);
  if (botC) {
    const joinC = await botC.client.from('debate_participants').insert({ debate_id: debateId, user_id: botC.userId, side: 'moderator' });
    if (joinC.error && joinC.error.code !== '23505') console.warn(`[engage] join C in ${debateId}: ${joinC.error.message}`);
  }

  // Pick a target depth in [min, max] deterministically per room.
  const rng = seededRng(`${args.seed}::${debateId}`);
  const targetMoves = args.targetMovesMin + Math.floor(rng() * Math.max(1, args.targetMovesMax - args.targetMovesMin + 1));
  const movesRemaining = Math.max(0, Math.min(targetMoves - room.moveCount, args.maxMovesPerRoom));
  if (movesRemaining <= 0) return { moves: 0 };

  // The first new move is parented to the room's latest message.
  let parentArgumentId = room.latestMsg ? room.latestMsg.id : null;
  let parentBody = room.latestMsg ? room.latestMsg.body : (room.rootMsg ? room.rootMsg.body : room.debate.resolution);
  let parentArgumentType = room.latestMsg ? room.latestMsg.argument_type : 'thesis';
  let depth = room.moveCount + 1;
  let posted = 0;
  let consecutiveFailures = 0;

  jsonl.write('room_engage_start', {
    debateId,
    title: (room.debate.title || '').slice(0, 100),
    initialMoveCount: room.moveCount,
    targetMoves,
    movesPlanned: movesRemaining,
  });

  for (let i = 0; i < movesRemaining; i++) {
    // Alternate: even i → revocateur (press), odd i → provocateur (defend).
    const role = i % 2 === 0 ? 'bot-revocateur' : 'bot-provocateur';
    const bot = i % 2 === 0 ? botB : botA;
    const sideStr = role === 'bot-provocateur' ? 'affirmative' : 'negative';
    const argumentType = parentArgumentType === 'thesis' ? 'rebuttal'
                       : parentArgumentType === 'rebuttal' ? 'counter_rebuttal'
                       : parentArgumentType === 'counter_rebuttal' ? 'rebuttal'
                       : 'rebuttal';
    const fallbackAxis = AXES[depth % AXES.length];
    const targetExcerpt = (parentBody || '').slice(0, 90).replace(/\s+/g, ' ').trim();

    // Compose a minimal conversationSummary from the last few messages.
    const tail = room.messages.slice(-5).map((m, idx) => `  prior${idx + 1} (${m.argument_type}): ${(m.body || '').slice(0, 140)}`).join('\n');

    const persona = {
      skillRole: role,
      alias: bot.label || role,
      skillHash: role === 'bot-provocateur' ? bundle.provocateurHash : bundle.revocateurHash,
    };

    const scene = {
      title: room.debate.title,
      category: 'existing_room_engagement',
      topicBucket: 'existing_room',
    };

    jsonl.write('move_prompt_built', {
      debateId,
      depth,
      role,
      promptKind: 'existing_room_continuation',
      skillHash: persona.skillHash,
    });

    const rendered = await renderAdversarialMove({
      client: ctx.anthropic,
      scene,
      parent: { argumentType: parentArgumentType, body: parentBody, depth: depth - 1 },
      slot: { argumentType, depth },
      persona,
      skillBundle: bundle,
      conversationSummary: tail,
      axis: 'auto',
      fallbackAxis,
      antiAmplificationCue: 'popularity is not doing the evidentiary work',
      forceTargetExcerpt: targetExcerpt,
    });
    const effectiveAxis = rendered.chosenAxis || fallbackAxis;

    jsonl.write('move_rendered', {
      debateId, depth, role,
      source: rendered.source,
      attempts: rendered.attempts,
      jsonParsed: rendered.jsonParsed,
      validationFailureReason: rendered.validationFailureReason,
      chosenAxis: rendered.chosenAxis,
      mechanism: rendered.mechanism,
      skillHash: rendered.skillHash,
    });

    const submitBody = buildSubmitArgumentBody({
      debateId,
      parentArgumentId,
      move: {
        argumentType,
        body: rendered.body,
        targetExcerpt,
        disagreementAxis: mapAxisForSubmit(effectiveAxis),
        selectedTagCodes: [],
      },
      side: sideStr,
    });
    const submitRes = await invokeSubmitArgument(bot.client, submitBody);

    jsonl.write('submit_attempt', { debateId, depth, role, attempted: true });

    if (!submitRes.ok) {
      jsonl.write('submit_result', {
        debateId, depth, role, status: 'rejected',
        httpStatus: submitRes.status, errorCode: submitRes.error?.error || null,
        detail: typeof submitRes.detail === 'string' ? submitRes.detail.slice(0, 200) : null,
      });
      consecutiveFailures += 1;
      if (consecutiveFailures >= 3) { jsonl.write('room_stop', { debateId, reason: 'three_in_a_row_failures', posted }); break; }
      continue;
    }
    consecutiveFailures = 0;
    const argumentId = submitRes.data?.argument?.id || submitRes.data?.id || null;
    jsonl.write('submit_result', { debateId, depth, role, status: 'posted', argumentId });
    posted += 1;
    parentArgumentId = argumentId;
    parentBody = rendered.body;
    parentArgumentType = argumentType;
    depth += 1;

    // Concession marker → wrap up
    if (/(\bi concede\b|\bi grant\b|\bi acknowledge\b|fair point|that point is valid)/i.test(rendered.body)) {
      jsonl.write('room_stop', { debateId, reason: 'concession_marker_detected', posted });
      break;
    }
  }

  jsonl.write('room_summary', {
    debateId,
    title: (room.debate.title || '').slice(0, 100),
    initialMoveCount: room.moveCount,
    movesPosted: posted,
    finalMoveCount: room.moveCount + posted,
    targetMoves,
  });
  return { moves: posted };
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  const bools = envBooleans();
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  console.log(`[engage] mode=${args.dry ? 'dry' : 'live'} sample=${args.samplePct}% targetMoves=${args.targetMovesMin}-${args.targetMovesMax} maxRooms=${args.maxRooms}`);
  console.log(`[engage] env: ${JSON.stringify(bools)}`);

  let bundle;
  try { bundle = loadAdversarialSkillBundle(); }
  catch (err) { console.error(`[engage] SKILL GATE FAILED: ${err.message}`); process.exitCode = 2; return; }
  console.log(`[engage] skill gate OK · provocateur=${bundle.provocateurHash} · revocateur=${bundle.revocateurHash}`);

  if (!args.dry) {
    const refusals = refuseLive(args, bools);
    if (refusals.length > 0) { console.error(`[engage] refusing live: ${refusals.join('; ')}`); process.exitCode = 2; return; }
  }

  ensureDir(LOG_DIR); ensureDir(REPORT_DIR);
  const jsonlPath = path.join(LOG_DIR, `${runId}-engage-existing-rooms.jsonl`);
  const skillGate = redactedSkillGate(bundle, true);
  const jsonl = new JsonlStream(jsonlPath, runId, skillGate);
  console.log(`[engage] jsonl: ${path.relative(REPO_ROOT, jsonlPath)} (gitignored)`);

  jsonl.write('run_start', { runId, args, envBooleans: bools });
  jsonl.write('skill_validation', { skillGate });

  if (args.dry) {
    console.log('[engage] dry mode — no Anthropic / Supabase calls; producing setup-only JSONL.');
    jsonl.write('run_summary', { mode: 'dry', rooms: 0, moves: 0 });
    await jsonl.end();
    return;
  }

  // ── Live: set up clients
  const ctx = await setupLive(args);
  if (!ctx) { jsonl.write('run_summary', { mode: 'live', error: 'setup_failed' }); await jsonl.end(); process.exitCode = 3; return; }

  // ── Discover candidate rooms
  const eligible = await listEligibleRooms(ctx.adminClient, args);
  jsonl.write('eligibility_scan', {
    eligibleCount: eligible.length,
    sampleTargetPct: args.samplePct,
  });
  console.log(`[engage] eligible rooms: ${eligible.length}`);
  if (eligible.length === 0) {
    jsonl.write('run_summary', { mode: 'live', rooms: 0, moves: 0, reason: 'no_eligible_rooms' });
    await jsonl.end();
    return;
  }

  // ── Sample
  const sampled = sampleDeterministic(eligible, args.samplePct, args.seed).slice(0, args.maxRooms);
  jsonl.write('sample_selected', { sampledCount: sampled.length, eligibleCount: eligible.length });
  console.log(`[engage] sampled rooms: ${sampled.length}`);

  // ── Engage each room
  let totalMoves = 0;
  let i = 0;
  for (const room of sampled) {
    if (totalMoves >= args.maxMovesTotal) {
      jsonl.write('global_cap_hit', { totalMoves, maxMovesTotal: args.maxMovesTotal, remaining: sampled.length - i });
      break;
    }
    i += 1;
    process.stdout.write(`[engage] (${i}/${sampled.length}) ${room.debate.id.slice(0, 8)}… initial=${room.moveCount} ... `);
    try {
      const result = await engageRoom({ room, args, jsonl, ctx, bundle, runId });
      totalMoves += result.moves;
      console.log(`+${result.moves} moves (total ${totalMoves})`);
    } catch (err) {
      console.log(`error: ${String(err && err.message).slice(0, 80)}`);
      jsonl.write('room_error', { debateId: room.debate.id, error: String(err && err.message).slice(0, 200) });
    }
  }

  const anthropicUsage = ctx.anthropic.snapshotUsage ? ctx.anthropic.snapshotUsage() : null;
  jsonl.write('run_summary', {
    mode: 'live', runId,
    roomsEligible: eligible.length,
    roomsSampled: sampled.length,
    roomsEngaged: i,
    totalMovesPosted: totalMoves,
    anthropicUsage,
    skillGate,
  });
  await jsonl.end();

  console.log(`[engage] done — ${totalMoves} moves posted across ${i} rooms`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[engage][fatal]', String(err && err.message || err).slice(0, 400));
    process.exitCode = 99;
  });
}

module.exports = { parseArgs, sampleDeterministic, mapAxisForSubmit };
