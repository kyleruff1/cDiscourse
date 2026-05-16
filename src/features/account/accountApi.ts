import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';
import type { UserProfile, ProfileUpdatePayload, ProfileResult, ProfileRole } from './types';

// ── Pure helpers (testable without Supabase) ──────────────────

/** Returns only the fields safe to write to profiles. Never includes role, id, or email. */
export function buildProfileUpdatePayload(input: ProfileUpdatePayload): Record<string, string> {
  return { display_name: input.displayName.trim() };
}

export const ROLE_LABELS: Record<ProfileRole, string> = {
  user: 'Participant',
  moderator: 'Moderator',
  admin: 'Admin',
};

export function formatProfileRole(role: string): string {
  return ROLE_LABELS[role as ProfileRole] ?? role;
}

export function normalizeProfileError(error: string | undefined): string {
  switch (error) {
    case 'not_found':
      return 'Profile not found. Your account may need attention — contact support.';
    case 'config_missing':
      return 'Supabase is not configured. Fill in .env with your project URL and anon key.';
    case 'unauthorized':
      return 'You do not have permission to perform this action.';
    case 'network_error':
      return 'Network error. Check your connection and try again.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

// ── Supabase calls ────────────────────────────────────────────

export async function fetchCurrentAuthUser(): Promise<{ id: string; email: string | null } | null> {
  if (!SUPABASE_CONFIGURED) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export async function fetchOwnProfile(userId: string): Promise<ProfileResult<UserProfile>> {
  if (!SUPABASE_CONFIGURED) {
    return { ok: false, error: 'config_missing', message: normalizeProfileError('config_missing') };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, role, created_at')
    .eq('id', userId)
    .single();

  if (error) {
    // PGRST116 = no rows returned
    if (error.code === 'PGRST116') {
      return { ok: false, error: 'not_found', message: normalizeProfileError('not_found') };
    }
    return { ok: false, error: 'network_error', message: error.message };
  }

  return {
    ok: true,
    data: {
      id: data.id as string,
      displayName: data.display_name as string | null,
      role: data.role as ProfileRole,
      createdAt: data.created_at as string,
    },
  };
}

export async function updateOwnDisplayName(
  userId: string,
  payload: ProfileUpdatePayload,
): Promise<ProfileResult> {
  if (!SUPABASE_CONFIGURED) {
    return { ok: false, error: 'config_missing', message: normalizeProfileError('config_missing') };
  }

  const patch = buildProfileUpdatePayload(payload);

  const { error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId);

  if (error) {
    return { ok: false, error: 'network_error', message: error.message };
  }

  return { ok: true };
}
