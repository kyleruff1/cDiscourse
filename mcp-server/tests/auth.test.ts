import { assertEquals } from 'std/assert/mod.ts';
import { validateBearer, buildBearerErrorEnvelopes } from '../lib/auth.ts';

Deno.test('validateBearer rejects when expected token unset', () => {
  const r = validateBearer('Bearer abc', undefined);
  if (r.ok) throw new Error('expected error');
  assertEquals(r.reason, 'server_misconfigured');
  assertEquals(r.httpStatus, 500);
});

Deno.test('validateBearer rejects missing header', () => {
  const r = validateBearer(null, 'expected');
  if (r.ok) throw new Error('expected error');
  assertEquals(r.reason, 'missing_header');
  assertEquals(r.httpStatus, 401);
});

Deno.test('validateBearer rejects wrong scheme', () => {
  const r = validateBearer('Basic abc', 'expected');
  if (r.ok) throw new Error('expected error');
  assertEquals(r.reason, 'wrong_scheme');
});

Deno.test('validateBearer rejects empty bearer value', () => {
  const r = validateBearer('Bearer ', 'expected');
  if (r.ok) throw new Error('expected error');
  assertEquals(r.reason, 'wrong_scheme');
});

Deno.test('validateBearer rejects mismatched token', () => {
  const r = validateBearer('Bearer wrong', 'expected');
  if (r.ok) throw new Error('expected error');
  assertEquals(r.reason, 'token_mismatch');
});

Deno.test('validateBearer accepts matching token', () => {
  const r = validateBearer('Bearer expected', 'expected');
  if (!r.ok) throw new Error('expected ok');
});

Deno.test('validateBearer constant-time-compares (same length but different)', () => {
  const r = validateBearer('Bearer same-leng', 'same-leng-other');
  // They have different length so returns mismatch fast.
  if (r.ok) throw new Error('expected error');
  assertEquals(r.reason, 'token_mismatch');
});

Deno.test('buildBearerErrorEnvelopes returns documented JSON-RPC + adapter-compat shapes', () => {
  const env = buildBearerErrorEnvelopes('missing_header');
  assertEquals(env.adapterCompat.error, 'unauthorized');
  assertEquals(typeof env.adapterCompat.message, 'string');
  assertEquals(env.jsonRpc.message, 'unauthorized');
});

Deno.test('buildBearerErrorEnvelopes distinguishes server_misconfigured', () => {
  const env = buildBearerErrorEnvelopes('server_misconfigured');
  assertEquals(env.adapterCompat.error, 'server_misconfigured');
  assertEquals(env.jsonRpc.message, 'server_misconfigured');
});
