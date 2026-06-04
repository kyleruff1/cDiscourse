/**
 * ADMIN-ARGS-INACTIVE-001 — zod schemas for the two new `admin-users` actions
 * that toggle the per-argument inactive visibility state.
 *
 * Kept in a small dedicated file (mirrors `adminSemanticConfigSchemas.ts`) so
 * the inactive-visibility concern is co-located; `adminSchemas.ts` extends its
 * `AdminUsersRequestSchema` discriminated union by importing these schemas.
 *
 * Doctrine:
 *   - The Edge handler computes `inactive_at = (inactive ? now() : NULL)`
 *     server-side. The client NEVER picks an `inactive_at` timestamp on the
 *     wire — this prevents arbitrary historical timestamps.
 *   - Bulk hard cap: 100 ids per call. The cap is stated by the deep design
 *     source three times (acceptance, HALT trigger, scope-in) and enforced
 *     by `.max(BULK_INACTIVE_ID_CAP)`.
 *   - Empty bulk lists are rejected (`.min(1)`).
 *   - Reason text is bounded (`.max(2000)`) to keep audit payloads sane.
 *     Optional in both single + bulk forms.
 */
import { z } from 'npm:zod@4';

/**
 * Hard cap on the number of ids a single bulk call may flip. The cap is
 * stated three times in the deep design source. Exported so the handler
 * source and the tests can refer to one literal.
 */
export const BULK_INACTIVE_ID_CAP = 100;

/** Optional admin-authored reason; bounded so audit payloads stay sane. */
const InactiveReason = z.string().min(1).max(2000).optional();

/**
 * Single-argument inactive transition.
 *
 * `inactive: true`  → handler stamps `inactive_at = now()`, `inactive_by = caller`.
 * `inactive: false` → handler clears `inactive_at = NULL`, `inactive_by = NULL`.
 * Both directions record an `argument_inactive_audit` row.
 */
export const SetArgumentInactiveSchema = z.object({
  action: z.literal('set_argument_inactive'),
  argumentId: z.string().uuid(),
  inactive: z.boolean(),
  reason: InactiveReason,
});

/**
 * Bulk inactive transition. Up to BULK_INACTIVE_ID_CAP ids per call.
 * Empty arrays are rejected. All ids must be uuid-shaped. The shared
 * `reason` (when supplied) applies to every id in the batch.
 */
export const BulkSetArgumentInactiveSchema = z.object({
  action: z.literal('bulk_set_argument_inactive'),
  argumentIds: z.array(z.string().uuid()).min(1).max(BULK_INACTIVE_ID_CAP),
  inactive: z.boolean(),
  reason: InactiveReason,
});

export type SetArgumentInactiveRequest = z.infer<typeof SetArgumentInactiveSchema>;
export type BulkSetArgumentInactiveRequest = z.infer<typeof BulkSetArgumentInactiveSchema>;

/**
 * Per-id result the handler returns for both single and bulk calls.
 * `ok: true`  → the column mutation landed AND the audit row was inserted.
 * `ok: false` → neither landed; `errorCode` carries the reason
 *               (`not_found` is the canonical case).
 */
export interface PerIdInactiveResult {
  argumentId: string;
  ok: boolean;
  errorCode?: string;
}

/**
 * Bulk response shape. `results` is per-id; `appliedCount` / `failedCount`
 * are the rolled-up counters so the UI can avoid recomputing.
 */
export interface BulkInactiveResponse {
  results: PerIdInactiveResult[];
  appliedCount: number;
  failedCount: number;
}
