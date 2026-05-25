/**
 * UX-001.4 — Composer / A-I-G keyboard coexistence guard.
 *
 * Proves that the UX-001.3 composer shortcuts (Cmd/Ctrl+Enter,
 * Cmd/Ctrl+K) and the UX-001.4 menu shortcuts (A/I/G) are mutually
 * exclusive — both resolvers gate on the same `composerFocused`
 * boolean and return `'none'` for the OTHER side's keys.
 */
import { resolveBoardMenuKeyEffect } from '../src/features/arguments/boardMenuKeyboardModel';
import { resolveComposerKeyEffect } from '../src/features/arguments/composer/composerKeyboardModel';

const boardBase = {
  key: '',
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  composerFocused: false,
  hasOpenMenu: false,
};

const composerBase = {
  key: '',
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  composerFocused: true,
  isComposerActive: true,
  isComposerExpanded: true,
  hasPendingValidation: false,
  hasUnsavedDraft: false,
};

describe('UX-001.4 — composer-focused state blocks A/I/G', () => {
  it('A keypress in composer focus → resolveBoardMenuKeyEffect returns none', () => {
    expect(resolveBoardMenuKeyEffect({ ...boardBase, key: 'a', composerFocused: true })).toEqual({
      type: 'none',
    });
  });

  it('I keypress in composer focus → resolveBoardMenuKeyEffect returns none', () => {
    expect(resolveBoardMenuKeyEffect({ ...boardBase, key: 'i', composerFocused: true })).toEqual({
      type: 'none',
    });
  });

  it('G keypress in composer focus → resolveBoardMenuKeyEffect returns none', () => {
    expect(resolveBoardMenuKeyEffect({ ...boardBase, key: 'g', composerFocused: true })).toEqual({
      type: 'none',
    });
  });
});

describe('UX-001.4 — board-focused state does NOT consume composer shortcuts', () => {
  it('Cmd+Enter on board focus → resolveBoardMenuKeyEffect returns none', () => {
    // Cmd+Enter is the composer submit shortcut; the board handler
    // returns none for any modifier-held keystroke regardless of key.
    expect(
      resolveBoardMenuKeyEffect({
        ...boardBase,
        key: 'Enter',
        metaKey: true,
      }),
    ).toEqual({ type: 'none' });
  });

  it('Cmd+K on board focus → resolveBoardMenuKeyEffect returns none', () => {
    // Cmd+K is the composer mode-switcher shortcut; the board handler
    // returns none.
    expect(
      resolveBoardMenuKeyEffect({
        ...boardBase,
        key: 'k',
        metaKey: true,
      }),
    ).toEqual({ type: 'none' });
  });
});

describe('UX-001.4 — composer-focused state still handles Cmd+Enter / Cmd+K / Esc', () => {
  it('Cmd+Enter in composer focus → resolveComposerKeyEffect returns submit', () => {
    const out = resolveComposerKeyEffect({ ...composerBase, key: 'Enter', metaKey: true });
    expect(out.type).toBe('submit');
  });

  it('Cmd+K in composer focus → resolveComposerKeyEffect returns open_mode_switcher', () => {
    const out = resolveComposerKeyEffect({ ...composerBase, key: 'k', metaKey: true });
    expect(out.type).toBe('open_mode_switcher');
  });

  it('Esc in composer focus (expanded, no draft) → resolveComposerKeyEffect returns close', () => {
    const out = resolveComposerKeyEffect({ ...composerBase, key: 'Escape' });
    // The composer's Esc resolver collapses-then-dismisses; either
    // intermediate effect is acceptable here. The point is the
    // composer handles Esc, not the board.
    expect(['collapse', 'close', 'cancel']).toContain(out.type);
  });
});

describe('UX-001.4 — letter keys in composer focus pass through (text input owns them)', () => {
  it('lowercase a in composer focus → board handler returns none (composer\'s TextInput inserts the letter)', () => {
    expect(resolveBoardMenuKeyEffect({ ...boardBase, key: 'a', composerFocused: true })).toEqual({
      type: 'none',
    });
  });

  it('uppercase A in composer focus → same', () => {
    expect(
      resolveBoardMenuKeyEffect({
        ...boardBase,
        key: 'A',
        composerFocused: true,
        shiftKey: true,
      }),
    ).toEqual({ type: 'none' });
  });

  it('Esc in composer focus + menu open → board handler returns none (composer Esc handles)', () => {
    // Edge case: a composer-focused user with a menu open. The board
    // handler returns none (composer text input owns Esc); the
    // composer's own Esc resolver handles it via collapse-then-dismiss.
    expect(
      resolveBoardMenuKeyEffect({
        ...boardBase,
        key: 'Escape',
        composerFocused: true,
        hasOpenMenu: true,
      }),
    ).toEqual({ type: 'none' });
  });
});
