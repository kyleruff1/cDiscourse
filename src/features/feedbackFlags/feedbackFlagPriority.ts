/**
 * UX-FLAGS-003 — Feedback-flag priority + suppression cap (pure TypeScript).
 *
 * With many machine observations resident on a single point, something must
 * choose the 1–3 to surface. This module is that DISPLAY BUDGET: it takes the
 * #851 adapter's uncapped, input-ordered `PointFeedbackFlagViewModel[]` and
 * returns a small object — a priority-ordered `visible` slice (length <= cap)
 * plus a `suppressedCount`. The #851 adapter deliberately applies no cap / no
 * rank (see its `// #835 owns the cap/priority` seam comment); this module is
 * the downstream owner of exactly that policy.
 *
 * Selection DISCIPLINE mirrors `refereeBanners/selectBanner.ts` (a fixed
 * priority constant, a stable tie-break by input order, suppress-the-rest,
 * deterministic same-in→same-out) — NOT its code. Here the tier key is the
 * view model's `tone`; the shipped #850 descriptor table makes `tone` a
 * faithful proxy for actionability (every named positive is `actionable:false`,
 * every prompt descriptor is `actionable:true`), so re-threading a separate
 * `actionable` flag is unnecessary and out of scope.
 *
 * What this module does NOT do:
 *  - It authors NO user-facing strings. It only reorders + slices existing view
 *    models; every surviving element is the SAME frozen reference from the
 *    input (no copy, no mutation, no relabel).
 *  - It does NOT touch #850 descriptor content or the #851 suppression
 *    semantics (Family J / clientSuppressed / own-bubble stay upstream).
 *  - No provider / network / Supabase / React. Pure, deterministic,
 *    JSON-serializable in/out.
 *
 * Doctrine anchors (cdiscourse-doctrine):
 *  - §1  Advisory only. Priority is an internal display budget — never surfaced
 *        as importance / severity / score. This module emits no copy at all.
 *  - §3  `neverGrantsStanding` is passed through untouched on the surviving view
 *        models; it is never converted into standing / credit language here.
 *  - Composer-safety invariant: composer-time (pre-send) nudges are separate and
 *        excluded entirely upstream (Family J never reaches this layer), so
 *        capping the POST-STORAGE display list can never hide a pre-send nudge.
 */

import type { PointFeedbackFlagViewModel } from './pointFeedbackFlagsModel';
import type { FriendlyFlagTone } from './friendlyFlagMap';

/** Default number of feedback flags surfaced per point. Never exceeded. */
export const DEFAULT_VISIBLE_FLAG_CAP = 3;

/** Floor for a caller-supplied cap. At least one flag is always considered. */
export const MIN_VISIBLE_FLAG_CAP = 1;

/**
 * The result of prioritising a point's feedback flags: a frozen priority-ordered
 * `visible` slice (length <= resolved cap) and the count of flags suppressed to
 * respect the cap.
 */
export interface PrioritizedPointFeedbackFlags {
  /** Priority order, length <= resolved cap, frozen. Same references as input. */
  visible: ReadonlyArray<PointFeedbackFlagViewModel>;
  /** `max(0, inputLength - visible.length)`. Drives the quiet "+N more" count. */
  suppressedCount: number;
}

/**
 * Tier rank per tone (lower wins). Actionable-positive first, then
 * actionable-prompt, then descriptive; an unknown / malformed tone sorts last
 * (defensive — never throws). Mirrors the fixed-priority-constant discipline of
 * `BANNER_CATEGORY_PRIORITY`.
 */
const TIER_RANK: Readonly<Record<FriendlyFlagTone, number>> = Object.freeze({
  positive: 0,
  prompt: 1,
  descriptive: 2,
});

/** The rank a tone outside the known union sorts to (last, never throws). */
const UNKNOWN_TONE_RANK = 3;

/** Read the tier rank for a view model's tone, defaulting unknown → last. */
function tierRankOf(vm: PointFeedbackFlagViewModel): number {
  const rank = TIER_RANK[vm.tone];
  return typeof rank === 'number' ? rank : UNKNOWN_TONE_RANK;
}

/**
 * Resolve a caller-supplied cap into `[MIN_VISIBLE_FLAG_CAP, DEFAULT_VISIBLE_FLAG_CAP]`.
 *
 *  - `undefined` / `NaN` / non-finite → `DEFAULT_VISIBLE_FLAG_CAP` (3).
 *  - otherwise `min(3, max(1, floor(cap)))`.
 *
 * The cap can never resolve above 3 — there is no uncapped render path.
 */
export function resolveVisibleFlagCap(cap?: number): number {
  if (typeof cap !== 'number' || !Number.isFinite(cap)) {
    return DEFAULT_VISIBLE_FLAG_CAP;
  }
  return Math.min(
    DEFAULT_VISIBLE_FLAG_CAP,
    Math.max(MIN_VISIBLE_FLAG_CAP, Math.floor(cap)),
  );
}

/** One input flag decorated with its original index for the stable tie-break. */
interface Decorated {
  vm: PointFeedbackFlagViewModel;
  i: number;
}

/**
 * Prioritise + cap a point's feedback flags.
 *
 * Order: tier rank ascending (positive → prompt → descriptive → unknown), ties
 * broken by ORIGINAL input index (never id / label / family). Implemented with
 * an index-decorated sort so engine sort-stability is never relied upon. The
 * `visible` slice is frozen and its elements are the same references as the
 * input — no copy, no mutation, no relabel.
 *
 * Non-array / null / undefined → `{ visible: [], suppressedCount: 0 }`.
 */
export function prioritizePointFeedbackFlags(
  flags: ReadonlyArray<PointFeedbackFlagViewModel> | null | undefined,
  cap?: number,
): PrioritizedPointFeedbackFlags {
  const resolvedCap = resolveVisibleFlagCap(cap);

  if (!Array.isArray(flags) || flags.length === 0) {
    return Object.freeze({ visible: Object.freeze([]), suppressedCount: 0 });
  }

  const decorated: Decorated[] = flags.map((vm, i) => ({ vm, i }));
  decorated.sort((a, b) => {
    const ra = tierRankOf(a.vm);
    const rb = tierRankOf(b.vm);
    if (ra !== rb) return ra - rb;
    // Stable tie-break: original input order.
    return a.i - b.i;
  });

  const visible = Object.freeze(
    decorated.slice(0, resolvedCap).map((d) => d.vm),
  );
  const suppressedCount = Math.max(0, flags.length - visible.length);

  return Object.freeze({ visible, suppressedCount });
}
