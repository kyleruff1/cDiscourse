import { assertEquals } from 'std/assert/mod.ts';
import { buildToolsListResult, REGISTERED_TOOLS } from '../lib/toolRegistry.ts';

Deno.test('tools/list reports exactly the two MCP-SERVER-001 tools', () => {
  const result = buildToolsListResult();
  assertEquals(result.tools.length, 2);
});

Deno.test('tools/list includes classify_semantic_move with verbatim name', () => {
  const result = buildToolsListResult();
  const names = result.tools.map((t) => t.name);
  if (!names.includes('classify_semantic_move')) {
    throw new Error('classify_semantic_move missing from tools/list');
  }
});

Deno.test('tools/list includes classify_argument_boolean_observations with verbatim name', () => {
  const result = buildToolsListResult();
  const names = result.tools.map((t) => t.name);
  if (!names.includes('classify_argument_boolean_observations')) {
    throw new Error('classify_argument_boolean_observations missing from tools/list');
  }
});

Deno.test('every registered tool carries a title and description string', () => {
  for (const tool of REGISTERED_TOOLS) {
    if (typeof tool.title !== 'string' || tool.title.length === 0) {
      throw new Error(`tool ${tool.name} missing title`);
    }
    if (typeof tool.description !== 'string' || tool.description.length === 0) {
      throw new Error(`tool ${tool.name} missing description`);
    }
  }
});

Deno.test('every registered tool carries an inputSchema object', () => {
  for (const tool of REGISTERED_TOOLS) {
    if (typeof tool.inputSchema !== 'object' || tool.inputSchema === null) {
      throw new Error(`tool ${tool.name} missing inputSchema`);
    }
  }
});

Deno.test('tool descriptions do not contain verdict/person language', () => {
  const banned = [/winner/i, /loser/i, /correct\b/i, /\btruth\b/i, /verdict/i, /liar/i, /dishonest/i];
  for (const tool of REGISTERED_TOOLS) {
    const text = `${tool.title} ${tool.description}`;
    for (const re of banned) {
      if (re.test(text)) {
        throw new Error(`tool ${tool.name} description contains banned token matching ${re}`);
      }
    }
  }
});
