/**
 * UX-001.5 — Focus ring + outline + edge highlight render contracts.
 *
 * Source-scan tests for the three visual-only overlay primitives:
 *   - AnnotationFocusRing renders only when isFocused or isSelected.
 *   - AnnotationOutline returns null for state='none'.
 *   - AnnotationEdgeHighlight is pointerEvents="none" and uses
 *     GLOW.activePath.color by default.
 *
 * Plus the doctrine guarantees:
 *   - Every overlay uses pointerEvents="none" (no interactive hit area).
 *   - All colors token-derived (no hex literals).
 *   - Every overlay is non-interactive (accessibilityElementsHidden).
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  AnnotationFocusRing,
} from '../src/features/nodeAnnotations/AnnotationFocusRing';
import {
  AnnotationOutline,
} from '../src/features/nodeAnnotations/AnnotationOutline';
import {
  AnnotationEdgeHighlight,
} from '../src/features/nodeAnnotations/AnnotationEdgeHighlight';

const NODE_ANNOTATIONS_DIR = path.join(
  process.cwd(),
  'src',
  'features',
  'nodeAnnotations',
);

const RING_SRC = fs.readFileSync(
  path.join(NODE_ANNOTATIONS_DIR, 'AnnotationFocusRing.tsx'),
  'utf8',
);
const OUTLINE_SRC = fs.readFileSync(
  path.join(NODE_ANNOTATIONS_DIR, 'AnnotationOutline.tsx'),
  'utf8',
);
const EDGE_SRC = fs.readFileSync(
  path.join(NODE_ANNOTATIONS_DIR, 'AnnotationEdgeHighlight.tsx'),
  'utf8',
);

describe('UX-001.5 — overlay primitives load', () => {
  it('AnnotationFocusRing exports the component', () => {
    expect(typeof AnnotationFocusRing).toBe('function');
  });
  it('AnnotationOutline exports the component', () => {
    expect(typeof AnnotationOutline).toBe('function');
  });
  it('AnnotationEdgeHighlight exports the component', () => {
    expect(typeof AnnotationEdgeHighlight).toBe('function');
  });
});

describe('UX-001.5 — AnnotationFocusRing — visual-only render contract', () => {
  it('returns null when neither focused nor selected', () => {
    expect(RING_SRC).toMatch(/if\s*\(!isFocused\s*&&\s*!isSelected\)\s*return\s+null/);
  });
  it('uses SURFACE_TOKENS.focusRing for the border', () => {
    expect(RING_SRC).toMatch(/SURFACE_TOKENS\.focusRing/);
  });
  it('uses pointerEvents="none" (visual only)', () => {
    expect(RING_SRC).toMatch(/pointerEvents="none"/);
  });
  it('hides itself from accessibility (parent owns role + state)', () => {
    expect(RING_SRC).toMatch(/accessibilityElementsHidden/);
  });
  it('uses 2px border when focused, 1px when only selected', () => {
    expect(RING_SRC).toMatch(/borderWidth:\s*isFocused\s*\?\s*2\s*:\s*1/);
  });
});

describe('UX-001.5 — AnnotationOutline — state-driven render', () => {
  it('returns null for state="none"', () => {
    expect(OUTLINE_SRC).toMatch(/if\s*\(state\s*===\s*['"]none['"]\)\s*return\s+null/);
  });
  it('selected state uses BRAND.accent.cream (matches VG-004 selectedHalo)', () => {
    expect(OUTLINE_SRC).toMatch(/BRAND\.accent\.cream/);
  });
  it('active state uses GLOW.activePath.color', () => {
    expect(OUTLINE_SRC).toMatch(/GLOW\.activePath\.color/);
  });
  it('dimmed state uses SURFACE_TOKENS.border with opacity 0.5', () => {
    expect(OUTLINE_SRC).toMatch(/borderColor:\s*SURFACE_TOKENS\.border/);
    expect(OUTLINE_SRC).toMatch(/opacity:\s*0\.5/);
  });
  it('selected uses 2px, active uses 1px (geometric distinction beyond color)', () => {
    expect(OUTLINE_SRC).toMatch(/selected[\s\S]*?borderWidth:\s*2/);
    expect(OUTLINE_SRC).toMatch(/active[\s\S]*?borderWidth:\s*1/);
  });
  it('uses pointerEvents="none"', () => {
    expect(OUTLINE_SRC).toMatch(/pointerEvents="none"/);
  });
});

describe('UX-001.5 — AnnotationEdgeHighlight — geometric line render', () => {
  it('uses pointerEvents="none"', () => {
    expect(EDGE_SRC).toMatch(/pointerEvents="none"/);
  });
  it('defaults color to GLOW.activePath.color', () => {
    expect(EDGE_SRC).toMatch(/GLOW\.activePath\.color/);
  });
  it('defaults thickness to 2 (matches GLOW strokeWidthPx)', () => {
    // Pattern: `thicknessPx > 0 ? thicknessPx : 2`
    expect(EDGE_SRC).toMatch(/thicknessPx\s*>\s*0\s*\?\s*thicknessPx\s*:\s*2/);
  });
  it('hides itself from accessibility', () => {
    expect(EDGE_SRC).toMatch(/accessibilityElementsHidden/);
  });
});

describe('UX-001.5 — overlay primitives have no hex literals', () => {
  it('AnnotationFocusRing.tsx has no hex literals', () => {
    expect(RING_SRC.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });
  it('AnnotationOutline.tsx has no hex literals', () => {
    expect(OUTLINE_SRC.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });
  it('AnnotationEdgeHighlight.tsx has no hex literals', () => {
    expect(EDGE_SRC.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).toEqual([]);
  });
});
