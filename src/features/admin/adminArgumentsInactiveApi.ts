/**
 * ADMIN-ARGS-INACTIVE-001 — typed client wrapper for the admin-users
 * per-argument inactive visibility actions.
 *
 * Thin pass-throughs over `adminUsers({ action: ... })`, mirroring
 * `semanticRefereeConfigApi.ts`. The client never holds a service-role
 * key — the `admin-users` Edge Function verifies the JWT and checks
 * `profiles.role = 'admin'` before any read or write.
 *
 * Doctrine:
 *   - The wire never carries an inactive_at timestamp; the Edge handler
 *     stamps `now()` server-side.
 *   - Bulk cap is 100; the Edge zod schema enforces it. Callers should
 *     pre-cap to give a clean UX message before the round-trip.
 *   - `markActive` wrappers exist purely for call-site clarity — the wire
 *     shape is identical to `markInactive` with `inactive: false`.
 */
import { adminUsers } from '../../lib/edgeFunctions';
import type {
  AdminUsersResult,
  SetArgumentInactiveInput,
  BulkSetArgumentInactiveInput,
  SetArgumentInactiveResponse,
  BulkInactiveResponse,
} from '../../lib/edgeFunctions';

/** Mark a single argument inactive. Reversible via `markArgumentActive`. */
export async function markArgumentInactive(
  argumentId: string,
  reason?: string,
): Promise<AdminUsersResult<SetArgumentInactiveResponse>> {
  const input: SetArgumentInactiveInput = { argumentId, inactive: true, reason };
  return adminUsers<SetArgumentInactiveResponse>({
    action: 'set_argument_inactive',
    argumentId: input.argumentId,
    inactive: input.inactive,
    reason: input.reason,
  });
}

/** Flip a single inactive argument back to active. Records a symmetric audit row. */
export async function markArgumentActive(
  argumentId: string,
  reason?: string,
): Promise<AdminUsersResult<SetArgumentInactiveResponse>> {
  const input: SetArgumentInactiveInput = { argumentId, inactive: false, reason };
  return adminUsers<SetArgumentInactiveResponse>({
    action: 'set_argument_inactive',
    argumentId: input.argumentId,
    inactive: input.inactive,
    reason: input.reason,
  });
}

/** Bulk mark inactive (1..100 ids). Per-id result map. */
export async function bulkMarkArgumentInactive(
  argumentIds: string[],
  reason?: string,
): Promise<AdminUsersResult<BulkInactiveResponse>> {
  const input: BulkSetArgumentInactiveInput = { argumentIds, inactive: true, reason };
  return adminUsers<BulkInactiveResponse>({
    action: 'bulk_set_argument_inactive',
    argumentIds: input.argumentIds,
    inactive: input.inactive,
    reason: input.reason,
  });
}

/** Bulk flip inactive arguments back to active (1..100 ids). Per-id result map. */
export async function bulkMarkArgumentActive(
  argumentIds: string[],
  reason?: string,
): Promise<AdminUsersResult<BulkInactiveResponse>> {
  const input: BulkSetArgumentInactiveInput = { argumentIds, inactive: false, reason };
  return adminUsers<BulkInactiveResponse>({
    action: 'bulk_set_argument_inactive',
    argumentIds: input.argumentIds,
    inactive: input.inactive,
    reason: input.reason,
  });
}
