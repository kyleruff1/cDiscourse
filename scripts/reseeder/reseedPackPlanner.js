/**
 * RESEED-001 — deterministic pack planner.
 *
 * Turns bank records into an engine-valid move plan (thread structure, voice /
 * spine rotation, maneuver grammar). Every emitted move passes
 * `isEngineValidMove` (the SAME evaluateArgumentDraft the Edge runs) BEFORE it
 * is emitted; a move that would be rejected is never emitted (`rejectedTemplates`
 * counts pre-check rejections and MUST be 0 for the 6 built-in packs).
 *
 * Determinism: ALL randomness comes from a seeded Mulberry32 keyed by
 * `hash(runId + '::' + seed + '::' + scenarioId + '::' + moveIndex)` (reusing
 * `stressScenarioTemplates.seededRng`). No wall-clock and no unseeded RNG are
 * used anywhere in this module or the renderer (asserted by source-scan for the
 * banned tokens).
 *
 * Voice rotation is PER THREAD, not per account: the 3-bot pool is fixed, but
 * the voice a bot uses changes thread to thread —
 *   voiceId = VOICES[hash(runId + seed + threadIndex) % VOICES.length].
 *
 * Attribution field set stamped on every move (non-zero from move 1):
 *   seedId, threadIndex, spineId, voiceId, bankName, optionIndex.
 *
 * CommonJS / pure (no network, no Supabase, no Anthropic). Uses the engine
 * pre-check (which loads the pure engine via the typescript compiler).
 */

const { seededRng, pickTargetExcerpt } = require('../bot-fixtures/stressScenarioTemplates');
const { RESEED_PACKS, RESEED_PACK_NAMES } = require('./reseedPacks');
const { renderNoProvider } = require('./reseedMoveRenderer');
const { isEngineValidMove } = require('./reseedEnginePrecheck');
const { tokenSetJaccard, NEAR_VERBATIM_THRESHOLD } = require('./reseedJaccard');

// Fixed 3-bot voice pool. Voice != account; the same bot rotates voices per
// thread. These are rhetorical-register labels only (no persona identity leak).
const VOICES = ['direct', 'measured', 'probing'];

// Disagreement-axis tags used to keep rebuttal/counter_rebuttal clean (these
// satisfy C-RAIL-002 advisory). Chosen deterministically per move.
const AXIS_TAGS = [
  'fact_disagreement',
  'scope_challenge',
  'causal_disagreement',
  'definition_disagreement',
];

// Simple 32-bit string hash (FNV-1a) → non-negative int. Deterministic.
function hashInt(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function rngFor(runId, seed, scenarioId, moveIndex) {
  return seededRng(`${runId}::${seed}::${scenarioId}::${moveIndex}`);
}

function voiceForThread(runId, seed, threadIndex) {
  return VOICES[hashInt(`${runId}::${seed}::voice::${threadIndex}`) % VOICES.length];
}

function spineForThread(pack, runId, seed, threadIndex) {
  const mix = pack.spineMix && pack.spineMix.length > 0 ? pack.spineMix : ['objection'];
  return mix[hashInt(`${runId}::${seed}::spine::${threadIndex}`) % mix.length];
}

function pickAxis(runId, seed, scenarioId, moveIndex) {
  return AXIS_TAGS[hashInt(`${runId}::${seed}::axis::${scenarioId}::${moveIndex}`) % AXIS_TAGS.length];
}

function inRange(rng, [min, max]) {
  if (max <= min) return min;
  return min + Math.floor(rng() * (max - min + 1));
}

/**
 * Build one move object (planned + rendered body + engine verdict).
 * Returns { move } on success, or { rejected: true } if the engine pre-check
 * rejects (so the caller can count and skip — should not happen for built-ins).
 */
function buildMove(params) {
  const {
    runId, seed, scenario, threadIndex, moveIndex, moveId, parentMoveId,
    argumentType, parentType, parentBody, spineId, voiceId, seedRecord,
    attachEvidence, forcedBody,
  } = params;

  const rng = rngFor(runId, seed, scenario.scenarioId, moveIndex);

  // Reply moves carry a verbatim targetExcerpt pulled from the immediate
  // parent body (passes C-RAIL-001 responsiveness immediately).
  let targetExcerpt = null;
  if (parentType != null && parentBody) {
    targetExcerpt = pickTargetExcerpt(parentBody, { resolutionKeywords: keywordsFor(seedRecord, scenario) });
    // pickTargetExcerpt returns a verbatim substring of parentBody.
  }

  // Disagreement axis on rebuttal/counter_rebuttal (advisory tidy).
  const selectedTagCodes = [];
  let disagreementAxis;
  if (argumentType === 'rebuttal' || argumentType === 'counter_rebuttal') {
    disagreementAxis = pickAxis(runId, seed, scenario.scenarioId, moveIndex);
    selectedTagCodes.push(disagreementAxis);
  }

  // Evidence moves attach a source (C-EVIDENCE-001).
  let attachedEvidence = [];
  if (argumentType === 'evidence' && attachEvidence) {
    attachedEvidence = [{ sourceText: buildEvidenceSourceText(seedRecord) }];
  }

  const partialMove = {
    argumentType,
    parentType: parentType == null ? null : parentType,
    parentBody: parentBody || null,
    targetExcerpt,
    disagreementAxis,
    spineId,
    selectedTagCodes,
    attachedEvidence,
    resolution: scenario.resolution,
    description: scenario.description || '',
    side: scenario.side || 'affirmative',
  };

  // Render the body (deterministic) unless a forced body was supplied
  // (used by the archive-cluster near-verbatim siblings). Render ONCE so the
  // reported optionIndex matches the body actually used and the rng advances
  // a single step per move.
  const rendered =
    typeof forcedBody === 'string'
      ? { body: forcedBody, optionIndex: 0 }
      : renderNoProvider(partialMove, seedRecord, rng);
  const body = rendered.body;
  const optionIndex = rendered.optionIndex;

  const candidate = { ...partialMove, body };

  const verdict = isEngineValidMove(candidate);
  if (!verdict.valid) {
    return { rejected: true, blockingCodes: verdict.blockingCodes };
  }

  return {
    move: {
      moveId,
      parentMoveId: parentMoveId || null,
      argumentType,
      parentType: parentType == null ? null : parentType,
      body,
      targetExcerpt,
      disagreementAxis: disagreementAxis || null,
      selectedTagCodes,
      attachedEvidence,
      // Attribution — non-zero from move 1.
      seedId: seedRecord.bankName,
      threadIndex,
      spineId,
      voiceId,
      bankName: seedRecord.bankName,
      optionIndex,
      engineValid: true,
    },
  };
}

function keywordsFor(seedRecord, scenario) {
  // Keywords used to anchor the targetExcerpt. Derive from topic + resolution.
  const words = new Set();
  const src = `${(seedRecord && seedRecord.topic) || ''} ${scenario.resolution || ''}`;
  for (const w of src.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)) {
    if (w.length >= 4) words.add(w);
  }
  return [...words].slice(0, 8);
}

function buildEvidenceSourceText(seedRecord) {
  const topic = (seedRecord && seedRecord.topic) || 'the topic';
  // Deterministic, license-safe source-text stub (never a raw args.me URL).
  return `Reference material on ${topic} (dev/test source stub).`;
}

// ── Pack shape builders ────────────────────────────────────────────

function planChain(pack, ctx) {
  const { runId, seed, scenario, threadIndex, seedRecord, spineId, voiceId } = ctx;
  const moves = [];
  let rejected = 0;
  let moveIndex = 0;

  // Root thesis.
  const root = buildMove({
    runId, seed, scenario, threadIndex, moveIndex,
    moveId: `t${threadIndex}-m0`, parentMoveId: null,
    argumentType: pack.root, parentType: null, parentBody: null,
    spineId, voiceId, seedRecord, attachEvidence: false,
  });
  if (root.rejected) return { moves, rejected: rejected + 1 };
  moves.push(root.move);

  let parentMove = root.move;
  for (let i = 0; i < pack.linear.length; i++) {
    moveIndex += 1;
    const argType = pack.linear[i];
    const built = buildMove({
      runId, seed, scenario, threadIndex, moveIndex,
      moveId: `t${threadIndex}-m${moveIndex}`, parentMoveId: parentMove.moveId,
      argumentType: argType, parentType: parentMove.argumentType, parentBody: parentMove.body,
      spineId, voiceId, seedRecord,
      attachEvidence: pack.evidenceEverywhere || argType === 'evidence',
    });
    if (built.rejected) { rejected += 1; break; }
    moves.push(built.move);
    parentMove = built.move;
  }
  return { moves, rejected };
}

function planWide(pack, ctx) {
  const { runId, seed, scenario, threadIndex, seedRecord, spineId, voiceId, bank } = ctx;
  const moves = [];
  let rejected = 0;
  let moveIndex = 0;

  const root = buildMove({
    runId, seed, scenario, threadIndex, moveIndex,
    moveId: `t${threadIndex}-m0`, parentMoveId: null,
    argumentType: pack.root, parentType: null, parentBody: null,
    spineId, voiceId, seedRecord, attachEvidence: false,
  });
  if (root.rejected) return { moves, rejected: rejected + 1 };
  moves.push(root.move);

  const rootRng = rngFor(runId, seed, scenario.scenarioId, 9999);
  const siblingCount = inRange(rootRng, pack.siblingCount);
  const childCount = inRange(rootRng, pack.childCount || [1, 1]);

  for (let s = 0; s < siblingCount; s++) {
    moveIndex += 1;
    // Use a DISTINCT bank record per sibling where available (keeps sibling
    // similarity below the 0.7 duplicate-sibling warn).
    const sibRecord = bank && bank.length > 0 ? bank[(s + 1) % bank.length] : seedRecord;
    const sib = buildMove({
      runId, seed, scenario, threadIndex, moveIndex,
      moveId: `t${threadIndex}-s${s}`, parentMoveId: root.move.moveId,
      argumentType: pack.siblingType, parentType: pack.root, parentBody: root.move.body,
      spineId, voiceId, seedRecord: sibRecord, attachEvidence: pack.siblingType === 'evidence',
    });
    if (sib.rejected) { rejected += 1; continue; }
    moves.push(sib.move);

    for (let c = 0; c < childCount; c++) {
      moveIndex += 1;
      const child = buildMove({
        runId, seed, scenario, threadIndex, moveIndex,
        moveId: `t${threadIndex}-s${s}-c${c}`, parentMoveId: sib.move.moveId,
        argumentType: pack.childType, parentType: pack.siblingType, parentBody: sib.move.body,
        spineId, voiceId, seedRecord: sibRecord, attachEvidence: pack.childType === 'evidence',
      });
      if (child.rejected) { rejected += 1; continue; }
      moves.push(child.move);
    }
  }
  return { moves, rejected };
}

function planCluster(pack, ctx) {
  const { runId, seed, scenario, threadIndex, seedRecord, spineId, voiceId, bank } = ctx;
  const moves = [];
  let rejected = 0;
  let moveIndex = 0;

  const root = buildMove({
    runId, seed, scenario, threadIndex, moveIndex,
    moveId: `t${threadIndex}-m0`, parentMoveId: null,
    argumentType: pack.root, parentType: null, parentBody: null,
    spineId, voiceId, seedRecord, attachEvidence: false,
  });
  if (root.rejected) return { moves, rejected: rejected + 1 };
  moves.push(root.move);

  const rootRng = rngFor(runId, seed, scenario.scenarioId, 9998);
  const siblingCount = inRange(rootRng, pack.siblingCount);
  const nearVerbatimCount = Math.min(pack.nearVerbatimCount || 3, siblingCount);

  // Build the FIRST near-verbatim sibling normally, then derive the rest of
  // the near-verbatim set from it with minimal token divergence (pairwise
  // Jaccard >= NEAR_VERBATIM_THRESHOLD). Remaining siblings are distinct.
  let baseBody = null;
  for (let s = 0; s < siblingCount; s++) {
    moveIndex += 1;
    const isNearVerbatim = s < nearVerbatimCount;
    let forcedBody;
    let recForSibling = seedRecord;

    if (isNearVerbatim) {
      if (baseBody == null) {
        // First of the cluster: render normally, capture as base.
        recForSibling = seedRecord;
      } else {
        // Derive a near-verbatim variant: append a tiny distinguishing tail
        // so the pair stays >= threshold but is not byte-identical.
        forcedBody = `${baseBody} Point ${s + 1}.`;
      }
    } else if (bank && bank.length > 0) {
      recForSibling = bank[(s + 1) % bank.length];
    }

    const sib = buildMove({
      runId, seed, scenario, threadIndex, moveIndex,
      moveId: `t${threadIndex}-s${s}`, parentMoveId: root.move.moveId,
      argumentType: pack.siblingType, parentType: pack.root, parentBody: root.move.body,
      spineId, voiceId, seedRecord: recForSibling, attachEvidence: false, forcedBody,
    });
    if (sib.rejected) { rejected += 1; continue; }
    if (isNearVerbatim && baseBody == null) baseBody = sib.move.body;
    moves.push(sib.move);
  }
  return { moves, rejected };
}

/**
 * Plan a pack into scenarios.
 *
 * @param {object} opts { pack, count, seed, runId, bank }
 *   bank: ReseedSourceRecord[] (non-empty).
 * @returns {{ scenarios: object[], rejectedTemplates: number }}
 */
function planPack(opts) {
  const { pack: packName, count, seed, runId, bank } = opts || {};
  const pack = RESEED_PACKS[packName];
  if (!pack) {
    throw new Error(`reseedPackPlanner: unknown pack "${packName}". Known: ${RESEED_PACK_NAMES.join(', ')}`);
  }
  if (!Array.isArray(bank) || bank.length === 0) {
    throw new Error('reseedPackPlanner: bank (non-empty ReseedSourceRecord[]) required.');
  }
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 1;
  const seedStr = String(seed == null ? 'seed' : seed);
  const runIdStr = String(runId || 'run');

  const scenarios = [];
  let rejectedTemplates = 0;

  for (let threadIndex = 0; threadIndex < n; threadIndex++) {
    const seedRecord = bank[threadIndex % bank.length];
    const scenarioId = `${packName}-t${threadIndex}`;
    const scenario = {
      scenarioId,
      seedId: seedRecord.bankName,
      resolution: buildResolution(seedRecord),
      description: `${pack.name} pack seeded from ${seedRecord.topic}.`,
      title: seedRecord.topic,
      side: 'affirmative',
      personas: buildPersonas(),
    };

    const spineId = spineForThread(pack, runIdStr, seedStr, threadIndex);
    const voiceId = voiceForThread(runIdStr, seedStr, threadIndex);
    const ctx = { runId: runIdStr, seed: seedStr, scenario, threadIndex, seedRecord, spineId, voiceId, bank };

    let result;
    if (pack.shape === 'chain') result = planChain(pack, ctx);
    else if (pack.shape === 'wide') result = planWide(pack, ctx);
    else if (pack.shape === 'cluster') result = planCluster(pack, ctx);
    else result = { moves: [], rejected: 0 };

    rejectedTemplates += result.rejected;
    scenario.moves = result.moves;
    scenarios.push(scenario);
  }

  return { scenarios, rejectedTemplates };
}

function buildResolution(seedRecord) {
  const topic = (seedRecord && seedRecord.topic) || 'the resolution';
  // A resolution string that shares vocabulary with the topic (helps topic
  // satisfaction read clean; advisory only).
  return `Resolved: ${topic} — the case for and against.`;
}

function buildPersonas() {
  // Fixed 3-bot pool. Persona side maps to participant side via personaMapping.
  return [
    { alias: 'bot-a', side: 'affirmative' },
    { alias: 'bot-b', side: 'negative' },
    { alias: 'bot-c', side: 'neutral' },
  ];
}

module.exports = {
  planPack,
  VOICES,
  voiceForThread,
  spineForThread,
  hashInt,
  keywordsFor,
  buildEvidenceSourceText,
  // exported for cluster jaccard test convenience
  tokenSetJaccard,
  NEAR_VERBATIM_THRESHOLD,
};
