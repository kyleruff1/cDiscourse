/**
 * Stress scenario templates.
 *
 * A template is a static list of move slots; the generator fills each slot
 * with body text composed from the topic's resolution keywords + parent body
 * vocabulary + a spicy phrase from spicyLanguage.js.
 *
 * Every template respects the Constitution `transition_*` rules:
 *   thesis              → claim | rebuttal | evidence
 *   claim               → rebuttal | evidence | clarification_request | concession
 *   rebuttal            → counter_rebuttal | evidence | clarification_request | concession
 *   counter_rebuttal    → rebuttal | evidence | clarification_request
 *   evidence            → clarification_request | rebuttal
 *   clarification_request → claim
 *   concession          → synthesis
 *   synthesis           → (terminal)
 *
 * Every concession AND synthesis body MUST include a concession marker
 * (rule `concession_integrity`, applies_to ["concession", "synthesis"]).
 *
 * CommonJS / pure.
 */

const {
  PROVOCATEUR_OPENERS,
  OBVIOUS_COUNTER_TEEUPS,
  REVOCATEUR_CHALLENGES,
  QUOTE_DEMANDS,
  RECEIPT_DEMANDS,
  SCOPE_CHALLENGES,
  DEFINITION_CHALLENGES,
  TANGENT_HOOKS,
  COUNTEREXAMPLE_LINES,
  WEAK_EXAMPLE_LINES,
  DODGE_CALLOUT_LINES,
  PLAYFUL_SELF_OWN_LINES,
  CONCESSION_PHRASES,
  CONCESSION_NARROWERS,
  SYNTHESIS_PHRASES,
} = require('./spicyLanguage');

// ── Seeded PRNG (Mulberry32 — deterministic, pure) ─────────────
function seededRng(seedStr) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  }
  let a = h >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

// ── Helpers for body composition ───────────────────────────────

function firstKeywords(topic, n) {
  return (topic.resolutionKeywords || []).slice(0, n);
}

/**
 * Pull a contiguous phrase from parent.body that is at most ~60 chars and
 * contains at least one of the topic's resolutionKeywords. Returns the
 * phrase verbatim so it can be used as targetExcerpt (which the engine
 * checks against parent.body via .includes).
 */
function pickTargetExcerpt(parentBody, topic) {
  const keywords = topic.resolutionKeywords || [];
  for (const kw of keywords) {
    const idx = parentBody.toLowerCase().indexOf(kw.toLowerCase());
    if (idx < 0) continue;
    // Expand to a phrase: back up to a space, walk forward ~50 chars
    let start = idx;
    while (start > 0 && parentBody[start - 1] !== ' ' && idx - start < 20) start--;
    let end = Math.min(parentBody.length, idx + 50);
    while (end < parentBody.length && parentBody[end] !== ' ' && end - idx < 70) end++;
    const phrase = parentBody.slice(start, end).trim();
    if (phrase.length >= 8) return phrase;
  }
  // Fall back to the first 40 chars of the parent
  return parentBody.slice(0, Math.min(parentBody.length, 50)).trim();
}

/**
 * Build a sentence that names ≥2 resolution keywords AND ≥2 words from the
 * parent body, plus a spicy phrase. Returns a 1–2 sentence body.
 */
function composeBody(parts) {
  return parts
    .filter((p) => typeof p === 'string' && p.trim().length > 0)
    .map((p) => p.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
}

/** Echo 2 keywords back into a phrase for parent-body overlap. */
function echoKeywords(parentBody, topic) {
  const matches = [];
  for (const kw of topic.resolutionKeywords || []) {
    if (parentBody.toLowerCase().includes(kw.toLowerCase())) matches.push(kw);
    if (matches.length >= 3) break;
  }
  if (matches.length === 0) return '';
  return `On the ${matches.join(' and ')} point:`;
}

// ── Body renderers ─────────────────────────────────────────────

function renderThesis(rng, topic) {
  const opener = pick(rng, PROVOCATEUR_OPENERS);
  const teeup = pick(rng, OBVIOUS_COUNTER_TEEUPS);
  const counter = pick(rng, topic.counterClaims || ['the opposite claim']);
  return composeBody([
    opener,
    topic.thesisFraming,
    `${teeup} ${counter}`,
  ]);
}

function renderRebuttal(rng, topic, parentBody, axis) {
  const challenge = pick(rng, REVOCATEUR_CHALLENGES);
  const dodge = pick(rng, DODGE_CALLOUT_LINES);
  const echo = echoKeywords(parentBody, topic);
  const counter = pick(rng, topic.counterClaims || ['the opposite claim']);
  return composeBody([
    challenge,
    echo,
    counter,
    `The ${axis} disagreement on ${firstKeywords(topic, 3).join(' ')} is where this lives.`,
    dodge,
  ]);
}

function renderCounterRebuttal(rng, topic, parentBody) {
  const challenge = pick(rng, SCOPE_CHALLENGES);
  const echo = echoKeywords(parentBody, topic);
  return composeBody([
    challenge,
    echo,
    `Counter-rebuttal: the claim only carries for ${firstKeywords(topic, 3).join(' and ')}.`,
    pick(rng, REVOCATEUR_CHALLENGES),
  ]);
}

function renderClarification(rng, topic, parentBody) {
  const demand = pick(rng, QUOTE_DEMANDS);
  const echo = echoKeywords(parentBody, topic);
  return composeBody([
    demand,
    echo,
    `Are you arguing about ${firstKeywords(topic, 2).join(' or ')} specifically, and what counts?`,
  ]);
}

function renderClaim(rng, topic, parentBody) {
  const echo = echoKeywords(parentBody, topic);
  const scope = pick(rng, topic.scopeNarrowings || ['the original framing']);
  return composeBody([
    echo,
    `Narrower claim: ${scope}, while the ${firstKeywords(topic, 2).join(' and ')} point stays intact.`,
    pick(rng, REVOCATEUR_CHALLENGES),
  ]);
}

function renderEvidence(rng, topic, parentBody, fact) {
  const receipt = pick(rng, RECEIPT_DEMANDS);
  const echo = echoKeywords(parentBody, topic);
  const counterex = pick(rng, COUNTEREXAMPLE_LINES);
  return composeBody([
    echo,
    `${counterex} ${fact.sourceText}`,
    `This ${firstKeywords(topic, 2).join(' / ')} receipt answers the request: ${receipt}`,
  ]);
}

function renderConcession(rng, topic, parentBody) {
  const marker = pick(rng, CONCESSION_PHRASES);
  const narrower = pick(rng, CONCESSION_NARROWERS);
  const selfOwn = pick(rng, PLAYFUL_SELF_OWN_LINES);
  const echo = echoKeywords(parentBody, topic);
  return composeBody([
    `${marker} the narrower ${firstKeywords(topic, 2).join(' and ')} point.`,
    narrower,
    selfOwn,
    echo,
  ]);
}

function renderSynthesis(rng, topic, parentBody) {
  // Synthesis must include a concession marker (concession_integrity applies_to includes "synthesis").
  const synth = pick(rng, SYNTHESIS_PHRASES);
  const tangent = pick(rng, TANGENT_HOOKS);
  const echo = echoKeywords(parentBody, topic);
  return composeBody([
    `${synth} on the ${firstKeywords(topic, 2).join(' and ')} question.`,
    echo,
    `I acknowledge the room has converged on ${firstKeywords(topic, 1)[0]} enough to synthesize.`,
    tangent,
  ]);
}

// ── Templates ──────────────────────────────────────────────────

/**
 * Each slot describes a move structurally. The generator fills body using the
 * renderer keyed by `argumentType`, plus per-slot extras (axis, target,
 * playfulLabel, branchCandidate).
 */
const TEMPLATES = [
  {
    id: 'balanced-challenge-12',
    description: '12-move balanced exchange: rebuttal/evidence/clarify, counter-rebuttal branch, concession+synthesis close.',
    slots: [
      { moveId: 'm1', author: 0, parent: null, moveKind: 'start_thesis', argumentType: 'thesis' },
      { moveId: 'm2', author: 1, parent: 'm1', moveKind: 'challenge_parent', argumentType: 'rebuttal', axis: 'fact', target: true },
      { moveId: 'm3', author: 2, parent: 'm2', moveKind: 'ask_clarification', argumentType: 'clarification_request' },
      { moveId: 'm4', author: 1, parent: 'm3', moveKind: 'make_claim', argumentType: 'claim' },
      { moveId: 'm5', author: 0, parent: 'm2', moveKind: 'add_evidence', argumentType: 'evidence' },
      { moveId: 'm6', author: 0, parent: 'm2', moveKind: 'challenge_parent', argumentType: 'counter_rebuttal', axis: 'scope', target: true, branchCandidate: true },
      { moveId: 'm7', author: 0, parent: 'm6', moveKind: 'add_evidence', argumentType: 'evidence' },
      { moveId: 'm8', author: 1, parent: 'm5', moveKind: 'challenge_parent', argumentType: 'rebuttal', axis: 'evidence', target: true },
      { moveId: 'm9', author: 1, parent: 'm5', moveKind: 'ask_clarification', argumentType: 'clarification_request' },
      { moveId: 'm10', author: 0, parent: 'm9', moveKind: 'make_claim', argumentType: 'claim' },
      { moveId: 'm11', author: 1, parent: 'm10', moveKind: 'concede_or_narrow', argumentType: 'concession', playfulLabel: "I'm only MOSTLY wrong about this" },
      { moveId: 'm12', author: 2, parent: 'm11', moveKind: 'synthesize_thread', argumentType: 'synthesis' },
    ],
  },
  {
    id: 'concession-path-11',
    description: '11-move concession-path: evidence trade then concession+synthesis with a tangent claim.',
    slots: [
      { moveId: 'm1', author: 0, parent: null, moveKind: 'start_thesis', argumentType: 'thesis' },
      { moveId: 'm2', author: 1, parent: 'm1', moveKind: 'challenge_parent', argumentType: 'rebuttal', axis: 'causal', target: true },
      { moveId: 'm3', author: 0, parent: 'm2', moveKind: 'add_evidence', argumentType: 'evidence' },
      { moveId: 'm4', author: 1, parent: 'm3', moveKind: 'challenge_parent', argumentType: 'rebuttal', axis: 'evidence', target: true },
      { moveId: 'm5', author: 2, parent: 'm4', moveKind: 'ask_clarification', argumentType: 'clarification_request' },
      { moveId: 'm6', author: 1, parent: 'm5', moveKind: 'make_claim', argumentType: 'claim' },
      { moveId: 'm7', author: 0, parent: 'm4', moveKind: 'challenge_parent', argumentType: 'counter_rebuttal', axis: 'scope', target: true },
      { moveId: 'm8', author: 0, parent: 'm7', moveKind: 'add_evidence', argumentType: 'evidence' },
      { moveId: 'm9', author: 1, parent: 'm6', moveKind: 'concede_or_narrow', argumentType: 'concession', playfulLabel: 'Peace treaty-ish' },
      { moveId: 'm10', author: 2, parent: 'm9', moveKind: 'synthesize_thread', argumentType: 'synthesis' },
      { moveId: 'm11', author: 0, parent: 'm5', moveKind: 'make_claim', argumentType: 'claim', branchCandidate: true },
    ],
  },
  {
    id: 'evidence-heavy-13',
    description: '13-move evidence-heavy: alternating evidence + rebuttal chains, concession via claim path.',
    slots: [
      { moveId: 'm1', author: 0, parent: null, moveKind: 'start_thesis', argumentType: 'thesis' },
      { moveId: 'm2', author: 0, parent: 'm1', moveKind: 'add_evidence', argumentType: 'evidence' },
      { moveId: 'm3', author: 1, parent: 'm1', moveKind: 'challenge_parent', argumentType: 'rebuttal', axis: 'fact', target: true },
      { moveId: 'm4', author: 1, parent: 'm3', moveKind: 'add_evidence', argumentType: 'evidence' },
      { moveId: 'm5', author: 0, parent: 'm4', moveKind: 'challenge_parent', argumentType: 'rebuttal', axis: 'evidence', target: true },
      { moveId: 'm6', author: 2, parent: 'm5', moveKind: 'ask_clarification', argumentType: 'clarification_request' },
      { moveId: 'm7', author: 0, parent: 'm6', moveKind: 'make_claim', argumentType: 'claim' },
      { moveId: 'm8', author: 1, parent: 'm7', moveKind: 'challenge_parent', argumentType: 'rebuttal', axis: 'scope', target: true },
      { moveId: 'm9', author: 1, parent: 'm8', moveKind: 'add_evidence', argumentType: 'evidence' },
      { moveId: 'm10', author: 0, parent: 'm9', moveKind: 'ask_clarification', argumentType: 'clarification_request' },
      { moveId: 'm11', author: 1, parent: 'm10', moveKind: 'make_claim', argumentType: 'claim', branchCandidate: true },
      { moveId: 'm12', author: 0, parent: 'm11', moveKind: 'concede_or_narrow', argumentType: 'concession', playfulLabel: 'Mostly wrong, partly right' },
      { moveId: 'm13', author: 2, parent: 'm12', moveKind: 'synthesize_thread', argumentType: 'synthesis' },
    ],
  },
  {
    id: 'deep-chain-12',
    description: '12-move deep chain: rebuttal/counter-rebuttal ping-pong reaches depth 10 before concession + synthesis close. Includes one tangent at mid-thread.',
    slots: [
      { moveId: 'm1', author: 0, parent: null, moveKind: 'start_thesis', argumentType: 'thesis' },
      { moveId: 'm2', author: 1, parent: 'm1', moveKind: 'challenge_parent', argumentType: 'rebuttal', axis: 'scope', target: true },
      { moveId: 'm3', author: 0, parent: 'm2', moveKind: 'challenge_parent', argumentType: 'counter_rebuttal', axis: 'fact', target: true },
      { moveId: 'm4', author: 1, parent: 'm3', moveKind: 'challenge_parent', argumentType: 'rebuttal', axis: 'evidence', target: true },
      { moveId: 'm5', author: 1, parent: 'm4', moveKind: 'add_evidence', argumentType: 'evidence' },
      { moveId: 'm6', author: 0, parent: 'm5', moveKind: 'challenge_parent', argumentType: 'rebuttal', axis: 'logic', target: true },
      { moveId: 'm7', author: 2, parent: 'm6', moveKind: 'ask_clarification', argumentType: 'clarification_request', branchCandidate: true },
      { moveId: 'm8', author: 0, parent: 'm7', moveKind: 'make_claim', argumentType: 'claim' },
      { moveId: 'm9', author: 1, parent: 'm8', moveKind: 'challenge_parent', argumentType: 'rebuttal', axis: 'definition', target: true },
      { moveId: 'm10', author: 1, parent: 'm9', moveKind: 'concede_or_narrow', argumentType: 'concession', playfulLabel: 'Argument got smaller' },
      { moveId: 'm11', author: 2, parent: 'm10', moveKind: 'synthesize_thread', argumentType: 'synthesis' },
      { moveId: 'm12', author: 0, parent: 'm7', moveKind: 'make_claim', argumentType: 'claim', branchCandidate: true },
    ],
  },
  {
    id: 'deep-chain-15',
    description: '15-move long-chain duel: thesis → rebuttal/counter-rebuttal ping-pong reaches depth 14 with one evidence drop, one clarification, then concession + synthesis close.',
    slots: [
      { moveId: 'm1', author: 0, parent: null, moveKind: 'start_thesis', argumentType: 'thesis' },
      { moveId: 'm2', author: 1, parent: 'm1', moveKind: 'challenge_parent', argumentType: 'rebuttal', axis: 'scope', target: true },
      { moveId: 'm3', author: 0, parent: 'm2', moveKind: 'challenge_parent', argumentType: 'counter_rebuttal', axis: 'fact', target: true },
      { moveId: 'm4', author: 1, parent: 'm3', moveKind: 'challenge_parent', argumentType: 'rebuttal', axis: 'evidence', target: true },
      { moveId: 'm5', author: 0, parent: 'm4', moveKind: 'challenge_parent', argumentType: 'counter_rebuttal', axis: 'logic', target: true },
      { moveId: 'm6', author: 0, parent: 'm5', moveKind: 'add_evidence', argumentType: 'evidence' },
      { moveId: 'm7', author: 1, parent: 'm6', moveKind: 'challenge_parent', argumentType: 'rebuttal', axis: 'scope', target: true },
      { moveId: 'm8', author: 0, parent: 'm7', moveKind: 'challenge_parent', argumentType: 'counter_rebuttal', axis: 'definition', target: true },
      { moveId: 'm9', author: 1, parent: 'm8', moveKind: 'challenge_parent', argumentType: 'rebuttal', axis: 'causal', target: true },
      { moveId: 'm10', author: 0, parent: 'm9', moveKind: 'challenge_parent', argumentType: 'counter_rebuttal', axis: 'value', target: true },
      { moveId: 'm11', author: 0, parent: 'm10', moveKind: 'add_evidence', argumentType: 'evidence' },
      { moveId: 'm12', author: 2, parent: 'm11', moveKind: 'ask_clarification', argumentType: 'clarification_request', branchCandidate: true },
      { moveId: 'm13', author: 1, parent: 'm12', moveKind: 'make_claim', argumentType: 'claim' },
      { moveId: 'm14', author: 1, parent: 'm13', moveKind: 'concede_or_narrow', argumentType: 'concession', playfulLabel: 'Peace treaty-ish' },
      { moveId: 'm15', author: 2, parent: 'm14', moveKind: 'synthesize_thread', argumentType: 'synthesis' },
    ],
  },
];

// ── Compose moves for a (template, topic) pair ─────────────────

/**
 * Render a full move list from a template + topic. Returns an array of
 * fixture move objects (the same shape used in fixtures/argument-scenarios).
 * Deterministic given the same seedStr.
 */
function renderScenarioMoves(template, topic, seedStr) {
  const rng = seededRng(seedStr);
  const facts = topic.evidenceFacts && topic.evidenceFacts.length > 0
    ? topic.evidenceFacts.slice()
    : [{ label: 'unspecified', sourceText: 'No source attached.' }];

  const personas = [
    { alias: 'Alex', side: 'affirmative', tone: 'calm' },
    { alias: 'Jordan', side: 'negative', tone: 'skeptical' },
    { alias: 'Sam', side: 'neutral', tone: 'conciliatory' },
  ];

  const moves = [];
  const bodyByMoveId = {};

  let factIdx = 0;

  for (const slot of template.slots) {
    const parentBody = slot.parent ? bodyByMoveId[slot.parent] || '' : '';
    let body;
    switch (slot.argumentType) {
      case 'thesis':
        body = renderThesis(rng, topic);
        break;
      case 'rebuttal':
        body = renderRebuttal(rng, topic, parentBody, slot.axis || 'fact');
        break;
      case 'counter_rebuttal':
        body = renderCounterRebuttal(rng, topic, parentBody);
        break;
      case 'clarification_request':
        body = renderClarification(rng, topic, parentBody);
        break;
      case 'claim':
        body = renderClaim(rng, topic, parentBody);
        break;
      case 'evidence':
        body = renderEvidence(rng, topic, parentBody, facts[factIdx % facts.length]);
        factIdx++;
        break;
      case 'concession':
        body = renderConcession(rng, topic, parentBody);
        break;
      case 'synthesis':
        body = renderSynthesis(rng, topic, parentBody);
        break;
      default:
        body = 'Unrecognized move type — placeholder body to keep validators happy.';
    }
    bodyByMoveId[slot.moveId] = body;

    const move = {
      moveId: slot.moveId,
      authorAlias: personas[slot.author].alias,
      parentMoveId: slot.parent,
      moveKind: slot.moveKind,
      qualifierCode: null,
      argumentType: slot.argumentType,
      disagreementAxis: slot.axis || null,
      targetExcerpt: slot.target && parentBody ? pickTargetExcerpt(parentBody, topic) : null,
      body,
      selectedTagCodes: [],
      evidence:
        slot.argumentType === 'evidence' ? facts[(factIdx - 1 + facts.length) % facts.length] : null,
      expectedStatus: 'posted',
      expectedRestingStatus: null,
      expectedClaimStanding: null,
      displayMeta: {
        playfulLabel: slot.playfulLabel || undefined,
        quoteAnchorCandidate: slot.target && parentBody ? pickTargetExcerpt(parentBody, topic) : undefined,
        branchCandidate: slot.branchCandidate ? true : undefined,
      },
    };
    moves.push(move);
  }

  return { moves, personas };
}

module.exports = {
  TEMPLATES,
  renderScenarioMoves,
  seededRng,
  pickTargetExcerpt,
  echoKeywords,
};
