/**
 * Stage 6.1.7 — Adversarial-thread scene builder.
 *
 * Inputs: one source post (xAI-sourced or synthetic) + one selected
 * disagreeable reply. Output: a scene the existing AI-driven runner can
 * traverse — root thesis = source, initial rebuttal = selected reply,
 * three bot users with skill roles assigned by deterministic seed.
 *
 * Bot identity is *test bot* identity. Bots never claim to be real X users
 * and never carry user @handles. The scene declares this explicitly so the
 * runner + annotator can re-assert it on every move.
 */
const { randomUUID } = require('node:crypto');

const SKILL_ROLES = ['bot-provocateur', 'bot-revocateur', 'bot-synthesizer'];

const SIDE_BY_ROLE = {
  'bot-provocateur': 'source_defender',
  'bot-revocateur': 'reply_defender',
  'bot-synthesizer': 'synthesis_moderator',
};

function seededRng(seedString) {
  let seed = 0;
  for (const ch of String(seedString || 'cdiscourse-6.1.7')) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  return function next() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xFFFFFFFF;
  };
}

function shuffleDeterministic(arr, rng) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Build a scene from a (source, reply) pair plus an ordered bot pool.
 *
 * `botPool` must contain at least 3 entries each shaped like
 * `{ alias, label, persona, email }` (mirrors `.env.bot-tests` aliasing).
 * Skill roles + assigned sides are derived deterministically from
 * `opts.seed` so re-running the corpus with the same seed produces the
 * same scene for the same source.
 */
function buildAdversarialScene({ source, reply, botPool, opts = {} }) {
  if (!source) throw new Error('xaiAdversarialSceneBuilder.buildAdversarialScene requires source');
  if (!reply) throw new Error('xaiAdversarialSceneBuilder.buildAdversarialScene requires reply');
  if (!Array.isArray(botPool) || botPool.length < 3) {
    throw new Error('xaiAdversarialSceneBuilder.buildAdversarialScene requires at least 3 bots in botPool');
  }
  const seed = `${opts.seed || 'xai-adversarial'}::${source.sourceHash}::${reply.replyHash}`;
  const rng = seededRng(seed);

  // Pick the 3 bots used in this scene (deterministic) and shuffle skill
  // role assignment. The provocateur defends the source post by default,
  // revocateur defends the disagreeable reply, synthesizer remains neutral.
  const shuffled = shuffleDeterministic(botPool, rng).slice(0, 3);
  // Role order is fixed; the *bot user* assigned to each role varies.
  const personas = SKILL_ROLES.map((skillRole, i) => {
    const bot = shuffled[i];
    return {
      alias: bot.alias,
      label: bot.label || bot.alias,
      email: bot.email,
      skillRole,
      assignedSide: SIDE_BY_ROLE[skillRole],
      identityDisclaimer: 'This is a test bot account in a dev environment. Not a real X user. Defending an assigned position for argument-game stress testing only.',
      stanceDefended: skillRole === 'bot-provocateur'
        ? source.sourceClaimSummary
        : (skillRole === 'bot-revocateur' ? reply.replyClaimSummary : '(neutral; synthesizes if conditions met)'),
      sourceHash: source.sourceHash,
      replyHash: reply.replyHash,
    };
  });

  const scenarioId = `xai-adv-${(source.sourceHash || 'unknown').slice(0, 8)}-${(reply.replyHash || 'unknown').slice(0, 8)}`;
  return {
    scenarioId,
    seed,
    runScopeNote: opts.runScopeNote || 'Stage 6.1.7 — dev/test adversarial thread corpus. Bots are test bots; never claim to be real X users.',
    title: source.sourceClaimSummary,
    resolution: source.sourceClaimSummary,
    rootClaim: source.sourceClaimSummary,
    category: 'xai_adversarial',
    syntheticRebuttal: Boolean(reply.syntheticRebuttal),
    excludedFromRealEpidemiology: Boolean(reply.excludedFromRealEpidemiology),
    sourceHash: source.sourceHash,
    replyHash: reply.replyHash,
    provider: source.provider,
    topicBucket: source.topicBucket,
    providerRank: source.providerRank,
    providerConfidence: source.providerConfidence,
    sourceCitationRefs: source.citationRefs,
    replyCitationRefs: reply.citationRefs,
    sourceClaimType: source.sourceClaimType,
    personas,
    // Seed the move list with the source thesis + the disagreeable reply.
    // `aiMoveRenderer` will use these as the actual move bodies for slots
    // m1 / m2 and continue from m3 onward.
    seededMoves: [
      {
        moveId: 'm1',
        argumentType: 'thesis',
        authorAlias: personas[0].alias,
        parentMoveId: null,
        body: source.sourceTextRedacted,
        bodySource: 'xai_source',
        bodyHash: source.sourceHash,
      },
      {
        moveId: 'm2',
        argumentType: 'rebuttal',
        authorAlias: personas[1].alias,
        parentMoveId: 'm1',
        disagreementAxis: reply.syntheticRebuttal ? (reply.syntheticAxis || 'scope') : undefined,
        body: reply.replyTextRedacted,
        targetExcerpt: source.sourceTextRedacted.slice(0, 120),
        bodySource: reply.syntheticRebuttal ? 'synthetic_fallback' : 'xai_reply',
        bodyHash: reply.replyHash,
      },
    ],
    runId: opts.runId || randomUUID(),
  };
}

module.exports = {
  buildAdversarialScene,
  seededRng,
  shuffleDeterministic,
  SKILL_ROLES,
  SIDE_BY_ROLE,
};
