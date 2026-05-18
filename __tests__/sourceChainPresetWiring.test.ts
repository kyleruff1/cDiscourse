/**
 * EV-002 — quickActionPresets wiring tests.
 *
 * Asserts that the four EV-002 preset paths (`source`, `quote`,
 * `weak_source`, `inspect_receipt`) plus the existing presets all return
 * the right shape. No React.
 */
import { quickActionToPreset } from '../src/features/arguments/quickActionPresets';
import {
  ASK_QUOTE_PRESET_BODY,
  ASK_SOURCE_PRESET_BODY,
  ASK_STRONGER_SOURCE_PRESET_BODY,
} from '../src/features/evidence/sourceChainPresetCopy';

describe('EV-002 quickActionPresets — source / quote / weak_source / inspect_receipt', () => {
  it('source returns clarification_request + source_request tag + seeded body', () => {
    const p = quickActionToPreset('source', null);
    expect(p).not.toBeNull();
    expect(p!.argumentType).toBe('clarification_request');
    expect(p!.suggestedTagCodes).toContain('source_request');
    expect(p!.body).toBe(ASK_SOURCE_PRESET_BODY);
  });

  it('quote returns clarification_request + quote_request tag + seeded body', () => {
    const p = quickActionToPreset('quote', null);
    expect(p).not.toBeNull();
    expect(p!.argumentType).toBe('clarification_request');
    expect(p!.suggestedTagCodes).toContain('quote_request');
    expect(p!.body).toBe(ASK_QUOTE_PRESET_BODY);
  });

  it('weak_source returns clarification_request + source_chain_weak tag + seeded body', () => {
    const p = quickActionToPreset('weak_source', null);
    expect(p).not.toBeNull();
    expect(p!.argumentType).toBe('clarification_request');
    expect(p!.suggestedTagCodes).toContain('source_request');
    expect(p!.suggestedTagCodes).toContain('source_chain_weak');
    expect(p!.body).toBe(ASK_STRONGER_SOURCE_PRESET_BODY);
  });

  it('inspect_receipt returns null (read-only popover affordance)', () => {
    expect(quickActionToPreset('inspect_receipt', null)).toBeNull();
  });

  it('existing reply / challenge / clarify behavior is unchanged (no body field)', () => {
    expect(quickActionToPreset('reply', null)).toBeNull();
    const c = quickActionToPreset('challenge', 'thesis');
    expect(c?.argumentType).toBe('rebuttal');
    expect(c?.body).toBeUndefined();
    expect(quickActionToPreset('challenge', 'rebuttal')?.argumentType).toBe('counter_rebuttal');
    const clarify = quickActionToPreset('clarify', 'claim');
    expect(clarify?.argumentType).toBe('clarification_request');
    expect(clarify?.body).toBeUndefined();
  });

  it('existing branch + flag still return null (no destructive defaults)', () => {
    expect(quickActionToPreset('branch', 'claim')).toBeNull();
    expect(quickActionToPreset('flag', 'claim')).toBeNull();
  });
});
