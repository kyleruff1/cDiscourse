/**
 * PRIVATE-GROUPS-002 (#859) — pure-TS circle-invite lifecycle model.
 *
 * Pure TypeScript (no React / Supabase / network / clock). Encodes the SAME
 * decision semantics the manage-circle-invite Edge Function applies at each
 * lifecycle step, so the lifecycle can be exercised deterministically in Jest
 * (the Deno function itself cannot be imported). The Edge Function is the
 * authoritative implementation; this model mirrors its refusal + enrol logic so
 * a divergence is caught by the flow test.
 *
 * The caller passes an explicit `nowMs` (no hidden clock) so expiry decisions
 * are deterministic.
 */

/** Invite persisted status — mirrors the DB check. */
export type CircleInviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

/** The subset of a circle_invites row the lifecycle reasons about. */
export interface CircleInviteRecord {
  id: string;
  circleId: string;
  inviteeEmailLower: string;
  status: CircleInviteStatus;
  expiresAtMs: number;
  /** The profile id bound at accept time (null until accepted). */
  inviteeProfileId: string | null;
}

/** A live circle_members row projection. */
export interface CircleMemberRecord {
  circleId: string;
  userId: string;
  role: 'owner' | 'member';
  isRemoved: boolean;
}

/**
 * The refusal codes the accept/provision paths can return, mirroring the Edge
 * jsonError codes. `null` means "no refusal — proceed".
 */
export type CircleInviteRefusal =
  | 'invite_not_found'
  | 'invite_revoked'
  | 'invite_expired'
  | 'invite_already_accepted'
  | 'invite_email_mismatch'
  | 'circle_deleted';

export interface AcceptOutcome {
  refusal: CircleInviteRefusal | null;
  /** True when the invite is (or becomes) accepted by this caller. */
  accepted: boolean;
  /** True when a membership enrol/flip should occur (false on idempotent re-accept). */
  enrolls: boolean;
}

/**
 * Compute the live status of an invite at `nowMs` — a stored 'pending' past its
 * expiry is functionally 'expired'.
 */
export function liveInviteStatus(
  invite: Pick<CircleInviteRecord, 'status' | 'expiresAtMs'>,
  nowMs: number,
): CircleInviteStatus {
  if (
    invite.status === 'pending' &&
    (!Number.isFinite(invite.expiresAtMs) || invite.expiresAtMs < nowMs)
  ) {
    return 'expired';
  }
  return invite.status;
}

/**
 * The lookup_by_token projection a pre-signup caller receives — never the
 * member list, only the live status. Returns null when the token maps to no
 * invite (the caller returns invite_not_found).
 */
export function projectLookup(
  invite: CircleInviteRecord | null,
  nowMs: number,
): { status: CircleInviteStatus } | null {
  if (!invite) return null;
  return { status: liveInviteStatus(invite, nowMs) };
}

/**
 * Decide the accept/provision outcome for a caller. Mirrors the Edge order:
 *   not-found -> revoked -> expired -> already-accepted (idempotent for same
 *   redeemer) -> email-binding -> circle-live -> proceed.
 */
export function decideAccept(params: {
  invite: CircleInviteRecord | null;
  circleIsDeleted: boolean;
  callerUserId: string;
  callerEmailLower: string;
  nowMs: number;
}): AcceptOutcome {
  const { invite, circleIsDeleted, callerUserId, callerEmailLower, nowMs } = params;

  if (!invite) return { refusal: 'invite_not_found', accepted: false, enrolls: false };

  if (invite.status === 'revoked') {
    return { refusal: 'invite_revoked', accepted: false, enrolls: false };
  }

  const live = liveInviteStatus(invite, nowMs);
  if (live === 'expired') {
    return { refusal: 'invite_expired', accepted: false, enrolls: false };
  }

  if (invite.status === 'accepted') {
    if (invite.inviteeProfileId === callerUserId) {
      // Idempotent success — already this caller's; no new enrol.
      return { refusal: null, accepted: true, enrolls: false };
    }
    return { refusal: 'invite_already_accepted', accepted: false, enrolls: false };
  }

  // Email-binding — the security spine.
  if (!callerEmailLower || callerEmailLower !== invite.inviteeEmailLower) {
    return { refusal: 'invite_email_mismatch', accepted: false, enrolls: false };
  }

  if (circleIsDeleted) {
    return { refusal: 'circle_deleted', accepted: false, enrolls: false };
  }

  return { refusal: null, accepted: true, enrolls: true };
}

/**
 * Apply an enrolment to a member list (the enrolAndFlipInvite effect):
 * re-add-after-removal reuses the row; an existing live member is a no-op; else
 * a new 'member' row is added. Returns the NEW member list (pure — no mutation).
 */
export function applyEnrolment(
  members: CircleMemberRecord[],
  circleId: string,
  userId: string,
): CircleMemberRecord[] {
  const idx = members.findIndex((m) => m.circleId === circleId && m.userId === userId);
  if (idx === -1) {
    return [...members, { circleId, userId, role: 'member', isRemoved: false }];
  }
  const existing = members[idx];
  if (!existing.isRemoved) return members; // idempotent no-op
  const next = members.slice();
  next[idx] = { ...existing, role: 'member', isRemoved: false };
  return next;
}
