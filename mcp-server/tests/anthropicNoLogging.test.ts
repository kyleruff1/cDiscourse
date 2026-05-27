import { assertEquals } from 'std/assert/mod.ts';
import {
  _setLogSinkForTesting,
  _resetLogSinkForTesting,
} from '../lib/logging.ts';
import { runAnthropicSemanticReferee } from '../lib/anthropic.ts';
import type { ClassifyMoveRequestValue } from '../lib/semanticRefereePacketSchema.ts';

const FAKE_ANTHROPIC_KEY = 'sk-ant-fake-test-key-do-not-use-elsewhere-1234567890abcdefxyz';

function buildRequest(): ClassifyMoveRequestValue {
  return {
    moveBodyRedacted: '[fixture] anything',
    roomContext: { debateMode: 'structured_dispute' },
    requestedClassifiers: ['responds_to_parent'],
    contentHash: 'h',
    roomId: 'r',
  };
}

Deno.test('runAnthropicSemanticReferee NEVER logs the API key on success path', async () => {
  const prev = Deno.env.get('ANTHROPIC_API_KEY');
  Deno.env.set('ANTHROPIC_API_KEY', FAKE_ANTHROPIC_KEY);
  const lines: string[] = [];
  _setLogSinkForTesting((line) => lines.push(line));
  try {
    // Mock fetch returns a minimal valid Anthropic Messages response.
    const mockFetch: typeof fetch = async () => {
      return await Promise.resolve(
        new Response(
          JSON.stringify({
            model: 'claude-haiku-4-5',
            stop_reason: 'end_turn',
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  binaries: [
                    {
                      classifierId: 'responds_to_parent',
                      value: 1,
                      confidence: 'high',
                      reasonCode: 'parent_continuity_engaged',
                    },
                  ],
                  routeSuggestion: 'mainline',
                  frictionSuggestion: 'none',
                  scoreHints: {
                    continuityCredit: 1,
                    evidencePressure: 0,
                    branchHygiene: 0,
                    synthesisReadiness: 0,
                    sourceChainDebt: 0,
                    unresolvedRedirectRisk: 0,
                  },
                }),
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
    };
    const result = await runAnthropicSemanticReferee(buildRequest(), 'req-1', mockFetch);
    assertEquals(result.ok, true);
    // Scan every log line for the API key — must NOT appear.
    for (const line of lines) {
      if (line.includes(FAKE_ANTHROPIC_KEY)) {
        throw new Error(`API key appeared in a log line: ${line}`);
      }
    }
  } finally {
    _resetLogSinkForTesting();
    if (prev === undefined) Deno.env.delete('ANTHROPIC_API_KEY');
    else Deno.env.set('ANTHROPIC_API_KEY', prev);
  }
});

Deno.test('runAnthropicSemanticReferee NEVER logs the API key on failure path', async () => {
  const prev = Deno.env.get('ANTHROPIC_API_KEY');
  Deno.env.set('ANTHROPIC_API_KEY', FAKE_ANTHROPIC_KEY);
  const lines: string[] = [];
  _setLogSinkForTesting((line) => lines.push(line));
  try {
    const mockFetch: typeof fetch = async () => {
      return await Promise.resolve(new Response('boom', { status: 500 }));
    };
    const result = await runAnthropicSemanticReferee(buildRequest(), 'req-2', mockFetch);
    assertEquals(result.ok, false);
    for (const line of lines) {
      if (line.includes(FAKE_ANTHROPIC_KEY)) {
        throw new Error(`API key appeared in a log line: ${line}`);
      }
    }
  } finally {
    _resetLogSinkForTesting();
    if (prev === undefined) Deno.env.delete('ANTHROPIC_API_KEY');
    else Deno.env.set('ANTHROPIC_API_KEY', prev);
  }
});

Deno.test('runAnthropicSemanticReferee NEVER logs the API key on timeout', async () => {
  const prev = Deno.env.get('ANTHROPIC_API_KEY');
  Deno.env.set('ANTHROPIC_API_KEY', FAKE_ANTHROPIC_KEY);
  const lines: string[] = [];
  _setLogSinkForTesting((line) => lines.push(line));
  try {
    const mockFetch: typeof fetch = async () => {
      const err = new Error('aborted');
      err.name = 'TimeoutError';
      await Promise.resolve();
      throw err;
    };
    const result = await runAnthropicSemanticReferee(buildRequest(), 'req-3', mockFetch);
    assertEquals(result.ok, false);
    if (result.ok === false) {
      assertEquals(result.reason, 'model_timeout');
    }
    for (const line of lines) {
      if (line.includes(FAKE_ANTHROPIC_KEY)) {
        throw new Error(`API key appeared in a log line: ${line}`);
      }
    }
  } finally {
    _resetLogSinkForTesting();
    if (prev === undefined) Deno.env.delete('ANTHROPIC_API_KEY');
    else Deno.env.set('ANTHROPIC_API_KEY', prev);
  }
});

Deno.test('anthropic source file never console.logs the Authorization header', async () => {
  // Source-text scan — defensive defence-in-depth on top of the runtime test.
  const source = await Deno.readTextFile(new URL('../lib/anthropic.ts', import.meta.url));
  if (/console\.log.*Authorization/i.test(source)) {
    throw new Error('anthropic.ts contains a console.log line that mentions Authorization');
  }
  if (/console\.log.*x-api-key/i.test(source)) {
    throw new Error('anthropic.ts contains a console.log line that mentions x-api-key');
  }
  if (/console\.log.*ANTHROPIC_API_KEY/i.test(source)) {
    throw new Error('anthropic.ts contains a console.log line that mentions ANTHROPIC_API_KEY');
  }
});

Deno.test('anthropicCall source file never console.logs the Authorization header', async () => {
  const source = await Deno.readTextFile(new URL('../lib/anthropicCall.ts', import.meta.url));
  if (/console\.log.*Authorization/i.test(source)) {
    throw new Error('anthropicCall.ts contains a console.log line that mentions Authorization');
  }
  if (/console\.log.*x-api-key/i.test(source)) {
    throw new Error('anthropicCall.ts contains a console.log line that mentions x-api-key');
  }
  if (/console\.log.*ANTHROPIC_API_KEY/i.test(source)) {
    throw new Error('anthropicCall.ts contains a console.log line that mentions ANTHROPIC_API_KEY');
  }
});

Deno.test('familyAAnthropic source file never console.logs the Authorization header', async () => {
  const source = await Deno.readTextFile(new URL('../lib/familyAAnthropic.ts', import.meta.url));
  if (/console\.log.*Authorization/i.test(source)) {
    throw new Error('familyAAnthropic.ts contains a console.log line that mentions Authorization');
  }
  if (/console\.log.*x-api-key/i.test(source)) {
    throw new Error('familyAAnthropic.ts contains a console.log line that mentions x-api-key');
  }
  if (/console\.log.*ANTHROPIC_API_KEY/i.test(source)) {
    throw new Error('familyAAnthropic.ts contains a console.log line that mentions ANTHROPIC_API_KEY');
  }
});
