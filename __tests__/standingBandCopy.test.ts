/**
 * SW-001 — Strong vs weak talking-point bands.
 *
 * Tests the soft-label mapping, the rich descriptions, the shape/
 * texture descriptors, and the ban-list contract that prevents truth/
 * winner copy from regressing into the rendered UI.
 */
import {
  STANDING_BAND_SOFT_LABEL,
  STANDING_BAND_RICH_DESCRIPTION,
  STANDING_BAND_SHAPE_HINT,
  STANDING_BAND_TEXTURE_HINT,
  FORBIDDEN_STANDING_BAND_TOKENS,
  formatStandingBandShort,
  formatStandingBandRich,
} from '../src/features/arguments/standingBandCopy';
import { STANDING_BAND_LABEL } from '../src/features/arguments/argumentScoreModel';
import type { TimelineStandingBand } from '../src/features/arguments/argumentGameSurfaceModel';

const ALL_BANDS: TimelineStandingBand[] = [
  'pretty_wrong',
  'slightly_wrong',
  'neutral',
  'slightly_right',
  'maybe_right_misguided',
  'pretty_right',
  'completely_right',
  'unscored',
  'not_enough_signal',
];

const SEVEN_MAIN_BANDS: TimelineStandingBand[] = [
  'pretty_wrong',
  'slightly_wrong',
  'neutral',
  'slightly_right',
  'maybe_right_misguided',
  'pretty_right',
  'completely_right',
];

// ── Soft-label mapping (exact strings from the SW-001 issue) ─────

describe('SW-001 soft labels match the issue mapping', () => {
  it('maps the 7 main bands to the exact softened labels from the issue', () => {
    expect(STANDING_BAND_SOFT_LABEL.pretty_wrong).toBe('Needs work');
    expect(STANDING_BAND_SOFT_LABEL.slightly_wrong).toBe('Thin');
    expect(STANDING_BAND_SOFT_LABEL.neutral).toBe('Neutral');
    expect(STANDING_BAND_SOFT_LABEL.slightly_right).toBe('Some support');
    expect(STANDING_BAND_SOFT_LABEL.maybe_right_misguided).toBe('Has a point, but risky');
    expect(STANDING_BAND_SOFT_LABEL.pretty_right).toBe('Well supported');
    expect(STANDING_BAND_SOFT_LABEL.completely_right).toBe('Strongly supported');
  });

  it('provides plain-language labels for unscored / not-enough-signal observation states', () => {
    expect(STANDING_BAND_SOFT_LABEL.unscored).toBeTruthy();
    expect(STANDING_BAND_SOFT_LABEL.not_enough_signal).toBeTruthy();
    expect(STANDING_BAND_SOFT_LABEL.unscored).not.toMatch(/score|signal/i);
    expect(STANDING_BAND_SOFT_LABEL.not_enough_signal).not.toMatch(/_/);
  });

  it('every band has a soft label, a rich description, a shape glyph, and a texture descriptor', () => {
    for (const b of ALL_BANDS) {
      expect(STANDING_BAND_SOFT_LABEL[b]).toBeTruthy();
      expect(STANDING_BAND_RICH_DESCRIPTION[b]).toBeTruthy();
      expect(STANDING_BAND_SHAPE_HINT[b]).toBeTruthy();
      expect(STANDING_BAND_TEXTURE_HINT[b]).toBeTruthy();
    }
  });
});

// ── Back-compat re-export ────────────────────────────────────────

describe('SW-001 argumentScoreModel.STANDING_BAND_LABEL is the soft mapping', () => {
  it('STANDING_BAND_LABEL re-exports the softened labels', () => {
    for (const b of ALL_BANDS) {
      expect(STANDING_BAND_LABEL[b]).toBe(STANDING_BAND_SOFT_LABEL[b]);
    }
  });
});

// ── Ban-list across user-facing strings ──────────────────────────

describe('SW-001 ban-list — no truth/winner copy in any user-facing band string', () => {
  function wordBoundaryRegex(token: string): RegExp {
    return new RegExp(`\\b${token.replace(/\s+/g, '\\s+')}\\b`, 'i');
  }

  it('FORBIDDEN_STANDING_BAND_TOKENS includes the canonical verdict + truth tokens', () => {
    for (const t of ['winner', 'loser', 'truth', 'liar', 'right', 'wrong']) {
      expect(FORBIDDEN_STANDING_BAND_TOKENS).toContain(t);
    }
  });

  it('no soft label contains a forbidden token', () => {
    for (const b of ALL_BANDS) {
      const label = STANDING_BAND_SOFT_LABEL[b];
      for (const token of FORBIDDEN_STANDING_BAND_TOKENS) {
        expect(label).not.toMatch(wordBoundaryRegex(token));
      }
    }
  });

  it('no rich description contains a forbidden token', () => {
    for (const b of ALL_BANDS) {
      const desc = STANDING_BAND_RICH_DESCRIPTION[b];
      for (const token of FORBIDDEN_STANDING_BAND_TOKENS) {
        expect(desc).not.toMatch(wordBoundaryRegex(token));
      }
    }
  });

  it('formatted output (short + rich) contains no forbidden tokens', () => {
    for (const b of ALL_BANDS) {
      const shortFmt = formatStandingBandShort(b);
      const richFmt = formatStandingBandRich(b);
      for (const token of FORBIDDEN_STANDING_BAND_TOKENS) {
        expect(shortFmt).not.toMatch(wordBoundaryRegex(token));
        expect(richFmt).not.toMatch(wordBoundaryRegex(token));
      }
    }
  });

  it('legacy STANDING_BAND_LABEL re-export also passes the ban-list', () => {
    for (const b of ALL_BANDS) {
      for (const token of FORBIDDEN_STANDING_BAND_TOKENS) {
        expect(STANDING_BAND_LABEL[b]).not.toMatch(wordBoundaryRegex(token));
      }
    }
  });
});

// ── Shape / texture differentiation ─────────────────────────────

describe('SW-001 strength uses shape/stroke/texture, not only color', () => {
  it('shape glyphs are non-empty single visible characters', () => {
    for (const b of ALL_BANDS) {
      const g = STANDING_BAND_SHAPE_HINT[b];
      expect(g.length).toBeGreaterThan(0);
      expect(g.length).toBeLessThanOrEqual(2); // surrogate pairs allowed
      expect(g.trim().length).toBeGreaterThan(0);
    }
  });

  it('at least 6 distinct shape glyphs across the 7 main bands', () => {
    const glyphs = new Set(SEVEN_MAIN_BANDS.map((b) => STANDING_BAND_SHAPE_HINT[b]));
    expect(glyphs.size).toBeGreaterThanOrEqual(6);
  });

  it('at least 3 distinct textures across the 7 main bands', () => {
    const textures = new Set(SEVEN_MAIN_BANDS.map((b) => STANDING_BAND_TEXTURE_HINT[b]));
    expect(textures.size).toBeGreaterThanOrEqual(3);
  });

  it('texture values are part of the documented enum', () => {
    const allowed = new Set(['none', 'cross_hatch', 'diagonal_stripes', 'solid_fill']);
    for (const b of ALL_BANDS) {
      expect(allowed.has(STANDING_BAND_TEXTURE_HINT[b])).toBe(true);
    }
  });
});

// ── Formatting ──────────────────────────────────────────────────

describe('SW-001 formatStandingBandShort / Rich', () => {
  it('short format prefixes the shape glyph to the soft label', () => {
    expect(formatStandingBandShort('completely_right')).toBe(
      `${STANDING_BAND_SHAPE_HINT.completely_right} Strongly supported`,
    );
    expect(formatStandingBandShort('pretty_wrong')).toBe(
      `${STANDING_BAND_SHAPE_HINT.pretty_wrong} Needs work`,
    );
  });

  it('rich format returns the long description', () => {
    expect(formatStandingBandRich('neutral')).toBe(STANDING_BAND_RICH_DESCRIPTION.neutral);
  });
});
