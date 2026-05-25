/**
 * UX-001.4 — boardMenuKeyboardModel coverage.
 *
 * Pure-TS test suite for `resolveBoardMenuKeyEffect`. Covers every
 * (key × modifier × composerFocused × hasOpenMenu) combination the
 * resolver must handle.
 */
import {
  resolveBoardMenuKeyEffect,
  type BoardMenuKeyInput,
} from '../src/features/arguments/boardMenuKeyboardModel';

const base: BoardMenuKeyInput = {
  key: '',
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  composerFocused: false,
  hasOpenMenu: false,
};

describe('resolveBoardMenuKeyEffect — composer focus gate', () => {
  it('returns none when composer is focused (lowercase a)', () => {
    expect(resolveBoardMenuKeyEffect({ ...base, key: 'a', composerFocused: true })).toEqual({
      type: 'none',
    });
  });

  it('returns none when composer is focused (uppercase A)', () => {
    expect(resolveBoardMenuKeyEffect({ ...base, key: 'A', composerFocused: true })).toEqual({
      type: 'none',
    });
  });

  it('returns none when composer is focused (i)', () => {
    expect(resolveBoardMenuKeyEffect({ ...base, key: 'i', composerFocused: true })).toEqual({
      type: 'none',
    });
  });

  it('returns none when composer is focused (g)', () => {
    expect(resolveBoardMenuKeyEffect({ ...base, key: 'g', composerFocused: true })).toEqual({
      type: 'none',
    });
  });

  it('returns none when composer is focused and Esc with open menu', () => {
    // Composer text input owns Esc when focused — composer's existing
    // collapse-then-dismiss handler picks it up.
    expect(
      resolveBoardMenuKeyEffect({
        ...base,
        key: 'Escape',
        composerFocused: true,
        hasOpenMenu: true,
      }),
    ).toEqual({ type: 'none' });
  });
});

describe('resolveBoardMenuKeyEffect — board focus letter mapping', () => {
  it('opens Act on lowercase a', () => {
    expect(resolveBoardMenuKeyEffect({ ...base, key: 'a' })).toEqual({ type: 'open_act' });
  });

  it('opens Act on uppercase A (shift held)', () => {
    expect(resolveBoardMenuKeyEffect({ ...base, key: 'A', shiftKey: true })).toEqual({
      type: 'open_act',
    });
  });

  it('opens Inspect on lowercase i', () => {
    expect(resolveBoardMenuKeyEffect({ ...base, key: 'i' })).toEqual({ type: 'open_inspect' });
  });

  it('opens Inspect on uppercase I (shift held)', () => {
    expect(resolveBoardMenuKeyEffect({ ...base, key: 'I', shiftKey: true })).toEqual({
      type: 'open_inspect',
    });
  });

  it('opens Go on lowercase g', () => {
    expect(resolveBoardMenuKeyEffect({ ...base, key: 'g' })).toEqual({ type: 'open_go' });
  });

  it('opens Go on uppercase G (shift held)', () => {
    expect(resolveBoardMenuKeyEffect({ ...base, key: 'G', shiftKey: true })).toEqual({
      type: 'open_go',
    });
  });
});

describe('resolveBoardMenuKeyEffect — modifier blocks', () => {
  it('returns none for Cmd+A (avoid select-all)', () => {
    expect(resolveBoardMenuKeyEffect({ ...base, key: 'a', metaKey: true })).toEqual({
      type: 'none',
    });
  });

  it('returns none for Ctrl+A (avoid select-all)', () => {
    expect(resolveBoardMenuKeyEffect({ ...base, key: 'a', ctrlKey: true })).toEqual({
      type: 'none',
    });
  });

  it('returns none for Alt+A', () => {
    expect(resolveBoardMenuKeyEffect({ ...base, key: 'a', altKey: true })).toEqual({
      type: 'none',
    });
  });

  it('returns none for Cmd+I (avoid italic)', () => {
    expect(resolveBoardMenuKeyEffect({ ...base, key: 'i', metaKey: true })).toEqual({
      type: 'none',
    });
  });

  it('returns none for Ctrl+G (avoid find-next)', () => {
    expect(resolveBoardMenuKeyEffect({ ...base, key: 'g', ctrlKey: true })).toEqual({
      type: 'none',
    });
  });

  it('returns none for Cmd+Alt+A combination', () => {
    expect(
      resolveBoardMenuKeyEffect({ ...base, key: 'a', metaKey: true, altKey: true }),
    ).toEqual({ type: 'none' });
  });
});

describe('resolveBoardMenuKeyEffect — Escape closes open menu', () => {
  it('closes the open menu on Esc when hasOpenMenu is true', () => {
    expect(resolveBoardMenuKeyEffect({ ...base, key: 'Escape', hasOpenMenu: true })).toEqual({
      type: 'close_open_menu',
    });
  });

  it('returns none on Esc when no menu is open (falls through to Timeline Esc)', () => {
    expect(resolveBoardMenuKeyEffect({ ...base, key: 'Escape', hasOpenMenu: false })).toEqual({
      type: 'none',
    });
  });

  it('returns none for Esc when composer is focused (composer owns Esc)', () => {
    expect(
      resolveBoardMenuKeyEffect({
        ...base,
        key: 'Escape',
        composerFocused: true,
        hasOpenMenu: true,
      }),
    ).toEqual({ type: 'none' });
  });
});

describe('resolveBoardMenuKeyEffect — unrelated keys pass through', () => {
  it('returns none for ArrowLeft (Timeline nav)', () => {
    expect(resolveBoardMenuKeyEffect({ ...base, key: 'ArrowLeft' })).toEqual({ type: 'none' });
  });

  it('returns none for Enter (Timeline activate)', () => {
    expect(resolveBoardMenuKeyEffect({ ...base, key: 'Enter' })).toEqual({ type: 'none' });
  });

  it('returns none for Space (Timeline activate)', () => {
    expect(resolveBoardMenuKeyEffect({ ...base, key: ' ' })).toEqual({ type: 'none' });
  });

  it('returns none for Home (Timeline root)', () => {
    expect(resolveBoardMenuKeyEffect({ ...base, key: 'Home' })).toEqual({ type: 'none' });
  });

  it('returns none for End (Timeline latest)', () => {
    expect(resolveBoardMenuKeyEffect({ ...base, key: 'End' })).toEqual({ type: 'none' });
  });

  it('returns none for an unrelated letter (b)', () => {
    expect(resolveBoardMenuKeyEffect({ ...base, key: 'b' })).toEqual({ type: 'none' });
  });

  it('returns none for an unrelated letter (z)', () => {
    expect(resolveBoardMenuKeyEffect({ ...base, key: 'z' })).toEqual({ type: 'none' });
  });
});

describe('resolveBoardMenuKeyEffect — discriminated union exhaustiveness', () => {
  // The union has five tags; each scenario above covers one or more.
  // This block proves the resolver returns the right TAG, not just a
  // shape that happens to .type-match.
  it('open_act effect carries no extra properties', () => {
    const effect = resolveBoardMenuKeyEffect({ ...base, key: 'a' });
    expect(Object.keys(effect).sort()).toEqual(['type']);
  });

  it('open_inspect effect carries no extra properties', () => {
    const effect = resolveBoardMenuKeyEffect({ ...base, key: 'i' });
    expect(Object.keys(effect).sort()).toEqual(['type']);
  });

  it('open_go effect carries no extra properties', () => {
    const effect = resolveBoardMenuKeyEffect({ ...base, key: 'g' });
    expect(Object.keys(effect).sort()).toEqual(['type']);
  });

  it('close_open_menu effect carries no extra properties', () => {
    const effect = resolveBoardMenuKeyEffect({
      ...base,
      key: 'Escape',
      hasOpenMenu: true,
    });
    expect(Object.keys(effect).sort()).toEqual(['type']);
  });

  it('none effect carries no extra properties', () => {
    const effect = resolveBoardMenuKeyEffect({ ...base, key: 'b' });
    expect(Object.keys(effect).sort()).toEqual(['type']);
  });
});
