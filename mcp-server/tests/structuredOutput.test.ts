import { assertEquals } from 'std/assert/mod.ts';
import { handleClassifySemanticMove } from '../tools/classifySemanticMove.ts';

const VALID_ARGS = {
  moveBodyRedacted: '[fixture] x',
  parentBodyRedacted: '[fixture] y',
  roomContext: { side: 'affirmative' as const, actorRole: 'primary_opponent' as const },
  requestedClassifiers: ['responds_to_parent'],
  contentHash: 'h',
  roomId: 'r',
};

Deno.test('successful tool call returns BOTH content[text] and structuredContent (Decision 12)', async () => {
  const prev = Deno.env.get('MCP_SERVER_USE_FIXTURE_PROVIDER');
  Deno.env.set('MCP_SERVER_USE_FIXTURE_PROVIDER', 'true');
  try {
    const result = await handleClassifySemanticMove({
      toolName: 'classify_semantic_move',
      rawArgs: VALID_ARGS,
      requestId: 'r-1',
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, false);
    // Both surfaces present:
    assertEquals(result.content.length, 1);
    assertEquals(result.content[0].type, 'text');
    if (typeof result.content[0].text !== 'string' || result.content[0].text.length === 0) {
      throw new Error('content[0].text must be non-empty string');
    }
    if (result.structuredContent === null || typeof result.structuredContent !== 'object') {
      throw new Error('structuredContent must be an object');
    }
    // The text is the JSON serialization of the structured content.
    const parsed = JSON.parse(result.content[0].text);
    assertEquals(parsed, result.structuredContent);
  } finally {
    if (prev === undefined) Deno.env.delete('MCP_SERVER_USE_FIXTURE_PROVIDER');
    else Deno.env.set('MCP_SERVER_USE_FIXTURE_PROVIDER', prev);
  }
});

Deno.test('error tool call returns structuredContent.reason (typed) AND a content[text] message', async () => {
  const result = await handleClassifySemanticMove({
    toolName: 'classify_semantic_move',
    rawArgs: {},
    requestId: 'r-2',
    envelope: 'jsonRpc',
  });
  assertEquals(result.isError, true);
  assertEquals(result.content.length, 1);
  assertEquals(result.content[0].type, 'text');
  const sc = result.structuredContent as { reason: string };
  if (typeof sc.reason !== 'string' || sc.reason.length === 0) {
    throw new Error('structuredContent.reason must be a non-empty string');
  }
});
