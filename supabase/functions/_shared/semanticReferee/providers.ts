/**
 * MCP-016 / MCP-017 — Semantic referee provider registry.
 *
 * The Deno-coupled registry surface used by `semantic-referee/index.ts`. It
 * exports:
 *   - `classifyWithConfiguredProvider(request)` — reads `Deno.env`, routes via
 *     the routing core, validates the provider's output against the outbound
 *     `npm:zod@4` schema, and substitutes a deterministic fallback packet on
 *     any schema failure. NEVER throws. `async` since MCP-017 — the routing
 *     core awaits the live `anthropic` provider.
 *   - `validateOrFallback(request, packet)` — the outbound schema gate. This is
 *     the registry-level SECOND wall: even a packet the live provider's own
 *     validation somehow missed is caught here.
 *   - re-exports `classifyWithProvider` (the routing core) for callers that
 *     already have an env object.
 *
 * The routing SWITCH lives in `providerRoutingCore.ts` (zod-free, Jest-testable)
 * and is re-exported via `providerRouting.ts`. This file adds the two things
 * that cannot live there: the `Deno.env` read and the `npm:zod@4` outbound
 * validation.
 *
 * Doctrine (MCP-001 §10, cdiscourse-doctrine §7):
 *   - DISABLED BY DEFAULT — `SEMANTIC_REFEREE_ENABLED` must equal `'true'`.
 *   - The default provider is `mock`. `anthropic` is the live provider (MCP-017);
 *     `mcp` is still a stub.
 *   - This file reads NO provider key. Builds NO service-role client. Performs
 *     NO write. (`ANTHROPIC_API_KEY` is read only inside `anthropicProvider.ts`.)
 */
import { SemanticRefereePacketSchema } from './schema.ts';
import { buildFallbackPacket } from './mockProvider.ts';
import { classifyWithProvider, DEFAULT_PROVIDER_DEPS } from './providerRouting.ts';
import type { SemanticRefereeEnv } from './providerRouting.ts';
import type {
  ClassifyMoveOutcome,
  ClassifyMoveRequest,
  SemanticRefereePacket,
} from './types.ts';

export { classifyWithProvider } from './providerRouting.ts';
export type {
  SemanticRefereeEnv,
  SemanticRefereeProviderDeps,
} from './providerRouting.ts';

/**
 * Validate a provider's packet against the outbound `SemanticRefereePacketSchema`.
 * On success, returns the packet unchanged. On ANY failure — a smuggled field,
 * a non-`false` `authoritative`, an out-of-range hint — returns the
 * deterministic minimal fallback packet. NEVER throws. This proves the fallback
 * path even with no live provider in the loop.
 */
export function validateOrFallback(
  request: ClassifyMoveRequest,
  packet: SemanticRefereePacket,
): SemanticRefereePacket {
  const parsed = SemanticRefereePacketSchema.safeParse(packet);
  if (parsed.success) {
    return packet;
  }
  return buildFallbackPacket(request);
}

/**
 * The Deno-coupled registry entry point used by `semantic-referee/index.ts`.
 * Reads `Deno.env`, routes via the routing core, and — when a provider produced
 * a packet — validates it against the outbound schema, substituting the
 * deterministic fallback on any schema failure.
 *
 * `async` since MCP-017: the routing core awaits the live `anthropic` provider.
 * It still NEVER throws — the live provider returns a typed disabled outcome on
 * every failure path.
 *
 * `{ enabled: false }` (disabled / not_configured / not_implemented /
 * key_missing / api_error / rate_limited / network_error / parse_failure /
 * validation_failed) is a normal outcome the function returns with HTTP 200 —
 * never an error.
 */
export async function classifyWithConfiguredProvider(
  request: ClassifyMoveRequest,
): Promise<ClassifyMoveOutcome> {
  const env: SemanticRefereeEnv = {
    SEMANTIC_REFEREE_ENABLED: Deno.env.get('SEMANTIC_REFEREE_ENABLED') ?? undefined,
    SEMANTIC_REFEREE_PROVIDER: Deno.env.get('SEMANTIC_REFEREE_PROVIDER') ?? undefined,
  };
  const outcome = await classifyWithProvider(request, env, DEFAULT_PROVIDER_DEPS);
  if (!outcome.enabled) {
    return outcome;
  }
  return { enabled: true, packet: validateOrFallback(request, outcome.packet) };
}
