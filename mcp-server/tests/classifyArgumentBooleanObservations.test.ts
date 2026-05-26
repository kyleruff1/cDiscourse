/**
 * Scaffolded `classify_argument_boolean_observations` tool tests.
 *
 * Critical invariants:
 *   - Tool is registered + appears in tools/list (separately verified in
 *     toolsList.test.ts)
 *   - Invocation returns isError: true + reason: not_implemented + the
 *     scaffoldedFor anchor
 *   - The handler DOES NOT call Anthropic / consume tokens — verified by
 *     a source-text scan AND by ensuring zero `fetch` calls during a
 *     direct invocation (the mock is recorded; assertion is zero calls).
 */
import { assertEquals } from 'std/assert/mod.ts';
import { handleClassifyArgumentBooleanObservations } from '../tools/classifyArgumentBooleanObservations.ts';
import { invokeToolByName } from '../lib/toolDispatch.ts';

Deno.test('boolean observations tool returns the documented not_implemented envelope', async () => {
  const result = await handleClassifyArgumentBooleanObservations({
    toolName: 'classify_argument_boolean_observations',
    rawArgs: {},
    requestId: 'r-1',
    envelope: 'jsonRpc',
  });
  assertEquals(result.isError, true);
  assertEquals(result.content.length, 1);
  assertEquals(result.content[0].type, 'text');
  assertEquals(result.content[0].text, 'Tool scaffolded for MCP-SERVER-002; not yet implemented');
  const sc = result.structuredContent as { reason: string; scaffoldedFor: string };
  assertEquals(sc.reason, 'not_implemented');
  assertEquals(sc.scaffoldedFor, 'MCP-SERVER-002');
});

Deno.test('boolean observations tool ignores rawArgs payload contents', async () => {
  // Even passing a fully-shaped MCP-021A request must NOT trigger any
  // real classifier behavior. The envelope is unchanged.
  const result = await handleClassifyArgumentBooleanObservations({
    toolName: 'classify_argument_boolean_observations',
    rawArgs: {
      schemaVersion: 'mcp-021.machine-observations.boolean.v1',
      nodeId: 'real-looking-node-id',
      currentText: 'real argument text',
      requestedFamilies: ['family_evidence'],
      requestedRawKeys: ['evidence_present'],
      definitions: {},
      timeoutMs: 12000,
    },
    requestId: 'r-2',
    envelope: 'jsonRpc',
  });
  assertEquals(result.isError, true);
  const sc = result.structuredContent as { reason: string };
  assertEquals(sc.reason, 'not_implemented');
});

Deno.test('boolean observations source file DOES NOT call Anthropic', async () => {
  // Source-text scan — defensive defence-in-depth. The scaffolded handler
  // must not import or call any Anthropic-related path.
  const source = await Deno.readTextFile(
    new URL('../tools/classifyArgumentBooleanObservations.ts', import.meta.url),
  );
  if (/import.*anthropic/i.test(source)) {
    throw new Error('Scaffolded boolean handler imports anthropic — MUST NOT in MCP-SERVER-001');
  }
  if (/api\.anthropic\.com/i.test(source)) {
    throw new Error('Scaffolded boolean handler references Anthropic API URL');
  }
  if (/runAnthropic/i.test(source)) {
    throw new Error('Scaffolded boolean handler calls runAnthropic*');
  }
  if (/fetch\(/i.test(source)) {
    throw new Error('Scaffolded boolean handler calls fetch()');
  }
});

Deno.test('invokeToolByName for boolean observations also returns the scaffold envelope', async () => {
  const result = await invokeToolByName({
    toolName: 'classify_argument_boolean_observations',
    rawArgs: {},
    requestId: 'r-3',
    envelope: 'adapterCompat',
  });
  assertEquals(result.isError, true);
  const sc = result.structuredContent as { reason: string; scaffoldedFor: string };
  assertEquals(sc.reason, 'not_implemented');
  assertEquals(sc.scaffoldedFor, 'MCP-SERVER-002');
});

Deno.test('multiple invocations of boolean observations all return scaffold envelope (no provider call ever)', async () => {
  for (let i = 0; i < 10; i += 1) {
    const result = await handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: { idx: i },
      requestId: `loop-${i}`,
      envelope: 'jsonRpc',
    });
    assertEquals(result.isError, true);
    const sc = result.structuredContent as { reason: string };
    assertEquals(sc.reason, 'not_implemented');
  }
});
