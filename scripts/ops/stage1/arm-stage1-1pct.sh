#!/usr/bin/env bash
# OPS-MCP-STAGE1-LOCAL-SECRETS-AUTOMATION — arm Stage 1 at 1%.
#
# Sets the Supabase Edge Function env vars:
#   CLASSIFIER_QUEUE_ROUTING_ENABLED=true
#   CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=1
# via `supabase secrets set`, authenticated with the operator's
# SUPABASE_ACCESS_TOKEN (account PAT) sourced from the gitignored
# .claude-tmp/operator-secrets.env. Then verifies the secret NAMES exist,
# waits 120s for Edge propagation, and prints UTC_ARMED_TIMESTAMP.
#
# SECURITY: `set +x` keeps xtrace off; the PAT is passed as an env prefix to
# the CLI and is NEVER echoed. The CLI never prints secret values. The two
# values being set (true / 1) are not secret. Nothing in this script prints
# any secret VALUE.
#
# This is REAL 1% production routing, not a smoke. Disarm with
# scripts/ops/stage1/disarm-stage1.sh.
set -uo pipefail
set +x

PROJECT_REF="qsciikhztvzzohssddrq"
SECRETS_FILE=".claude-tmp/operator-secrets.env"

if [ ! -f "$SECRETS_FILE" ]; then
  echo "ABORT: $SECRETS_FILE not found"
  exit 2
fi

# shellcheck disable=SC1090
set -a
. "$SECRETS_FILE"
set +a

if [ -z "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "ABORT: SUPABASE_ACCESS_TOKEN not set in $SECRETS_FILE"
  exit 3
fi

SET_UTC="$(date -u +%FT%TZ)"
echo "SET_START_UTC: $SET_UTC"
echo "Setting CLASSIFIER_QUEUE_ROUTING_ENABLED=true + CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=1 (1% only) ..."

SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN" npx supabase secrets set \
  CLASSIFIER_QUEUE_ROUTING_ENABLED=true \
  CLASSIFIER_QUEUE_ROUTING_PERCENTAGE=1 \
  --project-ref "$PROJECT_REF"
set_rc=$?
echo "secrets set exit code: $set_rc"
if [ "$set_rc" -ne 0 ]; then
  echo "ABORT: supabase secrets set failed (rc=$set_rc). Routing NOT armed."
  exit 4
fi

echo "Verifying the routing secret NAMES are present (values are hashed; never shown):"
SUPABASE_ACCESS_TOKEN="$SUPABASE_ACCESS_TOKEN" npx supabase secrets list \
  --project-ref "$PROJECT_REF" \
  | grep -E "CLASSIFIER_QUEUE_ROUTING_(ENABLED|PERCENTAGE)" \
  || echo "WARN: routing secret names not found in secrets list output"

echo "Waiting 120 seconds for Edge Function propagation ..."
sleep 120

ARMED_UTC="$(date -u +%FT%TZ)"
echo "UTC_ARMED_TIMESTAMP: $ARMED_UTC"
echo "RESULT: Stage 1 armed at 1% (ENABLED=true, PERCENTAGE=1). Propagation wait complete."
