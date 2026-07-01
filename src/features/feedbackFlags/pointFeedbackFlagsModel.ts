/**
 * UX-FLAGS-002 — Point-level feedback-flag adapter (pure TypeScript).
 *
 * Transforms a point's persisted machine-observation rows (the `(family,
 * rawKey)` MCP result rows resident on the active node) into a small, calm list
 * of renderable feedback-flag view models. This is the DATA layer for the
 * point-level friendly-flag UI (#834). It delegates ALL routing + suppression
 * decisions to the #850 descriptor layer (`friendlyFlagMap.ts`) and re-authors
 * nothing.
 *
 * What this module does NOT do:
 *  - No priority / cap / ranking / 1–3 selection — that whole policy is #835.
 *    The order here is exactly `friendlyFlagsFor`'s input order (no slice).
 *  - No composer-intent wiring, no confidence render, no Evidence Echoes.
 *  - No provider / network / Supabase / React. Pure, deterministic,
 *    JSON-serializable in/out (matching `friendlyFlagMap.ts`).
 *
 * Doctrine anchors (cdiscourse-doctrine):
 *  - §1  Advisory only; no verdict/truth tokens ever reach a rendered field.
 *  - §3  Family D descriptors carry `neverGrantsStanding:true`; that boolean is
 *        passed through as metadata ONLY and is NEVER converted into score /
 *        credit / standing language (the component enforces the copy fence).
 *  - §9  Internal family / rawKey / snake_case codes never appear in `label`,
 *        `helper`, or `accessibilityLabel`.
 *  - §10a Family J (`sensitive_composer`) never renders — the #850 layer already
 *        excludes it and this adapter never resurrects it.
 */

import type { MachineObservationFamily } from '../nodeLabels/nodeLabelTypes';
import {
  friendlyFlagsFor,
  isOwnBubbleEligible,
  type FriendlyFlag,
  type FriendlyFlagTone,
} from './friendlyFlagMap';

// ── View model ────────────────────────────────────────────────────

/**
 * A single renderable feedback flag for a point. Deliberately narrow: only the
 * fields the calm pill/row render. `confidence`, `evidenceSpan`, `createdAt`,
 * `composerIntent`, and `actionable` are intentionally NOT carried — no
 * composer wiring and no confidence render in this card.
 */
export interface PointFeedbackFlagViewModel {
  /** = FriendlyFlagKey (snake_case). Render key / test handle ONLY — never visible text. */
  id: string;
  /** Plain-language chip label. Rendered. Ban-list clean (guaranteed by #850). */
  label: string;
  /** Optional one-line "why?" helper. Rendered only when the row expands. */
  helper?: string;
  /** Tone band — drives glyph prefix + token style, NEVER color-only. */
  tone: FriendlyFlagTone;
  /**
   * Family D passthrough. When true the component renders zero standing /
   * credit / score words — the "receipt/source help" framing lives only in the
   * accessibility label + the #850-authored helper.
   */
  neverGrantsStanding: boolean;
  /** Tone-word + label (+ ", receipt or source help" for Family D). Spoken by SR. */
  accessibilityLabel: string;
  /** Internal family — tests + future #835 grouping. NEVER rendered. */
  family: MachineObservationFamily;
}

/** The minimal per-point observation shape the adapter reads. */
export interface PointObservationInput {
  family: MachineObservationFamily | string;
  rawKey: string;
}

/** Viewer context for own-bubble suppression. */
export interface PointFeedbackViewerContext {
  /**
   * True when the active point is the viewer's OWN bubble. Derived at the
   * callsite from `activeViewModel.actor === 'self'`. An `'unknown'` actor maps
   * to `false` (no over-suppression).
   */
  isOwnPoint: boolean;
}

// ── Tone → spoken word (accessibility, never color-only) ──────────

const TONE_WORD: Readonly<Record<FriendlyFlagTone, string>> = Object.freeze({
  positive: 'Positive',
  prompt: 'Prompt',
  descriptive: 'Note',
});

/** The receipt/source framing appended to Family D (neverGrantsStanding) a11y labels. */
const RECEIPT_SUFFIX = ', receipt or source help';

// ── Adapter ───────────────────────────────────────────────────────

/**
 * Map a point's persisted observation rows to renderable feedback-flag view
 * models.
 *
 * Routing + suppression are delegated entirely to #850:
 *  1. Non-array input → frozen `[]`.
 *  2. `friendlyFlagsFor` is the SOLE routing source — it already drops null
 *     (unknown / unmapped / `*_false` / `no_*` / J-excluded), de-dupes by key,
 *     preserves INPUT ORDER, and applies NO cap / rank. This adapter preserves
 *     that 1:1.
 *  3. `flag.clientSuppressed === true` → filtered out.
 *  4. When `viewer.isOwnPoint`, drop flags where `!isOwnBubbleEligible(flag)`
 *     (the #850 helper — never re-derived here).
 *  5. Build one VM per surviving flag; `neverGrantsStanding` is passed through
 *     as a boolean and never turned into score/credit/standing text.
 *
 * NOTE: #835 owns the cap / priority policy. There is deliberately no slice,
 * no ranking, and no truncation in this function.
 */
export function buildPointFeedbackFlags(
  observations: ReadonlyArray<PointObservationInput> | null | undefined,
  viewer: PointFeedbackViewerContext,
): ReadonlyArray<PointFeedbackFlagViewModel> {
  if (!Array.isArray(observations)) return Object.freeze([]);

  // #850 is the sole routing source: null-drop, de-dupe by key, input order,
  // no cap, no rank — preserved 1:1 below.
  const flags = friendlyFlagsFor(observations);

  const out: PointFeedbackFlagViewModel[] = [];
  for (const flag of flags) {
    // Client-render suppression gate (mirrors the live hub suppress-set).
    if (flag.clientSuppressed === true) continue;
    // Own-bubble challenge-adjacent suppression — delegated to #850, never
    // re-derived. Unknown actor → isOwnPoint false → nothing dropped.
    if (viewer.isOwnPoint && !isOwnBubbleEligible(flag)) continue;
    out.push(Object.freeze(toViewModel(flag)));
  }

  // #835 owns the cap/priority seam. No slice here by design.
  return Object.freeze(out);
}

/** Build a single frozen view model from a #850 descriptor. */
function toViewModel(flag: FriendlyFlag): PointFeedbackFlagViewModel {
  const neverGrantsStanding = flag.neverGrantsStanding === true;
  const toneWord = TONE_WORD[flag.tone];
  const accessibilityLabel =
    toneWord + ', ' + flag.label + (neverGrantsStanding ? RECEIPT_SUFFIX : '');

  const vm: PointFeedbackFlagViewModel = {
    id: flag.key,
    label: flag.label,
    tone: flag.tone,
    neverGrantsStanding,
    accessibilityLabel,
    family: flag.family,
  };
  // Preserve `helper?` as optional — only attach when the descriptor has one.
  if (typeof flag.helper === 'string' && flag.helper.length > 0) {
    vm.helper = flag.helper;
  }
  return vm;
}

/** Tone-word map exported for test enumeration. */
export const POINT_FEEDBACK_TONE_WORDS = TONE_WORD;
