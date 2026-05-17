/**
 * JS twin of `src/features/engagementIntelligence/mixedAgreementTaxonomy.ts`.
 *
 * Used by Node-only analyzer / report scripts. Mirrors the TS module 1:1.
 * Parity is enforced by `__tests__/mixedAgreementTaxonomy.test.ts`.
 */

const BROAD_QUANTIFIER_LEXEMES = ['all', 'always', 'never', 'everyone', 'nobody', 'every single'];
const NARROWING_LEXEMES = [
  'edge case', 'specific', 'specifically', 'exactly', 'what counts', 'where', 'when',
  'in this case', 'this case', 'narrow', 'narrow the claim', 'scope', 'source',
  'quote', 'define', 'definition', 'one example', 'counterexample', 'except', 'unless',
];
const PERSON_ATTACK_LEXEMES = [
  'liar', 'lying', 'dishonest', 'bad faith', 'manipulative', 'manipulation',
  'shill', 'extremist', 'propagandist',
];
const SCOPE_CHALLENGE_LEXEMES = [
  'all', 'never', 'always', 'everyone', 'nobody', 'every single', 'too broad',
  'overgeneralized', 'overgeneralization', 'scope', 'edge case', 'goalposts',
  'moving the goalposts', 'narrow the claim', 'narrow that', 'narrow that down',
];
const TANGENT_LEXEMES = ['speaking of', 'unrelated', 'tangent', 'side note', 'off topic', 'different topic'];
const JOKE_LEXEMES = ['lol', 'lmao', 'rofl', '😂', '🤣', 'haha', 'just kidding', '/s', 'meme'];

const BROAD_AGREEMENT_TYPES = ['conclusion', 'value', 'framing', 'context'];
const NARROW_AGREEMENT_TYPES = ['premise', 'evidence', 'context'];
const BROAD_DISAGREEMENT_TYPES = ['value', 'framing', 'logic', 'scope'];
const NARROW_DISAGREEMENT_TYPES = ['evidence', 'definition', 'causal', 'scope', 'fact'];

function lower(s) { return String(s || '').toLowerCase(); }
function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function buildPatternRegex(p) {
  const lc = p.toLowerCase();
  const isSingleWord = /^[a-z][a-z']*$/.test(lc);
  return new RegExp(isSingleWord ? `\\b${escapeRegex(lc)}\\b` : escapeRegex(lc), 'g');
}
function hasAny(text, patterns) {
  const lc = lower(text);
  return patterns.some((p) => { const re = buildPatternRegex(p); re.lastIndex = 0; return re.test(lc); });
}
function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0; if (n > 1) return 1; return n;
}

function pickGameNudge(args) {
  if (args.isJoke || args.mixedAgreementClass === 'tangent_or_joke' || args.isTangent) return 'split_tangent';
  if (args.disagreementType === 'evidence' || args.replyFunction === 'ask_source') return 'ask_for_source';
  if (args.disagreementType === 'definition' || args.replyFunction === 'ask_definition') return 'ask_for_definition';
  if (args.mixedAgreementClass === 'broad_accept_narrow_decline' && args.disagreementType === 'scope') return 'ask_for_scope_boundary';
  if (args.mixedAgreementClass === 'broad_accept_narrow_decline') return 'ask_for_scope_boundary';
  if (args.mixedAgreementClass === 'broad_accept_broad_decline') return 'invite_synthesis';
  if (args.mixedAgreementClass === 'narrow_accept_broad_decline') return 'continue_rebuttal';
  if (args.mixedAgreementClass === 'pure_decline' && args.narrowAcceptor) return 'invite_concession';
  return 'none';
}

function classifyMixedAgreement(vector, _rootText, replyText) {
  const reply = String(replyText || '');
  const lc = lower(reply);

  const isJoke = hasAny(reply, JOKE_LEXEMES);
  const isTangent = hasAny(reply, TANGENT_LEXEMES) || vector.replyFunction === 'branch_tangent';
  const hasPersonAttack = hasAny(reply, PERSON_ATTACK_LEXEMES);

  const hasBroadQuant = hasAny(reply, BROAD_QUANTIFIER_LEXEMES);
  const hasNarrowMarker = hasAny(reply, NARROWING_LEXEMES);
  const hasScopeLanguage = hasAny(reply, SCOPE_CHALLENGE_LEXEMES);

  const acceptsMainConclusion = vector.agreementType === 'conclusion' && vector.agreementScore >= 0.3;
  const acceptsValueFrame = vector.agreementType === 'value' && vector.agreementScore >= 0.3;
  const acceptsEvidence = vector.agreementType === 'evidence' && vector.agreementScore >= 0.3;
  const acceptsContext = vector.agreementType === 'context' && vector.agreementScore >= 0.3;

  const declinesScope = vector.disagreementType === 'scope';
  const declinesEvidence = vector.disagreementType === 'evidence';
  const declinesDefinition = vector.disagreementType === 'definition';
  const declinesCausalClaim = vector.disagreementType === 'causal';
  const declinesLogic = vector.disagreementType === 'logic';
  const declinesFraming = vector.disagreementType === 'framing';

  const broadAcceptor =
    vector.agreementScore >= 0.55 && BROAD_AGREEMENT_TYPES.includes(vector.agreementType);
  const narrowAcceptor =
    !broadAcceptor &&
    vector.agreementScore >= 0.35 &&
    NARROW_AGREEMENT_TYPES.includes(vector.agreementType);

  const broadDecliner =
    vector.disagreementScore >= 0.55 &&
    BROAD_DISAGREEMENT_TYPES.includes(vector.disagreementType) &&
    hasBroadQuant;
  const narrowDecliner =
    !broadDecliner &&
    vector.disagreementScore >= 0.3 &&
    NARROW_DISAGREEMENT_TYPES.includes(vector.disagreementType) &&
    (hasNarrowMarker || vector.coexistenceScore >= 0.3);

  let mixedAgreementClass;
  if (isTangent && !narrowDecliner && !broadDecliner) mixedAgreementClass = 'tangent_or_joke';
  else if (isJoke) mixedAgreementClass = 'tangent_or_joke';
  else if (vector.agreementScore < 0.15 && vector.disagreementScore < 0.15) mixedAgreementClass = 'unclear_mixed';
  else if (vector.agreementScore >= 0.55 && vector.disagreementScore < 0.15) mixedAgreementClass = 'pure_accept';
  else if (vector.disagreementScore >= 0.55 && vector.agreementScore < 0.15) mixedAgreementClass = 'pure_decline';
  else if (broadAcceptor && narrowDecliner) mixedAgreementClass = 'broad_accept_narrow_decline';
  else if (narrowAcceptor && broadDecliner) mixedAgreementClass = 'narrow_accept_broad_decline';
  else if (broadAcceptor && broadDecliner) mixedAgreementClass = 'broad_accept_broad_decline';
  else if (narrowAcceptor && narrowDecliner) mixedAgreementClass = 'narrow_accept_narrow_decline';
  else mixedAgreementClass = 'unclear_mixed';

  function breadth(score, hasBroad, hasNarrow) {
    if (score < 0.1) return 'none';
    if (hasBroad && !hasNarrow) return 'broad';
    if (hasNarrow && !hasBroad) return 'narrow';
    if (score >= 0.55) return 'broad';
    if (score >= 0.35) return 'medium';
    return 'narrow';
  }
  const agreementBreadth = broadAcceptor
    ? 'broad'
    : narrowAcceptor
      ? 'narrow'
      : breadth(vector.agreementScore, false, false);
  const disagreementBreadth = broadDecliner
    ? 'broad'
    : narrowDecliner
      ? 'narrow'
      : breadth(vector.disagreementScore, hasBroadQuant, hasNarrowMarker || hasScopeLanguage);

  const specificAxis = (vector.disagreementType !== 'none' && vector.disagreementType !== 'framing') ? 0.2 : 0;
  const hookBonus = (hasNarrowMarker ? 0.1 : 0) + (lc.includes('?') ? 0.05 : 0);
  let playable = vector.coexistenceScore + specificAxis + hookBonus;
  if (mixedAgreementClass === 'broad_accept_narrow_decline') playable += 0.1;
  if (isTangent || isJoke) playable = Math.min(playable, 0.3);
  if (hasPersonAttack) playable -= 0.2;
  const playableTensionScore = clamp01(playable);

  const suggestedGameNudge = pickGameNudge({
    mixedAgreementClass,
    disagreementType: vector.disagreementType,
    replyFunction: vector.replyFunction,
    broadAcceptor, narrowAcceptor, narrowDecliner, broadDecliner,
    isTangent, isJoke,
  });

  return {
    broadAcceptor, narrowAcceptor, broadDecliner, narrowDecliner,
    acceptsMainConclusion, acceptsValueFrame, acceptsEvidence, acceptsContext,
    declinesScope, declinesEvidence, declinesDefinition, declinesCausalClaim,
    declinesLogic, declinesFraming,
    mixedAgreementClass,
    agreementBreadth, disagreementBreadth,
    playableTensionScore,
    suggestedGameNudge,
    userReviewRequired: true,
  };
}

function toGradingFlags(flags) {
  return {
    broadAcceptor: flags.broadAcceptor,
    narrowAcceptor: flags.narrowAcceptor,
    broadDecliner: flags.broadDecliner,
    narrowDecliner: flags.narrowDecliner,
    mixedAgreementClass: flags.mixedAgreementClass,
    playableTensionScore: flags.playableTensionScore,
  };
}

module.exports = {
  classifyMixedAgreement,
  toGradingFlags,
  BROAD_QUANTIFIER_LEXEMES,
  NARROWING_LEXEMES,
  BROAD_AGREEMENT_TYPES,
  NARROW_AGREEMENT_TYPES,
  BROAD_DISAGREEMENT_TYPES,
  NARROW_DISAGREEMENT_TYPES,
};
