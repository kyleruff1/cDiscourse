/**
 * CARD-VIEW-REFINE-001 — Stack-mode keyboard + swipe nav model tests.
 *
 * Covers the pure resolvers that drive the Cards (Stack) surface's
 * chronological Prev / Next navigation:
 *   - resolveStackKeyEffect: ArrowLeft → prev / ArrowRight → next regardless
 *     of selection; Home / End → first / last; bails on composer-focus and
 *     open-menu.
 *   - resolveStackSwipeEffect: swipe left → next, swipe right → prev past the
 *     threshold; below threshold or predominantly-vertical → none.
 *   - shouldClaimStackHorizontalPan: claims only a predominantly-horizontal
 *     drag past the slop (so vertical card-scroll + taps fall through).
 */
import {
  STACK_SWIPE_THRESHOLD_PX,
  resolveStackKeyEffect,
  resolveStackSwipeEffect,
  shouldClaimStackHorizontalPan,
} from '../src/features/arguments/stackKeyboardSwipeModel';

describe('resolveStackKeyEffect — keyboard nav', () => {
  const base = { composerFocused: false, hasOpenMenu: false };

  it('ArrowLeft → prev, ArrowRight → next (regardless of selection)', () => {
    expect(resolveStackKeyEffect({ ...base, key: 'ArrowLeft' })).toBe('prev');
    expect(resolveStackKeyEffect({ ...base, key: 'ArrowRight' })).toBe('next');
  });

  it('Home → first, End → last', () => {
    expect(resolveStackKeyEffect({ ...base, key: 'Home' })).toBe('first');
    expect(resolveStackKeyEffect({ ...base, key: 'End' })).toBe('last');
  });

  it('any other key → none', () => {
    for (const key of ['ArrowUp', 'ArrowDown', 'a', 'Enter', 'Escape', ' ', 'Tab']) {
      expect(resolveStackKeyEffect({ ...base, key })).toBe('none');
    }
  });

  it('BAILS (→ none) when the composer is focused, even for an arrow key', () => {
    expect(
      resolveStackKeyEffect({ key: 'ArrowLeft', composerFocused: true, hasOpenMenu: false }),
    ).toBe('none');
    expect(
      resolveStackKeyEffect({ key: 'ArrowRight', composerFocused: true, hasOpenMenu: false }),
    ).toBe('none');
  });

  it('BAILS (→ none) when a board menu/overlay is open', () => {
    expect(
      resolveStackKeyEffect({ key: 'ArrowLeft', composerFocused: false, hasOpenMenu: true }),
    ).toBe('none');
    expect(
      resolveStackKeyEffect({ key: 'End', composerFocused: false, hasOpenMenu: true }),
    ).toBe('none');
  });

  it('returns none for a degenerate input', () => {
    // @ts-expect-error — intentionally malformed
    expect(resolveStackKeyEffect(null)).toBe('none');
    // @ts-expect-error — intentionally malformed
    expect(resolveStackKeyEffect({ composerFocused: false, hasOpenMenu: false })).toBe('none');
  });
});

describe('resolveStackSwipeEffect — swipe nav', () => {
  it('swipe LEFT past the threshold → next (newer move)', () => {
    expect(resolveStackSwipeEffect({ dx: -(STACK_SWIPE_THRESHOLD_PX + 1), dy: 0 })).toBe('next');
  });

  it('swipe RIGHT past the threshold → prev (older move)', () => {
    expect(resolveStackSwipeEffect({ dx: STACK_SWIPE_THRESHOLD_PX + 1, dy: 0 })).toBe('prev');
  });

  it('below the threshold → none (a tap or tiny drag stays a tap)', () => {
    expect(resolveStackSwipeEffect({ dx: -(STACK_SWIPE_THRESHOLD_PX - 1), dy: 0 })).toBe('none');
    expect(resolveStackSwipeEffect({ dx: STACK_SWIPE_THRESHOLD_PX - 1, dy: 0 })).toBe('none');
    expect(resolveStackSwipeEffect({ dx: 0, dy: 0 })).toBe('none');
  });

  it('a predominantly-VERTICAL drag → none (card scroll wins)', () => {
    // Large horizontal travel but even larger vertical → not a swipe.
    expect(resolveStackSwipeEffect({ dx: -100, dy: 120 })).toBe('none');
    expect(resolveStackSwipeEffect({ dx: 100, dy: 120 })).toBe('none');
  });

  it('honors a threshold override', () => {
    expect(resolveStackSwipeEffect({ dx: -30, dy: 0, thresholdPx: 20 })).toBe('next');
    expect(resolveStackSwipeEffect({ dx: -30, dy: 0, thresholdPx: 60 })).toBe('none');
  });

  it('returns none for non-finite / malformed input', () => {
    expect(resolveStackSwipeEffect({ dx: NaN, dy: 0 })).toBe('none');
    expect(resolveStackSwipeEffect({ dx: 0, dy: Infinity })).toBe('none');
    // @ts-expect-error — intentionally malformed
    expect(resolveStackSwipeEffect(null)).toBe('none');
  });
});

describe('shouldClaimStackHorizontalPan — responder claim predicate', () => {
  it('claims a predominantly-horizontal drag past the slop', () => {
    expect(shouldClaimStackHorizontalPan(20, 4)).toBe(true);
    expect(shouldClaimStackHorizontalPan(-20, 4)).toBe(true);
  });

  it('does NOT claim a predominantly-vertical drag (card scroll)', () => {
    expect(shouldClaimStackHorizontalPan(10, 30)).toBe(false);
  });

  it('does NOT claim a tiny jitter inside the slop (tap)', () => {
    expect(shouldClaimStackHorizontalPan(4, 1)).toBe(false);
  });

  it('returns false for malformed input', () => {
    expect(shouldClaimStackHorizontalPan(NaN, 0)).toBe(false);
    // @ts-expect-error — intentionally malformed
    expect(shouldClaimStackHorizontalPan('x', 0)).toBe(false);
  });
});
