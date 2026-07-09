export type DebateStatus = 'draft' | 'open' | 'locked' | 'archived';
export type ParticipantSide = 'affirmative' | 'negative' | 'observer' | 'moderator';

/**
 * QOL-039 — Room visibility taxonomy. Re-exported from
 * `roomVisibilityModel.ts`; this file is the canonical home for the
 * `Debate` interface, so the type also lives here for downstream
 * convenience.
 */
export type RoomVisibility = 'public' | 'private';

export interface Debate {
  id: string;
  createdBy: string;
  title: string;
  resolution: string;
  description: string;
  status: DebateStatus;
  constitutionId: string;
  createdAt: string;
  updatedAt: string;
  myParticipantSide: ParticipantSide | null;
  /**
   * QOL-039 — public = listed and globally readable; private = readable
   * only by participants and mods/admins. Backfilled to `'public'` by
   * migration `20260524000015` for every existing row, so this is always
   * populated for rows loaded post-migration.
   */
  visibility: RoomVisibility;
  /**
   * ADMIN-CONV-INACTIVE-VISIBILITY-001 — debate-level inactivation timestamp
   * (#514 / migration `20260606000001`). `null` = active; non-null = the room
   * was made inactive and must be hidden from default views. The WHAT of the
   * lifecycle state only — never the WHY. There is intentionally NO companion
   * `inactiveReason` field here or in `DebateRow`: the reason free-text is
   * never threaded to the gallery or the client (§10a). Optional in the type
   * because pre-migration callers and fixtures may omit it; absence is treated
   * as active.
   */
  inactiveAt?: string | null;
  /**
   * START-002 / HOME-003 (#839 / #840) — the circle this room is scoped to, or
   * `null` for a non-circle room. Additive nullable column
   * (`20260702000001_private_groups_002_circles.sql`; every existing row is
   * NULL). HOME-003's circle-home filter matches a room to a selected circle by
   * `circleId === selectedCircle.id`. Optional in the type because pre-widen
   * callers / fixtures may omit it; absence is treated as "no circle".
   */
  circleId?: string | null;
}

export interface CreateDebateInput {
  title: string;
  resolution: string;
  description: string;
  /**
   * QOL-039 — optional at create time. Defaults to `'public'` (today's
   * behavior). Set to `'private'` for a private-from-creation room
   * (band-rent Scenario 2, Step 1). No transition / confirmation needed
   * — nothing is being revoked at creation.
   */
  visibility?: RoomVisibility;
  /**
   * ARG-ROOM-003 — optional single direct invite supplied at creation. When
   * present it is threaded ATOMICALLY into the `create-argument-room` Edge
   * call (debate + creator + the one invite in a single transaction), so there
   * is no "room created but invite failed" intermediate state. The binding
   * matrix (private => one invite, <= 1 invite, no self-invite) is enforced
   * server-side by ARG-ROOM-002; the client form gates the friendly first
   * pass off the shared `deriveArgumentRoomCreation` validator. `intendedSeat`
   * is optional — the wrapper defaults it to `'respondent'`.
   */
  invite?: { email: string; intendedSeat?: 'respondent' | 'co_primary' };
  /**
   * START-002 (#839) — optional circle audience. When present the room is
   * created PRIVATE and scoped to this circle (a private room whose N-member
   * audience arrives via the shipped membership helper, NOT via a minted
   * invite). Mutually exclusive with `invite` (enforced server-side). Omitted
   * entirely for a non-circle create, so the non-circle payload is unchanged.
   */
  circleId?: string;
}

/**
 * ARG-ROOM-008 — the result of a successful room creation: the loaded
 * `Debate` plus the OPTIONAL one-time create-time invite link.
 *
 * `inviteLink` carries the RAW token and is returned to the CREATOR exactly
 * once at create time (it mirrors `CreateArgumentRoomResult.inviteLink`). It is
 * never stored, never logged, and never re-fetchable — the one-pending-invite-
 * per-room index means the in-room InvitePanel cannot mint a second link, so
 * this is the only client-side moment the link exists. `null` when the room was
 * created with no invite (public, no email). The create surface renders a
 * one-time copy-link box from it, inviter-only, then discards it on dismiss.
 */
export interface CreatedRoom {
  debate: Debate;
  inviteLink: string | null;
}

export interface JoinResult {
  side: ParticipantSide;
  alreadyJoined: boolean;
}

export type DebateApiResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };
