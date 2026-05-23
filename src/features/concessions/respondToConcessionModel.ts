/**
 * QOL-041 — Respond-to-concession mirrored-list model (pure TypeScript).
 *
 * The forced-list model for the QOL-030 `respond_to_concession` box. It
 * mirrors the incoming `concession_items` set ROW-FOR-ROW; the receiver
 * picks an `AcceptanceLevel` on each row and, on every non-`agree` row,
 * writes a required clarification body (QOL-041 design §1, §3 finding F2,
 * §5.2, §7.2).
 *
 * Doctrine anchors — read before changing anything (QOL-041 §11):
 *
 *   1. **Mirror EVERY incoming item — partial grading is forbidden in
 *      this card** (design §9 — "the box mirrors all incoming items and
 *      requires a level on every row before Post"). The receiver may not
 *      leave a row ungraded; if a future need for partial grading
 *      appears, it is a new card.
 *   2. **A non-`agree` level REQUIRES a clarification** (design §1 F3,
 *      §7.2). This is enforced HERE in `isPostable()`, in
 *      `submit-argument` (authoritative), and by the
 *      `clarification_required_unless_agree` CHECK on
 *      `concession_acceptances` (defense-in-depth).
 *   3. **A blocked Post is NEVER silent** (QOL-030 doctrine §10). The
 *      `firstDisabledReason` is the SINGLE visible reason the UI
 *      surfaces inline — plain-language prose, no internal codes.
 *   4. **No scoring math** (design §4, §11). The model stores only the
 *      receiver's stated level + clarification; it never produces a
 *      `PointStandingDelta`. The `acceptanceGradient` module owns the
 *      `ACCEPTANCE_TO_CONCESSION_EFFECT` vocabulary bridge a future
 *      stage will consume.
 *   5. **Deterministic + pure.** No `Date.now()`, no AI, no async, no
 *      network, no mutation of any input. Idempotent.
 *
 * Pure TS. No React. No Supabase. No network. No new dependency.
 */

import {
  acceptanceRequiresClarification,
  type AcceptanceLevel,
} from './acceptanceGradient';

// ── Limits ─────────────────────────────────────────────────────

/**
 * Maximum length of one clarification body, in chars. The migration
 * CHECK enforces `>= 1` (non-empty after trim) when non-`agree`; this
 * upper bound is a UI / payload-size guard. 4000 chars is generous —
 * a clarification is one rider, not a separate argument.
 */
export const MAX_CLARIFICATION_LENGTH = 4000;

// ── Incoming item shape ───────────────────────────────────────

/**
 * One incoming concession item the mirrored list mirrors. Comes from
 * `concession_items` rows attached to the conceding-party's `respond`
 * argument. The model uses only `id` (the row's UUID, becomes
 * `concession_item_id` on the posted acceptance) and `itemText` (the
 * read-only excerpt rendered on the row).
 *
 * `ordinal` is preserved so the receiver's mirrored list keeps the
 * conceding party's authored order — stable across reloads (the
 * migration's `unique (argument_id, ordinal)`).
 */
export interface IncomingConcessionItem {
  id: string;
  ordinal: number;
  itemText: string;
}

// ── Draft state ────────────────────────────────────────────────

/**
 * One mirrored row's draft state. The model holds the receiver's pick
 * + clarification draft per row, keyed by `concessionItemId` (the
 * incoming row's UUID).
 *
 * `level === null` means "the receiver has not picked yet" — the box
 * cannot be posted while any row is in this state (design §7.2 — "Pick
 * how you see this point"; the visible disabled reason).
 */
export interface RespondToConcessionRowDraft {
  /** The id of the incoming `concession_items` row this row mirrors. */
  concessionItemId: string;
  /** Receiver's pick. `null` until they choose. */
  level: AcceptanceLevel | null;
  /**
   * Clarification body draft. Empty until the user starts typing. The
   * field is HIDDEN in the UI when `level === 'agree'`; the model keeps
   * any prior text so a re-pick to a non-`agree` level does not silently
   * lose the user's typing (per QOL-030 D3 — switching is non-destructive).
   */
  clarification: string;
}

/**
 * The mirrored draft state. The rows array is in the same order as the
 * incoming `concession_items` set (oldest ordinal first). The model
 * never reorders the receiver's rows — the conceding party owns the
 * list's order.
 */
export interface RespondToConcessionDraft {
  /** One row per incoming item, in incoming-ordinal order. */
  rows: ReadonlyArray<RespondToConcessionRowDraft>;
}

/**
 * Builds the mirrored draft from an incoming set. Rows start with
 * `level: null` and an empty clarification. Incoming items are sorted by
 * `ordinal` ascending so the displayed order is stable; a tie-break on
 * `id` is added for determinism (the migration's unique index makes
 * ties impossible in practice — the tie-break is defensive).
 *
 * An EMPTY incoming set yields an empty mirrored draft (`isPostable`
 * returns `true` only for the trivial empty case — the box should
 * never open against a zero-item set, but the model is total).
 *
 * Pure. Total.
 */
export function buildRespondToConcessionDraft(
  incoming: ReadonlyArray<IncomingConcessionItem>,
): RespondToConcessionDraft {
  const sorted = [...incoming].sort((a, b) => {
    if (a.ordinal !== b.ordinal) return a.ordinal - b.ordinal;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return {
    rows: Object.freeze(
      sorted.map((it) =>
        Object.freeze<RespondToConcessionRowDraft>({
          concessionItemId: it.id,
          level: null,
          clarification: '',
        }),
      ),
    ),
  };
}

// ── Pure update helpers ───────────────────────────────────────

/**
 * Sets the receiver's level on one row, identified by
 * `concessionItemId`. Returns the input unchanged when no such row
 * exists (idempotent — repeat picks are safe).
 *
 * When the new level is `agree`, the clarification draft is PRESERVED
 * (a re-pick to a non-`agree` level should not lose the user's earlier
 * typing — QOL-030 D3 non-destructive). The UI hides the clarification
 * field when the level is `agree`; the persistence is purely a model
 * concern.
 */
export function setRowLevel(
  draft: RespondToConcessionDraft,
  concessionItemId: string,
  nextLevel: AcceptanceLevel,
): RespondToConcessionDraft {
  let mutated = false;
  const rows = draft.rows.map((r) => {
    if (r.concessionItemId !== concessionItemId) return r;
    if (r.level === nextLevel) return r;
    mutated = true;
    return Object.freeze<RespondToConcessionRowDraft>({
      concessionItemId: r.concessionItemId,
      level: nextLevel,
      clarification: r.clarification,
    });
  });
  if (!mutated) return draft;
  return { rows: Object.freeze(rows) };
}

/**
 * Sets the clarification text on one row. Returns the input unchanged
 * when no such row exists OR when the proposed text exceeds
 * `MAX_CLARIFICATION_LENGTH` (the cap is enforced HERE so the UI
 * cannot push past it).
 *
 * The text is kept RAW (not trimmed) so the UI renders what the user
 * typed; the postability check + Edge Function trim before validating.
 */
export function setRowClarification(
  draft: RespondToConcessionDraft,
  concessionItemId: string,
  nextText: string,
): RespondToConcessionDraft {
  if (typeof nextText !== 'string') return draft;
  if (nextText.length > MAX_CLARIFICATION_LENGTH) return draft;
  let mutated = false;
  const rows = draft.rows.map((r) => {
    if (r.concessionItemId !== concessionItemId) return r;
    if (r.clarification === nextText) return r;
    mutated = true;
    return Object.freeze<RespondToConcessionRowDraft>({
      concessionItemId: r.concessionItemId,
      level: r.level,
      clarification: nextText,
    });
  });
  if (!mutated) return draft;
  return { rows: Object.freeze(rows) };
}

// ── Postability check (the validation block, §7.2) ────────────

/**
 * Why the box cannot be posted. The reasons are PLAIN-LANGUAGE prose —
 * they appear directly in the box's inline "single visible reason"
 * affordance. Order corresponds to the precedence the UI surfaces:
 * unpicked rows first (the user must respond to every point), then
 * missing clarifications.
 *
 * - `row_unpicked`        — at least one row has `level: null`
 * - `clarification_empty` — at least one non-`agree` row has an
 *                           empty / whitespace-only clarification
 */
export type RespondToConcessionBlockingReason =
  | 'row_unpicked'
  | 'clarification_empty';

export interface RespondToConcessionPostability {
  postable: boolean;
  reasons: ReadonlyArray<RespondToConcessionBlockingReason>;
  /**
   * The first plain-language reason to render in the "single visible
   * reason" line. `null` when `postable`.
   */
  firstDisabledReason: string | null;
}

const FIRST_DISABLED_REASON_BY_BLOCKING: Readonly<
  Record<RespondToConcessionBlockingReason, string>
> = Object.freeze({
  row_unpicked: 'Respond to every conceded point first.',
  clarification_empty: 'Explain why you disagree on each point.',
});

/**
 * Returns whether the mirrored-list box is postable RIGHT NOW.
 *
 * A box is postable iff:
 *   - The mirrored list is non-empty (an empty list is structurally a
 *     no-op; the box should not have opened against zero items).
 *   - EVERY row has a `level !== null`.
 *   - EVERY non-`agree` row has a trimmed clarification of length ≥ 1.
 *
 * Reasons are returned in priority order so the UI surfaces "pick
 * first" before "explain why" — the user can only land on the
 * clarification problem AFTER picking a non-`agree` level. Pure. Total.
 */
export function isPostable(
  draft: RespondToConcessionDraft,
): RespondToConcessionPostability {
  const reasons: RespondToConcessionBlockingReason[] = [];
  if (draft.rows.length === 0) {
    // An empty mirrored list is not postable — the box should never have
    // opened against a zero-item set, but the model is total.
    return {
      postable: false,
      reasons: Object.freeze<RespondToConcessionBlockingReason[]>(['row_unpicked']),
      firstDisabledReason: FIRST_DISABLED_REASON_BY_BLOCKING.row_unpicked,
    };
  }
  let sawUnpicked = false;
  let sawEmptyClarification = false;
  for (const r of draft.rows) {
    if (r.level === null && !sawUnpicked) {
      reasons.push('row_unpicked');
      sawUnpicked = true;
      continue;
    }
    if (
      r.level !== null
      && acceptanceRequiresClarification(r.level)
      && r.clarification.trim().length === 0
      && !sawEmptyClarification
    ) {
      reasons.push('clarification_empty');
      sawEmptyClarification = true;
    }
  }
  if (reasons.length === 0) {
    return {
      postable: true,
      reasons: Object.freeze<RespondToConcessionBlockingReason[]>([]),
      firstDisabledReason: null,
    };
  }
  return {
    postable: false,
    reasons: Object.freeze(reasons),
    firstDisabledReason: FIRST_DISABLED_REASON_BY_BLOCKING[reasons[0]],
  };
}

// ── Payload shape ──────────────────────────────────────────────

/**
 * One row of the `concession_acceptances[]` payload the Edge Function
 * inserts in-transaction with the receiver's `respond_to_concession`
 * argument. The clarification is TRIMMED (the migration CHECK trims).
 */
export interface ConcessionAcceptancePayload {
  concession_item_id: string;
  acceptance_level: AcceptanceLevel;
  clarification_body: string;
}

/**
 * Builds the `concession_acceptances[]` payload from a postable draft.
 * Throws when the draft is NOT postable — callers must check
 * `isPostable` first; this is a defensive guard so a buggy caller
 * cannot ship a half-filled set. Trims the clarification (the migration
 * CHECK trims; this matches).
 *
 * For `agree` rows the clarification body is `''` (the CHECK allows
 * empty when level is `agree`).
 */
export function buildConcessionAcceptancesPayload(
  draft: RespondToConcessionDraft,
): ReadonlyArray<ConcessionAcceptancePayload> {
  const postability = isPostable(draft);
  if (!postability.postable) {
    throw new Error(
      `buildConcessionAcceptancesPayload: draft is not postable (${
        postability.reasons.join(',') || 'no_rows'
      })`,
    );
  }
  return Object.freeze(
    draft.rows.map((r) => {
      // Postability guarantees level !== null here.
      const level = r.level as AcceptanceLevel;
      return {
        concession_item_id: r.concessionItemId,
        acceptance_level: level,
        clarification_body:
          level === 'agree' ? '' : r.clarification.trim(),
      };
    }),
  );
}
