/**
 * ARG-ROOM-002 — pure-TS preview twin of the server capacity enforcement.
 *
 * Pure TypeScript. No React, no Supabase, no network, no async, no clock, no
 * randomness — so the create surface and the seat strip can preview "Full" /
 * "3 open seats" without a round-trip, while the SQL layer stays authoritative
 * for enforcement. This file is the client-side twin of:
 *
 *   - `room_active_seat_cap(uuid)`  (migration 20260613000001) — the derived cap.
 *   - `enforce_room_capacity()`     (migration 20260613000001) — the BEFORE INSERT
 *     trigger whose join check is `active + reserved + 1 <= cap`.
 *
 * Single source of truth for the caps: this module IMPORTS
 * `PUBLIC_ACTIVE_PARTICIPANT_CAP` / `PRIVATE_ACTIVE_PARTICIPANT_CAP` from the
 * ARG-ROOM-001 matrix (which itself imports `PUBLIC_ROOM_SEAT_CAP` /
 * `PRIMARY_SEAT_COUNT` from `publicSeatModel`) rather than authoring a second
 * literal. A parity test pins `roomActiveSeatCap('public') === 5` /
 * `('private') === 2` and pins these helpers against the matrix for every row,
 * so the 6 -> 5 reconciliation and the binding matrix cannot half-land.
 *
 * Doctrine: capacity is STRUCTURAL availability (how many active seats a room
 * can hold), never a verdict on a person and never an input from heat /
 * popularity. Observers are not active participants and are never capped.
 */

import {
  PUBLIC_ACTIVE_PARTICIPANT_CAP,
  PRIVATE_ACTIVE_PARTICIPANT_CAP,
  MAX_DIRECT_INVITES_AT_CREATION,
} from './argumentRoomCreationMatrix';
import type {
  ArgumentRoomVisibility,
  ArgumentRoomCapacity,
} from './argumentRoomCreationMatrix';

/**
 * The derived active-participant cap for a room — the pure twin of the SQL
 * `room_active_seat_cap`. Private rooms are 1v1 (2), public rooms cap at 5.
 * Anything other than `'private'` is treated as public (mirrors the server's
 * visibility CHECK + the matrix normalisation).
 */
export function roomActiveSeatCap(
  visibility: ArgumentRoomVisibility,
): ArgumentRoomCapacity {
  return visibility === 'private'
    ? PRIVATE_ACTIVE_PARTICIPANT_CAP
    : PUBLIC_ACTIVE_PARTICIPANT_CAP;
}

/**
 * Is this a valid room to create, given the chosen visibility and the COUNT of
 * direct invites? The structural matrix rule (count-only twin of the SQL RPC's
 * `private => invite` + the one-invite-per-room index):
 *
 *   - private requires EXACTLY one invite  (0 -> invalid, 1 -> valid)
 *   - public is valid with 0 or 1 invite
 *   - any visibility with > 1 invite is invalid (max one direct invite)
 *
 * The ARG-ROOM-001 `deriveArgumentRoomCreation` is the full, email-aware
 * validator; this is the seat-math twin used for instant UI preview. A parity
 * test pins the two together for every matrix row.
 */
export function isCreationValid(
  visibility: ArgumentRoomVisibility,
  directInvites: number,
): boolean {
  if (!Number.isInteger(directInvites) || directInvites < 0) return false;
  if (directInvites > MAX_DIRECT_INVITES_AT_CREATION) return false;
  if (visibility === 'private') return directInvites === 1;
  return true; // public: 0 or 1 invite
}

/**
 * Self-claimable open active slots remaining immediately after creation:
 * `cap - 1 (creator) - directInvites (reserved)`, clamped at 0. Returns 0 for
 * any invalid creation (mirrors the matrix zeroing seat fields on a reject).
 * For the four valid matrix rows this yields 4 / 3 / 0 exactly.
 */
export function openSlotsAfterCreate(
  visibility: ArgumentRoomVisibility,
  directInvites: number,
): number {
  if (!isCreationValid(visibility, directInvites)) return 0;
  const cap = roomActiveSeatCap(visibility);
  return Math.max(0, cap - 1 - directInvites);
}

/**
 * Can one more ACTIVE participant take a seat, given the current active count,
 * the reserved (live pending) invite count, and the room's cap? The exact pure
 * twin of the SQL trigger's join check `active + reserved + 1 <= cap`. Used by
 * the seat strip to render "Full" vs "N open seats". Negative / non-finite
 * inputs are treated as 0 (defensive; the SQL counts are always >= 0).
 */
export function canJoinActive(
  activeCount: number,
  reservedInvites: number,
  cap: number,
): boolean {
  const active = Number.isFinite(activeCount) ? Math.max(0, activeCount) : 0;
  const reserved = Number.isFinite(reservedInvites) ? Math.max(0, reservedInvites) : 0;
  return active + reserved + 1 <= cap;
}
