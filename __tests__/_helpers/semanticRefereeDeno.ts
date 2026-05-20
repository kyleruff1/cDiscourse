/**
 * MCP-016 — typed test bridge into the Deno semantic-referee tree.
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
 * (which import `npm:zod@4`) are NOT loadable by Jest and are covered instead
 * by the `adminSchemas.test.ts`-style re-declared-schema + source-scan tests.
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

export interface SemanticRefereeProviderDeps {
  runMock: (request: ClassifyMoveRequest) => SemanticRefereePacket;
  runFixture: (request: ClassifyMoveRequest) => SemanticRefereePacket;
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

// ── providerRouting.ts (pure routing core) ──────────────────────

const providerRoutingModule = require(`${SHARED}/providerRouting`) as {
  classifyWithProvider: (
    request: ClassifyMoveRequest,
    env: SemanticRefereeEnv,
    deps?: SemanticRefereeProviderDeps,
  ) => ClassifyMoveOutcome;
  DEFAULT_PROVIDER_DEPS: SemanticRefereeProviderDeps;
};

export const classifyWithProvider = providerRoutingModule.classifyWithProvider;
export const DEFAULT_PROVIDER_DEPS = providerRoutingModule.DEFAULT_PROVIDER_DEPS;

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
