/**
 * UX-001.3 — composerHaptics no-op shim tests.
 *
 * Verifies:
 *  - The shim is a no-op (every call returns void, never throws).
 *  - The full API surface exists (kind vocabulary, triggerHaptic, hasHapticSupport).
 *  - hasHapticSupport returns false in v1.
 *  - No verdict tokens in any exported string.
 *  - The shim does NOT pull in expo-haptics or any other unexpected dep.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  ALL_COMPOSER_HAPTIC_KINDS,
  hasHapticSupport,
  triggerHaptic,
} from '../src/features/arguments/composer/composerHaptics';
import type { ComposerHapticKind } from '../src/features/arguments/composer/composerHaptics';

describe('composerHaptics — kind vocabulary', () => {
  it('exposes exactly four kinds', () => {
    expect(ALL_COMPOSER_HAPTIC_KINDS).toEqual([
      'light',
      'medium',
      'success',
      'error',
    ]);
  });

  it('the kind array is frozen', () => {
    expect(Object.isFrozen(ALL_COMPOSER_HAPTIC_KINDS)).toBe(true);
  });
});

describe('composerHaptics — triggerHaptic no-op', () => {
  for (const kind of [
    'light',
    'medium',
    'success',
    'error',
  ] as ComposerHapticKind[]) {
    it(`triggerHaptic('${kind}') returns undefined and never throws`, () => {
      expect(() => triggerHaptic(kind)).not.toThrow();
      expect(triggerHaptic(kind)).toBeUndefined();
    });
  }

  it('triggerHaptic is idempotent', () => {
    for (let i = 0; i < 10; i++) {
      expect(() => triggerHaptic('light')).not.toThrow();
    }
  });
});

describe('composerHaptics — hasHapticSupport in v1', () => {
  it('returns false in v1 (no-op shim)', () => {
    expect(hasHapticSupport()).toBe(false);
  });
});

describe('composerHaptics — dependency policy', () => {
  it('source does NOT import expo-haptics or any haptic library', () => {
    const source = fs.readFileSync(
      path.resolve(
        __dirname,
        '..',
        'src',
        'features',
        'arguments',
        'composer',
        'composerHaptics.ts',
      ),
      'utf-8',
    );
    // We intentionally only scan import statements — the file header
    // comment is allowed to mention `expo-haptics` by name when
    // explaining the deferral rationale.
    const importLines = source
      .split('\n')
      .filter((l) => l.trim().startsWith('import '));
    for (const line of importLines) {
      expect(line).not.toMatch(/expo-haptics/);
      expect(line).not.toMatch(/Haptics/);
    }
    // Also assert there is no `require('expo-haptics')` anywhere
    // (the no-op shim must not pull the dep at runtime).
    expect(source).not.toMatch(/require\(['"]expo-haptics['"]\)/);
  });
});

describe('composerHaptics — doctrine', () => {
  it('no verdict tokens in the kind vocabulary', () => {
    const banned = [
      'winner',
      'loser',
      'liar',
      'correct',
      'truth',
      'true',
      'false',
      'verdict',
    ];
    for (const kind of ALL_COMPOSER_HAPTIC_KINDS) {
      for (const b of banned) {
        expect(kind.toLowerCase()).not.toContain(b);
      }
    }
  });
});
