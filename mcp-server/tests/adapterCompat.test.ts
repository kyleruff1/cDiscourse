import { assertEquals } from 'std/assert/mod.ts';
import { invokeToolByName } from '../lib/toolDispatch.ts';

Deno.test('invokeToolByName returns documented error for unknown tools', async () => {
  const result = await invokeToolByName({
    toolName: 'tool_that_does_not_exist',
    rawArgs: {},
    requestId: 'r1',
    envelope: 'adapterCompat',
  });
  assertEquals(result.isError, true);
  const sc = result.structuredContent as { reason: string };
  assertEquals(sc.reason, 'unknown_tool');
});

Deno.test('invokeToolByName accepts the verbatim semantic-referee name', async () => {
  // Commit 2 placeholder handler returns isError: true; commit 3 implements the
  // real path. The contract here: the dispatch DOES NOT fail on the name itself.
  const result = await invokeToolByName({
    toolName: 'classify_semantic_move',
    rawArgs: {},
    requestId: 'r2',
    envelope: 'adapterCompat',
  });
  // We get either a real packet (commit 3+) or a not_wired placeholder. In
  // both cases the structuredContent.reason is NOT "unknown_tool".
  const sc = result.structuredContent as { reason?: string };
  if (sc.reason === 'unknown_tool') {
    throw new Error('classify_semantic_move dispatch returned unknown_tool');
  }
});

Deno.test('invokeToolByName accepts the verbatim boolean-observations name', async () => {
  // MCP-SERVER-002 promoted this tool from scaffold to real. With empty
  // rawArgs the real validator rejects with invalid_params (not_implemented
  // is gone). The dispatch contract: the dispatch DOES NOT fail on the name
  // itself; the validator does.
  const result = await invokeToolByName({
    toolName: 'classify_argument_boolean_observations',
    rawArgs: {},
    requestId: 'r3',
    envelope: 'jsonRpc',
  });
  assertEquals(result.isError, true);
  const sc = result.structuredContent as { reason?: string };
  if (sc.reason === 'unknown_tool') {
    throw new Error('classify_argument_boolean_observations dispatch returned unknown_tool');
  }
  assertEquals(sc.reason, 'invalid_params');
});
