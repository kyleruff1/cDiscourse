import { assertEquals } from 'std/assert/mod.ts';
import { buildInitializeResult, buildToolsListResult } from '../lib/toolRegistry.ts';
import { SERVER_VERSION } from '../routes/health.ts';

Deno.test('buildInitializeResult returns the documented MCP handshake shape', () => {
  const result = buildInitializeResult('2025-11-25');
  assertEquals(result.protocolVersion, '2025-11-25');
  assertEquals(result.capabilities.tools.listChanged, false);
  assertEquals(result.serverInfo.name, 'cdiscourse-mcp-server');
  assertEquals(result.serverInfo.version, SERVER_VERSION);
});

Deno.test('buildInitializeResult echoes the caller-supplied version (forward-compat)', () => {
  const result = buildInitializeResult('2099-01-01');
  assertEquals(result.protocolVersion, '2099-01-01');
});
