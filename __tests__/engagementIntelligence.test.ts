/**
 * Engagement Intelligence — deterministic scalar tests.
 *
 * Walks the synthetic fixture and asserts every pair's primary stance / type
 * lands in an expected band. Also covers the rule-candidate builder and the
 * Markdown aggregate builder.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  computeAgreementDisagreementVector,
  detectConcessionCaveat,
  detectReceiptRequest,
  detectQuoteRequest,
  detectDefinitionAsk,
  detectScopeChallenge,
  detectCounterexample,
  detectLogicChallenge,
  detectJoke,
  detectTangentHint,
  detectPersonAttack,
  interpretReplyPair,
} from '../src/features/engagementIntelligence/agreementScalar';
import { buildRuleCandidatesFromAnalyses, summarizeAgreementEpidemiology } from '../src/features/engagementIntelligence/ruleCandidates';
import type { ReplyPairSample } from '../src/features/engagementIntelligence/types';

const repoRoot = process.cwd();
const SYNTHETIC = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'fixtures/engagement-intelligence/synthetic-news-reply-pairs.json'), 'utf8'),
);

type SyntheticPair = {
  pairId: string;
  rootText: string;
  replyText: string;
  expectedPrimaryStance: string;
  expectedAgreementType: string;
  expectedDisagreementType: string;
  expectedReplyFunction: string;
  expectedCoexistenceMin: number;
  expectedCoexistenceMax: number;
};

function vectorFor(pair: SyntheticPair) {
  return computeAgreementDisagreementVector(pair.rootText, pair.replyText);
}

describe('agreementScalar — deterministic detectors', () => {
  it('detects soft-coexistence "fair point, but…"', () => {
    expect(detectConcessionCaveat('Fair point, but it also rushed pitchers.')).toBe(true);
  });

  it('detects receipt request', () => {
    expect(detectReceiptRequest('Source for that?')).toBe(true);
    expect(detectReceiptRequest('Receipts, please.')).toBe(true);
  });

  it('detects quote request', () => {
    expect(detectQuoteRequest('Quote the exact bit.')).toBe(true);
    expect(detectQuoteRequest('Which part exactly?')).toBe(true);
  });

  it('detects definition ask', () => {
    expect(detectDefinitionAsk('Define successful.')).toBe(true);
  });

  it('detects scope challenge', () => {
    expect(detectScopeChallenge('Too broad. Not true for everyone.')).toBe(true);
  });

  it('detects counterexample', () => {
    expect(detectCounterexample('Counterexample: a diner with a huge menu.')).toBe(true);
  });

  it('detects logic challenge', () => {
    expect(detectLogicChallenge('That does not follow.')).toBe(true);
  });

  it('detects joke / tangent', () => {
    expect(detectJoke('lol 😂')).toBe(true);
    expect(detectTangentHint('Speaking of, parking is bad.')).toBe(true);
  });

  it('person-attack lexemes are *detected* (used to downweight confidence, never to amplify disagreement)', () => {
    expect(detectPersonAttack('what a liar')).toBe(true);
  });
});

describe('agreementScalar — synthetic fixture', () => {
  const pairs: SyntheticPair[] = SYNTHETIC.pairs;

  it('fixture has at least 24 pairs covering required stances', () => {
    expect(pairs.length).toBeGreaterThanOrEqual(24);
    const stances = new Set(pairs.map((p) => p.expectedPrimaryStance));
    for (const required of [
      'strong_agree', 'weak_agree', 'mixed_agree_disagree', 'weak_disagree',
      'strong_disagree', 'receipt_request', 'quote_request', 'tangent', 'joke_or_meme', 'unclear',
    ]) {
      expect(stances.has(required)).toBe(true);
    }
  });

  for (const pair of (SYNTHETIC.pairs as SyntheticPair[])) {
    it(`primary stance band: ${pair.pairId} → ${pair.expectedPrimaryStance}`, () => {
      const v = vectorFor(pair);
      // We allow some slack: any of the listed "expected family" stances counts.
      const family: Record<string, string[]> = {
        strong_agree: ['strong_agree', 'weak_agree'],
        weak_agree: ['weak_agree', 'strong_agree', 'mixed_agree_disagree'],
        mixed_agree_disagree: ['mixed_agree_disagree', 'weak_agree', 'weak_disagree'],
        weak_disagree: ['weak_disagree', 'strong_disagree', 'mixed_agree_disagree', 'unclear'],
        strong_disagree: ['strong_disagree', 'weak_disagree', 'mixed_agree_disagree'],
        receipt_request: ['receipt_request'],
        quote_request: ['quote_request', 'receipt_request'],
        tangent: ['tangent'],
        joke_or_meme: ['joke_or_meme'],
        unclear: ['unclear', 'weak_agree', 'weak_disagree'],
      };
      const allowed = family[pair.expectedPrimaryStance] || [pair.expectedPrimaryStance];
      expect(allowed).toContain(v.primaryStance);
    });

    it(`coexistence band: ${pair.pairId}`, () => {
      const v = vectorFor(pair);
      expect(v.coexistenceScore).toBeGreaterThanOrEqual(pair.expectedCoexistenceMin - 0.01);
      expect(v.coexistenceScore).toBeLessThanOrEqual(pair.expectedCoexistenceMax + 0.01);
    });
  }

  it('every vector has userReviewRequired=true', () => {
    for (const pair of pairs) expect(vectorFor(pair).userReviewRequired).toBe(true);
  });

  it('every vector has scalarRationale non-empty', () => {
    for (const pair of pairs) expect(vectorFor(pair).scalarRationale.length).toBeGreaterThan(0);
  });
});

describe('interpretReplyPair → rule candidates', () => {
  function makePair(id: string, rootText: string, replyText: string): ReplyPairSample {
    return {
      pairId: id,
      rootPostIdHash: 'r1', replyPostIdHash: `${id}-rep`,
      storyIdHash: null,
      rootTextRedacted: rootText, replyTextRedacted: replyText,
      rootMetrics: { replyCount: 1, repostCount: 0, quoteCount: 0, likeCount: 1 },
      replyMetrics: { replyCount: 0, repostCount: 0, quoteCount: 0, likeCount: 1 },
      replyRank: 1, collectedAt: new Date().toISOString(),
      threadContext: { conversationIdHash: null, replyDepthEstimate: 1, isDirectReply: true, hasQuoteReference: false },
      safety: { shouldExclude: false, exclusionReason: null },
    };
  }

  it('builds shouldPromptForReceipts when a reply asks for sources', () => {
    const interp = interpretReplyPair(makePair('p1', 'A claim.', 'Receipts, please. Source?'));
    const candidates = buildRuleCandidatesFromAnalyses([interp]);
    const titles = candidates.map((c) => c.deterministicPredicateName);
    expect(titles).toContain('shouldPromptForReceipts');
  });

  it('builds shouldPromptQuoteExactBit when a reply asks for quote anchor', () => {
    const interp = interpretReplyPair(makePair('p2', 'A claim.', 'Quote the exact bit.'));
    const candidates = buildRuleCandidatesFromAnalyses([interp]);
    expect(candidates.map((c) => c.deterministicPredicateName)).toContain('shouldPromptQuoteExactBit');
  });

  it('builds shouldShowMixedAgreementDisagreementStatus when coexistence is high', () => {
    const interp = interpretReplyPair(makePair('p3', 'Pitch clock helped baseball overall.', 'Fair point, but source for the overall claim?'));
    expect(interp.finalVector.coexistenceScore).toBeGreaterThan(0.3);
    const candidates = buildRuleCandidatesFromAnalyses([interp]);
    expect(candidates.map((c) => c.deterministicPredicateName)).toContain('shouldShowMixedAgreementDisagreementStatus');
  });

  it('summary aggregate counts pairs, distributions, and rule candidates', () => {
    const interpretations = (SYNTHETIC.pairs as SyntheticPair[]).map((p) => interpretReplyPair(makePair(p.pairId, p.rootText, p.replyText)));
    const agg = summarizeAgreementEpidemiology(
      'unit-run', 'synthetic', interpretations,
      { storyCount: 0, rootPostCount: interpretations.length, notes: 'unit test' },
    );
    expect(agg.replyPairCount).toBe(interpretations.length);
    expect(Object.values(agg.stanceDistribution).reduce((a, n) => a + n, 0)).toBe(interpretations.length);
    expect(agg.topReplyFunctions.length).toBeGreaterThan(0);
    expect(agg.topRuleCandidates.length).toBeGreaterThan(0);
  });

  it('rule candidates never set enabledByDefault to true', () => {
    const interpretations = (SYNTHETIC.pairs as SyntheticPair[]).map((p) => interpretReplyPair(makePair(p.pairId, p.rootText, p.replyText)));
    const candidates = buildRuleCandidatesFromAnalyses(interpretations);
    for (const c of candidates) expect(c.enabledByDefault).toBe(false);
  });
});

describe('synthetic fixture safety', () => {
  it('contains no real handles, URLs, or emails', () => {
    const text = JSON.stringify(SYNTHETIC);
    expect(text).not.toMatch(/@[A-Za-z0-9_]{3,15}/); // no @handles
    expect(text).not.toMatch(/https?:\/\//);
    expect(text).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  });

  it('contains no forbidden person-attack labels', () => {
    const text = JSON.stringify(SYNTHETIC).toLowerCase();
    for (const banned of ['liar', 'dishonest', 'bad faith', 'manipulative', 'manipulation']) {
      expect(text).not.toContain(banned);
    }
  });
});

describe('TS ↔ JS parity', () => {
  // The Node-side analyzer uses a JS twin of the scalar. Ensure both agree on
  // primaryStance for every synthetic pair so the committed report shape and
  // the test expectations cannot drift.
  const jsTwin = require(path.join(repoRoot, 'scripts/engagement-intelligence/agreementScalarJs.js'));

  for (const pair of (SYNTHETIC.pairs as SyntheticPair[])) {
    it(`TS and JS scalars agree on ${pair.pairId}`, () => {
      const tsV = computeAgreementDisagreementVector(pair.rootText, pair.replyText);
      const jsV = jsTwin.computeAgreementDisagreementVector(pair.rootText, pair.replyText);
      expect(jsV.primaryStance).toBe(tsV.primaryStance);
      expect(jsV.replyFunction).toBe(tsV.replyFunction);
      expect(jsV.disagreementType).toBe(tsV.disagreementType);
      expect(jsV.agreementType).toBe(tsV.agreementType);
      expect(Math.abs(jsV.agreementScore - tsV.agreementScore)).toBeLessThan(0.001);
      expect(Math.abs(jsV.disagreementScore - tsV.disagreementScore)).toBeLessThan(0.001);
    });
  }
});
