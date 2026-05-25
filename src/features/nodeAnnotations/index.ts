/**
 * UX-001.5 — Public exports for the annotation primitives layer.
 *
 * The 12 primitives + the descriptor contract + the token + a11y
 * helpers. Hosts import from this index so internal file layout can
 * shift without breaking downstream callers.
 *
 * Pure-TS sub-modules:
 *   - annotationChipDescriptor    — descriptor type + validator + normalizer
 *   - annotationKindTokens        — color / size resolvers
 *   - annotationAriaLabel         — screen-reader label composer
 *   - annotationFocusBoundary     — pure-TS keyboard interpreter
 *   - inspectSectionChipDescriptors — sidecar chip adapter
 *
 * RN primitives:
 *   - AnnotationChip
 *   - AnnotationChipStrip
 *   - AnnotationOverflowChip
 *   - AnnotationBadge
 *   - AnnotationBadgeCluster
 *   - AnnotationFocusRing
 *   - AnnotationOutline
 *   - AnnotationEdgeHighlight
 *   - AnnotationFocusBoundary (RN wrapper for the pure-TS focus model)
 *   - InspectSectionChipStrip
 *   - InspectGroupHeader
 */

// ── Pure-TS exports ─────────────────────────────────────────────
export {
  ANNOTATION_CHIP_KINDS,
  ANNOTATION_CHIP_ICON_HINTS,
  ANNOTATION_CHIP_SOURCES,
  isAnnotationChipDescriptor,
  normalizeAnnotationChipDescriptor,
  type AnnotationChipDescriptor,
  type AnnotationChipIconHint,
  type AnnotationChipKind,
  type AnnotationChipSource,
} from './annotationChipDescriptor';

export {
  ANNOTATION_BADGE_DIAMETER_BY_BAND,
  ANNOTATION_CHIP_HEIGHT_BY_BAND,
  ANNOTATION_OVERFLOW_MIN_WIDTH_BY_BAND,
  ANNOTATION_STRIP_MAX_VISIBLE_BY_BAND,
  resolveBandValue,
  resolveChipColors,
  resolveChipColorsForDescriptor,
  type AnnotationBand,
  type ChipColors,
} from './annotationKindTokens';

export {
  buildAnnotationAriaLabel,
  buildAnnotationAriaLabelForCluster,
  buildAnnotationStripAriaLabel,
} from './annotationAriaLabel';

export {
  applyFocusBoundaryEffect,
  FOCUS_BOUNDARY_NOOP,
  resolveFocusBoundaryKeyEffect,
  type FocusBoundaryKeyEffect,
  type FocusBoundaryModifiers,
} from './annotationFocusBoundary';

export {
  toAnnotationChipDescriptor,
  toAnnotationChipDescriptors,
} from './inspectSectionChipDescriptors';

// ── RN primitive components ──────────────────────────────────────
export { AnnotationChip, type AnnotationChipProps } from './AnnotationChip';
export {
  AnnotationChipStrip,
  type AnnotationChipStripProps,
} from './AnnotationChipStrip';
export {
  AnnotationOverflowChip,
  buildAnnotationOverflowAriaLabel,
  type AnnotationOverflowChipProps,
} from './AnnotationOverflowChip';
export { AnnotationBadge, type AnnotationBadgeProps } from './AnnotationBadge';
export {
  AnnotationBadgeCluster,
  type AnnotationBadgeClusterMember,
  type AnnotationBadgeClusterLayout,
  type AnnotationBadgeClusterProps,
} from './AnnotationBadgeCluster';
export {
  AnnotationFocusRing,
  type AnnotationFocusRingProps,
} from './AnnotationFocusRing';
export {
  AnnotationOutline,
  type AnnotationOutlineProps,
  type AnnotationOutlineState,
} from './AnnotationOutline';
export {
  AnnotationEdgeHighlight,
  type AnnotationEdgeHighlightProps,
} from './AnnotationEdgeHighlight';
export {
  AnnotationFocusBoundary,
  type AnnotationFocusBoundaryProps,
} from './AnnotationFocusBoundaryView';
export {
  InspectSectionChipStrip,
  type InspectSectionChipStripProps,
  type InspectSectionChipStripSectionId,
} from './InspectSectionChipStrip';
export {
  InspectGroupHeader,
  buildInspectGroupHeaderAriaLabel,
  type InspectGroupHeaderProps,
} from './InspectGroupHeader';
