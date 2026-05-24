/**
 * QOL-038 — client wrappers for the manage-room-invite Edge Function.
 *
 * Five typed wrappers, one per action. Each routes through
 * `supabase.functions.invoke('manage-room-invite', …)`. This file
 * NEVER imports a service-role key, NEVER inserts into
 * argument_room_invites directly, NEVER hits the Resend API. Mirrors
 * the pointTagsApi / evidenceAnnotationApi pattern exactly.
 *
 * Doctrine: the raw invite token is treated as a capability. When the
 * inviter receives an `inviteLink` from `createRoomInvite` (the only
 * path that exposes the raw token to the client), the wrapper does NOT
 * log it, store it, or echo it through analytics. The InvitePanel UI is
 * the only consumer and it shows a "Copy invite link" affordance.
 */
import { supabase } from '../../lib/supabase';
import type { IntendedSeat, InviteStatus, InviteSummaryForInviter } from './inviteModel';

// ── Common result shape ──────────────────────────────────────

export interface InviteApiOutcome<T> {
  ok: true;
  data: T;
}

export interface InviteApiFailure {
  ok: false;
  error: { error: string; message?: string; reason?: string; detail?: string };
  status: number;
}

export type InviteApiResult<T> = InviteApiOutcome<T> | InviteApiFailure;

// ── Action result types ──────────────────────────────────────

export interface CreateRoomInviteInput {
  debateId: string;
  inviteeEmail: string;
  intendedSeat?: IntendedSeat;
}

export interface CreateRoomInviteResponse {
  inviteId: string;
  status: InviteStatus;
  expiresAt: string;
  notification: 'queued' | 'sent' | 'not_configured';
  reused: boolean;
  /**
   * The web invite link, returned ONLY to the inviter at create time and
   * ONLY when the email-delivery path is off (the default in this card —
   * QOL-040 owns the email flip). May be null when the request origin
   * could not be sanitised.
   */
  inviteLink: string | null;
}

export interface RevokeRoomInviteInput {
  inviteId: string;
}

export interface RevokeRoomInviteResponse {
  inviteId: string;
  status: 'revoked';
}

export interface ListInvitesForDebateInput {
  debateId: string;
}

export interface ListInvitesForDebateResponse {
  invites: InviteSummaryForInviter[];
}

export interface LookupInviteByTokenInput {
  token: string;
}

/**
 * The five live-status values lookup_by_token may return. `room_archived`
 * and `room_closed` are NOT raw `InviteStatus` values — they describe
 * the room, not the invite. The `expired` value here matches
 * `InviteStatus`.
 */
export type LookupInviteStatus =
  | 'pending'
  | 'expired'
  | 'revoked'
  | 'accepted'
  | 'room_archived'
  | 'room_closed';

export interface LookupInviteByTokenResponse {
  status: LookupInviteStatus;
  /** The token, echoed back so the gate can carry it into accept. */
  tokenEcho: string;
  room: {
    title: string;
    invitedByDisplayName: string | null;
  } | null;
}

export interface AcceptRoomInviteInput {
  token: string;
}

export interface AcceptRoomInviteResponse {
  debateId: string;
  status: 'accepted';
  enteredAsParticipant: true;
  intendedSeat: IntendedSeat;
}

// ── Internal invoke helper ───────────────────────────────────

async function invoke<T>(body: Record<string, unknown>): Promise<InviteApiResult<T>> {
  const { data, error } = await supabase.functions.invoke<T>('manage-room-invite', { body });

  if (error) {
    let errorBody: InviteApiFailure['error'] = { error: 'network_error' };
    try {
      const raw = (error as { context?: { json?: () => Promise<unknown> } }).context;
      if (raw?.json) {
        errorBody = (await raw.json()) as InviteApiFailure['error'];
      }
    } catch {
      // ignore parse failures — keep network_error fallback
    }
    const status =
      (error as { status?: number }).status ??
      ((error as { name?: string }).name === 'FunctionsFetchError' ? 503 : 500);
    return { ok: false, error: errorBody, status };
  }

  if (!data) {
    return { ok: false, error: { error: 'empty_response' }, status: 500 };
  }
  return { ok: true, data };
}

// ── Public wrappers ──────────────────────────────────────────

export async function createRoomInvite(
  input: CreateRoomInviteInput,
): Promise<InviteApiResult<CreateRoomInviteResponse>> {
  return invoke<CreateRoomInviteResponse>({
    action: 'create',
    debateId: input.debateId,
    inviteeEmail: input.inviteeEmail,
    intendedSeat: input.intendedSeat ?? 'respondent',
  });
}

export async function revokeRoomInvite(
  input: RevokeRoomInviteInput,
): Promise<InviteApiResult<RevokeRoomInviteResponse>> {
  return invoke<RevokeRoomInviteResponse>({ action: 'revoke', inviteId: input.inviteId });
}

export async function listInvitesForDebate(
  input: ListInvitesForDebateInput,
): Promise<InviteApiResult<ListInvitesForDebateResponse>> {
  return invoke<ListInvitesForDebateResponse>({
    action: 'list_for_debate',
    debateId: input.debateId,
  });
}

/**
 * Public-from-the-gate lookup. Callable WITHOUT a session — the token
 * possession IS the auth. The function's `verify_jwt = false` setting
 * is the platform-side enabler; this client wrapper never sends a JWT
 * for this action (supabase-js auto-attaches the current session if
 * present, but lookup is safe with one too).
 */
export async function lookupInviteByToken(
  input: LookupInviteByTokenInput,
): Promise<InviteApiResult<LookupInviteByTokenResponse>> {
  return invoke<LookupInviteByTokenResponse>({
    action: 'lookup_by_token',
    token: input.token,
  });
}

export async function acceptRoomInvite(
  input: AcceptRoomInviteInput,
): Promise<InviteApiResult<AcceptRoomInviteResponse>> {
  return invoke<AcceptRoomInviteResponse>({ action: 'accept', token: input.token });
}
