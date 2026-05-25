/**
 * UX-001.5A — NodeLabelMark → AnnotationChipDescriptor adapter.
 *
 * Per UX-001.7 Phase 7 framing §6 (binding):
 *   - `kind: 'machine_observation'` → descriptor `source: 'machine'`,
 *     descriptor `kind: 'semantic'`, descriptor `iconHint: 'info'`.
 *   - `kind: 'user_allegation'` → descriptor `source: 'user'`,
 *     descriptor `kind: 'flag'`, descriptor `iconHint: 'warn'`.
 *   - `category: NodeLabelSource` (forward-compatible string).
 *   - `label: mark.shortLabel` (compact for Timeline / chip surfaces).
 *   - `tooltip: mark.description` (plain-language explanation).
 *   - `ariaLabel: "Machine observation: <label>"` or
 *     `"User allegation: <label>"`.
 *
 * `mark.shortLabel` is used for descriptor `label` because the
 * descriptor feeds chip rendering (which prefers compact text).
 * `mark.label` is used for tooltip / ariaLabel as the more complete
 * form.
 *
 * Pure TS. No React. No Supabase. No network. No new dependency.
 */

import type { AnnotationChipDescriptor } from '../nodeAnnotations';
import type { NodeLabelMark } from './nodeLabelTypes';

/**
 * Convert a `NodeLabelMark` to an `AnnotationChipDescriptor`. Pure.
 *
 * Every emitted descriptor is shaped to pass
 * `isAnnotationChipDescriptor` and `normalizeAnnotationChipDescriptor`
 * unchanged. The compact `shortLabel` becomes the visible chip label;
 * the longer `label` is preserved in the ariaLabel for screen-reader
 * users.
 */
export function toAnnotationChipDescriptor(mark: NodeLabelMark): AnnotationChipDescriptor {
  const isMachine = mark.kind === 'machine_observation';
  return {
    id: mark.id,
    label: mark.shortLabel,
    kind: isMachine ? 'semantic' : 'flag',
    iconHint: isMachine ? 'info' : 'warn',
    tooltip: mark.description,
    source: isMachine ? 'machine' : 'user',
    category: mark.source,
    ariaLabel: isMachine
      ? `Machine observation: ${mark.label}`
      : `User allegation: ${mark.label}`,
  };
}

/** Convert an array of marks to an array of descriptors. Pure. */
export function toAnnotationChipDescriptors(
  marks: ReadonlyArray<NodeLabelMark>,
): AnnotationChipDescriptor[] {
  if (!Array.isArray(marks)) return [];
  return marks.map(toAnnotationChipDescriptor);
}
