/**
 * Stage 6.1.3.3 — Mixed-agreement taxonomy classifier.
 *
 * Deterministic, pure TypeScript. No network. No xAI. No moderation
 * recommendations. No truth claims. No winner / loser. No protected-class
 * inference. Every output carries `userReviewRequired: true`.
 *
 * Conceptual rule the app actually cares about: most engaging replies are
 * neither pure agreement nor pure disagreement. They accept some part of the
 * root post and decline a different part. We label *which* part is accepted
 * vs. declined and how *broadly* — because the most playable state is
 * "broad accept, narrow decline" (I agree with the main point, but your
 * scope/evidence/definition is off).
 */

import {
  PERSON_ATTACK_LEXEMES,
  SCOPE_CHALLENGE_LEXEMES,
  TANGENT_LEXEMES,
  JOKE_LEXEMES,
} from './lexicons';
import type {
  AgreementBreadth,
  AgreementDisagreementVector,
  AgreementType,
  DisagreementType,
  MixedAgreementClass,
  MixedAgreementFlags,
  ReplyFunction,
  SuggestedGameNudge,
} from './types';

// ── Helpers ─────────────────────────────────────────────────────

function lower(s: string): string { return String(s || '').toLowerCase(); }

function escapeRegex(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function buildPatternRegex(pattern: string): RegExp {
  const lc = pattern.toLowerCase();
  const isSingleWord = /^[a-z][a-z']*$/.test(lc);
  return new RegExp(isSingleWord ? `\\b${escapeRegex(lc)}\\b` : escapeRegex(lc), 'g');
}

function hasAny(text: string, patterns: string[]): boolean {
  const lc = lower(text);
  return patterns.some((p) => { const re = buildPatternRegex(p); re.lastIndex = 0; return re.test(lc); });
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0; if (n > 1) return 1; return n;
}

// "Broad" markers — the universal-quantifier vocabulary that signals a wide-net challenge.
const BROAD_QUANTIFIER_LEXEMES = ['all', 'always', 'never', 'everyone', 'nobody', 'every single'];

// "Narrow" markers — the precision vocabulary that signals a hairsplit.
const NARROWING_LEXEMES = [
  'edge case', 'specific', 'specifically', 'exactly', 'what counts', 'where', 'when',
  'in this case', 'this case', 'narrow', 'narrow the claim', 'scope', 'source',
  'quote', 'define', 'definition', 'one example', 'counterexample', 'except',
  'unless',
];

// Agreement-type buckets used by the breadth heuristic.
const BROAD_AGREEMENT_TYPES: AgreementType[] = ['conclusion', 'value', 'framing', 'context'];
const NARROW_AGREEMENT_TYPES: AgreementType[] = ['premise', 'evidence', 'context'];

// Disagreement-type buckets used by the breadth heuristic.
const BROAD_DISAGREEMENT_TYPES: DisagreementType[] = ['value', 'framing', 'logic', 'scope'];
const NARROW_DISAGREEMENT_TYPES: DisagreementType[] = [
  'evidence', 'definition', 'causal', 'scope', 'fact',
];

// ── Classifier ─────────────────────────────────────────────────

export function classifyMixedAgreement(
  vector: AgreementDisagreementVector,
  _rootText: string,
  replyText: string,
): MixedAgreementFlags {
  const reply = String(replyText || '');
  const lc = lower(reply);

  // Tangent / joke / person-attack override the mixed classes.
  const isJoke = hasAny(reply, JOKE_LEXEMES);
  const isTangent = hasAny(reply, TANGENT_LEXEMES) || vector.replyFunction === 'branch_tangent';
  const hasPersonAttack = hasAny(reply, PERSON_ATTACK_LEXEMES);

  // Surface text markers that distinguish "broad" challenges from "narrow" ones.
  const hasBroadQuant = hasAny(reply, BROAD_QUANTIFIER_LEXEMES);
  const hasNarrowMarker = hasAny(reply, NARROWING_LEXEMES);
  const hasScopeLanguage = hasAny(reply, SCOPE_CHALLENGE_LEXEMES);

  // ── Accept/decline-by-type flags ──
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

  // ── Acceptor / decliner role flags ──
  const broadAcceptor =
    vector.agreementScore >= 0.55 &&
    BROAD_AGREEMENT_TYPES.includes(vector.agreementType);

  // narrowAcceptor: meaningful-but-not-broad agreement, type is premise/evidence/context.
  // Note: 'context' is in both buckets — it counts as narrow only when the agreement is
  // *not* strong enough to be "broad".
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

  // ── Mixed-agreement class ──
  let mixedAgreementClass: MixedAgreementClass;
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

  // ── Breadth bands ──
  function breadth(score: number, hasBroad: boolean, hasNarrow: boolean): AgreementBreadth {
    if (score < 0.1) return 'none';
    if (hasBroad && !hasNarrow) return 'broad';
    if (hasNarrow && !hasBroad) return 'narrow';
    if (score >= 0.55) return 'broad';
    if (score >= 0.35) return 'medium';
    return 'narrow';
  }
  const agreementBreadth: AgreementBreadth = broadAcceptor
    ? 'broad'
    : narrowAcceptor
      ? 'narrow'
      : breadth(vector.agreementScore, false, false);
  const disagreementBreadth: AgreementBreadth = broadDecliner
    ? 'broad'
    : narrowDecliner
      ? 'narrow'
      : breadth(vector.disagreementScore, hasBroadQuant, hasNarrowMarker || hasScopeLanguage);

  // ── Playable tension score ──
  // High values when: agreement + clear specific disagreement axis + lexical hooks.
  // Anything joke / tangent / person-attack pulls it down.
  const specificAxis = (vector.disagreementType !== 'none' && vector.disagreementType !== 'framing') ? 0.2 : 0;
  const hookBonus = (hasNarrowMarker ? 0.1 : 0) + (lc.includes('?') ? 0.05 : 0);
  let playable = vector.coexistenceScore + specificAxis + hookBonus;
  if (mixedAgreementClass === 'broad_accept_narrow_decline') playable += 0.1;
  if (isTangent || isJoke) playable = Math.min(playable, 0.3);
  if (hasPersonAttack) playable -= 0.2;
  const playableTensionScore = clamp01(playable);

  // ── Suggested game nudge (advisory) ──
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

function pickGameNudge(args: {
  mixedAgreementClass: MixedAgreementClass;
  disagreementType: DisagreementType;
  replyFunction: ReplyFunction;
  broadAcceptor: boolean;
  narrowAcceptor: boolean;
  narrowDecliner: boolean;
  broadDecliner: boolean;
  isTangent: boolean;
  isJoke: boolean;
}): SuggestedGameNudge {
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

/** Distill a `MixedAgreementFlags` down to the production grading-system surface. */
export function toGradingFlags(flags: MixedAgreementFlags) {
  return {
    broadAcceptor: flags.broadAcceptor,
    narrowAcceptor: flags.narrowAcceptor,
    broadDecliner: flags.broadDecliner,
    narrowDecliner: flags.narrowDecliner,
    mixedAgreementClass: flags.mixedAgreementClass,
    playableTensionScore: flags.playableTensionScore,
  };
}
