/**
 * Invite types — UI form-state shapes.
 *
 * QOL-038 rewrite (2026-05-24): the Stage 6.1.0 placeholder shapes
 * (`PlannedInvite`, `InviteRole`, `InviteFormState` with `role` field)
 * are replaced by the real shapes — the placeholder local-state model
 * is no longer needed. The DB-shape mirror (`ArgumentRoomInviteRecord`)
 * now aligns to the migration's final column set: `intended_seat`,
 * `revoked_at`, non-null `invitee_email_lower`.
 *
 * The full `RoomInvite` shape lives in `inviteModel.ts` — this file is
 * just the UI form shapes + the snake_case DB-row alias used by
 * server-touching adapters.
 */
import type { IntendedSeat, InviteStatus } from './inviteModel';

export type { InviteStatus, IntendedSeat } from './inviteModel';

/**
 * Snake_case alias for the persisted row shape. Kept for adapters that
 * read raw DB rows; production client code should consume `RoomInvite`
 * from `inviteModel.ts` instead.
 */
export interface ArgumentRoomInviteRecord {
  id: string;
  debate_id: string;
  invited_by: string;
  invitee_email_lower: string;
  invitee_profile_id: string | null;
  intended_seat: IntendedSeat;
  status: InviteStatus;
  token_hash: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
}

/** The InvitePanel form's local state. */
export interface InviteFormState {
  email: string;
  submitting: boolean;
  error: string | null;
}

export function emptyInviteForm(): InviteFormState {
  return { email: '', submitting: false, error: null };
}
