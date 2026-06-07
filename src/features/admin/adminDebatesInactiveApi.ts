/**
 * ADMIN-CONV-INACTIVE-001 — typed client wrapper for the admin-users
 * per-DEBATE (conversation) inactive visibility actions.
 *
 * The debate-level mirror of `adminArgumentsInactiveApi.ts`. Thin
 * pass-throughs over `adminUsers({ action: ... })`. The client never holds a
 * service-role key — the `admin-users` Edge Function verifies the JWT and
 * checks `profiles.role = 'admin'` before any read or write.
 *
 * Doctrine:
 *   - The wire never carries an inactive_at timestamp; the Edge handler stamps
 *     `now()` server-side.
 *   - Bulk cap is 100; the Edge zod schema enforces it. Callers should pre-cap
 *     to give a clean UX message before the round-trip.
 *   - `markActive` wrappers exist purely for call-site clarity — the wire shape
 *     is identical to `markInactive` with `inactive: false`.
 *   - The response never carries another row's `inactive_reason` (§10a).
 */
import { adminUsers } from '../../lib/edgeFunctions';
import type {
  AdminUsersResult,
  SetDebateInactiveInput,
  BulkSetDebateInactiveInput,
  SetDebateInactiveResponse,
  BulkDebateInactiveResponse,
} from '../../lib/edgeFunctions';

/** Mark a single debate inactive. Reversible via `markDebateActive`. */
export async function markDebateInactive(
  debateId: string,
  reason?: string,
): Promise<AdminUsersResult<SetDebateInactiveResponse>> {
  const input: SetDebateInactiveInput = { debateId, inactive: true, reason };
  return adminUsers<SetDebateInactiveResponse>({
    action: 'set_debate_inactive',
    debateId: input.debateId,
    inactive: input.inactive,
    reason: input.reason,
  });
}

/** Flip a single inactive debate back to active. Records a symmetric audit row. */
export async function markDebateActive(
  debateId: string,
  reason?: string,
): Promise<AdminUsersResult<SetDebateInactiveResponse>> {
  const input: SetDebateInactiveInput = { debateId, inactive: false, reason };
  return adminUsers<SetDebateInactiveResponse>({
    action: 'set_debate_inactive',
    debateId: input.debateId,
    inactive: input.inactive,
    reason: input.reason,
  });
}

/** Bulk mark inactive (1..100 ids). Per-id result map. */
export async function bulkMarkDebateInactive(
  debateIds: string[],
  reason?: string,
): Promise<AdminUsersResult<BulkDebateInactiveResponse>> {
  const input: BulkSetDebateInactiveInput = { debateIds, inactive: true, reason };
  return adminUsers<BulkDebateInactiveResponse>({
    action: 'bulk_set_debate_inactive',
    debateIds: input.debateIds,
    inactive: input.inactive,
    reason: input.reason,
  });
}

/** Bulk flip inactive debates back to active (1..100 ids). Per-id result map. */
export async function bulkMarkDebateActive(
  debateIds: string[],
  reason?: string,
): Promise<AdminUsersResult<BulkDebateInactiveResponse>> {
  const input: BulkSetDebateInactiveInput = { debateIds, inactive: false, reason };
  return adminUsers<BulkDebateInactiveResponse>({
    action: 'bulk_set_debate_inactive',
    debateIds: input.debateIds,
    inactive: input.inactive,
    reason: input.reason,
  });
}
