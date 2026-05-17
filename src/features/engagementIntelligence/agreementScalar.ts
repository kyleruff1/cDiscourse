/**
 * Deterministic agreement / disagreement scalar.
 *
 * Pure TypeScript. No network. No xAI. No truth claim. No moderation
 * recommendation. Outputs are advisory only and every emitted vector carries
 * `userReviewRequired: true`.
 *
 * Conceptual rule: agreement and disagreement are *separate* dimensions, not
 * one axis. A reply can score high on both — that's the "coexistence" zone
 * the app most needs to model.
 */

import {
  AGREEMENT_LEXEMES,
  CAUSAL_CHALLENGE_LEXEMES,
  COUNTEREXAMPLE_LEXEMES,
  DEFINITION_CHALLENGE_LEXEMES,
  DISAGREEMENT_LEXEMES,
  EVIDENCE_REQUEST_LEXEMES,
  JOKE_LEXEMES,
  LOGIC_CHALLENGE_LEXEMES,
  PERSON_ATTACK_LEXEMES,
  QUOTE_REQUEST_LEXEMES,
  SCOPE_CHALLENGE_LEXEMES,
  SOFT_COEXISTENCE_LEXEMES,
  TANGENT_LEXEMES,
  TONE_LEXEMES,
  VALUE_CHALLENGE_LEXEMES,
} from './lexicons';
import type {
  AgreementDisagreementVector,
  AgreementType,
  DisagreementType,
  PrimaryStance,
  ReplyFunction,
  ReplyPairSample,
  ReplyInterpretation,
  RuleCandidate,
} from './types';

function lower(s: string): string { return String(s || '').toLowerCase(); }

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a regex for a lexeme. Single-word patterns get word-boundary anchors
 * so "no" does not match inside "noticeably". Multi-word phrases and emoji
 * fall back to plain substring matching.
 */
function buildPatternRegex(pattern: string): RegExp {
  const lc = pattern.toLowerCase();
  const isSingleWord = /^[a-z][a-z']*$/.test(lc); // all-letters, no spaces / digits / punct
  const escaped = escapeRegex(lc);
  return isSingleWord ? new RegExp(`\\b${escaped}\\b`, 'g') : new RegExp(escaped, 'g');
}

const REGEX_CACHE = new Map<string, RegExp>();
function regexFor(p: string): RegExp {
  let re = REGEX_CACHE.get(p);
  if (!re) { re = buildPatternRegex(p); REGEX_CACHE.set(p, re); }
  re.lastIndex = 0;
  return re;
}

function hitCount(text: string, patterns: string[]): number {
  const lc = lower(text);
  let count = 0;
  for (const p of patterns) {
    const re = regexFor(p);
    re.lastIndex = 0;
    while (re.exec(lc) !== null) count++;
  }
  return count;
}

function hasAny(text: string, patterns: string[]): boolean {
  const lc = lower(text);
  return patterns.some((p) => { const re = regexFor(p); re.lastIndex = 0; return re.test(lc); });
}

function clamp01(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  if (n < 0) return 0; if (n > 1) return 1;
  return n;
}

// ── Per-dimension detectors ────────────────────────────────────

export function detectConcessionCaveat(text: string): boolean { return hasAny(text, SOFT_COEXISTENCE_LEXEMES); }
export function detectReceiptRequest(text: string): boolean { return hasAny(text, EVIDENCE_REQUEST_LEXEMES); }
export function detectQuoteRequest(text: string): boolean { return hasAny(text, QUOTE_REQUEST_LEXEMES); }
export function detectDefinitionAsk(text: string): boolean { return hasAny(text, DEFINITION_CHALLENGE_LEXEMES); }
export function detectScopeChallenge(text: string): boolean { return hasAny(text, SCOPE_CHALLENGE_LEXEMES); }
export function detectCounterexample(text: string): boolean { return hasAny(text, COUNTEREXAMPLE_LEXEMES); }
export function detectLogicChallenge(text: string): boolean { return hasAny(text, LOGIC_CHALLENGE_LEXEMES); }
export function detectValueChallenge(text: string): boolean { return hasAny(text, VALUE_CHALLENGE_LEXEMES); }
export function detectCausalChallenge(text: string): boolean { return hasAny(text, CAUSAL_CHALLENGE_LEXEMES); }
export function detectToneRemark(text: string): boolean { return hasAny(text, TONE_LEXEMES); }
export function detectJoke(text: string): boolean { return hasAny(text, JOKE_LEXEMES); }
export function detectTangentHint(text: string): boolean { return hasAny(text, TANGENT_LEXEMES); }
export function detectPersonAttack(text: string): boolean { return hasAny(text, PERSON_ATTACK_LEXEMES); }

export function scoreAgreementLexemes(text: string): number {
  const hits = hitCount(text, AGREEMENT_LEXEMES);
  // Saturating curve: 1 hit -> ~0.40, 2 -> ~0.60, 3 -> ~0.72.
  return clamp01(1 - Math.pow(0.6, hits));
}

export function scoreDisagreementLexemes(text: string): number {
  const hits = hitCount(text, DISAGREEMENT_LEXEMES);
  return clamp01(1 - Math.pow(0.55, hits));
}

// ── Stance classification ──────────────────────────────────────

export function classifyAgreementType(text: string): AgreementType {
  const lc = lower(text);
  if (/\b(fair|good)\s+point\b/.test(lc) || lc.includes('i grant') || lc.includes('i acknowledge')) return 'premise';
  if (lc.includes('the data') || lc.includes('the evidence') || lc.includes('the source')) return 'evidence';
  if (lc.includes('the conclusion') || lc.includes('overall')) return 'conclusion';
  if (lc.includes('value') || lc.includes('matters') || lc.includes('priorities')) return 'value';
  if (lc.includes('framing')) return 'framing';
  if (lc.includes('context')) return 'context';
  if (hitCount(text, AGREEMENT_LEXEMES) > 0) return 'premise';
  return 'none';
}

export function classifyDisagreementType(text: string): DisagreementType {
  if (detectScopeChallenge(text)) return 'scope';
  if (detectDefinitionAsk(text)) return 'definition';
  if (detectReceiptRequest(text)) return 'evidence';
  if (detectLogicChallenge(text)) return 'logic';
  if (detectCausalChallenge(text)) return 'causal';
  if (detectValueChallenge(text)) return 'value';
  if (detectToneRemark(text)) return 'framing';
  if (hitCount(text, DISAGREEMENT_LEXEMES) > 0) return 'fact';
  return 'none';
}

export function classifyReplyFunction(
  text: string,
  vector: Pick<AgreementDisagreementVector, 'agreementScore' | 'disagreementScore' | 'disagreementType' | 'agreementType'>,
): ReplyFunction {
  if (detectJoke(text)) return 'joke';
  const a = vector.agreementScore;
  const d = vector.disagreementScore;
  // Ask-for-X requests dominate ONLY when the reply isn't simultaneously
  // granting / agreeing. A reply that says "Source? But yes, I grant…" is
  // really a caveat, not a pure receipt request.
  const askQuote = detectQuoteRequest(text);
  const askSource = detectReceiptRequest(text);
  const askDef = detectDefinitionAsk(text);
  if (askQuote && a < 0.3) return 'ask_quote';
  if (askSource && a < 0.3) return 'ask_source';
  if (askDef && a < 0.3) return 'ask_definition';
  if (detectCounterexample(text)) return 'counterexample';
  if (detectScopeChallenge(text) && d >= 0.25) return 'narrow_scope';
  if (detectTangentHint(text)) return 'branch_tangent';
  if (a >= 0.5 && d < 0.2) return 'support';
  if (a >= 0.4 && d >= 0.25) return 'caveat';
  if (d >= 0.5 && a < 0.3) return 'rebut';
  if (a >= 0.3 && d < 0.3) return 'extend';
  if (a < 0.2 && d < 0.2) return 'unclear';
  return 'unclear';
}

export function deriveCoexistenceScore(agreementScore: number, disagreementScore: number): number {
  return clamp01(Math.min(agreementScore, disagreementScore) * 2);
}

export function choosePrimaryStance(v: {
  agreementScore: number; disagreementScore: number; coexistenceScore: number;
  replyFunction: ReplyFunction; uncertaintyScore: number;
}): PrimaryStance {
  if (v.uncertaintyScore >= 0.7) return 'unclear';
  if (v.replyFunction === 'joke') return 'joke_or_meme';
  if (v.replyFunction === 'branch_tangent') return 'tangent';
  if (v.replyFunction === 'ask_source') return 'receipt_request';
  if (v.replyFunction === 'ask_quote') return 'quote_request';
  if (v.coexistenceScore >= 0.4) return 'mixed_agree_disagree';
  if (v.agreementScore >= 0.6 && v.disagreementScore < 0.25) return 'strong_agree';
  if (v.agreementScore >= 0.3 && v.disagreementScore < 0.3) return 'weak_agree';
  if (v.disagreementScore >= 0.6 && v.agreementScore < 0.25) return 'strong_disagree';
  if (v.disagreementScore >= 0.3 && v.agreementScore < 0.3) return 'weak_disagree';
  return 'unclear';
}

function buildRationale(v: AgreementDisagreementVector): string {
  const parts: string[] = [];
  if (v.agreementScore >= 0.3) parts.push(`agrees on ${v.agreementType}`);
  if (v.disagreementScore >= 0.3) parts.push(`disagrees on ${v.disagreementType}`);
  if (v.coexistenceScore >= 0.4) parts.push('mixed state');
  if (v.replyFunction === 'ask_source') parts.push('asks for receipts');
  if (v.replyFunction === 'ask_quote') parts.push('asks for a quote anchor');
  if (v.replyFunction === 'counterexample') parts.push('drops a counterexample');
  if (parts.length === 0) parts.push('language relation is unclear');
  return `Observable: ${parts.join('; ')}.`;
}

// ── Main API ───────────────────────────────────────────────────

export function computeAgreementDisagreementVector(
  _rootText: string,
  replyText: string,
): AgreementDisagreementVector {
  // The root text is intentionally unused for the deterministic scorer:
  // we read stance signals from the reply only. Mixing the root in here
  // creates false positives (root vocabulary leaking into a "match"). The
  // root is available to xAI as additional context.
  const reply = String(replyText || '');

  const agreementScoreRaw = scoreAgreementLexemes(reply);
  const disagreementScoreRaw = scoreDisagreementLexemes(reply);
  const softCoexists = detectConcessionCaveat(reply);
  const personAttack = detectPersonAttack(reply);

  // Axis-challenge detectors (scope, definition, evidence, logic, causal,
  // value, tone, counterexample) carry disagreement signal even when the
  // generic DISAGREEMENT_LEXEMES don't fire — e.g. "Correlation does not
  // equal cause" has no "no/wrong/disagree" tokens. Fold them in.
  const axisHits =
    (detectScopeChallenge(reply) ? 1 : 0) +
    (detectDefinitionAsk(reply) ? 1 : 0) +
    (detectReceiptRequest(reply) ? 1 : 0) +
    (detectLogicChallenge(reply) ? 1 : 0) +
    (detectCausalChallenge(reply) ? 1 : 0) +
    (detectValueChallenge(reply) ? 1 : 0) +
    (detectToneRemark(reply) ? 1 : 0) +
    (detectCounterexample(reply) ? 1 : 0);
  const axisBoost = Math.min(0.5, axisHits * 0.3);

  // Soft-coexistence words ("but", "however", "i grant", etc.) boost BOTH
  // sides so a "Fair point, but…" reply registers as genuinely mixed rather
  // than as pure agreement or pure disagreement. Person-attack words depress
  // confidence rather than amplify disagreement (we refuse to escalate).
  const agreementScore = clamp01(agreementScoreRaw + (softCoexists ? 0.15 : 0));
  const disagreementScore = clamp01(disagreementScoreRaw + axisBoost + (softCoexists ? 0.22 : 0));

  const hasAnySignal = agreementScoreRaw > 0 || disagreementScoreRaw > 0 || axisHits > 0;
  const uncertaintyScore = clamp01(
    (personAttack ? 0.25 : 0) +
    (reply.trim().length < 12 ? 0.4 : 0) +
    (!hasAnySignal ? 0.5 : 0),
  );

  const coexistenceScore = deriveCoexistenceScore(agreementScore, disagreementScore);

  const agreementType = classifyAgreementType(reply);
  const disagreementType = classifyDisagreementType(reply);

  // First pass: tentative reply function (does not depend on stance).
  const tentativeVector = {
    agreementScore, disagreementScore, agreementType, disagreementType,
  };
  const replyFunction = classifyReplyFunction(reply, tentativeVector);

  const primaryStance = choosePrimaryStance({
    agreementScore, disagreementScore, coexistenceScore,
    replyFunction, uncertaintyScore,
  });

  const vector: AgreementDisagreementVector = {
    agreementScore,
    disagreementScore,
    coexistenceScore,
    uncertaintyScore,
    primaryStance,
    agreementType,
    disagreementType,
    replyFunction,
    scalarRationale: '',
    userReviewRequired: true,
  };
  vector.scalarRationale = buildRationale(vector);
  return vector;
}

export function summarizeAgreementVector(v: AgreementDisagreementVector): string {
  return [
    `stance=${v.primaryStance}`,
    `agreement=${v.agreementScore.toFixed(2)} (${v.agreementType})`,
    `disagreement=${v.disagreementScore.toFixed(2)} (${v.disagreementType})`,
    `coexistence=${v.coexistenceScore.toFixed(2)}`,
    `function=${v.replyFunction}`,
    `uncertainty=${v.uncertaintyScore.toFixed(2)}`,
  ].join(' · ');
}

export function interpretReplyPair(pair: ReplyPairSample): ReplyInterpretation {
  const deterministic = computeAgreementDisagreementVector(
    pair.rootTextRedacted,
    pair.replyTextRedacted,
  );
  const labels: string[] = [];
  if (detectReceiptRequest(pair.replyTextRedacted)) labels.push('receipt_request');
  if (detectQuoteRequest(pair.replyTextRedacted)) labels.push('quote_request');
  if (detectDefinitionAsk(pair.replyTextRedacted)) labels.push('definition_ask');
  if (detectScopeChallenge(pair.replyTextRedacted)) labels.push('scope_challenge');
  if (detectCounterexample(pair.replyTextRedacted)) labels.push('counterexample');
  if (detectConcessionCaveat(pair.replyTextRedacted)) labels.push('concession_caveat');
  if (detectJoke(pair.replyTextRedacted)) labels.push('joke');
  if (detectTangentHint(pair.replyTextRedacted)) labels.push('tangent_hint');
  if (detectPersonAttack(pair.replyTextRedacted)) labels.push('person_attack_language');

  const ruleCandidates: RuleCandidate[] = [];
  return {
    pairId: pair.pairId,
    deterministicVector: deterministic,
    xaiVector: null,
    finalVector: deterministic,
    classifierSource: 'deterministic',
    confidence: deterministic.uncertaintyScore >= 0.6 ? 'low' : deterministic.uncertaintyScore >= 0.3 ? 'medium' : 'high',
    labels,
    ruleCandidates,
    excluded: pair.safety.shouldExclude,
    exclusionReason: pair.safety.exclusionReason,
  };
}
