/**
 * SETTLE-001 (#911) — Room settle / re-open model.
 *
 * Pure TypeScript. NO React, NO Supabase, NO network, NO AI imports.
 * Unit-testable in isolation. Mirrors roomVisibilityModel.ts.
 *
 * Doctrine encoded:
 *   - Settling is a ROOM LIFECYCLE transition (open to locked and back),
 *     NEVER a verdict. No winner / loser / decided / final framing, no
 *     score or standing effect (the engine + antiAmplification are not
 *     imported or touched).
 *   - The creator (room owner) is the only actor the UI offers settle /
 *     re-open to. The DB RLS creator-or-mod UPDATE policy is the
 *     authoritative gate; this model narrows to creator-only on top
 *     (defence in depth, keyed on createdByUserId, never a participant
 *     side).
 *   - Every user-facing string lives in ROOM_SETTLE_COPY (gameCopy.ts),
 *     never inlined here.
 *
 * Comments are apostrophe-free for the naive quote-parity doctrine scanner.
 */
import type { DebateStatus } from './types';
import { ROOM_SETTLE_COPY } from '../arguments/gameCopy';

// ── Types ─────────────────────────────────────────────────────

export type SettleMode = 'settle' | 'reopen';

export const ALL_SETTLE_MODES: ReadonlyArray<SettleMode> = Object.freeze([
  'settle',
  'reopen',
]);

/**
 * Stable internal reason code. Each value maps to a plain-language string
 * (ROOM_SETTLE_COPY) at the surface — raw codes NEVER reach a user-facing
 * string.
 */
export type SettleReason =
  | 'eligible'
  | 'not_room_creator'
  | 'not_open' // settle requires status = open
  | 'not_locked'; // reopen requires status = locked

export const ALL_SETTLE_REASONS: ReadonlyArray<SettleReason> = Object.freeze([
  'eligible',
  'not_room_creator',
  'not_open',
  'not_locked',
]);

/**
 * Input to the eligibility checks. The model is pure: every signal needed
 * to decide is passed in. The creator gate keys on createdByUserId (the
 * column the RLS UPDATE policy checks), never on a participant side.
 */
export interface SettleContext {
  roomId: string;
  roomStatus: DebateStatus;
  callerUserId: string;
  createdByUserId: string;
}

/** Result shape — allowed is a boolean, reason is the stable code. */
export interface SettleEligibility {
  allowed: boolean;
  reason: SettleReason;
}

/**
 * Bullet codes rendered in the confirm sheet; each maps to a
 * ROOM_SETTLE_COPY string at the surface.
 */
export type SettleConsequence =
  // settle mode
  | 'no_new_moves'
  | 'no_new_joiners'
  | 'stays_readable'
  | 'becomes_linkable'
  | 'reversible'
  // reopen mode
  | 'new_moves_allowed'
  | 'content_unchanged'
  | 'existing_links_kept';

export const ALL_SETTLE_CONSEQUENCES: ReadonlyArray<SettleConsequence> = Object.freeze([
  'no_new_moves',
  'no_new_joiners',
  'stays_readable',
  'becomes_linkable',
  'reversible',
  'new_moves_allowed',
  'content_unchanged',
  'existing_links_kept',
]);

export interface SettleConsequences {
  mode: SettleMode;
  effects: ReadonlyArray<SettleConsequence>;
}

// The fixed effect lists per mode. Settle includes the R3 no-new-joiners
// bullet (a natural corollary of no-new-moves; the participants INSERT
// policy already blocks joining a non-open room). Reopen stays honest that
// inbound weave links persist (existing_links_kept).
const SETTLE_EFFECTS: ReadonlyArray<SettleConsequence> = Object.freeze([
  'no_new_moves',
  'no_new_joiners',
  'stays_readable',
  'becomes_linkable',
  'reversible',
]);

const REOPEN_EFFECTS: ReadonlyArray<SettleConsequence> = Object.freeze([
  'new_moves_allowed',
  'content_unchanged',
  'existing_links_kept',
]);

// ── canSettleRoom ─────────────────────────────────────────────

/**
 * Decide whether the caller may settle (lock) this room. Allowed only when
 * the caller is the room creator AND the room is currently open. A
 * non-creator gets not_room_creator regardless of status; the creator on a
 * non-open room gets not_open (the action simply does not render).
 */
export function canSettleRoom(ctx: SettleContext): SettleEligibility {
  if (ctx.callerUserId !== ctx.createdByUserId) {
    return { allowed: false, reason: 'not_room_creator' };
  }
  if (ctx.roomStatus !== 'open') {
    return { allowed: false, reason: 'not_open' };
  }
  return { allowed: true, reason: 'eligible' };
}

// ── canReopenRoom ─────────────────────────────────────────────

/**
 * Decide whether the caller may re-open (unlock) this room. Allowed only
 * when the caller is the room creator AND the room is currently locked.
 */
export function canReopenRoom(ctx: SettleContext): SettleEligibility {
  if (ctx.callerUserId !== ctx.createdByUserId) {
    return { allowed: false, reason: 'not_room_creator' };
  }
  if (ctx.roomStatus !== 'locked') {
    return { allowed: false, reason: 'not_locked' };
  }
  return { allowed: true, reason: 'eligible' };
}

// ── buildSettleConsequences ───────────────────────────────────

/**
 * Build the fixed consequence list shown in the confirm sheet for a mode.
 * Always returns the same effect codes per mode; the surface maps each to a
 * ROOM_SETTLE_COPY bullet.
 */
export function buildSettleConsequences(mode: SettleMode): SettleConsequences {
  return {
    mode,
    effects: mode === 'settle' ? SETTLE_EFFECTS : REOPEN_EFFECTS,
  };
}

// ── Re-export the copy block so callers stay model-scoped ────

export { ROOM_SETTLE_COPY };
