import { assertEquals, assertStringIncludes } from 'std/assert/mod.ts';
import {
  log,
  sha256Hex,
  _setLogSinkForTesting,
  _resetLogSinkForTesting,
  generateRequestId,
} from '../lib/logging.ts';

function captureLog(fn: () => void): string[] {
  const lines: string[] = [];
  _setLogSinkForTesting((line) => lines.push(line));
  try {
    fn();
  } finally {
    _resetLogSinkForTesting();
  }
  return lines;
}

Deno.test('log emits a JSON line with ts/level/event', () => {
  const lines = captureLog(() => log('info', 'test_event', { requestId: 'r1' }));
  assertEquals(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assertEquals(parsed.level, 'info');
  assertEquals(parsed.event, 'test_event');
  assertEquals(parsed.requestId, 'r1');
  if (typeof parsed.ts !== 'string') throw new Error('ts missing');
});

Deno.test('log redacts known secret field names', () => {
  const lines = captureLog(() =>
    log('info', 'test_event', {
      requestId: 'r2',
      authorization: 'Bearer should-not-appear',
      bearerToken: 'should-not-appear',
      apiKey: 'should-not-appear',
      anthropicApiKey: 'should-not-appear',
      token: 'should-not-appear',
      rawPrompt: 'do-not-emit',
      moveBody: 'do-not-emit',
      argumentBody: 'do-not-emit',
    }),
  );
  const text = lines[0];
  for (const banned of [
    'should-not-appear',
    'do-not-emit',
  ]) {
    if (text.includes(banned)) {
      throw new Error(`forbidden value leaked: ${banned}`);
    }
  }
  assertStringIncludes(text, '[REDACTED]');
});

Deno.test('log redacts Bearer-like values appearing in arbitrary fields', () => {
  const lines = captureLog(() =>
    log('info', 'test_event', {
      requestId: 'r3',
      message: 'Got header: Bearer abcdef12345',
    }),
  );
  const text = lines[0];
  if (text.includes('Bearer abcdef12345')) {
    throw new Error('Bearer value leaked');
  }
  assertStringIncludes(text, '[REDACTED]');
});

Deno.test('log redacts Anthropic-key-shaped values', () => {
  const lines = captureLog(() =>
    log('info', 'test_event', {
      requestId: 'r4',
      message: 'sk-ant-api01-xxxxxxxxxx',
    }),
  );
  const text = lines[0];
  if (text.includes('sk-ant-api01-xxxxxxxxxx')) {
    throw new Error('Anthropic key leaked');
  }
  assertStringIncludes(text, '[REDACTED]');
});

Deno.test('sha256Hex returns a 64-char hex digest', async () => {
  const hex = await sha256Hex('hello world');
  assertEquals(hex.length, 64);
  if (!/^[0-9a-f]+$/.test(hex)) throw new Error('not hex');
});

Deno.test('generateRequestId produces a non-empty string', () => {
  const id = generateRequestId();
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('expected non-empty string');
  }
});
