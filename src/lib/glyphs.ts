/**
 * UX-PR-E (F-20) — canonical unicode glyph vocabulary.
 *
 * The app ships a deliberate ZERO-DEPENDENCY icon strategy (no icon lib
 * in package.json). ~13 unicode glyphs recur across the surfaces; today
 * they are inlined as string literals, and the one previously-tokenized
 * glyph (CALLBACK_GLYPH in crossRoom/callbackComposerCopy.ts) is bypassed
 * by two inline callsites. This module is the single home for the
 * vocabulary so Wave-2 can migrate the literals onto named references.
 *
 * Doctrine: a glyph is CHROME / STRUCTURE, never a verdict. `check`
 * signals presence or completion of a step, NOT that a claim is correct
 * or true (cdiscourse-doctrine §1, timeline-grammar). No key or value
 * carries verdict / heat / popularity vocabulary.
 *
 * PR-E adds this vocabulary ONLY. It replaces no callsite; Wave-2
 * (P2-12) migrates the inline glyphs and dedupes CALLBACK_GLYPH onto
 * GLYPHS.callback.
 *
 * This module is a pure leaf: it imports nothing, so there is no cycle
 * with designTokens.ts (which imports and re-exports it).
 */
export const GLYPHS = {
  circleOutline: '○',
  circleFilled:  '●',
  triangleDown:  '▾',
  triangleRight: '▸',
  check:         '✓',
  arrowRight:    '→',
  diamondOutline:'◇',
  diamondFilled: '◆',
  bullet:        '•',
  arrowUp:       '↑',
  arrowDown:     '↓',
  callback:      '⤴',
  replyReturn:   '↩',
} as const;

export type GlyphKey = keyof typeof GLYPHS;
