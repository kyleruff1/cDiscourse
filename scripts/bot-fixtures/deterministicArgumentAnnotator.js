/**
 * Stage 6.1.5.1 — Deterministic fallback annotator.
 *
 * Used when Anthropic refuses / errors / returns invalid JSON. Produces a
 * full `AnthropicArgumentAnnotation` shape from existing local fields:
 * argumentType, disagreementAxis, targetExcerpt, evidence, body, parent.
 * Imports the existing JS-side stance scalar + mixed-agreement twin so we
 * inherit Stage 6.1.3.3's deterministic logic.
 */
const { computeAgreementDisagreementVector } = require('../engagement-intelligence/agreementScalarJs');
const { classifyMixedAgreement, toGradingFlags } = require('../engagement-intelligence/mixedAgreementTaxonomyJs');

const ASK_RECEIPT_LEXEMES = ['source', 'receipts', 'receipt', 'evidence?', 'citation', 'where is this from', 'prove it', 'link?'];
const ASK_QUOTE_LEXEMES = ['quote the exact', 'which part exactly', 'point to the sentence', 'show me the words', 'exact words', 'highlight the bit'];
const TANGENT_LEXEMES = ['speaking of', 'unrelated', 'tangent', 'side note', 'off topic'];

// ── Anti-amplification doctrine lexemes (Stage 6.1.5.2) ────────
// All of these are *text-feature* matchers — they describe how the
// message reads, NEVER who the speaker is. Conservative defaults: if
// nothing matches, we return "unclear" / "none_observed" / "unknown"
// rather than guessing a political label.

const POLITICAL_ISSUE_LEXEMES = {
  election_process: ['ballot', 'voter', 'election', 'voting', 'precinct', 'mail-in', 'voter id', 'recount', 'audit the vote'],
  governance: ['congress', 'senate', 'house', 'governor', 'legislator', 'lawmaker', 'bill', 'statute', 'regulation'],
  foreign_policy: ['nato', 'sanctions', 'foreign', 'tariff', 'treaty', 'embassy', 'allies', 'adversaries', 'border'],
  economic_policy: ['inflation', 'taxes', 'tax', 'gdp', 'jobs report', 'unemployment', 'wages', 'spending', 'deficit'],
  civil_rights: ['discrimination', 'civil rights', 'protest', 'free speech', 'due process'],
  public_safety: ['crime', 'police', 'safety', 'enforcement', 'shooting', 'arrest', 'precinct'],
  institutional_trust: ['establishment', 'corrupt', 'rigged', 'cover-up', 'coverup', 'whistleblower', 'fbi', 'doj', 'cia'],
  culture_war: ['woke', 'cancel', 'pronouns', 'dei', 'critical race', 'parental rights'],
  climate_energy: ['climate', 'carbon', 'emissions', 'renewable', 'fossil fuel', 'oil', 'gas', 'pipeline'],
  health_policy: ['healthcare', 'vaccine', 'cdc', 'fda', 'medicaid', 'medicare', 'insurance premium'],
  labor_business: ['union', 'strike', 'corporate', 'small business', 'minimum wage'],
  technology_platforms: ['algorithm', 'shadowban', 'censorship', 'platform', 'big tech', 'moderation policy'],
};

const VALENCE_LEXEMES = {
  anti_institutional: ['establishment', 'corrupt', 'rigged', 'deep state', 'cover-up', 'coverup', 'they don\'t want you', 'mainstream media lies'],
  pro_institutional: ['official sources', 'per the report', 'the agency confirmed', 'court ruled', 'verified by'],
  anti_media_thread: ['legacy media', 'msm', 'narrative pushers', 'fake news'],
  pro_media: ['the journalists', 'investigative reporting confirmed'],
  anti_platform: ['shadowban', 'censorship', 'algorithm suppresses'],
  pro_platform: ['platform policy correctly', 'moderation worked'],
  populist: ['the elites', 'real americans', 'working people', 'the people are tired of'],
  establishment: ['the consensus is', 'experts agree', 'long-standing policy'],
};

const SLOGAN_LIKE_LEXEMES = ['wake up', 'do your research', 'follow the money', 'they don\'t want you to know', 'open your eyes', 'sheeple', 'connect the dots'];
const OUTRAGE_HOOK_LEXEMES = ['outrageous', 'unbelievable', 'shocking', 'disgusting', 'insane', 'wild', 'they really did this'];
const APPEAL_TO_CROWD_LEXEMES = ['everyone knows', 'the whole timeline', 'nobody is talking about', 'millions are saying', 'going viral', 'trending'];
const APPEAL_TO_VIRAL_LEXEMES = ['this is viral', 'going viral', 'breaking the algorithm', 'huge if true'];
const LINK_WITHOUT_CONTEXT_LEXEMES = ['http://', 'https://', 't.co/', 'pic.twitter.com'];
const SCREENSHOT_LEXEMES = ['screenshot', 'screencap', 'screen-grab', 'screen grab'];
const ALLEGATION_LEXEMES = ['secretly', 'they admitted', 'leaked', 'caught on tape', 'on the record'];
const POLITICAL_GENERALIZATION_LEXEMES = ['all democrats', 'all republicans', 'every liberal', 'every conservative', 'the left always', 'the right always'];

function hasAnyLower(text, patterns) {
  const lc = String(text || '').toLowerCase();
  return patterns.some((p) => lc.includes(p));
}

function classifyHeat(body) {
  const lc = String(body || '').toLowerCase();
  if (/(vibes-only|dodge|tiny hat|receipt drawer|smuggling)/.test(lc)) return 'hot';
  if (/(quote the exact|receipts|wrong scope|narrow|define)/.test(lc)) return 'warm';
  return 'cold';
}

function classifyMessageCategory({ argumentType, body, parentMoveId, mixedClass }) {
  const t = String(argumentType || '').toLowerCase();
  if (mixedClass === 'tangent_or_joke') return 'tangent';
  if (t === 'thesis' || (t === 'claim' && !parentMoveId)) return 'root_claim';
  if (t === 'claim') return 'supporting_claim';
  if (t === 'rebuttal') return 'challenge';
  if (t === 'counter_rebuttal') return 'counter_challenge';
  if (t === 'evidence') return 'evidence';
  if (t === 'clarification_request') return 'clarification';
  if (t === 'concession') return 'concession';
  if (t === 'synthesis') return 'synthesis';
  if (hasAnyLower(body, TANGENT_LEXEMES)) return 'tangent';
  return 'unclear';
}

function classifyPrimaryArchetype({ argumentType, axis, body, mixedClass, targetExcerpt, hasEvidence }) {
  const t = String(argumentType || '').toLowerCase();
  if (mixedClass === 'tangent_or_joke') return 'tangent_brancher';
  if (hasAnyLower(body, ASK_RECEIPT_LEXEMES)) return 'receipt_demander';
  if (hasAnyLower(body, ASK_QUOTE_LEXEMES) || (targetExcerpt && t === 'clarification_request')) return 'quote_anchor_demander';
  if (t === 'rebuttal' || t === 'counter_rebuttal') {
    if (axis === 'scope') return 'scope_narrower';
    if (axis === 'definition') return 'definition_challenger';
    if (axis === 'evidence') return 'evidence_challenger';
    if (axis === 'causal') return 'causal_challenger';
    if (axis === 'value') return 'value_challenger';
    if (axis === 'logic') return 'logic_challenger';
    if (axis === 'framing') return 'framing_challenger';
    return 'evidence_challenger';
  }
  if (t === 'evidence') return hasEvidence ? 'receipts_backed_claim' : 'unsupported_bold_claim';
  if (t === 'concession') {
    if (mixedClass === 'broad_accept_narrow_decline') return 'concession_repairer';
    return 'concession_repairer';
  }
  if (t === 'synthesis') return 'synthesis_closer';
  if (mixedClass === 'broad_accept_narrow_decline') return 'broad_agree_narrow_disagree';
  if (mixedClass === 'narrow_accept_broad_decline') return 'narrow_agree_broad_disagree';
  return 'unclear';
}

function buildSecondaryArchetypes({ body, axis, mixedClass, hasEvidence, targetExcerpt }) {
  const out = new Set();
  if (hasAnyLower(body, ASK_RECEIPT_LEXEMES)) out.add('receipt_demander');
  if (hasAnyLower(body, ASK_QUOTE_LEXEMES)) out.add('quote_anchor_demander');
  if (targetExcerpt) out.add('quote_supported_claim');
  if (hasEvidence) out.add('receipts_backed_claim');
  if (axis === 'scope') out.add('scope_narrower');
  if (axis === 'definition') out.add('definition_challenger');
  if (axis === 'evidence') out.add('evidence_challenger');
  if (mixedClass === 'broad_accept_narrow_decline') out.add('broad_agree_narrow_disagree');
  if (mixedClass === 'narrow_accept_broad_decline') out.add('narrow_agree_broad_disagree');
  if (hasAnyLower(body, TANGENT_LEXEMES)) out.add('topic_drift_possible');
  return Array.from(out);
}

function buildOpinionVector({ mixedFlags, deterministicVector, body }) {
  const v = deterministicVector || {};
  const broadA = mixedFlags?.broadAcceptor ? 1 : v.agreementScore || 0;
  const narrowA = mixedFlags?.narrowAcceptor ? 1 : (v.agreementScore || 0) * 0.6;
  const broadD = mixedFlags?.broadDecliner ? 1 : v.disagreementScore || 0;
  const narrowD = mixedFlags?.narrowDecliner ? 1 : (v.disagreementScore || 0) * 0.6;
  return {
    broadAgreement: Math.min(1, broadA),
    narrowAgreement: Math.min(1, narrowA),
    broadDisagreement: Math.min(1, broadD),
    narrowDisagreement: Math.min(1, narrowD),
    coexistenceScore: v.coexistenceScore || 0,
    uncertaintyScore: v.uncertaintyScore || 0,
    emotionalValence: (v.agreementScore || 0) > 0.5 ? 'positive' : (v.disagreementScore || 0) > 0.5 ? 'negative' : 'mixed',
    heatLevel: classifyHeat(body),
  };
}

function buildIssueDebtSignal({ argumentType, axis, mixedClass, body, deterministicVector }) {
  const t = String(argumentType || '').toLowerCase();
  const createsDebt = t === 'rebuttal' || t === 'counter_rebuttal'
    || (t === 'clarification_request' && (hasAnyLower(body, ASK_RECEIPT_LEXEMES) || hasAnyLower(body, ASK_QUOTE_LEXEMES)));
  const repaired = t === 'concession' || t === 'synthesis';
  const mappedAxis = axis ? String(axis) : (hasAnyLower(body, ASK_RECEIPT_LEXEMES) ? 'source' : hasAnyLower(body, ASK_QUOTE_LEXEMES) ? 'quote' : 'none');
  return {
    axis: mappedAxis,
    created: createsDebt,
    repaired,
    unresolved: createsDebt && !repaired,
    repairSuggestion: mappedAxis === 'evidence' || mappedAxis === 'source' ? 'provide_receipt'
      : mappedAxis === 'quote' ? 'quote_exact_bit'
      : mappedAxis === 'definition' ? 'define_term'
      : mappedAxis === 'scope' ? 'narrow_scope'
      : mixedClass === 'tangent_or_joke' ? 'branch_thread'
      : 'none',
  };
}

function buildGameImplication({ issueDebt, mixedFlags, mixedClass, deterministicVector }) {
  const playable = mixedFlags?.playableTensionScore ?? (deterministicVector?.coexistenceScore ?? 0);
  const branchRecommended = mixedClass === 'tangent_or_joke';
  return {
    pressureCreated: issueDebt.created,
    pressureAxis: issueDebt.axis,
    responderCanRecover: issueDebt.created && !issueDebt.repaired,
    concessionWouldHelp: issueDebt.created && (mixedClass === 'broad_accept_narrow_decline' || mixedClass === 'narrow_accept_broad_decline'),
    branchRecommended,
    playableTensionScore: Math.max(0, Math.min(1, playable)),
    suggestedUiNudge: mixedFlags?.suggestedGameNudge ? `nudge:${mixedFlags.suggestedGameNudge}` : null,
    suggestedQualifierCode: mixedClass || null,
  };
}

function buildEvidenceSignals({ argumentType, body, hasEvidence, targetExcerpt }) {
  return {
    asksForSource: hasAnyLower(body, ASK_RECEIPT_LEXEMES),
    providesSource: hasEvidence,
    asksForQuote: hasAnyLower(body, ASK_QUOTE_LEXEMES),
    providesQuote: Boolean(targetExcerpt),
    evidenceSpecificity: hasEvidence ? 'receipts_backed' : targetExcerpt ? 'specific' : (body && body.length > 120) ? 'vague' : 'none',
  };
}

function buildThreadSignals({ parent, depth, mixedClass, body }) {
  return {
    parentResponsive: parent ? true : false,
    topicDriftPossible: hasAnyLower(body, TANGENT_LEXEMES) || mixedClass === 'tangent_or_joke',
    branchCandidate: mixedClass === 'tangent_or_joke',
    depth: Number(depth) || 0,
    chainRole: depth === 0 ? 'root'
      : mixedClass === 'tangent_or_joke' ? 'branch'
      : (String(parent?.argumentType || '').toLowerCase() === 'concession') ? 'closure'
      : 'pressure',
  };
}

function buildRuleCandidate({ archetype, axis, mixedClass, amplificationDecision }) {
  const base = (() => {
    if (mixedClass === 'broad_accept_narrow_decline') {
      return {
        shouldCreateRule: true,
        ruleName: 'show_mixed_agreement_badge',
        ruleCondition: 'finalVector.coexistenceScore >= 0.4 && mixedFlags.broadAcceptor && mixedFlags.narrowDecliner',
        uiNudge: 'Surface the broad agreement and the narrow defect.',
      };
    }
    if (archetype === 'receipt_demander') {
      return {
        shouldCreateRule: true,
        ruleName: 'prompt_receipts_on_next_move',
        ruleCondition: 'archetype === "receipt_demander"',
        uiNudge: 'Drop the receipts in the next move.',
      };
    }
    if (archetype === 'quote_anchor_demander') {
      return {
        shouldCreateRule: true,
        ruleName: 'prompt_quote_anchor_on_next_move',
        ruleCondition: 'archetype === "quote_anchor_demander"',
        uiNudge: 'Quote the parent verbatim and respond to that phrase.',
      };
    }
    if (axis === 'scope') {
      return {
        shouldCreateRule: true,
        ruleName: 'suggest_narrow_scope_move',
        ruleCondition: 'disagreementAxis === "scope"',
        uiNudge: 'Narrow the claim to the scope you can defend.',
      };
    }
    return { shouldCreateRule: false, ruleName: null, ruleCondition: null, uiNudge: null };
  })();
  return { ...base, ...amplificationDecision };
}

// ── Anti-amplification doctrine derivers (Stage 6.1.5.2) ───────

function lcMatches(text, list) {
  const lc = String(text || '').toLowerCase();
  return list.some((needle) => lc.includes(needle));
}

function derivePoliticalIssueFrame(body) {
  for (const [frame, lexemes] of Object.entries(POLITICAL_ISSUE_LEXEMES)) {
    if (lcMatches(body, lexemes)) return frame;
  }
  // No political signal → fallback to non_political only if body is
  // long enough to judge; otherwise unclear.
  return String(body || '').length > 40 ? 'non_political' : 'unclear';
}

function derivePoliticalValence(body) {
  if (lcMatches(body, VALENCE_LEXEMES.anti_institutional)) return 'anti_institutional';
  if (lcMatches(body, VALENCE_LEXEMES.populist)) return 'populist_frame';
  if (lcMatches(body, VALENCE_LEXEMES.anti_media_thread)) return 'anti_media_frame';
  if (lcMatches(body, VALENCE_LEXEMES.anti_platform)) return 'anti_platform_frame';
  if (lcMatches(body, VALENCE_LEXEMES.pro_institutional)) return 'pro_institutional';
  if (lcMatches(body, VALENCE_LEXEMES.pro_media)) return 'pro_media_frame';
  if (lcMatches(body, VALENCE_LEXEMES.pro_platform)) return 'pro_platform_frame';
  if (lcMatches(body, VALENCE_LEXEMES.establishment)) return 'establishment_frame';
  return 'unclear';
}

function deriveAmplificationSignals({ body, hasEvidence, targetExcerpt }) {
  const bodyLc = String(body || '').toLowerCase();
  const sloganLike = lcMatches(bodyLc, SLOGAN_LIKE_LEXEMES);
  const outrage = lcMatches(bodyLc, OUTRAGE_HOOK_LEXEMES);
  const crowd = lcMatches(bodyLc, APPEAL_TO_CROWD_LEXEMES);
  const viral = lcMatches(bodyLc, APPEAL_TO_VIRAL_LEXEMES);
  const linkOnly = lcMatches(bodyLc, LINK_WITHOUT_CONTEXT_LEXEMES) && !targetExcerpt && !hasEvidence;
  const screenshot = lcMatches(bodyLc, SCREENSHOT_LEXEMES);
  const isAllegation = lcMatches(bodyLc, ALLEGATION_LEXEMES);
  return {
    repeated_claim_language: sloganLike || crowd,
    high_engagement_low_evidence: (viral || crowd) && !hasEvidence,
    slogan_or_chant_like: sloganLike,
    copy_paste_risk: sloganLike && !targetExcerpt,
    outrage_hook: outrage,
    link_without_receipt_context: linkOnly,
    screenshot_without_primary_source: screenshot && !hasEvidence,
    appeal_to_crowd_size: crowd,
    appeal_to_virality: viral,
    unknown_source_chain: isAllegation && !hasEvidence,
  };
}

function deriveEvidentiaryRisk({ amplificationSignals, hasEvidence, targetExcerpt, body }) {
  if (amplificationSignals.high_engagement_low_evidence) return 'high';
  if (amplificationSignals.unknown_source_chain) return 'high';
  if (amplificationSignals.slogan_or_chant_like && !hasEvidence) return 'high';
  if (hasEvidence || targetExcerpt) return 'low';
  if ((body || '').length < 30) return 'unknown';
  return 'medium';
}

function deriveAmplificationRisk(signals) {
  const hits = Object.values(signals).filter(Boolean).length;
  if (hits >= 4) return 'high';
  if (hits >= 2) return 'medium';
  if (hits >= 1) return 'low';
  return 'none_observed';
}

function derivePlatformSupportWarning({ amplificationSignals, evidentiaryRisk, hasEvidence, targetExcerpt, deterministicVector, body }) {
  if (amplificationSignals.high_engagement_low_evidence) return true;
  if (amplificationSignals.appeal_to_virality) return true;
  if (amplificationSignals.unknown_source_chain) return true;
  if (evidentiaryRisk === 'high') return true;
  // Factual allegation without quote/source/evidence anchor.
  if (lcMatches(body, ALLEGATION_LEXEMES) && !hasEvidence && !targetExcerpt) return true;
  // Reply that agrees strongly but adds no evidence.
  const agree = deterministicVector?.agreementScore || 0;
  if (agree >= 0.7 && !hasEvidence && !targetExcerpt) return true;
  // Reply that repeats a slogan without narrowing.
  if (amplificationSignals.slogan_or_chant_like && !targetExcerpt) return true;
  return false;
}

function deriveRecommendedGameTreatment({ amplificationSignals, evidentiaryRisk, platformSupportWarning, hasEvidence, mixedClass, axis }) {
  // Order matters: most-specific signal wins.
  if (platformSupportWarning && amplificationSignals.appeal_to_virality) return 'suppress_score_gain_for_amplification_only';
  // Allegation without source → quote anchor first (more specific than
  // generic primary-source ask).
  if (amplificationSignals.unknown_source_chain && !hasEvidence) return 'ask_for_quote_anchor';
  if (platformSupportWarning && !hasEvidence) return 'ask_for_primary_source';
  if (axis === 'scope') return 'ask_for_scope_narrowing';
  if (mixedClass === 'tangent_or_joke') return 'suggest_branch_to_context_thread';
  if (evidentiaryRisk === 'high') return 'mark_as_unresolved_issue_debt';
  if (evidentiaryRisk === 'medium') return 'ask_for_receipt';
  if (hasEvidence) return 'allow_point_standing_after_evidence';
  return 'allow_as_opinion_no_factual_credit';
}

function deriveAmplificationRuleDecision({ amplificationSignals, platformSupportWarning, evidentiaryRisk, body, hasEvidence, axis }) {
  return {
    shouldSuppressScoreGainForAmplificationOnly: platformSupportWarning && (amplificationSignals.appeal_to_virality || amplificationSignals.appeal_to_crowd_size),
    shouldAskForPrimarySource: platformSupportWarning && !hasEvidence,
    shouldMarkEvidenceRiskHigh: evidentiaryRisk === 'high',
    shouldShowAmplificationRiskBadge: Object.values(amplificationSignals).some(Boolean),
    shouldTreatAsOpinionNoFactualCredit: platformSupportWarning,
    shouldCreateIssueDebtForUnsupportedClaim: evidentiaryRisk === 'high' && !hasEvidence,
    shouldOfferScopeNarrowingForPoliticalGeneralization: lcMatches(body, POLITICAL_GENERALIZATION_LEXEMES) || axis === 'scope',
    shouldOfferQuoteAnchorForAllegation: lcMatches(body, ALLEGATION_LEXEMES) && !hasEvidence,
    shouldBranchContextIfClaimNeedsBackground: amplificationSignals.outrage_hook && (body || '').length < 220,
  };
}

function deriveJustification({ amplificationSignals, evidentiaryRisk, platformSupportWarning, politicalIssueFrame, politicalValence }) {
  const parts = [];
  const hits = Object.entries(amplificationSignals).filter(([, v]) => v).map(([k]) => k);
  if (hits.length > 0) {
    parts.push(`text shows amplification-risk features: ${hits.slice(0, 4).join(', ')}`);
  }
  if (platformSupportWarning) parts.push('claim relies on repetition / virality / unsourced allegation rather than evidence');
  if (evidentiaryRisk === 'low') parts.push('claim includes or requests checkable evidence');
  if (evidentiaryRisk === 'medium' && parts.length === 0) parts.push('claim is plausible but under-sourced');
  if (politicalIssueFrame !== 'unclear' && politicalIssueFrame !== 'non_political') {
    parts.push(`text engages the ${politicalIssueFrame.replace(/_/g, ' ')} frame`);
  }
  if (politicalValence !== 'unclear' && politicalValence !== 'not_applicable') {
    parts.push(`rhetorical frame reads as ${politicalValence.replace(/_/g, ' ')}`);
  }
  if (parts.length === 0) parts.push('no observable amplification-risk or political-frame signals');
  return parts.join('; ') + '.';
}

/**
 * Produce a full deterministic annotation matching the
 * `AnthropicArgumentAnnotation` shape.
 */
function deterministicAnnotate({ scenario, move, parent, thread, body, deterministicVector, reason }) {
  const vector = deterministicVector || computeAgreementDisagreementVector(parent ? parent.body : '', body || '');
  const flags = classifyMixedAgreement(vector, parent ? parent.body : '', body || '');
  const grading = toGradingFlags(flags);
  const mixedClass = grading.mixedAgreementClass;
  const hasEvidence = Boolean(move.evidence && (move.evidence.label || move.evidence.sourceText));
  const depth = Array.isArray(thread) ? thread.length : 0;

  const category = classifyMessageCategory({ argumentType: move.argumentType, body, parentMoveId: parent?.moveId, mixedClass });
  const primaryArchetype = classifyPrimaryArchetype({
    argumentType: move.argumentType, axis: move.disagreementAxis,
    body, mixedClass, targetExcerpt: move.targetExcerpt, hasEvidence,
  });
  const secondaryArchetypes = buildSecondaryArchetypes({
    body, axis: move.disagreementAxis, mixedClass, hasEvidence,
    targetExcerpt: move.targetExcerpt,
  }).filter((a) => a !== primaryArchetype);

  const issueDebt = buildIssueDebtSignal({
    argumentType: move.argumentType, axis: move.disagreementAxis, mixedClass, body,
    deterministicVector: vector,
  });
  const gameImplication = buildGameImplication({ issueDebt, mixedFlags: flags, mixedClass, deterministicVector: vector });
  const evidenceSignals = buildEvidenceSignals({
    argumentType: move.argumentType, body, hasEvidence, targetExcerpt: move.targetExcerpt,
  });
  const threadSignals = buildThreadSignals({ parent, depth, mixedClass, body });

  // Anti-amplification doctrine derivers.
  const politicalIssueFrame = derivePoliticalIssueFrame(body);
  const politicalValence = derivePoliticalValence(body);
  const amplificationSignals = deriveAmplificationSignals({ body, hasEvidence, targetExcerpt: move.targetExcerpt });
  const evidentiaryRisk = deriveEvidentiaryRisk({ amplificationSignals, hasEvidence, targetExcerpt: move.targetExcerpt, body });
  const amplificationRisk = deriveAmplificationRisk(amplificationSignals);
  const platformSupportWarning = derivePlatformSupportWarning({
    amplificationSignals, evidentiaryRisk, hasEvidence, targetExcerpt: move.targetExcerpt,
    deterministicVector: vector, body,
  });
  const recommendedGameTreatment = deriveRecommendedGameTreatment({
    amplificationSignals, evidentiaryRisk, platformSupportWarning, hasEvidence,
    mixedClass, axis: move.disagreementAxis,
  });
  const amplificationDecision = deriveAmplificationRuleDecision({
    amplificationSignals, platformSupportWarning, evidentiaryRisk, body,
    hasEvidence, axis: move.disagreementAxis,
  });
  const justification = deriveJustification({
    amplificationSignals, evidentiaryRisk, platformSupportWarning,
    politicalIssueFrame, politicalValence,
  });

  const ruleCandidate = buildRuleCandidate({
    archetype: primaryArchetype, axis: move.disagreementAxis, mixedClass,
    amplificationDecision,
  });

  return {
    schemaVersion: 2,
    moveId: move.moveId,
    roomId: scenario.roomId || null,
    scenarioId: scenario.scenarioId,
    parentMoveId: parent?.moveId || null,
    argumentType: move.argumentType,
    side: move.side || 'unknown',
    messageCategory: category,
    primaryRhetoricalArchetype: primaryArchetype,
    secondaryRhetoricalArchetypes: secondaryArchetypes,
    opinionVector: buildOpinionVector({ mixedFlags: flags, deterministicVector: vector, body }),
    agreementDisagreementVector: vector,
    issueDebtSignal: issueDebt,
    gameImplication,
    qualifierCodes: [mixedClass, primaryArchetype].filter((c) => c && c !== 'unclear'),
    categoryCodes: [category].filter((c) => c && c !== 'unclear'),
    evidenceSignals,
    threadSignals,
    modelJustification: {
      shortReason: reason || 'Deterministic fallback: classified from local fields (argumentType, axis, body lexemes, parent context).',
      observableTextFeatures: collectObservableFeatures({ body, axis: move.disagreementAxis, hasEvidence, targetExcerpt: move.targetExcerpt }),
      uncertaintyNotes: vector.uncertaintyScore >= 0.4 ? ['stance signals were weak; downstream rules should treat this row as low-confidence'] : [],
    },
    deterministicRuleCandidate: ruleCandidate,
    // Anti-amplification doctrine fields.
    politicalIssueFrame,
    politicalValence,
    amplificationSignals,
    evidentiaryRisk,
    amplificationRisk,
    platformSupportWarning,
    recommendedGameTreatment,
    justification,
    annotationSource: 'deterministic_fallback',
    userReviewRequired: true,
  };
}

function collectObservableFeatures({ body, axis, hasEvidence, targetExcerpt }) {
  const out = [];
  if (axis) out.push(`disagreement axis = ${axis}`);
  if (hasEvidence) out.push('attached_evidence present');
  if (targetExcerpt) out.push('target_excerpt set');
  if (hasAnyLower(body, ASK_RECEIPT_LEXEMES)) out.push('body asks for source/receipts');
  if (hasAnyLower(body, ASK_QUOTE_LEXEMES)) out.push('body asks to quote the exact bit');
  if (hasAnyLower(body, TANGENT_LEXEMES)) out.push('body has tangent language');
  if (!out.length) out.push('few observable signals in body');
  return out;
}

module.exports = {
  deterministicAnnotate,
  classifyMessageCategory,
  classifyPrimaryArchetype,
  buildOpinionVector,
  buildIssueDebtSignal,
  buildGameImplication,
  buildEvidenceSignals,
  buildThreadSignals,
  buildRuleCandidate,
};
