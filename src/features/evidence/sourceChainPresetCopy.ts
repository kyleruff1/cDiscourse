/**
 * EV-002 — Source-chain composer preset bodies.
 *
 * Frozen plain-English strings that the source-chain popover seeds into the
 * composer when the viewer taps an "ask" action. Every string asks a
 * question, uses *trail / inspection* language, and never accuses the
 * author. The user can edit the seeded body before posting.
 *
 * Pure constants. No React, no Supabase, no network.
 *
 * Doctrine anchors:
 *   - "Status describes the trail, not the truth." Every preset asks a
 *     question about the trail's shape, never about the author.
 *   - "Popularity is not evidence." No preset references engagement,
 *     virality, follower count, or "many people".
 */

/** Seeded composer body for `ask_for_source` from the source-chain popover. */
export const ASK_SOURCE_PRESET_BODY =
  "Could you point to the source you're working from here? A link, citation, or quoted excerpt would help me follow the trail.";

/**
 * Seeded composer body for `ask_for_quote` when a source pointer exists but
 * no excerpt is attached.
 */
export const ASK_QUOTE_PRESET_BODY =
  "Could you quote the specific passage in that source this is from? Pulling the exact line would tighten the trail.";

/** Seeded composer body for the `broken` state — asks for a stronger source. */
export const ASK_STRONGER_SOURCE_PRESET_BODY =
  "This trail looks weak — it dead-ends, cycles, or contradicts itself for me. Is there a more primary record we could anchor on?";

/** Frozen array of every preset body, for ban-list iteration in tests. */
export const ALL_SOURCE_CHAIN_PRESET_BODIES: ReadonlyArray<string> = Object.freeze([
  ASK_SOURCE_PRESET_BODY,
  ASK_QUOTE_PRESET_BODY,
  ASK_STRONGER_SOURCE_PRESET_BODY,
]);
