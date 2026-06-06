/**
 * OPS-ADMIN-CLASSIFIER-HEALTH-CONFIG-001 — Deno-clean twin of
 * `src/features/adminClassifierHealth/classifierHealthPlainLanguage.ts`.
 *
 * THE KEY DECOUPLING. The client `src/` original imports
 * `toPlainLanguage` from `../arguments/gameCopy`, which pulls the React-Native
 * client graph. That import is the transitive reason the cross-tree Edge import
 * fails to boot under Deno. This twin is SELF-CONTAINED: it resolves a reason
 * code ONLY against the panel-local transport map below — NO `gameCopy`, NO RN
 * dependency, NO extensionless import.
 *
 * Behavior parity with the client original:
 *   - The client resolution order is: (1) `gameCopy.toPlainLanguage(code)`
 *     wins, else (2) the panel-local transport map, else (3) `null`.
 *   - For the WHOLE realistic universe of classifier reason codes — the
 *     transport / lifecycle / validation codes in the map below — the gameCopy
 *     table returns `null`, so step (2) is what fires on BOTH sides; the twin
 *     is byte-identical there.
 *   - There is exactly ONE transport code that ALSO exists as a gameCopy key:
 *     `validation_failed_after_retries`. On the client, gameCopy WINS for it
 *     ("The move needs a clearer shape before it can play well."). To preserve
 *     parity, this twin's local map pins that one entry to the SAME gameCopy
 *     string (instead of the pre-shadow "Reply did not pass validation after
 *     retries"). A parity test asserts both sides agree on every transport code.
 *   - The only theoretical divergence is a NON-transport gameCopy-only code
 *     (e.g. `synthesis_ready`) appearing as a classifier reason: the client
 *     would surface the gameCopy label, this twin returns `null`. That is
 *     out-of-universe for `failure_reason / failure_sub_reason /
 *     dead_letter_reason / failure_detail.reason` (those carry transport codes,
 *     not game-move codes), AND the CLIENT re-derives plain-language on `null`
 *     at the render seam (`AdminClassifierHealthTab.tsx`:
 *     `bucket.plainLanguage ?? classifierHealthPlainLanguage(bucket.rawKey)`),
 *     so the displayed label is always the full client mapping regardless of
 *     what the Edge put on the bucket. The Edge's value only fully drives the
 *     CSV export.
 *
 * The map values are neutral transport/health descriptions. They carry NO
 * verdict token (winner / loser / liar / dishonest / true / false / correct /
 * bad faith / manipulative / extremist / propagandist / stupid / idiot) — the
 * ban-list test scans every value.
 *
 * Pure TS — no React, no Supabase, no fetch. Deno-loadable + Jest-loadable.
 */

/**
 * Panel-local plain-language labels for the classifier-transport reason codes.
 * Admin-facing operations diagnostics. Keys are the normalized (lowercase,
 * snake_case) reason codes.
 *
 * Parity note: `validation_failed_after_retries` is pinned to the gameCopy
 * string the client surfaces (gameCopy wins on the client). All other entries
 * mirror the client `CLASSIFIER_TRANSPORT_PLAIN_LANGUAGE` exactly.
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
  // Parity pin: gameCopy wins on the client for this code (see header).
  validation_failed_after_retries: 'The move needs a clearer shape before it can play well.',
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
