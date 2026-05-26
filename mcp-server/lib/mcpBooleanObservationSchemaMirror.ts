/**
 * MCP-SERVER-002 — Server-side mirror of MCP-021A's wire schema constants
 * and a structural-only validator.
 *
 * The server is a separately-deployable artifact (Deno Deploy); cross-tree
 * imports across src/ → mcp-server/ do not work in that target. This module
 * mirrors ONLY the bits the server needs to validate the model's RESPONSE:
 *
 *   - MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION constant
 *   - MAX_FLAGS_PER_RESPONSE = 20
 *   - MAX_EVIDENCE_SPAN_CHARS = 240
 *   - 6 failure-reason enum values
 *   - validateMcpBooleanObservationResponse(parsed) — STRUCTURAL validator
 *
 * The server validates STRUCTURAL shape only. rawKey-membership validation
 * (is the rawKey in the Family A 16-key set) lives in the tool handler
 * which imports FAMILY_A_RAW_KEYS from familyAKeys.ts. The upstream
 * sanitizer (with surface-aware confidence floors) runs on the Edge
 * Function side after the server returns.
 *
 * Parity with upstream is enforced by tests/mcpBooleanObservationSchemaParity.test.ts.
 *
 * Doctrine:
 *   - cdiscourse-doctrine §10a (Observations vs Allegations) — every key
 *     in the response is a MACHINE OBSERVATION (modelInfo.provider='mcp').
 *   - cdiscourse-doctrine §1 — the validator never blesses verdict-style
 *     fields; the doctrine ban-list scan runs separately on string content.
 */

/** The single binding schemaVersion. Verbatim mirror of upstream. */
export const MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION =
  'mcp-021.machine-observations.boolean.v1' as const;

/** Maximum observation entries per response. Verbatim mirror of upstream. */
export const MAX_FLAGS_PER_RESPONSE = 20;

/** Maximum evidenceSpan character length. Verbatim mirror of upstream. */
export const MAX_EVIDENCE_SPAN_CHARS = 240;

/** The 6 documented failure reasons. Verbatim mirror of upstream. */
export type McpBooleanObservationParseFailureReason =
  | 'not_json'
  | 'wrong_schema_version'
  | 'wrong_shape'
  | 'missing_required_field'
  | 'flag_count_too_high'
  | 'duplicate_node_id';

/** Successful validation result. */
export interface McpBooleanObservationValidatedResponse {
  readonly schemaVersion: typeof MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION;
  readonly nodeId: string;
  readonly checkedRawKeys: readonly string[];
  readonly observations: Readonly<Record<string, boolean>>;
  readonly confidence: Readonly<Record<string, 'low' | 'medium' | 'high'>>;
  readonly evidenceSpan: Readonly<Record<string, string | null>>;
  readonly modelInfo: {
    readonly provider: 'mcp';
    readonly serverName: string;
    readonly classifierSetVersion: string;
  };
}

export type McpBooleanObservationValidationResult =
  | { ok: true; value: McpBooleanObservationValidatedResponse }
  | { ok: false; path: string; detail: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

function isConfidenceBand(value: unknown): value is 'low' | 'medium' | 'high' {
  return value === 'low' || value === 'medium' || value === 'high';
}

/**
 * Validate a parsed boolean-observation response packet against the
 * MCP-021A wire shape. STRUCTURAL only — does NOT validate rawKey
 * membership (caller checks against FAMILY_A_RAW_KEYS).
 *
 * Failure modes:
 *   - missing required field (any of schemaVersion / nodeId /
 *     checkedRawKeys / observations / confidence / evidenceSpan / modelInfo)
 *   - schemaVersion mismatch
 *   - non-string nodeId or empty nodeId
 *   - checkedRawKeys not a string array
 *   - observations not a plain object or values not boolean
 *   - confidence not a plain object or values not in {low, medium, high}
 *   - evidenceSpan not a plain object or values not string|null
 *   - evidenceSpan value > MAX_EVIDENCE_SPAN_CHARS
 *   - flag count > MAX_FLAGS_PER_RESPONSE
 *   - observations / confidence / evidenceSpan key sets out of sync
 *   - modelInfo missing or malformed (provider != 'mcp')
 */
export function validateMcpBooleanObservationResponse(
  parsed: unknown,
): McpBooleanObservationValidationResult {
  if (!isPlainObject(parsed)) {
    return { ok: false, path: '$', detail: 'must be a plain object' };
  }

  // schemaVersion match
  if (parsed['schemaVersion'] !== MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION) {
    return {
      ok: false,
      path: 'schemaVersion',
      detail: `expected ${MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION}; got ${String(parsed['schemaVersion'])}`,
    };
  }

  // Required fields present
  const requiredFields = [
    'schemaVersion',
    'nodeId',
    'checkedRawKeys',
    'observations',
    'confidence',
    'evidenceSpan',
    'modelInfo',
  ] as const;
  for (const field of requiredFields) {
    if (!(field in parsed)) {
      return {
        ok: false,
        path: field,
        detail: `missing required field "${field}"`,
      };
    }
  }

  // nodeId non-empty string
  const nodeId = parsed['nodeId'];
  if (typeof nodeId !== 'string' || nodeId.length === 0) {
    return { ok: false, path: 'nodeId', detail: 'must be non-empty string' };
  }

  // checkedRawKeys string array
  const checkedRawKeys = parsed['checkedRawKeys'];
  if (!Array.isArray(checkedRawKeys)) {
    return { ok: false, path: 'checkedRawKeys', detail: 'must be array' };
  }
  for (let i = 0; i < checkedRawKeys.length; i += 1) {
    if (typeof checkedRawKeys[i] !== 'string') {
      return {
        ok: false,
        path: `checkedRawKeys[${i}]`,
        detail: 'must be string',
      };
    }
  }

  // observations: plain object, boolean values, count ≤ MAX_FLAGS_PER_RESPONSE
  const observations = parsed['observations'];
  if (!isPlainObject(observations)) {
    return { ok: false, path: 'observations', detail: 'must be plain object' };
  }
  const observationKeys = Object.keys(observations);
  if (observationKeys.length > MAX_FLAGS_PER_RESPONSE) {
    return {
      ok: false,
      path: 'observations',
      detail: `flag count ${observationKeys.length} exceeds max ${MAX_FLAGS_PER_RESPONSE}`,
    };
  }
  for (const key of observationKeys) {
    if (typeof observations[key] !== 'boolean') {
      return {
        ok: false,
        path: `observations.${key}`,
        detail: 'value must be boolean',
      };
    }
  }

  // confidence: plain object, low|medium|high values
  const confidence = parsed['confidence'];
  if (!isPlainObject(confidence)) {
    return { ok: false, path: 'confidence', detail: 'must be plain object' };
  }
  for (const key of Object.keys(confidence)) {
    if (!isConfidenceBand(confidence[key])) {
      return {
        ok: false,
        path: `confidence.${key}`,
        detail: 'value must be low|medium|high',
      };
    }
  }

  // evidenceSpan: plain object, string|null values, each ≤ MAX_EVIDENCE_SPAN_CHARS
  const evidenceSpan = parsed['evidenceSpan'];
  if (!isPlainObject(evidenceSpan)) {
    return { ok: false, path: 'evidenceSpan', detail: 'must be plain object' };
  }
  for (const key of Object.keys(evidenceSpan)) {
    const val = evidenceSpan[key];
    if (val !== null && typeof val !== 'string') {
      return {
        ok: false,
        path: `evidenceSpan.${key}`,
        detail: 'value must be string or null',
      };
    }
    if (typeof val === 'string' && val.length > MAX_EVIDENCE_SPAN_CHARS) {
      return {
        ok: false,
        path: `evidenceSpan.${key}`,
        detail: `length ${val.length} exceeds max ${MAX_EVIDENCE_SPAN_CHARS}`,
      };
    }
  }

  // observations / confidence / evidenceSpan key sets coordinated
  const confidenceKeys = Object.keys(confidence);
  const evidenceKeys = Object.keys(evidenceSpan);
  for (const key of observationKeys) {
    if (!(key in confidence)) {
      return {
        ok: false,
        path: `confidence.${key}`,
        detail: 'rawKey present in observations but missing from confidence',
      };
    }
    if (!(key in evidenceSpan)) {
      return {
        ok: false,
        path: `evidenceSpan.${key}`,
        detail: 'rawKey present in observations but missing from evidenceSpan',
      };
    }
  }
  for (const key of confidenceKeys) {
    if (!(key in observations)) {
      return {
        ok: false,
        path: `confidence.${key}`,
        detail: 'rawKey present in confidence but missing from observations',
      };
    }
  }
  for (const key of evidenceKeys) {
    if (!(key in observations)) {
      return {
        ok: false,
        path: `evidenceSpan.${key}`,
        detail: 'rawKey present in evidenceSpan but missing from observations',
      };
    }
  }

  // checkedRawKeys must contain every key in observations
  for (const key of observationKeys) {
    if (!checkedRawKeys.includes(key)) {
      return {
        ok: false,
        path: 'checkedRawKeys',
        detail: `observations key "${key}" missing from checkedRawKeys`,
      };
    }
  }

  // modelInfo: { provider: 'mcp', serverName: string, classifierSetVersion: string }
  const modelInfo = parsed['modelInfo'];
  if (!isPlainObject(modelInfo)) {
    return { ok: false, path: 'modelInfo', detail: 'must be plain object' };
  }
  if (modelInfo['provider'] !== 'mcp') {
    return {
      ok: false,
      path: 'modelInfo.provider',
      detail: 'must be "mcp"',
    };
  }
  if (typeof modelInfo['serverName'] !== 'string' || modelInfo['serverName'].length === 0) {
    return {
      ok: false,
      path: 'modelInfo.serverName',
      detail: 'must be non-empty string',
    };
  }
  if (
    typeof modelInfo['classifierSetVersion'] !== 'string' ||
    modelInfo['classifierSetVersion'].length === 0
  ) {
    return {
      ok: false,
      path: 'modelInfo.classifierSetVersion',
      detail: 'must be non-empty string',
    };
  }

  return {
    ok: true,
    value: {
      schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
      nodeId,
      checkedRawKeys: checkedRawKeys as string[],
      observations: observations as Record<string, boolean>,
      confidence: confidence as Record<string, 'low' | 'medium' | 'high'>,
      evidenceSpan: evidenceSpan as Record<string, string | null>,
      modelInfo: {
        provider: 'mcp' as const,
        serverName: modelInfo['serverName'] as string,
        classifierSetVersion: modelInfo['classifierSetVersion'] as string,
      },
    },
  };
}
