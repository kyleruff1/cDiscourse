/**
 * QOL-038 — pure-TS invite model.
 *
 * Owns the `RoomInvite` shape mirrored from `public.argument_room_invites`,
 * the legal status-machine, the TTL/redeemability predicate, and the
 * email-mask helpers used by `list_for_debate` consumers. No React, no
 * Supabase, no network — this file is imported by both the client UI and
 * the Edge Function contract tests (mirror style, like `adminSchemas`).
 *
 * Doctrine:
 *  - The raw token is never represented here. Only `tokenHash` (sha-256
 *    hex) is part of the persisted shape, and even that is not surfaced to
 *    the inviter list — see `summariseInviteForInviter` which strips it.
 *  - Status transitions follow `pending → accepted | revoked | expired`.
 *    Any other transition is illegal and rejected.
 *  - The display-only `inviteeEmailMasked` form (`j•••@example.com`)
 *    truncates the local part so a `list_for_debate` response never echoes
 *    the full invited address even though the inviter typed it.
 */

/** The five terminal/live states of an invite row. */
export type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

/** The two primary-seat intents an invite can carry. */
export type IntendedSeat = 'respondent' | 'co_primary';

/**
 * The full client shape of an `argument_room_invites` row, as the inviter
 * sees it. The invitee profile id is null until the row is accepted.
 *
 * Note: the raw token never appears in this shape. It lives in the
 * inviter's local "Copy invite link" affordance and in the email body
 * (when QOL-040 turns delivery on) — nowhere else.
 */
export interface RoomInvite {
  inviteId: string;
  debateId: string;
  invitedBy: string;
  inviteeEmailLower: string;
  inviteeProfileId: string | null;
  intendedSeat: IntendedSeat;
  status: InviteStatus;
  /** sha-256 hex of the raw token. Not user-facing. */
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
}

/**
 * The summary shape returned to the inviter from `list_for_debate`. Does
 * NOT carry `tokenHash` or `inviteeProfileId` — the inviter does not need
 * either, and emitting them would widen the leak surface.
 */
export interface InviteSummaryForInviter {
  inviteId: string;
  inviteeEmailMasked: string;
  intendedSeat: IntendedSeat;
  status: InviteStatus;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

const VALID_STATUSES: ReadonlySet<InviteStatus> = new Set([
  'pending',
  'accepted',
  'revoked',
  'expired',
]);

const VALID_SEATS: ReadonlySet<IntendedSeat> = new Set([
  'respondent',
  'co_primary',
]);

/**
 * The transition machine. Only `pending` can leave the live state. Once a
 * row is accepted / revoked / expired it stays there — the next attempt at
 * a write returns an idempotent / conflict error from the Edge Function.
 *
 * `expired` is computed by the server when status='pending' AND
 * expires_at < now(); the row's stored status may still be 'pending' — see
 * `computeLiveStatus`.
 */
export const INVITE_TRANSITIONS: Readonly<Record<InviteStatus, ReadonlyArray<InviteStatus>>> = {
  pending: ['accepted', 'revoked', 'expired'],
  accepted: [],
  revoked: [],
  expired: [],
};

/** True if a particular status transition is allowed by the machine. */
export function isLegalInviteTransition(from: InviteStatus, to: InviteStatus): boolean {
  if (!VALID_STATUSES.has(from) || !VALID_STATUSES.has(to)) return false;
  const allowed = INVITE_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Compute the live status: a row whose stored status is 'pending' but
 * whose `expires_at` is in the past is functionally 'expired' even though
 * the DB has not yet flipped it. The Edge Function consults this when
 * answering `lookup_by_token` and `accept`.
 *
 * Returns the stored status unchanged for any non-pending row.
 */
export function computeLiveStatus(invite: Pick<RoomInvite, 'status' | 'expiresAt'>, nowIso: string): InviteStatus {
  if (invite.status !== 'pending') return invite.status;
  const expiresMs = Date.parse(invite.expiresAt);
  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(expiresMs) || !Number.isFinite(nowMs)) {
    // A malformed timestamp is treated as expired — fail-closed. The
    // alternative (treating it as still pending) would mean a corrupt row
    // could authorise an enrolment.
    return 'expired';
  }
  return expiresMs < nowMs ? 'expired' : 'pending';
}

/**
 * True when the invite is in a state that can still be redeemed. Pure;
 * computed off `computeLiveStatus`. The `accept` Edge Function action is
 * the only authoritative gate, but UI surfaces use this predicate to
 * decide whether to offer a Continue button.
 */
export function isInviteRedeemable(
  invite: Pick<RoomInvite, 'status' | 'expiresAt'>,
  nowIso: string,
): boolean {
  return computeLiveStatus(invite, nowIso) === 'pending';
}

/**
 * Mask the local part of an email for inviter-visible surfaces. The
 * inviter typed the address so a tiny echo is fine; emitting it whole
 * would mean any device the inviter is signed in on could see the full
 * invitee address from a list call long after the invite was sent.
 *
 *   alice@example.com → 'a•••@example.com'
 *   x@y.io            → 'x•••@y.io'   (single-char local part — keep it)
 *   ''                → ''            (empty stays empty)
 *   'not-an-email'    → 'n•••'        (no @ — mask everything past the first char)
 */
export function maskInviteeEmail(emailLower: string): string {
  const trimmed = String(emailLower || '').trim();
  if (trimmed.length === 0) return '';
  const atIdx = trimmed.lastIndexOf('@');
  if (atIdx <= 0) {
    // No '@' or '@' is the first character — keep the first letter, mask the rest.
    return `${trimmed.charAt(0)}•••`;
  }
  const local = trimmed.slice(0, atIdx);
  const domain = trimmed.slice(atIdx + 1);
  const head = local.charAt(0);
  return `${head}•••@${domain}`;
}

/**
 * Project a full `RoomInvite` to its inviter-facing summary. Strips
 * `tokenHash`, `inviteeProfileId`, and `invitedBy`; the inviter does not
 * need them and emitting them would widen the leak surface.
 */
export function summariseInviteForInviter(invite: RoomInvite): InviteSummaryForInviter {
  return {
    inviteId: invite.inviteId,
    inviteeEmailMasked: maskInviteeEmail(invite.inviteeEmailLower),
    intendedSeat: invite.intendedSeat,
    status: invite.status,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    acceptedAt: invite.acceptedAt,
  };
}

/** Type-guard: is `value` a valid intended-seat literal? */
export function isIntendedSeat(value: unknown): value is IntendedSeat {
  return typeof value === 'string' && VALID_SEATS.has(value as IntendedSeat);
}

/** Type-guard: is `value` a valid invite-status literal? */
export function isInviteStatus(value: unknown): value is InviteStatus {
  return typeof value === 'string' && VALID_STATUSES.has(value as InviteStatus);
}

/**
 * Validate an email address with a deliberately conservative shape check —
 * good enough to keep junk out of the function, not a full RFC compliance
 * grammar (Zod's `.email()` covers the real validation on the wire). The
 * function returns the normalised form `lower(trim(...))` for storage.
 *
 * Returns `null` if the input is not a syntactically valid address.
 */
export function normaliseInviteeEmail(input: string): string | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > 320) return null;
  // One '@', non-empty local + domain, at least one '.' in the domain part.
  const at = trimmed.lastIndexOf('@');
  if (at <= 0 || at === trimmed.length - 1) return null;
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (local.length === 0 || domain.length === 0) return null;
  if (!domain.includes('.')) return null;
  // No spaces anywhere; the basic shape rejects most accidental garbage.
  if (/\s/.test(trimmed)) return null;
  return trimmed.toLowerCase();
}
