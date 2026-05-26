/**
 * MCP-SERVER-002 — Source-text scan for the boolean tool handler.
 *
 * REPLACES the MCP-SERVER-001 scan that asserted the scaffold did NOT call
 * Anthropic. The new scan asserts:
 *   - The real tool DOES route through the shared `callAnthropic` helper
 *     (via familyAAnthropic.ts)
 *   - The source file does NOT import from `src/features/...` (Outcome 3
 *     boundary — the server is a separately-deployable artifact)
 *   - The source file does NOT contain raw secret literals
 *   - No console.log of Authorization / API key / response body
 */
import { assertEquals } from 'std/assert/mod.ts';

const TOOL_SOURCE_URL = new URL('../tools/classifyArgumentBooleanObservations.ts', import.meta.url);
const FAMILY_A_ANTHROPIC_SOURCE_URL = new URL('../lib/familyAAnthropic.ts', import.meta.url);
const ANTHROPIC_CALL_SOURCE_URL = new URL('../lib/anthropicCall.ts', import.meta.url);

Deno.test('boolean tool source: imports familyAAnthropic.ts (real classifier path)', async () => {
  const source = await Deno.readTextFile(TOOL_SOURCE_URL);
  if (!/from\s+['"].*familyAAnthropic\.ts['"]/.test(source)) {
    throw new Error('Boolean tool source does not import familyAAnthropic.ts');
  }
  if (!/runAnthropicFamilyAClassifier/.test(source)) {
    throw new Error('Boolean tool source does not call runAnthropicFamilyAClassifier');
  }
});

Deno.test('familyAAnthropic source: routes through shared callAnthropic helper', async () => {
  const source = await Deno.readTextFile(FAMILY_A_ANTHROPIC_SOURCE_URL);
  if (!/from\s+['"].*anthropicCall\.ts['"]/.test(source)) {
    throw new Error('familyAAnthropic.ts does not import anthropicCall.ts');
  }
  if (!/callAnthropic\(/.test(source)) {
    throw new Error('familyAAnthropic.ts does not invoke callAnthropic()');
  }
});

Deno.test('anthropicCall source: makes the single fetch to api.anthropic.com', async () => {
  const source = await Deno.readTextFile(ANTHROPIC_CALL_SOURCE_URL);
  if (!/api\.anthropic\.com\/v1\/messages/.test(source)) {
    throw new Error('anthropicCall.ts does not target api.anthropic.com/v1/messages');
  }
});

Deno.test('boolean tool source: does NOT import from src/features/* (Outcome 3 boundary)', async () => {
  const source = await Deno.readTextFile(TOOL_SOURCE_URL);
  if (/from\s+['"][^'"]*src\/features\//.test(source)) {
    throw new Error('Boolean tool source imports from src/features/ — cross-tree boundary violation');
  }
});

Deno.test('familyAAnthropic source: does NOT import from src/features/* (Outcome 3 boundary)', async () => {
  const source = await Deno.readTextFile(FAMILY_A_ANTHROPIC_SOURCE_URL);
  if (/from\s+['"][^'"]*src\/features\//.test(source)) {
    throw new Error('familyAAnthropic.ts imports from src/features/');
  }
});

Deno.test('boolean tool source: does NOT contain raw secret literals', async () => {
  const source = await Deno.readTextFile(TOOL_SOURCE_URL);
  // The source mentions ANTHROPIC_API_KEY only as a Deno.env.get target inside
  // anthropicCall.ts — NOT in the tool handler itself. Sanitize-check the
  // tool source.
  if (/sk-ant-[a-z0-9-]+/i.test(source)) {
    throw new Error('Boolean tool source contains a raw Anthropic key literal');
  }
  if (/Bearer [a-z0-9.-]+/i.test(source)) {
    throw new Error('Boolean tool source contains a raw Bearer literal');
  }
});

Deno.test('boolean tool source: no console.log calls (uses structured log())', async () => {
  const source = await Deno.readTextFile(TOOL_SOURCE_URL);
  if (/console\.(log|warn|error|info)\(/.test(source)) {
    throw new Error('Boolean tool source contains console.* call — must use structured log()');
  }
});

Deno.test('boolean tool source: no Authorization / x-api-key / ANTHROPIC_API_KEY in log shapes', async () => {
  const source = await Deno.readTextFile(TOOL_SOURCE_URL);
  // The handler shouldn't read the API key at all — that's anthropicCall's job.
  if (/console\.log[^\n]*Authorization/i.test(source)) {
    throw new Error('Boolean tool source console.logs Authorization');
  }
  if (/console\.log[^\n]*x-api-key/i.test(source)) {
    throw new Error('Boolean tool source console.logs x-api-key');
  }
  if (/console\.log[^\n]*ANTHROPIC_API_KEY/i.test(source)) {
    throw new Error('Boolean tool source console.logs ANTHROPIC_API_KEY');
  }
});

Deno.test('boolean tool source: does NOT contain scaffold language', async () => {
  const source = await Deno.readTextFile(TOOL_SOURCE_URL);
  if (/not_implemented/.test(source)) {
    throw new Error('Boolean tool source still contains "not_implemented" — scaffold language not cleaned up');
  }
  if (/scaffolded for MCP-SERVER-002/i.test(source)) {
    throw new Error('Boolean tool source still contains scaffold-marker language');
  }
});

Deno.test('boolean tool source: declares the REAL handler name (handleClassifyArgumentBooleanObservations)', async () => {
  const source = await Deno.readTextFile(TOOL_SOURCE_URL);
  if (!/export\s+(?:async\s+)?function\s+handleClassifyArgumentBooleanObservations/.test(source)) {
    throw new Error('Boolean tool source missing handleClassifyArgumentBooleanObservations export');
  }
});
