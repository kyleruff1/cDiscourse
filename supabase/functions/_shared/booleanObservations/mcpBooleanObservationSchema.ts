/**
 * MCP-021A — MCP boolean observation request/response schema + validators.
 *
 * Pure TypeScript. No React, no Supabase, no network. The wire layer
 * (transport, retry, batching, real sanitization) is MCP-021C territory;
 * this file defines the TYPE-LEVEL contract + 4 pure validators that
 * future MCP-021B/C builds on.
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §7 — no AI calls from the production app
 *     (validators are pure-TS; no fetch / XHR / HTTP-client import).
 *   - cdiscourse-doctrine §10a — observations stay structural; the
 *     sanitizer drops unknown rawKeys silently (never echoes raw codes
 *     to UI or logs).
 *   - design doc §5 — failure-mode contract per intent brief.
 */

import {
  MACHINE_OBSERVATION_DEFINITIONS_REGISTRY,
  lookupMachineObservationDefinition,
} from './machineObservationDefinitions.ts';
import type {
  MachineObservationDefinition,
  MachineObservationFamily,
  NodeLabelMark,
} from './nodeLabelTypes.ts';

// ── Schema version constant ──────────────────────────────────────

/**
 * MCP-021A — Schema version for boolean Machine Observation requests
 * and responses. The version constant gates cache keys and parser
 * dispatch. MCP-021B and MCP-021C will bump this if the wire shape
 * changes; MCP-021A bakes 'v1' verbatim.
 */
export const MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION =
  'mcp-021.machine-observations.boolean.v1' as const;

export type McpBooleanObservationSchemaVersion =
  typeof MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION;

// ── Request shape ────────────────────────────────────────────────

/**
 * MCP-021A — Request shape sent to the MCP server when classifying a
 * single move. The server returns a McpBooleanObservationResponse.
 *
 * MCP-021A defines this type ONLY. The wire layer is MCP-021C
 * territory.
 *
 * Pure JSON-serializable.
 */
export interface McpBooleanObservationRequest {
  /** Pinned schema version. */
  schemaVersion: McpBooleanObservationSchemaVersion;

  /** The move being classified. */
  nodeId: string;

  /** The move's parent (null when classifying a root claim). */
  parentNodeId: string | null;

  /** Sanitized text of the move being classified. Pre-sanitized at
   *  call site (MCP-021C wires the sanitizer). MCP-021A: type only. */
  currentText: string;

  /** Sanitized text of the parent (null if root). */
  parentText: string | null;

  /** Sanitized context excerpt from thread (limited length). */
  threadContextExcerpt: string;

  /** Which families the server should evaluate for this call.
   *  Empty array = all eligible families. */
  requestedFamilies: ReadonlyArray<MachineObservationFamily>;

  /** Which specific rawKeys to evaluate. Overrides family filter when
   *  non-empty. */
  requestedRawKeys: ReadonlyArray<string>;

  /** The full registry-entry definitions for the rawKeys being
   *  requested. The server uses these to formulate the boolean
   *  questions and apply the false-positive guards. */
  definitions: Record<string, MachineObservationDefinition>;

  /** Per-call timeout in milliseconds. */
  timeoutMs: number;
}

// ── Response shape ───────────────────────────────────────────────

/**
 * MCP-021A — Response shape returned by the MCP server. Refinement 1
 * from the MCP-020 audit: `confidence` is REQUIRED (not optional).
 *
 * Pure JSON-serializable.
 */
export interface McpBooleanObservationResponse {
  /** Must match the request schemaVersion. */
  schemaVersion: McpBooleanObservationSchemaVersion;

  /** Echoes request.nodeId. */
  nodeId: string;

  /** Which rawKeys the server attempted (could be subset of
   *  request.requestedRawKeys if server bailed early). */
  checkedRawKeys: ReadonlyArray<string>;

  /** Per-rawKey boolean result. Keys not in this map are treated as
   *  "server did not check" — they emit zero chips. */
  observations: Record<string, boolean>;

  /** Per-rawKey confidence band. REQUIRED for every key in
   *  `observations`. Per MCP-020 audit refinement 1, the server must
   *  never omit confidence — default `'medium'` when honestly unsure. */
  confidence: Record<string, 'low' | 'medium' | 'high'>;

  /** Optional supporting span from the move body, per rawKey. Null
   *  when server has no quote. Sanitized at adapter boundary
   *  (MCP-021C). */
  evidenceSpan: Record<string, string | null>;

  /** Model / server provenance for cache key + operator audit. */
  modelInfo: {
    provider: 'mcp';
    serverName: string;
    classifierSetVersion: string;
  };

  /**
   * OPS-MCP-KEY-LEVEL-FAIL-CLOSED — optional, additive, v1-compatible. Present
   * ONLY when the MCP server dropped ≥1 unclean-span key by OMISSION (key-level
   * fail-closed; Family J only on first ship). Absent ⇔ no keys dropped (a fully
   * clean packet is byte-identical to today). Carries rawKey NAMES ONLY — never
   * span content, never a verdict. Each entry is, by construction, absent from
   * `observations` / `confidence` / `evidenceSpan` / `checkedRawKeys`.
   */
  keysDroppedForUncleanSpan?: ReadonlyArray<string>;
}

// ── Validator results ────────────────────────────────────────────

export type McpBooleanObservationParseFailureReason =
  | 'not_json'
  | 'wrong_schema_version'
  | 'wrong_shape'
  | 'missing_required_field'
  | 'flag_count_too_high'
  | 'duplicate_node_id';

export type McpBooleanObservationParseResult =
  | { ok: true; response: McpBooleanObservationResponse }
  | {
      ok: false;
      reason: McpBooleanObservationParseFailureReason;
      details: string;
    };

// ── Internal helpers ─────────────────────────────────────────────

const MAX_FLAGS_PER_RESPONSE = 20;
const MAX_EVIDENCE_SPAN_CHARS = 240;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isConfidenceBand(value: unknown): value is 'low' | 'medium' | 'high' {
  return value === 'low' || value === 'medium' || value === 'high';
}

function truncateEvidenceSpan(value: string): string {
  if (value.length <= MAX_EVIDENCE_SPAN_CHARS) return value;
  return `${value.slice(0, MAX_EVIDENCE_SPAN_CHARS - 1)}…`;
}

// ── parseMcpBooleanObservationResponse ───────────────────────────

/**
 * Parse a candidate JSON string into a McpBooleanObservationResponse.
 * Handles every documented failure mode per intent brief §"Failure-mode
 * contract". Pure.
 *
 *   - Not JSON → returns {ok: false, reason: 'not_json'}.
 *   - Wrong schemaVersion (or missing) → {ok: false, reason: 'wrong_schema_version'}.
 *   - Wrong shape → {ok: false, reason: 'wrong_shape'}.
 *   - Missing required field → {ok: false, reason: 'missing_required_field'}.
 *   - observations.length > 20 → {ok: false, reason: 'flag_count_too_high'}.
 *   - Otherwise {ok: true, response}.
 */
export function parseMcpBooleanObservationResponse(
  candidate: unknown,
): McpBooleanObservationParseResult {
  // Step 1: must be a JSON string (or already-parsed object via type laxity)
  let parsed: unknown;
  if (typeof candidate === 'string') {
    try {
      parsed = JSON.parse(candidate);
    } catch {
      return { ok: false, reason: 'not_json', details: 'JSON.parse threw' };
    }
  } else if (isPlainObject(candidate)) {
    parsed = candidate;
  } else {
    return { ok: false, reason: 'not_json', details: 'candidate is not a string or object' };
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, reason: 'wrong_shape', details: 'parsed root is not a plain object' };
  }

  // Step 2: schemaVersion must match
  const schemaVersion = parsed['schemaVersion'];
  if (schemaVersion !== MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: 'wrong_schema_version',
      details: `expected ${MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION}; got ${String(schemaVersion)}`,
    };
  }

  // Step 3: required fields present
  const requiredFields: ReadonlyArray<keyof McpBooleanObservationResponse> = [
    'schemaVersion',
    'nodeId',
    'checkedRawKeys',
    'observations',
    'confidence',
    'evidenceSpan',
    'modelInfo',
  ];
  for (const field of requiredFields) {
    if (!(field in parsed)) {
      return {
        ok: false,
        reason: 'missing_required_field',
        details: `missing field "${String(field)}"`,
      };
    }
  }

  // Step 4: nodeId is non-empty string
  if (typeof parsed['nodeId'] !== 'string' || (parsed['nodeId'] as string).length === 0) {
    return { ok: false, reason: 'wrong_shape', details: 'nodeId must be non-empty string' };
  }

  // Step 5: checkedRawKeys must be string array
  if (!Array.isArray(parsed['checkedRawKeys'])) {
    return { ok: false, reason: 'wrong_shape', details: 'checkedRawKeys must be array' };
  }
  for (const key of parsed['checkedRawKeys'] as unknown[]) {
    if (typeof key !== 'string') {
      return { ok: false, reason: 'wrong_shape', details: 'checkedRawKeys entries must be string' };
    }
  }

  // Step 6: observations must be object with boolean values
  if (!isPlainObject(parsed['observations'])) {
    return { ok: false, reason: 'wrong_shape', details: 'observations must be object' };
  }
  const observationEntries = Object.entries(parsed['observations']);
  if (observationEntries.length > MAX_FLAGS_PER_RESPONSE) {
    return {
      ok: false,
      reason: 'flag_count_too_high',
      details: `observations has ${observationEntries.length} entries; max ${MAX_FLAGS_PER_RESPONSE}`,
    };
  }
  for (const [, val] of observationEntries) {
    if (!isBoolean(val)) {
      return {
        ok: false,
        reason: 'wrong_shape',
        details: 'observations values must be boolean',
      };
    }
  }

  // Step 7: confidence must be object with confidence-band values
  if (!isPlainObject(parsed['confidence'])) {
    return { ok: false, reason: 'wrong_shape', details: 'confidence must be object' };
  }
  for (const [, val] of Object.entries(parsed['confidence'])) {
    if (!isConfidenceBand(val)) {
      return {
        ok: false,
        reason: 'wrong_shape',
        details: 'confidence values must be low|medium|high',
      };
    }
  }

  // Step 8: evidenceSpan must be object with string-or-null values
  if (!isPlainObject(parsed['evidenceSpan'])) {
    return { ok: false, reason: 'wrong_shape', details: 'evidenceSpan must be object' };
  }
  for (const [, val] of Object.entries(parsed['evidenceSpan'])) {
    if (val !== null && typeof val !== 'string') {
      return {
        ok: false,
        reason: 'wrong_shape',
        details: 'evidenceSpan values must be string or null',
      };
    }
  }

  // Step 9: modelInfo must be {provider, serverName, classifierSetVersion}
  const modelInfo = parsed['modelInfo'];
  if (!isPlainObject(modelInfo)) {
    return { ok: false, reason: 'wrong_shape', details: 'modelInfo must be object' };
  }
  if (modelInfo['provider'] !== 'mcp') {
    return { ok: false, reason: 'wrong_shape', details: 'modelInfo.provider must be "mcp"' };
  }
  if (typeof modelInfo['serverName'] !== 'string') {
    return { ok: false, reason: 'wrong_shape', details: 'modelInfo.serverName must be string' };
  }
  if (typeof modelInfo['classifierSetVersion'] !== 'string') {
    return {
      ok: false,
      reason: 'wrong_shape',
      details: 'modelInfo.classifierSetVersion must be string',
    };
  }

  // Step 10: OPS-MCP-KEY-LEVEL-FAIL-CLOSED — optional `keysDroppedForUncleanSpan`.
  // When present it must be a string[] (names of keys the server omitted because
  // their span tripped the doctrine ban-scan). Absent ⇔ no keys dropped. The
  // reconstruction step below carries it through ONLY when valid + present.
  let droppedKeys: string[] | undefined;
  if (
    'keysDroppedForUncleanSpan' in parsed &&
    parsed['keysDroppedForUncleanSpan'] !== undefined
  ) {
    const raw = parsed['keysDroppedForUncleanSpan'];
    if (!Array.isArray(raw)) {
      return {
        ok: false,
        reason: 'wrong_shape',
        details: 'keysDroppedForUncleanSpan must be array',
      };
    }
    for (const k of raw as unknown[]) {
      if (typeof k !== 'string') {
        return {
          ok: false,
          reason: 'wrong_shape',
          details: 'keysDroppedForUncleanSpan entries must be string',
        };
      }
    }
    droppedKeys = raw as string[];
  }

  // Build typed response.
  const response: McpBooleanObservationResponse = {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: parsed['nodeId'] as string,
    checkedRawKeys: parsed['checkedRawKeys'] as string[],
    observations: parsed['observations'] as Record<string, boolean>,
    confidence: parsed['confidence'] as Record<string, 'low' | 'medium' | 'high'>,
    evidenceSpan: parsed['evidenceSpan'] as Record<string, string | null>,
    modelInfo: {
      provider: 'mcp',
      serverName: modelInfo['serverName'] as string,
      classifierSetVersion: modelInfo['classifierSetVersion'] as string,
    },
    ...(droppedKeys !== undefined ? { keysDroppedForUncleanSpan: droppedKeys } : {}),
  };

  return { ok: true, response };
}

// ── sanitizeMcpBooleanObservationResponse ────────────────────────

export interface SanitizeOptions {
  surface: 'timeline_node' | 'selected_context' | 'inspect';
}

/**
 * Sanitize a parsed response. Pure.
 *
 *   - Discards observations for rawKeys NOT in the
 *     MACHINE_OBSERVATION_DEFINITIONS_REGISTRY (per refinement 3 —
 *     never echo unknown keys to logs / UI).
 *   - Discards observations whose confidence is BELOW the registry
 *     entry's confidenceEligibility threshold for the requested surface.
 *   - Truncates evidenceSpan to ≤240 chars (audit refinement 2).
 *   - Returns a NEW response object; never mutates input.
 */
export function sanitizeMcpBooleanObservationResponse(
  parsed: McpBooleanObservationResponse,
  options: SanitizeOptions,
): McpBooleanObservationResponse {
  const safeObservations: Record<string, boolean> = {};
  const safeConfidence: Record<string, 'low' | 'medium' | 'high'> = {};
  const safeEvidenceSpan: Record<string, string | null> = {};
  const safeCheckedKeys: string[] = [];

  for (const rawKey of parsed.checkedRawKeys) {
    // Drop unknown rawKeys silently — never echo
    const def = lookupMachineObservationDefinition(rawKey);
    if (!def) continue;

    safeCheckedKeys.push(rawKey);

    const observed = parsed.observations[rawKey];
    if (!isBoolean(observed)) continue;

    const confidence = parsed.confidence[rawKey];
    if (!isConfidenceBand(confidence)) continue;

    // Apply per-surface confidence floor
    const minRequired = pickMinConfidenceForSurface(def, options.surface);
    if (!meetsConfidenceFloor(confidence, minRequired)) continue;

    safeObservations[rawKey] = observed;
    safeConfidence[rawKey] = confidence;

    const span = parsed.evidenceSpan[rawKey];
    if (typeof span === 'string') {
      safeEvidenceSpan[rawKey] = truncateEvidenceSpan(span);
    } else {
      safeEvidenceSpan[rawKey] = null;
    }
  }

  return {
    schemaVersion: parsed.schemaVersion,
    nodeId: parsed.nodeId,
    checkedRawKeys: Object.freeze(safeCheckedKeys),
    observations: safeObservations,
    confidence: safeConfidence,
    evidenceSpan: safeEvidenceSpan,
    modelInfo: { ...parsed.modelInfo },
    // OPS-MCP-KEY-LEVEL-FAIL-CLOSED — preserve the server-sourced unclean-span
    // drop list verbatim (names only). The sanitizer's own confidence-floor /
    // unknown-key drops are SEPARATE and are NOT recorded here. Absent ⇔ no
    // server-side drop (byte-identical to a pre-card sanitize output).
    ...(parsed.keysDroppedForUncleanSpan !== undefined
      ? { keysDroppedForUncleanSpan: parsed.keysDroppedForUncleanSpan }
      : {}),
  };
}

function pickMinConfidenceForSurface(
  def: MachineObservationDefinition,
  surface: SanitizeOptions['surface'],
): 'low' | 'medium' | 'high' {
  switch (surface) {
    case 'timeline_node':
      return def.confidenceEligibility.timelineMinConfidence;
    case 'selected_context':
      return def.confidenceEligibility.selectedContextMinConfidence;
    case 'inspect':
      return def.confidenceEligibility.inspectMinConfidence;
    default:
      return 'high';
  }
}

const CONFIDENCE_RANK: Record<'low' | 'medium' | 'high', number> = {
  low: 0,
  medium: 1,
  high: 2,
};

function meetsConfidenceFloor(
  actual: 'low' | 'medium' | 'high',
  required: 'low' | 'medium' | 'high',
): boolean {
  return CONFIDENCE_RANK[actual] >= CONFIDENCE_RANK[required];
}

// ── buildMcpBooleanObservationRequest ────────────────────────────

export interface BuildRequestInput {
  nodeId: string;
  parentNodeId: string | null;
  currentText: string;
  parentText: string | null;
  threadContextExcerpt: string;
  requestedFamilies: ReadonlyArray<MachineObservationFamily>;
  requestedRawKeys: ReadonlyArray<string>;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 12_000;

/**
 * Build a request for a given node and family selection. Pure helper
 * used by tests; MCP-021C will replace its caller with a real builder
 * that handles batching + retry.
 *
 * Pulls the relevant `definitions` slice from the parallel registry.
 * Unknown rawKeys in `requestedRawKeys` are SILENTLY dropped from the
 * returned `definitions` map (the server cannot answer questions about
 * keys it has no definition for).
 */
export function buildMcpBooleanObservationRequest(
  input: BuildRequestInput,
): McpBooleanObservationRequest {
  const definitions: Record<string, MachineObservationDefinition> = {};

  if (input.requestedRawKeys.length > 0) {
    for (const rawKey of input.requestedRawKeys) {
      const def = lookupMachineObservationDefinition(rawKey);
      if (def) definitions[rawKey] = def;
    }
  } else if (input.requestedFamilies.length > 0) {
    for (const def of Object.values(MACHINE_OBSERVATION_DEFINITIONS_REGISTRY)) {
      if (input.requestedFamilies.includes(def.family)) {
        definitions[def.rawKey] = def;
      }
    }
  } else {
    // No filter — include all definitions.
    for (const def of Object.values(MACHINE_OBSERVATION_DEFINITIONS_REGISTRY)) {
      definitions[def.rawKey] = def;
    }
  }

  return {
    schemaVersion: MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION,
    nodeId: input.nodeId,
    parentNodeId: input.parentNodeId,
    currentText: input.currentText,
    parentText: input.parentText,
    threadContextExcerpt: input.threadContextExcerpt,
    requestedFamilies: Object.freeze([...input.requestedFamilies]),
    requestedRawKeys: Object.freeze([...input.requestedRawKeys]),
    definitions,
    timeoutMs:
      typeof input.timeoutMs === 'number' && input.timeoutMs > 0
        ? input.timeoutMs
        : DEFAULT_TIMEOUT_MS,
  };
}

// ── mcpResponseToNodeLabelMarks ──────────────────────────────────

/**
 * Map a parsed-and-sanitized response into NodeLabelMark[] for the
 * requested surface. Returns [] when response has no positive
 * observations. Pure.
 *
 * IMPORTANT: this helper is the bridge between MCP response and
 * UX-001.5A's existing presentation pipeline. It does NOT call
 * adaptRawClassifierBinarySource. MCP-021B will wire the persistence
 * layer between the MCP response and Source 6 adapter; MCP-021A only
 * defines this type-level bridge.
 *
 * Use AFTER `sanitizeMcpBooleanObservationResponse(response, {surface})`
 * to ensure confidence thresholds are applied; this function does NOT
 * re-apply confidence sanitization.
 */
export function mcpResponseToNodeLabelMarks(
  response: McpBooleanObservationResponse,
  _options: SanitizeOptions,
): NodeLabelMark[] {
  const marks: NodeLabelMark[] = [];
  for (const rawKey of response.checkedRawKeys) {
    if (response.observations[rawKey] !== true) continue;
    const def = lookupMachineObservationDefinition(rawKey);
    if (!def) continue;

    const confidence = response.confidence[rawKey];
    const mark: NodeLabelMark = {
      id: def.id,
      rawKey: def.rawKey,
      kind: 'machine_observation',
      source: def.source,
      label: def.label,
      shortLabel: def.shortLabel,
      description: def.description,
      defaultSurface: def.defaultSurface,
      disposition: def.disposition,
      priority: def.priority,
      visibleByDefault: def.visibleByDefault,
    };
    if (isConfidenceBand(confidence)) {
      mark.confidence = confidence;
    }
    marks.push(Object.freeze(mark));
  }
  return marks;
}
