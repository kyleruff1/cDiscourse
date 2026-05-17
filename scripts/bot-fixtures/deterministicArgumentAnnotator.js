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

function buildRuleCandidate({ archetype, axis, mixedClass }) {
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
  const ruleCandidate = buildRuleCandidate({ archetype: primaryArchetype, axis: move.disagreementAxis, mixedClass });

  return {
    schemaVersion: 1,
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
