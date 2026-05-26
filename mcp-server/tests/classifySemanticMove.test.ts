import { assertEquals } from 'std/assert/mod.ts';
import { handleClassifySemanticMove } from '../tools/classifySemanticMove.ts';
import { invokeToolByName } from '../lib/toolDispatch.ts';

function buildValidArgs(): Record<string, unknown> {
  return {
    moveBodyRedacted: '[fixture] sample body',
    parentBodyRedacted: '[fixture] sample parent',
    roomContext: {
      debateMode: 'structured_dispute',
      side: 'affirmative',
      actorRole: 'primary_opponent',
    },
    requestedClassifiers: ['responds_to_parent'],
    contentHash: 'fixture-content-hash-mainline',
    roomId: 'fixture-room-mainline',
  };
}

Deno.test('classify_semantic_move uses fixture provider when env flag is on', async () => {
  const prev = Deno.env.get('MCP_SERVER_USE_FIXTURE_PROVIDER');
  Deno.env.set('MCP_SERVER_USE_FIXTURE_PROVIDER', 'true');
  try {
    const result = await handleClassifySemanticMove({
      toolName: 'classify_semantic_move',
      rawArgs: buildValidArgs(),
      requestId: 'r-fixture-1',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, false);
    const sc = result.structuredContent as { binaries: unknown[]; routeSuggestion: string };
    assertEquals(sc.routeSuggestion, 'mainline');
    if (!Array.isArray(sc.binaries) || sc.binaries.length !== 1) {
      throw new Error('expected one binary entry');
    }
  } finally {
    if (prev === undefined) Deno.env.delete('MCP_SERVER_USE_FIXTURE_PROVIDER');
    else Deno.env.set('MCP_SERVER_USE_FIXTURE_PROVIDER', prev);
  }
});

Deno.test('classify_semantic_move rejects non-object input', async () => {
  const result = await handleClassifySemanticMove({
    toolName: 'classify_semantic_move',
    rawArgs: 'not-an-object',
    requestId: 'r-bad-1',
    envelope: 'jsonRpc',
  });
  assertEquals(result.isError, true);
  const sc = result.structuredContent as { reason: string };
  assertEquals(sc.reason, 'invalid_params');
});

Deno.test('classify_semantic_move rejects missing required fields', async () => {
  const result = await handleClassifySemanticMove({
    toolName: 'classify_semantic_move',
    rawArgs: { moveBodyRedacted: 'x' },
    requestId: 'r-bad-2',
    envelope: 'jsonRpc',
  });
  assertEquals(result.isError, true);
  const sc = result.structuredContent as { reason: string };
  assertEquals(sc.reason, 'invalid_params');
});

Deno.test('classify_semantic_move surfaces tool-result content[text] AND structuredContent', async () => {
  const prev = Deno.env.get('MCP_SERVER_USE_FIXTURE_PROVIDER');
  Deno.env.set('MCP_SERVER_USE_FIXTURE_PROVIDER', 'true');
  try {
    const result = await handleClassifySemanticMove({
      toolName: 'classify_semantic_move',
      rawArgs: buildValidArgs(),
      requestId: 'r-fixture-2',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, false);
    assertEquals(result.content.length, 1);
    assertEquals(result.content[0].type, 'text');
    const parsedFromText = JSON.parse(result.content[0].text);
    assertEquals(parsedFromText, result.structuredContent);
  } finally {
    if (prev === undefined) Deno.env.delete('MCP_SERVER_USE_FIXTURE_PROVIDER');
    else Deno.env.set('MCP_SERVER_USE_FIXTURE_PROVIDER', prev);
  }
});

Deno.test('classify_semantic_move via dispatch returns the same packet', async () => {
  const prev = Deno.env.get('MCP_SERVER_USE_FIXTURE_PROVIDER');
  Deno.env.set('MCP_SERVER_USE_FIXTURE_PROVIDER', 'true');
  try {
    const result = await invokeToolByName({
      toolName: 'classify_semantic_move',
      rawArgs: buildValidArgs(),
      requestId: 'r-dispatch-1',
      envelope: 'adapterCompat',
    });
    assertEquals(result.isError, false);
  } finally {
    if (prev === undefined) Deno.env.delete('MCP_SERVER_USE_FIXTURE_PROVIDER');
    else Deno.env.set('MCP_SERVER_USE_FIXTURE_PROVIDER', prev);
  }
});

Deno.test('classify_semantic_move surfaces key_missing when neither fixture nor key is set', async () => {
  const prevFlag = Deno.env.get('MCP_SERVER_USE_FIXTURE_PROVIDER');
  const prevKey = Deno.env.get('ANTHROPIC_API_KEY');
  Deno.env.delete('MCP_SERVER_USE_FIXTURE_PROVIDER');
  Deno.env.delete('ANTHROPIC_API_KEY');
  try {
    const result = await handleClassifySemanticMove({
      toolName: 'classify_semantic_move',
      rawArgs: buildValidArgs(),
      requestId: 'r-no-key',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as { reason: string };
    assertEquals(sc.reason, 'key_missing');
  } finally {
    if (prevFlag !== undefined) Deno.env.set('MCP_SERVER_USE_FIXTURE_PROVIDER', prevFlag);
    if (prevKey !== undefined) Deno.env.set('ANTHROPIC_API_KEY', prevKey);
  }
});
