/**
 * Stage 6.1.5.1 — Anthropic argument annotator wrapper.
 *
 * Uses the existing `claudeMessagesClient` adapter. Returns an
 * `AnthropicArgumentAnnotation` (or a deterministic fallback when the
 * Anthropic call fails / returns invalid JSON).
 *
 * Never logs the API key, Authorization header, or raw request body.
 */
const { buildAnnotationPrompt } = require('./anthropicAnnotationPrompt');
const { deterministicAnnotate } = require('./deterministicArgumentAnnotator');
const claudeClient = require('./claudeMessagesClient');

const VALID_STANCE_VALUES = new Set([
  'strong_agree', 'weak_agree', 'mixed_agree_disagree', 'weak_disagree',
  'strong_disagree', 'unclear', 'tangent', 'joke_or_meme',
  'receipt_request', 'quote_request',
]);

const FORBIDDEN_TOKENS = [
  'liar', 'dishonest', 'bad faith', 'manipulative', 'manipulation',
  'extremist', 'propagandist', 'winner', 'loser', 'stupid', 'idiot',
  // Stage 6.1.5.2 anti-amplification additions: never apply these as
  // user labels. Use coordination-risk / amplification-risk fields
  // instead, which describe TEXT patterns not people.
  'troll', 'astroturf', 'astroturfer',
];

const VALID_POLITICAL_FRAMES = new Set([
  'election_process', 'governance', 'foreign_policy', 'economic_policy',
  'civil_rights', 'public_safety', 'institutional_trust', 'culture_war',
  'climate_energy', 'health_policy', 'labor_business',
  'technology_platforms', 'unclear', 'non_political',
]);
const VALID_POLITICAL_VALENCES = new Set([
  'pro_institutional', 'anti_institutional', 'left_leaning_frame',
  'right_leaning_frame', 'populist_frame', 'establishment_frame',
  'anti_media_frame', 'pro_media_frame', 'anti_platform_frame',
  'pro_platform_frame', 'unclear', 'not_applicable',
]);
const VALID_EVIDENTIARY_RISKS = new Set(['low', 'medium', 'high', 'unknown']);
const VALID_AMPLIFICATION_RISKS = new Set(['none_observed', 'low', 'medium', 'high']);
const VALID_GAME_TREATMENTS = new Set([
  'allow_as_opinion_no_factual_credit', 'ask_for_receipt',
  'ask_for_quote_anchor', 'ask_for_scope_narrowing',
  'ask_for_primary_source', 'suggest_branch_to_context_thread',
  'mark_as_unresolved_issue_debt', 'allow_point_standing_after_evidence',
  'suppress_score_gain_for_amplification_only',
]);
const AMPLIFICATION_SIGNAL_KEYS = [
  'repeated_claim_language', 'high_engagement_low_evidence',
  'slogan_or_chant_like', 'copy_paste_risk', 'outrage_hook',
  'link_without_receipt_context', 'screenshot_without_primary_source',
  'appeal_to_crowd_size', 'appeal_to_virality', 'unknown_source_chain',
];

function clamp01(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  if (n < 0) return 0; if (n > 1) return 1; return n;
}

/** Strip secret-shape strings from any logged error. */
function sanitizeAnnotationError(err) {
  const msg = String(err && err.message ? err.message : err || 'unknown');
  return claudeClient.sanitize(msg).slice(0, 240);
}

function tryParseJson(text) {
  if (!text) return null;
  // The model may wrap the JSON in code fences; strip them.
  let trimmed = String(text).trim();
  if (trimmed.startsWith('```')) {
    trimmed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  }
  try { return JSON.parse(trimmed); } catch { return null; }
}

function sanitizeStringField(value) {
  const s = String(value || '');
  const lower = s.toLowerCase();
  for (const t of FORBIDDEN_TOKENS) {
    if (lower.includes(t)) return '';
  }
  return s;
}

/**
 * Validate + normalize a parsed annotation. Returns null on failure.
 */
function validateAnnotation(parsed, expected) {
  if (!parsed || typeof parsed !== 'object') return null;
  // Required scalar fields with safe defaults.
  const required = ['moveId', 'argumentType', 'side'];
  for (const k of required) {
    if (typeof parsed[k] !== 'string' || !parsed[k]) return null;
  }
  if (parsed.userReviewRequired !== true) return null;

  // Anchor sub-shapes with safe defaults if missing.
  const op = parsed.opinionVector || {};
  parsed.opinionVector = {
    broadAgreement: clamp01(op.broadAgreement),
    narrowAgreement: clamp01(op.narrowAgreement),
    broadDisagreement: clamp01(op.broadDisagreement),
    narrowDisagreement: clamp01(op.narrowDisagreement),
    coexistenceScore: clamp01(op.coexistenceScore),
    uncertaintyScore: clamp01(op.uncertaintyScore),
    emotionalValence: typeof op.emotionalValence === 'string' ? op.emotionalValence : 'unclear',
    heatLevel: typeof op.heatLevel === 'string' ? op.heatLevel : 'cold',
  };
  const adv = parsed.agreementDisagreementVector || {};
  parsed.agreementDisagreementVector = {
    agreementScore: clamp01(adv.agreementScore),
    disagreementScore: clamp01(adv.disagreementScore),
    coexistenceScore: clamp01(adv.coexistenceScore),
    uncertaintyScore: clamp01(adv.uncertaintyScore),
    primaryStance: VALID_STANCE_VALUES.has(adv.primaryStance) ? adv.primaryStance : 'unclear',
    agreementType: typeof adv.agreementType === 'string' ? adv.agreementType : 'none',
    disagreementType: typeof adv.disagreementType === 'string' ? adv.disagreementType : 'none',
    replyFunction: typeof adv.replyFunction === 'string' ? adv.replyFunction : 'unclear',
    scalarRationale: typeof adv.scalarRationale === 'string' ? adv.scalarRationale : '',
    userReviewRequired: true,
  };
  const id = parsed.issueDebtSignal || {};
  parsed.issueDebtSignal = {
    axis: typeof id.axis === 'string' ? id.axis : 'none',
    created: Boolean(id.created),
    repaired: Boolean(id.repaired),
    unresolved: Boolean(id.unresolved),
    repairSuggestion: typeof id.repairSuggestion === 'string' ? id.repairSuggestion : 'none',
  };
  const gi = parsed.gameImplication || {};
  parsed.gameImplication = {
    pressureCreated: Boolean(gi.pressureCreated),
    pressureAxis: typeof gi.pressureAxis === 'string' ? gi.pressureAxis : 'none',
    responderCanRecover: Boolean(gi.responderCanRecover),
    concessionWouldHelp: Boolean(gi.concessionWouldHelp),
    branchRecommended: Boolean(gi.branchRecommended),
    playableTensionScore: clamp01(gi.playableTensionScore),
    suggestedUiNudge: typeof gi.suggestedUiNudge === 'string' ? sanitizeStringField(gi.suggestedUiNudge) || null : null,
    suggestedQualifierCode: typeof gi.suggestedQualifierCode === 'string' ? sanitizeStringField(gi.suggestedQualifierCode) || null : null,
  };
  parsed.qualifierCodes = Array.isArray(parsed.qualifierCodes) ? parsed.qualifierCodes.filter((c) => typeof c === 'string' && c) : [];
  parsed.categoryCodes = Array.isArray(parsed.categoryCodes) ? parsed.categoryCodes.filter((c) => typeof c === 'string' && c) : [];
  parsed.secondaryRhetoricalArchetypes = Array.isArray(parsed.secondaryRhetoricalArchetypes) ? parsed.secondaryRhetoricalArchetypes.filter((c) => typeof c === 'string') : [];
  parsed.evidenceSignals = parsed.evidenceSignals || {};
  parsed.threadSignals = parsed.threadSignals || {};
  parsed.modelJustification = parsed.modelJustification || { shortReason: '', observableTextFeatures: [], uncertaintyNotes: [] };

  // Anti-amplification doctrine fields (Stage 6.1.5.2). Default to the
  // conservative position: unclear frame, no amplification observed, no
  // factual-standing suppression — Anthropic must affirmatively flag
  // these. We never silently fabricate a political label.
  const rc = parsed.deterministicRuleCandidate || {};
  parsed.deterministicRuleCandidate = {
    shouldCreateRule: Boolean(rc.shouldCreateRule),
    ruleName: typeof rc.ruleName === 'string' ? rc.ruleName : null,
    ruleCondition: typeof rc.ruleCondition === 'string' ? rc.ruleCondition : null,
    uiNudge: typeof rc.uiNudge === 'string' ? rc.uiNudge : null,
    shouldSuppressScoreGainForAmplificationOnly: Boolean(rc.shouldSuppressScoreGainForAmplificationOnly),
    shouldAskForPrimarySource: Boolean(rc.shouldAskForPrimarySource),
    shouldMarkEvidenceRiskHigh: Boolean(rc.shouldMarkEvidenceRiskHigh),
    shouldShowAmplificationRiskBadge: Boolean(rc.shouldShowAmplificationRiskBadge),
    shouldTreatAsOpinionNoFactualCredit: Boolean(rc.shouldTreatAsOpinionNoFactualCredit),
    shouldCreateIssueDebtForUnsupportedClaim: Boolean(rc.shouldCreateIssueDebtForUnsupportedClaim),
    shouldOfferScopeNarrowingForPoliticalGeneralization: Boolean(rc.shouldOfferScopeNarrowingForPoliticalGeneralization),
    shouldOfferQuoteAnchorForAllegation: Boolean(rc.shouldOfferQuoteAnchorForAllegation),
    shouldBranchContextIfClaimNeedsBackground: Boolean(rc.shouldBranchContextIfClaimNeedsBackground),
  };
  parsed.politicalIssueFrame = VALID_POLITICAL_FRAMES.has(parsed.politicalIssueFrame) ? parsed.politicalIssueFrame : 'unclear';
  parsed.politicalValence = VALID_POLITICAL_VALENCES.has(parsed.politicalValence) ? parsed.politicalValence : 'unclear';
  parsed.evidentiaryRisk = VALID_EVIDENTIARY_RISKS.has(parsed.evidentiaryRisk) ? parsed.evidentiaryRisk : 'unknown';
  parsed.amplificationRisk = VALID_AMPLIFICATION_RISKS.has(parsed.amplificationRisk) ? parsed.amplificationRisk : 'none_observed';
  parsed.recommendedGameTreatment = VALID_GAME_TREATMENTS.has(parsed.recommendedGameTreatment) ? parsed.recommendedGameTreatment : 'allow_as_opinion_no_factual_credit';
  parsed.platformSupportWarning = Boolean(parsed.platformSupportWarning);
  parsed.justification = typeof parsed.justification === 'string' ? parsed.justification.slice(0, 800) : '';
  const ampIn = parsed.amplificationSignals || {};
  const ampOut = {};
  for (const k of AMPLIFICATION_SIGNAL_KEYS) ampOut[k] = Boolean(ampIn[k]);
  parsed.amplificationSignals = ampOut;
  parsed.schemaVersion = 2;
  parsed.scenarioId = parsed.scenarioId || expected?.scenarioId || '';
  parsed.roomId = parsed.roomId ?? expected?.roomId ?? null;
  parsed.parentMoveId = parsed.parentMoveId ?? expected?.parentMoveId ?? null;
  parsed.messageCategory = typeof parsed.messageCategory === 'string' ? parsed.messageCategory : 'unclear';
  parsed.primaryRhetoricalArchetype = typeof parsed.primaryRhetoricalArchetype === 'string' ? parsed.primaryRhetoricalArchetype : 'unclear';

  // Final forbidden-token scan across all string fields.
  const blob = JSON.stringify(parsed).toLowerCase();
  for (const t of FORBIDDEN_TOKENS) {
    if (blob.includes(t)) return null;
  }
  parsed.userReviewRequired = true;
  parsed.annotationSource = parsed.annotationSource || 'anthropic';
  return parsed;
}

function buildExpected({ scenario, move, parent }) {
  return {
    scenarioId: scenario.scenarioId,
    roomId: scenario.roomId || null,
    parentMoveId: parent?.moveId || null,
  };
}

function fallbackAnnotation({ scenario, move, parent, thread, body, deterministicVector, reason }) {
  return deterministicAnnotate({ scenario, move, parent, thread, body, deterministicVector, reason: reason || 'fallback' });
}

/**
 * Issue one annotation call. Returns the annotation + source label. Never
 * throws — annotation failure should never block the corpus run.
 */
async function annotateMove({ client, scenario, move, parent, thread, body, deterministicVector }) {
  if (!client || typeof client.generate !== 'function') {
    return fallbackAnnotation({
      scenario, move, parent, thread, body, deterministicVector,
      reason: 'no_anthropic_client',
    });
  }

  const prompt = buildAnnotationPrompt({
    scenarioId: scenario.scenarioId,
    roomId: scenario.roomId || null,
    rootClaim: scenario.rootClaim || scenario.resolution || '',
    topicResolution: scenario.resolution || null,
    topicKeywords: scenario.resolutionKeywords || [],
    thread,
    parent,
    moveId: move.moveId,
    argumentType: move.argumentType,
    side: move.side || 'unknown',
    disagreementAxis: move.disagreementAxis || null,
    body: body || move.body || '',
    targetExcerpt: move.targetExcerpt || null,
    evidence: move.evidence || null,
    deterministicVector,
  });

  const expected = buildExpected({ scenario, move, parent });

  // First attempt.
  try {
    const r = await client.generate({ systemPrompt: prompt.system, userPayload: prompt.user, maxTokens: 1024, temperature: 0.2 });
    const parsed = tryParseJson(r.text);
    const validated = validateAnnotation(parsed, expected);
    if (validated) { validated.annotationSource = 'anthropic'; return validated; }
  } catch (err) {
    // First attempt failed — fall through to retry.
    sanitizeAnnotationError(err); // discard sanitized message; caller observes the eventual annotationSource
  }

  // Single retry: ask for "fix JSON only".
  try {
    const r2 = await client.generate({
      systemPrompt: prompt.system,
      userPayload: prompt.user + '\n\nReminder: respond with ONE compact JSON object only, no prose. All required keys must be present. userReviewRequired must be true.',
      maxTokens: 1024,
      temperature: 0.1,
    });
    const parsed = tryParseJson(r2.text);
    const validated = validateAnnotation(parsed, expected);
    if (validated) { validated.annotationSource = 'anthropic_retry'; return validated; }
  } catch (err) {
    sanitizeAnnotationError(err);
  }

  return fallbackAnnotation({
    scenario, move, parent, thread, body, deterministicVector,
    reason: 'anthropic_invalid_or_error',
  });
}

module.exports = {
  annotateMove,
  validateAnnotation,
  fallbackAnnotation,
  sanitizeAnnotationError,
  tryParseJson,
  FORBIDDEN_TOKENS,
};
