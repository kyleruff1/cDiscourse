/**
 * MCP-SERVER-005-FAMILY-D — runAnthropicFamilyDClassifier mock-fetch tests.
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
 *   - Family D specific MAX_TOKENS=1800 is honored (call-args sniff)
 */
import { assertEquals } from 'std/assert/mod.ts';
import { runAnthropicFamilyDClassifier } from '../lib/familyDAnthropic.ts';
import type { ValidatedFamilyDRequest } from '../lib/familyDPrompt.ts';
import { FAMILY_D_MAX_TOKENS } from '../lib/familyDPrompt.ts';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import {
  _setLogSinkForTesting,
  _resetLogSinkForTesting,
} from '../lib/logging.ts';

const FAKE_KEY = 'sk-ant-fake-key-for-test-only-1234567890abcdef';
const SAMPLE_VALID_PACKET = {
  schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  nodeId: 'node-d-1',
  checkedRawKeys: ['source_provided'],
  observations: { source_provided: true },
  confidence: { source_provided: 'high' },
  evidenceSpan: { source_provided: null },
  modelInfo: {
    provider: 'mcp',
    serverName: 'cdiscourse-mcp-server',
    classifierSetVersion: 'family-d-v1',
  },
};

function buildRequest(): ValidatedFamilyDRequest {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'node-d-1',
    parentNodeId: null,
    currentText: 'Per the 2024 EPA report Table 3.1, urban EV emissions dropped 40%.',
    parentText: null,
    threadContextExcerpt: 'sample thread',
    requestedFamilies: ['evidence_source_chain'],
    requestedRawKeys: ['source_provided'],
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

Deno.test('runAnthropicFamilyDClassifier: happy path returns parsed packet', async () => {
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
    const result = await runAnthropicFamilyDClassifier(buildRequest(), 'req-d-1', mockFetch);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.packet.schemaVersion, MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION);
    }
  });
});

Deno.test('runAnthropicFamilyDClassifier: key_missing when ANTHROPIC_API_KEY unset', async () => {
  await withNoKey(async () => {
    const result = await runAnthropicFamilyDClassifier(buildRequest(), 'req-d-2');
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.reason, 'key_missing');
    }
  });
});

Deno.test('runAnthropicFamilyDClassifier: HTTP 429 returns rate_limited', async () => {
  await withFakeKey(async () => {
    const mockFetch: typeof fetch = async () => {
      return await Promise.resolve(new Response('rate limited', { status: 429 }));
    };
    const result = await runAnthropicFamilyDClassifier(buildRequest(), 'req-d-3', mockFetch);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.reason, 'rate_limited');
    }
  });
});

Deno.test('runAnthropicFamilyDClassifier: HTTP 500 returns api_error', async () => {
  await withFakeKey(async () => {
    const mockFetch: typeof fetch = async () => {
      return await Promise.resolve(new Response('boom', { status: 500 }));
    };
    const result = await runAnthropicFamilyDClassifier(buildRequest(), 'req-d-4', mockFetch);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.reason, 'api_error');
    }
  });
});

Deno.test('runAnthropicFamilyDClassifier: TimeoutError returns model_timeout', async () => {
  await withFakeKey(async () => {
    const mockFetch: typeof fetch = async () => {
      const err = new Error('aborted');
      err.name = 'TimeoutError';
      await Promise.resolve();
      throw err;
    };
    const result = await runAnthropicFamilyDClassifier(buildRequest(), 'req-d-5', mockFetch);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.reason, 'model_timeout');
    }
  });
});

Deno.test('runAnthropicFamilyDClassifier: non-JSON response returns parse_failure', async () => {
  await withFakeKey(async () => {
    const mockFetch: typeof fetch = async () => {
      return await Promise.resolve(new Response('plain text not json', { status: 200 }));
    };
    const result = await runAnthropicFamilyDClassifier(buildRequest(), 'req-d-6', mockFetch);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.reason, 'parse_failure');
    }
  });
});

Deno.test('runAnthropicFamilyDClassifier: model text without JSON object returns parse_failure', async () => {
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
    const result = await runAnthropicFamilyDClassifier(buildRequest(), 'req-d-7', mockFetch);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.reason, 'parse_failure');
    }
  });
});

Deno.test('runAnthropicFamilyDClassifier: API key NEVER appears in any log line (success path)', async () => {
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
      await runAnthropicFamilyDClassifier(buildRequest(), 'req-d-log-1', mockFetch);
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

Deno.test('runAnthropicFamilyDClassifier: API key NEVER appears in any log line (failure path)', async () => {
  await withFakeKey(async () => {
    const lines: string[] = [];
    _setLogSinkForTesting((line) => lines.push(line));
    try {
      const mockFetch: typeof fetch = async () => {
        return await Promise.resolve(new Response('boom', { status: 500 }));
      };
      await runAnthropicFamilyDClassifier(buildRequest(), 'req-d-log-2', mockFetch);
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

Deno.test('runAnthropicFamilyDClassifier: logs are tagged with classify_argument_boolean_observations tool', async () => {
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
      await runAnthropicFamilyDClassifier(buildRequest(), 'req-d-tag-1', mockFetch);
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

Deno.test('runAnthropicFamilyDClassifier: MAX_TOKENS=1800 is sent to Anthropic API (Stage 2B bump)', async () => {
  // Sniff the outgoing Anthropic call body to confirm the Stage 2B-approved
  // 1800-token budget is honored. Family A/B/C use 1500; Family D uses 1800.
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
    await runAnthropicFamilyDClassifier(buildRequest(), 'req-d-budget-1', mockFetch);
    assertEquals(observedMaxTokens, 1800);
    assertEquals(FAMILY_D_MAX_TOKENS, 1800);
  });
});
