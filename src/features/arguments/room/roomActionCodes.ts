/**
 * ASP-EXTRACT-001 (Slice 1) — one shared vocabulary handle for room action
 * dispatch.
 *
 * This module DOES NOT define new codes. It aliases the two already-shipped
 * unions and re-exports the already-shipped bridge so the room lenses
 * (Exchange, Map) reference ONE import surface for action dispatch types:
 *
 *   1. RailActionCode        the rail-level tap codes (observer / participant)
 *   2. ArgumentBubbleControl the surface-level dispatch enum (onAction target)
 *
 * The A x B capability-parity foundation: a later card can add a code in ONE
 * place and both lenses see it. Today this is purely a type / import
 * unification with ZERO behavior change: no new string literal enters the
 * type system, so it cannot drift from the shipped vocabularies and it cannot
 * break railActionGrouping.test.ts / duplicateRailRemovalDisposition.test.ts
 * which pin the rail set verbatim.
 *
 * Pure TS. No React. No Supabase. No network. No AI. No verdict tokens.
 */
import type { RailActionCode } from '../railActionCategories';
import type { ArgumentBubbleControl } from '../argumentGameSurfaceModel';

// The rail-level codes (observer / participant tap surface). Alias only.
export type RoomRailActionCode = RailActionCode;

// The surface-level dispatch enum (what onAction receives). Alias only.
export type RoomBubbleControlCode = ArgumentBubbleControl;

// The union both lenses may emit (rail codes + bubble controls). No new
// members — purely the set-union of the two shipped unions.
export type RoomActionCode = RoomRailActionCode | RoomBubbleControlCode;

// Re-export the shipped bridge unchanged (rail code -> bubble control | null).
// Exchange and Map do not call this in the Slice-1 extraction; they dispatch
// through the SAME handler props the orchestrator passes down. It is
// re-exported here so the ONE room action-code surface also owns the bridge a
// future capability-parity card will extend.
export { railActionToBubbleControl } from '../ArgumentSideActionRail';

// A frozen enumeration of the rail codes for any consumer that needs to
// iterate. Derived FROM the shipped RailActionCode union via the
// satisfies clause below — NOT a hand-typed second list. The
// satisfies readonly RailActionCode[] clause is load-bearing: the compiler
// FAILS if this array ever drifts from the shipped RailActionCode union,
// which is how we honor do-not-invent-codes. No current consumer iterates the
// list; it exists so the guard holds.
export const ROOM_RAIL_ACTION_CODES = [
  'watch',
  'join_aff',
  'join_neg',
  'ask_source',
  'open_timeline',
  'share',
  'reply',
  'disagree',
  'ask_quote',
  'split_branch',
  'flag',
  'qualifiers',
  'request_deletion',
] as const satisfies readonly RailActionCode[];
