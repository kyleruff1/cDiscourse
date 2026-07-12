/**
 * UX-PR-B (#918) — room-load error aggregation (pure-TS).
 *
 * Pure TypeScript. No React, no Supabase, no network, no async, no clock, no
 * randomness; JSON-serializable in and out; frozen outputs; deterministic —
 * mirrors the seatClaimModel / engine discipline. Never import React / Supabase
 * / any network library into this file.
 *
 * The four ROOM read hooks (proof / markers / move_marks / chime_in) each now
 * expose a fixed plain-language read-error sentinel. This model folds them into
 * ONE strip state so the room shows a SINGLE honest, announced notice even when
 * every read fails at once (the load-bearing expired-session cascade) — never
 * four stacked banners. The retry FUNCTIONS live in the component (they are not
 * JSON-serializable); this model only reports WHICH sources failed, in a fixed
 * canonical order, so the component can fire exactly those refetches.
 *
 * Doctrine (cdiscourse-doctrine sections 1 / 2 / 3 / 9): the surfaced message is
 * a neutral LOAD fact, never a verdict, never heat / popularity, never a person
 * attribution. It is a SINGLE stable constant (not derived from the failure set)
 * so a screen readers live region announces it once and does not re-announce as
 * sources drop in and out. It intentionally does NOT enumerate which read failed
 * (naming markers / proof would leak an internal concept and add noise).
 *
 * Comments are apostrophe-free for scanner safety.
 */
import { ROOM_LOAD_ERROR_COPY } from '../gameCopy';

/** The four ROOM read seams that feed the shared strip (the gallery is excluded). */
export type RoomLoadErrorSource = 'proof' | 'markers' | 'move_marks' | 'chime_in';

export interface RoomLoadErrorInput {
  source: RoomLoadErrorSource;
  /** The hook read-error sentinel, or null when that read succeeded / was skipped. */
  error: string | null;
}

export interface RoomLoadErrorStripState {
  /** True iff at least one source reported a non-null error. */
  visible: boolean;
  /** ONE stable message regardless of how many sources failed. */
  message: string;
  /** The failed sources, in a FIXED canonical order (drives which refetches fire). */
  failedSources: RoomLoadErrorSource[];
}

/**
 * The canonical source order. failedSources is always a subset of this list in
 * this order, so the output is deterministic and order-independent of the input.
 */
const CANONICAL_ORDER: ReadonlyArray<RoomLoadErrorSource> = Object.freeze([
  'proof',
  'markers',
  'move_marks',
  'chime_in',
]);

/**
 * Fold the four room read-error inputs into one strip state. Order-independent:
 * failedSources is emitted in CANONICAL_ORDER regardless of input order, so the
 * "renders once" invariant holds at the model layer (one message, one ordered
 * failure set) even when all four fail simultaneously.
 */
export function deriveRoomLoadErrorStrip(
  inputs: ReadonlyArray<RoomLoadErrorInput>,
): RoomLoadErrorStripState {
  const failedSet = new Set<RoomLoadErrorSource>();
  for (const input of inputs) {
    if (input && input.error !== null && input.error !== undefined) {
      failedSet.add(input.source);
    }
  }
  const failedSources = CANONICAL_ORDER.filter((source) => failedSet.has(source));
  return Object.freeze({
    visible: failedSources.length > 0,
    message: ROOM_LOAD_ERROR_COPY.stripMessage,
    failedSources,
  });
}
