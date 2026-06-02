/**
 * OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE — test bridge.
 *
 * Loads the REAL Deno module
 * `supabase/functions/_shared/booleanObservations/classifierRunRowFailureDetail.ts`
 * via `require()` (Jest's babel transform executes the `.ts`-extension import
 * specifiers `tsc` cannot resolve) so the leak-safety convergence gate runs
 * against the PRODUCTION builder, not a copy.
 *
 * The module is pure TS (no `Deno.` / `fetch` / `console` / `npm:` import), so
 * it IS behaviorally testable (unlike the drainer core, which pulls Deno deps).
 *
 * Mirrors `_helpers/booleanObservationFailureSubreasonDeno.ts`. NOT a test
 * suite — it has no `*.test.ts` name.
 */

const BO = '../../supabase/functions/_shared/booleanObservations';

export interface RunRowFailureDetail {
  validator_path?: string;
  reason?: string;
  family?: string;
  correlation_id?: string;
  attempt_count?: number;
  run_mode?: string;
  schema_version?: string;
}

export interface RunRowFailureDetailInput {
  validatorPath?: string;
  reason?: string;
  family?: string;
  correlationId?: string;
  attemptCount?: number;
  runMode?: string;
  schemaVersion?: string;
}

const mod = require(`${BO}/classifierRunRowFailureDetail`) as {
  buildRunRowFailureDetail: (
    input: RunRowFailureDetailInput,
  ) => RunRowFailureDetail | undefined;
};

export const edgeBuildRunRowFailureDetail = mod.buildRunRowFailureDetail;
