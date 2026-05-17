/**
 * Stage 6.1.9 — Live Anthropic move renderer for the xAI adversarial
 * bot corpus. Distinct from `aiMoveRenderer.js` (Stage 6.1.5) so the
 * adversarial flow does not inherit the older deterministic fallbacks
 * that contain Stage 6.1.4-era canned phrases now on the banned list.
 *
 * Contract:
 *   - System prompt is the FULL skill body read fresh from disk
 *     (`scripts/bot-fixtures/skillFileLoader.js`). The skill hash is
 *     echoed in the prompt and returned in the result so JSONL events
 *     can stamp `skillHash`.
 *   - User payload carries: parent body, conversation summary, slot
 *     spec, target excerpt (when required), and the explicit
 *     disagreement axis. Anti-amplification doctrine is restated.
 *   - Output is validated against:
 *       * 9 forbidden user labels (CLAUDE.md): liar, dishonest, bad
 *         faith, manipulative, extremist, propagandist, troll, bot,
 *         astroturfer — only when applied AS labels to another user
 *         (regex `you are (a )?{label}` / `they are (a )?{label}`).
 *       * 7 banned canned phrases (CLAUDE.md).
 *       * Length bounds (~360 chars max, 40 chars min).
 *       * Concession marker if slot is `concession` or `synthesis`.
 *       * Target excerpt presence when requested.
 *   - On validation failure: retries once with a stricter user payload,
 *     then falls back to a deterministic body shape that never matches
 *     any banned/forbidden pattern. The fallback is NOT the older
 *     deterministic renderer.
 *   - Never logs the Anthropic key or Bearer headers (claudeMessagesClient
 *     already sanitises). Never returns the key.
 *
 * Pure Node CommonJS. No React, no Supabase. Anthropic calls only via
 * the gated client.
 */
const { sanitize: sanitizeError } = require('./claudeMessagesClient');

const CONCESSION_MARKERS = [
  'i concede', 'i grant', 'i agree with', 'that point is valid',
  "you're right", 'you are right', 'fair point', 'i acknowledge',
];

const FORBIDDEN_USER_LABELS = [
  'liar', 'dishonest', 'bad faith', 'manipulative', 'extremist',
  'propagandist', 'troll', 'bot', 'astroturfer',
];

const BANNED_CANNED_PHRASES = [
  'counter to the previous point',
  'the causal disagreement is the heart of it',
  'the evidence disagreement is the heart of it',
  'this evidence is on point',
  'pushing back on the rebuttal',
  'narrow back to',
  'on the keyword point',
];

/**
 * Disagreement-axis vocabulary Anthropic may choose from. Mirrors the
 * runner's internal set; `mapAxisForSubmit` remaps to the legacy
 * 7-axis set the deployed Edge Function accepts.
 */
const ALLOWED_AXES = [
  'fact', 'definition', 'causal', 'value', 'evidence', 'logic', 'scope',
  'source_chain', 'anti_amplification', 'framing',
];

function lower(s) { return String(s || '').toLowerCase(); }

function stripMarkdown(text) {
  return String(text || '')
    .replace(/^```[\s\S]*?```$/gm, '')
    .replace(/^[#>*\-]+\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function ensureLengthBounds(text, maxChars = 360) {
  const t = stripMarkdown(text);
  if (t.length <= maxChars) return t;
  return t.slice(0, maxChars - 1).trim() + '…';
}

function hasConcessionMarker(text) {
  const lc = lower(text);
  return CONCESSION_MARKERS.some((m) => lc.includes(m));
}

function hasBannedCannedPhrase(text) {
  const lc = lower(text);
  return BANNED_CANNED_PHRASES.some((p) => lc.includes(p));
}

/**
 * Forbidden user labels appear ONLY as labels applied to another user.
 * "bot-provocateur" / "this is a test bot" must remain legal so we
 * regex for the labeling pattern, not the bare word.
 */
function hasForbiddenUserLabel(text) {
  const lc = lower(text);
  for (const label of FORBIDDEN_USER_LABELS) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Allow trailing 's' for plural usages ("they are propagandists").
    const patterns = [
      new RegExp(`\\b(?:you|they|he|she)\\s+(?:are|is)\\s+(?:a |an )?${escaped}s?\\b`, 'i'),
      new RegExp(`\\b(?:you|they|he|she)['']re\\s+(?:a |an )?${escaped}s?\\b`, 'i'),
      new RegExp(`\\b(?:you|they|he|she)['']s\\s+(?:a |an )?${escaped}s?\\b`, 'i'),
      new RegExp(`\\bcalls?\\s+(?:them|him|her)\\s+(?:a |an )?${escaped}s?\\b`, 'i'),
      new RegExp(`\\b(?:they|he|she)\\s+(?:acts?|behaves?)\\s+(?:like)\\s+(?:a |an )?${escaped}s?\\b`, 'i'),
    ];
    if (patterns.some((re) => re.test(lc))) return label;
  }
  return null;
}

function buildAdversarialSystemPrompt({ skillRole, skillBodyText, skillHash, scenarioCategory }) {
  return [
    `You are operating under the **${skillRole}** skill (sha-prefix ${skillHash}).`,
    `The full skill body (read fresh from disk on this run) is below. Follow it.`,
    '',
    '────────── BEGIN SKILL BODY ──────────',
    skillBodyText.trim(),
    '────────── END SKILL BODY ──────────',
    '',
    'Hard rules that always apply (these override any conflict in the skill body):',
    '- You are a test bot account in a dev environment. You are NOT a real X user. Never claim to be a real X user. Never reproduce the source post or reply text verbatim beyond the short target excerpt you are asked to quote.',
    '- You DO NOT classify the other speaker. Never label any user as liar, dishonest, bad faith, manipulative, extremist, propagandist, troll, bot, or astroturfer.',
    '- Popularity is not evidence. Repetition is not evidence. Engagement velocity is not evidence. Political identity is not evidence. Stress these in your replies as needed.',
    '- Hostile source material is converted into structured pressure, not reproduced.',
    '- Banned canned phrases (do NOT use these): "Counter to the previous point", "The causal disagreement is the heart of it", "The evidence disagreement is the heart of it", "This evidence is on point", "Pushing back on the rebuttal", "narrow back to", "On the [keyword] point".',
    `- Scenario category: ${scenarioCategory || 'xai_adversarial'}.`,
    '',
    'Disagreement-axis vocabulary you may pick from (choose the SINGLE axis',
    'that the parent body most plainly creates pressure on — do not invent new axes):',
    '  - `fact`             — a factual claim is disputed (specific event, number, date, mechanism).',
    '  - `definition`       — a term is being used loosely or in a non-standard way.',
    '  - `causal`           — A is said to cause B but the mechanism is unstated.',
    '  - `value`            — the moral / aesthetic / preference frame is the live disagreement.',
    '  - `evidence`         — the body relies on an unstated source, study, or anecdote.',
    '  - `logic`            — the conclusion does not follow from the stated premises.',
    '  - `scope`            — the claim over-generalises across populations / time / settings.',
    '  - `source_chain`     — the body forwards / amplifies an unverified upstream source.',
    '  - `anti_amplification` — popularity / virality / engagement is being conflated with truth.',
    '  - `framing`          — the framing pre-loads the answer; the question is being begged.',
    '',
    'Output contract: return ONE compact JSON object on a single line, with NO',
    'prose around it, NO markdown fences, NO comments. The JSON must have',
    'exactly these keys:',
    '  {',
    '    "body": "<one to three sentences, 80–300 chars, plain prose>",',
    '    "disagreementAxis": "<one of the axis vocabulary above>",',
    '    "mechanism": "<short phrase, ≤120 chars, naming the mechanism or move this axis presses on>"',
    '  }',
  ].join('\n');
}

function buildAdversarialUserPayload({
  scene,
  parent,
  slot,
  conversationSummary,
  forceTargetExcerpt,
  forceConcessionMarker,
  axis,
  antiAmplificationCue,
}) {
  const lines = [];
  lines.push(`Source topic bucket: ${scene.topicBucket || 'unknown'}`);
  lines.push(`Source claim summary: ${scene.title || ''}`);
  lines.push('');
  if (parent) {
    lines.push(`Parent argument (argumentType=${parent.argumentType}, depth=${parent.depth}):`);
    lines.push(String(parent.body || ''));
  }
  if (conversationSummary) {
    lines.push('');
    lines.push('Conversation so far (summary):');
    lines.push(conversationSummary);
  }
  lines.push('');
  lines.push(`Your move slot:`);
  lines.push(`  argumentType: ${slot.argumentType}`);
  lines.push(`  depth:        ${slot.depth}`);
  // Axis hint: 'auto' tells Anthropic to pick from the vocabulary;
  // a specific axis string is treated as a suggestion the model may
  // overrule if a different axis is more obviously what the parent
  // creates pressure on.
  if (axis === 'auto' || !axis) {
    lines.push('  disagreementAxis: auto (pick the SINGLE best axis from the vocabulary above)');
  } else {
    lines.push(`  disagreementAxis: ${axis} (suggested; override only if a different axis is more obviously what the parent creates pressure on)`);
  }
  if (antiAmplificationCue) {
    lines.push('');
    lines.push(`Anti-amplification cue: ${antiAmplificationCue}`);
  }
  if (forceTargetExcerpt) {
    lines.push('');
    lines.push(`Quote this short phrase verbatim somewhere in the "body" field: "${forceTargetExcerpt}".`);
  }
  if (forceConcessionMarker) {
    lines.push('');
    lines.push('Include exactly one concession marker phrase in the "body" field: ' + CONCESSION_MARKERS.slice(0, 5).join(' / ') + '.');
  }
  lines.push('');
  lines.push('Return ONE compact JSON object now. Just the JSON, nothing else.');
  return lines.join('\n');
}

/**
 * Parse the model's response. Accepts:
 *   - a JSON object with {body, disagreementAxis, mechanism}
 *   - a JSON object wrapped in ```json ... ``` or ``` ... ``` fences
 *   - raw prose (legacy fallback — treated as body, no axis)
 *
 * Returns { body, axis, mechanism, jsonParsed }. `axis` is null when
 * the response did not contain a recognisable axis.
 */
function parseModelResponse(raw) {
  if (raw == null) return { body: '', axis: null, mechanism: null, jsonParsed: false };
  let text = String(raw).trim();
  // Strip leading/trailing code fences if present.
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  // First-pass: try to parse the whole string as JSON.
  let obj = null;
  try { obj = JSON.parse(text); } catch { /* swallow */ }
  // Second-pass: locate a brace-balanced JSON object embedded in prose.
  if (!obj) {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try { obj = JSON.parse(m[0]); } catch { /* swallow */ }
    }
  }
  if (!obj || typeof obj !== 'object') {
    // If the text LOOKS like a JSON wrapper but didn't parse, Anthropic
    // produced malformed JSON (typically unescaped quotes inside the body
    // string). Clear it so the renderer's validators trigger a retry /
    // deterministic fallback instead of propagating the wrapper-shape
    // string as body.
    if (/^\s*\{[\s\S]{0,80}"body"\s*:/.test(text)) {
      return { body: '', axis: null, mechanism: null, jsonParsed: false };
    }
    return { body: text, axis: null, mechanism: null, jsonParsed: false };
  }
  let body = typeof obj.body === 'string' ? obj.body : '';
  let axisRaw = typeof obj.disagreementAxis === 'string' ? obj.disagreementAxis.toLowerCase().trim() : null;
  let mechanism = typeof obj.mechanism === 'string' ? obj.mechanism.slice(0, 200) : null;

  // Defensive: unwrap one level of nested JSON. Anthropic sometimes returns
  // `{"body": "{\"body\": ...}"}` when prior bodies in the conversation
  // summary contained quotes. We try to parse the inner string ONCE; if it
  // exposes a recognisable axis + body, prefer those.
  if (body && /^\s*\{[\s\S]*"body"\s*:/.test(body)) {
    try {
      const inner = JSON.parse(body);
      if (inner && typeof inner === 'object' && typeof inner.body === 'string') {
        body = inner.body;
        if (!axisRaw && typeof inner.disagreementAxis === 'string') {
          axisRaw = inner.disagreementAxis.toLowerCase().trim();
        }
        if (!mechanism && typeof inner.mechanism === 'string') {
          mechanism = inner.mechanism.slice(0, 200);
        }
      }
    } catch { /* if the inner is malformed, leave the outer body as-is */ }
  }

  // Final defensive check: a body that STILL looks like JSON is unusable
  // prose — clear it so the renderer's validators will fail this attempt
  // and trigger the retry / deterministic fallback path.
  if (body && /^\s*\{[\s\S]{0,80}"body"\s*:/.test(body)) {
    body = '';
  }

  const axis = axisRaw && ALLOWED_AXES.includes(axisRaw) ? axisRaw : null;
  return { body, axis, mechanism, jsonParsed: true };
}

function deterministicAdversarialFallback({ scene, parent, slot, axis, persona }) {
  const skillRole = persona.skillRole;
  const parentBody = parent ? String(parent.body || '') : '';
  const parentClaim = parentBody.slice(0, 80).replace(/\s+/g, ' ').trim();
  const ax = axis || 'source_chain';
  const mechanism = skillRole === 'bot-provocateur'
    ? `The mechanism behind the broader form is what I am defending — not the slogan attached to it.`
    : `Press on the ${ax} of "${parentClaim || scene.title || 'the claim'}": the mechanism is asserted, not shown.`;
  const tail = skillRole === 'bot-provocateur'
    ? `Holding the narrow form intact. ${mechanism} Receipt I will bring next turn: a primary-source line that names the mechanism. Popularity is not doing the evidentiary work here.`
    : `Quote: "${parentClaim || (scene.title || '').slice(0, 60)}". ${mechanism} Evidence debt: a primary source or quote anchor before the broad form holds.`;
  return ensureLengthBounds(tail);
}

/**
 * Generate one move body via Anthropic, with full skill body in the
 * system prompt. Returns:
 *   {
 *     source,                    // 'anthropic' | 'deterministic_fallback'
 *     body,                      // validated prose
 *     chosenAxis,                // axis Anthropic picked (or null on fallback)
 *     mechanism,                 // short phrase from the model (or null)
 *     attempts,
 *     validationFailureReason,
 *     skillHash,
 *     jsonParsed,                // whether the JSON contract was satisfied
 *   }
 */
async function renderAdversarialMove({
  client,
  scene,
  parent,
  slot,
  persona,
  skillBundle,
  conversationSummary,
  axis,                  // pass 'auto' to let Anthropic choose; pass a specific
                         // axis to suggest one the model may override.
  fallbackAxis,          // axis to use if Anthropic returns no parseable axis.
  antiAmplificationCue,
  forceTargetExcerpt,
  maxRetries = 1,
}) {
  const safeFallbackAxis = fallbackAxis || (typeof axis === 'string' && axis !== 'auto' ? axis : 'source_chain');

  if (!client || typeof client.generate !== 'function') {
    return {
      source: 'deterministic_fallback',
      body: deterministicAdversarialFallback({ scene, parent, slot, axis: safeFallbackAxis, persona }),
      chosenAxis: safeFallbackAxis,
      mechanism: null,
      attempts: 0,
      validationFailureReason: 'no_anthropic_client',
      skillHash: persona.skillHash,
      jsonParsed: false,
    };
  }
  const skillRole = persona.skillRole === 'bot-provocateur' ? 'bot-provocateur'
                  : persona.skillRole === 'bot-revocateur' ? 'bot-revocateur'
                  : 'bot-synthesizer';
  const skillBodyText = skillRole === 'bot-provocateur' ? skillBundle.provocateurText
                      : skillRole === 'bot-revocateur' ? skillBundle.revocateurText
                      : skillBundle.provocateurText; // synthesizer borrows provocateur as a doctrine anchor
  const skillHash = persona.skillHash;
  const needsConcession = slot.argumentType === 'concession' || slot.argumentType === 'synthesis';

  const systemPrompt = buildAdversarialSystemPrompt({
    skillRole,
    skillBodyText,
    skillHash,
    scenarioCategory: scene.category || 'xai_adversarial',
  });

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const userPayload = buildAdversarialUserPayload({
      scene,
      parent,
      slot,
      conversationSummary,
      forceTargetExcerpt,
      forceConcessionMarker: needsConcession,
      axis,
      antiAmplificationCue: attempt === 0 ? antiAmplificationCue : `${antiAmplificationCue || ''} (retry: return STRICT JSON, no markdown, keep the body shorter, no canned phrases, no user labels)`,
    });

    let raw;
    try {
      const result = await client.generate({
        systemPrompt,
        userPayload,
        maxTokens: 420, // small bump to fit JSON wrapper
        temperature: needsConcession ? 0.5 : 0.7,
      });
      raw = result.text;
    } catch (err) {
      return {
        source: 'deterministic_fallback',
        body: deterministicAdversarialFallback({ scene, parent, slot, axis: safeFallbackAxis, persona }),
        chosenAxis: safeFallbackAxis,
        mechanism: null,
        attempts: attempt + 1,
        validationFailureReason: `ai_call_failed: ${sanitizeError(String(err && err.message)).slice(0, 200)}`,
        skillHash,
        jsonParsed: false,
      };
    }

    const parsed = parseModelResponse(raw);
    const body = ensureLengthBounds(parsed.body);
    const chosenAxis = parsed.axis || safeFallbackAxis;
    const mechanism = parsed.mechanism;

    const issues = [];
    const cannedHit = hasBannedCannedPhrase(body);
    if (cannedHit) issues.push('banned_canned_phrase');
    const labelHit = hasForbiddenUserLabel(body);
    if (labelHit) issues.push(`forbidden_user_label:${labelHit}`);
    if (needsConcession && !hasConcessionMarker(body)) issues.push('missing_concession_marker');
    if (forceTargetExcerpt && !lower(body).includes(lower(forceTargetExcerpt))) issues.push('missing_target_excerpt');
    if (body.length < 40) issues.push('too_short');

    if (issues.length === 0) {
      return {
        source: 'anthropic',
        body,
        chosenAxis,
        mechanism,
        attempts: attempt + 1,
        validationFailureReason: null,
        skillHash,
        jsonParsed: parsed.jsonParsed,
      };
    }
  }

  return {
    source: 'deterministic_fallback',
    body: deterministicAdversarialFallback({ scene, parent, slot, axis: safeFallbackAxis, persona }),
    chosenAxis: safeFallbackAxis,
    mechanism: null,
    attempts: maxRetries + 1,
    validationFailureReason: 'validation_failed_after_retries',
    skillHash,
    jsonParsed: false,
  };
}

module.exports = {
  renderAdversarialMove,
  buildAdversarialSystemPrompt,
  buildAdversarialUserPayload,
  parseModelResponse,
  ensureLengthBounds,
  hasConcessionMarker,
  hasBannedCannedPhrase,
  hasForbiddenUserLabel,
  deterministicAdversarialFallback,
  CONCESSION_MARKERS,
  BANNED_CANNED_PHRASES,
  FORBIDDEN_USER_LABELS,
  ALLOWED_AXES,
};
