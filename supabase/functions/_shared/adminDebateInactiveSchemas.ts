/**
 * ADMIN-CONV-INACTIVE-001 — zod schemas for the two new `admin-users` actions
 * that toggle the per-DEBATE (conversation) inactive visibility state.
 *
 * The debate-level mirror of `adminInactiveSchemas.ts` (#480). Kept in a small
 * dedicated file so the conversation-inactive concern is co-located;
 * `adminSchemas.ts` extends its `AdminUsersRequestSchema` discriminated union
 * by importing these schemas.
 *
 * Doctrine:
 *   - The Edge handler computes `inactive_at = (inactive ? now() : NULL)`
 *     server-side. The client NEVER picks an `inactive_at` timestamp on the
 *     wire — this prevents arbitrary historical timestamps.
 *   - Bulk hard cap: 100 ids per call, enforced by `.max(...)`.
 *   - Empty bulk lists are rejected (`.min(1)`).
 *   - Reason text is bounded (`.max(2000)`) to keep audit payloads sane;
 *     stored in the AUDIT row ONLY, never echoed to the client. Optional in
 *     both single + bulk forms.
 */
import { z } from 'npm:zod@4';

/**
 * Hard cap on the number of ids a single bulk call may flip. Exported so the
 * handler source and the tests can refer to one literal.
 */
export const BULK_DEBATE_INACTIVE_ID_CAP = 100;

/** Optional admin-authored reason; bounded so audit payloads stay sane. */
const InactiveReason = z.string().min(1).max(2000).optional();

/**
 * Single-debate inactive transition.
 *
 * `inactive: true`  → handler stamps `inactive_at = now()`, `inactive_by = caller`.
 * `inactive: false` → handler clears `inactive_at = NULL`, `inactive_by = NULL`.
 * Both directions record a `debate_inactive_audit` row.
 */
export const SetDebateInactiveSchema = z.object({
  action: z.literal('set_debate_inactive'),
  debateId: z.string().uuid(),
  inactive: z.boolean(),
  reason: InactiveReason,
});

/**
 * Bulk inactive transition. Up to BULK_DEBATE_INACTIVE_ID_CAP ids per call.
 * Empty arrays are rejected. All ids must be uuid-shaped. The shared `reason`
 * (when supplied) applies to every id in the batch.
 */
export const BulkSetDebateInactiveSchema = z.object({
  action: z.literal('bulk_set_debate_inactive'),
  debateIds: z.array(z.string().uuid()).min(1).max(BULK_DEBATE_INACTIVE_ID_CAP),
  inactive: z.boolean(),
  reason: InactiveReason,
});

export type SetDebateInactiveRequest = z.infer<typeof SetDebateInactiveSchema>;
export type BulkSetDebateInactiveRequest = z.infer<typeof BulkSetDebateInactiveSchema>;

/**
 * Per-id result the handler returns for both single and bulk calls.
 * `ok: true`  → the column mutation landed AND the audit row was inserted.
 * `ok: false` → neither landed; `errorCode` carries the reason
 *               (`not_found` is the canonical case). The handler NEVER returns
 *               another row's `inactive_reason` — only `{debateId, ok, errorCode?}`.
 */
export interface PerIdDebateInactiveResult {
  debateId: string;
  ok: boolean;
  errorCode?: string;
}

/**
 * Bulk response shape. `results` is per-id; `appliedCount` / `failedCount`
 * are the rolled-up counters so the UI can avoid recomputing.
 */
export interface BulkDebateInactiveResponse {
  results: PerIdDebateInactiveResult[];
  appliedCount: number;
  failedCount: number;
}
