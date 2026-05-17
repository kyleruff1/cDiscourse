/**
 * xAI stance classifier — compliance / contract tests.
 *
 * These tests run no HTTP. They verify the prompt + schema + validator + the
 * disabled-by-default runtime CLI behavior.
 */
import {
  XAI_SYSTEM_PROMPT,
  XAI_OUTPUT_JSON_SCHEMA,
  buildXaiAgreementPrompt,
  validateXaiOutput,
  classifyPairWithXaiDisabled,
  mergeVectors,
} from '../src/features/engagementIntelligence/xaiStanceClassifier';
import type { AgreementDisagreementVector, XaiClassifierInput, XaiClassifierOutput } from '../src/features/engagementIntelligence/types';

describe('XAI_SYSTEM_PROMPT — compliance contract', () => {
  const lc = XAI_SYSTEM_PROMPT.toLowerCase();

  it('asserts not-a-truth-engine / not-a-moderator', () => {
    expect(lc).toContain('not a truth engine');
    expect(lc).toContain('moderator');
  });

  it('forbids bad-faith / dishonest / manipulative / liar labels', () => {
    expect(lc).toContain('bad-faith');
    expect(lc).toContain('manipulative');
    expect(lc).toContain('dishonest');
    expect(lc).toContain('liar');
  });

  it('forbids winner/loser language', () => {
    expect(lc).toContain('winner');
    expect(lc).toContain('loser');
  });

  it('forbids protected-class inference', () => {
    expect(lc).toContain('protected-class');
  });

  it('requires JSON only output', () => {
    expect(lc).toContain('json only');
  });

  it('marks all outputs as user-review-required / advisory', () => {
    expect(lc).toContain('userreviewrequired');
    expect(lc).toContain('advisory');
  });
});

describe('XAI_OUTPUT_JSON_SCHEMA', () => {
  it('locks userReviewRequired to true', () => {
    expect(XAI_OUTPUT_JSON_SCHEMA.properties.userReviewRequired.const).toBe(true);
  });

  it('bounds scores 0..1', () => {
    for (const k of ['agreementScore', 'disagreementScore', 'coexistenceScore', 'uncertaintyScore'] as const) {
      const p = XAI_OUTPUT_JSON_SCHEMA.properties[k];
      expect(p.minimum).toBe(0);
      expect(p.maximum).toBe(1);
    }
  });

  it('lists the same stance enum as the type union', () => {
    expect(XAI_OUTPUT_JSON_SCHEMA.properties.primaryStance.enum).toEqual([
      'strong_agree', 'weak_agree', 'mixed_agree_disagree', 'weak_disagree',
      'strong_disagree', 'unclear', 'tangent', 'joke_or_meme',
      'receipt_request', 'quote_request',
    ]);
  });
});

describe('buildXaiAgreementPrompt', () => {
  const baseVector: AgreementDisagreementVector = {
    agreementScore: 0.4, disagreementScore: 0.4, coexistenceScore: 0.4, uncertaintyScore: 0.2,
    primaryStance: 'mixed_agree_disagree', agreementType: 'premise', disagreementType: 'evidence',
    replyFunction: 'caveat', scalarRationale: 'mixed', userReviewRequired: true,
  };
  const input: XaiClassifierInput = {
    rootTextRedacted: 'The new policy works.',
    replyTextRedacted: 'Fair point, but source?',
    rootMetrics: { replyCount: 10, repostCount: 5, quoteCount: 2, likeCount: 100 },
    replyMetrics: { replyCount: 0, repostCount: 0, quoteCount: 0, likeCount: 12 },
    deterministicVector: baseVector,
  };

  it('returns a system prompt, user prompt, and schema', () => {
    const out = buildXaiAgreementPrompt(input);
    expect(out.system).toBe(XAI_SYSTEM_PROMPT);
    expect(out.user).toContain('rootTextRedacted');
    expect(out.user).toContain('Output JSON only');
    expect(out.user).toContain('userReviewRequired:true');
    expect(out.schema).toBe(XAI_OUTPUT_JSON_SCHEMA);
  });
});

describe('validateXaiOutput', () => {
  function valid(): XaiClassifierOutput {
    return {
      agreementScore: 0.4, disagreementScore: 0.5, coexistenceScore: 0.4, uncertaintyScore: 0.2,
      primaryStance: 'mixed_agree_disagree',
      agreementType: 'premise', disagreementType: 'evidence',
      replyFunction: 'caveat',
      scalarRationale: 'reply agrees on premise; asks for source',
      userReviewRequired: true,
    };
  }

  it('passes a well-formed output', () => {
    expect(validateXaiOutput(valid())).toEqual(valid());
  });

  it('rejects userReviewRequired=false', () => {
    expect(() => validateXaiOutput({ ...valid(), userReviewRequired: false })).toThrow(/userReviewRequired/);
  });

  it('rejects out-of-range scores', () => {
    expect(() => validateXaiOutput({ ...valid(), agreementScore: 1.4 })).toThrow();
  });

  it('rejects forbidden tokens in scalarRationale', () => {
    expect(() => validateXaiOutput({ ...valid(), scalarRationale: 'the reply is a liar' })).toThrow(/forbidden token/);
    expect(() => validateXaiOutput({ ...valid(), scalarRationale: 'declares winner' })).toThrow(/forbidden token/);
    expect(() => validateXaiOutput({ ...valid(), scalarRationale: 'bad faith argument' })).toThrow(/forbidden token/);
  });
});

describe('classifyPairWithXaiDisabled', () => {
  it('returns env_flag_off / api_key_missing / no_pilot_flag / synthetic_only_mode shapes', () => {
    for (const r of ['env_flag_off', 'api_key_missing', 'no_pilot_flag', 'synthetic_only_mode'] as const) {
      const out = classifyPairWithXaiDisabled(r);
      expect(out.enabled).toBe(false);
      expect(out.disabledReason).toBe(r);
      expect(out.output).toBeNull();
    }
  });
});

describe('mergeVectors — xAI nudges, never overrides', () => {
  const base: AgreementDisagreementVector = {
    agreementScore: 0.4, disagreementScore: 0.4, coexistenceScore: 0.4, uncertaintyScore: 0.4,
    primaryStance: 'mixed_agree_disagree', agreementType: 'premise', disagreementType: 'evidence',
    replyFunction: 'caveat', scalarRationale: 'base rationale', userReviewRequired: true,
  };
  const xai: XaiClassifierOutput = {
    agreementScore: 0.6, disagreementScore: 0.6, coexistenceScore: 0.5, uncertaintyScore: 0.2,
    primaryStance: 'mixed_agree_disagree', agreementType: 'evidence', disagreementType: 'scope',
    replyFunction: 'narrow_scope', scalarRationale: 'xai rationale', userReviewRequired: true,
  };

  it('averages numeric fields', () => {
    const m = mergeVectors(base, xai);
    expect(m.agreementScore).toBeCloseTo(0.5, 5);
    expect(m.disagreementScore).toBeCloseTo(0.5, 5);
    expect(m.coexistenceScore).toBeCloseTo(0.45, 5);
  });

  it('keeps base primaryStance when not "unclear"', () => {
    const m = mergeVectors(base, xai);
    expect(m.primaryStance).toBe(base.primaryStance);
  });

  it('promotes xAI when base.replyFunction is unclear', () => {
    const baseUnclear = { ...base, replyFunction: 'unclear' as const };
    const m = mergeVectors(baseUnclear, xai);
    expect(m.replyFunction).toBe(xai.replyFunction);
  });

  it('always sets userReviewRequired=true', () => {
    expect(mergeVectors(base, xai).userReviewRequired).toBe(true);
  });
});
