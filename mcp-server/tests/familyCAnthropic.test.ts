/**
 * MCP-SERVER-004-FAMILY-C — runAnthropicFamilyCClassifier mock-fetch tests.
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
 */
import { assertEquals } from 'std/assert/mod.ts';
import { runAnthropicFamilyCClassifier } from '../lib/familyCAnthropic.ts';
import type { ValidatedFamilyCRequest } from '../lib/familyCPrompt.ts';
import { MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION } from '../lib/mcpBooleanObservationSchemaMirror.ts';
import {
  _setLogSinkForTesting,
  _resetLogSinkForTesting,
} from '../lib/logging.ts';

const FAKE_KEY = 'sk-ant-fake-key-for-test-only-1234567890abcdef';
const SAMPLE_VALID_PACKET = {
  schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  nodeId: 'node-c-1',
  checkedRawKeys: ['offers_candidate_understanding'],
  observations: { offers_candidate_understanding: true },
  confidence: { offers_candidate_understanding: 'high' },
  evidenceSpan: { offers_candidate_understanding: null },
  modelInfo: {
    provider: 'mcp',
    serverName: 'cdiscourse-mcp-server',
    classifierSetVersion: 'family-c-v1',
  },
};

function buildRequest(): ValidatedFamilyCRequest {
  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: 'node-c-1',
    parentNodeId: null,
    currentText: 'Are you saying libraries are public goods funded like roads?',
    parentText: null,
    threadContextExcerpt: 'sample thread',
    requestedFamilies: ['misunderstanding_repair'],
    requestedRawKeys: ['offers_candidate_understanding'],
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

Deno.test('runAnthropicFamilyCClassifier: happy path returns parsed packet', async () => {
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
    const result = await runAnthropicFamilyCClassifier(buildRequest(), 'req-c-1', mockFetch);
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.packet.schemaVersion, MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION);
    }
  });
});

Deno.test('runAnthropicFamilyCClassifier: key_missing when ANTHROPIC_API_KEY unset', async () => {
  await withNoKey(async () => {
    const result = await runAnthropicFamilyCClassifier(buildRequest(), 'req-c-2');
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.reason, 'key_missing');
    }
  });
});

Deno.test('runAnthropicFamilyCClassifier: HTTP 429 returns rate_limited', async () => {
  await withFakeKey(async () => {
    const mockFetch: typeof fetch = async () => {
      return await Promise.resolve(new Response('rate limited', { status: 429 }));
    };
    const result = await runAnthropicFamilyCClassifier(buildRequest(), 'req-c-3', mockFetch);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.reason, 'rate_limited');
    }
  });
});

Deno.test('runAnthropicFamilyCClassifier: HTTP 500 returns api_error', async () => {
  await withFakeKey(async () => {
    const mockFetch: typeof fetch = async () => {
      return await Promise.resolve(new Response('boom', { status: 500 }));
    };
    const result = await runAnthropicFamilyCClassifier(buildRequest(), 'req-c-4', mockFetch);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.reason, 'api_error');
    }
  });
});

Deno.test('runAnthropicFamilyCClassifier: TimeoutError returns model_timeout', async () => {
  await withFakeKey(async () => {
    const mockFetch: typeof fetch = async () => {
      const err = new Error('aborted');
      err.name = 'TimeoutError';
      await Promise.resolve();
      throw err;
    };
    const result = await runAnthropicFamilyCClassifier(buildRequest(), 'req-c-5', mockFetch);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.reason, 'model_timeout');
    }
  });
});

Deno.test('runAnthropicFamilyCClassifier: non-JSON response returns parse_failure', async () => {
  await withFakeKey(async () => {
    const mockFetch: typeof fetch = async () => {
      return await Promise.resolve(new Response('plain text not json', { status: 200 }));
    };
    const result = await runAnthropicFamilyCClassifier(buildRequest(), 'req-c-6', mockFetch);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.reason, 'parse_failure');
    }
  });
});

Deno.test('runAnthropicFamilyCClassifier: model text without JSON object returns parse_failure', async () => {
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
    const result = await runAnthropicFamilyCClassifier(buildRequest(), 'req-c-7', mockFetch);
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.reason, 'parse_failure');
    }
  });
});

Deno.test('runAnthropicFamilyCClassifier: API key NEVER appears in any log line (success path)', async () => {
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
      await runAnthropicFamilyCClassifier(buildRequest(), 'req-c-log-1', mockFetch);
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

Deno.test('runAnthropicFamilyCClassifier: API key NEVER appears in any log line (failure path)', async () => {
  await withFakeKey(async () => {
    const lines: string[] = [];
    _setLogSinkForTesting((line) => lines.push(line));
    try {
      const mockFetch: typeof fetch = async () => {
        return await Promise.resolve(new Response('boom', { status: 500 }));
      };
      await runAnthropicFamilyCClassifier(buildRequest(), 'req-c-log-2', mockFetch);
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

Deno.test('runAnthropicFamilyCClassifier: logs are tagged with classify_argument_boolean_observations tool', async () => {
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
      await runAnthropicFamilyCClassifier(buildRequest(), 'req-c-tag-1', mockFetch);
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
