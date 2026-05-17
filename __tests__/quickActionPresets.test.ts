/**
 * Stage 6.2 — Milestone 7: quick-action → composer preset tests.
 */
import { quickActionToPreset } from '../src/features/arguments/quickActionPresets';

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
