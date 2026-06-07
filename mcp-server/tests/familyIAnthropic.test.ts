/**
 * MCP-SERVER-010-FAMILY-I — runAnthropicFamilyIClassifier mock-fetch tests.
 *
 * NEVER makes a real Anthropic call. All fetch overrides are local mocks.
 * Covers:
 *   - happy path returns parsed packet
 *   - missing API key returns key_missing
 *   - HTTP 429 returns rate_limited
 *   - HTTP 500 returns api_error
 *   - timeout returns model_timeout
 *   - non-JSON response returns parse_failure
 *   - model text without JSON returns parse_failure
 *   - API key never appears in any log line (success + failure paths)
 *   - logs are tagged with classify_argument_boolean_observations
 *   - Family I MAX_TOKENS=1500 is honored (call-args sniff; no bump per
 *     design §A.2; I has ~990 token headroom on 6 keys)
 */
import { assertEquals } from 'std/assert/mod.ts';
import { runAnthropicFamilyIClassifier } from '../lib/familyIAnthropic.ts';
import type { ValidatedFamilyIRequest } from '../lib/familyIPrompt.ts';
import { FAMILY_I_MAX_TOKENS } from '../lib/familyIPrompt.ts';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import {
  _setLogSinkForTesting,
  _resetLogSinkForTesting,
} from '../lib/logging.ts';

const FAKE_KEY = 'sk-ant-fake-key-for-test-only-1234567890abcdef';
const SAMPLE_VALID_PACKET = {
  schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  nodeId: 'node-i-1',
  checkedRawKeys: ['introduces_new_issue'],
  observations: { introduces_new_issue: true },
  confidence: { introduces_new_issue: 'high' },
  evidenceSpan: { introduces_new_issue: null },
  modelInfo: {
    provider: 'mcp',
    serverName: 'cdiscourse-mcp-server',
    classifierSetVersion: 'family-i-v1',
  },
};

function buildRequest(): ValidatedFamilyIRequest {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'node-i-1',
    parentNodeId: null,
    currentText: "Worth thinking about museum funding too — that's a different question.",
    parentText: null,
    threadContextExcerpt: 'sample thread',
    requestedFamilies: ['thread_topology'],
    requestedRawKeys: ['introduces_new_issue'],
    timeoutMs: 12000,
  };
}

function withFakeKey<T>(fn: () => Promise<T>): Promise<T> {
  const prev = Deno.env.get('ANTHROPIC_API_KEY');
  Deno.env.set('ANTHROPIC_API_KEY', FAKE_KEY);
  return fn().finally(() => {
    if (prev === undefined) Deno.env.delete('ANTHROPIC_API_KEY');
    else Deno.env.set('ANTHROPIC_API_KEY', prev);
  });
}

function withNoKey<T>(fn: () => Promise<T>): Promise<T> {
  const prev = Deno.env.get('ANTHROPIC_API_KEY');
  Deno.env.delete('ANTHROPIC_API_KEY');
  return fn().finally(() => {
    if (prev === undefined) Deno.env.delete('ANTHROPIC_API_KEY');
    else Deno.env.set('ANTHROPIC_API_KEY', prev);
  });
}

Deno.test('runAnthropicFamilyIClassifier: happy path returns parsed packet', async () => {
  await withFakeKey(async () => {
    const mockFetch: typeof fetch = async () => {
      return await Promise.resolve(
        new Response(
          JSON.stringify({
            model: 'claude-haiku-4-5',
            stop_reason: 'end_turn',
            content: [{ type: 'text', text: JSON.stringify(SAMPLE_VALID_PACKET) }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    };
    const result = await runAnthropicFamilyIClassifier(buildRequest(), 'req-i-1', mockFetch);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.packet.schemaVersion, MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION);
    }
  });
});

Deno.test('runAnthropicFamilyIClassifier: key_missing when ANTHROPIC_API_KEY unset', async () => {
  await withNoKey(async () => {
    const result = await runAnthropicFamilyIClassifier(buildRequest(), 'req-i-2');
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.reason, 'key_missing');
    }
  });
});

Deno.test('runAnthropicFamilyIClassifier: HTTP 429 returns rate_limited', async () => {
  await withFakeKey(async () => {
    const mockFetch: typeof fetch = async () => {
      return await Promise.resolve(new Response('rate limited', { status: 429 }));
    };
    const result = await runAnthropicFamilyIClassifier(buildRequest(), 'req-i-3', mockFetch);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.reason, 'rate_limited');
    }
  });
});

Deno.test('runAnthropicFamilyIClassifier: HTTP 500 returns api_error', async () => {
  await withFakeKey(async () => {
    const mockFetch: typeof fetch = async () => {
      return await Promise.resolve(new Response('boom', { status: 500 }));
    };
    const result = await runAnthropicFamilyIClassifier(buildRequest(), 'req-i-4', mockFetch);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.reason, 'api_error');
    }
  });
});

Deno.test('runAnthropicFamilyIClassifier: TimeoutError returns model_timeout', async () => {
  await withFakeKey(async () => {
    const mockFetch: typeof fetch = async () => {
      const err = new Error('aborted');
      err.name = 'TimeoutError';
      await Promise.resolve();
      throw err;
    };
    const result = await runAnthropicFamilyIClassifier(buildRequest(), 'req-i-5', mockFetch);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.reason, 'model_timeout');
    }
  });
});

Deno.test('runAnthropicFamilyIClassifier: non-JSON response returns parse_failure', async () => {
  await withFakeKey(async () => {
    const mockFetch: typeof fetch = async () => {
      return await Promise.resolve(new Response('plain text not json', { status: 200 }));
    };
    const result = await runAnthropicFamilyIClassifier(buildRequest(), 'req-i-6', mockFetch);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.reason, 'parse_failure');
    }
  });
});

Deno.test('runAnthropicFamilyIClassifier: model text without JSON object returns parse_failure', async () => {
  await withFakeKey(async () => {
    const mockFetch: typeof fetch = async () => {
      return await Promise.resolve(
        new Response(
          JSON.stringify({
            content: [{ type: 'text', text: 'just plain prose, no JSON' }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    };
    const result = await runAnthropicFamilyIClassifier(buildRequest(), 'req-i-7', mockFetch);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.reason, 'parse_failure');
    }
  });
});

Deno.test('runAnthropicFamilyIClassifier: API key NEVER appears in any log line (success path)', async () => {
  await withFakeKey(async () => {
    const lines: string[] = [];
    _setLogSinkForTesting((line) => lines.push(line));
    try {
      const mockFetch: typeof fetch = async () => {
        return await Promise.resolve(
          new Response(
            JSON.stringify({
              content: [{ type: 'text', text: JSON.stringify(SAMPLE_VALID_PACKET) }],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      };
      await runAnthropicFamilyIClassifier(buildRequest(), 'req-i-log-1', mockFetch);
      for (const line of lines) {
        if (line.includes(FAKE_KEY)) {
          throw new Error(`API key appeared in log: ${line}`);
        }
      }
    } finally {
      _resetLogSinkForTesting();
    }
  });
});

Deno.test('runAnthropicFamilyIClassifier: API key NEVER appears in any log line (failure path)', async () => {
  await withFakeKey(async () => {
    const lines: string[] = [];
    _setLogSinkForTesting((line) => lines.push(line));
    try {
      const mockFetch: typeof fetch = async () => {
        return await Promise.resolve(new Response('boom', { status: 500 }));
      };
      await runAnthropicFamilyIClassifier(buildRequest(), 'req-i-log-2', mockFetch);
      for (const line of lines) {
        if (line.includes(FAKE_KEY)) {
          throw new Error(`API key appeared in log: ${line}`);
        }
      }
    } finally {
      _resetLogSinkForTesting();
    }
  });
});

Deno.test('runAnthropicFamilyIClassifier: logs are tagged with classify_argument_boolean_observations tool', async () => {
  await withFakeKey(async () => {
    const lines: string[] = [];
    _setLogSinkForTesting((line) => lines.push(line));
    try {
      const mockFetch: typeof fetch = async () => {
        return await Promise.resolve(
          new Response(
            JSON.stringify({
              content: [{ type: 'text', text: JSON.stringify(SAMPLE_VALID_PACKET) }],
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        );
      };
      await runAnthropicFamilyIClassifier(buildRequest(), 'req-i-tag-1', mockFetch);
      const hasTag = lines.some((line) =>
        line.includes('"tool":"classify_argument_boolean_observations"'),
      );
      if (!hasTag) {
        throw new Error('No log line tagged with classify_argument_boolean_observations tool');
      }
    } finally {
      _resetLogSinkForTesting();
    }
  });
});

Deno.test('runAnthropicFamilyIClassifier: MAX_TOKENS=1500 is sent to Anthropic API (no bump per design §A.2)', async () => {
  // Family I uses MAX_TOKENS=1500 (matches Family A/B/C/E/F/G/H; I has ~990
  // token headroom on 6 keys, the largest absolute headroom of any family
  // A-I). Per design §A.2: T4 NOT FIRED.
  await withFakeKey(async () => {
    let observedMaxTokens = -1;
    const mockFetch: typeof fetch = async (_input, init) => {
      const initAny = init as unknown as { body?: unknown };
      if (initAny && typeof initAny.body === 'string') {
        try {
          const body = JSON.parse(initAny.body) as { max_tokens?: number };
          if (typeof body.max_tokens === 'number') {
            observedMaxTokens = body.max_tokens;
          }
        } catch {
          // fall through
        }
      }
      return await Promise.resolve(
        new Response(
          JSON.stringify({
            content: [{ type: 'text', text: JSON.stringify(SAMPLE_VALID_PACKET) }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    };
    await runAnthropicFamilyIClassifier(buildRequest(), 'req-i-budget-1', mockFetch);
    assertEquals(observedMaxTokens, 1500);
    assertEquals(FAMILY_I_MAX_TOKENS, 1500);
  });
});
