/**
 * Stage 6.5 — Heat-aware Anthropic move renderer for the open-room
 * engagement runner. Wraps the existing skill body in a HOT-context
 * preamble so the model picks a move that answers the *unresolved
 * pressure* the open-room HOT model surfaced, not a round-robin axis.
 *
 * Hard rules (mirrored from CLAUDE.md and both bot SKILL.md files):
 *   - HOT is friction / activity / unresolved pressure. NOT popularity,
 *     virality, truth-credit, abuse.
 *   - Never label another speaker (liar / dishonest / bad faith /
 *     manipulative / extremist / propagandist / troll / bot /
 *     astroturfer).
 *   - Banned canned phrases stay banned.
 *   - Strict JSON output (`body`, `disagreementAxis`, `mechanism`,
 *     `targetExcerpt`). Two retries, then deterministic fallback.
 *   - Never logs Authorization / API keys (claudeMessagesClient
 *     already sanitises). Never logs raw bodies in error paths.
 *
 * Pure Node CommonJS. No React, no Supabase.
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

const ALLOWED_AXES = [
  'fact', 'definition', 'causal', 'value', 'evidence', 'logic', 'scope',
  'source_chain', 'anti_amplification', 'framing',
];

// Heat reason code → suggested axis families. We surface these to the
// model as hints; the final axis pick is still up to the model and
// must come from ALLOWED_AXES.
const REASON_CODE_AXIS_HINTS = {
  source_chain_debt: ['source_chain', 'evidence'],
  evidence_debt: ['evidence', 'fact'],
  scope_fight: ['scope', 'definition'],
  definition_fight: ['definition', 'scope'],
  logic_fight: ['logic', 'causal'],
  causal_fight: ['causal', 'logic'],
  no_rebuttal: ['evidence', 'scope', 'definition', 'causal'],
  unreplied_latest: ['evidence', 'scope', 'definition'],
  recent_activity: [],
  stale_but_promising: ['evidence', 'scope'],
  max_depth_unresolved: [],
  needs_concession_or_synthesis: [],
};

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

function hasForbiddenUserLabel(text) {
  const lc = lower(text);
  for (const label of FORBIDDEN_USER_LABELS) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`\\b(?:you|they|he|she)\\s+(?:are|is)\\s+(?:a |an )?${escaped}s?\\b`, 'i'),
      new RegExp(`\\b(?:you|they|he|she)['’]re\\s+(?:a |an )?${escaped}s?\\b`, 'i'),
      new RegExp(`\\b(?:you|they|he|she)['’]s\\s+(?:a |an )?${escaped}s?\\b`, 'i'),
      new RegExp(`\\bcalls?\\s+(?:them|him|her)\\s+(?:a |an )?${escaped}s?\\b`, 'i'),
      new RegExp(`\\b(?:they|he|she)\\s+(?:acts?|behaves?)\\s+(?:like)\\s+(?:a |an )?${escaped}s?\\b`, 'i'),
    ];
    if (patterns.some((re) => re.test(lc))) return label;
  }
  return null;
}

function looksAbusiveBody(text) {
  const lc = lower(text);
  const tokens = ['<threat>', '<doxx>', '<sexual-abuse>', '<protected-class-attack>', '<slur>', 'kill yourself', 'should be killed'];
  return tokens.some((t) => lc.includes(t));
}

/**
 * Build the HOT-aware system prompt. The model sees:
 *   1. The skill body verbatim (provocateur or revocateur).
 *   2. A HOT-context preamble that names the heat band, reason codes,
 *      recommended action, and recent axis usage.
 *   3. The hard rules + strict-JSON output contract.
 */
function buildEngagementSystemPrompt({ skillRole, skillBodyText, skillHash, heatContext }) {
  const reasonCodes = Array.isArray(heatContext?.reasonCodes) ? heatContext.reasonCodes : [];
  const recentAxes = Array.isArray(heatContext?.recentAxes) ? heatContext.recentAxes : [];
  const recommendedAction = heatContext?.recommendedAction || 'countermechanism';
  const heatBand = heatContext?.heatBand || 'warming';
  const moveCount = typeof heatContext?.moveCount === 'number' ? heatContext.moveCount : 0;
  const axisHintSet = new Set();
  for (const code of reasonCodes) {
    const hints = REASON_CODE_AXIS_HINTS[code] || [];
    for (const a of hints) axisHintSet.add(a);
  }
  const axisHints = Array.from(axisHintSet);
  // Anti-repeat: ask the model to *not* pick whichever axis was used in
  // the latest two moves (HOT skill rule).
  const bannedAxes = recentAxes.length >= 2 && recentAxes[0] === recentAxes[1] ? [recentAxes[0]] : [];

  return [
    `You are operating under the **${skillRole}** skill (sha-prefix ${skillHash}).`,
    `MODE: dynamic_room_engagement. You are entering an EXISTING dev/test CDiscourse room.`,
    'The full skill body (read fresh from disk on this run) is below. Follow it.',
    '',
    '────────── BEGIN SKILL BODY ──────────',
    String(skillBodyText || '').trim(),
    '────────── END SKILL BODY ──────────',
    '',
    'HOT-room context (from the deterministic openRoomHeatModel):',
    `  heat band:          ${heatBand}    (heat = unresolved argumentative friction, NOT popularity / virality / truth)`,
    `  move count so far:  ${moveCount}`,
    `  active reason codes: ${reasonCodes.length ? reasonCodes.join(', ') : '(none)'}`,
    `  recommended action:  ${recommendedAction}`,
    axisHints.length ? `  axis hints from reason codes (model picks final axis): ${axisHints.join(', ')}` : '  axis hints: (none — pick the axis the parent body most plainly creates pressure on)',
    recentAxes.length ? `  recent axes used in this room (latest first): ${recentAxes.slice(0, 5).join(', ')}` : '  recent axes used in this room: (none)',
    bannedAxes.length ? `  AVOID repeating this axis again: ${bannedAxes.join(', ')} (it was used in the last two moves)` : '',
    '',
    'Hard rules (these override any conflict in the skill body):',
    '- You are a test bot account in a dev environment. You are NOT a real X user. Never claim to be a real X user. Never claim a personal biography.',
    '- HOT does not mean rude. Sharper argument friction, not aggression. Engagement is never converted into truth credit. Popularity / virality / repetition is not evidence.',
    '- Do NOT classify the other speaker. Never label any user as liar, dishonest, bad faith, manipulative, extremist, propagandist, troll, bot, or astroturfer. Attack the move, not the person.',
    '- Hostile source material is converted into structured pressure, not reproduced. Do NOT include slurs, threats, doxxing, sexualised abuse, or protected-class attacks.',
    '- Do NOT keyword-stuff to satisfy validation. Write a natural defense or challenge that actually answers the unresolved pressure. Stage 6.2 advisory rules accept natural replies.',
    '- Avoid repeating the same axis more than twice in a row (see context above). If the last two moves already pressed one axis, rotate to an adjacent one the parent supports.',
    '- Banned canned phrases (do NOT use): "Counter to the previous point", "The causal disagreement is the heart of it", "The evidence disagreement is the heart of it", "This evidence is on point", "Pushing back on the rebuttal", "narrow back to", "On the [keyword] point".',
    '',
    'Disagreement-axis vocabulary you may pick from:',
    '  fact / definition / causal / value / evidence / logic / scope / source_chain / anti_amplification / framing',
    '',
    'Output contract: return ONE compact JSON object on a single line, no markdown fences, no prose around it, no comments. Exact keys:',
    '  {',
    '    "body": "<one to three sentences, 80-300 chars, plain prose, no @handles, no URLs, no emails>",',
    '    "disagreementAxis": "<one of the axis vocabulary above>",',
    '    "mechanism": "<short phrase, <=120 chars, naming the mechanism this axis presses on>",',
    '    "targetExcerpt": "<short verbatim quote from the parent body you are responding to, <=120 chars>"',
    '  }',
  ].filter(Boolean).join('\n');
}

function buildEngagementUserPayload({
  scene,
  parent,
  slot,
  conversationSummary,
  forceTargetExcerpt,
  forceConcessionMarker,
  heatContext,
  retryNote,
}) {
  const lines = [];
  lines.push(`Room topic (redacted, may be a corpus suffix): ${scene.titleRedacted || scene.title || '(unknown)'}`);
  lines.push('');
  if (parent) {
    lines.push(`Parent / target argument (argumentType=${parent.argumentType}, depth=${parent.depth}):`);
    lines.push(String(parent.body || '').slice(0, 800));
  }
  if (conversationSummary) {
    lines.push('');
    lines.push('Conversation so far (latest 5 moves, oldest first):');
    lines.push(conversationSummary);
  }
  lines.push('');
  lines.push('Your move slot:');
  lines.push(`  argumentType:       ${slot.argumentType}`);
  lines.push(`  depth (1-indexed):  ${slot.depth}`);
  lines.push(`  recommended action: ${heatContext?.recommendedAction || 'countermechanism'}`);
  lines.push(`  heat band:          ${heatContext?.heatBand || 'warming'}`);
  if (forceTargetExcerpt) {
    lines.push('');
    lines.push(`Quote this short phrase verbatim somewhere in the "body" field: "${String(forceTargetExcerpt).slice(0, 160)}".`);
  }
  if (forceConcessionMarker) {
    lines.push('');
    lines.push('Include exactly one concession marker phrase in the "body" field: ' + CONCESSION_MARKERS.slice(0, 5).join(' / ') + '.');
  }
  if (retryNote) {
    lines.push('');
    lines.push(`Retry note: ${retryNote}`);
  }
  lines.push('');
  lines.push('Return ONE compact JSON object now. Just the JSON, nothing else.');
  return lines.join('\n');
}

/**
 * Parse the model's response. Same defensive strategy as the
 * xAI adversarial renderer (single-pass unwrap of nested JSON,
 * clear when the body still looks like a JSON wrapper).
 */
function parseModelResponse(raw) {
  if (raw == null) return { body: '', axis: null, mechanism: null, targetExcerpt: null, jsonParsed: false };
  let text = String(raw).trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  let obj = null;
  try { obj = JSON.parse(text); } catch { /* swallow */ }
  if (!obj) {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try { obj = JSON.parse(m[0]); } catch { /* swallow */ }
    }
  }
  if (!obj || typeof obj !== 'object') {
    if (/^\s*\{[\s\S]{0,80}"body"\s*:/.test(text)) {
      return { body: '', axis: null, mechanism: null, targetExcerpt: null, jsonParsed: false };
    }
    return { body: text, axis: null, mechanism: null, targetExcerpt: null, jsonParsed: false };
  }
  let body = typeof obj.body === 'string' ? obj.body : '';
  let axisRaw = typeof obj.disagreementAxis === 'string' ? obj.disagreementAxis.toLowerCase().trim() : null;
  let mechanism = typeof obj.mechanism === 'string' ? obj.mechanism.slice(0, 200) : null;
  let targetExcerpt = typeof obj.targetExcerpt === 'string' ? obj.targetExcerpt.slice(0, 200) : null;

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
        if (!targetExcerpt && typeof inner.targetExcerpt === 'string') {
          targetExcerpt = inner.targetExcerpt.slice(0, 200);
        }
      }
    } catch { /* leave outer body as-is */ }
  }

  if (body && /^\s*\{[\s\S]{0,80}"body"\s*:/.test(body)) {
    body = '';
  }

  const axis = axisRaw && ALLOWED_AXES.includes(axisRaw) ? axisRaw : null;
  return { body, axis, mechanism, targetExcerpt, jsonParsed: true };
}

function deterministicFallbackBody({ skillRole, parent, heatContext }) {
  const parentBody = parent ? String(parent.body || '') : '';
  const parentClaim = parentBody.slice(0, 80).replace(/\s+/g, ' ').trim();
  const recommendedAction = heatContext?.recommendedAction || 'countermechanism';
  if (skillRole === 'bot-provocateur') {
    return ensureLengthBounds(
      `Holding the narrow form intact: the broader mechanism is still standing once we put the slogan to one side. ` +
      `Next receipt I will bring: a primary-source line that names the mechanism. Popularity is not doing the work here.`
    );
  }
  if (recommendedAction === 'first_rebuttal') {
    return ensureLengthBounds(
      `Quote: "${parentClaim || 'the root claim'}". The body asserts a mechanism without showing one. ` +
      `Evidence debt: a primary source or named mechanism before the broad form holds.`
    );
  }
  if (recommendedAction === 'source_chain_pressure') {
    return ensureLengthBounds(
      `Quote: "${parentClaim || 'the latest move'}". The source chain stops at one screenshot or one account. ` +
      `Bring the primary record — origin, date, public verification — before this counts as evidence.`
    );
  }
  return ensureLengthBounds(
    `Quote: "${parentClaim || 'the latest move'}". The named axis is not yet answered. ` +
    `Evidence debt: a named source or a stated mechanism that survives a single counterexample.`
  );
}

/**
 * Generate one heat-aware move via Anthropic. Returns:
 *   {
 *     source,                     // 'anthropic' | 'deterministic_fallback'
 *     body,                       // validated prose
 *     chosenAxis,
 *     mechanism,
 *     targetExcerpt,
 *     attempts,
 *     validationFailureReason,
 *     skillHash,
 *     jsonParsed,
 *   }
 */
async function renderEngagementMove({
  client,
  scene,
  parent,
  slot,
  persona,
  skillBundle,
  conversationSummary,
  heatContext,
  fallbackAxis,
  forceTargetExcerpt,
  maxRetries = 2,
}) {
  const safeFallbackAxis = fallbackAxis || 'evidence';

  if (!client || typeof client.generate !== 'function') {
    return {
      source: 'deterministic_fallback',
      body: deterministicFallbackBody({ skillRole: persona.skillRole, parent, heatContext }),
      chosenAxis: safeFallbackAxis,
      mechanism: null,
      targetExcerpt: forceTargetExcerpt || null,
      attempts: 0,
      validationFailureReason: 'no_anthropic_client',
      skillHash: persona.skillHash,
      jsonParsed: false,
    };
  }

  const skillRole = persona.skillRole === 'bot-provocateur' ? 'bot-provocateur' : 'bot-revocateur';
  const skillBodyText = skillRole === 'bot-provocateur'
    ? skillBundle.provocateurText
    : skillBundle.revocateurText;
  const skillHash = persona.skillHash;
  const needsConcession = slot.argumentType === 'concession' || slot.argumentType === 'synthesis';

  const systemPrompt = buildEngagementSystemPrompt({
    skillRole, skillBodyText, skillHash, heatContext,
  });

  let lastIssues = [];
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const retryNote = attempt === 0 ? null
      : `Return STRICT JSON. No markdown fences. Body 80-300 chars. ` +
        `Avoid banned canned phrases. Never label the other speaker. ` +
        `Last failure: ${lastIssues.join(', ')}.`;
    const userPayload = buildEngagementUserPayload({
      scene, parent, slot, conversationSummary,
      forceTargetExcerpt, forceConcessionMarker: needsConcession,
      heatContext, retryNote,
    });

    let raw;
    try {
      const result = await client.generate({
        systemPrompt,
        userPayload,
        maxTokens: 480,
        temperature: needsConcession ? 0.5 : 0.7,
      });
      raw = result && result.text;
    } catch (err) {
      return {
        source: 'deterministic_fallback',
        body: deterministicFallbackBody({ skillRole, parent, heatContext }),
        chosenAxis: safeFallbackAxis,
        mechanism: null,
        targetExcerpt: forceTargetExcerpt || null,
        attempts: attempt + 1,
        validationFailureReason: `ai_call_failed: ${sanitizeError(String(err && err.message || '')).slice(0, 200)}`,
        skillHash,
        jsonParsed: false,
      };
    }

    const parsed = parseModelResponse(raw);
    const body = ensureLengthBounds(parsed.body);
    const chosenAxis = parsed.axis || safeFallbackAxis;
    const mechanism = parsed.mechanism;
    const targetExcerpt = parsed.targetExcerpt || forceTargetExcerpt || null;

    const issues = [];
    if (hasBannedCannedPhrase(body)) issues.push('banned_canned_phrase');
    const labelHit = hasForbiddenUserLabel(body);
    if (labelHit) issues.push(`forbidden_user_label:${labelHit}`);
    if (looksAbusiveBody(body)) issues.push('abusive_body_tokens');
    if (needsConcession && !hasConcessionMarker(body)) issues.push('missing_concession_marker');
    if (forceTargetExcerpt && !lower(body).includes(lower(forceTargetExcerpt))) issues.push('missing_target_excerpt');
    if (body.length < 40) issues.push('too_short');
    // Anti-repeat: if the model returned the banned axis (last two same),
    // we accept the body but flag the axis so the runner can demote it.
    const recentAxes = Array.isArray(heatContext?.recentAxes) ? heatContext.recentAxes : [];
    const axisLockedOut = recentAxes.length >= 2 && recentAxes[0] === recentAxes[1] && chosenAxis === recentAxes[0];

    if (issues.length === 0) {
      return {
        source: 'anthropic',
        body,
        chosenAxis,
        mechanism,
        targetExcerpt,
        attempts: attempt + 1,
        validationFailureReason: null,
        skillHash,
        jsonParsed: parsed.jsonParsed,
        axisRepeatHit: axisLockedOut,
      };
    }
    lastIssues = issues;
  }

  return {
    source: 'deterministic_fallback',
    body: deterministicFallbackBody({ skillRole, parent, heatContext }),
    chosenAxis: safeFallbackAxis,
    mechanism: null,
    targetExcerpt: forceTargetExcerpt || null,
    attempts: maxRetries + 1,
    validationFailureReason: `validation_failed_after_retries: ${lastIssues.join(', ')}`,
    skillHash,
    jsonParsed: false,
  };
}

module.exports = {
  renderEngagementMove,
  buildEngagementSystemPrompt,
  buildEngagementUserPayload,
  parseModelResponse,
  ensureLengthBounds,
  hasConcessionMarker,
  hasBannedCannedPhrase,
  hasForbiddenUserLabel,
  looksAbusiveBody,
  deterministicFallbackBody,
  CONCESSION_MARKERS,
  BANNED_CANNED_PHRASES,
  FORBIDDEN_USER_LABELS,
  ALLOWED_AXES,
  REASON_CODE_AXIS_HINTS,
};
