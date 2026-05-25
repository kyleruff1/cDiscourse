/**
 * PR-004 — InitialsAvatar pure-helper tests (Q5).
 *
 * Moved from `userPreferencesModel.test.ts` and expanded with edge cases
 * for unicode / RTL / CJK / emoji / very-long / whitespace / null inputs.
 * Verifies the back-compat alias is exported alongside the original
 * GeneratedAvatar name, and asserts the 8-colour palette passes a
 * defensive luminance check against the fixed `#f8fafc` text colour.
 */
import {
  GeneratedAvatar,
  InitialsAvatar,
  deriveAvatarColor,
  deriveAvatarInitials,
  getAvatarBackgroundPalette,
  hashAvatarSeed,
} from '../src/features/account/InitialsAvatar';

describe('InitialsAvatar — pure helpers', () => {
  describe('hashAvatarSeed', () => {
    it('is deterministic and non-negative', () => {
      expect(hashAvatarSeed('abc')).toBe(hashAvatarSeed('abc'));
      expect(hashAvatarSeed('abc')).toBeGreaterThanOrEqual(0);
      expect(hashAvatarSeed('user-12345')).toBeGreaterThanOrEqual(0);
    });

    it('returns different hashes for different seeds (likely)', () => {
      // Not a strong guarantee, but a defensive check on the palette
      // dispersion.
      expect(hashAvatarSeed('a')).not.toBe(hashAvatarSeed('b'));
    });
  });

  describe('deriveAvatarInitials — Q5 edge cases', () => {
    it('returns up to two uppercase initials from a two-word name', () => {
      expect(deriveAvatarInitials('Ada Lovelace')).toBe('AL');
    });

    it('returns the first two chars when given a single-word name', () => {
      expect(deriveAvatarInitials('cher')).toBe('CH');
    });

    it('returns "?" for whitespace-only input', () => {
      expect(deriveAvatarInitials('  ')).toBe('?');
    });

    it('returns "?" for null', () => {
      expect(deriveAvatarInitials(null)).toBe('?');
    });

    it('returns "?" for empty string', () => {
      expect(deriveAvatarInitials('')).toBe('?');
    });

    it('returns a single char for single-character name', () => {
      expect(deriveAvatarInitials('A')).toBe('A');
      expect(deriveAvatarInitials('z')).toBe('Z');
    });

    it('returns first + last initial for three-or-more-word names (middle ignored)', () => {
      expect(deriveAvatarInitials('A B C')).toBe('AC');
      expect(deriveAvatarInitials('Mary Jane Watson')).toBe('MW');
      expect(deriveAvatarInitials('Jean Luc Pierre Picard')).toBe('JP');
    });

    it('handles CJK single-word names (no spaces)', () => {
      // 李明 is one "word" per \s+ split; .slice(0, 2) returns both chars.
      // .toUpperCase() is identity for CJK characters.
      expect(deriveAvatarInitials('李明')).toBe('李明');
    });

    it('handles CJK names with internal space', () => {
      // Two words: first char of each word.
      expect(deriveAvatarInitials('李 明')).toBe('李明');
    });

    it('handles RTL Arabic names', () => {
      // 'محمد' is one word; first two chars are 'مح'.
      expect(deriveAvatarInitials('محمد')).toBe('مح');
    });

    it('handles mixed-script names', () => {
      // First word starts with CJK char, last word starts with Latin char.
      expect(deriveAvatarInitials('李 Lovelace')).toBe('李L');
    });

    it('handles single emoji (surrogate pair)', () => {
      // '😀'.slice(0, 2) yields the full emoji (a surrogate pair takes 2
      // code units). .toUpperCase() is identity for emoji. The render
      // should NOT contain a replacement character.
      const result = deriveAvatarInitials('😀');
      expect(result).not.toBe('?');
      expect(result).not.toContain('�');
    });

    it('handles two emoji input', () => {
      // '😀😀'.slice(0, 2) yields the first emoji's surrogate pair.
      const result = deriveAvatarInitials('😀😀');
      expect(result).not.toBe('?');
      expect(result).not.toContain('�');
    });

    it('trims leading and trailing whitespace', () => {
      expect(deriveAvatarInitials('  Alice  ')).toBe('AL');
      expect(deriveAvatarInitials('\tBob\n')).toBe('BO');
    });

    it('handles internal multi-space (splits cleanly)', () => {
      // Multiple spaces between words split as one separator.
      expect(deriveAvatarInitials('Ada    Lovelace')).toBe('AL');
    });

    it('handles very long single-word names defensively', () => {
      // Even if upstream maxLength=60 is bypassed somehow, the slice
      // protects the renderer.
      const longName = 'a'.repeat(80);
      expect(deriveAvatarInitials(longName)).toBe('AA');
    });
  });

  describe('deriveAvatarColor', () => {
    it('is deterministic for the same seed', () => {
      expect(deriveAvatarColor('user-1')).toBe(deriveAvatarColor('user-1'));
      expect(deriveAvatarColor('user-1')).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it('produces a color in the documented 8-color palette', () => {
      const palette = getAvatarBackgroundPalette();
      const seeds = ['user-1', 'alice', 'bob', 'carol', '?', 'a', 'longer-userid-12345'];
      for (const seed of seeds) {
        expect(palette).toContain(deriveAvatarColor(seed));
      }
    });

    it('handles the "?" fallback seed deterministically', () => {
      const palette = getAvatarBackgroundPalette();
      const color = deriveAvatarColor('?');
      expect(palette).toContain(color);
      // Repeated calls produce the same color.
      expect(deriveAvatarColor('?')).toBe(color);
    });
  });

  describe('palette contrast guard (defensive)', () => {
    /**
     * Relative luminance per WCAG, sRGB. The 8-color palette is
     * hand-picked so every color passes >=4.5:1 contrast against the
     * `#f8fafc` text colour. This test guards against a future
     * maintainer adding a light palette color that would fail
     * accessibility.
     */
    function luminance(hex: string): number {
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      const channel = (c: number) =>
        c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    }
    function contrastRatio(fg: string, bg: string): number {
      const l1 = luminance(fg);
      const l2 = luminance(bg);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    it('every palette color passes WCAG AA contrast (>=4.5:1) vs #f8fafc text', () => {
      const palette = getAvatarBackgroundPalette();
      for (const bg of palette) {
        const ratio = contrastRatio('#f8fafc', bg);
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      }
    });
  });
});

describe('InitialsAvatar — back-compat exports (Q5)', () => {
  it('exports the GeneratedAvatar function for back-compat', () => {
    expect(typeof GeneratedAvatar).toBe('function');
  });

  it('exports the InitialsAvatar alias as the identity-facing name', () => {
    expect(typeof InitialsAvatar).toBe('function');
  });

  it('InitialsAvatar and GeneratedAvatar are the same component', () => {
    expect(InitialsAvatar).toBe(GeneratedAvatar);
  });
});
