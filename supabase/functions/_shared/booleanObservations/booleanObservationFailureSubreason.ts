/**
 * OPS-MCP-RESULT-VALIDATION-BURST-HARDENING — Phase 1 (TYPE).
 *
 * The typed sub-reason vocabulary + pure mapping + the sanitized
 * `detail` builder for a Boolean Observation adapter failure.
 *
 * Origin: the OPS-MCP-AUTO-TRIGGER-PARALLELIZATION smoke (PARTIAL) found
 * 4/35 family runs failing with `failure_reason='mcp_validation_failed'`
 * under a burst — a RESULT-side failure (the MCP server answered; the
 * answer failed the MCP-021A validator). Today the adapter discards the
 * validator's granular `{reason, details}` and collapses everything to a
 * single opaque `validation_failed`. Phase 1 stops the discard: it threads
 * a typed sub-reason (a controlled request_ / response_ / provider_
 * vocabulary) plus a bounded, sanitized detail through the adapter result.
 *
 * Doctrine encoded:
 *   - cdiscourse-doctrine §1 / §10a — the sub-reason vocabulary describes
 *     transport + schema-shape facts ONLY. It carries no verdict, no truth
 *     value, no user-intent attribution. A ban-list test asserts none of
 *     the values contains a verdict token.
 *   - cdiscourse-doctrine §6 — the `detail` field is a SECRET-SURFACE. The
 *     builder is an ALLOWLIST (named args only; no free-text/`extra`/
 *     `message`/`details` entry point), it RE-DERIVES structural parts (it
 *     NEVER forwards the validator's `parsed.details` string), and it runs
 *     a defense-in-depth secret-shape scrub + a 2000-char serialized cap
 *     with graceful degradation. No prompt, body, raw model response, JWT,
 *     Bearer, service-role, Authorization, or API key can reach it.
 *   - cdiscourse-doctrine §7 — server-only; this module lives under the
 *     `booleanObservations` tree that the source-scan fences out of
 *     `src/`/`app/`.
 *
 * Pure TS — no `Deno.`, no `fetch`, no `console`, no `npm:` import. The
 * only imports are TYPE-only (the validator's failure-reason enum, the
 * adapter's unavailable-reason union, and the family enum) plus the
 * registry value used to validate `checkedRawKey`. Jest-loadable, so the
 * mapping + sanitizer get real behavioral unit tests.
 */

import type { McpBooleanObservationParseFailureReason } from './mcpBooleanObservationSchema.ts';
import type { BooleanObservationUnavailableReason } from './booleanObservationMcpAdapterCore.ts';
import type { MachineObservationFamily } from './nodeLabelTypes.ts';
import { MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY } from './machineObservationDefinitions.ts';

/**
 * Typed sub-reason vocabulary for a Boolean Observation adapter failure.
 * Operator/diagnostic ONLY — never user-facing, never persisted to a DB
 * column. The durable value is the request_ / response_ / provider_ split:
 * it tells Phase 2 which CLASS of failure dominates under burst.
 *
 * Doctrine: structural transport/schema facts only (cdiscourse-doctrine
 * §1/§10a) — no verdict, no truth, no user-intent.
 */
export type BooleanObservationFailureSubreason =
  // request-side (fast-reject; <~1s) — the move/body never reached the model
  | 'request_unsupported_family'
  | 'request_unsupported_raw_key'
  | 'request_invalid_source_subset'
  // response-side (slow-fail; ~full classifier duration) — the model
  // answered but the answer failed MCP-021A validation
  | 'response_not_json'
  | 'response_wrong_schema_version'
  | 'response_wrong_shape'
  | 'response_missing_required_field'
  | 'response_flag_count_too_high'
  | 'response_evidence_span_invalid' // RESERVED — no emitter today
  | 'response_ban_list_violation' // RESERVED — no emitter today
  // provider/transport
  | 'provider_timeout' // RESERVED — folded into network_error today
  | 'provider_rate_limited'
  | 'provider_api_error'
  | 'provider_server_error' // body-level { isError } envelope (Phase 3)
  | 'provider_network_error'
  // catch-all for a reason with no mapping (forward-compatible)
  | 'unknown';

/**
 * Every documented `BooleanObservationFailureSubreason` value, in declared
 * order. Referenced by the ban-list + exhaustiveness tests, so the
 * reserved entries are not literally unused.
 */
export const ALL_BOOLEAN_OBSERVATION_FAILURE_SUBREASONS: readonly BooleanObservationFailureSubreason[] = [
  'request_unsupported_family',
  'request_unsupported_raw_key',
  'request_invalid_source_subset',
  'response_not_json',
  'response_wrong_schema_version',
  'response_wrong_shape',
  'response_missing_required_field',
  'response_flag_count_too_high',
  'response_evidence_span_invalid',
  'response_ban_list_violation',
  'provider_timeout',
  'provider_rate_limited',
  'provider_api_error',
  'provider_server_error',
  'provider_network_error',
  'unknown',
];

/**
 * MCP-EGI-003 — Structural categories derived from the hosted-MCP server's
 * `{ isError: true, reason: 'validation_failed', path, detail }` envelope.
 *
 * The validator detail strings (in
 * `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts`) are structurally
 * shaped ("value must be string or null", "length N exceeds max M", "rawKey
 * present in observations but missing from evidenceSpan", etc.). This closed
 * enum is the safe categorization of those strings — the raw `detail` is
 * NEVER persisted; only the matched category enum value rides through.
 *
 * Used by `mcpToolDetailToCategory()` below + the row-level
 * `RunRowFailureDetail.mcp_tool_detail_category` field. The Edge adapter
 * (`booleanObservationMcpAdapter.ts`) reads the server's `detail` string,
 * passes it through `mcpToolDetailToCategory()`, and forwards only the
 * resulting enum value — not the raw string.
 *
 * `unknown_validation_failed` is the fall-through for any detail string that
 * does not match the whitelist (a new validator detail pattern, a malformed
 * server response, etc.). Falling through is leak-safe by construction.
 *
 * Doctrine: cdiscourse-doctrine §6 — closed enum + structural deny-list; no
 * raw values; no provider-emitted content stored.
 */
export type McpToolDetailCategory =
  | 'evidence_span_length_exceeded'
  | 'evidence_span_invalid_type'
  | 'evidence_span_key_set_missing'
  | 'evidence_span_key_set_extra'
  | 'confidence_key_set_missing'
  | 'confidence_key_set_extra'
  | 'confidence_invalid_value'
  | 'observation_invalid_value'
  | 'observation_key_missing_from_checked'
  | 'schema_version_mismatch'
  | 'missing_required_field'
  | 'flag_count_too_high'
  | 'doctrine_ban_list'
  | 'unknown_validation_failed';

/** Every documented `McpToolDetailCategory` value, in declared order. */
export const ALL_MCP_TOOL_DETAIL_CATEGORIES: readonly McpToolDetailCategory[] = [
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
];

/**
 * MCP-EGI-003 — the closed allow-list of `reason` values the hosted MCP
 * server's `{ isError: true, reason }` envelope may carry. A reason outside
 * this set is dropped at the row-level builder (defense-in-depth — the
 * Phase-1 `serverReason` allow-list rides on it).
 */
export const ALLOWED_MCP_TOOL_REASONS: ReadonlySet<string> = new Set([
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
 * MCP-EGI-003 — pure, total mapping from the hosted-MCP server's validator
 * detail string to the closed `McpToolDetailCategory` enum.
 *
 * Each branch matches a structural shape (a regex anchored to the
 * validator's exact emit phrasing). The function NEVER captures a named
 * group, NEVER extracts a model-emitted value, and NEVER returns the raw
 * `detail`. A non-string / unknown / malformed input maps to
 * `unknown_validation_failed`, which is leak-safe.
 *
 * The 13 structural categories enumerated below are the exhaustive set of
 * detail strings emitted by `validateMcpBooleanObservationResponse` in
 * `mcp-server/lib/mcpBooleanObservationSchemaMirror.ts` plus the
 * `'doctrine_ban_list'` literal emitted by Step 5 of
 * `mcp-server/tools/classifyArgumentBooleanObservations.ts`.
 */
export function mcpToolDetailToCategory(
  detail: unknown,
): McpToolDetailCategory | undefined {
  if (typeof detail !== 'string' || detail.length === 0) return undefined;
  if (/^length \d+ exceeds max \d+$/.test(detail)) {
    return 'evidence_span_length_exceeded';
  }
  if (detail === 'value must be string or null') {
    return 'evidence_span_invalid_type';
  }
  if (detail === 'rawKey present in observations but missing from evidenceSpan') {
    return 'evidence_span_key_set_missing';
  }
  if (detail === 'rawKey present in evidenceSpan but missing from observations') {
    return 'evidence_span_key_set_extra';
  }
  if (detail === 'rawKey present in observations but missing from confidence') {
    return 'confidence_key_set_missing';
  }
  if (detail === 'rawKey present in confidence but missing from observations') {
    return 'confidence_key_set_extra';
  }
  if (detail === 'value must be low|medium|high') {
    return 'confidence_invalid_value';
  }
  if (detail === 'value must be boolean') {
    return 'observation_invalid_value';
  }
  if (/^observations key "[^"]+" missing from checkedRawKeys$/.test(detail)) {
    return 'observation_key_missing_from_checked';
  }
  if (/^expected mcp-021\./.test(detail)) {
    return 'schema_version_mismatch';
  }
  if (/^missing required field/.test(detail)) {
    return 'missing_required_field';
  }
  if (/^flag count \d+ exceeds max \d+$/.test(detail)) {
    return 'flag_count_too_high';
  }
  if (detail === 'doctrine_ban_list') {
    return 'doctrine_ban_list';
  }
  return 'unknown_validation_failed';
}

/**
 * The sanitized detail attached to an unavailable adapter result. EVERY
 * field is an allowlisted structural fragment — NEVER the prompt, body,
 * raw model response, or any secret. Built by re-derivation from named
 * parts (see `buildFailureDetail`); `parsed.details` is NOT forwarded
 * verbatim. All fields optional; the whole object is capped.
 */
export interface BooleanObservationFailureDetail {
  /** The validator's controlled reason enum (NOT free text). */
  validatorReason?: McpBooleanObservationParseFailureReason;
  /** Structural path of the failing field, e.g. 'modelInfo.provider'. From a static allowlist. */
  path?: string;
  /** What the validator expected, e.g. 'mcp'. From a static allowlist / a constant. */
  expected?: string;
  /** typeof the received value, e.g. 'string' | 'number' | 'object' | 'undefined'. NEVER the value. */
  receivedType?: string;
  /** The KEYS present on the received object (names only, capped count). NEVER the values. */
  receivedKeys?: string[];
  /** The rawKey the adapter checked, when relevant (registry key, structural). */
  checkedRawKey?: string;
  /** Echo of the schema version constant in play (a version string, not data). */
  schemaVersion?: string;
  /** The family the request targeted, when relevant. */
  family?: MachineObservationFamily;
  /**
   * OPS-MCP-RESULT-VALIDATION-BURST-HARDENING (Phase 3): the MCP server's
   * OWN short error code, read off its `{ isError, reason }` envelope under
   * load. UNTRUSTED server input — scrubbed for secret shapes + capped, the
   * same way `expected`/`schemaVersion` are. NEVER the raw `detail` blob.
   */
  serverReason?: string;
  /**
   * MCP-EGI-003 — closed-enum category derived from the server's validator
   * `detail` string via `mcpToolDetailToCategory()`. NEVER the raw `detail`.
   * Absent when the input was not a string or the mapping was unknown.
   */
  detailCategory?: McpToolDetailCategory;
}

// ── mapToFailureSubreason ────────────────────────────────────────

/**
 * Map a validator parse-failure reason to the typed sub-reason. Pure,
 * total, exhaustive (a `never` compile guard on the default arm proves
 * every `McpBooleanObservationParseFailureReason` member is handled).
 *
 * `duplicate_node_id` is type-reachable (the union carries it) but never
 * returned by the current parser body; it maps to `'unknown'` rather than
 * minting a speculative `response_duplicate_node_id` (an un-approved,
 * un-emitted invention).
 */
function mapValidatorReason(
  validatorReason: McpBooleanObservationParseFailureReason,
): BooleanObservationFailureSubreason {
  switch (validatorReason) {
    case 'not_json':
      return 'response_not_json';
    case 'wrong_schema_version':
      return 'response_wrong_schema_version';
    case 'wrong_shape':
      return 'response_wrong_shape';
    case 'missing_required_field':
      return 'response_missing_required_field';
    case 'flag_count_too_high':
      return 'response_flag_count_too_high';
    case 'duplicate_node_id':
      // Declared in the union, NOT emitted by the current parser body.
      // Defensive default (intent §2: do not invent emitters).
      return 'unknown';
    default: {
      // Exhaustiveness guard — a new validator reason without a mapping
      // is a compile error here.
      const _exhaustive: never = validatorReason;
      return _exhaustive;
    }
  }
}

/**
 * Map an adapter unavailable reason (+ the optional validator parse reason
 * captured at the collapse site) to the typed sub-reason. Pure, total,
 * exhaustive. Never throws.
 *
 * @param adapterReason  the BooleanObservationUnavailableReason
 * @param validatorReason optional — the parser's reason, present ONLY when
 *                        adapterReason === 'validation_failed' (or the
 *                        parse_failure path forwards it). undefined otherwise.
 * @returns a BooleanObservationFailureSubreason, or `undefined` for the
 *          operator-config reasons (url_missing / token_missing) where a
 *          sub-reason adds nothing (the top-level failure_reason already
 *          says it).
 */
export function mapToFailureSubreason(
  adapterReason: BooleanObservationUnavailableReason,
  validatorReason?: McpBooleanObservationParseFailureReason,
): BooleanObservationFailureSubreason | undefined {
  switch (adapterReason) {
    // Operator-config failures — distinct failure_reason already; a
    // sub-reason adds nothing, and `unknown` would falsely imply
    // "couldn't classify". Leave UNSET.
    case 'url_missing':
    case 'token_missing':
      return undefined;
    case 'network_error':
      return 'provider_network_error';
    case 'rate_limited':
      return 'provider_rate_limited';
    case 'api_error':
      return 'provider_api_error';
    case 'parse_failure':
      return 'response_not_json';
    case 'validation_failed':
      // Delegated to the validator map when a validatorReason was
      // captured at the collapse site. Absent one (e.g. the
      // belt-and-suspenders schema-version guard sets the sub-reason
      // directly), fall back to `unknown`.
      return validatorReason !== undefined
        ? mapValidatorReason(validatorReason)
        : 'unknown';
    default: {
      // Exhaustiveness guard over BooleanObservationUnavailableReason.
      const _exhaustive: never = adapterReason;
      return _exhaustive;
    }
  }
}

// ── buildFailureDetail (the sanitizer) ───────────────────────────

/**
 * Named, allowlisted input to `buildFailureDetail`. The builder reads ONLY
 * these named parts — there is NO free-text / `extra` / `message` /
 * `details` pass-through field, so a body / prompt / raw response has no
 * entry point.
 *
 * `received` carries the RAW value the adapter holds; the builder stores
 * `typeof received` (NEVER the value) into `receivedType`. This is
 * defense-in-depth: even if a caller passes the value by mistake, only its
 * typeof is recorded.
 */
export interface FailureDetailInput {
  validatorReason?: McpBooleanObservationParseFailureReason;
  /** A structural field path; dropped unless it satisfies `isAllowedDetailPath`. */
  path?: string;
  /** A constant / enum literal the validator expects (e.g. 'mcp'). */
  expected?: string;
  /** The raw received value — the builder stores ONLY its `typeof`. */
  received?: unknown;
  /** An object whose KEY NAMES (not values) may be recorded, capped. */
  receivedKeysFrom?: unknown;
  /** A registry rawKey; dropped unless it is a known registry key. */
  checkedRawKey?: string;
  /** The schema version constant. */
  schemaVersion?: string;
  /** The family the request targeted. */
  family?: MachineObservationFamily;
  /** UNTRUSTED server-supplied error code; scrubbed + capped like `expected`. */
  serverReason?: string;
  /**
   * MCP-EGI-003 — closed-enum category derived via `mcpToolDetailToCategory()`
   * by the caller. The builder stores it only if it is a member of
   * `ALL_MCP_TOOL_DETAIL_CATEGORIES` (defense-in-depth).
   */
  detailCategory?: McpToolDetailCategory;
}

/**
 * Top-level field names that may appear bare in `detail.path` (backward-compat
 * pre-MCP-EGI-003 set) — these were the only structural anchors emitted by
 * the validator before MCP-EGI-003 widened the path allowlist to accept
 * dotted forms like `evidenceSpan.<rawKey>`.
 */
const ALLOWED_DETAIL_PATH_TOPS: ReadonlySet<string> = new Set([
  'schemaVersion',
  'nodeId',
  'checkedRawKeys',
  'observations',
  'confidence',
  'evidenceSpan',
  'modelInfo',
  'modelInfo.provider',
  'modelInfo.serverName',
  'modelInfo.classifierSetVersion',
]);

/**
 * MCP-EGI-003 — the dotted-path widening. Accepts `<top>.<identifier>` where
 * `<top>` is one of the structural maps the validator emits keys for, and
 * `<identifier>` is rawKey-shaped (`/^[A-Za-z][A-Za-z0-9_]{0,79}$/`). This
 * is the allow-list that lets `evidenceSpan.compares_options`,
 * `confidence.compares_options`, and `observations.<rawKey>` flow through
 * the row's `validator_path` field — which the MCP-EGI-004 canary proved
 * was the missing discriminator.
 *
 * The dotted form CANNOT smuggle a value because:
 *   1. `<identifier>` is identifier-shaped (no whitespace, no quotes, no
 *      raw text characters).
 *   2. `<identifier>` is capped at 80 chars (rawKey names are <= ~40).
 *   3. The structural-deny-list contract of `buildFailureDetail` (no
 *      free-text entry point) is unchanged — only the path STRING from the
 *      MCP server is widened; the server's own emit path is structural by
 *      construction (validator code in mcpBooleanObservationSchemaMirror.ts).
 */
const DOTTED_PATH_TOPS: ReadonlySet<string> = new Set([
  'evidenceSpan',
  'observations',
  'confidence',
]);
const DOTTED_PATH_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]{0,79}$/;

function isAllowedDetailPath(path: string): boolean {
  if (ALLOWED_DETAIL_PATH_TOPS.has(path)) return true;
  const dot = path.indexOf('.');
  if (dot <= 0) return false;
  const top = path.slice(0, dot);
  const rest = path.slice(dot + 1);
  if (!DOTTED_PATH_TOPS.has(top)) return false;
  if (rest.length === 0) return false;
  if (rest.includes('.')) return false; // single dot only — no nested traversal
  return DOTTED_PATH_IDENTIFIER.test(rest);
}

const MAX_RECEIVED_KEYS = 32;
const MAX_KEY_NAME_CHARS = 64;
const MAX_EXPECTED_PATH_CHARS = 200;
const MAX_SERIALIZED_DETAIL_CHARS = 2_000;

/**
 * Defense-in-depth secret-shape matchers. Each regex is assembled from
 * FRAGMENTS so this source carries no contiguous secret-shaped literal
 * (the SCAN-17 source-scan stays green). A string matching ANY of these is
 * dropped from `detail` rather than stored.
 */
const SECRET_SHAPE_MATCHERS: readonly RegExp[] = [
  new RegExp('sk' + '-ant-' + '[A-Za-z0-9_-]{6,}'),
  new RegExp('xai' + '-' + '[A-Za-z0-9]{6,}'),
  new RegExp('sb' + '_secret_' + '[A-Za-z0-9]{6,}'),
  // JWT triple.
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/,
  // Bearer scheme + token.
  new RegExp('Bea' + 'rer' + '\\s+[A-Za-z0-9._-]{8,}'),
  // Header / env names that should never ride a structural detail.
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
 * Reduce a raw value to the list of its OWN enumerable key NAMES (never
 * values), capped to MAX_RECEIVED_KEYS, each name capped to
 * MAX_KEY_NAME_CHARS and stripped to identifier-shaped `[A-Za-z0-9_]`
 * characters (a rawKey/field name is identifier-shaped; this prevents a
 * malicious key name from smuggling a body). A non-plain-object value
 * yields `undefined` (no keys to record).
 */
function deriveReceivedKeys(value: unknown): string[] | undefined {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return undefined;
  }
  const names = Object.keys(value as Record<string, unknown>);
  if (names.length === 0) return [];
  const out: string[] = [];
  for (const name of names.slice(0, MAX_RECEIVED_KEYS)) {
    const cleaned = name.replace(/[^A-Za-z0-9_]/g, '').slice(0, MAX_KEY_NAME_CHARS);
    out.push(cleaned);
  }
  return out;
}

/**
 * Build a SANITIZED, bounded BooleanObservationFailureDetail from named,
 * allowlisted structural fields. NEVER forwards free text. Returns
 * `undefined` when no safe fields are available (so the optional field
 * stays absent rather than empty).
 *
 * Mechanism (cdiscourse-doctrine §6):
 *   1. Read ONLY the named args (no free-text entry point).
 *   2. `path` kept only if in ALLOWED_DETAIL_PATHS; `checkedRawKey` kept
 *      only if a known registry key; `expected`/`path` truncated.
 *   3. `receivedType` is `typeof received` — never the value.
 *   4. `receivedKeys` are key NAMES only, capped + identifier-shaped.
 *   5. Defense-in-depth: drop any string field that trips a secret shape.
 *   6. Serialized-size cap (≤ 2000 chars) with graceful degradation:
 *      drop `receivedKeys` → truncate `path`/`expected` → fall back to
 *      `{ validatorReason, schemaVersion }`.
 */
export function buildFailureDetail(
  input: FailureDetailInput,
): BooleanObservationFailureDetail | undefined {
  const detail: BooleanObservationFailureDetail = {};

  if (input.validatorReason !== undefined) {
    detail.validatorReason = input.validatorReason;
  }

  if (typeof input.path === 'string' && isAllowedDetailPath(input.path)) {
    detail.path = input.path;
  }

  if (typeof input.expected === 'string' && !looksSecret(input.expected)) {
    detail.expected = input.expected.slice(0, MAX_EXPECTED_PATH_CHARS);
  }

  if ('received' in input) {
    // Store ONLY the typeof — never the value (defense-in-depth).
    detail.receivedType = typeof input.received;
  }

  if ('receivedKeysFrom' in input) {
    const keys = deriveReceivedKeys(input.receivedKeysFrom);
    if (keys !== undefined && keys.length > 0) {
      detail.receivedKeys = keys;
    }
  }

  if (
    typeof input.checkedRawKey === 'string' &&
    Object.prototype.hasOwnProperty.call(
      MACHINE_OBSERVATION_DEFINITIONS_BY_RAW_KEY,
      input.checkedRawKey,
    )
  ) {
    detail.checkedRawKey = input.checkedRawKey;
  }

  if (typeof input.schemaVersion === 'string' && !looksSecret(input.schemaVersion)) {
    detail.schemaVersion = input.schemaVersion.slice(0, MAX_EXPECTED_PATH_CHARS);
  }

  // OPS-MCP-RESULT-VALIDATION-BURST-HARDENING (Phase 3): the server's own
  // short error code off its `{ isError, reason }` envelope. UNTRUSTED —
  // forwarded with the SAME `looksSecret` scrub + 200-char cap as
  // `expected`/`schemaVersion` (NOT echoed raw, NOT the `detail` blob).
  if (typeof input.serverReason === 'string' && !looksSecret(input.serverReason)) {
    detail.serverReason = input.serverReason.slice(0, MAX_EXPECTED_PATH_CHARS);
  }

  // MCP-EGI-003: closed-enum category derived from the server's validator
  // `detail` string by the caller. Stored only if it is a member of the
  // declared enum (defense-in-depth — the caller already restricts it via
  // `mcpToolDetailToCategory()`, but a malformed input is dropped silently).
  if (
    typeof input.detailCategory === 'string' &&
    (ALL_MCP_TOOL_DETAIL_CATEGORIES as readonly string[]).includes(
      input.detailCategory,
    )
  ) {
    detail.detailCategory = input.detailCategory as McpToolDetailCategory;
  }

  if (input.family !== undefined) {
    detail.family = input.family;
  }

  // Defense-in-depth scrub: drop any string field that trips a secret
  // shape (path/expected/schemaVersion already partly guarded; this is a
  // final belt-and-suspenders pass, including receivedKeys names).
  if (detail.path !== undefined && looksSecret(detail.path)) {
    delete detail.path;
  }
  if (detail.expected !== undefined && looksSecret(detail.expected)) {
    delete detail.expected;
  }
  if (detail.schemaVersion !== undefined && looksSecret(detail.schemaVersion)) {
    delete detail.schemaVersion;
  }
  if (detail.serverReason !== undefined && looksSecret(detail.serverReason)) {
    delete detail.serverReason;
  }
  if (detail.checkedRawKey !== undefined && looksSecret(detail.checkedRawKey)) {
    delete detail.checkedRawKey;
  }
  if (detail.receivedKeys !== undefined) {
    const scrubbed = detail.receivedKeys.filter((k) => !looksSecret(k));
    if (scrubbed.length > 0) {
      detail.receivedKeys = scrubbed;
    } else {
      delete detail.receivedKeys;
    }
  }

  // No safe field survived → absent, not empty.
  if (Object.keys(detail).length === 0) return undefined;

  // Serialized-size cap with graceful degradation.
  if (serializedLength(detail) <= MAX_SERIALIZED_DETAIL_CHARS) {
    return detail;
  }
  // 1. Drop receivedKeys first.
  delete detail.receivedKeys;
  if (serializedLength(detail) <= MAX_SERIALIZED_DETAIL_CHARS) {
    return detail;
  }
  // 2. Truncate path / expected / serverReason to 200 chars each (already
  //    capped on entry, but re-apply defensively in case the budget is tight).
  if (typeof detail.path === 'string') {
    detail.path = detail.path.slice(0, MAX_EXPECTED_PATH_CHARS);
  }
  if (typeof detail.expected === 'string') {
    detail.expected = detail.expected.slice(0, MAX_EXPECTED_PATH_CHARS);
  }
  if (typeof detail.serverReason === 'string') {
    detail.serverReason = detail.serverReason.slice(0, MAX_EXPECTED_PATH_CHARS);
  }
  if (serializedLength(detail) <= MAX_SERIALIZED_DETAIL_CHARS) {
    return detail;
  }
  // 3. Last resort: validatorReason + schemaVersion only.
  const minimal: BooleanObservationFailureDetail = {};
  if (detail.validatorReason !== undefined) minimal.validatorReason = detail.validatorReason;
  if (detail.schemaVersion !== undefined) minimal.schemaVersion = detail.schemaVersion;
  if (Object.keys(minimal).length === 0) return undefined;
  return minimal;
}

/** Serialized length of a detail object; `0` when it cannot be stringified. */
function serializedLength(detail: BooleanObservationFailureDetail): number {
  try {
    return JSON.stringify(detail).length;
  } catch {
    return 0;
  }
}
