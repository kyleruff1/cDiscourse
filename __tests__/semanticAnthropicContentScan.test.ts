/**
 * MCP-017 — semantic-referee Deno content-safety scanner unit tests.
 *
 * Covers `contentSafetyScan.ts`'s `scanPacketContent`, loaded via the
 * `_helpers/semanticRefereeDeno.ts` bridge. The scanner is the value-content
 * wall: the `.strict()` `SemanticRefereePacketSchema` rejects an unknown KEY;
 * this scanner rejects a verdict / person / secret / PII token INSIDE a
 * contract-valid string, plus a smuggled off-contract key nested in
 * `binaries[]` / `scoreHints`.
 *
 * Every result must be `{ ok: true }` or `{ ok: false, reason: 'validation_failed',
 * detail }` with a SANITIZED detail that never echoes the offending value.
 */
import { scanPacketContent } from './_helpers/semanticRefereeDeno';

/** A clean, mock-shaped packet — the scanner must pass it. */
function cleanPacket(): Record<string, unknown> {
  return {
    packetVersion: 'mcp-semantic-referee-v0',
    promptVersion: 'mcp-semantic-referee-prompt-v0',
    modelVersion: 'claude-haiku-4-5',
    provider: 'anthropic',
    authoritative: false,
    inputHash: 'anthropic-0a1b2c3d',
    contentHash: 'hash-1',
    roomId: 'room-1',
    binaries: [
      {
        classifierId: 'responds_to_parent',
        value: 1,
        confidence: 'medium',
        reasonCode: 'parent_continuity_present',
      },
    ],
    routeSuggestion: 'no_route_change',
    frictionSuggestion: 'none',
    scoreHints: {
      continuityCredit: 1,
      evidencePressure: 0,
      branchHygiene: 0,
      synthesisReadiness: 0,
      sourceChainDebt: 0,
      unresolvedRedirectRisk: 0,
    },
  };
}

describe('scanPacketContent — clean packet', () => {
  it('passes a clean mock-shaped packet', () => {
    expect(scanPacketContent(cleanPacket())).toEqual({ ok: true });
  });

  it('passes a packet with no binaries', () => {
    const packet = { ...cleanPacket(), binaries: [] };
    expect(scanPacketContent(packet)).toEqual({ ok: true });
  });

  it('passes a packet carrying optional evidence / parent spans with safe text', () => {
    const packet = cleanPacket();
    (packet.binaries as Array<Record<string, unknown>>)[0].evidenceSpan =
      'a clean quoted span of the move';
    (packet.binaries as Array<Record<string, unknown>>)[0].parentSpan =
      'a clean quoted span of the parent';
    expect(scanPacketContent(packet)).toEqual({ ok: true });
  });
});

describe('scanPacketContent — verdict tokens', () => {
  it('rejects a verdict token in a reasonCode', () => {
    const packet = cleanPacket();
    (packet.binaries as Array<Record<string, unknown>>)[0].reasonCode = 'winner_detected';
    const result = scanPacketContent(packet);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('validation_failed');
      expect(result.detail).toContain('verdict');
    }
  });

  it('rejects a verdict token in a top-level routeSuggestion-shaped string field', () => {
    const packet = { ...cleanPacket(), frictionSuggestion: 'claim_is_true' };
    const result = scanPacketContent(packet);
    expect(result.ok).toBe(false);
  });

  it('rejects each verdict token as a snake_case segment', () => {
    for (const token of ['winner', 'loser', 'proven', 'defeated', 'correct']) {
      const packet = cleanPacket();
      (packet.binaries as Array<Record<string, unknown>>)[0].reasonCode = `${token}_state`;
      expect(scanPacketContent(packet).ok).toBe(false);
    }
  });
});

describe('scanPacketContent — person-label tokens', () => {
  it('rejects a person-label token in an evidenceSpan', () => {
    const packet = cleanPacket();
    (packet.binaries as Array<Record<string, unknown>>)[0].evidenceSpan =
      'the author is a liar here';
    const result = scanPacketContent(packet);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail).toContain('person-label');
  });

  it('rejects a multi-word person-label phrase', () => {
    const packet = cleanPacket();
    (packet.binaries as Array<Record<string, unknown>>)[0].parentSpan =
      'this is arguing in bad faith';
    const result = scanPacketContent(packet);
    expect(result.ok).toBe(false);
  });
});

describe('scanPacketContent — smuggled / off-contract keys', () => {
  it('rejects a smuggled top-level block field', () => {
    const packet = { ...cleanPacket(), block: true };
    const result = scanPacketContent(packet);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail.toLowerCase()).toContain('blocking');
  });

  it('rejects a smuggled reasoning (chain-of-thought) field', () => {
    const packet = { ...cleanPacket(), reasoning: 'because the model thought so' };
    const result = scanPacketContent(packet);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail.toLowerCase()).toContain('chain-of-thought');
  });

  it('rejects a smuggled system_prompt (raw-prompt) field', () => {
    const packet = { ...cleanPacket(), system_prompt: 'You are a classifier...' };
    const result = scanPacketContent(packet);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail.toLowerCase()).toContain('raw-prompt');
  });

  it('rejects a smuggled key nested inside a binaries[] entry', () => {
    const packet = cleanPacket();
    (packet.binaries as Array<Record<string, unknown>>)[0].verdict = 'affirmative_wins';
    const result = scanPacketContent(packet);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail).toContain('binaries[0]');
  });

  it('rejects a smuggled key nested inside scoreHints', () => {
    const packet = cleanPacket();
    (packet.scoreHints as Record<string, unknown>).extraField = 9;
    const result = scanPacketContent(packet);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail).toContain('scoreHints');
  });
});

describe('scanPacketContent — secret / PII shapes', () => {
  it('rejects an @handle in a span', () => {
    const packet = cleanPacket();
    (packet.binaries as Array<Record<string, unknown>>)[0].evidenceSpan =
      'see ' + '@' + 'someuser for details';
    const result = scanPacketContent(packet);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail).toContain('handle');
  });

  it('rejects a URL in a span', () => {
    const packet = cleanPacket();
    (packet.binaries as Array<Record<string, unknown>>)[0].parentSpan =
      'source: ' + 'https://' + 'example.invalid/x';
    expect(scanPacketContent(packet).ok).toBe(false);
  });

  it('rejects a key-shaped string in a span', () => {
    const packet = cleanPacket();
    const fakeKey = 'sk-' + 'ant-' + 'abcd1234efgh';
    (packet.binaries as Array<Record<string, unknown>>)[0].evidenceSpan = `leaked ${fakeKey}`;
    const result = scanPacketContent(packet);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail.toLowerCase()).toContain('credential');
  });
});

describe('scanPacketContent — sanitized detail + robustness', () => {
  it('never echoes the offending value in the detail', () => {
    const packet = cleanPacket();
    (packet.binaries as Array<Record<string, unknown>>)[0].reasonCode = 'winner_detected';
    const result = scanPacketContent(packet);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // The offending raw token string must not be echoed back.
      expect(result.detail).not.toContain('winner_detected');
    }
  });

  it('never echoes a leaked secret value in the detail', () => {
    const packet = cleanPacket();
    const fakeKey = 'sk-' + 'ant-' + 'topsecretvalue';
    (packet.binaries as Array<Record<string, unknown>>)[0].evidenceSpan = fakeKey;
    const result = scanPacketContent(packet);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.detail).not.toContain('topsecretvalue');
  });

  it('rejects a non-object input — never throws', () => {
    expect(scanPacketContent(null).ok).toBe(false);
    expect(scanPacketContent('a string').ok).toBe(false);
    expect(scanPacketContent(42).ok).toBe(false);
    expect(scanPacketContent([]).ok).toBe(false);
  });
});
