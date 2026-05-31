/**
 * ARCH-001 Card 2 — test bridge for the PURE drainer/routing modules.
 *
 * Loads the REAL Deno mirror modules via `require()` with a TEMPLATE-LITERAL
 * path so `tsc` does NOT statically follow the `.ts`-extension import
 * specifiers into the (excluded) `supabase/functions` tree, while Jest's
 * babel transform executes them at runtime. Re-exports their pure surface
 * with canonical type names from `src/`.
 *
 * The bridged modules are pure TS (type-only imports + pure module imports —
 * familyRegistry / mcpBooleanObservationSchema):
 *   - classifierDrainerRetryPolicy.ts  (§A.9 retry table; type-only imports)
 *   - classifierQueueRouting.ts        (shouldRouteToQueue + enqueue shape)
 *   - booleanObservationMcpAdapterCore.ts (the 15s + 30s timeout constants;
 *                                          type-only imports)
 *   - familyRegistry.ts                (productionEnabledFamilies — pure)
 *
 * Mirrors the convention in `_helpers/booleanObservationFailureSubreasonDeno.ts`.
 * This file is NOT a test suite — it has no `*.test.ts` name.
 */
import type { MachineObservationFamily } from '../../src/features/nodeLabels/nodeLabelTypes';

const BO = '../../supabase/functions/_shared/booleanObservations';

// ── Local type mirrors (the real unions live in the Deno tree) ────────
export type BooleanObservationUnavailableReason =
  | 'url_missing'
  | 'token_missing'
  | 'api_error'
  | 'rate_limited'
  | 'network_error'
  | 'parse_failure'
  | 'validation_failed';

export type BooleanObservationFailureSubreason = string;

export type DrainerFailureDisposition = 'retry' | 'failed_terminal' | 'dead_letter';

export interface DrainerFailureDecision {
  disposition: DrainerFailureDisposition;
  failureReason: string;
  failureSubReason: BooleanObservationFailureSubreason | undefined;
  backoffSeconds: number;
  deadLetterReason: string | null;
}

export interface RoutingArgument {
  id: string;
  debate_id: string;
}
export interface RoutingDebate {
  id: string;
  title: string | null;
}

// ── classifierDrainerRetryPolicy ──────────────────────────────────────
const retryModule = require(`${BO}/classifierDrainerRetryPolicy`) as {
  DRAINER_MAX_ATTEMPTS: number;
  DRAINER_RETRY_BACKOFF_SECONDS: ReadonlyArray<number>;
  classifyDrainerFailure: (
    reason: BooleanObservationUnavailableReason,
    attemptCount: number,
    subReason?: BooleanObservationFailureSubreason,
  ) => DrainerFailureDecision;
  drainerUnavailableReasonToFailureReason: (reason: BooleanObservationUnavailableReason) => string;
};

export const DRAINER_MAX_ATTEMPTS = retryModule.DRAINER_MAX_ATTEMPTS;
export const DRAINER_RETRY_BACKOFF_SECONDS = retryModule.DRAINER_RETRY_BACKOFF_SECONDS;
export const classifyDrainerFailure = retryModule.classifyDrainerFailure;
export const drainerUnavailableReasonToFailureReason =
  retryModule.drainerUnavailableReasonToFailureReason;

// ── classifierQueueRouting ────────────────────────────────────────────
type EnqueueResult = { attemptedFamilies: string[]; ok: boolean };
const routingModule = require(`${BO}/classifierQueueRouting`) as {
  CLASSIFIER_QUEUE_SMOKE_TAG: string;
  CLASSIFIER_QUEUE_ROUTING_ENABLED_ENV: string;
  shouldRouteToQueue: (
    argument: RoutingArgument | null | undefined,
    debate: RoutingDebate | null | undefined,
    enabled: boolean,
  ) => boolean;
  enqueueClassifierJobs: (
    argumentId: string,
    debateId: string,
    serviceClient: unknown,
  ) => Promise<EnqueueResult>;
};

export const CLASSIFIER_QUEUE_SMOKE_TAG = routingModule.CLASSIFIER_QUEUE_SMOKE_TAG;
export const CLASSIFIER_QUEUE_ROUTING_ENABLED_ENV = routingModule.CLASSIFIER_QUEUE_ROUTING_ENABLED_ENV;
export const shouldRouteToQueue = routingModule.shouldRouteToQueue;
export const enqueueClassifierJobs = routingModule.enqueueClassifierJobs;

// ── familyRegistry (the production A–G list) ──────────────────────────
const familyModule = require(`${BO}/familyRegistry`) as {
  productionEnabledFamilies: () => ReadonlyArray<MachineObservationFamily>;
};
export const productionEnabledFamilies = familyModule.productionEnabledFamilies;

// ── mcpBooleanObservationSchema (the schema-version constant) ─────────
const schemaModule = require(`${BO}/mcpBooleanObservationSchema`) as {
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION: string;
};
export const MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION =
  schemaModule.MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION;

// ── booleanObservationMcpAdapterCore (the two timeout constants) ──────
const adapterCoreModule = require(`${BO}/booleanObservationMcpAdapterCore`) as {
  MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS: number;
  DRAINER_MCP_REQUEST_TIMEOUT_MS: number;
  ALL_BOOLEAN_OBSERVATION_UNAVAILABLE_REASONS: readonly BooleanObservationUnavailableReason[];
};
export const MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS =
  adapterCoreModule.MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS;
export const DRAINER_MCP_REQUEST_TIMEOUT_MS = adapterCoreModule.DRAINER_MCP_REQUEST_TIMEOUT_MS;
export const ALL_BOOLEAN_OBSERVATION_UNAVAILABLE_REASONS =
  adapterCoreModule.ALL_BOOLEAN_OBSERVATION_UNAVAILABLE_REASONS;
