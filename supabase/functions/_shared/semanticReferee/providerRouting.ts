/**
 * MCP-016 — Semantic referee provider routing core (pure, zod-free).
 *
 * `classifyWithProvider(request, env, deps)` is the PURE registry core: env and
 * provider functions are injected, there is no `Deno`, no `npm:` import, no
 * I/O. Because it is zod-free and uses no Deno-only API it is directly
 * exercisable by Jest — the disabled-by-default and provider-routing tests
 * import THIS file, not the Deno-coupled `providers.ts`.
 *
 * `providers.ts` re-exports `classifyWithProvider` and adds the Deno wrapper
 * `classifyWithConfiguredProvider` (which reads `Deno.env`) plus the outbound
 * `npm:zod@4` schema validation. Keeping the routing core here means a single
 * `import` of the routing logic never transitively pulls `npm:zod@4` — which
 * Jest cannot resolve.
 *
 * Doctrine (MCP-001 §10, cdiscourse-doctrine §7):
 *   - DISABLED BY DEFAULT — `SEMANTIC_REFEREE_ENABLED` must equal the exact
 *     string `'true'`; the check happens BEFORE any provider is selected, so a
 *     disabled call never invokes a provider function.
 *   - The default provider is `mock` (NOT `anthropic`) — the deliberate
 *     doctrine deviation from `languageProcessing/providers.ts`.
 *   - `anthropic` / `mcp` are STUBS: a literal `not_implemented` return with no
 *     module behind them.
 */
import { runMockClassifier } from './mockProvider.ts';
import { runFixtureClassifier } from './fixtureProvider.ts';
import type {
  ClassifyMoveOutcome,
  ClassifyMoveRequest,
  SemanticRefereePacket,
} from './types.ts';

/** The env keys the registry reads. Used to type the injected env in tests. */
export interface SemanticRefereeEnv {
  SEMANTIC_REFEREE_ENABLED?: string;
  SEMANTIC_REFEREE_PROVIDER?: string;
}

/** Provider functions the pure core delegates to. Injectable for tests. */
export interface SemanticRefereeProviderDeps {
  runMock: (request: ClassifyMoveRequest) => SemanticRefereePacket;
  runFixture: (request: ClassifyMoveRequest) => SemanticRefereePacket;
}

/** The wired provider functions. The `anthropic` / `mcp` slots have no entry. */
export const DEFAULT_PROVIDER_DEPS: SemanticRefereeProviderDeps = {
  runMock: runMockClassifier,
  runFixture: runFixtureClassifier,
};

/**
 * The PURE registry core. Env and provider functions are injected — no `Deno`,
 * no I/O, no zod. The disabled-by-default check happens FIRST, before any
 * provider function is touched, so a disabled call never invokes a provider.
 *
 * NOTE: this core does NOT run the outbound schema validation — that belongs to
 * `classifyWithConfiguredProvider` in `providers.ts`. The core's job is routing
 * only.
 */
export function classifyWithProvider(
  request: ClassifyMoveRequest,
  env: SemanticRefereeEnv,
  deps: SemanticRefereeProviderDeps = DEFAULT_PROVIDER_DEPS,
): ClassifyMoveOutcome {
  // 1. Disabled-by-default — checked BEFORE any provider is selected.
  if (env.SEMANTIC_REFEREE_ENABLED !== 'true') {
    return { enabled: false, reason: 'disabled' };
  }

  // 2. Provider selection — DEFAULT IS 'mock' (doctrine deviation from
  //    languageProcessing/providers.ts, which defaults to 'anthropic').
  const providerName = env.SEMANTIC_REFEREE_PROVIDER ?? 'mock';

  // 3. Only mock + fixture are WIRED. anthropic + mcp are STUBBED OFF.
  if (providerName === 'mock') {
    return { enabled: true, packet: deps.runMock(request) };
  }
  if (providerName === 'fixture') {
    return { enabled: true, packet: deps.runFixture(request) };
  }
  if (providerName === 'anthropic' || providerName === 'mcp') {
    // STUB — present in the registry, never callable in this card. The live
    // provider is the separate Phase-E operator-approved pilot card. No
    // anthropicProvider.ts / mcpAdapter.ts module exists.
    return { enabled: false, reason: 'not_implemented' };
  }
  return { enabled: false, reason: 'not_configured' };
}
