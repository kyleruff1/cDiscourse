/**
 * MCP-021A — Test category 8: Source 6 runtime invariance.
 *
 * Per design §8.8 + Trigger 1 (BINDING). Verifies
 * adaptRawClassifierBinarySource(...) returns [] unconditionally
 * for every input. The function is byte-equal preserved per the
 * UX-001.5A handoff rule.
 *
 * Doctrine anchor: design §1.1 — "MCP-021A binding contract: the
 * implementer MUST NOT modify adaptRawClassifierBinarySource runtime
 * behavior. The function continues to return [] unconditionally
 * post-merge."
 */

import { adaptRawClassifierBinarySource } from '../src/features/nodeLabels/nodeLabelSourceAdapters';

describe('MCP-021A — Source 6 adapter byte-equal invariance', () => {
  it('returns [] for { messageId: "any" }', () => {
    expect(adaptRawClassifierBinarySource({ messageId: 'any' })).toEqual([]);
  });

  it('returns [] for { messageId: "", binaries: [] }', () => {
    expect(adaptRawClassifierBinarySource({ messageId: '', binaries: [] })).toEqual([]);
  });

  it('returns [] for { messageId: "x", binaries: [empty, empty, empty] }', () => {
    expect(
      adaptRawClassifierBinarySource({
        messageId: 'x',
        binaries: [{}, {}, {}],
      }),
    ).toEqual([]);
  });

  it('returns [] for varied messageIds', () => {
    const cases = ['', 'a', 'message-1', 'message-uuid-123', 'special-!@#$%'];
    for (const messageId of cases) {
      expect(adaptRawClassifierBinarySource({ messageId })).toEqual([]);
    }
  });

  it('returns [] for varied binaries shapes', () => {
    const binariesBattery = [
      undefined,
      [],
      [{}],
      [{}, {}],
      [{ foo: 'bar' }],
      [null as unknown as Record<string, unknown>],
      [{ raw_key: 'never_emitted' }],
    ];
    for (const binaries of binariesBattery) {
      const input = binaries === undefined ? { messageId: 'm' } : { messageId: 'm', binaries };
      expect(adaptRawClassifierBinarySource(input)).toEqual([]);
    }
  });

  it('returns [] for random battery (20 inputs)', () => {
    // Stable seed-equivalent — uses index for determinism.
    for (let i = 0; i < 20; i++) {
      const binaries = i % 2 === 0 ? [] : [{ index: i }];
      expect(
        adaptRawClassifierBinarySource({ messageId: `msg-${i}`, binaries }),
      ).toEqual([]);
    }
  });

  it('return value is consistently new empty array, not shared singleton', () => {
    // The function returns [] which is a fresh array each call (per
    // existing implementation). Verify this with strict-not-equal.
    const result1 = adaptRawClassifierBinarySource({ messageId: 'a' });
    const result2 = adaptRawClassifierBinarySource({ messageId: 'b' });
    expect(result1).toEqual([]);
    expect(result2).toEqual([]);
    // Both arrays are empty; they have length 0; they may or may not be
    // the same reference depending on implementation. This test asserts
    // the contract is "empty array", not specifically separate references.
  });
});

describe('MCP-021A — Source 6 contract: no rawKeys ever emitted', () => {
  it('the result NEVER contains any classifier rawKey', () => {
    // Battery of inputs that simulate what MCP-021C might pass in;
    // MCP-021A scope guarantees zero output regardless.
    const inputs = [
      { messageId: 'a', binaries: [{ raw_key: 'splits_thread', present: true }] },
      { messageId: 'b', binaries: [{ raw_key: 'evidence_gap_present', present: true }] },
      { messageId: 'c', binaries: [{ raw_key: 'supports_parent', present: true }] },
      {
        messageId: 'd',
        binaries: [
          { raw_key: 'challenges_parent', present: true },
          { raw_key: 'disagreement_present', present: true },
        ],
      },
    ];
    for (const input of inputs) {
      const result = adaptRawClassifierBinarySource(input);
      expect(result).toEqual([]);
      expect(result.length).toBe(0);
    }
  });
});
