/**
 * Admin audit helpers — insert a row in admin_audit_events for every action.
 *
 * Never log secrets, raw tokens, or passwords. Sanitize payloads before insert.
 */
import { createServiceClient } from './supabaseClients.ts';

export const WHITELISTED_ACTIONS = [
  'list_users',
  'get_user_detail',
  'create_user',
  'create_bot_user',
  'update_role',
  'invite_user',
  'send_password_reset',
  'set_temporary_password',
  'disable_user',
  'enable_user',
  'soft_delete_user',
  'list_blocks',
  'add_block',
  'remove_block',
  'view_as_snapshot',
  // ADMIN-AI-001 — semantic-referee runtime provider-mode config.
  'get_semantic_config',
  'set_semantic_config',
  // ADMIN-ARGS-INACTIVE-001 — per-argument inactive visibility state.
  'set_argument_inactive',
  'bulk_set_argument_inactive',
] as const;

export type AdminAuditAction = typeof WHITELISTED_ACTIONS[number];

export function isWhitelistedAction(action: string): action is AdminAuditAction {
  return (WHITELISTED_ACTIONS as readonly string[]).includes(action);
}

const SENSITIVE_KEYS = new Set([
  'password',
  'temporary_password',
  'temporaryPassword',
  'access_token',
  'refresh_token',
  'token',
  'token_hash',
  'service_role_key',
  'anon_key',
  'api_key',
  'apikey',
]);

/**
 * Recursively strip sensitive keys from a payload. Replaces values with '[redacted]'.
 */
export function sanitizePayload(input: unknown): unknown {
  if (input === null || typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map(sanitizePayload);

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(k)) {
      out[k] = '[redacted]';
    } else {
      out[k] = sanitizePayload(v);
    }
  }
  return out;
}

export interface AdminAuditInput {
  actorUserId: string;
  targetUserId?: string | null;
  targetAuthUserId?: string | null;
  action: AdminAuditAction;
  reason?: string | null;
  source?: 'admin_ui' | 'edge_function' | 'sql_editor' | 'system';
  payload?: unknown;
}

/**
 * Write an admin audit event. Failures are logged but do not propagate
 * to the user — audit failure must not break the action result.
 */
export async function writeAdminAudit(input: AdminAuditInput): Promise<void> {
  try {
    const serviceClient = createServiceClient();
    await serviceClient.from('admin_audit_events').insert({
      actor_user_id: input.actorUserId,
      target_user_id: input.targetUserId ?? null,
      target_auth_user_id: input.targetAuthUserId ?? null,
      action: input.action,
      reason: input.reason ?? null,
      source: input.source ?? 'edge_function',
      payload: sanitizePayload(input.payload ?? {}) as object,
    });
  } catch (err) {
    // Log to function logs; do not surface to caller.
    // eslint-disable-next-line no-console
    console.error('admin_audit_write_failed', err);
  }
}
