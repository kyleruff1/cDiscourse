/**
 * START-003 (#875) — Public-argument toggle state machine (pure TypeScript).
 *
 * Pure TS logic only. NO React, NO Supabase, NO network, NO gameCopy import; no
 * mutation, no clock, no randomness. The only import is the type-only
 * `RoomVisibility`. This is the load-bearing layer of the two-tap guarantee:
 * a room can NEVER carry `visibility: 'public'` into a create payload with
 * fewer than two deliberate taps, because `resolveCreationVisibility` returns
 * `'public'` for EXACTLY ONE state (`public_confirmed`), and that state is
 * reachable from the default only via `private --flip_on--> previewing_public
 * --confirm--> public_confirmed` (two events).
 *
 * The transient `previewing_public` state lives here (inside the toggle), never
 * in the sheet visibility, which is only `'public' | 'private'` (START-001 A3).
 */

import type { RoomVisibility } from '../../debates/types';

// ── States + events ─────────────────────────────────────────────

export type PublicToggleState = 'private' | 'previewing_public' | 'public_confirmed';
export type PublicToggleEvent = 'flip_on' | 'flip_off' | 'confirm' | 'dismiss';

/** Frozen list — tests iterate this. */
export const ALL_PUBLIC_TOGGLE_STATES: ReadonlyArray<PublicToggleState> = Object.freeze([
  'private',
  'previewing_public',
  'public_confirmed',
]);

/** Frozen list — tests iterate this. */
export const ALL_PUBLIC_TOGGLE_EVENTS: ReadonlyArray<PublicToggleEvent> = Object.freeze([
  'flip_on',
  'flip_off',
  'confirm',
  'dismiss',
]);

// ── Transition table ────────────────────────────────────────────

/**
 * The full transition table (Design decision 1). Every cell is defined:
 *
 *   from \ event         flip_on             flip_off   confirm             dismiss
 *   private              previewing_public   private    private             private
 *   previewing_public    previewing_public   private    public_confirmed    private
 *   public_confirmed     public_confirmed    private    public_confirmed    private
 *
 * Key properties:
 *  - No single event from `private` reaches `public_confirmed` (the only path is
 *    flip_on then confirm — exactly two events).
 *  - `flip_off` and `dismiss` retreat to `private` from ANY state (fully
 *    reversible before create).
 */
const TRANSITIONS: Readonly<
  Record<PublicToggleState, Readonly<Record<PublicToggleEvent, PublicToggleState>>>
> = Object.freeze({
  private: Object.freeze({
    flip_on: 'previewing_public',
    flip_off: 'private',
    confirm: 'private',
    dismiss: 'private',
  }),
  previewing_public: Object.freeze({
    flip_on: 'previewing_public',
    flip_off: 'private',
    confirm: 'public_confirmed',
    dismiss: 'private',
  }),
  public_confirmed: Object.freeze({
    flip_on: 'public_confirmed',
    flip_off: 'private',
    confirm: 'public_confirmed',
    dismiss: 'private',
  }),
});

/**
 * Advance the state machine. Pure — returns the next state (the same state for
 * a no-op). An unknown state/event defensively returns `private` (fail-closed to
 * the private default rather than fabricate a public state).
 */
export function nextPublicToggleState(
  state: PublicToggleState,
  event: PublicToggleEvent,
): PublicToggleState {
  const row = TRANSITIONS[state];
  if (!row) return 'private';
  const next = row[event];
  return next ?? 'private';
}

// ── Derivations ─────────────────────────────────────────────────

/**
 * The single choke point the two-tap proof pins: the create payload carries
 * `'public'` from `public_confirmed` ONLY. `private` and `previewing_public`
 * both resolve to `'private'`.
 */
export function resolveCreationVisibility(state: PublicToggleState): RoomVisibility {
  return state === 'public_confirmed' ? 'public' : 'private';
}

/** Whether the consequences preview panel is visible (any non-private state). */
export function isPublicPreviewVisible(state: PublicToggleState): boolean {
  return state !== 'private';
}

/** Whether the switch renders ON (any non-private state). */
export function isSwitchOn(state: PublicToggleState): boolean {
  return state !== 'private';
}

/**
 * Map the sheet-held committed visibility to the toggle initial internal state
 * (`'public' -> public_confirmed`, else `private`). Used by the component
 * initializer + reset effect (START-001 A7 / A9).
 */
export function initialStateForVisibility(visibility: RoomVisibility): PublicToggleState {
  return visibility === 'public' ? 'public_confirmed' : 'private';
}
