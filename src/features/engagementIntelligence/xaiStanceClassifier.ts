/**
 * xAI structured stance classifier — adapter only.
 *
 * The actual HTTP call lives in `scripts/engagement-intelligence/xaiClassifyPairs.js`.
 * This file is the pure prompt / schema / validator used by both the script and
 * tests. It does NOT import any network library.
 *
 * Compliance contract (asserted by tests):
 *  - The prompt forbids truth claims, winner/loser, bad-faith / dishonest /
 *    manipulative / liar / extremist labels, moderation recommendations.
 *  - The expected output is JSON only.
 *  - The output ALWAYS sets `userReviewRequired: true`.
 *  - The output never infers protected-class attributes.
 */

import type {
  XaiClassifierInput,
  XaiClassifierOutput,
  XaiInvocationResult,
  AgreementDisagreementVector,
} from './types';

export const XAI_SYSTEM_PROMPT = [
  'You classify the observable language relationship between a public root post and a public reply.',
  'You are NOT a truth engine, moderator, or judge.',
  'You do NOT decide who is correct.',
  'You do NOT infer intent as fact.',
  'You do NOT label people as bad-faith, manipulative, dishonest, liar, extremist, propagandist, or any similar term.',
  'You do NOT make moderation recommendations.',
  'You do NOT declare a winner or loser.',
  'You do NOT infer protected-class attributes (race, religion, sexuality, health, political affiliation, etc.).',
  'You output compact JSON only — no prose outside the JSON.',
  'Every output sets userReviewRequired to true; downstream code treats the result as advisory.',
].join(' ');

export const XAI_OUTPUT_JSON_SCHEMA = {
  type: 'object',
  required: [
    'agreementScore', 'disagreementScore', 'coexistenceScore', 'uncertaintyScore',
    'primaryStance', 'agreementType', 'disagreementType', 'replyFunction',
    'scalarRationale', 'userReviewRequired',
  ],
  properties: {
    agreementScore: { type: 'number', minimum: 0, maximum: 1 },
    disagreementScore: { type: 'number', minimum: 0, maximum: 1 },
    coexistenceScore: { type: 'number', minimum: 0, maximum: 1 },
    uncertaintyScore: { type: 'number', minimum: 0, maximum: 1 },
    primaryStance: {
      type: 'string',
      enum: [
        'strong_agree', 'weak_agree', 'mixed_agree_disagree', 'weak_disagree',
        'strong_disagree', 'unclear', 'tangent', 'joke_or_meme',
        'receipt_request', 'quote_request',
      ],
    },
    agreementType: { type: 'string', enum: ['premise', 'evidence', 'conclusion', 'value', 'framing', 'context', 'none'] },
    disagreementType: { type: 'string', enum: ['fact', 'definition', 'causal', 'value', 'evidence', 'logic', 'scope', 'framing', 'none'] },
    replyFunction: {
      type: 'string',
      enum: [
        'support', 'extend', 'caveat', 'rebut', 'counterexample',
        'ask_source', 'ask_quote', 'ask_definition', 'narrow_scope',
        'branch_tangent', 'synthesize', 'joke', 'unclear',
      ],
    },
    scalarRationale: { type: 'string', maxLength: 240 },
    ruleCandidate: {
      type: 'object',
      properties: {
        title: { type: 'string', maxLength: 120 },
        conditionDescription: { type: 'string', maxLength: 240 },
        deterministicPredicateName: { type: 'string', maxLength: 80 },
      },
      required: ['title', 'conditionDescription', 'deterministicPredicateName'],
    },
    userReviewRequired: { type: 'boolean', const: true },
  },
  additionalProperties: false,
} as const;

export function buildXaiAgreementPrompt(input: XaiClassifierInput): {
  system: string;
  user: string;
  schema: typeof XAI_OUTPUT_JSON_SCHEMA;
} {
  const user = [
    'Classify only what the words show.',
    'rootTextRedacted:', input.rootTextRedacted,
    'replyTextRedacted:', input.replyTextRedacted,
    'rootMetrics:', JSON.stringify(input.rootMetrics),
    'replyMetrics:', JSON.stringify(input.replyMetrics),
    'deterministicVector:', JSON.stringify(input.deterministicVector),
    '',
    'Output JSON only matching the provided schema. Set userReviewRequired:true.',
  ].join('\n');
  return { system: XAI_SYSTEM_PROMPT, user, schema: XAI_OUTPUT_JSON_SCHEMA };
}

const STANCES = new Set(XAI_OUTPUT_JSON_SCHEMA.properties.primaryStance.enum);
const AGREE = new Set(XAI_OUTPUT_JSON_SCHEMA.properties.agreementType.enum);
const DISAGREE = new Set(XAI_OUTPUT_JSON_SCHEMA.properties.disagreementType.enum);
const FUNCTIONS = new Set(XAI_OUTPUT_JSON_SCHEMA.properties.replyFunction.enum);

const FORBIDDEN_OUTPUT_TOKENS = [
  'liar', 'dishonest', 'bad faith', 'manipulative', 'manipulation',
  'extremist', 'propagandist', 'winner', 'loser', 'verdict',
];

function inRange01(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
}

/**
 * Validate a parsed JSON object from xAI. Returns the typed output or throws.
 * Caller is responsible for try/catch.
 */
export function validateXaiOutput(parsed: unknown): XaiClassifierOutput {
  if (!parsed || typeof parsed !== 'object') throw new Error('xAI output is not an object');
  const o = parsed as Record<string, unknown>;
  if (!inRange01(o.agreementScore)) throw new Error('agreementScore out of range');
  if (!inRange01(o.disagreementScore)) throw new Error('disagreementScore out of range');
  if (!inRange01(o.coexistenceScore)) throw new Error('coexistenceScore out of range');
  if (!inRange01(o.uncertaintyScore)) throw new Error('uncertaintyScore out of range');
  if (typeof o.primaryStance !== 'string' || !STANCES.has(o.primaryStance as never)) {
    throw new Error('invalid primaryStance');
  }
  if (typeof o.agreementType !== 'string' || !AGREE.has(o.agreementType as never)) {
    throw new Error('invalid agreementType');
  }
  if (typeof o.disagreementType !== 'string' || !DISAGREE.has(o.disagreementType as never)) {
    throw new Error('invalid disagreementType');
  }
  if (typeof o.replyFunction !== 'string' || !FUNCTIONS.has(o.replyFunction as never)) {
    throw new Error('invalid replyFunction');
  }
  if (typeof o.scalarRationale !== 'string') throw new Error('scalarRationale must be a string');
  if (o.userReviewRequired !== true) throw new Error('userReviewRequired must be true');

  const rationaleLower = String(o.scalarRationale).toLowerCase();
  for (const banned of FORBIDDEN_OUTPUT_TOKENS) {
    if (rationaleLower.includes(banned)) throw new Error(`xAI rationale contains forbidden token: ${banned}`);
  }

  const out: XaiClassifierOutput = {
    agreementScore: o.agreementScore as number,
    disagreementScore: o.disagreementScore as number,
    coexistenceScore: o.coexistenceScore as number,
    uncertaintyScore: o.uncertaintyScore as number,
    primaryStance: o.primaryStance as XaiClassifierOutput['primaryStance'],
    agreementType: o.agreementType as XaiClassifierOutput['agreementType'],
    disagreementType: o.disagreementType as XaiClassifierOutput['disagreementType'],
    replyFunction: o.replyFunction as XaiClassifierOutput['replyFunction'],
    scalarRationale: o.scalarRationale as string,
    userReviewRequired: true,
  };
  if (o.ruleCandidate && typeof o.ruleCandidate === 'object') {
    const rc = o.ruleCandidate as Record<string, unknown>;
    out.ruleCandidate = {
      title: String(rc.title || ''),
      conditionDescription: String(rc.conditionDescription || ''),
      deterministicPredicateName: String(rc.deterministicPredicateName || ''),
    };
  }
  return out;
}

/**
 * "Disabled" path returned by the script when env flags are off. Tests call
 * this directly without any network.
 */
export function classifyPairWithXaiDisabled(
  reason: NonNullable<XaiInvocationResult['disabledReason']>,
): XaiInvocationResult {
  return { enabled: false, disabledReason: reason, output: null };
}

/** Merge deterministic + xAI vectors into a "hybrid" vector. xAI nudges, never overrides. */
export function mergeVectors(
  base: AgreementDisagreementVector,
  xai: XaiClassifierOutput,
): AgreementDisagreementVector {
  const avg = (a: number, b: number) => (a + b) / 2;
  return {
    agreementScore: avg(base.agreementScore, xai.agreementScore),
    disagreementScore: avg(base.disagreementScore, xai.disagreementScore),
    coexistenceScore: avg(base.coexistenceScore, xai.coexistenceScore),
    uncertaintyScore: avg(base.uncertaintyScore, xai.uncertaintyScore),
    primaryStance: base.primaryStance === 'unclear' ? xai.primaryStance : base.primaryStance,
    agreementType: base.agreementType === 'none' ? xai.agreementType : base.agreementType,
    disagreementType: base.disagreementType === 'none' ? xai.disagreementType : base.disagreementType,
    replyFunction: base.replyFunction === 'unclear' ? xai.replyFunction : base.replyFunction,
    scalarRationale: `${base.scalarRationale} | xAI: ${xai.scalarRationale}`,
    userReviewRequired: true,
  };
}
