/**
 * Stage 6.1.7 — First-disagreeable-reply selector.
 *
 * Uses the existing deterministic engagement scalar to classify each reply
 * against its source. Selects the first reply in `providerRank` order that
 * meaningfully disagrees, with a preference for mixed-agreement states
 * (`broad_accept_narrow_decline`, `narrow_accept_broad_decline`,
 * `narrow_accept_narrow_decline`).
 *
 * Synthetic fallback policy:
 *   - If no candidate qualifies, the selector returns
 *     `{ selected: null, reason: 'no_qualifying_reply', triedCount }`.
 *   - The caller decides whether to advance to the next source candidate
 *     or generate a synthetic rebuttal. Synthetic rebuttals MUST be marked
 *     `syntheticRebuttal=true`, `excludedFromRealEpidemiology=true`,
 *     `includedInGameStressOnly=true`.
 *
 * No truth verdict. No user labels. Pure-text classifier only.
 */
const { computeAgreementDisagreementVector } = require('./agreementScalarJs');
const { classifyMixedAgreement } = require('./mixedAgreementTaxonomyJs');

const STANCE_EXCLUDE = new Set(['strong_agree', 'weak_agree', 'joke_or_meme', 'tangent', 'unclear']);

const PREFERRED_MIXED_CLASSES = new Set([
  'broad_accept_narrow_decline',
  'narrow_accept_broad_decline',
  'narrow_accept_narrow_decline',
]);

const MIN_DISAGREEMENT_SCORE = 0.35;

function classifyReplyAgainstSource(source, reply) {
  const sourceText = source && (source.sourceTextRedacted || source.sourceClaimSummary) || '';
  const replyText = reply && (reply.replyTextRedacted || reply.replyClaimSummary) || '';
  const vector = computeAgreementDisagreementVector(sourceText, replyText);
  const flags = classifyMixedAgreement(vector, sourceText, replyText);
  return { vector, flags };
}

function justificationFor(reply, vector, flags) {
  const features = [];
  if (vector.disagreementScore >= 0.35) features.push(`disagreement scalar ${vector.disagreementScore.toFixed(2)}`);
  if (vector.disagreementType && vector.disagreementType !== 'none') features.push(`axis=${vector.disagreementType}`);
  if (flags.mixedAgreementClass && flags.mixedAgreementClass !== 'pure_decline' && flags.mixedAgreementClass !== 'pure_accept')
    features.push(`mixed-class=${flags.mixedAgreementClass}`);
  if (flags.playableTensionScore >= 0.3) features.push(`playable tension ${flags.playableTensionScore.toFixed(2)}`);
  if (vector.coexistenceScore >= 0.3) features.push(`coexistence ${vector.coexistenceScore.toFixed(2)}`);
  return features.length === 0
    ? 'no notable disagreement features'
    : `Reply shows: ${features.join('; ')}.`;
}

function classifyOne(source, reply) {
  const { vector, flags } = classifyReplyAgainstSource(source, reply);
  return {
    replyOrdinal: reply.replyOrdinal,
    replyHash: reply.replyHash,
    providerRank: reply.providerRank,
    agreementScore: vector.agreementScore,
    disagreementScore: vector.disagreementScore,
    coexistenceScore: vector.coexistenceScore,
    uncertaintyScore: vector.uncertaintyScore,
    primaryStance: vector.primaryStance,
    agreementType: vector.agreementType,
    disagreementType: vector.disagreementType,
    replyFunction: vector.replyFunction,
    mixedAgreementClass: flags.mixedAgreementClass,
    playableTensionScore: flags.playableTensionScore,
    issueDebtAxis: vector.disagreementType,
    selectionJustification: justificationFor(reply, vector, flags),
  };
}

function isEligible(c) {
  if (STANCE_EXCLUDE.has(c.primaryStance)) return false;
  if (typeof c.disagreementScore !== 'number' || c.disagreementScore < MIN_DISAGREEMENT_SCORE) return false;
  if (!c.selectionJustification || c.selectionJustification === 'no notable disagreement features') return false;
  return true;
}

/**
 * Pick the first qualifying reply in providerRank order. Within a mixed
 * eligibility band, prefer mixed-agreement states.
 *
 * Returns:
 *   {
 *     selected: { reply, classification } | null,
 *     reason: 'selected_mixed_agreement' | 'selected_pure_decline' | 'no_qualifying_reply',
 *     triedCount,
 *     classifications: Array  // every reply's classification, for the report
 *   }
 */
function selectFirstDisagreeableReply({ source, replies }) {
  if (!source || !Array.isArray(replies) || replies.length === 0) {
    return { selected: null, reason: 'no_replies', triedCount: 0, classifications: [] };
  }
  const ordered = [...replies].sort((a, b) => (a.providerRank || 0) - (b.providerRank || 0));
  const classifications = ordered.map((r) => ({ reply: r, classification: classifyOne(source, r) }));

  // First pass: prefer mixed-agreement eligible replies.
  for (const { reply, classification } of classifications) {
    if (isEligible(classification) && PREFERRED_MIXED_CLASSES.has(classification.mixedAgreementClass)) {
      return {
        selected: { reply, classification },
        reason: 'selected_mixed_agreement',
        triedCount: ordered.length,
        classifications,
      };
    }
  }
  // Second pass: take the first eligible reply regardless of mixed class.
  for (const { reply, classification } of classifications) {
    if (isEligible(classification)) {
      return {
        selected: { reply, classification },
        reason: 'selected_pure_decline',
        triedCount: ordered.length,
        classifications,
      };
    }
  }
  return { selected: null, reason: 'no_qualifying_reply', triedCount: ordered.length, classifications };
}

function buildSyntheticRebuttal(source) {
  // Deterministic placeholder rebuttal used ONLY when --allow-synthetic-rebuttal
  // is set AND the synthetic threshold is reached. Tagged so it cannot be
  // mistaken for a real epidemiology row.
  const axis = 'scope';
  const claim = source && (source.sourceClaimSummary || 'X') || 'X';
  const text = `That overstates the scope of "${claim}" — narrow it to a specific case before claiming general support, and bring the receipt for the narrow version.`;
  return {
    replyOrdinal: 0,
    replyHash: 'synthetic-' + (source && source.sourceHash || 'unknown'),
    sourceHash: source && source.sourceHash || null,
    provider: 'synthetic',
    providerRank: 0,
    providerConfidence: 0,
    topReplyMethod: 'synthetic_fallback',
    replyTextRedacted: text,
    replyClaimSummary: 'Narrow the scope and supply a primary source for the narrow version.',
    replyMetricsIfAvailable: null,
    citationRefs: [],
    collectedAt: new Date().toISOString(),
    redactionApplied: true,
    redactionNotes: 'deterministic synthetic rebuttal — no provider call',
    syntheticRebuttal: true,
    excludedFromRealEpidemiology: true,
    includedInGameStressOnly: true,
    syntheticAxis: axis,
  };
}

module.exports = {
  selectFirstDisagreeableReply,
  classifyOne,
  buildSyntheticRebuttal,
  isEligible,
  MIN_DISAGREEMENT_SCORE,
  PREFERRED_MIXED_CLASSES,
  STANCE_EXCLUDE,
};
