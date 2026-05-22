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
