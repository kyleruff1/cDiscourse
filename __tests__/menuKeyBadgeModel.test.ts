/**
 * UX-001.4 — menuKeyBadgeModel coverage.
 *
 * Pure-TS test suite for `deriveMenuKeyBadgeContext` and
 * `resolveKeyBadgeVisibility`. Verifies browser-only badge rendering
 * (web AND wide enough), the absence of badges on phone / tablet
 * portrait / native, and the SSR-safe non-finite-input fallback.
 */
import {
  deriveMenuKeyBadgeContext,
  resolveKeyBadgeVisibility,
  BROWSER_KEYBOARD_WIDTH_THRESHOLD,
  type MenuKeyBadgeContext,
} from '../src/features/arguments/oneBox/menuKeyBadgeModel';

describe('deriveMenuKeyBadgeContext — native platforms', () => {
  const native = ['ios', 'android', 'macos', 'windows'] as const;

  for (const platformOs of native) {
    it(`returns touch for ${platformOs} (any width)`, () => {
      expect(deriveMenuKeyBadgeContext({ platformOs, windowWidth: 1920 })).toBe('touch');
    });

    it(`returns touch for ${platformOs} at phone width`, () => {
      expect(deriveMenuKeyBadgeContext({ platformOs, windowWidth: 390 })).toBe('touch');
    });
  }
});

describe('deriveMenuKeyBadgeContext — web platform', () => {
  it('returns touch for web at phone width (< 1024)', () => {
    expect(deriveMenuKeyBadgeContext({ platformOs: 'web', windowWidth: 390 })).toBe('touch');
  });

  it('returns touch for web at small tablet width (768)', () => {
    expect(deriveMenuKeyBadgeContext({ platformOs: 'web', windowWidth: 768 })).toBe('touch');
  });

  it('returns touch for web just below threshold (1023)', () => {
    expect(deriveMenuKeyBadgeContext({ platformOs: 'web', windowWidth: 1023 })).toBe('touch');
  });

  it('returns browser_keyboard for web at exactly the threshold (1024)', () => {
    expect(deriveMenuKeyBadgeContext({ platformOs: 'web', windowWidth: 1024 })).toBe(
      'browser_keyboard',
    );
  });

  it('returns browser_keyboard for web at 1366 (laptop)', () => {
    expect(deriveMenuKeyBadgeContext({ platformOs: 'web', windowWidth: 1366 })).toBe(
      'browser_keyboard',
    );
  });

  it('returns browser_keyboard for web at 1920 (wide desktop)', () => {
    expect(deriveMenuKeyBadgeContext({ platformOs: 'web', windowWidth: 1920 })).toBe(
      'browser_keyboard',
    );
  });
});

describe('deriveMenuKeyBadgeContext — SSR / unknown', () => {
  it('returns unknown for zero windowWidth', () => {
    expect(deriveMenuKeyBadgeContext({ platformOs: 'web', windowWidth: 0 })).toBe('unknown');
  });

  it('returns unknown for negative windowWidth', () => {
    expect(deriveMenuKeyBadgeContext({ platformOs: 'web', windowWidth: -1 })).toBe('unknown');
  });

  it('returns unknown for NaN windowWidth', () => {
    expect(deriveMenuKeyBadgeContext({ platformOs: 'web', windowWidth: Number.NaN })).toBe(
      'unknown',
    );
  });
});

describe('resolveKeyBadgeVisibility', () => {
  it('returns true for browser_keyboard context', () => {
    expect(
      resolveKeyBadgeVisibility({ context: 'browser_keyboard', reduceMotion: false }),
    ).toBe(true);
  });

  it('returns true for browser_keyboard context with reduceMotion (badge has no animation)', () => {
    expect(resolveKeyBadgeVisibility({ context: 'browser_keyboard', reduceMotion: true })).toBe(
      true,
    );
  });

  it('returns false for touch context', () => {
    expect(resolveKeyBadgeVisibility({ context: 'touch', reduceMotion: false })).toBe(false);
  });

  it('returns false for unknown context (SSR / first paint fallback)', () => {
    expect(resolveKeyBadgeVisibility({ context: 'unknown', reduceMotion: false })).toBe(false);
  });

  it('every MenuKeyBadgeContext value resolves to a boolean', () => {
    const all: MenuKeyBadgeContext[] = ['browser_keyboard', 'touch', 'unknown'];
    for (const context of all) {
      const v = resolveKeyBadgeVisibility({ context, reduceMotion: false });
      expect(typeof v).toBe('boolean');
    }
  });
});

describe('BROWSER_KEYBOARD_WIDTH_THRESHOLD', () => {
  it('is exported as 1024 (matches iPad Pro horizontal)', () => {
    expect(BROWSER_KEYBOARD_WIDTH_THRESHOLD).toBe(1024);
  });
});
