/**
 * FEEDBACK-001 (#898) — move-mark code contract (pure module).
 *
 * The single source of truth shared by the mark-move Edge Function AND its jest
 * contract test (__tests__/markMoveEdgeFunction.test.ts imports THIS file, the
 * _shared/markerCreate.ts precedent). It carries the five human-boolean mark
 * codes, the allow-list guard, and the mutually-exclusive pair helper the Edge
 * uses to keep a viewer out of both arms of the pair at once.
 *
 * Why this file exists: Edge Functions run on Deno with a separate module graph
 * and cannot import from src/. This module mirrors the authoritative rules:
 *   - MOVE_MARK_CODES mirrors the CHECK-valid move_marks.mark_code values shipped
 *     by migration 20260712000001 AND src/features/feedback/moveMarksModel.ts
 *     ALL_MOVE_MARK_CODES.
 *   - MUTUALLY_EXCLUSIVE_PAIR mirrors the model constant; oppositeMarkCode encodes
 *     that marking one arm retracts the other (paired mutual-exclusivity).
 *
 * Pure TypeScript. No Deno API, no Supabase, no network, no async, no mutation,
 * no console, no point-standing import. Comments are apostrophe-free for scanner
 * safety. Each code describes the MOVE, never the mover — no verdict token
 * appears in any code (ban-list asserted).
 */

// ── The five Output 9 human-boolean codes (matches the migration CHECK) ──

export const MOVE_MARK_CODES = [
  'addressed_my_point',
  'did_not_address',
  'receipts_requested',
  'good_receipt',
  'off_the_point',
] as const;

export type MoveMarkCode = (typeof MOVE_MARK_CODES)[number];

/** True iff code is one of the five verdict-free move-mark codes. */
export function isMoveMarkCode(code: string): code is MoveMarkCode {
  return (MOVE_MARK_CODES as ReadonlyArray<string>).includes(code);
}

// ── The mutually-exclusive pair (the ghost bar) ────────────────

/**
 * The two-arm pair a viewer can never be in at once: a move either answered the
 * viewer point or it did not. Marking one arm retracts the other (enforced in the
 * Edge). The other three codes are independent toggles.
 */
export const MUTUALLY_EXCLUSIVE_PAIR = ['addressed_my_point', 'did_not_address'] as const;

/** The opposite arm of the pair, or null when the code is not a paired code. */
export function oppositeMarkCode(code: MoveMarkCode): MoveMarkCode | null {
  if (code === 'addressed_my_point') return 'did_not_address';
  if (code === 'did_not_address') return 'addressed_my_point';
  return null;
}
