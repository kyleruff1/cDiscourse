/**
 * Stage 6.1.5 — AI-driven move renderer.
 *
 * Replaces the deterministic body renderers in `stressScenarioTemplates.js`
 * for runs that opt into AI continuance. Every move body still has to:
 *   - Satisfy the Constitution transitions (the template already chose a
 *     valid argumentType for each slot — we just generate prose).
 *   - Include a concession marker if the slot is `concession` or `synthesis`.
 *   - Avoid forbidden person-attack phrases.
 *   - Stay under ~3 sentences / ~280 chars.
 *   - Quote a short phrase from the parent verbatim when `slot.target` is set.
 *
 * The post-processor enforces these properties; on failure it falls back to
 * the existing deterministic renderer so the run never produces an invalid
 * move (the bot fixture must always post a submittable body).
 */
const { buildPersonaSystemPrompt } = require('./aiBotPersonas');
const detTemplates = require('./stressScenarioTemplates');
const { sanitize: sanitizeError } = require('./claudeMessagesClient');

const CONCESSION_MARKERS = [
  'i concede', 'i grant', 'i agree with', 'that point is valid',
  "you're right", 'you are right', 'fair point', 'i acknowledge',
];

const FORBIDDEN_PHRASES = [
  'liar', 'lying', 'dishonest', 'bad faith', 'manipulative', 'manipulation',
  'extremist', 'propagandist', 'winner', 'loser', 'you are stupid',
  'you are dumb', 'you are an idiot',
];

function lower(s) { return String(s || '').toLowerCase(); }

function hasAnyLower(text, patterns) {
  const lc = lower(text);
  return patterns.some((p) => lc.includes(p));
}

function stripMarkdown(text) {
  return String(text || '')
    .replace(/^```[\s\S]*?```$/gm, '')
    .replace(/^[#>*\-]+\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function ensureLengthBounds(text, maxChars = 280) {
  const t = stripMarkdown(text);
  if (t.length <= maxChars) return t;
  return t.slice(0, maxChars - 1).trim() + '…';
}

function hasConcessionMarker(text) {
  return CONCESSION_MARKERS.some((m) => lower(text).includes(m));
}

function hasForbidden(text) {
  return hasAnyLower(text, FORBIDDEN_PHRASES);
}

function pickTargetExcerpt(parentBody, topic) {
  return detTemplates.pickTargetExcerpt(parentBody || '', topic || { resolutionKeywords: [] });
}

/** Persona for a slot is determined by the persona index in the template. */
function personaForAuthor(authorIndex) {
  if (authorIndex === 0) return 'provocateur';
  if (authorIndex === 1) return 'revocateur';
  return 'synthesizer';
}

function buildUserPayload({
  topic,
  parentBody,
  slot,
  conversationSummary,
  forceConcessionMarker,
  forceTargetExcerpt,
}) {
  const lines = [];
  lines.push(`Topic resolution: ${topic.resolution || '(unspecified)'}`);
  if (Array.isArray(topic.resolutionKeywords)) {
    lines.push(`Topic keywords (echo at least 2 of these in your body): ${topic.resolutionKeywords.slice(0, 5).join(', ')}`);
  }
  if (parentBody) {
    lines.push('');
    lines.push('Parent argument body:');
    lines.push(parentBody);
  }
  if (conversationSummary) {
    lines.push('');
    lines.push('Conversation so far (summary, oldest first):');
    lines.push(conversationSummary);
  }
  lines.push('');
  lines.push(`Your move slot:`);
  lines.push(`  argumentType: ${slot.argumentType}`);
  lines.push(`  moveKind:     ${slot.moveKind}`);
  if (slot.axis) lines.push(`  disagreementAxis: ${slot.axis}`);
  if (forceTargetExcerpt) {
    lines.push('');
    lines.push(`This move requires a target excerpt. Quote this short phrase verbatim somewhere in your body: "${forceTargetExcerpt}".`);
  }
  if (forceConcessionMarker) {
    lines.push('');
    lines.push('This move requires a concession marker. Include exactly one of: ' + CONCESSION_MARKERS.slice(0, 5).join(' / ') + '.');
  }
  lines.push('');
  lines.push('Write the body now. One to three sentences. No prefix, no quotes around the whole thing.');
  return lines.join('\n');
}

/**
 * Generate one move body. Tries Anthropic; if the result fails validation,
 * retries up to `maxRetries` times with a stricter instruction, then falls
 * back to the deterministic renderer so the bot fixture can always post.
 */
async function renderMoveBody({
  client,
  persona,
  topic,
  scenarioCategory,
  parentBody,
  slot,
  conversationSummary,
  rng,
  evidenceFact,
  maxRetries = 1,
  fallbackDeterministic = true,
}) {
  const needsConcession = slot.argumentType === 'concession' || slot.argumentType === 'synthesis';
  const needsTarget = Boolean(slot.target);
  const forceTargetExcerpt = needsTarget && parentBody ? pickTargetExcerpt(parentBody, topic) : null;

  const systemPrompt = buildPersonaSystemPrompt({ persona, scenarioCategory });

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const userPayload = buildUserPayload({
      topic,
      parentBody,
      slot,
      conversationSummary,
      forceConcessionMarker: needsConcession,
      forceTargetExcerpt,
    });
    let raw;
    try {
      const result = await client.generate({
        systemPrompt,
        userPayload,
        maxTokens: 360,
        temperature: needsConcession ? 0.55 : 0.7,
      });
      raw = result.text;
    } catch (err) {
      // Hard failure (budget exceeded / network) — bail to deterministic fallback.
      if (!fallbackDeterministic) throw err;
      return {
        source: 'deterministic_fallback',
        body: deterministicFallback({ persona, topic, slot, parentBody, rng, evidenceFact }),
        attempts: attempt + 1,
        // Defense-in-depth: re-sanitize even though the Anthropic client
        // sanitizes its own errors before throwing.
        validationFailureReason: `ai_call_failed: ${sanitizeError(String(err.message)).slice(0, 200)}`,
      };
    }
    const body = ensureLengthBounds(raw);

    const issues = [];
    if (hasForbidden(body)) issues.push('contains_forbidden_phrase');
    if (needsConcession && !hasConcessionMarker(body)) issues.push('missing_concession_marker');
    if (needsTarget && forceTargetExcerpt && !body.toLowerCase().includes(forceTargetExcerpt.toLowerCase())) {
      issues.push('missing_target_excerpt');
    }
    if (body.length < 40) issues.push('too_short');

    if (issues.length === 0) {
      return { source: 'anthropic', body, attempts: attempt + 1, validationFailureReason: null };
    }
    // If retries remain, the next loop adds a stricter user payload (the
    // existing payload already requires the marker / excerpt; we just retry).
  }

  if (!fallbackDeterministic) {
    throw new Error('AI move rendering failed after retries; fallback disabled.');
  }
  return {
    source: 'deterministic_fallback',
    body: deterministicFallback({ persona, topic, slot, parentBody, rng, evidenceFact }),
    attempts: maxRetries + 1,
    validationFailureReason: 'validation_failed_after_retries',
  };
}

function deterministicFallback({ persona, topic, slot, parentBody, rng, evidenceFact }) {
  const rngFn = typeof rng === 'function' ? rng : detTemplates.seededRng(`fallback::${slot.moveId || 'm?'}::${topic.topicId || 't?'}`);
  const t = topic || {};
  const p = parentBody || '';
  const r = (() => {
    switch (slot.argumentType) {
      case 'thesis': return _det('renderThesis', rngFn, t);
      case 'rebuttal': return _det('renderRebuttal', rngFn, t, p, slot.axis || 'fact');
      case 'counter_rebuttal': return _det('renderCounterRebuttal', rngFn, t, p);
      case 'clarification_request': return _det('renderClarification', rngFn, t, p);
      case 'claim': return _det('renderClaim', rngFn, t, p);
      case 'evidence': return _det('renderEvidence', rngFn, t, p, evidenceFact || (t.evidenceFacts && t.evidenceFacts[0]) || { label: 'unspecified', sourceText: '' });
      case 'concession': return _det('renderConcession', rngFn, t, p);
      case 'synthesis': return _det('renderSynthesis', rngFn, t, p);
      default: return _det('renderClaim', rngFn, t, p);
    }
  })();
  return r;
}

// We can't directly access the per-type renderers (they're not exported).
// Mirror minimal logic — keep the same lexeme echo so concession + synthesis
// fallbacks still pass the constitution.
function _det(fnName, _rng, topic, parent, axis) {
  // Tiny, safe fallback bodies. The deterministic templates produce much
  // richer text; this is only used when Anthropic + retries fail.
  const kw = (topic.resolutionKeywords || []).slice(0, 3).join(' ');
  switch (fnName) {
    case 'renderThesis':
      return `${topic.thesisFraming || (topic.resolution || 'A claim.')} ${kw}`.trim();
    case 'renderRebuttal':
      return `Counter to the previous point on ${kw}. The ${axis || 'fact'} disagreement is the heart of it.`;
    case 'renderCounterRebuttal':
      return `Pushing back on the rebuttal — narrow back to ${kw}.`;
    case 'renderClarification':
      return `Which part exactly are you arguing — ${kw}?`;
    case 'renderClaim':
      return `Narrower claim about ${kw}, holding the broader point intact.`;
    case 'renderEvidence': {
      const fact = arguments[4] || { sourceText: 'No source attached.' };
      return `${fact.sourceText} This ${kw} evidence is on point.`;
    }
    case 'renderConcession':
      return `I grant the narrower ${kw} point. Argument got smaller.`;
    case 'renderSynthesis':
      return `I acknowledge the room converged on ${kw}. The remaining question is worth its own thread.`;
    default:
      return `Note on ${kw}.`;
  }
}

module.exports = {
  renderMoveBody,
  buildUserPayload,
  ensureLengthBounds,
  hasConcessionMarker,
  hasForbidden,
  personaForAuthor,
  CONCESSION_MARKERS,
  FORBIDDEN_PHRASES,
};
