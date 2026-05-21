/**
 * MCP-016 — Semantic referee fixture provider tests.
 *
 * `runFixtureClassifier` returns the mapped fixture for a known `contentHash`
 * and falls through to the deterministic mock for an unknown one. A fixture
 * miss is never an error. Every checked-in fixture is a well-formed packet.
 *
 * The fixture provider + fixtures map are zod-free Deno modules loaded through
 * the typed test bridge (`_helpers/semanticRefereeDeno.ts`).
 */
import {
  runFixtureClassifier,
  SEMANTIC_REFEREE_FIXTURES,
  SEMANTIC_REFEREE_FIXTURE_KEYS,
} from './_helpers/semanticRefereeDeno';
import {
  ALL_FRICTION_SUGGESTIONS,
  ALL_ROUTE_SUGGESTIONS,
  ALL_SEMANTIC_CLASSIFIER_IDS,
  PACKET_VERSION,
} from '../src/features/semanticReferee';
import type { ClassifyMoveRequest } from '../src/lib/edgeFunctions';

function makeRequest(overrides: Partial<ClassifyMoveRequest> = {}): ClassifyMoveRequest {
  return {
    roomId: 'caller-room',
    moveBodyRedacted: 'A move body.',
    roomContext: {},
    requestedClassifiers: ['responds_to_parent'],
    contentHash: 'unknown-hash',
    ...overrides,
  };
}

describe('runFixtureClassifier — hits', () => {
  it('returns the mapped fixture for a known contentHash', () => {
    const packet = runFixtureClassifier(makeRequest({ contentHash: 'fixture-content-hash-mainline' }));
    expect(packet.routeSuggestion).toBe('mainline');
    expect(packet.binaries[0]?.classifierId).toBe('responds_to_parent');
  });

  it('re-stamps the fixture with the caller request roomId and contentHash', () => {
    const packet = runFixtureClassifier(
      makeRequest({
        roomId: 'my-actual-room',
        contentHash: 'fixture-content-hash-source-gap',
        moveId: 'my-move',
      }),
    );
    expect(packet.roomId).toBe('my-actual-room');
    expect(packet.contentHash).toBe('fixture-content-hash-source-gap');
    expect(packet.moveId).toBe('my-move');
    // Content (route / friction) is the named fixture's.
    expect(packet.frictionSuggestion).toBe('ask_for_source');
  });

  it('returns one packet per route family across the fixture set', () => {
    const routes = new Set(Object.values(SEMANTIC_REFEREE_FIXTURES).map((p) => p.routeSuggestion));
    // The fixture set covers mainline, branch, tangent, synthesis, and a
    // no-route-change case.
    expect(routes.size).toBeGreaterThanOrEqual(4);
  });
});

describe('runFixtureClassifier — misses', () => {
  it('falls through to the deterministic mock for an unknown contentHash', () => {
    const packet = runFixtureClassifier(makeRequest({ contentHash: 'definitely-not-a-fixture' }));
    // The mock stamps provider 'mock' and the contract version.
    expect(packet.provider).toBe('mock');
    expect(packet.packetVersion).toBe(PACKET_VERSION);
    expect(packet.contentHash).toBe('definitely-not-a-fixture');
  });

  it('a miss is deterministic — same request yields the same fallthrough packet', () => {
    const request = makeRequest({ contentHash: 'no-such-fixture' });
    expect(JSON.stringify(runFixtureClassifier(request))).toBe(
      JSON.stringify(runFixtureClassifier(request)),
    );
  });
});

describe('SEMANTIC_REFEREE_FIXTURES — every fixture is well-formed', () => {
  it('exposes a non-empty fixture key list', () => {
    expect(SEMANTIC_REFEREE_FIXTURE_KEYS.length).toBeGreaterThan(0);
  });

  it('every fixture stamps the contract version and authoritative false', () => {
    for (const key of SEMANTIC_REFEREE_FIXTURE_KEYS) {
      const packet = SEMANTIC_REFEREE_FIXTURES[key];
      expect(packet.packetVersion).toBe(PACKET_VERSION);
      expect(packet.authoritative).toBe(false);
      expect(packet.provider).toBe('mock');
    }
  });

  it('every fixture binary names a catalog-v0 classifier and a snake_case reason code', () => {
    for (const key of SEMANTIC_REFEREE_FIXTURE_KEYS) {
      const packet = SEMANTIC_REFEREE_FIXTURES[key];
      for (const binary of packet.binaries) {
        expect(ALL_SEMANTIC_CLASSIFIER_IDS).toContain(binary.classifierId);
        expect(binary.value === 0 || binary.value === 1).toBe(true);
        expect(/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(binary.reasonCode)).toBe(true);
      }
      expect(ALL_ROUTE_SUGGESTIONS).toContain(packet.routeSuggestion);
      expect(ALL_FRICTION_SUGGESTIONS).toContain(packet.frictionSuggestion);
    }
  });

  it('every fixture scoreHints integer is within 0..3', () => {
    for (const key of SEMANTIC_REFEREE_FIXTURE_KEYS) {
      for (const value of Object.values(SEMANTIC_REFEREE_FIXTURES[key].scoreHints)) {
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(3);
      }
    }
  });
});
