/**
 * QOL-041 — Move-reactions (fist-bump) model (pure TypeScript).
 *
 * The fist-bump is the ONE allowed reaction in v1 because it carries NO
 * SCORE, NO VERDICT, NO STANDING CHANGE. It is a human "I hear you" beat
 * — a partial-resolution affordance the receiver taps to acknowledge a
 * move without taking a gameplay action (QOL-041 design §1, §3 finding
 * F5, §5.4, §7.3).
 *
 * Doctrine anchors — read before changing anything (QOL-041 §11):
 *
 *   1. **One value in `MoveReactionKind`. Forever (in v1).** The
 *      vocabulary is a SINGLE literal — `fist_bump`. The
 *      `move_reactions.kind` CHECK has the same single value. Adding an
 *      up/down/like/heart/laugh value would require a NEW migration AND
 *      a doctrine review (v1 scope bans voting/scoring; the schema is
 *      structurally incapable of becoming a vote tally — see §11).
 *   2. **No score path.** `summarizeReactions` returns only a count + a
 *      per-viewer boolean for RENDERING. There is no path from a
 *      reaction row to a `PointStandingDelta`. The anti-amplification
 *      doctrine (engagement ≠ evidence) is respected structurally —
 *      this module never imports `pointStanding`.
 *   3. **Count is render-time-derived from row count, never stored**
 *      (design §5.4 — "A fist-bump count may be RENDERED but is
 *      computed at read time from row count, never stored, and never
 *      feeds standing").
 *   4. **Pure.** No `Date.now()`, no AI, no async, no network, no
 *      mutation of any input. Idempotent.
 */

// ── Reaction vocabulary ────────────────────────────────────────

/**
 * The single allowed reaction kind. The literal is duplicated as a
 * `string` literal in the migration CHECK and as a `string` in the
 * `react-to-move` Edge Function payload check; tests confirm the three
 * stay in lockstep. NO additional value may be added in v1.
 */
export type MoveReactionKind = 'fist_bump';

/** Frozen array — one entry. Tests confirm the length is exactly 1. */
export const ALL_MOVE_REACTION_KINDS: ReadonlyArray<MoveReactionKind> = Object.freeze([
  'fist_bump',
]);

// ── Row shape ──────────────────────────────────────────────────

/**
 * One `move_reactions` row, as the summarizer sees it. Only the fields
 * the renderer needs are exposed; `id`, `created_at` and other admin
 * fields are intentionally omitted (the summarizer is render-only).
 *
 * `removedAt` is `null` when the row is active and a non-empty string
 * when soft-deleted. The summarizer ignores soft-deleted rows.
 */
export interface MoveReactionRow {
  kind: MoveReactionKind;
  reactorId: string;
  removedAt: string | null;
}

// ── Render-only summary ────────────────────────────────────────

/**
 * The render-only summary the fist-bump affordance displays. Per design
 * §5.4 / §7.3:
 *
 *   - `fistBumpCount`     — count of ACTIVE fist-bump rows on the move.
 *                           Used to render the optional tiny "·N"
 *                           indicator next to the affordance label
 *                           (design §15 Q5 default). Never stored.
 *   - `viewerHasReacted`  — whether the supplied viewer id has an
 *                           ACTIVE fist-bump on the move. Drives the
 *                           toggled / not-toggled UI state.
 *
 * The summary has NO score, NO standing, NO weight, NO percentage.
 */
export interface MoveReactionSummary {
  fistBumpCount: number;
  viewerHasReacted: boolean;
}

/**
 * Summarizes a move's reaction rows for rendering. ONLY active rows
 * (`removedAt === null`) are counted; soft-deleted rows are ignored.
 *
 * A row with an unknown `kind` (defensive — should not occur given the
 * single-value enum + CHECK constraint) is ignored. A row with the same
 * `reactorId` as `viewerId` flips `viewerHasReacted` true. The
 * `fistBumpCount` includes the viewer's own row (it is what would
 * render — the affordance shows the total).
 *
 * `viewerId` may be `null` (an unauthenticated viewer or one not yet
 * resolved); in that case `viewerHasReacted` is always `false`.
 *
 * Pure. Total. Returns the same shape for the same input.
 */
export function summarizeReactions(
  rows: ReadonlyArray<MoveReactionRow>,
  viewerId: string | null,
): MoveReactionSummary {
  let fistBumpCount = 0;
  let viewerHasReacted = false;
  for (const row of rows) {
    if (row.removedAt !== null) continue;
    if (row.kind !== 'fist_bump') continue;
    fistBumpCount += 1;
    if (viewerId !== null && row.reactorId === viewerId) {
      viewerHasReacted = true;
    }
  }
  return { fistBumpCount, viewerHasReacted };
}
