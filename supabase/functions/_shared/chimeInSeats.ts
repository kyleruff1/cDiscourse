/**
 * CHIMEIN-P8 Round 2 (#761) -- shared chime-in seat constants + free-seat picker.
 *
 * Pure module (no Deno, no network, no supabase import) so jest can import it for
 * real behavioral coverage -- the moveMarkCodes.ts precedent. One source of truth
 * for the room-level chime capacity: seats 1..3, mirroring GAME-005
 * (PUBLIC_ROOM_SEAT_CAP 5 - PRIMARY_SEAT_COUNT 2 = 3). The DB partial UNIQUE on
 * active (debate_id, seat_index) is the atomic authority; this picker is only the
 * Edge-side lowest-free chooser and its cross-boundary parity with the client
 * GAME-005 derivation is pinned by a test.
 *
 * A chime-in is a bounded contribution seat, never a third principal voice and
 * never a node structural state. This module carries no verdict, no score, no
 * standing -- it counts seats.
 *
 * Comments are apostrophe-free (the uxOneOneTwoDoctrine quote-parity gotcha).
 */

/** The lowest chime seat index (1-based). */
export const CHIME_IN_SEAT_MIN = 1;

/** The highest chime seat index. Room-level cap ceiling = 3 (GAME-005). */
export const CHIME_IN_SEAT_MAX = 3;

/** All valid chime seat indices in ascending order. */
export const CHIME_IN_SEAT_INDICES: ReadonlyArray<number> = Object.freeze([1, 2, 3]);

/** Room-level chime capacity (count of seats). Equals GAME-005 chime capacity. */
export const CHIME_IN_SEAT_CAP = CHIME_IN_SEAT_INDICES.length;

/** True when n is a valid 1..3 chime seat index. */
export function isChimeSeatIndex(n: unknown): n is number {
  return (
    typeof n === 'number' &&
    Number.isInteger(n) &&
    n >= CHIME_IN_SEAT_MIN &&
    n <= CHIME_IN_SEAT_MAX
  );
}

/**
 * The lowest free chime seat index given the currently-used indices, or null
 * when every seat 1..3 is taken (the seats_full state). Out-of-range used values
 * are ignored. Deterministic -- the Edge inserts the lowest free index so two
 * concurrent inserts collide on the partial UNIQUE and one is retried.
 */
export function lowestFreeChimeSeatIndex(usedIndices: ReadonlyArray<number>): number | null {
  const used = new Set(usedIndices.filter(isChimeSeatIndex));
  for (const idx of CHIME_IN_SEAT_INDICES) {
    if (!used.has(idx)) return idx;
  }
  return null;
}

/**
 * Count of free chime seats given the count of active chime-ins (clamped 0..3).
 * A non-positive / non-finite count reads as an empty room (all seats free).
 */
export function openChimeSeatCount(activeCount: number): number {
  if (typeof activeCount !== 'number' || !Number.isFinite(activeCount) || activeCount <= 0) {
    return CHIME_IN_SEAT_CAP;
  }
  return Math.max(0, CHIME_IN_SEAT_CAP - Math.floor(activeCount));
}
