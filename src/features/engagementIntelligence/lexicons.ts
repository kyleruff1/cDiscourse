/**
 * Lexicons used by the deterministic agreement scalar.
 *
 * Each pattern is a lowercase substring or word-boundary regex. Patterns are
 * intentionally simple: this module decides how to weave them, not how to
 * decide truth. xAI may refine these later; the lexicons remain the public
 * contract.
 */

export const AGREEMENT_LEXEMES: string[] = [
  'agree',
  'agreed',
  'yes',
  'fair',
  'true',
  'correct',
  'right',
  'good point',
  'i grant',
  'i acknowledge',
  'i concede',
  'that part',
  'partly',
  'partially',
  'basically',
  'mostly',
  'exactly',
  'spot on',
];

export const DISAGREEMENT_LEXEMES: string[] = [
  'disagree',
  'no',
  'not really',
  'wrong',
  'incorrect',
  'does not follow',
  "doesn't follow",
  'misses',
  'overstates',
  'understates',
  'undercuts',
  'this ignores',
  'this misses',
  'this is wrong',
  'actually no',
];

/** Coexistence bridges — appear in BOTH agreement and disagreement at once. */
export const SOFT_COEXISTENCE_LEXEMES: string[] = [
  'but',
  'however',
  'though',
  'although',
  'yet',
  'still',
  'that said',
  'mostly right',
  'mostly wrong',
  'partly right',
  'partly wrong',
  'fair point but',
  'i agree but',
  'yes but',
  'true but',
  'i grant',
];

export const EVIDENCE_REQUEST_LEXEMES: string[] = [
  'source',
  'sources',
  'receipts',
  'receipt',
  'evidence',
  'data',
  'citation',
  'where is this from',
  'prove it',
  'link?',
  'link please',
  'show your work',
];

export const QUOTE_REQUEST_LEXEMES: string[] = [
  'quote',
  'exact words',
  'where did they say',
  'point to the sentence',
  'highlight the bit',
  'which part exactly',
  'quote the exact',
];

export const SCOPE_CHALLENGE_LEXEMES: string[] = [
  'all',
  'never',
  'always',
  'everyone',
  'nobody',
  'every single',
  'too broad',
  'overgeneralized',
  'overgeneralization',
  'scope',
  'edge case',
  'goalposts',
  'moving the goalposts',
  'narrow the claim',
  'narrow that',
  'narrow that down',
];

export const DEFINITION_CHALLENGE_LEXEMES: string[] = [
  'define',
  'definition',
  'what counts as',
  'what do you mean',
  'that word',
  'undefined',
  'undefined term',
];

export const CAUSAL_CHALLENGE_LEXEMES: string[] = [
  'correlation',
  'correlation does not',
  'cause and effect',
  'spurious',
  'reverse causation',
];

export const LOGIC_CHALLENGE_LEXEMES: string[] = [
  'does not follow',
  "doesn't follow",
  'non sequitur',
  'contradiction',
  'circular',
  'begging the question',
];

export const VALUE_CHALLENGE_LEXEMES: string[] = [
  'wrong priorities',
  'priorities',
  'priority',
  'values',
  'worth it',
  'tradeoff',
  'trade-off',
  'what really matters',
  'what matters',
];

export const COUNTEREXAMPLE_LEXEMES: string[] = [
  'counterexample',
  'counter-example',
  'what about',
  'consider',
  'one example',
  'edge case',
];

export const TANGENT_LEXEMES: string[] = [
  'speaking of',
  'unrelated',
  'tangent',
  'side note',
  'off topic',
  'different topic',
];

export const JOKE_LEXEMES: string[] = [
  'lol',
  'lmao',
  'rofl',
  '😂',
  '🤣',
  'haha',
  'just kidding',
  '/s',
  'meme',
];

export const TONE_LEXEMES: string[] = [
  'tone',
  'framing',
  'loaded',
  'phrasing',
  'condescending',
];

/**
 * Person-attack labels we explicitly refuse to emit AND refuse to use as
 * classification signal. If a reply uses these words, the classifier
 * downweights confidence rather than amplifying disagreement.
 */
export const PERSON_ATTACK_LEXEMES: string[] = [
  'liar',
  'lying',
  'dishonest',
  'bad faith',
  'manipulative',
  'manipulation',
  'shill',
  'extremist',
  'propagandist',
];
