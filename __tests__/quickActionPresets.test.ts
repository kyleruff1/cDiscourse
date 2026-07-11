/**
 * Stage 6.2 — Milestone 7: quick-action → composer preset tests.
 */
import {
  quickActionToPreset,
  ASK_CLARIFY_PRESET_BODY,
  ANSWER_QUESTION_PRESET_BODY,
  SHARPEN_CLAIM_PRESET_BODY,
} from '../src/features/arguments/quickActionPresets';

describe('quickActionToPreset', () => {
  it('reply returns no forced type', () => {
    expect(quickActionToPreset('reply', 'thesis')).toBeNull();
  });

  it('challenge maps to rebuttal when parent is thesis/claim', () => {
    const p = quickActionToPreset('challenge', 'thesis');
    expect(p?.argumentType).toBe('rebuttal');
    expect(p?.disagreementAxis).toBeNull(); // no forced axis
  });

  it('challenge maps to counter_rebuttal when parent is rebuttal', () => {
    expect(quickActionToPreset('challenge', 'rebuttal')?.argumentType).toBe('counter_rebuttal');
  });

  it('source maps to clarification_request with a source_request tag', () => {
    const p = quickActionToPreset('source', 'claim');
    expect(p?.argumentType).toBe('clarification_request');
    expect(p?.suggestedTagCodes).toContain('source_request');
  });

  it('quote maps to clarification with a quote_request tag', () => {
    expect(quickActionToPreset('quote', 'claim')?.suggestedTagCodes).toContain('quote_request');
  });

  it('clarify maps to clarification_request without prefilled tags', () => {
    const p = quickActionToPreset('clarify', 'claim');
    expect(p?.argumentType).toBe('clarification_request');
    expect(p?.suggestedTagCodes ?? []).toHaveLength(0);
  });

  it('evidence maps to evidence type', () => {
    expect(quickActionToPreset('evidence', 'claim')?.argumentType).toBe('evidence');
  });

  it('concede maps to concession type without exact-phrase requirement', () => {
    const p = quickActionToPreset('concede', 'claim');
    expect(p?.argumentType).toBe('concession');
  });

  it('branch + flag return null (no destructive defaults)', () => {
    expect(quickActionToPreset('branch', 'claim')).toBeNull();
    expect(quickActionToPreset('flag', 'claim')).toBeNull();
  });
});

describe('UX-FLAGS-004 — flag-intent quick actions', () => {
  it('ask_clarify maps to clarification_request + ASK_CLARIFY_PRESET_BODY', () => {
    const p = quickActionToPreset('ask_clarify', 'claim');
    expect(p?.argumentType).toBe('clarification_request');
    expect(p?.body).toBe(ASK_CLARIFY_PRESET_BODY);
  });

  it('answer_question is body-only (no forced argumentType) + ANSWER_QUESTION_PRESET_BODY', () => {
    const p = quickActionToPreset('answer_question', 'claim');
    expect(p).not.toBeNull();
    expect(p?.argumentType).toBeUndefined();
    expect(p?.body).toBe(ANSWER_QUESTION_PRESET_BODY);
  });

  it('sharpen_claim maps to clarification_request + SHARPEN_CLAIM_PRESET_BODY', () => {
    const p = quickActionToPreset('sharpen_claim', 'claim');
    expect(p?.argumentType).toBe('clarification_request');
    expect(p?.body).toBe(SHARPEN_CLAIM_PRESET_BODY);
  });

  it('the three new bodies are non-empty prose', () => {
    for (const body of [ASK_CLARIFY_PRESET_BODY, ANSWER_QUESTION_PRESET_BODY, SHARPEN_CLAIM_PRESET_BODY]) {
      expect(typeof body).toBe('string');
      expect(body.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('UX-FLAGS-004 — additive proof: existing labels unchanged', () => {
  it('source / quote / synthesize / clarify / reply / branch / flag return exactly what they did', () => {
    // Regression: adding the three new union members must not perturb any
    // existing case (the producer default: return null already tolerated a wider
    // union; these assertions pin the shipped behavior).
    expect(quickActionToPreset('reply', 'thesis')).toBeNull();
    expect(quickActionToPreset('branch', 'claim')).toBeNull();
    expect(quickActionToPreset('flag', 'claim')).toBeNull();
    expect(quickActionToPreset('source', 'claim')?.argumentType).toBe('clarification_request');
    expect(quickActionToPreset('source', 'claim')?.suggestedTagCodes).toContain('source_request');
    expect(quickActionToPreset('quote', 'claim')?.suggestedTagCodes).toContain('quote_request');
    expect(quickActionToPreset('synthesize', 'claim')?.argumentType).toBe('synthesis');
    expect(quickActionToPreset('clarify', 'claim')?.argumentType).toBe('clarification_request');
  });
});
