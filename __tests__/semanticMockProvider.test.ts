/**
 * MCP-016 — Semantic referee deterministic mock provider tests.
 *
 * `runMockClassifier` is the DEFAULT and PRIMARY provider for MCP-016. These
 * tests prove it is deterministic, schema-shaped, and doctrine-clean. No
 * network, no env, no live call — the mock is a pure synchronous function.
 *
 * The mock is a zod-free Deno module loaded through the typed test bridge
 * (`_helpers/semanticRefereeDeno.ts`) — Jest runs the real module; `tsc` does
 * not follow the bridge's `require()` into the Deno tree.
 */
import {
  runMockClassifier,
  buildFallbackPacket,
} from './_helpers/semanticRefereeDeno';
import {
  ALL_SEMANTIC_CLASSIFIER_IDS,
  PACKET_VERSION,
  SCORE_HINT_MAX,
  SCORE_HINT_MIN,
} from '../src/features/semanticReferee';
import type { SemanticRefereePacket } from '../src/features/semanticReferee';
import type { ClassifyMoveRequest } from '../src/lib/edgeFunctions';

function makeRequest(overrides: Partial<ClassifyMoveRequest> = {}): ClassifyMoveRequest {
  return {
    roomId: 'room-1',
    moveBodyRedacted: 'This claim narrows the parent point to the specific case.',
    roomContext: { side: 'affirmative', actorRole: 'primary_opponent' },
    requestedClassifiers: ['responds_to_parent', 'narrows_claim'],
    contentHash: 'content-hash-1',
    ...overrides,
  };
}

/** A structural shape check that does not need the Deno zod schema. */
function assertWellFormedPacket(packet: SemanticRefereePacket): void {
  expect(packet.packetVersion).toBe(PACKET_VERSION);
  expect(packet.provider).toBe('mock');
  expect(packet.authoritative).toBe(false);
  expect(typeof packet.inputHash).toBe('string');
  expect(packet.inputHash.length).toBeGreaterThan(0);
  expect(typeof packet.contentHash).toBe('string');
  expect(Array.isArray(packet.binaries)).toBe(true);
  for (const binary of packet.binaries) {
    expect(ALL_SEMANTIC_CLASSIFIER_IDS).toContain(binary.classifierId);
    expect(binary.value === 0 || binary.value === 1).toBe(true);
    expect(['low', 'medium', 'high']).toContain(binary.confidence);
    expect(typeof binary.reasonCode).toBe('string');
    expect(/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(binary.reasonCode)).toBe(true);
  }
  for (const value of Object.values(packet.scoreHints)) {
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(SCORE_HINT_MIN);
    expect(value).toBeLessThanOrEqual(SCORE_HINT_MAX);
  }
}

describe('runMockClassifier — determinism', () => {
  it('produces a byte-identical packet for the same request', () => {
    const request = makeRequest();
    const a = runMockClassifier(request);
    const b = runMockClassifier(request);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('produces a different packet for a different contentHash', () => {
    const a = runMockClassifier(makeRequest({ contentHash: 'hash-a' }));
    const b = runMockClassifier(makeRequest({ contentHash: 'hash-b' }));
    // The inputHash differs because the content hash feeds it.
    expect(a.inputHash).not.toBe(b.inputHash);
  });
});

describe('runMockClassifier — packet shape', () => {
  it('always stamps provider mock, authoritative false, the contract version', () => {
    const packet = runMockClassifier(makeRequest());
    expect(packet.provider).toBe('mock');
    expect(packet.authoritative).toBe(false);
    expect(packet.packetVersion).toBe('mcp-semantic-referee-v0');
  });

  it('produces a well-formed packet for a request with a parent', () => {
    const packet = runMockClassifier(
      makeRequest({ parentId: 'parent-1', parentBodyRedacted: 'The parent claim.' }),
    );
    assertWellFormedPacket(packet);
    expect(packet.parentId).toBe('parent-1');
  });

  it('produces a well-formed packet for a root move (no parent)', () => {
    const packet = runMockClassifier(
      makeRequest({ parentId: undefined, parentBodyRedacted: undefined }),
    );
    assertWellFormedPacket(packet);
    expect(packet.parentId).toBeUndefined();
  });

  it('classifies responds_to_parent as 0 for a root move with no parent', () => {
    const packet = runMockClassifier(
      makeRequest({
        parentId: undefined,
        parentBodyRedacted: undefined,
        requestedClassifiers: ['responds_to_parent'],
      }),
    );
    const respondsBinary = packet.binaries.find((b) => b.classifierId === 'responds_to_parent');
    expect(respondsBinary?.value).toBe(0);
  });

  it('emits one binary per unique requested classifier', () => {
    const packet = runMockClassifier(
      makeRequest({ requestedClassifiers: ['responds_to_parent', 'narrows_claim'] }),
    );
    expect(packet.binaries).toHaveLength(2);
  });

  it('de-duplicates a repeated classifier id', () => {
    const packet = runMockClassifier(
      makeRequest({ requestedClassifiers: ['narrows_claim', 'narrows_claim'] }),
    );
    expect(packet.binaries).toHaveLength(1);
  });

  it('produces a well-formed packet for every catalog-v0 classifier', () => {
    for (const id of ALL_SEMANTIC_CLASSIFIER_IDS) {
      const packet = runMockClassifier(makeRequest({ requestedClassifiers: [id] }));
      assertWellFormedPacket(packet);
    }
  });

  it('carries the optional ids only when present on the request', () => {
    const withIds = runMockClassifier(makeRequest({ moveId: 'move-9', parentId: 'parent-9' }));
    expect(withIds.moveId).toBe('move-9');
    expect(withIds.parentId).toBe('parent-9');
    const withoutIds = runMockClassifier(makeRequest({ moveId: undefined, parentId: undefined }));
    expect(withoutIds.moveId).toBeUndefined();
    expect(withoutIds.parentId).toBeUndefined();
  });
});

describe('buildFallbackPacket — deterministic minimal packet', () => {
  it('produces an empty-binaries, no-route, no-friction, zero-hint packet', () => {
    const packet = buildFallbackPacket(makeRequest());
    expect(packet.binaries).toHaveLength(0);
    expect(packet.routeSuggestion).toBe('no_route_change');
    expect(packet.frictionSuggestion).toBe('none');
    for (const value of Object.values(packet.scoreHints)) {
      expect(value).toBe(0);
    }
    expect(packet.provider).toBe('mock');
    expect(packet.authoritative).toBe(false);
  });

  it('is deterministic', () => {
    const request = makeRequest();
    expect(JSON.stringify(buildFallbackPacket(request))).toBe(
      JSON.stringify(buildFallbackPacket(request)),
    );
  });
});

describe('runMockClassifier — doctrine', () => {
  it('never sets a block field or any blocking action field', () => {
    const packet = runMockClassifier(makeRequest()) as unknown as Record<string, unknown>;
    for (const field of ['block', 'blocked', 'shouldBlock', 'gate', 'isBlocked', 'banUser']) {
      expect(packet[field]).toBeUndefined();
    }
  });

  it('never sets a truth or verdict field', () => {
    const packet = runMockClassifier(makeRequest()) as unknown as Record<string, unknown>;
    for (const field of ['truth', 'isTrue', 'isFalse', 'winner', 'loser', 'verdict']) {
      expect(packet[field]).toBeUndefined();
    }
  });
});
