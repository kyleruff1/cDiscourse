#!/usr/bin/env bash
# MCP-SERVER-001 — local smoke script (extended by MCP-SERVER-002 + MCP-SERVER-003-FAMILY-B + MCP-SERVER-004-FAMILY-C + MCP-SERVER-005-FAMILY-D + MCP-SERVER-006-FAMILY-E + MCP-SERVER-007-FAMILY-F + MCP-SERVER-008-FAMILY-G + MCP-SERVER-009-FAMILY-H).
#
# Verifies the deployed (or locally-running) MCP server against the 23 checks:
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
#   0 — all 23 checks passed
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

echo
echo "MCP-SERVER-001 smoke: $PASSES PASSES, $FAILS FAILS"
if [[ "$FAILS" -gt 0 ]]; then
  echo "EXIT: 1"
  exit 1
fi
echo "EXIT: 0"
exit 0
