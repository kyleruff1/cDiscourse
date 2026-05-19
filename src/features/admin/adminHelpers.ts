/**
 * Pure helpers for admin payload construction and display.
 * No Supabase, no network, no React. Safe to unit-test in pure Node.
 */
import type { ProfileRole } from '../account/types';

export const PROTECTED_PROFILE_FIELDS: ReadonlyArray<string> = ['id', 'email', 'password'];

/**
 * Whitelist the fields the client may send when updating a role.
 * Excludes id/email/password — only role + reason + target id are allowed.
 */
export function buildUpdateRolePayload(input: {
  userId: string;
  role: ProfileRole;
  reason: string;
  confirmAdminGrant?: boolean;
}): {
  action: 'update_role';
  userId: string;
  role: ProfileRole;
  reason: string;
  confirmAdminGrant?: boolean;
} {
  return {
    action: 'update_role',
    userId: input.userId,
    role: input.role,
    reason: input.reason,
    ...(input.role === 'admin' ? { confirmAdminGrant: input.confirmAdminGrant === true } : {}),
  };
}

export function normalizeBlockValueClient(blockType: string, value: string): string {
  const trimmed = value.trim();
  if (blockType === 'email' || blockType === 'email_domain') {
    return trimmed.toLowerCase();
  }
  return trimmed;
}

export function summarizeAuditPayload(payload: Record<string, unknown>): string {
  const keys = Object.keys(payload);
  if (keys.length === 0) return '';
  return keys.map((k) => `${k}=${JSON.stringify(payload[k]).slice(0, 60)}`).join(', ');
}

export function adminErrorMessage(
  err: { error: string; reason?: string; detail?: string },
  status: number,
): string {
  if (status === 403 || err.error === 'forbidden') {
    return 'Admin access required.';
  }
  if (status === 401 || err.error === 'unauthorized') {
    return 'Sign in required.';
  }
  if (status === 404 || err.error === 'function_not_found') {
    return 'admin-users function is not deployed yet.';
  }
  // QOL-024: the invite mechanism needs operator setup. Map the internal code
  // to plain, operator-directed copy — the user never sees the snake_case code.
  if (err.error === 'invite_email_not_configured') {
    return 'Invite could not be sent — email is not configured. Ask the operator.';
  }
  if (err.detail) return err.detail;
  if (err.reason) return err.reason;
  return err.error;
}
