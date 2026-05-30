/**
 * OPS-MCP-RESULT-VALIDATION-BURST-HARDENING — Phase 1 test bridge.
 *
 * Loads the REAL Deno mirror module
 * `supabase/functions/_shared/booleanObservations/booleanObservationFailureSubreason.ts`
 * via `require()` (Jest's babel transform executes the `.ts`-extension
 * import specifiers `tsc` cannot resolve) and re-exports its pure surface
 * with canonical type names from `src/`.
 *
 * The module is pure TS (only type-only imports + a registry value
 * import), so unlike `classifyArgumentCore.ts` / the Deno adapter (which
 * pull `Deno.env.get` + `npm:@supabase/supabase-js` through
 * `supabaseClients.ts` and are NOT Jest-loadable) it IS behaviorally
 * testable.
 *
 * Mirrors the convention in `_helpers/booleanObservationEdgeDeno.ts`.
 * This file is NOT a test suite — it has no `*.test.ts` name.
 */
import type {
  McpBooleanObservationParseFailureReason,
} from '../../src/features/nodeLabels/mcpBooleanObservationSchema';
import type { MachineObservationFamily } from '../../src/features/nodeLabels/nodeLabelTypes';

const BO = '../../supabase/functions/_shared/booleanObservations';

export type BooleanObservationUnavailableReason =
  | 'url_missing'
  | 'token_missing'
  | 'api_error'
  | 'rate_limited'
  | 'network_error'
  | 'parse_failure'
  | 'validation_failed';

export type BooleanObservationFailureSubreason =
  | 'request_unsupported_family'
  | 'request_unsupported_raw_key'
  | 'request_invalid_source_subset'
  | 'response_not_json'
  | 'response_wrong_schema_version'
  | 'response_wrong_shape'
  | 'response_missing_required_field'
  | 'response_flag_count_too_high'
  | 'response_evidence_span_invalid'
  | 'response_ban_list_violation'
  | 'provider_timeout'
  | 'provider_rate_limited'
  | 'provider_api_error'
  | 'provider_network_error'
  | 'unknown';

export interface BooleanObservationFailureDetail {
  validatorReason?: McpBooleanObservationParseFailureReason;
  path?: string;
  expected?: string;
  receivedType?: string;
  receivedKeys?: string[];
  checkedRawKey?: string;
  schemaVersion?: string;
  family?: MachineObservationFamily;
}

export interface FailureDetailInput {
  validatorReason?: McpBooleanObservationParseFailureReason;
  path?: string;
  expected?: string;
  received?: unknown;
  receivedKeysFrom?: unknown;
  checkedRawKey?: string;
  schemaVersion?: string;
  family?: MachineObservationFamily;
}

const subreasonModule = require(`${BO}/booleanObservationFailureSubreason`) as {
  ALL_BOOLEAN_OBSERVATION_FAILURE_SUBREASONS: readonly BooleanObservationFailureSubreason[];
  mapToFailureSubreason: (
    adapterReason: BooleanObservationUnavailableReason,
    validatorReason?: McpBooleanObservationParseFailureReason,
  ) => BooleanObservationFailureSubreason | undefined;
  buildFailureDetail: (input: FailureDetailInput) => BooleanObservationFailureDetail | undefined;
};

export const EDGE_ALL_BOOLEAN_OBSERVATION_FAILURE_SUBREASONS =
  subreasonModule.ALL_BOOLEAN_OBSERVATION_FAILURE_SUBREASONS;
export const edgeMapToFailureSubreason = subreasonModule.mapToFailureSubreason;
export const edgeBuildFailureDetail = subreasonModule.buildFailureDetail;

// A known registry rawKey for the `checkedRawKey` allowlist tests — pulled
// from the live registry mirror so the test never hard-codes a key that
// could drift.
const definitionsModule = require(`${BO}/machineObservationDefinitions`) as {
  ALL_MACHINE_OBSERVATION_DEFINITION_RAW_KEYS: ReadonlyArray<string>;
};

export function edgeAnyRegistryRawKey(): string {
  const keys = definitionsModule.ALL_MACHINE_OBSERVATION_DEFINITION_RAW_KEYS;
  if (!keys || keys.length === 0) {
    throw new Error('registry has no rawKeys — bridge mis-wired');
  }
  return keys[0];
}
