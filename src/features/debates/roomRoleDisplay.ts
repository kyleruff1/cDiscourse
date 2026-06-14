/**
 * UX-SIMPLIFY-002A — Room participant-side DISPLAY labels (pure TypeScript).
 *
 * The single typed accessor for the user-facing label of a debate-room
 * participant SIDE. It delegates to the canonical `PLAIN_LANGUAGE_COPY` map
 * (via `gameCopy.toPlainLanguage`) so there is ONE source of truth for role
 * copy across surfaces.
 *
 * Doctrine — the participant SIDE `moderator` is the ROOM CREATOR / HOST:
 *   - The `create_argument_room` RPC auto-joins the creator as side
 *     `'moderator'` (ARG-ROOM-002 migration); that is the side's only origin.
 *   - `'moderator'` holds an ACTIVE, cap-counted seat
 *     (`isActiveParticipantSide` in publicSeatModel/seatClaimModel), so it is
 *     NOT a read-only watcher and MUST NOT display as "Observer" — that word
 *     belongs to the genuine read-only `observer` side ("Watching").
 *   - The participant SIDE `'moderator'` is ORTHOGONAL to the platform app-role
 *     `moderator`/`admin` (`profiles.role` / `is_moderator_or_admin()`). This
 *     helper concerns ONLY the per-room side; it never relabels the platform
 *     role (see `formatProfileRole` / `formatActorRole`, which stay "Moderator").
 *
 * Display-only. No permission, seat, lifecycle, invite, or submission
 * semantics are read or changed here. Pure TS, deterministic, no React, no
 * Supabase, no fetch, no mutation.
 *
 * Deferred (NOT this card): the compact `SIDE_LABEL` badge in
 * `argumentGameSurfaceModel.ts` keeps `moderator: 'Mod'` because its literal
 * value is consumed as a LOGIC key by `pointLifecycleModel.sideOfNode`
 * (`'Mod' | 'Obs' -> observer` bucketing) — it is NOT display-only, so a safe
 * relabel of that short form requires decoupling lifecycle plumbing in a
 * separate card. The short form `'Mod'` does not carry the "Observer"
 * collision this card fixes.
 */
import type { ParticipantSide } from './types';
import { toPlainLanguage } from '../arguments/gameCopy';

/**
 * Frozen canonical display label per side. Mirrors `PLAIN_LANGUAGE_COPY`; a
 * drift-guard test asserts the two agree, so this also serves as a safe
 * fallback if the canonical map ever lacks a key.
 */
export const ROOM_ROLE_DISPLAY_LABEL: Readonly<Record<ParticipantSide, string>> = Object.freeze({
  affirmative: 'For',
  negative: 'Against',
  observer: 'Watching',
  moderator: 'Host',
});

/**
 * The user-facing label for a participant side. Delegates to the canonical
 * `toPlainLanguage` map; falls back to the frozen table if the map ever lacks
 * the key (so a host never renders as a raw code or an empty string). A null /
 * undefined side is a pure reader — shown as the read-only watcher label.
 */
export function plainLanguageForRoomRole(side: ParticipantSide | null | undefined): string {
  if (!side) return ROOM_ROLE_DISPLAY_LABEL.observer; // null => not a participant => watching
  const canonical = toPlainLanguage(side);
  if (typeof canonical === 'string' && canonical.length > 0) return canonical;
  return ROOM_ROLE_DISPLAY_LABEL[side] ?? '';
}
