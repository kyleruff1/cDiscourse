/**
 * OPS-MCP-PROVIDER-RELIABILITY-ARGUMENT-SCHEME-ERROR-RCA-R3 — structured
 * isError logging tests.
 *
 * Verifies that every isError code path emits a single
 * `boolean_observation_tool_error` log line carrying ONLY allowlisted
 * structural fields (reason / family / requestId / mode / schemaVersion /
 * classifierSetVersion / serverName / path / tool / status / level / event /
 * ts). No body / prompt / response payload / authorization / secret /
 * evidenceSpan text is ever emitted.
 *
 * The unified emission supports the next queue-load-smoke retry: when the
 * drainer's persisted `failure_sub_reason=provider_server_error` collapses
 * the four MCP {isError} causes into one bucket, this log stream lets the
 * operator partition the bucket by inner reason without a DB schema change.
 *
 * The success path is asserted NOT to emit this event (existing per-site
 * logs are unchanged).
 *
 * Scope: log side-effect only. Error envelope shape (isError=true,
 * structuredContent.reason, content[].text) is unchanged.
 */
import { assertEquals, assert } from 'std/assert/mod.ts';
import { handleClassifyArgumentBooleanObservations } from '../tools/classifyArgumentBooleanObservations.ts';
import { _resetLogSinkForTesting, _setLogSinkForTesting } from '../lib/logging.ts';

const SCHEMA_VERSION = 'mcp-021.machine-observations.boolean.v1';
const ERROR_EVENT = 'boolean_observation_tool_error';

const ALLOWED_FIELD_KEYS: ReadonlySet<string> = new Set([
  // logger framing
  'ts',
  'level',
  'event',
  // emitted fields
  'tool',
  'reason',
  'family',
  'requestId',
  'mode',
  'schemaVersion',
  'classifierSetVersion',
  'serverName',
  'path',
  'status',
]);

const FORBIDDEN_FIELD_KEYS: readonly string[] = [
  'argumentBody',
  'moveBody',
  'parentBody',
  'roomBody',
  'currentText',
  'parentText',
  'threadContextExcerpt',
  'rawPrompt',
  'prompt',
  'promptText',
  'rawResponse',
  'responseText',
  'evidenceSpan',
  'observations',
  'confidence',
  'authorization',
  'authorizationHeader',
  'auth',
  'bearer',
  'bearerToken',
  'apiKey',
  'anthropicApiKey',
  'anthropicKey',
  'token',
];

const SECRET_SHAPE_PATTERNS: readonly RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]+/i,
  /\bsbp_[A-Za-z0-9_-]+/i,
  /\bsb_secret_[A-Za-z0-9_-]+/i,
  /\bBearer\s+[A-Za-z0-9._-]+/i,
  /\beyJ[A-Za-z0-9._-]{20,}/,
];

interface CapturedLine {
  raw: string;
  parsed: Record<string, unknown>;
}

function captureLogsAround<T>(fn: () => Promise<T>): Promise<{ result: T; lines: CapturedLine[] }> {
  const captured: CapturedLine[] = [];
  _setLogSinkForTesting((line) => {
    let parsed: Record<string, unknown> = {};
    try {
      const obj = JSON.parse(line);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        parsed = obj as Record<string, unknown>;
      }
    } catch {
      // ignore unparseable lines for the structural assertions; rawScan still runs
    }
    captured.push({ raw: line, parsed });
  });
  return fn()
    .then((result) => ({ result, lines: captured }))
    .finally(() => {
      _resetLogSinkForTesting();
    });
}

function toolErrorLines(lines: CapturedLine[]): CapturedLine[] {
  return lines.filter((l) => l.parsed.event === ERROR_EVENT);
}

function assertNoForbiddenFields(line: CapturedLine): void {
  for (const k of Object.keys(line.parsed)) {
    if (!ALLOWED_FIELD_KEYS.has(k)) {
      throw new Error(
        `boolean_observation_tool_error log line carries non-allowlisted key '${k}': ${line.raw}`,
      );
    }
  }
  for (const forbidden of FORBIDDEN_FIELD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(line.parsed, forbidden)) {
      throw new Error(
        `boolean_observation_tool_error log line carries forbidden key '${forbidden}': ${line.raw}`,
      );
    }
  }
}

function assertNoSecretShape(line: CapturedLine): void {
  for (const re of SECRET_SHAPE_PATTERNS) {
    if (re.test(line.raw)) {
      throw new Error(
        `boolean_observation_tool_error log line carries secret-shaped substring matching ${re}: ${line.raw}`,
      );
    }
  }
}

function assertCommonInvariants(line: CapturedLine, reason: string): void {
  assertEquals(line.parsed.event, ERROR_EVENT);
  assertEquals(line.parsed.tool, 'classify_argument_boolean_observations');
  assertEquals(line.parsed.reason, reason);
  assertEquals(line.parsed.status, 'failure');
  assertEquals(line.parsed.level, 'warn');
  assert(typeof line.parsed.ts === 'string' && line.parsed.ts.length > 0, 'ts present');
  assertNoForbiddenFields(line);
  assertNoSecretShape(line);
}

function validRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: SCHEMA_VERSION,
    nodeId: 'fixture-node-toolerror-001',
    parentNodeId: null,
    currentText: 'fixture body text',
    parentText: null,
    threadContextExcerpt: 'fixture thread context',
    requestedFamilies: ['parent_relation'],
    requestedRawKeys: ['supports_parent', 'challenges_parent'],
    definitions: {},
    timeoutMs: 12000,
    ...overrides,
  };
}

function withFixtureEnv<T>(fn: () => Promise<T>): Promise<T> {
  const prev = Deno.env.get('MCP_SERVER_USE_FIXTURE_PROVIDER');
  Deno.env.set('MCP_SERVER_USE_FIXTURE_PROVIDER', 'true');
  return fn().finally(() => {
    if (prev === undefined) Deno.env.delete('MCP_SERVER_USE_FIXTURE_PROVIDER');
    else Deno.env.set('MCP_SERVER_USE_FIXTURE_PROVIDER', prev);
  });
}

// ── invalid_params: args not a JSON object ────────────────────────────

Deno.test('boolean_observation_tool_error fires with reason=invalid_params when args is not a JSON object', async () => {
  const { result, lines } = await captureLogsAround(() =>
    handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: 'not-an-object' as unknown as Record<string, unknown>,
      requestId: 'r-toolerror-not-object',
      envelope: 'jsonRpc',
    }),
  );
  assertEquals(result.isError, true);
  const errLines = toolErrorLines(lines);
  assertEquals(errLines.length, 1, 'exactly one boolean_observation_tool_error per error');
  const line = errLines[0];
  assertCommonInvariants(line, 'invalid_params');
  assertEquals(line.parsed.requestId, 'r-toolerror-not-object');
  // No family / mode / schemaVersion known at this point.
  assertEquals(line.parsed.family, undefined);
  assertEquals(line.parsed.mode, undefined);
  assertEquals(line.parsed.schemaVersion, undefined);
});

// ── unsupported_family ────────────────────────────────────────────────

Deno.test('boolean_observation_tool_error fires with reason=unsupported_family', async () => {
  const { result, lines } = await captureLogsAround(() =>
    handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: validRequest({ requestedFamilies: ['not_a_real_family'] }),
      requestId: 'r-toolerror-unsup-family',
      envelope: 'jsonRpc',
    }),
  );
  assertEquals(result.isError, true);
  const errLines = toolErrorLines(lines);
  assertEquals(errLines.length, 1);
  const line = errLines[0];
  assertCommonInvariants(line, 'unsupported_family');
  assertEquals(line.parsed.requestId, 'r-toolerror-unsup-family');
});

// ── unsupported_rawKey ────────────────────────────────────────────────

Deno.test('boolean_observation_tool_error fires with reason=unsupported_rawKey', async () => {
  const { result, lines } = await captureLogsAround(() =>
    handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: validRequest({ requestedRawKeys: ['definitely_not_a_real_rawKey'] }),
      requestId: 'r-toolerror-unsup-rawkey',
      envelope: 'jsonRpc',
    }),
  );
  assertEquals(result.isError, true);
  const errLines = toolErrorLines(lines);
  assertEquals(errLines.length, 1);
  const line = errLines[0];
  assertCommonInvariants(line, 'unsupported_rawKey');
  assertEquals(line.parsed.requestId, 'r-toolerror-unsup-rawkey');
});

// ── invalid_params (schema validation) ────────────────────────────────

Deno.test('boolean_observation_tool_error fires with reason=invalid_params on schema validation failure', async () => {
  const { result, lines } = await captureLogsAround(() =>
    handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: validRequest({ schemaVersion: 'wrong-version' }),
      requestId: 'r-toolerror-bad-schema',
      envelope: 'jsonRpc',
    }),
  );
  assertEquals(result.isError, true);
  const errLines = toolErrorLines(lines);
  assertEquals(errLines.length, 1);
  const line = errLines[0];
  assertCommonInvariants(line, 'invalid_params');
  assertEquals(line.parsed.requestId, 'r-toolerror-bad-schema');
});

// ── success path: NO boolean_observation_tool_error ───────────────────

Deno.test('boolean_observation_tool_error does NOT fire on success path (fixture provider)', async () => {
  const { result, lines } = await withFixtureEnv(() =>
    captureLogsAround(() =>
      handleClassifyArgumentBooleanObservations({
        toolName: 'classify_argument_boolean_observations',
        rawArgs: validRequest(),
        requestId: 'r-success-no-tool-error',
        envelope: 'jsonRpc',
      }),
    ),
  );
  assertEquals(result.isError, false);
  const errLines = toolErrorLines(lines);
  assertEquals(errLines.length, 0, 'success path must NOT emit boolean_observation_tool_error');
});

// ── envelope backward-compat: isError shape unchanged ─────────────────

Deno.test('error envelope shape is unchanged: isError=true, structuredContent.reason set, content[].text non-empty', async () => {
  const { result } = await captureLogsAround(() =>
    handleClassifyArgumentBooleanObservations({
      toolName: 'classify_argument_boolean_observations',
      rawArgs: validRequest({ requestedFamilies: ['not_a_real_family'] }),
      requestId: 'r-envelope-shape',
      envelope: 'jsonRpc',
    }),
  );
  assertEquals(result.isError, true);
  const sc = result.structuredContent as Record<string, unknown>;
  assertEquals(sc.reason, 'unsupported_family');
  assertEquals(result.content.length, 1);
  assertEquals(result.content[0].type, 'text');
  assert(
    typeof result.content[0].text === 'string' && (result.content[0].text as string).length > 0,
    'content text non-empty',
  );
});

// ── secret/secret-shape leak guard across every emitted line in this suite ──

Deno.test('emitted boolean_observation_tool_error lines never carry forbidden keys or secret-shaped values across the error reason matrix', async () => {
  const reasons: Array<{ rawArgs: unknown; reqId: string }> = [
    { rawArgs: 'not-an-object', reqId: 'r-scan-1' },
    { rawArgs: validRequest({ requestedFamilies: ['not_a_real_family'] }), reqId: 'r-scan-2' },
    { rawArgs: validRequest({ requestedRawKeys: ['not_a_real_rawkey'] }), reqId: 'r-scan-3' },
    { rawArgs: validRequest({ schemaVersion: 'wrong-version' }), reqId: 'r-scan-4' },
    { rawArgs: validRequest({ timeoutMs: 99999 }), reqId: 'r-scan-5' },
  ];

  const aggregated: CapturedLine[] = [];
  for (const r of reasons) {
    const { lines } = await captureLogsAround(() =>
      handleClassifyArgumentBooleanObservations({
        toolName: 'classify_argument_boolean_observations',
        rawArgs: r.rawArgs as Record<string, unknown>,
        requestId: r.reqId,
        envelope: 'jsonRpc',
      }),
    );
    aggregated.push(...toolErrorLines(lines));
  }
  // We expect 5 lines total — one per error invocation.
  assertEquals(aggregated.length, 5);
  for (const line of aggregated) {
    assertNoForbiddenFields(line);
    assertNoSecretShape(line);
  }
});
