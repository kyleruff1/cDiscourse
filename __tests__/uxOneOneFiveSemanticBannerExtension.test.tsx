/**
 * UX-001.5 — Semantic referee banner integration with annotation chips.
 *
 * Tests the bounded extension to RefereeBannerView:
 *   1. The observationChips prop is optional + additive — undefined
 *      input produces the pre-UX-001.5 render unchanged.
 *   2. When observationChips is supplied + non-empty, the banner
 *      renders an AnnotationChipStrip beneath the helper line.
 *   3. Headline + helper text remain in the same DOM position.
 *   4. The banner stays composer-only (mount site unchanged in
 *      ArgumentGameSurface.tsx — no board-level mount).
 *   5. The chip strip carries the documented testID for the reviewer.
 *
 * Source-scan only (no runtime render — repo convention).
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  BANNER_TONE_GLYPH_CHAR,
  RefereeBannerView,
  buildRefereeBannerContainerStyle,
  buildRefereeBannerGlyphStyle,
} from '../src/features/refereeBanners/RefereeBannerView';

const REFEREE_BANNER_VIEW_SRC = fs.readFileSync(
  path.join(
    process.cwd(),
    'src',
    'features',
    'refereeBanners',
    'RefereeBannerView.tsx',
  ),
  'utf8',
);

const ARGUMENT_GAME_SURFACE_SRC = fs.readFileSync(
  path.join(
    process.cwd(),
    'src',
    'features',
    'arguments',
    'room',
    'ArgumentRoom.tsx',
  ),
  'utf8',
);

describe('UX-001.5 — RefereeBannerView module loads with new props', () => {
  it('RefereeBannerView is exported', () => {
    expect(typeof RefereeBannerView).toBe('function');
  });
});

describe('UX-001.5 — RefereeBannerView accepts optional observationChips prop', () => {
  it('declares observationChips as ReadonlyArray<AnnotationChipDescriptor>', () => {
    expect(REFEREE_BANNER_VIEW_SRC).toMatch(
      /observationChips\?:\s*ReadonlyArray<AnnotationChipDescriptor>/,
    );
  });

  it('declares band as optional AnnotationBand', () => {
    expect(REFEREE_BANNER_VIEW_SRC).toMatch(/band\?:\s*AnnotationBand/);
  });

  it('imports AnnotationChipStrip + AnnotationChipDescriptor + AnnotationBand', () => {
    expect(REFEREE_BANNER_VIEW_SRC).toMatch(
      /from\s+['"]\.\.\/nodeAnnotations\/AnnotationChipStrip['"]/,
    );
    expect(REFEREE_BANNER_VIEW_SRC).toMatch(
      /from\s+['"]\.\.\/nodeAnnotations\/annotationChipDescriptor['"]/,
    );
    expect(REFEREE_BANNER_VIEW_SRC).toMatch(
      /from\s+['"]\.\.\/nodeAnnotations\/annotationKindTokens['"]/,
    );
  });
});

describe('UX-001.5 — RefereeBannerView render contract', () => {
  it('only renders AnnotationChipStrip when observationChips is non-empty', () => {
    // Pattern: hasObservationChips = Array.isArray(observationChips) && observationChips.length > 0
    expect(REFEREE_BANNER_VIEW_SRC).toMatch(
      /Array\.isArray\(observationChips\)\s*&&\s*observationChips\.length\s*>\s*0/,
    );
  });

  it('renders chips inside the existing textColumn (below helper line)', () => {
    // The observation chip block is placed AFTER the helperLine block.
    expect(REFEREE_BANNER_VIEW_SRC).toMatch(
      /helperLine[\s\S]*?<\/Text>[\s\S]*?hasObservationChips[\s\S]*?<AnnotationChipStrip/,
    );
  });

  it('chip strip carries the documented testID', () => {
    expect(REFEREE_BANNER_VIEW_SRC).toMatch(
      /testID="referee-banner-observation-chips"/,
    );
  });

  it('does NOT pass onChipPress (chips are read-only in the banner v1)', () => {
    // The composer banner's chips are advisory; UX-001.5A may wire
    // interaction later. v1 leaves it unset.
    expect(REFEREE_BANNER_VIEW_SRC).not.toMatch(
      /<AnnotationChipStrip[\s\S]*?onChipPress=/,
    );
  });
});

describe('UX-001.5 — RefereeBannerView is composer-only (mount site unchanged)', () => {
  // Per UX-001.3 Phase 3 framing, the banner mounts only inside the
  // composer surface in ArgumentGameSurface. UX-001.5 does NOT add
  // any new mount site; the banner remains composer-only.
  it('ArgumentGameSurface mounts RefereeBannerView in exactly one location', () => {
    const matches = ARGUMENT_GAME_SURFACE_SRC.match(/<RefereeBannerView/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('the mount site is unchanged from acc707d (no board-level mount added)', () => {
    // The single mount passes result + reduceMotionOverride. The new
    // observationChips prop is left undefined at this mount site (the
    // composer's existing useSemanticReferee hook does not yet emit
    // chips; UX-001.5A will wire them). The pre-UX-001.5 props remain.
    expect(ARGUMENT_GAME_SURFACE_SRC).toMatch(
      /<RefereeBannerView\s+result=\{refereeBanner\}\s+reduceMotionOverride=\{reduceMotionOverride\}/,
    );
  });
});

describe('UX-001.5 — RefereeBannerView preserves pre-UX-001.5 render path', () => {
  it('still exports BANNER_TONE_GLYPH_CHAR (pre-existing public surface)', () => {
    expect(BANNER_TONE_GLYPH_CHAR).toBeDefined();
  });

  it('still exports buildRefereeBannerContainerStyle', () => {
    expect(typeof buildRefereeBannerContainerStyle).toBe('function');
  });

  it('still exports buildRefereeBannerGlyphStyle', () => {
    expect(typeof buildRefereeBannerGlyphStyle).toBe('function');
  });
});
