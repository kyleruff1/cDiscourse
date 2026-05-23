/**
 * MCP-MOD-007 — Move-position tracking helper.
 *
 * Derives whether a just-posted (or about-to-be-posted) move is the FIRST,
 * SECOND, or LATER move by its author in the debate. The classification is
 * participant-scoped: it counts moves by `authorId` only, ignoring everyone
 * else. A chime-in participant's first contribution is therefore `'first'`
 * regardless of how many moves the primary participants have made before them.
 *
 * This module is PURE TYPESCRIPT — no network, no React, no Supabase,
 * no `Deno`, no env, no `async`. It is not yet wired into any caller;
 * MCP-MOD-008 will consume it inside `evaluateTrigger` to gate classification.
 *
 * Doctrine:
 *   - The helper performs counting only. It never produces a verdict, a truth
 *     value, a winner / loser label, or a person-label of any kind.
 *   - The caller is responsible for assembling `priorMoves` from the room
 *     state. The helper does NOT talk to Supabase.
 *   - The caller is responsible for NOT including the move under
 *     classification inside `priorMoves`. The helper counts authors, not ids;
 *     if the caller accidentally double-counts by including the move itself,
 *     the result will reflect that count truthfully (this card's tests pin
 *     the contract — the caller's hygiene is its own responsibility).
 */

export type MovePosition = 'first' | 'second' | 'later';

export interface MovePositionInput {
  /** The just-posted (or about-to-be-posted) move's id. */
  moveId: string;
  /** The move's author id. */
  authorId: string;
  /** Every move already posted in the room, in chronological order, with author + id. */
  priorMoves: ReadonlyArray<{ id: string; authorId: string }>;
}

/**
 * Derive whether `moveId` is the author's first, second, or later move in the room.
 *
 * - 'first'  — no prior move in `priorMoves` is by `authorId`.
 * - 'second' — exactly one prior move in `priorMoves` is by `authorId`.
 * - 'later'  — two or more prior moves in `priorMoves` are by `authorId`.
 *
 * `priorMoves` does NOT include the move being classified — the caller separates them.
 */
export function getMovePositionForAuthor(input: MovePositionInput): MovePosition {
  let priorCount = 0;
  for (const prior of input.priorMoves) {
    if (prior.authorId === input.authorId) {
      priorCount += 1;
      if (priorCount >= 2) {
        // Short-circuit: once we've seen two prior author moves we are already in 'later'.
        return 'later';
      }
    }
  }
  if (priorCount === 0) return 'first';
  if (priorCount === 1) return 'second';
  return 'later';
}
