#!/usr/bin/env bash
# MCP-SERVER-001 — local smoke script (extended by MCP-SERVER-002 + MCP-SERVER-003-FAMILY-B + MCP-SERVER-004-FAMILY-C + MCP-SERVER-005-FAMILY-D + MCP-SERVER-006-FAMILY-E + MCP-SERVER-007-FAMILY-F + MCP-SERVER-008-FAMILY-G + MCP-SERVER-009-FAMILY-H + MCP-SERVER-010-FAMILY-I + OPS-DENO-GOLIVE-PILOT Build-2b Family-B + Family-A + Build-2c Family-C + Build-2e Family-E + Build-2f Family-F + Build-2d Family-D new-key proof).
#
# Verifies the deployed (or locally-running) MCP server against the 37 checks:
#   - Checks 1-9: MCP-SERVER-001 + MCP-SERVER-002 (Family A coverage)
#   - Checks 10-11: MCP-SERVER-003-FAMILY-B (Family B coverage)
#   - Checks 12-13: MCP-SERVER-004-FAMILY-C (Family C coverage)
#   - Checks 14-15: MCP-SERVER-005-FAMILY-D (Family D 19-key Subset
#                   coverage — evidence_source_chain)
#   - Checks 16-17: MCP-SERVER-006-FAMILY-E (Family E 16 Walton schemes
#                   coverage — argument_scheme)
#   - Checks 18-19: MCP-SERVER-007-FAMILY-F (Family F 14 Walton/Toulmin/
#                   Peirce critical questions — critical_question)
#   - Checks 20-21: MCP-SERVER-008-FAMILY-G (Family G 18-key ai_classifier
#                   Subset — resolution_progress; descriptive convergence-state,
#                   never a verdict)
#   - Checks 22-23: MCP-SERVER-009-FAMILY-H (Family H 12-key ai_classifier
#                   uniform set — claim_clarity; descriptive formulation-state,
#                   never a quality verdict)
#   - Checks 24-25: MCP-SERVER-010-FAMILY-I (Family I 6-key ai_classifier
#                   mixed-source Subset — thread_topology; descriptive structure
#                   about how a move relates to the conversation graph, never
#                   a verdict)
#   - Checks 26-27: OPS-DENO-GOLIVE Build-2b Family-B new-key proof
#                   (isolates_main_disagreement,
#                   distinguishes_fact_value_disagreement,
#                   preserves_face_while_disagreeing) — merged-≠-live harness
#   - Checks 28-29: OPS-DENO-GOLIVE Build-2b Family-A new-key proof
#                   (acknowledges_parent_strength,
#                   compares_parent_to_sibling_branch,
#                   identifies_parent_scope_limit) — merged-≠-live harness
#   - Checks 30-31: OPS-DENO-GOLIVE Build-2c Family-C new-key proof
#                   (offers_repair_path,
#                   names_ambiguity_source,
#                   accepts_correction) — merged-≠-live harness
#   - Checks 32-33: OPS-DENO-GOLIVE Build-2e Family-E new-key proof
#                   (linked_premise_structure,
#                   convergent_premise_structure,
#                   enthymeme_gap_detected) — merged-≠-live harness
#   - Checks 34-35: OPS-DENO-GOLIVE Build-2f Family-F new-key proof
#                   (question_names_uncertainty,
#                   question_separates_claim_evidence,
#                   question_invites_revision) — merged-≠-live harness
#   - Checks 36-37: OPS-DENO-GOLIVE Build-2d Family-D new-key proof
#                   (names_method_difference,
#                   separates_observation_from_inference,
#                   flags_context_limit) — merged-≠-live harness; these DIRECT-
#                   Deno checks request only the 3 NEW keys (≤20), bypassing the
#                   Edge 2-batch split (correct: any ≤20-key subset is one request)
#
# Usage:
#   bash scripts/mcp-server-001-smoke.sh --base-url <url> --token <bearer> [--verbose]
#
# Arguments:
#   --base-url    Server URL. e.g. http://localhost:8080 or
#                 https://<deployed>.deno.dev
#   --token       Bearer token matching the server's MCP_SERVER_BEARER_TOKEN.
#   --verbose     Optional. Print per-check diagnostics.
#
# Exit codes:
#   0 — all 37 checks passed
#   1 — at least one check failed; the script prints which.
#   2 — invalid arguments
#
# Doctrine:
#   - The script NEVER prints the bearer-token argument value verbatim — only
#     a redacted "[REDACTED]" placeholder on diagnostic output.
#   - The script does NOT need an Anthropic API key. The
#     `classify_semantic_move` check works against the server's fixture
#     provider when `MCP_SERVER_USE_FIXTURE_PROVIDER=true`. The Family A
#     boolean tool (Checks 5 + 9), Family B boolean tool (Checks 10 + 11),
#     Family C boolean tool (Checks 12 + 13), Family D boolean tool
#     (Checks 14 + 15), Family E boolean tool (Checks 16 + 17), Family F
#     boolean tool (Checks 18 + 19), Family G boolean tool
#     (Checks 20 + 21), AND Family H boolean tool (Checks 22 + 23) ALSO work
#     against the fixture provider when the same env is set.
#     Real Anthropic calls happen ONLY in production (when the env is not
#     set AND ANTHROPIC_API_KEY is present).

set -u
set -o pipefail

BASE_URL=""
TOKEN=""
VERBOSE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --base-url)
      BASE_URL="$2"
      shift 2
      ;;
    --token)
      TOKEN="$2"
      shift 2
      ;;
    --verbose)
      VERBOSE=1
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 --base-url <url> --token <bearer> [--verbose]" >&2
      exit 2
      ;;
  esac
done

if [[ -z "$BASE_URL" ]]; then
  echo "Missing required --base-url" >&2
  exit 2
fi
if [[ -z "$TOKEN" ]]; then
  echo "Missing required --token" >&2
  exit 2
fi

FAILS=0
PASSES=0

note() {
  if [[ "$VERBOSE" == "1" ]]; then
    echo "  $1"
  fi
}

pass() {
  echo "PASS [$1]"
  PASSES=$((PASSES + 1))
}

fail() {
  echo "FAIL [$1] $2"
  FAILS=$((FAILS + 1))
}

http_request() {
  # http_request <method> <path> <expected_status> [auth_token_or_empty] [body_or_empty]
  local method="$1"
  local path="$2"
  local expected="$3"
  local auth="${4:-}"
  local body="${5:-}"

  local response_file
  response_file="$(mktemp)"
  local status_file
  status_file="$(mktemp)"
  local headers_file
  headers_file="$(mktemp)"

  if [[ -n "$auth" ]]; then
    if [[ -n "$body" ]]; then
      curl --silent --show-error --output "$response_file" --dump-header "$headers_file" \
        --write-out '%{http_code}' \
        -H "Authorization: Bearer $auth" \
        -H "Content-Type: application/json" \
        --request "$method" \
        --data "$body" \
        "$BASE_URL$path" > "$status_file" 2>&1 || true
    else
      curl --silent --show-error --output "$response_file" --dump-header "$headers_file" \
        --write-out '%{http_code}' \
        -H "Authorization: Bearer $auth" \
        --request "$method" \
        "$BASE_URL$path" > "$status_file" 2>&1 || true
    fi
  else
    if [[ -n "$body" ]]; then
      curl --silent --show-error --output "$response_file" --dump-header "$headers_file" \
        --write-out '%{http_code}' \
        -H "Content-Type: application/json" \
        --request "$method" \
        --data "$body" \
        "$BASE_URL$path" > "$status_file" 2>&1 || true
    else
      curl --silent --show-error --output "$response_file" --dump-header "$headers_file" \
        --write-out '%{http_code}' \
        --request "$method" \
        "$BASE_URL$path" > "$status_file" 2>&1 || true
    fi
  fi

  local status
  status="$(cat "$status_file" | tr -d '\r\n')"
  local response_body
  response_body="$(cat "$response_file")"

  rm -f "$response_file" "$status_file" "$headers_file"

  if [[ -n "$expected" && "$status" != "$expected" ]]; then
    echo "STATUS_MISMATCH expected=$expected actual=$status body=$response_body"
    return 1
  fi
  echo "$response_body"
  return 0
}

contains() {
  # contains <haystack> <needle> — returns 0 if needle in haystack.
  case "$1" in
    *"$2"*) return 0 ;;
    *) return 1 ;;
  esac
}

echo "MCP-SERVER-001 smoke against: $BASE_URL"
echo "Token: [REDACTED]"
echo

# ── Check 1: GET /health (unauthenticated) ──────────────────────────
CHECK_NAME="1-health"
note "GET $BASE_URL/health (no auth)"
HEALTH_RESPONSE="$(http_request GET /health 200 '' '')"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$HEALTH_RESPONSE"
else
  if contains "$HEALTH_RESPONSE" '"status":"ok"' \
     && contains "$HEALTH_RESPONSE" '"supportedTools"' \
     && contains "$HEALTH_RESPONSE" 'classify_semantic_move' \
     && contains "$HEALTH_RESPONSE" 'classify_argument_boolean_observations' \
     && contains "$HEALTH_RESPONSE" '"credentialsConfigured":true'; then
    pass "$CHECK_NAME"
  else
    fail "$CHECK_NAME" "Missing expected health field. Got: $HEALTH_RESPONSE"
  fi
fi

# ── Check 2: POST /mcp/adapter-compat without Authorization ──────────
CHECK_NAME="2-compat-no-auth"
note "POST $BASE_URL/mcp/adapter-compat (no auth)"
RESPONSE="$(http_request POST /mcp/adapter-compat 401 '' '{"tool":"classify_semantic_move","input":{}}')"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" 'unauthorized'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected unauthorized envelope. Got: $RESPONSE"
fi

# ── Check 3: POST /mcp/adapter-compat with WRONG Authorization ───────
CHECK_NAME="3-compat-bad-token"
note "POST $BASE_URL/mcp/adapter-compat (wrong token)"
RESPONSE="$(http_request POST /mcp/adapter-compat 401 'wrong-token-xyz' '{"tool":"classify_semantic_move","input":{}}')"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" 'unauthorized'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected unauthorized envelope. Got: $RESPONSE"
fi

# ── Check 4: POST /mcp/adapter-compat with VALID bearer + semantic move ──
CHECK_NAME="4-compat-semantic-move"
COMPAT_REQUEST='{"tool":"classify_semantic_move","input":{"moveBodyRedacted":"[fixture] sample","parentBodyRedacted":"[fixture] parent","roomContext":{"side":"affirmative","actorRole":"primary_opponent"},"requestedClassifiers":["responds_to_parent"],"contentHash":"fixture-content-hash-mainline","roomId":"fixture-room-mainline"}}'
note "POST $BASE_URL/mcp/adapter-compat (valid)"
RESPONSE="$(http_request POST /mcp/adapter-compat 200 "$TOKEN" "$COMPAT_REQUEST")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"result"' \
     && contains "$RESPONSE" '"binaries"' \
     && contains "$RESPONSE" '"routeSuggestion"' \
     && contains "$RESPONSE" '"scoreHints"'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected SemanticRefereePacket structural subset. Got: $RESPONSE"
fi

# ── Check 5: POST /mcp/adapter-compat with VALID bearer + boolean (real Family A) ──
# MCP-SERVER-002 promoted this tool from scaffold to real. The request body now uses
# Family A rawKeys (parent_relation family). Response shape MUST be a real
# McpBooleanObservationResponse per the MCP-021A schema:
#   - schemaVersion: 'mcp-021.machine-observations.boolean.v1'
#   - observations is an object of booleans
#   - confidence is an object of low|medium|high
#   - modelInfo.classifierSetVersion is 'family-a-v1'
# The smoke runs against either a real Anthropic key OR the fixture provider
# (MCP_SERVER_USE_FIXTURE_PROVIDER=true). Either way the response shape is the same.
CHECK_NAME="5-compat-boolean-family-a"
BOOLEAN_REQUEST='{"tool":"classify_argument_boolean_observations","input":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-001","parentNodeId":null,"currentText":"[fixture] body","parentText":null,"threadContextExcerpt":"[fixture] thread","requestedFamilies":["parent_relation"],"requestedRawKeys":["supports_parent","challenges_parent"],"definitions":{},"timeoutMs":12000}}'
note "POST $BASE_URL/mcp/adapter-compat (boolean Family A)"
RESPONSE="$(http_request POST /mcp/adapter-compat 200 "$TOKEN" "$BOOLEAN_REQUEST")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-a-v1"'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected real Family A response shape. Got: $RESPONSE"
fi

# ── Check 6: POST /mcp with VALID bearer + initialize ──────────────
CHECK_NAME="6-mcp-initialize"
INITIALIZE_BODY='{"jsonrpc":"2.0","id":"smoke-init-1","method":"initialize","params":{}}'
note "POST $BASE_URL/mcp (initialize)"
RESPONSE="$(http_request POST /mcp 200 "$TOKEN" "$INITIALIZE_BODY")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"protocolVersion":"2025-11-25"' \
     && contains "$RESPONSE" 'cdiscourse-mcp-server'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected initialize result with protocol version. Got: $RESPONSE"
fi

# ── Check 7: POST /mcp with VALID bearer + tools/list ──────────────
CHECK_NAME="7-mcp-tools-list"
TOOLS_LIST_BODY='{"jsonrpc":"2.0","id":"smoke-list-1","method":"tools/list","params":{}}'
note "POST $BASE_URL/mcp (tools/list)"
RESPONSE="$(http_request POST /mcp 200 "$TOKEN" "$TOOLS_LIST_BODY")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" 'classify_semantic_move' \
     && contains "$RESPONSE" 'classify_argument_boolean_observations'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected both tool names in tools/list. Got: $RESPONSE"
fi

# ── Check 8: POST /mcp tools/call classify_semantic_move ─────────
CHECK_NAME="8-mcp-tools-call-semantic"
SEMANTIC_CALL_BODY='{"jsonrpc":"2.0","id":"smoke-call-1","method":"tools/call","params":{"name":"classify_semantic_move","arguments":{"moveBodyRedacted":"[fixture] sample","parentBodyRedacted":"[fixture] parent","roomContext":{"side":"affirmative","actorRole":"primary_opponent"},"requestedClassifiers":["responds_to_parent"],"contentHash":"fixture-content-hash-mainline","roomId":"fixture-room-mainline"}}}'
note "POST $BASE_URL/mcp (tools/call classify_semantic_move)"
RESPONSE="$(http_request POST /mcp 200 "$TOKEN" "$SEMANTIC_CALL_BODY")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"structuredContent"' \
     && contains "$RESPONSE" '"content"' \
     && contains "$RESPONSE" '"binaries"' \
     && contains "$RESPONSE" '"isError":false'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected structured tool result. Got: $RESPONSE"
fi

# ── Check 9: POST /mcp tools/call classify_argument_boolean_observations (Family A) ──
# MCP-SERVER-002 promoted this tool from scaffold to real. Same body + same assertion
# pattern as Check 5, but via the official MCP /mcp endpoint with JSON-RPC envelope.
CHECK_NAME="9-mcp-tools-call-boolean-family-a"
BOOLEAN_CALL_BODY='{"jsonrpc":"2.0","id":"smoke-call-2","method":"tools/call","params":{"name":"classify_argument_boolean_observations","arguments":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-001","parentNodeId":null,"currentText":"[fixture] body","parentText":null,"threadContextExcerpt":"[fixture] thread","requestedFamilies":["parent_relation"],"requestedRawKeys":["supports_parent","challenges_parent"],"definitions":{},"timeoutMs":12000}}}'
note "POST $BASE_URL/mcp (tools/call classify_argument_boolean_observations Family A)"
RESPONSE="$(http_request POST /mcp 200 "$TOKEN" "$BOOLEAN_CALL_BODY")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-a-v1"' \
     && contains "$RESPONSE" '"isError":false'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected real Family A tool result. Got: $RESPONSE"
fi

# ── Check 10: POST /mcp/adapter-compat with VALID bearer + boolean (Family B) ──
# MCP-SERVER-003-FAMILY-B promoted Family B from unsupported to real. The
# request body uses Family B rawKeys (disagreement_axis family). Response
# shape MUST be a real McpBooleanObservationResponse per the MCP-021A schema:
#   - schemaVersion: 'mcp-021.machine-observations.boolean.v1'
#   - observations is an object of booleans (14 keys for Family B canonical)
#   - confidence is an object of low|medium|high
#   - modelInfo.classifierSetVersion is 'family-b-v1'
CHECK_NAME="10-compat-boolean-family-b"
BOOLEAN_B_REQUEST='{"tool":"classify_argument_boolean_observations","input":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-b-001","parentNodeId":"fixture-node-parent-b-001","currentText":"[fixture] You are defining infrastructure to exclude branch libraries — that definition prejudges the conclusion.","parentText":"[fixture] Library funding should support infrastructure.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["disagreement_axis"],"requestedRawKeys":["disagreement_present","disputes_definition","disputes_scope"],"definitions":{},"timeoutMs":12000}}'
note "POST $BASE_URL/mcp/adapter-compat (boolean Family B)"
RESPONSE="$(http_request POST /mcp/adapter-compat 200 "$TOKEN" "$BOOLEAN_B_REQUEST")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-b-v1"'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected real Family B response shape. Got: $RESPONSE"
fi

# ── Check 11: POST /mcp tools/call classify_argument_boolean_observations (Family B) ──
# MCP-SERVER-003-FAMILY-B. Same body + same assertion pattern as Check 10,
# but via the official MCP /mcp endpoint with JSON-RPC envelope.
CHECK_NAME="11-mcp-tools-call-boolean-family-b"
BOOLEAN_B_CALL_BODY='{"jsonrpc":"2.0","id":"smoke-call-3","method":"tools/call","params":{"name":"classify_argument_boolean_observations","arguments":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-b-001","parentNodeId":"fixture-node-parent-b-001","currentText":"[fixture] You are defining infrastructure to exclude branch libraries — that definition prejudges the conclusion.","parentText":"[fixture] Library funding should support infrastructure.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["disagreement_axis"],"requestedRawKeys":["disagreement_present","disputes_definition","disputes_scope"],"definitions":{},"timeoutMs":12000}}}'
note "POST $BASE_URL/mcp (tools/call classify_argument_boolean_observations Family B)"
RESPONSE="$(http_request POST /mcp 200 "$TOKEN" "$BOOLEAN_B_CALL_BODY")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-b-v1"' \
     && contains "$RESPONSE" '"isError":false'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected real Family B tool result. Got: $RESPONSE"
fi

# ── Check 12: POST /mcp/adapter-compat with VALID bearer + boolean (Family C) ──
# MCP-SERVER-004-FAMILY-C promoted Family C from unsupported to real. The request body
# uses Family C rawKeys (misunderstanding_repair family). Response shape MUST be a
# real McpBooleanObservationResponse per the MCP-021A schema:
#   - schemaVersion: 'mcp-021.machine-observations.boolean.v1'
#   - observations is an object of booleans (17 keys for Family C canonical)
#   - confidence is an object of low|medium|high
#   - modelInfo.classifierSetVersion is 'family-c-v1'
CHECK_NAME="12-compat-boolean-family-c"
BOOLEAN_C_REQUEST='{"tool":"classify_argument_boolean_observations","input":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-c-001","parentNodeId":"fixture-node-parent-c-001","currentText":"[fixture] Are you saying libraries are public goods that should be funded like roads? — let me make sure I have you right.","parentText":"[fixture] Libraries are infrastructure.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["misunderstanding_repair"],"requestedRawKeys":["offers_candidate_understanding","confirms_understanding","rejects_candidate_understanding"],"definitions":{},"timeoutMs":12000}}'
note "POST $BASE_URL/mcp/adapter-compat (boolean Family C)"
RESPONSE="$(http_request POST /mcp/adapter-compat 200 "$TOKEN" "$BOOLEAN_C_REQUEST")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-c-v1"'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected real Family C response shape. Got: $RESPONSE"
fi

# ── Check 13: POST /mcp tools/call classify_argument_boolean_observations (Family C) ──
# MCP-SERVER-004-FAMILY-C. Same body + same assertion pattern as Check 12, but via
# the official MCP /mcp endpoint with JSON-RPC envelope.
CHECK_NAME="13-mcp-tools-call-boolean-family-c"
BOOLEAN_C_CALL_BODY='{"jsonrpc":"2.0","id":"smoke-call-4","method":"tools/call","params":{"name":"classify_argument_boolean_observations","arguments":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-c-001","parentNodeId":"fixture-node-parent-c-001","currentText":"[fixture] Are you saying libraries are public goods that should be funded like roads? — let me make sure I have you right.","parentText":"[fixture] Libraries are infrastructure.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["misunderstanding_repair"],"requestedRawKeys":["offers_candidate_understanding","confirms_understanding","rejects_candidate_understanding"],"definitions":{},"timeoutMs":12000}}}'
note "POST $BASE_URL/mcp (tools/call classify_argument_boolean_observations Family C)"
RESPONSE="$(http_request POST /mcp 200 "$TOKEN" "$BOOLEAN_C_CALL_BODY")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-c-v1"' \
     && contains "$RESPONSE" '"isError":false'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected real Family C tool result. Got: $RESPONSE"
fi

# ── Check 14: POST /mcp/adapter-compat with VALID bearer + boolean (Family D) ──
# MCP-SERVER-005-FAMILY-D promoted Family D from unsupported to real (19-key
# ai_classifier Subset per Stage 2B operator decision). The request body uses
# Family D Subset rawKeys (evidence_source_chain family). Response shape MUST
# be a real McpBooleanObservationResponse per the MCP-021A schema:
#   - schemaVersion: 'mcp-021.machine-observations.boolean.v1'
#   - observations is an object of booleans (19 keys for Family D Subset)
#   - confidence is an object of low|medium|high
#   - modelInfo.classifierSetVersion is 'family-d-v1'
CHECK_NAME="14-compat-boolean-family-d"
BOOLEAN_D_REQUEST='{"tool":"classify_argument_boolean_observations","input":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-d-001","parentNodeId":"fixture-node-parent-d-001","currentText":"[fixture] Per the 2024 EPA report Table 3.1, urban EV-heavy cities show a 40% drop in tailpipe emissions from 2020 to 2023.","parentText":"[fixture] EVs reduce emissions in cities.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["evidence_source_chain"],"requestedRawKeys":["source_provided","provides_evidence","statistic_used"],"definitions":{},"timeoutMs":12000}}'
note "POST $BASE_URL/mcp/adapter-compat (boolean Family D)"
RESPONSE="$(http_request POST /mcp/adapter-compat 200 "$TOKEN" "$BOOLEAN_D_REQUEST")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-d-v1"'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected real Family D response shape. Got: $RESPONSE"
fi

# ── Check 15: POST /mcp tools/call classify_argument_boolean_observations (Family D) ──
# MCP-SERVER-005-FAMILY-D. Same body + same assertion pattern as Check 14, but via
# the official MCP /mcp endpoint with JSON-RPC envelope.
CHECK_NAME="15-mcp-tools-call-boolean-family-d"
BOOLEAN_D_CALL_BODY='{"jsonrpc":"2.0","id":"smoke-call-5","method":"tools/call","params":{"name":"classify_argument_boolean_observations","arguments":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-d-001","parentNodeId":"fixture-node-parent-d-001","currentText":"[fixture] Per the 2024 EPA report Table 3.1, urban EV-heavy cities show a 40% drop in tailpipe emissions from 2020 to 2023.","parentText":"[fixture] EVs reduce emissions in cities.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["evidence_source_chain"],"requestedRawKeys":["source_provided","provides_evidence","statistic_used"],"definitions":{},"timeoutMs":12000}}}'
note "POST $BASE_URL/mcp (tools/call classify_argument_boolean_observations Family D)"
RESPONSE="$(http_request POST /mcp 200 "$TOKEN" "$BOOLEAN_D_CALL_BODY")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-d-v1"' \
     && contains "$RESPONSE" '"isError":false'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected real Family D tool result. Got: $RESPONSE"
fi

# ── Check 16: POST /mcp/adapter-compat with VALID bearer + boolean (Family E) ──
# MCP-SERVER-006-FAMILY-E promoted Family E from unsupported to real. The request
# body uses Family E rawKeys (argument_scheme family). Response shape MUST be a
# real McpBooleanObservationResponse per the MCP-021A schema:
#   - schemaVersion: 'mcp-021.machine-observations.boolean.v1'
#   - observations is an object of booleans (16 keys for Family E canonical)
#   - confidence is an object of low|medium|high
#   - modelInfo.classifierSetVersion is 'family-e-v1'
CHECK_NAME="16-compat-boolean-family-e"
BOOLEAN_E_REQUEST='{"tool":"classify_argument_boolean_observations","input":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-e-001","parentNodeId":"fixture-node-parent-e-001","currentText":"[fixture] If we approve this regulation, agencies will start defining acceptable speech for one category, then a second, then a third — until we have arrived at full-scope content suppression.","parentText":"[fixture] A targeted regulation against fraudulent product claims has been proposed.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["argument_scheme"],"requestedRawKeys":["slippery_slope_reasoning_present","consequence_reasoning_present","causal_reasoning_present"],"definitions":{},"timeoutMs":12000}}'
note "POST $BASE_URL/mcp/adapter-compat (boolean Family E)"
RESPONSE="$(http_request POST /mcp/adapter-compat 200 "$TOKEN" "$BOOLEAN_E_REQUEST")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-e-v1"'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected real Family E response shape. Got: $RESPONSE"
fi

# ── Check 17: POST /mcp tools/call classify_argument_boolean_observations (Family E) ──
# MCP-SERVER-006-FAMILY-E. Same body + same assertion pattern as Check 16, but via
# the official MCP /mcp endpoint with JSON-RPC envelope.
CHECK_NAME="17-mcp-tools-call-boolean-family-e"
BOOLEAN_E_CALL_BODY='{"jsonrpc":"2.0","id":"smoke-call-6","method":"tools/call","params":{"name":"classify_argument_boolean_observations","arguments":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-e-001","parentNodeId":"fixture-node-parent-e-001","currentText":"[fixture] If we approve this regulation, agencies will start defining acceptable speech for one category, then a second, then a third — until we have arrived at full-scope content suppression.","parentText":"[fixture] A targeted regulation against fraudulent product claims has been proposed.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["argument_scheme"],"requestedRawKeys":["slippery_slope_reasoning_present","consequence_reasoning_present","causal_reasoning_present"],"definitions":{},"timeoutMs":12000}}}'
note "POST $BASE_URL/mcp (tools/call classify_argument_boolean_observations Family E)"
RESPONSE="$(http_request POST /mcp 200 "$TOKEN" "$BOOLEAN_E_CALL_BODY")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-e-v1"' \
     && contains "$RESPONSE" '"isError":false'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected real Family E tool result. Got: $RESPONSE"
fi

# ── Check 18: POST /mcp/adapter-compat with VALID bearer + boolean (Family F) ──
# MCP-SERVER-007-FAMILY-F promoted Family F (critical_question) from unsupported
# to real. The request body uses Family F rawKeys. Response shape MUST be a
# real McpBooleanObservationResponse per the MCP-021A schema:
#   - schemaVersion: 'mcp-021.machine-observations.boolean.v1'
#   - observations is an object of booleans (14 keys for Family F canonical)
#   - confidence is an object of low|medium|high
#   - modelInfo.classifierSetVersion is 'family-f-v1'
# DOCTRINE: critical questions are descriptive structural probes on absence/gap;
# an unmet CQ NEVER means the partner Family E scheme is a fallacy.
CHECK_NAME="18-compat-boolean-family-f"
BOOLEAN_F_REQUEST='{"tool":"classify_argument_boolean_observations","input":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-f-001","parentNodeId":"fixture-node-parent-f-001","currentText":"[fixture] If we permit this regulation to pass, government agencies will start defining acceptable speech for one category. Once they do that, they will expand to a second category, then a third, then a fourth — until we have arrived at full-scope content suppression, with no clear stopping point along the way.","parentText":"[fixture] A targeted regulation against fraudulent product claims has been proposed.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["critical_question"],"requestedRawKeys":["consequence_probability_unclear","missing_warrant","alternative_explanation_available"],"definitions":{},"timeoutMs":12000}}'
note "POST $BASE_URL/mcp/adapter-compat (boolean Family F)"
RESPONSE="$(http_request POST /mcp/adapter-compat 200 "$TOKEN" "$BOOLEAN_F_REQUEST")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-f-v1"'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected real Family F response shape. Got: $RESPONSE"
fi

# ── Check 19: POST /mcp tools/call classify_argument_boolean_observations (Family F) ──
# MCP-SERVER-007-FAMILY-F. Same body + same assertion pattern as Check 18, but via
# the official MCP /mcp endpoint with JSON-RPC envelope.
CHECK_NAME="19-mcp-tools-call-boolean-family-f"
BOOLEAN_F_CALL_BODY='{"jsonrpc":"2.0","id":"smoke-call-7","method":"tools/call","params":{"name":"classify_argument_boolean_observations","arguments":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-f-001","parentNodeId":"fixture-node-parent-f-001","currentText":"[fixture] If we permit this regulation to pass, government agencies will start defining acceptable speech for one category. Once they do that, they will expand to a second category, then a third, then a fourth — until we have arrived at full-scope content suppression, with no clear stopping point along the way.","parentText":"[fixture] A targeted regulation against fraudulent product claims has been proposed.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["critical_question"],"requestedRawKeys":["consequence_probability_unclear","missing_warrant","alternative_explanation_available"],"definitions":{},"timeoutMs":12000}}}'
note "POST $BASE_URL/mcp (tools/call classify_argument_boolean_observations Family F)"
RESPONSE="$(http_request POST /mcp 200 "$TOKEN" "$BOOLEAN_F_CALL_BODY")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-f-v1"' \
     && contains "$RESPONSE" '"isError":false'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected real Family F tool result. Got: $RESPONSE"
fi

# ── Check 20: POST /mcp/adapter-compat with VALID bearer + boolean (Family G) ──
# MCP-SERVER-008-FAMILY-G promoted Family G (resolution_progress) from
# unsupported to real (18-key ai_classifier Subset; the 12 deterministic
# auto_metadata + lifecycle keys are excluded). The request body uses Family G
# rawKeys with a benign resolution-progress move. Response shape MUST be a real
# McpBooleanObservationResponse per the MCP-021A schema:
#   - schemaVersion: 'mcp-021.machine-observations.boolean.v1'
#   - observations is an object of booleans (18 keys for Family G canonical)
#   - confidence is an object of low|medium|high
#   - modelInfo.classifierSetVersion is 'family-g-v1'
# DOCTRINE: resolution-progress states are DESCRIPTIVE CONVERGENCE-STATE, never
# a verdict about who is leading or has resolved the dispute; concession is a
# scoring repair, synthesis is a gameplay move, settlement is procedural.
CHECK_NAME="20-compat-boolean-family-g"
BOOLEAN_G_REQUEST='{"tool":"classify_argument_boolean_observations","input":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-g-001","parentNodeId":"fixture-node-parent-g-001","currentText":"[fixture] I think we both agree on the BC and Sweden data showing carbon-tax effectiveness; the open question is whether that generalizes. What if both hold, and the open question is which dominates by 2030? I think we are mostly aligned; the remaining piece is the timing question.","parentText":"[fixture] A debate over whether carbon taxes reduce emissions generally.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["resolution_progress"],"requestedRawKeys":["synthesis_proposed","common_ground_identified","concedes_broader_point"],"definitions":{},"timeoutMs":12000}}'
note "POST $BASE_URL/mcp/adapter-compat (boolean Family G)"
RESPONSE="$(http_request POST /mcp/adapter-compat 200 "$TOKEN" "$BOOLEAN_G_REQUEST")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-g-v1"'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected real Family G response shape. Got: $RESPONSE"
fi

# ── Check 21: POST /mcp tools/call classify_argument_boolean_observations (Family G) ──
# MCP-SERVER-008-FAMILY-G. Same body + same assertion pattern as Check 20, but via
# the official MCP /mcp endpoint with JSON-RPC envelope.
CHECK_NAME="21-mcp-tools-call-boolean-family-g"
BOOLEAN_G_CALL_BODY='{"jsonrpc":"2.0","id":"smoke-call-8","method":"tools/call","params":{"name":"classify_argument_boolean_observations","arguments":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-g-001","parentNodeId":"fixture-node-parent-g-001","currentText":"[fixture] I think we both agree on the BC and Sweden data showing carbon-tax effectiveness; the open question is whether that generalizes. What if both hold, and the open question is which dominates by 2030? I think we are mostly aligned; the remaining piece is the timing question.","parentText":"[fixture] A debate over whether carbon taxes reduce emissions generally.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["resolution_progress"],"requestedRawKeys":["synthesis_proposed","common_ground_identified","concedes_broader_point"],"definitions":{},"timeoutMs":12000}}}'
note "POST $BASE_URL/mcp (tools/call classify_argument_boolean_observations Family G)"
RESPONSE="$(http_request POST /mcp 200 "$TOKEN" "$BOOLEAN_G_CALL_BODY")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-g-v1"' \
     && contains "$RESPONSE" '"isError":false'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected real Family G tool result. Got: $RESPONSE"
fi

# ── Check 22: POST /mcp/adapter-compat boolean classify_argument_boolean_observations (Family H) ──
# MCP-SERVER-009-FAMILY-H. Mirrors Checks 20+21 but for Family H
# (claim_clarity). The request body uses a benign claim-clarity move and
# requests the 4 HIGHEST-risk keys + claim_specificity_high to exercise the
# doctrine-risky path. The response MUST contain "family-h-v1" in
# modelInfo.classifierSetVersion.
CHECK_NAME="22-compat-boolean-family-h"
BOOLEAN_H_REQUEST='{"tool":"classify_argument_boolean_observations","input":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-h-001","parentNodeId":"fixture-node-parent-h-001","currentText":"[fixture] Carbon taxes reduce emissions in BC and Sweden because the 2015-2020 data show a 12% sustained delta in jurisdictions with stable enforcement.","parentText":"[fixture] A debate over whether carbon taxes reduce emissions generally.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["claim_clarity"],"requestedRawKeys":["claim_specificity_low","conclusion_missing","reason_missing","unclear_reference_present","claim_specificity_high"],"definitions":{},"timeoutMs":12000}}'
note "POST $BASE_URL/mcp/adapter-compat (boolean Family H)"
RESPONSE="$(http_request POST /mcp/adapter-compat 200 "$TOKEN" "$BOOLEAN_H_REQUEST")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-h-v1"'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected real Family H response shape. Got: $RESPONSE"
fi

# ── Check 23: POST /mcp tools/call classify_argument_boolean_observations (Family H) ──
# MCP-SERVER-009-FAMILY-H. Same body + same assertion pattern as Check 22, but via
# the official MCP /mcp endpoint with JSON-RPC envelope.
CHECK_NAME="23-mcp-tools-call-boolean-family-h"
BOOLEAN_H_CALL_BODY='{"jsonrpc":"2.0","id":"smoke-call-9","method":"tools/call","params":{"name":"classify_argument_boolean_observations","arguments":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-h-001","parentNodeId":"fixture-node-parent-h-001","currentText":"[fixture] Carbon taxes reduce emissions in BC and Sweden because the 2015-2020 data show a 12% sustained delta in jurisdictions with stable enforcement.","parentText":"[fixture] A debate over whether carbon taxes reduce emissions generally.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["claim_clarity"],"requestedRawKeys":["claim_specificity_low","conclusion_missing","reason_missing","unclear_reference_present","claim_specificity_high"],"definitions":{},"timeoutMs":12000}}}'
note "POST $BASE_URL/mcp (tools/call classify_argument_boolean_observations Family H)"
RESPONSE="$(http_request POST /mcp 200 "$TOKEN" "$BOOLEAN_H_CALL_BODY")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-h-v1"' \
     && contains "$RESPONSE" '"isError":false'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected real Family H tool result. Got: $RESPONSE"
fi

# ── Check 24: POST /mcp/adapter-compat boolean classify_argument_boolean_observations (Family I) ──
# MCP-SERVER-010-FAMILY-I. Mirrors Checks 22+23 but for Family I
# (thread_topology). The request body uses a benign thread-topology move
# (opens a new issue + compares two options) and requests the 2 misreadable
# keys (introduces_new_issue, returns_to_prior_issue) plus the comparison
# keys to exercise the boundary path. The response MUST contain "family-i-v1"
# in modelInfo.classifierSetVersion.
CHECK_NAME="24-compat-boolean-family-i"
BOOLEAN_I_REQUEST='{"tool":"classify_argument_boolean_observations","input":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-i-001","parentNodeId":"fixture-node-parent-i-001","currentText":"[fixture] Worth thinking about museum funding too — that is a different question. On staffing specifically, carbon tax vs cap-and-trade: the tax is simpler and more predictable; cap-and-trade has better political durability.","parentText":"[fixture] A debate over whether library funding should be increased this budget cycle.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["thread_topology"],"requestedRawKeys":["introduces_new_issue","returns_to_prior_issue","introduces_sub_axis","compares_options"],"definitions":{},"timeoutMs":12000}}'
note "POST $BASE_URL/mcp/adapter-compat (boolean Family I)"
RESPONSE="$(http_request POST /mcp/adapter-compat 200 "$TOKEN" "$BOOLEAN_I_REQUEST")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-i-v1"'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected real Family I response shape. Got: $RESPONSE"
fi

# ── Check 25: POST /mcp tools/call classify_argument_boolean_observations (Family I) ──
# MCP-SERVER-010-FAMILY-I. Same body + same assertion pattern as Check 24, but via
# the official MCP /mcp endpoint with JSON-RPC envelope.
CHECK_NAME="25-mcp-tools-call-boolean-family-i"
BOOLEAN_I_CALL_BODY='{"jsonrpc":"2.0","id":"smoke-call-10","method":"tools/call","params":{"name":"classify_argument_boolean_observations","arguments":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-i-001","parentNodeId":"fixture-node-parent-i-001","currentText":"[fixture] Worth thinking about museum funding too — that is a different question. On staffing specifically, carbon tax vs cap-and-trade: the tax is simpler and more predictable; cap-and-trade has better political durability.","parentText":"[fixture] A debate over whether library funding should be increased this budget cycle.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["thread_topology"],"requestedRawKeys":["introduces_new_issue","returns_to_prior_issue","introduces_sub_axis","compares_options"],"definitions":{},"timeoutMs":12000}}}'
note "POST $BASE_URL/mcp (tools/call classify_argument_boolean_observations Family I)"
RESPONSE="$(http_request POST /mcp 200 "$TOKEN" "$BOOLEAN_I_CALL_BODY")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"observations"' \
     && contains "$RESPONSE" '"confidence"' \
     && contains "$RESPONSE" '"modelInfo"' \
     && contains "$RESPONSE" '"family-i-v1"' \
     && contains "$RESPONSE" '"isError":false'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "Expected real Family I tool result. Got: $RESPONSE"
fi

# ── Check 26: POST /mcp/adapter-compat — Family B BUILD-2b NEW keys present ──
# OPS-DENO-GOLIVE pilot (MCP-BUILD2a / #538). SMOKE HARNESS ONLY — NOT product
# behavior, NOT a new boolean. This check is the merged-≠-live proof: it asks
# the hosted Deno build for the 3 NEW Family-B booleans
# (isolates_main_disagreement, distinguishes_fact_value_disagreement,
# preserves_face_while_disagreeing) and FAILS CLOSED unless all three appear in
# the response. A STALE Deno deploy (pre-#538, 14-key Family B) returns
# unsupported_rawKey / omits the keys, so a green baseline Family-B check (10/11)
# can NOT mask a stale deploy. Key-presence is value-agnostic (true OR false is
# fine — we are proving the classifier KNOWS the keys, not what it answered).
CHECK_NAME="26-compat-boolean-family-b-build2b-newkeys"
BOOLEAN_B2_REQUEST='{"tool":"classify_argument_boolean_observations","input":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-b2-001","parentNodeId":"fixture-node-parent-b2-001","currentText":"[fixture] I think we actually agree the goal is worthwhile — where we differ is specifically whether the 2019 figures show causation or only correlation. That is an empirical question, not a values one, and I respect the case you are making.","parentText":"[fixture] Library funding should be increased because the 2019 figures prove it boosts literacy.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["disagreement_axis"],"requestedRawKeys":["isolates_main_disagreement","distinguishes_fact_value_disagreement","preserves_face_while_disagreeing"],"definitions":{},"timeoutMs":12000}}'
note "POST $BASE_URL/mcp/adapter-compat (boolean Family B Build-2b NEW keys)"
RESPONSE="$(http_request POST /mcp/adapter-compat 200 "$TOKEN" "$BOOLEAN_B2_REQUEST")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"family-b-v1"' \
     && ! contains "$RESPONSE" 'unsupported_rawKey' \
     && contains "$RESPONSE" '"isolates_main_disagreement"' \
     && contains "$RESPONSE" '"distinguishes_fact_value_disagreement"' \
     && contains "$RESPONSE" '"preserves_face_while_disagreeing"'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "STALE-DENO PROOF: expected the 3 Build-2b Family-B keys returned (no unsupported_rawKey). A failure here means the hosted Deno build predates #538 — merged is not live. Got: $RESPONSE"
fi

# ── Check 27: POST /mcp tools/call — Family B BUILD-2b NEW keys present ──
# Same merged-≠-live assertion as Check 26, via the official MCP /mcp JSON-RPC
# envelope. SMOKE HARNESS ONLY — not product behavior.
CHECK_NAME="27-mcp-tools-call-boolean-family-b-build2b-newkeys"
BOOLEAN_B2_CALL_BODY='{"jsonrpc":"2.0","id":"smoke-call-11","method":"tools/call","params":{"name":"classify_argument_boolean_observations","arguments":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-b2-001","parentNodeId":"fixture-node-parent-b2-001","currentText":"[fixture] I think we actually agree the goal is worthwhile — where we differ is specifically whether the 2019 figures show causation or only correlation. That is an empirical question, not a values one, and I respect the case you are making.","parentText":"[fixture] Library funding should be increased because the 2019 figures prove it boosts literacy.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["disagreement_axis"],"requestedRawKeys":["isolates_main_disagreement","distinguishes_fact_value_disagreement","preserves_face_while_disagreeing"],"definitions":{},"timeoutMs":12000}}}'
note "POST $BASE_URL/mcp (tools/call Family B Build-2b NEW keys)"
RESPONSE="$(http_request POST /mcp 200 "$TOKEN" "$BOOLEAN_B2_CALL_BODY")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"family-b-v1"' \
     && contains "$RESPONSE" '"isError":false' \
     && ! contains "$RESPONSE" 'unsupported_rawKey' \
     && contains "$RESPONSE" '"isolates_main_disagreement"' \
     && contains "$RESPONSE" '"distinguishes_fact_value_disagreement"' \
     && contains "$RESPONSE" '"preserves_face_while_disagreeing"'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "STALE-DENO PROOF: expected the 3 Build-2b Family-B keys in the tool result (no unsupported_rawKey). A failure here means the hosted Deno build predates #538 — merged is not live. Got: $RESPONSE"
fi

# ── Check 28: POST /mcp/adapter-compat — Family A BUILD-2b NEW keys present ──
# OPS-DENO-GOLIVE pilot (MCP-BUILD2b / #540). SMOKE HARNESS ONLY — NOT product
# behavior, NOT a new boolean. This check is the merged-≠-live proof: it asks
# the hosted Deno build for the 3 NEW Family-A booleans
# (acknowledges_parent_strength, compares_parent_to_sibling_branch,
# identifies_parent_scope_limit) and FAILS CLOSED unless all three appear in
# the response. A STALE Deno deploy (pre-#540, 16-key Family A) returns
# unsupported_rawKey / omits the keys, so a green baseline Family-A check (5/9)
# can NOT mask a stale deploy. Key-presence is value-agnostic (true OR false is
# fine — we are proving the classifier KNOWS the keys, not what it answered).
CHECK_NAME="28-compat-boolean-family-a-build2b-newkeys"
BOOLEAN_A2_REQUEST='{"tool":"classify_argument_boolean_observations","input":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-a2-001","parentNodeId":"fixture-node-parent-a2-001","currentText":"[fixture] You make a fair point that the 2019 figures are striking — I grant that. Where I differ is narrower: compared with the sibling proposal in this thread, this plan only addresses urban branches, so its scope is limited to metro areas.","parentText":"[fixture] Library funding should be increased because the 2019 figures prove it boosts literacy.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["parent_relation"],"requestedRawKeys":["acknowledges_parent_strength","compares_parent_to_sibling_branch","identifies_parent_scope_limit"],"definitions":{},"timeoutMs":12000}}'
note "POST $BASE_URL/mcp/adapter-compat (boolean Family A Build-2b NEW keys)"
RESPONSE="$(http_request POST /mcp/adapter-compat 200 "$TOKEN" "$BOOLEAN_A2_REQUEST")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"family-a-v1"' \
     && ! contains "$RESPONSE" 'unsupported_rawKey' \
     && contains "$RESPONSE" '"acknowledges_parent_strength"' \
     && contains "$RESPONSE" '"compares_parent_to_sibling_branch"' \
     && contains "$RESPONSE" '"identifies_parent_scope_limit"'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "STALE-DENO PROOF: expected the 3 Build-2b Family-A keys returned (no unsupported_rawKey). A failure here means the hosted Deno build predates #540 — merged is not live. Got: $RESPONSE"
fi

# ── Check 29: POST /mcp tools/call — Family A BUILD-2b NEW keys present ──
# Same merged-≠-live assertion as Check 28, via the official MCP /mcp JSON-RPC
# envelope. SMOKE HARNESS ONLY — not product behavior.
CHECK_NAME="29-mcp-tools-call-boolean-family-a-build2b-newkeys"
BOOLEAN_A2_CALL_BODY='{"jsonrpc":"2.0","id":"smoke-call-12","method":"tools/call","params":{"name":"classify_argument_boolean_observations","arguments":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-a2-001","parentNodeId":"fixture-node-parent-a2-001","currentText":"[fixture] You make a fair point that the 2019 figures are striking — I grant that. Where I differ is narrower: compared with the sibling proposal in this thread, this plan only addresses urban branches, so its scope is limited to metro areas.","parentText":"[fixture] Library funding should be increased because the 2019 figures prove it boosts literacy.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["parent_relation"],"requestedRawKeys":["acknowledges_parent_strength","compares_parent_to_sibling_branch","identifies_parent_scope_limit"],"definitions":{},"timeoutMs":12000}}}'
note "POST $BASE_URL/mcp (tools/call Family A Build-2b NEW keys)"
RESPONSE="$(http_request POST /mcp 200 "$TOKEN" "$BOOLEAN_A2_CALL_BODY")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"family-a-v1"' \
     && contains "$RESPONSE" '"isError":false' \
     && ! contains "$RESPONSE" 'unsupported_rawKey' \
     && contains "$RESPONSE" '"acknowledges_parent_strength"' \
     && contains "$RESPONSE" '"compares_parent_to_sibling_branch"' \
     && contains "$RESPONSE" '"identifies_parent_scope_limit"'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "STALE-DENO PROOF: expected the 3 Build-2b Family-A keys in the tool result (no unsupported_rawKey). A failure here means the hosted Deno build predates #540 — merged is not live. Got: $RESPONSE"
fi

# ── Check 30: POST /mcp/adapter-compat — Family C BUILD-2c NEW keys present ──
# OPS-DENO-GOLIVE pilot (MCP-BUILD2c / #541). SMOKE HARNESS ONLY — NOT product
# behavior, NOT a new boolean. This check is the merged-≠-live proof: it asks
# the hosted Deno build for the 3 NEW Family-C booleans
# (offers_repair_path, names_ambiguity_source, accepts_correction) and FAILS
# CLOSED unless all three appear in the response. A STALE Deno deploy (pre-#541,
# 17-key Family C) returns unsupported_rawKey / omits the keys, so a green
# baseline Family-C check (12/13) can NOT mask a stale deploy. Key-presence is
# value-agnostic (true OR false is fine — we are proving the classifier KNOWS
# the keys, not what it answered).
CHECK_NAME="30-compat-boolean-family-c-build2c-newkeys"
BOOLEAN_C2_REQUEST='{"tool":"classify_argument_boolean_observations","input":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-c2-001","parentNodeId":"fixture-node-parent-c2-001","currentText":"[fixture] I see the mix-up now — when you said infrastructure I read it as physical buildings, but you meant the broader civic-service role; that ambiguous term is what we were talking past. I take up your restatement, and here is a path: let us agree to define infrastructure in the shared-service sense for the rest of this thread so we stop diverging.","parentText":"[fixture] Libraries are infrastructure and deserve funding like roads.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["misunderstanding_repair"],"requestedRawKeys":["offers_repair_path","names_ambiguity_source","accepts_correction"],"definitions":{},"timeoutMs":12000}}'
note "POST $BASE_URL/mcp/adapter-compat (boolean Family C Build-2c NEW keys)"
RESPONSE="$(http_request POST /mcp/adapter-compat 200 "$TOKEN" "$BOOLEAN_C2_REQUEST")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"family-c-v1"' \
     && ! contains "$RESPONSE" 'unsupported_rawKey' \
     && contains "$RESPONSE" '"offers_repair_path"' \
     && contains "$RESPONSE" '"names_ambiguity_source"' \
     && contains "$RESPONSE" '"accepts_correction"'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "STALE-DENO PROOF: expected the 3 Build-2c Family-C keys returned (no unsupported_rawKey). A failure here means the hosted Deno build predates #541 — merged is not live. Got: $RESPONSE"
fi

# ── Check 31: POST /mcp tools/call — Family C BUILD-2c NEW keys present ──
# Same merged-≠-live assertion as Check 30, via the official MCP /mcp JSON-RPC
# envelope. SMOKE HARNESS ONLY — not product behavior.
CHECK_NAME="31-mcp-tools-call-boolean-family-c-build2c-newkeys"
BOOLEAN_C2_CALL_BODY='{"jsonrpc":"2.0","id":"smoke-call-13","method":"tools/call","params":{"name":"classify_argument_boolean_observations","arguments":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-c2-001","parentNodeId":"fixture-node-parent-c2-001","currentText":"[fixture] I see the mix-up now — when you said infrastructure I read it as physical buildings, but you meant the broader civic-service role; that ambiguous term is what we were talking past. I take up your restatement, and here is a path: let us agree to define infrastructure in the shared-service sense for the rest of this thread so we stop diverging.","parentText":"[fixture] Libraries are infrastructure and deserve funding like roads.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["misunderstanding_repair"],"requestedRawKeys":["offers_repair_path","names_ambiguity_source","accepts_correction"],"definitions":{},"timeoutMs":12000}}}'
note "POST $BASE_URL/mcp (tools/call Family C Build-2c NEW keys)"
RESPONSE="$(http_request POST /mcp 200 "$TOKEN" "$BOOLEAN_C2_CALL_BODY")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"family-c-v1"' \
     && contains "$RESPONSE" '"isError":false' \
     && ! contains "$RESPONSE" 'unsupported_rawKey' \
     && contains "$RESPONSE" '"offers_repair_path"' \
     && contains "$RESPONSE" '"names_ambiguity_source"' \
     && contains "$RESPONSE" '"accepts_correction"'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "STALE-DENO PROOF: expected the 3 Build-2c Family-C keys in the tool result (no unsupported_rawKey). A failure here means the hosted Deno build predates #541 — merged is not live. Got: $RESPONSE"
fi

# ── Check 32: POST /mcp/adapter-compat — Family E BUILD-2e NEW keys present ──
# OPS-DENO-GOLIVE pilot (MCP-BUILD2e / #542). SMOKE HARNESS ONLY — NOT product
# behavior, NOT a new boolean. This check is the merged-≠-live proof: it asks
# the hosted Deno build for the 3 NEW Family-E booleans
# (linked_premise_structure, convergent_premise_structure,
# enthymeme_gap_detected) and FAILS CLOSED unless all three appear in the
# response. A STALE Deno deploy (pre-#542, 16-key Family E) returns
# unsupported_rawKey / omits the keys, so a green baseline Family-E check
# (16/17) can NOT mask a stale deploy. Key-presence is value-agnostic (true OR
# false is fine — we are proving the classifier KNOWS the keys, not what it
# answered). The fixture body is doctrine-safe: detecting an unstated step
# (enthymeme) is a STRUCTURAL observation about the move's inference, never a
# verdict that the move is weak or wrong.
CHECK_NAME="32-compat-boolean-family-e-build2e-newkeys"
BOOLEAN_E2_REQUEST='{"tool":"classify_argument_boolean_observations","input":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-e2-001","parentNodeId":"fixture-node-parent-e2-001","currentText":"[fixture] Funding the new branch will raise literacy: the staffing budget and the outreach program each independently move the needle, and the building plan only works if both the lease and the grant come through. So the council should approve it this cycle.","parentText":"[fixture] The council is weighing whether to fund a new library branch this budget cycle.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["argument_scheme"],"requestedRawKeys":["linked_premise_structure","convergent_premise_structure","enthymeme_gap_detected"],"definitions":{},"timeoutMs":12000}}'
note "POST $BASE_URL/mcp/adapter-compat (boolean Family E Build-2e NEW keys)"
RESPONSE="$(http_request POST /mcp/adapter-compat 200 "$TOKEN" "$BOOLEAN_E2_REQUEST")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"family-e-v1"' \
     && ! contains "$RESPONSE" 'unsupported_rawKey' \
     && contains "$RESPONSE" '"linked_premise_structure"' \
     && contains "$RESPONSE" '"convergent_premise_structure"' \
     && contains "$RESPONSE" '"enthymeme_gap_detected"'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "STALE-DENO PROOF: expected the 3 Build-2e Family-E keys returned (no unsupported_rawKey). A failure here means the hosted Deno build predates #542 — merged is not live. Got: $RESPONSE"
fi

# ── Check 33: POST /mcp tools/call — Family E BUILD-2e NEW keys present ──
# Same merged-≠-live assertion as Check 32, via the official MCP /mcp JSON-RPC
# envelope. SMOKE HARNESS ONLY — not product behavior.
CHECK_NAME="33-mcp-tools-call-boolean-family-e-build2e-newkeys"
BOOLEAN_E2_CALL_BODY='{"jsonrpc":"2.0","id":"smoke-call-14","method":"tools/call","params":{"name":"classify_argument_boolean_observations","arguments":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-e2-001","parentNodeId":"fixture-node-parent-e2-001","currentText":"[fixture] Funding the new branch will raise literacy: the staffing budget and the outreach program each independently move the needle, and the building plan only works if both the lease and the grant come through. So the council should approve it this cycle.","parentText":"[fixture] The council is weighing whether to fund a new library branch this budget cycle.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["argument_scheme"],"requestedRawKeys":["linked_premise_structure","convergent_premise_structure","enthymeme_gap_detected"],"definitions":{},"timeoutMs":12000}}}'
note "POST $BASE_URL/mcp (tools/call Family E Build-2e NEW keys)"
RESPONSE="$(http_request POST /mcp 200 "$TOKEN" "$BOOLEAN_E2_CALL_BODY")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"family-e-v1"' \
     && contains "$RESPONSE" '"isError":false' \
     && ! contains "$RESPONSE" 'unsupported_rawKey' \
     && contains "$RESPONSE" '"linked_premise_structure"' \
     && contains "$RESPONSE" '"convergent_premise_structure"' \
     && contains "$RESPONSE" '"enthymeme_gap_detected"'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "STALE-DENO PROOF: expected the 3 Build-2e Family-E keys in the tool result (no unsupported_rawKey). A failure here means the hosted Deno build predates #542 — merged is not live. Got: $RESPONSE"
fi

# ── Check 34: POST /mcp/adapter-compat — Family F BUILD-2f NEW keys present ──
# OPS-DENO-GOLIVE pilot (MCP-BUILD2f / #543). SMOKE HARNESS ONLY — NOT product
# behavior, NOT a new boolean. This check is the merged-≠-live proof: it asks
# the hosted Deno build for the 3 NEW Family-F booleans
# (question_names_uncertainty, question_separates_claim_evidence,
# question_invites_revision) and FAILS CLOSED unless all three appear in the
# response. A STALE Deno deploy (pre-#543, 14-key Family F) returns
# unsupported_rawKey / omits the keys, so a green baseline Family-F check
# (18/19) can NOT mask a stale deploy. Key-presence is value-agnostic (true OR
# false is fine — we are proving the classifier KNOWS the keys, not what it
# answered). The fixture body is doctrine-safe: it is a genuine clarifying
# QUESTION that names its own uncertainty and invites optional refinement —
# inviting revision is a STRUCTURAL observation about the move's own question,
# never a verdict that the parent is wrong, weak, or NEEDS revision.
CHECK_NAME="34-compat-boolean-family-f-build2f-newkeys"
BOOLEAN_F2_REQUEST='{"tool":"classify_argument_boolean_observations","input":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-f2-001","parentNodeId":"fixture-node-parent-f2-001","currentText":"[fixture] To make sure I am following: which part of this is the claim, and which part is the evidence you are leaning on? I am genuinely unsure how far the 2019 figures let us go on causation versus correlation — if that uncertainty turns out to matter, is there room to refine the scope together?","parentText":"[fixture] Library funding should be increased because the 2019 figures show it boosts literacy.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["critical_question"],"requestedRawKeys":["question_names_uncertainty","question_separates_claim_evidence","question_invites_revision"],"definitions":{},"timeoutMs":12000}}'
note "POST $BASE_URL/mcp/adapter-compat (boolean Family F Build-2f NEW keys)"
RESPONSE="$(http_request POST /mcp/adapter-compat 200 "$TOKEN" "$BOOLEAN_F2_REQUEST")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"family-f-v1"' \
     && ! contains "$RESPONSE" 'unsupported_rawKey' \
     && contains "$RESPONSE" '"question_names_uncertainty"' \
     && contains "$RESPONSE" '"question_separates_claim_evidence"' \
     && contains "$RESPONSE" '"question_invites_revision"'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "STALE-DENO PROOF: expected the 3 Build-2f Family-F keys returned (no unsupported_rawKey). A failure here means the hosted Deno build predates #543 — merged is not live. Got: $RESPONSE"
fi

# ── Check 35: POST /mcp tools/call — Family F BUILD-2f NEW keys present ──
# Same merged-≠-live assertion as Check 34, via the official MCP /mcp JSON-RPC
# envelope. SMOKE HARNESS ONLY — not product behavior.
CHECK_NAME="35-mcp-tools-call-boolean-family-f-build2f-newkeys"
BOOLEAN_F2_CALL_BODY='{"jsonrpc":"2.0","id":"smoke-call-15","method":"tools/call","params":{"name":"classify_argument_boolean_observations","arguments":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-f2-001","parentNodeId":"fixture-node-parent-f2-001","currentText":"[fixture] To make sure I am following: which part of this is the claim, and which part is the evidence you are leaning on? I am genuinely unsure how far the 2019 figures let us go on causation versus correlation — if that uncertainty turns out to matter, is there room to refine the scope together?","parentText":"[fixture] Library funding should be increased because the 2019 figures show it boosts literacy.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["critical_question"],"requestedRawKeys":["question_names_uncertainty","question_separates_claim_evidence","question_invites_revision"],"definitions":{},"timeoutMs":12000}}}'
note "POST $BASE_URL/mcp (tools/call Family F Build-2f NEW keys)"
RESPONSE="$(http_request POST /mcp 200 "$TOKEN" "$BOOLEAN_F2_CALL_BODY")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"family-f-v1"' \
     && contains "$RESPONSE" '"isError":false' \
     && ! contains "$RESPONSE" 'unsupported_rawKey' \
     && contains "$RESPONSE" '"question_names_uncertainty"' \
     && contains "$RESPONSE" '"question_separates_claim_evidence"' \
     && contains "$RESPONSE" '"question_invites_revision"'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "STALE-DENO PROOF: expected the 3 Build-2f Family-F keys in the tool result (no unsupported_rawKey). A failure here means the hosted Deno build predates #543 — merged is not live. Got: $RESPONSE"
fi

# ── Check 36: POST /mcp/adapter-compat — Family D BUILD-2d NEW keys present ──
# MCP-BUILD2d / #547. SMOKE HARNESS ONLY — NOT product behavior, NOT a new
# boolean. This check is the merged-≠-live proof: it asks the hosted Deno build
# for the 3 NEW Family-D booleans (names_method_difference,
# separates_observation_from_inference, flags_context_limit) and FAILS CLOSED
# unless all three appear in the response. A STALE Deno deploy (pre-#547, 19-key
# Family D Subset) returns unsupported_rawKey / omits the keys, so a green
# baseline Family-D check (14/15) can NOT mask a stale deploy. This DIRECT-Deno
# check requests only the 3 NEW keys (3 ≤ 20), so it bypasses the Edge 2-batch
# split entirely — that is correct: the server serves any ≤20-key subset as one
# normal single-family request; the 16+6 split lives in the Edge classifier, not
# here. Key-presence is value-agnostic (true OR false is fine — we are proving
# the classifier KNOWS the keys, not what it answered). The fixture body is
# doctrine-safe: it surfaces evidence DYNAMICS (a method difference, an
# observation-vs-inference distinction, a context/applicability limit) —
# flagging a limit is a STRUCTURAL observation about the move and NEVER grants or
# denies factual standing or truth, and never judges the author.
CHECK_NAME="36-compat-boolean-family-d-build2d-newkeys"
BOOLEAN_D2_REQUEST='{"tool":"classify_argument_boolean_observations","input":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-d2-001","parentNodeId":"fixture-node-parent-d2-001","currentText":"[fixture] Per the 2024 EPA report Table 3.1, urban EV-heavy cities show a 40% drop in tailpipe emissions from 2020 to 2023. That study used administrative records while the survey you cited used self-report — a method difference. The data shows the correlation; reading it as causation is an inference, not in the measurement. It holds for the 2020-2023 window; the fleet mix has shifted since, so its applicability there is limited.","parentText":"[fixture] EVs reduce emissions in cities.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["evidence_source_chain"],"requestedRawKeys":["names_method_difference","separates_observation_from_inference","flags_context_limit"],"definitions":{},"timeoutMs":12000}}'
note "POST $BASE_URL/mcp/adapter-compat (boolean Family D Build-2d NEW keys)"
RESPONSE="$(http_request POST /mcp/adapter-compat 200 "$TOKEN" "$BOOLEAN_D2_REQUEST")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"family-d-v1"' \
     && ! contains "$RESPONSE" 'unsupported_rawKey' \
     && contains "$RESPONSE" '"names_method_difference"' \
     && contains "$RESPONSE" '"separates_observation_from_inference"' \
     && contains "$RESPONSE" '"flags_context_limit"'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "STALE-DENO PROOF: expected the 3 Build-2d Family-D keys returned (no unsupported_rawKey). A failure here means the hosted Deno build predates #547 — merged is not live. Got: $RESPONSE"
fi

# ── Check 37: POST /mcp tools/call — Family D BUILD-2d NEW keys present ──
# Same merged-≠-live assertion as Check 36, via the official MCP /mcp JSON-RPC
# envelope. SMOKE HARNESS ONLY — not product behavior.
CHECK_NAME="37-mcp-tools-call-boolean-family-d-build2d-newkeys"
BOOLEAN_D2_CALL_BODY='{"jsonrpc":"2.0","id":"smoke-call-16","method":"tools/call","params":{"name":"classify_argument_boolean_observations","arguments":{"schemaVersion":"mcp-021.machine-observations.boolean.v1","nodeId":"fixture-node-mainline-d2-001","parentNodeId":"fixture-node-parent-d2-001","currentText":"[fixture] Per the 2024 EPA report Table 3.1, urban EV-heavy cities show a 40% drop in tailpipe emissions from 2020 to 2023. That study used administrative records while the survey you cited used self-report — a method difference. The data shows the correlation; reading it as causation is an inference, not in the measurement. It holds for the 2020-2023 window; the fleet mix has shifted since, so its applicability there is limited.","parentText":"[fixture] EVs reduce emissions in cities.","threadContextExcerpt":"[fixture] thread","requestedFamilies":["evidence_source_chain"],"requestedRawKeys":["names_method_difference","separates_observation_from_inference","flags_context_limit"],"definitions":{},"timeoutMs":12000}}}'
note "POST $BASE_URL/mcp (tools/call Family D Build-2d NEW keys)"
RESPONSE="$(http_request POST /mcp 200 "$TOKEN" "$BOOLEAN_D2_CALL_BODY")"
if [[ $? -ne 0 ]]; then
  fail "$CHECK_NAME" "$RESPONSE"
elif contains "$RESPONSE" '"schemaVersion":"mcp-021.machine-observations.boolean.v1"' \
     && contains "$RESPONSE" '"family-d-v1"' \
     && contains "$RESPONSE" '"isError":false' \
     && ! contains "$RESPONSE" 'unsupported_rawKey' \
     && contains "$RESPONSE" '"names_method_difference"' \
     && contains "$RESPONSE" '"separates_observation_from_inference"' \
     && contains "$RESPONSE" '"flags_context_limit"'; then
  pass "$CHECK_NAME"
else
  fail "$CHECK_NAME" "STALE-DENO PROOF: expected the 3 Build-2d Family-D keys in the tool result (no unsupported_rawKey). A failure here means the hosted Deno build predates #547 — merged is not live. Got: $RESPONSE"
fi

echo
echo "MCP-SERVER-001 smoke: $PASSES PASSES, $FAILS FAILS"
if [[ "$FAILS" -gt 0 ]]; then
  echo "EXIT: 1"
  exit 1
fi
echo "EXIT: 0"
exit 0
