/**
 * MCP-014 — Referee banner: accessibility guard.
 *
 * Proves every accessibilityLabel is a complete sentence with the tone stated
 * in words, buildBannerAccessibilityLabel is pure, the framingWord parameter
 * changes only the prefix, every banner carries a non-color toneGlyph, the
 * tone → toneGlyph mapping holds, and the frozen label cannot drift from the
 * headline.
 */

import {
  REFEREE_BANNER_LIBRARY,
  buildBannerAccessibilityLabel,
  BANNER_TONE_PREFIX,
} from '../src/features/refereeBanners';
import type {
  RefereeBannerTone,
  RefereeBannerToneGlyph,
} from '../src/features/refereeBanners';

/** The doctrine mapping — tone determines the shape glyph. */
const TONE_TO_GLYPH: Readonly<Record<RefereeBannerTone, RefereeBannerToneGlyph>> = {
  celebratory: 'star',
  nudge: 'arrow',
  routing_hint: 'branch',
};

describe('MCP-014 accessibility — accessibilityLabel shape', () => {
  it('every accessibilityLabel is a non-empty string', () => {
    for (const banner of REFEREE_BANNER_LIBRARY) {
      expect(typeof banner.accessibilityLabel).toBe('string');
      expect(banner.accessibilityLabel.length).toBeGreaterThan(0);
    }
  });

  it('a celebratory banner label begins with "Referee note:"', () => {
    for (const banner of REFEREE_BANNER_LIBRARY) {
      if (banner.tone !== 'celebratory') continue;
      expect(banner.accessibilityLabel.startsWith('Referee note:')).toBe(true);
    }
  });

  it('a nudge / routing_hint banner label begins with "Referee suggestion:"', () => {
    for (const banner of REFEREE_BANNER_LIBRARY) {
      if (banner.tone === 'celebratory') continue;
      expect(banner.accessibilityLabel.startsWith('Referee suggestion:')).toBe(
        true,
      );
    }
  });

  it('the label includes the headline verbatim', () => {
    for (const banner of REFEREE_BANNER_LIBRARY) {
      expect(banner.accessibilityLabel.includes(banner.headline)).toBe(true);
    }
  });

  it('the label includes the helperLine verbatim when present', () => {
    for (const banner of REFEREE_BANNER_LIBRARY) {
      if (banner.helperLine === undefined) continue;
      expect(banner.accessibilityLabel.includes(banner.helperLine)).toBe(true);
    }
  });
});

describe('MCP-014 accessibility — buildBannerAccessibilityLabel is pure', () => {
  it('same input yields the same output across repeated calls', () => {
    const seed = {
      tone: 'celebratory' as RefereeBannerTone,
      headline: 'Clean parent tie.',
      helperLine: 'This picks up the thread.',
    };
    const a = buildBannerAccessibilityLabel(seed);
    const b = buildBannerAccessibilityLabel(seed);
    const c = buildBannerAccessibilityLabel(seed);
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('builds a label from headline alone when helperLine is absent', () => {
    const label = buildBannerAccessibilityLabel({
      tone: 'nudge',
      headline: 'Pin the exact passage you mean.',
    });
    expect(label).toBe('Referee suggestion: Pin the exact passage you mean.');
    // No trailing space, no empty clause.
    expect(label.endsWith('.')).toBe(true);
  });

  it('changing framingWord changes only the prefix, not the body', () => {
    const seed = {
      tone: 'routing_hint' as RefereeBannerTone,
      headline: 'This probably belongs on a branch.',
    };
    const refereeLabel = buildBannerAccessibilityLabel(seed, 'Referee');
    const coachLabel = buildBannerAccessibilityLabel(seed, 'Coach');
    // Strip the differing framingWord prefix; the remainder is byte-identical.
    const refereeBody = refereeLabel.replace(/^Referee /, '');
    const coachBody = coachLabel.replace(/^Coach /, '');
    expect(refereeBody).toBe(coachBody);
  });

  it('BANNER_TONE_PREFIX maps celebratory→note and nudge/routing_hint→suggestion', () => {
    expect(BANNER_TONE_PREFIX.celebratory).toBe('note');
    expect(BANNER_TONE_PREFIX.nudge).toBe('suggestion');
    expect(BANNER_TONE_PREFIX.routing_hint).toBe('suggestion');
  });
});

describe('MCP-014 accessibility — toneGlyph is a non-color signal', () => {
  it('every banner carries a toneGlyph of star | arrow | branch', () => {
    for (const banner of REFEREE_BANNER_LIBRARY) {
      expect(['star', 'arrow', 'branch']).toContain(banner.toneGlyph);
    }
  });

  it('toneGlyph is consistent with tone for every library entry', () => {
    for (const banner of REFEREE_BANNER_LIBRARY) {
      expect(banner.toneGlyph).toBe(TONE_TO_GLYPH[banner.tone]);
    }
  });
});

describe('MCP-014 accessibility — the frozen label cannot drift from the headline', () => {
  it('every accessibilityLabel equals a fresh rebuild from headline + helperLine + tone', () => {
    for (const banner of REFEREE_BANNER_LIBRARY) {
      const rebuilt = buildBannerAccessibilityLabel({
        tone: banner.tone,
        headline: banner.headline,
        helperLine: banner.helperLine,
      });
      expect(banner.accessibilityLabel).toBe(rebuilt);
    }
  });
});
