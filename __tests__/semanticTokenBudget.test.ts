/**
 * MCP-012 — Semantic call router: token-budget tests.
 *
 * Asserts the estimator over-counts (fails safe), the inclusive ceiling, the
 * over-budget verdict, and that the budget functions return data only — there
 * is no post path here to block.
 */

import {
  estimatePacketTokens,
  isWithinBudget,
  SEMANTIC_PACKET_TOKEN_BUDGET,
  OUTPUT_TOKEN_RESERVE,
  CHARS_PER_TOKEN,
  PER_CLASSIFIER_ID_CHARS,
} from '../src/features/semanticReferee/tokenBudget';
import type { TokenBudgetPayload } from '../src/features/semanticReferee/tokenBudget';

describe('MCP-012 token-budget constants', () => {
  it('SEMANTIC_PACKET_TOKEN_BUDGET is 1500', () => {
    expect(SEMANTIC_PACKET_TOKEN_BUDGET).toBe(1500);
  });

  it('OUTPUT_TOKEN_RESERVE is 450', () => {
    expect(OUTPUT_TOKEN_RESERVE).toBe(450);
  });

  it('CHARS_PER_TOKEN is 3.5 — deliberately pessimistic vs ~4 real English', () => {
    expect(CHARS_PER_TOKEN).toBe(3.5);
    expect(CHARS_PER_TOKEN).toBeLessThan(4);
  });
});

describe('MCP-012 estimatePacketTokens', () => {
  it('returns OUTPUT_TOKEN_RESERVE plus classifier overhead for an empty move body', () => {
    const payload: TokenBudgetPayload = {
      moveBodyRedacted: '',
      requestedClassifiers: [],
    };
    expect(estimatePacketTokens(payload)).toBe(OUTPUT_TOKEN_RESERVE);
  });

  it('counts the parent body and extra context chars', () => {
    const withoutParent: TokenBudgetPayload = {
      moveBodyRedacted: 'a'.repeat(100),
      requestedClassifiers: [],
    };
    const withParent: TokenBudgetPayload = {
      moveBodyRedacted: 'a'.repeat(100),
      parentBodyRedacted: 'b'.repeat(100),
      extraContextChars: 70,
      requestedClassifiers: [],
    };
    expect(estimatePacketTokens(withParent)).toBeGreaterThan(
      estimatePacketTokens(withoutParent),
    );
  });

  it('adds a per-classifier-id overhead', () => {
    const noClassifiers: TokenBudgetPayload = {
      moveBodyRedacted: 'x'.repeat(50),
      requestedClassifiers: [],
    };
    const fiveClassifiers: TokenBudgetPayload = {
      moveBodyRedacted: 'x'.repeat(50),
      requestedClassifiers: ['a', 'b', 'c', 'd', 'e'],
    };
    const delta = estimatePacketTokens(fiveClassifiers) - estimatePacketTokens(noClassifiers);
    // Five ids add 5 * PER_CLASSIFIER_ID_CHARS chars → ceil(160 / 3.5) extra
    // tokens vs the no-classifier baseline within the same body length bucket.
    const expectedExtraChars = 5 * PER_CLASSIFIER_ID_CHARS;
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThanOrEqual(Math.ceil(expectedExtraChars / CHARS_PER_TOKEN) + 1);
  });

  it('over-estimates vs a chars/4-based lower bound', () => {
    const body = 'The quick brown fox jumps over the lazy dog. '.repeat(20);
    const payload: TokenBudgetPayload = {
      moveBodyRedacted: body,
      requestedClassifiers: [],
    };
    const estimate = estimatePacketTokens(payload);
    // A chars/4 estimate (real English) is a LOWER bound — the conservative
    // 3.5-divisor estimator must exceed it.
    const charsOver4LowerBound = Math.ceil(body.length / 4);
    expect(estimate).toBeGreaterThan(charsOver4LowerBound);
  });
});

describe('MCP-012 isWithinBudget', () => {
  it('returns ok: true for a small payload', () => {
    const verdict = isWithinBudget({
      moveBodyRedacted: 'a short claim',
      requestedClassifiers: ['responds_to_parent'],
    });
    expect(verdict.ok).toBe(true);
    expect(verdict.ceiling).toBe(SEMANTIC_PACKET_TOKEN_BUDGET);
    expect(verdict.estimated).toBeGreaterThan(0);
  });

  it('returns ok: true at exactly the ceiling (inclusive boundary)', () => {
    // Construct a body whose estimate lands exactly on the ceiling.
    // estimated = ceil(inputChars / 3.5) + 450 === 1500
    //   → ceil(inputChars / 3.5) === 1050
    //   → inputChars === 1050 * 3.5 === 3675 (exact multiple).
    const body = 'x'.repeat(3675);
    const verdict = isWithinBudget({
      moveBodyRedacted: body,
      requestedClassifiers: [],
    });
    expect(verdict.estimated).toBe(SEMANTIC_PACKET_TOKEN_BUDGET);
    expect(verdict.ok).toBe(true);
  });

  it('returns ok: false above the ceiling', () => {
    const body = 'x'.repeat(20000);
    const verdict = isWithinBudget({
      moveBodyRedacted: body,
      requestedClassifiers: ['a', 'b', 'c', 'd', 'e'],
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.estimated).toBeGreaterThan(SEMANTIC_PACKET_TOKEN_BUDGET);
    expect(verdict.ceiling).toBe(SEMANTIC_PACKET_TOKEN_BUDGET);
  });

  it('reports estimated and ceiling in the verdict', () => {
    const verdict = isWithinBudget({
      moveBodyRedacted: 'a claim',
      requestedClassifiers: [],
    });
    expect(verdict).toEqual({
      ok: true,
      estimated: estimatePacketTokens({
        moveBodyRedacted: 'a claim',
        requestedClassifiers: [],
      }),
      ceiling: SEMANTIC_PACKET_TOKEN_BUDGET,
    });
  });

  it('an over-budget verdict carries no post-blocking field — it is data only', () => {
    // Doctrine: the budget functions return DATA only. There is no post path
    // in this module to block; an over-budget payload only tells the caller
    // to fall back to layer 1. The verdict shape has exactly three fields.
    const verdict = isWithinBudget({
      moveBodyRedacted: 'x'.repeat(50000),
      requestedClassifiers: [],
    });
    expect(verdict.ok).toBe(false);
    expect(Object.keys(verdict).sort()).toEqual(['ceiling', 'estimated', 'ok']);
  });
});
