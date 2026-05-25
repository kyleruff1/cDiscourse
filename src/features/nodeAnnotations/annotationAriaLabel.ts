/**
 * UX-001.5 — Pure-TS screen-reader label builder for annotation
 * primitives (chips, clusters, strips).
 *
 * Every interactive primitive announces one of:
 *   - `descriptor.ariaLabel` (explicit override),
 *   - the composed string this module produces.
 *
 * Doctrine:
 *   - Plain language only — composed labels never carry raw codes (they
 *     compose from descriptor fields that are already plain language).
 *   - No verdict tokens — the composer uses descriptive English ("Note",
 *     "Flag", "Lifecycle") rather than evaluative words.
 *   - Pure TS. No React. No Supabase. No network.
 */

import type {
  AnnotationChipDescriptor,
  AnnotationChipIconHint,
  AnnotationChipKind,
} from './annotationChipDescriptor';

/**
 * Kind → screen-reader word. Returned ahead of the descriptor's label so
 * the user hears the category first: "Flag: Source gap."
 */
function kindToWord(kind: AnnotationChipKind | undefined): string {
  switch (kind) {
    case 'state':
      return 'State';
    case 'context':
      return 'Context';
    case 'lifecycle':
      return 'Lifecycle';
    case 'evidence':
      return 'Evidence';
    case 'flag':
      return 'Flag';
    case 'semantic':
      return 'Note';
    default:
      return 'Annotation';
  }
}

/**
 * Compose the screen-reader announcement for one chip. Uses
 * `descriptor.ariaLabel` verbatim when present; otherwise composes
 * `${kindWord}: ${label}.${tooltip ? ` ${tooltip}.` : ''}`.
 *
 * Trims and de-duplicates trailing periods so the string is one
 * grammatical sentence (or two when a tooltip is appended).
 *
 * Pure. Deterministic.
 */
export function buildAnnotationAriaLabel(descriptor: AnnotationChipDescriptor): string {
  if (
    typeof descriptor.ariaLabel === 'string' &&
    descriptor.ariaLabel.trim().length > 0
  ) {
    return descriptor.ariaLabel.trim();
  }

  const kindWord = kindToWord(descriptor.kind);
  const labelText = descriptor.label.trim();
  const sentence1 = `${kindWord}: ${stripTrailingPunctuation(labelText)}.`;

  const tooltipText = descriptor.tooltip?.trim();
  if (tooltipText && tooltipText.length > 0) {
    const sentence2 = `${stripTrailingPunctuation(tooltipText)}.`;
    return `${sentence1} ${sentence2}`;
  }
  return sentence1;
}

/**
 * Compose the screen-reader announcement for a multi-badge cluster.
 *
 * Pattern: `"N annotation(s): Label1, Label2, Label3"`. When a badge has
 * an explicit `ariaLabel`, that takes precedence over the kind-derived
 * word; the joined list shows the labels users actually see in the UI.
 *
 * For an empty cluster returns `'No annotations.'`.
 *
 * Pure. Deterministic.
 */
export function buildAnnotationAriaLabelForCluster(
  badges: ReadonlyArray<{
    iconHint?: AnnotationChipIconHint;
    kind?: AnnotationChipKind;
    ariaLabel: string;
  }>,
): string {
  if (!badges || badges.length === 0) return 'No annotations.';
  const labels = badges
    .map((b) => (typeof b.ariaLabel === 'string' ? b.ariaLabel.trim() : ''))
    .filter((s) => s.length > 0);
  if (labels.length === 0) return 'No annotations.';
  const count = labels.length;
  const noun = count === 1 ? 'annotation' : 'annotations';
  return `${count} ${noun}: ${labels.join(', ')}`;
}

/**
 * Compose the screen-reader announcement for an `AnnotationChipStrip`
 * container.
 *
 * Pattern: `"<plain-section-label>: N item(s)"`. The strip-level label
 * gives the screen reader a stable summary; the individual chips carry
 * their own labels.
 *
 * `sectionId` is a stable identifier (e.g. `'flags'`) that this builder
 * maps to plain-language section names.
 *
 * Pure. Deterministic.
 */
export function buildAnnotationStripAriaLabel(
  descriptors: ReadonlyArray<AnnotationChipDescriptor>,
  sectionId: string,
): string {
  const sectionLabel = sectionIdToLabel(sectionId);
  const count = Array.isArray(descriptors) ? descriptors.length : 0;
  if (count === 0) return `${sectionLabel}: no items.`;
  const noun = count === 1 ? 'item' : 'items';
  return `${sectionLabel}: ${count} ${noun}.`;
}

/**
 * Plain-language label for a section id used by `InspectSectionChipStrip`.
 * Mirrors `inspectPopoutModel.INSPECT_SECTION_TITLE` but kept local so
 * this module has zero cross-feature imports (it's pure TS).
 */
function sectionIdToLabel(sectionId: string): string {
  switch (sectionId) {
    case 'flags':
      return 'Semantic flags';
    case 'unresolved':
      return 'What is unresolved';
    case 'sits':
      return 'Where it sits';
    case 'matters':
      return 'Why it matters';
    case 'says':
      return 'What this move says';
    case 'next_move':
      return 'Suggested next move';
    case 'evidence_detail':
      return 'Evidence detail';
    default:
      return 'Annotations';
  }
}

/**
 * Strip a single trailing `.` or `!` or `?` from a string. Defensive so
 * the builder produces a clean `${text}.` rather than `${text}..`.
 */
function stripTrailingPunctuation(s: string): string {
  if (!s) return s;
  const last = s.charAt(s.length - 1);
  if (last === '.' || last === '!' || last === '?') {
    return s.slice(0, -1);
  }
  return s;
}
