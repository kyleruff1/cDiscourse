/**
 * UX-001.3 — composerKeyboardModel pure-model tests.
 *
 * Covers the keyboard shortcut routing contract:
 *  - composerFocused=false → 'none' for every key
 *  - Cmd+Enter / Ctrl+Enter → 'submit'
 *  - Cmd+K / Ctrl+K (uppercase + lowercase) → 'open_mode_switcher'
 *  - Esc → 'close'
 *  - Tab / Shift+Tab → 'none' (DOM-native)
 *  - Plain Enter (no modifier) → 'none' (otherwise typing Enter would
 *    submit a multi-line draft mid-paragraph)
 *  - isComposerShortcut classifier
 */
import {
  ALL_COMPOSER_KEY_EFFECT_TYPES,
  isComposerShortcut,
  resolveComposerKeyEffect,
} from '../src/features/arguments/composer/composerKeyboardModel';
import type { ComposerKeyInput } from '../src/features/arguments/composer/composerKeyboardModel';

function input(partial: Partial<ComposerKeyInput>): ComposerKeyInput {
  return {
    key: partial.key ?? '',
    metaKey: partial.metaKey ?? false,
    ctrlKey: partial.ctrlKey ?? false,
    shiftKey: partial.shiftKey ?? false,
    composerFocused: partial.composerFocused ?? true,
  };
}

describe('composerKeyboardModel — effect type vocabulary', () => {
  it('has exactly four effect types', () => {
    expect(ALL_COMPOSER_KEY_EFFECT_TYPES).toEqual([
      'none',
      'submit',
      'open_mode_switcher',
      'close',
    ]);
  });

  it('ALL_COMPOSER_KEY_EFFECT_TYPES is frozen', () => {
    expect(Object.isFrozen(ALL_COMPOSER_KEY_EFFECT_TYPES)).toBe(true);
  });
});

describe('composerKeyboardModel — focus-context gate', () => {
  it('returns none for Cmd+Enter when composer not focused', () => {
    const effect = resolveComposerKeyEffect(
      input({ key: 'Enter', metaKey: true, composerFocused: false }),
    );
    expect(effect.type).toBe('none');
  });

  it('returns none for Cmd+K when composer not focused', () => {
    const effect = resolveComposerKeyEffect(
      input({ key: 'k', metaKey: true, composerFocused: false }),
    );
    expect(effect.type).toBe('none');
  });

  it('returns none for Escape when composer not focused', () => {
    const effect = resolveComposerKeyEffect(
      input({ key: 'Escape', composerFocused: false }),
    );
    expect(effect.type).toBe('none');
  });

  it('returns none for Tab when composer not focused', () => {
    const effect = resolveComposerKeyEffect(
      input({ key: 'Tab', composerFocused: false }),
    );
    expect(effect.type).toBe('none');
  });
});

describe('composerKeyboardModel — submit', () => {
  it('Cmd+Enter (macOS) submits', () => {
    const effect = resolveComposerKeyEffect(
      input({ key: 'Enter', metaKey: true }),
    );
    expect(effect.type).toBe('submit');
  });

  it('Ctrl+Enter (Windows/Linux) submits', () => {
    const effect = resolveComposerKeyEffect(
      input({ key: 'Enter', ctrlKey: true }),
    );
    expect(effect.type).toBe('submit');
  });

  it('plain Enter (no modifier) does NOT submit', () => {
    const effect = resolveComposerKeyEffect(input({ key: 'Enter' }));
    expect(effect.type).toBe('none');
  });

  it('Shift+Enter does NOT submit (multi-line line break)', () => {
    const effect = resolveComposerKeyEffect(
      input({ key: 'Enter', shiftKey: true }),
    );
    expect(effect.type).toBe('none');
  });
});

describe('composerKeyboardModel — mode switcher', () => {
  it('Cmd+K opens the mode switcher', () => {
    const effect = resolveComposerKeyEffect(
      input({ key: 'k', metaKey: true }),
    );
    expect(effect.type).toBe('open_mode_switcher');
  });

  it('Ctrl+K opens the mode switcher', () => {
    const effect = resolveComposerKeyEffect(
      input({ key: 'k', ctrlKey: true }),
    );
    expect(effect.type).toBe('open_mode_switcher');
  });

  it('Cmd+Shift+K (uppercase K) also opens the mode switcher', () => {
    const effect = resolveComposerKeyEffect(
      input({ key: 'K', metaKey: true, shiftKey: true }),
    );
    expect(effect.type).toBe('open_mode_switcher');
  });

  it('plain K does NOT open the mode switcher (typing K in a field)', () => {
    const effect = resolveComposerKeyEffect(input({ key: 'k' }));
    expect(effect.type).toBe('none');
  });
});

describe('composerKeyboardModel — close', () => {
  it('Escape returns close', () => {
    const effect = resolveComposerKeyEffect(input({ key: 'Escape' }));
    expect(effect.type).toBe('close');
  });

  it('Escape with Cmd modifier still returns close', () => {
    const effect = resolveComposerKeyEffect(
      input({ key: 'Escape', metaKey: true }),
    );
    expect(effect.type).toBe('close');
  });
});

describe('composerKeyboardModel — Tab navigation', () => {
  it('Tab returns none (DOM-native handles field nav)', () => {
    const effect = resolveComposerKeyEffect(input({ key: 'Tab' }));
    expect(effect.type).toBe('none');
  });

  it('Shift+Tab returns none', () => {
    const effect = resolveComposerKeyEffect(
      input({ key: 'Tab', shiftKey: true }),
    );
    expect(effect.type).toBe('none');
  });
});

describe('composerKeyboardModel — unknown keys', () => {
  it('a plain letter returns none', () => {
    const effect = resolveComposerKeyEffect(input({ key: 'a' }));
    expect(effect.type).toBe('none');
  });

  it('arrow keys return none (Timeline owns arrow navigation)', () => {
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
      const effect = resolveComposerKeyEffect(input({ key }));
      expect(effect.type).toBe('none');
    }
  });

  it('Home / End return none (DOM-native field navigation)', () => {
    for (const key of ['Home', 'End']) {
      const effect = resolveComposerKeyEffect(input({ key }));
      expect(effect.type).toBe('none');
    }
  });
});

describe('composerKeyboardModel — isComposerShortcut classifier', () => {
  it('returns true for Cmd+Enter regardless of focus state', () => {
    expect(
      isComposerShortcut(input({ key: 'Enter', metaKey: true })),
    ).toBe(true);
    expect(
      isComposerShortcut(
        input({ key: 'Enter', metaKey: true, composerFocused: false }),
      ),
    ).toBe(true);
  });

  it('returns true for Cmd+K, Ctrl+K, Esc', () => {
    expect(isComposerShortcut(input({ key: 'k', metaKey: true }))).toBe(true);
    expect(isComposerShortcut(input({ key: 'k', ctrlKey: true }))).toBe(true);
    expect(isComposerShortcut(input({ key: 'Escape' }))).toBe(true);
  });

  it('returns false for Tab, arrow keys, plain letters', () => {
    expect(isComposerShortcut(input({ key: 'Tab' }))).toBe(false);
    expect(isComposerShortcut(input({ key: 'ArrowDown' }))).toBe(false);
    expect(isComposerShortcut(input({ key: 'a' }))).toBe(false);
  });
});

describe('composerKeyboardModel — doctrine', () => {
  it('no verdict token in any effect type label', () => {
    const banned = ['winner', 'loser', 'liar', 'correct', 'true', 'false'];
    for (const effectType of ALL_COMPOSER_KEY_EFFECT_TYPES) {
      for (const b of banned) {
        expect(effectType.toLowerCase()).not.toContain(b);
      }
    }
  });
});
