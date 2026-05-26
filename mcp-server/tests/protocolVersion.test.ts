import { assertEquals } from 'std/assert/mod.ts';
import {
  MCP_TARGETED_PROTOCOL_VERSION,
  evaluateProtocolVersion,
} from '../lib/protocolVersion.ts';

Deno.test('targeted version is 2025-11-25', () => {
  assertEquals(MCP_TARGETED_PROTOCOL_VERSION, '2025-11-25');
});

Deno.test('evaluateProtocolVersion echoes target when client header absent', () => {
  const r = evaluateProtocolVersion(null);
  assertEquals(r.echoVersion, MCP_TARGETED_PROTOCOL_VERSION);
  assertEquals(r.warn, false);
});

Deno.test('evaluateProtocolVersion no-warn for same version', () => {
  const r = evaluateProtocolVersion('2025-11-25');
  assertEquals(r.warn, false);
});

Deno.test('evaluateProtocolVersion warns on older known version', () => {
  const r = evaluateProtocolVersion('2025-06-18');
  assertEquals(r.warn, true);
  assertEquals(r.warnReason, 'older_known_version');
  assertEquals(r.echoVersion, MCP_TARGETED_PROTOCOL_VERSION);
});

Deno.test('evaluateProtocolVersion warns on unknown version', () => {
  const r = evaluateProtocolVersion('1999-01-01');
  assertEquals(r.warn, true);
  assertEquals(r.warnReason, 'unknown_version');
});

Deno.test('evaluateProtocolVersion empty string treated as absent', () => {
  const r = evaluateProtocolVersion('');
  assertEquals(r.warn, false);
});
