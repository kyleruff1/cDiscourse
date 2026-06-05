/**
 * OPS-MCP-OBSERVABILITY-002 — zod filter schema for the admin-classifier-health
 * Edge read function.
 *
 * Validates the request body: the scalar filters (status / state / family /
 * run_mode / failure_reason / failure_sub_reason / failure_detail.reason), the
 * time window (fromIso / toIso), the runTag, and the response format. Unknown
 * keys are REJECTED (`z.strictObject`) so a smuggled `body` / `evidence_span` /
 * `select` key cannot ride the request.
 *
 * The filter body is read-only — there is NO action verb, NO write field, NO
 * re-trigger / arm / flip control. The schema shape itself guarantees the
 * request cannot ask the function to mutate anything.
 *
 * Deno-only (npm:zod@4). Mirrors the `_shared/adminSchemas.ts` posture.
 */
import { z } from 'npm:zod@4';

/** A bounded, single-line scalar filter value. */
const ScalarFilter = z.string().trim().min(1).max(120);

/**
 * The filter request body. `z.strictObject` rejects any key not listed here —
 * a smuggled `body` / `select` / `evidence_span` / `columns` key fails
 * validation rather than being silently stripped.
 */
export const AdminClassifierHealthRequestSchema = z.strictObject({
  status: ScalarFilter.optional(),
  state: ScalarFilter.optional(),
  family: ScalarFilter.optional(),
  run_mode: ScalarFilter.optional(),
  failure_reason: ScalarFilter.optional(),
  failure_sub_reason: ScalarFilter.optional(),
  failure_detail_reason: ScalarFilter.optional(),
  /** Time-window lower bound (inclusive), ISO-8601. */
  from_iso: z.string().datetime().optional(),
  /** Time-window upper bound (exclusive), ISO-8601. */
  to_iso: z.string().datetime().optional(),
  /** runTag — derived from the debate-title suffix heuristic (Q3). */
  run_tag: ScalarFilter.optional(),
  /** Response format. `json` (default) or `csv` (metadata-only export). */
  format: z.enum(['json', 'csv']).optional(),
});

export type AdminClassifierHealthRequest = z.infer<typeof AdminClassifierHealthRequestSchema>;
