/**
 * MCP-011 — Semantic referee fixture integrity tests.
 *
 * Proves the valid fixtures validate, the malformed fixtures fail with their
 * declared codes, the mock provider is deterministic + always-valid, and the
 * fixture module's own source carries no real secret / handle / URL / email /
 * post-id (the synthetic shapes are assembled, never literal).
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  VALID_FIXTURES,
  MALFORMED_FIXTURES,
  CACHE_KEY_FIXTURES,
  mockFixtureProvider,
  allValidFixturesValidate,
} from '../src/features/semanticReferee/semanticRefereeFixtures';
import { parseSemanticPacket } from '../src/features/semanticReferee/semanticRefereeValidator';
import {
  buildSemanticCacheKey,
  serializeSemanticCacheKey,
} from '../src/features/semanticReferee/semanticRefereeCacheKey';

const FIXTURE_SRC = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'features', 'semanticReferee', 'semanticRefereeFixtures.ts'),
  'utf8',
);

describe('MCP-011 fixtures — valid packets', () => {
  it('there are at least seven named valid fixtures (groups 1-6 + 15)', () => {
    expect(Object.keys(VALID_FIXTURES).length).toBeGreaterThanOrEqual(7);
  });

  it('every VALID_FIXTURES entry passes parseSemanticPacket', () => {
    for (const [name, packet] of Object.entries(VALID_FIXTURES)) {
      const result = parseSemanticPacket(packet);
      expect(result.ok).toBe(true);
      if (!result.ok) {
        throw new Error(`valid fixture "${name}" unexpectedly rejected`);
      }
    }
  });

  it('allValidFixturesValidate self-check returns true', () => {
    expect(allValidFixturesValidate()).toBe(true);
  });

  it('every valid fixture carries authoritative: false', () => {
    for (const packet of Object.values(VALID_FIXTURES)) {
      expect(packet.authoritative).toBe(false);
    }
  });
});

describe('MCP-011 fixtures — malformed payloads', () => {
  it('covers groups 7-16 plus extra cases', () => {
    const groups = new Set(MALFORMED_FIXTURES.map((f) => f.group));
    for (const g of [7, 8, 9, 10, 11, 12, 13, 14, 16]) {
      expect(groups.has(g)).toBe(true);
    }
  });

  it('every MALFORMED_FIXTURES entry fails with its declared codes', () => {
    for (const fixture of MALFORMED_FIXTURES) {
      const result = parseSemanticPacket(fixture.raw);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const codes = result.rejections.map((r) => r.code);
        for (const expected of fixture.expectedRejectionCodes) {
          if (!codes.includes(expected)) {
            throw new Error(
              `fixture "${fixture.id}" missing expected code "${expected}" (got ${codes.join(', ')})`,
            );
          }
        }
      }
    }
  });

  it('every malformed fixture has a unique id', () => {
    const ids = MALFORMED_FIXTURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('MCP-011 fixtures — cache-key fixtures', () => {
  it('covers groups 17 and 18', () => {
    const groups = new Set(CACHE_KEY_FIXTURES.map((f) => f.group));
    expect(groups.has(17)).toBe(true);
    expect(groups.has(18)).toBe(true);
  });

  it('every cache-key fixture matches its declared key relationship', () => {
    for (const fixture of CACHE_KEY_FIXTURES) {
      const keyA = serializeSemanticCacheKey(buildSemanticCacheKey(fixture.inputA));
      const keyB = serializeSemanticCacheKey(buildSemanticCacheKey(fixture.inputB));
      if (fixture.expect === 'same_key') {
        expect(keyA).toBe(keyB);
      } else {
        expect(keyA).not.toBe(keyB);
      }
    }
  });
});

describe('MCP-011 mockFixtureProvider', () => {
  it('is deterministic — the same request returns a byte-identical packet', () => {
    const request = {
      roomId: 'room-mock',
      classifierIds: ['responds_to_parent'] as const,
      contentHash: 'contenthash-mock',
    };
    const a = mockFixtureProvider(request);
    const b = mockFixtureProvider(request);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('every returned packet passes parseSemanticPacket', () => {
    for (const fixtureId of Object.keys(VALID_FIXTURES) as (keyof typeof VALID_FIXTURES)[]) {
      const packet = mockFixtureProvider({
        fixtureId,
        roomId: 'room-mock',
        classifierIds: ['responds_to_parent'],
        contentHash: 'contenthash-mock',
      });
      const result = parseSemanticPacket(packet);
      expect(result.ok).toBe(true);
    }
  });

  it('returned packets carry provider: mock and authoritative: false', () => {
    const packet = mockFixtureProvider({
      roomId: 'room-mock',
      classifierIds: ['responds_to_parent'],
      contentHash: 'contenthash-mock',
    });
    expect(packet.provider).toBe('mock');
    expect(packet.authoritative).toBe(false);
  });

  it('applies the requested roomId / contentHash / promptVersion', () => {
    const packet = mockFixtureProvider({
      roomId: 'room-xyz',
      classifierIds: ['responds_to_parent'],
      contentHash: 'hash-xyz',
      promptVersion: 'mcp-semantic-referee-prompt-v9',
    });
    expect(packet.roomId).toBe('room-xyz');
    expect(packet.contentHash).toBe('hash-xyz');
    expect(packet.promptVersion).toBe('mcp-semantic-referee-prompt-v9');
  });

  it('returns a valid packet even when no requested classifier matches the base', () => {
    const packet = mockFixtureProvider({
      roomId: 'room-mock',
      classifierIds: ['ready_for_synthesis'],
      contentHash: 'contenthash-mock',
    });
    expect(parseSemanticPacket(packet).ok).toBe(true);
    expect(packet.binaries.length).toBeGreaterThan(0);
  });

  it('returns a frozen packet', () => {
    const packet = mockFixtureProvider({
      roomId: 'room-mock',
      classifierIds: ['responds_to_parent'],
      contentHash: 'contenthash-mock',
    });
    expect(Object.isFrozen(packet)).toBe(true);
  });
});

describe('MCP-011 fixtures — module source self-scan (no real secrets)', () => {
  it('the fixture module contains no contiguous real-key-shaped literal', () => {
    // The synthetic secret is assembled at runtime; the contiguous shape
    // 'sk-ant-' followed by 20+ key chars must not appear as one literal.
    expect(/sk-ant-[A-Za-z0-9_-]{20,}/.test(FIXTURE_SRC)).toBe(false);
    expect(/xai-[A-Za-z0-9_-]{20,}/.test(FIXTURE_SRC)).toBe(false);
    expect(/sb_secret_[A-Za-z0-9_-]{20,}/.test(FIXTURE_SRC)).toBe(false);
  });

  it('the fixture module contains no JWT-shaped literal', () => {
    expect(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/.test(FIXTURE_SRC)).toBe(
      false,
    );
  });

  it('the fixture module contains no real http(s) URL literal', () => {
    // example.invalid is a reserved non-resolvable TLD; assert no real host.
    const realUrl = /https?:\/\/(?!example\.invalid)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
    expect(realUrl.test(FIXTURE_SRC)).toBe(false);
  });

  it('the fixture module contains no real email literal', () => {
    // mail.invalid is reserved; assert no other email host slipped in.
    const realEmail = /[A-Za-z0-9._%+-]+@(?!mail\.invalid)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
    expect(realEmail.test(FIXTURE_SRC)).toBe(false);
  });

  it('the fixture module contains no 15-20 digit post-id literal', () => {
    expect(/\b\d{15,20}\b/.test(FIXTURE_SRC)).toBe(false);
  });
});
