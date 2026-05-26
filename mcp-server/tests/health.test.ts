import { assertEquals } from 'std/assert/mod.ts';
import { buildHealthBody, SERVER_VERSION, SUPPORTED_TOOLS } from '../routes/health.ts';

const FIXED_NOW = () => '2026-05-26T00:00:00.000Z';

Deno.test('buildHealthBody reports both supported tools', () => {
  const body = buildHealthBody({
    bearerToken: 'tok',
    anthropicKey: 'sk-ant-x',
    environment: 'prod',
    protocolVersion: '2025-11-25',
    now: FIXED_NOW,
  });
  assertEquals(body.supportedTools.length, 2);
  assertEquals(body.supportedTools[0], 'classify_semantic_move');
  assertEquals(body.supportedTools[1], 'classify_argument_boolean_observations');
});

Deno.test('buildHealthBody credentialsConfigured is false when bearer missing', () => {
  const body = buildHealthBody({
    bearerToken: undefined,
    anthropicKey: 'sk-ant-x',
    environment: 'local',
    protocolVersion: '2025-11-25',
    now: FIXED_NOW,
  });
  assertEquals(body.credentialsConfigured, false);
});

Deno.test('buildHealthBody credentialsConfigured is false when key missing', () => {
  const body = buildHealthBody({
    bearerToken: 'tok',
    anthropicKey: undefined,
    environment: 'local',
    protocolVersion: '2025-11-25',
    now: FIXED_NOW,
  });
  assertEquals(body.credentialsConfigured, false);
});

Deno.test('buildHealthBody credentialsConfigured is true when both set', () => {
  const body = buildHealthBody({
    bearerToken: 'tok',
    anthropicKey: 'sk-ant-x',
    environment: 'prod',
    protocolVersion: '2025-11-25',
    now: FIXED_NOW,
  });
  assertEquals(body.credentialsConfigured, true);
});

Deno.test('buildHealthBody normalizes unknown environment values', () => {
  const body = buildHealthBody({
    bearerToken: 'tok',
    anthropicKey: 'sk-ant-x',
    environment: 'something-else',
    protocolVersion: '2025-11-25',
    now: FIXED_NOW,
  });
  assertEquals(body.environment, 'unknown');
});

Deno.test('buildHealthBody includes server version + protocol version + timestamp', () => {
  const body = buildHealthBody({
    bearerToken: 'tok',
    anthropicKey: 'sk-ant-x',
    environment: 'prod',
    protocolVersion: '2025-11-25',
    now: FIXED_NOW,
  });
  assertEquals(body.version, SERVER_VERSION);
  assertEquals(body.protocolVersion, '2025-11-25');
  assertEquals(body.timestamp, '2026-05-26T00:00:00.000Z');
  assertEquals(body.status, 'ok');
});

Deno.test('buildHealthBody body never contains secret values', () => {
  const body = buildHealthBody({
    bearerToken: 'sk-ant-do-not-leak',
    anthropicKey: 'sk-ant-do-not-leak-either',
    environment: 'prod',
    protocolVersion: '2025-11-25',
    now: FIXED_NOW,
  });
  const text = JSON.stringify(body);
  if (text.includes('sk-ant-do-not-leak')) {
    throw new Error('health body leaked a secret');
  }
});

Deno.test('SUPPORTED_TOOLS is the exact set of two tool names', () => {
  assertEquals(SUPPORTED_TOOLS.length, 2);
});
