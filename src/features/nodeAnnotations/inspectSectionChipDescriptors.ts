/**
 * UX-001.5 — Sidecar chip → AnnotationChipDescriptor adapter (pure TS).
 *
 * The `buildInspectContent` emitter consumes the sidecar's
 * `SidecarSemanticFlagChip[]` and produces an `AnnotationChipDescriptor[]`
 * for the §6 flags section. This adapter is the boundary translator.
 *
 * Forward compatibility: UX-001.5A's adapter (in `src/features/nodeLabels/`)
 * will populate `source` + `category` from the metadata ledger's
 * `userAppliedTags` vs `autoDerivedMetadata` separation. UX-001.5 leaves
 * those fields undefined here — the rendering is source-neutral.
 *
 * Doctrine:
 *   - Plain language only — defensive fallback through `gameCopy.toPlainLanguage`
 *     for any raw code that slipped through the sidecar's earlier
 *     plain-language pass.
 *   - No verdict copy — adapter only re-shapes data.
 *   - Pure TS. No React. No Supabase. No network.
 */

import type { SidecarSemanticFlagChip } from '../arguments/argumentReplySidecarModel';
import { toPlainLanguage } from '../arguments/gameCopy';
import {
  normalizeAnnotationChipDescriptor,
  type AnnotationChipDescriptor,
  type AnnotationChipIconHint,
} from './annotationChipDescriptor';

/**
 * Map the sidecar chip's free-form `iconHint` string to the descriptor's
 * constrained `AnnotationChipIconHint`. The sidecar's `iconHint` is
 * RULE-003's hint string; unknown values become `undefined` (the chip
 * renders without a leading glyph).
 *
 * Pure. Deterministic.
 */
function mapIconHint(rawHint: string | undefined | null): AnnotationChipIconHint | undefined {
  if (typeof rawHint !== 'string' || rawHint.length === 0) return undefined;
  const v = rawHint.trim().toLowerCase();
  switch (v) {
    case 'info':
    case 'warn':
    case 'check':
    case 'time':
    case 'evidence':
    case 'flag':
    case 'cluster':
      return v;
    default:
      return undefined;
  }
}

/**
 * Adapt one sidecar chip to an annotation chip descriptor.
 *
 * The sidecar chip already carries a plain-language `label` (the
 * RULE-003 pass runs upstream in the sidecar model). The adapter:
 *   - falls back to `gameCopy.toPlainLanguage(sourceCode)` then the chip
 *     `id` only if the label is empty (defensive — should never trigger
 *     in normal flow);
 *   - maps `family` to `kind`: `manual_tag → 'flag'`, `auto_metadata
 *     → 'lifecycle'`;
 *   - normalizes the result so any snake_case leak in the label is
 *     rejected (the function returns `null` — caller's responsibility to
 *     filter).
 *
 * Returns `null` when the adapter cannot produce a valid descriptor
 * (the label is empty after all fallbacks, or normalization rejects it).
 *
 * Pure. Deterministic.
 */
export function toAnnotationChipDescriptor(
  chip: SidecarSemanticFlagChip | null | undefined,
): AnnotationChipDescriptor | null {
  if (!chip) return null;
  if (typeof chip.id !== 'string' || chip.id.length === 0) return null;

  // Label resolution — sidecar label first, then plain-language map,
  // then a final defensive fallback to the chip id.
  const rawLabel = typeof chip.label === 'string' ? chip.label.trim() : '';
  let label = rawLabel;
  if (label.length === 0) {
    const plain = toPlainLanguage(String(chip.sourceCode ?? ''));
    if (typeof plain === 'string' && plain.trim().length > 0) {
      label = plain.trim();
    }
  }
  if (label.length === 0) {
    // Last-ditch defensive fallback — render the id rather than nothing.
    // The normalizer below rejects the descriptor when this still looks
    // like a snake_case code, which is the desired safety net.
    label = chip.id;
  }

  const kind: AnnotationChipDescriptor['kind'] =
    chip.family === 'manual_tag' ? 'flag' : 'lifecycle';

  const tooltipRaw = typeof chip.helperLine === 'string' ? chip.helperLine.trim() : '';
  const tooltip = tooltipRaw.length > 0 ? tooltipRaw : undefined;

  return normalizeAnnotationChipDescriptor({
    id: chip.id,
    label,
    kind,
    iconHint: mapIconHint(chip.iconHint),
    tooltip,
  });
}

/**
 * Adapt a sidecar chip array to a descriptor array, filtering out any
 * chip that the normalizer rejects (empty / snake_case-leak labels).
 *
 * Pure. Returns a new array; never mutates input.
 */
export function toAnnotationChipDescriptors(
  chips: ReadonlyArray<SidecarSemanticFlagChip>,
): ReadonlyArray<AnnotationChipDescriptor> {
  if (!Array.isArray(chips) || chips.length === 0) return Object.freeze([]);
  const out: AnnotationChipDescriptor[] = [];
  for (const chip of chips) {
    const descriptor = toAnnotationChipDescriptor(chip);
    if (descriptor) out.push(descriptor);
  }
  return Object.freeze(out);
}
