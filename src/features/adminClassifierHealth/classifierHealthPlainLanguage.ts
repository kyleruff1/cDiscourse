/**
 * OPS-MCP-OBSERVABILITY-002 — plain-language mapping for classifier-health
 * reason codes (cdiscourse-doctrine §9).
 *
 * Resolution order for a reason / sub-reason / failure_detail.reason code:
 *   1. `gameCopy.toPlainLanguage(code)` — the shared, test-enforced map. Wins
 *      when the code is a known game-copy code.
 *   2. A panel-local ADMIN map for the classifier-transport codes that are
 *      NOT in gameCopy (they are operations diagnostics, never normal-user
 *      surfaces — e.g. `mcp_api_error`, `provider_server_error`). This is an
 *      admin-only surface (§9 lets admin see the raw code accompany the label;
 *      this map provides the operator-facing label).
 *   3. `null` — unknown code → SUPPRESSED, never echoed as a raw snake_case
 *      string to the operator-facing render.
 *
 * The map values are neutral transport/health descriptions. They carry NO
 * verdict token (winner / loser / liar / dishonest / true / false / correct /
 * bad faith / manipulative / extremist / propagandist / stupid / idiot) — the
 * ban-list test scans every value.
 *
 * Pure TS — no React, no Supabase, no fetch, no Deno. Jest-loadable.
 */
import { toPlainLanguage } from '../arguments/gameCopy';

/**
 * Panel-local plain-language labels for the classifier-transport reason codes
 * that are NOT carried by `gameCopy`. Admin-facing operations diagnostics.
 * Keys are the normalized (lowercase, snake_case) reason codes.
 */
const CLASSIFIER_TRANSPORT_PLAIN_LANGUAGE: Readonly<Record<string, string>> = Object.freeze({
  // ── Provider transport failures ──────────────────────────────
  mcp_api_error: 'Classifier service returned an error',
  mcp_network_error: 'Could not reach the classifier service',
  mcp_parse_failure: 'Classifier reply could not be read',
  mcp_rate_limited: 'Classifier service was rate-limited',
  mcp_token_missing: 'Classifier service access token is not configured',
  mcp_url_missing: 'Classifier service address is not configured',
  mcp_validation_failed: 'Classifier reply did not match the expected shape',
  provider_api_error: 'Provider returned an error',
  provider_network_error: 'Could not reach the provider',
  provider_rate_limited: 'Provider was rate-limited',
  provider_server_error: 'Provider reported a server error',
  provider_timeout: 'Provider did not respond in time',
  provider_key: 'Provider access key is not configured',
  network_error: 'Network error reaching the service',
  api_error: 'Service returned an error',
  rate_limited: 'Service was rate-limited',
  parse_failure: 'Reply could not be read',
  token_missing: 'Access token is not configured',
  url_missing: 'Service address is not configured',
  key_missing: 'Access key is not configured',
  not_configured: 'Not configured',
  timeout: 'Timed out waiting for a reply',
  // ── Lifecycle / queue states ─────────────────────────────────
  dead_letter: 'Gave up after repeated failures',
  retry_attempts_exhausted: 'Gave up after repeated retries',
  validation_failed: 'Reply did not pass validation',
  validation_failed_after_retries: 'Reply did not pass validation after retries',
  wrong_shape: 'Reply had the wrong shape',
  wrong_schema_version: 'Reply used an unexpected schema version',
  not_json: 'Reply was not valid JSON',
  missing_required_field: 'Reply was missing a required field',
  flag_count_too_high: 'Reply had too many flags',
  duplicate_node_id: 'Reply repeated an entry id',
  // ── Request-side validation (input subset / family / raw key) ─
  request_invalid_source_subset: 'Request used an unsupported source subset',
  request_unsupported_family: 'Request named an unsupported family',
  request_unsupported_raw_key: 'Request named an unsupported entry key',
  // ── Response-side validation ─────────────────────────────────
  response_ban_list_violation: 'Reply tripped the safety word list',
  response_evidence_span_invalid: 'Reply referenced an invalid span',
  response_flag_count_too_high: 'Reply had too many flags',
  response_missing_required_field: 'Reply was missing a required field',
  response_not_json: 'Reply was not valid JSON',
  response_wrong_schema_version: 'Reply used an unexpected schema version',
  response_wrong_shape: 'Reply had the wrong shape',
});

/** Normalize a code the same way gameCopy does (lowercase, snake_case). */
function normalizeCode(code: string): string {
  return code.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * Resolve a classifier-health reason code to its operator-facing plain
 * language. Returns `null` for an unknown code (SUPPRESSED — never echo the
 * raw snake_case to the operator-facing label). Case-insensitive.
 */
export function classifierHealthPlainLanguage(
  code: string | null | undefined,
): string | null {
  if (!code) return null;
  const fromGameCopy = toPlainLanguage(code);
  if (fromGameCopy !== null) return fromGameCopy;
  const key = normalizeCode(code);
  if (Object.prototype.hasOwnProperty.call(CLASSIFIER_TRANSPORT_PLAIN_LANGUAGE, key)) {
    return CLASSIFIER_TRANSPORT_PLAIN_LANGUAGE[key];
  }
  return null;
}

/** Every panel-local transport code (for the ban-list / coverage tests). */
export const CLASSIFIER_TRANSPORT_CODES: ReadonlyArray<string> = Object.freeze(
  Object.keys(CLASSIFIER_TRANSPORT_PLAIN_LANGUAGE),
);

/** Every panel-local plain-language value (for the ban-list scan). */
export const CLASSIFIER_TRANSPORT_LABELS: ReadonlyArray<string> = Object.freeze(
  Object.values(CLASSIFIER_TRANSPORT_PLAIN_LANGUAGE),
);
