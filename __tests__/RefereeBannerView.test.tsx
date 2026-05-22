/**
 * MCP-019 — RefereeBannerView tests.
 *
 * The repo's UI test discipline is pure-helper + source-scan (see
 * EvidenceDebtChip.test.tsx / TimelineMiniMap.test.tsx). The banner strip's
 * load-bearing decisions — the non-color tone glyph, the accent border per
 * tone, the render-nothing-on-null rule, the announce-once contract, the
 * RN-primitive constraint — are exercised here via the component's pure
 * helpers plus a source-scan of the component contract.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  BANNER_TONE_GLYPH_CHAR,
  buildRefereeBannerContainerStyle,
  buildRefereeBannerGlyphStyle,
} from '../src/features/refereeBanners/RefereeBannerView';
import { REFEREE_BANNER_LIBRARY } from '../src/features/refereeBanners/refereeBannerLibrary';
import type { RefereeBannerTone, RefereeBannerToneGlyph } from '../src/features/refereeBanners/types';

const SRC = fs.readFileSync(
  path.join(process.cwd(), 'src/features/refereeBanners/RefereeBannerView.tsx'),
  'utf8',
);

const ALL_TONES: RefereeBannerTone[] = ['celebratory', 'nudge', 'routing_hint'];
const ALL_GLYPHS: RefereeBannerToneGlyph[] = ['star', 'arrow', 'branch'];

describe('RefereeBannerView — non-color tone glyph', () => {
  it('every glyph is a non-empty geometric mark', () => {
    for (const glyph of ALL_GLYPHS) {
      expect(BANNER_TONE_GLYPH_CHAR[glyph].length).toBeGreaterThan(0);
    }
  });

  it('the three glyphs are visually distinct', () => {
    const chars = ALL_GLYPHS.map((g) => BANNER_TONE_GLYPH_CHAR[g]);
    expect(new Set(chars).size).toBe(chars.length);
  });

  it('no glyph is a plain alphabetic letter (it must read as a shape)', () => {
    for (const glyph of ALL_GLYPHS) {
      expect(BANNER_TONE_GLYPH_CHAR[glyph]).not.toMatch(/[a-z]/i);
    }
  });
});

describe('RefereeBannerView — accent border (color is not the only signal)', () => {
  it('every tone yields a visible left border (a non-color geometric signal)', () => {
    for (const tone of ALL_TONES) {
      const style = buildRefereeBannerContainerStyle(tone);
      expect(style.borderLeftWidth).toBeGreaterThan(0);
      expect(typeof style.borderLeftColor).toBe('string');
    }
  });

  it('the glyph style carries a color per tone', () => {
    for (const tone of ALL_TONES) {
      expect(typeof buildRefereeBannerGlyphStyle(tone).color).toBe('string');
    }
  });
});

describe('RefereeBannerView — render-nothing rule', () => {
  it('the component returns null when the banner is null', () => {
    expect(SRC).toMatch(/if \(!banner\)/);
    expect(SRC).toMatch(/return null/);
  });

  it('the component reads result?.banner defensively', () => {
    expect(SRC).toMatch(/result\?\.banner/);
  });
});

describe('RefereeBannerView — accessibility', () => {
  it('announces the accessibilityLabel once on appearance', () => {
    expect(SRC).toMatch(/announceForAccessibility/);
    expect(SRC).toMatch(/useEffect/);
  });

  it('binds the container accessibilityLabel to the banner label', () => {
    expect(SRC).toMatch(/accessibilityLabel=\{banner\.accessibilityLabel\}/);
  });

  it('the container declares a text accessibility role', () => {
    expect(SRC).toMatch(/accessibilityRole="text"/);
  });

  it('accepts and references the reduceMotionOverride prop', () => {
    expect(SRC).toMatch(/reduceMotionOverride/);
  });
});

describe('RefereeBannerView — RN primitives only, no new dependency', () => {
  it('imports only View / Text / AccessibilityInfo from react-native', () => {
    const rnImport = SRC.match(/import \{([^}]*)\} from 'react-native'/);
    expect(rnImport).not.toBeNull();
    const named = (rnImport![1] || '').split(',').map((s) => s.trim()).filter(Boolean);
    for (const name of named) {
      expect(['AccessibilityInfo', 'StyleSheet', 'Text', 'View']).toContain(name);
    }
  });

  it('is not a Modal (the banner is a strip, never a modal)', () => {
    expect(SRC).not.toMatch(/\bModal\b/);
  });

  it('authors no copy — it renders only banner.headline / helperLine', () => {
    expect(SRC).toMatch(/\{banner\.headline\}/);
    expect(SRC).toMatch(/\{banner\.helperLine\}/);
  });
});

describe('RefereeBannerView — ban-list backstop over the library copy it renders', () => {
  const BANNED = [
    'winner', 'loser', 'won', 'lost', 'right', 'wrong', 'true', 'false',
    'correct', 'incorrect', 'verdict', 'proven', 'disproven', 'liar',
    'troll', 'propagandist', 'extremist',
  ];

  it('every banner headline + helperLine the component can render is ban-list clean', () => {
    for (const banner of REFEREE_BANNER_LIBRARY) {
      const strings = [banner.headline, banner.helperLine ?? '', banner.accessibilityLabel];
      for (const s of strings) {
        const lower = s.toLowerCase();
        for (const tok of BANNED) {
          const re = new RegExp(`\\b${tok}\\b`, 'i');
          expect(re.test(lower)).toBe(false);
        }
      }
    }
  });

  it('the component renders only banner library strings — it concatenates no copy', () => {
    // The component's only <Text> children are {banner.headline} /
    // {banner.helperLine} / the toneGlyph char — all {expressions}, never a
    // hard-coded display string. A doc comment may use ordinary words ("when
    // true …"); the doctrine concern is the RENDERED output, asserted over
    // the library above. Here we prove no <Text> opens with a literal letter.
    // `[\s\S]` lets the tag span lines (numberOfLines={2} pushes the child
    // to the next line).
    expect(SRC).not.toMatch(/<Text\b[^>]*>[ \t]*[A-Za-z]/);
    // And the component does build at least one <Text> with a {expression}.
    expect(SRC).toMatch(/<Text\b[\s\S]*?>[\s\S]*?\{banner\./);
  });
});
