/**
 * UX-001.5 — `InspectSectionChipStrip` — chip strip inside an Inspect
 * section.
 *
 * The host that wires `AnnotationChipDescriptor[]` into an Inspect
 * section's body. v1 uses this for the §6 "Semantic flags" section
 * (`sectionId === 'flags'`); the strip's `sectionId` prop allows
 * UX-001.5A and future sections to opt in without further changes.
 *
 * Doctrine:
 *   - Inspect is read-only — `onChipPress` defaults to `undefined`
 *     inside Inspect (chips are non-pressable). UX-001.5A may wire
 *     chip tap to an editor surface; UX-001.5 does not.
 *   - Color is supplementary; the strip itself is a thin layout
 *     wrapper around `AnnotationChipStrip`.
 *   - No new hex literals; the underlying strip uses tokens.
 */
import React from 'react';
import { AnnotationChipStrip } from './AnnotationChipStrip';
import type { AnnotationChipDescriptor } from './annotationChipDescriptor';
import type { AnnotationBand } from './annotationKindTokens';

export type InspectSectionChipStripSectionId =
  | 'flags'
  | 'unresolved'
  | 'sits'
  | 'matters'
  | 'says'
  | 'next_move'
  | 'evidence_detail';

export interface InspectSectionChipStripProps {
  /** Inspect section id — drives the strip's aria-label composition. */
  sectionId: InspectSectionChipStripSectionId;
  /** Chip descriptors for the section. */
  descriptors: ReadonlyArray<AnnotationChipDescriptor>;
  /** Resolved band; defaults to `'tablet'` at the underlying strip. */
  band?: AnnotationBand;
  /**
   * Optional per-chip press handler. Inspect callers leave undefined
   * (Inspect is read-only); UX-001.5A's editor wrappers may supply.
   */
  onChipPress?: (descriptor: AnnotationChipDescriptor) => void;
  /** testID passthrough. */
  testID?: string;
}

/**
 * Inspect section chip strip. Defers to `AnnotationChipStrip` for
 * layout / overflow / focus-boundary; this wrapper carries the
 * section-aware aria label and props the host supplies.
 */
export function InspectSectionChipStrip({
  sectionId,
  descriptors,
  band,
  onChipPress,
  testID,
}: InspectSectionChipStripProps) {
  return (
    <AnnotationChipStrip
      descriptors={descriptors}
      band={band}
      sectionId={sectionId}
      onChipPress={onChipPress}
      testID={testID ?? `inspect-section-chip-strip-${sectionId}`}
    />
  );
}
