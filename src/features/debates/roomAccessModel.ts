/**
 * ARG-ROOM-006 — Visibility / feed / access integration (pure-TS).
 *
 * Pure TypeScript. No React, no Supabase, no network, no async, no clock, no
 * randomness; JSON-serializable in and out; frozen outputs; deterministic —
 * mirrors `src/domain/constitution/engine.ts` discipline. Never import
 * Supabase, React, or any network library into this file.
 *
 * This card SURFACES what a viewer can SEE and DO once a room exists. It does
 * NOT enforce capacity (the ARG-ROOM-002 `enforce_room_capacity()` trigger is
 * authoritative) and it does NOT enforce privacy (the QOL-039 visibility RLS is
 * authoritative — a private room is invisible to a non-member AT THE DB). This
 * module is the client-side access/route/copy layer ON TOP of those two:
 *
 *   - `deriveRoomAccessView`      — visibility + seat-state → access view-model
 *                                   (badge / access line / action label / the
 *                                   four seat states surfaced, never collapsed).
 *   - `resolveRoomDeepLinkAccess` — direct-URL / deep-link resolver: a requested
 *                                   id that is NOT in the RLS-filtered set is
 *                                   `unavailable` — IDENTICAL for private-no-access
 *                                   AND nonexistent (the no-enumeration guarantee
 *                                   by construction; no new RLS needed).
 *   - `feedVisibilityForCard`     — a tested discovery-feed predicate mirroring
 *                                   `classifyCardToSection` :1543 (private -> hidden
 *                                   from public lanes). NOTE: the ACTIVE hiding is
 *                                   QOL-039 RLS (primary) + `classifyCardToSection`
 *                                   (routes private -> my_rooms). This predicate is
 *                                   NOT yet wired into the gallery filter; it is
 *                                   available as a defense-in-depth layer, not a
 *                                   second active guard today.
 *   - `deriveGalleryActionLabel`  — the ONE action-label policy, shared by the
 *                                   gallery card + the access view (no drift).
 *
 * Doctrine anchors (read before changing anything):
 *  - Visibility is an ACCESS property; capacity / seat / heat are ACTIVITY; NONE
 *    is a verdict (§1). "Full" is a seat fact, never a loss. Observers are
 *    UNCAPPED — `canObserve` is ALWAYS true for a readable room (§ roadmap 1).
 *  - No enumeration (§ roadmap 5): a non-member NEVER learns a private room
 *    exists. The ACTIVE guards are QOL-039 RLS + `classifyCardToSection` (private
 *    -> my_rooms, never a public lane); `resolveRoomDeepLinkAccess` collapses
 *    private-no-access and nonexistent into one `unavailable` outcome; the gallery
 *    + list source their private chrome from the access VIEW, so `private_no_access`
 *    emits NO "Private" badge / pill / a11y, only a cause-neutral line.
 *    `feedVisibilityForCard` mirrors the hiding rule (defense-in-depth, available).
 *  - Heat / popularity NEVER reach this model — it reads counts + the cap only.
 *  - Single source of truth for the cap + seat math: this module IMPORTS
 *    `roomActiveSeatCap` / `canJoinActive` / `openActiveSlots` (the same
 *    primitives the ARG-ROOM-005 `seatClaimModel` consumes) — it authors NO
 *    second seat literal. A parity test pins it against `deriveSeatAvailability`.
 *  - Every produced string is ban-list scanned (`_forbiddenRoomAccessTokens`).
 */

import type { ArgumentRoomVisibility, ArgumentRoomCapacity } from './argumentRoomCreationMatrix';
import type { DebateStatus } from './types';
import { roomActiveSeatCap, canJoinActive, openActiveSlots } from './roomCapacityModel';
import { ROOM_ACCESS_COPY, ROOM_VISIBILITY_COPY } from '../arguments/gameCopy';

// ── Access state + feed visibility ──────────────────────────────

/** The access state a viewer has toward a room. NEVER a verdict. */
export type RoomAccessState =
  | 'public_open' //        public, an active seat is claimable (or counts unknown → safe default)
  | 'public_reserved' //    public, a seat is reserved for an invited person (only when reserved data is viewer-visible)
  | 'public_full' //        public, all active seats filled — observe-only
  | 'private_member' //     private, viewer is creator/participant/mod — full access
  | 'private_no_access'; // private, viewer is not a member — render identically to "unavailable"

/** Does the room appear in the public discovery feed for THIS viewer? */
export type RoomFeedVisibility = 'listed' | 'hidden';

/**
 * The gallery action-label vocabulary. Verbatim reuse of the shipped policy at
 * `ConversationGalleryScreen.tsx` (pre-006) — no new label words.
 */
export type RoomActionLabel = 'Observe →' | 'Continue →' | 'Open →';

/**
 * The seat-state summary 006 CONSUMES (from ARG-ROOM-005's seat model, or, for a
 * non-member browsing the gallery, the degraded null counts).
 * `activeCount` / `reservedCount` are nullable: a NON-member browsing a public
 * room cannot (and must not) see reserved invites (QOL-038 RLS), so counts may
 * be absent — the deriver degrades to `public_open` rather than guessing.
 */
export interface RoomSeatStateSummary {
  visibility: ArgumentRoomVisibility;
  /** Aligned with the canonical `DebateStatus` / `ConversationGalleryCard.openStatus`. */
  openStatus: DebateStatus;
  /** viewer is creator/participant/mod (`hasUserJoined || myParticipantSide != null`). */
  isMember: boolean;
  /** non-observer participants; null = not viewer-visible. */
  activeCount: number | null;
  /** live pending invites that reserve a seat; null = not viewer-visible. */
  reservedCount: number | null;
}

export interface RoomAccessView {
  state: RoomAccessState;
  feedVisibility: RoomFeedVisibility;
  /** true for any readable room (observers uncapped). */
  canObserve: boolean;
  /** open active seat AND status 'open' AND not already a member. */
  canClaimSeat: boolean;
  cap: ArgumentRoomCapacity;
  /** cap - active - reserved, clamped; null when counts are absent. */
  openSlots: number | null;
  /**
   * The visibility chip text. Empty string for `private_no_access` ONLY — a
   * non-member is never told a private room exists (no enumeration).
   */
  badgeLabel: string;
  /** Plain-language, ban-list-clean, NO enumeration. */
  accessLine: string;
  /** Reuses the shared `deriveGalleryActionLabel` policy. */
  actionLabel: RoomActionLabel;
}

// ── Shared action-label policy (one source of truth) ────────────

/**
 * The ONE gallery / list action-label policy. Extracted so the gallery card
 * surface and `deriveRoomAccessView` can never drift (review [should] #1):
 *
 *   member → 'Continue →'; open → 'Observe →'; otherwise → 'Open →'.
 *
 * "member" is the gallery's `hasUserJoined` (the access view passes `isMember`).
 */
export function deriveGalleryActionLabel(input: {
  hasUserJoined: boolean;
  openStatus: DebateStatus;
}): RoomActionLabel {
  if (input.hasUserJoined) return 'Continue →';
  if (input.openStatus === 'open') return 'Observe →';
  return 'Open →';
}

// ── The single access decision function ─────────────────────────

/**
 * Derive the access view for a room from its visibility + seat-state summary.
 * Pure + deterministic; the output is frozen. Decision order is fixed (mirrors
 * `deriveArgumentRoomCreation` discipline):
 *
 *   1. private + !member → `private_no_access` (hidden, no observe, cause-neutral,
 *      NO "Private" badge). Defensive terminal — RLS means this rarely renders.
 *   2. private + member  → `private_member` (hidden from discovery, observable).
 *   3. public, cap = roomActiveSeatCap('public'), always listed + observable:
 *        - counts absent           → `public_open` (safe non-enumerating default).
 *        - not `canJoinActive`     → `public_full` (observe-only).
 *        - reserved>0 & visible    → `public_reserved`.
 *        - else                    → `public_open`.
 *
 * `canObserve` is ALWAYS true for a readable room (observers uncapped);
 * `canClaimSeat` is NEVER true for a full room (the doctrine boundary).
 */
export function deriveRoomAccessView(input: RoomSeatStateSummary): RoomAccessView {
  const visibility: ArgumentRoomVisibility = input.visibility === 'private' ? 'private' : 'public';
  const cap = roomActiveSeatCap(visibility);
  const isMember = input.isMember === true;
  const isOpen = input.openStatus === 'open';
  const actionLabel = deriveGalleryActionLabel({ hasUserJoined: isMember, openStatus: input.openStatus });

  // 1. Private + not a member — the safe, non-enumerating terminal.
  if (visibility === 'private' && !isMember) {
    return Object.freeze({
      state: 'private_no_access',
      feedVisibility: 'hidden',
      canObserve: false,
      canClaimSeat: false,
      cap,
      openSlots: null,
      badgeLabel: '', // never reveal "Private" to a non-member (no enumeration).
      accessLine: ROOM_ACCESS_COPY.unavailable_body, // cause-neutral; asserts nothing.
      actionLabel,
    });
  }

  // 2. Private + member — full access; excluded from public discovery lanes.
  if (visibility === 'private') {
    return Object.freeze({
      state: 'private_member',
      feedVisibility: 'hidden',
      canObserve: true,
      canClaimSeat: false,
      cap,
      openSlots: null,
      badgeLabel: ROOM_VISIBILITY_COPY.option_private_label,
      accessLine: ROOM_ACCESS_COPY.private_member_line,
      actionLabel,
    });
  }

  // 3. Public — always listed + observable.
  const badgeLabel = ROOM_VISIBILITY_COPY.option_public_label;

  // Counts absent → safe non-enumerating default (a non-member cannot see
  // reserved invites, and the gallery does not fetch active counts).
  if (input.activeCount == null) {
    return Object.freeze({
      state: 'public_open',
      feedVisibility: 'listed',
      canObserve: true,
      canClaimSeat: isOpen && !isMember,
      cap,
      openSlots: null,
      badgeLabel,
      accessLine: ROOM_ACCESS_COPY.public_open_line,
      actionLabel,
    });
  }

  // Counts present — derive full / reserved / open via the SHARED seat
  // primitives (the same `canJoinActive` / `openActiveSlots` the ARG-ROOM-005
  // seat model consumes). No second seat literal authored here.
  const active = input.activeCount;
  const reserved = input.reservedCount ?? 0;
  const reservedVisible = input.reservedCount != null;
  const slots = openActiveSlots(active, reserved, cap);

  // Full — observe-only. "Full" is a seat fact (observers stay uncapped).
  if (!canJoinActive(active, reserved, cap)) {
    return Object.freeze({
      state: 'public_full',
      feedVisibility: 'listed',
      canObserve: true,
      canClaimSeat: false,
      cap,
      openSlots: slots,
      badgeLabel,
      accessLine: ROOM_ACCESS_COPY.public_full_line,
      actionLabel,
    });
  }

  // A seat is reserved AND the viewer is allowed to know it (creator/participant/
  // mod). A non-member passes `reservedCount = null` → never reaches this branch.
  if (reservedVisible && reserved > 0) {
    return Object.freeze({
      state: 'public_reserved',
      feedVisibility: 'listed',
      canObserve: true,
      canClaimSeat: isOpen && !isMember,
      cap,
      openSlots: slots,
      badgeLabel,
      accessLine: ROOM_ACCESS_COPY.public_reserved_line,
      actionLabel,
    });
  }

  // Open public seat.
  return Object.freeze({
    state: 'public_open',
    feedVisibility: 'listed',
    canObserve: true,
    canClaimSeat: isOpen && !isMember,
    cap,
    openSlots: slots,
    badgeLabel,
    accessLine: ROOM_ACCESS_COPY.public_open_line,
    actionLabel,
  });
}

// ── Direct-URL / deep-link resolver (item c) ────────────────────

/**
 * Classify a requested room id against the set of ids the RLS-filtered list
 * returned. `unavailable` covers BOTH private-no-access AND nonexistent — they
 * are indistinguishable BY CONSTRUCTION, which IS the no-enumeration guarantee:
 * a non-member never learns whether a private room exists at a given URL. Pure;
 * takes NO network and adds NO RLS (QOL-039's RLS already withheld the id).
 */
export function resolveRoomDeepLinkAccess(input: {
  requestedDebateId: string;
  loadedDebateIds: ReadonlySet<string> | ReadonlyArray<string>;
}): { outcome: 'resolved' | 'unavailable' } {
  const id = typeof input.requestedDebateId === 'string' ? input.requestedDebateId : '';
  if (id.length === 0) return Object.freeze({ outcome: 'unavailable' as const });

  const loaded = input.loadedDebateIds;
  const present =
    loaded instanceof Set
      ? loaded.has(id)
      : Array.isArray(loaded)
        ? loaded.includes(id)
        : false;

  return Object.freeze({ outcome: present ? ('resolved' as const) : ('unavailable' as const) });
}

// ── Belt-and-suspenders discovery-feed predicate (item b) ───────

/**
 * Is this card listed in the public discovery feed? EVERY private card is hidden
 * — a non-member's private card should never reach the client (RLS), and a
 * member's private card belongs in "My rooms", not a public-discovery lane.
 * Mirrors `classifyCardToSection` :1543 (`private → my_rooms`); additive, never
 * a modification of it. `isMember` is part of the contract (documents the seam
 * where a member holds a private card) — the rule hides any private card.
 */
export function feedVisibilityForCard(card: {
  visibility: 'public' | 'private';
  isMember: boolean;
}): RoomFeedVisibility {
  return card.visibility === 'private' ? 'hidden' : 'listed';
}

// ── Ban-list support ────────────────────────────────────────────

/**
 * Forbidden tokens scanned by `__tests__/roomAccessModel.test.ts`. NOT a content
 * filter. Mirrors the sibling pure-model ban lists (`_forbiddenSeatClaimTokens`,
 * `_forbiddenArgumentRoomCreationTokens`): every string this model can emit
 * describes ACCESS (public/private) or SEAT ACTIVITY (open/reserved/full), never
 * a verdict, never a person, never heat / popularity.
 */
export function _forbiddenRoomAccessTokens(): string[] {
  return [
    // Verdict tokens
    'winner',
    'loser',
    'correct',
    'incorrect',
    'truth',
    'true',
    'false',
    'right',
    'wrong',
    'won',
    'lost',
    'liar',
    'dishonest',
    'bad faith',
    'manipulative',
    'extremist',
    'propagandist',
    'stupid',
    'idiot',
    // Amplification tokens
    'popular',
    'trending',
    'viral',
    'upvote',
    'downvote',
    // Punitive / removal tokens — a full or private room is never a punishment
    'booted',
    'kicked',
    'banned',
    'removed',
    'rejected',
    'blocked',
    'silenced',
    // Person-attribution tokens
    'troll',
    'bot',
    'challenger',
    'opponent',
  ];
}
