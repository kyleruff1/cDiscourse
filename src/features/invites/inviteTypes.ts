/**
 * Invite types — UI/foundation only.
 * No Supabase migration created in this stage.
 * No email sending in this stage.
 * No service-role keys.
 *
 * Stage 6.1.0
 */

export type InviteStatus =
  | 'planned'
  | 'sent'
  | 'accepted'
  | 'expired'
  | 'cancelled';

export type InviteRole = 'challenger' | 'supporter' | 'observer' | 'any';

/** Local-only planned invite — not persisted to DB in this stage. */
export interface PlannedInvite {
  id: string;
  debateId: string;
  inviteeEmail: string | null;
  inviteeDisplayName: string | null;
  role: InviteRole;
  status: InviteStatus;
  createdAt: string;
}

/** Future DB shape (not created as migration in Stage 6.1.0). */
export interface ArgumentRoomInviteRecord {
  id: string;
  debate_id: string;
  invited_by: string;
  invitee_email_lower: string | null;
  invitee_profile_id: string | null;
  role_or_side: string;
  status: InviteStatus;
  token_hash: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

export interface InviteFormState {
  emailOrName: string;
  role: InviteRole;
  submitted: boolean;
  error: string | null;
}

export function emptyInviteForm(): InviteFormState {
  return {
    emailOrName: '',
    role: 'any',
    submitted: false,
    error: null,
  };
}

export function validateInviteInput(emailOrName: string): string | null {
  if (!emailOrName || emailOrName.trim().length === 0) {
    return 'Enter an email or display name.';
  }
  if (emailOrName.trim().length > 200) {
    return 'Too long.';
  }
  return null;
}
