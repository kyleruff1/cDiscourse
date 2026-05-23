/**
 * Shared domain-type barrel.
 *
 * CLAUDE.md's TypeScript conventions name `src/lib/types.ts` as the home
 * for cross-feature domain types. Most domain types in this codebase live
 * in per-feature `types.ts` files (`src/features/<x>/types.ts`); this
 * barrel re-exports the types that are genuinely cross-feature so a
 * consumer outside the owning feature has a single, stable import.
 *
 * It is intentionally a re-export surface — the type DEFINITIONS stay in
 * their owning module so there is exactly one source of truth.
 */

// ── QOL-042 — cross-room argument links ────────────────────────

/**
 * `ArgumentRoomLink` — one row of `public.argument_room_links`: a
 * one-directional, immutable reference from a source (new) argument room
 * to a prior, settled room (QOL-042). Defined in the owning model module;
 * re-exported here as a cross-feature domain type.
 */
export type { ArgumentRoomLink } from '../features/arguments/crossRoom/linkedPriorArgumentModel';

// ── QOL-041 — Concession list + acceptance gradient + reactions ────

/**
 * `AcceptanceLevel` — one of the 5 levels the receiver picks on each
 * mirrored concession-item row in the `respond_to_concession` box. The
 * vocabulary verbatim from `concession_acceptances.acceptance_level`
 * (QOL-041 design §5.2). Re-exported here as a cross-feature domain type.
 */
import type { AcceptanceLevel } from '../features/concessions/acceptanceGradient';
export type { AcceptanceLevel };

/**
 * `MoveReactionKind` — the single allowed reaction in v1 (`fist_bump`).
 * Mirrors the `move_reactions.kind` CHECK (QOL-041 design §5.4). Re-
 * exported here as a cross-feature domain type. Adding a value to the
 * union requires a NEW migration AND a doctrine review (v1 scope bans
 * voting/scoring).
 */
import type { MoveReactionKind } from '../features/concessions/moveReactionModel';
export type { MoveReactionKind };

/**
 * `ConcessionItem` — one row of `public.concession_items`: a single
 * conceded point attached to the conceding party's `respond` argument
 * (QOL-041 design §5.1). Cross-feature row interface; defined here as a
 * pure shape (no Supabase row coupling) — the gallery / room loaders cast
 * the DB-row shape onto this interface.
 */
export interface ConcessionItem {
  /** Row id (UUID). */
  id: string;
  /** Room the item lives in. */
  debateId: string;
  /** The response argument whose concession SECTION this item belongs to. */
  argumentId: string;
  /** The node this concession concedes a point TO (the parent being responded to). */
  concededToArgumentId: string;
  /** profiles.id of the conceding-party author. */
  authorId: string;
  /** 0-based ordinal within the response argument's concession set. */
  ordinal: number;
  /** The point text (1..600 chars, defended at the migration CHECK). */
  itemText: string;
  /** ISO timestamp when the row was soft-deleted; null = active. */
  removedAt: string | null;
  /** profiles.id of the soft-delete actor; null when not soft-deleted. */
  removedBy: string | null;
  /** ISO timestamp of the row's creation (default now()). */
  createdAt: string;
}

/**
 * `ConcessionAcceptance` — one row of `public.concession_acceptances`:
 * a receiver's stance on a single concession item, carried by a
 * `respond_to_concession` argument (QOL-041 design §5.2). Cross-feature
 * row interface; defined here as a pure shape.
 *
 * Doctrine: the row stores the LEVEL + the CLARIFICATION only. It never
 * stores or carries a `broadStandingDelta` / `narrowStandingDelta` /
 * pressure number — QOL-041 is not a scoring path (§4, §11).
 */
export interface ConcessionAcceptance {
  id: string;
  debateId: string;
  /** FK → concession_items.id. */
  concessionItemId: string;
  /** FK → arguments.id — the receiver's response argument. */
  argumentId: string;
  /** profiles.id of the receiver (the conceded-to node's author). */
  receiverId: string;
  /** One of the 5 acceptance levels. */
  acceptanceLevel: AcceptanceLevel;
  /** Required iff `acceptanceLevel !== 'agree'`. Trimmed by the CHECK. */
  clarificationBody: string;
  /** ISO timestamp of the row's creation. */
  createdAt: string;
}

/**
 * `MoveReaction` — one row of `public.move_reactions`: a single
 * fist-bump (the only allowed kind in v1) by a viewer on a posted
 * argument (QOL-041 design §5.4). Soft-deletable; toggling off sets
 * `removedAt`. The reaction carries NO SCORE, NO STANDING CHANGE.
 */
export interface MoveReaction {
  id: string;
  debateId: string;
  /** FK → arguments.id. */
  argumentId: string;
  /** profiles.id of the reactor. */
  reactorId: string;
  /** The single allowed kind in v1 — `fist_bump`. */
  kind: MoveReactionKind;
  /** ISO timestamp when toggled off; null = active. */
  removedAt: string | null;
  /** profiles.id of the soft-delete actor; null when not soft-deleted. */
  removedBy: string | null;
  /** ISO timestamp of the row's creation (default now()). */
  createdAt: string;
}
