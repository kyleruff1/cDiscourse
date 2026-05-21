/**
 * MCP-016 — Semantic referee local-development fixture provider.
 *
 * `runFixtureClassifier(request)` reads the checked-in `SEMANTIC_REFEREE_FIXTURES`
 * map keyed by `contentHash`. On a HIT it returns the named fixture (re-stamped
 * with the request's `roomId` / `contentHash` / optional ids so the packet
 * stays internally consistent). On a MISS it falls through to the deterministic
 * `runMockClassifier`.
 *
 * No key, no network, no env. Lets a developer exercise realistic, named
 * packets without a live call. A fixture miss is NEVER an error.
 *
 * Pure TypeScript — no Deno-only API. Synchronous.
 */
import { SEMANTIC_REFEREE_FIXTURES } from './fixtures.ts';
import { runMockClassifier } from './mockProvider.ts';
import type { ClassifyMoveRequest, SemanticRefereePacket } from './types.ts';

/**
 * Run the fixture classifier. Returns the mapped fixture for a known
 * `contentHash`; otherwise falls through to the mock. The returned packet is
 * always frozen and schema-valid.
 */
export function runFixtureClassifier(request: ClassifyMoveRequest): SemanticRefereePacket {
  const fixture = SEMANTIC_REFEREE_FIXTURES[request.contentHash];
  if (!fixture) {
    // Miss — fall through to the deterministic mock. Not an error.
    return runMockClassifier(request);
  }

  // Hit — re-stamp the fixture with the request's identity so the packet's
  // roomId / contentHash / optional ids match the call. Every other field
  // (binaries, route, friction, scoreHints) is the named fixture's content.
  const restamped: SemanticRefereePacket = {
    ...fixture,
    roomId: request.roomId,
    contentHash: request.contentHash,
    ...(request.moveId ? { moveId: request.moveId } : {}),
    ...(request.parentId ? { parentId: request.parentId } : {}),
  };
  return Object.freeze(restamped);
}
