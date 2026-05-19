/**
 * Admin client API — thin wrappers over edgeFunctions.adminUsers().
 * Pure pass-through; never holds service-role keys.
 *
 * Pure helpers live in adminHelpers.ts so unit tests can avoid loading
 * the Supabase client.
 */
import { adminUsers } from '../../lib/edgeFunctions';
import type { AdminUsersResult } from '../../lib/edgeFunctions';
import { buildAuthRedirectUrl } from '../../lib/auth/buildAuthRedirectUrl';
import { resolveRuntimeOrigin, getIsDev } from '../../lib/auth/resolveRuntimeOrigin';
import type {
  AdminUserSummary,
  AdminUserDetail,
  AdminBlockRule,
  AdminViewAsSnapshot,
  AdminAuditEvent,
} from './types';
import type { ProfileRole } from '../account/types';
import {
  buildUpdateRolePayload,
  normalizeBlockValueClient,
  summarizeAuditPayload,
  adminErrorMessage,
  PROTECTED_PROFILE_FIELDS,
} from './adminHelpers';

// Re-export pure helpers
export {
  buildUpdateRolePayload,
  normalizeBlockValueClient,
  summarizeAuditPayload,
  adminErrorMessage,
  PROTECTED_PROFILE_FIELDS,
};

// ── Wrappers ──────────────────────────────────────────────────

export async function adminListUsers(input: {
  search?: string;
  role?: ProfileRole;
  botOnly?: boolean;
  page?: number;
  perPage?: number;
}): Promise<AdminUsersResult<{ users: AdminUserSummary[]; page: number; perPage: number }>> {
  return adminUsers({ action: 'list_users', ...input });
}

export async function adminGetUserDetail(userId: string): Promise<AdminUsersResult<AdminUserDetail>> {
  return adminUsers({ action: 'get_user_detail', userId });
}

export async function adminCreateUser(input: {
  email: string;
  password?: string;
  displayName?: string;
  role?: ProfileRole;
  isBot?: boolean;
  persona?: string;
  emailConfirm?: boolean;
  confirmAdminCreate?: boolean;
}): Promise<AdminUsersResult<{ userId: string; email: string; role: ProfileRole; isBot: boolean }>> {
  return adminUsers({ action: 'create_user', ...input });
}

export async function adminCreateBotUser(input: {
  label: string;
  email: string;
  password?: string;
  persona?: string;
  displayName?: string;
  enabled?: boolean;
}): Promise<AdminUsersResult<{ userId: string; email: string; botRegistryId: string; label: string }>> {
  return adminUsers({ action: 'create_bot_user', ...input });
}

export async function adminUpdateRole(input: {
  userId: string;
  role: ProfileRole;
  reason: string;
  confirmAdminGrant?: boolean;
}): Promise<AdminUsersResult<{ userId: string; role: ProfileRole }>> {
  return adminUsers(buildUpdateRolePayload(input));
}

export async function adminSendPasswordReset(input: {
  userId?: string;
  email?: string;
  redirectTo?: string;
}): Promise<AdminUsersResult<{ sent: true }>> {
  // QOL-023: when the caller passes no explicit redirectTo, derive one from
  // buildAuthRedirectUrl so the admin-triggered reset email points at the
  // deployed origin's /auth/reset route instead of the dashboard Site URL.
  // A bad origin degrades to `undefined` — the Edge Function then falls back
  // to the dashboard Site URL. The function signature is unchanged.
  let redirectTo = input.redirectTo;
  if (!redirectTo) {
    try {
      redirectTo = buildAuthRedirectUrl({
        kind: 'password_reset',
        runtimeOrigin: resolveRuntimeOrigin(),
        isDev: getIsDev(),
      });
    } catch {
      redirectTo = undefined;
    }
  }
  return adminUsers({ action: 'send_password_reset', ...input, redirectTo });
}

export async function adminSetTemporaryPassword(input: {
  userId: string;
  temporaryPassword: string;
  reason: string;
  botOnly?: boolean;
}): Promise<AdminUsersResult<{ userId: string; passwordChanged: true }>> {
  return adminUsers({
    action: 'set_temporary_password',
    botOnly: input.botOnly ?? true,
    ...input,
  });
}

export async function adminDisableUser(input: {
  userId: string;
  reason: string;
  until?: string;
}): Promise<AdminUsersResult<{ userId: string; disabled: true; until: string }>> {
  return adminUsers({ action: 'disable_user', ...input });
}

export async function adminEnableUser(input: {
  userId: string;
  reason: string;
}): Promise<AdminUsersResult<{ userId: string; disabled: false }>> {
  return adminUsers({ action: 'enable_user', ...input });
}

export async function adminSoftDeleteUser(input: {
  userId: string;
  reason: string;
}): Promise<AdminUsersResult<{ userId: string; softDeleted: true }>> {
  return adminUsers({ action: 'soft_delete_user', confirm: true, ...input });
}

export async function adminListBlocks(input: { active?: boolean } = {}): Promise<AdminUsersResult<{ blocks: AdminBlockRule[] }>> {
  return adminUsers({ action: 'list_blocks', ...input });
}

export async function adminAddBlock(input: {
  blockType: 'email' | 'email_domain' | 'ip' | 'ip_cidr' | 'profile';
  value: string;
  reason: string;
}): Promise<AdminUsersResult<{ block: AdminBlockRule }>> {
  return adminUsers({ action: 'add_block', ...input });
}

export async function adminRemoveBlock(input: {
  blockRuleId: string;
  reason: string;
}): Promise<AdminUsersResult<{ block: AdminBlockRule }>> {
  return adminUsers({ action: 'remove_block', ...input });
}

export async function adminViewAsSnapshot(input: {
  targetUserId: string;
  context?: {
    roomId?: string;
    includeRecentArguments?: boolean;
    includeRooms?: boolean;
    includeBotRegistry?: boolean;
  };
}): Promise<AdminUsersResult<AdminViewAsSnapshot>> {
  return adminUsers({ action: 'view_as_snapshot', ...input });
}

/**
 * History query helper. Server returns audit events targeted at user;
 * for the History tab we just paginate over what list_users returns recently.
 * For now history is a thin filtered slice via get_user_detail; a dedicated
 * list_history action can be added in a later stage.
 */
export type { AdminAuditEvent };
