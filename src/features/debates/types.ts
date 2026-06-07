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
}

export interface JoinResult {
  side: ParticipantSide;
  alreadyJoined: boolean;
}

export type DebateApiResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };
