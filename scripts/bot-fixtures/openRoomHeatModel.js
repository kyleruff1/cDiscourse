/**
 * Open-room HOT model — pure deterministic classifier.
 *
 * HOT = activity / friction / unresolved argumentative pressure.
 * HOT ≠ popularity, virality, truth-credit, or abuse. Engagement is
 * never converted to factual standing. Abusive content does NOT raise
 * desired heat — it marks `overheated` for skip, separate from "hot".
 *
 * Pure CommonJS. No network. No filesystem.
 */

const HEAT_REASON_CODES = [
  'no_rebuttal',
  'unreplied_latest',
  'source_chain_debt',
  'evidence_debt',
  'scope_fight',
  'definition_fight',
  'logic_fight',
  'causal_fight',
  'recent_activity',
  'stale_but_promising',
  'max_depth_unresolved',
  'needs_concession_or_synthesis',
];

const RECOMMENDED_ACTIONS = [
  'first_rebuttal',
  'source_chain_pressure',
  'ask_quote',
  'narrow_scope',
  'countermechanism',
  'defend_root',
  'concede_narrow',
  'synthesis_attempt',
  'branch_recommendation',
];

const HEAT_BANDS = ['quiet', 'warming', 'hot', 'overheated'];

/**
 * Normalise the message list passed in by the runner. Tolerates the
 * shape used by `engageExistingRooms.js` (snake_case from the DB) as
 * well as the camelCase shape used by the gallery.
 */
function normaliseMessage(m) {
  return {
    id: m.id,
    parentId: m.parent_id ?? m.parentId ?? null,
    authorId: m.author_id ?? m.authorId ?? null,
    argumentType: m.argument_type ?? m.argumentType ?? null,
    side: m.side ?? null,
    body: m.body ?? '',
    status: m.status ?? 'posted',
    createdAt: m.created_at ?? m.createdAt ?? null,
  };
}

function safeMs(t) {
  if (!t) return 0;
  const ms = new Date(t).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function tail(s, n = 96) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  return t.slice(0, Math.max(1, n - 1)) + '…';
}

function redactTitle(title) {
  if (!title) return '';
  // Defence-in-depth: strip @handles, x-links, raw post ids, emails.
  let s = String(title);
  s = s.replace(/@[A-Za-z0-9_]{1,15}\b/g, '<x-handle>');
  s = s.replace(/https?:\/\/(?:x|twitter)\.com\/[^\s)]+/gi, '<x-link>');
  s = s.replace(/https?:\/\/t\.co\/[^\s)]+/gi, '<x-link>');
  s = s.replace(/\b\d{15,20}\b/g, '<x-id>');
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<email>');
  return s.trim();
}

const HOSTILE_TOKENS = [
  '<threat>', '<doxx>', '<sexual-abuse>', '<protected-class-attack>',
  '<slur>', 'kill yourself', 'should be killed',
];

function looksAbusive(body) {
  const lc = String(body || '').toLowerCase();
  return HOSTILE_TOKENS.some((t) => lc.includes(t));
}

/**
 * Classify a room. Inputs:
 *   - debateId (string)
 *   - title (string, may contain corpus suffixes; redacted internally)
 *   - messages (array; snake_case or camelCase tolerated)
 *   - currentUserId (string|null) — the viewer/bot for "safeToPost"
 *   - botUserIds (array<string>) — user ids that are known dev bots, for botParticipantCount
 *   - nowMs (number) — injected for deterministic tests; defaults to Date.now()
 *
 * Output: the schema described in the spec.
 */
function classifyOpenRoom(input) {
  const debateId = input.debateId;
  const title = input.title || '';
  const rawMessages = Array.isArray(input.messages) ? input.messages : [];
  const messages = rawMessages.map(normaliseMessage).filter((m) => m.status !== 'deleted');
  const botUserIds = new Set(input.botUserIds || []);
  const nowMs = typeof input.nowMs === 'number' ? input.nowMs : Date.now();

  const sorted = messages.slice().sort((a, b) => safeMs(a.createdAt) - safeMs(b.createdAt));
  const moveCount = sorted.length;
  const root = sorted[0] || null;
  const latest = sorted[sorted.length - 1] || null;
  const lastActivityAt = latest ? latest.createdAt : null;
  const ageMs = lastActivityAt ? Math.max(0, nowMs - safeMs(lastActivityAt)) : Infinity;

  const participants = new Set();
  let bots = 0;
  for (const m of sorted) {
    if (m.authorId) {
      participants.add(m.authorId);
      if (botUserIds.has(m.authorId)) bots += 1;
    }
  }
  const uniqueParticipantCount = participants.size;
  const botParticipantCount = bots;

  // ── Empty room → not engageable for rebuttal.
  if (moveCount === 0) {
    return {
      roomId: debateId,
      titleRedacted: tail(redactTitle(title), 140),
      moveCount: 0,
      heatBand: 'quiet',
      heatScore: 0,
      reasonCodes: [],
      recommendedBot: 'either',
      recommendedAction: null,
      targetMoveId: null,
      targetExcerpt: null,
      safeToPost: false,
      ineligibleReason: 'empty_room',
      uniqueParticipantCount: 0,
      botParticipantCount: 0,
      lastActivityAt: null,
    };
  }

  // ── Axis hits per latest message (cheap lexical signal — never used to
  //    score truth; only used to pick the next move axis).
  const lcLatestBody = (latest?.body || '').toLowerCase();
  const lcRootBody = (root?.body || '').toLowerCase();
  const sourceChainSignal = /quote the source|cite the|primary source|source-chain|where is this from|show your work|receipt/i.test(lcLatestBody) ||
    /quote the source|cite the|primary source/i.test(lcRootBody);
  const evidenceSignal = /\bevidence\b|\bdata\b|\bstudy\b|\bnumbers\b|\breceipts?\b|\baudit\b/i.test(lcLatestBody);
  const scopeSignal = /\bscope\b|\bgeneraliz|\boverstate|\bonly some\b|\bedge case\b|\bcomprehensive\b/i.test(lcLatestBody);
  const definitionSignal = /\bdefine\b|\bdefinition\b|\bwhat (do you )?mean\b|\bwhat counts as\b|terminology/i.test(lcLatestBody);
  const causalSignal = /\bcause\b|\bbecause\b|\bmechanism\b|\bhow does\b|\bwhy would\b|\bcorrelation\b/i.test(lcLatestBody);
  const logicSignal = /\bfallacy\b|\bnon[\s-]sequitur\b|\bcontradict\b|\bif\b.*\bthen\b|\bpremise\b/i.test(lcLatestBody);
  const askQuoteSignal = /quote the (exact|line|sentence|page)|point to the sentence|highlight the bit/i.test(lcLatestBody);

  const rebuttalCount = sorted.filter((m) =>
    m.argumentType === 'rebuttal' || m.argumentType === 'counter_rebuttal'
  ).length;
  const evidenceMoves = sorted.filter((m) => m.argumentType === 'evidence').length;
  const concessionCount = sorted.filter((m) => m.argumentType === 'concession').length;
  const synthesisCount = sorted.filter((m) => m.argumentType === 'synthesis').length;

  // Latest unreplied: nobody has posted a child of `latest`.
  const latestHasChild = sorted.some((m) => m.parentId === latest?.id);
  const unrepliedLatest = !latestHasChild && moveCount > 1;
  const noRebuttal = rebuttalCount === 0;

  // Recency.
  const recentActivity = ageMs <= 6 * 60 * 60 * 1000;            // < 6h
  const staleButPromising = ageMs > 24 * 60 * 60 * 1000 && rebuttalCount >= 1;

  // Max-depth unresolved.
  const maxDepthUnresolved = moveCount >= 10 && synthesisCount === 0 && concessionCount === 0;

  // Abusive content → overheated, skip.
  const abusiveLatest = looksAbusive(latest?.body);

  // ── Reason codes.
  const reasonCodes = [];
  if (noRebuttal) reasonCodes.push('no_rebuttal');
  if (unrepliedLatest) reasonCodes.push('unreplied_latest');
  if (sourceChainSignal || askQuoteSignal) reasonCodes.push('source_chain_debt');
  if (evidenceSignal || evidenceMoves >= 1) reasonCodes.push('evidence_debt');
  if (scopeSignal) reasonCodes.push('scope_fight');
  if (definitionSignal) reasonCodes.push('definition_fight');
  if (logicSignal) reasonCodes.push('logic_fight');
  if (causalSignal) reasonCodes.push('causal_fight');
  if (recentActivity) reasonCodes.push('recent_activity');
  if (staleButPromising) reasonCodes.push('stale_but_promising');
  if (maxDepthUnresolved) reasonCodes.push('max_depth_unresolved');
  if (moveCount >= 8 && rebuttalCount >= 2 && synthesisCount === 0) reasonCodes.push('needs_concession_or_synthesis');

  // ── Heat score (0..100). Friction signals, NOT popularity.
  let score = 0;
  if (noRebuttal) score += 18;                 // unreplied root is high-priority entry, scored as friction-readable
  if (unrepliedLatest) score += 8;
  if (reasonCodes.includes('source_chain_debt')) score += 14;
  if (reasonCodes.includes('evidence_debt')) score += 10;
  if (reasonCodes.includes('scope_fight')) score += 8;
  if (reasonCodes.includes('definition_fight')) score += 8;
  if (reasonCodes.includes('causal_fight')) score += 8;
  if (reasonCodes.includes('logic_fight')) score += 6;
  if (rebuttalCount >= 2) score += 8;
  if (rebuttalCount >= 4) score += 6;
  if (recentActivity) score += 8;
  if (maxDepthUnresolved) score += 6;
  // Multiple unique non-bot participants modestly raise score; bot-only
  // back-and-forth does not pump heat.
  const humanParticipants = Math.max(0, uniqueParticipantCount - botParticipantCount);
  if (humanParticipants >= 2) score += 8;
  if (humanParticipants >= 3) score += 4;
  score = Math.max(0, Math.min(100, score));

  // ── Band mapping.
  let heatBand = 'quiet';
  if (score >= 60) heatBand = 'hot';
  else if (score >= 30) heatBand = 'warming';

  // Abusive latest → overheated overrides whatever band score gave.
  if (abusiveLatest) heatBand = 'overheated';

  // ── Recommended bot + action.
  let recommendedBot = 'either';
  let recommendedAction = null;
  let targetMoveId = latest?.id ?? null;
  let targetExcerpt = tail(latest?.body, 120);

  if (noRebuttal && root) {
    recommendedBot = 'bot-revocateur';
    recommendedAction = 'first_rebuttal';
    targetMoveId = root.id;
    targetExcerpt = tail(root.body, 120);
  } else if (reasonCodes.includes('source_chain_debt')) {
    recommendedBot = 'bot-revocateur';
    recommendedAction = 'source_chain_pressure';
  } else if (reasonCodes.includes('evidence_debt')) {
    recommendedBot = 'bot-revocateur';
    recommendedAction = 'ask_quote';
  } else if (reasonCodes.includes('definition_fight')) {
    recommendedBot = 'either';
    recommendedAction = 'narrow_scope';
  } else if (reasonCodes.includes('scope_fight')) {
    recommendedBot = 'either';
    recommendedAction = 'narrow_scope';
  } else if (reasonCodes.includes('causal_fight')) {
    recommendedBot = 'bot-revocateur';
    recommendedAction = 'countermechanism';
  } else if (reasonCodes.includes('logic_fight')) {
    recommendedBot = 'bot-provocateur';
    recommendedAction = 'defend_root';
  } else if (reasonCodes.includes('max_depth_unresolved') || reasonCodes.includes('needs_concession_or_synthesis')) {
    recommendedBot = 'either';
    recommendedAction = 'synthesis_attempt';
  } else if (rebuttalCount >= 1) {
    // Default to alternating: latest author dictates the other bot.
    if (botUserIds.has(latest?.authorId)) {
      // Last move was bot — let the opposite skill push.
      recommendedBot = (latest?.argumentType === 'rebuttal' || latest?.argumentType === 'counter_rebuttal') ? 'bot-provocateur' : 'bot-revocateur';
    } else {
      recommendedBot = 'bot-revocateur';
    }
    recommendedAction = 'countermechanism';
  } else {
    recommendedBot = 'bot-revocateur';
    recommendedAction = 'first_rebuttal';
  }

  const safeToPost = !abusiveLatest && moveCount >= 1;

  return {
    roomId: debateId,
    titleRedacted: tail(redactTitle(title), 140),
    moveCount,
    heatBand,
    heatScore: score,
    reasonCodes,
    recommendedBot,
    recommendedAction,
    targetMoveId,
    targetExcerpt,
    safeToPost,
    uniqueParticipantCount,
    botParticipantCount,
    lastActivityAt,
    ineligibleReason: safeToPost ? null : (abusiveLatest ? 'abusive_latest' : 'unknown'),
  };
}

/**
 * Convenience: classify a list of rooms and sort by descending heat
 * score among engageable rooms. Skips empty rooms entirely.
 */
function classifyRoomList(rooms, options = {}) {
  const out = [];
  for (const room of rooms) {
    const c = classifyOpenRoom({ ...room, ...options });
    out.push(c);
  }
  return out.sort((a, b) => {
    if (!a.safeToPost && b.safeToPost) return 1;
    if (a.safeToPost && !b.safeToPost) return -1;
    return b.heatScore - a.heatScore;
  });
}

module.exports = {
  classifyOpenRoom,
  classifyRoomList,
  HEAT_REASON_CODES,
  RECOMMENDED_ACTIONS,
  HEAT_BANDS,
  // Internal helpers exported for tests.
  redactTitle,
  looksAbusive,
};
