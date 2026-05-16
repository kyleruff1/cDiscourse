export type ProfileRole = 'user' | 'moderator' | 'admin';

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
