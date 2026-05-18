#!/usr/bin/env node
/**
 * Stage 6.5 — Open-room engagement runner.
 *
 * Walks the existing dev/test CDiscourse rooms, classifies each one
 * with the deterministic openRoomHeatModel, sorts by heat, and has
 * the bot-revocateur + bot-provocateur skills push the room toward
 * `--target-min-moves..--target-max-moves` total messages.
 *
 * HOT == argumentative friction / activity / unresolved pressure.
 * HOT is NEVER converted to truth credit.
 *
 * Hard rules:
 *   - All posts route through `submit-argument`. No service-role.
 *     No direct insert into `public.arguments`.
 *   - Refuses live mode without `.env.engagement-intelligence` +
 *     ENGAGEMENT_INTEL_ENABLE_ANTHROPIC=true + ANTHROPIC_API_KEY +
 *     `.env.bot-tests` + `--pilot`.
 *   - Never logs API keys, Bearer headers, Authorization headers,
 *     JWTs, raw X handles, raw URLs, raw post IDs, raw emails, or
 *     raw abusive bodies.
 *   - Never targets real users — only dev/test rooms and bot-created
 *     or test-safe rooms.
 */
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const REPO_ROOT = process.cwd();
const REPORT_DIR = path.join(REPO_ROOT, 'docs', 'testing-runs');
const LOG_DIR = path.join(REPO_ROOT, 'logs', 'engagement-intelligence');

const { loadAdversarialSkillBundle, redactedSkillGate } = require('./skillFileLoader');
const { renderEngagementMove } = require('./openRoomEngagementMoveRenderer');
const { classifyOpenRoom } = require('./openRoomHeatModel');
const claudeClient = require('./claudeMessagesClient');
const { loadEnvFiles, buildBotConfig } = require('./loadEnv');
const { createBotClient, signInBot } = require('./supabaseClient');
const { ensureBotUser } = require('./adminOps');
const { buildSubmitArgumentBody, invokeSubmitArgument } = require('./submitMove');

// ── CLI ──────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    dry: true,
    pilot: false,
    maxRooms: 20,
    targetMovesMin: 8,
    targetMovesMax: 12,
    targetCoveragePct: 100,  // pct of eligible rooms to consider before maxRooms cap
    maxMovesPerRoom: 6,
    maxMovesTotal: 200,
    seed: 'open-room-engagement-2026-05-18',
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry') args.dry = true;
    else if (a === '--pilot') { args.pilot = true; args.dry = false; }
    else if (a === '--max-rooms' && argv[i + 1]) args.maxRooms = Math.max(1, Number(argv[++i]) || 20);
    else if (a === '--target-min-moves' && argv[i + 1]) args.targetMovesMin = Math.max(2, Number(argv[++i]) || 8);
    else if (a === '--target-max-moves' && argv[i + 1]) args.targetMovesMax = Math.max(args.targetMovesMin, Number(argv[++i]) || 12);
    else if (a === '--target-coverage' && argv[i + 1]) {
      const raw = Number(argv[++i]);
      // Accept either a decimal (0.10) or a percent (10). Both clamp to [1, 100].
      const pct = raw > 0 && raw <= 1 ? raw * 100 : raw;
      const rounded = Math.round(pct);
      args.targetCoveragePct = Math.max(1, Math.min(100, Number.isFinite(rounded) ? rounded : 10));
    }
    else if (a === '--max-moves-per-room' && argv[i + 1]) args.maxMovesPerRoom = Math.max(1, Number(argv[++i]) || 6);
    else if (a === '--max-moves-total' && argv[i + 1]) args.maxMovesTotal = Math.max(1, Number(argv[++i]) || 200);
    else if (a === '--seed' && argv[i + 1]) args.seed = String(argv[++i]);
  }
  return args;
}

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function seededRng(seedString) {
  let seed = 0;
  for (const ch of String(seedString)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  return function next() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xFFFFFFFF;
  };
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
    console.error(`[open-engage] live setup: ${err.message}`); return null;
  }
  let anthropic;
  try { anthropic = claudeClient.createClient({ pilot: args.pilot, requirePilotFlag: true }); }
  catch (err) { console.error(`[open-engage] anthropic disabled: ${(err && err.reason) || err.message}`); return null; }

  const adminClient = createBotClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
  const adminSession = await signInBot(adminClient, cfg.adminEmail, cfg.adminPassword);
  if (!adminSession) { console.error('[open-engage] admin sign-in failed'); return null; }
  console.log('[open-engage] admin signed in');

  const botByAlias = {};
  const botUserIds = [];
  for (const bot of cfg.bots) {
    try {
      const r = await ensureBotUser(adminClient, {
        label: bot.label, email: bot.email, password: bot.password,
        persona: bot.persona, displayName: bot.label,
      });
      const c = createBotClient(cfg.supabaseUrl, cfg.supabasePublishableKey);
      const s = await signInBot(c, bot.email, bot.password);
      if (!s) { console.error(`[open-engage] bot ${bot.alias} sign-in failed`); return null; }
      botByAlias[bot.alias] = { userId: r.userId, email: bot.email, client: c, label: bot.label };
      botUserIds.push(r.userId);
    } catch (err) {
      console.error(`[open-engage] ensure bot ${bot.alias}: ${(err && err.message) || 'unknown'}`); return null;
    }
  }
  console.log(`[open-engage] ${Object.keys(botByAlias).length} bots signed in`);
  return { cfg, adminClient, botByAlias, botUserIds, anthropic };
}

// ── Room discovery ──────────────────────────────────────────

async function listEligibleRooms(adminClient, args, botUserIds) {
  const { data: debates, error } = await adminClient
    .from('debates')
    .select('id, title, resolution, description, status, constitution_id, created_by, created_at, updated_at')
    .eq('status', 'open')
    .order('updated_at', { ascending: false })
    .limit(500);
  if (error) { console.error(`[open-engage] list debates failed: ${error.message}`); return []; }
  if (!debates || debates.length === 0) return [];

  const ids = debates.map((d) => d.id);
  const { data: rows, error: argErr } = await adminClient
    .from('arguments')
    .select('id, debate_id, parent_id, author_id, argument_type, side, body, status, created_at')
    .in('debate_id', ids)
    .eq('status', 'posted')
    .order('debate_id', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(20000);
  if (argErr) { console.error(`[open-engage] list arguments failed: ${argErr.message}`); return []; }
  const byDebate = new Map();
  for (const r of rows || []) {
    if (!byDebate.has(r.debate_id)) byDebate.set(r.debate_id, []);
    byDebate.get(r.debate_id).push(r);
  }

  const nowMs = Date.now();
  const out = [];
  for (const d of debates) {
    const msgs = byDebate.get(d.id) || [];
    if (msgs.length === 0) continue;       // empty rooms are not engageable
    if (msgs.length >= args.targetMovesMax) continue; // already deep enough
    const hasSynthesis = msgs.some((m) => m.argument_type === 'synthesis');
    if (hasSynthesis) continue;
    const heat = classifyOpenRoom({
      debateId: d.id,
      title: d.title || '',
      messages: msgs,
      botUserIds,
      nowMs,
    });
    if (!heat.safeToPost) continue;
    if (heat.heatBand === 'overheated') continue;
    out.push({ debate: d, messages: msgs.slice(), heat });
  }
  return out;
}

// ── Move generation per room ────────────────────────────────

async function engageRoom({ room, args, jsonl, ctx, bundle, runId }) {
  const debateId = room.debate.id;
  const heat = room.heat;

  jsonl.write('room_selected', {
    debateId,
    heatBand: heat.heatBand,
    heatScore: heat.heatScore,
    reasonCodes: heat.reasonCodes,
    recommendedBot: heat.recommendedBot,
    recommendedAction: heat.recommendedAction,
    moveCount: heat.moveCount,
  });

  const botAliases = Object.keys(ctx.botByAlias);
  if (botAliases.length < 2) {
    jsonl.write('room_skipped', { debateId, reason: 'not_enough_bots' });
    return { moves: 0, postedAxes: [] };
  }

  // Pre-fetch ALL configured bots' existing sides in this debate.
  const allBots = botAliases.map((a) => ctx.botByAlias[a]);
  const allUserIds = allBots.map((b) => b.userId);
  const partSel = await ctx.adminClient
    .from('debate_participants')
    .select('user_id, side')
    .eq('debate_id', debateId)
    .in('user_id', allUserIds);
  const sideByUserId = new Map();
  if (partSel.error) {
    jsonl.write('room_participant_lookup_failed', { debateId, error: String(partSel.error.message).slice(0, 200) });
  } else {
    for (const row of partSel.data || []) sideByUserId.set(row.user_id, row.side);
  }

  // For each bot, compute the side it WOULD post on. Moderator counts as
  // flexible: a moderator may post any side, so we represent it as
  // 'flex'. Bots not yet joined will join with the default we assign.
  function resolveBotSide(bot, defaultSide) {
    const existing = sideByUserId.get(bot.userId);
    if (!existing) return { kind: 'unjoined', value: defaultSide };
    if (existing === 'moderator') return { kind: 'flex', value: 'moderator' };
    return { kind: 'fixed', value: existing };
  }

  // Pick a pair of distinct bots whose effective post-sides will be
  // OPPOSITE (one affirmative, one negative). Returns null if no such
  // pair can be built from the configured bots.
  //
  // Rules:
  //   - kind=fixed:    must post on its committed side.
  //   - kind=flex:     moderator — may post any side.
  //   - kind=unjoined: not yet in the room — joins on the side we pick.
  //
  // Pass 1: a fixed-affirmative + fixed-negative pair (no joins needed).
  // Pass 2: one fixed-side bot + one flex/unjoined bot taking the opposite side.
  // Pass 3: two flex/unjoined bots — they take opposing defaults.
  function chooseSeatPair() {
    const candidates = allBots.map((b, idx) => ({
      bot: b,
      idx,
      side: resolveBotSide(b, idx === 0 ? 'affirmative' : idx === 1 ? 'negative' : 'affirmative'),
    }));
    const fixedAff = candidates.find((c) => c.side.kind === 'fixed' && c.side.value === 'affirmative');
    const fixedNeg = candidates.find((c) => c.side.kind === 'fixed' && c.side.value === 'negative');
    if (fixedAff && fixedNeg) {
      return {
        provo: { ...fixedAff, postSide: 'affirmative' },
        rev: { ...fixedNeg, postSide: 'negative' },
      };
    }
    const anyFixed = fixedAff || fixedNeg || null;
    if (anyFixed) {
      const opp = anyFixed.side.value === 'affirmative' ? 'negative' : 'affirmative';
      const partner = candidates.find((c) => c.idx !== anyFixed.idx && (c.side.kind === 'flex' || c.side.kind === 'unjoined'));
      if (partner) {
        const provo = anyFixed.side.value === 'affirmative'
          ? { ...anyFixed, postSide: 'affirmative' }
          : { ...partner, postSide: opp };
        const rev = anyFixed.side.value === 'affirmative'
          ? { ...partner, postSide: opp }
          : { ...anyFixed, postSide: 'negative' };
        return { provo, rev };
      }
    }
    const flexible = candidates.filter((c) => c.side.kind === 'flex' || c.side.kind === 'unjoined');
    if (flexible.length >= 2) {
      return {
        provo: { ...flexible[0], postSide: 'affirmative' },
        rev: { ...flexible[1], postSide: 'negative' },
      };
    }
    return null;
  }

  const seat = chooseSeatPair();
  if (!seat) {
    jsonl.write('room_skipped', {
      debateId,
      reason: 'no_opposite_side_pair_available',
      knownSides: Array.from(sideByUserId.values()),
    });
    return { moves: 0, postedAxes: [] };
  }
  const provoBot = seat.provo.bot;
  const revBot = seat.rev.bot;
  const sideProvo = seat.provo.postSide;
  const sideRev = seat.rev.postSide;

  // Ensure participants are joined; tolerate dup-key conflicts.
  for (const seatEntry of [seat.provo, seat.rev]) {
    if (seatEntry.side.kind === 'unjoined') {
      const joinSide = seatEntry.postSide;
      const j = await seatEntry.bot.client.from('debate_participants').insert({ debate_id: debateId, user_id: seatEntry.bot.userId, side: joinSide });
      if (j.error && j.error.code !== '23505') {
        jsonl.write('room_join_failed', { debateId, userIdSuffix: seatEntry.bot.userId.slice(-6), error: String(j.error.message).slice(0, 200) });
      }
    }
  }

  jsonl.write('bot_assignment_resolved', {
    debateId,
    provoSide: sideProvo,
    revSide: sideRev,
    provoSeatKind: seat.provo.side.kind,
    revSeatKind: seat.rev.side.kind,
  });

  if (sideProvo === sideRev) {
    // Defensive: chooseSeatPair should prevent this, but log if it slipped.
    jsonl.write('room_skipped', { debateId, reason: 'bots_on_same_side', sideProvo, sideRev });
    return { moves: 0, postedAxes: [] };
  }

  // Pick a target depth in [min, max] deterministically per room.
  const rng = seededRng(`${args.seed}::${debateId}`);
  const targetMoves = args.targetMovesMin + Math.floor(rng() * Math.max(1, args.targetMovesMax - args.targetMovesMin + 1));
  const movesRemaining = Math.max(0, Math.min(targetMoves - heat.moveCount, args.maxMovesPerRoom));
  if (movesRemaining <= 0) {
    jsonl.write('room_summary', { debateId, movesPosted: 0, finalMoveCount: heat.moveCount, targetMoves, reason: 'already_at_or_above_target' });
    return { moves: 0, postedAxes: [] };
  }

  // The first new move is parented to the room's target message (or the
  // latest message if the heat model didn't name a target).
  const sorted = room.messages.slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const target = heat.targetMoveId
    ? sorted.find((m) => m.id === heat.targetMoveId) || sorted[sorted.length - 1]
    : sorted[sorted.length - 1];
  let parentArgumentId = target.id;
  let parentBody = target.body || '';
  let parentArgumentType = target.argument_type || 'thesis';
  let depth = heat.moveCount + 1;
  let posted = 0;
  let consecutiveFailures = 0;
  const postedAxes = [];

  // Whoever the heat model recommended opens; we alternate from there.
  // If recommendedBot is 'either', revocateur opens by convention.
  const firstSeat = heat.recommendedBot === 'bot-provocateur' ? 'bot-provocateur' : 'bot-revocateur';

  jsonl.write('room_engage_start', {
    debateId,
    initialMoveCount: heat.moveCount,
    targetMoves,
    movesPlanned: movesRemaining,
    firstSeat,
  });

  for (let i = 0; i < movesRemaining; i++) {
    const role = i % 2 === 0
      ? firstSeat
      : (firstSeat === 'bot-revocateur' ? 'bot-provocateur' : 'bot-revocateur');
    const bot = role === 'bot-provocateur' ? provoBot : revBot;
    const sideStr = role === 'bot-provocateur' ? sideProvo : sideRev;
    const argumentType = parentArgumentType === 'thesis' ? 'rebuttal'
                       : parentArgumentType === 'rebuttal' ? 'counter_rebuttal'
                       : parentArgumentType === 'counter_rebuttal' ? 'rebuttal'
                       : 'rebuttal';

    // Pull a short verbatim excerpt for the target. submit-argument
    // requires target_excerpt to appear in the parent body, so we slice
    // from the parent body itself.
    const targetExcerpt = String(parentBody || '').slice(0, 90).replace(/\s+/g, ' ').trim();

    const tail = sorted.slice(-5)
      .map((m, idx) => `  prior${idx + 1} (${m.argument_type}): ${(m.body || '').slice(0, 140)}`)
      .join('\n');

    const persona = {
      skillRole: role,
      alias: bot.label || role,
      skillHash: role === 'bot-provocateur' ? bundle.provocateurHash : bundle.revocateurHash,
    };

    const heatContext = {
      heatBand: heat.heatBand,
      heatScore: heat.heatScore,
      reasonCodes: heat.reasonCodes,
      recommendedAction: heat.recommendedAction,
      moveCount: depth - 1,
      recentAxes: postedAxes.slice().reverse(),
    };

    const scene = {
      title: room.debate.title,
      titleRedacted: heat.titleRedacted,
      category: 'open_room_engagement',
      topicBucket: 'open_room',
    };

    jsonl.write('move_prompt_built', {
      debateId,
      depth,
      role,
      promptKind: 'open_room_engagement',
      skillHash: persona.skillHash,
      heatBand: heat.heatBand,
      reasonCodes: heat.reasonCodes,
    });

    const rendered = await renderEngagementMove({
      client: ctx.anthropic,
      scene,
      parent: { argumentType: parentArgumentType, body: parentBody, depth: depth - 1 },
      slot: { argumentType, depth },
      persona,
      skillBundle: bundle,
      conversationSummary: tail,
      heatContext,
      fallbackAxis: 'evidence',
      forceTargetExcerpt: targetExcerpt,
    });
    const effectiveAxis = rendered.chosenAxis || 'evidence';

    jsonl.write('move_rendered', {
      debateId, depth, role,
      source: rendered.source,
      attempts: rendered.attempts,
      jsonParsed: rendered.jsonParsed,
      validationFailureReason: rendered.validationFailureReason,
      chosenAxis: rendered.chosenAxis,
      mechanism: rendered.mechanism,
      axisRepeatHit: !!rendered.axisRepeatHit,
      skillHash: rendered.skillHash,
    });

    jsonl.write('move_validated', {
      debateId, depth, role,
      validated: rendered.source === 'anthropic' || rendered.source === 'deterministic_fallback',
      validationFailureReason: rendered.validationFailureReason,
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

    jsonl.write('submit_attempt', { debateId, depth, role });

    const submitRes = await invokeSubmitArgument(bot.client, submitBody);

    if (!submitRes.ok) {
      jsonl.write('submit_result', {
        debateId, depth, role, status: 'rejected',
        httpStatus: submitRes.status, errorCode: submitRes.error?.error || null,
        detail: typeof submitRes.detail === 'string' ? submitRes.detail.slice(0, 200) : null,
      });
      consecutiveFailures += 1;
      if (consecutiveFailures >= 3) {
        jsonl.write('room_stop', { debateId, reason: 'three_in_a_row_failures', posted });
        break;
      }
      continue;
    }
    consecutiveFailures = 0;
    const argumentId = submitRes.data?.argument?.id || submitRes.data?.id || null;
    jsonl.write('submit_result', { debateId, depth, role, status: 'posted', argumentId, axis: effectiveAxis });
    jsonl.write('room_heat_update', {
      debateId,
      depth,
      addedAxis: effectiveAxis,
      postedAxesAfter: [...postedAxes, effectiveAxis],
    });
    posted += 1;
    postedAxes.push(effectiveAxis);
    parentArgumentId = argumentId;
    parentBody = rendered.body;
    parentArgumentType = argumentType;
    sorted.push({
      id: argumentId,
      parent_id: submitBody.parent_id,
      author_id: bot.userId,
      argument_type: argumentType,
      side: sideStr,
      body: rendered.body,
      status: 'posted',
      created_at: new Date().toISOString(),
    });
    depth += 1;

    if (/(\bi concede\b|\bi grant\b|\bi acknowledge\b|fair point|that point is valid)/i.test(rendered.body)) {
      jsonl.write('room_stop', { debateId, reason: 'concession_marker_detected', posted });
      break;
    }
  }

  // Re-classify post-engagement to capture the band transition.
  const finalHeat = classifyOpenRoom({
    debateId,
    title: room.debate.title || '',
    messages: sorted,
    botUserIds: ctx.botUserIds,
    nowMs: Date.now(),
  });
  jsonl.write('room_summary', {
    debateId,
    initialMoveCount: heat.moveCount,
    movesPosted: posted,
    finalMoveCount: heat.moveCount + posted,
    targetMoves,
    initialHeatBand: heat.heatBand,
    finalHeatBand: finalHeat.heatBand,
    postedAxes,
  });
  return { moves: posted, postedAxes, initialBand: heat.heatBand, finalBand: finalHeat.heatBand };
}

// ── Markdown summary ────────────────────────────────────────

function bandTransitionLabel(initial, final) {
  if (initial === final) return `same (${initial})`;
  return `${initial} → ${final}`;
}

function writeMarkdownSummary({ reportPath, runId, args, bools, bundleGate, totals, rooms }) {
  const date = new Date().toISOString().slice(0, 10);
  const lines = [];
  lines.push(`# Open-Room Engagement Summary — ${date}`);
  lines.push('');
  lines.push(`Run id: \`${runId}\``);
  lines.push(`Mode: \`${args.dry ? 'dry' : 'live'}\``);
  lines.push(`Target moves per room: ${args.targetMovesMin}-${args.targetMovesMax}`);
  lines.push(`Max rooms: ${args.maxRooms}    Max moves total: ${args.maxMovesTotal}    Max moves per room: ${args.maxMovesPerRoom}`);
  lines.push('');
  lines.push('## Skill gate');
  lines.push('');
  lines.push(`- provocateur hash: \`${bundleGate.provocateurHash}\`    bytes: ${bundleGate.provocateurBytes}`);
  lines.push(`- revocateur hash:  \`${bundleGate.revocateurHash}\`    bytes: ${bundleGate.revocateurBytes}`);
  lines.push(`- validated:        ${bundleGate.validated ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('## Doctrine');
  lines.push('');
  lines.push('- HOT == argumentative friction / activity / unresolved pressure.');
  lines.push('- HOT is **never** converted to truth credit. Popularity is not evidence.');
  lines.push('- All posts route through `submit-argument`. No service-role. No direct insert.');
  lines.push('');
  lines.push('## Totals');
  lines.push('');
  lines.push(`- rooms classified: ${totals.eligibleCount}`);
  lines.push(`- rooms engaged:    ${totals.roomsEngaged}`);
  lines.push(`- moves posted:     ${totals.totalMoves}`);
  lines.push(`- rooms with band transition: ${totals.bandTransitions.length}`);
  if (totals.anthropicUsage) {
    const u = totals.anthropicUsage;
    lines.push(`- anthropic usage:  calls=${u.calls || 0}  inputTokens=${u.inputTokens || 0}  outputTokens=${u.outputTokens || 0}`);
  }
  lines.push('');
  lines.push('## Heat band transitions');
  lines.push('');
  if (totals.bandTransitions.length === 0) {
    lines.push('_No room changed heat band during this run._');
  } else {
    for (const t of totals.bandTransitions) {
      lines.push(`- \`${t.debateId.slice(0, 8)}…\` ${bandTransitionLabel(t.initialBand, t.finalBand)} (+${t.movesPosted} moves)`);
    }
  }
  lines.push('');
  lines.push('## Reason-code coverage');
  lines.push('');
  const reasonCounts = totals.reasonCodeCounts;
  const keys = Object.keys(reasonCounts).sort();
  if (keys.length === 0) {
    lines.push('_No reason codes recorded._');
  } else {
    for (const k of keys) lines.push(`- \`${k}\`: ${reasonCounts[k]} room(s)`);
  }
  lines.push('');
  lines.push('## Axis usage (posted moves only)');
  lines.push('');
  const axisCounts = totals.axisCounts;
  const axisKeys = Object.keys(axisCounts).sort();
  if (axisKeys.length === 0) {
    lines.push('_No moves posted._');
  } else {
    for (const k of axisKeys) lines.push(`- \`${k}\`: ${axisCounts[k]} move(s)`);
  }
  lines.push('');
  lines.push('## Per-room detail');
  lines.push('');
  for (const r of rooms) {
    lines.push(`### \`${r.debateId.slice(0, 8)}…\``);
    lines.push(`- heat band: ${bandTransitionLabel(r.initialBand, r.finalBand)}    score: ${r.heatScore}`);
    lines.push(`- reason codes: ${r.reasonCodes.length ? r.reasonCodes.join(', ') : '(none)'}`);
    lines.push(`- recommended bot/action: ${r.recommendedBot} / ${r.recommendedAction}`);
    lines.push(`- moves posted: ${r.movesPosted}    posted axes (in order): ${r.postedAxes.join(', ') || '(none)'}`);
    if (r.rejectionDetails && r.rejectionDetails.length) {
      lines.push(`- rejections (first ${Math.min(3, r.rejectionDetails.length)}): ${r.rejectionDetails.slice(0, 3).join(' | ')}`);
    }
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push('JSONL log path is gitignored under `logs/engagement-intelligence/`.');
  lines.push('');
  ensureDir(path.dirname(reportPath));
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);
  const bools = envBooleans();
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  console.log(`[open-engage] mode=${args.dry ? 'dry' : 'live'} maxRooms=${args.maxRooms} target=${args.targetMovesMin}-${args.targetMovesMax} coveragePct=${args.targetCoveragePct}`);
  console.log(`[open-engage] env: ${JSON.stringify(bools)}`);

  let bundle;
  try { bundle = loadAdversarialSkillBundle(); }
  catch (err) { console.error(`[open-engage] SKILL GATE FAILED: ${err.message}`); process.exitCode = 2; return; }
  console.log(`[open-engage] skill gate OK · provocateur=${bundle.provocateurHash} · revocateur=${bundle.revocateurHash}`);

  if (!args.dry) {
    const refusals = refuseLive(args, bools);
    if (refusals.length > 0) { console.error(`[open-engage] refusing live: ${refusals.join('; ')}`); process.exitCode = 2; return; }
  }

  ensureDir(LOG_DIR); ensureDir(REPORT_DIR);
  const jsonlPath = path.join(LOG_DIR, `${runId}-open-room-engagement.jsonl`);
  const skillGate = redactedSkillGate(bundle, true);
  const jsonl = new JsonlStream(jsonlPath, runId, skillGate);
  console.log(`[open-engage] jsonl: ${path.relative(REPO_ROOT, jsonlPath)} (gitignored)`);

  jsonl.write('run_start', { runId, args, envBooleans: bools });
  jsonl.write('skill_validation', { skillGate });

  if (args.dry) {
    console.log('[open-engage] dry mode — no Anthropic / Supabase calls; producing setup-only JSONL.');
    jsonl.write('run_summary', { mode: 'dry', rooms: 0, moves: 0 });
    await jsonl.end();
    // Still write a minimal markdown so the report path is predictable.
    const reportPath = path.join(REPORT_DIR, `${new Date().toISOString().slice(0, 10)}-open-room-engagement-summary.md`);
    writeMarkdownSummary({
      reportPath, runId, args, bools, bundleGate: skillGate,
      totals: { eligibleCount: 0, roomsEngaged: 0, totalMoves: 0, bandTransitions: [], reasonCodeCounts: {}, axisCounts: {}, anthropicUsage: null },
      rooms: [],
    });
    console.log(`[open-engage] dry md: ${path.relative(REPO_ROOT, reportPath)}`);
    return;
  }

  const ctx = await setupLive(args);
  if (!ctx) { jsonl.write('run_summary', { mode: 'live', error: 'setup_failed' }); await jsonl.end(); process.exitCode = 3; return; }

  // Discover + classify
  const eligible = await listEligibleRooms(ctx.adminClient, args, ctx.botUserIds);
  for (const r of eligible) {
    jsonl.write('room_candidate', {
      debateId: r.debate.id,
      heatBand: r.heat.heatBand,
      heatScore: r.heat.heatScore,
      reasonCodes: r.heat.reasonCodes,
      recommendedBot: r.heat.recommendedBot,
      recommendedAction: r.heat.recommendedAction,
    });
  }
  jsonl.write('room_scan', { eligibleCount: eligible.length });
  console.log(`[open-engage] eligible rooms: ${eligible.length}`);
  if (eligible.length === 0) {
    jsonl.write('run_summary', { mode: 'live', rooms: 0, moves: 0, reason: 'no_eligible_rooms' });
    await jsonl.end();
    return;
  }

  // Sort by descending heat among engageable rooms (already filtered).
  eligible.sort((a, b) => b.heat.heatScore - a.heat.heatScore);

  // Coverage cap: take top `coveragePct%` of eligible rooms, then cap by maxRooms.
  const coverageTarget = Math.max(1, Math.round((args.targetCoveragePct / 100) * eligible.length));
  const sliced = eligible.slice(0, Math.min(coverageTarget, args.maxRooms));
  console.log(`[open-engage] selected rooms: ${sliced.length} (coverage=${args.targetCoveragePct}%, maxRooms=${args.maxRooms})`);
  for (const r of sliced) {
    jsonl.write('bot_assignment', {
      debateId: r.debate.id,
      recommendedBot: r.heat.recommendedBot,
      recommendedAction: r.heat.recommendedAction,
    });
  }

  // Engage each room
  let totalMoves = 0;
  let i = 0;
  const reasonCodeCounts = {};
  const axisCounts = {};
  const bandTransitions = [];
  const roomDetail = [];
  for (const room of sliced) {
    if (totalMoves >= args.maxMovesTotal) {
      jsonl.write('global_cap_hit', { totalMoves, maxMovesTotal: args.maxMovesTotal, remaining: sliced.length - i });
      break;
    }
    i += 1;
    process.stdout.write(`[open-engage] (${i}/${sliced.length}) ${room.debate.id.slice(0, 8)}… band=${room.heat.heatBand} score=${room.heat.heatScore} ... `);
    let result;
    try {
      result = await engageRoom({ room, args, jsonl, ctx, bundle, runId });
    } catch (err) {
      console.log(`error: ${String(err && err.message).slice(0, 80)}`);
      jsonl.write('room_error', { debateId: room.debate.id, error: String(err && err.message).slice(0, 200) });
      continue;
    }
    totalMoves += result.moves;
    for (const r of room.heat.reasonCodes) reasonCodeCounts[r] = (reasonCodeCounts[r] || 0) + 1;
    for (const a of result.postedAxes) axisCounts[a] = (axisCounts[a] || 0) + 1;
    if (result.initialBand && result.finalBand && result.initialBand !== result.finalBand) {
      bandTransitions.push({ debateId: room.debate.id, initialBand: result.initialBand, finalBand: result.finalBand, movesPosted: result.moves });
    }
    roomDetail.push({
      debateId: room.debate.id,
      initialBand: result.initialBand || room.heat.heatBand,
      finalBand: result.finalBand || room.heat.heatBand,
      heatScore: room.heat.heatScore,
      reasonCodes: room.heat.reasonCodes,
      recommendedBot: room.heat.recommendedBot,
      recommendedAction: room.heat.recommendedAction,
      movesPosted: result.moves,
      postedAxes: result.postedAxes,
    });
    console.log(`+${result.moves} moves (total ${totalMoves})`);
  }

  const anthropicUsage = ctx.anthropic && ctx.anthropic.snapshotUsage ? ctx.anthropic.snapshotUsage() : null;
  jsonl.write('run_summary', {
    mode: 'live', runId,
    roomsEligible: eligible.length,
    roomsSelected: sliced.length,
    roomsEngaged: i,
    totalMovesPosted: totalMoves,
    reasonCodeCounts,
    axisCounts,
    bandTransitions,
    anthropicUsage,
    skillGate,
  });
  await jsonl.end();

  const reportPath = path.join(REPORT_DIR, `${new Date().toISOString().slice(0, 10)}-open-room-engagement-summary.md`);
  writeMarkdownSummary({
    reportPath, runId, args, bools, bundleGate: skillGate,
    totals: {
      eligibleCount: eligible.length, roomsEngaged: i, totalMoves,
      bandTransitions, reasonCodeCounts, axisCounts, anthropicUsage,
    },
    rooms: roomDetail,
  });
  console.log(`[open-engage] md:    ${path.relative(REPO_ROOT, reportPath)}`);
  console.log(`[open-engage] done — ${totalMoves} moves posted across ${i} rooms`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[open-engage][fatal]', String(err && err.message || err).slice(0, 400));
    process.exitCode = 99;
  });
}

module.exports = {
  parseArgs,
  mapAxisForSubmit,
  envBooleans,
  refuseLive,
};
