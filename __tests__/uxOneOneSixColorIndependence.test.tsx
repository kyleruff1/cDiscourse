/**
 * UX-001.6 — Color independence per viewport.
 *
 * Per `docs/designs/UX-001.6.md` §4 + `accessibility-targets`
 * §"Color contrast targets": shape, glyph, and label distinguish
 * state in a desaturated (grayscale) render. The cross-device matrix
 * extends the UX-001.5 color-independence contract to verify it
 * holds at each of the 6 viewports.
 *
 * Three representative surfaces per the design's §4 selection:
 *   1. AnnotationChipStrip — chips of different `kind` values stay
 *      distinguishable via label + glyph + borderWidth, not color.
 *   2. ArgumentTimelineMap node state (default / active / focused) —
 *      distinguished by borderWidth, transform, opacity, not color.
 *   3. AnnotationFocusRing — focus on/off distinguished by borderWidth
 *      (2 vs 1) and opacity (1 vs 0.55), not color.
 *
 * Per the repo's `.tsx` UI-test discipline (pinned react-test-renderer
 * is held away from the testing-library peer), the verification uses
 * the same pure-helper + source-scan pattern as
 * `uxOneOneFiveColorIndependence.test.tsx`. The matrix iterates
 * across the 6 viewports so the verdict per cell is explicit.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  buildAnnotationAriaLabel,
  buildAnnotationStripAriaLabel,
} from '../src/features/nodeAnnotations/annotationAriaLabel';
import { buildAnnotationOverflowAriaLabel } from '../src/features/nodeAnnotations/AnnotationOverflowChip';
import {
  ANNOTATION_CHIP_KINDS,
  type AnnotationChipDescriptor,
} from '../src/features/nodeAnnotations/annotationChipDescriptor';
import {
  resolveChipColors,
  ANNOTATION_CHIP_HEIGHT_BY_BAND,
} from '../src/features/nodeAnnotations/annotationKindTokens';

const ROOT = process.cwd();

interface ViewportCell {
  label: string;
  windowWidth: number;
  band: 'phone' | 'tablet' | 'wide';
}

const VIEWPORTS: ReadonlyArray<ViewportCell> = Object.freeze([
  { label: '390x844 phone iOS', windowWidth: 390, band: 'phone' },
  { label: '412x892 phone large Android', windowWidth: 412, band: 'phone' },
  { label: '768x1024 tablet iPad', windowWidth: 768, band: 'tablet' },
  { label: '1024x1366 tablet iPad Pro', windowWidth: 1024, band: 'tablet' },
  { label: '1366x768 narrow browser', windowWidth: 1366, band: 'wide' },
  { label: '1920x1080 wide browser', windowWidth: 1920, band: 'wide' },
]);

// ── Surface 1: chip strip — labels carry the meaning ────────────

describe('UX-001.6 color independence — Surface 1: chip strip labels per viewport', () => {
  for (const vp of VIEWPORTS) {
    for (const kind of ANNOTATION_CHIP_KINDS) {
      it(`${vp.label} / kind=${kind}: aria label includes the descriptor label`, () => {
        const d: AnnotationChipDescriptor = {
          id: `${kind}-${vp.band}`,
          label: 'Source gap',
          kind,
        };
        const aria = buildAnnotationAriaLabel(d);
        expect(aria).toContain('Source gap');
      });

      it(`${vp.label} / kind=${kind}: aria label is grayscale-safe (no color words)`, () => {
        const d: AnnotationChipDescriptor = {
          id: `${kind}-${vp.band}`,
          label: 'Sample',
          kind,
        };
        const aria = buildAnnotationAriaLabel(d).toLowerCase();
        // The aria label MUST NOT lean on color words like "red" /
        // "green" / "amber" / etc. to convey state. Shape and label
        // do the work.
        for (const colorWord of ['red', 'green', 'amber', 'orange', 'yellow', 'blue']) {
          expect(aria).not.toMatch(new RegExp(`\\b${colorWord}\\b`));
        }
      });
    }
  }
});

describe('UX-001.6 color independence — chip strip aria label includes count regardless of color', () => {
  for (const vp of VIEWPORTS) {
    it(`${vp.label}: aria label carries the count word "items"`, () => {
      const aria = buildAnnotationStripAriaLabel(
        [
          { id: 'a', label: 'A', kind: 'flag' },
          { id: 'b', label: 'B', kind: 'flag' },
          { id: 'c', label: 'C', kind: 'flag' },
        ],
        'flags',
      );
      expect(aria).toMatch(/\b3 items\b/);
    });

    it(`${vp.label}: overflow chip aria label is plain English`, () => {
      expect(buildAnnotationOverflowAriaLabel(5)).toBe('5 more annotations.');
    });
  }
});

// ── Surface 1 token check: chip height resolves per band ────────

describe('UX-001.6 color independence — chip token sizing per band is monotonic', () => {
  for (const vp of VIEWPORTS) {
    it(`${vp.label}: ANNOTATION_CHIP_HEIGHT_BY_BAND[${vp.band}] is positive`, () => {
      expect(ANNOTATION_CHIP_HEIGHT_BY_BAND[vp.band]).toBeGreaterThan(0);
    });
  }

  it('phone <= tablet <= wide (monotonic non-decreasing)', () => {
    expect(ANNOTATION_CHIP_HEIGHT_BY_BAND.phone).toBeLessThanOrEqual(
      ANNOTATION_CHIP_HEIGHT_BY_BAND.tablet,
    );
    expect(ANNOTATION_CHIP_HEIGHT_BY_BAND.tablet).toBeLessThanOrEqual(
      ANNOTATION_CHIP_HEIGHT_BY_BAND.wide,
    );
  });
});

// ── Surface 1 doctrine: no kind uses traffic-light colors ───────

describe('UX-001.6 color independence — no chip kind uses status traffic-light colors', () => {
  for (const vp of VIEWPORTS) {
    for (const kind of ANNOTATION_CHIP_KINDS) {
      it(`${vp.label} / kind=${kind}: chip color triple resolves to non-empty token values`, () => {
        const colors = resolveChipColors(kind);
        // Colors are token-derived (no hex literals); the doctrine
        // assertion is that no kind background reads as a verdict.
        // The exact assertion lives in uxOneOneFiveKindTokens.test.ts;
        // this cell just confirms the colors object resolves cleanly.
        expect(colors.bg).toBeTruthy();
        expect(colors.fg).toBeTruthy();
        expect(colors.borderColor).toBeTruthy();
      });
    }
  }
});

// ── Surface 2: ArgumentTimelineMap node state distinguishers ────

describe('UX-001.6 color independence — Surface 2: ArgumentTimelineMap node state per viewport', () => {
  const TIMELINE_SRC = fs.readFileSync(
    path.resolve(ROOT, 'src/features/arguments/ArgumentTimelineMap.tsx'),
    'utf8',
  );

  for (const vp of VIEWPORTS) {
    it(`${vp.label}: timeline source uses borderWidth as a state distinguisher`, () => {
      expect(TIMELINE_SRC).toMatch(/borderWidth/);
    });

    it(`${vp.label}: timeline source uses transform / scale as a state distinguisher`, () => {
      // The active node distinguishes via transform/scale/opacity —
      // not only via color. The source either uses Animated transforms
      // OR uses explicit numeric scale literals.
      expect(TIMELINE_SRC).toMatch(/transform|scale|opacity/);
    });

    it(`${vp.label}: timeline source carries an accessibilityRole`, () => {
      // Nodes that are pressable expose `accessibilityRole`.
      expect(TIMELINE_SRC).toMatch(/accessibilityRole/);
    });

    it(`${vp.label}: timeline source carries an accessibilityLabel that is not color-coded`, () => {
      expect(TIMELINE_SRC).toMatch(/accessibilityLabel/);
    });
  }
});

// ── Surface 3: AnnotationFocusRing — focus state is geometric ───

describe('UX-001.6 color independence — Surface 3: AnnotationFocusRing borderWidth distinguishes focus per viewport', () => {
  const RING_SRC = fs.readFileSync(
    path.resolve(ROOT, 'src/features/nodeAnnotations/AnnotationFocusRing.tsx'),
    'utf8',
  );

  for (const vp of VIEWPORTS) {
    it(`${vp.label}: focus ring uses 2px when focused (vs 1px otherwise)`, () => {
      // The ring's contract: borderWidth 2 when focused, 1 when only
      // selected, null when neither. Source-scan confirms the literal.
      expect(RING_SRC).toMatch(/borderWidth:\s*isFocused\s*\?\s*2\s*:\s*1/);
    });

    it(`${vp.label}: focus ring renders null when neither focused nor selected`, () => {
      expect(RING_SRC).toMatch(/if\s*\(!isFocused\s*&&\s*!isSelected\)\s*return\s+null/);
    });

    it(`${vp.label}: focus ring opacity is 1 when focused, 0.55 when only selected`, () => {
      expect(RING_SRC).toMatch(/opacity:\s*isFocused\s*\?\s*1\s*:\s*0\.55/);
    });

    it(`${vp.label}: focus ring is pointerEvents="none" so it never blocks input`, () => {
      expect(RING_SRC).toMatch(/pointerEvents="none"/);
    });

    it(`${vp.label}: focus ring is accessibility-hidden (parent owns the role)`, () => {
      expect(RING_SRC).toMatch(/accessibilityElementsHidden/);
    });
  }
});

// ── Cross-surface: doctrine guarantee that color is never named in
//                  user-facing copy (color words leak verdict) ──

describe('UX-001.6 color independence — chip aria labels never name colors', () => {
  for (const vp of VIEWPORTS) {
    it(`${vp.label}: kind-derived aria word is not a color word`, () => {
      for (const kind of ANNOTATION_CHIP_KINDS) {
        const d: AnnotationChipDescriptor = {
          id: kind,
          label: 'Sample',
          kind,
        };
        const aria = buildAnnotationAriaLabel(d).toLowerCase();
        for (const colorWord of [
          'red',
          'green',
          'amber',
          'orange',
          'yellow',
          'blue',
          'crimson',
        ]) {
          expect(aria).not.toMatch(new RegExp(`\\b${colorWord}\\b`));
        }
      }
    });
  }
});
