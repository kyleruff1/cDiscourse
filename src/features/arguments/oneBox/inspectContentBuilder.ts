/**
 * UX-001.4 — InspectSectionContent builder (pure TypeScript).
 *
 * The host (room shell) builds the seven-section `InspectSectionContent`
 * shape `buildInspectPopout` already consumes by composing the
 * client-side data that's already in scope: the sidecar view-model
 * (which combines META-001 / LIFE-001 / EV-001 / EV-003 / RULE-001/003
 * outputs), the active timeline node, the parent node, the metadata
 * ledger, the evidence contract, and the branch position.
 *
 * Design rationale (UX-001.4 §4.1, brief §"Disallowed"):
 *  - Inspect is a presentation surface — it derives nothing. The
 *    section content is supplied READ-ONLY by the host.
 *  - This builder consumes ONLY client-resident data. No backend, no
 *    Supabase call, no new fetch. Every input value is already in
 *    scope where the room shell mounts Inspect.
 *  - The function is pure TS so it's unit-testable in isolation.
 *
 * Doctrine:
 *  - Plain language only. No internal-code leaks; the sidecar's
 *    labels already pass `gameCopy.toPlainLanguage` (or come from
 *    META-001 / RULE-003 plain-language helpers).
 *  - No verdict tokens. The sidecar's bodyExcerpt is the move's body
 *    verbatim — moderation lives upstream.
 *  - Pure TS. No React. No Supabase. No `Date.now()`. No AI.
 *
 * Pure TS. No new dependency.
 */

import type { SidecarViewModel } from '../argumentReplySidecarModel';
import { toAnnotationChipDescriptors } from '../../nodeAnnotations/inspectSectionChipDescriptors';
import type { InspectSectionContent } from './inspectPopoutModel';

/** Builder input — every field optional / nullable. */
export interface InspectContentBuilderInput {
  /**
   * The sidecar view-model built by `buildSidecarViewModel`. The host
   * already builds this on every render; the inspect builder reuses
   * its output rather than re-deriving META-001 / LIFE-001 / EV
   * signals. `null` when no node is selected — the builder returns an
   * empty content object (every Inspect section then renders its §7
   * fallback).
   */
  sidecarViewModel: SidecarViewModel | null;
  /**
   * Optional branch summary string — already formatted by the host
   * (e.g. "Mainline · #3 of 12"). When supplied, used for §4 "Where
   * this move sits". When omitted, falls back to the sidecar's own
   * `where_it_sits.pathLabel`.
   */
  branchPositionLabel?: string | null;
}

/**
 * Build the `InspectSectionContent` shape Inspect consumes. Pure.
 *
 * Returns an object with every optional field; absent inputs are
 * omitted (NOT set to `''`) so `inspectPopoutModel.buildInspectPopout`
 * picks up the §7 fallback copy.
 *
 * Field mapping:
 *   - `says`           ← sidecar §1.bodyExcerpt
 *   - `matters`        ← sidecar §2.lifecycleHelperLine (plain English,
 *                        already RULE-003 plain-language)
 *   - `unresolved`     ← sidecar §3.items joined by " · "; empty array
 *                        leaves field omitted (Inspect's §7 fallback
 *                        renders).
 *   - `sits`           ← `branchPositionLabel` if supplied, else
 *                        sidecar §4.pathLabel ("Root → #2 → #4").
 *   - `semanticFlags`  ← sidecar §6.chips → array of labels.
 *   - `evidenceDetail` ← omitted in v1 (sidecar does not currently
 *                        carry the EV-001 evidence-object detail; the
 *                        evidence contract is on the timelineMap, not
 *                        on the sidecar view-model). Inspect's §7
 *                        fallback "No evidence attached" applies until
 *                        a follow-up card wires the evidence object
 *                        through.
 */
export function buildInspectContent(
  input: InspectContentBuilderInput,
): InspectSectionContent {
  const sidecar = input.sidecarViewModel;
  const out: InspectSectionContent = {};

  // No selection → empty content object; every section renders §7
  // fallback. Inspect itself remains fully functional (read-only).
  if (!sidecar || sidecar.isEmpty) {
    return out;
  }

  for (const section of sidecar.sections) {
    switch (section.kind) {
      case 'what_this_move_says': {
        // §1 — the body excerpt is the section body. The sidecar
        // already truncated at a word boundary; the excerpt is
        // render-ready plain English.
        if (section.bodyExcerpt && section.bodyExcerpt.trim().length > 0) {
          out.says = section.bodyExcerpt.trim();
        }
        break;
      }
      case 'why_it_matters': {
        // §2 — RULE-003's lifecycle helper line names how this move
        // relates to its parent / cluster. Already plain language.
        if (!section.isEmpty && section.lifecycleHelperLine.trim().length > 0) {
          out.matters = section.lifecycleHelperLine.trim();
        }
        break;
      }
      case 'what_is_unresolved': {
        // §3 — concatenate the unresolved items' plain-language labels
        // into a one-line summary. Empty list → omit (Inspect §7
        // fallback renders "Nothing is open on this move right now.").
        if (!section.isEmpty && section.items.length > 0) {
          out.unresolved = section.items
            .map((item) => item.label)
            .filter((label) => label && label.trim().length > 0)
            .join(' · ');
        }
        break;
      }
      case 'where_it_sits': {
        // §4 — either the host-supplied branchPositionLabel (preferred
        // when the host can compose a richer string) or the sidecar's
        // pathLabel verbatim.
        const supplied =
          typeof input.branchPositionLabel === 'string'
            ? input.branchPositionLabel.trim()
            : '';
        if (supplied.length > 0) {
          out.sits = supplied;
        } else if (section.pathLabel && section.pathLabel.trim().length > 0) {
          out.sits = section.pathLabel.trim();
        }
        break;
      }
      case 'semantic_flags': {
        // §6 — chip labels become the semanticFlags array; Inspect's
        // §6 body joins them with " · ". An empty list → omit.
        //
        // UX-001.5 — additionally emit `semanticFlagsChips` so the §6
        // body can render as an `InspectSectionChipStrip` instead of a
        // joined string. Both fields are emitted during transition;
        // the chip-strip render is the primary path, the joined-string
        // body remains the screen-reader + legacy fallback.
        if (section.totalCount > 0 && section.chips.length > 0) {
          out.semanticFlags = section.chips
            .map((chip) => chip.label)
            .filter((label) => label && label.trim().length > 0);
          const descriptors = toAnnotationChipDescriptors(section.chips);
          if (descriptors.length > 0) {
            out.semanticFlagsChips = descriptors;
          }
        }
        break;
      }
      case 'suggested_next_move': {
        // §5 — Inspect's §5 body is built by `inspectPopoutModel` from
        // the stage emphasis; the sidecar's §5 (which is ST-002-not-
        // yet-implemented) does not feed it.
        break;
      }
      default: {
        // Exhaustiveness guard — unreachable for the typed union.
        const never: never = section;
        void never;
        break;
      }
    }
  }

  return out;
}
