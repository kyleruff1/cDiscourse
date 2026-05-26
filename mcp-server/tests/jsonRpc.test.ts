import { assertEquals } from 'std/assert/mod.ts';
import {
  parseJsonRpcRequest,
  buildSuccess,
  buildError,
  JSON_RPC_INVALID_REQUEST,
  JSON_RPC_PARSE_ERROR,
} from '../lib/jsonRpc.ts';

Deno.test('parseJsonRpcRequest accepts a valid request with id', () => {
  const result = parseJsonRpcRequest({ jsonrpc: '2.0', id: 'abc', method: 'initialize' });
  if (!result.ok) throw new Error('expected ok');
  assertEquals(result.request.method, 'initialize');
  assertEquals(result.request.id, 'abc');
  assertEquals(result.isNotification, false);
});

Deno.test('parseJsonRpcRequest accepts a notification (no id)', () => {
  const result = parseJsonRpcRequest({ jsonrpc: '2.0', method: 'notifications/initialized' });
  if (!result.ok) throw new Error('expected ok');
  assertEquals(result.isNotification, true);
});

Deno.test('parseJsonRpcRequest rejects non-object body', () => {
  const result = parseJsonRpcRequest('not-an-object');
  if (result.ok) throw new Error('expected error');
  assertEquals(result.error.code, JSON_RPC_INVALID_REQUEST);
});

Deno.test('parseJsonRpcRequest rejects wrong jsonrpc version', () => {
  const result = parseJsonRpcRequest({ jsonrpc: '1.0', id: 1, method: 'initialize' });
  if (result.ok) throw new Error('expected error');
  assertEquals(result.error.code, JSON_RPC_INVALID_REQUEST);
});

Deno.test('parseJsonRpcRequest rejects missing method', () => {
  const result = parseJsonRpcRequest({ jsonrpc: '2.0', id: 1 });
  if (result.ok) throw new Error('expected error');
  assertEquals(result.error.code, JSON_RPC_INVALID_REQUEST);
});

Deno.test('parseJsonRpcRequest rejects non-string method', () => {
  const result = parseJsonRpcRequest({ jsonrpc: '2.0', id: 1, method: 5 });
  if (result.ok) throw new Error('expected error');
  assertEquals(result.error.code, JSON_RPC_INVALID_REQUEST);
});

Deno.test('parseJsonRpcRequest accepts null id', () => {
  const result = parseJsonRpcRequest({ jsonrpc: '2.0', id: null, method: 'ping' });
  if (!result.ok) throw new Error('expected ok');
  assertEquals(result.request.id, null);
  assertEquals(result.isNotification, false);
});

Deno.test('parseJsonRpcRequest accepts numeric id', () => {
  const result = parseJsonRpcRequest({ jsonrpc: '2.0', id: 42, method: 'ping' });
  if (!result.ok) throw new Error('expected ok');
  assertEquals(result.request.id, 42);
});

Deno.test('buildSuccess produces JSON-RPC success envelope', () => {
  const env = buildSuccess('req-1', { hello: 'world' });
  assertEquals(env.jsonrpc, '2.0');
  assertEquals(env.id, 'req-1');
  assertEquals(env.result, { hello: 'world' });
});

Deno.test('buildError produces JSON-RPC error envelope without data', () => {
  const env = buildError(7, JSON_RPC_PARSE_ERROR, 'parse_error');
  assertEquals(env.jsonrpc, '2.0');
  assertEquals(env.id, 7);
  assertEquals(env.error.code, JSON_RPC_PARSE_ERROR);
  assertEquals(env.error.message, 'parse_error');
  assertEquals(env.error.data, undefined);
});

Deno.test('buildError includes data when provided', () => {
  const env = buildError(null, JSON_RPC_INVALID_REQUEST, 'bad', { reason: 'x' });
  assertEquals(env.error.data, { reason: 'x' });
});
