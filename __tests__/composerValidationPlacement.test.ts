/**
 * UX-001.3 — composer validation placement (Q6) source-scan tests.
 *
 * The brief's validation contract requires:
 *  - No full-screen modals.
 *  - No banner notifications above the composer.
 *  - No toast notifications outside the composer surface.
 *  - No verdict copy ("this argument is wrong", "this evidence is invalid").
 *
 * v1 of UX-001.3 keeps the existing ComposerValidationPanel placement
 * (immediately above the Post button inside ArgumentComposer's scroll)
 * and asserts no new banner / modal / toast import was added to the
 * composer subtree.
 */
import fs from 'fs';
import path from 'path';

const COMPOSER_DIR = path.join(process.cwd(), 'src', 'features', 'arguments');
const COMPOSER_SRC = fs.readFileSync(
  path.join(COMPOSER_DIR, 'ArgumentComposer.tsx'),
  'utf8',
);
const DOCK_SRC = fs.readFileSync(
  path.join(COMPOSER_DIR, 'ArgumentComposerDock.tsx'),
  'utf8',
);
const ONEBOX_SRC = fs.readFileSync(
  path.join(COMPOSER_DIR, 'oneBox', 'OneBox.tsx'),
  'utf8',
);
const STRIP_SRC = fs.readFileSync(
  path.join(COMPOSER_DIR, 'composer', 'ComposerContextStrip.tsx'),
  'utf8',
);
const COLLAPSED_STRIP_SRC = fs.readFileSync(
  path.join(COMPOSER_DIR, 'composer', 'CollapsedComposerStrip.tsx'),
  'utf8',
);
const SOURCES = {
  composer: COMPOSER_SRC,
  dock: DOCK_SRC,
  oneBox: ONEBOX_SRC,
  strip: STRIP_SRC,
  collapsedStrip: COLLAPSED_STRIP_SRC,
};

describe('UX-001.3 — validation surface placement', () => {
  it('ComposerValidationPanel renders immediately above the Post button (existing pattern)', () => {
    // The panel and the Button render in this order; the Button is a
    // <Button label={...} /> directly after the panel + serverErrorBox.
    expect(COMPOSER_SRC).toMatch(
      /<ComposerValidationPanel[\s\S]+?Button[\s\S]+?onPress=\{handlePostIntent/,
    );
  });

  it('the composer does NOT mount a Modal beyond the dock + presend sheet', () => {
    // ArgumentComposer.tsx never imports Modal (the dock wraps the
    // whole composer in a Modal upstream; the composer itself is
    // inline).
    const importLines = COMPOSER_SRC
      .split('\n')
      .filter((l) => l.trim().startsWith('import '));
    for (const line of importLines) {
      // No "Modal," or "Modal\b" inside any react-native import.
      if (line.match(/from\s+['"]react-native['"]/)) {
        expect(line).not.toMatch(/\bModal\b/);
      }
    }
  });

  it('the strip + collapsed strip do NOT import any Modal / Toast / Banner', () => {
    for (const [name, src] of Object.entries({
      strip: STRIP_SRC,
      collapsedStrip: COLLAPSED_STRIP_SRC,
    })) {
      const importLines = src
        .split('\n')
        .filter((l) => l.trim().startsWith('import '));
      for (const line of importLines) {
        expect({ name, line, hit: /\bModal\b/.test(line) ? 'Modal' : null })
          .toEqual({ name, line, hit: null });
        expect({ name, line, hit: /\bToast\b/.test(line) ? 'Toast' : null })
          .toEqual({ name, line, hit: null });
        expect({ name, line, hit: /\bSnackbar\b/.test(line) ? 'Snackbar' : null })
          .toEqual({ name, line, hit: null });
      }
    }
  });

  it('no UX-001.3 surface contains verdict copy', () => {
    // Each banned phrase is matched with word boundaries so identifiers
    // like `onCloseRef` (which contains "loser" as a substring) do not
    // false-positive. Multi-word phrases use literal-substring scanning.
    const bannedWords = [
      'winner',
      'loser',
      'liar',
      'dishonest',
      'manipulative',
      'extremist',
      'propagandist',
    ];
    const bannedPhrases = [
      'bad faith',
      'proof of',
      'this is wrong',
      'this is false',
      'this is invalid',
    ];
    for (const [name, src] of Object.entries(SOURCES)) {
      // Strip JS comments first so doc-only mentions are ignored.
      const noComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
      // Extract every string literal — we ONLY care about user-facing
      // strings (single-quoted, double-quoted, or template-literal).
      const stringLiterals = [
        ...noComments.matchAll(/'([^'\\]|\\.)*'/g),
        ...noComments.matchAll(/"([^"\\]|\\.)*"/g),
        ...noComments.matchAll(/`([^`\\]|\\.)*`/g),
      ].map((m) => m[0].toLowerCase());
      const stringHaystack = stringLiterals.join(' ');
      for (const w of bannedWords) {
        const wordRe = new RegExp(`\\b${w}\\b`, 'i');
        if (wordRe.test(stringHaystack)) {
          throw new Error(
            `${name} string literal contains verdict word: "${w}"`,
          );
        }
      }
      for (const p of bannedPhrases) {
        if (stringHaystack.includes(p)) {
          throw new Error(
            `${name} string literal contains verdict phrase: "${p}"`,
          );
        }
      }
    }
  });
});
