/**
 * MCP-017 — Semantic referee provider routing core (pure, zod-free).
 *
 * This is the routing SWITCH, extracted out of `providerRouting.ts` so it stays
 * Jest-importable. MCP-016 had the switch live in `providerRouting.ts` directly
 * — but MCP-017 makes the wired `DEFAULT_PROVIDER_DEPS` import the zod-coupled
 * `anthropicProvider.ts` (→ `npm:zod@4`), which Jest cannot resolve.
 *
 * The split:
 *   - THIS file holds the switch + the dep / env interfaces ONLY. It imports
 *     `mockProvider.ts`, `fixtureProvider.ts`, and `types.ts` — all zod-free —
 *     plus a TYPE-only import of `ProviderResult`. It does NOT import
 *     `anthropicProvider.ts`, so it never transitively pulls `npm:zod@4`. The
 *     `_helpers/semanticRefereeDeno.ts` Jest bridge can `require()` it and
 *     exercise the real routing logic with INJECTED spy deps.
 *   - `providerRouting.ts` builds `DEFAULT_PROVIDER_DEPS` — the one place the
 *     zod-coupled live `runAnthropicClassifier` is wired — and re-exports the
 *     switch from here.
 *
 * Because `DEFAULT_PROVIDER_DEPS` does not live here, `classifyWithProvider`
 * takes `deps` as a REQUIRED parameter — the Deno entry `providers.ts` passes
 * the real `DEFAULT_PROVIDER_DEPS` (it is already zod-coupled), and every test
 * passes injected spy deps.
 *
 * Doctrine (MCP-001 §10, cdiscourse-doctrine §7):
 *   - DISABLED BY DEFAULT — `SEMANTIC_REFEREE_ENABLED` must equal the exact
 *     string `'true'`; the check happens BEFORE any provider is selected, so a
 *     disabled call never invokes a provider function (and never reads a key).
 *   - The default provider is `mock` (NOT `anthropic`) — the deliberate
 *     doctrine deviation from `languageProcessing/providers.ts`. The `?? 'mock'`
 *     fallback below is doctrine-critical and must not change.
 *   - `mcp` stays a STUB: a literal `not_implemented` return with no module
 *     behind it.
 *   - `anthropic` is now WIRED — through an injected async `runAnthropic` dep,
 *     so this core stays zod-free and the provider seam stays spy-injectable.
 *
 * PURE TYPESCRIPT — no `Deno`, no `npm:` import, no I/O.
 */
import type { ProviderResult } from './anthropicClassifierCore.ts';
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

/**
 * Provider functions the routing core delegates to. Injectable for tests.
 * `runAnthropic` is async — the live provider does a `fetch`. `runMock` /
 * `runFixture` stay synchronous and deterministic.
 */
export interface SemanticRefereeProviderDeps {
  runMock: (request: ClassifyMoveRequest) => SemanticRefereePacket;
  runFixture: (request: ClassifyMoveRequest) => SemanticRefereePacket;
  runAnthropic: (request: ClassifyMoveRequest) => Promise<ProviderResult>;
}

/**
 * The PURE registry core. Env and provider functions are injected — no `Deno`,
 * no I/O, no zod. `deps` is REQUIRED (the wired `DEFAULT_PROVIDER_DEPS` lives
 * in `providerRouting.ts`, outside this zod-free file).
 *
 * The disabled-by-default check happens FIRST, before any provider function is
 * touched, so a disabled call never invokes a provider and never reads a key.
 *
 * `async` because the `anthropic` branch awaits the live provider.
 *
 * NOTE: this core does NOT run the outbound schema validation — that belongs to
 * `classifyWithConfiguredProvider` in `providers.ts`. The core's job is routing
 * only. (`anthropicProvider.ts` runs its own schema + content validation; the
 * registry-level `validateOrFallback` in `providers.ts` is the second wall.)
 */
export async function classifyWithProvider(
  request: ClassifyMoveRequest,
  env: SemanticRefereeEnv,
  deps: SemanticRefereeProviderDeps,
): Promise<ClassifyMoveOutcome> {
  // 1. Disabled-by-default — checked BEFORE any provider is selected, so a
  //    disabled call never invokes a provider and never reads a key.
  if (env.SEMANTIC_REFEREE_ENABLED !== 'true') {
    return { enabled: false, reason: 'disabled' };
  }

  // 2. Provider selection — DEFAULT IS 'mock' (doctrine deviation from
  //    languageProcessing/providers.ts, which defaults to 'anthropic'). This
  //    `?? 'mock'` fallback is doctrine-critical — it must not change.
  const providerName = env.SEMANTIC_REFEREE_PROVIDER ?? 'mock';

  // 3. mock + fixture are deterministic; anthropic is the live provider; mcp
  //    stays stubbed off.
  if (providerName === 'mock') {
    return { enabled: true, packet: deps.runMock(request) };
  }
  if (providerName === 'fixture') {
    return { enabled: true, packet: deps.runFixture(request) };
  }
  if (providerName === 'anthropic') {
    // The live provider. It NEVER throws — every failure is a typed
    // `unavailable` result, translated here into a disabled outcome.
    const result = await deps.runAnthropic(request);
    if (result.kind === 'unavailable') {
      return { enabled: false, reason: result.reason };
    }
    return { enabled: true, packet: result.packet };
  }
  if (providerName === 'mcp') {
    // STUB — present in the registry, never callable in this card. The
    // operator-hosted MCP adapter is a separate future card. No mcpAdapter.ts
    // module exists.
    return { enabled: false, reason: 'not_implemented' };
  }
  return { enabled: false, reason: 'not_configured' };
}
