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
    'Output contract: return ONLY the argument body text. No prefix, no quotes around the whole thing, no JSON, no markdown headers. One to three sentences. Aim for 80–300 characters.',
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
  if (axis) lines.push(`  disagreementAxis: ${axis}`);
  if (antiAmplificationCue) {
    lines.push('');
    lines.push(`Anti-amplification cue: ${antiAmplificationCue}`);
  }
  if (forceTargetExcerpt) {
    lines.push('');
    lines.push(`Quote this short phrase verbatim somewhere in your body: "${forceTargetExcerpt}".`);
  }
  if (forceConcessionMarker) {
    lines.push('');
    lines.push('Include exactly one concession marker phrase: ' + CONCESSION_MARKERS.slice(0, 5).join(' / ') + '.');
  }
  lines.push('');
  lines.push('Write the body now. Pure prose. No JSON, no markdown.');
  return lines.join('\n');
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
 *   { source, body, attempts, validationFailureReason, skillHash }
 * where `source` is `anthropic` | `deterministic_fallback`.
 */
async function renderAdversarialMove({
  client,
  scene,
  parent,
  slot,
  persona,
  skillBundle,
  conversationSummary,
  axis,
  antiAmplificationCue,
  forceTargetExcerpt,
  maxRetries = 1,
}) {
  if (!client || typeof client.generate !== 'function') {
    return {
      source: 'deterministic_fallback',
      body: deterministicAdversarialFallback({ scene, parent, slot, axis, persona }),
      attempts: 0,
      validationFailureReason: 'no_anthropic_client',
      skillHash: persona.skillHash,
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
      antiAmplificationCue: attempt === 0 ? antiAmplificationCue : `${antiAmplificationCue || ''} (retry: keep the body shorter, no canned phrases, no user labels)`,
    });

    let raw;
    try {
      const result = await client.generate({
        systemPrompt,
        userPayload,
        maxTokens: 360,
        temperature: needsConcession ? 0.5 : 0.7,
      });
      raw = result.text;
    } catch (err) {
      return {
        source: 'deterministic_fallback',
        body: deterministicAdversarialFallback({ scene, parent, slot, axis, persona }),
        attempts: attempt + 1,
        validationFailureReason: `ai_call_failed: ${sanitizeError(String(err && err.message)).slice(0, 200)}`,
        skillHash,
      };
    }

    const body = ensureLengthBounds(raw);
    const issues = [];
    const cannedHit = hasBannedCannedPhrase(body);
    if (cannedHit) issues.push('banned_canned_phrase');
    const labelHit = hasForbiddenUserLabel(body);
    if (labelHit) issues.push(`forbidden_user_label:${labelHit}`);
    if (needsConcession && !hasConcessionMarker(body)) issues.push('missing_concession_marker');
    if (forceTargetExcerpt && !lower(body).includes(lower(forceTargetExcerpt))) issues.push('missing_target_excerpt');
    if (body.length < 40) issues.push('too_short');

    if (issues.length === 0) {
      return { source: 'anthropic', body, attempts: attempt + 1, validationFailureReason: null, skillHash };
    }
  }

  return {
    source: 'deterministic_fallback',
    body: deterministicAdversarialFallback({ scene, parent, slot, axis, persona }),
    attempts: maxRetries + 1,
    validationFailureReason: 'validation_failed_after_retries',
    skillHash,
  };
}

module.exports = {
  renderAdversarialMove,
  buildAdversarialSystemPrompt,
  buildAdversarialUserPayload,
  ensureLengthBounds,
  hasConcessionMarker,
  hasBannedCannedPhrase,
  hasForbiddenUserLabel,
  deterministicAdversarialFallback,
  CONCESSION_MARKERS,
  BANNED_CANNED_PHRASES,
  FORBIDDEN_USER_LABELS,
};
