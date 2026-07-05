/**
 * RESEED-001 — move body renderer.
 *
 * Two paths:
 *
 *   renderNoProvider(move, seedRecord, rng)  — DEFAULT. Deterministic template
 *     render from the bank premise + the spine's rhetorical shape. Takes NO
 *     client param, makes ZERO network calls, contains NO anthropic /
 *     claudeMessagesClient reference (asserted by a source-scan test). Same
 *     (move, seedRecord, rng-seed) -> same body.
 *
 *   renderSonnet({ client, move, seedRecord, rng, maxRetries })  — GATED. A
 *     validator-aware Anthropic (Sonnet) render with one retry and a
 *     deterministic fallback. The prompt forbids JSON wrappers / preambles and
 *     requires the opening token verbatim in the first 80 chars. The rendered
 *     body is re-run through the engine pre-check; on failure (wrapper, engine
 *     reject, length) it falls back to renderNoProvider and records an `issues`
 *     entry bucketed on issue PREFIX only.
 *
 * The Sonnet model string is NOT hardcoded: the caller constructs the client
 * via `claudeMessagesClient.createClient(...)` and this module reads the
 * resolved model back from `client.snapshotUsage().model`. See runReseeder.js.
 *
 * CommonJS / pure for the no-provider path. The sonnet path is only reachable
 * when the orchestrator passes an already-gated client (--pilot + env flag).
 */

const { isEngineValidMove } = require('./reseedEnginePrecheck');

// Concession markers accepted by C-RAIL-003 (concession_integrity). Kept in
// sync with the constitution default list.
const CONCESSION_MARKERS = [
  'I grant',
  'I concede',
  'I acknowledge',
  'fair point',
  "that point is valid",
];

// Deterministic phrase pools per spine. NONE of these contain a verdict /
// truth / winner / loser token (see the ban-list test on report + planner
// output). They are rhetorical framing only.
const SPINE_OPENERS = {
  objection: [
    'I object to this on the following ground.',
    'One objection stands out here.',
    'This runs into an objection.',
  ],
  'evidence-pressure': [
    'This needs a source before it can stand.',
    'The evidentiary basis here is thin.',
    'Where is the primary source for this?',
  ],
  'alternative-explanation': [
    'There is an alternative reading of this.',
    'Another explanation fits the same facts.',
    'Consider a different account of this.',
  ],
  'concession/narrowing': [
    'I grant the broad point while narrowing the scope.',
    'Fair point on the general claim; the narrow case differs.',
    'I acknowledge the main idea and narrow one part.',
  ],
  'resolution-pressure': [
    'To close this out, here is where it lands.',
    'Pulling the threads together for a resolution.',
    'This is the synthesis of the exchange.',
  ],
};

// Argument-type framings that keep bodies distinct per node type.
const TYPE_FRAMINGS = {
  thesis: 'I argue the following thesis.',
  claim: 'A specific claim follows.',
  rebuttal: 'This is a rebuttal to the point above.',
  counter_rebuttal: 'This counter-rebuttal answers the rebuttal.',
  evidence: 'Here is supporting evidence.',
  clarification_request: 'A clarification is needed here.',
  concession: 'I grant part of this.',
  synthesis: 'Here is a synthesis of the exchange.',
};

function pick(rng, arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr[Math.floor(rng() * arr.length)];
}

/** Trim a premise to a clean sentence boundary <= maxLen. */
function trimPremise(premise, maxLen) {
  const text = String(premise || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (lastStop > 40) return cut.slice(0, lastStop + 1).trim();
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim();
}

function compose(parts) {
  return parts
    .filter((p) => typeof p === 'string' && p.trim().length > 0)
    .map((p) => p.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();
}

/**
 * Ensure a clarification body ends with a question (helps C-RAIL-004 read
 * clean; advisory only, but keeps the sample tidy).
 */
function ensureQuestion(body) {
  if (/\?\s*$/.test(body)) return body;
  return `${body} Could you clarify that?`;
}

/**
 * Deterministic no-provider render.
 * @param {object} move PlannedMove (see reseedEnginePrecheck).
 * @param {object} seedRecord ReseedSourceRecord (bank premise + topic).
 * @param {function} rng seeded PRNG (Mulberry32 from stressScenarioTemplates).
 * @returns {{ body: string, source: 'deterministic_template', optionIndex: number }}
 */
function renderNoProvider(move, seedRecord, rng) {
  const maxChars = 2000;
  const type = move.argumentType;
  const spine = move.spineId || 'objection';

  const openerPool = SPINE_OPENERS[spine] || SPINE_OPENERS.objection;
  const optionIndex = Math.floor(rng() * openerPool.length);
  const opener = openerPool[optionIndex] || openerPool[0];
  const typeFraming = TYPE_FRAMINGS[type] || '';

  const premise = trimPremise(seedRecord && seedRecord.premise, 900);
  const topic = (seedRecord && seedRecord.topic) || '';

  const parts = [];

  if (move.parentType == null) {
    // Root thesis/claim: state the topic + premise.
    parts.push(typeFraming);
    parts.push(`On the question of ${topic}, ${premise}`);
  } else {
    parts.push(opener);
    parts.push(typeFraming);
    // Echo the verbatim targetExcerpt so the reply visibly connects to parent.
    if (move.targetExcerpt) {
      parts.push(`Regarding "${move.targetExcerpt}",`);
    }
    parts.push(premise);
  }

  if (type === 'concession' || type === 'synthesis') {
    // Embed a concession marker (deterministic pick).
    const marker = pick(rng, CONCESSION_MARKERS) || CONCESSION_MARKERS[0];
    parts.push(`${marker} on the ${topic} point, and narrow the remaining dispute.`);
  }

  let body = compose(parts);
  if (type === 'clarification_request') body = ensureQuestion(body);

  // Guarantee minimum length (advisory floor is 20; keep a comfortable margin).
  if (body.length < 60 && topic) {
    body = compose([body, `This bears directly on ${topic}.`]);
  }
  if (body.length > maxChars) body = trimPremise(body, maxChars);

  return { body, source: 'deterministic_template', optionIndex };
}

// ── Sonnet (gated) path ────────────────────────────────────────────

function stripCodeFence(text) {
  let s = String(text || '').trim();
  // Strip a leading ```lang ... ``` fence defensively.
  const fence = s.match(/^```[a-zA-Z]*\s*([\s\S]*?)\s*```$/);
  if (fence) s = fence[1].trim();
  return s;
}

function looksJsonWrapped(text) {
  const s = String(text || '').trim();
  return (s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'));
}

/**
 * Validator-aware Sonnet prompt. Requires: no JSON wrapper, no preamble, the
 * required opening token verbatim within the first 80 chars, length bounds.
 */
function buildSonnetPrompt(move, seedRecord) {
  const requiredOpen = move.requiredOpeningToken || '';
  const topic = (seedRecord && seedRecord.topic) || '';
  const premise = trimPremise(seedRecord && seedRecord.premise, 700);
  const excerptRule = move.targetExcerpt
    ? `You are replying to the parent. Somewhere in the body, quote this exact phrase verbatim: "${move.targetExcerpt}".`
    : '';
  const concessionRule =
    move.argumentType === 'concession' || move.argumentType === 'synthesis'
      ? 'Include a concession marker such as "I grant" or "fair point".'
      : '';
  const evidenceRule = move.argumentType === 'evidence'
    ? 'This is an evidence move; refer to the attached source in the body.'
    : '';

  const systemPrompt = [
    'You write a single debate argument body for a dev/test bot.',
    'You do not decide who is right. You do not label anyone. You never use the words winner, loser, liar, true, false, correct, dishonest, propagandist, troll.',
    'Output ONLY the argument body text.',
    'Do NOT wrap the output in JSON, markdown, or quotes.',
    'Do NOT add any preamble like "Here is" or "Sure".',
    requiredOpen ? `Begin the body with the exact word: "${requiredOpen}" (verbatim, within the first 80 characters).` : '',
    excerptRule,
    concessionRule,
    evidenceRule,
    'Length: between 60 and 1500 characters.',
  ].filter(Boolean).join(' ');

  const userPayload = [
    `Topic: ${topic}`,
    `Argument type: ${move.argumentType}`,
    `Spine (rhetorical shape): ${move.spineId || 'objection'}`,
    `Source material to draw from: ${premise}`,
    'Write the body now.',
  ].join('\n');

  return { systemPrompt, userPayload };
}

/** Bucket a fallback reason to its PREFIX only (never echoes ids/values). */
function fallbackReasonPrefix(issue) {
  const s = String(issue || '').toLowerCase();
  if (s.startsWith('sonnet_wrapper')) return 'sonnet_wrapper';
  if (s.startsWith('sonnet_engine_reject')) return 'sonnet_engine_reject';
  if (s.startsWith('sonnet_missing_open')) return 'sonnet_missing_open';
  if (s.startsWith('sonnet_length')) return 'sonnet_length';
  if (s.startsWith('sonnet_error')) return 'sonnet_error';
  if (s.startsWith('sonnet_empty')) return 'sonnet_empty';
  return 'sonnet_other';
}

/**
 * Build a fallback-reason histogram bucketed on issue PREFIX only.
 * @param {Array<{issues:string[]}>} events
 */
function fallbackReasonHistogram(events) {
  const hist = {};
  for (const ev of events || []) {
    for (const issue of (ev && ev.issues) || []) {
      const prefix = fallbackReasonPrefix(issue);
      hist[prefix] = (hist[prefix] || 0) + 1;
    }
  }
  return hist;
}

function validateSonnetBody(body, move) {
  const issues = [];
  const trimmed = String(body || '').trim();
  if (!trimmed) {
    issues.push('sonnet_empty');
    return { ok: false, issues, body: trimmed };
  }
  if (looksJsonWrapped(trimmed)) issues.push('sonnet_wrapper');
  if (move.requiredOpeningToken) {
    const head = trimmed.slice(0, 80).toLowerCase();
    if (!head.includes(String(move.requiredOpeningToken).toLowerCase())) {
      issues.push('sonnet_missing_open');
    }
  }
  if (trimmed.length < 20 || trimmed.length > 2000) issues.push('sonnet_length');
  if (move.targetExcerpt && !trimmed.includes(move.targetExcerpt)) {
    // Not fatal by itself (excerpt echo helps but rails are advisory); but if
    // the engine rejects we will catch it below. Record a soft length/prefix.
  }
  if (issues.length > 0) return { ok: false, issues, body: trimmed };

  // Final gate: the SAME engine the Edge runs.
  const verdict = isEngineValidMove({ ...move, body: trimmed });
  if (!verdict.valid) {
    issues.push('sonnet_engine_reject');
    return { ok: false, issues, body: trimmed };
  }
  return { ok: true, issues, body: trimmed };
}

/**
 * Gated Sonnet render with one retry + deterministic fallback.
 * @param {object} opts { client, move, seedRecord, rng, maxRetries }
 * @returns {Promise<{ body, source, attempts, issues, optionIndex? }>}
 */
async function renderSonnet(opts) {
  const { client, move, seedRecord, rng } = opts || {};
  const maxRetries = typeof (opts && opts.maxRetries) === 'number' ? opts.maxRetries : 1;
  if (!client || typeof client.generate !== 'function') {
    // No usable client — deterministic fallback (should not happen; the
    // orchestrator only calls this when a gated client exists).
    const fb = renderNoProvider(move, seedRecord, rng);
    return { body: fb.body, source: 'deterministic_fallback', attempts: 0, issues: ['sonnet_error_no_client'], optionIndex: fb.optionIndex };
  }

  const { systemPrompt, userPayload } = buildSonnetPrompt(move, seedRecord);
  const collectedIssues = [];
  let attempts = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts += 1;
    let raw = '';
    try {
      const res = await client.generate({ systemPrompt, userPayload, maxTokens: 400 });
      raw = res && typeof res.text === 'string' ? res.text : '';
    } catch (err) {
      collectedIssues.push('sonnet_error');
      continue;
    }
    const candidate = stripCodeFence(raw);
    const check = validateSonnetBody(candidate, move);
    if (check.ok) {
      return { body: check.body, source: 'sonnet', attempts, issues: collectedIssues };
    }
    for (const i of check.issues) collectedIssues.push(i);
  }

  // All attempts failed the validator/engine — deterministic fallback.
  const fb = renderNoProvider(move, seedRecord, rng);
  return {
    body: fb.body,
    source: 'deterministic_fallback',
    attempts,
    issues: collectedIssues.length > 0 ? collectedIssues : ['sonnet_other'],
    optionIndex: fb.optionIndex,
  };
}

module.exports = {
  renderNoProvider,
  renderSonnet,
  buildSonnetPrompt,
  validateSonnetBody,
  fallbackReasonPrefix,
  fallbackReasonHistogram,
  stripCodeFence,
  looksJsonWrapped,
  CONCESSION_MARKERS,
};
