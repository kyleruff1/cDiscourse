/**
 * MCP-021C-EDGE — Typed test bridge into the Deno booleanObservations tree.
 *
 * The Deno mirror at `supabase/functions/_shared/booleanObservations/`
 * uses `.ts`-extension import specifiers for Deno compatibility. `tsc`
 * cannot resolve those (and `supabase/functions` is excluded from the
 * project compile) but Jest's babel transform CAN execute them at
 * runtime.
 *
 * This bridge loads the REAL Deno mirror modules via `require()` —
 * which `tsc` does NOT follow into — and re-exports them with canonical
 * type names from `src/`, so the behavioural test files stay fully
 * type-safe without dragging the Deno tree into `tsc`.
 *
 * Mirrors the convention established by
 * __tests__/_helpers/semanticRefereeDeno.ts (MCP-016/017/018).
 *
 * The Deno-side adapter `booleanObservationMcpAdapter.ts` is NOT bridged
 * here — it reads `Deno.env.get` and uses `fetch`, neither of which Jest
 * can load. It is covered by source-scan tests instead. The pure helper
 * modules (`booleanObservationMcpAdapterCore.ts`, `mcpBooleanObservationSchema.ts`,
 * `machineObservationDefinitions.ts`, `familyRegistry.ts`,
 * `booleanObservationRequestBuilder.ts`, `runModeConstants.ts`) ARE
 * Jest-loadable and are bridged below.
 *
 * This file is NOT a test suite — it has no `*.test.ts` name.
 */
import type {
  McpBooleanObservationRequest,
  McpBooleanObservationResponse,
  McpBooleanObservationParseResult,
  McpBooleanObservationParseFailureReason,
  BuildRequestInput,
  SanitizeOptions,
} from '../../src/features/nodeLabels/mcpBooleanObservationSchema';
import type {
  MachineObservationDefinition,
  MachineObservationFamily,
  NodeLabelMark,
  NodeLabelSource,
} from '../../src/features/nodeLabels/nodeLabelTypes';

const BO = '../../supabase/functions/_shared/booleanObservations';

// ── nodeLabelTypes.ts (mirror) ─────────────────────────────────────

const nodeLabelTypesModule = require(`${BO}/nodeLabelTypes`) as {
  ALL_NODE_LABEL_KINDS: ReadonlyArray<string>;
  ALL_NODE_LABEL_SOURCES: ReadonlyArray<NodeLabelSource>;
  ALL_NODE_LABEL_SURFACES: ReadonlyArray<string>;
  ALL_NODE_LABEL_DISPOSITIONS: ReadonlyArray<string>;
  ALL_MACHINE_OBSERVATION_FAMILIES: ReadonlyArray<MachineObservationFamily>;
};

export const EDGE_ALL_NODE_LABEL_KINDS = nodeLabelTypesModule.ALL_NODE_LABEL_KINDS;
export const EDGE_ALL_NODE_LABEL_SOURCES = nodeLabelTypesModule.ALL_NODE_LABEL_SOURCES;
export const EDGE_ALL_NODE_LABEL_SURFACES = nodeLabelTypesModule.ALL_NODE_LABEL_SURFACES;
export const EDGE_ALL_NODE_LABEL_DISPOSITIONS = nodeLabelTypesModule.ALL_NODE_LABEL_DISPOSITIONS;
export const EDGE_ALL_MACHINE_OBSERVATION_FAMILIES =
  nodeLabelTypesModule.ALL_MACHINE_OBSERVATION_FAMILIES;

// ── machineObservationRegistry.ts (mirror — narrow) ────────────────

const registryModule = require(`${BO}/machineObservationRegistry`) as {
  makeMachineObservationKey: (source: NodeLabelSource, rawKey: string) => string;
};

export const edgeMakeMachineObservationKey = registryModule.makeMachineObservationKey;

// ── machineObservationDefinitions.ts (mirror aggregator) ───────────

const definitionsModule = require(`${BO}/machineObservationDefinitions`) as {
  MACHINE_OBSERVATION_DEFINITIONS_REGISTRY: Readonly<Record<string, MachineObservationDefinition>>;
  MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY: Readonly<Record<string, MachineObservationDefinition>>;
  lookupMachineObservationDefinition: (rawKey: string) => MachineObservationDefinition | null;
  lookupMachineObservationDefinitionByCompoundKey: (
    source: NodeLabelSource,
    rawKey: string,
  ) => MachineObservationDefinition | null;
  ALL_MACHINE_OBSERVATION_DEFINITION_KEYS: ReadonlyArray<string>;
  ALL_MACHINE_OBSERVATION_DEFINITION_RAW_KEYS: ReadonlyArray<string>;
  getDefinitionsForFamily: (
    family: MachineObservationFamily,
  ) => ReadonlyArray<MachineObservationDefinition>;
  _INTERNAL_ALL_DEFINITIONS: ReadonlyArray<MachineObservationDefinition>;
};

export const EDGE_MACHINE_OBSERVATION_DEFINITIONS_REGISTRY =
  definitionsModule.MACHINE_OBSERVATION_DEFINITIONS_REGISTRY;
export const EDGE_MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY =
  definitionsModule.MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY;
export const edgeLookupMachineObservationDefinition =
  definitionsModule.lookupMachineObservationDefinition;
export const edgeLookupMachineObservationDefinitionByCompoundKey =
  definitionsModule.lookupMachineObservationDefinitionByCompoundKey;
export const EDGE_ALL_MACHINE_OBSERVATION_DEFINITION_KEYS =
  definitionsModule.ALL_MACHINE_OBSERVATION_DEFINITION_KEYS;
export const EDGE_ALL_MACHINE_OBSERVATION_DEFINITION_RAW_KEYS =
  definitionsModule.ALL_MACHINE_OBSERVATION_DEFINITION_RAW_KEYS;
export const edgeGetDefinitionsForFamily = definitionsModule.getDefinitionsForFamily;
export const EDGE_INTERNAL_ALL_DEFINITIONS = definitionsModule._INTERNAL_ALL_DEFINITIONS;

// ── mcpBooleanObservationSchema.ts (mirror parser) ─────────────────

const schemaModule = require(`${BO}/mcpBooleanObservationSchema`) as {
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION: string;
  parseMcpBooleanObservationResponse: (
    candidate: unknown,
  ) => McpBooleanObservationParseResult;
  sanitizeMcpBooleanObservationResponse: (
    parsed: McpBooleanObservationResponse,
    options: SanitizeOptions,
  ) => McpBooleanObservationResponse;
  buildMcpBooleanObservationRequest: (input: BuildRequestInput) => McpBooleanObservationRequest;
  mcpResponseToNodeLabelMarks: (
    response: McpBooleanObservationResponse,
    options: SanitizeOptions,
  ) => NodeLabelMark[];
};

export const EDGE_MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION =
  schemaModule.MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION;
export const edgeParseMcpBooleanObservationResponse =
  schemaModule.parseMcpBooleanObservationResponse;
export const edgeSanitizeMcpBooleanObservationResponse =
  schemaModule.sanitizeMcpBooleanObservationResponse;
export const edgeBuildMcpBooleanObservationRequest =
  schemaModule.buildMcpBooleanObservationRequest;
export const edgeMcpResponseToNodeLabelMarks = schemaModule.mcpResponseToNodeLabelMarks;

// ── booleanObservationMcpAdapterCore.ts (pure, zod-free) ───────────

export type BooleanObservationUnavailableReason =
  | 'url_missing'
  | 'token_missing'
  | 'api_error'
  | 'rate_limited'
  | 'network_error'
  | 'parse_failure'
  | 'validation_failed';

export type BooleanObservationAdapterResult =
  | { kind: 'success'; response: McpBooleanObservationResponse }
  | { kind: 'unavailable'; reason: BooleanObservationUnavailableReason };

const adapterCoreModule = require(`${BO}/booleanObservationMcpAdapterCore`) as {
  MCP_BOOLEAN_OBSERVATION_TOOL_NAME: string;
  MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS: number;
  DEFAULT_MCP_BOOLEAN_OBSERVATION_SERVER_NAME: string;
  DEFAULT_MCP_BOOLEAN_OBSERVATION_CLASSIFIER_SET_VERSION: string;
  ALL_BOOLEAN_OBSERVATION_UNAVAILABLE_REASONS: readonly BooleanObservationUnavailableReason[];
  buildBooleanObservationToolRequestBody: (
    request: McpBooleanObservationRequest,
  ) => Record<string, unknown>;
  extractBooleanObservationResponse: (responseJson: unknown) => unknown | null;
  sanitizeBooleanObservationRawPayload: (raw: unknown) => Record<string, unknown>;
};

export const EDGE_MCP_BOOLEAN_OBSERVATION_TOOL_NAME =
  adapterCoreModule.MCP_BOOLEAN_OBSERVATION_TOOL_NAME;
export const EDGE_MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS =
  adapterCoreModule.MCP_BOOLEAN_OBSERVATION_REQUEST_TIMEOUT_MS;
export const EDGE_DEFAULT_MCP_BOOLEAN_OBSERVATION_SERVER_NAME =
  adapterCoreModule.DEFAULT_MCP_BOOLEAN_OBSERVATION_SERVER_NAME;
export const EDGE_DEFAULT_MCP_BOOLEAN_OBSERVATION_CLASSIFIER_SET_VERSION =
  adapterCoreModule.DEFAULT_MCP_BOOLEAN_OBSERVATION_CLASSIFIER_SET_VERSION;
export const EDGE_ALL_BOOLEAN_OBSERVATION_UNAVAILABLE_REASONS =
  adapterCoreModule.ALL_BOOLEAN_OBSERVATION_UNAVAILABLE_REASONS;
export const edgeBuildBooleanObservationToolRequestBody =
  adapterCoreModule.buildBooleanObservationToolRequestBody;
export const edgeExtractBooleanObservationResponse =
  adapterCoreModule.extractBooleanObservationResponse;
export const edgeSanitizeBooleanObservationRawPayload =
  adapterCoreModule.sanitizeBooleanObservationRawPayload;

// ── runModeConstants.ts ────────────────────────────────────────────

export type EdgeMachineObservationRunMode = 'production' | 'admin_validation';

const runModeModule = require(`${BO}/runModeConstants`) as {
  ALL_MACHINE_OBSERVATION_RUN_MODES: ReadonlyArray<EdgeMachineObservationRunMode>;
  isMachineObservationRunMode: (value: unknown) => boolean;
};

export const EDGE_ALL_MACHINE_OBSERVATION_RUN_MODES =
  runModeModule.ALL_MACHINE_OBSERVATION_RUN_MODES;
export const edgeIsMachineObservationRunMode = runModeModule.isMachineObservationRunMode;

// ── familyRegistry.ts ──────────────────────────────────────────────

export interface EdgeFamilyRegistryEntry {
  family: MachineObservationFamily;
  productionEnabled: boolean;
  adminValidationEnabled: boolean;
}

const familyRegistryModule = require(`${BO}/familyRegistry`) as {
  FAMILY_REGISTRY: ReadonlyArray<EdgeFamilyRegistryEntry>;
  lookupFamilyRegistryEntry: (
    family: MachineObservationFamily | string,
  ) => EdgeFamilyRegistryEntry | null;
  filterFamiliesForMode: (
    requestedFamilies: ReadonlyArray<MachineObservationFamily>,
    mode: EdgeMachineObservationRunMode,
  ) => ReadonlyArray<MachineObservationFamily>;
  productionEnabledFamilies: () => ReadonlyArray<MachineObservationFamily>;
  adminValidationEnabledFamilies: () => ReadonlyArray<MachineObservationFamily>;
};

export const EDGE_FAMILY_REGISTRY = familyRegistryModule.FAMILY_REGISTRY;
export const edgeLookupFamilyRegistryEntry = familyRegistryModule.lookupFamilyRegistryEntry;
export const edgeFilterFamiliesForMode = familyRegistryModule.filterFamiliesForMode;
export const edgeProductionEnabledFamilies = familyRegistryModule.productionEnabledFamilies;
export const edgeAdminValidationEnabledFamilies =
  familyRegistryModule.adminValidationEnabledFamilies;

// ── booleanObservationRequestBuilder.ts ────────────────────────────

export interface EdgeBuildBooleanObservationRequestInput {
  argumentId: string;
  parentArgumentId: string | null;
  currentText: string;
  parentText: string | null;
  threadContextExcerpt: string;
  requestedFamilies: ReadonlyArray<MachineObservationFamily>;
  mode: EdgeMachineObservationRunMode;
  timeoutMs?: number;
}

const requestBuilderModule = require(`${BO}/booleanObservationRequestBuilder`) as {
  buildBooleanObservationRequestForArgument: (
    input: EdgeBuildBooleanObservationRequestInput,
  ) => McpBooleanObservationRequest;
  buildBooleanObservationInputHash: (input: {
    argumentId: string;
    schemaVersion: string;
    runMode: EdgeMachineObservationRunMode;
    families: ReadonlyArray<string>;
  }) => string;
  getMcpServerSupportedFamilySources: (
    family: MachineObservationFamily,
  ) => ReadonlySet<string> | undefined;
};

export const edgeBuildBooleanObservationRequestForArgument =
  requestBuilderModule.buildBooleanObservationRequestForArgument;
export const edgeBuildBooleanObservationInputHash =
  requestBuilderModule.buildBooleanObservationInputHash;
export const edgeGetMcpServerSupportedFamilySources =
  requestBuilderModule.getMcpServerSupportedFamilySources;

// ── boundedConcurrencyRunner.ts (pure, adapter-free) ───────────────

export interface EdgeBoundedRunnerResult<T> {
  index: number;
  status: 'fulfilled' | 'rejected';
  value?: T;
  reason?: unknown;
}

const boundedConcurrencyRunnerModule = require(`${BO}/boundedConcurrencyRunner`) as {
  runWithBoundedConcurrency: <TItem, TResult>(
    items: ReadonlyArray<TItem>,
    limit: number,
    task: (item: TItem, index: number) => Promise<TResult>,
  ) => Promise<ReadonlyArray<EdgeBoundedRunnerResult<TResult>>>;
};

export const edgeRunWithBoundedConcurrency =
  boundedConcurrencyRunnerModule.runWithBoundedConcurrency;

// ── autoTriggerConcurrency.ts (pure, single-export constant) ───────

const autoTriggerConcurrencyModule = require(`${BO}/autoTriggerConcurrency`) as {
  MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES: number;
};

export const edgeMaxAutoTriggerConcurrentFamilies =
  autoTriggerConcurrencyModule.MAX_AUTO_TRIGGER_CONCURRENT_FAMILIES;

// ── Re-export types for test convenience ───────────────────────────

export type {
  McpBooleanObservationRequest,
  McpBooleanObservationResponse,
  McpBooleanObservationParseResult,
  McpBooleanObservationParseFailureReason,
};
