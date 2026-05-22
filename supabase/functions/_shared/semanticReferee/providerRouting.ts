/**
 * MCP-016 / MCP-017 — Semantic referee provider routing.
 *
 * The routing SWITCH itself lives in `providerRoutingCore.ts` (pure, zod-free,
 * Jest-importable). This file adds the one thing the core deliberately keeps
 * out of its own module graph: `DEFAULT_PROVIDER_DEPS`, which wires the live
 * `runAnthropicClassifier`.
 *
 * Why the split (MCP-017 design §"Test reality"): MCP-016 had the switch live
 * here directly and `providerRouting.ts` was zod-free. MCP-017's
 * `DEFAULT_PROVIDER_DEPS` must import the zod-coupled `anthropicProvider.ts`
 * (→ `npm:zod@4`), which Jest cannot resolve — so importing THIS file now
 * transitively pulls zod. The routing LOGIC is preserved verbatim in
 * `providerRoutingCore.ts`, which the `_helpers/semanticRefereeDeno.ts` bridge
 * loads and exercises with injected spy deps (never `DEFAULT_PROVIDER_DEPS`).
 *
 * `providers.ts` imports `DEFAULT_PROVIDER_DEPS` from here and `classifyWithProvider`
 * from the core (it re-exports both), and adds the Deno wrapper
 * `classifyWithConfiguredProvider` (which reads `Deno.env`).
 *
 * Doctrine (MCP-001 §10, cdiscourse-doctrine §7) — enforced in the core:
 *   - DISABLED BY DEFAULT — `SEMANTIC_REFEREE_ENABLED` must equal `'true'`.
 *   - The default provider is `mock` (NOT `anthropic`) — the `?? 'mock'`
 *     fallback in the core is doctrine-critical.
 *   - `anthropic` and `mcp` are the live providers, each reached only through
 *     its injected dep (`runAnthropic` / `runMcp` — MCP-018).
 */
import { runMockClassifier } from './mockProvider.ts';
import { runFixtureClassifier } from './fixtureProvider.ts';
import { runAnthropicClassifier } from './anthropicProvider.ts';
import { runMcpAdapter } from './mcpAdapter.ts';
import type { SemanticRefereeProviderDeps } from './providerRoutingCore.ts';

export {
  classifyWithProvider,
} from './providerRoutingCore.ts';
export type {
  SemanticRefereeEnv,
  SemanticRefereeProviderDeps,
} from './providerRoutingCore.ts';

/**
 * The wired provider functions. Importing `runAnthropicClassifier` and
 * `runMcpAdapter` is the one place the routing module graph touches the
 * zod-coupled live-provider files — which is why `DEFAULT_PROVIDER_DEPS` lives
 * here and not in the zod-free `providerRoutingCore.ts`.
 */
export const DEFAULT_PROVIDER_DEPS: SemanticRefereeProviderDeps = {
  runMock: runMockClassifier,
  runFixture: runFixtureClassifier,
  runAnthropic: runAnthropicClassifier,
  runMcp: runMcpAdapter,
};
