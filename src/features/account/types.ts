export type ProfileRole = 'user' | 'moderator' | 'admin';

// PR-004 — removed AvatarModerationStatus type + the four avatar fields
// from UserProfile. The avatar pipeline (PR-003) was deprecated when the
// operator pivoted to the InitialsAvatar identity glyph. See
// supabase/migrations/20260525000017_pr_004_deprecate_avatar_pipeline.sql.

export interface UserProfile {
  id: string;
  displayName: string | null;
  role: ProfileRole;
  createdAt: string;
}

export interface ProfileUpdatePayload {
  displayName: string;
}

export type ProfileError =
  | 'not_found'
  | 'network_error'
  | 'config_missing'
  | 'unauthorized'
  | 'unknown';

export interface ProfileResult<T = void> {
  ok: boolean;
  data?: T;
  error?: ProfileError;
  message?: string;
}
