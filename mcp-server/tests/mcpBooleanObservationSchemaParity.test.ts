/**
 * MCP-SERVER-002 — MCP-021A schema constants parity test.
 *
 * The server-side `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts`
 * mirrors a STRUCTURAL subset of MCP-021A's wire schema in
 * `src/features/nodeLabels/mcpBooleanObservationSchema.ts`. The server is
 * a separately-deployable artifact (Deno Deploy); cross-tree imports do
 * not work in that target. This test reads BOTH files as source text and
 * asserts the load-bearing constants + failure reasons are present in both.
 *
 * Drift on:
 *   - schemaVersion constant literal
 *   - MAX_EVIDENCE_SPAN_CHARS value (240)
 *   - MAX_FLAGS_PER_RESPONSE value (20)
 *   - 6 failure-reason enum values
 *
 * ...fails the build and forces a coordinated bump.
 */
import {
  MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
  MAX_EVIDENCE_SPAN_CHARS,
  MAX_FLAGS_PER_RESPONSE,
} from '../lib/mcpBooleanObservationSchemaMirror.ts';

const UPSTREAM_SCHEMA_PATH = new URL(
  '../../src/features/nodeLabels/mcpBooleanObservationSchema.ts',
  import.meta.url,
);

const FAILURE_REASONS = [
  'not_json',
  'wrong_schema_version',
  'wrong_shape',
  'missing_required_field',
  'flag_count_too_high',
  'duplicate_node_id',
] as const;

Deno.test('schemaParity: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION literal appears in upstream', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_SCHEMA_PATH);
  if (!upstream.includes(`'${MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION}'`)) {
    throw new Error(
      `Upstream missing schemaVersion literal '${MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION}' — drift detected`,
    );
  }
});

Deno.test('schemaParity: MAX_EVIDENCE_SPAN_CHARS = 240 in upstream', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_SCHEMA_PATH);
  if (!upstream.includes(`MAX_EVIDENCE_SPAN_CHARS = ${MAX_EVIDENCE_SPAN_CHARS}`)) {
    throw new Error(
      `Upstream MAX_EVIDENCE_SPAN_CHARS does not equal ${MAX_EVIDENCE_SPAN_CHARS} — drift detected`,
    );
  }
});

Deno.test('schemaParity: MAX_FLAGS_PER_RESPONSE = 20 in upstream', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_SCHEMA_PATH);
  if (!upstream.includes(`MAX_FLAGS_PER_RESPONSE = ${MAX_FLAGS_PER_RESPONSE}`)) {
    throw new Error(
      `Upstream MAX_FLAGS_PER_RESPONSE does not equal ${MAX_FLAGS_PER_RESPONSE} — drift detected`,
    );
  }
});

Deno.test('schemaParity: all 6 failure-reason enum values appear in upstream', async () => {
  const upstream = await Deno.readTextFile(UPSTREAM_SCHEMA_PATH);
  for (const reason of FAILURE_REASONS) {
    if (!upstream.includes(`'${reason}'`)) {
      throw new Error(
        `Upstream missing failure-reason literal '${reason}' — McpBooleanObservationParseFailureReason drift`,
      );
    }
  }
});

Deno.test('schemaParity: ensures upstream has the same constants the server-side mirror exposes', async () => {
  // Sanity belt-and-braces: ALL constants combined.
  const upstream = await Deno.readTextFile(UPSTREAM_SCHEMA_PATH);
  const requiredLiterals = [
    `'${MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION}'`,
    `MAX_EVIDENCE_SPAN_CHARS = ${MAX_EVIDENCE_SPAN_CHARS}`,
    `MAX_FLAGS_PER_RESPONSE = ${MAX_FLAGS_PER_RESPONSE}`,
    ...FAILURE_REASONS.map((r) => `'${r}'`),
  ];
  for (const literal of requiredLiterals) {
    if (!upstream.includes(literal)) {
      throw new Error(`Upstream MCP-021A schema missing required literal: ${literal}`);
    }
  }
});
