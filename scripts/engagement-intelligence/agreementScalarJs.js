/**
 * JS twin of `src/features/engagementIntelligence/agreementScalar.ts`.
 *
 * Used by Node-only analyzer / report scripts. The TS module remains the
 * canonical contract for the app + tests; this twin mirrors its behavior 1:1.
 * If you change one, change the other and verify the parity test in
 * `__tests__/engagementIntelligence.test.ts`.
 */

const AGREEMENT_LEXEMES = [
  'agree', 'agreed', 'yes', 'fair', 'true', 'correct', 'right', 'good point',
  'i grant', 'i acknowledge', 'i concede', 'that part', 'partly', 'partially',
  'basically', 'mostly', 'exactly', 'spot on',
];
const DISAGREEMENT_LEXEMES = [
  'disagree', 'no', 'not really', 'wrong', 'incorrect', 'does not follow',
  "doesn't follow", 'misses', 'overstates', 'understates', 'undercuts',
  'this ignores', 'this misses', 'this is wrong', 'actually no',
];
const SOFT_COEXISTENCE_LEXEMES = [
  'but', 'however', 'though', 'although', 'yet', 'still', 'that said',
  'mostly right', 'mostly wrong', 'partly right', 'partly wrong',
  'fair point but', 'i agree but', 'yes but', 'true but', 'i grant',
];
const EVIDENCE_REQUEST_LEXEMES = [
  'source', 'sources', 'receipts', 'receipt', 'evidence', 'data', 'citation',
  'where is this from', 'prove it', 'link?', 'link please', 'show your work',
];
const QUOTE_REQUEST_LEXEMES = [
  'quote', 'exact words', 'where did they say', 'point to the sentence',
  'highlight the bit', 'which part exactly', 'quote the exact',
];
const SCOPE_CHALLENGE_LEXEMES = [
  'all', 'never', 'always', 'everyone', 'nobody', 'every single', 'too broad',
  'overgeneralized', 'overgeneralization', 'scope', 'edge case', 'goalposts',
  'moving the goalposts', 'narrow the claim', 'narrow that', 'narrow that down',
];
const DEFINITION_CHALLENGE_LEXEMES = [
  'define', 'definition', 'what counts as', 'what do you mean', 'that word',
  'undefined', 'undefined term',
];
const CAUSAL_CHALLENGE_LEXEMES = [
  'correlation', 'correlation does not', 'cause and effect', 'spurious', 'reverse causation',
];
const LOGIC_CHALLENGE_LEXEMES = [
  'does not follow', "doesn't follow", 'non sequitur', 'contradiction',
  'circular', 'begging the question',
];
const VALUE_CHALLENGE_LEXEMES = [
  'wrong priorities', 'priorities', 'priority', 'values', 'worth it',
  'tradeoff', 'trade-off', 'what really matters', 'what matters',
];
const COUNTEREXAMPLE_LEXEMES = [
  'counterexample', 'counter-example', 'what about', 'consider', 'one example', 'edge case',
];
const TANGENT_LEXEMES = [
  'speaking of', 'unrelated', 'tangent', 'side note', 'off topic', 'different topic',
];
const JOKE_LEXEMES = [
  'lol', 'lmao', 'rofl', '😂', '🤣', 'haha', 'just kidding', '/s', 'meme',
];
const TONE_LEXEMES = [
  'tone', 'framing', 'loaded', 'phrasing', 'condescending',
];
const PERSON_ATTACK_LEXEMES = [
  'liar', 'lying', 'dishonest', 'bad faith', 'manipulative', 'manipulation',
  'shill', 'extremist', 'propagandist',
];

function lower(s) { return String(s || '').toLowerCase(); }
function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function buildPatternRegex(pattern) {
  const lc = pattern.toLowerCase();
  const isSingleWord = /^[a-z][a-z']*$/.test(lc);
  const escaped = escapeRegex(lc);
  return isSingleWord ? new RegExp(`\\b${escaped}\\b`, 'g') : new RegExp(escaped, 'g');
}
const REGEX_CACHE = new Map();
function regexFor(p) {
  let re = REGEX_CACHE.get(p);
  if (!re) { re = buildPatternRegex(p); REGEX_CACHE.set(p, re); }
  re.lastIndex = 0;
  return re;
}
function hasAny(text, patterns) {
  const lc = lower(text);
  return patterns.some((p) => { const re = regexFor(p); re.lastIndex = 0; return re.test(lc); });
}
function hitCount(text, patterns) {
  const lc = lower(text);
  let count = 0;
  for (const p of patterns) {
    const re = regexFor(p);
    re.lastIndex = 0;
    while (re.exec(lc) !== null) count++;
  }
  return count;
}
function clamp01(n) {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  if (n < 0) return 0; if (n > 1) return 1;
  return n;
}

function scoreAgreementLexemes(text) {
  const hits = hitCount(text, AGREEMENT_LEXEMES);
  return clamp01(1 - Math.pow(0.6, hits));
}
function scoreDisagreementLexemes(text) {
  const hits = hitCount(text, DISAGREEMENT_LEXEMES);
  return clamp01(1 - Math.pow(0.55, hits));
}

function classifyAgreementType(text) {
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

function classifyDisagreementType(text) {
  if (hasAny(text, SCOPE_CHALLENGE_LEXEMES)) return 'scope';
  if (hasAny(text, DEFINITION_CHALLENGE_LEXEMES)) return 'definition';
  if (hasAny(text, EVIDENCE_REQUEST_LEXEMES)) return 'evidence';
  if (hasAny(text, LOGIC_CHALLENGE_LEXEMES)) return 'logic';
  if (hasAny(text, CAUSAL_CHALLENGE_LEXEMES)) return 'causal';
  if (hasAny(text, VALUE_CHALLENGE_LEXEMES)) return 'value';
  if (hasAny(text, TONE_LEXEMES)) return 'framing';
  if (hitCount(text, DISAGREEMENT_LEXEMES) > 0) return 'fact';
  return 'none';
}

function classifyReplyFunction(text, vector) {
  if (hasAny(text, JOKE_LEXEMES)) return 'joke';
  const a = vector.agreementScore;
  const d = vector.disagreementScore;
  const askQuote = hasAny(text, QUOTE_REQUEST_LEXEMES);
  const askSource = hasAny(text, EVIDENCE_REQUEST_LEXEMES);
  const askDef = hasAny(text, DEFINITION_CHALLENGE_LEXEMES);
  if (askQuote && a < 0.3) return 'ask_quote';
  if (askSource && a < 0.3) return 'ask_source';
  if (askDef && a < 0.3) return 'ask_definition';
  if (hasAny(text, COUNTEREXAMPLE_LEXEMES)) return 'counterexample';
  if (hasAny(text, SCOPE_CHALLENGE_LEXEMES) && d >= 0.25) return 'narrow_scope';
  if (hasAny(text, TANGENT_LEXEMES)) return 'branch_tangent';
  if (a >= 0.5 && d < 0.2) return 'support';
  if (a >= 0.4 && d >= 0.25) return 'caveat';
  if (d >= 0.5 && a < 0.3) return 'rebut';
  if (a >= 0.3 && d < 0.3) return 'extend';
  return 'unclear';
}

function deriveCoexistenceScore(a, d) { return clamp01(Math.min(a, d) * 2); }

function choosePrimaryStance(v) {
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

function buildRationale(v) {
  const parts = [];
  if (v.agreementScore >= 0.3) parts.push(`agrees on ${v.agreementType}`);
  if (v.disagreementScore >= 0.3) parts.push(`disagrees on ${v.disagreementType}`);
  if (v.coexistenceScore >= 0.4) parts.push('mixed state');
  if (v.replyFunction === 'ask_source') parts.push('asks for receipts');
  if (v.replyFunction === 'ask_quote') parts.push('asks for a quote anchor');
  if (v.replyFunction === 'counterexample') parts.push('drops a counterexample');
  if (parts.length === 0) parts.push('language relation is unclear');
  return `Observable: ${parts.join('; ')}.`;
}

function computeAgreementDisagreementVector(_rootText, replyText) {
  const reply = String(replyText || '');
  const aRaw = scoreAgreementLexemes(reply);
  const dRaw = scoreDisagreementLexemes(reply);
  const soft = hasAny(reply, SOFT_COEXISTENCE_LEXEMES);
  const attack = hasAny(reply, PERSON_ATTACK_LEXEMES);

  const axisHits =
    (hasAny(reply, SCOPE_CHALLENGE_LEXEMES) ? 1 : 0) +
    (hasAny(reply, DEFINITION_CHALLENGE_LEXEMES) ? 1 : 0) +
    (hasAny(reply, EVIDENCE_REQUEST_LEXEMES) ? 1 : 0) +
    (hasAny(reply, LOGIC_CHALLENGE_LEXEMES) ? 1 : 0) +
    (hasAny(reply, CAUSAL_CHALLENGE_LEXEMES) ? 1 : 0) +
    (hasAny(reply, VALUE_CHALLENGE_LEXEMES) ? 1 : 0) +
    (hasAny(reply, TONE_LEXEMES) ? 1 : 0) +
    (hasAny(reply, COUNTEREXAMPLE_LEXEMES) ? 1 : 0);
  const axisBoost = Math.min(0.5, axisHits * 0.3);

  const agreementScore = clamp01(aRaw + (soft ? 0.15 : 0));
  const disagreementScore = clamp01(dRaw + axisBoost + (soft ? 0.22 : 0));
  const hasAnySignal = aRaw > 0 || dRaw > 0 || axisHits > 0;
  const uncertaintyScore = clamp01(
    (attack ? 0.25 : 0) +
    (reply.trim().length < 12 ? 0.4 : 0) +
    (!hasAnySignal ? 0.5 : 0),
  );
  const coexistenceScore = deriveCoexistenceScore(agreementScore, disagreementScore);
  const agreementType = classifyAgreementType(reply);
  const disagreementType = classifyDisagreementType(reply);
  const replyFunction = classifyReplyFunction(reply, { agreementScore, disagreementScore });
  const primaryStance = choosePrimaryStance({
    agreementScore, disagreementScore, coexistenceScore, replyFunction, uncertaintyScore,
  });
  const vector = {
    agreementScore, disagreementScore, coexistenceScore, uncertaintyScore,
    primaryStance, agreementType, disagreementType, replyFunction,
    scalarRationale: '',
    userReviewRequired: true,
  };
  vector.scalarRationale = buildRationale(vector);
  return vector;
}

function interpretReplyPair(pair) {
  const v = computeAgreementDisagreementVector(pair.rootText || pair.rootTextRedacted, pair.replyText || pair.replyTextRedacted);
  const labels = [];
  const reply = String(pair.replyText || pair.replyTextRedacted || '');
  if (hasAny(reply, EVIDENCE_REQUEST_LEXEMES)) labels.push('receipt_request');
  if (hasAny(reply, QUOTE_REQUEST_LEXEMES)) labels.push('quote_request');
  if (hasAny(reply, DEFINITION_CHALLENGE_LEXEMES)) labels.push('definition_ask');
  if (hasAny(reply, SCOPE_CHALLENGE_LEXEMES)) labels.push('scope_challenge');
  if (hasAny(reply, COUNTEREXAMPLE_LEXEMES)) labels.push('counterexample');
  if (hasAny(reply, SOFT_COEXISTENCE_LEXEMES)) labels.push('concession_caveat');
  if (hasAny(reply, JOKE_LEXEMES)) labels.push('joke');
  if (hasAny(reply, TANGENT_LEXEMES)) labels.push('tangent_hint');
  if (hasAny(reply, PERSON_ATTACK_LEXEMES)) labels.push('person_attack_language');
  return {
    pairId: pair.pairId,
    deterministicVector: v,
    xaiVector: null,
    finalVector: v,
    classifierSource: 'deterministic',
    confidence: v.uncertaintyScore >= 0.6 ? 'low' : v.uncertaintyScore >= 0.3 ? 'medium' : 'high',
    labels,
    ruleCandidates: [],
    excluded: false,
    exclusionReason: null,
  };
}

module.exports = {
  AGREEMENT_LEXEMES, DISAGREEMENT_LEXEMES, SOFT_COEXISTENCE_LEXEMES,
  EVIDENCE_REQUEST_LEXEMES, QUOTE_REQUEST_LEXEMES, SCOPE_CHALLENGE_LEXEMES,
  DEFINITION_CHALLENGE_LEXEMES, CAUSAL_CHALLENGE_LEXEMES,
  LOGIC_CHALLENGE_LEXEMES, VALUE_CHALLENGE_LEXEMES,
  COUNTEREXAMPLE_LEXEMES, TANGENT_LEXEMES, JOKE_LEXEMES, TONE_LEXEMES,
  PERSON_ATTACK_LEXEMES,
  scoreAgreementLexemes, scoreDisagreementLexemes,
  classifyAgreementType, classifyDisagreementType, classifyReplyFunction,
  deriveCoexistenceScore, choosePrimaryStance, buildRationale,
  computeAgreementDisagreementVector, interpretReplyPair,
};
