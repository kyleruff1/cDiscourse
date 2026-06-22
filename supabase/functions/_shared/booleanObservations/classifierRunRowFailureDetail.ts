/**
 * OPS-MCP-CLASSIFIER-FAILURE-DETAIL-PERSISTENCE — the leak-safe builder for
 * the classifier-queue run row's `failure_detail jsonb` column.
 *
 * WHY: three failure investigations in the ARCH-001 + OPS-MCP cutover arc
 * (PR #419, PR #420, the lone Family-F `provider_server_error` dead-letter in
 * PR #429) each had to leave the database and pull Deno Deploy logs, because
 * the run row records `failure_reason` / `failure_sub_reason` /
 * `dead_letter_reason` but NOT the validator path, the structured reason, or a
 * correlation id. This helper builds the small, allow-listed object the drainer
 * persists alongside its existing failure writes so the row is self-describing
 * for triage. It is WRITE-ONLY diagnostics: nothing reads `failure_detail`.
 *
 * THE CONTRACT — the deny-list is STRUCTURAL, not a hopeful filter.
 * `buildRunRowFailureDetail(input)` accepts ONLY the seven named, allow-listed
 * inputs below. There is NO `extra` / `message` / `details` / `payload` /
 * `body` / `prompt` field, so an argument body, a prompt fragment, an
 * `evidenceSpan` value, or a raw provider response HAS NO ENTRY POINT. The
 * allowed `validator_path` is the structural PATH string (e.g.
 * `evidenceSpan.abductive_explanation_present`) — never the span text.
 *
 * Defense-in-depth on top of the structural deny-list (mirrors the proven
 * `booleanObservationFailureSubreason.ts:buildFailureDetail`): every string
 * field is dropped if it trips a secret-shape matcher, capped at 200 chars,
 * and the whole object is capped at 2000 serialized chars with graceful
 * degradation. Returns `undefined` when no safe field survives, so the column
 * is written NULL (not `{}`).
 *
 * Doctrine: cdiscourse-doctrine §1/§10a — the fields are transport / schema /
 * structural strings only (no verdict, no truth value, no participant
 * attribution); §6 — the column is a secret-surface closed structurally; the
 * scrub fragments are assembled so this source carries no contiguous
 * secret-shaped literal (SCAN-17). Pure TS — no `Deno.`, no `fetch`, no
 * `console`, no `npm:` import — so the Jest bridge can load it for the
 * leak-safety convergence gate.
 */

/**
 * The persisted shape. Every key optional; the object is absent (→ NULL
 * column) when no safe field survives. snake_case to match the jsonb the
 * operator reads via ad-hoc SQL (`failure_detail->>'reason'`).
 *
 * MCP-EGI-003 — `mcp_tool_reason` + `mcp_tool_detail_category` were added so
 * `failure_detail` discriminates hosted-MCP `validation_failed` from genuine
 * provider 5xx (the gap the MCP-EGI-004 D3 canary surfaced). Both are
 * additive jsonb fields — zero migration. Both are allowlist-checked at the
 * builder so an evolving server cannot smuggle a value through.
 */
export interface RunRowFailureDetail {
  validator_path?: string;
  reason?: string;
  family?: string;
  correlation_id?: string;
  attempt_count?: number;
  run_mode?: string;
  schema_version?: string;
  /**
   * MCP-EGI-003 — the hosted MCP server's own `reason` (e.g.
   * `'validation_failed'`). Allowlisted via `ALLOWED_MCP_TOOL_REASONS`; a
   * reason outside the closed vocabulary is dropped.
   */
  mcp_tool_reason?: string;
  /**
   * MCP-EGI-003 — closed-enum category derived from the server's validator
   * `detail` string by the Edge adapter via `mcpToolDetailToCategory()`.
   * Never the raw detail string; only the matched enum value (one of the 14
   * documented `McpToolDetailCategory` values).
   */
  mcp_tool_detail_category?: string;
}

/**
 * Named, allow-listed inputs ONLY. There is deliberately NO free-text /
 * `extra` / `message` / `details` / `payload` / `body` / `prompt` field — a
 * body / prompt / evidenceSpan value / raw provider response has no entry
 * point (structural deny-list). The leak-safety test source-scans this file
 * for the absence of those identifiers as input keys.
 */
export interface RunRowFailureDetailInput {
  /** classify.adapterResult.detail?.path — the structural validator path. */
  validatorPath?: string;
  /** decision.failureReason and/or the typed subReason (structured, not free text). */
  reason?: string;
  /** job.family. */
  family?: string;
  /** job.id — the run row's own uuid (a safe id; never a token/secret). */
  correlationId?: string;
  /** the attempt_count already read back via readAttemptCount(...). */
  attemptCount?: number;
  /** job.run_mode. */
  runMode?: string;
  /** the MCP_BOOLEAN_OBSERVATION_SCHEMA_VERSION constant. */
  schemaVersion?: string;
  /**
   * MCP-EGI-003 — `classify.adapterResult.detail?.serverReason`. The hosted
   * MCP server's own `reason` value. Allowlisted to `ALLOWED_MCP_TOOL_REASONS`
   * (closed vocabulary; a value outside the set is dropped).
   */
  mcpToolReason?: string;
  /**
   * MCP-EGI-003 — `classify.adapterResult.detail?.detailCategory`. Closed-enum
   * category derived from the validator detail string by the Edge adapter.
   * Allowlisted to `ALL_MCP_TOOL_DETAIL_CATEGORIES`; a value outside the set
   * is dropped.
   */
  mcpToolDetailCategory?: string;
}

const MAX_FIELD_CHARS = 200;
const MAX_SERIALIZED_DETAIL_CHARS = 2_000;

/**
 * MCP-EGI-003 — re-derived locally (not imported) so this file stays
 * self-contained per the preservation-manifest pattern. Mirrors
 * `ALLOWED_MCP_TOOL_REASONS` in `booleanObservationFailureSubreason.ts`. A
 * cross-file drift guard test asserts the two sets are equal.
 */
const RUN_ROW_ALLOWED_MCP_TOOL_REASONS: ReadonlySet<string> = new Set([
  'validation_failed',
  'not_implemented',
  'unsupported_family',
  'unsupported_raw_key',
  'invalid_source_subset',
  'fixture_load_failed',
  'key_missing',
  'timeout',
  'rate_limited',
]);

/**
 * MCP-EGI-003 — re-derived locally (not imported), mirrors
 * `ALL_MCP_TOOL_DETAIL_CATEGORIES` in `booleanObservationFailureSubreason.ts`.
 * The closed enum of structural categories the Edge adapter derives from the
 * hosted-MCP `detail` string. The raw string is NEVER stored; only the
 * matched enum value (or absent) rides through to the row.
 */
const RUN_ROW_ALLOWED_MCP_TOOL_DETAIL_CATEGORIES: ReadonlySet<string> = new Set([
  'evidence_span_length_exceeded',
  'evidence_span_invalid_type',
  'evidence_span_key_set_missing',
  'evidence_span_key_set_extra',
  'confidence_key_set_missing',
  'confidence_key_set_extra',
  'confidence_invalid_value',
  'observation_invalid_value',
  'observation_key_missing_from_checked',
  'schema_version_mismatch',
  'missing_required_field',
  'flag_count_too_high',
  'doctrine_ban_list',
  'unknown_validation_failed',
]);

/**
 * Defense-in-depth secret-shape matchers. Each regex is assembled from
 * FRAGMENTS so this source carries no contiguous secret-shaped literal (the
 * SCAN-17 source-scan stays green). A string matching ANY of these is dropped
 * rather than stored. Re-derived here (not imported) so
 * `booleanObservationFailureSubreason.ts` stays byte-equal per the preservation
 * manifest.
 */
const SECRET_SHAPE_MATCHERS: readonly RegExp[] = [
  new RegExp('sk' + '-ant-' + '[A-Za-z0-9_-]{6,}'),
  new RegExp('xai' + '-' + '[A-Za-z0-9]{6,}'),
  new RegExp('sb' + '_secret_' + '[A-Za-z0-9]{6,}'),
  // JWT triple.
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/,
  // Bearer scheme + token.
  new RegExp('Bea' + 'rer' + '\\s+[A-Za-z0-9._-]{8,}'),
  // Header / env names that must never ride a structural detail.
  /Authorization/i,
  /SERVICE_ROLE/,
];

/** True when a string trips ANY secret-shape matcher. */
function looksSecret(value: string): boolean {
  for (const matcher of SECRET_SHAPE_MATCHERS) {
    if (matcher.test(value)) return true;
  }
  return false;
}

/**
 * Keep a string field only if it is a non-empty string that does NOT trip a
 * secret-shape matcher; truncate to MAX_FIELD_CHARS. Returns `undefined`
 * otherwise (empty strings are treated as absent — never stored as `''`).
 */
function safeString(value: string | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (value.length === 0) return undefined;
  if (looksSecret(value)) return undefined;
  return value.slice(0, MAX_FIELD_CHARS);
}

/** Serialized length of a detail object; `0` when it cannot be stringified. */
function serializedLength(detail: RunRowFailureDetail): number {
  try {
    return JSON.stringify(detail).length;
  } catch {
    return 0;
  }
}

/**
 * Build a sanitized, bounded `RunRowFailureDetail` from the named, allow-listed
 * inputs. Returns `undefined` when no safe field survives (so the column is
 * written NULL, not `{}`).
 *
 * Mechanism (cdiscourse-doctrine §6):
 *   1. Read ONLY the nine named args (no free-text entry point → structural deny-list).
 *   2. Drop any string field that trips a secret shape; cap each at 200 chars.
 *   3. `attempt_count` kept only if a finite non-negative integer.
 *   4. `mcpToolReason` / `mcpToolDetailCategory` (MCP-EGI-003) kept ONLY if
 *      the value is in the corresponding closed allowlist — a value outside
 *      the set is dropped silently (defense-in-depth against an evolving
 *      server emitting an unknown reason).
 *   5. Serialized-size cap (≤ 2000 chars) with graceful degradation: drop the
 *      longer optional context first, then fall back to `{ reason, family }`.
 */
export function buildRunRowFailureDetail(
  input: RunRowFailureDetailInput,
): RunRowFailureDetail | undefined {
  const detail: RunRowFailureDetail = {};

  const validatorPath = safeString(input.validatorPath);
  if (validatorPath !== undefined) detail.validator_path = validatorPath;

  const reason = safeString(input.reason);
  if (reason !== undefined) detail.reason = reason;

  const family = safeString(input.family);
  if (family !== undefined) detail.family = family;

  const correlationId = safeString(input.correlationId);
  if (correlationId !== undefined) detail.correlation_id = correlationId;

  if (
    typeof input.attemptCount === 'number' &&
    Number.isInteger(input.attemptCount) &&
    input.attemptCount >= 0
  ) {
    detail.attempt_count = input.attemptCount;
  }

  const runMode = safeString(input.runMode);
  if (runMode !== undefined) detail.run_mode = runMode;

  const schemaVersion = safeString(input.schemaVersion);
  if (schemaVersion !== undefined) detail.schema_version = schemaVersion;

  // MCP-EGI-003: hosted-MCP own reason (e.g. 'validation_failed'). Closed
  // allowlist + secret-shape scrub. A value outside the allowlist is dropped
  // silently — leak-safe by construction.
  const mcpToolReason = safeString(input.mcpToolReason);
  if (
    mcpToolReason !== undefined &&
    RUN_ROW_ALLOWED_MCP_TOOL_REASONS.has(mcpToolReason)
  ) {
    detail.mcp_tool_reason = mcpToolReason;
  }

  // MCP-EGI-003: closed-enum category derived from the validator detail
  // string by the Edge adapter. Stored only if it is a member of the
  // declared enum (the Edge adapter already restricts via
  // `mcpToolDetailToCategory()`, but a malformed input is dropped silently).
  if (
    typeof input.mcpToolDetailCategory === 'string' &&
    RUN_ROW_ALLOWED_MCP_TOOL_DETAIL_CATEGORIES.has(input.mcpToolDetailCategory)
  ) {
    detail.mcp_tool_detail_category = input.mcpToolDetailCategory;
  }

  // No safe field survived → absent, not empty.
  if (Object.keys(detail).length === 0) return undefined;

  // Serialized-size cap with graceful degradation.
  if (serializedLength(detail) <= MAX_SERIALIZED_DETAIL_CHARS) {
    return detail;
  }
  // 1. Drop the longer, lower-priority context fields first.
  delete detail.validator_path;
  delete detail.schema_version;
  if (serializedLength(detail) <= MAX_SERIALIZED_DETAIL_CHARS) {
    return detail;
  }
  // 2. Last resort: the two most triage-critical fields only.
  const minimal: RunRowFailureDetail = {};
  if (detail.reason !== undefined) minimal.reason = detail.reason;
  if (detail.family !== undefined) minimal.family = detail.family;
  if (Object.keys(minimal).length === 0) return undefined;
  return minimal;
}
