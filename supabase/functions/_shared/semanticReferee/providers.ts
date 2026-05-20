/**
 * MCP-016 — Semantic referee provider registry (mock-only build).
 *
 * The Deno-coupled registry surface used by `semantic-referee/index.ts`. It
 * exports:
 *   - `classifyWithConfiguredProvider(request)` — reads `Deno.env`, routes via
 *     the pure core, validates the provider's output against the outbound
 *     `npm:zod@4` schema, and substitutes a deterministic fallback packet on
 *     any schema failure. NEVER throws.
 *   - `validateOrFallback(request, packet)` — the outbound schema gate.
 *   - re-exports `classifyWithProvider` (the pure routing core) for callers
 *     that already have an env object.
 *
 * The PURE routing core lives in `providerRouting.ts` — zod-free, Jest-testable.
 * This file adds the two things that cannot live there: the `Deno.env` read and
 * the `npm:zod@4` outbound validation.
 *
 * Doctrine (MCP-001 §10, cdiscourse-doctrine §7):
 *   - DISABLED BY DEFAULT — `SEMANTIC_REFEREE_ENABLED` must equal `'true'`.
 *   - The default provider is `mock`. `anthropic` / `mcp` are stubs.
 *   - Reads NO provider key. Builds NO service-role client. Performs NO write.
 */
import { SemanticRefereePacketSchema } from './schema.ts';
import { buildFallbackPacket } from './mockProvider.ts';
import { classifyWithProvider } from './providerRouting.ts';
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
 * Reads `Deno.env`, routes via the pure core, and — when a provider produced a
 * packet — validates it against the outbound schema, substituting the
 * deterministic fallback on any schema failure.
 *
 * `{ enabled: false }` (disabled / not_configured / not_implemented) is a
 * normal outcome the function returns with HTTP 200 — never an error.
 */
export function classifyWithConfiguredProvider(
  request: ClassifyMoveRequest,
): ClassifyMoveOutcome {
  const env: SemanticRefereeEnv = {
    SEMANTIC_REFEREE_ENABLED: Deno.env.get('SEMANTIC_REFEREE_ENABLED') ?? undefined,
    SEMANTIC_REFEREE_PROVIDER: Deno.env.get('SEMANTIC_REFEREE_PROVIDER') ?? undefined,
  };
  const outcome = classifyWithProvider(request, env);
  if (!outcome.enabled) {
    return outcome;
  }
  return { enabled: true, packet: validateOrFallback(request, outcome.packet) };
}
