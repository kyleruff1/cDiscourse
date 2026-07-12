/**
 * A11Y-PR0 (#913) — overlayFocusTrapModel pure tests (full branch).
 */
import {
  FOCUSABLE_SELECTOR,
  FOCUS_TRAP_PASS,
  resolveFocusTrapEffect,
} from '../../src/features/a11y/overlayFocusTrapModel';

describe('A11Y-PR0 — FOCUSABLE_SELECTOR', () => {
  it('is a non-empty selector string covering the standard focusable set', () => {
    expect(typeof FOCUSABLE_SELECTOR).toBe('string');
    expect(FOCUSABLE_SELECTOR.length).toBeGreaterThan(0);
    expect(FOCUSABLE_SELECTOR).toContain('button:not([disabled])');
    expect(FOCUSABLE_SELECTOR).toContain('textarea:not([disabled])');
    expect(FOCUSABLE_SELECTOR).toContain('[tabindex]:not([tabindex="-1"])');
    expect(FOCUSABLE_SELECTOR).toContain('[contenteditable="true"]');
  });
});

describe('A11Y-PR0 — resolveFocusTrapEffect', () => {
  it('Tab at the last focusable wraps to first', () => {
    expect(
      resolveFocusTrapEffect({ key: 'Tab', shiftKey: false, atFirst: false, atLast: true }),
    ).toEqual({ type: 'wrap_to_first' });
  });

  it('Shift+Tab at the first focusable wraps to last', () => {
    expect(
      resolveFocusTrapEffect({ key: 'Tab', shiftKey: true, atFirst: true, atLast: false }),
    ).toEqual({ type: 'wrap_to_last' });
  });

  it('interior Tab (not at last) passes', () => {
    expect(
      resolveFocusTrapEffect({ key: 'Tab', shiftKey: false, atFirst: false, atLast: false }),
    ).toEqual({ type: 'pass' });
  });

  it('interior Shift+Tab (not at first) passes', () => {
    expect(
      resolveFocusTrapEffect({ key: 'Tab', shiftKey: true, atFirst: false, atLast: false }),
    ).toEqual({ type: 'pass' });
  });

  it('Tab at the first focusable (not last) passes (interior forward move)', () => {
    expect(
      resolveFocusTrapEffect({ key: 'Tab', shiftKey: false, atFirst: true, atLast: false }),
    ).toEqual({ type: 'pass' });
  });

  it('Shift+Tab at the last focusable (not first) passes (interior backward move)', () => {
    expect(
      resolveFocusTrapEffect({ key: 'Tab', shiftKey: true, atFirst: false, atLast: true }),
    ).toEqual({ type: 'pass' });
  });

  it('single focusable (atFirst && atLast): Tab wraps to first', () => {
    expect(
      resolveFocusTrapEffect({ key: 'Tab', shiftKey: false, atFirst: true, atLast: true }),
    ).toEqual({ type: 'wrap_to_first' });
  });

  it('single focusable (atFirst && atLast): Shift+Tab wraps to last', () => {
    expect(
      resolveFocusTrapEffect({ key: 'Tab', shiftKey: true, atFirst: true, atLast: true }),
    ).toEqual({ type: 'wrap_to_last' });
  });

  it('a non-Tab key always passes (Escape / Enter / arrows)', () => {
    for (const key of ['Escape', 'Enter', 'ArrowLeft', 'a', ' ']) {
      expect(
        resolveFocusTrapEffect({ key, shiftKey: false, atFirst: true, atLast: true }),
      ).toBe(FOCUS_TRAP_PASS);
    }
  });

  it('FOCUS_TRAP_PASS is frozen (shared allocation)', () => {
    expect(Object.isFrozen(FOCUS_TRAP_PASS)).toBe(true);
    expect(FOCUS_TRAP_PASS).toEqual({ type: 'pass' });
  });
});
