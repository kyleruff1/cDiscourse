// MCP-SERVER-002 — Phase 3 validator script.
// Reads a saved Family A response payload from disk and asserts MCP-021A
// schema compliance + Family A rawKey membership + doctrine ban-list.
//
// Usage:
//   deno run --allow-read mcp-server/scripts/validate-family-a-response.ts <path-to-response.json>
//
// Exit codes:
//   0 — all checks pass; prints "VALIDATE_FAMILY_A_RESPONSE: PASS"
//   1 — validation failure (specific failure printed to stderr)
//   2 — file load failure / argument error
//
// The script accepts either:
//   - A raw McpBooleanObservationResponse object as the file root
//   - A JSON-RPC tools/call result wrapping it (with .result.structuredContent)
//   - An adapter-compat result wrapping it (with .result.structuredContent)
//
// Doctrine:
//   - cdiscourse-doctrine §1 — banned tokens in evidenceSpans fail the scan
//   - cdiscourse-doctrine §10a — observations are structural; provider='mcp'

import { FAMILY_A_RAW_KEYS } from '../lib/familyAKeys.ts';
import { DOCTRINE_BAN_PATTERNS } from '../lib/doctrineBanList.ts';
import {
  validateMcpBooleanObservationResponse,
  MAX_EVIDENCE_SPAN_CHARS,
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
} from '../lib/mcpBooleanObservationSchemaMirror.ts';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

function fail(message: string): never {
  console.error(`VALIDATE_FAMILY_A_RESPONSE: FAIL — ${message}`);
  Deno.exit(1);
}

function loadFail(message: string): never {
  console.error(`VALIDATE_FAMILY_A_RESPONSE: LOAD_FAIL — ${message}`);
  Deno.exit(2);
}

const path = Deno.args[0];
if (!path) {
  console.error('Usage: validate-family-a-response.ts <path-to-response.json>');
  Deno.exit(2);
}

let raw: string;
try {
  raw = await Deno.readTextFile(path);
} catch (err) {
  loadFail(`Failed to read ${path}: ${err instanceof Error ? err.message : 'unknown'}`);
}

let parsed: unknown;
try {
  parsed = JSON.parse(raw);
} catch (err) {
  loadFail(`Failed to parse JSON: ${err instanceof Error ? err.message : 'unknown'}`);
}

// Unwrap the response from common transport envelopes:
//  - JSON-RPC: { result: { content: [...], structuredContent: {...} } }
//  - adapter-compat: { result: { content: [...], structuredContent: {...} } }
//  - bare structuredContent: { schemaVersion: ..., observations: ... }
function unwrapResponse(candidate: unknown): unknown {
  if (!isPlainObject(candidate)) return candidate;
  if ('schemaVersion' in candidate && candidate['schemaVersion'] === MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION) {
    return candidate;
  }
  if (isPlainObject(candidate['result'])) {
    const result = candidate['result'];
    if (isPlainObject(result['structuredContent'])) {
      return result['structuredContent'];
    }
    if ('schemaVersion' in result && result['schemaVersion'] === MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION) {
      return result;
    }
  }
  if (isPlainObject(candidate['structuredContent'])) {
    return candidate['structuredContent'];
  }
  return candidate;
}

const response = unwrapResponse(parsed);

// Step 1: schema validation.
const validation = validateMcpBooleanObservationResponse(response);
if (!validation.ok) {
  fail(`schema validation failed at ${validation.path}: ${validation.detail}`);
}
const validated = validation.value;

// Step 2: rawKey membership in Family A 16 keys.
for (const rawKey of validated.checkedRawKeys) {
  if (!FAMILY_A_RAW_KEYS.includes(rawKey)) {
    fail(`checkedRawKeys contains rawKey "${rawKey}" outside Family A 16-key set`);
  }
}

// Step 3: evidenceSpan length cap.
for (const [rawKey, span] of Object.entries(validated.evidenceSpan)) {
  if (typeof span === 'string' && span.length > MAX_EVIDENCE_SPAN_CHARS) {
    fail(`evidenceSpan.${rawKey} length ${span.length} > MAX_EVIDENCE_SPAN_CHARS ${MAX_EVIDENCE_SPAN_CHARS}`);
  }
}

// Step 4: doctrine ban-list scan over evidenceSpans + modelInfo strings.
for (const [rawKey, span] of Object.entries(validated.evidenceSpan)) {
  if (typeof span !== 'string') continue;
  for (const pattern of DOCTRINE_BAN_PATTERNS) {
    if (pattern.test(span)) {
      fail(`evidenceSpan.${rawKey} contains banned token matching ${pattern}`);
    }
  }
}
for (const pattern of DOCTRINE_BAN_PATTERNS) {
  if (pattern.test(validated.modelInfo.serverName)) {
    fail(`modelInfo.serverName contains banned token matching ${pattern}`);
  }
  if (pattern.test(validated.modelInfo.classifierSetVersion)) {
    fail(`modelInfo.classifierSetVersion contains banned token matching ${pattern}`);
  }
}

console.log('VALIDATE_FAMILY_A_RESPONSE: PASS');
Deno.exit(0);
