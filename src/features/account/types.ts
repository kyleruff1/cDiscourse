export type ProfileRole = 'user' | 'moderator' | 'admin';

/** PR-003 — avatar moderation status. Default 'allowed' so existing
 * behaviour is preserved. When 'removed', the read path returns null
 * URLs and the client falls back to the GeneratedAvatar placeholder. */
export type AvatarModerationStatus = 'allowed' | 'removed';

export interface UserProfile {
  id: string;
  displayName: string | null;
  role: ProfileRole;
  createdAt: string;
  /** PR-003 — storage path for the 256x256 avatar. NULL when no upload. */
  avatarPath: string | null;
  /** PR-003 — storage path for the 64x64 thumbnail. NULL when no upload. */
  avatarThumbPath: string | null;
  /** PR-003 — last upload/remove timestamp. Used as the cache-bust token. */
  avatarUpdatedAt: string | null;
  /** PR-003 — moderation scaffolding column; default 'allowed'. */
  avatarModerationStatus: AvatarModerationStatus;
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
