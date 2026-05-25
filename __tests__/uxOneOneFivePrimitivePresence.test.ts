/**
 * UX-001.5 — Primitive presence (the canonical 12).
 *
 * Asserts that each of the 12 primitives required by the brief is
 * present, loads, and exports its public API. The canonical set
 * (design §2 + brief §"The canonical primitive set"):
 *
 *  1. AnnotationChip
 *  2. AnnotationChipStrip
 *  3. AnnotationOverflowChip
 *  4. AnnotationBadge
 *  5. AnnotationBadgeCluster
 *  6. AnnotationFocusRing
 *  7. AnnotationOutline
 *  8. AnnotationEdgeHighlight
 *  9. InspectSectionChipStrip
 * 10. InspectGroupHeader
 * 11. AnnotationAriaLabel (pure-TS builders)
 * 12. AnnotationFocusBoundary (pure-TS model + RN wrapper)
 *
 * Plus the public index file re-exports every primitive.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as primitives from '../src/features/nodeAnnotations';

const NODE_ANNOTATIONS_DIR = path.join(
  process.cwd(),
  'src',
  'features',
  'nodeAnnotations',
);

const EXPECTED_FILES: ReadonlyArray<string> = Object.freeze([
  'AnnotationChip.tsx',
  'AnnotationChipStrip.tsx',
  'AnnotationOverflowChip.tsx',
  'AnnotationBadge.tsx',
  'AnnotationBadgeCluster.tsx',
  'AnnotationFocusRing.tsx',
  'AnnotationOutline.tsx',
  'AnnotationEdgeHighlight.tsx',
  'InspectSectionChipStrip.tsx',
  'InspectGroupHeader.tsx',
  'AnnotationFocusBoundaryView.tsx',
  // Pure-TS modules:
  'annotationChipDescriptor.ts',
  'annotationKindTokens.ts',
  'annotationAriaLabel.ts',
  'annotationFocusBoundary.ts',
  'inspectSectionChipDescriptors.ts',
  'index.ts',
]);

describe('UX-001.5 — every primitive source file exists', () => {
  for (const filename of EXPECTED_FILES) {
    it(`${filename} exists`, () => {
      const filePath = path.join(NODE_ANNOTATIONS_DIR, filename);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  }
});

describe('UX-001.5 — public index re-exports every primitive', () => {
  const EXPECTED_EXPORTS = [
    // RN components:
    'AnnotationChip',
    'AnnotationChipStrip',
    'AnnotationOverflowChip',
    'AnnotationBadge',
    'AnnotationBadgeCluster',
    'AnnotationFocusRing',
    'AnnotationOutline',
    'AnnotationEdgeHighlight',
    'InspectSectionChipStrip',
    'InspectGroupHeader',
    'AnnotationFocusBoundary',
    // Pure-TS builders / models:
    'buildAnnotationAriaLabel',
    'buildAnnotationAriaLabelForCluster',
    'buildAnnotationStripAriaLabel',
    'buildAnnotationOverflowAriaLabel',
    'buildInspectGroupHeaderAriaLabel',
    'resolveFocusBoundaryKeyEffect',
    'applyFocusBoundaryEffect',
    'resolveChipColors',
    'resolveChipColorsForDescriptor',
    'resolveBandValue',
    'toAnnotationChipDescriptor',
    'toAnnotationChipDescriptors',
    'isAnnotationChipDescriptor',
    'normalizeAnnotationChipDescriptor',
    // Vocabularies:
    'ANNOTATION_CHIP_KINDS',
    'ANNOTATION_CHIP_ICON_HINTS',
    'ANNOTATION_CHIP_SOURCES',
    'ANNOTATION_STRIP_MAX_VISIBLE_BY_BAND',
    'ANNOTATION_CHIP_HEIGHT_BY_BAND',
    'ANNOTATION_BADGE_DIAMETER_BY_BAND',
    'ANNOTATION_OVERFLOW_MIN_WIDTH_BY_BAND',
    'FOCUS_BOUNDARY_NOOP',
  ];

  for (const exportName of EXPECTED_EXPORTS) {
    it(`re-exports "${exportName}"`, () => {
      expect((primitives as Record<string, unknown>)[exportName]).toBeDefined();
    });
  }
});
