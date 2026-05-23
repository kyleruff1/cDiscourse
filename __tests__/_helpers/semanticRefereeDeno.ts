/**
 * MCP-016 / MCP-017 — typed test bridge into the Deno semantic-referee tree.
 *
 * The Deno `_shared/semanticReferee/*` modules use Deno-only import syntax
 * (`.ts`-extension specifiers, and `npm:zod@4` in `schema.ts`). `tsc` cannot
 * resolve those, and `supabase/functions` is excluded from the project
 * compile — exactly the established repo convention (see `adminSchemas.test.ts`
 * and `pointTagEligibilityMirror.test.ts`, which never `import` a `_shared`
 * Deno module either).
 *
 * Jest, however, CAN execute the zod-free Deno modules (its babel transform
 * resolves `.ts`-extension imports at runtime). This bridge loads the REAL
 * Deno modules via `require()` — which `tsc` does NOT follow into — and
 * re-exports them with the canonical types from `src/`, so the behavioural
 * test files stay fully type-safe without dragging the Deno tree into `tsc`.
 *
 * Only the zod-free Deno modules are bridged here. `schema.ts` / `providers.ts`
 * / `anthropicProvider.ts` / `providerRouting.ts` (which import `npm:zod@4`
 * directly or transitively) are NOT loadable by Jest and are covered instead by
 * the `adminSchemas.test.ts`-style re-declared-schema + source-scan tests.
 *
 * MCP-017 NOTE: `providerRouting.ts` became zod-coupled (its
 * `DEFAULT_PROVIDER_DEPS` wires the live `anthropicProvider.ts`). The routing
 * SWITCH was extracted into the zod-free `providerRoutingCore.ts` — the bridge
 * loads `classifyWithProvider` from THERE, and the routing tests exercise it
 * with injected spy deps (never `DEFAULT_PROVIDER_DEPS`). MCP-017 also adds
 * three new zod-free files (`anthropicClassifierCore.ts`, `seedPrompt.ts`,
 * `contentSafetyScan.ts`) bridged below.
 *
 * This file is NOT a test suite — it has no `*.test.ts` name.
 */
import type {
  SemanticRefereePacket,
} from '../../src/features/semanticReferee';
import type {
  ClassifyMoveRequest,
  ClassifyMoveOutcome,
} from '../../src/lib/edgeFunctions';

const SHARED = '../../supabase/functions/_shared/semanticReferee';

// ── Deno-only registry types (no Node-side home — declared locally) ──

export interface SemanticRefereeEnv {
  SEMANTIC_REFEREE_ENABLED?: string;
  SEMANTIC_REFEREE_PROVIDER?: string;
}

/**
 * The Anthropic live provider's failure vocabulary — declared locally (it lives
 * in the zod-free `anthropicClassifierCore.ts`, which the bridge also loads).
 */
export type ProviderUnavailableReason =
  | 'key_missing'
  | 'api_error'
  | 'rate_limited'
  | 'network_error'
  | 'parse_failure'
  | 'validation_failed';

/** The result of one Anthropic live-provider call. */
export type ProviderResult =
  | { kind: 'success'; packet: SemanticRefereePacket }
  | { kind: 'unavailable'; reason: ProviderUnavailableReason };

/**
 * The MCP adapter's failure vocabulary (MCP-018) — declared locally; it lives
 * in the zod-free `mcpAdapterCore.ts`, which the bridge also loads. It differs
 * from `ProviderUnavailableReason` by `url_missing`/`token_missing` in place of
 * `key_missing` (the `mcp` adapter has a URL and a token, not one key).
 */
export type McpUnavailableReason =
  | 'url_missing'
  | 'token_missing'
  | 'api_error'
  | 'rate_limited'
  | 'network_error'
  | 'parse_failure'
  | 'validation_failed';

/** The result of one MCP-adapter call (MCP-018). */
export type McpProviderResult =
  | { kind: 'success'; packet: SemanticRefereePacket }
  | { kind: 'unavailable'; reason: McpUnavailableReason };

export interface SemanticRefereeProviderDeps {
  runMock: (request: ClassifyMoveRequest) => SemanticRefereePacket;
  runFixture: (request: ClassifyMoveRequest) => SemanticRefereePacket;
  runAnthropic: (request: ClassifyMoveRequest) => Promise<ProviderResult>;
  runMcp: (request: ClassifyMoveRequest) => Promise<McpProviderResult>;
}

// ── mockProvider.ts ─────────────────────────────────────────────

const mockProviderModule = require(`${SHARED}/mockProvider`) as {
  runMockClassifier: (request: ClassifyMoveRequest) => SemanticRefereePacket;
  buildFallbackPacket: (request: ClassifyMoveRequest) => SemanticRefereePacket;
};

export const runMockClassifier = mockProviderModule.runMockClassifier;
export const buildFallbackPacket = mockProviderModule.buildFallbackPacket;

// ── fixtureProvider.ts ──────────────────────────────────────────

const fixtureProviderModule = require(`${SHARED}/fixtureProvider`) as {
  runFixtureClassifier: (request: ClassifyMoveRequest) => SemanticRefereePacket;
};

export const runFixtureClassifier = fixtureProviderModule.runFixtureClassifier;

// ── fixtures.ts ─────────────────────────────────────────────────

const fixturesModule = require(`${SHARED}/fixtures`) as {
  SEMANTIC_REFEREE_FIXTURES: Readonly<Record<string, SemanticRefereePacket>>;
  SEMANTIC_REFEREE_FIXTURE_KEYS: readonly string[];
};

export const SEMANTIC_REFEREE_FIXTURES = fixturesModule.SEMANTIC_REFEREE_FIXTURES;
export const SEMANTIC_REFEREE_FIXTURE_KEYS = fixturesModule.SEMANTIC_REFEREE_FIXTURE_KEYS;

// ── redaction.ts ────────────────────────────────────────────────

const redactionModule = require(`${SHARED}/redaction`) as {
  redactString: (input: string) => string;
  redactClassifyMoveRequest: (request: ClassifyMoveRequest) => ClassifyMoveRequest;
};

export const redactString = redactionModule.redactString;
export const redactClassifyMoveRequest = redactionModule.redactClassifyMoveRequest;

// ── providerRoutingCore.ts (pure, zod-free routing switch) ──────────
//
// MCP-017: the switch was extracted out of `providerRouting.ts` (which became
// zod-coupled via `DEFAULT_PROVIDER_DEPS`) into this zod-free core. The bridge
// loads the switch from HERE. `classifyWithProvider` is async and `deps` is
// required — every routing test injects spy deps.

const providerRoutingCoreModule = require(`${SHARED}/providerRoutingCore`) as {
  classifyWithProvider: (
    request: ClassifyMoveRequest,
    env: SemanticRefereeEnv,
    deps: SemanticRefereeProviderDeps,
  ) => Promise<ClassifyMoveOutcome>;
  // MCP-018 — the pure `McpUnavailableReason` → `ClassifyMoveDisabledReason` map.
  mcpReasonToOutcomeReason: (reason: McpUnavailableReason) => string;
};

export const classifyWithProvider = providerRoutingCoreModule.classifyWithProvider;
export const mcpReasonToOutcomeReason =
  providerRoutingCoreModule.mcpReasonToOutcomeReason;

// ── runtimeConfig.ts (ADMIN-AI-001 — zod-free DB-config resolver) ───
//
// `resolveSemanticRefereeConfig` reads the persisted admin runtime config via
// the SECURITY DEFINER RPC. It is zod-free and reads no env key, so Jest can
// `require()` it. Tests pass a hand-built fake client with a `.rpc()` stub.

export type SemanticProviderMode = 'anthropic' | 'mock' | 'fixture' | 'mcp';

export type ResolvedProviderConfig =
  | { source: 'db'; enabled: boolean; providerMode: SemanticProviderMode }
  | { source: 'db_unavailable' };

const runtimeConfigModule = require(`${SHARED}/runtimeConfig`) as {
  resolveSemanticRefereeConfig: (
    client: { rpc: (fn: string) => Promise<{ data: unknown; error: unknown }> },
  ) => Promise<ResolvedProviderConfig>;
  SEMANTIC_PROVIDER_MODES: readonly SemanticProviderMode[];
};

export const resolveSemanticRefereeConfig =
  runtimeConfigModule.resolveSemanticRefereeConfig;
export const SEMANTIC_PROVIDER_MODES = runtimeConfigModule.SEMANTIC_PROVIDER_MODES;

// ── anthropicClassifierCore.ts (zod-free live-provider core) ────────

const anthropicClassifierCoreModule = require(`${SHARED}/anthropicClassifierCore`) as {
  DEFAULT_SEMANTIC_REFEREE_MODEL: string;
  MAX_TOKENS: number;
  TEMPERATURE: number;
  SEMANTIC_REFEREE_SYSTEM_PROMPT: string;
  buildAnthropicRequestBody: (
    request: ClassifyMoveRequest,
    model: string,
  ) => Record<string, unknown>;
  extractAnthropicContentText: (responseJson: unknown) => string | undefined;
  parseJsonFromContent: (text: unknown) => unknown | null;
  sanitizeRawPayload: (raw: unknown) => {
    model: unknown;
    stop_reason: unknown;
    usage: unknown;
  };
};

export const DEFAULT_SEMANTIC_REFEREE_MODEL =
  anthropicClassifierCoreModule.DEFAULT_SEMANTIC_REFEREE_MODEL;
export const ANTHROPIC_MAX_TOKENS = anthropicClassifierCoreModule.MAX_TOKENS;
export const ANTHROPIC_TEMPERATURE = anthropicClassifierCoreModule.TEMPERATURE;
export const SEMANTIC_REFEREE_SYSTEM_PROMPT =
  anthropicClassifierCoreModule.SEMANTIC_REFEREE_SYSTEM_PROMPT;
export const buildAnthropicRequestBody =
  anthropicClassifierCoreModule.buildAnthropicRequestBody;
export const extractAnthropicContentText =
  anthropicClassifierCoreModule.extractAnthropicContentText;
export const parseJsonFromContent = anthropicClassifierCoreModule.parseJsonFromContent;
export const sanitizeRawPayload = anthropicClassifierCoreModule.sanitizeRawPayload;

// ── mcpAdapterCore.ts (MCP-018 — zod-free MCP-adapter core) ─────────
//
// The pure, Jest-importable logic for the operator-hosted MCP-server provider.
// `mcpAdapter.ts` itself is NOT bridged — it imports `schema.ts` (→ `npm:zod@4`)
// — exactly as `anthropicProvider.ts` is not bridged. The MCP-adapter routing
// path is exercised through `providerRoutingCore.ts` with an injected `runMcp`
// spy; the live `mcpAdapter.ts` is covered by source-scan + source-shape suites.

const mcpAdapterCoreModule = require(`${SHARED}/mcpAdapterCore`) as {
  MCP_CLASSIFY_TOOL_NAME: string;
  MCP_REQUEST_TIMEOUT_MS: number;
  DEFAULT_MCP_MODEL_VERSION: string;
  ALL_MCP_UNAVAILABLE_REASONS: readonly McpUnavailableReason[];
  buildMcpToolRequestBody: (request: ClassifyMoveRequest) => Record<string, unknown>;
  extractMcpPacket: (responseJson: unknown) => unknown | null;
  parseJsonFromContent: (text: unknown) => unknown | null;
  sanitizeMcpRawPayload: (raw: unknown) => Record<string, unknown>;
};

export const MCP_CLASSIFY_TOOL_NAME = mcpAdapterCoreModule.MCP_CLASSIFY_TOOL_NAME;
export const MCP_REQUEST_TIMEOUT_MS = mcpAdapterCoreModule.MCP_REQUEST_TIMEOUT_MS;
export const DEFAULT_MCP_MODEL_VERSION = mcpAdapterCoreModule.DEFAULT_MCP_MODEL_VERSION;
export const ALL_MCP_UNAVAILABLE_REASONS =
  mcpAdapterCoreModule.ALL_MCP_UNAVAILABLE_REASONS;
export const buildMcpToolRequestBody = mcpAdapterCoreModule.buildMcpToolRequestBody;
export const extractMcpPacket = mcpAdapterCoreModule.extractMcpPacket;
/** The `mcpAdapterCore.ts` LOCAL COPY of `parseJsonFromContent` (MCP-018 OQ-4). */
export const mcpParseJsonFromContent = mcpAdapterCoreModule.parseJsonFromContent;
export const sanitizeMcpRawPayload = mcpAdapterCoreModule.sanitizeMcpRawPayload;

// ── seedPrompt.ts (zod-free seed prompt) ────────────────────────────

const seedPromptModule = require(`${SHARED}/seedPrompt`) as {
  SEED_PROMPT_VERSION: string;
  buildClassifierPrompt: (request: ClassifyMoveRequest) => string;
  SEED_PROMPT_CLASSIFIER_IDS: readonly string[];
};

export const SEED_PROMPT_VERSION = seedPromptModule.SEED_PROMPT_VERSION;
export const buildClassifierPrompt = seedPromptModule.buildClassifierPrompt;
export const SEED_PROMPT_CLASSIFIER_IDS = seedPromptModule.SEED_PROMPT_CLASSIFIER_IDS;

// ── semanticClassifierCatalog.ts (Deno-side mirror; MCP-MOD-005 surfaces
//    the catalog so tests previously routed through `CLASSIFIER_QUESTION_TEXT`
//    can read `structuralQuestion` directly from the catalog) ────────────

const denoCatalogModule = require(`${SHARED}/semanticClassifierCatalog`) as {
  SEMANTIC_CLASSIFIER_CATALOG: ReadonlyArray<{
    readonly id: string;
    readonly structuralQuestion: string;
    readonly binarySignal: string;
    readonly family: string;
    readonly bannerCode: string | null;
    readonly ledgerFeedbackCode: string | null;
  }>;
  CATALOG_BY_ID: ReadonlyMap<string, {
    readonly id: string;
    readonly structuralQuestion: string;
    readonly binarySignal: string;
    readonly family: string;
    readonly bannerCode: string | null;
    readonly ledgerFeedbackCode: string | null;
  }>;
};

export const DENO_SEMANTIC_CLASSIFIER_CATALOG = denoCatalogModule.SEMANTIC_CLASSIFIER_CATALOG;
export const DENO_CATALOG_BY_ID = denoCatalogModule.CATALOG_BY_ID;

// ── contentSafetyScan.ts (zod-free Deno content scanner) ────────────

export type ContentScanResult =
  | { ok: true }
  | { ok: false; reason: 'validation_failed'; detail: string };

const contentSafetyScanModule = require(`${SHARED}/contentSafetyScan`) as {
  scanPacketContent: (packet: unknown) => ContentScanResult;
};

export const scanPacketContent = contentSafetyScanModule.scanPacketContent;

// ── types.ts (re-export the contract constant arrays) ───────────

const typesModule = require(`${SHARED}/types`) as {
  ALL_SEMANTIC_CLASSIFIER_IDS: readonly string[];
  ALL_ROUTE_SUGGESTIONS: readonly string[];
  ALL_FRICTION_SUGGESTIONS: readonly string[];
  ALL_CONFIDENCE_VALUES: readonly string[];
  ALL_SEMANTIC_PROVIDERS: readonly string[];
  PACKET_VERSION: string;
  SCORE_HINT_MIN: number;
  SCORE_HINT_MAX: number;
};

export const DENO_ALL_SEMANTIC_CLASSIFIER_IDS = typesModule.ALL_SEMANTIC_CLASSIFIER_IDS;
export const DENO_ALL_ROUTE_SUGGESTIONS = typesModule.ALL_ROUTE_SUGGESTIONS;
export const DENO_ALL_FRICTION_SUGGESTIONS = typesModule.ALL_FRICTION_SUGGESTIONS;
export const DENO_PACKET_VERSION = typesModule.PACKET_VERSION;
export const DENO_SCORE_HINT_MIN = typesModule.SCORE_HINT_MIN;
export const DENO_SCORE_HINT_MAX = typesModule.SCORE_HINT_MAX;
