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

// ── R3 (OPS-MCP-PROVIDER-RELIABILITY-ARGUMENT-SCHEME-ERROR-RCA) ────────
// Source-scan invariants for the unified tool-error log emission added by
// R3. Verifies the emitter exists, uses an allowlisted field set, and
// never spreads the raw `extra` blob into log output.

Deno.test('R3: boolean tool source declares the unified emitToolErrorLog helper', async () => {
  const source = await Deno.readTextFile(TOOL_SOURCE_URL);
  if (!/function\s+emitToolErrorLog\b/.test(source)) {
    throw new Error('Boolean tool source missing emitToolErrorLog helper');
  }
  if (!/'boolean_observation_tool_error'/.test(source)) {
    throw new Error('Boolean tool source does not emit boolean_observation_tool_error event name');
  }
});

Deno.test('R3: emitToolErrorLog body does NOT spread the extra blob or detail field', async () => {
  const source = await Deno.readTextFile(TOOL_SOURCE_URL);
  // Locate the emitter and verify its body uses an allowlisted shape only.
  const match = source.match(
    /function\s+emitToolErrorLog[\s\S]*?log\('warn',\s*'boolean_observation_tool_error'[\s\S]*?\}\s*\)\s*;/,
  );
  if (!match) {
    throw new Error('Could not locate emitToolErrorLog log() call in source');
  }
  const emitterBody = match[0];
  if (/\.\.\.extra/.test(emitterBody)) {
    throw new Error('emitToolErrorLog spreads `...extra` — extra may carry detail/payload text');
  }
  if (/\bdetail\b/.test(emitterBody)) {
    throw new Error('emitToolErrorLog references `detail` — detail may carry unsanitized text');
  }
  if (/\bcurrentText\b|\bparentText\b|\bthreadContextExcerpt\b/.test(emitterBody)) {
    throw new Error('emitToolErrorLog references body text fields');
  }
  if (/\bobservations\b|\bconfidence\b|\bevidenceSpan\b/.test(emitterBody)) {
    throw new Error('emitToolErrorLog references response payload fields');
  }
  if (/\brawArgs\b|\brawResponse\b|\brawPrompt\b/.test(emitterBody)) {
    throw new Error('emitToolErrorLog references raw request/response/prompt');
  }
  if (/Authorization|x-api-key|ANTHROPIC_API_KEY/i.test(emitterBody)) {
    throw new Error('emitToolErrorLog references authorization / API key');
  }
});

Deno.test('R3: errorResult signature carries optional logContext parameter', async () => {
  const source = await Deno.readTextFile(TOOL_SOURCE_URL);
  // Match across newlines so the multi-line signature is captured.
  if (
    !/function\s+errorResult\([^)]*logContext\?\s*:\s*BooleanObservationToolErrorLogContext/s.test(
      source,
    )
  ) {
    throw new Error('errorResult signature missing logContext?: BooleanObservationToolErrorLogContext');
  }
});

Deno.test('R3: boolean tool source does NOT add new provider call paths or routing-flag reads', async () => {
  const source = await Deno.readTextFile(TOOL_SOURCE_URL);
  // The pre-existing single routing-flag read at MCP_SERVER_USE_FIXTURE_PROVIDER
  // is the only Deno.env.get call permitted in this handler.
  const envReads = source.match(/Deno\.env\.get\(/g) ?? [];
  if (envReads.length !== 1) {
    throw new Error(
      `Boolean tool source has ${envReads.length} Deno.env.get(...) calls; expected exactly 1 (MCP_SERVER_USE_FIXTURE_PROVIDER)`,
    );
  }
  if (!/Deno\.env\.get\('MCP_SERVER_USE_FIXTURE_PROVIDER'\)/.test(source)) {
    throw new Error('Boolean tool source missing the MCP_SERVER_USE_FIXTURE_PROVIDER env read');
  }
  if (/CLASSIFIER_QUEUE_ROUTING_ENABLED|CLASSIFIER_QUEUE_ROUTING_PERCENTAGE/.test(source)) {
    throw new Error('Boolean tool source references a cutover routing flag — out of scope');
  }
  // No new fetch() calls — R3 is a log-only change.
  const fetchCalls = source.match(/\bfetch\(/g) ?? [];
  if (fetchCalls.length !== 0) {
    throw new Error(`Boolean tool source has ${fetchCalls.length} fetch() calls; expected 0`);
  }
});
