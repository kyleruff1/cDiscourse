/**
 * FEEDBACK-001 (#898) — move-marks model (pure TypeScript).
 *
 * A move-mark is the one cheap HUMAN signal the pipeline was missing: is this
 * exchange connecting? A viewer taps a quiet ghost button under an opponent move
 * ("Answered my point" / "Didn't answer it"), one tap, reversible. Each mark is a
 * structural observation about the MOVE, never a verdict on the mover
 * (cdiscourse-doctrine sections 1 and 10a) and NEVER a score.
 *
 * Doctrine anchors — read before changing anything:
 *
 *   1. **Five codes. Each describes the MOVE.** The vocabulary is the five
 *      Output 9 human-boolean codes; the same five are the move_marks.mark_code
 *      CHECK and the Edge _shared/moveMarkCodes.ts allow-list. A ban-list test
 *      asserts no code carries a verdict / person token.
 *   2. **No score path.** This module returns only the viewer's own active-mark
 *      booleans for RENDERING. There is no path from a mark row to a
 *      PointStandingDelta. The anti-amplification doctrine (engagement is not
 *      evidence) is respected structurally — this module imports no pointStanding.
 *   3. **Retract is a timestamp, never a delete** (retractedAt). The summarizer
 *      ignores retracted rows.
 *   4. **Pure.** No Date.now(), no AI, no async, no network, no mutation of any
 *      input. Idempotent.
 */

// ── Mark vocabulary (mirrors the migration CHECK + the Edge allow-list) ──

export type MoveMarkCode =
  | 'addressed_my_point'
  | 'did_not_address'
  | 'receipts_requested'
  | 'good_receipt'
  | 'off_the_point';

/** Frozen array — exactly five entries. Tests confirm the length + membership. */
export const ALL_MOVE_MARK_CODES: ReadonlyArray<MoveMarkCode> = Object.freeze([
  'addressed_my_point',
  'did_not_address',
  'receipts_requested',
  'good_receipt',
  'off_the_point',
]);

/**
 * The one pair a viewer can never be in at once: a move either answered the
 * viewer's point or it did not. Marking one arm retracts the other (the Edge is
 * the authority; the bar clears the opposite optimistically). The other three
 * codes are independent toggles.
 */
export const MUTUALLY_EXCLUSIVE_PAIR = ['addressed_my_point', 'did_not_address'] as const;

/** The opposite arm of the pair, or null when the code is not a paired code. */
export function oppositeOf(code: MoveMarkCode): MoveMarkCode | null {
  if (code === 'addressed_my_point') return 'did_not_address';
  if (code === 'did_not_address') return 'addressed_my_point';
  return null;
}

/** True iff code is one of the five verdict-free move-mark codes. */
export function isMoveMarkCode(code: string): code is MoveMarkCode {
  return (ALL_MOVE_MARK_CODES as ReadonlyArray<string>).includes(code);
}

// ── Row shape ──────────────────────────────────────────────────

/**
 * One move_marks row, as the summarizer / aggregate sees it. Only the fields the
 * renderer needs are exposed; `id`, `debateId`, `createdAt` are omitted (this is a
 * render-only projection). `retractedAt` is `null` when active and a non-empty
 * string when retracted. The summarizer ignores retracted rows.
 */
export interface MoveMarkRow {
  argumentId: string;
  markCode: MoveMarkCode;
  markedBy: string;
  retractedAt: string | null;
}

// ── Viewer's own state on ONE move ─────────────────────────────

/** This viewer's active marks on ONE move. Every code is present; each a boolean. */
export type ViewerMoveMarkState = { [K in MoveMarkCode]: boolean };

/** The all-false state (no marks). Fresh object each call — never a shared ref. */
export function emptyViewerMoveMarkState(): ViewerMoveMarkState {
  return {
    addressed_my_point: false,
    did_not_address: false,
    receipts_requested: false,
    good_receipt: false,
    off_the_point: false,
  };
}

/**
 * Summarize a viewer's ACTIVE marks on ONE move. Only active rows
 * (`retractedAt === null`) whose `argumentId` matches AND whose `markedBy`
 * matches `viewerId` flip their code true. An unknown `markCode` (defensive —
 * should not occur given the enum + CHECK) is ignored. `viewerId` may be `null`
 * (unauthenticated / unresolved viewer); in that case every code is false.
 *
 * Pure. Total. Returns a fresh object for the same input.
 */
export function summarizeViewerMarks(
  rows: ReadonlyArray<MoveMarkRow>,
  argumentId: string,
  viewerId: string | null,
): ViewerMoveMarkState {
  const state = emptyViewerMoveMarkState();
  if (viewerId === null) return state;
  for (const row of rows) {
    if (row.retractedAt !== null) continue;
    if (row.argumentId !== argumentId) continue;
    if (row.markedBy !== viewerId) continue;
    if (!isMoveMarkCode(row.markCode)) continue;
    state[row.markCode] = true;
  }
  return state;
}
